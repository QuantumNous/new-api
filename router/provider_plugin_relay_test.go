package router

import (
	"bytes"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"maps"
	"mime"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/textproto"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/QuantumNous/new-api/setting/request_plugin_setting"

	"github.com/bytedance/gopkg/util/gopool"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

const (
	relayTestToken = "providerrelaytoken"
	relayTestModel = "gpt-4o-mini"
	relayTestBody  = `{"model":"` + relayTestModel + `","messages":[{"role":"user","content":"hello there"}],"max_tokens":32}`
	chatReply      = `{"id":"chatcmpl-1","object":"chat.completion","created":1730000000,"model":"gpt-4o-mini","choices":[{"index":0,"message":{"role":"assistant","content":"hi"},"finish_reason":"stop"}],"usage":{"prompt_tokens":1000,"completion_tokens":2000,"total_tokens":3000}}`
	chatStream     = "data: {\"id\":\"chatcmpl-1\",\"object\":\"chat.completion.chunk\",\"created\":1730000000,\"model\":\"gpt-4o-mini\",\"choices\":[{\"index\":0,\"delta\":{\"role\":\"assistant\",\"content\":\"hi\"},\"finish_reason\":null}]}\n\n" +
		"data: {\"id\":\"chatcmpl-1\",\"object\":\"chat.completion.chunk\",\"created\":1730000000,\"model\":\"gpt-4o-mini\",\"choices\":[{\"index\":0,\"delta\":{},\"finish_reason\":\"stop\"}]}\n\n" +
		"data: {\"id\":\"chatcmpl-1\",\"object\":\"chat.completion.chunk\",\"created\":1730000000,\"model\":\"gpt-4o-mini\",\"choices\":[],\"usage\":{\"prompt_tokens\":1000,\"completion_tokens\":2000,\"total_tokens\":3000}}\n\n" +
		"data: [DONE]\n\n"
)

type capturedRequest struct {
	Method string
	URL    string
	Header http.Header
	Body   string
}

// fakeUpstream records every request and answers with respond.
type fakeUpstream struct {
	*httptest.Server
	mu       sync.Mutex
	requests []capturedRequest
	respond  func(w http.ResponseWriter, attempt int, request capturedRequest)
}

func newFakeUpstream(t *testing.T) *fakeUpstream {
	t.Helper()
	upstream := &fakeUpstream{respond: func(w http.ResponseWriter, _ int, request capturedRequest) { writeChat(w, request) }}
	upstream.Server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		request := capturedRequest{Method: r.Method, URL: r.URL.String(), Header: r.Header.Clone(), Body: string(body)}
		upstream.mu.Lock()
		upstream.requests = append(upstream.requests, request)
		attempt := len(upstream.requests)
		upstream.mu.Unlock()
		upstream.respond(w, attempt, request)
	}))
	t.Cleanup(upstream.Close)
	return upstream
}

func (u *fakeUpstream) captured() []capturedRequest {
	u.mu.Lock()
	defer u.mu.Unlock()
	return append([]capturedRequest(nil), u.requests...)
}

func (u *fakeUpstream) reset() {
	u.mu.Lock()
	defer u.mu.Unlock()
	u.requests = nil
}

func writeChat(w http.ResponseWriter, request capturedRequest) {
	if strings.Contains(request.Body, `"stream":true`) {
		w.Header().Set("Content-Type", "text/event-stream")
		_, _ = io.WriteString(w, chatStream)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_, _ = io.WriteString(w, chatReply)
}

type relayHarness struct {
	gateway  *httptest.Server
	upstream *fakeUpstream
	userID   int
	tokenID  int
	active   atomic.Int64
}

// waitIdle waits for the gateway's handlers and the background work they
// started, such as a refund, to finish: a client may read a whole reply
// before its handler settled the bill.
func (h *relayHarness) waitIdle(t *testing.T) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for h.active.Load() > 0 || gopool.WorkerCount() > 0 {
		if time.Now().After(deadline) {
			t.Fatal("the gateway did not finish its work")
		}
		time.Sleep(2 * time.Millisecond)
	}
}

func newRelayHarness(t *testing.T) *relayHarness {
	t.Helper()
	setupRelayRouterTestDB(t)
	require.NoError(t, i18n.Init())
	ratio_setting.InitRatioSettings()
	require.NoError(t, model.DB.AutoMigrate(&model.Channel{}, &model.Log{}, &model.Option{}, &model.Task{}, &model.QuotaData{},
		&model.UserSubscription{}, &model.SubscriptionPreConsumeRecord{}, &model.UserAccessToken{}))
	previousMemory, previousLog, previousBatch, previousTimeout := common.MemoryCacheEnabled, common.LogConsumeEnabled, common.BatchUpdateEnabled, constant.StreamingTimeout
	common.MemoryCacheEnabled, common.LogConsumeEnabled, common.BatchUpdateEnabled, constant.StreamingTimeout = true, true, false, 30
	t.Cleanup(func() {
		common.MemoryCacheEnabled, common.LogConsumeEnabled, common.BatchUpdateEnabled, constant.StreamingTimeout = previousMemory, previousLog, previousBatch, previousTimeout
	})
	service.InitHttpClient()
	user := model.User{Username: "provider-relay", Status: common.UserStatusEnabled, Group: "default", Quota: 100_000_000}
	require.NoError(t, model.DB.Create(&user).Error)
	token := model.Token{UserId: user.Id, Key: relayTestToken, Status: common.TokenStatusEnabled, ExpiredTime: -1, RemainQuota: 100_000_000, Group: "default"}
	require.NoError(t, model.DB.Create(&token).Error)
	engine := gin.New()
	SetRelayRouter(engine)
	SetTaskPluginProtocolRouter(engine)
	harness := &relayHarness{upstream: newFakeUpstream(t), userID: user.Id, tokenID: token.Id}
	harness.gateway = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		harness.active.Add(1)
		defer harness.active.Add(-1)
		engine.ServeHTTP(w, r)
	}))
	t.Cleanup(harness.gateway.Close)
	return harness
}

func (h *relayHarness) newChannel(channelType int, key string) *model.Channel {
	baseURL := h.upstream.URL
	return &model.Channel{Type: channelType, Key: key, Status: common.ChannelStatusEnabled, Name: "relay", Models: relayTestModel, Group: "default", BaseURL: &baseURL}
}

func (h *relayHarness) pluginChannel(pluginKey, key string) *model.Channel {
	channel := h.newChannel(constant.ChannelTypeTaskPlugin, key)
	channel.SetSetting(dto.ChannelSettings{TaskPluginKey: pluginKey})
	return channel
}

// install makes channel the only one and returns it stored.
func (h *relayHarness) install(t *testing.T, channel *model.Channel) *model.Channel {
	t.Helper()
	require.NoError(t, model.DB.Where("1 = 1").Delete(&model.Ability{}).Error)
	require.NoError(t, model.DB.Where("1 = 1").Delete(&model.Channel{}).Error)
	channel.Id = 0
	require.NoError(t, channel.Insert())
	model.InitChannelCache()
	return channel
}

type relayOutcome struct {
	status int
	header http.Header
	body   string
	quota  int
	log    model.Log
}

func (h *relayHarness) post(t *testing.T, path, body string) relayOutcome {
	t.Helper()
	return h.send(t, path, "application/json", body)
}

func (h *relayHarness) send(t *testing.T, path, contentType, body string) relayOutcome {
	t.Helper()
	var before model.Token
	require.NoError(t, model.DB.First(&before, h.tokenID).Error)
	var lastLog int
	require.NoError(t, model.LOG_DB.Model(&model.Log{}).Select("COALESCE(MAX(id), 0)").Scan(&lastLog).Error)

	request, err := http.NewRequest(http.MethodPost, h.gateway.URL+path, strings.NewReader(body))
	require.NoError(t, err)
	request.Header.Set("Authorization", "Bearer "+relayTestToken)
	request.Header.Set("Content-Type", contentType)
	request.Header.Set("X-Client-Trace", "trace-1")
	response, err := http.DefaultClient.Do(request)
	require.NoError(t, err)
	defer response.Body.Close()
	received, err := io.ReadAll(response.Body)
	require.NoError(t, err)
	h.waitIdle(t)

	outcome := relayOutcome{status: response.StatusCode, header: response.Header, body: string(received)}
	var after model.Token
	require.NoError(t, model.DB.First(&after, h.tokenID).Error)
	outcome.quota = before.RemainQuota - after.RemainQuota
	_ = model.LOG_DB.Where("id > ? AND type = ?", lastLog, model.LogTypeConsume).Order("id DESC").First(&outcome.log).Error
	return outcome
}

func registerRelayPlugin(t *testing.T, source string) *jsplugin.LoadedPlugin {
	t.Helper()
	plugin, err := jsplugin.DefaultRegistry.Register(source, jsplugin.Options{})
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, jsplugin.DefaultRegistry.Unregister(plugin.Meta.Key)) })
	return plugin
}

var volatileReplyFields = regexp.MustCompile(`"(id|created|created_at|response_id|item_id)":("[^"]*"|\d+)`)

func normalizedReply(text string) string {
	return volatileReplyFields.ReplaceAllString(text, `"$1":0`)
}

// A relay-only plugin is an Advanced Custom channel under another name: the
// same request reaches the upstream, the same reply reaches the client and the
// same usage is billed. The plugin's engine is removed for the run, so any
// JavaScript on the request path would crash it.
func TestRelayOnlyPluginMatchesAdvancedCustomChannel(t *testing.T) {
	const relayJS = `[
		{incoming_path: "/v1/chat/completions", upstream_path: "/openai/{model}/chat", auth: {type: "header", name: "X-Vendor-Key", value: "key {api_key}"}},
		{incoming_path: "/v1/responses", upstream_path: "/openai/chat/completions", converter: "openai_responses_to_openai_chat_completions"},
		{incoming_path: "/v1/embeddings", upstream_path: "/embed?api=1", auth: {type: "query", name: "key", value: "{api_key}"}}
	]`
	routes := []dto.AdvancedCustomRoute{
		{IncomingPath: "/v1/chat/completions", UpstreamPath: "/openai/{model}/chat", Auth: &dto.AdvancedCustomRouteAuth{Type: "header", Name: "X-Vendor-Key", Value: "key {api_key}"}},
		{IncomingPath: "/v1/responses", UpstreamPath: "/openai/chat/completions", Converter: "openai_responses_to_openai_chat_completions"},
		{IncomingPath: "/v1/embeddings", UpstreamPath: "/embed?api=1", Auth: &dto.AdvancedCustomRouteAuth{Type: "query", Name: "key", Value: "{api_key}"}},
	}
	harness := newRelayHarness(t)
	plugin := registerRelayPlugin(t, `export const meta = {apiVersion: 1, key: "relay-only", name: "Relay only", version: "1.0.0", author: {name: "Test"}, relay: `+relayJS+`};`)
	served, ok := jsplugin.DefaultRegistry.Get("relay-only")
	require.True(t, ok)
	require.Same(t, plugin, served, "the relay runs the plugin whose engine is removed")
	engine := plugin.Engine
	plugin.Engine = nil
	t.Cleanup(func() { plugin.Engine = engine })

	mapping, override, headers := `{"`+relayTestModel+`":"`+relayTestModel+`"}`, `{"temperature":0.5}`, `{"X-Static":"static","X-Key":"{api_key}","X-Pass":"{client_header:X-Client-Trace}"}`
	configure := func(channel *model.Channel) *model.Channel {
		channel.ModelMapping, channel.ParamOverride, channel.HeaderOverride = &mapping, &override, &headers
		return channel
	}
	advanced := configure(harness.newChannel(constant.ChannelTypeAdvancedCustom, "sk-static"))
	advanced.SetOtherSettings(dto.ChannelOtherSettings{AdvancedCustom: &dto.AdvancedCustomConfig{Routes: routes}})
	require.NoError(t, advanced.GetOtherSettings().AdvancedCustom.Validate())
	provider := configure(harness.pluginChannel("relay-only", "sk-static"))

	responsesBody := `{"model":"` + relayTestModel + `","input":"hello there"%s}`
	chatSent := func(t *testing.T, request capturedRequest) {
		assert.Equal(t, "/openai/"+relayTestModel+"/chat", request.URL)
		assert.Equal(t, "key sk-static", request.Header.Get("X-Vendor-Key"))
		assert.Contains(t, request.Body, `"temperature":0.5`)
	}
	for name, tc := range map[string]struct {
		path, body string
		respond    func(w http.ResponseWriter, attempt int, request capturedRequest)
		sent       func(t *testing.T, request capturedRequest)
	}{
		"chat":        {path: "/v1/chat/completions", body: relayTestBody, sent: chatSent},
		"chat stream": {path: "/v1/chat/completions", body: strings.Replace(relayTestBody, `"max_tokens"`, `"stream":true,"max_tokens"`, 1), sent: chatSent},
		"responses": {path: "/v1/responses", body: fmt.Sprintf(responsesBody, ""), sent: func(t *testing.T, request capturedRequest) {
			assert.Equal(t, "/openai/chat/completions", request.URL)
			assert.Contains(t, request.Body, `"messages"`)
		}},
		"responses stream": {path: "/v1/responses", body: fmt.Sprintf(responsesBody, `,"stream":true`)},
		"query auth": {path: "/v1/embeddings", body: `{"model":"` + relayTestModel + `","input":"hello there"}`, respond: func(w http.ResponseWriter, _ int, _ capturedRequest) {
			w.Header().Set("Content-Type", "application/json")
			_, _ = io.WriteString(w, `{"object":"list","data":[{"object":"embedding","index":0,"embedding":[0.1]}],"model":"m","usage":{"prompt_tokens":500,"total_tokens":500}}`)
		}, sent: func(t *testing.T, request capturedRequest) {
			assert.Contains(t, request.URL, "/embed?")
			assert.Contains(t, request.URL, "api=1")
			assert.Contains(t, request.URL, "key=sk-static")
		}},
	} {
		t.Run(name, func(t *testing.T) {
			if tc.respond != nil {
				harness.upstream.respond = tc.respond
				t.Cleanup(func() {
					harness.upstream.respond = func(w http.ResponseWriter, _ int, request capturedRequest) { writeChat(w, request) }
				})
			}
			run := func(channel *model.Channel) (capturedRequest, relayOutcome) {
				harness.install(t, channel)
				harness.upstream.reset()
				outcome := harness.post(t, tc.path, tc.body)
				require.Equal(t, http.StatusOK, outcome.status, outcome.body)
				requests := harness.upstream.captured()
				require.Len(t, requests, 1)
				return requests[0], outcome
			}

			wantRequest, want := run(advanced)
			gotRequest, got := run(provider)

			assert.Equal(t, "static", wantRequest.Header.Get("X-Static"))
			assert.Equal(t, "sk-static", wantRequest.Header.Get("X-Key"))
			assert.Equal(t, "trace-1", wantRequest.Header.Get("X-Pass"))
			if tc.sent != nil {
				tc.sent(t, wantRequest)
			}
			assert.Equal(t, wantRequest, gotRequest)
			assert.Equal(t, normalizedReply(want.body), normalizedReply(got.body))
			assert.Equal(t, want.header.Get("Content-Type"), got.header.Get("Content-Type"))
			assert.Positive(t, want.quota)
			assert.Equal(t, want.quota, got.quota)
			assert.Positive(t, want.log.Quota)
			assert.Equal(t, want.log.Quota, got.log.Quota)
			assert.Equal(t, want.log.PromptTokens, got.log.PromptTokens)
			assert.Equal(t, want.log.CompletionTokens, got.log.CompletionTokens)
		})
	}
}

func TestProviderChannelServesOnlyItsRoutes(t *testing.T) {
	harness := newRelayHarness(t)
	registerRelayPlugin(t, `export const meta = {apiVersion: 1, key: "relay-paths", name: "Paths", version: "1.0.0", author: {name: "Test"}, relay: [
		{incoming_path: "/v1/chat/completions", upstream_path: "/chat", models: ["other-model"]},
		{incoming_path: "/v1/responses", upstream_path: "/responses"}
	]};`)
	harness.install(t, harness.pluginChannel("relay-paths", "sk-static"))

	outcome := harness.post(t, "/v1/chat/completions", relayTestBody)

	assert.Equal(t, http.StatusServiceUnavailable, outcome.status, outcome.body)
	assert.Empty(t, harness.upstream.captured(), "the route is for another model")

	outcome = harness.post(t, "/v1/embeddings", `{"model":"`+relayTestModel+`","input":"x"}`)
	assert.Equal(t, http.StatusServiceUnavailable, outcome.status, outcome.body)
	assert.Empty(t, harness.upstream.captured())
}

