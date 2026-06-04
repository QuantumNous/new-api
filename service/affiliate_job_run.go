package service

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
)

const (
	affiliateJobRunStageStarting                   = "starting"
	affiliateJobRunStageKPI                        = "kpi"
	affiliateJobRunStageCommission                 = "commission"
	affiliateJobRunStageHeadFee                    = "head_fee"
	affiliateJobRunStageSettlement                 = "settlement"
	affiliateJobRunStageSettlementCommissionEvents = "settlement_commission_events"
	affiliateJobRunStageSettlementHeadFeeEvents    = "settlement_head_fee_events"
	affiliateJobRunStageComplete                   = "complete"

	affiliateJobRunStaleAfterSeconds = 6 * 60 * 60
)

var affiliateJobRunSensitiveKVPattern = regexp.MustCompile(`(?i)\b(password|passwd|token|api[_-]?key|secret)=([^\s,;]+)`)
var affiliateJobRunSensitiveStructuredPattern = regexp.MustCompile(`(?i)(["']?(?:password|passwd|token|api[_-]?key|secret)["']?\s*:\s*["']?)([^"',}\s]+)(["']?)`)

type affiliateSettlementRunIdempotencyPayload struct {
	JobType         string  `json:"job_type"`
	RuleSetId       int     `json:"rule_set_id"`
	PeriodStart     int64   `json:"period_start"`
	PeriodEnd       int64   `json:"period_end"`
	FreezeDays      int     `json:"freeze_days"`
	DryRun          bool    `json:"dry_run"`
	QuotaPerUnit    float64 `json:"quota_per_unit"`
	USDExchangeRate float64 `json:"usd_exchange_rate"`
}

type affiliateSettlementGenerateIdempotencyPayload struct {
	JobType     string `json:"job_type"`
	RuleSetId   int    `json:"rule_set_id"`
	PeriodStart int64  `json:"period_start"`
	PeriodEnd   int64  `json:"period_end"`
	FreezeDays  int    `json:"freeze_days"`
	AutoRun     bool   `json:"auto_run"`
}

func createAffiliateSettlementPipelineJobRun(db *gorm.DB, input AffiliateSettlementRunInput) (model.AffiliateJobRun, error) {
	idempotencyKey := affiliateSettlementRunIdempotencyKey(input)
	inputSnapshot := affiliateSettlementRunInputSnapshot(input)
	if jobRun, ok, err := resumeRestartableAffiliateJobRun(db, model.AffiliateJobRunTypeSettlementPipeline, idempotencyKey, input.ActorUserId, input.Now, inputSnapshot); err != nil {
		return model.AffiliateJobRun{}, err
	} else if ok {
		return jobRun, nil
	}

	jobRun := model.AffiliateJobRun{
		JobType:        model.AffiliateJobRunTypeSettlementPipeline,
		Status:         model.AffiliateJobRunStatusRunning,
		IdempotencyKey: idempotencyKey,
		RuleSetId:      input.RuleSetId,
		PeriodStart:    input.PeriodStart,
		PeriodEnd:      input.PeriodEnd,
		ActorUserId:    input.ActorUserId,
		CurrentStage:   affiliateJobRunStageStarting,
		InputSnapshot:  inputSnapshot,
		StartedAt:      input.Now,
	}
	if err := db.Create(&jobRun).Error; err != nil {
		return model.AffiliateJobRun{}, err
	}
	return jobRun, nil
}

func GenerateAffiliateSettlementsWithJobRun(db *gorm.DB, input AffiliateSettlementBuildInput) ([]model.AffiliateSettlement, model.AffiliateJobRun, error) {
	if db == nil {
		return nil, model.AffiliateJobRun{}, errors.New("nil db")
	}
	if input.PeriodStart > 0 && input.PeriodEnd > 0 && input.PeriodEnd < input.PeriodStart {
		return nil, model.AffiliateJobRun{}, errors.New("invalid settlement period")
	}
	if input.GeneratedAt == 0 {
		input.GeneratedAt = common.GetTimestamp()
	}

	jobRun, err := createAffiliateSettlementGenerateJobRun(db, input)
	if err != nil {
		return nil, model.AffiliateJobRun{}, err
	}

	input.JobRunId = jobRun.Id
	settlements, err := GenerateAffiliateSettlements(db, input)
	if err != nil {
		if updateErr := finishAffiliateJobRunFailure(db, jobRun, affiliateJobRunStageSettlement, err, input.GeneratedAt); updateErr != nil {
			return nil, jobRun, errors.Join(err, updateErr)
		}
		if loadErr := db.First(&jobRun, jobRun.Id).Error; loadErr != nil {
			return nil, jobRun, errors.Join(err, loadErr)
		}
		return nil, jobRun, err
	}

	if err := finishAffiliateSettlementGenerateJobRunSuccess(db, jobRun, settlements, input.GeneratedAt); err != nil {
		return settlements, jobRun, err
	}
	if err := db.First(&jobRun, jobRun.Id).Error; err != nil {
		return settlements, jobRun, err
	}
	return settlements, jobRun, nil
}

