package controller

import (
	"context"
	"errors"
	"fmt"
	"html"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
)

type channelRatioMonitorTaskHandler struct{}

const maxChannelRatioMonitorTaskFailureDetails = 100

type channelRatioMonitorTaskResult struct {
	Total                   int                              `json:"total"`
	Updated                 int                              `json:"updated"`
	Changed                 int                              `json:"changed"`
	BalanceUpdated          int                              `json:"balance_updated"`
	BalanceWarnings         int                              `json:"balance_warnings,omitempty"`
	Skipped                 int                              `json:"skipped,omitempty"`
	Failed                  int                              `json:"failed"`
	GroupsUpdated           int                              `json:"groups_updated"`
	GroupUpdateFailed       bool                             `json:"group_update_failed,omitempty"`
	ChannelsDisabled        int                              `json:"channels_disabled"`
	GroupsSkipped           int                              `json:"groups_skipped"`
	Retried                 int                              `json:"retried,omitempty"`
	RecoveredAfterRetry     int                              `json:"recovered_after_retry,omitempty"`
	Failures                []channelRatioMonitorTaskFailure `json:"failures,omitempty"`
	FailureDetailsTruncated bool                             `json:"failure_details_truncated,omitempty"`
	EmailStatus             string                           `json:"email_status,omitempty"`
	EmailError              string                           `json:"email_error,omitempty"`
}

type channelRatioMonitorTaskFailure struct {
	ChannelId   int    `json:"channel_id"`
	ChannelName string `json:"channel_name"`
	Error       string `json:"error"`
}

func (result *channelRatioMonitorTaskResult) recordFailure(channelId int, channelName string, failure error) {
	result.Failed++
	if len(result.Failures) >= maxChannelRatioMonitorTaskFailureDetails {
		result.FailureDetailsTruncated = true
		return
	}

	nameRunes := []rune(strings.TrimSpace(channelName))
	if len(nameRunes) > 128 {
		nameRunes = nameRunes[:128]
	}
	errorMessage := "上游同步失败"
	if failure != nil && strings.TrimSpace(failure.Error()) != "" {
		errorMessage = strings.TrimSpace(failure.Error())
	}
	errorRunes := []rune(errorMessage)
	if len(errorRunes) > 255 {
		errorMessage = string(errorRunes[:255])
	}
	result.Failures = append(result.Failures, channelRatioMonitorTaskFailure{
		ChannelId:   channelId,
		ChannelName: string(nameRunes),
		Error:       errorMessage,
	})
}

type channelRatioMonitorEmailChange struct {
	ChannelId     int
	ChannelName   string
	UpstreamType  string
	UpstreamGroup string
	OldRatio      float64
	NewRatio      float64
}

type channelRatioMonitorBalanceWarning struct {
	ChannelId    int
	ChannelName  string
	UpstreamType string
	Balance      float64
	Threshold    float64
}

func ListChannelMonitorTasks(c *gin.Context) {
	taskType := model.SystemTaskTypeChannelRatioMonitor
	switch c.DefaultQuery("kind", "ratio") {
	case "ratio":
	case "schedule":
		taskType = channelMonitorSmartScheduleTaskType
	default:
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "定时任务类型无效"})
		return
	}
	pageInfo := common.GetPageQuery(c)
	tasks, total, err := model.GetChannelMonitorTasksByType(taskType, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}

	responses := make([]model.SystemTaskResponse, 0, len(tasks))
	for _, task := range tasks {
		responses = append(responses, task.ToResponse())
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(responses)
	common.ApiSuccess(c, pageInfo)
}

func RunChannelMonitorRatioUpdate(c *gin.Context) {
	task, created, err := service.EnqueueSystemTask(model.SystemTaskTypeChannelRatioMonitor, nil)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "channel.monitor_ratio_update_run", map[string]interface{}{
		"created": created,
		"task_id": task.TaskID,
	})
	common.ApiSuccess(c, gin.H{
		"created": created,
		"task":    task.ToResponse(),
	})
}

func (channelRatioMonitorTaskHandler) Type() string {
	return model.SystemTaskTypeChannelRatioMonitor
}

