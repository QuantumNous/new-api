package controller

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

type countingReadCloser struct {
	io.Reader
	closed *bool
}

func (c *countingReadCloser) Close() error {
	*c.closed = true
	return nil
}

type countingReader struct {
	remaining int
	read      int
}

func (r *countingReader) Read(p []byte) (int, error) {
	if r.remaining <= 0 {
		return 0, io.EOF
	}
	if len(p) > r.remaining {
		p = p[:r.remaining]
	}
	for i := range p {
		p[i] = 'a'
	}
	r.remaining -= len(p)
	r.read += len(p)
	return len(p), nil
}

func TestGrokSubscriptionVideoProxyFailureLogIsNeutral(t *testing.T) {
	buf := &strings.Builder{}
	common.LogWriterMu.Lock()
	originalWriter := gin.DefaultErrorWriter
	gin.DefaultErrorWriter = buf
	common.LogWriterMu.Unlock()
	t.Cleanup(func() {
		common.LogWriterMu.Lock()
		gin.DefaultErrorWriter = originalWriter
		common.LogWriterMu.Unlock()
	})

	logGrokSubscriptionProxyFailure(context.Background(), &model.Task{TaskID: "task_grok_log"}, &model.Channel{Id: 11301}, "refresh", 502)

	logText := buf.String()
	require.NotContains(t, logText, "Grok")
	require.NotContains(t, logText, "x.ai")
	require.Contains(t, logText, "phase=refresh")
}

func TestGrokSubscriptionVideoProxyInitialPrivateURLFetchSucceedsAndStripsHeaders(t *testing.T) {
	restore := useVideoProxyDBForTest(t)
	defer restore()
	service.InitHttpClient()
	restoreValidate := setGrokSubscriptionVideoProxyValidateForTest(func(string) error { return nil })
	defer restoreValidate()

	content := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/private.mp4", r.URL.Path)
		w.Header().Set("Content-Type", "video/mp4")
		w.Header().Set("Content-Length", "5")
		w.Header().Set("Set-Cookie", "sid=secret")
		w.Header().Set("Server", "xai-cdn")
		w.Header().Set("X-Amz-Request-Id", "provider-request")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("video"))
	}))
	defer content.Close()
	seedGrokVideoProxyTask(t, "task_grok_initial", "upstream-secret", content.URL+"/private.mp4?token=temp")

	recorder, c := newGrokVideoProxyContext("task_grok_initial")
	VideoProxy(c)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Equal(t, "video", recorder.Body.String())
	require.Equal(t, "video/mp4", recorder.Header().Get("Content-Type"))
	require.Empty(t, recorder.Header().Get("Set-Cookie"))
	require.Empty(t, recorder.Header().Get("Server"))
	require.Empty(t, recorder.Header().Get("X-Amz-Request-Id"))
	require.NotContains(t, recorder.Body.String(), "upstream-secret")
}

func TestGrokSubscriptionVideoProxyBlocksInvalidPrivateURLBeforeTransport(t *testing.T) {
	restore := useVideoProxyDBForTest(t)
	defer restore()
	service.InitHttpClient()
	seedGrokVideoProxyTask(t, "task_grok_blocked", "upstream-secret", "http://127.0.0.1/private.mp4")
	restoreValidate := setGrokSubscriptionVideoProxyValidateForTest(func(string) error { return errors.New("blocked") })
	defer restoreValidate()

	var calls int
	restoreClient := setGrokSubscriptionVideoProxyHTTPClientForTest(func(string) (*http.Client, error) {
		calls++
		return service.GetHttpClientWithProxy("")
	})
	defer restoreClient()

	recorder, c := newGrokVideoProxyContext("task_grok_blocked")
	VideoProxy(c)

	require.Equal(t, http.StatusBadGateway, recorder.Code)
	require.Zero(t, calls)
	require.NotContains(t, recorder.Body.String(), "127.0.0.1")
	require.NotContains(t, recorder.Body.String(), "upstream-secret")
}

func TestGrokSubscriptionVideoProxyDoesNotFollowRedirectOrExposeLocation(t *testing.T) {
	restore := useVideoProxyDBForTest(t)
	defer restore()
	service.InitHttpClient()
	restoreValidate := setGrokSubscriptionVideoProxyValidateForTest(func(string) error { return nil })
	defer restoreValidate()

	content := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Location", "https://vidgen.x.ai/secret.mp4")
		w.WriteHeader(http.StatusFound)
	}))
	defer content.Close()
	seedGrokVideoProxyTask(t, "task_grok_redirect", "upstream-secret", content.URL+"/redirect")

	recorder, c := newGrokVideoProxyContext("task_grok_redirect")
	VideoProxy(c)

	require.Equal(t, http.StatusBadGateway, recorder.Code)
	require.Empty(t, recorder.Header().Get("Location"))
	require.NotContains(t, recorder.Body.String(), "vidgen.x.ai")
	require.NotContains(t, recorder.Body.String(), "upstream-secret")
}

