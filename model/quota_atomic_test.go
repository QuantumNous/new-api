package model

import (
	"errors"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func seedQuotaUser(t *testing.T, id int, quota int) {
	t.Helper()
	require.NoError(t, DB.Create(&User{
		Id:       id,
		Username: "quota_user",
		Quota:    quota,
		Status:   common.UserStatusEnabled,
	}).Error)
}

func seedQuotaToken(t *testing.T, id int, userId int, key string, remainQuota int, unlimited bool) {
	t.Helper()
	require.NoError(t, DB.Create(&Token{
		Id:             id,
		UserId:         userId,
		Key:            key,
		Name:           "quota_token",
		Status:         common.TokenStatusEnabled,
		RemainQuota:    remainQuota,
		UnlimitedQuota: unlimited,
	}).Error)
}

func readUserQuota(t *testing.T, id int) int {
	t.Helper()
	var user User
	require.NoError(t, DB.First(&user, id).Error)
	return user.Quota
}

func readTokenQuota(t *testing.T, id int) (remain int, used int) {
	t.Helper()
	var token Token
	require.NoError(t, DB.First(&token, id).Error)
	return token.RemainQuota, token.UsedQuota
}

func TestDecreaseUserQuotaRejectsInsufficientQuota(t *testing.T) {
	truncateTables(t)

	seedQuotaUser(t, 1001, 100)

	err := DecreaseUserQuota(1001, 150, false)

	require.Error(t, err)
	assert.True(t, errors.Is(err, ErrInsufficientUserQuota))
	assert.Equal(t, 100, readUserQuota(t, 1001))
}

func TestDecreaseUserQuotaBypassesBatchUpdateForAtomicity(t *testing.T) {
	truncateTables(t)
	oldBatchUpdateEnabled := common.BatchUpdateEnabled
	common.BatchUpdateEnabled = true
	t.Cleanup(func() {
		common.BatchUpdateEnabled = oldBatchUpdateEnabled
	})

	seedQuotaUser(t, 1002, 100)

	require.NoError(t, DecreaseUserQuota(1002, 80, false))

	assert.Equal(t, 20, readUserQuota(t, 1002))
}

func TestDecreaseTokenQuotaRejectsInsufficientQuota(t *testing.T) {
	truncateTables(t)

	seedQuotaUser(t, 1003, 1000)
	seedQuotaToken(t, 1003, 1003, "sk-quota-token", 100, false)

	err := DecreaseTokenQuota(1003, "sk-quota-token", 150)

	require.Error(t, err)
	assert.True(t, errors.Is(err, ErrInsufficientTokenQuota))
	remain, used := readTokenQuota(t, 1003)
	assert.Equal(t, 100, remain)
	assert.Equal(t, 0, used)
}

func TestDecreaseTokenQuotaForUnlimitedAllowsUsageTracking(t *testing.T) {
	truncateTables(t)

	seedQuotaUser(t, 1004, 1000)
	seedQuotaToken(t, 1004, 1004, "sk-unlimited-token", 0, true)

	require.NoError(t, DecreaseTokenQuotaForUnlimited(1004, "sk-unlimited-token", 50))

	remain, used := readTokenQuota(t, 1004)
	assert.Equal(t, -50, remain)
	assert.Equal(t, 50, used)
}
