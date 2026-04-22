package runninghub

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel"
	taskcommon "github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
	"github.com/pkg/errors"
	"github.com/tidwall/sjson"
)

type TaskAdaptor struct {
	taskcommon.BaseBilling
	apiKey  string
	baseURL string
}

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	a.baseURL = strings.TrimRight(info.ChannelBaseUrl, "/")
	a.apiKey = info.ApiKey
}

func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) *dto.TaskError {
	if taskErr := relaycommon.ValidateMultipartDirect(c, info); taskErr != nil {
		return taskErr
	}
	taskReq, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return service.TaskErrorWrapper(errors.Wrap(err, "get_task_request_failed"), "invalid_request", http.StatusBadRequest)
	}
	if taskReq.Metadata != nil {
		if apiPath, ok := taskReq.Metadata["api_path"].(string); ok && strings.TrimSpace(apiPath) != "" {
			info.UpstreamModelName = strings.TrimSpace(apiPath)
		}
	}
	return nil
}

func (a *TaskAdaptor) BuildRequestURL(info *relaycommon.RelayInfo) (string, error) {
	path := strings.TrimSpace(info.UpstreamModelName)
	if path == "" {
		return "", errors.New("runninghub model path is required")
	}
	return buildRunningHubURL(a.baseURL, path), nil
}

func (a *TaskAdaptor) BuildRequestHeader(c *gin.Context, req *http.Request, info *relaycommon.RelayInfo) error {
	req.Header.Set("Authorization", "Bearer "+a.apiKey)
	contentType := c.Request.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/json"
	}
	req.Header.Set("Content-Type", contentType)
	return nil
}

func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	taskReq, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil, errors.Wrap(err, "get_task_request_failed")
	}

	body := make(map[string]any)
	for k, v := range taskReq.Metadata {
		if isInternalRuntimeKey(k) {
			continue
		}
		body[k] = v
	}
	if taskReq.Prompt != "" {
		body["prompt"] = taskReq.Prompt
	}
	if taskReq.Image != "" {
		body["image"] = taskReq.Image
	}
	if len(taskReq.Images) > 0 {
		body["images"] = taskReq.Images
	}
	if taskReq.Size != "" {
		body["size"] = taskReq.Size
	}
	if taskReq.Duration > 0 {
		body["duration"] = taskReq.Duration
	}
	if taskReq.Seconds != "" {
		body["seconds"] = taskReq.Seconds
	}
	if taskReq.InputReference != "" {
		body["input_reference"] = taskReq.InputReference
	}

	bodyBytes, err := common.Marshal(body)
	if err != nil {
		return nil, errors.Wrap(err, "marshal_runninghub_request_failed")
	}
	return bytes.NewReader(bodyBytes), nil
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

	var body map[string]any
	if err = common.Unmarshal(responseBody, &body); err != nil {
		taskErr = service.TaskErrorWrapper(errors.Wrap(err, "unmarshal_response_body_failed"), "unmarshal_response_body_failed", http.StatusInternalServerError)
		return
	}

	upstreamTaskID := extractTaskID(body)
	if upstreamTaskID == "" && !hasInlineResult(body) {
		taskErr = service.TaskErrorWrapper(errors.New("taskId is empty"), "invalid_response", http.StatusInternalServerError)
		return
	}
	if upstreamTaskID == "" {
		upstreamTaskID = info.PublicTaskID
	}

	rewrittenBody, err := sjson.SetBytes(responseBody, "taskId", info.PublicTaskID)
	if err == nil {
		responseBody = rewrittenBody
	}
	c.Data(http.StatusOK, "application/json", responseBody)
	return upstreamTaskID, responseBody, nil
}

func (a *TaskAdaptor) FetchTask(baseURL, key string, body map[string]any, proxy string) (*http.Response, error) {
	taskID := common.Interface2String(body["task_id"])
	if taskID == "" {
		taskID = common.Interface2String(body["taskId"])
	}
	if taskID == "" {
		return nil, fmt.Errorf("task_id is required")
	}

	reqBody, err := common.Marshal(map[string]string{
		"taskId": taskID,
	})
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequest(http.MethodPost, buildRunningHubURL(baseURL, "/openapi/v2/query"), bytes.NewReader(reqBody))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+key)
	req.Header.Set("Content-Type", "application/json")

	client, err := service.GetHttpClientWithProxy(proxy)
	if err != nil {
		return nil, fmt.Errorf("new proxy http client failed: %w", err)
	}
	return client.Do(req)
}

