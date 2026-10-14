package operation_setting

import (
	"fmt"
	"maps"
	"slices"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
)

type UpstreamOrchestrationSetting struct {
	Enabled                   bool                `json:"enabled"`
	AutoEnroll                bool                `json:"auto_enroll"`
	TargetGroups              []string            `json:"target_groups"`
	CandidateLimit            int                 `json:"candidate_limit"`
	RequestAttemptLimit       int                 `json:"request_attempt_limit"`
	FailoverBudgetSeconds     int                 `json:"failover_budget_seconds"`
	ProbeFreshnessMinutes     int                 `json:"probe_freshness_minutes"`
	ProbeTimeoutSeconds       int                 `json:"probe_timeout_seconds"`
	ProbeConcurrencyPerSource int                 `json:"probe_concurrency_per_source"`
	FailureThreshold          int                 `json:"failure_threshold"`
	FailureWindowMinutes      int                 `json:"failure_window_minutes"`
	RedLongTermHours          int                 `json:"red_long_term_hours"`
	SyncIntervalHours         int                 `json:"sync_interval_hours"`
	DailyReconcileTime        string              `json:"daily_reconcile_time"`
	Timezone                  string              `json:"timezone"`
	MaxUpstreamMultiplier     float64             `json:"max_upstream_multiplier"`
	DetailRetentionDays       int                 `json:"detail_retention_days"`
	ManualPauseHours          int                 `json:"manual_pause_hours"`
	ShadowSuccessesRequired   int                 `json:"shadow_successes_required"`
	StaticEgressIPs           map[string][]string `json:"static_egress_ips"`
	ModelAliases              map[string]string   `json:"model_aliases"`
	ModelExclusions           map[string][]string `json:"model_exclusions"`
	ProtocolModelExclusions   map[string][]string `json:"protocol_model_exclusions"`
}

type UpstreamRoutingPolicy struct {
	TargetGroups            []string            `json:"target_groups"`
	ModelAliases            map[string]string   `json:"model_aliases"`
	ModelExclusions         map[string][]string `json:"model_exclusions"`
	ProtocolModelExclusions map[string][]string `json:"protocol_model_exclusions"`
}

const (
	UpstreamRoutingPolicyMaxJSONBytes = 128 * 1024
	upstreamRoutingPolicyMaxEntries   = 256
	upstreamRoutingPolicyMaxValueLen  = 256
)

var upstreamOrchestrationSetting = UpstreamOrchestrationSetting{
	Enabled:                   false,
	AutoEnroll:                true,
	TargetGroups:              []string{"default", "cxy"},
	CandidateLimit:            5,
	RequestAttemptLimit:       5,
	FailoverBudgetSeconds:     90,
	ProbeFreshnessMinutes:     15,
	ProbeTimeoutSeconds:       30,
	ProbeConcurrencyPerSource: 1,
	FailureThreshold:          2,
	FailureWindowMinutes:      5,
	RedLongTermHours:          24,
	SyncIntervalHours:         4,
	DailyReconcileTime:        "03:00",
	Timezone:                  "Asia/Shanghai",
	MaxUpstreamMultiplier:     1,
	DetailRetentionDays:       90,
	ManualPauseHours:          24,
	ShadowSuccessesRequired:   3,
	StaticEgressIPs:           map[string][]string{},
	ModelAliases:              map[string]string{},
	ModelExclusions:           map[string][]string{},
	ProtocolModelExclusions:   map[string][]string{},
}

func init() {
	config.GlobalConfig.Register("upstream_orchestration", &upstreamOrchestrationSetting)
}

func GetUpstreamOrchestrationSetting() *UpstreamOrchestrationSetting {
	var snapshot UpstreamOrchestrationSetting
	config.GlobalConfig.Read("upstream_orchestration", func(value any) {
		snapshot = cloneUpstreamOrchestrationSetting(
			*value.(*UpstreamOrchestrationSetting),
		)
	})
	normalizeUpstreamOrchestrationSetting(&snapshot)
	return &snapshot
}

func cloneUpstreamOrchestrationSetting(setting UpstreamOrchestrationSetting) UpstreamOrchestrationSetting {
	clone := setting
	clone.TargetGroups = slices.Clone(setting.TargetGroups)
	clone.StaticEgressIPs = cloneStringSliceMap(setting.StaticEgressIPs)
	clone.ModelAliases = maps.Clone(setting.ModelAliases)
	clone.ModelExclusions = cloneStringSliceMap(setting.ModelExclusions)
	clone.ProtocolModelExclusions = cloneStringSliceMap(setting.ProtocolModelExclusions)
	return clone
}

