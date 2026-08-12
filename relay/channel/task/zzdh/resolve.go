package zzdh

import (
	"fmt"
	"strconv"
	"strings"
)

const logicMinimaxH3 = "zzdh-Minimax-h3"

var h3SupportedTiers = []string{"480p", "720p", "1080p", "2k"}

var legacyUpstreamBySuffix = map[string]string{
	"480p": logicMinimaxH3 + "-480p",
	"720p": logicMinimaxH3 + "-720p",
	"1080p": logicMinimaxH3 + "-1080p",
	"2k":   logicMinimaxH3 + "-2k",
}

// normalizeTier prefers resolution over size; parses *p / 2k / WxH; defaults to 720p.
func normalizeTier(resolution, size string) string {
	return resolveClientTier(resolution, size)
}

// resolveClientTier picks delivery tier with priority:
// resolution → size → default 720p.
func resolveClientTier(resolution, size string) string {
	for _, candidate := range []string{resolution, size} {
		if tier := parseTierLabel(candidate); tier != "" {
			return tier
		}
		if tier := parseTierFromWxH(candidate); tier != "" {
			return tier
		}
	}
	return "720p"
}

func parseTierLabel(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	if s == "" {
		return ""
	}
	s = strings.ReplaceAll(s, "_", "")
	s = strings.ReplaceAll(s, " ", "")
	switch s {
	case "2k", "2048p":
		return "2k"
	case "4k", "2160p":
		// Recognized so resolveUpstreamModel can reject (H3 max is 2k).
		return "4k"
	case "1080p", "720p", "480p":
		return s
	case "1080", "720", "480":
		return s + "p"
	}
	if strings.HasSuffix(s, "p") && !strings.ContainsAny(s, "x:") {
		n, err := strconv.Atoi(strings.TrimSuffix(s, "p"))
		if err != nil {
			return ""
		}
		switch {
		case n >= 2160:
			return "4k"
		case n >= 1440:
			return "2k"
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
	minSide := w
	if h < w {
		minSide = h
	}
	switch {
	case minSide >= 2160:
		return "4k"
	case minSide >= 1440:
		return "2k"
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

// resolveUpstreamModel maps a client/logic model + tier to the ZZDH upstream model ID.
// Legacy resolution-locked names (zzdh-Minimax-h3-720p) pass through unchanged.
func resolveUpstreamModel(logic, tier string) (string, error) {
	logic = strings.TrimSpace(logic)
	if logic == "" {
		return "", fmt.Errorf("model is empty; use %s (resolution selects upstream tier)", logicMinimaxH3)
	}

	if concrete := concreteUpstreamModel(logic); concrete != "" {
		return concrete, nil
	}

	if !isLogicModel(logic) {
		return "", fmt.Errorf("unsupported model: %s; supported: %s (or legacy *-480p/*-720p/*-1080p/*-2k)", logic, logicMinimaxH3)
	}

	tier = strings.ToLower(strings.TrimSpace(tier))
	if tier == "" {
		tier = "720p"
	}
	if upstream, ok := legacyUpstreamBySuffix[tier]; ok {
		return upstream, nil
	}
	return "", fmt.Errorf("unsupported resolution %q for %s; supported: %s", tier, logic, strings.Join(h3SupportedTiers, ", "))
}

func concreteUpstreamModel(name string) string {
	compact := strings.ToLower(strings.TrimSpace(name))
	for tier, upstream := range legacyUpstreamBySuffix {
		if strings.EqualFold(name, upstream) {
			return upstream
		}
		suffix := "-" + tier
		if strings.HasSuffix(compact, suffix) || strings.Contains(compact, "h3-"+tier) {
			return upstream
		}
	}
	return ""
}

func isLogicModel(logic string) bool {
	return strings.EqualFold(strings.TrimSpace(logic), logicMinimaxH3)
}
