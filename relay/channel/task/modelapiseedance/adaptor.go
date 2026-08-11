package modelapiseedance

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
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

func (a *TaskAdaptor) ValidateRequestAfterModelMapping(c *gin.Context, info *relaycommon.RelayInfo) *dto.TaskError {
	if c == nil || c.Request == nil || c.Request.URL == nil || c.Request.Method != http.MethodPost || c.Request.URL.Path != "/v1/videos" {
		return taskError(fmt.Errorf("this channel type is only available on /v1/videos"), "invalid_request", http.StatusBadRequest)
	}
	seedReq, err := bindModelAPISeedanceRequestAfterAssetRewrite(c, info)
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

func (a *TaskAdaptor) ValidateTaskPriceData(info *relaycommon.RelayInfo) *dto.TaskError {
	if !validModelAPIPriceData(info) {
		return taskError(fmt.Errorf("model price must be a positive finite fixed price"), "model_price_error", http.StatusBadRequest)
	}
	return nil
}

func (a *TaskAdaptor) EstimateBilling(c *gin.Context, info *relaycommon.RelayInfo) map[string]float64 {
	if c == nil || !validModelAPIPriceData(info) {
		return nil
	}
	seedReq, err := taskcommon.GetSeedanceRequest(c)
	if err != nil || seedReq == nil {
		return nil
	}

	duration := 5
	if seedReq.Duration != nil {
		duration = *seedReq.Duration
	}
	resolution := seedReq.Resolution
	if resolution == "" {
		resolution = "720p"
	}

	estimatedUSD, ok := modelAPIEstimatedUSD(resolution, duration, len(seedReq.Videos()) > 0)
	if !ok {
		return nil
	}
	return modelAPIBillingUnits(info.PriceData.ModelPrice, estimatedUSD)
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
	seedReq, err := taskcommon.GetSeedanceRequest(c)
	if err != nil {
		return nil, err
	}
	rewriteMap, _ := common.GetContextKeyType[map[string]string](c, constant.ContextKeyAssetRewriteMap)
	if err := rewriteModelAPIAssetReferences(seedReq, rewriteMap); err != nil {
		return nil, err
	}
	if err := validateModelAPISeedanceRequest(seedReq); err != nil {
		return nil, err
	}
	taskcommon.SetSeedanceRequest(c, seedReq)
	body := buildModelAPICreateRequest(seedReq)
	data, err := common.MarshalNoHTMLEscape(body)
	if err != nil {
		return nil, err
	}
	return bytes.NewReader(data), nil
}

func (a *TaskAdaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Response, error) {
	requestInfo := info
	if info != nil {
		proxy := strings.TrimSpace(info.ChannelSetting.Proxy)
		if proxy != "" {
			return nil, errModelAPISeedanceProxyUnsupported()
		}
		if info.ChannelSetting.Proxy != "" {
			scopedInfo := *info
			if info.ChannelMeta != nil {
				scopedMeta := *info.ChannelMeta
				scopedMeta.ChannelSetting.Proxy = ""
				scopedInfo.ChannelMeta = &scopedMeta
			}
			requestInfo = &scopedInfo
		}
	}
	resp, err := channel.DoTaskApiRequest(a, c, requestInfo, requestBody)
	if resp != nil && resp.StatusCode == http.StatusCreated {
		resp.StatusCode = http.StatusOK
	}
	return resp, err
}

func (a *TaskAdaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (taskID string, taskData []byte, taskErr *dto.TaskError) {
	defer func() { _ = resp.Body.Close() }()
	responseBody, err := io.ReadAll(io.LimitReader(resp.Body, maxModelAPISubmitResponseBytes+1))
	if err != nil {
		return "", nil, taskError(fmt.Errorf("failed to read upstream response"), "read_response_body_failed", http.StatusInternalServerError)
	}
	if len(responseBody) > maxModelAPISubmitResponseBytes {
		return "", nil, taskError(fmt.Errorf("invalid upstream response"), "invalid_response", http.StatusBadGateway)
	}

	submit, estimatedUSD, err := parseModelAPISubmitResponse(responseBody)
	if err != nil {
		return "", nil, taskError(fmt.Errorf("invalid upstream response"), "invalid_response", http.StatusBadGateway)
	}
	if submit.Status == modelAPIStatusFailed {
		return "", nil, taskError(fmt.Errorf("%s", modelAPIFailureReason()), "upstream_error", modelAPISubmitFailureStatusCode(submit.Error))
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
	snapshot := modelAPISubmitTaskData{Status: submit.Status}
	if estimatedUSD != nil {
		snapshot.EstimatedUSD = estimatedUSD
	}
	taskData, err = common.Marshal(snapshot)
	if err != nil {
		return "", nil, taskError(fmt.Errorf("failed to persist submit status"), "invalid_response", http.StatusBadGateway)
	}
	return submit.TaskID, taskData, nil
}

func (a *TaskAdaptor) AdjustBillingOnSubmit(info *relaycommon.RelayInfo, taskData []byte) map[string]float64 {
	if !validModelAPIPriceData(info) {
		return nil
	}
	var snapshot modelAPISubmitTaskData
	if err := common.Unmarshal(taskData, &snapshot); err != nil {
		return nil
	}
	if snapshot.EstimatedUSD == nil || !validPositiveFinite(*snapshot.EstimatedUSD) {
		return nil
	}
	return modelAPIBillingUnits(info.PriceData.ModelPrice, *snapshot.EstimatedUSD)
}

func (a *TaskAdaptor) GetModelList() []string {
	return ModelList
}

func (a *TaskAdaptor) GetChannelName() string {
	return ChannelName
}

func (a *TaskAdaptor) FetchTask(baseURL string, key string, body map[string]any, proxy string) (*http.Response, error) {
	return a.FetchTaskWithContext(context.Background(), baseURL, key, body, proxy)
}

func (a *TaskAdaptor) FetchTaskWithContext(ctx context.Context, baseURL string, key string, body map[string]any, proxy string) (*http.Response, error) {
	if ctx == nil {
		ctx = context.Background()
	}
	proxy = strings.TrimSpace(proxy)
	if proxy != "" {
		return nil, errModelAPISeedanceProxyUnsupported()
	}
	taskID, ok := body["task_id"].(string)
	if !ok || strings.TrimSpace(taskID) == "" {
		return nil, fmt.Errorf("invalid task_id")
	}
	baseURL = strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if baseURL == "" {
		baseURL = constant.ChannelBaseURLs[constant.ChannelTypeModelAPISeedance]
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, baseURL+"/v1/tasks/"+url.PathEscape(taskID), nil)
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

func errModelAPISeedanceProxyUnsupported() error {
	return fmt.Errorf("this channel type does not support proxy")
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
	TaskID string          `json:"task_id"`
	Status string          `json:"status"`
	Usage  json.RawMessage `json:"usage"`
	Error  modelAPIError   `json:"error"`
}

type modelAPITaskResponse struct {
	TaskID string         `json:"task_id"`
	Status string         `json:"status"`
	Result modelAPIResult `json:"result"`
	Error  modelAPIError  `json:"error"`
}

type modelAPISubmitTaskData struct {
	Status       string   `json:"status,omitempty"`
	EstimatedUSD *float64 `json:"estimated_usd,omitempty"`
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

func modelAPISubmitFailureStatusCode(upstreamErr modelAPIError) int {
	if strings.EqualFold(strings.TrimSpace(upstreamErr.Code), "rate_limit_exceeded") {
		return http.StatusTooManyRequests
	}
	normalizedMessage := strings.ToLower(strings.Join(strings.Fields(upstreamErr.Message), " "))
	if normalizedMessage == "selected model is at capacity" || strings.Contains(normalizedMessage, "selected model is at capacity") {
		return http.StatusTooManyRequests
	}
	return http.StatusBadGateway
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

func parseModelAPISubmitResponse(data []byte) (modelAPISubmitResponse, *float64, error) {
	var submit modelAPISubmitResponse
	if err := common.Unmarshal(data, &submit); err != nil {
		return submit, nil, err
	}
	estimatedUSD := parseModelAPIEstimatedUSD(submit.Usage)
	return submit, estimatedUSD, nil
}

func parseModelAPIEstimatedUSD(usage json.RawMessage) *float64 {
	if len(bytes.TrimSpace(usage)) == 0 || bytes.Equal(bytes.TrimSpace(usage), []byte("null")) {
		return nil
	}
	var parsed struct {
		EstimatedUSD *float64 `json:"estimated_usd"`
	}
	if err := common.Unmarshal(usage, &parsed); err != nil {
		return nil
	}
	if parsed.EstimatedUSD == nil || !validPositiveFinite(*parsed.EstimatedUSD) {
		return nil
	}
	return parsed.EstimatedUSD
}

func validModelAPIPriceData(info *relaycommon.RelayInfo) bool {
	return info != nil && info.PriceData.UsePrice && validPositiveFinite(info.PriceData.ModelPrice)
}

func validPositiveFinite(value float64) bool {
	return value > 0 && !math.IsNaN(value) && !math.IsInf(value, 0)
}

func modelAPIEstimatedUSD(resolution string, duration int, hasVideo bool) (float64, bool) {
	if hasVideo {
		switch resolution {
		case "480p":
			return 0.084 * 30, true
		case "720p":
			return 0.188 * 30, true
		default:
			return 0, false
		}
	}
	switch resolution {
	case "480p":
		return 0.140 * float64(duration), true
	case "720p":
		return 0.314 * float64(duration), true
	default:
		return 0, false
	}
}

func modelAPIBillingUnits(modelPrice, estimatedUSD float64) map[string]float64 {
	if !validPositiveFinite(modelPrice) || !validPositiveFinite(estimatedUSD) {
		return nil
	}
	units := estimatedUSD / modelPrice
	if !validPositiveFinite(units) {
		return nil
	}
	return map[string]float64{modelAPIBillingUnitsKey: units}
}

func bindModelAPISeedanceRequestAfterAssetRewrite(c *gin.Context, info *relaycommon.RelayInfo) (*dto.SeedanceVideoRequest, error) {
	originalReq, err := taskcommon.BindSeedanceRequest(c, info, constant.TaskActionGenerate)
	if err != nil {
		return nil, err
	}
	data, err := common.Marshal(originalReq)
	if err != nil {
		return nil, err
	}
	var req dto.SeedanceVideoRequest
	if err := common.Unmarshal(data, &req); err != nil {
		return nil, err
	}
	rewriteMap, _ := common.GetContextKeyType[map[string]string](c, constant.ContextKeyAssetRewriteMap)
	if err := rewriteModelAPIAssetReferences(&req, rewriteMap); err != nil {
		return nil, err
	}
	if err := req.Validate(); err != nil {
		return nil, err
	}

	taskcommon.SetSeedanceRequest(c, &req)
	return &req, nil
}

func rewriteModelAPIAssetReferences(seedReq *dto.SeedanceVideoRequest, rewriteMap map[string]string) error {
	if seedReq == nil {
		return nil
	}
	for index := range seedReq.Content {
		item := &seedReq.Content[index]
		for _, media := range []*dto.SeedanceURLObject{item.ImageURL, item.VideoURL, item.AudioURL} {
			if media == nil {
				continue
			}
			rawURL := media.URL
			if !service.IsStrictBytePlusAssetURI(rawURL) {
				if strings.HasPrefix(strings.ToLower(strings.TrimSpace(rawURL)), "asset://ast_") {
					return fmt.Errorf("invalid asset reference")
				}
				continue
			}
			upstreamURL, ok := rewriteMap[rawURL]
			if !ok || validateModelAPIAssetRewriteURL(upstreamURL) != nil {
				return fmt.Errorf("invalid asset reference")
			}
			media.URL = upstreamURL
		}
	}
	return nil
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
		if err := validateModelAPIMediaURL(m.URL); err != nil {
			return err
		}
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
		if err := validateModelAPIMediaURL(m.URL); err != nil {
			return err
		}
		videoCount++
		if m.Role != "" && m.Role != dto.SeedanceRoleReferenceVideo {
			return fmt.Errorf("unsupported video role")
		}
	}
	for _, m := range seedReq.Audios() {
		if err := validateModelAPIMediaURL(m.URL); err != nil {
			return err
		}
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

func validateModelAPIMediaURL(raw string) error {
	if err := validateModelAPIHTTPSURL(raw); err != nil {
		return fmt.Errorf("media url is not allowed")
	}
	if err := taskcommon.ValidateRemoteMediaURL(raw); err != nil {
		return fmt.Errorf("media url is not allowed")
	}
	return nil
}

func validateModelAPIAssetRewriteURL(raw string) error {
	if err := validateModelAPIHTTPSURL(raw); err != nil {
		return err
	}
	return validateModelAPIMediaURL(raw)
}

func validateModelAPIHTTPSURL(raw string) error {
	if raw == "" || raw != strings.TrimSpace(raw) {
		return fmt.Errorf("media url must be https")
	}
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" {
		return fmt.Errorf("media url must be https")
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
