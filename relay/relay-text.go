package relay

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"one-api/common"
	"one-api/constant"
	"one-api/dto"
	"one-api/metrics"
	"one-api/model"
	relaycommon "one-api/relay/common"
	relayconstant "one-api/relay/constant"
	"one-api/relay/helper"
	"one-api/service"
	"one-api/setting"
	"strconv"
	"strings"
	"time"

	"github.com/bytedance/gopkg/util/gopool"

	"github.com/gin-gonic/gin"
)

func getAndValidateTextRequest(c *gin.Context, relayInfo *relaycommon.RelayInfo) (*dto.GeneralOpenAIRequest, error) {
	textRequest := &dto.GeneralOpenAIRequest{}
	err := common.UnmarshalBodyReusable(c, textRequest)
	if err != nil {
		return nil, err
	}
	if relayInfo.RelayMode == relayconstant.RelayModeModerations && textRequest.Model == "" {
		textRequest.Model = "text-moderation-latest"
	}
	if relayInfo.RelayMode == relayconstant.RelayModeEmbeddings && textRequest.Model == "" {
		textRequest.Model = c.Param("model")
	}

	if textRequest.MaxTokens > math.MaxInt32/2 {
		return nil, errors.New("max_tokens is invalid")
	}
	if textRequest.Model == "" {
		return nil, errors.New("model is required")
	}
	switch relayInfo.RelayMode {
	case relayconstant.RelayModeCompletions:
		if textRequest.Prompt == "" {
			return nil, errors.New("field prompt is required")
		}
	case relayconstant.RelayModeChatCompletions:
		if len(textRequest.Messages) == 0 {
			return nil, errors.New("field messages is required")
		}
	case relayconstant.RelayModeEmbeddings:
	case relayconstant.RelayModeModerations:
		if textRequest.Input == nil || textRequest.Input == "" {
			return nil, errors.New("field input is required")
		}
	case relayconstant.RelayModeEdits:
		if textRequest.Instruction == "" {
			return nil, errors.New("field instruction is required")
		}
	}
	relayInfo.IsStream = textRequest.Stream
	return textRequest, nil
}

func TextInfo(c *gin.Context) (*relaycommon.RelayInfo, *dto.GeneralOpenAIRequest, *dto.OpenAIErrorWithStatusCode) {
	relayInfo := relaycommon.GenRelayInfo(c)

	if relayInfo.Direct {
		// support claude direct
		if strings.HasPrefix(relayInfo.OriginModelName, "claude") {
			textRequest, err := getAndValidateDirectRequest(c, relayInfo)
			if err != nil {
				common.LogError(c, fmt.Sprintf("getAndValidateDirectRequest failed: %s", err.Error()))
				return nil, nil, service.OpenAIErrorWrapperLocal(err, "invalid_text_request", http.StatusBadRequest)
			}
			return relayInfo, textRequest, nil
		}
	}

	// get & validate textRequest 获取并验证文本请求
	textRequest, err := getAndValidateTextRequest(c, relayInfo)
	if err != nil {
		common.LogError(c, fmt.Sprintf("getAndValidateTextRequest failed: %s", err.Error()))
		return nil, nil, service.OpenAIErrorWrapperLocal(err, "invalid_text_request", http.StatusBadRequest)
	}
	return relayInfo, textRequest, nil
}

