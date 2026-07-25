package model

import (
	"context"
	"fmt"
	"strings"

	"gorm.io/gorm"
)

const (
	RecallCampaignDraft     = "draft"
	RecallCampaignScheduled = "scheduled"
	RecallCampaignRunning   = "running"
	RecallCampaignPaused    = "paused"
	RecallCampaignCancelled = "cancelled"
	RecallCampaignCompleted = "completed"
	recallReadPageSizeMax   = 100
)

type RecallCampaign struct {
	Id                    int64  `json:"id" gorm:"primaryKey"`
	Name                  string `json:"name" gorm:"type:varchar(128);not null"`
	Status                string `json:"status" gorm:"type:varchar(24);not null;index"`
	AudienceTemplate      string `json:"audience_template" gorm:"type:varchar(32);not null"`
	AudienceConfig        string `json:"audience_config" gorm:"type:text;not null"`
	ExecutionMode         string `json:"execution_mode" gorm:"type:varchar(24);not null"`
	ScheduledAt           int64  `json:"scheduled_at" gorm:"index"`
	RecurrenceConfig      string `json:"recurrence_config" gorm:"type:text"`
	NextRunAt             int64  `json:"next_run_at" gorm:"index"`
	CouponSource          string `json:"coupon_source" gorm:"type:varchar(16);not null"`
	StripeCouponId        string `json:"stripe_coupon_id" gorm:"type:varchar(128);index"`
	DiscountConfig        string `json:"discount_config" gorm:"type:text;not null"`
	ProductScope          string `json:"product_scope" gorm:"type:text;not null"`
	PromotionValidSeconds int64  `json:"promotion_valid_seconds"`
	EmailSequenceConfig   string `json:"email_sequence_config" gorm:"type:text;not null"`
	EnrollmentLimit       int    `json:"enrollment_limit"`
	WorkerConcurrency     int    `json:"worker_concurrency"`
	ConfigRevision        int64  `json:"config_revision" gorm:"not null;default:1"`
	CreatedBy             int    `json:"created_by" gorm:"index"`
	CreatedAt             int64  `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt             int64  `json:"updated_at" gorm:"autoUpdateTime"`
	ActivatedAt           int64  `json:"activated_at"`
	CompletedAt           int64  `json:"completed_at"`
}

func CreateRecallCampaign(campaign *RecallCampaign) error {
	return CreateRecallCampaignWithContext(context.Background(), campaign)
}

func CreateRecallCampaignWithContext(ctx context.Context, campaign *RecallCampaign) error {
	return DB.WithContext(ctx).Create(campaign).Error
}

func GetRecallCampaignByID(id int64) (*RecallCampaign, error) {
	return GetRecallCampaignByIDWithContext(context.Background(), id)
}

func GetRecallCampaignByIDWithContext(ctx context.Context, id int64) (*RecallCampaign, error) {
	campaign := &RecallCampaign{}
	if err := DB.WithContext(ctx).First(campaign, id).Error; err != nil {
		return nil, err
	}
	return campaign, nil
}

func ListRecallCampaignsWithContext(ctx context.Context, status string, offset int, limit int) ([]RecallCampaign, int64, error) {
	campaigns := make([]RecallCampaign, 0)
	var total int64
	query := DB.WithContext(ctx).Model(&RecallCampaign{})
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	offset, limit, bounded := boundRecallReadWindow(offset, limit)
	if !bounded {
		return campaigns, total, nil
	}
	if err := query.Order("id DESC").Offset(offset).Limit(limit).Find(&campaigns).Error; err != nil {
		return nil, 0, err
	}
	return campaigns, total, nil
}

func boundRecallReadWindow(offset int, limit int) (int, int, bool) {
	if limit <= 0 {
		return 0, 0, false
	}
	if offset < 0 {
		offset = 0
	}
	if limit > recallReadPageSizeMax {
		limit = recallReadPageSizeMax
	}
	return offset, limit, true
}

func UpdateRecallCampaignDraft(campaign *RecallCampaign) error {
	_, err := UpdateRecallCampaignDraftWithContext(context.Background(), campaign)
	return err
}

func UpdateRecallCampaignDraftWithContext(ctx context.Context, campaign *RecallCampaign) (bool, error) {
	result := DB.WithContext(ctx).Model(&RecallCampaign{}).
		Where("id = ? AND status = ? AND config_revision = ?", campaign.Id, RecallCampaignDraft, campaign.ConfigRevision).
		Updates(map[string]any{
			"name":              campaign.Name,
			"audience_template": campaign.AudienceTemplate,
			"audience_config":   campaign.AudienceConfig,
			"execution_mode":    campaign.ExecutionMode,
			"scheduled_at":      campaign.ScheduledAt,
			"recurrence_config": campaign.RecurrenceConfig,
			"coupon_source":     campaign.CouponSource,
			// StripeCouponId persists draft existing_coupon_id; the draft status predicate blocks post-activation edits.
			"stripe_coupon_id":        campaign.StripeCouponId,
			"discount_config":         campaign.DiscountConfig,
			"product_scope":           campaign.ProductScope,
			"promotion_valid_seconds": campaign.PromotionValidSeconds,
			"email_sequence_config":   campaign.EmailSequenceConfig,
			"enrollment_limit":        campaign.EnrollmentLimit,
			"worker_concurrency":      campaign.WorkerConcurrency,
			"config_revision":         gorm.Expr("config_revision + ?", 1),
		})
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected == 1, nil
}

func TransitionRecallCampaign(id int64, from []string, to string, fields map[string]any) (bool, error) {
	return TransitionRecallCampaignWithContext(context.Background(), id, from, to, fields)
}

func TransitionRecallCampaignWithContext(ctx context.Context, id int64, from []string, to string, fields map[string]any) (bool, error) {
	return transitionRecallCampaignWithContext(ctx, id, from, to, nil, fields)
}

func TransitionRecallCampaignRevisionWithContext(ctx context.Context, id int64, from []string, to string, expectedConfigRevision int64, fields map[string]any) (bool, error) {
	return transitionRecallCampaignWithContext(ctx, id, from, to, &expectedConfigRevision, fields)
}

func transitionRecallCampaignWithContext(ctx context.Context, id int64, from []string, to string, expectedConfigRevision *int64, fields map[string]any) (bool, error) {
	return transitionRecallCampaign(DB.WithContext(ctx), id, from, to, expectedConfigRevision, fields)
}

func transitionRecallCampaign(db *gorm.DB, id int64, from []string, to string, expectedConfigRevision *int64, fields map[string]any) (bool, error) {
	updates, err := recallCampaignTransitionUpdates(to, fields)
	if err != nil {
		return false, err
	}
	if len(from) == 0 {
		return false, nil
	}
	query := db.Model(&RecallCampaign{}).
		Where("id = ? AND status IN ?", id, from)
	if expectedConfigRevision != nil {
		query = query.Where("config_revision = ?", *expectedConfigRevision)
	}
	result := query.Updates(updates)
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected == 1, nil
}

func TransitionRecallCampaignAndAdminEventWithContext(ctx context.Context, id int64, from []string, to string, fields map[string]any, event RecallEvent) (bool, error) {
	if event.CampaignId != id || event.RecipientId != 0 {
		return false, fmt.Errorf("recall campaign admin event target does not match campaign %d", id)
	}
	if err := validateRecallAdminEvent(&event); err != nil {
		return false, err
	}
	transitioned := false
	err := DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		won, err := transitionRecallCampaign(tx, id, from, to, nil, fields)
		if err != nil {
			return err
		}
		if !won {
			return nil
		}
		transitioned = true
		return insertRequiredRecallAdminEvent(tx, &event)
	})
	if err != nil {
		return false, err
	}
	return transitioned, nil
}

func recallCampaignTransitionUpdates(to string, fields map[string]any) (map[string]any, error) {
	allowedFields := map[string]struct{}{
		"scheduled_at":            {},
		"recurrence_config":       {},
		"next_run_at":             {},
		"stripe_coupon_id":        {},
		"discount_config":         {},
		"product_scope":           {},
		"promotion_valid_seconds": {},
		"email_sequence_config":   {},
		"enrollment_limit":        {},
		"worker_concurrency":      {},
		"activated_at":            {},
		"completed_at":            {},
	}
	updates := make(map[string]any, len(fields)+1)
	for key, value := range fields {
		if _, ok := allowedFields[key]; !ok {
			return nil, fmt.Errorf("unsupported recall campaign transition field %q", key)
		}
		updates[key] = value
	}
	updates["status"] = to
	return updates, nil
}

func UpdateRecallCampaignEmailSequenceWithContext(ctx context.Context, id int64, expectedConfigRevision int64, name string, emailSequence string) (bool, error) {
	result := DB.WithContext(ctx).Model(&RecallCampaign{}).
		Where("id = ? AND status IN ? AND config_revision = ?", id, []string{
			RecallCampaignScheduled,
			RecallCampaignRunning,
			RecallCampaignPaused,
		}, expectedConfigRevision).
		Updates(map[string]any{
			"name":                  name,
			"email_sequence_config": emailSequence,
			"config_revision":       gorm.Expr("config_revision + ?", 1),
		})
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected == 1, nil
}

func ListDueRecallCampaignsWithContext(ctx context.Context, now int64, limit int) ([]RecallCampaign, error) {
	campaigns := make([]RecallCampaign, 0)
	if limit <= 0 {
		return campaigns, nil
	}
	err := DB.WithContext(ctx).
		Where(
			"next_run_at > 0 AND next_run_at <= ? AND ((execution_mode = ? AND status IN ?) OR (execution_mode = ? AND status IN ?))",
			now,
			"scheduled_once",
			[]string{RecallCampaignScheduled, RecallCampaignRunning},
			"recurring",
			[]string{RecallCampaignScheduled, RecallCampaignRunning},
		).
		Order("next_run_at ASC").
		Order("id ASC").
		Limit(limit).
		Find(&campaigns).Error
	return campaigns, err
}

func CountRecallCampaignRecipientsWithContext(ctx context.Context, campaignID int64) (int64, error) {
	var count int64
	err := DB.WithContext(ctx).
		Model(&RecallRecipient{}).
		Where("campaign_id = ?", campaignID).
		Count(&count).Error
	return count, err
}

type RecallCampaignRecipientKeys struct {
	Identities map[string]struct{}
	UserIDs    map[int]struct{}
	Emails     map[string]struct{}
}

func ListRecallCampaignRecipientKeysWithContext(ctx context.Context, campaignID int64) (RecallCampaignRecipientKeys, error) {
	keys := RecallCampaignRecipientKeys{
		Identities: make(map[string]struct{}),
		UserIDs:    make(map[int]struct{}),
		Emails:     make(map[string]struct{}),
	}
	rows := make([]struct {
		RecipientIdentity string
		UserId            int
		EmailSnapshot     string
	}, 0)
	if err := DB.WithContext(ctx).
		Model(&RecallRecipient{}).
		Where("campaign_id = ?", campaignID).
		Select("recipient_identity", "user_id", "email_snapshot").
		Find(&rows).Error; err != nil {
		return keys, err
	}
	for _, row := range rows {
		if identity := strings.TrimSpace(row.RecipientIdentity); identity != "" {
			keys.Identities[identity] = struct{}{}
		}
		if row.UserId > 0 {
			keys.UserIDs[row.UserId] = struct{}{}
		}
		if email, ok := normalizeRecallRecipientEmail(row.EmailSnapshot); ok {
			keys.Emails[email] = struct{}{}
		}
	}
	return keys, nil
}

func ListRecallCampaignRecipientUserIDsWithContext(ctx context.Context, campaignID int64) (map[int]struct{}, error) {
	keys, err := ListRecallCampaignRecipientKeysWithContext(ctx, campaignID)
	if err != nil {
		return nil, err
	}
	existing := make(map[int]struct{}, len(keys.UserIDs))
	for userID := range keys.UserIDs {
		existing[userID] = struct{}{}
	}
	return existing, nil
}

func CompleteDueRecallCampaignWithContext(ctx context.Context, id int64, expectedNextRunAt int64, completedAt int64) (bool, error) {
	result := DB.WithContext(ctx).Model(&RecallCampaign{}).
		Where("id = ? AND status IN ? AND next_run_at = ?", id, []string{
			RecallCampaignScheduled,
			RecallCampaignRunning,
		}, expectedNextRunAt).
		Updates(map[string]any{
			"status":       RecallCampaignCompleted,
			"next_run_at":  int64(0),
			"completed_at": completedAt,
		})
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected == 1, nil
}

func CancelRecallCampaignWithContext(ctx context.Context, id int64, from []string, now int64, reasonCode string) (bool, error) {
	return cancelRecallCampaignWithContext(ctx, id, from, now, reasonCode, nil)
}

func CancelRecallCampaignAndAdminEventWithContext(ctx context.Context, id int64, from []string, now int64, reasonCode string, event RecallEvent) (bool, error) {
	if event.CampaignId != id || event.RecipientId != 0 {
		return false, fmt.Errorf("recall campaign admin event target does not match campaign %d", id)
	}
	if err := validateRecallAdminEvent(&event); err != nil {
		return false, err
	}
	return cancelRecallCampaignWithContext(ctx, id, from, now, reasonCode, &event)
}

func cancelRecallCampaignWithContext(ctx context.Context, id int64, from []string, now int64, reasonCode string, event *RecallEvent) (bool, error) {
	if len(from) == 0 {
		return false, nil
	}
	cancelled := false
	err := DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		result := tx.Model(&RecallCampaign{}).
			Where("id = ? AND status IN ?", id, from).
			Update("status", RecallCampaignCancelled)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return nil
		}
		cancelled = true
		recipientIDs := tx.Model(&RecallRecipient{}).
			Select("id").
			Where("campaign_id = ?", id)
		if err := tx.Model(&RecallMessage{}).
			Where("recipient_id IN (?) AND state IN ?", recipientIDs, []string{
				RecallMessageScheduled,
				RecallMessageRetryWait,
				RecallMessageLeased,
				RecallMessageSending,
			}).
			Updates(map[string]any{
				"state":              RecallMessageCancelled,
				"next_attempt_at":    int64(0),
				"lease_owner":        "",
				"lease_expires_at":   int64(0),
				"last_error_code":    reasonCode,
				"last_error_message": "",
				"failed_at":          now,
			}).Error; err != nil {
			return err
		}
		if event != nil {
			return insertRequiredRecallAdminEvent(tx, event)
		}
		return nil
	})
	if err != nil {
		return false, err
	}
	return cancelled, nil
}
