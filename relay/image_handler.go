package relay

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/relay/channel/openai/image_stream"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

func ImageHelper(c *gin.Context, info *relaycommon.RelayInfo) (newAPIError *types.NewAPIError) {
	info.InitChannelMeta(c)

	imageReq, ok := info.Request.(*dto.ImageRequest)
	if !ok {
		return types.NewErrorWithStatusCode(fmt.Errorf("invalid request type, expected dto.ImageRequest, got %T", info.Request), types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}

	request, err := common.DeepCopy(imageReq)
	if err != nil {
		return types.NewError(fmt.Errorf("failed to copy request to ImageRequest: %w", err), types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
	}
	// DeepCopy uses the provider-facing JSON shape, which intentionally omits
	// gateway-only async controls. Restore them from the validated request.
	request.Async = imageReq.Async
	request.WebhookURL = imageReq.WebhookURL
	request.WebhookSecret = imageReq.WebhookSecret
	if len(imageReq.Extra) > 0 {
		request.Extra = make(map[string]json.RawMessage, len(imageReq.Extra))
		for key, value := range imageReq.Extra {
			request.Extra[key] = append(json.RawMessage(nil), value...)
		}
	}

	err = helper.ModelMappedHelper(c, info, request)
	if err != nil {
		return types.NewError(err, types.ErrorCodeChannelModelMappedError, types.ErrOptionWithSkipRetry())
	}

	// Every image generation is submitted as a durable gateway task. gpt-image
	// keeps its Responses/SSE executor only on a plain OpenAI-compatible channel.
	// Routed channels must retain their adaptor-specific URL and authentication.
	if info.RelayMode == relayconstant.RelayModeImagesGenerations {
		passThrough := model_setting.GetGlobalSettings().PassThroughRequestEnabled || info.ChannelSetting.PassThroughBodyEnabled
		if image_stream.IsGptImageModel(request.Model) &&
			info.ChannelType == constant.ChannelTypeOpenAI &&
			len(info.HeadersOverride) == 0 &&
			info.Organization == "" &&
			!passThrough {
			return image_stream.SubmitAsyncImage(c, info, request)
		}

		prepared, apiErr := prepareAsyncImageAdaptorRequest(c, info, request)
		if apiErr != nil {
			return apiErr
		}
		return image_stream.SubmitAsyncImage(c, info, request, prepared)
	}
	if image_stream.IsGptImageModel(request.Model) && info.RelayMode == relayconstant.RelayModeImagesEdits {
		return image_stream.HandleImageStream(c, info, request)
	}

	adaptor := GetAdaptor(info.ApiType)
	if adaptor == nil {
		return types.NewError(fmt.Errorf("invalid api type: %d", info.ApiType), types.ErrorCodeInvalidApiType, types.ErrOptionWithSkipRetry())
	}
	adaptor.Init(info)

	var requestBody io.Reader

	if model_setting.GetGlobalSettings().PassThroughRequestEnabled || info.ChannelSetting.PassThroughBodyEnabled {
		storage, err := common.GetBodyStorage(c)
		if err != nil {
			return types.NewErrorWithStatusCode(err, types.ErrorCodeReadRequestBodyFailed, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
		}
		requestBody = common.ReaderOnly(storage)
	} else {
		convertedRequest, err := adaptor.ConvertImageRequest(c, info, *request)
		if err != nil {
			return types.NewError(err, types.ErrorCodeConvertRequestFailed)
		}
		relaycommon.AppendRequestConversionFromRequest(info, convertedRequest)

		switch convertedRequest.(type) {
		case *bytes.Buffer:
			requestBody = convertedRequest.(io.Reader)
		default:
			jsonData, err := common.Marshal(convertedRequest)
			if err != nil {
				return types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
			}

			// apply param override
			if len(info.ParamOverride) > 0 {
				jsonData, err = relaycommon.ApplyParamOverrideWithRelayInfo(jsonData, info)
				if err != nil {
					return newAPIErrorFromParamOverride(err)
				}
			}

			logger.LogDebug(c, "image request body: %s", jsonData)
			body, size, closer, err := relaycommon.NewOutboundJSONBody(jsonData)
			if err != nil {
				return types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
			}
			defer closer.Close()
			jsonData = nil
			info.UpstreamRequestBodySize = size
			requestBody = body
		}
	}

	statusCodeMappingStr := c.GetString("status_code_mapping")

	resp, err := adaptor.DoRequest(c, info, requestBody)
	if err != nil {
		return types.NewOpenAIError(err, types.ErrorCodeDoRequestFailed, http.StatusInternalServerError)
	}
	var httpResp *http.Response
	if resp != nil {
		httpResp = resp.(*http.Response)
		info.IsStream = info.IsStream || strings.HasPrefix(httpResp.Header.Get("Content-Type"), "text/event-stream")
		if httpResp.StatusCode != http.StatusOK {
			if httpResp.StatusCode == http.StatusCreated && info.ApiType == constant.APITypeReplicate {
				// replicate channel returns 201 Created when using Prefer: wait, treat it as success.
				httpResp.StatusCode = http.StatusOK
			} else {
				newAPIError = service.RelayErrorHandler(c.Request.Context(), httpResp, false)
				// reset status code 重置状态码
				service.ResetStatusCode(newAPIError, statusCodeMappingStr)
				return newAPIError
			}
		}
	}

	usage, newAPIError := adaptor.DoResponse(c, httpResp, info)
	if newAPIError != nil {
		// reset status code 重置状态码
		service.ResetStatusCode(newAPIError, statusCodeMappingStr)
		return newAPIError
	}

	imageN := uint(1)
	if request.N != nil {
		imageN = *request.N
	}

	if usage.(*dto.Usage).TotalTokens == 0 {
		usage.(*dto.Usage).TotalTokens = 1
	}
	if usage.(*dto.Usage).PromptTokens == 0 {
		usage.(*dto.Usage).PromptTokens = 1
	}

	quality := request.Quality
	if quality == "" {
		quality = "standard"
	}

	var logContent []string

	if len(request.Size) > 0 {
		logContent = append(logContent, fmt.Sprintf("大小 %s", request.Size))
	}
	if len(quality) > 0 {
		logContent = append(logContent, fmt.Sprintf("品质 %s", quality))
	}
	if imageN > 0 {
		logContent = append(logContent, fmt.Sprintf("生成数量 %d", imageN))
	}

	service.PostTextConsumeQuota(c, info, usage.(*dto.Usage), logContent)
	return nil
}

func prepareAsyncImageAdaptorRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.ImageRequest) (*image_stream.PreparedAsyncImageRequest, *types.NewAPIError) {
	adaptor := GetAdaptor(info.ApiType)
	if adaptor == nil {
		return nil, types.NewError(fmt.Errorf("invalid api type: %d", info.ApiType), types.ErrorCodeInvalidApiType, types.ErrOptionWithSkipRetry())
	}
	adaptor.Init(info)

	providerRequest := *request
	providerRequest.Async = nil
	providerRequest.WebhookURL = ""
	providerRequest.WebhookSecret = ""
	providerRequest.Stream = nil
	// Async delivery always returns durable object-storage URLs. Asking the
	// provider for URLs avoids checkpointing large base64 payloads when the
	// provider supports both forms; providers such as Gemini may still return
	// base64 and are normalized by the worker.
	providerRequest.ResponseFormat = "url"

	var body []byte
	passThroughRequested := model_setting.GetGlobalSettings().PassThroughRequestEnabled || info.ChannelSetting.PassThroughBodyEnabled
	// Raw pass-through is only protocol-compatible with OpenAI-style image
	// channels. Provider-specific adaptors still need conversion to establish
	// their request path and body shape (for example Replicate's predictions API).
	passThrough := passThroughRequested && info.ApiType == constant.APITypeOpenAI
	if passThrough {
		storage, err := common.GetBodyStorage(c)
		if err != nil {
			return nil, types.NewErrorWithStatusCode(err, types.ErrorCodeReadRequestBodyFailed, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
		}
		raw, err := storage.Bytes()
		if err != nil {
			return nil, types.NewErrorWithStatusCode(err, types.ErrorCodeReadRequestBodyFailed, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
		}
		body, err = image_stream.SanitizeAsyncImageRequestBody(raw)
		if err != nil {
			return nil, types.NewErrorWithStatusCode(err, types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
		}
		var fields map[string]json.RawMessage
		if err := common.Unmarshal(body, &fields); err != nil {
			return nil, types.NewErrorWithStatusCode(err, types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
		}
		mappedModel, err := common.Marshal(providerRequest.Model)
		if err != nil {
			return nil, types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
		}
		fields["model"] = mappedModel
		body, err = common.Marshal(fields)
		if err != nil {
			return nil, types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
		}
	} else {
		convertedRequest, err := adaptor.ConvertImageRequest(c, info, providerRequest)
		if err != nil {
			return nil, types.NewError(err, types.ErrorCodeConvertRequestFailed)
		}
		relaycommon.AppendRequestConversionFromRequest(info, convertedRequest)
		if convertedBuffer, ok := convertedRequest.(*bytes.Buffer); ok {
			body = append([]byte(nil), convertedBuffer.Bytes()...)
		} else {
			body, err = common.Marshal(convertedRequest)
			if err != nil {
				return nil, types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
			}
			if len(info.ParamOverride) > 0 {
				body, err = relaycommon.ApplyParamOverrideWithRelayInfo(body, info)
				if err != nil {
					return nil, newAPIErrorFromParamOverride(err)
				}
			}
		}
	}
	if len(body) == 0 {
		return nil, types.NewError(errors.New("provider image request body is empty"), types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}
	// Param overrides are applied after adaptor conversion, so validate the
	// final provider-facing count fields and price the exact persisted body.
	if count, ok, err := image_stream.AsyncImagePassThroughCount(body); err != nil {
		return nil, types.NewErrorWithStatusCode(err, types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	} else if ok {
		info.PriceData.AddOtherRatio("n", float64(count))
	}

	if info.PriceData.UsePrice {
		quotaValue := info.PriceData.ApplyOtherRatiosToFloat(
			info.PriceData.ModelPrice * common.QuotaPerUnit * info.PriceData.GroupRatioInfo.GroupRatio,
		)
		quota, err := common.QuotaFromFloatStrict(quotaValue)
		if err != nil {
			return nil, types.NewErrorWithStatusCode(err, types.ErrorCodeModelPriceError, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
		}
		info.PriceData.QuotaToPreConsume = quota
	}

	var advancedRoute *dto.AdvancedCustomRoute
	if info.ChannelType == constant.ChannelTypeAdvancedCustom {
		config := info.ChannelOtherSettings.AdvancedCustom
		requestPath := info.RequestURLPath
		if c.Request != nil && c.Request.URL != nil {
			requestPath = c.Request.URL.Path
		}
		if config == nil {
			return nil, types.NewError(errors.New("advanced custom route snapshot is missing"), types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
		}
		route, ok := config.MatchPathForModel(requestPath, info.OriginModelName)
		if !ok {
			return nil, types.NewError(errors.New("advanced custom image route snapshot could not be resolved"), types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
		}
		advancedRoute = &route
	}

	contentType := "application/json"
	if passThrough {
		contentType = asyncImageContentType(c.Request.Header.Get("Content-Type"))
	}
	channelSetting := info.ChannelSetting
	channelOtherSettings := info.ChannelOtherSettings
	return &image_stream.PreparedAsyncImageRequest{
		Body:                 body,
		ContentType:          contentType,
		ClientHeaders:        sanitizedAsyncImageClientHeaders(c.Request.Header),
		RequestURLPath:       info.RequestURLPath,
		ChannelBaseURL:       info.ChannelBaseUrl,
		APIType:              info.ApiType,
		ChannelType:          info.ChannelType,
		ChannelCreateTime:    info.ChannelCreateTime,
		ConfigurationStored:  true,
		APIVersion:           info.ApiVersion,
		Organization:         info.Organization,
		HeadersOverride:      info.HeadersOverride,
		ChannelSetting:       &channelSetting,
		ChannelOtherSettings: &channelOtherSettings,
		AdvancedRoute:        advancedRoute,
	}, nil
}

func asyncImageContentType(contentType string) string {
	contentType = strings.TrimSpace(contentType)
	if contentType == "" {
		return "application/json"
	}
	return contentType
}

func sanitizedAsyncImageClientHeaders(headers http.Header) map[string]string {
	if len(headers) == 0 {
		return nil
	}
	skipped := map[string]struct{}{
		"accept-encoding": {}, "authorization": {}, "connection": {}, "content-length": {},
		"cookie": {}, "host": {}, "idempotency-key": {}, "keep-alive": {},
		"proxy-authenticate": {}, "proxy-authorization": {}, "set-cookie": {},
		"te": {}, "trailer": {}, "transfer-encoding": {}, "upgrade": {},
		"x-api-key": {}, "api-key": {}, "x-goog-api-key": {}, "anthropic-api-key": {},
	}
	result := make(map[string]string)
	totalSize := 0
	for key := range headers {
		trimmedKey := strings.TrimSpace(key)
		if trimmedKey == "" {
			continue
		}
		if common.IsSensitiveHeaderName(trimmedKey) {
			continue
		}
		if _, skip := skipped[strings.ToLower(trimmedKey)]; skip {
			continue
		}
		value := strings.TrimSpace(headers.Get(key))
		if value == "" || len(value) > 8<<10 {
			continue
		}
		totalSize += len(trimmedKey) + len(value)
		if totalSize > 32<<10 {
			break
		}
		result[trimmedKey] = value
	}
	if len(result) == 0 {
		return nil
	}
	return result
}
