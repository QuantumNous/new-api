package service

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
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
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

// useProviderPluginDatabase installs a database for the provider plugin tests.
// TEST_TASK_DB_DIALECT selects mysql or postgres through TEST_MYSQL_DSN and
// TEST_POSTGRES_DSN; the default is in-memory SQLite.
func useProviderPluginDatabase(t *testing.T) *gorm.DB {
	t.Helper()
	dialect := common.DatabaseType(os.Getenv("TEST_TASK_DB_DIALECT"))
	var driver gorm.Dialector
	switch dialect {
	case "", common.DatabaseTypeSQLite:
		dialect = common.DatabaseTypeSQLite
		driver = sqlite.Open(":memory:")
	case common.DatabaseTypeMySQL:
		require.NotEmpty(t, os.Getenv("TEST_MYSQL_DSN"))
		driver = mysql.Open(os.Getenv("TEST_MYSQL_DSN"))
	case common.DatabaseTypePostgreSQL:
		require.NotEmpty(t, os.Getenv("TEST_POSTGRES_DSN"))
		driver = postgres.New(postgres.Config{DSN: os.Getenv("TEST_POSTGRES_DSN"), PreferSimpleProtocol: true})
	default:
		t.Fatalf("unsupported test dialect %q", dialect)
	}
	database, err := gorm.Open(driver, &gorm.Config{NamingStrategy: schema.NamingStrategy{TablePrefix: fmt.Sprintf("tpp_%d_", time.Now().UnixNano())}})
	require.NoError(t, err)
	sqlDB, err := database.DB()
	require.NoError(t, err)
	if dialect == common.DatabaseTypeSQLite {
		// Every in-memory connection would be its own database.
		sqlDB.SetMaxOpenConns(1)
	}
	t.Cleanup(func() { _ = sqlDB.Close() })
	tables := []any{&model.Channel{}, &model.Ability{}, &model.AuthFlow{}, &model.User{}}
	require.NoError(t, database.AutoMigrate(tables...))
	t.Cleanup(func() { require.NoError(t, database.Migrator().DropTable(tables...)) })
	var version string
	if dialect == common.DatabaseTypeSQLite {
		require.NoError(t, database.Raw("SELECT sqlite_version()").Scan(&version).Error)
	} else {
		require.NoError(t, database.Raw("SELECT version()").Scan(&version).Error)
	}
	t.Logf("database: %s %s", dialect, version)

	previousDB, previousLogDB := model.DB, model.LOG_DB
	previousMain, previousLog := common.MainDatabaseType(), common.LogDatabaseType()
	previousMemory, previousRedis := common.MemoryCacheEnabled, common.RedisEnabled
	model.DB, model.LOG_DB = database, database
	common.SetDatabaseTypes(dialect, dialect)
	common.MemoryCacheEnabled, common.RedisEnabled = false, false
	InitHttpClient()
	t.Cleanup(func() {
		model.DB, model.LOG_DB = previousDB, previousLogDB
		common.SetDatabaseTypes(previousMain, previousLog)
		common.MemoryCacheEnabled, common.RedisEnabled = previousMemory, previousRedis
	})
	return database
}

// fakeAuthServer is an OAuth authorization server. A refresh token works
// once, as with rotation, so reuses counts every token sent twice.
type fakeAuthServer struct {
	*httptest.Server
	mu           sync.Mutex
	challenges   map[string]string
	refreshToken map[string]bool
	devicePolls  atomic.Int32
	devicePend   atomic.Int32
	tokenCalls   atomic.Int32
	refreshCalls atomic.Int32
	reuses       atomic.Int32
	revoked      atomic.Int32
	revokedToken atomic.Value
	failNext     atomic.Bool
	generation   atomic.Int32
	account      atomic.Value
	refreshFail  atomic.Value
	refreshDelay atomic.Int64
}

func newFakeAuthServer(t *testing.T) *fakeAuthServer {
	t.Helper()
	server := &fakeAuthServer{challenges: map[string]string{}, refreshToken: map[string]bool{}}
	server.account.Store("acct-1")
	server.refreshFail.Store("")
	server.Server = httptest.NewServer(http.HandlerFunc(server.handle))
	t.Cleanup(server.Close)
	return server
}

func (s *fakeAuthServer) issue(w http.ResponseWriter) {
	generation := s.generation.Add(1)
	refresh := fmt.Sprintf("refresh-%d", generation)
	s.mu.Lock()
	s.refreshToken[refresh] = true
	s.mu.Unlock()
	writeJSON(w, http.StatusOK, map[string]any{
		"access_token": fmt.Sprintf("access-%d", generation), "refresh_token": refresh, "expires_in": 3600, "account": s.account.Load(),
	})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	encoded, _ := common.Marshal(value)
	_, _ = w.Write(encoded)
}

func (s *fakeAuthServer) handle(w http.ResponseWriter, r *http.Request) {
	switch r.URL.Path {
	case "/authorize":
		query := r.URL.Query()
		s.mu.Lock()
		s.challenges["code-"+query.Get("state")] = query.Get("code_challenge")
		s.mu.Unlock()
		redirect, _ := url.Parse(query.Get("redirect_uri"))
		values := redirect.Query()
		values.Set("code", "code-"+query.Get("state"))
		values.Set("state", query.Get("state"))
		values.Set("iss", s.URL)
		redirect.RawQuery = values.Encode()
		http.Redirect(w, r, redirect.String(), http.StatusFound)
	case "/oauth/device":
		writeJSON(w, http.StatusOK, map[string]any{"device_code": "device-1", "user_code": "ABCD-EFGH", "expires_in": 600})
	case "/oauth/revoke":
		var form map[string]string
		_ = common.DecodeJson(r.Body, &form)
		s.revokedToken.Store(form["token"])
		s.revoked.Add(1)
		w.WriteHeader(http.StatusOK)
	case "/oauth/token":
		s.tokenEndpoint(w, r)
	default:
		http.NotFound(w, r)
	}
}

func (s *fakeAuthServer) tokenEndpoint(w http.ResponseWriter, r *http.Request) {
	s.tokenCalls.Add(1)
	if s.failNext.CompareAndSwap(true, false) {
		writeJSON(w, http.StatusBadGateway, map[string]any{"error": "temporarily_unavailable"})
		return
	}
	var form map[string]string
	if err := common.DecodeJson(r.Body, &form); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid_request"})
		return
	}
	switch form["grant_type"] {
	case "authorization_code":
		s.mu.Lock()
		challenge := s.challenges[form["code"]]
		delete(s.challenges, form["code"])
		s.mu.Unlock()
		sum := sha256.Sum256([]byte(form["code_verifier"]))
		if challenge == "" || challenge != base64.RawURLEncoding.EncodeToString(sum[:]) {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid_grant"})
			return
		}
		s.issue(w)
	case "device_code":
		s.devicePolls.Add(1)
		if s.devicePend.Add(-1) >= 0 {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "authorization_pending"})
			return
		}
		s.issue(w)
	case "refresh_token":
		s.refreshCalls.Add(1)
		time.Sleep(time.Duration(s.refreshDelay.Load()))
		if failure := s.refreshFail.Load().(string); failure != "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": failure})
			return
		}
		s.mu.Lock()
		valid := s.refreshToken[form["refresh_token"]]
		delete(s.refreshToken, form["refresh_token"])
		s.mu.Unlock()
		if !valid {
			s.reuses.Add(1)
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid_grant"})
			return
		}
		s.issue(w)
	default:
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "unsupported_grant_type"})
	}
}

// providerPluginSource is a plugin whose login starts with the step of mode.
const providerPluginSource = `
export const meta = {apiVersion: 1, key: "%KEY%", name: "Test provider", version: "1.0.0", author: {name: "Test"}, models: ["provider-model"],
  relay: [{incoming_path: "/v1/chat/completions", upstream_path: "/v1/chat/completions"}]};
const MODE = "%MODE%";
function post(ctx, path, form) {
  return utils.fetch({url: ctx.baseUrl + path, method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(form)});
}
function issued(response) {
  if (response.status !== 200) throw new Error("token endpoint answered " + response.status);
  const body = response.body;
  return {credential: {access: body.access_token, refresh: body.refresh_token}, headers: {Authorization: "Bearer " + body.access_token},
    expiresAt: utils.unixNow() + body.expires_in, accountId: body.account, label: body.account + "@example.com"};
}
function authorizeURL(ctx) {
  return ctx.baseUrl + "/authorize?state=" + ctx.login.state + "&code_challenge=" + ctx.login.codeChallenge + "&code_challenge_method=" + ctx.login.codeChallengeMethod +
    "&nonce=" + ctx.login.nonce + "&redirect_uri=" + encodeURIComponent(ctx.login.redirectUri);
}
export function login(ctx, input) {
  if (input === null) {
    if (MODE === "redirect") return {type: "redirect", url: authorizeURL(ctx), issuer: ctx.baseUrl, session: {secret: "session-secret"}};
    if (MODE === "paste") return {type: "paste", url: authorizeURL(ctx), hint: {en: "Paste the address"}, session: {secret: "session-secret"}};
    if (MODE === "fields") return {type: "fields", session: {secret: "session-secret"}, fields: [{name: "api_token", label: "Token", type: "password", required: true}, {name: "note", label: {en: "Note"}}]};
    const device = post(ctx, "/oauth/device", {}).body;
    return {type: "device", userCode: device.user_code, verificationUri: ctx.baseUrl + "/device", interval: 1, expiresIn: MODE === "shortdevice" ? 1 : device.expires_in, session: {device: device.device_code}};
  }
  if (input.callback) {
    if (!ctx.login.session || ctx.login.session.secret !== "session-secret") throw new Error("the session is lost");
    const token = post(ctx, "/oauth/token", {grant_type: "authorization_code", code: input.callback.code, code_verifier: ctx.login.codeVerifier});
    return Object.assign({type: "done"}, issued(token));
  }
  if (input.fields) {
    return {type: "done", credential: {access: input.fields.api_token}, headers: {Authorization: "Bearer " + input.fields.api_token}, accountId: "field-account", label: "Field " + (input.fields.note || "")};
  }
  const polled = post(ctx, "/oauth/token", {grant_type: "device_code", device_code: ctx.login.session.device});
  if (polled.status === 400 && polled.body.error === "authorization_pending") return {type: "pending"};
  return Object.assign({type: "done"}, issued(polled));
}
export function refresh(ctx) {
  const response = post(ctx, "/oauth/token", {grant_type: "refresh_token", refresh_token: ctx.credential.refresh});
  if (response.status === 400 && response.body.error === "invalid_grant") return {relogin: true};
  const result = issued(response);
  if (response.body.account === "keep") { delete result.accountId; delete result.label; }
  return result;
}
export function revoke(ctx) { post(ctx, "/oauth/revoke", {token: ctx.credential.refresh}); }
`

