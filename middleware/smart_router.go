package middleware

import (
	"context"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/internal/smart_router_client"

	"github.com/gin-gonic/gin"
)

const (
	// VirtualModelAuto is the model name that triggers content-aware routing
	// via the smart-router sidecar.
	VirtualModelAuto = "deeprouter-auto"

	// DefaultAutoFallbackModel is used when smart-router is unreachable or
	// disabled. Chosen for the cheapest-reasonable-quality balance — admins
	// can override via SMART_ROUTER_DEFAULT_FALLBACK env (read at call time).
	DefaultAutoFallbackModel = "gpt-4o-mini"

	smartRouterCallTimeout = 150 * time.Millisecond
)

// chatRequestSnippet is a minimal subset of the OpenAI chat request used to
// extract messages for the smart-router call. We intentionally avoid coupling
// to dto.GeneralOpenAIRequest because:
//   - The dto type carries fields the smart-router doesn't need (functions,
//     tool definitions, response format) and parsing them adds latency.
//   - Smart-router's input contract is stable (PRD §6.1); the dto type evolves
//     with upstream features.
type chatRequestSnippet struct {
	Messages []smart_router_client.Message `json:"messages"`
	Stream   bool                          `json:"stream,omitempty"`
}

// ResolveAutoModel attempts to swap modelName == "deeprouter-auto" for a
// concrete model name via the smart-router sidecar. Returns the resolved
// name on success, an empty string on graceful failure. Context keys + the
// X-DeepRouter-Routed-Model response header are set on success.
//
// Failure modes (all return DefaultAutoFallbackModel + recorded reason):
//   - SMART_ROUTER_URL unset → "smart_router_disabled"
//   - empty messages parsed from body → "smart_router_no_messages"
//   - smart-router HTTP call errored → "smart_router_error"
//   - smart-router returned a sentinel no-decision response → "smart_router_no_decision"
//
// The caller (Distribute) treats a non-empty return as "use this model and
// continue"; an empty return is treated as "leave the model name alone".
//
// Wraps resolveAutoModel with the process-wide Default() client; tests use
// the unexported variant with their own httptest-backed client.
func ResolveAutoModel(c *gin.Context, modelName string) string {
	return resolveAutoModel(c, modelName, smart_router_client.Default())
}

func resolveAutoModel(c *gin.Context, modelName string, client *smart_router_client.Client) string {
	if modelName != VirtualModelAuto {
		return ""
	}

	originalModel := modelName

	// Parse only the snippet we need from the request body. Failure here
	// is non-fatal — we fall back to the default model.
	var snippet chatRequestSnippet
	_ = common.UnmarshalBodyReusable(c, &snippet)

	tenantID := strconv.Itoa(common.GetContextKeyInt(c, constant.ContextKeyUserId))

	resolved := DefaultAutoFallbackModel
	reason := "smart_router_disabled"
	strategy := ""

	switch {
	case !client.Enabled():
		reason = "smart_router_disabled"
	case len(snippet.Messages) == 0:
		reason = "smart_router_no_messages"
	default:
		ctx, cancel := context.WithTimeout(c.Request.Context(), smartRouterCallTimeout)
		defer cancel()
		req := smart_router_client.RouteRequest{
			TenantID:  tenantID,
			Messages:  snippet.Messages,
			RequestID: c.GetString("request_id"),
			Stream:    snippet.Stream,
		}
		decision, err := client.Route(ctx, req)
		switch {
		case err != nil:
			common.SysError("smart-router call failed: " + err.Error())
			reason = "smart_router_error"
		case decision == nil:
			reason = "smart_router_no_decision"
		default:
			resolved = decision.Primary
			reason = decision.Reason
			strategy = decision.StrategyVersion
			common.SetContextKey(c, constant.ContextKeySmartRouterFallback, decision.FallbackChain)
		}
	}

	common.SetContextKey(c, constant.ContextKeyAliasResolvedFrom, originalModel)
	common.SetContextKey(c, constant.ContextKeySmartRouterReason, reason)
	if strategy != "" {
		common.SetContextKey(c, constant.ContextKeySmartRouterStrategy, strategy)
	}

	c.Header("X-DeepRouter-Routed-Model", resolved)
	c.Header("X-DeepRouter-Routed-Reason", reason)
	if strategy != "" {
		c.Header("X-DeepRouter-Routed-Strategy", strategy)
	}

	return resolved
}
