package controller

import (
	"bytes"
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel/cursor_agent"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
	"golang.org/x/sync/singleflight"
)

const cursorAgentAccountResponseLimit = 1 << 20
const cursorDashboardExchangeTimeout = 10 * time.Second

var cursorDashboardAPIBaseURL = "https://api2.cursor.sh"
var cursorDashboardExchangeGroup singleflight.Group

type cursorDashboardPeriodUsage struct {
	BillingCycleStart string `json:"billingCycleStart"`
	BillingCycleEnd   string `json:"billingCycleEnd"`
	PlanUsage         struct {
		TotalSpend       float64 `json:"totalSpend"`
		IncludedSpend    float64 `json:"includedSpend"`
		BonusSpend       float64 `json:"bonusSpend"`
		Remaining        float64 `json:"remaining"`
		Limit            float64 `json:"limit"`
		AutoPercentUsed  float64 `json:"autoPercentUsed"`
		APIPercentUsed   float64 `json:"apiPercentUsed"`
		TotalPercentUsed float64 `json:"totalPercentUsed"`
	} `json:"planUsage"`
	SpendLimitUsage struct {
		TotalSpend          float64 `json:"totalSpend"`
		PooledLimit         float64 `json:"pooledLimit"`
		PooledUsed          float64 `json:"pooledUsed"`
		PooledRemaining     float64 `json:"pooledRemaining"`
		IndividualLimit     float64 `json:"individualLimit"`
		IndividualUsed      float64 `json:"individualUsed"`
		IndividualRemaining float64 `json:"individualRemaining"`
		LimitType           string  `json:"limitType"`
	} `json:"spendLimitUsage"`
}

type cursorDashboardPlanResponse struct {
	PlanInfo struct {
		PlanName            string  `json:"planName"`
		IncludedAmountCents float64 `json:"includedAmountCents"`
		Price               string  `json:"price"`
		BillingCycleEnd     string  `json:"billingCycleEnd"`
		PlanOwner           string  `json:"planOwner"`
	} `json:"planInfo"`
}

type cursorDashboardExchangeResponse struct {
	AccessToken string `json:"accessToken"`
}

type cursorDashboardExchangeError struct {
	StatusCode int
	Err        error
}

func (e *cursorDashboardExchangeError) Error() string {
	if e.StatusCode > 0 {
		return fmt.Sprintf("cursor api key exchange status %d", e.StatusCode)
	}
	return "cursor api key exchange failed: " + e.Err.Error()
}

func (e *cursorDashboardExchangeError) Unwrap() error {
	return e.Err
}

func GetCursorAgentChannelAccount(c *gin.Context) {
	channelID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, fmt.Errorf("invalid channel id: %w", err))
		return
	}

	channel, err := model.GetChannelById(channelID, true)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if channel == nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "channel not found"})
		return
	}
	if channel.Type != constant.ChannelTypeCursorAgent {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "channel type does not use Cursor SDK credentials"})
		return
	}
	if channel.ChannelInfo.IsMultiKey {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "multi-key channel is not supported"})
		return
	}

	credential, err := cursor_agent.ParseCredential(strings.TrimSpace(channel.Key))
	if err != nil {
		common.SysError("failed to parse cursor sdk credential: " + err.Error())
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "解析 Cursor SDK 凭证失败，请检查渠道配置"})
		return
	}

	client, err := service.NewProxyHttpClient(channel.GetSetting().Proxy)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 25*time.Second)
	defer cancel()

	payload, upstreamStatus, err := fetchCursorSDKAccount(ctx, client, channel, credential)
	if err != nil {
		common.SysError("failed to fetch cursor sdk account: " + err.Error())
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "获取 Cursor 帐号信息失败，请检查凭证或稍后重试"})
		return
	}

	quota, quotaErr := fetchCursorDashboardQuota(ctx, client, credential)
	if quotaErr != nil {
		common.SysError(fmt.Sprintf("failed to fetch cursor dashboard quota: channel_id=%d err=%s", channel.Id, quotaErr.Error()))
	}
	if available, _ := quota["available"].(bool); available {
		if remaining, ok := quota["remaining_usd"].(float64); ok {
			channel.UpdateBalance(remaining)
		}
	}
	payload["gateway"] = gin.H{
		"used_quota":        channel.UsedQuota,
		"balance_supported": quota["available"] == true,
	}
	payload["quota"] = quota
	c.JSON(http.StatusOK, gin.H{
		"success":         true,
		"message":         "",
		"upstream_status": upstreamStatus,
		"data":            payload,
	})
}

