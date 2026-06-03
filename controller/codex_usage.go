package controller

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel/codex"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

const codexLimitReportRequestTimeout = 60 * time.Second

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
	if ch == nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "channel not found"})
		return
	}

	statusCode, body, err := fetchCodexChannelUsage(c.Request.Context(), ch)
	if err != nil {
		common.SysError("failed to fetch codex usage: " + err.Error())
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	var payload any
	if common.Unmarshal(body, &payload) != nil {
		payload = string(body)
	}

	ok := statusCode >= 200 && statusCode < 300
	resp := gin.H{
		"success":         ok,
		"message":         "",
		"upstream_status": statusCode,
		"data":            payload,
	}
	if !ok {
		resp["message"] = fmt.Sprintf("upstream status: %d", statusCode)
	}
	c.JSON(http.StatusOK, resp)
}

func GetCodexChannelLimitReport(c *gin.Context) {
	channels, err := model.GetAllChannelsByType(constant.ChannelTypeCodex, true)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	startTimestamp, endTimestamp := getCodexLimitReportRange(c)
	if ok, msg := validateTokenQuotaRange(startTimestamp, endTimestamp, tokenQuotaAdminMaxRangeSec); !ok {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": msg})
		return
	}

	channelIds := make([]int, 0, len(channels))
	for _, channel := range channels {
		if channel != nil {
			channelIds = append(channelIds, channel.Id)
		}
	}
	usageStats, err := model.GetCodexChannelUsageStats(
		channelIds,
		startTimestamp,
		endTimestamp,
	)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	reportCtx, cancel := newCodexLimitReportContext(c.Request.Context())
	defer cancel()
	report := runCodexLimitReport(
		reportCtx,
		channels,
		fetchCodexChannelUsageRefresh,
		usageStats,
		startTimestamp,
		endTimestamp,
	)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    report,
	})
}

// codexUsageRefreshFetcher fetches a channel's usage and reports whether its key
// was refreshed, without rebuilding the global channel cache itself.
type codexUsageRefreshFetcher func(ctx context.Context, channel *model.Channel) (int, []byte, bool, error)

// runCodexLimitReport builds the limit report while coalescing channel-cache
// rebuilds. Channels are fetched concurrently and each refreshed key would
// otherwise trigger its own full cache rebuild; instead the refresh signals are
// collected and the cache is rebuilt at most once after all fetches complete.
func runCodexLimitReport(
	ctx context.Context,
	channels []*model.Channel,
	refreshFetcher codexUsageRefreshFetcher,
	usageStats map[int]model.CodexChannelUsageStat,
	startTimestamp int64,
	endTimestamp int64,
) service.CodexLimitReport {
	var (
		refreshMu    sync.Mutex
		cacheRefresh bool
	)
	fetcher := service.CodexUsageFetcherFunc(func(ctx context.Context, channel *model.Channel) (int, []byte, error) {
		statusCode, body, refreshed, err := refreshFetcher(ctx, channel)
		if refreshed {
			refreshMu.Lock()
			cacheRefresh = true
			refreshMu.Unlock()
		}
		return statusCode, body, err
	})
	report := service.BuildCodexLimitReportWithUsage(
		ctx,
		channels,
		fetcher,
		usageStats,
		startTimestamp,
		endTimestamp,
	)
	if cacheRefresh {
		rebuildCodexChannelCache()
	}
	return report
}

func newCodexLimitReportContext(parent context.Context) (context.Context, context.CancelFunc) {
	return context.WithTimeout(parent, codexLimitReportRequestTimeout)
}

func getCodexLimitReportRange(c *gin.Context) (int64, int64) {
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	if startTimestamp > 0 && endTimestamp > 0 {
		return startTimestamp, endTimestamp
	}
	endTimestamp = common.GetTimestamp()
	startTimestamp = endTimestamp - 7*24*3600
	return startTimestamp, endTimestamp
}

// fetchCodexChannelUsage fetches a single channel's usage and rebuilds the
// global channel cache inline when the channel key was refreshed. Use this for
// single-channel callers; batch callers should use fetchCodexChannelUsageRefresh
// to coalesce cache rebuilds.
func fetchCodexChannelUsage(ctx context.Context, ch *model.Channel) (int, []byte, error) {
	statusCode, body, refreshed, err := fetchCodexChannelUsageRefresh(ctx, ch)
	if refreshed {
		rebuildCodexChannelCache()
	}
	return statusCode, body, err
}

// fetchCodexChannelUsageRefresh fetches a single channel's usage. When the
// channel key is refreshed it is persisted to the database and refreshed=true is
// returned, but the global channel cache is NOT rebuilt here. This lets batch
// callers (e.g. the limit report) collapse many concurrent refreshes into a
// single cache rebuild instead of triggering one full rebuild per channel.
func fetchCodexChannelUsageRefresh(ctx context.Context, ch *model.Channel) (int, []byte, bool, error) {
	if ch == nil {
		return 0, nil, false, errors.New("channel not found")
	}
	if ch.Type != constant.ChannelTypeCodex {
		return 0, nil, false, errors.New("channel type is not Codex")
	}
	if ch.ChannelInfo.IsMultiKey {
		return 0, nil, false, errors.New("multi-key channel is not supported")
	}

	oauthKey, err := codex.ParseOAuthKey(strings.TrimSpace(ch.Key))
	if err != nil {
		return 0, nil, false, err
	}
	accessToken := strings.TrimSpace(oauthKey.AccessToken)
	accountID := strings.TrimSpace(oauthKey.AccountID)
	if accessToken == "" {
		return 0, nil, false, errors.New("codex channel: access_token is required")
	}
	if accountID == "" {
		return 0, nil, false, errors.New("codex channel: account_id is required")
	}

	client, err := service.NewProxyHttpClient(ch.GetSetting().Proxy)
	if err != nil {
		return 0, nil, false, err
	}

	reqCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()

	statusCode, body, err := service.FetchCodexWhamUsage(reqCtx, client, ch.GetBaseURL(), accessToken, accountID)
	if err != nil {
		return statusCode, nil, false, err
	}

	refreshed := false
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
				if updateErr := model.UpdateChannelKey(ch.Id, string(encoded)); updateErr == nil {
					refreshed = true
				}
			}

			ctx2, cancel2 := context.WithTimeout(ctx, 15*time.Second)
			defer cancel2()
			statusCode, body, err = service.FetchCodexWhamUsage(ctx2, client, ch.GetBaseURL(), oauthKey.AccessToken, accountID)
			if err != nil {
				return statusCode, nil, refreshed, err
			}
		}
	}

	return statusCode, body, refreshed, nil
}

// rebuildCodexChannelCache reloads the global channel cache and resets cached
// proxy clients so refreshed channel keys take effect on other request paths.
// It is a variable so tests can observe how often the cache is rebuilt.
var rebuildCodexChannelCache = func() {
	model.InitChannelCache()
	service.ResetProxyClientCache()
}
