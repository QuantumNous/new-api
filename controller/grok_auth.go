package controller

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"net/http"
	"net/url"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel/groksubscription"
	"github.com/QuantumNous/new-api/service"
)

// Grok 认证服务端编排（设计 §7、§12；Task 18）。
//
// 本文件放在 controller 而非 service 是有意的：service 包无法导入
// relay/channel/groksubscription——groksubscription/adaptor.go 依赖 relay/channel，
// 而 relay/channel/api_request.go 依赖 service，形成生产导入环。
// 仓库先例（Codex）：协议位于 relay/channel/* 时 OAuth 编排落在 controller 层。
// cipher 经 service.LoadGrokCredentialCipher() 取用（Task 5 私有工厂的导出包装）。
//
// 安全铁律（每条都被对应测试守护）：
//   - PKCE verifier 明文只存在于函数栈内；落库只存 cipher 密文，绝不返回前端/日志。
//   - state 只落 hash；complete 校验失败必须 consume flow（防重放）。
//   - 错误信息脱敏到类别级（如 invalid_grant），不 echo 上游 body / code / verifier / token。
//   - 所有 handler 设 Cache-Control: no-store，不打 request/response body 日志。

// grokAuthFlowTTL 是 PKCE flow 的有效期（设计 §7.1：10 分钟）。
const grokAuthFlowTTL = 10 * 60

// grokAuthFlowProvider 标识 GrokAuthFlow 记录归属（provider 列为日后其它 provider 复用预留）。
const grokAuthFlowProvider = "grok_subscription"

// GrokPKCEStartResult 是 PKCE 授权开始的结果。
// State 会出现在浏览器跳转 URL 里（非秘密），随回调回传校验；Verifier 绝不在此结构中。
type GrokPKCEStartResult struct {
	AuthorizeURL string
	State        string
	FlowID       string
}

// GrokPKCEStart 生成 PKCE verifier/challenge + state，构造 authorize URL，
// 并把 verifier 密文 + state hash + channel/redirect 落进 GrokAuthFlow。
func GrokPKCEStart(channelID int, redirectURI string) (GrokPKCEStartResult, error) {
	if channelID <= 0 || redirectURI == "" {
		return GrokPKCEStartResult{}, errors.New("grok pkce: invalid args")
	}
	verifier, err := randomURLSafe(64)
	if err != nil {
		return GrokPKCEStartResult{}, err
	}
	state, err := randomURLSafe(32)
	if err != nil {
		return GrokPKCEStartResult{}, err
	}
	sum := sha256.Sum256([]byte(verifier))
	challenge := base64.RawURLEncoding.EncodeToString(sum[:])

	cipher, err := loadGrokAuthCipher()
	if err != nil {
		return GrokPKCEStartResult{}, err
	}

	flow := &model.GrokAuthFlow{
		FlowID:      common.GetUUID(),
		Provider:    grokAuthFlowProvider,
		ChannelID:   channelID,
		StateHash:   hashGrokState(state),
		RedirectURI: redirectURI,
		ExpiresAt:   model.GetDBTimestamp() + grokAuthFlowTTL,
	}
	// verifier 只以密文落库（AAD 绑定 FlowID，换 flow 解不开）。
	encrypted, err := cipher.Encrypt(flow.FlowID, grokSensitiveFieldPKCEVerifierForController, verifier)
	if err != nil {
		return GrokPKCEStartResult{}, err
	}
	flow.EncryptedVerifier = encrypted
	if err := model.CreateGrokAuthFlow(flow); err != nil {
		return GrokPKCEStartResult{}, err
	}

	q := url.Values{}
	q.Set("response_type", "code")
	q.Set("client_id", groksubscription.OAuthClientID)
	q.Set("redirect_uri", redirectURI)
	q.Set("scope", groksubscription.OAuthScope)
	q.Set("state", state)
	q.Set("code_challenge", challenge)
	q.Set("code_challenge_method", "S256")

	return GrokPKCEStartResult{
		AuthorizeURL: groksubscription.OAuthAuthorize + "?" + q.Encode(),
		State:        state,
		FlowID:       flow.FlowID,
	}, nil
}

