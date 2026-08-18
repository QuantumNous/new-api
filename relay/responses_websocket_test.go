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
	appconstant "github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/relay/channel/codex"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

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
	require.NoError(t, err)
	req := create.Request
	assert.Equal(t, "evt_1", eventID)
	assert.Equal(t, "gpt-5.3-codex-spark", req.Model)
	assert.Equal(t, "false", strings.TrimSpace(string(create.Generate)))
	assert.Nil(t, req.Stream)
	assert.Nil(t, req.StreamOptions)
	assert.Equal(t, "false", strings.TrimSpace(string(req.Store)))
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
	require.NoError(t, err)
	req := create.Request
	assert.Equal(t, "evt_2", eventID)
	assert.Equal(t, "gpt-5.3-codex-spark", req.Model)
	assert.Equal(t, "false", strings.TrimSpace(string(create.Generate)))
	assert.Nil(t, req.Stream)
	assert.Nil(t, req.StreamOptions)
}

func TestNormalizeResponsesWSCreateEventRejectsNonBooleanGenerate(t *testing.T) {
	_, _, err := normalizeResponsesWSCreateEvent([]byte(`{
		"type":"response.create",
		"model":"gpt-5.3-codex",
		"input":"hi",
		"generate":null
	}`))
	require.EqualError(t, err, "generate must be a boolean")
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
	require.NoError(t, err)
	var data map[string]any
	require.NoError(t, common.Unmarshal(got, &data))
	assert.Equal(t, responsesWSEventTypeResponseCreate, data["type"])
	assert.Equal(t, "gpt-5.3-codex-spark", data["model"])
	assert.Equal(t, "hi", data["input"])
	assert.Equal(t, false, data["store"])
	assert.Equal(t, false, data["generate"])
	for _, key := range []string{"response", "event_id", "stream", "background", "stream_options"} {
		assert.NotContains(t, data, key)
	}
}

func TestHTTPResponsesRequestDoesNotMarshalGenerate(t *testing.T) {
	var req dto.OpenAIResponsesRequest
	require.NoError(t, common.Unmarshal([]byte(`{"model":"gpt-5.3-codex-spark","input":"hi","generate":false}`), &req))
	got, err := common.Marshal(req)
	require.NoError(t, err)
	var data map[string]any
	require.NoError(t, common.Unmarshal(got, &data))
	assert.NotContains(t, data, "generate")
}

func TestBuildResponsesWSErrorPayloadIncludesStatus(t *testing.T) {
	payload, err := buildResponsesWSErrorPayload("evt_err", types.NewErrorWithStatusCode(
		errors.New("model is required"),
		types.ErrorCodeInvalidRequest,
		http.StatusBadRequest,
		types.ErrOptionWithSkipRetry(),
	))
	require.NoError(t, err)
	var data struct {
		Type    string             `json:"type"`
		Status  int                `json:"status"`
		EventID string             `json:"event_id"`
		Error   *types.OpenAIError `json:"error"`
	}
	require.NoError(t, common.Unmarshal(payload, &data))
	assert.Equal(t, "error", data.Type)
	assert.Equal(t, http.StatusBadRequest, data.Status)
	assert.Equal(t, "evt_err", data.EventID)
	require.NotNil(t, data.Error)
	assert.Equal(t, string(types.ErrorCodeInvalidRequest), data.Error.Code)
}

func TestResponsesWSInvalidRequestErrorUsesBadRequestStatus(t *testing.T) {
	payload, err := buildResponsesWSErrorPayload("", newResponsesWSInvalidRequestError(errors.New("bad event")))
	require.NoError(t, err)
	var data struct {
		Status int `json:"status"`
	}
	require.NoError(t, common.Unmarshal(payload, &data))
	assert.Equal(t, http.StatusBadRequest, data.Status)
}

func TestRemoveResponsesWSTransportFields(t *testing.T) {
	payload := []byte(`{
		"model": "gpt-5.3-codex-spark",
		"seed": 9007199254740993,
		"temperature": 0.1234567890123456789,
		"stream": true,
		"background": true,
		"stream_options": {"include_usage": true},
		"store": false
	}`)

	got, err := removeResponsesWSTransportFields(payload)
	require.NoError(t, err)
	var data map[string]common.RawMessage
	require.NoError(t, common.Unmarshal(got, &data))
	for _, key := range []string{"stream", "background", "stream_options"} {
		assert.NotContains(t, data, key)
	}
	assert.JSONEq(t, "false", string(data["store"]))
	assert.Equal(t, "9007199254740993", string(data["seed"]))
	assert.Equal(t, "0.1234567890123456789", string(data["temperature"]))
}

func TestToWebSocketURL(t *testing.T) {
	tests := map[string]string{
		"https://api.openai.com/v1/responses":             "wss://api.openai.com/v1/responses",
		"http://127.0.0.1:3000/v1/responses":              "ws://127.0.0.1:3000/v1/responses",
		"wss://chatgpt.com/backend-api/codex/responses":   "wss://chatgpt.com/backend-api/codex/responses",
		"ws://127.0.0.1:3000/backend-api/codex/responses": "ws://127.0.0.1:3000/backend-api/codex/responses",
	}

	for input, want := range tests {
		assert.Equal(t, want, toWebSocketURL(input))
	}
}

