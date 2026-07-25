package model

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type RecallEvent struct {
	Id            int64  `json:"id" gorm:"primaryKey"`
	CampaignId    int64  `json:"campaign_id" gorm:"index"`
	RecipientId   int64  `json:"recipient_id" gorm:"index"`
	EventType     string `json:"event_type" gorm:"type:varchar(48);not null;index"`
	Source        string `json:"source" gorm:"type:varchar(32);uniqueIndex:idx_recall_source_event,priority:1"`
	SourceEventId string `json:"source_event_id" gorm:"type:varchar(160);uniqueIndex:idx_recall_source_event,priority:2"`
	EventData     string `json:"event_data" gorm:"type:text"`
	CreatedAt     int64  `json:"created_at" gorm:"autoCreateTime;index"`
}

var errRecallRunNotOwned = errors.New("recall campaign run not owned")
var errRecallConversionNotOwned = errors.New("recall conversion not owned")
var errRecallAdminEventNotOwned = errors.New("recall admin audit event already exists")

const recallRunBatchSize = 200

type RecallClaimClickOutcome string

type RecallConversionRecord struct {
	RecipientId    int64
	CampaignId     int64
	UserId         int
	Kind           string
	TradeNo        string
	Currency       string
	Amount         int64
	DiscountAmount int64
	Source         string
	SourceEventId  string
	EventData      string
	ConvertedAt    int64
}

type RecallMetricCountRow struct {
	Metric string
	Count  int64
}

type RecallCurrencyMetricRow struct {
	Currency       string
	ConversionKind string
	Count          int64
	PaymentAmount  int64
	DiscountAmount int64
}

func ListRecallEventsWithContext(ctx context.Context, campaignID int64, offset int, limit int) ([]RecallEvent, int64, error) {
	events := make([]RecallEvent, 0)
	var total int64
	query := DB.WithContext(ctx).Model(&RecallEvent{}).Where("campaign_id = ?", campaignID)
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	offset, limit, bounded := boundRecallReadWindow(offset, limit)
	if !bounded {
		return events, total, nil
	}
	if err := query.Order("id DESC").Offset(offset).Limit(limit).Find(&events).Error; err != nil {
		return nil, 0, err
	}
	return events, total, nil
}

func validateRecallAdminEvent(event *RecallEvent) error {
	if event == nil || event.Source != "admin" || strings.TrimSpace(event.SourceEventId) == "" {
		return fmt.Errorf("recall admin event requires an admin source and source event ID")
	}
	if len(event.SourceEventId) > 160 {
		return fmt.Errorf("recall admin source event ID exceeds 160 characters")
	}
	if strings.TrimSpace(event.EventType) == "" {
		return fmt.Errorf("recall admin event type is required")
	}
	return nil
}

func insertRequiredRecallAdminEvent(tx *gorm.DB, event *RecallEvent) error {
	if err := validateRecallAdminEvent(event); err != nil {
		return err
	}
	result := insertRecallRunEvent(tx, event)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != 1 {
		return errRecallAdminEventNotOwned
	}
	return nil
}

const (
	RecallClaimClickValid      RecallClaimClickOutcome = "valid"
	RecallClaimClickConverted  RecallClaimClickOutcome = "converted"
	RecallClaimClickSuppressed RecallClaimClickOutcome = "suppressed"
	RecallClaimClickInactive   RecallClaimClickOutcome = "inactive"
)

