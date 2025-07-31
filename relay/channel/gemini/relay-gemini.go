package gemini

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"one-api/common"
	"one-api/constant"
	"one-api/dto"
	relaycommon "one-api/relay/common"
	"one-api/relay/helper"
	"one-api/service"
	"one-api/setting/model_setting"
	"one-api/types"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/gin-gonic/gin"
)

var geminiSupportedMimeTypes = map[string]bool{
	"application/pdf": true,
	"audio/mpeg":      true,
	"audio/mp3":       true,
	"audio/wav":       true,
	"image/png":       true,
	"image/jpeg":      true,
	"text/plain":      true,
	"video/mov":       true,
	"video/mpeg":      true,
	"video/mp4":       true,
	"video/mpg":       true,
	"video/avi":       true,
	"video/wmv":       true,
	"video/mpegps":    true,
	"video/flv":       true,
}

// Gemini 允许的思考预算范围
const (
	pro25MinBudget       = 128
	pro25MaxBudget       = 32768
	flash25MaxBudget     = 24576
	flash25LiteMinBudget = 512
	flash25LiteMaxBudget = 24576
)

// clampThinkingBudget 根据模型名称将预算限制在允许的范围内
func clampThinkingBudget(modelName string, budget int) int {
	isNew25Pro := strings.HasPrefix(modelName, "gemini-2.5-pro") &&
		!strings.HasPrefix(modelName, "gemini-2.5-pro-preview-05-06") &&
		!strings.HasPrefix(modelName, "gemini-2.5-pro-preview-03-25")
	is25FlashLite := strings.HasPrefix(modelName, "gemini-2.5-flash-lite")

	if is25FlashLite {
		if budget < flash25LiteMinBudget {
			return flash25LiteMinBudget
		}
		if budget > flash25LiteMaxBudget {
			return flash25LiteMaxBudget
		}
	} else if isNew25Pro {
		if budget < pro25MinBudget {
			return pro25MinBudget
		}
		if budget > pro25MaxBudget {
			return pro25MaxBudget
		}
	} else { // 其他模型
		if budget < 0 {
			return 0
		}
		if budget > flash25MaxBudget {
			return flash25MaxBudget
		}
	}
	return budget
}

func ThinkingAdaptor(geminiRequest *GeminiChatRequest, info *relaycommon.RelayInfo) {
	if model_setting.GetGeminiSettings().ThinkingAdapterEnabled {
		modelName := info.UpstreamModelName
		isNew25Pro := strings.HasPrefix(modelName, "gemini-2.5-pro") &&
			!strings.HasPrefix(modelName, "gemini-2.5-pro-preview-05-06") &&
			!strings.HasPrefix(modelName, "gemini-2.5-pro-preview-03-25")

		if strings.Contains(modelName, "-thinking-") {
			parts := strings.SplitN(modelName, "-thinking-", 2)
			if len(parts) == 2 && parts[1] != "" {
				if budgetTokens, err := strconv.Atoi(parts[1]); err == nil {
					clampedBudget := clampThinkingBudget(modelName, budgetTokens)
					geminiRequest.GenerationConfig.ThinkingConfig = &GeminiThinkingConfig{
						ThinkingBudget:  common.GetPointer(clampedBudget),
						IncludeThoughts: true,
					}
				}
			}
		} else if strings.HasSuffix(modelName, "-thinking") {
			unsupportedModels := []string{
				"gemini-2.5-pro-preview-05-06",
				"gemini-2.5-pro-preview-03-25",
			}
			isUnsupported := false
			for _, unsupportedModel := range unsupportedModels {
				if strings.HasPrefix(modelName, unsupportedModel) {
					isUnsupported = true
					break
				}
			}

			if isUnsupported {
				geminiRequest.GenerationConfig.ThinkingConfig = &GeminiThinkingConfig{
					IncludeThoughts: true,
				}
			} else {
				geminiRequest.GenerationConfig.ThinkingConfig = &GeminiThinkingConfig{
					IncludeThoughts: true,
				}
				if geminiRequest.GenerationConfig.MaxOutputTokens > 0 {
					budgetTokens := model_setting.GetGeminiSettings().ThinkingAdapterBudgetTokensPercentage * float64(geminiRequest.GenerationConfig.MaxOutputTokens)
					clampedBudget := clampThinkingBudget(modelName, int(budgetTokens))
					geminiRequest.GenerationConfig.ThinkingConfig.ThinkingBudget = common.GetPointer(clampedBudget)
				}
			}
		} else if strings.HasSuffix(modelName, "-nothinking") {
			if !isNew25Pro {
				geminiRequest.GenerationConfig.ThinkingConfig = &GeminiThinkingConfig{
					ThinkingBudget: common.GetPointer(0),
				}
			}
		}
	}
}

