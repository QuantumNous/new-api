package router

import (
	"bytes"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"hash/crc32"
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel/providerplugin"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

// gapsChatHelpers build OpenAI chat replies in plugin code.
const gapsChatHelpers = `
function usageOf(input, output) { return {prompt_tokens: input, completion_tokens: output, total_tokens: input + output}; }
function chatReply(text, usage) {
  return {id: "chatcmpl-g", object: "chat.completion", created: 1730000000, model: "gpt-4o-mini",
    choices: [{index: 0, message: {role: "assistant", content: text}, finish_reason: "stop"}], usage: usage};
}
function chatChunk(delta, finish, usage) {
  const value = {id: "chatcmpl-g", object: "chat.completion.chunk", created: 1730000000, model: "gpt-4o-mini", choices: usage ? [] : [{index: 0, delta: delta, finish_reason: finish}]};
  if (usage) value.usage = usage;
  return {data: value};
}
`

func consumeLogCount(t *testing.T) int64 {
	t.Helper()
	var count int64
	require.NoError(t, model.LOG_DB.Model(&model.Log{}).Where("type = ?", model.LogTypeConsume).Count(&count).Error)
	return count
}

// jobPlugin creates a job, polls it until it is done and answers with its
// result. Every request is signed over its method and body.
const jobPlugin = `
export const meta = {apiVersion: 1, key: "gaps-chain", name: "Chain", version: "1.0.0", author: {name: "Test"}, relay: [
  {incoming_path: "/v1/chat/completions", upstream_path: "/jobs", converter: "plugin", auth: {type: "header", name: "X-Vendor-Key", value: "key {api_key}"}}
]};
export function convertRequest(ctx, req) {
  return {body: {prompt: req.body.messages[0].content}, state: {polls: 0}};
}
export function convertResponse(ctx, resp) {
  const job = JSON.parse(resp.body);
  if (job.status !== "done") return {next: {method: "GET", path: "/poll/" + job.id}, state: {polls: ctx.state.polls + 1}};
  return {body: chatReply(job.text + " after " + ctx.state.polls + " polls", usageOf(job.input, job.output))};
}
export function convertStreamEvent() { return {}; }
export function signRequest(ctx, req) { return {headers: {"X-Signed": req.method + " " + req.bodySha256}}; }
` + gapsChatHelpers

// jobVendor creates job-1 and reports it running for runningPolls polls,
// then done.
func jobVendor(runningPolls int) func(w http.ResponseWriter, attempt int, request capturedRequest) {
	return func(w http.ResponseWriter, attempt int, request capturedRequest) {
		w.Header().Set("Content-Type", "application/json")
		switch {
		case request.URL == "/jobs":
			_, _ = io.WriteString(w, `{"id":"job-1","status":"queued"}`)
		case attempt-1 <= runningPolls:
			_, _ = io.WriteString(w, `{"id":"job-1","status":"running"}`)
		default:
			_, _ = io.WriteString(w, `{"id":"job-1","status":"done","text":"finished","input":1000,"output":2000}`)
		}
	}
}

func TestGapsChainedRequests(t *testing.T) {
	t.Run("create poll and result", func(t *testing.T) {
		harness := newRelayHarness(t)
		registerRelayPlugin(t, jobPlugin)
		harness.upstream.respond = jobVendor(1)
		harness.install(t, harness.pluginChannel("gaps-chain", "sk-static"))

		outcome := harness.post(t, "/v1/chat/completions", relayTestBody)

		require.Equal(t, http.StatusOK, outcome.status, outcome.body)
		assert.Contains(t, outcome.body, `"content":"finished after 2 polls"`, "the state goes from step to step")
		requests := harness.upstream.captured()
		require.Len(t, requests, 3)
		for index, want := range []struct{ method, url string }{{http.MethodPost, "/jobs"}, {http.MethodGet, "/poll/job-1"}, {http.MethodGet, "/poll/job-1"}} {
			request := requests[index]
			assert.Equal(t, want.method, request.Method)
			assert.Equal(t, want.url, request.URL)
			assert.Equal(t, "key sk-static", request.Header.Get("X-Vendor-Key"), "the route auth applies to every step")
			sum := sha256.Sum256([]byte(request.Body))
			assert.Equal(t, want.method+" "+hex.EncodeToString(sum[:]), request.Header.Get("X-Signed"), "every step is signed over its own bytes")
		}
		assert.JSONEq(t, `{"prompt":"hello there"}`, requests[0].Body)
		for _, poll := range requests[1:] {
			assert.Empty(t, poll.Body)
			assert.Empty(t, poll.Header.Get("Content-Type"), "a GET carries no content type")
		}
		assert.EqualValues(t, 1000, outcome.log.PromptTokens)
		assert.EqualValues(t, 2000, outcome.log.CompletionTokens)
		assert.Positive(t, outcome.quota)
		assert.Equal(t, outcome.log.Quota, outcome.quota)
		assert.EqualValues(t, 1, consumeLogCount(t), "the chain is one billed call")
	})

	t.Run("too many follow-ups fail the call", func(t *testing.T) {
		harness := newRelayHarness(t)
		registerRelayPlugin(t, jobPlugin)
		harness.upstream.respond = jobVendor(1000)
		harness.install(t, harness.pluginChannel("gaps-chain", "sk-static"))

		outcome := harness.post(t, "/v1/chat/completions", relayTestBody)

		assert.GreaterOrEqual(t, outcome.status, http.StatusBadRequest, outcome.body)
		assert.Contains(t, outcome.body, fmt.Sprintf("chained more than %d requests", providerplugin.MaxFollowUps))
		assert.Len(t, harness.upstream.captured(), 1+providerplugin.MaxFollowUps)
		assert.Zero(t, outcome.quota)
		assert.Zero(t, consumeLogCount(t))
	})
}

// A first request that uploads the client's text, then the main request that
// names the upload.
func TestGapsUploadThenRequest(t *testing.T) {
	harness := newRelayHarness(t)
	registerRelayPlugin(t, `
export const meta = {apiVersion: 1, key: "gaps-upload", name: "Upload", version: "1.0.0", author: {name: "Test"}, relay: [
  {incoming_path: "/v1/chat/completions", upstream_path: "/unused", converter: "plugin"}
]};
export function convertRequest(ctx, req) {
  return {path: "/files", body: req.body.messages[0].content, contentType: "text/plain", state: {model: req.model}};
}
export function convertResponse(ctx, resp) {
  const body = JSON.parse(resp.body);
  if (body.file_id) return {next: {path: "/generate", body: {file: body.file_id, model: ctx.state.model}}, state: {file: body.file_id}};
  return {body: chatReply(ctx.state.file + ": " + body.text, usageOf(body.input, body.output))};
}
export function convertStreamEvent() { return {}; }
`+gapsChatHelpers)
	harness.upstream.respond = func(w http.ResponseWriter, _ int, request capturedRequest) {
		w.Header().Set("Content-Type", "application/json")
		if request.URL == "/files" {
			_, _ = io.WriteString(w, `{"file_id":"file-7"}`)
			return
		}
		_, _ = io.WriteString(w, `{"text":"described","input":1000,"output":2000}`)
	}
	harness.install(t, harness.pluginChannel("gaps-upload", "sk-static"))

	outcome := harness.post(t, "/v1/chat/completions", relayTestBody)

	require.Equal(t, http.StatusOK, outcome.status, outcome.body)
	assert.Contains(t, outcome.body, `"content":"file-7: described"`)
	requests := harness.upstream.captured()
	require.Len(t, requests, 2)
	assert.Equal(t, http.MethodPost, requests[0].Method)
	assert.Equal(t, "/files", requests[0].URL)
	assert.Equal(t, "hello there", requests[0].Body)
	assert.Equal(t, "text/plain", requests[0].Header.Get("Content-Type"))
	assert.Equal(t, http.MethodPost, requests[1].Method, "a next request with a body is a POST")
	assert.Equal(t, "/generate", requests[1].URL)
	assert.JSONEq(t, `{"file":"file-7","model":"`+relayTestModel+`"}`, requests[1].Body)
	assert.Equal(t, "application/json", requests[1].Header.Get("Content-Type"))
	for _, request := range requests {
		assert.Equal(t, "Bearer sk-static", request.Header.Get("Authorization"))
	}
	assert.EqualValues(t, 1000, outcome.log.PromptTokens)
	assert.EqualValues(t, 2000, outcome.log.CompletionTokens)
	assert.Positive(t, outcome.quota)
	assert.Equal(t, outcome.log.Quota, outcome.quota)
}

// webSocketVendor is an upstream WebSocket session: it reads the two opening
// messages, sends a delta as text and one as a binary frame, reading the
// gateway's answer to each, sends a done frame and reads until the gateway
// closes the session. Its records are safe to read once done is closed.
type webSocketVendor struct {
	*httptest.Server
	handshake capturedRequest
	protocol  string
	received  []string
	closeCode int
	done      chan struct{}
}

func newWebSocketVendor(t *testing.T) *webSocketVendor {
	t.Helper()
	vendor := &webSocketVendor{done: make(chan struct{})}
	upgrader := websocket.Upgrader{Subprotocols: []string{"vendor.v1"}}
	vendor.Server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer close(vendor.done)
		vendor.handshake = capturedRequest{Method: r.Method, URL: r.URL.String(), Header: r.Header.Clone()}
		session, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		defer session.Close()
		_ = session.SetReadDeadline(time.Now().Add(10 * time.Second))
		vendor.protocol = session.Subprotocol()
		// receive records the next message and reports whether the session
		// is still open.
		receive := func() bool {
			messageType, data, err := session.ReadMessage()
			var closeErr *websocket.CloseError
			switch {
			case errors.As(err, &closeErr):
				vendor.closeCode = closeErr.Code
				return false
			case err != nil:
				vendor.received = append(vendor.received, "error: "+err.Error())
				return false
			case messageType == websocket.BinaryMessage:
				vendor.received = append(vendor.received, "binary "+base64.StdEncoding.EncodeToString(data))
			default:
				vendor.received = append(vendor.received, string(data))
			}
			return true
		}
		receive()
		receive()
		_ = session.WriteMessage(websocket.TextMessage, []byte(`{"type":"delta","text":"one"}`))
		receive()
		_ = session.WriteMessage(websocket.BinaryMessage, []byte(`{"type":"delta","text":"two"}`))
		receive()
		_ = session.WriteMessage(websocket.TextMessage, []byte(`{"type":"done","input":1000,"output":2000}`))
		for receive() {
		}
	}))
	t.Cleanup(vendor.Close)
	return vendor
}

