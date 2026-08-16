package model

import (
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"

	"gorm.io/gorm"
)

type ChannelContributionStatus string

const (
	ChannelContributionStatusDraft       ChannelContributionStatus = "draft"
	ChannelContributionStatusPending     ChannelContributionStatus = "pending"
	ChannelContributionStatusApproved    ChannelContributionStatus = "approved"
	ChannelContributionStatusRejected    ChannelContributionStatus = "rejected"
	ChannelContributionStatusUnavailable ChannelContributionStatus = "unavailable"
	ChannelContributionStatusDeleted     ChannelContributionStatus = "deleted"
)

type ChannelContributionRevisionStatus string

const (
	ChannelContributionRevisionStatusDraft      ChannelContributionRevisionStatus = "draft"
	ChannelContributionRevisionStatusPending    ChannelContributionRevisionStatus = "pending"
	ChannelContributionRevisionStatusApproved   ChannelContributionRevisionStatus = "approved"
	ChannelContributionRevisionStatusRejected   ChannelContributionRevisionStatus = "rejected"
	ChannelContributionRevisionStatusWithdrawn  ChannelContributionRevisionStatus = "withdrawn"
	ChannelContributionRevisionStatusSuperseded ChannelContributionRevisionStatus = "superseded"
)

type ChannelContributionTestRunStatus string

const (
	ChannelContributionTestRunStatusQueued    ChannelContributionTestRunStatus = "queued"
	ChannelContributionTestRunStatusRunning   ChannelContributionTestRunStatus = "running"
	ChannelContributionTestRunStatusSucceeded ChannelContributionTestRunStatus = "succeeded"
	ChannelContributionTestRunStatusFailed    ChannelContributionTestRunStatus = "failed"
)

const (
	ChannelContributionTestActorUser  = "user"
	ChannelContributionTestActorAdmin = "admin"
)

type ChannelContribution struct {
	Id                 int                       `json:"id"`
	UserId             int                       `json:"user_id" gorm:"index;not null"`
	Username           string                    `json:"username" gorm:"type:varchar(64);not null"`
	Status             ChannelContributionStatus `json:"status" gorm:"type:varchar(32);index;not null"`
	ChannelId          *int                      `json:"channel_id" gorm:"index"`
	CurrentRevisionId  *int                      `json:"current_revision_id" gorm:"index"`
	PendingRevisionId  *int                      `json:"pending_revision_id" gorm:"index"`
	ApprovedRevisionId *int                      `json:"approved_revision_id" gorm:"index"`
	SubmittedAt        int64                     `json:"submitted_at" gorm:"bigint;index;not null"`
	ReviewerId         int                       `json:"reviewer_id" gorm:"index;not null"`
	ReviewerUsername   string                    `json:"reviewer_username" gorm:"type:varchar(64);not null"`
	ReviewedAt         int64                     `json:"reviewed_at" gorm:"bigint;not null"`
	ReviewReason       string                    `json:"review_reason" gorm:"type:varchar(500);not null"`
	UnavailableSince   int64                     `json:"unavailable_since" gorm:"bigint;index;not null"`
	CreatedAt          int64                     `json:"created_at" gorm:"bigint;index;not null"`
	UpdatedAt          int64                     `json:"updated_at" gorm:"bigint;index;not null"`
}

