package service

import (
	"context"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
)

// imageTaskTerminalFailure reports whether upstream returned a terminal failure.
func imageTaskTerminalFailure(status string) bool {
	switch status {
	case "failed", "error", "cancelled":
		return true
	default:
		return false
	}
}

// upstreamImageTaskConfirmedUncharged re-polls upstream once and requires a terminal
// failure with zero reported cost before we refund the user.
func upstreamImageTaskConfirmedUncharged(task *model.Task) (bool, ImageTaskPollResult) {
	if task == nil {
		return false, ImageTaskPollResult{}
	}
	upstreamID := strings.TrimSpace(task.GetUpstreamTaskID())
	if upstreamID == "" || task.ChannelId <= 0 {
		return true, ImageTaskPollResult{}
	}
	channel, err := model.GetChannelById(task.ChannelId, true)
	if err != nil || channel == nil {
		return false, ImageTaskPollResult{}
	}
	key, _, apiErr := channel.GetNextEnabledKey()
	if apiErr != nil {
		return false, ImageTaskPollResult{}
	}
	poll, err := fetchImageTaskStatusOnce(channel.GetBaseURL(), key, upstreamID)
	if err != nil {
		return false, poll
	}
	if !imageTaskTerminalFailure(poll.Status) {
		return false, poll
	}
	if poll.UpstreamCost > 0 || poll.CreditsCost > 0 {
		return false, poll
	}
	return true, poll
}

func intFromLogOther(other map[string]interface{}, key string) int {
	if other == nil {
		return 0
	}
	switch v := other[key].(type) {
	case float64:
		return int(v)
	case int:
		return v
	case int64:
		return int(v)
	case string:
		return common.String2Int(v)
	default:
		return 0
	}
}

// RefundImageAsyncTaskQuota refunds the submit-time consume log for a tracked gpt-image-2
// async task that finished in FAILURE. Billing happens at submit (PostTextConsumeQuota),
// but the Task row historically kept quota=0, so RefundTaskQuota was never triggered.
func RefundImageAsyncTaskQuota(ctx context.Context, task *model.Task, reason string) {
	if task == nil || task.UserId <= 0 || strings.TrimSpace(task.TaskID) == "" {
		return
	}
	if task.Status != model.TaskStatusFailure {
		return
	}
	if refunded, err := model.HasRefundLogForTask(task.UserId, task.TaskID); err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("refund lookup failed for task %s: %v", task.TaskID, err))
		return
	} else if refunded {
		return
	}

	ok, poll := upstreamImageTaskConfirmedUncharged(task)
	if !ok {
		if poll.Status != "" {
			logger.LogWarn(ctx, fmt.Sprintf(
				"skip refund for task %s: upstream status=%s cost=%v credits_cost=%v",
				task.TaskID, poll.Status, poll.UpstreamCost, poll.CreditsCost,
			))
		}
		return
	}

	row, err := model.FindConsumeLogRowForTask(task.UserId, task.TaskID)
	if err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("consume log not found for task %s: %v", task.TaskID, err))
		return
	}
	quota := row.Quota
	if quota <= 0 {
		return
	}

	otherMap, _ := common.StrToMap(row.Other)
	billingSource := BillingSourceWallet
	if otherMap != nil {
		if src, ok := otherMap["billing_source"].(string); ok && strings.TrimSpace(src) != "" {
			billingSource = strings.TrimSpace(src)
		}
	}

	switch billingSource {
	case BillingSourceSubscription:
		subID := intFromLogOther(otherMap, "subscription_id")
		if subID <= 0 {
			logger.LogWarn(ctx, fmt.Sprintf("skip subscription refund for task %s: missing subscription_id", task.TaskID))
			return
		}
		if err := model.PostConsumeUserSubscriptionDelta(subID, -int64(quota)); err != nil {
			logger.LogWarn(ctx, fmt.Sprintf("subscription refund failed for task %s: %v", task.TaskID, err))
			return
		}
	default:
		if err := model.IncreaseUserQuota(task.UserId, quota, false); err != nil {
			logger.LogWarn(ctx, fmt.Sprintf("wallet refund failed for task %s: %v", task.TaskID, err))
			return
		}
	}

	if row.TokenId > 0 {
		if tokenKey := resolveTokenKey(ctx, row.TokenId, task.TaskID); tokenKey != "" {
			if err := model.IncreaseTokenQuota(row.TokenId, tokenKey, quota); err != nil {
				logger.LogWarn(ctx, fmt.Sprintf("token refund failed for task %s: %v", task.TaskID, err))
			}
		}
	}

	refundOther := map[string]interface{}{
		"task_id":       task.TaskID,
		"reason":        reason,
		"refund_source": "image_async_task_failure",
	}
	if poll.FailCode != "" {
		refundOther["task_fail_code"] = poll.FailCode
	}
	if strings.TrimSpace(poll.DisplayFailReason()) != "" {
		refundOther["task_fail_reason"] = poll.DisplayFailReason()
	}
	if otherMap != nil {
		for _, key := range []string{"model_price", "model_ratio", "group_ratio", "billing_source", "upstream_model_name", "is_model_mapped"} {
			if v, ok := otherMap[key]; ok {
				refundOther[key] = v
			}
		}
	}

	model.RecordTaskBillingLog(model.RecordTaskBillingLogParams{
		UserId:    task.UserId,
		LogType:   model.LogTypeRefund,
		Content:   reason,
		ChannelId: row.ChannelId,
		ModelName: row.ModelName,
		Quota:     quota,
		TokenId:   row.TokenId,
		Group:     row.Group,
		Other:     refundOther,
	})

	_ = model.UpdateLogResultByTaskID(task.UserId, task.TaskID, 0, map[string]interface{}{
		"task_refunded": true,
	})

	logger.LogInfo(ctx, fmt.Sprintf(
		"refunded image async task %s user=%d quota=%s reason=%s",
		task.TaskID, task.UserId, logger.LogQuota(quota), reason,
	))
}
