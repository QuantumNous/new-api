package service

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/volc/sign"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"golang.org/x/net/proxy"
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
	Proxy     string
	ChannelId int
}

func sanitizeSeedanceOfficialKeyPart(s string) string {
	s = strings.TrimSpace(s)
	s = strings.Trim(s, `"'`)
	s = strings.ReplaceAll(s, "\r", "")
	s = strings.TrimPrefix(s, "\ufeff")
	return strings.TrimSpace(s)
}

func parseSeedanceOfficialKey(raw, defaultRegion string) (ak, sk, region string, err error) {
	raw = sanitizeSeedanceOfficialKeyPart(raw)
	raw = strings.TrimPrefix(raw, "Bearer ")
	raw = strings.TrimPrefix(raw, "bearer ")
	raw = sanitizeSeedanceOfficialKeyPart(raw)

	var parts []string
	if strings.Contains(raw, "|") {
		parts = strings.Split(raw, "|")
	} else {
		// 兼容 AK 与 SK 分行粘贴
		lines := make([]string, 0, 3)
		for _, line := range strings.Split(raw, "\n") {
			line = sanitizeSeedanceOfficialKeyPart(line)
			if line != "" {
				lines = append(lines, line)
			}
		}
		parts = lines
	}
	if len(parts) < 2 {
		return "", "", "", fmt.Errorf("key must be AK|SK or AK|SK|Region")
	}
	ak = sanitizeSeedanceOfficialKeyPart(parts[0])
	sk = sanitizeSeedanceOfficialKeyPart(parts[1])
	if ak == "" || sk == "" {
		return "", "", "", fmt.Errorf("empty AK or SK")
	}
	// 常见误填：把推理 API Key（sk-...）当成 IAM AK/SK
	if strings.HasPrefix(strings.ToLower(ak), "sk-") || strings.HasPrefix(strings.ToLower(sk), "sk-") {
		return "", "", "", fmt.Errorf("expect IAM Access Key ID/Secret, not API Key (sk-...)")
	}
	region = strings.TrimSpace(defaultRegion)
	if region == "" {
		region = seedanceOfficialCNRegion
	}
	if len(parts) >= 3 && strings.TrimSpace(parts[2]) != "" {
		region = sanitizeSeedanceOfficialKeyPart(parts[2])
	}
	return ak, sk, region, nil
}

// alignOfficialRegion 以运营平台为准；Key 第三段若与平台冲突（如海外却写 cn-beijing）则忽略
func alignOfficialRegion(platform, keyRegion, profileRegion string) string {
	region := strings.TrimSpace(keyRegion)
	if region == "" {
		return profileRegion
	}
	lower := strings.ToLower(region)
	if platform == operation_setting.SeedanceOfficialPlatformOverseas {
		if strings.HasPrefix(lower, "cn-") || strings.Contains(lower, "beijing") {
			return profileRegion
		}
	}
	if platform == operation_setting.SeedanceOfficialPlatformCN {
		if strings.Contains(lower, "southeast") || strings.Contains(lower, "byteplus") {
			return profileRegion
		}
	}
	return region
}