func registerProviderPlugin(t *testing.T, key, mode string) *jsplugin.LoadedPlugin {
	t.Helper()
	source := strings.NewReplacer("%KEY%", key, "%MODE%", mode).Replace(providerPluginSource)
	plugin, err := jsplugin.DefaultRegistry.Register(source, jsplugin.Options{})
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, jsplugin.DefaultRegistry.Unregister(key)) })
	return plugin
}

func createProviderChannel(t *testing.T, pluginKey, baseURL, key string, multiKey bool) *model.Channel {
	t.Helper()
	channel := &model.Channel{Type: constant.ChannelTypeTaskPlugin, Key: key, Status: common.ChannelStatusEnabled, Name: "provider", Models: "provider-model", Group: "default", BaseURL: &baseURL}
	channel.SetSetting(dto.ChannelSettings{TaskPluginKey: pluginKey})
	if multiKey {
		channel.ChannelInfo = model.ChannelInfo{IsMultiKey: true, MultiKeySize: len(strings.Split(key, "\n")), MultiKeyMode: constant.MultiKeyModePolling}
	}
	require.NoError(t, channel.Insert())
	return channel
}

func credentialLine(t *testing.T, credential jsplugin.Credential) string {
	t.Helper()
	line, err := credential.Line()
	require.NoError(t, err)
	return line
}

func expiringLine(t *testing.T, plugin, refresh, account string, expiresAt int64) string {
	t.Helper()
	return credentialLine(t, jsplugin.Credential{
		Plugin: plugin, Data: json.RawMessage(`{"access":"old","refresh":"` + refresh + `"}`),
		Headers: map[string]string{"Authorization": "Bearer old"}, ExpiresAt: expiresAt, AccountID: account, Label: account + "@example.com",
	})
}

func storedChannel(t *testing.T, id int) *model.Channel {
	t.Helper()
	channel, err := model.GetChannelById(id, true)
	require.NoError(t, err)
	return channel
}

func storedCredential(t *testing.T, id, index int) *jsplugin.Credential {
	t.Helper()
	lines := pluginCredentialKeyLines(storedChannel(t, id))
	require.Greater(t, len(lines), index)
	credential, ok := jsplugin.ParseCredential(lines[index])
	require.True(t, ok)
	return credential
}

// newRefreshToken stores a refresh token the fake server accepts.
func (s *fakeAuthServer) newRefreshToken(token string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.refreshToken[token] = true
}

func TestRefreshConcurrentRequestsMakeOnePluginCall(t *testing.T) {
	useProviderPluginDatabase(t)
	server := newFakeAuthServer(t)
	server.newRefreshToken("refresh-0")
	server.refreshDelay.Store(int64(100 * time.Millisecond))
	registerProviderPlugin(t, "refresh-flight", "redirect")
	line := expiringLine(t, "refresh-flight", "refresh-0", "acct-1", time.Now().Add(time.Second).Unix())
	channel := createProviderChannel(t, "refresh-flight", server.URL, line, false)

	results := make([]string, 16)
	var group sync.WaitGroup
	for index := range results {
		group.Go(func() {
			refreshed, err := RefreshPluginCredential(context.Background(), channel.Id, 0, line)
			assert.NoError(t, err)
			results[index] = refreshed
		})
	}
	group.Wait()

	assert.EqualValues(t, 1, server.refreshCalls.Load())
	assert.Zero(t, server.reuses.Load())
	for _, result := range results {
		assert.Equal(t, results[0], result)
	}
	assert.Equal(t, results[0], storedChannel(t, channel.Id).Key)
}

// Two refreshers stand for two nodes: their single-flight groups do not see
// each other, so only the channel row lock keeps the token from being sent
// twice.
func TestRefreshTwoNodesMakeOnePluginCall(t *testing.T) {
	useProviderPluginDatabase(t)
	server := newFakeAuthServer(t)
	server.newRefreshToken("refresh-0")
	server.refreshDelay.Store(int64(300 * time.Millisecond))
	registerProviderPlugin(t, "refresh-nodes", "redirect")
	line := expiringLine(t, "refresh-nodes", "refresh-0", "acct-1", time.Now().Add(time.Second).Unix())
	channel := createProviderChannel(t, "refresh-nodes", server.URL, line, false)

	nodes := []*PluginCredentialRefresher{{}, {}, {}}
	results := make([]string, len(nodes))
	var group sync.WaitGroup
	for index, node := range nodes {
		group.Go(func() {
			refreshed, err := node.Refresh(context.Background(), channel.Id, 0, line)
			assert.NoError(t, err)
			results[index] = refreshed
		})
	}
	group.Wait()

	assert.EqualValues(t, 1, server.refreshCalls.Load(), "a refresh token used twice can revoke the whole grant")
	assert.Zero(t, server.reuses.Load())
	stored := storedChannel(t, channel.Id).Key
	for _, result := range results {
		assert.Equal(t, stored, result)
	}
}

func TestRefreshRotatedTokenIsNeverSentAgain(t *testing.T) {
	useProviderPluginDatabase(t)
	server := newFakeAuthServer(t)
	server.newRefreshToken("refresh-0")
	registerProviderPlugin(t, "refresh-rotate", "redirect")
	line := expiringLine(t, "refresh-rotate", "refresh-0", "acct-1", time.Now().Add(time.Second).Unix())
	channel := createProviderChannel(t, "refresh-rotate", server.URL, line, false)

	first, err := RefreshPluginCredential(context.Background(), channel.Id, 0, line)
	require.NoError(t, err)
	assert.Contains(t, first, "refresh-1")

	// A request still holding the old line gets the stored one, with no call,
	// and a node whose cache still holds the old line learns the stored one.
	previousMemoryCache := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = true
	t.Cleanup(func() { common.MemoryCacheEnabled = previousMemoryCache; model.InitChannelCache() })
	model.InitChannelCache()
	model.CacheUpdateChannelKey(channel.Id, line)
	stale, err := RefreshPluginCredential(context.Background(), channel.Id, 0, line)
	require.NoError(t, err)
	assert.Equal(t, first, stale)
	assert.EqualValues(t, 1, server.refreshCalls.Load())
	cached, err := model.CacheGetChannel(channel.Id)
	require.NoError(t, err)
	assert.Equal(t, first, cached.Key)

	second, err := RefreshPluginCredential(context.Background(), channel.Id, 0, first)
	require.NoError(t, err)
	assert.Contains(t, second, "refresh-2")
	assert.EqualValues(t, 2, server.refreshCalls.Load())
	assert.Zero(t, server.reuses.Load())
}

func TestRefreshMergesItsResult(t *testing.T) {
	useProviderPluginDatabase(t)
	server := newFakeAuthServer(t)
	server.newRefreshToken("refresh-0")
	server.account.Store("keep")
	registerProviderPlugin(t, "refresh-merge", "redirect")
	line := credentialLine(t, jsplugin.Credential{
		Plugin: "refresh-merge", Data: json.RawMessage(`{"refresh":"refresh-0"}`), Query: map[string]string{"old": "1"},
		ExpiresAt: 1, AccountID: "acct-1", Label: "kept label",
	})
	channel := createProviderChannel(t, "refresh-merge", server.URL, line, false)

	_, err := RefreshPluginCredential(context.Background(), channel.Id, 0, line)

	require.NoError(t, err)
	stored := storedCredential(t, channel.Id, 0)
	assert.Equal(t, "acct-1", stored.AccountID)
	assert.Equal(t, "kept label", stored.Label)
	assert.Equal(t, "Bearer access-1", stored.Headers["Authorization"])
	assert.Empty(t, stored.Query, "the result replaces headers and query")
	assert.Greater(t, stored.ExpiresAt, time.Now().Unix())
}

