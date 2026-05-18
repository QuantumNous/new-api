package middleware

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/internal/smart_router_client"

	"github.com/gin-gonic/gin"
)

func init() { gin.SetMode(gin.TestMode) }

// stubServer builds an httptest server returning the given handler for
// POST /route. Returns the URL and a cleanup func.
func stubServer(t *testing.T, handler http.HandlerFunc) (string, func()) {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/route" {
			http.NotFound(w, r)
			return
		}
		handler(w, r)
	}))
	return srv.URL, srv.Close
}

// newCtxForResolve builds a gin.Context wired up so resolveAutoModel can:
//   - read the request body via common.UnmarshalBodyReusable
//   - set headers on the response
//   - read ContextKeyUserId
func newCtxForResolve(t *testing.T, body any, userID int) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()
	buf, err := json.Marshal(body)
	if err != nil {
		t.Fatal(err)
	}
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", bytes.NewReader(buf))
	c.Request.Header.Set("Content-Type", "application/json")
	if userID > 0 {
		c.Set(string(constant.ContextKeyUserId), userID)
	}
	return c, w
}

func TestResolveAutoModel_NotAutoModel(t *testing.T) {
	c, w := newCtxForResolve(t, map[string]any{"messages": []any{}}, 1)
	client := smart_router_client.NewClient("http://unused", time.Second)

	got := resolveAutoModel(c, "gpt-4o", client)

	if got != "" {
		t.Errorf("non-auto model should return empty, got %q", got)
	}
	// No headers should be touched for non-auto models.
	if v := w.Header().Get("X-DeepRouter-Routed-Model"); v != "" {
		t.Errorf("should not set headers for non-auto, got %q", v)
	}
}

func TestResolveAutoModel_DisabledClient(t *testing.T) {
	c, w := newCtxForResolve(t, map[string]any{
		"messages": []map[string]string{{"role": "user", "content": "hi"}},
	}, 42)
	disabled := smart_router_client.NewClient("", time.Second) // empty URL = disabled

	got := resolveAutoModel(c, VirtualModelAuto, disabled)

	if got != DefaultAutoFallbackModel {
		t.Errorf("disabled client should return fallback, got %q", got)
	}
	if reason := w.Header().Get("X-DeepRouter-Routed-Reason"); reason != "smart_router_disabled" {
		t.Errorf("reason header = %q, want smart_router_disabled", reason)
	}
	if model := w.Header().Get("X-DeepRouter-Routed-Model"); model != DefaultAutoFallbackModel {
		t.Errorf("model header = %q, want %s", model, DefaultAutoFallbackModel)
	}
}

func TestResolveAutoModel_NoMessages(t *testing.T) {
	// Smart-router can't decide without prompt content — code path falls
	// back to default + records the reason for debugging.
	c, w := newCtxForResolve(t, map[string]any{"messages": []any{}}, 1)
	url, cleanup := stubServer(t, func(w http.ResponseWriter, _ *http.Request) {
		t.Error("smart-router should NOT be called when messages are empty")
	})
	defer cleanup()
	client := smart_router_client.NewClient(url, time.Second)

	got := resolveAutoModel(c, VirtualModelAuto, client)

	if got != DefaultAutoFallbackModel {
		t.Errorf("no messages → fallback, got %q", got)
	}
	if reason := w.Header().Get("X-DeepRouter-Routed-Reason"); reason != "smart_router_no_messages" {
		t.Errorf("reason header = %q, want smart_router_no_messages", reason)
	}
}

