package controller

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

// quotaDataQueryTimeout bounds the whole dashboard series request. Individual
// statements are already bounded by the segment length; this stops a saturated
// database from holding the HTTP handler open indefinitely.
const quotaDataQueryTimeout = 20 * time.Second

// parseQuotaDataRange enforces the shared dashboard range policy: an inverted
// range is rejected, and a span longer than the product bound is rejected
// instead of being silently truncated or allowed to scan without a limit.
func parseQuotaDataRange(c *gin.Context) (int64, int64, error) {
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	if err := common.ValidateDashboardRange(startTimestamp, endTimestamp); err != nil {
		return 0, 0, err
	}
	return startTimestamp, endTimestamp, nil
}

// writeQuotaDataError keeps the legacy 200 + success:false envelope these
// handlers have always used, while adding a stable machine-readable code so
// both frontends can distinguish a range rejection, an overload and a timeout
// without string matching.
func writeQuotaDataError(c *gin.Context, err error) {
	code := "quota_data_query_failed"
	switch {
	case errors.Is(err, common.ErrDashboardRangeTooLarge):
		code = "dashboard_range_too_large"
	case errors.Is(err, common.ErrDashboardRangeInverted), errors.Is(err, common.ErrDashboardRangeInvalid):
		code = "dashboard_range_invalid"
	case errors.Is(err, model.ErrQuotaDataTooManyRows):
		code = "dashboard_rows_overflow"
	case errors.Is(err, context.DeadlineExceeded), errors.Is(err, context.Canceled):
		code = "dashboard_query_timeout"
	}
	c.JSON(http.StatusOK, gin.H{
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
