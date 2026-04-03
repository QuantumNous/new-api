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
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

type playgroundChatRequestMeta struct {
	ModelName      string
	HasVisualInput bool
	IsStream       bool
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
	if strings.TrimSpace(item.B64Json) != "" {
		return "data:image/png;base64," + strings.TrimSpace(item.B64Json)
	}
	return ""
}

func insertPlaygroundMediaTask(c *gin.Context, action string, modelName string, responseBody []byte, resultURL string) {
	if action == "" || len(responseBody) == 0 || strings.TrimSpace(resultURL) == "" {
		return
	}

	resolvedModelName := strings.TrimSpace(modelName)
	if resolvedModelName == "" {
		resolvedModelName = common.GetContextKeyString(c, constant.ContextKeyOriginalModel)
	}
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
			OriginModelName:   resolvedModelName,
			UpstreamModelName: resolvedModelName,
		},
		Data: json.RawMessage(responseBody),
	}
	task.PrivateData.ResultURL = strings.TrimSpace(resultURL)
	if err := task.Insert(); err != nil {
		common.SysError("insert playground media task error: " + err.Error())
	}
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

	insertPlaygroundMediaTask(
		c,
		action,
		common.GetContextKeyString(c, constant.ContextKeyOriginalModel),
		responseBody,
		resultURL,
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
		return strings.TrimSpace(common.Interface2String(typedValue["url"]))
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

func recordPlaygroundChatMediaTask(c *gin.Context, meta playgroundChatRequestMeta, responseBody []byte) {
	if meta.IsStream || len(responseBody) == 0 {
		return
	}

	imageURLs, videoURLs := extractPlaygroundChatMediaURLs(responseBody)
	action := inferPlaygroundChatTaskAction(meta, imageURLs, videoURLs)
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
		return
	}

	insertPlaygroundMediaTask(c, action, meta.ModelName, responseBody, resultURL)
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

	requestMeta := readPlaygroundChatRequestMeta(c)
	if requestMeta.IsStream {
		Relay(c, types.RelayFormatOpenAI)
		return
	}

	bodyCaptureWriter := &playgroundBodyCaptureWriter{ResponseWriter: c.Writer}
	c.Writer = bodyCaptureWriter
	Relay(c, types.RelayFormatOpenAI)
	if bodyCaptureWriter.Status() >= 200 && bodyCaptureWriter.Status() < 300 {
		recordPlaygroundChatMediaTask(c, requestMeta, bodyCaptureWriter.body.Bytes())
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
