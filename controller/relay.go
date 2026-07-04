package controller

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	perfmetrics "github.com/QuantumNous/new-api/pkg/perf_metrics"
	"github.com/QuantumNous/new-api/relay"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	model_setting "github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/types"

	"github.com/bytedance/gopkg/util/gopool"
	"github.com/samber/lo"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

func markOfficialFallbackChannel(c *gin.Context, channel *model.Channel) {
	if c == nil || channel == nil {
		return
	}
	c.Set("official_fallback_triggered", true)
	c.Set("official_fallback_channel_id", channel.Id)
	c.Set("official_fallback_channel_name", channel.Name)
}

func relayHandler(c *gin.Context, info *relaycommon.RelayInfo) *types.NewAPIError {
	var err *types.NewAPIError
	switch info.RelayMode {
	case relayconstant.RelayModeImagesGenerations, relayconstant.RelayModeImagesEdits:
		err = relay.ImageHelper(c, info)
	case relayconstant.RelayModeAudioSpeech:
		fallthrough
	case relayconstant.RelayModeAudioTranslation:
		fallthrough
	case relayconstant.RelayModeAudioTranscription:
		err = relay.AudioHelper(c, info)
	case relayconstant.RelayModeRerank:
		err = relay.RerankHelper(c, info)
	case relayconstant.RelayModeEmbeddings:
		err = relay.EmbeddingHelper(c, info)
	case relayconstant.RelayModeResponses, relayconstant.RelayModeResponsesCompact:
		err = relay.ResponsesHelper(c, info)
	default:
		err = relay.TextHelper(c, info)
	}
	return err
}

func geminiRelayHandler(c *gin.Context, info *relaycommon.RelayInfo) *types.NewAPIError {
	var err *types.NewAPIError
	if strings.Contains(c.Request.URL.Path, "embed") {
		err = relay.GeminiEmbeddingHandler(c, info)
	} else {
		err = relay.GeminiHelper(c, info)
	}
	return err
}

