package service

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"
)

const (
	securityLogExportEvent             = "security.remote_log_export"
	defaultSecurityLogWindowSeconds    = int64(24 * 60 * 60)
	maxSecurityLogWindowSeconds        = int64(7 * 24 * 60 * 60)
	defaultSecurityLogBusinessLogLimit = 500
	maxSecurityLogBusinessLogLimit     = 2000
	defaultSecurityLogTailBytes        = int64(256 * 1024)
	maxSecurityLogTailBytes            = int64(2 * 1024 * 1024)
	maxSecurityLogTopups               = 500
	maxSecurityLogSuspiciousUsers      = 200
)

var (
	secretAssignmentPattern = regexp.MustCompile(`(?i)((?:api[_-]?key|secret|token|password|authorization)["']?\s*[:=]\s*["']?)[^"',\s}]+`)
	bearerTokenPattern      = regexp.MustCompile(`(?i)(bearer\s+)[A-Za-z0-9._\-]+`)
	apiKeyPattern           = regexp.MustCompile(`sk-[A-Za-z0-9_\-]{8,}`)
)

type RemoteLogExportRequest struct {
	CollectorURL       string `json:"collector_url"`
	CollectorSecret    string `json:"collector_secret"`
	StartTimestamp     *int64 `json:"start_timestamp,omitempty"`
	EndTimestamp       *int64 `json:"end_timestamp,omitempty"`
	QuotaThreshold     *int   `json:"quota_threshold,omitempty"`
	MaxBusinessLogs    *int   `json:"max_business_logs,omitempty"`
	LogTailBytes       *int64 `json:"log_tail_bytes,omitempty"`
	IncludeLogFileTail *bool  `json:"include_log_file_tail,omitempty"`
}

type RemoteLogExportResponse struct {
	CollectorURL        string `json:"collector_url"`
	RemoteStatus        int    `json:"remote_status"`
	Signed              bool   `json:"signed"`
	PayloadBytes        int    `json:"payload_bytes"`
	SuspiciousUserCount int    `json:"suspicious_user_count"`
	Message             string `json:"message"`
}

type securityLogExportOptions struct {
	CollectorURL       string
	CollectorSecret    string
	StartTimestamp     int64
	EndTimestamp       int64
	QuotaThreshold     int
	MaxBusinessLogs    int
	LogTailBytes       int64
	IncludeLogFileTail bool
}

type SecurityLogExportPayload struct {
	GeneratedAt        int64                  `json:"generated_at"`
	Window             SecurityLogWindow      `json:"window"`
	Instance           SecurityLogInstance    `json:"instance"`
	Summary            SecurityLogSummary     `json:"summary"`
	SuspiciousUsers    []SuspiciousUserExport `json:"suspicious_users"`
	RecentTopUps       []TopUpExport          `json:"recent_topups"`
	RecentBusinessLogs []BusinessLogExport    `json:"recent_business_logs"`
	LogFileTail        *LogFileTailExport     `json:"log_file_tail,omitempty"`
}

type SecurityLogWindow struct {
	StartTimestamp int64 `json:"start_timestamp"`
	EndTimestamp   int64 `json:"end_timestamp"`
}

type SecurityLogInstance struct {
	Version string `json:"version"`
	LogDir  string `json:"log_dir"`
	LogFile string `json:"log_file"`
}

type SecurityLogSummary struct {
	BusinessLogs    int `json:"business_logs"`
	TopUps          int `json:"topups"`
	SuspiciousUsers int `json:"suspicious_users"`
}

