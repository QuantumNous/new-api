package controller

import (
	"encoding/csv"
	"fmt"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

const maxExportRows = 10000

func ExportAllLogs(c *gin.Context) {
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

	logs, _, err := model.GetAllLogs(logType, startTimestamp, endTimestamp, modelName, username, tokenName, 0, maxExportRows, channel, group, requestId, upstreamRequestId)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	if c.GetInt("role") < common.RoleRootUser {
		model.FormatAdminLogs(logs)
	} else {
		model.FormatRootLogs(logs)
	}

	writeLogsCSV(c, "logs_export", logs, true)
}

func ExportUserLogs(c *gin.Context) {
	userId := c.GetInt("id")
	logType, _ := strconv.Atoi(c.Query("type"))
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	tokenName := c.Query("token_name")
	modelName := c.Query("model_name")
	group := c.Query("group")
	requestId := c.Query("request_id")
	upstreamRequestId := c.Query("upstream_request_id")

	logs, _, err := model.GetUserLogs(userId, logType, startTimestamp, endTimestamp, modelName, tokenName, 0, maxExportRows, group, requestId, upstreamRequestId)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	writeLogsCSV(c, "my_logs_export", logs, false)
}

func writeLogsCSV(c *gin.Context, prefix string, logs []*model.Log, includeAdmin bool) {
	filename := fmt.Sprintf("%s_%s.csv", prefix, time.Now().Format("20060102_150405"))
	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))

	// UTF-8 BOM for Excel compatibility
	c.Writer.Write([]byte{0xEF, 0xBB, 0xBF})

	w := csv.NewWriter(c.Writer)
	defer w.Flush()

	if includeAdmin {
		w.Write([]string{"ID", "时间", "用户名", "令牌名称", "模型名称", "类型", "内容", "提示Token", "完成Token", "额度", "渠道ID", "渠道名称", "分组", "IP", "请求ID", "上游请求ID"})
	} else {
		w.Write([]string{"ID", "时间", "令牌名称", "模型名称", "类型", "内容", "提示Token", "完成Token", "额度", "分组", "请求ID", "上游请求ID"})
	}

	for _, log := range logs {
		row := []string{
			strconv.Itoa(log.Id),
			formatExportTimestamp(log.CreatedAt),
		}
		if includeAdmin {
			row = append(row, log.Username)
		}
		row = append(row,
			log.TokenName,
			log.ModelName,
			logTypeName(log.Type),
			log.Content,
			strconv.Itoa(log.PromptTokens),
			strconv.Itoa(log.CompletionTokens),
			strconv.Itoa(log.Quota),
		)
		if includeAdmin {
			row = append(row, strconv.Itoa(log.ChannelId), log.ChannelName)
		}
		row = append(row, log.Group)
		if includeAdmin {
			row = append(row, log.Ip)
		}
		row = append(row, log.RequestId, log.UpstreamRequestId)
		w.Write(row)
	}
}

func formatExportTimestamp(ts int64) string {
	if ts == 0 {
		return ""
	}
	return time.Unix(ts, 0).Format("2006-01-02 15:04:05")
}

func logTypeName(t int) string {
	switch t {
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
	case model.LogTypeRefund:
		return "退款"
	case model.LogTypeLogin:
		return "登录"
	default:
		return "未知"
	}
}
