package openaivideo

import (
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/pkg/errors"
)

type lk888Provider struct{}

type lk888SubmitResponse struct {
	Code int    `json:"code"`
	Msg  string `json:"msg"`
	Data struct {
		TaskID  any   `json:"task_id"`
		TaskIDs []any `json:"任务ids"`
	} `json:"data"`
	Error *struct {
		Message string `json:"message"`
		Type    string `json:"type"`
	} `json:"error,omitempty"`
}

type lk888StatusResponse struct {
	TaskID      any     `json:"task_id"`
	Model       string  `json:"model"`
	State       string  `json:"state"`
	Status      string  `json:"status"`
	StatusGroup string  `json:"status_group"`
	Progress    string  `json:"progress"`
	IsFinal     bool    `json:"is_final"`
	ResultURL   string  `json:"result_url"`
	ResultType  string  `json:"result_type"`
	Cost        float64 `json:"cost"`
	Error       any     `json:"error"`
	Refunded    bool    `json:"refunded"`
}

func (p *lk888Provider) submitURL(baseURL string) string {
	return lk888APIBase(baseURL) + "/v1/media/generate"
}

func (p *lk888Provider) queryURL(baseURL, taskID string) string {
	return lk888APIBase(baseURL) + "/v1/skills/task-status?task_id=" + url.QueryEscape(taskID)
}

func (p *lk888Provider) parseSubmitResponse(body []byte) (string, error) {
	var resp lk888SubmitResponse
	if err := common.Unmarshal(body, &resp); err != nil {
		return "", errors.Wrap(err, "unmarshal lk888 submit response failed")
	}
	if resp.Code != 200 {
		if resp.Error != nil && resp.Error.Message != "" {
			return "", fmt.Errorf("lk888 submit failed: %s", resp.Error.Message)
		}
		return "", fmt.Errorf("lk888 submit failed: %s", resp.Msg)
	}
	if taskID := lk888StringID(resp.Data.TaskID); taskID != "" {
		return taskID, nil
	}
	for _, id := range resp.Data.TaskIDs {
		if taskID := lk888StringID(id); taskID != "" {
			return taskID, nil
		}
	}
	return "", fmt.Errorf("lk888 response data.task_id is empty")
}

func (p *lk888Provider) parseQueryResponse(body []byte) (*relaycommon.TaskInfo, error) {
	var resp lk888StatusResponse
	if err := common.Unmarshal(body, &resp); err != nil {
		return nil, errors.Wrap(err, "unmarshal lk888 task status response failed")
	}

	ti := &relaycommon.TaskInfo{
		Code:     0,
		TaskID:   lk888StringID(resp.TaskID),
		Status:   lk888TaskStatus(resp),
		Progress: lk888Progress(resp.Progress),
	}
	if ti.Status == model.TaskStatusSuccess {
		if strings.TrimSpace(resp.ResultURL) == "" {
			ti.Status = model.TaskStatusFailure
			ti.Reason = "lk888 completed without result_url"
		} else {
			ti.Url = strings.TrimSpace(resp.ResultURL)
		}
	}
	if ti.Status == model.TaskStatusFailure {
		ti.Reason = lk888ErrorMessage(resp.Error)
		if ti.Reason == "" {
			ti.Reason = firstNonEmpty(resp.Status, resp.State, "task failed")
		}
	}
	return ti, nil
}

func (p *lk888Provider) buildSubmitResponseBody(info *relaycommon.RelayInfo, upstreamTaskID string) any {
	return map[string]any{
		"id":         info.PublicTaskID,
		"task_id":    info.PublicTaskID,
		"object":     "video",
		"model":      info.OriginModelName,
		"status":     "queued",
		"progress":   0,
		"created_at": 0,
	}
}

func (p *lk888Provider) needsMultipart() bool { return false }

func (p *lk888Provider) forceJSONBody() bool { return true }

func (p *lk888Provider) setupRequestHeader(req *http.Request, apiKey string) {
	req.Header.Set("Authorization", "Bearer "+apiKey)
}

func (p *lk888Provider) mapModelForImages(model string, hasImages bool) string {
	return strings.TrimSpace(model)
}

func (p *lk888Provider) normalizeJSONRequest(bodyMap map[string]interface{}, originModel, upstreamModel string, imageCount int) {
	normalizeLK888RequestMap(bodyMap, upstreamModel)
}

func (p *lk888Provider) normalizeMultipartRequest(values map[string][]string, originModel, upstreamModel string, imageCount int) {
	bodyMap := multipartValuesToMap(values)
	normalizeLK888RequestMap(bodyMap, upstreamModel)
	for k := range values {
		delete(values, k)
	}
	for k, v := range bodyMap {
		values[k] = []string{fmt.Sprintf("%v", v)}
	}
}

func lk888APIBase(baseURL string) string {
	baseURL = strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if baseURL == "" {
		return "https://api.lk888.ai/api"
	}
	return baseURL
}

func isLK888ResultURL(resultURL string) bool {
	lower := strings.ToLower(strings.TrimSpace(resultURL))
	return strings.Contains(lower, "lingkeai.vip") ||
		strings.Contains(lower, "lk888.ai") ||
		strings.Contains(lower, "lk666.ai") ||
		strings.Contains(lower, "storage-googleapis.com")
}

func normalizeLK888RequestMap(bodyMap map[string]interface{}, upstreamModel string) {
	modelName := strings.TrimSpace(fmtString(bodyMap["model"]))
	if upstreamModel != "" {
		modelName = strings.TrimSpace(upstreamModel)
		bodyMap["model"] = modelName
	}

	params := lk888ParamsMap(bodyMap["params"])
	for key, value := range bodyMap {
		if lk888TopLevelRequestKey(key) {
			continue
		}
		lk888AddParam(params, modelName, key, value)
	}

	normalized := map[string]interface{}{
		"model":  modelName,
		"prompt": fmtString(bodyMap["prompt"]),
		"params": params,
	}
	if count := intFromXBSoraValue(bodyMap["count"]); count > 0 {
		normalized["count"] = count
	}
	for k := range bodyMap {
		delete(bodyMap, k)
	}
	for k, v := range normalized {
		bodyMap[k] = v
	}
}