func createAffiliateSettlementGenerateJobRun(db *gorm.DB, input AffiliateSettlementBuildInput) (model.AffiliateJobRun, error) {
	idempotencyKey := affiliateSettlementGenerateIdempotencyKey(input)
	inputSnapshot := affiliateSettlementGenerateInputSnapshot(input)
	if jobRun, ok, err := resumeRestartableAffiliateJobRun(db, model.AffiliateJobRunTypeSettlementGenerate, idempotencyKey, input.ActorUserId, input.GeneratedAt, inputSnapshot); err != nil {
		return model.AffiliateJobRun{}, err
	} else if ok {
		return jobRun, nil
	}

	jobRun := model.AffiliateJobRun{
		JobType:        model.AffiliateJobRunTypeSettlementGenerate,
		Status:         model.AffiliateJobRunStatusRunning,
		IdempotencyKey: idempotencyKey,
		RuleSetId:      input.RuleSetId,
		PeriodStart:    input.PeriodStart,
		PeriodEnd:      input.PeriodEnd,
		ActorUserId:    input.ActorUserId,
		CurrentStage:   affiliateJobRunStageStarting,
		InputSnapshot:  inputSnapshot,
		StartedAt:      input.GeneratedAt,
	}
	if err := db.Create(&jobRun).Error; err != nil {
		return model.AffiliateJobRun{}, err
	}
	return jobRun, nil
}

func resumeRestartableAffiliateJobRun(db *gorm.DB, jobType string, idempotencyKey string, actorUserId int, startedAt int64, inputSnapshot string) (model.AffiliateJobRun, bool, error) {
	if jobRun, ok, err := findRunningAffiliateJobRun(db, jobType, idempotencyKey); err != nil {
		return model.AffiliateJobRun{}, false, err
	} else if ok {
		if !isAffiliateJobRunStale(jobRun, startedAt) {
			return model.AffiliateJobRun{}, false, fmt.Errorf("affiliate %s job run is already running for the same parameters", jobType)
		}
		return resetAffiliateJobRunForResume(db, jobRun, model.AffiliateJobRunStatusRunning, actorUserId, startedAt, inputSnapshot, false)
	}
	return resumeFailedAffiliateJobRun(db, jobType, idempotencyKey, actorUserId, startedAt, inputSnapshot)
}

func findRunningAffiliateJobRun(db *gorm.DB, jobType string, idempotencyKey string) (model.AffiliateJobRun, bool, error) {
	var jobRun model.AffiliateJobRun
	err := db.Where("job_type = ? AND idempotency_key = ? AND status = ?", jobType, idempotencyKey, model.AffiliateJobRunStatusRunning).
		Order("id desc").
		First(&jobRun).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return model.AffiliateJobRun{}, false, nil
	}
	if err != nil {
		return model.AffiliateJobRun{}, false, err
	}
	return jobRun, true, nil
}

func isAffiliateJobRunStale(jobRun model.AffiliateJobRun, now int64) bool {
	lastActivityAt := jobRun.UpdatedAt
	if lastActivityAt <= 0 || jobRun.StartedAt > lastActivityAt {
		lastActivityAt = jobRun.StartedAt
	}
	if now <= 0 || lastActivityAt <= 0 {
		return false
	}
	return now-lastActivityAt >= affiliateJobRunStaleAfterSeconds
}

func resumeFailedAffiliateJobRun(db *gorm.DB, jobType string, idempotencyKey string, actorUserId int, startedAt int64, inputSnapshot string) (model.AffiliateJobRun, bool, error) {
	var jobRun model.AffiliateJobRun
	err := db.Where("job_type = ? AND idempotency_key = ? AND status = ?", jobType, idempotencyKey, model.AffiliateJobRunStatusFailed).
		Order("id desc").
		First(&jobRun).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return model.AffiliateJobRun{}, false, nil
	}
	if err != nil {
		return model.AffiliateJobRun{}, false, err
	}

	return resetAffiliateJobRunForResume(db, jobRun, model.AffiliateJobRunStatusFailed, actorUserId, startedAt, inputSnapshot, true)
}