func TestTaskOnlyPluginChannelStaysOutOfTheRelay(t *testing.T) {
	harness := newRelayHarness(t)
	registerRelayPlugin(t, `
export const meta = {apiVersion: 1, key: "relay-task", name: "Task", version: "1.0.0", author: {name: "Test"}, models: ["`+relayTestModel+`"], fetchMode: "per_task"};
export function buildSubmitRequest(ctx) { return {url: ctx.baseUrl + "/submit"}; }
export function parseSubmitResponse(ctx, resp) { return {taskId: "id"}; }
export function buildQueryRequest(ctx) { return {url: ctx.baseUrl + "/query"}; }
export function parseTaskResult() { return {status: "SUCCESS"}; }`)
	harness.install(t, harness.pluginChannel("relay-task", "sk-static"))

	outcome := harness.post(t, "/v1/chat/completions", relayTestBody)

	assert.Equal(t, http.StatusServiceUnavailable, outcome.status, outcome.body)
	assert.Empty(t, harness.upstream.captured())
}

func credentialFor(t *testing.T, plugin string, expiresAt int64) string {
	t.Helper()
	line, err := jsplugin.Credential{
		Plugin: plugin, Data: json.RawMessage(`{"access":"old-access","refresh":"old-refresh"}`), Headers: map[string]string{"Authorization": "Bearer old-access", "X-Account": "acct-1"},
		Query: map[string]string{"account": "acct-1"}, ExpiresAt: expiresAt, AccountID: "acct-1", Label: "acct-1@example.com",
	}.Line()
	require.NoError(t, err)
	return line
}

func TestCredentialReplacesRouteAuth(t *testing.T) {
	harness := newRelayHarness(t)
	registerRelayPlugin(t, `export const meta = {apiVersion: 1, key: "relay-cred", name: "Cred", version: "1.0.0", author: {name: "Test"}, relay: [
		{incoming_path: "/v1/chat/completions", upstream_path: "/chat?fixed=1", auth: {type: "header", name: "X-Vendor-Key", value: "{api_key}"}}
	]};
	export function login() { return {type: "pending"}; }`)
	line := credentialFor(t, "relay-cred", 0)
	channel := harness.pluginChannel("relay-cred", line)
	headers := `{"X-Admin":"set","X-Key":"[{api_key}]"}`
	channel.HeaderOverride = &headers
	harness.install(t, channel)

	outcome := harness.post(t, "/v1/chat/completions", relayTestBody)

	require.Equal(t, http.StatusOK, outcome.status, outcome.body)
	requests := harness.upstream.captured()
	require.Len(t, requests, 1)
	assert.Equal(t, "Bearer old-access", requests[0].Header.Get("Authorization"))
	assert.Equal(t, "acct-1", requests[0].Header.Get("X-Account"))
	assert.Empty(t, requests[0].Header.Get("X-Vendor-Key"), "a credential skips the route auth template")
	assert.Equal(t, "set", requests[0].Header.Get("X-Admin"))
	assert.Equal(t, "[]", requests[0].Header.Get("X-Key"), "{api_key} never carries the wrapper")
	assert.Contains(t, requests[0].URL, "account=acct-1")
	assert.Contains(t, requests[0].URL, "fixed=1")
	assert.NotContains(t, requests[0].Body, "old-refresh")
}

const rotatingPlugin = `
export const meta = {apiVersion: 1, key: "%KEY%", name: "Rotating", version: "1.0.0", author: {name: "Test"}, relay: [
  {incoming_path: "/v1/chat/completions", upstream_path: "/chat"}
]};
export function refresh(ctx) {
  const response = utils.fetch({url: ctx.baseUrl + "/oauth/token", method: "POST", body: JSON.stringify({refresh: ctx.credential.refresh})});
  if (response.status !== 200) throw new Error("refresh failed with " + response.status);
  return {credential: {access: "new-access", refresh: "new-refresh"}, headers: {Authorization: "Bearer new-access"}, expiresAt: utils.unixNow() + 3600};
}
%EXTRA%
`

func registerRotatingPlugin(t *testing.T, key, extra string) {
	t.Helper()
	registerRelayPlugin(t, strings.NewReplacer("%KEY%", key, "%EXTRA%", extra).Replace(rotatingPlugin))
}

// rejectOldCredential answers the token endpoint, and fails an old token with
// status until the refresh replaced it.
func rejectOldCredential(status int, body string) func(w http.ResponseWriter, attempt int, request capturedRequest) {
	return func(w http.ResponseWriter, _ int, request capturedRequest) {
		switch {
		case request.URL == "/oauth/token":
			w.Header().Set("Content-Type", "application/json")
			_, _ = io.WriteString(w, `{}`)
		case request.Header.Get("Authorization") == "Bearer old-access":
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(status)
			_, _ = io.WriteString(w, body)
		default:
			writeChat(w, request)
		}
	}
}

func requestsTo(requests []capturedRequest, url string) []capturedRequest {
	var matching []capturedRequest
	for _, request := range requests {
		if request.URL == url {
			matching = append(matching, request)
		}
	}
	return matching
}

func TestRejectedCredentialRefreshesAndResendsOnce(t *testing.T) {
	const unauthorized = `{"error":{"message":"token expired","type":"auth"}}`
	const banned = `{"error":{"code":"account_deactivated"}}`
	streamBody := strings.Replace(relayTestBody, `"max_tokens"`, `"stream":true,"max_tokens"`, 1)
	for name, tc := range map[string]struct {
		extra, body string
		status      int
		reply       string
		wantText    string
	}{
		"401":                       {body: relayTestBody, status: http.StatusUnauthorized, reply: unauthorized, wantText: `"content":"hi"`},
		"401 on a stream":           {body: streamBody, status: http.StatusUnauthorized, reply: unauthorized, wantText: "data: [DONE]"},
		"credentialRejected":        {extra: `export function credentialRejected(ctx, resp) { return resp.status === 403 && JSON.parse(resp.body).error.code === "account_deactivated"; }`, body: relayTestBody, status: http.StatusForbidden, reply: banned, wantText: `"content":"hi"`},
		"credentialRejected stream": {extra: `export function credentialRejected(ctx, resp) { return resp.headers["Content-Type"] === "application/json"; }`, body: streamBody, status: http.StatusForbidden, reply: banned, wantText: "data: [DONE]"},
	} {
		t.Run(name, func(t *testing.T) {
			harness := newRelayHarness(t)
			key := "relay-reject-" + strings.ReplaceAll(strings.ToLower(name), " ", "-")
			if len(key) > 30 {
				key = key[:30]
			}
			registerRotatingPlugin(t, key, tc.extra)
			harness.upstream.respond = rejectOldCredential(tc.status, tc.reply)
			channel := harness.install(t, harness.pluginChannel(key, credentialFor(t, key, 0)))

			outcome := harness.post(t, "/v1/chat/completions", tc.body)

			require.Equal(t, http.StatusOK, outcome.status, outcome.body)
			assert.Contains(t, outcome.body, tc.wantText)
			assert.NotContains(t, outcome.body, "token expired")
			requests := harness.upstream.captured()
			assert.Len(t, requestsTo(requests, "/oauth/token"), 1)
			sent := requestsTo(requests, "/chat?account=acct-1")
			require.Len(t, requests, 3)
			resent := requests[2]
			assert.Equal(t, "Bearer old-access", sent[0].Header.Get("Authorization"))
			assert.Equal(t, "Bearer new-access", resent.Header.Get("Authorization"))
			assert.NotContains(t, resent.URL, "account=acct-1", "the refreshed wrapper replaced the query too")
			assert.Equal(t, sent[0].Body, resent.Body, "the resend carries the same body")
			assert.Positive(t, outcome.quota)
			stored, err := model.GetChannelById(channel.Id, true)
			require.NoError(t, err)
			assert.Contains(t, stored.Key, "new-refresh")
			assert.Equal(t, common.ChannelStatusEnabled, stored.Status)
		})
	}
}

func TestSecondRejectionTakesTheUsualErrorPath(t *testing.T) {
	harness := newRelayHarness(t)
	registerRotatingPlugin(t, "relay-reject-twice", "")
	harness.upstream.respond = func(w http.ResponseWriter, _ int, request capturedRequest) {
		w.Header().Set("Content-Type", "application/json")
		if request.URL == "/oauth/token" {
			_, _ = io.WriteString(w, `{}`)
			return
		}
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = io.WriteString(w, `{"error":{"message":"still rejected","type":"auth"}}`)
	}
	harness.install(t, harness.pluginChannel("relay-reject-twice", credentialFor(t, "relay-reject-twice", 0)))

	outcome := harness.post(t, "/v1/chat/completions", relayTestBody)

	assert.Equal(t, http.StatusUnauthorized, outcome.status, outcome.body)
	requests := harness.upstream.captured()
	assert.Len(t, requestsTo(requests, "/oauth/token"), 1)
	assert.Len(t, requests, 3, "one send, one refresh, one resend")
	assert.Zero(t, outcome.quota, "a failed request is refunded")
}

func TestRejectionWithoutRefreshIsAnOrdinaryError(t *testing.T) {
	harness := newRelayHarness(t)
	registerRelayPlugin(t, `export const meta = {apiVersion: 1, key: "relay-no-refresh", name: "No refresh", version: "1.0.0", author: {name: "Test"}, relay: [{incoming_path: "/v1/chat/completions", upstream_path: "/chat"}]};
	export function credentialRejected() { throw new Error("must not run without refresh"); }`)
	harness.upstream.respond = func(w http.ResponseWriter, _ int, _ capturedRequest) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = io.WriteString(w, `{"error":{"message":"rejected","type":"auth"}}`)
	}
	harness.install(t, harness.pluginChannel("relay-no-refresh", credentialFor(t, "relay-no-refresh", 0)))

	outcome := harness.post(t, "/v1/chat/completions", relayTestBody)

	assert.Equal(t, http.StatusUnauthorized, outcome.status, outcome.body)
	assert.Len(t, harness.upstream.captured(), 1)
}

func TestExpiringCredentialIsRefreshedBeforeTheRequest(t *testing.T) {
	harness := newRelayHarness(t)
	registerRotatingPlugin(t, "relay-before", "")
	harness.upstream.respond = rejectOldCredential(http.StatusUnauthorized, `{}`)
	harness.install(t, harness.pluginChannel("relay-before", credentialFor(t, "relay-before", time.Now().Add(10*time.Second).Unix())))

	outcome := harness.post(t, "/v1/chat/completions", relayTestBody)

	require.Equal(t, http.StatusOK, outcome.status, outcome.body)
	requests := harness.upstream.captured()
	require.Len(t, requests, 2)
	assert.Equal(t, "/oauth/token", requests[0].URL)
	assert.Equal(t, "Bearer new-access", requests[1].Header.Get("Authorization"))
}

func TestFailedRefreshBeforeTheRequest(t *testing.T) {
	failToken := func(w http.ResponseWriter, _ int, request capturedRequest) {
		if request.URL == "/oauth/token" {
			w.WriteHeader(http.StatusBadGateway)
			return
		}
		writeChat(w, request)
	}
	t.Run("a credential that has not expired is still used", func(t *testing.T) {
		harness := newRelayHarness(t)
		registerRotatingPlugin(t, "relay-keep", "")
		harness.upstream.respond = failToken
		harness.install(t, harness.pluginChannel("relay-keep", credentialFor(t, "relay-keep", time.Now().Add(10*time.Second).Unix())))

		outcome := harness.post(t, "/v1/chat/completions", relayTestBody)

		require.Equal(t, http.StatusOK, outcome.status, outcome.body)
		requests := harness.upstream.captured()
		require.Len(t, requests, 2)
		assert.Equal(t, "Bearer old-access", requests[1].Header.Get("Authorization"))
	})
	t.Run("an expired credential fails the request", func(t *testing.T) {
		harness := newRelayHarness(t)
		registerRotatingPlugin(t, "relay-expired", "")
		harness.upstream.respond = failToken
		harness.install(t, harness.pluginChannel("relay-expired", credentialFor(t, "relay-expired", time.Now().Add(-time.Minute).Unix())))

		outcome := harness.post(t, "/v1/chat/completions", relayTestBody)

		assert.GreaterOrEqual(t, outcome.status, http.StatusBadRequest, outcome.body)
		assert.Len(t, harness.upstream.captured(), 1, "only the refresh was sent")
		assert.Zero(t, outcome.quota)
		assert.NotContains(t, outcome.body, "old-refresh")
		assert.NotContains(t, outcome.body, "refresh failed with", "the plugin's message stays in the gateway")
	})
}

// A key whose credential needs a new login never reaches the upstream: the
// request disables the key for the reason a login clears, whatever the
// automatic disabling setting is, and a retry can serve the request with
// another key.
func TestNeedsLoginCredentialFailsWithoutReachingTheUpstream(t *testing.T) {
	previousAutoDisable, previousRetry := common.AutomaticDisableChannelEnabled, common.RetryTimes
	t.Cleanup(func() { common.AutomaticDisableChannelEnabled, common.RetryTimes = previousAutoDisable, previousRetry })
	for _, autoDisable := range []bool{true, false} {
		t.Run(fmt.Sprintf("auto-disable %v", autoDisable), func(t *testing.T) {
			common.AutomaticDisableChannelEnabled = autoDisable
			common.RetryTimes = 0
			harness := newRelayHarness(t)
			registerRotatingPlugin(t, "relay-needs-login", "")
			line, err := jsplugin.Credential{Plugin: "relay-needs-login", Data: json.RawMessage(`{"refresh":"old-refresh"}`), NeedsLogin: true}.Line()
			require.NoError(t, err)
			// An administrator enabled the key again by hand.
			channel := harness.install(t, harness.pluginChannel("relay-needs-login", line))

			outcome := harness.post(t, "/v1/chat/completions", relayTestBody)

			assert.GreaterOrEqual(t, outcome.status, http.StatusBadRequest, outcome.body)
			assert.Empty(t, harness.upstream.captured())
			assert.NotContains(t, outcome.body, "old-refresh")
			assert.Zero(t, outcome.quota)
			stored, err := model.GetChannelById(channel.Id, true)
			require.NoError(t, err)
			assert.Equal(t, common.ChannelStatusAutoDisabled, stored.Status)
			assert.Equal(t, model.ChannelStatusReasonPluginNeedsLogin, stored.GetOtherInfo()["status_reason"], "disabled for the reason a login clears")

			// The channel's other key serves the retry.
			common.RetryTimes = 1
			multi := harness.pluginChannel("relay-needs-login", line+"\n"+credentialFor(t, "relay-needs-login", 0))
			multi.ChannelInfo = model.ChannelInfo{IsMultiKey: true, MultiKeySize: 2, MultiKeyMode: constant.MultiKeyModePolling}
			multi = harness.install(t, multi)

			outcome = harness.post(t, "/v1/chat/completions", relayTestBody)

			require.Equal(t, http.StatusOK, outcome.status, outcome.body)
			requests := harness.upstream.captured()
			require.Len(t, requests, 1)
			assert.Equal(t, "Bearer old-access", requests[0].Header.Get("Authorization"))
			stored, err = model.GetChannelById(multi.Id, true)
			require.NoError(t, err)
			assert.Equal(t, common.ChannelStatusEnabled, stored.Status)
			assert.Equal(t, common.ChannelStatusAutoDisabled, stored.ChannelInfo.MultiKeyStatusList[0])
			assert.Equal(t, model.ChannelStatusReasonPluginNeedsLogin, stored.ChannelInfo.MultiKeyDisabledReason[0])
		})
	}
}

func TestForeignCredentialNeverLeavesTheGateway(t *testing.T) {
	harness := newRelayHarness(t)
	registerRelayPlugin(t, `export const meta = {apiVersion: 1, key: "relay-owner", name: "Owner", version: "1.0.0", author: {name: "Test"}, relay: [{incoming_path: "/v1/chat/completions", upstream_path: "/chat"}]};`)
	harness.install(t, harness.pluginChannel("relay-owner", credentialFor(t, "another-plugin", 0)))

	outcome := harness.post(t, "/v1/chat/completions", relayTestBody)

	assert.GreaterOrEqual(t, outcome.status, http.StatusBadRequest, outcome.body)
	assert.Empty(t, harness.upstream.captured())
	assert.NotContains(t, outcome.body, "old-access")
}

