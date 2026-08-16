package controller

import (
	"bytes"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newAdvancedCustomModelListChannel(baseURL string, key string, upstreamPath string, auth *dto.AdvancedCustomRouteAuth) *model.Channel {
	config := &dto.AdvancedCustomConfig{
		Routes: []dto.AdvancedCustomRoute{
			{
				IncomingPath: dto.AdvancedCustomModelListPath,
				UpstreamPath: upstreamPath,
				Converter:    "none",
				Auth:         auth,
			},
		},
	}
	channel := &model.Channel{
		Type:    constant.ChannelTypeAdvancedCustom,
		Key:     key,
		BaseURL: &baseURL,
	}
	channel.SetOtherSettings(dto.ChannelOtherSettings{AdvancedCustom: config})
	return channel
}

func TestParseOpenAIModelIDsStrictResponseContract(t *testing.T) {
	tests := []struct {
		name      string
		body      string
		want      []string
		wantError string
	}{
		{name: "malformed JSON", body: `{"data":`, wantError: "invalid OpenAI Models response"},
		{name: "missing data", body: `{"object":"list"}`, wantError: "data is required"},
		{name: "null data", body: `{"data":null}`, wantError: "data is required"},
		{name: "empty data", body: `{"data":[]}`, wantError: "no valid model IDs"},
		{name: "all IDs empty", body: `{"data":[{"id":""},{"id":"   "}]}`, wantError: "no valid model IDs"},
		{
			name: "filters empty IDs and normalizes valid IDs",
			body: `{"data":[{"id":" gpt-4.1 "},{"id":""},{"id":"gpt-4.1"},{"id":"o3"}]}`,
			want: []string{"gpt-4.1", "o3"},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			models, err := parseOpenAIModelIDs([]byte(test.body))
			if test.wantError != "" {
				require.ErrorContains(t, err, test.wantError)
				require.Nil(t, models)
				return
			}
			require.NoError(t, err)
			require.Equal(t, test.want, models)
		})
	}
}

