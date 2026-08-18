package controller

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel/groksubscription"
	"github.com/QuantumNous/new-api/service"

	"net/url"
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
