package model

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

type RecallMetricKey string

type RecallMetricQuery struct {
	CampaignID      int64
	Metric          RecallMetricKey
	Search          string
	StageNo         *int
	State           string
	ConversionKind  string
	PaymentCategory string
	Currency        string
	Snapshot        RecallMetricSnapshot
	Cursor          RecallMetricCursor
	Limit           int
}

type RecallMetricSnapshot struct {
	AsOf                   int64
	RecipientMaxID         int64
	FactEventMaxID         int64
	MessageStateEventMaxID int64
	ExclusionMaxID         int64
	CampaignRunEventMaxID  int64
	TopUpMaxID             int64
	SubscriptionOrderMaxID int64
}

type RecallMetricCursor struct {
	SortTime int64
	RowID    int64
}

type RecallMetricRow struct {
	RowID           int64  `json:"row_id"`
	RecipientID     int64  `json:"recipient_id"`
	MessageID       int64  `json:"message_id"`
	UserID          int    `json:"user_id"`
	Email           string `json:"email"`
	OccurredAt      int64  `json:"occurred_at"`
	StageNo         int    `json:"stage_no"`
	State           string `json:"state"`
	ConversionKind  string `json:"conversion_kind"`
	TradeNo         string `json:"trade_no"`
	PaymentCategory string `json:"payment_category"`
	Currency        string `json:"currency"`
	AmountMinor     int64  `json:"amount_minor"`
	FailureCode     string `json:"failure_code"`
}

type RecallMetricRegistryEntry struct {
	Key              RecallMetricKey
	Grain            string
	RowGrain         string
	SupportedFilters map[string]bool
	Sort             string
}

type RecallMetricResult struct {
	Rows                      []RecallMetricRow
	Total                     int64
	AmountMinorByCurrency     map[string]int64
	AmountUserCountByCurrency map[string]int64
	Snapshot                  RecallMetricSnapshot
	NextCursor                RecallMetricCursor
	LegacyUnidentifiedCount   int64
	DrilldownComplete         bool
}

var ErrRecallMetricBadRequest = errors.New("recall metric bad request")
var ErrRecallMetricRetry = errors.New("recall metric retry later")

const (
	RecallMetricGrainIdentity   = "identity"
	RecallMetricGrainMessage    = "message"
	RecallMetricGrainConversion = "conversion"

	recallMetricStreamingBatchSize = 200
)

var recallMetricRegistry = map[RecallMetricKey]RecallMetricRegistryEntry{
	"candidates":            recallMetricEntry("candidates", RecallMetricGrainIdentity, "search"),
	"enrolled":              recallMetricEntry("enrolled", RecallMetricGrainIdentity, "search"),
	"excluded":              recallMetricEntry("excluded", RecallMetricGrainIdentity, "search"),
	"opened_recipients":     recallMetricEntry("opened_recipients", RecallMetricGrainIdentity, "search"),
	"observed_clicks":       recallMetricEntry("observed_clicks", RecallMetricGrainIdentity, "search"),
	"messages_accepted":     recallMetricEntry("messages_accepted", RecallMetricGrainMessage, "search", "stage_no"),
	"messages_failed":       recallMetricEntry("messages_failed", RecallMetricGrainMessage, "search", "stage_no"),
	"direct_conversions":    recallMetricEntry("direct_conversions", RecallMetricGrainConversion, "search", "currency"),
	"assisted_conversions":  recallMetricEntry("assisted_conversions", RecallMetricGrainConversion, "search", "currency"),
	"no_coupon_conversions": recallMetricEntry("no_coupon_conversions", RecallMetricGrainConversion, "search", "currency"),
	"attributed_spend":      recallMetricEntry("attributed_spend", RecallMetricGrainConversion, "search", "currency", "conversion_kind", "payment_category"),
	"new_external_cash":     recallMetricEntry("new_external_cash", RecallMetricGrainConversion, "search", "currency", "conversion_kind", "payment_category"),
	"direct_topup":          recallMetricEntry("direct_topup", RecallMetricGrainConversion, "search", "currency", "conversion_kind"),
	"balance_subscription":  recallMetricEntry("balance_subscription", RecallMetricGrainConversion, "search", "currency", "conversion_kind"),
	"online_subscription":   recallMetricEntry("online_subscription", RecallMetricGrainConversion, "search", "currency", "conversion_kind"),
}

func recallMetricEntry(key RecallMetricKey, grain string, filters ...string) RecallMetricRegistryEntry {
	supported := make(map[string]bool, len(filters))
	for _, filter := range filters {
		supported[filter] = true
	}
	return RecallMetricRegistryEntry{Key: key, Grain: grain, RowGrain: grain, SupportedFilters: supported, Sort: "occurred_at,row_id"}
}

