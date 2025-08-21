package controller

import (
	"bytes"
	"fmt"
	"io"
	"log"
	"net/http"
	"one-api/common"
	"one-api/constant"
	"one-api/dto"
	"one-api/metrics"
	"one-api/middleware"
	"one-api/model"
	"one-api/relay"
	relaycommon "one-api/relay/common"
	relayconstant "one-api/relay/constant"
	"one-api/relay/helper"
	"one-api/service"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

func relayInfoHandler(c *gin.Context, relayMode int) (*relaycommon.RelayInfo, interface{}, string, *dto.OpenAIErrorWithStatusCode) {
	switch relayMode {
	case relayconstant.RelayModeImagesGenerations:
		relayInfo, request, err := relay.ImageInfo(c)
		if err != nil {
			return nil, nil, "", err
		}
		return relayInfo, request, request.Model, nil
	case relayconstant.RelayModeAudioSpeech:
		fallthrough
	case relayconstant.RelayModeAudioTranslation:
		fallthrough
	case relayconstant.RelayModeAudioTranscription:
		relayInfo, request, err := relay.AudioInfo(c)
		if err != nil {
			return nil, nil, "", err
		}
		return relayInfo, request, request.Model, nil
	case relayconstant.RelayModeRerank:
		relayInfo, request, err := relay.EmbeddingInfo(c)
		if err != nil {
			return nil, nil, "", err
		}
		return relayInfo, request, request.Model, nil
	case relayconstant.RelayModeEmbeddings:
		relayInfo, request, err := relay.EmbeddingInfo(c)
		if err != nil {
			return nil, nil, "", err
		}
		return relayInfo, request, request.Model, nil
	default:
		relayInfo, request, err := relay.TextInfo(c)
		if err != nil {
			return nil, nil, "", err
		}
		return relayInfo, request, request.Model, nil
	}
}

func relayExecuteHandler(c *gin.Context, relayMode int, relayInfo *relaycommon.RelayInfo, request interface{}) *dto.OpenAIErrorWithStatusCode {
	var err *dto.OpenAIErrorWithStatusCode
	switch relayMode {
	case relayconstant.RelayModeImagesGenerations:
		imageRequest, ok := request.(*dto.ImageRequest)
		if !ok {
			return service.OpenAIErrorWrapperLocal(fmt.Errorf("failed assert request: %d", relayMode), "invalid_request_type", http.StatusInternalServerError)
		}
		err = relay.ImageHelper(c, relayInfo, imageRequest)
	case relayconstant.RelayModeAudioSpeech:
		fallthrough
	case relayconstant.RelayModeAudioTranslation:
		fallthrough
	case relayconstant.RelayModeAudioTranscription:
		audioRequest, ok := request.(*dto.AudioRequest)
		if !ok {
			return service.OpenAIErrorWrapperLocal(fmt.Errorf("failed assert request: %d", relayMode), "invalid_request_type", http.StatusInternalServerError)
		}
		err = relay.AudioHelper(c, relayInfo, audioRequest)
	case relayconstant.RelayModeRerank:
		rerankRequest, ok := request.(*dto.RerankRequest)
		if !ok {
			return service.OpenAIErrorWrapperLocal(fmt.Errorf("failed assert request: %d", relayMode), "invalid_request_type", http.StatusInternalServerError)
		}
		err = relay.RerankHelper(c, relayInfo, rerankRequest)
	case relayconstant.RelayModeEmbeddings:
		embeddingRequest, ok := request.(*dto.EmbeddingRequest)
		if !ok {
			return service.OpenAIErrorWrapperLocal(fmt.Errorf("failed assert request: %d", relayMode), "invalid_request_type", http.StatusInternalServerError)
		}
		err = relay.EmbeddingHelper(c, relayInfo, embeddingRequest)
	default:
		textRequest, ok := request.(*dto.GeneralOpenAIRequest)
		if !ok {
			return service.OpenAIErrorWrapperLocal(fmt.Errorf("failed assert request: %d", relayMode), "invalid_request_type", http.StatusInternalServerError)
		}
		err = relay.TextHelper(c, relayInfo, textRequest)
	}
	return err
}

func Relay(c *gin.Context) {
	startTime := time.Now()
	relayMode := relayconstant.Path2RelayMode(c.Request.URL.Path)
	requestId := c.GetString(common.RequestIdKey)
	group := c.GetString("group")
	originalModel := c.GetString("original_model")
	tokenKey := c.GetString("token_key")
	tokenName := c.GetString("token_name")
	userId := strconv.Itoa(c.GetInt("id"))
	userName := c.GetString(constant.ContextKeyUserName)
	var openaiErr *dto.OpenAIErrorWithStatusCode
	for i := 0; i <= common.RetryTimes; i++ {
		channel, err := getChannel(c, group, originalModel, i)
		if err != nil {
			common.LogError(c, err.Error())
			openaiErr = service.OpenAIErrorWrapperLocal(err, "get_channel_failed", http.StatusInternalServerError)
			break
		}
		// 设置 channel 信息到上下文
		c.Set("channel", strconv.Itoa(channel.Id))
		c.Set("channel_name", channel.Name)
		fillRelayRequest(c, channel)
		var (
			relayInfo    *relaycommon.RelayInfo
			request      interface{}
			requestModel string
		)
		relayInfo, request, requestModel, openaiErr = relayInfoHandler(c, relayMode)
		if i == 0 {
			// e2e 用户请求计数
			metrics.IncrementRelayRequestE2ETotalCounter(strconv.Itoa(channel.Id), channel.Name, requestModel, group, tokenKey, tokenName, userId, userName, 1)
		} else {
			// 重试计数
			channelTag := ""
			if channel.Tag != nil {
				channelTag = *channel.Tag
			}
			metrics.IncrementRelayRetryCounter(strconv.Itoa(channel.Id), channel.Name, channelTag, channel.GetBaseURL(), requestModel, group, userId, userName, 1)
		}
		if openaiErr == nil {
			openaiErr = executeRelayRequest(c, relayMode, relayInfo, request)
			common.LogInfo(c, fmt.Sprintf("openaiErr: %+v", openaiErr))
			if openaiErr == nil {
				metrics.IncrementRelayRequestE2ESuccessCounter(strconv.Itoa(channel.Id), channel.Name, requestModel, group, tokenKey, tokenName, userId, userName, 1)
				metrics.ObserveRelayRequestE2EDuration(strconv.Itoa(channel.Id), channel.Name, requestModel, group, tokenKey, tokenName, userId, userName, time.Since(startTime).Seconds())
				return
			}
			if strings.Contains(openaiErr.Error.Message, "No candidates returned") && originalModel == "gemini-2.5-pro" {
				originalModel = "gemini-2.5-pro-google"
			}
		}

		go processChannelError(c, channel.Id, channel.Type, channel.Name, channel.GetAutoBan(), openaiErr)

		if !shouldRetry(c, openaiErr, common.RetryTimes-i) {
			// e2e 失败计数
			metrics.IncrementRelayRequestE2EFailedCounter(strconv.Itoa(channel.Id), channel.Name, requestModel, group, strconv.Itoa(openaiErr.StatusCode), tokenKey, tokenName, userId, userName, 1)
			break
		}
	}
	useChannel := c.GetStringSlice("use_channel")
	if len(useChannel) > 1 {
		retryLogStr := fmt.Sprintf("重试：%s", strings.Trim(strings.Join(strings.Fields(fmt.Sprint(useChannel)), "->"), "[]"))
		common.LogInfo(c, retryLogStr)
	}

	if openaiErr != nil {
		if openaiErr.StatusCode == http.StatusTooManyRequests {
			common.LogError(c, fmt.Sprintf("origin 429 error: %s", openaiErr.Error.Message))
			openaiErr.Error.Message = "当前分组上游负载已饱和，请稍后再试"
		}

		// 处理自定义的 NewAPI batch 错误码
		if openaiErr.StatusCode == dto.StatusNewAPIBatchRateLimitExceeded {
			common.LogError(c, fmt.Sprintf("origin %d error: %s", openaiErr.StatusCode, openaiErr.Error.Message))
			openaiErr.Error.Message = "当前服务端限速已满，请稍后再试"
		}
		if openaiErr.StatusCode == dto.StatusNewAPIBatchTimeout {
			common.LogError(c, fmt.Sprintf("origin %d error: %s", openaiErr.StatusCode, openaiErr.Error.Message))
			openaiErr.Error.Message = "未等待到结果，请稍后使用Retry_request_id再次查询"
		}
		if openaiErr.StatusCode == dto.StatusNewAPIBatchInternal {
			common.LogError(c, fmt.Sprintf("origin %d error: %s", openaiErr.StatusCode, openaiErr.Error.Message))
			openaiErr.Error.Message = "服务内部错误，请稍后再试"
		}
		if openaiErr.StatusCode == dto.StatusNewAPIBatchSubmitted {
			common.LogError(c, fmt.Sprintf("origin %d error: %s", openaiErr.StatusCode, openaiErr.Error.Message))
			openaiErr.Error.Message = "批量请求已提交，但是结果还未出来，请使用Retry_request_id查询结果"
		}
		if openaiErr.StatusCode == dto.StatusNewAPIBatchAccepted {
			common.LogError(c, fmt.Sprintf("origin %d error: %s", openaiErr.StatusCode, openaiErr.Error.Message))
			openaiErr.Error.Message = "批量请求已接受，正在处理中，请稍后使用Retry_request_id查询结果"
		}
		if openaiErr.StatusCode == dto.StatusRequestConflict {
			common.LogError(c, fmt.Sprintf("origin %d error: %s", openaiErr.StatusCode, openaiErr.Error.Message))
			openaiErr.Error.Message = "请求冲突，有其他请求使用了这个Retry_request_id，请稍后再试"
		}

		openaiErr.Error.Message = common.MessageWithRequestId(openaiErr.Error.Message, requestId)
		c.JSON(openaiErr.StatusCode, gin.H{
			"error": openaiErr.Error,
		})
	}
}

var upgrader = websocket.Upgrader{
	Subprotocols: []string{"realtime"}, // WS 握手支持的协议，如果有使用 Sec-WebSocket-Protocol，则必须在此声明对应的 Protocol TODO add other protocol
	CheckOrigin: func(r *http.Request) bool {
		return true // 允许跨域
	},
}

func WssRelay(c *gin.Context) {
	// 将 HTTP 连接升级为 WebSocket 连接

	ws, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	defer ws.Close()

	if err != nil {
		openaiErr := service.OpenAIErrorWrapper(err, "get_channel_failed", http.StatusInternalServerError)
		helper.WssError(c, ws, openaiErr.Error)
		return
	}

	startTime := time.Now()
	relayMode := relayconstant.Path2RelayMode(c.Request.URL.Path)
	requestId := c.GetString(common.RequestIdKey)
	group := c.GetString("group")
	//wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01
	originalModel := c.GetString("original_model")
	tokenKey := c.GetString("token_key")
	tokenName := c.GetString("token_name")
	userId := c.GetString("user_id")
	userName := c.GetString("user_name")
	var openaiErr *dto.OpenAIErrorWithStatusCode

	for i := 0; i <= common.RetryTimes; i++ {
		channel, err := getChannel(c, group, originalModel, i)
		if err != nil {
			common.LogError(c, err.Error())
			openaiErr = service.OpenAIErrorWrapperLocal(err, "get_channel_failed", http.StatusInternalServerError)
			break
		}

		if i == 0 {
			// e2e 用户请求计数
			metrics.IncrementRelayRequestE2ETotalCounter(strconv.Itoa(channel.Id), channel.Name, originalModel, group, tokenKey, tokenName, userId, userName, 1)
		}

		openaiErr = wssRequest(c, ws, relayMode, channel)

		if openaiErr == nil {
			metrics.IncrementRelayRequestE2ESuccessCounter(strconv.Itoa(channel.Id), channel.Name, originalModel, group, tokenKey, tokenName, userId, userName, 1)
			metrics.ObserveRelayRequestE2EDuration(strconv.Itoa(channel.Id), channel.Name, originalModel, group, tokenKey, tokenName, userId, userName, time.Since(startTime).Seconds())
			return // 成功处理请求，直接返回
		}

		go processChannelError(c, channel.Id, channel.Type, channel.Name, channel.GetAutoBan(), openaiErr)

		if !shouldRetry(c, openaiErr, common.RetryTimes-i) {
			// e2e 失败计数
			metrics.IncrementRelayRequestE2EFailedCounter(strconv.Itoa(channel.Id), channel.Name, originalModel, group, strconv.Itoa(openaiErr.StatusCode), tokenKey, tokenName, userId, userName, 1)
			break
		}
	}
	useChannel := c.GetStringSlice("use_channel")
	if len(useChannel) > 1 {
		retryLogStr := fmt.Sprintf("重试：%s", strings.Trim(strings.Join(strings.Fields(fmt.Sprint(useChannel)), "->"), "[]"))
		common.LogInfo(c, retryLogStr)
	}

	if openaiErr != nil {
		if openaiErr.StatusCode == http.StatusTooManyRequests {
			openaiErr.Error.Message = "当前分组上游负载已饱和，请稍后再试"
		}
		// 处理自定义的 NewAPI batch 错误码
		if openaiErr.StatusCode == dto.StatusNewAPIBatchRateLimitExceeded {
			common.LogError(c, fmt.Sprintf("origin %d error: %s", openaiErr.StatusCode, openaiErr.Error.Message))
			openaiErr.Error.Message = "当前服务端限速已满，请稍后再试"
		}
		if openaiErr.StatusCode == dto.StatusNewAPIBatchTimeout {
			common.LogError(c, fmt.Sprintf("origin %d error: %s", openaiErr.StatusCode, openaiErr.Error.Message))
			openaiErr.Error.Message = "未等待到结果，请稍后使用Retry_request_id再次查询"
		}
		if openaiErr.StatusCode == dto.StatusNewAPIBatchInternal {
			common.LogError(c, fmt.Sprintf("origin %d error: %s", openaiErr.StatusCode, openaiErr.Error.Message))
			openaiErr.Error.Message = "服务内部错误，请稍后再试"
		}
		if openaiErr.StatusCode == dto.StatusNewAPIBatchSubmitted {
			common.LogError(c, fmt.Sprintf("origin %d error: %s", openaiErr.StatusCode, openaiErr.Error.Message))
			openaiErr.Error.Message = "批量请求已提交，但是结果还未出来，请使用Retry_request_id查询结果"
		}
		if openaiErr.StatusCode == dto.StatusNewAPIBatchAccepted {
			common.LogError(c, fmt.Sprintf("origin %d error: %s", openaiErr.StatusCode, openaiErr.Error.Message))
			openaiErr.Error.Message = "批量请求已接受，正在处理中，请稍后使用Retry_request_id查询结果"
		}
		if openaiErr.StatusCode == dto.StatusRequestConflict {
			common.LogError(c, fmt.Sprintf("origin %d error: %s", openaiErr.StatusCode, openaiErr.Error.Message))
			openaiErr.Error.Message = "请求冲突，有其他请求使用了这个Retry_request_id，请稍后再试"
		}
		openaiErr.Error.Message = common.MessageWithRequestId(openaiErr.Error.Message, requestId)
		helper.WssError(c, ws, openaiErr.Error)
	}
}

func fillRelayRequest(c *gin.Context, channel *model.Channel) {
	addUsedChannel(c, channel.Id)
	requestBody, _ := common.GetRequestBody(c)
	c.Request.Body = io.NopCloser(bytes.NewBuffer(requestBody))
}

func executeRelayRequest(c *gin.Context, relayMode int, relayInfo *relaycommon.RelayInfo, request interface{}) *dto.OpenAIErrorWithStatusCode {
	return relayExecuteHandler(c, relayMode, relayInfo, request)
}

func wssRequest(c *gin.Context, ws *websocket.Conn, relayMode int, channel *model.Channel) *dto.OpenAIErrorWithStatusCode {
	addUsedChannel(c, channel.Id)
	requestBody, _ := common.GetRequestBody(c)
	c.Request.Body = io.NopCloser(bytes.NewBuffer(requestBody))
	return relay.WssHelper(c, ws)
}

func addUsedChannel(c *gin.Context, channelId int) {
	useChannel := c.GetStringSlice("use_channel")
	useChannel = append(useChannel, fmt.Sprintf("%d", channelId))
	c.Set("use_channel", useChannel)
}

func getChannel(c *gin.Context, group, originalModel string, retryCount int) (*model.Channel, error) {
	if retryCount == 0 {
		autoBan := c.GetBool("auto_ban")
		autoBanInt := 1
		if !autoBan {
			autoBanInt = 0
		}
		channelTag := c.GetString("channel_tag")
		return &model.Channel{
			Id:      c.GetInt("channel_id"),
			Type:    c.GetInt("channel_type"),
			Name:    c.GetString("channel_name"),
			Tag:     &channelTag,
			AutoBan: &autoBanInt,
		}, nil
	}
	channel, err := model.CacheGetRandomSatisfiedChannel(group, originalModel, retryCount)
	if err != nil {
		return nil, fmt.Errorf("获取重试渠道失败: %s", err.Error())
	}
	middleware.SetupContextForSelectedChannel(c, channel, originalModel)
	return channel, nil
}

func shouldRetry(c *gin.Context, openaiErr *dto.OpenAIErrorWithStatusCode, retryTimes int) bool {
	if openaiErr == nil {
		return false
	}
	if openaiErr.Error.Code == "completion_tokens_zero" || strings.Contains(openaiErr.Error.Message, "No candidates returned") {
		return true
	}
	if openaiErr.LocalError {
		return false
	}
	if retryTimes <= 0 {
		return false
	}
	if _, ok := c.Get("specific_channel_id"); ok {
		return false
	}
	if strings.Contains(openaiErr.Error.Message, "deadline exceeded") ||
		strings.Contains(openaiErr.Error.Message, "request canceled") ||
		strings.Contains(openaiErr.Error.Message, "copy_response_body_failed") {
		common.LogInfo(c, fmt.Sprintf("客户端请求下游超时，不再重试 : %s", openaiErr.Error.Message))
		return false
	}
	if openaiErr.Error.Code == "copy_response_body_failed" {
		common.LogInfo(c, fmt.Sprintf("客户端连接断开，不再重试 : %s", openaiErr.Error.Message))
		return false
	}

	if openaiErr.StatusCode == http.StatusTooManyRequests {
		return true
	}
	// 处理自定义的 NewAPI batch 错误码
	if openaiErr.StatusCode == dto.StatusNewAPIBatchRateLimitExceeded {
		return false
	}
	if openaiErr.StatusCode == dto.StatusNewAPIBatchTimeout {
		return false
	}
	if openaiErr.StatusCode == dto.StatusNewAPIBatchInternal {
		return false
	}
	if openaiErr.StatusCode == dto.StatusNewAPIBatchSubmitted {
		return false
	}
	if openaiErr.StatusCode == dto.StatusNewAPIBatchAccepted {
		return false
	}
	if openaiErr.StatusCode == dto.StatusRequestConflict {
		return false
	}

	if openaiErr.StatusCode == 307 {
		return true
	}

	if openaiErr.StatusCode/100 == 5 {
		// 超时不重试
		if openaiErr.StatusCode == 504 || openaiErr.StatusCode == 524 {
			return false
		}
		return true
	}
	if openaiErr.StatusCode == http.StatusBadRequest {
		channelType := c.GetInt("channel_type")
		if channelType == common.ChannelTypeAnthropic {
			return true
		}
		return false
	}
	if openaiErr.StatusCode == 408 {
		// azure处理超时不重试
		return false
	}
	if openaiErr.StatusCode/100 == 2 {
		return false
	}
	return true
}

func processChannelError(c *gin.Context, channelId int, channelType int, channelName string, autoBan bool, err *dto.OpenAIErrorWithStatusCode) {
	// 不要使用context获取渠道信息，异步处理时可能会出现渠道信息不一致的情况
	// do not use context to get channel info, there may be inconsistent channel info when processing asynchronously
	common.LogError(c, fmt.Sprintf("relay error (channel #%d, status code: %d): %s", channelId, err.StatusCode, err.Error.Message))
	if service.ShouldDisableChannel(channelType, err) && autoBan {
		service.DisableChannel(channelId, channelName, err.Error.Message)
	}
}

func RelayMidjourney(c *gin.Context) {
	relayMode := c.GetInt("relay_mode")
	var err *dto.MidjourneyResponse
	switch relayMode {
	case relayconstant.RelayModeMidjourneyNotify:
		err = relay.RelayMidjourneyNotify(c)
	case relayconstant.RelayModeMidjourneyTaskFetch, relayconstant.RelayModeMidjourneyTaskFetchByCondition:
		err = relay.RelayMidjourneyTask(c, relayMode)
	case relayconstant.RelayModeMidjourneyTaskImageSeed:
		err = relay.RelayMidjourneyTaskImageSeed(c)
	case relayconstant.RelayModeSwapFace:
		err = relay.RelaySwapFace(c)
	default:
		err = relay.RelayMidjourneySubmit(c, relayMode)
	}
	//err = relayMidjourneySubmit(c, relayMode)
	log.Println(err)
	if err != nil {
		statusCode := http.StatusBadRequest
		if err.Code == 30 {
			err.Result = "当前分组负载已饱和，请稍后再试，或升级账户以提升服务质量。"
			statusCode = http.StatusTooManyRequests
		}
		c.JSON(statusCode, gin.H{
			"description": fmt.Sprintf("%s %s", err.Description, err.Result),
			"type":        "upstream_error",
			"code":        err.Code,
		})
		channelId := c.GetInt("channel_id")
		common.LogError(c, fmt.Sprintf("relay error (channel #%d, status code %d): %s", channelId, statusCode, fmt.Sprintf("%s %s", err.Description, err.Result)))
	}
}

func RelayNotImplemented(c *gin.Context) {
	err := dto.OpenAIError{
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
	err := dto.OpenAIError{
		Message: fmt.Sprintf("Invalid URL (%s %s)", c.Request.Method, c.Request.URL.Path),
		Type:    "invalid_request_error",
		Param:   "",
		Code:    "",
	}
	c.JSON(http.StatusNotFound, gin.H{
		"error": err,
	})
}

func RelayTask(c *gin.Context) {
	retryTimes := common.RetryTimes
	channelId := c.GetInt("channel_id")
	relayMode := c.GetInt("relay_mode")
	group := c.GetString("group")
	originalModel := c.GetString("original_model")
	c.Set("use_channel", []string{fmt.Sprintf("%d", channelId)})
	taskErr := taskRelayHandler(c, relayMode)
	if taskErr == nil {
		retryTimes = 0
	}
	for i := 0; shouldRetryTaskRelay(c, channelId, taskErr, retryTimes) && i < retryTimes; i++ {
		channel, err := model.CacheGetRandomSatisfiedChannel(group, originalModel, i)
		if err != nil {
			common.LogError(c, fmt.Sprintf("CacheGetRandomSatisfiedChannel failed: %s", err.Error()))
			break
		}
		channelId = channel.Id
		useChannel := c.GetStringSlice("use_channel")
		useChannel = append(useChannel, fmt.Sprintf("%d", channelId))
		c.Set("use_channel", useChannel)
		common.LogInfo(c, fmt.Sprintf("using channel #%d to retry (remain times %d)", channel.Id, i))
		middleware.SetupContextForSelectedChannel(c, channel, originalModel)

		requestBody, err := common.GetRequestBody(c)
		c.Request.Body = io.NopCloser(bytes.NewBuffer(requestBody))
		taskErr = taskRelayHandler(c, relayMode)
	}
	useChannel := c.GetStringSlice("use_channel")
	if len(useChannel) > 1 {
		retryLogStr := fmt.Sprintf("重试：%s", strings.Trim(strings.Join(strings.Fields(fmt.Sprint(useChannel)), "->"), "[]"))
		common.LogInfo(c, retryLogStr)
	}
	if taskErr != nil {
		if taskErr.StatusCode == http.StatusTooManyRequests {
			taskErr.Message = "当前分组上游负载已饱和，请稍后再试"
		}
		c.JSON(taskErr.StatusCode, taskErr)
	}
}

func taskRelayHandler(c *gin.Context, relayMode int) *dto.TaskError {
	var err *dto.TaskError
	switch relayMode {
	case relayconstant.RelayModeSunoFetch, relayconstant.RelayModeSunoFetchByID:
		err = relay.RelayTaskFetch(c, relayMode)
	default:
		err = relay.RelayTaskSubmit(c, relayMode)
	}
	return err
}

func shouldRetryTaskRelay(c *gin.Context, channelId int, taskErr *dto.TaskError, retryTimes int) bool {
	if taskErr == nil {
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
		if taskErr.StatusCode == 504 || taskErr.StatusCode == 524 {
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