func Relay(c *gin.Context, relayFormat types.RelayFormat) {

	requestId := c.GetString(common.RequestIdKey)
	//group := common.GetContextKeyString(c, constant.ContextKeyUsingGroup)
	//originalModel := common.GetContextKeyString(c, constant.ContextKeyOriginalModel)

	var (
		newAPIError *types.NewAPIError
		relayInfo   *relaycommon.RelayInfo
		ws          *websocket.Conn
	)

	if relayFormat == types.RelayFormatOpenAIRealtime {
		var err error
		ws, err = upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			helper.WssError(c, ws, types.NewError(err, types.ErrorCodeGetChannelFailed, types.ErrOptionWithSkipRetry()).ToOpenAIError())
			return
		}
		defer ws.Close()
	}

	defer func() {
		if newAPIError != nil {
			if relayInfo != nil {
				recordFailedRequestSnapshot(c, relayInfo, relayFormat, newAPIError)
			}
			logger.LogError(c, fmt.Sprintf("relay error: %s", newAPIError.Error()))
			newAPIError.SetMessage(common.MessageWithRequestId(newAPIError.Error(), requestId))
			switch relayFormat {
			case types.RelayFormatOpenAIRealtime:
				helper.WssError(c, ws, newAPIError.ToOpenAIError())
			case types.RelayFormatClaude:
				c.JSON(newAPIError.StatusCode, gin.H{
					"type":  "error",
					"error": newAPIError.ToClaudeError(),
				})
			default:
				c.JSON(newAPIError.StatusCode, gin.H{
					"error": newAPIError.ToOpenAIError(),
				})
			}
		}
	}()

	request, err := helper.GetAndValidateRequest(c, relayFormat)
	if err != nil {
		// Map "request body too large" to 413 so clients can handle it correctly
		if common.IsRequestBodyTooLargeError(err) || errors.Is(err, common.ErrRequestBodyTooLarge) {
			newAPIError = types.NewErrorWithStatusCode(err, types.ErrorCodeReadRequestBodyFailed, http.StatusRequestEntityTooLarge, types.ErrOptionWithSkipRetry())
		} else {
			newAPIError = types.NewError(err, types.ErrorCodeInvalidRequest)
		}
		return
	}

	relayInfo, err = relaycommon.GenRelayInfo(c, relayFormat, request, ws)
	if err != nil {
		newAPIError = types.NewError(err, types.ErrorCodeGenRelayInfoFailed)
		return
	}

	needSensitiveCheck := setting.ShouldCheckPromptSensitive()
	needCountToken := constant.CountToken
	// Avoid building huge CombineText (strings.Join) when token counting and sensitive check are both disabled.
	var meta *types.TokenCountMeta
	if needSensitiveCheck || needCountToken {
		meta = request.GetTokenCountMeta()
	} else {
		meta = fastTokenCountMetaForPricing(request)
	}

	if needSensitiveCheck && meta != nil {
		contains, words := service.CheckSensitiveText(meta.CombineText)
		if contains {
			logger.LogWarn(c, fmt.Sprintf("user sensitive words detected: %s", strings.Join(words, ", ")))
			newAPIError = types.NewError(err, types.ErrorCodeSensitiveWordsDetected)
			return
		}
	}

	tokens, err := service.EstimateRequestToken(c, meta, relayInfo)
	if err != nil {
		newAPIError = types.NewError(err, types.ErrorCodeCountTokenFailed)
		return
	}

	relayInfo.SetEstimatePromptTokens(tokens)

	priceData, err := helper.ModelPriceHelper(c, relayInfo, tokens, meta)
	if err != nil {
		newAPIError = types.NewError(err, types.ErrorCodeModelPriceError, types.ErrOptionWithStatusCode(http.StatusBadRequest))
		return
	}

	// common.SetContextKey(c, constant.ContextKeyTokenCountMeta, meta)

	if priceData.FreeModel {
		logger.LogInfo(c, fmt.Sprintf("模型 %s 免费，跳过预扣费", relayInfo.OriginModelName))
	} else {
		newAPIError = service.PreConsumeBilling(c, priceData.QuotaToPreConsume, relayInfo)
		if newAPIError != nil {
			return
		}
	}

	defer func() {
		// Only return quota if downstream failed and quota was actually pre-consumed
		if newAPIError != nil {
			newAPIError = service.NormalizeViolationFeeError(newAPIError)
			if relayInfo.Billing != nil {
				service.RefundPreConsumeIfSafe(c, relayInfo, newAPIError)
			}
			service.ChargeViolationFeeIfNeeded(c, relayInfo, newAPIError)
		}
	}()

	retryParam := &service.RetryParam{
		Ctx:        c,
		TokenGroup: relayInfo.TokenGroup,
		ModelName:  relayInfo.OriginModelName,
		Retry:      common.GetPointer(0),
	}
	relayInfo.RetryIndex = 0
	relayInfo.LastError = nil

	for ; retryParam.GetRetry() <= common.RetryTimes; retryParam.IncreaseRetry() {
		relayInfo.RetryIndex = retryParam.GetRetry()
		channel, channelErr := getChannel(c, relayInfo, retryParam)
		if channelErr != nil {
			logger.LogError(c, channelErr.Error())
			newAPIError = channelErr
			break
		}

		addUsedChannel(c, channel.Id)
		bodyStorage, bodyErr := common.GetBodyStorage(c)
		if bodyErr != nil {
			// Ensure consistent 413 for oversized bodies even when error occurs later (e.g., retry path)
			if common.IsRequestBodyTooLargeError(bodyErr) || errors.Is(bodyErr, common.ErrRequestBodyTooLarge) {
				newAPIError = types.NewErrorWithStatusCode(bodyErr, types.ErrorCodeReadRequestBodyFailed, http.StatusRequestEntityTooLarge, types.ErrOptionWithSkipRetry())
			} else {
				newAPIError = types.NewErrorWithStatusCode(bodyErr, types.ErrorCodeReadRequestBodyFailed, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
			}
			break
		}
		c.Request.Body = io.NopCloser(bodyStorage)

		switch relayFormat {
		case types.RelayFormatOpenAIRealtime:
			newAPIError = relay.WssHelper(c, relayInfo)
		case types.RelayFormatClaude:
			newAPIError = relay.ClaudeHelper(c, relayInfo)
		case types.RelayFormatGemini:
			newAPIError = geminiRelayHandler(c, relayInfo)
		default:
			newAPIError = relayHandler(c, relayInfo)
		}

		if newAPIError == nil {
			relayInfo.LastError = nil
			service.RecordChannelSuccess(channel.Id)
			notifyOfficialFallbackResult(c, relayInfo, nil)
			service.MaybeEnqueueShadowBenchmark(c, relayInfo, relayFormat, nil)
			return
		}

		newAPIError = service.NormalizeViolationFeeError(newAPIError)
		relayInfo.LastError = newAPIError

		retryDecision := evaluateRetry(c, newAPIError, retryParam.GetRetry(), common.RetryTimes-retryParam.GetRetry())
		setRetryDecision(c, retryDecision)
		processChannelError(c, *types.NewChannelError(channel.Id, channel.Type, channel.Name, channel.ChannelInfo.IsMultiKey, common.GetContextKeyString(c, constant.ContextKeyChannelKey), channel.GetAutoBan()), newAPIError)

		if !retryDecision.ShouldRetry {
			break
		}
	}

	useChannel := c.GetStringSlice("use_channel")
	if len(useChannel) > 1 {
		retryLogStr := fmt.Sprintf("重试：%s", strings.Trim(strings.Join(strings.Fields(fmt.Sprint(useChannel)), "->"), "[]"))
		logger.LogInfo(c, retryLogStr)
	}
	if newAPIError != nil {
		service.MaybeEnqueueShadowBenchmark(c, relayInfo, relayFormat, newAPIError)
		notifyFinalRelayFailure(c, relayInfo, newAPIError)
		gopool.Go(func() {
			perfmetrics.RecordRelaySample(relayInfo, false, 0)
		})
	}
}

func notifyOfficialFallbackResult(c *gin.Context, relayInfo *relaycommon.RelayInfo, finalErr *types.NewAPIError) {
	if c == nil || relayInfo == nil || !c.GetBool("official_fallback_triggered") {
		return
	}
	if c.GetBool("official_fallback_notified") {
		return
	}
	c.Set("official_fallback_notified", true)
	chatID := common.FeishuNewAPILogChatID()
	if chatID == "" {
		return
	}
	requestID := c.GetString(common.RequestIdKey)
	useChannel := strings.Join(c.GetStringSlice("use_channel"), " -> ")
	requestPath := relayInfo.RequestURLPath
	if c.Request != nil && c.Request.URL != nil {
		requestPath = c.Request.URL.Path
	}
	officialChannel := fmt.Sprintf("%d", c.GetInt("official_fallback_channel_id"))
	if name := strings.TrimSpace(c.GetString("official_fallback_channel_name")); name != "" {
		officialChannel = officialChannel + " / " + name
	}
	result := "成功"
	title := "NewAPI 官方兜底成功"
	lines := []string{
		fmt.Sprintf("- request_id：`%s`", requestID),
		fmt.Sprintf("- model：`%s`", relayInfo.OriginModelName),
		fmt.Sprintf("- path：`%s`", requestPath),
		fmt.Sprintf("- 链路：`%s`", useChannel),
		fmt.Sprintf("- 官方兜底渠道：`%s`", officialChannel),
	}
	if finalErr != nil {
		result = "失败"
		title = "NewAPI 官方兜底失败"
		lines = append(lines,
			fmt.Sprintf("- 最终错误：`%s / HTTP %d（%s）`", finalErr.GetErrorCode(), finalErr.StatusCode, finalErr.MaskSensitiveErrorWithStatusCode()),
		)
	}
	lines = append(lines, fmt.Sprintf("- 结果：`%s`", result))
	gopool.Go(func() {
		if err := common.SendFeishuCard(chatID, title, lines); err != nil {
			logger.LogError(context.Background(), fmt.Sprintf("failed to send official fallback feishu notification: %s", err.Error()))
		}
	})
}

