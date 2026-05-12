package openaivideo

import (
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/pkg/errors"
)

type newapiSubmitResponse struct {
	ID        string `json:"id"`
	TaskID    string `json:"task_id"`
	Object    string `json:"object"`
	Model     string `json:"model"`
	Status    string `json:"status"`
	Progress  int    `json:"progress"`
	CreatedAt int64  `json:"created_at"`
}

type newapiQueryResponse struct {
	ID       string `json:"id"`
	TaskID   string `json:"task_id"`
	Status   string `json:"status"`
	Progress int    `json:"progress"`
	Error    *struct {
		Message string `json:"message"`
		Code    string `json:"code"`
	} `json:"error,omitempty"`
}

type newapiProvider struct{}

func (p *newapiProvider) submitURL(baseURL string) string {
	return fmt.Sprintf("%s/v1/video/generations", baseURL)
}

func (p *newapiProvider) queryURL(baseURL, taskID string) string {
	return fmt.Sprintf("%s/v1/video/generations/%s", baseURL, taskID)
}

func (p *newapiProvider) parseSubmitResponse(body []byte) (string, error) {
	var resp newapiSubmitResponse
	if err := common.Unmarshal(body, &resp); err != nil {
		return "", errors.Wrap(err, "unmarshal newapi submit response failed")
	}
	id := resp.TaskID
	if id == "" {
		id = resp.ID
	}
	if id == "" {
		return "", fmt.Errorf("newapi response task_id/id is empty")
	}
	return id, nil
}

func (p *newapiProvider) parseQueryResponse(body []byte) (*relaycommon.TaskInfo, error) {
	var resp newapiQueryResponse
	if err := common.Unmarshal(body, &resp); err != nil {
		return nil, errors.Wrap(err, "unmarshal newapi query response failed")
	}

	ti := &relaycommon.TaskInfo{Code: 0}
	ti.Status = statusToTaskStatus(resp.Status)

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

func (p *newapiProvider) buildSubmitResponseBody(info *relaycommon.RelayInfo, upstreamTaskID string) any {
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

func (p *newapiProvider) needsMultipart() bool { return true }

func (p *newapiProvider) mapModelForImages(model string, hasImages bool) string {
	return model
}
