package runninghub

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel"
	taskcommon "github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
	"github.com/pkg/errors"
)

// ============================
// Request / Response structures
// ============================

// requestPayload 是发送给 runninghub 的请求体（runninghub 原生字段名，camelCase）。
type requestPayload struct {
	Prompt          string   `json:"prompt,omitempty"`
	Resolution      string   `json:"resolution,omitempty"`
	Duration        string   `json:"duration,omitempty"`
	GenerateAudio   *bool    `json:"generateAudio,omitempty"`
	Ratio           string   `json:"ratio,omitempty"`
	WebSearch       *bool    `json:"webSearch,omitempty"`
	ReturnLastFrame *bool    `json:"returnLastFrame,omitempty"`
	Seed            *int64   `json:"seed,omitempty"`
	RealPersonMode  *bool    `json:"realPersonMode,omitempty"`
	ConversionSlots []string `json:"conversionSlots,omitempty"`
	FirstFrameUrl   string   `json:"firstFrameUrl,omitempty"`
	LastFrameUrl    string   `json:"lastFrameUrl,omitempty"`
	ImageUrls       []string `json:"imageUrls,omitempty"`
	VideoUrls       []string `json:"videoUrls,omitempty"`
	AudioUrls       []string `json:"audioUrls,omitempty"`
}

// metadataPayload 从聚合平台请求的 metadata 中解析 ai-service 传入的上游扩展参数。
type metadataPayload struct {
	InputMode       string   `json:"inputMode,omitempty"`
	Resolution      string   `json:"resolution,omitempty"`
	Ratio           string   `json:"ratio,omitempty"`
	GenerateAudio   *bool    `json:"generateAudio,omitempty"`
	WebSearch       *bool    `json:"webSearch,omitempty"`
	ReturnLastFrame *bool    `json:"returnLastFrame,omitempty"`
	Seed            *int64   `json:"seed,omitempty"`
	RealPersonMode  *bool    `json:"realPersonMode,omitempty"`
	ConversionSlots []string `json:"conversionSlots,omitempty"`
	FirstFrameUrl   string   `json:"firstFrameUrl,omitempty"`
	LastFrameUrl    string   `json:"lastFrameUrl,omitempty"`
	ImageUrls       []string `json:"imageUrls,omitempty"`
	VideoUrls       []string `json:"videoUrls,omitempty"`
	AudioUrls       []string `json:"audioUrls,omitempty"`
}

// responsePayload 是 runninghub 提交/查询接口的统一响应结构。
type responsePayload struct {
	TaskID       string `json:"taskId"`
	Status       string `json:"status"`
	ErrorCode    string `json:"errorCode"`
	ErrorMessage string `json:"errorMessage"`
	Results      []struct {
		URL        string `json:"url"`
		OutputType string `json:"outputType"`
		Text       string `json:"text"`
	} `json:"results"`
}

// ============================
// Adaptor implementation
// ============================

type TaskAdaptor struct {
	taskcommon.BaseBilling
	ChannelType int
	apiKey      string
	baseURL     string
	mode        string // text-to-video / image-to-video / multimodal-video
}

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	a.ChannelType = info.ChannelType
	a.baseURL = info.ChannelBaseUrl
	a.apiKey = info.ApiKey
}

// ValidateRequestAndSetAction parses body, validates fields and sets default action.
func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) *dto.TaskError {
	return relaycommon.ValidateBasicTaskRequest(c, info, constant.TaskActionGenerate)
}

// BuildRequestURL constructs the upstream URL.
func (a *TaskAdaptor) BuildRequestURL(info *relaycommon.RelayInfo) (string, error) {
	mode := a.mode
	if mode == "" {
		mode = "text-to-video"
	}
	return fmt.Sprintf("%s/openapi/v2/rhart-video/%s/%s",
		strings.TrimRight(a.baseURL, "/"), ModelSlug(info.UpstreamModelName), mode), nil
}

// BuildRequestHeader sets required headers.
func (a *TaskAdaptor) BuildRequestHeader(_ *gin.Context, req *http.Request, _ *relaycommon.RelayInfo) error {
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+a.apiKey)
	return nil
}

