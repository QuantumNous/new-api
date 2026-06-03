package service

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/QuantumNous/new-api/types"
)

type DingTalkChannelAlert struct {
	ChannelID       int
	ChannelName     string
	ChannelTypeName string
	Error           *types.NewAPIError
	AutoDisabled    bool
	Now             time.Time
}

type DingTalkAlertCooldown struct {
	mu     sync.Mutex
	lastAt map[int]time.Time
}

type dingTalkAlertCooldownReservation struct {
	c             *DingTalkAlertCooldown
	channelID     int
	reservedAt    time.Time
	previousAt    time.Time
	hadPrevious   bool
	dbReservation *model.DingTalkAlertCooldownReservation
}

type dingTalkSendResponse struct {
	ErrCode *int   `json:"errcode"`
	ErrMsg  string `json:"errmsg"`
}

var (
	dingTalkAlertCooldown              = NewDingTalkAlertCooldown()
	dingTalkCredentialPattern          = regexp.MustCompile(`(?i)(\b(?:access_token|refresh_token|id_token|api[_-]?key|authorization)\b\s*(?::|=)?\s*)(?:"[^"]*"|'[^']*'|bearer\s+[^\s,;}]+|[^\s,;}]+)`)
	dingTalkQuotedCredentialPattern    = regexp.MustCompile(`(?i)(["'](?:access_token|refresh_token|id_token|api[_-]?key|authorization)["']\s*:\s*)(?:"[^"]*"|'[^']*'|[^,\s}]+)`)
	dingTalkSKPattern                  = regexp.MustCompile(`sk-[A-Za-z0-9_-]+`)
	dingTalkAWSKeyPattern              = regexp.MustCompile(`\b(?:AKIA|ASIA)[A-Z0-9]{16}\b`)
	dingTalkGoogleAPIKeyPattern        = regexp.MustCompile(`\bAIza[0-9A-Za-z_-]{35}\b`)
	dingTalkMaxResponseBodyBytes       = int64(64 * 1024)
	dingTalkRequestTimeout             = 10 * time.Second
	dingTalkAlertPendingReservationTTL = 2 * dingTalkRequestTimeout
)

const maxDingTalkChannelAlertBatchSize = 5

func NewDingTalkAlertCooldown() *DingTalkAlertCooldown {
	return &DingTalkAlertCooldown{lastAt: make(map[int]time.Time)}
}

func (c *DingTalkAlertCooldown) Allow(channelID int, now time.Time, cooldown time.Duration) bool {
	if c == nil || cooldown <= 0 {
		return true
	}
	c.mu.Lock()
	defer c.mu.Unlock()

	last, ok := c.lastAt[channelID]
	if ok && now.Sub(last) < cooldown {
		return false
	}
	c.lastAt[channelID] = now
	return true
}

func (c *DingTalkAlertCooldown) reserve(channelID int, now time.Time, cooldown time.Duration) (*dingTalkAlertCooldownReservation, bool) {
	if c == nil || cooldown <= 0 {
		return nil, true
	}
	c.mu.Lock()
	defer c.mu.Unlock()

	last, ok := c.lastAt[channelID]
	if ok && now.Sub(last) < cooldown {
		return nil, false
	}
	c.lastAt[channelID] = now
	return &dingTalkAlertCooldownReservation{
		c:           c,
		channelID:   channelID,
		reservedAt:  now,
		previousAt:  last,
		hadPrevious: ok,
	}, true
}

func (r *dingTalkAlertCooldownReservation) Rollback() {
	if r == nil {
		return
	}
	if r.dbReservation != nil {
		if err := model.RollbackDingTalkAlertCooldown(r.dbReservation); err != nil {
			common.SysError("failed to rollback dingtalk alert cooldown reservation: " + err.Error())
		}
		return
	}
	if r.c == nil {
		return
	}
	r.c.mu.Lock()
	defer r.c.mu.Unlock()

	current, ok := r.c.lastAt[r.channelID]
	if !ok || !current.Equal(r.reservedAt) {
		return
	}
	if r.hadPrevious {
		r.c.lastAt[r.channelID] = r.previousAt
		return
	}
	delete(r.c.lastAt, r.channelID)
}

func (r *dingTalkAlertCooldownReservation) Commit() error {
	if r == nil || r.dbReservation == nil {
		return nil
	}
	return model.CommitDingTalkAlertCooldown(r.dbReservation)
}

