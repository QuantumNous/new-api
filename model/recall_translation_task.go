package model

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"sort"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	RecallTranslationTaskQueued     = "queued"
	RecallTranslationTaskRunning    = "running"
	RecallTranslationTaskSucceeded  = "succeeded"
	RecallTranslationTaskFailed     = "failed"
	RecallTranslationTaskSuperseded = "superseded"
)

var ErrRecallTranslationTaskSourceChanged = errors.New("recall translation task source changed")

type RecallTranslationTaskSubmission struct {
	CampaignID              int64
	RequestedConfigRevision int64
	SourceHash              string
	SourceSnapshot          string
	Now                     int64
}

type RecallTranslationTaskFailure struct {
	TaskID     int64
	Owner      string
	LeaseEpoch int64
	ErrorCode  string
	FinishedAt int64
}

type RecallTranslationTaskCompletion struct {
	TaskID         int64
	Owner          string
	LeaseEpoch     int64
	ResultSnapshot string
	EmailSequence  string
	FinishedAt     int64
}

type RecallTranslationTaskCompletionResult string

const (
	RecallTranslationTaskCompletionSucceeded  RecallTranslationTaskCompletionResult = "succeeded"
	RecallTranslationTaskCompletionSuperseded RecallTranslationTaskCompletionResult = "superseded"
	RecallTranslationTaskCompletionLeaseLost  RecallTranslationTaskCompletionResult = "lease_lost"
)

type RecallTranslationTask struct {
	Id                      int64  `json:"id" gorm:"primaryKey"`
	CampaignId              int64  `json:"campaign_id" gorm:"index;not null"`
	RequestedConfigRevision int64  `json:"requested_config_revision"`
	ResultConfigRevision    int64  `json:"result_config_revision"`
	SourceHash              string `json:"source_hash" gorm:"type:char(64);not null"`
	IdempotencyKey          string `json:"idempotency_key" gorm:"type:char(64);uniqueIndex"`
	Status                  string `json:"status" gorm:"type:varchar(16);index:idx_recall_translation_due,priority:1"`
	AttemptCount            int    `json:"attempt_count"`
	NextAttemptAt           int64  `json:"next_attempt_at" gorm:"index:idx_recall_translation_due,priority:2"`
	LeaseOwner              string `json:"-" gorm:"type:varchar(96)"`
	LeaseExpiresAt          int64  `json:"-" gorm:"index"`
	LeaseEpoch              int64  `json:"-"`
	SourceSnapshot          string `json:"-" gorm:"type:text"`
	ResultSnapshot          string `json:"-" gorm:"type:text"`
	ErrorCode               string `json:"error_code" gorm:"type:varchar(64)"`
	ErrorMessage            string `json:"-" gorm:"type:varchar(512)"`
	CreatedAt               int64  `json:"created_at" gorm:"autoCreateTime"`
	StartedAt               int64  `json:"started_at"`
	FinishedAt              int64  `json:"finished_at"`
}

type recallTranslationTaskSourceEnvelope struct {
	CampaignType string             `json:"campaign_type"`
	Name         string             `json:"name"`
	Current      []recallEmailStage `json:"current_email_sequence"`
	English      []recallEmailStage `json:"english_email_sequence"`
}

type recallEmailStage struct {
	StageNo                  int                            `json:"stage_no"`
	DelaySeconds             int64                          `json:"delay_seconds"`
	TemplateVersion          int                            `json:"template_version"`
	Templates                map[string]recallEmailTemplate `json:"templates"`
	SourceRevision           int                            `json:"source_revision,omitempty"`
	TranslatedSourceRevision int                            `json:"translated_source_revision,omitempty"`
	ManualLocales            []string                       `json:"manual_locales,omitempty"`
}

type recallEmailTemplate struct {
	Subject  string `json:"subject"`
	BodyText string `json:"body_text"`
	BodyHTML string `json:"body_html,omitempty"`
}

