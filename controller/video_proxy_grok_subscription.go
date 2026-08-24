package controller

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	taskgroksubscription "github.com/QuantumNous/new-api/relay/channel/task/groksubscription"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/gin-gonic/gin"
)

const grokSubscriptionPollResponseMaxBytes = 1 << 20

var (
	grokSubscriptionVideoProxyHTTPClient = service.GetHttpClientWithProxy
	grokSubscriptionVideoProxyPoll       = pollGrokSubscriptionVideoResult
	grokSubscriptionVideoProxyValidate   = validateGrokSubscriptionVideoURL
)

func setGrokSubscriptionVideoProxyHTTPClientForTest(fn func(string) (*http.Client, error)) func() {
	original := grokSubscriptionVideoProxyHTTPClient
	grokSubscriptionVideoProxyHTTPClient = fn
	return func() { grokSubscriptionVideoProxyHTTPClient = original }
}

func setGrokSubscriptionVideoProxyPollForTest(fn func(context.Context, *model.Channel, *model.Task, string) (*relaycommon.TaskInfo, error)) func() {
	original := grokSubscriptionVideoProxyPoll
	grokSubscriptionVideoProxyPoll = fn
	return func() { grokSubscriptionVideoProxyPoll = original }
}

func setGrokSubscriptionVideoProxyValidateForTest(fn func(string) error) func() {
	original := grokSubscriptionVideoProxyValidate
	grokSubscriptionVideoProxyValidate = fn
	return func() { grokSubscriptionVideoProxyValidate = original }
}

func proxyGrokSubscriptionVideoContent(c *gin.Context, task *model.Task, channel *model.Channel) {
	if task == nil || channel == nil || channel.Type != constant.ChannelTypeGrokSubscription {
		videoProxyGenericFailure(c)
		return
	}
	proxy := channel.GetSetting().Proxy
	prior := model.CloneGrokSubscriptionVideoResult(task.PrivateData.GrokVideoResult)
	rangeValue := strings.TrimSpace(c.Request.Header.Get("Range"))
	ifRangeValue := strings.TrimSpace(c.Request.Header.Get("If-Range"))
	resp, err := fetchGrokSubscriptionVideo(c.Request.Context(), prior, proxy, rangeValue, ifRangeValue)
	if err == nil && isGrokSubscriptionVideoSuccessStatus(resp) {
		streamGrokSubscriptionVideoResponse(c, resp)
		return
	}
	closeGrokVideoResponse(resp)
	if !isGrokSubscriptionRefreshableStatus(resp) {
		logGrokSubscriptionProxyFailure(c.Request.Context(), task, channel, "initial_fetch", statusCodeOf(resp))
		videoProxyGenericFailure(c)
		return
	}

	refreshed, err := refreshGrokSubscriptionVideoURL(c.Request.Context(), task, channel, proxy, prior)
	if err != nil {
		logGrokSubscriptionProxyFailure(c.Request.Context(), task, channel, "refresh", 0)
		videoProxyGenericFailure(c)
		return
	}
	resp, err = fetchGrokSubscriptionVideo(c.Request.Context(), refreshed, proxy, rangeValue, ifRangeValue)
	if err != nil || !isGrokSubscriptionVideoSuccessStatus(resp) {
		closeGrokVideoResponse(resp)
		logGrokSubscriptionProxyFailure(c.Request.Context(), task, channel, "refetch", statusCodeOf(resp))
		videoProxyGenericFailure(c)
		return
	}
	streamGrokSubscriptionVideoResponse(c, resp)
}

func fetchGrokSubscriptionVideo(ctx context.Context, result *model.GrokSubscriptionVideoResult, proxy, rangeValue, ifRangeValue string) (*http.Response, error) {
	if result == nil {
		return nil, errors.New("missing video result")
	}
	videoURL := strings.TrimSpace(result.URL)
	if err := grokSubscriptionVideoProxyValidate(videoURL); err != nil {
		return nil, err
	}
	parsed, err := url.Parse(videoURL)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return nil, errors.New("invalid video url")
	}
	client, err := grokSubscriptionVideoProxyHTTPClient(proxy)
	if err != nil {
		return nil, err
	}
	clientCopy := *client
	clientCopy.CheckRedirect = func(*http.Request, []*http.Request) error {
		return http.ErrUseLastResponse
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, videoURL, nil)
	if err != nil {
		return nil, err
	}
	if rangeValue != "" {
		req.Header.Set("Range", rangeValue)
	}
	if ifRangeValue != "" {
		req.Header.Set("If-Range", ifRangeValue)
	}
	return clientCopy.Do(req)
}

func validateGrokSubscriptionVideoURL(raw string) error {
	trimmed := strings.TrimSpace(raw)
	parsed, err := url.Parse(trimmed)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return errors.New("invalid video url")
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return errors.New("invalid video url")
	}
	fetchSetting := system_setting.GetFetchSetting()
	return common.ValidateURLWithFetchSetting(trimmed, fetchSetting.EnableSSRFProtection, fetchSetting.AllowPrivateIp, fetchSetting.DomainFilterMode, fetchSetting.IpFilterMode, fetchSetting.DomainList, fetchSetting.IpList, fetchSetting.AllowedPorts, fetchSetting.ApplyIPFilterForDomain)
}

