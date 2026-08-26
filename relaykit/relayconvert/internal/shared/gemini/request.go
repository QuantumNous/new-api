package gemini

import (
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

func ApplyThinkingConfig(geminiRequest *dto.GeminiChatRequest, info convmeta.Meta, oaiRequest ...dto.GeneralOpenAIRequest) {
	if geminiRequest == nil {
		return
	}

	opts := convmeta.OptionsOf(info)
	modelName := convmeta.UpstreamModelName(info)
	var intent reasoning.Intent
	if len(oaiRequest) > 0 {
		intent = reasoning.IntentFromChatRequest(oaiRequest[0])
		if modelName == "" {
			modelName = oaiRequest[0].Model
		}
	}

	if opts.Gemini.ThinkingAdapterEnabled {
		switch {
		case strings.Contains(modelName, "-thinking-") || strings.HasSuffix(modelName, "-thinking"):
			applyGeminiThinkingLevel(geminiRequest, info, modelName, reasoning.LevelHigh)
			return
		case strings.HasSuffix(modelName, "-nothinking"):
			applyGeminiThinkingDisabled(geminiRequest, modelName)
			return
		default:
			if _, level, ok := reasoning.TrimEffortSuffix(modelName); ok && level != "" {
				if reasoning.IsDisabledThinkingLevel(level) {
					applyGeminiThinkingDisabled(geminiRequest, modelName)
					return
				}
				applyGeminiThinkingLevel(geminiRequest, info, modelName, level)
				return
			}
		}
	}

	// A Gemini-native explicit budget/level is more precise than a generic
	// OpenAI effort. Normalize it, remove conflicts, and keep it intact.
	if cfg := geminiRequest.GenerationConfig.ThinkingConfig; cfg != nil && (cfg.ThinkingBudget != nil || cfg.ThinkingLevel != "") {
		if cfg.ThinkingBudget != nil {
			cfg.ThinkingLevel = ""
		} else {
			cfg.ThinkingLevel = reasoning.GeminiThinkingLevel(cfg.ThinkingLevel)
		}
		if cfg.ThinkingBudget == nil && cfg.ThinkingLevel == "" && !cfg.IncludeThoughts {
			geminiRequest.GenerationConfig.ThinkingConfig = nil
		}
		return
	}

	switch {
	case intent.Disabled:
		applyGeminiThinkingDisabled(geminiRequest, modelName)
	case intent.HasLevel():
		applyGeminiThinkingLevel(geminiRequest, info, modelName, intent.Level)
	case intent.WantsThoughts():
		applyGeminiIncludeThoughts(geminiRequest)
	case ModelSupportsThinking(modelName):
		// includeThoughts controls response visibility, not reasoning effort.
		applyGeminiIncludeThoughts(geminiRequest)
	}
}

func applyGeminiThinkingLevel(geminiRequest *dto.GeminiChatRequest, info convmeta.Meta, model, level string) {
	include := true
	projection := reasoning.ProjectGeminiThinking(model, false, nil, level, &include, reasoning.DisplayAuto)
	applyGeminiThinkingProjection(geminiRequest, projection)
	if info != nil {
		info.SetReasoningEffort(reasoning.OpenAIReasoningEffort(level))
	}
}

func applyGeminiIncludeThoughts(geminiRequest *dto.GeminiChatRequest) {
	if geminiRequest == nil {
		return
	}
	if geminiRequest.GenerationConfig.ThinkingConfig == nil {
		geminiRequest.GenerationConfig.ThinkingConfig = &dto.GeminiThinkingConfig{}
	}
	geminiRequest.GenerationConfig.ThinkingConfig.IncludeThoughts = true
}

func applyGeminiThinkingDisabled(geminiRequest *dto.GeminiChatRequest, model string) {
	projection := reasoning.ProjectGeminiThinking(model, true, nil, "", nil, reasoning.DisplayHidden)
	applyGeminiThinkingProjection(geminiRequest, projection)
}

func applyGeminiThinkingProjection(geminiRequest *dto.GeminiChatRequest, projection reasoning.GeminiThinkingProjection) {
	if geminiRequest == nil {
		return
	}
	if projection.ThinkingBudget == nil && projection.ThinkingLevel == "" && !projection.IncludeThoughts {
		geminiRequest.GenerationConfig.ThinkingConfig = nil
		return
	}
	geminiRequest.GenerationConfig.ThinkingConfig = &dto.GeminiThinkingConfig{
		IncludeThoughts: projection.IncludeThoughts,
		ThinkingBudget:  projection.ThinkingBudget,
		ThinkingLevel:   projection.ThinkingLevel,
	}
}

func ModelSupportsThinking(model string) bool {
	return reasoning.GeminiModelSupportsThinking(model)
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
