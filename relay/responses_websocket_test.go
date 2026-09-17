package relay

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync/atomic"
	"syscall"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	appdto "github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"

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
	session := &responsesWSSession{lockedChannelID: enabled.Id, lockedModel: "ws-model"}
	apiErr = session.restoreConnectionContext(c, "ws-model")
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

func TestResponsesWSMessageSizeLimit(t *testing.T) {
	previous := constant.MaxRequestBodyMB
	constant.MaxRequestBodyMB = 1
	t.Cleanup(func() { constant.MaxRequestBodyMB = previous })
	client, server, cleanup := newTestWebSocketPair(t)
	defer cleanup()
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodGet, "/v1/responses", nil)
	var admitted atomic.Bool
	done := make(chan struct{})
	go func() {
		defer close(done)
		ResponsesWebSocketHelper(c, server, func(*http.Request, string, func(*gin.Context) *types.NewAPIError) *types.NewAPIError {
			admitted.Store(true)
			return nil
		})
	}()
	_ = client.WriteMessage(websocket.TextMessage, []byte(strings.Repeat("x", (1<<20)+1)))
	require.NoError(t, client.SetReadDeadline(time.Now().Add(5*time.Second)))
	_, _, err := client.ReadMessage()
	assert.True(t, websocket.IsCloseError(err, websocket.CloseMessageTooBig), "oversized message must be rejected before admission: %v", err)
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("websocket request did not exit after oversized message")
	}
	assert.False(t, admitted.Load())
}

func TestResponsesWSShutdownInterruptsBusyWriter(t *testing.T) {
	client, server, cleanupClient := newTestWebSocketPair(t)
	defer cleanupClient()
	target, peer, cleanupTarget := newTestWebSocketPair(t)
	defer cleanupTarget()
	ctx, cancel := context.WithCancelCause(context.Background())
	s := &responsesWSSession{ctx: ctx, cancel: cancel, client: server, target: target}
	// A blocked network writer owns this lock. Closing the connection must
	// remain possible so that writer can be interrupted.
	s.targetWriteMu.Lock()
	defer s.targetWriteMu.Unlock()
	done := make(chan struct{})
	go func() { s.shutdown(nil); close(done) }()
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("shutdown waited for the network writer")
	}
	require.NoError(t, peer.SetReadDeadline(time.Now().Add(time.Second)))
	_, _, err := peer.ReadMessage()
	assert.Error(t, err)
	require.NoError(t, client.SetReadDeadline(time.Now().Add(time.Second)))
	_, _, err = client.ReadMessage()
	assert.Error(t, err)
	assert.Nil(t, s.getTarget())
}

func TestResponsesWSPassthroughPreservesRawPricingParameters(t *testing.T) {
	create, _, err := normalizeResponsesWSCreateEvent([]byte(`{"type":"response.create","generate":false,"response":{"model":"gpt-5.1","input":"hi","vendor":{"tier":"premium"},"stream":true}}`))
	require.NoError(t, err)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", strings.NewReader(string(create.Body)))
	c.Request.Header.Set("Content-Type", "application/json")
	common.SetContextKey(c, constant.ContextKeyOriginalModel, create.Request.Model)
	common.SetContextKey(c, constant.ContextKeyChannelType, constant.ChannelTypeOpenAI)
	common.SetContextKey(c, constant.ContextKeyChannelSetting, dto.ChannelSettings{PassThroughBodyEnabled: true})
	info := relaycommon.GenRelayInfoResponses(c, &create.Request)
	payload, apiErr := buildResponsesWSCreatePayload(c, info, create.Request, create.Generate)
	require.Nil(t, apiErr)
	assert.JSONEq(t, `{"type":"response.create","generate":false,"model":"gpt-5.1","input":"hi","vendor":{"tier":"premium"}}`, string(payload))
	storage, err := common.GetBodyStorage(c)
	require.NoError(t, err)
	require.NoError(t, storage.Close())
}

