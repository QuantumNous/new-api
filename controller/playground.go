package controller

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

type playgroundChatRequestMeta struct {
	ModelName      string
	HasVisualInput bool
	IsStream       bool
	Prompt         string
}

var (
	playgroundChatImageModels = map[string]struct{}{
		"nano-banana":     {},
		"nano-banana2":    {},
		"nano-banana-pro": {},
	}
	playgroundChatVideoModels = map[string]struct{}{
		"sora2":      {},
		"sora2-pro":  {},
		"veo31":      {},
		"veo31-ref":  {},
		"veo31-fast": {},
	}
	playgroundHTMLVideoURLPattern = regexp.MustCompile(`<video[^>]+src=['"]([^'"]+)['"]`)
	playgroundMarkdownURLPattern  = regexp.MustCompile(`\((https?://[^)\s]+)\)`)
	playgroundPlainURLPattern     = regexp.MustCompile(`https?://[^\s'"]+`)
	playgroundImageURLPattern     = regexp.MustCompile(`https?://[^\s'"]+\.(?:png|jpe?g|webp|gif)(?:\?[^\s'"]*)?`)
	playgroundVideoURLPattern     = regexp.MustCompile(`https?://[^\s'"]+\.(?:mp4|mov|webm|m3u8)(?:\?[^\s'"]*)?`)
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
	if strings.TrimSpace(item.PresignedURL) != "" {
		return strings.TrimSpace(item.PresignedURL)
	}
	if strings.TrimSpace(item.PresignedURLAlt) != "" {
		return strings.TrimSpace(item.PresignedURLAlt)
	}
	if strings.TrimSpace(item.B64Json) != "" {
		return "data:image/png;base64," + strings.TrimSpace(item.B64Json)
	}
	return ""
}

func extractPlaygroundPromptFromMessageContent(content any) string {
	switch typedContent := content.(type) {
	case string:
		return strings.TrimSpace(typedContent)
	case []any:
		promptParts := make([]string, 0, len(typedContent))
		for _, item := range typedContent {
			itemPayload, ok := item.(map[string]any)
			if !ok {
				continue
			}
			textValue := strings.TrimSpace(common.Interface2String(itemPayload["text"]))
			if textValue == "" {
				textValue = strings.TrimSpace(common.Interface2String(itemPayload["content"]))
			}
			if textValue != "" {
				promptParts = append(promptParts, textValue)
			}
		}
		return strings.TrimSpace(strings.Join(promptParts, "\n"))
	default:
		return ""
	}
}

func readPlaygroundRequestPrompt(c *gin.Context) string {
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return ""
	}
	bodyBytes, err := storage.Bytes()
	if err != nil || len(bodyBytes) == 0 {
		return ""
	}

	var payload map[string]any
	if err := common.Unmarshal(bodyBytes, &payload); err != nil {
		return ""
	}

	if prompt := strings.TrimSpace(common.Interface2String(payload["prompt"])); prompt != "" {
		return prompt
	}
	if inputPrompt := strings.TrimSpace(common.Interface2String(payload["input"])); inputPrompt != "" {
		return inputPrompt
	}
	if messages, ok := payload["messages"].([]any); ok {
		promptParts := make([]string, 0, len(messages))
		for _, message := range messages {
			messagePayload, ok := message.(map[string]any)
			if !ok {
				continue
			}
			messagePrompt := extractPlaygroundPromptFromMessageContent(messagePayload["content"])
			if messagePrompt != "" {
				promptParts = append(promptParts, messagePrompt)
			}
		}
		return strings.TrimSpace(strings.Join(promptParts, "\n"))
	}

	return ""
}

func buildPlaygroundMediaTaskModelName(c *gin.Context, modelName string) string {
	resolvedModelName := strings.TrimSpace(modelName)
	if resolvedModelName == "" {
		resolvedModelName = common.GetContextKeyString(c, constant.ContextKeyOriginalModel)
	}
	return resolvedModelName
}

func getPlaygroundMediaTaskStartTime(c *gin.Context) int64 {
	startTime := time.Now().Unix()
	if requestStartTime := common.GetContextKeyTime(c, constant.ContextKeyRequestStartTime); !requestStartTime.IsZero() {
		startTime = requestStartTime.Unix()
	}
	return startTime
}

