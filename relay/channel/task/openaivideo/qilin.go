package openaivideo

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/pkg/errors"
)

type qilinProvider struct{}

type qilinSubmitResponse struct {
	ID        string `json:"id"`
	TaskID    string `json:"task_id"`
	Object    string `json:"object"`
	Model     string `json:"model"`
	Status    string `json:"status"`
	Progress  int    `json:"progress"`
	CreatedAt int64  `json:"created_at"`
}

type qilinQueryResponse struct {
	ID       string  `json:"id"`
	TaskID   string  `json:"task_id"`
	Status   string  `json:"status"`
	Progress int     `json:"progress"`
	URL      *string `json:"url"`
	VideoURL *string `json:"video_url"`
	Output   *struct {
		URL string `json:"url"`
	} `json:"output,omitempty"`
	CompletedAt int64 `json:"completed_at"`
	Error       *struct {
		Message string `json:"message"`
		Code    string `json:"code"`
	} `json:"error,omitempty"`
}

const qilinGrokBaseVideoModel = "grok-imagine-1.0-video"

var qilinGrokLongModelByDuration = map[int]string{
	20: "grok-imagine-1.0-video-20s",
	30: "grok-imagine-1.0-video-30s",
}

var qilinGrokLockedDurationByModel = map[string]int{
	"grok-imagine-1.0-video-20s": 20,
	"grok-imagine-1.0-video-30s": 30,
}

func (p *qilinProvider) submitURL(baseURL string) string {
	return fmt.Sprintf("%s/v1/videos", baseURL)
}

func (p *qilinProvider) queryURL(baseURL, taskID string) string {
	return fmt.Sprintf("%s/v1/videos/%s", baseURL, taskID)
}

func (p *qilinProvider) parseSubmitResponse(body []byte) (string, error) {
	var resp qilinSubmitResponse
	if err := common.Unmarshal(body, &resp); err != nil {
		return "", errors.Wrap(err, "unmarshal qilin submit response failed")
	}
	id := resp.ID
	if id == "" {
		id = resp.TaskID
	}
	if id == "" {
		return "", fmt.Errorf("qilin submit response id/task_id is empty")
	}
	return id, nil
}

func (p *qilinProvider) parseQueryResponse(body []byte) (*relaycommon.TaskInfo, error) {
	var resp qilinQueryResponse
	if err := common.Unmarshal(body, &resp); err != nil {
		return nil, errors.Wrap(err, "unmarshal qilin query response failed")
	}

	ti := &relaycommon.TaskInfo{Code: 0}
	ti.Status = statusToTaskStatus(resp.Status)
	if ti.Status == model.TaskStatusSuccess {
		if resp.VideoURL != nil && *resp.VideoURL != "" {
			ti.Url = *resp.VideoURL
		} else if resp.Output != nil && resp.Output.URL != "" {
			ti.Url = resp.Output.URL
		} else if resp.URL != nil && *resp.URL != "" {
			ti.Url = *resp.URL
		}
	}
	if ti.Status == model.TaskStatusFailure {
		if resp.Error != nil {
			ti.Reason = resp.Error.Message
		} else {
			ti.Reason = "task failed"
		}
	}
	if resp.Progress > 0 && resp.Progress < 100 {
		ti.Progress = fmt.Sprintf("%d%%", resp.Progress)
	}
	return ti, nil
}

