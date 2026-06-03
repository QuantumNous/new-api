package service

import (
	"errors"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
)

type AffiliateSettlementRunInput struct {
	RuleSetId       int     `json:"rule_set_id"`
	PeriodStart     int64   `json:"period_start"`
	PeriodEnd       int64   `json:"period_end"`
	FreezeDays      int     `json:"freeze_days"`
	Now             int64   `json:"now"`
	QuotaPerUnit    float64 `json:"quota_per_unit"`
	USDExchangeRate float64 `json:"usd_exchange_rate"`
	ActorUserId     int     `json:"actor_user_id"`
	Reason          string  `json:"reason"`
}

type AffiliateSettlementRunResult struct {
	JobRunId             int                         `json:"job_run_id"`
	JobRunStatus         string                      `json:"job_run_status"`
	IdempotencyKey       string                      `json:"idempotency_key"`
	KPISnapshotCount     int                         `json:"kpi_snapshot_count"`
	CommissionEventCount int                         `json:"commission_event_count"`
	HeadFeeEventCount    int                         `json:"head_fee_event_count"`
	SettlementCount      int                         `json:"settlement_count"`
	Settlements          []model.AffiliateSettlement `json:"settlements"`
}

func RunAffiliateSettlementPipeline(db *gorm.DB, logDB *gorm.DB, input AffiliateSettlementRunInput) (AffiliateSettlementRunResult, error) {
	if db == nil {
		return AffiliateSettlementRunResult{}, errors.New("nil db")
	}
	if logDB == nil {
		return AffiliateSettlementRunResult{}, errors.New("nil log db")
	}
	if input.PeriodStart > 0 && input.PeriodEnd > 0 && input.PeriodEnd < input.PeriodStart {
		return AffiliateSettlementRunResult{}, errors.New("invalid settlement run period")
	}
	if input.Now == 0 {
		input.Now = common.GetTimestamp()
	}

	jobRun, err := createAffiliateSettlementPipelineJobRun(db, input)
	if err != nil {
		return AffiliateSettlementRunResult{}, err
	}
	failedResult := func(stage string, cause error) (AffiliateSettlementRunResult, error) {
		if updateErr := finishAffiliateJobRunFailure(db, jobRun, stage, cause, input.Now); updateErr != nil {
			return AffiliateSettlementRunResult{
				JobRunId:       jobRun.Id,
				JobRunStatus:   model.AffiliateJobRunStatusFailed,
				IdempotencyKey: jobRun.IdempotencyKey,
			}, errors.Join(cause, updateErr)
		}
		return AffiliateSettlementRunResult{
			JobRunId:       jobRun.Id,
			JobRunStatus:   model.AffiliateJobRunStatusFailed,
			IdempotencyKey: jobRun.IdempotencyKey,
		}, cause
	}

	if err := updateAffiliateJobRunProgress(db, jobRun.Id, affiliateJobRunStageKPI, nil); err != nil {
		return failedResult(affiliateJobRunStageKPI, err)
	}
	kpiSnapshots, err := BuildAffiliateKPISnapshots(db, logDB, AffiliateKPIBuildInput{
		RuleSetId:       input.RuleSetId,
		PeriodStart:     input.PeriodStart,
		PeriodEnd:       input.PeriodEnd,
		QuotaPerUnit:    input.QuotaPerUnit,
		USDExchangeRate: input.USDExchangeRate,
		JobRunId:        jobRun.Id,
	})
	if err != nil {
		return failedResult(affiliateJobRunStageKPI, err)
	}

	if err := updateAffiliateJobRunProgress(db, jobRun.Id, affiliateJobRunStageCommission, map[string]interface{}{
		"kpi_snapshot_count": len(kpiSnapshots),
	}); err != nil {
		return failedResult(affiliateJobRunStageCommission, err)
	}
	commissionEvents, err := BuildAffiliatePendingCommissionEvents(db, logDB, AffiliateCommissionBuildInput{
		RuleSetId:       input.RuleSetId,
		PeriodStart:     input.PeriodStart,
		PeriodEnd:       input.PeriodEnd,
		QuotaPerUnit:    input.QuotaPerUnit,
		USDExchangeRate: input.USDExchangeRate,
		JobRunId:        jobRun.Id,
	})
	if err != nil {
		return failedResult(affiliateJobRunStageCommission, err)
	}

	if err := updateAffiliateJobRunProgress(db, jobRun.Id, affiliateJobRunStageHeadFee, map[string]interface{}{
		"kpi_snapshot_count":     len(kpiSnapshots),
		"commission_event_count": len(commissionEvents),
	}); err != nil {
		return failedResult(affiliateJobRunStageHeadFee, err)
	}
	headFeeEvents, err := BuildAffiliatePendingHeadFeeEvents(db, logDB, AffiliateHeadFeeBuildInput{
		RuleSetId:       input.RuleSetId,
		PeriodStart:     input.PeriodStart,
		PeriodEnd:       input.PeriodEnd,
		Now:             input.Now,
		QuotaPerUnit:    input.QuotaPerUnit,
		USDExchangeRate: input.USDExchangeRate,
		JobRunId:        jobRun.Id,
	})
	if err != nil {
		return failedResult(affiliateJobRunStageHeadFee, err)
	}

	if err := updateAffiliateJobRunProgress(db, jobRun.Id, affiliateJobRunStageSettlement, map[string]interface{}{
		"kpi_snapshot_count":     len(kpiSnapshots),
		"commission_event_count": len(commissionEvents),
		"head_fee_event_count":   len(headFeeEvents),
	}); err != nil {
		return failedResult(affiliateJobRunStageSettlement, err)
	}
	settlements, err := GenerateAffiliateSettlements(db, AffiliateSettlementBuildInput{
		RuleSetId:   input.RuleSetId,
		PeriodStart: input.PeriodStart,
		PeriodEnd:   input.PeriodEnd,
		FreezeDays:  input.FreezeDays,
		ActorUserId: input.ActorUserId,
		Reason:      input.Reason,
		GeneratedAt: input.Now,
		JobRunId:    jobRun.Id,
	})
	if err != nil {
		return failedResult(affiliateJobRunStageSettlement, err)
	}

	result := AffiliateSettlementRunResult{
		JobRunId:             jobRun.Id,
		JobRunStatus:         model.AffiliateJobRunStatusSucceeded,
		IdempotencyKey:       jobRun.IdempotencyKey,
		KPISnapshotCount:     len(kpiSnapshots),
		CommissionEventCount: len(commissionEvents),
		HeadFeeEventCount:    len(headFeeEvents),
		SettlementCount:      len(settlements),
		Settlements:          settlements,
	}
	if err := finishAffiliateJobRunSuccess(db, jobRun, result, input.Now); err != nil {
		return result, err
	}
	return result, nil
}
