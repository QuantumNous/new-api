package relayconvert

import (
	"context"
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/ir"
	"github.com/QuantumNous/new-api/relaykit/ir/project"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/convmeta"
	sharedclaude "github.com/QuantumNous/new-api/relaykit/relayconvert/internal/shared/claude"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/kitutil"
	"github.com/QuantumNous/new-api/relaykit/types"
)

func irResponseConverter(from, target types.RelayFormat) ResponseConverterFunc {
	return func(ctx context.Context, info convmeta.Meta, response any) (any, *dto.Usage, error) {
		if value, handled, err := irConvertResponseChoices(ctx, info, from, target, response); handled || err != nil {
			return value, canonicalUsageFromResponse(response), err
		}
		normalized, err := project.FromResponse(from, response)
		if err != nil {
			return nil, nil, err
		}
		usage := canonicalUsageFromResponse(response)
		created := any(time.Now().Unix())
		switch from {
		case types.RelayFormatOpenAI:
			native, err := asOAIChatResponse(response)
			if err != nil {
				return nil, nil, err
			}
			if native.Created != nil {
				created = native.Created
			}
		case types.RelayFormatOpenAIResponses:
			native, err := asOAIResponsesResponse(response)
			if err != nil {
				return nil, nil, err
			}
			if native.CreatedAt != 0 {
				created = int(native.CreatedAt)
			}
		}
		createdRaw, _ := kitutil.Marshal(created)
		var createdAt int64
		_ = kitutil.Unmarshal(createdRaw, &createdAt)
		normalized.ProviderFinish = ""
		if normalized.ID == "" {
			normalized.ID = fmt.Sprintf("resp_%s", kitutil.GetUUID())
		}
		if normalized.Model == "" {
			normalized.Model = convmeta.UpstreamModelName(info)
		}
		if from == types.RelayFormatOpenAIResponses {
			native, err := asOAIResponsesResponse(response)
			if err != nil {
				return nil, nil, err
			}
			finish, incomplete := ResponsesFinishReasonFromStatus(native)
			if !incomplete {
				finish = "stop"
			}
			normalized.Finish = ir.FinishFromChat(finish)
		}
		for i := range normalized.Blocks {
			if use := normalized.Blocks[i].ToolUse; use != nil && use.ID == "" {
				use.ID = ir.CanonicalToolCallID(normalized.ID, i, "")
			}
		}
		if normalized.Finish == ir.FinishStop {
			for _, block := range normalized.Blocks {
				if block.ToolUse != nil {
					normalized.Finish = ir.FinishTool
					break
				}
			}
		}
		value, err := project.ToResponse(target, normalized)
		if err != nil {
			return nil, nil, err
		}
		irApplyResponseUsage(value, usage)
		switch out := value.(type) {
		case *dto.OpenAITextResponse:
			out.Object = "chat.completion"
			if out.Created == nil {
				out.Created = created
			}
		case *dto.OpenAIResponsesResponse:
			status, details := ResponsesStatusFromChatFinishReason(normalized.Finish.ToChatFinishReason())
			out.Status, _ = kitutil.Marshal(status)
			out.IncompleteDetails = details
			out.CreatedAt = dto.IntValue(int(createdAt))
			for i := range out.Output {
				item := &out.Output[i]
				item.Status = status
				if item.Type == "function_call" {
					restoreIRResponsesTool(item, convmeta.ResponsesToolStateOf(info))
				}
				if item.Type == "message" {
					for j := range item.Content {
						if item.Content[j].Annotations == nil {
							item.Content[j].Annotations = []any{}
						}
					}
				}
			}
		}
		return value, usage, nil
	}
}

