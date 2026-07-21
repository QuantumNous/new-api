package oairesponses

import (
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

func convertOpenAIResponsesRequestToGeminiChat(c *gin.Context, info *relaycommon.RelayInfo, request any) (any, error) {
	responsesRequest, err := OpenAIResponsesRequestFromAny(request)
	if err != nil {
		return nil, err
	}

	prepared, err := PrepareOpenAIResponsesRequest(*responsesRequest)
	if err != nil {
		return nil, err
	}
	return OpenAIResponsesRequestToGeminiChat(c, &prepared, info)
}

func OpenAIResponsesRequestToGeminiChat(c *gin.Context, req *dto.OpenAIResponsesRequest, info *relaycommon.RelayInfo) (*dto.GeminiChatRequest, error) {
	if req == nil {
		return nil, fmt.Errorf("request is nil")
	}
	if req.Model == "" {
		return nil, fmt.Errorf("model is required")
	}
	if err := ValidateRequestChatUnsupportedFields(req); err != nil {
		return nil, err
	}

	geminiRequest := &dto.GeminiChatRequest{
		GenerationConfig: dto.GeminiChatGenerationConfig{
			Temperature: req.Temperature,
		},
	}
	if req.TopP != nil && *req.TopP > 0 {
		geminiRequest.GenerationConfig.TopP = common.GetPointer(*req.TopP)
	}
	if req.MaxOutputTokens != nil && *req.MaxOutputTokens > 0 {
		geminiRequest.GenerationConfig.MaxOutputTokens = common.GetPointer(*req.MaxOutputTokens)
	}

	upstreamModelName := req.Model
	if modelName := relaymeta.RelayInfoUpstreamModelName(info); modelName != "" {
		upstreamModelName = modelName
	}
	if model_setting.IsGeminiModelSupportImagine(upstreamModelName) {
		geminiRequest.GenerationConfig.ResponseModalities = []string{"TEXT", "IMAGE"}
	}
	if err := applyResponsesTextToGemini(req.Text, geminiRequest); err != nil {
		return nil, err
	}
	sharedgemini.ApplyThinkingConfig(geminiRequest, info, dto.GeneralOpenAIRequest{
		Model:               req.Model,
		MaxCompletionTokens: req.MaxOutputTokens,
		ReasoningEffort:     ReasoningEffort(req),
	})

	safetySettings := make([]dto.GeminiChatSafetySettings, 0, len(sharedgemini.SafetySettingCategories))
	for _, category := range sharedgemini.SafetySettingCategories {
		safetySettings = append(safetySettings, dto.GeminiChatSafetySettings{
			Category:  category,
			Threshold: model_setting.GetGeminiSafetySetting(category),
		})
	}
	geminiRequest.SafetySettings = safetySettings

	functions, err := RequestFunctionDeclarations(req.Tools)
	if err != nil {
		return nil, err
	}
	for i := range functions {
		if params, ok := functions[i].Parameters.(map[string]interface{}); ok {
			if props, hasProps := params["properties"].(map[string]interface{}); hasProps && len(props) == 0 {
				functions[i].Parameters = nil
				continue
			}
		}
		functions[i].Parameters = sharedgemini.CleanFunctionParameters(functions[i].Parameters)
	}
	if len(functions) > 0 {
		geminiRequest.SetTools([]dto.GeminiChatTool{
			{FunctionDeclarations: functions},
		})
	}

	toolChoice, err := RequestToolChoiceToChat(req.ToolChoice)
	if err != nil {
		return nil, err
	}
	if toolChoice != nil {
		geminiRequest.ToolConfig = sharedgemini.OpenAIToolChoiceToConfig(toolChoice)
	}

	systemTexts := make([]string, 0)
	if RawJSONPresent(req.Instructions) {
		instructions, err := JSONString(req.Instructions)
		if err != nil {
			return nil, fmt.Errorf("invalid instructions: %w", err)
		}
		if strings.TrimSpace(instructions) != "" {
			systemTexts = append(systemTexts, instructions)
		}
	}

	inputItems, err := InputItems(req.Input)
	if err != nil {
		return nil, err
	}
	callNames := make(map[string]string)
	for _, item := range inputItems {
		itemType := strings.TrimSpace(common.Interface2String(item["type"]))
		switch itemType {
		case ResponsesInputTypeFunctionCall:
			part, callID, err := responsesFunctionCallItemToGeminiPart(item)
			if err != nil {
				return nil, err
			}
			sharedgemini.AttachFunctionCallThoughtSignature(&part)
			if callID != "" {
				callNames[callID] = part.FunctionCall.FunctionName
			}
			appendGeminiContentPart(geminiRequest, "model", part)
		case ResponsesInputTypeFunctionCallOutput:
			part := responsesFunctionOutputItemToGeminiPart(item, callNames)
			appendGeminiContentPart(geminiRequest, "user", part)
		default:
			role := responsesGeminiRole(item)
			parts, err := responsesInputContentToGeminiParts(c, item["content"])
			if err != nil {
				return nil, err
			}
			if role == "system" {
				for _, part := range parts {
					if part.Text != "" {
						systemTexts = append(systemTexts, part.Text)
					}
				}
				continue
			}
			if len(parts) > 0 {
				geminiRequest.Contents = append(geminiRequest.Contents, dto.GeminiChatContent{
					Role:  role,
					Parts: parts,
				})
			}
		}
	}

	if len(systemTexts) > 0 {
		geminiRequest.SystemInstructions = &dto.GeminiChatContent{
			Parts: []dto.GeminiPart{{Text: strings.Join(systemTexts, "\n")}},
		}
	}

	return geminiRequest, nil
}

func applyResponsesTextToGemini(raw []byte, geminiRequest *dto.GeminiChatRequest) error {
	responseFormat, err := RequestTextToChatResponseFormat(raw)
	if err != nil {
		return err
	}
	if responseFormat == nil || (responseFormat.Type != "json_schema" && responseFormat.Type != "json_object") {
		return nil
	}

	geminiRequest.GenerationConfig.ResponseMimeType = "application/json"
	if len(responseFormat.JsonSchema) == 0 {
		return nil
	}

	var jsonSchema dto.FormatJsonSchema
	if err := common.Unmarshal(responseFormat.JsonSchema, &jsonSchema); err != nil {
		return nil
	}
	geminiRequest.GenerationConfig.ResponseSchema = sharedgemini.RemoveAdditionalProperties(jsonSchema.Schema, 0)
	return nil
}

func responsesInputContentToGeminiParts(c *gin.Context, content any) ([]dto.GeminiPart, error) {
	contentParts, err := ContentParts(content)
	if err != nil {
		return nil, err
	}

	parts := make([]dto.GeminiPart, 0, len(contentParts))
	for _, contentPart := range contentParts {
		nextParts, err := responsesContentPartToGeminiParts(c, contentPart)
		if err != nil {
			return nil, err
		}
		parts = append(parts, nextParts...)
	}
	return parts, nil
}

func responsesContentPartToGeminiParts(c *gin.Context, part map[string]any) ([]dto.GeminiPart, error) {
	partType := strings.TrimSpace(common.Interface2String(part["type"]))
	switch partType {
	case "input_text", "output_text", "text":
		text := common.Interface2String(part["text"])
		if text == "" {
			return nil, nil
		}
		return []dto.GeminiPart{{Text: text}}, nil
	case "input_image", "input_file", "input_audio", "input_video":
		source := ContentPartToFileSource(part)
		if source == nil {
			return nil, nil
		}
		base64Data, mimeType, err := relaymedia.ResolveBase64Data(c, source, "formatting Responses input for Gemini")
		if err != nil {
			return nil, fmt.Errorf("get file data from '%s' failed: %w", source.GetIdentifier(), err)
		}
		if _, ok := sharedgemini.SupportedMimeTypes[strings.ToLower(mimeType)]; !ok {
			return nil, fmt.Errorf("mime type is not supported by Gemini: '%s', url: '%s', supported types are: %v", mimeType, source.GetIdentifier(), sharedgemini.SupportedMimeTypesList())
		}
		return []dto.GeminiPart{
			{
				InlineData: &dto.GeminiInlineData{
					MimeType: mimeType,
					Data:     base64Data,
				},
			},
		}, nil
	default:
		return nil, nil
	}
}

func responsesFunctionCallItemToGeminiPart(item map[string]any) (dto.GeminiPart, string, error) {
	name := strings.TrimSpace(common.Interface2String(item["name"]))
	if name == "" {
		return dto.GeminiPart{}, "", fmt.Errorf("function_call item is missing name")
	}
	callID := CallID(item)
	return dto.GeminiPart{
		FunctionCall: &dto.FunctionCall{
			FunctionName: name,
			Arguments:    ObjectValue(item["arguments"], "arguments"),
		},
	}, callID, nil
}

func responsesFunctionOutputItemToGeminiPart(item map[string]any, callNames map[string]string) dto.GeminiPart {
	callID := CallID(item)
	name := strings.TrimSpace(common.Interface2String(item["name"]))
	if name == "" {
		name = callNames[callID]
	}
	return dto.GeminiPart{
		FunctionResponse: &dto.GeminiFunctionResponse{
			Name:     name,
			Response: GeminiResponseMap(item["output"]),
		},
	}
}

func appendGeminiContentPart(req *dto.GeminiChatRequest, role string, part dto.GeminiPart) {
	if len(req.Contents) > 0 && req.Contents[len(req.Contents)-1].Role == role {
		if role == "model" && part.FunctionCall != nil {
			parts := req.Contents[len(req.Contents)-1].Parts
			insertAt := 0
			for insertAt < len(parts) && parts[insertAt].FunctionCall != nil {
				insertAt++
			}
			parts = append(parts, dto.GeminiPart{})
			copy(parts[insertAt+1:], parts[insertAt:])
			parts[insertAt] = part
			req.Contents[len(req.Contents)-1].Parts = parts
			return
		}
		req.Contents[len(req.Contents)-1].Parts = append(req.Contents[len(req.Contents)-1].Parts, part)
		return
	}
	req.Contents = append(req.Contents, dto.GeminiChatContent{
		Role:  role,
		Parts: []dto.GeminiPart{part},
	})
}

func responsesGeminiRole(item map[string]any) string {
	switch strings.TrimSpace(common.Interface2String(item["role"])) {
	case "assistant":
		return "model"
	case "system", "developer":
		return "system"
	case "model":
		return "model"
	default:
		return "user"
	}
}