func TestRefreshFailuresKeepTheCredential(t *testing.T) {
	useProviderPluginDatabase(t)
	server := newFakeAuthServer(t)
	server.newRefreshToken("refresh-0")
	registerProviderPlugin(t, "refresh-fail", "redirect")
	line := expiringLine(t, "refresh-fail", "refresh-0", "acct-1", time.Now().Add(time.Second).Unix())
	channel := createProviderChannel(t, "refresh-fail", server.URL, line, false)

	server.failNext.Store(true)
	_, err := RefreshPluginCredential(context.Background(), channel.Id, 0, line)
	require.Error(t, err)
	assert.ErrorContains(t, err, "token endpoint answered 502")
	assert.Equal(t, line, storedChannel(t, channel.Id).Key)
	assert.Equal(t, common.ChannelStatusEnabled, storedChannel(t, channel.Id).Status)

	// The vendor rotated to another account: nothing is stored, and the
	// refresh stays a transient failure.
	server.account.Store("acct-2")
	_, err = RefreshPluginCredential(context.Background(), channel.Id, 0, line)
	require.ErrorContains(t, err, "returned another account")
	assert.Equal(t, line, storedChannel(t, channel.Id).Key)
}

func TestRefreshRemovedCredential(t *testing.T) {
	useProviderPluginDatabase(t)
	server := newFakeAuthServer(t)
	registerProviderPlugin(t, "refresh-gone", "redirect")
	line := expiringLine(t, "refresh-gone", "refresh-0", "acct-1", 1)
	other := expiringLine(t, "refresh-gone", "refresh-9", "acct-9", 1)
	channel := createProviderChannel(t, "refresh-gone", server.URL, other, false)

	_, err := RefreshPluginCredential(context.Background(), channel.Id, 0, line)

	require.ErrorIs(t, err, ErrPluginCredentialRemoved)
	assert.Zero(t, server.refreshCalls.Load())
}

func relaxNoticeDelivery(t *testing.T, onNotice func(title string)) {
	t.Helper()
	previousLimit := constant.NotifyLimitCount
	previousClient, previousWorker := httpClient, system_setting.WorkerUrl
	fetch := system_setting.GetFetchSetting()
	previousFetch := *fetch
	receiver := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var payload WebhookPayload
		if err := common.DecodeJson(r.Body, &payload); err == nil {
			onNotice(payload.Content)
		}
		w.WriteHeader(http.StatusNoContent)
	}))
	t.Cleanup(func() {
		receiver.Close()
		constant.NotifyLimitCount = previousLimit
		httpClient, system_setting.WorkerUrl = previousClient, previousWorker
		*fetch = previousFetch
	})
	constant.NotifyLimitCount = 100
	httpClient, system_setting.WorkerUrl = receiver.Client(), ""
	fetch.EnableSSRFProtection = false
	admin := &model.User{Username: "root", Password: "password", Role: common.RoleRootUser, Status: common.UserStatusEnabled, Email: "root@example.com"}
	admin.SetSetting(dto.UserSetting{NotifyType: dto.NotifyTypeWebhook, WebhookUrl: receiver.URL})
	require.NoError(t, model.DB.Create(admin).Error)
}

func TestRefreshReloginDisablesAndNotifies(t *testing.T) {
	automaticDisable := common.AutomaticDisableChannelEnabled
	common.AutomaticDisableChannelEnabled = true
	t.Cleanup(func() { common.AutomaticDisableChannelEnabled = automaticDisable })
	for _, tc := range []struct {
		name     string
		multiKey bool
	}{{"single key", false}, {"multi key", true}} {
		t.Run(tc.name, func(t *testing.T) {
			useProviderPluginDatabase(t)
			server := newFakeAuthServer(t)
			server.refreshFail.Store("invalid_grant")
			key := "refresh-relogin-" + strings.ReplaceAll(tc.name, " ", "-")
			registerProviderPlugin(t, key, "redirect")
			var notices atomic.Int32
			relaxNoticeDelivery(t, func(string) { notices.Add(1) })

			line := expiringLine(t, key, "refresh-0", "acct-1", time.Now().Add(time.Second).Unix())
			stored := line
			index := 0
			if tc.multiKey {
				healthy := expiringLine(t, key, "refresh-5", "acct-5", time.Now().Add(time.Hour).Unix())
				stored, index = healthy+"\n"+line, 1
			}
			channel := createProviderChannel(t, key, server.URL, stored, tc.multiKey)

			_, err := RefreshPluginCredential(context.Background(), channel.Id, index, line)

			require.ErrorIs(t, err, ErrPluginCredentialNeedsLogin)

			assert.True(t, storedCredential(t, channel.Id, index).NeedsLogin)
			assert.EqualValues(t, 1, notices.Load())
			after := storedChannel(t, channel.Id)
			if tc.multiKey {
				assert.Equal(t, common.ChannelStatusEnabled, after.Status, "the other key keeps serving")
				assert.Equal(t, common.ChannelStatusAutoDisabled, after.ChannelInfo.MultiKeyStatusList[1])
				assert.Equal(t, model.ChannelStatusReasonPluginNeedsLogin, after.ChannelInfo.MultiKeyDisabledReason[1])
				assert.False(t, storedCredential(t, channel.Id, 0).NeedsLogin)
			} else {
				assert.Equal(t, common.ChannelStatusAutoDisabled, after.Status)
				assert.Equal(t, model.ChannelStatusReasonPluginNeedsLogin, after.GetOtherInfo()["status_reason"])
			}

			// A request holding the old line fails without another plugin call.
			calls := server.refreshCalls.Load()
			current := pluginCredentialKeyLines(after)[index]
			_, err = RefreshPluginCredential(context.Background(), channel.Id, index, line)
			require.ErrorIs(t, err, ErrPluginCredentialNeedsLogin)
			_, err = RefreshPluginCredential(context.Background(), channel.Id, index, current)
			require.Error(t, err)
			assert.LessOrEqual(t, server.refreshCalls.Load(), calls+1)

			// A login clears the flag and enables what was disabled.
			view, err := StorePluginLoginCredential(channel.Id, key, &index, false, jsplugin.CredentialResult{Credential: json.RawMessage(`{"refresh":"new"}`), AccountID: "acct-1"})
			require.NoError(t, err)
			assert.Equal(t, index, view.Index)
			after = storedChannel(t, channel.Id)
			assert.Equal(t, common.ChannelStatusEnabled, after.Status)
			assert.Empty(t, after.ChannelInfo.MultiKeyStatusList)
			assert.False(t, storedCredential(t, channel.Id, index).NeedsLogin)
		})
	}
}

func TestBackgroundScanRefreshesOnlyWhatExpiresSoon(t *testing.T) {
	useProviderPluginDatabase(t)
	server := newFakeAuthServer(t)
	for _, token := range []string{"due", "disabled", "later", "never", "login"} {
		server.newRefreshToken(token)
	}
	server.account.Store("keep")
	registerProviderPlugin(t, "refresh-scan", "redirect")
	now := time.Now()
	due := createProviderChannel(t, "refresh-scan", server.URL, expiringLine(t, "refresh-scan", "due", "a", now.Add(5*time.Minute).Unix()), false)
	disabled := createProviderChannel(t, "refresh-scan", server.URL, expiringLine(t, "refresh-scan", "disabled", "b", now.Add(5*time.Minute).Unix()), false)
	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", disabled.Id).Update("status", common.ChannelStatusManuallyDisabled).Error)
	later := createProviderChannel(t, "refresh-scan", server.URL, expiringLine(t, "refresh-scan", "later", "c", now.Add(2*time.Hour).Unix()), false)
	never := createProviderChannel(t, "refresh-scan", server.URL, expiringLine(t, "refresh-scan", "never", "d", 0), false)
	needsLogin := jsplugin.Credential{Plugin: "refresh-scan", Data: json.RawMessage(`{"refresh":"login"}`), ExpiresAt: 1, NeedsLogin: true}
	waiting := createProviderChannel(t, "refresh-scan", server.URL, credentialLine(t, needsLogin), false)
	static := createProviderChannel(t, "refresh-scan", server.URL, "sk-static", false)

	RefreshExpiringPluginCredentials(now)

	assert.EqualValues(t, 2, server.refreshCalls.Load())
	assert.Greater(t, storedCredential(t, due.Id, 0).ExpiresAt, now.Add(time.Hour-time.Minute).Unix())
	assert.Greater(t, storedCredential(t, disabled.Id, 0).ExpiresAt, now.Add(time.Hour-time.Minute).Unix(), "a stopped channel keeps its grant alive")
	assert.Contains(t, storedChannel(t, later.Id).Key, `"refresh":"later"`)
	assert.Contains(t, storedChannel(t, never.Id).Key, `"refresh":"never"`)
	assert.Contains(t, storedChannel(t, waiting.Id).Key, `"refresh":"login"`)
	assert.Equal(t, "sk-static", storedChannel(t, static.Id).Key)
}

func TestRevokeRunsInTheBackgroundForRemovedLines(t *testing.T) {
	useProviderPluginDatabase(t)
	server := newFakeAuthServer(t)
	registerProviderPlugin(t, "revoke-lines", "redirect")
	kept := expiringLine(t, "revoke-lines", "kept", "a", 0)
	removed := expiringLine(t, "revoke-lines", "removed", "b", 0)
	channel := createProviderChannel(t, "revoke-lines", server.URL, kept+"\n"+removed, true)

	RevokeRemovedChannelCredentials(channel, kept+"\n"+removed+"\nsk-static", kept)
	require.Eventually(t, func() bool { return server.revoked.Load() == 1 }, 5*time.Second, 5*time.Millisecond)
	assert.Equal(t, "removed", server.revokedToken.Load())

	RevokeDeletedChannelCredentials([]*model.Channel{channel})
	require.Eventually(t, func() bool { return server.revoked.Load() == 3 }, 5*time.Second, 5*time.Millisecond)
}

