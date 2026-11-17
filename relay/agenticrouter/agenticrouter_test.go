package agenticrouter

import (
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/relay/agenticrouter/core"
	"github.com/QuantumNous/new-api/relaykit/types"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// fakeRequest 满足 relaykit/dto.Request。
type fakeRequest struct {
	model string
}

func (f *fakeRequest) SetModelName(m string)         { f.model = m }
func (f *fakeRequest) IsStream(c *http.Request) bool { return false }
func (f *fakeRequest) GetTokenCountMeta() *types.TokenCountMeta {
	return &types.TokenCountMeta{}
}

func testTiers() core.ModelTiers {
	return core.ModelTiers{
		Tiers: map[string][]string{
			"fast":   {"test-mini"},
			"mid":    {"test-base"},
			"strong": {"test-pro"},
		},
	}
}

func newActiveHook(t *testing.T, mode string, statePath string) *Hook {
	t.Helper()
	h := NewHook(testTiers(), mode, 0, statePath)
	h.Router().Exploration = 0 // 关闭探索保证确定性
	return h
}

func newTestContext(t *testing.T, body string) *gin.Context {
	t.Helper()
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest("POST", "/v1/chat/completions", nil)
	c.Request.Body = http.NoBody
	if body != "" {
		c.Request.Body = io.NopCloser(strings.NewReader(body))
	}
	return c
}

func TestShadowDoesNotRewriteModel(t *testing.T) {
	h := newActiveHook(t, "shadow", "")
	c := newTestContext(t, `{"model":"test-base","messages":[{"role":"user","content":"帮我总结这篇文章的要点"}]}`)
	req := &fakeRequest{model: "test-base"}

	h.Decide(c, req)

	assert.Equal(t, "test-base", req.model, "shadow mode must not rewrite the model")
	_, ok := c.Get(pendingKey)
	assert.True(t, ok, "shadow mode must still record a pending decision")
}

func TestActiveRewritesModel(t *testing.T) {
	h := newActiveHook(t, "active", "")
	c := newTestContext(t, `{"model":"test-base","messages":[{"role":"user","content":"你好"}]}`)
	req := &fakeRequest{model: "test-base"}

	h.Decide(c, req)

	assert.Contains(t, []string{"test-mini", "test-base", "test-pro"}, req.model)
	assert.NotEqual(t, "test-base", req.model, "active mode should route away from the declared model")
	assert.Equal(t, req.model, common.GetContextKeyString(c, constant.ContextKeyOriginalModel))
}

func TestActiveRespectsTokenModelLimit(t *testing.T) {
	h := newActiveHook(t, "active", "")
	c := newTestContext(t, `{"model":"test-base","messages":[{"role":"user","content":"帮我总结这篇文章的要点"}]}`)
	// token 只允许 test-base；路由想选 test-mini（summarize→fast）时必须被阻止
	common.SetContextKey(c, constant.ContextKeyOriginalModel, "test-base") // 模拟 distributor 预设
	common.SetContextKey(c, constant.ContextKeyTokenModelLimitEnabled, true)
	common.SetContextKey(c, constant.ContextKeyTokenModelLimit, map[string]bool{"test-base": true})
	req := &fakeRequest{model: "test-base"}

	h.Decide(c, req)

	assert.Equal(t, "test-base", req.model, "rewrite must not bypass the token model limit")
	assert.Equal(t, "test-base", common.GetContextKeyString(c, constant.ContextKeyOriginalModel))
}

func TestBlockedDecisionDoesNotTrain(t *testing.T) {
	h := newActiveHook(t, "active", "")
	c := newTestContext(t, `{"model":"test-base","messages":[{"role":"user","content":"帮我总结这篇文章的要点"}]}`)
	common.SetContextKey(c, constant.ContextKeyOriginalModel, "test-base")
	common.SetContextKey(c, constant.ContextKeyTokenModelLimitEnabled, true)
	common.SetContextKey(c, constant.ContextKeyTokenModelLimit, map[string]bool{"test-base": true})

	h.Decide(c, &fakeRequest{model: "test-base"})
	h.Settle(c, true)

	// 请求由原模型 test-base 服务，奖励不能归因给被拒的 fast 档
	assert.Zero(t, h.Router().State.UCB.Total, "rejected decisions must not train the flywheel")
}

func TestWhitespaceOnlyContentSkipsRouting(t *testing.T) {
	h := newActiveHook(t, "active", "")
	c := newTestContext(t, `{"model":"test-base","messages":[{"role":"user","content":"   \n\t"}]}`)
	req := &fakeRequest{model: "test-base"}

	h.Decide(c, req)

	assert.Equal(t, "test-base", req.model)
	_, ok := c.Get(pendingKey)
	assert.False(t, ok, "whitespace-only content is not classifiable text")
}

func TestSettleUsesDecisionTimeMode(t *testing.T) {
	h := newActiveHook(t, "shadow", "")
	c := newTestContext(t, `{"model":"test-base","messages":[{"role":"user","content":"帮我总结这篇文章的要点"}]}`)

	h.Decide(c, &fakeRequest{model: "test-base"})
	h.Router().SetMode("active") // 中途切 active：已开始的请求仍按 shadow 归属
	h.Settle(c, true)

	assert.Zero(t, h.Router().State.UCB.Total, "settle must use the mode captured at decision time")
}

func TestSkipsRoutingWithoutUserText(t *testing.T) {
	h := newActiveHook(t, "active", "")
	c := newTestContext(t, `{"model":"test-base"}`) // 没有 messages
	req := &fakeRequest{model: "test-base"}

	h.Decide(c, req)

	assert.Equal(t, "test-base", req.model)
	_, ok := c.Get(pendingKey)
	assert.False(t, ok, "no decision should be recorded without classifiable text")
	h.Settle(c, true) // 必须 no-op 且不 panic
}

func TestActiveSettleFeedsFlywheel(t *testing.T) {
	h := newActiveHook(t, "active", "")
	c := newTestContext(t, `{"model":"test-base","messages":[{"role":"user","content":"帮我总结这篇文章的要点"}]}`)

	h.Decide(c, &fakeRequest{model: "test-base"})
	assert.Zero(t, h.Router().State.UCB.Total, "nothing settled yet")

	h.Settle(c, true)
	assert.Equal(t, 1, h.Router().State.UCB.Total)

	h.Settle(c, true) // 双重结算必须被忽略
	assert.Equal(t, 1, h.Router().State.UCB.Total)
}

func TestShadowSettleDoesNotTrain(t *testing.T) {
	h := newActiveHook(t, "shadow", "")
	c := newTestContext(t, `{"model":"test-base","messages":[{"role":"user","content":"帮我总结这篇文章的要点"}]}`)

	h.Decide(c, &fakeRequest{model: "test-base"})
	h.Settle(c, true)

	assert.Zero(t, h.Router().State.UCB.Total,
		"shadow outcomes served by the original model must not train the router")
	v, ok := c.Get(pendingKey)
	assert.False(t, ok && v != nil, "pending entry must be drained even in shadow mode")
}

func TestTierFallsBackWhenTierHasNoModels(t *testing.T) {
	midOnly := core.ModelTiers{Tiers: map[string][]string{"mid": {"test-base"}}}
	h := NewHook(midOnly, "active", 0, "")
	h.Router().Exploration = 0
	// "你好" → other/复杂度 0 → 规则推荐 fast，但 fast 未配置 → 回退 mid
	c := newTestContext(t, `{"model":"test-orig","messages":[{"role":"user","content":"你好"}]}`)
	req := &fakeRequest{model: "test-orig"}

	h.Decide(c, req)

	assert.Equal(t, "test-base", req.model, "tier without models must fall back to a usable tier")
}

func TestStatePersistsAcrossHooks(t *testing.T) {
	path := filepath.Join(t.TempDir(), "state.json")

	h1 := newActiveHook(t, "active", path)
	h1.saveEvery = 1
	c := newTestContext(t, `{"model":"test-base","messages":[{"role":"user","content":"你好"}]}`)
	h1.Decide(c, &fakeRequest{model: "test-base"})
	h1.Settle(c, true)

	_, err := os.Stat(path)
	require.NoError(t, err, "state file should be written")
	h2 := NewHook(testTiers(), "active", 0, path)
	assert.Equal(t, 1, h2.Router().State.UCB.Total, "state should be restored")
}

func TestCorruptStateStartsFresh(t *testing.T) {
	path := filepath.Join(t.TempDir(), "state.json")
	// 缺失嵌套结构的 JSON（arms 为 null）
	require.NoError(t, os.WriteFile(path, []byte(`{"mode":"active","ucb":{"total":1,"arms":null}}`), 0o600))
	h := NewHook(testTiers(), "active", 0, path)
	assert.Zero(t, h.Router().State.UCB.Total, "incomplete state must not be trusted")
}

func TestPackageLevelNoopWithoutEnv(t *testing.T) {
	c := newTestContext(t, `{"model":"test-base","messages":[{"role":"user","content":"你好"}]}`)
	req := &fakeRequest{model: "test-base"}
	Decide(c, req) // 未配置 AGENTIC_ROUTER_TIERS：必须是无副作用的 no-op
	assert.Equal(t, "test-base", req.model)
	Settle(c, true) // 不能 panic
}
