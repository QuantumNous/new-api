package controller

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	taskdto "github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	pluginruntime "github.com/QuantumNous/new-api/pkg/jsplugin"
	"github.com/QuantumNous/new-api/relay"
	"github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

const (
	deferredDispatchBatchSize   = 20
	deferredDispatchMaxAttempts = 3
	deferredDispatchLease       = 5 * time.Minute
)

type deferredTaskSubmitFunc func(
	c *gin.Context,
	info *relaycommon.RelayInfo,
	platform constant.TaskPlatform,
	quota int,
	beforeProviderSubmit func() error,
) (*relay.TaskSubmitResult, *taskdto.TaskError)

type deferredTaskDispatchHandler struct {
	submit deferredTaskSubmitFunc
}

type deferredTaskDispatchSummary struct {
	Found      int `json:"found"`
	Claimed    int `json:"claimed"`
	Dispatched int `json:"dispatched"`
	Requeued   int `json:"requeued"`
	Failed     int `json:"failed"`
	Uncertain  int `json:"uncertain"`
}

func (deferredTaskDispatchHandler) Type() string {
	return model.SystemTaskTypeDeferredDispatch
}

func (deferredTaskDispatchHandler) Enabled() bool {
	if model.HasDispatchableDeferredTasks(common.GetTimestamp()) {
		return true
	}
	count, err := model.CountUncertainDeferredTasks()
	if err != nil {
		logger.LogWarn(context.Background(), fmt.Sprintf(
			"count uncertain deferred tasks for scheduler enablement failed: %v",
			err,
		))
		return true
	}
	return count > 0
}

func (deferredTaskDispatchHandler) Interval() time.Duration {
	// Foreground enqueue starts new work immediately. The scheduled pass is for
	// crash recovery and operator warnings, so matching the worker lease avoids
	// creating a persistent stream of warning-only system-task rows.
	return deferredDispatchLease
}

func (deferredTaskDispatchHandler) NewPayload() any {
	return nil
}

func (h deferredTaskDispatchHandler) Run(ctx context.Context, systemTask *model.SystemTask, runnerID string) {
	summary := deferredTaskDispatchSummary{}
	candidates, err := model.FindDispatchableDeferredTasks(common.GetTimestamp(), deferredDispatchBatchSize)
	if err != nil {
		finishSystemTaskHandler(systemTask, runnerID, model.SystemTaskStatusFailed, summary, err)
		return
	}
	summary.Found = len(candidates)
	for _, candidate := range candidates {
		if ctx.Err() != nil {
			finishSystemTaskHandler(systemTask, runnerID, model.SystemTaskStatusFailed, summary, ctx.Err())
			return
		}
		owner := deferredDispatchOwner(runnerID, candidate.ID)
		now := common.GetTimestamp()
		task, claimed, claimErr := model.ClaimDeferredTask(
			candidate.ID,
			owner,
			now,
			now+int64(deferredDispatchLease.Seconds()),
		)
		if claimErr != nil {
			logger.LogWarn(ctx, fmt.Sprintf("claim deferred task %s failed: %v", candidate.TaskID, claimErr))
			continue
		}
		if !claimed {
			continue
		}
		summary.Claimed++

		result, taskErr := dispatchDeferredTaskWithSubmit(ctx, task, h.submit)
		if taskErr != nil {
			reason := deferredTaskFailureReason(taskErr)
			retryable := deferredTaskErrorRetryable(taskErr) && task.DispatchAttempts < deferredDispatchMaxAttempts
			preProviderIO := task.DispatchStatus == model.TaskDispatchStatusRunning
			safeBeforeProviderIO := task.DispatchStatus == model.TaskDispatchStatusUncertain &&
				deferredTaskErrorSafeBeforeProviderIO(taskErr) &&
				!taskErr.NoRetry &&
				!taskErr.ProviderAccepted
			if (preProviderIO || safeBeforeProviderIO) && retryable {
				var won bool
				var requeueErr error
				if preProviderIO {
					won, requeueErr = model.RequeueDeferredTask(task, owner, reason)
				} else {
					won, requeueErr = model.RequeueDeferredTaskBeforeProviderIO(task, owner, reason)
				}
				if requeueErr != nil {
					logger.LogWarn(ctx, fmt.Sprintf("requeue deferred task %s failed: %v", task.TaskID, requeueErr))
				} else if won {
					summary.Requeued++
				}
				continue
			}
			if task.DispatchStatus == model.TaskDispatchStatusUncertain &&
				!safeBeforeProviderIO &&
				!taskErr.ProviderAccepted {
				if _, recordErr := model.RecordDeferredTaskUncertainty(task, owner, reason); recordErr != nil {
					logger.LogWarn(ctx, fmt.Sprintf(
						"record deferred task %s uncertainty failed: %v",
						task.TaskID,
						recordErr,
					))
				}
				logger.LogWarn(ctx, fmt.Sprintf(
					"deferred task %s requires operator resolution: %s",
					task.TaskID,
					reason,
				))
				continue
			}
			var won bool
			var failErr error
			if preProviderIO {
				won, failErr = model.FailDeferredTaskBeforeProviderIO(
					task,
					owner,
					reason,
					common.GetTimestamp(),
				)
			} else {
				won, failErr = model.FailDeferredTask(task, owner, reason, common.GetTimestamp())
			}
			if failErr != nil {
				logger.LogWarn(ctx, fmt.Sprintf("fail deferred task %s failed: %v", task.TaskID, failErr))
				continue
			}
			if won {
				summary.Failed++
				if preProviderIO || safeBeforeProviderIO {
					service.RefundTaskQuota(ctx, task, task.FailReason)
				}
			}
			continue
		}

		applyDeferredTaskResult(task, result)
		won, completeErr := model.CompleteDeferredTask(task, owner)
		if completeErr != nil {
			logger.LogWarn(ctx, fmt.Sprintf("complete deferred task %s failed: %v", task.TaskID, completeErr))
			if result.ProviderAccepted {
				const reason = "provider accepted but deferred completion persistence failed"
				if _, recordErr := model.RecordDeferredTaskUncertainty(task, owner, reason); recordErr != nil {
					logger.LogWarn(ctx, fmt.Sprintf(
						"record accepted deferred task %s uncertainty failed: %v",
						task.TaskID,
						recordErr,
					))
				}
			}
			continue
		}
		if !won {
			continue
		}
		summary.Dispatched++
		if result.Quota != task.Quota {
			service.RecalculateTaskQuota(ctx, task, result.Quota, "deferred submit adjustment")
		}
		if task.Status == model.TaskStatusFailure {
			service.RefundTaskQuota(ctx, task, task.FailReason)
		}
	}
	uncertain, err := model.CountUncertainDeferredTasks()
	if err != nil {
		finishSystemTaskHandler(
			systemTask,
			runnerID,
			model.SystemTaskStatusFailed,
			summary,
			fmt.Errorf("count uncertain deferred tasks: %w", err),
		)
		return
	}
	summary.Uncertain = int(uncertain)
	if summary.Uncertain > 0 {
		logger.LogWarn(ctx, fmt.Sprintf(
			"%d deferred tasks require operator resolution",
			summary.Uncertain,
		))
	}
	finishSystemTaskHandler(systemTask, runnerID, model.SystemTaskStatusSucceeded, summary, nil)
}