func TestPrepareRequest(t *testing.T) {
	const source = `
export const meta = {apiVersion: 1, key: "%KEY%", name: "Prepare", version: "1.0.0", author: {name: "Test"}, relay: [
  {incoming_path: "/v1/chat/completions", upstream_path: "/chat"}
]};
export function login() { return {type: "pending"}; }
export function prepareRequest(ctx, req) {
  const seen = {type: "json.patch", ops: [{op: "add", path: "/seen", value: {path: req.path, upstreamPath: req.upstreamPath, model: req.model, stream: req.stream, message: req.body.messages[0].content, trace: Object.keys(req.headers).filter((name) => name === "Authorization" || name === "X-Account")}}]};
  return {effects: [seen, %EFFECT%]};
}`
	for name, tc := range map[string]struct {
		effect  string
		allowed bool
		check   func(t *testing.T, request capturedRequest)
		message string
	}{
		"patch and header": {effect: `{type: "json.patch", ops: [{op: "remove", path: "/temperature"}, {op: "remove", path: "/max_tokens"}, {op: "add", path: "/store", value: false}]}, {type: "header.patch", set: {"X-Beta": "1"}}`, allowed: true, check: func(t *testing.T, request capturedRequest) {
			assert.JSONEq(t, `{"model":"`+relayTestModel+`","messages":[{"role":"user","content":"hello there"}],"store":false,"seen":{"path":"/v1/chat/completions","upstreamPath":"/chat","model":"`+relayTestModel+`","stream":false,"message":"hello there","trace":[]}}`, request.Body)
			assert.Equal(t, "1", request.Header.Get("X-Beta"))
			assert.Equal(t, "Bearer old-access", request.Header.Get("Authorization"))
		}},
		"billing field":     {effect: `{type: "json.patch", ops: [{op: "add", path: "/n", value: 4}]}`, message: "billing field n"},
		"service tier":      {effect: `{type: "json.patch", ops: [{op: "add", path: "/service_tier", value: "priority"}]}`, message: "billing field service_tier"},
		"model":             {effect: `{type: "json.patch", ops: [{op: "replace", path: "/model", value: "cheap"}]}`, message: "billing field model"},
		"stream flag":       {effect: `{type: "json.patch", ops: [{op: "add", path: "/stream", value: true}]}`, message: "billing field stream"},
		"protected header":  {effect: `{type: "header.patch", set: {"Authorization": "Bearer stolen"}}`, message: "is protected"},
		"cookie":            {effect: `{type: "header.patch", remove: ["Cookie"]}`, message: "is protected"},
		"credential header": {effect: `{type: "header.patch", set: {"X-Account": "other"}}`, message: "is protected"},
		"failed test":       {effect: `{type: "json.patch", ops: [{op: "test", path: "/model", value: "other"}]}, {type: "header.patch", set: {"X-Beta": "1"}}`, message: "test failed"},
		"unknown effect":    {effect: `{type: "body.replace", body: "x"}`, message: "is not supported"},
	} {
		t.Run(name, func(t *testing.T) {
			harness := newRelayHarness(t)
			key := "relay-prepare"
			registerRelayPlugin(t, strings.NewReplacer("%KEY%", key, "%EFFECT%", tc.effect).Replace(source))
			harness.install(t, harness.pluginChannel(key, credentialFor(t, key, 0)))

			outcome := harness.post(t, "/v1/chat/completions", strings.Replace(relayTestBody, `"max_tokens"`, `"temperature":0.1,"max_tokens"`, 1))

			requests := harness.upstream.captured()
			if tc.allowed {
				require.Equal(t, http.StatusOK, outcome.status, outcome.body)
				require.Len(t, requests, 1)
				tc.check(t, requests[0])
				return
			}
			assert.GreaterOrEqual(t, outcome.status, http.StatusBadRequest)
			assert.Contains(t, outcome.body, tc.message)
			assert.Empty(t, requests, "a failed prepareRequest applies nothing and sends nothing")
			assert.Zero(t, outcome.quota)
		})
	}
}

// Effects that grow the body past the request body limit fail the request as
// a client body over the limit does: 413, nothing sent, nothing billed.
func TestPrepareRequestOverTheBodyLimit(t *testing.T) {
	limit := constant.MaxRequestBodyMB
	constant.MaxRequestBodyMB = 1
	t.Cleanup(func() { constant.MaxRequestBodyMB = limit })
	for name, ops := range map[string]string{
		"added value": `[{op: "add", path: "/pad", value: "x".repeat(1100000)}]`,
		"copies":      `Array.from({length: 16}, (_, i) => ({op: "copy", from: "", path: "/c" + i}))`,
	} {
		t.Run(name, func(t *testing.T) {
			harness := newRelayHarness(t)
			registerRelayPlugin(t, `export const meta = {apiVersion: 1, key: "relay-prepare-large", name: "Large", version: "1.0.0", author: {name: "Test"}, relay: [{incoming_path: "/v1/chat/completions", upstream_path: "/chat"}]};
	export function prepareRequest() { return {effects: [{type: "json.patch", ops: `+ops+`}]}; }`)
			harness.install(t, harness.pluginChannel("relay-prepare-large", "sk-static"))

			outcome := harness.post(t, "/v1/chat/completions", relayTestBody)

			assert.Equal(t, http.StatusRequestEntityTooLarge, outcome.status, outcome.body)
			assert.Empty(t, harness.upstream.captured())
			assert.Zero(t, outcome.quota)
		})
	}
}

func TestPrepareRequestKeepsReformattedBillingFields(t *testing.T) {
	harness := newRelayHarness(t)
	registerRelayPlugin(t, `export const meta = {apiVersion: 1, key: "relay-format", name: "Format", version: "1.0.0", author: {name: "Test"}, relay: [{incoming_path: "/v1/chat/completions", upstream_path: "/chat"}]};
	export function prepareRequest() { return {effects: [{type: "json.patch", ops: [{op: "add", path: "/store", value: false}]}]}; }`)
	channel := harness.pluginChannel("relay-format", "sk-static")
	channel.SetSetting(dto.ChannelSettings{TaskPluginKey: "relay-format", PassThroughBodyEnabled: true})
	harness.install(t, channel)

	// The client's text reaches prepareRequest; applying the effect re-encodes
	// stream_options without its spaces.
	outcome := harness.post(t, "/v1/chat/completions", strings.Replace(relayTestBody, `"max_tokens":32`, `"stream":true,"stream_options": { "include_usage": true }`, 1))

	require.Equal(t, http.StatusOK, outcome.status, outcome.body)
	requests := harness.upstream.captured()
	require.Len(t, requests, 1)
	assert.Contains(t, requests[0].Body, `"stream_options":{"include_usage":true}`)
}

func TestPrepareRequestReachesTheOverriddenBody(t *testing.T) {
	harness := newRelayHarness(t)
	registerRelayPlugin(t, `export const meta = {apiVersion: 1, key: "relay-order", name: "Order", version: "1.0.0", author: {name: "Test"}, relay: [{incoming_path: "/v1/chat/completions", upstream_path: "/chat"}]};
	export function prepareRequest(ctx, req) { return {effects: [{type: "json.patch", ops: [{op: "add", path: "/saw_override", value: req.body.temperature === 0.5}]}]}; }`)
	channel := harness.pluginChannel("relay-order", "sk-static")
	override := `{"temperature":0.5}`
	channel.ParamOverride = &override
	harness.install(t, channel)

	outcome := harness.post(t, "/v1/chat/completions", relayTestBody)

	require.Equal(t, http.StatusOK, outcome.status, outcome.body)
	requests := harness.upstream.captured()
	require.Len(t, requests, 1)
	assert.Contains(t, requests[0].Body, `"saw_override":true`)
}

func TestSignRequest(t *testing.T) {
	harness := newRelayHarness(t)
	registerRotatingPlugin(t, "relay-sign", `
export function prepareRequest() { return {effects: [{type: "json.patch", ops: [{op: "add", path: "/prepared", value: true}]}]}; }
export function signRequest(ctx, req) {
  return {headers: {"X-Signature": ctx.credential.access + "|" + req.method + "|" + req.bodySha256, "X-Saw-Override": req.headers["X-Admin"] || "", "X-Admin": "signed"}, query: {sig: "1"}};
}`)
	harness.upstream.respond = rejectOldCredential(http.StatusUnauthorized, `{}`)
	channel := harness.pluginChannel("relay-sign", credentialFor(t, "relay-sign", 0))
	headers := `{"X-Admin":"admin"}`
	channel.HeaderOverride = &headers
	harness.install(t, channel)

	outcome := harness.post(t, "/v1/chat/completions", relayTestBody)

	require.Equal(t, http.StatusOK, outcome.status, outcome.body)
	var sent []capturedRequest
	for _, request := range harness.upstream.captured() {
		if request.URL != "/oauth/token" {
			sent = append(sent, request)
		}
	}
	require.Len(t, sent, 2)
	for index, access := range []string{"old-access", "new-access"} {
		sum := sha256.Sum256([]byte(sent[index].Body))
		assert.Contains(t, sent[index].Body, `"prepared":true`)
		assert.Equal(t, access+"|POST|"+hex.EncodeToString(sum[:]), sent[index].Header.Get("X-Signature"), "signed on every send over the exact bytes")
		assert.Equal(t, "admin", sent[index].Header.Get("X-Saw-Override"), "signing sees the header overrides")
		assert.Equal(t, "signed", sent[index].Header.Get("X-Admin"), "signing runs last")
		assert.Contains(t, sent[index].URL, "sig=1")
	}
}

const convertingPlugin = `
export const meta = {apiVersion: 1, key: "%KEY%", name: "Converting", version: "1.0.0", author: {name: "Test"}, relay: [
  {incoming_path: "/v1/chat/completions", upstream_path: "/generate", converter: "plugin"}
]};
export function convertRequest(ctx, req) {
  return {body: {prompt: req.body.messages[0].content, model: req.model, stream: req.stream}};
}
export function convertResponse(ctx, resp) {
  const body = JSON.parse(resp.body);
  return {body: {id: "chatcmpl-c", object: "chat.completion", created: 1730000000, model: "gpt-4o-mini",
    choices: [{index: 0, message: {role: "assistant", content: body.text}, finish_reason: "stop"}],
    usage: {prompt_tokens: body.input, completion_tokens: body.output, total_tokens: body.input + body.output}}};
}
function chunk(delta, finish, usage) {
  const value = {id: "chatcmpl-c", object: "chat.completion.chunk", created: 1730000000, model: "gpt-4o-mini", choices: usage ? [] : [{index: 0, delta: delta, finish_reason: finish}]};
  if (usage) value.usage = usage;
  return {data: value};
}
export function convertStreamEvent(ctx, input) {
  const state = ctx.state || {sent: 0};
  if (input.done) return {events: [chunk({}, "stop"), chunk(null, null, {prompt_tokens: 1000, completion_tokens: state.sent, total_tokens: 1000 + state.sent}), {data: "[DONE]"}]};
  const text = JSON.parse(input.data).text;
  return {events: [chunk({role: "assistant", content: text}, null)], state: {sent: state.sent + 1000}};
}
`

func TestPluginConverter(t *testing.T) {
	for name, tc := range map[string]struct {
		contentType, upstream string
		stream                bool
	}{
		"non-stream":           {contentType: "application/json", upstream: `{"text":"converted","input":1000,"output":2000}`},
		"server-sent events":   {contentType: "text/event-stream", upstream: "event: delta\ndata: {\"text\":\"one\"}\n\n: comment\n\ndata: {\"text\":\"two\"}\n\n", stream: true},
		"newline-delimited":    {contentType: "application/x-ndjson", upstream: "{\"text\":\"one\"}\n\n{\"text\":\"two\"}\n", stream: true},
		"stream ending midway": {contentType: "text/event-stream", upstream: "data: {\"text\":\"one\"}\n\ndata: {\"text\":\"two\"}", stream: true},
	} {
		t.Run(name, func(t *testing.T) {
			harness := newRelayHarness(t)
			registerRelayPlugin(t, strings.ReplaceAll(convertingPlugin, "%KEY%", "relay-convert"))
			harness.upstream.respond = func(w http.ResponseWriter, _ int, _ capturedRequest) {
				w.Header().Set("Content-Type", tc.contentType)
				_, _ = io.WriteString(w, tc.upstream)
			}
			harness.install(t, harness.pluginChannel("relay-convert", "sk-static"))
			body := relayTestBody
			if tc.stream {
				body = strings.Replace(body, `"max_tokens"`, `"stream":true,"max_tokens"`, 1)
			}

			outcome := harness.post(t, "/v1/chat/completions", body)

			require.Equal(t, http.StatusOK, outcome.status, outcome.body)
			requests := harness.upstream.captured()
			require.Len(t, requests, 1)
			assert.Equal(t, "/generate", requests[0].URL)
			assert.JSONEq(t, fmt.Sprintf(`{"prompt":"hello there","model":"%s","stream":%t}`, relayTestModel, tc.stream), requests[0].Body)
			assert.Equal(t, "Bearer sk-static", requests[0].Header.Get("Authorization"))
			assert.EqualValues(t, 1000, outcome.log.PromptTokens, "usage comes from the converted reply")
			assert.EqualValues(t, 2000, outcome.log.CompletionTokens)
			assert.Positive(t, outcome.log.Quota)
			assert.Equal(t, outcome.log.Quota, outcome.quota)
			if tc.stream {
				assert.True(t, strings.HasPrefix(outcome.header.Get("Content-Type"), "text/event-stream"))
				assert.Contains(t, outcome.body, `"content":"one"`)
				assert.Contains(t, outcome.body, `"content":"two"`)
				assert.Contains(t, outcome.body, "data: [DONE]")
			} else {
				assert.Contains(t, outcome.body, `"content":"converted"`)
			}
		})
	}
}

// Each convert hook is told the route it serves, so one plugin can convert
// several endpoints whose replies look alike.
func TestConvertHooksKnowTheirRoute(t *testing.T) {
	harness := newRelayHarness(t)
	registerRelayPlugin(t, `export const meta = {apiVersion: 1, key: "relay-routes", name: "Routes", version: "1.0.0", author: {name: "Test"}, relay: [
  {incoming_path: "/v1/chat/completions", upstream_path: "/generate", converter: "plugin"},
  {incoming_path: "/v1/completions", upstream_path: "/generate", converter: "plugin"},
  {incoming_path: "/v1/embeddings", upstream_path: "/generate", converter: "plugin"}
]};
export function convertRequest(ctx, req) { return {body: {route: ctx.path}}; }
export function convertResponse(ctx, resp) {
  const value = JSON.parse(resp.body).value;
  if (ctx.path === "/v1/embeddings") {
    return {body: {object: "list", data: [{object: "embedding", index: 0, embedding: [value]}], model: "m", usage: {prompt_tokens: 1, total_tokens: 1}}};
  }
  return {body: {id: "c", object: "chat.completion", created: 1730000000, model: "m",
    choices: [{index: 0, message: {role: "assistant", content: ctx.path + " got " + value}, finish_reason: "stop"}],
    usage: {prompt_tokens: 1, completion_tokens: 1, total_tokens: 2}}};
}
export function convertStreamEvent(ctx, input) {
  if (input.done) return {events: [{data: "[DONE]"}]};
  const text = ctx.path + " got " + JSON.parse(input.data).value;
  const choice = ctx.path === "/v1/completions" ? {index: 0, text: text, finish_reason: null} : {index: 0, delta: {content: text}, finish_reason: null};
  return {events: [{data: {id: "c", object: "chunk", created: 1730000000, model: "m", choices: [choice]}}]};
}`)
	harness.install(t, harness.pluginChannel("relay-routes", "sk-static"))
	completionBody := `{"model":"` + relayTestModel + `","prompt":"hello there","max_tokens":16,"stream":true}`
	chatStreamBody := strings.Replace(relayTestBody, `"max_tokens"`, `"stream":true,"max_tokens"`, 1)
	for name, tc := range map[string]struct {
		path, body, want string
		stream           bool
	}{
		"chat":              {path: "/v1/chat/completions", body: relayTestBody, want: `"content":"/v1/chat/completions got 7"`},
		"embeddings":        {path: "/v1/embeddings", body: `{"model":"` + relayTestModel + `","input":"hello there"}`, want: `"embedding":[7]`},
		"chat stream":       {path: "/v1/chat/completions", body: chatStreamBody, want: `"content":"/v1/chat/completions got 7"`, stream: true},
		"completion stream": {path: "/v1/completions", body: completionBody, want: `"text":"/v1/completions got 7"`, stream: true},
	} {
		t.Run(name, func(t *testing.T) {
			harness.upstream.reset()
			harness.upstream.respond = func(w http.ResponseWriter, _ int, _ capturedRequest) {
				if tc.stream {
					w.Header().Set("Content-Type", "text/event-stream")
					_, _ = io.WriteString(w, "data: {\"value\":7}\n\n")
					return
				}
				w.Header().Set("Content-Type", "application/json")
				_, _ = io.WriteString(w, `{"value":7}`)
			}

			outcome := harness.post(t, tc.path, tc.body)

			require.Equal(t, http.StatusOK, outcome.status, outcome.body)
			requests := harness.upstream.captured()
			require.Len(t, requests, 1)
			assert.JSONEq(t, `{"route":"`+tc.path+`"}`, requests[0].Body)
			assert.Contains(t, outcome.body, tc.want)
		})
	}
}

