package common

import (
	"reflect"
	"strings"

	"github.com/QuantumNous/new-api/constant"
)

const (
	MaxImageGenerationCount   = 128
	MaxImageInputURLs         = 16
	MaxGeminiImageInputURLs   = 14
	MaxImagePromptCharacters  = 20000
	ImageGenerationEndpoint   = "/v1/images/generations"
	ImageGenerationPollPath   = "/v1/images/generations/{task_id}"
	ImageResultDeliveryOSSURL = "oss_url"
)

type ImageModelFamily string

const (
	ImageModelFamilyGeneric       ImageModelFamily = "generic"
	ImageModelFamilyGeminiFlash31 ImageModelFamily = "gemini_flash_3_1"
	ImageModelFamilyGeminiPro3    ImageModelFamily = "gemini_pro_3"
	ImageModelFamilyGeminiLegacy  ImageModelFamily = "gemini_legacy"
	ImageModelFamilyImagen        ImageModelFamily = "imagen"
	ImageModelFamilyGPTImage2     ImageModelFamily = "gpt_image_2"
	ImageModelFamilyGPTImage      ImageModelFamily = "gpt_image"
	ImageModelFamilyChatGPTImage  ImageModelFamily = "chatgpt_image"
	ImageModelFamilyDallE2        ImageModelFamily = "dall_e_2"
	ImageModelFamilyDallE3        ImageModelFamily = "dall_e_3"
	ImageModelFamilyMiniMax       ImageModelFamily = "minimax"
	ImageModelFamilyXAI           ImageModelFamily = "xai"
	ImageModelFamilyFlux          ImageModelFamily = "flux"
	ImageModelFamilySeedream      ImageModelFamily = "seedream"
	ImageModelFamilyAliImage      ImageModelFamily = "ali_image"
	ImageModelFamilyJimeng        ImageModelFamily = "jimeng"
	ImageModelFamilySiliconFlow   ImageModelFamily = "siliconflow"
)

type ImageSizeCombination struct {
	Operation    string `json:"operation,omitempty"`
	Resolution   string `json:"resolution"`
	AspectRatio  string `json:"aspect_ratio"`
	Size         string `json:"size,omitempty"`
	Quality      string `json:"quality,omitempty"`
	OutputFormat string `json:"output_format,omitempty"`
}

type ImageModelCapabilities struct {
	Family                   ImageModelFamily
	Operations               []string
	AspectRatios             []string
	Resolutions              []string
	Sizes                    []string
	Qualities                []string
	OutputFormats            []string
	MaxReferenceImages       int
	MaxOutputImages          int
	DefaultAspectRatio       string
	DefaultResolution        string
	DefaultSize              string
	DefaultQuality           string
	DefaultOutputFormat      string
	ResolutionAspectVariants []ImageSizeCombination
	HasAspectRatioParameter  bool
	HasResolutionParameter   bool
	HasSizeParameter         bool
	HasQualityParameter      bool
	HasOutputFormatParameter bool
	HasWatermarkParameter    bool
	HasOutputCompression     bool
	HasBackgroundParameter   bool
	HasModerationParameter   bool
	ReferenceImagesRequired  bool
	AdditionalParameters     []ImageAPIParameter
}

type ImageAPIProfile struct {
	Kind           string               `json:"kind"`
	Endpoint       string               `json:"endpoint"`
	Async          bool                 `json:"async"`
	PollEndpoint   string               `json:"poll_endpoint"`
	Webhook        bool                 `json:"webhook"`
	ResultDelivery string               `json:"result_delivery"`
	Operations     []string             `json:"operations"`
	Parameters     []ImageAPIParameter  `json:"parameters"`
	Constraints    []ImageAPIConstraint `json:"constraints,omitempty"`
}

type ImageAPIParameter struct {
	Name        string   `json:"name"`
	Type        string   `json:"type"`
	Required    bool     `json:"required,omitempty"`
	Default     any      `json:"default,omitempty"`
	EnumValues  []string `json:"enum_values,omitempty"`
	Min         *int     `json:"min,omitempty"`
	Max         *int     `json:"max,omitempty"`
	MaxItems    *int     `json:"max_items,omitempty"`
	Description string   `json:"description,omitempty"`
}

type ImageAPIConstraint struct {
	Type         string                 `json:"type"`
	Fields       []string               `json:"fields"`
	Combinations []ImageSizeCombination `json:"combinations"`
}

