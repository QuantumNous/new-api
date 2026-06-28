package model

import (
	"errors"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func mustUnix(t *testing.T, value string) int64 {
	t.Helper()
	parsed, err := time.ParseInLocation("2006-01-02 15:04:05", value, time.UTC)
	require.NoError(t, err)
	return parsed.Unix()
}

func TestTokenQuotaPolicyFixedWindowFromAnchor(t *testing.T) {
	anchor := mustUnix(t, "2026-06-27 01:15:00")
	now := mustUnix(t, "2026-06-27 06:15:00")

	window, err := CalculateTokenQuotaPolicyWindow(TokenQuotaPeriodPreset5h, 0, anchor, now)

	require.NoError(t, err)
	assert.Equal(t, mustUnix(t, "2026-06-27 06:15:00"), window.Start)
	assert.Equal(t, mustUnix(t, "2026-06-27 11:15:00"), window.End)
	assert.Equal(t, window.End, window.NextResetAt)
}

func TestTokenQuotaPolicyCustomWindowRequiresAtLeastTenMinutes(t *testing.T) {
	anchor := mustUnix(t, "2026-06-27 10:00:00")
	now := mustUnix(t, "2026-06-27 10:05:00")

	_, err := CalculateTokenQuotaPolicyWindow(TokenQuotaPeriodCustom, 9, anchor, now)

	require.ErrorIs(t, err, ErrTokenQuotaPolicyInvalidCustomMinutes)
}

func TestTokenQuotaPolicyCustomWindowUsesMinuteGranularity(t *testing.T) {
	anchor := mustUnix(t, "2026-06-27 10:00:00")
	now := mustUnix(t, "2026-06-27 10:30:00")

	window, err := CalculateTokenQuotaPolicyWindow(TokenQuotaPeriodCustom, 30, anchor, now)

	require.NoError(t, err)
	assert.Equal(t, mustUnix(t, "2026-06-27 10:30:00"), window.Start)
	assert.Equal(t, mustUnix(t, "2026-06-27 11:00:00"), window.End)
}

func TestTokenQuotaPolicyDailyWindowKeepsAnchorTimeOfDay(t *testing.T) {
	anchor := mustUnix(t, "2026-06-27 09:30:00")
	now := mustUnix(t, "2026-06-29 09:29:59")

	window, err := CalculateTokenQuotaPolicyWindow(TokenQuotaPeriodDaily, 0, anchor, now)

	require.NoError(t, err)
	assert.Equal(t, mustUnix(t, "2026-06-28 09:30:00"), window.Start)
	assert.Equal(t, mustUnix(t, "2026-06-29 09:30:00"), window.End)
}

func TestTokenQuotaPolicyWeeklyWindowKeepsAnchorWeekdayAndTime(t *testing.T) {
	anchor := mustUnix(t, "2026-06-22 09:30:00")
	now := mustUnix(t, "2026-07-06 09:30:00")

	window, err := CalculateTokenQuotaPolicyWindow(TokenQuotaPeriodWeekly, 0, anchor, now)

	require.NoError(t, err)
	assert.Equal(t, mustUnix(t, "2026-07-06 09:30:00"), window.Start)
	assert.Equal(t, mustUnix(t, "2026-07-13 09:30:00"), window.End)
}

func TestTokenQuotaPolicyMonthlyWindowClampsMissingMonthDay(t *testing.T) {
	tests := []struct {
		name      string
		anchor    string
		now       string
		wantStart string
		wantEnd   string
	}{
		{
			name:      "non leap year",
			anchor:    "2026-01-31 08:00:00",
			now:       "2026-02-28 08:00:00",
			wantStart: "2026-02-28 08:00:00",
			wantEnd:   "2026-03-31 08:00:00",
		},
		{
			name:      "leap year",
			anchor:    "2028-01-31 08:00:00",
			now:       "2028-02-29 08:00:00",
			wantStart: "2028-02-29 08:00:00",
			wantEnd:   "2028-03-31 08:00:00",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			window, err := CalculateTokenQuotaPolicyWindow(TokenQuotaPeriodMonthly, 0, mustUnix(t, tt.anchor), mustUnix(t, tt.now))

			require.NoError(t, err)
			assert.Equal(t, mustUnix(t, tt.wantStart), window.Start)
			assert.Equal(t, mustUnix(t, tt.wantEnd), window.End)
		})
	}
}

