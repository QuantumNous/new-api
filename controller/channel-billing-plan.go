package controller

import (
	"fmt"
	"net/http"
	"sort"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
)

// Coding-plan channels (Zhipu GLM plans, MiniMax coding plans) expose windowed
// quota (5-hour + weekly) instead of a wallet balance. The full window
// snapshot is persisted in other_info (the USD balance field keeps its
// original meaning) and returned to the dashboard through the plan_usage
// field.

const (
	planWindowInterval5h = "interval_5h"
	planWindowWeekly     = "weekly"

	planProviderZhipu   = "zhipu"
	planProviderMiniMax = "minimax"
)

type PlanUsageWindow struct {
	Kind        string  `json:"kind"`
	UsedPercent float64 `json:"used_percent"` // 0-100
	ResetTime   int64   `json:"reset_time"`   // unix seconds, 0 = unknown
	LimitType   string  `json:"limit_type,omitempty"`
	// Zhipu credit plans report absolute quota per window.
	TotalQuota     *float64 `json:"total_quota,omitempty"`
	UsedQuota      *float64 `json:"used_quota,omitempty"`
	RemainingQuota *float64 `json:"remaining_quota,omitempty"`
}

type ChannelPlanUsage struct {
	Provider string            `json:"provider"` // "zhipu" | "minimax"
	Level    string            `json:"level,omitempty"`
	Windows  []PlanUsageWindow `json:"windows"`
}

func clampPlanPercent(v float64) float64 {
	if v < 0 {
		return 0
	}
	if v > 100 {
		return 100
	}
	return v
}

func milliToUnixSeconds(ms int64) int64 {
	if ms <= 0 {
		return 0
	}
	return ms / 1000
}

type zhipuQuotaLimitEntry struct {
	Type          string   `json:"type"`
	Unit          int      `json:"unit"`
	Usage         *float64 `json:"usage"`
	CurrentValue  *float64 `json:"currentValue"`
	Remaining     *float64 `json:"remaining"`
	Percentage    float64  `json:"percentage"`
	NextResetTime int64    `json:"nextResetTime"` // milliseconds, absent when the window is idle
}

type zhipuQuotaLimitResponse struct {
	Code    int    `json:"code"`
	Msg     string `json:"msg"`
	Success bool   `json:"success"`
	Data    struct {
		Level  string                 `json:"level"`
		Limits []zhipuQuotaLimitEntry `json:"limits"`
	} `json:"data"`
}

func parseZhipuQuotaLimit(body []byte) (*ChannelPlanUsage, error) {
	response := zhipuQuotaLimitResponse{}
	if err := common.Unmarshal(body, &response); err != nil {
		return nil, err
	}
	// Zhipu reports business failures (e.g. invalid key, code 401) with
	// HTTP 200, so success must be checked before touching data.
	if !response.Success {
		return nil, fmt.Errorf("code: %d, message: %s", response.Code, response.Msg)
	}
	fiveHour, weekly := classifyZhipuLimits(response.Data.Limits)
	usage := &ChannelPlanUsage{Provider: planProviderZhipu, Level: response.Data.Level}
	if fiveHour != nil {
		usage.Windows = append(usage.Windows, buildZhipuWindow(planWindowInterval5h, fiveHour))
	}
	if weekly != nil {
		usage.Windows = append(usage.Windows, buildZhipuWindow(planWindowWeekly, weekly))
	}
	if len(usage.Windows) == 0 {
		return nil, fmt.Errorf("no quota limits returned")
	}
	return usage, nil
}

func buildZhipuWindow(kind string, entry *zhipuQuotaLimitEntry) PlanUsageWindow {
	return PlanUsageWindow{
		Kind:           kind,
		UsedPercent:    clampPlanPercent(entry.Percentage),
		ResetTime:      milliToUnixSeconds(entry.NextResetTime),
		LimitType:      entry.Type,
		TotalQuota:     entry.Usage,
		UsedQuota:      entry.CurrentValue,
		RemainingQuota: entry.Remaining,
	}
}

// classifyZhipuLimits splits limit entries into the 5-hour and weekly buckets.
// unit is the only reliable classifier: near period boundaries the weekly
// window resets earlier than the 5-hour one, so sorting by reset time would
// swap the two buckets. When unit is missing or unrecognized, fall back to
// preferring entries without a reset time for the 5-hour bucket (idle 5-hour
// windows carry no reset field), then filling empty slots by earliest reset.
func classifyZhipuLimits(limits []zhipuQuotaLimitEntry) (fiveHour, weekly *zhipuQuotaLimitEntry) {
	rest := make([]*zhipuQuotaLimitEntry, 0, len(limits))
	for i := range limits {
		entry := &limits[i]
		switch entry.Unit {
		case 3:
			if fiveHour == nil {
				fiveHour = entry
				continue
			}
		case 6:
			if weekly == nil {
				weekly = entry
				continue
			}
		}
		rest = append(rest, entry)
	}
	if fiveHour == nil {
		for i, entry := range rest {
			if entry.NextResetTime == 0 {
				fiveHour = entry
				rest = append(rest[:i], rest[i+1:]...)
				break
			}
		}
	}
	sort.Slice(rest, func(i, j int) bool { return rest[i].NextResetTime < rest[j].NextResetTime })
	if fiveHour == nil && len(rest) > 0 {
		fiveHour = rest[0]
		rest = rest[1:]
	}
	if weekly == nil && len(rest) > 0 {
		weekly = rest[0]
	}
	return fiveHour, weekly
}

