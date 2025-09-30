package controller

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/http/httptest"
	"net/url"
	"one-api/common"
	"one-api/constant"
	"one-api/dto"
	"one-api/middleware"
	"one-api/model"
	"one-api/relay"
	relaycommon "one-api/relay/common"
	relayconstant "one-api/relay/constant"
	"one-api/relay/helper"
	"one-api/service"
	"one-api/setting/operation_setting"
	"one-api/types"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/bytedance/gopkg/util/gopool"

	"github.com/gin-gonic/gin"
)

type testResult struct {
	context     *gin.Context
	localErr    error
	newAPIError *types.NewAPIError
}

func testChannel(channel *model.Channel, testModel string, endpointType string) testResult {
	tik := time.Now()
	if channel.Type == constant.ChannelTypeMidjourney {
		return testResult{
			localErr:    errors.New("midjourney channel test is not supported"),
			newAPIError: nil,
		}
	}
	if channel.Type == constant.ChannelTypeMidjourneyPlus {
		return testResult{
			localErr:    errors.New("midjourney plus channel test is not supported"),
			newAPIError: nil,
		}
	}
	if channel.Type == constant.ChannelTypeSunoAPI {
		return testResult{
			localErr:    errors.New("suno channel test is not supported"),
			newAPIError: nil,
		}
	}
	if channel.Type == constant.ChannelTypeKling {
		return testResult{
			localErr:    errors.New("kling channel test is not supported"),
			newAPIError: nil,
		}
	}
	if channel.Type == constant.ChannelTypeJimeng {
		return testResult{
			localErr:    errors.New("jimeng channel test is not supported"),
			newAPIError: nil,
		}
	}
	if channel.Type == constant.ChannelTypeVidu {
		return testResult{
			localErr:    errors.New("vidu channel test is not supported"),
			newAPIError: nil,
		}
	}
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	requestPath := "/v1/chat/completions"

	// 如果指定了端点类型，使用指定的端点类型
	if endpointType != "" {
		if endpointInfo, ok := common.GetDefaultEndpointInfo(constant.EndpointType(endpointType)); ok {
			requestPath = endpointInfo.Path
		}
	} else {
		// 如果没有指定端点类型，使用原有的自动检测逻辑
		// 先判断是否为 Embedding 模型
		if strings.Contains(strings.ToLower(testModel), "embedding") ||
			strings.HasPrefix(testModel, "m3e") || // m3e 系列模型
			strings.Contains(testModel, "bge-") || // bge 系列模型
			strings.Contains(testModel, "embed") ||
			channel.Type == constant.ChannelTypeMokaAI { // 其他 embedding 模型
			requestPath = "/v1/embeddings" // 修改请求路径
		}

		// VolcEngine 图像生成模型
		if channel.Type == constant.ChannelTypeVolcEngine && strings.Contains(testModel, "seedream") {
			requestPath = "/v1/images/generations"
		}
	}

	c.Request = &http.Request{
		Method: "POST",
		URL:    &url.URL{Path: requestPath}, // 使用动态路径
		Body:   nil,
		Header: make(http.Header),
	}

	if testModel == "" {
		if channel.TestModel != nil && *channel.TestModel != "" {
			testModel = *channel.TestModel
		} else {
			if len(channel.GetModels()) > 0 {
				testModel = channel.GetModels()[0]
			} else {
				testModel = "gpt-4o-mini"
			}
		}
	}

	cache, err := model.GetUserCache(1)
	if err != nil {
		return testResult{
			localErr:    err,
			newAPIError: nil,
		}
	}
	cache.WriteContext(c)

	//c.Request.Header.Set("Authorization", "Bearer "+channel.Key)
	c.Request.Header.Set("Content-Type", "application/json")
	c.Set("channel", channel.Type)
	c.Set("base_url", channel.GetBaseURL())
	group, _ := model.GetUserGroup(1, false)
	c.Set("group", group)

	newAPIError := middleware.SetupContextForSelectedChannel(c, channel, testModel)
	if newAPIError != nil {
		return testResult{
			context:     c,
			localErr:    newAPIError,
			newAPIError: newAPIError,
		}
	}

	// Determine relay format based on endpoint type or request path
	var relayFormat types.RelayFormat
	if endpointType != "" {
		// 根据指定的端点类型设置 relayFormat
		switch constant.EndpointType(endpointType) {
		case constant.EndpointTypeOpenAI:
			relayFormat = types.RelayFormatOpenAI
		case constant.EndpointTypeOpenAIResponse:
			relayFormat = types.RelayFormatOpenAIResponses
		case constant.EndpointTypeAnthropic:
			relayFormat = types.RelayFormatClaude
		case constant.EndpointTypeGemini:
			relayFormat = types.RelayFormatGemini
		case constant.EndpointTypeJinaRerank:
			relayFormat = types.RelayFormatRerank
		case constant.EndpointTypeImageGeneration:
			relayFormat = types.RelayFormatOpenAIImage
		case constant.EndpointTypeEmbeddings:
			relayFormat = types.RelayFormatEmbedding
		default:
			relayFormat = types.RelayFormatOpenAI
		}
	} else {
		// 根据请求路径自动检测
		relayFormat = types.RelayFormatOpenAI
		if c.Request.URL.Path == "/v1/embeddings" {
			relayFormat = types.RelayFormatEmbedding
		}
		if c.Request.URL.Path == "/v1/images/generations" {
			relayFormat = types.RelayFormatOpenAIImage
		}
		if c.Request.URL.Path == "/v1/messages" {
			relayFormat = types.RelayFormatClaude
		}
		if strings.Contains(c.Request.URL.Path, "/v1beta/models") {
			relayFormat = types.RelayFormatGemini
		}
		if c.Request.URL.Path == "/v1/rerank" || c.Request.URL.Path == "/rerank" {
			relayFormat = types.RelayFormatRerank
		}
		if c.Request.URL.Path == "/v1/responses" {
			relayFormat = types.RelayFormatOpenAIResponses
		}
	}

	request := buildTestRequest(testModel, endpointType)

	info, err := relaycommon.GenRelayInfo(c, relayFormat, request, nil)

	if err != nil {
		return testResult{
			context:     c,
			localErr:    err,
			newAPIError: types.NewError(err, types.ErrorCodeGenRelayInfoFailed),
		}
	}

	info.InitChannelMeta(c)

	err = helper.ModelMappedHelper(c, info, request)
	if err != nil {
		return testResult{
			context:     c,
			localErr:    err,
			newAPIError: types.NewError(err, types.ErrorCodeChannelModelMappedError),
		}
	}

	testModel = info.UpstreamModelName
	// 更新请求中的模型名称
	request.SetModelName(testModel)

	apiType, _ := common.ChannelType2APIType(channel.Type)
	adaptor := relay.GetAdaptor(apiType)
	if adaptor == nil {
		return testResult{
			context:     c,
			localErr:    fmt.Errorf("invalid api type: %d, adaptor is nil", apiType),
			newAPIError: types.NewError(fmt.Errorf("invalid api type: %d, adaptor is nil", apiType), types.ErrorCodeInvalidApiType),
		}
	}

	//// 创建一个用于日志的 info 副本，移除 ApiKey
	//logInfo := info
	//logInfo.ApiKey = ""
	common.SysLog(fmt.Sprintf("testing channel %d with model %s , info %+v ", channel.Id, testModel, info.ToString()))

	priceData, err := helper.ModelPriceHelper(c, info, 0, request.GetTokenCountMeta())
	if err != nil {
		return testResult{
			context:     c,
			localErr:    err,
			newAPIError: types.NewError(err, types.ErrorCodeModelPriceError),
		}
	}

	adaptor.Init(info)

	var convertedRequest any
	// 根据 RelayMode 选择正确的转换函数
	switch info.RelayMode {
	case relayconstant.RelayModeEmbeddings:
		// Embedding 请求 - request 已经是正确的类型
		if embeddingReq, ok := request.(*dto.EmbeddingRequest); ok {
			convertedRequest, err = adaptor.ConvertEmbeddingRequest(c, info, *embeddingReq)
		} else {
			return testResult{
				context:     c,
				localErr:    errors.New("invalid embedding request type"),
				newAPIError: types.NewError(errors.New("invalid embedding request type"), types.ErrorCodeConvertRequestFailed),
			}
		}
	case relayconstant.RelayModeImagesGenerations:
		// 图像生成请求 - request 已经是正确的类型
		if imageReq, ok := request.(*dto.ImageRequest); ok {
			convertedRequest, err = adaptor.ConvertImageRequest(c, info, *imageReq)
		} else {
			return testResult{
				context:     c,
				localErr:    errors.New("invalid image request type"),
				newAPIError: types.NewError(errors.New("invalid image request type"), types.ErrorCodeConvertRequestFailed),
			}
		}
	case relayconstant.RelayModeRerank:
		// Rerank 请求 - request 已经是正确的类型
		if rerankReq, ok := request.(*dto.RerankRequest); ok {
			convertedRequest, err = adaptor.ConvertRerankRequest(c, info.RelayMode, *rerankReq)
		} else {
			return testResult{
				context:     c,
				localErr:    errors.New("invalid rerank request type"),
				newAPIError: types.NewError(errors.New("invalid rerank request type"), types.ErrorCodeConvertRequestFailed),
			}
		}
	case relayconstant.RelayModeResponses:
		// Response 请求 - request 已经是正确的类型
		if responseReq, ok := request.(*dto.OpenAIResponsesRequest); ok {
			convertedRequest, err = adaptor.ConvertOpenAIResponsesRequest(c, info, *responseReq)
		} else {
			return testResult{
				context:     c,
				localErr:    errors.New("invalid response request type"),
				newAPIError: types.NewError(errors.New("invalid response request type"), types.ErrorCodeConvertRequestFailed),
			}
		}
	default:
		// Chat/Completion 等其他请求类型
		if generalReq, ok := request.(*dto.GeneralOpenAIRequest); ok {
			convertedRequest, err = adaptor.ConvertOpenAIRequest(c, info, generalReq)
		} else {
			return testResult{
				context:     c,
				localErr:    errors.New("invalid general request type"),
				newAPIError: types.NewError(errors.New("invalid general request type"), types.ErrorCodeConvertRequestFailed),
			}
		}
	}

	if err != nil {
		return testResult{
			context:     c,
			localErr:    err,
			newAPIError: types.NewError(err, types.ErrorCodeConvertRequestFailed),
		}
	}
	jsonData, err := json.Marshal(convertedRequest)
	if err != nil {
		return testResult{
			context:     c,
			localErr:    err,
			newAPIError: types.NewError(err, types.ErrorCodeJsonMarshalFailed),
		}
	}
	requestBody := bytes.NewBuffer(jsonData)
	c.Request.Body = io.NopCloser(requestBody)
	resp, err := adaptor.DoRequest(c, info, requestBody)
	if err != nil {
		return testResult{
			context:     c,
			localErr:    err,
			newAPIError: types.NewOpenAIError(err, types.ErrorCodeDoRequestFailed, http.StatusInternalServerError),
		}
	}
	var httpResp *http.Response
	if resp != nil {
		httpResp = resp.(*http.Response)
		if httpResp.StatusCode != http.StatusOK {
			err := service.RelayErrorHandler(c.Request.Context(), httpResp, true)
			return testResult{
				context:     c,
				localErr:    err,
				newAPIError: types.NewOpenAIError(err, types.ErrorCodeBadResponse, http.StatusInternalServerError),
			}
		}
	}
	usageA, respErr := adaptor.DoResponse(c, httpResp, info)
	if respErr != nil {
		return testResult{
			context:     c,
			localErr:    respErr,
			newAPIError: respErr,
		}
	}
	if usageA == nil {
		return testResult{
			context:     c,
			localErr:    errors.New("usage is nil"),
			newAPIError: types.NewOpenAIError(errors.New("usage is nil"), types.ErrorCodeBadResponseBody, http.StatusInternalServerError),
		}
	}
	usage := usageA.(*dto.Usage)
	result := w.Result()
	respBody, err := io.ReadAll(result.Body)
	if err != nil {
		return testResult{
			context:     c,
			localErr:    err,
			newAPIError: types.NewOpenAIError(err, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError),
		}
	}
	info.PromptTokens = usage.PromptTokens

	quota := 0
	if !priceData.UsePrice {
		quota = usage.PromptTokens + int(math.Round(float64(usage.CompletionTokens)*priceData.CompletionRatio))
		quota = int(math.Round(float64(quota) * priceData.ModelRatio))
		if priceData.ModelRatio != 0 && quota <= 0 {
			quota = 1
		}
	} else {
		quota = int(priceData.ModelPrice * common.QuotaPerUnit)
	}
	tok := time.Now()
	milliseconds := tok.Sub(tik).Milliseconds()
	consumedTime := float64(milliseconds) / 1000.0
	other := service.GenerateTextOtherInfo(c, info, priceData.ModelRatio, priceData.GroupRatioInfo.GroupRatio, priceData.CompletionRatio,
		usage.PromptTokensDetails.CachedTokens, priceData.CacheRatio, priceData.ModelPrice, priceData.GroupRatioInfo.GroupSpecialRatio)
	model.RecordConsumeLog(c, 1, model.RecordConsumeLogParams{
		ChannelId:        channel.Id,
		PromptTokens:     usage.PromptTokens,
		CompletionTokens: usage.CompletionTokens,
		ModelName:        info.OriginModelName,
		TokenName:        "模型测试",
		Quota:            quota,
		Content:          "模型测试",
		UseTimeSeconds:   int(consumedTime),
		IsStream:         info.IsStream,
		Group:            info.UsingGroup,
		Other:            other,
	})
	common.SysLog(fmt.Sprintf("testing channel #%d, response: \n%s", channel.Id, string(respBody)))
	return testResult{
		context:     c,
		localErr:    nil,
		newAPIError: nil,
	}
}