func TestFetchAdvancedCustomModelsAppliesHeaderOverrideAfterRouteAuth(t *testing.T) {
	type receivedRequest struct {
		Headers http.Header
		Host    string
	}
	received := make(chan receivedRequest, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		received <- receivedRequest{Headers: r.Header.Clone(), Host: r.Host}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"data":[{"id":"gpt-4.1"}]}`))
	}))
	defer server.Close()

	channel := newAdvancedCustomModelListChannel(server.URL, "secret-key", "/provider/models", &dto.AdvancedCustomRouteAuth{
		Type:  dto.AdvancedCustomAuthTypeHeader,
		Name:  "X-Route-Key",
		Value: "route-{api_key}",
	})
	headerOverride := `{
		"X-Route-Key":"global-{api_key}",
		"X-Static":"static-value",
		"X-Client":"{client_header:X-Client}",
		"Host":"models.example.test",
		"*":""
	}`
	channel.HeaderOverride = &headerOverride

	models, err := fetchChannelUpstreamModelIDs(channel)
	require.NoError(t, err)
	require.Equal(t, []string{"gpt-4.1"}, models)

	request := <-received
	require.Equal(t, "global-secret-key", request.Headers.Get("X-Route-Key"))
	require.Equal(t, "static-value", request.Headers.Get("X-Static"))
	require.Empty(t, request.Headers.Get("X-Client"))
	require.Equal(t, "models.example.test", request.Host)
}

func TestFetchAdvancedCustomModelsUsesEnabledSavedMultiKey(t *testing.T) {
	authorization := make(chan string, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authorization <- r.Header.Get("Authorization")
		_, _ = w.Write([]byte(`{"data":[{"id":"gpt-4.1-mini"}]}`))
	}))
	defer server.Close()

	channel := newAdvancedCustomModelListChannel(server.URL, "disabled-key\nenabled-key", "/v1/models", nil)
	channel.ChannelInfo = model.ChannelInfo{
		IsMultiKey: true,
		MultiKeyStatusList: map[int]int{
			0: common.ChannelStatusManuallyDisabled,
			1: common.ChannelStatusEnabled,
		},
	}

	models, err := fetchChannelUpstreamModelIDs(channel)
	require.NoError(t, err)
	require.Equal(t, []string{"gpt-4.1-mini"}, models)
	require.Equal(t, "Bearer enabled-key", <-authorization)
}

func TestFetchAdvancedCustomModelsRejectsNonOKResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusBadGateway)
		_, _ = w.Write([]byte(`{"data":[{"id":"must-not-be-used"}]}`))
	}))
	defer server.Close()

	channel := newAdvancedCustomModelListChannel(server.URL, "secret-key", "/v1/models", nil)
	models, err := fetchChannelUpstreamModelIDs(channel)
	require.ErrorContains(t, err, "status code: 502")
	require.Nil(t, models)
}

func TestFetchAdvancedCustomModelsRedactsQueryKeyFromTransportErrors(t *testing.T) {
	const secret = "secret key/+"
	server := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {}))
	baseURL := server.URL
	server.Close()

	channel := newAdvancedCustomModelListChannel(baseURL, secret, "/v1/models", &dto.AdvancedCustomRouteAuth{
		Type:  dto.AdvancedCustomAuthTypeQuery,
		Name:  "custom-token",
		Value: "prefix-{api_key}",
	})

	_, err := fetchChannelUpstreamModelIDs(channel)
	require.Error(t, err)
	require.NotContains(t, err.Error(), secret)
	require.NotContains(t, err.Error(), "custom-token")
	require.NotContains(t, err.Error(), "prefix-")

	direct := sanitizeFetchModelsError(&url.Error{
		Op:  http.MethodGet,
		URL: baseURL + "/v1/models?custom-token=prefix-" + url.QueryEscape(secret),
		Err: errors.New("connection refused"),
	}, secret)
	require.EqualError(t, direct, "connection refused")
}

func TestFetchOrdinaryOpenAIModelsKeepsExistingEmptyDataBehavior(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"object":"list"}`))
	}))
	defer server.Close()

	baseURL := server.URL
	channel := &model.Channel{
		Type:    constant.ChannelTypeOpenAI,
		Key:     "ordinary-key",
		BaseURL: &baseURL,
	}
	models, err := fetchChannelUpstreamModelIDs(channel)
	require.NoError(t, err)
	require.Empty(t, models)
}

