package relay

import (
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	appdto "github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNormalizeResponsesWSMaxOutputTokens(t *testing.T) {
	for _, tc := range []struct {
		value string
		valid bool
	}{
		{value: "0", valid: true},
		{value: "1073741823", valid: true},
		{value: "1073741824"},
		{value: "18446744073686646784"},
		{value: "-1"},
	} {
		for _, wrapped := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s/wrapped=%t", tc.value, wrapped), func(t *testing.T) {
				fields := `"model":"gpt-5.1","input":"hi","max_output_tokens":` + tc.value
				payload := `{"type":"response.create",` + fields + `}`
				if wrapped {
					payload = `{"type":"response.create","response":{` + fields + `}}`
				}
				create, _, err := normalizeResponsesWSCreateEvent([]byte(payload))
				if !tc.valid {
					require.Error(t, err)
					assert.Equal(t, http.StatusBadRequest, newResponsesWSInvalidRequestError(err).StatusCode)
					return
				}
				require.NoError(t, err)
				require.NotNil(t, create.Request.MaxOutputTokens)
				assert.Equal(t, tc.value, fmt.Sprint(*create.Request.MaxOutputTokens))
			})
		}
	}
}

func TestResponsesWSToolAndTerminalUsageAccounting(t *testing.T) {
	operation_setting.SetToolPriceForTest("ws_priced_fn", 5)
	t.Cleanup(func() { operation_setting.DeleteToolPriceForTest("ws_priced_fn") })
	for _, tc := range []struct {
		name       string
		eventType  string
		status     string
		wantImages int
	}{
		{name: "completed deduplicates images", eventType: "response.completed", status: `"completed"`, wantImages: 1},
		{name: "done deduplicates images", eventType: "response.done", wantImages: 1},
		{name: "incomplete event clears pending images", eventType: "response.incomplete"},
		{name: "failed response status clears pending images", eventType: "response.done", status: `"failed"`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			state := &responsesWSCallState{
				info: &relaycommon.RelayInfo{
					OriginModelName: "gpt-5.1",
					ResponsesUsageInfo: &relaycommon.ResponsesUsageInfo{BuiltInTools: map[string]*relaycommon.BuildInToolInfo{
						dto.BuildInToolWebSearch: {ToolName: dto.BuildInToolWebSearch},
					}},
				},
				usage: &dto.Usage{},
			}
			session := &responsesWSSession{current: state}
			for _, event := range []string{
				`{"type":"response.output_item.done","item":{"type":"web_search_call"}}`,
				`{"type":"response.output_item.done","item":{"type":"file_search_call"}}`,
				`{"type":"response.output_item.done","item":{"type":"function_call","name":"ws_priced_fn"}}`,
				`{"type":"response.output_item.done","item":{"type":"function_call","name":"ws_unpriced_fn"}}`,
				`{"type":"response.output_item.done","output_index":0,"item":{"id":"img_1","type":"image_generation_call","result":"image-data","status":"completed"}}`,
			} {
				session.observeUpstreamMessage([]byte(event))
			}
			response := &dto.OpenAIResponsesResponse{
				Status: common.RawMessage(tc.status),
				Usage:  &dto.Usage{InputTokens: 10, OutputTokens: 5, TotalTokens: 15, InputTokensDetails: &dto.InputTokenDetails{CachedTokens: 3}},
				Output: []dto.ResponsesOutput{{ID: "img_1", Type: dto.ResponsesOutputTypeImageGenerationCall, Result: "image-data", Status: "completed"}},
			}
			response.Usage.BillingUsage = dto.NewOpenAIResponsesBillingUsage(response.Usage)
			session.applyTerminalResponseUsage(state, response, tc.eventType)
			finalizeResponsesWSUsage(state)
			tools := state.info.ResponsesUsageInfo.BuiltInTools
			for _, name := range []string{dto.BuildInToolWebSearch, dto.BuildInToolFileSearch, "ws_priced_fn"} {
				require.Contains(t, tools, name)
				assert.Equal(t, 1, tools[name].CallCount)
			}
			assert.NotContains(t, tools, dto.BuildInToolWebSearchPreview)
			assert.NotContains(t, tools, "ws_unpriced_fn")
			require.Contains(t, tools, dto.BuildInToolImageGeneration)
			assert.Equal(t, tc.wantImages, tools[dto.BuildInToolImageGeneration].CallCount)
			assert.Equal(t, 10, state.usage.PromptTokens)
			assert.Equal(t, 5, state.usage.CompletionTokens)
			assert.Equal(t, 15, state.usage.TotalTokens)
			require.NotNil(t, state.usage.BillingUsage)
			require.NotNil(t, state.usage.BillingUsage.OpenAIUsage)
			require.NotNil(t, state.usage.BillingUsage.OpenAIUsage.InputTokensDetails)
			assert.Equal(t, 3, state.usage.BillingUsage.OpenAIUsage.InputTokensDetails.CachedTokens)
		})
	}
}

