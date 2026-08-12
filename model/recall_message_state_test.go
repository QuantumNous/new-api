package model

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type recallMessageStateEventData struct {
	MessageID   int64  `json:"message_id"`
	RecipientID int64  `json:"recipient_id"`
	StageNo     int    `json:"stage_no"`
	FromState   string `json:"from_state"`
	ToState     string `json:"to_state"`
	OccurredAt  int64  `json:"occurred_at"`
}

func TestRecallMessageTransitionWritesVersionedEventAtomically(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	message := seedRecallMessage(t, RecallMessageLeased, 3)
	message.LeaseOwner = "node-a"
	message.LeaseExpiresAt = 1_721_000_060
	require.NoError(t, DB.Save(&message).Error)

	won, err := TransitionRecallMessageWithEvent(context.Background(), RecallMessageTransition{
		MessageID:          message.Id,
		From:               RecallMessageLeased,
		To:                 RecallMessageSending,
		Owner:              "node-a",
		ExpectedLeaseUntil: message.LeaseExpiresAt,
	})
	require.NoError(t, err)
	require.True(t, won)
	requireRecallMessageStateEvent(t, message.Id, 4, RecallMessageLeased, RecallMessageSending)
}

func TestRecallMessageTransitionRecordsRetryChainAndManualRequeue(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	message := seedRecallMessage(t, RecallMessageScheduled, 0)
	won, err := LeaseRecallMessage(message.Id, "node-a", 1_721_000_000, 1_721_000_060)
	require.NoError(t, err)
	require.True(t, won)
	requireRecallMessageStateEvent(t, message.Id, 1, "", RecallMessageScheduled)
	requireRecallMessageStateEvent(t, message.Id, 2, RecallMessageScheduled, RecallMessageLeased)

	won, err = MarkRecallMessageSendingWithContext(context.Background(), message.Id, "node-a", 1_721_000_060)
	require.NoError(t, err)
	require.True(t, won)
	requireRecallMessageStateEvent(t, message.Id, 3, RecallMessageLeased, RecallMessageSending)

	won, err = CompleteRecallMessageLease(message.Id, "node-a", 1_721_000_060, RecallMessageSending, RecallMessageRetryWait, map[string]any{
		"attempt_count":   1,
		"next_attempt_at": int64(1_721_000_120),
	})
	require.NoError(t, err)
	require.True(t, won)
	requireRecallMessageStateEvent(t, message.Id, 4, RecallMessageSending, RecallMessageRetryWait)

	won, err = LeaseRecallMessage(message.Id, "node-a", 1_721_000_120, 1_721_000_180)
	require.NoError(t, err)
	require.True(t, won)
	requireRecallMessageStateEvent(t, message.Id, 5, RecallMessageRetryWait, RecallMessageLeased)

	won, err = MarkRecallMessageSendingWithContext(context.Background(), message.Id, "node-a", 1_721_000_180)
	require.NoError(t, err)
	require.True(t, won)
	requireRecallMessageStateEvent(t, message.Id, 6, RecallMessageLeased, RecallMessageSending)

	won, err = CompleteRecallMessageLease(message.Id, "node-a", 1_721_000_180, RecallMessageSending, RecallMessageAccepted, map[string]any{
		"accepted_at":   int64(1_721_000_190),
		"attempt_count": 2,
	})
	require.NoError(t, err)
	require.True(t, won)
	requireRecallMessageStateEvent(t, message.Id, 7, RecallMessageSending, RecallMessageAccepted)

	failed := seedRecallMessage(t, RecallMessageFailed, 0)
	won, err = ManualRetryRecallMessageWithContext(context.Background(), failed.Id, false, 1_721_000_200)
	require.NoError(t, err)
	require.True(t, won)
	requireRecallMessageStateEvent(t, failed.Id, 1, "", RecallMessageFailed)
	requireRecallMessageStateEvent(t, failed.Id, 2, RecallMessageFailed, RecallMessageRetryWait)
}

func TestRecallManualRetryRecipientCandidatePrioritizesMessagesInsideTransaction(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	campaign := seedRecallCampaignForMessageState(t)
	recipient := RecallRecipient{
		CampaignId:          campaign.Id,
		UserId:              3001,
		EligibilitySnapshot: `{}`,
		EmailSnapshot:       "manual-retry-target@example.com",
		LanguageSnapshot:    "en",
		State:               RecallRecipientFailed,
		UpdatedAt:           1_721_000_100,
	}
	require.NoError(t, DB.Create(&recipient).Error)
	failed := RecallMessage{RecipientId: recipient.Id, StageNo: 1, TemplateSnapshot: `{}`, State: RecallMessageFailed, UpdatedAt: 1_721_000_110}
	uncertain := RecallMessage{RecipientId: recipient.Id, StageNo: 2, TemplateSnapshot: `{}`, State: RecallMessageUncertain, UpdatedAt: 1_721_000_120}
	require.NoError(t, DB.Create(&failed).Error)
	require.NoError(t, DB.Create(&uncertain).Error)

	_, won, err := ManualRetryRecallRecipientCandidateAndAdminEventWithContext(context.Background(), campaign.Id, recipient.Id, false, 1_721_000_200, recallManualRetryTestAdminEvent)
	require.ErrorContains(t, err, "acknowledge_uncertain=true")
	require.False(t, won)
	require.NoError(t, DB.First(&failed, failed.Id).Error)
	require.Equal(t, RecallMessageFailed, failed.State)
	require.NoError(t, DB.First(&uncertain, uncertain.Id).Error)
	require.Equal(t, RecallMessageUncertain, uncertain.State)
	require.NoError(t, DB.First(&recipient, recipient.Id).Error)
	require.Equal(t, RecallRecipientFailed, recipient.State)

	selection, won, err := ManualRetryRecallRecipientCandidateAndAdminEventWithContext(context.Background(), campaign.Id, recipient.Id, true, 1_721_000_210, recallManualRetryTestAdminEvent)
	require.NoError(t, err)
	require.True(t, won)
	require.Equal(t, RecallManualRetryTargetMessage, selection.Target)
	require.Equal(t, uncertain.Id, selection.Message.Id)
	require.NoError(t, DB.First(&uncertain, uncertain.Id).Error)
	require.Equal(t, RecallMessageRetryWait, uncertain.State)
	require.NoError(t, DB.First(&failed, failed.Id).Error)
	require.Equal(t, RecallMessageFailed, failed.State)
	require.NoError(t, DB.First(&recipient, recipient.Id).Error)
	require.Equal(t, RecallRecipientFailed, recipient.State)
}

