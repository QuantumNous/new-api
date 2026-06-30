package geminichat

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
)

func UsageFromGeminiMetadata(metadata *dto.GeminiUsageMetadata, fallbackPromptTokens int) *dto.Usage {
	if metadata == nil {
		if fallbackPromptTokens <= 0 {
			return nil
		}
		usage := &dto.Usage{PromptTokens: fallbackPromptTokens}
		usage.PromptTokensDetails.TextTokens = fallbackPromptTokens
		return usage
	}

	promptTokens := metadata.PromptTokenCount + metadata.ToolUsePromptTokenCount
	if promptTokens <= 0 && fallbackPromptTokens > 0 {
		promptTokens = fallbackPromptTokens
	}

	usage := &dto.Usage{
		PromptTokens:     promptTokens,
		CompletionTokens: metadata.CandidatesTokenCount + metadata.ThoughtsTokenCount,
		TotalTokens:      metadata.TotalTokenCount,
		BillingUsage:     dto.CloneBillingUsage(metadata.BillingUsage),
	}
	if usage.BillingUsage == nil {
		usage.BillingUsage = dto.NewGeminiChatBillingUsage(metadata)
	}
	usage.CompletionTokenDetails.ReasoningTokens = metadata.ThoughtsTokenCount
	usage.PromptTokensDetails.CachedTokens = metadata.CachedContentTokenCount

	for _, detail := range metadata.PromptTokensDetails {
		if detail.Modality == "AUDIO" {
			usage.PromptTokensDetails.AudioTokens += detail.TokenCount
		} else if detail.Modality == "IMAGE" {
			usage.PromptTokensDetails.ImageTokens += detail.TokenCount
		} else if detail.Modality == "TEXT" {
			usage.PromptTokensDetails.TextTokens += detail.TokenCount
		}
	}
	for _, detail := range metadata.ToolUsePromptTokensDetails {
		if detail.Modality == "AUDIO" {
			usage.PromptTokensDetails.AudioTokens += detail.TokenCount
		} else if detail.Modality == "IMAGE" {
			usage.PromptTokensDetails.ImageTokens += detail.TokenCount
		} else if detail.Modality == "TEXT" {
			usage.PromptTokensDetails.TextTokens += detail.TokenCount
		}
	}
	for _, detail := range metadata.CandidatesTokensDetails {
		switch detail.Modality {
		case "IMAGE":
			usage.CompletionTokenDetails.ImageTokens += detail.TokenCount
		case "AUDIO":
			usage.CompletionTokenDetails.AudioTokens += detail.TokenCount
		case "TEXT":
			usage.CompletionTokenDetails.TextTokens += detail.TokenCount
		}
	}

	if usage.TotalTokens > 0 && usage.CompletionTokens <= 0 {
		usage.CompletionTokens = usage.TotalTokens - usage.PromptTokens
	}

	if usage.PromptTokens > 0 && usage.PromptTokensDetails.TextTokens == 0 && usage.PromptTokensDetails.AudioTokens == 0 {
		usage.PromptTokensDetails.TextTokens = usage.PromptTokens
	}

	return usage
}

func ResponseGeminiChat2OpenAI(id string, created int64, response *dto.GeminiChatResponse) *dto.OpenAITextResponse {
	fullTextResponse := dto.OpenAITextResponse{
		Id:      id,
		Object:  "chat.completion",
		Created: created,
		Choices: make([]dto.OpenAITextResponseChoice, 0, len(response.Candidates)),
	}
	isToolCall := false
	for _, candidate := range response.Candidates {
		choice := dto.OpenAITextResponseChoice{
			Index: int(candidate.Index),
			Message: dto.Message{
				Role:    "assistant",
				Content: "",
			},
			FinishReason: constant.FinishReasonStop,
		}
		if len(candidate.Content.Parts) > 0 {
			var content strings.Builder
			var inlineGrow int
			for _, part := range candidate.Content.Parts {
				if part.InlineData != nil {
					inlineGrow += len(part.InlineData.MimeType) + len(part.InlineData.Data) + 32
				}
			}
			if inlineGrow > 0 {
				content.Grow(inlineGrow)
			}
			appended := 0
			writeSep := func() {
				if appended > 0 {
					content.WriteByte('\n')
				}
				appended++
			}
			var toolCalls []dto.ToolCallResponse
			for _, part := range candidate.Content.Parts {
				if part.InlineData != nil {
					if strings.HasPrefix(part.InlineData.MimeType, "image") {
						writeSep()
						content.WriteString("![image](data:")
						content.WriteString(part.InlineData.MimeType)
						content.WriteString(";base64,")
						content.WriteString(part.InlineData.Data)
						content.WriteByte(')')
					} else {
						writeSep()
						content.WriteString("[media](data:")
						content.WriteString(part.InlineData.MimeType)
						content.WriteString(";base64,")
						content.WriteString(part.InlineData.Data)
						content.WriteByte(')')
					}
				} else if part.FunctionCall != nil {
					choice.FinishReason = constant.FinishReasonToolCalls
					if call := geminiResponseToolCall(&part); call != nil {
						toolCalls = append(toolCalls, *call)
					}
				} else if part.Thought {
					choice.Message.ReasoningContent = &part.Text
				} else {
					if part.ExecutableCode != nil {
						writeSep()
						content.WriteString("```")
						content.WriteString(part.ExecutableCode.Language)
						content.WriteByte('\n')
						content.WriteString(part.ExecutableCode.Code)
						content.WriteString("\n```")
					} else if part.CodeExecutionResult != nil {
						writeSep()
						content.WriteString("```output\n")
						content.WriteString(part.CodeExecutionResult.Output)
						content.WriteString("\n```")
					} else if part.Text != "\n" {
						writeSep()
						content.WriteString(part.Text)
					}
				}
			}
			if len(toolCalls) > 0 {
				choice.Message.SetToolCalls(toolCalls)
				isToolCall = true
			}
			choice.Message.SetStringContent(content.String())
		}
		if candidate.FinishReason != nil {
			switch *candidate.FinishReason {
			case "STOP":
				choice.FinishReason = constant.FinishReasonStop
			case "MAX_TOKENS":
				choice.FinishReason = constant.FinishReasonLength
			case "SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII", "OTHER":
				choice.FinishReason = constant.FinishReasonContentFilter
			default:
				choice.FinishReason = constant.FinishReasonContentFilter
			}
		}
		if isToolCall {
			choice.FinishReason = constant.FinishReasonToolCalls
		}

		fullTextResponse.Choices = append(fullTextResponse.Choices, choice)
	}
	return &fullTextResponse
}

