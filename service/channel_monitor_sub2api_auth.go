package service

import (
	"bytes"
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
)

const (
	maxSub2APIAccountLength  = 320
	maxSub2APIPasswordLength = 4096
)

type sub2APIAccountTokenCacheEntry struct {
	accessToken string
	expiresAt   time.Time
}

type sub2APIAccountTokenCall struct {
	done        chan struct{}
	accessToken string
	err         error
}

var sub2APIAccountTokenCache = struct {
	sync.Mutex
	tokens  map[[32]byte]sub2APIAccountTokenCacheEntry
	pending map[[32]byte]*sub2APIAccountTokenCall
}{
	tokens:  make(map[[32]byte]sub2APIAccountTokenCacheEntry),
	pending: make(map[[32]byte]*sub2APIAccountTokenCall),
}

type sub2APIAccountLoginRequest struct {
	Email          string `json:"email"`
	Password       string `json:"password"`
	TurnstileToken string `json:"turnstile_token"`
}

type sub2APIAccountLoginResult struct {
	AccessToken string `json:"access_token"`
	ExpiresIn   int    `json:"expires_in"`
	Requires2FA bool   `json:"requires_2fa"`
}

func normalizeSub2APIAccountConfig(config Sub2APIGroupRatioConfig) (string, string, string, error) {
	baseURL, err := normalizeSub2APIBaseURL(config.BaseURL)
	if err != nil {
		return "", "", "", err
	}
	account := strings.TrimSpace(config.Account)
	if account == "" {
		return "", "", "", errors.New("请输入 Sub2API 登录邮箱")
	}
	if len([]rune(account)) > maxSub2APIAccountLength {
		return "", "", "", errors.New("Sub2API 登录邮箱过长")
	}
	if config.Password == "" {
		return "", "", "", errors.New("请输入 Sub2API 登录密码")
	}
	if len([]rune(config.Password)) > maxSub2APIPasswordLength {
		return "", "", "", errors.New("Sub2API 登录密码过长")
	}
	return baseURL, account, config.Password, nil
}

func sub2APIAccountTokenCacheKey(baseURL string, account string, password string, proxy string) [32]byte {
	return sha256.Sum256([]byte(baseURL + "\x00" + account + "\x00" + password + "\x00" + strings.TrimSpace(proxy)))
}

