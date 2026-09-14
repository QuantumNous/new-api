package reasoning

import (
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/relaykit/dto"
	kitutil "github.com/QuantumNous/new-api/relaykit/relayconvert/kitutil"
)

type Effort string

const (
	EffortNone    Effort = "none"
	EffortMinimal Effort = "minimal"
	EffortLow     Effort = "low"
	EffortMedium  Effort = "medium"
	EffortHigh    Effort = "high"
	EffortXHigh   Effort = "xhigh"
	EffortMax     Effort = "max"
)

type Mode string

type Source string

// ClientError marks invalid user-supplied reasoning controls so host handlers
// can return a 4xx without classifying unrelated adapter failures as client
// errors.
type ClientError struct {
	err error
}

func (e *ClientError) Error() string { return e.err.Error() }
func (e *ClientError) Unwrap() error { return e.err }

func AsClientError(err error) error {
	if err == nil {
		return nil
	}
	var clientErr *ClientError
	if errors.As(err, &clientErr) {
		return err
	}
	return &ClientError{err: err}
}

func IsClientError(err error) bool {
	var clientErr *ClientError
	return errors.As(err, &clientErr)
}

const (
	ModeUnset    Mode = ""
	ModeEnabled  Mode = "enabled"
	ModeAdaptive Mode = "adaptive"
	ModeDisabled Mode = "disabled"
)

const (
	SourceExplicit Source = "explicit"
	SourceNative   Source = "native"
	SourceSuffix   Source = "suffix"
	SourcePivot    Source = "pivot"
)

var (
	ErrEffortConflict      = errors.New("reasoning settings conflict")
	ErrUnsupportedEffort   = errors.New("unsupported reasoning effort")
	ErrThinkingNotDisabled = errors.New("thinking cannot be disabled")
)

// Intent is the protocol-independent part of a request's reasoning controls.
// Summary visibility is intentionally independent from reasoning strength.
type Intent struct {
	Mode            Mode
	Effort          Effort
	BudgetTokens    *int
	IncludeThoughts *bool
	Source          Source
	BudgetSource    Source
}

func (i Intent) HasStrength() bool {
	return i.Mode != ModeUnset || i.Effort != "" || i.BudgetTokens != nil
}

func (i Intent) IsEmpty() bool {
	return !i.HasStrength() && i.IncludeThoughts == nil
}

// IntentFromState reconstructs a portable intent from host- or pivot-carried
// conversion state. A nil state is an empty intent.
func IntentFromState(state *dto.ReasoningConversionState) Intent {
	if state == nil {
		return Intent{}
	}
	return Intent{
		Mode:            Mode(state.Mode),
		Effort:          Effort(state.Effort),
		BudgetTokens:    state.BudgetTokens,
		IncludeThoughts: state.IncludeThoughts,
		Source:          SourceSuffix,
		BudgetSource:    SourceSuffix,
	}
}

// StateFromIntent copies the portable fields of an intent into conversion
// state. Empty intents produce nil so callers can omit the field.
func StateFromIntent(intent Intent) *dto.ReasoningConversionState {
	if intent.IsEmpty() {
		return nil
	}
	return &dto.ReasoningConversionState{
		Mode:            string(intent.Mode),
		Effort:          string(intent.Effort),
		BudgetTokens:    intent.BudgetTokens,
		IncludeThoughts: intent.IncludeThoughts,
	}
}

func ParseEffort(value string) (Effort, error) {
	effort := Effort(strings.ToLower(strings.TrimSpace(value)))
	if effort == "" {
		return "", nil
	}
	switch effort {
	case EffortNone, EffortMinimal, EffortLow, EffortMedium, EffortHigh, EffortXHigh, EffortMax:
		return effort, nil
	default:
		return "", fmt.Errorf("%w: %q", ErrUnsupportedEffort, value)
	}
}

