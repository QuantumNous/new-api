package relayconvert

import (
	"context"
	"fmt"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/convmeta"
	sharedclaude "github.com/QuantumNous/new-api/relaykit/relayconvert/internal/shared/claude"
	sharedgemini "github.com/QuantumNous/new-api/relaykit/relayconvert/internal/shared/gemini"
	"github.com/QuantumNous/new-api/relaykit/types"
)

func requestAs[T any](c context.Context, info convmeta.Meta, target types.RelayFormat, request any) (*T, error) {
	result, err := ConvertRequest(c, info, target, request)
	if err != nil {
		return nil, err
	}
	typed, ok := result.Value.(*T)
	if ok {
		return typed, nil
	}
	if value, ok := result.Value.(T); ok {
		item := value
		return &item, nil
	}
	return nil, fmt.Errorf("expected %T, got %T", new(T), result.Value)
}

func ClaudeMessagesRequestToOpenAIChat(claudeRequest dto.ClaudeRequest, info convmeta.Meta) (*dto.GeneralOpenAIRequest, error) {
	return requestAs[dto.GeneralOpenAIRequest](context.Background(), info, types.RelayFormatOpenAI, &claudeRequest)
}

func OpenAIChatRequestToClaudeMessages(c context.Context, info convmeta.Meta, textRequest dto.GeneralOpenAIRequest) (*dto.ClaudeRequest, error) {
	return requestAs[dto.ClaudeRequest](c, info, types.RelayFormatClaude, &textRequest)
}

func GeminiGenerateContentRequestToOpenAIChat(geminiRequest *dto.GeminiChatRequest, info convmeta.Meta) (*dto.GeneralOpenAIRequest, error) {
	return requestAs[dto.GeneralOpenAIRequest](context.Background(), info, types.RelayFormatOpenAI, geminiRequest)
}

func OpenAIChatRequestToGeminiGenerateContent(c context.Context, textRequest dto.GeneralOpenAIRequest, info convmeta.Meta) (*dto.GeminiChatRequest, error) {
	return requestAs[dto.GeminiChatRequest](c, info, types.RelayFormatGemini, &textRequest)
}

func ApplyGeminiThinkingConfig(geminiRequest *dto.GeminiChatRequest, info convmeta.Meta, oaiRequest ...dto.GeneralOpenAIRequest) {
	sharedgemini.ApplyThinkingConfig(geminiRequest, info, oaiRequest...)
}

func ApplyClaudeModelThinking(req *dto.ClaudeRequest, model string, adapterEnabled bool, preserveThinkingSuffix bool) string {
	return sharedclaude.ApplyModelThinking(req, model, adapterEnabled, preserveThinkingSuffix)
}

func ChatCompletionsRequestToResponsesRequest(req *dto.GeneralOpenAIRequest) (*dto.OpenAIResponsesRequest, error) {
	return requestAs[dto.OpenAIResponsesRequest](context.Background(), nil, types.RelayFormatOpenAIResponses, req)
}

func ResponsesRequestToChatCompletionsRequest(req *dto.OpenAIResponsesRequest) (*dto.GeneralOpenAIRequest, error) {
	return requestAs[dto.GeneralOpenAIRequest](context.Background(), nil, types.RelayFormatOpenAI, req)
}

func OpenAIResponsesRequestToClaudeMessages(c context.Context, info convmeta.Meta, req *dto.OpenAIResponsesRequest) (*dto.ClaudeRequest, error) {
	return requestAs[dto.ClaudeRequest](c, info, types.RelayFormatClaude, req)
}

func OpenAIResponsesRequestToGeminiChat(c context.Context, req *dto.OpenAIResponsesRequest, info convmeta.Meta) (*dto.GeminiChatRequest, error) {
	return requestAs[dto.GeminiChatRequest](c, info, types.RelayFormatGemini, req)
}
