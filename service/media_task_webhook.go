package service

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/url"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	taskcommon "github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

type MediaTaskWebhookPayload struct {
	ID       string          `json:"id"`
	Status   string          `json:"status"`
	Progress int             `json:"progress"`
	Result   json.RawMessage `json:"result"`
	Error    *struct {
		Message string `json:"message"`
		Code    string `json:"code,omitempty"`
	} `json:"error,omitempty"`
	ActualTime int64           `json:"actual_time,omitempty"`
	Cost       float64         `json:"cost,omitempty"`
	Raw        json.RawMessage `json:"-"`
}

type mediaTaskResult struct {
	Images []struct {
		URL any `json:"url"`
	} `json:"images"`
	Videos []struct {
		URL any `json:"url"`
	} `json:"videos"`
	Audios []struct {
		URL any `json:"url"`
	} `json:"audios"`
}

func MediaTaskWebhookBase() string {
	base := strings.TrimRight(strings.TrimSpace(GetCallbackAddress()), "/")
	if !isPublicWebhookBase(base) {
		return ""
	}
	return base + "/api/tasks"
}

func ProcessMediaTaskWebhook(ctx context.Context, body []byte) error {
	var payload MediaTaskWebhookPayload
	if err := common.Unmarshal(body, &payload); err != nil {
		return fmt.Errorf("invalid media task webhook payload: %w", err)
	}
	payload.ID = strings.TrimSpace(payload.ID)
	if payload.ID == "" {
		return fmt.Errorf("missing media task webhook id")
	}
	payload.Raw = append([]byte(nil), body...)

	task, exists, err := model.GetByTaskOrUpstreamTaskId(payload.ID)
	if err != nil {
		return fmt.Errorf("find media task %s: %w", payload.ID, err)
	}
	if !exists || task == nil {
		return fmt.Errorf("media task %s not found", payload.ID)
	}
	if task.Status == model.TaskStatusSuccess || task.Status == model.TaskStatusFailure {
		logger.LogInfo(ctx, fmt.Sprintf("media task webhook duplicate ignored task_id=%s upstream_id=%s status=%s", task.TaskID, payload.ID, task.Status))
		return nil
	}

	fromStatus := task.Status
	now := time.Now().Unix()
	task.Data = payload.Raw

	status := normalizeMediaWebhookStatus(payload.Status)
	switch status {
	case model.TaskStatusSuccess:
		resultURL := firstMediaWebhookURL(payload.Result)
		if task.Platform == constant.TaskPlatformOpenAIImage {
			resultURL = CacheImageLocally(resultURL)
		} else if resultURL != "" {
			taskcommon.ApplyVideoResultURL(task, resultURL)
		}
		if task.Platform == constant.TaskPlatformOpenAIImage {
			task.PrivateData.ResultURL = resultURL
		} else if resultURL == "" {
			task.PrivateData.ResultURL = taskcommon.BuildProxyURL(task.TaskID)
		}
		task.Status = model.TaskStatusSuccess
		task.Progress = taskcommon.ProgressComplete
		task.FinishTime = now
	case model.TaskStatusFailure:
		reason := strings.TrimSpace(payloadFailReason(payload))
		if reason == "" {
			reason = "upstream task failed"
		}
		task.Status = model.TaskStatusFailure
		task.FailReason = reason
		task.Progress = taskcommon.ProgressComplete
		task.FinishTime = now
	default:
		return nil
	}

	won, err := task.UpdateWithStatus(fromStatus)
	if err != nil {
		return fmt.Errorf("update media task %s from webhook: %w", task.TaskID, err)
	}
	if !won {
		logger.LogInfo(ctx, fmt.Sprintf("media task webhook lost CAS task_id=%s from=%s", task.TaskID, fromStatus))
		return nil
	}

	if task.Status == model.TaskStatusFailure {
		if task.Platform == constant.TaskPlatformOpenAIImage {
			RefundImageAsyncTaskQuota(ctx, task, task.FailReason)
		} else if task.Quota != 0 {
			RefundTaskQuota(ctx, task, task.FailReason)
		}
	} else if task.Platform != constant.TaskPlatformOpenAIImage {
		SettleTaskBillingOnComplete(ctx, taskcommon.BaseBilling{}, task, &relaycommon.TaskInfo{
			Status: string(model.TaskStatusSuccess),
			Url:    task.GetResultURL(),
		})
	}

	backfillMediaTaskWebhookLog(ctx, task)
	return nil
}

func normalizeMediaWebhookStatus(status string) model.TaskStatus {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "completed", "complete", "succeeded", "success":
		return model.TaskStatusSuccess
	case "failed", "failure", "error", "cancelled", "canceled":
		return model.TaskStatusFailure
	default:
		return ""
	}
}

func payloadFailReason(payload MediaTaskWebhookPayload) string {
	if payload.Error != nil {
		return strings.TrimSpace(payload.Error.Message)
	}
	var m map[string]any
	if err := common.Unmarshal(payload.Raw, &m); err == nil {
		if msg, ok := m["message"].(string); ok {
			return msg
		}
	}
	return ""
}

func firstMediaWebhookURL(raw json.RawMessage) string {
	var result mediaTaskResult
	if len(raw) == 0 || common.Unmarshal(raw, &result) != nil {
		return ""
	}
	for _, item := range result.Images {
		if u := firstURLValue(item.URL); u != "" {
			return u
		}
	}
	for _, item := range result.Videos {
		if u := firstURLValue(item.URL); u != "" {
			return u
		}
	}
	for _, item := range result.Audios {
		if u := firstURLValue(item.URL); u != "" {
			return u
		}
	}
	return ""
}

func firstURLValue(v any) string {
	switch typed := v.(type) {
	case string:
		return strings.TrimSpace(typed)
	case []any:
		for _, item := range typed {
			if s, ok := item.(string); ok && strings.TrimSpace(s) != "" {
				return strings.TrimSpace(s)
			}
		}
	case []string:
		for _, s := range typed {
			if strings.TrimSpace(s) != "" {
				return strings.TrimSpace(s)
			}
		}
	}
	return ""
}

func backfillMediaTaskWebhookLog(ctx context.Context, task *model.Task) {
	elapsed := int(task.FinishTime - task.SubmitTime)
	if elapsed <= 0 {
		elapsed = 1
	}
	other := map[string]interface{}{}
	if task.Status == model.TaskStatusSuccess && strings.TrimSpace(task.GetResultURL()) != "" {
		other["result_url"] = task.GetResultURL()
	}
	if task.Status == model.TaskStatusFailure {
		other["task_fail_reason"] = task.FailReason
	}
	if err := model.UpdateLogResultByTaskID(task.UserId, task.TaskID, elapsed, other); err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("media task webhook log backfill failed task_id=%s error=%v", task.TaskID, err))
	}
}

func isPublicWebhookBase(raw string) bool {
	u, err := url.Parse(raw)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Hostname() == "" {
		return false
	}
	host := strings.ToLower(u.Hostname())
	if host == "localhost" {
		return false
	}
	if ip := net.ParseIP(host); ip != nil {
		return !ip.IsLoopback() && !ip.IsPrivate() && !ip.IsLinkLocalUnicast()
	}
	return true
}
