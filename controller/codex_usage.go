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
	"github.com/google/uuid"
)

const codexLimitReportRequestTimeout = 60 * time.Second
const maxCodexInviteRequestBodyBytes int64 = 8 << 10

type codexInviteRequest struct {
	Emails                    []string `json:"emails"`
	ConfirmedRecipientConsent bool     `json:"confirmed_recipient_consent"`
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

// codexChannelUpstreamWithRefresh runs an authenticated upstream call for a
// Codex channel, retrying once with a refreshed OAuth token on 401/403. It
// returns refreshed=true when the channel key was rotated and persisted (the
// caller is responsible for rebuilding the channel cache).
func codexChannelUpstreamWithRefresh(
	ctx context.Context,
	ch *model.Channel,
	do func(client *http.Client, accessToken, accountID string) (int, []byte, error),
) (int, []byte, bool, error) {
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

	statusCode, body, err := do(client, accessToken, accountID)
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
			// Persistence failure is non-fatal: the request still proceeds with the
			// refreshed in-memory token (favoring request success). But surface the
			// failure in logs — otherwise the DB/cache keeps the stale key and every
			// later request keeps 401/refresh churning silently.
			encoded, encErr := common.Marshal(oauthKey)
			if encErr != nil {
				common.SysError("codex channel " + strconv.Itoa(ch.Id) + ": failed to marshal refreshed key: " + encErr.Error())
			} else if updateErr := model.UpdateChannelKey(ch.Id, string(encoded)); updateErr != nil {
				common.SysError("codex channel " + strconv.Itoa(ch.Id) + ": failed to persist refreshed key: " + updateErr.Error())
			} else {
				refreshed = true
			}
			statusCode, body, err = do(client, oauthKey.AccessToken, accountID)
			if err != nil {
				return statusCode, nil, refreshed, err
			}
		}
	}

	return statusCode, body, refreshed, nil
}

// fetchCodexChannelUsageRefresh fetches a single channel's usage. When the
// channel key is refreshed it is persisted to the database and refreshed=true is
// returned, but the global channel cache is NOT rebuilt here. This lets batch
// callers (e.g. the limit report) collapse many concurrent refreshes into a
// single cache rebuild instead of triggering one full rebuild per channel.
func fetchCodexChannelUsageRefresh(ctx context.Context, ch *model.Channel) (int, []byte, bool, error) {
	return codexChannelUpstreamWithRefresh(ctx, ch, func(client *http.Client, accessToken, accountID string) (int, []byte, error) {
		reqCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
		defer cancel()
		return service.FetchCodexWhamUsage(reqCtx, client, ch.GetBaseURL(), accessToken, accountID)
	})
}

