package controller

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"strings"
	"testing"
	"time"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel/groksubscription"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// setupGrokAuthTestDB 建独立 sqlite 文件库并接管 model.DB。
// 必须用文件库而非 :memory:：UpdateChannelKeyForType/ClaimGrokAuthFlow 走事务，
// gorm 连接池下 :memory: 每个连接各一份库会互相看不见（照 cli_device_authorization_test 模式）。
func setupGrokAuthTestDB(t *testing.T) {
	t.Helper()
	originalDB := model.DB
	originalUsingSQLite := common.UsingSQLite
	common.UsingSQLite = true
	db, err := gorm.Open(sqlite.Open(t.TempDir()+"/grok-auth.db"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Channel{}, &model.Ability{}, &model.GrokAuthFlow{}, &model.GrokChannelState{}))
	model.DB = db
	t.Cleanup(func() {
		model.DB = originalDB
		common.UsingSQLite = originalUsingSQLite
		// Windows 下必须先关连接池，否则 t.TempDir 的 RemoveAll 会被占用中的 db 文件卡死。
		if sqlDB, err := db.DB(); err == nil {
			_ = sqlDB.Close()
		}
	})
}

// setGrokCipherKey 注入确定性的 32 字节 cipher key（照 service/grok_credential_cipher_test 模式；
// env 变量名与 service.grokCredentialCipherEnv 保持一致）。
func setGrokCipherKey(t *testing.T) {
	t.Helper()
	key := make([]byte, 32)
	for i := range key {
		key[i] = byte('a' + i%26)
	}
	t.Setenv("GROK_CREDENTIAL_CIPHER_KEY", base64.StdEncoding.EncodeToString(key))
}

func TestGrokAuthPKCEStartProducesSub2CompatibleAuthorizationURL(t *testing.T) {
	setupGrokAuthTestDB(t)
	setGrokCipherKey(t)

	start, err := GrokPKCEStart(42, groksubscription.OAuthRedirectURI)
	require.NoError(t, err)
	require.NotEmpty(t, start.AuthorizeURL)
	require.NotEmpty(t, start.FlowID)
	require.True(t, strings.Contains(start.AuthorizeURL, "code_challenge="), "authorize url must carry code_challenge")
	require.True(t, strings.Contains(start.AuthorizeURL, "code_challenge_method=S256"), "must use S256")

	u, err := url.Parse(start.AuthorizeURL)
	require.NoError(t, err)
	q := u.Query()
	require.Equal(t, "code", q.Get("response_type"))
	require.Equal(t, groksubscription.OAuthClientID, q.Get("client_id"))
	require.Equal(t, "http://127.0.0.1:56121/callback", q.Get("redirect_uri"))
	require.Equal(t, groksubscription.OAuthScope, q.Get("scope"))
	require.Equal(t, "S256", q.Get("code_challenge_method"))
	nonce, err := hex.DecodeString(q.Get("nonce"))
	require.NoError(t, err)
	require.Len(t, nonce, 16)
	require.Equal(t, "generic", q.Get("plan"))
	require.Equal(t, "sub2api", q.Get("referrer"))
	require.NotEmpty(t, q.Get("state"), "state must be set for CSRF protection")
	require.Equal(t, q.Get("state"), start.State, "state must round-trip for callback verification")

	// flow 落库断言：记录存在，Verifier 存的是密文（cipher round-trip 验证），state 存 hash。
	var flow model.GrokAuthFlow
	require.NoError(t, model.DB.Where("flow_id = ?", start.FlowID).First(&flow).Error)
	require.Equal(t, 42, flow.ChannelID)
	require.Equal(t, "http://127.0.0.1:56121/callback", flow.RedirectURI)
	require.NotEqual(t, start.State, flow.StateHash, "state must be stored as hash, not plaintext")
	sum := sha256.Sum256([]byte(start.State))
	require.Equal(t, hex.EncodeToString(sum[:]), flow.StateHash)
	require.WithinDuration(t, time.Now().Add(10*time.Minute), time.Unix(flow.ExpiresAt, 0), 2*time.Minute)

	cipher, err := service.LoadGrokCredentialCipher()
	require.NoError(t, err)
	verifier, err := cipher.Decrypt(flow.FlowID, "pkce_verifier", flow.EncryptedVerifier)
	require.NoError(t, err)
	require.NotEmpty(t, verifier)
	require.NotContains(t, start.AuthorizeURL, verifier, "verifier must never appear in authorize URL")
	vsum := sha256.Sum256([]byte(verifier))
	require.Equal(t, base64.RawURLEncoding.EncodeToString(vsum[:]), q.Get("code_challenge"), "code_challenge must be S256(verifier)")
}

func TestGrokAuthPKCEStartRejectsInvalidArgs(t *testing.T) {
	setupGrokAuthTestDB(t)
	setGrokCipherKey(t)
	if _, err := GrokPKCEStart(-1, "https://newapi.example/callback"); err == nil {
		t.Fatalf("negative channelID must be rejected")
	}
	if _, err := GrokPKCEStart(42, ""); err == nil {
		t.Fatalf("empty redirectURI must be rejected")
	}
}

func TestGrokAuthPKCEStartAllowsUnboundFlow(t *testing.T) {
	setupGrokAuthTestDB(t)
	setGrokCipherKey(t)
	start, err := GrokPKCEStart(0, groksubscription.OAuthRedirectURI)
	require.NoError(t, err)
	flow := readGrokFlow(t, start.FlowID)
	require.Zero(t, flow.ChannelID)
	var channelCount int64
	require.NoError(t, model.DB.Model(&model.Channel{}).Count(&channelCount).Error)
	require.Zero(t, channelCount)
}

