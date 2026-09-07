package claude

import (
	"fmt"
	"math"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/convmeta"
	kitutil "github.com/QuantumNous/new-api/relaykit/relayconvert/kitutil"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/reasoning"
)

func ApplyReasoning(req *dto.ClaudeRequest, info convmeta.Meta, source reasoning.Intent) error {
	if req == nil {
		return nil
	}

	native, err := reasoning.FromClaude(req)
	if err != nil {
		return err
	}
	explicit, err := reasoning.MergeExplicit(native, source, req.Model)
	if err != nil {
		return err
	}

	opts := convmeta.OptionsOf(info)
	baseModel := req.Model
	capabilityModel := baseModel
	suffix := reasoning.IntentFromState(convmeta.ReasoningStateOf(info))
	preserveSuffix := opts.ShouldPreserveThinkingSuffix(req.Model)
	if info != nil && opts.ShouldPreserveThinkingSuffix(info.GetOriginModelName()) {
		preserveSuffix = true
	}
	if preserveSuffix {
		suffix = reasoning.Intent{}
	}
	if info != nil && !reasoning.IsKnownClaudeModel(capabilityModel) && reasoning.IsKnownClaudeModel(info.GetOriginModelName()) {
		capabilityModel = info.GetOriginModelName()
	}
	intent, err := reasoning.MergeExplicitAndSuffix(explicit, suffix, req.Model)
	if err != nil {
		return err
	}
	knownClaudeModel := reasoning.IsKnownClaudeModel(capabilityModel)
	if source.IsEmpty() && suffix.IsEmpty() && !knownClaudeModel {
		// A native Messages request can target a non-Anthropic model through a
		// Claude-compatible proxy. Its capability vocabulary belongs to that
		// upstream, so preserve validated native controls instead of applying
		// Anthropic model rules to an unknown model name.
		if info != nil {
			if effort := reasoning.EffectiveEffort(intent); effort != "" {
				info.SetReasoningEffort(string(effort))
			}
		}
		return nil
	}
	if !knownClaudeModel && intent.Mode == reasoning.ModeAdaptive {
		// Cross-protocol pivots cannot safely assume that an unknown
		// Claude-compatible model implements Anthropic's adaptive mode. Render
		// the broadly supported manual form while retaining the requested
		// strength. Native Claude requests took the passthrough path above.
		intent.Mode = reasoning.ModeEnabled
		if intent.Effort == "" {
			intent.Effort = reasoning.EffortHigh
		}
	}
	if req.MaxTokens == nil && intent.HasStrength() {
		// Adapter-provided defaults may be raised to accommodate an exact
		// cross-protocol budget. Explicit client max_tokens values are never
		// expanded and remain subject to the renderer's strict validation.
		minimum := uint(1280)
		if configuredDefault, configured := opts.Claude.DefaultMaxTokensFor(capabilityModel); configured && configuredDefault > 0 {
			minimum = uint(configuredDefault)
		}
		if reasoning.ClaudeUsesManualThinking(capabilityModel, intent) && *intent.BudgetTokens >= 0 {
			if *intent.BudgetTokens == math.MaxInt {
				return fmt.Errorf("thinking budget is too large to derive max_tokens")
			}
			required := uint(*intent.BudgetTokens) + 1
			const maxDerivedTokens = uint(math.MaxInt32 / 2)
			if required > maxDerivedTokens {
				return fmt.Errorf("thinking budget %d exceeds the supported conversion limit", *intent.BudgetTokens)
			}
			if minimum < required {
				minimum = required
			}
		}
		req.MaxTokens = &minimum
	}

	rendered, err := reasoning.RenderClaude(capabilityModel, intent, req.MaxTokens, opts.Claude.ThinkingAdapterBudgetTokensPercentage)
	if err != nil {
		return err
	}
	req.Model = baseModel
	if rendered.Thinking != nil {
		req.Thinking = rendered.Thinking
	}
	if rendered.OutputEffort != "" {
		outputConfig := make(map[string]any)
		if len(req.OutputConfig) > 0 {
			if kitutil.GetJsonType(req.OutputConfig) != "object" {
				return fmt.Errorf("Claude output_config must be a JSON object")
			}
			if err := kitutil.Unmarshal(req.OutputConfig, &outputConfig); err != nil {
				return fmt.Errorf("invalid Claude output_config: %w", err)
			}
			if outputConfig == nil {
				outputConfig = make(map[string]any)
			}
		}
		outputConfig["effort"] = string(rendered.OutputEffort)
		encoded, err := kitutil.Marshal(outputConfig)
		if err != nil {
			return fmt.Errorf("failed to marshal Claude output_config: %w", err)
		}
		req.OutputConfig = encoded
	}
	if rendered.ClearSampling {
		req.Temperature = nil
		req.TopP = nil
		req.TopK = nil
	} else if rendered.ConstrainThinkingSampling {
		req.Temperature = nil
		req.TopK = nil
		if req.TopP != nil && (*req.TopP < 0.95 || *req.TopP > 1) {
			req.TopP = nil
		}
	}
	if info != nil && rendered.EffectiveEffort != "" {
		info.SetReasoningEffort(string(rendered.EffectiveEffort))
	}
	return nil
}
