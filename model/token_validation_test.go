package model

import (
	"errors"
	"strconv"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestNormalizeBatchTokenModelRulesTrimsDropsEmptyAndDeduplicates(t *testing.T) {
	normalized, err := normalizeBatchTokenModelRules(" gpt-4o, ,gpt-4.1,gpt-4o,, claude-3-5-sonnet ")

	require.NoError(t, err)
	require.Equal(t, "gpt-4o,gpt-4.1,claude-3-5-sonnet", normalized)
}

func TestNormalizeBatchTokenModelRulesRejectsExcessiveCountAndLength(t *testing.T) {
	tooMany := make([]string, maxBatchTokenModelRuleItems+1)
	for index := range tooMany {
		tooMany[index] = "model-" + strconv.Itoa(index)
	}
	_, err := normalizeBatchTokenModelRules(strings.Join(tooMany, ","))
	require.ErrorIs(t, err, ErrTokenBatchInvalid)

	_, err = normalizeBatchTokenModelRules(strings.Repeat("x", maxBatchTokenModelRulesLength+1))
	require.ErrorIs(t, err, ErrTokenBatchInvalid)
}

func insertTokenForValidationTest(t *testing.T, token *Token) {
	t.Helper()
	require.NoError(t, DB.Create(token).Error)
}

func TestValidateUserTokenDistinguishesExhaustedQuota(t *testing.T) {
	truncateTables(t)
	insertTokenForValidationTest(t, &Token{
		UserId:         1,
		Key:            "exhausted-token",
		Status:         common.TokenStatusEnabled,
		ExpiredTime:    -1,
		RemainQuota:    0,
		UnlimitedQuota: false,
	})

	token, err := ValidateUserToken("exhausted-token")

	require.ErrorIs(t, err, ErrTokenExhausted)
	require.NotNil(t, token)
	require.Equal(t, 1, token.UserId)
	require.False(t, errors.Is(err, ErrTokenInvalid))
}

func TestValidateUserTokenAllowsUnlimitedExhaustedStatus(t *testing.T) {
	truncateTables(t)
	insertTokenForValidationTest(t, &Token{
		UserId:         1,
		Key:            "unlimited-exhausted-token",
		Status:         common.TokenStatusExhausted,
		ExpiredTime:    -1,
		RemainQuota:    -100,
		UnlimitedQuota: true,
	})

	token, err := ValidateUserToken("unlimited-exhausted-token")

	require.NoError(t, err)
	require.NotNil(t, token)
	require.True(t, token.UnlimitedQuota)
}

func TestValidateUserTokenDistinguishesExpiredToken(t *testing.T) {
	truncateTables(t)
	insertTokenForValidationTest(t, &Token{
		UserId:         1,
		Key:            "expired-token",
		Status:         common.TokenStatusEnabled,
		ExpiredTime:    common.GetTimestamp() - 1,
		RemainQuota:    100,
		UnlimitedQuota: false,
	})

	_, err := ValidateUserToken("expired-token")

	require.ErrorIs(t, err, ErrTokenExpired)
}

func TestValidateUserTokenDistinguishesUnavailableStatus(t *testing.T) {
	truncateTables(t)
	insertTokenForValidationTest(t, &Token{
		UserId:         1,
		Key:            "disabled-token",
		Status:         common.TokenStatusDisabled,
		ExpiredTime:    -1,
		RemainQuota:    100,
		UnlimitedQuota: false,
	})

	_, err := ValidateUserToken("disabled-token")

	require.ErrorIs(t, err, ErrTokenUnavailable)
}