func SubmitRecallTranslationTask(ctx context.Context, submission RecallTranslationTaskSubmission) (*RecallTranslationTask, bool, error) {
	if submission.CampaignID <= 0 || submission.RequestedConfigRevision <= 0 {
		return nil, false, fmt.Errorf("recall translation task campaign and revision are required")
	}
	submission.SourceHash = strings.TrimSpace(submission.SourceHash)
	submission.SourceSnapshot = strings.TrimSpace(submission.SourceSnapshot)
	if submission.SourceHash == "" || submission.SourceSnapshot == "" {
		return nil, false, fmt.Errorf("recall translation task source is required")
	}
	idempotencyKey := recallTranslationTaskIdempotencyKey(submission.CampaignID, submission.RequestedConfigRevision, submission.SourceHash)
	task := RecallTranslationTask{
		CampaignId:              submission.CampaignID,
		RequestedConfigRevision: submission.RequestedConfigRevision,
		SourceHash:              submission.SourceHash,
		IdempotencyKey:          idempotencyKey,
		Status:                  RecallTranslationTaskQueued,
		NextAttemptAt:           submission.Now,
		SourceSnapshot:          submission.SourceSnapshot,
	}
	insert := DB.WithContext(ctx).Clauses(clause.OnConflict{DoNothing: true}).Create(&task)
	if insert.Error != nil {
		return nil, false, insert.Error
	}
	if insert.RowsAffected == 1 {
		return &task, true, nil
	}

	var existing RecallTranslationTask
	if err := DB.WithContext(ctx).Where("idempotency_key = ?", idempotencyKey).First(&existing).Error; err != nil {
		return nil, false, err
	}
	if existing.Status != RecallTranslationTaskFailed {
		return &existing, false, nil
	}
	queuedLifecycle := false
	err := DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ?", existing.Id).First(&existing).Error; err != nil {
			return err
		}
		if existing.Status != RecallTranslationTaskFailed {
			return nil
		}
		var campaign RecallCampaign
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&campaign, existing.CampaignId).Error; err != nil {
			return err
		}
		match, err := recallTranslationTaskMatchesCampaignSource(existing, campaign)
		if err != nil {
			return err
		}
		if !match {
			return ErrRecallTranslationTaskSourceChanged
		}
		result := tx.Model(&RecallTranslationTask{}).
			Where("id = ? AND status = ?", existing.Id, RecallTranslationTaskFailed).
			Updates(map[string]any{
				"status":           RecallTranslationTaskQueued,
				"next_attempt_at":  submission.Now,
				"lease_owner":      "",
				"lease_expires_at": int64(0),
				"error_code":       "",
				"error_message":    "",
				"finished_at":      int64(0),
			})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 1 {
			var refreshed RecallCampaign
			if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&refreshed, existing.CampaignId).Error; err != nil {
				return err
			}
			match, err := recallTranslationTaskMatchesCampaignSource(existing, refreshed)
			if err != nil {
				return err
			}
			if !match {
				return ErrRecallTranslationTaskSourceChanged
			}
			existing.Status = RecallTranslationTaskQueued
			existing.NextAttemptAt = submission.Now
			existing.LeaseOwner = ""
			existing.LeaseExpiresAt = 0
			existing.ErrorCode = ""
			existing.ErrorMessage = ""
			existing.FinishedAt = 0
			queuedLifecycle = true
		}
		return nil
	})
	if err != nil {
		return nil, false, err
	}
	return &existing, queuedLifecycle, nil
}

func GetRecallTranslationTaskByCampaignAndID(ctx context.Context, campaignID int64, taskID int64) (*RecallTranslationTask, error) {
	if campaignID <= 0 || taskID <= 0 {
		return nil, fmt.Errorf("recall translation task campaign and task IDs must be positive")
	}
	var task RecallTranslationTask
	if err := DB.WithContext(ctx).Where("campaign_id = ? AND id = ?", campaignID, taskID).First(&task).Error; err != nil {
		return nil, err
	}
	return &task, nil
}

func GetLatestRecallTranslationTaskForCampaign(ctx context.Context, campaignID int64) (*RecallTranslationTask, error) {
	if campaignID <= 0 {
		return nil, fmt.Errorf("recall translation task campaign ID must be positive")
	}
	var task RecallTranslationTask
	if err := DB.WithContext(ctx).
		Where("campaign_id = ?", campaignID).
		Order("created_at DESC").
		Order("id DESC").
		First(&task).Error; err != nil {
		return nil, err
	}
	return &task, nil
}

func ListDueRecallTranslationTasks(ctx context.Context, now int64, limit int) ([]RecallTranslationTask, error) {
	tasks := make([]RecallTranslationTask, 0)
	if limit <= 0 {
		return tasks, nil
	}
	err := DB.WithContext(ctx).
		Where("(status = ? AND next_attempt_at <= ?) OR (status = ? AND lease_expires_at > 0 AND lease_expires_at < ?)",
			RecallTranslationTaskQueued, now, RecallTranslationTaskRunning, now).
		Order("next_attempt_at ASC").
		Order("lease_expires_at ASC").
		Order("id ASC").
		Limit(limit).
		Find(&tasks).Error
	return tasks, err
}

