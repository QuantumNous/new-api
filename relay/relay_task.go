package relay

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relay/helper"
	relaytypes "github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

type TaskSubmitResult struct {
	AppExecution    *model.AppTaskExecution
	UpstreamTaskID  string
	TaskData        []byte
	ClientResponse  any
	Platform        constant.TaskPlatform
	Quota           int
	Immediate       *relaycommon.TaskInfo
	DeferredRequest *model.TaskDeferredRequest
	PluginState     []byte
	// ProviderAccepted prevents callers from retrying failures after a 2xx submit.
	ProviderAccepted bool
	//PerCallPrice   types.PriceData
}

var errTaskUpstreamEmptyResponse = errors.New("upstream returned an empty response")

// ResolveOriginTask 处理基于已有任务的提交（remix / continuation）：
// 查找原始任务、从中提取模型名称、将渠道锁定到原始任务的渠道
// （通过 info.LockedChannel，重试时复用同一渠道并轮换 key），
// 以及提取 OtherRatios（时长、分辨率）。
// 该函数在控制器的重试循环之前调用一次，其结果通过 info 字段和上下文持久化。
func ResolveOriginTask(c *gin.Context, info *relaycommon.RelayInfo) *dto.TaskError {
	// 检测 remix action
	path := c.Request.URL.Path
	if strings.Contains(path, "/v1/videos/") && strings.HasSuffix(path, "/remix") {
		info.Action = constant.TaskActionRemix
	}

	// 提取 remix 任务的 video_id
	if info.Action == constant.TaskActionRemix {
		videoID := c.Param("video_id")
		if strings.TrimSpace(videoID) == "" {
			return service.TaskErrorWrapperLocal(fmt.Errorf("video_id is required"), "invalid_request", http.StatusBadRequest)
		}
		info.OriginTaskID = videoID
	}

	if info.OriginTaskID == "" {
		return nil
	}

	// 查找原始任务
	originTask, exist, err := model.GetByTaskId(info.UserId, info.OriginTaskID)
	if err != nil {
		return service.TaskErrorWrapper(err, "get_origin_task_failed", http.StatusInternalServerError)
	}
	if !exist {
		return service.TaskErrorWrapperLocal(errors.New("task_origin_not_exist"), "task_not_exist", http.StatusBadRequest)
	}

	// 从原始任务推导模型名称
	if info.OriginModelName == "" {
		if originTask.Properties.OriginModelName != "" {
			info.OriginModelName = originTask.Properties.OriginModelName
		} else if originTask.Properties.UpstreamModelName != "" {
			info.OriginModelName = originTask.Properties.UpstreamModelName
		} else {
			var taskData map[string]any
			_ = common.Unmarshal(originTask.Data, &taskData)
			if m, ok := taskData["model"].(string); ok && m != "" {
				info.OriginModelName = m
			}
		}
	}

	// 锁定到原始任务的渠道（重试时复用同一渠道，轮换 key）
	ch, err := model.GetChannelById(originTask.ChannelId, true)
	if err != nil {
		return service.TaskErrorWrapperLocal(err, "channel_not_found", http.StatusBadRequest)
	}
	if ch.Status != common.ChannelStatusEnabled {
		return service.TaskErrorWrapperLocal(errors.New("the channel of the origin task is disabled"), "task_channel_disable", http.StatusBadRequest)
	}
	info.LockedChannel = ch

	if originTask.ChannelId != info.ChannelId {
		key, _, newAPIError := ch.GetNextEnabledKey()
		if newAPIError != nil {
			return service.TaskErrorWrapper(newAPIError, "channel_no_available_key", newAPIError.StatusCode)
		}
		common.SetContextKey(c, constant.ContextKeyChannelKey, key)
		common.SetContextKey(c, constant.ContextKeyChannelType, ch.Type)
		common.SetContextKey(c, constant.ContextKeyChannelBaseUrl, ch.GetBaseURL())
		common.SetContextKey(c, constant.ContextKeyChannelId, originTask.ChannelId)

		info.ChannelBaseUrl = ch.GetBaseURL()
		info.ChannelId = originTask.ChannelId
		info.ChannelType = ch.Type
		info.ApiKey = key
	}

	// 提取 remix 参数（时长、分辨率 → OtherRatios）
	if info.Action == constant.TaskActionRemix {
		if originTask.PrivateData.BillingContext != nil {
			// 新的 remix 逻辑：直接从原始任务的 BillingContext 中提取 OtherRatios（如果存在）
			for s, f := range originTask.PrivateData.BillingContext.OtherRatios {
				info.PriceData.AddOtherRatio(s, f)
			}
		} else {
			// 旧的 remix 逻辑：直接从 task data 解析 seconds 和 size（如果存在）
			var taskData map[string]any
			_ = common.Unmarshal(originTask.Data, &taskData)
			secondsStr, _ := taskData["seconds"].(string)
			seconds, _ := strconv.Atoi(secondsStr)
			if seconds <= 0 {
				seconds = 4
			}
			// 历史任务数据可能包含未经校验的时长，作为计费乘数前必须钳制
			if seconds > relaycommon.MaxTaskDurationSeconds {
				seconds = relaycommon.MaxTaskDurationSeconds
			}
			sizeStr, _ := taskData["size"].(string)
			info.PriceData.AddOtherRatio("seconds", float64(seconds))
			info.PriceData.AddOtherRatio("size", 1)
			if sizeStr == "1792x1024" || sizeStr == "1024x1792" {
				info.PriceData.AddOtherRatio("size", 1.666667)
			}
		}
	}

	return nil
}

