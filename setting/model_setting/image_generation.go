package model_setting

import "strings"

const (
	ImageResolutionParameterQuality = "quality"
	ImageResolutionParameterSize    = "size"
)

type ImageGenerationCapabilities struct {
	Resolutions               []string           `json:"resolutions"`
	ResolutionParameter       string             `json:"resolution_parameter"`
	Sizes                     []string           `json:"sizes"`
	DefaultResolution         string             `json:"default_resolution"`
	DefaultSize               string             `json:"default_size"`
	ResolutionPriceMultiplier map[string]float64 `json:"resolution_price_multipliers"`
}

var imageGenerationCapabilities = map[string]ImageGenerationCapabilities{
	"gemini-3.1-flash-image-preview": {
		Resolutions:         []string{"1K", "2K", "4K"},
		ResolutionParameter: ImageResolutionParameterQuality,
		Sizes:               []string{"1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"},
		DefaultResolution:   "1K",
		DefaultSize:         "1:1",
		ResolutionPriceMultiplier: map[string]float64{
			"1K": 1,
			"2K": 1,
			"4K": 2,
		},
	},
	"gemini-3-pro-image-preview": {
		Resolutions:         []string{"1K", "2K", "4K"},
		ResolutionParameter: ImageResolutionParameterQuality,
		Sizes:               []string{"1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"},
		DefaultResolution:   "1K",
		DefaultSize:         "1:1",
		ResolutionPriceMultiplier: map[string]float64{
			"1K": 1,
			"2K": 1,
			"4K": 1,
		},
	},
	"nano-banana-2": {
		Resolutions:         []string{"1K", "2K", "4K"},
		ResolutionParameter: ImageResolutionParameterQuality,
		Sizes:               []string{"1:1", "16:9", "9:16", "4:3", "3:4"},
		DefaultResolution:   "1K",
		DefaultSize:         "1:1",
		ResolutionPriceMultiplier: map[string]float64{
			"1K": 1,
			"2K": 1,
			"4K": 1,
		},
	},
	"nano-banana-pro": {
		Resolutions:         []string{"1K", "2K", "4K"},
		ResolutionParameter: ImageResolutionParameterQuality,
		Sizes:               []string{"1:1", "16:9", "9:16", "4:3", "3:4"},
		DefaultResolution:   "1K",
		DefaultSize:         "1:1",
		ResolutionPriceMultiplier: map[string]float64{
			"1K": 1,
			"2K": 1,
			"4K": 1,
		},
	},
	"gpt-image-2-vip": {
		Resolutions:         []string{"1K", "2K", "4K"},
		ResolutionParameter: ImageResolutionParameterSize,
		Sizes: []string{
			"1280x1280", "848x1280", "1280x848", "960x1280", "1280x960", "1024x1280", "1280x1024", "720x1280", "1280x720", "1280x544",
			"2048x2048", "1360x2048", "2048x1360", "1536x2048", "2048x1536", "1632x2048", "2048x1632", "1152x2048", "2048x1152", "2048x864",
			"2880x2880", "2336x3520", "3520x2336", "2480x3312", "3312x2480", "2560x3216", "3216x2560", "2160x3840", "3840x2160", "3840x1632",
		},
		DefaultResolution: "2K",
		DefaultSize:       "2048x2048",
		ResolutionPriceMultiplier: map[string]float64{
			"1K": 1,
			"2K": 1,
			"4K": 2,
		},
	},
}

func GetImageGenerationCapabilities(model string) *ImageGenerationCapabilities {
	capabilities, ok := imageGenerationCapabilities[strings.ToLower(strings.TrimSpace(model))]
	if !ok {
		return nil
	}
	capabilities.Resolutions = append([]string(nil), capabilities.Resolutions...)
	capabilities.Sizes = append([]string(nil), capabilities.Sizes...)
	capabilities.ResolutionPriceMultiplier = make(map[string]float64, len(capabilities.ResolutionPriceMultiplier))
	for resolution, multiplier := range imageGenerationCapabilities[strings.ToLower(strings.TrimSpace(model))].ResolutionPriceMultiplier {
		capabilities.ResolutionPriceMultiplier[resolution] = multiplier
	}
	return &capabilities
}

func GetImageGenerationPriceMultiplier(model, quality, size string) float64 {
	capabilities := GetImageGenerationCapabilities(model)
	if capabilities == nil {
		return 1
	}

	resolution := strings.ToUpper(strings.TrimSpace(quality))
	if capabilities.ResolutionParameter == ImageResolutionParameterSize {
		resolution = capabilities.DefaultResolution
		for index, configuredSize := range capabilities.Sizes {
			if strings.EqualFold(configuredSize, strings.TrimSpace(size)) {
				resolutionIndex := index * len(capabilities.Resolutions) / len(capabilities.Sizes)
				resolution = capabilities.Resolutions[resolutionIndex]
				break
			}
		}
	} else if resolution == "" {
		resolution = capabilities.DefaultResolution
	}

	multiplier, ok := capabilities.ResolutionPriceMultiplier[resolution]
	if !ok || multiplier <= 0 {
		return 1
	}
	return multiplier
}