func TestTokenQuotaPolicyValidation(t *testing.T) {
	anchor := mustUnix(t, "2026-06-27 10:00:00")

	tests := []struct {
		name    string
		policy  TokenQuotaPolicy
		wantErr error
	}{
		{
			name: "disabled policy accepts zero quota",
			policy: TokenQuotaPolicy{
				Enabled:    false,
				PeriodMode: TokenQuotaPeriodDaily,
				AnchorTime: anchor,
			},
		},
		{
			name: "enabled policy requires positive quota",
			policy: TokenQuotaPolicy{
				Enabled:    true,
				PeriodMode: TokenQuotaPeriodDaily,
				AnchorTime: anchor,
				Quota:      0,
			},
			wantErr: ErrTokenQuotaPolicyInvalidQuota,
		},
		{
			name: "custom policy requires custom minutes",
			policy: TokenQuotaPolicy{
				Enabled:       true,
				PeriodMode:    TokenQuotaPeriodCustom,
				CustomMinutes: 0,
				AnchorTime:    anchor,
				Quota:         100,
			},
			wantErr: ErrTokenQuotaPolicyInvalidCustomMinutes,
		},
		{
			name: "custom policy rejects too large windows",
			policy: TokenQuotaPolicy{
				Enabled:       true,
				PeriodMode:    TokenQuotaPeriodCustom,
				CustomMinutes: 525601,
				AnchorTime:    anchor,
				Quota:         100,
			},
			wantErr: ErrTokenQuotaPolicyInvalidCustomMinutes,
		},
		{
			name: "enabled daily policy is valid",
			policy: TokenQuotaPolicy{
				Enabled:         true,
				PeriodMode:      TokenQuotaPeriodDaily,
				AnchorTime:      anchor,
				Quota:           100,
				ExhaustedAction: TokenQuotaExhaustRejectOnly,
				AutoResume:      true,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.policy.Validate()
			if tt.wantErr == nil {
				require.NoError(t, err)
				return
			}
			require.ErrorIs(t, err, tt.wantErr)
		})
	}
}

func TestTokenQuotaPolicyConsumeWithinPeriod(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&TokenQuotaPolicy{}))
	policy := seedTokenQuotaPolicy(t, 1, 1, 100)

	require.NoError(t, ConsumeTokenQuotaPolicy(policy.TokenId, 30))

	reloaded := getTokenQuotaPolicy(t, policy.TokenId)
	assert.Equal(t, 30, reloaded.UsedQuota)
}

func TestTokenQuotaPolicyConsumeRejectsOverspendWithoutChangingUsage(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&TokenQuotaPolicy{}))
	policy := seedTokenQuotaPolicy(t, 1, 1, 100)
	require.NoError(t, ConsumeTokenQuotaPolicy(policy.TokenId, 70))

	err := ConsumeTokenQuotaPolicy(policy.TokenId, 31)

	require.ErrorIs(t, err, ErrTokenQuotaPolicyExhausted)
	reloaded := getTokenQuotaPolicy(t, policy.TokenId)
	assert.Equal(t, 70, reloaded.UsedQuota)
}

func TestTokenQuotaPolicyRefundNeverDropsBelowZero(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&TokenQuotaPolicy{}))
	policy := seedTokenQuotaPolicy(t, 1, 1, 100)
	require.NoError(t, ConsumeTokenQuotaPolicy(policy.TokenId, 30))

	require.NoError(t, RefundTokenQuotaPolicy(policy.TokenId, 50))

	reloaded := getTokenQuotaPolicy(t, policy.TokenId)
	assert.Equal(t, 0, reloaded.UsedQuota)
}

func TestTokenQuotaPolicyResetAdvancesDueWindow(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&TokenQuotaPolicy{}))
	anchor := mustUnix(t, "2026-06-27 01:15:00")
	now := mustUnix(t, "2026-06-27 06:15:00")
	policy := seedTokenQuotaPolicy(t, 1, 1, 100)
	policy.PeriodMode = TokenQuotaPeriodPreset5h
	policy.AnchorTime = anchor
	policy.PeriodStart = mustUnix(t, "2026-06-27 01:15:00")
	policy.PeriodEnd = now
	policy.NextResetAt = now
	policy.UsedQuota = 80
	require.NoError(t, DB.Save(policy).Error)

	reset, err := ResetTokenQuotaPolicyIfDue(policy.TokenId, now)

	require.NoError(t, err)
	require.True(t, reset)
	reloaded := getTokenQuotaPolicy(t, policy.TokenId)
	assert.Equal(t, 0, reloaded.UsedQuota)
	assert.Equal(t, now, reloaded.PeriodStart)
	assert.Equal(t, mustUnix(t, "2026-06-27 11:15:00"), reloaded.PeriodEnd)
	assert.Equal(t, reloaded.PeriodEnd, reloaded.NextResetAt)
}

