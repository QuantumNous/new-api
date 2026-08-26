package project

import (
	"fmt"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/ir"
	"github.com/QuantumNous/new-api/relaykit/ir/project/chat"
	"github.com/QuantumNous/new-api/relaykit/ir/project/claude"
	"github.com/QuantumNous/new-api/relaykit/ir/project/gemini"
	"github.com/QuantumNous/new-api/relaykit/ir/project/responses"
	"github.com/QuantumNous/new-api/relaykit/types"
)

func IsTextFormat(format types.RelayFormat) bool {
	switch format {
	case types.RelayFormatOpenAI, types.RelayFormatClaude, types.RelayFormatGemini, types.RelayFormatOpenAIResponses:
		return true
	default:
		return false
	}
}

func FromRequest(format types.RelayFormat, request any) (*ir.Request, error) {
	switch format {
	case types.RelayFormatOpenAI:
		req, err := asChatRequest(request)
		if err != nil {
			return nil, err
		}
		return chat.FromRequest(req)
	case types.RelayFormatClaude:
		req, err := asClaudeRequest(request)
		if err != nil {
			return nil, err
		}
		return claude.FromRequest(req)
	case types.RelayFormatGemini:
		req, err := asGeminiRequest(request)
		if err != nil {
			return nil, err
		}
		return gemini.FromRequest(req)
	case types.RelayFormatOpenAIResponses:
		req, err := asResponsesRequest(request)
		if err != nil {
			return nil, err
		}
		return responses.FromRequest(req)
	default:
		return nil, fmt.Errorf("ir: unsupported request format %s", format)
	}
}

func ToRequest(format types.RelayFormat, request *ir.Request) (any, error) {
	if request == nil {
		return nil, fmt.Errorf("ir request is nil")
	}
	switch format {
	case types.RelayFormatOpenAI:
		return chat.ToRequest(request)
	case types.RelayFormatClaude:
		return claude.ToRequest(request)
	case types.RelayFormatGemini:
		return gemini.ToRequest(request)
	case types.RelayFormatOpenAIResponses:
		return responses.ToRequest(request)
	default:
		return nil, fmt.Errorf("ir: unsupported request format %s", format)
	}
}

func FromResponse(format types.RelayFormat, response any) (*ir.Response, error) {
	switch format {
	case types.RelayFormatOpenAI:
		resp, err := asChatResponse(response)
		if err != nil {
			return nil, err
		}
		return chat.FromResponse(resp)
	case types.RelayFormatClaude:
		resp, err := asClaudeResponse(response)
		if err != nil {
			return nil, err
		}
		return claude.FromResponse(resp)
	case types.RelayFormatGemini:
		resp, err := asGeminiResponse(response)
		if err != nil {
			return nil, err
		}
		return gemini.FromResponse(resp)
	case types.RelayFormatOpenAIResponses:
		resp, err := asResponsesResponse(response)
		if err != nil {
			return nil, err
		}
		return responses.FromResponse(resp)
	default:
		return nil, fmt.Errorf("ir: unsupported response format %s", format)
	}
}

func ToResponse(format types.RelayFormat, response *ir.Response) (any, error) {
	if response == nil {
		return nil, fmt.Errorf("ir response is nil")
	}
	switch format {
	case types.RelayFormatOpenAI:
		return chat.ToResponse(response)
	case types.RelayFormatClaude:
		return claude.ToResponse(response)
	case types.RelayFormatGemini:
		return gemini.ToResponse(response)
	case types.RelayFormatOpenAIResponses:
		return responses.ToResponse(response)
	default:
		return nil, fmt.Errorf("ir: unsupported response format %s", format)
	}
}

func asChatRequest(v any) (*dto.GeneralOpenAIRequest, error) {
	switch req := v.(type) {
	case *dto.GeneralOpenAIRequest:
		if req == nil {
			return nil, fmt.Errorf("expected OpenAI chat completions request, got nil")
		}
		return req, nil
	case dto.GeneralOpenAIRequest:
		return &req, nil
	default:
		return nil, fmt.Errorf("expected OpenAI chat completions request, got %T", v)
	}
}

func asClaudeRequest(v any) (*dto.ClaudeRequest, error) {
	switch req := v.(type) {
	case *dto.ClaudeRequest:
		if req == nil {
			return nil, fmt.Errorf("expected Anthropic Messages request, got nil")
		}
		return req, nil
	case dto.ClaudeRequest:
		return &req, nil
	default:
		return nil, fmt.Errorf("expected Anthropic Messages request, got %T", v)
	}
}

func asGeminiRequest(v any) (*dto.GeminiChatRequest, error) {
	switch req := v.(type) {
	case *dto.GeminiChatRequest:
		if req == nil {
			return nil, fmt.Errorf("expected Gemini generateContent request, got nil")
		}
		return req, nil
	case dto.GeminiChatRequest:
		return &req, nil
	default:
		return nil, fmt.Errorf("expected Gemini generateContent request, got %T", v)
	}
}

