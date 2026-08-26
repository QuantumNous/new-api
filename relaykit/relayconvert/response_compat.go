package relayconvert

import (
	"context"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/convmeta"
	claudemessages "github.com/QuantumNous/new-api/relaykit/relayconvert/internal/claude_messages"
	geminichat "github.com/QuantumNous/new-api/relaykit/relayconvert/internal/gemini_chat"
	oaichat "github.com/QuantumNous/new-api/relaykit/relayconvert/internal/oai_chat"
	oairesponses "github.com/QuantumNous/new-api/relaykit/relayconvert/internal/oai_responses"
	"github.com/QuantumNous/new-api/relaykit/types"
)

type ClaudeResponseInfo = claudemessages.ClaudeResponseInfo

type ChatToResponsesStreamEvent = oaichat.ChatToResponsesStreamEvent
type ChatToResponsesStreamState = oaichat.ChatToResponsesStreamState
type ResponsesToChatStreamState = oairesponses.ResponsesToChatStreamState
type ResponsesBufferedAccumulator = oairesponses.ResponsesBufferedAccumulator

func NormalizeCacheCreationSplit(totalTokens int, tokens5m int, tokens1h int) (int, int) {
	return oaichat.NormalizeCacheCreationSplit(totalTokens, tokens5m, tokens1h)
}

func ResponseOpenAI2Claude(openAIResponse *dto.OpenAITextResponse, info convmeta.Meta) *dto.ClaudeResponse {
	result, err := ConvertResponse(context.Background(), info, types.RelayFormatClaude, openAIResponse)
	if err != nil || result == nil {
		return nil
	}
	resp, _ := result.Value.(*dto.ClaudeResponse)
	return resp
}

func StreamResponseOpenAI2Claude(openAIResponse *dto.ChatCompletionsStreamResponse, info convmeta.Meta) []*dto.ClaudeResponse {
	result, err := ConvertStreamResponse(context.Background(), info, types.RelayFormatClaude, openAIResponse)
	if err != nil || result == nil {
		return nil
	}
	switch typed := result.Value.(type) {
	case []*dto.ClaudeResponse:
		return typed
	case *dto.ClaudeResponse:
		if typed == nil {
			return nil
		}
		return []*dto.ClaudeResponse{typed}
	case dto.ClaudeResponse:
		item := typed
		return []*dto.ClaudeResponse{&item}
	default:
		return nil
	}
}

func StopReasonClaudeToOpenAI(reason string) string {
	return claudemessages.StopReasonClaudeToOpenAI(reason)
}

func StreamResponseClaude2OpenAI(claudeResponse *dto.ClaudeResponse) *dto.ChatCompletionsStreamResponse {
	result, err := ConvertStreamResponse(context.Background(), nil, types.RelayFormatOpenAI, claudeResponse)
	if err != nil || result == nil {
		return nil
	}
	resp, _ := result.Value.(*dto.ChatCompletionsStreamResponse)
	if resp != nil {
		return resp
	}
	if value, ok := result.Value.(dto.ChatCompletionsStreamResponse); ok {
		return &value
	}
	return nil
}

func ResponseClaude2OpenAI(claudeResponse *dto.ClaudeResponse) *dto.OpenAITextResponse {
	result, err := ConvertResponse(context.Background(), nil, types.RelayFormatOpenAI, claudeResponse)
	if err != nil || result == nil {
		return nil
	}
	resp, _ := result.Value.(*dto.OpenAITextResponse)
	return resp
}

func UsageFromClaudeAPIUsage(usage *dto.ClaudeUsage) *dto.Usage {
	return claudemessages.UsageFromClaudeAPIUsage(usage)
}

func UsageFromClaudeUsage(usage *dto.Usage) *dto.Usage {
	return claudemessages.UsageFromClaudeUsage(usage)
}

func BuildMessageDeltaPatchUsage(claudeResponse *dto.ClaudeResponse, claudeInfo *ClaudeResponseInfo) *dto.ClaudeUsage {
	return claudemessages.BuildMessageDeltaPatchUsage(claudeResponse, claudeInfo)
}

func PatchClaudeMessageDeltaUsageData(data string, usage *dto.ClaudeUsage) string {
	return claudemessages.PatchClaudeMessageDeltaUsageData(data, usage)
}

func FormatClaudeResponseInfo(claudeResponse *dto.ClaudeResponse, oaiResponse *dto.ChatCompletionsStreamResponse, claudeInfo *ClaudeResponseInfo) bool {
	return claudemessages.FormatClaudeResponseInfo(claudeResponse, oaiResponse, claudeInfo)
}

func ResponseOpenAI2Gemini(openAIResponse *dto.OpenAITextResponse, info convmeta.Meta) *dto.GeminiChatResponse {
	result, err := ConvertResponse(context.Background(), info, types.RelayFormatGemini, openAIResponse)
	if err != nil || result == nil {
		return nil
	}
	resp, _ := result.Value.(*dto.GeminiChatResponse)
	return resp
}

