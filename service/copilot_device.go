package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/cachex"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/go-redis/redis/v8"
)

const (
	copilotDeviceNamespace = "copilot_device:v1"
	copilotDeviceTimeout   = 10 * time.Second
	copilotDeviceClaimTTL  = 30 * time.Second
)

var (
	copilotDeviceStartEndpoint = "https://github.com/login/device/code"
	copilotDeviceTokenEndpoint = "https://github.com/login/oauth/access_token"
)

type CopilotDeviceStart struct {
	FlowID          string `json:"-"`
	VerificationURI string `json:"verification_uri"`
	UserCode        string `json:"user_code"`
	ExpiresIn       int    `json:"expires_in"`
	Interval        int    `json:"interval"`
}

type CopilotDevicePoll struct {
	Status  string `json:"status"`
	Message string `json:"message"`
}

type copilotDeviceSession struct {
	DeviceCode string `json:"device_code"`
	ClientID   string `json:"client_id"`
	AdminID    int    `json:"admin_id"`
	ChannelID  int    `json:"channel_id"`
	ExpiresAt  int64  `json:"expires_at"`
	Interval   int    `json:"interval"`
	NextPollAt int64  `json:"next_poll_at"`
}

type copilotDeviceCodeResponse struct {
	DeviceCode      string `json:"device_code"`
	UserCode        string `json:"user_code"`
	VerificationURI string `json:"verification_uri"`
	ExpiresIn       int    `json:"expires_in"`
	Interval        int    `json:"interval"`
}

type copilotDeviceTokenResponse struct {
	AccessToken      string `json:"access_token"`
	Error            string `json:"error"`
	ErrorDescription string `json:"error_description"`
	Interval         int    `json:"interval"`
}

func StartCopilotDeviceFlow(ctx context.Context, adminID int, channelID int, proxyURL string) (*CopilotDeviceStart, error) {
	if adminID <= 0 || channelID <= 0 {
		return nil, errors.New("invalid copilot device flow owner")
	}
	clientID := copilotDeviceClientID()
	if clientID == "" {
		return nil, errors.New("Copilot Device Flow is not configured; configure the Copilot Client ID")
	}
	if !copilotDeviceRedisAvailable() {
		return nil, errors.New("Copilot Device Flow requires Redis")
	}
	client, err := copilotHTTPClient(proxyURL, copilotDeviceTimeout)
	if err != nil {
		return nil, errors.New("copilot device authorization client is unavailable")
	}
	form := url.Values{"client_id": {clientID}, "scope": {"read:user"}}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, copilotDeviceStartEndpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return nil, errors.New("copilot device authorization request could not be created")
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("User-Agent", "new-api-copilot-channel")
	resp, err := client.Do(req)
	if err != nil {
		return nil, errors.New("copilot device authorization request failed")
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("copilot device authorization failed with status %d", resp.StatusCode)
	}

	var payload copilotDeviceCodeResponse
	if err := common.DecodeJson(resp.Body, &payload); err != nil {
		return nil, errors.New("copilot device authorization returned an invalid response")
	}
	if payload.DeviceCode == "" || payload.UserCode == "" || payload.VerificationURI == "" || payload.ExpiresIn <= 0 {
		return nil, errors.New("copilot device authorization response is incomplete")
	}
	if payload.Interval <= 0 {
		payload.Interval = 5
	}
	flowID, err := randomCopilotFlowID()
	if err != nil {
		return nil, errors.New("copilot device authorization session could not be created")
	}
	session := copilotDeviceSession{
		DeviceCode: payload.DeviceCode, ClientID: clientID, AdminID: adminID, ChannelID: channelID,
		ExpiresAt: time.Now().Add(time.Duration(payload.ExpiresIn) * time.Second).Unix(), Interval: payload.Interval,
	}
	encoded, err := common.Marshal(session)
	if err != nil {
		return nil, errors.New("copilot device authorization session could not be encoded")
	}
	if err := common.RDB.Set(ctx, copilotDeviceSessionKey(flowID), string(encoded), time.Duration(payload.ExpiresIn)*time.Second).Err(); err != nil {
		return nil, errors.New("copilot device authorization session could not be saved")
	}
	return &CopilotDeviceStart{FlowID: flowID, VerificationURI: payload.VerificationURI, UserCode: payload.UserCode, ExpiresIn: payload.ExpiresIn, Interval: payload.Interval}, nil
}