func TestStreamErrorLogCodes(t *testing.T) {
	for _, tc := range []struct {
		name string
		err  error
		code string
	}{
		{"cancel", context.Canceled, "context_canceled"},
		{"context deadline", context.DeadlineExceeded, "deadline_exceeded"},
		{"io deadline", os.ErrDeadlineExceeded, "io_timeout"},
		{"broken pipe", fmt.Errorf("write: %w", syscall.EPIPE), "broken_pipe"},
		{"reset", &net.OpError{Op: "read", Net: "tcp", Err: syscall.ECONNRESET}, "connection_reset"},
		{"closed", net.ErrClosed, "connection_closed"},
		{"closed pipe", io.ErrClosedPipe, "closed_pipe"},
		{"unexpected eof", io.ErrUnexpectedEOF, "unexpected_eof"},
		{"eof", io.EOF, "eof"},
		{"network timeout", &net.DNSError{IsTimeout: true}, "network_timeout"},
		{"websocket close", fmt.Errorf("read: %w", &websocket.CloseError{Code: websocket.CloseGoingAway, Text: "leaving"}), "websocket_close_1001"},
		{"untyped cancellation text", errors.New("context canceled"), "unknown_error"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			info := &relaycommon.RelayInfo{IsStream: true, ChannelMeta: &relaycommon.ChannelMeta{}, StreamStatus: relaycommon.NewStreamStatus()}
			info.StreamStatus.SetEndReason(relaycommon.StreamEndReasonClientGone, relaycommon.WithStreamErrorSource(tc.err, "downstream_read"))
			info.StreamStatus.SetEndReason(relaycommon.StreamEndReasonScannerErr, net.ErrClosed)
			other := service.GenerateTextOtherInfo(c, info, 1, 1, 1, 0, 1, 0, 1)
			stream, ok := other.Snapshot()["stream_status"].(map[string]any)
			require.True(t, ok)
			assert.Equal(t, tc.code, stream["end_error_code"])
			assert.Equal(t, "downstream_read", stream["end_error_source"])
			assert.Equal(t, tc.err.Error(), stream["end_error"])
			assert.Equal(t, "client_gone", stream["end_reason"])
			assert.Contains(t, info.StreamStatus.Summary(), tc.code)
		})
	}
}

func TestResponsesWSClientClosePreservesCause(t *testing.T) {
	client, server, cleanup := newTestWebSocketPair(t)
	defer cleanup()
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodGet, "/v1/responses", nil)
	started := make(chan struct{})
	cause := make(chan error, 1)
	done := make(chan struct{})
	go func() {
		defer close(done)
		ResponsesWebSocketHelper(c, server, func(request *http.Request, _ string, _ func(*gin.Context) *types.NewAPIError) *types.NewAPIError {
			close(started)
			<-request.Context().Done()
			cause <- context.Cause(request.Context())
			return nil
		})
	}()
	require.NoError(t, client.WriteMessage(websocket.TextMessage, []byte(`{"type":"response.create","model":"test"}`)))
	select {
	case <-started:
	case <-time.After(2 * time.Second):
		t.Fatal("request did not start")
	}
	require.NoError(t, client.WriteControl(websocket.CloseMessage,
		websocket.FormatCloseMessage(websocket.CloseGoingAway, "leaving"), time.Now().Add(time.Second)))
	select {
	case err := <-cause:
		var closeErr *websocket.CloseError
		require.ErrorAs(t, err, &closeErr)
		assert.Equal(t, websocket.CloseGoingAway, closeErr.Code)
		assert.Equal(t, "leaving", closeErr.Text)
		status := relaycommon.NewStreamStatus()
		status.SetEndReason(relaycommon.StreamEndReasonClientGone, relaycommon.WithStreamErrorSource(err, "request_context"))
		assert.Equal(t, "downstream_read", status.EndErrorSource)
		assert.Equal(t, "websocket_close_1001", status.EndErrorCode)
	case <-time.After(2 * time.Second):
		t.Fatal("request was not canceled")
	}
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("websocket handler did not exit")
	}
}