func TestRevokeFailureIsOnlyLogged(t *testing.T) {
	useProviderPluginDatabase(t)
	plugin, err := jsplugin.DefaultRegistry.Register(`
export const meta = {apiVersion: 1, key: "revoke-throw", name: "Revoke", version: "1.0.0", author: {name: "Test"}, relay: [{incoming_path: "/v1/chat/completions", upstream_path: "/c"}]};
export function revoke() { throw new Error("vendor said no"); }`, jsplugin.Options{})
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, jsplugin.DefaultRegistry.Unregister(plugin.Meta.Key)) })

	assert.NotPanics(t, func() {
		RevokePluginCredentials(plugin.Meta.Key, "https://api.example", "", 1, nil, []string{expiringLine(t, plugin.Meta.Key, "a", "a", 0)})
	})
}

// The credential hooks always verify TLS: a token sent to an unverified
// endpoint can be stolen, whatever the channel's API traffic accepts.
func TestCredentialHooksVerifyTLSEvenWhenTheChannelSkipsIt(t *testing.T) {
	useProviderPluginDatabase(t)
	var calls atomic.Int32
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		writeJSON(w, http.StatusOK, map[string]any{})
	}))
	defer server.Close()
	source := `
export const meta = {apiVersion: 1, key: "tls-verify", name: "TLS", version: "1.0.0", author: {name: "Test"}, relay: [{incoming_path: "/v1/chat/completions", upstream_path: "/c"}]};
export function login(ctx) { utils.fetch({url: ctx.baseUrl + "/token", method: "POST", body: "{}"}); return {type: "pending"}; }
export function refresh(ctx) { utils.fetch({url: ctx.baseUrl + "/token", method: "POST", body: "{}"}); return {relogin: true}; }`
	_, err := jsplugin.DefaultRegistry.Register(source, jsplugin.Options{})
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, jsplugin.DefaultRegistry.Unregister("tls-verify")) })
	line := expiringLine(t, "tls-verify", "r", "a", 1)
	channel := createProviderChannel(t, "tls-verify", server.URL, line, false)
	channel.SetSetting(dto.ChannelSettings{TaskPluginKey: "tls-verify", TLSInsecureSkipVerify: true})
	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", channel.Id).Update("setting", channel.Setting).Error)

	_, err = StartPluginLogin(context.Background(), PluginLoginIdentity{UserID: 1, SessionID: "session"}, channel.Id, nil, false)
	require.ErrorContains(t, err, "Plugin login failed")
	_, err = RefreshPluginCredential(context.Background(), channel.Id, 0, line)
	require.Error(t, err)
	assert.Zero(t, calls.Load(), "the handshake must fail before a token is sent")
}

func TestPluginModelListKey(t *testing.T) {
	useProviderPluginDatabase(t)
	source := `export const meta = {apiVersion: 1, key: "list-usable", name: "List", version: "1.0.0", author: {name: "Test"}, relay: [{incoming_path: "/v1/models", upstream_path: "/models"}]};`
	plugin, err := jsplugin.DefaultRegistry.Register(source, jsplugin.Options{})
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, jsplugin.DefaultRegistry.Unregister("list-usable")) })
	needsLogin := credentialLine(t, jsplugin.Credential{Plugin: "list-usable", Data: json.RawMessage(`{"name":"waiting"}`), NeedsLogin: true})
	usable := credentialLine(t, jsplugin.Credential{Plugin: "list-usable", Data: json.RawMessage(`{"name":"usable"}`)})
	foreign := credentialLine(t, jsplugin.Credential{Plugin: "another", Data: json.RawMessage(`{"name":"foreign"}`)})

	for name, tc := range map[string]struct {
		key      string
		multiKey bool
		disabled []int
		want     string
	}{
		"a credential waiting for a login is skipped": {key: needsLogin + "\n" + usable, multiKey: true, want: usable},
		"another plugin's credential is skipped":      {key: foreign + "\n" + usable, multiKey: true, want: usable},
		"a disabled key is skipped":                   {key: "sk-off\n" + usable, multiKey: true, disabled: []int{0}, want: usable},
		"a static key":                                {key: " sk-static ", want: "sk-static"},
		"a static key after a waiting credential":     {key: needsLogin + "\nsk-static", multiKey: true, want: "sk-static"},
		"a channel without keys":                      {key: "", want: ""},
	} {
		t.Run(name, func(t *testing.T) {
			channel := createProviderChannel(t, "list-usable", "https://api.example", tc.key, tc.multiKey)
			for _, index := range tc.disabled {
				channel.ChannelInfo.MultiKeyStatusList = map[int]int{index: common.ChannelStatusManuallyDisabled}
			}
			key, err := PluginModelListKey(context.Background(), channel, plugin)
			require.NoError(t, err)
			assert.Equal(t, tc.want, key)
		})
	}

	_, err = PluginModelListKey(context.Background(), createProviderChannel(t, "list-usable", "https://api.example", needsLogin, false), plugin)
	require.ErrorContains(t, err, "no usable key")
}

func TestCheckSubmittedPluginCredentials(t *testing.T) {
	line := expiringLine(t, "vendor", "r", "a", 0)
	assert.NoError(t, CheckSubmittedPluginCredentials(constant.ChannelTypeOpenAI, "", "sk-plain", ""))
	assert.NoError(t, CheckSubmittedPluginCredentials(constant.ChannelTypeTaskPlugin, "vendor", line, line), "a stored line stays")
	assert.NoError(t, CheckSubmittedPluginCredentials(constant.ChannelTypeTaskPlugin, "vendor", line+"\nsk-new", line))

	forged := expiringLine(t, "vendor", "forged", "a", 0)
	for name, key := range map[string]string{
		"new line":      forged,
		"among keys":    "sk-new\n" + forged,
		"in JSON array": `[` + forged + `]`,
	} {
		t.Run(name, func(t *testing.T) {
			require.ErrorContains(t, CheckSubmittedPluginCredentials(constant.ChannelTypeTaskPlugin, "vendor", key, line), "can only be added by logging in")
		})
	}
	const moved = "before changing the channel type or plugin"
	require.ErrorContains(t, CheckSubmittedPluginCredentials(constant.ChannelTypeOpenAI, "", line, line), moved)
	require.ErrorContains(t, CheckSubmittedPluginCredentials(constant.ChannelTypeTaskPlugin, "other", line, line), moved)
}

func TestDropPluginCredentials(t *testing.T) {
	line := expiringLine(t, "vendor", "r", "a", 0)

	single := &model.Channel{Type: constant.ChannelTypeTaskPlugin, Key: line, Status: common.ChannelStatusEnabled}
	DropPluginCredentials(single)
	assert.Empty(t, single.Key)
	assert.Equal(t, common.ChannelStatusAutoDisabled, single.Status)
	assert.Equal(t, model.ChannelStatusReasonPluginLoginRequired, single.GetOtherInfo()["status_reason"])

	multi := &model.Channel{Type: constant.ChannelTypeTaskPlugin, Key: "sk-1\n" + line + "\nsk-2", Status: common.ChannelStatusEnabled, ChannelInfo: model.ChannelInfo{
		IsMultiKey: true, MultiKeySize: 3, MultiKeyPollingIndex: 2, MultiKeyStatusList: map[int]int{2: common.ChannelStatusAutoDisabled},
		MultiKeyDisabledReason: map[int]string{2: "quota"}, MultiKeyDisabledTime: map[int]int64{2: 7},
	}}
	DropPluginCredentials(multi)
	assert.Equal(t, "sk-1\nsk-2", multi.Key)
	assert.Equal(t, common.ChannelStatusEnabled, multi.Status)
	assert.Equal(t, 2, multi.ChannelInfo.MultiKeySize)
	assert.Equal(t, map[int]int{1: common.ChannelStatusAutoDisabled}, multi.ChannelInfo.MultiKeyStatusList)
	assert.Equal(t, map[int]string{1: "quota"}, multi.ChannelInfo.MultiKeyDisabledReason)
	assert.Zero(t, multi.ChannelInfo.MultiKeyPollingIndex)

	static := &model.Channel{Type: constant.ChannelTypeTaskPlugin, Key: "sk-1", Status: common.ChannelStatusEnabled}
	DropPluginCredentials(static)
	assert.Equal(t, "sk-1", static.Key)
	assert.Equal(t, common.ChannelStatusEnabled, static.Status)
}

func registerScheduledPlugin(t *testing.T, hooks string) *jsplugin.LoadedPlugin {
	t.Helper()
	master := common.IsMasterNode
	common.IsMasterNode = true
	t.Cleanup(func() { common.IsMasterNode = master })
	plugin, err := jsplugin.DefaultRegistry.Register(`export const meta = {apiVersion: 1, key: "scheduled-test", name: "Scheduled test", version: "1.0.0", author: {name: "Test"}, relay: [{incoming_path: "/v1/chat/completions", upstream_path: "/chat"}]};`+hooks, jsplugin.Options{})
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, jsplugin.DefaultRegistry.Unregister(plugin.Meta.Key)) })
	return plugin
}

