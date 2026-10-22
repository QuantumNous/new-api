package controller

import (
	"bytes"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
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

	queryValue := "prefix-" + secret
	queryError := sanitizeAdvancedCustomRequestError(
		errors.New("dial "+queryValue+": connection refused"),
		queryValue,
		baseURL+"/v1/models?custom-token="+url.QueryEscape(queryValue),
	)
	require.NotContains(t, queryError.Error(), queryValue)
	require.EqualError(t, queryError, "dial [REDACTED]: connection refused")
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

	modelsChanged, autoAdded, _, err := checkAndPersistChannelUpstreamModelUpdates(channel, &settings, true, true)
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
	pendingAddModels, pendingRemoveModels, _ := collectPendingUpstreamModelChangesFromModels(
		[]string{"alias-model", "gpt-4o", "stale-model"},
		[]string{"gpt-4o", "gpt-4.1", "mapped-target"},
		[]string{"gpt-4.1"},
		map[string]string{
			"alias-model": "mapped-target",
		},
		nil,
	)

	require.Equal(t, []string{}, pendingAddModels)
	require.Equal(t, []string{"stale-model"}, pendingRemoveModels)
}

func TestCollectPendingUpstreamModelChangesFromModels_WithIgnoredRegexPatterns(t *testing.T) {
	pendingAddModels, pendingRemoveModels, _ := collectPendingUpstreamModelChangesFromModels(
		[]string{"gpt-4o"},
		[]string{"gpt-4o", "claude-3-5-sonnet", "sora-video", "gpt-4.1"},
		[]string{"regex:^sora-.*$", "gpt-4.1"},
		nil,
		nil,
	)

	require.Equal(t, []string{"claude-3-5-sonnet"}, pendingAddModels)
	require.Equal(t, []string{}, pendingRemoveModels)
}

var testModelMappingRules = dto.ModelMappingRules{
	{Type: dto.ModelMappingRuleStripPrefix, Values: "relay/"},
	{Type: dto.ModelMappingRuleRegexReplace, Find: "(?i)^minimax-m", ReplaceWith: "MiniMax-M"},
}

func TestCollectPendingUpstreamModelChangesFromModels_WithMappingRules(t *testing.T) {
	upstreamModels := []string{"relay/claude-opus-5-5", "relay/gemini-3-flash", "gemini-3-flash", "minimax-m3.1"}
	tests := []struct {
		name          string
		localModels   []string
		modelMapping  map[string]string
		rules         dto.ModelMappingRules
		wantAdd       []string
		wantConflicts []modelMappingRuleConflict
	}{
		{
			name:          "no rules keeps upstream names",
			localModels:   []string{"gemini-3-flash"},
			wantAdd:       []string{"relay/claude-opus-5-5", "relay/gemini-3-flash", "minimax-m3.1"},
			wantConflicts: []modelMappingRuleConflict{},
		},
		{
			name:          "derived name already present locally counts as covered",
			localModels:   []string{"gemini-3-flash"},
			rules:         testModelMappingRules,
			wantAdd:       []string{"relay/claude-opus-5-5", "minimax-m3.1"},
			wantConflicts: []modelMappingRuleConflict{},
		},
		{
			name:    "first upstream model wins when two derive the same name",
			rules:   testModelMappingRules,
			wantAdd: []string{"relay/claude-opus-5-5", "relay/gemini-3-flash", "minimax-m3.1"},
			wantConflicts: []modelMappingRuleConflict{
				{Target: "gemini-3-flash", Upstream: "gemini-3-flash"},
			},
		},
		{
			name:         "derived name mapped to another upstream model is a conflict",
			localModels:  []string{"gemini-3-flash"},
			modelMapping: map[string]string{"claude-opus-5-5": "vendor/claude-opus-5-5"},
			rules:        testModelMappingRules,
			wantAdd:      []string{"minimax-m3.1"},
			wantConflicts: []modelMappingRuleConflict{
				{Target: "claude-opus-5-5", Upstream: "relay/claude-opus-5-5"},
			},
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			pendingAddModels, _, conflicts := collectPendingUpstreamModelChangesFromModels(
				test.localModels,
				upstreamModels,
				nil,
				test.modelMapping,
				test.rules,
			)
			assert.Equal(t, test.wantAdd, pendingAddModels)
			assert.Equal(t, test.wantConflicts, conflicts)
		})
	}
}