func RecallMetricRegistry() map[RecallMetricKey]RecallMetricRegistryEntry {
	out := make(map[RecallMetricKey]RecallMetricRegistryEntry, len(recallMetricRegistry))
	for key, entry := range recallMetricRegistry {
		copied := entry
		copied.SupportedFilters = make(map[string]bool, len(entry.SupportedFilters))
		for filter, ok := range entry.SupportedFilters {
			copied.SupportedFilters[filter] = ok
		}
		out[key] = copied
	}
	return out
}

func RecallMetricEntry(key RecallMetricKey) (RecallMetricRegistryEntry, bool) {
	entry, ok := recallMetricRegistry[key]
	return entry, ok
}

func QueryRecallMetricRows(ctx context.Context, query RecallMetricQuery) (RecallMetricResult, error) {
	suppliedSnapshot := query.Snapshot.AsOf != 0
	query, entry, err := normalizeRecallMetricQuery(query)
	if err != nil {
		return RecallMetricResult{}, err
	}
	if err := ensureRecallMetricSnapshotReady(ctx, query, entry, suppliedSnapshot); err != nil {
		return RecallMetricResult{}, err
	}
	if query.Snapshot.AsOf == 0 {
		query.Snapshot, err = CaptureRecallMetricSnapshot(ctx, query.CampaignID)
		if err != nil {
			return RecallMetricResult{}, err
		}
	}
	result := RecallMetricResult{Snapshot: query.Snapshot, AmountMinorByCurrency: map[string]int64{}, AmountUserCountByCurrency: map[string]int64{}, DrilldownComplete: true}
	if entry.Grain == RecallMetricGrainIdentity {
		result, err = recallMetricIdentityResultFromStream(ctx, query)
		if err != nil {
			return RecallMetricResult{}, err
		}
		return result, nil
	}
	if entry.Grain == RecallMetricGrainMessage {
		result, err = recallMetricMessageResult(ctx, query)
		if err != nil {
			return RecallMetricResult{}, err
		}
		return result, nil
	}
	if entry.Grain == RecallMetricGrainConversion {
		result, err = recallMetricConversionResult(ctx, query)
		if err != nil {
			return RecallMetricResult{}, err
		}
		return result, nil
	}
	return RecallMetricResult{}, fmt.Errorf("%w: unsupported metric grain", ErrRecallMetricBadRequest)
}

func recallMetricIdentityResultFromStream(ctx context.Context, query RecallMetricQuery) (RecallMetricResult, error) {
	pageCursor := query.Cursor
	scanQuery := query
	scanQuery.Cursor = RecallMetricCursor{}
	result := RecallMetricResult{Snapshot: query.Snapshot, AmountMinorByCurrency: map[string]int64{}, AmountUserCountByCurrency: map[string]int64{}, DrilldownComplete: true}
	_, err := StreamRecallMetricRows(ctx, scanQuery, recallMetricStreamingBatchSize, func(row RecallMetricRow) (bool, error) {
		result.Total++
		if pageCursor.SortTime != 0 || pageCursor.RowID != 0 {
			if row.OccurredAt < pageCursor.SortTime || (row.OccurredAt == pageCursor.SortTime && row.RowID <= pageCursor.RowID) {
				return true, nil
			}
		}
		if len(result.Rows) < query.Limit+1 {
			result.Rows = append(result.Rows, row)
		}
		return true, nil
	})
	if err != nil {
		return RecallMetricResult{}, err
	}
	if len(result.Rows) > query.Limit {
		last := result.Rows[query.Limit-1]
		result.NextCursor = RecallMetricCursor{SortTime: last.OccurredAt, RowID: last.RowID}
		result.Rows = result.Rows[:query.Limit]
	}
	switch query.Metric {
	case "excluded":
		result.LegacyUnidentifiedCount, err = recallMetricLegacyCampaignRunCount(ctx, query, "excluded")
	case "candidates":
		result.LegacyUnidentifiedCount, err = recallMetricLegacyCampaignRunCount(ctx, query, "candidates")
	}
	if err != nil {
		return RecallMetricResult{}, err
	}
	if result.LegacyUnidentifiedCount > 0 {
		result.DrilldownComplete = false
	}
	return result, nil
}

