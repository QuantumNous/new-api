package model

import (
	"bytes"
	"compress/gzip"
	"context"
	"fmt"
	"io"
	"sort"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	RecallExclusionBatchPreviewed      = "previewed"
	RecallExclusionBatchPreviewBlocked = "preview_blocked"
	RecallExclusionBatchApplied        = "applied"
)

type RecallExclusionBatch struct {
	Id                      int64  `json:"id" gorm:"primaryKey"`
	CampaignId              int64  `json:"campaign_id" gorm:"index;not null"`
	Status                  string `json:"status" gorm:"type:varchar(16);not null;index"`
	FileSHA256              string `json:"file_sha256" gorm:"type:char(64);not null;index"`
	TotalRows               int64  `json:"total_rows"`
	ResolvedUsers           int64  `json:"resolved_users"`
	DuplicateRows           int64  `json:"duplicate_rows"`
	UnresolvedRows          int64  `json:"unresolved_rows"`
	ConflictRows            int64  `json:"conflict_rows"`
	CancelledMessages       int64  `json:"cancelled_messages"`
	ResolvedUserIDsSnapshot []byte `json:"-"`
	UploadedBy              int    `json:"uploaded_by"`
	CreatedAt               int64  `json:"created_at" gorm:"autoCreateTime"`
	AppliedAt               int64  `json:"applied_at"`
}

type RecallCampaignExclusion struct {
	Id                   int64  `json:"id" gorm:"primaryKey"`
	CampaignId           int64  `json:"campaign_id" gorm:"uniqueIndex:idx_recall_exclusion_campaign_identity,priority:1;index"`
	RecipientIdentity    string `json:"recipient_identity" gorm:"type:varchar(96);uniqueIndex:idx_recall_exclusion_campaign_identity,priority:2"`
	UserId               int    `json:"user_id" gorm:"index"`
	Persistent           bool   `json:"persistent" gorm:"index"`
	PersistentReasonCode string `json:"persistent_reason_code" gorm:"type:varchar(64)"`
	LastRunReasonCode    string `json:"last_run_reason_code" gorm:"type:varchar(64)"`
	SourceBatchId        int64  `json:"source_batch_id" gorm:"index"`
	FirstRunEventId      int64  `json:"first_run_event_id" gorm:"index"`
	LastRunEventId       int64  `json:"last_run_event_id" gorm:"index"`
	FirstSeenAt          int64  `json:"first_seen_at"`
	LastSeenAt           int64  `json:"last_seen_at" gorm:"index"`
	CreatedBy            int    `json:"created_by"`
}

type RecallExclusionBatchInput struct {
	CampaignID              int64
	FileSHA256              string
	TotalRows               int64
	ResolvedUsers           int64
	DuplicateRows           int64
	UnresolvedRows          int64
	ConflictRows            int64
	ResolvedUserIDsSnapshot []byte
	UploadedBy              int
	Blocked                 bool
}

type RecallExclusionApplyOutcome struct {
	BatchID           int64
	CancelledMessages int64
	AppliedAt         int64
}

func RecallExclusionCampaignStatusConfirmable(status string) bool {
	switch status {
	case RecallCampaignScheduled, RecallCampaignRunning, RecallCampaignPaused:
		return true
	default:
		return false
	}
}

func EncodeRecallExclusionUserIDs(userIDs []int) ([]byte, error) {
	normalized := normalizeRecallExclusionUserIDs(userIDs)
	data, err := common.Marshal(normalized)
	if err != nil {
		return nil, err
	}
	var buffer bytes.Buffer
	writer := gzip.NewWriter(&buffer)
	if _, err := writer.Write(data); err != nil {
		_ = writer.Close()
		return nil, err
	}
	if err := writer.Close(); err != nil {
		return nil, err
	}
	return buffer.Bytes(), nil
}

func DecodeRecallExclusionUserIDs(snapshot []byte) ([]int, error) {
	reader, err := gzip.NewReader(bytes.NewReader(snapshot))
	if err != nil {
		return nil, err
	}
	defer reader.Close()
	data, err := io.ReadAll(reader)
	if err != nil {
		return nil, err
	}
	var userIDs []int
	if err := common.Unmarshal(data, &userIDs); err != nil {
		return nil, err
	}
	return normalizeRecallExclusionUserIDs(userIDs), nil
}

func normalizeRecallExclusionUserIDs(userIDs []int) []int {
	seen := make(map[int]struct{}, len(userIDs))
	normalized := make([]int, 0, len(userIDs))
	for _, userID := range userIDs {
		if userID <= 0 {
			continue
		}
		if _, exists := seen[userID]; exists {
			continue
		}
		seen[userID] = struct{}{}
		normalized = append(normalized, userID)
	}
	sort.Ints(normalized)
	return normalized
}

