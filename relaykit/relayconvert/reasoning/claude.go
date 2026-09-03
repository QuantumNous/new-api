package reasoning

import (
	"fmt"
	"math"
	"strings"

	"github.com/QuantumNous/new-api/relaykit/dto"
)

type ClaudeRender struct {
	Thinking                  *dto.Thinking
	OutputEffort              Effort
	EffectiveEffort           Effort
	ClearSampling             bool
	ConstrainThinkingSampling bool
}

type claudeCapabilities struct {
	adaptive        bool
	supportsManual  bool
	defaultThinking bool
	supportsDisable bool
	supportsEffort  bool
	supportsXHigh   bool
	supportsMax     bool
	strictSampling  bool
}

func claudeCapabilitiesFor(model string) claudeCapabilities {
	model = strings.ToLower(model)
	capabilities := claudeCapabilities{supportsManual: true, supportsDisable: true}

	switch {
	case strings.HasPrefix(model, "claude-fable-5"),
		strings.HasPrefix(model, "claude-mythos-5"):
		capabilities.adaptive = true
		capabilities.supportsManual = false
		capabilities.defaultThinking = true
		capabilities.supportsDisable = false
		capabilities.supportsXHigh = true
		capabilities.supportsMax = true
		capabilities.strictSampling = true
	case strings.HasPrefix(model, "claude-mythos-preview"):
		capabilities.adaptive = true
		capabilities.defaultThinking = true
		capabilities.supportsDisable = false
		capabilities.supportsMax = true
		capabilities.strictSampling = true
	case strings.HasPrefix(model, "claude-opus-5"),
		strings.HasPrefix(model, "claude-sonnet-5"),
		strings.HasPrefix(model, "claude-opus-4-8"),
		strings.HasPrefix(model, "claude-opus-4-7"):
		capabilities.adaptive = true
		capabilities.supportsManual = false
		if strings.HasPrefix(model, "claude-opus-5") || strings.HasPrefix(model, "claude-sonnet-5") {
			capabilities.defaultThinking = true
		}
		capabilities.supportsEffort = true
		capabilities.supportsXHigh = true
		capabilities.supportsMax = true
		capabilities.strictSampling = true
	case strings.HasPrefix(model, "claude-opus-4-6"),
		strings.HasPrefix(model, "claude-sonnet-4-6"):
		capabilities.adaptive = true
		capabilities.supportsEffort = true
		capabilities.supportsMax = true
	case strings.HasPrefix(model, "claude-opus-4-5"):
		capabilities.supportsEffort = true
	}

	return capabilities
}

