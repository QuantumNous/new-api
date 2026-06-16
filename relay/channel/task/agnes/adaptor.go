package agnes

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strconv"
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
	"github.com/tidwall/gjson"
	"github.com/tidwall/sjson"
)

type responseTask struct {
	ID        string `json:"id"`
	TaskID    string `json:"task_id,omitempty"`
	Object    string `json:"object"`
	Model     string `json:"model"`
	Status    string `json:"status"`
	Progress  int    `json:"progress"`
	VideoURL  string `json:"video_url,omitempty"`
	CreatedAt int64  `json:"created_at"`
	Error     *struct {
		Message string `json:"message"`
		Code    string `json:"code"`
	} `json:"error,omitempty"`
}

// TaskAdaptor implements Agnes async video API (agnes-video-v2.0).
type TaskAdaptor struct {
	taskcommon.BaseBilling
	apiKey  string
	baseURL string
}

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	a.baseURL = apiOrigin(info.ChannelBaseUrl)
	a.apiKey = info.ApiKey
}

func apiOrigin(raw string) string {
	b := strings.TrimRight(strings.TrimSpace(raw), "/")
	for _, suf := range []string{"/v1/videos", "/v1"} {
		b = trimSuffixFold(b, suf)
	}
	return strings.TrimRight(b, "/")
}

func trimSuffixFold(s, suf string) string {
	if len(s) < len(suf) {
		return s
	}
	tail := s[len(s)-len(suf):]
	if strings.EqualFold(tail, suf) {
		return strings.TrimRight(s[:len(s)-len(suf)], "/")
	}
	return s
}

func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) *dto.TaskError {
	return relaycommon.ValidateMultipartDirect(c, info)
}

func (a *TaskAdaptor) EstimateBilling(c *gin.Context, info *relaycommon.RelayInfo) map[string]float64 {
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil
	}
	seconds := agnesVideoSecondsFromRequest(c, &req)
	if seconds <= 0 {
		seconds = 5
	}
	return map[string]float64{"seconds": seconds}
}

func agnesVideoSecondsFromRequest(c *gin.Context, req *relaycommon.TaskSubmitReq) float64 {
	if req.Duration > 0 {
		return float64(req.Duration)
	}
	if sec, err := strconv.Atoi(strings.TrimSpace(req.Seconds)); err == nil && sec > 0 {
		return float64(sec)
	}
	if storage, err := common.GetBodyStorage(c); err == nil {
		if raw, err := storage.Bytes(); err == nil {
			numFrames := int(gjson.GetBytes(raw, "num_frames").Int())
			frameRate := int(gjson.GetBytes(raw, "frame_rate").Int())
			if numFrames > 0 && frameRate > 0 {
				return float64(numFrames) / float64(frameRate)
			}
		}
	}
	return 0
}

func (a *TaskAdaptor) BuildRequestURL(info *relaycommon.RelayInfo) (string, error) {
	return a.baseURL + "/v1/videos", nil
}

func (a *TaskAdaptor) BuildRequestHeader(c *gin.Context, req *http.Request, info *relaycommon.RelayInfo) error {
	req.Header.Set("Authorization", "Bearer "+a.apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	return nil
}

func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil, err
	}
	payload, err := a.convertCreatePayload(c, &req, info)
	if err != nil {
		return nil, errors.Wrap(err, "convert create payload failed")
	}
	data, err := common.Marshal(payload)
	if err != nil {
		return nil, err
	}
	return bytes.NewReader(data), nil
}

func (a *TaskAdaptor) convertCreatePayload(c *gin.Context, req *relaycommon.TaskSubmitReq, info *relaycommon.RelayInfo) (map[string]interface{}, error) {
	modelName := strings.TrimSpace(info.UpstreamModelName)
	if modelName == "" {
		return nil, fmt.Errorf("upstream model is empty; configure model mapping on the channel")
	}

	payload := map[string]interface{}{
		"model":  modelName,
		"prompt": req.Prompt,
	}

	applyRawCreateFields(c, payload)
	if images := collectImageURLs(c, req); len(images) == 1 {
		payload["image"] = images[0]
	} else if len(images) > 1 {
		payload["images"] = images
	}

	if err := taskcommon.UnmarshalMetadata(req.Metadata, &payload); err != nil {
		return nil, errors.Wrap(err, "unmarshal metadata failed")
	}
	payload["model"] = modelName
	if strings.TrimSpace(req.Prompt) != "" {
		payload["prompt"] = req.Prompt
	}
	return payload, nil
}

func applyRawCreateFields(c *gin.Context, payload map[string]interface{}) {
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return
	}
	raw, err := storage.Bytes()
	if err != nil {
		return
	}
	for _, key := range []string{"height", "width", "num_frames", "frame_rate", "seed", "image", "images"} {
		if _, ok := payload[key]; ok {
			continue
		}
		if val := gjson.GetBytes(raw, key); val.Exists() {
			payload[key] = val.Value()
		}
	}
}