func createPendingPlaygroundMediaTask(c *gin.Context, action string, modelName string) string {
	if action == "" {
		return ""
	}

	resolvedModelName := buildPlaygroundMediaTaskModelName(c, modelName)
	startTime := getPlaygroundMediaTaskStartTime(c)
	task := &model.Task{
		TaskID:     model.GenerateTaskID(),
		UserId:     c.GetInt(string(constant.ContextKeyUserId)),
		Group:      common.GetContextKeyString(c, constant.ContextKeyUsingGroup),
		ChannelId:  common.GetContextKeyInt(c, constant.ContextKeyChannelId),
		Action:     action,
		Status:     model.TaskStatusSubmitted,
		SubmitTime: startTime,
		Progress:   taskcommon.ProgressSubmitted,
		Properties: model.Properties{
			OriginModelName:   resolvedModelName,
			UpstreamModelName: resolvedModelName,
			Input:             readPlaygroundRequestPrompt(c),
		},
	}
	if err := task.Insert(); err != nil {
		common.SysError("insert playground media task error: " + err.Error())
		return ""
	}
	return task.TaskID
}

func updatePlaygroundMediaTask(c *gin.Context, taskID string, action string, modelName string, responseBody []byte, resultURL string, failReason string) {
	if strings.TrimSpace(taskID) == "" || action == "" {
		return
	}

	task, exist, err := model.GetByOnlyTaskId(strings.TrimSpace(taskID))
	if err != nil {
		common.SysError("get playground media task error: " + err.Error())
		return
	}
	if !exist || task == nil {
		return
	}

	task.Action = action
	task.Properties.OriginModelName = buildPlaygroundMediaTaskModelName(c, modelName)
	task.Properties.UpstreamModelName = task.Properties.OriginModelName
	if task.Properties.Input == "" {
		task.Properties.Input = readPlaygroundRequestPrompt(c)
	}
	if len(responseBody) > 0 {
		task.Data = json.RawMessage(responseBody)
	}

	now := time.Now().Unix()
	startTime := getPlaygroundMediaTaskStartTime(c)
	if task.SubmitTime == 0 {
		task.SubmitTime = startTime
	}
	if task.StartTime == 0 {
		task.StartTime = startTime
	}

	if strings.TrimSpace(failReason) != "" {
		task.Status = model.TaskStatusFailure
		task.Progress = taskcommon.ProgressComplete
		task.FinishTime = now
		task.FailReason = strings.TrimSpace(failReason)
		task.PrivateData.ResultURL = ""
	} else if strings.TrimSpace(resultURL) != "" {
		task.Status = model.TaskStatusSuccess
		task.Progress = taskcommon.ProgressComplete
		task.FinishTime = now
		task.FailReason = ""
		task.PrivateData.ResultURL = strings.TrimSpace(resultURL)
	} else {
		task.Status = model.TaskStatusSubmitted
		task.Progress = taskcommon.ProgressSubmitted
	}

	if updateErr := task.Update(); updateErr != nil {
		common.SysError("update playground media task error: " + updateErr.Error())
	}
}

func extractPlaygroundTaskErrorMessage(responseBody []byte, fallback string) string {
	message := strings.TrimSpace(fallback)
	if len(responseBody) == 0 {
		return message
	}

	var errorResponse dto.GeneralErrorResponse
	if err := common.Unmarshal(responseBody, &errorResponse); err == nil {
		if parsed := strings.TrimSpace(errorResponse.ToMessage()); parsed != "" {
			return parsed
		}
	}

	bodyMessage := strings.TrimSpace(string(responseBody))
	if bodyMessage != "" {
		return bodyMessage
	}
	return message
}

func recordPlaygroundImageTask(c *gin.Context, taskID string, action string, responseBody []byte) {
	if len(responseBody) == 0 {
		updatePlaygroundMediaTask(c, taskID, action, common.GetContextKeyString(c, constant.ContextKeyOriginalModel), nil, "", "未获取到图片结果")
		return
	}

	var imageResponse dto.ImageResponse
	if err := common.Unmarshal(responseBody, &imageResponse); err != nil {
		updatePlaygroundMediaTask(c, taskID, action, common.GetContextKeyString(c, constant.ContextKeyOriginalModel), responseBody, "", "图片结果解析失败")
		return
	}
	if len(imageResponse.Data) == 0 {
		updatePlaygroundMediaTask(c, taskID, action, common.GetContextKeyString(c, constant.ContextKeyOriginalModel), responseBody, "", "未获取到图片结果")
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
		updatePlaygroundMediaTask(c, taskID, action, common.GetContextKeyString(c, constant.ContextKeyOriginalModel), responseBody, "", "未获取到图片结果")
		return
	}

	updatePlaygroundMediaTask(
		c,
		taskID,
		action,
		common.GetContextKeyString(c, constant.ContextKeyOriginalModel),
		responseBody,
		resultURL,
		"",
	)
}