func TestRecallManualRetryRecipientCandidateFallbacks(t *testing.T) {
	for _, test := range []struct {
		name          string
		recipient     RecallRecipient
		wantNextState string
	}{
		{name: "queued", wantNextState: RecallRecipientQueued},
		{name: "customer ready", recipient: RecallRecipient{StripeCustomerId: "cus_model_retry"}, wantNextState: RecallRecipientCustomerReady},
		{name: "code ready", recipient: RecallRecipient{StripeCustomerId: "cus_model_retry", PromotionCode: "FKMODEL"}, wantNextState: RecallRecipientCodeReady},
	} {
		t.Run(test.name, func(t *testing.T) {
			setupRecallRepositoryTestDB(t)
			campaign := seedRecallCampaignForMessageState(t)
			recipient := test.recipient
			recipient.CampaignId = campaign.Id
			recipient.UserId = 3101
			recipient.EligibilitySnapshot = `{}`
			recipient.EmailSnapshot = "manual-retry-fallback@example.com"
			recipient.LanguageSnapshot = "en"
			recipient.State = RecallRecipientFailed
			recipient.UpdatedAt = 1_721_000_100
			if recipient.PromotionCode != "" {
				promotionID := "promo_model_retry"
				recipient.StripePromotionCodeId = &promotionID
			}
			require.NoError(t, DB.Create(&recipient).Error)

			selection, won, err := ManualRetryRecallRecipientCandidateAndAdminEventWithContext(context.Background(), campaign.Id, recipient.Id, false, 1_721_000_200, recallManualRetryTestAdminEvent)
			require.NoError(t, err)
			require.True(t, won)
			require.Equal(t, RecallManualRetryTargetRecipient, selection.Target)
			require.Equal(t, test.wantNextState, selection.NextRecipientState)
			require.NoError(t, DB.First(&recipient, recipient.Id).Error)
			require.Equal(t, test.wantNextState, recipient.State)
		})
	}
}

func TestRecallManualRetryRecipientCandidateFailedMessagePrecedesFailedRecipient(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	campaign := seedRecallCampaignForMessageState(t)
	recipient := RecallRecipient{
		CampaignId:          campaign.Id,
		UserId:              3201,
		EligibilitySnapshot: `{}`,
		EmailSnapshot:       "manual-retry-failed-message@example.com",
		LanguageSnapshot:    "en",
		State:               RecallRecipientFailed,
		UpdatedAt:           1_721_000_100,
	}
	require.NoError(t, DB.Create(&recipient).Error)
	failed := RecallMessage{RecipientId: recipient.Id, StageNo: 1, TemplateSnapshot: `{}`, State: RecallMessageFailed, UpdatedAt: 1_721_000_110}
	require.NoError(t, DB.Create(&failed).Error)

	selection, won, err := ManualRetryRecallRecipientCandidateAndAdminEventWithContext(context.Background(), campaign.Id, recipient.Id, false, 1_721_000_200, recallManualRetryTestAdminEvent)
	require.NoError(t, err)
	require.True(t, won)
	require.Equal(t, RecallManualRetryTargetMessage, selection.Target)
	require.Equal(t, failed.Id, selection.Message.Id)
	require.NoError(t, DB.First(&failed, failed.Id).Error)
	require.Equal(t, RecallMessageRetryWait, failed.State)
	require.NoError(t, DB.First(&recipient, recipient.Id).Error)
	require.Equal(t, RecallRecipientFailed, recipient.State)
}

func TestRecallManualRetryRecipientCandidateRejectsMismatchedAdminEventTarget(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	campaign := seedRecallCampaignForMessageState(t)
	recipient := RecallRecipient{
		CampaignId:          campaign.Id,
		UserId:              3301,
		EligibilitySnapshot: `{}`,
		EmailSnapshot:       "manual-retry-mismatch@example.com",
		LanguageSnapshot:    "en",
		State:               RecallRecipientFailed,
		UpdatedAt:           1_721_000_100,
	}
	require.NoError(t, DB.Create(&recipient).Error)
	failed := RecallMessage{RecipientId: recipient.Id, StageNo: 1, TemplateSnapshot: `{}`, State: RecallMessageFailed, UpdatedAt: 1_721_000_110}
	require.NoError(t, DB.Create(&failed).Error)

	_, won, err := ManualRetryRecallRecipientCandidateAndAdminEventWithContext(context.Background(), campaign.Id, recipient.Id, false, 1_721_000_200, func(selection RecallManualRetrySelection) (RecallEvent, error) {
		event, err := recallManualRetryTestAdminEvent(selection)
		if err != nil {
			return RecallEvent{}, err
		}
		event.CampaignId = selection.CampaignID + 1
		event.RecipientId = selection.RecipientID + 1
		return event, nil
	})
	require.ErrorContains(t, err, "recall retry admin event target does not match")
	require.False(t, won)
	require.NoError(t, DB.First(&failed, failed.Id).Error)
	require.Equal(t, RecallMessageFailed, failed.State)

	var events int64
	require.NoError(t, DB.Model(&RecallEvent{}).Where("event_type = ? AND source = ?", "recipient_retry", "admin").Count(&events).Error)
	require.Zero(t, events)
}

