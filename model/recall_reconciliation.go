package model

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

const (
	recallAttributionProgressSource    = "recall_reconciliation"
	recallAttributionProgressLeased    = "reconciliation_leased"
	recallAttributionProgressRetry     = "reconciliation_retry"
	recallAttributionProgressTerminal  = "reconciliation_terminal"
	recallAttributionOutcomeMaxLength  = 64
	recallAttributionCursorEventType   = "reconciliation_cursor"
	recallAttributionCursorSourceID    = "cursor:v1"
	recallAttributionPhaseSubscription = "subscription"
	recallAttributionPhaseTopUp        = "topup"
	recallAttributionScanMultiplier    = 8
	recallAttributionMaxPageSize       = 200
)

type RecallAttributionLease struct {
	SourceEventId  string
	LeaseExpiresAt int64
	Attempt        int
}

type recallAttributionProgressData struct {
	Attempt     int    `json:"attempt"`
	OutcomeCode string `json:"outcome_code,omitempty"`
}

type recallAttributionCursor struct {
	Phase   string `json:"phase"`
	OrderId int    `json:"order_id"`
}

type recallAttributionOrderRow struct {
	Id                int    `gorm:"column:id"`
	TradeNo           string `gorm:"column:trade_no"`
	UserId            int    `gorm:"column:user_id"`
	PaymentProvider   string `gorm:"column:payment_provider"`
	Status            string `gorm:"column:status"`
	ProviderPayload   string `gorm:"column:provider_payload"`
	CheckoutSessionId string `gorm:"column:checkout_session_id"`
	OrderCreatedAt    int64  `gorm:"column:order_created_at"`
}

type recallAttributionEnrollmentRow struct {
	UserId     int   `gorm:"column:user_id"`
	EnrolledAt int64 `gorm:"column:enrolled_at"`
}

type recallAttributionDuplicateSubscriptionRow struct {
	TradeNo string `gorm:"column:trade_no"`
	UserId  int    `gorm:"column:user_id"`
}

type recallAttributionOrderKey struct {
	TradeNo string
	UserId  int
}

// ListRecallAttributionCandidatesWithContext scans at most eight times the
// requested batch size. Each keyset page is capped at the smaller of the batch
// size and 200 rows, so neither result materialization nor progress lookups can
// grow with the full recipient or payment history.
func ListRecallAttributionCandidatesWithContext(ctx context.Context, nowUnix int64, limit int) ([]RecallAttributionCandidate, error) {
	candidates := make([]RecallAttributionCandidate, 0)
	selectedSourceEventIDs := make(map[string]struct{})
	if limit <= 0 {
		return candidates, nil
	}
	cursor, expectedCursorData, err := loadRecallAttributionCursorWithContext(ctx, nowUnix)
	if err != nil {
		return nil, err
	}
	maxInt := int(^uint(0) >> 1)
	scanBudget := maxInt
	if limit <= maxInt/recallAttributionScanMultiplier {
		scanBudget = limit * recallAttributionScanMultiplier
	}
	scanned := 0
	wrapped := false
	for scanned < scanBudget && len(candidates) < limit {
		pageSize := min(limit-len(candidates), recallAttributionMaxPageSize, scanBudget-scanned)
		rows, err := listRecallAttributionOrderPageWithContext(ctx, cursor, pageSize)
		if err != nil {
			return nil, err
		}
		if len(rows) == 0 {
			if cursor.Phase == recallAttributionPhaseSubscription {
				cursor = recallAttributionCursor{Phase: recallAttributionPhaseTopUp}
				continue
			}
			if wrapped {
				break
			}
			cursor = recallAttributionCursor{Phase: recallAttributionPhaseSubscription}
			wrapped = true
			continue
		}
		scanned += len(rows)
		cursor.OrderId = rows[len(rows)-1].Id
		pageCandidates, err := recallAttributionCandidatesFromOrderRowsWithContext(ctx, rows, cursor.Phase)
		if err != nil {
			return nil, err
		}
		eligible, err := filterRecallAttributionCandidatesWithContext(ctx, pageCandidates, nowUnix, len(pageCandidates))
		if err != nil {
			return nil, err
		}
		for _, candidate := range eligible {
			sourceEventID := recallAttributionSourceEventID(candidate)
			if _, selected := selectedSourceEventIDs[sourceEventID]; selected {
				continue
			}
			selectedSourceEventIDs[sourceEventID] = struct{}{}
			candidates = append(candidates, candidate)
			if len(candidates) == limit {
				break
			}
		}
	}
	if err := storeRecallAttributionCursorWithContext(ctx, expectedCursorData, cursor, nowUnix); err != nil {
		return nil, err
	}
	return candidates, nil
}

