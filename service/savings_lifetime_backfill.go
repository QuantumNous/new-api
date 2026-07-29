package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"math"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/savings_setting"

	"github.com/shopspring/decimal"
)

type SavingsLifetimeBackfillPayload struct {
	Target              model.SavingsLifetimeLogCursor `json:"target"`
	TargetCount         int64                          `json:"target_count"`
	BatchSize           int                            `json:"batch_size"`
	PriceSnapshotAt     int64                          `json:"price_snapshot_at"`
	PricingSnapshotHash string                         `json:"pricing_snapshot_hash"`
	Setting             savings_setting.Setting        `json:"setting"`
	QuotaPerUnit        int64                          `json:"quota_per_unit_snapshot"`
	USDCNYRateMicros    int64                          `json:"usd_cny_rate_micros"`
}

type SavingsLifetimeBackfillState struct {
	Cursor               model.SavingsLifetimeLogCursor `json:"cursor"`
	ProcessedCount       int64                          `json:"processed_count"`
	EstimatedCount       int64                          `json:"estimated_count"`
	SkippedCount         int64                          `json:"skipped_count"`
	AmbiguousCursorCount int64                          `json:"ambiguous_cursor_count"`
	Progress             float64                        `json:"progress"`
}

type SavingsLifetimeBackfillResult struct {
	ProcessedCount       int64 `json:"processed_count"`
	EstimatedCount       int64 `json:"estimated_count"`
	SkippedCount         int64 `json:"skipped_count"`
	AmbiguousCursorCount int64 `json:"ambiguous_cursor_count"`
}

type SavingsLifetimeSummary struct {
	Enabled                   bool    `json:"enabled"`
	ShowOnDashboard           bool    `json:"show_on_dashboard"`
	ShowOnWallet              bool    `json:"show_on_wallet"`
	Currency                  string  `json:"currency"`
	SavingsCNYMicros          string  `json:"savings_cny_micros"`
	SavingsQuota              string  `json:"savings_quota"`
	OfficialQuota             string  `json:"official_quota"`
	ActualQuota               string  `json:"actual_quota"`
	RequestCount              int64   `json:"request_count"`
	EstimatedRequestCount     int64   `json:"estimated_request_count"`
	SnapshotRequestCount      int64   `json:"snapshot_request_count"`
	ReconstructedRequestCount int64   `json:"reconstructed_request_count"`
	CoverageRatio             float64 `json:"coverage_ratio"`
	StatisticsStartedAt       int64   `json:"statistics_started_at"`
	LastAggregatedAt          int64   `json:"last_aggregated_at"`
	BackfillStatus            string  `json:"backfill_status"`
	BackfillProgress          float64 `json:"backfill_progress"`
	IsComplete                bool    `json:"is_complete"`
}

type savingsLifetimeBackfillHandler struct{}

func (savingsLifetimeBackfillHandler) Type() string {
	return model.SystemTaskTypeSavingsBackfill
}

func init() {
	RegisterSystemTaskHandler(savingsLifetimeBackfillHandler{})
}

func StartSavingsLifetimeBackfill() (*model.SystemTask, bool, error) {
	if !savings_setting.LifetimeEnabled() {
		return nil, false, errors.New("savings lifetime estimate is not enabled")
	}
	if err := model.CheckSavingsLifetimeSQLiteIntegrity(); err != nil {
		return nil, false, err
	}
	target, total, err := model.GetSavingsLifetimeLogBoundary()
	if err != nil {
		return nil, false, err
	}
	setting := savings_setting.GetSetting()
	priceSnapshotAt := common.GetTimestamp()
	prices := buildLocalSavingsPriceMap(setting, priceSnapshotAt)
	for modelName, price := range setting.OfficialPrices {
		prices[modelName] = price
	}
	setting.OfficialPrices = prices
	setting.LocalPricingOfficialConfirmed = false
	pricingJSON, err := common.Marshal(prices)
	if err != nil {
		return nil, false, err
	}
	pricingHash := sha256.Sum256(pricingJSON)
	quotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit).Round(0)
	rateMicros := decimal.NewFromFloat(operation_setting.USDExchangeRate).
		Mul(decimal.NewFromInt(1_000_000)).
		Round(0)
	maxInt64 := decimal.NewFromInt(math.MaxInt64)
	if quotaPerUnit.LessThanOrEqual(decimal.Zero) || rateMicros.LessThanOrEqual(decimal.Zero) ||
		quotaPerUnit.GreaterThan(maxInt64) || rateMicros.GreaterThan(maxInt64) {
		return nil, false, errors.New("invalid savings lifetime currency snapshot")
	}
	payload := SavingsLifetimeBackfillPayload{
		Target:              target,
		TargetCount:         total,
		BatchSize:           savings_setting.LifetimeBackfillBatchSize(),
		PriceSnapshotAt:     priceSnapshotAt,
		PricingSnapshotHash: hex.EncodeToString(pricingHash[:]),
		Setting:             setting,
		QuotaPerUnit:        quotaPerUnit.IntPart(),
		USDCNYRateMicros:    rateMicros.IntPart(),
	}
	return EnqueueSystemTask(model.SystemTaskTypeSavingsBackfill, payload)
}

