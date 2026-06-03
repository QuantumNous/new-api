package service

import (
	"context"
	"fmt"
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

const codexLimitReportFetchConcurrency = 5

type CodexUsageFetcher interface {
	FetchCodexUsage(ctx context.Context, channel *model.Channel) (statusCode int, body []byte, err error)
}

type CodexUsageFetcherFunc func(ctx context.Context, channel *model.Channel) (statusCode int, body []byte, err error)

func (f CodexUsageFetcherFunc) FetchCodexUsage(ctx context.Context, channel *model.Channel) (int, []byte, error) {
	return f(ctx, channel)
}

type CodexLimitWindow struct {
	UsedPercent        float64 `json:"used_percent"`
	ResetAt            int64   `json:"reset_at,omitempty"`
	ResetAfterSeconds  int64   `json:"reset_after_seconds,omitempty"`
	LimitWindowSeconds int64  `json:"limit_window_seconds,omitempty"`
}

type CodexAdditionalLimit struct {
	Name           string             `json:"name"`
	MeteredFeature string             `json:"metered_feature,omitempty"`
	FiveHourWindow *CodexLimitWindow  `json:"five_hour_window,omitempty"`
	WeeklyWindow   *CodexLimitWindow  `json:"weekly_window,omitempty"`
}

type CodexLimitReportRow struct {
	ChannelID          int                    `json:"channel_id"`
	ChannelName        string                 `json:"channel_name"`
	ChannelStatus      int                    `json:"channel_status"`
	RangeTokenUsed     int64                  `json:"range_token_used"`
	RangeQuota         int64                  `json:"range_quota"`
	Success            bool                   `json:"success"`
	Message            string                 `json:"message,omitempty"`
	UpstreamStatus     int                    `json:"upstream_status,omitempty"`
	PlanType           string                 `json:"plan_type,omitempty"`
	Email              string                 `json:"email,omitempty"`
	AccountID          string                 `json:"account_id,omitempty"`
	UserID             string                 `json:"user_id,omitempty"`
	Allowed            bool                   `json:"allowed"`
	LimitReached       bool                   `json:"limit_reached"`
	BaseFiveHourWindow *CodexLimitWindow      `json:"base_five_hour_window,omitempty"`
	BaseWeeklyWindow   *CodexLimitWindow      `json:"base_weekly_window,omitempty"`
	AdditionalLimits   []CodexAdditionalLimit `json:"additional_limits,omitempty"`
}

type CodexLimitReport struct {
	GeneratedAt     int64                 `json:"generated_at"`
	StartTimestamp  int64                 `json:"start_timestamp"`
	EndTimestamp    int64                 `json:"end_timestamp"`
	TotalChannels   int                   `json:"total_channels"`
	SuccessCount    int                   `json:"success_count"`
	FailureCount    int                   `json:"failure_count"`
	TotalTokenUsed  int64                 `json:"total_token_used"`
	TotalQuota      int64                 `json:"total_quota"`
	Rows            []CodexLimitReportRow `json:"rows"`
}

type codexUsagePayload struct {
	PlanType             string                        `json:"plan_type"`
	UserID               string                        `json:"user_id"`
	Email                string                        `json:"email"`
	AccountID            string                        `json:"account_id"`
	RateLimit            codexRateLimitPayload         `json:"rate_limit"`
	AdditionalRateLimits []codexAdditionalLimitPayload `json:"additional_rate_limits"`
}

type codexAdditionalLimitPayload struct {
	LimitName       string                `json:"limit_name"`
	MeteredFeature  string                `json:"metered_feature"`
	RateLimit       codexRateLimitPayload `json:"rate_limit"`
	PrimaryWindow   *CodexLimitWindow     `json:"primary_window"`
	SecondaryWindow *CodexLimitWindow    `json:"secondary_window"`
	PlanType        string                `json:"plan_type"`
}

type codexRateLimitPayload struct {
	PlanType        string            `json:"plan_type"`
	Allowed         bool              `json:"allowed"`
	LimitReached    bool              `json:"limit_reached"`
	PrimaryWindow   *CodexLimitWindow `json:"primary_window"`
	SecondaryWindow *CodexLimitWindow `json:"secondary_window"`
}

func BuildCodexLimitReport(ctx context.Context, channels []*model.Channel, fetcher CodexUsageFetcher) CodexLimitReport {
	return BuildCodexLimitReportWithUsage(ctx, channels, fetcher, nil, 0, 0)
}

func BuildCodexLimitReportWithUsage(
	ctx context.Context,
	channels []*model.Channel,
	fetcher CodexUsageFetcher,
	usageStats map[int]model.CodexChannelUsageStat,
	startTimestamp int64,
	endTimestamp int64,
) CodexLimitReport {
	report := CodexLimitReport{
		GeneratedAt:    common.GetTimestamp(),
		StartTimestamp: startTimestamp,
		EndTimestamp:   endTimestamp,
		TotalChannels:  len(channels),
		Rows:           make([]CodexLimitReportRow, 0, len(channels)),
	}

	rows := make([]CodexLimitReportRow, len(channels))
	sem := make(chan struct{}, codexLimitReportFetchConcurrency)
	var wg sync.WaitGroup

	for index, channel := range channels {
		index := index
		channel := channel
		wg.Add(1)
		go func() {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			rows[index] = buildCodexLimitReportRow(ctx, channel, fetcher)
		}()
	}
	wg.Wait()

	for _, row := range rows {
		if stat, ok := usageStats[row.ChannelID]; ok {
			row.RangeTokenUsed = stat.TokenUsed
			row.RangeQuota = stat.Quota
		}
		if row.Success {
			report.SuccessCount++
		} else {
			report.FailureCount++
		}
		report.TotalTokenUsed += row.RangeTokenUsed
		report.TotalQuota += row.RangeQuota
		report.Rows = append(report.Rows, row)
	}

	return report
}

func buildCodexLimitReportRow(ctx context.Context, channel *model.Channel, fetcher CodexUsageFetcher) CodexLimitReportRow {
	row := CodexLimitReportRow{}
	if channel != nil {
		row.ChannelID = channel.Id
		row.ChannelName = channel.Name
		row.ChannelStatus = channel.Status
	}
	if channel == nil {
		row.Message = "nil channel"
		return row
	}
	if fetcher == nil {
		row.Message = "nil usage fetcher"
		return row
	}

	statusCode, body, err := fetcher.FetchCodexUsage(ctx, channel)
	row.UpstreamStatus = statusCode
	if err != nil {
		row.Message = err.Error()
		return row
	}
	if statusCode < 200 || statusCode >= 300 {
		row.Message = fmt.Sprintf("upstream status: %d", statusCode)
		return row
	}

	payload := codexUsagePayload{}
	if err := common.Unmarshal(body, &payload); err != nil {
		row.Message = "parse usage payload: " + err.Error()
		return row
	}

	applyCodexUsagePayload(&row, payload)
	row.Success = true
	return row
}

func applyCodexUsagePayload(row *CodexLimitReportRow, payload codexUsagePayload) {
	row.PlanType = firstNonEmpty(payload.PlanType, payload.RateLimit.PlanType)
	row.Email = strings.TrimSpace(payload.Email)
	row.AccountID = strings.TrimSpace(payload.AccountID)
	row.UserID = strings.TrimSpace(payload.UserID)
	row.Allowed = payload.RateLimit.Allowed
	row.LimitReached = payload.RateLimit.LimitReached
	row.BaseFiveHourWindow, row.BaseWeeklyWindow = resolveCodexLimitWindows(
		payload.PlanType,
		payload.RateLimit.PrimaryWindow,
		payload.RateLimit.SecondaryWindow,
	)

	for _, item := range payload.AdditionalRateLimits {
		primary := item.RateLimit.PrimaryWindow
		secondary := item.RateLimit.SecondaryWindow
		if primary == nil {
			primary = item.PrimaryWindow
		}
		if secondary == nil {
			secondary = item.SecondaryWindow
		}
		fiveHour, weekly := resolveCodexLimitWindows(
			firstNonEmpty(item.PlanType, item.RateLimit.PlanType),
			primary,
			secondary,
		)
		name := firstNonEmpty(item.LimitName, item.MeteredFeature, "Additional Limit")
		row.AdditionalLimits = append(row.AdditionalLimits, CodexAdditionalLimit{
			Name:           name,
			MeteredFeature: strings.TrimSpace(item.MeteredFeature),
			FiveHourWindow: fiveHour,
			WeeklyWindow:   weekly,
		})
	}
}

func resolveCodexLimitWindows(planType string, primary *CodexLimitWindow, secondary *CodexLimitWindow) (*CodexLimitWindow, *CodexLimitWindow) {
	windows := []*CodexLimitWindow{}
	if primary != nil {
		windows = append(windows, primary)
	}
	if secondary != nil {
		windows = append(windows, secondary)
	}

	var fiveHour *CodexLimitWindow
	var weekly *CodexLimitWindow
	for _, window := range windows {
		switch classifyCodexLimitWindow(window) {
		case "five_hour":
			if fiveHour == nil {
				fiveHour = window
			}
		case "weekly":
			if weekly == nil {
				weekly = window
			}
		}
	}

	if strings.EqualFold(strings.TrimSpace(planType), "free") {
		if weekly == nil {
			weekly = firstWindow(primary, secondary)
		}
		return nil, weekly
	}

	if fiveHour == nil && weekly == nil {
		return primary, secondary
	}
	if fiveHour == nil {
		fiveHour = firstDifferentWindow(windows, weekly)
	}
	if weekly == nil {
		weekly = firstDifferentWindow(windows, fiveHour)
	}
	return fiveHour, weekly
}

func classifyCodexLimitWindow(window *CodexLimitWindow) string {
	if window == nil || window.LimitWindowSeconds <= 0 {
		return ""
	}
	if window.LimitWindowSeconds >= 24*60*60 {
		return "weekly"
	}
	return "five_hour"
}

func firstWindow(windows ...*CodexLimitWindow) *CodexLimitWindow {
	for _, window := range windows {
		if window != nil {
			return window
		}
	}
	return nil
}

func firstDifferentWindow(windows []*CodexLimitWindow, existing *CodexLimitWindow) *CodexLimitWindow {
	for _, window := range windows {
		if window != nil && window != existing {
			return window
		}
	}
	return nil
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}
