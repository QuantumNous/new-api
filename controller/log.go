package controller

import (
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/xuri/excelize/v2"

	"github.com/gin-gonic/gin"
)

func GetAllLogs(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	logType, _ := strconv.Atoi(c.Query("type"))
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	username := c.Query("username")
	tokenName := c.Query("token_name")
	modelName := c.Query("model_name")
	channel, _ := strconv.Atoi(c.Query("channel"))
	group := c.Query("group")
	requestId := c.Query("request_id")
	upstreamRequestId := c.Query("upstream_request_id")
	logs, total, err := model.GetAllLogs(logType, startTimestamp, endTimestamp, modelName, username, tokenName, pageInfo.GetStartIdx(), pageInfo.GetPageSize(), channel, group, requestId, upstreamRequestId)
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
	group := c.Query("group")
	requestId := c.Query("request_id")
	upstreamRequestId := c.Query("upstream_request_id")
	logs, total, err := model.GetUserLogs(userId, logType, startTimestamp, endTimestamp, modelName, tokenName, pageInfo.GetStartIdx(), pageInfo.GetPageSize(), group, requestId, upstreamRequestId)
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
	username := c.Query("username")
	modelName := c.Query("model_name")
	channel, _ := strconv.Atoi(c.Query("channel"))
	group := c.Query("group")
	stat, err := model.SumUsedQuota(logType, startTimestamp, endTimestamp, modelName, username, tokenName, channel, group)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	//tokenNum := model.SumUsedToken(logType, startTimestamp, endTimestamp, modelName, username, "")
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"quota": stat.Quota,
			"rpm":   stat.Rpm,
			"tpm":   stat.Tpm,
		},
	})
	return
}

func checkStatisticsUsername(c *gin.Context, username string) bool {
	role := c.GetInt("role")
	if role >= common.RoleAdminUser {
		return true
	}
	currentUsername := c.GetString("username")
	if username != currentUsername {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"message": "you can only query your own statistics",
		})
		return false
	}
	return true
}

func GetLogStatistics(c *gin.Context) {
	username := c.Query("username")
	if username == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "username is required",
		})
		return
	}
	if !checkStatisticsUsername(c, username) {
		return
	}
	tokenName := c.Query("token_name")
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	modelName := c.Query("model_name")

	models, err := model.GetLogStatistics(username, tokenName, startTimestamp, endTimestamp, modelName)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	trend, err := model.GetLogStatisticsTrend(username, tokenName, startTimestamp, endTimestamp, modelName)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"models": models,
			"trend":  trend,
		},
	})
}

func ExportLogStatistics(c *gin.Context) {
	username := c.Query("username")
	if username == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "username is required",
		})
		return
	}
	if !checkStatisticsUsername(c, username) {
		return
	}
	tokenName := c.Query("token_name")
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	modelName := c.Query("model_name")

	models, err := model.GetLogStatistics(username, tokenName, startTimestamp, endTimestamp, modelName)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	f := excelize.NewFile()
	defer func() { _ = f.Close() }()
	sheet := "Sheet1"

	// Build title: username-token_name-timeRange
	timeRange := ""
	if startTimestamp > 0 && endTimestamp > 0 {
		timeRange = fmt.Sprintf("%s ~ %s", time.Unix(startTimestamp, 0).Format("2006-01-02"), time.Unix(endTimestamp, 0).Format("2006-01-02"))
	}
	title := username
	if tokenName != "" {
		title += "-" + tokenName
	}
	if timeRange != "" {
		title += "-" + timeRange
	}
	_ = f.SetCellValue(sheet, "A1", title)

	headers := []string{"模型名称", "调用次数", "消耗额度($)", "Prompt Tokens(M)", "Completion Tokens(M)", "总 Tokens(M)"}
	for i, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 2)
		_ = f.SetCellValue(sheet, cell, h)
	}

	var totalQuota, totalPrompt, totalCompletion, totalCount int64
	for i, m := range models {
		row := i + 3
		promptM := float64(m.PromptTokens) / 1_000_000
		completionM := float64(m.CompletionTokens) / 1_000_000
		totalM := float64(m.PromptTokens+m.CompletionTokens) / 1_000_000
		quotaUSD := float64(m.Quota) / float64(common.QuotaPerUnit)
		_ = f.SetCellValue(sheet, fmt.Sprintf("A%d", row), m.ModelName)
		_ = f.SetCellValue(sheet, fmt.Sprintf("B%d", row), m.RequestCount)
		_ = f.SetCellValue(sheet, fmt.Sprintf("C%d", row), quotaUSD)
		_ = f.SetCellValue(sheet, fmt.Sprintf("D%d", row), promptM)
		_ = f.SetCellValue(sheet, fmt.Sprintf("E%d", row), completionM)
		_ = f.SetCellValue(sheet, fmt.Sprintf("F%d", row), totalM)
		totalQuota += m.Quota
		totalPrompt += m.PromptTokens
		totalCompletion += m.CompletionTokens
		totalCount += m.RequestCount
	}
	summaryRow := len(models) + 3
	totalQuotaUSD := float64(totalQuota) / float64(common.QuotaPerUnit)
	totalPromptM := float64(totalPrompt) / 1_000_000
	totalCompletionM := float64(totalCompletion) / 1_000_000
	totalTM := float64(totalPrompt+totalCompletion) / 1_000_000
	_ = f.SetCellValue(sheet, fmt.Sprintf("A%d", summaryRow), "合计")
	_ = f.SetCellValue(sheet, fmt.Sprintf("B%d", summaryRow), totalCount)
	_ = f.SetCellValue(sheet, fmt.Sprintf("C%d", summaryRow), totalQuotaUSD)
	_ = f.SetCellValue(sheet, fmt.Sprintf("D%d", summaryRow), totalPromptM)
	_ = f.SetCellValue(sheet, fmt.Sprintf("E%d", summaryRow), totalCompletionM)
	_ = f.SetCellValue(sheet, fmt.Sprintf("F%d", summaryRow), totalTM)

	buf, err := f.WriteToBuffer()
	if err != nil {
		common.ApiError(c, err)
		return
	}

	filename := title + ".xlsx"
	asciiFallback := url.PathEscape(filename)
	c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"; filename*=UTF-8''%s", asciiFallback, asciiFallback))
	c.Data(http.StatusOK, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buf.Bytes())
}

