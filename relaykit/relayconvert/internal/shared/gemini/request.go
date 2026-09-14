package gemini

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/convmeta"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/reasoning"
)

var SupportedMimeTypes = map[string]bool{
	"application/pdf": true,
	"audio/mpeg":      true,
	"audio/mp3":       true,
	"audio/wav":       true,
	"image/png":       true,
	"image/jpeg":      true,
	"image/jpg":       true,
	"image/webp":      true,
	"image/heic":      true,
	"image/heif":      true,
	"text/plain":      true,
	"video/mov":       true,
	"video/mpeg":      true,
	"video/mp4":       true,
	"video/mpg":       true,
	"video/avi":       true,
	"video/wmv":       true,
	"video/mpegps":    true,
	"video/flv":       true,
}

var SafetySettingCategories = []string{
	"HARM_CATEGORY_HARASSMENT",
	"HARM_CATEGORY_HATE_SPEECH",
	"HARM_CATEGORY_SEXUALLY_EXPLICIT",
	"HARM_CATEGORY_DANGEROUS_CONTENT",
}

const ThoughtSignatureBypassValue = "context_engineering_is_the_way_to_go"

func ShouldAttachThoughtSignature(opts *convmeta.Options) bool {
	return opts != nil && opts.Gemini.FunctionCallThoughtSignatureEnabled
}

func AttachThoughtSignatureBypass(opts *convmeta.Options, part *dto.GeminiPart) bool {
	if part == nil || len(part.ThoughtSignature) > 0 || !ShouldAttachThoughtSignature(opts) {
		return false
	}
	part.ThoughtSignature = []byte(strconv.Quote(ThoughtSignatureBypassValue))
	return true
}

func AttachFunctionCallThoughtSignature(opts *convmeta.Options, part *dto.GeminiPart) bool {
	if part == nil || !HasFunctionCallContent(part.FunctionCall) {
		return false
	}
	return AttachThoughtSignatureBypass(opts, part)
}

func AttachFirstTextThoughtSignature(opts *convmeta.Options, parts []dto.GeminiPart) bool {
	if !ShouldAttachThoughtSignature(opts) {
		return false
	}
	for i := range parts {
		if parts[i].Text != "" && len(parts[i].ThoughtSignature) == 0 {
			parts[i].ThoughtSignature = []byte(strconv.Quote(ThoughtSignatureBypassValue))
			return true
		}
	}
	return false
}