func TestValidateUserTokenRestoresPolicyPausedTokenInNewPeriod(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&TokenQuotaPolicy{}))
	token := seedModelTokenForPolicy(t, 31, 41, "policy-paused", 1000, 2)
	policy := seedTokenQuotaPolicy(t, token.Id, token.UserId, 100)
	policy.NextResetAt = mustUnix(t, "2020-01-01 00:00:00")
	policy.ExhaustedAt = mustUnix(t, "2019-12-31 23:59:00")
	policy.ExhaustedTokenStatus = 1
	policy.AutoResume = true
	require.NoError(t, DB.Save(policy).Error)

	validated, err := ValidateUserToken("policy-paused")

	require.NoError(t, err)
	assert.Equal(t, token.Id, validated.Id)
	assert.Equal(t, 1, validated.Status)
	reloaded := getTokenQuotaPolicy(t, token.Id)
	assert.Equal(t, 0, reloaded.UsedQuota)
	assert.Zero(t, reloaded.ExhaustedAt)
	assert.Zero(t, reloaded.ExhaustedTokenStatus)
}

func TestValidateUserTokenDoesNotRestoreManuallyDisabledToken(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&TokenQuotaPolicy{}))
	token := seedModelTokenForPolicy(t, 32, 42, "manual-disabled", 1000, 2)
	policy := seedTokenQuotaPolicy(t, token.Id, token.UserId, 100)
	policy.NextResetAt = mustUnix(t, "2020-01-01 00:00:00")
	policy.ExhaustedAt = 0
	policy.ExhaustedTokenStatus = 0
	policy.AutoResume = true
	require.NoError(t, DB.Save(policy).Error)

	_, err := ValidateUserToken("manual-disabled")

	require.Error(t, err)
	var reloaded Token
	require.NoError(t, DB.Where("id = ?", token.Id).First(&reloaded).Error)
	assert.Equal(t, 2, reloaded.Status)
}

func TestValidateUserTokenReportsQuotaPolicyTemporaryDisableReason(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&TokenQuotaPolicy{}))
	token := seedModelTokenForPolicy(t, 37, 47, "quota-policy-disabled", 1000, common.TokenStatusDisabled)
	policy := seedTokenQuotaPolicy(t, token.Id, token.UserId, 100)
	policy.UsedQuota = 125
	policy.NextResetAt = common.GetTimestamp() + 600
	policy.ExhaustedAt = common.GetTimestamp()
	policy.ExhaustedAction = TokenQuotaExhaustDisableToken
	policy.ExhaustedTokenStatus = common.TokenStatusEnabled
	policy.AutoResume = true
	require.NoError(t, DB.Save(policy).Error)

	_, err := ValidateUserToken("quota-policy-disabled")

	require.Error(t, err)
	var quotaPolicyErr *TokenQuotaPolicyTemporaryDisabledError
	require.True(t, errors.As(err, &quotaPolicyErr))
	assert.Equal(t, 125, quotaPolicyErr.UsedQuota)
	assert.Equal(t, 100, quotaPolicyErr.Quota)
	assert.Equal(t, policy.NextResetAt, quotaPolicyErr.NextResetAt)
	assert.True(t, quotaPolicyErr.AutoResume)
}