type ChannelContributionRevision struct {
	Id                  int                               `json:"id"`
	ContributionId      int                               `json:"contribution_id" gorm:"uniqueIndex:uk_channel_contribution_revision,priority:1;index;not null"`
	RevisionNumber      int                               `json:"revision_number" gorm:"uniqueIndex:uk_channel_contribution_revision,priority:2;not null"`
	Name                string                            `json:"name" gorm:"type:varchar(128);not null"`
	Type                int                               `json:"type" gorm:"not null"`
	BaseURL             string                            `json:"base_url" gorm:"column:base_url;type:text;not null"`
	Key                 string                            `json:"-" gorm:"not null"`
	Group               string                            `json:"group" gorm:"type:varchar(64);not null"`
	Models              string                            `json:"models" gorm:"type:text;not null"`
	ModelMapping        string                            `json:"model_mapping" gorm:"type:text;not null"`
	ConfigHash          string                            `json:"-" gorm:"type:varchar(64);index;not null"`
	Status              ChannelContributionRevisionStatus `json:"status" gorm:"type:varchar(32);index;not null"`
	AgreementVersion    string                            `json:"agreement_version" gorm:"type:varchar(64);not null"`
	AgreementContent    string                            `json:"agreement_content" gorm:"type:text;not null"`
	AgreementHash       string                            `json:"agreement_hash" gorm:"type:varchar(64);not null"`
	AgreementAcceptedAt int64                             `json:"agreement_accepted_at" gorm:"bigint;not null"`
	SubmittedAt         int64                             `json:"submitted_at" gorm:"bigint;index;not null"`
	ReviewerId          int                               `json:"reviewer_id" gorm:"index;not null"`
	ReviewerUsername    string                            `json:"reviewer_username" gorm:"type:varchar(64);not null"`
	ReviewedAt          int64                             `json:"reviewed_at" gorm:"bigint;not null"`
	ReviewReason        string                            `json:"review_reason" gorm:"type:varchar(500);not null"`
	CreatedAt           int64                             `json:"created_at" gorm:"bigint;index;not null"`
	UpdatedAt           int64                             `json:"updated_at" gorm:"bigint;index;not null"`
}

type ChannelContributionTestRun struct {
	Id             int64                            `json:"id"`
	ContributionId int                              `json:"contribution_id" gorm:"index;not null"`
	RevisionId     int                              `json:"revision_id" gorm:"index;not null"`
	ConfigHash     string                           `json:"-" gorm:"type:varchar(64);index;not null"`
	ActorId        int                              `json:"actor_id" gorm:"index;not null"`
	ActorType      string                           `json:"actor_type" gorm:"type:varchar(16);not null"`
	ActiveUserId   *int                             `json:"-" gorm:"uniqueIndex:uk_channel_contribution_active_user"`
	Status         ChannelContributionTestRunStatus `json:"status" gorm:"type:varchar(32);index;not null"`
	PricingReady   bool                             `json:"pricing_ready" gorm:"not null"`
	Total          int                              `json:"total" gorm:"not null"`
	Passed         int                              `json:"passed" gorm:"not null"`
	Failed         int                              `json:"failed" gorm:"not null"`
	Error          string                           `json:"error" gorm:"type:text;not null"`
	StartedAt      int64                            `json:"started_at" gorm:"bigint;not null"`
	CompletedAt    int64                            `json:"completed_at" gorm:"bigint;index;not null"`
	CreatedAt      int64                            `json:"created_at" gorm:"bigint;index;not null"`
	UpdatedAt      int64                            `json:"updated_at" gorm:"bigint;index;not null"`
}

type ChannelContributionTestResult struct {
	Id           int64  `json:"id"`
	TestRunId    int64  `json:"test_run_id" gorm:"index;not null"`
	RevisionId   int    `json:"revision_id" gorm:"index;not null"`
	Model        string `json:"model" gorm:"type:varchar(255);index;not null"`
	EndpointType string `json:"endpoint_type" gorm:"type:varchar(64);not null"`
	Stream       bool   `json:"stream" gorm:"not null"`
	Success      bool   `json:"success" gorm:"index;not null"`
	LatencyMs    int64  `json:"latency_ms" gorm:"bigint;not null"`
	Error        string `json:"error" gorm:"type:text;not null"`
	CreatedAt    int64  `json:"created_at" gorm:"bigint;index;not null"`
}

type ChannelContributionApproval struct {
	ReviewerId       int
	ReviewerUsername string
	Tag              string
	Priority         int64
	Weight           uint
}

func ComputeChannelContributionConfigHash(revision *ChannelContributionRevision) (string, error) {
	if revision == nil {
		return "", errors.New("channel contribution revision is required")
	}
	payload := struct {
		Name         string `json:"name"`
		Type         int    `json:"type"`
		BaseURL      string `json:"base_url"`
		Key          string `json:"key"`
		Group        string `json:"group"`
		Models       string `json:"models"`
		ModelMapping string `json:"model_mapping"`
	}{
		Name:         revision.Name,
		Type:         revision.Type,
		BaseURL:      revision.BaseURL,
		Key:          revision.Key,
		Group:        revision.Group,
		Models:       revision.Models,
		ModelMapping: revision.ModelMapping,
	}
	encoded, err := common.Marshal(payload)
	if err != nil {
		return "", err
	}
	key := []byte("channel-contribution-config-v1:" + common.CryptoSecret)
	return common.GenerateHMACWithKey(key, string(encoded)), nil
}

