package relay

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

// VolcImageHelper handles the /api/v3/images/generations endpoint using the
// native Volc Ark API format (RelayFormatVolc).
//
// The request body is forwarded byte-identical to the upstream Volc API;
// no field transformation is performed so Volc-specific fields such as
// sequential_image_generation, optimize_prompt_options, watermark, 2K/4K
// size literals etc. are preserved as-is.
//
// This mirrors the structure of GeminiHelper; the key difference is that
// the upstream URL is always the Volc /api/v3/images/generations path and
// ConvertVolcRequest is used (which is a no-op for volcengine/volcadapter
// channels and returns "unsupported" for all other channel types).
func VolcImageHelper(c *gin.Context, info *relaycommon.RelayInfo) (newAPIError *types.NewAPIError) {
	info.InitChannelMeta(c)

	volcReq, ok := info.Request.(*dto.VolcImageRequest)
	if !ok {
		return types.NewErrorWithStatusCode(
			fmt.Errorf("invalid request type, expected *dto.VolcImageRequest, got %T", info.Request),
			types.ErrorCodeInvalidRequest,
			http.StatusBadRequest,
			types.ErrOptionWithSkipRetry(),
		)
	}

	request, err := common.DeepCopy(volcReq)
	if err != nil {
		return types.NewError(
			fmt.Errorf("failed to copy VolcImageRequest: %w", err),
			types.ErrorCodeInvalidRequest,
			types.ErrOptionWithSkipRetry(),
		)
	}

	// model mapped 模型映射
	if err = helper.ModelMappedHelper(c, info, request); err != nil {
		return types.NewError(err, types.ErrorCodeChannelModelMappedError, types.ErrOptionWithSkipRetry())
	}

	adaptor := GetAdaptor(info.ApiType)
	if adaptor == nil {
		return types.NewError(
			fmt.Errorf("invalid api type: %d", info.ApiType),
			types.ErrorCodeInvalidApiType,
			types.ErrOptionWithSkipRetry(),
		)
	}
	adaptor.Init(info)

	// ConvertVolcRequest is a no-op for volcengine/volcadapter channels;
	// it returns an error for all other channel types.
	if _, err = adaptor.ConvertVolcRequest(c, info, request); err != nil {
		return types.NewErrorWithStatusCode(err, types.ErrorCodeConvertRequestFailed, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}

	// Always forward the original raw body byte-identical to upstream.
	// This ensures Volc-specific fields that are not captured by
	// VolcImageRequest survive the round-trip.
	storage, storageErr := common.GetBodyStorage(c)
	if storageErr != nil {
		return types.NewErrorWithStatusCode(storageErr, types.ErrorCodeReadRequestBodyFailed, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}
	requestBody := common.ReaderOnly(storage)

	logger.LogDebug(c, fmt.Sprintf("Volc image request model: %s -> %s", info.OriginModelName, info.UpstreamModelName))

	resp, doErr := adaptor.DoRequest(c, info, requestBody)
	if doErr != nil {
		logger.LogError(c, "Do volc request failed: "+doErr.Error())
		return types.NewOpenAIError(doErr, types.ErrorCodeDoRequestFailed, http.StatusInternalServerError)
	}

	statusCodeMappingStr := c.GetString("status_code_mapping")

	var httpResp *http.Response
	if resp != nil {
		httpResp = resp.(*http.Response)
		info.IsStream = info.IsStream || strings.HasPrefix(httpResp.Header.Get("Content-Type"), "text/event-stream")
		if httpResp.StatusCode != http.StatusOK {
			newAPIError = service.RelayErrorHandler(c.Request.Context(), httpResp, false)
			service.ResetStatusCode(newAPIError, statusCodeMappingStr)
			return newAPIError
		}
	}

	usage, openaiErr := adaptor.DoResponse(c, httpResp, info)
	if openaiErr != nil {
		service.ResetStatusCode(openaiErr, statusCodeMappingStr)
		return openaiErr
	}

	service.PostTextConsumeQuota(c, info, usage.(*dto.Usage), nil)
	return nil
}
