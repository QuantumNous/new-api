package controller

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const (
	// configPluginSource declares a channel config and checks typed-in keys.
	configPluginSource = `
export const meta = {apiVersion: 1, key: "%KEY%", name: "Config", version: "1.0.0", author: {name: "Test"},
  relay: [{incoming_path: "/v1/chat/completions", upstream_path: "/chat"}],
  channelConfig: {type: "object", properties: {
    region: {type: "string", title: {en: "Region"}, enum: ["us", "eu"], default: "us"},
    timeout: {type: "integer", title: {en: "Timeout"}, minimum: 1, default: 30},
  }}};
export function checkKey(ctx, key) {
  if (key.startsWith("bad")) return {error: "bad key " + key + " for " + ctx.config.region};
}
`
	// balancePluginSource returns the vendor's balance reply as its result.
	balancePluginSource = `
export const meta = {apiVersion: 1, key: "%KEY%", name: "Balance", version: "1.0.0", author: {name: "Test"},
  relay: [{incoming_path: "/v1/chat/completions", upstream_path: "/chat"}]};
export function buildBalanceRequest(ctx) { return {path: "/balance", headers: {"X-Key": ctx.apiKey}}; }
export function parseBalance(ctx, response) { return JSON.parse(response.body); }
`
	// chainedBalancePluginSource needs a session before it can read the
	// balance.
	chainedBalancePluginSource = `
export const meta = {apiVersion: 1, key: "%KEY%", name: "Chained balance", version: "1.0.0", author: {name: "Test"},
  relay: [{incoming_path: "/v1/chat/completions", upstream_path: "/chat"}]};
export function buildBalanceRequest(ctx) { return {path: "/balance/token", headers: {Authorization: "Bearer " + ctx.apiKey}}; }
export function parseBalance(ctx, response) {
  const body = JSON.parse(response.body);
  if (!ctx.state) return {next: {path: "/balance", headers: {"X-Session": body.session}}, state: {session: body.session}};
  if (body.session !== ctx.state.session) return {error: "the session is lost"};
  return {amount: body.amount, currency: body.currency};
}
`
)

func setupChannelGapsTest(t *testing.T) {
	t.Helper()
	setupTaskPluginBindChannelTest(t)
	service.InitHttpClient()
	previousMemoryCache, previousInterval, previousRate := common.MemoryCacheEnabled, common.RequestInterval, operation_setting.USDExchangeRate
	common.MemoryCacheEnabled, common.RequestInterval, operation_setting.USDExchangeRate = false, 0, 7.3
	t.Cleanup(func() {
		common.MemoryCacheEnabled, common.RequestInterval, operation_setting.USDExchangeRate = previousMemoryCache, previousInterval, previousRate
	})
}

func registerChannelGapsPlugin(t *testing.T, key, source string) {
	t.Helper()
	_, err := jsplugin.DefaultRegistry.Register(strings.ReplaceAll(source, "%KEY%", key), jsplugin.Options{})
	require.NoError(t, err)
	t.Cleanup(func() { _ = jsplugin.DefaultRegistry.Unregister(key) })
}

func storedGapsChannel(t *testing.T, id int) *model.Channel {
	t.Helper()
	channel, err := model.GetChannelById(id, true)
	require.NoError(t, err)
	return channel
}