func (contribution *ChannelContribution) BeforeCreate(_ *gorm.DB) error {
	now := common.GetTimestamp()
	if contribution.CreatedAt == 0 {
		contribution.CreatedAt = now
	}
	if contribution.UpdatedAt == 0 {
		contribution.UpdatedAt = now
	}
	if contribution.Status == "" {
		contribution.Status = ChannelContributionStatusDraft
	}
	return nil
}

func (revision *ChannelContributionRevision) BeforeCreate(_ *gorm.DB) error {
	now := common.GetTimestamp()
	if revision.CreatedAt == 0 {
		revision.CreatedAt = now
	}
	if revision.UpdatedAt == 0 {
		revision.UpdatedAt = now
	}
	if revision.Status == "" {
		revision.Status = ChannelContributionRevisionStatusDraft
	}
	if strings.TrimSpace(revision.ModelMapping) == "" {
		revision.ModelMapping = "{}"
	}
	return nil
}

func (run *ChannelContributionTestRun) BeforeCreate(_ *gorm.DB) error {
	now := common.GetTimestamp()
	if run.CreatedAt == 0 {
		run.CreatedAt = now
	}
	if run.UpdatedAt == 0 {
		run.UpdatedAt = now
	}
	if run.Status == "" {
		run.Status = ChannelContributionTestRunStatusQueued
	}
	return nil
}

func CreateChannelContribution(contribution *ChannelContribution) error {
	return DB.Create(contribution).Error
}

func CreateChannelContributionWithRevision(contribution *ChannelContribution, revision *ChannelContributionRevision) error {
	if contribution == nil || revision == nil {
		return errors.New("contribution and revision are required")
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(contribution).Error; err != nil {
			return err
		}
		revision.ContributionId = contribution.Id
		revision.RevisionNumber = 1
		revision.Status = ChannelContributionRevisionStatusDraft
		if err := tx.Create(revision).Error; err != nil {
			return err
		}
		contribution.CurrentRevisionId = &revision.Id
		return tx.Model(&ChannelContribution{}).
			Where("id = ?", contribution.Id).
			Updates(map[string]any{
				"current_revision_id": revision.Id,
				"updated_at":          common.GetTimestamp(),
			}).Error
	})
}

func CreateChannelContributionRevision(contributionId int, userId int, revision *ChannelContributionRevision) error {
	if revision == nil {
		return errors.New("revision is required")
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		var contribution ChannelContribution
		if err := lockForUpdate(tx).Where("id = ? AND user_id = ?", contributionId, userId).First(&contribution).Error; err != nil {
			return err
		}
		if contribution.PendingRevisionId != nil || contribution.Status == ChannelContributionStatusDeleted {
			return errors.New("contribution is not editable")
		}

		var latestNumber int
		if err := tx.Model(&ChannelContributionRevision{}).
			Where("contribution_id = ?", contributionId).
			Select("COALESCE(MAX(revision_number), 0)").
			Scan(&latestNumber).Error; err != nil {
			return err
		}
		revision.ContributionId = contributionId
		revision.RevisionNumber = latestNumber + 1
		revision.Status = ChannelContributionRevisionStatusDraft
		if err := tx.Create(revision).Error; err != nil {
			return err
		}

		status := contribution.Status
		if contribution.ApprovedRevisionId == nil {
			status = ChannelContributionStatusDraft
		}
		return tx.Model(&ChannelContribution{}).
			Where("id = ?", contributionId).
			Updates(map[string]any{
				"current_revision_id": revision.Id,
				"status":              status,
				"updated_at":          common.GetTimestamp(),
			}).Error
	})
}