func TestPluginConverterLeavesErrorsToTheHost(t *testing.T) {
	harness := newRelayHarness(t)
	registerRelayPlugin(t, strings.ReplaceAll(convertingPlugin, "%KEY%", "relay-convert-err"))
	harness.upstream.respond = func(w http.ResponseWriter, _ int, _ capturedRequest) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		_, _ = io.WriteString(w, `{"error":{"message":"bad prompt","type":"invalid_request"}}`)
	}
	harness.install(t, harness.pluginChannel("relay-convert-err", "sk-static"))

	outcome := harness.post(t, "/v1/chat/completions", relayTestBody)

	assert.Equal(t, http.StatusBadRequest, outcome.status, outcome.body)
	assert.Contains(t, outcome.body, "bad prompt")
	assert.Zero(t, outcome.quota)
}

// A chained route converts the client request with its registered converter
// before the hooks, which see a Claude Messages body here. A nativeResponse
// reply reaches that converter's handler untouched, so the client gets and
// pays what an Advanced Custom channel with the converter returns; a failed
// one still goes to convertResponse.
func TestChainedConverterWithNativeResponse(t *testing.T) {
	const (
		claudeReply  = `{"id":"msg_1","type":"message","role":"assistant","model":"m","content":[{"type":"text","text":"hi"}],"stop_reason":"end_turn","stop_sequence":null,"usage":{"input_tokens":1000,"output_tokens":2000,"cache_read_input_tokens":300,"cache_creation_input_tokens":200}}`
		claudeStream = "event: message_start\ndata: {\"type\":\"message_start\",\"message\":{\"id\":\"msg_1\",\"type\":\"message\",\"role\":\"assistant\",\"model\":\"m\",\"content\":[],\"stop_reason\":null,\"stop_sequence\":null,\"usage\":{\"input_tokens\":1000,\"output_tokens\":1,\"cache_read_input_tokens\":300,\"cache_creation_input_tokens\":200}}}\n\n" +
			"event: content_block_start\ndata: {\"type\":\"content_block_start\",\"index\":0,\"content_block\":{\"type\":\"text\",\"text\":\"\"}}\n\n" +
			"event: content_block_delta\ndata: {\"type\":\"content_block_delta\",\"index\":0,\"delta\":{\"type\":\"text_delta\",\"text\":\"hi\"}}\n\n" +
			"event: content_block_stop\ndata: {\"type\":\"content_block_stop\",\"index\":0}\n\n" +
			"event: message_delta\ndata: {\"type\":\"message_delta\",\"delta\":{\"stop_reason\":\"end_turn\",\"stop_sequence\":null},\"usage\":{\"output_tokens\":2000}}\n\n" +
			"event: message_stop\ndata: {\"type\":\"message_stop\"}\n\n"
	)
	harness := newRelayHarness(t)
	registerRelayPlugin(t, `export const meta = {apiVersion: 1, key: "relay-chained", name: "Chained", version: "1.0.0", author: {name: "Test"}, relay: [
  {incoming_path: "/v1/chat/completions", upstream_path: "/generate", converter: "openai_chat_completions_to_anthropic_messages+plugin"}
]};
export function convertRequest(ctx, req) {
  const body = Object.assign({}, req.body, {vendor_version: "v1"});
  delete body.model;
  delete body.stream;
  return {body: body, path: "/vendor/" + req.body.model + (req.stream ? ":stream" : ":invoke"), nativeResponse: true};
}
export function convertResponse(ctx, resp) { return {error: {message: "vendor said " + JSON.parse(resp.body).message}}; }
export function convertStreamEvent() { throw new Error("a native response skips the stream hook"); }`)
	advanced := harness.newChannel(constant.ChannelTypeAdvancedCustom, "sk-static")
	advanced.SetOtherSettings(dto.ChannelOtherSettings{AdvancedCustom: &dto.AdvancedCustomConfig{Routes: []dto.AdvancedCustomRoute{
		{IncomingPath: "/v1/chat/completions", UpstreamPath: "/std", Converter: "openai_chat_completions_to_anthropic_messages"},
	}}})
	require.NoError(t, advanced.GetOtherSettings().AdvancedCustom.Validate())
	provider := harness.pluginChannel("relay-chained", "sk-static")
	harness.upstream.respond = func(w http.ResponseWriter, _ int, request capturedRequest) {
		if strings.HasSuffix(request.URL, ":stream") || gjson.Get(request.Body, "stream").Bool() {
			w.Header().Set("Content-Type", "text/event-stream")
			_, _ = io.WriteString(w, claudeStream)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, claudeReply)
	}

	for name, stream := range map[string]bool{"non-stream": false, "stream": true} {
		t.Run(name, func(t *testing.T) {
			body := relayTestBody
			if stream {
				body = strings.Replace(body, `"max_tokens"`, `"stream":true,"max_tokens"`, 1)
			}
			run := func(channel *model.Channel) (capturedRequest, relayOutcome) {
				harness.install(t, channel)
				harness.upstream.reset()
				outcome := harness.post(t, "/v1/chat/completions", body)
				require.Equal(t, http.StatusOK, outcome.status, outcome.body)
				requests := harness.upstream.captured()
				require.Len(t, requests, 1)
				return requests[0], outcome
			}
			wantRequest, want := run(advanced)
			gotRequest, got := run(provider)

			var sent map[string]any
			require.NoError(t, common.UnmarshalJsonStr(wantRequest.Body, &sent))
			assert.Equal(t, relayTestModel, sent["model"], "the converter wrote a Claude Messages body")
			delete(sent, "model")
			delete(sent, "stream")
			sent["vendor_version"] = "v1"
			expected, err := common.Marshal(sent)
			require.NoError(t, err)
			assert.JSONEq(t, string(expected), gotRequest.Body)
			assert.Equal(t, "/vendor/"+relayTestModel+map[bool]string{false: ":invoke", true: ":stream"}[stream], gotRequest.URL)
			assert.Equal(t, normalizedReply(want.body), normalizedReply(got.body))
			assert.Contains(t, got.body, `"content":"hi"`)
			assert.Positive(t, want.quota)
			assertBilledAlike(t, want, got)
		})
	}

	harness.install(t, provider)
	harness.upstream.respond = func(w http.ResponseWriter, _ int, _ capturedRequest) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusTooManyRequests)
		_, _ = io.WriteString(w, `{"message":"slow down"}`)
	}
	outcome := harness.post(t, "/v1/chat/completions", relayTestBody)
	assert.Equal(t, http.StatusTooManyRequests, outcome.status, outcome.body)
	assert.Contains(t, outcome.body, "vendor said slow down")
	assert.Zero(t, outcome.quota)
}

func TestConverterFailureIsRefunded(t *testing.T) {
	harness := newRelayHarness(t)
	registerRelayPlugin(t, `export const meta = {apiVersion: 1, key: "relay-convert-throw", name: "Throw", version: "1.0.0", author: {name: "Test"}, relay: [{incoming_path: "/v1/chat/completions", upstream_path: "/generate", converter: "plugin"}]};
	export function convertRequest() { throw new Error("cannot convert"); }
	export function convertResponse() { return {body: "{}"}; }
	export function convertStreamEvent() { return {}; }`)
	harness.install(t, harness.pluginChannel("relay-convert-throw", "sk-static"))

	outcome := harness.post(t, "/v1/chat/completions", relayTestBody)

	assert.GreaterOrEqual(t, outcome.status, http.StatusBadRequest, outcome.body)
	assert.Empty(t, harness.upstream.captured())
	assert.Zero(t, outcome.quota)
}

func TestConcurrentRejectionsRefreshOnce(t *testing.T) {
	harness := newRelayHarness(t)
	registerRotatingPlugin(t, "relay-concurrent", "")
	var refreshes atomic.Int32
	harness.upstream.respond = func(w http.ResponseWriter, _ int, request capturedRequest) {
		if request.URL == "/oauth/token" {
			refreshes.Add(1)
			time.Sleep(50 * time.Millisecond)
		}
		rejectOldCredential(http.StatusUnauthorized, `{}`)(w, 0, request)
	}
	harness.install(t, harness.pluginChannel("relay-concurrent", credentialFor(t, "relay-concurrent", 0)))

	var group sync.WaitGroup
	for range 6 {
		group.Go(func() {
			outcome := harness.post(t, "/v1/chat/completions", relayTestBody)
			assert.Equal(t, http.StatusOK, outcome.status, outcome.body)
		})
	}
	group.Wait()

	assert.EqualValues(t, 1, refreshes.Load(), "the first refresh rotates the token for every waiting request")
}

// vendorPlugin connects a vendor that answers HTTP 200 with an error code in
// its body, as a reply or as a stream event, on every client protocol.
const vendorPlugin = `
export const meta = {apiVersion: 1, key: "%KEY%", name: "Vendor", version: "1.0.0", author: {name: "Test"}, relay: [
  {incoming_path: "/v1/chat/completions", upstream_path: "/generate", converter: "plugin"},
  {incoming_path: "/v1/responses", upstream_path: "/generate", converter: "plugin"},
  {incoming_path: "/v1/messages", upstream_path: "/generate", converter: "plugin"},
  {incoming_path: "/v1beta/models/{model}:generateContent", upstream_path: "/generate", converter: "plugin"}
]};
export function convertRequest(ctx, req) {
  return {body: {prompt: "hello there", stream: req.stream}};
}
function vendorError(body) {
  if (body.code === 1302) return {error: {status: 429, message: body.msg, type: "rate_limit_error", code: "1302"}};
  return {error: {message: body.msg, code: String(body.code)}};
}
export function convertResponse(ctx, resp) {
  const body = JSON.parse(resp.body);
  if (body.code) return vendorError(body);
  return {body: {id: "chatcmpl-v", object: "chat.completion", created: 1730000000, model: "gpt-4o-mini",
    choices: [{index: 0, message: {role: "assistant", content: body.text}, finish_reason: "stop"}],
    usage: {prompt_tokens: 1000, completion_tokens: 2000, total_tokens: 3000}}};
}
function chunk(delta, finish, usage) {
  const value = {id: "chatcmpl-v", object: "chat.completion.chunk", created: 1730000000, model: "gpt-4o-mini", choices: usage ? [] : [{index: 0, delta: delta, finish_reason: finish}]};
  if (usage) value.usage = usage;
  return {data: value};
}
export function convertStreamEvent(ctx, input) {
  const state = ctx.state || {sent: 0};
  if (input.done) return {events: [chunk({}, "stop"), chunk(null, null, {prompt_tokens: 1000, completion_tokens: state.sent, total_tokens: 1000 + state.sent}), {data: "[DONE]"}]};
  const body = JSON.parse(input.data);
  if (body.code) return vendorError(body);
  if (body.meta) return {state: {sent: state.sent, meta: body.meta}};
  return {events: [chunk({role: "assistant", content: body.text}, null)], state: {sent: state.sent + 1000}};
}
`

func respondWith(status int, contentType, body string) func(w http.ResponseWriter, attempt int, request capturedRequest) {
	return func(w http.ResponseWriter, _ int, _ capturedRequest) {
		w.Header().Set("Content-Type", contentType)
		w.WriteHeader(status)
		_, _ = io.WriteString(w, body)
	}
}

func TestPluginConverterMapsVendorErrors(t *testing.T) {
	const rateLimited = `{"code":1302,"msg":"too many requests"}`
	protocols := map[string]struct{ path, body, format string }{
		"chat":      {path: "/v1/chat/completions", body: relayTestBody, format: `"code":"1302"`},
		"responses": {path: "/v1/responses", body: `{"model":"` + relayTestModel + `","input":"hello there"}`, format: `"code":"1302"`},
		"messages":  {path: "/v1/messages", body: `{"model":"` + relayTestModel + `","max_tokens":32,"messages":[{"role":"user","content":"hello there"}]}`, format: `"type":"error"`},
		"gemini":    {path: "/v1beta/models/" + relayTestModel + ":generateContent", body: `{"contents":[{"role":"user","parts":[{"text":"hello there"}]}]}`, format: `"code":"1302"`},
	}
	for name, protocol := range protocols {
		t.Run("200 with an error code on "+name, func(t *testing.T) {
			harness := newRelayHarness(t)
			registerRelayPlugin(t, strings.ReplaceAll(vendorPlugin, "%KEY%", "relay-vendor"))
			harness.upstream.respond = respondWith(http.StatusOK, "application/json", rateLimited)
			harness.install(t, harness.pluginChannel("relay-vendor", "sk-static"))

			outcome := harness.post(t, protocol.path, protocol.body)

			assert.Equal(t, http.StatusTooManyRequests, outcome.status, outcome.body)
			assert.Contains(t, outcome.body, "too many requests")
			assert.Contains(t, outcome.body, protocol.format, "the error comes in the client's protocol")
			assert.Len(t, harness.upstream.captured(), 1)
			assert.Zero(t, outcome.quota, "an error reply is refunded")
		})
	}
	t.Run("a vendor error body on a 400", func(t *testing.T) {
		harness := newRelayHarness(t)
		registerRelayPlugin(t, strings.ReplaceAll(vendorPlugin, "%KEY%", "relay-vendor"))
		harness.upstream.respond = respondWith(http.StatusBadRequest, "text/plain", `{"code":1214,"msg":"prompt too long"}`)
		harness.install(t, harness.pluginChannel("relay-vendor", "sk-static"))

		outcome := harness.post(t, "/v1/chat/completions", relayTestBody)

		assert.Equal(t, http.StatusBadRequest, outcome.status, outcome.body)
		assert.Contains(t, outcome.body, "prompt too long")
		assert.Contains(t, outcome.body, `"code":"1214"`)
		assert.Zero(t, outcome.quota)
	})
	for name, tc := range map[string]struct {
		status, sends int
		reply         string
	}{
		"a mapped 429 is retried":     {status: http.StatusOK, reply: rateLimited, sends: 2},
		"a mapped 400 is not retried": {status: http.StatusBadRequest, reply: `{"code":1214,"msg":"prompt too long"}`, sends: 1},
	} {
		t.Run(name, func(t *testing.T) {
			previous := common.RetryTimes
			common.RetryTimes = 1
			t.Cleanup(func() { common.RetryTimes = previous })
			harness := newRelayHarness(t)
			registerRelayPlugin(t, strings.ReplaceAll(vendorPlugin, "%KEY%", "relay-vendor"))
			harness.upstream.respond = respondWith(tc.status, "application/json", tc.reply)
			harness.install(t, harness.pluginChannel("relay-vendor", "sk-static"))

			outcome := harness.post(t, "/v1/chat/completions", relayTestBody)

			assert.GreaterOrEqual(t, outcome.status, http.StatusBadRequest, outcome.body)
			assert.Len(t, harness.upstream.captured(), tc.sends)
			assert.Zero(t, outcome.quota)
		})
	}
}