func lk888ParamsMap(value interface{}) map[string]interface{} {
	params := make(map[string]interface{})
	if value == nil {
		return params
	}
	if existing, ok := value.(map[string]interface{}); ok {
		for k, v := range existing {
			params[k] = v
		}
	}
	return params
}

func lk888TopLevelRequestKey(key string) bool {
	switch key {
	case "model", "prompt", "params", "count":
		return true
	default:
		return false
	}
}

func lk888AddParam(params map[string]interface{}, modelName, key string, value interface{}) {
	if value == nil || lk888DropRequestKey(key) {
		return
	}
	paramKey := lk888ParamKey(modelName, key)
	if paramKey == "" {
		return
	}
	if _, exists := params[paramKey]; exists {
		return
	}
	params[paramKey] = lk888ParamValue(modelName, paramKey, key, value)
}

func lk888DropRequestKey(key string) bool {
	switch key {
	case "n", "response_format", "user":
		return true
	default:
		return false
	}
}

func lk888ParamKey(modelName, key string) string {
	switch key {
	case "seconds":
		return "duration"
	case "image", "input_reference", "image_url":
		return "images"
	case "orientation", "ratio", "size":
		if strings.EqualFold(modelName, "sora-2") {
			return "orientation"
		}
		return "aspect_ratio"
	default:
		return key
	}
}

func lk888ParamValue(modelName, paramKey, originalKey string, value interface{}) interface{} {
	if paramKey == "duration" {
		return lk888StringValue(value)
	}
	if paramKey == "aspect_ratio" {
		return lk888AspectRatioValue(modelName, value)
	}
	if paramKey == "orientation" {
		return lk888OrientationValue(value)
	}
	if paramKey == "images" {
		if images := stringsFromXBSoraValue(value); len(images) > 0 {
			if len(images) == 1 {
				return images[0]
			}
			return images
		}
	}
	return value
}

func lk888StringValue(value interface{}) string {
	switch v := value.(type) {
	case string:
		return strings.TrimSpace(v)
	case float64:
		if v == float64(int(v)) {
			return strconv.Itoa(int(v))
		}
		return strconv.FormatFloat(v, 'f', -1, 64)
	case int:
		return strconv.Itoa(v)
	case int64:
		return strconv.FormatInt(v, 10)
	default:
		return fmt.Sprintf("%v", v)
	}
}

func lk888AspectRatioValue(modelName string, value interface{}) string {
	raw := strings.ToLower(strings.TrimSpace(lk888StringValue(value)))
	switch raw {
	case "portrait", "vertical", "9:16", "720x1280", "1024x1792":
		if strings.EqualFold(modelName, "grok-video-3") {
			return "2:3"
		}
		return "9:16"
	case "landscape", "horizontal", "16:9", "1280x720", "1792x1024":
		if strings.EqualFold(modelName, "grok-video-3") {
			return "3:2"
		}
		return "16:9"
	case "1:1":
		return "1:1"
	default:
		if raw != "" {
			return raw
		}
		return "16:9"
	}
}

func lk888OrientationValue(value interface{}) string {
	raw := strings.ToLower(strings.TrimSpace(lk888StringValue(value)))
	switch raw {
	case "portrait", "vertical", "9:16", "720x1280", "1024x1792":
		return "portrait"
	default:
		return "landscape"
	}
}

func lk888StringID(value any) string {
	switch v := value.(type) {
	case string:
		return strings.TrimSpace(v)
	case float64:
		return strconv.FormatInt(int64(v), 10)
	case int:
		return strconv.Itoa(v)
	case int64:
		return strconv.FormatInt(v, 10)
	default:
		return ""
	}
}

func lk888TaskStatus(resp lk888StatusResponse) string {
	state := strings.ToLower(strings.TrimSpace(resp.State))
	switch state {
	case "success", "succeeded", "completed", "complete":
		return model.TaskStatusSuccess
	case "failed", "failure", "error":
		return model.TaskStatusFailure
	case "processing", "running":
		return model.TaskStatusInProgress
	case "pending", "queued":
		return model.TaskStatusQueued
	}

	switch strings.TrimSpace(resp.StatusGroup) {
	case "已完成":
		return model.TaskStatusSuccess
	case "失败":
		return model.TaskStatusFailure
	case "处理中":
		return model.TaskStatusInProgress
	case "等待中":
		return model.TaskStatusQueued
	}
	if resp.IsFinal {
		if strings.TrimSpace(resp.ResultURL) != "" {
			return model.TaskStatusSuccess
		}
		return model.TaskStatusFailure
	}
	return model.TaskStatusInProgress
}

func lk888Progress(progress string) string {
	progress = strings.TrimSpace(progress)
	if progress == "" || progress == "100%" || progress == "100" || progress == "0" || progress == "0%" {
		return ""
	}
	if strings.HasSuffix(progress, "%") {
		return progress
	}
	return progress + "%"
}

func lk888ErrorMessage(value any) string {
	switch v := value.(type) {
	case string:
		return strings.TrimSpace(v)
	case map[string]interface{}:
		for _, key := range []string{"message", "details", "error"} {
			if msg, ok := v[key].(string); ok && strings.TrimSpace(msg) != "" {
				return strings.TrimSpace(msg)
			}
		}
	default:
		return ""
	}
	return ""
}
