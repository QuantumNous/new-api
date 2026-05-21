package controller

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type DrawingGenerateRequest struct {
	Prompt  string   `json:"prompt" binding:"required"`
	Model   string   `json:"model"`
	Size    string   `json:"size"`
	Quality string   `json:"quality"`
	Images  []string `json:"images"`
}

func GetDrawingResultFile(c *gin.Context) {
	filename := c.Param("filename")
	path, mimeType, err := service.ResolveDrawingImagePath(filename)
	if err != nil {
		c.Status(http.StatusNotFound)
		return
	}

	c.Header("Content-Type", mimeType)
	c.Header("Cache-Control", "public, max-age=31536000, immutable")
	c.File(path)
}

func CreateDrawingSession(c *gin.Context) {
	userId := c.GetInt("id")
	var req struct {
		Title string `json:"title"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		req.Title = "新会话"
	}
	if req.Title == "" {
		req.Title = "新会话"
	}

	session, err := model.CreateDrawingSession(userId, req.Title)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, session)
}

func ListDrawingSessions(c *gin.Context) {
	userId := c.GetInt("id")
	sessions, err := model.GetDrawingSessionsByUserId(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, sessions)
}

func GetDrawingSessionDetail(c *gin.Context) {
	userId := c.GetInt("id")
	sessionId := c.Param("session_id")

	session, err := model.GetDrawingSession(sessionId, userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, session)
}

func UpdateDrawingSessionTitle(c *gin.Context) {
	userId := c.GetInt("id")
	sessionId := c.Param("session_id")

	var req struct {
		Title string `json:"title"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "title is required")
		return
	}

	title := strings.TrimSpace(req.Title)
	if title == "" {
		common.ApiErrorMsg(c, "title is required")
		return
	}
	if len([]rune(title)) > 200 {
		common.ApiErrorMsg(c, "title is too long")
		return
	}

	if _, err := model.GetDrawingSession(sessionId, userId); err != nil {
		common.ApiErrorMsg(c, "会话不存在")
		return
	}

	if err := model.UpdateDrawingSessionTitle(sessionId, userId, title); err != nil {
		common.ApiError(c, err)
		return
	}

	common.ApiSuccess(c, gin.H{
		"session_id": sessionId,
		"title":      title,
	})
}

