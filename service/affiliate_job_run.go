package service

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
)

const (
	affiliateJobRunStageStarting   = "starting"
	affiliateJobRunStageKPI        = "kpi"
	affiliateJobRunStageCommission = "commission"
	affiliateJobRunStageHeadFee    = "head_fee"
	affiliateJobRunStageSettlement = "settlement"
	affiliateJobRunStageComplete   = "complete"
)

var affiliateJobRunSensitiveKVPattern = regexp.MustCompile(`(?i)\b(password|passwd|token|api[_-]?key|secret)=([^\s,;]+)`)

type affiliateSettlementRunIdempotencyPayload struct {
	JobType         string  `json:"job_type"`
	RuleSetId       int     `json:"rule_set_id"`
	PeriodStart     int64   `json:"period_start"`
	PeriodEnd       int64   `json:"period_end"`
	FreezeDays      int     `json:"freeze_days"`
	QuotaPerUnit    float64 `json:"quota_per_unit"`
	USDExchangeRate float64 `json:"usd_exchange_rate"`
}

func createAffiliateSettlementPipelineJobRun(db *gorm.DB, input AffiliateSettlementRunInput) (model.AffiliateJobRun, error) {
	jobRun := model.AffiliateJobRun{
		JobType:        model.AffiliateJobRunTypeSettlementPipeline,
		Status:         model.AffiliateJobRunStatusRunning,
		IdempotencyKey: affiliateSettlementRunIdempotencyKey(input),
		RuleSetId:      input.RuleSetId,
		PeriodStart:    input.PeriodStart,
		PeriodEnd:      input.PeriodEnd,
		ActorUserId:    input.ActorUserId,
		CurrentStage:   affiliateJobRunStageStarting,
		InputSnapshot:  affiliateSettlementRunInputSnapshot(input),
		StartedAt:      input.Now,
	}
	if err := db.Create(&jobRun).Error; err != nil {
		return model.AffiliateJobRun{}, err
	}
	return jobRun, nil
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
		"result_snapshot":        affiliateSettlementRunResultSnapshot(result),
		"error_message":          "",
		"last_cursor_created_at": 0,
		"last_cursor_id":         0,
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
		"result_snapshot": common.GetJsonString(map[string]interface{}{"status": model.AffiliateJobRunStatusFailed}),
	})
}

func affiliateSettlementRunIdempotencyKey(input AffiliateSettlementRunInput) string {
	payload := affiliateSettlementRunIdempotencyPayload{
		JobType:         model.AffiliateJobRunTypeSettlementPipeline,
		RuleSetId:       input.RuleSetId,
		PeriodStart:     input.PeriodStart,
		PeriodEnd:       input.PeriodEnd,
		FreezeDays:      input.FreezeDays,
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

func affiliateSettlementRunInputSnapshot(input AffiliateSettlementRunInput) string {
	return common.GetJsonString(map[string]interface{}{
		"job_type":          model.AffiliateJobRunTypeSettlementPipeline,
		"rule_set_id":       input.RuleSetId,
		"period_start":      input.PeriodStart,
		"period_end":        input.PeriodEnd,
		"freeze_days":       input.FreezeDays,
		"quota_per_unit":    input.QuotaPerUnit,
		"usd_exchange_rate": input.USDExchangeRate,
		"actor_user_id":     input.ActorUserId,
		"has_reason":        strings.TrimSpace(input.Reason) != "",
	})
}

func affiliateSettlementRunResultSnapshot(result AffiliateSettlementRunResult) string {
	settlementIds := make([]int, 0, len(result.Settlements))
	for _, settlement := range result.Settlements {
		settlementIds = append(settlementIds, settlement.Id)
	}
	return common.GetJsonString(map[string]interface{}{
		"kpi_snapshot_count":     result.KPISnapshotCount,
		"commission_event_count": result.CommissionEventCount,
		"head_fee_event_count":   result.HeadFeeEventCount,
		"settlement_count":       result.SettlementCount,
		"settlement_ids":         settlementIds,
	})
}

func sanitizeAffiliateJobRunError(cause error) string {
	if cause == nil {
		return ""
	}
	message := strings.TrimSpace(cause.Error())
	message = affiliateJobRunSensitiveKVPattern.ReplaceAllString(message, "$1=[redacted]")
	if len(message) > 1024 {
		return message[:1024]
	}
	return message
}
