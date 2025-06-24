package operation_setting

import "strings"

const (
	// Web search
	WebSearchHighTierModelPriceLow    = 30.00
	WebSearchHighTierModelPriceMedium = 35.00
	WebSearchHighTierModelPriceHigh   = 50.00
	WebSearchPriceLow                 = 25.00
	WebSearchPriceMedium              = 27.50
	WebSearchPriceHigh                = 30.00
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

func GetWebSearchPricePerThousand(modelName string, contextSize string) float64 {
	// 确定模型类型
	// https://platform.openai.com/docs/pricing Web search 价格按模型类型和 search context size 收费
	// gpt-4.1, gpt-4o, or gpt-4o-search-preview 更贵，gpt-4.1-mini, gpt-4o-mini, gpt-4o-mini-search-preview 更便宜
	isHighTierModel := (strings.HasPrefix(modelName, "gpt-4.1") || strings.HasPrefix(modelName, "gpt-4o")) &&
		!strings.Contains(modelName, "mini")
	// 确定 search context size 对应的价格
	var priceWebSearchPerThousandCalls float64
	switch contextSize {
	case "low":
		if isHighTierModel {
			priceWebSearchPerThousandCalls = WebSearchHighTierModelPriceLow
		} else {
			priceWebSearchPerThousandCalls = WebSearchPriceLow
		}
	case "medium":
		if isHighTierModel {
			priceWebSearchPerThousandCalls = WebSearchHighTierModelPriceMedium
		} else {
			priceWebSearchPerThousandCalls = WebSearchPriceMedium
		}
	case "high":
		if isHighTierModel {
			priceWebSearchPerThousandCalls = WebSearchHighTierModelPriceHigh
		} else {
			priceWebSearchPerThousandCalls = WebSearchPriceHigh
		}
	default:
		// search context size 默认为 medium
		if isHighTierModel {
			priceWebSearchPerThousandCalls = WebSearchHighTierModelPriceMedium
		} else {
			priceWebSearchPerThousandCalls = WebSearchPriceMedium
		}
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
