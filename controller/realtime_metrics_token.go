package controller

import (
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

// tokenRealtimeDenied is what an expired or exhausted key gets. TokenAuthReadOnly
// lets those through for read-only endpoints, so the expiry check lives here
// rather than changing that gate's semantics for its other callers.
func tokenRealtimeDenied(c *gin.Context) bool {
	// The middleware already resolved the token's id; re-reading it by key
	// costs one cache/DB hit per poll, but this endpoint is minuted-rate, not
	// hot-path, and its visibility rules must not trust a stale Redis ring
	// writer either.
	if raw := c.GetInt("token_id"); raw > 0 {
		token, err := model.GetTokenById(raw)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"message": "invalid token",
			})
			return true
		}
		if token.ExpiredTime != -1 && token.ExpiredTime < common.GetTimestamp() {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"message": "token expired",
			})
			return true
		}
		if !token.UnlimitedQuota && token.RemainQuota <= 0 {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"message": "token exhausted",
			})
			return true
		}
	}
	return false
}

// GetTokenRealtimeMetrics is the API-key counterpart of
// GetSelfRealtimeMetrics: the same realtime rings and response shape, but
// authenticated with the sk- token instead of the dashboard session, so
// integrations can poll RPM / TPM / concurrency from their own scripts.
//
// TokenAuthReadOnly puts the owning user's id into the context, so the user id
// is still never caller-supplied and the endpoint stays inside one account's
// data. The response is the account-level snapshot by default, matching the
// session route; an optional token_id query narrows it to one key, and a
// non-owner id would simply match nothing because the filter is applied inside
// this user's own rings. Or one model via the model parameter.
func GetTokenRealtimeMetrics(c *gin.Context) {
	userId := c.GetInt("id")
	if tokenRealtimeDenied(c) {
		return
	}
	filter, ok := parseRealtimeFilter(c)
	if !ok {
		return
	}
	snapshot := model.GetRealtimeSnapshotFiltered(userId, filter)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    snapshot,
	})
}

// GetTokenRealtimeKeyBreakdown reports the account's realtime throughput
// split by key: the same windows the snapshot endpoint returns, one row per
// key with live traffic in the retention window. Auth, expiry and exhaustion
// checks are identical to the snapshot endpoint, and the breakdown only ever
// covers the caller's own account because TokenAuthReadOnly derives the user
// id from the key itself.
func GetTokenRealtimeKeyBreakdown(c *gin.Context) {
	userId := c.GetInt("id")
	if tokenRealtimeDenied(c) {
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    model.GetRealtimeKeyBreakdowns(userId),
	})
}