var (
	geminiFlashImageAspectRatios = []string{
		"auto", "1:1", "1:4", "1:8", "2:3", "3:2", "3:4", "4:1",
		"4:3", "4:5", "5:4", "8:1", "9:16", "16:9", "21:9",
	}
	geminiStandardImageAspectRatios = []string{
		"auto", "1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4",
		"9:16", "16:9", "21:9",
	}
	allNativeImageAspectRatios = []string{
		"auto", "1:1", "1:4", "1:8", "2:3", "3:2", "3:4", "4:1",
		"4:3", "4:5", "5:4", "8:1", "9:16", "16:9", "21:9",
		"2:1", "1:2", "3:1", "1:3", "9:21",
	}
	miniMaxImageAspectRatios = []string{
		"1:1", "16:9", "9:16", "3:2", "2:3", "4:3", "3:4", "21:9",
	}
	fluxImageAspectRatios = []string{
		"1:1", "16:9", "9:16", "3:2", "2:3", "4:5", "5:4", "3:4", "4:3",
	}
	gptImage2Variants = []ImageSizeCombination{
		{Resolution: "1K", AspectRatio: "1:1", Size: "1024x1024"},
		{Resolution: "1K", AspectRatio: "16:9", Size: "1536x864"},
		{Resolution: "1K", AspectRatio: "9:16", Size: "864x1536"},
		{Resolution: "1K", AspectRatio: "3:4", Size: "1024x1360"},
		{Resolution: "1K", AspectRatio: "4:3", Size: "1360x1024"},
		{Resolution: "1K", AspectRatio: "auto", Size: "auto"},
		{Resolution: "2K", AspectRatio: "1:1", Size: "1440x1440"},
		{Resolution: "2K", AspectRatio: "16:9", Size: "2048x1152"},
		{Resolution: "2K", AspectRatio: "9:16", Size: "1152x2048"},
		{Resolution: "2K", AspectRatio: "3:4", Size: "1248x1664"},
		{Resolution: "2K", AspectRatio: "4:3", Size: "1664x1248"},
		{Resolution: "4K", AspectRatio: "1:1", Size: "2880x2880"},
		{Resolution: "4K", AspectRatio: "16:9", Size: "3840x2160"},
		{Resolution: "4K", AspectRatio: "9:16", Size: "2160x3840"},
		{Resolution: "4K", AspectRatio: "3:4", Size: "2448x3264"},
		{Resolution: "4K", AspectRatio: "4:3", Size: "3264x2448"},
	}
	gptImageVariants = []ImageSizeCombination{
		{Resolution: "1K", AspectRatio: "1:1", Size: "1024x1024"},
		{Resolution: "1K", AspectRatio: "3:2", Size: "1536x1024"},
		{Resolution: "1K", AspectRatio: "2:3", Size: "1024x1536"},
	}
)

func normalizeImageModelName(model string) string {
	return strings.TrimPrefix(strings.ToLower(strings.TrimSpace(model)), "models/")
}

