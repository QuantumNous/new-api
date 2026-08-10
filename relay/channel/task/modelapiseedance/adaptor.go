package modelapiseedance

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

type TaskAdaptor struct {
	taskcommon.BaseBilling
	ChannelType int
	apiKey      string
	baseURL     string
}

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	if info == nil {
		a.ChannelType = constant.ChannelTypeModelAPISeedance
		a.baseURL = constant.ChannelBaseURLs[constant.ChannelTypeModelAPISeedance]
		return
	}
	a.ChannelType = info.ChannelType
	a.apiKey = info.ApiKey
	a.baseURL = strings.TrimRight(strings.TrimSpace(info.ChannelBaseUrl), "/")
	if a.baseURL == "" {
		a.baseURL = constant.ChannelBaseURLs[constant.ChannelTypeModelAPISeedance]
	}
	info.UpstreamModelName = UpstreamModel
	if info.ChannelMeta != nil {
		info.ChannelMeta.UpstreamModelName = UpstreamModel
	}
}

func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) *dto.TaskError {
	seedReq, err := taskcommon.BindSeedanceRequest(c, info, constant.TaskActionGenerate)
	if err != nil {
		return taskError(err, "invalid_request", http.StatusBadRequest)
	}
	if err := validateModelAPISeedanceRequest(seedReq); err != nil {
		return taskError(err, "invalid_request", http.StatusBadRequest)
	}
	info.UpstreamModelName = UpstreamModel
	if info.ChannelMeta != nil {
		info.ChannelMeta.UpstreamModelName = UpstreamModel
	}
	return nil
}

func (a *TaskAdaptor) BuildRequestURL(_ *relaycommon.RelayInfo) (string, error) {
	return a.baseURL + "/v1/tasks", nil
}

func (a *TaskAdaptor) BuildRequestHeader(_ *gin.Context, req *http.Request, _ *relaycommon.RelayInfo) error {
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+a.apiKey)
	return nil
}

func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, _ *relaycommon.RelayInfo) (io.Reader, error) {
	var seedReq dto.SeedanceVideoRequest
	if err := common.UnmarshalBodyReusable(c, &seedReq); err != nil {
		return nil, err
	}
	if err := validateModelAPISeedanceRequest(&seedReq); err != nil {
		return nil, err
	}
	body := buildModelAPICreateRequest(&seedReq)
	data, err := common.MarshalNoHTMLEscape(body)
	if err != nil {
		return nil, err
	}
	return bytes.NewReader(data), nil
}

func (a *TaskAdaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Response, error) {
	return channel.DoTaskApiRequest(a, c, info, requestBody)
}

func (a *TaskAdaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (taskID string, taskData []byte, taskErr *dto.TaskError) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", nil, taskError(err, "read_response_body_failed", http.StatusInternalServerError)
	}
	_ = resp.Body.Close()

	var submit modelAPISubmitResponse
	if err := common.Unmarshal(responseBody, &submit); err != nil {
		return "", nil, taskError(fmt.Errorf("invalid upstream response"), "invalid_response", http.StatusBadGateway)
	}
	if submit.Status == modelAPIStatusFailed {
		return "", nil, taskError(fmt.Errorf("%s", modelAPIFailureReason()), "upstream_error", http.StatusBadGateway)
	}
	if strings.TrimSpace(submit.TaskID) == "" {
		return "", nil, taskError(fmt.Errorf("upstream response missing task_id"), "invalid_response", http.StatusBadGateway)
	}

	ov := dto.NewOpenAIVideo()
	if info != nil {
		ov.ID = info.PublicTaskID
		ov.TaskID = info.PublicTaskID
		ov.Model = info.OriginModelName
	}
	ov.CreatedAt = time.Now().Unix()
	c.JSON(http.StatusOK, ov)
	taskData, err = common.Marshal(struct {
		Status string `json:"status,omitempty"`
	}{Status: submit.Status})
	if err != nil {
		return "", nil, taskError(fmt.Errorf("failed to persist submit status"), "invalid_response", http.StatusBadGateway)
	}
	return submit.TaskID, taskData, nil
}

func (a *TaskAdaptor) GetModelList() []string {
	return ModelList
}

func (a *TaskAdaptor) GetChannelName() string {
	return ChannelName
}

