package controller

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

func init() { gin.SetMode(gin.TestMode) }

func newTestCtx() *gin.Context {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("POST", "/v1/chat/completions", nil)
	return c
}

func TestTryCrossModelFallback_NoChain(t *testing.T) {
	c := newTestCtx()
	info := &relaycommon.RelayInfo{OriginModelName: "gpt-4o"}
	rp := &service.RetryParam{ModelName: "gpt-4o", Retry: common.GetPointer(2)}

	got, ok := tryCrossModelFallback(c, info, rp)
	if ok || got != "" {
		t.Errorf("expected no fallback when chain missing, got (%q, %v)", got, ok)
	}
	if info.OriginModelName != "gpt-4o" {
		t.Errorf("model name should not change, got %s", info.OriginModelName)
	}
}

func TestTryCrossModelFallback_EmptyChain(t *testing.T) {
	c := newTestCtx()
	c.Set(string(constant.ContextKeySmartRouterFallback), []string{})

	info := &relaycommon.RelayInfo{OriginModelName: "claude-haiku-4-5"}
	rp := &service.RetryParam{ModelName: "claude-haiku-4-5", Retry: common.GetPointer(2)}

	got, ok := tryCrossModelFallback(c, info, rp)
	if ok || got != "" {
		t.Errorf("expected no fallback for empty chain, got (%q, %v)", got, ok)
	}
}

func TestTryCrossModelFallback_AdvancesChain(t *testing.T) {
	c := newTestCtx()
	c.Set(string(constant.ContextKeySmartRouterFallback), []string{"gpt-4o-mini", "deepseek-chat"})

	info := &relaycommon.RelayInfo{OriginModelName: "claude-haiku-4-5"}
	rp := &service.RetryParam{ModelName: "claude-haiku-4-5", Retry: common.GetPointer(3)}

	got, ok := tryCrossModelFallback(c, info, rp)
	if !ok || got != "gpt-4o-mini" {
		t.Errorf("expected (gpt-4o-mini, true), got (%q, %v)", got, ok)
	}
	if info.OriginModelName != "gpt-4o-mini" {
		t.Errorf("relayInfo not updated, got %s", info.OriginModelName)
	}
	if rp.ModelName != "gpt-4o-mini" {
		t.Errorf("retryParam.ModelName not updated, got %s", rp.ModelName)
	}
	if rp.GetRetry() != -1 {
		t.Errorf("retry should reset to -1, got %d", rp.GetRetry())
	}

	// Remaining chain should be shifted.
	raw, _ := c.Get(string(constant.ContextKeySmartRouterFallback))
	remaining, _ := raw.([]string)
	if len(remaining) != 1 || remaining[0] != "deepseek-chat" {
		t.Errorf("chain not shifted, got %v", remaining)
	}

	// Response header should reflect the new model.
	if got := c.Writer.Header().Get("X-DeepRouter-Routed-Model"); got != "gpt-4o-mini" {
		t.Errorf("response header not updated, got %q", got)
	}
}

func TestTryCrossModelFallback_DrainsChain(t *testing.T) {
	c := newTestCtx()
	c.Set(string(constant.ContextKeySmartRouterFallback), []string{"a", "b"})

	info := &relaycommon.RelayInfo{}
	rp := &service.RetryParam{Retry: common.GetPointer(0)}

	if got, ok := tryCrossModelFallback(c, info, rp); !ok || got != "a" {
		t.Fatalf("first call: got (%q, %v)", got, ok)
	}
	if got, ok := tryCrossModelFallback(c, info, rp); !ok || got != "b" {
		t.Fatalf("second call: got (%q, %v)", got, ok)
	}
	if got, ok := tryCrossModelFallback(c, info, rp); ok {
		t.Errorf("third call should return false, got (%q, %v)", got, ok)
	}
}

func TestIsChannelExhaustionError(t *testing.T) {
	cases := []struct {
		name string
		err  *types.NewAPIError
		want bool
	}{
		{"nil", nil, false},
		{"channel exhausted", types.NewError(nil, types.ErrorCodeGetChannelFailed), true},
		{"invalid request", types.NewError(nil, types.ErrorCodeInvalidRequest), false},
		{"do request failed", types.NewError(nil, types.ErrorCodeDoRequestFailed), false},
	}
	for _, tc := range cases {
		if got := isChannelExhaustionError(tc.err); got != tc.want {
			t.Errorf("%s: got %v want %v", tc.name, got, tc.want)
		}
	}
}
