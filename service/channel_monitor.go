package service

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"gorm.io/gorm"
)

const (
	channelMonitorEncryptionPrefix = "v1:"
	channelMonitorRunnerInterval   = time.Second
	channelMonitorLeaseSeconds     = int64(180)
	channelMonitorClaimLimit       = 16
	channelMonitorMaxConcurrency   = 8
	channelMonitorMaxErrorLength   = 500
	channelMonitorMinInterval      = 1
	channelMonitorMaxInterval      = 86400
	channelMonitorMinTimeout       = 1
	channelMonitorMaxTimeout       = 120
)

type ChannelMonitorInput struct {
	Name            string
	ApiURL          string
	ApiKey          string
	TestModel       string
	IntervalSeconds int
	TimeoutSeconds  int
	Enabled         bool
	Visible         bool
	CreatedBy       int
}

type ChannelMonitorView struct {
	Monitor         *model.ChannelMonitor
	Status          string
	Latest          *model.ChannelMonitorHistory
	Availability7d  *float64
	Availability30d *float64
	RecentResults   []*model.ChannelMonitorHistory
}

func normalizeChannelMonitorInput(input ChannelMonitorInput, requireAPIKey bool) (ChannelMonitorInput, error) {
	input.Name = strings.TrimSpace(input.Name)
	input.ApiURL = strings.TrimRight(strings.TrimSpace(input.ApiURL), "/")
	input.ApiKey = strings.TrimSpace(input.ApiKey)
	input.TestModel = strings.TrimSpace(input.TestModel)

	if input.Name == "" || len(input.Name) > 100 {
		return input, errors.New("monitor name must contain 1 to 100 characters")
	}
	if input.ApiURL == "" || len(input.ApiURL) > 500 {
		return input, errors.New("API URL must contain 1 to 500 characters")
	}
	parsed, err := url.ParseRequestURI(input.ApiURL)
	if err != nil || parsed.Host == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.User != nil || parsed.RawQuery != "" || parsed.Fragment != "" {
		return input, errors.New("API URL must be an absolute HTTP or HTTPS URL without query parameters")
	}
	if requireAPIKey && input.ApiKey == "" {
		return input, errors.New("API key is required")
	}
	if input.TestModel == "" || len(input.TestModel) > 200 {
		return input, errors.New("test model must contain 1 to 200 characters")
	}
	if input.IntervalSeconds < channelMonitorMinInterval || input.IntervalSeconds > channelMonitorMaxInterval {
		return input, fmt.Errorf("test interval must be between %d and %d seconds", channelMonitorMinInterval, channelMonitorMaxInterval)
	}
	if input.TimeoutSeconds == 0 {
		input.TimeoutSeconds = 15
	}
	if input.TimeoutSeconds < channelMonitorMinTimeout || input.TimeoutSeconds > channelMonitorMaxTimeout {
		return input, fmt.Errorf("request timeout must be between %d and %d seconds", channelMonitorMinTimeout, channelMonitorMaxTimeout)
	}
	return input, nil
}

func encryptChannelMonitorAPIKey(apiKey string) (string, error) {
	key, err := channelMonitorEncryptionKey()
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(key[:])
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	ciphertext := gcm.Seal(nil, nonce, []byte(apiKey), nil)
	payload := append(nonce, ciphertext...)
	return channelMonitorEncryptionPrefix + base64.RawStdEncoding.EncodeToString(payload), nil
}

func decryptChannelMonitorAPIKey(encrypted string) (string, error) {
	if !strings.HasPrefix(encrypted, channelMonitorEncryptionPrefix) {
		return "", errors.New("unsupported API key encryption format")
	}
	payload, err := base64.RawStdEncoding.DecodeString(strings.TrimPrefix(encrypted, channelMonitorEncryptionPrefix))
	if err != nil {
		return "", err
	}
	key, err := channelMonitorEncryptionKey()
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(key[:])
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	if len(payload) < gcm.NonceSize() {
		return "", errors.New("invalid encrypted API key")
	}
	nonce := payload[:gcm.NonceSize()]
	plaintext, err := gcm.Open(nil, nonce, payload[gcm.NonceSize():], nil)
	if err != nil {
		return "", err
	}
	return string(plaintext), nil
}

func channelMonitorEncryptionKey() ([sha256.Size]byte, error) {
	secret := common.CryptoSecret
	if os.Getenv("CRYPTO_SECRET") == "" && os.Getenv("SESSION_SECRET") == "" {
		persisted, err := model.GetOrCreateChannelMonitorEncryptionSecret()
		if err != nil {
			return [sha256.Size]byte{}, err
		}
		secret = persisted
	}
	return sha256.Sum256([]byte(secret)), nil
}

