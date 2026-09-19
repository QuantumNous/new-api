package controller

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"
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
		_ = json.NewEncoder(w).Encode(map[string]any{
			"object": "list",
			"data":   entries,
		})
	}))
}

func int64Ptr(v int64) *int64 { return &v }

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
		Key:    "test-key",
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

	serverA := fakeEngineModelsServer(t, map[string]*int64{"shared-model": int64Ptr(131072)})
	defer serverA.Close()
	serverB := fakeEngineModelsServer(t, map[string]*int64{"shared-model": int64Ptr(1048576)})
	defer serverB.Close()

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
		"ftp://localhost",
	} {
		_, err := validateUpstreamContextBaseURL(strings.TrimRight(base, "/"))
		require.Error(t, err, base)
	}
	_, err := validateUpstreamContextBaseURL("http://ok.example:8000")
	require.NoError(t, err)
}

func TestProbeRejectsOversizedResponses(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		// One entry with a huge id pushes the body past the 4 MiB cap.
		_, _ = w.Write([]byte(`{"data":[{"id":"` + strings.Repeat("x", upstreamContextMaxResponseBytes) + `","max_model_len":1}]}`))
	}))
	defer server.Close()

	base := server.URL
	channel := &model.Channel{
		Type: constant.ChannelTypeVLLM, Key: "k",
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
		Type: constant.ChannelTypeVLLM, Key: "k",
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
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &payload))
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
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &payload))
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
		Group: "default", Model: "some-model", ChannelId: 821, Enabled: true,
	}).Error)
	model.InitChannelCache()

	// Must not panic and must leave an empty cache.
	require.NotPanics(t, func() { SyncUpstreamModelContexts(context.Background()) })
	_, ok := GetUpstreamModelContextLength("some-model")
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
	seedUpstreamContextsForTest(map[string]int64{"stale-model": 4096})
	t.Cleanup(func() { seedUpstreamContextsForTest(map[string]int64{}) })

	// One dead engine channel.
	createEngineChannel(t, db, 841, constant.ChannelTypeVLLM, "vllm-dead-outage", "http://127.0.0.1:1")
	require.NoError(t, db.Create(&model.Ability{
		Group: "default", Model: "stale-model", ChannelId: 841, Enabled: true,
	}).Error)
	model.InitChannelCache()

	SyncUpstreamModelContexts(context.Background())

	length, ok := GetUpstreamModelContextLength("stale-model")
	require.True(t, ok, "total outage must keep the last-known-good cache")
	assert.Equal(t, int64(4096), length)
}

func TestSyncDropsStaleCacheWhenEngineStopsAdvertising(t *testing.T) {
	db := setUpstreamContextTestDB(t)
	seedUpstreamContextsForTest(map[string]int64{"gone-limit-model": 4096})
	t.Cleanup(func() { seedUpstreamContextsForTest(map[string]int64{}) })

	// Engine answers fine but no longer includes max_model_len: the sync
	// must treat it as healthy and withdraw the stale advertised limit.
	server := fakeEngineModelsServer(t, map[string]*int64{"gone-limit-model": nil})
	defer server.Close()

	createEngineChannel(t, db, 842, constant.ChannelTypeVLLM, "vllm-no-field", server.URL)
	require.NoError(t, db.Create(&model.Ability{
		Group: "default", Model: "gone-limit-model", ChannelId: 842, Enabled: true,
	}).Error)
	model.InitChannelCache()

	SyncUpstreamModelContexts(context.Background())

	_, ok := GetUpstreamModelContextLength("gone-limit-model")
	assert.False(t, ok, "a healthy engine that stopped advertising must clear the stale cache")
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
		Type: constant.ChannelTypeVLLM, Key: "k",
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