func notifyFinalRelayFailure(c *gin.Context, relayInfo *relaycommon.RelayInfo, finalErr *types.NewAPIError) {
	if c == nil || relayInfo == nil || finalErr == nil {
		return
	}
	if c.GetBool("final_failure_notified") {
		return
	}
	c.Set("final_failure_notified", true)
	chatID := common.FeishuNewAPILogChatID()
	if chatID == "" {
		return
	}
	requestID := c.GetString(common.RequestIdKey)
	useChannel := strings.Join(c.GetStringSlice("use_channel"), " -> ")
	if strings.TrimSpace(useChannel) == "" {
		useChannel = "-"
	}
	requestPath := relayInfo.RequestURLPath
	if c.Request != nil && c.Request.URL != nil {
		requestPath = c.Request.URL.Path
	}
	finalChannel := "-"
	if channelID := c.GetInt("channel_id"); channelID > 0 {
		finalChannel = fmt.Sprintf("%d", channelID)
		if channelName := strings.TrimSpace(c.GetString("channel_name")); channelName != "" {
			finalChannel = finalChannel + " / " + channelName
		}
	}
	userEmail := strings.TrimSpace(relayInfo.UserEmail)
	if userEmail == "" {
		userEmail = "-"
	}
	lines := []string{
		fmt.Sprintf("- request_id：`%s`", requestID),
		fmt.Sprintf("- model：`%s`", relayInfo.OriginModelName),
		fmt.Sprintf("- 邮箱：`%s`", userEmail),
		fmt.Sprintf("- path：`%s`", requestPath),
		fmt.Sprintf("- 链路：`%s`", useChannel),
		fmt.Sprintf("- 最终渠道：`%s`", finalChannel),
		fmt.Sprintf("- 最终错误：`%s / HTTP %d（%s）`", finalErr.GetErrorCode(), finalErr.StatusCode, explainRelayFailure(finalErr)),
		fmt.Sprintf("- 错误信息：`%s`", finalErr.MaskSensitiveErrorWithStatusCode()),
	}
	if decision, ok := getRetryDecision(c); ok {
		lines = append(lines, fmt.Sprintf("- retry_decision：`%s`", common.GetJsonString(decision)))
	}
	if c.GetBool("official_fallback_triggered") {
		officialChannel := fmt.Sprintf("%d", c.GetInt("official_fallback_channel_id"))
		if name := strings.TrimSpace(c.GetString("official_fallback_channel_name")); name != "" {
			officialChannel = officialChannel + " / " + name
		}
		lines = append(lines, fmt.Sprintf("- 官方兜底渠道：`%s`", officialChannel))
	}
	gopool.Go(func() {
		if err := common.SendFeishuCard(chatID, "NewAPI 请求最终失败", lines); err != nil {
			logger.LogError(context.Background(), fmt.Sprintf("failed to send final failure feishu notification: %s", err.Error()))
		}
	})
}

func explainRelayFailure(err *types.NewAPIError) string {
	if err == nil {
		return "未知错误"
	}
	switch err.GetErrorCode() {
	case types.ErrorCode("missing_required_parameter"):
		return "请求参数缺失"
	case types.ErrorCodeBadResponse:
		return "上游返回异常内容"
	case types.ErrorCodeBadResponseStatusCode:
		switch err.StatusCode {
		case http.StatusBadGateway:
			return "上游网关错误"
		case http.StatusServiceUnavailable:
			return "上游服务不可用"
		case 524:
			return "上游超时"
		}
	case types.ErrorCodeInsufficientUserQuota:
		return "用户额度不足"
	case types.ErrorCodePreConsumeTokenQuotaFailed:
		return "用户令牌额度不足"
	case types.ErrorCodeGetChannelFailed:
		return "没有可用渠道"
	}
	switch err.StatusCode {
	case http.StatusBadRequest:
		return "上游参数/策略限制"
	case http.StatusTooManyRequests:
		return "上游限流"
	case http.StatusInternalServerError:
		return "上游内部错误"
	case http.StatusBadGateway:
		return "上游网关错误"
	case http.StatusServiceUnavailable:
		return "上游服务不可用"
	case 524:
		return "上游超时"
	}
	return "其他错误"
}

func recordFailedRequestSnapshot(c *gin.Context, relayInfo *relaycommon.RelayInfo, relayFormat types.RelayFormat, newAPIError *types.NewAPIError) {
	if c == nil || relayInfo == nil || newAPIError == nil {
		return
	}
	retryDecisionJSON := ""
	if decision, ok := getRetryDecision(c); ok {
		retryDecisionJSON = common.MapToJsonStr(decision)
	}
	service.SaveFinalFailedRequestSnapshot(c, relayInfo, newAPIError, retryDecisionJSON)
}