func TestFinalizeResponsesWSUsagePreservesBillingSnapshot(t *testing.T) {
	original := dto.NewOpenAIResponsesBillingUsage(&dto.Usage{
		InputTokens: 10, TotalTokens: 10,
		InputTokensDetails: &dto.InputTokenDetails{CachedTokens: 3},
	})
	state := &responsesWSCallState{
		info:  &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "gpt-4o"}},
		usage: &dto.Usage{PromptTokens: 10, TotalTokens: 10, BillingUsage: original},
	}
	state.outputText.WriteString("hello")
	finalizeResponsesWSUsage(state)
	assert.Equal(t, 1, state.usage.CompletionTokens)
	assert.Equal(t, 11, state.usage.TotalTokens)
	require.NotNil(t, state.usage.BillingUsage)
	assert.True(t, state.usage.BillingUsage.Estimated)
	assert.Equal(t, dto.BillingUsageSourceOAIResponses, state.usage.BillingUsage.Source)
	usage := state.usage.BillingUsage.OpenAIUsage
	require.NotNil(t, usage)
	assert.Equal(t, 1, usage.OutputTokens)
	assert.Equal(t, 11, usage.TotalTokens)
	require.NotNil(t, usage.InputTokensDetails)
	assert.Equal(t, 3, usage.InputTokensDetails.CachedTokens)
	assert.Zero(t, original.OpenAIUsage.OutputTokens)
	assert.Equal(t, 10, original.OpenAIUsage.TotalTokens)
}

func TestSelectResponsesWSChannelHonorsPinsAndFilters(t *testing.T) {
	database := setupRelayChannelDB(t)
	enabled := &model.Channel{Name: "enabled", Key: "sk-test", Status: common.ChannelStatusEnabled, Type: constant.ChannelTypeOpenAI}
	enabled.SetSetting(dto.ChannelSettings{ResponsesWebSocketEnabled: true})
	wsDisabled := &model.Channel{Name: "ws-disabled", Key: "sk-test", Status: common.ChannelStatusEnabled, Type: constant.ChannelTypeOpenAI}
	disabled := &model.Channel{Name: "disabled", Key: "sk-test", Status: common.ChannelStatusManuallyDisabled, Type: constant.ChannelTypeOpenAI}
	filtered := &model.Channel{Name: "filtered", Key: "sk-test", Status: common.ChannelStatusEnabled, Type: constant.ChannelTypeAdvancedCustom}
	for _, channel := range []*model.Channel{enabled, disabled, filtered, wsDisabled} {
		require.NoError(t, database.Create(channel).Error)
	}
	for _, tc := range []struct {
		name      string
		channelID int
		status    int
	}{
		{name: "token pin overrides origin pin", channelID: enabled.Id},
		{name: "disabled pin rejects", channelID: disabled.Id, status: http.StatusForbidden},
		{name: "pin cannot bypass websocket switch", channelID: wsDisabled.Id, status: http.StatusBadRequest},
		{name: "pin cannot bypass path filter", channelID: filtered.Id, status: http.StatusBadRequest},
		{name: "missing pin rejects", channelID: 99999, status: http.StatusBadRequest},
	} {
		t.Run(tc.name, func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest(http.MethodGet, "/v1/responses", nil)
			constraints := service.GetChannelConstraints(c)
			constraints.AddPin(appdto.ChannelPin{ChannelId: disabled.Id, Source: appdto.PinSourceOriginTask, Rank: appdto.PinRankOriginTask, RetryMode: appdto.PinRetrySameChannel})
			constraints.AddPin(appdto.ChannelPin{ChannelId: tc.channelID, Source: appdto.PinSourceToken, Rank: appdto.PinRankToken, RetryMode: appdto.PinRetrySingleAttempt})
			constraints.AddFilter(appdto.ChannelFilter{Kind: appdto.FilterRequestPath, RequestPath: c.Request.URL.Path})
			channel, apiErr := selectResponsesWSChannel(c, "gpt-5.1", &service.RetryParam{Ctx: c, ModelName: "gpt-5.1", TokenGroup: "default"})
			if tc.status != 0 {
				require.NotNil(t, apiErr)
				assert.Equal(t, tc.status, apiErr.StatusCode)
				assert.Nil(t, channel)
				assert.False(t, service.ShouldRetryRelayError(c, apiErr, 2))
				return
			}
			require.Nil(t, apiErr)
			require.NotNil(t, channel)
			assert.Equal(t, enabled.Id, channel.Id)
			assert.Equal(t, enabled.Id, common.GetContextKeyInt(c, constant.ContextKeyChannelId))
			assert.False(t, service.ShouldRetryRelayError(c, types.NewErrorWithStatusCode(errors.New("upstream failed"), types.ErrorCodeDoRequestFailed, 503), 2))
		})
	}
}

