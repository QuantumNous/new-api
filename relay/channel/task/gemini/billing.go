package gemini

import (
	"strconv"
	"strings"
)

// ParseVeoDurationSeconds extracts durationSeconds from metadata.
// Returns 8 (Veo default) when not specified or invalid.
func ParseVeoDurationSeconds(metadata map[string]any) int {
	if metadata == nil {
		return 8
	}
	v, ok := metadata["durationSeconds"]
	if !ok {
		return 8
	}
	switch n := v.(type) {
	case float64:
		if int(n) > 0 {
			return int(n)
		}
	case int:
		if n > 0 {
			return n
		}
	}
	return 8
}

// ParseVeoResolution extracts resolution from metadata.
// Returns "720p" when not specified.
func ParseVeoResolution(metadata map[string]any) string {
	if metadata == nil {
		return "720p"
	}
	v, ok := metadata["resolution"]
	if !ok {
		return "720p"
	}
	if s, ok := v.(string); ok && s != "" {
		return strings.ToLower(s)
	}
	return "720p"
}

// ResolveVeoDuration returns the effective duration in seconds.
// Priority: metadata["durationSeconds"] > stdDuration > stdSeconds > default (8).
func ResolveVeoDuration(metadata map[string]any, stdDuration int, stdSeconds string) int {
	if metadata != nil {
		if _, exists := metadata["durationSeconds"]; exists {
			if d := ParseVeoDurationSeconds(metadata); d > 0 {
				return d
			}
		}
	}
	if stdDuration > 0 {
		return stdDuration
	}
	if s, err := strconv.Atoi(stdSeconds); err == nil && s > 0 {
		return s
	}
	return 8
}

// ResolveVeoResolution returns the effective resolution string (lowercase).
// Priority: metadata["resolution"] > SizeToVeoResolution(stdSize) > default ("720p").
func ResolveVeoResolution(metadata map[string]any, stdSize string) string {
	if metadata != nil {
		if _, exists := metadata["resolution"]; exists {
			if r := ParseVeoResolution(metadata); r != "" {
				return r
			}
		}
	}
	if stdSize != "" {
		return SizeToVeoResolution(stdSize)
	}
	return "720p"
}

// SizeToVeoResolution converts a "WxH" size string to a Veo resolution label.
func SizeToVeoResolution(size string) string {
	parts := strings.SplitN(strings.ToLower(size), "x", 2)
	if len(parts) != 2 {
		return "720p"
	}
	w, _ := strconv.Atoi(parts[0])
	h, _ := strconv.Atoi(parts[1])
	maxDim := w
	if h > maxDim {
		maxDim = h
	}
	if maxDim >= 3840 {
		return "4k"
	}
	if maxDim >= 1920 {
		return "1080p"
	}
	return "720p"
}

// SizeToVeoAspectRatio converts a "WxH" size string to a Veo aspect ratio.
func SizeToVeoAspectRatio(size string) string {
	parts := strings.SplitN(strings.ToLower(size), "x", 2)
	if len(parts) != 2 {
		return "16:9"
	}
	w, _ := strconv.Atoi(parts[0])
	h, _ := strconv.Atoi(parts[1])
	if w <= 0 || h <= 0 {
		return "16:9"
	}
	if h > w {
		return "9:16"
	}
	return "16:9"
}

// Veo 4K 倍率常量（来源：Vertex AI 官方定价 video+audio base）：
//   - veo-3.1-fast-generate: $0.35 / $0.15 ≈ 2.333（4K 相对标准分辨率）
//   - veo-3.1-generate:      $0.60 / $0.40 = 1.5
//   - veo-3.0 系列：不支持 4K，回退 1.0
const (
	veo4KRatioFast     = 2.333333 // 3.1 fast 系列 4K 倍率
	veo4KRatioGenerate = 1.5      // 3.1 generate 系列 4K 倍率
	veoRatioDefault    = 1.0      // 标准分辨率 / 不支持 4K 的模型
)

// veo4KModelRatios 当前已知 Veo 模型的 4K 倍率显式映射（替代原 strings.Contains 模糊匹配）。
// 已枚举 GetModelList() 中的全部 4 个模型；其中 veo-3.0 系列不支持 4K，倍率为 1.0。
var veo4KModelRatios = map[string]float64{
	"veo-3.0-generate-001":          veoRatioDefault, // 3.0 不支持 4K
	"veo-3.0-fast-generate-001":     veoRatioDefault, // 3.0 不支持 4K
	"veo-3.1-generate-preview":      veo4KRatioGenerate,
	"veo-3.1-fast-generate-preview": veo4KRatioFast,
}

// VeoResolutionRatio returns the pricing multiplier for the given resolution.
// Standard resolutions (720p, 1080p) return 1.0.
// 4K returns a model-specific multiplier based on Google's official pricing.
//
// 优先用 veo4KModelRatios 精确命中已知模型；未命中时保留原 strings.Contains("3.1")
// 模糊回退，保证后续新增的 3.1 变体（如带不同后缀）行为与外置前字节级一致，避免漏配错算。
func VeoResolutionRatio(modelName, resolution string) float64 {
	if resolution != "4k" {
		return veoRatioDefault
	}
	if ratio, ok := veo4KModelRatios[modelName]; ok {
		return ratio
	}
	// 未在显式表中的模型：维持原模糊匹配回退顺序（fast-generate 优先于 generate/3.1）。
	if strings.Contains(modelName, "3.1-fast-generate") {
		return veo4KRatioFast
	}
	if strings.Contains(modelName, "3.1-generate") || strings.Contains(modelName, "3.1") {
		return veo4KRatioGenerate
	}
	return veoRatioDefault
}