// ApplyChannelPin copies plugin-declared origin-task facts from the prepare
// context onto RelayInfo and, when the resolved pin retries on the same
// channel, writes LockedChannel. ResolveOriginTask is unchanged.
func ApplyChannelPin(c *gin.Context, info *relaycommon.RelayInfo) *dto.TaskError {
	if info == nil {
		return nil
	}
	if info.TaskRelayInfo == nil {
		info.TaskRelayInfo = &relaycommon.TaskRelayInfo{}
	}
	if tasks, ok := common.GetContextKeyType[[]*model.Task](c, constant.ContextKeyOriginTasks); ok {
		refs := make([]relaycommon.OriginTaskRef, 0, len(tasks))
		for _, task := range tasks {
			if task == nil {
				continue
			}
			refs = append(refs, relaycommon.OriginTaskRef{
				TaskID:         task.TaskID,
				UpstreamTaskID: task.GetUpstreamTaskID(),
				Action:         task.Action,
				Status:         string(task.Status),
				Data:           append([]byte(nil), task.Data...),
			})
		}
		info.OriginTasks = refs
	}
	pin, found, _ := service.GetChannelConstraints(c).ResolvedPin()
	if !found || pin.RetryMode != dto.PinRetrySameChannel {
		return nil
	}
	ch, err := model.CacheGetChannel(pin.ChannelId)
	if err != nil {
		return service.TaskErrorWrapperLocal(err, "origin_task_channel_disabled", http.StatusBadRequest)
	}
	if ch.Status != common.ChannelStatusEnabled {
		return service.TaskErrorWrapperLocal(errors.New("the channel of the origin task is disabled"), "origin_task_channel_disabled", http.StatusBadRequest)
	}
	info.LockedChannel = ch
	return nil
}

// ApplyOriginTaskAffinity is the compatibility name for ApplyChannelPin.
func ApplyOriginTaskAffinity(c *gin.Context, info *relaycommon.RelayInfo) *dto.TaskError {
	return ApplyChannelPin(c, info)
}

