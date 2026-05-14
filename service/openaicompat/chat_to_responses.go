package openaicompat

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/samber/lo"
)

func normalizeChatImageURLToString(v any) any {
	switch vv := v.(type) {
	case string:
		return vv
	case map[string]any:
		if url := common.Interface2String(vv["url"]); url != "" {
			return url
		}
		return v
	case dto.MessageImageUrl:
		if vv.Url != "" {
			return vv.Url
		}
		return v
	case *dto.MessageImageUrl:
		if vv != nil && vv.Url != "" {
			return vv.Url
		}
		return v
	default:
		return v
	}
}

func convertChatResponseFormatToResponsesText(reqFormat *dto.ResponseFormat) json.RawMessage {
	if reqFormat == nil || strings.TrimSpace(reqFormat.Type) == "" {
		return nil
	}

	format := map[string]any{
		"type": reqFormat.Type,
	}

	if reqFormat.Type == "json_schema" && len(reqFormat.JsonSchema) > 0 {
		var chatSchema map[string]any
		if err := common.Unmarshal(reqFormat.JsonSchema, &chatSchema); err == nil {
			for key, value := range chatSchema {
				if key == "type" {
					continue
				}
				format[key] = value
			}

			if nested, ok := format["json_schema"].(map[string]any); ok {
				for key, value := range nested {
					if _, exists := format[key]; !exists {
						format[key] = value
					}
				}
				delete(format, "json_schema")
			}
		} else {
			format["json_schema"] = reqFormat.JsonSchema
		}
	}

	textRaw, _ := common.Marshal(map[string]any{
		"format": format,
	})
	return textRaw
}

func convertChatToolParametersToResponsesParameters(parameters any) any {
	if parameters == nil {
		return nil
	}

	var schema map[string]any
	switch v := parameters.(type) {
	case map[string]any:
		schema = v
	case json.RawMessage:
		if len(v) == 0 {
			return nil
		}
		if err := common.Unmarshal(v, &schema); err != nil {
			return parameters
		}
	case []byte:
		if len(v) == 0 {
			return nil
		}
		if err := common.Unmarshal(v, &schema); err != nil {
			return parameters
		}
	default:
		b, err := common.Marshal(parameters)
		if err != nil {
			return parameters
		}
		if err := common.Unmarshal(b, &schema); err != nil {
			return parameters
		}
	}

	if normalized, ok := normalizeResponsesToolSchema(schema, true); ok {
		return normalized
	}
	return map[string]any{"type": "object", "properties": map[string]any{}}
}

