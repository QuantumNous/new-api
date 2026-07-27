package service

import (
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/service/openaicompat"
)

func ChatCompletionsRequestToResponsesRequest(req *dto.GeneralOpenAIRequest) (*dto.OpenAIResponsesRequest, error) {
	return openaicompat.ChatCompletionsRequestToResponsesRequest(req)
}

func ResponsesResponseToChatCompletionsResponse(resp *dto.OpenAIResponsesResponse, id string) (*dto.OpenAITextResponse, *dto.Usage, error) {
	return openaicompat.ResponsesResponseToChatCompletionsResponse(resp, id)
}

func ResponsesRequestToChatCompletionsRequest(req *dto.OpenAIResponsesRequest) (*dto.GeneralOpenAIRequest, *dto.ResponsesToolContext, error) {
	return openaicompat.ResponsesRequestToChatCompletionsRequest(req)
}

func ChatCompletionsResponseToResponsesResponse(resp *dto.OpenAITextResponse, id string, toolCtx *dto.ResponsesToolContext) (*dto.OpenAIResponsesResponse, error) {
	return openaicompat.ChatCompletionsResponseToResponsesResponse(resp, id, toolCtx)
}

func EnrichChatResponseReasoningDetails(resp *dto.OpenAITextResponse, rawBody []byte) {
	openaicompat.EnrichChatResponseReasoningDetails(resp, rawBody)
}

// ResponseToolCallItem maps an upstream chat tool call back to a Responses
// output item (function_call or custom_tool_call) using the request-side tool context.
func ResponseToolCallItem(callID, name, arguments string, toolCtx *dto.ResponsesToolContext) map[string]any {
	return openaicompat.ResponseToolCallItem(callID, name, arguments, toolCtx)
}

func ExtractOutputTextFromResponses(resp *dto.OpenAIResponsesResponse) string {
	return openaicompat.ExtractOutputTextFromResponses(resp)
}