// TestGrokPKCEStartRequiresCipherKey 守护 fail-closed：cipher key 未配置时绝不落库（verifier 无加密手段）。
func TestGrokAuthPKCEStartRequiresCipherKey(t *testing.T) {
	setupGrokAuthTestDB(t)
	t.Setenv("GROK_CREDENTIAL_CIPHER_KEY", "")
	if _, err := GrokPKCEStart(42, "https://newapi.example/callback"); err == nil {
		t.Fatalf("missing cipher key must fail closed")
	}
	var count int64
	require.NoError(t, model.DB.Model(&model.GrokAuthFlow{}).Count(&count).Error)
	require.Zero(t, count, "no flow may be persisted without cipher key")
}

// ---- complete 段测试基础件 ----

// grokDoerFunc 让函数直接充当 groksubscription.HTTPDoer（照 refresh_test.go 的 doerFunc 模式）。
type grokDoerFunc func(*http.Request) (*http.Response, error)

func (f grokDoerFunc) Do(req *http.Request) (*http.Response, error) { return f(req) }

func grokJSONResponse(code int, body string) *http.Response {
	return &http.Response{
		StatusCode: code,
		Body:       io.NopCloser(strings.NewReader(body)),
		Header:     http.Header{"Content-Type": []string{"application/json"}},
	}
}

func readGrokForm(t *testing.T, req *http.Request) url.Values {
	t.Helper()
	body, err := io.ReadAll(req.Body)
	require.NoError(t, err)
	form, err := url.ParseQuery(string(body))
	require.NoError(t, err)
	return form
}

func seedGrokChannel(t *testing.T) model.Channel {
	t.Helper()
	ch := model.Channel{
		Type:   constant.ChannelTypeGrokSubscription,
		Key:    "",
		Models: "grok-4",
		Group:  "default",
		Status: 1,
	}
	require.NoError(t, model.DB.Create(&ch).Error)
	return ch
}

// decryptGrokFlowVerifier 从落库 flow 解出 verifier 明文（仅测试用于断言交换请求内容）。
func decryptGrokFlowVerifier(t *testing.T, flow model.GrokAuthFlow) string {
	t.Helper()
	cipher, err := service.LoadGrokCredentialCipher()
	require.NoError(t, err)
	verifier, err := cipher.Decrypt(flow.FlowID, "pkce_verifier", flow.EncryptedVerifier)
	require.NoError(t, err)
	return verifier
}

func readGrokFlow(t *testing.T, flowID string) model.GrokAuthFlow {
	t.Helper()
	var flow model.GrokAuthFlow
	require.NoError(t, model.DB.Where("flow_id = ?", flowID).First(&flow).Error)
	return flow
}

func getGrokChannelKey(t *testing.T, channelID int) string {
	t.Helper()
	ch, err := model.GetChannelById(channelID, true)
	require.NoError(t, err)
	return ch.Key
}

func TestGrokAuthPKCECompleteHappyPath(t *testing.T) {
	setupGrokAuthTestDB(t)
	setGrokCipherKey(t)
	ch := seedGrokChannel(t)

	start, err := GrokPKCEStart(ch.Id, "https://newapi.example/callback")
	require.NoError(t, err)
	verifier := decryptGrokFlowVerifier(t, readGrokFlow(t, start.FlowID))

	restore := SetGrokAuthHTTPDoerForTest(grokDoerFunc(func(req *http.Request) (*http.Response, error) {
		form := readGrokForm(t, req)
		require.Equal(t, "authorization_code", form.Get("grant_type"))
		require.Equal(t, "the-auth-code", form.Get("code"))
		require.Equal(t, verifier, form.Get("code_verifier"), "exchange must carry the decrypted PKCE verifier")
		require.Equal(t, "https://newapi.example/callback", form.Get("redirect_uri"))
		require.Equal(t, groksubscription.OAuthClientID, form.Get("client_id"))
		return grokJSONResponse(200, `{"access_token":"at-final","refresh_token":"rt-final","token_type":"Bearer","expires_in":3600}`), nil
	}))
	defer restore()

	result, err := GrokPKCEComplete(start.FlowID, "the-auth-code", start.State, "")
	require.NoError(t, err)
	require.Empty(t, result.Key)

	// Channel.Key 被一次写回为可 ParseCredential 的规范化版本化 JSON。
	key := getGrokChannelKey(t, ch.Id)
	cred, err := groksubscription.ParseCredential(key)
	require.NoError(t, err, "stored key must be ParseCredential-clean versioned JSON")
	require.Equal(t, "at-final", cred.AccessToken)
	require.Equal(t, "rt-final", cred.RefreshToken)
	require.NotContains(t, key, verifier, "verifier must never land in Channel.Key")
	require.NotContains(t, key, "the-auth-code", "authorization code must never land in Channel.Key")

	// 认证状态 active。
	st, err := model.GetGrokChannelState(ch.Id)
	require.NoError(t, err)
	require.Equal(t, model.GrokAuthStatusActive, st.AuthStatus)

	// flow 已消费：任何人（含推导 owner）不能再 claim。
	_, claimed, err := model.ClaimGrokAuthFlow(start.FlowID, "whoever")
	require.NoError(t, err)
	require.False(t, claimed, "flow must be consumed after success")
}