func ClaimDueRecallTranslationTask(ctx context.Context, id int64, owner string, now int64, leaseUntil int64) (*RecallTranslationTask, bool, error) {
	owner = strings.TrimSpace(owner)
	if id <= 0 || owner == "" || leaseUntil <= now {
		return nil, false, fmt.Errorf("recall translation task claim requires id, owner, and future lease")
	}
	var claimed RecallTranslationTask
	won := false
	err := DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var task RecallTranslationTask
		err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ? AND ((status = ? AND next_attempt_at <= ?) OR (status = ? AND lease_expires_at > 0 AND lease_expires_at < ?))",
				id, RecallTranslationTaskQueued, now, RecallTranslationTaskRunning, now).
			First(&task).Error
		if err != nil {
			if err == gorm.ErrRecordNotFound {
				return nil
			}
			return err
		}
		result := tx.Model(&RecallTranslationTask{}).
			Where("id = ? AND status = ? AND lease_epoch = ?", task.Id, task.Status, task.LeaseEpoch).
			Updates(map[string]any{
				"status":           RecallTranslationTaskRunning,
				"lease_owner":      owner,
				"lease_expires_at": leaseUntil,
				"lease_epoch":      gorm.Expr("lease_epoch + ?", 1),
				"attempt_count":    gorm.Expr("attempt_count + ?", 1),
				"started_at":       now,
			})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return nil
		}
		if err := tx.First(&claimed, task.Id).Error; err != nil {
			return err
		}
		won = true
		return nil
	})
	if err != nil {
		return nil, false, err
	}
	return &claimed, won, nil
}

func RenewRecallTranslationTaskLease(ctx context.Context, id int64, owner string, leaseEpoch int64, leaseUntil int64) (bool, error) {
	result := DB.WithContext(ctx).Model(&RecallTranslationTask{}).
		Where("id = ? AND status = ? AND lease_owner = ? AND lease_epoch = ?", id, RecallTranslationTaskRunning, owner, leaseEpoch).
		Update("lease_expires_at", leaseUntil)
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected == 1, nil
}

func FailRecallTranslationTask(ctx context.Context, failure RecallTranslationTaskFailure) (bool, error) {
	code := strings.TrimSpace(failure.ErrorCode)
	if code == "" {
		code = "translation_failed"
	}
	result := DB.WithContext(ctx).Model(&RecallTranslationTask{}).
		Where("id = ? AND status = ? AND lease_owner = ? AND lease_epoch = ?",
			failure.TaskID, RecallTranslationTaskRunning, strings.TrimSpace(failure.Owner), failure.LeaseEpoch).
		Updates(map[string]any{
			"status":           RecallTranslationTaskFailed,
			"lease_owner":      "",
			"lease_expires_at": int64(0),
			"error_code":       code,
			"error_message":    "recall translation failed",
			"finished_at":      failure.FinishedAt,
		})
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected == 1, nil
}

func CompleteRecallTranslationTaskSuccess(ctx context.Context, completion RecallTranslationTaskCompletion) (RecallTranslationTaskCompletionResult, error) {
	result := RecallTranslationTaskCompletionLeaseLost
	err := DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var task RecallTranslationTask
		err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ? AND status = ? AND lease_owner = ? AND lease_epoch = ?",
				completion.TaskID, RecallTranslationTaskRunning, strings.TrimSpace(completion.Owner), completion.LeaseEpoch).
			First(&task).Error
		if err != nil {
			if err == gorm.ErrRecordNotFound {
				return nil
			}
			return err
		}
		var campaign RecallCampaign
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&campaign, task.CampaignId).Error; err != nil {
			return err
		}
		sourceMatches, err := recallTranslationTaskMatchesCampaignSource(task, campaign)
		if err != nil {
			return err
		}
		if campaign.Status != RecallCampaignDraft || !sourceMatches {
			if err := tx.Model(&RecallTranslationTask{}).
				Where("id = ? AND status = ? AND lease_owner = ? AND lease_epoch = ?", task.Id, RecallTranslationTaskRunning, task.LeaseOwner, task.LeaseEpoch).
				Updates(map[string]any{
					"status":           RecallTranslationTaskSuperseded,
					"lease_owner":      "",
					"lease_expires_at": int64(0),
					"finished_at":      completion.FinishedAt,
				}).Error; err != nil {
				return err
			}
			result = RecallTranslationTaskCompletionSuperseded
			return nil
		}
		campaignUpdate := tx.Model(&RecallCampaign{}).
			Where("id = ? AND status = ? AND config_revision = ?", campaign.Id, RecallCampaignDraft, task.RequestedConfigRevision).
			Updates(map[string]any{
				"email_sequence_config": completion.EmailSequence,
				"config_revision":       gorm.Expr("config_revision + ?", 1),
			})
		if campaignUpdate.Error != nil {
			return campaignUpdate.Error
		}
		if campaignUpdate.RowsAffected != 1 {
			result = RecallTranslationTaskCompletionLeaseLost
			return nil
		}
		taskUpdate := tx.Model(&RecallTranslationTask{}).
			Where("id = ? AND status = ? AND lease_owner = ? AND lease_epoch = ?", task.Id, RecallTranslationTaskRunning, task.LeaseOwner, task.LeaseEpoch).
			Updates(map[string]any{
				"status":                 RecallTranslationTaskSucceeded,
				"lease_owner":            "",
				"lease_expires_at":       int64(0),
				"result_snapshot":        completion.ResultSnapshot,
				"result_config_revision": task.RequestedConfigRevision + 1,
				"finished_at":            completion.FinishedAt,
				"error_code":             "",
				"error_message":          "",
			})
		if taskUpdate.Error != nil {
			return taskUpdate.Error
		}
		if taskUpdate.RowsAffected != 1 {
			return fmt.Errorf("recall translation task completion lost task update")
		}
		result = RecallTranslationTaskCompletionSucceeded
		return nil
	})
	return result, err
}