func TestApplyResponsesWSUpstreamHeaders(t *testing.T) {
	t.Run("Codex requires WebSocket v2 beta", func(t *testing.T) {
		header := http.Header{"Openai-Beta": []string{"responses=experimental"}}
		applyResponsesWSUpstreamHeaders(header, appconstant.ChannelTypeCodex)
		assert.Equal(t, responsesWSV2BetaHeaderValue, header.Get("OpenAI-Beta"))
	})

	t.Run("OpenAI header is not forced", func(t *testing.T) {
		header := http.Header{}
		applyResponsesWSUpstreamHeaders(header, appconstant.ChannelTypeOpenAI)
		assert.Empty(t, header.Get("OpenAI-Beta"))
	})
}

func TestCheckResponsesWSModelAccess(t *testing.T) {
	t.Run("restricted model is rejected", func(t *testing.T) {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		common.SetContextKey(c, appconstant.ContextKeyTokenModelLimitEnabled, true)
		common.SetContextKey(c, appconstant.ContextKeyTokenModelLimit, map[string]bool{"gpt-5.3-codex": true})
		apiErr := checkResponsesWSModelAccess(c, "gpt-5.5")
		require.NotNil(t, apiErr)
		assert.Equal(t, http.StatusForbidden, apiErr.StatusCode)
	})

	t.Run("specific channel follows existing distributor semantics", func(t *testing.T) {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		common.SetContextKey(c, appconstant.ContextKeyTokenSpecificChannelId, "10")
		common.SetContextKey(c, appconstant.ContextKeyTokenModelLimitEnabled, true)
		common.SetContextKey(c, appconstant.ContextKeyTokenModelLimit, map[string]bool{})
		assert.Nil(t, checkResponsesWSModelAccess(c, "gpt-5.5"))
	})
}

func TestDialResponsesWebSocketUpstreamUsesCodexV2Headers(t *testing.T) {
	t.Setenv("NO_PROXY", "*")
	t.Setenv("no_proxy", "*")
	receivedHeaders := make(chan http.Header, 1)
	upgrader := websocket.Upgrader{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/backend-api/codex/responses", r.URL.Path)
		receivedHeaders <- r.Header.Clone()
		conn, err := upgrader.Upgrade(w, r, nil)
		if assert.NoError(t, err) {
			defer conn.Close()
		}
	}))
	defer server.Close()

	request := httptest.NewRequest(http.MethodGet, "/v1/responses", nil)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = request
	info := &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeResponses,
		IsStream:  true,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:    appconstant.ChannelTypeCodex,
			ChannelBaseUrl: server.URL,
			ApiKey:         `{"access_token":"access-test","account_id":"account-test"}`,
		},
	}

	target, apiErr := dialResponsesWebSocketUpstream(c, &codex.Adaptor{}, info)
	require.Nil(t, apiErr)
	require.NotNil(t, target)
	defer target.Close()
	header := <-receivedHeaders
	assert.Equal(t, responsesWSV2BetaHeaderValue, header.Get("OpenAI-Beta"))
	assert.Equal(t, "Bearer access-test", header.Get("Authorization"))
	assert.Equal(t, "account-test", header.Get("ChatGPT-Account-ID"))
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

	require.NotNil(t, apiErr)
	assert.Nil(t, session.target)
	assert.Nil(t, session.getCurrent())
	require.NotNil(t, committed)
	assert.False(t, *committed)
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
	assert.Nil(t, apiErr)
	assert.Nil(t, session.target)

	require.NoError(t, clientConn.SetReadDeadline(time.Now().Add(time.Second)))
	_, payload, err := clientConn.ReadMessage()
	require.NoError(t, err)
	var data struct {
		Type   string `json:"type"`
		Status int    `json:"status"`
	}
	require.NoError(t, common.Unmarshal(payload, &data))
	assert.Equal(t, "error", data.Type)
	assert.NotZero(t, data.Status)
}

func TestObserveUpstreamFailureReleasesCurrent(t *testing.T) {
	for _, eventType := range []string{"response.failed", "response.error", "response.cancelled", "response.canceled", "error"} {
		t.Run(eventType, func(t *testing.T) {
			commits := 0
			var committed bool
			session := &responsesWSSession{}
			state := &responsesWSCallState{
				info: &relaycommon.RelayInfo{},
				commitRate: func(success bool) {
					commits++
					committed = success
				},
			}
			session.current = state

			session.observeUpstreamMessage([]byte(fmt.Sprintf(`{"type":%q}`, eventType)))
			session.finishCall(state, false)

			assert.Nil(t, session.getCurrent())
			assert.Equal(t, 1, commits)
			assert.False(t, committed)
		})
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
			assert.NoError(t, err)
			close(serverConnCh)
			return
		}
		serverConnCh <- conn
	}))

	targetURL := "ws" + strings.TrimPrefix(server.URL, "http")
	target, _, err := websocket.DefaultDialer.Dial(targetURL, nil)
	require.NoError(t, err)
	serverConn := <-serverConnCh
	require.NotNil(t, serverConn)
	cleanup := func() {
		_ = target.Close()
		_ = serverConn.Close()
		server.Close()
	}
	return target, serverConn, cleanup
}