func PauseSavingsLifetimeBackfill(taskID string) (*model.SystemTask, error) {
	task, err := savingsLifetimeBackfillTask(taskID)
	if err != nil {
		return nil, err
	}
	return model.RequestSystemTaskPause(task.TaskID, model.SystemTaskTypeSavingsBackfill)
}

func ResumeSavingsLifetimeBackfill(taskID string) (*model.SystemTask, error) {
	task, err := savingsLifetimeBackfillTask(taskID)
	if err != nil {
		return nil, err
	}
	resumed, err := model.ResumeSystemTask(task.TaskID, model.SystemTaskTypeSavingsBackfill)
	if err != nil {
		return nil, err
	}
	notifySystemTaskRunner()
	return resumed, nil
}

func RetrySavingsLifetimeBackfill(taskID string) (*model.SystemTask, error) {
	task, err := savingsLifetimeBackfillTask(taskID)
	if err != nil {
		return nil, err
	}
	if err := model.CheckSavingsLifetimeSQLiteIntegrity(); err != nil {
		return nil, err
	}
	retried, err := model.RetryFailedSystemTask(task.TaskID, model.SystemTaskTypeSavingsBackfill)
	if err != nil {
		return nil, err
	}
	notifySystemTaskRunner()
	return retried, nil
}

func savingsLifetimeBackfillTask(taskID string) (*model.SystemTask, error) {
	var task *model.SystemTask
	var err error
	if strings.TrimSpace(taskID) == "" {
		task, err = model.GetLatestSystemTask(model.SystemTaskTypeSavingsBackfill)
	} else {
		task, err = model.GetSystemTaskByTaskID(taskID)
	}
	if err != nil {
		return nil, err
	}
	if task == nil || task.Type != model.SystemTaskTypeSavingsBackfill {
		return nil, errors.New("savings lifetime backfill task not found")
	}
	return task, nil
}

func GetUserSavingsLifetimeSummary(userID int) (*SavingsLifetimeSummary, error) {
	setting := savings_setting.GetSetting()
	summary := &SavingsLifetimeSummary{
		Enabled:         setting.Enabled && setting.LifetimeEnabled,
		ShowOnDashboard: setting.Enabled && setting.LifetimeEnabled && setting.LifetimeShowOnDashboard,
		ShowOnWallet:    setting.Enabled && setting.LifetimeEnabled && setting.LifetimeShowOnWallet,
		Currency:        "CNY",
	}
	if !summary.Enabled {
		return summary, nil
	}
	total, err := model.GetSavingsLifetimeTotal(userID)
	if err != nil {
		return nil, err
	}
	summary.SavingsCNYMicros = strconv.FormatInt(total.SavingsCNYMicros, 10)
	summary.SavingsQuota = strconv.FormatInt(total.SavingsQuota, 10)
	summary.OfficialQuota = strconv.FormatInt(total.OfficialQuota, 10)
	summary.ActualQuota = strconv.FormatInt(total.ActualQuota, 10)
	summary.RequestCount = total.RequestCount
	summary.EstimatedRequestCount = total.EstimatedRequestCount
	summary.SnapshotRequestCount = total.SnapshotRequestCount
	summary.ReconstructedRequestCount = total.ReconstructedRequestCount
	summary.StatisticsStartedAt = total.StatisticsStartedAt
	summary.LastAggregatedAt = total.LastAggregatedAt
	if total.RequestCount > 0 {
		summary.CoverageRatio = float64(total.EstimatedRequestCount) / float64(total.RequestCount)
	}

	task, err := model.GetLatestSystemTask(model.SystemTaskTypeSavingsBackfill)
	if err != nil {
		return nil, err
	}
	summary.BackfillStatus = "not_started"
	if task != nil {
		summary.BackfillStatus = string(task.Status)
		state := SavingsLifetimeBackfillState{}
		if task.DecodeState(&state) == nil {
			summary.BackfillProgress = state.Progress
		}
		if task.Status == model.SystemTaskStatusSucceeded {
			summary.BackfillStatus = "completed"
			summary.BackfillProgress = 1
		}
	}
	pending, err := model.CountPendingSavingsLifetimeEvents()
	if err != nil {
		return nil, err
	}
	summary.IsComplete = summary.BackfillStatus == "completed" && pending == 0
	return summary, nil
}