func CreateRecallExclusionBatchWithContext(ctx context.Context, input RecallExclusionBatchInput) (*RecallExclusionBatch, error) {
	if input.CampaignID <= 0 || input.UploadedBy <= 0 {
		return nil, fmt.Errorf("recall exclusion batch requires campaign and uploader")
	}
	status := RecallExclusionBatchPreviewed
	if input.Blocked {
		status = RecallExclusionBatchPreviewBlocked
	}
	batch := &RecallExclusionBatch{
		CampaignId:              input.CampaignID,
		Status:                  status,
		FileSHA256:              strings.TrimSpace(input.FileSHA256),
		TotalRows:               input.TotalRows,
		ResolvedUsers:           input.ResolvedUsers,
		DuplicateRows:           input.DuplicateRows,
		UnresolvedRows:          input.UnresolvedRows,
		ConflictRows:            input.ConflictRows,
		ResolvedUserIDsSnapshot: input.ResolvedUserIDsSnapshot,
		UploadedBy:              input.UploadedBy,
	}
	if batch.FileSHA256 == "" || len(batch.ResolvedUserIDsSnapshot) == 0 {
		return nil, fmt.Errorf("recall exclusion batch requires immutable file and user snapshots")
	}
	if err := DB.WithContext(ctx).Create(batch).Error; err != nil {
		return nil, err
	}
	return batch, nil
}

func GetRecallExclusionBatchWithContext(ctx context.Context, campaignID int64, batchID int64) (*RecallExclusionBatch, error) {
	if campaignID <= 0 || batchID <= 0 {
		return nil, fmt.Errorf("recall exclusion batch and campaign IDs must be positive")
	}
	batch := &RecallExclusionBatch{}
	if err := DB.WithContext(ctx).
		Where("id = ? AND campaign_id = ?", batchID, campaignID).
		First(batch).Error; err != nil {
		return nil, err
	}
	return batch, nil
}

func ListUsersByRecallExclusionIdentifiersWithContext(ctx context.Context, userIDs []int, emails []string) ([]User, error) {
	users := make([]User, 0)
	ids := normalizeRecallExclusionUserIDs(userIDs)
	normalizedEmails := make([]string, 0, len(emails))
	seenEmails := make(map[string]struct{}, len(emails))
	for _, email := range emails {
		email = strings.ToLower(strings.TrimSpace(email))
		if email == "" {
			continue
		}
		if _, exists := seenEmails[email]; exists {
			continue
		}
		seenEmails[email] = struct{}{}
		normalizedEmails = append(normalizedEmails, email)
	}
	if len(ids) == 0 && len(normalizedEmails) == 0 {
		return users, nil
	}
	seenUserIDs := map[int]struct{}{}
	appendUsers := func(batch []User) {
		for _, user := range batch {
			if _, exists := seenUserIDs[user.Id]; exists {
				continue
			}
			seenUserIDs[user.Id] = struct{}{}
			users = append(users, user)
		}
	}
	for start := 0; start < len(ids); start += recallRunBatchSize {
		end := start + recallRunBatchSize
		if end > len(ids) {
			end = len(ids)
		}
		var batch []User
		if err := DB.WithContext(ctx).Model(&User{}).
			Select("id", "email", "status").
			Where("id IN ?", ids[start:end]).
			Order("id ASC").
			Find(&batch).Error; err != nil {
			return nil, err
		}
		appendUsers(batch)
	}
	for start := 0; start < len(normalizedEmails); start += recallRunBatchSize {
		end := start + recallRunBatchSize
		if end > len(normalizedEmails) {
			end = len(normalizedEmails)
		}
		var batch []User
		if err := DB.WithContext(ctx).Model(&User{}).
			Select("id", "email", "status").
			Where("LOWER(email) IN ?", normalizedEmails[start:end]).
			Order("id ASC").
			Find(&batch).Error; err != nil {
			return nil, err
		}
		appendUsers(batch)
	}
	sort.Slice(users, func(i, j int) bool { return users[i].Id < users[j].Id })
	return users, nil
}

func CountRecallExclusionCancelableMessagesWithContext(ctx context.Context, campaignID int64, userIDs []int) (int64, error) {
	ids := normalizeRecallExclusionUserIDs(userIDs)
	if campaignID <= 0 || len(ids) == 0 {
		return 0, nil
	}
	total := int64(0)
	for start := 0; start < len(ids); start += recallRunBatchSize {
		end := start + recallRunBatchSize
		if end > len(ids) {
			end = len(ids)
		}
		var count int64
		if err := DB.WithContext(ctx).Model(&RecallMessage{}).
			Joins("JOIN recall_recipients ON recall_recipients.id = recall_messages.recipient_id").
			Where("recall_recipients.campaign_id = ? AND recall_recipients.user_id IN ? AND recall_messages.state IN ?", campaignID, ids[start:end], []string{
				RecallMessageScheduled,
				RecallMessageRetryWait,
				RecallMessageLeased,
			}).
			Count(&count).Error; err != nil {
			return 0, err
		}
		total += count
	}
	return total, nil
}

