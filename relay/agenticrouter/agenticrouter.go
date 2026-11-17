// Package agenticrouter 把学习型模型档位路由（fast / mid / strong）接入
// new-api 的 relay 流程：请求进来时分类并给出路由决策，请求结束时把
// 质量奖励回传给飞轮。默认 shadow（只记录不切换、不训练），不配置环境
// 变量时零开销。
//
// 配置（环境变量）：
//
//	AGENTIC_ROUTER_TIERS        模型目录 JSON，必填才会启用，例如
//	                           {"tiers":{"fast":["gpt-4o-mini"],"mid":["gpt-4o"],"strong":["o1"]}}
//	AGENTIC_ROUTER_MODE         shadow（默认）| active；active 时改写请求模型
//	AGENTIC_ROUTER_EXPLORATION  档位级 ε 探索率，默认 0.08，设 0 关闭
//	AGENTIC_ROUTER_STATE        飞轮状态 JSON 文件路径；空则只在内存中学习
//	AGENTIC_ROUTER_SAVE_EVERY   每 N 次结算落盘一次状态，默认 50
//
// shadow 模式只记录决策与结果观测，不喂奖励飞轮：请求由原模型服务，
// 其结果不能归因于路由档位。active 模式改写模型时会先通过 token 的
// 可用模型限制校验（ContextKeyTokenModelLimit），不通过则保留原模型。
//
// 算法核心见 ./core（纯标准库，与跨语言参考实现逐行对拍）：
// https://github.com/lhwwxy/agentic-router-gateway
package agenticrouter

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/relay/agenticrouter/core"
	"github.com/QuantumNous/new-api/relaykit/dto"

	"github.com/gin-gonic/gin"
)

const pendingKey = "agentic_router_pending"

type pending struct {
	id    int
	start time.Time
}

var (
	mu     sync.RWMutex
	hook   *Hook
	inited bool
)

// Enabled 报告路由器是否已配置（AGENTIC_ROUTER_TIERS 有效）。
func Enabled() bool { return current() != nil }

// Decide 在 relay 解析请求之后、GenRelayInfo 之前调用：
// 读取请求体做分类并记录路由决策；active 模式下改写请求模型。
// 任何内部错误都只放弃本请求的路由，绝不影响请求本身。
func Decide(c *gin.Context, request dto.Request) {
	h := current()
	if h == nil || request == nil {
		return
	}
	h.Decide(c, request)
}

// Settle 在请求结束时调用：active 模式把结果（成功与否 + 延迟）作为
// 奖励喂给飞轮；shadow 模式只记录观测。没有待结算决策时是 no-op。
func Settle(c *gin.Context, success bool) {
	h := current()
	if h == nil {
		return
	}
	h.Settle(c, success)
}

func current() *Hook {
	mu.RLock()
	h := hook
	mu.RUnlock()
	if h != nil {
		return h
	}
	mu.Lock()
	defer mu.Unlock()
	if inited {
		return hook
	}
	hook = newHookFromEnv()
	inited = true
	return hook
}

// Hook 绑定一个路由器实例与持久化策略。
type Hook struct {
	router    *core.Router
	statePath string
	saveEvery int

	mu      sync.Mutex
	settles int
}

// NewHook 构造钩子。mode 为 "shadow" 或 "active"；exploration < 0 表示沿用
// 核心默认值（0.08），设 0 可显式关闭探索；statePath 空表示不落盘。
func NewHook(tiers core.ModelTiers, mode string, exploration float64, statePath string) *Hook {
	if mode != "active" {
		mode = "shadow"
	}
	st := loadState(statePath)
	if st == nil {
		st = core.FreshState()
	}
	st.Mode = mode
	r := core.NewRouter(st, tiers, false, nil)
	if exploration >= 0 {
		r.Exploration = exploration
	}
	return &Hook{router: r, statePath: statePath, saveEvery: 50}
}

// Router 暴露底层路由器（监控 / 管理接口用）。
func (h *Hook) Router() *core.Router { return h.router }