func TestRecallCompleteSendingFailureLocksRecipientBeforeMessageTransition(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	message := seedRecallMessage(t, RecallMessageSending, 1)
	message.LeaseOwner = "node-a"
	message.LeaseExpiresAt = 1_721_000_300
	require.NoError(t, DB.Save(&message).Error)

	recipientLocked := false
	sawMessageTransitionLock := false
	callbackName := fmt.Sprintf("test:recall-complete-lock-order:%s", t.Name())
	require.NoError(t, DB.Callback().Query().Before("gorm:query").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement == nil || tx.Statement.Schema == nil {
			return
		}
		if _, ok := tx.Statement.Clauses["FOR"]; !ok {
			return
		}
		switch tx.Statement.Schema.Name {
		case "RecallRecipient":
			recipientLocked = true
		case "RecallMessage":
			sawMessageTransitionLock = true
			if !recipientLocked {
				tx.AddError(errors.New("recall sending failure completed before recipient lock"))
			}
		}
	}))
	t.Cleanup(func() {
		require.NoError(t, DB.Callback().Query().Remove(callbackName))
		require.True(t, recipientLocked, "expected CompleteRecallMessageLease to lock recipient before candidate completion")
		require.True(t, sawMessageTransitionLock, "expected CompleteRecallMessageLease to lock message for transition")
	})

	won, err := CompleteRecallMessageLease(message.Id, "node-a", message.LeaseExpiresAt, RecallMessageSending, RecallMessageUncertain, map[string]any{
		"attempt_count":   1,
		"last_error_code": "smtp_uncertain",
	})
	require.NoError(t, err)
	require.True(t, won)
}

func TestRecallMessageLegacyTransitionWritesInlineBaselineBeforeTransition(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	message := seedRecallMessage(t, RecallMessageScheduled, 0)
	won, err := LeaseRecallMessage(message.Id, "node-a", 1_721_000_000, 1_721_000_060)
	require.NoError(t, err)
	require.True(t, won)

	requireRecallMessageStateEvent(t, message.Id, 1, "", RecallMessageScheduled)
	requireRecallMessageStateEvent(t, message.Id, 2, RecallMessageScheduled, RecallMessageLeased)

	var stored RecallMessage
	require.NoError(t, DB.First(&stored, message.Id).Error)
	require.Equal(t, RecallMessageLeased, stored.State)
	require.Equal(t, int64(2), stored.StateVersion)
	requireRecallMessageStateEventCount(t, 2)
}

func TestRecallMessageStateEventTxHelpersRejectNilTransaction(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	message := seedRecallMessage(t, RecallMessageScheduled, 1)
	created := RecallMessage{
		RecipientId:      message.RecipientId,
		StageNo:          2,
		TemplateSnapshot: `{}`,
		State:            RecallMessageScheduled,
	}
	err := CreateRecallMessagesWithStateEventsTx(nil, 0, []RecallMessage{created}, 1_721_000_000)
	require.Error(t, err)
	require.Contains(t, err.Error(), "transaction")

	count, err := TransitionRecallMessagesWithEventsTx(nil, []RecallMessageTransition{{
		MessageID: message.Id,
		From:      RecallMessageScheduled,
		To:        RecallMessageLeased,
	}})
	require.Error(t, err)
	require.Contains(t, err.Error(), "transaction")
	require.Zero(t, count)

	var stored []RecallMessage
	require.NoError(t, DB.Where("recipient_id = ?", message.RecipientId).Order("stage_no ASC").Find(&stored).Error)
	require.Len(t, stored, 1)
	require.Equal(t, RecallMessageScheduled, stored[0].State)
	require.Equal(t, int64(1), stored[0].StateVersion)
	requireRecallMessageStateEventCount(t, 0)
}

func TestRecallMessageStateEventInsertFailureRollsBackTransitionAndCreate(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	failRecallMessageStateEventInserts(t)
	message := seedRecallMessage(t, RecallMessageScheduled, 1)
	won, err := TransitionRecallMessageWithEvent(context.Background(), RecallMessageTransition{
		MessageID: message.Id,
		From:      RecallMessageScheduled,
		To:        RecallMessageLeased,
	})
	require.Error(t, err)
	require.False(t, won)

	var stored RecallMessage
	require.NoError(t, DB.First(&stored, message.Id).Error)
	require.Equal(t, RecallMessageScheduled, stored.State)
	require.Equal(t, int64(1), stored.StateVersion)
	requireRecallMessageStateEventCount(t, 0)

	err = DB.Transaction(func(tx *gorm.DB) error {
		return CreateRecallMessagesWithStateEventsTx(tx, 0, []RecallMessage{{
			RecipientId:      message.RecipientId,
			StageNo:          2,
			TemplateSnapshot: `{}`,
			State:            RecallMessageScheduled,
		}}, 1_721_000_100)
	})
	require.Error(t, err)
	var count int64
	require.NoError(t, DB.Model(&RecallMessage{}).Where("recipient_id = ?", message.RecipientId).Count(&count).Error)
	require.EqualValues(t, 1, count)
	requireRecallMessageStateEventCount(t, 0)
}

func TestCancelPendingRecallMessagesReturnsZeroWhenTransactionRollsBack(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	message := seedRecallMessage(t, RecallMessageScheduled, 1)
	failRecallMessageStateEventInserts(t)
	cancelled, err := CancelPendingRecallMessages(message.RecipientId, "recipient_converted", 1_721_000_300)
	require.Error(t, err)
	require.Zero(t, cancelled)

	var stored RecallMessage
	require.NoError(t, DB.First(&stored, message.Id).Error)
	require.Equal(t, RecallMessageScheduled, stored.State)
	require.Equal(t, int64(1), stored.StateVersion)
	requireRecallMessageStateEventCount(t, 0)
}

