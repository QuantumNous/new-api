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
	if !info.ImageRoutingSnapshot {
		// A retry may reuse RelayInfo after switching channels. Never let the
		// previous channel's explicit image path leak into a legacy fallback.
		info.ImageRoutingProtocol = ""
		info.ImageRoutingUpstreamPath = ""
	}

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
	if frozenRequirement, ok := imageReq.ImageSelectionRequirement(); ok {
		if err := request.SetImageSelectionRequirement(frozenRequirement); err != nil {
			return types.NewErrorWithStatusCode(err, types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
		}
	}

	err = helper.ModelMappedHelper(c, info, request)
	if err != nil {
		return types.NewError(err, types.ErrorCodeChannelModelMappedError, types.ErrOptionWithSkipRetry())
	}
	effectiveImageModel := strings.TrimSpace(info.UpstreamModelName)
	if effectiveImageModel == "" {
		effectiveImageModel = strings.TrimSpace(request.Model)
	}
	if effectiveImageModel == "" {
		effectiveImageModel = strings.TrimSpace(info.OriginModelName)
	}
	isGPTImage := image_stream.IsGptImageModel(effectiveImageModel)
	gptCapabilityModel := ""
	if isGPTImage {
		gptCapabilityModel = effectiveImageModel
	}
	hasUnifiedGPTDimensions := false
	if gptCapabilityModel != "" {
		_, hasAspectRatio := request.Extra["aspect_ratio"]
		_, hasResolution := request.Extra["resolution"]
		hasUnifiedGPTDimensions = hasAspectRatio || hasResolution
	}

	// Every image generation and edit is submitted as a durable gateway task. gpt-image
	// keeps its Responses/SSE executor only on a plain OpenAI-compatible channel.
	// Routed channels must retain their adaptor-specific URL and authentication.
	if info.RelayMode == relayconstant.RelayModeImagesGenerations || info.RelayMode == relayconstant.RelayModeImagesEdits {
		operation := helper.ResolveImageOperation(info.RelayMode, effectiveImageModel, imageReq)
		selectionRequirement, requirementFrozen := imageReq.ImageSelectionRequirement()
		if requirementFrozen {
			operation = selectionRequirement.Operation
		}
		if operation == dto.ImageOperationEdit {
			// The public generations endpoint also accepts reference-image edits.
			// Provider adaptors still use the edit relay mode to select multipart
			// conversion and their edit-specific upstream route.
			info.RelayMode = relayconstant.RelayModeImagesEdits
		}
		isEdit := info.RelayMode == relayconstant.RelayModeImagesEdits
		if !requirementFrozen {
			if info.ChannelOtherSettings.ImageRouting != nil {
				selectionRequirement, err = dto.ResolveImageSelectionRequirement(imageReq, effectiveImageModel, operation)
			} else {
				selectionRequirement, err = dto.ResolveImageSelectionRequirementWithModelDefaults(imageReq, effectiveImageModel, operation)
			}
			if err != nil {
				return types.NewErrorWithStatusCode(err, types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
			}
		}
		configuredImageRoute := info.ImageRoutingSnapshot && info.ImageRoutingProtocol != ""
		var routingProfile *dto.ImageRoutingProfile
		if config := info.ChannelOtherSettings.ImageRouting; config != nil {
			routingProfile, _ = config.ProfileForModel(info.OriginModelName)
		}
		if !configuredImageRoute {
			if config := info.ChannelOtherSettings.ImageRouting; config != nil {
				profile, found := config.ProfileForModel(info.OriginModelName)
				if !found || profile == nil {
					return types.NewError(
						fmt.Errorf("channel image routing does not support model %s with the requested variant", info.OriginModelName),
						types.ErrorCodeConvertRequestFailed,
					)
				}
				routingProfile = profile
				selectionRequirement, err = profile.ApplyDefaults(selectionRequirement)
				protocol, upstreamPath, routeOK := profile.RouteForOperation(selectionRequirement.Operation)
				if err != nil || !routeOK || !config.Supports(info.OriginModelName, selectionRequirement) {
					return types.NewError(
						fmt.Errorf("channel image routing does not support model %s with the requested variant", info.OriginModelName),
						types.ErrorCodeConvertRequestFailed,
					)
				}
				info.ImageRoutingProtocol = protocol
				info.ImageRoutingUpstreamPath = upstreamPath
				configuredImageRoute = true
			}
		}
		if err := request.SetImageSelectionRequirement(selectionRequirement); err != nil {
			return types.NewErrorWithStatusCode(err, types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
		}
		if err := materializeImageSelectionRequirement(request, selectionRequirement, routingProfile); err != nil {
			return types.NewErrorWithStatusCode(err, types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
		}
		if gptCapabilityModel != "" && (!configuredImageRoute || info.ImageRoutingProtocol == dto.ImageRoutingProtocolResponsesSSE) {
			if err := image_stream.NormalizeUnifiedGPTImageDimensions(request, gptCapabilityModel); err != nil {
				return types.NewErrorWithStatusCode(err, types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
			}
		}
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
		allowPassThrough := !isEdit && !unifiedInput && !hasInputSources && !hasUnifiedGPTDimensions && !configuredImageRoute
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
		useGPTResponsesExecutor := isGPTImage &&
			info.ChannelType == constant.ChannelTypeOpenAI &&
			len(info.ParamOverride) == 0 &&
			len(info.HeadersOverride) == 0 &&
			info.Organization == "" &&
			!passThrough &&
			!hasMask
		if configuredImageRoute {
			switch info.ImageRoutingProtocol {
			case dto.ImageRoutingProtocolResponsesSSE:
				if !useGPTResponsesExecutor {
					return types.NewError(
						errors.New("channel image route is incompatible with the Responses image executor"),
						types.ErrorCodeConvertRequestFailed,
					)
				}
				useGPTResponsesExecutor = true
			case dto.ImageRoutingProtocolImagesGenerations,
				dto.ImageRoutingProtocolImagesEdits,
				dto.ImageRoutingProtocolGeminiGenerate,
				dto.ImageRoutingProtocolImagenPredict,
				dto.ImageRoutingProtocolAdapter:
				useGPTResponsesExecutor = false
			default:
				return types.NewError(
					fmt.Errorf("channel image routing protocol %q is unsupported", info.ImageRoutingProtocol),
					types.ErrorCodeConvertRequestFailed,
				)
			}
		}
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

// materializeImageSelectionRequirement copies channel-resolved defaults into
// the provider-facing request. The canonical requirement is private gateway
// state, so adaptors that only inspect DTO fields would otherwise silently use
// their own defaults (for example Gemini falling back from 4K to 1K).
func materializeImageSelectionRequirement(request *dto.ImageRequest, requirement dto.ImageSelectionRequirement, profile *dto.ImageRoutingProfile) error {
	if request == nil {
		return errors.New("image request is required")
	}
	explicitVerifiedRoute := profile != nil && profile.VerificationStatus == dto.ImageRoutingVerificationProductionVerified
	if explicitVerifiedRoute && requirement.Size != "" {
		request.Size = requirement.Size
	} else if request.Size == "" && requirement.Size != "" {
		request.Size = requirement.Size
	}
	if explicitVerifiedRoute && requirement.Quality != "" {
		request.Quality = requirement.Quality
	} else if request.Quality == "" && requirement.Quality != "" {
		request.Quality = requirement.Quality
	}
	if explicitVerifiedRoute && requirement.N > 0 {
		request.N = common.GetPointer(requirement.N)
	}
	if request.Extra == nil {
		request.Extra = make(map[string]json.RawMessage)
	}
	setExtraString := func(field, value string, overwrite bool) error {
		if value == "" {
			return nil
		}
		raw, exists := request.Extra[field]
		if !overwrite && exists && common.GetJsonType(bytes.TrimSpace(raw)) != "null" && len(bytes.TrimSpace(raw)) > 0 {
			return nil
		}
		encoded, err := common.Marshal(value)
		if err != nil {
			return fmt.Errorf("encode image %s: %w", field, err)
		}
		request.Extra[field] = encoded
		return nil
	}
	if err := setExtraString("resolution", requirement.Resolution, explicitVerifiedRoute); err != nil {
		return err
	}
	if err := setExtraString("aspect_ratio", requirement.AspectRatio, explicitVerifiedRoute); err != nil {
		return err
	}
	if explicitVerifiedRoute || len(bytes.TrimSpace(request.OutputFormat)) == 0 || common.GetJsonType(bytes.TrimSpace(request.OutputFormat)) == "null" {
		if requirement.OutputFormat != "" {
			encoded, err := common.Marshal(requirement.OutputFormat)
			if err != nil {
				return fmt.Errorf("encode image output_format: %w", err)
			}
			request.OutputFormat = encoded
		}
	}
	if explicitVerifiedRoute {
		for _, parameter := range profile.Parameters {
			canonicalName := dto.CanonicalImageRoutingParameterName(parameter.Name)
			raw, exists := requirement.OptionalValues[canonicalName]
			if !exists {
				continue
			}
			for requestName := range request.Extra {
				if requestName != parameter.Name && dto.CanonicalImageRoutingParameterName(requestName) == canonicalName {
					delete(request.Extra, requestName)
				}
			}
			request.Extra[parameter.Name] = append(json.RawMessage(nil), bytes.TrimSpace(raw)...)
		}
	}
	return nil
}

func applyImageRoutingProviderParameters(body []byte, info *relaycommon.RelayInfo, request *dto.ImageRequest) ([]byte, bool, error) {
	if info == nil || request == nil || info.ChannelOtherSettings.ImageRouting == nil {
		return append([]byte(nil), body...), false, nil
	}
	profile, ok := info.ChannelOtherSettings.ImageRouting.ProfileForModel(info.OriginModelName)
	if !ok || profile == nil || len(profile.Parameters) == 0 {
		return append([]byte(nil), body...), false, nil
	}
	providerValues := make(map[string]json.RawMessage)
	for _, parameter := range profile.Parameters {
		raw, exists := request.Extra[parameter.Name]
		if !exists || len(bytes.TrimSpace(raw)) == 0 || common.GetJsonType(bytes.TrimSpace(raw)) == "null" {
			continue
		}
		providerValues[parameter.Name] = append(json.RawMessage(nil), bytes.TrimSpace(raw)...)
	}
	if len(providerValues) == 0 {
		return append([]byte(nil), body...), false, nil
	}
	fields := make(map[string]json.RawMessage)
	if err := common.Unmarshal(body, &fields); err != nil {
		return nil, false, fmt.Errorf("inject verified image provider parameters into JSON object: %w", err)
	}
	for name, raw := range providerValues {
		fields[name] = raw
	}
	encoded, err := common.Marshal(fields)
	if err != nil {
		return nil, false, fmt.Errorf("encode verified image provider parameters: %w", err)
	}
	return encoded, true, nil
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
	case constant.APITypeVolcEngine:
		if common.ImageModelCapabilitiesForModel(model).Family == common.ImageModelFamilySeedream {
			if info.RelayMode == relayconstant.RelayModeImagesEdits || len(imageURLs) > 0 {
				return fmt.Errorf("Seedream model %s does not support unified image inputs", info.UpstreamModelName)
			}
			if request.N != nil && *request.N > 1 {
				return fmt.Errorf("Seedream model %s supports only n=1", info.UpstreamModelName)
			}
			if raw := bytes.TrimSpace(request.OutputFormat); len(raw) > 0 && common.GetJsonType(raw) != "null" {
				var outputFormat string
				if common.GetJsonType(raw) != "string" || common.Unmarshal(raw, &outputFormat) != nil {
					return errors.New("output_format must be a string")
				}
				outputFormat = strings.ToLower(strings.TrimSpace(outputFormat))
				if outputFormat == "jpg" {
					outputFormat = "jpeg"
				}
				if outputFormat != "" && outputFormat != "png" && outputFormat != "jpeg" {
					return fmt.Errorf("output_format %q is not supported by Seedream; use png or jpeg", outputFormat)
				}
			}
		}
	case constant.APITypeGemini, constant.APITypeVertexAi:
		if strings.HasPrefix(model, "imagen-") && info.RelayMode == relayconstant.RelayModeImagesEdits {
			return errors.New("Imagen models do not support image edits on the unified image endpoint")
		}
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
	capabilities := common.ImageModelCapabilitiesForModel(model)
	if request.N != nil && capabilities.MaxOutputImages > 0 && *request.N > uint(capabilities.MaxOutputImages) {
		switch capabilities.Family {
		case common.ImageModelFamilyGeminiFlash31,
			common.ImageModelFamilyGeminiPro3,
			common.ImageModelFamilyGeminiLegacy:
			return fmt.Errorf("model %s supports only n=1", info.UpstreamModelName)
		case common.ImageModelFamilyImagen,
			common.ImageModelFamilyDallE3:
			return fmt.Errorf("model %s supports at most %d output images", info.UpstreamModelName, capabilities.MaxOutputImages)
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
	passThrough := allowPassThrough && passThroughRequested && info.ApiType == constant.APITypeOpenAI && info.ImageRoutingProtocol == ""
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
		providerRequest = sanitizeImageRoutingAliases(providerRequest, info.ImageRoutingProtocol)
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
			convertedBody, _, injectErr := applyImageRoutingProviderParameters(convertedBuffer.Bytes(), info, &providerRequest)
			if injectErr != nil {
				return nil, types.NewError(injectErr, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
			}
			pricingBody = append([]byte(nil), convertedBody...)
			basePricingBody = append([]byte(nil), pricingBody...)
			if !deferConversion {
				body = append([]byte(nil), pricingBody...)
			}
		} else {
			var convertedBody []byte
			var marshalErr error
			switch converted := convertedRequest.(type) {
			case dto.ImageRequest:
				sanitized := sanitizeImageRoutingAliases(converted, info.ImageRoutingProtocol)
				convertedBody, marshalErr = marshalGenericImageRequest(&sanitized)
			case *dto.ImageRequest:
				sanitized := sanitizeImageRoutingAliases(*converted, info.ImageRoutingProtocol)
				convertedBody, marshalErr = marshalGenericImageRequest(&sanitized)
			default:
				convertedBody, marshalErr = common.Marshal(convertedRequest)
			}
			if marshalErr != nil {
				return nil, types.NewError(marshalErr, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
			}
			convertedBody, _, marshalErr = applyImageRoutingProviderParameters(convertedBody, info, &providerRequest)
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
	outputCount := uint(0)
	if count, ok, err := image_stream.AsyncImagePassThroughCount(pricingBody); err != nil {
		return nil, types.NewErrorWithStatusCode(err, types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	} else if ok {
		info.PriceData.AddOtherRatio("n", float64(count))
		outputCount = uint(count)
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
	} else if info.RelayMode == relayconstant.RelayModeImagesEdits && imageRoutingUsesMultipartEdit(info.ImageRoutingProtocol) {
		contentType = "multipart/form-data"
	}
	channelSetting := info.ChannelSetting
	channelOtherSettings := info.ChannelOtherSettings
	executionOverrideHash, err := image_stream.AsyncImageExecutionOverrideFingerprint(info.ParamOverride, info.HeadersOverride)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}
	executionDestinationHash, err := image_stream.AsyncImageExecutionDestinationFingerprint(info.ChannelBaseUrl, info.ChannelSetting.Proxy)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}
	requestURLPath, _, _ := strings.Cut(info.RequestURLPath, "?")
	requestURLPath, _, _ = strings.Cut(requestURLPath, "#")
	if info.RelayMode == relayconstant.RelayModeImagesEdits && info.ApiType == constant.APITypeOpenAI && requestURLPath == "/v1/edits" {
		requestURLPath = "/v1/images/edits"
	}
	return &image_stream.PreparedAsyncImageRequest{
		Body:                       body,
		DeferConversion:            deferConversion,
		OutputCount:                outputCount,
		RelayMode:                  info.RelayMode,
		ContentType:                contentType,
		ClientHeaders:              clientHeaders,
		RequestURLPath:             requestURLPath,
		ChannelBaseURL:             info.ChannelBaseUrl,
		ExecutionDestinationHash:   executionDestinationHash,
		ExecutionDestinationStored: true,
		APIType:                    info.ApiType,
		ChannelType:                info.ChannelType,
		ChannelCreateTime:          info.ChannelCreateTime,
		ConfigurationStored:        true,
		APIVersion:                 info.ApiVersion,
		Organization:               info.Organization,
		ExecutionOverrideHash:      executionOverrideHash,
		ExecutionOverrideStored:    true,
		HeadersOverride:            info.HeadersOverride,
		ChannelSetting:             &channelSetting,
		ChannelOtherSettings:       &channelOtherSettings,
		AdvancedRouteHash:          advancedRouteHash,
		ImageRoutingProtocol:       info.ImageRoutingProtocol,
		ImageRoutingUpstreamPath:   info.ImageRoutingUpstreamPath,
	}, nil
}

func sanitizeImageRoutingAliases(request dto.ImageRequest, protocol dto.ImageRoutingProtocol) dto.ImageRequest {
	if protocol != dto.ImageRoutingProtocolImagesGenerations && protocol != dto.ImageRoutingProtocolImagesEdits {
		return request
	}
	if request.Extra == nil {
		return request
	}
	originalExtra := request.Extra
	request.Extra = make(map[string]json.RawMessage, len(originalExtra))
	for key, value := range originalExtra {
		if key == "resolution" || key == "aspect_ratio" {
			continue
		}
		request.Extra[key] = append(json.RawMessage(nil), value...)
	}
	if len(request.Extra) == 0 {
		request.Extra = nil
	}
	return request
}

func imageRoutingUsesMultipartEdit(protocol dto.ImageRoutingProtocol) bool {
	return protocol == "" || protocol == dto.ImageRoutingProtocolImagesEdits || protocol == dto.ImageRoutingProtocolAdapter
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
