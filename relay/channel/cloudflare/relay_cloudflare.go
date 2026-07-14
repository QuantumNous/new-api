package cloudflare

import (
	"bufio"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"
	"github.com/samber/lo"

	"github.com/gin-gonic/gin"
)

// cloudflareUpstreamError extracts both OpenAI-compatible and native
// Cloudflare error envelopes without classifying valid success payloads.
func cloudflareUpstreamError(responseBody []byte) *types.OpenAIError {
	var envelope struct {
		Success *bool  `json:"success"`
		Message string `json:"message"`
		Error   any    `json:"error"`
		Errors  []struct {
			Code    any    `json:"code"`
			Message string `json:"message"`
		} `json:"errors"`
	}
	if err := common.Unmarshal(responseBody, &envelope); err != nil {
		return nil
	}
	if upstreamErr := dto.GetOpenAIError(envelope.Error); upstreamErr != nil &&
		(upstreamErr.Message != "" || upstreamErr.Type != "" || upstreamErr.Code != nil) {
		return upstreamErr
	}
	if len(envelope.Errors) > 0 {
		return &types.OpenAIError{
			Message: strings.TrimSpace(envelope.Errors[0].Message),
			Type:    "upstream_error",
			Code:    envelope.Errors[0].Code,
		}
	}
	if message := strings.TrimSpace(envelope.Message); message != "" {
		return &types.OpenAIError{Message: message, Type: "upstream_error", Code: "cloudflare_error"}
	}
	if envelope.Success != nil && !*envelope.Success {
		return &types.OpenAIError{Message: "cloudflare upstream returned success=false", Type: "upstream_error", Code: "cloudflare_error"}
	}
	return nil
}

// convertCf2CompletionsRequest maps the legacy completion prompt into the
// native Cloudflare request shape.
func convertCf2CompletionsRequest(textRequest dto.GeneralOpenAIRequest) *CfRequest {
	p, _ := textRequest.Prompt.(string)
	return &CfRequest{
		Prompt:      p,
		MaxTokens:   textRequest.GetMaxTokens(),
		Stream:      lo.FromPtrOr(textRequest.Stream, false),
		Temperature: textRequest.Temperature,
	}
}

// cfStreamHandler rejects malformed or business-error chunks before output and
// returns protocol errors in-stream only after real model content was written.
func cfStreamHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*types.NewAPIError, *dto.Usage) {
	defer service.CloseResponseBodyGracefully(resp)
	scanner := helper.NewStreamScanner(resp.Body)
	scanner.Split(bufio.ScanLines)

	helper.SetEventStreamHeaders(c)
	id := helper.GetResponseID(c)
	var responseText string
	isFirst := true
	sawDone := false
	var streamErr *types.NewAPIError

	for scanner.Scan() {
		data := scanner.Text()
		if len(data) < len("data: ") {
			continue
		}
		data = strings.TrimPrefix(data, "data: ")
		data = strings.TrimSuffix(data, "\r")

		if data == "[DONE]" {
			sawDone = true
			break
		}
		if upstreamErr := cloudflareUpstreamError([]byte(data)); upstreamErr != nil {
			streamErr = types.WithOpenAIError(*upstreamErr, types.NormalizeUpstreamErrorStatusCode(resp.StatusCode))
			break
		}

		var response dto.ChatCompletionsStreamResponse
		err := common.Unmarshal([]byte(data), &response)
		if err != nil {
			logger.LogError(c, "error_unmarshalling_stream_response: "+err.Error())
			streamErr = types.NewOpenAIError(err, types.ErrorCodeBadResponse, http.StatusBadGateway)
			break
		}
		if len(response.Choices) == 0 && response.Usage == nil {
			streamErr = types.NewOpenAIError(errors.New("cloudflare upstream returned an empty stream event"), types.ErrorCodeBadResponse, types.NormalizeUpstreamErrorStatusCode(resp.StatusCode))
			break
		}
		for _, choice := range response.Choices {
			choice.Delta.Role = "assistant"
			responseText += choice.Delta.GetContentString()
		}
		response.Id = id
		response.Model = info.UpstreamModelName
		err = helper.ObjectData(c, response)
		if isFirst {
			isFirst = false
			info.FirstResponseTime = time.Now()
		}
		if err != nil {
			logger.LogError(c, "error_rendering_stream_response: "+err.Error())
			streamErr = types.NewOpenAIError(err, types.ErrorCodeBadResponse, http.StatusBadGateway)
			break
		}
	}

	if streamErr == nil {
		if err := scanner.Err(); err != nil {
			logger.LogError(c, "error_scanning_stream_response: "+err.Error())
			streamErr = types.NewOpenAIError(err, types.ErrorCodeBadResponse, http.StatusBadGateway)
		} else if !sawDone {
			streamErr = types.NewOpenAIError(io.ErrUnexpectedEOF, types.ErrorCodeBadResponse, http.StatusBadGateway)
		}
	}
	if streamErr != nil {
		if !helper.HasWrittenUpstreamResponse(c) {
			return streamErr, nil
		}
		_ = helper.ObjectData(c, gin.H{"error": streamErr.ToOpenAIError()})
		usage := service.ResponseText2Usage(c, responseText, info.UpstreamModelName, info.GetEstimatePromptTokens())
		return nil, usage
	}
	if err := scanner.Err(); err != nil {
		logger.LogError(c, "error_scanning_stream_response: "+err.Error())
	}
	usage := service.ResponseText2Usage(c, responseText, info.UpstreamModelName, info.GetEstimatePromptTokens())
	if info.ShouldIncludeUsage {
		response := helper.GenerateFinalUsageResponse(id, info.StartTime.Unix(), info.UpstreamModelName, *usage)
		err := helper.ObjectData(c, response)
		if err != nil {
			logger.LogError(c, "error_rendering_final_usage_response: "+err.Error())
		}
	}
	helper.Done(c)

	return nil, usage
}