func ImageModelCapabilitiesForModel(model string) ImageModelCapabilities {
	normalized := normalizeImageModelName(model)
	operations := imageOperationsForModel(normalized)

	switch {
	case strings.HasSuffix(normalized, "nano-banana-2") || strings.Contains(normalized, "gemini-3.1-flash-image"):
		return ImageModelCapabilities{
			Family: ImageModelFamilyGeminiFlash31, Operations: []string{"generation", "edit"},
			AspectRatios:       append([]string(nil), geminiFlashImageAspectRatios...),
			Resolutions:        []string{"512", "1K", "2K", "4K"},
			MaxReferenceImages: MaxGeminiImageInputURLs, MaxOutputImages: 1,
			DefaultAspectRatio: "auto", DefaultResolution: "1K",
			HasAspectRatioParameter: true, HasResolutionParameter: true,
		}
	case strings.Contains(normalized, "nano-banana-pro") || strings.Contains(normalized, "gemini-3-pro-image") || strings.Contains(normalized, "gemini-3.1-pro-image"):
		return ImageModelCapabilities{
			Family: ImageModelFamilyGeminiPro3, Operations: []string{"generation", "edit"},
			AspectRatios:       append([]string(nil), geminiStandardImageAspectRatios...),
			Resolutions:        []string{"1K", "2K", "4K"},
			MaxReferenceImages: MaxGeminiImageInputURLs, MaxOutputImages: 1,
			DefaultAspectRatio: "auto", DefaultResolution: "1K",
			HasAspectRatioParameter: true, HasResolutionParameter: true,
		}
	case (strings.HasPrefix(normalized, "gemini-") && (strings.Contains(normalized, "image") || strings.Contains(normalized, "image-generation"))) ||
		strings.HasPrefix(normalized, "gemini-2.0-flash-exp") || strings.Contains(normalized, "nano-banana"):
		maxReferenceImages := MaxImageInputURLs
		if strings.Contains(normalized, "nano-banana") || strings.HasPrefix(normalized, "gemini-3") {
			maxReferenceImages = MaxGeminiImageInputURLs
		}
		return ImageModelCapabilities{
			Family: ImageModelFamilyGeminiLegacy, Operations: []string{"generation", "edit"},
			AspectRatios:       append([]string(nil), geminiStandardImageAspectRatios...),
			Resolutions:        []string{"1K"},
			MaxReferenceImages: maxReferenceImages, MaxOutputImages: 1,
			DefaultAspectRatio: "auto", DefaultResolution: "1K",
			HasAspectRatioParameter: true, HasResolutionParameter: true,
		}
	case strings.HasPrefix(normalized, "imagen-"):
		// https://ai.google.dev/gemini-api/docs/imagen documents five aspect
		// ratios, 1K/2K output tiers, and 1-4 generated images.
		return ImageModelCapabilities{
			Family: ImageModelFamilyImagen, Operations: []string{"generation"},
			AspectRatios:       []string{"1:1", "3:4", "4:3", "9:16", "16:9"},
			Resolutions:        []string{"1K", "2K"},
			MaxOutputImages:    4,
			DefaultAspectRatio: "1:1", DefaultResolution: "1K",
			HasAspectRatioParameter: true, HasResolutionParameter: true,
		}
	case strings.HasPrefix(normalized, "gpt-image-2"):
		return ImageModelCapabilities{
			Family: ImageModelFamilyGPTImage2, Operations: operations,
			AspectRatios: []string{"auto", "1:1", "16:9", "9:16", "3:4", "4:3"},
			Resolutions:  []string{"1K", "2K", "4K"},
			Sizes:        imageVariantSizes(gptImage2Variants), Qualities: []string{"auto", "low", "medium", "high"},
			OutputFormats: []string{"png", "jpeg", "webp"}, MaxReferenceImages: MaxImageInputURLs,
			MaxOutputImages: MaxImageGenerationCount, DefaultSize: "auto",
			DefaultQuality: "auto", DefaultOutputFormat: "png",
			ResolutionAspectVariants: append([]ImageSizeCombination(nil), gptImage2Variants...),
			HasAspectRatioParameter:  true, HasResolutionParameter: true, HasSizeParameter: true,
			HasQualityParameter: true, HasOutputFormatParameter: true, HasOutputCompression: true,
			HasBackgroundParameter: true, HasModerationParameter: true,
			ReferenceImagesRequired: len(operations) == 1 && operations[0] == "edit",
		}
	case strings.HasPrefix(normalized, "gpt-image-"):
		return ImageModelCapabilities{
			Family: ImageModelFamilyGPTImage, Operations: operations,
			AspectRatios: []string{"1:1", "3:2", "2:3"}, Resolutions: []string{"1K"},
			Sizes: []string{"auto", "1024x1024", "1536x1024", "1024x1536"}, Qualities: []string{"auto", "low", "medium", "high"},
			OutputFormats: []string{"png", "jpeg", "webp"}, MaxReferenceImages: MaxImageInputURLs,
			MaxOutputImages: MaxImageGenerationCount, DefaultSize: "auto",
			DefaultQuality: "auto", DefaultOutputFormat: "png",
			ResolutionAspectVariants: append([]ImageSizeCombination(nil), gptImageVariants...),
			HasAspectRatioParameter:  true, HasResolutionParameter: true, HasSizeParameter: true,
			HasQualityParameter: true, HasOutputFormatParameter: true, HasOutputCompression: true,
			HasBackgroundParameter: true, HasModerationParameter: true,
			ReferenceImagesRequired: len(operations) == 1 && operations[0] == "edit",
		}
	case strings.Contains(normalized, "chatgpt-image"):
		return ImageModelCapabilities{
			Family: ImageModelFamilyChatGPTImage, Operations: []string{"generation"}, MaxOutputImages: MaxImageGenerationCount,
		}
	case strings.Contains(normalized, "dall-e-2") || normalized == "dall-e":
		return ImageModelCapabilities{
			Family: ImageModelFamilyDallE2, Operations: []string{"generation"},
			Sizes:           []string{"256x256", "512x512", "1024x1024"},
			MaxOutputImages: MaxImageGenerationCount, DefaultSize: "1024x1024",
			HasSizeParameter: true,
		}
	case strings.Contains(normalized, "dall-e-3"):
		return ImageModelCapabilities{
			Family: ImageModelFamilyDallE3, Operations: []string{"generation"},
			Sizes:     []string{"1024x1024", "1024x1792", "1792x1024"},
			Qualities: []string{"standard", "hd"}, MaxOutputImages: 1,
			DefaultSize: "1024x1024", DefaultQuality: "standard",
			HasSizeParameter: true, HasQualityParameter: true,
		}
	case strings.Contains(normalized, "image-01"):
		return ImageModelCapabilities{
			Family: ImageModelFamilyMiniMax, Operations: []string{"generation"},
			AspectRatios: append([]string(nil), miniMaxImageAspectRatios...), MaxOutputImages: MaxImageGenerationCount,
			HasAspectRatioParameter: true, HasSizeParameter: true,
			HasWatermarkParameter: true,
			AdditionalParameters: []ImageAPIParameter{
				{Name: "prompt_optimizer", Type: "boolean", Description: "Whether to optimize the image prompt before generation."},
			},
		}
	case strings.Contains(normalized, "grok-imagine-image") || strings.Contains(normalized, "grok-2-image-"):
		return ImageModelCapabilities{
			Family: ImageModelFamilyXAI, Operations: []string{"generation"}, MaxOutputImages: MaxImageGenerationCount,
		}
	case strings.Contains(normalized, "flux"):
		return ImageModelCapabilities{
			Family: ImageModelFamilyFlux, Operations: []string{"generation"},
			MaxOutputImages: MaxImageGenerationCount, HasSizeParameter: true,
		}
	case strings.Contains(normalized, "seedream") || strings.Contains(normalized, "doubao-seedream"):
		// The VolcEngine adaptor maps size, output_format, and watermark directly.
		// It does not translate n into sequential image options, so this portable
		// contract remains one image. See https://www.volcengine.com/docs/82379/1824121.
		return ImageModelCapabilities{
			Family: ImageModelFamilySeedream, Operations: []string{"generation"}, MaxOutputImages: 1,
			OutputFormats: []string{"png", "jpeg"}, HasSizeParameter: true,
			HasOutputFormatParameter: true, HasWatermarkParameter: true,
		}
	case strings.Contains(normalized, "qwen-image-edit"):
		return ImageModelCapabilities{
			Family: ImageModelFamilyAliImage, Operations: []string{"edit"}, MaxReferenceImages: MaxImageInputURLs,
			MaxOutputImages: MaxImageGenerationCount, HasSizeParameter: true, HasWatermarkParameter: true,
			ReferenceImagesRequired: true,
			AdditionalParameters:    aliImageAdditionalParameters(),
		}
	case strings.Contains(normalized, "qwen-image") || strings.Contains(normalized, "z-image") ||
		strings.Contains(normalized, "wanx-v1") || strings.Contains(normalized, "wan2.6") || strings.Contains(normalized, "wan2.7"):
		maxReferenceImages := 0
		if strings.Contains(normalized, "qwen-image") || strings.Contains(normalized, "z-image") ||
			strings.Contains(normalized, "wan2.6") || strings.Contains(normalized, "wan2.7") {
			maxReferenceImages = MaxImageInputURLs
		}
		return ImageModelCapabilities{
			Family: ImageModelFamilyAliImage, Operations: operations, MaxOutputImages: MaxImageGenerationCount,
			MaxReferenceImages: maxReferenceImages, HasSizeParameter: true, HasWatermarkParameter: true,
			AdditionalParameters: aliImageAdditionalParameters(),
		}
	case strings.Contains(normalized, "jimeng_"):
		return ImageModelCapabilities{
			Family: ImageModelFamilyJimeng, Operations: []string{"generation", "edit"},
			MaxReferenceImages: MaxImageInputURLs, MaxOutputImages: 1,
			AdditionalParameters: jimengImageAdditionalParameters(),
		}
	case strings.Contains(normalized, "instantx/instantid") || strings.Contains(normalized, "bytedance/sdxl-lightning"):
		return ImageModelCapabilities{
			Family: ImageModelFamilySiliconFlow, Operations: []string{"generation", "edit"},
			MaxReferenceImages: 3, MaxOutputImages: MaxImageGenerationCount, HasSizeParameter: true,
			AdditionalParameters: siliconFlowImageAdditionalParameters(),
		}
	default:
		maxReferenceImages := 0
		if len(operations) == 1 && operations[0] == "edit" {
			maxReferenceImages = MaxImageInputURLs
		}
		return ImageModelCapabilities{
			Family: ImageModelFamilyGeneric, Operations: operations,
			MaxReferenceImages: maxReferenceImages, MaxOutputImages: 1,
			ReferenceImagesRequired: len(operations) == 1 && operations[0] == "edit",
		}
	}
}

