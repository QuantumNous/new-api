package openaivideo

import (
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/pkg/errors"
)

// manxiaobaiProvider 适配漫小白（api.manxiaobai.online）。
// 标准 OpenAI Video 协议：POST /v1/videos（JSON）、GET /v1/videos/{id}、
// 下载 GET /v1/videos/{id}/content。注意 seconds 必须是字符串，数字会被 400 拒绝。
// grok-imagine-video 支持文生/参考图；grok-imagine-video-1.5-preview 必须带参考图
// （上游另有 /v1/video-reference-images 预上传接口，待账号充值后实测补充）。
type manxiaobaiSubmitResponse struct {
	ID     string `json:"id"`
	TaskID string `json:"task_id"`
	Status string `json:"status"`
}

type manxiaobaiQueryResponse struct {
	ID          string  `json:"id"`
	TaskID      string  `json:"task_id"`
	Status      string  `json:"status"`
	Progress    int     `json:"progress"`
	VideoURL    *string `json:"video_url"`
	URL         *string `json:"url"`
	DownloadURL *string `json:"download_url"`
	Error       *struct {
		Message string `json:"message"`
		Code    string `json:"code"`
	} `json:"error,omitempty"`
}

type manxiaobaiProvider struct{}

func (p *manxiaobaiProvider) submitURL(baseURL string) string {
	return fmt.Sprintf("%s/v1/videos", baseURL)
}

func (p *manxiaobaiProvider) queryURL(baseURL, taskID string) string {
	return fmt.Sprintf("%s/v1/videos/%s", baseURL, taskID)
}

func (p *manxiaobaiProvider) parseSubmitResponse(body []byte) (string, error) {
	var resp manxiaobaiSubmitResponse
	if err := common.Unmarshal(body, &resp); err != nil {
		return "", errors.Wrap(err, "unmarshal manxiaobai submit response failed")
	}
	id := resp.ID
	if id == "" {
		id = resp.TaskID
	}
	if id == "" {
		return "", fmt.Errorf("manxiaobai response id/task_id is empty")
	}
	return id, nil
}

func (p *manxiaobaiProvider) parseQueryResponse(body []byte) (*relaycommon.TaskInfo, error) {
	var resp manxiaobaiQueryResponse
	if err := common.Unmarshal(body, &resp); err != nil {
		return nil, errors.Wrap(err, "unmarshal manxiaobai query response failed")
	}

	ti := &relaycommon.TaskInfo{Code: 0}
	ti.Status = statusToTaskStatus(resp.Status)

	if ti.Status == model.TaskStatusSuccess {
		for _, candidate := range []*string{resp.VideoURL, resp.URL, resp.DownloadURL} {
			if candidate != nil && *candidate != "" {
				ti.Url = *candidate
				break
			}
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

func (p *manxiaobaiProvider) buildSubmitResponseBody(info *relaycommon.RelayInfo, upstreamTaskID string) any {
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

// JSON 直传即可，无需转 multipart 表单。
func (p *manxiaobaiProvider) needsMultipart() bool { return false }

func (p *manxiaobaiProvider) mapModelForImages(model string, hasImages bool) string {
	return model
}

// normalizeJSONRequest 收敛漫小白的字段要求：
// - seconds 必须是字符串（数字会被上游 400 拒绝），duration 互补；
// - 默认补横屏尺寸（上游仅支持 1792x1024 / 1024x1792）。
func (p *manxiaobaiProvider) normalizeJSONRequest(bodyMap map[string]interface{}, originModel, upstreamModel string, imageCount int) {
	seconds := ""
	switch v := bodyMap["seconds"].(type) {
	case string:
		seconds = v
	case float64:
		seconds = fmt.Sprintf("%d", int(v))
	}
	if seconds == "" {
		if d, ok := bodyMap["duration"].(float64); ok && d > 0 {
			seconds = fmt.Sprintf("%d", int(d))
		}
	}
	if seconds == "" {
		seconds = "10"
	}
	bodyMap["seconds"] = seconds
	delete(bodyMap, "duration")

	if size, _ := bodyMap["size"].(string); size != "1792x1024" && size != "1024x1792" {
		if fmtString(bodyMap["aspect_ratio"]) == "9:16" || isPortraitSize(size) {
			bodyMap["size"] = "1024x1792"
		} else {
			bodyMap["size"] = "1792x1024"
		}
	}
	delete(bodyMap, "aspect_ratio")
}

// normalizeMultipartRequest 表单路径：seconds 本身是字符串，补默认值并归一尺寸。
func (p *manxiaobaiProvider) normalizeMultipartRequest(values map[string][]string, originModel, upstreamModel string, imageCount int) {
	getFirst := func(key string) string {
		if v := values[key]; len(v) > 0 {
			return v[0]
		}
		return ""
	}
	if getFirst("seconds") == "" {
		if d := getFirst("duration"); d != "" {
			values["seconds"] = []string{d}
		} else {
			values["seconds"] = []string{"10"}
		}
	}
	delete(values, "duration")

	if size := getFirst("size"); size != "1792x1024" && size != "1024x1792" {
		if getFirst("aspect_ratio") == "9:16" || isPortraitSize(size) {
			values["size"] = []string{"1024x1792"}
		} else {
			values["size"] = []string{"1792x1024"}
		}
	}
	delete(values, "aspect_ratio")
}

// isPortraitSize 判断 WxH 尺寸是否竖屏。
func isPortraitSize(size string) bool {
	var w, h int
	if _, err := fmt.Sscanf(size, "%dx%d", &w, &h); err != nil {
		return false
	}
	return h > w
}