func collectImageURLs(c *gin.Context, req *relaycommon.TaskSubmitReq) []string {
	out := make([]string, 0, len(req.Images)+2)
	for _, u := range req.Images {
		if u = strings.TrimSpace(u); u != "" {
			out = append(out, u)
		}
	}
	if u := strings.TrimSpace(req.Image); u != "" {
		out = append(out, u)
	}
	if u := strings.TrimSpace(req.InputReference); u != "" {
		out = append(out, u)
	}
	if len(out) == 0 {
		if storage, err := common.GetBodyStorage(c); err == nil {
			if raw, err := storage.Bytes(); err == nil {
				if img := strings.TrimSpace(gjson.GetBytes(raw, "image").String()); img != "" {
					out = append(out, img)
				}
				arr := gjson.GetBytes(raw, "images")
				if arr.IsArray() {
					for _, item := range arr.Array() {
						if item.Type == gjson.String {
							if u := strings.TrimSpace(item.String()); u != "" {
								out = append(out, u)
							}
						}
					}
				}
			}
		}
	}
	return out
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

	var dResp responseTask
	if err := common.Unmarshal(responseBody, &dResp); err != nil {
		taskErr = service.TaskErrorWrapper(errors.Wrapf(err, "body: %s", responseBody), "unmarshal_response_body_failed", http.StatusInternalServerError)
		return
	}

	upstreamID := dResp.ID
	if upstreamID == "" {
		upstreamID = dResp.TaskID
	}
	if upstreamID == "" {
		taskErr = service.TaskErrorWrapper(fmt.Errorf("task_id is empty"), "invalid_response", http.StatusInternalServerError)
		return
	}

	dResp.ID = info.PublicTaskID
	dResp.TaskID = info.PublicTaskID
	c.JSON(http.StatusOK, dResp)
	return upstreamID, responseBody, nil
}

func (a *TaskAdaptor) FetchTask(baseUrl, key string, body map[string]any, proxy string) (*http.Response, error) {
	taskID, ok := body["task_id"].(string)
	if !ok || strings.TrimSpace(taskID) == "" {
		return nil, fmt.Errorf("invalid task_id")
	}

	uri := fmt.Sprintf("%s/v1/videos/%s", apiOrigin(baseUrl), taskID)
	req, err := http.NewRequest(http.MethodGet, uri, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+key)
	req.Header.Set("Accept", "application/json")

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

func (a *TaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	raw := string(respBody)
	var resTask responseTask
	if err := common.Unmarshal(respBody, &resTask); err != nil {
		return nil, errors.Wrap(err, "unmarshal task result failed")
	}

	taskResult := relaycommon.TaskInfo{Code: 0}
	status := strings.ToLower(strings.TrimSpace(resTask.Status))

	switch status {
	case "queued", "pending", "submitted":
		taskResult.Status = model.TaskStatusQueued
	case "processing", "in_progress", "running":
		taskResult.Status = model.TaskStatusInProgress
	case "completed", "success", "succeeded":
		taskResult.Status = model.TaskStatusSuccess
		if u := extractVideoURL(raw, &resTask); u != "" {
			taskResult.Url = u
		}
	case "failed", "failure", "error", "cancelled", "canceled":
		taskResult.Status = model.TaskStatusFailure
		if resTask.Error != nil && resTask.Error.Message != "" {
			taskResult.Reason = resTask.Error.Message
		} else if msg := strings.TrimSpace(gjson.Get(raw, "message").String()); msg != "" {
			taskResult.Reason = msg
		} else {
			taskResult.Reason = "task failed"
		}
	default:
		if u := extractVideoURL(raw, &resTask); u != "" {
			taskResult.Status = model.TaskStatusSuccess
			taskResult.Url = u
		} else {
			taskResult.Status = model.TaskStatusInProgress
		}
	}

	if resTask.Progress > 0 && resTask.Progress < 100 {
		taskResult.Progress = fmt.Sprintf("%d%%", resTask.Progress)
	} else if p := int(gjson.Get(raw, "progress").Int()); p > 0 && p < 100 {
		taskResult.Progress = fmt.Sprintf("%d%%", p)
	}

	return &taskResult, nil
}

func extractVideoURL(raw string, resTask *responseTask) string {
	if resTask != nil {
		if u := strings.TrimSpace(resTask.VideoURL); u != "" {
			return u
		}
	}
	return taskcommon.ExtractVideoURLFromJSON([]byte(raw))
}

func (a *TaskAdaptor) ConvertToOpenAIVideo(task *model.Task) ([]byte, error) {
	data := task.Data
	var err error
	if data, err = sjson.SetBytes(data, "id", task.TaskID); err != nil {
		return nil, errors.Wrap(err, "set id failed")
	}
	if ti, err := a.ParseTaskResult(task.Data); err == nil && ti != nil {
		if ti.Status == model.TaskStatusSuccess && ti.Url != "" {
			if data, err = sjson.SetBytes(data, "video_url", ti.Url); err != nil {
				return nil, errors.Wrap(err, "set video_url failed")
			}
		}
	}
	return data, nil
}
