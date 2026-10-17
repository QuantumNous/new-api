package reasoning

import (
	"fmt"
	"math"
	"strings"

	"github.com/QuantumNous/new-api/relaykit/dto"
)

type GeminiRender struct {
	Config          *dto.GeminiThinkingConfig
	EffectiveEffort Effort
}

type geminiThinkingKind int

const (
	geminiThinkingUnknown geminiThinkingKind = iota
	geminiThinkingNotConfigurable
	geminiThinkingBudget
	geminiThinkingLevel
)

type geminiCapabilities struct {
	kind                    geminiThinkingKind
	supportsDisable         bool
	supportsIncludeThoughts bool
	minBudget               int
	maxBudget               int
}

func geminiCapabilitiesFor(model string) geminiCapabilities {
	model = strings.ToLower(model)
	switch {
	case strings.HasPrefix(model, "gemini-2.5-flash-native-audio"),
		strings.HasPrefix(model, "gemini-live-2.5-flash-preview-native-audio"):
		return geminiCapabilities{kind: geminiThinkingBudget, supportsDisable: true, maxBudget: 24576}
	case strings.HasPrefix(model, "gemini-2.5-flash-image"),
		strings.Contains(model, "-tts"),
		strings.Contains(model, "-native-audio"),
		strings.Contains(model, "-live"):
		return geminiCapabilities{kind: geminiThinkingNotConfigurable}
	case strings.HasPrefix(model, "gemini-3-pro-image"),
		strings.HasPrefix(model, "nano-banana-pro"):
		return geminiCapabilities{kind: geminiThinkingNotConfigurable, supportsIncludeThoughts: true}
	case model == "gemini-flash-latest", model == "gemini-flash-lite-latest":
		return geminiCapabilities{kind: geminiThinkingLevel}
	case model == "gemini-pro-latest":
		return geminiCapabilities{kind: geminiThinkingLevel}
	case strings.HasPrefix(model, "gemini-2.5-pro"):
		return geminiCapabilities{kind: geminiThinkingBudget, minBudget: 128, maxBudget: 32768}
	case strings.HasPrefix(model, "gemini-2.5-flash-lite"):
		return geminiCapabilities{kind: geminiThinkingBudget, supportsDisable: true, minBudget: 512, maxBudget: 24576}
	case strings.HasPrefix(model, "gemini-2.5-"):
		return geminiCapabilities{kind: geminiThinkingBudget, supportsDisable: true, maxBudget: 24576}
	case strings.HasPrefix(model, "gemini-3"):
		return geminiCapabilities{kind: geminiThinkingLevel}
	default:
		return geminiCapabilities{}
	}
}

func RenderGemini(model string, intent Intent, maxOutputTokens *uint, adapterBudgetPercentage float64) (GeminiRender, error) {
	intent, err := normalizeIntent(intent)
	if err != nil {
		return GeminiRender{}, err
	}
	if intent.IsEmpty() {
		return GeminiRender{}, nil
	}

	capabilities := geminiCapabilitiesFor(model)
	if capabilities.kind == geminiThinkingNotConfigurable {
		if !intent.HasStrength() && capabilities.supportsIncludeThoughts {
			return GeminiRender{Config: &dto.GeminiThinkingConfig{IncludeThoughts: intent.IncludeThoughts}, EffectiveEffort: EffortHigh}, nil
		}
		return GeminiRender{}, fmt.Errorf("model %q does not support configurable thinking", model)
	}
	if capabilities.kind == geminiThinkingUnknown {
		if intent.HasStrength() {
			return GeminiRender{}, fmt.Errorf("model %q does not have a known Gemini thinking configuration", model)
		}
		return GeminiRender{Config: &dto.GeminiThinkingConfig{IncludeThoughts: intent.IncludeThoughts}}, nil
	}

	config := &dto.GeminiThinkingConfig{IncludeThoughts: intent.IncludeThoughts}
	if capabilities.kind == geminiThinkingBudget {
		if intent.Mode == ModeDisabled || intent.Effort == EffortNone {
			if !capabilities.supportsDisable {
				return GeminiRender{}, fmt.Errorf("%w for model %q", ErrThinkingNotDisabled, model)
			}
			budget := 0
			config.ThinkingBudget = &budget
			return GeminiRender{Config: config, EffectiveEffort: EffortNone}, nil
		}

		budget := 0
		hasBudget := false
		if intent.BudgetTokens != nil {
			budget = *intent.BudgetTokens
			if intent.BudgetSource != SourceNative && budget != -1 {
				budget = clampGeminiBudget(budget, capabilities)
			}
			hasBudget = true
		} else if intent.Effort != "" {
			budget = gemini25BudgetForEffort(intent.Effort)
			hasBudget = true
		} else if intent.Mode != ModeUnset && maxOutputTokens != nil && *maxOutputTokens > 0 {
			if uint64(*maxOutputTokens) > uint64(math.MaxInt) {
				return GeminiRender{}, fmt.Errorf("max_output_tokens is too large for a thinking budget")
			}
			percentage := adapterBudgetPercentage
			if percentage <= 0 {
				percentage = 0.6
			} else if percentage > 1 {
				percentage = 1
			}
			budget = int(math.Round(float64(*maxOutputTokens) * percentage))
			budget = clampGeminiBudget(budget, capabilities)
			hasBudget = true
		}
		if hasBudget {
			if err := validateGeminiBudget(model, budget, capabilities); err != nil {
				return GeminiRender{}, err
			}
			config.ThinkingBudget = &budget
		}
		effort := intent.Effort
		if hasBudget {
			effort = EffortFromBudget(budget)
		} else if intent.Mode == ModeEnabled || intent.Mode == ModeAdaptive {
			effort = geminiDefaultEffort(model)
		}
		return GeminiRender{Config: config, EffectiveEffort: effort}, nil
	}

	if intent.Mode == ModeDisabled || intent.Effort == EffortNone {
		return GeminiRender{}, fmt.Errorf("%w for model %q", ErrThinkingNotDisabled, model)
	}
	effort := intent.Effort
	if effort == "" && intent.BudgetTokens != nil {
		effort = EffortFromBudget(*intent.BudgetTokens)
	}
	if effort != "" {
		level, err := geminiLevelForEffort(model, effort)
		if err != nil {
			return GeminiRender{}, err
		}
		config.ThinkingLevel = level
		effort = Effort(level)
	} else if intent.Mode == ModeEnabled || intent.Mode == ModeAdaptive {
		effort = geminiDefaultEffort(model)
	}
	return GeminiRender{Config: config, EffectiveEffort: effort}, nil
}

