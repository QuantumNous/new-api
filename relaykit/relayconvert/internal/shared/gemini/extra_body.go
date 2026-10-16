package gemini

import (
	"errors"
	"fmt"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/kitutil"
	"math"
)

// ApplyGoogleExtraBody preserves provider-native controls carried by Chat clients.
func ApplyGoogleExtraBody(geminiRequest *dto.GeminiChatRequest, raw []byte) error {
	if len(raw) > 0 {
		var extraBody map[string]any
		if err := kitutil.Unmarshal(raw, &extraBody); err != nil {
			return fmt.Errorf("invalid extra body: %w", err)
		}

		if googleBody, ok := extraBody["google"].(map[string]any); ok {
			if _, hasErrorParam := googleBody["thinkingConfig"]; hasErrorParam {
				return errors.New("extra_body.google.thinkingConfig is not supported, use extra_body.google.thinking_config instead")
			}

			if thinkingConfig, ok := googleBody["thinking_config"].(map[string]any); ok {
				if _, hasErrorParam := thinkingConfig["thinkingBudget"]; hasErrorParam {
					return errors.New("extra_body.google.thinking_config.thinkingBudget is not supported, use extra_body.google.thinking_config.thinking_budget instead")
				}
				var hasThinkingConfig bool
				var tempThinkingConfig dto.GeminiThinkingConfig

				if thinkingBudget, exists := thinkingConfig["thinking_budget"]; exists {
					v, ok := thinkingBudget.(float64)
					maxInt := int(^uint(0) >> 1)
					if !ok || math.IsNaN(v) || math.IsInf(v, 0) || math.Trunc(v) != v || v >= float64(maxInt) || v < float64(-maxInt-1) {
						return errors.New("extra_body.google.thinking_config.thinking_budget must be an integer")
					}
					budgetInt := int(v)
					tempThinkingConfig.ThinkingBudget = kitutil.GetPointer(budgetInt)
					hasThinkingConfig = true
				}

				if includeThoughts, exists := thinkingConfig["include_thoughts"]; exists {
					if v, ok := includeThoughts.(bool); ok {
						tempThinkingConfig.IncludeThoughts = kitutil.GetPointer(v)
						hasThinkingConfig = true
					} else {
						return errors.New("extra_body.google.thinking_config.include_thoughts must be a boolean")
					}
				}
				if thinkingLevel, exists := thinkingConfig["thinking_level"]; exists {
					if v, ok := thinkingLevel.(string); ok {
						tempThinkingConfig.ThinkingLevel = v
						hasThinkingConfig = true
					} else {
						return errors.New("extra_body.google.thinking_config.thinking_level must be a string")
					}
				}

				if hasThinkingConfig {
					geminiRequest.GenerationConfig.ThinkingConfig = &tempThinkingConfig
				}
			}

			if _, hasErrorParam := googleBody["imageConfig"]; hasErrorParam {
				return errors.New("extra_body.google.imageConfig is not supported, use extra_body.google.image_config instead")
			}

			if imageConfig, ok := googleBody["image_config"].(map[string]any); ok {
				if _, hasErrorParam := imageConfig["aspectRatio"]; hasErrorParam {
					return errors.New("extra_body.google.image_config.aspectRatio is not supported, use extra_body.google.image_config.aspect_ratio instead")
				}
				if _, hasErrorParam := imageConfig["imageSize"]; hasErrorParam {
					return errors.New("extra_body.google.image_config.imageSize is not supported, use extra_body.google.image_config.image_size instead")
				}

				geminiImageConfig := make(map[string]any)
				if aspectRatio, ok := imageConfig["aspect_ratio"]; ok {
					geminiImageConfig["aspectRatio"] = aspectRatio
				}
				if imageSize, ok := imageConfig["image_size"]; ok {
					geminiImageConfig["imageSize"] = imageSize
				}

				if len(geminiImageConfig) > 0 {
					imageConfigBytes, err := kitutil.Marshal(geminiImageConfig)
					if err != nil {
						return fmt.Errorf("failed to marshal image_config: %w", err)
					}
					geminiRequest.GenerationConfig.ImageConfig = imageConfigBytes
				}
			}
		}
	}

	return nil
}
