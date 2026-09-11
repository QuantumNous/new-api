package status_check_setting

import (
	"strings"

	"github.com/QuantumNous/new-api/setting/config"
)

// StatusCheckSetting governs the /api/status-check group-health page and its
// background probe job. Mirrors the perf_metrics_setting wiring so the option
// store loads/saves it under the status_check_setting.<field> key namespace.
type StatusCheckSetting struct {
	Enabled               bool   `json:"enabled"`                // default false — admin flips on after wiring groups
	ProbeIntervalMinutes  int    `json:"probe_interval_minutes"` // default 10 (keep宽松 to dodge upstream rate-limit)
	Groups                string `json:"groups"`                 // comma-separated group names probed
	ExcludedModels        string `json:"excluded_models"`         // comma-separated model slugs to skip
	Announcement          string `json:"announcement"`            // markdown body shown at top of /status
	PassiveWindowHours    int    `json:"passive_window_hours"`    // default 24, perf_metrics merge window
}

var statusCheckSetting = StatusCheckSetting{
	Enabled:               false,
	ProbeIntervalMinutes:  10,
	Groups:                "default",
	ExcludedModels:        "",
	Announcement:          "",
	PassiveWindowHours:    24,
}

func init() {
	config.GlobalConfig.Register("status_check_setting", &statusCheckSetting)
}

func GetSetting() StatusCheckSetting { return statusCheckSetting }

// GetGroups returns the configured probe groups with empty entries trimmed.
// Empty result yields {"default"} so a freshly-installed instance still has a
// sane target instead of probing zero groups.
func GetGroups() []string {
	raw := strings.TrimSpace(statusCheckSetting.Groups)
	if raw == "" {
		return []string{"default"}
	}
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if t := strings.TrimSpace(p); t != "" {
			out = append(out, t)
		}
	}
	if len(out) == 0 {
		return []string{"default"}
	}
	return out
}

// GetExcludedModelsMap builds a set lookup; nil/empty map means "no exclusions".
func GetExcludedModelsMap() map[string]struct{} {
	raw := strings.TrimSpace(statusCheckSetting.ExcludedModels)
	if raw == "" {
		return nil
	}
	m := map[string]struct{}{}
	for _, p := range strings.Split(raw, ",") {
		if t := strings.TrimSpace(p); t != "" {
			m[t] = struct{}{}
		}
	}
	if len(m) == 0 {
		return nil
	}
	return m
}

func GetIntervalMinutes() int {
	if statusCheckSetting.ProbeIntervalMinutes < 1 {
		return 10
	}
	return statusCheckSetting.ProbeIntervalMinutes
}

func GetPassiveWindowHours() int {
	if statusCheckSetting.PassiveWindowHours < 1 {
		return 24
	}
	return statusCheckSetting.PassiveWindowHours
}