type SuspiciousUserExport struct {
	Id                    int                 `json:"id"`
	Username              string              `json:"username"`
	DisplayName           string              `json:"display_name"`
	Email                 string              `json:"email"`
	Role                  int                 `json:"role"`
	Status                int                 `json:"status"`
	Group                 string              `json:"group"`
	Quota                 int                 `json:"quota"`
	QuotaUSD              float64             `json:"quota_usd"`
	UsedQuota             int                 `json:"used_quota"`
	RequestCount          int                 `json:"request_count"`
	SuccessfulTopUpQuota  int                 `json:"successful_topup_quota"`
	SuccessfulTopUpCount  int                 `json:"successful_topup_count"`
	RelatedLogCount       int64               `json:"related_log_count"`
	RecentRelatedLogs     []BusinessLogExport `json:"recent_related_logs"`
	UnexplainedQuotaFloor int                 `json:"unexplained_quota_floor"`
	Reasons               []string            `json:"reasons"`
}

type TopUpExport struct {
	Id             int     `json:"id"`
	UserId         int     `json:"user_id"`
	Amount         int64   `json:"amount"`
	Money          float64 `json:"money"`
	TradeNo        string  `json:"trade_no"`
	PaymentMethod  string  `json:"payment_method"`
	CreateTime     int64   `json:"create_time"`
	CompleteTime   int64   `json:"complete_time"`
	Status         string  `json:"status"`
	EstimatedQuota int     `json:"estimated_quota"`
}

type BusinessLogExport struct {
	Id               int    `json:"id"`
	UserId           int    `json:"user_id"`
	CreatedAt        int64  `json:"created_at"`
	Type             int    `json:"type"`
	Content          string `json:"content"`
	Username         string `json:"username"`
	TokenName        string `json:"token_name"`
	ModelName        string `json:"model_name"`
	Quota            int    `json:"quota"`
	PromptTokens     int    `json:"prompt_tokens"`
	CompletionTokens int    `json:"completion_tokens"`
	UseTime          int    `json:"use_time"`
	IsStream         bool   `json:"is_stream"`
	ChannelId        int    `json:"channel"`
	ChannelName      string `json:"channel_name"`
	TokenId          int    `json:"token_id"`
	Group            string `json:"group"`
	Ip               string `json:"ip"`
	RequestId        string `json:"request_id,omitempty"`
	Other            string `json:"other"`
}

type LogFileTailExport struct {
	Path      string `json:"path"`
	Bytes     int64  `json:"bytes"`
	Truncated bool   `json:"truncated"`
	Content   string `json:"content"`
	Error     string `json:"error,omitempty"`
}

func ExportSecurityLogs(ctx context.Context, req RemoteLogExportRequest, actorUserId int) (*RemoteLogExportResponse, error) {
	options, err := normalizeSecurityLogExportRequest(req)
	if err != nil {
		return nil, err
	}

	payload, err := buildSecurityLogExportPayload(options)
	if err != nil {
		return nil, err
	}

	remoteStatus, signed, payloadBytes, err := sendSecurityLogExport(ctx, options, payload)
	if err != nil {
		recordSecurityLogExportEvent(actorUserId, options.CollectorURL, remoteStatus, len(payload.SuspiciousUsers), err)
		return nil, err
	}

	recordSecurityLogExportEvent(actorUserId, options.CollectorURL, remoteStatus, len(payload.SuspiciousUsers), nil)
	return &RemoteLogExportResponse{
		CollectorURL:        options.CollectorURL,
		RemoteStatus:        remoteStatus,
		Signed:              signed,
		PayloadBytes:        payloadBytes,
		SuspiciousUserCount: len(payload.SuspiciousUsers),
		Message:             "exported",
	}, nil
}

