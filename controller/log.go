package controller

import (
	"net/http"
	"one-api/common"
	"one-api/model"
	"strconv"
	"fmt"
	"time"
	"encoding/csv"
	"bytes"

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
	logs, total, err := model.GetAllLogs(logType, startTimestamp, endTimestamp, modelName, username, tokenName, pageInfo.GetStartIdx(), pageInfo.GetPageSize(), channel, group)
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
	logs, total, err := model.GetUserLogs(userId, logType, startTimestamp, endTimestamp, modelName, tokenName, pageInfo.GetStartIdx(), pageInfo.GetPageSize(), group)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(logs)
	common.ApiSuccess(c, pageInfo)
	return
}

func SearchAllLogs(c *gin.Context) {
	keyword := c.Query("keyword")
	logs, err := model.SearchAllLogs(keyword)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    logs,
	})
	return
}

func SearchUserLogs(c *gin.Context) {
	keyword := c.Query("keyword")
	userId := c.GetInt("id")
	logs, err := model.SearchUserLogs(userId, keyword)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    logs,
	})
	return
}

func GetLogByKey(c *gin.Context) {
	key := c.Query("key")
	logs, err := model.GetLogByKey(key)
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
	stat := model.SumUsedQuota(logType, startTimestamp, endTimestamp, modelName, username, tokenName, channel, group)
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
	channel, _ := strconv.Atoi(c.Query("channel"))
	group := c.Query("group")
	quotaNum := model.SumUsedQuota(logType, startTimestamp, endTimestamp, modelName, username, tokenName, channel, group)
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

// DownloadAllLogs 下载所有日志（管理员）
func DownloadAllLogs(c *gin.Context) {
	logType, _ := strconv.Atoi(c.Query("type"))
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	username := c.Query("username")
	tokenName := c.Query("token_name")
	modelName := c.Query("model_name")
	channel, _ := strconv.Atoi(c.Query("channel"))
	group := c.Query("group")
	format := c.DefaultQuery("format", "csv") // 支持csv格式

	// 获取所有匹配的日志数据（不分页）
	logs, err := model.GetAllLogsForDownload(logType, startTimestamp, endTimestamp, modelName, username, tokenName, channel, group)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	if format == "csv" {
		generateCSVResponse(c, logs, "all_logs")
	} else {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Unsupported format. Only CSV is supported currently.",
		})
	}
}

// DownloadUserLogs 下载用户日志
func DownloadUserLogs(c *gin.Context) {
	userId := c.GetInt("id")
	logType, _ := strconv.Atoi(c.Query("type"))
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	tokenName := c.Query("token_name")
	modelName := c.Query("model_name")
	group := c.Query("group")
	format := c.DefaultQuery("format", "csv")

	// 获取用户的所有匹配日志数据（不分页）
	logs, err := model.GetUserLogsForDownload(userId, logType, startTimestamp, endTimestamp, modelName, tokenName, group)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	if format == "csv" {
		generateCSVResponse(c, logs, fmt.Sprintf("user_%d_logs", userId))
	} else {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Unsupported format. Only CSV is supported currently.",
		})
	}
}

// generateCSVResponse 生成CSV响应
func generateCSVResponse(c *gin.Context, logs []*model.Log, filename string) {
	var buf bytes.Buffer
	writer := csv.NewWriter(&buf)

	// 写入CSV头部
	headers := []string{
		"ID", "用户ID", "用户名", "创建时间", "类型", "内容", "令牌名称",
		"模型名称", "配额", "提示词Token", "完成Token", "使用时间(秒)",
		"是否流式", "渠道ID", "渠道名称", "令牌ID", "用户组", "IP地址", "其他信息",
	}
	if err := writer.Write(headers); err != nil {
		common.ApiError(c, err)
		return
	}

	// 写入数据行
	for _, log := range logs {
		// 转换时间戳为可读格式
		createdTime := time.Unix(log.CreatedAt, 0).Format("2006-01-02 15:04:05")

		// 转换日志类型为可读文本
		logTypeStr := getLogTypeString(log.Type)

		row := []string{
			strconv.Itoa(log.Id),
			strconv.Itoa(log.UserId),
			log.Username,
			createdTime,
			logTypeStr,
			log.Content,
			log.TokenName,
			log.ModelName,
			strconv.Itoa(log.Quota),
			strconv.Itoa(log.PromptTokens),
			strconv.Itoa(log.CompletionTokens),
			strconv.Itoa(log.UseTime),
			strconv.FormatBool(log.IsStream),
			strconv.Itoa(log.ChannelId),
			log.ChannelName,
			strconv.Itoa(log.TokenId),
			log.Group,
			log.Ip,
			log.Other,
		}
		if err := writer.Write(row); err != nil {
			common.ApiError(c, err)
			return
		}
	}

	writer.Flush()
	if err := writer.Error(); err != nil {
		common.ApiError(c, err)
		return
	}

	// 设置响应头
	currentTime := time.Now().Format("20060102_150405")
	downloadFilename := fmt.Sprintf("%s_%s.csv", filename, currentTime)

	c.Header("Content-Description", "File Transfer")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", downloadFilename))
	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Expires", "0")
	c.Header("Cache-Control", "must-revalidate")
	c.Header("Pragma", "public")

	// 添加BOM以支持Excel正确显示中文
	c.Writer.WriteString("\xEF\xBB\xBF")
	c.Writer.Write(buf.Bytes())
}

// getLogTypeString 将日志类型转换为可读字符串
func getLogTypeString(logType int) string {
	switch logType {
	case model.LogTypeUnknown:
		return "未知"
	case model.LogTypeTopup:
		return "充值"
	case model.LogTypeConsume:
		return "消费"
	case model.LogTypeManage:
		return "管理"
	case model.LogTypeSystem:
		return "系统"
	case model.LogTypeError:
		return "错误"
	default:
		return "未知"
	}
}