func buildTestRequest(model string, endpointType string) dto.Request {
	// 根据端点类型构建不同的测试请求
	if endpointType != "" {
		switch constant.EndpointType(endpointType) {
		case constant.EndpointTypeEmbeddings:
			// 返回 EmbeddingRequest
			return &dto.EmbeddingRequest{
				Model: model,
				Input: []any{"hello world"},
			}
		case constant.EndpointTypeImageGeneration:
			// 返回 ImageRequest
			return &dto.ImageRequest{
				Model:  model,
				Prompt: "a cute cat",
				N:      1,
				Size:   "1024x1024",
			}
		case constant.EndpointTypeJinaRerank:
			// 返回 RerankRequest
			return &dto.RerankRequest{
				Model:     model,
				Query:     "What is Deep Learning?",
				Documents: []any{"Deep Learning is a subset of machine learning.", "Machine learning is a field of artificial intelligence."},
				TopN:      2,
			}
		case constant.EndpointTypeOpenAIResponse:
			// 返回 OpenAIResponsesRequest
			return &dto.OpenAIResponsesRequest{
				Model: model,
				Input: json.RawMessage("\"hi\""),
			}
		case constant.EndpointTypeAnthropic, constant.EndpointTypeGemini, constant.EndpointTypeOpenAI:
			// 返回 GeneralOpenAIRequest
			maxTokens := uint(10)
			if constant.EndpointType(endpointType) == constant.EndpointTypeGemini {
				maxTokens = 3000
			}
			return &dto.GeneralOpenAIRequest{
				Model:  model,
				Stream: false,
				Messages: []dto.Message{
					{
						Role:    "user",
						Content: "hi",
					},
				},
				MaxTokens: maxTokens,
			}
		}
	}

	// 自动检测逻辑（保持原有行为）
	// 先判断是否为 Embedding 模型
	if strings.Contains(strings.ToLower(model), "embedding") ||
		strings.HasPrefix(model, "m3e") ||
		strings.Contains(model, "bge-") {
		// 返回 EmbeddingRequest
		return &dto.EmbeddingRequest{
			Model: model,
			Input: []any{"hello world"},
		}
	}

	// Chat/Completion 请求 - 返回 GeneralOpenAIRequest
	testRequest := &dto.GeneralOpenAIRequest{
		Model:  model,
		Stream: false,
		Messages: []dto.Message{
			{
				Role:    "user",
				Content: "hi",
			},
		},
	}

	if strings.HasPrefix(model, "o") {
		testRequest.MaxCompletionTokens = 10
	} else if strings.Contains(model, "thinking") {
		if !strings.Contains(model, "claude") {
			testRequest.MaxTokens = 50
		}
	} else if strings.Contains(model, "gemini") {
		testRequest.MaxTokens = 3000
	} else {
		testRequest.MaxTokens = 10
	}

	return testRequest
}

