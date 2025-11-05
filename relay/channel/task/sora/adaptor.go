package sora

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/gin-gonic/gin"
	"github.com/pkg/errors"
)

// ============================
// Request / Response structures
// ============================

type ContentItem struct {
	Type     string    `json:"type"`                // "text" or "image_url"
	Text     string    `json:"text,omitempty"`      // for text type
	ImageURL *ImageURL `json:"image_url,omitempty"` // for image_url type
}

type ImageURL struct {
	URL string `json:"url"`
}

type responseTask struct {
	ID                 string `json:"id"`
	TaskID             string `json:"task_id,omitempty"` //兼容旧接口
	Object             string `json:"object"`
	Model              string `json:"model"`
	Status             string `json:"status"`
	Progress           int    `json:"progress"`
	CreatedAt          int64  `json:"created_at"`
	CompletedAt        int64  `json:"completed_at,omitempty"`
	ExpiresAt          int64  `json:"expires_at,omitempty"`
	Seconds            string `json:"seconds,omitempty"`
	Size               string `json:"size,omitempty"`
	RemixedFromVideoID string `json:"remixed_from_video_id,omitempty"`
	Error              *struct {
		Message string `json:"message"`
		Code    string `json:"code"`
	} `json:"error,omitempty"`
}

// ============================
// Adaptor implementation
// ============================

type TaskAdaptor struct {
	ChannelType int
	apiKey      string
	baseURL     string
}

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	a.ChannelType = info.ChannelType
	a.baseURL = info.ChannelBaseUrl
	a.apiKey = info.ApiKey
}

func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) (taskErr *dto.TaskError) {
	return relaycommon.ValidateMultipartDirect(c, info)
}

func (a *TaskAdaptor) BuildRequestURL(info *relaycommon.RelayInfo) (string, error) {
	return fmt.Sprintf("%s/v1/videos", a.baseURL), nil
}

// BuildRequestHeader sets required headers.
func (a *TaskAdaptor) BuildRequestHeader(c *gin.Context, req *http.Request, info *relaycommon.RelayInfo) error {
	req.Header.Set("Authorization", "Bearer "+a.apiKey)
	req.Header.Set("Content-Type", c.Request.Header.Get("Content-Type"))
	return nil
}

func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	cachedBody, err := common.GetRequestBody(c)
	if err != nil {
		return nil, errors.Wrap(err, "get_request_body_failed")
	}

	// 检查是否需要模型重定向
	if !info.IsModelMapped {
		// 如果不需要重定向，直接返回原始请求体
		return bytes.NewReader(cachedBody), nil
	}

	contentType := c.Request.Header.Get("Content-Type")

	// 处理multipart/form-data请求
	if strings.Contains(contentType, "multipart/form-data") {
		return buildRequestBodyWithMappedModel(cachedBody, contentType, info.UpstreamModelName)
	}
	// 处理JSON请求
	if strings.Contains(contentType, "application/json") {
		var jsonData map[string]interface{}
		if err := json.Unmarshal(cachedBody, &jsonData); err != nil {
			return nil, errors.Wrap(err, "unmarshal_json_failed")
		}

		// 替换model字段为映射后的模型名
		jsonData["model"] = info.UpstreamModelName

		// 重新编码为JSON
		newBody, err := json.Marshal(jsonData)
		if err != nil {
			return nil, errors.Wrap(err, "marshal_json_failed")
		}

		return bytes.NewReader(newBody), nil
	}

	return bytes.NewReader(cachedBody), nil
}