func TestRecallMessageCreationAndCancellationProcessMultipleBatches(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	campaign := seedRecallCampaignForMessageState(t)
	recipient := RecallRecipient{
		CampaignId:          campaign.Id,
		UserId:              2001,
		EligibilitySnapshot: `{}`,
		EmailSnapshot:       "multi-batch@example.com",
		LanguageSnapshot:    "en",
		State:               RecallRecipientContacting,
	}
	require.NoError(t, DB.Create(&recipient).Error)

	total := recallRunBatchSize + 5
	messages := make([]RecallMessage, 0, total)
	for i := 0; i < total; i++ {
		messages = append(messages, RecallMessage{
			RecipientId:      recipient.Id,
			StageNo:          i + 1,
			TemplateSnapshot: `{}`,
			State:            RecallMessageScheduled,
		})
	}
	require.NoError(t, ScheduleNextRecallStages(recipient.Id, messages))
	requireRecallMessageStateEventCount(t, int64(total))

	cancelled, err := CancelPendingRecallMessages(recipient.Id, "recipient_converted", 1_721_000_300)
	require.NoError(t, err)
	require.EqualValues(t, total, cancelled)

	var cancelledRows int64
	require.NoError(t, DB.Model(&RecallMessage{}).Where("recipient_id = ? AND state = ?", recipient.Id, RecallMessageCancelled).Count(&cancelledRows).Error)
	require.EqualValues(t, total, cancelledRows)
	requireRecallMessageStateEventCount(t, int64(total*2))
}

func TestRecallMessageCreationWritesInitialStateEventOnce(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	campaign := seedRecallCampaignForMessageState(t)
	recipients := []RecallRecipient{
		{UserId: 101, EligibilitySnapshot: `{}`, EmailSnapshot: "alpha@example.com", LanguageSnapshot: "en", State: RecallRecipientQueued},
		{UserId: 102, EligibilitySnapshot: `{}`, EmailSnapshot: "beta@example.com", LanguageSnapshot: "en", State: RecallRecipientQueued},
	}
	messages := []RecallMessage{
		{StageNo: 1, TemplateSnapshot: `{}`, State: RecallMessageScheduled},
		{StageNo: 1, TemplateSnapshot: `{}`, State: RecallMessageScheduled},
	}
	event := RecallEvent{EventType: "campaign_run", Source: "scheduler", SourceEventId: "message-state-run", EventData: `{}`}

	inserted, err := InsertRecallRecipientsAndRunEvent(campaign.Id, recipients, messages, event)
	require.NoError(t, err)
	require.Equal(t, 2, inserted)
	inserted, err = InsertRecallRecipientsAndRunEvent(campaign.Id, recipients, messages, event)
	require.NoError(t, err)
	require.Zero(t, inserted)

	var stored []RecallMessage
	require.NoError(t, DB.Order("id ASC").Find(&stored).Error)
	require.Len(t, stored, 2)
	for _, message := range stored {
		require.Equal(t, int64(1), message.StateVersion)
		requireRecallMessageStateEvent(t, message.Id, 1, "", RecallMessageScheduled)
	}
	requireRecallMessageStateEventCount(t, 2)
}

func TestRecallMessageStageCreationAndCancellationWriteStateEvents(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	message := seedRecallMessage(t, RecallMessageScheduled, 0)
	next := RecallMessage{StageNo: 2, TemplateSnapshot: `{}`, State: RecallMessageScheduled}
	require.NoError(t, ScheduleNextRecallStages(message.RecipientId, []RecallMessage{next}))

	var stageTwo RecallMessage
	require.NoError(t, DB.Where("recipient_id = ? AND stage_no = ?", message.RecipientId, 2).First(&stageTwo).Error)
	require.Equal(t, int64(1), stageTwo.StateVersion)
	requireRecallMessageStateEvent(t, stageTwo.Id, 1, "", RecallMessageScheduled)

	cancelled, err := CancelPendingRecallMessages(message.RecipientId, "recipient_converted", 1_721_000_300)
	require.NoError(t, err)
	require.Equal(t, int64(2), cancelled)
	requireRecallMessageStateEvent(t, message.Id, 1, "", RecallMessageScheduled)
	requireRecallMessageStateEvent(t, message.Id, 2, RecallMessageScheduled, RecallMessageCancelled)
	requireRecallMessageStateEvent(t, stageTwo.Id, 2, RecallMessageScheduled, RecallMessageCancelled)
}

func TestRecallMessageBaselineIsBoundedCampaignLocalAndIdempotent(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	first := seedRecallMessage(t, RecallMessageAccepted, 0)
	second := seedRecallMessage(t, RecallMessageCancelled, 0)

	count, err := CountUnbaselinedRecallMessagesForCampaign(context.Background(), firstCampaignIDForMessageState(t, first.Id))
	require.NoError(t, err)
	require.EqualValues(t, 1, count)

	reconciled, err := ReconcileRecallMessageStateEventBaseline(context.Background(), 1)
	require.NoError(t, err)
	require.Equal(t, 1, reconciled)

	count, err = CountUnbaselinedRecallMessagesForCampaign(context.Background(), firstCampaignIDForMessageState(t, first.Id))
	require.NoError(t, err)
	require.Zero(t, count)
	count, err = CountUnbaselinedRecallMessagesForCampaign(context.Background(), firstCampaignIDForMessageState(t, second.Id))
	require.NoError(t, err)
	require.EqualValues(t, 1, count)

	reconciled, err = ReconcileRecallMessageStateEventBaseline(context.Background(), 10)
	require.NoError(t, err)
	require.Equal(t, 1, reconciled)
	reconciled, err = ReconcileRecallMessageStateEventBaseline(context.Background(), 10)
	require.NoError(t, err)
	require.Zero(t, reconciled)
	requireRecallMessageStateEventCount(t, 2)
	requireRecallMessageStateEvent(t, first.Id, 1, "", RecallMessageAccepted)
	requireRecallMessageStateEvent(t, second.Id, 1, "", RecallMessageCancelled)
}

