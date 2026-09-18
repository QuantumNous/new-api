package relay

import (
	"errors"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relay/channel"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

func DecisionsHelper(c *gin.Context, info *relaycommon.RelayInfo) *types.NewAPIError {
	info.InitChannelMeta(c)
	original, ok := info.Request.(*dto.DecisionsRequest)
	if !ok {
		return types.NewError(errors.New("invalid decisions request"), types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
	}
	request, err := common.DeepCopy(original)
	if err != nil {
		return types.NewError(err, types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
	}
	if err = helper.ModelMappedHelper(c, info, request); err != nil {
		return types.NewError(err, types.ErrorCodeChannelModelMappedError, types.ErrOptionWithSkipRetry())
	}
	adaptor := GetAdaptor(info.ApiType)
	decisions, ok := adaptor.(channel.DecisionsAdaptor)
	if !ok {
		return types.NewErrorWithStatusCode(errors.New("channel does not support decisions"), types.ErrorCodeInvalidApiType, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}
	adaptor.Init(info)
	jsonData, err := common.Marshal(request)
	if err != nil {
		return types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}
	// Even with body passthrough enabled, decisions must keep model mapping and
	// request validation. Validate the final overrides before calling upstream.
	if len(info.ParamOverride) > 0 {
		jsonData, err = relaycommon.ApplyParamOverrideWithRelayInfo(jsonData, info)
		if err != nil {
			return newAPIErrorFromParamOverride(err)
		}
		request = &dto.DecisionsRequest{}
		if err = common.Unmarshal(jsonData, request); err != nil {
			return types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
		}
	}
	converted, err := decisions.ConvertDecisionsRequest(c, info, request)
	if err != nil {
		return types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}
	jsonData, err = common.Marshal(converted)
	if err != nil {
		return types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}
	body, closer, err := relaycommon.NewOutboundJSONBody(jsonData)
	if err != nil {
		return types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}
	defer closer.Close()
	response, err := adaptor.DoRequest(c, info, body)
	if err != nil {
		return types.NewOpenAIError(err, types.ErrorCodeDoRequestFailed, http.StatusBadGateway)
	}
	httpResponse, ok := response.(*http.Response)
	if !ok || httpResponse == nil {
		return types.NewError(errors.New("missing upstream response"), types.ErrorCodeBadResponseBody)
	}
	statusMapping := c.GetString("status_code_mapping")
	if httpResponse.StatusCode != http.StatusOK {
		apiErr := service.RelayErrorHandler(c.Request.Context(), httpResponse, false)
		service.ResetStatusCode(apiErr, statusMapping)
		return apiErr
	}
	usage, apiErr := adaptor.DoResponse(c, httpResponse, info)
	if apiErr != nil {
		service.ResetStatusCode(apiErr, statusMapping)
		return apiErr
	}
	service.PostTextConsumeQuota(c, info, usage.(*dto.Usage), nil)
	return nil
}
