package service

import (
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/service/openaicompat"
)

// ChatCompletionsRequestToResponsesRequest converts a Chat Completions
// request into a Responses API request.  Delegates to the openaicompat
// package.
func ChatCompletionsRequestToResponsesRequest(req *dto.GeneralOpenAIRequest) (*dto.OpenAIResponsesRequest, error) {
	return openaicompat.ChatCompletionsRequestToResponsesRequest(req)
}

// ResponsesResponseToChatCompletionsResponse converts a Responses API
// response into a Chat Completions response.  Delegates to the
// openaicompat package.
func ResponsesResponseToChatCompletionsResponse(resp *dto.OpenAIResponsesResponse, id string) (*dto.OpenAITextResponse, *dto.Usage, error) {
	return openaicompat.ResponsesResponseToChatCompletionsResponse(resp, id)
}

// ExtractOutputTextFromResponses extracts the concatenated output text
// from a Responses API response object.
func ExtractOutputTextFromResponses(resp *dto.OpenAIResponsesResponse) string {
	return openaicompat.ExtractOutputTextFromResponses(resp)
}

// ResponsesRequestToChatCompletionsRequest converts a Responses API
// request into a Chat Completions request.  This is the reverse of
// ChatCompletionsRequestToResponsesRequest and is used when the upstream
// channel only supports /v1/chat/completions.
func ResponsesRequestToChatCompletionsRequest(req *dto.OpenAIResponsesRequest) (*dto.GeneralOpenAIRequest, error) {
	return openaicompat.ResponsesRequestToChatCompletionsRequest(req)
}

// ChatCompletionsResponseToResponsesResponse converts a non-streaming
// Chat Completions response into a Responses API response.
func ChatCompletionsResponseToResponsesResponse(resp *dto.OpenAITextResponse, model string) (*dto.OpenAIResponsesResponse, error) {
	return openaicompat.ChatCompletionsResponseToResponsesResponse(resp, model)
}

// ShouldResponsesUseChatCompletionsGlobal checks whether an incoming
// /v1/responses request should be transparently converted to
// /v1/chat/completions for the given channel and model, using the
// global configuration policy.
func ShouldResponsesUseChatCompletionsGlobal(channelID int, channelType int, model string) bool {
	return openaicompat.ShouldResponsesUseChatCompletionsGlobal(channelID, channelType, model)
}