func TestGapsUpstreamWebSocket(t *testing.T) {
	const source = `
export const meta = {apiVersion: 1, key: "gaps-ws", name: "WebSocket", version: "1.0.0", author: {name: "Test"}, relay: [
  {incoming_path: "/v1/chat/completions", upstream_path: "/unused", converter: "plugin"}
]};
export function convertRequest(ctx, req) {
  return {websocket: {path: "/realtime?model=" + req.model, headers: {"X-Session": "s1"}, protocols: ["vendor.v1"],
    messages: [req.body.messages[0].content, {bodyBase64: "AAFiaW4="}]}, state: {stream: req.stream, text: ""}};
}
export function convertResponse() { throw new Error("a WebSocket session has no response"); }
export function signRequest(ctx, req) { return {headers: {"X-Signed": req.method + " " + req.url}}; }
export function convertStreamEvent(ctx, input) {
  const state = ctx.state;
  if (input.done) return {};
  const frame = JSON.parse(input.data !== undefined ? input.data : atob(input.dataBase64));
  if (frame.type === "delta") {
    const result = {send: ["ack:" + frame.text], state: {stream: state.stream, text: state.text + frame.text}};
    if (state.stream) result.events = [chatChunk({role: "assistant", content: frame.text}, null)];
    return result;
  }
  const usage = usageOf(frame.input, frame.output);
  if (state.stream) return {close: true, events: [chatChunk({}, "stop"), chatChunk(null, null, usage), {data: "[DONE]"}]};
  // The body ends the session after the message sent with it.
  return {send: ["bye"], body: chatReply(state.text, usage)};
}
` + gapsChatHelpers
	for name, tc := range map[string]struct {
		body     string
		want     []string
		received []string
	}{
		"non-stream": {body: relayTestBody, want: []string{`"content":"onetwo"`}, received: []string{"hello there", "binary AAFiaW4=", "ack:one", "ack:two", "bye"}},
		"stream":     {body: strings.Replace(relayTestBody, `"max_tokens"`, `"stream":true,"max_tokens"`, 1), want: []string{`"content":"one"`, `"content":"two"`, "data: [DONE]"}, received: []string{"hello there", "binary AAFiaW4=", "ack:one", "ack:two"}},
	} {
		t.Run(name, func(t *testing.T) {
			harness := newRelayHarness(t)
			registerRelayPlugin(t, source)
			vendor := newWebSocketVendor(t)
			channel := harness.pluginChannel("gaps-ws", "sk-static")
			channel.BaseURL = &vendor.URL
			harness.install(t, channel)

			outcome := harness.post(t, "/v1/chat/completions", tc.body)

			require.Equal(t, http.StatusOK, outcome.status, outcome.body)
			select {
			case <-vendor.done:
			case <-time.After(5 * time.Second):
				t.Fatal("the vendor session did not end")
			}
			for _, want := range tc.want {
				assert.Contains(t, outcome.body, want)
			}
			handshake := vendor.handshake
			assert.Equal(t, http.MethodGet, handshake.Method)
			assert.Equal(t, "/realtime?model="+relayTestModel, handshake.URL)
			assert.Equal(t, "Bearer sk-static", handshake.Header.Get("Authorization"), "the route auth applies to the handshake")
			assert.Equal(t, "s1", handshake.Header.Get("X-Session"))
			assert.True(t, strings.HasPrefix(handshake.Header.Get("X-Signed"), "GET "), handshake.Header.Get("X-Signed"))
			assert.True(t, strings.HasSuffix(handshake.Header.Get("X-Signed"), "/realtime?model="+relayTestModel), handshake.Header.Get("X-Signed"))
			assert.Equal(t, "vendor.v1", vendor.protocol)
			assert.Equal(t, tc.received, vendor.received)
			assert.Equal(t, websocket.CloseNormalClosure, vendor.closeCode, "close: true or a body ends the session with a normal close")
			assert.EqualValues(t, 1000, outcome.log.PromptTokens)
			assert.EqualValues(t, 2000, outcome.log.CompletionTokens)
			assert.Positive(t, outcome.quota)
			assert.Equal(t, outcome.log.Quota, outcome.quota)
		})
	}
}

