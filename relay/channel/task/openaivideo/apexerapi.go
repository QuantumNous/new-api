package openaivideo

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/pkg/errors"
)

type apexerapiProvider struct{}

type apexerapiSubmitResp struct {
	ID               string `json:"id"`
	TaskID           string `json:"task_id"`
	Status           string `json:"status"`
	StatusUpdateTime int64  `json:"status_update_time"`
}

func (p *apexerapiProvider) submitURL(baseURL string) string {
	return baseURL + "/v1/videos"
}

func (p *apexerapiProvider) queryURL(baseURL, taskID string) string {
	return baseURL + "/v1/videos/" + taskID
}

func (p *apexerapiProvider) parseSubmitResponse(body []byte) (string, error) {
	var resp apexerapiSubmitResp
	if err := common.Unmarshal(body, &resp); err != nil {
		return "", errors.Wrap(err, "unmarshal apexerapi submit response failed")
	}
	if resp.ID == "" {
		return "", errors.Errorf("apexerapi submit returned empty id, body=%s", string(body))
	}
	return resp.ID, nil
}

func (p *apexerapiProvider) parseQueryResponse(body []byte) (*relaycommon.TaskInfo, error) {
	var resp struct {
		ID          string  `json:"id"`
		Status      string  `json:"status"`
		VideoURL    *string `json:"video_url"`
		Progress    int     `json:"progress"`
		CompletedAt int64   `json:"completed_at"`
		Error       *struct {
			Message string `json:"message"`
			Code    string `json:"code"`
		} `json:"error,omitempty"`
	}
	if err := common.Unmarshal(body, &resp); err != nil {
		return nil, errors.Wrap(err, "unmarshal apexerapi query response failed")
	}

	taskInfo := &relaycommon.TaskInfo{
		TaskID: resp.ID,
		Status: statusToTaskStatus(resp.Status),
	}

	if taskInfo.Status == model.TaskStatusSuccess && resp.VideoURL != nil && *resp.VideoURL != "" {
		taskInfo.Url = *resp.VideoURL
	}

	if taskInfo.Status == model.TaskStatusFailure {
		if resp.Error != nil {
			taskInfo.Reason = resp.Error.Message
		} else {
			taskInfo.Reason = resp.Status
		}
	}

	if resp.Progress > 0 && resp.Progress < 100 {
		taskInfo.Progress = fmt.Sprintf("%d%%", resp.Progress)
	}

	return taskInfo, nil
}

func (p *apexerapiProvider) buildSubmitResponseBody(info *relaycommon.RelayInfo, upstreamTaskID string) any {
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

func (p *apexerapiProvider) needsMultipart() bool { return false }

func (p *apexerapiProvider) mapModelForImages(model string, hasImages bool) string {
	if mapped, ok := apexerModelMap[model]; ok {
		return mapped
	}
	return strings.ReplaceAll(model, "-", "_")
}

func (p *apexerapiProvider) normalizeJSONRequest(bodyMap map[string]interface{}, originModel, upstreamModel string, imageCount int) {
	if _, ok := bodyMap["type"]; !ok {
		bodyMap["type"] = inferApexerVideoType(originModel, upstreamModel, imageCount)
	}
}

func (p *apexerapiProvider) normalizeMultipartRequest(values map[string][]string, originModel, upstreamModel string, imageCount int) {
	if _, ok := values["type"]; !ok {
		values["type"] = []string{fmt.Sprintf("%d", inferApexerVideoType(originModel, upstreamModel, imageCount))}
	}
}

func inferApexerVideoType(originModel, upstreamModel string, imageCount int) int {
	model := originModel
	if model == "" {
		model = upstreamModel
	}
	model = strings.ToLower(model)

	if strings.Contains(model, "components") || imageCount > 2 {
		return 3
	}
	if imageCount > 0 {
		return 2
	}
	return 1
}

var apexerModelMap = map[string]string{
	"veo3.1":                    "veo3.1_relaxed",
	"veo3.1-fast":               "veo3.1_fast",
	"veo3.1-pro":                "veo3.1_pro",
	"veo3.1-4k":                 "veo3.1_relaxed_4k",
	"veo3.1-fast-4k":            "veo3.1_fast_4k",
	"veo3.1-pro-4k":             "veo3.1_pro_4k",
	"veo3.1-components":         "veo3.1_relaxed",
	"veo3.1-fast-components":    "veo3.1_fast",
	"veo3.1-components-4k":      "veo3.1_relaxed_4k",
	"veo3.1-fast-components-4k": "veo3.1_fast_4k",
}
