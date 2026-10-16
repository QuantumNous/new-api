package relayconvert

import (
	"context"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/ir"
	"github.com/QuantumNous/new-api/relaykit/ir/project"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/convmeta"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/internal/convdiag"
	sharedclaude "github.com/QuantumNous/new-api/relaykit/relayconvert/internal/shared/claude"
	sharedgemini "github.com/QuantumNous/new-api/relaykit/relayconvert/internal/shared/gemini"
	kitutil "github.com/QuantumNous/new-api/relaykit/relayconvert/kitutil"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/reasoning"
	"github.com/QuantumNous/new-api/relaykit/types"
)

// irRequestConverter projects the message body once. The registry owns tool
// policy and host diagnostics around this projection, including vendor search.
func irRequestConverter(from, target types.RelayFormat) RequestConverterFunc {
	return func(ctx context.Context, info convmeta.Meta, request any) (any, error) {
		normalized, err := project.FromRequest(from, request)
		if err != nil {
			return nil, err
		}
		convdiag.Add(ctx, normalized.Diagnostics...)
		if normalized.Sample.N != nil && *normalized.Sample.N > 1 && target != types.RelayFormatOpenAI && target != types.RelayFormatGemini {
			return nil, fmt.Errorf("%s cannot represent multiple response choices", target)
		}
		if ext := normalized.Extensions.Responses; ext != nil {
			var fields []string
			if ext.PreviousResponseID != "" {
				fields = append(fields, "previous_response_id")
			}
			for _, field := range []struct {
				name string
				raw  []byte
			}{{"conversation", ext.Conversation}, {"prompt", ext.Prompt}, {"context_management", ext.ContextManagement}} {
				name, raw := field.name, field.raw
				if len(raw) > 0 && string(raw) != "null" {
					fields = append(fields, name)
				}
			}
			if len(fields) > 0 {
				return nil, fmt.Errorf("cross-protocol conversion does not support stateful fields: %s", strings.Join(fields, ", "))
			}
		}
		if normalized.Model == "" {
			normalized.Model = convmeta.UpstreamModelName(info)
		}
		if info != nil && info.GetIsStream() {
			normalized.Stream = true
		}
		if err := normalizeRequestMedia(ctx, from, target, normalized); err != nil {
			return nil, err
		}
		toolNames := make(map[string]string)
		for i := range normalized.Messages {
			for j := range normalized.Messages[i].Blocks {
				block := &normalized.Messages[i].Blocks[j]
				if block.ToolUse != nil {
					if _, exists := toolNames[block.ToolUse.ID]; !exists {
						toolNames[block.ToolUse.ID] = block.ToolUse.Name
					}
				}
			}
		}
		for i := range normalized.Messages {
			for j := range normalized.Messages[i].Blocks {
				block := &normalized.Messages[i].Blocks[j]
				if block.ToolResult != nil && block.ToolResult.Name == "" {
					block.ToolResult.Name = toolNames[block.ToolResult.ToolUseID]
				}
			}
		}
		// Rendering uses the current model capability rules and the original
		// portable intent, rather than a second protocol's approximated effort.
		intent, err := irSourceReasoning(ctx, info, from, request, normalized)
		if err != nil {
			return nil, reasoning.AsClientError(err)
		}
		normalized.Think = ir.ThinkFromIntent(intent)
		if normalized.Think != nil && target == types.RelayFormatOpenAIResponses && from != types.RelayFormatOpenAIResponses && normalized.Think.Display == ir.ThinkDisplayAuto {
			normalized.Think.Display = ir.ThinkDisplayDetailed
		}
		if info != nil && reasoning.EffectiveEffort(intent) != "" {
			info.SetReasoningEffort(string(reasoning.EffectiveEffort(intent)))
		}
		if target == types.RelayFormatClaude || target == types.RelayFormatGemini {
			normalized.Think = nil
		}
		converted, err := project.ToRequest(target, normalized)
		if err != nil {
			return nil, err
		}
		opts := convmeta.OptionsOf(info)
		switch req := converted.(type) {
		case *dto.GeneralOpenAIRequest:
			if opts.OpenRouterDialect && strings.HasPrefix(req.Model, "anthropic/claude") {
				var system []dto.MediaContent
				for _, message := range normalized.Messages {
					if message.Role != ir.RoleSystem {
						continue
					}
					for _, block := range message.Blocks {
						if block.Text == nil {
							continue
						}
						part := dto.MediaContent{Type: "text", Text: block.Text.Text}
						if block.Text.CacheControl != nil {
							part.CacheControl, _ = kitutil.Marshal(block.Text.CacheControl)
						}
						system = append(system, part)
					}
				}
				if len(system) > 0 {
					for i := range req.Messages {
						if req.Messages[i].Role == "system" {
							req.Messages[i].SetMediaContent(system)
							break
						}
					}
				}
			}
			if opts.OpenRouterDialect && !intent.IsEmpty() {
				enabled := intent.Mode != reasoning.ModeDisabled && intent.Effort != reasoning.EffortNone
				config := map[string]any{"enabled": enabled}
				if enabled && intent.BudgetTokens != nil && intent.Mode != reasoning.ModeAdaptive {
					config["max_tokens"] = *intent.BudgetTokens
				} else if enabled {
					config["effort"] = string(reasoning.EffectiveEffort(intent))
				}
				if intent.IncludeThoughts != nil {
					config["exclude"] = !*intent.IncludeThoughts
				}
				req.Reasoning, err = kitutil.Marshal(config)
				if err != nil {
					return nil, err
				}
				req.ReasoningEffort = ""
				if from == types.RelayFormatClaude {
					if native, ok := request.(*dto.ClaudeRequest); ok && native.GetEfforts() != "" {
						req.Verbosity, _ = kitutil.Marshal(native.GetEfforts())
					}
				}
			} else if from == types.RelayFormatClaude && info != nil && strings.HasSuffix(info.GetOriginModelName(), "-thinking") && !strings.HasSuffix(req.Model, "-thinking") {
				req.Model += "-thinking"
			}
		case *dto.ClaudeRequest:
			if err := sharedclaude.ApplyReasoning(ctx, req, info, intent, true); err != nil {
				return nil, reasoning.AsClientError(err)
			}
			if req.MaxTokens == nil {
				if value, ok := opts.Claude.DefaultMaxTokensFor(req.Model); ok && value >= 0 {
					req.MaxTokens = kitutil.GetPointer(uint(value))
				}
			}
			if req.MaxTokens == nil {
				return nil, sharedclaude.ErrMissingMaxTokens
			}
			if len(req.Messages) == 0 {
				req.Messages = []dto.ClaudeMessage{{Role: "user", Content: "..."}}
			}
		case *dto.GeminiChatRequest:
			if from == types.RelayFormatOpenAI {
				var native dto.GeneralOpenAIRequest
				switch value := request.(type) {
				case *dto.GeneralOpenAIRequest:
					native = *value
				case dto.GeneralOpenAIRequest:
					native = value
				}
				if err := sharedgemini.ApplyGoogleExtraBody(req, native.ExtraBody); err != nil {
					return nil, err
				}
			}
			if opts.Gemini.SupportsImagineModel(convmeta.UpstreamModelName(info)) {
				req.GenerationConfig.ResponseModalities = []string{"TEXT", "IMAGE"}
			}
			if len(req.GenerationConfig.StopSequences) > 5 {
				req.GenerationConfig.StopSequences = req.GenerationConfig.StopSequences[:5]
			}

			// This small carrier is the existing reasoning API's portable input;
			// message and tool conversion never passes through Chat.
			carrier := dto.GeneralOpenAIRequest{Model: normalized.Model}
			if err := reasoning.ApplyToOpenAIChat(&carrier, intent); err != nil {
				return nil, reasoning.AsClientError(err)
			}
			if err := sharedgemini.ApplyThinkingConfig(ctx, req, info, carrier); err != nil {
				return nil, reasoning.AsClientError(err)
			}
			for _, category := range sharedgemini.SafetySettingCategories {
				if threshold := opts.Gemini.SafetySettingFor(category); threshold != "" {
					req.SafetySettings = append(req.SafetySettings, dto.GeminiChatSafetySettings{Category: category, Threshold: threshold})
				}
			}
			if normalized.Format != nil && len(normalized.Format.Schema) > 0 {
				req.GenerationConfig.ResponseMimeType = "application/json"
				sharedgemini.ApplyResponseSchema(ctx, &req.GenerationConfig, normalized.Format.Schema, "response_format.json_schema.schema", opts.Gemini.SupportsJSONSchemaModel(normalized.Model))
			}
			for i := range req.Contents {
				for j := range req.Contents[i].Parts {
					part := &req.Contents[i].Parts[j]
					if part.FunctionCall != nil && len(part.ThoughtSignature) == 0 {
						sharedgemini.AttachThoughtSignatureBypass(opts, part)
					}
				}
			}
		}
		return converted, nil
	}
}