func TestPluginStreamErrors(t *testing.T) {
	streamBody := strings.Replace(relayTestBody, `"max_tokens"`, `"stream":true,"max_tokens"`, 1)
	newVendor := func(t *testing.T) *relayHarness {
		harness := newRelayHarness(t)
		registerRelayPlugin(t, strings.ReplaceAll(vendorPlugin, "%KEY%", "relay-vendor-stream"))
		harness.install(t, harness.pluginChannel("relay-vendor-stream", "sk-static"))
		return harness
	}

	t.Run("an error before any output is an error status", func(t *testing.T) {
		harness := newVendor(t)
		harness.upstream.respond = respondWith(http.StatusOK, "text/event-stream", "data: {\"meta\":\"m\"}\n\ndata: {\"code\":1302,\"msg\":\"busy\"}\n\n")

		outcome := harness.post(t, "/v1/chat/completions", streamBody)

		assert.Equal(t, http.StatusTooManyRequests, outcome.status, outcome.body)
		assert.False(t, strings.HasPrefix(outcome.header.Get("Content-Type"), "text/event-stream"))
		assert.Contains(t, outcome.body, "busy")
		assert.Zero(t, outcome.quota)
	})

	t.Run("a stream silent for the streaming timeout before its first output fails", func(t *testing.T) {
		harness := newVendor(t)
		constant.StreamingTimeout = 1
		release := make(chan struct{})
		t.Cleanup(func() { close(release) })
		harness.upstream.respond = func(w http.ResponseWriter, _ int, _ capturedRequest) {
			w.Header().Set("Content-Type", "text/event-stream")
			_, _ = io.WriteString(w, ": keep-alive\n\ndata: {\"meta\":\"m\"}\n\n")
			w.(http.Flusher).Flush()
			<-release
		}

		outcome := harness.post(t, "/v1/chat/completions", streamBody)

		assert.GreaterOrEqual(t, outcome.status, http.StatusBadRequest, outcome.body)
		assert.False(t, strings.HasPrefix(outcome.header.Get("Content-Type"), "text/event-stream"))
		assert.Zero(t, outcome.quota)
	})

	// output is the client body of the vendor events "one" and "two".
	chunk := func(delta string) string {
		return `data: {"id":"chatcmpl-v","object":"chat.completion.chunk","created":1730000000,"model":"gpt-4o-mini","choices":[{"index":0,"delta":` + delta + "}]}\n\n"
	}
	output := chunk(`{"role":"assistant","content":"one"},"finish_reason":null`) +
		chunk(`{"role":"assistant","content":"two"},"finish_reason":null`) +
		chunk(`{},"finish_reason":"stop"`) +
		`data: {"id":"chatcmpl-v","object":"chat.completion.chunk","created":1730000000,"model":"gpt-4o-mini","choices":[],"usage":{"prompt_tokens":1000,"completion_tokens":2000,"total_tokens":3000}}` + "\n\n" +
		"data: [DONE]\n\n"
	// slowVendor sends the dropped event count times every interval, then
	// "one" and "two".
	slowVendor := func(count int, interval time.Duration) func(w http.ResponseWriter, attempt int, request capturedRequest) {
		return func(w http.ResponseWriter, _ int, _ capturedRequest) {
			w.Header().Set("Content-Type", "text/event-stream")
			w.(http.Flusher).Flush()
			for range count {
				time.Sleep(interval)
				_, _ = io.WriteString(w, "data: {\"meta\":\"m\"}\n\n")
				w.(http.Flusher).Flush()
			}
			_, _ = io.WriteString(w, "data: {\"text\":\"one\"}\n\ndata: {\"text\":\"two\"}\n\n")
		}
	}

	t.Run("the events converted before the first output are delivered in order", func(t *testing.T) {
		harness := newVendor(t)
		harness.upstream.respond = respondWith(http.StatusOK, "text/event-stream", "data: {\"meta\":\"m\"}\n\ndata: {\"text\":\"one\"}\n\ndata: {\"text\":\"two\"}\n\n")

		outcome := harness.post(t, "/v1/chat/completions", streamBody)

		require.Equal(t, http.StatusOK, outcome.status, outcome.body)
		assert.Equal(t, output, outcome.body)
		assert.EqualValues(t, 2000, outcome.log.CompletionTokens)
		assert.Positive(t, outcome.quota)
	})

	t.Run("dropped events keep the stream alive past the streaming timeout", func(t *testing.T) {
		harness := newVendor(t)
		constant.StreamingTimeout = 1
		harness.upstream.respond = slowVendor(6, 300*time.Millisecond)

		outcome := harness.post(t, "/v1/chat/completions", streamBody)

		require.Equal(t, http.StatusOK, outcome.status, outcome.body)
		assert.Equal(t, output, outcome.body)
		assert.Positive(t, outcome.quota)
	})

	t.Run("dropped events after the first output keep the stream alive past the streaming timeout", func(t *testing.T) {
		harness := newVendor(t)
		constant.StreamingTimeout = 1
		harness.upstream.respond = func(w http.ResponseWriter, _ int, _ capturedRequest) {
			w.Header().Set("Content-Type", "text/event-stream")
			_, _ = io.WriteString(w, "data: {\"text\":\"one\"}\n\n")
			w.(http.Flusher).Flush()
			for range 6 {
				time.Sleep(300 * time.Millisecond)
				_, _ = io.WriteString(w, "data: {\"meta\":\"m\"}\n\n")
				w.(http.Flusher).Flush()
			}
			_, _ = io.WriteString(w, "data: {\"text\":\"two\"}\n\n")
		}

		outcome := harness.post(t, "/v1/chat/completions", streamBody)

		require.Equal(t, http.StatusOK, outcome.status, outcome.body)
		assert.Equal(t, output, outcome.body)
		assert.EqualValues(t, 2000, outcome.log.CompletionTokens)
	})

	t.Run("keep-alive pings go out before the first output", func(t *testing.T) {
		harness := newVendor(t)
		settings := operation_setting.GetGeneralSetting()
		previousEnabled, previousSeconds := settings.PingIntervalEnabled, settings.PingIntervalSeconds
		settings.PingIntervalEnabled, settings.PingIntervalSeconds = true, 1
		t.Cleanup(func() { settings.PingIntervalEnabled, settings.PingIntervalSeconds = previousEnabled, previousSeconds })
		harness.upstream.respond = slowVendor(5, 500*time.Millisecond)

		outcome := harness.post(t, "/v1/chat/completions", streamBody)

		require.Equal(t, http.StatusOK, outcome.status, outcome.body)
		pings, rest, found := strings.Cut(outcome.body, "data: ")
		require.True(t, found, outcome.body)
		assert.GreaterOrEqual(t, strings.Count(pings, ": PING\n\n"), 2, outcome.body)
		assert.Equal(t, strings.Repeat(": PING\n\n", strings.Count(pings, ": PING\n\n")), pings, "only pings come before the first event")
		assert.Equal(t, output, strings.ReplaceAll("data: "+rest, ": PING\n\n", ""))
		assert.EqualValues(t, 2000, outcome.log.CompletionTokens)
		assert.Positive(t, outcome.quota)
		assert.Equal(t, outcome.log.Quota, outcome.quota)
	})

	t.Run("an error after output ends the stream as a read error does", func(t *testing.T) {
		harness := newVendor(t)
		harness.upstream.respond = respondWith(http.StatusOK, "text/event-stream", "data: {\"text\":\"one\"}\n\ndata: {\"code\":1302,\"msg\":\"busy\"}\n\ndata: {\"text\":\"two\"}\n\n")
		pluginError := harness.post(t, "/v1/chat/completions", streamBody)

		harness.upstream.respond = func(w http.ResponseWriter, _ int, _ capturedRequest) {
			w.Header().Set("Content-Type", "text/event-stream")
			_, _ = io.WriteString(w, "data: {\"text\":\"one\"}\n\n")
			w.(http.Flusher).Flush()
			conn, _, err := w.(http.Hijacker).Hijack()
			if err == nil {
				_ = conn.Close()
			}
		}
		readError := harness.post(t, "/v1/chat/completions", streamBody)

		require.Equal(t, http.StatusOK, pluginError.status, pluginError.body)
		assert.Contains(t, pluginError.body, `"content":"one"`)
		assert.NotContains(t, pluginError.body, `"content":"two"`)
		assert.NotContains(t, pluginError.body, "busy")
		assert.Equal(t, readError.status, pluginError.status)
		assert.Equal(t, readError.body, pluginError.body)
		assert.Equal(t, readError.quota, pluginError.quota)
		assert.Equal(t, readError.log.CompletionTokens, pluginError.log.CompletionTokens)
	})
}

// passThroughConverters relay an upstream that already answers in OpenAI
// chat, and turn its code 1001 reply or event into a 401.
const passThroughConverters = `
export function convertResponse(ctx, resp) {
  const body = JSON.parse(resp.body);
  if (body.code === 1001) return {error: {status: 401, message: body.msg}};
  return {body: resp.body};
}
export function convertStreamEvent(ctx, input) {
  if (input.done) return {};
  if (input.data === "[DONE]") return {events: [{data: "[DONE]"}]};
  const body = JSON.parse(input.data);
  if (body.code === 1001) return {error: {status: 401, message: body.msg}};
  return {events: [{data: input.data}]};
}
`

func TestPluginErrorRejectsTheCredential(t *testing.T) {
	streamBody := strings.Replace(relayTestBody, `"max_tokens"`, `"stream":true,"max_tokens"`, 1)
	for name, tc := range map[string]struct{ body, wantText string }{
		"reply":  {body: relayTestBody, wantText: `"content":"hi"`},
		"stream": {body: streamBody, wantText: "data: [DONE]"},
	} {
		t.Run(name, func(t *testing.T) {
			harness := newRelayHarness(t)
			key := "relay-plugin-401-" + name
			registerRelayPlugin(t, strings.NewReplacer("%KEY%", key, `upstream_path: "/chat"}`, `upstream_path: "/chat", converter: "plugin"}`,
				"%EXTRA%", `export function convertRequest(ctx, req) { return {body: req.body}; }`+passThroughConverters).Replace(rotatingPlugin))
			harness.upstream.respond = rejectOldCredential(http.StatusOK, `{"code":1001,"msg":"token expired"}`)
			channel := harness.install(t, harness.pluginChannel(key, credentialFor(t, key, 0)))

			outcome := harness.post(t, "/v1/chat/completions", tc.body)

			require.Equal(t, http.StatusOK, outcome.status, outcome.body)
			assert.Contains(t, outcome.body, tc.wantText)
			assert.NotContains(t, outcome.body, "token expired")
			requests := harness.upstream.captured()
			require.Len(t, requests, 3, "one send, one refresh, one resend")
			assert.Len(t, requestsTo(requests, "/oauth/token"), 1)
			assert.Equal(t, "Bearer old-access", requests[0].Header.Get("Authorization"))
			assert.Equal(t, "Bearer new-access", requests[2].Header.Get("Authorization"))
			assert.Equal(t, requests[0].Body, requests[2].Body, "the resend carries the same converted body")
			assert.Positive(t, outcome.quota)
			stored, err := model.GetChannelById(channel.Id, true)
			require.NoError(t, err)
			assert.Contains(t, stored.Key, "new-refresh")
		})
	}
}

func TestPluginConverterPath(t *testing.T) {
	const source = `
export const meta = {apiVersion: 1, key: "relay-path", name: "Path", version: "1.0.0", author: {name: "Test"}, relay: [
  {incoming_path: "/v1/chat/completions", upstream_path: "%UPSTREAM%", converter: "plugin"}
]};
export function login() { return {type: "pending"}; }
export function convertRequest(ctx, req) {
  return {body: req.body, path: %PATH%};
}
export function signRequest(ctx, req) {
  return {headers: {"X-Signed-Url": req.url}, query: {sig: "1"}};
}
` + passThroughConverters
	const choosePath = `req.stream ? "/v1/stream-endpoint?alt=sse" : "/v1/generate"`
	streamBody := strings.Replace(relayTestBody, `"max_tokens"`, `"stream":true,"max_tokens"`, 1)
	for name, tc := range map[string]struct {
		fullURL    bool
		body, path string
	}{
		"non-stream":                  {body: relayTestBody, path: "/v1/generate"},
		"stream":                      {body: streamBody, path: "/v1/stream-endpoint?alt=sse"},
		"on a full-URL upstream_path": {fullURL: true, body: relayTestBody, path: "/v1/generate"},
	} {
		t.Run(name, func(t *testing.T) {
			harness := newRelayHarness(t)
			upstreamPath := "/chat?fixed=1"
			channel := harness.pluginChannel("relay-path", credentialFor(t, "relay-path", 0))
			if tc.fullURL {
				upstreamPath = harness.upstream.URL + "/ignored/{model}?fixed=1"
				unused := "http://127.0.0.1:9/base"
				channel.BaseURL = &unused
			}
			registerRelayPlugin(t, strings.NewReplacer("%UPSTREAM%", upstreamPath, "%PATH%", choosePath).Replace(source))
			harness.install(t, channel)

			outcome := harness.post(t, "/v1/chat/completions", tc.body)

			require.Equal(t, http.StatusOK, outcome.status, outcome.body)
			requests := harness.upstream.captured()
			require.Len(t, requests, 1)
			signedPath, signedQuery, _ := strings.Cut(tc.path, "?")
			wantSigned := signedPath + "?account=acct-1"
			if signedQuery != "" {
				wantSigned += "&" + signedQuery
			}
			assert.Equal(t, harness.upstream.URL+wantSigned, requests[0].Header.Get("X-Signed-Url"), "signRequest sees the final URL with the credential query")
			assert.Equal(t, wantSigned+"&sig=1", requests[0].URL)
			assert.Equal(t, "Bearer old-access", requests[0].Header.Get("Authorization"))
			assert.Positive(t, outcome.quota)
		})
	}
	// Subtest names stay plain: the test database is named after them.
	for name, path := range map[string]string{
		"protocol-relative": "//evil.example/x",
		"full URL":          "https://x/y",
		"dot-dot segment":   "/a/../b",
		"relative":          "relative",
		"fragment":          "/a#frag",
	} {
		t.Run("rejects a "+name+" path", func(t *testing.T) {
			harness := newRelayHarness(t)
			quoted, err := json.Marshal(path)
			require.NoError(t, err)
			registerRelayPlugin(t, strings.NewReplacer("%UPSTREAM%", "/chat", "%PATH%", string(quoted)).Replace(source))
			harness.install(t, harness.pluginChannel("relay-path", credentialFor(t, "relay-path", 0)))

			outcome := harness.post(t, "/v1/chat/completions", relayTestBody)

			assert.GreaterOrEqual(t, outcome.status, http.StatusBadRequest, outcome.body)
			assert.Contains(t, outcome.body, "path must start with a single /")
			assert.Empty(t, harness.upstream.captured())
			assert.Zero(t, outcome.quota)
		})
	}
}

// pluginAndAdvancedCustom registers a plugin whose converter routes send
// each incoming path to /vendor plus the path, and returns its channel and an
// Advanced Custom channel with native routes to /std plus the path.
func (h *relayHarness) pluginAndAdvancedCustom(t *testing.T, key, hooks string, paths ...string) (provider, advanced *model.Channel) {
	t.Helper()
	pluginRoutes := make([]string, 0, len(paths))
	routes := make([]dto.AdvancedCustomRoute, 0, len(paths))
	for _, path := range paths {
		pluginRoutes = append(pluginRoutes, fmt.Sprintf(`{incoming_path: %q, upstream_path: %q, converter: "plugin"}`, path, "/vendor"+path))
		routes = append(routes, dto.AdvancedCustomRoute{IncomingPath: path, UpstreamPath: "/std" + path})
	}
	registerRelayPlugin(t, `export const meta = {apiVersion: 1, key: "`+key+`", name: "Endpoints", version: "1.0.0", author: {name: "Test"}, relay: [`+
		strings.Join(pluginRoutes, ",")+`]};`+hooks)
	advanced = h.newChannel(constant.ChannelTypeAdvancedCustom, "sk-static")
	advanced.SetOtherSettings(dto.ChannelOtherSettings{AdvancedCustom: &dto.AdvancedCustomConfig{Routes: routes}})
	require.NoError(t, advanced.GetOtherSettings().AdvancedCustom.Validate())
	return h.pluginChannel(key, "sk-static"), advanced
}