func resolveSub2APIAccountTokenConfig(ctx context.Context, client *http.Client, config Sub2APIGroupRatioConfig, validateURL func(string) error) (Sub2APIGroupRatioConfig, error) {
	baseURL, account, password, err := normalizeSub2APIAccountConfig(config)
	if err != nil {
		return Sub2APIGroupRatioConfig{}, err
	}
	cacheKey := sub2APIAccountTokenCacheKey(baseURL, account, password, config.Proxy)

	for {
		now := time.Now()
		sub2APIAccountTokenCache.Lock()
		for key, entry := range sub2APIAccountTokenCache.tokens {
			if !now.Before(entry.expiresAt) {
				delete(sub2APIAccountTokenCache.tokens, key)
			}
		}
		if entry, ok := sub2APIAccountTokenCache.tokens[cacheKey]; ok {
			sub2APIAccountTokenCache.Unlock()
			config.BaseURL = baseURL
			config.AuthType = Sub2APIAuthToken
			config.AccessToken = entry.accessToken
			return config, nil
		}
		if call, ok := sub2APIAccountTokenCache.pending[cacheKey]; ok {
			sub2APIAccountTokenCache.Unlock()
			select {
			case <-ctx.Done():
				return Sub2APIGroupRatioConfig{}, ctx.Err()
			case <-call.done:
				if call.err != nil {
					return Sub2APIGroupRatioConfig{}, call.err
				}
				config.BaseURL = baseURL
				config.AuthType = Sub2APIAuthToken
				config.AccessToken = call.accessToken
				return config, nil
			}
		}
		call := &sub2APIAccountTokenCall{done: make(chan struct{})}
		sub2APIAccountTokenCache.pending[cacheKey] = call
		sub2APIAccountTokenCache.Unlock()

		accessToken, expiresIn, loginErr := loginSub2APIAccount(ctx, client, baseURL, account, password, validateURL)
		if loginErr != nil {
			loginErr = redactUpstreamGroupRatioSecrets(loginErr, account, password)
		}
		sub2APIAccountTokenCache.Lock()
		delete(sub2APIAccountTokenCache.pending, cacheKey)
		call.accessToken = accessToken
		call.err = loginErr
		if loginErr == nil {
			ttl := 5 * time.Minute
			if expiresIn > 0 {
				const maxTokenCacheTTL = 24 * time.Hour
				ttl = time.Duration(expiresIn) * time.Second
				if ttl <= 0 || ttl > maxTokenCacheTTL {
					ttl = maxTokenCacheTTL
				}
				safetyWindow := time.Minute
				if ttl <= 2*time.Minute {
					safetyWindow = ttl / 4
				}
				ttl -= safetyWindow
				if ttl <= 0 {
					ttl = time.Second
				}
			}
			sub2APIAccountTokenCache.tokens[cacheKey] = sub2APIAccountTokenCacheEntry{
				accessToken: accessToken,
				expiresAt:   time.Now().Add(ttl),
			}
		}
		close(call.done)
		sub2APIAccountTokenCache.Unlock()
		if loginErr != nil {
			return Sub2APIGroupRatioConfig{}, loginErr
		}

		config.BaseURL = baseURL
		config.AuthType = Sub2APIAuthToken
		config.AccessToken = accessToken
		return config, nil
	}
}

func invalidateSub2APIAccountToken(config Sub2APIGroupRatioConfig) {
	baseURL, account, password, err := normalizeSub2APIAccountConfig(config)
	if err != nil {
		return
	}
	cacheKey := sub2APIAccountTokenCacheKey(baseURL, account, password, config.Proxy)
	sub2APIAccountTokenCache.Lock()
	delete(sub2APIAccountTokenCache.tokens, cacheKey)
	sub2APIAccountTokenCache.Unlock()
}