func listRecallAttributionOrderPageWithContext(ctx context.Context, cursor recallAttributionCursor, limit int) ([]recallAttributionOrderRow, error) {
	rows := make([]recallAttributionOrderRow, 0, limit)
	if limit <= 0 {
		return rows, nil
	}
	query := recallAttributionOrderPageQueryWithContext(ctx, DB, cursor, limit)
	return rows, query.Scan(&rows).Error
}

func recallAttributionOrderPageQueryWithContext(ctx context.Context, db *gorm.DB, cursor recallAttributionCursor, limit int) *gorm.DB {
	query := db.WithContext(ctx).
		Table(recallAttributionOrderTable(cursor.Phase)+" AS recall_orders").
		Where("recall_orders.id > ?", cursor.OrderId).
		Order("recall_orders.id ASC").
		Limit(min(limit, recallAttributionMaxPageSize))
	if cursor.Phase == recallAttributionPhaseSubscription {
		query = query.Select(
			"recall_orders.id, recall_orders.trade_no, recall_orders.user_id, recall_orders.payment_provider, recall_orders.status, recall_orders.provider_payload, recall_orders.create_time AS order_created_at",
		)
	} else {
		query = query.Select(
			"recall_orders.id, recall_orders.trade_no, recall_orders.user_id, recall_orders.payment_provider, recall_orders.status, recall_orders.gateway_trade_no AS checkout_session_id, recall_orders.create_time AS order_created_at",
		)
	}
	return query
}

func recallAttributionOrderTable(phase string) string {
	if phase == recallAttributionPhaseTopUp {
		return "top_ups"
	}
	return "subscription_orders"
}

func recallAttributionCandidatesFromOrderRowsWithContext(ctx context.Context, rows []recallAttributionOrderRow, phase string) ([]RecallAttributionCandidate, error) {
	relevantRows := make([]recallAttributionOrderRow, 0, len(rows))
	userIDs := make([]int, 0, len(rows))
	seenUserIDs := make(map[int]struct{}, len(rows))
	for _, row := range rows {
		if row.PaymentProvider != PaymentProviderStripe || row.Status != common.TopUpStatusSuccess {
			continue
		}
		relevantRows = append(relevantRows, row)
		if _, seen := seenUserIDs[row.UserId]; !seen {
			seenUserIDs[row.UserId] = struct{}{}
			userIDs = append(userIDs, row.UserId)
		}
	}
	if len(relevantRows) == 0 {
		return []RecallAttributionCandidate{}, nil
	}
	enrolledAtByUser, err := recallAttributionEnrollmentByUserWithContext(ctx, userIDs)
	if err != nil {
		return nil, err
	}
	duplicateSubscriptions := make(map[recallAttributionOrderKey]struct{})
	if phase == recallAttributionPhaseTopUp {
		tradeNos := make([]string, 0, len(relevantRows))
		seenTradeNos := make(map[string]struct{}, len(relevantRows))
		for _, row := range relevantRows {
			if _, enrolled := enrolledAtByUser[row.UserId]; !enrolled {
				continue
			}
			if _, seen := seenTradeNos[row.TradeNo]; !seen {
				seenTradeNos[row.TradeNo] = struct{}{}
				tradeNos = append(tradeNos, row.TradeNo)
			}
		}
		duplicateSubscriptions, err = recallAttributionDuplicateSubscriptionsWithContext(ctx, tradeNos)
		if err != nil {
			return nil, err
		}
	}
	candidates := make([]RecallAttributionCandidate, 0, len(relevantRows))
	for _, row := range relevantRows {
		enrolledAt, enrolled := enrolledAtByUser[row.UserId]
		if !enrolled || row.OrderCreatedAt < enrolledAt {
			continue
		}
		if _, duplicate := duplicateSubscriptions[recallAttributionOrderKey{TradeNo: strings.TrimSpace(row.TradeNo), UserId: row.UserId}]; duplicate {
			continue
		}
		candidate, ok := recallAttributionCandidateFromOrderRow(row, phase, enrolledAt)
		if ok {
			candidates = append(candidates, candidate)
		}
	}
	return candidates, nil
}