func TestGapsConfigAddressesAndURLs(t *testing.T) {
	const configSource = `
export const meta = {apiVersion: 1, key: "gaps-config", name: "Config", version: "1.0.0", author: {name: "Test"},
  channelConfig: {type: "object", properties: {searchUrl: {type: "string", format: "url", title: {en: "Search address"}}}},
  relay: [{incoming_path: "/v1/chat/completions", upstream_path: "{config.searchUrl}/v2/chat"}]};`
	for name, tc := range map[string]struct {
		config string
		// onOther is set when the request goes to the address in the config.
		onOther bool
	}{
		"an address in the config": {config: `{"searchUrl":"%OTHER%/api/"}`, onOther: true},
		"an empty address":         {config: `{"searchUrl":""}`},
	} {
		t.Run(name, func(t *testing.T) {
			harness := newRelayHarness(t)
			other := newFakeUpstream(t)
			registerRelayPlugin(t, configSource)
			channel := harness.pluginChannel("gaps-config", "sk-static")
			channel.SetOtherSettings(dto.ChannelOtherSettings{PluginConfig: json.RawMessage(strings.ReplaceAll(tc.config, "%OTHER%", other.URL))})
			harness.install(t, channel)

			outcome := harness.post(t, "/v1/chat/completions", relayTestBody)

			require.Equal(t, http.StatusOK, outcome.status, outcome.body)
			reached, missed, wantURL := harness.upstream, other, "/v2/chat"
			if tc.onOther {
				reached, missed, wantURL = other, harness.upstream, "/api/v2/chat"
			}
			requests := reached.captured()
			require.Len(t, requests, 1)
			assert.Equal(t, wantURL, requests[0].URL)
			assert.Equal(t, "Bearer sk-static", requests[0].Header.Get("Authorization"))
			assert.Empty(t, missed.captured())
			assert.Positive(t, outcome.quota)
		})
	}

	t.Run("a convertRequest url", func(t *testing.T) {
		harness := newRelayHarness(t)
		other := newFakeUpstream(t)
		registerRelayPlugin(t, strings.ReplaceAll(`
export const meta = {apiVersion: 1, key: "gaps-url", name: "URL", version: "1.0.0", author: {name: "Test"}, relay: [
  {incoming_path: "/v1/chat/completions", upstream_path: "/chat", converter: "plugin", auth: {type: "header", name: "X-Vendor-Key", value: "key {api_key}"}}
]};
export function convertRequest(ctx, req) { return {body: req.body, url: "%OTHER%/v9/generate?region=eu"}; }
export function signRequest(ctx, req) { return {headers: {"X-Signed-Url": req.url}}; }
`, "%OTHER%", other.URL)+passThroughConverters)
		harness.install(t, harness.pluginChannel("gaps-url", "sk-static"))

		outcome := harness.post(t, "/v1/chat/completions", relayTestBody)

		require.Equal(t, http.StatusOK, outcome.status, outcome.body)
		assert.Empty(t, harness.upstream.captured())
		requests := other.captured()
		require.Len(t, requests, 1)
		assert.Equal(t, "/v9/generate?region=eu", requests[0].URL)
		assert.Equal(t, "key sk-static", requests[0].Header.Get("X-Vendor-Key"))
		assert.Equal(t, other.URL+"/v9/generate?region=eu", requests[0].Header.Get("X-Signed-Url"))
		assert.Positive(t, outcome.quota)
	})

	t.Run("a prepareRequest url on a native route", func(t *testing.T) {
		harness := newRelayHarness(t)
		other := newFakeUpstream(t)
		registerRelayPlugin(t, strings.ReplaceAll(`
export const meta = {apiVersion: 1, key: "gaps-prepare-url", name: "URL", version: "1.0.0", author: {name: "Test"}, relay: [
  {incoming_path: "/v1/chat/completions", upstream_path: "/chat", auth: {type: "query", name: "key", value: "{api_key}"}}
]};
export function prepareRequest(ctx, req) { return {url: "%OTHER%/native/" + req.model + "/chat"}; }
`, "%OTHER%", other.URL))
		harness.install(t, harness.pluginChannel("gaps-prepare-url", "sk-static"))

		outcome := harness.post(t, "/v1/chat/completions", relayTestBody)

		require.Equal(t, http.StatusOK, outcome.status, outcome.body)
		assert.Empty(t, harness.upstream.captured())
		requests := other.captured()
		require.Len(t, requests, 1)
		assert.Equal(t, "/native/"+relayTestModel+"/chat?key=sk-static", requests[0].URL)
		assert.Contains(t, outcome.body, `"content":"hi"`)
		assert.Positive(t, outcome.quota)
	})
}

