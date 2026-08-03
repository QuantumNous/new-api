package model

import (
	"context"
)

type RecallMetricRowSink func(RecallMetricRow) (bool, error)

func StreamRecallMetricRows(ctx context.Context, query RecallMetricQuery, batchSize int, sink RecallMetricRowSink) (RecallMetricResult, error) {
	if batchSize <= 0 || batchSize > 500 {
		batchSize = 500
	}
	suppliedSnapshot := query.Snapshot.AsOf != 0
	query.Limit = batchSize
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
	if sink == nil {
		return result, nil
	}
	switch entry.Grain {
	case RecallMetricGrainIdentity:
		err = streamRecallMetricIdentityRows(ctx, query, batchSize, sink)
	case RecallMetricGrainMessage:
		err = streamRecallMetricMessageRows(ctx, query, batchSize, sink)
	case RecallMetricGrainConversion:
		err = streamRecallMetricConversionRows(ctx, query, batchSize, sink)
	default:
		err = ErrRecallMetricBadRequest
	}
	if err != nil {
		return RecallMetricResult{}, err
	}
	return result, nil
}

func ensureRecallMetricSnapshotReady(ctx context.Context, query RecallMetricQuery, entry RecallMetricRegistryEntry, suppliedSnapshot bool) error {
	if entry.Grain == RecallMetricGrainMessage && !suppliedSnapshot {
		if unbaselined, err := CountUnbaselinedRecallMessagesForCampaign(ctx, query.CampaignID); err != nil {
			return err
		} else if unbaselined > 0 {
			return ErrRecallMetricRetry
		}
	}
	return nil
}

func streamRecallMetricIdentityRows(ctx context.Context, query RecallMetricQuery, batchSize int, sink RecallMetricRowSink) error {
	switch query.Metric {
	case "enrolled":
		return streamRecallMetricRecipientRows(ctx, query, batchSize, sink)
	case "excluded":
		return streamRecallMetricExclusionRows(ctx, query, batchSize, sink)
	case "candidates":
		return streamRecallMetricCandidateRows(ctx, query, batchSize, sink)
	case "opened_recipients", "observed_clicks":
		eventType := "email_open"
		if query.Metric == "observed_clicks" {
			eventType = "observed_click"
		}
		return streamRecallMetricFactRecipientRows(ctx, query, eventType, batchSize, sink)
	default:
		return ErrRecallMetricBadRequest
	}
}

func streamRecallMetricRecipientRows(ctx context.Context, query RecallMetricQuery, _ int, sink RecallMetricRowSink) error {
	db := DB.WithContext(ctx).Model(&RecallRecipient{}).Where("campaign_id = ? AND id <= ?", query.CampaignID, query.Snapshot.RecipientMaxID)
	db = applyRecallMetricRecipientFilters(db, query, "")
	if query.Cursor.SortTime != 0 || query.Cursor.RowID != 0 {
		db = db.Where("created_at > ? OR (created_at = ? AND id > ?)", query.Cursor.SortTime, query.Cursor.SortTime, query.Cursor.RowID)
	}
	scanRows, err := db.Order("created_at ASC").Order("id ASC").Rows()
	if err != nil {
		return err
	}
	defer scanRows.Close()
	for scanRows.Next() {
		var recipient RecallRecipient
		if err := DB.ScanRows(scanRows, &recipient); err != nil {
			return err
		}
		keepGoing, err := sink(recallMetricIdentityRowFromRecipient(recipient, recipient.Id))
		if err != nil || !keepGoing {
			return err
		}
	}
	return scanRows.Err()
}

func streamRecallMetricExclusionRows(ctx context.Context, query RecallMetricQuery, _ int, sink RecallMetricRowSink) error {
	db := recallMetricExclusionBaseQuery(ctx, query, false)
	if query.Cursor.SortTime != 0 || query.Cursor.RowID != 0 {
		db = db.Where("first_seen_at > ? OR (first_seen_at = ? AND id > ?)", query.Cursor.SortTime, query.Cursor.SortTime, query.Cursor.RowID)
	}
	scanRows, err := db.Order("first_seen_at ASC").Order("id ASC").Rows()
	if err != nil {
		return err
	}
	defer scanRows.Close()
	for scanRows.Next() {
		var exclusion RecallCampaignExclusion
		if err := DB.ScanRows(scanRows, &exclusion); err != nil {
			return err
		}
		keepGoing, err := sink(RecallMetricRow{RowID: exclusion.Id, UserID: exclusion.UserId, OccurredAt: exclusion.FirstSeenAt})
		if err != nil || !keepGoing {
			return err
		}
	}
	return scanRows.Err()
}

