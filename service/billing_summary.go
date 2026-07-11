package service

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/bytedance/gopkg/util/gopool"
)

const (
	billingSummaryInterval = 1 * time.Hour
	// Re-aggregate a rolling lookback window rather than only "since last run",
	// so late-arriving/updated accounting rows still get folded in. Idempotent
	// via the OnConflict upsert in model.UpsertBillingHourlySummaries.
	billingSummaryLookback = 26 * time.Hour
)

var billingSummaryOnce sync.Once

func billingHourExpr(col string) string {
	if common.UsingMySQL {
		return fmt.Sprintf("(%s DIV 3600) * 3600", col)
	}
	return fmt.Sprintf("(%s / 3600) * 3600", col)
}

// StartBillingSummaryTask starts the hourly job that rolls Log accounting
// fields up into billing_hourly_summaries, backing the 平台账单 admin page.
func StartBillingSummaryTask() {
	billingSummaryOnce.Do(func() {
		if !common.IsMasterNode {
			return
		}
		gopool.Go(func() {
			logger.LogInfo(context.Background(), "billing-summary task started")
			ticker := time.NewTicker(billingSummaryInterval)
			defer ticker.Stop()
			runBillingSummaryOnce()
			for range ticker.C {
				runBillingSummaryOnce()
			}
		})
	})
}

func runBillingSummaryOnce() {
	ctx := context.Background()
	// Floor to the hour: the upsert overwrites whole (hour, model, channel)
	// buckets, so the window boundary must sit exactly on a bucket edge. A
	// mid-hour boundary re-aggregates the straddled bucket from only part of
	// its rows and clobbers the previously complete value (found 2026-07-10:
	// every bucket lost its pre-boundary slice ~26h after its hour).
	since := time.Now().Add(-billingSummaryLookback).Unix() / 3600 * 3600
	hourExpr := billingHourExpr("created_at")

	var rows []model.BillingHourlySummary
	err := model.LOG_DB.Table("logs").
		Select(hourExpr+` as hour_bucket,
		         model_name,
		         channel_id,
		         SUM(accounting_channel_cost_amount_usd) as cost_usd,
		         SUM(accounting_user_final_amount_usd) as revenue_usd,
		         COUNT(*) as request_count`).
		Where("type = ? AND quota > 0 AND accounting_status = ? AND created_at >= ?", model.LogTypeConsume, "ok", since).
		Group(hourExpr + ", model_name, channel_id").
		Scan(&rows).Error
	if err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("billing-summary: aggregate failed: %v", err))
		return
	}
	now := time.Now().Unix()
	for i := range rows {
		rows[i].UpdatedAt = now
	}
	if err := model.UpsertBillingHourlySummaries(rows); err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("billing-summary: upsert failed: %v", err))
		return
	}
	logger.LogInfo(ctx, fmt.Sprintf("billing-summary: refreshed %d bucket rows since %d", len(rows), since))
}

// GetBillingDaily picks the summary-table path when no user-identifying
// filter is set, otherwise falls back to querying raw logs directly (see
// model.GetBillingDailyFromRawLogs for why no name→id resolution is needed).
func GetBillingDaily(startTimestamp, endTimestamp int64, modelName string, channel int, tokenName, username, email string) ([]model.BillingDailyRow, error) {
	if tokenName != "" || username != "" || email != "" {
		return model.GetBillingDailyFromRawLogs(startTimestamp, endTimestamp, modelName, channel, tokenName, username, email)
	}
	return model.GetBillingDailyFromSummary(startTimestamp, endTimestamp, modelName, channel)
}
