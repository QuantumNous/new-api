package relay

import (
	"errors"
	"fmt"
	"io"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

// SystemOneHelper relays a TypeSafe System One decision request to an Ollama
// channel. The protocol is the same on both sides, so the body is forwarded
// with state and questions as raw JSON (member order preserved) and the
// upstream answer is returned to the client verbatim; only the mapped model
// name and the billable input-token usage are rewritten by the gateway.
func SystemOneHelper(c *gin.Context, info *relaycommon.RelayInfo) (newAPIError *types.NewAPIError) {
	info.InitChannelMeta(c)

	request, ok := info.Request.(*dto.SystemOneRequest)
	if !ok {
		return types.NewErrorWithStatusCode(fmt.Errorf("invalid request type, expected dto.SystemOneRequest, got %T", info.Request), types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}

	if info.ChannelType != constant.ChannelTypeOllama {
		return types.NewErrorWithStatusCode(errors.New("the systemone endpoint is only supported on Ollama channels"), types.ErrorCodeInvalidApiType, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}

	if err := helper.ModelMappedHelper(c, info, request); err != nil {
		return types.NewError(err, types.ErrorCodeChannelModelMappedError, types.ErrOptionWithSkipRetry())
	}

	adaptor := GetAdaptor(info.ApiType)
	if adaptor == nil {
		return types.NewError(fmt.Errorf("invalid api type: %d", info.ApiType), types.ErrorCodeInvalidApiType, types.ErrOptionWithSkipRetry())
	}
	adaptor.Init(info)

	jsonData, err := common.Marshal(request)
	if err != nil {
		return types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}
	logger.LogDebug(c, "systemone request body: %s", jsonData)
	body, closer, err := relaycommon.NewOutboundJSONBody(jsonData)
	if err != nil {
		return types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}
	defer closer.Close()

	resp, err := adaptor.DoRequest(c, info, body)
	if err != nil {
		return types.NewOpenAIError(err, types.ErrorCodeDoRequestFailed, http.StatusInternalServerError)
	}

	statusCodeMappingStr := c.GetString("status_code_mapping")
	httpResp, ok := resp.(*http.Response)
	if !ok || httpResp == nil {
		return types.NewError(errors.New("systemone upstream returned no response"), types.ErrorCodeBadResponse, types.ErrOptionWithSkipRetry())
	}
	if httpResp.StatusCode != http.StatusOK {
		newAPIError = service.RelayErrorHandler(c.Request.Context(), httpResp, false)
		service.ResetStatusCode(newAPIError, statusCodeMappingStr)
		return newAPIError
	}

	responseBody, err := io.ReadAll(httpResp.Body)
	service.CloseResponseBodyGracefully(httpResp)
	if err != nil {
		return types.NewOpenAIError(err, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError)
	}
	logger.LogDebug(c, "systemone response body: %s", responseBody)

	// The billable quantity is the upstream-reported input token count. A
	// missing usage field must fail the request rather than bill zero.
	parsed := &dto.SystemOneResponse{}
	if err := common.Unmarshal(responseBody, parsed); err != nil {
		return types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	if parsed.Usage.InputTokens < 0 {
		return types.NewOpenAIError(errors.New("systemone response has invalid input token usage"), types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}

	c.Data(httpResp.StatusCode, "application/json", responseBody)
	usage := &dto.Usage{
		PromptTokens: parsed.Usage.InputTokens,
		TotalTokens:  parsed.Usage.InputTokens,
	}
	service.PostTextConsumeQuota(c, info, usage, nil)
	return nil
}