func (channelRatioMonitorTaskHandler) Enabled() bool {
	return getChannelMonitorSettings().AutoUpdateIntervalMinutes > 0
}

func (channelRatioMonitorTaskHandler) Interval() time.Duration {
	minutes := getChannelMonitorSettings().AutoUpdateIntervalMinutes
	if minutes <= 0 {
		minutes = 1
	}
	return time.Duration(minutes) * time.Minute
}

func (channelRatioMonitorTaskHandler) NewPayload() any { return nil }

func (channelRatioMonitorTaskHandler) Run(ctx context.Context, task *model.SystemTask, runnerID string) {
	summary, err := runChannelRatioMonitorTaskOnce(ctx, service.NewSystemTaskProgressReporter(task, runnerID), common.SendEmail)
	if err != nil {
		finishSystemTaskHandler(task, runnerID, model.SystemTaskStatusFailed, summary, err)
		return
	}
	finishSystemTaskHandler(task, runnerID, model.SystemTaskStatusSucceeded, summary, nil)
}

func runChannelRatioMonitorTaskOnce(ctx context.Context, reportProgress func(processed, total int), sendEmail func(subject string, receiver string, content string) error) (summary channelRatioMonitorTaskResult, taskErr error) {
	if reportProgress == nil {
		reportProgress = func(int, int) {}
	}
	settings := getChannelMonitorSettings()
	emailChanges := make([]channelRatioMonitorEmailChange, 0)
	balanceWarnings := make([]channelRatioMonitorBalanceWarning, 0)
	defer func() {
		shouldNotify := len(emailChanges) > 0 || len(balanceWarnings) > 0 || summary.Failed > 0 || summary.GroupUpdateFailed || taskErr != nil
		if !shouldNotify || !settings.EmailNotificationEnabled || settings.NotificationEmail == "" {
			return
		}
		if err := sendChannelRatioMonitorNotificationEmail(settings.NotificationEmail, emailChanges, balanceWarnings, summary, taskErr, sendEmail); err != nil {
			summary.EmailStatus = "failed"
			errorMessage := err.Error()
			errorRunes := []rune(errorMessage)
			if len(errorRunes) > 255 {
				errorMessage = string(errorRunes[:255])
			}
			summary.EmailError = errorMessage
			logger.LogWarn(ctx, fmt.Sprintf("channel ratio monitor: notification email failed: %v", err))
			return
		}
		summary.EmailStatus = "sent"
		if len(balanceWarnings) == 0 {
			return
		}
		channelIds := make([]int, 0, len(balanceWarnings))
		for _, warning := range balanceWarnings {
			channelIds = append(channelIds, warning.ChannelId)
		}
		if err := model.MarkChannelRatioMonitorBalanceAlertsNotified(channelIds); err != nil {
			if taskErr == nil {
				taskErr = fmt.Errorf("记录余额预警通知状态失败: %w", err)
			} else {
				taskErr = fmt.Errorf("%w（记录余额预警通知状态失败：%v）", taskErr, err)
			}
			logger.LogWarn(ctx, fmt.Sprintf("channel ratio monitor: balance alert state update failed: %v", err))
		}
	}()

	monitors, err := model.GetChannelRatioMonitors()
	if err != nil {
		return summary, err
	}

	configured := make([]model.ChannelRatioMonitor, 0, len(monitors))
	for _, monitor := range monitors {
		if monitor.UpstreamType == service.NewAPIUpstreamType || monitor.UpstreamType == service.Sub2APIUpstreamType {
			configured = append(configured, monitor)
		}
	}
	summary = channelRatioMonitorTaskResult{Total: len(configured)}
	policyInputs := make(map[int]channelMonitorPolicyInput, len(configured))
	for index, monitor := range configured {
		select {
		case <-ctx.Done():
			return summary, ctx.Err()
		default:
		}
		if monitor.UpstreamRatioSyncDisabled && monitor.UpstreamBalanceSyncDisabled {
			summary.Skipped++
			reportProgress(index+1, summary.Total)
			continue
		}

		channel, err := model.GetChannelById(monitor.ChannelId, true)
		if err != nil {
			summary.recordFailure(monitor.ChannelId, "", err)
			if statusErr := model.RecordChannelRatioMonitorFetchFailure(monitor.ChannelId, err.Error()); statusErr != nil {
				logger.LogWarn(ctx, fmt.Sprintf("channel ratio monitor: channel_id=%d failure status update failed: %v", monitor.ChannelId, statusErr))
			}
			logger.LogWarn(ctx, fmt.Sprintf("channel ratio monitor: channel_id=%d lookup failed: %v", monitor.ChannelId, err))
			reportProgress(index+1, summary.Total)
			continue
		}

		var outcome channelMonitorFetchOutcome
		var recordedBalance *float64
		ratioUpdated := false
		syncSkipped := false
		retriesUsed := 0
		for attempt := 0; attempt <= settings.AutoUpdateRetryCount; attempt++ {
			if attempt > 0 {
				select {
				case <-ctx.Done():
					return summary, ctx.Err()
				default:
				}

				refreshedMonitor, refreshErr := model.GetChannelRatioMonitor(monitor.ChannelId)
				if refreshErr != nil {
					err = fmt.Errorf("重试前重新读取上游配置失败: %w", refreshErr)
					break
				}
				monitor = refreshedMonitor
				retriesUsed++
				summary.Retried++
			}

			if monitor.UpstreamRatioSyncDisabled && monitor.UpstreamBalanceSyncDisabled {
				syncSkipped = true
				err = nil
				break
			}
			ratioUpdated = false
			if !monitor.UpstreamRatioSyncDisabled {
				outcome, err = fetchAndRecordChannelMonitorUpstreamRatio(ctx, monitor, channel.GetKeys(), channel.GetSetting().Proxy, 0, "系统自动更新")
				ratioUpdated = err == nil
				if outcome.BalanceRecorded && outcome.Result.Balance.Amount != nil {
					balance := *outcome.Result.Balance.Amount
					recordedBalance = &balance
				}
			} else {
				var balanceResult service.ChannelMonitorUpstreamBalanceResult
				balanceResult, err = fetchAndRecordChannelMonitorUpstreamBalance(ctx, monitor, channel.GetKeys(), channel.GetSetting().Proxy)
				if balanceResult.Amount != nil {
					balance := *balanceResult.Amount
					recordedBalance = &balance
				}
			}
			if err == nil ||
				attempt == settings.AutoUpdateRetryCount ||
				errors.Is(err, service.ErrChannelMonitorUpstreamAuthentication) {
				break
			}
			logger.LogWarn(ctx, fmt.Sprintf(
				"channel ratio monitor: channel_id=%d attempt=%d failed, retrying %d/%d: %v",
				monitor.ChannelId,
				attempt+1,
				attempt+1,
				settings.AutoUpdateRetryCount,
				err,
			))
		}
		if syncSkipped {
			summary.Skipped++
			reportProgress(index+1, summary.Total)
			continue
		}
		if recordedBalance != nil {
			balance := *recordedBalance
			summary.BalanceUpdated++
			if monitor.BalanceWarningThreshold != nil &&
				balance < *monitor.BalanceWarningThreshold &&
				!monitor.BalanceAlertNotified {
				summary.BalanceWarnings++
				balanceWarnings = append(balanceWarnings, channelRatioMonitorBalanceWarning{
					ChannelId:    monitor.ChannelId,
					ChannelName:  channel.Name,
					UpstreamType: monitor.UpstreamType,
					Balance:      balance,
					Threshold:    *monitor.BalanceWarningThreshold,
				})
			}
		}
		if err != nil {
			failureErr := err
			if retriesUsed > 0 {
				failureErr = fmt.Errorf("重试 %d 次后仍失败: %w", retriesUsed, err)
			}
			summary.recordFailure(monitor.ChannelId, channel.Name, failureErr)
			logger.LogWarn(ctx, fmt.Sprintf("channel ratio monitor: channel_id=%d update failed: %v", monitor.ChannelId, failureErr))
		} else {
			summary.Updated++
			if retriesUsed > 0 {
				summary.RecoveredAfterRetry++
			}
			if ratioUpdated {
				policyInputs[monitor.ChannelId] = channelMonitorPolicyInput{
					UpstreamRatio:          outcome.Result.Ratio,
					SingleChannelAction:    monitor.SingleChannelAction,
					MultipleChannelsAction: monitor.MultipleChannelsAction,
				}
				if outcome.Changed {
					summary.Changed++
					emailChanges = append(emailChanges, channelRatioMonitorEmailChange{
						ChannelId:     monitor.ChannelId,
						ChannelName:   channel.Name,
						UpstreamType:  monitor.UpstreamType,
						UpstreamGroup: monitor.UpstreamGroup,
						OldRatio:      monitor.Ratio,
						NewRatio:      outcome.Result.Ratio,
					})
				}
			}
		}
		reportProgress(index+1, summary.Total)
	}
	channels, err := model.GetAllChannelsForMonitor()
	if err != nil {
		return summary, err
	}
	plan := planChannelMonitorPolicyActions(
		channels,
		policyInputs,
		ratio_setting.GetGroupRatioCopy(),
		getChannelMonitorGroupCoefficients(),
	)
	summary.GroupsSkipped = plan.SkippedGroupCount
	summary.GroupsUpdated, summary.ChannelsDisabled, summary.GroupUpdateFailed, err = applyChannelMonitorPolicyPlan(ctx, plan)
	if err != nil {
		return summary, err
	}
	return summary, nil
}