func loginSub2APIAccount(ctx context.Context, client *http.Client, baseURL string, account string, password string, validateURL func(string) error) (string, int, error) {
	requestBody, err := common.Marshal(sub2APIAccountLoginRequest{
		Email:    account,
		Password: password,
	})
	if err != nil {
		return "", 0, errors.New("Sub2API 登录请求生成失败")
	}
	requestURL := baseURL + "/api/v1/auth/login"
	if validateURL != nil {
		if err := validateURL(requestURL); err != nil {
			return "", 0, err
		}
	}
	requestContext, cancel := context.WithTimeout(ctx, upstreamGroupRatioTimeout)
	defer cancel()
	httpRequest, err := http.NewRequestWithContext(requestContext, http.MethodPost, requestURL, bytes.NewReader(requestBody))
	if err != nil {
		return "", 0, err
	}
	httpRequest.Header.Set("Accept", "application/json")
	httpRequest.Header.Set("Content-Type", "application/json")

	response, err := client.Do(httpRequest)
	if err != nil {
		return "", 0, fmt.Errorf("Sub2API 账号密码自动登录失败: %w", err)
	}
	defer response.Body.Close()
	responseBody, err := io.ReadAll(io.LimitReader(response.Body, maxUpstreamGroupRatioResponseBytes+1))
	if err != nil {
		return "", 0, fmt.Errorf("Sub2API 账号密码自动登录失败: %w", err)
	}
	if len(responseBody) > maxUpstreamGroupRatioResponseBytes {
		return "", 0, errors.New("Sub2API 登录响应过大")
	}
	bodyText := strings.ToLower(string(responseBody))
	cloudflareChallenge := strings.EqualFold(strings.TrimSpace(response.Header.Get("cf-mitigated")), "challenge") ||
		((response.StatusCode == http.StatusForbidden || response.StatusCode == http.StatusServiceUnavailable) &&
			(strings.Contains(bodyText, "/cdn-cgi/challenge-platform") ||
				strings.Contains(bodyText, "cf-chl-") ||
				(strings.Contains(bodyText, "cloudflare") && strings.Contains(bodyText, "challenge"))))
	if cloudflareChallenge {
		return "", 0, &channelMonitorUpstreamAuthenticationError{cause: errors.New("Sub2API 账号密码自动登录触发了 Cloudflare 人机验证，无法进行无人值守登录，请改用手动 Token")}
	}

	var payload sub2APIResponse
	if err := common.Unmarshal(responseBody, &payload); err != nil {
		if response.StatusCode == http.StatusForbidden {
			return "", 0, &channelMonitorUpstreamAuthenticationError{cause: errors.New("Sub2API 账号密码自动登录被上游拒绝；如果启用了 Cloudflare Turnstile、WAF 人机验证或其他验证码，无法进行无人值守登录，请改用手动 Token")}
		}
		return "", 0, fmt.Errorf("Sub2API 登录响应格式无效: 上游返回 %s", response.Status)
	}
	if response.StatusCode != http.StatusOK || payload.Code != 0 {
		reason := strings.ToUpper(strings.TrimSpace(payload.Reason))
		message := strings.TrimSpace(payload.Message)
		lowerMessage := strings.ToLower(message)
		if strings.Contains(reason, "TOTP") || strings.Contains(reason, "2FA") ||
			strings.Contains(lowerMessage, "totp") || strings.Contains(lowerMessage, "2fa") ||
			strings.Contains(message, "两步验证") || strings.Contains(message, "二次验证") {
			return "", 0, &channelMonitorUpstreamAuthenticationError{cause: errors.New("Sub2API 账号已开启 TOTP 两步验证，无法仅凭账号密码自动登录，请改用手动 Token 或未启用两步验证的专用账号")}
		}
		if strings.Contains(reason, "TURNSTILE") || strings.Contains(reason, "CAPTCHA") ||
			strings.Contains(lowerMessage, "turnstile") || strings.Contains(lowerMessage, "captcha") ||
			strings.Contains(message, "验证码") {
			return "", 0, &channelMonitorUpstreamAuthenticationError{cause: errors.New("上游已开启 Cloudflare Turnstile 或验证码，账号密码无法完成无人值守登录，请改用手动 Token 或为监控使用未启用交互验证的专用账号")}
		}
		if message == "" {
			message = response.Status
		}
		upstreamErr := fmt.Errorf("Sub2API 账号密码自动登录失败: %w", upstreamGroupRatioMessage(message))
		if response.StatusCode == http.StatusUnauthorized || response.StatusCode == http.StatusForbidden ||
			payload.Code == http.StatusUnauthorized || payload.Code == http.StatusForbidden || reason == "INVALID_CREDENTIALS" {
			return "", 0, &channelMonitorUpstreamAuthenticationError{cause: upstreamErr}
		}
		return "", 0, upstreamErr
	}

	var result sub2APIAccountLoginResult
	if err := common.Unmarshal(payload.Data, &result); err != nil {
		return "", 0, errors.New("Sub2API 登录响应格式无效")
	}
	if result.Requires2FA {
		return "", 0, &channelMonitorUpstreamAuthenticationError{cause: errors.New("Sub2API 账号已开启 TOTP 两步验证，无法仅凭账号密码自动登录，请改用手动 Token 或未启用两步验证的专用账号")}
	}
	accessToken := strings.TrimSpace(result.AccessToken)
	if accessToken == "" {
		return "", 0, errors.New("Sub2API 登录成功但未返回访问 Token")
	}
	return accessToken, result.ExpiresIn, nil
}
