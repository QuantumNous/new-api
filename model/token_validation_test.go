package model

import (
	"errors"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

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