var upgrader = websocket.Upgrader{
	Subprotocols: []string{"realtime"}, // WS 握手支持的协议，如果有使用 Sec-WebSocket-Protocol，则必须在此声明对应的 Protocol TODO add other protocol
	CheckOrigin: func(r *http.Request) bool {
		return true // 允许跨域
	},
}

func addUsedChannel(c *gin.Context, channelId int) {
	useChannel := c.GetStringSlice("use_channel")
	useChannel = append(useChannel, fmt.Sprintf("%d", channelId))
	c.Set("use_channel", useChannel)
}

func fastTokenCountMetaForPricing(request dto.Request) *types.TokenCountMeta {
	if request == nil {
		return &types.TokenCountMeta{}
	}
	meta := &types.TokenCountMeta{
		TokenType: types.TokenTypeTokenizer,
	}
	switch r := request.(type) {
	case *dto.GeneralOpenAIRequest:
		maxCompletionTokens := lo.FromPtrOr(r.MaxCompletionTokens, uint(0))
		maxTokens := lo.FromPtrOr(r.MaxTokens, uint(0))
		if maxCompletionTokens > maxTokens {
			meta.MaxTokens = int(maxCompletionTokens)
		} else {
			meta.MaxTokens = int(maxTokens)
		}
	case *dto.OpenAIResponsesRequest:
		meta.MaxTokens = int(lo.FromPtrOr(r.MaxOutputTokens, uint(0)))
	case *dto.ClaudeRequest:
		meta.MaxTokens = int(lo.FromPtr(r.MaxTokens))
	case *dto.ImageRequest:
		// Pricing for image requests depends on ImagePriceRatio; safe to compute even when CountToken is disabled.
		return r.GetTokenCountMeta()
	default:
		// Best-effort: leave CombineText empty to avoid large allocations.
	}
	return meta
}

func getChannel(c *gin.Context, info *relaycommon.RelayInfo, retryParam *service.RetryParam) (*model.Channel, *types.NewAPIError) {
	if info.ChannelMeta == nil {
		autoBan := c.GetBool("auto_ban")
		autoBanInt := 1
		if !autoBan {
			autoBanInt = 0
		}
		return &model.Channel{
			Id:      c.GetInt("channel_id"),
			Type:    c.GetInt("channel_type"),
			Name:    c.GetString("channel_name"),
			AutoBan: &autoBanInt,
		}, nil
	}
	info.PriceData.GroupRatioInfo = helper.HandleGroupRatio(c, info)
	if policy, ok := shouldUseOfficialFallback(c, info, retryParam); ok {
		channel, err := model.GetChannelById(policy.OfficialChannelID, true)
		if err != nil {
			return nil, types.NewError(fmt.Errorf("获取官方兜底渠道 #%d 失败: %s", policy.OfficialChannelID, err.Error()), types.ErrorCodeGetChannelFailed)
		}
		if channel.Status != common.ChannelStatusEnabled {
			return nil, types.NewError(fmt.Errorf("官方兜底渠道 #%d 未启用", policy.OfficialChannelID), types.ErrorCodeGetChannelFailed)
		}
		if !common.StringsContains(channel.GetModels(), info.OriginModelName) {
			return nil, types.NewError(fmt.Errorf("官方兜底渠道 #%d 不支持模型 %s", policy.OfficialChannelID, info.OriginModelName), types.ErrorCodeGetChannelFailed)
		}
		markOfficialFallbackChannel(c, channel)
		newAPIError := middleware.SetupContextForSelectedChannel(c, channel, info.OriginModelName)
		if newAPIError != nil {
			return nil, newAPIError
		}
		return channel, nil
	}
	channel, selectGroup, err := service.CacheGetRandomSatisfiedChannel(retryParam)

	if err != nil {
		return nil, types.NewError(fmt.Errorf("获取分组 %s 下模型 %s 的可用渠道失败（retry）: %s", selectGroup, info.OriginModelName, err.Error()), types.ErrorCodeGetChannelFailed, types.ErrOptionWithSkipRetry())
	}
	if channel == nil {
		return nil, types.NewError(fmt.Errorf("分组 %s 下模型 %s 的可用渠道不存在（retry）", selectGroup, info.OriginModelName), types.ErrorCodeGetChannelFailed, types.ErrOptionWithSkipRetry())
	}

	newAPIError := middleware.SetupContextForSelectedChannel(c, channel, info.OriginModelName)
	if newAPIError != nil {
		return nil, newAPIError
	}
	if policy, ok := model_setting.FindOfficialFallbackPolicy(info.OriginModelName); ok &&
		retryParam.GetRetry() > 0 && channel.Id == policy.OfficialChannelID {
		markOfficialFallbackChannel(c, channel)
	}
	return channel, nil
}

func shouldUseOfficialFallback(c *gin.Context, info *relaycommon.RelayInfo, retryParam *service.RetryParam) (model_setting.OfficialFallbackPolicy, bool) {
	if c == nil || info == nil || retryParam == nil {
		return model_setting.OfficialFallbackPolicy{}, false
	}
	if _, ok := c.Get("specific_channel_id"); ok {
		return model_setting.OfficialFallbackPolicy{}, false
	}
	policy, ok := model_setting.FindOfficialFallbackPolicy(info.OriginModelName)
	if !ok {
		return model_setting.OfficialFallbackPolicy{}, false
	}
	if retryParam.GetRetry() < policy.FallbackAfter+1 {
		return model_setting.OfficialFallbackPolicy{}, false
	}
	for _, channelID := range c.GetStringSlice("use_channel") {
		if channelID == fmt.Sprintf("%d", policy.OfficialChannelID) {
			return model_setting.OfficialFallbackPolicy{}, false
		}
	}
	return policy, true
}

