package openaivideo

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/pkg/errors"
)

type xbSoraProvider struct{}

type xbSoraSubmitResponse struct {
	Code    any    `json:"code"`
	Message string `json:"message"`
	Msg     string `json:"msg,omitempty"`
	Data    struct {
		TaskID string `json:"task_id"`
		Status string `json:"status"`
		Model  string `json:"model"`
	} `json:"data"`
	Error *xbSoraError `json:"error,omitempty"`
}

type xbSoraQueryResponse struct {
	Code    any    `json:"code"`
	Message string `json:"message"`
	Msg     string `json:"msg,omitempty"`
	Data    struct {
		TaskID   string `json:"task_id"`
		Status   string `json:"status"`
		Progress int    `json:"progress"`
		Model    string `json:"model"`
		Result   *struct {
			VideoURL     string   `json:"video_url"`
			ResultURLs   []string `json:"resultUrls"`
			ThumbnailURL string   `json:"thumbnail_url"`
			Duration     float64  `json:"duration"`
			Format       string   `json:"format"`
			ExpiresAt    int64    `json:"expires_at"`
		} `json:"result,omitempty"`
		Error *xbSoraError `json:"error,omitempty"`
	} `json:"data"`
	Error *xbSoraError `json:"error,omitempty"`
}

type xbSoraError struct {
	Type    string `json:"type,omitempty"`
	Code    string `json:"code,omitempty"`
	Message string `json:"message,omitempty"`
	Details string `json:"details,omitempty"`
}

type xbSoraResponseEnvelope struct {
	Code    any             `json:"code"`
	Message string          `json:"message"`
	Msg     string          `json:"msg"`
	Data    json.RawMessage `json:"data"`
}

func (p *xbSoraProvider) submitURL(baseURL string) string {
	return fmt.Sprintf("%s/videos/generate", xbSoraAPIBase(baseURL))
}

func (p *xbSoraProvider) queryURL(baseURL, taskID string) string {
	return fmt.Sprintf("%s/videos/%s", xbSoraAPIBase(baseURL), taskID)
}

func (p *xbSoraProvider) parseSubmitResponse(body []byte) (string, error) {
	var err error
	body, err = unwrapXBSoraNestedResponse(body)
	if err != nil {
		return "", err
	}
	var resp xbSoraSubmitResponse
	if err := common.Unmarshal(body, &resp); err != nil {
		return "", errors.Wrap(err, "unmarshal xb-sora2 submit response failed")
	}
	if !xbSoraCodeOK(resp.Code) {
		return "", fmt.Errorf("xb-sora2 submit failed: %s", xbSoraErrorMessage(firstNonEmpty(resp.Message, resp.Msg), resp.Error))
	}
	if resp.Data.TaskID == "" {
		return "", fmt.Errorf("xb-sora2 response data.task_id is empty")
	}
	return resp.Data.TaskID, nil
}

func (p *xbSoraProvider) parseQueryResponse(body []byte) (*relaycommon.TaskInfo, error) {
	var err error
	body, err = unwrapXBSoraNestedResponse(body)
	if err != nil {
		return nil, err
	}
	var resp xbSoraQueryResponse
	if err := common.Unmarshal(body, &resp); err != nil {
		return nil, errors.Wrap(err, "unmarshal xb-sora2 query response failed")
	}
	if !xbSoraCodeOK(resp.Code) {
		return nil, fmt.Errorf("xb-sora2 query failed: %s", xbSoraErrorMessage(firstNonEmpty(resp.Message, resp.Msg), resp.Error))
	}

	ti := &relaycommon.TaskInfo{
		Code:   0,
		TaskID: resp.Data.TaskID,
		Status: statusToTaskStatus(resp.Data.Status),
	}
	if ti.Status == model.TaskStatusSuccess && resp.Data.Result != nil {
		ti.Url = firstNonEmpty(resp.Data.Result.VideoURL, firstXBSoraResultURL(resp.Data.Result.ResultURLs))
		if ti.Url == "" {
			ti.Status = model.TaskStatusFailure
			ti.Reason = "xb-sora2 completed without video_url"
		}
	}
	if ti.Status == model.TaskStatusFailure {
		if resp.Data.Error != nil {
			ti.Reason = xbSoraErrorMessage("", resp.Data.Error)
		} else {
			ti.Reason = "task failed"
		}
	}
	if resp.Data.Progress > 0 && resp.Data.Progress < 100 {
		ti.Progress = fmt.Sprintf("%d%%", resp.Data.Progress)
	}
	return ti, nil
}

func firstXBSoraResultURL(urls []string) string {
	for _, u := range urls {
		if strings.TrimSpace(u) != "" {
			return strings.TrimSpace(u)
		}
	}
	return ""
}