func readPlaygroundChatRequestMeta(c *gin.Context) playgroundChatRequestMeta {
	meta := playgroundChatRequestMeta{
		ModelName: strings.TrimSpace(common.GetContextKeyString(c, constant.ContextKeyOriginalModel)),
	}

	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return meta
	}
	bodyBytes, err := storage.Bytes()
	if err != nil || len(bodyBytes) == 0 {
		return meta
	}

	var payload map[string]any
	if err := common.Unmarshal(bodyBytes, &payload); err != nil {
		return meta
	}

	if modelName := strings.TrimSpace(common.Interface2String(payload["model"])); modelName != "" {
		meta.ModelName = modelName
	}
	meta.Prompt = readPlaygroundRequestPrompt(c)
	if stream, ok := payload["stream"].(bool); ok {
		meta.IsStream = stream
	}
	if messages, ok := payload["messages"].([]any); ok {
		for _, message := range messages {
			messagePayload, ok := message.(map[string]any)
			if !ok {
				continue
			}
			if playgroundMessageHasVisualInput(messagePayload["content"]) {
				meta.HasVisualInput = true
				break
			}
		}
	}

	return meta
}

func playgroundMessageHasVisualInput(content any) bool {
	items, ok := content.([]any)
	if !ok {
		return false
	}
	for _, item := range items {
		itemPayload, ok := item.(map[string]any)
		if !ok {
			continue
		}
		itemType := strings.ToLower(strings.TrimSpace(common.Interface2String(itemPayload["type"])))
		if itemType == dto.ContentTypeImageURL || itemType == dto.ContentTypeVideoUrl {
			return true
		}
	}
	return false
}

func extractPlaygroundImageURLsFromText(content string) []string {
	if strings.TrimSpace(content) == "" {
		return nil
	}
	matches := playgroundImageURLPattern.FindAllString(content, -1)
	if len(matches) == 0 {
		return nil
	}
	result := make([]string, 0, len(matches))
	seen := make(map[string]struct{}, len(matches))
	for _, match := range matches {
		trimmed := strings.TrimSpace(match)
		if trimmed == "" {
			continue
		}
		if _, exists := seen[trimmed]; exists {
			continue
		}
		seen[trimmed] = struct{}{}
		result = append(result, trimmed)
	}
	return result
}

func extractPlaygroundVideoURLFromText(content string) string {
	trimmedContent := strings.TrimSpace(content)
	if trimmedContent == "" {
		return ""
	}
	if matches := playgroundHTMLVideoURLPattern.FindStringSubmatch(trimmedContent); len(matches) > 1 {
		return strings.TrimSpace(matches[1])
	}
	if matches := playgroundMarkdownURLPattern.FindStringSubmatch(trimmedContent); len(matches) > 1 {
		candidate := strings.TrimSpace(matches[1])
		if playgroundVideoURLPattern.MatchString(candidate) {
			return candidate
		}
	}
	if matches := playgroundPlainURLPattern.FindStringSubmatch(trimmedContent); len(matches) > 0 {
		candidate := strings.TrimSpace(matches[0])
		if playgroundVideoURLPattern.MatchString(candidate) {
			return candidate
		}
	}
	return ""
}

func extractPlaygroundMediaFieldURL(value any) string {
	switch typedValue := value.(type) {
	case string:
		return strings.TrimSpace(typedValue)
	case map[string]any:
		candidates := []string{
			common.Interface2String(typedValue["url"]),
			common.Interface2String(typedValue["presignedUrl"]),
			common.Interface2String(typedValue["presigned_url"]),
			common.Interface2String(typedValue["resultUrl"]),
			common.Interface2String(typedValue["result_url"]),
		}
		for _, candidate := range candidates {
			if trimmed := strings.TrimSpace(candidate); trimmed != "" {
				return trimmed
			}
		}
		return ""
	default:
		return ""
	}
}