func TestResponsesWSChannelRoutingRequiresExplicitOptIn(t *testing.T) {
	database := setupRelayChannelDB(t)
	require.NoError(t, database.AutoMigrate(&model.Ability{}))
	legacy := &model.Channel{Name: "legacy-http", Key: "sk-test", Type: constant.ChannelTypeOpenAI, Status: common.ChannelStatusEnabled, Group: "default", Models: "ws-model", Priority: common.GetPointer(int64(10))}
	enabled := &model.Channel{Name: "websocket", Key: "sk-test", Type: constant.ChannelTypeCodex, Status: common.ChannelStatusEnabled, Group: "default", Models: "ws-model", Priority: common.GetPointer(int64(0))}
	unsupported := &model.Channel{Name: "unsupported", Key: "sk-test", Type: constant.ChannelTypeAnthropic, Status: common.ChannelStatusEnabled, Group: "default", Models: "ws-model", Priority: common.GetPointer(int64(5))}
	enabled.SetSetting(dto.ChannelSettings{ResponsesWebSocketEnabled: true})
	unsupported.SetSetting(dto.ChannelSettings{ResponsesWebSocketEnabled: true})
	for _, channel := range []*model.Channel{legacy, enabled, unsupported} {
		require.NoError(t, database.Create(channel).Error)
		require.NoError(t, database.Create(&model.Ability{ChannelId: channel.Id, Model: "ws-model", Group: "default", Enabled: true, Priority: channel.Priority}).Error)
	}
	previousCache := common.MemoryCacheEnabled
	t.Cleanup(func() {
		defer func() { common.MemoryCacheEnabled = previousCache }()
		ids := []int{legacy.Id, enabled.Id, unsupported.Id}
		require.NoError(t, database.Where("channel_id IN ?", ids).Delete(&model.Ability{}).Error)
		require.NoError(t, database.Where("id IN ?", ids).Delete(&model.Channel{}).Error)
		model.InitChannelCache()
	})
	common.MemoryCacheEnabled = true
	model.InitChannelCache()
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodGet, "/v1/responses", nil)
	params := &service.RetryParam{Ctx: c, ModelName: "ws-model", TokenGroup: "default"}
	channel, apiErr := selectResponsesWSChannel(c, "ws-model", params)
	require.Nil(t, apiErr)
	require.NotNil(t, channel)
	assert.Equal(t, enabled.Id, channel.Id)
	httpChannel, err := model.GetRandomSatisfiedChannel("default", "ws-model", 0, nil)
	require.NoError(t, err)
	require.NotNil(t, httpChannel)
	assert.Equal(t, legacy.Id, httpChannel.Id)

	// Disabling the saved setting takes effect for the next create on an existing session.
	enabled.SetSetting(dto.ChannelSettings{ResponsesWebSocketEnabled: false})
	require.NoError(t, database.Model(enabled).Update("setting", enabled.Setting).Error)
	model.InitChannelCache()
	session := &responsesWSSession{c: c, lockedChannel: enabled, lockedModel: "ws-model"}
	apiErr = session.handleResponseCreate(responsesWSCreateRequest{Request: dto.OpenAIResponsesRequest{Model: "ws-model"}}, "evt-next")
	require.NotNil(t, apiErr)
	assert.Equal(t, http.StatusForbidden, apiErr.StatusCode)
	channel, apiErr = selectResponsesWSChannel(c, "ws-model", params)
	require.NotNil(t, apiErr)
	assert.Nil(t, channel)
}