// grokSensitiveFieldPKCEVerifierForController 与 service.grokSensitiveFieldPKCEVerifier 同值
// （cipher 白名单只放行 "pkce_verifier" 一个字段）；不直接引用 service 私有常量。
const grokSensitiveFieldPKCEVerifierForController = "pkce_verifier"

// loadGrokAuthCipher 装载 Task 5 cipher（fail-closed：env 未配置即失败）。
func loadGrokAuthCipher() (service.GrokCredentialCipher, error) {
	return service.LoadGrokCredentialCipher()
}

func randomURLSafe(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", errors.New("grok pkce: rng failure")
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

// hashGrokState 计算 state 的 sha256 hex（落库/校验都用 hash，不存明文）。
func hashGrokState(state string) string {
	sum := sha256.Sum256([]byte(state))
	return hex.EncodeToString(sum[:])
}

// ---- PKCE complete ----

// grokAuthHTTPDoer 是 token endpoint 的 HTTP 通道，测试经 SetGrokAuthHTTPDoerForTest 注入 stub。
var grokAuthHTTPDoer groksubscription.HTTPDoer = http.DefaultClient

// SetGrokAuthHTTPDoerForTest 仅供测试注入 token endpoint stub；返回恢复函数（照
// service.ReplaceStripeCheckoutSessionAccessorsForTest 的仓库先例）。
func SetGrokAuthHTTPDoerForTest(doer groksubscription.HTTPDoer) func() {
	original := grokAuthHTTPDoer
	grokAuthHTTPDoer = doer
	return func() { grokAuthHTTPDoer = original }
}

// errGrokStateMismatch 是 400 语义错误：state 校验失败（flow 已被 consume 防重放）。
var errGrokStateMismatch = errors.New("grok auth: state mismatch")

// GrokPKCEComplete 用授权码换凭证并写回渠道。
// 流程：claim flow（一次性）→ 常数时间校验 state hash → 解密 verifier → ExchangeToken
// → 一次性 UpdateChannelKeyForType 写回（不做 Load-改-存，无 TOCTOU）→ 置 active → consume。
// ownerToken 为空时从 flowID 确定性推导（同 flow 重试幂等，他人 owner 抢不走 claim）。
func GrokPKCEComplete(flowID, code, state, ownerToken string) error {
	if flowID == "" || code == "" || state == "" {
		return errors.New("grok auth: invalid args")
	}
	if ownerToken == "" {
		ownerToken = grokFlowOwnerToken(flowID)
	}
	flow, claimed, err := model.ClaimGrokAuthFlow(flowID, ownerToken)
	if err != nil {
		return err
	}
	if !claimed || flow == nil {
		return errors.New("grok auth: flow not found, expired or already used")
	}
	if subtle.ConstantTimeCompare([]byte(hashGrokState(state)), []byte(flow.StateHash)) != 1 {
		// state 不符必须烧掉 flow：防重放（设计 §7.1）。
		_ = model.ConsumeGrokAuthFlow(flowID, ownerToken)
		return errGrokStateMismatch
	}
	cipher, err := loadGrokAuthCipher()
	if err != nil {
		return err
	}
	verifier, err := cipher.Decrypt(flow.FlowID, grokSensitiveFieldPKCEVerifierForController, flow.EncryptedVerifier)
	if err != nil {
		return err // cipher 错误信息自身已脱敏
	}
	cred, err := groksubscription.ExchangeToken(context.Background(), grokAuthHTTPDoer,
		groksubscription.GrantTypeAuthorizationCode, code, verifier, "", flow.RedirectURI)
	if err != nil {
		var rejected *groksubscription.GrantRejectedError
		if errors.As(err, &rejected) {
			recordGrokNeedsReauth(flow.ChannelID, err)
		}
		return err
	}
	if err := persistGrokCredential(flow.ChannelID, cred); err != nil {
		return err
	}
	if err := upsertGrokAuthStatus(flow.ChannelID, model.GrokAuthStatusActive, true, ""); err != nil {
		return err
	}
	return model.ConsumeGrokAuthFlow(flowID, ownerToken)
}

// grokFlowOwnerToken 从 flowID 推导 claim 用的 owner token：同一 flow 的重试幂等
// （ClaimGrokAuthFlow 同 owner 重入成功），且 state-mismatch 烧 flow 时我们已持有 claim。
func grokFlowOwnerToken(flowID string) string {
	sum := sha256.Sum256([]byte("grok-auth-flow-owner:" + flowID))
	return hex.EncodeToString(sum[:])[:48]
}

// persistGrokCredential 把交换到的凭证以规范化版本化 JSON 一次写回 Channel.Key。
// 设计 §6.1：Channel.Key 存版本化 OAuth JSON（同 Refresh 的 CredentialStore 契约与
// adaptor 的 ParseCredential(info.ApiKey) 读取路径）；UpdateChannelKeyForType 是
// 单条 UPDATE+abilities 刷新，不做 Load-改-存。
func persistGrokCredential(channelID int, cred groksubscription.Credential) error {
	serialized, err := cred.Serialize()
	if err != nil {
		return err
	}
	return model.UpdateChannelKeyForType(channelID, constant.ChannelTypeGrokSubscription, serialized)
}

// upsertGrokAuthStatus 更新认证状态；保留既有非秘密快照字段（quota/billing/lease），
// 避免 Upsert 的 OnConflict UpdateAll 用零值覆盖。active 时清空 LastError。
func upsertGrokAuthStatus(channelID int, status string, markRefreshed bool, lastErr string) error {
	st := &model.GrokChannelState{ChannelID: channelID, AuthStatus: status}
	if existing, err := model.GetGrokChannelState(channelID); err == nil && existing != nil {
		st.BillingPlan = existing.BillingPlan
		st.TierRaw = existing.TierRaw
		st.QuotaSnapshot = existing.QuotaSnapshot
		st.RefreshLeaseOwner = existing.RefreshLeaseOwner
		st.RefreshLeaseExpiresAt = existing.RefreshLeaseExpiresAt
		st.LastRefreshAt = existing.LastRefreshAt
		st.LastError = existing.LastError
		st.CreatedAt = existing.CreatedAt
	}
	if markRefreshed {
		st.LastRefreshAt = model.GetDBTimestamp()
	}
	if status == model.GrokAuthStatusActive {
		st.LastError = ""
	} else if lastErr != "" {
		st.LastError = truncateGrokString(lastErr, 512)
	}
	return model.UpsertGrokChannelState(st)
}

// recordGrokNeedsReauth 把脱敏后的失败原因落进 needs_reauth 状态（列宽 512 截断）。
func recordGrokNeedsReauth(channelID int, cause error) {
	msg := ""
	if cause != nil {
		msg = cause.Error()
	}
	_ = upsertGrokAuthStatus(channelID, model.GrokAuthStatusNeedsReauth, false, msg)
}

func truncateGrokString(s string, limit int) string {
	if len(s) > limit {
		return s[:limit]
	}
	return s
}

// ---- refresh-token import ----

// GrokImportRefreshToken 用裸 refresh token 走一次 refresh_token grant 换完整凭证，
// 一次性写回 Channel.Key 并置 active。渠道此前不需要已有凭证（这正是与 Refresher.Refresh
// 的分工：Refresh 只能刷新 store 里既有的凭证）。
func GrokImportRefreshToken(channelID int, refreshToken string) error {
	if channelID <= 0 || strings.TrimSpace(refreshToken) == "" {
		return errors.New("grok import: invalid args")
	}
	cred, err := groksubscription.ExchangeToken(context.Background(), grokAuthHTTPDoer,
		groksubscription.GrantTypeRefreshToken, "", "", refreshToken, "")
	if err != nil {
		var rejected *groksubscription.GrantRejectedError
		if errors.As(err, &rejected) {
			recordGrokNeedsReauth(channelID, err)
		}
		return err
	}
	if err := persistGrokCredential(channelID, cred); err != nil {
		return err
	}
	return upsertGrokAuthStatus(channelID, model.GrokAuthStatusActive, true, "")
}