func CaptureRecallMetricSnapshot(ctx context.Context, campaignID int64) (RecallMetricSnapshot, error) {
	snapshot := RecallMetricSnapshot{}
	asOf, err := GetDBTimestampWithContext(ctx)
	if err != nil {
		asOf = common.GetTimestamp()
	}
	snapshot.AsOf = asOf
	if snapshot.RecipientMaxID, err = recallMetricMaxID(ctx, &RecallRecipient{}, "campaign_id = ?", campaignID); err != nil {
		return snapshot, err
	}
	if snapshot.FactEventMaxID, err = recallMetricMaxID(ctx, &RecallEvent{}, "campaign_id = ? AND event_type IN ?", campaignID, []string{"email_open", "observed_click", "conversion"}); err != nil {
		return snapshot, err
	}
	if snapshot.MessageStateEventMaxID, err = recallMetricMaxID(ctx, &RecallEvent{}, "campaign_id = ? AND event_type = ?", campaignID, "message_state_changed"); err != nil {
		return snapshot, err
	}
	if snapshot.ExclusionMaxID, err = recallMetricMaxID(ctx, &RecallCampaignExclusion{}, "campaign_id = ?", campaignID); err != nil {
		return snapshot, err
	}
	if snapshot.CampaignRunEventMaxID, err = recallMetricMaxID(ctx, &RecallEvent{}, "campaign_id = ? AND event_type = ?", campaignID, "campaign_run"); err != nil {
		return snapshot, err
	}
	if snapshot.TopUpMaxID, err = recallMetricMaxID(ctx, &TopUp{}, "1 = 1"); err != nil {
		return snapshot, err
	}
	if snapshot.SubscriptionOrderMaxID, err = recallMetricMaxID(ctx, &SubscriptionOrder{}, "1 = 1"); err != nil {
		return snapshot, err
	}
	return snapshot, nil
}

func recallMetricMaxID(ctx context.Context, modelValue any, predicate string, args ...any) (int64, error) {
	var row struct{ MaxID int64 }
	err := DB.WithContext(ctx).Model(modelValue).Select("COALESCE(MAX(id), 0) AS max_id").Where(predicate, args...).Scan(&row).Error
	return row.MaxID, err
}

func normalizeRecallMetricQuery(query RecallMetricQuery) (RecallMetricQuery, RecallMetricRegistryEntry, error) {
	entry, ok := recallMetricRegistry[query.Metric]
	if !ok {
		return query, entry, fmt.Errorf("%w: unsupported metric", ErrRecallMetricBadRequest)
	}
	if query.CampaignID <= 0 {
		return query, entry, fmt.Errorf("%w: campaign id is required", ErrRecallMetricBadRequest)
	}
	if query.Limit <= 0 {
		query.Limit = 50
	}
	if query.Limit > 500 {
		query.Limit = 500
	}
	query.Search = strings.TrimSpace(query.Search)
	query.State = strings.TrimSpace(query.State)
	query.ConversionKind = strings.TrimSpace(query.ConversionKind)
	query.PaymentCategory = strings.TrimSpace(query.PaymentCategory)
	query.Currency = strings.ToUpper(strings.TrimSpace(query.Currency))
	used := map[string]bool{}
	if query.Search != "" {
		used["search"] = true
	}
	if query.StageNo != nil {
		used["stage_no"] = true
		if *query.StageNo <= 0 {
			return query, entry, fmt.Errorf("%w: stage_no must be positive", ErrRecallMetricBadRequest)
		}
	}
	if query.State != "" {
		used["state"] = true
	}
	if query.ConversionKind != "" {
		used["conversion_kind"] = true
	}
	if query.PaymentCategory != "" {
		used["payment_category"] = true
	}
	if query.Currency != "" {
		used["currency"] = true
	}
	for filter := range used {
		if !entry.SupportedFilters[filter] {
			return query, entry, fmt.Errorf("%w: filter %s is not supported for %s", ErrRecallMetricBadRequest, filter, query.Metric)
		}
	}
	return query, entry, nil
}

func RecallMetricFilterHash(query RecallMetricQuery) (string, error) {
	query, _, err := normalizeRecallMetricQuery(query)
	if err != nil {
		return "", err
	}
	stage := ""
	if query.StageNo != nil {
		stage = strconv.Itoa(*query.StageNo)
	}
	payload := strings.Join([]string{
		"search=" + normalizeRecallMetricSearchToken(query.Search),
		"stage=" + stage,
		"state=" + query.State,
		"conversion_kind=" + query.ConversionKind,
		"payment_category=" + query.PaymentCategory,
		"currency=" + query.Currency,
	}, "\n")
	sum := sha256.Sum256([]byte(payload))
	return fmt.Sprintf("%x", sum), nil
}

func normalizeRecallMetricSearchToken(search string) string {
	search = strings.TrimSpace(search)
	if search == "" {
		return ""
	}
	if _, err := strconv.Atoi(search); err == nil {
		return search
	}
	return strings.ToLower(search)
}

