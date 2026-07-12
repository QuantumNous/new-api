package relayconvert

import (
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	claudemessages "github.com/QuantumNous/new-api/service/relayconvert/internal/claude_messages"
	geminichat "github.com/QuantumNous/new-api/service/relayconvert/internal/gemini_chat"
	oaichat "github.com/QuantumNous/new-api/service/relayconvert/internal/oai_chat"
	oairesponses "github.com/QuantumNous/new-api/service/relayconvert/internal/oai_responses"
)

type ClaudeResponseInfo = claudemessages.ClaudeResponseInfo

type ChatToResponsesStreamEvent = oaichat.ChatToResponsesStreamEvent
type ChatToResponsesStreamState = oaichat.ChatToResponsesStreamState
type ResponsesToChatStreamState = oairesponses.ResponsesToChatStreamState
type ResponsesBufferedAccumulator = oairesponses.ResponsesBufferedAccumulator

func NormalizeCacheCreationSplit(totalTokens int, tokens5m int, tokens1h int) (int, int) {
	return oaichat.NormalizeCacheCreationSplit(totalTokens, tokens5m, tokens1h)
}

func ResponseOpenAI2Claude(openAIResponse *dto.OpenAITextResponse, info *relaycommon.RelayInfo) *dto.ClaudeResponse {
	return oaichat.ResponseOpenAI2Claude(openAIResponse, info)
}

func StreamResponseOpenAI2Claude(openAIResponse *dto.ChatCompletionsStreamResponse, info *relaycommon.RelayInfo) []*dto.ClaudeResponse {
	return oaichat.StreamResponseOpenAI2Claude(openAIResponse, info)
}

func StopReasonClaudeToOpenAI(reason string) string {
	return claudemessages.StopReasonClaudeToOpenAI(reason)
}

func StreamResponseClaude2OpenAI(claudeResponse *dto.ClaudeResponse) *dto.ChatCompletionsStreamResponse {
	return claudemessages.StreamResponseClaude2OpenAI(claudeResponse)
}

func ResponseClaude2OpenAI(claudeResponse *dto.ClaudeResponse) *dto.OpenAITextResponse {
	return claudemessages.ResponseClaude2OpenAI(claudeResponse)
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

func ResponseOpenAI2Gemini(openAIResponse *dto.OpenAITextResponse, info *relaycommon.RelayInfo) *dto.GeminiChatResponse {
	return oaichat.ResponseOpenAI2Gemini(openAIResponse, info)
}

func StreamResponseOpenAI2Gemini(openAIResponse *dto.ChatCompletionsStreamResponse, info *relaycommon.RelayInfo) *dto.GeminiChatResponse {
	return oaichat.StreamResponseOpenAI2Gemini(openAIResponse, info)
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
	return oaichat.ChatCompletionsResponseToResponsesResponse(resp, id)
}

func ResponsesStatusFromChatFinishReason(finishReason string) (string, *dto.IncompleteDetails) {
	return oaichat.ResponsesStatusFromChatFinishReason(finishReason)
}

func UsageFromChatUsage(src *dto.Usage) *dto.Usage {
	return oaichat.UsageFromChatUsage(src)
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
	return oairesponses.ResponsesResponseToChatCompletionsResponse(resp, id)
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
