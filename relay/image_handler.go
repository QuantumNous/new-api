package relay

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/model_setting"
	hosttypes "github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/tidwall/sjson"
)

func prepareImageUsageForSettlement(info *relaycommon.RelayInfo, usage *dto.Usage) error {
	return service.FinalizeImageRoutingSettlement(info, usage)
}

func sanitizeImageAutoError(info *relaycommon.RelayInfo, apiErr *types.NewAPIError) *types.NewAPIError {
	if info == nil || info.ImageRouting == nil || apiErr == nil {
		return apiErr
	}
	options := make([]types.NewAPIErrorOptions, 0, 2)
	if types.IsSkipRetryError(apiErr) {
		options = append(options, types.ErrOptionWithSkipRetry())
	}
	if types.IsRequestNotSentError(apiErr) {
		options = append(options, types.ErrOptionWithRequestNotSent())
	}
	if upstreamStatus := types.ImageRoutingUpstreamStatusCode(apiErr); upstreamStatus != 0 {
		options = append(options, types.ErrOptionWithImageRoutingUpstreamResponse(
			upstreamStatus,
			types.IsImageRoutingUpstreamRejected(apiErr),
		))
	}
	return types.NewOpenAIError(
		fmt.Errorf("%s", relaycommon.ImageRoutingPublicErrorMessage),
		apiErr.GetErrorCode(),
		apiErr.StatusCode,
		options...,
	)
}

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
	if info.ImageRouting != nil && info.ChannelType == constant.ChannelTypeOpenAI {
		route, routeErr := info.ImageRouting.ActiveRoute()
		if routeErr != nil {
			return types.NewError(routeErr, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
		}
		if route.BillingMode == hosttypes.ImageRoutingBillingMetered && route.UpstreamModel == "gpt-image-2" {
			request.ResponseFormat = ""
		}
	}

	err = helper.ModelMappedHelper(c, info, request)
	if err != nil {
		return types.NewError(err, types.ErrorCodeChannelModelMappedError, types.ErrOptionWithSkipRetry())
	}

	adaptor := GetAdaptor(info.ApiType)
	if adaptor == nil {
		return types.NewError(fmt.Errorf("invalid api type: %d", info.ApiType), types.ErrorCodeInvalidApiType, types.ErrOptionWithSkipRetry())
	}
	adaptor.Init(info)

	var requestBody io.Reader

	if info.ImageRouting == nil && (model_setting.GetGlobalSettings().PassThroughRequestEnabled || info.ChannelSetting.PassThroughBodyEnabled) {
		storage, err := common.GetBodyStorage(c)
		if err != nil {
			return types.NewErrorWithStatusCode(err, types.ErrorCodeReadRequestBodyFailed, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
		}
		requestBody = common.NewReplayableBodyReader(storage)
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
			if info.ImageRouting == nil && len(info.ParamOverride) > 0 {
				jsonData, err = relaycommon.ApplyParamOverrideWithRelayInfo(jsonData, info)
				if err != nil {
					return newAPIErrorFromParamOverride(err)
				}
			}
			if info.ImageRouting != nil {
				upstreamModel := strings.TrimSpace(info.UpstreamModelName)
				if upstreamModel == "" {
					return types.NewError(fmt.Errorf("image-auto upstream model is unavailable"), types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
				}
				jsonData, err = sjson.SetBytes(jsonData, "model", upstreamModel)
				if err != nil {
					return types.NewError(fmt.Errorf("failed to enforce image-auto upstream model: %w", err), types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
				}
			}

			logger.LogDebug(c, "image request body: %s", jsonData)
			body, closer, err := relaycommon.NewOutboundJSONBody(jsonData)
			if err != nil {
				return types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
			}
			defer closer.Close()
			jsonData = nil
			requestBody = body
		}
	}

	statusCodeMappingStr := c.GetString("status_code_mapping")

	resp, err := adaptor.DoRequest(c, info, requestBody)
	if err != nil {
		return sanitizeImageAutoError(info, types.NewOpenAIError(err, types.ErrorCodeDoRequestFailed, http.StatusInternalServerError))
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
				if info.ImageRouting != nil {
					newAPIError = types.ClassifyImageRoutingUpstreamResponse(newAPIError)
				}
				// reset status code 重置状态码
				service.ResetStatusCode(newAPIError, statusCodeMappingStr)
				return sanitizeImageAutoError(info, newAPIError)
			}
		}
	}

	usage, newAPIError := adaptor.DoResponse(c, httpResp, info)
	if newAPIError != nil {
		if info.ImageRouting != nil && info.ImageRouting.ReturnedImagesKnown && info.ImageRouting.ReturnedImages > 0 {
			imageUsage, _ := usage.(*dto.Usage)
			if err := prepareImageUsageForSettlement(info, imageUsage); err != nil {
				return types.NewError(err, types.ErrorCodeModelPriceError, types.ErrOptionWithSkipRetry())
			}
			// A completed image event is independently usable. Settle exactly the
			// fully written images and let the platform absorb any ambiguous or
			// partially written remainder.
			service.PostTextConsumeQuota(c, info, imageUsage, nil)
		}
		// reset status code 重置状态码
		service.ResetStatusCode(newAPIError, statusCodeMappingStr)
		return sanitizeImageAutoError(info, newAPIError)
	}

	imageN := uint(1)
	if request.N != nil {
		imageN = *request.N
	}

	imageUsage, ok := usage.(*dto.Usage)
	if !ok {
		return types.NewError(fmt.Errorf("invalid image usage type: %T", usage), types.ErrorCodeBadResponseBody, types.ErrOptionWithSkipRetry())
	}
	if err := prepareImageUsageForSettlement(info, imageUsage); err != nil {
		return types.NewError(err, types.ErrorCodeModelPriceError, types.ErrOptionWithSkipRetry())
	}

	// Preserve legacy fixed-image billing behavior for models outside image-auto.
	// image-auto must retain absent usage so its configured missing-usage route
	// policy can settle transparently instead of fabricating a one-token result.
	if info.ImageRouting == nil {
		if imageUsage.TotalTokens == 0 {
			imageUsage.TotalTokens = 1
		}
		if imageUsage.PromptTokens == 0 {
			imageUsage.PromptTokens = 1
		}
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

	service.PostTextConsumeQuota(c, info, imageUsage, logContent)
	return nil
}