func normalizeResponsesToolSchema(value any, isRoot bool) (any, bool) {
	schema, ok := value.(map[string]any)
	if !ok {
		return value, true
	}

	out := make(map[string]any, len(schema)+1)
	for key, val := range schema {
		if val == nil {
			continue
		}
		out[key] = val
	}

	for _, unionKey := range []string{"anyOf", "oneOf"} {
		if variants, ok := schemaArray(out[unionKey]); ok {
			nonNullVariants := make([]any, 0, len(variants))
			for _, variant := range variants {
				variantMap, _ := variant.(map[string]any)
				if isNullSchema(variantMap) {
					continue
				}
				if normalized, ok := normalizeResponsesToolSchema(variant, false); ok {
					nonNullVariants = append(nonNullVariants, normalized)
				}
			}
			if len(nonNullVariants) == 0 {
				if isRoot {
					delete(out, unionKey)
					continue
				}
				return nil, false
			}
			if len(nonNullVariants) == 1 {
				delete(out, unionKey)
				if normalizedMap, ok := nonNullVariants[0].(map[string]any); ok {
					out = mergeSchemaMetadata(out, normalizedMap)
				} else {
					out[unionKey] = nonNullVariants
				}
			} else {
				out[unionKey] = nonNullVariants
			}
		}
	}

	if types, ok := schemaStringArray(out["type"]); ok {
		nonNullTypes := make([]string, 0, len(types))
		for _, typ := range types {
			if typ != "null" {
				nonNullTypes = append(nonNullTypes, typ)
			}
		}
		switch len(nonNullTypes) {
		case 0:
			delete(out, "type")
		case 1:
			out["type"] = nonNullTypes[0]
		default:
			anyOf := make([]any, 0, len(nonNullTypes))
			for _, typ := range nonNullTypes {
				anyOf = append(anyOf, map[string]any{"type": typ})
			}
			delete(out, "type")
			out["anyOf"] = anyOf
		}
	}

	if props, ok := out["properties"].(map[string]any); ok {
		normalizedProps := make(map[string]any, len(props))
		for name, prop := range props {
			if normalized, ok := normalizeResponsesToolSchema(prop, false); ok {
				normalizedProps[name] = normalized
			}
		}
		out["properties"] = normalizedProps
		if required := filterRequiredToProperties(out["required"], normalizedProps); required != nil {
			out["required"] = required
		} else {
			delete(out, "required")
		}
		if _, hasType := out["type"]; !hasType {
			out["type"] = "object"
		}
	}

	if items, ok := out["items"]; ok {
		if normalized, ok := normalizeResponsesToolSchema(items, false); ok {
			out["items"] = normalized
		} else {
			delete(out, "items")
		}
		if _, hasType := out["type"]; !hasType {
			out["type"] = "array"
		}
	}

	if additionalProperties, ok := out["additionalProperties"].(map[string]any); ok {
		if normalized, ok := normalizeResponsesToolSchema(additionalProperties, false); ok {
			out["additionalProperties"] = normalized
		} else {
			delete(out, "additionalProperties")
		}
	}

	if _, hasType := out["type"]; !hasType {
		if inferred := inferTypeFromEnum(out["enum"]); inferred != "" {
			out["type"] = inferred
		}
	}

	if isRoot && len(out) == 0 {
		return map[string]any{"type": "object", "properties": map[string]any{}}, true
	}
	if !isRoot && !hasSchemaShape(out) {
		return nil, false
	}
	return out, true
}

func schemaArray(value any) ([]any, bool) {
	switch v := value.(type) {
	case []any:
		return v, true
	case []map[string]any:
		items := make([]any, 0, len(v))
		for _, item := range v {
			items = append(items, item)
		}
		return items, true
	default:
		return nil, false
	}
}

func schemaStringArray(value any) ([]string, bool) {
	switch v := value.(type) {
	case []any:
		items := make([]string, 0, len(v))
		for _, item := range v {
			str, ok := item.(string)
			if !ok {
				return nil, false
			}
			items = append(items, str)
		}
		return items, true
	case []string:
		return v, true
	default:
		return nil, false
	}
}

func isNullSchema(schema map[string]any) bool {
	if schema == nil {
		return false
	}
	if typ, ok := schema["type"].(string); ok {
		return typ == "null"
	}
	if types, ok := schemaStringArray(schema["type"]); ok {
		return len(types) == 1 && types[0] == "null"
	}
	return false
}

func mergeSchemaMetadata(parent map[string]any, child map[string]any) map[string]any {
	merged := make(map[string]any, len(parent)+len(child))
	for key, value := range parent {
		if isSchemaStructureKey(key) {
			continue
		}
		merged[key] = value
	}
	for key, value := range child {
		merged[key] = value
	}
	return merged
}

func isSchemaStructureKey(key string) bool {
	switch key {
	case "type", "properties", "items", "additionalProperties", "anyOf", "oneOf", "allOf", "$ref", "enum", "const":
		return true
	default:
		return false
	}
}

func filterRequiredToProperties(required any, properties map[string]any) any {
	items, ok := schemaStringArray(required)
	if !ok {
		return required
	}
	filtered := make([]string, 0, len(items))
	for _, item := range items {
		if _, ok := properties[item]; ok {
			filtered = append(filtered, item)
		}
	}
	if len(filtered) == 0 {
		return nil
	}
	return filtered
}

func inferTypeFromEnum(enum any) string {
	items, ok := schemaArray(enum)
	if !ok {
		return ""
	}
	var inferred string
	for _, item := range items {
		if item == nil {
			continue
		}
		var typ string
		switch item.(type) {
		case string:
			typ = "string"
		case float64, float32, int, int64, int32, uint, uint64, uint32:
			typ = "number"
		case bool:
			typ = "boolean"
		}
		if typ == "" {
			return ""
		}
		if inferred == "" {
			inferred = typ
		} else if inferred != typ {
			return ""
		}
	}
	return inferred
}

