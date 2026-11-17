package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUpdateUserUsedTokensAccumulates(t *testing.T) {
	setupUserUpdateTestState(t)
	user := createUserBindTestUser(t)

	UpdateUserUsedTokens(user.Id, 120)
	UpdateUserUsedTokens(user.Id, 80)

	var got User
	require.NoError(t, DB.First(&got, user.Id).Error)
	assert.EqualValues(t, 200, got.UsedTokens)

	// Refunds and empty usage must not move a lifetime counter backwards.
	UpdateUserUsedTokens(user.Id, 0)
	UpdateUserUsedTokens(user.Id, -50)

	require.NoError(t, DB.First(&got, user.Id).Error)
	assert.EqualValues(t, 200, got.UsedTokens)
}

func TestUpdateUserUsedTokensUsesBatchUpdater(t *testing.T) {
	setupUserUpdateTestState(t)
	user := createUserBindTestUser(t)

	oldBatchUpdateEnabled := common.BatchUpdateEnabled
	common.BatchUpdateEnabled = true
	t.Cleanup(func() { common.BatchUpdateEnabled = oldBatchUpdateEnabled })

	UpdateUserUsedTokens(user.Id, 300)

	var pending User
	require.NoError(t, DB.First(&pending, user.Id).Error)
	assert.Zero(t, pending.UsedTokens, "batch mode defers the write")

	batchUpdate()

	var got User
	require.NoError(t, DB.First(&got, user.Id).Error)
	assert.EqualValues(t, 300, got.UsedTokens)
}

func TestBackfillUserUsedTokensSeedsFromQuotaData(t *testing.T) {
	setupUserUpdateTestState(t)
	user := createUserBindTestUser(t)

	require.NoError(t, DB.Exec("DELETE FROM quota_data").Error)
	require.NoError(t, DB.Create(&QuotaData{
		UserID:    user.Id,
		Username:  user.Username,
		ModelName: "gpt-test",
		CreatedAt: 1000,
		Count:     2,
		Quota:     100,
		TokenUsed: 400,
	}).Error)
	require.NoError(t, DB.Create(&QuotaData{
		UserID:    user.Id,
		Username:  user.Username,
		ModelName: "gpt-test",
		CreatedAt: 2000,
		Count:     1,
		Quota:     50,
		TokenUsed: 25,
	}).Error)

	require.NoError(t, backfillUserUsedTokens())

	var got User
	require.NoError(t, DB.First(&got, user.Id).Error)
	assert.EqualValues(t, 425, got.UsedTokens)
}
