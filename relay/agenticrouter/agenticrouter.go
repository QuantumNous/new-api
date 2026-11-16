// Package agenticrouter 把学习型模型档位路由（fast / mid / strong）接入
// new-api 的 relay 流程：请求进来时分类并给出路由决策，请求结束时把
// 质量奖励回传给飞轮。默认 shadow（只记录不切换），不配置环境变量时零开销。
//
// 配置（环境变量）：
//
//	AGENTIC_ROUTER_TIERS        模型目录 JSON，必填才会启用，例如
//	                           {"tiers":{"fast":["gpt-4o-mini"],"mid":["gpt-4o"],"strong":["o1"]}}
//	AGENTIC_ROUTER_MODE         shadow（默认）| active；active 时改写请求模型
//	AGENTIC_ROUTER_EXPLORATION  档位级 ε 探索率，默认 0.08，0 关闭
//	AGENTIC_ROUTER_STATE        飞轮状态 JSON 文件路径；空则只在内存中学习
//	AGENTIC_ROUTER_SAVE_EVERY   每 N 次结算落盘一次状态，默认 50
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
	mu   sync.RWMutex
	hook *Hook
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

// Settle 在请求结束时调用：把结果（成功与否 + 延迟）作为奖励喂给飞轮。
// 没有待结算决策时是 no-op。
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
	if hook == nil {
		hook = newHookFromEnv()
	}
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

// NewHook 构造钩子。mode 为 "shadow" 或 "active"；statePath 空表示不落盘。
func NewHook(tiers core.ModelTiers, mode string, exploration float64, statePath string) *Hook {
	st := loadState(statePath)
	if mode != "active" {
		mode = "shadow"
	}
	if st == nil {
		st = core.FreshState()
	}
	st.Mode = mode
	r := core.NewRouter(st, tiers, false, nil)
	if exploration > 0 {
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
	d := h.router.Decide(text, "", availableTiers(h.router))
	if d == nil {
		return
	}
	// 核心解析按 provider 限定；new-api 的请求没有 provider 概念，模型目录
	// 配置为平坦的模型 id 列表，此处回退取该档位目录第一项。
	if d.Model == "" {
		if list := h.router.ModelTiers.Tiers[d.Tier]; len(list) > 0 {
			d.Model = list[0]
		}
	}
	if h.router.State.Mode == "active" && d.Model != "" && d.Model != originModel {
		request.SetModelName(d.Model)
		common.SetContextKey(c, constant.ContextKeyOriginalModel, d.Model)
	}
	c.Set(pendingKey, &pending{id: d.ID, start: time.Now()})
	common.SysLog(fmt.Sprintf(
		"agentic-router: #%d mode=%s type=%s complexity=%.2f tier=%s model=%q reason=%q",
		d.ID, h.router.State.Mode, d.Type, d.Complexity, d.Tier, d.Model, d.Reason))
}

// Settle 见包级 Settle。
func (h *Hook) Settle(c *gin.Context, success bool) {
	v, ok := c.Get(pendingKey)
	if !ok || v == nil {
		return
	}
	c.Set(pendingKey, nil)
	p, ok := v.(*pending)
	if !ok {
		return
	}
	res := h.router.Settle(p.id, core.Outcome{Success: success, DtMs: time.Since(p.start).Milliseconds()})
	if res == nil {
		return
	}
	common.SysLog(fmt.Sprintf(
		"agentic-router: settle #%d tier=%s reward=%.2f (dt=%dms)", p.id, res.Tier, res.Reward, res.Breakdown.DtMs))
	h.persistMaybe()
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
	b, err := json.Marshal(h.router.State)
	if err != nil {
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
	exploration := 0.0
	if v := strings.TrimSpace(os.Getenv("AGENTIC_ROUTER_EXPLORATION")); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil && f >= 0 {
			exploration = f
		}
	}
	return NewHook(mt, os.Getenv("AGENTIC_ROUTER_MODE"), exploration, os.Getenv("AGENTIC_ROUTER_STATE"))
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
	return &st
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
// 同时返回声明的 model。未知格式返回空文本，路由按 other 类型处理。
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