func asResponsesRequest(v any) (*dto.OpenAIResponsesRequest, error) {
	switch req := v.(type) {
	case *dto.OpenAIResponsesRequest:
		if req == nil {
			return nil, fmt.Errorf("expected OpenAI responses request, got nil")
		}
		return req, nil
	case dto.OpenAIResponsesRequest:
		return &req, nil
	default:
		return nil, fmt.Errorf("expected OpenAI responses request, got %T", v)
	}
}

func asChatResponse(v any) (*dto.OpenAITextResponse, error) {
	switch resp := v.(type) {
	case *dto.OpenAITextResponse:
		if resp == nil {
			return nil, fmt.Errorf("expected OpenAI chat completions response, got nil")
		}
		return resp, nil
	case dto.OpenAITextResponse:
		return &resp, nil
	default:
		return nil, fmt.Errorf("expected OpenAI chat completions response, got %T", v)
	}
}

func asClaudeResponse(v any) (*dto.ClaudeResponse, error) {
	switch resp := v.(type) {
	case *dto.ClaudeResponse:
		if resp == nil {
			return nil, fmt.Errorf("expected Anthropic Messages response, got nil")
		}
		return resp, nil
	case dto.ClaudeResponse:
		return &resp, nil
	default:
		return nil, fmt.Errorf("expected Anthropic Messages response, got %T", v)
	}
}

func asGeminiResponse(v any) (*dto.GeminiChatResponse, error) {
	switch resp := v.(type) {
	case *dto.GeminiChatResponse:
		if resp == nil {
			return nil, fmt.Errorf("expected Gemini generateContent response, got nil")
		}
		return resp, nil
	case dto.GeminiChatResponse:
		return &resp, nil
	default:
		return nil, fmt.Errorf("expected Gemini generateContent response, got %T", v)
	}
}

func asResponsesResponse(v any) (*dto.OpenAIResponsesResponse, error) {
	switch resp := v.(type) {
	case *dto.OpenAIResponsesResponse:
		if resp == nil {
			return nil, fmt.Errorf("expected OpenAI responses response, got nil")
		}
		return resp, nil
	case dto.OpenAIResponsesResponse:
		return &resp, nil
	default:
		return nil, fmt.Errorf("expected OpenAI responses response, got %T", v)
	}
}

func FromStream(format types.RelayFormat, chunk any, state *ir.StreamState) ([]ir.Event, error) {
	switch format {
	case types.RelayFormatOpenAI:
		resp, err := asChatStream(chunk)
		if err != nil {
			return nil, err
		}
		return chat.FromStream(resp, state)
	case types.RelayFormatClaude:
		resp, err := asClaudeResponse(chunk)
		if err != nil {
			return nil, err
		}
		return claude.FromStream(resp, state)
	case types.RelayFormatGemini:
		resp, err := asGeminiResponse(chunk)
		if err != nil {
			return nil, err
		}
		return gemini.FromStream(resp, state)
	case types.RelayFormatOpenAIResponses:
		resp, err := asResponsesStream(chunk)
		if err != nil {
			return nil, err
		}
		return responses.FromStream(resp, state)
	default:
		return nil, fmt.Errorf("ir: unsupported stream format %s", format)
	}
}

func ToStream(format types.RelayFormat, events []ir.Event, state *ir.StreamState) ([]any, error) {
	switch format {
	case types.RelayFormatOpenAI:
		return chat.ToStream(events, state)
	case types.RelayFormatClaude:
		return claude.ToStream(events, state)
	case types.RelayFormatGemini:
		return gemini.ToStream(events, state)
	case types.RelayFormatOpenAIResponses:
		return responses.ToStream(events, state)
	default:
		return nil, fmt.Errorf("ir: unsupported stream format %s", format)
	}
}

func asChatStream(v any) (*dto.ChatCompletionsStreamResponse, error) {
	switch resp := v.(type) {
	case *dto.ChatCompletionsStreamResponse:
		if resp == nil {
			return nil, fmt.Errorf("expected OpenAI chat stream chunk, got nil")
		}
		return resp, nil
	case dto.ChatCompletionsStreamResponse:
		return &resp, nil
	default:
		return nil, fmt.Errorf("expected OpenAI chat stream chunk, got %T", v)
	}
}

func asResponsesStream(v any) (*dto.ResponsesStreamResponse, error) {
	switch resp := v.(type) {
	case *dto.ResponsesStreamResponse:
		if resp == nil {
			return nil, fmt.Errorf("expected OpenAI responses stream event, got nil")
		}
		return resp, nil
	case dto.ResponsesStreamResponse:
		return &resp, nil
	default:
		return nil, fmt.Errorf("expected OpenAI responses stream event, got %T", v)
	}
}