// Setting safety to the lowest possible values since Gemini is already powerless enough
func CovertGemini2OpenAI(textRequest dto.GeneralOpenAIRequest, info *relaycommon.RelayInfo) (*GeminiChatRequest, error) {

	geminiRequest := GeminiChatRequest{
		Contents: make([]GeminiChatContent, 0, len(textRequest.Messages)),
		GenerationConfig: GeminiChatGenerationConfig{
			Temperature:     textRequest.Temperature,
			TopP:            textRequest.TopP,
			MaxOutputTokens: textRequest.MaxTokens,
			Seed:            int64(textRequest.Seed),
		},
	}

	if model_setting.IsGeminiModelSupportImagine(info.UpstreamModelName) {
		geminiRequest.GenerationConfig.ResponseModalities = []string{
			"TEXT",
			"IMAGE",
		}
	}

	ThinkingAdaptor(&geminiRequest, info)

	safetySettings := make([]GeminiChatSafetySettings, 0, len(SafetySettingList))
	for _, category := range SafetySettingList {
		safetySettings = append(safetySettings, GeminiChatSafetySettings{
			Category:  category,
			Threshold: model_setting.GetGeminiSafetySetting(category),
		})
	}
	geminiRequest.SafetySettings = safetySettings

	// openaiContent.FuncToToolCalls()
	if textRequest.Tools != nil {
		functions := make([]dto.FunctionRequest, 0, len(textRequest.Tools))
		googleSearch := false
		codeExecution := false
		for _, tool := range textRequest.Tools {
			if tool.Function.Name == "googleSearch" {
				googleSearch = true
				continue
			}
			if tool.Function.Name == "codeExecution" {
				codeExecution = true
				continue
			}
			if tool.Function.Parameters != nil {

				params, ok := tool.Function.Parameters.(map[string]interface{})
				if ok {
					if props, hasProps := params["properties"].(map[string]interface{}); hasProps {
						if len(props) == 0 {
							tool.Function.Parameters = nil
						}
					}
				}
			}
			// Clean the parameters before appending
			cleanedParams := cleanFunctionParameters(tool.Function.Parameters)
			tool.Function.Parameters = cleanedParams
			functions = append(functions, tool.Function)
		}
		if codeExecution {
			geminiRequest.Tools = append(geminiRequest.Tools, GeminiChatTool{
				CodeExecution: make(map[string]string),
			})
		}
		if googleSearch {
			geminiRequest.Tools = append(geminiRequest.Tools, GeminiChatTool{
				GoogleSearch: make(map[string]string),
			})
		}
		if len(functions) > 0 {
			geminiRequest.Tools = append(geminiRequest.Tools, GeminiChatTool{
				FunctionDeclarations: functions,
			})
		}
		// common.SysLog("tools: " + fmt.Sprintf("%+v", geminiRequest.Tools))
		// json_data, _ := json.Marshal(geminiRequest.Tools)
		// common.SysLog("tools_json: " + string(json_data))
	}

	if textRequest.ResponseFormat != nil && (textRequest.ResponseFormat.Type == "json_schema" || textRequest.ResponseFormat.Type == "json_object") {
		geminiRequest.GenerationConfig.ResponseMimeType = "application/json"

		if textRequest.ResponseFormat.JsonSchema != nil && textRequest.ResponseFormat.JsonSchema.Schema != nil {
			cleanedSchema := removeAdditionalPropertiesWithDepth(textRequest.ResponseFormat.JsonSchema.Schema, 0)
			geminiRequest.GenerationConfig.ResponseSchema = cleanedSchema
		}
	}
	tool_call_ids := make(map[string]string)
	var system_content []string
	//shouldAddDummyModelMessage := false
	for _, message := range textRequest.Messages {
		if message.Role == "system" {
			system_content = append(system_content, message.StringContent())
			continue
		} else if message.Role == "tool" || message.Role == "function" {
			if len(geminiRequest.Contents) == 0 || geminiRequest.Contents[len(geminiRequest.Contents)-1].Role == "model" {
				geminiRequest.Contents = append(geminiRequest.Contents, GeminiChatContent{
					Role: "user",
				})
			}
			var parts = &geminiRequest.Contents[len(geminiRequest.Contents)-1].Parts
			name := ""
			if message.Name != nil {
				name = *message.Name
			} else if val, exists := tool_call_ids[message.ToolCallId]; exists {
				name = val
			}
			var contentMap map[string]interface{}
			contentStr := message.StringContent()

			// 1. 尝试解析为 JSON 对象
			if err := json.Unmarshal([]byte(contentStr), &contentMap); err != nil {
				// 2. 如果失败，尝试解析为 JSON 数组
				var contentSlice []interface{}
				if err := json.Unmarshal([]byte(contentStr), &contentSlice); err == nil {
					// 如果是数组，包装成对象
					contentMap = map[string]interface{}{"result": contentSlice}
				} else {
					// 3. 如果再次失败，作为纯文本处理
					contentMap = map[string]interface{}{"content": contentStr}
				}
			}

			functionResp := &FunctionResponse{
				Name:     name,
				Response: contentMap,
			}

			*parts = append(*parts, GeminiPart{
				FunctionResponse: functionResp,
			})
			continue
		}
		var parts []GeminiPart
		content := GeminiChatContent{
			Role: message.Role,
		}
		// isToolCall := false
		if message.ToolCalls != nil {
			// message.Role = "model"
			// isToolCall = true
			for _, call := range message.ParseToolCalls() {
				args := map[string]interface{}{}
				if call.Function.Arguments != "" {
					if json.Unmarshal([]byte(call.Function.Arguments), &args) != nil {
						return nil, fmt.Errorf("invalid arguments for function %s, args: %s", call.Function.Name, call.Function.Arguments)
					}
				}
				toolCall := GeminiPart{
					FunctionCall: &FunctionCall{
						FunctionName: call.Function.Name,
						Arguments:    args,
					},
				}
				parts = append(parts, toolCall)
				tool_call_ids[call.ID] = call.Function.Name
			}
		}

		openaiContent := message.ParseContent()
		imageNum := 0
		for _, part := range openaiContent {
			if part.Type == dto.ContentTypeText {
				if part.Text == "" {
					continue
				}
				parts = append(parts, GeminiPart{
					Text: part.Text,
				})
			} else if part.Type == dto.ContentTypeImageURL {
				imageNum += 1

				if constant.GeminiVisionMaxImageNum != -1 && imageNum > constant.GeminiVisionMaxImageNum {
					return nil, fmt.Errorf("too many images in the message, max allowed is %d", constant.GeminiVisionMaxImageNum)
				}
				// 判断是否是url
				if strings.HasPrefix(part.GetImageMedia().Url, "http") {
					// 是url，获取文件的类型和base64编码的数据
					fileData, err := service.GetFileBase64FromUrl(part.GetImageMedia().Url)
					if err != nil {
						return nil, fmt.Errorf("get file base64 from url '%s' failed: %w", part.GetImageMedia().Url, err)
					}

					// 校验 MimeType 是否在 Gemini 支持的白名单中
					if _, ok := geminiSupportedMimeTypes[strings.ToLower(fileData.MimeType)]; !ok {
						url := part.GetImageMedia().Url
						return nil, fmt.Errorf("mime type is not supported by Gemini: '%s', url: '%s', supported types are: %v", fileData.MimeType, url, getSupportedMimeTypesList())
					}

					parts = append(parts, GeminiPart{
						InlineData: &GeminiInlineData{
							MimeType: fileData.MimeType, // 使用原始的 MimeType，因为大小写可能对API有意义
							Data:     fileData.Base64Data,
						},
					})
				} else {
					format, base64String, err := service.DecodeBase64FileData(part.GetImageMedia().Url)
					if err != nil {
						return nil, fmt.Errorf("decode base64 image data failed: %s", err.Error())
					}
					parts = append(parts, GeminiPart{
						InlineData: &GeminiInlineData{
							MimeType: format,
							Data:     base64String,
						},
					})
				}
			} else if part.Type == dto.ContentTypeFile {
				if part.GetFile().FileId != "" {
					return nil, fmt.Errorf("only base64 file is supported in gemini")
				}
				format, base64String, err := service.DecodeBase64FileData(part.GetFile().FileData)
				if err != nil {
					return nil, fmt.Errorf("decode base64 file data failed: %s", err.Error())
				}
				parts = append(parts, GeminiPart{
					InlineData: &GeminiInlineData{
						MimeType: format,
						Data:     base64String,
					},
				})
			} else if part.Type == dto.ContentTypeInputAudio {
				if part.GetInputAudio().Data == "" {
					return nil, fmt.Errorf("only base64 audio is supported in gemini")
				}
				base64String, err := service.DecodeBase64AudioData(part.GetInputAudio().Data)
				if err != nil {
					return nil, fmt.Errorf("decode base64 audio data failed: %s", err.Error())
				}
				parts = append(parts, GeminiPart{
					InlineData: &GeminiInlineData{
						MimeType: "audio/" + part.GetInputAudio().Format,
						Data:     base64String,
					},
				})
			}
		}

		content.Parts = parts

		// there's no assistant role in gemini and API shall vomit if Role is not user or model
		if content.Role == "assistant" {
			content.Role = "model"
		}
		if len(content.Parts) > 0 {
			geminiRequest.Contents = append(geminiRequest.Contents, content)
		}
	}

	if len(system_content) > 0 {
		geminiRequest.SystemInstructions = &GeminiChatContent{
			Parts: []GeminiPart{
				{
					Text: strings.Join(system_content, "\n"),
				},
			},
		}
	}

	return &geminiRequest, nil
}

