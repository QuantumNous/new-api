package gemini

import (
	"strings"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/QuantumNous/new-api/setting/reasoning"
)

// ApplyThinkingModelName strips -thinking / effort suffixes from the upstream
// model when the Gemini thinking adapter is enabled. Both the Gemini and Vertex
// adaptors call this before building generateContent URLs.
func ApplyThinkingModelName(info *relaycommon.RelayInfo) {
	if info == nil {
		return
	}
	if !model_setting.GetGeminiSettings().ThinkingAdapterEnabled ||
		model_setting.ShouldPreserveThinkingSuffix(info.OriginModelName) {
		return
	}
	stripped := stripThinkingAndEffortSuffix(info.UpstreamModelName)
	if stripped != info.UpstreamModelName {
		info.UpstreamModelName = stripped
	}
}

func stripThinkingAndEffortSuffix(modelName string) string {
	if strings.Contains(modelName, "-thinking-") {
		return strings.SplitN(modelName, "-thinking-", 2)[0]
	}
	if strings.HasSuffix(modelName, "-thinking") {
		return strings.TrimSuffix(modelName, "-thinking")
	}
	if strings.HasSuffix(modelName, "-nothinking") {
		return strings.TrimSuffix(modelName, "-nothinking")
	}
	if baseModel, level, ok := reasoning.TrimEffortSuffix(modelName); ok && level != "" {
		return baseModel
	}
	return modelName
}

// URLModelName is the bare model ID to embed in generateContent / predict URLs.
func URLModelName(info *relaycommon.RelayInfo) string {
	ApplyThinkingModelName(info)
	if info == nil {
		return ""
	}
	return relaycommon.ModelIDWithoutPublisher(info.UpstreamModelName)
}
