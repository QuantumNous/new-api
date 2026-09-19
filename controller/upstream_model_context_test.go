package controller

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// fakeEngineModelsServer answers GET /v1/models the way a vLLM/SGLang engine
// does, including the max_model_len extension field. A nil length omits the
// field entirely.
func fakeEngineModelsServer(t *testing.T, models map[string]*int64) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/models" {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		entries := make([]map[string]any, 0, len(models))
		for id, maxLen := range models {
			entry := map[string]any{
				"id":         id,
				"object":     "model",
				"created":    1700000000,
				"owned_by":   "vllm",
				"permission": []any{},
			}
			if maxLen != nil {
				entry["max_model_len"] = *maxLen
			}
			entries = append(entries, entry)
		}
		w.Header().Set("Content-Type", "application/json")
		body, err := common.Marshal(map[string]any{
			"object": "list",
			"data":   entries,
		})
		if assert.NoError(t, err) {
			_, _ = w.Write(body)
		}
	}))
}

func int64Ptr(v int64) *int64 { return &v }

// A negative limit simulates an outage; zero is a healthy response without
// max_model_len. Atomic updates let tests change the engine between syncs.
func fakeMutableEngineModelsServer(t *testing.T, name string, initialLimit int64) (*httptest.Server, *atomic.Int64) {
	t.Helper()
	limit := &atomic.Int64{}
	limit.Store(initialLimit)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		length := limit.Load()
		if length < 0 {
			w.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		entry := map[string]any{"id": name}
		if length > 0 {
			entry["max_model_len"] = length
		}
		body, err := common.Marshal(map[string]any{"data": []map[string]any{entry}})
		if assert.NoError(t, err) {
			_, _ = w.Write(body)
		}
	}))
	t.Cleanup(server.Close)
	return server, limit
}

func setUpstreamContextTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db := setupModelListControllerTestDB(t)
	withSelfUseModeEnabled(t)
	return db
}

func resetUpstreamContextCache(t *testing.T) {
	t.Helper()
	seedUpstreamContextsForTest(map[string]int64{})
	t.Cleanup(func() { seedUpstreamContextsForTest(map[string]int64{}) })
}

func createEngineChannel(t *testing.T, db *gorm.DB, id int, channelType int, name, baseURL string) *model.Channel {
	t.Helper()
	channel := &model.Channel{
		Id:     id,
		Type:   channelType,
		Key:    "EMPTY",
		Status: common.ChannelStatusEnabled,
		Name:   name,
		Group:  "default",
		Models: "shared-model",
	}
	if channelType == constant.ChannelTypeVLLM || channelType == constant.ChannelTypeSGLang {
		channel.Models = "shared-model,GLM-5.3-Flash,deepseek-r"
	}
	channel.BaseURL = &baseURL
	require.NoError(t, db.Create(channel).Error)
	return channel
}

func TestSyncUpstreamModelContextsCollectsMaxModelLen(t *testing.T) {
	db := setUpstreamContextTestDB(t)
	resetUpstreamContextCache(t)

	server := fakeEngineModelsServer(t, map[string]*int64{
		"GLM-5.3-Flash": int64Ptr(1048576),
	})
	defer server.Close()

	createEngineChannel(t, db, 801, constant.ChannelTypeVLLM, "vllm-context-channel", server.URL)
	require.NoError(t, db.Create(&model.Ability{
		Group: "default", Model: "GLM-5.3-Flash", ChannelId: 801, Enabled: true,
	}).Error)
	model.InitChannelCache()

	SyncUpstreamModelContexts(context.Background())

	length, ok := GetUpstreamModelContextLength("GLM-5.3-Flash")
	require.True(t, ok)
	assert.Equal(t, int64(1048576), length)
}

