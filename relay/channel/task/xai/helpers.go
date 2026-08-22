package xai

import (
	"strconv"
	"strings"
)

const defaultVideoDurationSeconds = 8

// ResolveDurationSeconds returns the effective duration in seconds.
// Priority: metadata.duration > stdDuration > stdSeconds > default (8).
func ResolveDurationSeconds(metadata map[string]any, stdDuration int, stdSeconds string) int {
	if metadata != nil {
		if v, ok := metadata["duration"]; ok {
			switch n := v.(type) {
			case float64:
				if int(n) > 0 {
					return int(n)
				}
			case int:
				if n > 0 {
					return n
				}
			case string:
				if i, err := strconv.Atoi(n); err == nil && i > 0 {
					return i
				}
			}
		}
	}
	if stdDuration > 0 {
		return stdDuration
	}
	if s, err := strconv.Atoi(stdSeconds); err == nil && s > 0 {
		return s
	}
	return defaultVideoDurationSeconds
}

// ResolveAspectRatio returns the effective aspect ratio string.
// Priority: metadata.aspect_ratio > SizeToAspectRatio(stdSize) > default ("16:9").
func ResolveAspectRatio(metadata map[string]any, stdSize string) string {
	if metadata != nil {
		if v, ok := metadata["aspect_ratio"]; ok {
			if s, ok := v.(string); ok && strings.TrimSpace(s) != "" {
				return strings.TrimSpace(s)
			}
		}
		if v, ok := metadata["aspectRatio"]; ok {
			if s, ok := v.(string); ok && strings.TrimSpace(s) != "" {
				return strings.TrimSpace(s)
			}
		}
	}
	if stdSize != "" {
		return SizeToAspectRatio(stdSize)
	}
	return "16:9"
}

// ResolveResolution returns the effective resolution string.
// Priority: metadata.resolution > SizeToResolution(stdSize) > default ("720p").
func ResolveResolution(metadata map[string]any, stdSize string) string {
	if metadata != nil {
		if v, ok := metadata["resolution"]; ok {
			if s, ok := v.(string); ok && strings.TrimSpace(s) != "" {
				return strings.ToLower(strings.TrimSpace(s))
			}
		}
	}
	if stdSize != "" {
		return SizeToResolution(stdSize)
	}
	return "720p"
}

// SizeToAspectRatio converts a "WxH" size string to an aspect ratio label.
func SizeToAspectRatio(size string) string {
	parts := strings.SplitN(strings.ToLower(strings.TrimSpace(size)), "x", 2)
	if len(parts) != 2 {
		return "16:9"
	}
	w, _ := strconv.Atoi(parts[0])
	h, _ := strconv.Atoi(parts[1])
	if w <= 0 || h <= 0 {
		return "16:9"
	}
	if w == h {
		return "1:1"
	}
	if w > h {
		return "16:9"
	}
	return "9:16"
}

// SizeToResolution converts a "WxH" size string to a resolution label used by xAI.
func SizeToResolution(size string) string {
	parts := strings.SplitN(strings.ToLower(strings.TrimSpace(size)), "x", 2)
	if len(parts) != 2 {
		return "720p"
	}
	w, _ := strconv.Atoi(parts[0])
	h, _ := strconv.Atoi(parts[1])
	maxDim := w
	if h > maxDim {
		maxDim = h
	}
	if maxDim >= 1920 {
		return "1080p"
	}
	return "720p"
}