func resetAffiliateJobRunForResume(db *gorm.DB, jobRun model.AffiliateJobRun, expectedStatus string, actorUserId int, startedAt int64, inputSnapshot string, preserveCursor bool) (model.AffiliateJobRun, bool, error) {
	updates := map[string]interface{}{
		"status":                 model.AffiliateJobRunStatusRunning,
		"actor_user_id":          actorUserId,
		"current_stage":          affiliateJobRunStageStarting,
		"last_cursor_created_at": 0,
		"last_cursor_id":         0,
		"kpi_snapshot_count":     0,
		"commission_event_count": 0,
		"head_fee_event_count":   0,
		"settlement_count":       0,
		"input_snapshot":         inputSnapshot,
		"result_snapshot":        "",
		"error_message":          "",
		"started_at":             startedAt,
		"finished_at":            0,
	}
	if preserveCursor {
		updates["current_stage"] = jobRun.CurrentStage
		updates["last_cursor_created_at"] = jobRun.LastCursorCreatedAt
		updates["last_cursor_id"] = jobRun.LastCursorId
		updates["kpi_snapshot_count"] = jobRun.KPISnapshotCount
		updates["commission_event_count"] = jobRun.CommissionEventCount
		updates["head_fee_event_count"] = jobRun.HeadFeeEventCount
		updates["settlement_count"] = jobRun.SettlementCount
		updates["result_snapshot"] = affiliateJobRunResumeCursorSnapshot(jobRun)
	}
	query := db.Model(&model.AffiliateJobRun{}).Where("id = ? AND status = ?", jobRun.Id, expectedStatus)
	if expectedStatus == model.AffiliateJobRunStatusRunning {
		query = query.Where("started_at = ? AND updated_at = ?", jobRun.StartedAt, jobRun.UpdatedAt)
	}
	result := query.Updates(updates)
	if result.Error != nil {
		return model.AffiliateJobRun{}, false, result.Error
	}
	if result.RowsAffected == 0 {
		return model.AffiliateJobRun{}, false, fmt.Errorf("affiliate %s job run state changed while attempting resume", jobRun.JobType)
	}
	if err := db.First(&jobRun, jobRun.Id).Error; err != nil {
		return model.AffiliateJobRun{}, false, err
	}
	return jobRun, true, nil
}

func affiliateJobRunResumeCursorSnapshot(jobRun model.AffiliateJobRun) string {
	snapshot := map[string]interface{}{}
	if strings.TrimSpace(jobRun.ResultSnapshot) != "" {
		var parsed map[string]interface{}
		if err := json.Unmarshal([]byte(jobRun.ResultSnapshot), &parsed); err == nil {
			for _, key := range affiliateJobRunResumeCursorSnapshotKeys() {
				if value, ok := parsed[key]; ok {
					snapshot[key] = value
				}
			}
		}
	}
	if jobRun.LastCursorId > 0 {
		for key, value := range affiliateJobRunCursorSnapshotFields(jobRun.CurrentStage, jobRun.LastCursorCreatedAt, jobRun.LastCursorId) {
			snapshot[key] = value
		}
	}
	if len(snapshot) == 0 {
		return ""
	}
	return common.GetJsonString(snapshot)
}

func affiliateJobRunResumeCursorSnapshotKeys() []string {
	return []string{
		"kpi_log_id",
		"kpi_log_created_at",
		"commission_log_id",
		"commission_log_created_at",
		"head_fee_log_id",
		"head_fee_log_created_at",
		"settlement_commission_event_id",
		"settlement_head_fee_event_id",
		"settlement_count",
		"settlement_ids",
		"last_cursor_id",
		"last_cursor_created_at",
	}
}

func updateAffiliateJobRunProgress(db *gorm.DB, jobRunId int, stage string, updates map[string]interface{}) error {
	if jobRunId <= 0 {
		return nil
	}
	if updates == nil {
		updates = map[string]interface{}{}
	}
	updates["current_stage"] = stage
	return db.Model(&model.AffiliateJobRun{}).Where("id = ?", jobRunId).Updates(updates).Error
}