func reserveDingTalkAlertCooldown(channelID int, now time.Time, cooldown time.Duration) (*dingTalkAlertCooldownReservation, bool) {
	if model.DB == nil {
		return dingTalkAlertCooldown.reserve(channelID, now, cooldown)
	}
	reservationToken, err := common.GenerateRandomCharsKey(32)
	if err != nil {
		common.SysError("failed to generate dingtalk alert cooldown reservation token: " + err.Error())
		return nil, false
	}
	dbReservation, allowed, err := model.ReserveDingTalkAlertCooldown(channelID, cooldown, dingTalkAlertPendingReservationTTL, reservationToken)
	if err != nil {
		common.SysError("failed to reserve dingtalk alert cooldown in database: " + err.Error())
		return dingTalkAlertCooldown.reserve(channelID, now, cooldown)
	}
	if !allowed || dbReservation == nil {
		return nil, allowed
	}
	return &dingTalkAlertCooldownReservation{
		channelID:     channelID,
		dbReservation: dbReservation,
	}, true
}

func BuildDingTalkChannelAlertContent(alert DingTalkChannelAlert) string {
	now := alert.Now
	if now.IsZero() {
		now = time.Now()
	}

	statusCode := 0
	errorCode := ""
	message := ""
	if alert.Error != nil {
		statusCode = alert.Error.StatusCode
		errorCode = string(alert.Error.GetErrorCode())
		message = alert.Error.MaskSensitiveErrorWithStatusCode()
	}
	message = sanitizeDingTalkAlertText(message)
	if message == "" {
		message = "unknown error"
	}

	autoDisabled := "no"
	if alert.AutoDisabled {
		autoDisabled = "yes"
	}

	return strings.Join([]string{
		"New API channel test failed",
		fmt.Sprintf("Channel ID: %d", alert.ChannelID),
		fmt.Sprintf("Channel Name: %s", sanitizeDingTalkAlertText(alert.ChannelName)),
		fmt.Sprintf("Channel Type: %s", sanitizeDingTalkAlertText(alert.ChannelTypeName)),
		fmt.Sprintf("Error: %s", message),
		fmt.Sprintf("Status Code: %d", statusCode),
		fmt.Sprintf("Error Code: %s", errorCode),
		fmt.Sprintf("Auto Disabled: %s", autoDisabled),
		fmt.Sprintf("Time: %s", now.Format("2006-01-02 15:04:05")),
	}, "\n")
}

func BuildDingTalkChannelAlertBatchContent(alerts []DingTalkChannelAlert) string {
	if len(alerts) == 1 {
		return BuildDingTalkChannelAlertContent(alerts[0])
	}

	blocks := []string{
		"New API channel test failures",
		fmt.Sprintf("Total Failures: %d", len(alerts)),
	}
	for index, alert := range alerts {
		blocks = append(blocks, fmt.Sprintf("Failure #%d", index+1))
		blocks = append(blocks, BuildDingTalkChannelAlertContent(alert))
	}
	return strings.Join(blocks, "\n\n")
}

func sanitizeDingTalkAlertText(value string) string {
	value = common.MaskSensitiveInfo(value)
	value = dingTalkQuotedCredentialPattern.ReplaceAllString(value, `${1}"***"`)
	value = dingTalkCredentialPattern.ReplaceAllString(value, `${1}***`)
	value = dingTalkSKPattern.ReplaceAllString(value, "sk-***")
	value = dingTalkAWSKeyPattern.ReplaceAllString(value, "aws-***")
	value = dingTalkGoogleAPIKeyPattern.ReplaceAllString(value, "AIza***")
	return value
}

func BuildDingTalkWebhookURL(webhookURL string, secret string, now time.Time) (string, error) {
	webhookURL = strings.TrimSpace(webhookURL)
	if webhookURL == "" {
		return "", fmt.Errorf("dingtalk webhook url is empty")
	}
	u, err := url.Parse(webhookURL)
	if err != nil {
		return "", fmt.Errorf("invalid dingtalk webhook url: %s", sanitizeDingTalkAlertText(err.Error()))
	}
	secret = strings.TrimSpace(secret)
	if secret == "" {
		return u.String(), nil
	}

	timestamp := fmt.Sprintf("%d", now.UnixMilli())
	stringToSign := timestamp + "\n" + secret
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(stringToSign))
	sign := base64.StdEncoding.EncodeToString(mac.Sum(nil))

	query := u.Query()
	query.Set("timestamp", timestamp)
	query.Set("sign", sign)
	u.RawQuery = query.Encode()
	return u.String(), nil
}

