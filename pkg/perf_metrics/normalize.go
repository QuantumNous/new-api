package perfmetrics

import "strings"

// NormalizeModelName folds model identifiers for perf storage and lookup.
// Pricing / abilities may store mixed casings of the same model
// (e.g. deepseek-v4-flash vs Deepseek-V4-Flash); health metrics must key
// them together so badges and detail views resolve real samples.
//
// Only case + surrounding whitespace are changed — path-style names and
// free-tier suffixes stay distinct (a/b, :free, [free]).
func NormalizeModelName(name string) string {
	return strings.ToLower(strings.TrimSpace(name))
}

// IsChatCapableModelName reports whether a model name is suitable for the
// model-square health summary. Image / audio / video / embedding / rerank
// probes produce noisy keys that should not pollute the chat health view.
// Kept here (not controller) so QuerySummaryAll can filter without import cycles.
func IsChatCapableModelName(name string) bool {
	name = NormalizeModelName(name)
	if name == "" {
		return false
	}
	if isImageLikeModelName(name) || isAudioOrVideoLikeModelName(name) || isEmbeddingOrRerankModelName(name) {
		return false
	}
	return true
}

func isImageLikeModelName(name string) bool {
	imageHints := []string{
		"gpt-image", "dall-e", "dalle", "seedream", "flux", "imagen",
		"stable-diffusion", "sdxl", "midjourney", "mj-", "image-gen",
		"text-to-image", "t2i", "cogview", "kolors", "playground-v",
	}
	for _, h := range imageHints {
		if strings.Contains(name, h) {
			return true
		}
	}
	if strings.Contains(name, "image") &&
		!strings.Contains(name, "vision") &&
		!strings.Contains(name, "chat") &&
		!strings.Contains(name, "embedding") {
		return true
	}
	return false
}

func isAudioOrVideoLikeModelName(name string) bool {
	hints := []string{
		"whisper", "tts-", "tts_", "-tts", "speech", "audio-", "-audio",
		"sora", "kling", "runway", "luma", "hailuo", "vidu", "cogvideo",
		"text-to-video", "t2v", "minimax-video",
	}
	for _, h := range hints {
		if strings.Contains(name, h) {
			return true
		}
	}
	return false
}

func isEmbeddingOrRerankModelName(name string) bool {
	if strings.Contains(name, "rerank") {
		return true
	}
	if strings.Contains(name, "embedding") ||
		strings.Contains(name, "embed") ||
		strings.HasPrefix(name, "m3e") ||
		strings.Contains(name, "bge-") ||
		strings.Contains(name, "text-embedding") {
		return true
	}
	return false
}