func recallAttributionEnrollmentByUserWithContext(ctx context.Context, userIDs []int) (map[int]int64, error) {
	enrolledAtByUser := make(map[int]int64, len(userIDs))
	if len(userIDs) == 0 {
		return enrolledAtByUser, nil
	}
	rows := make([]recallAttributionEnrollmentRow, 0, len(userIDs))
	err := DB.WithContext(ctx).
		Model(&RecallRecipient{}).
		Select("user_id, MIN(created_at) AS enrolled_at").
		Where("converted_at = 0 AND state IN ? AND user_id IN ?", recallClaimActiveRecipientStates(), userIDs).
		Group("user_id").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	for _, row := range rows {
		enrolledAtByUser[row.UserId] = row.EnrolledAt
	}
	return enrolledAtByUser, nil
}

func recallAttributionDuplicateSubscriptionsWithContext(ctx context.Context, tradeNos []string) (map[recallAttributionOrderKey]struct{}, error) {
	duplicates := make(map[recallAttributionOrderKey]struct{}, len(tradeNos))
	if len(tradeNos) == 0 {
		return duplicates, nil
	}
	rows := make([]recallAttributionDuplicateSubscriptionRow, 0, len(tradeNos))
	err := DB.WithContext(ctx).
		Model(&SubscriptionOrder{}).
		Select("trade_no", "user_id").
		Where("trade_no IN ? AND payment_provider = ? AND status = ?", tradeNos, PaymentProviderStripe, common.TopUpStatusSuccess).
		Find(&rows).Error
	if err != nil {
		return nil, err
	}
	for _, row := range rows {
		duplicates[recallAttributionOrderKey{TradeNo: strings.TrimSpace(row.TradeNo), UserId: row.UserId}] = struct{}{}
	}
	return duplicates, nil
}

func recallAttributionCandidateFromOrderRow(row recallAttributionOrderRow, phase string, enrolledAt int64) (RecallAttributionCandidate, bool) {
	sessionID := strings.TrimSpace(row.CheckoutSessionId)
	if phase == recallAttributionPhaseSubscription {
		sessionID = StripeCheckoutSessionIDFromProviderPayload(row.ProviderPayload)
	}
	if sessionID == "" {
		return RecallAttributionCandidate{}, false
	}
	return RecallAttributionCandidate{
		TradeNo: strings.TrimSpace(row.TradeNo), UserId: row.UserId, CheckoutSessionId: sessionID,
		OrderCreatedAt: row.OrderCreatedAt, EnrolledAt: enrolledAt,
	}, true
}

func loadRecallAttributionCursorWithContext(ctx context.Context, nowUnix int64) (recallAttributionCursor, string, error) {
	cursor := recallAttributionCursor{Phase: recallAttributionPhaseSubscription}
	initialData, err := marshalRecallAttributionCursor(cursor)
	if err != nil {
		return recallAttributionCursor{}, "", err
	}
	event := RecallEvent{
		EventType: recallAttributionCursorEventType, Source: recallAttributionProgressSource,
		SourceEventId: recallAttributionCursorSourceID, EventData: initialData, CreatedAt: nowUnix,
	}
	result := insertRecallRunEvent(DB.WithContext(ctx), &event)
	if result.Error != nil {
		return recallAttributionCursor{}, "", result.Error
	}
	if result.RowsAffected == 1 {
		return cursor, initialData, nil
	}
	stored := RecallEvent{}
	if err := DB.WithContext(ctx).
		Select("event_type", "event_data").
		Where("source = ? AND source_event_id = ?", recallAttributionProgressSource, recallAttributionCursorSourceID).
		First(&stored).Error; err != nil {
		return recallAttributionCursor{}, "", err
	}
	if stored.EventType != recallAttributionCursorEventType {
		return recallAttributionCursor{}, "", errors.New("recall attribution cursor event has unexpected type")
	}
	if err := common.Unmarshal([]byte(stored.EventData), &cursor); err != nil {
		return recallAttributionCursor{}, "", fmt.Errorf("unmarshal recall attribution cursor: %w", err)
	}
	if cursor.Phase != recallAttributionPhaseSubscription && cursor.Phase != recallAttributionPhaseTopUp {
		return recallAttributionCursor{}, "", errors.New("recall attribution cursor has invalid phase")
	}
	return cursor, stored.EventData, nil
}

