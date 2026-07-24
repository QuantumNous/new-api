package sora2u

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

type upstreamEnvelope struct {
	Success bool          `json:"success"`
	Task    *upstreamTask `json:"task"`
}

type upstreamTask struct {
	ID           string `json:"id"`
	Status       string `json:"status"`
	Progress     int    `json:"progress"`
	ProgressText string `json:"progress_text"`
	Model        string `json:"model"`
	Mode         string `json:"mode"`
	Prompt       string `json:"prompt"`
	Duration     int    `json:"duration"`
	VideoURL     string `json:"video_url"`
	Error        string `json:"error"`
	ErrorCode    string `json:"error_code"`
	Retryable    *bool  `json:"retryable"`
}

func parseCreateTask(body []byte) (id, status string, err error) {
	var env upstreamEnvelope
	if err := common.Unmarshal(body, &env); err != nil {
		return "", "", fmt.Errorf("unmarshal create response: %w", err)
	}
	if env.Task == nil {
		return "", "", fmt.Errorf("task is empty")
	}
	id = strings.TrimSpace(env.Task.ID)
	if id == "" {
		return "", "", fmt.Errorf("task_id is empty")
	}
	return id, strings.TrimSpace(env.Task.Status), nil
}

func parseTaskResult(body []byte) (*relaycommon.TaskInfo, error) {
	var env upstreamEnvelope
	if err := common.Unmarshal(body, &env); err != nil {
		return nil, fmt.Errorf("unmarshal task result: %w", err)
	}
	if env.Task == nil {
		return nil, fmt.Errorf("task is empty")
	}
	t := env.Task
	info := &relaycommon.TaskInfo{Code: 0}

	switch strings.ToLower(strings.TrimSpace(t.Status)) {
	case "pending", "queued":
		info.Status = string(model.TaskStatusQueued)
	case "processing", "in_progress", "running":
		info.Status = string(model.TaskStatusInProgress)
	case "completed", "success", "succeeded":
		info.Status = string(model.TaskStatusSuccess)
		info.Url = strings.TrimSpace(t.VideoURL)
	case "failed", "failure", "cancelled", "canceled", "error":
		info.Status = string(model.TaskStatusFailure)
		info.Reason = failReason(t)
	default:
		if strings.TrimSpace(t.Error) != "" {
			info.Status = string(model.TaskStatusFailure)
			info.Reason = failReason(t)
		} else {
			info.Status = string(model.TaskStatusInProgress)
		}
	}

	if t.Progress > 0 && t.Progress < 100 {
		info.Progress = fmt.Sprintf("%d%%", t.Progress)
	} else if t.Progress >= 100 && info.Status == string(model.TaskStatusSuccess) {
		info.Progress = "100%"
	}

	return info, nil
}

func failReason(t *upstreamTask) string {
	msg := strings.TrimSpace(t.Error)
	code := strings.TrimSpace(t.ErrorCode)
	switch {
	case msg != "" && code != "":
		return msg + " (" + code + ")"
	case msg != "":
		return msg
	case code != "":
		return code
	default:
		return "task failed"
	}
}
