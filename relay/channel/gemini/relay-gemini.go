package gemini

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/QuantumNous/new-api/setting/reasoning"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

// https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/inference?hl=zh-cn#blob
var geminiSupportedMimeTypes = map[string]bool{
	"application/pdf": true,
	"audio/mpeg":      true,
	"audio/mp3":       true,
	"audio/wav":       true,
	"image/png":       true,
	"image/jpeg":      true,
	"image/jpg":       true, // support old image/jpeg
	"image/webp":      true,
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

const thoughtSignatureBypassValue = "context_engineering_is_the_way_to_go"

// Gemini 允许的思考预算范围
const (
	pro25MinBudget       = 128
	pro25MaxBudget       = 32768
	flash25MaxBudget     = 24576
	flash25LiteMinBudget = 512
	flash25LiteMaxBudget = 24576
)

func isNew25ProModel(modelName string) bool {
	return strings.HasPrefix(modelName, "gemini-2.5-pro") &&
		!strings.HasPrefix(modelName, "gemini-2.5-pro-preview-05-06") &&
		!strings.HasPrefix(modelName, "gemini-2.5-pro-preview-03-25")
}

func is25FlashLiteModel(modelName string) bool {
	return strings.HasPrefix(modelName, "gemini-2.5-flash-lite")
}

// clampThinkingBudget 根据模型名称将预算限制在允许的范围内
func clampThinkingBudget(modelName string, budget int) int {
	isNew25Pro := isNew25ProModel(modelName)
	is25FlashLite := is25FlashLiteModel(modelName)

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

// "effort": "high" - Allocates a large portion of tokens for reasoning (approximately 80% of max_tokens)
// "effort": "medium" - Allocates a moderate portion of tokens (approximately 50% of max_tokens)
// "effort": "low" - Allocates a smaller portion of tokens (approximately 20% of max_tokens)
// "effort": "minimal" - Allocates a minimal portion of tokens (approximately 5% of max_tokens)
func clampThinkingBudgetByEffort(modelName string, effort string) int {
	isNew25Pro := isNew25ProModel(modelName)
	is25FlashLite := is25FlashLiteModel(modelName)

	maxBudget := 0
	if is25FlashLite {
		maxBudget = flash25LiteMaxBudget
	}
	if isNew25Pro {
		maxBudget = pro25MaxBudget
	} else {
		maxBudget = flash25MaxBudget
	}
	switch effort {
	case "high":
		maxBudget = maxBudget * 80 / 100
	case "medium":
		maxBudget = maxBudget * 50 / 100
	case "low":
		maxBudget = maxBudget * 20 / 100
	case "minimal":
		maxBudget = maxBudget * 5 / 100
	}
	return clampThinkingBudget(modelName, maxBudget)
}

func ThinkingAdaptor(geminiRequest *dto.GeminiChatRequest, info *relaycommon.RelayInfo, oaiRequest ...dto.GeneralOpenAIRequest) {
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
					geminiRequest.GenerationConfig.ThinkingConfig = &dto.GeminiThinkingConfig{
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
				geminiRequest.GenerationConfig.ThinkingConfig = &dto.GeminiThinkingConfig{
					IncludeThoughts: true,
				}
			} else {
				geminiRequest.GenerationConfig.ThinkingConfig = &dto.GeminiThinkingConfig{
					IncludeThoughts: true,
				}
				if geminiRequest.GenerationConfig.MaxOutputTokens > 0 {
					budgetTokens := model_setting.GetGeminiSettings().ThinkingAdapterBudgetTokensPercentage * float64(geminiRequest.GenerationConfig.MaxOutputTokens)
					clampedBudget := clampThinkingBudget(modelName, int(budgetTokens))
					geminiRequest.GenerationConfig.ThinkingConfig.ThinkingBudget = common.GetPointer(clampedBudget)
				} else {
					if len(oaiRequest) > 0 {
						// 如果有reasoningEffort参数，则根据其值设置思考预算
						geminiRequest.GenerationConfig.ThinkingConfig.ThinkingBudget = common.GetPointer(clampThinkingBudgetByEffort(modelName, oaiRequest[0].ReasoningEffort))
					}
				}
			}
		} else if strings.HasSuffix(modelName, "-nothinking") {
			if !isNew25Pro {
				geminiRequest.GenerationConfig.ThinkingConfig = &dto.GeminiThinkingConfig{
					ThinkingBudget: common.GetPointer(0),
				}
			}
		} else if _, level, ok := reasoning.TrimEffortSuffix(info.UpstreamModelName); ok && level != "" {
			geminiRequest.GenerationConfig.ThinkingConfig = &dto.GeminiThinkingConfig{
				IncludeThoughts: true,
				ThinkingLevel:   level,
			}
			info.ReasoningEffort = level
		}
	}
}