func TestFetchModelsAdvancedCustomCreatePreview(t *testing.T) {
	receivedAuthorization := make(chan string, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedAuthorization <- r.Header.Get("Authorization")
		_, _ = w.Write([]byte(`{"data":[{"id":"preview-model"}]}`))
	}))
	defer server.Close()

	config := dto.AdvancedCustomConfig{Routes: []dto.AdvancedCustomRoute{{
		IncomingPath: dto.AdvancedCustomModelListPath,
		UpstreamPath: "/preview/models",
		Converter:    "none",
	}}}
	configBytes, err := common.Marshal(config)
	require.NoError(t, err)
	rawConfig := string(configBytes)
	baseURL := server.URL
	emptyProxy := ""
	req := fetchModelsRequest{
		BaseURL:        &baseURL,
		Type:           constant.ChannelTypeAdvancedCustom,
		Key:            "create-preview-key",
		AdvancedCustom: &rawConfig,
		Proxy:          &emptyProxy,
	}
	body, err := common.Marshal(req)
	require.NoError(t, err)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/channel/fetch_models", bytes.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")
	FetchModels(ctx)

	var response struct {
		Success bool     `json:"success"`
		Message string   `json:"message"`
		Data    []string `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response.Success, response.Message)
	require.Equal(t, []string{"preview-model"}, response.Data)
	require.Equal(t, "Bearer create-preview-key", <-receivedAuthorization)
}

func TestFetchModelsAdvancedCustomEditPreviewUsesSavedKeyAndExplicitClears(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	receivedHeaders := make(chan http.Header, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedHeaders <- r.Header.Clone()
		_, _ = w.Write([]byte(`{"data":[{"id":"edited-preview-model"}]}`))
	}))
	defer server.Close()

	savedChannel := newAdvancedCustomModelListChannel("http://127.0.0.1:1", "disabled-saved-key\nenabled-saved-key", "/saved/models", nil)
	savedChannel.Name = "saved advanced channel"
	savedChannel.Models = "old-model"
	savedChannel.ChannelInfo = model.ChannelInfo{
		IsMultiKey: true,
		MultiKeyStatusList: map[int]int{
			0: common.ChannelStatusManuallyDisabled,
			1: common.ChannelStatusEnabled,
		},
	}
	savedHeaderOverride := `{"X-Saved":"must-not-be-sent"}`
	savedChannel.HeaderOverride = &savedHeaderOverride
	savedChannel.SetSetting(dto.ChannelSettings{Proxy: "http://127.0.0.1:1"})
	require.NoError(t, db.Create(savedChannel).Error)

	preserved, err := buildAdvancedCustomModelPreviewChannel(fetchModelsRequest{ChannelID: savedChannel.Id})
	require.NoError(t, err)
	require.Equal(t, "http://127.0.0.1:1", preserved.GetBaseURL())
	require.Equal(t, savedHeaderOverride, *preserved.HeaderOverride)
	require.Equal(t, "http://127.0.0.1:1", preserved.GetSetting().Proxy)

	previewConfig := dto.AdvancedCustomConfig{Routes: []dto.AdvancedCustomRoute{{
		IncomingPath: dto.AdvancedCustomModelListPath,
		UpstreamPath: "/edited/models",
		Converter:    "none",
	}}}
	configBytes, err := common.Marshal(previewConfig)
	require.NoError(t, err)
	rawConfig := string(configBytes)
	baseURL := server.URL
	explicitEmpty := ""
	req := fetchModelsRequest{
		ChannelID:      savedChannel.Id,
		BaseURL:        &baseURL,
		Type:           constant.ChannelTypeAdvancedCustom,
		Key:            "request-key-must-be-ignored",
		AdvancedCustom: &rawConfig,
		HeaderOverride: &explicitEmpty,
		Proxy:          &explicitEmpty,
	}
	cleared, err := buildAdvancedCustomModelPreviewChannel(fetchModelsRequest{
		ChannelID:      savedChannel.Id,
		BaseURL:        &explicitEmpty,
		AdvancedCustom: &rawConfig,
		HeaderOverride: &explicitEmpty,
		Proxy:          &explicitEmpty,
	})
	require.NoError(t, err)
	require.NotNil(t, cleared.BaseURL)
	require.Empty(t, *cleared.BaseURL)
	require.NotNil(t, cleared.HeaderOverride)
	require.Empty(t, *cleared.HeaderOverride)
	require.Empty(t, cleared.GetSetting().Proxy)

	body, err := common.Marshal(req)
	require.NoError(t, err)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/channel/fetch_models", bytes.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")
	FetchModels(ctx)

	var response struct {
		Success bool     `json:"success"`
		Message string   `json:"message"`
		Data    []string `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response.Success, response.Message)
	require.Equal(t, []string{"edited-preview-model"}, response.Data)
	require.NotContains(t, recorder.Body.String(), "enabled-saved-key")
	require.NotContains(t, recorder.Body.String(), "request-key-must-be-ignored")

	headers := <-receivedHeaders
	require.Equal(t, "Bearer enabled-saved-key", headers.Get("Authorization"))
	require.Empty(t, headers.Get("X-Saved"))
}

