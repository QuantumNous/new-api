package operation_setting

import "strings"

const (
	// Web search
	WebSearchPriceHigh = 25.00
	WebSearchPrice     = 10.00
	// File search
	FileSearchPrice = 2.5
)

const (
	// Gemini Audio Input Price
	Gemini25FlashPreviewInputAudioPrice     = 1.00
	Gemini25FlashProductionInputAudioPrice  = 1.00 // for `gemini-2.5-flash`
	Gemini25FlashLitePreviewInputAudioPrice = 0.50
	Gemini25FlashNativeAudioInputAudioPrice = 3.00
	Gemini20FlashInputAudioPrice            = 0.70
)

const (
	// Claude Web search
	ClaudeWebSearchPrice = 10.00
)

const (
	Gemini25FlashImagePreviewImageOutputPrice = 30.00
)

func GetClaudeWebSearchPricePerThousand() float64 {
	return ClaudeWebSearchPrice
}

func GetWebSearchPricePerThousand(modelName string, contextSize string) float64 {
	// 确定模型类型
	// https://platform.openai.com/docs/pricing Web search 价格按模型类型收费
	// 新版计费规则不再关联 search context size，故在const区域将各size的价格设为一致。
	// gpt-5, gpt-5-mini, gpt-5-nano 和 o 系列模型价格为 10.00 美元/千次调用，产生额外 token 计入 input_tokens
	// gpt-4o, gpt-4.1, gpt-4o-mini 和 gpt-4.1-mini 价格为 25.00 美元/千次调用，不产生额外 token
	isNormalPriceModel :=
		strings.HasPrefix(modelName, "o3") ||
			strings.HasPrefix(modelName, "o4") ||
			strings.HasPrefix(modelName, "gpt-5")
	var priceWebSearchPerThousandCalls float64
	if isNormalPriceModel {
		priceWebSearchPerThousandCalls = WebSearchPrice
	} else {
		priceWebSearchPerThousandCalls = WebSearchPriceHigh
	}
	return priceWebSearchPerThousandCalls
}

func GetFileSearchPricePerThousand() float64 {
	return FileSearchPrice
}

func GetGeminiInputAudioPricePerMillionTokens(modelName string) float64 {
	if strings.HasPrefix(modelName, "gemini-2.5-flash-preview-native-audio") {
		return Gemini25FlashNativeAudioInputAudioPrice
	} else if strings.HasPrefix(modelName, "gemini-2.5-flash-preview-lite") {
		return Gemini25FlashLitePreviewInputAudioPrice
	} else if strings.HasPrefix(modelName, "gemini-2.5-flash-preview") {
		return Gemini25FlashPreviewInputAudioPrice
	} else if strings.HasPrefix(modelName, "gemini-2.5-flash") {
		return Gemini25FlashProductionInputAudioPrice
	} else if strings.HasPrefix(modelName, "gemini-2.0-flash") {
		return Gemini20FlashInputAudioPrice
	}
	return 0
}

func GetGeminiImageOutputPricePerMillionTokens(modelName string) float64 {
	if strings.HasPrefix(modelName, "gemini-2.5-flash-image-preview") {
		return Gemini25FlashImagePreviewImageOutputPrice
	}
	return 0
}
