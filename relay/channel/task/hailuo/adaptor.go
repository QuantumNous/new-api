package hailuo

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/pkg/errors"

	"github.com/QuantumNous/new-api/constant"
	taskdto "github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/channel"
	taskcommon "github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/service"
)

// https://platform.minimaxi.com/docs/api-reference/video-generation-intro
type TaskAdaptor struct {
	taskcommon.BaseBilling
	ChannelType int
	apiKey      string
	baseURL     string
}

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	a.ChannelType = info.ChannelType
	a.baseURL = info.ChannelBaseUrl
	a.apiKey = info.ApiKey
}

// isV2Model 判断模型是否走 MiniMax H3 V2 接口（/v2/video_generation）。
func isV2Model(model string) bool {
	return model == "MiniMax-H3"
}

func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) (taskErr *taskdto.TaskError) {
	// 校验发生在 ModelMappedHelper 之前，这里先解析渠道模型映射，
	// 确保别名（如 h3 -> MiniMax-H3）也走 V2 校验。
	if isV2Model(resolveUpstreamModel(c, info.OriginModelName)) {
		return validateV2Request(c, info)
	}
	return relaycommon.ValidateBasicTaskRequest(c, info, constant.TaskActionGenerate)
}

// resolveUpstreamModel 解析渠道模型映射后的最终上游模型名（链式、带循环保护）。
// 语义与 relay/helper.ModelMappedHelper 保持一致；解析失败时回退到原始模型名。
func resolveUpstreamModel(c *gin.Context, originModel string) string {
	mappingStr := common.GetContextKeyString(c, constant.ContextKeyChannelModelMapping)
	if mappingStr == "" || mappingStr == "{}" || originModel == "" {
		return originModel
	}
	var modelMap map[string]string
	if err := common.UnmarshalJsonStr(mappingStr, &modelMap); err != nil {
		return originModel
	}
	current := originModel
	visited := map[string]bool{current: true}
	for {
		mapped, exists := modelMap[current]
		if !exists || mapped == "" || visited[mapped] {
			break
		}
		visited[mapped] = true
		current = mapped
	}
	return current
}

func validateV2Request(c *gin.Context, info *relaycommon.RelayInfo) *taskdto.TaskError {
	if taskErr := relaycommon.ValidateBasicTaskRequest(c, info, constant.TaskActionGenerate); taskErr != nil {
		return taskErr
	}

	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return service.TaskErrorWrapperLocal(err, "invalid_request", http.StatusBadRequest)
	}

	// duration 必须落在 [4, 15]，同时作为计费倍率（seconds）必须先于估价钳制。
	if req.Duration > 0 && (req.Duration < V2MinDurationSeconds || req.Duration > V2MaxDurationSeconds) {
		return service.TaskErrorWrapperLocal(
			fmt.Errorf("duration must be between %d and %d for MiniMax-H3", V2MinDurationSeconds, V2MaxDurationSeconds),
			"invalid_duration", http.StatusBadRequest)
	}
	if req.Duration == 0 {
		req.Duration = V2DefaultDuration
	}

	// resolution 仅支持 768P / 2K。
	if req.Size != "" && normalizeV2Resolution(req.Size) == "" {
		return service.TaskErrorWrapperLocal(fmt.Errorf("resolution must be 768P or 2K for MiniMax-H3"), "invalid_resolution", http.StatusBadRequest)
	}

	// ratio 必须是 V2 允许的值。
	if ratio, ok := req.Metadata["ratio"].(string); ok && ratio != "" && !isValidV2Ratio(ratio) {
		return service.TaskErrorWrapperLocal(fmt.Errorf("invalid ratio %q for MiniMax-H3", ratio), "invalid_ratio", http.StatusBadRequest)
	}

	// 图生视频（首帧/首尾帧）最多 2 张图片。
	if len(req.Images) > V2MaxFrameImages {
		return service.TaskErrorWrapperLocal(fmt.Errorf("at most %d images are supported for image-to-video", V2MaxFrameImages), "invalid_image_count", http.StatusBadRequest)
	}

	// metadata.content 透传路径也要做输入数量上限校验（图片/视频/音频都是计费相关输入）。
	if raw, ok := req.Metadata["content"]; ok && raw != nil {
		if taskErr := validateV2ContentCounts(raw); taskErr != nil {
			return taskErr
		}
	}
	if n := len(metadataURLList(req.Metadata, "reference_video")); n > V2MaxReferenceVideos {
		return service.TaskErrorWrapperLocal(fmt.Errorf("at most %d reference videos are supported", V2MaxReferenceVideos), "invalid_video_count", http.StatusBadRequest)
	}
	if n := len(metadataURLList(req.Metadata, "reference_audio")); n > V2MaxReferenceAudios {
		return service.TaskErrorWrapperLocal(fmt.Errorf("at most %d reference audios are supported", V2MaxReferenceAudios), "invalid_audio_count", http.StatusBadRequest)
	}

	c.Set("task_request", req)
	return nil
}