// RelayTaskSubmit 完成 task 提交的全部流程（每次尝试调用一次）：
// 刷新渠道元数据 → 确定 platform/adaptor → 验证请求 →
// 估算计费(EstimateBilling) → 计算价格 → 预扣费（仅首次）→
// 构建/发送/解析上游请求 → 提交后计费调整(AdjustBillingOnSubmit)。
// 共享控制器编排负责未落库退款、最终额度预留、落库和结算。
func RelayTaskSubmit(c *gin.Context, info *relaycommon.RelayInfo) (*TaskSubmitResult, *dto.TaskError) {
	info.InitChannelMeta(c)

	// 1. 确定 platform → 创建适配器 → 验证请求
	platform := constant.TaskPlatform(c.GetString("platform"))
	if platform == "" {
		platform = GetTaskPlatform(c)
	}
	platform, adaptor := getTaskAdaptorForRequest(c, platform)
	if adaptor == nil {
		code, message := TaskPlatformUnavailableError(platform)
		return nil, service.TaskErrorWrapperLocal(errors.New(message), code, http.StatusBadRequest)
	}
	// buildSubmitRequest runs during validation and the unreleased plugin
	// contract exposes this host-generated id to that hook.
	if info.PublicTaskID == "" {
		info.PublicTaskID = model.GenerateTaskID()
	}
	adaptor.Init(info)
	// Plugin submit hooks run during ValidateRequestAndSetAction and cache the
	// upstream body. OriginModelName is already seeded on that line (protocol
	// resolved_task_model, legacy submit, or GenRelayInfo original_model), so
	// map before validation. The empty-name CoverTaskActionToModelName
	// synthesis happens after validate and cannot move; skip the late block
	// when early mapping ran so a chain is never applied twice.
	mappedBeforeValidate := info.OriginModelName != ""
	if mappedBeforeValidate {
		info.UpstreamModelName = info.OriginModelName
		if err := helper.ModelMappedHelper(c, info, nil); err != nil {
			return nil, service.TaskErrorWrapperLocal(err, "model_mapping_failed", http.StatusBadRequest)
		}
	}
	if taskErr := adaptor.ValidateRequestAndSetAction(c, info); taskErr != nil {
		return nil, taskErr
	}

	// 2. 确定模型名称
	modelName := info.OriginModelName
	if modelName == "" {
		modelName = service.CoverTaskActionToModelName(platform, info.Action)
	}

	if !mappedBeforeValidate {
		info.OriginModelName = modelName
		info.UpstreamModelName = modelName
		if err := helper.ModelMappedHelper(c, info, nil); err != nil {
			return nil, service.TaskErrorWrapperLocal(err, "model_mapping_failed", http.StatusBadRequest)
		}
	}
	if info.AppSubject != nil {
		return submitAppTask(c, info, adaptor, platform)
	}

	// 4. 价格计算：基础模型价格
	info.OriginModelName = modelName
	var priceData types.PriceData
	var err error
	pluginKey := c.GetString("task_plugin_key")
	pinnedValue, _ := c.Get(jsplugin.ContextKeyPinnedPlugin)
	pinnedPlugin, _ := pinnedValue.(jsplugin.PinnedPlugin)
	if pinnedPlugin.Plugin != nil {
		pluginKey = pinnedPlugin.Plugin.Meta.Key
	}
	billingMappedModel := info.UpstreamModelName
	if pinnedPlugin.Generation != nil {
		if canonical, ok := pinnedPlugin.Generation.CanonicalModel(billingMappedModel); ok {
			billingMappedModel = canonical
		}
	}
	billingDecision := billing_setting.ResolveTaskBillingDecision(pluginKey, modelName, billingMappedModel)
	exprStr := billingDecision.Expression
	if billingDecision.Mode == billing_setting.BillingModeTieredExpr {
		provider, supported := adaptor.(channel.TaskUsageFactsProvider)
		if billingexpr.UsesFixedPricing(exprStr) {
			return nil, service.TaskErrorWrapper(fmt.Errorf("fixed pricing is not supported for task usage expressions"), "model_price_error", http.StatusBadRequest)
		}
		if !billingDecision.ExpressionExists || !supported {
			return nil, service.TaskErrorWrapper(fmt.Errorf("task model %s has no usage expression or meter", modelName), "model_price_error", http.StatusBadRequest)
		}
		sharedModel := pinnedPlugin.Generation.SharedModel(modelName) || pinnedPlugin.Generation.SharedModel(billingMappedModel)
		if sharedModel && pinnedPlugin.Plugin != nil {
			schema, _ := pinnedPlugin.Plugin.Meta.UsageForModels(billingMappedModel, modelName)
			if !billing_setting.TaskExprCompatible(exprStr, schema) {
				return nil, service.TaskErrorWrapper(fmt.Errorf("task model %s pricing is not configured for plugin %s", modelName, pluginKey), "model_price_error", http.StatusBadRequest)
			}
		}
		var facts map[string]any
		if validatedProvider, ok := adaptor.(channel.TaskValidatedUsageFactsProvider); ok {
			facts, err = validatedProvider.ExtractUsageFactsValidated(c, info)
			if err != nil {
				return nil, service.TaskErrorWrapperLocal(err, "plugin_usage_invalid", http.StatusBadRequest)
			}
		} else {
			facts = provider.ExtractUsageFacts(c, info)
		}
		pricingTimeUnix := common.GetTimestamp()
		if !info.StartTime.IsZero() {
			pricingTimeUnix = info.StartTime.Unix()
		}
		cost, trace, runErr := billingexpr.RunExprWithRequest(exprStr, billingexpr.TokenParams{}, billingexpr.RequestInput{
			Usage:           facts,
			EvaluatedAtUnix: pricingTimeUnix,
		})
		if runErr != nil || cost < 0 {
			if runErr == nil {
				runErr = fmt.Errorf("negative task expression result")
			}
			return nil, service.TaskErrorWrapper(runErr, "model_price_error", http.StatusBadRequest)
		}
		groupRatioInfo := helper.HandleGroupRatio(c, info)
		quota, clamp := common.QuotaRoundChecked(cost * common.QuotaPerUnit * groupRatioInfo.GroupRatio)
		noteTaskQuotaClamp(info, clamp)
		priceData = types.PriceData{Quota: quota, QuotaToPreConsume: quota, GroupRatioInfo: groupRatioInfo}
		info.TieredBillingSnapshot = &billingexpr.BillingSnapshot{BillingMode: billing_setting.BillingModeTieredExpr, ModelName: modelName, ExprString: exprStr, ExprHash: billingexpr.ExprHashString(exprStr), GroupRatio: groupRatioInfo.GroupRatio, EstimatedQuotaBeforeGroup: cost * common.QuotaPerUnit, EstimatedQuotaAfterGroup: quota, EstimatedTier: trace.MatchedTier, QuotaPerUnit: common.QuotaPerUnit, ExprVersion: billingexpr.ExprVersion(exprStr), PricingTimeUnix: pricingTimeUnix, TaskUsageBilling: true, UsageFacts: facts}
	} else {
		priceData, err = helper.ModelPriceHelperPerCall(c, info)
		if err != nil {
			return nil, service.TaskErrorWrapper(err, "model_price_error", http.StatusBadRequest)
		}
	}
	info.PriceData = priceData

	// 5. 计费估算：让适配器根据用户请求提供 OtherRatios（时长、分辨率等）
	//    必须在 ModelPriceHelperPerCall 之后调用（它会重建 PriceData）。
	//    ResolveOriginTask 可能已在 remix 路径中预设了 OtherRatios，此处合并。
	if info.TieredBillingSnapshot == nil {
		var estimatedRatios map[string]float64
		if validatedProvider, ok := adaptor.(channel.TaskValidatedBillingProvider); ok {
			estimatedRatios, err = validatedProvider.EstimateBillingValidated(c, info)
			if err != nil {
				return nil, service.TaskErrorWrapperLocal(err, "plugin_usage_invalid", http.StatusBadRequest)
			}
		} else {
			estimatedRatios = adaptor.EstimateBilling(c, info)
		}
		if len(estimatedRatios) > 0 {
			for k, v := range estimatedRatios {
				info.PriceData.AddOtherRatio(k, v)
			}
		}
	}

	// 6. 将 OtherRatios 应用到基础额度（饱和转换，防止溢出成负数）
	if info.TieredBillingSnapshot == nil && !common.StringsContains(constant.TaskPricePatches, modelName) {
		quotaWithRatios := info.PriceData.ApplyOtherRatiosToFloat(float64(info.PriceData.Quota))
		quota, clamp := common.QuotaFromFloatChecked(quotaWithRatios)
		info.PriceData.Quota = quota
		noteTaskQuotaClamp(info, clamp)
	}

	// 7. 预扣费（仅首次 — 重试时 info.Billing 已存在，跳过）
	if info.Billing == nil && !info.PriceData.FreeModel {
		info.ForcePreConsume = true
		if apiErr := service.PreConsumeBilling(c, info.PriceData.Quota, info); apiErr != nil {
			return nil, service.TaskErrorFromAPIError(apiErr)
		}
	}

	// 8. 构建请求体
	requestBody, err := adaptor.BuildRequestBody(c, info)
	if err != nil {
		return nil, service.TaskErrorWrapper(err, "build_request_failed", http.StatusInternalServerError)
	}
	if c.GetString(jsplugin.ContextKeyExecutionMode) == jsplugin.ExecutionModeDeferred {
		deferredRequest, captureErr := captureDeferredTaskRequest(c, info)
		if captureErr != nil {
			return nil, service.TaskErrorWrapperLocal(captureErr, "deferred_request_invalid", http.StatusBadRequest)
		}
		return &TaskSubmitResult{
			Platform:        platform,
			Quota:           info.PriceData.Quota,
			DeferredRequest: deferredRequest,
		}, nil
	}

	return submitTaskUpstream(c, info, adaptor, platform, requestBody, info.PriceData.Quota)
}