func buildRequestBodyWithMappedModel(originalBody []byte, contentType, redirectedModel string) (io.Reader, error) {
	newBuffer := &bytes.Buffer{}
	writer := multipart.NewWriter(newBuffer)

	_, params, err := mime.ParseMediaType(contentType)
	if err != nil {
		return nil, errors.Wrap(err, "parse_content_type_failed")
	}
	boundary, ok := params["boundary"]
	if !ok {
		return nil, errors.New("boundary_not_found_in_content_type")
	}
	if err := writer.SetBoundary(boundary); err != nil {
		return nil, errors.Wrap(err, "set_boundary_failed")
	}
	r := multipart.NewReader(bytes.NewReader(originalBody), boundary)

	for {
		part, err := r.NextPart()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, errors.Wrap(err, "read_multipart_part_failed")
		}

		fieldName := part.FormName()

		if fieldName == "model" {
			// 修改 model 字段为映射后的模型名
			if err := writer.WriteField("model", redirectedModel); err != nil {
				return nil, errors.Wrap(err, "write_model_field_failed")
			}
		} else {
			// 对于其他字段，保留原始内容
			if part.FileName() != "" {
				newPart, err := writer.CreatePart(part.Header)
				if err != nil {
					return nil, errors.Wrap(err, "create_form_file_failed")
				}
				if _, err := io.Copy(newPart, part); err != nil {
					return nil, errors.Wrap(err, "copy_file_content_failed")
				}
			} else {
				newPart, err := writer.CreatePart(part.Header)
				if err != nil {
					return nil, errors.Wrap(err, "create_form_field_failed")
				}
				if _, err := io.Copy(newPart, part); err != nil {
					return nil, errors.Wrap(err, "copy_field_content_failed")
				}
			}
		}

		if err := part.Close(); err != nil {
			return nil, errors.Wrap(err, "close_part_failed")
		}
	}

	if err := writer.Close(); err != nil {
		return nil, errors.Wrap(err, "close_multipart_writer_failed")
	}

	return newBuffer, nil
}

// DoRequest delegates to common helper.
func (a *TaskAdaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Response, error) {
	return channel.DoTaskApiRequest(a, c, info, requestBody)
}

// DoResponse handles upstream response, returns taskID etc.
func (a *TaskAdaptor) DoResponse(c *gin.Context, resp *http.Response, _ *relaycommon.RelayInfo) (taskID string, taskData []byte, taskErr *dto.TaskError) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		taskErr = service.TaskErrorWrapper(err, "read_response_body_failed", http.StatusInternalServerError)
		return
	}
	_ = resp.Body.Close()

	// Parse Sora response
	var dResp responseTask
	if err := common.Unmarshal(responseBody, &dResp); err != nil {
		taskErr = service.TaskErrorWrapper(errors.Wrapf(err, "body: %s", responseBody), "unmarshal_response_body_failed", http.StatusInternalServerError)
		return
	}

	if dResp.ID == "" {
		if dResp.TaskID == "" {
			taskErr = service.TaskErrorWrapper(fmt.Errorf("task_id is empty"), "invalid_response", http.StatusInternalServerError)
			return
		}
		dResp.ID = dResp.TaskID
		dResp.TaskID = ""
	}

	c.JSON(http.StatusOK, dResp)
	return dResp.ID, responseBody, nil
}

// FetchTask fetch task status
func (a *TaskAdaptor) FetchTask(baseUrl, key string, body map[string]any) (*http.Response, error) {
	taskID, ok := body["task_id"].(string)
	if !ok {
		return nil, fmt.Errorf("invalid task_id")
	}

	uri := fmt.Sprintf("%s/v1/videos/%s", baseUrl, taskID)

	req, err := http.NewRequest(http.MethodGet, uri, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+key)

	return service.GetHttpClient().Do(req)
}

func (a *TaskAdaptor) GetModelList() []string {
	return ModelList
}

func (a *TaskAdaptor) GetChannelName() string {
	return ChannelName
}

func (a *TaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	resTask := responseTask{}
	if err := common.Unmarshal(respBody, &resTask); err != nil {
		return nil, errors.Wrap(err, "unmarshal task result failed")
	}

	taskResult := relaycommon.TaskInfo{
		Code: 0,
	}

	switch resTask.Status {
	case "queued", "pending":
		taskResult.Status = model.TaskStatusQueued
	case "processing", "in_progress":
		taskResult.Status = model.TaskStatusInProgress
	case "completed":
		taskResult.Status = model.TaskStatusSuccess
		taskResult.Url = fmt.Sprintf("%s/v1/videos/%s/content", system_setting.ServerAddress, resTask.ID)
	case "failed", "cancelled":
		taskResult.Status = model.TaskStatusFailure
		if resTask.Error != nil {
			taskResult.Reason = resTask.Error.Message
		} else {
			taskResult.Reason = "task failed"
		}
	default:
	}
	if resTask.Progress > 0 && resTask.Progress < 100 {
		taskResult.Progress = fmt.Sprintf("%d%%", resTask.Progress)
	}

	return &taskResult, nil
}

func (a *TaskAdaptor) ConvertToOpenAIVideo(task *model.Task) ([]byte, error) {
	return task.Data, nil
}
