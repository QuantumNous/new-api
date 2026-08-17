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
		return validateResponsesResponse(request, body)
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
	if ExtractFeatures(Input{Request: request}).Task == TaskCode && strings.Count(content, "```")%2 != 0 {
		return errors.New("code response has an incomplete code fence")
	}
	openAIRequest, _ := request.(*dto.GeneralOpenAIRequest)
	if openAIRequest != nil && openAIRequest.ResponseFormat != nil && openAIRequest.ResponseFormat.Type == "json_schema" {
		var structured any
		if err := common.Unmarshal([]byte(content), &structured); err != nil {
			return fmt.Errorf("structured response is not valid JSON: %w", err)
		}
		if len(openAIRequest.ResponseFormat.JsonSchema) > 0 {
			var format dto.FormatJsonSchema
			if err := common.Unmarshal(openAIRequest.ResponseFormat.JsonSchema, &format); err != nil {
				return fmt.Errorf("request JSON schema is invalid: %w", err)
			}
			if err := validateJSONSchemaValue(structured, format.Schema, "$", true); err != nil {
				return err
			}
		}
	}
	if openAIRequest == nil || len(choice.Message.ToolCalls) == 0 {
		return nil
	}
	allowed := make(map[string]any, len(openAIRequest.Tools))
	for _, tool := range openAIRequest.Tools {
		allowed[tool.Function.Name] = tool.Function.Parameters
	}
	for _, call := range choice.Message.ToolCalls {
		parameterSchema, ok := allowed[call.Function.Name]
		if !ok {
			return fmt.Errorf("response called undeclared tool %q", call.Function.Name)
		}
		var arguments any
		if err := common.Unmarshal([]byte(call.Function.Arguments), &arguments); err != nil {
			return fmt.Errorf("tool %q arguments are not valid JSON: %w", call.Function.Name, err)
		}
		if parameterSchema != nil {
			if err := validateJSONSchemaValue(arguments, parameterSchema, "$arguments", true); err != nil {
				return fmt.Errorf("tool %q arguments failed schema validation: %w", call.Function.Name, err)
			}
		}
	}
	return nil
}

func validateJSONSchemaValue(value, rawSchema any, path string, root bool) error {
	schema, ok := rawSchema.(map[string]any)
	if !ok {
		return nil
	}
	typeName, _ := schema["type"].(string)
	switch typeName {
	case "object":
		object, ok := value.(map[string]any)
		if !ok {
			return fmt.Errorf("JSON schema %s requires object", path)
		}
		if required, ok := schema["required"].([]any); ok {
			for _, item := range required {
				name, _ := item.(string)
				if _, exists := object[name]; name != "" && !exists {
					return fmt.Errorf("JSON schema %s is missing required field %q", path, name)
				}
			}
		}
		properties, _ := schema["properties"].(map[string]any)
		for name, propertySchema := range properties {
			if property, exists := object[name]; exists {
				if err := validateJSONSchemaValue(property, propertySchema, path+"."+name, false); err != nil {
					return err
				}
			}
		}
	case "array":
		items, ok := value.([]any)
		if !ok {
			return fmt.Errorf("JSON schema %s requires array", path)
		}
		for i, item := range items {
			if err := validateJSONSchemaValue(item, schema["items"], fmt.Sprintf("%s[%d]", path, i), false); err != nil {
				return err
			}
		}
	case "string":
		if _, ok := value.(string); !ok {
			return fmt.Errorf("JSON schema %s requires string", path)
		}
	case "number":
		if _, ok := value.(float64); !ok {
			return fmt.Errorf("JSON schema %s requires number", path)
		}
	case "integer":
		number, ok := value.(float64)
		if !ok || number != float64(int64(number)) {
			return fmt.Errorf("JSON schema %s requires integer", path)
		}
	case "boolean":
		if _, ok := value.(bool); !ok {
			return fmt.Errorf("JSON schema %s requires boolean", path)
		}
	default:
		if root && typeName == "" {
			return errors.New("JSON schema has no root type")
		}
	}
	return nil
}

func validateResponsesResponse(request dto.Request, body []byte) error {
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
	allowedTools := make(map[string]any)
	var responseSchema any
	if responsesRequest, ok := request.(*dto.OpenAIResponsesRequest); ok && len(responsesRequest.Tools) > 0 {
		var tools []struct {
			Name       string `json:"name"`
			Parameters any    `json:"parameters"`
		}
		if err := common.Unmarshal(responsesRequest.Tools, &tools); err == nil {
			for _, tool := range tools {
				allowedTools[tool.Name] = tool.Parameters
			}
		}
	}
	if responsesRequest, ok := request.(*dto.OpenAIResponsesRequest); ok && len(responsesRequest.Text) > 0 {
		var textConfig struct {
			Format struct {
				Type   string `json:"type"`
				Schema any    `json:"schema"`
			} `json:"format"`
		}
		if err := common.Unmarshal(responsesRequest.Text, &textConfig); err == nil && textConfig.Format.Type == "json_schema" {
			responseSchema = textConfig.Format.Schema
		}
	}
	for _, output := range response.Output {
		if output.Type == "function_call" && output.Name != "" && output.Arguments != "" {
			parameterSchema, declared := allowedTools[output.Name]
			if len(allowedTools) > 0 && !declared {
				return fmt.Errorf("response called undeclared tool %q", output.Name)
			}
			var arguments any
			if err := common.Unmarshal([]byte(output.Arguments), &arguments); err != nil {
				return fmt.Errorf("tool %q arguments are not valid JSON: %w", output.Name, err)
			}
			if parameterSchema != nil {
				if err := validateJSONSchemaValue(arguments, parameterSchema, "$arguments", true); err != nil {
					return fmt.Errorf("tool %q arguments failed schema validation: %w", output.Name, err)
				}
			}
			return nil
		}
		for _, content := range output.Content {
			if content.Type == "output_text" && strings.TrimSpace(content.Text) != "" {
				if responseSchema != nil {
					var structured any
					if err := common.Unmarshal([]byte(content.Text), &structured); err != nil {
						return fmt.Errorf("structured response is not valid JSON: %w", err)
					}
					if err := validateJSONSchemaValue(structured, responseSchema, "$", true); err != nil {
						return err
					}
				}
				return nil
			}
		}
	}
	return errors.New("responses API response has no usable output")
}