// RelayDeferredTaskSubmit rebuilds a previously validated plugin request with
// current channel credentials. Billing and task creation are intentionally
// excluded. beforeProviderSubmit persists the worker's final dispatch fence
// after local request preparation and immediately before provider I/O.
func RelayDeferredTaskSubmit(
	c *gin.Context,
	info *relaycommon.RelayInfo,
	platform constant.TaskPlatform,
	quota int,
	beforeProviderSubmit func() error,
) (*TaskSubmitResult, *dto.TaskError) {
	info.InitChannelMeta(c)
	resolvedPlatform, adaptor := getTaskAdaptorForRequest(c, platform)
	if adaptor == nil {
		code, message := TaskPlatformUnavailableError(platform)
		return nil, service.TaskErrorWrapperLocal(errors.New(message), code, http.StatusBadRequest)
	}
	adaptor.Init(info)
	if taskErr := adaptor.ValidateRequestAndSetAction(c, info); taskErr != nil {
		return nil, taskErr
	}
	requestBody, err := adaptor.BuildRequestBody(c, info)
	if err != nil {
		return nil, service.TaskErrorWrapper(err, "build_request_failed", http.StatusInternalServerError)
	}
	return submitDeferredTaskUpstream(c, info, adaptor, resolvedPlatform, requestBody, quota, beforeProviderSubmit)
}

func submitDeferredTaskUpstream(
	c *gin.Context,
	info *relaycommon.RelayInfo,
	adaptor channel.TaskAdaptor,
	platform constant.TaskPlatform,
	requestBody io.Reader,
	quota int,
	beforeProviderSubmit func() error,
) (*TaskSubmitResult, *dto.TaskError) {
	if beforeProviderSubmit == nil {
		return nil, service.TaskErrorWrapperLocal(errors.New("deferred dispatch fence is missing"), "deferred_dispatch_fence_failed", http.StatusInternalServerError)
	}
	if err := beforeProviderSubmit(); err != nil {
		if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
			return nil, service.TaskErrorWrapperLocal(err, "deferred_dispatch_cancelled", http.StatusRequestTimeout)
		}
		return nil, service.TaskErrorWrapperLocal(err, "deferred_dispatch_fence_failed", http.StatusInternalServerError)
	}
	if err := c.Request.Context().Err(); err != nil {
		return nil, service.TaskErrorWrapperLocal(err, "deferred_dispatch_cancelled", http.StatusRequestTimeout)
	}
	result, taskErr := submitTaskUpstream(c, info, adaptor, platform, requestBody, quota)
	if taskErr != nil {
		if errors.Is(taskErr.Error, channel.ErrProviderRequestNotStarted) {
			taskErr.Code = "deferred_provider_request_not_started"
			taskErr.LocalError = true
			taskErr.NoRetry = false
			return result, taskErr
		}
		var relayErr *relaytypes.NewAPIError
		if errors.Is(taskErr.Error, errTaskUpstreamEmptyResponse) ||
			(errors.As(taskErr.Error, &relayErr) && relayErr.GetErrorCode() == relaytypes.ErrorCodeDoRequestFailed) {
			taskErr.NoRetry = true
		}
	}
	return result, taskErr
}

