package yksd

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/service"

	"github.com/tidwall/gjson"
)

type httpDoer interface {
	Do(req *http.Request) (*http.Response, error)
}

type assetClient struct {
	baseURL    string
	apiKey     string
	httpClient httpDoer
	pollEvery  time.Duration
	pollLimit  time.Duration
	now        func() time.Time
	sleep      func(time.Duration)
}

func newAssetClient(baseURL, apiKey string) *assetClient {
	return &assetClient{
		baseURL:    apiOrigin(baseURL),
		apiKey:     strings.TrimSpace(apiKey),
		httpClient: service.GetHttpClient(),
		pollEvery:  time.Duration(assetPollIntervalMS) * time.Millisecond,
		pollLimit:  time.Duration(assetPollTimeoutMS) * time.Millisecond,
		now:        time.Now,
		sleep:      time.Sleep,
	}
}

type assetInfo struct {
	AssetID      string
	Status       string
	ErrorMessage string
}

func (c *assetClient) upload(assetType, url, name string) (*assetInfo, error) {
	payload := map[string]interface{}{
		"assetType": assetType,
		"url":       url,
	}
	if n := truncateName(name); n != "" {
		payload["name"] = n
	}
	raw, err := c.postJSON(assetUpload, payload)
	if err != nil {
		return nil, err
	}
	info := parseAssetInfo(raw)
	if info.AssetID == "" {
		if msg := extractAssetError(raw); msg != "" {
			return nil, fmt.Errorf("asset upload failed: %s", msg)
		}
		return nil, fmt.Errorf("asset upload failed: empty assetId; body=%s", truncateBody(raw))
	}
	return info, nil
}

func (c *assetClient) detail(assetID string) (*assetInfo, error) {
	id := normalizeAssetID(assetID)
	if id == "" {
		return nil, fmt.Errorf("empty assetId")
	}
	raw, err := c.postJSON(assetDetail, map[string]interface{}{"assetId": id})
	if err != nil {
		return nil, err
	}
	info := parseAssetInfo(raw)
	if info.AssetID == "" {
		info.AssetID = id
	}
	return info, nil
}

func (c *assetClient) waitActive(assetID string) (*assetInfo, error) {
	deadline := c.now().Add(c.pollLimit)
	var last *assetInfo
	for {
		info, err := c.detail(assetID)
		if err != nil {
			return nil, err
		}
		last = info
		st := strings.ToUpper(strings.TrimSpace(info.Status))
		switch st {
		case "ACTIVE":
			return info, nil
		case "FAILED", "DELETED":
			msg := info.ErrorMessage
			if msg == "" {
				msg = "asset status " + st
			}
			return nil, fmt.Errorf("asset %s unavailable: %s", info.AssetID, msg)
		case "EXPIRED":
			return nil, fmt.Errorf("asset %s expired; re-upload required", info.AssetID)
		}
		if c.now().After(deadline) {
			st := ""
			if last != nil {
				st = last.Status
			}
			return nil, fmt.Errorf("asset %s not ACTIVE within timeout (last status=%s)", assetID, st)
		}
		c.sleep(c.pollEvery)
	}
}

func (c *assetClient) postJSON(path string, payload map[string]interface{}) ([]byte, error) {
	if c.httpClient == nil {
		return nil, fmt.Errorf("http client is nil")
	}
	body, err := common.Marshal(payload)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequest(http.MethodPost, c.baseURL+path, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 400 {
		msg := extractAssetError(raw)
		if msg == "" {
			msg = string(raw)
		}
		return nil, fmt.Errorf("asset API HTTP %d: %s", resp.StatusCode, msg)
	}
	return raw, nil
}

func parseAssetInfo(raw []byte) *assetInfo {
	s := string(raw)
	return &assetInfo{
		AssetID:      strings.TrimSpace(gjson.Get(s, "assetId").String()),
		Status:       strings.TrimSpace(gjson.Get(s, "status").String()),
		ErrorMessage: strings.TrimSpace(firstNonEmpty(gjson.Get(s, "errorMessage").String(), gjson.Get(s, "error").String(), gjson.Get(s, "message").String())),
	}
}

func extractAssetError(raw []byte) string {
	s := string(raw)
	return firstNonEmpty(
		gjson.Get(s, "errorMessage").String(),
		gjson.Get(s, "error.message").String(),
		gjson.Get(s, "error").String(),
		gjson.Get(s, "message").String(),
		gjson.Get(s, "msg").String(),
	)
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if s := strings.TrimSpace(v); s != "" && s != "null" {
			return s
		}
	}
	return ""
}

func truncateName(name string) string {
	name = strings.TrimSpace(name)
	if name == "" {
		return ""
	}
	if utf8.RuneCountInString(name) <= 50 {
		return name
	}
	runes := []rune(name)
	return string(runes[:50])
}

func truncateBody(raw []byte) string {
	const max = 240
	if len(raw) <= max {
		return string(raw)
	}
	return string(raw[:max]) + "..."
}

func normalizeAssetID(raw string) string {
	s := strings.TrimSpace(raw)
	if s == "" {
		return ""
	}
	const prefix = "assetid://"
	lower := strings.ToLower(s)
	if strings.HasPrefix(lower, prefix) {
		return strings.TrimSpace(s[len(prefix):])
	}
	return s
}

func toAssetRef(assetID string) string {
	id := normalizeAssetID(assetID)
	if id == "" {
		return ""
	}
	return "assetId://" + id
}

func looksLikeHTTPURL(s string) bool {
	lower := strings.ToLower(strings.TrimSpace(s))
	return strings.HasPrefix(lower, "http://") || strings.HasPrefix(lower, "https://")
}

func looksLikeDataURL(s string) bool {
	lower := strings.ToLower(strings.TrimSpace(s))
	return strings.HasPrefix(lower, "data:")
}

func looksLikeAssetRef(s string) bool {
	s = strings.TrimSpace(s)
	if s == "" {
		return false
	}
	lower := strings.ToLower(s)
	if strings.HasPrefix(lower, "assetid://") {
		return true
	}
	// bare asset id e.g. asset-20260722164336-p4mms
	return strings.HasPrefix(lower, "asset-") && !strings.Contains(s, "://")
}
