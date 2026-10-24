package controller

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

func parseFlowQuotaTimeRange(c *gin.Context) (int64, int64, bool) {
	startTimestamp, err := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	if err != nil || startTimestamp <= 0 {
		common.ApiErrorMsg(c, "invalid start_timestamp")
		return 0, 0, false
	}
	endTimestamp, err := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	if err != nil || endTimestamp <= 0 {
		common.ApiErrorMsg(c, "invalid end_timestamp")
		return 0, 0, false
	}
	if endTimestamp < startTimestamp {
		common.ApiErrorMsg(c, "invalid time range")
		return 0, 0, false
	}
	return startTimestamp, endTimestamp, true
}

func GetAllQuotaDates(c *gin.Context) {
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	username := c.Query("username")
	tokenName := c.Query("token_name")
	modelName := c.Query("model_name")
	dates, err := model.GetAllQuotaDates(startTimestamp, endTimestamp, username, tokenName, modelName)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    dates,
	})
	return
}

func GetQuotaDatesByUser(c *gin.Context) {
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	tokenName := c.Query("token_name")
	modelName := c.Query("model_name")
	dates, err := model.GetQuotaDataGroupByUser(startTimestamp, endTimestamp, tokenName, modelName)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    dates,
	})
}

// GetAdminQuotaDataDimensions serves the dashboard quick-filter dropdowns: the
// key names and models that have consumption. Reads the pre-aggregated
// quota_data_dimensions table maintained by the quota flush loop, so response
// time is independent of quota_data size. Time-range parameters are accepted
// but ignored for compatibility with older frontends.
func GetAdminQuotaDataDimensions(c *gin.Context) {
	dims, err := model.GetQuotaDataDimensionsFast(0)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    dims,
	})
}

func GetSelfQuotaDataDimensions(c *gin.Context) {
	userId := c.GetInt("id")
	dims, err := model.GetQuotaDataDimensionsFast(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    dims,
	})
}

func GetTeamQuotaDates(c *gin.Context) {
	userIds, ok := getTeamUserIds(c)
	if !ok {
		return
	}
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	if endTimestamp-startTimestamp > 2592000 {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "时间跨度不能超过 1 个月"})
		return
	}
	tokenName := c.Query("token_name")
	modelName := c.Query("model_name")
	dates, err := model.GetQuotaDataByUserIds(userIds, startTimestamp, endTimestamp, tokenName, modelName)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": dates})
}

func GetUserQuotaDates(c *gin.Context) {
	userId := c.GetInt("id")
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	// 判断时间跨度是否超过 1 个月
	if endTimestamp-startTimestamp > 2592000 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "时间跨度不能超过 1 个月",
		})
		return
	}
	tokenName := c.Query("token_name")
	modelName := c.Query("model_name")
	dates, err := model.GetQuotaDataByUserId(userId, startTimestamp, endTimestamp, tokenName, modelName)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    dates,
	})
	return
}

func GetAllFlowQuotaDates(c *gin.Context) {
	startTimestamp, endTimestamp, ok := parseFlowQuotaTimeRange(c)
	if !ok {
		return
	}
	username := c.Query("username")
	dates, err := model.GetFlowQuotaData(startTimestamp, endTimestamp, username, 0, c.GetInt("role"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    dates,
	})
	return
}

func GetUserFlowQuotaDates(c *gin.Context) {
	userId := c.GetInt("id")
	startTimestamp, endTimestamp, ok := parseFlowQuotaTimeRange(c)
	if !ok {
		return
	}
	if endTimestamp-startTimestamp > 2592000 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "时间跨度不能超过 1 个月",
		})
		return
	}
	dates, err := model.GetFlowQuotaData(startTimestamp, endTimestamp, "", userId, common.RoleCommonUser)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    dates,
	})
	return
}

// tokenUsageMaxSpanSeconds bounds how far back the per-key spend listing can
// reach. The ranking is meant for dashboards (month-to-date, last N days); an
// unbounded range would let one request scan the whole quota_data table.
const tokenUsageMaxSpanSeconds = int64(366 * 86400)

// parseTokenUsageRange validates the ranking's time window.
func parseTokenUsageRange(c *gin.Context) (int64, int64, bool) {
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	if startTimestamp <= 0 || endTimestamp <= 0 || endTimestamp < startTimestamp {
		common.ApiErrorMsg(c, "invalid time range")
		return 0, 0, false
	}
	if endTimestamp-startTimestamp > tokenUsageMaxSpanSeconds {
		common.ApiErrorMsg(c, "time span too large")
		return 0, 0, false
	}
	return startTimestamp, endTimestamp, true
}

// parseTokenUsageLimit reads the optional row cap, clamped to sane values.
func parseTokenUsageLimit(c *gin.Context) int {
	limit, _ := strconv.Atoi(c.Query("limit"))
	if limit <= 0 || limit > 500 {
		return 100
	}
	return limit
}

// GetAdminTokenUsage serves the dashboard's per-key spend ranking across all
// users. username/token_name/model_name narrow it like every other /api/data
// query; rows are ordered by spend and capped.
func GetAdminTokenUsage(c *gin.Context) {
	startTimestamp, endTimestamp, ok := parseTokenUsageRange(c)
	if !ok {
		return
	}
	rows, err := model.GetTokenUsageRanking(startTimestamp, endTimestamp, 0,
		c.Query("username"), c.Query("token_name"), c.Query("model_name"),
		parseTokenUsageLimit(c))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    rows,
	})
}

// GetSelfTokenUsage is the per-key spend ranking for the session account.
// Like the other self data routes the user id comes from the session, never
// from a parameter.
func GetSelfTokenUsage(c *gin.Context) {
	startTimestamp, endTimestamp, ok := parseTokenUsageRange(c)
	if !ok {
		return
	}
	if endTimestamp-startTimestamp > 2592000 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "时间跨度不能超过 1 个月",
		})
		return
	}
	rows, err := model.GetTokenUsageRanking(startTimestamp, endTimestamp, c.GetInt("id"),
		"", c.Query("token_name"), c.Query("model_name"),
		parseTokenUsageLimit(c))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    rows,
	})
}

// GetTeamSummaryStats returns the aggregate used_quota and request_count for
// the caller's team. Children's consumption is counted only for periods when
// they were bound to this parent (tracked in user_parent_bindings). Only
// callable by a parent account (parent_id = 0, has children).
func GetTeamSummaryStats(c *gin.Context) {
	// Validate caller is a parent account (reuse getTeamUserIds for the check).
	_, ok := getTeamUserIds(c)
	if !ok {
		return
	}
	parentId := c.GetInt("id")
	usedQuota, requestCount, err := model.GetTeamUsageSummaryByBindings(parentId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"used_quota":    usedQuota,
			"request_count": requestCount,
		},
	})
}