func StreamResponseGeminiChat2OpenAI(geminiResponse *dto.GeminiChatResponse) (*dto.ChatCompletionsStreamResponse, bool) {
	choices := make([]dto.ChatCompletionsStreamResponseChoice, 0, len(geminiResponse.Candidates))
	isStop := false
	for _, candidate := range geminiResponse.Candidates {
		if candidate.FinishReason != nil && *candidate.FinishReason == "STOP" {
			isStop = true
			candidate.FinishReason = nil
		}
		choice := dto.ChatCompletionsStreamResponseChoice{
			Index: int(candidate.Index),
			Delta: dto.ChatCompletionsStreamResponseChoiceDelta{},
		}
		var content strings.Builder
		var inlineGrow int
		for _, part := range candidate.Content.Parts {
			if part.InlineData != nil {
				inlineGrow += len(part.InlineData.MimeType) + len(part.InlineData.Data) + 32
			}
		}
		if inlineGrow > 0 {
			content.Grow(inlineGrow)
		}
		appended := 0
		writeSep := func() {
			if appended > 0 {
				content.WriteByte('\n')
			}
			appended++
		}
		isTools := false
		isThought := false
		if candidate.FinishReason != nil {
			switch *candidate.FinishReason {
			case "STOP":
				choice.FinishReason = &constant.FinishReasonStop
			case "MAX_TOKENS":
				choice.FinishReason = &constant.FinishReasonLength
			case "SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII", "OTHER":
				choice.FinishReason = &constant.FinishReasonContentFilter
			default:
				choice.FinishReason = &constant.FinishReasonContentFilter
			}
		}
		for _, part := range candidate.Content.Parts {
			if part.InlineData != nil {
				if strings.HasPrefix(part.InlineData.MimeType, "image") {
					writeSep()
					content.WriteString("![image](data:")
					content.WriteString(part.InlineData.MimeType)
					content.WriteString(";base64,")
					content.WriteString(part.InlineData.Data)
					content.WriteByte(')')
				}
			} else if part.FunctionCall != nil {
				isTools = true
				if call := geminiResponseToolCall(&part); call != nil {
					call.SetIndex(len(choice.Delta.ToolCalls))
					choice.Delta.ToolCalls = append(choice.Delta.ToolCalls, *call)
				}
			} else if part.Thought {
				isThought = true
				writeSep()
				content.WriteString(part.Text)
			} else {
				if part.ExecutableCode != nil {
					writeSep()
					content.WriteString("```")
					content.WriteString(part.ExecutableCode.Language)
					content.WriteByte('\n')
					content.WriteString(part.ExecutableCode.Code)
					content.WriteString("\n```\n")
				} else if part.CodeExecutionResult != nil {
					writeSep()
					content.WriteString("```output\n")
					content.WriteString(part.CodeExecutionResult.Output)
					content.WriteString("\n```\n")
				} else if part.Text != "\n" {
					writeSep()
					content.WriteString(part.Text)
				}
			}
		}
		if isThought {
			choice.Delta.SetReasoningContent(content.String())
		} else {
			choice.Delta.SetContentString(content.String())
		}
		if isTools {
			choice.FinishReason = &constant.FinishReasonToolCalls
		}
		choices = append(choices, choice)
	}

	response := dto.ChatCompletionsStreamResponse{
		Object:  "chat.completion.chunk",
		Choices: choices,
	}
	return &response, isStop
}

func geminiResponseToolCall(item *dto.GeminiPart) *dto.ToolCallResponse {
	argsBytes, err := common.Marshal(item.FunctionCall.Arguments)
	if err != nil {
		return nil
	}
	return &dto.ToolCallResponse{
		ID:   fmt.Sprintf("call_%s", common.GetUUID()),
		Type: "function",
		Function: dto.FunctionResponse{
			Arguments: string(argsBytes),
			Name:      item.FunctionCall.FunctionName,
		},
	}
}