func applyRecallMetricRecipientFilters(query *gorm.DB, metric RecallMetricQuery, table string) *gorm.DB {
	prefix := ""
	if table != "" {
		prefix = table + "."
	}
	if metric.Search != "" {
		if userID, err := strconv.Atoi(metric.Search); err == nil {
			query = query.Where(prefix+"user_id = ?", userID)
		} else {
			query = query.Where("LOWER("+prefix+"email_snapshot) = ?", strings.ToLower(strings.TrimSpace(metric.Search)))
		}
	}
	if metric.State != "" {
		query = query.Where(prefix+"state = ?", metric.State)
	}
	return query
}

const (
	recallMetricCandidateRecipientSource int64 = 0
	recallMetricCandidateExclusionSource int64 = 1
)

func encodeRecallMetricCandidateRowID(localID int64, source int64) int64 {
	return localID*2 + source
}

func recallMetricExclusionBaseQuery(ctx context.Context, query RecallMetricQuery, excludeSnapshotRecipients bool) *gorm.DB {
	db := DB.WithContext(ctx).Model(&RecallCampaignExclusion{}).
		Where("recall_campaign_exclusions.campaign_id = ? AND recall_campaign_exclusions.id <= ? AND recall_campaign_exclusions.first_run_event_id > 0 AND recall_campaign_exclusions.first_run_event_id <= ?", query.CampaignID, query.Snapshot.ExclusionMaxID, query.Snapshot.CampaignRunEventMaxID)
	if excludeSnapshotRecipients {
		db = db.Where("NOT EXISTS (?)",
			DB.Model(&RecallRecipient{}).
				Select("1").
				Where("recall_recipients.campaign_id = recall_campaign_exclusions.campaign_id").
				Where("recall_recipients.recipient_identity = recall_campaign_exclusions.recipient_identity").
				Where("recall_recipients.id <= ?", query.Snapshot.RecipientMaxID),
		)
	}
	if query.Search != "" {
		if userID, err := strconv.Atoi(query.Search); err == nil {
			db = db.Where("recall_campaign_exclusions.user_id = ?", userID)
		} else {
			identity := RecallRecipientIdentityForEmail(strings.ToLower(strings.TrimSpace(query.Search)))
			db = db.Where("recall_campaign_exclusions.recipient_identity = ?", identity)
		}
	}
	return db
}

func recallMetricRepresentativeFactEvents(ctx context.Context, query RecallMetricQuery, eventType string) *gorm.DB {
	firstCreated := DB.WithContext(ctx).Model(&RecallEvent{}).
		Select("recipient_id, MIN(created_at) AS created_at").
		Where("campaign_id = ? AND event_type = ? AND id <= ? AND recipient_id > 0", query.CampaignID, eventType, query.Snapshot.FactEventMaxID).
		Group("recipient_id")
	representatives := DB.WithContext(ctx).Table("recall_events AS candidates").
		Select("candidates.recipient_id, MIN(candidates.id) AS id").
		Joins("JOIN (?) AS first_created ON first_created.recipient_id = candidates.recipient_id AND first_created.created_at = candidates.created_at", firstCreated).
		Where("candidates.campaign_id = ? AND candidates.event_type = ? AND candidates.id <= ? AND candidates.recipient_id > 0", query.CampaignID, eventType, query.Snapshot.FactEventMaxID).
		Group("candidates.recipient_id")
	db := DB.WithContext(ctx).Model(&RecallEvent{}).
		Select("recall_events.*").
		Joins("JOIN (?) AS representative_events ON representative_events.id = recall_events.id", representatives).
		Joins("JOIN recall_recipients ON recall_recipients.id = recall_events.recipient_id").
		Where("recall_recipients.campaign_id = ? AND recall_recipients.id <= ?", query.CampaignID, query.Snapshot.RecipientMaxID)
	db = applyRecallMetricRecipientFilters(db, query, "recall_recipients")
	return db
}

func recallMetricMessageResult(ctx context.Context, query RecallMetricQuery) (RecallMetricResult, error) {
	return recallMetricMessageResultFromStream(ctx, query)
}

func recallMetricMessageResultFromStream(ctx context.Context, query RecallMetricQuery) (RecallMetricResult, error) {
	pageCursor := query.Cursor
	scanQuery := query
	scanQuery.Cursor = RecallMetricCursor{}
	result := RecallMetricResult{Snapshot: query.Snapshot, AmountMinorByCurrency: map[string]int64{}, AmountUserCountByCurrency: map[string]int64{}, DrilldownComplete: true}
	_, err := StreamRecallMetricRows(ctx, scanQuery, recallMetricStreamingBatchSize, func(row RecallMetricRow) (bool, error) {
		result.Total++
		if pageCursor.SortTime != 0 || pageCursor.RowID != 0 {
			if row.OccurredAt < pageCursor.SortTime || (row.OccurredAt == pageCursor.SortTime && row.RowID <= pageCursor.RowID) {
				return true, nil
			}
		}
		if len(result.Rows) < query.Limit+1 {
			result.Rows = append(result.Rows, row)
		}
		return true, nil
	})
	if err != nil {
		return RecallMetricResult{}, err
	}
	if len(result.Rows) > query.Limit {
		last := result.Rows[query.Limit-1]
		result.NextCursor = RecallMetricCursor{SortTime: last.OccurredAt, RowID: last.RowID}
		result.Rows = result.Rows[:query.Limit]
	}
	return result, nil
}

