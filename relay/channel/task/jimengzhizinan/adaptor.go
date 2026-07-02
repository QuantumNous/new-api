package jimengzhizinan

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"slices"
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
	"github.com/pkg/errors"
)

const maxInputImages = 2

type generationPayload struct {
	Model      string   `json:"model"`
	Prompt     string   `json:"prompt"`
	Ratio      string   `json:"ratio,omitempty"`
	Resolution string   `json:"resolution,omitempty"`
	Duration   int      `json:"duration,omitempty"`
	FilePaths  []string `json:"file_paths,omitempty"`
}

type videoDataItem struct {
	URL string `json:"url"`
}

type generationResponse struct {
	Data    []videoDataItem `json:"data"`
	Error   any             `json:"error,omitempty"`
	Message string          `json:"message,omitempty"`
}

type pollResponse struct {
	Status  string          `json:"status"`
	Data    []videoDataItem `json:"data"`
	Error   any             `json:"error,omitempty"`
	Message string          `json:"message,omitempty"`
}

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

func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) *dto.TaskError {
	seedReq, err := taskcommon.BindSeedanceRequest(c, info, constant.TaskActionGenerate)
	if err != nil {
		return service.TaskErrorWrapperLocal(err, "invalid_request", http.StatusBadRequest)
	}
	images, err := validateSeedanceInput(seedReq)
	if err != nil {
		return service.TaskErrorWrapperLocal(err, "invalid_request", http.StatusBadRequest)
	}
	relaycommon.StoreTaskRequest(c, info, constant.TaskActionGenerate, taskSubmitReqFromSeedance(seedReq, images))
	return nil
}

func (a *TaskAdaptor) BuildRequestURL(_ *relaycommon.RelayInfo) (string, error) {
	return fmt.Sprintf("%s/v1/videos/generations", strings.TrimRight(a.baseURL, "/")), nil
}

func (a *TaskAdaptor) BuildRequestHeader(_ *gin.Context, req *http.Request, _ *relaycommon.RelayInfo) error {
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+a.apiKey)
	return nil
}

func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	var seedReq dto.SeedanceVideoRequest
	if err := common.UnmarshalBodyReusable(c, &seedReq); err != nil {
		return nil, err
	}
	images, err := validateSeedanceInput(&seedReq)
	if err != nil {
		return nil, err
	}
	body := buildGenerationPayload(&seedReq, images)
	if info.IsModelMapped {
		body.Model = info.UpstreamModelName
	} else {
		info.UpstreamModelName = body.Model
	}
	data, err := common.MarshalNoHTMLEscape(body)
	if err != nil {
		return nil, err
	}
	return bytes.NewReader(data), nil
}

func buildGenerationPayload(req *dto.SeedanceVideoRequest, images []string) *generationPayload {
	p := &generationPayload{
		Model:      req.Model,
		Prompt:     req.PromptText(),
		Ratio:      req.Ratio,
		Resolution: req.Resolution,
	}
	if req.Duration != nil && *req.Duration > 0 {
		p.Duration = *req.Duration
	}
	if len(images) > 0 {
		p.FilePaths = images
	}
	return p
}

func (a *TaskAdaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Response, error) {
	return channel.DoTaskApiRequest(a, c, info, requestBody)
}

func (a *TaskAdaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (taskID string, taskData []byte, taskErr *dto.TaskError) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		taskErr = service.TaskErrorWrapper(err, "read_response_body_failed", http.StatusInternalServerError)
		return
	}
	_ = resp.Body.Close()

	var upstream generationResponse
	if err := common.Unmarshal(responseBody, &upstream); err != nil {
		taskErr = service.TaskErrorWrapper(errors.Wrap(err, "jimeng zhizinan generation response was invalid"), "unmarshal_response_body_failed", http.StatusBadGateway)
		return
	}
	videoURL := firstURL(upstream.Data)
	if videoURL == "" {
		taskErr = service.TaskErrorWrapper(fmt.Errorf("jimeng zhizinan generation returned no video url"), "invalid_response", http.StatusBadGateway)
		return
	}

	taskData, err = completedPollBody(videoURL)
	if err != nil {
		taskErr = service.TaskErrorWrapper(err, "marshal_response_body_failed", http.StatusInternalServerError)
		return
	}

	ov := dto.NewOpenAIVideo()
	ov.ID = info.PublicTaskID
	ov.TaskID = info.PublicTaskID
	ov.CreatedAt = time.Now().Unix()
	ov.Model = info.OriginModelName
	c.JSON(http.StatusOK, ov)
	return videoURL, taskData, nil
}

func (a *TaskAdaptor) FetchTask(_ string, _ string, body map[string]any, _ string) (*http.Response, error) {
	videoURL, ok := body["task_id"].(string)
	if !ok || strings.TrimSpace(videoURL) == "" {
		return syntheticPollResponse(pollResponse{
			Status:  string(model.TaskStatusFailure),
			Message: "invalid generated video url",
		})
	}
	if err := validateVideoURL(videoURL); err != nil {
		return syntheticPollResponse(pollResponse{
			Status:  string(model.TaskStatusFailure),
			Message: "invalid generated video url",
		})
	}
	bodyBytes, err := completedPollBody(videoURL)
	if err != nil {
		return nil, err
	}
	return &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(bytes.NewReader(bodyBytes)),
	}, nil
}

