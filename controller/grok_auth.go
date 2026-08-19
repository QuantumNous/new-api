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
	"time"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel/groksubscription"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
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
	// 机会式清理过期 PKCE 残留（含未认领的 owner_token='' verifier 密文，无界增长）。
	// best-effort：清理失败绝不阻断授权主流程（设计 §7.1）。
	_ = model.DeleteExpiredGrokAuthFlows()

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
// 独立超时 client：token 交换是短请求，上游挂起不得拖死 admin API goroutine。
// http.DefaultClient 无 Timeout，绝不能用于对外上游调用。
var grokAuthHTTPDoer groksubscription.HTTPDoer = &http.Client{Timeout: 30 * time.Second}

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
	existing, err := model.GetGrokChannelState(channelID)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		// 真实 DB 错误（连接断/死锁/超时）：不可继续，否则 UpsertGrokChannelState 的
		// OnConflict{UpdateAll} 会用零值覆盖既有 quota/billing/lease 快照（"读失败反而毁数据"）。
		return err
	}
	if existing != nil {
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

// truncateGrokString 按字节上限截断，但 rune 安全：若 limit 落在多字节 rune 中间，
// 回退到最近的 rune 边界，避免 LastError 存下坏尾字节（列宽 512 场景）。
func truncateGrokString(s string, limit int) string {
	if len(s) <= limit {
		return s
	}
	cut := s[:limit]
	for len(cut) > 0 && !utf8.ValidString(cut) {
		cut = cut[:len(cut)-1]
	}
	return cut
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

// ---- refresh 编排 ----

// grokChannelCredentialStore 把 model 的 Channel.Key 适配为 CredentialStore。
// revision 是实例内 Load 计数；CAS 走 model.CompareAndSwapChannelKey 的旧值比对
// （设计 §7.2 / Task 9 的 key-CAS 积木，避免给 Channel 表加 revision 列）。
// 每次刷新新建实例：Load→CAS 固定发生在同一次 Refresh 调用内，无跨请求共享状态。
type grokChannelCredentialStore struct {
	keys      map[int]string
	revisions map[int]int
}

func newGrokChannelCredentialStore() *grokChannelCredentialStore {
	return &grokChannelCredentialStore{keys: map[int]string{}, revisions: map[int]int{}}
}

func (s *grokChannelCredentialStore) Load(ctx context.Context, channelID int) (string, int, error) {
	ch, err := model.GetChannelById(channelID, true)
	if err != nil {
		return "", 0, err
	}
	s.revisions[channelID]++
	s.keys[channelID] = ch.Key
	return ch.Key, s.revisions[channelID], nil
}

func (s *grokChannelCredentialStore) CompareAndSwap(ctx context.Context, channelID, expectedRevision int, newKey string) (bool, error) {
	if s.revisions[channelID] != expectedRevision {
		return false, nil
	}
	oldKey, ok := s.keys[channelID]
	if !ok {
		return false, nil
	}
	return model.CompareAndSwapChannelKey(channelID, constant.ChannelTypeGrokSubscription, oldKey, newKey)
}

// grokRefreshShouldMarkNeedsReauth 判定一次刷新失败是否应把渠道置 needs_reauth 并自动停用。
// 设计 §6.3：瞬时失败（含 revision CAS 冲突——另一节点刚成功刷新、凭证仍健康）不得停用渠道；
// 仅凭证不可刷新 / 上游拒绝（invalid_grant 等）/ 强刷后仍失效才停用。
// 注：里程碑 A 的 Refresher 对上游非 200 统一返回状态码错误、未回传结构化 invalid_grant 信号，
// 故此处对"其余未分类失败"保守返回 true（宁可要求重认证也不放过真失效）；瞬时网络失败
// 与 invalid_grant 的完整细分随 workstream 2 的 refresh.go 结构化错误改造再收敛。
func grokRefreshShouldMarkNeedsReauth(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, groksubscription.ErrRefreshConflict) {
		return false
	}
	return true
}

// GrokRefreshChannelCredential 刷新渠道既有凭证（Task 8 Refresher 的 Task 18 接线），
// 成功置 active，失败（不可刷新 / 上游拒绝 / CAS 冲突）置 needs_reauth（渠道仍在时）。
func GrokRefreshChannelCredential(ctx context.Context, channelID int) error {
	refresher := groksubscription.NewRefresher(newGrokChannelCredentialStore(), grokAuthHTTPDoer, time.Now().Unix)
	if _, err := refresher.Refresh(ctx, channelID); err != nil {
		// 渠道已不存在则不落状态行；否则按错误类别决定是否置 needs_reauth（设计 §6.3）。
		if grokRefreshShouldMarkNeedsReauth(err) {
			if _, loadErr := model.GetChannelById(channelID, false); loadErr == nil {
				recordGrokNeedsReauth(channelID, err)
			}
		}
		return err
	}
	return upsertGrokAuthStatus(channelID, model.GrokAuthStatusActive, true, "")
}

// ---- 管理 API handlers ----

// grokAuthNoStore 所有 Grok 认证端点统一禁缓存（凭证/授权 URL 绝不落中间层缓存）。
func grokAuthNoStore(c *gin.Context) {
	c.Header("Cache-Control", "no-store")
}

type grokPKCEStartAPIRequest struct {
	ChannelID   int    `json:"channel_id"`
	RedirectURI string `json:"redirect_uri"`
}

type grokPKCECompleteAPIRequest struct {
	FlowID string `json:"flow_id"`
	Code   string `json:"code"`
	State  string `json:"state"`
}

type grokImportAPIRequest struct {
	ChannelID    int    `json:"channel_id"`
	RefreshToken string `json:"refresh_token"`
}

type grokRefreshAPIRequest struct {
	ChannelID int `json:"channel_id"`
}

// requireGrokChannel 校验渠道存在且为 Grok Subscription 类型；不满足时已写响应并返回 false。
func requireGrokChannel(c *gin.Context, channelID int) bool {
	ch, err := model.GetChannelById(channelID, false)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "channel not found"})
		return false
	}
	if ch.Type != constant.ChannelTypeGrokSubscription {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "channel type is not Grok subscription"})
		return false
	}
	return true
}