// ImageModelCapabilitiesForChannel applies provider-specific guarantees to a
// model profile. A model name can be routed through more than one adaptor, so
// pricing intersects these channel views before publishing its API contract.
func ImageModelCapabilitiesForChannel(model string, channelType int) ImageModelCapabilities {
	capabilities := ImageModelCapabilitiesForModel(model)
	switch channelType {
	case constant.ChannelTypeOpenAI:
		if capabilities.Family == ImageModelFamilyGPTImage || capabilities.Family == ImageModelFamilyGPTImage2 {
			capabilities.MaxOutputImages = 1
		}
	case constant.ChannelTypeMiniMax, constant.ChannelTypeXai:
		capabilities.Operations = []string{"generation"}
		capabilities.MaxReferenceImages = 0
		capabilities.ReferenceImagesRequired = false
	case constant.ChannelTypeReplicate:
		if capabilities.Family == ImageModelFamilyFlux {
			capabilities.Operations = []string{"generation"}
			capabilities.AspectRatios = append([]string(nil), fluxImageAspectRatios...)
			capabilities.Qualities = []string{"hd", "high"}
			capabilities.HasAspectRatioParameter = true
			capabilities.HasQualityParameter = true
			capabilities.HasOutputFormatParameter = true
			capabilities.MaxReferenceImages = 0
			capabilities.ReferenceImagesRequired = false
		}
	case constant.ChannelTypeSiliconFlow:
		if capabilities.Family == ImageModelFamilyFlux || capabilities.Family == ImageModelFamilySiliconFlow {
			capabilities.Operations = []string{"generation", "edit"}
			capabilities.AspectRatios = nil
			capabilities.Resolutions = nil
			capabilities.Qualities = nil
			capabilities.OutputFormats = nil
			capabilities.ResolutionAspectVariants = nil
			capabilities.DefaultAspectRatio = ""
			capabilities.DefaultResolution = ""
			capabilities.DefaultQuality = ""
			capabilities.DefaultOutputFormat = ""
			capabilities.HasAspectRatioParameter = false
			capabilities.HasResolutionParameter = false
			capabilities.HasQualityParameter = false
			capabilities.HasOutputFormatParameter = false
			capabilities.MaxReferenceImages = 3
			capabilities.MaxOutputImages = MaxImageGenerationCount
			capabilities.HasSizeParameter = true
			capabilities.AdditionalParameters = siliconFlowImageAdditionalParameters()
		}
	case constant.ChannelTypeJimeng:
		capabilities.MaxOutputImages = minPositiveImageCapability(capabilities.MaxOutputImages, 1)
	}
	return capabilities
}

