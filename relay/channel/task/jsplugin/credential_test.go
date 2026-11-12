package jsplugin

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	pluginruntime "github.com/QuantumNous/new-api/pkg/jsplugin"
	"github.com/QuantumNous/new-api/relay/channel"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// credentialTaskPlugin has only a task part: its channels may hold the
// credentials its login stores.
const credentialTaskPlugin = `
export const meta = {
  apiVersion: 1, key: "%KEY%", name: "Credential task", version: "1.0.0", author: {name: "Test"},
  models: ["cred-video"], fetchMode: "per_task",
};
function seen(ctx) {
  return {"X-Seen-Auth": ctx.authHeader || "", "X-Seen-Credential": ctx.credential ? ctx.credential.access : "", "X-Seen-Api-Key": String(ctx.apiKey)};
}
export function buildSubmitRequest(ctx) {
  return {url: ctx.baseUrl + "/submit", method: "POST", headers: seen(ctx), body: {prompt: ctx.requestBody.prompt}};
}
export function parseSubmitResponse(ctx, resp) { return {taskId: resp.body.id || "up-1"}; }
export function buildQueryRequest(ctx) { return {url: ctx.baseUrl + "/tasks/" + ctx.taskId, method: "GET", headers: seen(ctx)}; }
export function parseTaskResult(ctx) { return {status: "SUCCESS", state: {credential: ctx.credential ? ctx.credential.access : ""}}; }
export function buildBatchQueryRequest(ctx) {
  return {url: ctx.baseUrl + "/batch", method: "POST", headers: seen(ctx), body: {ids: ctx.tasks.map((task) => task.taskId)}};
}
export function parseBatchResult(ctx) {
  return ctx.tasks.map((task) => ({taskId: task.taskId, status: "IN_PROGRESS", progress: "50%", state: {credential: ctx.credential ? ctx.credential.access : ""}}));
}
export function listArtifacts() { return [{key: "video", type: "video"}]; }
export function buildContentRequest(ctx) {
  if (ctx.clientRequest.method === "HEAD") return {url: "https://cdn.example/video.mp4", method: "GET", credentialless: true};
  return {url: ctx.baseUrl + "/content/" + ctx.taskId + "?part=1", method: "GET", headers: seen(ctx)};
}
export function signRequest(ctx, req) {
  const who = ctx.credential ? ctx.credential.access : "key:" + ctx.apiKey;
  return {headers: {"X-Signature": [who, req.method, req.url, req.bodySha256].join("|")}, query: {signed: "1"}};
}
export function login(ctx, input) {
  if (input === null) return {type: "fields", fields: [{name: "access", label: "Token", type: "password", required: true}]};
  return {type: "done", credential: {access: input.fields.access, refresh: "refresh-" + input.fields.access},
    headers: {Authorization: "Bearer " + input.fields.access}, accountId: "acct-" + input.fields.access};
}
export function refresh(ctx) {
  const response = utils.fetch({url: ctx.baseUrl + "/oauth/token", method: "POST", body: ctx.credential.refresh});
  if (response.status !== 200) throw new Error("refresh failed");
  return {credential: {access: "fresh-" + ctx.credential.access, refresh: "fresh-refresh"}, headers: {Authorization: "Bearer fresh-" + ctx.credential.access},
    expiresAt: utils.unixNow() + 3600};
}
`

type taskUpstreamRequest struct {
	Method, Path, RawQuery string
	Header                 http.Header
	Body                   string
}

type taskUpstream struct {
	*httptest.Server
	mu       sync.Mutex
	requests []taskUpstreamRequest
}