func geminiDefaultEffort(model string) Effort {
	model = strings.ToLower(model)
	switch {
	case model == "gemini-flash-latest",
		strings.HasPrefix(model, "gemini-3.5-flash") && !strings.HasPrefix(model, "gemini-3.5-flash-lite"),
		strings.HasPrefix(model, "gemini-3.6-flash"):
		return EffortMedium
	case model == "gemini-flash-lite-latest",
		strings.HasPrefix(model, "gemini-3.5-flash-lite"),
		strings.HasPrefix(model, "gemini-3.1-flash-lite"):
		return EffortMinimal
	case model == "gemini-pro-latest",
		strings.HasPrefix(model, "gemini-3.1-pro"),
		strings.HasPrefix(model, "gemini-3-pro"),
		strings.HasPrefix(model, "gemini-3-flash"):
		return EffortHigh
	default:
		return ""
	}
}

func ValidateGeminiThinkingConfig(model string, config *dto.GeminiThinkingConfig) (Effort, error) {
	if config == nil {
		return "", nil
	}
	intent, err := FromGemini(&dto.GeminiChatRequest{GenerationConfig: dto.GeminiChatGenerationConfig{ThinkingConfig: config}})
	if err != nil {
		return "", err
	}
	capabilities := geminiCapabilitiesFor(model)
	if capabilities.kind == geminiThinkingNotConfigurable {
		if !intent.HasStrength() && capabilities.supportsIncludeThoughts {
			return EffortHigh, nil
		}
		return "", fmt.Errorf("model %q does not support configurable thinking", model)
	}
	if capabilities.kind == geminiThinkingUnknown {
		return EffectiveEffort(intent), nil
	}
	if capabilities.kind == geminiThinkingBudget {
		if config.ThinkingLevel != "" {
			return "", fmt.Errorf("Gemini 2.5 model %q requires thinkingBudget, not thinkingLevel", model)
		}
		if config.ThinkingBudget != nil {
			if err := validateGeminiBudget(model, *config.ThinkingBudget, capabilities); err != nil {
				return "", err
			}
		}
		return EffectiveEffort(intent), nil
	}
	if config.ThinkingBudget != nil {
		return "", fmt.Errorf("Gemini 3 model %q requires thinkingLevel, not thinkingBudget", model)
	}
	if config.ThinkingLevel != "" {
		level, err := geminiLevelForEffort(model, intent.Effort)
		if err != nil {
			return "", err
		}
		if level != config.ThinkingLevel {
			return "", fmt.Errorf("thinkingLevel %q is not supported by model %q", config.ThinkingLevel, model)
		}
		return Effort(level), nil
	}
	return "", nil
}

// ResolveGeminiDefault materializes documented family defaults when a
// conversion targets another protocol. Dynamic 2.5 defaults retain their -1
// budget in the in-process pivot; Flash-Lite's default is explicitly off.
func ResolveGeminiDefault(model string, intent Intent) Intent {
	if intent.HasStrength() {
		return intent
	}
	capabilities := geminiCapabilitiesFor(model)
	if capabilities.kind == geminiThinkingBudget {
		if strings.HasPrefix(strings.ToLower(model), "gemini-2.5-flash-lite") {
			budget := 0
			intent.Mode = ModeDisabled
			intent.Effort = EffortNone
			intent.BudgetTokens = &budget
			intent.BudgetSource = SourceNative
			return intent
		}
		budget := -1
		intent.Mode = ModeEnabled
		intent.BudgetTokens = &budget
		intent.BudgetSource = SourceNative
		return intent
	}
	if capabilities.kind != geminiThinkingLevel {
		return intent
	}
	effort := geminiDefaultEffort(model)
	if effort == "" {
		return intent
	}
	intent.Mode = ModeEnabled
	intent.Effort = effort
	return intent
}