func TestUpstreamModelSyncAppliesMappingRules(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"data":[{"id":"relay/claude-opus-5-5"},{"id":"relay/gemini-3-flash"},{"id":"gemini-3-flash"},{"id":"minimax-m3.1"}]}`))
	}))
	defer server.Close()

	baseURL := server.URL
	existingMapping := `{"legacy":"legacy-upstream"}`
	channel := &model.Channel{
		Type:         constant.ChannelTypeOpenAI,
		Key:          "sk-test",
		BaseURL:      &baseURL,
		Name:         "rules",
		Models:       "gemini-3-flash,legacy",
		Group:        "default",
		ModelMapping: &existingMapping,
	}
	settings := dto.ChannelOtherSettings{
		UpstreamModelUpdateCheckEnabled:    true,
		UpstreamModelUpdateAutoSyncEnabled: true,
		ModelMappingRules:                  testModelMappingRules,
	}
	channel.SetOtherSettings(settings)
	require.NoError(t, db.Create(channel).Error)

	modelsChanged, autoAdded, conflicts, err := checkAndPersistChannelUpstreamModelUpdates(channel, &settings, true, true)
	require.NoError(t, err)
	assert.True(t, modelsChanged)
	assert.Equal(t, 2, autoAdded)
	assert.Empty(t, conflicts)

	reloaded, err := model.GetChannelById(channel.Id, true)
	require.NoError(t, err)
	assert.Equal(t, "gemini-3-flash,legacy,claude-opus-5-5,MiniMax-M3.1", reloaded.Models)
	assert.Equal(t, map[string]string{
		"legacy":          "legacy-upstream",
		"claude-opus-5-5": "relay/claude-opus-5-5",
		"MiniMax-M3.1":    "minimax-m3.1",
	}, normalizeChannelModelMapping(reloaded))

	settings = reloaded.GetOtherSettings()
	modelsChanged, _, _, err = checkAndPersistChannelUpstreamModelUpdates(reloaded, &settings, true, true)
	require.NoError(t, err)
	assert.False(t, modelsChanged)
	assert.Empty(t, settings.UpstreamModelUpdateLastDetectedModels)
}

func TestApplyChannelUpstreamModelUpdatesAppliesMappingRules(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	channel := &model.Channel{
		Type:   constant.ChannelTypeOpenAI,
		Key:    "sk-test",
		Name:   "rules",
		Models: "gemini-3-flash",
		Group:  "default",
	}
	channel.SetOtherSettings(dto.ChannelOtherSettings{
		UpstreamModelUpdateLastDetectedModels: []string{"relay/claude-opus-5-5", "minimax-m3.1"},
		ModelMappingRules:                     testModelMappingRules,
	})
	require.NoError(t, db.Create(channel).Error)

	added, _, remaining, _, modelsChanged, err := applyChannelUpstreamModelUpdates(channel, []string{"relay/claude-opus-5-5"}, nil, nil)
	require.NoError(t, err)
	assert.True(t, modelsChanged)
	assert.Equal(t, []string{"relay/claude-opus-5-5"}, added)
	assert.Equal(t, []string{"minimax-m3.1"}, remaining)

	reloaded, err := model.GetChannelById(channel.Id, true)
	require.NoError(t, err)
	assert.Equal(t, "gemini-3-flash,claude-opus-5-5", reloaded.Models)
	assert.Equal(t, map[string]string{"claude-opus-5-5": "relay/claude-opus-5-5"}, normalizeChannelModelMapping(reloaded))
}

func TestPreviewModelMappingRules(t *testing.T) {
	preview := previewModelMappingRules(
		[]string{"relay/gpt-6", "alias", "minimax-m3.1", "relay/gemini-3-flash", "gemini-3-flash", "plain"},
		map[string]string{"alias": "relay/alias-upstream", "minimax-m3.1": "vendor/minimax-m3.1"},
		testModelMappingRules,
	)

	assert.Equal(t, []string{"gpt-6", "alias", "MiniMax-M3.1", "relay/gemini-3-flash", "gemini-3-flash", "plain"}, preview.Models)
	assert.Equal(t, map[string]string{
		"gpt-6":        "relay/gpt-6",
		"alias":        "relay/alias-upstream",
		"MiniMax-M3.1": "vendor/minimax-m3.1",
	}, preview.ModelMapping)
	assert.Equal(t, []modelMappingRuleChange{
		{From: "relay/gpt-6", To: "gpt-6", Upstream: "relay/gpt-6"},
		{From: "minimax-m3.1", To: "MiniMax-M3.1", Upstream: "vendor/minimax-m3.1"},
	}, preview.Changed)
	assert.Equal(t, []modelMappingRuleConflict{
		{Model: "relay/gemini-3-flash", Target: "gemini-3-flash", Upstream: "relay/gemini-3-flash"},
	}, preview.Conflicts)

	again := previewModelMappingRules(preview.Models, preview.ModelMapping, testModelMappingRules)
	assert.Empty(t, again.Changed)
}

func TestPreviewChannelModelMappingRulesRejectsInvalidRules(t *testing.T) {
	body, err := common.Marshal(map[string]any{
		"models": []string{"a"},
		"rules":  []map[string]string{{"type": "regex_replace", "find": "("}},
	})
	require.NoError(t, err)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/channel/model_mapping_rules/preview", bytes.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")

	PreviewChannelModelMappingRules(ctx)

	assert.Contains(t, recorder.Body.String(), `"success":false`)
	assert.Contains(t, recorder.Body.String(), "Invalid model mapping rules")
}

func TestBuildUpstreamModelUpdateTaskNotificationContent_OmitOverflowDetails(t *testing.T) {
	channelSummaries := make([]upstreamModelUpdateChannelSummary, 0, 12)
	for i := range 12 {
		channelSummaries = append(channelSummaries, upstreamModelUpdateChannelSummary{
			ChannelName: "channel-" + string(rune('A'+i)),
			AddCount:    i + 1,
			RemoveCount: i,
		})
	}

	require.NoError(t, i18n.Init())
	content := buildUpstreamModelUpdateTaskNotificationContent(
		i18n.LangEn,
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

	require.Contains(t, content, i18n.Translate(i18n.LangEn, i18n.MsgChannelUpstreamUpdateMoreChannels, map[string]any{"Count": 4}))
	require.Contains(t, content, i18n.Translate(i18n.LangEn, i18n.MsgChannelUpstreamUpdateMoreOmitted, map[string]any{"Count": 1}))
	require.Contains(t, content, i18n.Translate(i18n.LangEn, i18n.MsgChannelUpstreamUpdateFailedChannels, map[string]any{
		"Shown": 10,
		"Total": 12,
		"Ids":   "1, 2, 3, 4, 5, 6, 7, 8, 9, 10",
	}))
	require.Contains(t, content, i18n.Translate(i18n.LangEn, i18n.MsgChannelUpstreamUpdateMoreOmitted, map[string]any{"Count": 2}))
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
	require.Contains(t, recorder.Body.String(), "A model update task is already running or queued")
}