func hasSchemaShape(schema map[string]any) bool {
	for _, key := range []string{"type", "properties", "items", "enum", "const", "anyOf", "oneOf", "allOf", "$ref"} {
		if _, ok := schema[key]; ok {
			return true
		}
	}
	return false
}

func normalizedChatToolParametersByName(tools []dto.ToolCallRequest) map[string]map[string]any {
	if len(tools) == 0 {
		return nil
	}

	parametersByName := make(map[string]map[string]any)
	for _, tool := range tools {
		if tool.Type != "function" {
			continue
		}
		name := strings.TrimSpace(tool.Function.Name)
		if name == "" {
			continue
		}
		parameters, ok := convertChatToolParametersToResponsesParameters(tool.Function.Parameters).(map[string]any)
		if ok {
			parametersByName[name] = parameters
		}
	}
	return parametersByName
}

func convertChatToolCallArgumentsToResponsesArguments(arguments string, parameters map[string]any) string {
	if strings.TrimSpace(arguments) == "" || len(parameters) == 0 {
		return arguments
	}

	properties, ok := parameters["properties"].(map[string]any)
	if !ok {
		return arguments
	}

	var args map[string]any
	if err := common.Unmarshal([]byte(arguments), &args); err != nil {
		return arguments
	}

	changed := false
	for name, value := range args {
		property, exists := properties[name]
		if !exists {
			if isEmptyToolArgumentValue(value) {
				delete(args, name)
				changed = true
			}
			continue
		}
		if value == "" && !toolSchemaAllowsString(property) {
			delete(args, name)
			changed = true
		}
	}
	if !changed {
		return arguments
	}

	b, err := common.Marshal(args)
	if err != nil {
		return arguments
	}
	return string(b)
}

func isEmptyToolArgumentValue(value any) bool {
	switch v := value.(type) {
	case nil:
		return true
	case string:
		return strings.TrimSpace(v) == ""
	case []any:
		return len(v) == 0
	case map[string]any:
		return len(v) == 0
	default:
		return false
	}
}

func toolSchemaAllowsString(value any) bool {
	schema, ok := value.(map[string]any)
	if !ok {
		return true
	}
	if typ, ok := schema["type"].(string); ok {
		return typ == "string"
	}
	if types, ok := schemaStringArray(schema["type"]); ok {
		for _, typ := range types {
			if typ == "string" {
				return true
			}
		}
		return false
	}
	for _, unionKey := range []string{"anyOf", "oneOf"} {
		variants, ok := schemaArray(schema[unionKey])
		if !ok {
			continue
		}
		for _, variant := range variants {
			if toolSchemaAllowsString(variant) {
				return true
			}
		}
		return false
	}
	return true
}

