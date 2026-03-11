package relay

import (
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

func AudioHelper(c *gin.Context, info *relaycommon.RelayInfo) (newAPIError *types.NewAPIError) {
	info.InitChannelMeta(c)

	audioReq, ok := info.Request.(*dto.AudioRequest)
	if !ok {
		return types.NewError(errors.New("invalid request type"), types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
	}

	request, err := common.DeepCopy(audioReq)
	if err != nil {
		return types.NewError(fmt.Errorf("failed to copy request to AudioRequest: %w", err), types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
	}

	err = helper.ModelMappedHelper(c, info, request)
	if err != nil {
		return types.NewError(err, types.ErrorCodeChannelModelMappedError, types.ErrOptionWithSkipRetry())
	}

	err = applyAudioParamOverride(c, info, request)
	if err != nil {
		return newAPIErrorFromParamOverride(err)
	}

	adaptor := GetAdaptor(info.ApiType)
	if adaptor == nil {
		return types.NewError(fmt.Errorf("invalid api type: %d", info.ApiType), types.ErrorCodeInvalidApiType, types.ErrOptionWithSkipRetry())
	}
	adaptor.Init(info)

	ioReader, err := adaptor.ConvertAudioRequest(c, info, *request)
	if err != nil {
		return types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}

	resp, err := adaptor.DoRequest(c, info, ioReader)
	if err != nil {
		return types.NewError(err, types.ErrorCodeDoRequestFailed)
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
		postConsumeQuota(c, info, usage.(*dto.Usage))
	}

	return nil
}

func applyAudioParamOverride(c *gin.Context, info *relaycommon.RelayInfo, request *dto.AudioRequest) error {
	if info == nil || (len(info.ParamOverride) == 0 && (info.ChannelMeta == nil || len(info.ChannelMeta.ParamOverride) == 0)) {
		return nil
	}

	if isMultipartAudioRequest(c, info) {
		return applyMultipartAudioParamOverride(c, info, request)
	}

	jsonData, err := common.Marshal(request)
	if err != nil {
		return err
	}

	jsonData, err = relaycommon.ApplyParamOverrideWithRelayInfo(jsonData, info)
	if err != nil {
		return err
	}

	if err = common.Unmarshal(jsonData, request); err != nil {
		return err
	}
	info.Request = request
	return nil
}

func isMultipartAudioRequest(c *gin.Context, info *relaycommon.RelayInfo) bool {
	if c == nil || c.Request == nil || info == nil {
		return false
	}
	if info.RelayMode == relayconstant.RelayModeAudioSpeech {
		return false
	}
	return strings.Contains(c.Request.Header.Get("Content-Type"), gin.MIMEMultipartPOSTForm)
}

func applyMultipartAudioParamOverride(c *gin.Context, info *relaycommon.RelayInfo, request *dto.AudioRequest) error {
	form, err := common.ParseMultipartFormReusable(c)
	if err != nil {
		return err
	}

	formMap := make(map[string]any, len(form.Value))
	for key, values := range form.Value {
		if len(values) == 1 {
			formMap[key] = values[0]
			continue
		}
		formMap[key] = values
	}

	jsonData, err := common.Marshal(formMap)
	if err != nil {
		return err
	}

	jsonData, err = relaycommon.ApplyParamOverrideWithRelayInfo(jsonData, info)
	if err != nil {
		return err
	}

	effectiveForm := make(map[string]any)
	if err = common.Unmarshal(jsonData, &effectiveForm); err != nil {
		return err
	}
	common.SetContextKey(c, constant.ContextKeyAudioFormOverride, effectiveForm)

	if err = common.Unmarshal(jsonData, request); err != nil {
		return err
	}
	info.Request = request
	return nil
}
