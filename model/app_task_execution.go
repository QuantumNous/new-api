package model

import (
	"context"
	"errors"
	"slices"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"gorm.io/gorm"
)

const (
	AppExecutionKindTask     = "task"
	AppExecutionKindResponse = "response"
)

var (
	ErrAppTaskNotFound                   = errors.New("not_found")
	ErrAppExecutionScopeDenied           = errors.New("scope_denied")
	ErrAppExecutionIdempotencyConflict   = errors.New("idempotency_conflict")
	ErrAppExecutionGrantExpired          = errors.New("execution_grant_expired")
	ErrAppExecutionInvalidFunding        = errors.New("invalid_funding")
	ErrAppExecutionInvalidGrant          = errors.New("invalid_grant")
	ErrAppExecutionIdentityInactive      = errors.New("identity_inactive")
	ErrAppExecutionAccountingUnavailable = errors.New("wallet_accounting_unavailable")
	ErrAppExecutionInsufficientQuota     = errors.New("insufficient_quota")
	ErrAppExecutionFundingPeriodChanged  = errors.New("funding_period_changed")
)

type AppTaskExecution struct {
	ID                   int64  `gorm:"primaryKey"`
	ExecutionKind        string `gorm:"size:16;not null;default:task;index"`
	LogicalHash          string `gorm:"size:64;not null;uniqueIndex"`
	TaskID               string `gorm:"size:64;not null;uniqueIndex"`
	GrantID              string `gorm:"size:64;not null;uniqueIndex"`
	AppKey               string `gorm:"size:128;not null"`
	InstallationID       string `gorm:"size:64;not null;index"`
	AppSessionID         string `gorm:"size:64;not null"`
	Subject              string `gorm:"size:64;not null"`
	UserID               int    `gorm:"not null;index"`
	RunID                string `gorm:"size:64;not null"`
	ExecutionRequestID   string `gorm:"size:64;not null"`
	Operation            string `gorm:"size:32;not null"`
	SubmissionHash       string `gorm:"size:64;not null"`
	PublicModel          string `gorm:"size:128;not null"`
	ActualModel          string `gorm:"size:128;not null"`
	ActualGroup          string `gorm:"size:64;not null"`
	ChannelID            int    `gorm:"not null"`
	ConnectionDigest     string `gorm:"size:64;not null;default:''"`
	CredentialDigest     string `gorm:"size:64;not null;default:''"`
	CredentialIndex      int    `gorm:"not null;default:0"`
	PluginKey            string `gorm:"size:64;not null"`
	PluginVersion        string `gorm:"size:64;not null"`
	PluginSHA256         string `gorm:"size:64;not null"`
	Protocol             string `gorm:"size:64;not null"`
	ProviderTaskID       string `gorm:"size:255;not null"`
	ProviderAccepted     bool   `gorm:"not null"`
	Status               string `gorm:"size:32;not null"` // submission, never provider terminal state
	ProviderState        string `gorm:"size:32;not null"`
	BillingState         string `gorm:"size:32;not null"`
	FundingSource        string `gorm:"size:32;not null"`
	FundingRef           string `gorm:"size:128;not null;index"`
	SubscriptionID       int    `gorm:"not null;index"`
	PeriodStart          int64  `gorm:"not null"`
	PeriodEnd            int64  `gorm:"not null"`
	PeriodReset          int64  `gorm:"not null"`
	ReservedQuota        int64  `gorm:"not null"`
	FinalQuota           int64  `gorm:"not null"`
	PriceSnapshotJSON    string `gorm:"type:text;not null"`
	RequestFactsJSON     string `gorm:"type:text;not null"`
	UsageJSON            string `gorm:"type:text;not null"`
	ResultJSON           string `gorm:"type:text;not null"`
	ArtifactsJSON        string `gorm:"type:text;not null"`
	ProviderEvidenceHash string `gorm:"size:64;not null"`
	PricedAt             int64  `gorm:"not null"`
	CreatedAt            int64  `gorm:"not null"`
	UpdatedAt            int64  `gorm:"not null"`
}