func TestFailedAdvancedCustomDetectionDoesNotStageFullRemoval(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"data":[]}`))
	}))
	defer server.Close()

	channel := newAdvancedCustomModelListChannel(server.URL, "secret-key", "/v1/models", nil)
	channel.Name = "empty discovery response"
	channel.Models = "gpt-4.1,o3"
	settings := channel.GetOtherSettings()
	settings.UpstreamModelUpdateCheckEnabled = true
	settings.UpstreamModelUpdateAutoSyncEnabled = true
	channel.SetOtherSettings(settings)
	require.NoError(t, db.Create(channel).Error)

	modelsChanged, autoAdded, err := checkAndPersistChannelUpstreamModelUpdates(channel, &settings, true, true)
	require.ErrorContains(t, err, "no valid model IDs")
	require.False(t, modelsChanged)
	require.Zero(t, autoAdded)
	require.Empty(t, settings.UpstreamModelUpdateLastDetectedModels)
	require.Empty(t, settings.UpstreamModelUpdateLastRemovedModels)

	reloaded, err := model.GetChannelById(channel.Id, true)
	require.NoError(t, err)
	persistedSettings := reloaded.GetOtherSettings()
	require.Empty(t, persistedSettings.UpstreamModelUpdateLastDetectedModels)
	require.Empty(t, persistedSettings.UpstreamModelUpdateLastRemovedModels)
	require.Equal(t, "gpt-4.1,o3", reloaded.Models)
}

func TestUpdateChannelUpstreamModelSettingsUsesPersistedChannelStateForAbilities(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	priority := int64(3)
	weight := uint(7)
	persisted := &model.Channel{
		Name:     "disabled upstream sync channel",
		Type:     constant.ChannelTypeOpenAI,
		Key:      "secret-key",
		Status:   common.ChannelStatusManuallyDisabled,
		Models:   "old-model",
		Group:    "default",
		Priority: &priority,
		Weight:   &weight,
	}
	require.NoError(t, db.Create(persisted).Error)
	require.NoError(t, persisted.UpdateAbilities(nil))

	stale := *persisted
	stale.Status = common.ChannelStatusEnabled

	require.NoError(t, updateChannelUpstreamModelSettings(&stale, func(current *model.Channel, settings *dto.ChannelOtherSettings) error {
		current.Models = "new-model"
		settings.UpstreamModelUpdateLastCheckTime = 123
		return nil
	}))

	var abilities []model.Ability
	require.NoError(t, db.Where("channel_id = ?", persisted.Id).Find(&abilities).Error)
	require.Len(t, abilities, 1)
	assert.Equal(t, "new-model", abilities[0].Model)
	assert.False(t, abilities[0].Enabled)

	reloaded, err := model.GetChannelById(persisted.Id, true)
	require.NoError(t, err)
	assert.Equal(t, common.ChannelStatusManuallyDisabled, reloaded.Status)
}

func TestApplyChannelUpstreamModelUpdatesPreservesConcurrentChannelEdits(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	priority := int64(3)
	weight := uint(7)
	persisted := &model.Channel{
		Name:     "concurrently edited upstream channel",
		Type:     constant.ChannelTypeOpenAI,
		Key:      "secret-key",
		Status:   common.ChannelStatusEnabled,
		Models:   "old-model,remove-model",
		Group:    "default",
		Priority: &priority,
		Weight:   &weight,
	}
	persisted.SetOtherSettings(dto.ChannelOtherSettings{
		UpstreamModelUpdateLastDetectedModels: []string{"new-model", "ignored-model"},
		UpstreamModelUpdateLastRemovedModels:  []string{"remove-model"},
		UpstreamModelUpdateIgnoredModels:      []string{"existing-ignore"},
	})
	require.NoError(t, db.Create(persisted).Error)
	require.NoError(t, persisted.UpdateAbilities(nil))

	stale := *persisted
	latestSettings := persisted.GetOtherSettings()
	latestSettings.AllowServiceTier = true
	persisted.SetOtherSettings(latestSettings)
	require.NoError(t, db.Model(&model.Channel{}).Where("id = ?", persisted.Id).Updates(map[string]interface{}{
		"models":   "old-model,manual-model,remove-model",
		"settings": persisted.OtherSettings,
	}).Error)

	added, removed, ignored, remaining, remainingRemoved, changed, err := applyChannelUpstreamModelUpdates(
		&stale,
		[]string{"new-model"},
		[]string{"ignored-model"},
		[]string{"remove-model"},
	)
	require.NoError(t, err)
	assert.True(t, changed)
	assert.Equal(t, []string{"new-model"}, added)
	assert.Equal(t, []string{"remove-model"}, removed)
	assert.Equal(t, []string{"ignored-model"}, ignored)
	assert.Empty(t, remaining)
	assert.Empty(t, remainingRemoved)
	assert.Equal(t, "old-model,manual-model,new-model", stale.Models)

	reloaded, err := model.GetChannelById(persisted.Id, true)
	require.NoError(t, err)
	assert.Equal(t, "old-model,manual-model,new-model", reloaded.Models)
	reloadedSettings := reloaded.GetOtherSettings()
	assert.True(t, reloadedSettings.AllowServiceTier)
	assert.Equal(t, []string{"existing-ignore", "ignored-model"}, reloadedSettings.UpstreamModelUpdateIgnoredModels)
	assert.Empty(t, reloadedSettings.UpstreamModelUpdateLastDetectedModels)
	assert.Empty(t, reloadedSettings.UpstreamModelUpdateLastRemovedModels)

	var abilities []model.Ability
	require.NoError(t, db.Where("channel_id = ?", persisted.Id).Order("model ASC").Find(&abilities).Error)
	require.Len(t, abilities, 3)
	assert.Equal(t, []string{"manual-model", "new-model", "old-model"}, []string{
		abilities[0].Model,
		abilities[1].Model,
		abilities[2].Model,
	})
}

func TestCheckAndPersistChannelUpstreamModelUpdatesPreservesConcurrentChannelEdits(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"data":[{"id":"old-model"},{"id":"manual-model"},{"id":"new-model"}]}`))
	}))
	t.Cleanup(server.Close)

	channel := newAdvancedCustomModelListChannel(server.URL, "secret-key", "/v1/models", nil)
	channel.Name = "concurrently edited detection channel"
	channel.Status = common.ChannelStatusEnabled
	channel.Models = "old-model"
	channel.Group = "default"
	settings := channel.GetOtherSettings()
	settings.UpstreamModelUpdateCheckEnabled = true
	settings.UpstreamModelUpdateAutoSyncEnabled = true
	channel.SetOtherSettings(settings)
	require.NoError(t, db.Create(channel).Error)
	require.NoError(t, channel.UpdateAbilities(nil))

	stale := *channel
	staleSettings := stale.GetOtherSettings()
	latestSettings := channel.GetOtherSettings()
	latestSettings.AllowServiceTier = true
	latestSettings.UpstreamModelUpdateIgnoredModels = []string{"preserved-ignore"}
	channel.SetOtherSettings(latestSettings)
	require.NoError(t, db.Model(&model.Channel{}).Where("id = ?", channel.Id).Updates(map[string]interface{}{
		"models":   "old-model,manual-model",
		"settings": channel.OtherSettings,
	}).Error)

	modelsChanged, autoAdded, err := checkAndPersistChannelUpstreamModelUpdates(&stale, &staleSettings, true, true)
	require.NoError(t, err)
	assert.True(t, modelsChanged)
	assert.Equal(t, 1, autoAdded)
	assert.Equal(t, "old-model,manual-model,new-model", stale.Models)
	assert.True(t, staleSettings.AllowServiceTier)
	assert.Equal(t, []string{"preserved-ignore"}, staleSettings.UpstreamModelUpdateIgnoredModels)

	reloaded, err := model.GetChannelById(channel.Id, true)
	require.NoError(t, err)
	assert.Equal(t, "old-model,manual-model,new-model", reloaded.Models)
	assert.True(t, reloaded.GetOtherSettings().AllowServiceTier)
}