func TestSyncUpstreamModelContextsSupportsSGLang(t *testing.T) {
	db := setUpstreamContextTestDB(t)
	resetUpstreamContextCache(t)

	server := fakeEngineModelsServer(t, map[string]*int64{
		"deepseek-r": int64Ptr(65536),
	})
	defer server.Close()

	createEngineChannel(t, db, 805, constant.ChannelTypeSGLang, "sglang-channel", server.URL)
	require.NoError(t, db.Create(&model.Ability{
		Group: "default", Model: "deepseek-r", ChannelId: 805, Enabled: true,
	}).Error)
	model.InitChannelCache()

	SyncUpstreamModelContexts(context.Background())

	length, ok := GetUpstreamModelContextLength("deepseek-r")
	require.True(t, ok)
	assert.Equal(t, int64(65536), length)
}

func TestSyncUpstreamModelContextsIgnoresNonEngineChannels(t *testing.T) {
	db := setUpstreamContextTestDB(t)
	resetUpstreamContextCache(t)

	server := fakeEngineModelsServer(t, map[string]*int64{"some-model": int64Ptr(4096)})
	defer server.Close()

	// An OpenAI-compatible channel is NOT probed: only engine channel types
	// report max_model_len, and probing other providers would just attach
	// their credentials to requests that never carry the field.
	createEngineChannel(t, db, 806, constant.ChannelTypeOpenAI, "openai-channel", server.URL)
	require.NoError(t, db.Create(&model.Ability{
		Group: "default", Model: "some-model", ChannelId: 806, Enabled: true,
	}).Error)
	model.InitChannelCache()

	SyncUpstreamModelContexts(context.Background())

	_, ok := GetUpstreamModelContextLength("some-model")
	assert.False(t, ok)
}

func TestSyncUpstreamModelContextsKeepsSmallestAcrossChannels(t *testing.T) {
	db := setUpstreamContextTestDB(t)
	resetUpstreamContextCache(t)

	serverA, smallLimit := fakeMutableEngineModelsServer(t, "shared-model", 131072)
	serverB, largeLimit := fakeMutableEngineModelsServer(t, "shared-model", 1048576)

	createEngineChannel(t, db, 811, constant.ChannelTypeVLLM, "vllm-small", serverA.URL)
	createEngineChannel(t, db, 812, constant.ChannelTypeVLLM, "vllm-large", serverB.URL)
	for _, id := range []int{811, 812} {
		require.NoError(t, db.Create(&model.Ability{
			Group: "default", Model: "shared-model", ChannelId: id, Enabled: true,
		}).Error)
	}
	model.InitChannelCache()

	SyncUpstreamModelContexts(context.Background())

	length, ok := GetUpstreamModelContextLength("shared-model")
	require.True(t, ok)
	assert.Equal(t, int64(131072), length)

	// The smaller channel still routes requests when its metadata probe fails.
	smallLimit.Store(-1)
	largeLimit.Store(2097152)
	SyncUpstreamModelContexts(context.Background())
	length, ok = GetUpstreamModelContextLength("shared-model")
	require.True(t, ok)
	assert.Equal(t, int64(131072), length, "a partial outage must not raise the advertised limit")

	smallLimit.Store(262144)
	SyncUpstreamModelContexts(context.Background())
	length, ok = GetUpstreamModelContextLength("shared-model")
	require.True(t, ok)
	assert.Equal(t, int64(262144), length, "a recovered channel must refresh its snapshot")

	// Removing a channel must discard its snapshot even if every remaining
	// channel's probe fails in this pass.
	largeLimit.Store(-1)
	require.NoError(t, db.Delete(&model.Channel{}, 811).Error)
	model.InitChannelCache()
	SyncUpstreamModelContexts(context.Background())
	length, ok = GetUpstreamModelContextLength("shared-model")
	require.True(t, ok)
	assert.Equal(t, int64(2097152), length)
}

