package controller

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// ProxyUpstreamPricing fetches {base_url}/api/pricing from the server side
// (avoiding browser CORS restrictions) and returns the group_ratio map.
// Query param: base_url (required)
func ProxyUpstreamPricing(c *gin.Context) {
	baseURL := strings.TrimRight(c.Query("base_url"), "/")
	apiKey := ""

	if channelID, err := strconv.Atoi(strings.TrimSpace(c.Query("channel_id"))); err == nil && channelID > 0 {
		if channel, err := model.GetChannelById(channelID, true); err == nil && channel != nil {
			apiKey = firstChannelAPIKey(channel.Key)
			if baseURL == "" && channel.BaseURL != nil {
				baseURL = strings.TrimRight(*channel.BaseURL, "/")
			}
		}
	}

	if baseURL == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "base_url is required"})
		return
	}

	// Resolve the root URL that hosts /api/pricing.
	// Many channels use base_url = "https://host/v1" but /api/pricing lives at "https://host".
	rootURL := resolvePricingRoot(baseURL)

	client := &http.Client{Timeout: 10 * time.Second}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	groupRatio, err := fetchGroupRatio(ctx, client, rootURL, apiKey)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"success": false, "message": err.Error()})
		return
	}
	if groupRatio == nil {
		// Upstream doesn't expose /api/pricing — not an error, just not supported.
		c.JSON(http.StatusOK, gin.H{"success": false, "no_pricing_api": true, "message": "upstream does not expose /api/pricing"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": groupRatio})
}

// resolvePricingRoot strips common API path suffixes (/v1, /v2, etc.) so that
// {root}/api/pricing is attempted first, then the original base_url.
func resolvePricingRoot(baseURL string) string {
	for _, suffix := range []string{"/v1", "/v2", "/v3", "/api/v1", "/openai/v1"} {
		if strings.HasSuffix(baseURL, suffix) {
			return strings.TrimSuffix(baseURL, suffix)
		}
	}
	return baseURL
}

// fetchGroupRatio tries {rootURL}/api/pricing and returns group_ratio map.
// Returns (nil, nil) if the endpoint doesn't exist (404/403 without JSON).
func fetchGroupRatio(ctx context.Context, client *http.Client, rootURL string, apiKey string) (map[string]float64, error) {
	url := rootURL + "/api/pricing"
	groupRatio, status, err := fetchGroupRatioOnce(ctx, client, url, apiKey)
	if err != nil {
		return nil, err
	}
	if status == http.StatusUnauthorized && apiKey != "" {
		// Some relays reject Bearer auth for public pricing; keep the old
		// anonymous behavior as a fallback after the authenticated attempt.
		groupRatio, status, err = fetchGroupRatioOnce(ctx, client, url, "")
		if err != nil {
			return nil, err
		}
	}
	if status == http.StatusNotFound {
		return nil, nil
	}
	if status != http.StatusOK {
		return nil, fmt.Errorf("upstream returned HTTP %d", status)
	}
	return groupRatio, nil
}

func fetchGroupRatioOnce(ctx context.Context, client *http.Client, url string, apiKey string) (map[string]float64, int, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, 0, fmt.Errorf("invalid url: %v", err)
	}
	req.Header.Set("Accept", "application/json")
	if apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+apiKey)
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, 0, fmt.Errorf("upstream request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, resp.StatusCode, nil
	}

	var parsed struct {
		GroupRatio map[string]float64 `json:"group_ratio"`
	}
	if err := common.DecodeJson(resp.Body, &parsed); err != nil {
		return nil, resp.StatusCode, fmt.Errorf("decode failed: %v", err)
	}
	return parsed.GroupRatio, resp.StatusCode, nil
}

func firstChannelAPIKey(key string) string {
	for _, part := range strings.Split(key, "\n") {
		if trimmed := strings.TrimSpace(part); trimmed != "" {
			return trimmed
		}
	}
	return ""
}
