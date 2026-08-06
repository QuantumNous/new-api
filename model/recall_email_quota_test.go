package model

import (
	"context"
	"fmt"
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

	require.NoError(t, db.AutoMigrate(&RecallEmailQuotaWindow{}, &RecallEmailPacingState{}, &RecallRecipient{}, &RecallCampaignExclusion{}, &RecallMessage{}))
	return db
}

func createRecallEmailQuotaTestRecipient(t *testing.T, id int64, campaignID int64, email string) RecallRecipient {
	t.Helper()

	recipient := RecallRecipient{
		Id:                  id,
		CampaignId:          campaignID,
		UserId:              int(id),
		RecipientIdentity:   RecallRecipientIdentityForUser(int(id)),
		EligibilitySnapshot: `{}`,
		EmailSnapshot:       email,
		LanguageSnapshot:    "en",
		State:               RecallRecipientContacting,
	}
	require.NoError(t, DB.Create(&recipient).Error)
	return recipient
}

func createRecallEmailQuotaLeasedMessage(t *testing.T, id int64, owner string, leaseUntil int64) RecallMessage {
	t.Helper()

	recipient := createRecallEmailQuotaTestRecipient(
		t,
		id,
		10_000+id,
		fmt.Sprintf("pacing-%d@example.com", id),
	)
	message := RecallMessage{
		RecipientId:      recipient.Id,
		StageNo:          1,
		TemplateSnapshot: `{}`,
		State:            RecallMessageLeased,
		LeaseOwner:       owner,
		LeaseExpiresAt:   leaseUntil,
	}
	require.NoError(t, DB.Create(&message).Error)
	return message
}

func restoreRecallEmailTimeHooksForTest(t *testing.T) {
	t.Helper()

	originalQuotaNow := recallEmailQuotaNow
	originalPacingNowMillis := recallEmailPacingNowMillis
	t.Cleanup(func() {
		recallEmailQuotaNow = originalQuotaNow
		recallEmailPacingNowMillis = originalPacingNowMillis
	})
}

func setRecallEmailPacingTestNowMillis(t *testing.T, nowMillis int64) {
	t.Helper()

	recallEmailQuotaNow = func(*gorm.DB) (int64, error) { return nowMillis / 1000, nil }
	recallEmailPacingNowMillis = func(*gorm.DB) (int64, error) { return nowMillis, nil }
}

func beginRecallEmailQuotaPacingAttemptAt(t *testing.T, messageID int64, owner string, leaseUntil int64, limit int, nowMillis int64) RecallEmailSMTPAttempt {
	t.Helper()

	setRecallEmailPacingTestNowMillis(t, nowMillis)
	attempt, err := BeginRecallEmailSMTPAttemptWithContext(
		context.Background(),
		messageID,
		owner,
		leaseUntil,
		limit,
	)
	require.NoError(t, err)
	return attempt
}

func assertRecallEmailQuotaStatusUsed(t *testing.T, limit int, nowMillis int64, used int) {
	t.Helper()

	setRecallEmailPacingTestNowMillis(t, nowMillis)
	status, err := GetRecallEmailQuotaStatusWithContext(context.Background(), limit)
	require.NoError(t, err)
	require.Equal(t, used, status.Used)
}

func assertRecallEmailPacingSlotStillAvailable(t *testing.T, id int64, owner string, leaseUntil int64, limit int, nowMillis int64) {
	t.Helper()

	probe := createRecallEmailQuotaLeasedMessage(t, id, owner, leaseUntil)
	attempt := beginRecallEmailQuotaPacingAttemptAt(t, probe.Id, owner, leaseUntil, limit, nowMillis)
	require.True(t, attempt.Reserved)
}

