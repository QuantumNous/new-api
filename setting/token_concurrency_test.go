package setting

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestParseTokenConcurrencyConfigDefaultsOffAndPositiveLimits(t *testing.T) {
	cfg := ParseTokenConcurrencyConfig("", "deepseek-targeted=50", "")
	require.False(t, cfg.Policy("deepseek-targeted").Configured)
	require.Equal(t, TokenConcurrencyDefaultTTL, cfg.LeaseTTL)

	cfg = ParseTokenConcurrencyConfig("true", "deepseek-targeted=50,cdance-targeted=50", "30")
	require.Equal(t, 50, cfg.Policy("deepseek-targeted").Limit)
	require.Equal(t, 30*time.Second, cfg.Policy("cdance-targeted").LeaseTTL)
	require.False(t, cfg.Policy("unconfigured").Configured)
}

func TestParseTokenConcurrencyConfigInvalidConfiguredGroupFailsClosed(t *testing.T) {
	for _, limits := range []string{"deepseek-targeted=0", "deepseek-targeted=-1", "deepseek-targeted=bad", "deepseek-targeted=50,deepseek-targeted=51", "deepseek-targeted"} {
		cfg := ParseTokenConcurrencyConfig("true", limits, "")
		policy := cfg.Policy("deepseek-targeted")
		require.True(t, policy.Configured, limits)
		require.Error(t, policy.Err, limits)
		require.False(t, cfg.Policy("other-group").Configured, limits)
	}

	cfg := ParseTokenConcurrencyConfig("true", "deepseek-targeted=50", "0")
	require.Error(t, cfg.Policy("deepseek-targeted").Err)
}

func TestParseTokenConcurrencyConfigInvalidEnabledOnlyAffectsNamedGroups(t *testing.T) {
	cfg := ParseTokenConcurrencyConfig("not-a-bool", "deepseek-targeted=50", "")
	require.Error(t, cfg.Policy("deepseek-targeted").Err)
	require.False(t, cfg.Policy("other-group").Configured)

	cfg = ParseTokenConcurrencyConfig("false", "deepseek-targeted=50", "")
	require.False(t, cfg.Policy("deepseek-targeted").Configured)
}