func TestTokenQuotaPolicyDisableAndRestoreRecordsTokenLogs(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&TokenQuotaPolicy{}, &Log{}))
	token := seedModelTokenForPolicy(t, 33, 43, "log-policy-token", 1000, common.TokenStatusEnabled)
	policy := seedTokenQuotaPolicy(t, token.Id, token.UserId, 100)
	policy.ExhaustedAction = TokenQuotaExhaustDisableToken
	policy.NextResetAt = mustUnix(t, "2020-01-01 00:00:00")
	policy.AutoResume = true
	require.NoError(t, DB.Save(policy).Error)

	require.NoError(t, MarkTokenQuotaPolicyExhausted(token.Id, common.TokenStatusDisabled))
	reset, err := ResetTokenQuotaPolicyAndRestoreTokenIfDue(token.Id, mustUnix(t, "2020-01-01 00:00:01"))

	require.NoError(t, err)
	require.True(t, reset)
	var reloaded Token
	require.NoError(t, DB.Where("id = ?", token.Id).First(&reloaded).Error)
	assert.Equal(t, common.TokenStatusEnabled, reloaded.Status)
	var logs []Log
	require.NoError(t, LOG_DB.Where("token_id = ?", token.Id).Order("id asc").Find(&logs).Error)
	require.Len(t, logs, 2)
	assert.Equal(t, LogTypeSystem, logs[0].Type)
	assert.Contains(t, logs[0].Content, "temporarily disabled")
	assert.Contains(t, logs[0].Content, "periodic quota exhausted")
	assert.Equal(t, token.Name, logs[0].TokenName)
	var exhaustedOther map[string]interface{}
	require.NoError(t, common.UnmarshalJsonStr(logs[0].Other, &exhaustedOther))
	exhaustedOp, ok := exhaustedOther["op"].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, "token.quota_policy.exhausted_disable", exhaustedOp["action"])
	assert.Equal(t, LogTypeSystem, logs[1].Type)
	assert.Contains(t, logs[1].Content, "automatically restored")
	assert.Contains(t, logs[1].Content, "new period started")
	assert.Equal(t, token.Name, logs[1].TokenName)
	var restoredOther map[string]interface{}
	require.NoError(t, common.UnmarshalJsonStr(logs[1].Other, &restoredOther))
	restoredOp, ok := restoredOther["op"].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, "token.quota_policy.auto_restore_reset", restoredOp["action"])
}

func TestManualResetTokenQuotaPolicyRestoresAndClearsUsage(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&TokenQuotaPolicy{}, &Log{}))
	token := seedModelTokenForPolicy(t, 34, 44, "manual-reset-policy", 1000, common.TokenStatusDisabled)
	policy := seedTokenQuotaPolicy(t, token.Id, token.UserId, 100)
	policy.UsedQuota = 120
	policy.ExhaustedAt = mustUnix(t, "2026-06-27 02:00:00")
	policy.ExhaustedTokenStatus = common.TokenStatusEnabled
	require.NoError(t, DB.Save(policy).Error)

	resetPolicy, err := ResetTokenQuotaPolicyManually(token.Id, token.UserId)

	require.NoError(t, err)
	require.NotNil(t, resetPolicy)
	assert.Equal(t, 0, resetPolicy.UsedQuota)
	assert.Zero(t, resetPolicy.ExhaustedAt)
	assert.Zero(t, resetPolicy.ExhaustedTokenStatus)
	var reloaded Token
	require.NoError(t, DB.Where("id = ?", token.Id).First(&reloaded).Error)
	assert.Equal(t, common.TokenStatusEnabled, reloaded.Status)
	var logs []Log
	require.NoError(t, LOG_DB.Where("token_id = ?", token.Id).Find(&logs).Error)
	require.Len(t, logs, 1)
	assert.Contains(t, logs[0].Content, "manually reset")
	var other map[string]interface{}
	require.NoError(t, common.UnmarshalJsonStr(logs[0].Other, &other))
	op, ok := other["op"].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, "token.quota_policy.manual_reset", op["action"])
}

func TestSaveTokenQuotaPolicyDisablesWhenUpdatedQuotaAlreadyExhausted(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&TokenQuotaPolicy{}, &Log{}))
	token := seedModelTokenForPolicy(t, 35, 45, "save-disable-policy", 1000, common.TokenStatusEnabled)
	policy := seedTokenQuotaPolicy(t, token.Id, token.UserId, 100)
	policy.UsedQuota = 80
	require.NoError(t, DB.Save(policy).Error)

	updated, err := SaveTokenQuotaPolicyForToken(token.Id, token.UserId, &TokenQuotaPolicy{
		Enabled:         true,
		PeriodMode:      TokenQuotaPeriodPreset5h,
		Quota:           50,
		AnchorTime:      policy.AnchorTime,
		ExhaustedAction: TokenQuotaExhaustDisableToken,
		AutoResume:      true,
	}, mustUnix(t, "2026-06-27 02:00:00"))

	require.NoError(t, err)
	require.NotNil(t, updated)
	assert.Equal(t, 80, updated.UsedQuota)
	assert.NotZero(t, updated.ExhaustedAt)
	assert.Equal(t, common.TokenStatusEnabled, updated.ExhaustedTokenStatus)
	var reloaded Token
	require.NoError(t, DB.Where("id = ?", token.Id).First(&reloaded).Error)
	assert.Equal(t, common.TokenStatusDisabled, reloaded.Status)
}

