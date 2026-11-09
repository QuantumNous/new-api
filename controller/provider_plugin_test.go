package controller

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/service/authz"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

const loginPluginSource = `
export const meta = {apiVersion: 1, key: "%KEY%", name: "Login", version: "1.0.0", author: {name: "Test"},
  relay: [{incoming_path: "/v1/chat/completions", upstream_path: "/chat"}]};
export function login(ctx, input) {
  if (input === null) return {type: "fields", session: {secret: "session-secret"}, fields: [{name: "api_token", label: "Token", type: "password", required: true}]};
  return {type: "done", credential: {token: input.fields.api_token}, headers: {Authorization: "Bearer " + input.fields.api_token},
    accountId: "acct-" + input.fields.api_token.length, label: "user@example.com"};
}
export function refresh(ctx) {
  const token = utils.fetch({url: ctx.baseUrl + "/oauth/token", method: "POST", body: ctx.credential.token}).body.token;
  return {credential: {token: token}, headers: {Authorization: "Bearer " + token}};
}
export function revoke(ctx) {
  utils.fetch({url: ctx.baseUrl + "/revoke", method: "POST", body: ctx.credential.token});
}
`

// revokeServer records the tokens the plugin revokes.
type revokeServer struct {
	*httptest.Server
	mu      sync.Mutex
	revoked []string
}

func newRevokeServer(t *testing.T) *revokeServer {
	t.Helper()
	server := &revokeServer{}
	server.Server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		server.mu.Lock()
		server.revoked = append(server.revoked, r.URL.Path+" "+string(body))
		server.mu.Unlock()
	}))
	t.Cleanup(server.Close)
	return server
}

func (s *revokeServer) tokens() []string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]string(nil), s.revoked...)
}

func setupProviderPluginControllerTest(t *testing.T, pluginKey string) {
	t.Helper()
	setupTaskPluginBindChannelTest(t)
	require.NoError(t, model.DB.AutoMigrate(&model.AuthFlow{}))
	service.InitHttpClient()
	_, err := jsplugin.DefaultRegistry.Register(strings.ReplaceAll(loginPluginSource, "%KEY%", pluginKey), jsplugin.Options{})
	require.NoError(t, err)
	t.Cleanup(func() { _ = jsplugin.DefaultRegistry.Unregister(pluginKey) })
}

type channelAPIResponse struct {
	Success bool            `json:"success"`
	Message string          `json:"message"`
	Data    json.RawMessage `json:"data"`
}

// callChannelAPI runs a channel handler as the root user signed in with a
// browser session.
func callChannelAPI(t *testing.T, handler gin.HandlerFunc, method, target, body string, params ...gin.Param) (channelAPIResponse, string) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Set("id", 1)
	c.Set("role", common.RoleRootUser)
	c.Set("session_id", "browser-session")
	c.Set("auth_version", int64(1))
	c.Set("session_version", int64(1))
	c.Request = httptest.NewRequest(method, target, strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Params = params
	handler(c)
	var response channelAPIResponse
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &response), recorder.Body.String())
	return response, recorder.Body.String()
}

func idParam(id int) gin.Param { return gin.Param{Key: "id", Value: fmt.Sprint(id)} }

func pluginCredentialLine(t *testing.T, pluginKey, token string) string {
	t.Helper()
	line, err := jsplugin.Credential{Plugin: pluginKey, Data: json.RawMessage(`{"token":"` + token + `"}`), Headers: map[string]string{"Authorization": "Bearer " + token},
		AccountID: "acct-" + token, Label: token + "@example.com"}.Line()
	require.NoError(t, err)
	return line
}

func insertPluginChannel(t *testing.T, pluginKey, baseURL, key string, multiKey bool) *model.Channel {
	t.Helper()
	channel := &model.Channel{Type: constant.ChannelTypeTaskPlugin, Key: key, Status: common.ChannelStatusEnabled, Name: "login-channel", Models: "m", Group: "default", BaseURL: &baseURL}
	channel.SetSetting(dto.ChannelSettings{TaskPluginKey: pluginKey})
	if multiKey {
		channel.ChannelInfo = model.ChannelInfo{IsMultiKey: true, MultiKeySize: len(strings.Split(key, "\n")), MultiKeyMode: constant.MultiKeyModePolling}
	}
	require.NoError(t, channel.Insert())
	return channel
}

