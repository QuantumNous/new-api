package controller

import (
	"net/http"
	"path"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/service/mediastore"

	"github.com/gin-gonic/gin"
)

// GetSelfTaskDownloadURL 用户下载自己的任务成品：带友好文件名的下载 URL（§5.6）。
// 按 user_id 限定，用户只能下自己的。
func GetSelfTaskDownloadURL(c *gin.Context) {
	taskID := c.Param("id")
	if taskID == "" {
		common.ApiErrorMsg(c, "task_id is required")
		return
	}
	userID := c.GetInt("id")
	task, exists, err := model.GetByTaskId(userID, taskID)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	respondTaskDownloadURL(c, task, exists)
}

// GetTaskDownloadURL admin 下载任意用户的任务成品（后台「全部任务」列表用）。
// 走 AdminAuth 中间件，按 task_id 查、不限 user；否则 admin 预览别人的任务却下不了（Codex P2）。
func GetTaskDownloadURL(c *gin.Context) {
	taskID := c.Param("id")
	if taskID == "" {
		common.ApiErrorMsg(c, "task_id is required")
		return
	}
	task, exists, err := model.GetByOnlyTaskId(taskID)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	respondTaskDownloadURL(c, task, exists)
}

// respondTaskDownloadURL 对 OBS 对象签一个带 response-content-disposition 的 URL（浏览器用
// 友好名下载，如 generate_20260703.mp4）；非 OBS 结果原样返回可访问 URL。
func respondTaskDownloadURL(c *gin.Context, task *model.Task, exists bool) {
	if !exists || task == nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "任务不存在"})
		return
	}
	raw := task.GetResultURL()
	if !mediastore.IsOBSRef(raw) {
		common.ApiSuccess(c, gin.H{"url": service.ResolveResultURL(c.Request.Context(), raw)})
		return
	}
	key := mediastore.KeyFromRef(raw)
	url, err := mediastore.Sign(c.Request.Context(), key, mediastore.WithDownloadName(buildDownloadName(task, key)))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"url": url})
}

// buildDownloadName 生成友好下载文件名：<动作>_<完成日期>.<扩展名>，全 ASCII 以避免
// content-disposition 的非 ASCII 编码问题；缺省回退到 task_id。
func buildDownloadName(task *model.Task, key string) string {
	ext := strings.ToLower(path.Ext(key)) // 含点，如 .mp4
	label := sanitizeASCII(task.Action)
	if label == "" {
		label = "media"
	}
	ts := task.FinishTime
	if ts == 0 {
		ts = task.SubmitTime
	}
	var dateStr string
	if ts > 0 {
		dateStr = time.Unix(ts, 0).UTC().Format("20060102")
	}
	base := label
	if dateStr != "" {
		base = label + "_" + dateStr
	}
	if base == "" {
		base = sanitizeASCII(task.TaskID)
	}
	return base + ext
}

// sanitizeASCII 仅保留字母数字下划线连字符，其余替换为下划线（保证文件名安全）。
func sanitizeASCII(s string) string {
	s = strings.TrimSpace(s)
	var b strings.Builder
	for _, r := range s {
		switch {
		case r >= 'a' && r <= 'z', r >= 'A' && r <= 'Z', r >= '0' && r <= '9', r == '_', r == '-':
			b.WriteRune(r)
		default:
			b.WriteRune('_')
		}
	}
	return strings.Trim(b.String(), "_")
}
