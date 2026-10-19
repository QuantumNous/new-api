package service

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

type YbModerationError struct {
	Status  int
	Code    string
	Message string
}

func (e *YbModerationError) Error() string {
	if e.Message != "" {
		return e.Message
	}
	return e.Code
}

func newYbModerationErr(status int, code, message string) *YbModerationError {
	return &YbModerationError{Status: status, Code: code, Message: message}
}

type ybGateway struct {
	BaseURL string // includes /v1
	APIKey  string
}

func resolveYbModerationGateway() (*ybGateway, error) {
	cfg := operation_setting.GetYbModerationSetting()
	if cfg == nil || !cfg.Enabled || cfg.GatewayChannelId <= 0 {
		return nil, newYbModerationErr(http.StatusServiceUnavailable, "gateway_not_configured", "yb 真人素材审核网关未配置或未启用")
	}
	ch, err := model.CacheGetChannel(cfg.GatewayChannelId)
	if err != nil || ch == nil {
		ch, err = model.GetChannelById(cfg.GatewayChannelId, true)
	}
	if err != nil || ch == nil {
		return nil, newYbModerationErr(http.StatusServiceUnavailable, "gateway_not_configured", "yb 真人素材审核网关渠道不存在")
	}
	if ch.Type != constant.ChannelTypeYb {
		_ = ch.Type // soft check; still allow if admin points at a compatible channel
	}
	key, _, keyErr := ch.GetNextEnabledKey()
	if keyErr != nil || strings.TrimSpace(key) == "" {
		return nil, newYbModerationErr(http.StatusServiceUnavailable, "gateway_not_configured", "yb 真人素材审核网关渠道无可用 Key")
	}
	base := strings.TrimSuffix(strings.TrimSpace(ch.GetBaseURL()), "/")
	if base == "" {
		base = constant.GetChannelDefaultBaseURL(constant.ChannelTypeYb)
	}
	if base == "" {
		return nil, newYbModerationErr(http.StatusServiceUnavailable, "gateway_not_configured", "yb 真人素材审核网关渠道未配置 Base URL")
	}
	return &ybGateway{BaseURL: ybAPIOrigin(base), APIKey: strings.TrimSpace(key)}, nil
}

// ybAPIOrigin normalizes channel base to .../v1 (no trailing slash).
func ybAPIOrigin(raw string) string {
	b := strings.TrimRight(strings.TrimSpace(raw), "/")
	for _, suf := range []string{
		"/moderation/face",
		"/v1/moderation/face",
		"/video/generations",
		"/v1/video/generations",
	} {
		if len(b) >= len(suf) && strings.EqualFold(b[len(b)-len(suf):], suf) {
			b = strings.TrimRight(b[:len(b)-len(suf)], "/")
		}
	}
	if strings.HasSuffix(strings.ToLower(b), "/v1") {
		return strings.TrimRight(b, "/")
	}
	return strings.TrimRight(b, "/") + "/v1"
}

func ybGatewayDo(gw *ybGateway, method, path string, body any) (status int, raw map[string]any, rawBytes []byte, err error) {
	var reader io.Reader
	if body != nil {
		b, mErr := common.Marshal(body)
		if mErr != nil {
			return 0, nil, nil, mErr
		}
		reader = bytes.NewReader(b)
	}
	req, err := http.NewRequest(method, gw.BaseURL+path, reader)
	if err != nil {
		return 0, nil, nil, err
	}
	req.Header.Set("Authorization", "Bearer "+gw.APIKey)
	req.Header.Set("Accept", "application/json")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := GetHttpClient().Do(req)
	if err != nil {
		return 0, nil, nil, newYbModerationErr(http.StatusBadGateway, "upstream_error", err.Error())
	}
	defer resp.Body.Close()
	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return resp.StatusCode, nil, nil, err
	}
	raw = map[string]any{}
	if len(respBytes) > 0 {
		_ = common.Unmarshal(respBytes, &raw)
	}
	if resp.StatusCode >= 400 {
		msg := firstYbErrorMessage(raw, respBytes)
		return resp.StatusCode, raw, respBytes, newYbModerationErr(resp.StatusCode, "upstream_error", msg)
	}
	return resp.StatusCode, raw, respBytes, nil
}

func firstYbErrorMessage(raw map[string]any, respBytes []byte) string {
	for _, key := range []string{"message", "msg", "error", "fail_reason"} {
		switch v := raw[key].(type) {
		case string:
			if strings.TrimSpace(v) != "" {
				return v
			}
		case map[string]any:
			if m, ok := v["message"].(string); ok && strings.TrimSpace(m) != "" {
				return m
			}
		}
	}
	if len(respBytes) > 0 {
		return string(respBytes)
	}
	return "upstream error"
}

// YbFaceModerationSubmit proxies POST /v1/moderation/face.
func YbFaceModerationSubmit(body map[string]any) (map[string]any, error) {
	if body == nil {
		body = map[string]any{}
	}
	image, _ := body["image"].(string)
	if strings.TrimSpace(image) == "" {
		return nil, newYbModerationErr(http.StatusBadRequest, "invalid_request", "image is required")
	}
	gw, err := resolveYbModerationGateway()
	if err != nil {
		return nil, err
	}
	_, raw, _, err := ybGatewayDo(gw, http.MethodPost, "/moderation/face", body)
	if err != nil {
		return raw, err
	}
	return raw, nil
}

// YbFaceModerationPoll proxies GET /v1/moderation/face/{task_id}.
func YbFaceModerationPoll(taskID string) (map[string]any, error) {
	taskID = strings.TrimSpace(taskID)
	if taskID == "" {
		return nil, newYbModerationErr(http.StatusBadRequest, "invalid_request", "task_id is required")
	}
	gw, err := resolveYbModerationGateway()
	if err != nil {
		return nil, err
	}
	path := "/moderation/face/" + url.PathEscape(taskID)
	_, raw, _, err := ybGatewayDo(gw, http.MethodGet, path, nil)
	if err != nil {
		return raw, err
	}
	return raw, nil
}

// YbFaceModerationSubmitWithCreds submits using an explicit channel base+key (task-path auto rewrite).
func YbFaceModerationSubmitWithCreds(baseURL, apiKey string, body map[string]any) (map[string]any, error) {
	if body == nil {
		body = map[string]any{}
	}
	image, _ := body["image"].(string)
	if strings.TrimSpace(image) == "" {
		return nil, fmt.Errorf("image is required")
	}
	gw := &ybGateway{BaseURL: ybAPIOrigin(baseURL), APIKey: strings.TrimSpace(apiKey)}
	if gw.APIKey == "" {
		return nil, fmt.Errorf("api key is empty")
	}
	_, raw, _, err := ybGatewayDo(gw, http.MethodPost, "/moderation/face", body)
	return raw, err
}

// YbFaceModerationPollWithCreds polls using an explicit channel base+key.
func YbFaceModerationPollWithCreds(baseURL, apiKey, taskID string) (map[string]any, error) {
	taskID = strings.TrimSpace(taskID)
	if taskID == "" {
		return nil, fmt.Errorf("task_id is required")
	}
	gw := &ybGateway{BaseURL: ybAPIOrigin(baseURL), APIKey: strings.TrimSpace(apiKey)}
	if gw.APIKey == "" {
		return nil, fmt.Errorf("api key is empty")
	}
	path := "/moderation/face/" + url.PathEscape(taskID)
	_, raw, _, err := ybGatewayDo(gw, http.MethodGet, path, nil)
	return raw, err
}