func TestAddChannelWithoutKeyForALoginPlugin(t *testing.T) {
	setupProviderPluginControllerTest(t, "ctl-login")
	body := func(mode, key, pluginKey string, channelType int) string {
		return fmt.Sprintf(`{"mode":%q,"channel":{"type":%d,"name":"login","key":%s,"models":"m","group":"default","base_url":"https://vendor.example","setting":"{\"task_plugin_key\":\"%s\"}"}}`,
			mode, channelType, key, pluginKey)
	}

	for _, mode := range []string{"single", "multi_to_single"} {
		t.Run(mode, func(t *testing.T) {
			response, raw := callChannelAPI(t, AddChannel, http.MethodPost, "/api/channel", body(mode, "null", "ctl-login", constant.ChannelTypeTaskPlugin))

			require.True(t, response.Success, raw)
			var data struct {
				IDs []int `json:"ids"`
			}
			require.NoError(t, json.Unmarshal(response.Data, &data))
			require.Len(t, data.IDs, 1)
			stored, err := model.GetChannelById(data.IDs[0], true)
			require.NoError(t, err)
			assert.Empty(t, stored.Key)
			assert.Equal(t, common.ChannelStatusAutoDisabled, stored.Status, "it waits for a login")
			assert.Equal(t, model.ChannelStatusReasonPluginLoginRequired, stored.GetOtherInfo()["status_reason"])
			assert.Equal(t, mode == "multi_to_single", stored.ChannelInfo.IsMultiKey)
		})
	}

	for name, request := range map[string]string{
		"batch mode":             body("batch", `""`, "ctl-login", constant.ChannelTypeTaskPlugin),
		"a plugin without login": body("single", `""`, "", constant.ChannelTypeTaskPlugin),
		"another channel type":   body("single", `""`, "ctl-login", constant.ChannelTypeOpenAI),
	} {
		t.Run(name, func(t *testing.T) {
			response, raw := callChannelAPI(t, AddChannel, http.MethodPost, "/api/channel", request)
			assert.False(t, response.Success, raw)
		})
	}

	t.Run("a static key still works and returns its id", func(t *testing.T) {
		response, raw := callChannelAPI(t, AddChannel, http.MethodPost, "/api/channel", body("batch", `"sk-1\nsk-2"`, "ctl-login", constant.ChannelTypeTaskPlugin))
		require.True(t, response.Success, raw)
		var data struct {
			IDs []int `json:"ids"`
		}
		require.NoError(t, json.Unmarshal(response.Data, &data))
		assert.Len(t, data.IDs, 2)
		for _, id := range data.IDs {
			stored, err := model.GetChannelById(id, true)
			require.NoError(t, err)
			assert.Equal(t, common.ChannelStatusEnabled, stored.Status)
		}
	})
}

func TestSubmittedCredentialsAreRejected(t *testing.T) {
	setupProviderPluginControllerTest(t, "ctl-forge")
	forged := pluginCredentialLine(t, "ctl-forge", "forged")

	addBody := fmt.Sprintf(`{"mode":"single","channel":{"type":61,"name":"forge","key":%q,"models":"m","group":"default","base_url":"https://vendor.example","setting":"{\"task_plugin_key\":\"ctl-forge\"}"}}`, forged)
	response, raw := callChannelAPI(t, AddChannel, http.MethodPost, "/api/channel", addBody)
	assert.False(t, response.Success, raw)
	assert.Equal(t, "Plugin credentials can only be added by logging in", response.Message)

	stored := pluginCredentialLine(t, "ctl-forge", "stored")
	channel := insertPluginChannel(t, "ctl-forge", "https://vendor.example", stored, false)
	update := func(fields string) (channelAPIResponse, string) {
		return callChannelAPI(t, UpdateChannel, http.MethodPut, "/api/channel", fmt.Sprintf(`{"id":%d,"name":"forge",%s}`, channel.Id, fields))
	}

	response, raw = update(fmt.Sprintf(`"key":%q`, forged))
	assert.False(t, response.Success, raw)
	assert.Equal(t, "Plugin credentials can only be added by logging in", response.Message)

	response, raw = update(fmt.Sprintf(`"key":%q`, stored+"\n"+forged))
	assert.False(t, response.Success, raw)

	response, raw = update(`"type":1`)
	assert.False(t, response.Success, raw)
	assert.Equal(t, "Replace the plugin credentials in the key before changing the channel type or plugin", response.Message)

	response, raw = update(`"setting":"{\"task_plugin_key\":\"another\"}"`)
	assert.False(t, response.Success, raw)
	assert.Equal(t, "Replace the plugin credentials in the key before changing the channel type or plugin", response.Message)

	response, raw = update(fmt.Sprintf(`"key":%q,"models":"m,n"`, stored))
	assert.True(t, response.Success, raw, "the stored credential may be sent back unchanged")
	reloaded, err := model.GetChannelById(channel.Id, true)
	require.NoError(t, err)
	assert.Equal(t, stored, reloaded.Key)
	assert.Equal(t, "m,n", reloaded.Models)
}

func TestChannelKeyShowsCredentialSummaries(t *testing.T) {
	setupProviderPluginControllerTest(t, "ctl-reveal")
	line := pluginCredentialLine(t, "ctl-reveal", "secret-token")
	channel := insertPluginChannel(t, "ctl-reveal", "https://vendor.example", "sk-static\n"+line, true)

	response, raw := callChannelAPI(t, GetChannelKey, http.MethodPost, "/api/channel/key", "", idParam(channel.Id))

	require.True(t, response.Success, raw)
	assert.NotContains(t, raw, "Bearer secret-token")
	assert.NotContains(t, raw, `\"token\"`)
	var data struct {
		Key string `json:"key"`
	}
	require.NoError(t, json.Unmarshal(response.Data, &data))
	lines := strings.Split(data.Key, "\n")
	require.Len(t, lines, 2)
	assert.Equal(t, "sk-static", lines[0])
	var summary map[string]any
	require.NoError(t, json.Unmarshal([]byte(lines[1]), &summary))
	assert.Equal(t, map[string]any{"type": "plugin_credential", "plugin": "ctl-reveal", "account_id": "acct-secret-token", "label": "secret-token@example.com", "expires_at": float64(0), "needs_login": false}, summary)

	response, raw = callChannelAPI(t, ManageMultiKeys, http.MethodPost, "/api/channel/multi_key/manage", fmt.Sprintf(`{"channel_id":%d,"action":"get_key_status"}`, channel.Id))
	require.True(t, response.Success, raw)
	assert.Contains(t, raw, `"key_preview":"secret-token@example.com"`)
	assert.NotContains(t, raw, "Bearer secret-token")
}