func TestSaveTokenQuotaPolicyPreservesUsageWhenUpdatedWindowChanges(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&TokenQuotaPolicy{}, &Log{}))
	token := seedModelTokenForPolicy(t, 37, 47, "save-window-change-policy", 1000, common.TokenStatusEnabled)
	policy := seedTokenQuotaPolicy(t, token.Id, token.UserId, 100)
	policy.UsedQuota = 80
	require.NoError(t, DB.Save(policy).Error)
	now := mustUnix(t, "2026-06-27 03:30:00")

	updated, err := SaveTokenQuotaPolicyForToken(token.Id, token.UserId, &TokenQuotaPolicy{
		Enabled:         true,
		PeriodMode:      TokenQuotaPeriodPreset5h,
		Quota:           50,
		AnchorTime:      now,
		ExhaustedAction: TokenQuotaExhaustDisableToken,
		AutoResume:      true,
	}, now)

	require.NoError(t, err)
	require.NotNil(t, updated)
	assert.Equal(t, 80, updated.UsedQuota)
	assert.NotZero(t, updated.ExhaustedAt)
	assert.Equal(t, common.TokenStatusEnabled, updated.ExhaustedTokenStatus)
	var reloaded Token
	require.NoError(t, DB.Where("id = ?", token.Id).First(&reloaded).Error)
	assert.Equal(t, common.TokenStatusDisabled, reloaded.Status)
}

func TestSaveTokenQuotaPolicyRestoresWhenUpdatedQuotaCoversUsage(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&TokenQuotaPolicy{}, &Log{}))
	token := seedModelTokenForPolicy(t, 36, 46, "save-restore-policy", 1000, common.TokenStatusDisabled)
	policy := seedTokenQuotaPolicy(t, token.Id, token.UserId, 100)
	policy.UsedQuota = 120
	policy.ExhaustedAt = mustUnix(t, "2026-06-27 02:00:00")
	policy.ExhaustedTokenStatus = common.TokenStatusEnabled
	policy.ExhaustedAction = TokenQuotaExhaustDisableToken
	require.NoError(t, DB.Save(policy).Error)

	updated, err := SaveTokenQuotaPolicyForToken(token.Id, token.UserId, &TokenQuotaPolicy{
		Enabled:         true,
		PeriodMode:      TokenQuotaPeriodPreset5h,
		Quota:           200,
		AnchorTime:      policy.AnchorTime,
		ExhaustedAction: TokenQuotaExhaustDisableToken,
		AutoResume:      true,
	}, mustUnix(t, "2026-06-27 02:00:00"))

	require.NoError(t, err)
	require.NotNil(t, updated)
	assert.Equal(t, 120, updated.UsedQuota)
	assert.Zero(t, updated.ExhaustedAt)
	assert.Zero(t, updated.ExhaustedTokenStatus)
	var reloaded Token
	require.NoError(t, DB.Where("id = ?", token.Id).First(&reloaded).Error)
	assert.Equal(t, common.TokenStatusEnabled, reloaded.Status)
}

func seedTokenQuotaPolicy(t *testing.T, tokenID int, userID int, quota int) *TokenQuotaPolicy {
	t.Helper()
	anchor := mustUnix(t, "2026-06-27 01:15:00")
	window, err := CalculateTokenQuotaPolicyWindow(TokenQuotaPeriodPreset5h, 0, anchor, anchor)
	require.NoError(t, err)
	policy := &TokenQuotaPolicy{
		TokenId:         tokenID,
		UserId:          userID,
		Enabled:         true,
		PeriodMode:      TokenQuotaPeriodPreset5h,
		Quota:           quota,
		AnchorTime:      anchor,
		PeriodStart:     window.Start,
		PeriodEnd:       window.End,
		NextResetAt:     window.NextResetAt,
		ExhaustedAction: TokenQuotaExhaustRejectOnly,
		AutoResume:      true,
	}
	require.NoError(t, DB.Create(policy).Error)
	return policy
}

func getTokenQuotaPolicy(t *testing.T, tokenID int) *TokenQuotaPolicy {
	t.Helper()
	var policy TokenQuotaPolicy
	require.NoError(t, DB.Where("token_id = ?", tokenID).First(&policy).Error)
	return &policy
}

func seedModelTokenForPolicy(t *testing.T, tokenID int, userID int, key string, quota int, status int) *Token {
	t.Helper()
	token := &Token{
		Id:                 tokenID,
		UserId:             userID,
		Key:                key,
		Status:             status,
		Name:               key,
		CreatedTime:        1,
		AccessedTime:       1,
		ExpiredTime:        -1,
		RemainQuota:        quota,
		UnlimitedQuota:     false,
		QuotaPolicyEnabled: true,
		Group:              "default",
	}
	require.NoError(t, DB.Create(token).Error)
	return token
}
