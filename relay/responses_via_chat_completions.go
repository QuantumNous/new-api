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
	"github.com/QuantumNous/new-api/relay/channel"
	claudechannel "github.com/QuantumNous/new-api/relay/channel/claude"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/service/openaicompat"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

// responsesViaChatCompletions handles a /v1/responses request routed to an
// Anthropic-typed channel. It performs the two-step pivot:
//
//	Responses → ChatCompletions (in service/openaicompat)
//	ChatCompletions → Anthropic   (via the Claude adaptor / RequestOpenAI2ClaudeMessage)
//
// And on the response side:
//
//	Anthropic stream chunk → Chat-Completions chunk (StreamResponseClaude2OpenAI)
//	                       → Responses-API events    (ChatCompletionsStreamToResponsesEvents)
//
// or the non-streaming counterpart (ClaudeHandler → ResponseClaude2OpenAI →
// ChatCompletionsResponseToResponsesResponse).
//
// This function mirrors the existing chat_completions_via_responses.go.
func responsesViaChatCompletions(c *gin.Context, info *relaycommon.RelayInfo, adaptor channel.Adaptor, request *dto.OpenAIResponsesRequest) (*dto.Usage, *types.NewAPIError) {
	if info.ApiType != appconstant.APITypeAnthropic {
		return nil, types.NewError(fmt.Errorf("responsesViaChatCompletions called for non-Anthropic api type %d", info.ApiType), types.ErrorCodeInvalidApiType, types.ErrOptionWithSkipRetry())
	}

	// (a) Responses → ChatCompletions intermediate.
	chatReq, err := openaicompat.ResponsesRequestToChatCompletionsRequest(request)
	if err != nil {
		return nil, types.NewErrorWithStatusCode(err, types.ErrorCodeConvertRequestFailed, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}

	// (b) Sanitize tool-call IDs at the boundary (spec §14).
	openaicompat.SanitizeToolCallIDs(chatReq)

	// (c) ChatCompletions → Anthropic via the existing adaptor converter.
	converted, err := adaptor.ConvertOpenAIRequest(c, info, chatReq)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}
	relaycommon.AppendRequestConversionFromRequest(info, converted)

	// (d) Marshal -> RemoveDisabledFields -> ApplyParamOverride.
	jsonData, err := common.Marshal(converted)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}
	jsonData, err = relaycommon.RemoveDisabledFields(jsonData, info.ChannelOtherSettings, info.ChannelSetting.PassThroughBodyEnabled)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}
	if len(info.ParamOverride) > 0 {
		jsonData, err = relaycommon.ApplyParamOverrideWithRelayInfo(jsonData, info)
		if err != nil {
			return nil, newAPIErrorFromParamOverride(err)
		}
	}
	logger.LogDebug(c, "responses_via_chat_anthropic body: %s", jsonData)

	// (e) DoRequest.
	var requestBody io.Reader = bytes.NewBuffer(jsonData)
	resp, err := adaptor.DoRequest(c, info, requestBody)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeDoRequestFailed, http.StatusInternalServerError)
	}
	if resp == nil {
		return nil, types.NewOpenAIError(fmt.Errorf("nil response from upstream"), types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}
	httpResp := resp.(*http.Response)
	info.IsStream = info.IsStream || strings.HasPrefix(httpResp.Header.Get("Content-Type"), "text/event-stream")

	statusCodeMappingStr := c.GetString("status_code_mapping")
	if httpResp.StatusCode != http.StatusOK {
		apiErr := service.RelayErrorHandler(c.Request.Context(), httpResp, false)
		service.ResetStatusCode(apiErr, statusCodeMappingStr)
		return nil, apiErr
	}

	// Mark the final relay format so downstream helpers see "openai_responses"
	// (the client's expected format).
	info.FinalRequestRelayFormat = types.RelayFormatOpenAIResponses

	if info.IsStream {
		return runAnthropicToResponsesStream(c, info, httpResp)
	}
	return runAnthropicToResponsesNonStream(c, info, httpResp)
}