func isValidV2Ratio(ratio string) bool {
	for _, r := range V2AllowedRatios {
		if ratio == r {
			return true
		}
	}
	return false
}

func validateV2ContentCounts(raw any) *taskdto.TaskError {
	items, ok := raw.([]any)
	if !ok {
		return service.TaskErrorWrapperLocal(fmt.Errorf("metadata.content must be an array"), "invalid_content", http.StatusBadRequest)
	}
	var images, videos, audios int
	for _, item := range items {
		m, ok := item.(map[string]any)
		if !ok {
			continue
		}
		switch m["type"] {
		case "image_url":
			images++
		case "video_url":
			videos++
		case "audio_url":
			audios++
		}
	}
	if images > V2MaxReferenceImages {
		return service.TaskErrorWrapperLocal(fmt.Errorf("at most %d reference images are supported", V2MaxReferenceImages), "invalid_image_count", http.StatusBadRequest)
	}
	if videos > V2MaxReferenceVideos {
		return service.TaskErrorWrapperLocal(fmt.Errorf("at most %d reference videos are supported", V2MaxReferenceVideos), "invalid_video_count", http.StatusBadRequest)
	}
	if audios > V2MaxReferenceAudios {
		return service.TaskErrorWrapperLocal(fmt.Errorf("at most %d reference audios are supported", V2MaxReferenceAudios), "invalid_audio_count", http.StatusBadRequest)
	}
	return nil
}

func (a *TaskAdaptor) BuildRequestURL(info *relaycommon.RelayInfo) (string, error) {
	if isV2Model(info.UpstreamModelName) {
		return fmt.Sprintf("%s%s", a.baseURL, VideoGenerationV2Endpoint), nil
	}
	return fmt.Sprintf("%s%s", a.baseURL, TextToVideoEndpoint), nil
}

func (a *TaskAdaptor) BuildRequestHeader(c *gin.Context, req *http.Request, info *relaycommon.RelayInfo) error {
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+a.apiKey)
	return nil
}

func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	v, exists := c.Get("task_request")
	if !exists {
		return nil, fmt.Errorf("request not found in context")
	}
	req, ok := v.(relaycommon.TaskSubmitReq)
	if !ok {
		return nil, fmt.Errorf("invalid request type in context")
	}

	var body any
	var err error
	if isV2Model(info.UpstreamModelName) {
		body, err = buildV2RequestPayload(&req, info)
	} else {
		body, err = a.convertToRequestPayload(&req, info)
	}
	if err != nil {
		return nil, errors.Wrap(err, "convert request payload failed")
	}

	data, err := common.Marshal(body)
	if err != nil {
		return nil, err
	}

	return bytes.NewReader(data), nil
}