func GetDrawingSessionMessages(c *gin.Context) {
	userId := c.GetInt("id")
	sessionId := c.Param("session_id")

	messages, err := model.GetDrawingMessagesBySessionId(sessionId, userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	// strip image data
	type MessageMeta struct {
		ID         int64  `json:"id"`
		SessionID  string `json:"session_id"`
		TaskID     string `json:"task_id"`
		Prompt     string `json:"prompt"`
		Model      string `json:"model"`
		Size       string `json:"size"`
		Quality    string `json:"quality"`
		Status     string `json:"status"`
		FailReason string `json:"fail_reason"`
		CreatedAt  int64  `json:"created_at"`
	}
	result := make([]MessageMeta, len(messages))
	for i, m := range messages {
		syncDrawingMessageStatusWithTask(m, nil)
		result[i] = MessageMeta{
			ID: m.ID, SessionID: m.SessionID, TaskID: m.TaskID,
			Prompt: m.Prompt, Model: m.Model, Size: m.Size, Quality: m.Quality,
			Status: m.Status, FailReason: m.FailReason, CreatedAt: m.CreatedAt,
		}
	}
	common.ApiSuccess(c, result)
}

func GetDrawingSessionMessage(c *gin.Context) {
	userId := c.GetInt("id")
	sessionId := c.Param("session_id")
	direction := c.DefaultQuery("direction", "latest")
	currentIdRaw := c.Query("current_id")

	if _, err := model.GetDrawingSession(sessionId, userId); err != nil {
		common.ApiErrorMsg(c, "会话不存在")
		return
	}

	total, err := model.CountDrawingMessagesBySessionId(sessionId, userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if total == 0 {
		common.ApiSuccess(c, gin.H{
			"message":       nil,
			"current_index": 0,
			"total":         0,
			"has_prev":      false,
			"has_next":      false,
		})
		return
	}

	var msg *model.DrawingMessage
	switch direction {
	case "latest", "":
		msg, err = model.GetLatestDrawingMessage(sessionId, userId)
	case "prev", "next":
		currentId, parseErr := strconv.ParseInt(currentIdRaw, 10, 64)
		if parseErr != nil || currentId <= 0 {
			common.ApiErrorMsg(c, "current_id is required")
			return
		}
		msg, err = model.GetAdjacentDrawingMessage(sessionId, userId, currentId, direction)
	default:
		common.ApiErrorMsg(c, "invalid direction")
		return
	}

	if errors.Is(err, gorm.ErrRecordNotFound) {
		common.ApiErrorMsg(c, "消息不存在")
		return
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}

	syncDrawingMessageStatusWithTask(msg, nil)

	position, err := model.GetDrawingMessagePosition(sessionId, userId, msg.ID)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	common.ApiSuccess(c, gin.H{
		"message":       buildDrawingMessageMeta(msg),
		"current_index": position,
		"total":         total,
		"has_prev":      position > 1,
		"has_next":      position < total,
	})
}

func GetDrawingMessageImages(c *gin.Context) {
	userId := c.GetInt("id")
	sessionId := c.Param("session_id")
	messageId := c.Param("message_id")

	msg, err := model.GetDrawingMessageById(messageId, sessionId, userId)
	if err != nil {
		common.ApiErrorMsg(c, "消息不存在")
		return
	}
	syncDrawingMessageStatusWithTask(msg, nil)
	common.ApiSuccess(c, gin.H{
		"image_urls":  msg.ImageUrls,
		"result_data": msg.ResultData,
	})
}

func buildDrawingMessageMeta(m *model.DrawingMessage) gin.H {
	return gin.H{
		"id":          m.ID,
		"session_id":  m.SessionID,
		"task_id":     m.TaskID,
		"prompt":      m.Prompt,
		"model":       m.Model,
		"size":        m.Size,
		"quality":     m.Quality,
		"status":      m.Status,
		"fail_reason": m.FailReason,
		"created_at":  m.CreatedAt,
	}
}

func syncDrawingMessageStatusWithTask(msg *model.DrawingMessage, task *model.Task) {
	if msg == nil || msg.TaskID == "" || msg.Status == "success" || msg.Status == "failure" {
		return
	}

	currentTask := task
	if currentTask == nil {
		var foundTask model.Task
		if err := model.DB.
			Where("task_id = ? AND user_id = ?", msg.TaskID, msg.UserId).
			First(&foundTask).Error; err != nil {
			return
		}
		currentTask = &foundTask
	}

	switch currentTask.Status {
	case model.TaskStatusFailure:
		msg.Status = "failure"
		msg.FailReason = currentTask.FailReason
		_ = model.UpdateDrawingMessageStatus(msg.TaskID, msg.Status, nil, msg.FailReason)
	case model.TaskStatusSuccess:
		if msg.ResultData != nil {
			msg.Status = "success"
			_ = model.UpdateDrawingMessageStatus(msg.TaskID, msg.Status, msg.ResultData, "")
		}
	}
}

func DeleteDrawingSessionHandler(c *gin.Context) {
	userId := c.GetInt("id")
	sessionId := c.Param("session_id")

	err := model.DeleteDrawingSession(sessionId, userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func SubmitDrawingTask(c *gin.Context) {
	userId := c.GetInt("id")
	sessionId := c.Param("session_id")
	group := "gpt-image"

	var req DrawingGenerateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "prompt is required")
		return
	}

	if req.Model == "" {
		req.Model = "gpt-image-2"
	}
	if req.Size == "" {
		req.Size = "auto"
	}
	if req.Quality == "" {
		req.Quality = "auto"
	}
	if len(req.Images) > 4 {
		common.ApiErrorMsg(c, "最多上传4张图片")
		return
	}

	_, err := model.GetDrawingSession(sessionId, userId)
	if err != nil {
		common.ApiErrorMsg(c, "会话不存在")
		return
	}

	taskId := model.GenerateTaskID()

	var imageUrlsJSON json.RawMessage
	if len(req.Images) > 0 {
		imageUrlsJSON, _ = common.Marshal(req.Images)
	}

	msg := &model.DrawingMessage{
		SessionID: sessionId,
		UserId:    userId,
		Role:      "user",
		Prompt:    req.Prompt,
		Model:     req.Model,
		Size:      req.Size,
		Quality:   req.Quality,
		ImageUrls: imageUrlsJSON,
		TaskID:    taskId,
		Status:    "pending",
	}
	if err := model.CreateDrawingMessage(msg); err != nil {
		common.ApiError(c, err)
		return
	}

	now := time.Now().Unix()
	task := &model.Task{
		TaskID:     taskId,
		Platform:   constant.TaskPlatformImage,
		UserId:     userId,
		Group:      group,
		Action:     "generate",
		Status:     model.TaskStatusSubmitted,
		SubmitTime: now,
		Progress:   "0%",
		Properties: model.Properties{
			Input:           req.Prompt,
			OriginModelName: req.Model,
		},
	}
	if len(req.Images) > 0 {
		task.Action = "edit"
	}
	if err := task.Insert(); err != nil {
		common.ApiError(c, err)
		return
	}

	service.EnqueueImageTask(taskId)

	model.UpdateDrawingSessionTime(sessionId)

	common.ApiSuccess(c, gin.H{
		"task_id":    taskId,
		"message_id": msg.ID,
		"status":     "SUBMITTED",
	})
}

func GetDrawingTaskStatus(c *gin.Context) {
	userId := c.GetInt("id")
	taskId := c.Param("task_id")

	var task model.Task
	err := model.DB.Where("task_id = ? AND user_id = ?", taskId, userId).First(&task).Error
	if err != nil {
		common.ApiErrorMsg(c, "任务不存在")
		return
	}

	msg, _ := model.GetDrawingMessageByTaskId(taskId)
	syncDrawingMessageStatusWithTask(msg, &task)

	result := gin.H{
		"task_id":     task.TaskID,
		"status":      task.Status,
		"fail_reason": task.FailReason,
		"progress":    task.Progress,
	}

	if task.Status == model.TaskStatusSuccess {
		if msg != nil && msg.ResultData != nil {
			result["result_data"] = json.RawMessage(msg.ResultData)
		}
	}

	common.ApiSuccess(c, result)
}
