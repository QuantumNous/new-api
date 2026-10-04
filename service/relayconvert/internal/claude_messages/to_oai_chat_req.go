package claudemessages

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relaymeta "github.com/QuantumNous/new-api/service/relayconvert/internal/meta"
	sharedopenai "github.com/QuantumNous/new-api/service/relayconvert/internal/shared/openai"
)

const (
	webSearchMaxUsesLow    = 1
	webSearchMaxUsesMedium = 5
	webSearchMaxUsesHigh   = 10
)

type openRouterRequestReasoning struct {
	Enabled   bool   `json:"enabled"`
	Effort    string `json:"effort,omitempty"`
	MaxTokens int    `json:"max_tokens,omitempty"`
	Exclude   bool   `json:"exclude,omitempty"`
}

func ClaudeMessagesRequestToOpenAIChat(claudeRequest dto.ClaudeRequest, info *relaycommon.RelayInfo) (*dto.GeneralOpenAIRequest, error) {
	openAIRequest := dto.GeneralOpenAIRequest{
		Model:       claudeRequest.Model,
		Temperature: claudeRequest.Temperature,
	}
	if claudeRequest.MaxTokens != nil {
		openAIRequest.MaxTokens = common.GetPointer(*claudeRequest.MaxTokens)
	}
	if claudeRequest.TopP != nil {
		openAIRequest.TopP = common.GetPointer(*claudeRequest.TopP)
	}
	if claudeRequest.TopK != nil {
		openAIRequest.TopK = common.GetPointer(*claudeRequest.TopK)
	}
	if claudeRequest.Stream != nil {
		openAIRequest.Stream = common.GetPointer(*claudeRequest.Stream)
	}
	if claudeRequest.ToolChoice != nil {
		choice, err := common.Any2Type[dto.ClaudeToolChoice](claudeRequest.ToolChoice)
		if err != nil {
			return nil, err
		}
		switch choice.Type {
		case "auto", "none":
			openAIRequest.ToolChoice = choice.Type
		case "any":
			openAIRequest.ToolChoice = "required"
		case "tool":
			openAIRequest.ToolChoice = map[string]any{"type": "function", "function": map[string]any{"name": choice.Name}}
		default:
			return nil, fmt.Errorf("OpenAI conversion does not support Claude tool choice %q", choice.Type)
		}
		if choice.Type != "none" {
			openAIRequest.ParallelTooCalls = common.GetPointer(!choice.DisableParallelToolUse)
		}
	}
	var outputConfig struct {
		Format map[string]any `json:"format"`
	}
	if len(claudeRequest.OutputConfig) > 0 {
		if err := common.Unmarshal(claudeRequest.OutputConfig, &outputConfig); err != nil {
			return nil, err
		}
	}
	if outputConfig.Format == nil && len(claudeRequest.OutputFormat) > 0 {
		if err := common.Unmarshal(claudeRequest.OutputFormat, &outputConfig.Format); err != nil {
			return nil, err
		}
	}
	if outputConfig.Format != nil {
		if outputConfig.Format["type"] != "json_schema" {
			return nil, fmt.Errorf("unsupported Claude output format %v", outputConfig.Format["type"])
		}
		schema, err := common.Marshal(map[string]any{"name": "response", "schema": outputConfig.Format["schema"]})
		if err != nil {
			return nil, err
		}
		openAIRequest.ResponseFormat = &dto.ResponseFormat{Type: "json_schema", JsonSchema: schema}
	}

	isOpenRouter := relaymeta.RelayInfoChannelType(info) == constant.ChannelTypeOpenRouter
	if !isOpenRouter && claudeRequest.Thinking != nil {
		encoded, err := common.Marshal(claudeRequest.Thinking)
		if err != nil {
			return nil, err
		}
		openAIRequest.THINKING = encoded
		if claudeRequest.Thinking.Type == "disabled" {
			openAIRequest.ReasoningEffort = "none"
		}
		if effort := claudeRequest.GetEfforts(); effort != "" {
			openAIRequest.ReasoningEffort = effort
		}
	}
	if isOpenRouter {
		if effort := claudeRequest.GetEfforts(); effort != "" {
			effortBytes, _ := common.Marshal(effort)
			openAIRequest.Verbosity = effortBytes
		}
		if claudeRequest.Thinking != nil {
			var reasoningConfig openRouterRequestReasoning
			if claudeRequest.Thinking.Type == "enabled" {
				reasoningConfig = openRouterRequestReasoning{
					Enabled:   true,
					MaxTokens: claudeRequest.Thinking.GetBudgetTokens(),
				}
			} else if claudeRequest.Thinking.Type == "adaptive" {
				reasoningConfig = openRouterRequestReasoning{
					Enabled: true,
				}
			}
			reasoningJSON, err := common.Marshal(reasoningConfig)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal reasoning: %w", err)
			}
			openAIRequest.Reasoning = reasoningJSON
		}
	} else if info != nil {
		thinkingSuffix := "-thinking"
		if strings.HasSuffix(info.OriginModelName, thinkingSuffix) &&
			!strings.HasSuffix(openAIRequest.Model, thinkingSuffix) {
			openAIRequest.Model = openAIRequest.Model + thinkingSuffix
		}
	}

	if len(claudeRequest.StopSequences) == 1 {
		openAIRequest.Stop = claudeRequest.StopSequences[0]
	} else if len(claudeRequest.StopSequences) > 1 {
		openAIRequest.Stop = claudeRequest.StopSequences
	}

	tools, _ := common.Any2Type[[]dto.Tool](claudeRequest.Tools)
	openAITools := make([]dto.ToolCallRequest, 0)
	for _, claudeTool := range tools {
		openAITool := dto.ToolCallRequest{
			Type: "function",
			Function: dto.FunctionRequest{
				Name:        claudeTool.Name,
				Description: claudeTool.Description,
				Parameters:  claudeTool.InputSchema,
			},
		}
		openAITools = append(openAITools, openAITool)
	}
	openAIRequest.Tools = openAITools

	openAIMessages := make([]dto.Message, 0)
	if claudeRequest.System != nil {
		if claudeRequest.IsStringSystem() && claudeRequest.GetStringSystem() != "" {
			openAIMessage := dto.Message{
				Role: "system",
			}
			openAIMessage.SetStringContent(claudeRequest.GetStringSystem())
			openAIMessages = append(openAIMessages, openAIMessage)
		} else {
			systems := claudeRequest.ParseSystem()
			if len(systems) > 0 {
				openAIMessage := dto.Message{
					Role: "system",
				}
				isOpenRouterClaude := isOpenRouter && strings.HasPrefix(relaymeta.RelayInfoUpstreamModelName(info), "anthropic/claude")
				if isOpenRouterClaude {
					systemMediaMessages := make([]dto.MediaContent, 0, len(systems))
					for _, system := range systems {
						message := dto.MediaContent{
							Type:         "text",
							Text:         system.GetText(),
							CacheControl: system.CacheControl,
						}
						systemMediaMessages = append(systemMediaMessages, message)
					}
					openAIMessage.SetMediaContent(systemMediaMessages)
				} else {
					systemStr := ""
					for _, system := range systems {
						if system.Text != nil {
							systemStr += *system.Text
						}
					}
					openAIMessage.SetStringContent(systemStr)
				}
				openAIMessages = append(openAIMessages, openAIMessage)
			}
		}
	}

	var pendingToolMedia []dto.MediaContent
	flushToolMedia := func() {
		if len(pendingToolMedia) > 0 {
			openAIMessages = append(openAIMessages, dto.Message{Role: "user", Content: pendingToolMedia})
			pendingToolMedia = nil
		}
	}
	type unnamedToolResult struct {
		index int
		id    string
	}
	toolNames := make(map[string]string)
	var unnamedToolResults []unnamedToolResult
	for _, claudeMessage := range claudeRequest.Messages {
		if claudeMessage.Role != "user" {
			flushToolMedia()
		}
		hasToolResult := false
		openAIMessage := dto.Message{
			Role: claudeMessage.Role,
		}
		if claudeMessage.IsStringContent() {
			openAIMessage.SetStringContent(claudeMessage.GetStringContent())
		} else {
			content, err := claudeMessage.ParseContent()
			if err != nil {
				return nil, err
			}
			var toolCalls []dto.ToolCallRequest
			mediaMessages := make([]dto.MediaContent, 0, len(content))

			for _, mediaMsg := range content {
				if _, exists := toolNames[mediaMsg.Id]; !exists {
					toolNames[mediaMsg.Id] = mediaMsg.Name
				}
				switch mediaMsg.Type {
				case "text", "input_text", "image", "document":
					media, err := claudeMediaToOpenAI(mediaMsg)
					if err != nil {
						return nil, err
					}
					mediaMessages = append(mediaMessages, media)
				case "thinking":
					if mediaMsg.Thinking != nil {
						openAIMessage.ReasoningContent = common.GetPointer(openAIMessage.GetReasoningContent() + *mediaMsg.Thinking)
					}
				case "tool_use":
					toolCall := dto.ToolCallRequest{
						ID:   mediaMsg.Id,
						Type: "function",
						Function: dto.FunctionRequest{
							Name:      mediaMsg.Name,
							Arguments: requestToJSONString(mediaMsg.Input),
						},
					}
					toolCalls = append(toolCalls, toolCall)
				case "tool_result":
					hasToolResult = true
					toolName := mediaMsg.Name
					if toolName == "" {
						unnamedToolResults = append(unnamedToolResults, unnamedToolResult{index: len(openAIMessages), id: mediaMsg.ToolUseId})
					}
					oaiToolMessage := dto.Message{
						Role:       "tool",
						Name:       &toolName,
						ToolCallId: mediaMsg.ToolUseId,
					}
					if mediaMsg.IsStringContent() {
						oaiToolMessage.SetStringContent(mediaMsg.GetStringContent())
					} else {
						mediaContents, err := common.Any2Type[[]dto.ClaudeMediaMessage](mediaMsg.Content)
						if err != nil {
							return nil, err
						}
						var converted []dto.MediaContent
						for _, part := range mediaContents {
							media, err := claudeMediaToOpenAI(part)
							if err != nil {
								return nil, err
							}
							converted = append(converted, media)
						}
						text, attachments := sharedopenai.SplitToolContent(mediaMsg.ToolUseId, converted)
						oaiToolMessage.SetStringContent(text)
						mediaMessages = append(mediaMessages, attachments...)
					}
					openAIMessages = append(openAIMessages, oaiToolMessage)
				}
			}

			if len(toolCalls) > 0 {
				openAIMessage.SetToolCalls(toolCalls)
			}
			if hasToolResult || (claudeMessage.Role == "user" && len(pendingToolMedia) > 0) {
				pendingToolMedia = append(pendingToolMedia, mediaMessages...)
			} else if len(mediaMessages) > 0 {
				openAIMessage.SetMediaContent(mediaMessages)
			}
		}
		if claudeMessage.Role == "user" && len(pendingToolMedia) > 0 && openAIMessage.IsStringContent() {
			pendingToolMedia = append(pendingToolMedia, dto.MediaContent{Type: dto.ContentTypeText, Text: openAIMessage.StringContent()})
			openAIMessage.SetNullContent()
		}
		if len(openAIMessage.ParseContent()) > 0 || len(openAIMessage.ToolCalls) > 0 {
			openAIMessages = append(openAIMessages, openAIMessage)
		}
	}

	for _, result := range unnamedToolResults {
		*openAIMessages[result.index].Name = toolNames[result.id]
	}

	flushToolMedia()
	openAIRequest.Messages = openAIMessages
	return &openAIRequest, nil
}

func requestToJSONString(v interface{}) string {
	b, err := common.Marshal(v)
	if err != nil {
		return "{}"
	}
	return string(b)
}
