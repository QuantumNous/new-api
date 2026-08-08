package service

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/volc/sign"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

const (
	seedanceOfficialCNHost         = "ark.cn-beijing.volcengineapi.com"
	seedanceOfficialCNRegion       = "cn-beijing"
	seedanceOfficialOverseasHost   = "ark.ap-southeast-1.byteplusapi.com"
	seedanceOfficialOverseasRegion = "ap-southeast-1"
	seedanceOfficialDefaultService = "ark"
	seedanceOfficialAPIVersion     = "2024-01-01"
)

type seedanceOfficialEndpointProfile struct {
	Host   string
	Region string
}

func seedanceOfficialEndpointForPlatform(platform string) seedanceOfficialEndpointProfile {
	switch operation_setting.NormalizeSeedanceOfficialPlatform(platform) {
	case operation_setting.SeedanceOfficialPlatformOverseas:
		return seedanceOfficialEndpointProfile{
			Host:   seedanceOfficialOverseasHost,
			Region: seedanceOfficialOverseasRegion,
		}
	default:
		return seedanceOfficialEndpointProfile{
			Host:   seedanceOfficialCNHost,
			Region: seedanceOfficialCNRegion,
		}
	}
}

type seedanceOfficialGateway struct {
	Host      string
	Scheme    string
	AccessKey string
	SecretKey string
	Region    string
	Platform  string
	ChannelId int
}

func parseSeedanceOfficialKey(raw, defaultRegion string) (ak, sk, region string, err error) {
	parts := strings.Split(strings.TrimSpace(raw), "|")
	if len(parts) < 2 {
		return "", "", "", fmt.Errorf("key must be AK|SK or AK|SK|Region")
	}
	ak = strings.TrimSpace(parts[0])
	sk = strings.TrimSpace(parts[1])
	if ak == "" || sk == "" {
		return "", "", "", fmt.Errorf("empty AK or SK")
	}
	region = strings.TrimSpace(defaultRegion)
	if region == "" {
		region = seedanceOfficialCNRegion
	}
	if len(parts) >= 3 && strings.TrimSpace(parts[2]) != "" {
		region = strings.TrimSpace(parts[2])
	}
	return ak, sk, region, nil
}

func resolveSeedanceOfficialGateway() (*seedanceOfficialGateway, error) {
	cfg := operation_setting.GetSeedanceAssetOfficialSetting()
	if cfg == nil || !cfg.Enabled || cfg.GatewayChannelId <= 0 {
		return nil, newSeedanceErr(http.StatusServiceUnavailable, "gateway_not_configured", "Seedance 官方素材未配置或未启用")
	}
	ch, err := model.CacheGetChannel(cfg.GatewayChannelId)
	if err != nil || ch == nil {
		ch, err = model.GetChannelById(cfg.GatewayChannelId, true)
	}
	if err != nil || ch == nil {
		return nil, newSeedanceErr(http.StatusServiceUnavailable, "gateway_not_configured", "Seedance 官方素材渠道不存在")
	}
	key, _, keyErr := ch.GetNextEnabledKey()
	if keyErr != nil || strings.TrimSpace(key) == "" {
		return nil, newSeedanceErr(http.StatusServiceUnavailable, "gateway_not_configured", "Seedance 官方素材渠道无可用 Key")
	}

	platform := operation_setting.NormalizeSeedanceOfficialPlatform(cfg.Platform)
	profile := seedanceOfficialEndpointForPlatform(platform)
	ak, sk, region, parseErr := parseSeedanceOfficialKey(key, profile.Region)
	if parseErr != nil {
		return nil, newSeedanceErr(http.StatusServiceUnavailable, "gateway_not_configured", "Seedance 官方素材渠道 Key 须为 AK|SK 或 AK|SK|Region")
	}

	scheme := "https"
	host := profile.Host
	base := strings.TrimSpace(ch.GetBaseURL())
	if base != "" {
		u, uErr := url.Parse(base)
		if uErr == nil && u.Host != "" {
			host = u.Host
			if u.Scheme != "" {
				scheme = u.Scheme
			}
		} else if !strings.Contains(base, "://") {
			host = strings.TrimSuffix(base, "/")
		}
	}
	return &seedanceOfficialGateway{
		Host:      host,
		Scheme:    scheme,
		AccessKey: ak,
		SecretKey: sk,
		Region:    region,
		Platform:  platform,
		ChannelId: ch.Id,
	}, nil
}

