package convmeta

// Options is the per-request snapshot of host configuration that converters
// consult. The host fills it from its settings system when constructing the
// Meta (see relaycommon.RelayInfo.ConvOptions); relaykit users fill it
// directly. Zero value = every adaptation disabled, no defaults applied.
type Options struct {
	Claude ClaudeOptions
	Gemini GeminiOptions

	// PreserveThinkingSuffix reports models whose -thinking/-nothinking/effort
	// suffix must be kept on the outgoing model name (host blacklist lookup).
	// Nil means "never preserve".
	PreserveThinkingSuffix func(modelName string) bool
}

type ClaudeOptions struct {
	// ThinkingAdapterEnabled turns "-thinking"-suffixed OpenAI model names
	// into Claude extended-thinking requests.
	ThinkingAdapterEnabled bool
	// ThinkingAdapterBudgetTokensPercentage sizes thinking budget_tokens as a
	// fraction of max_tokens when the adapter fires.
	ThinkingAdapterBudgetTokensPercentage float64
	// DefaultMaxTokens returns the max_tokens to inject when the source
	// request carries none. Nil disables injection.
	DefaultMaxTokens func(modelName string) int
}

type GeminiOptions struct {
	// ThinkingAdapterEnabled maps -thinking/-nothinking/effort suffixes to
	// Gemini thinkingConfig.
	ThinkingAdapterEnabled bool
	// ThinkingAdapterBudgetTokensPercentage sizes thinkingBudget as a fraction
	// of maxOutputTokens when the adapter fires.
	ThinkingAdapterBudgetTokensPercentage float64
	// FunctionCallThoughtSignatureEnabled attaches thoughtSignature bypass
	// values to function-call parts.
	FunctionCallThoughtSignatureEnabled bool
	// SupportsImagine reports whether the model supports image generation
	// (switches response modalities). Nil means "never".
	SupportsImagine func(modelName string) bool
	// SafetySetting returns the harm threshold for a category. Nil or empty
	// return means no safetySettings are attached.
	SafetySetting func(category string) string
}

func (o *ClaudeOptions) DefaultMaxTokensFor(modelName string) int {
	if o == nil || o.DefaultMaxTokens == nil {
		return 0
	}
	return o.DefaultMaxTokens(modelName)
}

func (o *GeminiOptions) SupportsImagineModel(modelName string) bool {
	return o != nil && o.SupportsImagine != nil && o.SupportsImagine(modelName)
}

func (o *GeminiOptions) SafetySettingFor(category string) string {
	if o == nil || o.SafetySetting == nil {
		return ""
	}
	return o.SafetySetting(category)
}

func (o *Options) ShouldPreserveThinkingSuffix(modelName string) bool {
	return o != nil && o.PreserveThinkingSuffix != nil && o.PreserveThinkingSuffix(modelName)
}