func TestScheduledCredentialBalanceAndNodeSync(t *testing.T) {
	useNodeSync(t)
	plugin := registerScheduledPlugin(t, `export function scheduled(ctx) {
 if (ctx.keyStatus !== "auto_disabled" || ctx.disabledReason !== "quota" || ctx.reason !== "disabled") throw new Error("wrong context");
 return {next: 120, credential: {remaining: 0}, keyStatus: "enabled", balance: {amount: 12, currency: "USD"}};
}`)
	line := credentialLine(t, jsplugin.Credential{Plugin: plugin.Meta.Key, Data: json.RawMessage(`{"remaining":1}`), AccountID: "own-account", Headers: map[string]string{"Authorization": "Bearer fixture"}})
	channel := createProviderChannel(t, plugin.Meta.Key, "https://vendor.example", line, false)
	require.True(t, model.UpdateChannelStatus(channel.Id, line, common.ChannelStatusAutoDisabled, "quota"))
	var replicated string
	RegisterSyncTopic(model.SyncTopicChannels, func(context.Context) error {
		replicated = storedChannel(t, channel.Id).Key
		return nil
	})
	syncNodeTopics(context.Background())
	assert.Equal(t, line, replicated)
	delay, _, _, err := runScheduledPlugin(context.Background(), channel, plugin, 0, line, "disabled")
	require.NoError(t, err)
	assert.Equal(t, 2*time.Minute, delay)
	stored := storedChannel(t, channel.Id)
	assert.Equal(t, common.ChannelStatusEnabled, stored.Status)
	credential := storedCredential(t, channel.Id, 0)
	assert.JSONEq(t, `{"remaining":0}`, string(credential.Data))
	assert.Equal(t, "own-account", credential.AccountID)
	assert.Equal(t, map[string]string{"Authorization": "Bearer fixture"}, credential.Headers)
	require.NotNil(t, stored.GetBalanceDetail())
	assert.Equal(t, 12.0, *stored.GetBalanceDetail().Amount)
	assert.Equal(t, 12.0, stored.Balance)
	assert.NotZero(t, stored.BalanceUpdatedTime)
	syncNodeTopics(context.Background())
	assert.Equal(t, stored.Key, replicated, "the other node reloads the changed channel topic")
}

func TestScheduledRunsOncePerKey(t *testing.T) {
	useNodeSync(t)
	var calls atomic.Int32
	entered, release := make(chan struct{}), make(chan struct{})
	releaseHook := sync.OnceFunc(func() { close(release) })
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if calls.Add(1) == 1 {
			close(entered)
			<-release
		}
		writeJSON(w, http.StatusOK, map[string]any{})
	}))
	defer server.Close()
	defer releaseHook()
	plugin := registerScheduledPlugin(t, `export function scheduled(ctx) {
 utils.fetch({url: ctx.baseUrl}); return {keyStatus: "enabled"};
}`)
	channel := createProviderChannel(t, plugin.Meta.Key, server.URL, "own-key", false)
	require.True(t, model.UpdateChannelStatus(channel.Id, channel.Key, common.ChannelStatusAutoDisabled, "quota"))
	channel = storedChannel(t, channel.Id)
	s := &pluginScheduler{}
	now := time.Now()
	s.scan([]*model.Channel{channel}, now)
	s.scan([]*model.Channel{channel}, now.Add(10*time.Minute))
	<-entered
	s.disabled(channel, channel.Key, now)
	s.scan([]*model.Channel{channel}, now.Add(time.Hour))
	releaseHook()
	s.workers.Wait()
	assert.EqualValues(t, 1, calls.Load())
	assert.Equal(t, common.ChannelStatusEnabled, storedChannel(t, channel.Id).Status)
}

func TestScheduledStaleRemovedAndManualKeys(t *testing.T) {
	useNodeSync(t)
	plugin := registerScheduledPlugin(t, `export function scheduled(ctx) { throw new Error("must not run"); }`)
	line := expiringLine(t, plugin.Meta.Key, "before", "account", 0)
	for _, mode := range []string{"refreshed", "removed", "manual channel", "manual key", "needs login"} {
		t.Run(mode, func(t *testing.T) {
			channel := createProviderChannel(t, plugin.Meta.Key, "https://vendor.example", line, mode == "manual key")
			_, err := model.UpdateScheduledChannelLocked(context.Background(), channel.Id, func(current *model.Channel) error {
				switch mode {
				case "refreshed":
					current.Key = expiringLine(t, plugin.Meta.Key, "after", "account", 0)
				case "removed":
					current.Key = "replacement"
				case "manual channel":
					current.Status = common.ChannelStatusManuallyDisabled
				case "manual key":
					current.ChannelInfo.MultiKeyStatusList = map[int]int{0: common.ChannelStatusManuallyDisabled}
				case "needs login":
					credential, _ := jsplugin.ParseCredential(line)
					credential.NeedsLogin = true
					current.Key = credentialLine(t, *credential)
				}
				return nil
			})
			require.NoError(t, err)
			before := storedChannel(t, channel.Id)
			delay, _, _, err := runScheduledPlugin(context.Background(), channel, plugin, 0, line, "timer")
			require.NoError(t, err)
			if mode == "refreshed" || mode == "removed" || mode == "needs login" {
				assert.Equal(t, time.Minute, delay)
			} else {
				assert.Zero(t, delay)
			}
			after := storedChannel(t, channel.Id)
			assert.Equal(t, before.Key, after.Key)
			assert.Equal(t, before.Status, after.Status)
			assert.Equal(t, before.ChannelInfo, after.ChannelInfo)
		})
	}
}

func TestScheduledInvalidResultsWriteNothing(t *testing.T) {
	for _, result := range []string{
		`throw new Error("private vendor token")`,
		`return {credential: {changed: true}, keyStatus: "enabled", balance: {amount: 1}}`,
		`return {credential: "x".repeat(65500), keyStatus: "enabled"}`,
		`return {credential: {}, keyStatus: "manual_disabled"}`,
	} {
		t.Run(result[:min(len(result), 40)], func(t *testing.T) {
			useNodeSync(t)
			plugin := registerScheduledPlugin(t, `export function scheduled(ctx) {`+result+`}`)
			line := credentialLine(t, jsplugin.Credential{Plugin: plugin.Meta.Key, AccountID: "account", Data: json.RawMessage(`{"unchanged":true}`)})
			channel := createProviderChannel(t, plugin.Meta.Key, "https://vendor.example", line, false)
			require.True(t, model.UpdateChannelStatus(channel.Id, line, common.ChannelStatusAutoDisabled, "quota"))
			before := storedChannel(t, channel.Id)
			_, _, _, err := runScheduledPlugin(context.Background(), channel, plugin, 0, line, "timer")
			require.Error(t, err)
			after := storedChannel(t, channel.Id)
			assert.Equal(t, before.Key, after.Key)
			assert.Equal(t, before.Status, after.Status)
			assert.Equal(t, before.OtherInfo, after.OtherInfo)
		})
	}
}

func TestScheduledDisabledTriggerAndThrottle(t *testing.T) {
	useNodeSync(t)
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		writeJSON(w, http.StatusOK, map[string]any{})
	}))
	defer server.Close()
	plugin := registerScheduledPlugin(t, `export function scheduled(ctx) {
 if (ctx.reason !== "disabled" || ctx.credential !== null || ctx.apiKey !== "own-key") throw new Error("wrong context");
 utils.fetch({url: ctx.baseUrl, method: "POST", body: "{}"}); return {keyStatus: "enabled"};
}`)
	channel := createProviderChannel(t, plugin.Meta.Key, server.URL, "own-key", false)
	previous := scheduledPlugins
	scheduledPlugins = &pluginScheduler{}
	t.Cleanup(func() { scheduledPlugins.workers.Wait(); scheduledPlugins = previous })
	channelError := types.NewChannelError(channel.Id, channel.Type, channel.Name, false, "own-key", true)
	DisableChannel(*channelError, "quota")
	scheduledPlugins.workers.Wait()
	assert.Equal(t, common.ChannelStatusEnabled, storedChannel(t, channel.Id).Status)
	assert.EqualValues(t, 1, calls.Load())
	DisableChannel(*channelError, "quota again")
	scheduledPlugins.workers.Wait()
	assert.EqualValues(t, 1, calls.Load(), "one disabled trigger per key per minute")
	assert.Equal(t, common.ChannelStatusAutoDisabled, storedChannel(t, channel.Id).Status)
	scheduledPlugins.disabled(storedChannel(t, channel.Id), "own-key", time.Now().Add(time.Minute))
	scheduledPlugins.workers.Wait()
	assert.EqualValues(t, 2, calls.Load())
}

