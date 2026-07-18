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
	"github.com/QuantumNous/new-api/relay/channel/gemini"
	"github.com/QuantumNous/new-api/relay/channel/openai/image_stream"
	"github.com/QuantumNous/new-api/relay/channel/replicate"
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

	// Every image generation and edit is submitted as a durable gateway task. gpt-image
	// keeps its Responses/SSE executor only on a plain OpenAI-compatible channel.
	// Routed channels must retain their adaptor-specific URL and authentication.
	if info.RelayMode == relayconstant.RelayModeImagesGenerations || info.RelayMode == relayconstant.RelayModeImagesEdits {
		isEdit := info.RelayMode == relayconstant.RelayModeImagesEdits
		hasInputSources, err := image_stream.HasAsyncImageInputSources(c, request)
		if err != nil {
			return types.NewErrorWithStatusCode(err, types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
		}
		if isEdit && !hasInputSources {
			return types.NewErrorWithStatusCode(errors.New("image is required for asynchronous image edits"), types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
		}
		if err := image_stream.ValidateAsyncImageSubmission(info.OriginModelName, info.UpstreamModelName, request, hasInputSources); err != nil {
			return types.NewErrorWithStatusCode(err, types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
		}
		if err := validateAsyncImageProviderCapabilities(c, info, request); err != nil {
			return types.NewErrorWithStatusCode(err, types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
		}
		if isEdit && len(info.ParamOverride) > 0 {
			return types.NewErrorWithStatusCode(
				errors.New("channel parameter override is not supported for asynchronous multipart image edits"),
				types.ErrorCodeChannelParamOverrideInvalid,
				http.StatusBadRequest,
				types.ErrOptionWithSkipRetry(),
			)
		}
		if (info.ChannelType == constant.ChannelTypeGemini || info.ChannelType == constant.ChannelTypeVertexAi) &&
			model_setting.IsGeminiModelSupportImagine(info.UpstreamModelName) {
			if err := gemini.ValidateNativeImageRequestOptionsForModel(*request, info.UpstreamModelName); err != nil {
				return types.NewErrorWithStatusCode(err, types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
			}
		}
		if apiErr := image_stream.ValidateAsyncImageDelivery(request); apiErr != nil {
			return apiErr
		}
		if hasInputSources && !image_stream.LoadR2Config().InputEnabled() {
			return types.NewErrorWithStatusCode(
				errors.New("async image input storage requires a separate private CLOUDFLARE_R2_INPUT_BUCKET"),
				types.ErrorCodeInvalidRequest,
				http.StatusServiceUnavailable,
				types.ErrOptionWithSkipRetry(),
			)
		}
		unifiedInput := imageReq.HasUnifiedImageInput()
		allowPassThrough := !isEdit && !unifiedInput && !hasInputSources
		passThrough := (model_setting.GetGlobalSettings().PassThroughRequestEnabled || info.ChannelSetting.PassThroughBodyEnabled) && allowPassThrough
		hasMask := len(bytes.TrimSpace(request.Mask)) > 0 && common.GetJsonType(request.Mask) != "null"
		if !hasMask && c.Request != nil && c.Request.MultipartForm != nil {
			hasMask = len(c.Request.MultipartForm.File["mask"]) > 0
			if !hasMask {
				for _, value := range c.Request.MultipartForm.Value["mask"] {
					if strings.TrimSpace(value) != "" {
						hasMask = true
						break
					}
				}
			}
		}
		useGPTResponsesExecutor := (image_stream.IsGptImageModel(info.OriginModelName) || image_stream.IsGptImageModel(info.UpstreamModelName) || image_stream.IsGptImageModel(request.Model)) &&
			info.ChannelType == constant.ChannelTypeOpenAI &&
			len(info.ParamOverride) == 0 &&
			len(info.HeadersOverride) == 0 &&
			info.Organization == "" &&
			!passThrough &&
			!hasMask
		if useGPTResponsesExecutor && request.N != nil && *request.N > 1 {
			return types.NewErrorWithStatusCode(
				errors.New("the GPT Responses image executor supports only n=1"),
				types.ErrorCodeInvalidRequest,
				http.StatusBadRequest,
				types.ErrOptionWithSkipRetry(),
			)
		}
		if useGPTResponsesExecutor {
			return image_stream.SubmitAsyncImage(c, info, request, nil)
		}

		prepared, apiErr := prepareAsyncImageAdaptorRequest(c, info, request, allowPassThrough)
		if apiErr != nil {
			return apiErr
		}
		return image_stream.SubmitAsyncImage(c, info, request, nil, prepared)
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

func validateAsyncImageProviderCapabilities(c *gin.Context, info *relaycommon.RelayInfo, request *dto.ImageRequest) error {
	if info == nil || request == nil {
		return errors.New("async image provider context is required")
	}
	imageURLs, err := request.ImageInputURLs()
	if err != nil {
		return fmt.Errorf("invalid unified image input: %w", err)
	}
	if len(imageURLs) == 0 && len(bytes.TrimSpace(request.Image)) > 0 && common.GetJsonType(request.Image) != "null" {
		probe := *request
		probe.Images = append(json.RawMessage(nil), request.Image...)
		imageURLs, err = probe.ImageInputURLs()
		if err != nil {
			return fmt.Errorf("invalid image input: %w", err)
		}
	}
	model := strings.TrimPrefix(strings.ToLower(strings.TrimSpace(info.UpstreamModelName)), "models/")
	if model == "" {
		model = strings.ToLower(strings.TrimSpace(request.Model))
	}
	switch info.ApiType {
	case constant.APITypeMiniMax, constant.APITypeXai:
		if info.RelayMode == relayconstant.RelayModeImagesEdits {
			return fmt.Errorf("provider model %s does not support image edits", info.UpstreamModelName)
		}
		if len(imageURLs) > 0 {
			return fmt.Errorf("provider model %s does not support unified image inputs", info.UpstreamModelName)
		}
	case constant.APITypeReplicate:
		if info.RelayMode == relayconstant.RelayModeImagesEdits {
			if err := replicate.ValidateImageEditInputs(c, *request); err != nil {
				return err
			}
		} else if len(imageURLs) > 0 {
			return fmt.Errorf("provider model %s does not support unified image inputs", info.UpstreamModelName)
		}
	case constant.APITypeSiliconFlow:
		if len(imageURLs) > 3 {
			return errors.New("siliconflow image generation supports at most 3 input images")
		}
	case constant.APITypeJimeng:
		if request.N != nil && *request.N > 1 {
			return errors.New("jimeng image generation supports only n=1")
		}
	case constant.APITypeAli:
		if info.RelayMode != relayconstant.RelayModeImagesEdits && len(imageURLs) > 0 && !model_setting.IsSyncImageModel(model) {
			return fmt.Errorf("model %s does not support unified image inputs on the Ali text-to-image endpoint", info.UpstreamModelName)
		}
	case constant.APITypeGemini, constant.APITypeVertexAi:
		if raw := bytes.TrimSpace(request.OutputFormat); len(raw) > 0 && common.GetJsonType(raw) != "null" {
			var outputFormat string
			if common.GetJsonType(raw) != "string" || common.Unmarshal(raw, &outputFormat) != nil {
				return errors.New("output_format must be a string")
			}
			outputFormat = strings.ToLower(strings.TrimSpace(outputFormat))
			if outputFormat == "jpg" {
				outputFormat = "jpeg"
			}
			if outputFormat != "" && outputFormat != "png" {
				return fmt.Errorf("output_format %q is not supported by Gemini/Vertex image generation; use png", outputFormat)
			}
		}
		if info.RelayMode != relayconstant.RelayModeImagesEdits && len(imageURLs) > 0 {
			if strings.HasPrefix(model, "imagen") {
				return errors.New("Imagen models do not support unified image inputs on this endpoint")
			}
			if !model_setting.IsGeminiModelSupportImagine(info.UpstreamModelName) {
				return fmt.Errorf("model %s does not support unified image inputs", info.UpstreamModelName)
			}
		}
	}
	return nil
}

func prepareAsyncImageAdaptorRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.ImageRequest, allowPassThrough bool) (*image_stream.PreparedAsyncImageRequest, *types.NewAPIError) {
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
	clientHeaders := image_stream.SanitizeAsyncImageClientHeaders(c.Request.Header)
	pricingInfo := *info
	pricingInfo.RequestHeaders = clientHeaders

	var body []byte
	var pricingBody []byte
	var basePricingBody []byte
	passThroughRequested := model_setting.GetGlobalSettings().PassThroughRequestEnabled || info.ChannelSetting.PassThroughBodyEnabled
	// Raw pass-through is only protocol-compatible with OpenAI-style image
	// channels. Provider-specific adaptors still need conversion to establish
	// their request path and body shape (for example Replicate's predictions API).
	passThrough := allowPassThrough && passThroughRequested && info.ApiType == constant.APITypeOpenAI
	deferConversion, err := shouldDeferAsyncImageAdaptorConversion(info, &providerRequest)
	if err != nil {
		return nil, types.NewErrorWithStatusCode(err, types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}
	if info.RelayMode == relayconstant.RelayModeImagesEdits {
		// The worker owns the only provider submission. Rebuild edit multipart
		// from the private R2 objects instead of checkpointing the inbound files.
		deferConversion = true
	}
	if info.RelayMode == relayconstant.RelayModeImagesEdits {
		// Edit file bytes are staged only after the durable quota reservation.
		// Keep submission side-effect free: the worker will reconstruct multipart
		// and run provider-specific conversion from the signed private inputs.
		pricingBody, err = marshalGenericImageRequest(&providerRequest)
		if err != nil {
			return nil, types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
		}
		basePricingBody = append([]byte(nil), pricingBody...)
		if len(info.ParamOverride) > 0 {
			pricingBody, err = relaycommon.ApplyParamOverrideWithRelayInfo(pricingBody, &pricingInfo)
			if err != nil {
				return nil, newAPIErrorFromParamOverride(err)
			}
		}
	} else if passThrough {
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
		pricingBody = body
		basePricingBody = append([]byte(nil), body...)
		if len(info.ParamOverride) > 0 {
			pricingBody, err = relaycommon.ApplyParamOverrideWithRelayInfo(pricingBody, &pricingInfo)
			if err != nil {
				return nil, newAPIErrorFromParamOverride(err)
			}
		}
	} else {
		conversionRequest := providerRequest
		if deferConversion {
			// Validate the provider-specific options and parameter overrides without
			// resolving reference URLs into inline base64 at submission time.
			conversionRequest.Images = nil
			conversionRequest.Image = nil
		}
		convertedRequest, err := adaptor.ConvertImageRequest(c, info, conversionRequest)
		if err != nil {
			return nil, types.NewError(err, types.ErrorCodeConvertRequestFailed)
		}
		relaycommon.AppendRequestConversionFromRequest(info, convertedRequest)
		if convertedBuffer, ok := convertedRequest.(*bytes.Buffer); ok {
			pricingBody = append([]byte(nil), convertedBuffer.Bytes()...)
			basePricingBody = append([]byte(nil), pricingBody...)
			if !deferConversion {
				body = append([]byte(nil), pricingBody...)
			}
		} else {
			var convertedBody []byte
			var marshalErr error
			switch converted := convertedRequest.(type) {
			case dto.ImageRequest:
				convertedBody, marshalErr = marshalGenericImageRequest(&converted)
			case *dto.ImageRequest:
				convertedBody, marshalErr = marshalGenericImageRequest(converted)
			default:
				convertedBody, marshalErr = common.Marshal(convertedRequest)
			}
			if marshalErr != nil {
				return nil, types.NewError(marshalErr, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
			}
			if !deferConversion {
				// Persist only the adaptor output. Param overrides are resolved and
				// applied from the current channel by the worker, because override
				// values may contain provider credentials.
				body = append([]byte(nil), convertedBody...)
			}
			pricingBody = append([]byte(nil), convertedBody...)
			basePricingBody = append([]byte(nil), convertedBody...)
			if len(info.ParamOverride) > 0 {
				pricingBody, err = relaycommon.ApplyParamOverrideWithRelayInfo(pricingBody, &pricingInfo)
				if err != nil {
					return nil, newAPIErrorFromParamOverride(err)
				}
			}
		}
	}
	if len(pricingBody) == 0 {
		return nil, types.NewError(errors.New("provider image request body is empty"), types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}
	if !deferConversion && len(body) == 0 {
		return nil, types.NewError(errors.New("provider image request body is empty"), types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}
	if len(info.ParamOverride) > 0 {
		if err := validateAsyncImagePricingFieldsUnchanged(basePricingBody, pricingBody); err != nil {
			return nil, types.NewErrorWithStatusCode(err, types.ErrorCodeChannelParamOverrideInvalid, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
		}
	}
	// Param overrides are applied to this ephemeral copy for count validation
	// and pricing. The durable body above remains credential-free.
	if count, ok, err := image_stream.AsyncImagePassThroughCount(pricingBody); err != nil {
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

	advancedRouteHash := ""
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
		advancedRouteHash, err = image_stream.AsyncImageAdvancedRouteFingerprint(route)
		if err != nil {
			return nil, types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
		}
	}

	contentType := "application/json"
	if passThrough {
		contentType = asyncImageContentType(c.Request.Header.Get("Content-Type"))
	} else if info.RelayMode == relayconstant.RelayModeImagesEdits {
		contentType = "multipart/form-data"
	}
	channelSetting := info.ChannelSetting
	channelOtherSettings := info.ChannelOtherSettings
	executionOverrideHash, err := image_stream.AsyncImageExecutionOverrideFingerprint(info.ParamOverride, info.HeadersOverride)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}
	requestURLPath, _, _ := strings.Cut(info.RequestURLPath, "?")
	requestURLPath, _, _ = strings.Cut(requestURLPath, "#")
	if info.RelayMode == relayconstant.RelayModeImagesEdits && info.ApiType == constant.APITypeOpenAI && requestURLPath == "/v1/edits" {
		requestURLPath = "/v1/images/edits"
	}
	return &image_stream.PreparedAsyncImageRequest{
		Body:                    body,
		DeferConversion:         deferConversion,
		RelayMode:               info.RelayMode,
		ContentType:             contentType,
		ClientHeaders:           clientHeaders,
		RequestURLPath:          requestURLPath,
		ChannelBaseURL:          info.ChannelBaseUrl,
		APIType:                 info.ApiType,
		ChannelType:             info.ChannelType,
		ChannelCreateTime:       info.ChannelCreateTime,
		ConfigurationStored:     true,
		APIVersion:              info.ApiVersion,
		Organization:            info.Organization,
		ExecutionOverrideHash:   executionOverrideHash,
		ExecutionOverrideStored: true,
		HeadersOverride:         info.HeadersOverride,
		ChannelSetting:          &channelSetting,
		ChannelOtherSettings:    &channelOtherSettings,
		AdvancedRouteHash:       advancedRouteHash,
	}, nil
}

func validateAsyncImagePricingFieldsUnchanged(before, after []byte) error {
	var beforeValue any
	if err := common.Unmarshal(before, &beforeValue); err != nil {
		return fmt.Errorf("decode image request before parameter override: %w", err)
	}
	var afterValue any
	if err := common.Unmarshal(after, &afterValue); err != nil {
		return fmt.Errorf("decode image request after parameter override: %w", err)
	}
	beforeFields := make(map[string]json.RawMessage)
	if err := collectAsyncImagePricingFields(beforeValue, "", beforeFields); err != nil {
		return err
	}
	afterFields := make(map[string]json.RawMessage)
	if err := collectAsyncImagePricingFields(afterValue, "", afterFields); err != nil {
		return err
	}
	encodedBefore, err := common.Marshal(beforeFields)
	if err != nil {
		return fmt.Errorf("encode image pricing fields before parameter override: %w", err)
	}
	encodedAfter, err := common.Marshal(afterFields)
	if err != nil {
		return fmt.Errorf("encode image pricing fields after parameter override: %w", err)
	}
	if !bytes.Equal(encodedBefore, encodedAfter) {
		return errors.New("async image parameter overrides cannot change model, size, resolution, aspect ratio, quality, dimensions, or prompt extension")
	}
	return nil
}

func collectAsyncImagePricingFields(value any, path string, fields map[string]json.RawMessage) error {
	switch typed := value.(type) {
	case map[string]any:
		for key, child := range typed {
			childPath := key
			if path != "" {
				childPath = path + "." + key
			}
			normalizedKey := strings.NewReplacer("_", "", "-", "").Replace(strings.ToLower(strings.TrimSpace(key)))
			switch normalizedKey {
			case "model", "modelname", "size", "imagesize", "resolution", "quality", "outputquality", "aspectratio", "width", "height", "dimensions", "imagedimensions", "promptextend":
				encoded, err := common.Marshal(child)
				if err != nil {
					return fmt.Errorf("encode image pricing field %s: %w", childPath, err)
				}
				fields[childPath] = encoded
			}
			if err := collectAsyncImagePricingFields(child, childPath, fields); err != nil {
				return err
			}
		}
	case []any:
		for index, child := range typed {
			if err := collectAsyncImagePricingFields(child, fmt.Sprintf("%s[%d]", path, index), fields); err != nil {
				return err
			}
		}
	}
	return nil
}

func shouldDeferAsyncImageAdaptorConversion(info *relaycommon.RelayInfo, request *dto.ImageRequest) (bool, error) {
	if info == nil || request == nil || !model_setting.IsGeminiModelSupportImagine(info.UpstreamModelName) {
		return false, nil
	}
	if info.ChannelType != constant.ChannelTypeGemini && info.ChannelType != constant.ChannelTypeVertexAi {
		return false, nil
	}
	urls, err := request.ImageInputURLs()
	if err != nil {
		return false, err
	}
	if len(urls) > 0 {
		return true, nil
	}
	if len(strings.TrimSpace(string(request.Image))) == 0 || common.GetJsonType(request.Image) == "null" {
		return false, nil
	}
	probe := *request
	probe.Images = append(json.RawMessage(nil), request.Image...)
	urls, err = probe.ImageInputURLs()
	if err != nil {
		return false, err
	}
	return len(urls) > 0, nil
}

func asyncImageContentType(contentType string) string {
	contentType = strings.TrimSpace(contentType)
	if contentType == "" {
		return "application/json"
	}
	return contentType
}