func finishAffiliateJobRunSuccess(db *gorm.DB, jobRun model.AffiliateJobRun, result AffiliateSettlementRunResult, finishedAt int64) error {
	if finishedAt == 0 {
		finishedAt = common.GetTimestamp()
	}
	return updateAffiliateJobRunProgress(db, jobRun.Id, affiliateJobRunStageComplete, map[string]interface{}{
		"status":                 model.AffiliateJobRunStatusSucceeded,
		"finished_at":            finishedAt,
		"kpi_snapshot_count":     result.KPISnapshotCount,
		"commission_event_count": result.CommissionEventCount,
		"head_fee_event_count":   result.HeadFeeEventCount,
		"settlement_count":       result.SettlementCount,
		"result_snapshot":        affiliateSettlementRunResultSnapshot(db, jobRun.Id, result),
		"error_message":          "",
	})
}

func finishAffiliateSettlementGenerateJobRunSuccess(db *gorm.DB, jobRun model.AffiliateJobRun, settlements []model.AffiliateSettlement, finishedAt int64) error {
	if finishedAt == 0 {
		finishedAt = common.GetTimestamp()
	}
	return updateAffiliateJobRunProgress(db, jobRun.Id, affiliateJobRunStageComplete, map[string]interface{}{
		"status":           model.AffiliateJobRunStatusSucceeded,
		"finished_at":      finishedAt,
		"settlement_count": len(settlements),
		"result_snapshot":  affiliateSettlementGenerateResultSnapshot(db, jobRun.Id, settlements),
		"error_message":    "",
	})
}

func finishAffiliateJobRunFailure(db *gorm.DB, jobRun model.AffiliateJobRun, stage string, cause error, finishedAt int64) error {
	if finishedAt == 0 {
		finishedAt = common.GetTimestamp()
	}
	return updateAffiliateJobRunProgress(db, jobRun.Id, stage, map[string]interface{}{
		"status":          model.AffiliateJobRunStatusFailed,
		"finished_at":     finishedAt,
		"error_message":   sanitizeAffiliateJobRunError(cause),
		"result_snapshot": affiliateJobRunFailureSnapshot(db, jobRun.Id),
	})
}

func updateAffiliateJobRunLogCursor(db *gorm.DB, jobRunId int, stage string, logs []model.Log) error {
	if len(logs) == 0 {
		return nil
	}
	last := logs[len(logs)-1]
	return updateAffiliateJobRunCursor(db, jobRunId, stage, last.CreatedAt, last.Id)
}

func updateAffiliateJobRunIDCursor(db *gorm.DB, jobRunId int, stage string, lastID int) error {
	return updateAffiliateJobRunCursor(db, jobRunId, stage, 0, lastID)
}

func updateAffiliateJobRunSettlementProgress(db *gorm.DB, jobRunId int, settlements []model.AffiliateSettlement) error {
	if jobRunId <= 0 {
		return nil
	}
	return updateAffiliateJobRunProgress(db, jobRunId, affiliateJobRunStageSettlement, map[string]interface{}{
		"settlement_count": len(settlements),
		"result_snapshot":  affiliateJobRunSettlementProgressSnapshot(db, jobRunId, settlements),
	})
}

func updateAffiliateJobRunKPIProgress(db *gorm.DB, jobRunId int, kpiSnapshotCount int) error {
	if jobRunId <= 0 {
		return nil
	}
	return updateAffiliateJobRunProgress(db, jobRunId, affiliateJobRunStageKPI, map[string]interface{}{
		"kpi_snapshot_count": kpiSnapshotCount,
		"result_snapshot":    affiliateJobRunCountProgressSnapshot(db, jobRunId, "kpi_snapshot_count", kpiSnapshotCount),
	})
}

func updateAffiliateJobRunCommissionProgress(db *gorm.DB, jobRunId int, commissionEventCount int) error {
	if jobRunId <= 0 {
		return nil
	}
	return updateAffiliateJobRunProgress(db, jobRunId, affiliateJobRunStageCommission, map[string]interface{}{
		"commission_event_count": commissionEventCount,
		"result_snapshot":        affiliateJobRunCountProgressSnapshot(db, jobRunId, "commission_event_count", commissionEventCount),
	})
}

func updateAffiliateJobRunHeadFeeProgress(db *gorm.DB, jobRunId int, headFeeEventCount int) error {
	if jobRunId <= 0 {
		return nil
	}
	return updateAffiliateJobRunProgress(db, jobRunId, affiliateJobRunStageHeadFee, map[string]interface{}{
		"head_fee_event_count": headFeeEventCount,
		"result_snapshot":      affiliateJobRunCountProgressSnapshot(db, jobRunId, "head_fee_event_count", headFeeEventCount),
	})
}