func (a *TaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	var pr pollResponse
	if err := common.Unmarshal(respBody, &pr); err != nil {
		return nil, errors.Wrap(err, "unmarshal task result failed")
	}
	info := &relaycommon.TaskInfo{Code: 0}
	switch strings.ToLower(strings.TrimSpace(pr.Status)) {
	case strings.ToLower(string(model.TaskStatusSuccess)), "completed", "succeeded":
		url := firstURL(pr.Data)
		if url == "" {
			info.Status = model.TaskStatusFailure
			info.Progress = taskcommon.ProgressComplete
			info.Reason = "jimeng zhizinan generation completed without result url"
			break
		}
		info.Status = model.TaskStatusSuccess
		info.Progress = taskcommon.ProgressComplete
		info.Url = url
	case strings.ToLower(string(model.TaskStatusFailure)), "failed":
		info.Status = model.TaskStatusFailure
		info.Progress = taskcommon.ProgressComplete
		info.Reason = failReason(pr)
	default:
		if url := firstURL(pr.Data); url != "" {
			info.Status = model.TaskStatusSuccess
			info.Progress = taskcommon.ProgressComplete
			info.Url = url
			break
		}
		info.Status = model.TaskStatusFailure
		info.Progress = taskcommon.ProgressComplete
		info.Reason = failReason(pr)
	}
	return info, nil
}

func completedPollBody(videoURL string) ([]byte, error) {
	return common.Marshal(pollResponse{
		Status: string(model.TaskStatusSuccess),
		Data:   []videoDataItem{{URL: videoURL}},
	})
}

func syntheticPollResponse(pr pollResponse) (*http.Response, error) {
	body, err := common.Marshal(pr)
	if err != nil {
		return nil, err
	}
	return &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(bytes.NewReader(body)),
	}, nil
}

func firstURL(items []videoDataItem) string {
	if len(items) == 0 {
		return ""
	}
	return strings.TrimSpace(items[0].URL)
}

func failReason(pr pollResponse) string {
	if strings.TrimSpace(pr.Message) != "" || pr.Error != nil {
		return "jimeng zhizinan video generation failed"
	}
	return "jimeng zhizinan video generation failed"
}

// ExtractUpstreamVideoURL resolves the real video URL persisted in task.Data.
// Customer-facing URLs for this channel point at /v1/videos/{task_id}/content.
func ExtractUpstreamVideoURL(taskData []byte) string {
	if len(taskData) == 0 {
		return ""
	}
	var pr pollResponse
	if err := common.Unmarshal(taskData, &pr); err != nil {
		return ""
	}
	return firstURL(pr.Data)
}

func taskSubmitReqFromSeedance(req *dto.SeedanceVideoRequest, images []string) relaycommon.TaskSubmitReq {
	taskReq := relaycommon.TaskSubmitReq{
		Model:      req.Model,
		Prompt:     req.PromptText(),
		Resolution: req.Resolution,
		Ratio:      req.Ratio,
	}
	if req.Duration != nil && *req.Duration > 0 {
		taskReq.Duration = *req.Duration
	}
	taskReq.Images = slices.Clone(images)
	return taskReq
}

func validateSeedanceInput(req *dto.SeedanceVideoRequest) ([]string, error) {
	if len(req.Videos()) > 0 {
		return nil, fmt.Errorf("jimeng zhizinan does not support video_url content")
	}
	if len(req.Audios()) > 0 {
		return nil, fmt.Errorf("jimeng zhizinan does not support audio_url content")
	}
	images := req.Images()
	if len(images) > maxInputImages {
		return nil, fmt.Errorf("jimeng zhizinan supports at most %d input images", maxInputImages)
	}
	normalized := make([]string, 0, len(images))
	for _, image := range images {
		trimmed := strings.TrimSpace(image.URL)
		if trimmed == "" {
			return nil, fmt.Errorf("image url must not be empty")
		}
		if err := validateImageURL(trimmed); err != nil {
			return nil, err
		}
		normalized = append(normalized, trimmed)
	}
	return normalized, nil
}

func validateImageURL(raw string) error {
	u, err := url.Parse(raw)
	if err != nil || u.Scheme == "" || u.Host == "" {
		return fmt.Errorf("image url is invalid")
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return fmt.Errorf("image url must use http or https")
	}
	return nil
}

func validateVideoURL(raw string) error {
	u, err := url.Parse(raw)
	if err != nil || u.Scheme == "" || u.Host == "" {
		return fmt.Errorf("video url is invalid")
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return fmt.Errorf("video url must use http or https")
	}
	return nil
}

func (a *TaskAdaptor) GetModelList() []string {
	return ModelList
}

func (a *TaskAdaptor) GetChannelName() string {
	return ChannelName
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
			Message: originTask.FailReason,
		}
	}
	return common.Marshal(ov)
}