// IntersectImageModelCapabilities returns only behavior supported by both
// routes. Slice order follows the left-hand profile so the UI stays stable.
func IntersectImageModelCapabilities(left, right ImageModelCapabilities) ImageModelCapabilities {
	result := left
	result.Operations = intersectImageCapabilityStrings(left.Operations, right.Operations)
	result.AspectRatios = intersectImageCapabilityStrings(left.AspectRatios, right.AspectRatios)
	result.Resolutions = intersectImageCapabilityStrings(left.Resolutions, right.Resolutions)
	result.Sizes = intersectImageCapabilityStrings(left.Sizes, right.Sizes)
	result.Qualities = intersectImageCapabilityStrings(left.Qualities, right.Qualities)
	result.OutputFormats = intersectImageCapabilityStrings(left.OutputFormats, right.OutputFormats)
	result.MaxReferenceImages = minImageCapability(left.MaxReferenceImages, right.MaxReferenceImages)
	result.MaxOutputImages = minPositiveImageCapability(left.MaxOutputImages, right.MaxOutputImages)
	result.DefaultAspectRatio = intersectImageCapabilityDefault(left.DefaultAspectRatio, right.DefaultAspectRatio, result.AspectRatios)
	result.DefaultResolution = intersectImageCapabilityDefault(left.DefaultResolution, right.DefaultResolution, result.Resolutions)
	result.DefaultSize = intersectImageCapabilityDefault(left.DefaultSize, right.DefaultSize, result.Sizes)
	result.DefaultQuality = intersectImageCapabilityDefault(left.DefaultQuality, right.DefaultQuality, result.Qualities)
	result.DefaultOutputFormat = intersectImageCapabilityDefault(left.DefaultOutputFormat, right.DefaultOutputFormat, result.OutputFormats)
	result.ResolutionAspectVariants = intersectImageCapabilityVariants(left.ResolutionAspectVariants, right.ResolutionAspectVariants)
	result.HasAspectRatioParameter = left.HasAspectRatioParameter && right.HasAspectRatioParameter
	result.HasResolutionParameter = left.HasResolutionParameter && right.HasResolutionParameter
	result.HasSizeParameter = left.HasSizeParameter && right.HasSizeParameter
	result.HasQualityParameter = left.HasQualityParameter && right.HasQualityParameter
	result.HasOutputFormatParameter = left.HasOutputFormatParameter && right.HasOutputFormatParameter
	result.HasWatermarkParameter = left.HasWatermarkParameter && right.HasWatermarkParameter
	result.HasOutputCompression = left.HasOutputCompression && right.HasOutputCompression
	result.HasBackgroundParameter = left.HasBackgroundParameter && right.HasBackgroundParameter
	result.HasModerationParameter = left.HasModerationParameter && right.HasModerationParameter
	result.ReferenceImagesRequired = left.ReferenceImagesRequired || right.ReferenceImagesRequired
	result.AdditionalParameters = intersectImageAPIParameters(left.AdditionalParameters, right.AdditionalParameters)
	if result.MaxReferenceImages == 0 {
		result.ReferenceImagesRequired = false
	}
	return result
}