func resolveSeedanceOfficialGateway() (*seedanceOfficialGateway, error) {
	cfg := operation_setting.GetSeedanceAssetOfficialSetting()
	if cfg == nil || !cfg.Enabled || cfg.GatewayChannelId <= 0 {
		return nil, newSeedanceErr(http.StatusServiceUnavailable, "gateway_not_configured", "Seedance 官方素材未配置或未启用")
	}
	// 官方素材强依赖渠道 Setting.Proxy；避免内存缓存里旧 Setting 导致刚改的代理不生效
	ch, err := model.GetChannelById(cfg.GatewayChannelId, true)
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
		return nil, newSeedanceErr(http.StatusServiceUnavailable, "gateway_not_configured", "Seedance 官方素材渠道 Key 须为 AK|SK 或 AK|SK|Region: "+parseErr.Error())
	}
	region = alignOfficialRegion(platform, region, profile.Region)

	scheme := "https"
	host := profile.Host
	base := strings.TrimSpace(ch.GetBaseURL())
	if base != "" {
		overrideHost := ""
		overrideScheme := ""
		u, uErr := url.Parse(base)
		if uErr == nil && u.Host != "" {
			overrideHost = u.Host
			if u.Scheme != "" {
				overrideScheme = u.Scheme
			}
		} else if !strings.Contains(base, "://") {
			overrideHost = strings.TrimSuffix(base, "/")
		}
		if overrideHost != "" && isSeedanceOfficialAllowedHost(overrideHost) {
			host = overrideHost
			if overrideScheme != "" {
				scheme = overrideScheme
			}
		} else if overrideHost != "" {
			common.SysLog(fmt.Sprintf("seedance official ignore unrelated channel base_url host=%s, using default host=%s", overrideHost, profile.Host))
		}
	}
	return &seedanceOfficialGateway{
		Host:      host,
		Scheme:    scheme,
		AccessKey: ak,
		SecretKey: sk,
		Region:    region,
		Platform:  platform,
		Proxy:     strings.TrimSpace(ch.GetSetting().Proxy),
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
	// 与 BytePlus 文档示例一致；不把 content-type 纳入 SignedHeaders
	req.Header.Set("Content-Type", "application/json; charset=UTF-8")
	req.Host = gw.Host
	req.Header.Set("Host", gw.Host)

	if err = sign.SignRequest(req, sign.Credentials{
		AccessKeyID:     gw.AccessKey,
		SecretAccessKey: gw.SecretKey,
		Region:          gw.Region,
		Service:         seedanceOfficialDefaultService,
	}, bodyBytes, time.Now().UTC()); err != nil {
		return 0, nil, nil, newSeedanceErr(http.StatusInternalServerError, "sign_error", err.Error())
	}

	client, clientErr := newSeedanceOfficialHTTPClient(gw.Proxy)
	if clientErr != nil {
		return 0, nil, nil, newSeedanceErr(http.StatusBadRequest, "proxy_url_invalid", "官方素材渠道代理地址无效: "+clientErr.Error())
	}
	resp, err := client.Do(req)
	if err != nil {
		return 0, nil, nil, newSeedanceErr(http.StatusBadGateway, "upstream_error", err.Error())
	}
	defer resp.Body.Close()
	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return resp.StatusCode, nil, nil, err
	}
	raw = map[string]any{}
	jsonOK := false
	if len(respBytes) > 0 {
		jsonOK = common.Unmarshal(respBytes, &raw) == nil
	}
	if err = officialUpstreamError(resp.StatusCode, raw, respBytes, jsonOK, gw, action); err != nil {
		return resp.StatusCode, nil, raw, err
	}
	return resp.StatusCode, asMap(raw["Result"]), raw, nil
}

func officialUpstreamError(httpStatus int, raw map[string]any, respBytes []byte, jsonOK bool, gw *seedanceOfficialGateway, action string) error {
	meta := asMap(raw["ResponseMetadata"])
	errObj := asMap(mapGet(meta, "Error"))
	if errObj == nil {
		errObj = asMap(mapGet(raw, "Error", "error"))
	}
	code := pickString(mapGet(errObj, "Code", "code"))
	msg := pickString(mapGet(errObj, "Message", "message"), mapGet(raw, "message"), mapGet(raw, "Message"))
	hasUpstreamErr := errObj != nil || code != "" || (msg != "" && httpStatus >= 400)
	if !hasUpstreamErr && httpStatus < 400 {
		return nil
	}

	status := httpStatus
	if status < 400 {
		status = http.StatusBadRequest
	}
	switch strings.ToLower(code) {
	case "validatepending":
		status = http.StatusNotFound
		code = "group_not_found"
		if msg == "" {
			msg = "尚未完成活体或 token 无效"
		}
	case "notfound", "resourcenotfound", "invalidparameter.notfound":
		status = http.StatusNotFound
	case "invalidparameter", "invalidparameter.missingparameter", "missingparameter":
		status = http.StatusBadRequest
	case "unauthorized", "unauthorizedoperation", "signaturedoesnotmatch", "invalidaccesskey", "authfailure", "invalidcredential", "authenticationerror":
		status = http.StatusUnauthorized
		if msg == "" {
			msg = "AuthenticationError"
		}
		msg += "。请确认渠道 Key 为 BytePlus IAM 的 AK|SK。" + officialAuthDiag(gw)
	case "unsupported_country_region_territory":
		status = http.StatusForbidden
		if msg == "" {
			msg = "Country, region, or territory not supported"
		}
		proxyHint := "未配置 Proxy（仍走服务器本地出口）"
		if gw != nil && strings.TrimSpace(gw.Proxy) != "" {
			proxyHint = "已配置 Proxy=" + maskProxyForLog(gw.Proxy)
		}
		msg += "；BytePlus 判定地区不可用。" + proxyHint + "。请换新加坡等支持地区节点，或确认账号注册地区可用，并重新部署含 Proxy 支持的后端"
	}
	if code == "" {
		code = "upstream_error"
	}
	if msg == "" {
		snippet := strings.TrimSpace(string(respBytes))
		if len(snippet) > 500 {
			snippet = snippet[:500] + "…"
		}
		if snippet == "" || !jsonOK {
			msg = fmt.Sprintf("官方素材上游错误 (HTTP %d, action=%s, platform=%s, host=%s)", httpStatus, action, gwPlatform(gw), gwHost(gw))
			if snippet != "" {
				msg += ": " + snippet
			}
		} else {
			msg = fmt.Sprintf("官方素材上游错误 (HTTP %d)", httpStatus)
		}
	} else if code != "group_not_found" {
		msg = fmt.Sprintf("%s [%s] (HTTP %d, action=%s, platform=%s)", msg, code, httpStatus, action, gwPlatform(gw))
	}
	common.SysLog(fmt.Sprintf("seedance official upstream error: action=%s platform=%s host=%s status=%d code=%s msg=%s body=%s",
		action, gwPlatform(gw), gwHost(gw), httpStatus, code, msg, truncateForLog(respBytes, 800)))
	return newSeedanceErr(status, code, msg)
}

