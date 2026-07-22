package oairesponses

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relaymedia "github.com/QuantumNous/new-api/service/relayconvert/internal/media"
	sharedclaude "github.com/QuantumNous/new-api/service/relayconvert/internal/shared/claude"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/gin-gonic/gin"
)

func convertOpenAIResponsesRequestToClaudeMessages(c *gin.Context, _ *relaycommon.RelayInfo, request any) (any, error) {
	responsesRequest, err := OpenAIResponsesRequestFromAny(request)
	if err != nil {
		return nil, err
	}
	return OpenAIResponsesRequestToClaudeMessages(c, responsesRequest)
}

func OpenAIResponsesRequestToClaudeMessages(c *gin.Context, req *dto.OpenAIResponsesRequest) (*dto.ClaudeRequest, error) {
	if req == nil {
		return nil, fmt.Errorf("request is nil")
	}
	if req.Model == "" {
		return nil, fmt.Errorf("model is required")
	}
	if err := ValidateRequestChatUnsupportedFields(req); err != nil {
		return nil, err
	}

	claudeRequest := &dto.ClaudeRequest{
		Model:       req.Model,
		Temperature: req.Temperature,
		TopP:        req.TopP,
		Stream:      req.Stream,
	}
	if req.MaxOutputTokens != nil && *req.MaxOutputTokens > 0 {
		claudeRequest.MaxTokens = common.GetPointer(*req.MaxOutputTokens)
	}
	if claudeRequest.MaxTokens == nil || *claudeRequest.MaxTokens == 0 {
		defaultMaxTokens := uint(model_setting.GetClaudeSettings().GetDefaultMaxTokens(req.Model))
		claudeRequest.MaxTokens = &defaultMaxTokens
	}

	functions, err := RequestFunctionDeclarations(req.Tools)
	if err != nil {
		return nil, err
	}
	if len(functions) > 0 {
		claudeRequest.Tools = responsesFunctionDeclarationsToClaudeTools(functions)
	}

	toolChoice, err := RequestToolChoiceToChat(req.ToolChoice)
	if err != nil {
		return nil, err
	}
	if toolChoice != nil || RawJSONPresent(req.ParallelToolCalls) {
		claudeRequest.ToolChoice = sharedclaude.MapOpenAIToolChoice(toolChoice, ParallelToolCalls(req.ParallelToolCalls))
	}
	applyResponsesReasoningToClaude(req, claudeRequest)

	systemMessages := make([]dto.ClaudeMediaMessage, 0)
	if RawJSONPresent(req.Instructions) {
		instructions, err := JSONString(req.Instructions)
		if err != nil {
			return nil, fmt.Errorf("invalid instructions: %w", err)
		}
		if strings.TrimSpace(instructions) != "" {
			systemMessages = append(systemMessages, dto.ClaudeMediaMessage{
				Type: "text",
				Text: common.GetPointer(instructions),
			})
		}
	}

	inputItems, err := InputItems(req.Input)
	if err != nil {
		return nil, err
	}
	for _, item := range inputItems {
		itemType := strings.TrimSpace(common.Interface2String(item["type"]))
		switch itemType {
		case ResponsesInputTypeFunctionCall:
			claudeRequest.Messages = appendClaudeToolUse(claudeRequest.Messages, responsesFunctionCallItemToClaudeToolUse(item, "arguments"))
		case ResponsesInputTypeCustomToolCall:
			claudeRequest.Messages = appendClaudeToolUse(claudeRequest.Messages, responsesFunctionCallItemToClaudeToolUse(item, "input"))
		case ResponsesInputTypeFunctionCallOutput, ResponsesInputTypeCustomToolOutput:
			claudeRequest.Messages = appendClaudeToolResult(claudeRequest.Messages, responsesFunctionOutputItemToClaudeToolResult(item))
		default:
			role := responsesClaudeRole(item)
			parts, err := responsesInputContentToClaudeMediaMessages(c, item["content"])
			if err != nil {
				return nil, err
			}
			if role == "system" {
				systemMessages = append(systemMessages, parts...)
				continue
			}
			if len(parts) == 0 {
				parts = []dto.ClaudeMediaMessage{
					{
						Type: "text",
						Text: common.GetPointer("..."),
					},
				}
			}
			claudeRequest.Messages = append(claudeRequest.Messages, dto.ClaudeMessage{
				Role:    role,
				Content: parts,
			})
		}
	}

	if len(systemMessages) > 0 {
		claudeRequest.System = systemMessages
	}
	claudeRequest.Messages = ensureClaudeMessagesStartWithUser(claudeRequest.Messages)
	return claudeRequest, nil
}

func responsesFunctionDeclarationsToClaudeTools(functions []dto.FunctionRequest) []any {
	tools := make([]any, 0, len(functions))
	for _, function := range functions {
		tools = append(tools, &dto.Tool{
			Name:        function.Name,
			Description: function.Description,
			InputSchema: responsesFunctionParametersToClaudeInputSchema(function.Parameters),
		})
	}
	return tools
}

func responsesFunctionParametersToClaudeInputSchema(parameters any) map[string]interface{} {
	if params, ok := parameters.(map[string]any); ok {
		schema := make(map[string]interface{}, len(params))
		for key, value := range params {
			schema[key] = value
		}
		if schema["type"] == nil {
			schema["type"] = "object"
		}
		if schema["properties"] == nil {
			schema["properties"] = map[string]interface{}{}
		}
		return schema
	}
	return map[string]interface{}{
		"type":       "object",
		"properties": map[string]interface{}{},
	}
}