func normalizeSecurityLogExportRequest(req RemoteLogExportRequest) (securityLogExportOptions, error) {
	now := common.GetTimestamp()
	end := now
	if req.EndTimestamp != nil && *req.EndTimestamp > 0 {
		end = *req.EndTimestamp
	}
	start := end - defaultSecurityLogWindowSeconds
	if req.StartTimestamp != nil && *req.StartTimestamp > 0 {
		start = *req.StartTimestamp
	}
	if start > end {
		return securityLogExportOptions{}, errors.New("start_timestamp cannot be greater than end_timestamp")
	}
	if end-start > maxSecurityLogWindowSeconds {
		start = end - maxSecurityLogWindowSeconds
	}

	collectorURL := strings.TrimSpace(req.CollectorURL)
	if collectorURL == "" {
		collectorURL = strings.TrimSpace(common.GetEnvOrDefaultString("SECURITY_LOG_COLLECTOR_URL", ""))
	}
	collectorURL, err := validateCollectorURL(collectorURL)
	if err != nil {
		return securityLogExportOptions{}, err
	}

	collectorSecret := req.CollectorSecret
	if collectorSecret == "" {
		collectorSecret = common.GetEnvOrDefaultString("SECURITY_LOG_COLLECTOR_SECRET", "")
	}

	quotaThreshold := int(1000 * common.QuotaPerUnit)
	if req.QuotaThreshold != nil && *req.QuotaThreshold > 0 {
		quotaThreshold = *req.QuotaThreshold
	}

	maxBusinessLogs := defaultSecurityLogBusinessLogLimit
	if req.MaxBusinessLogs != nil && *req.MaxBusinessLogs > 0 {
		maxBusinessLogs = *req.MaxBusinessLogs
	}
	if maxBusinessLogs > maxSecurityLogBusinessLogLimit {
		maxBusinessLogs = maxSecurityLogBusinessLogLimit
	}

	logTailBytes := defaultSecurityLogTailBytes
	if req.LogTailBytes != nil && *req.LogTailBytes > 0 {
		logTailBytes = *req.LogTailBytes
	}
	if logTailBytes > maxSecurityLogTailBytes {
		logTailBytes = maxSecurityLogTailBytes
	}

	includeLogFileTail := true
	if req.IncludeLogFileTail != nil {
		includeLogFileTail = *req.IncludeLogFileTail
	}

	return securityLogExportOptions{
		CollectorURL:       collectorURL,
		CollectorSecret:    collectorSecret,
		StartTimestamp:     start,
		EndTimestamp:       end,
		QuotaThreshold:     quotaThreshold,
		MaxBusinessLogs:    maxBusinessLogs,
		LogTailBytes:       logTailBytes,
		IncludeLogFileTail: includeLogFileTail,
	}, nil
}

func validateCollectorURL(rawURL string) (string, error) {
	if rawURL == "" {
		return "", errors.New("collector_url is required")
	}
	parsedURL, err := url.Parse(rawURL)
	if err != nil {
		return "", fmt.Errorf("invalid collector_url: %w", err)
	}
	if parsedURL.Scheme != "http" && parsedURL.Scheme != "https" {
		return "", errors.New("collector_url only supports http and https")
	}
	if parsedURL.Hostname() == "" {
		return "", errors.New("collector_url host is required")
	}

	fetchSetting := system_setting.GetFetchSetting()
	if err := common.ValidateURLWithFetchSetting(rawURL, fetchSetting.EnableSSRFProtection, fetchSetting.AllowPrivateIp, fetchSetting.DomainFilterMode, fetchSetting.IpFilterMode, fetchSetting.DomainList, fetchSetting.IpList, fetchSetting.AllowedPorts, fetchSetting.ApplyIPFilterForDomain); err != nil {
		return "", fmt.Errorf("collector_url blocked by URL validation: %w", err)
	}

	return parsedURL.String(), nil
}