func TestGrokAuthPKCECompleteUnboundReturnsCredentialWithoutChannelWrite(t *testing.T) {
	setupGrokAuthTestDB(t)
	setGrokCipherKey(t)
	start, err := GrokPKCEStart(0, groksubscription.OAuthRedirectURI)
	require.NoError(t, err)
	restore := SetGrokAuthHTTPDoerForTest(grokDoerFunc(func(*http.Request) (*http.Response, error) {
		return grokJSONResponse(200, `{"access_token":"at-create","refresh_token":"rt-create","token_type":"Bearer","expires_in":3600}`), nil
	}))
	defer restore()
	result, err := GrokPKCEComplete(start.FlowID, "create-code", start.State, "")
	require.NoError(t, err)
	credential, err := groksubscription.ParseCredential(result.Key)
	require.NoError(t, err)
	require.Equal(t, "at-create", credential.AccessToken)
	require.NotContains(t, result.Key, "create-code")
	var channels, states int64
	require.NoError(t, model.DB.Model(&model.Channel{}).Count(&channels).Error)
	require.NoError(t, model.DB.Model(&model.GrokChannelState{}).Count(&states).Error)
	require.Zero(t, channels)
	require.Zero(t, states)
	_, claimed, err := model.ClaimGrokAuthFlow(start.FlowID, "replay")
	require.NoError(t, err)
	require.False(t, claimed)
}

// TestGrokPKCECompleteStateMismatchBurnsFlow 守护防重放：state 不符必须 consume flow 且报 400 语义错误，
// 错误信息不含 state/code 明文。
func TestGrokAuthPKCECompleteStateMismatchBurnsFlow(t *testing.T) {
	setupGrokAuthTestDB(t)
	setGrokCipherKey(t)
	ch := seedGrokChannel(t)

	called := false
	restore := SetGrokAuthHTTPDoerForTest(grokDoerFunc(func(req *http.Request) (*http.Response, error) {
		called = true
		return grokJSONResponse(200, `{}`), nil
	}))
	defer restore()

	start, err := GrokPKCEStart(ch.Id, "https://newapi.example/callback")
	require.NoError(t, err)

	_, err = GrokPKCEComplete(start.FlowID, "the-auth-code", "wrong-state-attacker", "")
	require.Error(t, err)
	require.NotContains(t, err.Error(), "wrong-state-attacker")
	require.NotContains(t, err.Error(), "the-auth-code")
	require.NotContains(t, err.Error(), start.State)
	require.False(t, called, "state mismatch must not reach token endpoint")

	// flow 已被烧掉：不可再 claim（防重放）。
	_, claimed, err := model.ClaimGrokAuthFlow(start.FlowID, "whoever")
	require.NoError(t, err)
	require.False(t, claimed, "burned flow must not be claimable")

	// Channel.Key 未被触碰。
	require.Empty(t, getGrokChannelKey(t, ch.Id))

	// Unbound flow 的 state mismatch 也不能写渠道状态。
	unboundStart, err := GrokPKCEStart(0, groksubscription.OAuthRedirectURI)
	require.NoError(t, err)
	_, err = GrokPKCEComplete(unboundStart.FlowID, "the-auth-code", "wrong-state-attacker", "")
	require.ErrorIs(t, err, errGrokStateMismatch)
	var stateCount int64
	require.NoError(t, model.DB.Model(&model.GrokChannelState{}).Count(&stateCount).Error)
	require.Zero(t, stateCount)
}

// TestGrokPKCECompleteGrantRejectedSetsNeedsReauth：token endpoint 拒绝 → needs_reauth + 脱敏错误。
func TestGrokAuthPKCECompleteGrantRejectedSetsNeedsReauth(t *testing.T) {
	setupGrokAuthTestDB(t)
	setGrokCipherKey(t)
	ch := seedGrokChannel(t)

	const upstreamSecret = "upstream-secret-desc-must-not-leak"
	restore := SetGrokAuthHTTPDoerForTest(grokDoerFunc(func(req *http.Request) (*http.Response, error) {
		return grokJSONResponse(400, `{"error":"invalid_grant","error_description":"`+upstreamSecret+`"}`), nil
	}))
	defer restore()

	start, err := GrokPKCEStart(ch.Id, "https://newapi.example/callback")
	require.NoError(t, err)

	_, err = GrokPKCEComplete(start.FlowID, "the-auth-code", start.State, "")
	require.Error(t, err)
	var gre *groksubscription.GrantRejectedError
	require.True(t, errors.As(err, &gre), "grant rejection must be typed, got %v", err)
	require.Equal(t, "invalid_grant", gre.Code)
	require.NotContains(t, err.Error(), upstreamSecret)
	require.NotContains(t, err.Error(), "the-auth-code")

	st, err := model.GetGrokChannelState(ch.Id)
	require.NoError(t, err)
	require.Equal(t, model.GrokAuthStatusNeedsReauth, st.AuthStatus)
	require.Contains(t, st.LastError, "invalid_grant")
	require.NotContains(t, st.LastError, upstreamSecret)

	// Channel.Key 未被写入。
	require.Empty(t, getGrokChannelKey(t, ch.Id))
}

func TestGrokAuthPKCECompleteRejectsInvalidArgs(t *testing.T) {
	setupGrokAuthTestDB(t)
	setGrokCipherKey(t)
	restore := SetGrokAuthHTTPDoerForTest(grokDoerFunc(func(req *http.Request) (*http.Response, error) {
		t.Fatalf("must not call token endpoint for invalid args")
		return nil, nil
	}))
	defer restore()
	if _, err := GrokPKCEComplete("", "c", "s", ""); err == nil {
		t.Fatalf("empty flowID must be rejected")
	}
	if _, err := GrokPKCEComplete("f", "", "s", ""); err == nil {
		t.Fatalf("empty code must be rejected")
	}
	if _, err := GrokPKCEComplete("f", "c", "", ""); err == nil {
		t.Fatalf("empty state must be rejected")
	}
}