func submitTaskUpstream(
	c *gin.Context,
	info *relaycommon.RelayInfo,
	adaptor channel.TaskAdaptor,
	platform constant.TaskPlatform,
	requestBody io.Reader,
	quota int,
) (*TaskSubmitResult, *dto.TaskError) {
	resp, err := adaptor.DoRequest(c, info, requestBody)
	if err != nil {
		taskErr := service.TaskErrorWrapper(err, "do_request_failed", http.StatusInternalServerError)
		if !errors.Is(err, channel.ErrProviderRequestNotStarted) {
			taskErr.NoRetry = true
			taskErr.ProviderWriteUncertain = true
		}
		return nil, taskErr
	}
	if resp == nil {
		return nil, service.TaskErrorWrapperLocal(errTaskUpstreamEmptyResponse, "fail_to_fetch_task", http.StatusBadGateway)
	}
	defer resp.Body.Close()
	// Any 2xx is a successful submission: task APIs commonly answer 201 Created
	// or 202 Accepted, and parseSubmitResponse receives the exact status code.
	if resp.StatusCode/100 != 2 {
		responseBody, _ := io.ReadAll(resp.Body)
		return nil, service.TaskErrorWrapper(fmt.Errorf("%s", string(responseBody)), "fail_to_fetch_task", resp.StatusCode)
	}

	// 10. Parse only. The controller presents the response after the durable
	// task barrier and billing settlement.
	parsed, taskErr := adaptor.ParseResponse(c, resp, info)
	if taskErr != nil {
		taskErr.NoRetry = true
		taskErr.ProviderAccepted = true
		return nil, taskErr
	}
	if parsed == nil {
		taskErr = service.TaskErrorWrapperLocal(errors.New("task adaptor returned an empty response"), "plugin_submit_response_invalid", http.StatusBadGateway)
		taskErr.NoRetry = true
		taskErr.ProviderAccepted = true
		return nil, taskErr
	}

	// 11. 提交后计费调整：让适配器根据上游实际返回调整 OtherRatios
	finalQuota := quota
	if parsed.Immediate != nil && parsed.Immediate.Status == model.TaskStatusFailure {
		finalQuota = 0
	} else if snap := info.TieredBillingSnapshot; snap != nil {
		if parsed.Immediate != nil && parsed.Immediate.Status == model.TaskStatusSuccess && len(parsed.Immediate.UsageFacts) > 0 {
			settlement, facts, err := service.EvaluateTaskCompletionUsage(snap, parsed.Immediate.UsageFacts)
			if err != nil {
				logger.LogWarn(c, fmt.Sprintf("task immediate usage settlement failed; retaining reserved quota: %v", err))
			} else {
				finalQuota = settlement.ActualQuotaAfterGroup
				snap.UsageFacts = facts
				snap.EstimatedTier = settlement.MatchedTier
				noteTaskQuotaClamp(info, settlement.Clamp)
			}
		}
	} else {
		if adjustedRatios := adaptor.AdjustBillingOnSubmit(info, parsed.TaskData); len(adjustedRatios) > 0 {
			if adjustedQuota, ok := recalcQuotaFromRatios(info, adjustedRatios); ok {
				// 基于调整后的 ratios 重新计算 quota
				finalQuota = adjustedQuota
				info.PriceData.ReplaceOtherRatios(adjustedRatios)
				info.PriceData.Quota = finalQuota
			}
		}
	}

	info.PriceData.Quota = finalQuota

	return &TaskSubmitResult{
		UpstreamTaskID:   parsed.UpstreamTaskID,
		TaskData:         parsed.TaskData,
		ClientResponse:   parsed.ClientResponse,
		Platform:         platform,
		Quota:            finalQuota,
		Immediate:        parsed.Immediate,
		PluginState:      parsed.PluginState,
		ProviderAccepted: true,
	}, nil
}

func captureDeferredTaskRequest(c *gin.Context, info *relaycommon.RelayInfo) (*model.TaskDeferredRequest, error) {
	if c == nil || c.Request == nil {
		return nil, errors.New("deferred execution requires an HTTP request")
	}
	if strings.Contains(strings.ToLower(c.GetHeader("Content-Type")), "multipart/form-data") {
		return nil, errors.New("deferred execution does not support multipart request bodies")
	}
	requestValue, exists := c.Get("task_request")
	if !exists {
		return nil, errors.New("deferred execution requires a normalized task request")
	}
	requestBody, err := common.Marshal(requestValue)
	if err != nil {
		return nil, fmt.Errorf("encode deferred task request: %w", err)
	}

	route := jsplugin.RouteRequestContext{
		Path:   c.Request.URL.Path,
		Method: c.Request.Method,
		Params: map[string]string{},
		Query:  c.Request.URL.Query(),
	}
	if value, found := c.Get(jsplugin.ContextKeyRouteRequest); found {
		if prepared, ok := value.(jsplugin.RouteRequestContext); ok {
			route = prepared
		}
	}
	if len(route.Files) > 0 {
		return nil, errors.New("deferred execution does not support uploaded files")
	}
	var routeBody json.RawMessage
	if route.Body != nil {
		encoded, marshalErr := common.Marshal(route.Body)
		if marshalErr != nil {
			return nil, fmt.Errorf("encode deferred route request: %w", marshalErr)
		}
		routeBody = json.RawMessage(encoded)
	}

	headers := map[string]string{}
	for _, name := range []string{"Content-Type", "Accept"} {
		if value := strings.TrimSpace(c.GetHeader(name)); value != "" {
			headers[name] = value
		}
	}
	params := make(map[string]string, len(route.Params))
	for key, value := range route.Params {
		params[key] = value
	}
	query := make(map[string][]string, len(route.Query))
	for key, values := range route.Query {
		query[key] = append([]string(nil), values...)
	}
	originTasks := append([]relaycommon.OriginTaskRef(nil), info.OriginTasks...)
	return &model.TaskDeferredRequest{
		Path:         route.Path,
		Method:       route.Method,
		Params:       params,
		Query:        query,
		Headers:      headers,
		RouteBody:    routeBody,
		RequestBody:  json.RawMessage(requestBody),
		OriginTaskID: info.OriginTaskID,
		OriginTasks:  originTasks,
	}, nil
}