func StreamResponseOpenAI2Gemini(openAIResponse *dto.ChatCompletionsStreamResponse, info convmeta.Meta) *dto.GeminiChatResponse {
	result, err := ConvertStreamResponse(context.Background(), info, types.RelayFormatGemini, openAIResponse)
	if err != nil || result == nil {
		return nil
	}
	resp, _ := result.Value.(*dto.GeminiChatResponse)
	if resp != nil {
		return resp
	}
	if value, ok := result.Value.(dto.GeminiChatResponse); ok {
		return &value
	}
	return nil
}

func UsageFromGeminiMetadata(metadata *dto.GeminiUsageMetadata, fallbackPromptTokens int) *dto.Usage {
	return geminichat.UsageFromGeminiMetadata(metadata, fallbackPromptTokens)
}

func ResponseGeminiChat2OpenAI(id string, created int64, response *dto.GeminiChatResponse) *dto.OpenAITextResponse {
	return geminichat.ResponseGeminiChat2OpenAI(id, created, response)
}

func StreamResponseGeminiChat2OpenAI(geminiResponse *dto.GeminiChatResponse) (*dto.ChatCompletionsStreamResponse, bool) {
	return geminichat.StreamResponseGeminiChat2OpenAI(geminiResponse)
}

func ChatCompletionsResponseToResponsesResponse(resp *dto.OpenAITextResponse, id string) (*dto.OpenAIResponsesResponse, *dto.Usage, error) {
	result, err := ConvertResponse(context.Background(), nil, types.RelayFormatOpenAIResponses, resp)
	if err != nil {
		return nil, nil, err
	}
	out, ok := result.Value.(*dto.OpenAIResponsesResponse)
	if !ok {
		return nil, result.Usage, nil
	}
	if id != "" {
		out.ID = id
	}
	return out, result.Usage, nil
}

func ResponsesStatusFromChatFinishReason(finishReason string) (string, *dto.IncompleteDetails) {
	return oaichat.ResponsesStatusFromChatFinishReason(finishReason)
}

func UsageFromChatUsage(src *dto.Usage) *dto.Usage {
	return oaichat.UsageFromChatUsage(src)
}

func BuildClaudeUsageFromOpenAIUsage(oaiUsage *dto.Usage) *dto.ClaudeUsage {
	return oaichat.BuildClaudeUsageFromOpenAIUsage(oaiUsage)
}

func GeminiUsageFromOpenAIChatUsage(usage *dto.Usage) dto.GeminiUsageMetadata {
	return oaichat.GeminiUsageFromOpenAIChatUsage(usage)
}

func NewChatToResponsesStreamState(id string, model string) *ChatToResponsesStreamState {
	return oaichat.NewChatToResponsesStreamState(id, model)
}

func ChatCompletionsStreamChunkToResponsesEvents(chunk *dto.ChatCompletionsStreamResponse, state *ChatToResponsesStreamState) ([]ChatToResponsesStreamEvent, error) {
	return oaichat.ChatCompletionsStreamChunkToResponsesEvents(chunk, state)
}

func FinalizeChatCompletionsStreamToResponses(state *ChatToResponsesStreamState) []ChatToResponsesStreamEvent {
	return oaichat.FinalizeChatCompletionsStreamToResponses(state)
}

func ResponsesFinishReasonFromStatus(resp *dto.OpenAIResponsesResponse) (string, bool) {
	return oairesponses.ResponsesFinishReasonFromStatus(resp)
}

func ResponsesResponseToChatCompletionsResponse(resp *dto.OpenAIResponsesResponse, id string) (*dto.OpenAITextResponse, *dto.Usage, error) {
	result, err := ConvertResponse(context.Background(), nil, types.RelayFormatOpenAI, resp)
	if err != nil {
		return nil, nil, err
	}
	out, ok := result.Value.(*dto.OpenAITextResponse)
	if !ok {
		return nil, result.Usage, nil
	}
	if id != "" {
		out.Id = id
	}
	return out, result.Usage, nil
}

func UsageFromResponsesUsage(src *dto.Usage) *dto.Usage {
	return oairesponses.UsageFromResponsesUsage(src)
}

func ExtractOutputTextFromResponses(resp *dto.OpenAIResponsesResponse) string {
	return oairesponses.ExtractOutputTextFromResponses(resp)
}

func ExtractReasoningTextFromResponses(resp *dto.OpenAIResponsesResponse) string {
	return oairesponses.ExtractReasoningTextFromResponses(resp)
}

func NewResponsesToChatStreamState(model string, includeUsage bool) *ResponsesToChatStreamState {
	return oairesponses.NewResponsesToChatStreamState(model, includeUsage)
}

func ResponsesStreamEventToChatChunks(event *dto.ResponsesStreamResponse, state *ResponsesToChatStreamState) ([]dto.ChatCompletionsStreamResponse, error) {
	return oairesponses.ResponsesStreamEventToChatChunks(event, state)
}

func FinalizeResponsesToChatStream(state *ResponsesToChatStreamState) []dto.ChatCompletionsStreamResponse {
	return oairesponses.FinalizeResponsesToChatStream(state)
}

func NewResponsesBufferedAccumulator() *ResponsesBufferedAccumulator {
	return oairesponses.NewResponsesBufferedAccumulator()
}