// Decide 见包级 Decide。
func (h *Hook) Decide(c *gin.Context, request dto.Request) {
	defer func() {
		if r := recover(); r != nil {
			common.SysError(fmt.Sprintf("agentic-router: decide panic: %v", r))
		}
	}()
	body, err := readBody(c)
	if err != nil {
		return
	}
	text, originModel := extractText(body)
	if text == "" {
		return // 提取不到用户文本（部分任务格式）时跳过路由
	}
	d := h.router.Decide(text, "", availableTiers(h.router))
	if d == nil {
		return
	}
	h.resolveModel(d)
	if d.Mode == "active" && d.Model != "" && d.Model != originModel {
		if tokenAllowsModel(c, d.Model) {
			request.SetModelName(d.Model)
			common.SetContextKey(c, constant.ContextKeyOriginalModel, d.Model)
		} else {
			// token 的可用模型限制不含目标模型：保留请求原模型并记录。
			common.SysLog(fmt.Sprintf(
				"agentic-router: #%d blocked by token model limit, tier=%s model=%q",
				d.ID, d.Tier, d.Model))
			d.Model = originModel
		}
	}
	c.Set(pendingKey, &pending{id: d.ID, start: time.Now()})
	common.SysLog(fmt.Sprintf(
		"agentic-router: #%d mode=%s type=%s complexity=%.2f tier=%s model=%q note=%q reason=%q",
		d.ID, d.Mode, d.Type, d.Complexity, d.Tier, d.Model, d.Note, d.Reason))
}

// Settle 见包级 Settle。
func (h *Hook) Settle(c *gin.Context, success bool) {
	defer func() {
		if r := recover(); r != nil {
			common.SysError(fmt.Sprintf("agentic-router: settle panic: %v", r))
		}
	}()
	v, ok := c.Get(pendingKey)
	if !ok || v == nil {
		return
	}
	c.Set(pendingKey, nil)
	p, ok := v.(*pending)
	if !ok {
		return
	}
	dt := time.Since(p.start).Milliseconds()
	if h.router.Mode() != "active" {
		// shadow：请求由原模型服务，结果不能归因于路由档位，只观测不训练。
		common.SysLog(fmt.Sprintf(
			"agentic-router: observe #%d success=%v dt=%dms (shadow, no training)", p.id, success, dt))
		return
	}
	res := h.router.Settle(p.id, core.Outcome{Success: success, DtMs: dt})
	if res == nil {
		return
	}
	common.SysLog(fmt.Sprintf(
		"agentic-router: settle #%d tier=%s reward=%.2f (dt=%dms)", p.id, res.Tier, res.Reward, res.Breakdown.DtMs))
	h.persistMaybe()
}

// resolveModel 核心的档位解析按 provider 限定；new-api 的请求没有 provider
// 概念，模型目录配置为平坦的模型 id 列表，回退取该档位目录第一项。规则
// 专家可能推荐未配置模型的档位，此时按相邻档位回退，保证决策始终可用。
func (h *Hook) resolveModel(d *core.Decision) {
	if d.Model != "" {
		return
	}
	for _, cand := range tierFallbackOrder(d.Tier) {
		if list := h.router.ModelTiers.Tiers[cand]; len(list) > 0 {
			if cand != d.Tier {
				d.Note += fmt.Sprintf(" [%s->%s tier-fallback]", d.Tier, cand)
				d.Tier, d.Used = cand, cand
			}
			d.Model = list[0]
			return
		}
	}
}

func tierFallbackOrder(tier string) []string {
	switch tier {
	case "fast":
		return []string{"fast", "mid", "strong"}
	case "strong":
		return []string{"strong", "mid", "fast"}
	default:
		return []string{"mid", "strong", "fast"}
	}
}

// tokenAllowsModel 复用 distributor 的 token 可用模型限制规则（精确名、
// 通配归一化名、路由归一化名都接受），active 改写不会越权。
func tokenAllowsModel(c *gin.Context, model string) bool {
	if !common.GetContextKeyBool(c, constant.ContextKeyTokenModelLimitEnabled) {
		return true
	}
	v, ok := common.GetContextKey(c, constant.ContextKeyTokenModelLimit)
	if !ok {
		return false
	}
	limit, ok := v.(map[string]bool)
	if !ok {
		return false
	}
	return middleware.TokenModelLimitAllows(limit, model)
}

func (h *Hook) persistMaybe() {
	h.mu.Lock()
	h.settles++
	due := h.statePath != "" && h.settles >= h.saveEvery
	if due {
		h.settles = 0
	}
	h.mu.Unlock()
	if due {
		h.persist()
	}
}

func (h *Hook) persist() {
	b := h.router.MarshalState()
	if b == nil {
		return
	}
	dir := filepath.Dir(h.statePath)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return
	}
	tmp := h.statePath + ".tmp"
	if err := os.WriteFile(tmp, b, 0o600); err != nil {
		return
	}
	_ = os.Rename(tmp, h.statePath)
}