// recalcQuotaFromRatios 根据 adjustedRatios 重新计算 quota。
// 公式: baseQuota × ∏(ratio) — 其中 baseQuota 是不含 OtherRatios 的基础额度。
func recalcQuotaFromRatios(info *relaycommon.RelayInfo, ratios map[string]float64) (int, bool) {
	// 从 PriceData 获取不含 OtherRatios 的基础价格
	baseQuota := info.PriceData.RemoveOtherRatiosFromFloat(float64(info.PriceData.Quota))
	priceData := info.PriceData
	if !priceData.ReplaceOtherRatios(ratios) {
		return 0, false
	}
	// 应用新的 ratios
	result := priceData.ApplyOtherRatiosToFloat(baseQuota)
	quota, clamp := common.QuotaFromFloatChecked(result)
	noteTaskQuotaClamp(info, clamp)
	return quota, true
}

// noteTaskQuotaClamp records the first quota saturation event onto the task's
// RelayInfo so LogTaskConsumption can surface it on the submit log's
// admin_info. First non-nil clamp wins.
func noteTaskQuotaClamp(info *relaycommon.RelayInfo, clamp *common.QuotaClamp) {
	if clamp == nil || info == nil {
		return
	}
	if info.QuotaClamp == nil {
		info.QuotaClamp = clamp
	}
}

var fetchRespBuilders = map[int]func(c *gin.Context) (respBody []byte, taskResp *dto.TaskError){
	relayconstant.RelayModeVideoFetchByID:  videoFetchByIDRespBodyBuilder,
	relayconstant.RelayModeThreeDFetchByID: threeDFetchByIDRespBodyBuilder,
}

func RelayTaskFetch(c *gin.Context, relayMode int) (taskResp *dto.TaskError) {
	respBuilder, ok := fetchRespBuilders[relayMode]
	if !ok {
		return service.TaskErrorWrapperLocal(errors.New("invalid_relay_mode"), "invalid_relay_mode", http.StatusBadRequest)
	}

	respBody, taskErr := respBuilder(c)
	if taskErr != nil {
		return taskErr
	}
	if len(respBody) == 0 {
		respBody = []byte("{\"code\":\"success\",\"data\":null}")
	}

	c.Writer.Header().Set("Content-Type", "application/json")
	_, err := io.Copy(c.Writer, bytes.NewBuffer(respBody))
	if err != nil {
		taskResp = service.TaskErrorWrapper(err, "copy_response_body_failed", http.StatusInternalServerError)
		return
	}
	return
}

func threeDFetchByIDRespBodyBuilder(c *gin.Context) ([]byte, *dto.TaskError) {
	taskID := c.Param("task_id")
	task, exists, err := model.GetByTaskId(c.GetInt("id"), taskID)
	if err != nil {
		return nil, service.TaskErrorWrapper(err, "get_task_failed", http.StatusInternalServerError)
	}
	if !exists {
		return nil, service.TaskErrorWrapperLocal(errors.New("task_not_exist"), "task_not_exist", http.StatusNotFound)
	}
	response := buildThreeDResponse(task, c.GetBool("three_d_native_response"))
	body, err := common.Marshal(response)
	if err != nil {
		return nil, service.TaskErrorWrapper(err, "marshal_response_failed", http.StatusInternalServerError)
	}
	return body, nil
}

func buildThreeDResponse(task *model.Task, native bool) any {
	status := strings.ToLower(string(task.Status))
	switch task.Status {
	case model.TaskStatusNotStart, model.TaskStatusSubmitted, model.TaskStatusQueued:
		status = "queued"
	case model.TaskStatusInProgress:
		status = "running"
	case model.TaskStatusSuccess:
		status = "succeeded"
	case model.TaskStatusFailure:
		status = "failed"
	case model.TaskStatusCancelled:
		status = "cancelled"
	}
	var stored struct {
		Usage *dto.ThreeDUsage `json:"usage"`
		Error *dto.ThreeDError `json:"error"`
	}
	_ = common.Unmarshal(task.Data, &stored)
	response := dto.ThreeDGeneration{
		ID:        task.TaskID,
		Model:     task.Properties.OriginModelName,
		Status:    status,
		FileURL:   task.PrivateData.ResultURL,
		Usage:     stored.Usage,
		Error:     stored.Error,
		CreatedAt: task.CreatedAt,
		UpdatedAt: task.UpdatedAt,
	}
	if response.FileURL != "" {
		response.ExpiresAt = task.UpdatedAt + 24*60*60
	}
	if !native {
		response.Object = "3d.generation"
		return response
	}
	return gin.H{
		"id":         response.ID,
		"model":      response.Model,
		"status":     response.Status,
		"content":    gin.H{"file_url": response.FileURL},
		"usage":      response.Usage,
		"error":      response.Error,
		"created_at": response.CreatedAt,
		"updated_at": response.UpdatedAt,
	}
}