func sendChannelRatioMonitorNotificationEmail(receiver string, changes []channelRatioMonitorEmailChange, balanceWarnings []channelRatioMonitorBalanceWarning, summary channelRatioMonitorTaskResult, taskErr error, sendEmail func(subject string, receiver string, content string) error) error {
	if sendEmail == nil {
		return fmt.Errorf("邮件发送器未初始化")
	}

	var content strings.Builder
	content.WriteString("<p>渠道监控定时更新检测到以下变化或异常：</p>")
	if len(changes) > 0 {
		content.WriteString("<h3>渠道倍率变更</h3>")
		content.WriteString("<table style=\"border-collapse:collapse\"><thead><tr>")
		for _, heading := range []string{"渠道", "上游类型", "上游分组", "原倍率", "新倍率"} {
			fmt.Fprintf(&content, "<th style=\"border:1px solid #ddd;padding:6px 10px;text-align:left\">%s</th>", heading)
		}
		content.WriteString("</tr></thead><tbody>")
		for _, change := range changes {
			upstreamType := "New API"
			if change.UpstreamType == service.Sub2APIUpstreamType {
				upstreamType = "Sub2API"
			}
			fmt.Fprintf(
				&content,
				"<tr><td style=\"border:1px solid #ddd;padding:6px 10px\">%s（ID: %d）</td><td style=\"border:1px solid #ddd;padding:6px 10px\">%s</td><td style=\"border:1px solid #ddd;padding:6px 10px\">%s</td><td style=\"border:1px solid #ddd;padding:6px 10px\">%s</td><td style=\"border:1px solid #ddd;padding:6px 10px\">%s</td></tr>",
				html.EscapeString(change.ChannelName),
				change.ChannelId,
				html.EscapeString(upstreamType),
				html.EscapeString(change.UpstreamGroup),
				strconv.FormatFloat(change.OldRatio, 'f', -1, 64),
				strconv.FormatFloat(change.NewRatio, 'f', -1, 64),
			)
		}
		content.WriteString("</tbody></table>")
	}
	if len(balanceWarnings) > 0 {
		content.WriteString("<h3>上游余额预警</h3>")
		content.WriteString("<table style=\"border-collapse:collapse\"><thead><tr>")
		for _, heading := range []string{"渠道", "上游类型", "当前余额", "预警值"} {
			fmt.Fprintf(&content, "<th style=\"border:1px solid #ddd;padding:6px 10px;text-align:left\">%s</th>", heading)
		}
		content.WriteString("</tr></thead><tbody>")
		for _, warning := range balanceWarnings {
			upstreamType := "New API"
			if warning.UpstreamType == service.Sub2APIUpstreamType {
				upstreamType = "Sub2API"
			}
			fmt.Fprintf(
				&content,
				"<tr><td style=\"border:1px solid #ddd;padding:6px 10px\">%s（ID: %d）</td><td style=\"border:1px solid #ddd;padding:6px 10px\">%s</td><td style=\"border:1px solid #ddd;padding:6px 10px\">%s</td><td style=\"border:1px solid #ddd;padding:6px 10px\">%s</td></tr>",
				html.EscapeString(warning.ChannelName),
				warning.ChannelId,
				html.EscapeString(upstreamType),
				strconv.FormatFloat(warning.Balance, 'f', -1, 64),
				strconv.FormatFloat(warning.Threshold, 'f', -1, 64),
			)
		}
		content.WriteString("</tbody></table>")
	}

	if summary.Failed > 0 {
		content.WriteString("<h3>上游同步失败</h3>")
		fmt.Fprintf(&content, "<p>共 %d 个渠道在重试后仍未更新成功。</p>", summary.Failed)
		if len(summary.Failures) > 0 {
			content.WriteString("<table style=\"border-collapse:collapse\"><thead><tr>")
			for _, heading := range []string{"渠道", "失败原因"} {
				fmt.Fprintf(&content, "<th style=\"border:1px solid #ddd;padding:6px 10px;text-align:left\">%s</th>", heading)
			}
			content.WriteString("</tr></thead><tbody>")
			for _, failure := range summary.Failures {
				channelName := fmt.Sprintf("渠道 ID %d", failure.ChannelId)
				if failure.ChannelName != "" {
					channelName = fmt.Sprintf("%s（ID: %d）", failure.ChannelName, failure.ChannelId)
				}
				fmt.Fprintf(
					&content,
					"<tr><td style=\"border:1px solid #ddd;padding:6px 10px\">%s</td><td style=\"border:1px solid #ddd;padding:6px 10px\">%s</td></tr>",
					html.EscapeString(channelName),
					html.EscapeString(failure.Error),
				)
			}
			content.WriteString("</tbody></table>")
		}
		if summary.FailureDetailsTruncated {
			fmt.Fprintf(&content, "<p>失败渠道较多，邮件仅展示前 %d 条明细。</p>", len(summary.Failures))
		}
	}

	if summary.GroupUpdateFailed {
		content.WriteString("<h3>分组倍率更新失败</h3>")
		content.WriteString("<p>自动写入分组倍率失败，请检查定时更新记录和服务日志。</p>")
		if taskErr != nil {
			fmt.Fprintf(&content, "<p>失败原因：%s</p>", html.EscapeString(taskErr.Error()))
		}
	} else if taskErr != nil {
		content.WriteString("<h3>定时更新任务失败</h3>")
		fmt.Fprintf(&content, "<p>失败原因：%s</p>", html.EscapeString(taskErr.Error()))
	}

	failureCount := summary.Failed
	if summary.GroupUpdateFailed {
		failureCount++
	} else if taskErr != nil {
		failureCount++
	}
	subject := fmt.Sprintf("渠道监控：%d 个渠道的上游倍率发生变化", len(changes))
	if len(balanceWarnings) > 0 {
		parts := make([]string, 0, 3)
		if len(changes) > 0 {
			parts = append(parts, fmt.Sprintf("%d 个倍率变更", len(changes)))
		}
		parts = append(parts, fmt.Sprintf("%d 个余额预警", len(balanceWarnings)))
		if failureCount > 0 {
			parts = append(parts, fmt.Sprintf("%d 项更新失败", failureCount))
		}
		subject = "渠道监控：" + strings.Join(parts, "，")
	} else if len(changes) > 0 && failureCount > 0 {
		subject = fmt.Sprintf("渠道监控：%d 个倍率变更，%d 项更新失败", len(changes), failureCount)
	} else if failureCount > 0 {
		subject = fmt.Sprintf("渠道监控：%d 项更新失败", failureCount)
	}
	return sendEmail(subject, receiver, content.String())
}