// assertBilledAlike checks that a plugin channel billed a request as the
// Advanced Custom channel did.
func assertBilledAlike(t *testing.T, want, got relayOutcome) {
	t.Helper()
	assert.Equal(t, want.quota, got.quota)
	assert.Equal(t, want.log.Quota, got.log.Quota)
	assert.Equal(t, want.log.PromptTokens, got.log.PromptTokens)
	assert.Equal(t, want.log.CompletionTokens, got.log.CompletionTokens)
}

// wrappingConverters connect a vendor that answers each endpoint in a
// wrapper: a reply as {"result": text}, a stream event as {"chunk": text},
// and embeddings in a format of its own.
const wrappingConverters = `
export function convertRequest(ctx, req) { return {body: {input: req.body, model: req.model, stream: req.stream}}; }
export function convertResponse(ctx, resp) {
  const body = JSON.parse(resp.body);
  if (body.vectors) {
    return {body: {object: "list", data: body.vectors.map((embedding, index) => ({object: "embedding", index: index, embedding: embedding})),
      model: "m", usage: {prompt_tokens: body.tokens, total_tokens: body.tokens}}};
  }
  return {body: body.result};
}
export function convertStreamEvent(ctx, input) {
  return input.done ? {} : {events: [{data: JSON.parse(input.data).chunk}]};
}
`

// wrapForVendor is the vendor's answer for wrappingConverters: the standard
// reply wrapped, or its stream with every event's data wrapped.
func wrapForVendor(t *testing.T, standard string, stream bool) string {
	t.Helper()
	wrap := func(name, text string) string {
		wrapped, err := json.Marshal(map[string]string{name: text})
		require.NoError(t, err)
		return string(wrapped)
	}
	if !stream {
		return wrap("result", standard)
	}
	var vendor strings.Builder
	for line := range strings.SplitSeq(standard, "\n") {
		if data, ok := strings.CutPrefix(line, "data: "); ok {
			line = "data: " + wrap("chunk", data)
		}
		vendor.WriteString(line + "\n")
	}
	return vendor.String()
}

// Every relayed endpoint but realtime takes a plugin converter, and the reply
// it converts is billed as an Advanced Custom channel bills the same reply.
func TestPluginConverterEndpointsBillLikeAdvancedCustom(t *testing.T) {
	const (
		embeddingBody = `{"model":"` + relayTestModel + `","input":"hello there"}`
		embedding     = `{"object":"list","data":[{"object":"embedding","index":0,"embedding":[0.1,0.2]}],"model":"m","usage":{"prompt_tokens":500,"total_tokens":500}}`
		completion    = `{"id":"cmpl-1","object":"text_completion","created":1730000000,"model":"gpt-4o-mini","choices":[{"text":"hi","index":0,"finish_reason":"stop"}],"usage":{"prompt_tokens":1000,"completion_tokens":2000,"total_tokens":3000}}`
		completions   = "data: {\"id\":\"cmpl-1\",\"object\":\"text_completion\",\"created\":1730000000,\"model\":\"gpt-4o-mini\",\"choices\":[{\"text\":\"hi\",\"index\":0,\"finish_reason\":null}]}\n\n" +
			"data: {\"id\":\"cmpl-1\",\"object\":\"text_completion\",\"created\":1730000000,\"model\":\"gpt-4o-mini\",\"choices\":[],\"usage\":{\"prompt_tokens\":1000,\"completion_tokens\":2000,\"total_tokens\":3000}}\n\n" +
			"data: [DONE]\n\n"
		speech = "data: {\"type\":\"speech.audio.delta\",\"audio\":\"AAEC\"}\n\n" +
			"data: {\"type\":\"speech.audio.done\",\"usage\":{\"input_tokens\":100,\"output_tokens\":400,\"total_tokens\":500}}\n\n"
	)
	for name, tc := range map[string]struct {
		path, body, standard, vendor string
		stream                       bool
		// model is the one the endpoint names when the body names none.
		model string
		// unbilled replies carry no usage. The host then bills its request
		// estimate, which is 0 here because these tests leave CountToken off.
		unbilled bool
	}{
		"embeddings in a vendor format": {path: "/v1/embeddings", body: embeddingBody, standard: embedding, vendor: `{"vectors":[[0.1,0.2]],"tokens":500}`},
		"embeddings without usage":      {path: "/v1/embeddings", body: embeddingBody, standard: `{"object":"list","data":[{"object":"embedding","index":0,"embedding":[0.1]}],"model":"m"}`, unbilled: true},
		"gemini embedContent": {path: "/v1beta/models/" + relayTestModel + ":embedContent", body: `{"content":{"parts":[{"text":"hello there"}]}}`,
			standard: `{"embedding":{"values":[0.1,0.2]}}`, unbilled: true},
		"rerank": {path: "/v1/rerank", body: `{"model":"` + relayTestModel + `","query":"which","documents":["a","b"]}`,
			standard: `{"results":[{"index":1,"relevance_score":0.9}],"usage":{"prompt_tokens":100,"total_tokens":100}}`},
		"completions":        {path: "/v1/completions", body: `{"model":"` + relayTestModel + `","prompt":"hello there","max_tokens":16}`, standard: completion},
		"completions stream": {path: "/v1/completions", body: `{"model":"` + relayTestModel + `","prompt":"hello there","max_tokens":16,"stream":true}`, standard: completions, stream: true},
		"image generations": {path: "/v1/images/generations", body: `{"model":"` + relayTestModel + `","prompt":"a cat","n":2}`,
			standard: `{"created":1730000000,"data":[{"url":"https://img.example/1.png"},{"url":"https://img.example/2.png"}]}`},
		"responses compact": {path: "/v1/responses/compact", body: `{"model":"` + relayTestModel + `","input":"hello there"}`,
			standard: `{"id":"resp_1","object":"response.compaction","created_at":1730000000,"output":[],"usage":{"input_tokens":1000,"output_tokens":200,"total_tokens":1200}}`},
		"alpha search": {path: "/v1/alpha/search", body: `{"model":"` + relayTestModel + `","query":"weather"}`, standard: `{"results":[{"title":"Weather","url":"https://w.example"}]}`},
		"deepseek tools search": {path: "/v1/tools/search", body: `{"query":"weather"}`, model: constant.DeepSeekSearchModel,
			standard: `{"results":[{"title":"Weather","url":"https://w.example"}]}`},
		"speech stream": {path: "/v1/audio/speech", body: `{"model":"` + relayTestModel + `","input":"hello there","voice":"alloy","stream_format":"sse"}`, standard: speech, stream: true},
	} {
		t.Run(name, func(t *testing.T) {
			harness := newRelayHarness(t)
			provider, advanced := harness.pluginAndAdvancedCustom(t, "relay-endpoints", wrappingConverters, tc.path)
			if tc.model != "" {
				provider.Models, advanced.Models = tc.model, tc.model
			}
			vendor := tc.vendor
			if vendor == "" {
				vendor = wrapForVendor(t, tc.standard, tc.stream)
			}
			harness.upstream.respond = func(w http.ResponseWriter, _ int, request capturedRequest) {
				w.Header().Set("Content-Type", "application/json")
				if tc.stream {
					w.Header().Set("Content-Type", "text/event-stream")
				}
				reply := tc.standard
				if strings.HasPrefix(request.URL, "/vendor") {
					reply = vendor
				}
				_, _ = io.WriteString(w, reply)
			}
			run := func(channel *model.Channel) (capturedRequest, relayOutcome) {
				harness.install(t, channel)
				harness.upstream.reset()
				outcome := harness.post(t, tc.path, tc.body)
				require.Equal(t, http.StatusOK, outcome.status, outcome.body)
				requests := harness.upstream.captured()
				require.Len(t, requests, 1)
				return requests[0], outcome
			}

			wantRequest, want := run(advanced)
			gotRequest, got := run(provider)

			var converted struct {
				Input  json.RawMessage `json:"input"`
				Stream bool            `json:"stream"`
			}
			require.NoError(t, json.Unmarshal([]byte(gotRequest.Body), &converted))
			assert.JSONEq(t, wantRequest.Body, string(converted.Input), "convertRequest gets the body the native route sends")
			assert.Equal(t, tc.stream, converted.Stream)
			assert.Equal(t, normalizedReply(want.body), normalizedReply(got.body))
			assert.Equal(t, want.header.Get("Content-Type"), got.header.Get("Content-Type"))
			if !tc.unbilled {
				assert.Positive(t, want.quota)
			}
			assertBilledAlike(t, want, got)
		})
	}
}

// speechConverters connect a speech vendor that answers with audio as hex or
// base64 inside JSON, or as the reply itself.
const speechConverters = `
export function convertRequest(ctx, req) { return {body: {text: req.body.input, model: req.model}}; }
export function convertResponse(ctx, resp) {
  if ("bodyBase64" in resp) return {bodyBase64: resp.bodyBase64, contentType: resp.headers["Content-Type"]};
  const body = JSON.parse(resp.body);
  if (body.audio_base64) return {bodyBase64: body.audio_base64, contentType: "audio/mpeg"};
  const bytes = body.data.audio.match(/../g).map(pair => String.fromCharCode(parseInt(pair, 16))).join("");
  return {bodyBase64: btoa(bytes), contentType: "audio/mpeg"};
}
export function convertStreamEvent() { return {}; }
`

// A binary reply reaches the client byte for byte with the content type the
// plugin set, and is billed as the same audio from an Advanced Custom channel.
func TestPluginConverterBinaryReplies(t *testing.T) {
	// Not a decodable MP3: the bill is estimated from the size, which is large
	// enough to cost more than nothing.
	audio := bytes.Repeat([]byte{0xff, 0xfb, 0x90, 0x64, 0x00, 0x0f, 0xf0, 0x00, 0x80, 0x7f, 0xfe, 0xc3, 0x28}, 4000)
	const speechBody = `{"model":"` + relayTestModel + `","input":"hello there","voice":"alloy"}`
	for name, vendor := range map[string]struct {
		contentType string
		reply       []byte
	}{
		"hex audio in JSON":    {"application/json", []byte(`{"data":{"audio":"` + hex.EncodeToString(audio) + `"}}`)},
		"base64 audio in JSON": {"application/json", []byte(`{"audio_base64":"` + base64.StdEncoding.EncodeToString(audio) + `"}`)},
		"raw audio":            {"audio/mpeg", audio},
	} {
		t.Run(name, func(t *testing.T) {
			harness := newRelayHarness(t)
			provider, advanced := harness.pluginAndAdvancedCustom(t, "relay-speech", speechConverters, "/v1/audio/speech")
			harness.upstream.respond = func(w http.ResponseWriter, _ int, request capturedRequest) {
				if strings.HasPrefix(request.URL, "/vendor") {
					w.Header().Set("Content-Type", vendor.contentType)
					_, _ = w.Write(vendor.reply)
					return
				}
				w.Header().Set("Content-Type", "audio/mpeg")
				_, _ = w.Write(audio)
			}
			harness.install(t, advanced)
			want := harness.post(t, "/v1/audio/speech", speechBody)
			harness.install(t, provider)
			harness.upstream.reset()

			got := harness.post(t, "/v1/audio/speech", speechBody)

			require.Equal(t, http.StatusOK, got.status, got.body)
			assert.Equal(t, audio, []byte(got.body))
			assert.Equal(t, "audio/mpeg", got.header.Get("Content-Type"))
			requests := harness.upstream.captured()
			require.Len(t, requests, 1)
			assert.JSONEq(t, `{"text":"hello there","model":"`+relayTestModel+`"}`, requests[0].Body)
			assert.Equal(t, audio, []byte(want.body))
			assert.Positive(t, got.quota)
			assertBilledAlike(t, want, got)
		})
	}
}

// formConverters connect a transcription and image editing vendor. The
// client's shape field picks the request the plugin builds of its form.
const formConverters = `
export function convertRequest(ctx, req) {
  if (!req.form) return {body: {input: req.body.input, audio: {"$file": "file", encoding: "base64"}}};
  const fields = req.form.fields;
  switch (fields.shape) {
  case "form": return {form: {fields: {lang: fields.language, model: fields.model, format: fields.response_format}, files: [{field: "audio", from: "file"}]}};
  case "base64": return {body: {model: req.model, audio: {"$file": "file", encoding: "base64"}}};
  case "dataUrl": return {body: {model: req.model, audio: {"$file": "file", encoding: "dataUrl"}}};
  case "raw": return {file: "file", path: "/vendor/raw"};
  case "edit": return {body: {prompt: fields.prompt, model: req.model, images: [{"$file": "image[]", encoding: "dataUrl"}, {"$file": "image[]#1", encoding: "base64"}]}};
  case "two shapes": return {body: "x", file: "file"};
  case "unknown marker": return {body: {audio: {"$file": "nope", encoding: "base64"}}};
  case "incomplete marker": return {body: {audio: {"$file": "file"}}};
  case "unknown form file": return {form: {files: [{field: "audio", from: "nope"}]}};
  case "unknown raw file": return {file: "nope"};
  }
  throw new Error("no shape " + fields.shape);
}
export function convertResponse(ctx, resp) {
  const body = JSON.parse(resp.body);
  if (body.images) return {body: {created: 1730000000, data: body.images.map(image => ({b64_json: image}))}};
  if (body.format === "text") return {body: body.transcript, contentType: "text/plain; charset=utf-8"};
  return {body: {text: body.transcript, usage: {type: "tokens", input_tokens: body.input, output_tokens: body.output, total_tokens: body.input + body.output}}};
}
export function convertStreamEvent() { return {}; }
`

type formFile struct {
	field, filename, contentType string
	content                      []byte
}

// multipartRequest is a client's multipart body and its content type.
func multipartRequest(t *testing.T, fields map[string]string, files ...formFile) (string, string) {
	t.Helper()
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	for _, name := range slices.Sorted(maps.Keys(fields)) {
		require.NoError(t, writer.WriteField(name, fields[name]))
	}
	for _, file := range files {
		part, err := writer.CreatePart(textproto.MIMEHeader{
			"Content-Disposition": {multipart.FileContentDisposition(file.field, file.filename)},
			"Content-Type":        {file.contentType},
		})
		require.NoError(t, err)
		_, err = part.Write(file.content)
		require.NoError(t, err)
	}
	require.NoError(t, writer.Close())
	return writer.FormDataContentType(), body.String()
}

// transcriptionVendor answers the plugin's transcription vendor and the
// Advanced Custom upstream, as text when the request asks for it.
func transcriptionVendor(w http.ResponseWriter, _ int, request capturedRequest) {
	w.Header().Set("Content-Type", "application/json")
	switch {
	case strings.HasPrefix(request.URL, "/std") && strings.Contains(request.Body, "name=\"response_format\"\r\n\r\ntext"):
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		_, _ = io.WriteString(w, "hello there")
	case strings.HasPrefix(request.URL, "/std"):
		_, _ = io.WriteString(w, `{"text":"hello there","usage":{"type":"tokens","input_tokens":1000,"output_tokens":20,"total_tokens":1020}}`)
	case strings.Contains(request.Body, "name=\"format\"\r\n\r\ntext"):
		_, _ = io.WriteString(w, `{"transcript":"hello there","format":"text"}`)
	default:
		_, _ = io.WriteString(w, `{"transcript":"hello there","input":1000,"output":20}`)
	}
}

var speechFile = formFile{field: "file", filename: "speech.wav", contentType: "audio/wav", content: []byte("RIFF\x00\x01\xff\xfeWAVEfmt \x80\x81\x82")}

