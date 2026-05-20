package controller

import (
	"encoding/json"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

type DrawingGenerateRequest struct {
	Prompt  string   `json:"prompt" binding:"required"`
	Model   string   `json:"model"`
	Size    string   `json:"size"`
	Quality string   `json:"quality"`
	Images  []string `json:"images"`
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
		result[i] = MessageMeta{
			ID: m.ID, SessionID: m.SessionID, TaskID: m.TaskID,
			Prompt: m.Prompt, Model: m.Model, Size: m.Size, Quality: m.Quality,
			Status: m.Status, FailReason: m.FailReason, CreatedAt: m.CreatedAt,
		}
	}
	common.ApiSuccess(c, result)
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
	common.ApiSuccess(c, gin.H{
		"image_urls":  msg.ImageUrls,
		"result_data": msg.ResultData,
	})
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

	result := gin.H{
		"task_id":     task.TaskID,
		"status":      task.Status,
		"fail_reason": task.FailReason,
		"progress":    task.Progress,
	}

	if task.Status == model.TaskStatusSuccess {
		msg, err := model.GetDrawingMessageByTaskId(taskId)
		if err == nil && msg.ResultData != nil {
			result["result_data"] = json.RawMessage(msg.ResultData)
		}
	}

	common.ApiSuccess(c, result)
}