func (p *qilinProvider) buildSubmitResponseBody(info *relaycommon.RelayInfo, upstreamTaskID string) any {
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

func (p *qilinProvider) needsMultipart() bool { return false }

func (p *qilinProvider) mapModelForImages(model string, hasImages bool) string {
	return model
}

func (p *qilinProvider) normalizeJSONRequest(bodyMap map[string]interface{}, originModel, upstreamModel string, imageCount int) {
	normalizeQilinDuration(bodyMap)
	normalizeQilinSeconds(bodyMap)
	normalizeQilinGrokTransportModel(bodyMap)
	if _, ok := bodyMap["resolution"]; !ok {
		bodyMap["resolution"] = "720p"
	}
	if _, ok := bodyMap["quality"]; !ok {
		bodyMap["quality"] = qilinQualityForResolution(bodyMap["resolution"])
	}
	normalizeQilinImageReference(bodyMap)
	if _, ok := bodyMap["size"]; !ok {
		ratio, _ := bodyMap["aspect_ratio"].(string)
		if ratio == "" {
			ratio, _ = bodyMap["ratio"].(string)
		}
		if size := qilinSizeForAspectRatio(ratio); size != "" {
			bodyMap["size"] = size
		}
	}
}

func (p *qilinProvider) normalizeMultipartRequest(values map[string][]string, originModel, upstreamModel string, imageCount int) {
	if len(values["duration"]) == 0 {
		if seconds := firstValue(values["seconds"]); seconds != "" {
			values["duration"] = []string{seconds}
		}
	}
	if len(values["seconds"]) == 0 {
		if duration := firstValue(values["duration"]); duration != "" {
			values["seconds"] = []string{duration}
		}
	}
	normalizeQilinGrokTransportModelForValues(values)
	if len(values["resolution"]) == 0 {
		values["resolution"] = []string{"720p"}
	}
	if len(values["quality"]) == 0 {
		values["quality"] = []string{qilinQualityForResolution(firstValue(values["resolution"]))}
	}
	if len(values["size"]) > 0 {
		return
	}
	ratio := firstValue(values["aspect_ratio"])
	if ratio == "" {
		ratio = firstValue(values["ratio"])
	}
	if size := qilinSizeForAspectRatio(ratio); size != "" {
		values["size"] = []string{size}
	}
}

func normalizeQilinImageReference(bodyMap map[string]interface{}) {
	if _, ok := bodyMap["image_reference"]; ok {
		return
	}
	urls := collectQilinImageReferenceURLs(bodyMap)
	if len(urls) == 0 {
		return
	}
	refs := make([]map[string]interface{}, 0, len(urls))
	for _, url := range urls {
		refs = append(refs, map[string]interface{}{
			"type": "image_url",
			"image_url": map[string]interface{}{
				"url": url,
			},
		})
	}
	bodyMap["image_reference"] = refs
}

func collectQilinImageReferenceURLs(bodyMap map[string]interface{}) []string {
	keys := []string{"images", "image", "image_urls", "reference_images", "reference_image_urls", "image_url", "file_paths"}
	urls := make([]string, 0)
	seen := make(map[string]struct{})
	add := func(url string) {
		url = strings.TrimSpace(url)
		if url == "" {
			return
		}
		if _, ok := seen[url]; ok {
			return
		}
		seen[url] = struct{}{}
		urls = append(urls, url)
	}
	for _, key := range keys {
		value, ok := bodyMap[key]
		if !ok {
			continue
		}
		switch v := value.(type) {
		case string:
			add(v)
		case []string:
			for _, item := range v {
				add(item)
			}
		case []interface{}:
			for _, item := range v {
				if s, ok := item.(string); ok {
					add(s)
				}
			}
		}
	}
	return urls
}

func normalizeQilinDuration(bodyMap map[string]interface{}) {
	if _, ok := bodyMap["duration"]; ok {
		return
	}
	v, ok := bodyMap["seconds"]
	if !ok {
		return
	}
	if duration := intFromQilinValue(v); duration > 0 {
		bodyMap["duration"] = duration
	}
}

func normalizeQilinSeconds(bodyMap map[string]interface{}) {
	if _, ok := bodyMap["seconds"]; ok {
		return
	}
	if duration := intFromQilinValue(bodyMap["duration"]); duration > 0 {
		bodyMap["seconds"] = strconv.Itoa(duration)
	}
}

func normalizeQilinGrokTransportModel(bodyMap map[string]interface{}) {
	modelName, _ := bodyMap["model"].(string)
	duration := intFromQilinValue(bodyMap["duration"])
	transportModel, normalizedDuration := qilinGrokTransportModelAndDuration(modelName, duration)
	if transportModel != "" {
		bodyMap["model"] = transportModel
	}
	if normalizedDuration > 0 {
		bodyMap["duration"] = normalizedDuration
		bodyMap["seconds"] = strconv.Itoa(normalizedDuration)
	}
}

func normalizeQilinGrokTransportModelForValues(values map[string][]string) {
	modelName := firstValue(values["model"])
	duration := intFromQilinValue(firstValue(values["duration"]))
	transportModel, normalizedDuration := qilinGrokTransportModelAndDuration(modelName, duration)
	if transportModel != "" {
		values["model"] = []string{transportModel}
	}
	if normalizedDuration > 0 {
		v := strconv.Itoa(normalizedDuration)
		values["duration"] = []string{v}
		values["seconds"] = []string{v}
	}
}

func qilinGrokTransportModelAndDuration(modelName string, duration int) (string, int) {
	modelName = strings.TrimSpace(modelName)
	if lockedDuration, ok := qilinGrokLockedDurationByModel[modelName]; ok {
		return modelName, lockedDuration
	}
	if modelName == qilinGrokBaseVideoModel {
		if transportModel, ok := qilinGrokLongModelByDuration[duration]; ok {
			return transportModel, duration
		}
	}
	return "", 0
}

func intFromQilinValue(value interface{}) int {
	switch v := value.(type) {
	case string:
		raw := strings.TrimSuffix(strings.TrimSpace(strings.ToLower(v)), "s")
		n, err := strconv.ParseFloat(raw, 64)
		if err != nil {
			return 0
		}
		return int(n)
	case float64:
		return int(v)
	case int:
		return v
	case int64:
		return int(v)
	}
	return 0
}

func qilinQualityForResolution(resolution interface{}) string {
	raw := strings.TrimSpace(strings.ToLower(fmt.Sprintf("%v", resolution)))
	switch raw {
	case "720p", "1080p", "hd", "high", "高清":
		return "high"
	default:
		return "standard"
	}
}

func firstValue(values []string) string {
	if len(values) == 0 {
		return ""
	}
	return values[0]
}

func qilinSizeForAspectRatio(aspectRatio string) string {
	switch strings.TrimSpace(aspectRatio) {
	case "1:1":
		return "1024x1024"
	case "9:16":
		return "720x1280"
	case "16:9":
		return "1280x720"
	case "4:3":
		return "1152x864"
	case "3:4":
		return "864x1152"
	case "21:9":
		return "1680x720"
	default:
		return ""
	}
}
