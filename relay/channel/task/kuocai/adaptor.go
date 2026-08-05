package kuocai

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	taskdto "github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel"
	taskcommon "github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	openaidto "github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/pkg/errors"
)

const (
	channelName            = "kuocai"
	videoGenerationsPath   = "/api/v1/video/generations"
	taskPath               = "/api/v1/tasks/%s"
	defaultModelID         = 52
	defaultDurationSeconds = 4
)

type videoRequest struct {
	ModelID         int      `json:"model_id,omitempty"`
	Prompt          string   `json:"prompt"`
	Size            string   `json:"size,omitempty"`
	Seconds         int      `json:"seconds,omitempty"`
	Resolution      string   `json:"resolution,omitempty"`
	Count           int      `json:"count,omitempty"`
	ReferenceImage  string   `json:"reference_image,omitempty"`
	ReferenceImages []string `json:"reference_images,omitempty"`
	FrameStart      string   `json:"frame_start,omitempty"`
	FrameEnd        string   `json:"frame_end,omitempty"`
	ReferenceAudio  string   `json:"reference_audio,omitempty"`
	ReferenceAudios []string `json:"reference_audios,omitempty"`
	ReferenceVideo  string   `json:"reference_video,omitempty"`
	ReferenceVideos []string `json:"reference_videos,omitempty"`
}

type submitEnvelope struct {
	Data struct {
		TaskID string `json:"task_id"`
	} `json:"data"`
	TaskID  string `json:"task_id"`
	Message string `json:"message"`
}

type taskEnvelope struct {
	Data struct {
		TaskID     string   `json:"task_id"`
		Status     string   `json:"status"`
		State      string   `json:"state"`
		Progress   any      `json:"progress"`
		VideoURL   string   `json:"video_url"`
		URL        string   `json:"url"`
		ResultURL  string   `json:"result_url"`
		ResultURLs []string `json:"result_urls"`
		VideoURLs  []string `json:"video_urls"`
		Message    string   `json:"message"`
		Error      string   `json:"error"`
	} `json:"data"`
	TaskID     string   `json:"task_id"`
	Status     string   `json:"status"`
	State      string   `json:"state"`
	Progress   any      `json:"progress"`
	VideoURL   string   `json:"video_url"`
	URL        string   `json:"url"`
	ResultURL  string   `json:"result_url"`
	ResultURLs []string `json:"result_urls"`
	VideoURLs  []string `json:"video_urls"`
	Message    string   `json:"message"`
	Error      string   `json:"error"`
}

type TaskAdaptor struct {
	taskcommon.BaseBilling
	baseURL string
}

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	a.baseURL = strings.TrimRight(info.ChannelBaseUrl, "/")
}

func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) *taskdto.TaskError {
	return relaycommon.ValidateBasicTaskRequest(c, info, constant.TaskActionTextGenerate)
}

func (a *TaskAdaptor) BuildRequestURL(_ *relaycommon.RelayInfo) (string, error) {
	return a.baseURL + videoGenerationsPath, nil
}

func (a *TaskAdaptor) BuildRequestHeader(_ *gin.Context, req *http.Request, info *relaycommon.RelayInfo) error {
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+info.ApiKey)
	return nil
}

func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil, err
	}

	body, err := convertRequest(req, info.UpstreamModelName)
	if err != nil {
		return nil, err
	}
	data, err := common.Marshal(body)
	if err != nil {
		return nil, err
	}
	return bytes.NewReader(data), nil
}

func (a *TaskAdaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Response, error) {
	return channel.DoTaskApiRequest(a, c, info, requestBody)
}

func (a *TaskAdaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (string, []byte, *taskdto.TaskError) {
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", nil, service.TaskErrorWrapper(err, "read_response_body_failed", http.StatusInternalServerError)
	}

	var result submitEnvelope
	if err := common.Unmarshal(body, &result); err != nil {
		return "", nil, service.TaskErrorWrapper(errors.Wrapf(err, "body: %s", body), "unmarshal_response_body_failed", http.StatusInternalServerError)
	}
	taskID := result.Data.TaskID
	if taskID == "" {
		taskID = result.TaskID
	}
	if taskID == "" {
		message := result.Message
		if message == "" {
			message = "Kuocai response does not contain data.task_id"
		}
		return "", nil, service.TaskErrorWrapperLocal(fmt.Errorf("%s", message), "invalid_response", http.StatusBadGateway)
	}

	video := openaidto.NewOpenAIVideo()
	video.ID = info.PublicTaskID
	video.TaskID = info.PublicTaskID
	video.CreatedAt = time.Now().Unix()
	video.Model = info.OriginModelName
	c.JSON(http.StatusOK, video)
	return taskID, body, nil
}

