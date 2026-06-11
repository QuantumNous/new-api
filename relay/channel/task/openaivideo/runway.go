package openaivideo

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/pkg/errors"
)

type runwayProvider struct{}

type runwaySubmitResponse struct {
	JobID  string `json:"jobId"`
	Status string `json:"status"`
	Error  any    `json:"error,omitempty"`
}

type runwayQueryResponse struct {
	JobID  string `json:"jobId"`
	Kind   string `json:"kind"`
	Status string `json:"status"`
	TaskID string `json:"taskId,omitempty"`
	Result *struct {
		TaskID   string   `json:"taskId"`
		Status   string   `json:"status"`
		Files    []string `json:"files"`
		FileURLs []string `json:"fileUrls"`
	} `json:"result,omitempty"`
	Error any `json:"error,omitempty"`
}

func (p *runwayProvider) submitURL(baseURL string) string {
	return strings.TrimRight(baseURL, "/") + "/video"
}

func (p *runwayProvider) queryURL(baseURL, taskID string) string {
	return strings.TrimRight(baseURL, "/") + "/jobs/" + taskID
}

func (p *runwayProvider) parseSubmitResponse(body []byte) (string, error) {
	var resp runwaySubmitResponse
	if err := common.Unmarshal(body, &resp); err != nil {
		return "", errors.Wrap(err, "unmarshal runway submit response failed")
	}
	if resp.JobID == "" {
		return "", fmt.Errorf("runway response jobId is empty: %s", runwayErrorMessage(resp.Error))
	}
	return resp.JobID, nil
}

func (p *runwayProvider) parseQueryResponse(body []byte) (*relaycommon.TaskInfo, error) {
	var resp runwayQueryResponse
	if err := common.Unmarshal(body, &resp); err != nil {
		return nil, errors.Wrap(err, "unmarshal runway query response failed")
	}

	ti := &relaycommon.TaskInfo{
		Code:   0,
		TaskID: firstNonEmpty(resp.TaskID, resp.JobID),
		Status: statusToTaskStatus(resp.Status),
	}

	if ti.Status == model.TaskStatusSuccess && resp.Result != nil {
		if len(resp.Result.FileURLs) > 0 && strings.TrimSpace(resp.Result.FileURLs[0]) != "" {
			ti.Url = "runway:" + strings.TrimSpace(resp.Result.FileURLs[0])
		}
	}
	if ti.Status == model.TaskStatusFailure {
		ti.Reason = runwayErrorMessage(resp.Error)
		if ti.Reason == "" {
			ti.Reason = "task failed"
		}
	}
	return ti, nil
}