func TestGapsChannelConfigAndKeyCheckOnSave(t *testing.T) {
	setupChannelGapsTest(t)
	registerChannelGapsPlugin(t, "gaps-config", configPluginSource)
	addBody := func(mode, key, settings string) string {
		body, err := common.Marshal(map[string]any{"mode": mode, "channel": map[string]any{
			"type": constant.ChannelTypeTaskPlugin, "name": "gaps", "key": key, "models": "m", "group": "default",
			"base_url": "https://vendor.example", "setting": `{"task_plugin_key":"gaps-config"}`, "settings": settings,
		}})
		require.NoError(t, err)
		return string(body)
	}
	countChannels := func() int64 {
		var count int64
		require.NoError(t, model.DB.Model(&model.Channel{}).Count(&count).Error)
		return count
	}

	t.Run("add rejects an invalid config or key", func(t *testing.T) {
		for name, tc := range map[string]struct{ mode, key, settings, message string }{
			"a value outside the enum":               {"single", "good-1", `{"plugin_config":{"region":"mars"}}`, "Invalid plugin config: plugin_config.region must be one of the listed values"},
			"a config that is no object":             {"single", "good-1", `{"plugin_config":[1]}`, "Invalid plugin config: plugin_config must be a JSON object"},
			"a rejected key with the default config": {"single", "bad-1", "", "The plugin rejected the key: bad key bad-1 for us"},
			"a rejected key with the saved config":   {"single", "bad-1", `{"plugin_config":{"region":"eu"}}`, "The plugin rejected the key: bad key bad-1 for eu"},
			"a rejected second line":                 {"multi_to_single", "good-1\nbad-2", "", "The plugin rejected key line 2: bad key bad-2 for us"},
		} {
			t.Run(name, func(t *testing.T) {
				response, raw := callChannelAPI(t, AddChannel, http.MethodPost, "/api/channel", addBody(tc.mode, tc.key, tc.settings))
				assert.False(t, response.Success, raw)
				assert.True(t, strings.HasPrefix(response.Message, tc.message), response.Message)
			})
		}
		assert.Zero(t, countChannels())
	})

	t.Run("add stores the declared values without defaults", func(t *testing.T) {
		response, raw := callChannelAPI(t, AddChannel, http.MethodPost, "/api/channel", addBody("single", "good-1", `{"plugin_config":{"region":"eu","undeclared":1}}`))
		require.True(t, response.Success, raw)
		var data struct {
			IDs []int `json:"ids"`
		}
		require.NoError(t, json.Unmarshal(response.Data, &data))
		require.Len(t, data.IDs, 1)
		stored := storedGapsChannel(t, data.IDs[0]).GetOtherSettings().PluginConfig
		assert.JSONEq(t, `{"region":"eu"}`, string(stored))
		plugin, ok := jsplugin.DefaultRegistry.Get("gaps-config")
		require.True(t, ok)
		assert.JSONEq(t, `{"region":"eu","timeout":30}`, string(plugin.ChannelConfigFor(stored)), "defaults apply when the config is read")
	})

	t.Run("update checks only the key lines it adds", func(t *testing.T) {
		channel := insertPluginChannel(t, "gaps-config", "https://vendor.example", "bad-stored", false)
		channel.SetOtherSettings(dto.ChannelOtherSettings{PluginConfig: json.RawMessage(`{"region":"eu"}`)})
		require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", channel.Id).Update("settings", channel.OtherSettings).Error)
		update := func(fields string) (channelAPIResponse, string) {
			return callChannelAPI(t, UpdateChannel, http.MethodPut, "/api/channel", fmt.Sprintf(`{"id":%d,%s}`, channel.Id, fields))
		}

		response, raw := update(`"name":"renamed","key":"bad-stored"`)
		require.True(t, response.Success, raw, "the stored key is not checked again")
		assert.Equal(t, "renamed", storedGapsChannel(t, channel.Id).Name)

		response, raw = update(`"key":"bad-new"`)
		assert.False(t, response.Success, raw)
		assert.Equal(t, "The plugin rejected the key: bad key bad-new for eu", response.Message, "the stored config reaches checkKey")
		assert.Equal(t, "bad-stored", storedGapsChannel(t, channel.Id).Key)

		response, raw = update(`"key":"good-new"`)
		require.True(t, response.Success, raw)
		assert.Equal(t, "good-new", storedGapsChannel(t, channel.Id).Key)

		multi := insertPluginChannel(t, "gaps-config", "https://vendor.example", "bad-stored\ngood-1", true)
		response, raw = callChannelAPI(t, UpdateChannel, http.MethodPut, "/api/channel", fmt.Sprintf(`{"id":%d,"key":"bad-stored\ngood-1\nbad-new"}`, multi.Id))
		assert.False(t, response.Success, raw)
		assert.Equal(t, "The plugin rejected key line 3: bad key bad-new for us", response.Message)
	})

	t.Run("update validates a config sent without the channel type", func(t *testing.T) {
		channel := insertPluginChannel(t, "gaps-config", "https://vendor.example", "good-1", false)
		response, raw := callChannelAPI(t, UpdateChannel, http.MethodPut, "/api/channel",
			fmt.Sprintf(`{"id":%d,"settings":"{\"plugin_config\":{\"region\":\"mars\",\"undeclared\":1}}"}`, channel.Id))
		assert.False(t, response.Success, raw)
		assert.True(t, strings.HasPrefix(response.Message, "Invalid plugin config: "), raw)
		assert.Empty(t, storedGapsChannel(t, channel.Id).GetOtherSettings().PluginConfig)

		response, raw = callChannelAPI(t, UpdateChannel, http.MethodPut, "/api/channel",
			fmt.Sprintf(`{"id":%d,"settings":"{\"plugin_config\":{\"region\":\"eu\",\"undeclared\":1}}"}`, channel.Id))
		require.True(t, response.Success, raw)
		assert.JSONEq(t, `{"region":"eu"}`, string(storedGapsChannel(t, channel.Id).GetOtherSettings().PluginConfig))
	})
}