func intersectImageCapabilityStrings(left, right []string) []string {
	values := make([]string, 0, len(left))
	for _, value := range left {
		if stringSliceContains(right, value) {
			values = append(values, value)
		}
	}
	return values
}

func intersectImageCapabilityDefault(left, right string, allowed []string) string {
	if left == "" || left != right {
		return ""
	}
	if len(allowed) > 0 && !stringSliceContains(allowed, left) {
		return ""
	}
	return left
}

func intersectImageCapabilityVariants(left, right []ImageSizeCombination) []ImageSizeCombination {
	variants := make([]ImageSizeCombination, 0, len(left))
	for _, leftVariant := range left {
		for _, rightVariant := range right {
			if leftVariant == rightVariant {
				variants = append(variants, leftVariant)
				break
			}
		}
	}
	return variants
}

func intersectImageAPIParameters(left, right []ImageAPIParameter) []ImageAPIParameter {
	parameters := make([]ImageAPIParameter, 0, len(left))
	for _, leftParameter := range left {
		for _, rightParameter := range right {
			if leftParameter.Name != rightParameter.Name || leftParameter.Type != rightParameter.Type {
				continue
			}
			parameter := leftParameter
			parameter.Required = leftParameter.Required || rightParameter.Required
			parameter.EnumValues = intersectImageCapabilityStrings(leftParameter.EnumValues, rightParameter.EnumValues)
			parameter.Min = maxImageParameterBound(leftParameter.Min, rightParameter.Min)
			parameter.Max = minImageParameterBound(leftParameter.Max, rightParameter.Max)
			parameter.MaxItems = minImageParameterBound(leftParameter.MaxItems, rightParameter.MaxItems)
			if parameter.Type == "enum" && len(parameter.EnumValues) == 0 {
				break
			}
			if parameter.Min != nil && parameter.Max != nil && *parameter.Min > *parameter.Max {
				break
			}
			if parameter.MaxItems != nil && *parameter.MaxItems <= 0 {
				break
			}
			if !reflect.DeepEqual(leftParameter.Default, rightParameter.Default) {
				parameter.Default = nil
				parameter.Required = true
			}
			parameters = append(parameters, parameter)
			break
		}
	}
	return parameters
}

func minImageCapability(left, right int) int {
	if left < right {
		return left
	}
	return right
}

func minPositiveImageCapability(left, right int) int {
	if left <= 0 {
		return right
	}
	if right <= 0 || right < left {
		return right
	}
	return left
}

func maxImageParameterBound(left, right *int) *int {
	if left == nil {
		return right
	}
	if right == nil || *left >= *right {
		return left
	}
	return right
}

func minImageParameterBound(left, right *int) *int {
	if left == nil {
		return right
	}
	if right == nil || *left <= *right {
		return left
	}
	return right
}

func imageOperationsForModel(model string) []string {
	if strings.HasSuffix(model, "-image-to-image") || strings.Contains(model, "image-edit") {
		return []string{"edit"}
	}
	return []string{"generation"}
}

func aliImageAdditionalParameters() []ImageAPIParameter {
	return []ImageAPIParameter{
		{Name: "parameters", Type: "object", Description: "Provider-specific image parameters passed to the Ali image API."},
	}
}

func jimengImageAdditionalParameters() []ImageAPIParameter {
	return []ImageAPIParameter{
		{Name: "extra_fields", Type: "object", Description: "Provider-specific image parameters passed to the Jimeng image API."},
	}
}

func siliconFlowImageAdditionalParameters() []ImageAPIParameter {
	minimumOne := 1
	maximumImages := MaxImageGenerationCount
	return []ImageAPIParameter{
		{Name: "negative_prompt", Type: "string", Description: "Content that should not appear in the generated image."},
		{Name: "batch_size", Type: "integer", Min: &minimumOne, Max: &maximumImages, Description: "Number of images requested from the SiliconFlow adaptor."},
		{Name: "seed", Type: "integer", Description: "Random seed used by the image model."},
		{Name: "num_inference_steps", Type: "integer", Min: &minimumOne, Description: "Number of denoising steps used by the image model."},
		{Name: "guidance_scale", Type: "number", Description: "Guidance scale used by the image model."},
		{Name: "cfg", Type: "number", Description: "Classifier-free guidance value used by the image model."},
	}
}

func imageVariantSizes(variants []ImageSizeCombination) []string {
	sizes := make([]string, 0, len(variants))
	for _, variant := range variants {
		if variant.Size == "" || stringSliceContains(sizes, variant.Size) {
			continue
		}
		sizes = append(sizes, variant.Size)
	}
	return sizes
}

