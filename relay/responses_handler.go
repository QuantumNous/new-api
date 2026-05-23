package relay

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	appconstant "github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	relaychannel "github.com/QuantumNous/new-api/relay/channel"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

func ResponsesHelper(c *gin.Context, info *relaycommon.RelayInfo) (newAPIError *types.NewAPIError) {
	info.InitChannelMeta(c)
	if info.RelayMode == relayconstant.RelayModeResponsesCompact {
		switch info.ApiType {
		case appconstant.APITypeOpenAI, appconstant.APITypeCodex:
		default:
			return types.NewErrorWithStatusCode(
				fmt.Errorf("unsupported endpoint %q for api type %d", "/v1/responses/compact", info.ApiType),
				types.ErrorCodeInvalidRequest,
				http.StatusBadRequest,
				types.ErrOptionWithSkipRetry(),
			)
		}
	}

	var responsesReq *dto.OpenAIResponsesRequest
	switch req := info.Request.(type) {
	case *dto.OpenAIResponsesRequest:
		responsesReq = req
	case *dto.OpenAIResponsesCompactionRequest:
		responsesReq = &dto.OpenAIResponsesRequest{
			Model:              req.Model,
			Input:              req.Input,
			Instructions:       req.Instructions,
			PreviousResponseID: req.PreviousResponseID,
		}
	default:
		return types.NewErrorWithStatusCode(
			fmt.Errorf("invalid request type, expected dto.OpenAIResponsesRequest or dto.OpenAIResponsesCompactionRequest, got %T", info.Request),
			types.ErrorCodeInvalidRequest,
			http.StatusBadRequest,
			types.ErrOptionWithSkipRetry(),
		)
	}

	request, err := common.DeepCopy(responsesReq)
	if err != nil {
		return types.NewError(fmt.Errorf("failed to copy request to GeneralOpenAIRequest: %w", err), types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
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
	var requestBodyBytes []byte
	var requestBodyCloser io.Closer
	defer func() {
		if requestBodyCloser != nil {
			_ = requestBodyCloser.Close()
		}
	}()
	if model_setting.GetGlobalSettings().PassThroughRequestEnabled || info.ChannelSetting.PassThroughBodyEnabled {
		storage, err := common.GetBodyStorage(c)
		if err != nil {
			return types.NewError(err, types.ErrorCodeReadRequestBodyFailed, types.ErrOptionWithSkipRetry())
		}
		requestBody = common.ReaderOnly(storage)
		info.UpstreamRequestBodySize = storage.Size()
		if shouldUseResponsesTranscriptReplay(info) {
			if bodyBytes, err := storage.Bytes(); err == nil {
				requestBodyBytes = append([]byte(nil), bodyBytes...)
				relaycommon.PrepareResponsesTranscriptReplay(info, requestBodyBytes)
			} else {
				logger.LogWarn(c, fmt.Sprintf("codex responses transcript replay disabled: read pass-through body failed: %s", err.Error()))
			}
		}
	} else {
		convertedRequest, err := adaptor.ConvertOpenAIResponsesRequest(c, info, *request)
		if err != nil {
			return types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
		}
		relaycommon.AppendRequestConversionFromRequest(info, convertedRequest)
		jsonData, err := common.Marshal(convertedRequest)
		if err != nil {
			return types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
		}

		// remove disabled fields for OpenAI Responses API
		jsonData, err = relaycommon.RemoveDisabledFields(jsonData, info.ChannelOtherSettings, info.ChannelSetting.PassThroughBodyEnabled)
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

		logger.LogDebug(c, "requestBody: %s", jsonData)
		requestBodyBytes = append([]byte(nil), jsonData...)
		if shouldUseResponsesTranscriptReplay(info) {
			relaycommon.PrepareResponsesTranscriptReplay(info, requestBodyBytes)
		}
		body, closer, newAPIError := newResponsesOutboundJSONBody(info, requestBodyBytes)
		if newAPIError != nil {
			return newAPIError
		}
		requestBodyCloser = closer
		jsonData = nil
		requestBody = body
	}

	var httpResp *http.Response
	resp, err := adaptor.DoRequest(c, info, requestBody)
	if err != nil {
		return types.NewOpenAIError(err, types.ErrorCodeDoRequestFailed, http.StatusInternalServerError)
	}

	statusCodeMappingStr := c.GetString("status_code_mapping")

	if resp != nil {
		httpResp = resp.(*http.Response)

		if httpResp.StatusCode != http.StatusOK {
			if shouldUseResponsesTranscriptReplay(info) {
				httpResp, newAPIError = retryCodexResponsesTranscriptReplay(c, info, adaptor, httpResp, requestBodyBytes, statusCodeMappingStr)
				if newAPIError != nil {
					return newAPIError
				}
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
	if shouldUseResponsesTranscriptReplay(info) {
		relaycommon.CommitResponsesTranscriptReplay(info)
	}

	usageDto := usage.(*dto.Usage)
	if info.RelayMode == relayconstant.RelayModeResponsesCompact {
		originModelName := info.OriginModelName
		originPriceData := info.PriceData

		_, err := helper.ModelPriceHelper(c, info, info.GetEstimatePromptTokens(), &types.TokenCountMeta{})
		if err != nil {
			info.OriginModelName = originModelName
			info.PriceData = originPriceData
			return types.NewError(err, types.ErrorCodeModelPriceError, types.ErrOptionWithSkipRetry(), types.ErrOptionWithStatusCode(http.StatusBadRequest))
		}
		service.PostTextConsumeQuota(c, info, usageDto, nil)

		info.OriginModelName = originModelName
		info.PriceData = originPriceData
		return nil
	}

	if strings.HasPrefix(info.OriginModelName, "gpt-4o-audio") {
		service.PostAudioConsumeQuota(c, info, usageDto, "")
	} else {
		service.PostTextConsumeQuota(c, info, usageDto, nil)
	}
	return nil
}

func shouldUseResponsesTranscriptReplay(info *relaycommon.RelayInfo) bool {
	if info == nil || info.RelayMode != relayconstant.RelayModeResponses {
		return false
	}
	if info.ApiType == appconstant.APITypeCodex {
		return true
	}
	return info.ChannelOtherSettings.ResponsesTranscriptReplayEnabled
}

func newResponsesOutboundJSONBody(info *relaycommon.RelayInfo, requestBody []byte) (io.Reader, io.Closer, *types.NewAPIError) {
	body, size, closer, err := relaycommon.NewOutboundJSONBody(requestBody)
	if err != nil {
		return nil, nil, types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}
	if info != nil {
		info.UpstreamRequestBodySize = size
	}
	return body, closer, nil
}

func retryCodexResponsesTranscriptReplay(
	c *gin.Context,
	info *relaycommon.RelayInfo,
	adaptor relaychannel.Adaptor,
	httpResp *http.Response,
	requestBodyBytes []byte,
	statusCodeMappingStr string,
) (*http.Response, *types.NewAPIError) {
	responseBody, readErr := captureHTTPErrorBody(httpResp)
	if readErr != nil {
		newAPIError := types.NewOpenAIError(readErr, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError, types.ErrOptionWithSkipRetry())
		service.ResetStatusCode(newAPIError, statusCodeMappingStr)
		return nil, newAPIError
	}

	if !shouldRetryResponsesTranscriptReplay(httpResp.StatusCode, responseBody, requestBodyBytes) {
		return nil, newAPIErrorFromCapturedHTTPError(c, httpResp, responseBody, statusCodeMappingStr, false)
	}

	replayBody, ok, reason := relaycommon.BuildResponsesTranscriptReplayRequest(info, requestBodyBytes)
	if !ok {
		logger.LogWarn(c, fmt.Sprintf("codex responses transcript replay skipped on channel #%d: %s", info.ChannelId, reason))
		return nil, newAPIErrorFromCapturedHTTPError(c, httpResp, responseBody, statusCodeMappingStr, true)
	}

	relaycommon.UpdateResponsesTranscriptReplayRequest(info, replayBody, true)
	replayRequestBody, replayCloser, newAPIError := newResponsesOutboundJSONBody(info, replayBody)
	if newAPIError != nil {
		return nil, markResponsesTranscriptReplaySkipRetry(newAPIError)
	}
	defer replayCloser.Close()

	logger.LogInfo(c, fmt.Sprintf("codex responses transcript replay on channel #%d: %s", info.ChannelId, reason))
	resp, err := adaptor.DoRequest(c, info, replayRequestBody)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeDoRequestFailed, http.StatusInternalServerError, types.ErrOptionWithSkipRetry())
	}
	replayResp := resp.(*http.Response)
	if replayResp.StatusCode == http.StatusOK {
		return replayResp, nil
	}

	replayResponseBody, readErr := captureHTTPErrorBody(replayResp)
	if readErr != nil {
		newAPIError := types.NewOpenAIError(readErr, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError, types.ErrOptionWithSkipRetry())
		service.ResetStatusCode(newAPIError, statusCodeMappingStr)
		return nil, newAPIError
	}
	return nil, newAPIErrorFromCapturedHTTPError(c, replayResp, replayResponseBody, statusCodeMappingStr, true)
}

func shouldRetryResponsesTranscriptReplay(statusCode int, responseBody []byte, requestBody []byte) bool {
	if relaycommon.IsResponsesTranscriptReplayError(statusCode, responseBody) {
		return true
	}
	return statusCode == http.StatusRequestEntityTooLarge &&
		relaycommon.ResponsesTranscriptReplayRequestHasEncryptedContent(requestBody)
}

func captureHTTPErrorBody(resp *http.Response) ([]byte, error) {
	if resp == nil || resp.Body == nil {
		return nil, fmt.Errorf("empty upstream error response")
	}
	responseBody, err := io.ReadAll(resp.Body)
	service.CloseResponseBodyGracefully(resp)
	if err != nil {
		return nil, err
	}
	return responseBody, nil
}

func newAPIErrorFromCapturedHTTPError(c *gin.Context, resp *http.Response, responseBody []byte, statusCodeMappingStr string, skipRetry bool) *types.NewAPIError {
	respCopy := *resp
	respCopy.Body = io.NopCloser(bytes.NewReader(responseBody))
	newAPIError := service.RelayErrorHandler(c.Request.Context(), &respCopy, false)
	if skipRetry {
		newAPIError = markResponsesTranscriptReplaySkipRetry(newAPIError)
	}
	service.ResetStatusCode(newAPIError, statusCodeMappingStr)
	return newAPIError
}

func markResponsesTranscriptReplaySkipRetry(newAPIError *types.NewAPIError) *types.NewAPIError {
	if newAPIError == nil {
		return nil
	}
	return types.NewError(newAPIError, newAPIError.GetErrorCode(), types.ErrOptionWithSkipRetry())
}
