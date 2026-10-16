package geminichat

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/relaykit/dto"
	geminiproject "github.com/QuantumNous/new-api/relaykit/ir/project/gemini"
	kitutil "github.com/QuantumNous/new-api/relaykit/relayconvert/kitutil"
	"github.com/QuantumNous/new-api/relaykit/types"
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
			FinishReason: types.FinishReasonStop,
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
					choice.FinishReason = types.FinishReasonToolCalls
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
				choice.FinishReason = types.FinishReasonStop
			case "MAX_TOKENS":
				choice.FinishReason = types.FinishReasonLength
			case "SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII", "OTHER":
				choice.FinishReason = types.FinishReasonContentFilter
			default:
				choice.FinishReason = types.FinishReasonContentFilter
			}
		}
		if isToolCall {
			choice.FinishReason = types.FinishReasonToolCalls
		}
		choice.Message.Annotations = groundingAnnotationsToChat(candidate.GroundingMetadata, candidate.Content, choice.Message.StringContent())

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
				choice.FinishReason = &types.FinishReasonStop
			case "MAX_TOKENS":
				choice.FinishReason = &types.FinishReasonLength
			case "SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII", "OTHER":
				choice.FinishReason = &types.FinishReasonContentFilter
			default:
				choice.FinishReason = &types.FinishReasonContentFilter
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
			choice.FinishReason = &types.FinishReasonToolCalls
		}
		choice.Delta.Annotations = groundingAnnotationsToChat(candidate.GroundingMetadata, candidate.Content, content.String())
		choices = append(choices, choice)
	}

	response := dto.ChatCompletionsStreamResponse{
		Object:  "chat.completion.chunk",
		Choices: choices,
	}
	// Only attach usage the chunk actually reported. Do not fall back to a
	// local prompt estimate — converters treat this as first-frame truth.
	if metadata := geminiResponse.GetUsageMetadata(); dto.HasGeminiUsageMetadataTokens(metadata) {
		response.Usage = UsageFromGeminiMetadata(metadata, 0)
	}
	return &response, isStop
}

type GeminiToChatStreamState struct {
	id            string
	created       int64
	sawToolCall   bool
	finishEmitted bool
	latestUsage   *dto.Usage
	// Gemini generateContent streams complete function calls. Keep their
	// occurrence indexes monotonic because chunk-local indexes restart at zero.
	nextToolIndexByCandidate map[int64]int
	toolIndexByCandidateID   map[int64]map[string]int
	functionCalls            geminiproject.FunctionCallStream
	groundingByCandidate     map[int64]*geminiGroundingStreamCandidate
	sentGroundingAnnotations map[string]struct{}
}

func NewGeminiToChatStreamState(id string, created int64) *GeminiToChatStreamState {
	id = strings.TrimSpace(id)
	if id == "" {
		id = fmt.Sprintf("chatcmpl-%s", kitutil.GetUUID())
	}
	if created == 0 {
		created = kitutil.GetTimestamp()
	}
	return &GeminiToChatStreamState{
		id:                       id,
		created:                  created,
		nextToolIndexByCandidate: make(map[int64]int),
		toolIndexByCandidateID:   make(map[int64]map[string]int),
		groundingByCandidate:     make(map[int64]*geminiGroundingStreamCandidate),
		sentGroundingAnnotations: make(map[string]struct{}),
	}
}

