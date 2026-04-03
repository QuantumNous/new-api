package controller

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

type playgroundBodyCaptureWriter struct {
	gin.ResponseWriter
	body bytes.Buffer
}

func (w *playgroundBodyCaptureWriter) Write(data []byte) (int, error) {
	if len(data) > 0 {
		_, _ = w.body.Write(data)
	}
	return w.ResponseWriter.Write(data)
}

func (w *playgroundBodyCaptureWriter) WriteString(value string) (int, error) {
	if value != "" {
		_, _ = w.body.WriteString(value)
	}
	return w.ResponseWriter.WriteString(value)
}

func buildPlaygroundImageResultURL(item dto.ImageData) string {
	if strings.TrimSpace(item.Url) != "" {
		return strings.TrimSpace(item.Url)
	}
	if strings.TrimSpace(item.B64Json) != "" {
		return "data:image/png;base64," + strings.TrimSpace(item.B64Json)
	}
	return ""
}

func recordPlaygroundImageTask(c *gin.Context, action string, responseBody []byte) {
	if len(responseBody) == 0 {
		return
	}

	var imageResponse dto.ImageResponse
	if err := common.Unmarshal(responseBody, &imageResponse); err != nil {
		return
	}
	if len(imageResponse.Data) == 0 {
		return
	}

	resultURL := ""
	for _, item := range imageResponse.Data {
		resultURL = buildPlaygroundImageResultURL(item)
		if resultURL != "" {
			break
		}
	}
	if resultURL == "" {
		return
	}

	modelName := common.GetContextKeyString(c, constant.ContextKeyOriginalModel)
	now := time.Now().Unix()
	task := &model.Task{
		TaskID:     model.GenerateTaskID(),
		UserId:     c.GetInt(string(constant.ContextKeyUserId)),
		Group:      common.GetContextKeyString(c, constant.ContextKeyUsingGroup),
		ChannelId:  common.GetContextKeyInt(c, constant.ContextKeyChannelId),
		Action:     action,
		Status:     model.TaskStatusSuccess,
		SubmitTime: now,
		StartTime:  now,
		FinishTime: now,
		Progress:   "100%",
		Properties: model.Properties{
			OriginModelName:   modelName,
			UpstreamModelName: modelName,
		},
		Data: json.RawMessage(responseBody),
	}
	task.PrivateData.ResultURL = resultURL
	if err := task.Insert(); err != nil {
		common.SysError("insert playground image task error: " + err.Error())
	}
}

func relayPlaygroundImage(c *gin.Context, tokenName string, action string) *types.NewAPIError {
	if newAPIError := setupPlaygroundTokenContext(c, tokenName, c.GetString("group")); newAPIError != nil {
		return newAPIError
	}

	bodyCaptureWriter := &playgroundBodyCaptureWriter{ResponseWriter: c.Writer}
	c.Writer = bodyCaptureWriter
	Relay(c, types.RelayFormatOpenAIImage)

	if bodyCaptureWriter.Status() >= 200 && bodyCaptureWriter.Status() < 300 {
		recordPlaygroundImageTask(c, action, bodyCaptureWriter.body.Bytes())
	}

	return nil
}

func Playground(c *gin.Context) {
	var newAPIError *types.NewAPIError

	defer func() {
		if newAPIError != nil {
			c.JSON(newAPIError.StatusCode, gin.H{
				"error": newAPIError.ToOpenAIError(),
			})
		}
	}()

	useAccessToken := c.GetBool("use_access_token")
	if useAccessToken {
		newAPIError = types.NewError(errors.New("暂不支持使用 access token"), types.ErrorCodeAccessDenied, types.ErrOptionWithSkipRetry())
		return
	}

	relayInfo, err := relaycommon.GenRelayInfo(c, types.RelayFormatOpenAI, nil, nil)
	if err != nil {
		newAPIError = types.NewError(err, types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
		return
	}

	if newAPIError = setupPlaygroundTokenContext(c, fmt.Sprintf("playground-%s", relayInfo.UsingGroup), relayInfo.UsingGroup); newAPIError != nil {
		return
	}

	Relay(c, types.RelayFormatOpenAI)
}

func PlaygroundVideoSubmit(c *gin.Context) {
	var newAPIError *types.NewAPIError
	defer func() {
		if newAPIError != nil {
			c.JSON(newAPIError.StatusCode, gin.H{
				"error": newAPIError.ToOpenAIError(),
			})
		}
	}()
	if newAPIError = setupPlaygroundTokenContext(c, "playground-video", c.GetString("group")); newAPIError != nil {
		return
	}
	RelayTask(c)
}

func PlaygroundImageGenerations(c *gin.Context) {
	var newAPIError *types.NewAPIError
	defer func() {
		if newAPIError != nil {
			c.JSON(newAPIError.StatusCode, gin.H{
				"error": newAPIError.ToOpenAIError(),
			})
		}
	}()
	newAPIError = relayPlaygroundImage(c, "playground-image", constant.TaskActionImageGenerate)
}

func PlaygroundImageEdits(c *gin.Context) {
	var newAPIError *types.NewAPIError
	defer func() {
		if newAPIError != nil {
			c.JSON(newAPIError.StatusCode, gin.H{
				"error": newAPIError.ToOpenAIError(),
			})
		}
	}()
	newAPIError = relayPlaygroundImage(c, "playground-image-edit", constant.TaskActionImageEdit)
}

func PlaygroundVideoFetch(c *gin.Context) {
	var newAPIError *types.NewAPIError
	defer func() {
		if newAPIError != nil {
			c.JSON(newAPIError.StatusCode, gin.H{
				"error": newAPIError.ToOpenAIError(),
			})
		}
	}()
	if newAPIError = setupPlaygroundTokenContext(c, "playground-video-fetch", c.GetString("group")); newAPIError != nil {
		return
	}
	RelayTaskFetch(c)
}

func setupPlaygroundTokenContext(c *gin.Context, tokenName string, tokenGroup string) *types.NewAPIError {
	userId := c.GetInt("id")
	userCache, err := model.GetUserCache(userId)
	if err != nil {
		return types.NewError(err, types.ErrorCodeQueryDataError, types.ErrOptionWithSkipRetry())
	}
	userCache.WriteContext(c)
	if tokenGroup == "" {
		tokenGroup = c.GetString("group")
	}
	if tokenGroup == "" {
		tokenGroup = userCache.Group
	}
	tempToken := &model.Token{
		UserId: userId,
		Name:   tokenName,
		Group:  tokenGroup,
	}
	_ = middleware.SetupContextForToken(c, tempToken)
	return nil
}