func (p *xbSoraProvider) buildSubmitResponseBody(info *relaycommon.RelayInfo, upstreamTaskID string) any {
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

func (p *xbSoraProvider) needsMultipart() bool { return false }

func (p *xbSoraProvider) forceJSONBody() bool { return true }

func (p *xbSoraProvider) setupRequestHeader(req *http.Request, apiKey string) {
	req.Header.Set("X-API-Key", apiKey)
}

func (p *xbSoraProvider) mapModelForImages(model string, hasImages bool) string {
	model = strings.TrimSpace(model)
	switch model {
	case "xb-sora2":
		return model
	case "xb-sora-2", "sora-2", "openai-sora-2", "sora-2-image-to-video":
		return "xb-sora2"
	case "sora-2-pro", "sora-2-pro-text-to-video":
		return "sora-2-pro(线路BF)"
	default:
		return model
	}
}

func (p *xbSoraProvider) normalizeJSONRequest(bodyMap map[string]interface{}, originModel, upstreamModel string, imageCount int) {
	normalizeXBSoraRequestMap(bodyMap, imageCount, upstreamModel)
}

func (p *xbSoraProvider) normalizeMultipartRequest(values map[string][]string, originModel, upstreamModel string, imageCount int) {
	bodyMap := multipartValuesToMap(values)
	normalizeXBSoraRequestMap(bodyMap, imageCount, upstreamModel)
	for k := range values {
		delete(values, k)
	}
	for k, v := range bodyMap {
		values[k] = []string{fmt.Sprintf("%v", v)}
	}
	if images, ok := bodyMap["images"].([]string); ok {
		values["images"] = images
	}
}

func xbSoraAPIBase(baseURL string) string {
	baseURL = strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if strings.HasSuffix(baseURL, "/api/v1") || strings.HasSuffix(baseURL, "/v1") {
		return baseURL
	}
	return baseURL + "/api/v1"
}

func normalizeXBSoraRequestMap(bodyMap map[string]interface{}, imageCount int, modelName string) {
	bodyMap["duration"] = normalizeXBSoraDuration(getXBSoraDuration(bodyMap), modelName)
	if isXBSoraGrokModelName(modelName) {
		bodyMap["aspect_ratio"] = normalizeXBSoraGrokAspectRatio(bodyMap)
		if images := collectXBSoraImages(bodyMap); len(images) > 0 {
			bodyMap["images"] = images
		}
		for _, key := range []string{
			"seconds",
			"input_reference",
			"image",
			"ratio",
			"orientation",
			"size",
			"width",
			"height",
			"fps",
			"seed",
			"n",
			"response_format",
			"user",
		} {
			delete(bodyMap, key)
		}
		return
	}
	if orientation := getXBSoraOrientation(bodyMap); orientation != "" {
		bodyMap["orientation"] = orientation
	}
	if images := collectXBSoraImages(bodyMap); len(images) > 0 {
		bodyMap["images"] = images
	}

	for _, key := range []string{
		"size",
		"seconds",
		"input_reference",
		"image",
		"aspect_ratio",
		"ratio",
		"width",
		"height",
		"fps",
		"seed",
		"n",
		"response_format",
		"user",
	} {
		delete(bodyMap, key)
	}

	if imageCount > 0 && bodyMap["model"] == "" {
		bodyMap["model"] = "xb-sora2"
	}
}

func normalizeXBSoraDuration(duration int, modelName string) int {
	supported := supportedXBSoraDurations(modelName)
	if len(supported) == 0 {
		if duration > 0 {
			return duration
		}
		return 8
	}
	if duration <= 0 {
		return defaultXBSoraDuration(modelName, supported)
	}
	for _, allowed := range supported {
		if duration == allowed {
			return duration
		}
		if duration < allowed {
			return allowed
		}
	}
	return supported[len(supported)-1]
}

func supportedXBSoraDurations(modelName string) []int {
	lower := strings.ToLower(strings.TrimSpace(modelName))
	switch {
	case isXBSoraGrokModelName(modelName):
		return []int{6, 10}
	case strings.Contains(modelName, "全能视频"):
		return []int{4, 5, 8, 10, 15}
	case lower == "openai-sora-2" || lower == "sora-2-image-to-video":
		return []int{10, 15}
	case strings.Contains(lower, "sora"):
		return []int{4, 8, 12}
	default:
		return nil
	}
}

func isXBSoraGrokModelName(modelName string) bool {
	lower := strings.ToLower(strings.TrimSpace(modelName))
	return lower == "je-grok" || strings.Contains(lower, "grok")
}

func isXBSoraProtectedResultURL(resultURL string) bool {
	lower := strings.ToLower(strings.TrimSpace(resultURL))
	return strings.Contains(lower, "open.hongniaoai.com") ||
		strings.Contains(lower, ".33502349.xyz/")
}

func normalizeXBSoraGrokAspectRatio(bodyMap map[string]interface{}) string {
	for _, key := range []string{"size", "aspect_ratio", "ratio"} {
		if aspectRatio := grokAspectRatioFromXBSoraValue(bodyMap[key]); aspectRatio != "" {
			return aspectRatio
		}
	}
	switch getXBSoraOrientation(bodyMap) {
	case "portrait":
		return "720x1280"
	default:
		return "1280x720"
	}
}

func grokAspectRatioFromXBSoraValue(value interface{}) string {
	s, ok := value.(string)
	if !ok {
		return ""
	}
	s = strings.TrimSpace(s)
	switch strings.ToLower(s) {
	case "landscape", "horizontal":
		return "1280x720"
	case "portrait", "vertical":
		return "720x1280"
	case "16:9", "1280x720":
		return "1280x720"
	case "9:16", "720x1280":
		return "720x1280"
	case "横屏 16:9":
		return "1280x720"
	case "竖屏 9:16":
		return "720x1280"
	default:
		return ""
	}
}

func defaultXBSoraDuration(modelName string, supported []int) int {
	lower := strings.ToLower(strings.TrimSpace(modelName))
	switch {
	case lower == "ss-sora-2":
		return 4
	case strings.Contains(modelName, "全能视频"):
		return 15
	case len(supported) > 1:
		return supported[1]
	default:
		return supported[0]
	}
}

func getXBSoraDuration(bodyMap map[string]interface{}) int {
	for _, key := range []string{"duration", "seconds"} {
		if duration := intFromXBSoraValue(bodyMap[key]); duration > 0 {
			return duration
		}
	}
	return 0
}

func getXBSoraOrientation(bodyMap map[string]interface{}) string {
	for _, key := range []string{"orientation", "aspect_ratio", "ratio", "size"} {
		if orientation := orientationFromXBSoraValue(bodyMap[key]); orientation != "" {
			return orientation
		}
	}
	return "landscape"
}

func collectXBSoraImages(bodyMap map[string]interface{}) []string {
	seen := make(map[string]struct{})
	images := make([]string, 0)
	for _, key := range []string{"images", "image", "input_reference", "image_url"} {
		for _, image := range stringsFromXBSoraValue(bodyMap[key]) {
			image = strings.TrimSpace(image)
			if image == "" {
				continue
			}
			if _, ok := seen[image]; ok {
				continue
			}
			seen[image] = struct{}{}
			images = append(images, image)
		}
	}
	return images
}

func intFromXBSoraValue(value interface{}) int {
	switch v := value.(type) {
	case int:
		return v
	case int64:
		return int(v)
	case float64:
		return int(v)
	case string:
		i, _ := strconv.Atoi(strings.TrimSpace(v))
		return i
	default:
		return 0
	}
}

func orientationFromXBSoraValue(value interface{}) string {
	switch v := value.(type) {
	case string:
		switch strings.ToLower(strings.TrimSpace(v)) {
		case "landscape", "horizontal", "16:9", "1280x720", "1792x1024":
			return "landscape"
		case "portrait", "vertical", "9:16", "720x1280", "1024x1792":
			return "portrait"
		}
	}
	return ""
}

func stringsFromXBSoraValue(value interface{}) []string {
	switch v := value.(type) {
	case []string:
		return v
	case []interface{}:
		out := make([]string, 0, len(v))
		for _, item := range v {
			out = append(out, stringsFromXBSoraValue(item)...)
		}
		return out
	case map[string]interface{}:
		if imageURL, ok := v["image_url"]; ok {
			return stringsFromXBSoraValue(imageURL)
		}
		if url, ok := v["url"].(string); ok {
			return []string{url}
		}
	case string:
		return []string{v}
	}
	return nil
}

func xbSoraErrorMessage(message string, errInfo *xbSoraError) string {
	if errInfo == nil {
		return message
	}
	for _, msg := range []string{errInfo.Message, errInfo.Details, errInfo.Code, errInfo.Type, message} {
		if strings.TrimSpace(msg) != "" {
			return msg
		}
	}
	return "unknown error"
}

func unwrapXBSoraNestedResponse(body []byte) ([]byte, error) {
	var env xbSoraResponseEnvelope
	if err := common.Unmarshal(body, &env); err != nil {
		return body, nil
	}
	if !xbSoraCodeOK(env.Code) {
		return nil, fmt.Errorf("xb-sora2 request failed: %s", firstNonEmpty(env.Message, env.Msg))
	}
	if len(env.Data) == 0 {
		return body, nil
	}
	var nested xbSoraResponseEnvelope
	if err := common.Unmarshal(env.Data, &nested); err != nil {
		return body, nil
	}
	if len(nested.Data) == 0 {
		return body, nil
	}
	return env.Data, nil
}

func xbSoraCodeOK(code any) bool {
	switch v := code.(type) {
	case nil:
		return true
	case int:
		return v == 0 || v == http.StatusOK
	case int64:
		return v == 0 || v == http.StatusOK
	case float64:
		return v == 0 || v == http.StatusOK
	case string:
		v = strings.TrimSpace(v)
		return v == "" || v == "0" || v == "0000" || v == "200"
	default:
		return false
	}
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}