// exchangePlugin exchanges the channel key at /token for a token it sends as
// the bearer: a 403 there is a revoked key, any other failure a throw.
const exchangePlugin = `
export const meta = {apiVersion: 1, key: "gaps-exchange", name: "Exchange", version: "1.0.0", author: {name: "Test"}, relay: [
  {incoming_path: "/v1/chat/completions", upstream_path: "/chat", auth: {type: "none"}}
]};
export function exchangeKey(ctx) {
  const response = utils.fetch({url: ctx.baseUrl + "/token", method: "POST", body: JSON.stringify({key: ctx.apiKey})});
  if (response.status === 403) return {error: {status: 401, message: "key revoked"}};
  if (response.status !== 200) throw new Error("exchange failed with " + response.status);
  return {token: {access: response.body.token}, expiresAt: utils.unixNow() + 3600};
}
export function signRequest(ctx, req) { return {headers: {Authorization: "Bearer " + ctx.token.access}}; }
`

func TestGapsKeyExchange(t *testing.T) {
	previousAutoDisable := common.AutomaticDisableChannelEnabled
	common.AutomaticDisableChannelEnabled = true
	t.Cleanup(func() { common.AutomaticDisableChannelEnabled = previousAutoDisable })
	for name, tc := range map[string]struct {
		// tokenStatus is the status of the exchange endpoint, 200 when 0.
		tokenStatus int
		// rejected tells the bearers the vendor answers with a 401.
		rejected func(bearer string) bool
		posts    int
		status   int
		// exchanges and sends are the requests to /token and /chat.
		exchanges, sends int32
		disabled         bool
	}{
		"a token serves many requests":        {posts: 2, status: http.StatusOK, exchanges: 1, sends: 2},
		"a rejected token is exchanged again": {rejected: func(bearer string) bool { return bearer == "Bearer tok-1" }, posts: 1, status: http.StatusOK, exchanges: 2, sends: 2},
		"a second rejection is an error":      {rejected: func(string) bool { return true }, posts: 1, status: http.StatusUnauthorized, exchanges: 2, sends: 2, disabled: true},
		"a returned error is a channel error": {tokenStatus: http.StatusForbidden, posts: 1, status: http.StatusUnauthorized, exchanges: 1, disabled: true},
		"a throw keeps the channel":           {tokenStatus: http.StatusBadGateway, posts: 1, status: http.StatusInternalServerError, exchanges: 1},
	} {
		t.Run(name, func(t *testing.T) {
			harness := newRelayHarness(t)
			registerRelayPlugin(t, exchangePlugin)
			var exchanges, sends atomic.Int32
			harness.upstream.respond = func(w http.ResponseWriter, _ int, request capturedRequest) {
				w.Header().Set("Content-Type", "application/json")
				if request.URL == "/token" {
					count := exchanges.Add(1)
					if tc.tokenStatus != 0 {
						w.WriteHeader(tc.tokenStatus)
						_, _ = io.WriteString(w, `{}`)
						return
					}
					_, _ = fmt.Fprintf(w, `{"token":"tok-%d"}`, count)
					return
				}
				sends.Add(1)
				if tc.rejected != nil && tc.rejected(request.Header.Get("Authorization")) {
					w.WriteHeader(http.StatusUnauthorized)
					_, _ = io.WriteString(w, `{"error":{"message":"token expired","type":"auth"}}`)
					return
				}
				writeChat(w, request)
			}
			// The token cache outlives the test database: a key line of its own
			// starts it empty.
			key := "sk-exchange-" + strconv.FormatInt(time.Now().UnixNano(), 10)
			channel := harness.install(t, harness.pluginChannel("gaps-exchange", key))

			var outcome relayOutcome
			for range tc.posts {
				outcome = harness.post(t, "/v1/chat/completions", relayTestBody)
				assert.Equal(t, tc.status, outcome.status, outcome.body)
			}

			assert.Equal(t, tc.exchanges, exchanges.Load())
			assert.Equal(t, tc.sends, sends.Load())
			requests := harness.upstream.captured()
			for _, request := range requestsTo(requests, "/token") {
				assert.JSONEq(t, `{"key":"`+key+`"}`, request.Body)
			}
			chats := requestsTo(requests, "/chat")
			for index, request := range chats {
				assert.Equal(t, relayTestBody, request.Body, "a resend carries the same body")
				if tc.exchanges > 1 {
					assert.Equal(t, fmt.Sprintf("Bearer tok-%d", index+1), request.Header.Get("Authorization"), "the resend has the new token")
				} else {
					assert.Equal(t, "Bearer tok-1", request.Header.Get("Authorization"))
				}
			}
			assert.NotContains(t, outcome.body, "exchange failed with", "a thrown message stays in the gateway")
			if tc.status == http.StatusOK {
				assert.Positive(t, outcome.quota)
			} else {
				assert.Zero(t, outcome.quota)
			}
			stored, err := model.GetChannelById(channel.Id, true)
			require.NoError(t, err)
			if tc.disabled {
				assert.Equal(t, common.ChannelStatusAutoDisabled, stored.Status)
			} else {
				assert.Equal(t, common.ChannelStatusEnabled, stored.Status)
			}
		})
	}
}