func TestCopyChannelDropsCredentials(t *testing.T) {
	setupProviderPluginControllerTest(t, "ctl-copy")
	single := insertPluginChannel(t, "ctl-copy", "https://vendor.example", pluginCredentialLine(t, "ctl-copy", "one"), false)
	multi := insertPluginChannel(t, "ctl-copy", "https://vendor.example", "sk-static\n"+pluginCredentialLine(t, "ctl-copy", "two"), true)

	copyOf := func(id int) *model.Channel {
		t.Helper()
		response, raw := callChannelAPI(t, CopyChannel, http.MethodPost, "/api/channel/copy", "", idParam(id))
		require.True(t, response.Success, raw)
		var data struct {
			ID int `json:"id"`
		}
		require.NoError(t, json.Unmarshal(response.Data, &data))
		copied, err := model.GetChannelById(data.ID, true)
		require.NoError(t, err)
		return copied
	}

	copied := copyOf(single.Id)
	assert.Empty(t, copied.Key)
	assert.Equal(t, common.ChannelStatusAutoDisabled, copied.Status, "the copy waits for its own login")

	copied = copyOf(multi.Id)
	assert.Equal(t, "sk-static", copied.Key)
	assert.Equal(t, 1, copied.ChannelInfo.MultiKeySize)
	assert.Equal(t, common.ChannelStatusEnabled, copied.Status)
}

func TestRemovingCredentialsRevokesThem(t *testing.T) {
	setupProviderPluginControllerTest(t, "ctl-revoke")
	server := newRevokeServer(t)
	waitForRevokes := func(want ...string) {
		t.Helper()
		assert.Eventually(t, func() bool { return len(server.tokens()) >= len(want) }, 5*time.Second, 10*time.Millisecond)
		assert.ElementsMatch(t, want, server.tokens())
		server.mu.Lock()
		server.revoked = nil
		server.mu.Unlock()
	}

	t.Run("delete", func(t *testing.T) {
		channel := insertPluginChannel(t, "ctl-revoke", server.URL, pluginCredentialLine(t, "ctl-revoke", "deleted"), false)
		response, raw := callChannelAPI(t, DeleteChannel, http.MethodDelete, "/api/channel", "", idParam(channel.Id))
		require.True(t, response.Success, raw)
		waitForRevokes("/revoke deleted")
	})

	t.Run("batch delete", func(t *testing.T) {
		first := insertPluginChannel(t, "ctl-revoke", server.URL, pluginCredentialLine(t, "ctl-revoke", "batch-1"), false)
		second := insertPluginChannel(t, "ctl-revoke", server.URL, "sk-static\n"+pluginCredentialLine(t, "ctl-revoke", "batch-2"), true)
		response, raw := callChannelAPI(t, DeleteChannelBatch, http.MethodPost, "/api/channel/batch", fmt.Sprintf(`{"ids":[%d,%d]}`, first.Id, second.Id))
		require.True(t, response.Success, raw)
		waitForRevokes("/revoke batch-1", "/revoke batch-2")
	})

	t.Run("a line removed by an edit", func(t *testing.T) {
		kept, removed := pluginCredentialLine(t, "ctl-revoke", "kept"), pluginCredentialLine(t, "ctl-revoke", "removed")
		channel := insertPluginChannel(t, "ctl-revoke", server.URL, kept+"\n"+removed, true)
		response, raw := callChannelAPI(t, UpdateChannel, http.MethodPut, "/api/channel", fmt.Sprintf(`{"id":%d,"name":"edited","key":%q}`, channel.Id, kept))
		require.True(t, response.Success, raw)
		waitForRevokes("/revoke removed")
	})

	t.Run("multi-key delete", func(t *testing.T) {
		first := pluginCredentialLine(t, "ctl-revoke", "first")
		channel := insertPluginChannel(t, "ctl-revoke", server.URL, first+"\n"+pluginCredentialLine(t, "ctl-revoke", "second"), true)
		response, raw := callChannelAPI(t, ManageMultiKeys, http.MethodPost, "/api/channel/multi_key/manage", fmt.Sprintf(`{"channel_id":%d,"action":"delete_key","key_index":1}`, channel.Id))
		require.True(t, response.Success, raw)
		waitForRevokes("/revoke second")
		stored, err := model.GetChannelById(channel.Id, true)
		require.NoError(t, err)
		assert.Equal(t, first, stored.Key)
		assert.Equal(t, 1, stored.ChannelInfo.MultiKeySize)
	})
}