func TestCheckAndPersistChannelUpstreamModelUpdatesSkipsStaleFetchConfig(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	requestStarted := make(chan struct{})
	releaseResponse := make(chan struct{})
	var releaseOnce sync.Once
	t.Cleanup(func() { releaseOnce.Do(func() { close(releaseResponse) }) })
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		close(requestStarted)
		<-releaseResponse
		_, _ = w.Write([]byte(`{"data":[{"id":"old-model"},{"id":"stale-model"}]}`))
	}))
	t.Cleanup(server.Close)

	channel := newAdvancedCustomModelListChannel(server.URL, "secret-key", "/v1/models", nil)
	channel.Name = "stale fetch configuration channel"
	channel.Status = common.ChannelStatusEnabled
	channel.Models = "old-model"
	channel.Group = "default"
	settings := channel.GetOtherSettings()
	settings.UpstreamModelUpdateCheckEnabled = true
	settings.UpstreamModelUpdateAutoSyncEnabled = true
	channel.SetOtherSettings(settings)
	require.NoError(t, db.Create(channel).Error)
	require.NoError(t, channel.UpdateAbilities(nil))

	type checkResult struct {
		modelsChanged bool
		autoAdded     int
		err           error
	}
	resultCh := make(chan checkResult, 1)
	go func() {
		modelsChanged, autoAdded, err := checkAndPersistChannelUpstreamModelUpdates(channel, &settings, true, true)
		resultCh <- checkResult{modelsChanged: modelsChanged, autoAdded: autoAdded, err: err}
	}()

	select {
	case <-requestStarted:
	case <-time.After(5 * time.Second):
		require.FailNow(t, "timed out waiting for upstream model request")
	}
	newBaseURL := "http://new-upstream.invalid"
	require.NoError(t, db.Model(&model.Channel{}).Where("id = ?", channel.Id).Update("base_url", newBaseURL).Error)
	releaseOnce.Do(func() { close(releaseResponse) })

	var result checkResult
	select {
	case result = <-resultCh:
	case <-time.After(5 * time.Second):
		require.FailNow(t, "timed out waiting for stale fetch handling")
	}
	require.NoError(t, result.err)
	assert.False(t, result.modelsChanged)
	assert.Zero(t, result.autoAdded)

	reloaded, err := model.GetChannelById(channel.Id, true)
	require.NoError(t, err)
	assert.Equal(t, newBaseURL, reloaded.GetBaseURL())
	assert.Equal(t, "old-model", reloaded.Models)
	assert.Empty(t, reloaded.GetOtherSettings().UpstreamModelUpdateLastDetectedModels)
}