// buildV2RequestPayload 构造 MiniMax H3 V2 的创建任务请求体。
func buildV2RequestPayload(req *relaycommon.TaskSubmitReq, info *relaycommon.RelayInfo) (*VideoGenerationV2Request, error) {
	content, err := buildV2Content(req)
	if err != nil {
		return nil, err
	}
	if len(content) == 0 {
		return nil, fmt.Errorf("content is empty")
	}

	videoRequest := &VideoGenerationV2Request{
		Model:      info.UpstreamModelName,
		Content:    content,
		Resolution: resolveV2Resolution(req.Size, req.Metadata),
		Duration:   req.Duration,
		Ratio:      resolveV2Ratio(req),
	}
	if callbackURL, ok := req.Metadata["callback_url"].(string); ok {
		videoRequest.CallbackURL = callbackURL
	}
	if watermark, ok := req.Metadata["aigc_watermark"].(bool); ok {
		videoRequest.AigcWatermark = &watermark
	}
	return videoRequest, nil
}

// buildV2Content 构造 V2 content 数组：
// - metadata.content 透传优先（完整多模态引用场景），缺失非空 text 项时自动补充 prompt；
// - 否则由 prompt + images（首帧/首尾帧）+ reference_video/reference_audio 组装。
func buildV2Content(req *relaycommon.TaskSubmitReq) ([]V2ContentItem, error) {
	if raw, ok := req.Metadata["content"]; ok && raw != nil {
		items, err := parseV2ContentItems(raw)
		if err != nil {
			return nil, err
		}
		hasText := false
		for _, item := range items {
			if item.Type == "text" && strings.TrimSpace(item.Text) != "" {
				hasText = true
				break
			}
		}
		if !hasText {
			items = append([]V2ContentItem{{Type: "text", Text: req.Prompt}}, items...)
		}
		return items, nil
	}

	content := make([]V2ContentItem, 0, 4)
	content = append(content, V2ContentItem{Type: "text", Text: req.Prompt})

	switch len(req.Images) {
	case 1:
		content = append(content, v2MediaItem("image_url", req.Images[0], "first_frame"))
	case 2:
		content = append(content,
			v2MediaItem("image_url", req.Images[0], "first_frame"),
			v2MediaItem("image_url", req.Images[1], "last_frame"),
		)
	}

	for _, u := range metadataURLList(req.Metadata, "reference_video") {
		content = append(content, v2MediaItem("video_url", u, "reference_video"))
	}
	for _, u := range metadataURLList(req.Metadata, "reference_audio") {
		content = append(content, v2MediaItem("audio_url", u, "reference_audio"))
	}
	return content, nil
}

func parseV2ContentItems(raw any) ([]V2ContentItem, error) {
	data, err := common.Marshal(raw)
	if err != nil {
		return nil, errors.Wrap(err, "marshal metadata content failed")
	}
	var items []V2ContentItem
	if err := common.Unmarshal(data, &items); err != nil {
		return nil, errors.Wrap(err, "unmarshal metadata content failed")
	}
	return items, nil
}

func v2MediaItem(itemType, url, role string) V2ContentItem {
	item := V2ContentItem{Type: itemType, Role: role}
	switch itemType {
	case "image_url":
		item.ImageURL = &V2MediaURL{URL: url}
	case "video_url":
		item.VideoURL = &V2MediaURL{URL: url}
	case "audio_url":
		item.AudioURL = &V2MediaURL{URL: url}
	}
	return item
}

// metadataURLList 读取 metadata 中的 URL 字段，支持单字符串或字符串数组。
func metadataURLList(metadata map[string]any, key string) []string {
	raw, ok := metadata[key]
	if !ok || raw == nil {
		return nil
	}
	switch v := raw.(type) {
	case string:
		if strings.TrimSpace(v) != "" {
			return []string{v}
		}
	case []any:
		var urls []string
		for _, u := range v {
			if s, ok := u.(string); ok && strings.TrimSpace(s) != "" {
				urls = append(urls, s)
			}
		}
		return urls
	case []string:
		return v
	}
	return nil
}

// normalizeV2Resolution 将 size 归一化为 V2 分辨率；不支持的 size 返回空串。
func normalizeV2Resolution(size string) string {
	switch {
	case strings.Contains(size, "2K"):
		return V2Resolution2K
	case strings.Contains(size, "768"):
		return Resolution768P
	default:
		return ""
	}
}

func resolveV2Resolution(size string, metadata map[string]any) string {
	if r, ok := metadata["resolution"].(string); ok && r != "" {
		if v := normalizeV2Resolution(r); v != "" {
			return v
		}
	}
	if v := normalizeV2Resolution(size); v != "" {
		return v
	}
	return Resolution768P
}

