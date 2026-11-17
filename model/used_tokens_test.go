package model

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func clearUsedTokensBackfillMarker(t *testing.T) {
	t.Helper()
	// The migration marker lives in the same options table other internal
	// markers use; the test schema does not always create it.
	if !DB.Migrator().HasTable(&Option{}) {
		require.NoError(t, DB.AutoMigrate(&Option{}))
	}
	require.NoError(t, DB.Where(&Option{Key: usedTokensBackfillOptionKey}).Delete(&Option{}).Error)
}

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

// The consume path must count tokens even when consume logs are not kept, since
// used_quota is still updated in that configuration.
func TestRecordConsumeLogCountsTokensWhenLoggingDisabled(t *testing.T) {
	setupUserUpdateTestState(t)
	user := createUserBindTestUser(t)

	oldLogConsumeEnabled := common.LogConsumeEnabled
	common.LogConsumeEnabled = false
	t.Cleanup(func() { common.LogConsumeEnabled = oldLogConsumeEnabled })

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Set("username", user.Username)

	RecordConsumeLog(ctx, user.Id, RecordConsumeLogParams{
		PromptTokens:     100,
		CompletionTokens: 50,
	})

	var got User
	require.NoError(t, DB.First(&got, user.Id).Error)
	assert.EqualValues(t, 150, got.UsedTokens)
}

func TestBackfillUserUsedTokensSeedsFromQuotaData(t *testing.T) {
	setupUserUpdateTestState(t)
	user := createUserBindTestUser(t)
	clearUsedTokensBackfillMarker(t)

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

	// The marker makes the seed a one-off; a second start must not re-sum.
	require.NoError(t, backfillUserUsedTokens())
	require.NoError(t, DB.First(&got, user.Id).Error)
	assert.EqualValues(t, 425, got.UsedTokens)
}

// A retry after a failed start must not pull a counter back to an older export
// total, and must not lose increments recorded in between.
func TestBackfillUserUsedTokensNeverLowersCounter(t *testing.T) {
	setupUserUpdateTestState(t)
	user := createUserBindTestUser(t)
	clearUsedTokensBackfillMarker(t)

	require.NoError(t, DB.Exec("DELETE FROM quota_data").Error)
	require.NoError(t, DB.Create(&QuotaData{
		UserID:    user.Id,
		Username:  user.Username,
		ModelName: "gpt-test",
		CreatedAt: 1000,
		Count:     1,
		Quota:     100,
		TokenUsed: 42,
	}).Error)
	require.NoError(t, DB.Model(&User{}).Where("id = ?", user.Id).Update("used_tokens", 900).Error)

	require.NoError(t, backfillUserUsedTokens())

	var got User
	require.NoError(t, DB.First(&got, user.Id).Error)
	assert.EqualValues(t, 900, got.UsedTokens)
}

// GetSelfUserById selects an explicit column list; missing used_tokens there
// silently reported 0 to every dashboard client.
func TestGetSelfUserByIdReturnsUsedTokens(t *testing.T) {
	setupUserUpdateTestState(t)
	user := createUserBindTestUser(t)

	UpdateUserUsedTokens(user.Id, 1234)

	got, err := GetSelfUserById(user.Id)
	require.NoError(t, err)
	assert.EqualValues(t, 1234, got.UsedTokens)
}

// With DataExportEnabled off, quota_data never received rows, but consume logs
// did. The seed must not fall back to the smaller export total in that case.
func TestBackfillUserUsedTokensUsesConsumeLogs(t *testing.T) {
	setupUserUpdateTestState(t)
	user := createUserBindTestUser(t)
	clearUsedTokensBackfillMarker(t)

	if !DB.Migrator().HasTable(&Log{}) {
		require.NoError(t, DB.AutoMigrate(&Log{}))
	}
	require.NoError(t, DB.Exec("DELETE FROM logs").Error)
	require.NoError(t, DB.Exec("DELETE FROM quota_data").Error)

	require.NoError(t, DB.Create(&Log{
		UserId:           user.Id,
		Username:         user.Username,
		Type:             LogTypeConsume,
		CreatedAt:        1000,
		PromptTokens:     300,
		CompletionTokens: 200,
	}).Error)
	require.NoError(t, DB.Create(&QuotaData{
		UserID:    user.Id,
		Username:  user.Username,
		ModelName: "gpt-test",
		CreatedAt: 2000,
		Count:     1,
		Quota:     10,
		TokenUsed: 100,
	}).Error)

	require.NoError(t, backfillUserUsedTokens())

	var got User
	require.NoError(t, DB.First(&got, user.Id).Error)
	assert.EqualValues(t, 500, got.UsedTokens)
}