// Helper function to get a list of supported MIME types for error messages
func getSupportedMimeTypesList() []string {
	keys := make([]string, 0, len(geminiSupportedMimeTypes))
	for k := range geminiSupportedMimeTypes {
		keys = append(keys, k)
	}
	return keys
}

// cleanFunctionParameters recursively removes unsupported fields from Gemini function parameters.
func cleanFunctionParameters(params interface{}) interface{} {
	if params == nil {
		return nil
	}

	switch v := params.(type) {
	case map[string]interface{}:
		// Create a copy to avoid modifying the original
		cleanedMap := make(map[string]interface{})
		for k, val := range v {
			cleanedMap[k] = val
		}

		// Remove unsupported root-level fields
		delete(cleanedMap, "default")
		delete(cleanedMap, "exclusiveMaximum")
		delete(cleanedMap, "exclusiveMinimum")
		delete(cleanedMap, "$schema")
		delete(cleanedMap, "additionalProperties")

		// Check and clean 'format' for string types
		if propType, typeExists := cleanedMap["type"].(string); typeExists && propType == "string" {
			if formatValue, formatExists := cleanedMap["format"].(string); formatExists {
				if formatValue != "enum" && formatValue != "date-time" {
					delete(cleanedMap, "format")
				}
			}
		}

		// Clean properties
		if props, ok := cleanedMap["properties"].(map[string]interface{}); ok && props != nil {
			cleanedProps := make(map[string]interface{})
			for propName, propValue := range props {
				cleanedProps[propName] = cleanFunctionParameters(propValue)
			}
			cleanedMap["properties"] = cleanedProps
		}

		// Recursively clean items in arrays
		if items, ok := cleanedMap["items"].(map[string]interface{}); ok && items != nil {
			cleanedMap["items"] = cleanFunctionParameters(items)
		}
		// Also handle items if it's an array of schemas
		if itemsArray, ok := cleanedMap["items"].([]interface{}); ok {
			cleanedItemsArray := make([]interface{}, len(itemsArray))
			for i, item := range itemsArray {
				cleanedItemsArray[i] = cleanFunctionParameters(item)
			}
			cleanedMap["items"] = cleanedItemsArray
		}

		// Recursively clean other schema composition keywords
		for _, field := range []string{"allOf", "anyOf", "oneOf"} {
			if nested, ok := cleanedMap[field].([]interface{}); ok {
				cleanedNested := make([]interface{}, len(nested))
				for i, item := range nested {
					cleanedNested[i] = cleanFunctionParameters(item)
				}
				cleanedMap[field] = cleanedNested
			}
		}

		// Recursively clean patternProperties
		if patternProps, ok := cleanedMap["patternProperties"].(map[string]interface{}); ok {
			cleanedPatternProps := make(map[string]interface{})
			for pattern, schema := range patternProps {
				cleanedPatternProps[pattern] = cleanFunctionParameters(schema)
			}
			cleanedMap["patternProperties"] = cleanedPatternProps
		}

		// Recursively clean definitions
		if definitions, ok := cleanedMap["definitions"].(map[string]interface{}); ok {
			cleanedDefinitions := make(map[string]interface{})
			for defName, defSchema := range definitions {
				cleanedDefinitions[defName] = cleanFunctionParameters(defSchema)
			}
			cleanedMap["definitions"] = cleanedDefinitions
		}

		// Recursively clean $defs (newer JSON Schema draft)
		if defs, ok := cleanedMap["$defs"].(map[string]interface{}); ok {
			cleanedDefs := make(map[string]interface{})
			for defName, defSchema := range defs {
				cleanedDefs[defName] = cleanFunctionParameters(defSchema)
			}
			cleanedMap["$defs"] = cleanedDefs
		}

		// Clean conditional keywords
		for _, field := range []string{"if", "then", "else", "not"} {
			if nested, ok := cleanedMap[field]; ok {
				cleanedMap[field] = cleanFunctionParameters(nested)
			}
		}

		return cleanedMap

	case []interface{}:
		// Handle arrays of schemas
		cleanedArray := make([]interface{}, len(v))
		for i, item := range v {
			cleanedArray[i] = cleanFunctionParameters(item)
		}
		return cleanedArray

	default:
		// Not a map or array, return as is (e.g., could be a primitive)
		return params
	}
}