func resolveV2Ratio(req *relaycommon.TaskSubmitReq) string {
	if ratio, ok := req.Metadata["ratio"].(string); ok && ratio != "" {
		return ratio
	}
	if hasV2VisualInput(req) {
		return "adaptive"
	}
	return V2DefaultRatio
}

func hasV2VisualInput(req *relaycommon.TaskSubmitReq) bool {
	if len(req.Images) > 0 {
		return true
	}
	if raw, ok := req.Metadata["content"]; ok && raw != nil {
		if items, err := parseV2ContentItems(raw); err == nil {
			for _, item := range items {
				if item.Type == "image_url" || item.Type == "video_url" {
					return true
				}
			}
		}
	}
	if len(metadataURLList(req.Metadata, "reference_video")) > 0 {
		return true
	}
	if len(metadataURLList(req.Metadata, "reference_audio")) > 0 {
		return true
	}
	return false
}

func (a *TaskAdaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Response, error) {
	return channel.DoTaskApiRequest(a, c, info, requestBody)
}

func (a *TaskAdaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (taskID string, taskData []byte, taskErr *taskdto.TaskError) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		taskErr = service.TaskErrorWrapper(err, "read_response_body_failed", http.StatusInternalServerError)
		return
	}
	_ = resp.Body.Close()

	if isV2Model(info.UpstreamModelName) {
		var v2Resp VideoGenerationV2Response
		if err := common.Unmarshal(responseBody, &v2Resp); err != nil {
			taskErr = service.TaskErrorWrapper(errors.Wrapf(err, "body: %s", responseBody), "unmarshal_response_body_failed", http.StatusInternalServerError)
			return
		}
		if strings.TrimSpace(v2Resp.TaskID) == "" {
			taskErr = service.TaskErrorWrapper(fmt.Errorf("task_id is empty"), "invalid_response", http.StatusInternalServerError)
			return
		}
		c.JSON(http.StatusOK, newOpenAIVideoResponse(info))
		return v2Resp.TaskID, responseBody, nil
	}

	var hResp VideoResponse
	if err := common.Unmarshal(responseBody, &hResp); err != nil {
		taskErr = service.TaskErrorWrapper(errors.Wrapf(err, "body: %s", responseBody), "unmarshal_response_body_failed", http.StatusInternalServerError)
		return
	}

	if hResp.BaseResp.StatusCode != StatusSuccess {
		taskErr = service.TaskErrorWrapper(
			fmt.Errorf("hailuo api error: %s", hResp.BaseResp.StatusMsg),
			strconv.Itoa(hResp.BaseResp.StatusCode),
			http.StatusBadRequest,
		)
		return
	}

	c.JSON(http.StatusOK, newOpenAIVideoResponse(info))
	return hResp.TaskID, responseBody, nil
}

func newOpenAIVideoResponse(info *relaycommon.RelayInfo) *dto.OpenAIVideo {
	ov := dto.NewOpenAIVideo()
	ov.ID = info.PublicTaskID
	ov.TaskID = info.PublicTaskID
	ov.CreatedAt = time.Now().Unix()
	ov.Model = info.OriginModelName
	return ov
}

func (a *TaskAdaptor) FetchTask(baseUrl, key string, body map[string]any, proxy string) (*http.Response, error) {
	taskID, ok := body["task_id"].(string)
	if !ok {
		return nil, fmt.Errorf("invalid task_id")
	}

	modelName, _ := body["model"].(string)
	uri := ""
	if isV2Model(modelName) {
		uri = fmt.Sprintf("%s%s/%s", baseUrl, QueryTaskV2Endpoint, taskID)
	} else {
		uri = fmt.Sprintf("%s%s?task_id=%s", baseUrl, QueryTaskEndpoint, taskID)
	}

	req, err := http.NewRequest(http.MethodGet, uri, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+key)

	client, err := service.GetHttpClientWithProxy(proxy)
	if err != nil {
		return nil, fmt.Errorf("new proxy http client failed: %w", err)
	}
	return client.Do(req)
}