// The web_search calls a converter counts are billed at the tool price, once
// per call, as the built-in vendors' tool usage is.
func TestGapsToolCounts(t *testing.T) {
	const source = `
export const meta = {apiVersion: 1, key: "gaps-tools", name: "Tools", version: "1.0.0", author: {name: "Test"}, relay: [
  {incoming_path: "/v1/chat/completions", upstream_path: "/generate", converter: "plugin"}
]};
export function convertRequest(ctx, req) { return {body: {prompt: "hello there", stream: req.stream}}; }
export function convertResponse(ctx, resp) {
  const body = JSON.parse(resp.body);
  const result = {body: chatReply(body.text, usageOf(1000, 2000))};
  if (body.searches) result.tools = {web_search: body.searches};
  return result;
}
export function convertStreamEvent(ctx, input) {
  if (input.done) return {events: [chatChunk({}, "stop"), chatChunk(null, null, usageOf(1000, 2000)), {data: "[DONE]"}]};
  const body = JSON.parse(input.data);
  return {events: [chatChunk({role: "assistant", content: body.text}, null)], tools: {web_search: body.searches}};
}
` + gapsChatHelpers
	price := operation_setting.GetToolPriceForModel(dto.BuildInToolWebSearch, relayTestModel)
	require.Positive(t, price)
	wantSurcharges := fmt.Sprintf(`[{"name":"web_search","count":2,"price":%v}]`, price)
	harness := newRelayHarness(t)
	registerRelayPlugin(t, source)
	harness.install(t, harness.pluginChannel("gaps-tools", "sk-static"))

	t.Run("reply", func(t *testing.T) {
		harness.upstream.respond = respondWith(http.StatusOK, "application/json", `{"text":"plain"}`)
		plain := harness.post(t, "/v1/chat/completions", relayTestBody)
		harness.upstream.respond = respondWith(http.StatusOK, "application/json", `{"text":"searched","searches":2}`)

		searched := harness.post(t, "/v1/chat/completions", relayTestBody)

		require.Equal(t, http.StatusOK, plain.status, plain.body)
		require.Equal(t, http.StatusOK, searched.status, searched.body)
		assert.False(t, gjson.Get(plain.log.Other, "tool_surcharges").Exists())
		assert.JSONEq(t, wantSurcharges, gjson.Get(searched.log.Other, "tool_surcharges").Raw)
		assert.Equal(t, plain.log.PromptTokens, searched.log.PromptTokens)
		assert.Equal(t, plain.log.CompletionTokens, searched.log.CompletionTokens)
		assert.InDelta(t, 2*price/1000*common.QuotaPerUnit, float64(searched.quota-plain.quota), 1, "two calls at the tool price")
		assert.Equal(t, searched.log.Quota, searched.quota)
	})

	t.Run("stream", func(t *testing.T) {
		harness.upstream.respond = respondWith(http.StatusOK, "text/event-stream", "data: {\"text\":\"one\",\"searches\":1}\n\ndata: {\"text\":\"two\",\"searches\":1}\n\n")

		outcome := harness.post(t, "/v1/chat/completions", strings.Replace(relayTestBody, `"max_tokens"`, `"stream":true,"max_tokens"`, 1))

		require.Equal(t, http.StatusOK, outcome.status, outcome.body)
		assert.JSONEq(t, wantSurcharges, gjson.Get(outcome.log.Other, "tool_surcharges").Raw, "the counts of the events add up")
		assert.Positive(t, outcome.quota)
		assert.Equal(t, outcome.log.Quota, outcome.quota)
	})
}