func TestPluginLoginAPI(t *testing.T) {
	setupProviderPluginControllerTest(t, "ctl-api")
	channel := insertPluginChannel(t, "ctl-api", "https://vendor.example", "", false)

	response, raw := callChannelAPI(t, StartPluginLogin, http.MethodPost, "/api/channel/plugin_login", `{"key_index":null}`, idParam(channel.Id))
	require.True(t, response.Success, raw)
	var started struct {
		Flow string         `json:"flow"`
		Step map[string]any `json:"step"`
	}
	require.NoError(t, json.Unmarshal(response.Data, &started))
	require.NotEmpty(t, started.Flow)
	assert.Equal(t, "fields", started.Step["type"])
	assert.NotContains(t, raw, "session-secret")

	response, raw = callChannelAPI(t, ContinuePluginLogin, http.MethodPost, "/api/channel/plugin_login/continue",
		fmt.Sprintf(`{"flow":%q,"input":{"fields":{"api_token":"tok-123"}}}`, started.Flow), idParam(channel.Id))
	require.True(t, response.Success, raw)
	assert.JSONEq(t, `{"step":{"type":"done","credential":{"index":0,"label":"user@example.com","account_id":"acct-7","expires_at":0,"needs_login":false}}}`, string(response.Data))
	assert.NotContains(t, raw, "tok-123")

	stored, err := model.GetChannelById(channel.Id, true)
	require.NoError(t, err)
	credential, ok := jsplugin.ParseCredential(stored.Key)
	require.True(t, ok)
	assert.JSONEq(t, `{"token":"tok-123"}`, string(credential.Data))

	var audits []model.AuditLog
	require.NoError(t, model.DB.Find(&audits).Error)
	require.Len(t, audits, 1)
	assert.Equal(t, "channel.update", audits[0].Other.Op.Action)
	params, err := json.Marshal(audits[0].Other.Op.Params)
	require.NoError(t, err)
	assert.Contains(t, string(params), `"label":"user@example.com"`)
	assert.Contains(t, string(params), `"account_id":"acct-7"`)
	encoded, err := json.Marshal(audits[0])
	require.NoError(t, err)
	assert.NotContains(t, string(encoded), "tok-123")

	response, raw = callChannelAPI(t, GetPluginCredentials, http.MethodGet, "/api/channel/plugin_credentials", "", idParam(channel.Id))
	require.True(t, response.Success, raw)
	assert.JSONEq(t, `{"items":[{"index":0,"label":"user@example.com","account_id":"acct-7","expires_at":0,"needs_login":false}]}`, string(response.Data))

	t.Run("the flow is spent", func(t *testing.T) {
		response, raw := callChannelAPI(t, ContinuePluginLogin, http.MethodPost, "/api/channel/plugin_login/continue",
			fmt.Sprintf(`{"flow":%q,"input":{"fields":{"api_token":"tok-123"}}}`, started.Flow), idParam(channel.Id))
		assert.False(t, response.Success, raw)
		assert.Equal(t, "Login flow is invalid or has expired", response.Message)
	})

	t.Run("a legacy access token cannot log in", func(t *testing.T) {
		recorder := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(recorder)
		c.Set("id", 1)
		c.Set("role", common.RoleRootUser)
		c.Request = httptest.NewRequest(http.MethodPost, "/api/channel/plugin_login", strings.NewReader(`{}`))
		c.Params = gin.Params{idParam(channel.Id)}
		StartPluginLogin(c)
		assert.Contains(t, recorder.Body.String(), `"success":false`)
		var flows int64
		require.NoError(t, model.DB.Model(&model.AuthFlow{}).Where("purpose = ?", model.AuthFlowPurposePluginLogin).Count(&flows).Error)
		assert.EqualValues(t, 1, flows, "no new flow was opened")
	})

	t.Run("an added account cannot target a credential", func(t *testing.T) {
		response, raw := callChannelAPI(t, StartPluginLogin, http.MethodPost, "/api/channel/plugin_login", `{"add":true,"key_index":0}`, idParam(channel.Id))
		assert.False(t, response.Success, raw)
		assert.Equal(t, "Adding an account cannot target an existing credential", response.Message)
	})

	t.Run("an added account turns the channel multi-key", func(t *testing.T) {
		response, raw := callChannelAPI(t, StartPluginLogin, http.MethodPost, "/api/channel/plugin_login", `{"add":true}`, idParam(channel.Id))
		require.True(t, response.Success, raw)
		var added struct {
			Flow string `json:"flow"`
		}
		require.NoError(t, json.Unmarshal(response.Data, &added))
		response, raw = callChannelAPI(t, ContinuePluginLogin, http.MethodPost, "/api/channel/plugin_login/continue",
			fmt.Sprintf(`{"flow":%q,"input":{"fields":{"api_token":"tok-1234"}}}`, added.Flow), idParam(channel.Id))
		require.True(t, response.Success, raw)

		response, raw = callChannelAPI(t, GetPluginCredentials, http.MethodGet, "/api/channel/plugin_credentials", "", idParam(channel.Id))
		require.True(t, response.Success, raw)
		assert.JSONEq(t, `{"items":[{"index":0,"label":"user@example.com","account_id":"acct-7","expires_at":0,"needs_login":false},`+
			`{"index":1,"label":"user@example.com","account_id":"acct-8","expires_at":0,"needs_login":false}]}`, string(response.Data))
		stored, err := model.GetChannelById(channel.Id, true)
		require.NoError(t, err)
		assert.True(t, stored.ChannelInfo.IsMultiKey)
		assert.Equal(t, 2, stored.ChannelInfo.MultiKeySize)
	})
}

