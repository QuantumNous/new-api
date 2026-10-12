package controller

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

// realtimeDefaultWindowSeconds is the window used by the admin user list when
// the caller does not ask for a specific one.
const realtimeDefaultWindowSeconds = 60

// realtimeAllowedWindows bounds the admin window parameter. The model only
// keeps six hours, so anything beyond that would silently report a shorter span
// under a longer label.
var realtimeAllowedWindows = map[int64]bool{60: true, 300: true, 3600: true}

// realtimeMaxModelQueryLen bounds the model filter. The value only ever reaches
// a map lookup, but an unbounded query string has no reason to be accepted.
const realtimeMaxModelQueryLen = 64

// GetSelfRealtimeMetrics returns the calling user's own realtime throughput.
//
// The user id comes from the authenticated session, never from a parameter, so
// a user cannot read anyone else's numbers by editing the request. Admin access
// to other users goes through the AdminAuth-gated route below.
//
// token_id and model narrow the response to one key and/or model. They cannot
// widen it: the filter is applied inside this user's own rings, so naming
// another account's key matches nothing rather than leaking its traffic. That
// is why no ownership check is needed here — the user id is the outer
// constraint and it is not caller-supplied.
func GetSelfRealtimeMetrics(c *gin.Context) {
	userId := c.GetInt("id")
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

// GetSelfRealtimeDimensions lists the keys and models the calling user has
// realtime traffic for, so the client can populate its filters without guessing
// which of the user's keys are actually active.
func GetSelfRealtimeDimensions(c *gin.Context) {
	userId := c.GetInt("id")
	window := int64(realtimeDefaultWindowSeconds)
	if raw := c.Query("window_seconds"); raw != "" {
		parsed, err := strconv.ParseInt(raw, 10, 64)
		if err != nil || !realtimeAllowedWindows[parsed] {
			common.ApiErrorMsg(c, "invalid window_seconds")
			return
		}
		window = parsed
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    model.GetRealtimeDimensions(userId, window),
	})
}

// GetSelfRealtimeKeyBreakdown splits the calling user's realtime snapshot by
// key, the session-authenticated counterpart to the API-key route the relay
// client curls (/api/usage/realtime/keys). The dashboard runs on session auth,
// so it needs its own entry point into the same model function.
func GetSelfRealtimeKeyBreakdown(c *gin.Context) {
	userId := c.GetInt("id")
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    model.GetRealtimeKeyBreakdowns(userId),
	})
}

// parseRealtimeFilter reads the optional key / model filter from the query.
// It reports false after writing an error response when a value is malformed.
func parseRealtimeFilter(c *gin.Context) (model.RealtimeFilter, bool) {
	var filter model.RealtimeFilter
	if raw := c.Query("token_id"); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed <= 0 {
			common.ApiErrorMsg(c, "invalid token_id")
			return filter, false
		}
		filter.TokenID = parsed
	}
	if raw := c.Query("model"); raw != "" {
		if len(raw) > realtimeMaxModelQueryLen {
			common.ApiErrorMsg(c, "invalid model")
			return filter, false
		}
		filter.Model = raw
	}
	return filter, true
}

// GetRealtimeMetricsUsers returns per-user realtime throughput for every user
// this node has served recently. Admin only.
func GetRealtimeMetricsUsers(c *gin.Context) {
	window := int64(realtimeDefaultWindowSeconds)
	if raw := c.Query("window_seconds"); raw != "" {
		parsed, err := strconv.ParseInt(raw, 10, 64)
		if err != nil || !realtimeAllowedWindows[parsed] {
			common.ApiErrorMsg(c, "invalid window_seconds")
			return
		}
		window = parsed
	}

	summaries := model.GetRealtimeUserSummaries(window)
	model.FillRealtimeUsernames(summaries)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"window_seconds": window,
			"node_name":      common.NodeName,
			"now":            common.GetTimestamp(),
			"users":          summaries,
		},
	})
}

// GetRealtimeMetricsByUser returns one specific user's snapshot for an admin
// inspecting a support case.
func GetRealtimeMetricsByUser(c *gin.Context) {
	userId, err := strconv.Atoi(c.Param("id"))
	if err != nil || userId <= 0 {
		common.ApiErrorMsg(c, "invalid user id")
		return
	}
	snapshot := model.GetRealtimeSnapshot(userId)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    snapshot,
	})
}
