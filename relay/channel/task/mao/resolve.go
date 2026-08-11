package mao

import (
	"fmt"
	"strconv"
	"strings"
)

const (
	logicSeedance20     = "guanzhuan-seedance2.0"
	logicSeedance20Mini = "guanzhuan-seedance2.0-mini"
	logicSeedance25     = "guanzhuan-seedance2.5"
)

var supportedTiers = map[string][]string{
	logicSeedance20:     {"480p", "720p", "1080p", "4k"},
	logicSeedance20Mini: {"480p", "720p"},
	logicSeedance25:     {"480p", "720p"},
}

var upstreamPrefix = map[string]string{
	logicSeedance20:     "sd-2-0-",
	logicSeedance20Mini: "sd-2-0-mini-",
	logicSeedance25:     "sd-2-5-",
}

// normalizeTier prefers resolution over size; parses *p / 4k / WxH; defaults to 720p.
// Resolution is fully attempted first (label then WxH); size is used only if resolution
// is empty or unparseable.
func normalizeTier(resolution, size string) string {
	if tier := parseTierLabel(resolution); tier != "" {
		return tier
	}
	if tier := parseTierFromWxH(resolution); tier != "" {
		return tier
	}
	if tier := parseTierLabel(size); tier != "" {
		return tier
	}
	if tier := parseTierFromWxH(size); tier != "" {
		return tier
	}
	return "720p"
}

func parseTierLabel(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	if s == "" {
		return ""
	}
	switch s {
	case "4k", "2160p":
		return "4k"
	case "1080p", "720p", "480p":
		return s
	}
	if strings.HasSuffix(s, "p") && !strings.ContainsAny(s, "x:") {
		n, err := strconv.Atoi(strings.TrimSuffix(s, "p"))
		if err != nil {
			return ""
		}
		switch {
		case n >= 2160:
			return "4k"
		case n >= 1080:
			return "1080p"
		case n >= 720:
			return "720p"
		case n >= 480:
			return "480p"
		}
	}
	return ""
}

func parseTierFromWxH(size string) string {
	w, h, ok := parseWxH(size)
	if !ok {
		return ""
	}
	if w >= 2160 && h >= 2160 {
		return "4k"
	}
	minSide := w
	if h < w {
		minSide = h
	}
	switch {
	case minSide >= 1080:
		return "1080p"
	case minSide >= 720:
		return "720p"
	case minSide >= 480:
		return "480p"
	default:
		return "480p"
	}
}

func parseWxH(size string) (w, h int, ok bool) {
	size = strings.ToLower(strings.TrimSpace(size))
	parts := strings.Split(size, "x")
	if len(parts) != 2 {
		return 0, 0, false
	}
	w, errW := strconv.Atoi(strings.TrimSpace(parts[0]))
	h, errH := strconv.Atoi(strings.TrimSpace(parts[1]))
	if errW != nil || errH != nil || w <= 0 || h <= 0 {
		return 0, 0, false
	}
	return w, h, true
}

func resolveUpstreamModel(logic, tier string) (string, error) {
	logic = strings.TrimSpace(logic)
	tier = strings.ToLower(strings.TrimSpace(tier))
	if tier == "" {
		tier = "720p"
	}

	prefix, ok := upstreamPrefix[logic]
	if !ok {
		return "", fmt.Errorf("unsupported model: %s; supported: %s", logic, strings.Join(ModelList, ", "))
	}
	allowed, ok := supportedTiers[logic]
	if !ok {
		return "", fmt.Errorf("unsupported model: %s; supported: %s", logic, strings.Join(ModelList, ", "))
	}
	for _, t := range allowed {
		if t == tier {
			return prefix + tier, nil
		}
	}
	return "", fmt.Errorf("unsupported resolution %q for %s; supported: %s", tier, logic, strings.Join(allowed, ", "))
}

func validateDuration(logic string, sec int) error {
	if sec <= 0 {
		return nil
	}
	switch strings.TrimSpace(logic) {
	case logicSeedance20Mini:
		if sec < 4 || sec > 15 {
			return fmt.Errorf("duration for %s must be between 4 and 15 seconds", logicSeedance20Mini)
		}
	case logicSeedance25:
		if sec > 30 {
			return fmt.Errorf("duration for %s must be at most 30 seconds", logicSeedance25)
		}
	}
	return nil
}

func supportsCameraFixed(logic string) bool {
	return strings.TrimSpace(logic) != logicSeedance20Mini && isLogicModel(logic)
}

func isLogicModel(logic string) bool {
	switch strings.TrimSpace(logic) {
	case logicSeedance20, logicSeedance20Mini, logicSeedance25:
		return true
	default:
		return false
	}
}

func isPerSecondModel(logic string) bool {
	return isLogicModel(logic)
}
