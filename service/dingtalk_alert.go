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
	"strconv"
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

type DingTalkPaymentProcessingAlert struct {
	Provider            string
	TradeNo             string
	EventType           string
	CustomerID          string
	CustomerEmail       string
	ExpectedCurrency    string
	ExpectedAmountMinor int64
	ActualCurrency      string
	ActualAmountMinor   int64
	ErrorClass          string
	Error               string
	Now                 time.Time
}

type DingTalkAlertCooldown struct {
	mu     sync.Mutex
	lastAt map[int]time.Time
}

type DingTalkModelAlertCooldown struct {
	mu     sync.Mutex
	lastAt map[string]time.Time
}

type DingTalkPaymentAlertCooldown struct {
	mu     sync.Mutex
	lastAt map[string]time.Time
}

type dingTalkAlertCooldownReservation struct {
	c             *DingTalkAlertCooldown
	channelID     int
	reservedAt    time.Time
	previousAt    time.Time
	hadPrevious   bool
	dbReservation *model.DingTalkAlertCooldownReservation
}

type dingTalkModelAlertCooldownReservation struct {
	c             *DingTalkModelAlertCooldown
	modelName     string
	reservedAt    time.Time
	previousAt    time.Time
	hadPrevious   bool
	dbReservation *model.CodexModelGovernanceAlertCooldownReservation
}

type dingTalkPaymentAlertCooldownReservation struct {
	c           *DingTalkPaymentAlertCooldown
	key         string
	reservedAt  time.Time
	previousAt  time.Time
	hadPrevious bool
	redisKey    string
	redisToken  string
}

type dingTalkSendResponse struct {
	ErrCode *int   `json:"errcode"`
	ErrMsg  string `json:"errmsg"`
}

var (
	dingTalkAlertCooldown                = NewDingTalkAlertCooldown()
	codexGovernanceAlertCooldown         = NewDingTalkModelAlertCooldown()
	dingTalkPaymentAlertCooldown         = NewDingTalkPaymentAlertCooldown()
	dingTalkCredentialPattern            = regexp.MustCompile(`(?i)(\b(?:access_token|refresh_token|id_token|api[_-]?key|authorization)\b\s*(?::|=)?\s*)(?:"[^"]*"|'[^']*'|bearer\s+[^\s,;}]+|[^\s,;}]+)`)
	dingTalkQuotedCredentialPattern      = regexp.MustCompile(`(?i)(["'](?:access_token|refresh_token|id_token|api[_-]?key|authorization)["']\s*:\s*)(?:"[^"]*"|'[^']*'|[^,\s}]+)`)
	dingTalkSKPattern                    = regexp.MustCompile(`sk-[A-Za-z0-9_-]+`)
	dingTalkAWSKeyPattern                = regexp.MustCompile(`\b(?:AKIA|ASIA)[A-Z0-9]{16}\b`)
	dingTalkGoogleAPIKeyPattern          = regexp.MustCompile(`\bAIza[0-9A-Za-z_-]{35}\b`)
	dingTalkMaxResponseBodyBytes         = int64(64 * 1024)
	dingTalkRequestTimeout               = 10 * time.Second
	dingTalkAlertPendingReservationTTL   = dingTalkChannelAlertAISummaryTimeout + 2*dingTalkRequestTimeout
	generateDingTalkPaymentCooldownToken = common.GenerateRandomCharsKey
)

const (
	maxDingTalkChannelAlertBatchSize       = 5
	maxDingTalkPaymentAlertCooldownEntries = 2048
)

func NewDingTalkAlertCooldown() *DingTalkAlertCooldown {
	return &DingTalkAlertCooldown{lastAt: make(map[int]time.Time)}
}

func NewDingTalkModelAlertCooldown() *DingTalkModelAlertCooldown {
	return &DingTalkModelAlertCooldown{lastAt: make(map[string]time.Time)}
}