func recallMetricLatestMessageStateQuery(ctx context.Context, query RecallMetricQuery) *gorm.DB {
	latest := DB.WithContext(ctx).Model(&RecallEvent{}).
		Select("message_id, MAX(id) AS max_id").
		Where("campaign_id = ? AND event_type = ? AND source = ? AND id <= ? AND message_id > 0", query.CampaignID, "message_state_changed", "message_state", query.Snapshot.MessageStateEventMaxID).
		Group("message_id")
	db := DB.WithContext(ctx).Model(&RecallEvent{}).
		Select("recall_events.*").
		Joins("JOIN (?) AS latest_state ON latest_state.max_id = recall_events.id", latest).
		Joins("JOIN recall_messages ON recall_messages.id = recall_events.message_id").
		Joins("JOIN recall_recipients ON recall_recipients.id = recall_messages.recipient_id").
		Where("recall_recipients.campaign_id = ? AND recall_recipients.id <= ?", query.CampaignID, query.Snapshot.RecipientMaxID)
	db = applyRecallMetricRecipientFilters(db, query, "recall_recipients")
	if query.StageNo != nil {
		db = db.Where("recall_messages.stage_no = ?", *query.StageNo)
	}
	return db
}

func recallMetricMessagesByID(ctx context.Context, events []RecallEvent) (map[int64]RecallMessage, error) {
	out := map[int64]RecallMessage{}
	if len(events) == 0 {
		return out, nil
	}
	ids := make([]int64, 0, len(events))
	seen := make(map[int64]struct{}, len(events))
	for _, event := range events {
		if event.MessageId <= 0 {
			continue
		}
		if _, ok := seen[event.MessageId]; ok {
			continue
		}
		seen[event.MessageId] = struct{}{}
		ids = append(ids, event.MessageId)
	}
	if len(ids) == 0 {
		return out, nil
	}
	var messages []RecallMessage
	if err := DB.WithContext(ctx).Where("id IN ?", ids).Find(&messages).Error; err != nil {
		return nil, err
	}
	for _, message := range messages {
		out[message.Id] = message
	}
	return out, nil
}

func decodeRecallMetricMessageStateEvent(event RecallEvent) (recallMetricMessageState, error) {
	var payload struct {
		MessageID   int64  `json:"message_id"`
		ToState     string `json:"to_state"`
		OccurredAt  int64  `json:"occurred_at"`
		FailureCode string `json:"failure_code"`
	}
	if err := common.Unmarshal([]byte(event.EventData), &payload); err != nil {
		return recallMetricMessageState{}, err
	}
	if payload.MessageID == 0 {
		payload.MessageID = event.MessageId
	}
	occurredAt := payload.OccurredAt
	if occurredAt == 0 {
		occurredAt = event.CreatedAt
	}
	return recallMetricMessageState{MessageID: payload.MessageID, ToState: payload.ToState, OccurredAt: occurredAt, EventID: event.Id, FailureCode: sanitizeRecallErrorCode(payload.FailureCode)}, nil
}

func recallMetricConversionResult(ctx context.Context, query RecallMetricQuery) (RecallMetricResult, error) {
	return recallMetricConversionResultFromStream(ctx, query)
}