func normalizeIntent(intent Intent) (Intent, error) {
	effort, err := ParseEffort(string(intent.Effort))
	if err != nil {
		return Intent{}, err
	}
	intent.Effort = effort

	switch intent.Mode {
	case ModeUnset, ModeEnabled, ModeAdaptive, ModeDisabled:
	default:
		return Intent{}, fmt.Errorf("unsupported reasoning mode %q", intent.Mode)
	}

	if intent.BudgetTokens != nil {
		budget := *intent.BudgetTokens
		if budget < -1 {
			return Intent{}, fmt.Errorf("thinking budget must be -1 or non-negative, got %d", budget)
		}
		if budget == 0 {
			if intent.Mode == ModeEnabled || intent.Mode == ModeAdaptive || (intent.Effort != "" && intent.Effort != EffortNone) {
				return Intent{}, fmt.Errorf("%w: zero budget disables thinking", ErrEffortConflict)
			}
			intent.Mode = ModeDisabled
			intent.Effort = EffortNone
		} else if intent.Mode == ModeDisabled || intent.Effort == EffortNone {
			return Intent{}, fmt.Errorf("%w: a non-zero budget enables thinking", ErrEffortConflict)
		} else if intent.Mode == ModeUnset {
			intent.Mode = ModeEnabled
		}
	}

	if intent.Effort == EffortNone {
		if intent.Mode == ModeEnabled || intent.Mode == ModeAdaptive {
			return Intent{}, fmt.Errorf("%w: effort none disables thinking", ErrEffortConflict)
		}
		intent.Mode = ModeDisabled
	}

	return intent, nil
}

// MergeExplicitAndSuffix combines structured request fields with a model-name
// alias. Contradictions are rejected because the alias may carry a distinct
// billing identity; silently choosing either side would make request semantics
// and accounting disagree.
func MergeExplicitAndSuffix(explicit Intent, suffix Intent, model string) (Intent, error) {
	var err error
	explicit, err = normalizeIntent(explicit)
	if err != nil {
		return Intent{}, err
	}
	suffix, err = normalizeIntent(suffix)
	if err != nil {
		return Intent{}, err
	}

	if !explicit.HasStrength() {
		if explicit.IncludeThoughts != nil {
			suffix.IncludeThoughts = explicit.IncludeThoughts
		}
		return suffix, nil
	}
	if !suffix.HasStrength() {
		if explicit.IncludeThoughts == nil {
			explicit.IncludeThoughts = suffix.IncludeThoughts
		}
		return explicit, nil
	}

	explicitDisabled := explicit.Mode == ModeDisabled || explicit.Effort == EffortNone
	suffixDisabled := suffix.Mode == ModeDisabled || suffix.Effort == EffortNone
	if explicitDisabled != suffixDisabled {
		return Intent{}, fmt.Errorf("%w for model %q: explicit fields and model suffix disagree about whether thinking is enabled", ErrEffortConflict, model)
	}
	if !explicitDisabled && explicit.Effort != "" && suffix.Effort != "" && explicit.Effort != suffix.Effort {
		return Intent{}, fmt.Errorf("%w for model %q: explicit effort %q differs from suffix effort %q", ErrEffortConflict, model, explicit.Effort, suffix.Effort)
	}
	if explicit.BudgetTokens != nil && suffix.BudgetTokens != nil && *explicit.BudgetTokens != *suffix.BudgetTokens {
		return Intent{}, fmt.Errorf("%w for model %q: explicit budget %d differs from suffix budget %d", ErrEffortConflict, model, *explicit.BudgetTokens, *suffix.BudgetTokens)
	}
	if (explicit.Effort != "" && explicit.Effort != EffortNone && suffix.BudgetTokens != nil) ||
		(explicit.BudgetTokens != nil && suffix.Effort != "" && suffix.Effort != EffortNone) {
		return Intent{}, fmt.Errorf("%w for model %q: effort and an exact suffix budget cannot both select reasoning strength", ErrEffortConflict, model)
	}

	merged := suffix
	if explicit.Mode != ModeUnset {
		merged.Mode = explicit.Mode
	}
	if explicit.Effort != "" {
		merged.Effort = explicit.Effort
	}
	if explicit.BudgetTokens != nil {
		merged.BudgetTokens = explicit.BudgetTokens
		merged.BudgetSource = explicit.BudgetSource
	}
	if explicit.IncludeThoughts != nil {
		merged.IncludeThoughts = explicit.IncludeThoughts
	}
	return normalizeIntent(merged)
}