func streamRecallMetricCandidateRows(ctx context.Context, query RecallMetricQuery, batchSize int, sink RecallMetricRowSink) error {
	left := newRecallMetricCandidateSource(query.Cursor, func(after RecallMetricCursor, started bool) ([]RecallMetricRow, error) {
		return recallMetricCandidateRecipientBatch(ctx, query, batchSize, after, started)
	})
	right := newRecallMetricCandidateSource(query.Cursor, func(after RecallMetricCursor, started bool) ([]RecallMetricRow, error) {
		return recallMetricCandidateExclusionBatch(ctx, query, batchSize, after, started)
	})
	if err := left.advance(); err != nil {
		return err
	}
	if err := right.advance(); err != nil {
		return err
	}
	for left.ok || right.ok {
		takeLeft := !right.ok || (left.ok && recallMetricCandidateBeforeOrEqual(left.row, right.row))
		row := right.row
		source := right
		if takeLeft {
			row = left.row
			source = left
		}
		keepGoing, err := sink(row)
		if err != nil || !keepGoing {
			return err
		}
		source.after = RecallMetricCursor{SortTime: row.OccurredAt, RowID: row.RowID}
		if err := source.advance(); err != nil {
			return err
		}
	}
	return nil
}

func recallMetricCandidateRecipientBatch(ctx context.Context, query RecallMetricQuery, batchSize int, after RecallMetricCursor, started bool) ([]RecallMetricRow, error) {
	db := DB.WithContext(ctx).Model(&RecallRecipient{}).Where("campaign_id = ? AND id <= ?", query.CampaignID, query.Snapshot.RecipientMaxID)
	db = applyRecallMetricRecipientFilters(db, query, "")
	if !started && (query.Cursor.SortTime != 0 || query.Cursor.RowID != 0) {
		db = db.Where("created_at >= ?", query.Cursor.SortTime)
	} else if after.SortTime != 0 || after.RowID != 0 {
		db = db.Where("created_at > ? OR (created_at = ? AND id > ?)", after.SortTime, after.SortTime, recallMetricCandidateLocalID(after.RowID))
	}
	var recipients []RecallRecipient
	if err := db.Order("created_at ASC").Order("id ASC").Limit(batchSize).Find(&recipients).Error; err != nil {
		return nil, err
	}
	rows := make([]RecallMetricRow, 0, len(recipients))
	for _, recipient := range recipients {
		rows = append(rows, recallMetricIdentityRowFromRecipient(recipient, encodeRecallMetricCandidateRowID(recipient.Id, recallMetricCandidateRecipientSource)))
	}
	return rows, nil
}

func recallMetricCandidateExclusionBatch(ctx context.Context, query RecallMetricQuery, batchSize int, after RecallMetricCursor, started bool) ([]RecallMetricRow, error) {
	db := recallMetricExclusionBaseQuery(ctx, query, true)
	if !started && (query.Cursor.SortTime != 0 || query.Cursor.RowID != 0) {
		db = db.Where("first_seen_at >= ?", query.Cursor.SortTime)
	} else if after.SortTime != 0 || after.RowID != 0 {
		db = db.Where("first_seen_at > ? OR (first_seen_at = ? AND id > ?)", after.SortTime, after.SortTime, recallMetricCandidateLocalID(after.RowID))
	}
	var exclusions []RecallCampaignExclusion
	if err := db.Order("first_seen_at ASC").Order("id ASC").Limit(batchSize).Find(&exclusions).Error; err != nil {
		return nil, err
	}
	rows := make([]RecallMetricRow, 0, len(exclusions))
	for _, exclusion := range exclusions {
		rows = append(rows, RecallMetricRow{RowID: encodeRecallMetricCandidateRowID(exclusion.Id, recallMetricCandidateExclusionSource), UserID: exclusion.UserId, OccurredAt: exclusion.FirstSeenAt})
	}
	return rows, nil
}

type recallMetricCandidateStreamSource struct {
	publicCursor RecallMetricCursor
	after        RecallMetricCursor
	load         func(RecallMetricCursor, bool) ([]RecallMetricRow, error)
	rows         []RecallMetricRow
	index        int
	started      bool
	exhausted    bool
	row          RecallMetricRow
	ok           bool
}

func newRecallMetricCandidateSource(publicCursor RecallMetricCursor, load func(RecallMetricCursor, bool) ([]RecallMetricRow, error)) *recallMetricCandidateStreamSource {
	return &recallMetricCandidateStreamSource{publicCursor: publicCursor, load: load}
}

