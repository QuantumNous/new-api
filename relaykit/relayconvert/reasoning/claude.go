package reasoning

import (
	"fmt"
	"math"
	"strings"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
)

type ClaudeRender struct {
	Thinking                  *dto.Thinking
	OutputEffort              Effort
	EffectiveEffort           Effort
	ClearSampling             bool
	ConstrainThinkingSampling bool
	// MaxTokens is set when manual thinking needed a larger max_tokens than
	// the request carried; callers apply it to the outgoing request.
	MaxTokens   *uint
	Diagnostics []types.ConversionDiagnostic
}

type claudeCapabilities struct {
	adaptive        bool
	supportsManual  bool
	defaultThinking bool
	supportsDisable bool
	// disableAsBetweenTools marks models whose lowest thinking setting is
	// {"type":"between_tools"} instead of {"type":"disabled"}.
	disableAsBetweenTools bool
	supportsEffort        bool
	supportsXHigh         bool
	supportsMax           bool
	strictSampling        bool
	// offEffortAtMostHigh marks models that accept effort high or below only
	// while thinking is off (disabled or between_tools).
	offEffortAtMostHigh bool
	// defaultEffort is the effort the model runs at when a request sets none:
	// medium on Claude Opus 5.5 and Haiku 5.5 and high on every other model
	// (https://platform.claude.com/docs/en/build-with-claude/effort).
	defaultEffort Effort
}