func (a *TaskAdaptor) GetModelList() []string {
	return ModelList
}

func (a *TaskAdaptor) GetChannelName() string {
	return ChannelName
}

func (a *TaskAdaptor) convertToRequestPayload(req *relaycommon.TaskSubmitReq, info *relaycommon.RelayInfo) (*VideoRequest, error) {
	modelConfig := GetModelConfig(info.UpstreamModelName)
	duration := DefaultDuration
	if req.Duration > 0 {
		duration = req.Duration
	}
	resolution := modelConfig.DefaultResolution
	if req.Size != "" {
		resolution = a.parseResolutionFromSize(req.Size, modelConfig)
	}

	videoRequest := &VideoRequest{
		Model:      info.UpstreamModelName,
		Prompt:     req.Prompt,
		Duration:   &duration,
		Resolution: resolution,
	}
	if err := req.UnmarshalMetadata(&videoRequest); err != nil {
		return nil, errors.Wrap(err, "unmarshal metadata to video request failed")
	}

	return videoRequest, nil
}

func (a *TaskAdaptor) parseResolutionFromSize(size string, modelConfig ModelConfig) string {
	switch {
	case strings.Contains(size, "1080"):
		return Resolution1080P
	case strings.Contains(size, "768"):
		return Resolution768P
	case strings.Contains(size, "720"):
		return Resolution720P
	case strings.Contains(size, "512"):
		return Resolution512P
	default:
		return modelConfig.DefaultResolution
	}
}

// EstimateBilling 仅对 MiniMax H3 V2 生效：按输出秒数与分辨率倍率计费。
// 官方定价 2K 0.80 元/秒、768P 0.50 元/秒，基础模型单价按 768P 每秒配置即可。
func (a *TaskAdaptor) EstimateBilling(c *gin.Context, info *relaycommon.RelayInfo) map[string]float64 {
	if !isV2Model(info.UpstreamModelName) {
		return nil
	}
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil
	}
	seconds := req.Duration
	if seconds < V2MinDurationSeconds {
		seconds = V2MinDurationSeconds
	}
	if seconds > V2MaxDurationSeconds {
		seconds = V2MaxDurationSeconds
	}

	resRatio := 1.0
	if resolveV2Resolution(req.Size, req.Metadata) == V2Resolution2K {
		resRatio = V2ResolutionRatio2K
	}

	return map[string]float64{
		"seconds":    float64(seconds),
		"resolution": resRatio,
	}
}

// ParseTaskResult 同时兼容 V2（{"task": {...}}）与 V1（{"task_id", "base_resp"}）两种查询响应。
func (a *TaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	var v2Resp V2QueryTaskResponse
	if err := common.Unmarshal(respBody, &v2Resp); err == nil && v2Resp.Task != nil {
		return parseV2TaskResult(v2Resp.Task), nil
	}
	return a.parseV1TaskResult(respBody)
}

func parseV2TaskResult(task *V2Task) *relaycommon.TaskInfo {
	taskResult := relaycommon.TaskInfo{Code: 0}
	switch task.Status {
	case V2StatusQueued:
		taskResult.Status = model.TaskStatusQueued
	case V2StatusRunning:
		taskResult.Status = model.TaskStatusInProgress
	case V2StatusSucceeded:
		taskResult.Status = model.TaskStatusSuccess
		if task.Content != nil {
			taskResult.Url = task.Content.URL
		}
	case V2StatusFailed, V2StatusCancelled:
		taskResult.Status = model.TaskStatusFailure
		if task.Error != nil && strings.TrimSpace(task.Error.Message) != "" {
			taskResult.Reason = task.Error.Message
		} else {
			taskResult.Reason = "task " + task.Status
		}
	default:
		taskResult.Status = model.TaskStatusInProgress
	}
	return &taskResult
}

