package controller

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

func ProcessImageTask(taskId string) {
	var task model.Task
	if err := model.DB.Where("task_id = ?", taskId).First(&task).Error; err != nil {
		fmt.Printf("[ImageTask] task not found: %s\n", taskId)
		return
	}

	msg, err := model.GetDrawingMessageByTaskId(taskId)
	if err != nil {
		fmt.Printf("[ImageTask] message not found for task: %s\n", taskId)
		return
	}

	oldStatus := task.Status
	task.Status = model.TaskStatusInProgress
	task.Progress = "50%"
	_, _ = task.UpdateWithStatus(oldStatus)
	model.UpdateDrawingMessageStatus(taskId, "processing", nil, "")

	group := task.Group
	if group == "" {
		g, _ := model.GetUserGroup(task.UserId, false)
		group = g
	}

	channel, err := model.GetRandomSatisfiedChannel(group, msg.Model, 0)
	if err != nil {
		failImageTask(&task, "没有可用的渠道: "+err.Error())
		return
	}
	if channel == nil {
		failImageTask(&task, fmt.Sprintf("分组 %s 下没有支持模型 %s 的渠道", group, msg.Model))
		return
	}

	var requestPath string
	var imageRequest interface{}

	if task.Action == "edit" {
		requestPath = "/v1/images/edits"
		imageRequest = buildImageEditRequest(msg)
	} else {
		requestPath = "/v1/images/generations"
		imageRequest = buildImageGenerationRequest(msg)
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = &http.Request{
		Method: "POST",
		URL:    &url.URL{Path: requestPath},
		Header: make(http.Header),
	}
	c.Request.Header.Set("Content-Type", "application/json")
	c.Set(common.RequestIdKey, taskId)
	common.SetContextKey(c, constant.ContextKeyIsPlayground, true)

	userCache, err := model.GetUserCache(task.UserId)
	if err != nil {
		failImageTask(&task, "获取用户信息失败: "+err.Error())
		return
	}
	userCache.WriteContext(c)
	c.Set("id", task.UserId)
	c.Set("group", group)

	tempToken := &model.Token{
		UserId:         task.UserId,
		Name:           fmt.Sprintf("drawing-%s", taskId),
		Group:          group,
		UnlimitedQuota: true,
	}
	_ = middleware.SetupContextForToken(c, tempToken)

	newAPIError := middleware.SetupContextForSelectedChannel(c, channel, msg.Model)
	if newAPIError != nil {
		failImageTask(&task, "渠道设置失败: "+newAPIError.Err.Error())
		return
	}

	body, _ := common.Marshal(imageRequest)
	bodyStorage, err := common.CreateBodyStorage(body)
	if err != nil {
		failImageTask(&task, "创建请求体失败: "+err.Error())
		return
	}
	defer bodyStorage.Close()
	c.Set(common.KeyBodyStorage, bodyStorage)
	c.Request.Body = io.NopCloser(bytes.NewBuffer(body))
	c.Request.ContentLength = int64(len(body))

	Relay(c, types.RelayFormatOpenAIImage)

	if w.Code != http.StatusOK {
		var errResp struct {
			Error struct {
				Message string `json:"message"`
			} `json:"error"`
		}
		if err := common.Unmarshal(w.Body.Bytes(), &errResp); err == nil && errResp.Error.Message != "" {
			failImageTask(&task, errResp.Error.Message)
		} else {
			failImageTask(&task, fmt.Sprintf("上游返回错误 (HTTP %d)", w.Code))
		}
		return
	}

	var imageResp dto.ImageResponse
	if err := common.Unmarshal(w.Body.Bytes(), &imageResp); err != nil {
		failImageTask(&task, "解析上游响应失败: "+err.Error())
		return
	}

	resultImages, err := service.PersistDrawingImageResults(imageResp.Data)
	if err != nil {
		failImageTask(&task, "保存图片结果失败: "+err.Error())
		return
	}
	resultData, _ := common.Marshal(resultImages)

	task.Status = model.TaskStatusSuccess
	task.Progress = "100%"
	task.FinishTime = common.GetTimestamp()
	_, _ = task.UpdateWithStatus(model.TaskStatusInProgress)

	model.UpdateDrawingMessageStatus(taskId, "success", json.RawMessage(resultData), "")
}

func failImageTask(task *model.Task, reason string) {
	task.Status = model.TaskStatusFailure
	task.Progress = "100%"
	task.FailReason = reason
	task.FinishTime = common.GetTimestamp()
	_, _ = task.UpdateWithStatus(model.TaskStatusInProgress)
	model.UpdateDrawingMessageStatus(task.TaskID, "failure", nil, reason)
}

func buildImageGenerationRequest(msg *model.DrawingMessage) *dto.ImageRequest {
	return &dto.ImageRequest{
		Model:   msg.Model,
		Prompt:  msg.Prompt,
		Size:    msg.Size,
		Quality: msg.Quality,
	}
}

func buildImageEditRequest(msg *model.DrawingMessage) map[string]interface{} {
	req := map[string]interface{}{
		"model":   msg.Model,
		"prompt":  msg.Prompt,
		"size":    msg.Size,
		"quality": msg.Quality,
	}
	if msg.ImageUrls != nil {
		var images []string
		common.Unmarshal(msg.ImageUrls, &images)
		if len(images) > 0 {
			req["image"] = images[0]
		}
	}
	return req
}