func assertRecallEmailPacingDenied(t *testing.T, attempt RecallEmailSMTPAttempt, messageID int64, limit int, nowMillis int64, wantUsed int) {
	t.Helper()

	require.False(t, attempt.Reserved)
	require.True(t, attempt.LeaseOwned)
	require.False(t, attempt.Suppressed)
	require.False(t, attempt.Quota.Exhausted)
	assertRecallEmailQuotaStatusUsed(t, limit, nowMillis, wantUsed)
	require.Equal(t, RecallMessageLeased, loadRecallMessageForQuotaTest(t, messageID).State)
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
	recipient := createRecallEmailQuotaTestRecipient(t, 2, 2002, "quota-send@example.com")
	message := RecallMessage{
		RecipientId:      recipient.Id,
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
	recipient := createRecallEmailQuotaTestRecipient(t, 3, 2003, "quota-exhausted@example.com")
	message := RecallMessage{
		RecipientId:      recipient.Id,
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

func TestBeginRecallEmailSMTPAttemptEnforcesGlobalPacingIntervals(t *testing.T) {
	setupRecallEmailQuotaTestDB(t)
	restoreRecallEmailTimeHooksForTest(t)

	const (
		base       = int64(1_800_003_600_000)
		owner      = "pacing-owner"
		leaseUntil = int64(1_800_004_200)
	)

	tests := []struct {
		name       string
		limit      int
		offsets    []int64
		wantAllow  []bool
		messageSeq int64
	}{
		{
			name:       "90 per hour admits at T and T+40 only",
			limit:      90,
			offsets:    []int64{0, 39_999, 40_000},
			wantAllow:  []bool{true, false, true},
			messageSeq: 1_000,
		},
		{
			name:       "180 per hour admits at T and T+20 only",
			limit:      180,
			offsets:    []int64{0, 19_999, 20_000},
			wantAllow:  []bool{true, false, true},
			messageSeq: 2_000,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			setupRecallEmailQuotaTestDB(t)
			used := 0
			for i, offset := range tt.offsets {
				message := createRecallEmailQuotaLeasedMessage(t, tt.messageSeq+int64(i), owner, leaseUntil)
				attempt := beginRecallEmailQuotaPacingAttemptAt(t, message.Id, owner, leaseUntil, tt.limit, base+offset)
				if tt.wantAllow[i] {
					require.True(t, attempt.Reserved, "offset %d", offset)
					used++
					continue
				}
				assertRecallEmailPacingDenied(t, attempt, message.Id, tt.limit, base+offset, used)
			}
		})
	}
}

func TestBeginRecallEmailSMTPAttemptRecomputesPacingAfterLimitChanges(t *testing.T) {
	setupRecallEmailQuotaTestDB(t)
	restoreRecallEmailTimeHooksForTest(t)

	const (
		base       = int64(1_800_010_800_000)
		owner      = "dynamic-pacing-owner"
		leaseUntil = int64(1_800_011_400)
	)

	first := createRecallEmailQuotaLeasedMessage(t, 3_001, owner, leaseUntil)
	require.True(t, beginRecallEmailQuotaPacingAttemptAt(t, first.Id, owner, leaseUntil, 90, base).Reserved)

	increased := createRecallEmailQuotaLeasedMessage(t, 3_002, owner, leaseUntil)
	require.True(t, beginRecallEmailQuotaPacingAttemptAt(t, increased.Id, owner, leaseUntil, 180, base+20_000).Reserved)

	tooSoonAfterDecrease := createRecallEmailQuotaLeasedMessage(t, 3_003, owner, leaseUntil)
	decreaseAttempt := beginRecallEmailQuotaPacingAttemptAt(t, tooSoonAfterDecrease.Id, owner, leaseUntil, 90, base+39_999)
	assertRecallEmailPacingDenied(t, decreaseAttempt, tooSoonAfterDecrease.Id, 90, base+39_999, 2)

	readyAfterDecrease := createRecallEmailQuotaLeasedMessage(t, 3_004, owner, leaseUntil)
	require.True(t, beginRecallEmailQuotaPacingAttemptAt(t, readyAfterDecrease.Id, owner, leaseUntil, 90, base+60_000).Reserved)
}

func TestBeginRecallEmailSMTPAttemptDoesNotBackfillBurstAfterIdleGap(t *testing.T) {
	setupRecallEmailQuotaTestDB(t)
	restoreRecallEmailTimeHooksForTest(t)

	const (
		base       = int64(1_800_018_000_000)
		owner      = "idle-pacing-owner"
		leaseUntil = int64(1_800_018_600)
		limit      = 90
	)

	first := createRecallEmailQuotaLeasedMessage(t, 4_001, owner, leaseUntil)
	require.True(t, beginRecallEmailQuotaPacingAttemptAt(t, first.Id, owner, leaseUntil, limit, base).Reserved)

	afterIdle := createRecallEmailQuotaLeasedMessage(t, 4_002, owner, leaseUntil)
	require.True(t, beginRecallEmailQuotaPacingAttemptAt(t, afterIdle.Id, owner, leaseUntil, limit, base+86_400_000).Reserved)

	sameInstant := createRecallEmailQuotaLeasedMessage(t, 4_003, owner, leaseUntil)
	sameInstantAttempt := beginRecallEmailQuotaPacingAttemptAt(t, sameInstant.Id, owner, leaseUntil, limit, base+86_400_000)
	assertRecallEmailPacingDenied(t, sameInstantAttempt, sameInstant.Id, limit, base+86_400_000, 1)
}

func TestBeginRecallEmailSMTPAttemptDoesNotDoubleSendAcrossUTCHourBoundary(t *testing.T) {
	setupRecallEmailQuotaTestDB(t)
	restoreRecallEmailTimeHooksForTest(t)

	const (
		hourStart  = int64(1_800_021_600_000)
		owner      = "boundary-pacing-owner"
		leaseUntil = int64(1_800_025_400)
		limit      = 90
	)

	beforeBoundary := createRecallEmailQuotaLeasedMessage(t, 5_001, owner, leaseUntil)
	require.True(t, beginRecallEmailQuotaPacingAttemptAt(t, beforeBoundary.Id, owner, leaseUntil, limit, hourStart+3_580_000).Reserved)

	atBoundary := createRecallEmailQuotaLeasedMessage(t, 5_002, owner, leaseUntil)
	atBoundaryAttempt := beginRecallEmailQuotaPacingAttemptAt(t, atBoundary.Id, owner, leaseUntil, limit, hourStart+3_600_000)
	assertRecallEmailPacingDenied(t, atBoundaryAttempt, atBoundary.Id, limit, hourStart+3_600_000, 0)

	afterInterval := createRecallEmailQuotaLeasedMessage(t, 5_003, owner, leaseUntil)
	require.True(t, beginRecallEmailQuotaPacingAttemptAt(t, afterInterval.Id, owner, leaseUntil, limit, hourStart+3_620_000).Reserved)
}

func TestBeginRecallEmailSMTPAttemptConcurrentSameInstantAdmitsOnlyOne(t *testing.T) {
	setupRecallEmailQuotaTestDB(t)
	restoreRecallEmailTimeHooksForTest(t)

	const (
		nowMillis  = int64(1_800_028_800_000)
		owner      = "concurrent-pacing-owner"
		leaseUntil = int64(1_800_029_400)
		limit      = 90
		total      = 24
	)
	setRecallEmailPacingTestNowMillis(t, nowMillis)

	messages := make([]RecallMessage, total)
	for i := range messages {
		messages[i] = createRecallEmailQuotaLeasedMessage(t, 6_000+int64(i), owner, leaseUntil)
	}

	var reserved atomic.Int64
	var wg sync.WaitGroup
	ready := make(chan struct{}, total)
	start := make(chan struct{})
	errors := make(chan error, total)
	for _, message := range messages {
		wg.Add(1)
		go func(messageID int64) {
			defer wg.Done()
			ready <- struct{}{}
			<-start
			attempt, err := BeginRecallEmailSMTPAttemptWithContext(context.Background(), messageID, owner, leaseUntil, limit)
			if err != nil {
				errors <- err
				return
			}
			if attempt.Reserved {
				reserved.Add(1)
			}
		}(message.Id)
	}
	for range messages {
		<-ready
	}
	close(start)
	wg.Wait()
	close(errors)
	for err := range errors {
		require.NoError(t, err)
	}

	require.Equal(t, int64(1), reserved.Load())
}

func TestBeginRecallEmailSMTPAttemptDoesNotAdvancePacingCursorOnNonSendOutcomes(t *testing.T) {
	const (
		nowMillis  = int64(1_800_036_000_000)
		owner      = "non-send-pacing-owner"
		leaseUntil = int64(1_800_036_600)
		limit      = 90
	)

	t.Run("lease loss", func(t *testing.T) {
		setupRecallEmailQuotaTestDB(t)
		restoreRecallEmailTimeHooksForTest(t)
		message := createRecallEmailQuotaLeasedMessage(t, 7_001, owner, leaseUntil)
		attempt := beginRecallEmailQuotaPacingAttemptAt(t, message.Id, "stale-owner", leaseUntil, limit, nowMillis)
		require.False(t, attempt.LeaseOwned)
		require.False(t, attempt.Reserved)
		assertRecallEmailQuotaStatusUsed(t, limit, nowMillis, 0)
		assertRecallEmailPacingSlotStillAvailable(t, 7_101, owner, leaseUntil, limit, nowMillis)
	})

	t.Run("persistent suppression", func(t *testing.T) {
		setupRecallEmailQuotaTestDB(t)
		restoreRecallEmailTimeHooksForTest(t)
		message := createRecallEmailQuotaLeasedMessage(t, 7_002, owner, leaseUntil)
		require.NoError(t, DB.Create(&RecallCampaignExclusion{
			CampaignId:           10_000 + 7_002,
			RecipientIdentity:    RecallRecipientIdentityForUser(7_002),
			UserId:               7_002,
			Persistent:           true,
			PersistentReasonCode: "operator_csv",
		}).Error)

		attempt := beginRecallEmailQuotaPacingAttemptAt(t, message.Id, owner, leaseUntil, limit, nowMillis)
		require.True(t, attempt.LeaseOwned)
		require.True(t, attempt.Suppressed)
		require.False(t, attempt.Reserved)
		assertRecallEmailQuotaStatusUsed(t, limit, nowMillis, 0)
		assertRecallEmailPacingSlotStillAvailable(t, 7_102, owner, leaseUntil, limit, nowMillis)
	})

	t.Run("leased to sending CAS loss", func(t *testing.T) {
		setupRecallEmailQuotaTestDB(t)
		restoreRecallEmailTimeHooksForTest(t)
		message := createRecallEmailQuotaLeasedMessage(t, 7_003, owner, leaseUntil)
		callbackName := "test_force_recall_message_cas_loss_after_quota_reservation"
		fired := false
		DB.Callback().Update().Before("gorm:update").Register(callbackName, func(tx *gorm.DB) {
			if tx.Statement == nil {
				return
			}
			if fired {
				return
			}
			schemaName := ""
			if tx.Statement.Schema != nil {
				schemaName = tx.Statement.Schema.Name
			}
			if schemaName != "RecallMessage" && tx.Statement.Table != "recall_messages" {
				return
			}
			fired = true
			if err := tx.Exec(
				"UPDATE recall_messages SET state = ? WHERE id = ?",
				RecallMessageCancelled,
				message.Id,
			).Error; err != nil {
				tx.AddError(err)
			}
		})
		t.Cleanup(func() {
			require.NoError(t, DB.Callback().Update().Remove(callbackName))
		})

		attempt := beginRecallEmailQuotaPacingAttemptAt(t, message.Id, owner, leaseUntil, limit, nowMillis)
		require.False(t, attempt.LeaseOwned)
		require.False(t, attempt.Reserved)
		assertRecallEmailQuotaStatusUsed(t, limit, nowMillis, 0)
		assertRecallEmailPacingSlotStillAvailable(t, 7_103, owner, leaseUntil, limit, nowMillis)
	})
}

func TestBeginRecallEmailSMTPAttemptRollsBackPacingReservationWhenHourlyQuotaExhausted(t *testing.T) {
	setupRecallEmailQuotaTestDB(t)
	restoreRecallEmailTimeHooksForTest(t)

	const (
		baseMillis = int64(1_800_043_200_000)
		owner      = "quota-exhaustion-pacing-owner"
		leaseUntil = int64(1_800_043_800)
	)

	first := createRecallEmailQuotaLeasedMessage(t, 8_001, owner, leaseUntil)
	require.True(t, beginRecallEmailQuotaPacingAttemptAt(t, first.Id, owner, leaseUntil, 90, baseMillis).Reserved)
	require.NoError(t, DB.Model(&RecallEmailQuotaWindow{}).
		Where("window_started_at = ?", recallEmailQuotaWindowStart(baseMillis/1000)).
		Update("attempts", 90).Error)

	exhausted := createRecallEmailQuotaLeasedMessage(t, 8_002, owner, leaseUntil)
	exhaustedAttempt := beginRecallEmailQuotaPacingAttemptAt(t, exhausted.Id, owner, leaseUntil, 90, baseMillis+40_000)
	require.False(t, exhaustedAttempt.Reserved)
	require.True(t, exhaustedAttempt.Quota.Exhausted)

	afterRollback := createRecallEmailQuotaLeasedMessage(t, 8_003, owner, leaseUntil)
	require.True(t, beginRecallEmailQuotaPacingAttemptAt(t, afterRollback.Id, owner, leaseUntil, 91, baseMillis+40_000).Reserved)
}
