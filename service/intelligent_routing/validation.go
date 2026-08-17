package intelligent_routing

import (
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
)

func ValidateResponse(request dto.Request, format types.RelayFormat, body []byte) error {
	if len(strings.TrimSpace(string(body))) == 0 {
		return errors.New("empty intelligent routing response")
	}
	switch format {
	case types.RelayFormatOpenAI:
		return validateChatResponse(request, body)
	case types.RelayFormatOpenAIResponses, types.RelayFormatOpenAIResponsesCompaction:
		return validateResponsesResponse(body)
	default:
		return nil
	}
}

func validateChatResponse(request dto.Request, body []byte) error {
	var response struct {
		Choices []struct {
			FinishReason string `json:"finish_reason"`
			Message      struct {
				Content   any `json:"content"`
				ToolCalls []struct {
					Function struct {
						Name      string `json:"name"`
						Arguments string `json:"arguments"`
					} `json:"function"`
				} `json:"tool_calls"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := common.Unmarshal(body, &response); err != nil {
		return fmt.Errorf("invalid chat response JSON: %w", err)
	}
	if len(response.Choices) == 0 {
		return errors.New("chat response has no choices")
	}
	choice := response.Choices[0]
	if choice.FinishReason == "length" {
		return errors.New("chat response was truncated")
	}
	content, _ := choice.Message.Content.(string)
	if strings.TrimSpace(content) == "" && len(choice.Message.ToolCalls) == 0 {
		return errors.New("chat response has no content or tool call")
	}
	openAIRequest, _ := request.(*dto.GeneralOpenAIRequest)
	if openAIRequest != nil && openAIRequest.ResponseFormat != nil && openAIRequest.ResponseFormat.Type == "json_schema" {
		var structured any
		if err := common.Unmarshal([]byte(content), &structured); err != nil {
			return fmt.Errorf("structured response is not valid JSON: %w", err)
		}
	}
	if openAIRequest == nil || len(choice.Message.ToolCalls) == 0 {
		return nil
	}
	allowed := make(map[string]struct{}, len(openAIRequest.Tools))
	for _, tool := range openAIRequest.Tools {
		allowed[tool.Function.Name] = struct{}{}
	}
	for _, call := range choice.Message.ToolCalls {
		if _, ok := allowed[call.Function.Name]; !ok {
			return fmt.Errorf("response called undeclared tool %q", call.Function.Name)
		}
		var arguments any
		if err := common.Unmarshal([]byte(call.Function.Arguments), &arguments); err != nil {
			return fmt.Errorf("tool %q arguments are not valid JSON: %w", call.Function.Name, err)
		}
	}
	return nil
}

func validateResponsesResponse(body []byte) error {
	var response struct {
		Status string `json:"status"`
		Output []struct {
			Type      string `json:"type"`
			Name      string `json:"name"`
			Arguments string `json:"arguments"`
			Content   []struct {
				Type string `json:"type"`
				Text string `json:"text"`
			} `json:"content"`
		} `json:"output"`
	}
	if err := common.Unmarshal(body, &response); err != nil {
		return fmt.Errorf("invalid responses API JSON: %w", err)
	}
	if response.Status == "incomplete" || response.Status == "failed" {
		return fmt.Errorf("responses API returned %s status", response.Status)
	}
	if len(response.Output) == 0 {
		return errors.New("responses API response has no output")
	}
	for _, output := range response.Output {
		if output.Type == "function_call" && output.Name != "" && output.Arguments != "" {
			return nil
		}
		for _, content := range output.Content {
			if content.Type == "output_text" && strings.TrimSpace(content.Text) != "" {
				return nil
			}
		}
	}
	return errors.New("responses API response has no usable output")
}