func (p *runwayProvider) buildSubmitResponseBody(info *relaycommon.RelayInfo, upstreamTaskID string) any {
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

func (p *runwayProvider) needsMultipart() bool { return false }

func (p *runwayProvider) forceJSONBody() bool { return true }

func (p *runwayProvider) setupRequestHeader(req *http.Request, apiKey string) {
	req.Header.Set("X-API-Key", apiKey)
}

func (p *runwayProvider) mapModelForImages(model string, hasImages bool) string {
	model = strings.TrimSpace(model)
	if model == "" {
		return "seedance-2"
	}
	return model
}

func (p *runwayProvider) normalizeJSONRequest(bodyMap map[string]interface{}, originModel, upstreamModel string, imageCount int) {
	normalizeRunwayRequestMap(bodyMap)
}

func (p *runwayProvider) normalizeMultipartRequest(values map[string][]string, originModel, upstreamModel string, imageCount int) {
	bodyMap := multipartValuesToMap(values)
	normalizeRunwayRequestMap(bodyMap)
	for k := range values {
		delete(values, k)
	}
	for k, v := range bodyMap {
		values[k] = []string{fmt.Sprintf("%v", v)}
	}
}

func normalizeRunwayRequestMap(bodyMap map[string]interface{}) {
	if _, ok := bodyMap["async"]; !ok {
		bodyMap["async"] = true
	}
	if _, ok := bodyMap["exploreMode"]; !ok {
		bodyMap["exploreMode"] = true
	}
	if _, ok := bodyMap["aspectRatio"]; !ok {
		if ratio := firstStringValue(bodyMap, "aspect_ratio", "ratio"); ratio != "" {
			bodyMap["aspectRatio"] = ratio
		}
	}
	if _, ok := bodyMap["duration"]; !ok {
		if duration := intFromRunwayValue(bodyMap["seconds"]); duration > 0 {
			bodyMap["duration"] = duration
		}
	}
	if _, ok := bodyMap["imageURL"]; !ok {
		if imageURL := firstRunwayImageURL(bodyMap); imageURL != "" {
			bodyMap["imageURL"] = imageURL
		}
	}
	if _, ok := bodyMap["imageAssetID"]; !ok {
		if assetID := firstStringValue(bodyMap, "image_asset_id", "imageAssetId", "asset_id", "assetId"); assetID != "" {
			bodyMap["imageAssetID"] = assetID
		}
	}
	if _, ok := bodyMap["videoURL"]; !ok {
		if videoURL := firstStringValue(bodyMap, "video_url", "source_video_url"); videoURL != "" {
			bodyMap["videoURL"] = videoURL
		}
	}
	if _, ok := bodyMap["videoAssetID"]; !ok {
		if assetID := firstStringValue(bodyMap, "video_asset_id", "videoAssetId"); assetID != "" {
			bodyMap["videoAssetID"] = assetID
		}
	}

	for _, key := range []string{
		"size",
		"seconds",
		"aspect_ratio",
		"ratio",
		"image",
		"images",
		"image_url",
		"image_urls",
		"reference_images",
		"reference_image_urls",
		"input_reference",
		"video_url",
		"video_asset_id",
		"source_video_url",
	} {
		delete(bodyMap, key)
	}
}

func firstRunwayImageURL(bodyMap map[string]interface{}) string {
	for _, key := range []string{"imageURL", "image_url", "image", "input_reference", "images", "image_urls", "reference_images", "reference_image_urls"} {
		if imageURL := firstURLFromRunwayValue(bodyMap[key]); imageURL != "" {
			return imageURL
		}
	}
	return ""
}

func firstURLFromRunwayValue(value interface{}) string {
	switch v := value.(type) {
	case string:
		return strings.TrimSpace(v)
	case []string:
		for _, item := range v {
			if s := strings.TrimSpace(item); s != "" {
				return s
			}
		}
	case []interface{}:
		for _, item := range v {
			if s := firstURLFromRunwayValue(item); s != "" {
				return s
			}
		}
	case map[string]interface{}:
		for _, key := range []string{"url", "imageURL", "image_url"} {
			if s := firstURLFromRunwayValue(v[key]); s != "" {
				return s
			}
		}
		if imageURL, ok := v["image_url"].(map[string]interface{}); ok {
			return firstURLFromRunwayValue(imageURL["url"])
		}
	}
	return ""
}

func firstStringValue(bodyMap map[string]interface{}, keys ...string) string {
	for _, key := range keys {
		if s, ok := bodyMap[key].(string); ok && strings.TrimSpace(s) != "" {
			return strings.TrimSpace(s)
		}
	}
	return ""
}

func intFromRunwayValue(value interface{}) int {
	switch v := value.(type) {
	case int:
		return v
	case int64:
		return int(v)
	case float64:
		return int(v)
	case string:
		n, _ := strconv.Atoi(strings.TrimSpace(v))
		return n
	default:
		return 0
	}
}

func runwayErrorMessage(value any) string {
	switch v := value.(type) {
	case nil:
		return ""
	case string:
		return strings.TrimSpace(v)
	case map[string]any:
		for _, key := range []string{"message", "error", "reason"} {
			if s, ok := v[key].(string); ok && strings.TrimSpace(s) != "" {
				return strings.TrimSpace(s)
			}
		}
	default:
		if b, err := common.Marshal(v); err == nil {
			return string(b)
		}
	}
	return ""
}
