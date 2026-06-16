package model

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupDingTalkAlertCooldownTestDB(t *testing.T, name string) *gorm.DB {
	t.Helper()

	originalDB := DB
	t.Cleanup(func() {
		DB = originalDB
	})

	db, err := gorm.Open(sqlite.Open("file:"+name+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, db.AutoMigrate(&DingTalkAlertCooldownRecord{}))
	DB = db
	return db
}

func TestDingTalkAlertCooldownCommitRequiresReservationToken(t *testing.T) {
	db := setupDingTalkAlertCooldownTestDB(t, "dingtalk-token-commit")

	reservation, allowed, err := ReserveDingTalkAlertCooldown(32, time.Hour, 20*time.Second, "token-a")
	require.NoError(t, err)
	require.True(t, allowed)
	require.NotNil(t, reservation)

	require.NoError(t, db.Model(&DingTalkAlertCooldownRecord{}).
		Where("channel_id = ?", 32).
		Update("reservation_token", "token-b").Error)

	err = CommitDingTalkAlertCooldown(reservation)
	require.Error(t, err)

	var record DingTalkAlertCooldownRecord
	require.NoError(t, db.First(&record, "channel_id = ?", 32).Error)
	require.Equal(t, int64(0), record.LastAt)
	require.NotZero(t, record.PendingAt)
	require.Equal(t, "token-b", record.ReservationToken)
}

func TestDingTalkAlertCooldownCommittedRecordSuppressesNewReservation(t *testing.T) {
	setupDingTalkAlertCooldownTestDB(t, "dingtalk-committed-suppresses")

	reservation, allowed, err := ReserveDingTalkAlertCooldown(32, time.Hour, 20*time.Second, "token-a")
	require.NoError(t, err)
	require.True(t, allowed)
	require.NotNil(t, reservation)
	require.NoError(t, CommitDingTalkAlertCooldown(reservation))

	nextReservation, allowed, err := ReserveDingTalkAlertCooldown(32, time.Hour, 20*time.Second, "token-b")
	require.NoError(t, err)
	require.False(t, allowed)
	require.Nil(t, nextReservation)
}

func TestDingTalkAlertCooldownStalePendingReservationDoesNotConsumeCooldown(t *testing.T) {
	db := setupDingTalkAlertCooldownTestDB(t, "dingtalk-stale-pending")

	firstReservation, allowed, err := ReserveDingTalkAlertCooldown(32, time.Hour, 20*time.Second, "token-a")
	require.NoError(t, err)
	require.True(t, allowed)
	require.NotNil(t, firstReservation)

	secondReservation, allowed, err := ReserveDingTalkAlertCooldown(32, time.Hour, 20*time.Second, "token-b")
	require.NoError(t, err)
	require.False(t, allowed)
	require.Nil(t, secondReservation)

	require.NoError(t, db.Model(&DingTalkAlertCooldownRecord{}).
		Where("channel_id = ?", 32).
		Updates(map[string]any{
			"pending_at":        int64(1),
			"reservation_token": "stale-token",
		}).Error)

	retryReservation, allowed, err := ReserveDingTalkAlertCooldown(32, time.Hour, 20*time.Second, "token-c")
	require.NoError(t, err)
	require.True(t, allowed)
	require.NotNil(t, retryReservation)
}

func TestMigrateDBFastCreatesDingTalkAlertCooldownTable(t *testing.T) {
	originalDB := DB
	originalUsingSQLite := common.UsingSQLite
	t.Cleanup(func() {
		DB = originalDB
		common.UsingSQLite = originalUsingSQLite
	})

	db, err := gorm.Open(sqlite.Open("file:dingtalk-fast-migrate?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	DB = db
	common.UsingSQLite = true

	require.NoError(t, migrateDBFast())
	require.True(t, db.Migrator().HasTable(&DingTalkAlertCooldownRecord{}))
	require.True(t, db.Migrator().HasTable(&CodexModelGovernanceProbeState{}))
	require.True(t, db.Migrator().HasTable(&CodexModelGovernanceAlertCooldownRecord{}))
}
