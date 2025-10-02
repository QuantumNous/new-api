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
	"strings"

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
	columns := c.Query("columns") // 获取列选择参数

	// 获取所有匹配的日志数据（不分页）
	logs, err := model.GetAllLogsForDownload(logType, startTimestamp, endTimestamp, modelName, username, tokenName, channel, group)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	if format == "csv" {
		generateCSVResponse(c, logs, "all_logs", columns)
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
	columns := c.Query("columns") // 获取列选择参数

	// 获取用户的所有匹配日志数据（不分页）
	logs, err := model.GetUserLogsForDownload(userId, logType, startTimestamp, endTimestamp, modelName, tokenName, group)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	if format == "csv" {
		generateCSVResponse(c, logs, fmt.Sprintf("user_%d_logs", userId), columns)
	} else {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Unsupported format. Only CSV is supported currently.",
		})
	}
}

// generateCSVResponse 生成CSV响应
func generateCSVResponse(c *gin.Context, logs []*model.Log, filename string, columns string) {
	var buf bytes.Buffer
	writer := csv.NewWriter(&buf)

	// 定义完整的列映射，包括所有可能的列
	allColumns := map[string]string{
		"time":       "创建时间",
		"channel":    "渠道ID",
		"username":   "用户名",
		"token":      "令牌名称",
		"group":      "用户组",
		"type":       "类型",
		"model":      "模型名称",
		"use_time":   "使用时间(秒)",
		"prompt":     "提示词Token",
		"completion": "完成Token",
		"cost":       "配额",
		"usd_cost":   "花费($)",
		"retry":      "渠道名称",
		"ip":         "IP地址",
		"details":    "其他信息",
	}

	// 默认列（如果没有指定列）
	defaultColumns := []string{"time", "channel", "username", "token", "group", "type", "model", "use_time", "prompt", "completion", "cost", "usd_cost", "retry", "ip", "details"}

	// 解析选中的列
	var selectedColumns []string
	if columns != "" {
		selectedColumns = strings.Split(columns, ",")
	} else {
		selectedColumns = defaultColumns
	}

	// 过滤出有效的列
	var validColumns []string
	var headers []string
	for _, col := range selectedColumns {
		col = strings.TrimSpace(col)
		if headerName, exists := allColumns[col]; exists {
			validColumns = append(validColumns, col)
			headers = append(headers, headerName)
		}
	}

	// 如果没有有效列，使用默认列
	if len(validColumns) == 0 {
		for _, col := range defaultColumns {
			if headerName, exists := allColumns[col]; exists {
				validColumns = append(validColumns, col)
				headers = append(headers, headerName)
			}
		}
	}

	// 写入CSV头部
	if err := writer.Write(headers); err != nil {
		common.ApiError(c, err)
		return
	}

	// 写入数据行
	for _, log := range logs {
		var row []string

		for _, col := range validColumns {
			switch col {
			case "time":
				row = append(row, time.Unix(log.CreatedAt, 0).Format("2006-01-02 15:04:05"))
			case "channel":
				row = append(row, strconv.Itoa(log.ChannelId))
			case "username":
				row = append(row, log.Username)
			case "token":
				row = append(row, log.TokenName)
			case "group":
				row = append(row, log.Group)
			case "type":
				row = append(row, getLogTypeString(log.Type))
			case "model":
				row = append(row, log.ModelName)
			case "use_time":
				row = append(row, strconv.Itoa(log.UseTime))
			case "prompt":
				row = append(row, strconv.Itoa(log.PromptTokens))
			case "completion":
				row = append(row, strconv.Itoa(log.CompletionTokens))
			case "cost":
				row = append(row, strconv.Itoa(log.Quota))
			case "usd_cost":
				// 计算美元花费：配额除以QuotaPerUnit
				usdCost := float64(log.Quota) / common.QuotaPerUnit
				row = append(row, fmt.Sprintf("%.6f", usdCost))
			case "retry":
				row = append(row, log.ChannelName)
			case "ip":
				row = append(row, log.Ip)
			case "details":
				row = append(row, log.Other)
			}
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