func NewDingTalkPaymentAlertCooldown() *DingTalkPaymentAlertCooldown {
	return &DingTalkPaymentAlertCooldown{lastAt: make(map[string]time.Time)}
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

func (c *DingTalkModelAlertCooldown) reserve(modelName string, now time.Time, cooldown time.Duration) (*dingTalkModelAlertCooldownReservation, bool) {
	modelName = strings.TrimSpace(modelName)
	if c == nil || cooldown <= 0 || modelName == "" {
		return nil, true
	}
	c.mu.Lock()
	defer c.mu.Unlock()

	last, ok := c.lastAt[modelName]
	if ok && now.Sub(last) < cooldown {
		return nil, false
	}
	c.lastAt[modelName] = now
	return &dingTalkModelAlertCooldownReservation{
		c:           c,
		modelName:   modelName,
		reservedAt:  now,
		previousAt:  last,
		hadPrevious: ok,
	}, true
}

func (c *DingTalkPaymentAlertCooldown) reserve(key string, now time.Time, cooldown time.Duration) (*dingTalkPaymentAlertCooldownReservation, bool) {
	key = strings.TrimSpace(key)
	if c == nil || cooldown <= 0 || key == "" {
		return nil, true
	}
	if now.IsZero() {
		now = time.Now()
	}
	c.mu.Lock()
	defer c.mu.Unlock()

	c.pruneExpired(now, cooldown)
	last, ok := c.lastAt[key]
	if ok && now.Sub(last) < cooldown {
		return nil, false
	}
	if !ok && len(c.lastAt) >= maxDingTalkPaymentAlertCooldownEntries {
		return nil, false
	}
	c.lastAt[key] = now
	return &dingTalkPaymentAlertCooldownReservation{
		c:           c,
		key:         key,
		reservedAt:  now,
		previousAt:  last,
		hadPrevious: ok,
	}, true
}

func (c *DingTalkPaymentAlertCooldown) pruneExpired(now time.Time, cooldown time.Duration) {
	if c == nil || cooldown <= 0 {
		return
	}
	for key, last := range c.lastAt {
		if !last.IsZero() && now.Sub(last) >= cooldown {
			delete(c.lastAt, key)
		}
	}
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

func (r *dingTalkModelAlertCooldownReservation) Rollback() {
	if r == nil {
		return
	}
	if r.dbReservation != nil {
		if err := model.RollbackCodexModelGovernanceAlertCooldown(r.dbReservation); err != nil {
			common.SysError("failed to rollback codex governance alert cooldown reservation: " + err.Error())
		}
		return
	}
	if r.c == nil {
		return
	}
	r.c.mu.Lock()
	defer r.c.mu.Unlock()

	current, ok := r.c.lastAt[r.modelName]
	if !ok || !current.Equal(r.reservedAt) {
		return
	}
	if r.hadPrevious {
		r.c.lastAt[r.modelName] = r.previousAt
		return
	}
	delete(r.c.lastAt, r.modelName)
}

func (r *dingTalkModelAlertCooldownReservation) Commit() error {
	if r == nil || r.dbReservation == nil {
		return nil
	}
	return model.CommitCodexModelGovernanceAlertCooldown(r.dbReservation)
}

func (r *dingTalkPaymentAlertCooldownReservation) Rollback() {
	if r == nil {
		return
	}
	if r.redisKey != "" && r.redisToken != "" && common.RDB != nil {
		ctx := context.Background()
		value, err := common.RDB.Get(ctx, r.redisKey).Result()
		if err == nil && value == r.redisToken {
			if err := common.RDB.Del(ctx, r.redisKey).Err(); err != nil {
				common.SysError("failed to rollback dingtalk payment alert cooldown reservation: " + err.Error())
			}
		}
		return
	}
	if r.c == nil {
		return
	}
	r.c.mu.Lock()
	defer r.c.mu.Unlock()

	current, ok := r.c.lastAt[r.key]
	if !ok || !current.Equal(r.reservedAt) {
		return
	}
	if r.hadPrevious {
		r.c.lastAt[r.key] = r.previousAt
		return
	}
	delete(r.c.lastAt, r.key)
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

func reserveCodexGovernanceAlertCooldown(modelName string, now time.Time, cooldown time.Duration) (*dingTalkModelAlertCooldownReservation, bool) {
	modelName = strings.TrimSpace(modelName)
	if modelName == "" {
		return nil, true
	}
	if model.DB == nil {
		return codexGovernanceAlertCooldown.reserve(modelName, now, cooldown)
	}
	reservationToken, err := common.GenerateRandomCharsKey(32)
	if err != nil {
		common.SysError("failed to generate codex governance alert cooldown reservation token: " + err.Error())
		return nil, false
	}
	dbReservation, allowed, err := model.ReserveCodexModelGovernanceAlertCooldown(modelName, cooldown, dingTalkAlertPendingReservationTTL, reservationToken)
	if err != nil {
		common.SysError("failed to reserve codex governance alert cooldown in database: " + err.Error())
		return codexGovernanceAlertCooldown.reserve(modelName, now, cooldown)
	}
	if !allowed || dbReservation == nil {
		return nil, allowed
	}
	return &dingTalkModelAlertCooldownReservation{
		modelName:     modelName,
		dbReservation: dbReservation,
	}, true
}

func reserveDingTalkPaymentProcessingAlertCooldown(alert DingTalkPaymentProcessingAlert, now time.Time, cooldown time.Duration) (*dingTalkPaymentAlertCooldownReservation, bool) {
	key := dingTalkPaymentProcessingAlertCooldownKey(alert)
	if key == "" || cooldown <= 0 {
		return nil, true
	}
	if common.RedisEnabled && common.RDB != nil {
		token, err := generateDingTalkPaymentCooldownToken(32)
		if err != nil {
			common.SysError("failed to generate dingtalk payment alert cooldown reservation token: " + err.Error())
			return dingTalkPaymentAlertCooldown.reserve(key, now, cooldown)
		}
		redisKey := "dingtalk:payment_processing_alert:" + key
		allowed, err := common.RDB.SetNX(context.Background(), redisKey, token, cooldown).Result()
		if err != nil {
			common.SysError("failed to reserve dingtalk payment alert cooldown in redis: " + err.Error())
			return dingTalkPaymentAlertCooldown.reserve(key, now, cooldown)
		}
		if !allowed {
			return nil, false
		}
		return &dingTalkPaymentAlertCooldownReservation{redisKey: redisKey, redisToken: token}, true
	}
	return dingTalkPaymentAlertCooldown.reserve(key, now, cooldown)
}

func dingTalkPaymentProcessingAlertCooldownKey(alert DingTalkPaymentProcessingAlert) string {
	provider := strings.TrimSpace(alert.Provider)
	tradeNo := strings.TrimSpace(alert.TradeNo)
	eventType := strings.TrimSpace(alert.EventType)
	customerID := strings.TrimSpace(alert.CustomerID)
	errorClass := dingTalkPaymentProcessingAlertErrorClass(alert)
	expectedCurrency := strings.ToUpper(strings.TrimSpace(alert.ExpectedCurrency))
	actualCurrency := strings.ToUpper(strings.TrimSpace(alert.ActualCurrency))
	if provider == "" && tradeNo == "" && eventType == "" && customerID == "" && errorClass == "" && expectedCurrency == "" && actualCurrency == "" && alert.ExpectedAmountMinor == 0 && alert.ActualAmountMinor == 0 {
		return ""
	}
	sum := sha256.Sum256([]byte(provider + "\x00" + tradeNo + "\x00" + eventType + "\x00" + customerID + "\x00" + errorClass + "\x00" + expectedCurrency + "\x00" + actualCurrency + "\x00" + strconv.FormatInt(alert.ExpectedAmountMinor, 10) + "\x00" + strconv.FormatInt(alert.ActualAmountMinor, 10)))
	return fmt.Sprintf("%x", sum[:])
}

func dingTalkPaymentProcessingAlertErrorClass(alert DingTalkPaymentProcessingAlert) string {
	errorClass := strings.ToLower(strings.Join(strings.Fields(strings.TrimSpace(alert.ErrorClass)), "_"))
	if errorClass != "" {
		return errorClass
	}
	if strings.TrimSpace(alert.Error) != "" {
		return "uncategorized"
	}
	return ""
}

func codexGovernanceAlertCooldownKey(record *model.CodexModelGovernanceRecord) string {
	if record == nil {
		return ""
	}
	modelName := strings.TrimSpace(record.ModelName)
	if modelName == "" {
		return ""
	}
	affectedChannelIDs := model.DecodeCodexModelGovernanceChannelIDs(record.AffectedChannelIDs)
	disabledChannelIDs := model.CodexModelGovernanceDisabledChannelIDs(*record)
	scope := "affected:" + model.EncodeCodexModelGovernanceChannelIDsForDisplay(affectedChannelIDs) +
		"|disabled:" + model.EncodeCodexModelGovernanceChannelIDsForDisplay(disabledChannelIDs)
	sum := sha256.Sum256([]byte(modelName + "\x00" + scope))
	return fmt.Sprintf("codex-governance:%x", sum[:])
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

func BuildDingTalkPaymentProcessingAlertContent(alert DingTalkPaymentProcessingAlert) string {
	now := alert.Now
	if now.IsZero() {
		now = time.Now()
	}
	message := sanitizeDingTalkAlertText(alert.Error)
	if message == "" {
		message = "unknown error"
	}

	return strings.Join([]string{
		"New API payment processing failed",
		fmt.Sprintf("Provider: %s", sanitizeDingTalkAlertText(alert.Provider)),
		fmt.Sprintf("Trade No: %s", sanitizeDingTalkAlertText(alert.TradeNo)),
		fmt.Sprintf("Event Type: %s", sanitizeDingTalkAlertText(alert.EventType)),
		fmt.Sprintf("Customer ID: %s", sanitizeDingTalkAlertText(alert.CustomerID)),
		fmt.Sprintf("Customer Email: %s", sanitizeDingTalkAlertText(common.MaskEmail(alert.CustomerEmail))),
		fmt.Sprintf("Expected Amount: %d %s", alert.ExpectedAmountMinor, sanitizeDingTalkAlertText(alert.ExpectedCurrency)),
		fmt.Sprintf("Actual Amount: %d %s", alert.ActualAmountMinor, sanitizeDingTalkAlertText(alert.ActualCurrency)),
		fmt.Sprintf("Error: %s", message),
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

func BuildDingTalkCodexModelGovernanceAlertContent(record *model.CodexModelGovernanceRecord) string {
	if record == nil {
		return "Codex model governance alert\nRecord: <nil>"
	}
	detectedAt := "-"
	if record.DetectedAt > 0 {
		detectedAt = time.Unix(record.DetectedAt, 0).Format("2006-01-02 15:04:05")
	}
	channelIDs := model.DecodeCodexModelGovernanceChannelIDs(record.AffectedChannelIDs)
	disabledChannelIDs := model.CodexModelGovernanceDisabledChannelIDs(*record)
	autoDisabled := "no"
	if len(disabledChannelIDs) > 0 {
		autoDisabled = "yes"
	}
	lines := []string{
		"Codex model governance alert",
		fmt.Sprintf("Model: %s", sanitizeDingTalkAlertText(record.ModelName)),
		fmt.Sprintf("Status: %s", sanitizeDingTalkAlertText(record.Status)),
		fmt.Sprintf("Source: %s", sanitizeDingTalkAlertText(record.Source)),
		fmt.Sprintf("Matched Rule: %s", sanitizeDingTalkAlertText(record.MatchedRule)),
		fmt.Sprintf("Affected Channels: %d (%s)", len(channelIDs), sanitizeDingTalkAlertText(record.AffectedChannelIDs)),
		fmt.Sprintf("Disabled Channels: %d (%s)", len(disabledChannelIDs), sanitizeDingTalkAlertText(model.EncodeCodexModelGovernanceChannelIDsForDisplay(disabledChannelIDs))),
		fmt.Sprintf("Auto Disabled: %s", autoDisabled),
		fmt.Sprintf("Reason: %s", sanitizeDingTalkAlertText(record.LastError)),
		fmt.Sprintf("Detected At: %s", detectedAt),
	}
	if len(disabledChannelIDs) == 0 && record.Status == model.CodexModelGovernanceStatusUnsupportedPendingReview {
		lines = append(lines,
			"!! MODEL IS STILL SERVING USER REQUESTS !!",
			"Please review and disable it as soon as possible in the Codex model governance page.",
		)
	} else if len(disabledChannelIDs) < len(channelIDs) && record.Status == model.CodexModelGovernanceStatusUnsupportedPendingReview {
		lines = append(lines,
			"!! LINKED CHANNELS ARE STILL SERVING USER REQUESTS !!",
			"Please review linked Codex channels and disable or remove the model if confirmed unsupported.",
		)
	}
	return strings.Join(lines, "\n")
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

func NotifyDingTalkPaymentProcessingFailure(alert DingTalkPaymentProcessingAlert) error {
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
	reservation, allowed := reserveDingTalkPaymentProcessingAlertCooldown(alert, time.Now(), time.Duration(cooldownMinutes)*time.Minute)
	if !allowed {
		return nil
	}
	err := SendDingTalkText(
		setting.DingTalkAlertWebhookURL,
		setting.DingTalkAlertSecret,
		BuildDingTalkPaymentProcessingAlertContent(alert),
	)
	if err != nil {
		reservation.Rollback()
		return err
	}
	return nil
}

func NotifyDingTalkCodexModelGovernance(record *model.CodexModelGovernanceRecord) error {
	setting := operation_setting.GetMonitorSetting()
	if setting == nil || !setting.DingTalkAlertEnabled {
		return nil
	}
	if strings.TrimSpace(setting.DingTalkAlertWebhookURL) == "" {
		return fmt.Errorf("dingtalk alert webhook url is empty")
	}
	cooldownMinutes := 60
	if governanceSetting := operation_setting.GetCodexModelGovernanceSetting(); governanceSetting != nil && governanceSetting.AlertCooldownMinutes > 0 {
		cooldownMinutes = governanceSetting.AlertCooldownMinutes
	}
	modelName := ""
	if record != nil {
		modelName = codexGovernanceAlertCooldownKey(record)
	}
	reservation, allowed := reserveCodexGovernanceAlertCooldown(
		modelName,
		time.Now(),
		time.Duration(cooldownMinutes)*time.Minute,
	)
	if !allowed {
		return nil
	}
	if err := SendDingTalkText(
		setting.DingTalkAlertWebhookURL,
		setting.DingTalkAlertSecret,
		BuildDingTalkCodexModelGovernanceAlertContent(record),
	); err != nil {
		if reservation != nil {
			reservation.Rollback()
		}
		return err
	}
	if reservation != nil {
		if err := reservation.Commit(); err != nil {
			common.SysError("failed to commit codex governance alert cooldown reservation: " + err.Error())
		}
	}
	return nil
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
	rawContent := BuildDingTalkChannelAlertBatchContent(alerts)
	content := buildDingTalkChannelAlertContentWithOptionalAISummary(alerts, rawContent)
	if err := SendDingTalkText(
		setting.DingTalkAlertWebhookURL,
		setting.DingTalkAlertSecret,
		content,
	); err != nil {
		for _, reservation := range reservations {
			reservation.Rollback()
		}
		return err
	}
	// The alert has already been delivered to DingTalk. Committing the cooldown
	// reservations only affects cooldown bookkeeping, so a Commit failure must not
	// be surfaced as a send failure nor abort committing the remaining reservations.
	// Reservations that fail to commit keep their pending state and are released
	// once the pending TTL expires, allowing later alerts through.
	for _, reservation := range reservations {
		if err := reservation.Commit(); err != nil {
			common.SysError("failed to commit dingtalk alert cooldown reservation: " + err.Error())
		}
	}
	return nil
}