// cfHandler validates chat and embedding schemas separately so provider error
// envelopes cannot be serialized as empty successful OpenAI responses.
func cfHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*types.NewAPIError, *dto.Usage) {
	defer service.CloseResponseBodyGracefully(resp)
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return types.NewError(err, types.ErrorCodeBadResponseBody), nil
	}
	if upstreamErr := cloudflareUpstreamError(responseBody); upstreamErr != nil {
		return types.WithOpenAIError(*upstreamErr, types.NormalizeUpstreamErrorStatusCode(resp.StatusCode)), nil
	}
	if info.RelayMode == relayconstant.RelayModeEmbeddings {
		var response dto.OpenAIEmbeddingResponse
		if err := common.Unmarshal(responseBody, &response); err != nil {
			return types.NewError(err, types.ErrorCodeBadResponseBody), nil
		}
		if len(response.Data) == 0 {
			return types.NewOpenAIError(errors.New("cloudflare upstream returned an empty embedding response"), types.ErrorCodeBadResponse, types.NormalizeUpstreamErrorStatusCode(resp.StatusCode)), nil
		}
		response.Model = info.UpstreamModelName
		if response.Usage.PromptTokens == 0 {
			response.Usage.PromptTokens = info.GetEstimatePromptTokens()
			response.Usage.TotalTokens = response.Usage.PromptTokens + response.Usage.CompletionTokens
		}
		jsonResponse, err := common.Marshal(response)
		if err != nil {
			return types.NewError(err, types.ErrorCodeBadResponseBody), nil
		}
		c.Writer.Header().Set("Content-Type", "application/json")
		c.Writer.WriteHeader(resp.StatusCode)
		_, _ = c.Writer.Write(jsonResponse)
		return nil, &response.Usage
	}
	var response dto.TextResponse
	err = common.Unmarshal(responseBody, &response)
	if err != nil {
		return types.NewError(err, types.ErrorCodeBadResponseBody), nil
	}
	if len(response.Choices) == 0 {
		return types.NewOpenAIError(errors.New("cloudflare upstream returned an empty chat response"), types.ErrorCodeBadResponse, types.NormalizeUpstreamErrorStatusCode(resp.StatusCode)), nil
	}
	response.Model = info.UpstreamModelName
	var responseText string
	for _, choice := range response.Choices {
		responseText += choice.Message.StringContent()
	}
	usage := service.ResponseText2Usage(c, responseText, info.UpstreamModelName, info.GetEstimatePromptTokens())
	response.Usage = *usage
	response.Id = helper.GetResponseID(c)
	jsonResponse, err := common.Marshal(response)
	if err != nil {
		return types.NewError(err, types.ErrorCodeBadResponseBody), nil
	}
	c.Writer.Header().Set("Content-Type", "application/json")
	c.Writer.WriteHeader(resp.StatusCode)
	_, _ = c.Writer.Write(jsonResponse)
	return nil, usage
}

// cfSTTHandler converts native transcription results while preserving
// upstream business errors and response-body lifecycle guarantees.
func cfSTTHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*types.NewAPIError, *dto.Usage) {
	defer service.CloseResponseBodyGracefully(resp)
	var cfResp CfAudioResponse
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return types.NewError(err, types.ErrorCodeBadResponseBody), nil
	}
	if upstreamErr := cloudflareUpstreamError(responseBody); upstreamErr != nil {
		return types.WithOpenAIError(*upstreamErr, types.NormalizeUpstreamErrorStatusCode(resp.StatusCode)), nil
	}
	err = common.Unmarshal(responseBody, &cfResp)
	if err != nil {
		return types.NewError(err, types.ErrorCodeBadResponseBody), nil
	}

	audioResp := &dto.AudioResponse{
		Text: cfResp.Result.Text,
	}

	jsonResponse, err := common.Marshal(audioResp)
	if err != nil {
		return types.NewError(err, types.ErrorCodeBadResponseBody), nil
	}
	c.Writer.Header().Set("Content-Type", "application/json")
	c.Writer.WriteHeader(resp.StatusCode)
	_, _ = c.Writer.Write(jsonResponse)

	usage := service.ResponseText2Usage(c, cfResp.Result.Text, info.UpstreamModelName, info.GetEstimatePromptTokens())
	return nil, usage
}