func TextHelper(c *gin.Context, relayInfo *relaycommon.RelayInfo, textRequest *dto.GeneralOpenAIRequest) (openaiErr *dto.OpenAIErrorWithStatusCode) {
	startTime := common.GetBeijingTime()
	var funcErr *dto.OpenAIErrorWithStatusCode
	var statusCode int = -1
	metrics.IncrementRelayRequestTotalCounter(strconv.Itoa(relayInfo.ChannelId), relayInfo.ChannelName, relayInfo.ChannelTag, relayInfo.BaseUrl, textRequest.Model, relayInfo.Group, 1)
	defer func() {
		if funcErr != nil {
			metrics.IncrementRelayRequestFailedCounter(strconv.Itoa(relayInfo.ChannelId), relayInfo.ChannelName, relayInfo.ChannelTag, relayInfo.BaseUrl, textRequest.Model, relayInfo.Group, strconv.Itoa(openaiErr.StatusCode), 1)
		} else {
			metrics.IncrementRelayRequestSuccessCounter(strconv.Itoa(relayInfo.ChannelId), relayInfo.ChannelName, relayInfo.ChannelTag, relayInfo.BaseUrl, textRequest.Model, relayInfo.Group, strconv.Itoa(statusCode), 1)
			metrics.ObserveRelayRequestDuration(strconv.Itoa(relayInfo.ChannelId), relayInfo.ChannelName, relayInfo.ChannelTag, relayInfo.BaseUrl, textRequest.Model, relayInfo.Group, time.Since(startTime).Seconds())
		}
	}()

	if setting.ShouldCheckPromptSensitive() {
		words, err := checkRequestSensitive(textRequest, relayInfo)
		if err != nil {
			funcErr = service.OpenAIErrorWrapperLocal(err, "sensitive_words_detected", http.StatusBadRequest)
			common.LogWarn(c, fmt.Sprintf("user sensitive words detected: %s", strings.Join(words, ", ")))
			return funcErr
		}
	}

	err := helper.ModelMappedHelper(c, relayInfo)
	if err != nil {
		funcErr = service.OpenAIErrorWrapperLocal(err, "model_mapped_error", http.StatusInternalServerError)
		return funcErr
	}

	textRequest.Model = relayInfo.UpstreamModelName

	// 获取 promptTokens，如果上下文中已经存在，则直接使用
	var promptTokens int
	if value, exists := c.Get("prompt_tokens"); exists {
		promptTokens = value.(int)
		relayInfo.PromptTokens = promptTokens
	} else {
		promptTokens, err = getPromptTokens(c, textRequest, relayInfo)
		// count messages token error 计算promptTokens错误
		if err != nil {
			funcErr = service.OpenAIErrorWrapper(err, "count_token_messages_failed", http.StatusInternalServerError)
			return funcErr
		}
		c.Set("prompt_tokens", promptTokens)
	}

	// Record input tokens metric
	tokenName := c.GetString("token_name")
	userName := c.GetString("username")
	metrics.IncrementInputTokens(strconv.Itoa(relayInfo.ChannelId), relayInfo.ChannelName, textRequest.Model, relayInfo.Group, strconv.Itoa(relayInfo.UserId), userName, tokenName, float64(promptTokens))

	priceData, err := helper.ModelPriceHelper(c, relayInfo, promptTokens, int(textRequest.MaxTokens))
	if err != nil {
		funcErr = service.OpenAIErrorWrapperLocal(err, "model_price_error", http.StatusInternalServerError)
		return funcErr
	}

	// pre-consume quota 预消耗配额
	preConsumedQuota, userQuota, openaiErr := preConsumeQuota(c, priceData.ShouldPreConsumedQuota, relayInfo)
	if openaiErr != nil {
		funcErr = openaiErr
		return openaiErr
	}
	defer func() {
		if openaiErr != nil {
			returnPreConsumedQuota(c, relayInfo, userQuota, preConsumedQuota)
		}
	}()
	includeUsage := false
	// 判断用户是否需要返回使用情况
	if textRequest.StreamOptions != nil && textRequest.StreamOptions.IncludeUsage {
		includeUsage = true
	}

	// 如果不支持StreamOptions，将StreamOptions设置为nil
	if !relayInfo.SupportStreamOptions || !textRequest.Stream {
		textRequest.StreamOptions = nil
	} else {
		// 如果支持StreamOptions，且请求中没有设置StreamOptions，根据配置文件设置StreamOptions
		if constant.ForceStreamOption {
			textRequest.StreamOptions = &dto.StreamOptions{
				IncludeUsage: true,
			}
		}
	}

	if includeUsage {
		relayInfo.ShouldIncludeUsage = true
	}

	adaptor := GetAdaptor(relayInfo.ApiType)
	if adaptor == nil {
		funcErr = service.OpenAIErrorWrapperLocal(fmt.Errorf("invalid api type: %d", relayInfo.ApiType), "invalid_api_type", http.StatusBadRequest)
		return funcErr
	}
	adaptor.Init(relayInfo)
	var requestBody io.Reader

	//if relayInfo.ChannelType == common.ChannelTypeOpenAI && !isModelMapped {
	//	body, err := common.GetRequestBody(c)
	//	if err != nil {
	//		return service.OpenAIErrorWrapperLocal(err, "get_request_body_failed", http.StatusInternalServerError)
	//	}
	//	requestBody = bytes.NewBuffer(body)
	//} else {
	//
	//}

	convertedRequest, err := adaptor.ConvertRequest(c, relayInfo, textRequest)
	if err != nil {
		funcErr = service.OpenAIErrorWrapperLocal(err, "convert_request_failed", http.StatusInternalServerError)
		return funcErr
	}
	jsonData, err := json.Marshal(convertedRequest)
	if err != nil {
		funcErr = service.OpenAIErrorWrapperLocal(err, "json_marshal_failed", http.StatusInternalServerError)
		return funcErr
	}
	// if len(jsonData) <= 2048 {
	// 	common.LogInfo(c, fmt.Sprintf("========>>> request data: %s", string(jsonData)))
	// }
	requestBody = bytes.NewBuffer(jsonData)

	// 如果请求中包含 X-Test-Traffic 头，则添加到 relayInfo 中
	if c.GetHeader("X-Test-Traffic") == "true" {
		relayInfo.Headers = make(map[string]string)
		relayInfo.Headers["X-Test-Traffic"] = "true"
	}

	// // 如果请求中包含 retry_request_id 头，则添加到 relayInfo 中
	// if retryRequestId := c.GetHeader("retry_request_id"); retryRequestId != "" {
	// 	if relayInfo.Headers == nil {
	// 		relayInfo.Headers = make(map[string]string)
	// 	}
	// 	relayInfo.Headers["retry_request_id"] = retryRequestId
	// }

	// // 如果请求中包含 retry 头，则添加到 relayInfo 中
	// if retry := c.GetHeader("retry"); retry != "" {
	// 	if relayInfo.Headers == nil {
	// 		relayInfo.Headers = make(map[string]string)
	// 	}
	// 	relayInfo.Headers["retry"] = retry
	// }

	statusCodeMappingStr := c.GetString("status_code_mapping")
	var httpResp *http.Response
	resp, err := adaptor.DoRequest(c, relayInfo, requestBody)

	if err != nil {
		funcErr = service.OpenAIErrorWrapper(err, "do_request_failed", http.StatusInternalServerError)
		return funcErr
	}

	if resp != nil {
		httpResp = resp.(*http.Response)
		// // 直接设置到 gin 的响应头
		// c.Writer.Header().Set("X-Origin-User-ID", strconv.Itoa(relayInfo.UserId))
		// c.Writer.Header().Set("X-Origin-Channel-ID", strconv.Itoa(relayInfo.ChannelId))
		// c.Writer.Header().Set("X-Retry-Count", strconv.Itoa(relayInfo.RetryCount))
		// if c.GetHeader("Retry_request_id") != "" {
		// 	c.Writer.Header().Set("Retry_request_id", c.GetHeader("Retry_request_id"))
		// }
		relayInfo.IsStream = relayInfo.IsStream || strings.HasPrefix(httpResp.Header.Get("Content-Type"), "text/event-stream")
		if httpResp.StatusCode != http.StatusOK {
			for k, v := range httpResp.Header {
				if k == "Content-Length" {
					continue
				}
				c.Writer.Header().Set(k, v[0])
				// common.LogInfo(c, fmt.Sprintf("set header %s = %s", k, v[0]))
			}
			openaiErr = service.RelayErrorHandler(httpResp)
			funcErr = openaiErr
			// reset status code 重置状态码
			service.ResetStatusCode(openaiErr, statusCodeMappingStr)
			return openaiErr
		}
	}

	// 读取响应体并创建副本
	responseBodyBytes, err := io.ReadAll(httpResp.Body)
	if err != nil {
		funcErr = service.OpenAIErrorWrapper(err, "read_response_body_failed", http.StatusInternalServerError)
		return funcErr
	}
	// 为adaptor创建一个新的响应体
	httpResp.Body = io.NopCloser(bytes.NewBuffer(responseBodyBytes))
	common.LogInfo(c, fmt.Sprintf("response body: %s", string(responseBodyBytes)))
	usage, openaiErr := adaptor.DoResponse(c, httpResp, relayInfo)
	if openaiErr != nil {
		funcErr = openaiErr
		// reset status code 重置状态码
		service.ResetStatusCode(openaiErr, statusCodeMappingStr)
		common.LogError(c, fmt.Sprintf("doResponse failed: %+v", openaiErr))
		return openaiErr
	}
	common.LogInfo(c, fmt.Sprintf("response status code: %d, Usage: %+v", httpResp.StatusCode, usage))
	// 设置状态码用于指标记录
	statusCode = resp.(*http.Response).StatusCode

	// Store request and response data together if persistence is enabled and status code is 200
	if model.RequestPersistenceEnabled && httpResp.StatusCode == http.StatusOK && !(c.GetHeader("X-Test-Traffic") == "true") {
		// 读取请求数据
		requestHeaders, _ := json.Marshal(c.Request.Header)
		requestBodyBytes, _ := io.ReadAll(c.Request.Body)
		c.Request.Body = io.NopCloser(bytes.NewBuffer(requestBodyBytes))

		// 读取响应数据
		responseHeaders, _ := json.Marshal(httpResp.Header)

		// 创建并保存记录，使用请求开始时间
		textRequest := &model.TextRequest{
			UserId:          common.GetOriginUserId(c, c.GetInt("id")),
			CreatedAt:       common.GetBeijingTime(),
			RequestId:       c.GetString(common.RequestIdKey),
			Model:           textRequest.Model,
			RequestHeaders:  string(requestHeaders),
			RequestBody:     string(requestBodyBytes),
			ResponseHeaders: string(responseHeaders),
			ResponseBody:    string(responseBodyBytes),
		}
		tableName := fmt.Sprintf("text_requests_%s", startTime.Format("20060102"))
		if err := model.RequestPersistenceDB.Table(tableName).Save(textRequest).Error; err != nil {
			common.SysError("failed to save text request: " + err.Error())
		}
	}

	if strings.HasPrefix(relayInfo.OriginModelName, "gpt-4o-audio") {
		service.PostAudioConsumeQuota(c, relayInfo, usage.(*dto.Usage), preConsumedQuota, userQuota, priceData, "")
	} else {
		postConsumeQuota(c, relayInfo, usage.(*dto.Usage), preConsumedQuota, userQuota, priceData, "")
	}

	return nil
}