// irSourceReasoning resolves native defaults before target-model rendering.
func irSourceReasoning(ctx context.Context, info convmeta.Meta, from types.RelayFormat, request any, normalized *ir.Request) (reasoning.Intent, error) {
	intent := normalized.Think.Intent()
	if from != types.RelayFormatClaude && from != types.RelayFormatGemini {
		return intent, nil
	}
	sourceModel := normalized.Model
	if info != nil && info.GetOriginModelName() != "" {
		sourceModel = info.GetOriginModelName()
	}
	opts := convmeta.OptionsOf(info)
	preserve := opts.ShouldPreserveThinkingSuffix(sourceModel)
	base := sourceModel
	if from == types.RelayFormatGemini {
		if !preserve {
			base = reasoning.ParseModelModifiers(sourceModel).Base
			if parsed, _, found, err := reasoning.ParseGeminiModelSuffix(base, opts.Gemini.ThinkingAdapterEnabled); err == nil && found {
				base = parsed
			}
		}
		var native dto.GeminiChatRequest
		switch value := request.(type) {
		case *dto.GeminiChatRequest:
			native = *value
		case dto.GeminiChatRequest:
			native = value
		}
		if base != "" && native.GenerationConfig.ThinkingConfig != nil {
			_, diagnostics, err := reasoning.NormalizeGeminiThinkingConfig(base, &native.GenerationConfig)
			if err != nil {
				return intent, err
			}
			convdiag.Add(ctx, diagnostics...)
		}
		var diagnostics []types.ConversionDiagnostic
		var err error
		intent, diagnostics, err = reasoning.FromGemini(&native)
		if err != nil {
			return intent, err
		}
		convdiag.Add(ctx, diagnostics...)
	}
	if !preserve {
		if suffix := reasoning.IntentFromState(convmeta.ReasoningStateOf(info)); !suffix.IsEmpty() {
			merged, diagnostics, err := reasoning.MergeExplicitAndSuffix(intent, suffix, sourceModel)
			if err != nil {
				return intent, err
			}
			convdiag.Add(ctx, diagnostics...)
			intent = merged
		}
	}
	if from == types.RelayFormatGemini {
		return reasoning.ResolveGeminiDefault(base, intent), nil
	}
	return reasoning.ResolveClaudeDefault(sourceModel, intent), nil
}
