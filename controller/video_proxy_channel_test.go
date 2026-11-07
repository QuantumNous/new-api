package controller

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	relaychannel "github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupPrivateChannelMediaTest(t *testing.T) *model.Task {
	t.Helper()
	task := setupGenericTaskTest(t)
	previousFetch := *system_setting.GetFetchSetting()
	previousCache := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = false
	*system_setting.GetFetchSetting() = system_setting.FetchSetting{
		EnableSSRFProtection: true, ApplyIPFilterForDomain: true,
		AllowedPorts: []string{"443"},
	}
	service.InitHttpClient()
	t.Cleanup(func() {
		common.MemoryCacheEnabled = previousCache
		*system_setting.GetFetchSetting() = previousFetch
		service.InitHttpClient()
	})
	task.Platform = constant.TaskPlatform("google")
	task.PrivateData.Execution = &model.TaskExecutionSnapshot{TaskPlugin: &model.TaskPluginSnapshot{
		Key: "google", Name: "Google Veo (Gemini API)", Version: "1.2.0", APIVersion: 1,
	}}
	return task
}

func TestPrivateChannelMediaDownloadEndpoints(t *testing.T) {
	for _, endpoint := range []string{"video", "artifact"} {
		for _, method := range []string{http.MethodGet, http.MethodHead} {
			t.Run(endpoint+"/"+method, func(t *testing.T) {
				task := setupPrivateChannelMediaTest(t)
				var requests atomic.Int32
				upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					requests.Add(1)
					assert.Equal(t, method, r.Method)
					assert.Equal(t, "provider-key", r.Header.Get("x-goog-api-key"))
					assert.Equal(t, "bytes=0-3", r.Header.Get("Range"))
					assert.Equal(t, `"video-etag"`, r.Header.Get("If-Range"))
					assert.Empty(t, r.Header.Get("Authorization"), "the caller's token must stay at the gateway")
					if r.URL.Path == "/start" {
						http.Redirect(w, r, "/video", http.StatusTemporaryRedirect)
						return
					}
					w.Header().Set("Content-Type", "video/mp4")
					w.Header().Set("Content-Length", "4")
					w.Header().Set("Content-Range", "bytes 0-3/10")
					w.WriteHeader(http.StatusPartialContent)
					if r.Method != http.MethodHead {
						_, _ = w.Write([]byte("data"))
					}
				}))
				defer upstream.Close()
				require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", task.ChannelId).Updates(map[string]any{
					"type": constant.ChannelTypeGemini, "base_url": upstream.URL, "key": "provider-key",
				}).Error)
				task.SetData(map[string]any{"response": map[string]any{
					"generateVideoResponse": map[string]any{
						"generatedSamples": []any{map[string]any{"video": map[string]any{"uri": upstream.URL + "/start"}}},
					},
				}})
				require.NoError(t, model.DB.Save(task).Error)
				recorder := httptest.NewRecorder()
				c, _ := gin.CreateTestContext(recorder)
				c.Set("id", task.UserId)
				c.Set("token_id", 1)
				path := "/v1/videos/" + task.TaskID + "/content"
				handler := VideoProxy
				c.Params = gin.Params{{Key: "task_id", Value: task.TaskID}}
				if endpoint == "artifact" {
					path = "/v1/tasks/" + task.TaskID + "/artifacts/video/content"
					handler = TaskArtifactContent
					c.Params = gin.Params{{Key: "key", Value: task.TaskID}, {Key: "artifact_key", Value: "video"}}
				}
				c.Request = httptest.NewRequest(method, path, nil)
				c.Request.Header.Set("Authorization", "Bearer caller-token")
				c.Request.Header.Set("Range", "bytes=0-3")
				c.Request.Header.Set("If-Range", `"video-etag"`)
				handler(c)

				assert.Equal(t, http.StatusPartialContent, recorder.Code, recorder.Body.String())
				assert.Equal(t, int32(2), requests.Load(), "same-origin redirects must work without relaxing global SSRF settings")
				assert.Equal(t, "video/mp4", recorder.Header().Get("Content-Type"))
				assert.Equal(t, "4", recorder.Header().Get("Content-Length"))
				assert.Equal(t, "bytes 0-3/10", recorder.Header().Get("Content-Range"))
				assert.Equal(t, "private, no-store", recorder.Header().Get("Cache-Control"))
				if method == http.MethodHead {
					assert.Empty(t, recorder.Body.String())
				} else {
					assert.Equal(t, "data", recorder.Body.String())
				}
				assert.False(t, system_setting.GetFetchSetting().AllowPrivateIp)
			})
		}
	}
}

func TestPrivateChannelMediaDoesNotTrustOtherURLs(t *testing.T) {
	for _, name := range []string{"credentialless", "legacy", "other-channel", "other-scheme", "userinfo", "fragment"} {
		t.Run(name, func(t *testing.T) {
			task := setupPrivateChannelMediaTest(t)
			var requests atomic.Int32
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				requests.Add(1)
			}))
			defer upstream.Close()
			baseURL := upstream.URL
			descriptor := &relaychannel.TaskContentRequest{URL: upstream.URL + "/video", Method: http.MethodGet}
			switch name {
			case "credentialless":
				descriptor.Credentialless = true
			case "legacy":
				task.PrivateData.Execution = nil
			case "other-channel":
				baseURL = "http://127.0.0.1:1"
			case "other-scheme":
				baseURL = strings.Replace(baseURL, "http:", "https:", 1)
			case "userinfo":
				descriptor.URL = strings.Replace(descriptor.URL, "http://", "http://user:password@", 1)
			case "fragment":
				descriptor.URL += "#fragment"
			}
			require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", task.ChannelId).Update("base_url", baseURL).Error)
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest(http.MethodGet, "/content", nil)
			err := proxyTaskMedia(c, task, descriptor)
			var proxyErr *taskMediaProxyError
			require.ErrorAs(t, err, &proxyErr)
			assert.Equal(t, "artifact_request_rejected", proxyErr.code)
			assert.Zero(t, requests.Load())
		})
	}
}