func (source *recallMetricCandidateStreamSource) advance() error {
	for {
		if source.index >= len(source.rows) {
			if source.exhausted {
				source.ok = false
				return nil
			}
			rows, err := source.load(source.after, source.started)
			if err != nil {
				return err
			}
			source.started = true
			source.rows = rows
			source.index = 0
			if len(rows) == 0 {
				source.exhausted = true
				source.ok = false
				return nil
			}
		}
		row := source.rows[source.index]
		source.index++
		if recallMetricCursorIncludes(row, source.publicCursor) {
			source.after = RecallMetricCursor{SortTime: row.OccurredAt, RowID: row.RowID}
			continue
		}
		source.row = row
		source.ok = true
		return nil
	}
}

func recallMetricCursorIncludes(row RecallMetricRow, cursor RecallMetricCursor) bool {
	return (cursor.SortTime != 0 || cursor.RowID != 0) && (row.OccurredAt < cursor.SortTime || (row.OccurredAt == cursor.SortTime && row.RowID <= cursor.RowID))
}

func recallMetricCandidateLocalID(rowID int64) int64 {
	return rowID / 2
}

func recallMetricCandidateBeforeOrEqual(left RecallMetricRow, right RecallMetricRow) bool {
	return left.OccurredAt < right.OccurredAt || (left.OccurredAt == right.OccurredAt && left.RowID <= right.RowID)
}

func streamRecallMetricFactRecipientRows(ctx context.Context, query RecallMetricQuery, eventType string, batchSize int, sink RecallMetricRowSink) error {
	after := RecallMetricCursor{}
	started := false
	for {
		batch, err := recallMetricFactRecipientBatch(ctx, query, eventType, batchSize, after, started)
		if err != nil {
			return err
		}
		started = true
		if len(batch) == 0 {
			return nil
		}
		recipientIDs := make([]int64, 0, len(batch))
		for _, event := range batch {
			recipientIDs = append(recipientIDs, event.RecipientId)
		}
		recipients, err := recallMetricRecipientsByID(ctx, query, recipientIDs)
		if err != nil {
			return err
		}
		for _, event := range batch {
			after = RecallMetricCursor{SortTime: event.CreatedAt, RowID: event.Id}
			recipient, ok := recipients[event.RecipientId]
			if !ok {
				continue
			}
			if query.Cursor.SortTime != 0 || query.Cursor.RowID != 0 {
				if event.CreatedAt < query.Cursor.SortTime || (event.CreatedAt == query.Cursor.SortTime && event.Id <= query.Cursor.RowID) {
					continue
				}
			}
			row := recallMetricIdentityRowFromRecipient(recipient, event.Id)
			row.OccurredAt = event.CreatedAt
			keepGoing, err := sink(row)
			if err != nil || !keepGoing {
				return err
			}
		}
		if len(batch) < batchSize {
			return nil
		}
	}
}

func recallMetricFactRecipientBatch(ctx context.Context, query RecallMetricQuery, eventType string, batchSize int, after RecallMetricCursor, started bool) ([]RecallEvent, error) {
	db := recallMetricRepresentativeFactEvents(ctx, query, eventType)
	if !started && (query.Cursor.SortTime != 0 || query.Cursor.RowID != 0) {
		db = db.Where("recall_events.created_at >= ?", query.Cursor.SortTime)
	} else if after.SortTime != 0 || after.RowID != 0 {
		db = db.Where("recall_events.created_at > ? OR (recall_events.created_at = ? AND recall_events.id > ?)", after.SortTime, after.SortTime, after.RowID)
	}
	var events []RecallEvent
	err := db.Order("recall_events.created_at ASC").Order("recall_events.id ASC").Limit(batchSize).Find(&events).Error
	return events, err
}