func extractPlaygroundChatMediaURLs(responseBody []byte) ([]string, []string) {
	if len(responseBody) == 0 {
		return nil, nil
	}

	var payload map[string]any
	if err := common.Unmarshal(responseBody, &payload); err != nil {
		return nil, nil
	}

	imageURLs := make([]string, 0)
	videoURLs := make([]string, 0)
	appendUnique := func(target *[]string, candidate string) {
		trimmed := strings.TrimSpace(candidate)
		if trimmed == "" {
			return
		}
		for _, existing := range *target {
			if existing == trimmed {
				return
			}
		}
		*target = append(*target, trimmed)
	}

	if items, ok := payload["data"].([]any); ok {
		for _, item := range items {
			itemPayload, ok := item.(map[string]any)
			if !ok {
				continue
			}
			appendUnique(&imageURLs, extractPlaygroundMediaFieldURL(itemPayload["url"]))
			appendUnique(&imageURLs, extractPlaygroundMediaFieldURL(itemPayload["presignedUrl"]))
			appendUnique(&imageURLs, extractPlaygroundMediaFieldURL(itemPayload["presigned_url"]))
			appendUnique(&imageURLs, extractPlaygroundMediaFieldURL(itemPayload["resultUrl"]))
			appendUnique(&imageURLs, extractPlaygroundMediaFieldURL(itemPayload["result_url"]))
			if b64 := strings.TrimSpace(common.Interface2String(itemPayload["b64_json"])); b64 != "" {
				appendUnique(&imageURLs, "data:image/png;base64,"+b64)
			}
			if b64 := strings.TrimSpace(common.Interface2String(itemPayload["b64Json"])); b64 != "" {
				appendUnique(&imageURLs, "data:image/png;base64,"+b64)
			}
		}
	}

	choices, ok := payload["choices"].([]any)
	if !ok || len(choices) == 0 {
		return imageURLs, videoURLs
	}
	firstChoice, ok := choices[0].(map[string]any)
	if !ok {
		return imageURLs, videoURLs
	}
	message, ok := firstChoice["message"].(map[string]any)
	if !ok {
		return imageURLs, videoURLs
	}

	switch content := message["content"].(type) {
	case string:
		for _, imageURL := range extractPlaygroundImageURLsFromText(content) {
			appendUnique(&imageURLs, imageURL)
		}
		appendUnique(&videoURLs, extractPlaygroundVideoURLFromText(content))
	case []any:
		for _, item := range content {
			itemPayload, ok := item.(map[string]any)
			if !ok {
				continue
			}
			itemType := strings.ToLower(strings.TrimSpace(common.Interface2String(itemPayload["type"])))
			switch itemType {
			case dto.ContentTypeImageURL:
				appendUnique(&imageURLs, extractPlaygroundMediaFieldURL(itemPayload["image_url"]))
			case dto.ContentTypeVideoUrl:
				appendUnique(&videoURLs, extractPlaygroundMediaFieldURL(itemPayload["video_url"]))
			default:
				textContent := strings.TrimSpace(common.Interface2String(itemPayload["text"]))
				if textContent == "" {
					textContent = strings.TrimSpace(common.Interface2String(itemPayload["content"]))
				}
				for _, imageURL := range extractPlaygroundImageURLsFromText(textContent) {
					appendUnique(&imageURLs, imageURL)
				}
				appendUnique(&videoURLs, extractPlaygroundVideoURLFromText(textContent))
			}
		}
	}

	return imageURLs, videoURLs
}

func inferPlaygroundChatTaskAction(meta playgroundChatRequestMeta, imageURLs []string, videoURLs []string) string {
	modelName := strings.ToLower(strings.TrimSpace(meta.ModelName))

	if _, ok := playgroundChatImageModels[modelName]; ok && len(imageURLs) > 0 {
		if meta.HasVisualInput {
			return constant.TaskActionImageEdit
		}
		return constant.TaskActionImageGenerate
	}
	if _, ok := playgroundChatVideoModels[modelName]; ok && len(videoURLs) > 0 {
		if meta.HasVisualInput {
			return constant.TaskActionGenerate
		}
		return constant.TaskActionTextGenerate
	}

	if len(videoURLs) > 0 {
		if meta.HasVisualInput {
			return constant.TaskActionGenerate
		}
		return constant.TaskActionTextGenerate
	}

	if len(imageURLs) > 0 {
		if meta.HasVisualInput {
			return constant.TaskActionImageEdit
		}
		return constant.TaskActionImageGenerate
	}

	if _, ok := playgroundChatVideoModels[modelName]; ok {
		if meta.HasVisualInput {
			return constant.TaskActionGenerate
		}
		return constant.TaskActionTextGenerate
	}
	if _, ok := playgroundChatImageModels[modelName]; ok {
		if meta.HasVisualInput {
			return constant.TaskActionImageEdit
		}
		return constant.TaskActionImageGenerate
	}

	return ""
}