func GetChannelContributionById(id int) (*ChannelContribution, error) {
	var contribution ChannelContribution
	if err := DB.First(&contribution, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &contribution, nil
}

func GetUserChannelContributionById(id int, userId int) (*ChannelContribution, error) {
	var contribution ChannelContribution
	if err := DB.Where("id = ? AND user_id = ?", id, userId).First(&contribution).Error; err != nil {
		return nil, err
	}
	return &contribution, nil
}

func GetChannelContributionRevisionById(id int) (*ChannelContributionRevision, error) {
	var revision ChannelContributionRevision
	if err := DB.First(&revision, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &revision, nil
}

func GetChannelContributionRevision(contributionId int, revisionId int) (*ChannelContributionRevision, error) {
	var revision ChannelContributionRevision
	if err := DB.Where("id = ? AND contribution_id = ?", revisionId, contributionId).First(&revision).Error; err != nil {
		return nil, err
	}
	return &revision, nil
}

func ListChannelContributionRevisions(contributionId int) ([]*ChannelContributionRevision, error) {
	var revisions []*ChannelContributionRevision
	err := DB.Where("contribution_id = ?", contributionId).Order("revision_number desc").Find(&revisions).Error
	return revisions, err
}

func ListUserChannelContributions(userId int, offset int, limit int) ([]*ChannelContribution, int64, error) {
	var contributions []*ChannelContribution
	var total int64
	query := DB.Model(&ChannelContribution{}).Where("user_id = ?", userId)
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if err := query.Order("id desc").Offset(offset).Limit(limit).Find(&contributions).Error; err != nil {
		return nil, 0, err
	}
	return contributions, total, nil
}

func ListChannelContributions(status ChannelContributionStatus, offset int, limit int) ([]*ChannelContribution, int64, error) {
	var contributions []*ChannelContribution
	var total int64
	query := DB.Model(&ChannelContribution{})
	if status == ChannelContributionStatusPending {
		query = query.Where("pending_revision_id IS NOT NULL")
	} else if status != "" {
		query = query.Where("status = ?", status)
	}
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if err := query.Order("id desc").Offset(offset).Limit(limit).Find(&contributions).Error; err != nil {
		return nil, 0, err
	}
	return contributions, total, nil
}

func CreateChannelContributionTestRun(run *ChannelContributionTestRun) error {
	if run == nil {
		return errors.New("test run is required")
	}
	if run.ActorId <= 0 {
		return errors.New("test run actor is required")
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		var contribution ChannelContribution
		if err := lockForUpdate(tx).
			Select("id", "user_id").
			Where("id = ?", run.ContributionId).
			First(&contribution).Error; err != nil {
			return err
		}
		var revisionCount int64
		if err := tx.Model(&ChannelContributionRevision{}).
			Where("id = ? AND contribution_id = ? AND config_hash = ?", run.RevisionId, run.ContributionId, run.ConfigHash).
			Count(&revisionCount).Error; err != nil {
			return err
		}
		if revisionCount != 1 {
			return errors.New("test run revision does not match contribution configuration")
		}
		run.ActiveUserId = &run.ActorId
		return tx.Create(run).Error
	})
}

func GetChannelContributionTestRun(id int64) (*ChannelContributionTestRun, error) {
	var run ChannelContributionTestRun
	if err := DB.First(&run, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &run, nil
}

func GetChannelContributionTestRunForContribution(id int64, contributionId int) (*ChannelContributionTestRun, error) {
	var run ChannelContributionTestRun
	if err := DB.Where("id = ? AND contribution_id = ?", id, contributionId).First(&run).Error; err != nil {
		return nil, err
	}
	return &run, nil
}

func GetLatestChannelContributionTestRun(revisionId int, configHash string) (*ChannelContributionTestRun, error) {
	var run ChannelContributionTestRun
	err := DB.Where("revision_id = ? AND config_hash = ?", revisionId, configHash).
		Order("id desc").First(&run).Error
	if err != nil {
		return nil, err
	}
	return &run, nil
}

func GetLatestSuccessfulChannelContributionTestRun(revisionId int, configHash string) (*ChannelContributionTestRun, error) {
	var run ChannelContributionTestRun
	err := DB.Where("revision_id = ? AND config_hash = ? AND status = ?", revisionId, configHash, ChannelContributionTestRunStatusSucceeded).
		Order("completed_at desc, id desc").First(&run).Error
	if err != nil {
		return nil, err
	}
	return &run, nil
}

func ListChannelContributionTestResults(runId int64) ([]*ChannelContributionTestResult, error) {
	var results []*ChannelContributionTestResult
	err := DB.Where("test_run_id = ?", runId).Order("id asc").Find(&results).Error
	return results, err
}

func HasUnfinishedChannelContributionTestRuns() bool {
	var count int64
	if err := DB.Model(&ChannelContributionTestRun{}).
		Where("status IN ?", []ChannelContributionTestRunStatus{
			ChannelContributionTestRunStatusQueued,
			ChannelContributionTestRunStatusRunning,
		}).
		Limit(1).
		Count(&count).Error; err != nil {
		return false
	}
	return count > 0
}

func ClaimNextQueuedChannelContributionTestRun() (*ChannelContributionTestRun, error) {
	var claimed ChannelContributionTestRun
	err := DB.Transaction(func(tx *gorm.DB) error {
		var run ChannelContributionTestRun
		if err := lockForUpdate(tx).
			Where("status = ?", ChannelContributionTestRunStatusQueued).
			Order("id asc").
			First(&run).Error; err != nil {
			return err
		}
		now := common.GetTimestamp()
		result := tx.Model(&ChannelContributionTestRun{}).
			Where("id = ? AND status = ?", run.Id, ChannelContributionTestRunStatusQueued).
			Updates(map[string]any{
				"status":     ChannelContributionTestRunStatusRunning,
				"started_at": now,
				"updated_at": now,
			})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return gorm.ErrRecordNotFound
		}
		run.Status = ChannelContributionTestRunStatusRunning
		run.StartedAt = now
		run.UpdatedAt = now
		claimed = run
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &claimed, nil
}

func FinishChannelContributionTestRun(runId int64, status ChannelContributionTestRunStatus, pricingReady bool, results []ChannelContributionTestResult, runError string) error {
	if status != ChannelContributionTestRunStatusSucceeded && status != ChannelContributionTestRunStatusFailed {
		return errors.New("test run terminal status is invalid")
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		var run ChannelContributionTestRun
		if err := lockForUpdate(tx).Where("id = ?", runId).First(&run).Error; err != nil {
			return err
		}
		if run.Status != ChannelContributionTestRunStatusRunning {
			return errors.New("test run is not running")
		}
		now := common.GetTimestamp()
		passed := 0
		failed := 0
		for index := range results {
			results[index].TestRunId = run.Id
			results[index].RevisionId = run.RevisionId
			if results[index].CreatedAt == 0 {
				results[index].CreatedAt = now
			}
			if results[index].Success {
				passed++
			} else {
				failed++
			}
		}
		if len(results) > 0 {
			if err := tx.Create(&results).Error; err != nil {
				return err
			}
		}
		return tx.Model(&ChannelContributionTestRun{}).
			Where("id = ? AND status = ?", run.Id, ChannelContributionTestRunStatusRunning).
			Updates(map[string]any{
				"status":         status,
				"active_user_id": nil,
				"pricing_ready":  pricingReady,
				"total":          len(results),
				"passed":         passed,
				"failed":         failed,
				"error":          runError,
				"completed_at":   now,
				"updated_at":     now,
			}).Error
	})
}

func RequeueRunningChannelContributionTestRuns() (int64, error) {
	result := DB.Model(&ChannelContributionTestRun{}).
		Where("status = ?", ChannelContributionTestRunStatusRunning).
		Updates(map[string]any{
			"status":     ChannelContributionTestRunStatusQueued,
			"started_at": int64(0),
			"updated_at": common.GetTimestamp(),
		})
	return result.RowsAffected, result.Error
}

func SubmitChannelContribution(id int, userId int, revisionId int, configHash string, agreementVersion string, agreementContent string, agreementHash string, acceptedAt int64) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		var contribution ChannelContribution
		if err := lockForUpdate(tx).Where("id = ? AND user_id = ?", id, userId).First(&contribution).Error; err != nil {
			return err
		}
		if contribution.PendingRevisionId != nil || contribution.Status == ChannelContributionStatusDeleted {
			return errors.New("contribution is not ready for submission")
		}
		if contribution.CurrentRevisionId == nil || *contribution.CurrentRevisionId != revisionId {
			return errors.New("contribution revision changed before submission")
		}
		var revision ChannelContributionRevision
		if err := lockForUpdate(tx).Where("id = ? AND contribution_id = ?", revisionId, id).First(&revision).Error; err != nil {
			return err
		}
		if revision.ConfigHash != configHash {
			return errors.New("contribution configuration changed before submission")
		}
		computedConfigHash, err := ComputeChannelContributionConfigHash(&revision)
		if err != nil {
			return err
		}
		if computedConfigHash != revision.ConfigHash {
			return errors.New("contribution configuration fingerprint is stale")
		}
		switch revision.Status {
		case ChannelContributionRevisionStatusDraft, ChannelContributionRevisionStatusRejected, ChannelContributionRevisionStatusWithdrawn:
		default:
			return errors.New("contribution revision is not ready for submission")
		}
		if err := tx.Model(&ChannelContributionRevision{}).
			Where("id = ?", revision.Id).
			Updates(map[string]any{
				"status":                ChannelContributionRevisionStatusPending,
				"agreement_version":     agreementVersion,
				"agreement_content":     agreementContent,
				"agreement_hash":        agreementHash,
				"agreement_accepted_at": acceptedAt,
				"submitted_at":          acceptedAt,
				"reviewer_id":           0,
				"reviewer_username":     "",
				"reviewed_at":           int64(0),
				"review_reason":         "",
				"updated_at":            acceptedAt,
			}).Error; err != nil {
			return err
		}
		status := contribution.Status
		if contribution.ApprovedRevisionId == nil {
			status = ChannelContributionStatusPending
		}
		return tx.Model(&ChannelContribution{}).
			Where("id = ?", id).
			Updates(map[string]any{
				"status":              status,
				"pending_revision_id": revision.Id,
				"submitted_at":        acceptedAt,
				"reviewer_id":         0,
				"reviewer_username":   "",
				"reviewed_at":         int64(0),
				"review_reason":       "",
				"updated_at":          acceptedAt,
			}).Error
	})
}

