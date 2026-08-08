package model

import (
	"context"
	"math"
	"testing"

	"github.com/QuantumNous/new-api/common"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupSavingsLifetimeTestDB(t *testing.T) {
	t.Helper()
	previousDB := DB
	previousType := common.MainDatabaseType()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(
		&SavingsLifetimeEvent{},
		&SavingsLifetimeDaily{},
		&SavingsLifetimeTotal{},
	))
	DB = db
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	t.Cleanup(func() {
		DB = previousDB
		common.SetMainDatabaseType(previousType)
	})
}

func TestAggregatePendingSavingsLifetimeEventsIsIdempotent(t *testing.T) {
	setupSavingsLifetimeTestDB(t)
	dayOne := int64(1_785_081_600)
	dayTwo := dayOne + 24*60*60
	events := []SavingsLifetimeEvent{
		{
			EventKey:         "log:1:base",
			SourceKey:        "db:1",
			UserID:           7,
			OccurredAt:       dayOne + 10,
			DayStartUTC:      dayOne,
			EventType:        SavingsLifetimeEventTypeBase,
			CoverageState:    SavingsLifetimeCoverageEstimated,
			CalculationMode:  SavingsLifetimeCalculationSnapshot,
			OfficialQuota:    300,
			ActualQuota:      100,
			SavingsQuota:     200,
			SavingsCNYMicros: 2_000,
		},
		{
			EventKey:      "log:2:base",
			SourceKey:     "db:2",
			UserID:        7,
			OccurredAt:    dayOne + 20,
			DayStartUTC:   dayOne,
			EventType:     SavingsLifetimeEventTypeBase,
			CoverageState: SavingsLifetimeCoverageSkipped,
			SkipReason:    "missing_official_price",
		},
		{
			EventKey:         "log:3:base",
			SourceKey:        "db:3",
			UserID:           7,
			OccurredAt:       dayTwo + 30,
			DayStartUTC:      dayTwo,
			EventType:        SavingsLifetimeEventTypeBase,
			CoverageState:    SavingsLifetimeCoverageEstimated,
			CalculationMode:  SavingsLifetimeCalculationRebuild,
			OfficialQuota:    500,
			ActualQuota:      250,
			SavingsQuota:     250,
			SavingsCNYMicros: 2_500,
		},
	}
	require.NoError(t, CreateSavingsLifetimeEvents(events))
	require.NoError(t, CreateSavingsLifetimeEvents(events[:1]))

	processed, err := AggregatePendingSavingsLifetimeEvents(100)
	require.NoError(t, err)
	assert.Equal(t, 3, processed)

	total, err := GetSavingsLifetimeTotal(7)
	require.NoError(t, err)
	assert.Equal(t, int64(3), total.RequestCount)
	assert.Equal(t, int64(2), total.EstimatedRequestCount)
	assert.Equal(t, int64(1), total.SnapshotRequestCount)
	assert.Equal(t, int64(1), total.ReconstructedRequestCount)
	assert.Equal(t, int64(800), total.OfficialQuota)
	assert.Equal(t, int64(350), total.ActualQuota)
	assert.Equal(t, int64(450), total.SavingsQuota)
	assert.Equal(t, int64(4_500), total.SavingsCNYMicros)
	assert.Equal(t, dayOne+10, total.StatisticsStartedAt)

	var daily []SavingsLifetimeDaily
	require.NoError(t, DB.Order("day_start_utc asc").Find(&daily).Error)
	require.Len(t, daily, 2)
	assert.Equal(t, int64(2), daily[0].RequestCount)
	assert.Equal(t, int64(1), daily[0].EstimatedRequestCount)
	assert.Equal(t, int64(200), daily[0].SavingsQuota)
	assert.Equal(t, int64(1), daily[1].RequestCount)
	assert.Equal(t, int64(250), daily[1].SavingsQuota)

	processed, err = AggregatePendingSavingsLifetimeEvents(100)
	require.NoError(t, err)
	assert.Zero(t, processed)
}

func TestAggregatePendingSavingsLifetimeEventsRollsBackOnOverflow(t *testing.T) {
	setupSavingsLifetimeTestDB(t)
	require.NoError(t, DB.Create(&SavingsLifetimeTotal{
		UserID:        9,
		SavingsQuota:  math.MaxInt64,
		OfficialQuota: math.MaxInt64,
	}).Error)
	require.NoError(t, CreateSavingsLifetimeEvents([]SavingsLifetimeEvent{{
		EventKey:      "log:overflow:base",
		SourceKey:     "db:overflow",
		UserID:        9,
		OccurredAt:    1_785_081_610,
		DayStartUTC:   1_785_081_600,
		EventType:     SavingsLifetimeEventTypeBase,
		CoverageState: SavingsLifetimeCoverageEstimated,
		OfficialQuota: 1,
		SavingsQuota:  1,
	}}))

	processed, err := AggregatePendingSavingsLifetimeEvents(100)
	require.Error(t, err)
	assert.Zero(t, processed)

	var event SavingsLifetimeEvent
	require.NoError(t, DB.Where("event_key = ?", "log:overflow:base").First(&event).Error)
	assert.Zero(t, event.AggregatedAt)
	total, err := GetSavingsLifetimeTotal(9)
	require.NoError(t, err)
	assert.Equal(t, int64(math.MaxInt64), total.SavingsQuota)

	var dailyCount int64
	require.NoError(t, DB.Model(&SavingsLifetimeDaily{}).Count(&dailyCount).Error)
	assert.Zero(t, dailyCount)
}

func TestHasPendingSavingsLifetimeEventsReportsExistence(t *testing.T) {
	setupSavingsLifetimeTestDB(t)

	hasPending, err := HasPendingSavingsLifetimeEvents()
	require.NoError(t, err)
	assert.False(t, hasPending)

	require.NoError(t, CreateSavingsLifetimeEvents([]SavingsLifetimeEvent{{
		EventKey: "log:pending:base",
	}}))
	hasPending, err = HasPendingSavingsLifetimeEvents()
	require.NoError(t, err)
	assert.True(t, hasPending)

	_, err = AggregatePendingSavingsLifetimeEvents(1)
	require.NoError(t, err)
	hasPending, err = HasPendingSavingsLifetimeEvents()
	require.NoError(t, err)
	assert.False(t, hasPending)
}

func TestCheckSavingsLifetimeSQLiteIntegrityAcceptsHealthyDatabase(t *testing.T) {
	setupSavingsLifetimeTestDB(t)
	previousLogDB := LOG_DB
	previousLogType := common.LogDatabaseType()
	LOG_DB = DB
	common.SetLogDatabaseType(common.DatabaseTypeSQLite)
	t.Cleanup(func() {
		LOG_DB = previousLogDB
		common.SetLogDatabaseType(previousLogType)
	})

	require.NoError(t, CheckSavingsLifetimeSQLiteIntegrity(context.Background()))
}