// TestGrokPKCECompleteUnknownFlow：未知/过期 flow 报可区分错误，不触网。
func TestGrokAuthPKCECompleteUnknownFlow(t *testing.T) {
	setupGrokAuthTestDB(t)
	setGrokCipherKey(t)
	restore := SetGrokAuthHTTPDoerForTest(grokDoerFunc(func(req *http.Request) (*http.Response, error) {
		t.Fatalf("must not call token endpoint for unknown flow")
		return nil, nil
	}))
	defer restore()
	_, err := GrokPKCEComplete("no-such-flow", "c", "s", "")
	require.Error(t, err)
	require.NotContains(t, err.Error(), "no-such-flow")
}

// ---- import 段 ----

func TestGrokAuthImportRefreshTokenHappyPath(t *testing.T) {
	setupGrokAuthTestDB(t)
	setGrokCipherKey(t)
	ch := seedGrokChannel(t)

	const importedRT = "imported-secret-refresh-token"
	restore := SetGrokAuthHTTPDoerForTest(grokDoerFunc(func(req *http.Request) (*http.Response, error) {
		form := readGrokForm(t, req)
		require.Equal(t, "refresh_token", form.Get("grant_type"))
		require.Equal(t, importedRT, form.Get("refresh_token"))
		require.Equal(t, groksubscription.OAuthClientID, form.Get("client_id"))
		require.Equal(t, "", form.Get("code"), "import must not carry authorization_code fields")
		return grokJSONResponse(200, `{"access_token":"at-imported","refresh_token":"rt-rotated","token_type":"Bearer","expires_in":3600}`), nil
	}))
	defer restore()

	require.NoError(t, GrokImportRefreshToken(ch.Id, importedRT))

	key := getGrokChannelKey(t, ch.Id)
	cred, err := groksubscription.ParseCredential(key)
	require.NoError(t, err)
	require.Equal(t, "at-imported", cred.AccessToken)
	require.Equal(t, "rt-rotated", cred.RefreshToken)
	require.True(t, cred.IsRefreshable())

	st, err := model.GetGrokChannelState(ch.Id)
	require.NoError(t, err)
	require.Equal(t, model.GrokAuthStatusActive, st.AuthStatus)
}

// TestGrokImportInvalidGrantNeedsReauth：invalid_grant → needs_reauth + 脱敏错误，
// refresh_token 明文绝不出现在任何错误串。
func TestGrokAuthImportInvalidGrantNeedsReauth(t *testing.T) {
	setupGrokAuthTestDB(t)
	setGrokCipherKey(t)
	ch := seedGrokChannel(t)

	const importedRT = "imported-secret-refresh-token"
	const upstreamSecret = "upstream-secret-desc-must-not-leak"
	restore := SetGrokAuthHTTPDoerForTest(grokDoerFunc(func(req *http.Request) (*http.Response, error) {
		return grokJSONResponse(400, `{"error":"invalid_grant","error_description":"`+upstreamSecret+`"}`), nil
	}))
	defer restore()

	err := GrokImportRefreshToken(ch.Id, importedRT)
	require.Error(t, err)
	var gre *groksubscription.GrantRejectedError
	require.True(t, errors.As(err, &gre))
	require.Equal(t, "invalid_grant", gre.Code)
	require.NotContains(t, err.Error(), importedRT, "refresh token plaintext must never appear in errors")
	require.NotContains(t, err.Error(), upstreamSecret)

	st, err := model.GetGrokChannelState(ch.Id)
	require.NoError(t, err)
	require.Equal(t, model.GrokAuthStatusNeedsReauth, st.AuthStatus)
	require.NotContains(t, st.LastError, importedRT)
	require.NotContains(t, st.LastError, upstreamSecret)

	require.Empty(t, getGrokChannelKey(t, ch.Id), "rejected import must not write Channel.Key")
}

func TestGrokAuthImportRejectsInvalidArgs(t *testing.T) {
	setupGrokAuthTestDB(t)
	setGrokCipherKey(t)
	restore := SetGrokAuthHTTPDoerForTest(grokDoerFunc(func(req *http.Request) (*http.Response, error) {
		t.Fatalf("must not call token endpoint for invalid args")
		return nil, nil
	}))
	defer restore()
	if err := GrokImportRefreshToken(0, "rt"); err == nil {
		t.Fatalf("channelID<=0 must be rejected")
	}
	if err := GrokImportRefreshToken(42, "  "); err == nil {
		t.Fatalf("blank refresh token must be rejected")
	}
}

// ---- 段4：refresh 编排 + handlers ----

