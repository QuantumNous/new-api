package service

// ZCode StartPlan 凭据获取：复用官方桌面端的 zai / bigmodel 设备码 OAuth。

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
)

const (
	ZcodeStartPlanOAuthBaseURL  = "https://zcode.z.ai/api/v1"
	zcodeCliOAuthInitPath       = "/oauth/cli/init"
	zcodeCliOAuthPollPath       = "/oauth/cli/poll/"
	ZcodeOAuthProviderZai       = "zai"
	ZcodeOAuthProviderBigModel  = "bigmodel"
	zcodeCliOAuthRespLimit      = 64 * 1024
	zcodeCliOAuthPollTokenBytes = 32
)

// 测试可替换的上游 base（生产恒为 ZcodeStartPlanOAuthBaseURL）。
var zcodeCliOAuthBaseURL = ZcodeStartPlanOAuthBaseURL

type ZcodeCliOAuthInitResult struct {
	FlowID          string
	PollToken       string
	AuthorizeURL    string
	ExpiresAt       int64
	PollIntervalSec int
}

type ZcodeCliOAuthPollResult struct {
	Status              string // pending | failed | ready
	Token               string
	UserID              string
	Name                string
	Email               string
	Avatar              string
	ZaiAccessToken      string
	BigModelAccessToken string
}

func CreateZcodeCliOAuthPollToken() (string, error) {
	buf := make([]byte, zcodeCliOAuthPollTokenBytes)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return fmt.Sprintf("%x", buf), nil
}

// NormalizeZcodeOAuthProvider 保留旧客户端默认的国际站授权。
func NormalizeZcodeOAuthProvider(provider string) (string, error) {
	provider = strings.TrimSpace(provider)
	if provider == "" {
		return ZcodeOAuthProviderZai, nil
	}
	if provider != ZcodeOAuthProviderZai && provider != ZcodeOAuthProviderBigModel {
		return "", errors.New("unsupported zcode oauth provider")
	}
	return provider, nil
}

func InitZcodeCliOAuth(ctx context.Context, proxyURL, provider string) (*ZcodeCliOAuthInitResult, error) {
	provider, err := NormalizeZcodeOAuthProvider(provider)
	if err != nil {
		return nil, err
	}
	pollToken, err := CreateZcodeCliOAuthPollToken()
	if err != nil {
		return nil, fmt.Errorf("generate poll token: %w", err)
	}
	payload, err := common.Marshal(map[string]string{"provider": provider})
	if err != nil {
		return nil, err
	}
	data, err := doZcodeCliOAuthRequest(ctx, proxyURL, http.MethodPost,
		zcodeCliOAuthBaseURL+zcodeCliOAuthInitPath, pollToken, payload)
	if err != nil {
		return nil, err
	}

	var parsed struct {
		FlowID          string `json:"flow_id"`
		PollToken       string `json:"poll_token"`
		AuthorizeURL    string `json:"authorize_url"`
		ExpiresAt       int64  `json:"expires_at"`
		PollIntervalSec int    `json:"poll_interval_sec"`
	}
	if err := common.Unmarshal(data, &parsed); err != nil {
		return nil, fmt.Errorf("invalid oauth init response data: %w", err)
	}
	// 与 ZCode r6o 校验一致：五个字段缺一不可。
	if parsed.FlowID == "" || parsed.PollToken == "" || parsed.AuthorizeURL == "" ||
		parsed.ExpiresAt == 0 || parsed.PollIntervalSec <= 0 {
		return nil, errors.New("invalid oauth init response data")
	}
	if !strings.HasPrefix(parsed.AuthorizeURL, "https://") {
		return nil, errors.New("oauth init returned non-https authorize_url")
	}
	return &ZcodeCliOAuthInitResult{
		FlowID:          parsed.FlowID,
		PollToken:       parsed.PollToken,
		AuthorizeURL:    parsed.AuthorizeURL,
		ExpiresAt:       parsed.ExpiresAt,
		PollIntervalSec: parsed.PollIntervalSec,
	}, nil
}

