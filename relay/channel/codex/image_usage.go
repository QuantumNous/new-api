package codex

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"

	"github.com/tidwall/gjson"
)

// defaultCodexImageOutputTokens is the billing fallback when Codex produced an
// image but omitted image_gen output usage.
const defaultCodexImageOutputTokens = 272

func buildCodexImageUsage(imageUsage gjson.Result, hasUsage bool) *dto.Usage {
	promptTokens := 0
	completionTokens := 0
	totalTokens := 0
	if hasUsage {
		promptTokens = int(imageUsage.Get("input_tokens").Int())
		completionTokens = int(imageUsage.Get("output_tokens").Int())
		totalTokens = int(imageUsage.Get("total_tokens").Int())
	}

	if promptTokens < 0 {
		promptTokens = 0
	}
	if completionTokens <= 0 {
		common.SysError("codex image: image produced but image_gen output_tokens missing/zero, applying fallback completion tokens")
		completionTokens = defaultCodexImageOutputTokens
	}

	usage := &dto.Usage{
		PromptTokens:     promptTokens,
		CompletionTokens: completionTokens,
	}

	inputDetails := imageUsage.Get("input_tokens_details")
	if textTokens := inputDetails.Get("text_tokens").Int(); textTokens > 0 {
		usage.PromptTokensDetails.TextTokens = int(textTokens)
	}
	if imageTokens := inputDetails.Get("image_tokens").Int(); imageTokens > 0 {
		usage.PromptTokensDetails.ImageTokens = int(imageTokens)
	}

	outputDetails := imageUsage.Get("output_tokens_details")
	if textTokens := outputDetails.Get("text_tokens").Int(); textTokens > 0 {
		usage.CompletionTokenDetails.TextTokens = int(textTokens)
	}
	if imageTokens := outputDetails.Get("image_tokens").Int(); imageTokens > 0 {
		usage.CompletionTokenDetails.ImageTokens = int(imageTokens)
	} else if imageTokens := imageUsage.Get("image_tokens").Int(); imageTokens > 0 {
		usage.CompletionTokenDetails.ImageTokens = int(imageTokens)
	}

	if totalTokens >= promptTokens+completionTokens {
		usage.TotalTokens = totalTokens
	} else {
		usage.TotalTokens = promptTokens + completionTokens
	}
	return usage
}