type AppTaskScope struct {
	// AppSessionID is not an ownership selector: a current same-user session
	// may read work created through an earlier session.
	AppKey, InstallationID, AppSessionID, Subject string
	UserID                                        int
}

func GetScopedAppTask(ctx context.Context, db *gorm.DB, scope AppTaskScope, taskID, grantID string) (AppTaskExecution, error) {
	var row AppTaskExecution
	if (taskID == "") == (grantID == "") || scope.UserID <= 0 || scope.AppKey == "" ||
		scope.InstallationID == "" || scope.Subject == "" {
		return row, ErrAppTaskNotFound
	}
	query := db.WithContext(ctx).Where("app_key = ? AND installation_id = ? AND subject = ? AND user_id = ?",
		scope.AppKey, scope.InstallationID, scope.Subject, scope.UserID).
		Where("execution_kind = ?", AppExecutionKindTask)
	if taskID != "" {
		query = query.Where("task_id = ?", taskID)
	} else {
		query = query.Where("grant_id = ?", grantID)
	}
	if err := query.First(&row).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return AppTaskExecution{}, ErrAppTaskNotFound
		}
		return AppTaskExecution{}, err
	}
	// SQL equality can be case-insensitive on MySQL; opaque ownership and
	// selector bindings must remain byte-exact on every supported database.
	if row.AppKey != scope.AppKey || row.InstallationID != scope.InstallationID ||
		row.Subject != scope.Subject || row.UserID != scope.UserID || row.ExecutionKind != AppExecutionKindTask ||
		(taskID != "" && row.TaskID != taskID) || (grantID != "" && row.GrantID != grantID) {
		return AppTaskExecution{}, ErrAppTaskNotFound
	}
	return row, nil
}

