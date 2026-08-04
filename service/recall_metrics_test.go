package service

import (
	"bytes"
	"context"
	"encoding/csv"
	"regexp"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

var allRecallMetricKeys = []model.RecallMetricKey{
	"candidates",
	"enrolled",
	"excluded",
	"opened_recipients",
	"observed_clicks",
	"messages_accepted",
	"messages_failed",
	"direct_conversions",
	"assisted_conversions",
	"no_coupon_conversions",
	"attributed_spend",
	"new_external_cash",
	"direct_topup",
	"balance_subscription",
	"online_subscription",
}

func setupRecallMetricServiceDB(t *testing.T) *gorm.DB {
	t.Helper()
	originalDB := model.DB
	db, err := gorm.Open(sqlite.Open(t.TempDir()+"/recall-metrics.db"), &gorm.Config{})
	require.NoError(t, err)
	model.DB = db
	require.NoError(t, db.AutoMigrate(
		&model.User{},
		&model.TopUp{},
		&model.SubscriptionOrder{},
		&model.RecallCampaign{},
		&model.RecallRecipient{},
		&model.RecallMessage{},
		&model.RecallEvent{},
		&model.RecallCampaignExclusion{},
	))
	t.Cleanup(func() {
		sqlDB, _ := db.DB()
		_ = sqlDB.Close()
		model.DB = originalDB
	})
	return db
}

func setupRecallMetricSingleConnectionSharedMemoryDB(t *testing.T) *gorm.DB {
	t.Helper()
	originalDB := model.DB
	db, err := gorm.Open(sqlite.Open("file:recall_metric_single_conn_"+strconv.FormatInt(time.Now().UnixNano(), 10)+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	model.DB = db
	require.NoError(t, db.AutoMigrate(
		&model.User{},
		&model.TopUp{},
		&model.SubscriptionOrder{},
		&model.RecallCampaign{},
		&model.RecallRecipient{},
		&model.RecallMessage{},
		&model.RecallEvent{},
		&model.RecallCampaignExclusion{},
	))
	t.Cleanup(func() {
		_ = sqlDB.Close()
		model.DB = originalDB
	})
	return db
}

func TestRecallMetricQueryUsesSnapshotForDrawerAndExport(t *testing.T) {
	db := setupRecallMetricServiceDB(t)
	campaign := model.RecallCampaign{Name: "metrics", Status: model.RecallCampaignRunning}
	require.NoError(t, db.Create(&campaign).Error)
	first := model.RecallRecipient{CampaignId: campaign.Id, UserId: 101, EligibilitySnapshot: `{}`, EmailSnapshot: "ada@example.com", LanguageSnapshot: "en", State: model.RecallRecipientConverted, ConversionKind: model.RecallConversionDirect, ConversionCurrency: "usd", ConversionAmount: 1200}
	require.NoError(t, db.Create(&first).Error)
	require.NoError(t, db.Create(&model.RecallEvent{CampaignId: campaign.Id, RecipientId: first.Id, EventType: "conversion", Source: "test", SourceEventId: "conversion:first", EventData: `{"trade_no":"first_trade","conversion_kind":"direct","currency":"usd","amount_total":1200}`, CreatedAt: 100}).Error)

	query := model.RecallMetricQuery{CampaignID: campaign.Id, Metric: "direct_conversions", Limit: 50}
	page, err := QueryRecallMetric(context.Background(), query, time.Unix(2_000, 0))
	require.NoError(t, err)
	require.EqualValues(t, 1, page.Total)
	require.EqualValues(t, 1200, page.AmountMinorByCurrency["USD"])

	second := model.RecallRecipient{CampaignId: campaign.Id, UserId: 102, EligibilitySnapshot: `{}`, EmailSnapshot: "late@example.com", LanguageSnapshot: "en", State: model.RecallRecipientConverted, ConversionKind: model.RecallConversionDirect, ConversionCurrency: "usd", ConversionAmount: 900}
	require.NoError(t, db.Create(&second).Error)
	require.NoError(t, db.Create(&model.RecallEvent{CampaignId: campaign.Id, RecipientId: second.Id, EventType: "conversion", Source: "test", SourceEventId: "conversion:second", EventData: `{"trade_no":"second_trade","conversion_kind":"direct","currency":"usd","amount_total":900}`, CreatedAt: 200}).Error)

	query.Snapshot = page.Snapshot
	again, err := QueryRecallMetric(context.Background(), query, time.Unix(2_000, 0))
	require.NoError(t, err)
	require.EqualValues(t, 1, again.Total)

	var out bytes.Buffer
	err = ExportRecallMetricCSV(context.Background(), &out, query, time.Unix(2_000, 0))
	require.NoError(t, err)
	rows, err := csv.NewReader(bytes.NewReader(out.Bytes())).ReadAll()
	require.NoError(t, err)
	require.Len(t, rows, 2)
	require.Equal(t, "101", rows[1][5])
}

func TestRecallMetricPageJSONExposesOnlyOpaqueSnapshotToken(t *testing.T) {
	db := setupRecallMetricServiceDB(t)
	campaign := model.RecallCampaign{Name: "json snapshot", Status: model.RecallCampaignRunning}
	require.NoError(t, db.Create(&campaign).Error)
	recipient := model.RecallRecipient{CampaignId: campaign.Id, UserId: 211, RecipientIdentity: model.RecallRecipientIdentityForUser(211), EligibilitySnapshot: `{}`, EmailSnapshot: "json-snapshot@example.com", LanguageSnapshot: "en", State: model.RecallRecipientQueued}
	require.NoError(t, db.Create(&recipient).Error)
	page, err := QueryRecallMetric(context.Background(), model.RecallMetricQuery{CampaignID: campaign.Id, Metric: "enrolled", Limit: 10}, time.Now())
	require.NoError(t, err)
	require.NotZero(t, page.Snapshot.AsOf)
	require.NotEmpty(t, page.SnapshotToken)

	raw, err := common.Marshal(page)
	require.NoError(t, err)
	var body map[string]any
	require.NoError(t, common.Unmarshal(raw, &body))
	require.Equal(t, page.SnapshotToken, body["snapshot"])
	require.NotContains(t, string(raw), "snapshot_token")
	require.NotContains(t, string(raw), "recipient_max_id")
	require.NotContains(t, string(raw), "fact_event_max_id")
}

func TestRecallMetricPageJSONDoesNotExposeInternalAmountMap(t *testing.T) {
	page := RecallMetricPage{
		Items:                 []model.RecallMetricRow{{RowID: 1, AmountMinor: 100}},
		Total:                 1,
		AmountMinorByCurrency: map[string]int64{"USD": 100},
		Amounts:               []RecallMetricAmount{{Currency: "USD", AmountMinor: 100, UserCount: 1}},
		SnapshotToken:         "opaque-snapshot",
	}

	raw, err := common.Marshal(page)
	require.NoError(t, err)
	require.Contains(t, string(raw), `"snapshot":"opaque-snapshot"`)
	require.Contains(t, string(raw), `"amounts":[`)
	require.NotContains(t, string(raw), "amount_minor_by_currency")
	require.NotContains(t, string(raw), "snapshot_token")
}

func TestRecallMetricCardJSONUsesOpaqueSnapshotAndHidesInternals(t *testing.T) {
	card := RecallMetricCard{
		Key:                   "attributed_spend",
		Total:                 1,
		Amounts:               []RecallMetricAmount{{Currency: "USD", AmountMinor: 100, UserCount: 1}},
		RowGrain:              model.RecallMetricGrainConversion,
		SnapshotToken:         "opaque-card-snapshot",
		AmountMinorByCurrency: map[string]int64{"USD": 100},
		SnapshotHighWaterForTest: model.RecallMetricSnapshot{
			RecipientMaxID: 123,
		},
	}

	raw, err := common.Marshal(card)
	require.NoError(t, err)
	require.Contains(t, string(raw), `"snapshot":"opaque-card-snapshot"`)
	require.NotContains(t, string(raw), "snapshot_token")
	require.NotContains(t, string(raw), "amount_minor_by_currency")
	require.NotContains(t, string(raw), "recipient_max_id")
}

func TestRecallMetricExportEscapesFormulaCells(t *testing.T) {
	db := setupRecallMetricServiceDB(t)
	campaign := model.RecallCampaign{Name: "metrics", Status: model.RecallCampaignRunning}
	require.NoError(t, db.Create(&campaign).Error)
	recipient := model.RecallRecipient{CampaignId: campaign.Id, UserId: 101, EligibilitySnapshot: `{}`, EmailSnapshot: "\t=cmd@example.com", LanguageSnapshot: "en", State: model.RecallRecipientQueued}
	require.NoError(t, db.Create(&recipient).Error)

	var out bytes.Buffer
	err := ExportRecallMetricCSV(context.Background(), &out, model.RecallMetricQuery{CampaignID: campaign.Id, Metric: "enrolled", Limit: 50}, time.Unix(2_000, 0))
	require.NoError(t, err)
	rows, err := csv.NewReader(bytes.NewReader(out.Bytes())).ReadAll()
	require.NoError(t, err)
	require.Equal(t, "'\t=cmd@example.com", rows[1][8])
}

func TestRecallMetricMessageRowsUseSnapshotStateEvents(t *testing.T) {
	db := setupRecallMetricServiceDB(t)
	campaign := model.RecallCampaign{Name: "message metrics", Status: model.RecallCampaignRunning}
	require.NoError(t, db.Create(&campaign).Error)
	recipient := model.RecallRecipient{CampaignId: campaign.Id, UserId: 201, EligibilitySnapshot: `{}`, EmailSnapshot: "message@example.com", LanguageSnapshot: "en", State: model.RecallRecipientContacting}
	require.NoError(t, db.Create(&recipient).Error)

	require.NoError(t, db.Transaction(func(tx *gorm.DB) error {
		return model.CreateRecallMessagesWithStateEventsTx(tx, campaign.Id, []model.RecallMessage{{
			RecipientId:       recipient.Id,
			StageNo:           1,
			TemplateVersion:   1,
			TemplateSnapshot:  "template",
			ScheduledAt:       100,
			State:             model.RecallMessageScheduled,
			ProviderMessageId: "provider-1",
		}}, 100)
	}))
	var message model.RecallMessage
	require.NoError(t, db.Where("recipient_id = ? AND stage_no = ?", recipient.Id, 1).First(&message).Error)
	accepted, err := model.TransitionRecallMessageWithEvent(context.Background(), model.RecallMessageTransition{
		MessageID: message.Id,
		From:      model.RecallMessageScheduled,
		To:        model.RecallMessageAccepted,
		Fields: map[string]any{
			"accepted_at": 110,
		},
	})
	require.NoError(t, err)
	require.True(t, accepted)

	acceptedPage, err := QueryRecallMetric(context.Background(), model.RecallMetricQuery{CampaignID: campaign.Id, Metric: "messages_accepted", Limit: 10}, time.Unix(2_000, 0))
	require.NoError(t, err)
	require.EqualValues(t, 1, acceptedPage.Total)
	require.Len(t, acceptedPage.Items, 1)
	snapshot := acceptedPage.Snapshot

	failed, err := model.TransitionRecallMessageWithEvent(context.Background(), model.RecallMessageTransition{
		MessageID: message.Id,
		From:      model.RecallMessageAccepted,
		To:        model.RecallMessageFailed,
		Fields: map[string]any{
			"failed_at":       120,
			"last_error_code": "smtp_rejected",
		},
	})
	require.NoError(t, err)
	require.True(t, failed)

	acceptedAtSnapshot, err := QueryRecallMetric(context.Background(), model.RecallMetricQuery{CampaignID: campaign.Id, Metric: "messages_accepted", Snapshot: snapshot, Limit: 10}, time.Unix(2_000, 0))
	require.NoError(t, err)
	require.EqualValues(t, 1, acceptedAtSnapshot.Total)
	failedAtSnapshot, err := QueryRecallMetric(context.Background(), model.RecallMetricQuery{CampaignID: campaign.Id, Metric: "messages_failed", Snapshot: snapshot, Limit: 10}, time.Unix(2_000, 0))
	require.NoError(t, err)
	require.Zero(t, failedAtSnapshot.Total)
}

func TestRecallMetricFailedRowsUseSnapshotFailureCodeEventDataAfterManualRequeue(t *testing.T) {
	db := setupRecallMetricServiceDB(t)
	campaign := model.RecallCampaign{Name: "message failure code snapshot", Status: model.RecallCampaignRunning}
	require.NoError(t, db.Create(&campaign).Error)
	recipient := model.RecallRecipient{CampaignId: campaign.Id, UserId: 202, EligibilitySnapshot: `{}`, EmailSnapshot: "failure-code@example.com", LanguageSnapshot: "en", State: model.RecallRecipientContacting}
	require.NoError(t, db.Create(&recipient).Error)
	require.NoError(t, db.Transaction(func(tx *gorm.DB) error {
		return model.CreateRecallMessagesWithStateEventsTx(tx, campaign.Id, []model.RecallMessage{{
			RecipientId:      recipient.Id,
			StageNo:          1,
			TemplateVersion:  1,
			TemplateSnapshot: "template",
			ScheduledAt:      100,
			State:            model.RecallMessageScheduled,
		}}, 100)
	}))
	var message model.RecallMessage
	require.NoError(t, db.Where("recipient_id = ? AND stage_no = ?", recipient.Id, 1).First(&message).Error)
	failed, err := model.TransitionRecallMessageWithEvent(context.Background(), model.RecallMessageTransition{
		MessageID: message.Id,
		From:      model.RecallMessageScheduled,
		To:        model.RecallMessageFailed,
		Fields: map[string]any{
			"failed_at":          int64(120),
			"last_error_code":    " SMTP Rejected!!! ",
			"last_error_message": "user@example.com rejected by smtp.example.com",
		},
	})
	require.NoError(t, err)
	require.True(t, failed)

	failedPage, err := QueryRecallMetric(context.Background(), model.RecallMetricQuery{CampaignID: campaign.Id, Metric: "messages_failed", Limit: 10}, time.Unix(2_000, 0))
	require.NoError(t, err)
	require.EqualValues(t, 1, failedPage.Total)
	require.Len(t, failedPage.Items, 1)
	require.Equal(t, "smtprejected", failedPage.Items[0].FailureCode)
	require.NotContains(t, failedPage.Items[0].FailureCode, "user@example.com")
	snapshot := failedPage.Snapshot

	retried, err := model.ManualRetryRecallMessageWithContext(context.Background(), message.Id, false, 130)
	require.NoError(t, err)
	require.True(t, retried)
	require.NoError(t, db.First(&message, message.Id).Error)
	require.Empty(t, message.LastErrorCode)

	frozen, err := QueryRecallMetric(context.Background(), model.RecallMetricQuery{CampaignID: campaign.Id, Metric: "messages_failed", Snapshot: snapshot, Limit: 10}, time.Unix(2_000, 0))
	require.NoError(t, err)
	require.EqualValues(t, 1, frozen.Total)
	require.Len(t, frozen.Items, 1)
	require.Equal(t, "smtprejected", frozen.Items[0].FailureCode)
}

func TestRecallMetricFrozenMessageSnapshotIgnoresPostSnapshotUnbaselinedRows(t *testing.T) {
	db := setupRecallMetricServiceDB(t)
	campaign := model.RecallCampaign{Name: "message frozen baseline readiness", Status: model.RecallCampaignRunning}
	require.NoError(t, db.Create(&campaign).Error)
	firstRecipient := model.RecallRecipient{CampaignId: campaign.Id, UserId: 211, RecipientIdentity: model.RecallRecipientIdentityForUser(211), EligibilitySnapshot: `{}`, EmailSnapshot: "frozen-message-1@example.com", LanguageSnapshot: "en", State: model.RecallRecipientQueued}
	secondRecipient := model.RecallRecipient{CampaignId: campaign.Id, UserId: 212, RecipientIdentity: model.RecallRecipientIdentityForUser(212), EligibilitySnapshot: `{}`, EmailSnapshot: "frozen-message-2@example.com", LanguageSnapshot: "en", State: model.RecallRecipientQueued}
	require.NoError(t, db.Create(&firstRecipient).Error)
	require.NoError(t, db.Create(&secondRecipient).Error)
	require.NoError(t, db.Transaction(func(tx *gorm.DB) error {
		return model.CreateRecallMessagesWithStateEventsTx(tx, campaign.Id, []model.RecallMessage{
			{RecipientId: firstRecipient.Id, StageNo: 1, TemplateVersion: 1, TemplateSnapshot: "template", ScheduledAt: 100, State: model.RecallMessageAccepted},
			{RecipientId: secondRecipient.Id, StageNo: 1, TemplateVersion: 1, TemplateSnapshot: "template", ScheduledAt: 100, State: model.RecallMessageAccepted},
		}, 100)
	}))
	var messages []model.RecallMessage
	require.NoError(t, db.Where("recipient_id IN ?", []int64{firstRecipient.Id, secondRecipient.Id}).Order("id ASC").Find(&messages).Error)
	require.Len(t, messages, 2)
	for i := range messages {
		require.NoError(t, db.Create(&model.RecallEvent{
			CampaignId:    campaign.Id,
			RecipientId:   messages[i].RecipientId,
			EventType:     "message_state_changed",
			Source:        "message_state",
			MessageId:     messages[i].Id,
			SourceEventId: strconv.FormatInt(messages[i].Id, 10) + ":2",
			EventData:     `{"message_id":` + strconv.FormatInt(messages[i].Id, 10) + `,"recipient_id":` + strconv.FormatInt(messages[i].RecipientId, 10) + `,"stage_no":1,"from_state":"scheduled","to_state":"accepted","occurred_at":` + strconv.Itoa(200+i) + `}`,
			CreatedAt:     int64(200 + i),
		}).Error)
	}

	now := time.Now()
	first, err := QueryRecallMetric(context.Background(), model.RecallMetricQuery{CampaignID: campaign.Id, Metric: "messages_accepted", Limit: 1}, now)
	require.NoError(t, err)
	require.EqualValues(t, 2, first.Total)
	require.Len(t, first.Items, 1)
	require.NotEmpty(t, first.NextCursor)
	query := model.RecallMetricQuery{CampaignID: campaign.Id, Metric: "messages_accepted", Snapshot: first.Snapshot, Limit: 1}
	cursor, err := VerifyRecallMetricCursorToken(first.NextCursor, query, "message", now)
	require.NoError(t, err)

	lateSameRecipient := model.RecallMessage{RecipientId: firstRecipient.Id, StageNo: 2, TemplateVersion: 1, TemplateSnapshot: "template", ScheduledAt: 300, State: model.RecallMessageScheduled, StateVersion: 0}
	require.NoError(t, db.Create(&lateSameRecipient).Error)
	query.Cursor = cursor
	second, err := QueryRecallMetric(context.Background(), query, now)
	require.NoError(t, err)
	require.EqualValues(t, first.Total, second.Total)
	require.Len(t, second.Items, 1)
	require.NotEqual(t, first.Items[0].MessageID, second.Items[0].MessageID)

	_, err = QueryRecallMetric(context.Background(), model.RecallMetricQuery{CampaignID: campaign.Id, Metric: "messages_accepted", Limit: 1}, now)
	require.ErrorIs(t, err, model.ErrRecallMetricRetry)
}

func TestRecallMetricMessageCursorUsesOccurredAtBeforeMessageID(t *testing.T) {
	db := setupRecallMetricServiceDB(t)
	campaign := model.RecallCampaign{Name: "message cursor sort", Status: model.RecallCampaignRunning}
	require.NoError(t, db.Create(&campaign).Error)
	laterRecipient := model.RecallRecipient{CampaignId: campaign.Id, UserId: 9101, RecipientIdentity: model.RecallRecipientIdentityForUser(9101), EligibilitySnapshot: `{}`, EmailSnapshot: "later-message@example.com", LanguageSnapshot: "en", State: model.RecallRecipientQueued}
	earlierRecipient := model.RecallRecipient{CampaignId: campaign.Id, UserId: 9102, RecipientIdentity: model.RecallRecipientIdentityForUser(9102), EligibilitySnapshot: `{}`, EmailSnapshot: "earlier-message@example.com", LanguageSnapshot: "en", State: model.RecallRecipientQueued}
	require.NoError(t, db.Create(&laterRecipient).Error)
	require.NoError(t, db.Create(&earlierRecipient).Error)
	laterMessage := model.RecallMessage{Id: 1, RecipientId: laterRecipient.Id, StageNo: 1, TemplateVersion: 1, TemplateSnapshot: "template", ScheduledAt: 100, State: model.RecallMessageAccepted, StateVersion: 1, AcceptedAt: 300}
	earlierMessage := model.RecallMessage{Id: 2, RecipientId: earlierRecipient.Id, StageNo: 1, TemplateVersion: 1, TemplateSnapshot: "template", ScheduledAt: 100, State: model.RecallMessageAccepted, StateVersion: 1, AcceptedAt: 200}
	require.NoError(t, db.Create(&laterMessage).Error)
	require.NoError(t, db.Create(&earlierMessage).Error)
	for _, event := range []model.RecallEvent{
		{CampaignId: campaign.Id, RecipientId: laterRecipient.Id, EventType: "message_state_changed", Source: "message_state", MessageId: laterMessage.Id, SourceEventId: "1:1", EventData: `{"message_id":1,"recipient_id":` + strconv.FormatInt(laterRecipient.Id, 10) + `,"stage_no":1,"from_state":"scheduled","to_state":"accepted","occurred_at":300}`, CreatedAt: 300},
		{CampaignId: campaign.Id, RecipientId: earlierRecipient.Id, EventType: "message_state_changed", Source: "message_state", MessageId: earlierMessage.Id, SourceEventId: "2:1", EventData: `{"message_id":2,"recipient_id":` + strconv.FormatInt(earlierRecipient.Id, 10) + `,"stage_no":1,"from_state":"scheduled","to_state":"accepted","occurred_at":200}`, CreatedAt: 200},
	} {
		require.NoError(t, db.Create(&event).Error)
	}

	first, err := QueryRecallMetric(context.Background(), model.RecallMetricQuery{CampaignID: campaign.Id, Metric: "messages_accepted", Limit: 1}, time.Now())
	require.NoError(t, err)
	require.Len(t, first.Items, 1)
	require.EqualValues(t, earlierMessage.Id, first.Items[0].MessageID)
	require.NotEmpty(t, first.NextCursor)

	query := model.RecallMetricQuery{CampaignID: campaign.Id, Metric: "messages_accepted", Snapshot: first.Snapshot, Limit: 1}
	cursor, err := VerifyRecallMetricCursorToken(first.NextCursor, query, "message", time.Now())
	require.NoError(t, err)
	query.Cursor = cursor
	second, err := QueryRecallMetric(context.Background(), query, time.Now())
	require.NoError(t, err)
	require.Len(t, second.Items, 1)
	require.EqualValues(t, laterMessage.Id, second.Items[0].MessageID)
}

func TestRecallMetricMessageStreamCursorAdvancesAcrossFullSameTimestampBatches(t *testing.T) {
	db := setupRecallMetricServiceDB(t)
	campaign := model.RecallCampaign{Name: "message cursor full batches", Status: model.RecallCampaignRunning}
	require.NoError(t, db.Create(&campaign).Error)
	recipients := make([]model.RecallRecipient, 0, 401)
	for i := 0; i < 401; i++ {
		userID := 77_000 + i
		recipients = append(recipients, model.RecallRecipient{CampaignId: campaign.Id, UserId: userID, RecipientIdentity: model.RecallRecipientIdentityForUser(userID), EligibilitySnapshot: `{}`, EmailSnapshot: "message-cursor-batch-" + strconv.Itoa(i) + "@example.com", LanguageSnapshot: "en", State: model.RecallRecipientQueued})
	}
	require.NoError(t, db.CreateInBatches(&recipients, 100).Error)
	messages := make([]model.RecallMessage, 0, len(recipients))
	for _, recipient := range recipients {
		messages = append(messages, model.RecallMessage{RecipientId: recipient.Id, StageNo: 1, TemplateVersion: 1, TemplateSnapshot: "template", ScheduledAt: 100, State: model.RecallMessageAccepted})
	}
	require.NoError(t, db.Transaction(func(tx *gorm.DB) error {
		return model.CreateRecallMessagesWithStateEventsTx(tx, campaign.Id, messages, 300)
	}))
	var stored []model.RecallMessage
	require.NoError(t, db.Order("id ASC").Find(&stored).Error)
	require.Len(t, stored, 401)
	snapshot, err := model.CaptureRecallMetricSnapshot(context.Background(), campaign.Id)
	require.NoError(t, err)
	query := model.RecallMetricQuery{CampaignID: campaign.Id, Metric: "messages_accepted", Snapshot: snapshot, Cursor: model.RecallMetricCursor{SortTime: 300, RowID: stored[0].Id}}
	seen := map[int64]bool{}
	var duplicate int64
	_, err = model.StreamRecallMetricRows(context.Background(), query, 200, func(row model.RecallMetricRow) (bool, error) {
		if seen[row.MessageID] {
			duplicate = row.MessageID
			return false, nil
		}
		seen[row.MessageID] = true
		return true, nil
	})
	require.NoError(t, err)
	require.Zero(t, duplicate)
	require.Len(t, seen, 400)
	require.False(t, seen[stored[0].Id])
}

func TestRecallMetricLargeMessageSnapshotDoesNotMaterializeFail(t *testing.T) {
	db := setupRecallMetricServiceDB(t)
	campaign := model.RecallCampaign{Name: "large messages", Status: model.RecallCampaignRunning}
	require.NoError(t, db.Create(&campaign).Error)
	recipients := make([]model.RecallRecipient, 50_001)
	for i := range recipients {
		userID := 920_000 + i
		recipients[i] = model.RecallRecipient{CampaignId: campaign.Id, UserId: userID, RecipientIdentity: model.RecallRecipientIdentityForUser(userID), EligibilitySnapshot: `{}`, EmailSnapshot: "message-large-" + strconv.Itoa(i) + "@example.com", LanguageSnapshot: "en", State: model.RecallRecipientQueued}
	}
	require.NoError(t, db.CreateInBatches(&recipients, 500).Error)
	messages := make([]model.RecallMessage, len(recipients))
	for i, recipient := range recipients {
		messageID := int64(i + 1)
		messages[i] = model.RecallMessage{Id: messageID, RecipientId: recipient.Id, StageNo: 1, TemplateVersion: 1, TemplateSnapshot: "template", ScheduledAt: 100, State: model.RecallMessageAccepted, StateVersion: 1, AcceptedAt: int64(200 + i)}
	}
	require.NoError(t, db.CreateInBatches(&messages, 500).Error)
	events := make([]model.RecallEvent, len(messages))
	for i, message := range messages {
		events[i] = model.RecallEvent{CampaignId: campaign.Id, RecipientId: message.RecipientId, EventType: "message_state_changed", Source: "message_state", MessageId: message.Id, SourceEventId: strconv.FormatInt(message.Id, 10) + ":1", EventData: `{"message_id":` + strconv.FormatInt(message.Id, 10) + `,"recipient_id":` + strconv.FormatInt(message.RecipientId, 10) + `,"stage_no":1,"from_state":"scheduled","to_state":"accepted","occurred_at":` + strconv.Itoa(200+i) + `}`, CreatedAt: int64(200 + i)}
	}
	require.NoError(t, db.CreateInBatches(&events, 500).Error)

	page, err := QueryRecallMetric(context.Background(), model.RecallMetricQuery{CampaignID: campaign.Id, Metric: "messages_accepted", Limit: 1}, time.Now())
	require.NoError(t, err)
	require.EqualValues(t, 50_001, page.Total)
	require.Len(t, page.Items, 1)
	require.Equal(t, "accepted", page.Items[0].State)
}

func TestRecallMetricCardsShareRegistryQueryTotalsAndTokens(t *testing.T) {
	db := setupRecallMetricServiceDB(t)
	campaign := model.RecallCampaign{Name: "card parity", Status: model.RecallCampaignRunning}
	require.NoError(t, db.Create(&campaign).Error)
	direct := model.RecallRecipient{CampaignId: campaign.Id, UserId: 301, EligibilitySnapshot: `{}`, EmailSnapshot: "direct@example.com", LanguageSnapshot: "en", State: model.RecallRecipientConverted, ConversionKind: model.RecallConversionDirect, ConversionTradeNo: "trade_direct", ConversionCurrency: "usd", ConversionAmount: 1100}
	assisted := model.RecallRecipient{CampaignId: campaign.Id, UserId: 302, EligibilitySnapshot: `{}`, EmailSnapshot: "assist@example.com", LanguageSnapshot: "en", State: model.RecallRecipientConverted, ConversionKind: model.RecallConversionAssisted, ConversionTradeNo: "trade_assist", ConversionCurrency: "usd", ConversionAmount: 2200}
	queued := model.RecallRecipient{CampaignId: campaign.Id, UserId: 303, EligibilitySnapshot: `{}`, EmailSnapshot: "queued@example.com", LanguageSnapshot: "en", State: model.RecallRecipientQueued}
	require.NoError(t, db.Create(&direct).Error)
	require.NoError(t, db.Create(&assisted).Error)
	require.NoError(t, db.Create(&queued).Error)
	require.NoError(t, db.Create(&model.RecallEvent{CampaignId: campaign.Id, RecipientId: direct.Id, EventType: "conversion", Source: "test", SourceEventId: "conversion:direct", EventData: `{"trade_no":"trade_direct","conversion_kind":"direct","currency":"usd","amount_total":1100}`, CreatedAt: 101}).Error)
	require.NoError(t, db.Create(&model.RecallEvent{CampaignId: campaign.Id, RecipientId: assisted.Id, EventType: "conversion", Source: "test", SourceEventId: "conversion:assist", EventData: `{"trade_no":"trade_assist","conversion_kind":"assisted","currency":"usd","amount_total":2200}`, CreatedAt: 102}).Error)
	require.NoError(t, db.Create(&model.RecallEvent{CampaignId: campaign.Id, RecipientId: queued.Id, EventType: "email_open", Source: "test", SourceEventId: "open:queued", EventData: `{}`, CreatedAt: 103}).Error)
	require.NoError(t, db.Create(&model.RecallEvent{CampaignId: campaign.Id, RecipientId: queued.Id, EventType: "observed_click", Source: "test", SourceEventId: "click:queued", EventData: `{}`, CreatedAt: 104}).Error)

	require.NoError(t, db.Transaction(func(tx *gorm.DB) error {
		return model.CreateRecallMessagesWithStateEventsTx(tx, campaign.Id, []model.RecallMessage{
			{RecipientId: direct.Id, StageNo: 1, TemplateVersion: 1, TemplateSnapshot: "template", ScheduledAt: 100, State: model.RecallMessageAccepted},
			{RecipientId: assisted.Id, StageNo: 1, TemplateVersion: 1, TemplateSnapshot: "template", ScheduledAt: 100, State: model.RecallMessageFailed, LastErrorCode: "old"},
		}, 100)
	}))
	exclusion := model.RecallCampaignExclusion{CampaignId: campaign.Id, RecipientIdentity: model.RecallRecipientIdentityForUser(304), UserId: 304, FirstRunEventId: 1, LastRunEventId: 1, LastRunReasonCode: "suppressed", FirstSeenAt: 90, LastSeenAt: 90}
	require.NoError(t, db.Create(&exclusion).Error)

	metrics, err := NewRecallAttributionService(nil).GetMetrics(context.Background(), campaign.Id)
	require.NoError(t, err)
	require.Len(t, metrics.MetricCards, len(allRecallMetricKeys))

	late := model.RecallRecipient{CampaignId: campaign.Id, UserId: 399, EligibilitySnapshot: `{}`, EmailSnapshot: "late-card@example.com", LanguageSnapshot: "en", State: model.RecallRecipientQueued}
	require.NoError(t, db.Create(&late).Error)

	for _, key := range allRecallMetricKeys {
		card := metrics.MetricCards[string(key)]
		require.NotEmpty(t, card.SnapshotToken, "missing snapshot token for %s", key)
		require.NotEmpty(t, card.RowGrain, "missing row grain for %s", key)
		query := model.RecallMetricQuery{CampaignID: campaign.Id, Metric: key, Limit: 500}
		snapshot, err := VerifyRecallMetricSnapshotToken(card.SnapshotToken, query, card.RowGrain, time.Now())
		require.NoError(t, err, key)
		query.Snapshot = snapshot
		page, err := QueryRecallMetric(context.Background(), query, time.Now())
		require.NoError(t, err, key)
		require.Equal(t, page.Total, card.Total, "card total must match drawer total for %s", key)
		require.Equal(t, page.Amounts, card.Amounts, "card amounts must match drawer amounts for %s", key)
		var out bytes.Buffer
		_, err = ExportRecallMetricCSVWithLimits(context.Background(), &out, query, time.Now(), RecallMetricExportLimits{MaxRows: 500, MaxBytes: 100_000, BatchSize: 50})
		require.NoError(t, err, key)
		csvRows, err := csv.NewReader(bytes.NewReader(out.Bytes())).ReadAll()
		require.NoError(t, err, key)
		exportRowIDs := make([]int64, 0, len(csvRows)-1)
		for _, csvRow := range csvRows[1:] {
			rowID, err := strconv.ParseInt(csvRow[4], 10, 64)
			require.NoError(t, err, key)
			exportRowIDs = append(exportRowIDs, rowID)
		}
		drawerRowIDs := make([]int64, 0, len(page.Items))
		for _, item := range page.Items {
			drawerRowIDs = append(drawerRowIDs, item.RowID)
			require.NotEqual(t, late.Id, item.RecipientID, "post-card row leaked into %s", key)
		}
		require.Equal(t, drawerRowIDs, exportRowIDs, "export rows must match drawer rows for %s", key)
	}
}

func TestRecallMetricCardsFreshMessageSnapshotRetriesBeforePublishingCards(t *testing.T) {
	t.Run("version0", func(t *testing.T) {
		db := setupRecallMetricServiceDB(t)
		campaign := model.RecallCampaign{Name: "card message baseline readiness", Status: model.RecallCampaignRunning}
		require.NoError(t, db.Create(&campaign).Error)
		recipient := model.RecallRecipient{CampaignId: campaign.Id, UserId: 58_100, RecipientIdentity: model.RecallRecipientIdentityForUser(58_100), EligibilitySnapshot: `{}`, EmailSnapshot: "card-message-readiness@example.com", LanguageSnapshot: "en", State: model.RecallRecipientQueued}
		require.NoError(t, db.Create(&recipient).Error)
		message := model.RecallMessage{RecipientId: recipient.Id, StageNo: 1, TemplateVersion: 1, TemplateSnapshot: "template", ScheduledAt: 100, State: model.RecallMessageScheduled, StateVersion: 0}
		require.NoError(t, db.Create(&message).Error)

		metrics, err := NewRecallAttributionService(nil).GetMetrics(context.Background(), campaign.Id)
		require.ErrorIs(t, err, model.ErrRecallMetricRetry)
		require.Empty(t, metrics.MetricCards)
		require.Empty(t, metrics.MetricSnapshots)
	})

	t.Run("version3", func(t *testing.T) {
		db := setupRecallMetricServiceDB(t)
		campaign := model.RecallCampaign{Name: "card versioned message baseline readiness", Status: model.RecallCampaignRunning}
		require.NoError(t, db.Create(&campaign).Error)
		recipient := model.RecallRecipient{CampaignId: campaign.Id, UserId: 58_101, RecipientIdentity: model.RecallRecipientIdentityForUser(58_101), EligibilitySnapshot: `{}`, EmailSnapshot: "card-versioned-message-readiness@example.com", LanguageSnapshot: "en", State: model.RecallRecipientQueued}
		require.NoError(t, db.Create(&recipient).Error)
		message := model.RecallMessage{RecipientId: recipient.Id, StageNo: 1, TemplateVersion: 1, TemplateSnapshot: "template", ScheduledAt: 100, State: model.RecallMessageAccepted, StateVersion: 3, AcceptedAt: 200}
		require.NoError(t, db.Create(&message).Error)

		metrics, err := NewRecallAttributionService(nil).GetMetrics(context.Background(), campaign.Id)
		require.ErrorIs(t, err, model.ErrRecallMetricRetry)
		require.Empty(t, metrics.MetricCards)
		require.Empty(t, metrics.MetricSnapshots)

		reconciled, err := model.ReconcileRecallMessageStateEventBaseline(context.Background(), 10)
		require.NoError(t, err)
		require.Equal(t, 1, reconciled)

		metrics, err = NewRecallAttributionService(nil).GetMetrics(context.Background(), campaign.Id)
		require.NoError(t, err)
		card := metrics.MetricCards["messages_accepted"]
		require.EqualValues(t, 1, card.Total)

		page, err := QueryRecallMetric(context.Background(), model.RecallMetricQuery{CampaignID: campaign.Id, Metric: "messages_accepted", Limit: 10}, time.Now())
		require.NoError(t, err)
		require.EqualValues(t, 1, page.Total)
		require.Len(t, page.Items, 1)
		require.Equal(t, recipient.Id, page.Items[0].RecipientID)
	})
}

func TestRecallMetricCursorRequiresMatchingSnapshot(t *testing.T) {
	db := setupRecallMetricServiceDB(t)
	campaign := model.RecallCampaign{Name: "cursor snapshot", Status: model.RecallCampaignRunning}
	require.NoError(t, db.Create(&campaign).Error)
	for i := 0; i < 2; i++ {
		recipient := model.RecallRecipient{CampaignId: campaign.Id, UserId: 401 + i, EligibilitySnapshot: `{}`, EmailSnapshot: "cursor@example.com", LanguageSnapshot: "en", State: model.RecallRecipientQueued}
		require.NoError(t, db.Create(&recipient).Error)
	}
	now := time.Now()
	page, err := QueryRecallMetric(context.Background(), model.RecallMetricQuery{CampaignID: campaign.Id, Metric: "enrolled", Limit: 1}, now)
	require.NoError(t, err)
	require.NotEmpty(t, page.NextCursor)

	query := model.RecallMetricQuery{CampaignID: campaign.Id, Metric: "enrolled", Snapshot: page.Snapshot}
	_, err = VerifyRecallMetricCursorToken(page.NextCursor, query, "identity", now)
	require.NoError(t, err)
	query.Snapshot.RecipientMaxID++
	_, err = VerifyRecallMetricCursorToken(page.NextCursor, query, "identity", now)
	require.ErrorIs(t, err, ErrRecallMetricStaleSnapshot)
}

func TestRecallMetricExportHonorsRowAndByteCeilings(t *testing.T) {
	db := setupRecallMetricServiceDB(t)
	campaign := model.RecallCampaign{Name: "export ceilings", Status: model.RecallCampaignRunning}
	require.NoError(t, db.Create(&campaign).Error)
	for i := 0; i < 3; i++ {
		recipient := model.RecallRecipient{CampaignId: campaign.Id, UserId: 501 + i, EligibilitySnapshot: `{}`, EmailSnapshot: "export@example.com", LanguageSnapshot: "en", State: model.RecallRecipientQueued}
		require.NoError(t, db.Create(&recipient).Error)
	}

	var out bytes.Buffer
	result, err := ExportRecallMetricCSVWithLimits(context.Background(), &out, model.RecallMetricQuery{CampaignID: campaign.Id, Metric: "enrolled", Limit: 1}, time.Now(), RecallMetricExportLimits{MaxRows: 2, MaxBytes: 10_000, BatchSize: 1})
	require.NoError(t, err)
	require.True(t, result.Truncated)
	require.EqualValues(t, 2, result.Rows)
	require.Contains(t, out.String(), "# truncated=true")

	out.Reset()
	result, err = ExportRecallMetricCSVWithLimits(context.Background(), &out, model.RecallMetricQuery{CampaignID: campaign.Id, Metric: "enrolled", Limit: 3}, time.Now(), RecallMetricExportLimits{MaxRows: 10, MaxBytes: 260, BatchSize: 3})
	require.NoError(t, err)
	require.True(t, result.Truncated)
	require.LessOrEqual(t, result.Bytes, int64(260))
	require.LessOrEqual(t, int64(out.Len()), int64(260))
	require.Contains(t, out.String(), "# truncated=true reason=byte_limit")
}

func TestRecallMetricExportUsesSingleMetricQueryForAllRows(t *testing.T) {
	db := setupRecallMetricServiceDB(t)
	campaign := model.RecallCampaign{Name: "export single query", Status: model.RecallCampaignRunning}
	require.NoError(t, db.Create(&campaign).Error)
	for i := 0; i < 4; i++ {
		recipient := model.RecallRecipient{CampaignId: campaign.Id, UserId: 551 + i, RecipientIdentity: model.RecallRecipientIdentityForUser(551 + i), EligibilitySnapshot: `{}`, EmailSnapshot: "single-export@example.com", LanguageSnapshot: "en", State: model.RecallRecipientQueued}
		require.NoError(t, db.Create(&recipient).Error)
	}
	snapshot, err := model.CaptureRecallMetricSnapshot(context.Background(), campaign.Id)
	require.NoError(t, err)
	queries := captureServiceRecallMetricSQL(t, db)

	var out bytes.Buffer
	result, err := ExportRecallMetricCSVWithLimits(context.Background(), &out, model.RecallMetricQuery{CampaignID: campaign.Id, Metric: "enrolled", Snapshot: snapshot, Limit: 1}, time.Now(), RecallMetricExportLimits{MaxRows: 3, MaxBytes: 10_000, BatchSize: 1})
	require.NoError(t, err)
	require.True(t, result.Truncated)
	require.EqualValues(t, 3, result.Rows)

	metricQueries := 0
	for _, query := range *queries {
		if strings.Contains(query.SQL, "from recall_recipients") && strings.Contains(query.SQL, "order by created_at asc") {
			metricQueries++
		}
	}
	require.LessOrEqual(t, metricQueries, 1)
}

func TestRecallMetricExportLeavesWriterEmptyOnInitialQueryError(t *testing.T) {
	var out bytes.Buffer
	_, err := ExportRecallMetricCSVWithLimits(context.Background(), &out, model.RecallMetricQuery{CampaignID: 1, Metric: "not_a_metric", Limit: 10}, time.Now(), RecallMetricExportLimits{MaxRows: 10, MaxBytes: 10_000, BatchSize: 10})
	require.Error(t, err)
	require.Empty(t, out.String())
}

func TestRecallMetricExportDoesNotMaterializeRowLimitPlusOneInSinglePage(t *testing.T) {
	db := setupRecallMetricServiceDB(t)
	campaign := model.RecallCampaign{Name: "export bounded scan", Status: model.RecallCampaignRunning}
	require.NoError(t, db.Create(&campaign).Error)
	recipients := make([]model.RecallRecipient, 501)
	for i := range recipients {
		userID := 55_100 + i
		recipients[i] = model.RecallRecipient{CampaignId: campaign.Id, UserId: userID, RecipientIdentity: model.RecallRecipientIdentityForUser(userID), EligibilitySnapshot: `{}`, EmailSnapshot: "bounded-export@example.com", LanguageSnapshot: "en", State: model.RecallRecipientQueued}
	}
	require.NoError(t, db.CreateInBatches(&recipients, 100).Error)
	queries := captureServiceRecallMetricSQL(t, db)

	var out bytes.Buffer
	result, err := ExportRecallMetricCSVWithLimits(context.Background(), &out, model.RecallMetricQuery{CampaignID: campaign.Id, Metric: "enrolled", Limit: 1}, time.Now(), RecallMetricExportLimits{MaxRows: 500, MaxBytes: 1_000_000, BatchSize: 50})
	require.NoError(t, err)
	require.True(t, result.Truncated)
	require.EqualValues(t, 500, result.Rows)
	require.Contains(t, out.String(), "# truncated=true reason=row_limit")

	for _, query := range *queries {
		require.NotContains(t, query.SQL, "limit 501", "export must scan in bounded batches, not materialize MaxRows+1")
	}
}

func TestRecallMetricExportWritesRowLimitMarkerOnlyAfterMaxRowsPlusOne(t *testing.T) {
	db := setupRecallMetricServiceDB(t)
	campaign := model.RecallCampaign{Name: "export row limit boundary", Status: model.RecallCampaignRunning}
	require.NoError(t, db.Create(&campaign).Error)
	for i := 0; i < 3; i++ {
		userID := 56_100 + i
		recipient := model.RecallRecipient{CampaignId: campaign.Id, UserId: userID, RecipientIdentity: model.RecallRecipientIdentityForUser(userID), EligibilitySnapshot: `{}`, EmailSnapshot: "row-limit-" + strconv.Itoa(i) + "@example.com", LanguageSnapshot: "en", State: model.RecallRecipientQueued}
		require.NoError(t, db.Create(&recipient).Error)
	}

	var out bytes.Buffer
	result, err := ExportRecallMetricCSVWithLimits(context.Background(), &out, model.RecallMetricQuery{CampaignID: campaign.Id, Metric: "enrolled", Limit: 1}, time.Now(), RecallMetricExportLimits{MaxRows: 3, MaxBytes: 10_000, BatchSize: 1})
	require.NoError(t, err)
	require.False(t, result.Truncated)
	require.EqualValues(t, 3, result.Rows)
	require.NotContains(t, out.String(), "# truncated=true reason=row_limit")

	recipient := model.RecallRecipient{CampaignId: campaign.Id, UserId: 56_200, RecipientIdentity: model.RecallRecipientIdentityForUser(56_200), EligibilitySnapshot: `{}`, EmailSnapshot: "row-limit-extra@example.com", LanguageSnapshot: "en", State: model.RecallRecipientQueued}
	require.NoError(t, db.Create(&recipient).Error)
	out.Reset()
	result, err = ExportRecallMetricCSVWithLimits(context.Background(), &out, model.RecallMetricQuery{CampaignID: campaign.Id, Metric: "enrolled", Limit: 1}, time.Now(), RecallMetricExportLimits{MaxRows: 3, MaxBytes: 10_000, BatchSize: 1})
	require.NoError(t, err)
	require.True(t, result.Truncated)
	require.EqualValues(t, 3, result.Rows)
	require.Contains(t, out.String(), "# truncated=true reason=row_limit")
}

func TestRecallMetricExportLeavesWriterEmptyOnInitialDBQueryError(t *testing.T) {
	db := setupRecallMetricServiceDB(t)
	campaign := model.RecallCampaign{Name: "export initial db error", Status: model.RecallCampaignRunning}
	require.NoError(t, db.Create(&campaign).Error)
	require.NoError(t, db.Migrator().DropTable(&model.RecallRecipient{}))

	var out bytes.Buffer
	_, err := ExportRecallMetricCSVWithLimits(context.Background(), &out, model.RecallMetricQuery{CampaignID: campaign.Id, Metric: "enrolled", Limit: 10}, time.Now(), RecallMetricExportLimits{MaxRows: 10, MaxBytes: 10_000, BatchSize: 10})
	require.Error(t, err)
	require.Empty(t, out.String())
}

func TestRecallMetricExportFreshMessageSnapshotRetriesBeforeWritingCSV(t *testing.T) {
	t.Run("version0", func(t *testing.T) {
		db := setupRecallMetricServiceDB(t)
		campaign := model.RecallCampaign{Name: "export message baseline readiness", Status: model.RecallCampaignRunning}
		require.NoError(t, db.Create(&campaign).Error)
		recipient := model.RecallRecipient{CampaignId: campaign.Id, UserId: 57_100, RecipientIdentity: model.RecallRecipientIdentityForUser(57_100), EligibilitySnapshot: `{}`, EmailSnapshot: "export-message-readiness@example.com", LanguageSnapshot: "en", State: model.RecallRecipientQueued}
		require.NoError(t, db.Create(&recipient).Error)
		message := model.RecallMessage{RecipientId: recipient.Id, StageNo: 1, TemplateVersion: 1, TemplateSnapshot: "template", ScheduledAt: 100, State: model.RecallMessageScheduled, StateVersion: 0}
		require.NoError(t, db.Create(&message).Error)

		var out bytes.Buffer
		_, err := ExportRecallMetricCSVWithLimits(context.Background(), &out, model.RecallMetricQuery{CampaignID: campaign.Id, Metric: "messages_accepted", Limit: 10}, time.Now(), RecallMetricExportLimits{MaxRows: 10, MaxBytes: 10_000, BatchSize: 10})
		require.ErrorIs(t, err, model.ErrRecallMetricRetry)
		require.Empty(t, out.String())
	})

	t.Run("version3", func(t *testing.T) {
		db := setupRecallMetricServiceDB(t)
		campaign := model.RecallCampaign{Name: "export versioned message baseline readiness", Status: model.RecallCampaignRunning}
		require.NoError(t, db.Create(&campaign).Error)
		recipient := model.RecallRecipient{CampaignId: campaign.Id, UserId: 57_101, RecipientIdentity: model.RecallRecipientIdentityForUser(57_101), EligibilitySnapshot: `{}`, EmailSnapshot: "export-versioned-message-readiness@example.com", LanguageSnapshot: "en", State: model.RecallRecipientQueued}
		require.NoError(t, db.Create(&recipient).Error)
		message := model.RecallMessage{RecipientId: recipient.Id, StageNo: 1, TemplateVersion: 1, TemplateSnapshot: "template", ScheduledAt: 100, State: model.RecallMessageAccepted, StateVersion: 3, AcceptedAt: 200}
		require.NoError(t, db.Create(&message).Error)

		var out bytes.Buffer
		_, err := ExportRecallMetricCSVWithLimits(context.Background(), &out, model.RecallMetricQuery{CampaignID: campaign.Id, Metric: "messages_accepted", Limit: 10}, time.Now(), RecallMetricExportLimits{MaxRows: 10, MaxBytes: 10_000, BatchSize: 10})
		require.ErrorIs(t, err, model.ErrRecallMetricRetry)
		require.Empty(t, out.String())

		reconciled, err := model.ReconcileRecallMessageStateEventBaseline(context.Background(), 10)
		require.NoError(t, err)
		require.Equal(t, 1, reconciled)

		_, err = ExportRecallMetricCSVWithLimits(context.Background(), &out, model.RecallMetricQuery{CampaignID: campaign.Id, Metric: "messages_accepted", Limit: 10}, time.Now(), RecallMetricExportLimits{MaxRows: 10, MaxBytes: 10_000, BatchSize: 10})
		require.NoError(t, err)
		rows, err := csv.NewReader(strings.NewReader(out.String())).ReadAll()
		require.NoError(t, err)
		require.Len(t, rows, 2)
		require.Contains(t, rows[1], "export-versioned-message-readiness@example.com")
	})
}

func TestRecallMetricExportDoesNotSilentlyClampAtPublicPageLimit(t *testing.T) {
	db := setupRecallMetricServiceDB(t)
	campaign := model.RecallCampaign{Name: "export over public page limit", Status: model.RecallCampaignRunning}
	require.NoError(t, db.Create(&campaign).Error)
	recipients := make([]model.RecallRecipient, 501)
	for i := range recipients {
		userID := 771_000 + i
		recipients[i] = model.RecallRecipient{CampaignId: campaign.Id, UserId: userID, RecipientIdentity: model.RecallRecipientIdentityForUser(userID), EligibilitySnapshot: `{}`, EmailSnapshot: "export-large-" + strconv.Itoa(i) + "@example.com", LanguageSnapshot: "en", State: model.RecallRecipientQueued}
	}
	require.NoError(t, db.CreateInBatches(&recipients, 200).Error)

	var out bytes.Buffer
	result, err := ExportRecallMetricCSVWithLimits(context.Background(), &out, model.RecallMetricQuery{CampaignID: campaign.Id, Metric: "enrolled", Limit: 1}, time.Now(), RecallMetricExportLimits{MaxRows: 600, MaxBytes: 1_000_000, BatchSize: 600})
	require.NoError(t, err)
	require.False(t, result.Truncated)
	require.EqualValues(t, 501, result.Rows)

	csvRows, err := csv.NewReader(strings.NewReader(out.String())).ReadAll()
	require.NoError(t, err)
	require.Len(t, csvRows, 502)
}

func TestRecallMetricSnapshotExcludesPostSnapshotConversionMutation(t *testing.T) {
	db := setupRecallMetricServiceDB(t)
	campaign := model.RecallCampaign{Name: "conversion freeze", Status: model.RecallCampaignRunning}
	require.NoError(t, db.Create(&campaign).Error)
	recipient := model.RecallRecipient{CampaignId: campaign.Id, UserId: 601, EligibilitySnapshot: `{}`, EmailSnapshot: "freeze@example.com", LanguageSnapshot: "en", State: model.RecallRecipientQueued}
	require.NoError(t, db.Create(&recipient).Error)
	page, err := QueryRecallMetric(context.Background(), model.RecallMetricQuery{CampaignID: campaign.Id, Metric: "enrolled", Limit: 10}, time.Now())
	require.NoError(t, err)

	require.NoError(t, db.Create(&model.RecallEvent{CampaignId: campaign.Id, RecipientId: recipient.Id, EventType: "conversion", Source: "test", SourceEventId: "conversion:late", EventData: `{}`, CreatedAt: 120}).Error)
	require.NoError(t, db.Model(&model.RecallRecipient{}).Where("id = ?", recipient.Id).Updates(map[string]any{
		"state":               model.RecallRecipientConverted,
		"converted_at":        int64(120),
		"conversion_kind":     model.RecallConversionDirect,
		"conversion_trade_no": "late_trade",
		"conversion_currency": "USD",
		"conversion_amount":   int64(999),
	}).Error)

	frozen, err := QueryRecallMetric(context.Background(), model.RecallMetricQuery{CampaignID: campaign.Id, Metric: "direct_conversions", Snapshot: page.Snapshot, Limit: 10}, time.Now())
	require.NoError(t, err)
	require.Zero(t, frozen.Total)
}

func TestRecallMetricConversionRowsUseImmutableEventData(t *testing.T) {
	db := setupRecallMetricServiceDB(t)
	campaign := model.RecallCampaign{Name: "conversion event data", Status: model.RecallCampaignRunning}
	require.NoError(t, db.Create(&campaign).Error)
	recipient := model.RecallRecipient{CampaignId: campaign.Id, UserId: 611, EligibilitySnapshot: `{}`, EmailSnapshot: "event-data@example.com", LanguageSnapshot: "en", State: model.RecallRecipientConverted, ConversionKind: model.RecallConversionAssisted, ConversionTradeNo: "mutated_trade", ConversionCurrency: "EUR", ConversionAmount: 999}
	require.NoError(t, db.Create(&recipient).Error)
	eventData := `{"conversion_kind":"direct","trade_no":"snap_trade","currency":"usd","amount_total":123,"payment_category":"direct_topup"}`
	require.NoError(t, db.Create(&model.RecallEvent{CampaignId: campaign.Id, RecipientId: recipient.Id, EventType: "conversion", Source: "test", SourceEventId: "conversion:event-data", EventData: eventData, CreatedAt: 120}).Error)

	page, err := QueryRecallMetric(context.Background(), model.RecallMetricQuery{CampaignID: campaign.Id, Metric: "direct_conversions", Limit: 10}, time.Now())
	require.NoError(t, err)
	require.EqualValues(t, 1, page.Total)
	require.Equal(t, "snap_trade", page.Items[0].TradeNo)
	require.Equal(t, "USD", page.Items[0].Currency)
	require.EqualValues(t, 123, page.Items[0].AmountMinor)
	require.Equal(t, []RecallMetricAmount{{Currency: "USD", AmountMinor: 123, UserCount: 1}}, page.Amounts)
}

func TestRecallMetricZeroAmountConversionAggregatesKnownCurrencyAndPreservesMissingCurrencySemantics(t *testing.T) {
	db := setupRecallMetricServiceDB(t)
	campaign := model.RecallCampaign{Name: "zero conversion amount", Status: model.RecallCampaignRunning}
	require.NoError(t, db.Create(&campaign).Error)
	recipient := model.RecallRecipient{CampaignId: campaign.Id, UserId: 612, EligibilitySnapshot: `{}`, EmailSnapshot: "zero-amount@example.com", LanguageSnapshot: "en", State: model.RecallRecipientConverted}
	require.NoError(t, db.Create(&recipient).Error)
	eventData := `{"conversion_kind":"direct","trade_no":"zero_trade","currency":"usd","amount_total":0,"payment_category":"direct_topup"}`
	require.NoError(t, db.Create(&model.RecallEvent{CampaignId: campaign.Id, RecipientId: recipient.Id, EventType: "conversion", Source: "test", SourceEventId: "conversion:zero-amount", EventData: eventData, CreatedAt: 120}).Error)
	missingCurrencyRecipient := model.RecallRecipient{CampaignId: campaign.Id, UserId: 613, EligibilitySnapshot: `{}`, EmailSnapshot: "zero-amount-missing-currency@example.com", LanguageSnapshot: "en", State: model.RecallRecipientConverted}
	require.NoError(t, db.Create(&missingCurrencyRecipient).Error)
	missingCurrencyEventData := `{"conversion_kind":"direct","trade_no":"zero_trade_missing_currency","amount_total":0,"payment_category":"direct_topup"}`
	require.NoError(t, db.Create(&model.RecallEvent{CampaignId: campaign.Id, RecipientId: missingCurrencyRecipient.Id, EventType: "conversion", Source: "test", SourceEventId: "conversion:zero-amount-missing-currency", EventData: missingCurrencyEventData, CreatedAt: 121}).Error)
	unknownCurrencyRecipient := model.RecallRecipient{CampaignId: campaign.Id, UserId: 614, EligibilitySnapshot: `{}`, EmailSnapshot: "nonzero-amount-missing-currency@example.com", LanguageSnapshot: "en", State: model.RecallRecipientConverted}
	require.NoError(t, db.Create(&unknownCurrencyRecipient).Error)
	unknownCurrencyEventData := `{"conversion_kind":"direct","trade_no":"nonzero_trade_missing_currency","amount_total":500,"payment_category":"direct_topup"}`
	require.NoError(t, db.Create(&model.RecallEvent{CampaignId: campaign.Id, RecipientId: unknownCurrencyRecipient.Id, EventType: "conversion", Source: "test", SourceEventId: "conversion:nonzero-amount-missing-currency", EventData: unknownCurrencyEventData, CreatedAt: 122}).Error)

	page, err := QueryRecallMetric(context.Background(), model.RecallMetricQuery{CampaignID: campaign.Id, Metric: "direct_conversions", Limit: 10}, time.Now())
	require.NoError(t, err)
	require.EqualValues(t, 3, page.Total)
	require.EqualValues(t, 0, page.Items[0].AmountMinor)
	require.Equal(t, []RecallMetricAmount{
		{Currency: "UNKNOWN", AmountMinor: 500, UserCount: 1},
		{Currency: "USD", AmountMinor: 0, UserCount: 1},
	}, page.Amounts)
}

func TestRecallMetricLargeConversionSnapshotDoesNotMaterializeFail(t *testing.T) {
	db := setupRecallMetricServiceDB(t)
	campaign := model.RecallCampaign{Name: "large conversions", Status: model.RecallCampaignRunning}
	require.NoError(t, db.Create(&campaign).Error)
	recipients := make([]model.RecallRecipient, 50_001)
	for i := range recipients {
		userID := 930_000 + i
		recipients[i] = model.RecallRecipient{CampaignId: campaign.Id, UserId: userID, RecipientIdentity: model.RecallRecipientIdentityForUser(userID), EligibilitySnapshot: `{}`, EmailSnapshot: "conversion-large-" + strconv.Itoa(i) + "@example.com", LanguageSnapshot: "en", State: model.RecallRecipientConverted}
	}
	require.NoError(t, db.CreateInBatches(&recipients, 500).Error)
	events := make([]model.RecallEvent, len(recipients))
	for i, recipient := range recipients {
		events[i] = model.RecallEvent{CampaignId: campaign.Id, RecipientId: recipient.Id, EventType: "conversion", Source: "test", SourceEventId: "conversion-large:" + strconv.Itoa(i), EventData: `{"trade_no":"conversion_large_` + strconv.Itoa(i) + `","conversion_kind":"direct","currency":"usd","amount_total":1,"payment_category":"direct_topup"}`, CreatedAt: int64(100 + i)}
	}
	require.NoError(t, db.CreateInBatches(&events, 500).Error)

	page, err := QueryRecallMetric(context.Background(), model.RecallMetricQuery{CampaignID: campaign.Id, Metric: "attributed_spend", Limit: 1}, time.Now())
	require.NoError(t, err)
	require.EqualValues(t, 50_001, page.Total)
	require.Len(t, page.Items, 1)
	require.Equal(t, []RecallMetricAmount{{Currency: "USD", AmountMinor: 50_001, UserCount: 50_001}}, page.Amounts)
}

func TestRecallMetricConversionRowsUseOneRepresentativeEventPerRecipient(t *testing.T) {
	db := setupRecallMetricServiceDB(t)
	campaign := model.RecallCampaign{Name: "conversion dedupe", Status: model.RecallCampaignRunning}
	require.NoError(t, db.Create(&campaign).Error)
	recipient := model.RecallRecipient{CampaignId: campaign.Id, UserId: 631, RecipientIdentity: model.RecallRecipientIdentityForUser(631), EligibilitySnapshot: `{}`, EmailSnapshot: "conversion-dedupe@example.com", LanguageSnapshot: "en", State: model.RecallRecipientConverted}
	require.NoError(t, db.Create(&recipient).Error)
	require.NoError(t, db.Create(&model.RecallEvent{CampaignId: campaign.Id, RecipientId: recipient.Id, EventType: "conversion", Source: "test", SourceEventId: "conversion-dedupe:first", EventData: `{"trade_no":"dedupe_first","conversion_kind":"direct","currency":"usd","amount_total":100,"payment_category":"direct_topup"}`, CreatedAt: 100}).Error)
	require.NoError(t, db.Create(&model.RecallEvent{CampaignId: campaign.Id, RecipientId: recipient.Id, EventType: "conversion", Source: "test", SourceEventId: "conversion-dedupe:second", EventData: `{"trade_no":"dedupe_second","conversion_kind":"direct","currency":"usd","amount_total":900,"payment_category":"direct_topup"}`, CreatedAt: 101}).Error)

	page, err := QueryRecallMetric(context.Background(), model.RecallMetricQuery{CampaignID: campaign.Id, Metric: "attributed_spend", Limit: 10}, time.Now())
	require.NoError(t, err)
	require.EqualValues(t, 1, page.Total)
	require.Equal(t, "dedupe_first", page.Items[0].TradeNo)
	require.Equal(t, []RecallMetricAmount{{Currency: "USD", AmountMinor: 100, UserCount: 1}}, page.Amounts)
}

func TestRecallMetricLegacyConversionMissingCategoryDoesNotDriftAfterPaymentFactInsert(t *testing.T) {
	db := setupRecallMetricServiceDB(t)
	campaign := model.RecallCampaign{Name: "legacy conversion stable", Status: model.RecallCampaignRunning}
	require.NoError(t, db.Create(&campaign).Error)
	recipient := model.RecallRecipient{CampaignId: campaign.Id, UserId: 621, RecipientIdentity: model.RecallRecipientIdentityForUser(621), EligibilitySnapshot: `{}`, EmailSnapshot: "legacy-category@example.com", LanguageSnapshot: "en", State: model.RecallRecipientConverted}
	require.NoError(t, db.Create(&recipient).Error)
	require.NoError(t, db.Create(&model.RecallEvent{CampaignId: campaign.Id, RecipientId: recipient.Id, EventType: "conversion", Source: "test", SourceEventId: "legacy-category", EventData: `{"trade_no":"legacy_category_trade","conversion_kind":"direct","currency":"usd","amount_total":500}`, CreatedAt: 120}).Error)
	page, err := QueryRecallMetric(context.Background(), model.RecallMetricQuery{CampaignID: campaign.Id, Metric: "direct_topup", Limit: 10}, time.Now())
	require.NoError(t, err)
	require.Zero(t, page.Total)

	require.NoError(t, db.Create(&model.TopUp{UserId: recipient.UserId, TradeNo: "legacy_category_trade", Status: common.TopUpStatusSuccess, CompleteTime: page.Snapshot.AsOf, PaymentAmountMinor: 500, PaymentCurrency: "USD"}).Error)
	frozen, err := QueryRecallMetric(context.Background(), model.RecallMetricQuery{CampaignID: campaign.Id, Metric: "direct_topup", Snapshot: page.Snapshot, Limit: 10}, time.Now())
	require.NoError(t, err)
	require.Zero(t, frozen.Total)
	attributed, err := QueryRecallMetric(context.Background(), model.RecallMetricQuery{CampaignID: campaign.Id, Metric: "attributed_spend", Snapshot: page.Snapshot, Limit: 10}, time.Now())
	require.NoError(t, err)
	require.EqualValues(t, 1, attributed.Total)
	require.Equal(t, "unclassified", attributed.Items[0].PaymentCategory)
}

func TestRecallMetricPaymentFallbackLooksUpOnlyMissingEventCategories(t *testing.T) {
	db := setupRecallMetricServiceDB(t)
	campaign := model.RecallCampaign{Name: "payment fallback scoped", Status: model.RecallCampaignRunning}
	require.NoError(t, db.Create(&campaign).Error)
	explicitRecipient := model.RecallRecipient{CampaignId: campaign.Id, UserId: 641, RecipientIdentity: model.RecallRecipientIdentityForUser(641), EligibilitySnapshot: `{}`, EmailSnapshot: "explicit-category@example.com", LanguageSnapshot: "en", State: model.RecallRecipientConverted}
	missingRecipient := model.RecallRecipient{CampaignId: campaign.Id, UserId: 642, RecipientIdentity: model.RecallRecipientIdentityForUser(642), EligibilitySnapshot: `{}`, EmailSnapshot: "missing-category@example.com", LanguageSnapshot: "en", State: model.RecallRecipientConverted}
	require.NoError(t, db.Create(&explicitRecipient).Error)
	require.NoError(t, db.Create(&missingRecipient).Error)
	explicitEventData, err := common.Marshal(map[string]any{
		"trade_no":         "explicit_trade",
		"conversion_kind":  "direct",
		"currency":         "usd",
		"amount_total":     700,
		"payment_category": "online_subscription",
	})
	require.NoError(t, err)
	missingEventData, err := common.Marshal(map[string]any{
		"trade_no":        "missing_trade",
		"conversion_kind": "direct",
		"currency":        "usd",
		"amount_total":    500,
	})
	require.NoError(t, err)
	require.NoError(t, db.Create(&model.RecallEvent{CampaignId: campaign.Id, RecipientId: explicitRecipient.Id, EventType: "conversion", Source: "test", SourceEventId: "conversion:explicit-category", EventData: string(explicitEventData), CreatedAt: 120}).Error)
	require.NoError(t, db.Create(&model.RecallEvent{CampaignId: campaign.Id, RecipientId: missingRecipient.Id, EventType: "conversion", Source: "test", SourceEventId: "conversion:missing-category", EventData: string(missingEventData), CreatedAt: 121}).Error)
	require.NoError(t, db.Create(&model.TopUp{UserId: explicitRecipient.UserId, TradeNo: "explicit_trade", Status: common.TopUpStatusSuccess, CompleteTime: 122, PaymentAmountMinor: 700, PaymentCurrency: "USD"}).Error)
	require.NoError(t, db.Create(&model.TopUp{UserId: missingRecipient.UserId, TradeNo: "missing_trade", Status: common.TopUpStatusSuccess, CompleteTime: 122, PaymentAmountMinor: 500, PaymentCurrency: "USD"}).Error)

	queries := captureServiceRecallMetricSQL(t, db)
	page, err := QueryRecallMetric(context.Background(), model.RecallMetricQuery{CampaignID: campaign.Id, Metric: "attributed_spend", Limit: 10}, time.Now())
	captured := *queries
	require.NoError(t, err)
	require.EqualValues(t, 2, page.Total)
	categoriesByTradeNo := map[string]string{}
	for _, item := range page.Items {
		categoriesByTradeNo[item.TradeNo] = item.PaymentCategory
	}
	require.Equal(t, "online_subscription", categoriesByTradeNo["explicit_trade"])
	require.Equal(t, "direct_topup", categoriesByTradeNo["missing_trade"])
	for _, query := range captured {
		normalized := normalizeServiceRecallMetricSQL(query.SQL)
		if strings.Contains(normalized, "from top_ups") || strings.Contains(normalized, "from subscription_orders") {
			require.False(t, serviceRecallMetricSQLVarsContain(query.Vars, "explicit_trade"), "explicit event category should not be part of fallback lookup: %s vars=%v", normalized, query.Vars)
			require.True(t, serviceRecallMetricSQLVarsContain(query.Vars, "missing_trade"), "missing event category should be part of fallback lookup: %s vars=%v", normalized, query.Vars)
		}
	}
}

func TestRecallMetricExclusionsUseImmutableFirstSeenFields(t *testing.T) {
	db := setupRecallMetricServiceDB(t)
	campaign := model.RecallCampaign{Name: "exclusion immutable", Status: model.RecallCampaignRunning}
	require.NoError(t, db.Create(&campaign).Error)
	require.NoError(t, db.Create(&model.RecallEvent{CampaignId: campaign.Id, EventType: "campaign_run", Source: "test", SourceEventId: "run:exclusion", EventData: `{"identity_ledger_complete":true}`, CreatedAt: 100}).Error)
	exclusion := model.RecallCampaignExclusion{CampaignId: campaign.Id, RecipientIdentity: model.RecallRecipientIdentityForUser(701), UserId: 701, PersistentReasonCode: "first_reason", LastRunReasonCode: "last_reason", FirstRunEventId: 1, LastRunEventId: 1, FirstSeenAt: 100, LastSeenAt: 999}
	require.NoError(t, db.Create(&exclusion).Error)

	page, err := QueryRecallMetric(context.Background(), model.RecallMetricQuery{CampaignID: campaign.Id, Metric: "excluded", Limit: 10}, time.Now())
	require.NoError(t, err)
	require.EqualValues(t, 1, page.Total)
	require.EqualValues(t, 100, page.Items[0].OccurredAt)
	require.Empty(t, page.Items[0].State)
}

func TestRecallMetricIdentitySnapshotsDoNotDriftAfterMutableUpdates(t *testing.T) {
	db := setupRecallMetricServiceDB(t)
	campaign := model.RecallCampaign{Name: "identity immutable", Status: model.RecallCampaignRunning}
	require.NoError(t, db.Create(&campaign).Error)
	recipient := model.RecallRecipient{CampaignId: campaign.Id, UserId: 711, RecipientIdentity: model.RecallRecipientIdentityForUser(711), EligibilitySnapshot: `{}`, EmailSnapshot: "identity-stable@example.com", LanguageSnapshot: "en", State: model.RecallRecipientQueued, CreatedAt: 100}
	require.NoError(t, db.Create(&recipient).Error)
	require.NoError(t, db.Create(&model.RecallEvent{CampaignId: campaign.Id, EventType: "campaign_run", Source: "test", SourceEventId: "run:identity", EventData: `{"identity_ledger_complete":true}`, CreatedAt: 100}).Error)
	exclusion := model.RecallCampaignExclusion{CampaignId: campaign.Id, RecipientIdentity: model.RecallRecipientIdentityForUser(712), UserId: 712, PersistentReasonCode: "original", LastRunReasonCode: "original_last", FirstRunEventId: 1, LastRunEventId: 1, FirstSeenAt: 90, LastSeenAt: 90}
	require.NoError(t, db.Create(&exclusion).Error)

	enrolled, err := QueryRecallMetric(context.Background(), model.RecallMetricQuery{CampaignID: campaign.Id, Metric: "enrolled", Limit: 10}, time.Now())
	require.NoError(t, err)
	excluded, err := QueryRecallMetric(context.Background(), model.RecallMetricQuery{CampaignID: campaign.Id, Metric: "excluded", Limit: 10}, time.Now())
	require.NoError(t, err)

	require.NoError(t, db.Model(&model.RecallRecipient{}).Where("id = ?", recipient.Id).Update("state", model.RecallRecipientConverted).Error)
	require.NoError(t, db.Model(&model.RecallCampaignExclusion{}).Where("id = ?", exclusion.Id).Updates(map[string]any{
		"persistent_reason_code": "mutated",
		"last_run_reason_code":   "mutated_last",
		"last_seen_at":           int64(999),
	}).Error)

	enrolledFrozen, err := QueryRecallMetric(context.Background(), model.RecallMetricQuery{CampaignID: campaign.Id, Metric: "enrolled", Snapshot: enrolled.Snapshot, Limit: 10}, time.Now())
	require.NoError(t, err)
	require.EqualValues(t, 1, enrolledFrozen.Total)
	require.Len(t, enrolledFrozen.Items, 1)
	require.Empty(t, enrolledFrozen.Items[0].State)

	excludedFrozen, err := QueryRecallMetric(context.Background(), model.RecallMetricQuery{CampaignID: campaign.Id, Metric: "excluded", Snapshot: excluded.Snapshot, Limit: 10}, time.Now())
	require.NoError(t, err)
	require.EqualValues(t, 1, excludedFrozen.Total)
	require.Len(t, excludedFrozen.Items, 1)
	require.EqualValues(t, 90, excludedFrozen.Items[0].OccurredAt)
	require.Empty(t, excludedFrozen.Items[0].State)
}

func TestRecallMetricLargeExcludedSnapshotDoesNotMaterializeFail(t *testing.T) {
	db := setupRecallMetricServiceDB(t)
	campaign := model.RecallCampaign{Name: "large excluded", Status: model.RecallCampaignRunning}
	require.NoError(t, db.Create(&campaign).Error)
	require.NoError(t, db.Create(&model.RecallEvent{CampaignId: campaign.Id, EventType: "campaign_run", Source: "test", SourceEventId: "run:large-excluded", EventData: `{"identity_ledger_complete":true}`, CreatedAt: 100}).Error)
	exclusions := make([]model.RecallCampaignExclusion, 50_001)
	for i := range exclusions {
		userID := 910_000 + i
		exclusions[i] = model.RecallCampaignExclusion{CampaignId: campaign.Id, RecipientIdentity: model.RecallRecipientIdentityForUser(userID), UserId: userID, FirstRunEventId: 1, LastRunEventId: 1, FirstSeenAt: int64(100 + i), LastSeenAt: int64(100 + i)}
	}
	require.NoError(t, db.CreateInBatches(&exclusions, 500).Error)

	page, err := QueryRecallMetric(context.Background(), model.RecallMetricQuery{CampaignID: campaign.Id, Metric: "excluded", Limit: 1}, time.Now())
	require.NoError(t, err)
	require.EqualValues(t, 50_001, page.Total)
	require.Len(t, page.Items, 1)
}

func TestRecallMetricCandidatesMergeSourcesWithStableEncodedRowID(t *testing.T) {
	db := setupRecallMetricServiceDB(t)
	campaign := model.RecallCampaign{Name: "candidate merge", Status: model.RecallCampaignRunning}
	require.NoError(t, db.Create(&campaign).Error)
	recipient := model.RecallRecipient{CampaignId: campaign.Id, UserId: 721, RecipientIdentity: model.RecallRecipientIdentityForUser(721), EligibilitySnapshot: `{}`, EmailSnapshot: "candidate@example.com", LanguageSnapshot: "en", State: model.RecallRecipientQueued, CreatedAt: 100}
	require.NoError(t, db.Create(&recipient).Error)
	require.NoError(t, db.Create(&model.RecallEvent{CampaignId: campaign.Id, EventType: "campaign_run", Source: "test", SourceEventId: "run:candidates", EventData: `{"identity_ledger_complete":true}`, CreatedAt: 100}).Error)
	excludedSameIDTime := model.RecallCampaignExclusion{Id: recipient.Id, CampaignId: campaign.Id, RecipientIdentity: model.RecallRecipientIdentityForUser(722), UserId: 722, FirstRunEventId: 1, LastRunEventId: 1, FirstSeenAt: 100, LastSeenAt: 100}
	require.NoError(t, db.Create(&excludedSameIDTime).Error)
	excludedDuplicateIdentity := model.RecallCampaignExclusion{CampaignId: campaign.Id, RecipientIdentity: recipient.RecipientIdentity, UserId: recipient.UserId, FirstRunEventId: 1, LastRunEventId: 1, FirstSeenAt: 101, LastSeenAt: 101}
	require.NoError(t, db.Create(&excludedDuplicateIdentity).Error)

	first, err := QueryRecallMetric(context.Background(), model.RecallMetricQuery{CampaignID: campaign.Id, Metric: "candidates", Limit: 1}, time.Now())
	require.NoError(t, err)
	require.EqualValues(t, 2, first.Total)
	require.Len(t, first.Items, 1)
	require.NotEmpty(t, first.NextCursor)
	cursor, err := VerifyRecallMetricCursorToken(first.NextCursor, model.RecallMetricQuery{CampaignID: campaign.Id, Metric: "candidates", Snapshot: first.Snapshot}, "identity", time.Now())
	require.NoError(t, err)
	second, err := QueryRecallMetric(context.Background(), model.RecallMetricQuery{CampaignID: campaign.Id, Metric: "candidates", Snapshot: first.Snapshot, Cursor: cursor, Limit: 1}, time.Now())
	require.NoError(t, err)
	require.Len(t, second.Items, 1)
	require.NotEqual(t, first.Items[0].RowID, second.Items[0].RowID)
	require.ElementsMatch(t, []int{721, 722}, []int{first.Items[0].UserID, second.Items[0].UserID})
}

func TestRecallMetricCandidateStreamDoesNotRepeatCountsOrLegacyScansPerBatch(t *testing.T) {
	db := setupRecallMetricServiceDB(t)
	campaign := model.RecallCampaign{Name: "candidate bounded stream", Status: model.RecallCampaignRunning}
	require.NoError(t, db.Create(&campaign).Error)
	require.NoError(t, db.Create(&model.RecallEvent{CampaignId: campaign.Id, EventType: "campaign_run", Source: "test", SourceEventId: "run:candidate-bounded", EventData: `{"identity_ledger_complete":true}`, CreatedAt: 100}).Error)
	for i := 0; i < 3; i++ {
		userID := 72_100 + i
		recipient := model.RecallRecipient{CampaignId: campaign.Id, UserId: userID, RecipientIdentity: model.RecallRecipientIdentityForUser(userID), EligibilitySnapshot: `{}`, EmailSnapshot: "candidate-recipient-" + strconv.Itoa(i) + "@example.com", LanguageSnapshot: "en", State: model.RecallRecipientQueued, CreatedAt: int64(100 + i*2)}
		require.NoError(t, db.Create(&recipient).Error)
	}
	for i := 0; i < 3; i++ {
		userID := 72_200 + i
		exclusion := model.RecallCampaignExclusion{CampaignId: campaign.Id, RecipientIdentity: model.RecallRecipientIdentityForUser(userID), UserId: userID, FirstRunEventId: 1, LastRunEventId: 1, FirstSeenAt: int64(101 + i*2), LastSeenAt: int64(101 + i*2)}
		require.NoError(t, db.Create(&exclusion).Error)
	}

	first, err := QueryRecallMetric(context.Background(), model.RecallMetricQuery{CampaignID: campaign.Id, Metric: "candidates", Limit: 2}, time.Now())
	require.NoError(t, err)
	require.EqualValues(t, 6, first.Total)
	require.Len(t, first.Items, 2)
	cursor, err := VerifyRecallMetricCursorToken(first.NextCursor, model.RecallMetricQuery{CampaignID: campaign.Id, Metric: "candidates", Snapshot: first.Snapshot}, "identity", time.Now())
	require.NoError(t, err)
	second, err := QueryRecallMetric(context.Background(), model.RecallMetricQuery{CampaignID: campaign.Id, Metric: "candidates", Snapshot: first.Snapshot, Cursor: cursor, Limit: 4}, time.Now())
	require.NoError(t, err)
	allRows := append(append([]model.RecallMetricRow{}, first.Items...), second.Items...)
	require.Len(t, allRows, 6)
	seenRowIDs := map[int64]bool{}
	var lastTime int64
	var lastRowID int64
	for _, row := range allRows {
		require.False(t, seenRowIDs[row.RowID], "duplicate row_id %d", row.RowID)
		seenRowIDs[row.RowID] = true
		require.True(t, lastTime == 0 || row.OccurredAt > lastTime || (row.OccurredAt == lastTime && row.RowID > lastRowID))
		lastTime = row.OccurredAt
		lastRowID = row.RowID
	}

	queries := captureServiceRecallMetricSQL(t, db)
	var out bytes.Buffer
	result, err := ExportRecallMetricCSVWithLimits(context.Background(), &out, model.RecallMetricQuery{CampaignID: campaign.Id, Metric: "candidates", Snapshot: first.Snapshot, Limit: 1}, time.Now(), RecallMetricExportLimits{MaxRows: 6, MaxBytes: 100_000, BatchSize: 2})
	require.NoError(t, err)
	require.False(t, result.Truncated)
	require.EqualValues(t, 6, result.Rows)

	countQueries := 0
	campaignRunScans := 0
	for _, query := range *queries {
		if strings.Contains(query.SQL, "count(") {
			countQueries++
		}
		if strings.Contains(query.SQL, "from recall_events") && serviceRecallMetricSQLVarsContain(query.Vars, "campaign_run") {
			campaignRunScans++
		}
	}
	require.Zero(t, countQueries, "candidate streaming must not count per source batch")
	require.Zero(t, campaignRunScans, "candidate streaming must not scan legacy campaign_run rows")
}

func TestRecallMetricCandidateStreamSingleConnectionSharedMemorySQLite(t *testing.T) {
	db := setupRecallMetricSingleConnectionSharedMemoryDB(t)
	campaign := model.RecallCampaign{Name: "candidate single connection", Status: model.RecallCampaignRunning}
	require.NoError(t, db.Create(&campaign).Error)
	recipient := model.RecallRecipient{CampaignId: campaign.Id, UserId: 73_100, RecipientIdentity: model.RecallRecipientIdentityForUser(73_100), EligibilitySnapshot: `{}`, EmailSnapshot: "candidate-single-connection@example.com", LanguageSnapshot: "en", State: model.RecallRecipientQueued, CreatedAt: 100}
	require.NoError(t, db.Create(&recipient).Error)
	run := model.RecallEvent{CampaignId: campaign.Id, EventType: "campaign_run", Source: "test", SourceEventId: "run:candidate-single-connection", EventData: `{"identity_ledger_complete":true}`, CreatedAt: 100}
	require.NoError(t, db.Create(&run).Error)
	exclusion := model.RecallCampaignExclusion{CampaignId: campaign.Id, RecipientIdentity: model.RecallRecipientIdentityForUser(73_101), UserId: 73_101, FirstRunEventId: run.Id, LastRunEventId: run.Id, FirstSeenAt: 101, LastSeenAt: 101}
	require.NoError(t, db.Create(&exclusion).Error)

	ctx, cancel := context.WithTimeout(context.Background(), 300*time.Millisecond)
	defer cancel()
	page, err := QueryRecallMetric(ctx, model.RecallMetricQuery{CampaignID: campaign.Id, Metric: "candidates", Limit: 10}, time.Now())
	require.NoError(t, err)
	require.Len(t, page.Items, 2)
	require.EqualValues(t, 100, page.Items[0].OccurredAt)
	require.EqualValues(t, 101, page.Items[1].OccurredAt)
	require.Less(t, page.Items[0].RowID, page.Items[1].RowID)
}

func TestRecallMetricNonCandidateStreamsSingleConnectionSharedMemorySQLite(t *testing.T) {
	tests := []struct {
		name   string
		metric model.RecallMetricKey
		seed   func(*testing.T, *gorm.DB, model.RecallCampaign)
	}{
		{
			name:   "opened_recipients",
			metric: "opened_recipients",
			seed: func(t *testing.T, db *gorm.DB, campaign model.RecallCampaign) {
				recipients := make([]model.RecallRecipient, 0, 201)
				for i := 0; i < 201; i++ {
					userID := 74_000 + i
					recipients = append(recipients, model.RecallRecipient{CampaignId: campaign.Id, UserId: userID, RecipientIdentity: model.RecallRecipientIdentityForUser(userID), EligibilitySnapshot: `{}`, EmailSnapshot: "single-open-" + strconv.Itoa(i) + "@example.com", LanguageSnapshot: "en", State: model.RecallRecipientQueued, CreatedAt: int64(100 + i)})
				}
				require.NoError(t, db.CreateInBatches(&recipients, 100).Error)
				events := make([]model.RecallEvent, 0, len(recipients))
				for i, recipient := range recipients {
					events = append(events, model.RecallEvent{CampaignId: campaign.Id, RecipientId: recipient.Id, EventType: "email_open", Source: "test", SourceEventId: "open:single:" + strconv.Itoa(i), EventData: `{}`, CreatedAt: int64(200 + i)})
				}
				require.NoError(t, db.CreateInBatches(&events, 100).Error)
			},
		},
		{
			name:   "messages_accepted",
			metric: "messages_accepted",
			seed: func(t *testing.T, db *gorm.DB, campaign model.RecallCampaign) {
				recipients := make([]model.RecallRecipient, 0, 201)
				for i := 0; i < 201; i++ {
					userID := 75_000 + i
					recipients = append(recipients, model.RecallRecipient{CampaignId: campaign.Id, UserId: userID, RecipientIdentity: model.RecallRecipientIdentityForUser(userID), EligibilitySnapshot: `{}`, EmailSnapshot: "single-message-" + strconv.Itoa(i) + "@example.com", LanguageSnapshot: "en", State: model.RecallRecipientQueued, CreatedAt: int64(100 + i)})
				}
				require.NoError(t, db.CreateInBatches(&recipients, 100).Error)
				messages := make([]model.RecallMessage, 0, 201)
				for _, recipient := range recipients {
					messages = append(messages, model.RecallMessage{RecipientId: recipient.Id, StageNo: 1, TemplateVersion: 1, TemplateSnapshot: "template", ScheduledAt: 100, State: model.RecallMessageAccepted})
				}
				require.NoError(t, db.Transaction(func(tx *gorm.DB) error {
					return model.CreateRecallMessagesWithStateEventsTx(tx, campaign.Id, messages, 300)
				}))
			},
		},
		{
			name:   "attributed_spend",
			metric: "attributed_spend",
			seed: func(t *testing.T, db *gorm.DB, campaign model.RecallCampaign) {
				recipients := make([]model.RecallRecipient, 0, 201)
				for i := 0; i < 201; i++ {
					userID := 76_000 + i
					recipients = append(recipients, model.RecallRecipient{CampaignId: campaign.Id, UserId: userID, RecipientIdentity: model.RecallRecipientIdentityForUser(userID), EligibilitySnapshot: `{}`, EmailSnapshot: "single-conversion-" + strconv.Itoa(i) + "@example.com", LanguageSnapshot: "en", State: model.RecallRecipientConverted, CreatedAt: int64(100 + i)})
				}
				require.NoError(t, db.CreateInBatches(&recipients, 100).Error)
				events := make([]model.RecallEvent, 0, len(recipients))
				for i, recipient := range recipients {
					eventData, err := common.Marshal(map[string]any{
						"trade_no":         "single_conversion_" + strconv.Itoa(i),
						"conversion_kind":  "direct",
						"currency":         "usd",
						"amount_total":     1,
						"payment_category": "direct_topup",
					})
					require.NoError(t, err)
					events = append(events, model.RecallEvent{CampaignId: campaign.Id, RecipientId: recipient.Id, EventType: "conversion", Source: "test", SourceEventId: "conversion:single:" + strconv.Itoa(i), EventData: string(eventData), CreatedAt: int64(400 + i)})
				}
				require.NoError(t, db.CreateInBatches(&events, 100).Error)
			},
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			db := setupRecallMetricSingleConnectionSharedMemoryDB(t)
			campaign := model.RecallCampaign{Name: "single connection " + tc.name, Status: model.RecallCampaignRunning}
			require.NoError(t, db.Create(&campaign).Error)
			tc.seed(t, db, campaign)

			ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
			defer cancel()
			page, err := QueryRecallMetric(ctx, model.RecallMetricQuery{CampaignID: campaign.Id, Metric: tc.metric, Limit: 1}, time.Now())
			require.NoError(t, err)
			require.EqualValues(t, 201, page.Total)
			require.Len(t, page.Items, 1)
			require.NotZero(t, page.Items[0].OccurredAt)
			require.NotZero(t, page.Items[0].RowID)
		})
	}
}

func TestRecallMetricOpenAndClickUseDBRepresentativeEvents(t *testing.T) {
	db := setupRecallMetricServiceDB(t)
	campaign := model.RecallCampaign{Name: "large facts", Status: model.RecallCampaignRunning}
	require.NoError(t, db.Create(&campaign).Error)
	openRecipient := model.RecallRecipient{CampaignId: campaign.Id, UserId: 731, RecipientIdentity: model.RecallRecipientIdentityForUser(731), EligibilitySnapshot: `{}`, EmailSnapshot: "open-large@example.com", LanguageSnapshot: "en", State: model.RecallRecipientQueued, CreatedAt: 100}
	clickRecipient := model.RecallRecipient{CampaignId: campaign.Id, UserId: 732, RecipientIdentity: model.RecallRecipientIdentityForUser(732), EligibilitySnapshot: `{}`, EmailSnapshot: "click-large@example.com", LanguageSnapshot: "en", State: model.RecallRecipientQueued, CreatedAt: 100}
	require.NoError(t, db.Create(&openRecipient).Error)
	require.NoError(t, db.Create(&clickRecipient).Error)
	events := make([]model.RecallEvent, 0, 100_002)
	for i := 0; i < 50_001; i++ {
		events = append(events,
			model.RecallEvent{CampaignId: campaign.Id, RecipientId: openRecipient.Id, EventType: "email_open", Source: "test", SourceEventId: "open-large:" + strconv.Itoa(i), EventData: `{}`, CreatedAt: int64(100 + i)},
			model.RecallEvent{CampaignId: campaign.Id, RecipientId: clickRecipient.Id, EventType: "observed_click", Source: "test", SourceEventId: "click-large:" + strconv.Itoa(i), EventData: `{}`, CreatedAt: int64(100 + i)},
		)
	}
	require.NoError(t, db.CreateInBatches(&events, 500).Error)

	opened, err := QueryRecallMetric(context.Background(), model.RecallMetricQuery{CampaignID: campaign.Id, Metric: "opened_recipients", Limit: 1}, time.Now())
	require.NoError(t, err)
	require.EqualValues(t, 1, opened.Total)
	require.Len(t, opened.Items, 1)
	require.EqualValues(t, 100, opened.Items[0].OccurredAt)

	clicked, err := QueryRecallMetric(context.Background(), model.RecallMetricQuery{CampaignID: campaign.Id, Metric: "observed_clicks", Limit: 1}, time.Now())
	require.NoError(t, err)
	require.EqualValues(t, 1, clicked.Total)
	require.Len(t, clicked.Items, 1)
	require.EqualValues(t, 100, clicked.Items[0].OccurredAt)
}

func TestRecallMetricLegacyRunCountsStaySeparateFromIdentifiableTotals(t *testing.T) {
	db := setupRecallMetricServiceDB(t)
	campaign := model.RecallCampaign{Name: "legacy separate", Status: model.RecallCampaignRunning}
	require.NoError(t, db.Create(&campaign).Error)
	require.NoError(t, db.Create(&model.RecallEvent{CampaignId: campaign.Id, EventType: "campaign_run", Source: "test", SourceEventId: "legacy", EventData: `{"eligible_total":3,"exclusions":{"csv":2}}`, CreatedAt: 100}).Error)

	page, err := QueryRecallMetric(context.Background(), model.RecallMetricQuery{CampaignID: campaign.Id, Metric: "candidates", Limit: 10}, time.Now())
	require.NoError(t, err)
	require.Zero(t, page.Total)
	require.EqualValues(t, 2, page.LegacyUnidentifiedCount)
	require.False(t, page.DrilldownComplete)

	require.NoError(t, db.Create(&model.RecallEvent{CampaignId: campaign.Id, EventType: "campaign_run", Source: "test", SourceEventId: "new-ledger", EventData: `{"eligible_total":9,"exclusions":{"csv":8},"identity_ledger_complete":true}`, CreatedAt: 101}).Error)
	page, err = QueryRecallMetric(context.Background(), model.RecallMetricQuery{CampaignID: campaign.Id, Metric: "candidates", Limit: 10}, time.Now())
	require.NoError(t, err)
	require.EqualValues(t, 2, page.LegacyUnidentifiedCount)
}

func TestRecallMetricEnrolledIncludesSuppressedRecipientIdentities(t *testing.T) {
	db := setupRecallMetricServiceDB(t)
	campaign := model.RecallCampaign{Name: "suppressed enrolled", Status: model.RecallCampaignRunning}
	require.NoError(t, db.Create(&campaign).Error)
	recipient := model.RecallRecipient{CampaignId: campaign.Id, UserId: 801, EligibilitySnapshot: `{}`, EmailSnapshot: "suppressed@example.com", LanguageSnapshot: "en", State: model.RecallRecipientSuppressed}
	require.NoError(t, db.Create(&recipient).Error)

	page, err := QueryRecallMetric(context.Background(), model.RecallMetricQuery{CampaignID: campaign.Id, Metric: "enrolled", Limit: 10}, time.Now())
	require.NoError(t, err)
	require.EqualValues(t, 1, page.Total)
}

func TestRecallMetricAmountsAggregateFullSnapshotBeforePagination(t *testing.T) {
	db := setupRecallMetricServiceDB(t)
	campaign := model.RecallCampaign{Name: "amount full snapshot", Status: model.RecallCampaignRunning}
	require.NoError(t, db.Create(&campaign).Error)
	for i, amount := range []int64{100, 200} {
		recipient := model.RecallRecipient{CampaignId: campaign.Id, UserId: 811 + i, EligibilitySnapshot: `{}`, EmailSnapshot: "amount@example.com", LanguageSnapshot: "en", State: model.RecallRecipientConverted, ConversionKind: model.RecallConversionDirect, ConversionTradeNo: "trade_amount_" + strconv.Itoa(i), ConversionCurrency: "USD", ConversionAmount: amount}
		require.NoError(t, db.Create(&recipient).Error)
		require.NoError(t, db.Create(&model.RecallEvent{CampaignId: campaign.Id, RecipientId: recipient.Id, EventType: "conversion", Source: "test", SourceEventId: "amount:" + strconv.Itoa(i), EventData: `{"trade_no":"trade_amount_` + strconv.Itoa(i) + `","conversion_kind":"direct","currency":"usd","amount_total":` + strconv.FormatInt(amount, 10) + `}`, CreatedAt: int64(100 + i)}).Error)
	}

	page, err := QueryRecallMetric(context.Background(), model.RecallMetricQuery{CampaignID: campaign.Id, Metric: "attributed_spend", Limit: 1}, time.Now())
	require.NoError(t, err)
	require.Len(t, page.Items, 1)
	require.Equal(t, []RecallMetricAmount{{Currency: "USD", AmountMinor: 300, UserCount: 2}}, page.Amounts)
}

func TestRecallMetricLegacyCandidatesIgnoreEligibleAggregate(t *testing.T) {
	db := setupRecallMetricServiceDB(t)
	campaign := model.RecallCampaign{Name: "legacy eligible ignored", Status: model.RecallCampaignRunning}
	require.NoError(t, db.Create(&campaign).Error)
	recipient := model.RecallRecipient{CampaignId: campaign.Id, UserId: 821, EligibilitySnapshot: `{}`, EmailSnapshot: "eligible@example.com", LanguageSnapshot: "en", State: model.RecallRecipientQueued}
	require.NoError(t, db.Create(&recipient).Error)
	require.NoError(t, db.Create(&model.RecallEvent{CampaignId: campaign.Id, EventType: "campaign_run", Source: "test", SourceEventId: "eligible-only", EventData: `{"eligible_total":1}`, CreatedAt: 100}).Error)

	page, err := QueryRecallMetric(context.Background(), model.RecallMetricQuery{CampaignID: campaign.Id, Metric: "candidates", Limit: 10}, time.Now())
	require.NoError(t, err)
	require.EqualValues(t, 1, page.Total)
	require.Zero(t, page.LegacyUnidentifiedCount)
	require.True(t, page.DrilldownComplete)
}

func TestRecallMetricNewExternalCashSupportsPaymentCategoryFilter(t *testing.T) {
	db := setupRecallMetricServiceDB(t)
	campaign := model.RecallCampaign{Name: "new external cash filter", Status: model.RecallCampaignRunning}
	require.NoError(t, db.Create(&campaign).Error)
	for i, category := range []string{"direct_topup", "online_subscription"} {
		recipient := model.RecallRecipient{CampaignId: campaign.Id, UserId: 831 + i, EligibilitySnapshot: `{}`, EmailSnapshot: "cash-" + strconv.Itoa(i) + "@example.com", LanguageSnapshot: "en", State: model.RecallRecipientConverted}
		require.NoError(t, db.Create(&recipient).Error)
		eventData := `{"conversion_kind":"direct","trade_no":"cash_` + strconv.Itoa(i) + `","currency":"usd","amount_total":100,"payment_category":"` + category + `"}`
		require.NoError(t, db.Create(&model.RecallEvent{CampaignId: campaign.Id, RecipientId: recipient.Id, EventType: "conversion", Source: "test", SourceEventId: "cash:" + strconv.Itoa(i), EventData: eventData, CreatedAt: int64(100 + i)}).Error)
	}

	page, err := QueryRecallMetric(context.Background(), model.RecallMetricQuery{CampaignID: campaign.Id, Metric: "new_external_cash", PaymentCategory: "direct_topup", Limit: 10}, time.Now())
	require.NoError(t, err)
	require.EqualValues(t, 1, page.Total)
	require.Equal(t, "direct_topup", page.Items[0].PaymentCategory)
}

func TestRecallMetricExportEscapesAllFormulaPrefixesAndLogsWithoutQueryText(t *testing.T) {
	db := setupRecallMetricServiceDB(t)
	campaign := model.RecallCampaign{Name: "formula prefixes", Status: model.RecallCampaignRunning}
	require.NoError(t, db.Create(&campaign).Error)
	for i, email := range []string{" =cmd@example.com", "\t+cmd@example.com", "\r-cmd@example.com", "\n@cmd@example.com"} {
		recipient := model.RecallRecipient{CampaignId: campaign.Id, UserId: 701 + i, EligibilitySnapshot: `{}`, EmailSnapshot: email, LanguageSnapshot: "en", State: model.RecallRecipientQueued}
		require.NoError(t, db.Create(&recipient).Error)
	}
	var log struct {
		campaignID int64
		metric     model.RecallMetricKey
		filterHash string
		rows       int64
		truncated  bool
	}
	RecallMetricExportLogHook = func(campaignID int64, metric model.RecallMetricKey, filterHash string, rowCount int64, truncated bool) {
		log.campaignID = campaignID
		log.metric = metric
		log.filterHash = filterHash
		log.rows = rowCount
		log.truncated = truncated
	}
	t.Cleanup(func() { RecallMetricExportLogHook = nil })

	var out bytes.Buffer
	result, err := ExportRecallMetricCSVWithLimits(context.Background(), &out, model.RecallMetricQuery{CampaignID: campaign.Id, Metric: "enrolled", Limit: 10}, time.Now(), RecallMetricExportLimits{MaxRows: 10, MaxBytes: 10_000, BatchSize: 10})
	require.NoError(t, err)
	rows, err := csv.NewReader(bytes.NewReader(out.Bytes())).ReadAll()
	require.NoError(t, err)
	require.Len(t, rows, 5)
	for i := 1; i < len(rows); i++ {
		require.True(t, strings.HasPrefix(rows[i][8], "'"), rows[i][8])
	}
	require.Equal(t, result.Rows, log.rows)
	require.Equal(t, campaign.Id, log.campaignID)
	require.Equal(t, model.RecallMetricKey("enrolled"), log.metric)
	require.NotContains(t, log.filterHash, "cmd@example.com")
}

func TestRecallMetricLargeEnrolledSnapshotDoesNotMaterializeFail(t *testing.T) {
	db := setupRecallMetricServiceDB(t)
	campaign := model.RecallCampaign{Name: "large enrolled", Status: model.RecallCampaignRunning}
	require.NoError(t, db.Create(&campaign).Error)
	recipients := make([]model.RecallRecipient, 50_001)
	for i := range recipients {
		userID := 900_000 + i
		recipients[i] = model.RecallRecipient{CampaignId: campaign.Id, UserId: userID, RecipientIdentity: model.RecallRecipientIdentityForUser(userID), EligibilitySnapshot: `{}`, EmailSnapshot: "large-" + strconv.Itoa(i) + "@example.com", LanguageSnapshot: "en", State: model.RecallRecipientQueued}
	}
	require.NoError(t, db.CreateInBatches(&recipients, 500).Error)
	var identityCount int64
	require.NoError(t, db.Model(&model.RecallRecipient{}).Where("campaign_id = ?", campaign.Id).Distinct("recipient_identity").Count(&identityCount).Error)
	require.EqualValues(t, 50_001, identityCount)

	page, err := QueryRecallMetric(context.Background(), model.RecallMetricQuery{CampaignID: campaign.Id, Metric: "enrolled", Limit: 1}, time.Now())
	require.NoError(t, err)
	require.EqualValues(t, 50_001, page.Total)
	require.Len(t, page.Items, 1)
}

type capturedServiceRecallMetricSQL struct {
	SQL  string
	Vars []any
}

func captureServiceRecallMetricSQL(t *testing.T, db *gorm.DB) *[]capturedServiceRecallMetricSQL {
	t.Helper()
	const callbackName = "service_recall_metrics_sql_capture"
	queries := make([]capturedServiceRecallMetricSQL, 0)
	require.NoError(t, db.Callback().Query().After("gorm:query").Register(callbackName, func(tx *gorm.DB) {
		queries = append(queries, capturedServiceRecallMetricSQL{
			SQL:  normalizeServiceRecallMetricSQL(tx.Statement.SQL.String()),
			Vars: append([]any(nil), tx.Statement.Vars...),
		})
	}))
	t.Cleanup(func() {
		require.NoError(t, db.Callback().Query().Remove(callbackName))
	})
	return &queries
}

func normalizeServiceRecallMetricSQL(sql string) string {
	sql = strings.ToLower(sql)
	sql = strings.NewReplacer("`", "", `"`, "", "[", "", "]", "").Replace(sql)
	return regexp.MustCompile(`\s+`).ReplaceAllString(sql, " ")
}

func serviceRecallMetricSQLVarsContain(vars []any, value string) bool {
	for _, variable := range vars {
		if variable == value {
			return true
		}
	}
	return false
}