type retryDecision struct {
	ShouldRetry  bool
	Reason       string
	RetryIndex   int
	AttemptIndex int
	RetryTimes   int
	StatusCode   int
	ErrorCode    string
}

func setRetryDecision(c *gin.Context, decision retryDecision) {
	if c == nil {
		return
	}
	c.Set("retry_decision", retryDecisionToMap(decision))
}

func setTaskRetryDecision(c *gin.Context, decision taskRetryDecision) {
	if c == nil {
		return
	}
	c.Set("retry_decision", taskRetryDecisionToMap(decision))
}

func getRetryDecision(c *gin.Context) (map[string]interface{}, bool) {
	if c == nil {
		return nil, false
	}
	value, ok := c.Get("retry_decision")
	if !ok {
		return nil, false
	}
	decision, ok := value.(map[string]interface{})
	return decision, ok
}

func isUserQuotaError(openaiErr *types.NewAPIError) bool {
	if openaiErr == nil {
		return false
	}
	switch openaiErr.GetErrorCode() {
	case types.ErrorCodeInsufficientUserQuota, types.ErrorCodePreConsumeTokenQuotaFailed:
		return true
	}
	return false
}

func evaluateRetry(c *gin.Context, openaiErr *types.NewAPIError, retryIndex int, retryTimes int) retryDecision {
	decision := retryDecision{
		RetryIndex:   retryIndex,
		AttemptIndex: retryIndex + 1,
		RetryTimes:   retryTimes,
	}
	if openaiErr == nil {
		decision.Reason = "nil_error"
		return decision
	}
	decision.StatusCode = openaiErr.StatusCode
	decision.ErrorCode = string(openaiErr.GetErrorCode())
	if service.ShouldSkipRetryAfterChannelAffinityFailure(c) {
		decision.Reason = "channel_affinity_skip_retry"
		return decision
	}
	if isUserQuotaError(openaiErr) {
		decision.Reason = "user_quota_error"
		return decision
	}
	if types.IsSkipRetryError(openaiErr) {
		decision.Reason = "skip_retry_error"
		return decision
	}
	if operation_setting.IsAlwaysSkipRetryCode(openaiErr.GetErrorCode()) {
		decision.Reason = "always_skip_retry_code"
		return decision
	}
	if retryTimes <= 0 {
		decision.Reason = "retry_times_exhausted"
		return decision
	}
	if _, ok := c.Get("specific_channel_id"); ok {
		decision.Reason = "specific_channel_id"
		return decision
	}
	if c.GetBool("official_fallback_triggered") {
		decision.Reason = "official_fallback_exhausted"
		return decision
	}
	if shouldRetryForOfficialFallback(c, retryIndex) {
		decision.ShouldRetry = true
		decision.Reason = "official_fallback_pending"
		return decision
	}
	if shouldRetryForOfficialFallbackModel(c, retryIndex) {
		decision.ShouldRetry = true
		decision.Reason = "official_fallback_model_first_retry"
		return decision
	}
	if types.IsChannelError(openaiErr) {
		decision.ShouldRetry = true
		decision.Reason = "channel_error"
		return decision
	}
	if openaiErr.GetErrorCode() == types.ErrorCodeModelNotFound {
		decision.ShouldRetry = true
		decision.Reason = "model_not_found_channel_side"
		return decision
	}
	code := openaiErr.StatusCode
	if code >= 200 && code < 300 {
		decision.Reason = "success_status_code"
		return decision
	}
	if code < 100 || code > 599 {
		decision.ShouldRetry = true
		decision.Reason = "invalid_status_code_retry"
		return decision
	}
	if operation_setting.ShouldRetryByStatusCode(code) {
		decision.ShouldRetry = true
		decision.Reason = "retryable_status_code"
		return decision
	}
	decision.ShouldRetry = true
	decision.Reason = "default_fallback_all_models"
	return decision
}

func shouldRetryForOfficialFallback(c *gin.Context, retryIndex int) bool {
	if c == nil || c.GetBool("official_fallback_triggered") {
		return false
	}
	policy, ok := model_setting.FindOfficialFallbackPolicy(c.GetString("original_model"))
	if !ok {
		return false
	}
	if retryIndex < policy.FallbackAfter {
		return false
	}
	for _, channelID := range c.GetStringSlice("use_channel") {
		if channelID == fmt.Sprintf("%d", policy.OfficialChannelID) {
			return false
		}
	}
	return true
}

func shouldRetryForOfficialFallbackModel(c *gin.Context, retryIndex int) bool {
	if c == nil || c.GetBool("official_fallback_triggered") {
		return false
	}
	if _, ok := model_setting.FindOfficialFallbackPolicy(c.GetString("original_model")); !ok {
		return false
	}
	if retryIndex != 0 {
		return false
	}
	return true
}

func shouldRetry(c *gin.Context, openaiErr *types.NewAPIError, retryTimes int) bool {
	return evaluateRetry(c, openaiErr, common.RetryTimes-retryTimes, retryTimes).ShouldRetry
}

type taskRetryDecision struct {
	ShouldRetry  bool
	Reason       string
	RetryIndex   int
	AttemptIndex int
	RetryTimes   int
	StatusCode   int
	ErrorCode    string
	ChannelId    int
}