// Setting safety to the lowest possible values since Gemini is already powerless enough
func CovertOpenAI2Gemini(c *gin.Context, textRequest dto.GeneralOpenAIRequest, info *relaycommon.RelayInfo) (*dto.GeminiChatRequest, error) {

	geminiRequest := dto.GeminiChatRequest{
		Contents: make([]dto.GeminiChatContent, 0, len(textRequest.Messages)),
		GenerationConfig: dto.GeminiChatGenerationConfig{
			Temperature:     textRequest.Temperature,
			TopP:            textRequest.TopP,
			MaxOutputTokens: textRequest.GetMaxTokens(),
			Seed:            int64(textRequest.Seed),
		},
	}

	attachThoughtSignature := (info.ChannelType == constant.ChannelTypeGemini ||
		info.ChannelType == constant.ChannelTypeVertexAi) &&
		model_setting.GetGeminiSettings().FunctionCallThoughtSignatureEnabled

	if model_setting.IsGeminiModelSupportImagine(info.UpstreamModelName) {
		geminiRequest.GenerationConfig.ResponseModalities = []string{
			"TEXT",
			"IMAGE",
		}
	}

	adaptorWithExtraBody := false

	// patch extra_body
	if len(textRequest.ExtraBody) > 0 {
		if !strings.HasSuffix(info.UpstreamModelName, "-nothinking") {
			var extraBody map[string]interface{}
			if err := common.Unmarshal(textRequest.ExtraBody, &extraBody); err != nil {
				return nil, fmt.Errorf("invalid extra body: %w", err)
			}
			// eg. {"google":{"thinking_config":{"thinking_budget":5324,"include_thoughts":true}}}
			if googleBody, ok := extraBody["google"].(map[string]interface{}); ok {
				adaptorWithExtraBody = true
				// check error param name like thinkingConfig, should be thinking_config
				if _, hasErrorParam := googleBody["thinkingConfig"]; hasErrorParam {
					return nil, errors.New("extra_body.google.thinkingConfig is not supported, use extra_body.google.thinking_config instead")
				}

				if thinkingConfig, ok := googleBody["thinking_config"].(map[string]interface{}); ok {
					// check error param name like thinkingBudget, should be thinking_budget
					if _, hasErrorParam := thinkingConfig["thinkingBudget"]; hasErrorParam {
						return nil, errors.New("extra_body.google.thinking_config.thinkingBudget is not supported, use extra_body.google.thinking_config.thinking_budget instead")
					}
					if budget, ok := thinkingConfig["thinking_budget"].(float64); ok {
						budgetInt := int(budget)
						geminiRequest.GenerationConfig.ThinkingConfig = &dto.GeminiThinkingConfig{
							ThinkingBudget:  common.GetPointer(budgetInt),
							IncludeThoughts: true,
						}
					} else {
						geminiRequest.GenerationConfig.ThinkingConfig = &dto.GeminiThinkingConfig{
							IncludeThoughts: true,
						}
					}
				}

				// check error param name like imageConfig, should be image_config
				if _, hasErrorParam := googleBody["imageConfig"]; hasErrorParam {
					return nil, errors.New("extra_body.google.imageConfig is not supported, use extra_body.google.image_config instead")
				}

				if imageConfig, ok := googleBody["image_config"].(map[string]interface{}); ok {
					// check error param name like aspectRatio, should be aspect_ratio
					if _, hasErrorParam := imageConfig["aspectRatio"]; hasErrorParam {
						return nil, errors.New("extra_body.google.image_config.aspectRatio is not supported, use extra_body.google.image_config.aspect_ratio instead")
					}
					// check error param name like imageSize, should be image_size
					if _, hasErrorParam := imageConfig["imageSize"]; hasErrorParam {
						return nil, errors.New("extra_body.google.image_config.imageSize is not supported, use extra_body.google.image_config.image_size instead")
					}

					// convert snake_case to camelCase for Gemini API
					geminiImageConfig := make(map[string]interface{})
					if aspectRatio, ok := imageConfig["aspect_ratio"]; ok {
						geminiImageConfig["aspectRatio"] = aspectRatio
					}
					if imageSize, ok := imageConfig["image_size"]; ok {
						geminiImageConfig["imageSize"] = imageSize
					}

					if len(geminiImageConfig) > 0 {
						imageConfigBytes, err := common.Marshal(geminiImageConfig)
						if err != nil {
							return nil, fmt.Errorf("failed to marshal image_config: %w", err)
						}
						geminiRequest.GenerationConfig.ImageConfig = imageConfigBytes
					}
				}
			}
		}
	}

	if !adaptorWithExtraBody {
		ThinkingAdaptor(&geminiRequest, info, textRequest)
	}

	safetySettings := make([]dto.GeminiChatSafetySettings, 0, len(SafetySettingList))
	for _, category := range SafetySettingList {
		safetySettings = append(safetySettings, dto.GeminiChatSafetySettings{
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
		urlContext := false
		for _, tool := range textRequest.Tools {
			if tool.Function.Name == "googleSearch" {
				googleSearch = true
				continue
			}
			if tool.Function.Name == "codeExecution" {
				codeExecution = true
				continue
			}
			if tool.Function.Name == "urlContext" {
				urlContext = true
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
		geminiTools := geminiRequest.GetTools()
		if codeExecution {
			geminiTools = append(geminiTools, dto.GeminiChatTool{
				CodeExecution: make(map[string]string),
			})
		}
		if googleSearch {
			geminiTools = append(geminiTools, dto.GeminiChatTool{
				GoogleSearch: make(map[string]string),
			})
		}
		if urlContext {
			geminiTools = append(geminiTools, dto.GeminiChatTool{
				URLContext: make(map[string]string),
			})
		}
		if len(functions) > 0 {
			geminiTools = append(geminiTools, dto.GeminiChatTool{
				FunctionDeclarations: functions,
			})
		}
		geminiRequest.SetTools(geminiTools)
	}

	if textRequest.ResponseFormat != nil && (textRequest.ResponseFormat.Type == "json_schema" || textRequest.ResponseFormat.Type == "json_object") {
		geminiRequest.GenerationConfig.ResponseMimeType = "application/json"

		if len(textRequest.ResponseFormat.JsonSchema) > 0 {
			// 先将json.RawMessage解析
			var jsonSchema dto.FormatJsonSchema
			if err := common.Unmarshal(textRequest.ResponseFormat.JsonSchema, &jsonSchema); err == nil {
				cleanedSchema := removeAdditionalPropertiesWithDepth(jsonSchema.Schema, 0)
				geminiRequest.GenerationConfig.ResponseSchema = cleanedSchema
			}
		}
	}
	tool_call_ids := make(map[string]string)
	var system_content []string
	//shouldAddDummyModelMessage := false
	for _, message := range textRequest.Messages {
		if message.Role == "system" || message.Role == "developer" {
			system_content = append(system_content, message.StringContent())
			continue
		} else if message.Role == "tool" || message.Role == "function" {
			if len(geminiRequest.Contents) == 0 || geminiRequest.Contents[len(geminiRequest.Contents)-1].Role == "model" {
				geminiRequest.Contents = append(geminiRequest.Contents, dto.GeminiChatContent{
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

			functionResp := &dto.GeminiFunctionResponse{
				Name:     name,
				Response: contentMap,
			}

			*parts = append(*parts, dto.GeminiPart{
				FunctionResponse: functionResp,
			})
			continue
		}
		var parts []dto.GeminiPart
		content := dto.GeminiChatContent{
			Role: message.Role,
		}
		shouldAttachThoughtSignature := attachThoughtSignature && (message.Role == "assistant" || message.Role == "model")
		signatureAttached := false
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
				toolCall := dto.GeminiPart{
					FunctionCall: &dto.FunctionCall{
						FunctionName: call.Function.Name,
						Arguments:    args,
					},
				}
				if shouldAttachThoughtSignature && !signatureAttached && hasFunctionCallContent(toolCall.FunctionCall) && len(toolCall.ThoughtSignature) == 0 {
					toolCall.ThoughtSignature = json.RawMessage(strconv.Quote(thoughtSignatureBypassValue))
					signatureAttached = true
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
				// check markdown image ![image](data:image/jpeg;base64,xxxxxxxxxxxx)
				// 使用字符串查找而非正则，避免大文本性能问题
				text := part.Text
				hasMarkdownImage := false
				for {
					// 快速检查是否包含 markdown 图片标记
					startIdx := strings.Index(text, "![")
					if startIdx == -1 {
						break
					}
					// 找到 ](
					bracketIdx := strings.Index(text[startIdx:], "](data:")
					if bracketIdx == -1 {
						break
					}
					bracketIdx += startIdx
					// 找到闭合的 )
					closeIdx := strings.Index(text[bracketIdx+2:], ")")
					if closeIdx == -1 {
						break
					}
					closeIdx += bracketIdx + 2

					hasMarkdownImage = true
					// 添加图片前的文本
					if startIdx > 0 {
						textBefore := text[:startIdx]
						if textBefore != "" {
							parts = append(parts, dto.GeminiPart{
								Text: textBefore,
							})
						}
					}
					// 提取 data URL (从 "](" 后面开始，到 ")" 之前)
					dataUrl := text[bracketIdx+2 : closeIdx]
					imageNum += 1
					if constant.GeminiVisionMaxImageNum != -1 && imageNum > constant.GeminiVisionMaxImageNum {
						return nil, fmt.Errorf("too many images in the message, max allowed is %d", constant.GeminiVisionMaxImageNum)
					}
					format, base64String, err := service.DecodeBase64FileData(dataUrl)
					if err != nil {
						return nil, fmt.Errorf("decode markdown base64 image data failed: %s", err.Error())
					}
					imgPart := dto.GeminiPart{
						InlineData: &dto.GeminiInlineData{
							MimeType: format,
							Data:     base64String,
						},
					}
					if shouldAttachThoughtSignature {
						imgPart.ThoughtSignature = json.RawMessage(strconv.Quote(thoughtSignatureBypassValue))
					}
					parts = append(parts, imgPart)
					// 继续处理剩余文本
					text = text[closeIdx+1:]
				}
				// 添加剩余文本或原始文本（如果没有找到 markdown 图片）
				if !hasMarkdownImage {
					parts = append(parts, dto.GeminiPart{
						Text: part.Text,
					})
				}
			} else if part.Type == dto.ContentTypeImageURL {
				imageNum += 1

				if constant.GeminiVisionMaxImageNum != -1 && imageNum > constant.GeminiVisionMaxImageNum {
					return nil, fmt.Errorf("too many images in the message, max allowed is %d", constant.GeminiVisionMaxImageNum)
				}
				// 判断是否是url
				if strings.HasPrefix(part.GetImageMedia().Url, "http") {
					// 是url，获取文件的类型和base64编码的数据
					fileData, err := service.GetFileBase64FromUrl(c, part.GetImageMedia().Url, "formatting image for Gemini")
					if err != nil {
						return nil, fmt.Errorf("get file base64 from url '%s' failed: %w", part.GetImageMedia().Url, err)
					}

					// 校验 MimeType 是否在 Gemini 支持的白名单中
					if _, ok := geminiSupportedMimeTypes[strings.ToLower(fileData.MimeType)]; !ok {
						url := part.GetImageMedia().Url
						return nil, fmt.Errorf("mime type is not supported by Gemini: '%s', url: '%s', supported types are: %v", fileData.MimeType, url, getSupportedMimeTypesList())
					}

					parts = append(parts, dto.GeminiPart{
						InlineData: &dto.GeminiInlineData{
							MimeType: fileData.MimeType, // 使用原始的 MimeType，因为大小写可能对API有意义
							Data:     fileData.Base64Data,
						},
					})
				} else {
					format, base64String, err := service.DecodeBase64FileData(part.GetImageMedia().Url)
					if err != nil {
						return nil, fmt.Errorf("decode base64 image data failed: %s", err.Error())
					}
					parts = append(parts, dto.GeminiPart{
						InlineData: &dto.GeminiInlineData{
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
				parts = append(parts, dto.GeminiPart{
					InlineData: &dto.GeminiInlineData{
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
				parts = append(parts, dto.GeminiPart{
					InlineData: &dto.GeminiInlineData{
						MimeType: "audio/" + part.GetInputAudio().Format,
						Data:     base64String,
					},
				})
			}
		}

		// 如果需要附加签名但还没有附加（没有 tool_calls 或 tool_calls 为空），
		// 则在第一个文本 part 上附加 thoughtSignature
		if shouldAttachThoughtSignature && !signatureAttached && len(parts) > 0 {
			for i := range parts {
				if parts[i].Text != "" {
					parts[i].ThoughtSignature = json.RawMessage(strconv.Quote(thoughtSignatureBypassValue))
					break
				}
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
		geminiRequest.SystemInstructions = &dto.GeminiChatContent{
			Parts: []dto.GeminiPart{
				{
					Text: strings.Join(system_content, "\n"),
				},
			},
		}
	}

	return &geminiRequest, nil
}

func hasFunctionCallContent(call *dto.FunctionCall) bool {
	if call == nil {
		return false
	}
	if strings.TrimSpace(call.FunctionName) != "" {
		return true
	}

	switch v := call.Arguments.(type) {
	case nil:
		return false
	case string:
		return strings.TrimSpace(v) != ""
	case map[string]interface{}:
		return len(v) > 0
	case []interface{}:
		return len(v) > 0
	default:
		return true
	}
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
		delete(cleanedMap, "propertyNames")

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

func getResponseToolCall(item *dto.GeminiPart) *dto.ToolCallResponse {
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

func responseGeminiChat2OpenAI(c *gin.Context, response *dto.GeminiChatResponse) *dto.OpenAITextResponse {
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
				if part.InlineData != nil {
					// 媒体内容
					if strings.HasPrefix(part.InlineData.MimeType, "image") {
						imgText := "![image](data:" + part.InlineData.MimeType + ";base64," + part.InlineData.Data + ")"
						texts = append(texts, imgText)
					} else {
						// 其他媒体类型，直接显示链接
						texts = append(texts, fmt.Sprintf("[media](data:%s;base64,%s)", part.InlineData.MimeType, part.InlineData.Data))
					}
				} else if part.FunctionCall != nil {
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

func streamResponseGeminiChat2OpenAI(geminiResponse *dto.GeminiChatResponse) (*dto.ChatCompletionsStreamResponse, bool) {
	choices := make([]dto.ChatCompletionsStreamResponseChoice, 0, len(geminiResponse.Candidates))
	isStop := false
	for _, candidate := range geminiResponse.Candidates {
		if candidate.FinishReason != nil && *candidate.FinishReason == "STOP" {
			isStop = true
			candidate.FinishReason = nil
		}
		choice := dto.ChatCompletionsStreamResponseChoice{
			Index: int(candidate.Index),
			Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
				//Role: "assistant",
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
	return &response, isStop
}

func handleStream(c *gin.Context, info *relaycommon.RelayInfo, resp *dto.ChatCompletionsStreamResponse) error {
	streamData, err := common.Marshal(resp)
	if err != nil {
		return fmt.Errorf("failed to marshal stream response: %w", err)
	}
	err = openai.HandleStreamFormat(c, info, string(streamData), info.ChannelSetting.ForceFormat, info.ChannelSetting.ThinkingToContent)
	if err != nil {
		return fmt.Errorf("failed to handle stream format: %w", err)
	}
	return nil
}

func handleFinalStream(c *gin.Context, info *relaycommon.RelayInfo, resp *dto.ChatCompletionsStreamResponse) error {
	streamData, err := common.Marshal(resp)
	if err != nil {
		return fmt.Errorf("failed to marshal stream response: %w", err)
	}
	openai.HandleFinalResponse(c, info, string(streamData), resp.Id, resp.Created, resp.Model, resp.GetSystemFingerprint(), resp.Usage, false)
	return nil
}

func geminiStreamHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response, callback func(data string, geminiResponse *dto.GeminiChatResponse) bool) (*dto.Usage, *types.NewAPIError) {
	var usage = &dto.Usage{}
	var imageCount int
	responseText := strings.Builder{}

	helper.StreamScannerHandler(c, resp, info, func(data string) bool {
		var geminiResponse dto.GeminiChatResponse
		err := common.UnmarshalJsonStr(data, &geminiResponse)
		if err != nil {
			logger.LogError(c, "error unmarshalling stream response: "+err.Error())
			return false
		}

		// 统计图片数量
		for _, candidate := range geminiResponse.Candidates {
			for _, part := range candidate.Content.Parts {
				if part.InlineData != nil && part.InlineData.MimeType != "" {
					imageCount++
				}
				if part.Text != "" {
					responseText.WriteString(part.Text)
				}
			}
		}

		// 更新使用量统计
		if geminiResponse.UsageMetadata.TotalTokenCount != 0 {
			usage.PromptTokens = geminiResponse.UsageMetadata.PromptTokenCount
			usage.CompletionTokens = geminiResponse.UsageMetadata.CandidatesTokenCount + geminiResponse.UsageMetadata.ThoughtsTokenCount
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

		return callback(data, &geminiResponse)
	})

	if imageCount != 0 {
		if usage.CompletionTokens == 0 {
			usage.CompletionTokens = imageCount * 1400
		}
	}

	usage.PromptTokensDetails.TextTokens = usage.PromptTokens
	if usage.TotalTokens > 0 {
		usage.CompletionTokens = usage.TotalTokens - usage.PromptTokens
	}

	if usage.CompletionTokens <= 0 {
		str := responseText.String()
		if len(str) > 0 {
			usage = service.ResponseText2Usage(c, responseText.String(), info.UpstreamModelName, info.GetEstimatePromptTokens())
		} else {
			usage = &dto.Usage{}
		}
	}

	return usage, nil
}

func GeminiChatStreamHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	id := helper.GetResponseID(c)
	createAt := common.GetTimestamp()
	finishReason := constant.FinishReasonStop

	usage, err := geminiStreamHandler(c, info, resp, func(data string, geminiResponse *dto.GeminiChatResponse) bool {
		response, isStop := streamResponseGeminiChat2OpenAI(geminiResponse)

		response.Id = id
		response.Created = createAt
		response.Model = info.UpstreamModelName

		logger.LogDebug(c, fmt.Sprintf("info.SendResponseCount = %d", info.SendResponseCount))
		if info.SendResponseCount == 0 {
			// send first response
			emptyResponse := helper.GenerateStartEmptyResponse(id, createAt, info.UpstreamModelName, nil)
			if response.IsToolCall() {
				if len(emptyResponse.Choices) > 0 && len(response.Choices) > 0 {
					toolCalls := response.Choices[0].Delta.ToolCalls
					copiedToolCalls := make([]dto.ToolCallResponse, len(toolCalls))
					for idx := range toolCalls {
						copiedToolCalls[idx] = toolCalls[idx]
						copiedToolCalls[idx].Function.Arguments = ""
					}
					emptyResponse.Choices[0].Delta.ToolCalls = copiedToolCalls
				}
				finishReason = constant.FinishReasonToolCalls
				err := handleStream(c, info, emptyResponse)
				if err != nil {
					logger.LogError(c, err.Error())
				}

				response.ClearToolCalls()
				if response.IsFinished() {
					response.Choices[0].FinishReason = nil
				}
			} else {
				err := handleStream(c, info, emptyResponse)
				if err != nil {
					logger.LogError(c, err.Error())
				}
			}
		}

		err := handleStream(c, info, response)
		if err != nil {
			logger.LogError(c, err.Error())
		}
		if isStop {
			_ = handleStream(c, info, helper.GenerateStopResponse(id, createAt, info.UpstreamModelName, finishReason))
		}
		return true
	})

	if err != nil {
		return usage, err
	}

	response := helper.GenerateFinalUsageResponse(id, createAt, info.UpstreamModelName, *usage)
	handleErr := handleFinalStream(c, info, response)
	if handleErr != nil {
		common.SysLog("send final response failed: " + handleErr.Error())
	}
	return usage, nil
}

func GeminiChatHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	service.CloseResponseBodyGracefully(resp)
	if common.DebugEnabled {
		println(string(responseBody))
	}
	var geminiResponse dto.GeminiChatResponse
	err = common.Unmarshal(responseBody, &geminiResponse)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	if len(geminiResponse.Candidates) == 0 {
		//return nil, types.NewOpenAIError(errors.New("no candidates returned"), types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
		//if geminiResponse.PromptFeedback != nil && geminiResponse.PromptFeedback.BlockReason != nil {
		//	return nil, types.NewOpenAIError(errors.New("request blocked by Gemini API: "+*geminiResponse.PromptFeedback.BlockReason), types.ErrorCodePromptBlocked, http.StatusBadRequest)
		//} else {
		//	return nil, types.NewOpenAIError(errors.New("empty response from Gemini API"), types.ErrorCodeEmptyResponse, http.StatusInternalServerError)
		//}
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

	switch info.RelayFormat {
	case types.RelayFormatOpenAI:
		responseBody, err = common.Marshal(fullTextResponse)
		if err != nil {
			return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
		}
	case types.RelayFormatClaude:
		claudeResp := service.ResponseOpenAI2Claude(fullTextResponse, info)
		claudeRespStr, err := common.Marshal(claudeResp)
		if err != nil {
			return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
		}
		responseBody = claudeRespStr
	case types.RelayFormatGemini:
		break
	}

	service.IOCopyBytesGracefully(c, resp, responseBody)

	return &usage, nil
}

func GeminiEmbeddingHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	defer service.CloseResponseBodyGracefully(resp)

	responseBody, readErr := io.ReadAll(resp.Body)
	if readErr != nil {
		return nil, types.NewOpenAIError(readErr, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}

	var geminiResponse dto.GeminiBatchEmbeddingResponse
	if jsonErr := common.Unmarshal(responseBody, &geminiResponse); jsonErr != nil {
		return nil, types.NewOpenAIError(jsonErr, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}

	// convert to openai format response
	openAIResponse := dto.OpenAIEmbeddingResponse{
		Object: "list",
		Data:   make([]dto.OpenAIEmbeddingResponseItem, 0, len(geminiResponse.Embeddings)),
		Model:  info.UpstreamModelName,
	}

	for i, embedding := range geminiResponse.Embeddings {
		openAIResponse.Data = append(openAIResponse.Data, dto.OpenAIEmbeddingResponseItem{
			Object:    "embedding",
			Embedding: embedding.Values,
			Index:     i,
		})
	}

	// calculate usage
	// https://ai.google.dev/gemini-api/docs/pricing?hl=zh-cn#text-embedding-004
	// Google has not yet clarified how embedding models will be billed
	// refer to openai billing method to use input tokens billing
	// https://platform.openai.com/docs/guides/embeddings#what-are-embeddings
	usage := service.ResponseText2Usage(c, "", info.UpstreamModelName, info.GetEstimatePromptTokens())
	openAIResponse.Usage = *usage

	jsonResponse, jsonErr := common.Marshal(openAIResponse)
	if jsonErr != nil {
		return nil, types.NewOpenAIError(jsonErr, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}

	service.IOCopyBytesGracefully(c, resp, jsonResponse)
	return usage, nil
}

func GeminiImageHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	responseBody, readErr := io.ReadAll(resp.Body)
	if readErr != nil {
		return nil, types.NewOpenAIError(readErr, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	_ = resp.Body.Close()

	var geminiResponse dto.GeminiImageResponse
	if jsonErr := common.Unmarshal(responseBody, &geminiResponse); jsonErr != nil {
		return nil, types.NewOpenAIError(jsonErr, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}

	if len(geminiResponse.Predictions) == 0 {
		return nil, types.NewOpenAIError(errors.New("no images generated"), types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}

	// convert to openai format response
	openAIResponse := dto.ImageResponse{
		Created: common.GetTimestamp(),
		Data:    make([]dto.ImageData, 0, len(geminiResponse.Predictions)),
	}

	for _, prediction := range geminiResponse.Predictions {
		if prediction.RaiFilteredReason != "" {
			continue // skip filtered image
		}
		openAIResponse.Data = append(openAIResponse.Data, dto.ImageData{
			B64Json: prediction.BytesBase64Encoded,
		})
	}

	jsonResponse, jsonErr := json.Marshal(openAIResponse)
	if jsonErr != nil {
		return nil, types.NewError(jsonErr, types.ErrorCodeBadResponseBody)
	}

	c.Writer.Header().Set("Content-Type", "application/json")
	c.Writer.WriteHeader(resp.StatusCode)
	_, _ = c.Writer.Write(jsonResponse)

	// https://github.com/google-gemini/cookbook/blob/719a27d752aac33f39de18a8d3cb42a70874917e/quickstarts/Counting_Tokens.ipynb
	// each image has fixed 258 tokens
	const imageTokens = 258
	generatedImages := len(openAIResponse.Data)

	usage := &dto.Usage{
		PromptTokens:     imageTokens * generatedImages, // each generated image has fixed 258 tokens
		CompletionTokens: 0,                             // image generation does not calculate completion tokens
		TotalTokens:      imageTokens * generatedImages,
	}

	return usage, nil
}

type GeminiModelsResponse struct {
	Models        []dto.GeminiModel `json:"models"`
	NextPageToken string            `json:"nextPageToken"`
}

func FetchGeminiModels(baseURL, apiKey, proxyURL string) ([]string, error) {
	client, err := service.GetHttpClientWithProxy(proxyURL)
	if err != nil {
		return nil, fmt.Errorf("创建HTTP客户端失败: %v", err)
	}

	allModels := make([]string, 0)
	nextPageToken := ""
	maxPages := 100 // Safety limit to prevent infinite loops

	for page := 0; page < maxPages; page++ {
		url := fmt.Sprintf("%s/v1beta/models", baseURL)
		if nextPageToken != "" {
			url = fmt.Sprintf("%s?pageToken=%s", url, nextPageToken)
		}

		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		request, err := http.NewRequestWithContext(ctx, "GET", url, nil)
		if err != nil {
			cancel()
			return nil, fmt.Errorf("创建请求失败: %v", err)
		}

		request.Header.Set("x-goog-api-key", apiKey)

		response, err := client.Do(request)
		if err != nil {
			cancel()
			return nil, fmt.Errorf("请求失败: %v", err)
		}

		if response.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(response.Body)
			response.Body.Close()
			cancel()
			return nil, fmt.Errorf("服务器返回错误 %d: %s", response.StatusCode, string(body))
		}

		body, err := io.ReadAll(response.Body)
		response.Body.Close()
		cancel()
		if err != nil {
			return nil, fmt.Errorf("读取响应失败: %v", err)
		}

		var modelsResponse GeminiModelsResponse
		if err = common.Unmarshal(body, &modelsResponse); err != nil {
			return nil, fmt.Errorf("解析响应失败: %v", err)
		}

		for _, model := range modelsResponse.Models {
			modelNameValue, ok := model.Name.(string)
			if !ok {
				continue
			}
			modelName := strings.TrimPrefix(modelNameValue, "models/")
			allModels = append(allModels, modelName)
		}

		nextPageToken = modelsResponse.NextPageToken
		if nextPageToken == "" {
			break
		}
	}

	return allModels, nil
}