func TestRecallMessageBaselineReconcilesVersionedRowsWithoutStateEvents(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	message := seedRecallMessage(t, RecallMessageAccepted, 3)
	campaignID := firstCampaignIDForMessageState(t, message.Id)

	count, err := CountUnbaselinedRecallMessagesForCampaign(context.Background(), campaignID)
	require.NoError(t, err)
	require.EqualValues(t, 1, count)

	reconciled, err := ReconcileRecallMessageStateEventBaseline(context.Background(), 10)
	require.NoError(t, err)
	require.Equal(t, 1, reconciled)

	var stored RecallMessage
	require.NoError(t, DB.First(&stored, message.Id).Error)
	require.Equal(t, int64(3), stored.StateVersion)
	requireRecallMessageStateEvent(t, message.Id, 3, "", RecallMessageAccepted)

	count, err = CountUnbaselinedRecallMessagesForCampaign(context.Background(), campaignID)
	require.NoError(t, err)
	require.Zero(t, count)
	reconciled, err = ReconcileRecallMessageStateEventBaseline(context.Background(), 10)
	require.NoError(t, err)
	require.Zero(t, reconciled)
	requireRecallMessageStateEventCount(t, 1)
}

func TestRecallMessageBaselineReconcilesLegacyNullStateVersionRows(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	message := seedRecallMessage(t, RecallMessageAccepted, 0)
	campaignID := firstCampaignIDForMessageState(t, message.Id)

	require.NoError(t, DB.Exec("UPDATE recall_messages SET state_version = NULL WHERE id = ?", message.Id).Error)

	var storedVersion sql.NullInt64
	require.NoError(t, DB.Raw("SELECT state_version FROM recall_messages WHERE id = ?", message.Id).Scan(&storedVersion).Error)
	require.False(t, storedVersion.Valid)

	count, err := CountUnbaselinedRecallMessagesForCampaign(context.Background(), campaignID)
	require.NoError(t, err)
	require.EqualValues(t, 1, count)

	reconciled, err := ReconcileRecallMessageStateEventBaseline(context.Background(), 10)
	require.NoError(t, err)
	require.Equal(t, 1, reconciled)

	require.NoError(t, DB.Raw("SELECT state_version FROM recall_messages WHERE id = ?", message.Id).Scan(&storedVersion).Error)
	require.True(t, storedVersion.Valid)
	require.Equal(t, int64(1), storedVersion.Int64)
	requireRecallMessageStateEvent(t, message.Id, 1, "", RecallMessageAccepted)

	count, err = CountUnbaselinedRecallMessagesForCampaign(context.Background(), campaignID)
	require.NoError(t, err)
	require.Zero(t, count)
}

func TestRecallMessageBaselinePrefetchesCandidateIDsBeforeLockingRows(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	message := seedRecallMessage(t, RecallMessageAccepted, 0)
	queries := captureRecallMessageStateNormalizedQueries(t)

	reconciled, err := ReconcileRecallMessageStateEventBaseline(context.Background(), 10)
	require.NoError(t, err)
	require.Equal(t, 1, reconciled)

	candidateSelects := 0
	lockedSelects := 0
	for _, query := range *queries {
		if strings.Contains(query, "from recall_messages") && strings.Contains(query, "select recall_messages.id") && strings.Contains(query, "limit") {
			candidateSelects++
			require.NotContains(t, query, "for update")
		}
		if strings.Contains(query, "from recall_messages") && strings.Contains(query, "select recall_messages.*, recall_recipients.campaign_id") && strings.Contains(query, "where recall_messages.id in") {
			lockedSelects++
		}
	}
	require.Equal(t, 1, candidateSelects)
	require.Equal(t, 1, lockedSelects)
	requireRecallMessageStateEvent(t, message.Id, 1, "", RecallMessageAccepted)
}

func TestRecallMessageBaselineConcurrentExactEventDoesNotCountReconciled(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	message := seedRecallMessage(t, RecallMessageAccepted, 3)
	campaignID := firstCampaignIDForMessageState(t, message.Id)
	insertDuplicateRecallMessageStateEventBeforeCreate(t)

	reconciled, err := ReconcileRecallMessageStateEventBaseline(context.Background(), 10)
	require.NoError(t, err)
	require.Zero(t, reconciled)
	requireRecallMessageStateEvent(t, message.Id, 3, "", RecallMessageAccepted)

	count, err := CountUnbaselinedRecallMessagesForCampaign(context.Background(), campaignID)
	require.NoError(t, err)
	require.Zero(t, count)
	reconciled, err = ReconcileRecallMessageStateEventBaseline(context.Background(), 10)
	require.NoError(t, err)
	require.Zero(t, reconciled)
	requireRecallMessageStateEventCount(t, 1)
}

func TestRecallMessageBaselineRejectsExactEventFromDifferentCampaign(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	message := seedRecallMessage(t, RecallMessageAccepted, 3)
	campaignID := firstCampaignIDForMessageState(t, message.Id)
	conflictingEvent, err := recallMessageStateEvent(recallMessageWithCampaign{
		RecallMessage: message,
		CampaignID:    campaignID + 1,
	}, "", message.State, message.StateVersion, 1_721_000_000)
	require.NoError(t, err)
	require.NoError(t, DB.Create(&conflictingEvent).Error)

	count, err := CountUnbaselinedRecallMessagesForCampaign(context.Background(), campaignID)
	require.NoError(t, err)
	require.EqualValues(t, 1, count)

	reconciled, err := ReconcileRecallMessageStateEventBaseline(context.Background(), 10)
	require.ErrorContains(t, err, "baseline event was not inserted")
	require.Zero(t, reconciled)
}