func TestRefreshChannelRuntimeCacheInvalidatesPricingWithoutMemoryCache(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	originalMemoryCacheEnabled := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = false
	model.InvalidatePricingCache()
	t.Cleanup(func() {
		common.MemoryCacheEnabled = originalMemoryCacheEnabled
		model.InvalidatePricingCache()
	})

	channel := &model.Channel{
		Name:   "pricing invalidation channel",
		Type:   constant.ChannelTypeOpenAI,
		Key:    "secret-key",
		Status: common.ChannelStatusEnabled,
		Models: "old-pricing-model",
		Group:  "default",
	}
	require.NoError(t, db.Create(channel).Error)
	require.NoError(t, channel.UpdateAbilities(nil))

	containsModel := func(pricing []model.Pricing, name string) bool {
		for _, item := range pricing {
			if item.ModelName == name {
				return true
			}
		}
		return false
	}
	require.True(t, containsModel(model.GetPricing(), "old-pricing-model"))
	require.NoError(t, db.Model(&model.Ability{}).
		Where("channel_id = ?", channel.Id).
		Update("model", "new-pricing-model").Error)
	require.True(t, containsModel(model.GetPricing(), "old-pricing-model"))

	refreshChannelRuntimeCache()

	pricing := model.GetPricing()
	assert.True(t, containsModel(pricing, "new-pricing-model"))
	assert.False(t, containsModel(pricing, "old-pricing-model"))
}