func applyResponsesReasoningToClaude(req *dto.OpenAIResponsesRequest, claudeRequest *dto.ClaudeRequest) {
	effort := ReasoningEffort(req)
	switch effort {
	case "low":
		claudeRequest.Thinking = &dto.Thinking{
			Type:         "enabled",
			BudgetTokens: common.GetPointer(1280),
		}
	case "medium":
		claudeRequest.Thinking = &dto.Thinking{
			Type:         "enabled",
			BudgetTokens: common.GetPointer(2048),
		}
	case "high":
		claudeRequest.Thinking = &dto.Thinking{
			Type:         "enabled",
			BudgetTokens: common.GetPointer(4096),
		}
	}
}

func responsesInputContentToClaudeMediaMessages(c *gin.Context, content any) ([]dto.ClaudeMediaMessage, error) {
	contentParts, err := ContentParts(content)
	if err != nil {
		return nil, err
	}

	parts := make([]dto.ClaudeMediaMessage, 0, len(contentParts))
	for _, contentPart := range contentParts {
		partType := strings.TrimSpace(common.Interface2String(contentPart["type"]))
		switch partType {
		case "input_text", "output_text", "text":
			text := common.Interface2String(contentPart["text"])
			if text != "" {
				parts = append(parts, dto.ClaudeMediaMessage{
					Type: "text",
					Text: common.GetPointer(text),
				})
			}
		case "input_image", "input_file", "input_audio", "input_video":
			source := ContentPartToFileSource(contentPart)
			if source == nil {
				continue
			}
			base64Data, mimeType, err := relaymedia.ResolveBase64Data(c, source, "formatting Responses input for Claude")
			if err != nil {
				return nil, fmt.Errorf("get file data failed: %s", err.Error())
			}
			claudePart := dto.ClaudeMediaMessage{
				Source: &dto.ClaudeMessageSource{
					Type:      "base64",
					MediaType: mimeType,
					Data:      base64Data,
				},
			}
			if strings.HasPrefix(mimeType, "application/pdf") {
				claudePart.Type = "document"
			} else {
				claudePart.Type = "image"
			}
			parts = append(parts, claudePart)
		}
	}
	return parts, nil
}

func responsesFunctionCallItemToClaudeToolUse(item map[string]any, inputKey string) dto.ClaudeMediaMessage {
	return dto.ClaudeMediaMessage{
		Type:  "tool_use",
		Id:    CallID(item),
		Name:  strings.TrimSpace(common.Interface2String(item["name"])),
		Input: ObjectValue(item[inputKey], inputKey),
	}
}

func responsesFunctionOutputItemToClaudeToolResult(item map[string]any) dto.ClaudeMediaMessage {
	return dto.ClaudeMediaMessage{
		Type:      "tool_result",
		ToolUseId: CallID(item),
		Content:   responsesToolOutputValue(item["output"]),
	}
}

func responsesToolOutputValue(value any) any {
	if value == nil {
		return ""
	}
	return value
}

func appendClaudeToolUse(messages []dto.ClaudeMessage, toolUse dto.ClaudeMediaMessage) []dto.ClaudeMessage {
	if len(messages) > 0 && messages[len(messages)-1].Role == "assistant" {
		last := messages[len(messages)-1]
		parts := claudeMessageContentParts(last.Content)
		parts = append(parts, toolUse)
		last.Content = parts
		messages[len(messages)-1] = last
		return messages
	}
	return append(messages, dto.ClaudeMessage{
		Role:    "assistant",
		Content: []dto.ClaudeMediaMessage{toolUse},
	})
}

func appendClaudeToolResult(messages []dto.ClaudeMessage, toolResult dto.ClaudeMediaMessage) []dto.ClaudeMessage {
	if len(messages) > 0 && messages[len(messages)-1].Role == "user" {
		last := messages[len(messages)-1]
		parts := claudeMessageContentParts(last.Content)
		parts = append(parts, toolResult)
		last.Content = parts
		messages[len(messages)-1] = last
		return messages
	}
	return append(messages, dto.ClaudeMessage{
		Role:    "user",
		Content: []dto.ClaudeMediaMessage{toolResult},
	})
}

func claudeMessageContentParts(content any) []dto.ClaudeMediaMessage {
	switch typed := content.(type) {
	case []dto.ClaudeMediaMessage:
		return typed
	case string:
		if typed == "" {
			return nil
		}
		return []dto.ClaudeMediaMessage{
			{
				Type: "text",
				Text: common.GetPointer(typed),
			},
		}
	default:
		parts, _ := common.Any2Type[[]dto.ClaudeMediaMessage](content)
		return parts
	}
}

func responsesClaudeRole(item map[string]any) string {
	switch strings.TrimSpace(common.Interface2String(item["role"])) {
	case "assistant":
		return "assistant"
	case "system", "developer":
		return "system"
	default:
		return "user"
	}
}

func ensureClaudeMessagesStartWithUser(messages []dto.ClaudeMessage) []dto.ClaudeMessage {
	if len(messages) == 0 || messages[0].Role == "user" {
		return messages
	}
	return append([]dto.ClaudeMessage{
		{
			Role: "user",
			Content: []dto.ClaudeMediaMessage{
				{
					Type: "text",
					Text: common.GetPointer("..."),
				},
			},
		},
	}, messages...)
}