func (savingsLifetimeBackfillHandler) Run(ctx context.Context, task *model.SystemTask, runnerID string) {
	payload := SavingsLifetimeBackfillPayload{}
	if err := task.DecodePayload(&payload); err != nil {
		finishSavingsLifetimeBackfill(task, runnerID, model.SystemTaskStatusFailed, nil, err)
		return
	}
	if err := validateSavingsLifetimeBackfillPayload(payload); err != nil {
		finishSavingsLifetimeBackfill(task, runnerID, model.SystemTaskStatusFailed, nil, err)
		return
	}
	state := SavingsLifetimeBackfillState{}
	if strings.TrimSpace(task.State) != "" {
		if err := task.DecodeState(&state); err != nil {
			finishSavingsLifetimeBackfill(task, runnerID, model.SystemTaskStatusFailed, nil, err)
			return
		}
	}
	if payload.BatchSize <= 0 {
		payload.BatchSize = 1000
	}
	estimator := savingsLogEstimator{setting: payload.Setting, priceSnapshotAt: payload.PriceSnapshotAt}
	for {
		paused, err := pauseSavingsLifetimeBackfillIfRequested(task, runnerID)
		if err != nil {
			common.SysError(fmt.Sprintf("failed to pause savings lifetime backfill task %s: %v", task.TaskID, err))
			return
		}
		if paused {
			return
		}
		if err := ctx.Err(); err != nil {
			finishSavingsLifetimeBackfill(task, runnerID, model.SystemTaskStatusFailed, nil, err)
			return
		}
		rows, err := model.GetSavingsLifetimeLogBatch(state.Cursor, payload.Target, payload.BatchSize)
		if err != nil {
			finishSavingsLifetimeBackfill(task, runnerID, model.SystemTaskStatusFailed, nil, fmt.Errorf("read savings lifetime log batch: %w", err))
			return
		}
		if len(rows) == 0 {
			break
		}
		ambiguousCount, err := model.CountSavingsLifetimeClickHouseCursorAmbiguity(rows)
		if err != nil {
			finishSavingsLifetimeBackfill(task, runnerID, model.SystemTaskStatusFailed, nil, fmt.Errorf("count ClickHouse cursor ambiguity: %w", err))
			return
		}
		events := make([]model.SavingsLifetimeEvent, 0, len(rows))
		for i := range rows {
			event, estimated, err := buildSavingsLifetimeBackfillEvent(&rows[i], estimator, payload)
			if err != nil {
				finishSavingsLifetimeBackfill(task, runnerID, model.SystemTaskStatusFailed, nil, err)
				return
			}
			events = append(events, event)
			state.ProcessedCount++
			if estimated {
				state.EstimatedCount++
			} else {
				state.SkippedCount++
			}
		}
		state.ProcessedCount += ambiguousCount
		state.SkippedCount += ambiguousCount
		state.AmbiguousCursorCount += ambiguousCount
		if err := model.CreateSavingsLifetimeEvents(events); err != nil {
			finishSavingsLifetimeBackfill(task, runnerID, model.SystemTaskStatusFailed, nil, fmt.Errorf("write savings lifetime events: %w", err))
			return
		}
		for {
			processed, err := aggregateSavingsLifetimePending(payload.BatchSize)
			if err != nil {
				finishSavingsLifetimeBackfill(task, runnerID, model.SystemTaskStatusFailed, nil, fmt.Errorf("aggregate savings lifetime events: %w", err))
				return
			}
			if processed == 0 {
				break
			}
		}
		last := rows[len(rows)-1]
		state.Cursor = model.SavingsLifetimeLogCursor{ID: last.Id, CreatedAt: last.CreatedAt, RequestID: last.RequestId}
		if payload.TargetCount > 0 {
			state.Progress = math.Min(float64(state.ProcessedCount)/float64(payload.TargetCount), 1)
		}
		if err := model.UpdateSystemTaskState(task.TaskID, runnerID, state); err != nil {
			finishSavingsLifetimeBackfill(task, runnerID, model.SystemTaskStatusFailed, nil, fmt.Errorf("save savings lifetime backfill cursor: %w", err))
			return
		}
		paused, err = pauseSavingsLifetimeBackfillIfRequested(task, runnerID)
		if err != nil {
			common.SysError(fmt.Sprintf("failed to pause savings lifetime backfill task %s: %v", task.TaskID, err))
			return
		}
		if paused {
			return
		}
	}
	result := SavingsLifetimeBackfillResult{
		ProcessedCount:       state.ProcessedCount,
		EstimatedCount:       state.EstimatedCount,
		SkippedCount:         state.SkippedCount,
		AmbiguousCursorCount: state.AmbiguousCursorCount,
	}
	finishSavingsLifetimeBackfill(task, runnerID, model.SystemTaskStatusSucceeded, result, nil)
}