func TestSyncUpstreamModelContextsMapsModelMappingAliases(t *testing.T) {
	db := setUpstreamContextTestDB(t)
	resetUpstreamContextCache(t)

	// Upstream serves GLM-5.3-Flash; users call client-alias, which maps to it.
	server := fakeEngineModelsServer(t, map[string]*int64{
		"GLM-5.3-Flash": int64Ptr(1048576),
	})
	defer server.Close()

	channel := createEngineChannel(t, db, 815, constant.ChannelTypeVLLM, "vllm-mapped-channel", server.URL)
	channel.Models = "client-alias"
	mapping := `{"client-alias":"GLM-5.3-Flash"}`
	channel.ModelMapping = &mapping
	require.NoError(t, db.Model(&model.Channel{Id: 815}).Updates(map[string]any{
		"models":        "client-alias",
		"model_mapping": mapping,
	}).Error)
	require.NoError(t, db.Create(&model.Ability{
		Group: "default", Model: "client-alias", ChannelId: 815, Enabled: true,
	}).Error)
	model.InitChannelCache()

	SyncUpstreamModelContexts(context.Background())

	// The engine name is not user-facing on this channel; only the alias is.
	_, engineVisible := GetUpstreamModelContextLength("GLM-5.3-Flash")
	assert.False(t, engineVisible)
	length, ok := GetUpstreamModelContextLength("client-alias")
	require.True(t, ok)
	assert.Equal(t, int64(1048576), length)
}

func TestProbeRejectsUnsafeBaseURLs(t *testing.T) {
	for _, base := range []string{
		"",
		"file:///etc/passwd",
		"http://user:secret@localhost",
		"http://localhost/?key=secret",
		"https://localhost/#fragment",
		"ftp://localhost",
	} {
		_, err := validateUpstreamContextBaseURL(strings.TrimRight(base, "/"))
		require.Error(t, err, base)
	}
	_, err := validateUpstreamContextBaseURL("http://ok.example:8000")
	require.NoError(t, err)
	_, err = validateUpstreamContextBaseURL("https://ok.example:8000")
	require.NoError(t, err)
}

func TestProbeRequiresHTTPSForCredentials(t *testing.T) {
	for _, channelType := range []int{constant.ChannelTypeVLLM, constant.ChannelTypeSGLang} {
		for _, tc := range []struct {
			name     string
			key      string
			tls      bool
			redirect bool
			wantAuth string
			wantErr  bool
		}{
			{name: "http credential", key: "test-key", wantErr: true},
			{name: "http padded credential", key: " test-key \n", wantErr: true},
			{name: "http empty key"},
			{name: "http whitespace key", key: " \t"},
			{name: "http EMPTY key", key: " EMPTY "},
			{name: "https credential", tls: true, key: " test-key ", wantAuth: "Bearer test-key"},
			{name: "https empty key", tls: true},
			{name: "https EMPTY key", tls: true, key: "EMPTY"},
			{name: "https redirect to http", tls: true, key: "test-key", redirect: true, wantAuth: "Bearer test-key", wantErr: true},
		} {
			t.Run(fmt.Sprintf("%d/%s", channelType, tc.name), func(t *testing.T) {
				var requests, redirected atomic.Int32
				target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					redirected.Add(1)
				}))
				t.Cleanup(target.Close)
				server := httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					requests.Add(1)
					assert.Equal(t, "/v1/models", r.URL.Path)
					assert.Equal(t, tc.wantAuth, r.Header.Get("Authorization"))
					if tc.redirect {
						http.Redirect(w, r, target.URL, http.StatusFound)
						return
					}
					_, _ = w.Write([]byte(`{"data":[{"id":"engine-model","max_model_len":4096}]}`))
				}))
				if tc.tls {
					server.StartTLS()
					client, err := service.GetHttpClientWithProxySettings("", dto.ChannelSettings{})
					require.NoError(t, err)
					originalTransport := client.Transport
					client.Transport = server.Client().Transport
					t.Cleanup(func() { client.Transport = originalTransport })
				} else {
					server.Start()
				}
				t.Cleanup(server.Close)

				collected, err := probeChannelUpstreamContext(context.Background(), upstreamContextProbe{
					channel: &model.Channel{Type: channelType, Key: tc.key},
					baseURL: server.URL,
				})
				if tc.wantErr {
					require.Error(t, err)
					assert.Nil(t, collected)
				} else {
					require.NoError(t, err)
					assert.Equal(t, map[string]int64{"engine-model": 4096}, collected)
				}
				if tc.wantErr && !tc.tls {
					assert.Zero(t, requests.Load(), "credential-bearing HTTP probes must not send a request")
				} else {
					assert.Equal(t, int32(1), requests.Load())
				}
				assert.Zero(t, redirected.Load(), "redirects must not forward credentials")
			})
		}
	}
}