func CreateChannelMonitor(input ChannelMonitorInput) (*model.ChannelMonitor, error) {
	normalized, err := normalizeChannelMonitorInput(input, true)
	if err != nil {
		return nil, err
	}
	encryptedKey, err := encryptChannelMonitorAPIKey(normalized.ApiKey)
	if err != nil {
		return nil, err
	}
	now := common.GetTimestamp()
	monitor := &model.ChannelMonitor{
		Name:            normalized.Name,
		ApiURL:          normalized.ApiURL,
		ApiKeyEncrypted: encryptedKey,
		TestModel:       normalized.TestModel,
		IntervalSeconds: normalized.IntervalSeconds,
		TimeoutSeconds:  normalized.TimeoutSeconds,
		Enabled:         normalized.Enabled,
		Visible:         normalized.Visible,
		CreatedBy:       normalized.CreatedBy,
	}
	if monitor.Enabled {
		monitor.NextCheckAt = &now
	}
	if err := model.CreateChannelMonitor(monitor); err != nil {
		return nil, err
	}
	return monitor, nil
}

func UpdateChannelMonitor(id int, input ChannelMonitorInput) (*model.ChannelMonitor, error) {
	monitor, err := model.GetChannelMonitorByID(id)
	if err != nil {
		return nil, err
	}
	normalized, err := normalizeChannelMonitorInput(input, false)
	if err != nil {
		return nil, err
	}
	if normalized.ApiKey != "" {
		monitor.ApiKeyEncrypted, err = encryptChannelMonitorAPIKey(normalized.ApiKey)
		if err != nil {
			return nil, err
		}
	}
	monitor.Name = normalized.Name
	monitor.ApiURL = normalized.ApiURL
	monitor.TestModel = normalized.TestModel
	monitor.IntervalSeconds = normalized.IntervalSeconds
	monitor.TimeoutSeconds = normalized.TimeoutSeconds
	monitor.Enabled = normalized.Enabled
	monitor.Visible = normalized.Visible
	now := common.GetTimestamp()
	if monitor.Enabled {
		monitor.NextCheckAt = &now
	} else {
		monitor.NextCheckAt = nil
	}
	if err := model.UpdateChannelMonitor(monitor); err != nil {
		return nil, err
	}
	return model.GetChannelMonitorByID(id)
}

func DeleteChannelMonitor(id int) error {
	return model.DeleteChannelMonitor(id)
}

func ListChannelMonitorViews(visibleOnly bool) ([]*ChannelMonitorView, error) {
	monitors, err := model.ListChannelMonitors(visibleOnly)
	if err != nil {
		return nil, err
	}
	views := make([]*ChannelMonitorView, 0, len(monitors))
	for _, monitor := range monitors {
		view, err := buildChannelMonitorView(monitor)
		if err != nil {
			return nil, err
		}
		views = append(views, view)
	}
	return views, nil
}

func GetChannelMonitorView(id int) (*ChannelMonitorView, error) {
	monitor, err := model.GetChannelMonitorByID(id)
	if err != nil {
		return nil, err
	}
	return buildChannelMonitorView(monitor)
}

func buildChannelMonitorView(monitor *model.ChannelMonitor) (*ChannelMonitorView, error) {
	now := common.GetTimestamp()
	view := &ChannelMonitorView{Monitor: monitor, Status: "unknown"}
	latest, err := model.GetLatestChannelMonitorHistory(monitor.Id)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	if err == nil {
		view.Latest = latest
		if latest.Success {
			view.Status = "success"
		} else {
			view.Status = "failed"
		}
	}
	view.Availability7d, err = model.GetChannelMonitorAvailability(monitor.Id, now-7*24*60*60)
	if err != nil {
		return nil, err
	}
	view.Availability30d, err = model.GetChannelMonitorAvailability(monitor.Id, now-30*24*60*60)
	if err != nil {
		return nil, err
	}
	view.RecentResults, err = model.ListChannelMonitorHistory(monitor.Id, 30)
	if err != nil {
		return nil, err
	}
	for left, right := 0, len(view.RecentResults)-1; left < right; left, right = left+1, right-1 {
		view.RecentResults[left], view.RecentResults[right] = view.RecentResults[right], view.RecentResults[left]
	}
	return view, nil
}

func ListChannelMonitorHistory(id int, limit int) ([]*model.ChannelMonitorHistory, error) {
	if _, err := model.GetChannelMonitorByID(id); err != nil {
		return nil, err
	}
	return model.ListChannelMonitorHistory(id, limit)
}