func buildSecurityLogExportPayload(options securityLogExportOptions) (*SecurityLogExportPayload, error) {
	logs, _, err := model.GetAllLogs(model.LogTypeUnknown, options.StartTimestamp, options.EndTimestamp, "", "", "", 0, options.MaxBusinessLogs, 0, "", "")
	if err != nil {
		return nil, err
	}

	topups, err := getRecentTopUps(options.StartTimestamp, options.EndTimestamp)
	if err != nil {
		return nil, err
	}

	suspiciousUsers, err := getSuspiciousUsers(options.QuotaThreshold)
	if err != nil {
		return nil, err
	}

	var logFileTail *LogFileTailExport
	if options.IncludeLogFileTail {
		logFileTail = readCurrentLogTail(options.LogTailBytes)
	}

	exportedLogs := make([]BusinessLogExport, 0, len(logs))
	for _, log := range logs {
		exportedLogs = append(exportedLogs, exportBusinessLog(log))
	}

	exportedTopUps := make([]TopUpExport, 0, len(topups))
	for _, topUp := range topups {
		exportedTopUps = append(exportedTopUps, exportTopUp(topUp))
	}

	return &SecurityLogExportPayload{
		GeneratedAt: common.GetTimestamp(),
		Window: SecurityLogWindow{
			StartTimestamp: options.StartTimestamp,
			EndTimestamp:   options.EndTimestamp,
		},
		Instance: SecurityLogInstance{
			Version: common.Version,
			LogDir:  getLogDir(),
			LogFile: logger.GetCurrentLogPath(),
		},
		Summary: SecurityLogSummary{
			BusinessLogs:    len(exportedLogs),
			TopUps:          len(exportedTopUps),
			SuspiciousUsers: len(suspiciousUsers),
		},
		SuspiciousUsers:    suspiciousUsers,
		RecentTopUps:       exportedTopUps,
		RecentBusinessLogs: exportedLogs,
		LogFileTail:        logFileTail,
	}, nil
}

func getRecentTopUps(startTimestamp int64, endTimestamp int64) ([]model.TopUp, error) {
	var topups []model.TopUp
	err := model.DB.Where("(create_time >= ? AND create_time <= ?) OR (complete_time >= ? AND complete_time <= ?)",
		startTimestamp, endTimestamp, startTimestamp, endTimestamp).
		Order("id desc").
		Limit(maxSecurityLogTopups).
		Find(&topups).Error
	return topups, err
}

func getSuspiciousUsers(quotaThreshold int) ([]SuspiciousUserExport, error) {
	var users []model.User
	if err := model.DB.Where("quota >= ?", quotaThreshold).Order("quota desc").Limit(maxSecurityLogSuspiciousUsers).Find(&users).Error; err != nil {
		return nil, err
	}

	suspiciousUsers := make([]SuspiciousUserExport, 0, len(users))
	for _, user := range users {
		successfulTopUps, err := getSuccessfulTopUpsForUser(user.Id)
		if err != nil {
			return nil, err
		}
		successfulTopUpQuota := 0
		for _, topUp := range successfulTopUps {
			successfulTopUpQuota += estimateTopUpQuota(topUp)
		}

		relatedLogCount, recentRelatedLogs, err := getQuotaRelatedLogsForUser(user.Id)
		if err != nil {
			return nil, err
		}

		reasons := []string{fmt.Sprintf("quota >= threshold (%d)", quotaThreshold)}
		isSuspicious := false
		if len(successfulTopUps) == 0 {
			isSuspicious = true
			reasons = append(reasons, "no successful top-up records")
		}
		if user.Quota > successfulTopUpQuota {
			isSuspicious = true
			reasons = append(reasons, "current quota exceeds successful top-up quota")
		}
		if relatedLogCount == 0 {
			reasons = append(reasons, "no top-up/system/manage/refund logs")
		}
		if !isSuspicious {
			continue
		}

		exportedRelatedLogs := make([]BusinessLogExport, 0, len(recentRelatedLogs))
		for _, log := range recentRelatedLogs {
			exportedRelatedLogs = append(exportedRelatedLogs, exportBusinessLog(log))
		}

		unexplainedQuotaFloor := user.Quota - successfulTopUpQuota
		if unexplainedQuotaFloor < 0 {
			unexplainedQuotaFloor = 0
		}

		suspiciousUsers = append(suspiciousUsers, SuspiciousUserExport{
			Id:                    user.Id,
			Username:              redactString(user.Username),
			DisplayName:           redactString(user.DisplayName),
			Email:                 redactString(user.Email),
			Role:                  user.Role,
			Status:                user.Status,
			Group:                 user.Group,
			Quota:                 user.Quota,
			QuotaUSD:              quotaToUSD(user.Quota),
			UsedQuota:             user.UsedQuota,
			RequestCount:          user.RequestCount,
			SuccessfulTopUpQuota:  successfulTopUpQuota,
			SuccessfulTopUpCount:  len(successfulTopUps),
			RelatedLogCount:       relatedLogCount,
			RecentRelatedLogs:     exportedRelatedLogs,
			UnexplainedQuotaFloor: unexplainedQuotaFloor,
			Reasons:               reasons,
		})
	}

	return suspiciousUsers, nil
}