func WithdrawChannelContribution(id int, userId int) error {
	deletedChannel := false
	err := DB.Transaction(func(tx *gorm.DB) error {
		var contribution ChannelContribution
		if err := lockForUpdate(tx).Where("id = ? AND user_id = ?", id, userId).First(&contribution).Error; err != nil {
			return err
		}
		if contribution.Status == ChannelContributionStatusDeleted {
			return nil
		}
		now := common.GetTimestamp()
		if contribution.PendingRevisionId != nil {
			if err := tx.Model(&ChannelContributionRevision{}).
				Where("id = ? AND status = ?", *contribution.PendingRevisionId, ChannelContributionRevisionStatusPending).
				Updates(map[string]any{
					"status":     ChannelContributionRevisionStatusWithdrawn,
					"updated_at": now,
				}).Error; err != nil {
				return err
			}
		}
		if contribution.ChannelId != nil {
			if err := tx.Where("channel_id = ?", *contribution.ChannelId).Delete(&Ability{}).Error; err != nil {
				return err
			}
			if err := tx.Where("id = ?", *contribution.ChannelId).Delete(&Channel{}).Error; err != nil {
				return err
			}
			deletedChannel = true
		}
		if err := tx.Model(&ChannelContributionRevision{}).
			Where("contribution_id = ?", id).
			Updates(map[string]any{"key": "", "updated_at": now}).Error; err != nil {
			return err
		}
		return tx.Model(&ChannelContribution{}).
			Where("id = ?", id).
			Updates(map[string]any{
				"status":              ChannelContributionStatusDeleted,
				"pending_revision_id": nil,
				"updated_at":          now,
			}).Error
	})
	if err == nil && deletedChannel {
		InitChannelCache()
	}
	return err
}

