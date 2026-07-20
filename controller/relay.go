package controller

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strconv"
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
	"github.com/QuantumNous/new-api/relay/channel/openai/image_stream"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/types"

	"github.com/bytedance/gopkg/util/gopool"
	"github.com/samber/lo"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

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
			logger.LogError(c, fmt.Sprintf("relay error: %s", common.LocalLogPreview(newAPIError.Error())))
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

	relayInfo, err := relaycommon.GenRelayInfo(c, relayFormat, request, ws)
	if err != nil {
		newAPIError = types.NewError(err, types.ErrorCodeGenRelayInfoFailed)
		return
	}
	preflightInfo := *relayInfo
	preflightInfo.Request = nil
	preflightInfo.InitChannelMeta(c)
	if err := helper.ModelMappedHelper(c, &preflightInfo, nil); err != nil {
		newAPIError = types.NewError(err, types.ErrorCodeChannelModelMappedError, types.ErrOptionWithSkipRetry())
		return
	}
	if err := helper.ValidateUnifiedImageEntryPoint(&preflightInfo, request); err != nil {
		newAPIError = types.NewErrorWithStatusCode(err, types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
		return
	}
	switch relayFormat {
	case types.RelayFormatOpenAI, types.RelayFormatOpenAIResponses, types.RelayFormatOpenAIResponsesCompaction, types.RelayFormatClaude, types.RelayFormatGemini:
		storage, bodyErr := common.GetBodyStorage(c)
		if bodyErr != nil {
			newAPIError = types.NewErrorWithStatusCode(bodyErr, types.ErrorCodeReadRequestBodyFailed, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
			return
		}
		if bodyErr := helper.ValidateUnifiedImagePayloadStorage(&preflightInfo, storage); bodyErr != nil {
			newAPIError = types.NewErrorWithStatusCode(bodyErr, types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
			return
		}
	}
	if overrideErr := helper.ValidateUnifiedImageParamOverride(&preflightInfo); overrideErr != nil {
		newAPIError = types.NewErrorWithStatusCode(overrideErr, types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
		return
	}
	asyncImageRequest := false
	if _, ok := request.(*dto.ImageRequest); ok &&
		(relayInfo.RelayMode == relayconstant.RelayModeImagesGenerations ||
			relayInfo.RelayMode == relayconstant.RelayModeImagesEdits) {
		asyncImageRequest = true
		relayInfo.ForcePreConsume = true
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
	} else if !asyncImageRequest {
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
				relayInfo.Billing.Refund(c)
			}
			service.ChargeViolationFeeIfNeeded(c, relayInfo, newAPIError)
		}
	}()

	retryParam := &service.RetryParam{
		Ctx:         c,
		TokenGroup:  relayInfo.TokenGroup,
		ModelName:   relayInfo.OriginModelName,
		RequestPath: c.Request.URL.Path,
		Retry:       common.GetPointer(0),
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
		if retryParam.ExcludedChannelIDs == nil {
			retryParam.ExcludedChannelIDs = make(map[int]struct{})
		}
		retryParam.ExcludedChannelIDs[channel.Id] = struct{}{}
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

		// Reset per-attempt so an empty-response flag from a prior attempt cannot
		// leak into this attempt's health outcome.
		relayInfo.UpstreamEmptyResponse = false
		relayInfo.AttemptUpstreamHost = ""
		attemptStart := relayInfo.BeginChannelAttempt()
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

		asyncImageSubmitted := c.GetBool(image_stream.ContextKeyAsyncImageSubmitted)
		if !asyncImageSubmitted {
			service.RecordChannelHealthOutcome(channel.Id, relayInfo.OriginModelName, c.Request.URL.Path, relayInfo, attemptStart, newAPIError, isSemanticClientError(newAPIError))
		}

		if newAPIError == nil {
			relayInfo.LastError = nil
			if !asyncImageSubmitted {
				cooldownSlowChannelIfNeeded(c, relayInfo, channel, attemptStart)
			}
			return
		}

		newAPIError = service.NormalizeViolationFeeError(newAPIError)
		relayInfo.LastError = newAPIError

		// The client aborted: the in-flight upstream call fails on whichever
		// channel was selected, so every remaining attempt fails the same way in
		// milliseconds. Retrying burns healthy channels and cooling them blames
		// them for the client's cancellation. Stop here without penalizing.
		if isClientCanceledError(newAPIError) {
			logger.LogInfo(c, "client canceled the request; skipping retry and channel attribution")
			break
		}
		if common.UpstreamHostCircuitMode != common.UpstreamHostCircuitModeOff {
			service.ObserveUpstreamHostFailure(
				relayRetryHost(relayInfo),
				relayInfo.OriginModelName,
				c.Request.URL.Path,
				channel.Id,
				newAPIError,
			)
		}
		processChannelError(c, *types.NewChannelError(channel.Id, channel.Type, channel.Name, channel.ChannelInfo.IsMultiKey, common.GetContextKeyString(c, constant.ContextKeyChannelKey), channel.GetAutoBan()), newAPIError)

		// Bound total retry wall-clock so a request cannot spend minutes cycling
		// dead/hung channels (each costing a full response-header timeout). The
		// first attempt always runs; this only gates further retries.
		if common.RelayMaxRetryDuration > 0 && time.Since(relayInfo.StartTime) > time.Duration(common.RelayMaxRetryDuration)*time.Second {
			logger.LogWarn(c, fmt.Sprintf("relay retry budget exhausted after %.1fs (limit %ds), stopping retries", time.Since(relayInfo.StartTime).Seconds(), common.RelayMaxRetryDuration))
			break
		}

		if !shouldRetry(c, newAPIError, common.RetryTimes-retryParam.GetRetry()) {
			break
		}
		if shouldAvoidRetryHost(newAPIError) {
			host := relayRetryHost(relayInfo)
			if host != "" {
				if retryParam.AvoidChannelHosts == nil {
					retryParam.AvoidChannelHosts = make(map[string]struct{})
				}
				retryParam.AvoidChannelHosts[host] = struct{}{}
				logger.LogInfo(c, fmt.Sprintf("transport retry will prefer a different upstream host than %s", host))
			}
		}
	}

	useChannel := c.GetStringSlice("use_channel")
	if len(useChannel) > 1 {
		retryLogStr := fmt.Sprintf("重试：%s", strings.Trim(strings.Join(strings.Fields(fmt.Sprint(useChannel)), "->"), "[]"))
		logger.LogInfo(c, retryLogStr)
	}
	if newAPIError != nil {
		gopool.Go(func() {
			perfmetrics.RecordRelaySample(relayInfo, false, 0)
		})
	}
}

func relayRetryHost(relayInfo *relaycommon.RelayInfo) string {
	if relayInfo == nil {
		return ""
	}
	if relayInfo.AttemptUpstreamHost != "" {
		return model.NormalizeChannelBaseURLHost(relayInfo.AttemptUpstreamHost)
	}
	return model.NormalizeChannelBaseURLHost(relayInfo.ChannelBaseUrl)
}

// ReplayAsyncImageGeneration resolves accepted idempotent image requests after
// strict authentication and request rate limiting, but before channel selection
// and task billing. Requests without an idempotency key do not need body parsing.
func ReplayAsyncImageGeneration(c *gin.Context) {
	if strings.TrimSpace(c.GetHeader("Idempotency-Key")) == "" {
		c.Next()
		return
	}

	var request *dto.ImageRequest
	if relayconstant.Path2RelayMode(c.Request.URL.Path) == relayconstant.RelayModeImagesEdits {
		request = &dto.ImageRequest{}
		if strings.Contains(strings.ToLower(c.GetHeader("Content-Type")), gin.MIMEMultipartPOSTForm) {
			form, err := common.ParseMultipartFormReusable(c)
			if err != nil {
				c.Next()
				return
			}
			formData := url.Values(form.Value)
			c.Request.MultipartForm = form
			c.Request.PostForm = formData
			request = asyncImageEditIdentityRequest(formData)
		} else if err := common.UnmarshalBodyReusable(c, request); err != nil {
			c.Next()
			return
		}
	} else {
		request = &dto.ImageRequest{}
		if err := common.UnmarshalBodyReusable(c, request); err != nil {
			c.Next()
			return
		}
	}
	handled, apiErr := image_stream.TryReplayAsyncImageTask(c, c.GetInt("id"), request)
	if !handled {
		c.Next()
		return
	}
	if apiErr != nil {
		c.JSON(apiErr.StatusCode, gin.H{"error": apiErr.ToOpenAIError()})
	}
	c.Abort()
}

func asyncImageEditIdentityRequest(formData url.Values) *dto.ImageRequest {
	request := &dto.ImageRequest{
		Model:          formData.Get("model"),
		Prompt:         formData.Get("prompt"),
		Size:           formData.Get("size"),
		Quality:        formData.Get("quality"),
		ResponseFormat: formData.Get("response_format"),
		WebhookURL:     strings.TrimSpace(formData.Get("webhook_url")),
		WebhookSecret:  formData.Get("webhook_secret"),
	}
	if nValue := strings.TrimSpace(formData.Get("n")); nValue != "" {
		if n, err := strconv.ParseUint(nValue, 10, 32); err == nil {
			request.N = common.GetPointer(uint(n))
		}
	}
	if asyncValue := strings.TrimSpace(formData.Get("async")); asyncValue != "" {
		if async, err := strconv.ParseBool(asyncValue); err == nil {
			request.Async = common.GetPointer(async)
		}
	}
	if streamValue := strings.TrimSpace(formData.Get("stream")); streamValue != "" {
		if stream, err := strconv.ParseBool(streamValue); err == nil {
			request.Stream = common.GetPointer(stream)
		}
	}
	if callbackURL := strings.TrimSpace(formData.Get("callBackUrl")); callbackURL != "" &&
		(request.WebhookURL == "" || request.WebhookURL == callbackURL) {
		request.WebhookURL = callbackURL
	} else if callbackURL != "" {
		// Preserve the conflict in the replay identity. The normal validator will
		// return the client-facing 400 after replay lookup does not match.
		request.Extra = map[string]json.RawMessage{}
		if encoded, err := common.Marshal(callbackURL); err == nil {
			request.Extra["callBackUrl"] = encoded
		}
	}
	for _, field := range []struct {
		name   string
		target *json.RawMessage
	}{
		{name: "style", target: &request.Style},
		{name: "user", target: &request.User},
		{name: "background", target: &request.Background},
		{name: "moderation", target: &request.Moderation},
		{name: "output_format", target: &request.OutputFormat},
		{name: "input_fidelity", target: &request.InputFidelity},
	} {
		if value := formData.Get(field.name); value != "" {
			if encoded, err := common.Marshal(value); err == nil {
				*field.target = encoded
			}
		}
	}
	for _, field := range []struct {
		name   string
		target *json.RawMessage
	}{
		{name: "output_compression", target: &request.OutputCompression},
		{name: "partial_images", target: &request.PartialImages},
	} {
		if value := strings.TrimSpace(formData.Get(field.name)); value != "" {
			*field.target = json.RawMessage(value)
		}
	}
	return request
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
	channel, selectGroup, err := service.CacheGetRandomSatisfiedChannel(retryParam)

	info.PriceData.GroupRatioInfo = helper.HandleGroupRatio(c, info)

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
	return channel, nil
}

func isSemanticClientError(openaiErr *types.NewAPIError) bool {
	if openaiErr == nil {
		return false
	}
	message := strings.ToLower(openaiErr.Error())
	return strings.Contains(message, "exceeds the context window") ||
		strings.Contains(message, "context length exceeded") ||
		strings.Contains(message, "maximum context length")
}

// isClientCanceledError reports whether the attempt failed because the client
// aborted the request rather than because the channel misbehaved. Only
// context.Canceled counts: context.DeadlineExceeded is our own timeout firing,
// which does indicate a slow/dead channel and must still be attributed.
func isClientCanceledError(apiErr *types.NewAPIError) bool {
	return apiErr != nil && errors.Is(apiErr, context.Canceled)
}

func shouldAvoidRetryHost(apiErr *types.NewAPIError) bool {
	return service.ShouldObserveUpstreamHostFailure(apiErr)
}

func shouldRetry(c *gin.Context, openaiErr *types.NewAPIError, retryTimes int) bool {
	if openaiErr == nil {
		return false
	}
	// Checked before IsChannelError below, which returns true unconditionally and
	// would otherwise send a client-canceled request through every channel.
	if isClientCanceledError(openaiErr) {
		return false
	}
	if types.IsSkipRetryError(openaiErr) || isSemanticClientError(openaiErr) {
		return false
	}
	if service.ShouldSkipRetryAfterChannelAffinityFailure(c) && openaiErr.StatusCode < http.StatusInternalServerError {
		return false
	}
	if types.IsChannelError(openaiErr) {
		return true
	}
	if retryTimes <= 0 {
		return false
	}
	if _, ok := c.Get("specific_channel_id"); ok {
		return false
	}
	code := openaiErr.StatusCode
	if code >= 200 && code < 300 {
		return false
	}
	if code < 100 || code > 599 {
		return true
	}
	if operation_setting.IsAlwaysSkipRetryCode(openaiErr.GetErrorCode()) {
		return false
	}
	return operation_setting.ShouldRetryByStatusCode(code)
}

// cooldownSlowChannelIfNeeded cools a channel after a successful request whose
// first-response-time exceeded SlowChannelFRTThreshold. FRT is only meaningful
// when the handler actually recorded a first response; pinned (specific) channel
// requests are skipped since they bypass selection anyway.
func cooldownSlowChannelIfNeeded(c *gin.Context, info *relaycommon.RelayInfo, channel *model.Channel, attemptStart time.Time) {
	if info == nil || channel == nil {
		return
	}
	if _, ok := c.Get("specific_channel_id"); ok {
		return
	}
	frt, slow := shouldCooldownSlowChannel(info, attemptStart)
	if !slow {
		return
	}
	channelError := types.NewChannelError(channel.Id, channel.Type, channel.Name, channel.ChannelInfo.IsMultiKey, common.GetContextKeyString(c, constant.ContextKeyChannelKey), channel.GetAutoBan())
	service.CooldownSlowChannel(*channelError, frt)
}

// shouldCooldownSlowChannel decides whether the channel that just served a
// successful response was slow to first token. Latency is measured from
// attemptStart (the start of the SUCCESSFUL attempt), not info.StartTime: on a
// request that failed over across dead channels, info.StartTime includes the
// time wasted on those earlier attempts, which would inflate the measured first
// token latency and wrongly cool the fast channel that actually served. If no
// response was sent, or no first response can be attributed to this attempt,
// the channel is not cooled.
func shouldCooldownSlowChannel(info *relaycommon.RelayInfo, attemptStart time.Time) (time.Duration, bool) {
	if info == nil {
		return 0, false
	}
	firstResponseAt := info.FirstResponseTimeForAttempt(attemptStart)
	if firstResponseAt.IsZero() {
		return 0, false
	}
	frt := firstResponseAt.Sub(attemptStart)
	if info.StreamStatus != nil && !info.StreamStatus.IsNormalEnd() {
		return frt, false
	}
	if info.AffinityColdStart {
		// We released this request's prompt-cache affinity, so this channel is
		// answering from a cold cache and its first token pays a full prefill
		// (23.3s measured on a 240k-token prompt — 78% of the threshold below).
		// That is work we imposed, not the channel being slow. Cooling it here
		// would sideline for 30 minutes the very channel we just picked for
		// being the fastest, which is the opposite of the intent.
		return frt, false
	}
	return frt, frt >= service.SlowChannelFRTThreshold
}

// isRetryableChannelError reports whether the error would cause the relay loop
// to retry on another channel. It mirrors shouldRetry's error classification
// but omits the remaining-retry-count gate, so a channel is still recognized as
// "caused a retry" even on the final attempt. Used to decide cooldown.
func isRetryableChannelError(c *gin.Context, openaiErr *types.NewAPIError) bool {
	if openaiErr == nil {
		return false
	}
	if types.IsSkipRetryError(openaiErr) || isSemanticClientError(openaiErr) {
		return false
	}
	if service.ShouldSkipRetryAfterChannelAffinityFailure(c) && openaiErr.StatusCode < http.StatusInternalServerError {
		return false
	}
	if types.IsChannelError(openaiErr) {
		return true
	}
	if _, ok := c.Get("specific_channel_id"); ok {
		return false
	}
	code := openaiErr.StatusCode
	if code >= 200 && code < 300 {
		return false
	}
	if code < 100 || code > 599 {
		return true
	}
	if operation_setting.IsAlwaysSkipRetryCode(openaiErr.GetErrorCode()) {
		return false
	}
	return operation_setting.ShouldRetryByStatusCode(code)
}

func shouldCooldownForUpstreamError(err *types.NewAPIError) bool {
	return !isSemanticClientError(err) && service.ShouldCooldownChannelForUpstreamError(err)
}

// isModelCapabilityError reports whether the channel failed specifically because
// it cannot serve the requested model — the upstream returned model_not_found
// ("not supported by any configured account"). That is a per-(channel, model)
// gap, not a channel-wide fault, so it must not trigger a channel-wide cooldown.
//
// The model_not_found this matches is the one an upstream returns for a live
// request; the same code is also used at the distribution stage for "no channel
// in this group", but that path aborts before any channel is selected and never
// reaches processChannelError.
func isModelCapabilityError(err *types.NewAPIError) bool {
	return err != nil && err.GetErrorCode() == types.ErrorCodeModelNotFound
}

func processChannelError(c *gin.Context, channelError types.ChannelError, err *types.NewAPIError) {
	logger.LogError(c, fmt.Sprintf("channel error (channel #%d, status code: %d): %s", channelError.ChannelId, err.StatusCode, common.LocalLogPreview(err.Error())))
	// 不要使用context获取渠道信息，异步处理时可能会出现渠道信息不一致的情况
	// do not use context to get channel info, there may be inconsistent channel info when processing asynchronously
	if isModelCapabilityError(err) {
		// The upstream reported it cannot serve THIS model (model_not_found),
		// which is a fact about (channel, model), not about the channel. The
		// adaptive health circuit already recorded it at that granularity
		// (RecordChannelHealthOutcome ran before this, and ErrorCodeModelNotFound
		// is channel-attributable), so it will steer this one model away on its
		// own. A channel-wide cooldown here would also sideline every other model
		// the channel serves fine — exactly what cooled a healthy claude-sonnet-5
		// on #25 because gpt-5.4-mini 404'd. Skip it.
		logger.LogInfo(c, fmt.Sprintf("channel #%d does not serve model %q; isolating that pair via the health circuit instead of cooling the whole channel", channelError.ChannelId, common.GetContextKeyString(c, constant.ContextKeyOriginalModel)))
	} else if service.ShouldCooldownChannel(err) {
		service.CooldownChannel(channelError, err)
	} else if isRetryableChannelError(c, err) {
		// Any error that would send the request to retry another channel means
		// this channel misbehaved; cool it for the full duration so it stops
		// being re-picked. This subsumes upstream 5xx / capability 4xx.
		service.CooldownChannelForRetry(channelError, err)
	} else if shouldCooldownForUpstreamError(err) {
		service.CooldownChannelForUpstreamError(channelError, err)
	}

	if service.ShouldDisableChannel(err) && channelError.AutoBan {
		gopool.Go(func() {
			service.DisableChannel(channelError, err.ErrorWithStatusCode())
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
		adminInfo := make(map[string]interface{})
		adminInfo["use_channel"] = c.GetStringSlice("use_channel")
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
			relayInfo.Billing.Refund(c)
		}
	}()

	retryParam := &service.RetryParam{
		Ctx:         c,
		TokenGroup:  relayInfo.TokenGroup,
		ModelName:   relayInfo.OriginModelName,
		RequestPath: c.Request.URL.Path,
		Retry:       common.GetPointer(0),
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
		if retryParam.ExcludedChannelIDs == nil {
			retryParam.ExcludedChannelIDs = make(map[int]struct{})
		}
		retryParam.ExcludedChannelIDs[channel.Id] = struct{}{}
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

		attemptStart := relayInfo.BeginChannelAttempt()
		result, taskErr = relay.RelayTaskSubmit(c, relayInfo)
		var taskAPIError *types.NewAPIError
		if taskErr != nil && !taskErr.LocalError {
			taskAPIError = types.NewOpenAIError(taskErr.Error, types.ErrorCodeBadResponseStatusCode, taskErr.StatusCode)
		}
		service.RecordChannelHealthOutcome(channel.Id, relayInfo.OriginModelName, c.Request.URL.Path, relayInfo, attemptStart, taskAPIError, false)
		if taskErr == nil {
			break
		}

		if taskAPIError != nil {
			processChannelError(c,
				*types.NewChannelError(channel.Id, channel.Type, channel.Name, channel.ChannelInfo.IsMultiKey,
					common.GetContextKeyString(c, constant.ContextKeyChannelKey), channel.GetAutoBan()),
				taskAPIError)
		}

		if !shouldRetryTaskRelay(c, channel.Id, taskErr, common.RetryTimes-retryParam.GetRetry()) {
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
		task.PrivateData.NodeName = common.NodeName
		task.PrivateData.BillingContext = &model.TaskBillingContext{
			ModelPrice:      relayInfo.PriceData.ModelPrice,
			GroupRatio:      relayInfo.PriceData.GroupRatioInfo.GroupRatio,
			ModelRatio:      relayInfo.PriceData.ModelRatio,
			OtherRatios:     relayInfo.PriceData.OtherRatios(),
			OriginModelName: relayInfo.OriginModelName,
			PerCallBilling:  common.StringsContains(constant.TaskPricePatches, relayInfo.OriginModelName) || relayInfo.PriceData.UsePrice,
		}
		task.Quota = result.Quota
		task.Data = result.TaskData
		task.Action = relayInfo.Action
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

func shouldRetryTaskRelay(c *gin.Context, channelId int, taskErr *dto.TaskError, retryTimes int) bool {
	if taskErr == nil {
		return false
	}
	if service.ShouldSkipRetryAfterChannelAffinityFailure(c) && taskErr.StatusCode/100 != 5 {
		return false
	}
	if retryTimes <= 0 {
		return false
	}
	if _, ok := c.Get("specific_channel_id"); ok {
		return false
	}
	if taskErr.StatusCode == http.StatusTooManyRequests {
		return true
	}
	if taskErr.StatusCode == 307 {
		return true
	}
	if taskErr.StatusCode/100 == 5 {
		// 超时不重试
		if operation_setting.IsAlwaysSkipRetryStatusCode(taskErr.StatusCode) {
			return false
		}
		return true
	}
	if taskErr.StatusCode == http.StatusBadRequest {
		return false
	}
	if taskErr.StatusCode == 408 {
		// azure处理超时不重试
		return false
	}
	if taskErr.LocalError {
		return false
	}
	if taskErr.StatusCode/100 == 2 {
		return false
	}
	return true
}