func RelayThreeDCancel(c *gin.Context) *dto.TaskError {
	taskID := c.Param("task_id")
	task, exists, err := model.GetByTaskId(c.GetInt("id"), taskID)
	if err != nil {
		return service.TaskErrorWrapper(err, "get_task_failed", http.StatusInternalServerError)
	}
	if !exists {
		return service.TaskErrorWrapperLocal(errors.New("task_not_exist"), "task_not_exist", http.StatusNotFound)
	}
	switch task.Status {
	case model.TaskStatusNotStart, model.TaskStatusSubmitted, model.TaskStatusQueued:
	default:
		return service.TaskErrorWrapperLocal(
			fmt.Errorf("task status %s cannot be cancelled", task.Status),
			"task_not_cancellable",
			http.StatusConflict,
		)
	}
	channelModel, err := model.GetChannelById(task.ChannelId, true)
	if err != nil {
		return service.TaskErrorWrapper(err, "get_channel_failed", http.StatusInternalServerError)
	}
	adaptor := GetTaskAdaptor(task.Platform)
	canceller, ok := adaptor.(channel.TaskCanceller)
	if !ok {
		return service.TaskErrorWrapperLocal(errors.New("cancel_not_supported"), "cancel_not_supported", http.StatusNotImplemented)
	}
	resp, err := canceller.CancelTask(
		channelModel.GetBaseURL(),
		channelModel.Key,
		task.GetUpstreamTaskID(),
		channelModel.GetSetting().Proxy,
	)
	if err != nil {
		return service.TaskErrorWrapper(err, "cancel_task_failed", http.StatusBadGateway)
	}
	defer service.CloseResponseBodyGracefully(resp)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return service.TaskErrorWrapper(
			fmt.Errorf("upstream cancel failed: %s", body),
			"cancel_task_failed",
			resp.StatusCode,
		)
	}
	oldStatus := task.Status
	task.Status = model.TaskStatusCancelled
	task.Progress = taskcommon.ProgressComplete
	task.FinishTime = common.GetTimestamp()
	task.FailReason = "cancelled"
	won, err := task.UpdateWithStatus(oldStatus)
	if err != nil {
		return service.TaskErrorWrapper(err, "update_task_failed", http.StatusInternalServerError)
	}
	if !won {
		return service.TaskErrorWrapperLocal(errors.New("task status changed"), "task_state_conflict", http.StatusConflict)
	}
	if task.Quota != 0 && !service.RefundTaskQuota(c, task, "3D task cancelled") {
		return service.TaskErrorWrapper(
			errors.New("task cancelled but quota refund failed"),
			"cancel_refund_failed",
			http.StatusInternalServerError,
		)
	}
	response := buildThreeDResponse(task, c.GetBool("three_d_native_response"))
	c.JSON(http.StatusOK, response)
	return nil
}

func videoFetchByIDRespBodyBuilder(c *gin.Context) (respBody []byte, taskResp *dto.TaskError) {
	taskId := c.Param("task_id")
	if taskId == "" {
		taskId = c.GetString("task_id")
	}
	var err error
	var originTask *model.Task
	value, appRequest := c.Get(types.AppTaskRetrievalContextKey)
	appRetrieval, appRequest := value.(*service.AppTaskRetrieval)
	if appRequest {
		if appRetrieval == nil || appRetrieval.Task.TaskID != taskId {
			taskResp = service.TaskErrorWrapperLocal(errors.New("task_not_exist"), "not_found", http.StatusNotFound)
			return
		}
		originTask = &appRetrieval.Task
	} else {
		var exist bool
		originTask, exist, err = model.GetByTaskId(c.GetInt("id"), taskId)
		if err != nil {
			taskResp = service.TaskErrorWrapper(err, "get_task_failed", http.StatusInternalServerError)
			return
		}
		if !exist {
			taskResp = service.TaskErrorWrapperLocal(errors.New("task_not_exist"), "task_not_exist", http.StatusBadRequest)
			return
		}
	}
	if !originTask.ResultRetrievable() {
		taskResp = service.TaskErrorWrapperLocal(errors.New("task_not_exist"), "task_not_exist", http.StatusBadRequest)
		return
	}

	isOpenAIVideoAPI := strings.HasPrefix(c.Request.URL.Path, "/v1/videos/")

	// Gemini/Vertex 支持实时查询：用户 fetch 时直接从上游拉取最新状态
	if !appRequest {
		if realtimeResp := tryRealtimeFetch(originTask, isOpenAIVideoAPI); len(realtimeResp) > 0 {
			respBody = realtimeResp
			return
		}
	}

	// OpenAI Video API 格式: 走各 adaptor 的 ConvertToOpenAIVideo
	if isOpenAIVideoAPI {
		adaptor := GetTaskAdaptor(originTask.Platform)
		if adaptor == nil {
			taskResp = service.TaskErrorWrapperLocal(fmt.Errorf("invalid channel id: %d", originTask.ChannelId), "invalid_channel_id", http.StatusBadRequest)
			return
		}
		if appRequest {
			identity, ok := adaptor.(interface {
				TaskPluginIdentity() (key, version, sourceSHA256 string)
			})
			if !ok {
				taskResp = service.TaskErrorWrapperLocal(errors.New("task plugin identity unavailable"), "service_unavailable", http.StatusServiceUnavailable)
				return
			}
			key, version, digest := identity.TaskPluginIdentity()
			if key != appRetrieval.Execution.PluginKey || version != appRetrieval.Execution.PluginVersion ||
				digest != appRetrieval.Execution.PluginSHA256 {
				taskResp = service.TaskErrorWrapperLocal(errors.New("task plugin identity changed"), "service_unavailable", http.StatusServiceUnavailable)
				return
			}
		}
		if converter, ok := adaptor.(channel.OpenAIVideoConverter); ok {
			openAIVideoData, err := converter.ConvertToOpenAIVideo(originTask)
			if err != nil {
				taskResp = service.TaskErrorWrapper(err, "convert_to_openai_video_failed", http.StatusInternalServerError)
				return
			}
			respBody = openAIVideoData
			return
		}
		taskResp = service.TaskErrorWrapperLocal(fmt.Errorf("not_implemented:%s", originTask.Platform), "not_implemented", http.StatusNotImplemented)
		return
	}

	// 通用 TaskDto 格式
	respBody, err = common.Marshal(dto.TaskResponse[any]{
		Code: "success",
		Data: TaskModel2Dto(originTask),
	})
	if err != nil {
		taskResp = service.TaskErrorWrapper(err, "marshal_response_failed", http.StatusInternalServerError)
	}
	return
}