func updateAffiliateJobRunCursor(db *gorm.DB, jobRunId int, stage string, lastCreatedAt int64, lastID int) error {
	if jobRunId <= 0 || lastID <= 0 {
		return nil
	}
	updates := map[string]interface{}{
		"last_cursor_id":  lastID,
		"result_snapshot": affiliateJobRunCursorSnapshot(db, jobRunId, stage, lastCreatedAt, lastID),
	}
	if lastCreatedAt > 0 {
		updates["last_cursor_created_at"] = lastCreatedAt
	}
	return updateAffiliateJobRunProgress(db, jobRunId, stage, updates)
}

func affiliateJobRunFailureSnapshot(db *gorm.DB, jobRunId int) string {
	snapshot := loadAffiliateJobRunResultSnapshot(db, jobRunId)
	snapshot["status"] = model.AffiliateJobRunStatusFailed
	return common.GetJsonString(snapshot)
}

func affiliateJobRunCursorSnapshot(db *gorm.DB, jobRunId int, stage string, lastCreatedAt int64, lastID int) string {
	snapshot := loadAffiliateJobRunResultSnapshot(db, jobRunId)
	for key, value := range affiliateJobRunCursorSnapshotFields(stage, lastCreatedAt, lastID) {
		snapshot[key] = value
	}
	return common.GetJsonString(snapshot)
}

func affiliateJobRunSettlementProgressSnapshot(db *gorm.DB, jobRunId int, settlements []model.AffiliateSettlement) string {
	snapshot := loadAffiliateJobRunResultSnapshot(db, jobRunId)
	snapshot["settlement_count"] = len(settlements)
	snapshot["settlement_ids"] = affiliateSettlementIds(settlements)
	return common.GetJsonString(snapshot)
}

func affiliateJobRunCountProgressSnapshot(db *gorm.DB, jobRunId int, countKey string, count int) string {
	snapshot := loadAffiliateJobRunResultSnapshot(db, jobRunId)
	snapshot[countKey] = count
	return common.GetJsonString(snapshot)
}

func loadAffiliateJobRunResultSnapshot(db *gorm.DB, jobRunId int) map[string]interface{} {
	snapshot := map[string]interface{}{}
	if db == nil || jobRunId <= 0 {
		return snapshot
	}
	var jobRun model.AffiliateJobRun
	if err := db.Select("result_snapshot").First(&jobRun, jobRunId).Error; err != nil {
		return snapshot
	}
	if strings.TrimSpace(jobRun.ResultSnapshot) == "" {
		return snapshot
	}
	if err := json.Unmarshal([]byte(jobRun.ResultSnapshot), &snapshot); err != nil {
		return map[string]interface{}{}
	}
	return snapshot
}

func affiliateJobRunCursorSnapshotFields(stage string, lastCreatedAt int64, lastID int) map[string]interface{} {
	fields := map[string]interface{}{}
	switch stage {
	case affiliateJobRunStageKPI:
		fields["kpi_log_id"] = lastID
		if lastCreatedAt > 0 {
			fields["kpi_log_created_at"] = lastCreatedAt
		}
	case affiliateJobRunStageCommission:
		fields["commission_log_id"] = lastID
		if lastCreatedAt > 0 {
			fields["commission_log_created_at"] = lastCreatedAt
		}
	case affiliateJobRunStageHeadFee:
		fields["head_fee_log_id"] = lastID
		if lastCreatedAt > 0 {
			fields["head_fee_log_created_at"] = lastCreatedAt
		}
	case affiliateJobRunStageSettlementCommissionEvents:
		fields["settlement_commission_event_id"] = lastID
	case affiliateJobRunStageSettlementHeadFeeEvents:
		fields["settlement_head_fee_event_id"] = lastID
	default:
		fields["last_cursor_id"] = lastID
		if lastCreatedAt > 0 {
			fields["last_cursor_created_at"] = lastCreatedAt
		}
	}
	return fields
}

func affiliateSettlementRunIdempotencyKey(input AffiliateSettlementRunInput) string {
	payload := affiliateSettlementRunIdempotencyPayload{
		JobType:         model.AffiliateJobRunTypeSettlementPipeline,
		RuleSetId:       input.RuleSetId,
		PeriodStart:     input.PeriodStart,
		PeriodEnd:       input.PeriodEnd,
		FreezeDays:      input.FreezeDays,
		DryRun:          input.DryRun,
		QuotaPerUnit:    input.QuotaPerUnit,
		USDExchangeRate: input.USDExchangeRate,
	}
	encoded, err := json.Marshal(payload)
	if err != nil {
		encoded = []byte(fmt.Sprintf("%+v", payload))
	}
	sum := sha256.Sum256(encoded)
	return model.AffiliateJobRunTypeSettlementPipeline + ":" + hex.EncodeToString(sum[:16])
}

