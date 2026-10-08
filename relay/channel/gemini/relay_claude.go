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
		for _, part := range candidate.Content.Parts {
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
				Content: dto.GeminiChatContent{Role: "model", Parts: []dto.GeminiPart{part}},
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

func geminiClaudeStreamHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	options := relayconvert.ResponseStreamOptions{ID: helper.GetResponseID(c), Model: info.UpstreamModelName, Created: common.GetTimestamp()}
	geminiState, err := relayconvert.NewResponseStreamState(types.RelayFormatGemini, types.RelayFormatOpenAI, options)
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
				if len(part.ThoughtSignature) > 0 && info.ClaudeConvertInfo != nil &&
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
		}
		return true
	})
	if isGeminiDownstreamStop(c, info) {
		return usage, nil
	}
	if upstreamAPIError != nil {
		return usage, upstreamAPIError
	}
	if conversionErr != nil {
		info.StreamStatus.MarkFailed("bad_response_body", "upstream_error", http.StatusBadGateway)
		return usage, types.NewOpenAIError(conversionErr, types.ErrorCodeBadResponseBody, http.StatusBadGateway)
	}
	if streamErr != nil {
		info.StreamStatus.MarkFailed("bad_response_body", "upstream_error", streamErr.StatusCode)
		return usage, streamErr
	}
	if !info.StreamStatus.IsNormalEnd() ||
		(!sawTerminal && info.StreamStatus.EndReason != relaycommon.StreamEndReasonDone) {
		info.StreamStatus.MarkIncomplete("missing_terminal")
		return usage, types.NewOpenAIError(errors.New("Gemini stream ended without a terminal response"), types.ErrorCodeBadResponseBody, http.StatusBadGateway)
	}
	// Finalize the Gemini state first to reject unfinished partialArgs before
	// emitting any successful Anthropic terminal event.
	if _, err := service.FinalizeStreamResponse(c, info, geminiState); err != nil {
		info.StreamStatus.MarkFailed("bad_response_body", "upstream_error", http.StatusBadGateway)
		return usage, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusBadGateway)
	}
	final := helper.GenerateStopResponse(options.ID, options.Created, options.Model, finishReason)
	final.Usage = usage
	if !send(final, "") && conversionErr != nil {
		return usage, types.NewOpenAIError(conversionErr, types.ErrorCodeBadResponseBody, http.StatusBadGateway)
	}
	return usage, nil
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