func removeAdditionalPropertiesWithDepth(schema interface{}, depth int) interface{} {
	if depth >= 5 {
		return schema
	}

	v, ok := schema.(map[string]interface{})
	if !ok || len(v) == 0 {
		return schema
	}
	// 删除所有的title字段
	delete(v, "title")
	delete(v, "$schema")
	// 如果type不为object和array，则直接返回
	if typeVal, exists := v["type"]; !exists || (typeVal != "object" && typeVal != "array") {
		return schema
	}
	switch v["type"] {
	case "object":
		delete(v, "additionalProperties")
		// 处理 properties
		if properties, ok := v["properties"].(map[string]interface{}); ok {
			for key, value := range properties {
				properties[key] = removeAdditionalPropertiesWithDepth(value, depth+1)
			}
		}
		for _, field := range []string{"allOf", "anyOf", "oneOf"} {
			if nested, ok := v[field].([]interface{}); ok {
				for i, item := range nested {
					nested[i] = removeAdditionalPropertiesWithDepth(item, depth+1)
				}
			}
		}
	case "array":
		if items, ok := v["items"].(map[string]interface{}); ok {
			v["items"] = removeAdditionalPropertiesWithDepth(items, depth+1)
		}
	}

	return v
}

func unescapeString(s string) (string, error) {
	var result []rune
	escaped := false
	i := 0

	for i < len(s) {
		r, size := utf8.DecodeRuneInString(s[i:]) // 正确解码UTF-8字符
		if r == utf8.RuneError {
			return "", fmt.Errorf("invalid UTF-8 encoding")
		}

		if escaped {
			// 如果是转义符后的字符，检查其类型
			switch r {
			case '"':
				result = append(result, '"')
			case '\\':
				result = append(result, '\\')
			case '/':
				result = append(result, '/')
			case 'b':
				result = append(result, '\b')
			case 'f':
				result = append(result, '\f')
			case 'n':
				result = append(result, '\n')
			case 'r':
				result = append(result, '\r')
			case 't':
				result = append(result, '\t')
			case '\'':
				result = append(result, '\'')
			default:
				// 如果遇到一个非法的转义字符，直接按原样输出
				result = append(result, '\\', r)
			}
			escaped = false
		} else {
			if r == '\\' {
				escaped = true // 记录反斜杠作为转义符
			} else {
				result = append(result, r)
			}
		}
		i += size // 移动到下一个字符
	}

	return string(result), nil
}
func unescapeMapOrSlice(data interface{}) interface{} {
	switch v := data.(type) {
	case map[string]interface{}:
		for k, val := range v {
			v[k] = unescapeMapOrSlice(val)
		}
	case []interface{}:
		for i, val := range v {
			v[i] = unescapeMapOrSlice(val)
		}
	case string:
		if unescaped, err := unescapeString(v); err != nil {
			return v
		} else {
			return unescaped
		}
	}
	return data
}

