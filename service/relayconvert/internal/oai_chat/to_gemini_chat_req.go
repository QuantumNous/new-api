package oaichat

import (
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relaymedia "github.com/QuantumNous/new-api/service/relayconvert/internal/media"
	relaymeta "github.com/QuantumNous/new-api/service/relayconvert/internal/meta"
	sharedgemini "github.com/QuantumNous/new-api/service/relayconvert/internal/shared/gemini"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/gin-gonic/gin"
)

func OpenAIChatRequestToGeminiGenerateContent(c *gin.Context, textRequest dto.GeneralOpenAIRequest, info *relaycommon.RelayInfo) (*dto.GeminiChatRequest, error) {
	geminiRequest := dto.GeminiChatRequest{
		Contents: make([]dto.GeminiChatContent, 0, len(textRequest.Messages)),
		GenerationConfig: dto.GeminiChatGenerationConfig{
			Temperature: textRequest.Temperature,
		},
	}

	if textRequest.TopP != nil && *textRequest.TopP > 0 {
		geminiRequest.GenerationConfig.TopP = common.GetPointer(*textRequest.TopP)
	}
	if maxTokens := textRequest.GetMaxTokens(); maxTokens > 0 {
		geminiRequest.GenerationConfig.MaxOutputTokens = common.GetPointer(maxTokens)
	}
	if textRequest.Seed != nil && *textRequest.Seed != 0 {
		geminiRequest.GenerationConfig.Seed = common.GetPointer(int64(*textRequest.Seed))
	}

	upstreamModelName := textRequest.Model
	if modelName := relaymeta.RelayInfoUpstreamModelName(info); modelName != "" {
		upstreamModelName = modelName
	}

	if model_setting.IsGeminiModelSupportImagine(upstreamModelName) {
		geminiRequest.GenerationConfig.ResponseModalities = []string{
			"TEXT",
			"IMAGE",
		}
	}
	if stopSequences := sharedgemini.ParseStopSequences(textRequest.Stop); len(stopSequences) > 0 {
		if len(stopSequences) > 5 {
			stopSequences = stopSequences[:5]
		}
		geminiRequest.GenerationConfig.StopSequences = stopSequences
	}

	adaptorWithExtraBody := false
	if len(textRequest.ExtraBody) > 0 {
		var extraBody map[string]interface{}
		if err := common.Unmarshal(textRequest.ExtraBody, &extraBody); err != nil {
			return nil, fmt.Errorf("invalid extra body: %w", err)
		}

		if googleBody, ok := extraBody["google"].(map[string]interface{}); ok {
			if !strings.HasSuffix(upstreamModelName, "-nothinking") {
				adaptorWithExtraBody = true
				if _, hasErrorParam := googleBody["thinkingConfig"]; hasErrorParam {
					return nil, errors.New("extra_body.google.thinkingConfig is not supported, use extra_body.google.thinking_config instead")
				}

				if thinkingConfig, ok := googleBody["thinking_config"].(map[string]interface{}); ok {
					if _, hasErrorParam := thinkingConfig["thinkingBudget"]; hasErrorParam {
						return nil, errors.New("extra_body.google.thinking_config.thinkingBudget is not supported, use extra_body.google.thinking_config.thinking_budget instead")
					}
					var hasThinkingConfig bool
					var tempThinkingConfig dto.GeminiThinkingConfig

					if thinkingBudget, exists := thinkingConfig["thinking_budget"]; exists {
						switch v := thinkingBudget.(type) {
						case float64:
							budgetInt := int(v)
							tempThinkingConfig.ThinkingBudget = common.GetPointer(budgetInt)
							tempThinkingConfig.IncludeThoughts = budgetInt > 0
							hasThinkingConfig = true
						default:
							return nil, errors.New("extra_body.google.thinking_config.thinking_budget must be an integer")
						}
					}

					if includeThoughts, exists := thinkingConfig["include_thoughts"]; exists {
						if v, ok := includeThoughts.(bool); ok {
							tempThinkingConfig.IncludeThoughts = v
							hasThinkingConfig = true
						} else {
							return nil, errors.New("extra_body.google.thinking_config.include_thoughts must be a boolean")
						}
					}
					if thinkingLevel, exists := thinkingConfig["thinking_level"]; exists {
						if v, ok := thinkingLevel.(string); ok {
							tempThinkingConfig.ThinkingLevel = v
							hasThinkingConfig = true
						} else {
							return nil, errors.New("extra_body.google.thinking_config.thinking_level must be a string")
						}
					}

					if hasThinkingConfig {
						if geminiRequest.GenerationConfig.ThinkingConfig == nil {
							geminiRequest.GenerationConfig.ThinkingConfig = &tempThinkingConfig
						} else {
							if tempThinkingConfig.ThinkingBudget != nil {
								geminiRequest.GenerationConfig.ThinkingConfig.ThinkingBudget = tempThinkingConfig.ThinkingBudget
							}
							geminiRequest.GenerationConfig.ThinkingConfig.IncludeThoughts = tempThinkingConfig.IncludeThoughts
							if tempThinkingConfig.ThinkingLevel != "" {
								geminiRequest.GenerationConfig.ThinkingConfig.ThinkingLevel = tempThinkingConfig.ThinkingLevel
							}
						}
					}
				}
			}

			if _, hasErrorParam := googleBody["imageConfig"]; hasErrorParam {
				return nil, errors.New("extra_body.google.imageConfig is not supported, use extra_body.google.image_config instead")
			}

			if imageConfig, ok := googleBody["image_config"].(map[string]interface{}); ok {
				if _, hasErrorParam := imageConfig["aspectRatio"]; hasErrorParam {
					return nil, errors.New("extra_body.google.image_config.aspectRatio is not supported, use extra_body.google.image_config.aspect_ratio instead")
				}
				if _, hasErrorParam := imageConfig["imageSize"]; hasErrorParam {
					return nil, errors.New("extra_body.google.image_config.imageSize is not supported, use extra_body.google.image_config.image_size instead")
				}

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

	if !adaptorWithExtraBody {
		sharedgemini.ApplyThinkingConfig(&geminiRequest, info, textRequest)
	}

	safetySettings := make([]dto.GeminiChatSafetySettings, 0, len(sharedgemini.SafetySettingCategories))
	for _, category := range sharedgemini.SafetySettingCategories {
		safetySettings = append(safetySettings, dto.GeminiChatSafetySettings{
			Category:  category,
			Threshold: model_setting.GetGeminiSafetySetting(category),
		})
	}
	geminiRequest.SafetySettings = safetySettings

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
				if params, ok := tool.Function.Parameters.(map[string]interface{}); ok {
					if props, hasProps := params["properties"].(map[string]interface{}); hasProps && len(props) == 0 {
						tool.Function.Parameters = nil
					}
				}
			}
			tool.Function.Parameters = sharedgemini.CleanFunctionParameters(tool.Function.Parameters)
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

		if textRequest.ToolChoice != nil {
			geminiRequest.ToolConfig = sharedgemini.OpenAIToolChoiceToConfig(textRequest.ToolChoice)
		}
	}

	if textRequest.ResponseFormat != nil && (textRequest.ResponseFormat.Type == "json_schema" || textRequest.ResponseFormat.Type == "json_object") {
		geminiRequest.GenerationConfig.ResponseMimeType = "application/json"

		if len(textRequest.ResponseFormat.JsonSchema) > 0 {
			var jsonSchema dto.FormatJsonSchema
			if err := common.Unmarshal(textRequest.ResponseFormat.JsonSchema, &jsonSchema); err == nil {
				cleanedSchema := sharedgemini.RemoveAdditionalProperties(jsonSchema.Schema, 0)
				geminiRequest.GenerationConfig.ResponseSchema = cleanedSchema
			}
		}
	}

	toolCallIDs := make(map[string]string)
	var systemContent []string
	for _, message := range textRequest.Messages {
		if message.Role == "system" || message.Role == "developer" {
			systemContent = append(systemContent, message.StringContent())
			continue
		}
		if message.Role == "tool" || message.Role == "function" {
			if len(geminiRequest.Contents) == 0 || geminiRequest.Contents[len(geminiRequest.Contents)-1].Role == "model" {
				geminiRequest.Contents = append(geminiRequest.Contents, dto.GeminiChatContent{
					Role: "user",
				})
			}
			parts := &geminiRequest.Contents[len(geminiRequest.Contents)-1].Parts
			name := ""
			if message.Name != nil {
				name = *message.Name
			} else if val, exists := toolCallIDs[message.ToolCallId]; exists {
				name = val
			}
			var contentMap map[string]interface{}
			contentStr := message.StringContent()

			if err := common.Unmarshal([]byte(contentStr), &contentMap); err != nil {
				var contentSlice []interface{}
				if err := common.Unmarshal([]byte(contentStr), &contentSlice); err == nil {
					contentMap = map[string]interface{}{"result": contentSlice}
				} else {
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
		shouldAttachThoughtSignature := (message.Role == "assistant" || message.Role == "model") && sharedgemini.ShouldAttachThoughtSignature()
		signatureAttached := false
		if message.ToolCalls != nil {
			for _, call := range message.ParseToolCalls() {
				args := map[string]interface{}{}
				if call.Function.Arguments != "" {
					if common.Unmarshal([]byte(call.Function.Arguments), &args) != nil {
						return nil, fmt.Errorf("invalid arguments for function %s, args: %s", call.Function.Name, call.Function.Arguments)
					}
				}
				toolCall := dto.GeminiPart{
					FunctionCall: &dto.FunctionCall{
						FunctionName: call.Function.Name,
						Arguments:    args,
					},
				}
				if shouldAttachThoughtSignature && !signatureAttached && sharedgemini.AttachFunctionCallThoughtSignature(&toolCall) {
					signatureAttached = true
				}
				parts = append(parts, toolCall)
				toolCallIDs[call.ID] = call.Function.Name
			}
		}

		openaiContent := message.ParseContent()
		for _, part := range openaiContent {
			if part.Type == dto.ContentTypeText {
				if part.Text == "" {
					continue
				}
				text := part.Text
				hasMarkdownImage := false
				for {
					startIdx := strings.Index(text, "![")
					if startIdx == -1 {
						break
					}
					bracketIdx := strings.Index(text[startIdx:], "](data:")
					if bracketIdx == -1 {
						break
					}
					bracketIdx += startIdx
					closeIdx := strings.Index(text[bracketIdx+2:], ")")
					if closeIdx == -1 {
						break
					}
					closeIdx += bracketIdx + 2

					hasMarkdownImage = true
					if startIdx > 0 {
						textBefore := text[:startIdx]
						if textBefore != "" {
							parts = append(parts, dto.GeminiPart{
								Text: textBefore,
							})
						}
					}

					dataURL := text[bracketIdx+2 : closeIdx]
					format, base64String, err := relaymedia.DecodeBase64FileData(dataURL)
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
						sharedgemini.AttachThoughtSignatureBypass(&imgPart)
					}
					parts = append(parts, imgPart)
					text = text[closeIdx+1:]
				}
				if !hasMarkdownImage {
					parts = append(parts, dto.GeminiPart{
						Text: part.Text,
					})
				}
			} else {
				source := part.ToFileSource()
				if source == nil {
					continue
				}
				base64Data, mimeType, err := relaymedia.ResolveBase64Data(c, source, "formatting image for Gemini")
				if err != nil {
					return nil, fmt.Errorf("get file data from '%s' failed: %w", source.GetIdentifier(), err)
				}

				if _, ok := sharedgemini.SupportedMimeTypes[strings.ToLower(mimeType)]; !ok {
					return nil, fmt.Errorf("mime type is not supported by Gemini: '%s', url: '%s', supported types are: %v", mimeType, source.GetIdentifier(), sharedgemini.SupportedMimeTypesList())
				}

				parts = append(parts, dto.GeminiPart{
					InlineData: &dto.GeminiInlineData{
						MimeType: mimeType,
						Data:     base64Data,
					},
				})
			}
		}

		if shouldAttachThoughtSignature && !signatureAttached && len(parts) > 0 {
			sharedgemini.AttachFirstTextThoughtSignature(parts)
		}

		content.Parts = parts
		if content.Role == "assistant" {
			content.Role = "model"
		}
		if len(content.Parts) > 0 {
			geminiRequest.Contents = append(geminiRequest.Contents, content)
		}
	}

	if len(systemContent) > 0 {
		geminiRequest.SystemInstructions = &dto.GeminiChatContent{
			Parts: []dto.GeminiPart{
				{
					Text: strings.Join(systemContent, "\n"),
				},
			},
		}
	}

	return &geminiRequest, nil
}
