package controller

import (
	"context"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"encoding/json"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel/codex"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

type codexUsageFetchResult struct {
	Success        bool
	Message        string
	UpstreamStatus int
	Payload        any
	UsageValue     float64
}

type codexBulkUsageItem struct {
	ChannelID      int     `json:"channel_id"`
	ChannelName    string  `json:"channel_name"`
	ChannelStatus  int     `json:"channel_status"`
	Success        bool    `json:"success"`
	Message        string  `json:"message"`
	UpstreamStatus int     `json:"upstream_status"`
	UsageValue     float64 `json:"usage_value"`
	Data           any     `json:"data,omitempty"`
}

type codexBulkUsageSummary struct {
	Total    int `json:"total"`
	Success  int `json:"success"`
	Failed   int `json:"failed"`
	Finished int `json:"finished"`
}

func GetCodexChannelUsage(c *gin.Context) {
	channelId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, fmt.Errorf("invalid channel id: %w", err))
		return
	}

	ch, err := model.GetChannelById(channelId, true)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	result := fetchCodexChannelUsage(c.Request.Context(), ch)
	resp := gin.H{
		"success":         result.Success,
		"message":         result.Message,
		"upstream_status": result.UpstreamStatus,
		"data":            result.Payload,
	}
	c.JSON(http.StatusOK, resp)
}

func GetAllCodexChannelUsage(c *gin.Context) {
	var channels []*model.Channel
	err := model.DB.Where("type = ?", constant.ChannelTypeCodex).Order("id desc").Find(&channels).Error
	if err != nil {
		common.SysError("failed to get codex channels: " + err.Error())
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "获取 Codex 渠道失败，请稍后重试"})
		return
	}

	items := make([]codexBulkUsageItem, 0, len(channels))
	summary := codexBulkUsageSummary{Total: len(channels)}
	for _, ch := range channels {
		if ch == nil {
			continue
		}
		result := fetchCodexChannelUsage(c.Request.Context(), ch)
		item := codexBulkUsageItem{
			ChannelID:      ch.Id,
			ChannelName:    ch.Name,
			ChannelStatus:  ch.Status,
			Success:        result.Success,
			Message:        result.Message,
			UpstreamStatus: result.UpstreamStatus,
			UsageValue:     result.UsageValue,
			Data:           result.Payload,
		}
		items = append(items, item)
		summary.Finished++
		if item.Success {
			summary.Success++
		} else {
			summary.Failed++
		}
	}

	sortCodexBulkUsageItems(items)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"summary": summary,
		"data":    items,
	})
}

func sortCodexBulkUsageItems(items []codexBulkUsageItem) {
	sort.SliceStable(items, func(i, j int) bool {
		if items[i].UsageValue == items[j].UsageValue {
			return items[i].ChannelID < items[j].ChannelID
		}
		return items[i].UsageValue > items[j].UsageValue
	})
}

func fetchCodexChannelUsage(ctx context.Context, ch *model.Channel) codexUsageFetchResult {
	if ch == nil {
		return codexUsageFetchResult{Success: false, Message: "channel not found"}
	}
	if ch.Type != constant.ChannelTypeCodex {
		return codexUsageFetchResult{Success: false, Message: "channel type is not Codex"}
	}
	if ch.ChannelInfo.IsMultiKey {
		return codexUsageFetchResult{Success: false, Message: "multi-key channel is not supported"}
	}

	oauthKey, err := codex.ParseOAuthKey(strings.TrimSpace(ch.Key))
	if err != nil {
		common.SysError("failed to parse oauth key: " + err.Error())
		return codexUsageFetchResult{Success: false, Message: "解析凭证失败，请检查渠道配置"}
	}
	accessToken := strings.TrimSpace(oauthKey.AccessToken)
	accountID := strings.TrimSpace(oauthKey.AccountID)
	if accessToken == "" {
		return codexUsageFetchResult{Success: false, Message: "codex channel: access_token is required"}
	}
	if accountID == "" {
		return codexUsageFetchResult{Success: false, Message: "codex channel: account_id is required"}
	}

	client, err := service.NewProxyHttpClient(ch.GetSetting().Proxy)
	if err != nil {
		return codexUsageFetchResult{Success: false, Message: err.Error()}
	}

	statusCode, body, err := requestCodexUsageWithRefresh(ctx, client, ch, oauthKey, accountID)
	if err != nil {
		common.SysError("failed to fetch codex usage: " + err.Error())
		return codexUsageFetchResult{Success: false, Message: "获取用量信息失败，请稍后重试"}
	}

	var payload any
	if common.Unmarshal(body, &payload) != nil {
		payload = string(body)
	}

	ok := statusCode >= 200 && statusCode < 300
	message := ""
	if !ok {
		message = fmt.Sprintf("upstream status: %d", statusCode)
	}

	return codexUsageFetchResult{
		Success:        ok,
		Message:        message,
		UpstreamStatus: statusCode,
		Payload:        payload,
		UsageValue:     extractCodexUsageValue(payload),
	}
}