// CommitRecallCampaignRun makes the campaign state change, idempotency event,
// recipient snapshot, and initial message snapshot one database transaction.
// expectedNextRunAt is nil for manual runs and is a fencing value for scheduled
// runs.
func CommitRecallCampaignRun(
	ctx context.Context,
	campaignID int64,
	from []string,
	to string,
	expectedNextRunAt *int64,
	expectedConfigRevision int64,
	fields map[string]any,
	recipients []RecallRecipient,
	messages []RecallMessage,
	runEvent RecallEvent,
) (bool, int, error) {
	if len(from) == 0 {
		return false, 0, nil
	}
	if len(messages) != 0 && len(messages) != len(recipients) {
		return false, 0, fmt.Errorf("cannot align %d recall messages with %d recipients", len(messages), len(recipients))
	}
	updates, err := recallCampaignTransitionUpdates(to, fields)
	if err != nil {
		return false, 0, err
	}
	for i := range recipients {
		recipients[i].CampaignId = campaignID
		if err := normalizeRecallRecipientIdentity(&recipients[i]); err != nil {
			return false, 0, err
		}
	}
	if err := validateRecallRecipientIdentitiesUnique(recipients); err != nil {
		return false, 0, err
	}
	runEvent.CampaignId = campaignID
	owned := false
	inserted := int64(0)
	err = DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		campaignQuery := tx.Model(&RecallCampaign{}).
			Where("id = ? AND status IN ? AND config_revision = ?", campaignID, from, expectedConfigRevision)
		if expectedNextRunAt != nil {
			campaignQuery = campaignQuery.Where("next_run_at = ?", *expectedNextRunAt)
		}
		campaignResult := campaignQuery.Updates(updates)
		if campaignResult.Error != nil {
			return campaignResult.Error
		}
		if campaignResult.RowsAffected == 0 {
			return nil
		}
		owned = true

		eventResult := insertRecallRunEvent(tx, &runEvent)
		if eventResult.Error != nil {
			return eventResult.Error
		}
		if eventResult.RowsAffected == 0 {
			return errRecallRunNotOwned
		}
		if len(recipients) > 0 {
			result := tx.Clauses(clause.OnConflict{
				Columns:   []clause.Column{{Name: "campaign_id"}, {Name: "recipient_identity"}},
				DoNothing: true,
			}).CreateInBatches(&recipients, recallRunBatchSize)
			if result.Error != nil {
				return result.Error
			}
			inserted = result.RowsAffected
		}
		if len(messages) == 0 {
			return nil
		}

		identities := make([]string, len(recipients))
		for i := range recipients {
			identities[i] = recipients[i].RecipientIdentity
		}
		storedRecipients := make([]RecallRecipient, 0, len(identities))
		for start := 0; start < len(identities); start += recallRunBatchSize {
			end := start + recallRunBatchSize
			if end > len(identities) {
				end = len(identities)
			}
			var batch []RecallRecipient
			if err := tx.Select("id", "recipient_identity").
				Where("campaign_id = ? AND recipient_identity IN ?", campaignID, identities[start:end]).
				Find(&batch).Error; err != nil {
				return err
			}
			storedRecipients = append(storedRecipients, batch...)
		}
		recipientIDsByIdentity := make(map[string]int64, len(storedRecipients))
		for _, recipient := range storedRecipients {
			recipientIDsByIdentity[recipient.RecipientIdentity] = recipient.Id
		}
		for i := range messages {
			recipientID, ok := recipientIDsByIdentity[recipients[i].RecipientIdentity]
			if !ok {
				return fmt.Errorf("recall recipient for campaign %d identity %s was not persisted", campaignID, recipients[i].RecipientIdentity)
			}
			messages[i].RecipientId = recipientID
		}
		return tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "recipient_id"}, {Name: "stage_no"}},
			DoNothing: true,
		}).CreateInBatches(&messages, recallRunBatchSize).Error
	})
	if errors.Is(err, errRecallRunNotOwned) {
		return false, 0, nil
	}
	if err != nil {
		return false, 0, err
	}
	return owned, int(inserted), nil
}

func RecordRecallClaimClickWithContext(ctx context.Context, recipientID int64, campaignID int64, clickedAt int64) (RecallClaimClickOutcome, error) {
	outcome := RecallClaimClickInactive
	err := DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		recipient := RecallRecipient{}
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ? AND campaign_id = ?", recipientID, campaignID).
			First(&recipient).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return nil
			}
			return err
		}
		outcome = recallClaimClickOutcome(recipient)
		if outcome != RecallClaimClickValid || recipient.ClickedAt != 0 {
			return nil
		}

		result := tx.Model(&RecallRecipient{}).
			Where("id = ? AND campaign_id = ? AND clicked_at = 0 AND converted_at = 0 AND state IN ?", recipientID, campaignID, recallClaimActiveRecipientStates()).
			Update("clicked_at", clickedAt)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
				Where("id = ? AND campaign_id = ?", recipientID, campaignID).
				First(&recipient).Error; err != nil {
				if err == gorm.ErrRecordNotFound {
					outcome = RecallClaimClickInactive
					return nil
				}
				return err
			}
			outcome = recallClaimClickOutcome(recipient)
			return nil
		}
		event := RecallEvent{
			CampaignId:    campaignID,
			RecipientId:   recipientID,
			EventType:     "observed_click",
			Source:        "claim",
			SourceEventId: fmt.Sprintf("recipient:%d", recipientID),
			EventData:     `{}`,
			CreatedAt:     clickedAt,
		}
		return insertRecallRunEvent(tx, &event).Error
	})
	return outcome, err
}