func newTaskUpstream(t *testing.T) *taskUpstream {
	t.Helper()
	upstream := &taskUpstream{}
	upstream.Server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		upstream.mu.Lock()
		upstream.requests = append(upstream.requests, taskUpstreamRequest{Method: r.Method, Path: r.URL.Path, RawQuery: r.URL.RawQuery, Header: r.Header.Clone(), Body: string(body)})
		upstream.mu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"up-1"}`))
	}))
	t.Cleanup(upstream.Close)
	return upstream
}

func (u *taskUpstream) sent(t *testing.T, path string) taskUpstreamRequest {
	t.Helper()
	u.mu.Lock()
	defer u.mu.Unlock()
	for _, request := range u.requests {
		if request.Path == path {
			return request
		}
	}
	t.Fatalf("no request to %s among %d", path, len(u.requests))
	return taskUpstreamRequest{}
}

func registerCredentialTaskPlugin(t *testing.T, key string) *pluginruntime.LoadedPlugin {
	t.Helper()
	service.InitHttpClient()
	plugin, err := pluginruntime.DefaultRegistry.Register(strings.ReplaceAll(credentialTaskPlugin, "%KEY%", key), pluginruntime.Options{})
	require.NoError(t, err)
	t.Cleanup(func() { _ = pluginruntime.DefaultRegistry.Unregister(key) })
	return plugin
}

func taskCredentialLine(t *testing.T, plugin, access, account string, expiresAt int64) string {
	t.Helper()
	line, err := pluginruntime.Credential{Plugin: plugin, Data: json.RawMessage(`{"access":"` + access + `","refresh":"refresh-` + access + `"}`),
		Headers: map[string]string{"Authorization": "Bearer " + access, "X-Account": account}, Query: map[string]string{"account": account},
		ExpiresAt: expiresAt, AccountID: account}.Line()
	require.NoError(t, err)
	return line
}

// useCredentialTestDB points model.DB at a new in-memory SQLite database
// holding models.
func useCredentialTestDB(t *testing.T, models ...any) {
	t.Helper()
	previousDB, previousMemoryCache := model.DB, common.MemoryCacheEnabled
	previousMain, previousLog := common.MainDatabaseType(), common.LogDatabaseType()
	database, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := database.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, database.AutoMigrate(models...))
	model.DB, common.MemoryCacheEnabled = database, false
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	t.Cleanup(func() {
		model.DB, common.MemoryCacheEnabled = previousDB, previousMemoryCache
		common.SetDatabaseTypes(previousMain, previousLog)
	})
}

func insertCredentialChannel(t *testing.T, pluginKey, baseURL, key string, multiKey bool) *model.Channel {
	t.Helper()
	stored := &model.Channel{Type: constant.ChannelTypeTaskPlugin, Key: key, Status: common.ChannelStatusEnabled, Models: "cred-video", Group: "default", BaseURL: &baseURL}
	stored.SetSetting(dto.ChannelSettings{TaskPluginKey: pluginKey})
	if multiKey {
		stored.ChannelInfo = model.ChannelInfo{IsMultiKey: true, MultiKeySize: len(strings.Split(key, "\n"))}
	}
	require.NoError(t, model.DB.Create(stored).Error)
	return stored
}

func credentialTaskInfo(baseURL, key string, channelType int) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType: channelType, ChannelId: 1, ChannelBaseUrl: baseURL, ApiKey: key,
			HeadersOverride: map[string]any{"X-Key": "[{api_key}]", "X-Admin": "admin"},
		},
		TaskRelayInfo: &relaycommon.TaskRelayInfo{},
	}
}

func submitCredentialTask(t *testing.T, adaptor *TaskAdaptor, info *relaycommon.RelayInfo) (*gin.Context, error) {
	t.Helper()
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/videos", nil)
	c.Set("task_request", relaycommon.TaskSubmitReq{Prompt: "hello"})
	body, err := adaptor.BuildRequestBody(c, info)
	if err != nil {
		return c, err
	}
	resp, err := adaptor.DoRequest(c, info, body)
	if resp != nil {
		_ = resp.Body.Close()
	}
	return c, err
}

func signature(who, method, target, body string) string {
	sum := sha256.Sum256([]byte(body))
	return strings.Join([]string{who, method, target, hex.EncodeToString(sum[:])}, "|")
}

func TestTaskSubmitUsesTheCredential(t *testing.T) {
	// The driver reads the plugin config of the channel it runs on.
	useCredentialTestDB(t, &model.Channel{})
	plugin := registerCredentialTaskPlugin(t, "task-cred-submit")
	upstream := newTaskUpstream(t)
	line := taskCredentialLine(t, "task-cred-submit", "tok-1", "acct-1", 0)
	info := credentialTaskInfo(upstream.URL, line, constant.ChannelTypeTaskPlugin)
	adaptor := New(plugin)
	adaptor.Init(info)

	_, err := submitCredentialTask(t, adaptor, info)

	require.NoError(t, err)
	request := upstream.sent(t, "/submit")
	assert.Equal(t, "Bearer tok-1", request.Header.Get("Authorization"), "the credential's headers replace meta.auth")
	assert.Equal(t, "acct-1", request.Header.Get("X-Account"))
	assert.Equal(t, "Bearer tok-1", request.Header.Get("X-Seen-Auth"))
	assert.Equal(t, "tok-1", request.Header.Get("X-Seen-Credential"))
	assert.Equal(t, "undefined", request.Header.Get("X-Seen-Api-Key"), "a credential is no API key")
	assert.Equal(t, "[]", request.Header.Get("X-Key"))
	assert.Equal(t, "admin", request.Header.Get("X-Admin"))
	assert.Contains(t, request.RawQuery, "account=acct-1")
	assert.Contains(t, request.RawQuery, "signed=1")
	assert.Equal(t, signature("tok-1", http.MethodPost, upstream.URL+"/submit?account=acct-1", request.Body), request.Header.Get("X-Signature"))
	assert.NotContains(t, request.Body, "refresh-tok-1")
	assert.Equal(t, line, info.ApiKey, "the channel key is restored after the request")
	assert.Equal(t, "acct-1", model.InitTask(constant.TaskPlatform("61"), info).PrivateData.CredentialAccount)
}

func TestTaskPollingUsesTheSubmittingAccount(t *testing.T) {
	// The driver reads the plugin config of the channel it runs on.
	useCredentialTestDB(t, &model.Channel{})
	plugin := registerCredentialTaskPlugin(t, "task-cred-poll")
	upstream := newTaskUpstream(t)
	key := "sk-static\n" + taskCredentialLine(t, "task-cred-poll", "tok-1", "acct-1", 0) + "\n" + taskCredentialLine(t, "task-cred-poll", "tok-2", "acct-2", 0)
	info := credentialTaskInfo(upstream.URL, key, constant.ChannelTypeTaskPlugin)
	adaptor := New(plugin)
	adaptor.Init(info)
	task := func(id, account string) *model.Task {
		return &model.Task{TaskID: "task_" + id, PrivateData: model.TaskPrivateData{UpstreamTaskID: id, CredentialAccount: account}}
	}

	for _, tc := range []struct{ name, account, want string }{
		{name: "the submitting account", account: "acct-2", want: "tok-2"},
		{name: "a task without an account", want: "tok-1"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			upstream.mu.Lock()
			upstream.requests = nil
			upstream.mu.Unlock()
			polled := task("up-"+tc.want, tc.account)
			resp, err := adaptor.FetchTask(upstream.URL, key, polled, "")
			require.NoError(t, err)
			defer resp.Body.Close()
			request := upstream.sent(t, "/tasks/up-"+tc.want)
			assert.Equal(t, "Bearer "+tc.want, request.Header.Get("Authorization"))
			assert.Equal(t, tc.want, request.Header.Get("X-Seen-Credential"))
			assert.Equal(t, "[]", request.Header.Get("X-Key"))
			assert.NotContains(t, request.Header.Get("X-Seen-Auth"), "sk-static")
			target := upstream.URL + "/tasks/up-" + tc.want + "?account=" + strings.Replace(tc.want, "tok", "acct", 1)
			assert.Equal(t, signature(tc.want, http.MethodGet, target, ""), request.Header.Get("X-Signature"))

			result, err := adaptor.ParseTaskResult(polled, resp, []byte(`{}`))
			require.NoError(t, err)
			assert.JSONEq(t, `{"credential":"`+tc.want+`"}`, string(result.PluginState), "the parse hook sees the credential the poll sent")
		})
	}

	t.Run("an account no longer on the channel", func(t *testing.T) {
		upstream.mu.Lock()
		upstream.requests = nil
		upstream.mu.Unlock()
		_, err := adaptor.FetchTask(upstream.URL, key, task("up-gone", "gone"), "")
		require.Error(t, err)
		upstream.mu.Lock()
		defer upstream.mu.Unlock()
		assert.Empty(t, upstream.requests, "no other account polls the task")
	})
}

// TestBatchPollsGroupTasksByAccount polls tasks of two accounts, and of one
// that left the channel, on one multi-key channel.
func TestBatchPollsGroupTasksByAccount(t *testing.T) {
	plugin := registerCredentialTaskPlugin(t, "task-cred-batch")
	upstream := newTaskUpstream(t)
	useCredentialTestDB(t, &model.Channel{}, &model.Task{})
	stored := insertCredentialChannel(t, "task-cred-batch", upstream.URL,
		taskCredentialLine(t, "task-cred-batch", "tok-1", "acct-1", 0)+"\n"+taskCredentialLine(t, "task-cred-batch", "tok-2", "acct-2", 0), true)
	taskM := map[string]*model.Task{}
	var ids []string
	for _, tc := range []struct{ id, account string }{{"up-1", "acct-1"}, {"up-2", "acct-2"}, {"up-3", "acct-1"}, {"up-4", "gone"}} {
		task := &model.Task{TaskID: "task_" + tc.id, Platform: constant.TaskPlatform("61"), ChannelId: stored.Id, Status: model.TaskStatusInProgress,
			PrivateData: model.TaskPrivateData{UpstreamTaskID: tc.id, CredentialAccount: tc.account}}
		require.NoError(t, model.DB.Create(task).Error)
		taskM[tc.id] = task
		ids = append(ids, tc.id)
	}

	require.NoError(t, service.UpdateBatchTasks(t.Context(), New(plugin), map[int][]string{stored.Id: ids}, taskM))

	upstream.mu.Lock()
	var batches []string
	for _, request := range upstream.requests {
		var body struct {
			IDs []string `json:"ids"`
		}
		require.NoError(t, json.Unmarshal([]byte(request.Body), &body))
		batches = append(batches, request.Header.Get("Authorization")+" "+strings.Join(body.IDs, ","))
	}
	upstream.mu.Unlock()
	assert.Equal(t, []string{"Bearer tok-1 up-1,up-3", "Bearer tok-2 up-2"}, batches, "each batch holds the tasks of one account")
	for id, credential := range map[string]string{"up-1": "tok-1", "up-2": "tok-2", "up-3": "tok-1"} {
		var task model.Task
		require.NoError(t, model.DB.Where("task_id = ?", "task_"+id).First(&task).Error)
		assert.Equal(t, "50%", task.Progress, id)
		assert.JSONEq(t, `{"credential":"`+credential+`"}`, string(task.PrivateData.PluginState), "%s: the parse hook sees its batch's credential", id)
	}
	var orphan model.Task
	require.NoError(t, model.DB.Where("task_id = ?", "task_up-4").First(&orphan).Error)
	assert.Equal(t, model.TaskStatus(model.TaskStatusInProgress), orphan.Status)
	assert.Equal(t, 1, orphan.PrivateData.PollFailures, "a task whose account left counts a failed poll")
}

// TestTaskOnlyPluginLoginServesTasks logs in on a channel of a plugin with
// only a task part, then submits and polls a task with that credential.
func TestTaskOnlyPluginLoginServesTasks(t *testing.T) {
	plugin := registerCredentialTaskPlugin(t, "task-cred-login")
	require.False(t, plugin.Meta.HasProviderPart())
	upstream := newTaskUpstream(t)
	useCredentialTestDB(t, &model.Channel{}, &model.Ability{}, &model.AuthFlow{})
	stored := insertCredentialChannel(t, "task-cred-login", upstream.URL, "", false)
	identity := service.PluginLoginIdentity{UserID: 1, SessionID: "browser-session"}

	started, err := service.StartPluginLogin(t.Context(), identity, stored.Id, nil, false)
	require.NoError(t, err)
	require.Equal(t, "fields", started.Step.Type)
	_, err = service.ContinuePluginLogin(t.Context(), identity, stored.Id, started.Flow, service.PluginLoginInput{Fields: map[string]string{"access": "tok-9"}})
	require.NoError(t, err)
	reloaded, err := model.GetChannelById(stored.Id, true)
	require.NoError(t, err)
	credential, ok := pluginruntime.ParseCredential(reloaded.Key)
	require.True(t, ok, "the login stored a credential")
	assert.Equal(t, "acct-tok-9", credential.AccountID)

	info := credentialTaskInfo(upstream.URL, reloaded.Key, constant.ChannelTypeTaskPlugin)
	info.ChannelId = stored.Id
	adaptor := New(plugin)
	adaptor.Init(info)
	_, err = submitCredentialTask(t, adaptor, info)
	require.NoError(t, err)
	assert.Equal(t, "Bearer tok-9", upstream.sent(t, "/submit").Header.Get("Authorization"))

	task := model.InitTask(constant.TaskPlatform("61"), info)
	task.PrivateData.UpstreamTaskID = "up-9"
	resp, err := adaptor.FetchTask(upstream.URL, reloaded.Key, task, "")
	require.NoError(t, err)
	_ = resp.Body.Close()
	assert.Equal(t, "Bearer tok-9", upstream.sent(t, "/tasks/up-9").Header.Get("Authorization"), "the poll carries the login's credential")
}

func TestTaskContentRequestsUseTheCredential(t *testing.T) {
	// The driver reads the plugin config of the channel it runs on.
	useCredentialTestDB(t, &model.Channel{})
	plugin := registerCredentialTaskPlugin(t, "task-cred-content")
	key := taskCredentialLine(t, "task-cred-content", "tok-1", "acct-1", 0)
	adaptor := New(plugin)
	adaptor.Init(credentialTaskInfo("https://vendor.example", key, constant.ChannelTypeTaskPlugin))
	task := &model.Task{TaskID: "task_1", Data: []byte(`{}`), PrivateData: model.TaskPrivateData{UpstreamTaskID: "up-1", CredentialAccount: "acct-1"}}

	descriptor, err := adaptor.BuildContentRequest(t.Context(), task, "video", channel.TaskArtifactClientRequest{Method: http.MethodGet})

	require.NoError(t, err)
	assert.Equal(t, "https://vendor.example/content/task_1?account=acct-1&part=1&signed=1", descriptor.URL)
	assert.Equal(t, "Bearer tok-1", descriptor.Headers["Authorization"])
	assert.Equal(t, "tok-1", descriptor.Headers["X-Seen-Credential"])
	assert.Equal(t, "[]", descriptor.Headers["X-Key"])
	assert.Equal(t, signature("tok-1", http.MethodGet, "https://vendor.example/content/task_1?account=acct-1&part=1", ""), descriptor.Headers["X-Signature"])

	descriptor, err = adaptor.BuildContentRequest(t.Context(), task, "video", channel.TaskArtifactClientRequest{Method: http.MethodHead})
	require.NoError(t, err)
	assert.True(t, descriptor.Credentialless)
	assert.Equal(t, "https://cdn.example/video.mp4", descriptor.URL)
	assert.Empty(t, descriptor.Headers, "a credentialless request gets no credential and no signature")
}

func TestForeignOrMisplacedCredentialsNeverLeave(t *testing.T) {
	// The driver reads the plugin config of the channel it runs on.
	useCredentialTestDB(t, &model.Channel{})
	plugin := registerCredentialTaskPlugin(t, "task-cred-owner")
	upstream := newTaskUpstream(t)
	for name, tc := range map[string]struct {
		key         string
		channelType int
	}{
		"another plugin's credential":       {key: taskCredentialLine(t, "someone-else", "tok-1", "acct-1", 0), channelType: constant.ChannelTypeTaskPlugin},
		"a credential on a New API channel": {key: taskCredentialLine(t, "task-cred-owner", "tok-1", "acct-1", 0), channelType: constant.ChannelTypeNewAPI},
	} {
		t.Run(name, func(t *testing.T) {
			info := credentialTaskInfo(upstream.URL, tc.key, tc.channelType)
			adaptor := New(plugin)
			adaptor.Init(info)
			if tc.channelType == constant.ChannelTypeTaskPlugin {
				_, err := submitCredentialTask(t, adaptor, info)
				require.Error(t, err)
			}
			_, err := adaptor.FetchTask(upstream.URL, tc.key, &model.Task{PrivateData: model.TaskPrivateData{UpstreamTaskID: "up-1"}}, "")
			require.Error(t, err)
			upstream.mu.Lock()
			defer upstream.mu.Unlock()
			assert.Empty(t, upstream.requests)
		})
	}
}

func TestStaticKeysKeepTheirBehavior(t *testing.T) {
	// The driver reads the plugin config of the channel it runs on.
	useCredentialTestDB(t, &model.Channel{})
	plugin := registerCredentialTaskPlugin(t, "task-cred-static")
	upstream := newTaskUpstream(t)
	for _, channelType := range []int{constant.ChannelTypeTaskPlugin, constant.ChannelTypeNewAPI} {
		info := credentialTaskInfo(upstream.URL, "sk-static", channelType)
		adaptor := New(plugin)
		adaptor.Init(info)
		resp, err := adaptor.FetchTask(upstream.URL, "sk-static", &model.Task{PrivateData: model.TaskPrivateData{UpstreamTaskID: "up-" + map[int]string{constant.ChannelTypeTaskPlugin: "61", constant.ChannelTypeNewAPI: "60"}[channelType]}}, "")
		require.NoError(t, err)
		_ = resp.Body.Close()
	}

	pluginChannel := upstream.sent(t, "/tasks/up-61")
	assert.Equal(t, "sk-static", pluginChannel.Header.Get("X-Seen-Api-Key"))
	assert.Equal(t, "[sk-static]", pluginChannel.Header.Get("X-Key"))
	assert.Equal(t, signature("key:sk-static", http.MethodGet, upstream.URL+"/tasks/up-61", ""), pluginChannel.Header.Get("X-Signature"),
		"signRequest signs a static key's requests on a task plugin channel too")

	gateway := upstream.sent(t, "/tasks/up-60")
	assert.Equal(t, "Bearer sk-static", gateway.Header.Get("X-Seen-Auth"))
	assert.Empty(t, gateway.Header.Get("X-Signature"), "a New API channel is another gateway, never signed")
	assert.NotContains(t, gateway.RawQuery, "signed")
}

func TestExpiringTaskCredentialIsRefreshedFirst(t *testing.T) {
	plugin := registerCredentialTaskPlugin(t, "task-cred-refresh")
	upstream := newTaskUpstream(t)
	useCredentialTestDB(t, &model.Channel{})
	insert := func(key string, multiKey bool) *model.Channel {
		return insertCredentialChannel(t, "task-cred-refresh", upstream.URL, key, multiKey)
	}
	soon := time.Now().Add(10 * time.Second).Unix()

	t.Run("submit", func(t *testing.T) {
		line := taskCredentialLine(t, "task-cred-refresh", "tok-1", "acct-1", soon)
		stored := insert(line, false)
		info := credentialTaskInfo(upstream.URL, line, constant.ChannelTypeTaskPlugin)
		info.ChannelId = stored.Id
		adaptor := New(plugin)
		adaptor.Init(info)

		c, err := submitCredentialTask(t, adaptor, info)

		require.NoError(t, err)
		assert.Equal(t, "Bearer fresh-tok-1", upstream.sent(t, "/submit").Header.Get("Authorization"))
		assert.Equal(t, "refresh-tok-1", upstream.sent(t, "/oauth/token").Body)
		reloaded, err := model.GetChannelById(stored.Id, true)
		require.NoError(t, err)
		assert.Equal(t, reloaded.Key, info.ApiKey, "the request goes on with the stored refreshed line")
		assert.Equal(t, reloaded.Key, common.GetContextKeyString(c, constant.ContextKeyChannelKey))
		assert.Contains(t, reloaded.Key, "fresh-refresh")
	})

	t.Run("poll", func(t *testing.T) {
		upstream.mu.Lock()
		upstream.requests = nil
		upstream.mu.Unlock()
		key := taskCredentialLine(t, "task-cred-refresh", "tok-a", "acct-a", 0) + "\n" + taskCredentialLine(t, "task-cred-refresh", "tok-b", "acct-b", soon)
		stored := insert(key, true)
		info := credentialTaskInfo(upstream.URL, key, constant.ChannelTypeTaskPlugin)
		info.ChannelId = stored.Id
		adaptor := New(plugin)
		adaptor.Init(info)

		resp, err := adaptor.FetchTask(upstream.URL, key, &model.Task{PrivateData: model.TaskPrivateData{UpstreamTaskID: "up-b", CredentialAccount: "acct-b"}}, "")

		require.NoError(t, err)
		_ = resp.Body.Close()
		assert.Equal(t, "Bearer fresh-tok-b", upstream.sent(t, "/tasks/up-b").Header.Get("Authorization"))
		reloaded, err := model.GetChannelById(stored.Id, true)
		require.NoError(t, err)
		lines := strings.Split(reloaded.Key, "\n")
		require.Len(t, lines, 2)
		assert.Equal(t, strings.Split(key, "\n")[0], lines[0], "the other credential is untouched")
		assert.Contains(t, lines[1], "fresh-tok-b")
	})
}
