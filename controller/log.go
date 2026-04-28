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
	logs, total, err := model.GetAllLogs(logType, startTimestamp, endTimestamp, modelName, username, tokenName, pageInfo.GetStartIdx(), pageInfo.GetPageSize(), channel, group, requestId)
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
	logs, total, err := model.GetUserLogs(userId, logType, startTimestamp, endTimestamp, modelName, tokenName, pageInfo.GetStartIdx(), pageInfo.GetPageSize(), group, requestId)
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

func GetLogStatistics(c *gin.Context) {
	username := c.Query("username")
	if username == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "username is required",
		})
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
