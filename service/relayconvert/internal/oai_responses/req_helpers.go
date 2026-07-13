package oairesponses

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/types"
)

func openAIResponsesRequestFromAny(request any) (*dto.OpenAIResponsesRequest, error) {
	responsesRequest, ok := request.(*dto.OpenAIResponsesRequest)
	if !ok {
		if value, ok := request.(dto.OpenAIResponsesRequest); ok {
			responsesRequest = &value
		}
	}
	if responsesRequest == nil {
		return nil, fmt.Errorf("expected OpenAI responses request, got %T", request)
	}
	return responsesRequest, nil
}

func OpenAIResponsesRequestFromAny(request any) (*dto.OpenAIResponsesRequest, error) {
	return openAIResponsesRequestFromAny(request)
}

func responsesInputItems(raw []byte) ([]map[string]any, error) {
	if !rawJSONPresent(raw) {
		return nil, nil
	}

	switch common.GetJsonType(raw) {
	case "string":
		input, err := responsesJSONString(raw)
		if err != nil {
			return nil, fmt.Errorf("invalid input string: %w", err)
		}
		return []map[string]any{
			{
				"role":    "user",
				"content": input,
			},
		}, nil
	case "array":
		var items []map[string]any
		if err := common.Unmarshal(raw, &items); err != nil {
			return nil, fmt.Errorf("invalid input array: %w", err)
		}
		return items, nil
	default:
		return nil, fmt.Errorf("unsupported responses input type %q", common.GetJsonType(raw))
	}
}

func InputItems(raw []byte) ([]map[string]any, error) {
	return responsesInputItems(raw)
}

func responsesContentParts(content any) ([]map[string]any, error) {
	switch typed := content.(type) {
	case nil:
		return nil, nil
	case string:
		return []map[string]any{{"type": "input_text", "text": typed}}, nil
	case []map[string]any:
		return typed, nil
	case []any:
		parts := make([]map[string]any, 0, len(typed))
		for _, item := range typed {
			switch part := item.(type) {
			case string:
				parts = append(parts, map[string]any{"type": "input_text", "text": part})
			case map[string]any:
				parts = append(parts, part)
			default:
				raw, err := common.Marshal(part)
				if err != nil {
					return nil, err
				}
				parts = append(parts, map[string]any{"type": "input_text", "text": string(raw)})
			}
		}
		return parts, nil
	default:
		raw, err := common.Marshal(typed)
		if err != nil {
			return nil, err
		}
		return []map[string]any{{"type": "input_text", "text": string(raw)}}, nil
	}
}

func ContentParts(content any) ([]map[string]any, error) {
	return responsesContentParts(content)
}

func responsesRequestFunctionDeclarations(raw []byte) ([]dto.FunctionRequest, error) {
	if !rawJSONPresent(raw) {
		return nil, nil
	}

	var tools []map[string]any
	if err := common.Unmarshal(raw, &tools); err != nil {
		return nil, fmt.Errorf("invalid tools: %w", err)
	}

	functions := make([]dto.FunctionRequest, 0, len(tools))
	for _, tool := range tools {
		if strings.TrimSpace(common.Interface2String(tool["type"])) != "function" {
			continue
		}
		name := strings.TrimSpace(common.Interface2String(tool["name"]))
		if name == "" {
			continue
		}
		functions = append(functions, dto.FunctionRequest{
			Name:        name,
			Description: common.Interface2String(tool["description"]),
			Parameters:  tool["parameters"],
		})
	}
	return functions, nil
}

func RequestFunctionDeclarations(raw []byte) ([]dto.FunctionRequest, error) {
	return responsesRequestFunctionDeclarations(raw)
}

func responsesReasoningEffort(req *dto.OpenAIResponsesRequest) string {
	if req == nil || req.Reasoning == nil {
		return ""
	}
	return req.Reasoning.Effort
}

func ReasoningEffort(req *dto.OpenAIResponsesRequest) string {
	return responsesReasoningEffort(req)
}

func responsesObjectValue(value any, fallbackKey string) map[string]any {
	switch typed := value.(type) {
	case nil:
		return map[string]any{}
	case map[string]any:
		return typed
	case string:
		var object map[string]any
		if err := common.Unmarshal([]byte(typed), &object); err == nil {
			return object
		}
		var array []any
		if err := common.Unmarshal([]byte(typed), &array); err == nil {
			return map[string]any{fallbackKey: array}
		}
		return map[string]any{fallbackKey: typed}
	case []any:
		return map[string]any{fallbackKey: typed}
	default:
		return map[string]any{fallbackKey: typed}
	}
}

func ObjectValue(value any, fallbackKey string) map[string]any {
	return responsesObjectValue(value, fallbackKey)
}

func responsesGeminiResponseMap(value any) map[string]interface{} {
	switch typed := value.(type) {
	case nil:
		return map[string]interface{}{}
	case map[string]any:
		return typed
	case string:
		var object map[string]interface{}
		if err := common.Unmarshal([]byte(typed), &object); err == nil {
			return object
		}
		var array []interface{}
		if err := common.Unmarshal([]byte(typed), &array); err == nil {
			return map[string]interface{}{"result": array}
		}
		return map[string]interface{}{"content": typed}
	case []any:
		return map[string]interface{}{"result": typed}
	default:
		return map[string]interface{}{"content": typed}
	}
}

func GeminiResponseMap(value any) map[string]interface{} {
	return responsesGeminiResponseMap(value)
}

func responsesParallelToolCalls(raw []byte) *bool {
	if !rawJSONPresent(raw) || common.GetJsonType(raw) != "boolean" {
		return nil
	}
	var parallelToolCalls bool
	if err := common.Unmarshal(raw, &parallelToolCalls); err != nil {
		return nil
	}
	return &parallelToolCalls
}

func ParallelToolCalls(raw []byte) *bool {
	return responsesParallelToolCalls(raw)
}

func ContentPartToFileSource(part map[string]any) types.FileSource {
	partType := strings.TrimSpace(common.Interface2String(part["type"]))
	var data string
	var mimeType string

	switch partType {
	case "input_image":
		data, mimeType = responsesPartDataAndMime(part, "image_url", "url")
	case "input_file":
		data, mimeType = responsesPartDataAndMime(part, "file", "file_data", "file_url", "url")
	case "input_audio":
		data, mimeType = responsesPartDataAndMime(part, "input_audio", "data", "url")
		if mimeType == "" {
			if payload, ok := part["input_audio"].(map[string]any); ok {
				if format := strings.TrimSpace(common.Interface2String(payload["format"])); format != "" {
					mimeType = "audio/" + format
				}
			}
		}
	case "input_video":
		data, mimeType = responsesPartDataAndMime(part, "video_url", "url")
	}
	if data == "" {
		return nil
	}
	return types.NewFileSourceFromData(data, mimeType)
}

func responsesPartDataAndMime(part map[string]any, keys ...string) (string, string) {
	mimeType := strings.TrimSpace(common.Interface2String(part["mime_type"]))
	for _, key := range keys {
		value, ok := part[key]
		if !ok {
			continue
		}
		switch typed := value.(type) {
		case string:
			if typed != "" {
				return typed, mimeType
			}
		case map[string]any:
			if mimeType == "" {
				mimeType = strings.TrimSpace(common.Interface2String(typed["mime_type"]))
			}
			for _, nestedKey := range []string{"url", "file_data", "file_url", "data"} {
				if data := strings.TrimSpace(common.Interface2String(typed[nestedKey])); data != "" {
					return data, mimeType
				}
			}
		}
	}
	return "", mimeType
}
