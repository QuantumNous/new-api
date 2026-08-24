package service

import (
	"bytes"
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestRecallExclusionPreviewResolvesTrimmedHeadersDuplicatesAndWarnings(t *testing.T) {
	db := setupRecallExclusionServiceTestDB(t)
	campaign := seedRecallExclusionCampaign(t)
	seedRecallExclusionUsers(t,
		model.User{Id: 101, Email: "ada@example.com", Username: "ada"},
		model.User{Id: 102, Email: "grace@example.com", Username: "grace"},
	)

	service := NewRecallExclusionService()
	preview, err := service.Preview(context.Background(), campaign.Id, 7, strings.NewReader(" USER_ID , EMAIL \n 101 , ADA@EXAMPLE.COM \n 101,\n, grace@example.com\n,missing@example.com\n"))

	require.NoError(t, err)
	require.Equal(t, int64(4), preview.TotalRows)
	require.Equal(t, int64(2), preview.ResolvedUsers)
	require.Equal(t, int64(1), preview.DuplicateRows)
	require.Equal(t, int64(1), preview.UnresolvedRows)
	require.Equal(t, int64(0), preview.ConflictRows)
	require.Empty(t, preview.BlockingErrors)
	require.Len(t, preview.Warnings, 2)
	require.True(t, preview.Confirmable)
	require.NotZero(t, preview.BatchID)

	var exclusions int64
	require.NoError(t, db.Model(&model.RecallCampaignExclusion{}).Count(&exclusions).Error)
	require.Zero(t, exclusions)
}

func TestRecallExclusionPreviewEmitsSanitizedOperationalCountLog(t *testing.T) {
	_ = setupRecallExclusionServiceTestDB(t)
	campaign := seedRecallExclusionCampaign(t)
	seedRecallExclusionUsers(t,
		model.User{Id: 101, Email: "ada@example.com", Username: "ada"},
		model.User{Id: 102, Email: "grace@example.com", Username: "grace"},
	)
	logs := captureRecallExclusionSysLogs(t)

	service := NewRecallExclusionService()
	preview, err := service.Preview(context.Background(), campaign.Id, 7, strings.NewReader("user_id,email\n101,ada@example.com\n101,\n999,\n102,grace@example.com\n"))

	require.NoError(t, err)
	require.NotZero(t, preview.BatchID)
	output := logs.String()
	require.Contains(t, output, "recall exclusion preview persisted")
	require.Contains(t, output, fmt.Sprintf("campaign_id=%d", campaign.Id))
	require.Contains(t, output, fmt.Sprintf("batch_id=%d", preview.BatchID))
	require.Contains(t, output, "total_rows=4")
	require.Contains(t, output, "resolved_users=2")
	require.Contains(t, output, "duplicate_rows=1")
	require.Contains(t, output, "unresolved_rows=1")
	require.Contains(t, output, "conflict_rows=0")
	require.Contains(t, output, "blocking_errors=0")
	require.Contains(t, output, "warnings=2")
	require.Contains(t, output, "cancelable_work=0")
	require.NotContains(t, output, "ada@example.com")
	require.NotContains(t, output, "grace@example.com")
	require.NotContains(t, output, "user_id")
	require.NotContains(t, output, "email")
}

func TestRecallExclusionPreviewRejectsBlockingParseAndIdentityErrors(t *testing.T) {
	_ = setupRecallExclusionServiceTestDB(t)
	campaign := seedRecallExclusionCampaign(t)
	seedRecallExclusionUsers(t,
		model.User{Id: 101, Email: "ada@example.com", Username: "ada"},
		model.User{Id: 102, Email: "grace@example.com", Username: "grace"},
	)

	service := NewRecallExclusionService()
	preview, err := service.Preview(context.Background(), campaign.Id, 7, strings.NewReader("email,user_id\nnot-an-email,\ngrace@example.com,101\n,abc\n"))

	require.NoError(t, err)
	require.Equal(t, int64(3), preview.TotalRows)
	require.Equal(t, int64(1), preview.ConflictRows)
	require.False(t, preview.Confirmable)
	require.Len(t, preview.BlockingErrors, 3)
	require.ElementsMatch(t, []string{"malformed_email", "identity_conflict", "malformed_user_id"}, recallExclusionProblemCodes(preview.BlockingErrors))
}

func TestRecallExclusionPreviewRequiresBothProvidedIdentitiesToResolveSameUser(t *testing.T) {
	_ = setupRecallExclusionServiceTestDB(t)
	campaign := seedRecallExclusionCampaign(t)
	seedRecallExclusionUsers(t,
		model.User{Id: 101, Email: "ada@example.com", Username: "ada"},
		model.User{Id: 102, Email: "grace@example.com", Username: "grace"},
	)

	service := NewRecallExclusionService()
	preview, err := service.Preview(context.Background(), campaign.Id, 7, strings.NewReader("user_id,email\n101,missing@example.com\n999,grace@example.com\n101,ada@example.com\n"))

	require.NoError(t, err)
	require.Equal(t, int64(3), preview.TotalRows)
	require.Equal(t, int64(1), preview.ResolvedUsers)
	require.Equal(t, int64(2), preview.UnresolvedRows)
	require.Empty(t, preview.BlockingErrors)
	require.Len(t, preview.Warnings, 2)
	require.True(t, preview.Confirmable)

	stored, err := model.GetRecallExclusionBatchWithContext(context.Background(), campaign.Id, preview.BatchID)
	require.NoError(t, err)
	userIDs, err := model.DecodeRecallExclusionUserIDs(stored.ResolvedUserIDsSnapshot)
	require.NoError(t, err)
	require.Equal(t, []int{101}, userIDs)
}

func TestRecallExclusionPreviewRequiresExistingCampaignBeforePersistingBatch(t *testing.T) {
	db := setupRecallExclusionServiceTestDB(t)
	seedRecallExclusionUsers(t, model.User{Id: 101, Email: "ada@example.com", Username: "ada"})

	service := NewRecallExclusionService()
	_, err := service.Preview(context.Background(), 999, 7, strings.NewReader("user_id\n101\n"))

	require.Error(t, err)
	var batches int64
	require.NoError(t, db.Model(&model.RecallExclusionBatch{}).Count(&batches).Error)
	require.Zero(t, batches)
}

func TestRecallExclusionPreviewAndGetBatchUseCurrentCampaignEligibility(t *testing.T) {
	db := setupRecallExclusionServiceTestDB(t)
	campaign := seedRecallExclusionCampaign(t)
	seedRecallExclusionUsers(t, model.User{Id: 101, Email: "ada@example.com", Username: "ada"})

	service := NewRecallExclusionService()
	preview, err := service.Preview(context.Background(), campaign.Id, 7, strings.NewReader("user_id\n101\n"))
	require.NoError(t, err)
	require.True(t, preview.Confirmable)

	require.NoError(t, db.Model(&model.RecallCampaign{}).Where("id = ?", campaign.Id).Update("status", model.RecallCampaignCompleted).Error)
	fetched, err := service.GetBatch(context.Background(), campaign.Id, preview.BatchID)

	require.NoError(t, err)
	require.False(t, fetched.Confirmable)
}

func TestRecallExclusionGetBatchRestoresOriginalPreviewProblems(t *testing.T) {
	_ = setupRecallExclusionServiceTestDB(t)
	campaign := seedRecallExclusionCampaign(t)
	seedRecallExclusionUsers(t, model.User{Id: 101, Email: "ada@example.com", Username: "ada"})

	service := NewRecallExclusionService()
	preview, err := service.Preview(context.Background(), campaign.Id, 7, strings.NewReader("user_id,email\n101,ada@example.com\n101,\n,not-an-email\n999,\n"))
	require.NoError(t, err)
	require.False(t, preview.Confirmable)
	require.Equal(t, []RecallExclusionProblem{
		recallExclusionProblem(4, "malformed_email", "email must be valid"),
	}, preview.BlockingErrors)
	require.Equal(t, []RecallExclusionProblem{
		recallExclusionProblem(3, "duplicate_identity", "duplicate identity collapsed"),
		recallExclusionProblem(5, "unknown_user", "identity did not resolve to an existing user"),
	}, preview.Warnings)

	fetched, err := service.GetBatch(context.Background(), campaign.Id, preview.BatchID)
	require.NoError(t, err)
	require.Equal(t, preview.BlockingErrors, fetched.BlockingErrors)
	require.Equal(t, preview.Warnings, fetched.Warnings)
	require.False(t, fetched.Confirmable)
}

func TestRecallExclusionPreviewCapsProblemSamplesWithoutLosingCounts(t *testing.T) {
	t.Run("malformed blocking samples", func(t *testing.T) {
		_ = setupRecallExclusionServiceTestDB(t)
		campaign := seedRecallExclusionCampaign(t)
		service := NewRecallExclusionService()

		preview, err := service.Preview(context.Background(), campaign.Id, 7, strings.NewReader(recallExclusionRepeatedRowsCSV("email", "not-an-email", recallExclusionMaxDataRows)))

		require.NoError(t, err)
		require.Equal(t, int64(recallExclusionMaxDataRows), preview.TotalRows)
		require.False(t, preview.Confirmable)
		require.Len(t, preview.BlockingErrors, recallExclusionProblemSampleLimit)
		require.Empty(t, preview.Warnings)
		stored, err := model.GetRecallExclusionBatchWithContext(context.Background(), campaign.Id, preview.BatchID)
		require.NoError(t, err)
		require.Equal(t, model.RecallExclusionBatchPreviewBlocked, stored.Status)
	})

	t.Run("duplicate warning samples", func(t *testing.T) {
		_ = setupRecallExclusionServiceTestDB(t)
		campaign := seedRecallExclusionCampaign(t)
		seedRecallExclusionUsers(t, model.User{Id: 101, Email: "ada@example.com", Username: "ada"})
		service := NewRecallExclusionService()

		preview, err := service.Preview(context.Background(), campaign.Id, 7, strings.NewReader(recallExclusionRepeatedRowsCSV("user_id", "101", recallExclusionMaxDataRows)))

		require.NoError(t, err)
		require.True(t, preview.Confirmable)
		require.Equal(t, int64(recallExclusionMaxDataRows), preview.TotalRows)
		require.Equal(t, int64(1), preview.ResolvedUsers)
		require.Equal(t, int64(recallExclusionMaxDataRows-1), preview.DuplicateRows)
		require.Len(t, preview.Warnings, recallExclusionProblemSampleLimit)
	})

	t.Run("unresolved warning samples", func(t *testing.T) {
		_ = setupRecallExclusionServiceTestDB(t)
		campaign := seedRecallExclusionCampaign(t)
		service := NewRecallExclusionService()

		preview, err := service.Preview(context.Background(), campaign.Id, 7, strings.NewReader(recallExclusionRepeatedRowsCSV("user_id,email", ",", recallExclusionMaxDataRows)))

		require.NoError(t, err)
		require.False(t, preview.Confirmable)
		require.Equal(t, int64(recallExclusionMaxDataRows), preview.TotalRows)
		require.Equal(t, int64(recallExclusionMaxDataRows), preview.UnresolvedRows)
		require.Len(t, preview.Warnings, recallExclusionProblemSampleLimit)
	})
}

func TestRecallExclusionPersistedPreviewWithBlockingErrorsCannotBeConfirmed(t *testing.T) {
	_ = setupRecallExclusionServiceTestDB(t)
	campaign := seedRecallExclusionCampaign(t)
	seedRecallExclusionUsers(t, model.User{Id: 101, Email: "ada@example.com", Username: "ada"})

	service := NewRecallExclusionService()
	preview, err := service.Preview(context.Background(), campaign.Id, 7, strings.NewReader("email\nada@example.com\nnot-an-email\n"))
	require.NoError(t, err)
	require.Equal(t, int64(1), preview.ResolvedUsers)
	require.NotEmpty(t, preview.BlockingErrors)
	require.False(t, preview.Confirmable)

	stored, err := model.GetRecallExclusionBatchWithContext(context.Background(), campaign.Id, preview.BatchID)
	require.NoError(t, err)
	require.Equal(t, model.RecallExclusionBatchPreviewBlocked, stored.Status)
	userIDs, err := model.DecodeRecallExclusionUserIDs(stored.ResolvedUserIDsSnapshot)
	require.NoError(t, err)
	require.Equal(t, []int{101}, userIDs)

	fetched, err := service.GetBatch(context.Background(), campaign.Id, preview.BatchID)
	require.NoError(t, err)
	require.False(t, fetched.Confirmable)
	require.Equal(t, []string{"malformed_email"}, recallExclusionProblemCodes(fetched.BlockingErrors))

	_, err = service.Confirm(context.Background(), campaign.Id, preview.BatchID, 7)
	require.ErrorContains(t, err, "not confirmable")
}

func TestRecallExclusionGetBatchFallsBackForLegacyBlockedPreviewWithoutProblemSnapshot(t *testing.T) {
	db := setupRecallExclusionServiceTestDB(t)
	campaign := seedRecallExclusionCampaign(t)
	seedRecallExclusionUsers(t, model.User{Id: 101, Email: "ada@example.com", Username: "ada"})

	service := NewRecallExclusionService()
	preview, err := service.Preview(context.Background(), campaign.Id, 7, strings.NewReader("email\nada@example.com\nnot-an-email\n"))
	require.NoError(t, err)
	require.NotEmpty(t, preview.BlockingErrors)
	require.NoError(t, db.Model(&model.RecallExclusionBatch{}).
		Where("id = ?", preview.BatchID).
		Updates(map[string]any{
			"blocking_errors_snapshot": "",
			"warnings_snapshot":        "",
		}).Error)

	fetched, err := service.GetBatch(context.Background(), campaign.Id, preview.BatchID)

	require.NoError(t, err)
	require.Equal(t, []string{"stored_blocking_errors"}, recallExclusionProblemCodes(fetched.BlockingErrors))
	require.Empty(t, fetched.Warnings)
	require.False(t, fetched.Confirmable)
}

func TestRecallExclusionPreviewEnforcesSizeAndRowBoundaries(t *testing.T) {
	_ = setupRecallExclusionServiceTestDB(t)
	campaign := seedRecallExclusionCampaign(t)
	service := NewRecallExclusionService()

	exactSize := append([]byte("user_id\n"), bytes.Repeat([]byte{' '}, recallExclusionMaxCSVBytes-len("user_id\n"))...)
	exactPreview, err := service.Preview(context.Background(), campaign.Id, 7, bytes.NewReader(exactSize))
	require.NoError(t, err)
	require.LessOrEqual(t, exactPreview.TotalRows, int64(recallExclusionMaxDataRows))

	_, err = service.Preview(context.Background(), campaign.Id, 7, bytes.NewReader(append(exactSize, 'x')))
	require.ErrorContains(t, err, "exceeds maximum")

	exactRows := recallExclusionRowsCSV(recallExclusionMaxDataRows)
	rowPreview, err := service.Preview(context.Background(), campaign.Id, 7, strings.NewReader(exactRows))
	require.NoError(t, err)
	require.Equal(t, int64(recallExclusionMaxDataRows), rowPreview.TotalRows)

	_, err = service.Preview(context.Background(), campaign.Id, 7, strings.NewReader(exactRows+"999999\n"))
	require.ErrorContains(t, err, "supports at most")
}

func TestRecallExclusionConfirmPersistsExclusionsCancelsSafeMessagesAndIsIdempotent(t *testing.T) {
	db := setupRecallExclusionServiceTestDB(t)
	campaign := seedRecallExclusionCampaign(t)
	seedRecallExclusionUsers(t,
		model.User{Id: 101, Email: "ada@example.com", Username: "ada"},
		model.User{Id: 102, Email: "grace@example.com", Username: "grace"},
	)
	recipients := []model.RecallRecipient{
		{CampaignId: campaign.Id, UserId: 101, State: model.RecallRecipientQueued, EmailSnapshot: "ada@example.com", LanguageSnapshot: "en", RecipientIdentity: model.RecallRecipientIdentityForUser(101), FirstSentAt: 11, LastSentAt: 12},
		{CampaignId: campaign.Id, UserId: 102, State: model.RecallRecipientQueued, EmailSnapshot: "grace@example.com", LanguageSnapshot: "en", RecipientIdentity: model.RecallRecipientIdentityForUser(102), FirstSentAt: 21, LastSentAt: 22},
	}
	require.NoError(t, db.Create(&recipients).Error)
	messages := []model.RecallMessage{
		{RecipientId: recipients[0].Id, StageNo: 1, TemplateSnapshot: "scheduled", State: model.RecallMessageScheduled, ScheduledAt: 100},
		{RecipientId: recipients[0].Id, StageNo: 2, TemplateSnapshot: "retry", State: model.RecallMessageRetryWait, NextAttemptAt: 100},
		{RecipientId: recipients[0].Id, StageNo: 3, TemplateSnapshot: "leased", State: model.RecallMessageLeased, LeaseOwner: "worker", LeaseExpiresAt: 50},
		{RecipientId: recipients[1].Id, StageNo: 1, TemplateSnapshot: "sending", State: model.RecallMessageSending, LeaseOwner: "worker", LeaseExpiresAt: 50},
		{RecipientId: recipients[1].Id, StageNo: 2, TemplateSnapshot: "accepted", State: model.RecallMessageAccepted, AcceptedAt: 90},
	}
	require.NoError(t, db.CreateInBatches(&messages, 100).Error)

	service := NewRecallExclusionService()
	service.now = func() time.Time { return time.Unix(1234, 0) }
	preview, err := service.Preview(context.Background(), campaign.Id, 7, strings.NewReader("user_id\n101\n102\n"))
	require.NoError(t, err)
	require.Equal(t, int64(3), preview.CancelableWork)
	refreshed, err := service.GetBatch(context.Background(), campaign.Id, preview.BatchID)
	require.NoError(t, err)
	require.Equal(t, int64(3), refreshed.CancelableWork)

	applied, err := service.Confirm(context.Background(), campaign.Id, preview.BatchID, 7)
	require.NoError(t, err)
	require.Equal(t, int64(3), applied.CancelableWork)
	require.False(t, applied.Confirmable)

	var exclusions []model.RecallCampaignExclusion
	require.NoError(t, db.Order("user_id ASC").Find(&exclusions).Error)
	require.Len(t, exclusions, 2)
	require.Equal(t, "operator_csv", exclusions[0].PersistentReasonCode)
	require.Equal(t, int64(preview.BatchID), exclusions[0].SourceBatchId)
	require.Equal(t, int64(1234), exclusions[0].FirstSeenAt)

	var storedMessages []model.RecallMessage
	require.NoError(t, db.Order("stage_no ASC").Where("recipient_id = ?", recipients[0].Id).Find(&storedMessages).Error)
	require.Equal(t, []string{model.RecallMessageCancelled, model.RecallMessageCancelled, model.RecallMessageCancelled}, []string{storedMessages[0].State, storedMessages[1].State, storedMessages[2].State})
	var untouched []model.RecallMessage
	require.NoError(t, db.Order("stage_no ASC").Where("recipient_id = ?", recipients[1].Id).Find(&untouched).Error)
	require.Equal(t, []string{model.RecallMessageSending, model.RecallMessageAccepted}, []string{untouched[0].State, untouched[1].State})

	again, err := service.Confirm(context.Background(), campaign.Id, preview.BatchID, 7)
	require.NoError(t, err)
	require.Equal(t, applied.CancelableWork, again.CancelableWork)
	var eventCount int64
	require.NoError(t, db.Model(&model.RecallEvent{}).Where("campaign_id = ? AND event_type = ?", campaign.Id, "exclusions_applied").Count(&eventCount).Error)
	require.Equal(t, int64(1), eventCount)
}

func TestRecallExclusionConfirmEmitsSanitizedOperationalCountLog(t *testing.T) {
	db := setupRecallExclusionServiceTestDB(t)
	campaign := seedRecallExclusionCampaign(t)
	seedRecallExclusionUsers(t,
		model.User{Id: 101, Email: "ada@example.com", Username: "ada"},
		model.User{Id: 102, Email: "grace@example.com", Username: "grace"},
	)
	recipients := []model.RecallRecipient{
		{CampaignId: campaign.Id, UserId: 101, State: model.RecallRecipientQueued, EmailSnapshot: "ada@example.com", LanguageSnapshot: "en", RecipientIdentity: model.RecallRecipientIdentityForUser(101)},
		{CampaignId: campaign.Id, UserId: 102, State: model.RecallRecipientQueued, EmailSnapshot: "grace@example.com", LanguageSnapshot: "en", RecipientIdentity: model.RecallRecipientIdentityForUser(102)},
	}
	require.NoError(t, db.Create(&recipients).Error)
	messages := []model.RecallMessage{
		{RecipientId: recipients[0].Id, StageNo: 1, TemplateSnapshot: "scheduled", State: model.RecallMessageScheduled},
		{RecipientId: recipients[0].Id, StageNo: 2, TemplateSnapshot: "leased", State: model.RecallMessageLeased},
		{RecipientId: recipients[1].Id, StageNo: 1, TemplateSnapshot: "accepted", State: model.RecallMessageAccepted},
	}
	require.NoError(t, db.Create(&messages).Error)
	service := NewRecallExclusionService()
	preview, err := service.Preview(context.Background(), campaign.Id, 7, strings.NewReader("user_id,email\n101,ada@example.com\n102,grace@example.com\n"))
	require.NoError(t, err)
	logs := captureRecallExclusionSysLogs(t)

	applied, err := service.Confirm(context.Background(), campaign.Id, preview.BatchID, 7)

	require.NoError(t, err)
	require.Equal(t, int64(2), applied.CancelableWork)
	output := logs.String()
	require.Contains(t, output, "recall exclusion batch applied")
	require.Contains(t, output, fmt.Sprintf("campaign_id=%d", campaign.Id))
	require.Contains(t, output, fmt.Sprintf("batch_id=%d", preview.BatchID))
	require.Contains(t, output, "resolved_users=2")
	require.Contains(t, output, "applied_users=2")
	require.Contains(t, output, "cancelled_messages=2")
	require.NotContains(t, output, "ada@example.com")
	require.NotContains(t, output, "grace@example.com")
	require.NotContains(t, output, "user_id")
	require.NotContains(t, output, "email")
}

func TestRecallExclusionCancelableWorkCountsSafeMessagesAcrossChunks(t *testing.T) {
	db := setupRecallExclusionServiceTestDB(t)
	campaign := seedRecallExclusionCampaign(t)
	users := make([]model.User, 0, 250)
	for i := 0; i < 250; i++ {
		userID := 10_000 + i
		users = append(users, model.User{Id: userID, Email: fmt.Sprintf("chunk-%03d@example.com", i), Username: fmt.Sprintf("chunk-%03d", i)})
	}
	seedRecallExclusionUsers(t, users...)
	recipients := make([]model.RecallRecipient, 0, len(users))
	for _, user := range users {
		recipients = append(recipients, model.RecallRecipient{CampaignId: campaign.Id, UserId: user.Id, State: model.RecallRecipientQueued, EmailSnapshot: user.Email, LanguageSnapshot: "en", RecipientIdentity: model.RecallRecipientIdentityForUser(user.Id)})
	}
	require.NoError(t, db.Create(&recipients).Error)
	states := []string{
		model.RecallMessageScheduled,
		model.RecallMessageRetryWait,
		model.RecallMessageLeased,
		model.RecallMessageSending,
		model.RecallMessageAccepted,
		model.RecallMessageFailed,
		model.RecallMessageCancelled,
	}
	messages := make([]model.RecallMessage, 0, len(recipients)*len(states))
	for _, recipient := range recipients {
		for index, state := range states {
			messages = append(messages, model.RecallMessage{RecipientId: recipient.Id, StageNo: index + 1, TemplateSnapshot: state, State: state})
		}
	}
	require.NoError(t, db.CreateInBatches(&messages, 100).Error)

	service := NewRecallExclusionService()
	preview, err := service.Preview(context.Background(), campaign.Id, 7, strings.NewReader(recallExclusionRowsCSVFromUsers(users)))
	require.NoError(t, err)
	require.Equal(t, int64(250*3), preview.CancelableWork)

	refreshed, err := service.GetBatch(context.Background(), campaign.Id, preview.BatchID)
	require.NoError(t, err)
	require.Equal(t, preview.CancelableWork, refreshed.CancelableWork)
}

func TestRecallExclusionConfirmRejectsNonOperationalCampaignsWithoutSideEffects(t *testing.T) {
	for _, status := range []string{model.RecallCampaignDraft, model.RecallCampaignCancelled, model.RecallCampaignCompleted} {
		t.Run(status, func(t *testing.T) {
			db := setupRecallExclusionServiceTestDB(t)
			campaign := seedRecallExclusionCampaign(t)
			require.NoError(t, db.Model(&model.RecallCampaign{}).Where("id = ?", campaign.Id).Update("status", status).Error)
			seedRecallExclusionUsers(t, model.User{Id: 101, Email: "ada@example.com", Username: "ada"})
			recipient := model.RecallRecipient{CampaignId: campaign.Id, UserId: 101, State: model.RecallRecipientQueued, EmailSnapshot: "ada@example.com", LanguageSnapshot: "en", RecipientIdentity: model.RecallRecipientIdentityForUser(101)}
			require.NoError(t, db.Create(&recipient).Error)
			message := model.RecallMessage{RecipientId: recipient.Id, StageNo: 1, TemplateSnapshot: "scheduled", State: model.RecallMessageScheduled}
			require.NoError(t, db.Create(&message).Error)

			service := NewRecallExclusionService()
			preview, err := service.Preview(context.Background(), campaign.Id, 7, strings.NewReader("user_id\n101\n"))
			require.NoError(t, err)
			require.False(t, preview.Confirmable)
			_, err = service.Confirm(context.Background(), campaign.Id, preview.BatchID, 7)

			require.ErrorContains(t, err, "campaign status")
			var exclusionCount int64
			require.NoError(t, db.Model(&model.RecallCampaignExclusion{}).Count(&exclusionCount).Error)
			require.Zero(t, exclusionCount)
			var storedMessage model.RecallMessage
			require.NoError(t, db.First(&storedMessage, message.Id).Error)
			require.Equal(t, model.RecallMessageScheduled, storedMessage.State)
			var batch model.RecallExclusionBatch
			require.NoError(t, db.First(&batch, preview.BatchID).Error)
			require.Equal(t, model.RecallExclusionBatchPreviewed, batch.Status)
		})
	}
}

func TestRecallExclusionConfirmAllowsAlreadyAppliedBatchRegardlessOfCampaignStatus(t *testing.T) {
	db := setupRecallExclusionServiceTestDB(t)
	campaign := seedRecallExclusionCampaign(t)
	seedRecallExclusionUsers(t, model.User{Id: 101, Email: "ada@example.com", Username: "ada"})
	service := NewRecallExclusionService()
	preview, err := service.Preview(context.Background(), campaign.Id, 7, strings.NewReader("user_id\n101\n"))
	require.NoError(t, err)
	_, err = service.Confirm(context.Background(), campaign.Id, preview.BatchID, 7)
	require.NoError(t, err)
	require.NoError(t, db.Model(&model.RecallCampaign{}).Where("id = ?", campaign.Id).Update("status", model.RecallCampaignCompleted).Error)

	again, err := service.Confirm(context.Background(), campaign.Id, preview.BatchID, 7)

	require.NoError(t, err)
	require.False(t, again.Confirmable)
}

func TestRecallExclusionConfirmDuplicateAdminEventRollsBackSideEffects(t *testing.T) {
	db := setupRecallExclusionServiceTestDB(t)
	campaign := seedRecallExclusionCampaign(t)
	seedRecallExclusionUsers(t, model.User{Id: 101, Email: "ada@example.com", Username: "ada"})
	recipient := model.RecallRecipient{CampaignId: campaign.Id, UserId: 101, State: model.RecallRecipientQueued, EmailSnapshot: "ada@example.com", LanguageSnapshot: "en", RecipientIdentity: model.RecallRecipientIdentityForUser(101)}
	require.NoError(t, db.Create(&recipient).Error)
	message := model.RecallMessage{RecipientId: recipient.Id, StageNo: 1, TemplateSnapshot: "scheduled", State: model.RecallMessageScheduled}
	require.NoError(t, db.Create(&message).Error)
	service := NewRecallExclusionService()
	preview, err := service.Preview(context.Background(), campaign.Id, 7, strings.NewReader("user_id\n101\n"))
	require.NoError(t, err)
	require.NoError(t, db.Create(&model.RecallEvent{CampaignId: campaign.Id, EventType: "existing_admin", Source: "admin", SourceEventId: fmt.Sprintf("admin:exclusions:%d", preview.BatchID), EventData: `{}`, CreatedAt: 1}).Error)

	_, err = service.Confirm(context.Background(), campaign.Id, preview.BatchID, 7)

	require.ErrorContains(t, err, "admin audit")
	var exclusionCount int64
	require.NoError(t, db.Model(&model.RecallCampaignExclusion{}).Count(&exclusionCount).Error)
	require.Zero(t, exclusionCount)
	var storedMessage model.RecallMessage
	require.NoError(t, db.First(&storedMessage, message.Id).Error)
	require.Equal(t, model.RecallMessageScheduled, storedMessage.State)
	var batch model.RecallExclusionBatch
	require.NoError(t, db.First(&batch, preview.BatchID).Error)
	require.Equal(t, model.RecallExclusionBatchPreviewed, batch.Status)
}

func setupRecallExclusionServiceTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db := setupRecallCampaignTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.RecallExclusionBatch{}))
	return db
}

