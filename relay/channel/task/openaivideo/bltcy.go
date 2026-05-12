package openaivideo

import (
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/pkg/errors"
)

type bltcySubmitResponse struct {
	TaskID string `json:"task_id"`
}

type bltcyQueryResponse struct {
	TaskID     string `json:"task_id"`
	Status     string `json:"status"`
	FailReason string `json:"fail_reason"`
	Progress   string `json:"progress"`
	Data       struct {
		Output string `json:"output"`
	} `json:"data"`
	Error *struct {
		Message string `json:"message"`
		Code    string `json:"code"`
	} `json:"error,omitempty"`
}

type bltcyProvider struct{}

func (p *bltcyProvider) submitURL(baseURL string) string {
	return fmt.Sprintf("%s/v2/videos/generations", baseURL)
}

func (p *bltcyProvider) queryURL(baseURL, taskID string) string {
	return fmt.Sprintf("%s/v2/videos/generations/%s", baseURL, taskID)
}

func (p *bltcyProvider) parseSubmitResponse(body []byte) (string, error) {
	var resp bltcySubmitResponse
	if err := common.Unmarshal(body, &resp); err != nil {
		return "", errors.Wrap(err, "unmarshal bltcy submit response failed")
	}
	if resp.TaskID == "" {
		return "", fmt.Errorf("bltcy response task_id is empty")
	}
	return resp.TaskID, nil
}

func (p *bltcyProvider) parseQueryResponse(body []byte) (*relaycommon.TaskInfo, error) {
	var resp bltcyQueryResponse
	if err := common.Unmarshal(body, &resp); err != nil {
		return nil, errors.Wrap(err, "unmarshal bltcy query response failed")
	}

	ti := &relaycommon.TaskInfo{Code: 0}
	ti.Status = statusToTaskStatus(resp.Status)

	if ti.Status == model.TaskStatusSuccess && resp.Data.Output != "" {
		ti.Url = resp.Data.Output
	}
	if ti.Status == model.TaskStatusFailure {
		if resp.FailReason != "" {
			ti.Reason = resp.FailReason
		} else if resp.Error != nil {
			ti.Reason = resp.Error.Message
		} else {
			ti.Reason = "task failed"
		}
	}
	if resp.Progress != "" {
		ti.Progress = resp.Progress
	}
	return ti, nil
}

func (p *bltcyProvider) buildSubmitResponseBody(info *relaycommon.RelayInfo, upstreamTaskID string) any {
	return map[string]string{
		"id":      info.PublicTaskID,
		"task_id": info.PublicTaskID,
	}
}

func (p *bltcyProvider) needsMultipart() bool { return false }

func (p *bltcyProvider) mapModelForImages(model string, hasImages bool) string {
	if !hasImages {
		return model
	}

	if mapped, ok := bltcyFramesModelMap[model]; ok {
		return mapped
	}

	return model
}

var bltcyFramesModelMap = map[string]string{
	"veo3.1":             "veo3.1",
	"veo3.1-fast":        "veo3.1-fast",
	"veo3.1-pro":         "veo3.1-pro",
	"veo3.1-pro-4k":      "veo3.1-pro-4k",
	"veo3.1-components":  "veo3.1-components",
	"veo3.1-fast-components": "veo3.1-fast-components",
	"veo3":               "veo3-pro-frames",
	"veo3-fast":          "veo3-fast-frames",
	"veo2-fast":          "veo2-fast-frames",
	"veo2":               "veo2-fast-frames",
}