func (a *TaskAdaptor) FetchTask(baseURL string, key string, body map[string]any, proxy string) (*http.Response, error) {
	taskID, ok := body["task_id"].(string)
	if !ok || strings.TrimSpace(taskID) == "" {
		return nil, fmt.Errorf("invalid task_id")
	}
	baseURL = strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if baseURL == "" {
		baseURL = constant.ChannelBaseURLs[constant.ChannelTypeModelAPISeedance]
	}
	req, err := http.NewRequest(http.MethodGet, baseURL+"/v1/tasks/"+url.PathEscape(taskID), nil)
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

func (a *TaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	var result modelAPITaskResponse
	if err := common.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("invalid task result response")
	}
	info := &relaycommon.TaskInfo{Code: 0, TaskID: result.TaskID}
	switch result.Status {
	case modelAPIStatusPending:
		info.Status = model.TaskStatusQueued
		info.Progress = taskcommon.ProgressQueued
	case modelAPIStatusPolling, modelAPIStatusRunning:
		info.Status = model.TaskStatusInProgress
		info.Progress = taskcommon.ProgressInProgress
	case modelAPIStatusSucceeded:
		videoURL := firstModelAPIVideoURL(result.Result.Assets)
		if videoURL == "" {
			return nil, fmt.Errorf("succeeded task is missing video asset")
		}
		info.Status = model.TaskStatusSuccess
		info.Progress = taskcommon.ProgressComplete
		info.Url = videoURL
	case modelAPIStatusFailed:
		info.Status = model.TaskStatusFailure
		info.Progress = taskcommon.ProgressComplete
		info.Reason = modelAPIFailureReason()
	default:
		info.Status = model.TaskStatusInProgress
		info.Progress = taskcommon.ProgressInProgress
	}
	return info, nil
}

func (a *TaskAdaptor) ConvertToOpenAIVideo(originTask *model.Task) ([]byte, error) {
	ov := dto.NewOpenAIVideo()
	ov.ID = originTask.TaskID
	ov.TaskID = originTask.TaskID
	ov.Status = originTask.Status.ToVideoStatus()
	ov.SetProgressStr(originTask.Progress)
	ov.CreatedAt = originTask.CreatedAt
	ov.CompletedAt = originTask.UpdatedAt
	ov.Model = originTask.Properties.OriginModelName
	if originTask.Status == model.TaskStatusSuccess {
		ov.SetMetadata("url", originTask.GetResultURL())
	}
	if originTask.Status == model.TaskStatusFailure {
		ov.Error = &dto.OpenAIVideoError{
			Message: modelAPIFailureReason(),
		}
	}
	return common.Marshal(ov)
}

func taskError(err error, code string, statusCode int) *dto.TaskError {
	message := ""
	if err != nil {
		message = err.Error()
	}
	return &dto.TaskError{
		Code:       code,
		Message:    message,
		StatusCode: statusCode,
		LocalError: true,
		Error:      err,
	}
}

type modelAPIInputItem struct {
	Role    string `json:"role"`
	Content string `json:"content,omitempty"`
	URL     string `json:"url,omitempty"`
}

type modelAPIInput struct {
	Text  []modelAPIInputItem `json:"text,omitempty"`
	Image []modelAPIInputItem `json:"image,omitempty"`
	Video []modelAPIInputItem `json:"video,omitempty"`
	Audio []modelAPIInputItem `json:"audio,omitempty"`
}

type modelAPIParams struct {
	Duration        *int   `json:"duration,omitempty"`
	Resolution      string `json:"resolution,omitempty"`
	AspectRatio     string `json:"aspect_ratio,omitempty"`
	Seed            *int   `json:"seed,omitempty"`
	GenerateAudio   *bool  `json:"generate_audio,omitempty"`
	Watermark       *bool  `json:"watermark,omitempty"`
	ReturnLastFrame *bool  `json:"return_last_frame,omitempty"`
}

type modelAPICreateRequest struct {
	Model  string          `json:"model"`
	Input  modelAPIInput   `json:"input"`
	Params *modelAPIParams `json:"params,omitempty"`
}

type modelAPIError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type modelAPIAsset struct {
	Type string `json:"type"`
	URL  string `json:"url"`
}

type modelAPIResult struct {
	Assets []modelAPIAsset `json:"assets"`
}

type modelAPISubmitResponse struct {
	TaskID string        `json:"task_id"`
	Status string        `json:"status"`
	Error  modelAPIError `json:"error"`
}

type modelAPITaskResponse struct {
	TaskID string         `json:"task_id"`
	Status string         `json:"status"`
	Result modelAPIResult `json:"result"`
	Error  modelAPIError  `json:"error"`
}

const (
	modelAPIStatusPending   = "pending"
	modelAPIStatusPolling   = "polling"
	modelAPIStatusRunning   = "running"
	modelAPIStatusSucceeded = "succeeded"
	modelAPIStatusFailed    = "failed"

	modelAPIGenericFailureReason = "task failed at upstream provider"
)