func fetchCursorSDKAccount(ctx context.Context, client *http.Client, channel *model.Channel, credential *cursor_agent.Credential) (map[string]any, int, error) {
	baseURL := cursor_agent.ResolveSidecarBaseURL(channel.GetBaseURL())
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, baseURL+"/v1/account", nil)
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("Authorization", "Bearer "+credential.APIKey)
	req.Header.Set("x-api-key", credential.APIKey)

	res, err := client.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer res.Body.Close()
	body, err := readCursorAccountBody(res.Body)
	if err != nil {
		return nil, res.StatusCode, err
	}
	if res.StatusCode < http.StatusOK || res.StatusCode >= http.StatusMultipleChoices {
		return nil, res.StatusCode, fmt.Errorf("cursor sdk account upstream status %d", res.StatusCode)
	}
	var payload map[string]any
	if err := common.Unmarshal(body, &payload); err != nil {
		return nil, res.StatusCode, fmt.Errorf("decode cursor sdk account: %w", err)
	}
	return payload, res.StatusCode, nil
}

func fetchCursorDashboardQuota(ctx context.Context, client *http.Client, credential *cursor_agent.Credential) (gin.H, error) {
	if credential == nil || strings.TrimSpace(credential.APIKey) == "" {
		return gin.H{"available": false, "source": "cursor_dashboard_rpc", "reason": "api_key_missing"}, nil
	}

	accessToken, err := exchangeCursorAPIKeyForAccessToken(ctx, client, credential.APIKey)
	if err != nil {
		return cursorDashboardExchangeFailure(err), err
	}
	statusCode, body, err := cursorDashboardPost(ctx, client, "GetCurrentPeriodUsage", accessToken)
	if err != nil {
		return gin.H{"available": false, "source": "cursor_dashboard_rpc", "reason": "dashboard_unreachable"}, err
	}
	if statusCode == http.StatusUnauthorized || statusCode == http.StatusForbidden {
		accessToken, err = exchangeCursorAPIKeyForAccessToken(ctx, client, credential.APIKey)
		if err != nil {
			return cursorDashboardExchangeFailure(err), err
		}
		statusCode, body, err = cursorDashboardPost(ctx, client, "GetCurrentPeriodUsage", accessToken)
		if err != nil {
			return gin.H{"available": false, "source": "cursor_dashboard_rpc", "reason": "dashboard_unreachable"}, err
		}
	}
	if statusCode < http.StatusOK || statusCode >= http.StatusMultipleChoices {
		return gin.H{"available": false, "source": "cursor_dashboard_rpc", "reason": "dashboard_rejected", "status": statusCode}, nil
	}

	var usage cursorDashboardPeriodUsage
	if err := common.Unmarshal(body, &usage); err != nil {
		return gin.H{"available": false, "source": "cursor_dashboard_rpc", "reason": "dashboard_invalid_response"}, err
	}
	plan := cursorDashboardPlanResponse{}
	if planStatus, planBody, planErr := cursorDashboardPost(ctx, client, "GetPlanInfo", accessToken); planErr == nil && planStatus >= 200 && planStatus < 300 {
		_ = common.Unmarshal(planBody, &plan)
	}

	usedCents := usage.PlanUsage.IncludedSpend
	if usedCents <= 0 && usage.PlanUsage.Limit > 0 {
		usedCents = usage.PlanUsage.Limit - usage.PlanUsage.Remaining
		if usedCents < 0 {
			usedCents = 0
		}
	}
	usedPercent := usage.PlanUsage.TotalPercentUsed
	if usage.PlanUsage.Limit > 0 {
		usedPercent = usedCents / usage.PlanUsage.Limit * 100
	}
	result := gin.H{
		"available":                   true,
		"source":                      "cursor_dashboard_rpc",
		"plan_name":                   strings.TrimSpace(plan.PlanInfo.PlanName),
		"plan_price":                  strings.TrimSpace(plan.PlanInfo.Price),
		"plan_owner":                  strings.TrimSpace(plan.PlanInfo.PlanOwner),
		"billing_cycle_start":         usage.BillingCycleStart,
		"billing_cycle_end":           usage.BillingCycleEnd,
		"used_usd":                    usedCents / 100,
		"total_spend_usd":             usage.PlanUsage.TotalSpend / 100,
		"remaining_usd":               usage.PlanUsage.Remaining / 100,
		"limit_usd":                   usage.PlanUsage.Limit / 100,
		"used_percent":                usedPercent,
		"cursor_models_percent_used":  usage.PlanUsage.TotalPercentUsed,
		"other_models_percent_used":   usage.PlanUsage.APIPercentUsed,
		"auto_models_percent_used":    usage.PlanUsage.AutoPercentUsed,
		"bonus_spend_usd":             usage.PlanUsage.BonusSpend / 100,
		"on_demand_spend_usd":         usage.SpendLimitUsage.TotalSpend / 100,
		"on_demand_limit_type":        strings.TrimSpace(usage.SpendLimitUsage.LimitType),
		"on_demand_individual_limit":  usage.SpendLimitUsage.IndividualLimit / 100,
		"on_demand_individual_used":   usage.SpendLimitUsage.IndividualUsed / 100,
		"on_demand_individual_remain": usage.SpendLimitUsage.IndividualRemaining / 100,
		"on_demand_pooled_limit":      usage.SpendLimitUsage.PooledLimit / 100,
		"on_demand_pooled_used":       usage.SpendLimitUsage.PooledUsed / 100,
		"on_demand_pooled_remain":     usage.SpendLimitUsage.PooledRemaining / 100,
	}
	return result, nil
}