func TestRecallMessageBaselineMissingStateEventSubqueryCorrelatesCampaign(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	message := seedRecallMessage(t, RecallMessageAccepted, 3)
	queries := captureRecallMessageStateNormalizedQueries(t)

	campaignID := firstCampaignIDForMessageState(t, message.Id)
	count, err := CountUnbaselinedRecallMessagesForCampaign(context.Background(), campaignID)
	require.NoError(t, err)
	require.EqualValues(t, 1, count)
	reconciled, err := ReconcileRecallMessageStateEventBaseline(context.Background(), 10)
	require.NoError(t, err)
	require.Equal(t, 1, reconciled)

	missingStateEventQueries := 0
	for _, query := range *queries {
		if !strings.Contains(query, "not exists") || !strings.Contains(query, "from recall_events") {
			continue
		}
		missingStateEventQueries++
		require.Contains(t, query, "recall_events.campaign_id = recall_recipients.campaign_id")
	}
	require.GreaterOrEqual(t, missingStateEventQueries, 2)
}

func TestRecallMessageBaselineDuplicateExactLookupErrorPropagates(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	message := seedRecallMessage(t, RecallMessageAccepted, 3)
	insertDuplicateRecallMessageStateEventBeforeCreate(t)
	failExactRecallMessageStateEventLookup(t)

	reconciled, err := ReconcileRecallMessageStateEventBaseline(context.Background(), 10)
	require.ErrorContains(t, err, "forced exact recall message state event lookup failure")
	require.Zero(t, reconciled)
	require.NotContains(t, err.Error(), "baseline event was not inserted")

	var stored RecallMessage
	require.NoError(t, DB.First(&stored, message.Id).Error)
	require.Equal(t, int64(3), stored.StateVersion)
}

func TestRecallMessageInlineBaselineDuplicateExactLookupErrorPropagates(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	message := seedRecallMessage(t, RecallMessageScheduled, 0)
	insertDuplicateRecallMessageStateEventBeforeCreate(t)
	failExactRecallMessageStateEventLookup(t)

	won, err := LeaseRecallMessage(message.Id, "node-a", 1_721_000_000, 1_721_000_060)
	require.ErrorContains(t, err, "forced exact recall message state event lookup failure")
	require.False(t, won)
	require.NotContains(t, err.Error(), "baseline event was not inserted")
}

func TestRecallMessageLeaseDueRequiresExactDueFieldFence(t *testing.T) {
	tests := []struct {
		name       string
		state      string
		candidate  RecallDueMessage
		mutate     func(tx *gorm.DB, messageID int64)
		acquire    func(message RecallMessage, candidate RecallDueMessage) (bool, error)
		wantState  string
		wantField  string
		wantFuture int64
	}{
		{
			name:  "lease-due scheduled candidate delayed",
			state: RecallMessageScheduled,
			candidate: RecallDueMessage{
				State:          RecallMessageScheduled,
				EffectiveDueAt: 1_721_000_000,
			},
			mutate: func(tx *gorm.DB, messageID int64) {
				require.NoError(t, tx.Session(&gorm.Session{NewDB: true}).Model(&RecallMessage{}).Where("id = ?", messageID).Update("scheduled_at", int64(1_721_000_500)).Error)
			},
			acquire: func(message RecallMessage, candidate RecallDueMessage) (bool, error) {
				candidate.ID = message.Id
				return LeaseDueRecallMessage(candidate, "node-a", 1_721_000_010, 1_721_000_070)
			},
			wantState:  RecallMessageScheduled,
			wantField:  "scheduled_at",
			wantFuture: 1_721_000_500,
		},
		{
			name:  "lease-due retry_wait candidate delayed",
			state: RecallMessageRetryWait,
			candidate: RecallDueMessage{
				State:          RecallMessageRetryWait,
				EffectiveDueAt: 1_721_000_000,
			},
			mutate: func(tx *gorm.DB, messageID int64) {
				require.NoError(t, tx.Session(&gorm.Session{NewDB: true}).Model(&RecallMessage{}).Where("id = ?", messageID).Update("next_attempt_at", int64(1_721_000_500)).Error)
			},
			acquire: func(message RecallMessage, candidate RecallDueMessage) (bool, error) {
				candidate.ID = message.Id
				return LeaseDueRecallMessage(candidate, "node-a", 1_721_000_010, 1_721_000_070)
			},
			wantState:  RecallMessageRetryWait,
			wantField:  "next_attempt_at",
			wantFuture: 1_721_000_500,
		},
		{
			name:  "lease-due expired lease candidate extended",
			state: RecallMessageLeased,
			candidate: RecallDueMessage{
				State:                RecallMessageLeased,
				EffectiveDueAt:       1_721_000_000,
				PreviousLeaseExpires: 1_721_000_000,
			},
			mutate: func(tx *gorm.DB, messageID int64) {
				require.NoError(t, tx.Session(&gorm.Session{NewDB: true}).Model(&RecallMessage{}).Where("id = ?", messageID).Update("lease_expires_at", int64(1_721_000_500)).Error)
			},
			acquire: func(message RecallMessage, candidate RecallDueMessage) (bool, error) {
				candidate.ID = message.Id
				return LeaseDueRecallMessage(candidate, "node-a", 1_721_000_010, 1_721_000_070)
			},
			wantState:  RecallMessageLeased,
			wantField:  "lease_expires_at",
			wantFuture: 1_721_000_500,
		},
		{
			name:  "lease-by-id scheduled candidate delayed",
			state: RecallMessageScheduled,
			mutate: func(tx *gorm.DB, messageID int64) {
				require.NoError(t, tx.Session(&gorm.Session{NewDB: true}).Model(&RecallMessage{}).Where("id = ?", messageID).Update("scheduled_at", int64(1_721_000_500)).Error)
			},
			acquire: func(message RecallMessage, _ RecallDueMessage) (bool, error) {
				return LeaseRecallMessage(message.Id, "node-a", 1_721_000_010, 1_721_000_070)
			},
			wantState:  RecallMessageScheduled,
			wantField:  "scheduled_at",
			wantFuture: 1_721_000_500,
		},
		{
			name:  "lease-by-id retry_wait candidate delayed",
			state: RecallMessageRetryWait,
			mutate: func(tx *gorm.DB, messageID int64) {
				require.NoError(t, tx.Session(&gorm.Session{NewDB: true}).Model(&RecallMessage{}).Where("id = ?", messageID).Update("next_attempt_at", int64(1_721_000_500)).Error)
			},
			acquire: func(message RecallMessage, _ RecallDueMessage) (bool, error) {
				return LeaseRecallMessage(message.Id, "node-a", 1_721_000_010, 1_721_000_070)
			},
			wantState:  RecallMessageRetryWait,
			wantField:  "next_attempt_at",
			wantFuture: 1_721_000_500,
		},
		{
			name:  "lease-by-id expired lease candidate extended",
			state: RecallMessageLeased,
			mutate: func(tx *gorm.DB, messageID int64) {
				require.NoError(t, tx.Session(&gorm.Session{NewDB: true}).Model(&RecallMessage{}).Where("id = ?", messageID).Update("lease_expires_at", int64(1_721_000_500)).Error)
			},
			acquire: func(message RecallMessage, _ RecallDueMessage) (bool, error) {
				return LeaseRecallMessage(message.Id, "node-a", 1_721_000_010, 1_721_000_070)
			},
			wantState:  RecallMessageLeased,
			wantField:  "lease_expires_at",
			wantFuture: 1_721_000_500,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			setupRecallRepositoryTestDB(t)
			message := seedRecallMessage(t, test.state, 0)
			leaseOwner := ""
			if test.state == RecallMessageLeased {
				leaseOwner = "previous-owner"
			}
			require.NoError(t, DB.Model(&RecallMessage{}).Where("id = ?", message.Id).Updates(map[string]any{
				"scheduled_at":       int64(1_721_000_000),
				"next_attempt_at":    int64(1_721_000_000),
				"lease_owner":        leaseOwner,
				"lease_expires_at":   int64(1_721_000_000),
				"last_error_code":    "",
				"last_error_message": "",
			}).Error)

			registerRecallMessagePostSelectMutation(t, message.Id, test.mutate)
			won, err := test.acquire(message, test.candidate)
			require.NoError(t, err)
			require.False(t, won)

			var stored RecallMessage
			require.NoError(t, DB.First(&stored, message.Id).Error)
			require.Equal(t, test.wantState, stored.State)
			require.Equal(t, leaseOwner, stored.LeaseOwner)
			require.Equal(t, int64(0), stored.StateVersion)
			switch test.wantField {
			case "scheduled_at":
				require.Equal(t, test.wantFuture, stored.ScheduledAt)
			case "next_attempt_at":
				require.Equal(t, test.wantFuture, stored.NextAttemptAt)
			case "lease_expires_at":
				require.Equal(t, test.wantFuture, stored.LeaseExpiresAt)
			}
			requireRecallMessageStateEventCount(t, 0)
		})
	}
}