type minimaxModelRemain struct {
	ModelName                       string  `json:"model_name"`
	EndTime                         int64   `json:"end_time"`
	WeeklyEndTime                   int64   `json:"weekly_end_time"`
	CurrentIntervalRemainingPercent float64 `json:"current_interval_remaining_percent"`
	CurrentWeeklyStatus             int     `json:"current_weekly_status"`
	CurrentWeeklyRemainingPercent   float64 `json:"current_weekly_remaining_percent"`
}

type minimaxCodingPlanRemainsResponse struct {
	BaseResp struct {
		StatusCode int    `json:"status_code"`
		StatusMsg  string `json:"status_msg"`
	} `json:"base_resp"`
	ModelRemains []minimaxModelRemain `json:"model_remains"`
}

func parseMiniMaxCodingPlanRemains(body []byte) (*ChannelPlanUsage, error) {
	response := minimaxCodingPlanRemainsResponse{}
	if err := common.Unmarshal(body, &response); err != nil {
		return nil, err
	}
	// Business failures arrive with HTTP 200: an expired session key reports
	// base_resp.status_code 1004.
	if response.BaseResp.StatusCode != 0 {
		return nil, fmt.Errorf("code: %d, message: %s", response.BaseResp.StatusCode, response.BaseResp.StatusMsg)
	}
	var general *minimaxModelRemain
	for i := range response.ModelRemains {
		if response.ModelRemains[i].ModelName == "general" {
			general = &response.ModelRemains[i]
			break
		}
	}
	if general == nil {
		return nil, fmt.Errorf("no general coding plan data returned")
	}
	usage := &ChannelPlanUsage{Provider: planProviderMiniMax}
	// MiniMax reports remaining percent, so used is the complement.
	usage.Windows = append(usage.Windows, PlanUsageWindow{
		Kind:        planWindowInterval5h,
		UsedPercent: clampPlanPercent(100 - general.CurrentIntervalRemainingPercent),
		ResetTime:   milliToUnixSeconds(general.EndTime),
	})
	// current_weekly_status 3 means the plan has no weekly cap and the weekly
	// percent stays at 100 — skip it instead of reporting a fake window.
	if general.CurrentWeeklyStatus == 1 {
		usage.Windows = append(usage.Windows, PlanUsageWindow{
			Kind:        planWindowWeekly,
			UsedPercent: clampPlanPercent(100 - general.CurrentWeeklyRemainingPercent),
			ResetTime:   milliToUnixSeconds(general.WeeklyEndTime),
		})
	}
	return usage, nil
}

func resolveZhipuMonitorURL(baseURL string) string {
	if strings.Contains(baseURL, "z.ai") || baseURL == "glm-coding-plan-international" {
		return "https://api.z.ai/api/monitor/usage/quota/limit"
	}
	return "https://open.bigmodel.cn/api/monitor/usage/quota/limit"
}

func resolveMiniMaxRemainsURL(baseURL string) string {
	if strings.Contains(baseURL, "minimax.io") {
		return "https://api.minimax.io/v1/api/openplatform/coding_plan/remains"
	}
	return "https://api.minimaxi.com/v1/api/openplatform/coding_plan/remains"
}

func fetchZhipuPlanBalance(channel *model.Channel) (channelBalanceResult, error) {
	url := resolveZhipuMonitorURL(channel.GetBaseURL())
	// The monitor API takes the raw key without a Bearer prefix.
	headers := http.Header{}
	headers.Add("Authorization", channel.Key)
	body, err := GetResponseBody(http.MethodGet, url, channel, headers)
	if err != nil {
		return channelBalanceResult{}, err
	}
	usage, err := parseZhipuQuotaLimit(body)
	if err != nil {
		return channelBalanceResult{}, err
	}
	if err := channel.UpdatePlanUsage(usage); err != nil {
		return channelBalanceResult{}, err
	}
	// Keep the USD balance passthrough so the wallet semantics stay untouched.
	return channelBalanceResult{Balance: channel.Balance, PlanUsage: usage}, nil
}

func fetchMiniMaxPlanBalance(channel *model.Channel) (channelBalanceResult, error) {
	url := resolveMiniMaxRemainsURL(channel.GetBaseURL())
	body, err := GetResponseBody(http.MethodGet, url, channel, GetAuthHeader(channel.Key))
	if err != nil {
		return channelBalanceResult{}, err
	}
	usage, err := parseMiniMaxCodingPlanRemains(body)
	if err != nil {
		return channelBalanceResult{}, err
	}
	if err := channel.UpdatePlanUsage(usage); err != nil {
		return channelBalanceResult{}, err
	}
	// Keep the USD balance passthrough so the wallet semantics stay untouched.
	return channelBalanceResult{Balance: channel.Balance, PlanUsage: usage}, nil
}

// isPlanUsageChannelType marks channels whose quota is a windowed coding-plan
// quota. Their windowed remaining percent self-recovers on reset, so the
// balance-exhausted auto-ban must not apply to them.
func isPlanUsageChannelType(channelType int) bool {
	switch channelType {
	case constant.ChannelTypeZhipu, constant.ChannelTypeZhipu_v4, constant.ChannelTypeMiniMax:
		return true
	}
	return false
}