func TestGrokAuthRefreshChannelCredentialSuccess(t *testing.T) {
	setupGrokAuthTestDB(t)
	setGrokCipherKey(t)
	ch := seedGrokChannel(t)
	// 预置既有凭证 + 既有状态行（quota 快照须在刷新后保留）。
	oldCred := groksubscription.Credential{Version: 1, Type: "grok_subscription", AccessToken: "old-at", RefreshToken: "old-rt", TokenType: "Bearer", ExpiresAt: time.Now().Unix() + 60}
	serialized, err := oldCred.Serialize()
	require.NoError(t, err)
	require.NoError(t, model.UpdateChannelKeyForType(ch.Id, constant.ChannelTypeGrokSubscription, serialized))
	require.NoError(t, model.UpsertGrokChannelState(&model.GrokChannelState{ChannelID: ch.Id, AuthStatus: model.GrokAuthStatusActive, QuotaSnapshot: `{"remaining":42}`}))

	restore := SetGrokAuthHTTPDoerForTest(grokDoerFunc(func(req *http.Request) (*http.Response, error) {
		form := readGrokForm(t, req)
		require.Equal(t, "refresh_token", form.Get("grant_type"))
		require.Equal(t, "old-rt", form.Get("refresh_token"))
		return grokJSONResponse(200, `{"access_token":"new-at","token_type":"Bearer","expires_in":3600}`), nil
	}))
	defer restore()

	require.NoError(t, GrokRefreshChannelCredential(context.Background(), ch.Id))

	key := getGrokChannelKey(t, ch.Id)
	cred, err := groksubscription.ParseCredential(key)
	require.NoError(t, err)
	require.Equal(t, "new-at", cred.AccessToken)
	require.Equal(t, "old-rt", cred.RefreshToken, "upstream omitting refresh must preserve old one")

	st, err := model.GetGrokChannelState(ch.Id)
	require.NoError(t, err)
	require.Equal(t, model.GrokAuthStatusActive, st.AuthStatus)
	require.Equal(t, `{"remaining":42}`, st.QuotaSnapshot, "quota snapshot must survive refresh status update")
}

func TestGrokAuthRefreshChannelCredentialFailureSetsNeedsReauth(t *testing.T) {
	setupGrokAuthTestDB(t)
	setGrokCipherKey(t)
	ch := seedGrokChannel(t)
	// 凭证不可刷新 → Refresh 失败 → needs_reauth。
	oldCred := groksubscription.Credential{Version: 1, Type: "grok_subscription", AccessToken: "old-at", TokenType: "Bearer", ExpiresAt: time.Now().Unix() + 60}
	serialized, err := oldCred.Serialize()
	require.NoError(t, err)
	require.NoError(t, model.UpdateChannelKeyForType(ch.Id, constant.ChannelTypeGrokSubscription, serialized))

	restore := SetGrokAuthHTTPDoerForTest(grokDoerFunc(func(req *http.Request) (*http.Response, error) {
		t.Fatalf("non-refreshable credential must not hit token endpoint")
		return nil, nil
	}))
	defer restore()

	err = GrokRefreshChannelCredential(context.Background(), ch.Id)
	require.Error(t, err)
	require.ErrorIs(t, err, groksubscription.ErrNotRefreshable)

	st, err := model.GetGrokChannelState(ch.Id)
	require.NoError(t, err)
	require.Equal(t, model.GrokAuthStatusNeedsReauth, st.AuthStatus)
}

// ---- handlers ----

type grokAuthHandlerResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Data    struct {
		AuthorizeURL  string `json:"authorize_url"`
		FlowID        string `json:"flow_id"`
		Status        string `json:"status"`
		Key           string `json:"key"`
		QuotaSnapshot string `json:"quota_snapshot"`
	} `json:"data"`
}

func newGrokAuthRequestContext(t *testing.T, body string) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/channel/grok/test", strings.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")
	return ctx, recorder
}

func decodeGrokAuthResponse(t *testing.T, recorder *httptest.ResponseRecorder) grokAuthHandlerResponse {
	t.Helper()
	var resp grokAuthHandlerResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &resp))
	return resp
}

