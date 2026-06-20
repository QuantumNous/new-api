package middleware

// AirbotixPolicy resolves the per-tenant DeepRouter policy decision (kids_mode,
// PolicyProfile) for every /v1/* request and exposes it on the gin context for
// the relay handlers and the billing dispatcher to consult.
//
// Insertion point: in router/relay-router.go, right after middleware.TokenAuth()
// (which sets c.Set("id", token.UserId)) and before any handler that needs the
// decision.
//
// V0 accepts one extra DB read per /v1/* request: model.GetUserCache returns
// a trimmed UserBase that intentionally omits the 4 Airbotix columns, and we
// keep our diff out of model/user_cache.go per the upstream-divergence risk
// register (DeepRouter PLAN.md). If profiling later shows this is a hotspot,
// extend UserBase or add a parallel cache.

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/internal/policy"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

// userLookupFn is the signature of model.GetUserById, extracted so tests can
// inject a stub without a real database.
type userLookupFn func(id int, cache bool) (*model.User, error)

// AirbotixPolicy is the production middleware; it delegates to airbotixPolicyWith
// with the real DB lookup.
func AirbotixPolicy() gin.HandlerFunc {
	return airbotixPolicyWith(model.GetUserById)
}

// airbotixPolicyWith is the testable core: accepts an injected lookup so unit
// tests can simulate DB errors without a real database.
func airbotixPolicyWith(lookup userLookupFn) gin.HandlerFunc {
	return func(c *gin.Context) {
		userId := c.GetInt("id")
		if userId == 0 {
			c.Next()
			return
		}
		user, err := lookup(userId, false)
		if err != nil || user == nil {
			// Don't fail the request — fall through with a passthrough decision so
			// existing non-Airbotix traffic is unaffected on transient DB errors.
			if err != nil {
				logger.LogWarn(c, "airbotix policy: GetUserById failed: "+err.Error())
			}
			common.SetContextKey(c, constant.ContextKeyPolicyDecision, policy.DecisionFor(false, ""))
			c.Next()
			return
		}
		decision := policy.DecisionFor(user.KidsMode, user.PolicyProfile)
		common.SetContextKey(c, constant.ContextKeyPolicyDecision, decision)
		common.SetContextKey(c, constant.ContextKeyAirbotixUser, user)
		c.Next()
	}
}
