package service

import (
	"bytes"
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
	c           *DingTalkAlertCooldown
	channelID   int
	reservedAt  time.Time
	previousAt  time.Time
	hadPrevious bool
}

type dingTalkSendResponse struct {
	ErrCode *int   `json:"errcode"`
	ErrMsg  string `json:"errmsg"`
}

var (
	dingTalkAlertCooldown        = NewDingTalkAlertCooldown()
	dingTalkSecretPattern        = regexp.MustCompile(`(?i)\b(access_token|refresh_token|id_token|api[_-]?key|authorization)\b\s*(?::|=)?\s*[^,\s]+`)
	dingTalkSKPattern            = regexp.MustCompile(`sk-[A-Za-z0-9_-]+`)
	dingTalkMaxResponseBodyBytes = int64(64 * 1024)
)

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
	if r == nil || r.c == nil {
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
		fmt.Sprintf("Channel Name: %s", alert.ChannelName),
		fmt.Sprintf("Channel Type: %s", alert.ChannelTypeName),
		fmt.Sprintf("Error: %s", message),
		fmt.Sprintf("Status Code: %d", statusCode),
		fmt.Sprintf("Error Code: %s", errorCode),
		fmt.Sprintf("Auto Disabled: %s", autoDisabled),
		fmt.Sprintf("Time: %s", now.Format("2006-01-02 15:04:05")),
	}, "\n")
}

func sanitizeDingTalkAlertText(value string) string {
	value = common.MaskSensitiveInfo(value)
	value = dingTalkSecretPattern.ReplaceAllString(value, "$1:***")
	value = dingTalkSKPattern.ReplaceAllString(value, "sk-***")
	return value
}

func BuildDingTalkWebhookURL(webhookURL string, secret string, now time.Time) (string, error) {
	webhookURL = strings.TrimSpace(webhookURL)
	if webhookURL == "" {
		return "", fmt.Errorf("dingtalk webhook url is empty")
	}
	u, err := url.Parse(webhookURL)
	if err != nil {
		return "", err
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
		return err
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

	req, err := http.NewRequest(http.MethodPost, finalURL, bytes.NewBuffer(payloadBytes))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "NewAPI-DingTalk-Alert/1.0")

	client := GetHttpClient()
	if client == nil {
		client = http.DefaultClient
	}
	resp, err := client.Do(req)
	if err != nil {
		return err
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
	setting := operation_setting.GetMonitorSetting()
	if setting == nil || !setting.DingTalkAlertEnabled {
		return nil
	}
	if strings.TrimSpace(setting.DingTalkAlertWebhookURL) == "" {
		return fmt.Errorf("dingtalk alert webhook url is empty")
	}

	now := alert.Now
	if now.IsZero() {
		now = time.Now()
		alert.Now = now
	}
	cooldownMinutes := setting.DingTalkAlertCooldownMinutes
	if cooldownMinutes <= 0 {
		cooldownMinutes = 60
	}
	reservation, allowed := dingTalkAlertCooldown.reserve(alert.ChannelID, now, time.Duration(cooldownMinutes)*time.Minute)
	if !allowed {
		return nil
	}

	if err := SendDingTalkText(
		setting.DingTalkAlertWebhookURL,
		setting.DingTalkAlertSecret,
		BuildDingTalkChannelAlertContent(alert),
	); err != nil {
		reservation.Rollback()
		return err
	}
	return nil
}