// balanceServer answers the balance request of each key with the reply set
// for it.
func balanceServer(t *testing.T, replies map[string]string) *httptest.Server {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, replies[r.Header.Get("X-Key")])
	}))
	t.Cleanup(server.Close)
	return server
}

func TestGapsUpdateChannelBalanceOfAPluginChannel(t *testing.T) {
	setupChannelGapsTest(t)
	registerChannelGapsPlugin(t, "gaps-chain", chainedBalancePluginSource)
	registerChannelGapsPlugin(t, "gaps-no-balance", `export const meta = {apiVersion: 1, key: "%KEY%", name: "No balance", version: "1.0.0", author: {name: "Test"},
  relay: [{incoming_path: "/v1/chat/completions", upstream_path: "/chat"}]};`)
	var mu sync.Mutex
	var paths []string
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		paths = append(paths, r.URL.Path)
		mu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		switch {
		case r.URL.Path == "/balance/token" && r.Header.Get("Authorization") == "Bearer sk-chain":
			_, _ = io.WriteString(w, `{"session":"s-1"}`)
		case r.URL.Path == "/balance" && r.Header.Get("X-Session") == "s-1":
			_, _ = io.WriteString(w, `{"session":"s-1","amount":7.3,"currency":"CNY"}`)
		default:
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = io.WriteString(w, `{}`)
		}
	}))
	t.Cleanup(upstream.Close)

	t.Run("a balance read in two calls", func(t *testing.T) {
		channel := insertPluginChannel(t, "gaps-chain", upstream.URL, "sk-chain", false)

		_, raw := callChannelAPI(t, UpdateChannelBalance, http.MethodGet, "/api/channel/update_balance", "", idParam(channel.Id))

		var response struct {
			Success       bool            `json:"success"`
			Balance       float64         `json:"balance"`
			BalanceDetail json.RawMessage `json:"balance_detail"`
		}
		require.NoError(t, json.Unmarshal([]byte(raw), &response))
		require.True(t, response.Success, raw)
		assert.Equal(t, []string{"/balance/token", "/balance"}, paths)
		assert.InDelta(t, 1.0, response.Balance, 1e-9, "CNY converts at the exchange rate setting")
		assert.JSONEq(t, `{"amount":7.3,"currency":"CNY","unlimited":false,"windows":[]}`, string(response.BalanceDetail))
		stored := storedGapsChannel(t, channel.Id)
		assert.InDelta(t, 1.0, stored.Balance, 1e-9)
		assert.Positive(t, stored.BalanceUpdatedTime)
		detail, err := common.Marshal(stored.GetBalanceDetail())
		require.NoError(t, err)
		assert.JSONEq(t, string(response.BalanceDetail), string(detail))
	})

	t.Run("a plugin without balance hooks", func(t *testing.T) {
		channel := insertPluginChannel(t, "gaps-no-balance", upstream.URL, "sk-chain", false)
		response, raw := callChannelAPI(t, UpdateChannelBalance, http.MethodGet, "/api/channel/update_balance", "", idParam(channel.Id))
		assert.False(t, response.Success, raw)
		assert.Equal(t, "The plugin of this channel does not report a balance", response.Message)
		assert.Nil(t, storedGapsChannel(t, channel.Id).GetBalanceDetail())
	})
}