func RecordRecallConversionWithContext(ctx context.Context, record RecallConversionRecord) (bool, error) {
	converted := false
	err := DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		recipient := RecallRecipient{}
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ? AND campaign_id = ? AND user_id = ?", record.RecipientId, record.CampaignId, record.UserId).
			First(&recipient).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil
			}
			return err
		}
		if recipient.ConvertedAt != 0 || recipient.State == RecallRecipientConverted || !isRecallClaimActiveRecipientState(recipient.State) {
			return nil
		}

		event := RecallEvent{
			CampaignId:    record.CampaignId,
			RecipientId:   record.RecipientId,
			EventType:     "conversion",
			Source:        record.Source,
			SourceEventId: record.SourceEventId,
			EventData:     record.EventData,
			CreatedAt:     record.ConvertedAt,
		}
		eventResult := insertRecallRunEvent(tx, &event)
		if eventResult.Error != nil {
			return eventResult.Error
		}
		if eventResult.RowsAffected == 0 {
			return nil
		}

		result := tx.Model(&RecallRecipient{}).
			Where("id = ? AND campaign_id = ? AND user_id = ? AND converted_at = 0 AND state IN ?", record.RecipientId, record.CampaignId, record.UserId, recallClaimActiveRecipientStates()).
			Updates(map[string]any{
				"state":               RecallRecipientConverted,
				"converted_at":        record.ConvertedAt,
				"conversion_kind":     record.Kind,
				"conversion_trade_no": record.TradeNo,
				"conversion_currency": record.Currency,
				"conversion_amount":   record.Amount,
				"discount_amount":     record.DiscountAmount,
				"lease_owner":         "",
				"lease_expires_at":    int64(0),
			})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return errRecallConversionNotOwned
		}
		converted = true
		return nil
	})
	if errors.Is(err, errRecallConversionNotOwned) {
		return false, nil
	}
	return converted, err
}

func recallClaimClickOutcome(recipient RecallRecipient) RecallClaimClickOutcome {
	if recipient.ConvertedAt != 0 || recipient.State == RecallRecipientConverted {
		return RecallClaimClickConverted
	}
	if recipient.State == RecallRecipientSuppressed {
		return RecallClaimClickSuppressed
	}
	for _, state := range recallClaimActiveRecipientStates() {
		if recipient.State == state {
			return RecallClaimClickValid
		}
	}
	return RecallClaimClickInactive
}

func recallClaimActiveRecipientStates() []string {
	return []string{
		RecallRecipientQueued,
		RecallRecipientCustomerReady,
		RecallRecipientCodeReady,
		RecallRecipientContacting,
	}
}

func isRecallClaimActiveRecipientState(state string) bool {
	for _, active := range recallClaimActiveRecipientStates() {
		if state == active {
			return true
		}
	}
	return false
}