func deferredDispatchOwner(runnerID string, taskID int64) string {
	owner := fmt.Sprintf("%s/%d/%s", runnerID, taskID, common.GetRandomString(8))
	if len(owner) > 128 {
		return owner[len(owner)-128:]
	}
	return owner
}

func dispatchDeferredTask(ctx context.Context, task *model.Task) (*relay.TaskSubmitResult, *taskdto.TaskError) {
	return dispatchDeferredTaskWithSubmit(ctx, task, nil)
}

func dispatchDeferredTaskWithSubmit(
	ctx context.Context,
	task *model.Task,
	submit deferredTaskSubmitFunc,
) (*relay.TaskSubmitResult, *taskdto.TaskError) {
	if task == nil || task.PrivateData.DeferredRequest == nil {
		return nil, service.TaskErrorWrapperLocal(
			errors.New("deferred request snapshot is missing"),
			"deferred_request_missing",
			http.StatusInternalServerError,
		)
	}
	user, err := model.GetUserById(task.UserId, false)
	if err != nil || user == nil || user.Status != common.UserStatusEnabled {
		if err == nil {
			err = errors.New("deferred task user is unavailable")
		}
		return nil, service.TaskErrorWrapperLocal(err, "user_unavailable", http.StatusForbidden)
	}
	token, err := model.GetTokenById(task.PrivateData.TokenId)
	if err != nil || token == nil || token.UserId != task.UserId ||
		token.Status != common.TokenStatusEnabled ||
		(token.ExpiredTime >= 0 && token.ExpiredTime < common.GetTimestamp()) {
		if err == nil {
			err = errors.New("deferred task token is unavailable")
		}
		return nil, service.TaskErrorWrapperLocal(err, "token_unavailable", http.StatusForbidden)
	}
	channel, err := model.CacheGetChannel(task.ChannelId)
	if err != nil || channel == nil {
		if err == nil {
			err = errors.New("deferred task channel is missing")
		}
		return nil, service.TaskErrorWrapperLocal(err, "channel_not_found", http.StatusBadRequest)
	}
	if channel.Status != common.ChannelStatusEnabled {
		return nil, service.TaskErrorWrapperLocal(
			errors.New("deferred task channel is disabled"),
			"channel_disabled",
			http.StatusBadRequest,
		)
	}

	generation := pluginruntime.DefaultRegistry.Generation()
	plugin, found := relay.ResolveTaskPluginForPlatform(generation, task.Platform)
	if !found || plugin == nil {
		return nil, service.TaskErrorWrapperLocal(
			errors.New("deferred task plugin is unavailable"),
			"task_plugin_disabled",
			http.StatusServiceUnavailable,
		)
	}
	if snapshot := task.PrivateData.Execution; snapshot != nil && snapshot.TaskPlugin != nil &&
		snapshot.TaskPlugin.Key != plugin.Meta.Key {
		return nil, service.TaskErrorWrapperLocal(
			errors.New("deferred task plugin identity changed"),
			"task_plugin_mismatch",
			http.StatusConflict,
		)
	}

	request, routeRequest, requestBody, buildErr := deferredTaskRequestContext(ctx, task.PrivateData.DeferredRequest)
	if buildErr != nil {
		return nil, service.TaskErrorWrapperLocal(buildErr, "deferred_request_invalid", http.StatusBadRequest)
	}
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = request
	c.Set(pluginruntime.ContextKeyPinnedPlugin, pluginruntime.PinnedPlugin{Generation: generation, Plugin: plugin})
	c.Set(pluginruntime.ContextKeyRouteRequest, routeRequest)
	c.Set(pluginruntime.ContextKeyExecutionMode, pluginruntime.ExecutionModeUpstreamTask)
	c.Set("task_request", requestBody)
	c.Set("task_action", task.Action)
	c.Set("task_plugin_key", plugin.Meta.Key)
	c.Set("expected_task_plugin_key", plugin.Meta.Key)
	c.Set("platform", plugin.Meta.Key)
	common.SetContextKey(c, constant.ContextKeyUserId, task.UserId)
	common.SetContextKey(c, constant.ContextKeyUsingGroup, task.Group)
	common.SetContextKey(c, constant.ContextKeyUserGroup, task.Group)
	common.SetContextKey(c, constant.ContextKeyTokenGroup, task.Group)
	if setupErr := middleware.SetupContextForSelectedChannel(c, channel, task.Properties.OriginModelName); setupErr != nil {
		return nil, service.TaskErrorFromAPIError(setupErr)
	}

	userSetting := user.GetSetting()
	priceData := deferredTaskPriceData(task)
	info := &relaycommon.RelayInfo{
		UserId:                  task.UserId,
		UsingGroup:              task.Group,
		UserGroup:               task.Group,
		TokenGroup:              task.Group,
		StartTime:               time.Now(),
		RelayMode:               relayconstant.RelayModeVideoSubmit,
		OriginModelName:         task.Properties.OriginModelName,
		ActualUpstreamModelName: task.Properties.UpstreamModelName,
		UserSetting:             userSetting,
		PriceData:               priceData,
		TieredBillingSnapshot:   deferredTieredSnapshot(task),
		TaskRelayInfo: &relaycommon.TaskRelayInfo{
			Action:        task.Action,
			OriginTaskID:  task.PrivateData.DeferredRequest.OriginTaskID,
			PublicTaskID:  task.TaskID,
			OriginTasks:   append([]relaycommon.OriginTaskRef(nil), task.PrivateData.DeferredRequest.OriginTasks...),
			LockedChannel: channel,
		},
	}
	info.InitChannelMeta(c)
	info.UpstreamModelName = task.Properties.UpstreamModelName
	if submit == nil {
		submit = relay.RelayDeferredTaskSubmit
	}
	return submit(c, info, task.Platform, task.Quota, func() error {
		if err := c.Request.Context().Err(); err != nil {
			return err
		}
		fenced, fenceErr := model.FenceDeferredTaskProviderSubmit(
			task,
			task.DispatchOwner,
			common.GetTimestamp(),
		)
		if fenceErr != nil {
			return fenceErr
		}
		if !fenced {
			return errors.New("deferred dispatch lease lost before provider submit")
		}
		return nil
	})
}