func seedRecallMessage(t *testing.T, state string, stateVersion int64) RecallMessage {
	t.Helper()

	campaign := seedRecallCampaignForMessageState(t)
	recipient := RecallRecipient{
		CampaignId:          campaign.Id,
		UserId:              int(campaign.Id) + 1000,
		EligibilitySnapshot: `{}`,
		EmailSnapshot:       fmt.Sprintf("message-state-%d@example.com", campaign.Id),
		LanguageSnapshot:    "en",
		State:               RecallRecipientContacting,
	}
	require.NoError(t, DB.Create(&recipient).Error)
	message := RecallMessage{
		RecipientId:      recipient.Id,
		StageNo:          1,
		TemplateVersion:  1,
		TemplateSnapshot: `{}`,
		ScheduledAt:      1_721_000_000,
		State:            state,
		StateVersion:     stateVersion,
	}
	require.NoError(t, DB.Create(&message).Error)
	return message
}

func registerRecallMessagePostSelectMutation(t *testing.T, messageID int64, mutate func(tx *gorm.DB, messageID int64)) {
	t.Helper()
	name := fmt.Sprintf("test:recall-message-due-fence:%s", t.Name())
	triggered := false
	require.NoError(t, DB.Callback().Query().After("gorm:query").Register(name, func(tx *gorm.DB) {
		if triggered || tx.Statement == nil || tx.Statement.Schema == nil || tx.Statement.Schema.Name != "RecallMessage" {
			return
		}
		triggered = true
		mutate(tx, messageID)
	}))
	t.Cleanup(func() {
		require.NoError(t, DB.Callback().Query().Remove(name))
		require.True(t, triggered, "expected recall message select mutation callback to run")
	})
}

func recallManualRetryTestAdminEvent(selection RecallManualRetrySelection) (RecallEvent, error) {
	return RecallEvent{
		CampaignId:    selection.CampaignID,
		RecipientId:   selection.RecipientID,
		EventType:     "recipient_retry",
		Source:        "admin",
		SourceEventId: fmt.Sprintf("manual-retry:%s:%d:%d", selection.Target, selection.RecipientID, selection.Now),
		EventData:     fmt.Sprintf(`{"target":%q}`, selection.Target),
		CreatedAt:     selection.Now,
	}, nil
}