func captureRecallExclusionSysLogs(t *testing.T) *bytes.Buffer {
	t.Helper()
	var logs bytes.Buffer
	common.LogWriterMu.Lock()
	previous := gin.DefaultWriter
	gin.DefaultWriter = &logs
	common.LogWriterMu.Unlock()
	t.Cleanup(func() {
		common.LogWriterMu.Lock()
		gin.DefaultWriter = previous
		common.LogWriterMu.Unlock()
	})
	return &logs
}

func seedRecallExclusionCampaign(t *testing.T) model.RecallCampaign {
	t.Helper()
	campaign := model.RecallCampaign{
		Name:                "exclusion preview",
		Status:              model.RecallCampaignRunning,
		AudienceTemplate:    "specified_users",
		AudienceConfig:      `{}`,
		ExecutionMode:       "manual",
		DiscountConfig:      `{}`,
		ProductScope:        `{}`,
		EmailSequenceConfig: `[]`,
		CreatedBy:           7,
	}
	require.NoError(t, model.DB.Create(&campaign).Error)
	return campaign
}

func seedRecallExclusionUsers(t *testing.T, users ...model.User) {
	t.Helper()
	for i := range users {
		if users[i].Status == 0 {
			users[i].Status = 1
		}
		if users[i].Group == "" {
			users[i].Group = "plg"
		}
		if users[i].AffCode == "" {
			users[i].AffCode = fmt.Sprintf("aff-%d", users[i].Id)
		}
		require.NoError(t, model.DB.Create(&users[i]).Error)
	}
}

func recallExclusionProblemCodes(problems []RecallExclusionProblem) []string {
	codes := make([]string, len(problems))
	for i := range problems {
		codes[i] = problems[i].Code
	}
	return codes
}

func recallExclusionRowsCSV(rows int) string {
	var builder strings.Builder
	builder.WriteString("user_id\n")
	for i := 0; i < rows; i++ {
		builder.WriteString(fmt.Sprintf("%d\n", 900000+i))
	}
	return builder.String()
}

func recallExclusionRepeatedRowsCSV(header string, row string, rows int) string {
	var builder strings.Builder
	builder.WriteString(header)
	builder.WriteByte('\n')
	for i := 0; i < rows; i++ {
		builder.WriteString(row)
		builder.WriteByte('\n')
	}
	return builder.String()
}

func recallExclusionRowsCSVFromUsers(users []model.User) string {
	var builder strings.Builder
	builder.WriteString("user_id\n")
	for _, user := range users {
		builder.WriteString(fmt.Sprintf("%d\n", user.Id))
	}
	return builder.String()
}
