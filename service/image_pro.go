package service

import (
	"errors"
	"fmt"
	"math"
	"strconv"
	"strings"
)

// The upstream Pro service uses resolution tiers, not a fixed longest edge.
// In particular its 4K square preset is 2880x2880.
var proImageSizes = map[string]map[string]string{
	"gpt-image-2.5-2k": {"1:1": "2048x2048", "2:3": "1712x2560", "3:2": "2560x1712", "4:3": "2048x1536", "3:4": "1536x2048", "9:16": "1152x2048", "16:9": "2048x1152"},
	"gpt-image-2.5-4k": {"1:1": "2880x2880", "2:3": "2560x3840", "3:2": "3840x2560", "3:4": "2880x3840", "4:3": "3840x2880", "9:16": "2160x3840", "16:9": "3840x2160"},
}

func ProImageSizeForRatio(modelName, ratio string) (string, error) {
	if size := proImageSizes[modelName][ratio]; size != "" {
		return size, nil
	}
	return "", errors.New("unsupported Pro image aspect ratio; use 1:1, 2:3, 3:2, 3:4, 4:3, 9:16 or 16:9")
}

// Map an API client's aspect ratio to the tier selected by its model alias.
func ProImageRequestSize(modelName, size string) (string, error) {
	if size == "" || size == "auto" {
		return ProImageSizeForRatio(modelName, "1:1")
	}
	// Preserve the provider's slightly rounded 2:3 and 3:2 preset ratios.
	for _, sizes := range proImageSizes {
		for ratio, preset := range sizes {
			if size == preset {
				return ProImageSizeForRatio(modelName, ratio)
			}
		}
	}
	parts := strings.Split(strings.ToLower(strings.ReplaceAll(size, "×", "x")), "x")
	if len(parts) == 2 {
		w, ew := strconv.Atoi(parts[0])
		h, eh := strconv.Atoi(parts[1])
		if ew == nil && eh == nil && w > 0 && h > 0 && w <= 8192 && h <= 8192 {
			for ratio := range proImageSizes[modelName] {
				var rw, rh float64
				_, _ = fmt.Sscanf(ratio, "%f:%f", &rw, &rh)
				if math.Abs(float64(w)/float64(h)-rw/rh) < 0.005 {
					return ProImageSizeForRatio(modelName, ratio)
				}
			}
		}
	}
	return "", errors.New("unsupported Pro image size; use a supported aspect ratio in WIDTHxHEIGHT format")
}

// A Pro upstream performs its own upscale and must never enter the local GPU path.
func LocalImageUpscaleTarget(originModel, upstreamModel string) int {
	if upstreamModel == "image2.5-pro" || upstreamModel == "image2-pro" {
		return 0
	}
	return ImageUpscaleTarget(originModel)
}
