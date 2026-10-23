package controller

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

// getTeamUserIds builds the set [parentId, child1, child2, ...] for team queries.
// Returns (nil, false) if the caller is itself a child account (parent_id != 0).
func getTeamUserIds(c *gin.Context) ([]int, bool) {
	userId := c.GetInt("id")
	user, err := model.GetUserById(userId, false)
	if err != nil {
		common.ApiError(c, err)
		return nil, false
	}
	if user.ParentId != 0 {
		common.ApiErrorMsg(c, "子账号不能查看团队数据")
		return nil, false
	}
	children, err := model.GetUserChildren(userId)
	if err != nil {
		common.ApiError(c, err)
		return nil, false
	}
	ids := make([]int, 0, len(children)+1)
	ids = append(ids, userId)
	for _, ch := range children {
		ids = append(ids, ch.Id)
	}
	return ids, true
}

func GetAllLogs(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	logType, _ := strconv.Atoi(c.Query("type"))
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	keyword := c.Query("keyword")
	if keyword == "" {
		keyword = c.Query("username")
	}
	tokenName := c.Query("token_name")
	modelName := c.Query("model_name")
	channel, _ := strconv.Atoi(c.Query("channel"))
	group := c.Query("group")
	requestId := c.Query("request_id")
	upstreamRequestId := c.Query("upstream_request_id")
	logs, total, err := model.GetAllLogs(logType, startTimestamp, endTimestamp, modelName, keyword, tokenName, pageInfo.GetStartIdx(), pageInfo.GetPageSize(), channel, group, requestId, upstreamRequestId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(logs)
	common.ApiSuccess(c, pageInfo)
	return
}

func GetUserLogs(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	userId := c.GetInt("id")
	logType, _ := strconv.Atoi(c.Query("type"))
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	tokenName := c.Query("token_name")
	modelName := c.Query("model_name")
	keyword := c.Query("keyword")
	group := c.Query("group")
	requestId := c.Query("request_id")
	upstreamRequestId := c.Query("upstream_request_id")
	logs, total, err := model.GetUserLogs(userId, logType, startTimestamp, endTimestamp, modelName, keyword, tokenName, pageInfo.GetStartIdx(), pageInfo.GetPageSize(), group, requestId, upstreamRequestId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(logs)
	common.ApiSuccess(c, pageInfo)
	return
}

// Deprecated: SearchAllLogs 已废弃，前端未使用该接口。
func SearchAllLogs(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"success": false,
		"message": "该接口已废弃",
	})
}

// Deprecated: SearchUserLogs 已废弃，前端未使用该接口。
func SearchUserLogs(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"success": false,
		"message": "该接口已废弃",
	})
}

func GetLogByKey(c *gin.Context) {
	tokenId := c.GetInt("token_id")
	if tokenId == 0 {
		c.JSON(200, gin.H{
			"success": false,
			"message": "无效的令牌",
		})
		return
	}
	logs, err := model.GetLogByTokenId(tokenId)
	if err != nil {
		c.JSON(200, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	c.JSON(200, gin.H{
		"success": true,
		"message": "",
		"data":    logs,
	})
}

func GetLogsStat(c *gin.Context) {
	logType, _ := strconv.Atoi(c.Query("type"))
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	tokenName := c.Query("token_name")
	keyword := c.Query("keyword")
	if keyword == "" {
		keyword = c.Query("username")
	}
	modelName := c.Query("model_name")
	channel, _ := strconv.Atoi(c.Query("channel"))
	group := c.Query("group")
	stat, err := model.SumUsedQuota(logType, startTimestamp, endTimestamp, modelName, keyword, tokenName, channel, group, 0)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	//tokenNum := model.SumUsedToken(logType, startTimestamp, endTimestamp, modelName, username, "")
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"quota":                   stat.Quota,
			"rpm":                     stat.Rpm,
			"tpm":                     stat.Tpm,
			"cache_input_tokens":      stat.CacheInputTokens,
			"cache_read_tokens":       stat.CacheReadTokens,
			"cache_write_tokens":      stat.CacheWriteTokens,
			"cache_hit_requests":      stat.CacheHitRequests,
			"cache_eligible_requests": stat.CacheEligibleRequests,
			"cache_hit_rate":          stat.CacheHitRate,
		},
	})
	return
}

func GetTeamLogs(c *gin.Context) {
	userIds, ok := getTeamUserIds(c)
	if !ok {
		return
	}
	pageInfo := common.GetPageQuery(c)
	logType, _ := strconv.Atoi(c.Query("type"))
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	tokenName := c.Query("token_name")
	modelName := c.Query("model_name")
	keyword := c.Query("keyword")
	group := c.Query("group")
	requestId := c.Query("request_id")
	upstreamRequestId := c.Query("upstream_request_id")
	logs, total, err := model.GetTeamLogs(userIds, logType, startTimestamp, endTimestamp, modelName, keyword, tokenName, pageInfo.GetStartIdx(), pageInfo.GetPageSize(), group, requestId, upstreamRequestId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(logs)
	common.ApiSuccess(c, pageInfo)
}

func GetTeamLogsStat(c *gin.Context) {
	userIds, ok := getTeamUserIds(c)
	if !ok {
		return
	}
	logType, _ := strconv.Atoi(c.Query("type"))
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	tokenName := c.Query("token_name")
	modelName := c.Query("model_name")
	group := c.Query("group")
	stat, err := model.SumTeamUsedQuota(userIds, logType, startTimestamp, endTimestamp, modelName, tokenName, group)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"quota":                   stat.Quota,
			"rpm":                     stat.Rpm,
			"tpm":                     stat.Tpm,
			"cache_input_tokens":      stat.CacheInputTokens,
			"cache_read_tokens":       stat.CacheReadTokens,
			"cache_write_tokens":      stat.CacheWriteTokens,
			"cache_hit_requests":      stat.CacheHitRequests,
			"cache_eligible_requests": stat.CacheEligibleRequests,
			"cache_hit_rate":          stat.CacheHitRate,
		},
	})
}

func GetLogsSelfStat(c *gin.Context) {
	userId := c.GetInt("id")
	logType, _ := strconv.Atoi(c.Query("type"))
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	tokenName := c.Query("token_name")
	modelName := c.Query("model_name")
	keyword := c.Query("keyword")
	channel, _ := strconv.Atoi(c.Query("channel"))
	group := c.Query("group")
	quotaNum, err := model.SumUsedQuota(logType, startTimestamp, endTimestamp, modelName, keyword, tokenName, channel, group, userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	//tokenNum := model.SumUsedToken(logType, startTimestamp, endTimestamp, modelName, username, tokenName)
	c.JSON(200, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"quota":                   quotaNum.Quota,
			"rpm":                     quotaNum.Rpm,
			"tpm":                     quotaNum.Tpm,
			"cache_input_tokens":      quotaNum.CacheInputTokens,
			"cache_read_tokens":       quotaNum.CacheReadTokens,
			"cache_write_tokens":      quotaNum.CacheWriteTokens,
			"cache_hit_requests":      quotaNum.CacheHitRequests,
			"cache_eligible_requests": quotaNum.CacheEligibleRequests,
			"cache_hit_rate":          quotaNum.CacheHitRate,
			//"token": tokenNum,
		},
	})
	return
}