func PollZcodeCliOAuth(ctx context.Context, proxyURL, flowID, pollToken, provider string) (*ZcodeCliOAuthPollResult, error) {
	provider, err := NormalizeZcodeOAuthProvider(provider)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(flowID) == "" || strings.TrimSpace(pollToken) == "" {
		return nil, errors.New("missing oauth flow credentials")
	}
	data, err := doZcodeCliOAuthRequest(ctx, proxyURL, http.MethodGet,
		zcodeCliOAuthBaseURL+zcodeCliOAuthPollPath+flowID, pollToken, nil)
	if err != nil {
		return nil, err
	}

	var parsed struct {
		Status string `json:"status"`
		Token  string `json:"token"`
		User   *struct {
			UserID string `json:"user_id"`
			Name   string `json:"name"`
			Email  string `json:"email"`
			Avatar string `json:"avatar"`
		} `json:"user"`
		Zai *struct {
			AccessToken string `json:"access_token"`
		} `json:"zai"`
		BigModel *struct {
			AccessToken      string `json:"access_token"`
			AccessTokenCamel string `json:"accessToken"`
		} `json:"bigmodel"`
	}
	if err := common.Unmarshal(data, &parsed); err != nil {
		return nil, fmt.Errorf("invalid oauth poll response data: %w", err)
	}
	switch parsed.Status {
	case "pending", "failed":
		return &ZcodeCliOAuthPollResult{Status: parsed.Status}, nil
	case "ready":
		var zaiAccessToken, bigModelAccessToken string
		if parsed.Zai != nil {
			zaiAccessToken = strings.TrimSpace(parsed.Zai.AccessToken)
		}
		if parsed.BigModel != nil {
			bigModelAccessToken = strings.TrimSpace(parsed.BigModel.AccessToken)
			if bigModelAccessToken == "" {
				bigModelAccessToken = strings.TrimSpace(parsed.BigModel.AccessTokenCamel)
			}
		}
		accessToken := zaiAccessToken
		if provider == ZcodeOAuthProviderBigModel {
			accessToken = bigModelAccessToken
		}
		if strings.TrimSpace(parsed.Token) == "" || parsed.User == nil ||
			strings.TrimSpace(parsed.User.UserID) == "" || accessToken == "" {
			return nil, errors.New("invalid oauth ready response data")
		}
		return &ZcodeCliOAuthPollResult{
			Status:              "ready",
			Token:               parsed.Token,
			UserID:              parsed.User.UserID,
			Name:                parsed.User.Name,
			Email:               parsed.User.Email,
			Avatar:              parsed.User.Avatar,
			ZaiAccessToken:      zaiAccessToken,
			BigModelAccessToken: bigModelAccessToken,
		}, nil
	default:
		return nil, fmt.Errorf("unknown oauth poll status %q", parsed.Status)
	}
}

func doZcodeCliOAuthRequest(ctx context.Context, proxyURL, method, rawURL, bearer string, body []byte) ([]byte, error) {
	client, err := NewProxyHttpClient(proxyURL)
	if err != nil {
		return nil, err
	}
	var reader io.Reader
	if body != nil {
		reader = bytes.NewReader(body)
	}
	req, err := http.NewRequestWithContext(ctx, method, rawURL, reader)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+bearer)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, zcodeCliOAuthRespLimit))
	if err != nil {
		return nil, err
	}
	var envelope struct {
		Code int             `json:"code"`
		Msg  string          `json:"msg"`
		Data json.RawMessage `json:"data"`
	}
	if err := common.Unmarshal(raw, &envelope); err != nil {
		return nil, fmt.Errorf("invalid oauth response envelope (http %d): %w", resp.StatusCode, err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 || envelope.Code != 0 {
		msg := strings.TrimSpace(envelope.Msg)
		if msg == "" {
			msg = fmt.Sprintf("oauth error (http %d, code %d)", resp.StatusCode, envelope.Code)
		}
		return nil, errors.New(msg)
	}
	return envelope.Data, nil
}

// ExtractZcodeJWTExpiration 解析 JWT payload 的 exp（unix 秒）。
// 兼容带/不带 padding 的 base64url（对齐 ZCode resolveJwtExpiration 的宽松解码）。
func ExtractZcodeJWTExpiration(token string) (int64, bool) {
	parts := strings.Split(strings.TrimSpace(token), ".")
	if len(parts) != 3 {
		return 0, false
	}
	payload := parts[1]
	if m := len(payload) % 4; m != 0 {
		payload += strings.Repeat("=", 4-m)
	}
	raw, err := base64.URLEncoding.DecodeString(payload)
	if err != nil {
		return 0, false
	}
	var claims struct {
		Exp float64 `json:"exp"`
	}
	if err := common.Unmarshal(raw, &claims); err != nil {
		return 0, false
	}
	if claims.Exp <= 0 {
		return 0, false
	}
	return int64(claims.Exp), true
}

// ZcodeJWTRemainingSeconds 返回 JWT 距过期的剩余秒数（已过期为负）。
func ZcodeJWTRemainingSeconds(token string, now time.Time) (int64, bool) {
	exp, ok := ExtractZcodeJWTExpiration(token)
	if !ok {
		return 0, false
	}
	return exp - now.Unix(), true
}
