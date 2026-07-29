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

	require.NoError(t, db.AutoMigrate(&RecallEmailQuotaWindow{}, &RecallMessage{}))
	return db
}

func TestBeginRecallEmailSMTPAttemptDoesNotConsumeQuotaAfterLeaseLoss(t *testing.T) {
	setupRecallEmailQuotaTestDB(t)
	message := RecallMessage{
		RecipientId:      1,
		StageNo:          1,
		TemplateSnapshot: `{}`,
		State:            RecallMessageLeased,
		LeaseOwner:       "current-owner",
		LeaseExpiresAt:   1_800_000_600,
	}
	require.NoError(t, DB.Create(&message).Error)

	attempt, err := BeginRecallEmailSMTPAttemptWithContext(
		context.Background(),
		message.Id,
		"stale-owner",
		message.LeaseExpiresAt,
		5,
	)

	require.NoError(t, err)
	require.False(t, attempt.LeaseOwned)
	require.False(t, attempt.Reserved)
	status, err := GetRecallEmailQuotaStatusWithContext(context.Background(), 5)
	require.NoError(t, err)
	require.Zero(t, status.Used)
	require.Equal(t, RecallMessageLeased, loadRecallMessageForQuotaTest(t, message.Id).State)
}

func TestBeginRecallEmailSMTPAttemptCommitsSendingAndQuotaTogether(t *testing.T) {
	setupRecallEmailQuotaTestDB(t)
	message := RecallMessage{
		RecipientId:      2,
		StageNo:          1,
		TemplateSnapshot: `{}`,
		State:            RecallMessageLeased,
		LeaseOwner:       "email-owner",
		LeaseExpiresAt:   1_800_000_600,
	}
	require.NoError(t, DB.Create(&message).Error)

	attempt, err := BeginRecallEmailSMTPAttemptWithContext(
		context.Background(),
		message.Id,
		message.LeaseOwner,
		message.LeaseExpiresAt,
		5,
	)

	require.NoError(t, err)
	require.True(t, attempt.LeaseOwned)
	require.True(t, attempt.Reserved)
	require.Equal(t, 1, attempt.Quota.Used)
	require.Equal(t, RecallMessageSending, loadRecallMessageForQuotaTest(t, message.Id).State)
}

func TestBeginRecallEmailSMTPAttemptRollsBackSendingWhenQuotaIsExhausted(t *testing.T) {
	setupRecallEmailQuotaTestDB(t)
	_, reserved, err := ReserveRecallEmailQuotaWithContext(context.Background(), 1)
	require.NoError(t, err)
	require.True(t, reserved)
	message := RecallMessage{
		RecipientId:      3,
		StageNo:          1,
		TemplateSnapshot: `{}`,
		State:            RecallMessageLeased,
		LeaseOwner:       "email-owner",
		LeaseExpiresAt:   1_800_000_600,
	}
	require.NoError(t, DB.Create(&message).Error)

	attempt, err := BeginRecallEmailSMTPAttemptWithContext(
		context.Background(),
		message.Id,
		message.LeaseOwner,
		message.LeaseExpiresAt,
		1,
	)

	require.NoError(t, err)
	require.True(t, attempt.LeaseOwned)
	require.False(t, attempt.Reserved)
	require.True(t, attempt.Quota.Exhausted)
	require.Equal(t, RecallMessageLeased, loadRecallMessageForQuotaTest(t, message.Id).State)
	status, err := GetRecallEmailQuotaStatusWithContext(context.Background(), 1)
	require.NoError(t, err)
	require.Equal(t, 1, status.Used)
}

func loadRecallMessageForQuotaTest(t *testing.T, id int64) RecallMessage {
	t.Helper()
	var message RecallMessage
	require.NoError(t, DB.First(&message, id).Error)
	return message
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
	recallEmailQuotaNow = func(*gorm.DB) (int64, error) { return firstHour + 42, nil }
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

	recallEmailQuotaNow = func(*gorm.DB) (int64, error) { return firstHour + 3600 + 7, nil }
	status, err = GetRecallEmailQuotaStatusWithContext(context.Background(), 5)
	require.NoError(t, err)
	require.Equal(t, 5, status.Limit)
	require.Zero(t, status.Used)
	require.Equal(t, 5, status.Remaining)
	require.Equal(t, firstHour+3600, status.WindowStartedAt)
	require.Equal(t, firstHour+7200, status.ResetsAt)
	require.False(t, status.Exhausted)
}