func evaluateTaskRetry(c *gin.Context, channelId int, taskErr *dto.TaskError, retryIndex int, retryTimes int) taskRetryDecision {
	decision := taskRetryDecision{
		RetryIndex:   retryIndex,
		AttemptIndex: retryIndex + 1,
		RetryTimes:   retryTimes,
		ChannelId:    channelId,
	}
	if taskErr == nil {
		decision.Reason = "nil_error"
		return decision
	}
	decision.StatusCode = taskErr.StatusCode
	decision.ErrorCode = taskErr.Code
	if service.ShouldSkipRetryAfterChannelAffinityFailure(c) {
		decision.Reason = "channel_affinity_skip_retry"
		return decision
	}
	if retryTimes <= 0 {
		decision.Reason = "retry_times_exhausted"
		return decision
	}
	if _, ok := c.Get("specific_channel_id"); ok {
		decision.Reason = "specific_channel_id"
		return decision
	}
	if taskErr.StatusCode == http.StatusTooManyRequests {
		decision.ShouldRetry = true
		decision.Reason = "too_many_requests"
		return decision
	}
	if taskErr.StatusCode == 307 {
		decision.ShouldRetry = true
		decision.Reason = "temporary_redirect"
		return decision
	}
	if taskErr.StatusCode/100 == 5 {
		if operation_setting.IsAlwaysSkipRetryStatusCode(taskErr.StatusCode) {
			decision.Reason = "always_skip_retry_status_code"
			return decision
		}
		decision.ShouldRetry = true
		decision.Reason = "server_error_status_code"
		return decision
	}
	if taskErr.StatusCode == http.StatusBadRequest {
		decision.Reason = "bad_request_status_code"
		return decision
	}
	if taskErr.StatusCode == 408 {
		decision.Reason = "request_timeout_status_code"
		return decision
	}
	if taskErr.LocalError {
		decision.Reason = "local_error"
		return decision
	}
	if taskErr.StatusCode/100 == 2 {
		decision.Reason = "success_status_code"
		return decision
	}
	if strings.Contains(taskErr.Code, "RateLimit") {
		decision.ShouldRetry = true
		decision.Reason = "rate_limit_code"
		return decision
	}
	if strings.Contains(taskErr.Message, "RateLimit") {
		decision.ShouldRetry = true
		decision.Reason = "rate_limit_message"
		return decision
	}
	decision.ShouldRetry = true
	decision.Reason = "task_default_retry"
	return decision
}

func shouldRetryTaskRelay(c *gin.Context, channelId int, taskErr *dto.TaskError, retryTimes int) bool {
	return evaluateTaskRetry(c, channelId, taskErr, common.RetryTimes-retryTimes, retryTimes).ShouldRetry
}

func retryDecisionToMap(decision retryDecision) map[string]interface{} {
	return map[string]interface{}{
		"should_retry":          decision.ShouldRetry,
		"reason":                decision.Reason,
		"retry_index":           decision.RetryIndex,
		"attempt_index":         decision.AttemptIndex,
		"remaining_retry_times": decision.RetryTimes,
		"status_code":           decision.StatusCode,
		"error_code":            decision.ErrorCode,
	}
}

func taskRetryDecisionToMap(decision taskRetryDecision) map[string]interface{} {
	return map[string]interface{}{
		"should_retry":          decision.ShouldRetry,
		"reason":                decision.Reason,
		"retry_index":           decision.RetryIndex,
		"attempt_index":         decision.AttemptIndex,
		"remaining_retry_times": decision.RetryTimes,
		"status_code":           decision.StatusCode,
		"error_code":            decision.ErrorCode,
		"channel_id":            decision.ChannelId,
	}
}

func processChannelError(c *gin.Context, channelError types.ChannelError, err *types.NewAPIError) {
	logger.LogError(c, fmt.Sprintf("channel error (channel #%d, status code: %d): %s", channelError.ChannelId, err.StatusCode, err.Error()))
	// 不要使用context获取渠道信息，异步处理时可能会出现渠道信息不一致的情况
	// do not use context to get channel info, there may be inconsistent channel info when processing asynchronously
	action, reason := service.EvaluateChannelHealth(channelError, err)
	if action != service.HealthSkip {
		gopool.Go(func() {
			switch action {
			case service.HealthNotifyRecharge:
				service.NotifyUpstreamRecharge(channelError, err)
				service.DisableChannel(channelError, reason)
			case service.HealthDisableImmediate, service.HealthDisableWindow:
				service.DisableChannel(channelError, reason)
			}
		})
	}

	if constant.ErrorLogEnabled && types.IsRecordErrorLog(err) {
		// 保存错误日志到mysql中
		userId := c.GetInt("id")
		tokenName := c.GetString("token_name")
		modelName := c.GetString("original_model")
		tokenId := c.GetInt("token_id")
		userGroup := c.GetString("group")
		channelId := c.GetInt("channel_id")
		other := make(map[string]interface{})
		if c.Request != nil && c.Request.URL != nil {
			other["request_path"] = c.Request.URL.Path
		}
		other["error_type"] = err.GetErrorType()
		other["error_code"] = err.GetErrorCode()
		other["status_code"] = err.StatusCode
		other["channel_id"] = channelId
		other["channel_name"] = c.GetString("channel_name")
		other["channel_type"] = c.GetInt("channel_type")
		if taskID := c.GetString("image_poll_task_id"); taskID != "" {
			other["task_id"] = taskID
		}
		adminInfo := make(map[string]interface{})
		adminInfo["use_channel"] = c.GetStringSlice("use_channel")
		if decision, ok := getRetryDecision(c); ok {
			adminInfo["retry_decision"] = decision
		}
		appendOfficialFallbackErrorAdminInfo(c, adminInfo, err)
		isMultiKey := common.GetContextKeyBool(c, constant.ContextKeyChannelIsMultiKey)
		if isMultiKey {
			adminInfo["is_multi_key"] = true
			adminInfo["multi_key_index"] = common.GetContextKeyInt(c, constant.ContextKeyChannelMultiKeyIndex)
		}
		service.AppendChannelAffinityAdminInfo(c, adminInfo)
		other["admin_info"] = adminInfo
		startTime := common.GetContextKeyTime(c, constant.ContextKeyRequestStartTime)
		if startTime.IsZero() {
			startTime = time.Now()
		}
		useTimeSeconds := int(time.Since(startTime).Seconds())
		model.RecordErrorLog(c, userId, channelId, modelName, tokenName, err.MaskSensitiveErrorWithStatusCode(), tokenId, useTimeSeconds, common.GetContextKeyBool(c, constant.ContextKeyIsStream), userGroup, other)
	}

}

