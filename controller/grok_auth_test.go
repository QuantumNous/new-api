package controller

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"strings"
	"testing"
	"time"

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

func TestGrokAuthPKCEStartProducesChallenge(t *testing.T) {
	setupGrokAuthTestDB(t)
	setGrokCipherKey(t)

	start, err := GrokPKCEStart(42, "https://newapi.example/callback")
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
	require.Equal(t, "https://newapi.example/callback", q.Get("redirect_uri"))
	require.Equal(t, groksubscription.OAuthScope, q.Get("scope"))
	require.Equal(t, "S256", q.Get("code_challenge_method"))
	require.NotEmpty(t, q.Get("state"), "state must be set for CSRF protection")
	require.Equal(t, q.Get("state"), start.State, "state must round-trip for callback verification")

	// flow 落库断言：记录存在，Verifier 存的是密文（cipher round-trip 验证），state 存 hash。
	var flow model.GrokAuthFlow
	require.NoError(t, model.DB.Where("flow_id = ?", start.FlowID).First(&flow).Error)
	require.Equal(t, 42, flow.ChannelID)
	require.Equal(t, "https://newapi.example/callback", flow.RedirectURI)
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
	if _, err := GrokPKCEStart(0, "https://newapi.example/callback"); err == nil {
		t.Fatalf("channelID<=0 must be rejected")
	}
	if _, err := GrokPKCEStart(42, ""); err == nil {
		t.Fatalf("empty redirectURI must be rejected")
	}
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

	require.NoError(t, GrokPKCEComplete(start.FlowID, "the-auth-code", start.State, ""))

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

	err = GrokPKCEComplete(start.FlowID, "the-auth-code", "wrong-state-attacker", "")
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

	err = GrokPKCEComplete(start.FlowID, "the-auth-code", start.State, "")
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
	if err := GrokPKCEComplete("", "c", "s", ""); err == nil {
		t.Fatalf("empty flowID must be rejected")
	}
	if err := GrokPKCEComplete("f", "", "s", ""); err == nil {
		t.Fatalf("empty code must be rejected")
	}
	if err := GrokPKCEComplete("f", "c", "", ""); err == nil {
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
	err := GrokPKCEComplete("no-such-flow", "c", "s", "")
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
	ctx, rec := newGrokAuthRequestContext(t, `{"redirect_uri":"https://x/cb"}`)
	GrokPKCEStartHandler(ctx)
	require.Equal(t, http.StatusBadRequest, rec.Code)
	require.Equal(t, "no-store", rec.Header().Get("Cache-Control"))

	// 成功 → 200，data 带 authorize_url/flow_id，no-store。
	ctx, rec = newGrokAuthRequestContext(t, `{"channel_id":`+strconv.Itoa(ch.Id)+`,"redirect_uri":"https://newapi.example/callback"}`)
	GrokPKCEStartHandler(ctx)
	require.Equal(t, http.StatusOK, rec.Code)
	require.Equal(t, "no-store", rec.Header().Get("Cache-Control"))
	resp := decodeGrokAuthResponse(t, rec)
	require.True(t, resp.Success)
	require.Contains(t, resp.Data.AuthorizeURL, "code_challenge=")
	require.Contains(t, resp.Data.AuthorizeURL, "code_challenge_method=S256")
	require.NotEmpty(t, resp.Data.FlowID)

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