func inferPlaygroundChatRequestAction(meta playgroundChatRequestMeta) string {
	return inferPlaygroundChatTaskAction(meta, nil, nil)
}

func recordPlaygroundChatMediaTask(c *gin.Context, taskID string, meta playgroundChatRequestMeta, responseBody []byte) {
	if meta.IsStream || len(responseBody) == 0 {
		return
	}

	imageURLs, videoURLs := extractPlaygroundChatMediaURLs(responseBody)
	action := inferPlaygroundChatTaskAction(meta, imageURLs, videoURLs)
	if action == "" {
		action = inferPlaygroundChatRequestAction(meta)
	}
	if action == "" {
		return
	}

	resultURL := ""
	switch action {
	case constant.TaskActionImageGenerate, constant.TaskActionImageEdit:
		if len(imageURLs) > 0 {
			resultURL = imageURLs[0]
		}
	default:
		if len(videoURLs) > 0 {
			resultURL = videoURLs[0]
		} else if len(imageURLs) > 0 {
			resultURL = imageURLs[0]
		}
	}
	if resultURL == "" {
		updatePlaygroundMediaTask(c, taskID, action, meta.ModelName, responseBody, "", "未获取到媒体结果")
		return
	}

	updatePlaygroundMediaTask(c, taskID, action, meta.ModelName, responseBody, resultURL, "")
}

func relayPlaygroundImage(c *gin.Context, tokenName string, action string) *types.NewAPIError {
	if newAPIError := setupPlaygroundTokenContext(c, tokenName, c.GetString("group")); newAPIError != nil {
		return newAPIError
	}

	bodyCaptureWriter := &playgroundBodyCaptureWriter{ResponseWriter: c.Writer}
	c.Writer = bodyCaptureWriter
	pendingTaskID := createPendingPlaygroundMediaTask(
		c,
		action,
		common.GetContextKeyString(c, constant.ContextKeyOriginalModel),
	)
	Relay(c, types.RelayFormatOpenAIImage)

	if bodyCaptureWriter.Status() >= 200 && bodyCaptureWriter.Status() < 300 {
		recordPlaygroundImageTask(c, pendingTaskID, action, bodyCaptureWriter.body.Bytes())
	} else if pendingTaskID != "" {
		updatePlaygroundMediaTask(
			c,
			pendingTaskID,
			action,
			common.GetContextKeyString(c, constant.ContextKeyOriginalModel),
			bodyCaptureWriter.body.Bytes(),
			"",
			extractPlaygroundTaskErrorMessage(bodyCaptureWriter.body.Bytes(), "playground image request failed"),
		)
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

	requestMeta := readPlaygroundChatRequestMeta(c)
	if requestMeta.IsStream {
		Relay(c, types.RelayFormatOpenAI)
		return
	}

	bodyCaptureWriter := &playgroundBodyCaptureWriter{ResponseWriter: c.Writer}
	c.Writer = bodyCaptureWriter
	pendingAction := inferPlaygroundChatRequestAction(requestMeta)
	pendingTaskID := createPendingPlaygroundMediaTask(c, pendingAction, requestMeta.ModelName)
	Relay(c, types.RelayFormatOpenAI)
	if bodyCaptureWriter.Status() >= 200 && bodyCaptureWriter.Status() < 300 {
		recordPlaygroundChatMediaTask(c, pendingTaskID, requestMeta, bodyCaptureWriter.body.Bytes())
	} else if pendingTaskID != "" {
		updatePlaygroundMediaTask(
			c,
			pendingTaskID,
			pendingAction,
			requestMeta.ModelName,
			bodyCaptureWriter.body.Bytes(),
			"",
			extractPlaygroundTaskErrorMessage(bodyCaptureWriter.body.Bytes(), "playground media request failed"),
		)
	}
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
