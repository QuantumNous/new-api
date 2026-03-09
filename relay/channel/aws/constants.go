package aws

import "strings"

// bedrockProviderPrefixes are known Bedrock provider prefixes for Layer 1 detection.
var bedrockProviderPrefixes = []string{
	"anthropic.", "amazon.", "meta.", "mistral.", "cohere.", "ai21.", "stability.", "deepseek.", "minimax.",
}

// bedrockRegionPrefixes are known Bedrock cross-region inference prefixes for Layer 1 detection.
var bedrockRegionPrefixes = []string{
	"global.", "us.", "eu.", "ap.", "apac.", "jp.",
}

// modelProviderPatterns maps short-name prefixes to Bedrock provider prefixes for Layer 3.
var modelProviderPatterns = map[string]string{
	"claude-": "anthropic.",
	"nova-":   "amazon.",
}

var awsModelIDMap = map[string]string{
	"claude-3-sonnet-20240229":   "anthropic.claude-3-sonnet-20240229-v1:0",
	"claude-3-opus-20240229":     "anthropic.claude-3-opus-20240229-v1:0",
	"claude-3-haiku-20240307":    "anthropic.claude-3-haiku-20240307-v1:0",
	"claude-3-5-sonnet-20240620": "anthropic.claude-3-5-sonnet-20240620-v1:0",
	"claude-3-5-sonnet-20241022": "anthropic.claude-3-5-sonnet-20241022-v2:0",
	"claude-3-5-haiku-20241022":  "anthropic.claude-3-5-haiku-20241022-v1:0",
	"claude-3-7-sonnet-20250219": "anthropic.claude-3-7-sonnet-20250219-v1:0",
	"claude-sonnet-4-20250514":   "anthropic.claude-sonnet-4-20250514-v1:0",
	"claude-opus-4-20250514":     "anthropic.claude-opus-4-20250514-v1:0",
	"claude-opus-4-1-20250805":   "anthropic.claude-opus-4-1-20250805-v1:0",
	"claude-sonnet-4-5-20250929": "anthropic.claude-sonnet-4-5-20250929-v1:0",
	"claude-sonnet-4-6":          "anthropic.claude-sonnet-4-6",
	"claude-haiku-4-5-20251001":  "anthropic.claude-haiku-4-5-20251001-v1:0",
	"claude-opus-4-5-20251101":   "anthropic.claude-opus-4-5-20251101-v1:0",
	"claude-opus-4-6":            "anthropic.claude-opus-4-6-v1",
	// Nova models
	"nova-micro-v1:0":   "amazon.nova-micro-v1:0",
	// Nova 2 models
	"nova-2-lite-v1:0": "amazon.nova-2-lite-v1:0",
	"nova-lite-v1:0":    "amazon.nova-lite-v1:0",
	"nova-pro-v1:0":     "amazon.nova-pro-v1:0",
	"nova-premier-v1:0": "amazon.nova-premier-v1:0",
	"nova-canvas-v1:0":  "amazon.nova-canvas-v1:0",
	"nova-reel-v1:0":    "amazon.nova-reel-v1:0",
	"nova-reel-v1:1":    "amazon.nova-reel-v1:1",
	"nova-sonic-v1:0":   "amazon.nova-sonic-v1:0",
}

// awsModelsRequireInferenceProfile lists models whose base model ID does NOT
// support on-demand invocation. These models MUST be called with an inference
// profile prefix (global./us./eu./jp.). Models not in this map default to
// on-demand (base model ID).
var awsModelsRequireInferenceProfile = map[string]bool{
	// Claude 3.7
	"anthropic.claude-3-7-sonnet-20250219-v1:0": true,
	// Claude 4.x
	"anthropic.claude-sonnet-4-20250514-v1:0":   true,
	"anthropic.claude-opus-4-20250514-v1:0":     true,
	"anthropic.claude-opus-4-1-20250805-v1:0":   true,
	"anthropic.claude-sonnet-4-5-20250929-v1:0": true,
	"anthropic.claude-opus-4-5-20251101-v1:0":   true,
	"anthropic.claude-haiku-4-5-20251001-v1:0":  true,
	"anthropic.claude-opus-4-6-v1":              true,
	"anthropic.claude-sonnet-4-6":               true,
	// Nova 2
	"amazon.nova-2-lite-v1:0": true,
	// DeepSeek
	"deepseek.r1-v1:0": true,
}

var ChannelName = "aws"

// 判断是否为Nova模型
func isNovaModel(modelId string) bool {
	return strings.Contains(modelId, "nova-")
}
