package vyroseedance

import "strings"

var ModelList = []string{
	"vyro-seedance-2-fast",
	"Seedance-2.0",
	"Seedance 2.0",
}

// JSONAPIModels are upstream models that expect application/json (OpenAI-style /videos).
var JSONAPIModels = []string{
	"Seedance-2.0",
}

const (
	ChannelName              = "VyroSeedance"
	upstreamSeedance20Model  = "Seedance-2.0"
)

func UsesJSONAPI(modelName string) bool {
	return isSeedance20ModelName(modelName)
}

func isSeedance20ModelName(modelName string) bool {
	compact := strings.ToLower(strings.ReplaceAll(strings.ReplaceAll(strings.TrimSpace(modelName), " ", ""), "-", ""))
	return compact == "seedance2.0"
}

// UpstreamJSONModelName returns the model name sent to upstream JSON APIs.
func UpstreamJSONModelName(modelName string) string {
	if UsesJSONAPI(modelName) {
		return upstreamSeedance20Model
	}
	return strings.TrimSpace(modelName)
}