func ApproveChannelContribution(id int, revisionId int, approval ChannelContributionApproval) (*ChannelContribution, *Channel, error) {
	var approvedContribution ChannelContribution
	var approvedChannel Channel
	err := DB.Transaction(func(tx *gorm.DB) error {
		var contribution ChannelContribution
		if err := lockForUpdate(tx).Where("id = ?", id).First(&contribution).Error; err != nil {
			return err
		}
		if contribution.PendingRevisionId == nil || *contribution.PendingRevisionId != revisionId {
			return errors.New("contribution is not pending this revision")
		}
		var revision ChannelContributionRevision
		if err := lockForUpdate(tx).
			Where("id = ? AND contribution_id = ? AND status = ?", revisionId, id, ChannelContributionRevisionStatusPending).
			First(&revision).Error; err != nil {
			return err
		}
		computedConfigHash, err := ComputeChannelContributionConfigHash(&revision)
		if err != nil {
			return err
		}
		if computedConfigHash != revision.ConfigHash {
			return errors.New("contribution configuration fingerprint is stale")
		}

		baseURL := strings.TrimSpace(revision.BaseURL)
		mapping := revision.ModelMapping
		tag := strings.TrimSpace(approval.Tag)
		priority := approval.Priority
		weight := approval.Weight
		remark := fmt.Sprintf("贡献者：%d %s", contribution.UserId, contribution.Username)

		if contribution.ChannelId == nil {
			channel := Channel{
				Type:         revision.Type,
				Key:          revision.Key,
				Status:       common.ChannelStatusEnabled,
				Name:         revision.Name,
				Weight:       &weight,
				CreatedTime:  common.GetTimestamp(),
				BaseURL:      &baseURL,
				Models:       revision.Models,
				Group:        revision.Group,
				ModelMapping: &mapping,
				Priority:     &priority,
				Tag:          &tag,
				Remark:       &remark,
			}
			if err := tx.Create(&channel).Error; err != nil {
				return err
			}
			contribution.ChannelId = &channel.Id
			if err := ResetChannelContributionHealthForRevision(tx, &contribution, revision.Id, revision.ConfigHash); err != nil {
				return err
			}
			if err := channel.AddAbilities(tx); err != nil {
				return err
			}
			approvedChannel = channel
		} else {
			if err := lockForUpdate(tx).Where("id = ?", *contribution.ChannelId).First(&approvedChannel).Error; err != nil {
				return err
			}
			approvedChannel.Type = revision.Type
			approvedChannel.Key = revision.Key
			if approvedChannel.Status != common.ChannelStatusManuallyDisabled {
				approvedChannel.Status = common.ChannelStatusEnabled
			}
			approvedChannel.Name = revision.Name
			approvedChannel.BaseURL = &baseURL
			approvedChannel.Models = revision.Models
			approvedChannel.Group = revision.Group
			approvedChannel.ModelMapping = &mapping
			approvedChannel.Remark = &remark
			if err := tx.Model(&Channel{}).
				Where("id = ?", approvedChannel.Id).
				Select("type", "key", "status", "name", "base_url", "models", "group", "model_mapping", "remark").
				Updates(&approvedChannel).Error; err != nil {
				return err
			}
			if err := ResetChannelContributionHealthForRevision(tx, &contribution, revision.Id, revision.ConfigHash); err != nil {
				return err
			}
			if err := approvedChannel.UpdateAbilities(tx); err != nil {
				return err
			}
		}

		now := common.GetTimestamp()
		if contribution.ApprovedRevisionId != nil && *contribution.ApprovedRevisionId != revision.Id {
			if err := tx.Model(&ChannelContributionRevision{}).
				Where("id = ? AND status = ?", *contribution.ApprovedRevisionId, ChannelContributionRevisionStatusApproved).
				Updates(map[string]any{
					"status":     ChannelContributionRevisionStatusSuperseded,
					"updated_at": now,
				}).Error; err != nil {
				return err
			}
		}
		if err := tx.Model(&ChannelContributionRevision{}).
			Where("id = ?", revision.Id).
			Updates(map[string]any{
				"status":            ChannelContributionRevisionStatusApproved,
				"reviewer_id":       approval.ReviewerId,
				"reviewer_username": approval.ReviewerUsername,
				"reviewed_at":       now,
				"review_reason":     "",
				"updated_at":        now,
			}).Error; err != nil {
			return err
		}
		if err := tx.Model(&ChannelContribution{}).
			Where("id = ?", id).
			Updates(map[string]any{
				"status":               ChannelContributionStatusApproved,
				"channel_id":           approvedChannel.Id,
				"current_revision_id":  revision.Id,
				"pending_revision_id":  nil,
				"approved_revision_id": revision.Id,
				"reviewer_id":          approval.ReviewerId,
				"reviewer_username":    approval.ReviewerUsername,
				"reviewed_at":          now,
				"review_reason":        "",
				"unavailable_since":    int64(0),
				"updated_at":           now,
			}).Error; err != nil {
			return err
		}
		contribution.Status = ChannelContributionStatusApproved
		contribution.CurrentRevisionId = &revision.Id
		contribution.PendingRevisionId = nil
		contribution.ApprovedRevisionId = &revision.Id
		contribution.ReviewerId = approval.ReviewerId
		contribution.ReviewerUsername = approval.ReviewerUsername
		contribution.ReviewedAt = now
		contribution.ReviewReason = ""
		contribution.UnavailableSince = 0
		contribution.UpdatedAt = now
		approvedContribution = contribution
		return nil
	})
	if err != nil {
		return nil, nil, err
	}
	InitChannelCache()
	return &approvedContribution, &approvedChannel, nil
}