func appendOfficialFallbackErrorAdminInfo(c *gin.Context, adminInfo map[string]interface{}, err *types.NewAPIError) {
	if c == nil || adminInfo == nil || !c.GetBool("official_fallback_triggered") {
		return
	}
	adminInfo["official_fallback_triggered"] = true
	if channelID := c.GetInt("official_fallback_channel_id"); channelID > 0 {
		adminInfo["official_fallback_channel_id"] = channelID
	}
	if channelName := strings.TrimSpace(c.GetString("official_fallback_channel_name")); channelName != "" {
		adminInfo["official_fallback_channel_name"] = channelName
	}
	if currentChannelID := c.GetInt("channel_id"); currentChannelID > 0 {
		adminInfo["official_fallback_final_channel_id"] = currentChannelID
		if currentChannelID == c.GetInt("official_fallback_channel_id") {
			adminInfo["official_fallback_success"] = false
			if err != nil {
				adminInfo["official_fallback_error_code"] = err.GetErrorCode()
				adminInfo["official_fallback_status_code"] = err.StatusCode
				adminInfo["official_fallback_error_message"] = err.MaskSensitiveErrorWithStatusCode()
			}
		}
	}
}

func RelayMidjourney(c *gin.Context) {
	relayInfo, err := relaycommon.GenRelayInfo(c, types.RelayFormatMjProxy, nil, nil)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"description": fmt.Sprintf("failed to generate relay info: %s", err.Error()),
			"type":        "upstream_error",
			"code":        4,
		})
		return
	}

	var mjErr *dto.MidjourneyResponse
	switch relayInfo.RelayMode {
	case relayconstant.RelayModeMidjourneyNotify:
		mjErr = relay.RelayMidjourneyNotify(c)
	case relayconstant.RelayModeMidjourneyTaskFetch, relayconstant.RelayModeMidjourneyTaskFetchByCondition:
		mjErr = relay.RelayMidjourneyTask(c, relayInfo.RelayMode)
	case relayconstant.RelayModeMidjourneyTaskImageSeed:
		mjErr = relay.RelayMidjourneyTaskImageSeed(c)
	case relayconstant.RelayModeSwapFace:
		mjErr = relay.RelaySwapFace(c, relayInfo)
	default:
		mjErr = relay.RelayMidjourneySubmit(c, relayInfo)
	}
	//err = relayMidjourneySubmit(c, relayMode)
	log.Println(mjErr)
	if mjErr != nil {
		statusCode := http.StatusBadRequest
		if mjErr.Code == 30 {
			mjErr.Result = "当前分组负载已饱和，请稍后再试，或升级账户以提升服务质量。"
			statusCode = http.StatusTooManyRequests
		}
		c.JSON(statusCode, gin.H{
			"description": fmt.Sprintf("%s %s", mjErr.Description, mjErr.Result),
			"type":        "upstream_error",
			"code":        mjErr.Code,
		})
		channelId := c.GetInt("channel_id")
		logger.LogError(c, fmt.Sprintf("relay error (channel #%d, status code %d): %s", channelId, statusCode, fmt.Sprintf("%s %s", mjErr.Description, mjErr.Result)))
	}
}

func RelayNotImplemented(c *gin.Context) {
	err := types.OpenAIError{
		Message: "API not implemented",
		Type:    "new_api_error",
		Param:   "",
		Code:    "api_not_implemented",
	}
	c.JSON(http.StatusNotImplemented, gin.H{
		"error": err,
	})
}

func RelayNotFound(c *gin.Context) {
	err := types.OpenAIError{
		Message: fmt.Sprintf("Invalid URL (%s %s)", c.Request.Method, c.Request.URL.Path),
		Type:    "invalid_request_error",
		Param:   "",
		Code:    "",
	}
	c.JSON(http.StatusNotFound, gin.H{
		"error": err,
	})
}

func RelayTaskFetch(c *gin.Context) {
	relayInfo, err := relaycommon.GenRelayInfo(c, types.RelayFormatTask, nil, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, &dto.TaskError{
			Code:       "gen_relay_info_failed",
			Message:    err.Error(),
			StatusCode: http.StatusInternalServerError,
		})
		return
	}
	if taskErr := relay.RelayTaskFetch(c, relayInfo.RelayMode); taskErr != nil {
		respondTaskError(c, taskErr)
	}
}

