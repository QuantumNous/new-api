package controller

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

// tryCrossModelFallback advances OriginModelName to the next entry in the
// smart-router-supplied fallback chain when the current model has exhausted
// all its channels. Returns the new model name and true if a swap happened,
// or "" and false when no chain is available or the chain is empty.
//
// Called from Relay()'s retry loop right after getChannel returns
// ErrorCodeGetChannelFailed. Side effects:
//
//   - relayInfo.OriginModelName is rewritten to the new model name.
//   - retryParam.ModelName is rewritten to the new model name.
//   - retryParam.Retry is reset to -1 so that the for-post IncreaseRetry()
//     advances it to 0, giving the new model a fresh retry budget.
//   - The fallback chain in ContextKeySmartRouterFallback is shifted, so a
//     subsequent exhaustion advances to the next entry.
//   - X-DeepRouter-Routed-Model response header is updated; clients see the
//     model that actually served the request.
//
// V0 limitations (documented for follow-up work):
//
//   - Pre-consume quota was computed for the original primary at Relay()
//     top; cross-model fallback does NOT refund and re-charge. For typical
//     auto-routing chains (haiku → gpt-4o-mini → ...) where prices are
//     similar this is acceptable; users near their quota cap may see
//     conservative pre-consume blocks.
func tryCrossModelFallback(c *gin.Context, relayInfo *relaycommon.RelayInfo, retryParam *service.RetryParam) (string, bool) {
	raw, ok := c.Get(string(constant.ContextKeySmartRouterFallback))
	if !ok {
		return "", false
	}
	chain, ok := raw.([]string)
	if !ok || len(chain) == 0 {
		return "", false
	}

	next := chain[0]
	c.Set(string(constant.ContextKeySmartRouterFallback), chain[1:])

	relayInfo.OriginModelName = next
	retryParam.ModelName = next
	retryParam.SetRetry(-1)

	c.Header("X-DeepRouter-Routed-Model", next)
	common.SetContextKey(c, constant.ContextKeyAliasResolvedFrom, "deeprouter-auto")
	return next, true
}

// isChannelExhaustionError reports whether the error returned by getChannel
// signals "no more channels left for this model" — the only error class
// that should trigger cross-model fallback. Other errors (panic, model
// price lookup failure, etc.) must surface to the caller unchanged.
func isChannelExhaustionError(err *types.NewAPIError) bool {
	if err == nil {
		return false
	}
	return err.GetErrorCode() == types.ErrorCodeGetChannelFailed
}