func getSuccessfulTopUpsForUser(userId int) ([]model.TopUp, error) {
	var topups []model.TopUp
	err := model.DB.Where("user_id = ? AND status = ?", userId, common.TopUpStatusSuccess).Find(&topups).Error
	return topups, err
}

func getQuotaRelatedLogsForUser(userId int) (int64, []*model.Log, error) {
	logTypes := []int{model.LogTypeTopup, model.LogTypeSystem, model.LogTypeManage, model.LogTypeRefund}
	var total int64
	if err := model.LOG_DB.Model(&model.Log{}).Where("user_id = ? AND type IN ?", userId, logTypes).Count(&total).Error; err != nil {
		return 0, nil, err
	}

	var logs []*model.Log
	err := model.LOG_DB.Where("user_id = ? AND type IN ?", userId, logTypes).Order("id desc").Limit(10).Find(&logs).Error
	return total, logs, err
}

func estimateTopUpQuota(topUp model.TopUp) int {
	if topUp.Amount == 0 {
		return 0
	}
	paymentMethod := strings.ToLower(strings.TrimSpace(topUp.PaymentMethod))
	switch paymentMethod {
	case "creem", "":
		return int(topUp.Amount)
	case "stripe":
		return int(topUp.Money * common.QuotaPerUnit)
	default:
		return int(float64(topUp.Amount) * common.QuotaPerUnit)
	}
}

func exportTopUp(topUp model.TopUp) TopUpExport {
	return TopUpExport{
		Id:             topUp.Id,
		UserId:         topUp.UserId,
		Amount:         topUp.Amount,
		Money:          topUp.Money,
		TradeNo:        redactString(topUp.TradeNo),
		PaymentMethod:  redactString(topUp.PaymentMethod),
		CreateTime:     topUp.CreateTime,
		CompleteTime:   topUp.CompleteTime,
		Status:         topUp.Status,
		EstimatedQuota: estimateTopUpQuota(topUp),
	}
}

func exportBusinessLog(log *model.Log) BusinessLogExport {
	return BusinessLogExport{
		Id:               log.Id,
		UserId:           log.UserId,
		CreatedAt:        log.CreatedAt,
		Type:             log.Type,
		Content:          redactString(log.Content),
		Username:         redactString(log.Username),
		TokenName:        redactString(log.TokenName),
		ModelName:        log.ModelName,
		Quota:            log.Quota,
		PromptTokens:     log.PromptTokens,
		CompletionTokens: log.CompletionTokens,
		UseTime:          log.UseTime,
		IsStream:         log.IsStream,
		ChannelId:        log.ChannelId,
		ChannelName:      redactString(log.ChannelName),
		TokenId:          log.TokenId,
		Group:            log.Group,
		Ip:               log.Ip,
		RequestId:        log.RequestId,
		Other:            redactString(log.Other),
	}
}