func getPromptTokens(ctx *gin.Context, textRequest *dto.GeneralOpenAIRequest, info *relaycommon.RelayInfo) (int, error) {
	var promptTokens int
	var err error
	switch info.RelayMode {
	case relayconstant.RelayModeChatCompletions:
		promptTokens, err = service.CountTokenChatRequest(ctx, info, *textRequest)
	case relayconstant.RelayModeCompletions:
		promptTokens, err = service.CountTokenInput(textRequest.Prompt, textRequest.Model)
	case relayconstant.RelayModeModerations:
		promptTokens, err = service.CountTokenInput(textRequest.Input, textRequest.Model)
	case relayconstant.RelayModeEmbeddings:
		promptTokens, err = service.CountTokenInput(textRequest.Input, textRequest.Model)
	default:
		err = errors.New("unknown relay mode")
		promptTokens = 0
	}
	info.PromptTokens = promptTokens
	return promptTokens, err
}

func checkRequestSensitive(textRequest *dto.GeneralOpenAIRequest, info *relaycommon.RelayInfo) ([]string, error) {
	var err error
	var words []string
	switch info.RelayMode {
	case relayconstant.RelayModeChatCompletions:
		words, err = service.CheckSensitiveMessages(textRequest.Messages)
	case relayconstant.RelayModeCompletions:
		words, err = service.CheckSensitiveInput(textRequest.Prompt)
	case relayconstant.RelayModeModerations:
		words, err = service.CheckSensitiveInput(textRequest.Input)
	case relayconstant.RelayModeEmbeddings:
		words, err = service.CheckSensitiveInput(textRequest.Input)
	}
	return words, err
}