func PollCopilotDeviceFlow(ctx context.Context, flowID string, adminID int, channelID int, proxyURL string) (*CopilotDevicePoll, error) {
	if !copilotDeviceRedisAvailable() {
		return nil, errors.New("Copilot Device Flow requires Redis")
	}
	session, found, err := loadCopilotDeviceSession(ctx, flowID)
	if err != nil {
		return nil, errors.New("copilot device authorization session is unavailable")
	}
	if !found {
		return &CopilotDevicePoll{Status: "expired", Message: "authorization session expired"}, nil
	}
	if session.ClientID == "" {
		return nil, errors.New("copilot device authorization session is invalid")
	}
	now := time.Now()
	if err := validateCopilotDeviceSession(session, adminID, channelID, now); err != nil {
		if errors.Is(err, errCopilotDeviceExpired) {
			_ = deleteCopilotDeviceFlow(ctx, flowID)
			return &CopilotDevicePoll{Status: "expired", Message: "authorization session expired"}, nil
		}
		return nil, err
	}
	if now.Unix() >= session.ExpiresAt {
		_ = deleteCopilotDeviceFlow(ctx, flowID)
		return &CopilotDevicePoll{Status: "expired", Message: "authorization session expired"}, nil
	}
	if now.Unix() < session.NextPollAt {
		return &CopilotDevicePoll{Status: "pending", Message: "authorization pending"}, nil
	}
	releaseClaim, claimed, err := claimCopilotDeviceFlow(ctx, flowID)
	if err != nil {
		return nil, err
	}
	if !claimed {
		return &CopilotDevicePoll{Status: "pending", Message: "authorization pending"}, nil
	}
	defer releaseClaim()
	session, stillPresent, cacheErr := loadCopilotDeviceSession(ctx, flowID)
	if cacheErr != nil {
		return nil, errors.New("copilot device authorization session is unavailable")
	}
	if !stillPresent {
		return &CopilotDevicePoll{Status: "expired", Message: "authorization session expired"}, nil
	}
	if session.ClientID == "" {
		return nil, errors.New("copilot device authorization session is invalid")
	}
	now = time.Now()
	if err := validateCopilotDeviceSession(session, adminID, channelID, now); err != nil {
		if errors.Is(err, errCopilotDeviceExpired) {
			_ = deleteCopilotDeviceFlow(ctx, flowID)
			return &CopilotDevicePoll{Status: "expired", Message: "authorization session expired"}, nil
		}
		return nil, err
	}
	if now.Unix() < session.NextPollAt {
		return &CopilotDevicePoll{Status: "pending", Message: "authorization pending"}, nil
	}

	client, err := copilotHTTPClient(proxyURL, copilotDeviceTimeout)
	if err != nil {
		return nil, errors.New("copilot device authorization client is unavailable")
	}
	form := url.Values{
		"client_id":   {session.ClientID},
		"device_code": {session.DeviceCode},
		"grant_type":  {"urn:ietf:params:oauth:grant-type:device_code"},
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, copilotDeviceTokenEndpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return nil, errors.New("copilot device authorization poll could not be created")
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("User-Agent", "new-api-copilot-channel")
	resp, err := client.Do(req)
	if err != nil {
		return nil, errors.New("copilot device authorization poll failed")
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("copilot device authorization poll failed with status %d", resp.StatusCode)
	}
	var payload copilotDeviceTokenResponse
	if err := common.DecodeJson(resp.Body, &payload); err != nil {
		return nil, errors.New("copilot device authorization poll returned an invalid response")
	}
	if token := strings.TrimSpace(payload.AccessToken); token != "" {
		if !strings.HasPrefix(token, "gho_") {
			return nil, errors.New("copilot device authorization returned an unsupported credential")
		}
		if err := modelUpdateCopilotCredential(channelID, token); err != nil {
			return nil, err
		}
		if err := consumeCopilotDeviceFlow(ctx, flowID); err != nil {
			common.SysError("copilot device authorization session cleanup failed: " + err.Error())
		}
		return &CopilotDevicePoll{Status: "authorized", Message: "authorization completed"}, nil
	}

	switch payload.Error {
	case "authorization_pending", "":
		session.NextPollAt = now.Add(time.Duration(session.Interval) * time.Second).Unix()
		if err := saveCopilotDeviceSession(flowID, session); err != nil {
			return nil, err
		}
		return &CopilotDevicePoll{Status: "pending", Message: "authorization pending"}, nil
	case "slow_down":
		session.Interval += 5
		if payload.Interval > session.Interval {
			session.Interval = payload.Interval
		}
		session.NextPollAt = now.Add(time.Duration(session.Interval) * time.Second).Unix()
		if err := saveCopilotDeviceSession(flowID, session); err != nil {
			return nil, err
		}
		return &CopilotDevicePoll{Status: "pending", Message: "authorization pending"}, nil
	case "expired_token":
		_ = deleteCopilotDeviceFlow(ctx, flowID)
		return &CopilotDevicePoll{Status: "expired", Message: "authorization session expired"}, nil
	case "access_denied":
		_ = deleteCopilotDeviceFlow(ctx, flowID)
		return &CopilotDevicePoll{Status: "denied", Message: "authorization denied"}, nil
	default:
		return nil, errors.New("copilot device authorization was not completed")
	}
}

func copilotDeviceClientID() string {
	return strings.TrimSpace(system_setting.GetCopilotSettings().ClientID)
}

func claimCopilotDeviceFlow(ctx context.Context, flowID string) (release func(), claimed bool, err error) {
	if copilotDeviceRedisAvailable() {
		key := copilotDeviceClaimKey(flowID)
		token, tokenErr := randomCopilotFlowID()
		if tokenErr != nil {
			return nil, false, errors.New("copilot device authorization claim could not be created")
		}
		ok, setErr := common.RDB.SetNX(ctx, key, token, copilotDeviceClaimTTL).Result()
		if setErr != nil {
			return nil, false, errors.New("copilot device authorization claim is unavailable")
		}
		release = func() {
			const compareAndDelete = `if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) else return 0 end`
			_, _ = common.RDB.Eval(context.Background(), compareAndDelete, []string{key}, token).Result()
		}
		return release, ok, nil
	}
	return nil, false, errors.New("Copilot Device Flow requires Redis")
}

func saveCopilotDeviceSession(flowID string, session copilotDeviceSession) error {
	encoded, err := common.Marshal(session)
	if err != nil {
		return errors.New("copilot device authorization session could not be encoded")
	}
	ttl := time.Until(time.Unix(session.ExpiresAt, 0))
	if ttl <= 0 {
		_ = deleteCopilotDeviceFlow(context.Background(), flowID)
		return nil
	}
	if !copilotDeviceRedisAvailable() {
		return errors.New("Copilot Device Flow requires Redis")
	}
	if err := common.RDB.Set(context.Background(), copilotDeviceSessionKey(flowID), string(encoded), ttl).Err(); err != nil {
		return errors.New("copilot device authorization session could not be saved")
	}
	return nil
}

func deleteCopilotDeviceFlow(ctx context.Context, flowID string) error {
	if !copilotDeviceRedisAvailable() {
		return errors.New("Copilot Device Flow requires Redis")
	}
	return common.RDB.Del(ctx, copilotDeviceSessionKey(flowID)).Err()
}

func consumeCopilotDeviceFlow(ctx context.Context, flowID string) error {
	deleted, err := common.RDB.Del(ctx, copilotDeviceSessionKey(flowID)).Result()
	if err != nil {
		return err
	}
	if deleted != 1 {
		return errors.New("copilot device authorization session was already consumed")
	}
	return nil
}

var errCopilotDeviceExpired = errors.New("copilot device authorization session expired")

func validateCopilotDeviceSession(session copilotDeviceSession, adminID int, channelID int, now time.Time) error {
	if session.AdminID != adminID || session.ChannelID != channelID {
		return errors.New("copilot device authorization session does not match")
	}
	if session.DeviceCode == "" || session.ExpiresAt <= now.Unix() {
		return errCopilotDeviceExpired
	}
	return nil
}

func loadCopilotDeviceSession(ctx context.Context, flowID string) (copilotDeviceSession, bool, error) {
	var session copilotDeviceSession
	raw, err := common.RDB.Get(ctx, copilotDeviceSessionKey(strings.TrimSpace(flowID))).Result()
	if errors.Is(err, redis.Nil) {
		return session, false, nil
	}
	if err != nil {
		return session, false, err
	}
	if err := common.Unmarshal([]byte(raw), &session); err != nil {
		return session, false, errors.New("copilot device authorization session is invalid")
	}
	return session, true, nil
}

func copilotDeviceRedisAvailable() bool { return common.RedisEnabled && common.RDB != nil }

func copilotHTTPClient(proxyURL string, timeout time.Duration) (*http.Client, error) {
	base, err := GetHttpClientWithProxy(strings.TrimSpace(proxyURL))
	if err != nil {
		return nil, err
	}
	client := *base
	client.Timeout = timeout
	return &client, nil
}

func copilotDeviceSessionKey(flowID string) string {
	return cachex.Namespace(copilotDeviceNamespace).FullKey("session:" + flowID)
}
func copilotDeviceClaimKey(flowID string) string {
	return cachex.Namespace(copilotDeviceNamespace).FullKey("claim:" + flowID)
}

func randomCopilotFlowID() (string, error) {
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// Kept behind a small function to make the credential write path explicit and testable.
var modelUpdateCopilotCredential = func(channelID int, credential string) error {
	if err := model.UpdateChannelKeyForType(channelID, constant.ChannelTypeCopilot, credential); err != nil {
		return err
	}
	// UpdateChannelKey publishes to peer replicas, but the publisher ignores its
	// own Pub/Sub event. Refresh this replica now instead of waiting for the
	// periodic channel-cache sync.
	model.InitChannelCache()
	return nil
}