func gwPlatform(gw *seedanceOfficialGateway) string {
	if gw == nil {
		return ""
	}
	return gw.Platform
}

func gwHost(gw *seedanceOfficialGateway) string {
	if gw == nil {
		return ""
	}
	return gw.Host
}

func truncateForLog(b []byte, n int) string {
	s := strings.TrimSpace(string(b))
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}

func maskProxyForLog(proxyURL string) string {
	u, err := url.Parse(strings.TrimSpace(proxyURL))
	if err != nil || u.Host == "" {
		return "(invalid)"
	}
	if u.User != nil {
		u.User = url.UserPassword("***", "***")
	}
	return u.String()
}

func officialAuthDiag(gw *seedanceOfficialGateway) string {
	if gw == nil {
		return "diag=nil"
	}
	akPrefix := gw.AccessKey
	if len(akPrefix) > 10 {
		akPrefix = akPrefix[:10]
	}
	proxyHint := "proxy=off"
	if strings.TrimSpace(gw.Proxy) != "" {
		proxyHint = "proxy=on"
	}
	return fmt.Sprintf("diag(ak_prefix=%s..., sk_len=%d, region=%s, host=%s, project=%s, %s, channel=%d)",
		akPrefix, len(gw.SecretKey), gw.Region, gw.Host, operation_setting.GetSeedanceOfficialProjectName(), proxyHint, gw.ChannelId)
}

// newSeedanceOfficialHTTPClient 官方素材专用客户端：关闭 HTTP/2，避免部分代理/签名场景异常
func newSeedanceOfficialHTTPClient(proxyURL string) (*http.Client, error) {
	timeout := 60 * time.Second
	if common.RelayTimeout > 0 {
		timeout = time.Duration(common.RelayTimeout) * time.Second
	}
	transport := &http.Transport{
		Proxy:               http.ProxyFromEnvironment,
		ForceAttemptHTTP2:   false,
		MaxIdleConns:        20,
		IdleConnTimeout:     90 * time.Second,
		TLSHandshakeTimeout: 15 * time.Second,
	}
	proxyURL = strings.TrimSpace(proxyURL)
	if proxyURL != "" {
		u, err := url.Parse(proxyURL)
		if err != nil {
			return nil, err
		}
		switch strings.ToLower(u.Scheme) {
		case "http", "https":
			transport.Proxy = http.ProxyURL(u)
		case "socks5", "socks5h":
			var auth *proxy.Auth
			if u.User != nil {
				pass, _ := u.User.Password()
				auth = &proxy.Auth{User: u.User.Username(), Password: pass}
			}
			dialer, dErr := proxy.SOCKS5("tcp", u.Host, auth, proxy.Direct)
			if dErr != nil {
				return nil, dErr
			}
			transport.Proxy = nil
			transport.DialContext = func(ctx context.Context, network, addr string) (net.Conn, error) {
				return dialer.Dial(network, addr)
			}
		default:
			return nil, fmt.Errorf("unsupported proxy scheme: %s", u.Scheme)
		}
	}
	return &http.Client{Transport: transport, Timeout: timeout}, nil
}

func isSeedanceOfficialAllowedHost(host string) bool {
	h := strings.ToLower(strings.TrimSpace(host))
	if h == "" {
		return false
	}
	// 去掉可能的端口
	if i := strings.IndexByte(h, ':'); i >= 0 {
		h = h[:i]
	}
	return strings.Contains(h, "byteplusapi.com") ||
		strings.Contains(h, "volcengineapi.com") ||
		strings.Contains(h, "volces.com") ||
		strings.HasPrefix(h, "ark.")
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
