package agenticrouter

import (
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

func newTestContext(t *testing.T, body string) *gin.Context {
	t.Helper()
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest("POST", "/v1/chat/completions", strings.NewReader(body))
	return c
}

func TestShadowDoesNotRewriteModel(t *testing.T) {
	h := NewHook(testTiers(), "shadow", 0, "")
	h.Router().Exploration = 0
	c := newTestContext(t, `{"model":"test-base","messages":[{"role":"user","content":"帮我总结这篇文章的要点"}]}`)
	req := &fakeRequest{model: "test-base"}

	h.Decide(c, req)

	if req.model != "test-base" {
		t.Fatalf("shadow mode rewrote model to %q", req.model)
	}
	if _, ok := c.Get(pendingKey); !ok {
		t.Fatal("shadow mode must still record a pending decision")
	}
}

func TestActiveRewritesModel(t *testing.T) {
	h := NewHook(testTiers(), "active", 0, "")
	h.Router().Exploration = 0
	c := newTestContext(t, `{"model":"test-base","messages":[{"role":"user","content":"你好"}]}`)
	req := &fakeRequest{model: "test-base"}

	h.Decide(c, req)

	if req.model == "test-base" || req.model == "" {
		t.Fatalf("active mode should rewrite model, got %q", req.model)
	}
	if got := common.GetContextKeyString(c, constant.ContextKeyOriginalModel); got != req.model {
		t.Fatalf("context model = %q, want %q", got, req.model)
	}
}

func TestSettleFeedsFlywheel(t *testing.T) {
	h := NewHook(testTiers(), "shadow", 0, "")
	h.Router().Exploration = 0
	c := newTestContext(t, `{"model":"test-base","messages":[{"role":"user","content":"帮我总结这篇文章的要点"}]}`)

	h.Decide(c, &fakeRequest{model: "test-base"})
	if h.Router().State.UCB.Total != 0 {
		t.Fatal("nothing settled yet")
	}

	h.Settle(c, true)
	if h.Router().State.UCB.Total != 1 {
		t.Fatalf("flywheel fed once, got %d", h.Router().State.UCB.Total)
	}

	// 双重结算必须被忽略
	h.Settle(c, true)
	if h.Router().State.UCB.Total != 1 {
		t.Fatalf("double settle leaked, got %d", h.Router().State.UCB.Total)
	}
}

func TestStatePersistsAcrossHooks(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "state.json")

	h1 := NewHook(testTiers(), "shadow", 0, path)
	h1.saveEvery = 1
	h1.Router().Exploration = 0
	c := newTestContext(t, `{"model":"test-base","messages":[{"role":"user","content":"你好"}]}`)
	h1.Decide(c, &fakeRequest{model: "test-base"})
	h1.Settle(c, true)

	if _, err := os.Stat(path); err != nil {
		t.Fatalf("state file not written: %v", err)
	}
	h2 := NewHook(testTiers(), "shadow", 0, path)
	if h2.Router().State.UCB.Total != 1 {
		t.Fatalf("state not restored, total = %d", h2.Router().State.UCB.Total)
	}
}

func TestPackageLevelNoopWithoutEnv(t *testing.T) {
	c := newTestContext(t, `{"model":"test-base","messages":[{"role":"user","content":"你好"}]}`)
	req := &fakeRequest{model: "test-base"}
	Decide(c, req) // 未配置 AGENTIC_ROUTER_TIERS：必须是无副作用的 no-op
	if req.model != "test-base" {
		t.Fatalf("model rewritten while disabled: %q", req.model)
	}
	Settle(c, true) // 不能 panic
}