func refreshGrokSubscriptionVideoURL(ctx context.Context, task *model.Task, channel *model.Channel, proxy string, prior *model.GrokSubscriptionVideoResult) (*model.GrokSubscriptionVideoResult, error) {
	info, err := grokSubscriptionVideoProxyPoll(ctx, channel, task, proxy)
	if err != nil {
		return nil, err
	}
	if info == nil || info.Status != string(model.TaskStatusSuccess) || strings.TrimSpace(info.Url) == "" {
		return nil, errors.New("refresh failed")
	}
	if strings.TrimSpace(info.TaskID) != "" && strings.TrimSpace(info.TaskID) != task.GetUpstreamTaskID() {
		return nil, errors.New("refresh task mismatch")
	}
	next := &model.GrokSubscriptionVideoResult{
		URL:         strings.TrimSpace(info.Url),
		Duration:    info.Duration,
		Resolution:  strings.TrimSpace(info.Resolution),
		RefreshedAt: time.Now().Unix(),
	}
	if err := grokSubscriptionVideoProxyValidate(next.URL); err != nil {
		return nil, err
	}
	won, err := model.UpdateGrokSubscriptionVideoResultCAS(task.TaskID, task.GetUpstreamTaskID(), prior, next, next.RefreshedAt)
	if err != nil {
		return nil, err
	}
	if won {
		return next, nil
	}
	reloaded, exists, err := model.GetByOnlyTaskId(task.TaskID)
	if err != nil || !exists || reloaded == nil {
		return nil, fmt.Errorf("reload refreshed task: %w", err)
	}
	if reloaded.Status != model.TaskStatusSuccess ||
		reloaded.ChannelId != task.ChannelId ||
		reloaded.Platform != constant.TaskPlatform("113") ||
		reloaded.GetUpstreamTaskID() != task.GetUpstreamTaskID() ||
		reloaded.PrivateData.GrokVideoResult == nil {
		return nil, errors.New("winner mismatch")
	}
	winner := model.CloneGrokSubscriptionVideoResult(reloaded.PrivateData.GrokVideoResult)
	if err := grokSubscriptionVideoProxyValidate(winner.URL); err != nil {
		return nil, err
	}
	return winner, nil
}

func pollGrokSubscriptionVideoResult(ctx context.Context, channel *model.Channel, task *model.Task, proxy string) (*relaycommon.TaskInfo, error) {
	adaptor := &taskgroksubscription.TaskAdaptor{}
	pollCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	resp, err := adaptor.FetchTaskWithContext(pollCtx, "", "", map[string]any{
		"task_id":    task.GetUpstreamTaskID(),
		"action":     task.Action,
		"channel_id": channel.Id,
	}, proxy)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("poll status %d", resp.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, grokSubscriptionPollResponseMaxBytes+1))
	if err != nil {
		return nil, err
	}
	if len(body) > grokSubscriptionPollResponseMaxBytes {
		return nil, errors.New("poll response too large")
	}
	return adaptor.ParseTaskResult(body)
}

func streamGrokSubscriptionVideoResponse(c *gin.Context, resp *http.Response) {
	defer resp.Body.Close()
	for key, values := range resp.Header {
		if !shouldProxyVideoHeader(key) {
			continue
		}
		for _, value := range values {
			c.Writer.Header().Add(key, value)
		}
	}
	c.Writer.Header().Set("Cache-Control", "public, max-age=86400")
	c.Writer.WriteHeader(resp.StatusCode)
	if _, err := io.Copy(c.Writer, resp.Body); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Grok subscription video stream failed: task_id=%s channel_id=%d phase=stream", c.Param("task_id"), constant.ChannelTypeGrokSubscription))
	}
}

func isGrokSubscriptionRefreshableStatus(resp *http.Response) bool {
	if resp == nil {
		return false
	}
	switch resp.StatusCode {
	case http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusGone:
		return true
	default:
		return false
	}
}

func statusCodeOf(resp *http.Response) int {
	if resp == nil {
		return 0
	}
	return resp.StatusCode
}

func closeGrokVideoResponse(resp *http.Response) {
	if resp != nil && resp.Body != nil {
		_, _ = io.CopyN(io.Discard, resp.Body, grokSubscriptionPollResponseMaxBytes)
		_ = resp.Body.Close()
	}
}

func isGrokSubscriptionVideoSuccessStatus(resp *http.Response) bool {
	if resp == nil {
		return false
	}
	switch resp.StatusCode {
	case http.StatusOK, http.StatusPartialContent:
		return true
	default:
		return false
	}
}

func logGrokSubscriptionProxyFailure(ctx context.Context, task *model.Task, channel *model.Channel, phase string, status int) {
	taskID := ""
	channelID := 0
	if task != nil {
		taskID = task.TaskID
	}
	if channel != nil {
		channelID = channel.Id
	}
	logger.LogWarn(ctx, fmt.Sprintf("video content proxy failed: task_id=%s channel_id=%d phase=%s status=%d", taskID, channelID, phase, status))
}

func videoProxyGenericFailure(c *gin.Context) {
	videoProxyError(c, http.StatusBadGateway, "server_error", "Failed to fetch video content")
}