func TestScheduledNextFailureAndIdleCost(t *testing.T) {
	useNodeSync(t)
	var calls atomic.Int32
	var fail atomic.Bool
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		writeJSON(w, http.StatusOK, map[string]any{"fail": fail.Load()})
	}))
	defer server.Close()
	plugin := registerScheduledPlugin(t, `export function scheduled(ctx) {
 const r = utils.fetch({url: ctx.baseUrl}); if (r.body.fail) throw new Error("private vendor token"); return {next: 120};
}`)
	channel := createProviderChannel(t, plugin.Meta.Key, server.URL, "own-key", false)
	s := &pluginScheduler{}
	now := time.Now()
	s.scan([]*model.Channel{channel}, now)
	require.Len(t, s.entries, 1)
	key := pluginScheduledKey{channel.Id, 0}
	first := s.entries[key].next
	assert.False(t, first.Before(now))
	assert.True(t, first.Before(now.Add(10*time.Minute)))
	s.scan([]*model.Channel{channel}, first.Add(-time.Nanosecond))
	s.workers.Wait()
	assert.Zero(t, calls.Load())
	s.scan([]*model.Channel{channel}, first)
	s.workers.Wait()
	assert.EqualValues(t, 1, calls.Load())
	next := s.entries[key].next
	s.scan([]*model.Channel{channel}, next.Add(-time.Nanosecond))
	s.workers.Wait()
	assert.EqualValues(t, 1, calls.Load())
	fail.Store(true)
	var logs bytes.Buffer
	common.LogWriterMu.Lock()
	oldWriter := gin.DefaultWriter
	gin.DefaultWriter = &logs
	common.LogWriterMu.Unlock()
	t.Cleanup(func() { common.LogWriterMu.Lock(); gin.DefaultWriter = oldWriter; common.LogWriterMu.Unlock() })
	before := time.Now()
	s.scan([]*model.Channel{channel}, next)
	s.workers.Wait()
	assert.EqualValues(t, 2, calls.Load())
	assert.NotContains(t, logs.String(), "private vendor token")
	assert.Contains(t, logs.String(), "plugin=scheduled-test channel_id=1 key_index=0 category=plugin_error")
	assert.False(t, s.entries[key].next.Before(before.Add(15*time.Minute)))
	assert.False(t, s.entries[key].next.After(time.Now().Add(15*time.Minute)))
	s.scan(nil, now)
	assert.Empty(t, s.entries)

	require.NoError(t, jsplugin.DefaultRegistry.Unregister(plugin.Meta.Key))
	idle, err := jsplugin.DefaultRegistry.Register(`export const meta = {apiVersion:1,key:"scheduled-idle",name:"Idle",version:"1.0.0",author:{name:"Test"},relay:[{incoming_path:"/v1/models",upstream_path:"/models"}]}; export function prepareRequest() { throw new Error("JS must not run"); }`, jsplugin.Options{})
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, jsplugin.DefaultRegistry.Unregister(idle.Meta.Key)) })
	channel.SetSetting(dto.ChannelSettings{TaskPluginKey: idle.Meta.Key})
	inactive := &pluginScheduler{}
	inactive.scan([]*model.Channel{channel}, now)
	inactive.disabled(channel, "own-key", now)
	assert.Nil(t, inactive.entries)
	assert.Nil(t, inactive.slots)
	inactive.workers.Wait()
}

func TestScheduledPoolBoundsAndRunningKey(t *testing.T) {
	useNodeSync(t)
	entered, release := make(chan struct{}, 4), make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		entered <- struct{}{}
		<-release
		writeJSON(w, http.StatusOK, map[string]any{})
	}))
	defer server.Close()
	plugin := registerScheduledPlugin(t, `export function scheduled(ctx) { utils.fetch({url: ctx.baseUrl}); return {next: 600}; }`)
	channels := make([]*model.Channel, 5)
	for index := range channels {
		channels[index] = createProviderChannel(t, plugin.Meta.Key, server.URL, fmt.Sprintf("key-%d", index), false)
	}
	s := &pluginScheduler{}
	now := time.Now()
	s.scan(channels, now)
	s.scan(channels, now.Add(10*time.Minute))
	for range 4 {
		<-entered
	}
	assert.Len(t, s.slots, 4)
	s.scan(channels, now.Add(10*time.Minute))
	s.disabled(channels[0], channels[0].Key, now)
	assert.Len(t, s.slots, 4, "scans and disabled events skip an already running key")
	s.scan(nil, now)
	assert.Len(t, s.entries, 4, "an old snapshot must keep the running keys and their eventual next times")
	close(release)
	s.workers.Wait()
	assert.Empty(t, s.slots)
	s.scan(nil, now)
	assert.Empty(t, s.entries)
}

func TestScheduledDisableHonorsChannelSwitchAndDoesNotRecurse(t *testing.T) {
	useNodeSync(t)
	plugin := registerScheduledPlugin(t, `export function scheduled(ctx) { return {keyStatus: "auto_disabled", notify: "Check subscription"}; }`)
	previous := scheduledPlugins
	scheduledPlugins = &pluginScheduler{}
	t.Cleanup(func() { scheduledPlugins.workers.Wait(); scheduledPlugins = previous })
	for _, autoBan := range []bool{false, true} {
		channel := createProviderChannel(t, plugin.Meta.Key, "https://vendor.example", "own-key", false)
		flag := 0
		if autoBan {
			flag = 1
		}
		channel.AutoBan = &flag
		require.NoError(t, model.DB.Model(channel).Update("auto_ban", flag).Error)
		_, _, _, err := runScheduledPlugin(context.Background(), channel, plugin, 0, channel.Key, "timer")
		require.NoError(t, err)
		stored := storedChannel(t, channel.Id)
		if autoBan {
			assert.Equal(t, common.ChannelStatusAutoDisabled, stored.Status)
			assert.Equal(t, "Check subscription", stored.GetOtherInfo()["status_reason"])
		} else {
			assert.Equal(t, common.ChannelStatusEnabled, stored.Status)
		}
	}
	assert.Nil(t, scheduledPlugins.entries, "a scheduled disable never triggers another scheduled run")
}

func TestScheduledCancellationAndTLSKeepStoredState(t *testing.T) {
	useNodeSync(t)
	entered, release := make(chan struct{}), make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		close(entered)
		<-release
	}))
	defer server.Close()
	plugin := registerScheduledPlugin(t, `export function scheduled(ctx) {
 utils.fetch({url: ctx.baseUrl, method: "POST", body: "{}"}); return {keyStatus: "auto_disabled"};
}`)
	channel := createProviderChannel(t, plugin.Meta.Key, server.URL, "own-key", false)
	ctx, cancel := context.WithCancel(context.Background())
	finished := make(chan error, 1)
	go func() {
		_, _, _, err := runScheduledPlugin(ctx, channel, plugin, 0, channel.Key, "timer")
		finished <- err
	}()
	<-entered
	cancel()
	err := <-finished
	close(release)
	require.Error(t, err)
	assert.Equal(t, common.ChannelStatusEnabled, storedChannel(t, channel.Id).Status)

	var requests atomic.Int32
	tlsServer := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { requests.Add(1) }))
	defer tlsServer.Close()
	tlsChannel := createProviderChannel(t, plugin.Meta.Key, tlsServer.URL, "own-key", false)
	tlsChannel.SetSetting(dto.ChannelSettings{TaskPluginKey: plugin.Meta.Key, TLSInsecureSkipVerify: true})
	require.NoError(t, model.DB.Model(tlsChannel).Update("setting", tlsChannel.Setting).Error)
	_, _, _, err = runScheduledPlugin(context.Background(), tlsChannel, plugin, 0, tlsChannel.Key, "timer")
	require.Error(t, err)
	assert.Zero(t, requests.Load(), "the certificate check must reject the request before sending the key")
	assert.Equal(t, common.ChannelStatusEnabled, storedChannel(t, tlsChannel.Id).Status)
}

func TestScheduledReplacementKeysGetAnInitialRun(t *testing.T) {
	useNodeSync(t)
	plugin := registerScheduledPlugin(t, `export function scheduled() { return {next: 86400}; }`)
	channel := createProviderChannel(t, plugin.Meta.Key, "https://vendor.example", "old-key", false)
	s := &pluginScheduler{}
	now := time.Now()
	s.scan([]*model.Channel{channel}, now)
	key := pluginScheduledKey{channel.Id, 0}
	s.entries[key].next = now.Add(24 * time.Hour)
	channel.Key = "replacement-key"
	s.scan([]*model.Channel{channel}, now)
	assert.False(t, s.entries[key].next.Before(now))
	assert.True(t, s.entries[key].next.Before(now.Add(10*time.Minute)))

	channel.Key = expiringLine(t, plugin.Meta.Key, "before", "account", 0)
	s.scan([]*model.Channel{channel}, now)
	s.entries[key].next = now.Add(24 * time.Hour)
	channel.Key = expiringLine(t, plugin.Meta.Key, "refreshed", "account", 0)
	s.scan([]*model.Channel{channel}, now)
	assert.Equal(t, now.Add(24*time.Hour), s.entries[key].next, "a refresh preserves the account's schedule")
}

func TestScheduledScanRunsOnlyOnMaster(t *testing.T) {
	useNodeSync(t)
	plugin := registerScheduledPlugin(t, `export function scheduled() { throw new Error("initial jitter must defer JS"); }`)
	channel := createProviderChannel(t, plugin.Meta.Key, "https://vendor.example", "own-key", false)
	previous, master := scheduledPlugins, common.IsMasterNode
	scheduledPlugins = &pluginScheduler{}
	t.Cleanup(func() { scheduledPlugins.workers.Wait(); scheduledPlugins, common.IsMasterNode = previous, master })
	common.IsMasterNode = false
	RefreshExpiringPluginCredentials(time.Now())
	assert.Nil(t, scheduledPlugins.entries)
	common.IsMasterNode = true
	RefreshExpiringPluginCredentials(time.Now())
	assert.Contains(t, scheduledPlugins.entries, pluginScheduledKey{channel.Id, 0})
}