func ApplyRecallExclusionBatchWithContext(ctx context.Context, campaignID int64, batchID int64, actorID int, now int64) (RecallExclusionApplyOutcome, error) {
	if campaignID <= 0 || batchID <= 0 || actorID <= 0 {
		return RecallExclusionApplyOutcome{}, fmt.Errorf("recall exclusion confirmation requires campaign, batch, and actor")
	}
	outcome := RecallExclusionApplyOutcome{BatchID: batchID}
	err := DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var batch RecallExclusionBatch
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ? AND campaign_id = ?", batchID, campaignID).
			First(&batch).Error; err != nil {
			return err
		}
		if batch.Status == RecallExclusionBatchApplied {
			outcome.CancelledMessages = batch.CancelledMessages
			outcome.AppliedAt = batch.AppliedAt
			return nil
		}
		if batch.Status != RecallExclusionBatchPreviewed {
			return fmt.Errorf("recall exclusion batch %d is not confirmable", batchID)
		}
		if batch.ConflictRows > 0 || batch.ResolvedUsers <= 0 {
			return fmt.Errorf("recall exclusion batch %d is not confirmable", batchID)
		}
		var campaign RecallCampaign
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&campaign, campaignID).Error; err != nil {
			return err
		}
		if !RecallExclusionCampaignStatusConfirmable(campaign.Status) {
			return fmt.Errorf("recall exclusion confirmation requires campaign status scheduled, running, or paused")
		}
		userIDs, err := DecodeRecallExclusionUserIDs(batch.ResolvedUserIDsSnapshot)
		if err != nil {
			return err
		}
		if len(userIDs) == 0 {
			return fmt.Errorf("recall exclusion batch %d has no resolved users", batchID)
		}
		cancelled := int64(0)
		for start := 0; start < len(userIDs); start += recallRunBatchSize {
			end := start + recallRunBatchSize
			if end > len(userIDs) {
				end = len(userIDs)
			}
			chunk := userIDs[start:end]
			recipients := make([]RecallRecipient, 0)
			if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
				Where("campaign_id = ? AND user_id IN ?", campaignID, chunk).
				Order("id ASC").
				Find(&recipients).Error; err != nil {
				return err
			}
			exclusions := make([]RecallCampaignExclusion, 0, len(chunk))
			for _, userID := range chunk {
				exclusions = append(exclusions, RecallCampaignExclusion{
					CampaignId:           campaignID,
					RecipientIdentity:    RecallRecipientIdentityForUser(userID),
					UserId:               userID,
					Persistent:           true,
					PersistentReasonCode: "operator_csv",
					SourceBatchId:        batchID,
					FirstSeenAt:          now,
					LastSeenAt:           now,
					CreatedBy:            actorID,
				})
			}
			if len(exclusions) > 0 {
				if err := tx.Clauses(clause.OnConflict{
					Columns: []clause.Column{{Name: "campaign_id"}, {Name: "recipient_identity"}},
					DoUpdates: clause.Assignments(map[string]any{
						"persistent":             true,
						"persistent_reason_code": "operator_csv",
						"source_batch_id":        batchID,
						"last_seen_at":           now,
						"created_by":             actorID,
					}),
				}).CreateInBatches(&exclusions, recallRunBatchSize).Error; err != nil {
					return err
				}
			}
			recipientIDs := make([]int64, 0, len(recipients))
			for _, recipient := range recipients {
				recipientIDs = append(recipientIDs, recipient.Id)
			}
			if len(recipientIDs) == 0 {
				continue
			}
			count, err := cancelRecallMessagesInBatches(tx, func(afterID int64) *gorm.DB {
				return tx.Clauses(clause.Locking{Strength: "UPDATE"}).
					Where("recipient_id IN ? AND id > ? AND state IN ?", recipientIDs, afterID, []string{
						RecallMessageScheduled,
						RecallMessageRetryWait,
						RecallMessageLeased,
					})
			}, campaignID, "operator_csv", now)
			if err != nil {
				return err
			}
			cancelled += int64(count)
		}
		eventData, err := common.Marshal(map[string]any{
			"action":             "confirm_exclusion_batch",
			"actor_id":           actorID,
			"batch_id":           batchID,
			"resolved_users":     batch.ResolvedUsers,
			"duplicate_rows":     batch.DuplicateRows,
			"unresolved_rows":    batch.UnresolvedRows,
			"conflict_rows":      batch.ConflictRows,
			"cancelled_messages": cancelled,
		})
		if err != nil {
			return err
		}
		event := RecallEvent{
			CampaignId:    campaignID,
			EventType:     "exclusions_applied",
			Source:        "admin",
			SourceEventId: fmt.Sprintf("admin:exclusions:%d", batchID),
			EventData:     string(eventData),
			CreatedAt:     now,
		}
		if err := insertRequiredRecallAdminEvent(tx, &event); err != nil {
			return err
		}
		if err := tx.Model(&RecallExclusionBatch{}).
			Where("id = ? AND campaign_id = ? AND status = ?", batchID, campaignID, RecallExclusionBatchPreviewed).
			Updates(map[string]any{
				"status":             RecallExclusionBatchApplied,
				"cancelled_messages": cancelled,
				"applied_at":         now,
			}).Error; err != nil {
			return err
		}
		outcome.CancelledMessages = cancelled
		outcome.AppliedAt = now
		return nil
	})
	return outcome, err
}