func recallMetricConversionResultFromStream(ctx context.Context, query RecallMetricQuery) (RecallMetricResult, error) {
	pageCursor := query.Cursor
	scanQuery := query
	scanQuery.Cursor = RecallMetricCursor{}
	result := RecallMetricResult{Snapshot: query.Snapshot, AmountMinorByCurrency: map[string]int64{}, AmountUserCountByCurrency: map[string]int64{}, DrilldownComplete: true}
	_, err := StreamRecallMetricRows(ctx, scanQuery, recallMetricStreamingBatchSize, func(row RecallMetricRow) (bool, error) {
		result.Total++
		currency := strings.ToUpper(strings.TrimSpace(row.Currency))
		if currency != "" || row.AmountMinor != 0 {
			if currency == "" {
				currency = "UNKNOWN"
			}
			result.AmountMinorByCurrency[currency] += row.AmountMinor
			result.AmountUserCountByCurrency[currency]++
		}
		if pageCursor.SortTime != 0 || pageCursor.RowID != 0 {
			if row.OccurredAt < pageCursor.SortTime || (row.OccurredAt == pageCursor.SortTime && row.RowID <= pageCursor.RowID) {
				return true, nil
			}
		}
		if len(result.Rows) < query.Limit+1 {
			result.Rows = append(result.Rows, row)
		}
		return true, nil
	})
	if err != nil {
		return RecallMetricResult{}, err
	}
	if len(result.Rows) > query.Limit {
		last := result.Rows[query.Limit-1]
		result.NextCursor = RecallMetricCursor{SortTime: last.OccurredAt, RowID: last.RowID}
		result.Rows = result.Rows[:query.Limit]
	}
	return result, nil
}

func recallMetricConversionEventQuery(ctx context.Context, query RecallMetricQuery) *gorm.DB {
	firstCreated := DB.WithContext(ctx).Model(&RecallEvent{}).
		Select("recipient_id, MIN(created_at) AS created_at").
		Where("campaign_id = ? AND event_type = ? AND id <= ? AND recipient_id <> 0", query.CampaignID, "conversion", query.Snapshot.FactEventMaxID).
		Group("recipient_id")
	representatives := DB.WithContext(ctx).Table("recall_events AS candidates").
		Select("candidates.recipient_id, MIN(candidates.id) AS id").
		Joins("JOIN (?) AS first_created ON first_created.recipient_id = candidates.recipient_id AND first_created.created_at = candidates.created_at", firstCreated).
		Where("candidates.campaign_id = ? AND candidates.event_type = ? AND candidates.id <= ? AND candidates.recipient_id <> 0", query.CampaignID, "conversion", query.Snapshot.FactEventMaxID).
		Group("candidates.recipient_id")
	db := DB.WithContext(ctx).Model(&RecallEvent{}).
		Select("recall_events.*").
		Joins("JOIN (?) AS representative_events ON representative_events.id = recall_events.id", representatives)
	return db
}

func recallMetricConversionRowFromEvent(query RecallMetricQuery, event RecallEvent, recipient RecallRecipient, paymentCategories map[recallRevenueFactKey]string) (RecallMetricRow, bool, error) {
	eventData, err := decodeRecallMetricConversionEventData(event.EventData)
	if err != nil {
		return RecallMetricRow{}, false, err
	}
	if eventData.ConversionKind == "" {
		return RecallMetricRow{}, false, nil
	}
	row := recallMetricIdentityRowFromRecipient(recipient, event.Id)
	row.ConversionKind = eventData.ConversionKind
	row.TradeNo = eventData.ConversionTradeNo
	row.Currency = strings.ToUpper(strings.TrimSpace(eventData.ConversionCurrency))
	row.AmountMinor = eventData.ConversionAmount
	row.OccurredAt = event.CreatedAt
	row.PaymentCategory = eventData.PaymentCategory
	if row.PaymentCategory == "" {
		row.PaymentCategory = paymentCategories[recallRevenueFactKey{tradeNo: strings.TrimSpace(row.TradeNo), userID: recipient.UserId}]
	}
	if row.PaymentCategory == "" {
		row.PaymentCategory = string(RecallRevenueCategoryUnclassified)
	}
	if !recallMetricConversionMatches(query, row) {
		return RecallMetricRow{}, false, nil
	}
	return row, true, nil
}

func recallMetricPaymentCategoriesForEvents(ctx context.Context, query RecallMetricQuery, events []RecallEvent, recipients map[int64]RecallRecipient) (map[recallRevenueFactKey]string, error) {
	categories := make(map[recallRevenueFactKey]string, len(events))
	if len(events) == 0 {
		return categories, nil
	}
	tradeNos := make([]string, 0, len(events))
	seenTradeNos := make(map[string]struct{}, len(events))
	validKeys := make(map[recallRevenueFactKey]struct{}, len(events))
	for _, event := range events {
		recipient, ok := recipients[event.RecipientId]
		if !ok {
			continue
		}
		eventData, err := decodeRecallMetricConversionEventData(event.EventData)
		if err != nil {
			return nil, err
		}
		if eventData.PaymentCategory != "" {
			continue
		}
		tradeNo := strings.TrimSpace(eventData.ConversionTradeNo)
		if tradeNo == "" || recipient.UserId <= 0 {
			continue
		}
		key := recallRevenueFactKey{tradeNo: tradeNo, userID: recipient.UserId}
		validKeys[key] = struct{}{}
		if _, seen := seenTradeNos[tradeNo]; !seen {
			seenTradeNos[tradeNo] = struct{}{}
			tradeNos = append(tradeNos, tradeNo)
		}
	}
	if len(tradeNos) == 0 || len(validKeys) == 0 {
		return categories, nil
	}
	ordersByKey, err := recallMetricSnapshotSubscriptionOrders(ctx, query, tradeNos, validKeys)
	if err != nil {
		return nil, err
	}
	topUpsByKey, err := recallMetricSnapshotTopUps(ctx, query, tradeNos, validKeys)
	if err != nil {
		return nil, err
	}
	for key := range validKeys {
		categories[key] = string(classifyRecallRevenueFactKey(key, ordersByKey, topUpsByKey))
	}
	return categories, nil
}