func (capabilities ImageModelCapabilities) SupportsAspectRatio(value string) bool {
	return stringSliceContains(capabilities.AspectRatios, strings.ToLower(strings.TrimSpace(value)))
}

func (capabilities ImageModelCapabilities) SupportsResolution(value string) bool {
	return stringSliceContains(capabilities.Resolutions, strings.ToUpper(strings.TrimSpace(value)))
}

func (capabilities ImageModelCapabilities) SupportsSize(value string) bool {
	return stringSliceContains(capabilities.Sizes, strings.TrimSpace(value))
}

func (capabilities ImageModelCapabilities) SupportsQuality(value string) bool {
	return stringSliceContains(capabilities.Qualities, strings.ToLower(strings.TrimSpace(value)))
}

func (capabilities ImageModelCapabilities) SizeFor(resolution, aspectRatio string) (string, bool) {
	resolution = strings.ToUpper(strings.TrimSpace(resolution))
	aspectRatio = strings.ToLower(strings.TrimSpace(aspectRatio))
	for _, variant := range capabilities.ResolutionAspectVariants {
		if variant.Resolution == resolution && variant.AspectRatio == aspectRatio {
			return variant.Size, true
		}
	}
	return "", false
}

func (capabilities ImageModelCapabilities) MaxResolution() string {
	maximum := ""
	maximumRank := 0
	for _, resolution := range capabilities.Resolutions {
		if rank := ImageResolutionRank(resolution); rank > maximumRank {
			maximum = resolution
			maximumRank = rank
		}
	}
	return maximum
}

func ImageResolutionRank(value string) int {
	switch strings.ToUpper(strings.TrimSpace(value)) {
	case "512":
		return 1
	case "1K":
		return 2
	case "2K":
		return 3
	case "4K":
		return 4
	default:
		return 0
	}
}

func IsKnownNativeImageAspectRatio(value string) bool {
	return stringSliceContains(allNativeImageAspectRatios, strings.ToLower(strings.TrimSpace(value)))
}

func IsKnownNativeImageResolution(value string) bool {
	return ImageResolutionRank(value) != 0
}

func stringSliceContains(values []string, value string) bool {
	for _, candidate := range values {
		if candidate == value {
			return true
		}
	}
	return false
}

func ImageAPIProfileForModel(model string) *ImageAPIProfile {
	capabilities := ImageModelCapabilitiesForModel(model)
	return ImageAPIProfileForCapabilities(capabilities)
}

