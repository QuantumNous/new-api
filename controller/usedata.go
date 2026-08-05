package controller

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

// quotaDataQueryTimeout bounds the whole dashboard series request. Individual
// statements are already bounded by the segment length; this stops a saturated
// database from holding the HTTP handler open indefinitely.
const quotaDataQueryTimeout = 20 * time.Second

// parseQuotaDataTimestamp reads one mandatory bound.
//
// It never coerces a parse failure to zero. A missing, empty, non-numeric, or
// out-of-int64-range value is an invalid request, not "no filter": coercing it
// to 0 would silently produce a degenerate or unbounded window depending on the
// other bound. Zero and negative values are rejected for the same reason.
func parseQuotaDataTimestamp(c *gin.Context, name string) (int64, error) {
	raw := strings.TrimSpace(c.Query(name))
	if raw == "" {
		return 0, common.ErrDashboardRangeInvalid
	}
	value, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || value <= 0 {
		return 0, common.ErrDashboardRangeInvalid
	}
	return value, nil
}

// parseQuotaDataRange enforces the shared dashboard range policy: both bounds
// are mandatory and must parse, an inverted range is rejected, and a span
// longer than the product bound is rejected instead of being silently
// truncated or allowed to scan without a limit.
func parseQuotaDataRange(c *gin.Context) (int64, int64, error) {
	startTimestamp, err := parseQuotaDataTimestamp(c, "start_timestamp")
	if err != nil {
		return 0, 0, err
	}
	endTimestamp, err := parseQuotaDataTimestamp(c, "end_timestamp")
	if err != nil {
		return 0, 0, err
	}
	if err := common.ValidateDashboardRange(startTimestamp, endTimestamp); err != nil {
		return 0, 0, err
	}
	return startTimestamp, endTimestamp, nil
}

// writeQuotaDataError reports a real HTTP status plus a stable machine-readable
// code. The dashboard series endpoints are a client-facing API boundary: a
// rejected range must be visible as 4xx so a caller cannot mistake it for an
// empty result set, and so a frontend can distinguish "no data in range" from
// "this query was refused".
func writeQuotaDataError(c *gin.Context, err error) {
	code := "quota_data_query_failed"
	status := http.StatusInternalServerError
	switch {
	case errors.Is(err, common.ErrDashboardRangeTooLarge):
		code, status = "dashboard_range_too_large", http.StatusBadRequest
	case errors.Is(err, common.ErrDashboardRangeInverted), errors.Is(err, common.ErrDashboardRangeInvalid):
		code, status = "dashboard_range_invalid", http.StatusBadRequest
	case errors.Is(err, model.ErrQuotaDataTooManyRows):
		code, status = "dashboard_rows_overflow", http.StatusBadRequest
	case errors.Is(err, context.DeadlineExceeded), errors.Is(err, context.Canceled):
		code, status = "dashboard_query_timeout", http.StatusGatewayTimeout
	}
	c.AbortWithStatusJSON(status, gin.H{
		"success": false,
		"message": err.Error(),
		"code":    code,
	})
}

func quotaDataQueryContext(c *gin.Context) (context.Context, context.CancelFunc) {
	return context.WithTimeout(c.Request.Context(), quotaDataQueryTimeout)
}

func GetAllQuotaDates(c *gin.Context) {
	startTimestamp, endTimestamp, err := parseQuotaDataRange(c)
	if err != nil {
		writeQuotaDataError(c, err)
		return
	}
	username := c.Query("username")
	queryContext, cancel := quotaDataQueryContext(c)
	defer cancel()
	dates, err := model.GetAllQuotaDates(queryContext, startTimestamp, endTimestamp, username)
	if err != nil {
		writeQuotaDataError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    dates,
	})
}

func GetQuotaDatesByUser(c *gin.Context) {
	startTimestamp, endTimestamp, err := parseQuotaDataRange(c)
	if err != nil {
		writeQuotaDataError(c, err)
		return
	}
	queryContext, cancel := quotaDataQueryContext(c)
	defer cancel()
	dates, err := model.GetQuotaDataGroupByUser(queryContext, startTimestamp, endTimestamp)
	if err != nil {
		writeQuotaDataError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    dates,
	})
}

func GetUserQuotaDates(c *gin.Context) {
	// The user id comes from the authenticated session, never from the query, so
	// a normal user can only ever read their own series.
	userId := c.GetInt("id")
	startTimestamp, endTimestamp, err := parseQuotaDataRange(c)
	if err != nil {
		writeQuotaDataError(c, err)
		return
	}
	queryContext, cancel := quotaDataQueryContext(c)
	defer cancel()
	dates, err := model.GetQuotaDataByUserId(queryContext, userId, startTimestamp, endTimestamp)
	if err != nil {
		writeQuotaDataError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    dates,
	})
}