func exchangeCursorAPIKeyForAccessToken(ctx context.Context, client *http.Client, apiKey string) (string, error) {
	apiKey = strings.TrimSpace(apiKey)
	if apiKey == "" {
		return "", errors.New("cursor api key is missing")
	}
	key := fmt.Sprintf("%x", sha256.Sum256([]byte(apiKey)))
	resultCh := cursorDashboardExchangeGroup.DoChan(key, func() (any, error) {
		exchangeCtx, cancel := context.WithTimeout(context.Background(), cursorDashboardExchangeTimeout)
		defer cancel()
		req, err := http.NewRequestWithContext(exchangeCtx, http.MethodPost, strings.TrimRight(cursorDashboardAPIBaseURL, "/")+"/auth/exchange_user_api_key", bytes.NewReader([]byte("{}")))
		if err != nil {
			return "", err
		}
		req.Header.Set("Authorization", "Bearer "+apiKey)
		req.Header.Set("Content-Type", "application/json")
		res, err := client.Do(req)
		if err != nil {
			return "", &cursorDashboardExchangeError{Err: err}
		}
		defer res.Body.Close()
		body, err := readCursorAccountBody(res.Body)
		if err != nil {
			return "", err
		}
		if res.StatusCode < http.StatusOK || res.StatusCode >= http.StatusMultipleChoices {
			return "", &cursorDashboardExchangeError{StatusCode: res.StatusCode, Err: errors.New("upstream rejected request")}
		}
		var exchanged cursorDashboardExchangeResponse
		if err := common.Unmarshal(body, &exchanged); err != nil {
			return "", &cursorDashboardExchangeError{StatusCode: res.StatusCode, Err: fmt.Errorf("decode response: %w", err)}
		}
		exchanged.AccessToken = strings.TrimSpace(exchanged.AccessToken)
		if exchanged.AccessToken == "" {
			return "", &cursorDashboardExchangeError{StatusCode: res.StatusCode, Err: errors.New("response contained an empty access token")}
		}
		return exchanged.AccessToken, nil
	})
	select {
	case <-ctx.Done():
		return "", ctx.Err()
	case result := <-resultCh:
		if result.Err != nil {
			return "", result.Err
		}
		return result.Val.(string), nil
	}
}

func cursorDashboardExchangeFailure(err error) gin.H {
	result := gin.H{"available": false, "source": "cursor_dashboard_rpc", "reason": "exchange_unavailable"}
	var exchangeErr *cursorDashboardExchangeError
	if !errors.As(err, &exchangeErr) {
		return result
	}
	if exchangeErr.StatusCode > 0 {
		result["status"] = exchangeErr.StatusCode
	}
	if exchangeErr.StatusCode == http.StatusUnauthorized || exchangeErr.StatusCode == http.StatusForbidden {
		result["reason"] = "api_key_invalid"
	}
	return result
}

func cursorDashboardPost(ctx context.Context, client *http.Client, method string, accessToken string) (int, []byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(cursorDashboardAPIBaseURL, "/")+"/aiserver.v1.DashboardService/"+method, bytes.NewReader([]byte("{}")))
	if err != nil {
		return 0, nil, err
	}
	req.Header.Set("Authorization", "Bearer "+strings.TrimSpace(accessToken))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Connect-Protocol-Version", "1")
	res, err := client.Do(req)
	if err != nil {
		return 0, nil, err
	}
	defer res.Body.Close()
	body, err := readCursorAccountBody(res.Body)
	return res.StatusCode, body, err
}

func readCursorAccountBody(reader io.Reader) ([]byte, error) {
	body, err := io.ReadAll(io.LimitReader(reader, cursorAgentAccountResponseLimit+1))
	if err != nil {
		return nil, err
	}
	if len(body) > cursorAgentAccountResponseLimit {
		return nil, errors.New("cursor account response too large")
	}
	return body, nil
}