func TestScheduledHookDoesNotBlockKeySelection(t *testing.T) {
	for _, cacheEnabled := range []bool{false, true} {
		t.Run(fmt.Sprintf("cache=%t", cacheEnabled), func(t *testing.T) {
			useNodeSync(t)
			entered, release := make(chan struct{}), make(chan struct{})
			releaseHook := sync.OnceFunc(func() { close(release) })
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				close(entered)
				<-release
				writeJSON(w, http.StatusOK, map[string]any{})
			}))
			defer server.Close()
			defer releaseHook()
			plugin := registerScheduledPlugin(t, `export function scheduled(ctx) {
 utils.fetch({url: ctx.baseUrl}); return {keyStatus: "enabled"};
}`)
			channel := createProviderChannel(t, plugin.Meta.Key, server.URL, "recovering\nother\nhealthy", true)
			require.True(t, model.UpdateChannelStatus(channel.Id, "recovering", common.ChannelStatusAutoDisabled, "quota"))
			common.MemoryCacheEnabled = cacheEnabled
			model.InitChannelCache()
			channel, err := model.CacheGetChannel(channel.Id)
			require.NoError(t, err)
			hookDone := make(chan error, 1)
			go func() {
				_, _, _, err := runScheduledPlugin(context.Background(), channel, plugin, 0, "recovering", "timer")
				hookDone <- err
			}()
			<-entered
			type selection struct {
				key string
				err error
			}
			selected := make(chan selection, 1)
			go func() {
				key, _, apiErr := channel.GetNextEnabledKey()
				var err error
				if apiErr != nil {
					err = apiErr
				}
				selected <- selection{key, err}
			}()
			select {
			case result := <-selected:
				require.NoError(t, result.err)
				assert.Contains(t, []string{"other", "healthy"}, result.key)
			case <-time.After(500 * time.Millisecond):
				t.Error("request key selection waited for the scheduled hook")
				releaseHook()
				<-selected
			}
			// Exercise both operations while the hook waits without racing a
			// stale selection snapshot against an unrelated status write.
			statusDone := make(chan bool, 1)
			go func() {
				statusDone <- model.UpdateChannelStatus(channel.Id, "other", common.ChannelStatusAutoDisabled, "other quota")
			}()
			select {
			case changed := <-statusDone:
				assert.True(t, changed)
			case <-time.After(time.Second):
				t.Error("status update waited for the scheduled hook")
				releaseHook()
				<-statusDone
			}
			releaseHook()
			require.NoError(t, <-hookDone)
			after := storedChannel(t, channel.Id)
			assert.NotContains(t, after.ChannelInfo.MultiKeyStatusList, 0)
			assert.Equal(t, common.ChannelStatusAutoDisabled, after.ChannelInfo.MultiKeyStatusList[1])
			assert.NotContains(t, after.ChannelInfo.MultiKeyStatusList, 2)
			assert.Equal(t, common.ChannelStatusEnabled, after.Status)
		})
	}
}

func TestScheduledScanDetectsDisabledTransitionOnce(t *testing.T) {
	for _, source := range []string{"follower", "master"} {
		t.Run(source, func(t *testing.T) {
			useNodeSync(t)
			var disabled, timer atomic.Int32
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Query().Get("reason") == "disabled" {
					disabled.Add(1)
				} else {
					timer.Add(1)
				}
				writeJSON(w, http.StatusOK, map[string]any{})
			}))
			defer server.Close()
			plugin := registerScheduledPlugin(t, `export function scheduled(ctx) {
 utils.fetch({url: ctx.baseUrl + "?reason=" + ctx.reason}); return {next: 3600};
}`)
			channel := createProviderChannel(t, plugin.Meta.Key, server.URL, "own-key", false)
			previous := scheduledPlugins
			scheduledPlugins = &pluginScheduler{}
			t.Cleanup(func() { scheduledPlugins.workers.Wait(); scheduledPlugins = previous })
			s := scheduledPlugins
			RegisterSyncTopic(model.SyncTopicChannels, ScanScheduledPlugins)
			now := time.Now()
			require.True(t, syncNodeTopics(context.Background()))
			if source == "follower" {
				require.True(t, model.UpdateChannelStatus(channel.Id, channel.Key, common.ChannelStatusAutoDisabled, "other node"))
			} else {
				DisableChannel(*types.NewChannelError(channel.Id, channel.Type, channel.Name, false, channel.Key, true), "quota")
			}
			require.True(t, syncNodeTopics(context.Background()))
			channel = storedChannel(t, channel.Id)
			s.workers.Wait()
			assert.EqualValues(t, 1, disabled.Load())
			model.BumpSyncTopic(model.SyncTopicChannels)
			var scans sync.WaitGroup
			scans.Go(func() { syncNodeTopics(context.Background()) })
			scans.Go(func() { RefreshExpiringPluginCredentials(now.Add(time.Minute)) })
			scans.Wait()
			s.workers.Wait()
			assert.EqualValues(t, 1, disabled.Load())
			assert.Zero(t, timer.Load())

			freshMaster := &pluginScheduler{}
			freshMaster.scan([]*model.Channel{channel}, now)
			first := freshMaster.entries[pluginScheduledKey{channel.Id, 0}].next
			assert.False(t, first.Before(now))
			assert.True(t, first.Before(now.Add(10*time.Minute)))
			freshMaster.scan([]*model.Channel{channel}, first)
			freshMaster.workers.Wait()
			assert.EqualValues(t, 1, timer.Load(), "an already-disabled key first runs with timer reason")
			assert.EqualValues(t, 1, disabled.Load())
		})
	}
}

func TestScheduledSyncSkipsIdleAndFollowerNodes(t *testing.T) {
	for _, master := range []bool{false, true} {
		t.Run(fmt.Sprintf("master=%t", master), func(t *testing.T) {
			database := useNodeSync(t)
			registry := jsplugin.DefaultRegistry
			jsplugin.DefaultRegistry = jsplugin.NewRegistry()
			t.Cleanup(func() { jsplugin.DefaultRegistry = registry })
			hooks := `export function prepareRequest() { throw new Error("idle check ran JS"); }`
			if !master {
				hooks = `export function scheduled() { throw new Error("follower ran JS"); }`
			}
			plugin := registerScheduledPlugin(t, hooks)
			createProviderChannel(t, plugin.Meta.Key, "https://vendor.example", "own-key", false)
			previous := scheduledPlugins
			scheduledPlugins = &pluginScheduler{}
			t.Cleanup(func() { scheduledPlugins.workers.Wait(); scheduledPlugins = previous })
			common.IsMasterNode = master
			var channelQueries atomic.Int32
			require.NoError(t, database.Callback().Query().Before("gorm:query").Register("scheduled_count_queries", func(tx *gorm.DB) {
				if tx.Statement.Schema != nil && tx.Statement.Schema.Name == "Channel" {
					channelQueries.Add(1)
				}
			}))
			t.Cleanup(func() { require.NoError(t, database.Callback().Query().Remove("scheduled_count_queries")) })
			RegisterSyncTopic(model.SyncTopicChannels, ScanScheduledPlugins)
			require.True(t, syncNodeTopics(context.Background()))
			assert.Zero(t, channelQueries.Load())
			assert.Nil(t, scheduledPlugins.entries)
			assert.Nil(t, scheduledPlugins.slots)
		})
	}
}

func TestScheduledSyncRetriesFailedQuery(t *testing.T) {
	database := useNodeSync(t)
	plugin := registerScheduledPlugin(t, `export function scheduled() { throw new Error("initial jitter must defer JS"); }`)
	createProviderChannel(t, plugin.Meta.Key, "https://vendor.example", "own-key", false)
	previous := scheduledPlugins
	scheduledPlugins = &pluginScheduler{}
	t.Cleanup(func() { scheduledPlugins.workers.Wait(); scheduledPlugins = previous })
	fail := true
	require.NoError(t, database.Callback().Query().Before("gorm:query").Register("scheduled_query_error", func(tx *gorm.DB) {
		if fail && tx.Statement.Schema != nil && tx.Statement.Schema.Name == "Channel" {
			tx.AddError(errors.New("scheduled channel query failed"))
		}
	}))
	t.Cleanup(func() { require.NoError(t, database.Callback().Query().Remove("scheduled_query_error")) })
	RegisterSyncTopic(model.SyncTopicChannels, ScanScheduledPlugins)
	require.True(t, syncNodeTopics(context.Background()))
	assert.Contains(t, NodeSyncStates()[model.SyncTopicChannels].Error, "scheduled channel query failed")
	assert.Zero(t, NodeSyncStates()[model.SyncTopicChannels].AppliedAt)
	assert.Nil(t, scheduledPlugins.entries)
	fail = false
	require.True(t, syncNodeTopics(context.Background()), "the same topic revision is retried on the next tick")
	assert.Empty(t, NodeSyncStates()[model.SyncTopicChannels].Error)
	assert.Len(t, scheduledPlugins.entries, 1)
	assert.False(t, syncNodeTopics(context.Background()))
}

func TestScheduledOwnDisableSyncDuringCommitDoesNotRecurse(t *testing.T) {
	database := useNodeSync(t)
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		writeJSON(w, http.StatusOK, map[string]any{})
	}))
	defer server.Close()
	plugin := registerScheduledPlugin(t, `export function scheduled(ctx) {
 utils.fetch({url: ctx.baseUrl}); return {keyStatus: "auto_disabled", next: 3600};
}`)
	channel := createProviderChannel(t, plugin.Meta.Key, server.URL, "own-key", false)
	flag := 1
	require.NoError(t, database.Model(channel).Update("auto_ban", flag).Error)
	previous := scheduledPlugins
	scheduledPlugins = &pluginScheduler{}
	t.Cleanup(func() { scheduledPlugins.workers.Wait(); scheduledPlugins = previous })
	RegisterSyncTopic(model.SyncTopicChannels, ScanScheduledPlugins)
	require.True(t, syncNodeTopics(context.Background()))
	committed, release := make(chan struct{}), make(chan struct{})
	releaseCommit := sync.OnceFunc(func() { close(release) })
	defer releaseCommit()
	var held atomic.Bool
	// Hold the hook after its topic bump commits, before run's bookkeeping.
	require.NoError(t, database.Callback().Create().After("gorm:commit_or_rollback_transaction").Register("scheduled_hold_commit", func(tx *gorm.DB) {
		row, ok := tx.Statement.Dest.(*model.SystemSyncTopic)
		if ok && row.Topic == model.SyncTopicChannels && tx.Error == nil && held.CompareAndSwap(false, true) {
			close(committed)
			<-release
		}
	}))
	t.Cleanup(func() { require.NoError(t, database.Callback().Create().Remove("scheduled_hold_commit")) })
	key := pluginScheduledKey{channel.Id, 0}
	scheduledPlugins.scan([]*model.Channel{channel}, scheduledPlugins.entries[key].next)
	select {
	case <-committed:
	case <-time.After(5 * time.Second):
		t.Fatal("scheduled hook did not commit its disable")
	}
	assert.Equal(t, common.ChannelStatusAutoDisabled, storedChannel(t, channel.Id).Status)
	require.True(t, syncNodeTopics(context.Background()))
	scheduledPlugins.mu.Lock()
	pending := scheduledPlugins.entries[key].disabledPending
	scheduledPlugins.mu.Unlock()
	assert.True(t, pending, "the sync scan observes the committed transition while the hook is still running")
	releaseCommit()
	scheduledPlugins.workers.Wait()
	RefreshExpiringPluginCredentials(time.Now().Add(2 * time.Minute))
	scheduledPlugins.workers.Wait()
	assert.EqualValues(t, 1, calls.Load(), "the hook's own disable must not become another disabled run")
	assert.False(t, scheduledPlugins.entries[key].disabledPending)
}