// runAnthropicToResponsesStream reads Anthropic SSE chunks, converts each to a
// Chat-Completions chunk via StreamResponseClaude2OpenAI, then feeds it through
// ChatCompletionsStreamToResponsesEvents and writes Responses-API SSE events to
// the client.
func runAnthropicToResponsesStream(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	helper.SetEventStreamHeaders(c)

	claudeInfo := &claudechannel.ClaudeResponseInfo{
		ResponseId: helper.GetResponseID(c),
		Created:    common.GetTimestamp(),
		Model:      info.UpstreamModelName,
		Usage:      &dto.Usage{},
	}
	state := openaicompat.NewResponsesStreamState()

	writeEvents := func(events []openaicompat.ResponsesAPIEvent) error {
		for _, ev := range events {
			data, err := common.Marshal(ev)
			if err != nil {
				return err
			}
			c.Render(-1, common.CustomEvent{Data: fmt.Sprintf("event: %s\n", ev.Type)})
			c.Render(-1, common.CustomEvent{Data: "data: " + string(data)})
			_ = helper.FlushWriter(c)
		}
		return nil
	}

	var streamErr *types.NewAPIError
	helper.StreamScannerHandler(c, resp, info, func(data string, sr *helper.StreamResult) {
		var claudeResponse dto.ClaudeResponse
		if e := common.UnmarshalJsonStr(data, &claudeResponse); e != nil {
			logger.LogError(c, "claude_stream_unmarshal_failed: "+e.Error())
			streamErr = types.NewError(e, types.ErrorCodeBadResponseBody)
			sr.Stop(streamErr)
			return
		}
		// Surface upstream Claude errors.
		if claudeError := claudeResponse.GetClaudeError(); claudeError != nil && claudeError.Type != "" {
			evs := openaicompat.EmitChatStreamErrorEvent(state, claudeError.Message)
			_ = writeEvents(evs)
			streamErr = types.WithClaudeError(*claudeError, http.StatusInternalServerError)
			sr.Stop(streamErr)
			return
		}
		// Preserve refusal marking (parity with HandleStreamResponseData).
		markClaudeRefusalFromStreamChunk(c, &claudeResponse)

		// Build the Chat-Completions chunk equivalent.
		chatChunk := claudechannel.StreamResponseClaude2OpenAI(&claudeResponse)
		// Accumulate Claude-side usage info.
		_ = claudechannel.FormatClaudeResponseInfo(&claudeResponse, chatChunk, claudeInfo)
		if chatChunk == nil {
			return
		}
		// Attach the running usage on the final delta so the translator can
		// pick it up. Normalize Anthropic semantics first so cached/cache-
		// creation input tokens fold into prompt_tokens — the Responses
		// translator subtracts cached from prompt_tokens to derive
		// input_tokens.
		if claudeInfo.Done && claudeInfo.Usage != nil {
			chatChunk.Usage = normalizeClaudeUsageForOpenAISemantics(claudeInfo.Usage)
		}
		evs := openaicompat.ChatCompletionsStreamToResponsesEvents(chatChunk, state)
		if e := writeEvents(evs); e != nil {
			logger.LogError(c, "responses_stream_write_failed: "+e.Error())
			streamErr = types.NewOpenAIError(e, types.ErrorCodeBadResponse, http.StatusInternalServerError)
			sr.Stop(streamErr)
			return
		}
	})

	// EOS flush: only run when the stream finished normally. On an upstream
	// error we already emitted response.failed (via EmitChatStreamErrorEvent)
	// or are propagating streamErr to the caller, and the unconditional flush
	// would otherwise emit a synthetic response.completed alongside.
	if streamErr == nil {
		flushEvents := openaicompat.ChatCompletionsStreamToResponsesEvents(nil, state)
		_ = writeEvents(flushEvents)
	}

	if streamErr != nil {
		return nil, streamErr
	}

	// Fall back to text-estimated usage if upstream didn't deliver complete
	// counts. Each token field is repaired independently so that a missing
	// prompt count does not require a missing completion count (or vice
	// versa).
	if claudeInfo.Usage.CompletionTokens == 0 || claudeInfo.Usage.PromptTokens == 0 {
		fallback := service.ResponseText2Usage(c, claudeInfo.ResponseText.String(), info.UpstreamModelName, info.GetEstimatePromptTokens())
		if claudeInfo.Usage.CompletionTokens == 0 {
			claudeInfo.Usage.CompletionTokens = fallback.CompletionTokens
		}
		if claudeInfo.Usage.PromptTokens == 0 {
			claudeInfo.Usage.PromptTokens = fallback.PromptTokens
		}
		claudeInfo.Usage.TotalTokens = claudeInfo.Usage.PromptTokens + claudeInfo.Usage.CompletionTokens
	}
	if claudeInfo.Usage != nil {
		claudeInfo.Usage.UsageSemantic = "anthropic"
	}
	return claudeInfo.Usage, nil
}