func recallTranslationTaskIdempotencyKey(campaignID int64, revision int64, sourceHash string) string {
	sum := sha256.Sum256([]byte(fmt.Sprintf("%d:%d:%s", campaignID, revision, sourceHash)))
	return fmt.Sprintf("%x", sum[:])
}

func recallTranslationTaskSourceHash(source string) string {
	sum := sha256.Sum256([]byte(strings.TrimSpace(source)))
	return fmt.Sprintf("%x", sum[:])
}

func recallTranslationTaskMatchesCampaignSource(task RecallTranslationTask, campaign RecallCampaign) (bool, error) {
	if campaign.ConfigRevision != task.RequestedConfigRevision {
		return false, nil
	}
	var source recallTranslationTaskSourceEnvelope
	if err := common.Unmarshal([]byte(task.SourceSnapshot), &source); err != nil {
		return false, err
	}
	if len(source.Current) == 0 {
		return recallTranslationTaskSourceHash(campaign.EmailSequenceConfig) == task.SourceHash, nil
	}
	if strings.TrimSpace(campaign.CampaignType) != strings.TrimSpace(source.CampaignType) ||
		strings.TrimSpace(campaign.Name) != strings.TrimSpace(source.Name) {
		return false, nil
	}
	sourceJSON, err := recallTranslationTaskCanonicalEmailStagesJSON(source.Current)
	if err != nil {
		return false, err
	}
	var live []recallEmailStage
	if err := common.Unmarshal([]byte(campaign.EmailSequenceConfig), &live); err != nil {
		return false, err
	}
	liveJSON, err := recallTranslationTaskCanonicalEmailStagesJSON(live)
	if err != nil {
		return false, err
	}
	return recallTranslationTaskSourceHash(string(liveJSON)) == recallTranslationTaskSourceHash(string(sourceJSON)), nil
}

func recallTranslationTaskCanonicalEmailStagesJSON(stages []recallEmailStage) ([]byte, error) {
	normalized := make([]recallEmailStage, len(stages))
	for i, stage := range stages {
		normalized[i] = stage
		templates := make(map[string]recallEmailTemplate, len(stage.Templates))
		for language, template := range stage.Templates {
			language = strings.ToLower(strings.TrimSpace(language))
			if language == "" {
				continue
			}
			template.Subject = strings.TrimSpace(template.Subject)
			template.BodyText = strings.TrimSpace(template.BodyText)
			template.BodyHTML = strings.TrimSpace(template.BodyHTML)
			templates[language] = template
		}
		normalized[i].Templates = templates
		locales := make([]string, 0, len(stage.ManualLocales))
		seen := make(map[string]struct{}, len(stage.ManualLocales))
		for _, locale := range stage.ManualLocales {
			locale = strings.ToLower(strings.TrimSpace(locale))
			if locale == "" {
				continue
			}
			if _, exists := seen[locale]; exists {
				continue
			}
			seen[locale] = struct{}{}
			locales = append(locales, locale)
		}
		sort.Strings(locales)
		normalized[i].ManualLocales = locales
	}
	return common.Marshal(normalized)
}
