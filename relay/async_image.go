package relay

import (
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/relay/channel"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

// AsyncImageResult holds the result from an async image generation.
type AsyncImageResult struct {
	TaskID  string
	RawBody []byte // Raw JSON response from upstream
}

// ImageAsyncHelper runs image generation in async mode.
// Instead of writing the response to the client, it captures the raw
// upstream response body for storage in a Task record.
//
// Returns:
//   - *AsyncImageResult with the captured response on success
//   - *types.NewAPIError on failure (should be propagated through standard error handling)
func ImageAsyncHelper(c *gin.Context, info *relaycommon.RelayInfo, taskID string) (*AsyncImageResult, *types.NewAPIError) {
	info.InitChannelMeta(c)

	imageReq, ok := info.Request.(*dto.ImageRequest)
	if !ok {
		return nil, types.NewErrorWithStatusCode(
			fmt.Errorf("invalid request type, expected dto.ImageRequest, got %T", info.Request),
			types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry(),
		)
	}

	request, err := common.DeepCopy(imageReq)
	if err != nil {
		return nil, types.NewError(fmt.Errorf("failed to copy request: %w", err), types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
	}

	if err = helper.ModelMappedHelper(c, info, request); err != nil {
		return nil, types.NewError(err, types.ErrorCodeChannelModelMappedError, types.ErrOptionWithSkipRetry())
	}

	adaptor := GetAdaptor(info.ApiType)
	if adaptor == nil {
		return nil, types.NewError(fmt.Errorf("invalid api type: %d", info.ApiType), types.ErrorCodeInvalidApiType, types.ErrOptionWithSkipRetry())
	}
	adaptor.Init(info)

	// Build request body
	var requestBody io.Reader
	if model_setting.GetGlobalSettings().PassThroughRequestEnabled || info.ChannelSetting.PassThroughBodyEnabled {
		storage, err := common.GetBodyStorage(c)
		if err != nil {
			return nil, types.NewErrorWithStatusCode(err, types.ErrorCodeReadRequestBodyFailed, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
		}
		requestBody = common.ReaderOnly(storage)
	} else {
		convertedRequest, err := adaptor.ConvertImageRequest(c, info, *request)
		if err != nil {
			return nil, types.NewError(err, types.ErrorCodeConvertRequestFailed)
		}
		relaycommon.AppendRequestConversionFromRequest(info, convertedRequest)

		switch convertedRequest.(type) {
		case *[]byte:
			requestBody = strings.NewReader(string(*convertedRequest.(*[]byte)))
		default:
			jsonData, marshalErr := common.Marshal(convertedRequest)
			if marshalErr != nil {
				return nil, types.NewError(marshalErr, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
			}
			if len(info.ParamOverride) > 0 {
				jsonData, marshalErr = relaycommon.ApplyParamOverrideWithRelayInfo(jsonData, info)
				if marshalErr != nil {
					return nil, newAPIErrorFromParamOverride(marshalErr)
				}
			}
			body, size, closer, bodyErr := relaycommon.NewOutboundJSONBody(jsonData)
			if bodyErr != nil {
				return nil, types.NewError(bodyErr, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
			}
			defer closer.Close()
			info.UpstreamRequestBodySize = size
			requestBody = body
		}
	}

	statusCodeMappingStr := c.GetString("status_code_mapping")

	// Send request to upstream
	resp, err := adaptor.DoRequest(c, info, requestBody)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeDoRequestFailed, http.StatusInternalServerError)
	}

	var httpResp *http.Response
	if resp != nil {
		httpResp = resp.(*http.Response)
		info.IsStream = info.IsStream || strings.HasPrefix(httpResp.Header.Get("Content-Type"), "text/event-stream")
		if httpResp.StatusCode != http.StatusOK {
			if httpResp.StatusCode == http.StatusCreated && info.ApiType == constant.APITypeReplicate {
				httpResp.StatusCode = http.StatusOK
			} else {
				apiErr := service.RelayErrorHandler(c.Request.Context(), httpResp, false)
				service.ResetStatusCode(apiErr, statusCodeMappingStr)
				return nil, apiErr
			}
		}
	}

	// Read the upstream response body
	if httpResp == nil || httpResp.Body == nil {
		return nil, types.NewError(fmt.Errorf("upstream returned nil response"), types.ErrorCodeDoRequestFailed, types.ErrOptionWithSkipRetry())
	}
	rawBody, err := io.ReadAll(httpResp.Body)
	if err != nil {
		return nil, types.NewError(fmt.Errorf("failed to read upstream response: %w", err), types.ErrorCodeReadResponseBodyFailed, types.ErrOptionWithSkipRetry())
	}
	httpResp.Body.Close()

	// CDN post-processing: upload images to CDN and rewrite URLs
	if info.CDNProvider == "qiniu" {
		if processed, cdnErr := service.ProcessImageResponseCDN(c, rawBody); cdnErr == nil {
			rawBody = processed
		} else {
			logger.LogWarn(c, "CDN processing failed for async image: "+cdnErr.Error())
		}
	}

	// Parse usage from the response for billing
	var usageResp dto.SimpleResponse
	if err := common.Unmarshal(rawBody, &usageResp); err == nil {
		// Usage parsed successfully — set it on info for billing
		usage := &usageResp.Usage
		if usage.TotalTokens == 0 {
			usage.TotalTokens = 1
		}
		if usage.PromptTokens == 0 {
			usage.PromptTokens = 1
		}
		// Apply n ratio
		imageN := uint(1)
		if request.N != nil {
			imageN = *request.N
		}
		if info.PriceData.UsePrice {
			if _, hasN := info.PriceData.OtherRatios["n"]; !hasN {
				info.PriceData.AddOtherRatio("n", float64(imageN))
			}
		}
	} else {
		logger.LogWarn(c, fmt.Sprintf("failed to parse usage from async image response: %v", err))
	}

	return &AsyncImageResult{
		TaskID:  taskID,
		RawBody: rawBody,
	}, nil
}

// GetAdaptorFromRelayInfo returns the channel adaptor for the given relay info.
// Exported for use by the controller.
func GetAdaptorFromRelayInfo(info *relaycommon.RelayInfo) channel.Adaptor {
	return GetAdaptor(info.ApiType)
}