func RenderClaude(model string, intent Intent, maxTokens *uint, adapterBudgetPercentage float64) (ClaudeRender, error) {
	if intent.Mode == ModeDisabled && intent.Effort != "" && intent.Effort != EffortNone {
		effort, err := ParseEffort(string(intent.Effort))
		if err != nil {
			return ClaudeRender{}, err
		}
		intent.Effort = effort
	} else {
		var err error
		intent, err = normalizeIntent(intent)
		if err != nil {
			return ClaudeRender{}, err
		}
	}
	capabilities := claudeCapabilitiesFor(model)
	if !intent.HasStrength() {
		if intent.IncludeThoughts != nil && capabilities.adaptive && capabilities.defaultThinking {
			thinking := &dto.Thinking{Type: "adaptive"}
			if *intent.IncludeThoughts {
				thinking.Display = "summarized"
			} else {
				thinking.Display = "omitted"
			}
			return ClaudeRender{
				Thinking:        thinking,
				EffectiveEffort: EffortHigh,
				ClearSampling:   capabilities.strictSampling,
			}, nil
		}
		if capabilities.defaultThinking {
			return ClaudeRender{EffectiveEffort: EffortHigh, ClearSampling: capabilities.strictSampling}, nil
		}
		return ClaudeRender{ClearSampling: capabilities.strictSampling}, nil
	}

	if intent.Mode == ModeDisabled || intent.Effort == EffortNone {
		if strings.HasPrefix(strings.ToLower(model), "claude-opus-5") &&
			(intent.Effort == EffortXHigh || intent.Effort == EffortMax) {
			return ClaudeRender{}, fmt.Errorf("model %q does not support effort %q while thinking is disabled", model, intent.Effort)
		}
		if !capabilities.supportsDisable {
			return ClaudeRender{}, fmt.Errorf("%w for model %q", ErrThinkingNotDisabled, model)
		}
		return ClaudeRender{
			Thinking:        &dto.Thinking{Type: "disabled"},
			EffectiveEffort: EffortNone,
			ClearSampling:   capabilities.strictSampling,
		}, nil
	}

	preferManual := capabilities.supportsManual && intent.BudgetTokens != nil && intent.Mode != ModeAdaptive
	if !capabilities.supportsManual && intent.BudgetTokens != nil && intent.BudgetSource == SourceNative && intent.Mode == ModeEnabled {
		return ClaudeRender{}, fmt.Errorf("model %q requires adaptive thinking and does not support native budget_tokens", model)
	}
	if capabilities.adaptive && !preferManual {
		effort := intent.Effort
		if effort == "" && intent.BudgetTokens != nil {
			effort = EffortFromBudget(*intent.BudgetTokens)
		}
		if effort == "" && intent.Mode == ModeEnabled {
			effort = EffortHigh
		}
		effort = normalizeClaudeEffort(effort, capabilities)
		effectiveEffort := effort
		if effectiveEffort == "" && intent.Mode == ModeAdaptive {
			effectiveEffort = EffortHigh
		}

		// Claude effort can be used without enabling thinking. Preserve that
		// distinction for native Claude requests; OpenAI extractors explicitly
		// mark reasoning efforts as ModeEnabled.
		if intent.Mode == ModeUnset {
			return ClaudeRender{
				OutputEffort:    effort,
				EffectiveEffort: effectiveEffort,
				ClearSampling:   capabilities.strictSampling,
			}, nil
		}

		thinking := &dto.Thinking{Type: "adaptive"}
		if intent.IncludeThoughts != nil {
			if *intent.IncludeThoughts {
				thinking.Display = "summarized"
			} else {
				thinking.Display = "omitted"
			}
		}
		return ClaudeRender{
			Thinking:                  thinking,
			OutputEffort:              effort,
			EffectiveEffort:           effectiveEffort,
			ClearSampling:             capabilities.strictSampling,
			ConstrainThinkingSampling: !capabilities.strictSampling,
		}, nil
	}

	if intent.Mode == ModeAdaptive {
		return ClaudeRender{}, fmt.Errorf("model %q does not support adaptive thinking", model)
	}
	if intent.Mode == ModeUnset {
		return ClaudeRender{OutputEffort: intent.Effort, EffectiveEffort: intent.Effort}, nil
	}
	if maxTokens == nil {
		return ClaudeRender{}, fmt.Errorf("max_tokens is required for manual Claude thinking")
	}
	if *maxTokens <= 1024 {
		return ClaudeRender{}, fmt.Errorf("max_tokens must be greater than 1024 for manual Claude thinking")
	}
	if uint64(*maxTokens) > uint64(math.MaxInt) {
		return ClaudeRender{}, fmt.Errorf("max_tokens is too large for a thinking budget")
	}

	budget := 0
	if intent.BudgetTokens != nil && *intent.BudgetTokens == -1 && intent.BudgetSource == SourceNative {
		return ClaudeRender{}, fmt.Errorf("Claude thinking budget_tokens does not support -1")
	}
	if intent.BudgetTokens != nil && *intent.BudgetTokens >= 0 {
		budget = *intent.BudgetTokens
		if intent.BudgetSource != SourceNative {
			if budget < 1024 {
				budget = 1024
			}
			if uint(budget) >= *maxTokens {
				budget = int(*maxTokens) - 1
			}
		}
		if budget < 1024 || uint(budget) >= *maxTokens {
			return ClaudeRender{}, fmt.Errorf("Claude thinking budget must satisfy 1024 <= budget_tokens < max_tokens")
		}
	} else {
		percentage := effortPercentage(intent.Effort, adapterBudgetPercentage)
		budget = int(*maxTokens) * percentage / 100
		if budget < 1024 {
			budget = 1024
		}
		if uint(budget) >= *maxTokens {
			budget = int(*maxTokens) - 1
		}
	}

	effectiveEffort := intent.Effort
	if intent.BudgetTokens != nil && !capabilities.supportsEffort {
		effectiveEffort = EffortFromBudget(budget)
	} else if effectiveEffort == "" {
		effectiveEffort = EffortFromBudget(budget)
	}
	outputEffort := Effort("")
	if capabilities.supportsEffort && intent.Effort != "" {
		outputEffort = normalizeClaudeEffort(intent.Effort, capabilities)
		effectiveEffort = outputEffort
	}
	thinking := &dto.Thinking{Type: "enabled", BudgetTokens: &budget}
	if intent.IncludeThoughts != nil {
		if *intent.IncludeThoughts {
			thinking.Display = "summarized"
		} else {
			thinking.Display = "omitted"
		}
	}
	return ClaudeRender{
		Thinking:                  thinking,
		OutputEffort:              outputEffort,
		EffectiveEffort:           effectiveEffort,
		ConstrainThinkingSampling: true,
	}, nil
}

// ClaudeUsesManualThinking reports whether an exact numeric budget is rendered
// as legacy extended thinking rather than being reduced to adaptive effort.
func ClaudeUsesManualThinking(model string, intent Intent) bool {
	capabilities := claudeCapabilitiesFor(model)
	return capabilities.supportsManual && intent.BudgetTokens != nil && intent.Mode != ModeAdaptive
}

func IsKnownClaudeModel(model string) bool {
	return isKnownClaudeModel(model)
}

func ResolveClaudeDefault(model string, intent Intent) Intent {
	if intent.HasStrength() || !claudeCapabilitiesFor(model).defaultThinking {
		return intent
	}
	intent.Mode = ModeAdaptive
	intent.Effort = EffortHigh
	return intent
}

func normalizeClaudeEffort(effort Effort, capabilities claudeCapabilities) Effort {
	switch effort {
	case EffortMinimal:
		return EffortLow
	case EffortXHigh:
		if capabilities.supportsXHigh {
			return effort
		}
		if capabilities.supportsMax {
			return EffortMax
		}
		return EffortHigh
	case EffortMax:
		if !capabilities.supportsMax {
			return EffortHigh
		}
	}
	return effort
}

func effortPercentage(effort Effort, adapterBudgetPercentage float64) int {
	switch effort {
	case EffortMinimal:
		return 5
	case EffortLow:
		return 20
	case EffortMedium:
		return 50
	case EffortHigh:
		return 80
	case EffortXHigh, EffortMax:
		return 95
	}
	percentage := int(math.Round(adapterBudgetPercentage * 100))
	if percentage <= 0 {
		return 80
	}
	if percentage >= 100 {
		return 99
	}
	return percentage
}