func getResponseToolCall(item *GeminiPart) *dto.ToolCallResponse {
	var argsBytes []byte
	var err error
	if result, ok := item.FunctionCall.Arguments.(map[string]interface{}); ok {
		argsBytes, err = json.Marshal(unescapeMapOrSlice(result))
	} else {
		argsBytes, err = json.Marshal(item.FunctionCall.Arguments)
	}

	if err != nil {
		return nil
	}
	return &dto.ToolCallResponse{
		ID:   fmt.Sprintf("call_%s", common.GetUUID()),
		Type: "function",
		Function: dto.FunctionResponse{
			Arguments: string(argsBytes),
			Name:      item.FunctionCall.FunctionName,
		},
	}
}

func responseGeminiChat2OpenAI(c *gin.Context, response *GeminiChatResponse) *dto.OpenAITextResponse {
	fullTextResponse := dto.OpenAITextResponse{
		Id:      helper.GetResponseID(c),
		Object:  "chat.completion",
		Created: common.GetTimestamp(),
		Choices: make([]dto.OpenAITextResponseChoice, 0, len(response.Candidates)),
	}
	isToolCall := false
	for _, candidate := range response.Candidates {
		choice := dto.OpenAITextResponseChoice{
			Index: int(candidate.Index),
			Message: dto.Message{
				Role:    "assistant",
				Content: "",
			},
			FinishReason: constant.FinishReasonStop,
		}
		if len(candidate.Content.Parts) > 0 {
			var texts []string
			var toolCalls []dto.ToolCallResponse
			for _, part := range candidate.Content.Parts {
				if part.FunctionCall != nil {
					choice.FinishReason = constant.FinishReasonToolCalls
					if call := getResponseToolCall(&part); call != nil {
						toolCalls = append(toolCalls, *call)
					}
				} else if part.Thought {
					choice.Message.ReasoningContent = part.Text
				} else {
					if part.ExecutableCode != nil {
						texts = append(texts, "```"+part.ExecutableCode.Language+"\n"+part.ExecutableCode.Code+"\n```")
					} else if part.CodeExecutionResult != nil {
						texts = append(texts, "```output\n"+part.CodeExecutionResult.Output+"\n```")
					} else {
						// 过滤掉空行
						if part.Text != "\n" {
							texts = append(texts, part.Text)
						}
					}
				}
			}
			if len(toolCalls) > 0 {
				choice.Message.SetToolCalls(toolCalls)
				isToolCall = true
			}
			choice.Message.SetStringContent(strings.Join(texts, "\n"))

		}
		if candidate.FinishReason != nil {
			switch *candidate.FinishReason {
			case "STOP":
				choice.FinishReason = constant.FinishReasonStop
			case "MAX_TOKENS":
				choice.FinishReason = constant.FinishReasonLength
			default:
				choice.FinishReason = constant.FinishReasonContentFilter
			}
		}
		if isToolCall {
			choice.FinishReason = constant.FinishReasonToolCalls
		}

		fullTextResponse.Choices = append(fullTextResponse.Choices, choice)
	}
	return &fullTextResponse
}