func GrokPKCEStartHandler(c *gin.Context) {
	grokAuthNoStore(c)
	var req grokPKCEStartAPIRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.ChannelID <= 0 || strings.TrimSpace(req.RedirectURI) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "channel_id and redirect_uri are required"})
		return
	}
	if !requireGrokChannel(c, req.ChannelID) {
		return
	}
	start, err := GrokPKCEStart(req.ChannelID, req.RedirectURI)
	if err != nil {
		// 错误均为脱敏类别（invalid args / rng / cipher 未配置 / 落库失败），不含 verifier。
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"authorize_url": start.AuthorizeURL,
			"flow_id":       start.FlowID,
		},
	})
}

func GrokPKCECompleteHandler(c *gin.Context) {
	grokAuthNoStore(c)
	var req grokPKCECompleteAPIRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.FlowID == "" || req.Code == "" || req.State == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "flow_id, code and state are required"})
		return
	}
	if err := GrokPKCEComplete(req.FlowID, req.Code, req.State, ""); err != nil {
		if errors.Is(err, errGrokStateMismatch) {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "state mismatch"})
			return
		}
		body := gin.H{"success": false, "message": err.Error()}
		var rejected *groksubscription.GrantRejectedError
		if errors.As(err, &rejected) {
			body["data"] = gin.H{"status": model.GrokAuthStatusNeedsReauth}
		}
		c.JSON(http.StatusBadRequest, body)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"status": model.GrokAuthStatusActive}})
}

func GrokImportHandler(c *gin.Context) {
	grokAuthNoStore(c)
	var req grokImportAPIRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.ChannelID <= 0 || strings.TrimSpace(req.RefreshToken) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "channel_id and refresh_token are required"})
		return
	}
	if !requireGrokChannel(c, req.ChannelID) {
		return
	}
	if err := GrokImportRefreshToken(req.ChannelID, req.RefreshToken); err != nil {
		body := gin.H{"success": false, "message": err.Error()}
		var rejected *groksubscription.GrantRejectedError
		if errors.As(err, &rejected) {
			body["data"] = gin.H{"status": model.GrokAuthStatusNeedsReauth}
		}
		c.JSON(http.StatusBadRequest, body)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"status": model.GrokAuthStatusActive}})
}

func GrokRefreshHandler(c *gin.Context) {
	grokAuthNoStore(c)
	var req grokRefreshAPIRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.ChannelID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "channel_id is required"})
		return
	}
	if !requireGrokChannel(c, req.ChannelID) {
		return
	}
	if err := GrokRefreshChannelCredential(c.Request.Context(), req.ChannelID); err != nil {
		body := gin.H{"success": false, "message": err.Error()}
		var rejected *groksubscription.GrantRejectedError
		if errors.As(err, &rejected) {
			body["data"] = gin.H{"status": model.GrokAuthStatusNeedsReauth}
		}
		c.JSON(http.StatusBadRequest, body)
		return
	}
	quotaSnapshot := ""
	if st, err := model.GetGrokChannelState(req.ChannelID); err == nil && st != nil {
		quotaSnapshot = st.QuotaSnapshot
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"status":         model.GrokAuthStatusActive,
			"quota_snapshot": quotaSnapshot,
		},
	})
}