func cloneStringSliceMap(values map[string][]string) map[string][]string {
	if values == nil {
		return nil
	}
	clone := make(map[string][]string, len(values))
	for key, items := range values {
		clone[key] = slices.Clone(items)
	}
	return clone
}

func NormalizeUpstreamRoutingPolicy(policy UpstreamRoutingPolicy) (UpstreamRoutingPolicy, error) {
	if policy.TargetGroups == nil || policy.ModelAliases == nil ||
		policy.ModelExclusions == nil || policy.ProtocolModelExclusions == nil {
		return UpstreamRoutingPolicy{}, fmt.Errorf("all routing policy fields are required")
	}
	if len(policy.TargetGroups) == 0 || len(policy.TargetGroups) > upstreamRoutingPolicyMaxEntries {
		return UpstreamRoutingPolicy{}, fmt.Errorf("target_groups must contain between 1 and %d values", upstreamRoutingPolicyMaxEntries)
	}
	targetGroups, err := normalizeUpstreamPolicyValues(policy.TargetGroups, "target group")
	if err != nil {
		return UpstreamRoutingPolicy{}, err
	}
	modelAliases, err := normalizeUpstreamAliases(policy.ModelAliases)
	if err != nil {
		return UpstreamRoutingPolicy{}, err
	}
	modelExclusions, err := normalizeUpstreamExclusions(policy.ModelExclusions, false)
	if err != nil {
		return UpstreamRoutingPolicy{}, err
	}
	protocolExclusions, err := normalizeUpstreamExclusions(policy.ProtocolModelExclusions, true)
	if err != nil {
		return UpstreamRoutingPolicy{}, err
	}
	normalized := UpstreamRoutingPolicy{
		TargetGroups:            targetGroups,
		ModelAliases:            modelAliases,
		ModelExclusions:         modelExclusions,
		ProtocolModelExclusions: protocolExclusions,
	}
	encoded, err := common.Marshal(normalized)
	if err != nil {
		return UpstreamRoutingPolicy{}, fmt.Errorf("invalid routing policy")
	}
	if len(encoded) > UpstreamRoutingPolicyMaxJSONBytes {
		return UpstreamRoutingPolicy{}, fmt.Errorf("routing policy is too large")
	}
	return normalized, nil
}

func normalizeUpstreamAliases(values map[string]string) (map[string]string, error) {
	if len(values) > upstreamRoutingPolicyMaxEntries {
		return nil, fmt.Errorf("model_aliases exceeds %d entries", upstreamRoutingPolicyMaxEntries)
	}
	normalized := make(map[string]string, len(values))
	for rawKey, rawValue := range values {
		key, err := normalizeUpstreamPolicyValue(rawKey, "model alias key")
		if err != nil {
			return nil, err
		}
		value := strings.TrimSpace(rawValue)
		if len(value) > upstreamRoutingPolicyMaxValueLen {
			return nil, fmt.Errorf("model alias value exceeds %d bytes", upstreamRoutingPolicyMaxValueLen)
		}
		if _, exists := normalized[key]; exists {
			return nil, fmt.Errorf("duplicate model alias key after trimming")
		}
		normalized[key] = value
	}
	return normalized, nil
}