func RejectChannelContribution(id int, revisionId int, reviewerId int, reviewerUsername string, reason string) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		var contribution ChannelContribution
		if err := lockForUpdate(tx).Where("id = ?", id).First(&contribution).Error; err != nil {
			return err
		}
		if contribution.PendingRevisionId == nil || *contribution.PendingRevisionId != revisionId {
			return errors.New("contribution is not pending this revision")
		}
		now := common.GetTimestamp()
		if err := tx.Model(&ChannelContributionRevision{}).
			Where("id = ? AND status = ?", revisionId, ChannelContributionRevisionStatusPending).
			Updates(map[string]any{
				"status":            ChannelContributionRevisionStatusRejected,
				"reviewer_id":       reviewerId,
				"reviewer_username": reviewerUsername,
				"reviewed_at":       now,
				"review_reason":     reason,
				"updated_at":        now,
			}).Error; err != nil {
			return err
		}
		status := contribution.Status
		if contribution.ApprovedRevisionId == nil {
			status = ChannelContributionStatusRejected
		}
		return tx.Model(&ChannelContribution{}).
			Where("id = ?", id).
			Updates(map[string]any{
				"status":              status,
				"pending_revision_id": nil,
				"reviewer_id":         reviewerId,
				"reviewer_username":   reviewerUsername,
				"reviewed_at":         now,
				"review_reason":       reason,
				"updated_at":          now,
			}).Error
	})
}