func deferredTaskRequestContext(
	ctx context.Context,
	snapshot *model.TaskDeferredRequest,
) (*http.Request, pluginruntime.RouteRequestContext, any, error) {
	if snapshot == nil || len(snapshot.RequestBody) == 0 {
		return nil, pluginruntime.RouteRequestContext{}, nil, errors.New("deferred request body is missing")
	}
	var requestBody any
	if err := common.Unmarshal(snapshot.RequestBody, &requestBody); err != nil {
		return nil, pluginruntime.RouteRequestContext{}, nil, fmt.Errorf("decode deferred request body: %w", err)
	}
	var routeBody any
	if len(snapshot.RouteBody) > 0 {
		if err := common.Unmarshal(snapshot.RouteBody, &routeBody); err != nil {
			return nil, pluginruntime.RouteRequestContext{}, nil, fmt.Errorf("decode deferred route body: %w", err)
		}
	}
	path := strings.TrimSpace(snapshot.Path)
	if path == "" {
		path = "/"
	}
	method := strings.ToUpper(strings.TrimSpace(snapshot.Method))
	if method == "" {
		method = http.MethodPost
	}
	request, err := http.NewRequestWithContext(ctx, method, path, bytes.NewReader(snapshot.RouteBody))
	if err != nil {
		return nil, pluginruntime.RouteRequestContext{}, nil, err
	}
	for name, value := range snapshot.Headers {
		request.Header.Set(name, value)
	}
	return request, pluginruntime.RouteRequestContext{
		Path:        path,
		Method:      method,
		Params:      cloneDeferredParams(snapshot.Params),
		Query:       cloneDeferredQuery(snapshot.Query),
		Body:        routeBody,
		RequestBody: requestBody,
	}, requestBody, nil
}