func ApplyThinkingConfig(geminiRequest *dto.GeminiChatRequest, info convmeta.Meta, oaiRequest ...dto.GeneralOpenAIRequest) error {
	opts := convmeta.OptionsOf(info)
	if geminiRequest == nil {
		return nil
	}

	modelName := convmeta.UpstreamModelName(info)
	var source reasoning.Intent
	crossProtocol := len(oaiRequest) > 0
	if len(oaiRequest) > 0 {
		if modelName == "" {
			modelName = oaiRequest[0].Model
		}
		var err error
		source, err = reasoning.FromOpenAIChat(&oaiRequest[0])
		if err != nil {
			return err
		}
	}

	baseModel := modelName
	suffix := reasoning.IntentFromState(convmeta.ReasoningStateOf(info))
	preserveSuffix := opts.ShouldPreserveThinkingSuffix(modelName)
	if info != nil && opts.ShouldPreserveThinkingSuffix(info.GetOriginModelName()) {
		preserveSuffix = true
	}
	if preserveSuffix {
		suffix = reasoning.Intent{}
	}
	// Native Gemini requests already use the target protocol. Without a host
	// modifier, read portable effort metadata without running the capability
	// renderer or rewriting provider-native controls.
	if !crossProtocol && suffix.IsEmpty() {
		if info != nil {
			effort := ""
			if config := geminiRequest.GenerationConfig.ThinkingConfig; config != nil {
				effort = config.ThinkingLevel
				if effort == "" && config.ThinkingBudget != nil {
					effort = string(reasoning.EffortFromBudget(*config.ThinkingBudget))
				}
			}
			info.SetReasoningEffort(effort)
		}
		return nil
	}
	native, err := reasoning.FromGemini(geminiRequest)
	if err != nil {
		return err
	}
	source = reasoning.ResolveGeminiEnabledDefault(baseModel, source, geminiRequest.GenerationConfig.MaxOutputTokens)
	if native.HasStrength() && source.HasStrength() {
		equivalent, compareErr := reasoning.EquivalentGeminiStrength(baseModel, native, source)
		if compareErr != nil {
			return compareErr
		}
		if !equivalent {
			nativeEffort := reasoning.EffectiveEffort(native)
			sourceEffort := reasoning.EffectiveEffort(source)
			return fmt.Errorf("%w for model %q: Gemini thinking_config effort %q differs from standard effort %q", reasoning.ErrEffortConflict, modelName, nativeEffort, sourceEffort)
		}
		// Native Gemini configuration is the lossless representation. Once the
		// two controls are equivalent, retain only portable visibility metadata
		// from the standard representation.
		if native.IncludeThoughts == nil {
			native.IncludeThoughts = source.IncludeThoughts
		}
		source = reasoning.Intent{}
	}
	explicit, err := reasoning.MergeExplicit(native, source, modelName)
	if err != nil {
		return err
	}
	if explicit.HasStrength() && suffix.HasStrength() {
		equivalent, compareErr := reasoning.EquivalentGeminiStrength(baseModel, explicit, suffix)
		if compareErr != nil {
			return compareErr
		}
		if equivalent {
			if explicit.IncludeThoughts == nil {
				explicit.IncludeThoughts = suffix.IncludeThoughts
			}
			suffix = reasoning.Intent{}
		}
	}
	requested, err := reasoning.MergeExplicitAndSuffix(explicit, suffix, modelName)
	if err != nil {
		return err
	}
	requested = reasoning.ResolveGeminiEnabledDefault(baseModel, requested, geminiRequest.GenerationConfig.MaxOutputTokens)

	if native.HasStrength() && !suffix.HasStrength() {
		if explicit.IncludeThoughts != nil {
			geminiRequest.GenerationConfig.ThinkingConfig.IncludeThoughts = explicit.IncludeThoughts
		}
		effort, err := reasoning.ValidateGeminiThinkingConfig(baseModel, geminiRequest.GenerationConfig.ThinkingConfig)
		if err != nil {
			return err
		}
		if info != nil && effort != "" {
			info.SetReasoningEffort(string(effort))
		}
		return nil
	}
	if requested.IsEmpty() {
		return nil
	}
	rendered, err := reasoning.RenderGemini(
		baseModel,
		requested,
		geminiRequest.GenerationConfig.MaxOutputTokens,
		opts.Gemini.ThinkingAdapterBudgetTokensPercentage,
	)
	if err != nil {
		return err
	}
	geminiRequest.GenerationConfig.ThinkingConfig = rendered.Config
	if info != nil && rendered.EffectiveEffort != "" {
		info.SetReasoningEffort(string(rendered.EffectiveEffort))
	}
	return nil
}

func ParseStopSequences(stop any) []string {
	if stop == nil {
		return nil
	}

	switch v := stop.(type) {
	case string:
		if v != "" {
			return []string{v}
		}
	case []string:
		return v
	case []interface{}:
		sequences := make([]string, 0, len(v))
		for _, item := range v {
			if str, ok := item.(string); ok && str != "" {
				sequences = append(sequences, str)
			}
		}
		return sequences
	}
	return nil
}

func HasFunctionCallContent(call *dto.FunctionCall) bool {
	if call == nil {
		return false
	}
	if strings.TrimSpace(call.FunctionName) != "" {
		return true
	}

	switch v := call.Arguments.(type) {
	case nil:
		return false
	case string:
		return strings.TrimSpace(v) != ""
	case map[string]interface{}:
		return len(v) > 0
	case []interface{}:
		return len(v) > 0
	default:
		return true
	}
}

func SupportedMimeTypesList() []string {
	keys := make([]string, 0, len(SupportedMimeTypes))
	for key := range SupportedMimeTypes {
		keys = append(keys, key)
	}
	return keys
}