func streamRecallMetricMessageRows(ctx context.Context, query RecallMetricQuery, batchSize int, sink RecallMetricRowSink) error {
	wantState := RecallMessageAccepted
	if query.Metric == "messages_failed" {
		wantState = RecallMessageFailed
	}
	after := RecallMetricCursor{}
	started := false
	for {
		batch, err := recallMetricMessageStateBatch(ctx, query, batchSize, after, started)
		if err != nil {
			return err
		}
		started = true
		if len(batch) == 0 {
			return nil
		}
		recipientIDs := make([]int64, 0, len(batch))
		for _, event := range batch {
			recipientIDs = append(recipientIDs, event.RecipientId)
		}
		recipients, err := recallMetricRecipientsByID(ctx, query, recipientIDs)
		if err != nil {
			return err
		}
		messages, err := recallMetricMessagesByID(ctx, batch)
		if err != nil {
			return err
		}
		for _, event := range batch {
			after = RecallMetricCursor{SortTime: event.CreatedAt, RowID: event.MessageId}
			state, err := decodeRecallMetricMessageStateEvent(event)
			if err != nil {
				return err
			}
			if state.ToState != wantState || state.MessageID <= 0 {
				continue
			}
			recipient, ok := recipients[event.RecipientId]
			if !ok {
				continue
			}
			message, ok := messages[state.MessageID]
			if !ok {
				continue
			}
			if query.Cursor.SortTime != 0 || query.Cursor.RowID != 0 {
				if event.CreatedAt < query.Cursor.SortTime || (event.CreatedAt == query.Cursor.SortTime && state.MessageID <= query.Cursor.RowID) {
					continue
				}
			}
			row := recallMetricIdentityRowFromRecipient(recipient, state.MessageID)
			row.MessageID = state.MessageID
			row.OccurredAt = event.CreatedAt
			row.StageNo = message.StageNo
			row.State = state.ToState
			row.FailureCode = state.FailureCode
			keepGoing, err := sink(row)
			if err != nil || !keepGoing {
				return err
			}
		}
		if len(batch) < batchSize {
			return nil
		}
	}
}

func recallMetricMessageStateBatch(ctx context.Context, query RecallMetricQuery, batchSize int, after RecallMetricCursor, started bool) ([]RecallEvent, error) {
	db := recallMetricLatestMessageStateQuery(ctx, query)
	if !started && (query.Cursor.SortTime != 0 || query.Cursor.RowID != 0) {
		db = db.Where("recall_events.created_at >= ?", query.Cursor.SortTime)
	} else if after.SortTime != 0 || after.RowID != 0 {
		db = db.Where("recall_events.created_at > ? OR (recall_events.created_at = ? AND recall_events.message_id > ?)", after.SortTime, after.SortTime, after.RowID)
	}
	var events []RecallEvent
	err := db.Order("recall_events.created_at ASC").Order("recall_events.message_id ASC").Limit(batchSize).Find(&events).Error
	return events, err
}

func streamRecallMetricConversionRows(ctx context.Context, query RecallMetricQuery, batchSize int, sink RecallMetricRowSink) error {
	after := RecallMetricCursor{}
	started := false
	for {
		events, err := recallMetricConversionEventBatch(ctx, query, batchSize, after, started)
		if err != nil {
			return err
		}
		started = true
		if len(events) == 0 {
			return nil
		}
		recipientIDs := make([]int64, 0, len(events))
		for _, event := range events {
			recipientIDs = append(recipientIDs, event.RecipientId)
		}
		recipients, err := recallMetricRecipientsByID(ctx, query, recipientIDs)
		if err != nil {
			return err
		}
		paymentCategories, err := recallMetricPaymentCategoriesForEvents(ctx, query, events, recipients)
		if err != nil {
			return err
		}
		for _, event := range events {
			after = RecallMetricCursor{SortTime: event.CreatedAt, RowID: event.Id}
			recipient, ok := recipients[event.RecipientId]
			if !ok {
				continue
			}
			row, ok, err := recallMetricConversionRowFromEvent(query, event, recipient, paymentCategories)
			if err != nil {
				return err
			}
			if !ok {
				continue
			}
			if query.Cursor.SortTime != 0 || query.Cursor.RowID != 0 {
				if row.OccurredAt < query.Cursor.SortTime || (row.OccurredAt == query.Cursor.SortTime && row.RowID <= query.Cursor.RowID) {
					continue
				}
			}
			keepGoing, err := sink(row)
			if err != nil || !keepGoing {
				return err
			}
		}
		if len(events) < batchSize {
			return nil
		}
	}
}

func recallMetricConversionEventBatch(ctx context.Context, query RecallMetricQuery, batchSize int, after RecallMetricCursor, started bool) ([]RecallEvent, error) {
	db := recallMetricConversionEventQuery(ctx, query)
	if !started && (query.Cursor.SortTime != 0 || query.Cursor.RowID != 0) {
		db = db.Where("recall_events.created_at >= ?", query.Cursor.SortTime)
	} else if after.SortTime != 0 || after.RowID != 0 {
		db = db.Where("recall_events.created_at > ? OR (recall_events.created_at = ? AND recall_events.id > ?)", after.SortTime, after.SortTime, after.RowID)
	}
	var events []RecallEvent
	err := db.Order("recall_events.created_at ASC").Order("recall_events.id ASC").Limit(batchSize).Find(&events).Error
	return events, err
}