func failRecallMessageStateEventInserts(t *testing.T) {
	t.Helper()
	name := fmt.Sprintf("test:recall-message-event-insert-fail:%s", t.Name())
	triggered := false
	require.NoError(t, DB.Callback().Create().Before("gorm:create").Register(name, func(tx *gorm.DB) {
		if tx.Statement == nil || tx.Statement.Schema == nil || tx.Statement.Schema.Name != "RecallEvent" {
			return
		}
		event, ok := tx.Statement.Dest.(*RecallEvent)
		if !ok || event.Source != "message_state" || !strings.Contains(event.SourceEventId, ":") {
			return
		}
		triggered = true
		tx.AddError(errors.New("forced recall message state event insert failure"))
	}))
	t.Cleanup(func() {
		require.NoError(t, DB.Callback().Create().Remove(name))
		require.True(t, triggered, "expected recall message state event insert callback to run")
	})
}

func insertDuplicateRecallMessageStateEventBeforeCreate(t *testing.T) {
	t.Helper()
	name := fmt.Sprintf("test:recall-message-event-insert-duplicate:%s", t.Name())
	triggered := false
	require.NoError(t, DB.Callback().Create().Before("gorm:create").Register(name, func(tx *gorm.DB) {
		if triggered || tx.Statement == nil || tx.Statement.Schema == nil || tx.Statement.Schema.Name != "RecallEvent" {
			return
		}
		event, ok := tx.Statement.Dest.(*RecallEvent)
		if !ok || event.EventType != "message_state_changed" || event.Source != "message_state" {
			return
		}
		triggered = true
		duplicate := *event
		duplicate.Id = 0
		if err := tx.Session(&gorm.Session{NewDB: true, SkipHooks: true}).Create(&duplicate).Error; err != nil {
			tx.AddError(err)
		}
	}))
	t.Cleanup(func() {
		require.NoError(t, DB.Callback().Create().Remove(name))
		require.True(t, triggered, "expected recall message state event duplicate callback to run")
	})
}

func captureRecallMessageStateNormalizedQueries(t *testing.T) *[]string {
	t.Helper()
	name := fmt.Sprintf("test:recall-message-state-query-capture:%s", t.Name())
	queries := make([]string, 0)
	require.NoError(t, DB.Callback().Query().After("gorm:query").Register(name, func(tx *gorm.DB) {
		if tx.Statement == nil {
			return
		}
		queries = append(queries, normalizeRecallMessageStateSQL(tx.Statement.SQL.String()))
	}))
	t.Cleanup(func() {
		require.NoError(t, DB.Callback().Query().Remove(name))
	})
	return &queries
}

func normalizeRecallMessageStateSQL(sql string) string {
	sql = strings.ToLower(sql)
	sql = strings.NewReplacer("`", "", `"`, "", "[", "", "]", "").Replace(sql)
	return strings.Join(strings.Fields(sql), " ")
}

func failExactRecallMessageStateEventLookup(t *testing.T) {
	t.Helper()
	name := fmt.Sprintf("test:recall-message-event-exact-lookup-fail:%s", t.Name())
	triggered := false
	require.NoError(t, DB.Callback().Query().After("gorm:query").Register(name, func(tx *gorm.DB) {
		if tx.Statement == nil || tx.Statement.Schema == nil || tx.Statement.Schema.Name != "RecallEvent" {
			return
		}
		if !strings.Contains(normalizeRecallMessageStateSQL(tx.Statement.SQL.String()), "source_event_id") {
			return
		}
		triggered = true
		tx.AddError(errors.New("forced exact recall message state event lookup failure"))
	}))
	t.Cleanup(func() {
		require.NoError(t, DB.Callback().Query().Remove(name))
		require.True(t, triggered, "expected exact recall message state event lookup callback to run")
	})
}

func seedRecallCampaignForMessageState(t *testing.T) RecallCampaign {
	t.Helper()
	campaign := newRecallRepositoryCampaign("message state")
	campaign.Status = RecallCampaignRunning
	require.NoError(t, DB.Create(&campaign).Error)
	return campaign
}

func firstCampaignIDForMessageState(t *testing.T, messageID int64) int64 {
	t.Helper()
	var row struct {
		CampaignId int64
	}
	require.NoError(t, DB.Model(&RecallMessage{}).
		Select("recall_recipients.campaign_id").
		Joins("JOIN recall_recipients ON recall_recipients.id = recall_messages.recipient_id").
		Where("recall_messages.id = ?", messageID).
		First(&row).Error)
	return row.CampaignId
}

func requireRecallMessageStateEvent(t *testing.T, messageID int64, version int64, from string, to string) {
	t.Helper()
	var event RecallEvent
	require.NoError(t, DB.Where("event_type = ? AND source = ? AND source_event_id = ?", "message_state_changed", "message_state", fmt.Sprintf("%d:%d", messageID, version)).First(&event).Error)
	var data recallMessageStateEventData
	require.NoError(t, common.Unmarshal([]byte(event.EventData), &data))
	require.Equal(t, messageID, data.MessageID)
	require.Equal(t, from, data.FromState)
	require.Equal(t, to, data.ToState)
	require.NotZero(t, data.RecipientID)
	require.NotZero(t, data.StageNo)
	require.NotZero(t, data.OccurredAt)
	require.NotContains(t, event.EventData, "owner")
	require.NotContains(t, event.EventData, "email")
	require.NotContains(t, event.EventData, "error")

	var duplicateCount int64
	require.NoError(t, DB.Model(&RecallEvent{}).Where("source = ? AND source_event_id = ?", "message_state", fmt.Sprintf("%d:%d", messageID, version)).Count(&duplicateCount).Error)
	require.EqualValues(t, 1, duplicateCount)

	var message RecallMessage
	require.NoError(t, DB.First(&message, messageID).Error)
	require.GreaterOrEqual(t, message.StateVersion, version)
}

func requireRecallMessageStateEventCount(t *testing.T, expected int64) {
	t.Helper()
	var count int64
	require.NoError(t, DB.Model(&RecallEvent{}).Where("event_type = ? AND source = ?", "message_state_changed", "message_state").Count(&count).Error)
	require.Equal(t, expected, count)
}