func newHookFromEnv() *Hook {
	tiersJSON := strings.TrimSpace(os.Getenv("AGENTIC_ROUTER_TIERS"))
	if tiersJSON == "" {
		return nil
	}
	var mt core.ModelTiers
	if err := json.Unmarshal([]byte(tiersJSON), &mt); err != nil {
		common.SysError("agentic-router: invalid AGENTIC_ROUTER_TIERS: " + err.Error())
		return nil
	}
	if !mt.Ready() {
		common.SysError("agentic-router: AGENTIC_ROUTER_TIERS has no tiers")
		return nil
	}
	exploration := -1.0 // < 0：沿用核心默认
	if v := strings.TrimSpace(os.Getenv("AGENTIC_ROUTER_EXPLORATION")); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil && f >= 0 {
			exploration = f
		}
	}
	h := NewHook(mt, os.Getenv("AGENTIC_ROUTER_MODE"), exploration, os.Getenv("AGENTIC_ROUTER_STATE"))
	if v := strings.TrimSpace(os.Getenv("AGENTIC_ROUTER_SAVE_EVERY")); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			h.saveEvery = n
		}
	}
	return h
}

func loadState(path string) *core.State {
	if path == "" {
		return nil
	}
	b, err := os.ReadFile(path)
	if err != nil {
		return nil
	}
	var st core.State
	if err := json.Unmarshal(b, &st); err != nil {
		common.SysError("agentic-router: state file corrupt, starting fresh: " + err.Error())
		return nil
	}
	if !stateSane(&st) {
		common.SysError("agentic-router: state file incomplete, starting fresh")
		return nil
	}
	return &st
}

// stateSane 校验反序列化后的状态结构完整（防止旧版本/手改文件让
// ApplyReward 在 nil map 上 panic）。
func stateSane(st *core.State) bool {
	return st != nil && st.UCB.Arms != nil &&
		st.Lin.TierN != nil && st.Lin.TierW != nil &&
		st.KNN.Pool != nil && st.Exp3.Weights != nil
}

func availableTiers(r *core.Router) []string {
	var tiers []string
	for _, t := range []string{"fast", "mid", "strong"} {
		if len(r.ModelTiers.Tiers[t]) > 0 {
			tiers = append(tiers, t)
		}
	}
	return tiers
}

func readBody(c *gin.Context) ([]byte, error) {
	seeker, err := common.GetRequestBody(c)
	if err != nil {
		return nil, err
	}
	reader, ok := seeker.(io.Reader)
	if !ok {
		return nil, nil
	}
	b, err := io.ReadAll(io.LimitReader(reader, 64<<10))
	_, _ = seeker.Seek(0, io.SeekStart)
	return b, err
}

// extractText 从 OpenAI 风格请求体里拼接用户可见文本（用于分类），
// 同时返回声明的 model。未知格式返回空文本，调用方跳过路由。
func extractText(body []byte) (text, model string) {
	var req struct {
		Model    string          `json:"model"`
		Messages []chatMessage   `json:"messages"`
		Input    json.RawMessage `json:"input"`
	}
	if err := json.Unmarshal(body, &req); err != nil {
		return "", ""
	}
	var sb strings.Builder
	for _, m := range req.Messages {
		if m.Role == "user" || m.Role == "system" || m.Role == "developer" {
			sb.WriteString(flattenContent(m.Content))
			sb.WriteByte('\n')
		}
	}
	if sb.Len() == 0 && len(req.Input) > 0 {
		sb.WriteString(flattenContent(req.Input))
	}
	r := []rune(sb.String())
	if len(r) > 4000 {
		r = r[:4000]
	}
	return string(r), req.Model
}

type chatMessage struct {
	Role    string          `json:"role"`
	Content json.RawMessage `json:"content"`
}

func flattenContent(raw json.RawMessage) string {
	if len(raw) == 0 {
		return ""
	}
	var s string
	if err := json.Unmarshal(raw, &s); err == nil {
		return s
	}
	var parts []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	}
	if err := json.Unmarshal(raw, &parts); err == nil {
		var sb strings.Builder
		for _, p := range parts {
			if p.Text != "" {
				sb.WriteString(p.Text)
				sb.WriteByte('\n')
			}
		}
		return sb.String()
	}
	return ""
}
