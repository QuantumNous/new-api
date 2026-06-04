package service

import (
	"errors"
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
)

type AffiliateSettlementRunInput struct {
	RuleSetId       int     `json:"rule_set_id"`
	PeriodStart     int64   `json:"period_start"`
	PeriodEnd       int64   `json:"period_end"`
	FreezeDays      int     `json:"freeze_days"`
	DryRun          bool    `json:"dry_run"`
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
	DryRun               bool                        `json:"dry_run"`
	KPISnapshotCount     int                         `json:"kpi_snapshot_count"`
	CommissionEventCount int                         `json:"commission_event_count"`
	HeadFeeEventCount    int                         `json:"head_fee_event_count"`
	SettlementCount      int                         `json:"settlement_count"`
	Settlements          []model.AffiliateSettlement `json:"settlements"`
}

var errAffiliateSettlementDryRunRollback = errors.New("affiliate settlement dry-run rollback")

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
	if input.DryRun {
		return runAffiliateSettlementPipelineDryRun(db, logDB, input)
	}
	return runAffiliateSettlementPipeline(db, logDB, input)
}

func runAffiliateSettlementPipelineDryRun(db *gorm.DB, logDB *gorm.DB, input AffiliateSettlementRunInput) (AffiliateSettlementRunResult, error) {
	var result AffiliateSettlementRunResult
	err := db.Transaction(func(tx *gorm.DB) error {
		dryRunResult, err := runAffiliateSettlementPipeline(tx, logDB, input)
		if err != nil {
			return err
		}
		result = dryRunResult
		return errAffiliateSettlementDryRunRollback
	})
	if err != nil && !errors.Is(err, errAffiliateSettlementDryRunRollback) {
		return AffiliateSettlementRunResult{}, err
	}
	result.JobRunId = 0
	result.JobRunStatus = "dry_run"
	result.DryRun = true
	return result, nil
}