// Claim is the durable pre-I/O barrier. Call only after current service/session
// authorization in the same outer transaction. A replay never wins dispatch,
// including a crash that left dispatching or acceptance_unknown.
func ClaimAppTaskExecutionTx(tx *gorm.DB, grantID string, request AppTaskExecution, now time.Time) (AppTaskExecution, bool, error) {
	var grant AppExecutionGrant
	if err := lockForUpdate(tx).Where("grant_id = ?", grantID).First(&grant).Error; err != nil {
		return AppTaskExecution{}, false, err
	}
	if request.GrantID != grantID || grant.AppKey != request.AppKey || grant.InstallationID != request.InstallationID ||
		grant.AppSessionID != request.AppSessionID || grant.Subject != request.Subject || grant.UserID != request.UserID ||
		grant.RunID != request.RunID || grant.ExecutionRequestID != request.ExecutionRequestID || grant.Operation != request.Operation ||
		request.SubmissionHash == "" {
		return AppTaskExecution{}, false, ErrAppExecutionScopeDenied
	}
	logical := appPluginStableID("app-task-logical/v1", grant.InstallationID, grant.Subject,
		grant.RunID, grant.ExecutionRequestID, grant.Operation)
	var existing AppTaskExecution
	q := lockForUpdate(tx).Where("logical_hash = ? OR grant_id = ?", logical, grantID).Limit(1).Find(&existing)
	if q.Error != nil {
		return existing, false, q.Error
	}
	if q.RowsAffected != 0 {
		if existing.ExecutionKind != AppExecutionKindTask ||
			existing.SubmissionHash != request.SubmissionHash || existing.GrantID != grantID {
			return AppTaskExecution{}, false, ErrAppExecutionIdempotencyConflict
		}
		return existing, false, nil
	}
	if grant.ExpiresAt <= now.Unix() {
		return AppTaskExecution{}, false, ErrAppExecutionGrantExpired
	}
	if request.ReservedQuota < 0 || request.ReservedQuota > 2147483647 || request.FundingSource != grant.FundingSource {
		return AppTaskExecution{}, false, ErrAppExecutionInvalidFunding
	}
	var models []AppExecutionModel
	if common.UnmarshalJsonStr(grant.ModelsJSON, &models) != nil {
		return AppTaskExecution{}, false, ErrAppExecutionInvalidGrant
	}
	selected := slices.IndexFunc(models, func(m AppExecutionModel) bool {
		return isTaskBackedExecutionModel(m) &&
			m.PublicModel == request.PublicModel && m.ActualModel == request.ActualModel &&
			m.ChannelID == request.ChannelID && m.Group == request.ActualGroup && m.PluginKey == request.PluginKey &&
			m.PluginVersion == request.PluginVersion && m.PluginSHA256 == request.PluginSHA256 && m.Protocol == request.Protocol
	})
	if selected < 0 {
		return AppTaskExecution{}, false, ErrAppExecutionScopeDenied
	}
	funding, err := ReserveAppExecutionFundingTx(tx, grant, request.ReservedQuota, now)
	if err != nil {
		return AppTaskExecution{}, false, err
	}
	taskID, err := NewAppPluginOpaqueID()
	if err != nil {
		return AppTaskExecution{}, false, err
	}
	price, err := common.Marshal(models[selected])
	if err != nil {
		return AppTaskExecution{}, false, err
	}
	// Build a new row rather than persisting caller-supplied state/evidence.
	row := AppTaskExecution{ExecutionKind: AppExecutionKindTask, LogicalHash: logical, TaskID: taskID, GrantID: grantID,
		AppKey: grant.AppKey, InstallationID: grant.InstallationID, AppSessionID: grant.AppSessionID,
		Subject: grant.Subject, UserID: grant.UserID, RunID: grant.RunID, ExecutionRequestID: grant.ExecutionRequestID,
		Operation: grant.Operation, SubmissionHash: request.SubmissionHash, PublicModel: request.PublicModel,
		ActualModel: request.ActualModel, ActualGroup: request.ActualGroup, ChannelID: request.ChannelID,
		ConnectionDigest: request.ConnectionDigest, CredentialDigest: request.CredentialDigest, CredentialIndex: request.CredentialIndex,
		PluginKey: request.PluginKey, PluginVersion: request.PluginVersion, PluginSHA256: request.PluginSHA256,
		Protocol: request.Protocol, Status: "dispatching", ProviderState: "unknown", BillingState: "reserved",
		FundingSource: grant.FundingSource, FundingRef: grant.FundingRef, SubscriptionID: funding.SubscriptionID,
		PeriodStart: funding.PeriodStart, PeriodEnd: funding.PeriodEnd, PeriodReset: funding.PeriodReset,
		ReservedQuota: request.ReservedQuota, PriceSnapshotJSON: string(price), RequestFactsJSON: request.RequestFactsJSON, PricedAt: now.Unix(),
		CreatedAt: now.Unix(), UpdatedAt: now.Unix()}
	if err := tx.Create(&row).Error; err != nil {
		return AppTaskExecution{}, false, err
	}
	if err := tx.Create(&AppTaskReconcile{ExecutionID: row.ID, NextAttemptAt: now.Unix()}).Error; err != nil {
		return AppTaskExecution{}, false, err
	}
	if err := EnsureSystemTaskTx(tx, SystemTaskTypeAppTaskReconcile); err != nil {
		return AppTaskExecution{}, false, err
	}
	return row, true, nil
}