func TestChannel(c *gin.Context) {
	channelId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	channel, err := model.CacheGetChannel(channelId)
	if err != nil {
		channel, err = model.GetChannelById(channelId, true)
		if err != nil {
			common.ApiError(c, err)
			return
		}
	}
	//defer func() {
	//	if channel.ChannelInfo.IsMultiKey {
	//		go func() { _ = channel.SaveChannelInfo() }()
	//	}
	//}()
	testModel := c.Query("model")
	endpointType := c.Query("endpoint_type")
	tik := time.Now()
	result := testChannel(channel, testModel, endpointType)
	if result.localErr != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": result.localErr.Error(),
			"time":    0.0,
		})
		return
	}
	tok := time.Now()
	milliseconds := tok.Sub(tik).Milliseconds()
	go channel.UpdateResponseTime(milliseconds)
	consumedTime := float64(milliseconds) / 1000.0
	if result.newAPIError != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": result.newAPIError.Error(),
			"time":    consumedTime,
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"time":    consumedTime,
	})
}

var testAllChannelsLock sync.Mutex
var testAllChannelsRunning bool = false

func testAllChannels(notify bool) error {

	testAllChannelsLock.Lock()
	if testAllChannelsRunning {
		testAllChannelsLock.Unlock()
		return errors.New("测试已在运行中")
	}
	testAllChannelsRunning = true
	testAllChannelsLock.Unlock()
	channels, getChannelErr := model.GetAllChannels(0, 0, true, false)
	if getChannelErr != nil {
		return getChannelErr
	}
	var disableThreshold = int64(common.ChannelDisableThreshold * 1000)
	if disableThreshold == 0 {
		disableThreshold = 10000000 // a impossible value
	}
	gopool.Go(func() {
		// 使用 defer 确保无论如何都会重置运行状态，防止死锁
		defer func() {
			testAllChannelsLock.Lock()
			testAllChannelsRunning = false
			testAllChannelsLock.Unlock()
		}()

		for _, channel := range channels {
			isChannelEnabled := channel.Status == common.ChannelStatusEnabled
			tik := time.Now()
			result := testChannel(channel, "", "")
			tok := time.Now()
			milliseconds := tok.Sub(tik).Milliseconds()

			shouldBanChannel := false
			newAPIError := result.newAPIError
			// request error disables the channel
			if newAPIError != nil {
				shouldBanChannel = service.ShouldDisableChannel(channel.Type, result.newAPIError)
			}

			// 当错误检查通过，才检查响应时间
			if common.AutomaticDisableChannelEnabled && !shouldBanChannel {
				if milliseconds > disableThreshold {
					err := fmt.Errorf("响应时间 %.2fs 超过阈值 %.2fs", float64(milliseconds)/1000.0, float64(disableThreshold)/1000.0)
					newAPIError = types.NewOpenAIError(err, types.ErrorCodeChannelResponseTimeExceeded, http.StatusRequestTimeout)
					shouldBanChannel = true
				}
			}

			// disable channel
			if isChannelEnabled && shouldBanChannel && channel.GetAutoBan() {
				processChannelError(result.context, *types.NewChannelError(channel.Id, channel.Type, channel.Name, channel.ChannelInfo.IsMultiKey, common.GetContextKeyString(result.context, constant.ContextKeyChannelKey), channel.GetAutoBan()), newAPIError)
			}

			// enable channel
			if !isChannelEnabled && service.ShouldEnableChannel(newAPIError, channel.Status) {
				service.EnableChannel(channel.Id, common.GetContextKeyString(result.context, constant.ContextKeyChannelKey), channel.Name)
			}

			channel.UpdateResponseTime(milliseconds)
			time.Sleep(common.RequestInterval)
		}

		if notify {
			service.NotifyRootUser(dto.NotifyTypeChannelTest, "通道测试完成", "所有通道测试已完成")
		}
	})
	return nil
}

func TestAllChannels(c *gin.Context) {
	err := testAllChannels(true)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
}

var autoTestChannelsOnce sync.Once

func AutomaticallyTestChannels() {
	autoTestChannelsOnce.Do(func() {
		for {
			if !operation_setting.GetMonitorSetting().AutoTestChannelEnabled {
				time.Sleep(10 * time.Minute)
				continue
			}
			frequency := operation_setting.GetMonitorSetting().AutoTestChannelMinutes
			common.SysLog(fmt.Sprintf("automatically test channels with interval %d minutes", frequency))
			for {
				time.Sleep(time.Duration(frequency) * time.Minute)
				common.SysLog("automatically testing all channels")
				_ = testAllChannels(false)
				common.SysLog("automatically channel test finished")
				if !operation_setting.GetMonitorSetting().AutoTestChannelEnabled {
					break
				}
			}
		}
	})
}