// ResolveGeminiEnabledDefault fills the strength implied by an explicit
// enable-only control such as the legacy -thinking model alias.
func ResolveGeminiEnabledDefault(model string, intent Intent, maxOutputTokens *uint) Intent {
	if intent.Mode != ModeEnabled || intent.Effort != "" || intent.BudgetTokens != nil {
		return intent
	}
	capabilities := geminiCapabilitiesFor(model)
	if capabilities.kind == geminiThinkingBudget {
		if intent.Source == SourceSuffix && maxOutputTokens != nil && *maxOutputTokens > 0 {
			return intent
		}
		budget := -1
		intent.BudgetTokens = &budget
		intent.BudgetSource = SourceSuffix
		return intent
	}
	if capabilities.kind == geminiThinkingLevel {
		intent.Effort = geminiDefaultEffort(model)
	}
	return intent
}

// EquivalentGeminiStrength compares two controls after applying the target
// model's budget/level mapping. This accepts distinct canonical labels that
// are identical on the Gemini wire (for example minimal and low on 2.5).
func EquivalentGeminiStrength(model string, left Intent, right Intent) (bool, error) {
	leftRendered, err := RenderGemini(model, left, nil, 0)
	if err != nil {
		return false, err
	}
	rightRendered, err := RenderGemini(model, right, nil, 0)
	if err != nil {
		return false, err
	}
	if leftRendered.Config == nil || rightRendered.Config == nil {
		return leftRendered.Config == nil && rightRendered.Config == nil, nil
	}
	leftConfig, rightConfig := leftRendered.Config, rightRendered.Config
	if leftConfig.ThinkingLevel != rightConfig.ThinkingLevel {
		return false, nil
	}
	if (leftConfig.ThinkingBudget == nil) != (rightConfig.ThinkingBudget == nil) {
		return false, nil
	}
	return leftConfig.ThinkingBudget == nil || *leftConfig.ThinkingBudget == *rightConfig.ThinkingBudget, nil
}

func gemini25BudgetForEffort(effort Effort) int {
	switch effort {
	case EffortMinimal, EffortLow:
		return 1024
	case EffortMedium:
		return 8192
	case EffortHigh, EffortXHigh, EffortMax:
		return 24576
	default:
		return 0
	}
}

func geminiLevelForEffort(model string, effort Effort) (string, error) {
	model = strings.ToLower(model)
	switch {
	case strings.HasPrefix(model, "gemini-3.1-flash-image"),
		strings.HasPrefix(model, "gemini-3.1-flash-lite-image"):
		if effort == EffortMinimal || effort == EffortLow {
			return string(EffortMinimal), nil
		}
		return string(EffortHigh), nil
	case (strings.HasPrefix(model, "gemini-3-pro") && !strings.HasPrefix(model, "gemini-3.1-pro")):
		if effort == EffortMinimal || effort == EffortLow {
			return string(EffortLow), nil
		}
		return string(EffortHigh), nil
	case strings.HasPrefix(model, "gemini-3.1-pro"), model == "gemini-pro-latest":
		if effort == EffortMinimal {
			return string(EffortLow), nil
		}
	}
	switch effort {
	case EffortMinimal, EffortLow, EffortMedium, EffortHigh:
		return string(effort), nil
	case EffortXHigh, EffortMax:
		return string(EffortHigh), nil
	case EffortNone:
		return "", fmt.Errorf("%w for model %q", ErrThinkingNotDisabled, model)
	default:
		return "", fmt.Errorf("%w %q for model %q", ErrUnsupportedEffort, effort, model)
	}
}

func validateGeminiBudget(model string, budget int, capabilities geminiCapabilities) error {
	if budget == -1 {
		return nil
	}
	if budget == 0 {
		if capabilities.supportsDisable {
			return nil
		}
		return fmt.Errorf("%w for model %q", ErrThinkingNotDisabled, model)
	}
	if budget < capabilities.minBudget || budget > capabilities.maxBudget {
		return fmt.Errorf("thinking budget %d is outside the supported range [%d,%d] for model %q", budget, capabilities.minBudget, capabilities.maxBudget, model)
	}
	return nil
}

func clampGeminiBudget(budget int, capabilities geminiCapabilities) int {
	if budget < capabilities.minBudget {
		return capabilities.minBudget
	}
	if budget > capabilities.maxBudget {
		return capabilities.maxBudget
	}
	return budget
}