func TestGapsBalanceRunDisablesOnlyWhatIsUsedUp(t *testing.T) {
	setupChannelGapsTest(t)
	registerChannelGapsPlugin(t, "gaps-balance", balancePluginSource)
	upstream := balanceServer(t, map[string]string{
		"sk-zero":      `{"amount":0,"currency":"USD"}`,
		"sk-euro":      `{"amount":-2,"currency":"EUR"}`,
		"sk-unlimited": `{"amount":0,"currency":"USD","unlimited":true}`,
		"sk-windows":   `{"windows":[{"name":"5h","used":100,"limit":100}]}`,
		"sk-error":     `{"error":"account suspended"}`,
		"sk-funded":    `{"amount":5,"currency":"USD"}`,
	})
	// run stores the key on a channel whose balance column holds 9 and runs
	// its query as an update of all balances does.
	run := func(t *testing.T, key string, multiKey bool, autoBan int) *model.Channel {
		t.Helper()
		channel := insertPluginChannel(t, "gaps-balance", upstream.URL, key, multiKey)
		require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", channel.Id).Updates(map[string]any{"balance": 9, "auto_ban": autoBan}).Error)
		updateBalanceInRun(storedGapsChannel(t, channel.Id))
		return storedGapsChannel(t, channel.Id)
	}

	for _, tc := range []struct {
		name, key  string
		autoBan    int
		wantStatus int
		// wantBalance is the USD balance column: 9 when the result has none.
		wantBalance float64
		wantDetail  string
	}{
		{"used up with auto-ban on", "sk-zero", 1, common.ChannelStatusAutoDisabled, 0, `{"amount":0,"currency":"USD","unlimited":false,"windows":[]}`},
		{"used up with auto-ban off", "sk-zero", 0, common.ChannelStatusEnabled, 0, `{"amount":0,"currency":"USD","unlimited":false,"windows":[]}`},
		{"below zero in another currency", "sk-euro", 1, common.ChannelStatusAutoDisabled, 9, `{"amount":-2,"currency":"EUR","unlimited":false,"windows":[]}`},
		{"unlimited", "sk-unlimited", 1, common.ChannelStatusEnabled, 9, `{"amount":0,"currency":"USD","unlimited":true,"windows":[]}`},
		{"windows only", "sk-windows", 1, common.ChannelStatusEnabled, 9, `{"amount":null,"currency":"","unlimited":false,"windows":[{"name":{"en":"5h"},"used":100,"limit":100}]}`},
		{"an error", "sk-error", 1, common.ChannelStatusEnabled, 9, `{"amount":null,"currency":"","unlimited":false,"windows":[],"error":"account suspended"}`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			stored := run(t, tc.key, false, tc.autoBan)
			assert.Equal(t, tc.wantStatus, stored.Status)
			assert.InDelta(t, tc.wantBalance, stored.Balance, 1e-9)
			detail, err := common.Marshal(stored.GetBalanceDetail())
			require.NoError(t, err)
			assert.JSONEq(t, tc.wantDetail, string(detail))
		})
	}

	t.Run("a multi-key channel disables only the used-up key", func(t *testing.T) {
		stored := run(t, "sk-funded\nsk-zero", true, 1)
		assert.Equal(t, common.ChannelStatusEnabled, stored.Status)
		assert.Equal(t, map[int]int{1: common.ChannelStatusAutoDisabled}, stored.ChannelInfo.MultiKeyStatusList)
		assert.Equal(t, "Insufficient balance", stored.ChannelInfo.MultiKeyDisabledReason[1])
		assert.InDelta(t, 5.0, stored.Balance, 1e-9, "the keys' amounts add up")
		detail, err := common.Marshal(stored.GetBalanceDetail())
		require.NoError(t, err)
		assert.JSONEq(t, `{"amount":5,"currency":"USD","unlimited":false,"windows":[],"keys":{
		  "0":{"amount":5,"currency":"USD","unlimited":false,"windows":[]},
		  "1":{"amount":0,"currency":"USD","unlimited":false,"windows":[]}}}`, string(detail))
	})
}