func TestProbeRejectsOversizedResponses(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		// One entry with a huge id pushes the body past the 4 MiB cap.
		_, _ = w.Write([]byte(`{"data":[{"id":"` + strings.Repeat("x", upstreamContextMaxResponseBytes) + `","max_model_len":1}]}`))
	}))
	defer server.Close()

	base := server.URL
	channel := &model.Channel{
		Type: constant.ChannelTypeVLLM, Key: "EMPTY",
		Status: common.ChannelStatusEnabled, Name: "vllm-huge",
		BaseURL: &base,
	}
	probe := upstreamContextProbe{channel: channel, baseURL: server.URL}

	collected, err := probeChannelUpstreamContext(context.Background(), probe)
	require.Error(t, err)
	assert.Equal(t, "response_too_large", err.Error())
	assert.Nil(t, collected)
}

func TestProbeHonoursContextCancellation(t *testing.T) {
	release := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		<-release
	}))
	defer server.Close()
	defer close(release)

	base := server.URL
	channel := &model.Channel{
		Type: constant.ChannelTypeVLLM, Key: "EMPTY",
		Status: common.ChannelStatusEnabled, Name: "vllm-slow",
		BaseURL: &base,
	}
	probe := upstreamContextProbe{channel: channel, baseURL: server.URL}

	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err := probeChannelUpstreamContext(ctx, probe)
	require.Error(t, err)
	assert.True(t, errors.Is(err, context.Canceled))
}