func TestResolveAutoModel_Success(t *testing.T) {
	url, cleanup := stubServer(t, func(w http.ResponseWriter, r *http.Request) {
		// Verify the request we send is shaped right.
		body, _ := io.ReadAll(r.Body)
		if !strings.Contains(string(body), `"tenant_id":"42"`) {
			t.Errorf("smart-router got body without tenant_id=42: %s", body)
		}
		if !strings.Contains(string(body), `"role":"user"`) {
			t.Errorf("smart-router got body without messages: %s", body)
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"primary":          "claude-haiku-4-5",
			"fallback_chain":   []string{"gpt-4o-mini"},
			"reason":           "short_question",
			"strategy_version": "heuristic-v1-test",
		})
	})
	defer cleanup()

	c, w := newCtxForResolve(t, map[string]any{
		"messages": []map[string]string{{"role": "user", "content": "hi"}},
		"stream":   false,
	}, 42)
	client := smart_router_client.NewClient(url, time.Second)

	got := resolveAutoModel(c, VirtualModelAuto, client)

	if got != "claude-haiku-4-5" {
		t.Errorf("got primary %q, want claude-haiku-4-5", got)
	}
	if v := w.Header().Get("X-DeepRouter-Routed-Model"); v != "claude-haiku-4-5" {
		t.Errorf("model header = %q", v)
	}
	if v := w.Header().Get("X-DeepRouter-Routed-Reason"); v != "short_question" {
		t.Errorf("reason header = %q", v)
	}
	if v := w.Header().Get("X-DeepRouter-Routed-Strategy"); v != "heuristic-v1-test" {
		t.Errorf("strategy header = %q", v)
	}

	// Context keys for cross-model fallback + audit.
	if fc, ok := c.Get(string(constant.ContextKeySmartRouterFallback)); !ok {
		t.Error("ContextKeySmartRouterFallback not set")
	} else if chain, ok := fc.([]string); !ok || len(chain) != 1 || chain[0] != "gpt-4o-mini" {
		t.Errorf("fallback chain = %+v", fc)
	}
	if v, _ := c.Get(string(constant.ContextKeyAliasResolvedFrom)); v != VirtualModelAuto {
		t.Errorf("alias_resolved_from = %v", v)
	}
	if v, _ := c.Get(string(constant.ContextKeySmartRouterReason)); v != "short_question" {
		t.Errorf("reason ctx = %v", v)
	}
}

func TestResolveAutoModel_SmartRouterError(t *testing.T) {
	url, cleanup := stubServer(t, func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "boom", http.StatusInternalServerError)
	})
	defer cleanup()

	c, w := newCtxForResolve(t, map[string]any{
		"messages": []map[string]string{{"role": "user", "content": "hi"}},
	}, 1)
	client := smart_router_client.NewClient(url, time.Second)

	got := resolveAutoModel(c, VirtualModelAuto, client)

	if got != DefaultAutoFallbackModel {
		t.Errorf("upstream 500 → fallback, got %q", got)
	}
	if reason := w.Header().Get("X-DeepRouter-Routed-Reason"); reason != "smart_router_error" {
		t.Errorf("reason = %q", reason)
	}
}

func TestResolveAutoModel_NoDecision(t *testing.T) {
	// Smart-router answered but didn't pick anything (e.g. constraints filtered
	// out every model). Our client treats that as nil decision.
	url, cleanup := stubServer(t, func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]string{
			"error":               "no_model_matches_constraints",
			"fallback_to_default": "gpt-4o-mini",
		})
	})
	defer cleanup()

	c, w := newCtxForResolve(t, map[string]any{
		"messages": []map[string]string{{"role": "user", "content": "hi"}},
	}, 1)
	client := smart_router_client.NewClient(url, time.Second)

	got := resolveAutoModel(c, VirtualModelAuto, client)

	if got != DefaultAutoFallbackModel {
		t.Errorf("no decision → fallback, got %q", got)
	}
	if reason := w.Header().Get("X-DeepRouter-Routed-Reason"); reason != "smart_router_no_decision" {
		t.Errorf("reason = %q", reason)
	}
}

func TestResolveAutoModel_HeadersAlwaysSet(t *testing.T) {
	// Even on failure paths the routing observability headers must surface,
	// otherwise customers can't debug "why didn't my auto request route".
	tests := []struct {
		name      string
		client    *smart_router_client.Client
		body      any
		wantModel string
	}{
		{
			name:      "disabled",
			client:    smart_router_client.NewClient("", time.Second),
			body:      map[string]any{"messages": []map[string]string{{"role": "user", "content": "hi"}}},
			wantModel: DefaultAutoFallbackModel,
		},
		{
			name:      "no_messages",
			client:    smart_router_client.NewClient("http://127.0.0.1:1", time.Second),
			body:      map[string]any{"messages": []any{}},
			wantModel: DefaultAutoFallbackModel,
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			c, w := newCtxForResolve(t, tc.body, 1)
			_ = resolveAutoModel(c, VirtualModelAuto, tc.client)
			if got := w.Header().Get("X-DeepRouter-Routed-Model"); got != tc.wantModel {
				t.Errorf("X-DeepRouter-Routed-Model = %q want %q", got, tc.wantModel)
			}
			if got := w.Header().Get("X-DeepRouter-Routed-Reason"); got == "" {
				t.Errorf("X-DeepRouter-Routed-Reason must be set on every code path")
			}
		})
	}
}