func ChatCompletionsRequestToResponsesRequest(req *dto.GeneralOpenAIRequest) (*dto.OpenAIResponsesRequest, error) {
	if req == nil {
		return nil, errors.New("request is nil")
	}
	if req.Model == "" {
		return nil, errors.New("model is required")
	}
	if lo.FromPtrOr(req.N, 1) > 1 {
		return nil, fmt.Errorf("n>1 is not supported in responses compatibility mode")
	}

	var instructionsParts []string
	inputItems := make([]map[string]any, 0, len(req.Messages))
	toolParametersByName := normalizedChatToolParametersByName(req.Tools)

	for _, msg := range req.Messages {
		role := strings.TrimSpace(msg.Role)
		if role == "" {
			continue
		}

		if role == "tool" || role == "function" {
			callID := strings.TrimSpace(msg.ToolCallId)

			var output any
			if msg.Content == nil {
				output = ""
			} else if msg.IsStringContent() {
				output = msg.StringContent()
			} else {
				if b, err := common.Marshal(msg.Content); err == nil {
					output = string(b)
				} else {
					output = fmt.Sprintf("%v", msg.Content)
				}
			}

			if callID == "" {
				inputItems = append(inputItems, map[string]any{
					"role":    "user",
					"content": fmt.Sprintf("[tool_output_missing_call_id] %v", output),
				})
				continue
			}

			inputItems = append(inputItems, map[string]any{
				"type":    "function_call_output",
				"call_id": callID,
				"output":  output,
			})
			continue
		}

		// Prefer mapping system/developer messages into `instructions`.
		if role == "system" || role == "developer" {
			if msg.Content == nil {
				continue
			}
			if msg.IsStringContent() {
				if s := strings.TrimSpace(msg.StringContent()); s != "" {
					instructionsParts = append(instructionsParts, s)
				}
				continue
			}
			parts := msg.ParseContent()
			var sb strings.Builder
			for _, part := range parts {
				if part.Type == dto.ContentTypeText && strings.TrimSpace(part.Text) != "" {
					if sb.Len() > 0 {
						sb.WriteString("\n")
					}
					sb.WriteString(part.Text)
				}
			}
			if s := strings.TrimSpace(sb.String()); s != "" {
				instructionsParts = append(instructionsParts, s)
			}
			continue
		}

		item := map[string]any{
			"role": role,
		}

		if msg.Content == nil {
			item["content"] = ""
			inputItems = append(inputItems, item)

			if role == "assistant" {
				for _, tc := range msg.ParseToolCalls() {
					if strings.TrimSpace(tc.ID) == "" {
						continue
					}
					if tc.Type != "" && tc.Type != "function" {
						continue
					}
					name := strings.TrimSpace(tc.Function.Name)
					if name == "" {
						continue
					}
					inputItems = append(inputItems, map[string]any{
						"type":      "function_call",
						"call_id":   tc.ID,
						"name":      name,
						"arguments": convertChatToolCallArgumentsToResponsesArguments(tc.Function.Arguments, toolParametersByName[name]),
					})
				}
			}
			continue
		}

		if msg.IsStringContent() {
			item["content"] = msg.StringContent()
			inputItems = append(inputItems, item)

			if role == "assistant" {
				for _, tc := range msg.ParseToolCalls() {
					if strings.TrimSpace(tc.ID) == "" {
						continue
					}
					if tc.Type != "" && tc.Type != "function" {
						continue
					}
					name := strings.TrimSpace(tc.Function.Name)
					if name == "" {
						continue
					}
					inputItems = append(inputItems, map[string]any{
						"type":      "function_call",
						"call_id":   tc.ID,
						"name":      name,
						"arguments": convertChatToolCallArgumentsToResponsesArguments(tc.Function.Arguments, toolParametersByName[name]),
					})
				}
			}
			continue
		}

		parts := msg.ParseContent()
		contentParts := make([]map[string]any, 0, len(parts))
		for _, part := range parts {
			switch part.Type {
			case dto.ContentTypeText:
				textType := "input_text"
				if role == "assistant" {
					textType = "output_text"
				}
				contentParts = append(contentParts, map[string]any{
					"type": textType,
					"text": part.Text,
				})
			case dto.ContentTypeImageURL:
				contentParts = append(contentParts, map[string]any{
					"type":      "input_image",
					"image_url": normalizeChatImageURLToString(part.ImageUrl),
				})
			case dto.ContentTypeInputAudio:
				contentParts = append(contentParts, map[string]any{
					"type":        "input_audio",
					"input_audio": part.InputAudio,
				})
			case dto.ContentTypeFile:
				contentParts = append(contentParts, map[string]any{
					"type": "input_file",
					"file": part.File,
				})
			case dto.ContentTypeVideoUrl:
				contentParts = append(contentParts, map[string]any{
					"type":      "input_video",
					"video_url": part.VideoUrl,
				})
			default:
				contentParts = append(contentParts, map[string]any{
					"type": part.Type,
				})
			}
		}
		item["content"] = contentParts
		inputItems = append(inputItems, item)

		if role == "assistant" {
			for _, tc := range msg.ParseToolCalls() {
				if strings.TrimSpace(tc.ID) == "" {
					continue
				}
				if tc.Type != "" && tc.Type != "function" {
					continue
				}
				name := strings.TrimSpace(tc.Function.Name)
				if name == "" {
					continue
				}
				inputItems = append(inputItems, map[string]any{
					"type":      "function_call",
					"call_id":   tc.ID,
					"name":      name,
					"arguments": convertChatToolCallArgumentsToResponsesArguments(tc.Function.Arguments, toolParametersByName[name]),
				})
			}
		}
	}

	inputRaw, err := common.Marshal(inputItems)
	if err != nil {
		return nil, err
	}

	var instructionsRaw json.RawMessage
	if len(instructionsParts) > 0 {
		instructions := strings.Join(instructionsParts, "\n\n")
		instructionsRaw, _ = common.Marshal(instructions)
	}

	var toolsRaw json.RawMessage
	if req.Tools != nil {
		tools := make([]map[string]any, 0, len(req.Tools))
		for _, tool := range req.Tools {
			switch tool.Type {
			case "function":
				toolMap := map[string]any{
					"type": "function",
					"name": tool.Function.Name,
				}
				if tool.Function.Description != "" {
					toolMap["description"] = tool.Function.Description
				}
				if parameters := convertChatToolParametersToResponsesParameters(tool.Function.Parameters); parameters != nil {
					toolMap["parameters"] = parameters
				}
				tools = append(tools, toolMap)
			default:
				// Best-effort: keep original tool shape for unknown types.
				var m map[string]any
				if b, err := common.Marshal(tool); err == nil {
					_ = common.Unmarshal(b, &m)
				}
				if len(m) == 0 {
					m = map[string]any{"type": tool.Type}
				}
				tools = append(tools, m)
			}
		}
		toolsRaw, _ = common.Marshal(tools)
	}

	var toolChoiceRaw json.RawMessage
	if req.ToolChoice != nil {
		switch v := req.ToolChoice.(type) {
		case string:
			toolChoiceRaw, _ = common.Marshal(v)
		default:
			var m map[string]any
			if b, err := common.Marshal(v); err == nil {
				_ = common.Unmarshal(b, &m)
			}
			if m == nil {
				toolChoiceRaw, _ = common.Marshal(v)
			} else if t, _ := m["type"].(string); t == "function" {
				// Chat: {"type":"function","function":{"name":"..."}}
				// Responses: {"type":"function","name":"..."}
				if name, ok := m["name"].(string); ok && name != "" {
					toolChoiceRaw, _ = common.Marshal(map[string]any{
						"type": "function",
						"name": name,
					})
				} else if fn, ok := m["function"].(map[string]any); ok {
					if name, ok := fn["name"].(string); ok && name != "" {
						toolChoiceRaw, _ = common.Marshal(map[string]any{
							"type": "function",
							"name": name,
						})
					} else {
						toolChoiceRaw, _ = common.Marshal(v)
					}
				} else {
					toolChoiceRaw, _ = common.Marshal(v)
				}
			} else {
				toolChoiceRaw, _ = common.Marshal(v)
			}
		}
	}

	var parallelToolCallsRaw json.RawMessage
	if req.ParallelTooCalls != nil {
		parallelToolCallsRaw, _ = common.Marshal(*req.ParallelTooCalls)
	}

	textRaw := convertChatResponseFormatToResponsesText(req.ResponseFormat)

	maxOutputTokens := lo.FromPtrOr(req.MaxTokens, uint(0))
	maxCompletionTokens := lo.FromPtrOr(req.MaxCompletionTokens, uint(0))
	if maxCompletionTokens > maxOutputTokens {
		maxOutputTokens = maxCompletionTokens
	}
	// OpenAI Responses API rejects max_output_tokens < 16 when explicitly provided.
	//if maxOutputTokens > 0 && maxOutputTokens < 16 {
	//	maxOutputTokens = 16
	//}

	var topP *float64
	if req.TopP != nil {
		topP = common.GetPointer(lo.FromPtr(req.TopP))
	}

	out := &dto.OpenAIResponsesRequest{
		Model:             req.Model,
		Input:             inputRaw,
		Instructions:      instructionsRaw,
		Stream:            req.Stream,
		Temperature:       req.Temperature,
		Text:              textRaw,
		ToolChoice:        toolChoiceRaw,
		Tools:             toolsRaw,
		TopP:              topP,
		User:              req.User,
		ParallelToolCalls: parallelToolCallsRaw,
		Store:             req.Store,
		Metadata:          req.Metadata,
	}
	if req.MaxTokens != nil || req.MaxCompletionTokens != nil {
		out.MaxOutputTokens = lo.ToPtr(maxOutputTokens)
	}

	if req.ReasoningEffort != "" {
		out.Reasoning = &dto.Reasoning{
			Effort:  req.ReasoningEffort,
			Summary: "detailed",
		}
	}

	return out, nil
}