func QueryRecallCampaignMetricRows(ctx context.Context, campaignID int64) ([]RecallMetricCountRow, []RecallCurrencyMetricRow, error) {
	recipients := make([]RecallRecipient, 0)
	if err := DB.WithContext(ctx).Where("campaign_id = ?", campaignID).Find(&recipients).Error; err != nil {
		return nil, nil, err
	}
	counts := map[string]int64{
		"enrolled": int64(len(recipients)),
	}
	currencyByKey := make(map[string]*RecallCurrencyMetricRow)
	recipientIDs := make([]int64, 0, len(recipients))
	for _, recipient := range recipients {
		recipientIDs = append(recipientIDs, recipient.Id)
		if strings.TrimSpace(recipient.StripeCustomerId) != "" {
			counts["customer_success"]++
		} else if recipient.State == RecallRecipientFailed {
			counts["customer_failure"]++
		}
		if recipient.StripePromotionCodeId != nil && strings.TrimSpace(*recipient.StripePromotionCodeId) != "" {
			counts["code_success"]++
		} else if recipient.State == RecallRecipientFailed && strings.TrimSpace(recipient.StripeCustomerId) != "" {
			counts["code_failure"]++
		}
		switch recipient.ConversionKind {
		case RecallConversionDirect:
			counts["direct"]++
		case RecallConversionAssisted:
			counts["assisted"]++
		case RecallConversionNoCoupon:
			counts["no_coupon"]++
		default:
			continue
		}
		currency := strings.ToUpper(strings.TrimSpace(recipient.ConversionCurrency))
		key := currency + "\x00" + recipient.ConversionKind
		row := currencyByKey[key]
		if row == nil {
			row = &RecallCurrencyMetricRow{Currency: currency, ConversionKind: recipient.ConversionKind}
			currencyByKey[key] = row
		}
		row.Count++
		row.PaymentAmount += recipient.ConversionAmount
		row.DiscountAmount += recipient.DiscountAmount
	}

	if len(recipientIDs) > 0 {
		messages := make([]RecallMessage, 0)
		if err := DB.WithContext(ctx).Where("recipient_id IN ?", recipientIDs).Find(&messages).Error; err != nil {
			return nil, nil, err
		}
		counts["messages_scheduled"] = int64(len(messages))
		for _, message := range messages {
			switch message.State {
			case RecallMessageAccepted:
				counts["messages_accepted"]++
			case RecallMessageFailed:
				counts["messages_failed"]++
			case RecallMessageCancelled:
				counts["messages_cancelled"]++
			}
		}
	}

	events := make([]RecallEvent, 0)
	if err := DB.WithContext(ctx).Where("campaign_id = ?", campaignID).Find(&events).Error; err != nil {
		return nil, nil, err
	}
	for _, event := range events {
		switch event.EventType {
		case "observed_click":
			counts["observed_clicks"]++
		case "campaign_run":
			var data struct {
				EligibleTotal int64            `json:"eligible_total"`
				Exclusions    map[string]int64 `json:"exclusions"`
			}
			if err := common.Unmarshal([]byte(event.EventData), &data); err != nil {
				return nil, nil, fmt.Errorf("decode recall campaign run metrics: %w", err)
			}
			counts["candidates"] += data.EligibleTotal
			for _, excluded := range data.Exclusions {
				counts["candidates"] += excluded
				counts["excluded"] += excluded
			}
		}
	}

	metricNames := []string{
		"candidates", "enrolled", "excluded", "customer_success", "customer_failure", "code_success", "code_failure",
		"messages_scheduled", "messages_accepted", "messages_failed", "messages_cancelled", "observed_clicks", "direct", "assisted", "no_coupon",
	}
	countRows := make([]RecallMetricCountRow, 0, len(metricNames))
	for _, metric := range metricNames {
		countRows = append(countRows, RecallMetricCountRow{Metric: metric, Count: counts[metric]})
	}
	currencyRows := make([]RecallCurrencyMetricRow, 0, len(currencyByKey))
	for _, row := range currencyByKey {
		currencyRows = append(currencyRows, *row)
	}
	sort.Slice(currencyRows, func(i, j int) bool {
		if currencyRows[i].Currency == currencyRows[j].Currency {
			return currencyRows[i].ConversionKind < currencyRows[j].ConversionKind
		}
		return currencyRows[i].Currency < currencyRows[j].Currency
	})
	return countRows, currencyRows, nil
}

func TryInsertRecallReconciliationWindowWithContext(ctx context.Context, now time.Time) (bool, error) {
	windowStart := now.UTC().Truncate(15 * time.Minute)
	event := RecallEvent{
		EventType:     "reconciliation_run",
		Source:        "scheduler",
		SourceEventId: fmt.Sprintf("recall-reconciliation:%d", windowStart.Unix()),
		EventData:     `{}`,
		CreatedAt:     now.Unix(),
	}
	result := insertRecallRunEvent(DB.WithContext(ctx), &event)
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected == 1, nil
}