func TestFetchModelsOfAProviderChannel(t *testing.T) {
	setupTaskPluginBindChannelTest(t)
	service.InitHttpClient()
	var converted atomic.Pointer[http.Request]
	var vendorStatus atomic.Int32
	var vendorBody atomic.Value
	serve := func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/models":
			assert.Equal(t, "key sk-static", r.Header.Get("X-Vendor-Key"))
			_, _ = io.WriteString(w, `{"object":"list","data":[{"id":"route-a"},{"id":"route-b"}]}`)
		case "/oauth/token":
			_, _ = io.WriteString(w, `{"token":"fresh"}`)
		case "/credential-models":
			if r.Header.Get("Authorization") != "Bearer fresh" {
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			_, _ = io.WriteString(w, `{"object":"list","data":[{"id":"credential-a"}]}`)
		case "/vendor-models":
			converted.Store(r.Clone(context.Background()))
			_, _ = io.WriteString(w, `{"models":[{"slug":"converted-a"},{"slug":"converted-b"},{"slug":"converted-a"}]}`)
		case "/vendor-reply":
			w.WriteHeader(int(vendorStatus.Load()))
			_, _ = io.WriteString(w, vendorBody.Load().(string))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}
	upstream := httptest.NewServer(http.HandlerFunc(serve))
	t.Cleanup(upstream.Close)
	const convertSlugs = `
			export function convertResponse(ctx, response) {
			  if (ctx.path !== "/v1/models") throw new Error("wrong route " + ctx.path);
			  const body = JSON.parse(response.body);
			  if (body.fail) return {error: {message: body.fail}};
			  if (body.nothing) return;
			  if (body.raw) return {body: body.raw};
			  return {body: {object: "list", data: body.models.map((model) => ({id: model.slug, object: "model"}))}};
			}`
	for key, source := range map[string]string{
		"fetch-route": `export const meta = {apiVersion: 1, key: "fetch-route", name: "Route", version: "1.0.0", author: {name: "Test"}, models: ["manifest"],
			relay: [{incoming_path: "/v1/chat/completions", upstream_path: "/chat"},
			  {incoming_path: "/v1/models", upstream_path: "/models", auth: {type: "header", name: "X-Vendor-Key", value: "key {api_key}"}}]};`,
		"fetch-manifest": `export const meta = {apiVersion: 1, key: "fetch-manifest", name: "Manifest", version: "1.0.0", author: {name: "Test"}, models: ["manifest"],
			relay: [{incoming_path: "/v1/chat/completions", upstream_path: "/chat"}]};`,
		"fetch-refresh": `export const meta = {apiVersion: 1, key: "fetch-refresh", name: "Refresh", version: "1.0.0", author: {name: "Test"}, models: ["manifest"],
			relay: [{incoming_path: "/v1/chat/completions", upstream_path: "/chat"}, {incoming_path: "/v1/models", upstream_path: "/credential-models"}]};
			export function refresh(ctx) {
			  const token = utils.fetch({url: ctx.baseUrl + "/oauth/token", method: "POST", body: ctx.credential.token}).body.token;
			  return {credential: {token: token}, headers: {Authorization: "Bearer " + token}, expiresAt: utils.unixNow() + 3600};
			}`,
		"fetch-converted": `export const meta = {apiVersion: 1, key: "fetch-converted", name: "Converted", version: "1.0.0", author: {name: "Test"}, models: ["manifest"],
			relay: [{incoming_path: "/v1/chat/completions", upstream_path: "/chat"}, {incoming_path: "/v1/models", upstream_path: "/vendor-models?version=2", converter: "plugin"}]};
			export function signRequest(ctx, request) { return {headers: {"X-Signed": request.method}, query: {signed: "1"}}; }
			export function refresh(ctx) {
			  const token = utils.fetch({url: ctx.baseUrl + "/oauth/token", method: "POST", body: ctx.credential.token}).body.token;
			  return {credential: {token: token}, headers: {Authorization: "Bearer " + token, "X-Account": "acct"}, query: {tenant: "t1"}, expiresAt: utils.unixNow() + 3600};
			}` + convertSlugs,
		"fetch-reply": `export const meta = {apiVersion: 1, key: "fetch-reply", name: "Reply", version: "1.0.0", author: {name: "Test"}, models: ["manifest"],
			relay: [{incoming_path: "/v1/models", upstream_path: "/vendor-reply", converter: "plugin"}]};` + convertSlugs,
	} {
		_, err := jsplugin.DefaultRegistry.Register(source, jsplugin.Options{})
		require.NoError(t, err, key)
		t.Cleanup(func() { _ = jsplugin.DefaultRegistry.Unregister(key) })
	}

	for key, want := range map[string][]string{
		"fetch-route":    {"route-a", "route-b"},
		"fetch-manifest": {"manifest"},
	} {
		t.Run(key, func(t *testing.T) {
			channel := insertPluginChannel(t, key, upstream.URL, "sk-static", false)
			models, err := fetchChannelUpstreamModelIDs(channel)
			require.NoError(t, err)
			assert.Equal(t, want, models)
		})
	}
	t.Run("an unsaved channel fetches through its plugin", func(t *testing.T) {
		response, raw := callChannelAPI(t, FetchModels, http.MethodPost, "/api/channel/fetch_models",
			fmt.Sprintf(`{"type":%d,"task_plugin_key":"fetch-route","key":"sk-static\nsk-other","base_url":%q}`, constant.ChannelTypeTaskPlugin, upstream.URL))
		require.True(t, response.Success, raw)
		assert.JSONEq(t, `["route-a","route-b"]`, string(response.Data), raw)
	})
	expiring := func(t *testing.T, plugin string) string {
		line, err := jsplugin.Credential{Plugin: plugin, Data: json.RawMessage(`{"token":"stale"}`), Headers: map[string]string{"Authorization": "Bearer stale"},
			ExpiresAt: time.Now().Add(10 * time.Second).Unix()}.Line()
		require.NoError(t, err)
		return line
	}
	t.Run("an expiring credential is refreshed first", func(t *testing.T) {
		channel := insertPluginChannel(t, "fetch-refresh", upstream.URL, expiring(t, "fetch-refresh"), false)
		models, err := fetchChannelUpstreamModelIDs(channel)
		require.NoError(t, err)
		assert.Equal(t, []string{"credential-a"}, models)
	})
	t.Run("a converted route goes out as a relay request with a static key", func(t *testing.T) {
		channel := insertPluginChannel(t, "fetch-converted", upstream.URL, "sk-static", false)
		models, err := fetchChannelUpstreamModelIDs(channel)
		require.NoError(t, err)
		assert.Equal(t, []string{"converted-a", "converted-b"}, models)
		sent := converted.Load()
		require.NotNil(t, sent)
		assert.Equal(t, http.MethodGet, sent.Method)
		assert.Equal(t, "2", sent.URL.Query().Get("version"))
		assert.Equal(t, "1", sent.URL.Query().Get("signed"))
		assert.Equal(t, "Bearer sk-static", sent.Header.Get("Authorization"))
		assert.Equal(t, http.MethodGet, sent.Header.Get("X-Signed"))
	})
	t.Run("a converted route refreshes an expiring credential and sends it", func(t *testing.T) {
		channel := insertPluginChannel(t, "fetch-converted", upstream.URL, expiring(t, "fetch-converted"), false)
		models, err := fetchChannelUpstreamModelIDs(channel)
		require.NoError(t, err)
		assert.Equal(t, []string{"converted-a", "converted-b"}, models)
		sent := converted.Load()
		require.NotNil(t, sent)
		assert.Equal(t, "2", sent.URL.Query().Get("version"))
		assert.Equal(t, "t1", sent.URL.Query().Get("tenant"))
		assert.Equal(t, "Bearer fresh", sent.Header.Get("Authorization"))
		assert.Equal(t, "acct", sent.Header.Get("X-Account"))
		assert.Equal(t, http.MethodGet, sent.Header.Get("X-Signed"))
	})
	t.Run("a converted route follows the channel's TLS setting", func(t *testing.T) {
		tlsUpstream := httptest.NewTLSServer(http.HandlerFunc(serve))
		t.Cleanup(tlsUpstream.Close)
		channel := insertPluginChannel(t, "fetch-converted", tlsUpstream.URL, "sk-static", false)
		_, err := fetchChannelUpstreamModelIDs(channel)
		require.Error(t, err)
		channel.SetSetting(dto.ChannelSettings{TaskPluginKey: "fetch-converted", TLSInsecureSkipVerify: true})
		models, err := fetchChannelUpstreamModelIDs(channel)
		require.NoError(t, err)
		assert.Equal(t, []string{"converted-a", "converted-b"}, models)
	})
	for name, tc := range map[string]struct {
		status      int
		body, wants string
	}{
		"an error on a 200":   {http.StatusOK, `{"fail":"account suspended"}`, "account suspended"},
		"an error on a 503":   {http.StatusServiceUnavailable, `{"fail":"vendor is down"}`, "vendor is down"},
		"a throw on a 200":    {http.StatusOK, `{}`, "convertResponse"},
		"a throw on a 503":    {http.StatusServiceUnavailable, `{}`, "status code: 503"},
		"nothing on a 200":    {http.StatusOK, `{"nothing":true}`, "must be an object"},
		"nothing on a 503":    {http.StatusServiceUnavailable, `{"nothing":true}`, "status code: 503"},
		"a body on a 503":     {http.StatusServiceUnavailable, `{"models":[{"slug":"ignored"}]}`, "status code: 503"},
		"not a model list":    {http.StatusOK, `{"raw":{"wrong":true}}`, "invalid OpenAI Models response"},
		"an empty model list": {http.StatusOK, `{"models":[]}`, "contains no valid model IDs"},
	} {
		t.Run(name, func(t *testing.T) {
			vendorStatus.Store(int32(tc.status))
			vendorBody.Store(tc.body)
			channel := insertPluginChannel(t, "fetch-reply", upstream.URL, "sk-static", false)
			_, err := fetchChannelUpstreamModelIDs(channel)
			require.ErrorContains(t, err, tc.wants)
		})
	}
}