// ReleaseAppTaskExecutionBeforeDispatchTx removes a claimed execution only
// when the provider request is known not to have started.
func ReleaseAppTaskExecutionBeforeDispatchTx(tx *gorm.DB, executionID int64) error {
	if executionID <= 0 {
		return errors.New("invalid_execution")
	}
	var locator AppTaskExecution
	if err := tx.Where("id = ? AND execution_kind = ?", executionID, AppExecutionKindTask).
		First(&locator).Error; err != nil {
		return err
	}
	user, sub, err := lockAppTaskFundingTx(tx, locator)
	if err != nil {
		return err
	}
	var execution AppTaskExecution
	lockErr := lockForUpdate(tx).Where("id = ?", executionID).First(&execution).Error
	if lockErr != nil {
		return lockErr
	}
	if execution.ExecutionKind != AppExecutionKindTask ||
		execution.UserID != locator.UserID ||
		execution.FundingSource != locator.FundingSource ||
		execution.SubscriptionID != locator.SubscriptionID ||
		execution.FundingRef != locator.FundingRef ||
		execution.Status != "dispatching" ||
		execution.BillingState != "reserved" ||
		execution.ProviderAccepted ||
		execution.ProviderTaskID != "" {
		return errors.New("invalid_state_transition")
	}
	settled, err := settleAppTaskFundingTx(tx, execution, user, sub, 0)
	if err != nil {
		return err
	}
	if !settled {
		return ErrAppExecutionFundingPeriodChanged
	}
	if err := tx.Where("execution_id = ?", execution.ID).Delete(&AppTaskReconcile{}).Error; err != nil {
		return err
	}
	result := tx.Where(
		"id = ? AND execution_kind = ? AND status = ? AND billing_state = ? AND provider_accepted = ? AND provider_task_id = ?",
		execution.ID,
		AppExecutionKindTask,
		"dispatching",
		"reserved",
		false,
		"",
	).Delete(&AppTaskExecution{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != 1 {
		return errors.New("invalid_state_transition")
	}
	return nil
}

func isTaskBackedExecutionModel(candidate AppExecutionModel) bool {
	return candidate.IsTaskBacked()
}

// RecordAppTaskAcceptanceTx records a host-observed outcome after the durable
// dispatch claim. Losing the response cannot authorize a resend or refund.
func RecordAppTaskAcceptanceTx(tx *gorm.DB, executionID int64, providerID, state string, now time.Time) error {
	if len(providerID) > 255 || strings.TrimSpace(providerID) != providerID {
		return errors.New("invalid_provider_observation")
	}
	if providerID == "" && state != "unknown" {
		return errors.New("invalid_provider_observation")
	}
	if providerID != "" && !slices.Contains([]string{"queued", "running", "succeeded", "failed", "cancelled"}, state) {
		return errors.New("invalid_provider_observation")
	}
	var execution AppTaskExecution
	if err := lockForUpdate(tx).Where("id = ?", executionID).First(&execution).Error; err != nil {
		return err
	}
	if execution.ExecutionKind != AppExecutionKindTask {
		return errors.New("invalid_execution_kind")
	}
	if execution.ProviderAccepted {
		if execution.ProviderTaskID != providerID {
			return errors.New("provider_identity_conflict")
		}
		return nil // late duplicate responses cannot downgrade terminal facts
	}
	if execution.Status != "dispatching" && execution.Status != "acceptance_unknown" {
		return errors.New("invalid_state_transition")
	}
	if providerID == "" {
		return tx.Model(&AppTaskExecution{}).Where("id = ? AND execution_kind = ?", executionID, AppExecutionKindTask).
			Updates(map[string]any{"status": "acceptance_unknown", "updated_at": now.Unix()}).Error
	}
	projection := Task{TaskID: execution.TaskID, Platform: constant.TaskPlatform(execution.PluginKey),
		UserId: execution.UserID, Group: execution.ActualGroup, ChannelId: execution.ChannelID,
		Quota: int(execution.ReservedQuota), Action: execution.Operation, Status: appProviderTaskStatus(state),
		ExecutionMode: "app_managed", SubmitTime: execution.CreatedAt, CreatedAt: execution.CreatedAt, UpdatedAt: now.Unix(),
		Properties:  Properties{OriginModelName: execution.PublicModel, UpstreamModelName: execution.ActualModel},
		PrivateData: TaskPrivateData{UpstreamTaskID: providerID}}
	projection.PrivateData.ResponsesBackground = execution.Protocol == "openai_responses"
	if err := tx.Create(&projection).Error; err != nil {
		return err
	}
	return tx.Model(&AppTaskExecution{}).Where("id = ? AND execution_kind = ?", executionID, AppExecutionKindTask).Updates(map[string]any{
		"provider_task_id": providerID, "provider_accepted": true, "status": "accepted",
		"provider_state": state, "updated_at": now.Unix(),
	}).Error
}

func appProviderTaskStatus(state string) TaskStatus {
	switch state {
	case "queued":
		return TaskStatusQueued
	case "running":
		return TaskStatusInProgress
	case "succeeded":
		return TaskStatusSuccess
	case "failed":
		return TaskStatusFailure
	case "cancelled":
		return TaskStatusCancelled
	default:
		return TaskStatusUnknown
	}
}