func TestListModelsSurfacesUpstreamMaxModelLen(t *testing.T) {
	db := setUpstreamContextTestDB(t)
	resetUpstreamContextCache(t)

	createEngineChannel(t, db, 831, constant.ChannelTypeVLLM, "vllm-list-channel", "http://127.0.0.1:1")
	require.NoError(t, db.Create(&model.Ability{
		Group: "default", Model: "zz-context-model", ChannelId: 831, Enabled: true,
	}).Error)
	require.NoError(t, db.Create(&model.User{
		Id: 1101, Username: "context-model-user", Password: "password",
		Group: "default", Status: common.UserStatusEnabled,
	}).Error)
	model.InitChannelCache()

	// Pretend the scheduled sync already recorded the engine's advertised limit.
	seedUpstreamContextsForTest(map[string]int64{"zz-context-model": 1048576})

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/v1/models", nil)
	ctx.Set("id", 1101)

	ListModels(ctx, constant.ChannelTypeOpenAI)

	var payload struct {
		Success bool               `json:"success"`
		Data    []dto.OpenAIModels `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.Len(t, payload.Data, 1)
	assert.Equal(t, "zz-context-model", payload.Data[0].Id)
	assert.Equal(t, int64(1048576), payload.Data[0].MaxModelLen)
}

func TestListModelsOmitsMaxModelLenWhenUnknown(t *testing.T) {
	db := setUpstreamContextTestDB(t)
	resetUpstreamContextCache(t)

	require.NoError(t, db.Create(&model.User{
		Id: 1102, Username: "plain-model-user", Password: "password",
		Group: "default", Status: common.UserStatusEnabled,
	}).Error)
	require.NoError(t, db.Create(&[]model.Ability{
		{Group: "default", Model: "zz-plain-model", ChannelId: 1, Enabled: true},
	}).Error)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/v1/models", nil)
	ctx.Set("id", 1102)

	ListModels(ctx, constant.ChannelTypeOpenAI)

	var payload struct {
		Success bool               `json:"success"`
		Data    []dto.OpenAIModels `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.Len(t, payload.Data, 1)
	assert.Zero(t, payload.Data[0].MaxModelLen)
	// omitempty keeps the wire shape identical for models without data.
	require.NotContains(t, recorder.Body.String(), "max_model_len")
}

func TestProbeChannelUpstreamContextToleratesFailures(t *testing.T) {
	db := setUpstreamContextTestDB(t)
	resetUpstreamContextCache(t)

	createEngineChannel(t, db, 821, constant.ChannelTypeVLLM, "vllm-dead", "http://127.0.0.1:1")
	require.NoError(t, db.Create(&model.Ability{
		Group: "default", Model: "shared-model", ChannelId: 821, Enabled: true,
	}).Error)
	model.InitChannelCache()

	// Must not panic and must leave an empty cache.
	require.NotPanics(t, func() { SyncUpstreamModelContexts(context.Background()) })
	_, ok := GetUpstreamModelContextLength("shared-model")
	assert.False(t, ok)
}

func TestUpstreamContextSyncScheduleFromEnv(t *testing.T) {
	t.Setenv("UPSTREAM_CONTEXT_SYNC_FREQUENCY", "0")
	handler := upstreamContextSystemTaskHandler{}
	assert.False(t, handler.Enabled(), "frequency=0 must disable the sync task")

	t.Setenv("UPSTREAM_CONTEXT_SYNC_FREQUENCY", "600")
	assert.True(t, handler.Enabled())
	assert.Equal(t, 600*time.Second, handler.Interval())

	t.Setenv("UPSTREAM_CONTEXT_SYNC_FREQUENCY", "1") // below the 5s floor
	assert.Equal(t, 5*time.Second, handler.Interval())

	// Unset: the sync defaults to on, once a minute.
	t.Setenv("UPSTREAM_CONTEXT_SYNC_FREQUENCY", "")
	assert.True(t, handler.Enabled())
	assert.Equal(t, 60*time.Second, handler.Interval())
}

func TestSyncKeepsLastKnownGoodWhenAllUpstreamsFail(t *testing.T) {
	db := setUpstreamContextTestDB(t)
	resetUpstreamContextCache(t)

	server, limit := fakeMutableEngineModelsServer(t, "shared-model", 4096)
	createEngineChannel(t, db, 841, constant.ChannelTypeVLLM, "vllm-outage", server.URL)
	require.NoError(t, db.Create(&model.Ability{
		Group: "default", Model: "shared-model", ChannelId: 841, Enabled: true,
	}).Error)
	model.InitChannelCache()

	SyncUpstreamModelContexts(context.Background())
	length, ok := GetUpstreamModelContextLength("shared-model")
	require.True(t, ok)
	require.Equal(t, int64(4096), length)

	limit.Store(-1)
	SyncUpstreamModelContexts(context.Background())

	length, ok = GetUpstreamModelContextLength("shared-model")
	require.True(t, ok, "total outage must keep the last-known-good cache")
	assert.Equal(t, int64(4096), length)

	// A failed ability query must not be mistaken for removed channels.
	sqlDB, err := db.DB()
	require.NoError(t, err)
	require.NoError(t, sqlDB.Close())
	SyncUpstreamModelContexts(context.Background())
	length, ok = GetUpstreamModelContextLength("shared-model")
	require.True(t, ok)
	assert.Equal(t, int64(4096), length)
}

func TestSyncDropsStaleCacheWhenEngineStopsAdvertising(t *testing.T) {
	db := setUpstreamContextTestDB(t)
	resetUpstreamContextCache(t)
	server, limit := fakeMutableEngineModelsServer(t, "shared-model", 4096)

	createEngineChannel(t, db, 842, constant.ChannelTypeVLLM, "vllm-no-field", server.URL)
	require.NoError(t, db.Create(&model.Ability{
		Group: "default", Model: "shared-model", ChannelId: 842, Enabled: true,
	}).Error)
	model.InitChannelCache()

	SyncUpstreamModelContexts(context.Background())
	length, ok := GetUpstreamModelContextLength("shared-model")
	require.True(t, ok)
	require.Equal(t, int64(4096), length)

	limit.Store(0)
	SyncUpstreamModelContexts(context.Background())
	_, ok = GetUpstreamModelContextLength("shared-model")
	assert.False(t, ok, "a healthy engine that stopped advertising must clear the stale cache")

	limit.Store(-1)
	SyncUpstreamModelContexts(context.Background())
	_, ok = GetUpstreamModelContextLength("shared-model")
	assert.False(t, ok, "a later failure must not restore the cleared snapshot")
}

func TestSyncDropsStaleCacheWhenChannelBecomesIneligible(t *testing.T) {
	for _, reason := range []string{"deleted channel", "deleted ability", "disabled channel", "disabled ability", "non-engine channel", "invalid URL"} {
		t.Run(reason, func(t *testing.T) {
			db := setUpstreamContextTestDB(t)
			resetUpstreamContextCache(t)
			server, limit := fakeMutableEngineModelsServer(t, "shared-model", 4096)
			channel := createEngineChannel(t, db, 843, constant.ChannelTypeVLLM, "vllm-removed", server.URL)
			ability := &model.Ability{Group: "default", Model: "shared-model", ChannelId: channel.Id, Enabled: true}
			require.NoError(t, db.Create(ability).Error)
			model.InitChannelCache()
			SyncUpstreamModelContexts(context.Background())
			length, ok := GetUpstreamModelContextLength("shared-model")
			require.True(t, ok)
			require.Equal(t, int64(4096), length)

			switch reason {
			case "deleted channel":
				require.NoError(t, db.Delete(&model.Channel{}, channel.Id).Error)
			case "deleted ability":
				require.NoError(t, db.Delete(ability).Error)
			case "disabled channel":
				require.NoError(t, db.Model(&model.Channel{Id: channel.Id}).Update("status", common.ChannelStatusManuallyDisabled).Error)
			case "disabled ability":
				require.NoError(t, db.Model(ability).Update("enabled", false).Error)
			case "non-engine channel":
				require.NoError(t, db.Model(&model.Channel{Id: channel.Id}).Update("type", constant.ChannelTypeOpenAI).Error)
			case "invalid URL":
				require.NoError(t, db.Model(&model.Channel{Id: channel.Id}).Update("base_url", "file:///engine").Error)
			}
			model.InitChannelCache()
			SyncUpstreamModelContexts(context.Background())
			_, ok = GetUpstreamModelContextLength("shared-model")
			assert.False(t, ok)

			// Restoring eligibility during an outage must not resurrect a snapshot
			// that was removed while this channel was out of the routing pool.
			limit.Store(-1)
			ability.Enabled = true
			require.NoError(t, db.Save(channel).Error)
			require.NoError(t, db.Save(ability).Error)
			model.InitChannelCache()
			SyncUpstreamModelContexts(context.Background())
			_, ok = GetUpstreamModelContextLength("shared-model")
			assert.False(t, ok)
		})
	}
}

func TestSyncUpstreamModelContextsRemapsFailedChannelSnapshot(t *testing.T) {
	db := setUpstreamContextTestDB(t)
	resetUpstreamContextCache(t)
	server, limit := fakeMutableEngineModelsServer(t, "shared-model", 4096)
	channel := createEngineChannel(t, db, 844, constant.ChannelTypeVLLM, "vllm-remapped", server.URL)
	ability := &model.Ability{Group: "default", Model: "shared-model", ChannelId: channel.Id, Enabled: true}
	require.NoError(t, db.Create(ability).Error)
	model.InitChannelCache()
	SyncUpstreamModelContexts(context.Background())

	limit.Store(-1)
	require.NoError(t, db.Model(channel).Updates(map[string]any{
		"models": "new-alias", "model_mapping": `{"new-alias":"shared-model"}`,
	}).Error)
	require.NoError(t, db.Model(ability).Update("model", "new-alias").Error)
	model.InitChannelCache()
	SyncUpstreamModelContexts(context.Background())
	length, ok := GetUpstreamModelContextLength("new-alias")
	require.True(t, ok)
	assert.Equal(t, int64(4096), length)
	_, ok = GetUpstreamModelContextLength("shared-model")
	assert.False(t, ok, "snapshots must be aggregated using the current routing names")
}

func TestProbeHonoursMidFlightCancellation(t *testing.T) {
	release := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		<-release
	}))
	defer server.Close()
	defer close(release)

	base := server.URL
	channel := &model.Channel{
		Type: constant.ChannelTypeVLLM, Key: "EMPTY",
		Status: common.ChannelStatusEnabled, Name: "vllm-cancel-mid",
		BaseURL: &base,
	}
	probe := upstreamContextProbe{channel: channel, baseURL: server.URL}

	ctx, cancel := context.WithCancel(context.Background())
	go func() {
		time.Sleep(50 * time.Millisecond)
		cancel()
	}()
	_, err := probeChannelUpstreamContext(ctx, probe)
	require.Error(t, err, "cancelling mid-flight must abort the probe")
	assert.True(t, errors.Is(err, context.Canceled))
}