func pauseSavingsLifetimeBackfillIfRequested(task *model.SystemTask, runnerID string) (bool, error) {
	current, err := model.GetSystemTaskByTaskID(task.TaskID)
	if err != nil {
		return false, err
	}
	if current == nil || current.Status != model.SystemTaskStatusPauseRequested {
		return false, nil
	}
	if err := model.CompleteSystemTaskPause(task.TaskID, runnerID); err != nil {
		return false, err
	}
	return true, nil
}

func validateSavingsLifetimeBackfillPayload(payload SavingsLifetimeBackfillPayload) error {
	if payload.QuotaPerUnit <= 0 || payload.USDCNYRateMicros <= 0 {
		return errors.New("invalid savings lifetime currency snapshot")
	}
	pricingJSON, err := common.Marshal(payload.Setting.OfficialPrices)
	if err != nil {
		return err
	}
	pricingHash := sha256.Sum256(pricingJSON)
	if hex.EncodeToString(pricingHash[:]) != payload.PricingSnapshotHash {
		return errors.New("savings lifetime pricing snapshot hash mismatch")
	}
	return nil
}

func buildSavingsLifetimeBackfillEvent(row *model.SavingsLifetimeLogRow, estimator savingsLogEstimator, payload SavingsLifetimeBackfillPayload) (model.SavingsLifetimeEvent, bool, error) {
	sourceKey, err := savingsLifetimeSourceKey(row)
	if err != nil {
		return model.SavingsLifetimeEvent{}, false, err
	}
	result := estimator.estimate(model.SavingsLogRow{
		Id:               row.Id,
		CreatedAt:        row.CreatedAt,
		ModelName:        row.ModelName,
		PromptTokens:     row.PromptTokens,
		CompletionTokens: row.CompletionTokens,
		Quota:            row.Quota,
		Other:            row.Other,
	})
	event := model.SavingsLifetimeEvent{
		EventKey:         "log:" + sourceKey + ":base",
		SourceKey:        sourceKey,
		LogID:            int64(row.Id),
		UserID:           row.UserId,
		OccurredAt:       row.CreatedAt,
		DayStartUTC:      row.CreatedAt / (24 * 60 * 60) * (24 * 60 * 60),
		EventType:        model.SavingsLifetimeEventTypeBase,
		CoverageState:    model.SavingsLifetimeCoverageSkipped,
		SkipReason:       result.SkipReason,
		AggregateVersion: 1,
	}
	if result.Estimate == nil {
		if event.SkipReason == "" {
			event.SkipReason = SavingsSkipInvalidSnapshot
		}
		return event, false, nil
	}
	estimate := result.Estimate
	amountMicros, err := savingsLifetimeAmountMicros(int64(estimate.SavingsQuota), payload.QuotaPerUnit, payload.USDCNYRateMicros)
	if err != nil {
		return model.SavingsLifetimeEvent{}, false, err
	}
	if estimate.SavingsCNYMicros != "" && estimate.QuotaPerUnit > 0 && estimate.USDCNYRateMicros > 0 {
		if frozen, parseErr := strconv.ParseInt(estimate.SavingsCNYMicros, 10, 64); parseErr == nil {
			amountMicros = frozen
			event.QuotaPerUnitSnapshot = estimate.QuotaPerUnit
			event.USDCNYRateMicros = estimate.USDCNYRateMicros
		}
	}
	if event.QuotaPerUnitSnapshot == 0 {
		event.QuotaPerUnitSnapshot = payload.QuotaPerUnit
		event.USDCNYRateMicros = payload.USDCNYRateMicros
	}
	event.CoverageState = model.SavingsLifetimeCoverageEstimated
	event.SkipReason = ""
	if result.CalculationMode == savingsCalculationHistorical {
		event.CalculationMode = model.SavingsLifetimeCalculationRebuild
	} else {
		event.CalculationMode = model.SavingsLifetimeCalculationSnapshot
	}
	event.OfficialQuota = int64(estimate.OfficialQuota)
	event.ActualQuota = int64(estimate.ActualQuota)
	event.SavingsQuota = int64(estimate.SavingsQuota)
	event.SavingsCNYMicros = amountMicros
	event.PriceSnapshotAt = estimate.PriceSnapshotAt
	event.PriceFingerprint = estimate.PriceFingerprint
	return event, true, nil
}