func cloneDeferredParams(values map[string]string) map[string]string {
	cloned := make(map[string]string, len(values))
	for key, value := range values {
		cloned[key] = value
	}
	return cloned
}

func cloneDeferredQuery(values map[string][]string) map[string][]string {
	cloned := make(map[string][]string, len(values))
	for key, items := range values {
		cloned[key] = append([]string(nil), items...)
	}
	return cloned
}

func deferredTaskPriceData(task *model.Task) types.PriceData {
	priceData := types.PriceData{Quota: task.Quota, QuotaToPreConsume: task.Quota}
	if billing := task.PrivateData.BillingContext; billing != nil {
		priceData.ModelPrice = billing.ModelPrice
		priceData.ModelRatio = billing.ModelRatio
		priceData.GroupRatioInfo.GroupRatio = billing.GroupRatio
		priceData.UsePrice = billing.PerCallBilling
		priceData.ReplaceOtherRatios(billing.OtherRatios)
	}
	return priceData
}

func deferredTieredSnapshot(task *model.Task) *billingexpr.BillingSnapshot {
	if task == nil || task.PrivateData.BillingContext == nil {
		return nil
	}
	return task.PrivateData.BillingContext.TieredSnapshot
}

func applyDeferredTaskResult(task *model.Task, result *relay.TaskSubmitResult) {
	task.PrivateData.UpstreamTaskID = result.UpstreamTaskID
	task.PrivateData.DeferredRequest = nil
	if len(result.PluginState) > 0 {
		task.PrivateData.PluginState = result.PluginState
	}
	task.Data = result.TaskData
	task.Status = model.TaskStatusSubmitted
	task.Progress = taskcommon.ProgressSubmitted
	if task.StartTime == 0 {
		task.StartTime = common.GetTimestamp()
	}
	if immediate := result.Immediate; immediate != nil {
		task.Status = model.TaskStatus(immediate.Status)
		task.Progress = immediate.Progress
		if task.Progress == "" {
			task.Progress = taskcommon.ProgressSubmitted
		}
		if task.Status == model.TaskStatusSuccess || task.Status == model.TaskStatusFailure {
			task.Progress = taskcommon.ProgressComplete
			task.FinishTime = common.GetTimestamp()
		}
		if task.Status == model.TaskStatusFailure {
			task.FailReason = immediate.Reason
		}
		if immediate.Url != "" {
			task.PrivateData.ResultURL = immediate.Url
		} else if task.Status == model.TaskStatusSuccess {
			task.PrivateData.ResultURL = taskcommon.BuildProxyURL(task.TaskID)
		}
	}
}

func deferredTaskErrorRetryable(taskErr *taskdto.TaskError) bool {
	if taskErr == nil || taskErr.NoRetry {
		return false
	}
	return taskErr.StatusCode == http.StatusRequestTimeout ||
		taskErr.StatusCode == http.StatusTooManyRequests ||
		taskErr.StatusCode >= http.StatusInternalServerError
}

func deferredTaskErrorSafeBeforeProviderIO(taskErr *taskdto.TaskError) bool {
	if taskErr == nil || !taskErr.LocalError {
		return false
	}
	return taskErr.Code == "deferred_dispatch_cancelled" ||
		taskErr.Code == "deferred_provider_request_not_started"
}

func deferredTaskFailureReason(taskErr *taskdto.TaskError) string {
	if taskErr == nil {
		return "deferred task submission failed"
	}
	reason := strings.TrimSpace(taskErr.Message)
	if reason == "" {
		reason = strings.TrimSpace(taskErr.Code)
	}
	if reason == "" {
		reason = "deferred task submission failed"
	}
	const maxReasonBytes = 2000
	if len(reason) > maxReasonBytes {
		reason = reason[:maxReasonBytes]
	}
	return reason
}