func requestCodexUsageWithRefresh(ctx context.Context, client *http.Client, ch *model.Channel, oauthKey *codex.OAuthKey, accountID string) (int, []byte, error) {
	requestCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()

	statusCode, body, err := service.FetchCodexWhamUsage(requestCtx, client, ch.GetBaseURL(), oauthKey.AccessToken, accountID)
	if err != nil {
		return 0, nil, err
	}

	if (statusCode == http.StatusUnauthorized || statusCode == http.StatusForbidden) && strings.TrimSpace(oauthKey.RefreshToken) != "" {
		refreshCtx, refreshCancel := context.WithTimeout(ctx, 10*time.Second)
		defer refreshCancel()

		res, refreshErr := service.RefreshCodexOAuthTokenWithProxy(refreshCtx, oauthKey.RefreshToken, ch.GetSetting().Proxy)
		if refreshErr == nil {
			oauthKey.AccessToken = res.AccessToken
			oauthKey.RefreshToken = res.RefreshToken
			oauthKey.LastRefresh = time.Now().Format(time.RFC3339)
			oauthKey.Expired = res.ExpiresAt.Format(time.RFC3339)
			if strings.TrimSpace(oauthKey.Type) == "" {
				oauthKey.Type = "codex"
			}

			encoded, encErr := common.Marshal(oauthKey)
			if encErr == nil {
				_ = model.DB.Model(&model.Channel{}).Where("id = ?", ch.Id).Update("key", string(encoded)).Error
				model.InitChannelCache()
				service.ResetProxyClientCache()
			}

			requestCtx2, cancel2 := context.WithTimeout(ctx, 15*time.Second)
			defer cancel2()
			statusCode, body, err = service.FetchCodexWhamUsage(requestCtx2, client, ch.GetBaseURL(), oauthKey.AccessToken, accountID)
			if err != nil {
				return 0, nil, err
			}
		}
	}

	return statusCode, body, nil
}

func extractCodexUsageValue(payload any) float64 {
	m, ok := payload.(map[string]any)
	if !ok {
		return 0
	}
	if v, ok := lookupFloat(m, "total_usage", "total", "used", "usage", "amount", "usd", "credits_used"); ok {
		return v
	}
	if rateLimit, ok := m["rate_limit"].(map[string]any); ok {
		maxVal := 0.0
		for _, key := range []string{"primary_window", "secondary_window"} {
			window, ok := rateLimit[key].(map[string]any)
			if !ok {
				continue
			}
			if v, ok := lookupFloat(window, "used_percent", "usage_percent", "percent", "used"); ok && v > maxVal {
				maxVal = v
			}
		}
		return maxVal
	}
	return 0
}

func lookupFloat(m map[string]any, keys ...string) (float64, bool) {
	for _, key := range keys {
		value, ok := m[key]
		if !ok {
			continue
		}
		switch v := value.(type) {
		case float64:
			return v, true
		case float32:
			return float64(v), true
		case int:
			return float64(v), true
		case int64:
			return float64(v), true
		case int32:
			return float64(v), true
		case json.Number:
			f, err := v.Float64()
			if err == nil {
				return f, true
			}
		case string:
			f, err := strconv.ParseFloat(strings.TrimSpace(v), 64)
			if err == nil {
				return f, true
			}
		}
	}
	return 0, false
}
