package relay

import (
	"errors"
	"fmt"
	"io"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

// DecisionsHelper relays one non-streaming Decisions attempt through a supported
// channel, applying model mapping and parameter overrides. It validates the
// response and usage before settling quota and forwarding the original JSON;
// errors are returned to the caller for retry or refund handling.
func DecisionsHelper(c *gin.Context, info *relaycommon.RelayInfo) *types.NewAPIError {
	info.InitChannelMeta(c)
	switch info.ChannelType {
	case constant.ChannelTypeOpenAI, constant.ChannelTypeNewAPI:
	default:
		return types.NewError(errors.New("channel does not support /v1/decisions"), types.ErrorCodeInvalidRequest)
	}
	original, ok := info.Request.(*dto.OpenAIDecisionsRequest)
	if !ok {
		return types.NewError(errors.New("invalid Decisions request type"), types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
	}
	// Each channel attempt starts with the client's model and questions.
	request := *original
	if err := helper.ModelMappedHelper(c, info, &request); err != nil {
		return types.NewError(err, types.ErrorCodeChannelModelMappedError, types.ErrOptionWithSkipRetry())
	}
	// Streaming is not part of this endpoint's upstream protocol.
	request.Stream = nil
	bodyBytes, err := common.Marshal(request)
	if err != nil {
		return types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}
	if len(info.ParamOverride) > 0 {
		bodyBytes, err = relaycommon.ApplyParamOverrideWithRelayInfo(bodyBytes, info)
		if err != nil {
			return newAPIErrorFromParamOverride(err)
		}
		var overridden dto.OpenAIDecisionsRequest
		if err = common.Unmarshal(bodyBytes, &overridden); err == nil {
			err = overridden.Validate()
		}
		if err != nil {
			return types.NewErrorWithStatusCode(err, types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
		}
		request = overridden
	}
	body, closer, err := relaycommon.NewOutboundJSONBody(bodyBytes)
	if err != nil {
		return types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}
	defer closer.Close()
	adaptor := GetAdaptor(info.ApiType)
	if adaptor == nil {
		return types.NewError(fmt.Errorf("invalid api type: %d", info.ApiType), types.ErrorCodeInvalidApiType, types.ErrOptionWithSkipRetry())
	}
	adaptor.Init(info)
	response, err := adaptor.DoRequest(c, info, body)
	if err != nil {
		return types.NewOpenAIError(err, types.ErrorCodeDoRequestFailed, http.StatusBadGateway)
	}
	resp, ok := response.(*http.Response)
	if !ok || resp == nil {
		return types.NewOpenAIError(errors.New("invalid Decisions HTTP response"), types.ErrorCodeDoRequestFailed, http.StatusBadGateway)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		apiErr := service.RelayErrorHandler(c.Request.Context(), resp, false)
		service.ResetStatusCode(apiErr, c.GetString("status_code_mapping"))
		return apiErr
	}
	info.SetFirstResponseTime()
	responseBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return types.NewOpenAIError(err, types.ErrorCodeDoRequestFailed, http.StatusBadGateway)
	}
	usage, responseModel, err := dto.DecodeDecisionUsage(responseBytes, request.Questions)
	if err != nil {
		return types.NewOpenAIError(err, types.ErrorCodeDoRequestFailed, http.StatusBadGateway)
	}
	info.ObserveResponseModel(responseModel)
	// Settle exactly once after validating a complete upstream response, even
	// when the client disconnects while the resulting answer is being written.
	service.PostTextConsumeQuota(c, info, usage, nil)
	c.Data(http.StatusOK, "application/json", responseBytes)
	return nil
}