// MergeExplicit combines two structured representations of the same request.
// A numeric budget and an effort may coexist: Claude and OpenRouter expose both
// controls, and keeping both is what lets an in-memory OpenAI pivot preserve an
// exact budget for budget-based targets while retaining an effort for
// level-based targets.
func MergeExplicit(primary Intent, secondary Intent, model string) (Intent, error) {
	var err error
	primary, err = normalizeIntent(primary)
	if err != nil {
		return Intent{}, err
	}
	secondary, err = normalizeIntent(secondary)
	if err != nil {
		return Intent{}, err
	}

	if primary.IsEmpty() {
		return secondary, nil
	}
	if secondary.IsEmpty() {
		return primary, nil
	}

	primaryDisabled := primary.Mode == ModeDisabled || primary.Effort == EffortNone
	secondaryDisabled := secondary.Mode == ModeDisabled || secondary.Effort == EffortNone
	if primary.HasStrength() && secondary.HasStrength() && primaryDisabled != secondaryDisabled {
		return Intent{}, fmt.Errorf("%w for model %q: explicit fields disagree about whether thinking is enabled", ErrEffortConflict, model)
	}
	if primary.Effort != "" && secondary.Effort != "" && primary.Effort != secondary.Effort {
		return Intent{}, fmt.Errorf("%w for model %q: explicit efforts %q and %q differ", ErrEffortConflict, model, primary.Effort, secondary.Effort)
	}
	if primary.BudgetTokens != nil && secondary.BudgetTokens != nil && *primary.BudgetTokens != *secondary.BudgetTokens {
		return Intent{}, fmt.Errorf("%w for model %q: explicit budgets %d and %d differ", ErrEffortConflict, model, *primary.BudgetTokens, *secondary.BudgetTokens)
	}

	merged := secondary
	if primary.Mode != ModeUnset {
		merged.Mode = primary.Mode
	}
	if primary.Effort != "" {
		merged.Effort = primary.Effort
	}
	if primary.BudgetTokens != nil {
		merged.BudgetTokens = primary.BudgetTokens
		merged.BudgetSource = primary.BudgetSource
	}
	if primary.IncludeThoughts != nil {
		merged.IncludeThoughts = primary.IncludeThoughts
	}
	return normalizeIntent(merged)
}

type openRouterReasoning struct {
	Enabled   *bool  `json:"enabled,omitempty"`
	Effort    string `json:"effort,omitempty"`
	MaxTokens *int   `json:"max_tokens,omitempty"`
	Exclude   *bool  `json:"exclude,omitempty"`
}

func FromOpenAIChat(req *dto.GeneralOpenAIRequest) (Intent, error) {
	if req == nil {
		return Intent{}, nil
	}

	var intent Intent
	intent.Source = SourceExplicit
	if req.ReasoningEffort != "" {
		effort, err := ParseEffort(req.ReasoningEffort)
		if err != nil {
			return Intent{}, err
		}
		intent.Effort = effort
		if effort == EffortNone {
			intent.Mode = ModeDisabled
		} else {
			intent.Mode = ModeEnabled
		}
	}

	if len(req.Reasoning) > 0 {
		var raw openRouterReasoning
		if err := kitutil.Unmarshal(req.Reasoning, &raw); err != nil {
			return Intent{}, fmt.Errorf("invalid reasoning config: %w", err)
		}
		nested := Intent{BudgetTokens: raw.MaxTokens, Source: SourceExplicit, BudgetSource: SourceExplicit}
		if raw.Enabled != nil {
			if *raw.Enabled {
				nested.Mode = ModeEnabled
			} else {
				nested.Mode = ModeDisabled
				nested.Effort = EffortNone
			}
		}
		if raw.Effort != "" {
			effort, err := ParseEffort(raw.Effort)
			if err != nil {
				return Intent{}, err
			}
			nested.Effort = effort
			if effort == EffortNone {
				nested.Mode = ModeDisabled
			} else if nested.Mode == ModeUnset {
				nested.Mode = ModeEnabled
			}
		}
		if raw.Exclude != nil {
			include := !*raw.Exclude
			nested.IncludeThoughts = &include
		}
		var err error
		intent, err = MergeExplicit(intent, nested, req.Model)
		if err != nil {
			return Intent{}, err
		}
	}

	if req.ReasoningConversion == nil {
		return normalizeIntent(intent)
	}
	pivot := Intent{
		Mode:            Mode(req.ReasoningConversion.Mode),
		Effort:          Effort(req.ReasoningConversion.Effort),
		BudgetTokens:    req.ReasoningConversion.BudgetTokens,
		IncludeThoughts: req.ReasoningConversion.IncludeThoughts,
		Source:          SourcePivot,
		BudgetSource:    SourcePivot,
	}
	if req.ReasoningEffort != "" {
		pivotEffort := EffectiveEffort(pivot)
		if Effort(req.ReasoningEffort) == pivotEffort {
			intent.Effort = ""
			intent.Mode = ModeUnset
		}
	}
	return MergeExplicit(intent, pivot, req.Model)
}