func TestPrivateChannelMediaRejectsCrossOriginRedirect(t *testing.T) {
	task := setupPrivateChannelMediaTest(t)
	// Even a globally permitted destination must not inherit the channel's trust.
	system_setting.GetFetchSetting().AllowPrivateIp = true
	system_setting.GetFetchSetting().AllowedPorts = []string{"1-65535"}
	var destinationRequests, sourceRequests atomic.Int32
	destination := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		destinationRequests.Add(1)
	}))
	defer destination.Close()
	source := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sourceRequests.Add(1)
		http.Redirect(w, r, destination.URL, http.StatusFound)
	}))
	defer source.Close()
	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", task.ChannelId).Update("base_url", source.URL).Error)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodGet, "/content", nil)
	err := proxyTaskMedia(c, task, &relaychannel.TaskContentRequest{
		URL: source.URL, Method: http.MethodGet, Headers: map[string]string{"Authorization": "Bearer provider-key"},
	})
	var proxyErr *taskMediaProxyError
	require.ErrorAs(t, err, &proxyErr)
	assert.Equal(t, "artifact_request_rejected", proxyErr.code)
	assert.Equal(t, int32(1), sourceRequests.Load())
	assert.Zero(t, destinationRequests.Load(), "no request or credentials may reach the redirect target")
}

func TestPrivateChannelMediaUsesChannelProxy(t *testing.T) {
	task := setupPrivateChannelMediaTest(t)
	var requests atomic.Int32
	proxy := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests.Add(1)
		assert.Equal(t, "http://private-upstream.invalid:8080/video", r.URL.String())
		assert.Equal(t, "Bearer provider-key", r.Header.Get("Authorization"))
		_, _ = w.Write([]byte("data"))
	}))
	defer proxy.Close()
	channel, err := model.CacheGetChannel(task.ChannelId)
	require.NoError(t, err)
	channel.SetSetting(dto.ChannelSettings{Proxy: proxy.URL})
	require.NoError(t, model.DB.Model(channel).Updates(map[string]any{
		"base_url": "http://private-upstream.invalid:8080", "setting": channel.Setting,
	}).Error)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodGet, "/content", nil)
	require.NoError(t, proxyTaskMedia(c, task, &relaychannel.TaskContentRequest{
		URL: "http://private-upstream.invalid:8080/video", Headers: map[string]string{"Authorization": "Bearer provider-key"},
	}))
	assert.Equal(t, http.StatusOK, recorder.Code)
	assert.Equal(t, "data", recorder.Body.String())
	assert.Equal(t, int32(1), requests.Load())
}

func TestPrivateChannelMediaUsesChannelTLSSettings(t *testing.T) {
	for _, skipVerify := range []bool{false, true} {
		t.Run(map[bool]string{false: "verify", true: "channel-opt-out"}[skipVerify], func(t *testing.T) {
			task := setupPrivateChannelMediaTest(t)
			var requests atomic.Int32
			upstream := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				requests.Add(1)
				_, _ = w.Write([]byte("data"))
			}))
			defer upstream.Close()
			channel, err := model.CacheGetChannel(task.ChannelId)
			require.NoError(t, err)
			channel.SetSetting(dto.ChannelSettings{TLSInsecureSkipVerify: skipVerify})
			require.NoError(t, model.DB.Model(channel).Updates(map[string]any{
				"base_url": upstream.URL, "setting": channel.Setting,
			}).Error)
			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			c.Request = httptest.NewRequest(http.MethodGet, "/content", nil)
			err = proxyTaskMedia(c, task, &relaychannel.TaskContentRequest{URL: upstream.URL + "/video"})
			if !skipVerify {
				var proxyErr *taskMediaProxyError
				require.ErrorAs(t, err, &proxyErr)
				assert.Equal(t, "artifact_upstream_error", proxyErr.code)
				assert.Zero(t, requests.Load(), "private upstream trust must not disable certificate validation")
				return
			}
			require.NoError(t, err)
			assert.Equal(t, http.StatusOK, recorder.Code)
			assert.Equal(t, "data", recorder.Body.String())
			assert.Equal(t, int32(1), requests.Load())
		})
	}
}

func TestTaskMediaChannelOriginComparison(t *testing.T) {
	for _, tc := range []struct {
		base, target string
		allowed      bool
	}{
		{"https://provider.example/v1", "https://PROVIDER.example:443/video", true},
		{"http://provider.example/v1", "http://provider.example:80/video", true},
		{"http://[::1]:8080", "http://[::1]:8080/video", true},
		{"https://provider.example", "http://provider.example/video", false},
		{"http://provider.example:8080", "http://provider.example:8081/video", false},
		{"http://provider.example", "http://provider.example.evil.test/video", false},
	} {
		t.Run(tc.target, func(t *testing.T) {
			base, err := url.Parse(tc.base)
			require.NoError(t, err)
			target, err := url.Parse(tc.target)
			require.NoError(t, err)
			assert.Equal(t, tc.allowed, sameTaskMediaOrigin(base, target))
		})
	}
}
