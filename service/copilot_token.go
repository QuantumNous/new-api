package service

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/cachex"

	"github.com/samber/hot"
	"golang.org/x/sync/singleflight"
)

const (
	copilotTokenNamespace = "copilot_token:v1"
	copilotTokenTimeout   = 10 * time.Second
	copilotRefreshMargin  = 60 * time.Second
)

var copilotTokenEndpoint = "https://api.github.com/copilot_internal/v2/token"

type copilotTokenResponse struct {
	Token     string `json:"token"`
	ExpiresAt int64  `json:"expires_at"`
}

var (
	copilotTokenCacheOnce sync.Once
	copilotTokenCache     *cachex.HybridCache[string]
	copilotTokenGroup     singleflight.Group
)

func getCopilotTokenCache() *cachex.HybridCache[string] {
	copilotTokenCacheOnce.Do(func() {
		copilotTokenCache = cachex.NewHybridCache(cachex.HybridCacheConfig[string]{
			Namespace:  cachex.Namespace(copilotTokenNamespace),
			Redis:      common.RDB,
			RedisCodec: cachex.StringCodec{},
			RedisEnabled: func() bool {
				return common.RedisEnabled && common.RDB != nil
			},
			Memory: func() *hot.HotCache[string, string] {
				return hot.NewHotCache[string, string](hot.LRU, 4096).
					WithTTL(time.Hour).
					WithJanitor().
					Build()
			},
		})
	})
	return copilotTokenCache
}

// ResolveCopilotAccessToken exchanges a GitHub credential for a short-lived
// Copilot access token. Raw credentials never appear in cache keys or errors.
func ResolveCopilotAccessToken(ctx context.Context, channelID int, keyIndex int, githubCredential string, proxyURL string) (string, error) {
	credential := strings.TrimSpace(githubCredential)
	if channelID <= 0 || keyIndex < 0 || credential == "" {
		return "", errors.New("copilot credential is missing")
	}

	cacheKey := copilotTokenCacheKey(channelID, keyIndex, credential)
	if token, found, err := getCopilotTokenCache().Get(cacheKey); err == nil && found && token != "" {
		return token, nil
	}

	value, err, _ := copilotTokenGroup.Do(cacheKey, func() (any, error) {
		if token, found, cacheErr := getCopilotTokenCache().Get(cacheKey); cacheErr == nil && found && token != "" {
			return token, nil
		}
		return exchangeCopilotToken(ctx, credential, proxyURL, cacheKey)
	})
	if err != nil {
		return "", err
	}
	return value.(string), nil
}

func exchangeCopilotToken(ctx context.Context, credential string, proxyURL string, cacheKey string) (string, error) {
	client, err := copilotHTTPClient(proxyURL, copilotTokenTimeout)
	if err != nil {
		return "", errors.New("copilot token exchange client is unavailable")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, copilotTokenEndpoint, nil)
	if err != nil {
		return "", errors.New("copilot token exchange request could not be created")
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+credential)
	req.Header.Set("User-Agent", "new-api-copilot-channel")
	req.Header.Set("Editor-Version", "vscode/1.105.1")
	req.Header.Set("Editor-Plugin-Version", "copilot-chat/0.32.4")
	req.Header.Set("Copilot-Integration-Id", "vscode-chat")

	resp, err := client.Do(req)
	if err != nil {
		return "", errors.New("copilot token exchange request failed")
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("copilot token exchange failed with status %d", resp.StatusCode)
	}

	var payload copilotTokenResponse
	if err := common.DecodeJson(resp.Body, &payload); err != nil {
		return "", errors.New("copilot token exchange returned an invalid response")
	}
	payload.Token = strings.TrimSpace(payload.Token)
	if payload.Token == "" {
		return "", errors.New("copilot token exchange returned no token")
	}
	ttl := time.Until(time.Unix(payload.ExpiresAt, 0)) - copilotRefreshMargin - copilotTokenJitter(cacheKey)
	if ttl <= 0 {
		return "", errors.New("copilot token exchange returned an expired token")
	}
	if err := getCopilotTokenCache().SetWithTTL(cacheKey, payload.Token, ttl); err != nil {
		return "", errors.New("copilot token cache is unavailable")
	}
	return payload.Token, nil
}

func copilotTokenJitter(cacheKey string) time.Duration {
	sum := sha256.Sum256([]byte(cacheKey))
	return time.Duration(uint16(sum[0])<<8|uint16(sum[1])) % (15 * time.Second)
}

func copilotHTTPClient(proxyURL string, timeout time.Duration) (*http.Client, error) {
	base, err := GetHttpClientWithProxy(strings.TrimSpace(proxyURL))
	if err != nil {
		return nil, err
	}
	copy := *base
	copy.Timeout = timeout
	return &copy, nil
}

func copilotTokenCacheKey(channelID int, keyIndex int, credential string) string {
	mac := hmac.New(sha256.New, []byte(common.SessionSecret))
	_, _ = mac.Write([]byte(credential))
	fingerprint := fmt.Sprintf("%x", mac.Sum(nil))
	return strconv.Itoa(channelID) + ":" + strconv.Itoa(keyIndex) + ":" + fingerprint
}

// InvalidateCopilotTokenCache removes every cached short token for a channel.
func InvalidateCopilotTokenCache(channelID int) error {
	if channelID <= 0 {
		return nil
	}
	_, err := getCopilotTokenCache().DeleteByPrefix(strconv.Itoa(channelID))
	return err
}