// runAnthropicToResponsesNonStream reads the Anthropic JSON response,
// converts it via ResponseClaude2OpenAI, then via
// ChatCompletionsResponseToResponsesResponse and writes the JSON to the client.
func runAnthropicToResponsesNonStream(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	defer service.CloseResponseBodyGracefully(resp)

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError)
	}
	logger.LogDebug(c, "responses_via_chat_anthropic upstream body: %s", body)

	var claudeResponse dto.ClaudeResponse
	if e := common.Unmarshal(body, &claudeResponse); e != nil {
		return nil, types.NewError(e, types.ErrorCodeBadResponseBody)
	}
	if claudeError := claudeResponse.GetClaudeError(); claudeError != nil && claudeError.Type != "" {
		return nil, types.WithClaudeError(*claudeError, resp.StatusCode)
	}
	// Preserve refusal marking (parity with the non-pivot Claude handler).
	markClaudeRefusalFromResponse(c, &claudeResponse)

	openaiResp := claudechannel.ResponseClaude2OpenAI(&claudeResponse)
	if openaiResp == nil {
		return nil, types.NewOpenAIError(fmt.Errorf("nil openai response from Claude conversion"), types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}

	// Build usage from the Claude response. Folding cache_read/creation into
	// PromptTokens keeps OpenAI semantics for the Responses translator while
	// the returned *dto.Usage retains the raw Anthropic-semantic counts the
	// gateway accounting layer expects.
	usage := &dto.Usage{}
	if claudeResponse.Usage != nil {
		usage.PromptTokens = claudeResponse.Usage.InputTokens
		usage.CompletionTokens = claudeResponse.Usage.OutputTokens
		usage.TotalTokens = usage.PromptTokens + usage.CompletionTokens
		usage.UsageSemantic = "anthropic"
		usage.PromptTokensDetails.CachedTokens = claudeResponse.Usage.CacheReadInputTokens
		usage.PromptTokensDetails.CachedCreationTokens = claudeResponse.Usage.CacheCreationInputTokens
	}
	// Hand the translator an OpenAI-semantic usage view so the cached/creation
	// breakdown survives the responses envelope (translator subtracts cached
	// from prompt_tokens to derive input_tokens).
	if normalized := normalizeClaudeUsageForOpenAISemantics(usage); normalized != nil {
		openaiResp.Usage = *normalized
	} else {
		openaiResp.Usage = *usage
	}

	responsesResp, e := openaicompat.ChatCompletionsResponseToResponsesResponse(openaiResp, info.UpstreamModelName)
	if e != nil {
		return nil, types.NewOpenAIError(e, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}

	responseBody, e := common.Marshal(responsesResp)
	if e != nil {
		return nil, types.NewOpenAIError(e, types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}
	service.IOCopyBytesGracefully(c, resp, responseBody)
	return usage, nil
}

// markClaudeRefusalFromStreamChunk mirrors the refusal-detection performed by
// claudechannel.HandleStreamResponseData. Without it, /v1/responses requests
// routed through the pivot would not record the moderation/accounting signal
// that the direct Claude relay records.
func markClaudeRefusalFromStreamChunk(c *gin.Context, cr *dto.ClaudeResponse) {
	if c == nil || cr == nil {
		return
	}
	if cr.StopReason != "" && strings.EqualFold(cr.StopReason, "refusal") {
		common.SetContextKey(c, appconstant.ContextKeyAdminRejectReason, "claude_stop_reason=refusal")
		return
	}
	if cr.Delta != nil && cr.Delta.StopReason != nil && strings.EqualFold(*cr.Delta.StopReason, "refusal") {
		common.SetContextKey(c, appconstant.ContextKeyAdminRejectReason, "claude_stop_reason=refusal")
	}
}

// markClaudeRefusalFromResponse mirrors the refusal-detection performed by the
// direct Claude non-streaming handler.
func markClaudeRefusalFromResponse(c *gin.Context, cr *dto.ClaudeResponse) {
	if c == nil || cr == nil {
		return
	}
	if strings.EqualFold(cr.StopReason, "refusal") {
		common.SetContextKey(c, appconstant.ContextKeyAdminRejectReason, "claude_stop_reason=refusal")
	}
}

// normalizeClaudeUsageForOpenAISemantics folds Anthropic's separately-counted
// cache_read and cache_creation input tokens into prompt_tokens so the
// downstream Responses translator (which uses OpenAI semantics and subtracts
// cached from prompt) produces correct input_tokens / total_tokens. Returns
// the original *dto.Usage when no conversion is needed.
func normalizeClaudeUsageForOpenAISemantics(in *dto.Usage) *dto.Usage {
	if in == nil {
		return nil
	}
	if in.UsageSemantic != "anthropic" {
		return in
	}
	cp := *in
	cp.PromptTokens = in.PromptTokens + in.PromptTokensDetails.CachedTokens + in.PromptTokensDetails.CachedCreationTokens
	cp.TotalTokens = cp.PromptTokens + cp.CompletionTokens
	// Drop the semantic marker so a second pass through this helper is a no-op.
	cp.UsageSemantic = ""
	return &cp
}