// tryRealtimeFetch 尝试从上游实时拉取 Gemini/Vertex 任务状态。
// 仅当渠道类型为 Gemini 或 Vertex 时触发；其他渠道或出错时返回 nil。
// 当非 OpenAI Video API 时，还会构建自定义格式的响应体。
func tryRealtimeFetch(task *model.Task, isOpenAIVideoAPI bool) []byte {
	channelModel, err := model.GetChannelById(task.ChannelId, true)
	if err != nil {
		return nil
	}
	if channelModel.Type != constant.ChannelTypeVertexAi && channelModel.Type != constant.ChannelTypeGemini {
		return nil
	}

	baseURL := constant.GetChannelBaseURL(channelModel.Type)
	if channelModel.GetBaseURL() != "" {
		baseURL = channelModel.GetBaseURL()
	}
	proxy := channelModel.GetSetting().Proxy
	adaptor := GetTaskAdaptor(constant.TaskPlatform(strconv.Itoa(channelModel.Type)))
	if adaptor == nil {
		return nil
	}

	resp, err := adaptor.FetchTask(baseURL, channelModel.Key, task, proxy)
	if err != nil || resp == nil {
		return nil
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil
	}

	ti, err := adaptor.ParseTaskResult(task, resp, body)
	if err != nil || ti == nil {
		return nil
	}

	snap := task.Snapshot()

	// 将上游最新状态更新到 task
	if ti.Status != "" {
		task.Status = model.TaskStatus(ti.Status)
	}
	if ti.Progress != "" {
		task.Progress = ti.Progress
	}
	if strings.HasPrefix(ti.Url, "data:") {
		// data: URI — kept in Data, not ResultURL
	} else if ti.Url != "" {
		task.PrivateData.ResultURL = ti.Url
	} else if task.Status == model.TaskStatusSuccess {
		// No URL from adaptor — construct proxy URL using public task ID
		task.PrivateData.ResultURL = taskcommon.BuildProxyURL(task.TaskID)
	}

	if !snap.Equal(task.Snapshot()) {
		_, _ = task.UpdateWithStatus(snap.Status)
	}

	// OpenAI Video API 由调用者的 ConvertToOpenAIVideo 分支处理
	if isOpenAIVideoAPI {
		return nil
	}

	// 非 OpenAI Video API: 构建自定义格式响应
	format := detectVideoFormat(body)
	out := map[string]any{
		"error":    nil,
		"format":   format,
		"metadata": nil,
		"status":   mapTaskStatusToSimple(task.Status),
		"task_id":  task.TaskID,
		"url":      task.GetResultURL(),
	}
	respBody, _ := common.Marshal(dto.TaskResponse[any]{
		Code: "success",
		Data: out,
	})
	return respBody
}

// detectVideoFormat 从 Gemini/Vertex 原始响应中探测视频格式
func detectVideoFormat(rawBody []byte) string {
	var raw map[string]any
	if err := common.Unmarshal(rawBody, &raw); err != nil {
		return "mp4"
	}
	respObj, ok := raw["response"].(map[string]any)
	if !ok {
		return "mp4"
	}
	vids, ok := respObj["videos"].([]any)
	if !ok || len(vids) == 0 {
		return "mp4"
	}
	v0, ok := vids[0].(map[string]any)
	if !ok {
		return "mp4"
	}
	mt, ok := v0["mimeType"].(string)
	if !ok || mt == "" || strings.Contains(mt, "mp4") {
		return "mp4"
	}
	return mt
}

// mapTaskStatusToSimple 将内部 TaskStatus 映射为简化状态字符串
func mapTaskStatusToSimple(status model.TaskStatus) string {
	switch status {
	case model.TaskStatusSuccess:
		return "succeeded"
	case model.TaskStatusFailure:
		return "failed"
	case model.TaskStatusQueued, model.TaskStatusSubmitted:
		return "queued"
	default:
		return "processing"
	}
}

func TaskModel2Dto(task *model.Task) *dto.TaskDto {
	return &dto.TaskDto{
		ID:         task.ID,
		CreatedAt:  task.CreatedAt,
		UpdatedAt:  task.UpdatedAt,
		TaskID:     task.TaskID,
		Platform:   string(task.Platform),
		UserId:     task.UserId,
		Group:      task.Group,
		ChannelId:  task.ChannelId,
		Quota:      task.Quota,
		Action:     constant.NormalizeTaskAction(task.Action),
		Status:     string(task.Status),
		FailReason: task.FailReason,
		ResultURL:  task.GetResultURL(),
		SubmitTime: task.SubmitTime,
		StartTime:  task.StartTime,
		FinishTime: task.FinishTime,
		Progress:   task.Progress,
		Properties: task.Properties,
		Username:   task.Username,
		Data:       task.Data,
	}
}