func TestGrokAuthPKCEStartHandler(t *testing.T) {
	setupGrokAuthTestDB(t)
	setGrokCipherKey(t)
	ch := seedGrokChannel(t)

	// 缺参 → 400 + no-store。
	ctx, rec := newGrokAuthRequestContext(t, `{}`)
	GrokPKCEStartHandler(ctx)
	require.Equal(t, http.StatusBadRequest, rec.Code)
	require.Equal(t, "no-store", rec.Header().Get("Cache-Control"))

	// 显式负 channel_id 仍然无效。
	ctx, rec = newGrokAuthRequestContext(t, `{"channel_id":-1}`)
	GrokPKCEStartHandler(ctx)
	require.Equal(t, http.StatusBadRequest, rec.Code)

	// 显式 channel_id=0 开始未绑定 flow，不需要预先创建渠道。
	ctx, rec = newGrokAuthRequestContext(t, `{"channel_id":0}`)
	GrokPKCEStartHandler(ctx)
	require.Equal(t, http.StatusOK, rec.Code)
	resp := decodeGrokAuthResponse(t, rec)
	require.True(t, resp.Success)
	require.NotEmpty(t, resp.Data.FlowID)

	// 成功 → 200，data 带 authorize_url/flow_id，no-store。服务端必须使用已登记的
	// sub2-compatible loopback URI，不能信任旧前端传入的 localhost 回调。
	ctx, rec = newGrokAuthRequestContext(t, `{"channel_id":`+strconv.Itoa(ch.Id)+`,"redirect_uri":"http://localhost:8976/callback"}`)
	GrokPKCEStartHandler(ctx)
	require.Equal(t, http.StatusOK, rec.Code)
	require.Equal(t, "no-store", rec.Header().Get("Cache-Control"))
	resp = decodeGrokAuthResponse(t, rec)
	require.True(t, resp.Success)
	require.Contains(t, resp.Data.AuthorizeURL, "code_challenge=")
	require.Contains(t, resp.Data.AuthorizeURL, "code_challenge_method=S256")
	require.NotEmpty(t, resp.Data.FlowID)
	authorizeURL, err := url.Parse(resp.Data.AuthorizeURL)
	require.NoError(t, err)
	require.Equal(t, "http://127.0.0.1:56121/callback", authorizeURL.Query().Get("redirect_uri"))
	require.NotEmpty(t, authorizeURL.Query().Get("nonce"))
	require.Equal(t, "generic", authorizeURL.Query().Get("plan"))
	require.Equal(t, "sub2api", authorizeURL.Query().Get("referrer"))

	// 渠道不存在 → 400。
	ctx, rec = newGrokAuthRequestContext(t, `{"channel_id":99999,"redirect_uri":"https://x/cb"}`)
	GrokPKCEStartHandler(ctx)
	require.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestGrokAuthPKCECompleteHandler(t *testing.T) {
	setupGrokAuthTestDB(t)
	setGrokCipherKey(t)
	ch := seedGrokChannel(t)

	// 缺参 → 400 + no-store。
	ctx, rec := newGrokAuthRequestContext(t, `{"code":"c","state":"s"}`)
	GrokPKCECompleteHandler(ctx)
	require.Equal(t, http.StatusBadRequest, rec.Code)
	require.Equal(t, "no-store", rec.Header().Get("Cache-Control"))

	// state 不符 → 400，错误不含 code/state 明文。
	start, err := GrokPKCEStart(ch.Id, "https://newapi.example/callback")
	require.NoError(t, err)
	ctx, rec = newGrokAuthRequestContext(t, `{"flow_id":"`+start.FlowID+`","code":"auth-code-xyz","state":"attacker-state"}`)
	GrokPKCECompleteHandler(ctx)
	require.Equal(t, http.StatusBadRequest, rec.Code)
	require.Equal(t, "no-store", rec.Header().Get("Cache-Control"))
	resp := decodeGrokAuthResponse(t, rec)
	require.False(t, resp.Success)
	require.NotContains(t, rec.Body.String(), "auth-code-xyz")
	require.NotContains(t, rec.Body.String(), "attacker-state")

	// 成功 → 200 + status active。
	start2, err := GrokPKCEStart(ch.Id, "https://newapi.example/callback")
	require.NoError(t, err)
	restore := SetGrokAuthHTTPDoerForTest(grokDoerFunc(func(req *http.Request) (*http.Response, error) {
		return grokJSONResponse(200, `{"access_token":"at-h","refresh_token":"rt-h","token_type":"Bearer","expires_in":3600}`), nil
	}))
	defer restore()
	ctx, rec = newGrokAuthRequestContext(t, `{"flow_id":"`+start2.FlowID+`","code":"auth-code-xyz","state":"`+start2.State+`"}`)
	GrokPKCECompleteHandler(ctx)
	require.Equal(t, http.StatusOK, rec.Code)
	resp = decodeGrokAuthResponse(t, rec)
	require.True(t, resp.Success)
	require.Equal(t, model.GrokAuthStatusActive, resp.Data.Status)
	require.NotContains(t, rec.Body.String(), `"key"`)

	// 未绑定 flow 完成时只在 no-store 响应中返回 parseable credential。
	unboundStart, err := GrokPKCEStart(0, groksubscription.OAuthRedirectURI)
	require.NoError(t, err)
	ctx, rec = newGrokAuthRequestContext(t, `{"flow_id":"`+unboundStart.FlowID+`","code":"auth-code-create","state":"`+unboundStart.State+`"}`)
	GrokPKCECompleteHandler(ctx)
	require.Equal(t, http.StatusOK, rec.Code)
	resp = decodeGrokAuthResponse(t, rec)
	require.True(t, resp.Success)
	_, err = groksubscription.ParseCredential(resp.Data.Key)
	require.NoError(t, err)
}

func TestGrokAuthImportHandler(t *testing.T) {
	setupGrokAuthTestDB(t)
	setGrokCipherKey(t)
	ch := seedGrokChannel(t)

	// 缺参 → 400 + no-store。
	ctx, rec := newGrokAuthRequestContext(t, `{"channel_id":`+strconv.Itoa(ch.Id)+`}`)
	GrokImportHandler(ctx)
	require.Equal(t, http.StatusBadRequest, rec.Code)
	require.Equal(t, "no-store", rec.Header().Get("Cache-Control"))

	// 成功 → 200 + status active。
	restore := SetGrokAuthHTTPDoerForTest(grokDoerFunc(func(req *http.Request) (*http.Response, error) {
		return grokJSONResponse(200, `{"access_token":"at-i","refresh_token":"rt-i","token_type":"Bearer","expires_in":3600}`), nil
	}))
	defer restore()
	ctx, rec = newGrokAuthRequestContext(t, `{"channel_id":`+strconv.Itoa(ch.Id)+`,"refresh_token":"imported-rt-secret"}`)
	GrokImportHandler(ctx)
	require.Equal(t, http.StatusOK, rec.Code)
	resp := decodeGrokAuthResponse(t, rec)
	require.True(t, resp.Success)
	require.Equal(t, model.GrokAuthStatusActive, resp.Data.Status)

	// invalid_grant → 400 + status needs_reauth，错误不含 refresh token 明文。
	restore2 := SetGrokAuthHTTPDoerForTest(grokDoerFunc(func(req *http.Request) (*http.Response, error) {
		return grokJSONResponse(400, `{"error":"invalid_grant"}`), nil
	}))
	defer restore2()
	ctx, rec = newGrokAuthRequestContext(t, `{"channel_id":`+strconv.Itoa(ch.Id)+`,"refresh_token":"another-rt-secret"}`)
	GrokImportHandler(ctx)
	require.Equal(t, http.StatusBadRequest, rec.Code)
	require.Equal(t, "no-store", rec.Header().Get("Cache-Control"))
	require.NotContains(t, rec.Body.String(), "another-rt-secret")
	resp = decodeGrokAuthResponse(t, rec)
	require.False(t, resp.Success)
	require.Equal(t, model.GrokAuthStatusNeedsReauth, resp.Data.Status)
}

func TestGrokAuthRefreshHandler(t *testing.T) {
	setupGrokAuthTestDB(t)
	setGrokCipherKey(t)
	ch := seedGrokChannel(t)

	// 缺参 → 400 + no-store。
	ctx, rec := newGrokAuthRequestContext(t, `{}`)
	GrokRefreshHandler(ctx)
	require.Equal(t, http.StatusBadRequest, rec.Code)
	require.Equal(t, "no-store", rec.Header().Get("Cache-Control"))

	// 渠道不存在 → 400 脱敏。
	ctx, rec = newGrokAuthRequestContext(t, `{"channel_id":99999}`)
	GrokRefreshHandler(ctx)
	require.Equal(t, http.StatusBadRequest, rec.Code)
	resp := decodeGrokAuthResponse(t, rec)
	require.False(t, resp.Success)

	// 成功 → 200 + status active + quota 快照。
	oldCred := groksubscription.Credential{Version: 1, Type: "grok_subscription", AccessToken: "old-at", RefreshToken: "old-rt", TokenType: "Bearer", ExpiresAt: time.Now().Unix() + 60}
	serialized, err := oldCred.Serialize()
	require.NoError(t, err)
	require.NoError(t, model.UpdateChannelKeyForType(ch.Id, constant.ChannelTypeGrokSubscription, serialized))
	require.NoError(t, model.UpsertGrokChannelState(&model.GrokChannelState{ChannelID: ch.Id, AuthStatus: model.GrokAuthStatusActive, QuotaSnapshot: `{"remaining":7}`}))
	restore := SetGrokAuthHTTPDoerForTest(grokDoerFunc(func(req *http.Request) (*http.Response, error) {
		return grokJSONResponse(200, `{"access_token":"new-at2","token_type":"Bearer","expires_in":3600}`), nil
	}))
	defer restore()
	ctx, rec = newGrokAuthRequestContext(t, `{"channel_id":`+strconv.Itoa(ch.Id)+`}`)
	GrokRefreshHandler(ctx)
	require.Equal(t, http.StatusOK, rec.Code)
	require.Equal(t, "no-store", rec.Header().Get("Cache-Control"))
	resp = decodeGrokAuthResponse(t, rec)
	require.True(t, resp.Success)
	require.Equal(t, model.GrokAuthStatusActive, resp.Data.Status)
	require.Equal(t, `{"remaining":7}`, resp.Data.QuotaSnapshot)
}

// TestGrokRefreshShouldMarkNeedsReauth 守护设计 §6.3 的失败分类：
// revision CAS 冲突（另一节点刚成功刷新、凭证仍健康）属瞬时失败，不得置 needs_reauth；
// 凭证不可刷新与其它未分类失败保守置 needs_reauth。用 errors.Is 语义覆盖 wrap 情形。
func TestGrokRefreshShouldMarkNeedsReauth(t *testing.T) {
	cases := []struct {
		name string
		err  error
		want bool
	}{
		{name: "nil error", err: nil, want: false},
		{name: "refresh conflict sentinel", err: groksubscription.ErrRefreshConflict, want: false},
		{name: "wrapped refresh conflict", err: fmt.Errorf("refresh channel %d: %w", 7, groksubscription.ErrRefreshConflict), want: false},
		{name: "not refreshable", err: groksubscription.ErrNotRefreshable, want: true},
		{name: "arbitrary error", err: errors.New("boom"), want: true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.want, grokRefreshShouldMarkNeedsReauth(tc.err))
		})
	}
}