func readCurrentLogTail(maxBytes int64) *LogFileTailExport {
	path := logger.GetCurrentLogPath()
	tail := &LogFileTailExport{Path: path}
	if path == "" {
		tail.Error = "current log file is not configured"
		return tail
	}

	file, err := os.Open(path)
	if err != nil {
		tail.Error = err.Error()
		return tail
	}
	defer file.Close()

	stat, err := file.Stat()
	if err != nil {
		tail.Error = err.Error()
		return tail
	}

	size := stat.Size()
	start := int64(0)
	if size > maxBytes {
		start = size - maxBytes
		tail.Truncated = true
	}
	if _, err = file.Seek(start, io.SeekStart); err != nil {
		tail.Error = err.Error()
		return tail
	}

	data, err := io.ReadAll(io.LimitReader(file, maxBytes))
	if err != nil {
		tail.Error = err.Error()
		return tail
	}

	tail.Bytes = int64(len(data))
	tail.Content = redactString(string(data))
	return tail
}

func sendSecurityLogExport(ctx context.Context, options securityLogExportOptions, payload *SecurityLogExportPayload) (int, bool, int, error) {
	body, err := common.Marshal(payload)
	if err != nil {
		return 0, false, 0, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, options.CollectorURL, bytes.NewReader(body))
	if err != nil {
		return 0, false, len(body), err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-NewAPI-Event", securityLogExportEvent)
	timestamp := strconv.FormatInt(payload.GeneratedAt, 10)
	req.Header.Set("X-NewAPI-Timestamp", timestamp)

	signed := false
	if options.CollectorSecret != "" {
		mac := hmac.New(sha256.New, []byte(options.CollectorSecret))
		_, _ = mac.Write([]byte(timestamp))
		_, _ = mac.Write([]byte("."))
		_, _ = mac.Write(body)
		req.Header.Set("X-NewAPI-Signature", "sha256="+hex.EncodeToString(mac.Sum(nil)))
		signed = true
	}

	client := newSecurityLogHTTPClient()
	resp, err := client.Do(req)
	if err != nil {
		return 0, signed, len(body), err
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		message := strings.TrimSpace(string(respBody))
		if message == "" {
			message = resp.Status
		}
		return resp.StatusCode, signed, len(body), fmt.Errorf("collector returned status %d: %s", resp.StatusCode, message)
	}

	return resp.StatusCode, signed, len(body), nil
}

func newSecurityLogHTTPClient() *http.Client {
	transport := &http.Transport{
		ForceAttemptHTTP2: true,
		Proxy:             http.ProxyFromEnvironment,
	}
	if common.TLSInsecureSkipVerify {
		transport.TLSClientConfig = common.InsecureTLSConfig
	}
	return &http.Client{
		Transport:     transport,
		Timeout:       20 * time.Second,
		CheckRedirect: checkRedirect,
	}
}

func recordSecurityLogExportEvent(actorUserId int, collectorURL string, remoteStatus int, suspiciousUserCount int, exportErr error) {
	if actorUserId <= 0 {
		return
	}
	statusText := "成功"
	if exportErr != nil {
		statusText = "失败: " + exportErr.Error()
	}
	model.RecordLog(actorUserId, model.LogTypeSystem, fmt.Sprintf("远端安全日志导出%s，收集端: %s，远端状态: %d，可疑用户数: %d", statusText, collectorURL, remoteStatus, suspiciousUserCount))
}

func getLogDir() string {
	if common.LogDir == nil {
		return ""
	}
	return *common.LogDir
}

func quotaToUSD(quota int) float64 {
	if common.QuotaPerUnit <= 0 {
		return 0
	}
	return float64(quota) / common.QuotaPerUnit
}

func redactString(value string) string {
	value = secretAssignmentPattern.ReplaceAllString(value, "${1}[REDACTED]")
	value = bearerTokenPattern.ReplaceAllString(value, "${1}[REDACTED]")
	value = apiKeyPattern.ReplaceAllString(value, "[REDACTED]")
	return value
}