func TestFetchModelsUsesSharedChannelFetchBehavior(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/models" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		if r.Header.Get("x-api-key") != "first-key" {
			t.Errorf("unexpected x-api-key header: %s", r.Header.Get("x-api-key"))
		}
		if r.Header.Get("Authorization") != "" {
			t.Errorf("unexpected Authorization header: %s", r.Header.Get("Authorization"))
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"data":[{"id":" claude-sonnet "},{"id":"claude-sonnet"}]}`))
	}))
	t.Cleanup(server.Close)

	body, err := common.Marshal(map[string]any{
		"base_url": server.URL,
		"type":     constant.ChannelTypeAnthropic,
		"key":      "first-key\nsecond-key",
	})
	require.NoError(t, err)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/channel/fetch_models", bytes.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")

	FetchModels(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.JSONEq(t, `{"success":true,"message":"","data":["claude-sonnet"]}`, recorder.Body.String())
}

func TestFetchNewAPIModelsUsesOpenAIContract(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/v1/models", r.URL.Path)
		assert.Equal(t, "Bearer new-api-key", r.Header.Get("Authorization"))
		w.Header().Set("Content-Type", "application/json")
		_, err := w.Write([]byte(`{"data":[{"id":"gpt-5"},{"id":" gpt-5-mini "}]}`))
		assert.NoError(t, err)
	}))
	t.Cleanup(server.Close)

	baseURL := server.URL
	channel := &model.Channel{
		Type:    constant.ChannelTypeNewAPI,
		Key:     "new-api-key",
		BaseURL: &baseURL,
	}

	models, err := fetchChannelUpstreamModelIDs(channel)

	require.NoError(t, err)
	require.Equal(t, []string{"gpt-5", "gpt-5-mini"}, models)
}

func TestNormalizeModelNames(t *testing.T) {
	result := normalizeModelNames([]string{
		" gpt-4o ",
		"",
		"gpt-4o",
		"gpt-4.1",
		"   ",
	})

	require.Equal(t, []string{"gpt-4o", "gpt-4.1"}, result)
}

func TestMergeModelNames(t *testing.T) {
	result := mergeModelNames(
		[]string{"gpt-4o", "gpt-4.1"},
		[]string{"gpt-4.1", " gpt-4.1-mini ", "gpt-4o"},
	)

	require.Equal(t, []string{"gpt-4o", "gpt-4.1", "gpt-4.1-mini"}, result)
}

func TestSubtractModelNames(t *testing.T) {
	result := subtractModelNames(
		[]string{"gpt-4o", "gpt-4.1", "gpt-4.1-mini"},
		[]string{"gpt-4.1", "not-exists"},
	)

	require.Equal(t, []string{"gpt-4o", "gpt-4.1-mini"}, result)
}

func TestIntersectModelNames(t *testing.T) {
	result := intersectModelNames(
		[]string{"gpt-4o", "gpt-4.1", "gpt-4.1", "not-exists"},
		[]string{"gpt-4.1", "gpt-4o-mini", "gpt-4o"},
	)

	require.Equal(t, []string{"gpt-4o", "gpt-4.1"}, result)
}

func TestApplySelectedModelChanges(t *testing.T) {
	t.Run("add and remove together", func(t *testing.T) {
		result := applySelectedModelChanges(
			[]string{"gpt-4o", "gpt-4.1", "claude-3"},
			[]string{"gpt-4.1-mini"},
			[]string{"claude-3"},
		)

		require.Equal(t, []string{"gpt-4o", "gpt-4.1", "gpt-4.1-mini"}, result)
	})

	t.Run("add wins when conflict with remove", func(t *testing.T) {
		result := applySelectedModelChanges(
			[]string{"gpt-4o"},
			[]string{"gpt-4.1"},
			[]string{"gpt-4.1"},
		)

		require.Equal(t, []string{"gpt-4o", "gpt-4.1"}, result)
	})
}

func TestCollectPendingApplyUpstreamModelChanges(t *testing.T) {
	settings := dto.ChannelOtherSettings{
		UpstreamModelUpdateLastDetectedModels: []string{" gpt-4o ", "gpt-4o", "gpt-4.1"},
		UpstreamModelUpdateLastRemovedModels:  []string{" old-model ", "", "old-model"},
	}

	pendingAddModels, pendingRemoveModels := collectPendingApplyUpstreamModelChanges(settings)

	require.Equal(t, []string{"gpt-4o", "gpt-4.1"}, pendingAddModels)
	require.Equal(t, []string{"old-model"}, pendingRemoveModels)
}

func TestNormalizeChannelModelMapping(t *testing.T) {
	modelMapping := `{
		" alias-model ": " upstream-model ",
		"": "invalid",
		"invalid-target": ""
	}`
	channel := &model.Channel{
		ModelMapping: &modelMapping,
	}

	result := normalizeChannelModelMapping(channel)
	require.Equal(t, map[string]string{
		"alias-model": "upstream-model",
	}, result)
}

func TestCollectPendingUpstreamModelChangesFromModels_WithModelMapping(t *testing.T) {
	pendingAddModels, pendingRemoveModels := collectPendingUpstreamModelChangesFromModels(
		[]string{"alias-model", "gpt-4o", "stale-model"},
		[]string{"gpt-4o", "gpt-4.1", "mapped-target"},
		[]string{"gpt-4.1"},
		map[string]string{
			"alias-model": "mapped-target",
		},
	)

	require.Equal(t, []string{}, pendingAddModels)
	require.Equal(t, []string{"stale-model"}, pendingRemoveModels)
}

func TestCollectPendingUpstreamModelChangesFromModels_WithIgnoredRegexPatterns(t *testing.T) {
	pendingAddModels, pendingRemoveModels := collectPendingUpstreamModelChangesFromModels(
		[]string{"gpt-4o"},
		[]string{"gpt-4o", "claude-3-5-sonnet", "sora-video", "gpt-4.1"},
		[]string{"regex:^sora-.*$", "gpt-4.1"},
		nil,
	)

	require.Equal(t, []string{"claude-3-5-sonnet"}, pendingAddModels)
	require.Equal(t, []string{}, pendingRemoveModels)
}

func TestBuildUpstreamModelUpdateTaskNotificationContent_OmitOverflowDetails(t *testing.T) {
	channelSummaries := make([]upstreamModelUpdateChannelSummary, 0, 12)
	for i := 0; i < 12; i++ {
		channelSummaries = append(channelSummaries, upstreamModelUpdateChannelSummary{
			ChannelName: "channel-" + string(rune('A'+i)),
			AddCount:    i + 1,
			RemoveCount: i,
		})
	}

	content := buildUpstreamModelUpdateTaskNotificationContent(
		24,
		12,
		56,
		21,
		9,
		[]int{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12},
		channelSummaries,
		[]string{
			"gpt-4.1", "gpt-4.1-mini", "o3", "o4-mini", "gemini-2.5-pro", "claude-3.7-sonnet",
			"qwen-max", "deepseek-r1", "llama-3.3-70b", "mistral-large", "command-r-plus", "doubao-pro-32k",
			"hunyuan-large",
		},
		[]string{
			"gpt-3.5-turbo", "claude-2.1", "gemini-1.5-pro", "mixtral-8x7b", "qwen-plus", "glm-4",
			"yi-large", "moonshot-v1", "doubao-lite",
		},
	)

	require.Contains(t, content, "其余 4 个渠道已省略")
	require.Contains(t, content, "其余 1 个已省略")
	require.Contains(t, content, "失败渠道 ID（展示 10/12）")
	require.Contains(t, content, "其余 2 个已省略")
}

func TestShouldSendUpstreamModelUpdateNotification(t *testing.T) {
	channelUpstreamModelUpdateNotifyState.Lock()
	channelUpstreamModelUpdateNotifyState.lastNotifiedAt = 0
	channelUpstreamModelUpdateNotifyState.lastChangedChannels = 0
	channelUpstreamModelUpdateNotifyState.lastFailedChannels = 0
	channelUpstreamModelUpdateNotifyState.Unlock()

	baseTime := int64(2000000)

	require.True(t, shouldSendUpstreamModelUpdateNotification(baseTime, 6, 0))
	require.False(t, shouldSendUpstreamModelUpdateNotification(baseTime+3600, 6, 0))
	require.True(t, shouldSendUpstreamModelUpdateNotification(baseTime+3600, 7, 0))
	require.False(t, shouldSendUpstreamModelUpdateNotification(baseTime+7200, 7, 0))
	require.True(t, shouldSendUpstreamModelUpdateNotification(baseTime+8000, 0, 3))
	require.False(t, shouldSendUpstreamModelUpdateNotification(baseTime+9000, 0, 3))
	require.True(t, shouldSendUpstreamModelUpdateNotification(baseTime+10000, 0, 4))
	require.True(t, shouldSendUpstreamModelUpdateNotification(baseTime+90000, 7, 0))
	require.True(t, shouldSendUpstreamModelUpdateNotification(baseTime+90001, 0, 0))
}

func TestDetectAllChannelUpstreamModelUpdatesRejectsExistingActiveTask(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.SystemTask{}, &model.SystemTaskLock{}))

	existing, err := model.CreateSystemTask(model.SystemTaskTypeModelUpdate, nil, nil)
	require.NoError(t, err)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/channel/upstream-models/detect-all", nil)

	DetectAllChannelUpstreamModelUpdates(ctx)

	require.Equal(t, http.StatusConflict, recorder.Code)
	require.Contains(t, recorder.Body.String(), existing.TaskID)
	require.Contains(t, recorder.Body.String(), "已有模型更新任务正在运行或等待中")
}