func recallMetricSnapshotSubscriptionOrders(ctx context.Context, query RecallMetricQuery, tradeNos []string, validKeys map[recallRevenueFactKey]struct{}) (map[recallRevenueFactKey][]SubscriptionOrder, error) {
	ordersByKey := make(map[recallRevenueFactKey][]SubscriptionOrder)
	for start := 0; start < len(tradeNos); start += recallRevenueFactTradeNoChunkSize {
		end := min(start+recallRevenueFactTradeNoChunkSize, len(tradeNos))
		var orders []SubscriptionOrder
		if err := DB.WithContext(ctx).
			Where("trade_no IN ? AND status = ? AND id <= ? AND complete_time > 0 AND complete_time <= ?", tradeNos[start:end], common.TopUpStatusSuccess, query.Snapshot.SubscriptionOrderMaxID, query.Snapshot.AsOf).
			Find(&orders).Error; err != nil {
			return nil, err
		}
		for _, order := range orders {
			key := recallRevenueFactKey{tradeNo: strings.TrimSpace(order.TradeNo), userID: order.UserId}
			if _, ok := validKeys[key]; !ok {
				continue
			}
			ordersByKey[key] = append(ordersByKey[key], order)
		}
	}
	return ordersByKey, nil
}

func recallMetricSnapshotTopUps(ctx context.Context, query RecallMetricQuery, tradeNos []string, validKeys map[recallRevenueFactKey]struct{}) (map[recallRevenueFactKey][]TopUp, error) {
	topUpsByKey := make(map[recallRevenueFactKey][]TopUp)
	for start := 0; start < len(tradeNos); start += recallRevenueFactTradeNoChunkSize {
		end := min(start+recallRevenueFactTradeNoChunkSize, len(tradeNos))
		var topUps []TopUp
		if err := DB.WithContext(ctx).
			Where("trade_no IN ? AND status = ? AND id <= ? AND complete_time > 0 AND complete_time <= ?", tradeNos[start:end], common.TopUpStatusSuccess, query.Snapshot.TopUpMaxID, query.Snapshot.AsOf).
			Find(&topUps).Error; err != nil {
			return nil, err
		}
		for _, topUp := range topUps {
			key := recallRevenueFactKey{tradeNo: strings.TrimSpace(topUp.TradeNo), userID: topUp.UserId}
			if _, ok := validKeys[key]; !ok {
				continue
			}
			topUpsByKey[key] = append(topUpsByKey[key], topUp)
		}
	}
	return topUpsByKey, nil
}

func classifyRecallRevenueFactKey(key recallRevenueFactKey, ordersByKey map[recallRevenueFactKey][]SubscriptionOrder, topUpsByKey map[recallRevenueFactKey][]TopUp) RecallRevenueCategory {
	orders := ordersByKey[key]
	if len(orders) == 1 {
		if orders[0].PaymentProvider == PaymentProviderBalance {
			return RecallRevenueCategoryBalanceSubscription
		}
		return RecallRevenueCategoryOnlineSubscription
	}
	if len(orders) > 1 {
		return RecallRevenueCategoryUnclassified
	}
	if len(topUpsByKey[key]) == 1 {
		return RecallRevenueCategoryDirectTopUp
	}
	return RecallRevenueCategoryUnclassified
}

type recallMetricMessageState struct {
	MessageID   int64
	ToState     string
	OccurredAt  int64
	EventID     int64
	FailureCode string
}

type recallMetricConversionEventData struct {
	ConversionKind     string `json:"conversion_kind"`
	ConversionTradeNo  string `json:"trade_no"`
	ConversionCurrency string `json:"currency"`
	ConversionAmount   int64  `json:"amount_total"`
	DiscountAmount     int64  `json:"discount_amount"`
	PaymentCategory    string `json:"payment_category"`
}

