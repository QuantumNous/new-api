package mao

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/tidwall/gjson"
)

func parseCreateTaskID(respBody []byte) (string, error) {
	raw := string(respBody)
	if msg := extractErrorMessage(raw); msg != "" && isUpstreamError(raw) {
		return "", fmt.Errorf("%s", msg)
	}
	for _, path := range []string{"task_id", "data.task_id", "id", "data.id"} {
		if id := strings.TrimSpace(gjson.Get(raw, path).String()); id != "" {
			return id, nil
		}
	}
	return "", fmt.Errorf("task_id not found in create response")
}

func isUpstreamError(raw string) bool {
	if code := gjson.Get(raw, "code"); code.Exists() {
		s := strings.ToLower(strings.TrimSpace(code.String()))
		if s != "" && s != "success" && s != "0" && s != "200" {
			return true
		}
		if code.Type == gjson.Number && code.Int() != 0 && code.Int() != 200 {
			return true
		}
	}
	status := strings.ToLower(strings.TrimSpace(gjson.Get(raw, "status").String()))
	return status == "failed" || status == "error" || status == "failure"
}

func parseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	raw := string(respBody)
	if isUpstreamError(raw) {
		ti := relaycommon.TaskInfo{
			Status:   model.TaskStatusFailure,
			Progress: "100%",
			Reason:   extractErrorMessage(raw),
		}
		if ti.Reason == "" {
			ti.Reason = "task failed"
		}
		return &ti, nil
	}

	status := resolveUpstreamStatus(raw)
	taskResult := relaycommon.TaskInfo{Code: 0}

	if isFailureUpstreamStatus(status) {
		taskResult.Status = model.TaskStatusFailure
		taskResult.Progress = "100%"
		taskResult.Reason = extractErrorMessage(raw)
		if taskResult.Reason == "" {
			taskResult.Reason = "task failed"
		}
		return &taskResult, nil
	}

	if u := extractVideoURL(raw); u != "" && isSuccessLikeUpstreamStatus(status) {
		taskResult.Status = model.TaskStatusSuccess
		taskResult.Progress = "100%"
		taskResult.Url = u
		return &taskResult, nil
	}

	if isInProgressUpstreamStatus(status) {
		taskResult.Status = model.TaskStatusInProgress
		taskResult.Progress = formatProgress(raw)
		return &taskResult, nil
	}

	if isSuccessLikeUpstreamStatus(status) {
		if u := extractVideoURL(raw); u != "" {
			taskResult.Status = model.TaskStatusSuccess
			taskResult.Progress = "100%"
			taskResult.Url = u
			return &taskResult, nil
		}
		taskResult.Status = model.TaskStatusFailure
		taskResult.Progress = "100%"
		taskResult.Reason = "completed but video url is empty"
		return &taskResult, nil
	}

	if u := extractVideoURL(raw); u != "" {
		taskResult.Status = model.TaskStatusSuccess
		taskResult.Progress = "100%"
		taskResult.Url = u
		return &taskResult, nil
	}

	taskResult.Status = model.TaskStatusInProgress
	taskResult.Progress = formatProgress(raw)
	return &taskResult, nil
}

func resolveUpstreamStatus(raw string) string {
	for _, path := range []string{
		"data.status",
		"data.data.status",
		"status",
	} {
		s := strings.ToLower(strings.TrimSpace(gjson.Get(raw, path).String()))
		if s == "" {
			continue
		}
		return s
	}
	return ""
}

func isFailureUpstreamStatus(status string) bool {
	switch status {
	case "failed", "failure", "error", "cancelled", "canceled":
		return true
	default:
		return false
	}
}

func isInProgressUpstreamStatus(status string) bool {
	switch status {
	case "queued", "pending", "submitted", "preparing_reference_video",
		"processing_reference_video", "submitting", "processing",
		"running", "in_progress", "polling":
		return true
	default:
		return false
	}
}

func isSuccessLikeUpstreamStatus(status string) bool {
	switch status {
	case "success", "completed", "succeeded":
		return true
	default:
		return false
	}
}

func formatProgress(raw string) string {
	for _, path := range []string{"data.progress", "data.data.progress", "progress"} {
		val := gjson.Get(raw, path)
		if !val.Exists() {
			continue
		}
		if val.Type == gjson.String {
			if p := strings.TrimSpace(val.String()); p != "" {
				return p
			}
		}
		if p := val.Int(); p > 0 && p < 100 {
			return fmt.Sprintf("%d%%", p)
		}
	}
	return "30%"
}

func extractVideoURL(raw string) string {
	// Prefer direct media URLs; skip upstream gateway proxy links like
	// https://api.catertx.com/v1/videos/task_xxx/content (those leak upstream host
	// and are not playable without the upstream's auth cookies/keys).
	for _, path := range []string{
		"data.data.url",
		"data.data.video_url",
		"data.data.data.0.url",
		"data.video_url",
		"data.url",
		"video_url",
		"url",
		"data.result_url",
		"result_url",
	} {
		val := gjson.Get(raw, path)
		if !val.Exists() {
			continue
		}
		u := strings.TrimSpace(val.String())
		if u == "" || !strings.HasPrefix(u, "http") {
			continue
		}
		if isVideoProxyContentURL(u) {
			continue
		}
		return u
	}
	return ""
}

// isVideoProxyContentURL reports whether u looks like a new-api style video content proxy
// (any host): .../v1/videos/{id}/content
func isVideoProxyContentURL(u string) bool {
	u = strings.TrimSpace(u)
	idx := strings.Index(u, "/v1/videos/")
	if idx < 0 {
		return false
	}
	rest := u[idx+len("/v1/videos/"):]
	slash := strings.IndexByte(rest, '/')
	if slash <= 0 {
		return false
	}
	return strings.HasPrefix(rest[slash:], "/content")
}

func extractErrorMessage(raw string) string {
	for _, path := range []string{
		"data.fail_reason",
		"data.data.fail_reason",
		"fail_reason",
		"message",
		"msg",
		"error.message",
	} {
		if msg := strings.TrimSpace(gjson.Get(raw, path).String()); msg != "" {
			return msg
		}
	}
	return ""
}