// 预扣费并返回用户剩余配额
func preConsumeQuota(c *gin.Context, preConsumedQuota int, relayInfo *relaycommon.RelayInfo) (int, int, *dto.OpenAIErrorWithStatusCode) {
	userQuota, err := model.GetUserQuota(relayInfo.UserId, false)
	if err != nil {
		return 0, 0, service.OpenAIErrorWrapperLocal(err, "get_user_quota_failed", http.StatusInternalServerError)
	}
	if userQuota <= 0 {
		return 0, 0, service.OpenAIErrorWrapperLocal(errors.New("user quota is not enough"), "insufficient_user_quota", http.StatusForbidden)
	}
	if userQuota-preConsumedQuota < 0 {
		return 0, 0, service.OpenAIErrorWrapperLocal(fmt.Errorf("chat pre-consumed quota failed, user quota: %s, need quota: %s", common.FormatQuota(userQuota), common.FormatQuota(preConsumedQuota)), "insufficient_user_quota", http.StatusForbidden)
	}
	relayInfo.UserQuota = userQuota
	if userQuota > 100*preConsumedQuota {
		// 用户额度充足，判断令牌额度是否充足
		if !relayInfo.TokenUnlimited {
			// 非无限令牌，判断令牌额度是否充足
			tokenQuota := c.GetInt("token_quota")
			if tokenQuota > 100*preConsumedQuota {
				// 令牌额度充足，信任令牌
				preConsumedQuota = 0
				common.LogInfo(c, fmt.Sprintf("user %d quota %s and token %d quota %d are enough, trusted and no need to pre-consume", relayInfo.UserId, common.FormatQuota(userQuota), relayInfo.TokenId, tokenQuota))
			}
		} else {
			// in this case, we do not pre-consume quota
			// because the user has enough quota
			preConsumedQuota = 0
			common.LogInfo(c, fmt.Sprintf("user %d with unlimited token has enough quota %s, trusted and no need to pre-consume", relayInfo.UserId, common.FormatQuota(userQuota)))
		}
	}

	if preConsumedQuota > 0 {
		err := service.PreConsumeTokenQuota(relayInfo, preConsumedQuota)
		if err != nil {
			return 0, 0, service.OpenAIErrorWrapperLocal(err, "pre_consume_token_quota_failed", http.StatusForbidden)
		}
		err = model.DecreaseUserQuota(relayInfo.UserId, preConsumedQuota)
		if err != nil {
			return 0, 0, service.OpenAIErrorWrapperLocal(err, "decrease_user_quota_failed", http.StatusInternalServerError)
		}
	}
	return preConsumedQuota, userQuota, nil
}