func GetLogsSelfStat(c *gin.Context) {
	username := c.GetString("username")
	logType, _ := strconv.Atoi(c.Query("type"))
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	tokenName := c.Query("token_name")
	modelName := c.Query("model_name")
	channel, _ := strconv.Atoi(c.Query("channel"))
	group := c.Query("group")
	quotaNum, err := model.SumUsedQuota(logType, startTimestamp, endTimestamp, modelName, username, tokenName, channel, group)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	//tokenNum := model.SumUsedToken(logType, startTimestamp, endTimestamp, modelName, username, tokenName)
	c.JSON(200, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"quota": quotaNum.Quota,
			"rpm":   quotaNum.Rpm,
			"tpm":   quotaNum.Tpm,
			//"token": tokenNum,
		},
	})
	return
}

func DeleteHistoryLogs(c *gin.Context) {
	targetTimestamp, _ := strconv.ParseInt(c.Query("target_timestamp"), 10, 64)
	if targetTimestamp == 0 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "target timestamp is required",
		})
		return
	}
	count, err := model.DeleteOldLog(c.Request.Context(), targetTimestamp, 100)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    count,
	})
	return
}

func GetStatisticsUserOptions(c *gin.Context) {
	keyword := c.Query("keyword")
	page, _ := strconv.Atoi(c.Query("p"))
	if page < 1 {
		page = 1
	}
	pageSize, _ := strconv.Atoi(c.Query("page_size"))
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	var usernames []string
	if keyword != "" {
		users, _, err := model.SearchUsers(keyword, "", (page-1)*pageSize, pageSize)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		for _, u := range users {
			usernames = append(usernames, u.Username)
		}
	} else {
		pageInfo := &common.PageInfo{Page: page, PageSize: pageSize}
		users, _, err := model.GetAllUsers(pageInfo)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		for _, u := range users {
			usernames = append(usernames, u.Username)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    usernames,
	})
}

func GetStatisticsTokenOptions(c *gin.Context) {
	role := c.GetInt("role")
	userId := c.GetInt("id")
	username := c.Query("username")

	if role < common.RoleAdminUser {
		username = c.GetString("username")
	}

	var user model.User
	if err := model.DB.Where("username = ?", username).First(&user).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data":    []any{},
			"has_more": false,
		})
		return
	}

	if role < common.RoleAdminUser && user.Id != userId {
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data":    []any{},
			"has_more": false,
		})
		return
	}

	keyword := c.Query("keyword")
	cursor, _ := strconv.Atoi(c.Query("cursor"))
	if cursor < 0 {
		cursor = 0
	}
	pageSize := 50

	query := model.DB.Where("user_id = ?", user.Id)
	if keyword != "" {
		query = query.Where("name LIKE ?", keyword+"%")
	}
	query = query.Where("id > ?", cursor).Order("id asc").Limit(pageSize + 1)

	var tokens []*model.Token
	if err := query.Find(&tokens).Error; err != nil {
		common.ApiError(c, err)
		return
	}

	hasMore := len(tokens) > pageSize
	if hasMore {
		tokens = tokens[:pageSize]
	}

	type tokenOption struct {
		Id   int    `json:"id"`
		Name string `json:"name"`
	}
	options := make([]tokenOption, 0, len(tokens))
	for _, t := range tokens {
		options = append(options, tokenOption{Id: t.Id, Name: t.Name})
	}

	nextCursor := 0
	if len(tokens) > 0 {
		nextCursor = tokens[len(tokens)-1].Id
	}

	c.JSON(http.StatusOK, gin.H{
		"success":     true,
		"data":        options,
		"has_more":    hasMore,
		"next_cursor": nextCursor,
	})
}

func GetStatisticsModelOptions(c *gin.Context) {
	username := c.Query("username")
	tokenName := c.Query("token_name")

	if username != "" && !checkStatisticsUsername(c, username) {
		return
	}

	if tokenName != "" && username != "" {
		var user model.User
		if err := model.DB.Where("username = ?", username).First(&user).Error; err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": true,
				"data":    model.GetEnabledModels(),
			})
			return
		}

		var token model.Token
		if err := model.DB.Where("user_id = ? AND name = ?", user.Id, tokenName).First(&token).Error; err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": true,
				"data":    model.GetEnabledModels(),
			})
			return
		}

		if token.IsModelLimitsEnabled() {
			limits := token.GetModelLimits()
			if len(limits) > 0 {
				enabledModels := model.GetEnabledModels()
				enabledMap := make(map[string]bool, len(enabledModels))
				for _, m := range enabledModels {
					enabledMap[m] = true
				}
				var result []string
				for _, m := range limits {
					if enabledMap[m] {
						result = append(result, m)
					}
				}
				if len(result) > 0 {
					c.JSON(http.StatusOK, gin.H{
						"success": true,
						"data":    result,
					})
					return
				}
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    model.GetEnabledModels(),
	})
}