func TestGapsUpdateAllBalancesRunsAsASystemTask(t *testing.T) {
	setupChannelGapsTest(t)
	require.NoError(t, model.DB.AutoMigrate(&model.SystemTask{}, &model.SystemTaskLock{}))
	registerChannelGapsPlugin(t, "gaps-balance-all", balancePluginSource)
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"amount":3,"currency":"USD"}`)
	}))
	t.Cleanup(upstream.Close)
	channel := insertPluginChannel(t, "gaps-balance-all", upstream.URL, "sk-all", false)

	type queuedRun struct {
		Started bool   `json:"started"`
		TaskID  string `json:"task_id"`
		Status  string `json:"status"`
	}
	queue := func(t *testing.T) (queuedRun, string) {
		t.Helper()
		response, raw := callChannelAPI(t, UpdateAllChannelsBalance, http.MethodGet, "/api/channel/update_balance", "")
		require.True(t, response.Success, raw)
		var run queuedRun
		require.NoError(t, common.Unmarshal(response.Data, &run))
		return run, response.Message
	}
	// run claims a queued task as a master node's runner does and runs it.
	run := func(t *testing.T, ctx context.Context, taskID string) {
		t.Helper()
		task, err := model.GetSystemTaskByTaskID(taskID)
		require.NoError(t, err)
		claimed, ok, err := model.ClaimSystemTask(task.ID, model.SystemTaskTypeChannelBalance, "test-runner", common.GetTimestamp()+60)
		require.NoError(t, err)
		require.True(t, ok)
		channelBalanceHandler{}.Run(ctx, claimed, "test-runner")
	}
	progress := func(t *testing.T, taskID string) (channelAPIResponse, string) {
		t.Helper()
		return callChannelAPI(t, GetChannelBalanceTask, http.MethodGet, "/api/channel/update_balance/task/"+taskID, "", gin.Param{Key: "task_id", Value: taskID})
	}

	first, message := queue(t)
	assert.Equal(t, "Balance update started in the background", message)
	assert.Equal(t, queuedRun{Started: true, TaskID: first.TaskID, Status: "pending"}, first)

	again, message := queue(t)
	assert.Equal(t, "A balance update is already running", message)
	assert.Equal(t, queuedRun{Started: false, TaskID: first.TaskID, Status: "pending"}, again, "a second request follows the queued run")

	run(t, context.Background(), first.TaskID)
	assert.InDelta(t, 3.0, storedGapsChannel(t, channel.Id).Balance, 1e-9)
	response, raw := progress(t, first.TaskID)
	require.True(t, response.Success, raw)
	assert.JSONEq(t, fmt.Sprintf(`{"task_id":%q,"status":"succeeded","state":{"total":1,"processed":1,"progress":100},"error":""}`, first.TaskID), string(response.Data))

	second, _ := queue(t)
	assert.True(t, second.Started, "a finished run lets the next request queue a new one")
	assert.NotEqual(t, first.TaskID, second.TaskID)
	cancelled, cancel := context.WithCancel(context.Background())
	cancel()
	run(t, cancelled, second.TaskID)
	response, raw = progress(t, second.TaskID)
	require.True(t, response.Success, raw)
	var lost struct {
		Status string `json:"status"`
		Error  string `json:"error"`
	}
	require.NoError(t, common.Unmarshal(response.Data, &lost))
	assert.Equal(t, "failed", lost.Status, "a run that loses its lease fails")
	assert.Equal(t, context.Canceled.Error(), lost.Error)

	other, err := model.CreateSystemTask(model.SystemTaskTypeLogCleanup, nil, nil)
	require.NoError(t, err)
	response, _ = progress(t, other.TaskID)
	assert.False(t, response.Success)
	assert.Equal(t, "Balance update task not found", response.Message, "only balance update tasks are readable here")
}

func TestGapsFetchModelsPreviewOfAPluginChannel(t *testing.T) {
	setupChannelGapsTest(t)
	registerChannelGapsPlugin(t, "gaps-preview", `export const meta = {apiVersion: 1, key: "%KEY%", name: "Preview", version: "1.0.0", author: {name: "Test"},
  baseUrl: "http://vendor.invalid", relay: [{incoming_path: "/v1/models", upstream_path: "/models"}]};`)

	t.Run("the form's values reach the preview channel", func(t *testing.T) {
		empty, proxy, headerOverride := "", " http://127.0.0.1:3128 ", `{"X-Preview":"on"}`
		channel := &model.Channel{Type: constant.ChannelTypeTaskPlugin, Key: "sk", BaseURL: &empty}
		require.NoError(t, applyTaskPluginModelPreview(channel, fetchModelsRequest{TaskPluginKey: "gaps-preview", Proxy: &proxy, HeaderOverride: &headerOverride}))
		assert.Equal(t, "http://vendor.invalid", channel.GetBaseURL())
		assert.Equal(t, dto.ChannelSettings{TaskPluginKey: "gaps-preview", Proxy: "http://127.0.0.1:3128"}, channel.GetSetting())
		require.NotNil(t, channel.HeaderOverride)
		assert.Equal(t, headerOverride, *channel.HeaderOverride)

		explicit := "https://explicit.example"
		channel = &model.Channel{Type: constant.ChannelTypeTaskPlugin, Key: "sk", BaseURL: &explicit}
		require.NoError(t, applyTaskPluginModelPreview(channel, fetchModelsRequest{TaskPluginKey: "gaps-preview"}))
		assert.Equal(t, explicit, channel.GetBaseURL(), "a typed-in base URL wins")

		badOverride := `["X-Preview"]`
		require.ErrorContains(t, applyTaskPluginModelPreview(channel, fetchModelsRequest{TaskPluginKey: "gaps-preview", HeaderOverride: &badOverride}), "header_override must be a JSON object")
	})

	t.Run("an unsaved channel fetches through the form's proxy", func(t *testing.T) {
		received := make(chan *http.Request, 1)
		proxy := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			received <- r.Clone(r.Context())
			w.Header().Set("Content-Type", "application/json")
			_, _ = io.WriteString(w, `{"object":"list","data":[{"id":"proxied-a"}]}`)
		}))
		t.Cleanup(proxy.Close)
		body, err := common.Marshal(map[string]any{"type": constant.ChannelTypeTaskPlugin, "task_plugin_key": "gaps-preview", "key": "sk-preview",
			"proxy": proxy.URL, "header_override": `{"X-Preview":"on"}`})
		require.NoError(t, err)

		response, raw := callChannelAPI(t, FetchModels, http.MethodPost, "/api/channel/fetch_models", string(body))

		require.True(t, response.Success, raw)
		assert.JSONEq(t, `["proxied-a"]`, string(response.Data))
		sent := <-received
		assert.Equal(t, "vendor.invalid", sent.Host, "the plugin's base URL stands in for the empty one")
		assert.Equal(t, "/models", sent.URL.Path)
		assert.Equal(t, "on", sent.Header.Get("X-Preview"))
	})
}

func TestGapsProviderTestEndpoint(t *testing.T) {
	routes := func(routes ...dto.AdvancedCustomRoute) jsplugin.Meta { return jsplugin.Meta{Relay: routes} }
	route := func(path string, models ...string) dto.AdvancedCustomRoute {
		return dto.AdvancedCustomRoute{IncomingPath: path, UpstreamPath: "/upstream", Models: models}
	}
	for _, tc := range []struct {
		name         string
		meta         jsplugin.Meta
		requestPath  string
		model        string
		wantEndpoint constant.EndpointType
		wantOK       bool
	}{
		{"the default endpoint is served", routes(route("/v1/chat/completions"), route("/v1/messages")), "/v1/chat/completions", "m", "", false},
		{"only Anthropic Messages is served", routes(route("/v1/messages")), "/v1/chat/completions", "claude-x", constant.EndpointTypeAnthropic, true},
		{"a Gemini route with the model in its path", routes(route("/v1beta/models/{model}:generateContent")), "/v1/chat/completions", "gemini-x", constant.EndpointTypeGemini, true},
		{"the default endpoint serves other models only", routes(route("/v1/chat/completions", "other"), route("/v1/messages")), "/v1/chat/completions", "claude-x", constant.EndpointTypeAnthropic, true},
		{"no test endpoint is served", routes(route("/v1/videos")), "/v1/chat/completions", "m", "", false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			endpoint, ok := providerTestEndpoint(tc.meta, tc.requestPath, tc.model)
			assert.Equal(t, tc.wantOK, ok)
			assert.Equal(t, tc.wantEndpoint, endpoint)
		})
	}
}
