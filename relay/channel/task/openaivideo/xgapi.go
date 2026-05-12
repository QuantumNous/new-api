package openaivideo

import (
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/pkg/errors"
)

type xgapiSubmitResponse struct {
	ID        string `json:"id"`
	Object    string `json:"object"`
	Model     string `json:"model"`
	Status    string `json:"status"`
	Progress  int    `json:"progress"`
	CreatedAt int64  `json:"created_at"`
	Seconds   string `json:"seconds"`
	Size      string `json:"size"`
}

type xgapiQueryResponse struct {
	ID          string  `json:"id"`
	Status      string  `json:"status"`
	Progress    int     `json:"progress"`
	VideoURL    *string `json:"video_url"`
	CompletedAt int64   `json:"completed_at"`
	Error       *struct {
		Message string `json:"message"`
		Code    string `json:"code"`
	} `json:"error,omitempty"`
}

type xgapiProvider struct{}

func (p *xgapiProvider) submitURL(baseURL string) string {
	return fmt.Sprintf("%s/v1/videos", baseURL)
}

func (p *xgapiProvider) queryURL(baseURL, taskID string) string {
	return fmt.Sprintf("%s/v1/videos/%s", baseURL, taskID)
}

func (p *xgapiProvider) parseSubmitResponse(body []byte) (string, error) {
	var resp xgapiSubmitResponse
	if err := common.Unmarshal(body, &resp); err != nil {
		return "", errors.Wrap(err, "unmarshal xgapi submit response failed")
	}
	if resp.ID == "" {
		return "", fmt.Errorf("xgapi response id is empty")
	}
	return resp.ID, nil
}

func (p *xgapiProvider) parseQueryResponse(body []byte) (*relaycommon.TaskInfo, error) {
	var resp xgapiQueryResponse
	if err := common.Unmarshal(body, &resp); err != nil {
		return nil, errors.Wrap(err, "unmarshal xgapi query response failed")
	}

	ti := &relaycommon.TaskInfo{Code: 0}
	ti.Status = statusToTaskStatus(resp.Status)

	if ti.Status == model.TaskStatusSuccess && resp.VideoURL != nil && *resp.VideoURL != "" {
		ti.Url = *resp.VideoURL
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

func (p *xgapiProvider) buildSubmitResponseBody(info *relaycommon.RelayInfo, upstreamTaskID string) any {
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

func (p *xgapiProvider) needsMultipart() bool { return true }

func (p *xgapiProvider) mapModelForImages(model string, hasImages bool) string {
	return model
}