// ApplyToOpenAIChat writes the portable portion of an intent to the OpenAI
// pivot. reasoning_effort carries level-based strength; a JSON-excluded DTO
// state retains exact budgets and summary visibility across in-process steps.
func ApplyToOpenAIChat(req *dto.GeneralOpenAIRequest, intent Intent) error {
	if req == nil {
		return nil
	}
	intent, err := normalizeIntent(intent)
	if err != nil {
		return err
	}

	if effort := EffectiveEffort(intent); effort != "" {
		req.ReasoningEffort = string(effort)
	}

	if intent.IsEmpty() {
		return nil
	}
	req.ReasoningConversion = &dto.ReasoningConversionState{
		Mode:            string(intent.Mode),
		Effort:          string(intent.Effort),
		BudgetTokens:    intent.BudgetTokens,
		IncludeThoughts: intent.IncludeThoughts,
	}
	return nil
}

// ApplyToOpenAIResponses writes the portable portion of an intent directly to
// a Responses request. The JSON-excluded state retains exact provider-native
// controls for any later in-process conversion.
func ApplyToOpenAIResponses(req *dto.OpenAIResponsesRequest, intent Intent) error {
	if req == nil {
		return nil
	}
	intent, err := normalizeIntent(intent)
	if err != nil {
		return err
	}

	if effort := EffectiveEffort(intent); effort != "" {
		summary := "detailed"
		if effort == EffortNone || (intent.IncludeThoughts != nil && !*intent.IncludeThoughts) {
			summary = ""
		}
		req.Reasoning = &dto.Reasoning{
			Effort:  string(effort),
			Summary: summary,
		}
	}

	if intent.IsEmpty() {
		return nil
	}
	state := &dto.ReasoningConversionState{
		Mode:            string(intent.Mode),
		Effort:          string(intent.Effort),
		BudgetTokens:    intent.BudgetTokens,
		IncludeThoughts: intent.IncludeThoughts,
	}
	req.ReasoningConversion = state
	return nil
}

func FromOpenAIResponses(req *dto.OpenAIResponsesRequest) (Intent, error) {
	if req == nil {
		return Intent{}, nil
	}
	var intent Intent
	if req.Reasoning != nil {
		intent.Source = SourceExplicit
		if req.Reasoning.Effort != "" {
			effort, err := ParseEffort(req.Reasoning.Effort)
			if err != nil {
				return Intent{}, err
			}
			intent.Effort = effort
			intent.Mode = ModeEnabled
			if effort == EffortNone {
				intent.Mode = ModeDisabled
			}
		}
		if req.Reasoning.Summary != "" {
			include := true
			intent.IncludeThoughts = &include
		}
	}
	if req.ReasoningConversion == nil {
		return normalizeIntent(intent)
	}
	pivot := Intent{
		Mode:            Mode(req.ReasoningConversion.Mode),
		Effort:          Effort(req.ReasoningConversion.Effort),
		BudgetTokens:    req.ReasoningConversion.BudgetTokens,
		IncludeThoughts: req.ReasoningConversion.IncludeThoughts,
		Source:          SourcePivot,
		BudgetSource:    SourcePivot,
	}
	if req.Reasoning != nil && req.Reasoning.Effort != "" {
		pivotEffort := EffectiveEffort(pivot)
		if Effort(req.Reasoning.Effort) == pivotEffort {
			intent.Effort = ""
			intent.Mode = ModeUnset
		}
	}
	return MergeExplicit(intent, pivot, req.Model)
}