// BuildRequestBody converts the OpenAI-compatible video request into runninghub format.
func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, _ *relaycommon.RelayInfo) (io.Reader, error) {
	v, exists := c.Get("task_request")
	if !exists {
		return nil, fmt.Errorf("request not found in context")
	}
	req := v.(relaycommon.TaskSubmitReq)

	meta := metadataPayload{}
	if err := taskcommon.UnmarshalMetadata(req.Metadata, &meta); err != nil {
		return nil, errors.Wrap(err, "unmarshal metadata failed")
	}

	// 确定生成方式（文生 / 图生 / 多模态）
	mode := meta.InputMode
	if mode == "" {
		switch {
		case len(meta.ImageUrls) > 0 || len(meta.VideoUrls) > 0 || len(meta.AudioUrls) > 0:
			mode = "multimodal-video"
		case meta.FirstFrameUrl != "" || req.HasImage() || req.Image != "":
			mode = "image-to-video"
		default:
			mode = "text-to-video"
		}
	}
	a.mode = mode

	body := requestPayload{
		Prompt:          req.Prompt,
		Resolution:      meta.Resolution,
		GenerateAudio:   meta.GenerateAudio,
		Ratio:           meta.Ratio,
		WebSearch:       meta.WebSearch,
		ReturnLastFrame: meta.ReturnLastFrame,
		Seed:            meta.Seed,
		RealPersonMode:  meta.RealPersonMode,
		ConversionSlots: meta.ConversionSlots,
		FirstFrameUrl:   meta.FirstFrameUrl,
		LastFrameUrl:    meta.LastFrameUrl,
		ImageUrls:       meta.ImageUrls,
		VideoUrls:       meta.VideoUrls,
		AudioUrls:       meta.AudioUrls,
	}

	if req.Duration > 0 {
		body.Duration = strconv.Itoa(req.Duration)
	}
	if body.Resolution == "" {
		body.Resolution = "720p"
	}
	// 兼容顶层 image/images 字段（OpenAI 兼容风格）→ 首帧
	if body.FirstFrameUrl == "" {
		if req.HasImage() {
			body.FirstFrameUrl = req.Images[0]
		} else if req.Image != "" {
			body.FirstFrameUrl = req.Image
		}
	}

	data, err := common.Marshal(body)
	if err != nil {
		return nil, err
	}
	return bytes.NewReader(data), nil
}

// DoRequest delegates to common helper.
func (a *TaskAdaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Response, error) {
	return channel.DoTaskApiRequest(a, c, info, requestBody)
}

// DoResponse handles upstream response, returns taskID etc.
func (a *TaskAdaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (taskID string, taskData []byte, taskErr *dto.TaskError) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		taskErr = service.TaskErrorWrapper(err, "read_response_body_failed", http.StatusInternalServerError)
		return
	}
	_ = resp.Body.Close()

	var dResp responsePayload
	if err := common.Unmarshal(responseBody, &dResp); err != nil {
		taskErr = service.TaskErrorWrapper(errors.Wrapf(err, "body: %s", responseBody), "unmarshal_response_body_failed", http.StatusInternalServerError)
		return
	}

	if dResp.TaskID == "" {
		taskErr = service.TaskErrorWrapper(fmt.Errorf("task_id is empty: %s", responseBody), "invalid_response", http.StatusInternalServerError)
		return
	}

	ov := dto.NewOpenAIVideo()
	ov.ID = info.PublicTaskID
	ov.TaskID = info.PublicTaskID
	ov.CreatedAt = time.Now().Unix()
	ov.Model = info.OriginModelName
	c.JSON(http.StatusOK, ov)
	return dResp.TaskID, responseBody, nil
}

// FetchTask fetches task status from runninghub.
func (a *TaskAdaptor) FetchTask(baseUrl, key string, body map[string]any, proxy string) (*http.Response, error) {
	taskID, ok := body["task_id"].(string)
	if !ok {
		return nil, fmt.Errorf("invalid task_id")
	}

	payload, err := common.Marshal(map[string]string{"taskId": taskID})
	if err != nil {
		return nil, err
	}

	uri := fmt.Sprintf("%s/openapi/v2/query", strings.TrimRight(baseUrl, "/"))
	req, err := http.NewRequest(http.MethodPost, uri, bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+key)

	client, err := service.GetHttpClientWithProxy(proxy)
	if err != nil {
		return nil, fmt.Errorf("new proxy http client failed: %w", err)
	}
	return client.Do(req)
}

// ParseTaskResult maps the runninghub query response to an internal task state.
func (a *TaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	taskInfo := &relaycommon.TaskInfo{}
	dResp := responsePayload{}
	if err := common.Unmarshal(respBody, &dResp); err != nil {
		return nil, errors.Wrap(err, "failed to unmarshal response body")
	}

	taskInfo.TaskID = dResp.TaskID
	switch dResp.Status {
	case "QUEUED":
		taskInfo.Status = model.TaskStatusQueued
	case "RUNNING":
		taskInfo.Status = model.TaskStatusInProgress
	case "SUCCESS":
		taskInfo.Status = model.TaskStatusSuccess
		if len(dResp.Results) > 0 {
			taskInfo.Url = dResp.Results[0].URL
		}
	case "FAILED":
		taskInfo.Status = model.TaskStatusFailure
		taskInfo.Reason = dResp.ErrorMessage
		if taskInfo.Reason == "" {
			taskInfo.Reason = dResp.ErrorCode
		}
	default:
		// 未知状态一律按进行中处理，避免误判失败
		taskInfo.Status = model.TaskStatusInProgress
	}
	return taskInfo, nil
}

func (a *TaskAdaptor) GetModelList() []string {
	return ModelList
}

func (a *TaskAdaptor) GetChannelName() string {
	return ChannelName
}
