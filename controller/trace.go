package controller

import (
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// GetTraceLogs returns logs for an AxonHub-style trace_id (admin).
// GET /api/log/trace/:trace_id
func GetTraceLogs(c *gin.Context) {
	traceId := strings.TrimSpace(c.Param("trace_id"))
	if traceId == "" {
		traceId = strings.TrimSpace(c.Query("trace_id"))
	}
	if traceId == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "trace_id required"})
		return
	}
	logs, err := model.GetLogsByTraceId(traceId, 200)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}
	// strip nothing extra for admin; ensure Other is parseable map for UI
	items := make([]gin.H, 0, len(logs))
	for _, l := range logs {
		if l == nil {
			continue
		}
		other, _ := common.StrToMap(l.Other)
		traceId := l.TraceId
		if traceId == "" {
			traceId, _ = other["trace_id"].(string)
		}
		items = append(items, gin.H{
			"id":         l.Id,
			"created_at": l.CreatedAt,
			"type":       l.Type,
			"model_name": l.ModelName,
			"channel":    l.ChannelId,
			"token_name": l.TokenName,
			"quota":      l.Quota,
			"use_time":   l.UseTime,
			"is_stream":  l.IsStream,
			"group":      l.Group,
			"request_id": l.RequestId,
			"content":    l.Content,
			"other":      other,
			"thread_id":  other["thread_id"],
			"trace_id":   traceId,
		})
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"trace_id": traceId,
			"count":    len(items),
			"logs":     items,
		},
	})
}
