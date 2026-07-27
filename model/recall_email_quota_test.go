package model

import (
	"context"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupRecallEmailQuotaTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	originalDB := DB
	db, err := gorm.Open(
		sqlite.Open(t.TempDir()+"/recall-email-quota.db?_pragma=busy_timeout(5000)"),
		&gorm.Config{},
	)
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(16)
	DB = db
	t.Cleanup(func() {
		_ = sqlDB.Close()
		DB = originalDB
	})

	require.NoError(t, db.AutoMigrate(&RecallEmailQuotaWindow{}))
	return db
}

func TestReserveRecallEmailQuotaNeverExceedsLimit(t *testing.T) {
	setupRecallEmailQuotaTestDB(t)

	const (
		limit        = 7
		reservations = 24
	)
	var allowed atomic.Int64
	var wg sync.WaitGroup
	errors := make(chan error, reservations)

	for range reservations {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, reserved, err := ReserveRecallEmailQuotaWithContext(context.Background(), limit)
			if err != nil {
				errors <- err
				return
			}
			if reserved {
				allowed.Add(1)
			}
		}()
	}
	wg.Wait()
	close(errors)
	for err := range errors {
		require.NoError(t, err)
	}

	require.Equal(t, int64(limit), allowed.Load())
	status, err := GetRecallEmailQuotaStatusWithContext(context.Background(), limit)
	require.NoError(t, err)
	require.Equal(t, limit, status.Used)
	require.Zero(t, status.Remaining)
	require.True(t, status.Exhausted)
}

func TestRecallEmailQuotaStatusUsesDatabaseHourAndResets(t *testing.T) {
	db := setupRecallEmailQuotaTestDB(t)
	originalNow := recallEmailQuotaNow
	t.Cleanup(func() { recallEmailQuotaNow = originalNow })

	const firstHour = int64(1_800_000_000)
	recallEmailQuotaNow = func() int64 { return firstHour + 42 }
	require.NoError(t, db.Create(&RecallEmailQuotaWindow{
		WindowStartedAt: firstHour,
		Attempts:        3,
	}).Error)

	status, err := GetRecallEmailQuotaStatusWithContext(context.Background(), 5)
	require.NoError(t, err)
	require.Equal(t, RecallEmailQuotaStatus{
		Limit:           5,
		Used:            3,
		Remaining:       2,
		WindowStartedAt: firstHour,
		ResetsAt:        firstHour + 3600,
		Exhausted:       false,
	}, status)

	recallEmailQuotaNow = func() int64 { return firstHour + 3600 + 7 }
	status, err = GetRecallEmailQuotaStatusWithContext(context.Background(), 5)
	require.NoError(t, err)
	require.Equal(t, 5, status.Limit)
	require.Zero(t, status.Used)
	require.Equal(t, 5, status.Remaining)
	require.Equal(t, firstHour+3600, status.WindowStartedAt)
	require.Equal(t, firstHour+7200, status.ResetsAt)
	require.False(t, status.Exhausted)
}
