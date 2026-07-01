package model

import (
	"strings"

	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

// ChannelModelLookupCandidates returns model name variants to try when selecting a channel.
func ChannelModelLookupCandidates(model string) []string {
	model = strings.TrimSpace(model)
	if model == "" {
		return nil
	}
	seen := map[string]struct{}{}
	out := make([]string, 0, 4)
	add := func(s string) {
		s = strings.TrimSpace(s)
		if s == "" {
			return
		}
		if _, ok := seen[s]; ok {
			return
		}
		seen[s] = struct{}{}
		out = append(out, s)
	}

	add(model)
	add(ratio_setting.FormatMatchingModelName(model))
	for _, alias := range seedanceModelLookupAliases(model) {
		add(alias)
	}
	return out
}

func seedanceModelLookupAliases(model string) []string {
	if !isSeedance20ModelName(model) {
		return nil
	}
	return []string{"Seedance-2.0", "Seedance 2.0"}
}

func isSeedance20ModelName(model string) bool {
	compact := strings.ToLower(strings.ReplaceAll(strings.ReplaceAll(strings.TrimSpace(model), " ", ""), "-", ""))
	return compact == "seedance2.0"
}

// TrimChannelList splits comma-separated channel list values and trims whitespace.
func TrimChannelList(raw string) []string {
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		if s := strings.TrimSpace(part); s != "" {
			out = append(out, s)
		}
	}
	return out
}