func (s *GeminiToChatStreamState) ConvertChunk(geminiResponse *dto.GeminiChatResponse, model string, usage *dto.Usage) ([]*dto.ChatCompletionsStreamResponse, error) {
	if s == nil || geminiResponse == nil {
		return nil, nil
	}
	if s.groundingByCandidate == nil {
		s.groundingByCandidate = make(map[int64]*geminiGroundingStreamCandidate)
	}
	if s.sentGroundingAnnotations == nil {
		s.sentGroundingAnnotations = make(map[string]struct{})
	}
	if s.nextToolIndexByCandidate == nil {
		s.nextToolIndexByCandidate = make(map[int64]int)
	}
	if s.toolIndexByCandidateID == nil {
		s.toolIndexByCandidateID = make(map[int64]map[string]int)
	}
	var err error
	geminiResponse, err = s.functionCalls.ConvertChunk(geminiResponse)
	if err != nil {
		return nil, err
	}
	hasNonStopFinish := false
	for _, candidate := range geminiResponse.Candidates {
		if candidate.FinishReason != nil && *candidate.FinishReason != "" && *candidate.FinishReason != "STOP" {
			hasNonStopFinish = true
			break
		}
	}
	response, isStop := StreamResponseGeminiChat2OpenAI(geminiResponse)
	if response == nil {
		return nil, nil
	}
	response.Id = s.id
	response.Created = s.created
	response.Model = model
	response.Usage = usage
	for index := range geminiResponse.Candidates {
		if index >= len(response.Choices) {
			break
		}
		candidate := &geminiResponse.Candidates[index]
		choice := &response.Choices[index]
		for toolIndex := range choice.Delta.ToolCalls {
			callID := strings.TrimSpace(choice.Delta.ToolCalls[toolIndex].ID)
			indexesByID := s.toolIndexByCandidateID[candidate.Index]
			if indexesByID == nil {
				indexesByID = make(map[string]int)
				s.toolIndexByCandidateID[candidate.Index] = indexesByID
			}
			stableIndex, exists := indexesByID[callID]
			if callID == "" || !exists {
				stableIndex = s.nextToolIndexByCandidate[candidate.Index]
				s.nextToolIndexByCandidate[candidate.Index] = stableIndex + 1
				if callID != "" {
					indexesByID[callID] = stableIndex
				}
			}
			choice.Delta.ToolCalls[toolIndex].SetIndex(stableIndex)
		}
		grounding := s.groundingByCandidate[candidate.Index]
		if grounding == nil {
			grounding = newGeminiGroundingStreamCandidate()
			s.groundingByCandidate[candidate.Index] = grounding
		}
		grounding.appendContent(candidate.Content, response.Choices[index].Delta.GetContentString())
		response.Choices[index].Delta.Annotations = grounding.groundingAnnotations(
			candidate.GroundingMetadata,
			candidate.Index,
			s.sentGroundingAnnotations,
		)
	}

	if response.IsToolCall() {
		s.sawToolCall = true
		if !hasNonStopFinish {
			for i := range response.Choices {
				if response.Choices[i].FinishReason != nil && *response.Choices[i].FinishReason == types.FinishReasonToolCalls {
					response.Choices[i].FinishReason = nil
				}
			}
		}
	}
	if usage != nil {
		s.latestUsage = usage
	}
	for _, choice := range response.Choices {
		if choice.FinishReason != nil && *choice.FinishReason != "" {
			s.finishEmitted = true
			break
		}
	}

	responses := []*dto.ChatCompletionsStreamResponse{response}
	if isStop && !s.finishEmitted {
		responses = append(responses, s.terminalChunk(model))
	}
	return responses, nil
}

func (s *GeminiToChatStreamState) Finalize(model string) ([]*dto.ChatCompletionsStreamResponse, error) {
	if s == nil {
		return nil, nil
	}
	if err := s.functionCalls.Finalize(); err != nil {
		return nil, err
	}
	if s.finishEmitted {
		return nil, nil
	}
	return []*dto.ChatCompletionsStreamResponse{s.terminalChunk(model)}, nil
}

func (s *GeminiToChatStreamState) Usage() *dto.Usage {
	if s == nil {
		return nil
	}
	return s.latestUsage
}

func (s *GeminiToChatStreamState) terminalChunk(model string) *dto.ChatCompletionsStreamResponse {
	finishReason := types.FinishReasonStop
	if s.sawToolCall {
		finishReason = types.FinishReasonToolCalls
	}
	s.finishEmitted = true
	return &dto.ChatCompletionsStreamResponse{
		Id:      s.id,
		Object:  "chat.completion.chunk",
		Created: s.created,
		Model:   model,
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{
				Delta:        dto.ChatCompletionsStreamResponseChoiceDelta{},
				FinishReason: &finishReason,
			},
		},
		Usage: s.latestUsage,
	}
}

func geminiResponseToolCall(item *dto.GeminiPart) *dto.ToolCallResponse {
	argsBytes, err := kitutil.Marshal(item.FunctionCall.Arguments)
	if err != nil {
		return nil
	}
	callID := strings.TrimSpace(item.FunctionCall.ID)
	if callID == "" {
		callID = fmt.Sprintf("call_%s", kitutil.GetUUID())
	}
	return &dto.ToolCallResponse{
		ID:   callID,
		Type: "function",
		Function: dto.FunctionResponse{
			Arguments: string(argsBytes),
			Name:      item.FunctionCall.FunctionName,
		},
	}
}
