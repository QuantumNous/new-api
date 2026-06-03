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