func RunChannelMonitorCheck(ctx context.Context, id int) (*model.ChannelMonitorHistory, error) {
	monitor, err := model.GetChannelMonitorByID(id)
	if err != nil {
		return nil, err
	}
	return runChannelMonitorCheck(ctx, monitor)
}

func runChannelMonitorCheck(ctx context.Context, monitor *model.ChannelMonitor) (*model.ChannelMonitorHistory, error) {
	checkedAt := common.GetTimestamp()
	result := &model.ChannelMonitorHistory{
		MonitorId: monitor.Id,
		CheckedAt: checkedAt,
	}
	apiKey, err := decryptChannelMonitorAPIKey(monitor.ApiKeyEncrypted)
	if err != nil {
		result.ErrorMessage = "API key could not be decrypted; re-enter it in monitor settings"
	} else {
		result.StatusCode, result.LatencyMs, err = executeChannelMonitorRequest(ctx, monitor, apiKey)
		result.Success = err == nil
		if err != nil {
			result.ErrorMessage = truncateChannelMonitorError(err.Error())
		}
	}
	if err := model.SaveChannelMonitorResult(monitor, result); err != nil {
		nextCheckAt := checkedAt + int64(monitor.IntervalSeconds)
		_ = model.ReleaseChannelMonitorLease(monitor.Id, nextCheckAt)
		return nil, err
	}
	return result, nil
}

func executeChannelMonitorRequest(parent context.Context, monitor *model.ChannelMonitor, apiKey string) (int, int, error) {
	body, err := common.Marshal(map[string]any{
		"model": monitor.TestModel,
		"messages": []map[string]string{
			{"role": "user", "content": "ping"},
		},
		"max_tokens": 1,
		"stream":     false,
	})
	if err != nil {
		return 0, 0, err
	}
	ctx, cancel := context.WithTimeout(parent, time.Duration(monitor.TimeoutSeconds)*time.Second)
	defer cancel()
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, channelMonitorRequestURL(monitor.ApiURL), strings.NewReader(string(body)))
	if err != nil {
		return 0, 0, err
	}
	request.Header.Set("Authorization", "Bearer "+apiKey)
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Accept", "application/json")

	startedAt := time.Now()
	response, err := GetSSRFProtectedHTTPClient().Do(request)
	latencyMs := int(time.Since(startedAt).Milliseconds())
	if err != nil {
		return 0, latencyMs, err
	}
	defer response.Body.Close()
	_, _ = io.Copy(io.Discard, io.LimitReader(response.Body, 64*1024))
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return response.StatusCode, latencyMs, fmt.Errorf("upstream returned HTTP %d", response.StatusCode)
	}
	return response.StatusCode, latencyMs, nil
}

func channelMonitorRequestURL(apiURL string) string {
	trimmed := strings.TrimRight(apiURL, "/")
	if strings.HasSuffix(trimmed, "/chat/completions") {
		return trimmed
	}
	if strings.HasSuffix(trimmed, "/v1") {
		return trimmed + "/chat/completions"
	}
	return trimmed + "/v1/chat/completions"
}

func truncateChannelMonitorError(message string) string {
	message = strings.TrimSpace(message)
	if len(message) <= channelMonitorMaxErrorLength {
		return message
	}
	return message[:channelMonitorMaxErrorLength]
}

var channelMonitorRunnerOnce sync.Once

func StartChannelMonitorRunner() {
	if !common.IsMasterNode {
		return
	}
	channelMonitorRunnerOnce.Do(func() {
		go func() {
			ticker := time.NewTicker(channelMonitorRunnerInterval)
			defer ticker.Stop()
			semaphore := make(chan struct{}, channelMonitorMaxConcurrency)
			for range ticker.C {
				now := common.GetTimestamp()
				monitors, err := model.ClaimDueChannelMonitors(now, channelMonitorLeaseSeconds, channelMonitorClaimLimit)
				if err != nil {
					common.SysError("channel monitor scheduler failed: " + err.Error())
					continue
				}
				for _, monitor := range monitors {
					semaphore <- struct{}{}
					go func(claimed *model.ChannelMonitor) {
						defer func() { <-semaphore }()
						if _, err := runChannelMonitorCheck(context.Background(), claimed); err != nil {
							common.SysError(fmt.Sprintf("channel monitor %d failed to persist result: %v", claimed.Id, err))
						}
					}(monitor)
				}
			}
		}()
		common.SysLog("channel monitor scheduler started")
	})
}