func streamResponseGeminiChat2OpenAI(geminiResponse *GeminiChatResponse) (*dto.ChatCompletionsStreamResponse, bool, bool) {
	choices := make([]dto.ChatCompletionsStreamResponseChoice, 0, len(geminiResponse.Candidates))
	isStop := false
	hasImage := false
	for _, candidate := range geminiResponse.Candidates {
		if candidate.FinishReason != nil && *candidate.FinishReason == "STOP" {
			isStop = true
			candidate.FinishReason = nil
		}
		choice := dto.ChatCompletionsStreamResponseChoice{
			Index: int(candidate.Index),
			Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
				Role: "assistant",
			},
		}
		var texts []string
		isTools := false
		isThought := false
		if candidate.FinishReason != nil {
			// p := GeminiConvertFinishReason(*candidate.FinishReason)
			switch *candidate.FinishReason {
			case "STOP":
				choice.FinishReason = &constant.FinishReasonStop
			case "MAX_TOKENS":
				choice.FinishReason = &constant.FinishReasonLength
			default:
				choice.FinishReason = &constant.FinishReasonContentFilter
			}
		}
		for _, part := range candidate.Content.Parts {
			if part.InlineData != nil {
				if strings.HasPrefix(part.InlineData.MimeType, "image") {
					imgText := "![image](data:" + part.InlineData.MimeType + ";base64," + part.InlineData.Data + ")"
					texts = append(texts, imgText)
					hasImage = true
				}
			} else if part.FunctionCall != nil {
				isTools = true
				if call := getResponseToolCall(&part); call != nil {
					call.SetIndex(len(choice.Delta.ToolCalls))
					choice.Delta.ToolCalls = append(choice.Delta.ToolCalls, *call)
				}
			} else if part.Thought {
				isThought = true
				texts = append(texts, part.Text)
			} else {
				if part.ExecutableCode != nil {
					texts = append(texts, "```"+part.ExecutableCode.Language+"\n"+part.ExecutableCode.Code+"\n```\n")
				} else if part.CodeExecutionResult != nil {
					texts = append(texts, "```output\n"+part.CodeExecutionResult.Output+"\n```\n")
				} else {
					if part.Text != "\n" {
						texts = append(texts, part.Text)
					}
				}
			}
		}
		if isThought {
			choice.Delta.SetReasoningContent(strings.Join(texts, "\n"))
		} else {
			choice.Delta.SetContentString(strings.Join(texts, "\n"))
		}
		if isTools {
			choice.FinishReason = &constant.FinishReasonToolCalls
		}
		choices = append(choices, choice)
	}

	var response dto.ChatCompletionsStreamResponse
	response.Object = "chat.completion.chunk"
	response.Choices = choices
	return &response, isStop, hasImage
}

func GeminiChatStreamHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	// responseText := ""
	id := helper.GetResponseID(c)
	createAt := common.GetTimestamp()
	var usage = &dto.Usage{}
	var imageCount int

	helper.StreamScannerHandler(c, resp, info, func(data string) bool {
		var geminiResponse GeminiChatResponse
		err := common.UnmarshalJsonStr(data, &geminiResponse)
		if err != nil {
			common.LogError(c, "error unmarshalling stream response: "+err.Error())
			return false
		}

		response, isStop, hasImage := streamResponseGeminiChat2OpenAI(&geminiResponse)
		if hasImage {
			imageCount++
		}
		response.Id = id
		response.Created = createAt
		response.Model = info.UpstreamModelName
		if geminiResponse.UsageMetadata.TotalTokenCount != 0 {
			usage.PromptTokens = geminiResponse.UsageMetadata.PromptTokenCount
			usage.CompletionTokens = geminiResponse.UsageMetadata.CandidatesTokenCount
			usage.CompletionTokenDetails.ReasoningTokens = geminiResponse.UsageMetadata.ThoughtsTokenCount
			usage.TotalTokens = geminiResponse.UsageMetadata.TotalTokenCount
			for _, detail := range geminiResponse.UsageMetadata.PromptTokensDetails {
				if detail.Modality == "AUDIO" {
					usage.PromptTokensDetails.AudioTokens = detail.TokenCount
				} else if detail.Modality == "TEXT" {
					usage.PromptTokensDetails.TextTokens = detail.TokenCount
				}
			}
		}
		err = helper.ObjectData(c, response)
		if err != nil {
			common.LogError(c, err.Error())
		}
		if isStop {
			response := helper.GenerateStopResponse(id, createAt, info.UpstreamModelName, constant.FinishReasonStop)
			helper.ObjectData(c, response)
		}
		return true
	})

	var response *dto.ChatCompletionsStreamResponse

	if imageCount != 0 {
		if usage.CompletionTokens == 0 {
			usage.CompletionTokens = imageCount * 258
		}
	}

	usage.PromptTokensDetails.TextTokens = usage.PromptTokens
	usage.CompletionTokens = usage.TotalTokens - usage.PromptTokens

	if info.ShouldIncludeUsage {
		response = helper.GenerateFinalUsageResponse(id, createAt, info.UpstreamModelName, *usage)
		err := helper.ObjectData(c, response)
		if err != nil {
			common.SysError("send final response failed: " + err.Error())
		}
	}
	helper.Done(c)
	//resp.Body.Close()
	return usage, nil
}

func GeminiChatHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
	}
	common.CloseResponseBodyGracefully(resp)
	if common.DebugEnabled {
		println(string(responseBody))
	}
	var geminiResponse GeminiChatResponse
	err = common.Unmarshal(responseBody, &geminiResponse)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
	}
	if len(geminiResponse.Candidates) == 0 {
		return nil, types.NewError(errors.New("no candidates returned"), types.ErrorCodeBadResponseBody)
	}
	fullTextResponse := responseGeminiChat2OpenAI(c, &geminiResponse)
	fullTextResponse.Model = info.UpstreamModelName
	usage := dto.Usage{
		PromptTokens:     geminiResponse.UsageMetadata.PromptTokenCount,
		CompletionTokens: geminiResponse.UsageMetadata.CandidatesTokenCount,
		TotalTokens:      geminiResponse.UsageMetadata.TotalTokenCount,
	}

	usage.CompletionTokenDetails.ReasoningTokens = geminiResponse.UsageMetadata.ThoughtsTokenCount
	usage.CompletionTokens = usage.TotalTokens - usage.PromptTokens

	for _, detail := range geminiResponse.UsageMetadata.PromptTokensDetails {
		if detail.Modality == "AUDIO" {
			usage.PromptTokensDetails.AudioTokens = detail.TokenCount
		} else if detail.Modality == "TEXT" {
			usage.PromptTokensDetails.TextTokens = detail.TokenCount
		}
	}

	fullTextResponse.Usage = usage
	jsonResponse, err := json.Marshal(fullTextResponse)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
	}
	c.Writer.Header().Set("Content-Type", "application/json")
	c.Writer.WriteHeader(resp.StatusCode)
	c.Writer.Write(jsonResponse)
	return &usage, nil
}

func GeminiEmbeddingHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	defer common.CloseResponseBodyGracefully(resp)

	responseBody, readErr := io.ReadAll(resp.Body)
	if readErr != nil {
		return nil, types.NewError(readErr, types.ErrorCodeBadResponseBody)
	}

	var geminiResponse GeminiEmbeddingResponse
	if jsonErr := common.Unmarshal(responseBody, &geminiResponse); jsonErr != nil {
		return nil, types.NewError(jsonErr, types.ErrorCodeBadResponseBody)
	}

	// convert to openai format response
	openAIResponse := dto.OpenAIEmbeddingResponse{
		Object: "list",
		Data: []dto.OpenAIEmbeddingResponseItem{
			{
				Object:    "embedding",
				Embedding: geminiResponse.Embedding.Values,
				Index:     0,
			},
		},
		Model: info.UpstreamModelName,
	}

	// calculate usage
	// https://ai.google.dev/gemini-api/docs/pricing?hl=zh-cn#text-embedding-004
	// Google has not yet clarified how embedding models will be billed
	// refer to openai billing method to use input tokens billing
	// https://platform.openai.com/docs/guides/embeddings#what-are-embeddings
	usage := &dto.Usage{
		PromptTokens:     info.PromptTokens,
		CompletionTokens: 0,
		TotalTokens:      info.PromptTokens,
	}
	openAIResponse.Usage = *usage

	jsonResponse, jsonErr := common.Marshal(openAIResponse)
	if jsonErr != nil {
		return nil, types.NewError(jsonErr, types.ErrorCodeBadResponseBody)
	}

	common.IOCopyBytesGracefully(c, resp, jsonResponse)
	return usage, nil
}
