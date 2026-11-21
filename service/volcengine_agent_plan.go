package service

import (
	"bytes"
	"context"
	"io"
	"math"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/volcengine/volc-sdk-golang/base"
)

const volcengineAgentPlanEndpoint = "https://ark.cn-beijing.volcengineapi.com/"

var volcengineAgentPlanClient = &http.Client{
	Timeout: 8 * time.Second,
	CheckRedirect: func(*http.Request, []*http.Request) error {
		return http.ErrUseLastResponse
	},
}

// AgentPlanQuotaWindow represents an Ark quota window. Coding Plan reports a
// percentage instead of the absolute AFP amounts returned by Agent Plan.
type AgentPlanQuotaWindow struct {
	Period      string   `json:"period"`
	Quota       *float64 `json:"quota,omitempty"`
	Used        *float64 `json:"used,omitempty"`
	UsedPercent *float64 `json:"used_percent,omitempty"`
	ResetAt     int64    `json:"reset_at,omitempty"`
}

type codingPlanQuotaWindow struct {
	Level          string
	Percent        *float64
	ResetTimestamp int64
	ResetTime      int64
}

type agentPlanAFPWindow struct {
	Quota     string
	Used      string
	ResetTime int64
}

type agentPlanAFPUsage struct {
	SeatID      string
	AFPFiveHour *agentPlanAFPWindow
	AFPDaily    *agentPlanAFPWindow
	AFPWeekly   *agentPlanAFPWindow
	AFPMonthly  *agentPlanAFPWindow
}

func (usage agentPlanAFPUsage) windows() []AgentPlanQuotaWindow {
	var windows []AgentPlanQuotaWindow
	for _, item := range []struct {
		period string
		window *agentPlanAFPWindow
	}{
		{"five_hour", usage.AFPFiveHour},
		{"daily", usage.AFPDaily},
		{"weekly", usage.AFPWeekly},
		{"monthly", usage.AFPMonthly},
	} {
		if item.window == nil {
			continue
		}
		quota, quotaErr := strconv.ParseFloat(item.window.Quota, 64)
		used, usedErr := strconv.ParseFloat(item.window.Used, 64)
		if quotaErr != nil || usedErr != nil || math.IsNaN(quota) || math.IsNaN(used) ||
			math.IsInf(quota, 0) || math.IsInf(used, 0) || quota <= 0 || used < 0 {
			continue
		}
		windows = append(windows, AgentPlanQuotaWindow{
			Period: item.period, Quota: &quota, Used: &used, ResetAt: max(item.window.ResetTime/1000, 0),
		})
	}
	return windows
}

// FetchVolcenginePlanQuota uses the signed Ark management API. An empty seat
// list queries the personal subscription. The empty map key denotes personal.
func FetchVolcenginePlanQuota(ctx context.Context, accessKey, secretKey string, codingPlan bool, seatIDs []string) (map[string][]AgentPlanQuotaWindow, string) {
	if accessKey == "" || secretKey == "" {
		return nil, "credentials_missing"
	}
	action := "GetAFPUsage"
	endpoint := volcengineAgentPlanEndpoint
	body := []byte("{}")
	if codingPlan {
		action = "GetCodingPlanUsage"
		endpoint = "https://open.volcengineapi.com/"
	} else if len(seatIDs) > 0 {
		action = "GetSeatAFPUsage"
		var err error
		body, err = common.Marshal(struct{ SeatIDs []string }{seatIDs})
		if err != nil {
			return nil, "unavailable"
		}
	}
	query := url.Values{"Action": {action}, "Version": {"2024-01-01"}}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint+"?"+query.Encode(), bytes.NewReader(body))
	if err != nil {
		return nil, "unavailable"
	}
	request.Header.Set("Content-Type", "application/json")
	credentials := base.Credentials{AccessKeyID: accessKey, SecretAccessKey: secretKey, Region: "cn-beijing", Service: "ark"}
	response, err := volcengineAgentPlanClient.Do(credentials.Sign(request))
	if err != nil {
		return nil, "unavailable"
	}
	defer response.Body.Close()

	switch response.StatusCode {
	case http.StatusUnauthorized, http.StatusForbidden:
		return nil, "access_denied"
	case http.StatusTooManyRequests:
		return nil, "rate_limited"
	}
	var result struct {
		ResponseMetadata struct {
			Error *struct{ Code string }
		}
		Result *struct {
			agentPlanAFPUsage
			SeatAFPUsages []agentPlanAFPUsage
			QuotaUsage    []codingPlanQuotaWindow
		}
	}
	data, err := io.ReadAll(io.LimitReader(response.Body, 256*1024+1))
	if err != nil || len(data) > 256*1024 || common.Unmarshal(data, &result) != nil {
		return nil, "unavailable"
	}
	if apiError := result.ResponseMetadata.Error; apiError != nil {
		switch apiError.Code {
		case "AccessDenied", "Forbidden", "SignatureDoesNotMatch", "InvalidAccessKeyId", "InvalidCredential", "AuthFailure":
			return nil, "access_denied"
		case "Throttling", "RequestLimitExceeded":
			return nil, "rate_limited"
		default:
			return nil, "unavailable"
		}
	}
	if response.StatusCode != http.StatusOK {
		return nil, "unavailable"
	}
	windows := make(map[string][]AgentPlanQuotaWindow)
	if result.Result == nil {
		return windows, ""
	}
	if codingPlan {
		periods := map[string]string{"session": "five_hour", "weekly": "weekly", "monthly": "monthly"}
		for _, quota := range result.Result.QuotaUsage {
			period, known := periods[quota.Level]
			if !known || quota.Percent == nil || *quota.Percent < 0 || *quota.Percent > 100 {
				continue
			}
			delete(periods, quota.Level)
			windows[""] = append(windows[""], AgentPlanQuotaWindow{
				Period: period, UsedPercent: quota.Percent, ResetAt: max(quota.ResetTimestamp, quota.ResetTime, 0),
			})
		}
		return windows, ""
	}
	if len(seatIDs) == 0 {
		windows[""] = result.Result.agentPlanAFPUsage.windows()
		return windows, ""
	}
	for _, seat := range result.Result.SeatAFPUsages {
		windows[seat.SeatID] = seat.windows()
	}
	return windows, ""
}