func TestNormalizeResponsesWSCreateEventWrapper(t *testing.T) {
	message := []byte(`{
		"type": "response.create",
		"event_id": "evt_1",
		"generate": false,
		"response": {
			"model": "gpt-5.3-codex-spark",
			"input": "hi",
			"store": false,
			"stream": true,
			"stream_options": {"include_usage": true}
		}
	}`)

	create, eventID, err := normalizeResponsesWSCreateEvent(message)
	if err != nil {
		t.Fatalf("normalizeResponsesWSCreateEvent() error = %v", err)
	}
	req := create.Request
	if eventID != "evt_1" {
		t.Fatalf("eventID = %q, want evt_1", eventID)
	}
	if req.Model != "gpt-5.3-codex-spark" {
		t.Fatalf("model = %q", req.Model)
	}
	if strings.TrimSpace(string(create.Generate)) != "false" {
		t.Fatalf("generate = %s, want false", create.Generate)
	}
	if req.Stream != nil {
		t.Fatalf("stream = %v, want nil", req.Stream)
	}
	if req.StreamOptions != nil {
		t.Fatalf("stream_options = %#v, want nil", req.StreamOptions)
	}
	if strings.TrimSpace(string(req.Store)) != "false" {
		t.Fatalf("store = %s, want false", req.Store)
	}
}

func TestNormalizeResponsesWSCreateEventFlat(t *testing.T) {
	message := []byte(`{
		"type": "response.create",
		"event_id": "evt_2",
		"model": "gpt-5.3-codex-spark",
		"input": "hi",
		"generate": false,
		"stream": true,
		"background": true,
		"stream_options": {"include_usage": true}
	}`)

	create, eventID, err := normalizeResponsesWSCreateEvent(message)
	if err != nil {
		t.Fatalf("normalizeResponsesWSCreateEvent() error = %v", err)
	}
	req := create.Request
	if eventID != "evt_2" {
		t.Fatalf("eventID = %q, want evt_2", eventID)
	}
	if req.Model != "gpt-5.3-codex-spark" {
		t.Fatalf("model = %q", req.Model)
	}
	if strings.TrimSpace(string(create.Generate)) != "false" {
		t.Fatalf("generate = %s, want false", create.Generate)
	}
	if req.Stream != nil {
		t.Fatalf("stream = %v, want nil", req.Stream)
	}
	if req.StreamOptions != nil {
		t.Fatalf("stream_options = %#v, want nil", req.StreamOptions)
	}
}

func TestBuildResponsesWSCreateEventIsFlat(t *testing.T) {
	payload := []byte(`{
		"model": "gpt-5.3-codex-spark",
		"input": "hi",
		"store": false,
		"event_id": "evt_upstream",
		"stream": true,
		"background": true,
		"stream_options": {"include_usage": true}
	}`)

	got, err := buildResponsesWSCreateEvent(payload, common.RawMessage(`false`))
	if err != nil {
		t.Fatalf("buildResponsesWSCreateEvent() error = %v", err)
	}
	var data map[string]any
	if err := common.Unmarshal(got, &data); err != nil {
		t.Fatalf("unmarshal result: %v", err)
	}
	if data["type"] != responsesWSEventTypeResponseCreate {
		t.Fatalf("type = %#v", data["type"])
	}
	if data["model"] != "gpt-5.3-codex-spark" || data["input"] != "hi" || data["store"] != false {
		t.Fatalf("unexpected flat event fields: %s", got)
	}
	if data["generate"] != false {
		t.Fatalf("generate = %#v, want false", data["generate"])
	}
	for _, key := range []string{"response", "event_id", "stream", "background", "stream_options"} {
		if _, ok := data[key]; ok {
			t.Fatalf("field %q should not be present in upstream event: %s", key, got)
		}
	}
}