func seedanceOfficialDo(gw *seedanceOfficialGateway, action string, body any) (status int, result map[string]any, raw map[string]any, err error) {
	if gw == nil {
		return 0, nil, nil, newSeedanceErr(http.StatusServiceUnavailable, "gateway_not_configured", "Seedance 官方素材未配置或未启用")
	}
	var bodyBytes []byte
	if body != nil {
		bodyBytes, err = common.Marshal(body)
		if err != nil {
			return 0, nil, nil, err
		}
	} else {
		bodyBytes = []byte("{}")
	}

	q := url.Values{}
	q.Set("Action", action)
	q.Set("Version", seedanceOfficialAPIVersion)
	fullURL := fmt.Sprintf("%s://%s/?%s", gw.Scheme, gw.Host, q.Encode())

	req, err := http.NewRequest(http.MethodPost, fullURL, bytes.NewReader(bodyBytes))
	if err != nil {
		return 0, nil, nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Host = gw.Host

	if err = sign.SignRequest(req, sign.Credentials{
		AccessKeyID:     gw.AccessKey,
		SecretAccessKey: gw.SecretKey,
		Region:          gw.Region,
		Service:         seedanceOfficialDefaultService,
	}, bodyBytes, time.Now().UTC()); err != nil {
		return 0, nil, nil, newSeedanceErr(http.StatusInternalServerError, "sign_error", err.Error())
	}

	resp, err := GetHttpClient().Do(req)
	if err != nil {
		return 0, nil, nil, newSeedanceErr(http.StatusBadGateway, "upstream_error", err.Error())
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
	if err = officialUpstreamError(resp.StatusCode, raw); err != nil {
		return resp.StatusCode, nil, raw, err
	}
	return resp.StatusCode, asMap(raw["Result"]), raw, nil
}

func officialUpstreamError(httpStatus int, raw map[string]any) error {
	meta := asMap(raw["ResponseMetadata"])
	if meta == nil {
		if httpStatus >= 400 {
			return upstreamFail(httpStatus, raw, "官方素材上游错误")
		}
		return nil
	}
	errObj := asMap(meta["Error"])
	if errObj == nil {
		if httpStatus >= 400 {
			return upstreamFail(httpStatus, raw, "官方素材上游错误")
		}
		return nil
	}
	code := pickString(mapGet(errObj, "Code", "code"))
	msg := pickString(mapGet(errObj, "Message", "message"), "官方素材上游错误")
	status := httpStatus
	if status < 400 {
		status = http.StatusBadRequest
	}
	switch strings.ToLower(code) {
	case "validatepending":
		status = http.StatusNotFound
		code = "group_not_found"
		if msg == "" || msg == "官方素材上游错误" {
			msg = "尚未完成活体或 token 无效"
		}
	case "notfound", "resourcenotfound", "invalidparameter.notfound":
		status = http.StatusNotFound
	case "invalidparameter", "invalidparameter.missingparameter", "missingparameter":
		status = http.StatusBadRequest
	case "unauthorized", "unauthorizedoperation", "signaturedoesnotmatch", "invalidaccesskey":
		status = http.StatusUnauthorized
	}
	if code == "" {
		code = "upstream_error"
	}
	return newSeedanceErr(status, code, msg)
}

func toOfficialAssetType(t string) string {
	switch strings.ToLower(strings.TrimSpace(t)) {
	case "video":
		return "Video"
	case "audio":
		return "Audio"
	default:
		return "Image"
	}
}

func fromOfficialAssetType(t string) string {
	switch strings.ToLower(strings.TrimSpace(t)) {
	case "video":
		return "video"
	case "audio":
		return "audio"
	default:
		return "image"
	}
}

func fromOfficialStatus(st string) string {
	switch strings.ToLower(strings.TrimSpace(st)) {
	case "active":
		return model.SeedanceAssetStatusActive
	case "failed":
		return model.SeedanceAssetStatusFailed
	case "uploaded":
		return model.SeedanceAssetStatusUploaded
	default:
		return model.SeedanceAssetStatusProcessing
	}
}