// ConsumeCodexResetCredit redeems one rate-limit reset credit for a single
// Codex channel, retrying once with a refreshed OAuth token on 401/403, and
// returns the upstream response transparently to the admin caller.
func ConsumeCodexResetCredit(c *gin.Context) {
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

	// Generate the idempotency key ONCE so the 401/403 refresh-retry inside the
	// wrapper reuses the same redeem_request_id and the upstream can dedupe the
	// "debited-then-401" round-trip instead of spending a second credit.
	redeemRequestID := uuid.NewString()
	statusCode, body, refreshed, err := codexChannelUpstreamWithRefresh(
		c.Request.Context(), ch,
		func(client *http.Client, accessToken, accountID string) (int, []byte, error) {
			reqCtx, cancel := context.WithTimeout(c.Request.Context(), 20*time.Second)
			defer cancel()
			return service.ConsumeCodexResetCredit(reqCtx, client, ch.GetBaseURL(), accessToken, accountID, redeemRequestID)
		},
	)
	if refreshed {
		rebuildCodexChannelCache()
	}
	if err != nil {
		common.SysError("failed to consume codex reset credit: " + err.Error())
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

func GetCodexInviteStatus(c *gin.Context) {
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

	statusCode, body, refreshed, err := codexChannelUpstreamWithRefresh(
		c.Request.Context(), ch,
		func(client *http.Client, accessToken, accountID string) (int, []byte, error) {
			reqCtx, cancel := context.WithTimeout(c.Request.Context(), 20*time.Second)
			defer cancel()
			return service.FetchCodexInviteStatus(reqCtx, client, ch.GetBaseURL(), accessToken, accountID)
		},
	)
	if refreshed {
		rebuildCodexChannelCache()
	}
	writeCodexUpstreamResponse(c, "failed to fetch codex invite status: ", statusCode, body, err)
}

func SendCodexInvite(c *gin.Context) {
	channelId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, fmt.Errorf("invalid channel id: %w", err))
		return
	}

	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxCodexInviteRequestBodyBytes)
	var req codexInviteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	normalizedEmails, err := service.NormalizeCodexInviteEmails(req.Emails)
	if err != nil {
		common.ApiError(c, err)
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

	statusCode, statusBody, refreshed, err := codexChannelUpstreamWithRefresh(
		c.Request.Context(), ch,
		func(client *http.Client, accessToken, accountID string) (int, []byte, error) {
			statusCtx, statusCancel := context.WithTimeout(c.Request.Context(), 20*time.Second)
			statusCode, statusBody, err := service.FetchCodexInviteStatus(statusCtx, client, ch.GetBaseURL(), accessToken, accountID)
			statusCancel()
			if err != nil || statusCode < http.StatusOK || statusCode >= http.StatusMultipleChoices {
				return statusCode, statusBody, err
			}
			if err := ensureCodexInviteRecipientConsent(statusBody, req.ConfirmedRecipientConsent); err != nil {
				payload, marshalErr := common.Marshal(gin.H{"message": err.Error()})
				if marshalErr != nil {
					return 0, nil, marshalErr
				}
				return http.StatusBadRequest, payload, nil
			}
			return http.StatusOK, statusBody, nil
		},
	)
	if refreshed {
		rebuildCodexChannelCache()
	}
	if err != nil {
		common.SysError("failed to fetch codex invite status: " + err.Error())
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	if statusCode < http.StatusOK || statusCode >= http.StatusMultipleChoices {
		writeCodexUpstreamResponse(c, "failed to prepare codex invite send: ", statusCode, statusBody, nil)
		return
	}
	if refreshed {
		ch, err = model.GetChannelById(channelId, true)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		if ch == nil {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": "channel not found"})
			return
		}
	}

	sendClient, err := service.NewProxyHttpClient(ch.GetSetting().Proxy)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	oauthKey, err := codex.ParseOAuthKey(strings.TrimSpace(ch.Key))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	sendCtx, sendCancel := context.WithTimeout(c.Request.Context(), 20*time.Second)
	defer sendCancel()
	statusCode, body, err := service.SendCodexInvite(sendCtx, sendClient, ch.GetBaseURL(), strings.TrimSpace(oauthKey.AccessToken), strings.TrimSpace(oauthKey.AccountID), normalizedEmails)
	if err != nil {
		common.SysError("failed to send codex invite: " + err.Error())
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	ok := statusCode >= http.StatusOK && statusCode < http.StatusMultipleChoices
	var payload any
	if common.Unmarshal(body, &payload) != nil {
		payload = string(body)
	}
	c.JSON(http.StatusOK, gin.H{
		"success":         ok,
		"message":         "",
		"upstream_status": statusCode,
		"data":            payload,
	})
}

func ensureCodexInviteRecipientConsent(statusBody []byte, confirmed bool) error {
	requiresConsent, err := service.CodexInviteRequiresRecipientConsent(statusBody)
	if err != nil {
		return fmt.Errorf("failed to parse codex invite status: %w", err)
	}
	if requiresConsent && !confirmed {
		return fmt.Errorf("recipient consent confirmation is required before sending Codex invites")
	}
	return nil
}

func writeCodexUpstreamResponse(c *gin.Context, logPrefix string, statusCode int, body []byte, err error) {
	if err != nil {
		common.SysError(logPrefix + err.Error())
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

// rebuildCodexChannelCache reloads the global channel cache and resets cached
// proxy clients so refreshed channel keys take effect on other request paths.
// It is a variable so tests can observe how often the cache is rebuilt.
var rebuildCodexChannelCache = func() {
	model.InitChannelCache()
	service.ResetProxyClientCache()
}
