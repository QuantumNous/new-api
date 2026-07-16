package controller

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

// GetAuditLogs 审计检索（仅超管可见，详见研发任务卡 T8 检索页）。
// GET /api/audit?actor_id=&actor_name=&action=&target_type=&from=&to=&keyword=&p=&size=
// from/to 为 unix 秒；actor_id/actor_name/action/target_type/keyword 为可选过滤维度。
func GetAuditLogs(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)

	q := model.AuditLogQuery{
		ActorName:  c.Query("actor_name"),
		Action:     c.Query("action"),
		TargetType: c.Query("target_type"),
		Keyword:    c.Query("keyword"),
		From:       parseInt64(c.Query("from")),
		To:         parseInt64(c.Query("to")),
		StartIdx:   pageInfo.GetStartIdx(),
		PageSize:   pageInfo.GetPageSize(),
	}
	if v := c.Query("actor_id"); v != "" {
		if id, err := strconv.Atoi(v); err == nil {
			q.ActorId = id
		}
	}

	logs, total, err := model.SearchAuditLogs(q)
	if err != nil {
		common.SysLog("GetAuditLogs search failed: " + err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "检索失败"})
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(logs)
	common.ApiSuccess(c, pageInfo)
}

// parseInt64 解析 unix 秒时间戳；非法或空值返回 0（表示不限制该边界）。
func parseInt64(s string) int64 {
	if s == "" {
		return 0
	}
	v, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		return 0
	}
	return v
}
