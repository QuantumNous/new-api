package controller

import (
	"encoding/csv"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

const maxLogExportRows int64 = 100000

func GetAllLogs(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	logType, _ := strconv.Atoi(c.Query("type"))
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	username := c.Query("username")
	tokenName := c.Query("token_name")
	modelName := c.Query("model_name")
	modelNameMode := c.Query("model_name_mode")
	channel, _ := strconv.Atoi(c.Query("channel"))
	group := c.Query("group")
	requestId := c.Query("request_id")
	upstreamRequestId := c.Query("upstream_request_id")
	logs, total, err := model.GetAllLogsWithModelNameMode(logType, startTimestamp, endTimestamp, modelName, modelNameMode, username, tokenName, pageInfo.GetStartIdx(), pageInfo.GetPageSize(), channel, group, requestId, upstreamRequestId)
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
	modelNameMode := c.Query("model_name_mode")
	group := c.Query("group")
	requestId := c.Query("request_id")
	upstreamRequestId := c.Query("upstream_request_id")
	logs, total, err := model.GetUserLogsWithModelNameMode(userId, logType, startTimestamp, endTimestamp, modelName, modelNameMode, tokenName, pageInfo.GetStartIdx(), pageInfo.GetPageSize(), group, requestId, upstreamRequestId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(logs)
	common.ApiSuccess(c, pageInfo)
	return
}

func ExportLogsCSV(c *gin.Context) {
	scope := strings.ToLower(strings.TrimSpace(c.DefaultQuery("scope", "all")))
	if scope != "all" && scope != "self" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid log export scope"})
		return
	}

	logType, _ := strconv.Atoi(c.Query("type"))
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	modelName := c.Query("model_name")
	modelNameMode := c.Query("model_name_mode")
	username := c.Query("username")
	tokenName := c.Query("token_name")
	channel, _ := strconv.Atoi(c.Query("channel"))
	group := c.Query("group")
	requestId := c.Query("request_id")
	upstreamRequestId := c.Query("upstream_request_id")

	filter := model.LogQueryFilter{
		LogType:           logType,
		StartTimestamp:    startTimestamp,
		EndTimestamp:      endTimestamp,
		ModelName:         modelName,
		ModelNameMode:     modelNameMode,
		Username:          username,
		TokenName:         tokenName,
		Channel:           channel,
		Group:             group,
		RequestId:         requestId,
		UpstreamRequestId: upstreamRequestId,
	}
	if scope == "self" {
		filter.UserId = c.GetInt("id")
		filter.UserIdFilter = true
		filter.Username = ""
		filter.Channel = 0
		if filter.UserId <= 0 {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "user authentication is required"})
			return
		}
	}

	writer := csv.NewWriter(c.Writer)
	started := false
	startCSV := func() error {
		if started {
			return nil
		}
		c.Header("Content-Type", "text/csv; charset=utf-8")
		c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="usage-logs-%s.csv"`, time.Now().UTC().Format("20060102-150405")))
		c.Header("Cache-Control", "no-store")
		c.Header("X-Content-Type-Options", "nosniff")
		started = true
		if _, err := c.Writer.Write([]byte{0xef, 0xbb, 0xbf}); err != nil {
			return err
		}
		if err := writer.Write([]string{
			"ID", "Created At (UTC)", "Type", "User ID", "Username", "Token Name", "Model Name", "Quota",
			"Prompt Tokens", "Completion Tokens", "Total Tokens", "Use Time (s)", "Stream", "Channel ID",
			"Token ID", "Group", "IP", "Request ID", "Upstream Request ID", "Content", "Other",
		}); err != nil {
			return err
		}
		return nil
	}

	rowCount := int64(0)
	var total int64
	var err error
	total, err = model.StreamLogsForExport(c.Request.Context(), filter, maxLogExportRows, func(log *model.Log) error {
		if err := startCSV(); err != nil {
			return err
		}
		record := []string{
			strconv.Itoa(log.Id),
			time.Unix(log.CreatedAt, 0).UTC().Format(time.RFC3339),
			strconv.Itoa(log.Type),
			strconv.Itoa(log.UserId),
			sanitizeCSVText(log.Username),
			sanitizeCSVText(log.TokenName),
			sanitizeCSVText(log.ModelName),
			strconv.Itoa(log.Quota),
			strconv.Itoa(log.PromptTokens),
			strconv.Itoa(log.CompletionTokens),
			strconv.Itoa(log.PromptTokens + log.CompletionTokens),
			strconv.Itoa(log.UseTime),
			strconv.FormatBool(log.IsStream),
			strconv.Itoa(log.ChannelId),
			strconv.Itoa(log.TokenId),
			sanitizeCSVText(log.Group),
			sanitizeCSVText(log.Ip),
			sanitizeCSVText(log.RequestId),
			sanitizeCSVText(log.UpstreamRequestId),
			sanitizeCSVText(log.Content),
			sanitizeCSVText(log.Other),
		}
		if err := writer.Write(record); err != nil {
			return err
		}
		rowCount++
		if rowCount%500 == 0 {
			writer.Flush()
			if err := writer.Error(); err != nil {
				return err
			}
			if flusher, ok := c.Writer.(http.Flusher); ok {
				flusher.Flush()
			}
		}
		return nil
	})
	if err != nil {
		if !started {
			switch {
			case errors.Is(err, model.ErrLogExportLimitExceeded):
				c.JSON(http.StatusRequestEntityTooLarge, gin.H{"success": false, "message": fmt.Sprintf("log export exceeds the %d row limit", maxLogExportRows), "total": total})
			case errors.Is(err, model.ErrInvalidLogFilter):
				c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
			default:
				common.SysError("failed to export logs: " + err.Error())
				c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "failed to export logs"})
			}
		} else {
			common.SysError("failed while streaming log export: " + err.Error())
		}
		return
	}

	if !started {
		if err := startCSV(); err != nil {
			common.SysError("failed to start log export: " + err.Error())
			return
		}
	}
	writer.Flush()
	if err := writer.Error(); err != nil {
		common.SysError("failed to flush log export: " + err.Error())
		return
	}
	if flusher, ok := c.Writer.(http.Flusher); ok {
		flusher.Flush()
	}
}

func sanitizeCSVText(value string) string {
	trimmed := strings.TrimLeft(value, " \t\r\n\uFEFF")
	if trimmed == "" {
		return value
	}
	switch trimmed[0] {
	case '=', '+', '-', '@':
		return "'" + value
	default:
		return value
	}
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
	modelNameMode := c.Query("model_name_mode")
	channel, _ := strconv.Atoi(c.Query("channel"))
	group := c.Query("group")
	stat, err := model.SumUsedQuotaWithModelNameMode(logType, startTimestamp, endTimestamp, modelName, modelNameMode, username, tokenName, channel, group)
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

func GetLogsSelfStat(c *gin.Context) {
	username := c.GetString("username")
	logType, _ := strconv.Atoi(c.Query("type"))
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	tokenName := c.Query("token_name")
	modelName := c.Query("model_name")
	modelNameMode := c.Query("model_name_mode")
	channel, _ := strconv.Atoi(c.Query("channel"))
	group := c.Query("group")
	quotaNum, err := model.SumUsedQuotaWithModelNameMode(logType, startTimestamp, endTimestamp, modelName, modelNameMode, username, tokenName, channel, group)
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