func savingsLifetimeSourceKey(row *model.SavingsLifetimeLogRow) (string, error) {
	var other savingsLogOther
	if common.UnmarshalJsonStr(row.Other, &other) == nil && strings.TrimSpace(other.AggregationKey) != "" {
		return other.AggregationKey, nil
	}
	if row.Id > 0 {
		return fmt.Sprintf("db:%d", row.Id), nil
	}
	data, err := common.Marshal(struct {
		RequestID        string `json:"request_id"`
		UserID           int    `json:"user_id"`
		CreatedAt        int64  `json:"created_at"`
		ModelName        string `json:"model_name"`
		PromptTokens     int    `json:"prompt_tokens"`
		CompletionTokens int    `json:"completion_tokens"`
		Quota            int    `json:"quota"`
		Other            string `json:"other"`
	}{
		RequestID:        row.RequestId,
		UserID:           row.UserId,
		CreatedAt:        row.CreatedAt,
		ModelName:        row.ModelName,
		PromptTokens:     row.PromptTokens,
		CompletionTokens: row.CompletionTokens,
		Quota:            row.Quota,
		Other:            row.Other,
	})
	if err != nil {
		return "", err
	}
	hash := sha256.Sum256(data)
	return "legacy-ch:" + hex.EncodeToString(hash[:]), nil
}

func savingsLifetimeAmountMicros(savingsQuota int64, quotaPerUnit int64, rateMicros int64) (int64, error) {
	if savingsQuota < 0 || quotaPerUnit <= 0 || rateMicros <= 0 {
		return 0, errors.New("invalid savings lifetime currency input")
	}
	amount := decimal.NewFromInt(savingsQuota).
		Mul(decimal.NewFromInt(rateMicros)).
		Div(decimal.NewFromInt(quotaPerUnit)).
		Round(0)
	if amount.GreaterThan(decimal.NewFromInt(math.MaxInt64)) {
		return 0, errors.New("savings lifetime currency amount overflow")
	}
	return amount.IntPart(), nil
}

func finishSavingsLifetimeBackfill(task *model.SystemTask, runnerID string, status model.SystemTaskStatus, result any, runErr error) {
	errorMessage := ""
	if runErr != nil {
		errorMessage = runErr.Error()
	}
	if err := model.FinishSystemTask(task.TaskID, runnerID, status, result, errorMessage); err != nil {
		common.SysError(fmt.Sprintf("failed to finish savings lifetime backfill task %s: %v", task.TaskID, err))
	}
}