func TestResponsesWSPolicyClosePreservesCause(t *testing.T) {
	_, server, cleanup := newTestWebSocketPair(t)
	defer cleanup()
	ctx, cancel := context.WithCancelCause(context.Background())
	s := &responsesWSSession{ctx: ctx, cancel: cancel, client: server}
	s.closeForPolicy("channel disabled")
	// Subsequent socket cleanup must not replace the policy decision.
	s.shutdown(relaycommon.WithStreamErrorSource(net.ErrClosed, "downstream_read"))
	status := relaycommon.NewStreamStatus()
	status.SetEndReason(relaycommon.StreamEndReasonClientGone, context.Cause(ctx))
	assert.Equal(t, "server_policy", status.EndErrorSource)
	assert.Equal(t, "websocket_close_1008", status.EndErrorCode)
	assert.Contains(t, status.EndError.Error(), "channel disabled")
}

type diagnosticFailWriter struct{ *httptest.ResponseRecorder }

func (w diagnosticFailWriter) Write([]byte) (int, error) { return 0, syscall.EPIPE }

func TestSSEWriteErrorPreservedAfterTerminal(t *testing.T) {
	previousTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = previousTimeout })
	c, _ := gin.CreateTestContext(diagnosticFailWriter{httptest.NewRecorder()})
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	info := &relaycommon.RelayInfo{IsStream: true, DisablePing: true, ChannelMeta: &relaycommon.ChannelMeta{}}
	originalWriter := c.Writer
	resp := &http.Response{Body: io.NopCloser(strings.NewReader("data: hello\n\n"))}
	helper.StreamScannerHandler(c, resp, info, func(data string, sr *helper.StreamResult) {
		// The upstream may finish before buffered chunks reach the client.
		info.StreamStatus.SetEndReason(relaycommon.StreamEndReasonDone, nil)
		_ = helper.StringData(c, data)
	})
	assert.Same(t, originalWriter, c.Writer)
	require.NotEmpty(t, info.StreamStatus.Errors)
	assert.Equal(t, "broken_pipe", info.StreamStatus.Errors[0].Code)
	assert.Equal(t, "downstream_write", info.StreamStatus.Errors[0].Source)
	other := service.GenerateTextOtherInfo(c, info, 1, 1, 1, 0, 1, 0, 1)
	var decoded map[string]any
	require.NoError(t, common.UnmarshalJsonStr(other.JSONString(), &decoded))
	stream, ok := decoded["stream_status"].(map[string]any)
	require.True(t, ok)
	assert.Equal(t, "error", stream["status"])
	assert.NotContains(t, stream, "end_error")
	details, ok := stream["error_details"].([]any)
	require.True(t, ok)
	require.NotEmpty(t, details)
	assert.Equal(t, map[string]any{"message": "broken pipe", "code": "broken_pipe", "source": "downstream_write"}, details[0])
}

func TestSSERequestCancellationPreservesCause(t *testing.T) {
	previousTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = previousTimeout })
	ctx, cancel := context.WithCancelCause(context.Background())
	defer cancel(nil)
	reader, writer := io.Pipe()
	defer reader.Close()
	defer writer.Close()
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil).WithContext(ctx)
	info := &relaycommon.RelayInfo{IsStream: true, DisablePing: true, ChannelMeta: &relaycommon.ChannelMeta{}}
	done := make(chan struct{})
	go func() {
		defer close(done)
		helper.StreamScannerHandler(c, &http.Response{Body: reader}, info, func(string, *helper.StreamResult) {
			cancel(context.DeadlineExceeded)
		})
	}()
	_, err := fmt.Fprint(writer, "data: hello\n\n")
	require.NoError(t, err)
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("SSE handler did not exit")
	}
	assert.Equal(t, relaycommon.StreamEndReasonClientGone, info.StreamStatus.EndReason)
	assert.ErrorIs(t, info.StreamStatus.EndError, context.DeadlineExceeded)
	assert.Equal(t, "deadline_exceeded", info.StreamStatus.EndErrorCode)
	assert.Equal(t, "request_context", info.StreamStatus.EndErrorSource)
}
