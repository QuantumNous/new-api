package setting

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

const (
	TokenConcurrencyEnabledEnv = "TOKEN_CONCURRENCY_ENABLED"
	TokenConcurrencyLimitsEnv  = "TOKEN_CONCURRENCY_LIMITS"
	TokenConcurrencyTTLEnv     = "TOKEN_CONCURRENCY_LEASE_TTL_SECONDS"
	TokenConcurrencyDefaultTTL = 15 * time.Minute
)

// TokenConcurrencyConfig is an environment-backed, strongly typed policy.
// Limits use the explicit form "group=positive_integer,group2=positive_integer".
// An invalid entry remains configured and therefore fails closed for that group.
type TokenConcurrencyConfig struct {
	Enabled           bool
	EnabledParseError bool
	Limits            map[string]int
	ConfiguredGroups  map[string]struct{}
	InvalidGroups     map[string]struct{}
	GlobalParseError  error
	LeaseTTL          time.Duration
}

type TokenConcurrencyPolicy struct {
	Configured bool
	Limit      int
	LeaseTTL   time.Duration
	Err        error
}

// ParseTokenConcurrencyConfig parses raw environment values without silently
// turning zero, negative, duplicate, or malformed limits into an enabled
// policy. It intentionally keeps the group name for malformed entries so only
// groups explicitly named by configuration fail closed.
func ParseTokenConcurrencyConfig(enabledRaw, limitsRaw, ttlRaw string) TokenConcurrencyConfig {
	cfg := TokenConcurrencyConfig{
		Limits:           make(map[string]int),
		ConfiguredGroups: make(map[string]struct{}),
		InvalidGroups:    make(map[string]struct{}),
		LeaseTTL:         TokenConcurrencyDefaultTTL,
	}

	if strings.TrimSpace(enabledRaw) == "" {
		cfg.Enabled = false
	} else {
		enabled, err := strconv.ParseBool(strings.TrimSpace(enabledRaw))
		if err != nil {
			cfg.EnabledParseError = true
			cfg.GlobalParseError = fmt.Errorf("%s must be boolean", TokenConcurrencyEnabledEnv)
		} else {
			cfg.Enabled = enabled
		}
	}

	if strings.TrimSpace(ttlRaw) != "" {
		seconds, err := strconv.ParseInt(strings.TrimSpace(ttlRaw), 10, 64)
		if err != nil || seconds <= 0 {
			cfg.GlobalParseError = fmt.Errorf("%s must be a positive integer", TokenConcurrencyTTLEnv)
		} else {
			cfg.LeaseTTL = time.Duration(seconds) * time.Second
		}
	}

	hadLimitParseError := false
	for _, rawEntry := range strings.Split(limitsRaw, ",") {
		entry := strings.TrimSpace(rawEntry)
		if entry == "" {
			continue
		}
		group, rawLimit, ok := strings.Cut(entry, "=")
		group = strings.TrimSpace(group)
		if group != "" {
			cfg.ConfiguredGroups[group] = struct{}{}
		}
		if !ok || group == "" || strings.Contains(rawLimit, "=") {
			hadLimitParseError = true
			if group != "" {
				cfg.InvalidGroups[group] = struct{}{}
			}
			continue
		}
		limit, err := strconv.ParseInt(strings.TrimSpace(rawLimit), 10, 64)
		if err != nil || limit <= 0 || limit > int64(^uint(0)>>1) {
			hadLimitParseError = true
			cfg.InvalidGroups[group] = struct{}{}
			continue
		}
		if _, duplicate := cfg.Limits[group]; duplicate {
			hadLimitParseError = true
			cfg.InvalidGroups[group] = struct{}{}
			continue
		}
		cfg.Limits[group] = int(limit)
	}

	if hadLimitParseError {
		cfg.GlobalParseError = fmt.Errorf("%s contains an invalid entry", TokenConcurrencyLimitsEnv)
	}
	if cfg.GlobalParseError != nil {
		// Every group explicitly named in the malformed configuration is
		// restricted until the entire value is corrected. Unnamed groups keep
		// their legacy behavior.
		for group := range cfg.ConfiguredGroups {
			cfg.InvalidGroups[group] = struct{}{}
		}
	}
	return cfg
}

func TokenConcurrencyConfigFromEnv() TokenConcurrencyConfig {
	return ParseTokenConcurrencyConfig(
		os.Getenv(TokenConcurrencyEnabledEnv),
		os.Getenv(TokenConcurrencyLimitsEnv),
		os.Getenv(TokenConcurrencyTTLEnv),
	)
}

func (cfg TokenConcurrencyConfig) Policy(group string) TokenConcurrencyPolicy {
	group = strings.TrimSpace(group)
	if group == "" || (!cfg.Enabled && !cfg.EnabledParseError) {
		return TokenConcurrencyPolicy{}
	}
	if _, configured := cfg.ConfiguredGroups[group]; !configured {
		return TokenConcurrencyPolicy{}
	}
	if _, invalid := cfg.InvalidGroups[group]; invalid {
		return TokenConcurrencyPolicy{Configured: true, LeaseTTL: cfg.LeaseTTL, Err: cfg.GlobalParseError}
	}
	limit, configured := cfg.Limits[group]
	if !configured || limit <= 0 || cfg.GlobalParseError != nil {
		return TokenConcurrencyPolicy{Configured: true, LeaseTTL: cfg.LeaseTTL, Err: cfg.GlobalParseError}
	}
	return TokenConcurrencyPolicy{Configured: true, Limit: limit, LeaseTTL: cfg.LeaseTTL}
}

func TokenConcurrencyPolicyForGroup(group string) TokenConcurrencyPolicy {
	return TokenConcurrencyConfigFromEnv().Policy(group)
}