func buildModelAPICreateRequest(seedReq *dto.SeedanceVideoRequest) modelAPICreateRequest {
	body := modelAPICreateRequest{
		Model: UpstreamModel,
		Input: modelAPIInput{
			Text:  []modelAPIInputItem{},
			Image: []modelAPIInputItem{},
			Video: []modelAPIInputItem{},
			Audio: []modelAPIInputItem{},
		},
	}
	if prompt := strings.TrimSpace(seedReq.PromptText()); prompt != "" {
		body.Input.Text = append(body.Input.Text, modelAPIInputItem{Role: "prompt", Content: prompt})
	}
	for _, m := range seedReq.Images() {
		body.Input.Image = append(body.Input.Image, modelAPIInputItem{Role: modelAPIImageRole(m.Role), URL: m.URL})
	}
	for _, m := range seedReq.Videos() {
		body.Input.Video = append(body.Input.Video, modelAPIInputItem{Role: modelAPIReferenceRole, URL: m.URL})
	}
	for _, m := range seedReq.Audios() {
		body.Input.Audio = append(body.Input.Audio, modelAPIInputItem{Role: modelAPIReferenceRole, URL: m.URL})
	}
	params := modelAPIParams{
		Duration:        seedReq.Duration,
		Resolution:      seedReq.Resolution,
		AspectRatio:     seedReq.Ratio,
		Seed:            seedReq.Seed,
		GenerateAudio:   seedReq.GenerateAudio,
		Watermark:       seedReq.Watermark,
		ReturnLastFrame: seedReq.ReturnLastFrame,
	}
	if params.hasAny() {
		body.Params = &params
	}
	return body
}

func modelAPIFailureReason() string {
	return modelAPIGenericFailureReason
}

const modelAPIReferenceRole = "reference"

func modelAPIImageRole(role string) string {
	switch role {
	case dto.SeedanceRoleFirstFrame, dto.SeedanceRoleLastFrame:
		return role
	default:
		return modelAPIReferenceRole
	}
}

func (p modelAPIParams) hasAny() bool {
	return p.Duration != nil ||
		p.Resolution != "" ||
		p.AspectRatio != "" ||
		p.Seed != nil ||
		p.GenerateAudio != nil ||
		p.Watermark != nil ||
		p.ReturnLastFrame != nil
}

var supportedModelAPIResolutions = map[string]struct{}{
	"480p": {},
	"720p": {},
}

var supportedModelAPIAspectRatios = map[string]struct{}{
	"16:9":     {},
	"4:3":      {},
	"1:1":      {},
	"3:4":      {},
	"9:16":     {},
	"adaptive": {},
}

func validateModelAPISeedanceRequest(seedReq *dto.SeedanceVideoRequest) error {
	if seedReq.Duration != nil && (*seedReq.Duration < 4 || *seedReq.Duration > 30) {
		return fmt.Errorf("duration must be between 4 and 30")
	}
	if seedReq.Resolution != "" {
		if _, ok := supportedModelAPIResolutions[seedReq.Resolution]; !ok {
			return fmt.Errorf("unsupported resolution")
		}
	}
	if seedReq.Ratio != "" {
		if _, ok := supportedModelAPIAspectRatios[seedReq.Ratio]; !ok {
			return fmt.Errorf("unsupported aspect_ratio")
		}
	}

	imageCount, videoCount, audioCount := 0, 0, 0
	firstFrameCount, lastFrameCount := 0, 0
	for _, m := range seedReq.Images() {
		imageCount++
		switch m.Role {
		case "", dto.SeedanceRoleReferenceImage:
		case dto.SeedanceRoleFirstFrame:
			firstFrameCount++
		case dto.SeedanceRoleLastFrame:
			lastFrameCount++
		default:
			return fmt.Errorf("unsupported image role")
		}
	}
	for _, m := range seedReq.Videos() {
		videoCount++
		if m.Role != "" && m.Role != dto.SeedanceRoleReferenceVideo {
			return fmt.Errorf("unsupported video role")
		}
	}
	for _, m := range seedReq.Audios() {
		audioCount++
		if m.Role != "" && m.Role != dto.SeedanceRoleReferenceAudio {
			return fmt.Errorf("unsupported audio role")
		}
	}

	if imageCount > 30 {
		return fmt.Errorf("image references exceed limit")
	}
	if videoCount > 10 {
		return fmt.Errorf("video references exceed limit")
	}
	if audioCount > 10 {
		return fmt.Errorf("audio references exceed limit")
	}
	if imageCount+videoCount+audioCount > 50 {
		return fmt.Errorf("media references exceed limit")
	}
	if firstFrameCount > 1 {
		return fmt.Errorf("first_frame supports at most one image")
	}
	if lastFrameCount > 1 {
		return fmt.Errorf("last_frame supports at most one image")
	}
	if lastFrameCount > 0 && firstFrameCount == 0 {
		return fmt.Errorf("last_frame requires first_frame")
	}
	return nil
}

func firstModelAPIVideoURL(assets []modelAPIAsset) string {
	for _, asset := range assets {
		if asset.Type == "video" && strings.TrimSpace(asset.URL) != "" {
			return asset.URL
		}
	}
	return ""
}