// A multipart client request reaches a vendor as the form, JSON or file the
// plugin builds of it, and is billed as on an Advanced Custom channel.
func TestPluginConverterMultipartRequests(t *testing.T) {
	encoded := base64.StdEncoding.EncodeToString(speechFile.content)
	transcription := func(shape, format string) (string, string) {
		return multipartRequest(t, map[string]string{"model": relayTestModel, "language": "en", "shape": shape, "response_format": format}, speechFile)
	}
	harness := newRelayHarness(t)
	provider, advanced := harness.pluginAndAdvancedCustom(t, "relay-forms", formConverters, "/v1/audio/transcriptions", "/v1/images/edits")
	harness.upstream.respond = transcriptionVendor
	harness.install(t, advanced)
	want := map[string]relayOutcome{}
	for _, format := range []string{"json", "text"} {
		contentType, body := transcription("form", format)
		want[format] = harness.send(t, "/v1/audio/transcriptions", contentType, body)
		require.Equal(t, http.StatusOK, want[format].status, want[format].body)
	}
	assert.Positive(t, want["json"].quota, "settled on the usage of the reply")
	harness.install(t, provider)

	for name, tc := range map[string]struct {
		shape, format, reply, replyType string
		sent                            func(t *testing.T, request capturedRequest)
	}{
		"a rebuilt form": {shape: "form", format: "json", sent: func(t *testing.T, request capturedRequest) {
			mediaType, params, err := mime.ParseMediaType(request.Header.Get("Content-Type"))
			require.NoError(t, err)
			assert.Equal(t, "multipart/form-data", mediaType)
			form, err := multipart.NewReader(strings.NewReader(request.Body), params["boundary"]).ReadForm(1 << 20)
			require.NoError(t, err)
			assert.Equal(t, map[string][]string{"lang": {"en"}, "model": {relayTestModel}, "format": {"json"}}, form.Value)
			require.Len(t, form.File, 1)
			require.Len(t, form.File["audio"], 1)
			audio := form.File["audio"][0]
			assert.Equal(t, "speech.wav", audio.Filename)
			assert.Equal(t, "audio/wav", audio.Header.Get("Content-Type"))
			file, err := audio.Open()
			require.NoError(t, err)
			content, err := io.ReadAll(file)
			require.NoError(t, err)
			assert.Equal(t, speechFile.content, content)
		}},
		"base64 in JSON": {shape: "base64", format: "json", sent: func(t *testing.T, request capturedRequest) {
			assert.Equal(t, "application/json", request.Header.Get("Content-Type"))
			assert.Equal(t, `{"model":"`+relayTestModel+`","audio":"`+encoded+`"}`, request.Body)
		}},
		"a data URL in JSON": {shape: "dataUrl", format: "json", sent: func(t *testing.T, request capturedRequest) {
			assert.Equal(t, `{"model":"`+relayTestModel+`","audio":"data:audio/wav;base64,`+encoded+`"}`, request.Body)
		}},
		"the raw file": {shape: "raw", format: "json", sent: func(t *testing.T, request capturedRequest) {
			assert.Equal(t, "/vendor/raw", request.URL)
			assert.Equal(t, "audio/wav", request.Header.Get("Content-Type"))
			assert.Equal(t, speechFile.content, []byte(request.Body))
		}},
		"a text reply": {shape: "form", format: "text", reply: "hello there", replyType: "text/plain; charset=utf-8"},
	} {
		t.Run(name, func(t *testing.T) {
			harness.upstream.reset()

			contentType, body := transcription(tc.shape, tc.format)
			got := harness.send(t, "/v1/audio/transcriptions", contentType, body)

			require.Equal(t, http.StatusOK, got.status, got.body)
			requests := harness.upstream.captured()
			require.Len(t, requests, 1)
			if tc.sent != nil {
				tc.sent(t, requests[0])
			}
			if tc.reply == "" {
				assert.JSONEq(t, want[tc.format].body, got.body)
				assert.Equal(t, "application/json", got.header.Get("Content-Type"))
			} else {
				assert.Equal(t, tc.reply, got.body)
				assert.Equal(t, tc.replyType, got.header.Get("Content-Type"))
			}
			assertBilledAlike(t, want[tc.format], got)
		})
	}

	t.Run("an image edit", func(t *testing.T) {
		images := []formFile{
			{field: "image[]", filename: "a.png", contentType: "image/png", content: []byte("\x89PNG\r\n\x1a\nfirst")},
			{field: "image[]", filename: "b.png", contentType: "image/png", content: []byte("\x89PNG\r\n\x1a\nsecond")},
		}
		contentType, body := multipartRequest(t, map[string]string{"model": relayTestModel, "prompt": "a hat", "n": "1", "shape": "edit"}, images...)
		harness.upstream.respond = func(w http.ResponseWriter, _ int, request capturedRequest) {
			w.Header().Set("Content-Type", "application/json")
			if strings.HasPrefix(request.URL, "/std") {
				_, _ = io.WriteString(w, `{"created":1730000000,"data":[{"b64_json":"aW1n"}]}`)
				return
			}
			_, _ = io.WriteString(w, `{"images":["aW1n"]}`)
		}
		harness.install(t, advanced)
		want := harness.send(t, "/v1/images/edits", contentType, body)
		require.Equal(t, http.StatusOK, want.status, want.body)
		harness.install(t, provider)
		harness.upstream.reset()

		got := harness.send(t, "/v1/images/edits", contentType, body)

		require.Equal(t, http.StatusOK, got.status, got.body)
		requests := harness.upstream.captured()
		require.Len(t, requests, 1)
		assert.Equal(t, `{"prompt":"a hat","model":"`+relayTestModel+`","images":["data:image/png;base64,`+
			base64.StdEncoding.EncodeToString(images[0].content)+`","`+base64.StdEncoding.EncodeToString(images[1].content)+`"]}`, requests[0].Body)
		assert.Equal(t, normalizedReply(want.body), normalizedReply(got.body))
		assert.Positive(t, got.quota)
		assertBilledAlike(t, want, got)
	})
}

// A conversion the host cannot send fails before anything reaches the vendor
// and costs nothing.
func TestPluginConverterRequestFailures(t *testing.T) {
	harness := newRelayHarness(t)
	provider, _ := harness.pluginAndAdvancedCustom(t, "relay-form-failures", formConverters, "/v1/audio/transcriptions", "/v1/embeddings")
	harness.install(t, provider)
	for name, message := range map[string]string{
		"two shapes":        "must have only one of body, form, file and websocket",
		"unknown marker":    `$file "nope" names no client file`,
		"incomplete marker": `a $file marker must be {"$file": "<client file>", "encoding": "base64" or "dataUrl"}`,
		"unknown form file": `form file "nope" names no client file`,
		"unknown raw file":  `file "nope" names no client file`,
	} {
		t.Run(name, func(t *testing.T) {
			harness.upstream.reset()
			contentType, body := multipartRequest(t, map[string]string{"model": relayTestModel, "shape": name}, speechFile)

			outcome := harness.send(t, "/v1/audio/transcriptions", contentType, body)

			assert.GreaterOrEqual(t, outcome.status, http.StatusBadRequest, outcome.body)
			var reply struct {
				Error struct{ Message string } `json:"error"`
			}
			require.NoError(t, json.Unmarshal([]byte(outcome.body), &reply))
			assert.Contains(t, reply.Error.Message, message)
			assert.Empty(t, harness.upstream.captured())
			assert.Zero(t, outcome.quota)
		})
	}
	t.Run("a marker on a JSON request", func(t *testing.T) {
		harness.upstream.reset()

		outcome := harness.post(t, "/v1/embeddings", `{"model":"`+relayTestModel+`","input":"hello there"}`)

		assert.GreaterOrEqual(t, outcome.status, http.StatusBadRequest, outcome.body)
		assert.Contains(t, outcome.body, "$file markers need a multipart client request")
		assert.Empty(t, harness.upstream.captured())
		assert.Zero(t, outcome.quota)
	})
}

// prepareRequest sees the markers, signRequest the hash of the bytes with the
// files in them, and a resend after a refresh sends the same bytes.
func TestPluginConverterSignsTheFinalBytes(t *testing.T) {
	harness := newRelayHarness(t)
	registerRelayPlugin(t, `export const meta = {apiVersion: 1, key: "relay-form-sign", name: "Sign", version: "1.0.0", author: {name: "Test"}, relay: [
  {incoming_path: "/v1/audio/transcriptions", upstream_path: "/vendor/asr", converter: "plugin"}
]};
export function refresh(ctx) {
  const response = utils.fetch({url: ctx.baseUrl + "/oauth/token", method: "POST", body: "{}"});
  if (response.status !== 200) throw new Error("refresh failed with " + response.status);
  return {credential: {access: "new-access", refresh: "new-refresh"}, headers: {Authorization: "Bearer new-access"}, expiresAt: utils.unixNow() + 3600};
}
export function prepareRequest(ctx, req) {
  return {effects: [{type: "json.patch", ops: [{op: "add", path: "/saw_marker", value: req.body.audio["$file"] === "file"}]}]};
}
export function signRequest(ctx, req) { return {headers: {"X-Body-Sha256": req.bodySha256}}; }
`+formConverters)
	harness.upstream.respond = func(w http.ResponseWriter, _ int, request capturedRequest) {
		w.Header().Set("Content-Type", "application/json")
		switch {
		case request.URL == "/oauth/token":
			_, _ = io.WriteString(w, `{}`)
		case request.Header.Get("Authorization") == "Bearer old-access":
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = io.WriteString(w, `{}`)
		default:
			_, _ = io.WriteString(w, `{"transcript":"hello there"}`)
		}
	}
	harness.install(t, harness.pluginChannel("relay-form-sign", credentialFor(t, "relay-form-sign", 0)))
	contentType, body := multipartRequest(t, map[string]string{"model": relayTestModel, "shape": "base64"}, speechFile)

	outcome := harness.send(t, "/v1/audio/transcriptions", contentType, body)

	require.Equal(t, http.StatusOK, outcome.status, outcome.body)
	var sent []capturedRequest
	for _, request := range harness.upstream.captured() {
		if strings.HasPrefix(request.URL, "/vendor/asr") {
			sent = append(sent, request)
		}
	}
	require.Len(t, sent, 2, "a send and a resend after the refresh")
	assert.Equal(t, "Bearer old-access", sent[0].Header.Get("Authorization"))
	assert.Equal(t, "Bearer new-access", sent[1].Header.Get("Authorization"))
	assert.Equal(t, sent[0].Body, sent[1].Body, "the resend carries the same bytes")
	var converted map[string]any
	require.NoError(t, json.Unmarshal([]byte(sent[0].Body), &converted))
	assert.Equal(t, map[string]any{"model": relayTestModel, "audio": base64.StdEncoding.EncodeToString(speechFile.content), "saw_marker": true}, converted)
	for _, request := range sent {
		sum := sha256.Sum256([]byte(request.Body))
		assert.Equal(t, hex.EncodeToString(sum[:]), request.Header.Get("X-Body-Sha256"))
	}
}

func TestRequestPluginsReachTheUpstream(t *testing.T) {
	harness := newRelayHarness(t)
	registerRelayPlugin(t, `export const meta = {apiVersion: 1, key: "rp-relay", name: "Redact", version: "1.0.0", author: {name: "Test"}};
export function ingress(ctx, req) {
  if (ctx.config.reject === "ingress") return {action: "reject", code: "blocked.door", message: "Not at the door"};
  if (ctx.config.mark) return {action: "continue", effects: [{type: "json.patch", ops: [{op: "add", path: "/user", value: ctx.config.mark + ":" + ctx.format}]}]};
  const text = req.body.messages[0].content.replace(/[\w.]+@[\w.]+/g, "[email]");
  return {action: "continue", effects: [{type: "json.patch", ops: [{op: "replace", path: "/messages/0/content", value: text}]}], findings: [{rule: "email", count: 1}]};
}
export function outbound(ctx, req) {
  if (ctx.config.reject === "outbound") return {action: "reject", code: "blocked.upstream", message: "Not for this channel"};
  if (ctx.config.mark) return {action: "continue"};
  return {action: "continue", effects: [{type: "json.patch", ops: [{op: "add", path: "/store", value: false}]}, {type: "header.patch", set: {"X-Vendor-Flag": "on"}}]};
}`)
	setInstances := func(instances string) {
		require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{request_plugin_setting.InstancesOption: instances}))
	}
	t.Cleanup(func() { setInstances("[]") })
	setInstances(`[
		{"id":"redact","name":"Redact","plugin":"rp-relay","enabled":true,"global":true,"config":{}},
		{"id":"bound","name":"Bound","plugin":"rp-relay","enabled":true,"config":{"mark":"late"}},
		{"id":"block","name":"Block","plugin":"rp-relay","enabled":true,"config":{"reject":"outbound"}}
	]`)
	channel := harness.newChannel(constant.ChannelTypeOpenAI, "sk-upstream")
	channel.SetSetting(dto.ChannelSettings{RequestPlugins: []string{"bound"}})
	harness.install(t, channel)

	outcome := harness.post(t, "/v1/chat/completions", `{"model":"`+relayTestModel+`","messages":[{"role":"user","content":"mail a.b@example.com now"}]}`)

	require.Equal(t, http.StatusOK, outcome.status, outcome.body)
	requests := harness.upstream.captured()
	require.Len(t, requests, 1)
	// The global ingress redaction reached the parsed request, the bound
	// instance's ingress ran late on the upstream body, and the outbound
	// patch came last.
	assert.JSONEq(t, `{"model":"`+relayTestModel+`","messages":[{"role":"user","content":"mail [email] now"}],"user":"late:openai","store":false}`, requests[0].Body)
	assert.Equal(t, "on", requests[0].Header.Get("X-Vendor-Flag"))
	assert.Equal(t, "Bearer sk-upstream", requests[0].Header.Get("Authorization"))
	audit := gjson.Get(outcome.log.Other, "admin_info.request_plugins")
	require.True(t, audit.IsArray(), outcome.log.Other)
	first := audit.Array()[0]
	assert.Equal(t, "redact", first.Get("instance").Str)
	assert.Equal(t, "ingress", first.Get("stage").Str)
	assert.Equal(t, "continue", first.Get("action").Str)
	assert.Equal(t, int64(1), first.Get("effects").Int())
	assert.JSONEq(t, `[{"rule":"email","count":1}]`, first.Get("findings").Raw)
	assert.NotContains(t, outcome.log.Other, "example.com")
	// Users see what changed; instance ids and rule ids stay in admin_info.
	assert.JSONEq(t, `[
		{"plugin":"rp-relay","name":{"en":"Redact"},"stage":"ingress","changes":[{"op":"replace","path":"messages[0].content","value":"mail [email] now"}],"findings":[{"count":1}]},
		{"plugin":"rp-relay","name":{"en":"Redact"},"stage":"ingress","changes":[{"op":"add","path":"user","value":"late:openai"}]},
		{"plugin":"rp-relay","name":{"en":"Redact"},"stage":"outbound","changes":[{"op":"add","path":"store","value":false}],"headers":{"set":["x-vendor-flag"]}}
	]`, gjson.Get(outcome.log.Other, "request_plugins").Raw)

	// An outbound rejection answers 400, sends nothing and shows on the
	// error log.
	previousErrorLog := constant.ErrorLogEnabled
	constant.ErrorLogEnabled = true
	t.Cleanup(func() { constant.ErrorLogEnabled = previousErrorLog })
	harness.upstream.reset()
	channel.SetSetting(dto.ChannelSettings{RequestPlugins: []string{"block"}})
	harness.install(t, channel)
	outcome = harness.post(t, "/v1/chat/completions", relayTestBody)
	assert.Equal(t, http.StatusBadRequest, outcome.status)
	assert.Contains(t, outcome.body, "Not for this channel (code: blocked.upstream)")
	assert.Contains(t, outcome.body, "request_rejected")
	assert.Empty(t, harness.upstream.captured())
	assert.Zero(t, outcome.quota)
	var errorLog model.Log
	require.NoError(t, model.LOG_DB.Where("type = ?", model.LogTypeError).Order("id DESC").First(&errorLog).Error)
	assert.JSONEq(t, `{"plugin":"rp-relay","name":{"en":"Redact"},"stage":"outbound","rejected":{"code":"blocked.upstream"}}`,
		gjson.Get(errorLog.Other, `request_plugins.#(rejected.code=="blocked.upstream")`).Raw)
	assert.Equal(t, "reject", gjson.Get(errorLog.Other, `admin_info.request_plugins.#(instance=="block")#.action|@reverse|0`).Str)
	assert.NotContains(t, errorLog.Other, "Not for this channel")

	// An ingress rejection, before any channel, has its error log too.
	harness.upstream.reset()
	setInstances(`[{"id":"door","name":"Door","plugin":"rp-relay","enabled":true,"global":true,"config":{"reject":"ingress"}}]`)
	outcome = harness.post(t, "/v1/chat/completions", relayTestBody)
	assert.Equal(t, http.StatusBadRequest, outcome.status)
	assert.Contains(t, outcome.body, "Not at the door (code: blocked.door)")
	assert.Empty(t, harness.upstream.captured())
	errorLog = model.Log{}
	require.NoError(t, model.LOG_DB.Where("type = ?", model.LogTypeError).Order("id DESC").First(&errorLog).Error)
	assert.Zero(t, errorLog.ChannelId)
	assert.Equal(t, relayTestModel, errorLog.ModelName)
	assert.Contains(t, errorLog.Content, "Not at the door (code: blocked.door)")
	assert.JSONEq(t, `[{"plugin":"rp-relay","name":{"en":"Redact"},"stage":"ingress","rejected":{"code":"blocked.door"}}]`,
		gjson.Get(errorLog.Other, "request_plugins").Raw)
	assert.Equal(t, "reject", gjson.Get(errorLog.Other, `admin_info.request_plugins.0.action`).Str)
	assert.Equal(t, "door", gjson.Get(errorLog.Other, `admin_info.request_plugins.0.instance`).Str)
}

