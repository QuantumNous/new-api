package model

import (
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupTemporaryChannelSpendTestDB(t *testing.T, name string) *gorm.DB {
	t.Helper()
	originalDB := DB
	t.Cleanup(func() { DB = originalDB })
	db, err := gorm.Open(sqlite.Open("file:"+name+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, db.AutoMigrate(&TemporaryChannelModelSpend{}))
	DB = db
	return db
}

func TestAddTemporaryChannelModelSpendAccumulates(t *testing.T) {
	setupTemporaryChannelSpendTestDB(t, "temp-spend-accum")

	total, err := AddTemporaryChannelModelSpend("kimi-k2.7", 1000, 100)
	require.NoError(t, err)
	require.Equal(t, int64(1000), total)

	total, err = AddTemporaryChannelModelSpend("kimi-k2.7", 2500, 200)
	require.NoError(t, err)
	require.Equal(t, int64(3500), total)

	// isolated per model
	total, err = AddTemporaryChannelModelSpend("flux-2-pro", 700, 300)
	require.NoError(t, err)
	require.Equal(t, int64(700), total)

	var rec TemporaryChannelModelSpend
	require.NoError(t, DB.First(&rec, "model_name = ?", "kimi-k2.7").Error)
	require.Equal(t, int64(2), rec.Count)
	require.Equal(t, int64(3500), rec.Quota)
}

func TestAddTemporaryChannelModelSpendNoOpOnBadInput(t *testing.T) {
	setupTemporaryChannelSpendTestDB(t, "temp-spend-noop")
	total, err := AddTemporaryChannelModelSpend("", 1000, 1)
	require.NoError(t, err)
	require.Equal(t, int64(0), total)
	total, err = AddTemporaryChannelModelSpend("m", 0, 1)
	require.NoError(t, err)
	require.Equal(t, int64(0), total)
}

func TestTryClaimTemporaryChannelSpendAlertFiresOncePerWindow(t *testing.T) {
	setupTemporaryChannelSpendTestDB(t, "temp-spend-claim")
	// seed the row via an accumulation
	_, err := AddTemporaryChannelModelSpend("gpt-5.5", 5000, 1000)
	require.NoError(t, err)

	// first claim within window succeeds
	ok, err := TryClaimTemporaryChannelSpendAlert("gpt-5.5", 3600, 2000)
	require.NoError(t, err)
	require.True(t, ok)

	// second claim inside the cooldown window is suppressed
	ok, err = TryClaimTemporaryChannelSpendAlert("gpt-5.5", 3600, 2500)
	require.NoError(t, err)
	require.False(t, ok)

	// after the cooldown elapses, it can fire again
	ok, err = TryClaimTemporaryChannelSpendAlert("gpt-5.5", 3600, 2000+3601)
	require.NoError(t, err)
	require.True(t, ok)
}
