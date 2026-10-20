package claudemessages

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/convmeta"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/internal/convdiag"
	sharedclaude "github.com/QuantumNous/new-api/relaykit/relayconvert/internal/shared/claude"
	kitutil "github.com/QuantumNous/new-api/relaykit/relayconvert/kitutil"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/reasoning"
	"github.com/QuantumNous/new-api/relaykit/types"
)

const (
	webSearchMaxUsesLow    = 1
	webSearchMaxUsesMedium = 5
	webSearchMaxUsesHigh   = 10
)

type openRouterRequestReasoning struct {
	Enabled   *bool  `json:"enabled,omitempty"`
	Effort    string `json:"effort,omitempty"`
	MaxTokens int    `json:"max_tokens,omitempty"`
	Exclude   bool   `json:"exclude,omitempty"`
}

func ClaudeMessagesRequestToOpenAIChat(ctx context.Context, claudeRequest dto.ClaudeRequest, info convmeta.Meta) (*dto.GeneralOpenAIRequest, error) {
	openAIRequest := dto.GeneralOpenAIRequest{
		Model:       claudeRequest.Model,
		Temperature: claudeRequest.Temperature,
	}
	if claudeRequest.MaxTokens != nil {
		openAIRequest.MaxTokens = kitutil.GetPointer(*claudeRequest.MaxTokens)
	} else if claudeRequest.MaxTokensToSample != nil {
		// Legacy Anthropic alias for max_tokens; honor it when the modern
		// field is absent (mirrors the Responses-side converter).
		openAIRequest.MaxTokens = kitutil.GetPointer(*claudeRequest.MaxTokensToSample)
	}
	if claudeRequest.TopP != nil {
		openAIRequest.TopP = kitutil.GetPointer(*claudeRequest.TopP)
	}
	if claudeRequest.TopK != nil {
		openAIRequest.TopK = kitutil.GetPointer(*claudeRequest.TopK)
	}
	if claudeRequest.Stream != nil {
		openAIRequest.Stream = kitutil.GetPointer(*claudeRequest.Stream)
	}
	reasoningIntent, effectiveEffort, err := claudeRequestReasoningIntent(ctx, &claudeRequest, info)
	if err != nil {
		return nil, reasoning.AsClientError(err)
	}

	isOpenRouter := convmeta.OptionsOf(info).OpenRouterDialect
	if isOpenRouter {
		if effort := claudeRequest.GetEfforts(); effort != "" {
			effortBytes, _ := kitutil.Marshal(effort)
			openAIRequest.Verbosity = effortBytes
		}
		if !reasoningIntent.IsEmpty() {
			var reasoningConfig openRouterRequestReasoning
			disabled := reasoningIntent.Mode == reasoning.ModeDisabled || reasoningIntent.Effort == reasoning.EffortNone
			enabled := !disabled
			reasoningConfig.Enabled = &enabled
			if enabled && reasoningIntent.BudgetTokens != nil && reasoningIntent.Mode != reasoning.ModeAdaptive {
				reasoningConfig = openRouterRequestReasoning{
					Enabled:   &enabled,
					MaxTokens: *reasoningIntent.BudgetTokens,
				}
			} else if enabled {
				reasoningConfig.Effort = string(reasoning.EffectiveEffort(reasoningIntent))
			}
			if reasoningIntent.IncludeThoughts != nil {
				reasoningConfig.Exclude = !*reasoningIntent.IncludeThoughts
			}
			reasoningJSON, err := kitutil.Marshal(reasoningConfig)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal reasoning: %w", err)
			}
			openAIRequest.Reasoning = reasoningJSON
		}
	} else {
		if err := reasoning.ApplyToOpenAIChat(&openAIRequest, reasoningIntent); err != nil {
			return nil, reasoning.AsClientError(err)
		}
		if info != nil {
			// Keep the outgoing -thinking suffix so a cascaded downstream
			// new-api can recover reasoning intent from the model name. This
			// is an emission-side policy, not converter-side suffix parsing.
			thinkingSuffix := "-thinking"
			if strings.HasSuffix(info.GetOriginModelName(), thinkingSuffix) &&
				!strings.HasSuffix(openAIRequest.Model, thinkingSuffix) {
				openAIRequest.Model = openAIRequest.Model + thinkingSuffix
			}
		}
	}
	if info != nil && effectiveEffort != "" {
		info.SetReasoningEffort(string(effectiveEffort))
	}

	if len(claudeRequest.StopSequences) == 1 {
		openAIRequest.Stop = claudeRequest.StopSequences[0]
	} else if len(claudeRequest.StopSequences) > 1 {
		openAIRequest.Stop = claudeRequest.StopSequences
	}

	tools, err := kitutil.Any2Type[[]dto.Tool](claudeRequest.Tools)
	if err != nil {
		return nil, fmt.Errorf("invalid Claude tools: %w", err)
	}
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

	if claudeRequest.ToolChoice != nil {
		toolChoice, parallelToolCalls, err := sharedclaude.ClaudeToolChoiceToChat(claudeRequest.ToolChoice)
		if err != nil {
			return nil, err
		}
		openAIRequest.ToolChoice = toolChoice
		openAIRequest.ParallelTooCalls = parallelToolCalls
	}

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
				isOpenRouterClaude := isOpenRouter && strings.HasPrefix(convmeta.UpstreamModelName(info), "anthropic/claude")
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
					var systemStr strings.Builder
					for _, system := range systems {
						if system.Text != nil {
							systemStr.WriteString(*system.Text)
						}
					}
					openAIMessage.SetStringContent(systemStr.String())
				}
				openAIMessages = append(openAIMessages, openAIMessage)
			}
		}
	}

	// Tool results whose name is not inline-resolvable keep Name nil until the
	// second pass, which can also resolve forward references to tool_use
	// blocks appearing later in the conversation.
	type unnamedToolResult struct {
		index int
		id    string
	}
	toolNames := make(map[string]string)
	var unnamedToolResults []unnamedToolResult
	for messageIndex, claudeMessage := range claudeRequest.Messages {
		if claudeMessage.IsStringContent() {
			openAIMessage := dto.Message{
				Role: claudeMessage.Role,
			}
			openAIMessage.SetStringContent(claudeMessage.GetStringContent())
			openAIMessages = append(openAIMessages, openAIMessage)
			continue
		}
		content, err := claudeMessage.ParseContent()
		if err != nil {
			return nil, err
		}

		// Flush model: text/image blocks accumulate into the pending message
		// so a tool_result in the middle of a Claude message flushes the
		// pending content first and preserves the original block order.
		role := claudeMessage.Role
		var pendingContent []dto.MediaContent
		var pendingToolCalls []dto.ToolCallRequest
		flushPending := func() {
			if len(pendingContent) == 0 && len(pendingToolCalls) == 0 {
				return
			}
			pending := dto.Message{Role: role}
			pending.SetMediaContent(pendingContent)
			if len(pendingToolCalls) > 0 {
				pending.SetToolCalls(pendingToolCalls)
			}
			openAIMessages = append(openAIMessages, pending)
			pendingContent = nil
			pendingToolCalls = nil
		}

		for blockIndex, mediaMsg := range content {
			switch mediaMsg.Type {
			case "thinking", "redacted_thinking":
				// Chat Completions has no encrypted-thinking history slot.
				// Never fabricate a signature for it upstream, just record
				// that the block was dropped.
				convdiag.Add(ctx, types.ConversionDiagnostic{
					Code:     "thinking_history_dropped",
					Path:     fmt.Sprintf("messages[%d].content[%d]", messageIndex, blockIndex),
					Message:  "Claude thinking history block cannot be represented in Chat Completions and was dropped",
					Severity: types.ConversionDiagnosticWarning,
					From:     types.RelayFormatClaude,
					To:       types.RelayFormatOpenAI,
				})
			case "text", "input_text":
				message := dto.MediaContent{
					Type: "text",
					Text: mediaMsg.GetText(),
				}
				if isOpenRouter {
					message.CacheControl = mediaMsg.CacheControl
				}
				pendingContent = append(pendingContent, message)
			case "image":
				// claudeSourceURL handles nil sources, remote URLs, and
				// base64/data: payloads uniformly.
				sourceURL := claudeSourceURL(mediaMsg.Source)
				if sourceURL == "" {
					convdiag.Add(ctx, types.ConversionDiagnostic{
						Code:     "image_source_unsupported",
						Path:     fmt.Sprintf("messages[%d].content[%d]", messageIndex, blockIndex),
						Message:  "Claude image source cannot be represented as a Chat image_url and was dropped",
						Severity: types.ConversionDiagnosticWarning,
						From:     types.RelayFormatClaude,
						To:       types.RelayFormatOpenAI,
					})
					continue
				}
				pendingContent = append(pendingContent, dto.MediaContent{
					Type:     "image_url",
					ImageUrl: &dto.MessageImageUrl{Url: sourceURL},
				})
			case "tool_use":
				if _, exists := toolNames[mediaMsg.Id]; !exists {
					// First registration wins; duplicate ids keep the
					// earliest tool name.
					toolNames[mediaMsg.Id] = mediaMsg.Name
				}
				toolCall := dto.ToolCallRequest{
					ID:   mediaMsg.Id,
					Type: "function",
					Function: dto.FunctionRequest{
						Name:      mediaMsg.Name,
						Arguments: requestToJSONString(mediaMsg.Input),
					},
				}
				pendingToolCalls = append(pendingToolCalls, toolCall)
			case "tool_result":
				flushPending()
				toolName := mediaMsg.Name
				oaiToolMessage := dto.Message{
					Role:       "tool",
					ToolCallId: mediaMsg.ToolUseId,
				}
				if toolName != "" {
					name := toolName
					oaiToolMessage.Name = &name
				} else {
					unnamedToolResults = append(unnamedToolResults, unnamedToolResult{index: len(openAIMessages), id: mediaMsg.ToolUseId})
				}
				if mediaMsg.IsStringContent() {
					oaiToolMessage.SetStringContent(mediaMsg.GetStringContent())
				} else {
					mediaContents := mediaMsg.ParseMediaContent()
					encodedJSON, _ := kitutil.Marshal(mediaContents)
					oaiToolMessage.SetStringContent(string(encodedJSON))
				}
				openAIMessages = append(openAIMessages, oaiToolMessage)
			}
		}
		flushPending()
	}
	for _, result := range unnamedToolResults {
		if result.index < 0 || result.index >= len(openAIMessages) {
			continue
		}
		// Only backfill a name we actually resolved; an unknown tool_use_id
		// keeps Name nil instead of an empty string.
		if name := toolNames[result.id]; name != "" {
			openAIMessages[result.index].Name = &name
		}
	}

	openAIRequest.Messages = openAIMessages

	// Claude-only request fields have no Chat Completions equivalent. Record
	// each dropped field so hosts can surface the loss instead of silently
	// swallowing it.
	droppedFields := make([]types.ConversionDiagnostic, 0, 6)
	appendDropped := func(field string, present bool) {
		if !present {
			return
		}
		droppedFields = append(droppedFields, types.ConversionDiagnostic{
			Code:     "dropped_request_field",
			Path:     field,
			Message:  fmt.Sprintf("Claude request field %q has no Chat Completions equivalent and was dropped", field),
			Severity: types.ConversionDiagnosticWarning,
			From:     types.RelayFormatClaude,
			To:       types.RelayFormatOpenAI,
		})
	}
	appendDropped("metadata", rawJSONFieldPresent(claudeRequest.Metadata))
	appendDropped("mcp_servers", rawJSONFieldPresent(claudeRequest.McpServers))
	appendDropped("context_management", rawJSONFieldPresent(claudeRequest.ContextManagement))
	appendDropped("container", rawJSONFieldPresent(claudeRequest.Container))
	appendDropped("service_tier", claudeRequest.ServiceTier != "")
	appendDropped("chat_template_kwargs", rawJSONFieldPresent(claudeRequest.ChatTemplateKwargs))
	convdiag.Add(ctx, droppedFields...)

	return &openAIRequest, nil
}

func rawJSONFieldPresent(raw json.RawMessage) bool {
	if len(raw) == 0 {
		return false
	}
	return kitutil.GetJsonType(raw) != "null"
}

func requestToJSONString(v any) string {
	b, err := kitutil.Marshal(v)
	if err != nil {
		return "{}"
	}
	return string(b)
}