func TestGrokSubscriptionVideoProxyForwardsRangeAndIfRangeAndAcceptsPartialContent(t *testing.T) {
	restore := useVideoProxyDBForTest(t)
	defer restore()
	service.InitHttpClient()
	restoreValidate := setGrokSubscriptionVideoProxyValidateForTest(func(string) error { return nil })
	defer restoreValidate()

	var gotRange, gotIfRange string
	content := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotRange = r.Header.Get("Range")
		gotIfRange = r.Header.Get("If-Range")
		w.Header().Set("Content-Type", "video/mp4")
		w.Header().Set("Content-Range", "bytes 0-3/8")
		w.Header().Set("Accept-Ranges", "bytes")
		w.WriteHeader(http.StatusPartialContent)
		_, _ = w.Write([]byte("part"))
	}))
	defer content.Close()
	seedGrokVideoProxyTask(t, "task_grok_range", "same-upstream", content.URL+"/range")

	recorder, c := newGrokVideoProxyContext("task_grok_range")
	c.Request.Header.Set("Range", "bytes=0-3")
	c.Request.Header.Set("If-Range", `"etag-1"`)
	VideoProxy(c)

	require.Equal(t, http.StatusPartialContent, recorder.Code)
	require.Equal(t, "part", recorder.Body.String())
	require.Equal(t, "bytes=0-3", gotRange)
	require.Equal(t, `"etag-1"`, gotIfRange)
	require.Equal(t, "bytes 0-3/8", recorder.Header().Get("Content-Range"))
	require.Equal(t, "bytes", recorder.Header().Get("Accept-Ranges"))
}

func TestCloseGrokVideoResponseDrainsAtMostOneMiB(t *testing.T) {
	reader := &countingReader{remaining: grokSubscriptionPollResponseMaxBytes + 128}
	var closed bool
	resp := &http.Response{
		Body: &countingReadCloser{
			Reader: reader,
			closed: &closed,
		},
	}

	closeGrokVideoResponse(resp)

	require.True(t, closed)
	require.LessOrEqual(t, reader.read, grokSubscriptionPollResponseMaxBytes)
}

func TestGrokSubscriptionVideoProxyRefreshesOnceForExpiredStatuses(t *testing.T) {
	for _, status := range []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusGone} {
		t.Run(http.StatusText(status), func(t *testing.T) {
			restore := useVideoProxyDBForTest(t)
			defer restore()
			service.InitHttpClient()
			restoreValidate := setGrokSubscriptionVideoProxyValidateForTest(func(string) error { return nil })
			defer restoreValidate()

			var hits int
			content := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				hits++
				if hits == 1 {
					w.WriteHeader(status)
					return
				}
				w.Header().Set("Content-Type", "video/mp4")
				w.WriteHeader(http.StatusOK)
				_, _ = w.Write([]byte("fresh"))
			}))
			defer content.Close()
			taskID := "task_grok_refresh_" + strings.ReplaceAll(http.StatusText(status), " ", "_")
			seedGrokVideoProxyTask(t, taskID, "same-upstream", content.URL+"/expired")

			var polls int
			restorePoll := setGrokSubscriptionVideoProxyPollForTest(func(ctx context.Context, channel *model.Channel, task *model.Task, proxy string) (*relaycommon.TaskInfo, error) {
				polls++
				require.Equal(t, 11301, channel.Id)
				require.Equal(t, "same-upstream", task.GetUpstreamTaskID())
				require.NoError(t, ctx.Err())
				return &relaycommon.TaskInfo{
					TaskID:     "same-upstream",
					Status:     string(model.TaskStatusSuccess),
					Url:        strings.Replace(content.URL+"/expired", "expired", "fresh", 1),
					Duration:   6.5,
					Resolution: "1080p",
				}, nil
			})
			defer restorePoll()

			recorder, c := newGrokVideoProxyContext(taskID)
			VideoProxy(c)

			require.Equal(t, http.StatusOK, recorder.Code)
			require.Equal(t, "fresh", recorder.Body.String())
			require.Equal(t, 2, hits)
			require.Equal(t, 1, polls)
			var stored model.Task
			require.NoError(t, model.DB.Where("task_id = ?", taskID).First(&stored).Error)
			require.Equal(t, content.URL+"/fresh", stored.PrivateData.GrokVideoResult.URL)
			require.Equal(t, taskcommon.BuildProxyURL(stored.TaskID), stored.PrivateData.ResultURL)
		})
	}
}