func returnPreConsumedQuota(c *gin.Context, relayInfo *relaycommon.RelayInfo, userQuota int, preConsumedQuota int) {
	if preConsumedQuota != 0 {
		gopool.Go(func() {
			relayInfoCopy := *relayInfo

			err := service.PostConsumeQuota(&relayInfoCopy, -preConsumedQuota, 0, false)
			if err != nil {
				common.SysError("error return pre-consumed quota: " + err.Error())
			}
		})
	}
}

func postConsumeQuota(ctx *gin.Context, relayInfo *relaycommon.RelayInfo,
	usage *dto.Usage, preConsumedQuota int, userQuota int, priceData helper.PriceData, extraContent string) {
	// 如果是压测流量，不记录计费日志
	if ctx.GetHeader("X-Test-Traffic") == "true" {
		common.LogInfo(ctx, "test traffic detected, skipping consume log")
		return
	}
	if usage == nil {
		usage = &dto.Usage{
			PromptTokens:     relayInfo.PromptTokens,
			CompletionTokens: 0,
			TotalTokens:      relayInfo.PromptTokens,
		}
		extraContent += "（可能是请求出错）"
	}
	useTimeSeconds := time.Now().Unix() - relayInfo.StartTime.Unix()
	promptTokens := usage.PromptTokens
	cacheTokens := usage.PromptTokensDetails.CachedTokens

	completionTokens := usage.CompletionTokens
	thinkingTokens := usage.CompletionTokenDetails.ReasoningTokens
	modelName := relayInfo.OriginModelName

	tokenName := ctx.GetString("token_name")
	userName := ctx.GetString("username")
	completionRatio := priceData.CompletionRatio
	cacheRatio := priceData.CacheRatio
	ratio := priceData.ModelRatio * priceData.GroupRatio
	modelRatio := priceData.ModelRatio
	groupRatio := priceData.GroupRatio
	modelPrice := priceData.ModelPrice

	if usage.CompletionTokens+usage.PromptTokens < usage.TotalTokens {
		completionTokens = completionTokens + thinkingTokens
	}

	quota := 0
	if !priceData.UsePrice {
		quota = (promptTokens - cacheTokens) + int(math.Round(float64(cacheTokens)*cacheRatio))
		quota += int(math.Round(float64(completionTokens) * completionRatio))
		quota = int(math.Round(float64(quota) * ratio))
		if ratio != 0 && quota <= 0 {
			quota = 1
		}
	} else {
		quota = int(modelPrice * common.QuotaPerUnit * groupRatio)
	}
	totalTokens := promptTokens + completionTokens + thinkingTokens

	var logContent string
	if !priceData.UsePrice {
		logContent = fmt.Sprintf("模型倍率 %.2f，补全倍率 %.2f，分组倍率 %.2f", modelRatio, completionRatio, groupRatio)
	} else {
		logContent = fmt.Sprintf("模型价格 %.2f，分组倍率 %.2f", modelPrice, groupRatio)
	}

	// record all the consume log even if quota is 0
	if totalTokens == 0 {
		// in this case, must be some error happened
		// we cannot just return, because we may have to return the pre-consumed quota
		quota = 0
		logContent += fmt.Sprintf("（可能是上游超时）")
		common.LogError(ctx, fmt.Sprintf("total tokens is 0, cannot consume quota, userId %d, channelId %d, "+
			"tokenId %d, model %s， pre-consumed quota %d", relayInfo.UserId, relayInfo.ChannelId, relayInfo.TokenId, modelName, preConsumedQuota))
	} else {
		//if sensitiveResp != nil {
		//	logContent += fmt.Sprintf("，敏感词：%s", strings.Join(sensitiveResp.SensitiveWords, ", "))
		//}
		quotaDelta := quota - preConsumedQuota
		if quotaDelta != 0 {
			err := service.PostConsumeQuota(relayInfo, quotaDelta, preConsumedQuota, true)
			if err != nil {
				common.LogError(ctx, "error consuming token remain quota: "+err.Error())
			}
		}
		model.UpdateUserUsedQuotaAndRequestCount(relayInfo.UserId, quota)
		model.UpdateChannelUsedQuota(relayInfo.ChannelId, quota)
	}

	logModel := modelName
	if strings.HasPrefix(logModel, "gpt-4-gizmo") {
		logModel = "gpt-4-gizmo-*"
		logContent += fmt.Sprintf("，模型 %s", modelName)
	}
	if strings.HasPrefix(logModel, "gpt-4o-gizmo") {
		logModel = "gpt-4o-gizmo-*"
		logContent += fmt.Sprintf("，模型 %s", modelName)
	}
	if extraContent != "" {
		logContent += ", " + extraContent
	}

	// Record token metrics
	metrics.IncrementOutputTokens(strconv.Itoa(relayInfo.ChannelId), relayInfo.ChannelName, modelName, relayInfo.Group, strconv.Itoa(relayInfo.UserId), userName, tokenName, float64(completionTokens))

	if cacheTokens > 0 {
		metrics.IncrementCacheHitTokens(strconv.Itoa(relayInfo.ChannelId), relayInfo.ChannelName, modelName, relayInfo.Group, strconv.Itoa(relayInfo.UserId), userName, tokenName, float64(cacheTokens))
	}

	metrics.IncrementInferenceTokens(strconv.Itoa(relayInfo.ChannelId), relayInfo.ChannelName, modelName, relayInfo.Group, strconv.Itoa(relayInfo.UserId), userName, tokenName, float64(thinkingTokens))
	other := service.GenerateTextOtherInfo(ctx, relayInfo, modelRatio, groupRatio, completionRatio, cacheTokens, cacheRatio, modelPrice)
	model.RecordConsumeLog(ctx, relayInfo.UserId, relayInfo.ChannelId, promptTokens, completionTokens, thinkingTokens, logModel,
		tokenName, quota, logContent, relayInfo.TokenId, userQuota, int(useTimeSeconds), relayInfo.IsStream, relayInfo.Group, other)
}