func TestEngineModelToUserNames(t *testing.T) {
	direct := &model.Channel{Models: "shared-model,GLM-5.3-Flash"}
	assert.ElementsMatch(t, []string{"GLM-5.3-Flash"}, engineModelToUserNames(direct, "GLM-5.3-Flash"))
	assert.Empty(t, engineModelToUserNames(direct, "absent-engine-model"))

	mapping := `{"client-alias":"GLM-5.3-Flash"}`
	mapped := &model.Channel{Models: "client-alias", ModelMapping: &mapping}
	assert.ElementsMatch(t, []string{"client-alias"}, engineModelToUserNames(mapped, "GLM-5.3-Flash"))
	// The served name is the mapping SOURCE: it routes to the engine name,
	// so a probe for the alias itself still resolves (harmless: engines do
	// not serve mapping sources, so this never enters the cache in practice).
	assert.ElementsMatch(t, []string{"client-alias"}, engineModelToUserNames(mapped, "client-alias"))

	// Chained mapping: alias -> intermediate -> engine.
	chained := `{"alias":"intermediate","intermediate":"GLM-5.3-Flash"}`
	chainedChannel := &model.Channel{Models: "alias", ModelMapping: &chained}
	assert.ElementsMatch(t, []string{"alias"}, engineModelToUserNames(chainedChannel, "GLM-5.3-Flash"))

	// Cyclic mapping must not hang; the cycle never reaches the engine.
	cyclic := `{"a":"b","b":"a"}`
	cyclicChannel := &model.Channel{Models: "a", ModelMapping: &cyclic}
	assert.Empty(t, engineModelToUserNames(cyclicChannel, "GLM-5.3-Flash"))

	// Exactly 8 hops still resolves; a 9-hop chain is abandoned (bounded walk).
	links := make([]string, 0, 10)
	for i := 0; i < 10; i++ {
		next := fmt.Sprintf("hop-%d", i+1)
		links = append(links, fmt.Sprintf(`"hop-%d":%q`, i, next))
	}
	links = append(links, `"hop-10":"GLM-5.3-Flash"`)
	longMapping := `{` + strings.Join(links, ",") + `}`
	longChannel := &model.Channel{Models: "hop-0", ModelMapping: &longMapping}
	assert.Empty(t, engineModelToUserNames(longChannel, "GLM-5.3-Flash"),
		"a mapping chain longer than 8 hops must be abandoned, not followed")

	// Unparseable mapping degrades to direct-name matching only.
	broken := `not-json`
	brokenChannel := &model.Channel{Models: "GLM-5.3-Flash", ModelMapping: &broken}
	assert.ElementsMatch(t, []string{"GLM-5.3-Flash"}, engineModelToUserNames(brokenChannel, "GLM-5.3-Flash"))
}