// The channel's own settings win over request plugins: its param override
// runs after the outbound stage and its header override after the plugin
// headers. Egress checks the body the upstream receives, and the record marks
// the plugin changes the channel replaced.
func TestRequestPluginsYieldToTheChannel(t *testing.T) {
	harness := newRelayHarness(t)
	registerRelayPlugin(t, `export const meta = {apiVersion: 1, key: "rp-order", name: "Order", version: "1.0.0", author: {name: "Test"}};
export function outbound(ctx, req) {
  return {action: "continue", effects: [
    {type: "json.patch", ops: [{op: "add", path: "/temperature", value: 0.7}, {op: "add", path: "/top_p", value: 0.9}]},
    {type: "header.patch", set: {"X-Foo": "a", "X-Bar": "kept"}}],
    notice: {en: ctx.format + " messages " + ("messages" in req.body)}};
}
export function egress(ctx, req) {
  return {action: "continue", findings: [{rule: "seen", category: "check", count: 1}], notice: {en: ctx.format + " temperature " + req.body.temperature}};
}`)
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{request_plugin_setting.InstancesOption: `[
		{"id":"order","name":"Order","plugin":"rp-order","enabled":true,"global":true,"config":{}}
	]`}))
	t.Cleanup(func() {
		require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{request_plugin_setting.InstancesOption: "[]"}))
	})
	channel := harness.newChannel(constant.ChannelTypeOpenAI, "sk-upstream")
	paramOverride, headerOverride := `{"temperature":0.2}`, `{"X-Foo":"b"}`
	channel.ParamOverride, channel.HeaderOverride = &paramOverride, &headerOverride
	harness.install(t, channel)

	outcome := harness.post(t, "/v1/chat/completions", relayTestBody)

	require.Equal(t, http.StatusOK, outcome.status, outcome.body)
	requests := harness.upstream.captured()
	require.Len(t, requests, 1)
	assert.Equal(t, 0.2, gjson.Get(requests[0].Body, "temperature").Float())
	assert.Equal(t, 0.9, gjson.Get(requests[0].Body, "top_p").Float())
	assert.Equal(t, "b", requests[0].Header.Get("X-Foo"))
	assert.Equal(t, "kept", requests[0].Header.Get("X-Bar"))
	assert.JSONEq(t, `[
		{"plugin":"rp-order","name":{"en":"Order"},"stage":"outbound",
			"changes":[{"op":"add","path":"temperature","value":0.7,"overridden":true},{"op":"add","path":"top_p","value":0.9}],
			"headers":{"set":["x-bar","x-foo"],"overridden":["x-foo"]},"notice":{"en":"openai messages true"}},
		{"plugin":"rp-order","name":{"en":"Order"},"stage":"egress","findings":[{"category":"check","count":1}],"notice":{"en":"openai temperature 0.2"}}
	]`, gjson.Get(outcome.log.Other, "request_plugins").Raw)

	// A chat request the channel sends as a Responses request takes the
	// outbound hooks and the param override in chat form; egress reads the
	// Responses body.
	policy := &model_setting.GetGlobalSettings().ChatCompletionsToResponsesPolicy
	previousPolicy := *policy
	*policy = model_setting.ChatCompletionsToResponsesPolicy{Enabled: true, AllChannels: true, ModelPatterns: []string{"^" + relayTestModel + "$"}}
	t.Cleanup(func() { *policy = previousPolicy })
	harness.upstream.reset()
	harness.upstream.respond = func(w http.ResponseWriter, _ int, _ capturedRequest) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"id":"resp_1","object":"response","created_at":1730000000,"status":"completed","model":"`+relayTestModel+`","output":[{"type":"message","id":"msg_1","status":"completed","role":"assistant","content":[{"type":"output_text","text":"hi","annotations":[]}]}],"usage":{"input_tokens":10,"output_tokens":5,"total_tokens":15}}`)
	}

	outcome = harness.post(t, "/v1/chat/completions", relayTestBody)

	require.Equal(t, http.StatusOK, outcome.status, outcome.body)
	requests = harness.upstream.captured()
	require.Len(t, requests, 1)
	assert.Contains(t, requests[0].URL, "/v1/responses")
	assert.True(t, gjson.Get(requests[0].Body, "input").Exists(), requests[0].Body)
	assert.Equal(t, 0.2, gjson.Get(requests[0].Body, "temperature").Float())
	record := gjson.Get(outcome.log.Other, "request_plugins")
	assert.Equal(t, "openai messages true", record.Get(`#(stage=="outbound").notice.en`).Str)
	assert.True(t, record.Get(`#(stage=="outbound").changes.#(path=="temperature").overridden`).Bool())
	assert.Equal(t, "openai_responses temperature 0.2", record.Get(`#(stage=="egress").notice.en`).Str)
}

// Reply checks run on the answer the real handlers write: the client gets the
// masked text, the request is billed from the upstream usage, a stop ends a
// stream and its upstream request, and the logs show what the checks did.
func TestReplyChecksThroughTheRelay(t *testing.T) {
	harness := newRelayHarness(t)
	registerRelayPlugin(t, `export const meta = {apiVersion: 1, key: "rp-reply-relay", name: "Reply", version: "1.0.0", author: {name: "Test"}};
export function reply(ctx, res) {
  const mask = [];
  for (const output of res.outputs) {
    if (output.text.includes("forbidden")) return {action: "stop", code: "reply.blocked", message: "Not in replies"};
    for (const match of output.text.matchAll(/[\w.]+@[\w.]+\.com/g)) {
      mask.push({index: output.index, start: match.index, end: match.index + match[0].length, category: "email"});
    }
  }
  return {action: "continue", mask, hold: res.stream ? 24 : 0};
}`)
	setInstances := func(models string) {
		require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{request_plugin_setting.InstancesOption: `[
			{"id":"mask","name":"Mask","plugin":"rp-reply-relay","enabled":true,"global":true,"models":` + models + `}]`}))
	}
	t.Cleanup(func() {
		require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{request_plugin_setting.InstancesOption: "[]"}))
	})
	setInstances(`[]`)
	harness.install(t, harness.newChannel(constant.ChannelTypeOpenAI, "sk-upstream"))
	answer := strings.Replace(chatReply, `"content":"hi"`, `"content":"mail a.b@example.com now"`, 1)
	chunk := func(content string) string {
		return `data: {"id":"chatcmpl-1","object":"chat.completion.chunk","created":1730000000,"model":"gpt-4o-mini","choices":[{"index":0,"delta":{"content":"` + content + `"},"finish_reason":null}]}` + "\n\n"
	}
	streamText := func(body string) string {
		var text strings.Builder
		for line := range strings.SplitSeq(body, "\n") {
			if data, ok := strings.CutPrefix(line, "data: "); ok {
				text.WriteString(gjson.Get(data, "choices.0.delta.content").Str)
			}
		}
		return text.String()
	}
	streamBody := `{"model":"` + relayTestModel + `","stream":true,"messages":[{"role":"user","content":"hello there"}]}`

	// Non-stream: masked, billed from the upstream usage, Content-Length
	// fixed.
	harness.upstream.respond = respondWith(http.StatusOK, "application/json", answer)
	plain := harness.post(t, "/v1/chat/completions", relayTestBody)
	require.Equal(t, http.StatusOK, plain.status, plain.body)
	assert.Equal(t, "mail *** now", gjson.Get(plain.body, "choices.0.message.content").Str)
	assert.Equal(t, strconv.Itoa(len(plain.body)), plain.header.Get("Content-Length"))
	assert.Positive(t, plain.quota)
	assert.JSONEq(t, `[{"plugin":"rp-reply-relay","name":{"en":"Reply"},"stage":"reply","masked":1,"findings":[{"category":"email","count":1}]}]`,
		gjson.Get(plain.log.Other, "request_plugins").Raw)
	assert.Equal(t, "continue", gjson.Get(plain.log.Other, `admin_info.request_plugins.#(stage=="reply").action`).Str)
	assert.NotContains(t, plain.log.Other, "example.com")

	// Another model's request takes the path without reply checks.
	setInstances(`["another-model"]`)
	untouched := harness.post(t, "/v1/chat/completions", relayTestBody)
	assert.Equal(t, "mail a.b@example.com now", gjson.Get(untouched.body, "choices.0.message.content").Str)
	assert.False(t, gjson.Get(untouched.log.Other, "request_plugins").Exists())
	assert.Equal(t, plain.quota, untouched.quota)
	setInstances(`["` + relayTestModel + `"]`)

	// Stream: an address split across chunks is still masked.
	stream := chunk("Write to a.b@exa") + chunk("mple.com today, and that is the whole message.") + chatStream[strings.Index(chatStream, "\n\n")+2:]
	harness.upstream.respond = respondWith(http.StatusOK, "text/event-stream", stream)
	streamed := harness.post(t, "/v1/chat/completions", streamBody)
	require.Equal(t, http.StatusOK, streamed.status, streamed.body)
	assert.Equal(t, "Write to *** today, and that is the whole message.", streamText(streamed.body))
	assert.NotContains(t, streamed.body, "example.com")
	assert.Contains(t, streamed.body, "data: [DONE]")
	assert.Positive(t, streamed.quota)
	assert.Equal(t, int64(1), gjson.Get(streamed.log.Other, `request_plugins.#(stage=="reply").masked`).Int())

	// A stop in a stream: an error event, the end of the stream, the
	// upstream request canceled, and the text received so far billed. The
	// client keeps what the check released before the stop; the 24
	// characters it held back are never sent.
	var canceled atomic.Bool
	opening := "A harmless opening that is long enough to be checked. "
	harness.upstream.respond = func(w http.ResponseWriter, _ int, _ capturedRequest) {
		w.Header().Set("Content-Type", "text/event-stream")
		_, _ = io.WriteString(w, chunk(opening))
		w.(http.Flusher).Flush()
		time.Sleep(50 * time.Millisecond)
		_, _ = io.WriteString(w, chunk("Then the forbidden part follows, long enough as well."))
		w.(http.Flusher).Flush()
		for range 100 {
			time.Sleep(20 * time.Millisecond)
			if _, err := io.WriteString(w, chunk("more")); err != nil {
				canceled.Store(true)
				return
			}
			w.(http.Flusher).Flush()
		}
	}
	stopped := harness.post(t, "/v1/chat/completions", streamBody)
	require.Equal(t, http.StatusOK, stopped.status, stopped.body)
	assert.Equal(t, opening[:len(opening)-24], streamText(stopped.body))
	assert.Contains(t, stopped.body, `"code":"response_rejected"`)
	assert.Contains(t, stopped.body, "Not in replies (code: reply.blocked)")
	assert.True(t, strings.HasSuffix(stopped.body, "data: [DONE]\n\n"), stopped.body)
	assert.NotContains(t, stopped.body, "forbidden")
	assert.Eventually(t, canceled.Load, time.Second, 10*time.Millisecond, "the upstream request was canceled")
	assert.Positive(t, stopped.quota)
	assert.Equal(t, "reply.blocked", gjson.Get(stopped.log.Other, `request_plugins.#(stage=="reply").rejected.code`).Str)
	assert.Equal(t, "stop", gjson.Get(stopped.log.Other, `admin_info.request_plugins.#(stage=="reply").action`).Str)

	// A stop of a non-stream answer: 400, billed as the answer would be.
	harness.upstream.respond = respondWith(http.StatusOK, "application/json", strings.Replace(chatReply, `"content":"hi"`, `"content":"a forbidden answer"`, 1))
	rejected := harness.post(t, "/v1/chat/completions", relayTestBody)
	assert.Equal(t, http.StatusBadRequest, rejected.status)
	assert.Equal(t, "response_rejected", gjson.Get(rejected.body, "error.code").Str)
	assert.NotContains(t, rejected.body, "forbidden answer")
	assert.Equal(t, plain.quota, rejected.quota)
	assert.Equal(t, "reply.blocked", gjson.Get(rejected.log.Other, `request_plugins.#(stage=="reply").rejected.code`).Str)
}

// A Midjourney submission runs the request plugins' ingress: a rejection
// answers in Midjourney's own format and is written to the error log, and a
// redaction reaches the upstream and the consume log.
func TestRequestPluginsOnMidjourneySubmissions(t *testing.T) {
	harness := newRelayHarness(t)
	require.NoError(t, model.DB.AutoMigrate(&model.Midjourney{}))
	registerRelayPlugin(t, `export const meta = {apiVersion: 1, key: "rp-mj", name: "Redact", version: "1.0.0", author: {name: "Test"}};
export function ingress(ctx, req) {
  if (ctx.config.reject) return {action: "reject", code: "blocked.mj", message: "No " + ctx.format};
  return {action: "continue", effects: [{type: "json.patch", ops: [{op: "replace", path: "/prompt", value: req.body.prompt.replace(/[\w.]+@[\w.]+/g, "[email]")}]}]};
}`)
	setInstances := func(instances string) {
		require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{request_plugin_setting.InstancesOption: instances}))
	}
	t.Cleanup(func() { setInstances("[]") })
	previousErrorLog := constant.ErrorLogEnabled
	constant.ErrorLogEnabled = true
	t.Cleanup(func() { constant.ErrorLogEnabled = previousErrorLog })
	channel := harness.newChannel(constant.ChannelTypeMidjourney, "mj-secret")
	channel.Models = "mj_imagine"
	harness.install(t, channel)
	harness.upstream.respond = respondWith(http.StatusOK, "application/json", `{"code":1,"description":"ok","result":"1234"}`)

	setInstances(`[{"id":"door","name":"Door","plugin":"rp-mj","enabled":true,"global":true,"config":{"reject":true}}]`)
	outcome := harness.post(t, "/mj/submit/imagine", `{"prompt":"mail a@b.co a cat"}`)
	assert.Equal(t, http.StatusBadRequest, outcome.status)
	assert.Equal(t, int64(4), gjson.Get(outcome.body, "code").Int(), outcome.body)
	assert.Equal(t, "request_rejected", gjson.Get(outcome.body, "type").Str)
	assert.Contains(t, gjson.Get(outcome.body, "description").Str, "No mj_proxy (code: blocked.mj)")
	assert.Empty(t, harness.upstream.captured())
	assert.Zero(t, outcome.quota)
	var errorLog model.Log
	require.NoError(t, model.LOG_DB.Where("type = ?", model.LogTypeError).Order("id DESC").First(&errorLog).Error)
	assert.Equal(t, "mj_imagine", errorLog.ModelName)
	assert.JSONEq(t, `[{"plugin":"rp-mj","name":{"en":"Redact"},"stage":"ingress","rejected":{"code":"blocked.mj"}}]`,
		gjson.Get(errorLog.Other, "request_plugins").Raw)

	setInstances(`[{"id":"redact","name":"Redact","plugin":"rp-mj","enabled":true,"global":true}]`)
	outcome = harness.post(t, "/mj/submit/imagine", `{"prompt":"mail a@b.co a cat"}`)
	require.Equal(t, http.StatusOK, outcome.status, outcome.body)
	requests := harness.upstream.captured()
	require.Len(t, requests, 1)
	assert.Equal(t, "/mj/submit/imagine", requests[0].URL)
	assert.Equal(t, "mail [email] a cat", gjson.Get(requests[0].Body, "prompt").Str)
	assert.Positive(t, outcome.quota)
	assert.JSONEq(t, `[{"plugin":"rp-mj","name":{"en":"Redact"},"stage":"ingress","changes":[{"op":"replace","path":"prompt","value":"mail [email] a cat"}]}]`,
		gjson.Get(outcome.log.Other, "request_plugins").Raw)
	var task model.Midjourney
	require.NoError(t, model.DB.Order("id DESC").First(&task).Error)
	assert.Equal(t, "mail [email] a cat", task.Prompt)
}
