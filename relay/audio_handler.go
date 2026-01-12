package relay

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

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

	if resp == nil {
		return types.NewError(errors.New("adaptor returned nil response"), types.ErrorCodeBadResponse, types.ErrOptionWithSkipRetry())
	}
	httpResp, ok := resp.(*http.Response)
	if !ok {
		return types.NewError(errors.New("invalid response type, expected *http.Response"), types.ErrorCodeBadResponse, types.ErrOptionWithSkipRetry())
	}

	if httpResp.StatusCode != http.StatusOK {
		newAPIError = service.RelayErrorHandler(c.Request.Context(), httpResp, false)
		service.ResetStatusCode(newAPIError, statusCodeMappingStr)
		return newAPIError
	}

	contentType := httpResp.Header.Get("Content-Type")
	if strings.HasPrefix(contentType, "audio/") && request.IsStream(c) {
		defer func() {
			if closeErr := httpResp.Body.Close(); closeErr != nil {
				common.SysError(fmt.Sprintf("failed to close response body: %s", closeErr.Error()))
			}
		}()

		for k, vv := range httpResp.Header {
			if k == "Content-Length" || k == "Transfer-Encoding" || k == "Connection" {
				continue
			}
			for _, v := range vv {
				c.Writer.Header().Add(k, v)
			}
		}
		c.Writer.WriteHeader(httpResp.StatusCode)

		flusher, ok := c.Writer.(http.Flusher)
		if !ok {
			common.SysError("ResponseWriter does not support Flusher, streaming may be buffered")
		} else {
			flusher.Flush()
		}

		info.FirstResponseTime = time.Now()

		_, err = io.Copy(c.Writer, httpResp.Body)
		if err != nil {
			common.SysError(fmt.Sprintf("audio streaming failed: %s | channel: %d | model: %s", err.Error(), info.ChannelId, request.Model))
			return nil
		}

		if flusher != nil {
			flusher.Flush()
		}

		promptTokens := utf8.RuneCountInString(request.Input)

		usage := &dto.Usage{
			PromptTokens: promptTokens,
			TotalTokens:  promptTokens,
			PromptTokensDetails: dto.InputTokenDetails{
				TextTokens:  promptTokens,
				AudioTokens: 0,
			},
		}

		postConsumeQuota(c, info, usage)

		return nil
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
