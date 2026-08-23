package gemini

import "strings"

func IsImagenPredictModel(model string) bool {
	return strings.HasPrefix(normalizeGeminiModelID(model), "imagen")
}

func IsGenerateContentImageModel(model string, supportsImagine func(string) bool) bool {
	name := normalizeGeminiModelID(model)
	if name == "" || IsImagenPredictModel(name) {
		return false
	}
	compactName := compactGeminiModelID(name)
	if strings.Contains(name, "nano-banana") ||
		strings.Contains(compactName, "nanobanana") ||
		strings.Contains(name, "-image") ||
		strings.Contains(name, "image-generation") {
		return true
	}
	return supportsImagine != nil && supportsImagine(model)
}

func normalizeGeminiModelID(model string) string {
	name := strings.ToLower(strings.TrimSpace(model))
	name = strings.TrimPrefix(name, "models/")
	if separator := strings.LastIndex(name, "/"); separator >= 0 {
		name = name[separator+1:]
	}
	return name
}

func compactGeminiModelID(model string) string {
	name := strings.ReplaceAll(model, "-", "")
	name = strings.ReplaceAll(name, "_", "")
	return strings.ReplaceAll(name, " ", "")
}

func AspectRatioFromOpenAIImageSize(size string) string {
	size = strings.TrimSpace(size)
	if size == "" {
		return "1:1"
	}
	if strings.Contains(size, ":") {
		return size
	}
	switch size {
	case "256x256", "512x512", "1024x1024":
		return "1:1"
	case "1536x1024":
		return "3:2"
	case "1024x1536":
		return "2:3"
	case "1024x1792":
		return "9:16"
	case "1792x1024":
		return "16:9"
	default:
		return "1:1"
	}
}

func ImageSizeFromOpenAIQuality(quality string) string {
	switch strings.TrimSpace(quality) {
	case "hd", "high", "2K", "2k":
		return "2K"
	case "4K", "4k":
		return "4K"
	default:
		return "1K"
	}
}
