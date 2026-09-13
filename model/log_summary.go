package model

import (
	"context"
	"math"
	"sort"
	"time"

	"github.com/QuantumNous/new-api/common"
)

type LogSummaryTotals struct {
	Requests           int64   `json:"requests"`
	Succeeded          int64   `json:"succeeded"`
	Failed             int64   `json:"failed"`
	Quota              int64   `json:"quota"` // Wallet spending only.
	SubscriptionQuota  int64   `json:"subscription_quota"`
	Tokens             int64   `json:"tokens"`
	SavedQuota         float64 `json:"saved_quota"`
	ComparableRequests int64   `json:"comparable_requests"`
}

type DailyLogSummary struct {
	Date string `json:"date"`
	LogSummaryTotals
}

type UserLogSummary struct {
	LogSummaryTotals
	Daily []DailyLogSummary `json:"daily"`
}

// GetUserLogSummary scans the complete bounded window without transferring raw
// logs to the client or relying on database-specific JSON/date functions.
func GetUserLogSummary(ctx context.Context, userID int, start, end int64, timezoneOffset int) (*UserLogSummary, error) {
	query := LOG_DB.WithContext(ctx).Model(&Log{}).
		Select("id", "request_id", "created_at", "type", "quota", "prompt_tokens", "completion_tokens", "is_stream", "other").
		Where("user_id = ? AND created_at >= ? AND created_at <= ? AND type IN ?", userID, start, end, []int{LogTypeConsume, LogTypeError}).
		Order("request_id ASC, created_at ASC, id ASC")
	rows, err := query.Rows()
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := &UserLogSummary{Daily: []DailyLogSummary{}}
	days := make(map[string]*DailyLogSummary)
	location := time.FixedZone("report", timezoneOffset*60)
	// Keep only the current request outcome; ordered rows make retries adjacent.
	var previousID string
	var previousDay *DailyLogSummary
	var previousFailed, previousConsume bool
	for rows.Next() {
		var log Log
		if err := LOG_DB.ScanRows(rows, &log); err != nil {
			return nil, err
		}
		var other struct {
			GroupRatio           *float64 `json:"group_ratio"`
			UserGroupRatio       *float64 `json:"user_group_ratio"`
			FeeQuota             *float64 `json:"fee_quota"`
			WalletQuotaDeducted  *int64   `json:"wallet_quota_deducted"`
			SubscriptionConsumed *int64   `json:"subscription_consumed"`
			BillingSource        string   `json:"billing_source"`
			ViolationFee         bool     `json:"violation_fee"`
			ViolationFeeCode     string   `json:"violation_fee_code"`
			ViolationFeeMarker   string   `json:"violation_fee_marker"`
			StreamStatus         struct {
				Status string `json:"status"`
			} `json:"stream_status"`
		}
		validOther := common.UnmarshalJsonStr(log.Other, &other) == nil
		violation := other.ViolationFee || other.ViolationFeeCode != "" || other.ViolationFeeMarker != ""
		failed := log.Type == LogTypeError || violation || (log.IsStream && other.StreamStatus.Status == "error")
		var saved float64
		comparable := false
		if validOther && log.Type == LogTypeConsume && other.BillingSource != "subscription" &&
			!other.ViolationFee && other.ViolationFeeCode == "" && other.ViolationFeeMarker == "" {
			ratio := other.GroupRatio
			if other.UserGroupRatio != nil && *other.UserGroupRatio > 0 {
				ratio = other.UserGroupRatio
			}
			charged := float64(log.Quota)
			if other.FeeQuota != nil && *other.FeeQuota >= 0 {
				charged = *other.FeeQuota
			}
			if ratio != nil && *ratio > 0 && charged > 0 {
				candidate := charged / *ratio - charged
				if !math.IsNaN(candidate) && !math.IsInf(candidate, 0) {
					comparable = true
					saved = math.Max(candidate, 0)
				}
			}
		}
		date := time.Unix(log.CreatedAt, 0).In(location).Format("2006-01-02")
		day := days[date]
		if day == nil {
			day = &DailyLogSummary{Date: date}
			days[date] = day
		}
		sameRequest := log.RequestId != "" && log.RequestId == previousID
		// A consume row is the settled outcome, even if an asynchronous retry
		// error was persisted later. Among consume rows use the latest one.
		replaceOutcome := !sameRequest || !previousConsume || log.Type == LogTypeConsume
		if sameRequest && replaceOutcome {
			for _, totals := range []*LogSummaryTotals{&result.LogSummaryTotals, &previousDay.LogSummaryTotals} {
				totals.Requests--
				if previousFailed {
					totals.Failed--
				} else {
					totals.Succeeded--
				}
			}
		}
		if replaceOutcome {
			for _, totals := range []*LogSummaryTotals{&result.LogSummaryTotals, &day.LogSummaryTotals} {
				totals.Requests++
				if failed {
					totals.Failed++
				} else {
					totals.Succeeded++
				}
			}
			previousID, previousDay = log.RequestId, day
			previousFailed, previousConsume = failed, log.Type == LogTypeConsume
		}
		for _, totals := range []*LogSummaryTotals{&result.LogSummaryTotals, &day.LogSummaryTotals} {
			if log.Type == LogTypeConsume {
				walletQuota := int64(log.Quota)
				if other.BillingSource == "subscription" {
					walletQuota = 0
					subscriptionQuota := int64(log.Quota)
					if other.SubscriptionConsumed != nil && *other.SubscriptionConsumed >= 0 {
						subscriptionQuota = *other.SubscriptionConsumed
					}
					totals.SubscriptionQuota += subscriptionQuota
				}
				if other.WalletQuotaDeducted != nil && *other.WalletQuotaDeducted >= 0 {
					walletQuota = *other.WalletQuotaDeducted
				}
				totals.Quota += walletQuota
				totals.Tokens += int64(log.PromptTokens) + int64(log.CompletionTokens)
			}
			totals.SavedQuota += saved
			if comparable {
				totals.ComparableRequests++
			}
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	for _, day := range days {
		result.Daily = append(result.Daily, *day)
	}
	sort.Slice(result.Daily, func(i, j int) bool { return result.Daily[i].Date > result.Daily[j].Date })
	return result, nil
}