func runAffiliateSettlementPipeline(db *gorm.DB, logDB *gorm.DB, input AffiliateSettlementRunInput) (AffiliateSettlementRunResult, error) {
	jobRun, err := createAffiliateSettlementPipelineJobRun(db, input)
	if err != nil {
		return AffiliateSettlementRunResult{}, err
	}
	resumeStage := affiliateSettlementRunStageRank(jobRun.CurrentStage)
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

	kpiSnapshotCount := jobRun.KPISnapshotCount
	resumeStage, err = validateAffiliateSettlementPipelineResumeStage(db, jobRun, input, resumeStage)
	if err != nil {
		return failedResult(jobRun.CurrentStage, err)
	}
	if resumeStage <= affiliateSettlementRunStageRank(affiliateJobRunStageKPI) {
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
		kpiSnapshotCount = len(kpiSnapshots)
	}

	commissionEventCount := jobRun.CommissionEventCount
	if resumeStage <= affiliateSettlementRunStageRank(affiliateJobRunStageCommission) {
		if err := updateAffiliateJobRunProgress(db, jobRun.Id, affiliateJobRunStageCommission, map[string]interface{}{
			"kpi_snapshot_count": kpiSnapshotCount,
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
		commissionEventCount = len(commissionEvents)
	}

	headFeeEventCount := jobRun.HeadFeeEventCount
	if resumeStage <= affiliateSettlementRunStageRank(affiliateJobRunStageHeadFee) {
		if err := updateAffiliateJobRunProgress(db, jobRun.Id, affiliateJobRunStageHeadFee, map[string]interface{}{
			"kpi_snapshot_count":     kpiSnapshotCount,
			"commission_event_count": commissionEventCount,
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
		headFeeEventCount = len(headFeeEvents)
	}

	if err := updateAffiliateJobRunProgress(db, jobRun.Id, affiliateJobRunStageSettlement, map[string]interface{}{
		"kpi_snapshot_count":     kpiSnapshotCount,
		"commission_event_count": commissionEventCount,
		"head_fee_event_count":   headFeeEventCount,
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
		DryRun:               input.DryRun,
		KPISnapshotCount:     kpiSnapshotCount,
		CommissionEventCount: commissionEventCount,
		HeadFeeEventCount:    headFeeEventCount,
		SettlementCount:      len(settlements),
		Settlements:          settlements,
	}
	if err := finishAffiliateJobRunSuccess(db, jobRun, result, input.Now); err != nil {
		return result, err
	}
	return result, nil
}

func affiliateSettlementRunStageRank(stage string) int {
	switch stage {
	case affiliateJobRunStageKPI:
		return 1
	case affiliateJobRunStageCommission:
		return 2
	case affiliateJobRunStageHeadFee:
		return 3
	case affiliateJobRunStageSettlement, affiliateJobRunStageSettlementCommissionEvents, affiliateJobRunStageSettlementHeadFeeEvents:
		return 4
	case affiliateJobRunStageComplete:
		return 5
	default:
		return 0
	}
}

func validateAffiliateSettlementPipelineResumeStage(db *gorm.DB, jobRun model.AffiliateJobRun, input AffiliateSettlementRunInput, resumeStage int) (int, error) {
	if resumeStage <= affiliateSettlementRunStageRank(affiliateJobRunStageKPI) {
		return resumeStage, nil
	}
	ruleSetId := input.RuleSetId
	if ruleSetId <= 0 {
		ruleSetId = jobRun.RuleSetId
	}
	if ruleSetId <= 0 {
		return 0, nil
	}

	kpiRank := affiliateSettlementRunStageRank(affiliateJobRunStageKPI)
	if resumeStage > kpiRank {
		if jobRun.KPISnapshotCount <= 0 {
			return kpiRank, nil
		}
		count, err := countAffiliatePipelineKPISnapshots(db, ruleSetId, input)
		if err != nil {
			return 0, err
		}
		if count < int64(jobRun.KPISnapshotCount) {
			return kpiRank, nil
		}
	}

	commissionRank := affiliateSettlementRunStageRank(affiliateJobRunStageCommission)
	if resumeStage > commissionRank {
		if jobRun.CommissionEventCount <= 0 {
			return commissionRank, nil
		}
		count, err := countAffiliatePipelineCommissionEvents(db, ruleSetId, input)
		if err != nil {
			return 0, err
		}
		if count < int64(jobRun.CommissionEventCount) {
			return commissionRank, nil
		}
	}

	headFeeRank := affiliateSettlementRunStageRank(affiliateJobRunStageHeadFee)
	if resumeStage > headFeeRank {
		if jobRun.HeadFeeEventCount <= 0 {
			return headFeeRank, nil
		}
		count, err := countAffiliatePipelineHeadFeeEvents(db, ruleSetId, input)
		if err != nil {
			return 0, err
		}
		if count < int64(jobRun.HeadFeeEventCount) {
			return headFeeRank, nil
		}
	}
	return resumeStage, nil
}

func countAffiliatePipelineKPISnapshots(db *gorm.DB, ruleSetId int, input AffiliateSettlementRunInput) (int64, error) {
	var count int64
	err := db.Model(&model.AffiliateKPISnapshot{}).
		Where("rule_set_id = ? AND period_start = ? AND period_end = ?", ruleSetId, input.PeriodStart, input.PeriodEnd).
		Count(&count).Error
	return count, err
}

func countAffiliatePipelineCommissionEvents(db *gorm.DB, ruleSetId int, input AffiliateSettlementRunInput) (int64, error) {
	var count int64
	err := db.Model(&model.AffiliateCommissionEvent{}).
		Where("rule_set_id = ? AND period_start = ? AND period_end = ?", ruleSetId, input.PeriodStart, input.PeriodEnd).
		Count(&count).Error
	return count, err
}

func countAffiliatePipelineHeadFeeEvents(db *gorm.DB, ruleSetId int, input AffiliateSettlementRunInput) (int64, error) {
	var count int64
	periodMarker := fmt.Sprintf("%%:period:%d-%d", input.PeriodStart, input.PeriodEnd)
	err := db.Model(&model.AffiliateHeadFeeEvent{}).
		Where("rule_set_id = ? AND synthetic_marker LIKE ?", ruleSetId, periodMarker).
		Count(&count).Error
	return count, err
}