func (a *TaskAdaptor) FetchTask(baseURL, key string, body map[string]any, proxy string) (*http.Response, error) {
	taskID, ok := body["task_id"].(string)
	if !ok || taskID == "" {
		return nil, fmt.Errorf("invalid task_id")
	}
	request, err := http.NewRequest(http.MethodGet, strings.TrimRight(baseURL, "/")+fmt.Sprintf(taskPath, taskID), nil)
	if err != nil {
		return nil, err
	}
	request.Header.Set("Accept", "application/json")
	request.Header.Set("Authorization", "Bearer "+key)
	client, err := service.GetHttpClientWithProxy(proxy)
	if err != nil {
		return nil, fmt.Errorf("new proxy http client failed: %w", err)
	}
	return client.Do(request)
}

func (a *TaskAdaptor) GetModelList() []string {
	return []string{"52", "51", "53", "39", "54"}
}

func (a *TaskAdaptor) GetChannelName() string { return channelName }

func (a *TaskAdaptor) ParseTaskResult(body []byte) (*relaycommon.TaskInfo, error) {
	var response taskEnvelope
	if err := common.Unmarshal(body, &response); err != nil {
		return nil, errors.Wrap(err, "unmarshal Kuocai task response")
	}

	data := response.Data
	status := strings.ToLower(firstNonEmpty(data.Status, data.State, response.Status, response.State))
	result := &relaycommon.TaskInfo{Progress: progressString(firstNonNil(data.Progress, response.Progress))}
	result.Url = firstNonEmpty(data.VideoURL, data.URL, data.ResultURL, response.VideoURL, response.URL, response.ResultURL)
	if result.Url == "" {
		result.Url = firstURL(data.ResultURLs, data.VideoURLs, response.ResultURLs, response.VideoURLs)
	}
	reason := firstNonEmpty(data.Message, data.Error, response.Message, response.Error)

	switch status {
	case "queued", "queueing", "pending", "submitted", "created":
		result.Status = model.TaskStatusQueued
	case "processing", "running", "in_progress", "in-progress":
		result.Status = model.TaskStatusInProgress
	case "success", "succeeded", "completed", "complete":
		result.Status = model.TaskStatusSuccess
	case "failed", "failure", "error", "cancelled", "canceled":
		result.Status = model.TaskStatusFailure
		result.Reason = taskcommon.DefaultString(reason, "Kuocai task failed")
	default:
		return nil, fmt.Errorf("unknown Kuocai task status: %q", status)
	}
	return result, nil
}

func (a *TaskAdaptor) ConvertToOpenAIVideo(task *model.Task) ([]byte, error) {
	video := task.ToOpenAIVideo()
	return common.Marshal(video)
}

func convertRequest(req relaycommon.TaskSubmitReq, upstreamModel string) (*videoRequest, error) {
	modelID := defaultModelID
	if upstreamModel != "" {
		parsed, err := strconv.Atoi(upstreamModel)
		if err != nil {
			return nil, fmt.Errorf("Kuocai model mapping must be a numeric model_id, got %q", upstreamModel)
		}
		modelID = parsed
	}
	body := &videoRequest{
		ModelID: modelID,
		Prompt:  req.Prompt,
		Size:    req.Size,
		Seconds: taskcommon.DefaultInt(req.Duration, defaultDurationSeconds),
		Count:   1,
	}
	if err := req.UnmarshalMetadata(body); err != nil {
		return nil, errors.Wrap(err, "unmarshal Kuocai metadata")
	}
	// Model selection is controlled by the configured channel model mapping.
	body.ModelID = modelID
	return body, nil
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}

func firstURL(values ...[]string) string {
	for _, values := range values {
		if len(values) > 0 && values[0] != "" {
			return values[0]
		}
	}
	return ""
}

func firstNonNil(values ...any) any {
	for _, value := range values {
		if value != nil {
			return value
		}
	}
	return nil
}

func progressString(value any) string {
	switch value := value.(type) {
	case nil:
		return ""
	case string:
		return value
	case float64:
		return strconv.FormatFloat(value, 'f', -1, 64) + "%"
	case json.Number:
		return value.String() + "%"
	default:
		return ""
	}
}