func storeRecallAttributionCursorWithContext(ctx context.Context, expectedData string, cursor recallAttributionCursor, nowUnix int64) error {
	cursorData, err := marshalRecallAttributionCursor(cursor)
	if err != nil {
		return err
	}
	if cursorData == expectedData {
		return nil
	}
	result := DB.WithContext(ctx).Model(&RecallEvent{}).
		Where("source = ? AND source_event_id = ? AND event_type = ? AND event_data = ?",
			recallAttributionProgressSource, recallAttributionCursorSourceID, recallAttributionCursorEventType, expectedData).
		Updates(map[string]any{"event_data": cursorData, "created_at": nowUnix})
	return result.Error
}

func marshalRecallAttributionCursor(cursor recallAttributionCursor) (string, error) {
	data, err := common.Marshal(cursor)
	if err != nil {
		return "", fmt.Errorf("marshal recall attribution cursor: %w", err)
	}
	return string(data), nil
}

func filterRecallAttributionCandidatesWithContext(ctx context.Context, candidates []RecallAttributionCandidate, nowUnix int64, limit int) ([]RecallAttributionCandidate, error) {
	if limit <= 0 || len(candidates) == 0 {
		return []RecallAttributionCandidate{}, nil
	}
	eligible := make([]RecallAttributionCandidate, 0, min(limit, len(candidates)))

	sourceEventIDs := make([]string, len(candidates))
	for i := range candidates {
		sourceEventIDs[i] = recallAttributionSourceEventID(candidates[i])
	}
	progressBySourceEventID := make(map[string]RecallEvent)
	for start := 0; start < len(sourceEventIDs); start += recallRunBatchSize {
		end := min(start+recallRunBatchSize, len(sourceEventIDs))
		var progress []RecallEvent
		if err := DB.WithContext(ctx).
			Select("source_event_id", "event_type", "created_at").
			Where("source = ? AND source_event_id IN ?", recallAttributionProgressSource, sourceEventIDs[start:end]).
			Find(&progress).Error; err != nil {
			return nil, err
		}
		for _, event := range progress {
			progressBySourceEventID[event.SourceEventId] = event
		}
	}

	for i, candidate := range candidates {
		if progress, exists := progressBySourceEventID[sourceEventIDs[i]]; exists {
			if progress.EventType == recallAttributionProgressTerminal {
				continue
			}
			if (progress.EventType == recallAttributionProgressLeased || progress.EventType == recallAttributionProgressRetry) && progress.CreatedAt > nowUnix {
				continue
			}
		}
		eligible = append(eligible, candidate)
		if len(eligible) == limit {
			break
		}
	}
	return eligible, nil
}