func TestHTTPResponsesRequestDoesNotMarshalGenerate(t *testing.T) {
	var req dto.OpenAIResponsesRequest
	if err := common.Unmarshal([]byte(`{"model":"gpt-5.3-codex-spark","input":"hi","generate":false}`), &req); err != nil {
		t.Fatalf("unmarshal request: %v", err)
	}
	got, err := common.Marshal(req)
	if err != nil {
		t.Fatalf("marshal request: %v", err)
	}
	var data map[string]any
	if err := common.Unmarshal(got, &data); err != nil {
		t.Fatalf("unmarshal result: %v", err)
	}
	if _, ok := data["generate"]; ok {
		t.Fatalf("generate leaked into HTTP request JSON: %s", got)
	}
}

func TestBuildResponsesWSErrorPayloadIncludesStatus(t *testing.T) {
	payload, err := buildResponsesWSErrorPayload("evt_err", types.NewErrorWithStatusCode(
		errors.New("model is required"),
		types.ErrorCodeInvalidRequest,
		http.StatusBadRequest,
		types.ErrOptionWithSkipRetry(),
	))
	if err != nil {
		t.Fatalf("buildResponsesWSErrorPayload() error = %v", err)
	}
	var data struct {
		Type    string             `json:"type"`
		Status  int                `json:"status"`
		EventID string             `json:"event_id"`
		Error   *types.OpenAIError `json:"error"`
	}
	if err := common.Unmarshal(payload, &data); err != nil {
		t.Fatalf("unmarshal result: %v", err)
	}
	if data.Type != "error" || data.Status != http.StatusBadRequest || data.EventID != "evt_err" {
		t.Fatalf("unexpected error event: %s", payload)
	}
	if data.Error == nil || data.Error.Code != string(types.ErrorCodeInvalidRequest) {
		t.Fatalf("unexpected error body: %#v", data.Error)
	}
}

func TestResponsesWSInvalidRequestErrorUsesBadRequestStatus(t *testing.T) {
	payload, err := buildResponsesWSErrorPayload("", newResponsesWSInvalidRequestError(errors.New("bad event")))
	if err != nil {
		t.Fatalf("buildResponsesWSErrorPayload() error = %v", err)
	}
	var data struct {
		Status int `json:"status"`
	}
	if err := common.Unmarshal(payload, &data); err != nil {
		t.Fatalf("unmarshal result: %v", err)
	}
	if data.Status != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", data.Status, http.StatusBadRequest)
	}
}

func TestRemoveResponsesWSTransportFields(t *testing.T) {
	payload := []byte(`{
		"model": "gpt-5.3-codex-spark",
		"stream": true,
		"background": true,
		"stream_options": {"include_usage": true},
		"store": false
	}`)

	got, err := removeResponsesWSTransportFields(payload)
	if err != nil {
		t.Fatalf("removeResponsesWSTransportFields() error = %v", err)
	}
	var data map[string]any
	if err := common.Unmarshal(got, &data); err != nil {
		t.Fatalf("unmarshal result: %v", err)
	}
	for _, key := range []string{"stream", "background", "stream_options"} {
		if _, ok := data[key]; ok {
			t.Fatalf("transport field %q still present in %s", key, got)
		}
	}
	if data["store"] != false {
		t.Fatalf("store = %#v, want false", data["store"])
	}
}

