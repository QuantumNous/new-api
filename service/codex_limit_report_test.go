package service

import (
	"context"
	"errors"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
)

func TestBuildCodexLimitReportSummarizesSuccessfulUsage(t *testing.T) {
	channels := []*model.Channel{
		{Id: 11, Name: "Codex Pro", Type: constant.ChannelTypeCodex, Status: common.ChannelStatusEnabled},
	}
	fetcher := CodexUsageFetcherFunc(func(ctx context.Context, channel *model.Channel) (int, []byte, error) {
		return 200, []byte(`{
			"plan_type": "pro",
			"email": "owner@example.com",
			"account_id": "acct_123",
			"rate_limit": {
				"allowed": true,
				"limit_reached": false,
				"primary_window": {
					"used_percent": 23.5,
					"reset_at": 1893456000,
					"reset_after_seconds": 7200,
					"limit_window_seconds": 18000
				},
				"secondary_window": {
					"used_percent": 51,
					"reset_at": 1893888000,
					"reset_after_seconds": 172800,
					"limit_window_seconds": 604800
				}
			},
			"additional_rate_limits": [
				{
					"limit_name": "gpt-5.3-codex",
					"metered_feature": "responses",
					"rate_limit": {
						"primary_window": {
							"used_percent": 77,
							"limit_window_seconds": 18000
						}
					}
				}
			]
		}`), nil
	})

	report := BuildCodexLimitReport(context.Background(), channels, fetcher)

	if report.TotalChannels != 1 || report.SuccessCount != 1 || report.FailureCount != 0 {
		t.Fatalf("unexpected counts: %#v", report)
	}
	row := report.Rows[0]
	if !row.Success {
		t.Fatalf("expected success row, got message %q", row.Message)
	}
	if row.PlanType != "pro" || row.Email != "owner@example.com" || row.AccountID != "acct_123" {
		t.Fatalf("unexpected identity fields: %#v", row)
	}
	if row.BaseFiveHourWindow == nil || row.BaseFiveHourWindow.UsedPercent != 23.5 {
		t.Fatalf("unexpected five-hour window: %#v", row.BaseFiveHourWindow)
	}
	if row.BaseWeeklyWindow == nil || row.BaseWeeklyWindow.UsedPercent != 51 {
		t.Fatalf("unexpected weekly window: %#v", row.BaseWeeklyWindow)
	}
	if len(row.AdditionalLimits) != 1 {
		t.Fatalf("additional limits len = %d", len(row.AdditionalLimits))
	}
	if row.AdditionalLimits[0].Name != "gpt-5.3-codex" {
		t.Fatalf("unexpected additional limit: %#v", row.AdditionalLimits[0])
	}
	if row.AdditionalLimits[0].FiveHourWindow == nil || row.AdditionalLimits[0].FiveHourWindow.UsedPercent != 77 {
		t.Fatalf("unexpected additional five-hour window: %#v", row.AdditionalLimits[0])
	}
}

func TestBuildCodexLimitReportMergesRangeUsageStats(t *testing.T) {
	channels := []*model.Channel{
		{Id: 11, Name: "Codex Pro", Type: constant.ChannelTypeCodex, Status: common.ChannelStatusEnabled},
		{Id: 12, Name: "Codex Team", Type: constant.ChannelTypeCodex, Status: common.ChannelStatusEnabled},
	}
	fetcher := CodexUsageFetcherFunc(func(ctx context.Context, channel *model.Channel) (int, []byte, error) {
		return 200, []byte(`{"rate_limit":{"allowed":true}}`), nil
	})
	usageStats := map[int]model.CodexChannelUsageStat{
		11: {ChannelID: 11, TokenUsed: 1000, Quota: 2500},
		12: {ChannelID: 12, TokenUsed: 3000, Quota: 7500},
	}

	report := BuildCodexLimitReportWithUsage(
		context.Background(),
		channels,
		fetcher,
		usageStats,
		1700000000,
		1700600000,
	)

	if report.StartTimestamp != 1700000000 || report.EndTimestamp != 1700600000 {
		t.Fatalf("unexpected range: %#v", report)
	}
	if report.TotalTokenUsed != 4000 || report.TotalQuota != 10000 {
		t.Fatalf("unexpected totals: %#v", report)
	}
	if report.Rows[0].RangeTokenUsed != 1000 || report.Rows[0].RangeQuota != 2500 {
		t.Fatalf("unexpected row 0 usage: %#v", report.Rows[0])
	}
	if report.Rows[1].RangeTokenUsed != 3000 || report.Rows[1].RangeQuota != 7500 {
		t.Fatalf("unexpected row 1 usage: %#v", report.Rows[1])
	}
}

func TestBuildCodexLimitReportKeepsFailureRows(t *testing.T) {
	channels := []*model.Channel{
		{Id: 12, Name: "Expired Codex", Type: constant.ChannelTypeCodex, Status: common.ChannelStatusEnabled},
	}
	fetcher := CodexUsageFetcherFunc(func(ctx context.Context, channel *model.Channel) (int, []byte, error) {
		return 0, nil, errors.New("upstream timeout")
	})

	report := BuildCodexLimitReport(context.Background(), channels, fetcher)

	if report.TotalChannels != 1 || report.SuccessCount != 0 || report.FailureCount != 1 {
		t.Fatalf("unexpected counts: %#v", report)
	}
	row := report.Rows[0]
	if row.Success {
		t.Fatalf("expected failure row: %#v", row)
	}
	if row.ChannelID != 12 || row.Message != "upstream timeout" {
		t.Fatalf("unexpected failure row: %#v", row)
	}
}

func TestBuildCodexLimitReportRejectsNonSuccessUpstreamStatus(t *testing.T) {
	channels := []*model.Channel{
		{Id: 13, Name: "Limited Codex", Type: constant.ChannelTypeCodex, Status: common.ChannelStatusEnabled},
	}
	fetcher := CodexUsageFetcherFunc(func(ctx context.Context, channel *model.Channel) (int, []byte, error) {
		return 403, []byte(`{"error":"forbidden"}`), nil
	})

	report := BuildCodexLimitReport(context.Background(), channels, fetcher)

	if report.SuccessCount != 0 || report.FailureCount != 1 {
		t.Fatalf("unexpected counts: %#v", report)
	}
	row := report.Rows[0]
	if row.Success || row.UpstreamStatus != 403 || row.Message != "upstream status: 403" {
		t.Fatalf("unexpected non-success row: %#v", row)
	}
}