func TestGrokSubscriptionVideoProxySecondFailureDoesNotRefreshAgain(t *testing.T) {
	restore := useVideoProxyDBForTest(t)
	defer restore()
	service.InitHttpClient()
	restoreValidate := setGrokSubscriptionVideoProxyValidateForTest(func(string) error { return nil })
	defer restoreValidate()

	var hits int
	content := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits++
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer content.Close()
	seedGrokVideoProxyTask(t, "task_grok_second_failure", "same-upstream", content.URL+"/expired")

	var polls int
	restorePoll := setGrokSubscriptionVideoProxyPollForTest(func(context.Context, *model.Channel, *model.Task, string) (*relaycommon.TaskInfo, error) {
		polls++
		return &relaycommon.TaskInfo{TaskID: "same-upstream", Status: string(model.TaskStatusSuccess), Url: content.URL + "/fresh"}, nil
	})
	defer restorePoll()

	recorder, c := newGrokVideoProxyContext("task_grok_second_failure")
	VideoProxy(c)

	require.Equal(t, http.StatusBadGateway, recorder.Code)
	require.Equal(t, 2, hits)
	require.Equal(t, 1, polls)
	require.NotContains(t, recorder.Body.String(), "same-upstream")
}

func TestGrokSubscriptionVideoProxyFailsClosedOnBadRefreshResult(t *testing.T) {
	for _, tt := range []struct {
		name string
		info *relaycommon.TaskInfo
		err  error
	}{
		{name: "pending", info: &relaycommon.TaskInfo{Status: string(model.TaskStatusQueued)}},
		{name: "failed", info: &relaycommon.TaskInfo{Status: string(model.TaskStatusFailure)}},
		{name: "blank-url", info: &relaycommon.TaskInfo{TaskID: "same-upstream", Status: string(model.TaskStatusSuccess)}},
		{name: "mismatch", info: &relaycommon.TaskInfo{TaskID: "other-upstream", Status: string(model.TaskStatusSuccess), Url: "https://example.com/video.mp4"}},
		{name: "error", err: errors.New("poll failed with x.ai secret")},
	} {
		t.Run(tt.name, func(t *testing.T) {
			restore := useVideoProxyDBForTest(t)
			defer restore()
			service.InitHttpClient()
			restoreValidate := setGrokSubscriptionVideoProxyValidateForTest(func(string) error { return nil })
			defer restoreValidate()
			content := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusUnauthorized)
			}))
			defer content.Close()
			seedGrokVideoProxyTask(t, "task_grok_bad_"+tt.name, "same-upstream", content.URL+"/expired")
			restorePoll := setGrokSubscriptionVideoProxyPollForTest(func(context.Context, *model.Channel, *model.Task, string) (*relaycommon.TaskInfo, error) {
				return tt.info, tt.err
			})
			defer restorePoll()

			recorder, c := newGrokVideoProxyContext("task_grok_bad_" + tt.name)
			VideoProxy(c)

			require.Equal(t, http.StatusBadGateway, recorder.Code)
			require.NotContains(t, recorder.Body.String(), "same-upstream")
			require.NotContains(t, recorder.Body.String(), "x.ai")
		})
	}
}

func TestGrokSubscriptionVideoProxyNon113StillUsesGenericBranch(t *testing.T) {
	if !shouldProxyVideoHeader("Content-Type") {
		t.Fatal("header allowlist changed unexpectedly")
	}
}

func seedGrokVideoProxyTask(t *testing.T, publicID, upstreamID, url string) {
	t.Helper()
	require.NoError(t, model.DB.Create(&model.Channel{Id: 11301, Type: constant.ChannelTypeGrokSubscription, Status: common.ChannelStatusEnabled, Name: "grok", Group: "default"}).Error)
	task := &model.Task{
		TaskID:    publicID,
		UserId:    0,
		ChannelId: 11301,
		Platform:  constant.TaskPlatform("113"),
		Action:    constant.TaskActionGenerate,
		Status:    model.TaskStatusSuccess,
		Progress:  "100%",
		PrivateData: model.TaskPrivateData{
			UpstreamTaskID: upstreamID,
			ResultURL:      taskcommon.BuildProxyURL(publicID),
			GrokVideoResult: &model.GrokSubscriptionVideoResult{
				URL:         url,
				Duration:    4.5,
				Resolution:  "720p",
				RefreshedAt: 1,
			},
		},
		Data: []byte(`{"redacted":true}`),
	}
	require.NoError(t, model.DB.Create(task).Error)
}

func newGrokVideoProxyContext(taskID string) (*httptest.ResponseRecorder, *gin.Context) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Params = gin.Params{{Key: "task_id", Value: taskID}}
	c.Request = httptest.NewRequest(http.MethodGet, "/v1/videos/"+taskID+"/content", nil)
	return recorder, c
}

var _ = io.Copy
var _ = dto.VideoStatusCompleted