// TestProviderChannelManagementDatabaseMatrix runs the channel writes and
// queries the provider part adds on every configured database: set
// TEST_MYSQL_DSN or TEST_POSTGRES_DSN (URL form) to include them.
func TestProviderChannelManagementDatabaseMatrix(t *testing.T) {
	for _, dialect := range []struct{ kind, env string }{{"sqlite", ""}, {"mysql", "TEST_MYSQL_DSN"}, {"postgres", "TEST_POSTGRES_DSN"}} {
		t.Run(dialect.kind, func(t *testing.T) {
			if dialect.env != "" && os.Getenv(dialect.env) == "" {
				t.Skip("set " + dialect.env + " to run this database")
			}
			db := modelManagementDB(t, dialect.kind, os.Getenv(dialect.env))
			require.NoError(t, db.AutoMigrate(&model.CasbinRule{}, &model.AuthzRole{}, &model.AuthFlow{}, &model.Log{}))
			require.NoError(t, authz.Init(db))
			service.InitHttpClient()
			pluginKey := "matrix-" + dialect.kind
			_, err := jsplugin.DefaultRegistry.Register(strings.ReplaceAll(loginPluginSource, "%KEY%", pluginKey), jsplugin.Options{})
			require.NoError(t, err)
			t.Cleanup(func() { _ = jsplugin.DefaultRegistry.Unregister(pluginKey) })
			server := newRevokeServer(t)
			ids := func(response channelAPIResponse) []int {
				var data struct {
					IDs []int `json:"ids"`
				}
				require.NoError(t, json.Unmarshal(response.Data, &data))
				return data.IDs
			}
			addBody := func(mode, key string) string {
				return fmt.Sprintf(`{"mode":%q,"channel":{"type":61,"name":"matrix","key":%s,"models":"relay-model","group":"default","base_url":%q,"setting":"{\"task_plugin_key\":\"%s\"}"}}`,
					mode, key, server.URL, pluginKey)
			}

			response, raw := callChannelAPI(t, AddChannel, http.MethodPost, "/api/channel", addBody("single", "null"))
			require.True(t, response.Success, raw)
			keyless := ids(response)
			require.Len(t, keyless, 1)
			stored, err := model.GetChannelById(keyless[0], true)
			require.NoError(t, err)
			assert.Empty(t, stored.Key)
			assert.Equal(t, common.ChannelStatusAutoDisabled, stored.Status)

			response, raw = callChannelAPI(t, AddChannel, http.MethodPost, "/api/channel", addBody("batch", `"sk-1\nsk-2\nsk-3"`))
			require.True(t, response.Success, raw)
			batch := ids(response)
			require.Len(t, batch, 3)
			for index, id := range batch {
				stored, err := model.GetChannelById(id, true)
				require.NoError(t, err)
				assert.Equal(t, fmt.Sprintf("sk-%d", index+1), stored.Key, "each returned id is the channel of its key")
			}

			conversion, err := model.PreviewModelPricingConversion("relay-model", model.PricingValues{})
			require.NoError(t, err)
			assert.NotEqual(t, "Task pricing must be converted manually using the task usage schema.", conversion.UnsupportedReason)

			deleted := insertPluginChannel(t, pluginKey, server.URL, pluginCredentialLine(t, pluginKey, "batch-deleted"), false)
			disabled := insertPluginChannel(t, pluginKey, server.URL, pluginCredentialLine(t, pluginKey, "disabled-deleted"), false)
			require.NoError(t, db.Model(&model.Channel{}).Where("id = ?", disabled.Id).Update("status", common.ChannelStatusManuallyDisabled).Error)

			response, raw = callChannelAPI(t, DeleteChannelBatch, http.MethodPost, "/api/channel/batch", fmt.Sprintf(`{"ids":[%d]}`, deleted.Id))
			require.True(t, response.Success, raw)
			response, raw = callChannelAPI(t, DeleteDisabledChannel, http.MethodDelete, "/api/channel/disabled", "")
			require.True(t, response.Success, raw)

			assert.Eventually(t, func() bool { return len(server.tokens()) == 2 }, 5*time.Second, 10*time.Millisecond)
			assert.ElementsMatch(t, []string{"/revoke batch-deleted", "/revoke disabled-deleted"}, server.tokens())
			var remaining []int
			require.NoError(t, db.Model(&model.Channel{}).Order("id").Pluck("id", &remaining).Error)
			assert.Equal(t, batch, remaining, "the keyless channel waiting for a login was disabled, so it went too")

			// Each write reads the channel while a refresh of its credential
			// waits on the vendor, and writes after the refresh stored the
			// rotated credential, which must survive the write.
			manageKeys := func(t *testing.T, channel *model.Channel, action string) {
				response, raw := callChannelAPI(t, ManageMultiKeys, http.MethodPost, "/api/channel/multi_key/manage", fmt.Sprintf(`{"channel_id":%d,"action":%q,"key_index":1}`, channel.Id, action))
				assert.True(t, response.Success, raw)
			}
			for _, race := range []struct {
				name  string
				write func(t *testing.T, channel *model.Channel)
				// rest is the key after the rotated credential.
				rest  []string
				check func(t *testing.T, stored *model.Channel)
			}{
				{name: "an edit that sends the key back", write: func(t *testing.T, channel *model.Channel) {
					response, raw := callChannelAPI(t, UpdateChannel, http.MethodPut, "/api/channel", fmt.Sprintf(`{"id":%d,"name":"renamed","key":%q}`, channel.Id, channel.Key))
					assert.True(t, response.Success, raw)
				}, rest: []string{"sk-static"}, check: func(t *testing.T, stored *model.Channel) {
					assert.Equal(t, "renamed", stored.Name)
				}},
				{name: "an edit that appends a key", write: func(t *testing.T, channel *model.Channel) {
					response, raw := callChannelAPI(t, UpdateChannel, http.MethodPut, "/api/channel", fmt.Sprintf(`{"id":%d,"key":"sk-new","key_mode":"append"}`, channel.Id))
					assert.True(t, response.Success, raw)
				}, rest: []string{"sk-static", "sk-new"}},
				{name: "a key disabled by hand", write: func(t *testing.T, channel *model.Channel) {
					manageKeys(t, channel, "disable_key")
				}, rest: []string{"sk-static"}, check: func(t *testing.T, stored *model.Channel) {
					assert.Equal(t, common.ChannelStatusManuallyDisabled, stored.ChannelInfo.MultiKeyStatusList[1])
				}},
				{name: "a key deleted", write: func(t *testing.T, channel *model.Channel) {
					manageKeys(t, channel, "delete_key")
				}, rest: []string{}, check: func(t *testing.T, stored *model.Channel) {
					assert.Equal(t, 1, stored.ChannelInfo.MultiKeySize)
				}},
				{name: "a key status write", write: func(t *testing.T, channel *model.Channel) {
					model.UpdateChannelStatus(channel.Id, "sk-static", common.ChannelStatusAutoDisabled, "upstream rejected the key")
				}, rest: []string{"sk-static"}, check: func(t *testing.T, stored *model.Channel) {
					assert.Equal(t, common.ChannelStatusAutoDisabled, stored.ChannelInfo.MultiKeyStatusList[1])
				}},
			} {
				t.Run(race.name, func(t *testing.T) {
					var arrivedOnce, releaseOnce sync.Once
					arrived, release := make(chan struct{}), make(chan struct{})
					vendor := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
						arrivedOnce.Do(func() { close(arrived) })
						<-release
						w.Header().Set("Content-Type", "application/json")
						_, _ = io.WriteString(w, `{"token":"rotated"}`)
					}))
					t.Cleanup(vendor.Close)
					t.Cleanup(func() { releaseOnce.Do(func() { close(release) }) })
					old := pluginCredentialLine(t, pluginKey, "old")
					channel := insertPluginChannel(t, pluginKey, vendor.URL, old+"\nsk-static", true)

					refreshed := make(chan error, 1)
					go func() {
						_, err := service.RefreshPluginCredential(context.Background(), channel.Id, 0, old)
						refreshed <- err
					}()
					select {
					case <-arrived:
					case <-time.After(10 * time.Second):
						require.FailNow(t, "the refresh never reached the vendor")
					}
					// The write's first read of the channel waits until the
					// refresh has stored the rotated credential.
					read, resume := make(chan struct{}), make(chan struct{})
					var readOnce sync.Once
					require.NoError(t, db.Callback().Query().After("gorm:query").Register("test:hold_channel_read", func(tx *gorm.DB) {
						if tx.Statement.Table == "channels" {
							readOnce.Do(func() { close(read); <-resume })
						}
					}))
					t.Cleanup(func() { _ = db.Callback().Query().Remove("test:hold_channel_read") })
					refreshDone := make(chan error, 1)
					go func() {
						select {
						case <-read:
						case <-time.After(10 * time.Second):
						}
						releaseOnce.Do(func() { close(release) })
						err := <-refreshed
						close(resume)
						refreshDone <- err
					}()
					race.write(t, channel)
					require.NoError(t, <-refreshDone)
					require.NoError(t, db.Callback().Query().Remove("test:hold_channel_read"))
					select {
					case <-read:
					default:
						require.FailNow(t, "the write never read the channel")
					}

					stored, err := model.GetChannelById(channel.Id, true)
					require.NoError(t, err)
					lines := strings.Split(stored.Key, "\n")
					credential, ok := jsplugin.ParseCredential(lines[0])
					require.True(t, ok, stored.Key)
					assert.JSONEq(t, `{"token":"rotated"}`, string(credential.Data), "the write kept the rotated credential")
					assert.Equal(t, race.rest, lines[1:])
					if race.check != nil {
						race.check(t, stored)
					}
				})
			}
		})
	}
}