func (a *TaskAdaptor) parseV1TaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	resTask := QueryTaskResponse{}
	if err := common.Unmarshal(respBody, &resTask); err != nil {
		return nil, errors.Wrap(err, "unmarshal task result failed")
	}

	taskResult := relaycommon.TaskInfo{}

	if resTask.BaseResp.StatusCode == StatusSuccess {
		taskResult.Code = 0
	} else {
		taskResult.Code = resTask.BaseResp.StatusCode
		taskResult.Reason = resTask.BaseResp.StatusMsg
		taskResult.Status = model.TaskStatusFailure
		taskResult.Progress = "100%"
	}

	switch resTask.Status {
	case TaskStatusPreparing, TaskStatusQueueing, TaskStatusProcessing:
		taskResult.Status = model.TaskStatusInProgress
		taskResult.Progress = "30%"
		if resTask.Status == TaskStatusProcessing {
			taskResult.Progress = "50%"
		}
	case TaskStatusSuccess:
		taskResult.Status = model.TaskStatusSuccess
		taskResult.Progress = "100%"
		taskResult.Url = a.buildVideoURL(resTask.TaskID, resTask.FileID)
	case TaskStatusFailed:
		taskResult.Status = model.TaskStatusFailure
		taskResult.Progress = "100%"
		if taskResult.Reason == "" {
			taskResult.Reason = "task failed"
		}
	default:
		taskResult.Status = model.TaskStatusInProgress
		taskResult.Progress = "30%"
	}

	return &taskResult, nil
}

func (a *TaskAdaptor) ConvertToOpenAIVideo(originTask *model.Task) ([]byte, error) {
	var v2Resp V2QueryTaskResponse
	if err := common.Unmarshal(originTask.Data, &v2Resp); err == nil && v2Resp.Task != nil {
		return convertToV2OpenAIVideo(originTask, v2Resp.Task)
	}
	return convertV1ToOpenAIVideo(originTask)
}

func convertToV2OpenAIVideo(originTask *model.Task, task *V2Task) ([]byte, error) {
	openAIVideo := originTask.ToOpenAIVideo()
	if task.Status == V2StatusFailed || task.Status == V2StatusCancelled {
		message, code := "", ""
		if task.Error != nil {
			message = task.Error.Message
			code = task.Error.Code
		}
		if message == "" {
			message = "task " + task.Status
		}
		openAIVideo.Error = &dto.OpenAIVideoError{Message: message, Code: code}
	}
	jsonData, err := common.Marshal(openAIVideo)
	if err != nil {
		return nil, errors.Wrap(err, "marshal openai video failed")
	}
	return jsonData, nil
}

func convertV1ToOpenAIVideo(originTask *model.Task) ([]byte, error) {
	var hailuoResp QueryTaskResponse
	if err := common.Unmarshal(originTask.Data, &hailuoResp); err != nil {
		return nil, errors.Wrap(err, "unmarshal hailuo task data failed")
	}

	openAIVideo := originTask.ToOpenAIVideo()
	if hailuoResp.BaseResp.StatusCode != StatusSuccess {
		openAIVideo.Error = &dto.OpenAIVideoError{
			Message: hailuoResp.BaseResp.StatusMsg,
			Code:    strconv.Itoa(hailuoResp.BaseResp.StatusCode),
		}
	}

	jsonData, err := common.Marshal(openAIVideo)
	if err != nil {
		return nil, errors.Wrap(err, "marshal openai video failed")
	}

	return jsonData, nil
}

func (a *TaskAdaptor) buildVideoURL(_, fileID string) string {
	if a.apiKey == "" || a.baseURL == "" {
		return ""
	}

	url := fmt.Sprintf("%s/v1/files/retrieve?file_id=%s", a.baseURL, fileID)

	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return ""
	}

	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+a.apiKey)

	resp, err := service.GetHttpClient().Do(req)
	if err != nil {
		return ""
	}
	defer resp.Body.Close()

	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return ""
	}

	var retrieveResp RetrieveFileResponse
	if err := common.Unmarshal(responseBody, &retrieveResp); err != nil {
		return ""
	}

	if retrieveResp.BaseResp.StatusCode != StatusSuccess {
		return ""
	}

	return retrieveResp.File.DownloadURL
}

func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}

func containsInt(slice []int, item int) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}
