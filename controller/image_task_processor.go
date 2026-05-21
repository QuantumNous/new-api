package controller

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/textproto"
	"net/url"
	"os"
	"strings"

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
	var body []byte
	var contentType string

	if task.Action == "edit" {
		requestPath = "/v1/images/edits"
		body, contentType, err = buildImageEditRequestBody(msg)
	} else {
		requestPath = "/v1/images/generations"
		imageRequest := buildImageGenerationRequest(msg)
		body, err = common.Marshal(imageRequest)
		contentType = "application/json"
	}
	if err != nil {
		failImageTask(&task, "创建请求体失败: "+err.Error())
		return
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = &http.Request{
		Method: "POST",
		URL:    &url.URL{Path: requestPath},
		Header: make(http.Header),
	}
	c.Request.Header.Set("Content-Type", contentType)
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

func buildImageEditRequestBody(msg *model.DrawingMessage) ([]byte, string, error) {
	var images []string
	if msg.ImageUrls != nil {
		if err := common.Unmarshal(msg.ImageUrls, &images); err != nil {
			return nil, "", fmt.Errorf("解析上传图片失败: %w", err)
		}
	}
	if len(images) == 0 {
		return nil, "", fmt.Errorf("image is required")
	}

	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)

	writeField := func(key, value string) error {
		if value == "" {
			return nil
		}
		return writer.WriteField(key, value)
	}
	if err := writeField("model", msg.Model); err != nil {
		return nil, "", err
	}
	if err := writeField("prompt", msg.Prompt); err != nil {
		return nil, "", err
	}
	if err := writeField("size", msg.Size); err != nil {
		return nil, "", err
	}
	if err := writeField("quality", msg.Quality); err != nil {
		return nil, "", err
	}

	for i, rawImage := range images {
		imageBytes, mimeType, err := decodeDrawingUploadImage(rawImage)
		if err != nil {
			return nil, "", fmt.Errorf("解析第%d张上传图片失败: %w", i+1, err)
		}

		filename := fmt.Sprintf("image_%d%s", i+1, imageExtFromMimeType(mimeType))
		h := make(textproto.MIMEHeader)
		h.Set("Content-Disposition", fmt.Sprintf(`form-data; name="image"; filename="%s"`, filename))
		h.Set("Content-Type", mimeType)

		part, err := writer.CreatePart(h)
		if err != nil {
			return nil, "", fmt.Errorf("创建图片表单失败: %w", err)
		}
		if _, err := part.Write(imageBytes); err != nil {
			return nil, "", fmt.Errorf("写入图片表单失败: %w", err)
		}
	}

	if err := writer.Close(); err != nil {
		return nil, "", err
	}

	return buf.Bytes(), writer.FormDataContentType(), nil
}

func decodeDrawingUploadImage(raw string) ([]byte, string, error) {
	dataPart := strings.TrimSpace(raw)
	if strings.HasPrefix(dataPart, service.DrawingImageURLPrefix) {
		filename := strings.TrimPrefix(dataPart, service.DrawingImageURLPrefix)
		path, mimeType, err := service.ResolveDrawingImagePath(filename)
		if err != nil {
			return nil, "", err
		}
		data, err := os.ReadFile(path)
		if err != nil {
			return nil, "", fmt.Errorf("read drawing image failed: %w", err)
		}
		if !strings.HasPrefix(mimeType, "image/") {
			return nil, "", fmt.Errorf("not an image: %s", mimeType)
		}
		return data, mimeType, nil
	}

	mimeType := ""
	if idx := strings.Index(dataPart, ","); idx != -1 && strings.HasPrefix(dataPart[:idx], "data:") {
		meta := dataPart[:idx]
		dataPart = dataPart[idx+1:]
		mimeType = strings.TrimPrefix(meta, "data:")
		if semi := strings.Index(mimeType, ";"); semi != -1 {
			mimeType = mimeType[:semi]
		}
		mimeType = strings.ToLower(strings.TrimSpace(mimeType))
	}
	dataPart = strings.Map(func(r rune) rune {
		switch r {
		case '\r', '\n', '\t', ' ':
			return -1
		default:
			return r
		}
	}, dataPart)
	if dataPart == "" {
		return nil, "", fmt.Errorf("image base64 is empty")
	}

	data, err := base64.StdEncoding.DecodeString(dataPart)
	if err != nil {
		data, err = base64.RawStdEncoding.DecodeString(dataPart)
	}
	if err != nil {
		return nil, "", fmt.Errorf("decode image failed: %w", err)
	}

	if mimeType == "" {
		mimeType = http.DetectContentType(data)
	}
	if !strings.HasPrefix(mimeType, "image/") {
		return nil, "", fmt.Errorf("not an image: %s", mimeType)
	}

	return data, mimeType, nil
}

func imageExtFromMimeType(mimeType string) string {
	switch strings.ToLower(mimeType) {
	case "image/jpeg", "image/jpg":
		return ".jpg"
	case "image/png":
		return ".png"
	case "image/webp":
		return ".webp"
	case "image/gif":
		return ".gif"
	default:
		return ".png"
	}
}