func decodeRecallMetricConversionEventData(raw string) (recallMetricConversionEventData, error) {
	var data recallMetricConversionEventData
	if strings.TrimSpace(raw) == "" || strings.TrimSpace(raw) == "{}" {
		return data, nil
	}
	if err := common.Unmarshal([]byte(raw), &data); err != nil {
		return data, err
	}
	data.ConversionKind = strings.TrimSpace(data.ConversionKind)
	data.ConversionTradeNo = strings.TrimSpace(data.ConversionTradeNo)
	data.ConversionCurrency = strings.ToUpper(strings.TrimSpace(data.ConversionCurrency))
	data.PaymentCategory = strings.TrimSpace(data.PaymentCategory)
	return data, nil
}

func recallMetricConversionMatches(query RecallMetricQuery, row RecallMetricRow) bool {
	switch query.Metric {
	case "direct_conversions":
		if row.ConversionKind != RecallConversionDirect {
			return false
		}
	case "assisted_conversions":
		if row.ConversionKind != RecallConversionAssisted {
			return false
		}
	case "no_coupon_conversions":
		if row.ConversionKind != RecallConversionNoCoupon {
			return false
		}
	case "new_external_cash":
		if row.PaymentCategory != string(RecallRevenueCategoryDirectTopUp) && row.PaymentCategory != string(RecallRevenueCategoryOnlineSubscription) {
			return false
		}
	case "direct_topup", "balance_subscription", "online_subscription":
		if row.PaymentCategory != string(query.Metric) {
			return false
		}
	}
	if query.ConversionKind != "" && row.ConversionKind != query.ConversionKind {
		return false
	}
	if query.PaymentCategory != "" && row.PaymentCategory != query.PaymentCategory {
		return false
	}
	if query.Currency != "" && strings.ToUpper(row.Currency) != query.Currency {
		return false
	}
	return true
}

func recallMetricRecipientsByID(ctx context.Context, query RecallMetricQuery, ids []int64) (map[int64]RecallRecipient, error) {
	out := map[int64]RecallRecipient{}
	if len(ids) == 0 {
		return out, nil
	}
	const batchSize = 200
	for start := 0; start < len(ids); start += batchSize {
		end := start + batchSize
		if end > len(ids) {
			end = len(ids)
		}
		var recipients []RecallRecipient
		db := DB.WithContext(ctx).Where("campaign_id = ? AND id IN ? AND id <= ?", query.CampaignID, ids[start:end], query.Snapshot.RecipientMaxID)
		db = applyRecallMetricRecipientFilters(db, query, "")
		if err := db.Find(&recipients).Error; err != nil {
			return nil, err
		}
		for _, recipient := range recipients {
			out[recipient.Id] = recipient
		}
	}
	return out, nil
}

func recallMetricRowFromRecipient(recipient RecallRecipient) RecallMetricRow {
	return RecallMetricRow{
		RowID:       recipient.Id,
		RecipientID: recipient.Id,
		UserID:      recipient.UserId,
		Email:       recipient.EmailSnapshot,
		OccurredAt:  recipient.CreatedAt,
		State:       recipient.State,
	}
}

func recallMetricIdentityRowFromRecipient(recipient RecallRecipient, rowID int64) RecallMetricRow {
	return RecallMetricRow{
		RowID:       rowID,
		RecipientID: recipient.Id,
		UserID:      recipient.UserId,
		Email:       recipient.EmailSnapshot,
		OccurredAt:  recipient.CreatedAt,
	}
}

func recallMetricLegacyCampaignRunCount(ctx context.Context, query RecallMetricQuery, metric string) (int64, error) {
	var total int64
	afterID := int64(0)
	for {
		var events []RecallEvent
		if err := DB.WithContext(ctx).
			Where("campaign_id = ? AND event_type = ? AND id <= ? AND id > ?", query.CampaignID, "campaign_run", query.Snapshot.CampaignRunEventMaxID, afterID).
			Order("id ASC").
			Limit(recallMetricStreamingBatchSize).
			Find(&events).Error; err != nil {
			return 0, err
		}
		if len(events) == 0 {
			return total, nil
		}
		for _, event := range events {
			afterID = event.Id
			var data struct {
				EligibleTotal          int64            `json:"eligible_total"`
				Exclusions             map[string]int64 `json:"exclusions"`
				IdentityLedgerComplete bool             `json:"identity_ledger_complete"`
			}
			if strings.TrimSpace(event.EventData) == "" {
				continue
			}
			if err := common.Unmarshal([]byte(event.EventData), &data); err != nil {
				return 0, err
			}
			if data.IdentityLedgerComplete {
				continue
			}
			switch metric {
			case "candidates", "excluded":
				for _, count := range data.Exclusions {
					total += count
				}
			}
		}
		if len(events) < recallMetricStreamingBatchSize {
			return total, nil
		}
	}
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}