func SendDingTalkText(webhookURL string, secret string, content string) error {
	finalURL, err := BuildDingTalkWebhookURL(webhookURL, secret, time.Now())
	if err != nil {
		return fmt.Errorf("failed to build dingtalk webhook url: %s", sanitizeDingTalkAlertText(err.Error()))
	}

	payload := map[string]any{
		"msgtype": "text",
		"text": map[string]string{
			"content": content,
		},
	}
	payloadBytes, err := common.Marshal(payload)
	if err != nil {
		return err
	}

	fetchSetting := system_setting.GetFetchSetting()
	if err := common.ValidateURLWithFetchSetting(finalURL, fetchSetting.EnableSSRFProtection, fetchSetting.AllowPrivateIp, fetchSetting.DomainFilterMode, fetchSetting.IpFilterMode, fetchSetting.DomainList, fetchSetting.IpList, fetchSetting.AllowedPorts, fetchSetting.ApplyIPFilterForDomain); err != nil {
		return fmt.Errorf("request reject: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), dingTalkRequestTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, finalURL, bytes.NewBuffer(payloadBytes))
	if err != nil {
		return fmt.Errorf("failed to create dingtalk request: %s", sanitizeDingTalkAlertText(err.Error()))
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "NewAPI-DingTalk-Alert/1.0")

	client := GetHttpClient()
	if client == nil {
		client = http.DefaultClient
	}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("dingtalk request failed: %s", sanitizeDingTalkAlertText(err.Error()))
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("dingtalk request failed with status code: %d", resp.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, dingTalkMaxResponseBodyBytes))
	if err != nil {
		return err
	}
	body = bytes.TrimSpace(body)
	if len(body) == 0 {
		return fmt.Errorf("dingtalk request returned empty response")
	}
	var sendResponse dingTalkSendResponse
	if err := common.Unmarshal(body, &sendResponse); err != nil {
		return fmt.Errorf("dingtalk request returned invalid response: %v", err)
	}
	if sendResponse.ErrCode == nil {
		return fmt.Errorf("dingtalk request returned missing errcode")
	}
	if *sendResponse.ErrCode != 0 {
		return fmt.Errorf("dingtalk request failed: errcode=%d errmsg=%s", *sendResponse.ErrCode, sendResponse.ErrMsg)
	}
	return nil
}

func NotifyDingTalkChannelTestFailure(alert DingTalkChannelAlert) error {
	return NotifyDingTalkChannelTestFailures([]DingTalkChannelAlert{alert})
}

func NotifyDingTalkChannelTestFailures(alerts []DingTalkChannelAlert) error {
	if len(alerts) == 0 {
		return nil
	}
	setting := operation_setting.GetMonitorSetting()
	if setting == nil || !setting.DingTalkAlertEnabled {
		return nil
	}
	if strings.TrimSpace(setting.DingTalkAlertWebhookURL) == "" {
		return fmt.Errorf("dingtalk alert webhook url is empty")
	}

	cooldownMinutes := setting.DingTalkAlertCooldownMinutes
	if cooldownMinutes <= 0 {
		cooldownMinutes = 60
	}
	cooldown := time.Duration(cooldownMinutes) * time.Minute
	reservations := make([]*dingTalkAlertCooldownReservation, 0, len(alerts))
	sendableAlerts := make([]DingTalkChannelAlert, 0, len(alerts))
	for _, alert := range alerts {
		now := alert.Now
		if now.IsZero() {
			now = time.Now()
			alert.Now = now
		}
		reservation, allowed := reserveDingTalkAlertCooldown(alert.ChannelID, now, cooldown)
		if !allowed {
			continue
		}
		reservations = append(reservations, reservation)
		sendableAlerts = append(sendableAlerts, alert)
		if len(sendableAlerts) == maxDingTalkChannelAlertBatchSize {
			if err := sendReservedDingTalkChannelAlertBatch(setting, reservations, sendableAlerts); err != nil {
				return err
			}
			reservations = reservations[:0]
			sendableAlerts = sendableAlerts[:0]
		}
	}

	return sendReservedDingTalkChannelAlertBatch(setting, reservations, sendableAlerts)
}

func sendReservedDingTalkChannelAlertBatch(setting *operation_setting.MonitorSetting, reservations []*dingTalkAlertCooldownReservation, alerts []DingTalkChannelAlert) error {
	if len(alerts) == 0 {
		return nil
	}
	if err := SendDingTalkText(
		setting.DingTalkAlertWebhookURL,
		setting.DingTalkAlertSecret,
		BuildDingTalkChannelAlertBatchContent(alerts),
	); err != nil {
		for _, reservation := range reservations {
			reservation.Rollback()
		}
		return err
	}
	for _, reservation := range reservations {
		if err := reservation.Commit(); err != nil {
			return err
		}
	}
	return nil
}