// eventStreamFrame is one AWS event stream message: the prelude with its CRC,
// string headers, the payload and the message CRC. An exception message
// names its type in :exception-type.
func eventStreamFrame(messageType, eventType, payload string) []byte {
	typeHeader := ":event-type"
	if messageType == "exception" {
		typeHeader = ":exception-type"
	}
	var headers bytes.Buffer
	for _, header := range [][2]string{{typeHeader, eventType}, {":message-type", messageType}, {":content-type", "application/json"}} {
		headers.WriteByte(byte(len(header[0])))
		headers.WriteString(header[0])
		headers.WriteByte(7)
		headers.Write(binary.BigEndian.AppendUint16(nil, uint16(len(header[1]))))
		headers.WriteString(header[1])
	}
	frame := binary.BigEndian.AppendUint32(nil, uint32(12+headers.Len()+len(payload)+4))
	frame = binary.BigEndian.AppendUint32(frame, uint32(headers.Len()))
	frame = binary.BigEndian.AppendUint32(frame, crc32.ChecksumIEEE(frame))
	frame = append(frame, headers.Bytes()...)
	frame = append(frame, payload...)
	return binary.BigEndian.AppendUint32(frame, crc32.ChecksumIEEE(frame))
}

func TestGapsAWSEventStream(t *testing.T) {
	const source = `
export const meta = {apiVersion: 1, key: "gaps-eventstream", name: "Event stream", version: "1.0.0", author: {name: "Test"}, relay: [
  {incoming_path: "/v1/chat/completions", upstream_path: "/converse-stream", converter: "plugin"}
]};
export function convertRequest(ctx, req) { return {body: {prompt: req.body.messages[0].content}}; }
export function convertResponse() { throw new Error("the vendor always streams"); }
export function convertStreamEvent(ctx, input) {
  const state = ctx.state || {sent: 0};
  if (input.done) return {events: [chatChunk({}, "stop"), chatChunk(null, null, usageOf(1000, state.sent)), {data: "[DONE]"}]};
  const body = JSON.parse(input.data);
  if (input.event === "throttlingException") return {error: {status: 429, message: body.message}};
  return {events: [chatChunk({role: "assistant", content: input.event + ":" + body.text}, null)], state: {sent: state.sent + 1000}};
}
` + gapsChatHelpers
	streamBody := strings.Replace(relayTestBody, `"max_tokens"`, `"stream":true,"max_tokens"`, 1)
	one := eventStreamFrame("event", "contentBlockDelta", `{"text":"one"}`)
	two := eventStreamFrame("event", "contentBlockDelta", `{"text":"two"}`)
	badCRC := bytes.Clone(two)
	badCRC[len(badCRC)-1] ^= 0xff
	newVendor := func(t *testing.T, frames ...[]byte) relayOutcome {
		t.Helper()
		harness := newRelayHarness(t)
		registerRelayPlugin(t, source)
		harness.upstream.respond = respondWith(http.StatusOK, "application/vnd.amazon.eventstream", string(bytes.Join(frames, nil)))
		harness.install(t, harness.pluginChannel("gaps-eventstream", "sk-static"))
		return harness.post(t, "/v1/chat/completions", streamBody)
	}

	t.Run("messages become events", func(t *testing.T) {
		outcome := newVendor(t, one, two)

		require.Equal(t, http.StatusOK, outcome.status, outcome.body)
		assert.True(t, strings.HasPrefix(outcome.header.Get("Content-Type"), "text/event-stream"))
		assert.Contains(t, outcome.body, `"content":"contentBlockDelta:one"`)
		assert.Contains(t, outcome.body, `"content":"contentBlockDelta:two"`)
		assert.Contains(t, outcome.body, "data: [DONE]")
		assert.EqualValues(t, 1000, outcome.log.PromptTokens)
		assert.EqualValues(t, 2000, outcome.log.CompletionTokens)
		assert.Positive(t, outcome.quota)
		assert.Equal(t, outcome.log.Quota, outcome.quota)
	})

	t.Run("an exception is a plugin error", func(t *testing.T) {
		outcome := newVendor(t, eventStreamFrame("exception", "throttlingException", `{"message":"slow down"}`))

		assert.Equal(t, http.StatusTooManyRequests, outcome.status, outcome.body)
		assert.Contains(t, outcome.body, "slow down")
		assert.Zero(t, outcome.quota)
	})

	t.Run("a bad message CRC before any output fails the call", func(t *testing.T) {
		outcome := newVendor(t, badCRC)

		assert.GreaterOrEqual(t, outcome.status, http.StatusBadRequest, outcome.body)
		assert.False(t, strings.HasPrefix(outcome.header.Get("Content-Type"), "text/event-stream"))
		assert.NotContains(t, outcome.body, "contentBlockDelta")
		assert.Zero(t, outcome.quota)
	})

	t.Run("a bad message CRC after output ends the stream", func(t *testing.T) {
		outcome := newVendor(t, one, badCRC, two)

		require.Equal(t, http.StatusOK, outcome.status, outcome.body)
		assert.Contains(t, outcome.body, `"content":"contentBlockDelta:one"`)
		assert.Equal(t, 1, strings.Count(outcome.body, "contentBlockDelta"), "nothing after the bad message is converted")
	})
}