func claudeCapabilitiesFor(model string) claudeCapabilities {
	model = strings.ToLower(model)
	capabilities := claudeCapabilities{supportsManual: true, supportsDisable: true, defaultEffort: EffortHigh}

	switch {
	case strings.HasPrefix(model, "claude-fable-5"),
		strings.HasPrefix(model, "claude-mythos-5"):
		capabilities.adaptive = true
		capabilities.supportsManual = false
		capabilities.defaultThinking = true
		capabilities.supportsDisable = false
		capabilities.supportsEffort = true
		capabilities.supportsXHigh = true
		capabilities.supportsMax = true
		capabilities.strictSampling = true
	case strings.HasPrefix(model, "claude-mythos-preview"):
		capabilities.adaptive = true
		capabilities.defaultThinking = true
		capabilities.supportsDisable = false
		capabilities.supportsEffort = true
		capabilities.supportsMax = true
		capabilities.strictSampling = true
	case strings.HasPrefix(model, "claude-opus-5-5"),
		strings.HasPrefix(model, "claude-sonnet-5-5"):
		// Opus 5.5 cannot turn thinking off at all; Sonnet 5.5 turns it off
		// with between_tools, which takes effort high or below only.
		capabilities.adaptive = true
		capabilities.supportsManual = false
		capabilities.defaultThinking = true
		capabilities.supportsDisable = false
		capabilities.disableAsBetweenTools = strings.HasPrefix(model, "claude-sonnet-5-5")
		capabilities.offEffortAtMostHigh = capabilities.disableAsBetweenTools
		if strings.HasPrefix(model, "claude-opus-5-5") {
			capabilities.defaultEffort = EffortMedium
		}
		capabilities.supportsEffort = true
		capabilities.supportsXHigh = true
		capabilities.supportsMax = true
		capabilities.strictSampling = true
	case strings.HasPrefix(model, "claude-opus-5"),
		strings.HasPrefix(model, "claude-sonnet-5"),
		strings.HasPrefix(model, "claude-haiku-5"),
		strings.HasPrefix(model, "claude-opus-4-8"),
		strings.HasPrefix(model, "claude-opus-4-7"):
		capabilities.adaptive = true
		capabilities.supportsManual = false
		if strings.HasPrefix(model, "claude-opus-5") || strings.HasPrefix(model, "claude-sonnet-5") || strings.HasPrefix(model, "claude-haiku-5") {
			capabilities.defaultThinking = true
		}
		// Opus 5 and Haiku 5.5 reject disabled thinking with xhigh or max.
		capabilities.offEffortAtMostHigh = strings.HasPrefix(model, "claude-opus-5") || strings.HasPrefix(model, "claude-haiku-5")
		if strings.HasPrefix(model, "claude-haiku-5") {
			capabilities.defaultEffort = EffortMedium
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
	disabledWithEffort := intent.Mode == ModeDisabled && intent.Effort != "" && intent.Effort != EffortNone
	if disabledWithEffort {
		effort, err := ParseEffort(string(intent.Effort))
		if err != nil {
			return ClaudeRender{}, err
		}
		intent.Effort = effort
	}
	diagnostics := make([]types.ConversionDiagnostic, 0, 1)
	if !disabledWithEffort {
		var normalizeDiagnostics []types.ConversionDiagnostic
		var err error
		intent, normalizeDiagnostics, err = normalizeIntent(intent)
		if err != nil {
			return ClaudeRender{}, err
		}
		diagnostics = append(diagnostics, normalizeDiagnostics...)
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
				EffectiveEffort: capabilities.defaultEffort,
				ClearSampling:   capabilities.strictSampling,
			}, nil
		}
		if capabilities.defaultThinking {
			return ClaudeRender{EffectiveEffort: capabilities.defaultEffort, ClearSampling: capabilities.strictSampling}, nil
		}
		return ClaudeRender{ClearSampling: capabilities.strictSampling}, nil
	}

	if intent.Mode == ModeDisabled || intent.Effort == EffortNone {
		// Effort works without thinking, so a requested level is sent at one
		// the model accepts while thinking is off.
		outputEffort := Effort("")
		if disabledWithEffort && (capabilities.supportsDisable || capabilities.disableAsBetweenTools) {
			outputEffort = ClaudeEffort(model, intent.Effort)
			if capabilities.offEffortAtMostHigh && (outputEffort == EffortXHigh || outputEffort == EffortMax) {
				outputEffort = EffortHigh
			}
			diagnostics = append(diagnostics, claudeEffortDiagnostics(model, intent.Effort, outputEffort)...)
		}
		if capabilities.disableAsBetweenTools {
			// between_tools takes no other thinking field and runs at the
			// default effort or the requested one, both within its "high or
			// below" limit.
			diagnostics = append(diagnostics, claudeReasoningDiagnostic(
				"claude_thinking_disable_as_between_tools",
				fmt.Sprintf("model %q rejects disabled thinking; using between_tools, its lowest thinking setting", model),
			))
			return ClaudeRender{
				Thinking:        &dto.Thinking{Type: "between_tools"},
				OutputEffort:    outputEffort,
				EffectiveEffort: EffortNone,
				ClearSampling:   capabilities.strictSampling,
				Diagnostics:     diagnostics,
			}, nil
		}
		if !capabilities.supportsDisable {
			diagnostics = append(diagnostics, claudeReasoningDiagnostic(
				"claude_thinking_disable_unsupported",
				fmt.Sprintf("model %q cannot disable thinking; using the lowest representable thinking mode", model),
			))
			if capabilities.adaptive {
				thinking := &dto.Thinking{Type: "adaptive"}
				if intent.IncludeThoughts != nil {
					if *intent.IncludeThoughts {
						thinking.Display = "summarized"
					} else {
						thinking.Display = "omitted"
					}
				}
				effectiveEffort := capabilities.defaultEffort
				if capabilities.supportsEffort {
					outputEffort = EffortLow
					effectiveEffort = EffortLow
				}
				return ClaudeRender{
					Thinking:        thinking,
					OutputEffort:    outputEffort,
					EffectiveEffort: effectiveEffort,
					ClearSampling:   capabilities.strictSampling,
					Diagnostics:     diagnostics,
				}, nil
			}
			return ClaudeRender{Diagnostics: diagnostics}, nil
		}
		return ClaudeRender{
			Thinking:        &dto.Thinking{Type: "disabled"},
			OutputEffort:    outputEffort,
			EffectiveEffort: EffortNone,
			ClearSampling:   capabilities.strictSampling,
			Diagnostics:     diagnostics,
		}, nil
	}

	preferManual := capabilities.supportsManual && intent.BudgetTokens != nil && intent.Mode != ModeAdaptive
	if !capabilities.supportsManual && intent.BudgetTokens != nil && intent.Mode == ModeEnabled {
		diagnostics = append(diagnostics, claudeReasoningDiagnostic(
			"claude_budget_to_adaptive",
			fmt.Sprintf("model %q uses adaptive thinking; budget_tokens was converted to an effort level", model),
		))
	}
	if capabilities.adaptive && !preferManual {
		effort := intent.Effort
		if effort == "" && intent.BudgetTokens != nil {
			effort = EffortFromBudget(*intent.BudgetTokens)
		}
		if effort == "" && intent.Mode == ModeEnabled {
			effort = capabilities.defaultEffort
		}
		normalizedEffort := normalizeClaudeEffort(effort, capabilities)
		if effort != "" && normalizedEffort != effort {
			diagnostics = append(diagnostics, claudeReasoningDiagnostic(
				"claude_effort_adjusted",
				fmt.Sprintf("model %q does not support effort %q; using %q", model, effort, normalizedEffort),
			))
		}
		effort = normalizedEffort
		effectiveEffort := effort
		if effectiveEffort == "" && intent.Mode == ModeAdaptive {
			effectiveEffort = capabilities.defaultEffort
		}

		// Claude effort can be used without enabling thinking. Preserve that
		// distinction for native Claude requests; OpenAI extractors explicitly
		// mark reasoning efforts as ModeEnabled.
		if intent.Mode == ModeUnset {
			return ClaudeRender{
				OutputEffort:    effort,
				EffectiveEffort: effectiveEffort,
				ClearSampling:   capabilities.strictSampling,
				Diagnostics:     diagnostics,
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
			Diagnostics:               diagnostics,
		}, nil
	}

	if intent.Mode == ModeAdaptive {
		diagnostics = append(diagnostics, claudeReasoningDiagnostic(
			"claude_adaptive_to_manual",
			fmt.Sprintf("model %q does not support adaptive thinking; using manual thinking", model),
		))
		intent.Mode = ModeEnabled
		if intent.Effort == "" {
			intent.Effort = capabilities.defaultEffort
		}
	}
	if intent.Mode == ModeUnset {
		// Known models get the effort they accept. They think only when asked,
		// so a removed effort leaves none.
		effort := intent.Effort
		if isKnownClaudeModel(model) {
			effort = ClaudeEffort(model, intent.Effort)
			diagnostics = append(diagnostics, claudeEffortDiagnostics(model, intent.Effort, effort)...)
		}
		effectiveEffort := effort
		if effectiveEffort == "" {
			effectiveEffort = EffortNone
		}
		return ClaudeRender{OutputEffort: effort, EffectiveEffort: effectiveEffort, Diagnostics: diagnostics}, nil
	}
	var raisedMaxTokens *uint
	if maxTokens == nil || *maxTokens <= 1024 {
		// Manual thinking needs room above the 1024-token minimum budget.
		// Raising max_tokens keeps the request usable instead of rejecting it.
		raised := uint(1280)
		if intent.BudgetTokens != nil && *intent.BudgetTokens >= 0 && *intent.BudgetTokens < math.MaxInt32/2 {
			raised = max(raised, uint(*intent.BudgetTokens)+1)
		}
		current := "a missing max_tokens"
		if maxTokens != nil {
			current = fmt.Sprintf("max_tokens %d", *maxTokens)
		}
		diagnostics = append(diagnostics, claudeReasoningDiagnostic(
			"claude_max_tokens_raised",
			fmt.Sprintf("model %q requires max_tokens greater than 1024 for manual thinking; raised %s to %d", model, current, raised),
		))
		raisedMaxTokens = &raised
		maxTokens = &raised
	}
	if uint64(*maxTokens) > uint64(math.MaxInt) {
		return ClaudeRender{}, fmt.Errorf("max_tokens is too large for a thinking budget")
	}

	budget := 0
	if intent.BudgetTokens != nil && *intent.BudgetTokens >= 0 {
		requestedBudget := *intent.BudgetTokens
		budget = max(requestedBudget, 1024)
		if uint(budget) >= *maxTokens {
			budget = int(*maxTokens) - 1
		}
		if budget != requestedBudget {
			diagnostics = append(diagnostics, claudeReasoningDiagnostic(
				"claude_budget_adjusted",
				fmt.Sprintf("model %q requires 1024 <= budget_tokens < max_tokens; adjusted %d to %d", model, requestedBudget, budget),
			))
		}
	} else {
		if intent.BudgetTokens != nil {
			diagnostics = append(diagnostics, claudeReasoningDiagnostic(
				"claude_dynamic_budget_converted",
				fmt.Sprintf("model %q does not support a dynamic budget; derived a manual budget from reasoning effort", model),
			))
		}
		percentage := effortPercentage(intent.Effort, adapterBudgetPercentage)
		budget = max(int(*maxTokens)*percentage/100, 1024)
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
	outputEffort := ClaudeEffort(model, intent.Effort)
	if outputEffort != "" {
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
		MaxTokens:                 raisedMaxTokens,
		Diagnostics:               diagnostics,
	}, nil
}

func claudeReasoningDiagnostic(code string, message string) types.ConversionDiagnostic {
	return types.ConversionDiagnostic{
		Code:     code,
		Path:     "thinking",
		Message:  message,
		Severity: types.ConversionDiagnosticWarning,
		To:       types.RelayFormatClaude,
	}
}

// claudeEffortDiagnostics reports a requested effort that is sent at another
// level or removed because the model takes none.
func claudeEffortDiagnostics(model string, requested Effort, sent Effort) []types.ConversionDiagnostic {
	switch {
	case requested == "" || requested == EffortNone || requested == sent:
		return nil
	case sent == "":
		return []types.ConversionDiagnostic{claudeReasoningDiagnostic(
			"claude_effort_unsupported",
			fmt.Sprintf("model %q does not support effort %q; the effort was removed", model, requested),
		)}
	default:
		return []types.ConversionDiagnostic{claudeReasoningDiagnostic(
			"claude_effort_adjusted",
			fmt.Sprintf("model %q does not support effort %q with the selected thinking mode; using %q", model, requested, sent),
		)}
	}
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

// ClaudeDefaultEffort is the effort the model runs at when a request sets
// none.
func ClaudeDefaultEffort(model string) Effort {
	return claudeCapabilitiesFor(model).defaultEffort
}

// ClaudeEffort returns the effort level the model accepts in place of the
// requested one. It returns empty when no effort is requested or the model
// takes none, which includes models missing from the capability table.
func ClaudeEffort(model string, effort Effort) Effort {
	capabilities := claudeCapabilitiesFor(model)
	if !capabilities.supportsEffort || effort == "" || effort == EffortNone {
		return ""
	}
	return normalizeClaudeEffort(effort, capabilities)
}

// ResolveClaudeDefault makes the Claude model's default thinking explicit for
// a non-Claude target: no intent becomes adaptive thinking on models that
// think by default, and thinking without a strength takes the model's
// default effort.
func ResolveClaudeDefault(model string, intent Intent) Intent {
	capabilities := claudeCapabilitiesFor(model)
	switch {
	case !intent.HasStrength():
		if !capabilities.defaultThinking {
			return intent
		}
		intent.Mode = ModeAdaptive
		intent.Effort = capabilities.defaultEffort
	case intent.Effort == "" && intent.BudgetTokens == nil && (intent.Mode == ModeAdaptive || intent.Mode == ModeEnabled):
		intent.Effort = capabilities.defaultEffort
	}
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