func TestScheduledSyncBeforeMasterDisableDoesNotDuplicate(t *testing.T) {
	useNodeSync(t)
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		writeJSON(w, http.StatusOK, map[string]any{})
	}))
	defer server.Close()
	plugin := registerScheduledPlugin(t, `export function scheduled(ctx) {
 if (ctx.reason !== "disabled") throw new Error("unexpected timer run");
 utils.fetch({url: ctx.baseUrl}); return {next: 3600};
}`)
	channel := createProviderChannel(t, plugin.Meta.Key, server.URL, "own-key", false)
	previous := scheduledPlugins
	scheduledPlugins = &pluginScheduler{}
	t.Cleanup(func() { scheduledPlugins.workers.Wait(); scheduledPlugins = previous })
	RegisterSyncTopic(model.SyncTopicChannels, ScanScheduledPlugins)
	require.True(t, syncNodeTopics(context.Background()))
	// DisableChannel has committed its write but has not called disabled yet.
	require.True(t, model.UpdateChannelStatus(channel.Id, channel.Key, common.ChannelStatusAutoDisabled, "quota"))
	require.True(t, syncNodeTopics(context.Background()))
	scheduledPlugins.workers.Wait()
	require.EqualValues(t, 1, calls.Load())
	// Resume the same DisableChannel call after the node-sync run completed.
	scheduledPlugins.disabled(storedChannel(t, channel.Id), channel.Key, time.Now())
	scheduledPlugins.workers.Wait()
	require.EqualValues(t, 1, calls.Load())
	RefreshExpiringPluginCredentials(time.Now().Add(2 * time.Minute))
	scheduledPlugins.workers.Wait()
	assert.EqualValues(t, 1, calls.Load(), "the master direct trigger and its own node-sync bump describe one disable")
}

func TestScheduledFollowerSkipsEveryTrigger(t *testing.T) {
	useNodeSync(t)
	plugin := registerScheduledPlugin(t, `export function scheduled() { throw new Error("follower executed JS"); }`)
	channel := createProviderChannel(t, plugin.Meta.Key, "https://vendor.example", "own-key", false)
	previous := scheduledPlugins
	scheduledPlugins = &pluginScheduler{}
	t.Cleanup(func() { scheduledPlugins.workers.Wait(); scheduledPlugins = previous })
	common.IsMasterNode = false
	DisableChannel(*types.NewChannelError(channel.Id, channel.Type, channel.Name, false, channel.Key, true), "quota")
	channel = storedChannel(t, channel.Id)
	assert.Equal(t, common.ChannelStatusAutoDisabled, channel.Status)
	scheduledPlugins.scan([]*model.Channel{channel}, time.Now().Add(time.Hour))
	scheduledPlugins.disabled(channel, channel.Key, time.Now())
	delay, status, _, err := runScheduledPlugin(context.Background(), channel, plugin, 0, channel.Key, "disabled")
	require.NoError(t, err)
	assert.Zero(t, delay)
	assert.Zero(t, status)
	assert.Nil(t, scheduledPlugins.entries)
	assert.Nil(t, scheduledPlugins.slots)
	scheduledPlugins.workers.Wait()
}

func TestScheduledChangedKeyDiscardsAllResults(t *testing.T) {
	useNodeSync(t)
	entered, release := make(chan struct{}), make(chan struct{})
	releaseHook := sync.OnceFunc(func() { close(release) })
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		close(entered)
		<-release
		writeJSON(w, http.StatusOK, map[string]any{})
	}))
	defer server.Close()
	defer releaseHook()
	plugin := registerScheduledPlugin(t, `export function scheduled(ctx) {
 utils.fetch({url: ctx.baseUrl});
 return {credential: {token: "stale"}, keyStatus: "enabled", balance: {amount: 99, currency: "USD"}, notify: "stale notification"};
}`)
	old := expiringLine(t, plugin.Meta.Key, "before", "account", 0)
	replacement := expiringLine(t, plugin.Meta.Key, "after", "account", 0)
	channel := createProviderChannel(t, plugin.Meta.Key, server.URL, old, false)
	require.True(t, model.UpdateChannelStatus(channel.Id, old, common.ChannelStatusAutoDisabled, "quota"))
	var notices atomic.Int32
	relaxNoticeDelivery(t, func(string) { notices.Add(1) })
	type outcome struct {
		delay time.Duration
		err   error
	}
	done := make(chan outcome, 1)
	go func() {
		delay, _, _, err := runScheduledPlugin(context.Background(), channel, plugin, 0, old, "timer")
		done <- outcome{delay, err}
	}()
	<-entered
	_, err := model.UpdateChannelLocked(channel.Id, func(current *model.Channel) error {
		current.Key = replacement
		return nil
	})
	require.NoError(t, err)
	before := storedChannel(t, channel.Id)
	releaseHook()
	result := <-done
	require.NoError(t, result.err)
	assert.Equal(t, time.Minute, result.delay)
	after := storedChannel(t, channel.Id)
	assert.Equal(t, before.Key, after.Key)
	assert.Equal(t, before.Status, after.Status)
	assert.Equal(t, before.ChannelInfo, after.ChannelInfo)
	assert.Equal(t, before.OtherInfo, after.OtherInfo)
	assert.Equal(t, before.Balance, after.Balance)
	assert.Zero(t, notices.Load())
}

func TestScheduledDisableDuringTimerRunsOnNextScan(t *testing.T) {
	useNodeSync(t)
	entered, release := make(chan struct{}), make(chan struct{})
	releaseHook := sync.OnceFunc(func() { close(release) })
	var timer, disabled atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("reason") == "disabled" {
			disabled.Add(1)
		} else if timer.Add(1) == 1 {
			close(entered)
			<-release
		}
		writeJSON(w, http.StatusOK, map[string]any{})
	}))
	defer server.Close()
	defer releaseHook()
	plugin := registerScheduledPlugin(t, `export function scheduled(ctx) {
 utils.fetch({url: ctx.baseUrl + "?reason=" + ctx.reason}); return {next: 3600};
}`)
	channel := createProviderChannel(t, plugin.Meta.Key, server.URL, "own-key", false)
	previous := scheduledPlugins
	s := &pluginScheduler{}
	scheduledPlugins = s
	t.Cleanup(func() { s.workers.Wait(); scheduledPlugins = previous })
	now := time.Now()
	s.scan([]*model.Channel{channel}, now)
	s.scan([]*model.Channel{channel}, now.Add(10*time.Minute))
	<-entered
	DisableChannel(*types.NewChannelError(channel.Id, channel.Type, channel.Name, false, channel.Key, true), "quota")
	releaseHook()
	s.workers.Wait()
	s.scan([]*model.Channel{storedChannel(t, channel.Id)}, now)
	s.workers.Wait()
	assert.EqualValues(t, 1, timer.Load())
	assert.EqualValues(t, 1, disabled.Load())
	s.scan([]*model.Channel{storedChannel(t, channel.Id)}, now.Add(time.Minute))
	s.workers.Wait()
	assert.EqualValues(t, 1, disabled.Load())
}

func TestScheduledOwnDisableDoesNotBecomeScanTrigger(t *testing.T) {
	useNodeSync(t)
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		writeJSON(w, http.StatusOK, map[string]any{})
	}))
	defer server.Close()
	plugin := registerScheduledPlugin(t, `export function scheduled(ctx) {
 utils.fetch({url: ctx.baseUrl}); return {next: 3600, keyStatus: "auto_disabled"};
}`)
	channel := createProviderChannel(t, plugin.Meta.Key, server.URL, "own-key", false)
	entered, release := make(chan struct{}), make(chan struct{})
	releaseNotice := sync.OnceFunc(func() { close(release) })
	defer releaseNotice()
	var once sync.Once
	relaxNoticeDelivery(t, func(string) { once.Do(func() { close(entered); <-release }) })
	s := &pluginScheduler{}
	now := time.Now()
	s.scan([]*model.Channel{channel}, now)
	s.scan([]*model.Channel{channel}, now.Add(10*time.Minute))
	<-entered
	channel = storedChannel(t, channel.Id)
	require.Equal(t, common.ChannelStatusAutoDisabled, channel.Status)
	s.scan([]*model.Channel{channel}, now)
	releaseNotice()
	s.workers.Wait()
	s.scan([]*model.Channel{channel}, now.Add(time.Minute))
	s.workers.Wait()
	assert.EqualValues(t, 1, calls.Load())
}