// errGrokInjectedDBFailure 模拟一次真实 DB 读错误（连接断/死锁/超时）——
// 关键在于它 NOT gorm.ErrRecordNotFound：upsertGrokAuthStatus 必须据此中止，
// 而非把它当成"首次创建"继续，从而避免 OnConflict{UpdateAll} 用零值覆盖既有快照。
var errGrokInjectedDBFailure = errors.New("grok test: simulated real db read failure")

// TestGrokAuthUpsertStatusAbortsOnRealDBError 守护 Important 修复：
// 既有快照读取遇到真实 DB 错误（非 not-found）时，upsertGrokAuthStatus 必须返回该错误并中止，
// 绝不能继续走到 UpsertGrokChannelState 的 OnConflict{UpdateAll} 用零值覆盖既有 quota/billing/lease 快照
// （"读失败反而毁数据"）。真实 DB 错误路径由 errors.Is(gorm.ErrRecordNotFound) 甄别守卫。
func TestGrokAuthUpsertStatusAbortsOnRealDBError(t *testing.T) {
	setupGrokAuthTestDB(t)
	setGrokCipherKey(t)
	ch := seedGrokChannel(t)

	// 预置一行带非零快照的既有状态（正是"读失败反而毁数据"要保护的字段）。
	require.NoError(t, model.UpsertGrokChannelState(&model.GrokChannelState{
		ChannelID:             ch.Id,
		AuthStatus:            model.GrokAuthStatusActive,
		BillingPlan:           "grok-4-heavy",
		TierRaw:               "tier-raw-xyz",
		QuotaSnapshot:         `{"remaining":99}`,
		RefreshLeaseOwner:     "node-A",
		RefreshLeaseExpiresAt: 1893456000,
		LastRefreshAt:         1700000000,
	}))

	// 只对 Query 注入真实 DB 错误：GetGrokChannelState 的 First 会失败，
	// 而 UpsertGrokChannelState 的 Create（若被错误地执行到）走 Create 回调链、不受 Query 回调影响，
	// 从而能真实暴露"跳过字段保留 + 零值覆盖"这一缺陷（修复前红、修复后绿）。
	require.NoError(t, model.DB.Callback().Query().Before("gorm:query").
		Register("grok_inject_read_error", func(db *gorm.DB) {
			_ = db.AddError(errGrokInjectedDBFailure)
		}))

	upErr := upsertGrokAuthStatus(ch.Id, model.GrokAuthStatusActive, true, "")

	// 立即摘除注入回调，恢复读能力以便验证。
	require.NoError(t, model.DB.Callback().Query().Remove("grok_inject_read_error"))

	// 1) 必须把真实 DB 错误上抛（不得吞掉当作首次创建）。
	require.Error(t, upErr, "真实 DB 读错误必须中止 upsert 并上抛")

	// 2) 既有快照必须完好——绝不能被零值覆盖。
	st, err := model.GetGrokChannelState(ch.Id)
	require.NoError(t, err)
	require.Equal(t, "grok-4-heavy", st.BillingPlan, "BillingPlan 不得被零值覆盖")
	require.Equal(t, "tier-raw-xyz", st.TierRaw, "TierRaw 不得被零值覆盖")
	require.Equal(t, `{"remaining":99}`, st.QuotaSnapshot, "QuotaSnapshot 不得被零值覆盖")
	require.Equal(t, "node-A", st.RefreshLeaseOwner, "RefreshLeaseOwner 不得被零值覆盖")
	require.Equal(t, int64(1893456000), st.RefreshLeaseExpiresAt, "RefreshLeaseExpiresAt 不得被零值覆盖")
	require.Equal(t, int64(1700000000), st.LastRefreshAt, "LastRefreshAt 不得被零值覆盖")
}