func LeaseRecallAttributionCandidateWithContext(ctx context.Context, candidate RecallAttributionCandidate, nowUnix int64, leaseUntil int64) (RecallAttributionLease, bool, error) {
	if leaseUntil <= nowUnix {
		return RecallAttributionLease{}, false, errors.New("recall attribution lease expiry must be after acquisition time")
	}
	sourceEventID := recallAttributionSourceEventID(candidate)
	lease := RecallAttributionLease{SourceEventId: sourceEventID, LeaseExpiresAt: leaseUntil, Attempt: 1}
	eventData, err := marshalRecallAttributionProgressData(lease.Attempt, "")
	if err != nil {
		return RecallAttributionLease{}, false, err
	}
	event := RecallEvent{
		EventType: recallAttributionProgressLeased, Source: recallAttributionProgressSource,
		SourceEventId: sourceEventID, EventData: eventData, CreatedAt: leaseUntil,
	}
	result := insertRecallRunEvent(DB.WithContext(ctx), &event)
	if result.Error != nil {
		return RecallAttributionLease{}, false, result.Error
	}
	if result.RowsAffected == 1 {
		return lease, true, nil
	}

	stored := RecallEvent{}
	if err := DB.WithContext(ctx).
		Select("event_type", "event_data", "created_at").
		Where("source = ? AND source_event_id = ?", recallAttributionProgressSource, sourceEventID).
		First(&stored).Error; err != nil {
		return RecallAttributionLease{}, false, err
	}
	if stored.EventType == recallAttributionProgressTerminal || stored.CreatedAt > nowUnix {
		return RecallAttributionLease{}, false, nil
	}
	progressData := recallAttributionProgressData{}
	if strings.TrimSpace(stored.EventData) != "" {
		if err := common.Unmarshal([]byte(stored.EventData), &progressData); err != nil {
			return RecallAttributionLease{}, false, fmt.Errorf("unmarshal recall attribution progress: %w", err)
		}
	}
	lease.Attempt = progressData.Attempt + 1
	if lease.Attempt < 1 {
		lease.Attempt = 1
	}
	eventData, err = marshalRecallAttributionProgressData(lease.Attempt, "")
	if err != nil {
		return RecallAttributionLease{}, false, err
	}
	result = DB.WithContext(ctx).Model(&RecallEvent{}).
		Where("source = ? AND source_event_id = ? AND event_type = ? AND created_at = ? AND created_at <= ?",
			recallAttributionProgressSource, sourceEventID, stored.EventType, stored.CreatedAt, nowUnix).
		Updates(map[string]any{
			"event_type": recallAttributionProgressLeased,
			"event_data": eventData,
			"created_at": leaseUntil,
		})
	if result.Error != nil {
		return RecallAttributionLease{}, false, result.Error
	}
	return lease, result.RowsAffected == 1, nil
}

func CompleteRecallAttributionCandidateWithContext(ctx context.Context, candidate RecallAttributionCandidate, lease RecallAttributionLease, completedAt int64, outcomeCode string) (bool, error) {
	return updateRecallAttributionProgressWithContext(ctx, candidate, lease, recallAttributionProgressTerminal, completedAt, outcomeCode)
}

func RetryRecallAttributionCandidateWithContext(ctx context.Context, candidate RecallAttributionCandidate, lease RecallAttributionLease, nextAttemptAt int64, outcomeCode string) (bool, error) {
	return updateRecallAttributionProgressWithContext(ctx, candidate, lease, recallAttributionProgressRetry, nextAttemptAt, outcomeCode)
}

func updateRecallAttributionProgressWithContext(ctx context.Context, candidate RecallAttributionCandidate, lease RecallAttributionLease, eventType string, dueAt int64, outcomeCode string) (bool, error) {
	sourceEventID := recallAttributionSourceEventID(candidate)
	if lease.SourceEventId != sourceEventID || lease.LeaseExpiresAt <= 0 || lease.Attempt <= 0 {
		return false, errors.New("invalid recall attribution lease")
	}
	eventData, err := marshalRecallAttributionProgressData(lease.Attempt, outcomeCode)
	if err != nil {
		return false, err
	}
	result := DB.WithContext(ctx).Model(&RecallEvent{}).
		Where("source = ? AND source_event_id = ? AND event_type = ? AND created_at = ?",
			recallAttributionProgressSource, sourceEventID, recallAttributionProgressLeased, lease.LeaseExpiresAt).
		Updates(map[string]any{
			"event_type": eventType,
			"event_data": eventData,
			"created_at": dueAt,
		})
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected == 1, nil
}

func recallAttributionSourceEventID(candidate RecallAttributionCandidate) string {
	digest := sha256.Sum256([]byte(fmt.Sprintf("%d\x00%s\x00%s", candidate.UserId, strings.TrimSpace(candidate.TradeNo), strings.TrimSpace(candidate.CheckoutSessionId))))
	return "order:" + hex.EncodeToString(digest[:])
}

func marshalRecallAttributionProgressData(attempt int, outcomeCode string) (string, error) {
	outcomeCode = strings.TrimSpace(outcomeCode)
	if len(outcomeCode) > recallAttributionOutcomeMaxLength {
		return "", fmt.Errorf("recall attribution outcome code exceeds %d bytes", recallAttributionOutcomeMaxLength)
	}
	data, err := common.Marshal(recallAttributionProgressData{Attempt: attempt, OutcomeCode: outcomeCode})
	if err != nil {
		return "", fmt.Errorf("marshal recall attribution progress: %w", err)
	}
	return string(data), nil
}