// ImageAPIProfileForCapabilities renders the public, model-neutral image API
// contract from a capability set. Keeping this separate lets pricing narrow a
// profile when one model is routed through several providers.
func ImageAPIProfileForCapabilities(capabilities ImageModelCapabilities) *ImageAPIProfile {
	minimumOne := 1
	maxPrompt := MaxImagePromptCharacters
	maxOutputs := capabilities.MaxOutputImages
	if maxOutputs <= 0 {
		maxOutputs = 1
	}
	parameters := []ImageAPIParameter{
		{
			Name: "prompt", Type: "string", Required: true, Max: &maxPrompt,
			Description: "Text description of the image to generate.",
		},
	}
	if capabilities.MaxReferenceImages > 0 {
		maxItems := capabilities.MaxReferenceImages
		parameters = append(parameters, ImageAPIParameter{
			Name: "image_input", Type: "array", Required: capabilities.ReferenceImagesRequired, MaxItems: &maxItems,
			Description: "Reference image URLs for image editing or guidance.",
		})
	}
	if capabilities.HasAspectRatioParameter || len(capabilities.AspectRatios) > 0 {
		parameters = append(parameters, ImageAPIParameter{
			Name: "aspect_ratio", Type: imageParameterType(capabilities.AspectRatios), Default: optionalImageParameterDefault(capabilities.DefaultAspectRatio),
			EnumValues:  append([]string(nil), capabilities.AspectRatios...),
			Description: "Aspect ratio of the generated image.",
		})
	}
	if capabilities.HasResolutionParameter || len(capabilities.Resolutions) > 0 {
		parameters = append(parameters, ImageAPIParameter{
			Name: "resolution", Type: imageParameterType(capabilities.Resolutions), Default: optionalImageParameterDefault(capabilities.DefaultResolution),
			EnumValues:  append([]string(nil), capabilities.Resolutions...),
			Description: "Resolution tier of the generated image.",
		})
	}
	if capabilities.HasSizeParameter || len(capabilities.Sizes) > 0 {
		parameters = append(parameters, ImageAPIParameter{
			Name: "size", Type: imageParameterType(capabilities.Sizes), Default: optionalImageParameterDefault(capabilities.DefaultSize),
			EnumValues:  append([]string(nil), capabilities.Sizes...),
			Description: "Legacy pixel-size alias for aspect_ratio and resolution.",
		})
	}
	if capabilities.HasQualityParameter || len(capabilities.Qualities) > 0 {
		parameters = append(parameters, ImageAPIParameter{
			Name: "quality", Type: imageParameterType(capabilities.Qualities), Default: optionalImageParameterDefault(capabilities.DefaultQuality),
			EnumValues:  append([]string(nil), capabilities.Qualities...),
			Description: "Generation quality preset.",
		})
	}
	parameters = append(parameters, ImageAPIParameter{
		Name: "n", Type: "integer", Default: 1, Min: &minimumOne, Max: &maxOutputs,
		Description: "Number of images to generate.",
	})
	if capabilities.HasOutputFormatParameter || len(capabilities.OutputFormats) > 0 {
		parameters = append(parameters, ImageAPIParameter{
			Name: "output_format", Type: imageParameterType(capabilities.OutputFormats), Default: optionalImageParameterDefault(capabilities.DefaultOutputFormat),
			EnumValues:  append([]string(nil), capabilities.OutputFormats...),
			Description: "Generated image file format.",
		})
	}
	if capabilities.HasWatermarkParameter {
		parameters = append(parameters, ImageAPIParameter{
			Name: "watermark", Type: "boolean", Description: "Whether to add a provider watermark to the generated image.",
		})
	}
	if capabilities.HasOutputCompression {
		maximumCompression := 100
		minimumCompression := 0
		parameters = append(parameters, ImageAPIParameter{
			Name: "output_compression", Type: "integer", Min: &minimumCompression, Max: &maximumCompression,
			Description: "Compression level for JPEG or WebP output.",
		})
	}
	if capabilities.HasBackgroundParameter {
		parameters = append(parameters, ImageAPIParameter{
			Name: "background", Type: "enum", EnumValues: []string{"auto", "opaque", "transparent"}, Default: "auto",
			Description: "Background treatment for the generated image.",
		})
	}
	if capabilities.HasModerationParameter {
		parameters = append(parameters, ImageAPIParameter{
			Name: "moderation", Type: "enum", EnumValues: []string{"auto", "low"}, Default: "low",
			Description: "Safety moderation level applied by the image model.",
		})
	}
	parameters = append(parameters, cloneImageAPIParameters(capabilities.AdditionalParameters)...)
	parameters = append(parameters,
		ImageAPIParameter{
			Name: "response_format", Type: "enum", Default: "url", EnumValues: []string{"url"},
			Description: "Completed tasks return durable object-storage URLs.",
		},
		ImageAPIParameter{
			Name: "webhook_url", Type: "string",
			Description: "Optional URL that receives task completion notifications.",
		},
		ImageAPIParameter{
			Name: "webhook_secret", Type: "string",
			Description: "Optional secret used to sign webhook deliveries.",
		},
	)

	profile := &ImageAPIProfile{
		Kind: "image", Endpoint: ImageGenerationEndpoint, Async: true,
		PollEndpoint: ImageGenerationPollPath, Webhook: true,
		ResultDelivery: ImageResultDeliveryOSSURL,
		Operations:     append([]string(nil), capabilities.Operations...),
		Parameters:     parameters,
	}
	if len(capabilities.ResolutionAspectVariants) > 0 {
		fields := make([]string, 0, 3)
		for _, variant := range capabilities.ResolutionAspectVariants {
			if variant.Operation != "" && !stringSliceContains(fields, "operation") {
				fields = append(fields, "operation")
			}
			if variant.Resolution != "" && !stringSliceContains(fields, "resolution") {
				fields = append(fields, "resolution")
			}
			if variant.AspectRatio != "" && !stringSliceContains(fields, "aspect_ratio") {
				fields = append(fields, "aspect_ratio")
			}
			if variant.Size != "" && !stringSliceContains(fields, "size") {
				fields = append(fields, "size")
			}
			if variant.Quality != "" && !stringSliceContains(fields, "quality") {
				fields = append(fields, "quality")
			}
			if variant.OutputFormat != "" && !stringSliceContains(fields, "output_format") {
				fields = append(fields, "output_format")
			}
		}
		profile.Constraints = []ImageAPIConstraint{{
			Type: "allowed_combinations", Fields: fields,
			Combinations: append([]ImageSizeCombination(nil), capabilities.ResolutionAspectVariants...),
		}}
	}
	return profile
}

func imageParameterType(values []string) string {
	if len(values) > 0 {
		return "enum"
	}
	return "string"
}

func optionalImageParameterDefault(value string) any {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	return value
}

func cloneImageAPIParameters(parameters []ImageAPIParameter) []ImageAPIParameter {
	cloned := make([]ImageAPIParameter, len(parameters))
	for i, parameter := range parameters {
		cloned[i] = parameter
		cloned[i].EnumValues = append([]string(nil), parameter.EnumValues...)
	}
	return cloned
}
