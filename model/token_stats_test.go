package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestGetEffectiveTokenStatus(t *testing.T) {
	now := int64(1_000)
	tests := []struct {
		name     string
		token    Token
		expected int
	}{
		{
			name: "enabled",
			token: Token{
				Status:         common.TokenStatusEnabled,
				ExpiredTime:    -1,
				RemainQuota:    1,
				UnlimitedQuota: false,
			},
			expected: common.TokenStatusEnabled,
		},
		{
			name: "quota exhausted",
			token: Token{
				Status:         common.TokenStatusEnabled,
				ExpiredTime:    -1,
				RemainQuota:    -1,
				UnlimitedQuota: false,
			},
			expected: common.TokenStatusExhausted,
		},
		{
			name: "expiration precedes quota exhaustion",
			token: Token{
				Status:         common.TokenStatusEnabled,
				ExpiredTime:    now - 1,
				RemainQuota:    0,
				UnlimitedQuota: false,
			},
			expected: common.TokenStatusExpired,
		},
		{
			name: "disabled remains disabled",
			token: Token{
				Status:         common.TokenStatusDisabled,
				ExpiredTime:    now - 1,
				RemainQuota:    0,
				UnlimitedQuota: false,
			},
			expected: common.TokenStatusDisabled,
		},
		{
			name: "unlimited exhausted status is usable",
			token: Token{
				Status:         common.TokenStatusExhausted,
				ExpiredTime:    -1,
				RemainQuota:    -100,
				UnlimitedQuota: true,
			},
			expected: common.TokenStatusEnabled,
		},
		{
			name: "unknown status is unavailable",
			token: Token{
				Status:         99,
				ExpiredTime:    -1,
				RemainQuota:    100,
				UnlimitedQuota: false,
			},
			expected: common.TokenStatusDisabled,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			require.Equal(t, test.expected, GetEffectiveTokenStatus(&test.token, now))
		})
	}
}

func TestGetUserTokenStatsUsesEffectiveStatuses(t *testing.T) {
	truncateTables(t)
	now := common.GetTimestamp()
	tokens := []Token{
		{UserId: 1, Key: "stats-enabled", Status: common.TokenStatusEnabled, ExpiredTime: -1, RemainQuota: 1},
		{UserId: 1, Key: "stats-unlimited", Status: common.TokenStatusExhausted, ExpiredTime: -1, RemainQuota: -1, UnlimitedQuota: true},
		{UserId: 1, Key: "stats-disabled", Status: common.TokenStatusDisabled, ExpiredTime: -1, RemainQuota: 1},
		{UserId: 1, Key: "stats-unknown", Status: 99, ExpiredTime: -1, RemainQuota: 1},
		{UserId: 1, Key: "stats-expired", Status: common.TokenStatusExpired, ExpiredTime: -1, RemainQuota: 1},
		{UserId: 1, Key: "stats-expired-by-time", Status: common.TokenStatusEnabled, ExpiredTime: now - 1, RemainQuota: 0},
		{UserId: 1, Key: "stats-exhausted", Status: common.TokenStatusExhausted, ExpiredTime: -1, RemainQuota: 1},
		{UserId: 1, Key: "stats-exhausted-by-quota", Status: common.TokenStatusEnabled, ExpiredTime: -1, RemainQuota: -1},
		{UserId: 2, Key: "stats-other-user", Status: common.TokenStatusEnabled, ExpiredTime: -1, RemainQuota: 1},
	}
	require.NoError(t, DB.Create(&tokens).Error)

	stats, err := GetUserTokenStats(1)

	require.NoError(t, err)
	require.Equal(t, UserTokenStats{
		Total:     8,
		Enabled:   2,
		Disabled:  2,
		Expired:   2,
		Exhausted: 2,
	}, stats)
}