func DeleteChannelContribution(id int, reviewerId int, reviewerUsername string, reason string) error {
	deletedChannel := false
	err := DB.Transaction(func(tx *gorm.DB) error {
		var contribution ChannelContribution
		if err := lockForUpdate(tx).Where("id = ?", id).First(&contribution).Error; err != nil {
			return err
		}
		if contribution.Status == ChannelContributionStatusDeleted {
			return nil
		}
		if contribution.ChannelId != nil {
			if err := tx.Where("channel_id = ?", *contribution.ChannelId).Delete(&Ability{}).Error; err != nil {
				return err
			}
			if err := tx.Where("id = ?", *contribution.ChannelId).Delete(&Channel{}).Error; err != nil {
				return err
			}
			deletedChannel = true
		}
		now := common.GetTimestamp()
		if contribution.PendingRevisionId != nil {
			if err := tx.Model(&ChannelContributionRevision{}).
				Where("id = ? AND status = ?", *contribution.PendingRevisionId, ChannelContributionRevisionStatusPending).
				Updates(map[string]any{"status": ChannelContributionRevisionStatusWithdrawn, "updated_at": now}).Error; err != nil {
				return err
			}
		}
		if err := tx.Model(&ChannelContributionRevision{}).
			Where("contribution_id = ?", id).
			Updates(map[string]any{"key": "", "updated_at": now}).Error; err != nil {
			return err
		}
		return tx.Model(&ChannelContribution{}).
			Where("id = ?", id).
			Updates(map[string]any{
				"status":              ChannelContributionStatusDeleted,
				"pending_revision_id": nil,
				"reviewer_id":         reviewerId,
				"reviewer_username":   reviewerUsername,
				"reviewed_at":         now,
				"review_reason":       reason,
				"updated_at":          now,
			}).Error
	})
	if err == nil && deletedChannel {
		InitChannelCache()
	}
	return err
}

func IsValidChannelContributionStatus(status ChannelContributionStatus) bool {
	switch status {
	case ChannelContributionStatusDraft,
		ChannelContributionStatusPending,
		ChannelContributionStatusApproved,
		ChannelContributionStatusRejected,
		ChannelContributionStatusUnavailable,
		ChannelContributionStatusDeleted:
		return true
	default:
		return false
	}
}

func ValidateContributionChannelType(channelType int) error {
	if channelType <= 0 {
		return errors.New("channel type is required")
	}
	if channelType >= len(constant.ChannelBaseURLs) {
		return fmt.Errorf("unsupported channel type %d", channelType)
	}
	if _, ok := constant.ChannelTypeNames[channelType]; !ok {
		return fmt.Errorf("unsupported channel type %d", channelType)
	}
	return nil
}