// irApplyResponseUsage keeps the original provider's accounting sidecar at the
// host boundary. IR content projection must never re-derive billable tokens.
func irApplyResponseUsage(value any, usage *dto.Usage) {
	switch out := value.(type) {
	case *dto.OpenAITextResponse:
		if usage != nil {
			out.Usage = *usage
		}
	case *dto.ChatCompletionsStreamResponse:
		if out.Usage != nil {
			out.Usage = usage
		}
	case *dto.OpenAIResponsesResponse:
		out.Usage = usage
	case dto.ResponsesStreamResponse:
		if out.Response != nil {
			out.Response.Usage = usage
		}
	case *dto.ClaudeResponse:
		if out.Type == "message" || out.Type == "message_delta" {
			out.Usage = sharedclaude.UsageFromOpenAI(usage)
		}
		if out.Type == "message_start" && out.Message != nil && usage != nil {
			out.Message.Usage = sharedclaude.UsageFromOpenAI(usage)
		}
	case *dto.GeminiChatResponse:
		if usage == nil {
			return
		}
		out.HasUsageMetadata = true
		out.UsageMetadata = dto.GeminiUsageMetadata{PromptTokenCount: usage.PromptTokens, CandidatesTokenCount: usage.CompletionTokens, TotalTokenCount: usage.TotalTokens, BillingUsage: dto.CloneBillingUsage(usage.BillingUsage)}
		billing := dto.CloneBillingUsage(usage.BillingUsage)
		if billing != nil && billing.GeminiUsageMetadata != nil && (billing.Source == dto.BillingUsageSourceGeminiChat || billing.Semantic == dto.BillingUsageSemanticGemini) {
			out.UsageMetadata = *billing.GeminiUsageMetadata
			out.UsageMetadata.BillingUsage = dto.CloneBillingUsage(usage.BillingUsage)
		}
	}
}

func restoreIRResponsesTool(item *dto.ResponsesOutput, tools *convmeta.ResponsesToolState) {
	upstreamName := item.Name
	item.Namespace, item.Name = tools.ResponsesToolName(upstreamName)
	if !tools.IsCustomTool(upstreamName) {
		return
	}
	input := item.ArgumentsString()
	var object map[string]any
	if kitutil.UnmarshalJsonStr(input, &object) == nil {
		if raw, ok := object[convmeta.CustomToolInputArgument]; ok {
			if text, ok := raw.(string); ok {
				input = text
			} else if encoded, err := kitutil.Marshal(raw); err == nil {
				input = string(encoded)
			}
		}
	}
	item.Type = "custom_tool_call"
	item.Input, _ = kitutil.Marshal(input)
	item.Arguments = nil
}

func irConvertResponseChoices(ctx context.Context, info convmeta.Meta, from, target types.RelayFormat, response any) (any, bool, error) {
	type choice struct {
		index    int
		response any
	}
	var choices []choice
	switch from {
	case types.RelayFormatOpenAI:
		source, err := asOAIChatResponse(response)
		if err != nil {
			return nil, false, err
		}
		if len(source.Choices) <= 1 {
			return nil, false, nil
		}
		for _, item := range source.Choices {
			frame := *source
			frame.Choices = []dto.OpenAITextResponseChoice{item}
			choices = append(choices, choice{item.Index, &frame})
		}
	case types.RelayFormatGemini:
		source, err := asGeminiChatResponse(response)
		if err != nil {
			return nil, false, err
		}
		if len(source.Candidates) <= 1 {
			return nil, false, nil
		}
		for _, item := range source.Candidates {
			frame := *source
			frame.Candidates = []dto.GeminiChatCandidate{item}
			choices = append(choices, choice{int(item.Index), &frame})
		}
	default:
		return nil, false, nil
	}
	if target != types.RelayFormatOpenAI && target != types.RelayFormatGemini {
		return nil, true, fmt.Errorf("%s cannot represent multiple response choices", target)
	}
	var result any
	for _, choice := range choices {
		value, _, err := irResponseConverter(from, target)(ctx, info, choice.response)
		if err != nil {
			return nil, true, err
		}
		switch value := value.(type) {
		case *dto.OpenAITextResponse:
			for i := range value.Choices {
				value.Choices[i].Index = choice.index
			}
			if result == nil {
				result = value
			} else {
				out := result.(*dto.OpenAITextResponse)
				out.Choices = append(out.Choices, value.Choices...)
			}
		case *dto.GeminiChatResponse:
			for i := range value.Candidates {
				value.Candidates[i].Index = int64(choice.index)
			}
			if result == nil {
				result = value
			} else {
				out := result.(*dto.GeminiChatResponse)
				out.Candidates = append(out.Candidates, value.Candidates...)
			}
		}
	}
	return result, true, nil
}