// TestGrokAuthUpsertStatusCreatesOnNotFound 守护三态甄别的 not-found 分支：
// GetGrokChannelState 返回 gorm.ErrRecordNotFound 时属正常"首次创建"，
// upsertGrokAuthStatus 不得把它当成真实错误上抛，而应正常新建状态行。
func TestGrokAuthUpsertStatusCreatesOnNotFound(t *testing.T) {
	setupGrokAuthTestDB(t)
	setGrokCipherKey(t)
	ch := seedGrokChannel(t)

	// 无既有 state 行 → GetGrokChannelState 命中 ErrRecordNotFound（非真实错误）。
	require.NoError(t, upsertGrokAuthStatus(ch.Id, model.GrokAuthStatusActive, true, ""))

	st, err := model.GetGrokChannelState(ch.Id)
	require.NoError(t, err)
	require.Equal(t, model.GrokAuthStatusActive, st.AuthStatus)
	require.NotZero(t, st.LastRefreshAt, "markRefreshed 应落 LastRefreshAt")
}

// TestGrokTruncateStringIsRuneSafe 守护 [4]：LastError 截断（512 列宽）绝不能切断多字节 rune
// 留下坏尾字节。中文/emoji 超限串截断后必须仍是合法 UTF-8 且长度<=limit；ASCII 行为不变。
func TestGrokTruncateStringIsRuneSafe(t *testing.T) {
	// 每个中文占 3 字节；limit 落在某个 rune 中间，天真的 s[:limit] 会切出坏字节。
	zh := strings.Repeat("测", 300) // 900 字节
	for _, limit := range []int{0, 1, 2, 3, 7, 100, 511, 512} {
		out := truncateGrokString(zh, limit)
		if !utf8.ValidString(out) {
			t.Fatalf("truncated string must stay valid UTF-8 at limit=%d, got invalid bytes", limit)
		}
		if len(out) > limit {
			t.Fatalf("truncated length %d must be <= limit %d", len(out), limit)
		}
	}
	// emoji（4 字节）同样不得被拆
	emoji := strings.Repeat("😀", 200) // 800 字节
	out := truncateGrokString(emoji, 10)
	if !utf8.ValidString(out) {
		t.Fatalf("emoji truncation must stay valid UTF-8")
	}
	if len(out) > 10 {
		t.Fatalf("emoji truncation length %d must be <= 10", len(out))
	}
	// ASCII 行为不变：短串原样返回，超限按字节截断且合法
	if got := truncateGrokString("hello", 512); got != "hello" {
		t.Fatalf("short ASCII must be returned unchanged, got %q", got)
	}
	ascii := strings.Repeat("a", 600)
	if got := truncateGrokString(ascii, 512); len(got) != 512 || got != strings.Repeat("a", 512) {
		t.Fatalf("ASCII truncation must be exactly 512 'a', got len=%d", len(got))
	}
}

// TestGrokAuthHTTPDoerHasTimeout 守护默认 doer 不是 http.DefaultClient 且带正 Timeout：
// token 交换是短请求，http.DefaultClient 无 Timeout，上游挂起会无限拖住 admin API
// goroutine（本平台有上游卡 44 分钟的先例）。
func TestGrokAuthHTTPDoerHasTimeout(t *testing.T) {
	if grokAuthHTTPDoer == http.DefaultClient {
		t.Fatal("grokAuthHTTPDoer must not be http.DefaultClient (no timeout)")
	}
	client, ok := grokAuthHTTPDoer.(*http.Client)
	if !ok {
		t.Fatalf("grokAuthHTTPDoer = %T, want *http.Client", grokAuthHTTPDoer)
	}
	if client.Timeout <= 0 {
		t.Fatalf("grokAuthHTTPDoer timeout = %v, want > 0", client.Timeout)
	}
}