func FromClaude(req *dto.ClaudeRequest) (Intent, error) {
	if req == nil {
		return Intent{}, nil
	}
	var intent Intent
	intent.Source = SourceNative
	if req.Thinking != nil {
		switch req.Thinking.Type {
		case "", "enabled":
			intent.Mode = ModeEnabled
		case "adaptive":
			intent.Mode = ModeAdaptive
		case "disabled":
			intent.Mode = ModeDisabled
			intent.Effort = EffortNone
		default:
			return Intent{}, fmt.Errorf("unsupported Claude thinking type %q", req.Thinking.Type)
		}
		intent.BudgetTokens = req.Thinking.BudgetTokens
		if req.Thinking.BudgetTokens != nil {
			budget := *req.Thinking.BudgetTokens
			if budget < 1024 {
				return Intent{}, fmt.Errorf("Claude thinking budget_tokens must be at least 1024, got %d", budget)
			}
			if req.MaxTokens != nil && uint(budget) >= *req.MaxTokens {
				return Intent{}, fmt.Errorf("Claude thinking budget_tokens must be less than max_tokens")
			}
			intent.BudgetSource = SourceNative
		}
		switch req.Thinking.Display {
		case "summarized":
			include := true
			intent.IncludeThoughts = &include
		case "omitted":
			include := false
			intent.IncludeThoughts = &include
		}
	}
	if len(req.OutputConfig) > 0 {
		var output dto.OutputConfigForEffort
		if err := kitutil.Unmarshal(req.OutputConfig, &output); err != nil {
			return Intent{}, fmt.Errorf("invalid Claude output_config: %w", err)
		}
		if output.Effort != "" {
			effort, err := ParseEffort(output.Effort)
			if err != nil {
				return Intent{}, err
			}
			intent.Effort = effort
		}
	}
	if intent.Mode == ModeDisabled && intent.Effort != "" && intent.Effort != EffortNone {
		return intent, nil
	}
	return normalizeIntent(intent)
}

func FromGemini(req *dto.GeminiChatRequest) (Intent, error) {
	if req == nil || req.GenerationConfig.ThinkingConfig == nil {
		return Intent{}, nil
	}
	config := req.GenerationConfig.ThinkingConfig
	if config.ThinkingBudget != nil && config.ThinkingLevel != "" {
		return Intent{}, fmt.Errorf("%w: Gemini thinkingBudget and thinkingLevel cannot both be set", ErrEffortConflict)
	}
	intent := Intent{
		BudgetTokens:    config.ThinkingBudget,
		IncludeThoughts: config.IncludeThoughts,
		Source:          SourceNative,
		BudgetSource:    SourceNative,
	}
	if config.ThinkingLevel != "" {
		effort, err := ParseEffort(config.ThinkingLevel)
		if err != nil {
			return Intent{}, err
		}
		intent.Effort = effort
		intent.Mode = ModeEnabled
	}
	return normalizeIntent(intent)
}

func EffectiveEffort(intent Intent) Effort {
	intent, err := normalizeIntent(intent)
	if err != nil {
		return ""
	}
	if intent.Mode == ModeDisabled {
		return EffortNone
	}
	if intent.Effort != "" {
		return intent.Effort
	}
	if intent.BudgetTokens != nil {
		return EffortFromBudget(*intent.BudgetTokens)
	}
	if intent.Mode == ModeEnabled || intent.Mode == ModeAdaptive {
		return EffortHigh
	}
	return ""
}

func EffortFromBudget(budget int) Effort {
	if budget == 0 {
		return EffortNone
	}
	if budget < 0 {
		return EffortHigh
	}
	if budget <= 1024 {
		return EffortLow
	}
	if budget <= 8192 {
		return EffortMedium
	}
	return EffortHigh
}