func RelayTask(c *gin.Context) {
	relayInfo, err := relaycommon.GenRelayInfo(c, types.RelayFormatTask, nil, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, &dto.TaskError{
			Code:       "gen_relay_info_failed",
			Message:    err.Error(),
			StatusCode: http.StatusInternalServerError,
		})
		return
	}

	if taskErr := relay.ResolveOriginTask(c, relayInfo); taskErr != nil {
		respondTaskError(c, taskErr)
		return
	}

	var result *relay.TaskSubmitResult
	var taskErr *dto.TaskError
	defer func() {
		if taskErr != nil && relayInfo.Billing != nil {
			apiErr := service.TaskErrorToNewAPIError(taskErr)
			service.RefundPreConsumeIfSafe(c, relayInfo, apiErr)
		}
	}()

	retryParam := &service.RetryParam{
		Ctx:        c,
		TokenGroup: relayInfo.TokenGroup,
		ModelName:  relayInfo.OriginModelName,
		Retry:      common.GetPointer(0),
	}

	for ; retryParam.GetRetry() <= common.RetryTimes; retryParam.IncreaseRetry() {
		var channel *model.Channel

		if lockedCh, ok := relayInfo.LockedChannel.(*model.Channel); ok && lockedCh != nil {
			channel = lockedCh
			if retryParam.GetRetry() > 0 {
				if setupErr := middleware.SetupContextForSelectedChannel(c, channel, relayInfo.OriginModelName); setupErr != nil {
					taskErr = service.TaskErrorWrapperLocal(setupErr.Err, "setup_locked_channel_failed", http.StatusInternalServerError)
					break
				}
			}
		} else {
			var channelErr *types.NewAPIError
			channel, channelErr = getChannel(c, relayInfo, retryParam)
			if channelErr != nil {
				logger.LogError(c, channelErr.Error())
				taskErr = service.TaskErrorWrapperLocal(channelErr.Err, "get_channel_failed", http.StatusInternalServerError)
				break
			}
		}

		addUsedChannel(c, channel.Id)
		bodyStorage, bodyErr := common.GetBodyStorage(c)
		if bodyErr != nil {
			if common.IsRequestBodyTooLargeError(bodyErr) || errors.Is(bodyErr, common.ErrRequestBodyTooLarge) {
				taskErr = service.TaskErrorWrapperLocal(bodyErr, "read_request_body_failed", http.StatusRequestEntityTooLarge)
			} else {
				taskErr = service.TaskErrorWrapperLocal(bodyErr, "read_request_body_failed", http.StatusBadRequest)
			}
			break
		}
		c.Request.Body = io.NopCloser(bodyStorage)

		result, taskErr = relay.RelayTaskSubmit(c, relayInfo)
		if taskErr == nil {
			break
		}

		retryDecision := evaluateTaskRetry(c, channel.Id, taskErr, retryParam.GetRetry(), common.RetryTimes-retryParam.GetRetry())
		if !taskErr.LocalError {
			setTaskRetryDecision(c, retryDecision)
			processChannelError(c,
				*types.NewChannelError(channel.Id, channel.Type, channel.Name, channel.ChannelInfo.IsMultiKey,
					common.GetContextKeyString(c, constant.ContextKeyChannelKey), channel.GetAutoBan()),
				types.NewOpenAIError(taskErr.Error, types.ErrorCodeBadResponseStatusCode, taskErr.StatusCode))
		}

		if !retryDecision.ShouldRetry {
			break
		}
	}

	useChannel := c.GetStringSlice("use_channel")
	if len(useChannel) > 1 {
		retryLogStr := fmt.Sprintf("重试：%s", strings.Trim(strings.Join(strings.Fields(fmt.Sprint(useChannel)), "->"), "[]"))
		logger.LogInfo(c, retryLogStr)
	}

	// ── 成功：结算 + 日志 + 插入任务 ──
	if taskErr == nil {
		if settleErr := service.SettleBilling(c, relayInfo, result.Quota); settleErr != nil {
			common.SysError("settle task billing error: " + settleErr.Error())
		}
		service.LogTaskConsumption(c, relayInfo)

		task := model.InitTask(result.Platform, relayInfo)
		task.PrivateData.UpstreamTaskID = result.UpstreamTaskID
		task.PrivateData.BillingSource = relayInfo.BillingSource
		task.PrivateData.SubscriptionId = relayInfo.SubscriptionId
		task.PrivateData.TokenId = relayInfo.TokenId
		task.PrivateData.BillingContext = &model.TaskBillingContext{
			ModelPrice:      relayInfo.PriceData.ModelPrice,
			GroupRatio:      relayInfo.PriceData.GroupRatioInfo.GroupRatio,
			ModelRatio:      relayInfo.PriceData.ModelRatio,
			OtherRatios:     relayInfo.PriceData.OtherRatios,
			OriginModelName: relayInfo.OriginModelName,
			PerCallBilling:  service.IsTaskPerCallBilling(relayInfo.OriginModelName, relayInfo.PriceData),
		}
		task.Quota = result.Quota
		task.Data = result.TaskData
		task.Action = relayInfo.Action
		if taskReq, reqErr := relaycommon.GetTaskRequest(c); reqErr == nil {
			if rd := service.BuildVideoRequestDataForLog(&taskReq); len(rd) > 0 {
				if encoded, merr := common.Marshal(rd); merr == nil {
					task.PrivateData.RequestData = string(encoded)
				}
			}
		}
		if insertErr := task.Insert(); insertErr != nil {
			common.SysError("insert task error: " + insertErr.Error())
		}
	}

	if taskErr != nil {
		respondTaskError(c, taskErr)
	}
}

// respondTaskError 统一输出 Task 错误响应（含 429 限流提示改写）
func respondTaskError(c *gin.Context, taskErr *dto.TaskError) {
	if taskErr.StatusCode == http.StatusTooManyRequests {
		taskErr.Message = "当前分组上游负载已饱和，请稍后再试"
	}
	c.JSON(taskErr.StatusCode, taskErr)
}