func TestToWebSocketURL(t *testing.T) {
	tests := map[string]string{
		"https://api.openai.com/v1/responses":             "wss://api.openai.com/v1/responses",
		"http://127.0.0.1:3000/v1/responses":              "ws://127.0.0.1:3000/v1/responses",
		"wss://chatgpt.com/backend-api/codex/responses":   "wss://chatgpt.com/backend-api/codex/responses",
		"ws://127.0.0.1:3000/backend-api/codex/responses": "ws://127.0.0.1:3000/backend-api/codex/responses",
	}

	for input, want := range tests {
		if got := toWebSocketURL(input); got != want {
			t.Fatalf("toWebSocketURL(%q) = %q, want %q", input, got, want)
		}
	}
}

func TestHandleTargetWriteFailureWithStateReleasesCurrentAndClearsTarget(t *testing.T) {
	target, cleanup := newTestResponsesWSTarget(t)
	defer cleanup()

	var committed *bool
	session := &responsesWSSession{target: target}
	state := &responsesWSCallState{
		info: &relaycommon.RelayInfo{},
		commitRate: func(success bool) {
			committed = &success
		},
	}
	session.current = state

	apiErr := session.handleTargetWriteFailureWithState(state, errors.New("write failed"))

	if apiErr == nil {
		t.Fatal("apiErr is nil")
	}
	if session.target != nil {
		t.Fatal("target was not cleared")
	}
	if session.getCurrent() != nil {
		t.Fatal("current response was not released")
	}
	if committed == nil || *committed {
		t.Fatalf("commit success = %v, want false", committed)
	}
}

func TestHandleControlEventWriteFailureSendsResponsesError(t *testing.T) {
	clientConn, serverConn, cleanupClient := newTestWebSocketPair(t)
	defer cleanupClient()
	target, cleanupTarget := newTestResponsesWSTarget(t)
	defer cleanupTarget()

	session := &responsesWSSession{
		client: serverConn,
		target: target,
	}
	apiErr := session.handleControlEventWriteFailure(errors.New("write failed"))
	if apiErr != nil {
		t.Fatalf("handleControlEventWriteFailure() error = %v", apiErr)
	}
	if session.target != nil {
		t.Fatal("target was not cleared")
	}

	if err := clientConn.SetReadDeadline(time.Now().Add(time.Second)); err != nil {
		t.Fatalf("set read deadline: %v", err)
	}
	_, payload, err := clientConn.ReadMessage()
	if err != nil {
		t.Fatalf("read responses error event: %v", err)
	}
	var data struct {
		Type   string `json:"type"`
		Status int    `json:"status"`
	}
	if err := common.Unmarshal(payload, &data); err != nil {
		t.Fatalf("unmarshal result: %v", err)
	}
	if data.Type != "error" || data.Status == 0 {
		t.Fatalf("unexpected error event: %s", payload)
	}
}

func TestObserveUpstreamFailedReleasesCurrent(t *testing.T) {
	var committed *bool
	session := &responsesWSSession{}
	state := &responsesWSCallState{
		info: &relaycommon.RelayInfo{},
		commitRate: func(success bool) {
			committed = &success
		},
	}
	session.current = state

	session.observeUpstreamMessage([]byte(`{"type":"response.failed"}`))

	if session.getCurrent() != nil {
		t.Fatal("current response was not released")
	}
	if committed == nil || *committed {
		t.Fatalf("commit success = %v, want false", committed)
	}
}

func newTestResponsesWSTarget(t *testing.T) (*websocket.Conn, func()) {
	t.Helper()
	target, _, cleanup := newTestWebSocketPair(t)
	return target, cleanup
}

func newTestWebSocketPair(t *testing.T) (*websocket.Conn, *websocket.Conn, func()) {
	t.Helper()
	upgrader := websocket.Upgrader{}
	serverConnCh := make(chan *websocket.Conn, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			t.Errorf("upgrade websocket: %v", err)
			return
		}
		serverConnCh <- conn
	}))

	targetURL := "ws" + strings.TrimPrefix(server.URL, "http")
	target, _, err := websocket.DefaultDialer.Dial(targetURL, nil)
	if err != nil {
		server.Close()
		t.Fatalf("dial websocket: %v", err)
	}
	serverConn := <-serverConnCh
	cleanup := func() {
		_ = target.Close()
		_ = serverConn.Close()
		server.Close()
	}
	return target, serverConn, cleanup
}