func affiliateSettlementGenerateIdempotencyKey(input AffiliateSettlementBuildInput) string {
	payload := affiliateSettlementGenerateIdempotencyPayload{
		JobType:     model.AffiliateJobRunTypeSettlementGenerate,
		RuleSetId:   input.RuleSetId,
		PeriodStart: input.PeriodStart,
		PeriodEnd:   input.PeriodEnd,
		FreezeDays:  input.FreezeDays,
		AutoRun:     input.AutoRun,
	}
	encoded, err := json.Marshal(payload)
	if err != nil {
		encoded = []byte(fmt.Sprintf("%+v", payload))
	}
	sum := sha256.Sum256(encoded)
	return model.AffiliateJobRunTypeSettlementGenerate + ":" + hex.EncodeToString(sum[:16])
}

func affiliateSettlementRunInputSnapshot(input AffiliateSettlementRunInput) string {
	return common.GetJsonString(map[string]interface{}{
		"job_type":          model.AffiliateJobRunTypeSettlementPipeline,
		"rule_set_id":       input.RuleSetId,
		"period_start":      input.PeriodStart,
		"period_end":        input.PeriodEnd,
		"freeze_days":       input.FreezeDays,
		"dry_run":           input.DryRun,
		"quota_per_unit":    input.QuotaPerUnit,
		"usd_exchange_rate": input.USDExchangeRate,
		"actor_user_id":     input.ActorUserId,
		"has_reason":        strings.TrimSpace(input.Reason) != "",
	})
}

func affiliateSettlementGenerateInputSnapshot(input AffiliateSettlementBuildInput) string {
	return common.GetJsonString(map[string]interface{}{
		"job_type":      model.AffiliateJobRunTypeSettlementGenerate,
		"rule_set_id":   input.RuleSetId,
		"period_start":  input.PeriodStart,
		"period_end":    input.PeriodEnd,
		"freeze_days":   input.FreezeDays,
		"auto_run":      input.AutoRun,
		"actor_user_id": input.ActorUserId,
		"has_reason":    strings.TrimSpace(input.Reason) != "",
	})
}

func affiliateSettlementRunResultSnapshot(db *gorm.DB, jobRunId int, result AffiliateSettlementRunResult) string {
	return affiliateJobRunSuccessSnapshot(db, jobRunId, map[string]interface{}{
		"kpi_snapshot_count":     result.KPISnapshotCount,
		"commission_event_count": result.CommissionEventCount,
		"head_fee_event_count":   result.HeadFeeEventCount,
		"settlement_count":       result.SettlementCount,
		"settlement_ids":         affiliateSettlementIds(result.Settlements),
	})
}

func affiliateSettlementGenerateResultSnapshot(db *gorm.DB, jobRunId int, settlements []model.AffiliateSettlement) string {
	return affiliateJobRunSuccessSnapshot(db, jobRunId, map[string]interface{}{
		"settlement_count": len(settlements),
		"settlement_ids":   affiliateSettlementIds(settlements),
	})
}

func affiliateJobRunSuccessSnapshot(db *gorm.DB, jobRunId int, finalFields map[string]interface{}) string {
	snapshot := loadAffiliateJobRunResultSnapshot(db, jobRunId)
	delete(snapshot, "status")
	for key, value := range finalFields {
		snapshot[key] = value
	}
	return common.GetJsonString(snapshot)
}

func affiliateSettlementIds(settlements []model.AffiliateSettlement) []int {
	settlementIds := make([]int, 0, len(settlements))
	for _, settlement := range settlements {
		settlementIds = append(settlementIds, settlement.Id)
	}
	return settlementIds
}

func sanitizeAffiliateJobRunError(cause error) string {
	if cause == nil {
		return ""
	}
	message := strings.TrimSpace(cause.Error())
	message = common.MaskSensitiveInfo(message)
	message = affiliateJobRunSensitiveKVPattern.ReplaceAllString(message, "$1=[redacted]")
	message = affiliateJobRunSensitiveStructuredPattern.ReplaceAllString(message, "$1[redacted]$3")
	if len(message) > 1024 {
		return message[:1024]
	}
	return message
}
