package service

import (
	"bytes"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

type YkSdAssetError struct {
	Status  int
	Code    string
	Message string
}

func (e *YkSdAssetError) Error() string {
	if e.Message != "" {
		return e.Message
	}
	return e.Code
}

func newYkSdAssetErr(status int, code, message string) *YkSdAssetError {
	return &YkSdAssetError{Status: status, Code: code, Message: message}
}

type ykSdGateway struct {
	BaseURL string
	APIKey  string
}

func resolveYkSdAssetGateway() (*ykSdGateway, error) {
	cfg := operation_setting.GetYkSdAssetSetting()
	if cfg == nil || !cfg.Enabled || cfg.GatewayChannelId <= 0 {
		return nil, newYkSdAssetErr(http.StatusServiceUnavailable, "gateway_not_configured", "yk-sd 素材网关未配置或未启用")
	}
	ch, err := model.CacheGetChannel(cfg.GatewayChannelId)
	if err != nil || ch == nil {
		ch, err = model.GetChannelById(cfg.GatewayChannelId, true)
	}
	if err != nil || ch == nil {
		return nil, newYkSdAssetErr(http.StatusServiceUnavailable, "gateway_not_configured", "yk-sd 素材网关渠道不存在")
	}
	if ch.Type != constant.ChannelTypeYkSd && ch.Type != constant.ChannelTypeYkVideo {
		// Allow yk-video as fallback since same KYY base; prefer yk-sd.
		_ = ch.Type
	}
	key, _, keyErr := ch.GetNextEnabledKey()
	if keyErr != nil || strings.TrimSpace(key) == "" {
		return nil, newYkSdAssetErr(http.StatusServiceUnavailable, "gateway_not_configured", "yk-sd 素材网关渠道无可用 Key")
	}
	base := strings.TrimSuffix(strings.TrimSpace(ch.GetBaseURL()), "/")
	if base == "" {
		base = constant.GetChannelDefaultBaseURL(constant.ChannelTypeYkSd)
	}
	if base == "" {
		return nil, newYkSdAssetErr(http.StatusServiceUnavailable, "gateway_not_configured", "yk-sd 素材网关渠道未配置 Base URL")
	}
	// Strip accidental task/asset path suffixes.
	for _, suf := range []string{"/v2/model-center/tasks", "/v2/model-center", "/v2", "/asset/seedance2/assetUpload", "/asset/seedance2/assetDetail", "/asset/seedance2"} {
		if strings.HasSuffix(strings.ToLower(base), strings.ToLower(suf)) {
			base = strings.TrimSuffix(base, suf)
			base = strings.TrimSuffix(base, "/")
		}
	}
	return &ykSdGateway{BaseURL: base, APIKey: strings.TrimSpace(key)}, nil
}

func ykSdGatewayDo(gw *ykSdGateway, path string, body any) (status int, raw map[string]any, err error) {
	b, mErr := common.Marshal(body)
	if mErr != nil {
		return 0, nil, mErr
	}
	req, err := http.NewRequest(http.MethodPost, gw.BaseURL+path, bytes.NewReader(b))
	if err != nil {
		return 0, nil, err
	}
	req.Header.Set("Authorization", "Bearer "+gw.APIKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := GetHttpClient().Do(req)
	if err != nil {
		return 0, nil, newYkSdAssetErr(http.StatusBadGateway, "upstream_error", err.Error())
	}
	defer resp.Body.Close()
	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return resp.StatusCode, nil, err
	}
	raw = map[string]any{}
	if len(respBytes) > 0 {
		_ = common.Unmarshal(respBytes, &raw)
	}
	if resp.StatusCode >= 400 {
		msg := ""
		if m, ok := raw["errorMessage"].(string); ok {
			msg = m
		} else if m, ok := raw["message"].(string); ok {
			msg = m
		} else if m, ok := raw["msg"].(string); ok {
			msg = m
		}
		if msg == "" {
			msg = string(respBytes)
		}
		return resp.StatusCode, raw, newYkSdAssetErr(resp.StatusCode, "upstream_error", msg)
	}
	return resp.StatusCode, raw, nil
}

// YkSdAssetUpload proxies to /asset/seedance2/assetUpload.
func YkSdAssetUpload(body map[string]any) (map[string]any, error) {
	if body == nil {
		body = map[string]any{}
	}
	assetType, _ := body["assetType"].(string)
	urlStr, _ := body["url"].(string)
	if strings.TrimSpace(assetType) == "" || strings.TrimSpace(urlStr) == "" {
		return nil, newYkSdAssetErr(http.StatusBadRequest, "invalid_request", "assetType and url are required")
	}
	gw, err := resolveYkSdAssetGateway()
	if err != nil {
		return nil, err
	}
	_, raw, err := ykSdGatewayDo(gw, "/asset/seedance2/assetUpload", body)
	if err != nil {
		return raw, err
	}
	return raw, nil
}

// YkSdAssetDetail proxies to /asset/seedance2/assetDetail.
func YkSdAssetDetail(body map[string]any) (map[string]any, error) {
	if body == nil {
		body = map[string]any{}
	}
	assetID, _ := body["assetId"].(string)
	if strings.TrimSpace(assetID) == "" {
		return nil, newYkSdAssetErr(http.StatusBadRequest, "invalid_request", "assetId is required")
	}
	gw, err := resolveYkSdAssetGateway()
	if err != nil {
		return nil, err
	}
	_, raw, err := ykSdGatewayDo(gw, "/asset/seedance2/assetDetail", body)
	if err != nil {
		return raw, err
	}
	return raw, nil
}
