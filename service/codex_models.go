package service

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"golang.org/x/sync/singleflight"
)

const (
	codexLatestReleaseURL        = "https://api.github.com/repos/openai/codex/releases/latest"
	codexClientVersionCacheTTL   = time.Hour
	codexClientVersionFailureTTL = 30 * time.Second
	codexModelsResponseMaxBytes  = 4 << 20
)

type codexClientVersionCache struct {
	sync.Mutex
	fetchGroup singleflight.Group
	version    string
	expiresAt  time.Time
	lastError  string
	retryAt    time.Time
}

var latestCodexClientVersion codexClientVersionCache

func GetLatestCodexClientVersion(ctx context.Context, client *http.Client) (string, error) {
	return latestCodexClientVersion.get(ctx, client, codexLatestReleaseURL, time.Now())
}

func (cache *codexClientVersionCache) get(
	ctx context.Context,
	client *http.Client,
	releaseURL string,
	now time.Time,
) (string, error) {
	cache.Lock()
	if cache.version != "" && now.Before(cache.expiresAt) {
		version := cache.version
		cache.Unlock()
		return version, nil
	}
	if cache.version == "" && cache.lastError != "" && now.Before(cache.retryAt) {
		err := fmt.Errorf("%s", cache.lastError)
		cache.Unlock()
		return "", err
	}
	cache.Unlock()

	value, err, _ := cache.fetchGroup.Do(releaseURL, func() (any, error) {
		cache.Lock()
		if cache.version != "" && now.Before(cache.expiresAt) {
			version := cache.version
			cache.Unlock()
			return version, nil
		}
		if cache.version == "" && cache.lastError != "" && now.Before(cache.retryAt) {
			err := fmt.Errorf("%s", cache.lastError)
			cache.Unlock()
			return "", err
		}
		cache.Unlock()

		version, fetchErr := fetchLatestCodexClientVersion(ctx, client, releaseURL)
		cache.Lock()
		defer cache.Unlock()
		if fetchErr != nil {
			if cache.version != "" {
				common.SysError(fmt.Sprintf("Codex client version lookup failed; using stale version %s: %v", cache.version, fetchErr))
				cache.expiresAt = now.Add(codexClientVersionCacheTTL)
				return cache.version, nil
			}
			cache.lastError = fetchErr.Error()
			cache.retryAt = now.Add(codexClientVersionFailureTTL)
			return "", fetchErr
		}

		cache.version = version
		cache.expiresAt = now.Add(codexClientVersionCacheTTL)
		cache.lastError = ""
		cache.retryAt = time.Time{}
		return version, nil
	})
	if err != nil {
		return "", err
	}
	return value.(string), nil
}

func fetchLatestCodexClientVersion(ctx context.Context, client *http.Client, releaseURL string) (string, error) {
	if client == nil {
		return "", fmt.Errorf("nil http client")
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, releaseURL, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "new-api")

	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return "", fmt.Errorf("codex release lookup failed: status=%d", resp.StatusCode)
	}

	var release struct {
		Name       string `json:"name"`
		Draft      bool   `json:"draft"`
		Prerelease bool   `json:"prerelease"`
	}
	if err := common.DecodeJson(resp.Body, &release); err != nil {
		return "", err
	}
	if release.Draft || release.Prerelease {
		return "", fmt.Errorf("latest codex release is not stable")
	}
	version := strings.TrimSpace(release.Name)
	if version == "" {
		return "", fmt.Errorf("latest codex release has no version name")
	}
	return version, nil
}

func FetchCodexModels(
	ctx context.Context,
	client *http.Client,
	baseURL string,
	oauthKey *CodexOAuthKey,
	clientVersion string,
) (statusCode int, models []string, err error) {
	if client == nil {
		return 0, nil, fmt.Errorf("nil http client")
	}
	if oauthKey == nil {
		return 0, nil, fmt.Errorf("nil oauth key")
	}

	baseURL = strings.TrimRight(strings.TrimSpace(baseURL), "/")
	accessToken := strings.TrimSpace(oauthKey.AccessToken)
	accountID := strings.TrimSpace(oauthKey.AccountID)
	clientVersion = strings.TrimSpace(clientVersion)
	if baseURL == "" {
		return 0, nil, fmt.Errorf("empty baseURL")
	}
	if accessToken == "" {
		return 0, nil, fmt.Errorf("codex channel: access_token is required")
	}
	if accountID == "" {
		return 0, nil, fmt.Errorf("codex channel: account_id is required")
	}
	if clientVersion == "" {
		return 0, nil, fmt.Errorf("codex channel: client_version is required")
	}

	modelsURL, err := url.Parse(baseURL + "/backend-api/codex/models")
	if err != nil {
		return 0, nil, err
	}
	query := modelsURL.Query()
	query.Set("client_version", clientVersion)
	modelsURL.RawQuery = query.Encode()
	fetchSetting := system_setting.GetFetchSetting()
	if err := common.ValidateURLWithFetchSetting(
		modelsURL.String(),
		fetchSetting.EnableSSRFProtection,
		fetchSetting.AllowPrivateIp,
		fetchSetting.DomainFilterMode,
		fetchSetting.IpFilterMode,
		fetchSetting.DomainList,
		fetchSetting.IpList,
		fetchSetting.AllowedPorts,
		fetchSetting.ApplyIPFilterForDomain,
	); err != nil {
		return 0, nil, fmt.Errorf("codex models URL rejected: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, modelsURL.String(), nil)
	if err != nil {
		return 0, nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("ChatGPT-Account-Id", accountID)
	req.Header.Set("User-Agent", "codex-cli/"+clientVersion)
	req.Header.Set("Accept", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return 0, nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return resp.StatusCode, nil, nil
	}

	var result struct {
		Models []struct {
			Slug string `json:"slug"`
		} `json:"models"`
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, codexModelsResponseMaxBytes+1))
	if err != nil {
		return resp.StatusCode, nil, err
	}
	if len(body) > codexModelsResponseMaxBytes {
		return resp.StatusCode, nil, fmt.Errorf("codex models response exceeds %d bytes", codexModelsResponseMaxBytes)
	}
	if err := common.Unmarshal(body, &result); err != nil {
		return resp.StatusCode, nil, err
	}

	seen := make(map[string]struct{}, len(result.Models))
	models = make([]string, 0, len(result.Models))
	for _, item := range result.Models {
		slug := strings.TrimSpace(item.Slug)
		if slug == "" {
			continue
		}
		if _, ok := seen[slug]; ok {
			continue
		}
		seen[slug] = struct{}{}
		models = append(models, slug)
	}
	return resp.StatusCode, models, nil
}
