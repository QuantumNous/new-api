package gemini

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/tidwall/gjson"
)

// geminiToClaudeError preserves the upstream status and retry policy while
// translating Google's numeric error codes into Anthropic error types.
func geminiToClaudeError(apiError *types.NewAPIError) *types.NewAPIError {
	if apiError == nil {
		return nil
	}
	errorType := "api_error"
	switch apiError.StatusCode {
	case http.StatusUnauthorized:
		errorType = "authentication_error"
	case http.StatusForbidden:
		errorType = "permission_error"
	case http.StatusNotFound:
		errorType = "not_found_error"
	case http.StatusRequestEntityTooLarge:
		errorType = "request_too_large"
	case http.StatusTooManyRequests:
		errorType = "rate_limit_error"
	case http.StatusServiceUnavailable, 529:
		errorType = "overloaded_error"
	default:
		if apiError.StatusCode >= 400 && apiError.StatusCode < 500 {
			errorType = "invalid_request_error"
		}
	}
	mapped := types.WithClaudeError(types.ClaudeError{Type: errorType, Message: apiError.Error()}, apiError.StatusCode)
	mapped.Err = apiError.Err
	mapped.Metadata = apiError.Metadata
	if types.IsSkipRetryError(apiError) {
		types.ErrOptionWithSkipRetry()(mapped)
	}
	if !types.IsRecordErrorLog(apiError) {
		types.ErrOptionWithNoRecordErrorLog()(mapped)
	}
	return mapped
}

func geminiClaudeResponse(c *gin.Context, info *relaycommon.RelayInfo, response *dto.GeminiChatResponse, usage *dto.Usage) (*dto.ClaudeResponse, error) {
	chat := responseGeminiChat2OpenAI(c, response)
	chat.Model = info.UpstreamModelName
	chat.Usage = *usage
	result, err := service.ConvertResponse(c, info, types.RelayFormatClaude, chat)
	if err != nil {
		return nil, err
	}
	claude := result.Value.(*dto.ClaudeResponse)
	// Convert parts separately: the Chat bridge otherwise merges thinking and
	// text and loses their original ordering and Gemini thought signatures.
	content := make([]dto.ClaudeMediaMessage, 0)
	for _, candidate := range response.Candidates {
		for partIndex, part := range candidate.Content.Parts {
			if part.Text == "" && part.FunctionCall == nil && part.InlineData == nil &&
				part.ExecutableCode == nil && part.CodeExecutionResult == nil && len(part.ThoughtSignature) > 0 {
				var signature string
				if err := common.Unmarshal(part.ThoughtSignature, &signature); err != nil {
					return nil, fmt.Errorf("invalid Gemini thought signature: %w", err)
				}
				if len(content) > 0 && content[len(content)-1].Type == "thinking" {
					content[len(content)-1].Signature = signature
				}
				continue
			}
			single := &dto.GeminiChatResponse{Candidates: []dto.GeminiChatCandidate{{
				Content:           dto.GeminiChatContent{Role: "model", Parts: []dto.GeminiPart{part}},
				GroundingMetadata: geminiClaudePartGrounding(candidate, partIndex),
			}}}
			converted, err := service.ConvertResponse(c, info, types.RelayFormatClaude, responseGeminiChat2OpenAI(c, single))
			if err != nil {
				return nil, err
			}
			blocks := converted.Value.(*dto.ClaudeResponse).Content
			if len(part.ThoughtSignature) > 0 {
				var signature string
				if err := common.Unmarshal(part.ThoughtSignature, &signature); err != nil {
					return nil, fmt.Errorf("invalid Gemini thought signature: %w", err)
				}
				for i := range blocks {
					if blocks[i].Type == "thinking" || blocks[i].Type == "tool_use" {
						blocks[i].Signature = signature
					}
				}
			}
			content = append(content, blocks...)
		}
	}
	claude.Content = content
	return claude, nil
}

func geminiClaudePartGrounding(candidate dto.GeminiChatCandidate, partIndex int) *dto.GeminiGroundingMetadata {
	if candidate.GroundingMetadata == nil || candidate.Content.Parts[partIndex].Thought {
		return nil
	}
	var supports []map[string]any
	if err := common.Unmarshal(candidate.GroundingMetadata.GroundingSupports, &supports); err != nil {
		return nil
	}
	soleTextPart := -1
	for i, part := range candidate.Content.Parts {
		if part.Thought || part.Text == "" {
			continue
		}
		if soleTextPart >= 0 {
			soleTextPart = -1
			break
		}
		soleTextPart = i
	}
	selected := make([]map[string]any, 0, len(supports))
	for _, support := range supports {
		segment, ok := support["segment"].(map[string]any)
		if !ok {
			continue
		}
		index := soleTextPart
		if value, exists := segment["partIndex"]; exists {
			number, ok := value.(float64)
			if !ok || number != float64(partIndex) {
				continue
			}
			index = partIndex
		}
		if index != partIndex {
			continue
		}
		segment["partIndex"] = 0
		selected = append(selected, support)
	}
	metadata := *candidate.GroundingMetadata
	var err error
	metadata.GroundingSupports, err = common.Marshal(selected)
	if err != nil {
		return nil
	}
	return &metadata
}

func geminiClaudeStreamHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	options := relayconvert.ResponseStreamOptions{ID: helper.GetResponseID(c), Model: info.UpstreamModelName, Created: common.GetTimestamp()}
	geminiState, err := relayconvert.NewResponseStreamState(types.RelayFormatGemini, types.RelayFormatOpenAI, options)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
	}
	// Grounding offsets refer to the original candidate part indexes, not
	// the one-part chunks used to preserve text/thinking/tool block order.
	groundingState, err := relayconvert.NewResponseStreamState(types.RelayFormatGemini, types.RelayFormatOpenAI, options)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
	}
	claudeState, err := relayconvert.NewResponseStreamState(types.RelayFormatOpenAI, types.RelayFormatClaude, options)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
	}
	finishReason := types.FinishReasonStop
	var sawTerminal bool
	var conversionErr error
	var upstreamAPIError *types.NewAPIError
	var pendingToolSignature string
	send := func(chunk *dto.ChatCompletionsStreamResponse, signature string) bool {
		if c.Request.Context().Err() != nil {
			return false
		}
		results, err := service.ConvertStreamResponseChunk(c, info, claudeState, chunk)
		if err != nil {
			conversionErr = err
			return false
		}
		for _, result := range results {
			event := result.Value.(*dto.ClaudeResponse)
			if signature != "" && event.ContentBlock != nil && event.ContentBlock.Type == "tool_use" {
				event.ContentBlock.Signature = signature
			}
			if err := writeGeminiClaudeEvent(c, event); err != nil {
				conversionErr = err
				return false
			}
		}
		return true
	}
	usage, streamErr := geminiStreamHandler(c, info, resp, func(data string, response *dto.GeminiChatResponse) bool {
		if upstreamError := gjson.Get(data, "error"); upstreamError.Exists() && upstreamError.Type != gjson.Null {
			conversionErr = fmt.Errorf("Gemini upstream error: %s", upstreamError.Get("message").String())
			status := int(upstreamError.Get("code").Int())
			if status < 400 || status > 599 {
				status = http.StatusBadGateway
			}
			upstreamAPIError = types.NewOpenAIError(conversionErr, types.ErrorCodeBadResponseBody, status)
			info.StreamStatus.MarkFailed(upstreamError.Get("status").String(), "upstream_error", status)
			return false
		}
		if len(response.Candidates) == 0 && response.PromptFeedback != nil && response.PromptFeedback.BlockReason != nil {
			conversionErr = errors.New("request blocked by Gemini API: " + *response.PromptFeedback.BlockReason)
			upstreamAPIError = types.NewOpenAIError(conversionErr, types.ErrorCodePromptBlocked, http.StatusBadRequest)
			info.StreamStatus.MarkFailed("prompt_blocked", "upstream_error", http.StatusBadRequest)
			return false
		}
		for _, candidate := range response.Candidates {
			// Anthropic has one output message; ignore alternate candidates.
			if candidate.Index != 0 {
				continue
			}
			if candidate.FinishReason != nil {
				switch *candidate.FinishReason {
				case "STOP":
					// Retain tool_use when STOP follows function calls.
					sawTerminal = true
				case "MAX_TOKENS":
					finishReason = types.FinishReasonLength
					sawTerminal = true
				case "", "FINISH_REASON_UNSPECIFIED":
				default:
					finishReason = types.FinishReasonContentFilter
					sawTerminal = true
				}
			}
			for _, part := range candidate.Content.Parts {
				var signature string
				if len(part.ThoughtSignature) > 0 {
					if err := common.Unmarshal(part.ThoughtSignature, &signature); err != nil {
						conversionErr = err
						return false
					}
				}
				if part.FunctionCall != nil && signature != "" {
					pendingToolSignature = signature
				}
				single := &dto.GeminiChatResponse{
					Candidates:    []dto.GeminiChatCandidate{{Content: dto.GeminiChatContent{Role: "model", Parts: []dto.GeminiPart{part}}}},
					UsageMetadata: response.UsageMetadata,
				}
				results, err := service.ConvertStreamResponseChunk(c, info, geminiState, single)
				if err != nil {
					conversionErr = err
					return false
				}
				for _, result := range results {
					chunk := result.Value.(*dto.ChatCompletionsStreamResponse)
					if chunk.IsToolCall() && finishReason == types.FinishReasonStop {
						finishReason = types.FinishReasonToolCalls
					}
					if chunk.IsToolCall() {
						signature = pendingToolSignature
						pendingToolSignature = ""
					}
					for i := range chunk.Choices {
						chunk.Choices[i].FinishReason = nil
					}
					if !send(chunk, signature) {
						return false
					}
				}
				if part.FunctionCall == nil && len(part.ThoughtSignature) > 0 && info.ClaudeConvertInfo != nil &&
					info.ClaudeConvertInfo.LastMessagesType == relaycommon.LastMessageTypeThinking {
					index := info.ClaudeConvertInfo.Index
					event := dto.ClaudeResponse{Type: "content_block_delta", Index: &index,
						Delta: &dto.ClaudeMediaMessage{Type: "signature_delta", Signature: signature}}
					if err := writeGeminiClaudeEvent(c, &event); err != nil {
						conversionErr = err
						return false
					}
				}
			}
			grounded := candidate
			grounded.FinishReason = nil
			grounded.Content.Parts = make([]dto.GeminiPart, len(candidate.Content.Parts))
			for i, part := range candidate.Content.Parts {
				if !part.Thought && part.Text != "" {
					grounded.Content.Parts[i].Text = part.Text
				}
			}
			results, err := service.ConvertStreamResponseChunk(c, info, groundingState,
				&dto.GeminiChatResponse{Candidates: []dto.GeminiChatCandidate{grounded}})
			if err != nil {
				conversionErr = err
				return false
			}
			for _, result := range results {
				chunk := result.Value.(*dto.ChatCompletionsStreamResponse)
				for _, choice := range chunk.Choices {
					if len(choice.Delta.Annotations) == 0 {
						continue
					}
					choice.Delta = dto.ChatCompletionsStreamResponseChoiceDelta{Annotations: choice.Delta.Annotations}
					choice.FinishReason = nil
					chunk.Choices = []dto.ChatCompletionsStreamResponseChoice{choice}
					chunk.Usage = nil
					if !send(chunk, "") {
						return false
					}
				}
			}
		}
		return true
	})
	if isGeminiDownstreamStop(c, info) {
		info.StreamStatus.MarkCancelled()
		return usage, nil
	}
	if upstreamAPIError != nil {
		writeGeminiClaudeStreamError(c, info, upstreamAPIError)
		return usage, nil
	}
	if conversionErr != nil {
		info.StreamStatus.MarkFailed("bad_response_body", "upstream_error", http.StatusBadGateway)
		writeGeminiClaudeStreamError(c, info, types.NewOpenAIError(conversionErr, types.ErrorCodeBadResponseBody, http.StatusBadGateway))
		return usage, nil
	}
	if streamErr != nil {
		info.StreamStatus.MarkFailed("bad_response_body", "upstream_error", streamErr.StatusCode)
		writeGeminiClaudeStreamError(c, info, streamErr)
		return usage, nil
	}
	if !info.StreamStatus.IsNormalEnd() ||
		(!sawTerminal && info.StreamStatus.EndReason != relaycommon.StreamEndReasonDone) {
		info.StreamStatus.MarkIncomplete("missing_terminal")
		writeGeminiClaudeStreamError(c, info, types.NewOpenAIError(errors.New("Gemini stream ended without a terminal response"), types.ErrorCodeBadResponseBody, http.StatusBadGateway))
		return usage, nil
	}
	// Finalize the Gemini state first to reject unfinished partialArgs before
	// emitting any successful Anthropic terminal event.
	if _, err := service.FinalizeStreamResponse(c, info, geminiState); err != nil {
		info.StreamStatus.MarkFailed("bad_response_body", "upstream_error", http.StatusBadGateway)
		writeGeminiClaudeStreamError(c, info, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusBadGateway))
		return usage, nil
	}
	final := helper.GenerateStopResponse(options.ID, options.Created, options.Model, finishReason)
	final.Usage = usage
	if !send(final, "") {
		if conversionErr != nil {
			writeGeminiClaudeStreamError(c, info, types.NewOpenAIError(conversionErr, types.ErrorCodeBadResponseBody, http.StatusBadGateway))
		} else {
			info.StreamStatus.MarkCancelled()
		}
	}
	return usage, nil
}

func writeGeminiClaudeStreamError(c *gin.Context, info *relaycommon.RelayInfo, apiError *types.NewAPIError) {
	if isGeminiDownstreamStop(c, info) {
		info.StreamStatus.MarkCancelled()
		return
	}
	claudeError := geminiToClaudeError(apiError).ToClaudeError()
	info.StreamStatus.MarkFailed("", claudeError.Type, apiError.StatusCode)
	// The stream owns its terminal error; returning it would trigger a retry
	// or append the controller's non-SSE JSON error after these events.
	if err := writeGeminiClaudeEvent(c, &dto.ClaudeResponse{Type: "error", Error: claudeError}); err != nil {
		info.StreamStatus.RecordError("write Anthropic stream error: " + err.Error())
	}
}

func writeGeminiClaudeEvent(c *gin.Context, event *dto.ClaudeResponse) error {
	if err := c.Request.Context().Err(); err != nil {
		return err
	}
	data, err := common.Marshal(event)
	if err != nil {
		return err
	}
	helper.ExtendWriteDeadline(c)
	if _, err := fmt.Fprintf(c.Writer, "event: %s\ndata: %s\n\n", event.Type, data); err != nil {
		return err
	}
	return helper.FlushWriter(c)
}
