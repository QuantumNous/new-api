package relay

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

func AudioHelper(c *gin.Context, info *relaycommon.RelayInfo) (newAPIError *types.NewAPIError) {
	info.InitChannelMeta(c)

	audioReq, ok := info.Request.(*dto.AudioRequest)
	voiceCloneReq, cloneOK := info.Request.(*dto.AudioVoiceCloneRequest)
	if !ok && !cloneOK {
		return types.NewError(errors.New("invalid request type"), types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
	}

	err := helper.ModelMappedHelper(c, info, info.Request)
	if err != nil {
		return types.NewError(err, types.ErrorCodeChannelModelMappedError, types.ErrOptionWithSkipRetry())
	}

	adaptor := GetAdaptor(info.ApiType)
	if adaptor == nil {
		return types.NewError(fmt.Errorf("invalid api type: %d", info.ApiType), types.ErrorCodeInvalidApiType, types.ErrOptionWithSkipRetry())
	}
	adaptor.Init(info)

	request := dto.AudioRequest{}
	if ok {
		copied, copyErr := common.DeepCopy(audioReq)
		if copyErr != nil {
			return types.NewError(fmt.Errorf("failed to copy request to AudioRequest: %w", copyErr), types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
		}
		request = *copied
	} else if cloneOK {
		request.Model = voiceCloneReq.Model
		request.Input = voiceCloneReq.Text
	}

	ioReader, err := adaptor.ConvertAudioRequest(c, info, request)
	if err != nil {
		return types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}

	resp, err := adaptor.DoRequest(c, info, ioReader)
	if err != nil {
		return types.NewOpenAIError(err, types.ErrorCodeDoRequestFailed, http.StatusInternalServerError)
	}
	statusCodeMappingStr := c.GetString("status_code_mapping")

	var httpResp *http.Response
	if resp != nil {
		httpResp = resp.(*http.Response)
		if httpResp.StatusCode != http.StatusOK {
			newAPIError = service.RelayErrorHandler(c.Request.Context(), httpResp, false)
			// reset status code 重置状态码
			service.ResetStatusCode(newAPIError, statusCodeMappingStr)
			return newAPIError
		}
	}

	usage, newAPIError := adaptor.DoResponse(c, httpResp, info)
	if newAPIError != nil {
		// reset status code 重置状态码
		service.ResetStatusCode(newAPIError, statusCodeMappingStr)
		return newAPIError
	}
	if usage.(*dto.Usage).CompletionTokenDetails.AudioTokens > 0 || usage.(*dto.Usage).PromptTokensDetails.AudioTokens > 0 {
		service.PostAudioConsumeQuota(c, info, usage.(*dto.Usage), "")
	} else {
		service.PostTextConsumeQuota(c, info, usage.(*dto.Usage), nil)
	}

	return nil
}