func (a *TaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	var taskResp struct {
		TaskID       string `json:"taskId"`
		Status       string `json:"status"`
		ErrorCode    string `json:"errorCode"`
		ErrorMessage string `json:"errorMessage"`
		Results      []struct {
			URL     string `json:"url"`
			FileURL string `json:"fileUrl"`
		} `json:"results"`
	}
	if err := common.Unmarshal(respBody, &taskResp); err != nil {
		return nil, errors.Wrap(err, "failed to unmarshal runninghub task response")
	}
	if taskResp.Status == "" {
		var wrapped struct {
			Code int    `json:"code"`
			Msg  string `json:"msg"`
			Data struct {
				TaskID       string `json:"taskId"`
				Status       string `json:"status"`
				ErrorCode    string `json:"errorCode"`
				ErrorMessage string `json:"errorMessage"`
				Results      []struct {
					URL     string `json:"url"`
					FileURL string `json:"fileUrl"`
				} `json:"results"`
			} `json:"data"`
		}
		if err := common.Unmarshal(respBody, &wrapped); err == nil {
			taskResp.TaskID = wrapped.Data.TaskID
			taskResp.Status = wrapped.Data.Status
			taskResp.ErrorCode = wrapped.Data.ErrorCode
			taskResp.ErrorMessage = wrapped.Data.ErrorMessage
			taskResp.Results = wrapped.Data.Results
			if taskResp.Status == "" && wrapped.Code != 0 {
				return &relaycommon.TaskInfo{
					Status: model.TaskStatusFailure,
					Reason: wrapped.Msg,
				}, nil
			}
		}
	}

	taskInfo := &relaycommon.TaskInfo{}
	switch strings.ToUpper(taskResp.Status) {
	case "PENDING":
		taskInfo.Status = model.TaskStatusSubmitted
		taskInfo.Progress = taskcommon.ProgressSubmitted
	case "RUNNING":
		taskInfo.Status = model.TaskStatusInProgress
		taskInfo.Progress = taskcommon.ProgressInProgress
	case "SUCCESS":
		taskInfo.Status = model.TaskStatusSuccess
		taskInfo.Progress = taskcommon.ProgressComplete
		if len(taskResp.Results) > 0 {
			taskInfo.Url = taskResp.Results[0].URL
			if taskInfo.Url == "" {
				taskInfo.Url = taskResp.Results[0].FileURL
			}
		}
	case "FAIL", "FAILED", "ERROR":
		taskInfo.Status = model.TaskStatusFailure
		if taskResp.ErrorMessage != "" {
			taskInfo.Reason = taskResp.ErrorMessage
		} else {
			taskInfo.Reason = taskResp.ErrorCode
		}
	default:
		return nil, fmt.Errorf("unknown task status: %s", taskResp.Status)
	}
	return taskInfo, nil
}

func (a *TaskAdaptor) GetModelList() []string {
	return nil
}

func (a *TaskAdaptor) GetChannelName() string {
	return "runninghub"
}

func extractTaskID(body map[string]any) string {
	if taskID, ok := body["taskId"].(string); ok {
		return taskID
	}
	if data, ok := body["data"].(map[string]any); ok {
		if taskID, ok := data["taskId"].(string); ok {
			return taskID
		}
	}
	return ""
}

func hasInlineResult(body map[string]any) bool {
	status, _ := body["status"].(string)
	if strings.EqualFold(status, "SUCCESS") {
		return true
	}
	if data, ok := body["data"].(map[string]any); ok {
		status, _ = data["status"].(string)
		return strings.EqualFold(status, "SUCCESS")
	}
	return false
}

func isInternalRuntimeKey(key string) bool {
	switch key {
	case "api_path":
		return true
	default:
		return false
	}
}

func buildRunningHubURL(baseURL, path string) string {
	base := strings.TrimRight(baseURL, "/")
	p := strings.TrimPrefix(strings.TrimSpace(path), "/")
	if !strings.HasPrefix(p, "openapi/") {
		p = "openapi/v2/" + p
	}
	return base + "/" + p
}