func normalizeUpstreamExclusions(values map[string][]string, protocolScoped bool) (map[string][]string, error) {
	if len(values) > upstreamRoutingPolicyMaxEntries {
		return nil, fmt.Errorf("model exclusions exceeds %d entries", upstreamRoutingPolicyMaxEntries)
	}
	normalized := make(map[string][]string, len(values))
	for rawKey, rawItems := range values {
		key, err := normalizeUpstreamPolicyValue(rawKey, "model exclusion key")
		if err != nil {
			return nil, err
		}
		if protocolScoped {
			parts := strings.Split(key, ":")
			protocol := strings.ToLower(strings.TrimSpace(parts[len(parts)-1]))
			if protocol != "openai" && protocol != "anthropic" {
				return nil, fmt.Errorf("unsupported protocol in exclusion key")
			}
			parts[len(parts)-1] = protocol
			for i := range parts {
				parts[i] = strings.TrimSpace(parts[i])
				if parts[i] == "" {
					return nil, fmt.Errorf("model exclusion key contains an empty segment")
				}
			}
			if len(parts) > 1 {
				parts[0] = strings.ToLower(parts[0])
			}
			key = strings.Join(parts, ":")
		} else if source, group, found := strings.Cut(key, ":"); found {
			source = strings.ToLower(strings.TrimSpace(source))
			group = strings.TrimSpace(group)
			if source == "" || group == "" {
				return nil, fmt.Errorf("model exclusion key contains an empty segment")
			}
			key = source + ":" + group
		} else {
			return nil, fmt.Errorf("model exclusion key must use source:group")
		}
		if _, exists := normalized[key]; exists {
			return nil, fmt.Errorf("duplicate model exclusion key after trimming")
		}
		if len(rawItems) > upstreamRoutingPolicyMaxEntries {
			return nil, fmt.Errorf("model exclusion list exceeds %d entries", upstreamRoutingPolicyMaxEntries)
		}
		items, err := normalizeUpstreamPolicyValues(rawItems, "model exclusion")
		if err != nil {
			return nil, err
		}
		normalized[key] = items
	}
	return normalized, nil
}

func normalizeUpstreamPolicyValues(values []string, label string) ([]string, error) {
	normalized := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, raw := range values {
		value, err := normalizeUpstreamPolicyValue(raw, label)
		if err != nil {
			return nil, err
		}
		if _, exists := seen[value]; exists {
			continue
		}
		seen[value] = struct{}{}
		normalized = append(normalized, value)
	}
	return normalized, nil
}

func normalizeUpstreamPolicyValue(value, label string) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return "", fmt.Errorf("%s must not be empty", label)
	}
	if len(value) > upstreamRoutingPolicyMaxValueLen {
		return "", fmt.Errorf("%s exceeds %d bytes", label, upstreamRoutingPolicyMaxValueLen)
	}
	return value, nil
}

func normalizeUpstreamOrchestrationSetting(setting *UpstreamOrchestrationSetting) {
	if setting.CandidateLimit < 0 {
		setting.CandidateLimit = 5
	}
	if setting.RequestAttemptLimit < 1 || setting.RequestAttemptLimit > 5 {
		setting.RequestAttemptLimit = 5
	}
	if setting.FailoverBudgetSeconds <= 0 {
		setting.FailoverBudgetSeconds = 90
	}
	if setting.ProbeFreshnessMinutes <= 0 {
		setting.ProbeFreshnessMinutes = 15
	}
	if setting.ProbeTimeoutSeconds <= 0 {
		setting.ProbeTimeoutSeconds = 30
	}
	if setting.ProbeConcurrencyPerSource < 1 {
		setting.ProbeConcurrencyPerSource = 1
	}
	if setting.FailureThreshold < 1 {
		setting.FailureThreshold = 2
	}
	if setting.FailureWindowMinutes <= 0 {
		setting.FailureWindowMinutes = 5
	}
	if setting.RedLongTermHours <= 0 {
		setting.RedLongTermHours = 24
	}
	if setting.SyncIntervalHours <= 0 {
		setting.SyncIntervalHours = 4
	}
	if strings.TrimSpace(setting.DailyReconcileTime) == "" {
		setting.DailyReconcileTime = "03:00"
	}
	if strings.TrimSpace(setting.Timezone) == "" {
		setting.Timezone = "Asia/Shanghai"
	}
	if setting.MaxUpstreamMultiplier <= 0 {
		setting.MaxUpstreamMultiplier = 1
	}
	if setting.DetailRetentionDays <= 0 {
		setting.DetailRetentionDays = 90
	}
	if setting.ManualPauseHours <= 0 {
		setting.ManualPauseHours = 24
	}
	if setting.ShadowSuccessesRequired < 1 {
		setting.ShadowSuccessesRequired = 3
	}
	if len(setting.TargetGroups) == 0 {
		setting.TargetGroups = []string{"default", "cxy"}
	}
	setting.TargetGroups = slices.Compact(setting.TargetGroups)
	if setting.StaticEgressIPs == nil {
		setting.StaticEgressIPs = map[string][]string{}
	}
	if setting.ModelAliases == nil {
		setting.ModelAliases = map[string]string{}
	}
	if setting.ModelExclusions == nil {
		setting.ModelExclusions = map[string][]string{}
	}
	if setting.ProtocolModelExclusions == nil {
		setting.ProtocolModelExclusions = map[string][]string{}
	}
}
