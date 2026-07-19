package service

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/textproto"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/tidwall/gjson"
	"golang.org/x/net/http/httpguts"
)

const (
	CustomUpstreamType     = "custom"
	CustomUpstreamAuthType = "custom"

	ChannelMonitorCustomSourceFixed = "fixed"
	ChannelMonitorCustomSourceHTTP  = "http"

	ChannelMonitorCustomBodyNone = "none"
	ChannelMonitorCustomBodyJSON = "json"
	ChannelMonitorCustomBodyForm = "form"

	ChannelMonitorCustomResponseJSON = "json"
	ChannelMonitorCustomResponseText = "text"

	channelMonitorCustomConfigVersion  = 1
	maxChannelMonitorCustomBaseURL     = 2048
	maxChannelMonitorCustomEntries     = 32
	maxChannelMonitorCustomKeyLength   = 256
	maxChannelMonitorCustomValueLength = 8192
	maxChannelMonitorCustomBodyBytes   = 48 << 10
	// Leave headroom under MySQL's 64 KB TEXT limit without a dialect-specific column type.
	maxChannelMonitorCustomConfigBytes  = 60 << 10
	maxChannelMonitorCustomPathLength   = 2048
	maxChannelMonitorCustomResultPath   = 512
	maxChannelMonitorCustomPreviewRunes = 2048
	maxChannelMonitorCustomBalance      = 1_000_000_000_000_000
)

type ChannelMonitorCustomKeyValue struct {
	Key      string `json:"key"`
	Value    string `json:"value,omitempty"`
	Secret   bool   `json:"secret,omitempty"`
	HasValue bool   `json:"has_value,omitempty"`
}

type ChannelMonitorCustomRequestConfig struct {
	Method     string                         `json:"method"`
	Path       string                         `json:"path"`
	Query      []ChannelMonitorCustomKeyValue `json:"query,omitempty"`
	Headers    []ChannelMonitorCustomKeyValue `json:"headers,omitempty"`
	BodyType   string                         `json:"body_type"`
	Body       string                         `json:"body,omitempty"`
	BodySecret bool                           `json:"body_secret,omitempty"`
	HasBody    bool                           `json:"has_body,omitempty"`
	Form       []ChannelMonitorCustomKeyValue `json:"form,omitempty"`
}

type ChannelMonitorCustomResultConfig struct {
	ResponseType string  `json:"response_type"`
	ValuePath    string  `json:"value_path,omitempty"`
	Multiplier   float64 `json:"multiplier"`
}

type ChannelMonitorCustomMetricConfig struct {
	Source     string                             `json:"source"`
	FixedValue *float64                           `json:"fixed_value,omitempty"`
	Request    *ChannelMonitorCustomRequestConfig `json:"request,omitempty"`
	Result     *ChannelMonitorCustomResultConfig  `json:"result,omitempty"`
}

type ChannelMonitorCustomUpstreamConfig struct {
	Version                  int                              `json:"version"`
	Ratio                    ChannelMonitorCustomMetricConfig `json:"ratio"`
	Balance                  ChannelMonitorCustomMetricConfig `json:"balance"`
	BalanceReuseRatioRequest bool                             `json:"balance_reuse_ratio_request,omitempty"`
}

type ChannelMonitorCustomRequestDebug struct {
	StatusCode      int    `json:"status_code"`
	DurationMs      int64  `json:"duration_ms"`
	ResponsePreview string `json:"response_preview,omitempty"`
}

type channelMonitorCustomHTTPResponse struct {
	body  []byte
	debug *ChannelMonitorCustomRequestDebug
}

func NormalizeChannelMonitorCustomUpstreamConfig(config ChannelMonitorCustomUpstreamConfig) (ChannelMonitorCustomUpstreamConfig, error) {
	return normalizeChannelMonitorCustomUpstreamConfig(config, nil)
}

func NormalizeChannelMonitorCustomUpstreamConfigWithExisting(config ChannelMonitorCustomUpstreamConfig, existing *ChannelMonitorCustomUpstreamConfig) (ChannelMonitorCustomUpstreamConfig, error) {
	return normalizeChannelMonitorCustomUpstreamConfig(config, existing)
}

func ParseChannelMonitorCustomUpstreamConfig(raw string) (ChannelMonitorCustomUpstreamConfig, error) {
	if strings.TrimSpace(raw) == "" {
		return ChannelMonitorCustomUpstreamConfig{}, errors.New("自定义上游配置为空")
	}
	var config ChannelMonitorCustomUpstreamConfig
	if err := common.UnmarshalJsonStr(raw, &config); err != nil {
		return ChannelMonitorCustomUpstreamConfig{}, errors.New("自定义上游配置格式无效")
	}
	return NormalizeChannelMonitorCustomUpstreamConfig(config)
}

func MarshalChannelMonitorCustomUpstreamConfig(config ChannelMonitorCustomUpstreamConfig) (string, error) {
	normalized, err := NormalizeChannelMonitorCustomUpstreamConfig(config)
	if err != nil {
		return "", err
	}
	data, err := common.Marshal(normalized)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func SanitizeChannelMonitorCustomUpstreamConfig(config ChannelMonitorCustomUpstreamConfig) ChannelMonitorCustomUpstreamConfig {
	sanitized := config
	sanitizeChannelMonitorCustomMetric := func(metric *ChannelMonitorCustomMetricConfig) {
		if metric.Request == nil {
			return
		}
		requestCopy := *metric.Request
		requestCopy.Query = sanitizeChannelMonitorCustomValues(requestCopy.Query)
		requestCopy.Headers = sanitizeChannelMonitorCustomValues(requestCopy.Headers)
		requestCopy.Form = sanitizeChannelMonitorCustomValues(requestCopy.Form)
		if requestCopy.BodySecret {
			requestCopy.HasBody = requestCopy.HasBody || requestCopy.Body != ""
			requestCopy.Body = ""
		}
		metric.Request = &requestCopy
	}
	sanitizeChannelMonitorCustomMetric(&sanitized.Ratio)
	sanitizeChannelMonitorCustomMetric(&sanitized.Balance)
	return sanitized
}

func NormalizeChannelMonitorCustomBaseURL(raw string) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", errors.New("请输入自定义接口基础地址")
	}
	if len(raw) > maxChannelMonitorCustomBaseURL {
		return "", errors.New("自定义接口基础地址不能超过 2048 个字符")
	}
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return "", errors.New("自定义接口基础地址无效")
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return "", errors.New("自定义接口基础地址仅支持 HTTP 或 HTTPS")
	}
	if parsed.User != nil {
		return "", errors.New("自定义接口基础地址不能包含账号密码")
	}
	if parsed.RawQuery != "" || parsed.Fragment != "" {
		return "", errors.New("自定义接口基础地址不能包含查询参数或片段")
	}
	parsed.Path = strings.TrimRight(parsed.Path, "/")
	parsed.RawPath = ""
	return strings.TrimRight(parsed.String(), "/"), nil
}

func normalizeChannelMonitorCustomUpstreamConfig(config ChannelMonitorCustomUpstreamConfig, existing *ChannelMonitorCustomUpstreamConfig) (ChannelMonitorCustomUpstreamConfig, error) {
	if config.Version == 0 {
		config.Version = channelMonitorCustomConfigVersion
	}
	if config.Version != channelMonitorCustomConfigVersion {
		return ChannelMonitorCustomUpstreamConfig{}, errors.New("不支持的自定义上游配置版本")
	}

	var existingRatio *ChannelMonitorCustomMetricConfig
	var existingBalance *ChannelMonitorCustomMetricConfig
	if existing != nil {
		existingRatio = &existing.Ratio
		existingBalance = &existing.Balance
	}
	ratio, err := normalizeChannelMonitorCustomMetric(config.Ratio, existingRatio, true, false)
	if err != nil {
		return ChannelMonitorCustomUpstreamConfig{}, fmt.Errorf("自定义倍率配置无效: %w", err)
	}
	balance, err := normalizeChannelMonitorCustomMetric(config.Balance, existingBalance, false, config.BalanceReuseRatioRequest)
	if err != nil {
		return ChannelMonitorCustomUpstreamConfig{}, fmt.Errorf("自定义余额配置无效: %w", err)
	}
	if config.BalanceReuseRatioRequest && (ratio.Source != ChannelMonitorCustomSourceHTTP || balance.Source != ChannelMonitorCustomSourceHTTP) {
		return ChannelMonitorCustomUpstreamConfig{}, errors.New("只有倍率和余额都使用接口查询时才能复用倍率接口")
	}
	if config.BalanceReuseRatioRequest {
		balance.Request = nil
	}
	normalized := ChannelMonitorCustomUpstreamConfig{
		Version:                  channelMonitorCustomConfigVersion,
		Ratio:                    ratio,
		Balance:                  balance,
		BalanceReuseRatioRequest: config.BalanceReuseRatioRequest,
	}
	encoded, err := common.Marshal(normalized)
	if err != nil {
		return ChannelMonitorCustomUpstreamConfig{}, errors.New("自定义上游配置序列化失败")
	}
	if len(encoded) > maxChannelMonitorCustomConfigBytes {
		return ChannelMonitorCustomUpstreamConfig{}, errors.New("自定义上游配置总大小不能超过 60 KB")
	}
	return normalized, nil
}

func normalizeChannelMonitorCustomMetric(metric ChannelMonitorCustomMetricConfig, existing *ChannelMonitorCustomMetricConfig, ratio bool, reuseRequest bool) (ChannelMonitorCustomMetricConfig, error) {
	metric.Source = strings.TrimSpace(metric.Source)
	if metric.Source == "" {
		metric.Source = ChannelMonitorCustomSourceFixed
	}
	switch metric.Source {
	case ChannelMonitorCustomSourceFixed:
		if metric.FixedValue == nil {
			return ChannelMonitorCustomMetricConfig{}, errors.New("固定值不能为空")
		}
		value := *metric.FixedValue
		if math.IsNaN(value) || math.IsInf(value, 0) {
			return ChannelMonitorCustomMetricConfig{}, errors.New("固定值必须是有效数字")
		}
		if ratio && (value < 0 || value > maxUpstreamGroupRatio) {
			return ChannelMonitorCustomMetricConfig{}, errors.New("固定倍率必须在 0 到 1000000 之间")
		}
		if !ratio && math.Abs(value) > maxChannelMonitorCustomBalance {
			return ChannelMonitorCustomMetricConfig{}, errors.New("固定余额绝对值不能超过 1000000000000000")
		}
		return ChannelMonitorCustomMetricConfig{Source: metric.Source, FixedValue: &value}, nil
	case ChannelMonitorCustomSourceHTTP:
		var existingRequest *ChannelMonitorCustomRequestConfig
		if existing != nil {
			existingRequest = existing.Request
		}
		var request *ChannelMonitorCustomRequestConfig
		if !reuseRequest {
			if metric.Request == nil {
				return ChannelMonitorCustomMetricConfig{}, errors.New("接口请求配置不能为空")
			}
			normalizedRequest, err := normalizeChannelMonitorCustomRequest(*metric.Request, existingRequest)
			if err != nil {
				return ChannelMonitorCustomMetricConfig{}, err
			}
			request = &normalizedRequest
		}
		if metric.Result == nil {
			return ChannelMonitorCustomMetricConfig{}, errors.New("接口结果配置不能为空")
		}
		result, err := normalizeChannelMonitorCustomResult(*metric.Result)
		if err != nil {
			return ChannelMonitorCustomMetricConfig{}, err
		}
		return ChannelMonitorCustomMetricConfig{Source: metric.Source, Request: request, Result: &result}, nil
	default:
		return ChannelMonitorCustomMetricConfig{}, errors.New("数据来源必须是固定输入或接口查询")
	}
}

func normalizeChannelMonitorCustomRequest(request ChannelMonitorCustomRequestConfig, existing *ChannelMonitorCustomRequestConfig) (ChannelMonitorCustomRequestConfig, error) {
	request.Method = strings.ToUpper(strings.TrimSpace(request.Method))
	if request.Method == "" {
		request.Method = http.MethodGet
	}
	if request.Method != http.MethodGet && request.Method != http.MethodPost {
		return ChannelMonitorCustomRequestConfig{}, errors.New("请求方式仅支持 GET 或 POST")
	}
	request.Path = strings.TrimSpace(request.Path)
	if request.Path == "" || len(request.Path) > maxChannelMonitorCustomPathLength {
		return ChannelMonitorCustomRequestConfig{}, errors.New("接口路径不能为空且不能超过 2048 个字符")
	}
	parsedPath, err := url.Parse(request.Path)
	if err != nil ||
		parsedPath.IsAbs() ||
		parsedPath.Host != "" ||
		parsedPath.RawQuery != "" ||
		parsedPath.Fragment != "" ||
		strings.ContainsAny(parsedPath.Path, "?#") {
		return ChannelMonitorCustomRequestConfig{}, errors.New("接口路径必须是没有查询参数的相对路径")
	}
	request.Path = "/" + strings.TrimLeft(parsedPath.Path, "/")

	var existingQuery []ChannelMonitorCustomKeyValue
	var existingHeaders []ChannelMonitorCustomKeyValue
	var existingForm []ChannelMonitorCustomKeyValue
	if existing != nil {
		existingQuery = existing.Query
		existingHeaders = existing.Headers
		existingForm = existing.Form
	}
	request.Query, err = normalizeChannelMonitorCustomValues(request.Query, existingQuery, "查询参数", false)
	if err != nil {
		return ChannelMonitorCustomRequestConfig{}, err
	}
	request.Headers, err = normalizeChannelMonitorCustomValues(request.Headers, existingHeaders, "请求头", true)
	if err != nil {
		return ChannelMonitorCustomRequestConfig{}, err
	}

	request.BodyType = strings.TrimSpace(request.BodyType)
	if request.BodyType == "" {
		request.BodyType = ChannelMonitorCustomBodyNone
	}
	if request.Method == http.MethodGet && request.BodyType != ChannelMonitorCustomBodyNone {
		return ChannelMonitorCustomRequestConfig{}, errors.New("GET 请求不能配置请求体")
	}
	switch request.BodyType {
	case ChannelMonitorCustomBodyNone:
		request.Body = ""
		request.BodySecret = false
		request.HasBody = false
		request.Form = nil
	case ChannelMonitorCustomBodyJSON:
		request.Form = nil
		if request.BodySecret && request.Body == "" && request.HasBody && existing != nil && existing.BodySecret {
			request.Body = existing.Body
		}
		if len(request.Body) == 0 || len(request.Body) > maxChannelMonitorCustomBodyBytes {
			return ChannelMonitorCustomRequestConfig{}, errors.New("JSON 请求体不能为空且不能超过 49152 字节")
		}
		var decoded any
		if err := common.Unmarshal([]byte(request.Body), &decoded); err != nil {
			return ChannelMonitorCustomRequestConfig{}, errors.New("JSON 请求体格式无效")
		}
		request.HasBody = true
	case ChannelMonitorCustomBodyForm:
		request.Body = ""
		request.BodySecret = false
		request.HasBody = false
		request.Form, err = normalizeChannelMonitorCustomValues(request.Form, existingForm, "表单参数", false)
		if err != nil {
			return ChannelMonitorCustomRequestConfig{}, err
		}
	default:
		return ChannelMonitorCustomRequestConfig{}, errors.New("请求体类型无效")
	}
	return request, nil
}

func normalizeChannelMonitorCustomValues(values []ChannelMonitorCustomKeyValue, existing []ChannelMonitorCustomKeyValue, label string, header bool) ([]ChannelMonitorCustomKeyValue, error) {
	if len(values) > maxChannelMonitorCustomEntries {
		return nil, fmt.Errorf("%s不能超过 %d 项", label, maxChannelMonitorCustomEntries)
	}
	normalized := make([]ChannelMonitorCustomKeyValue, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, item := range values {
		item.Key = strings.TrimSpace(item.Key)
		if item.Key == "" || len(item.Key) > maxChannelMonitorCustomKeyLength {
			return nil, fmt.Errorf("%s名称不能为空且不能超过 %d 个字符", label, maxChannelMonitorCustomKeyLength)
		}
		if header {
			canonicalKey := textproto.CanonicalMIMEHeaderKey(item.Key)
			if canonicalKey == "" || !httpguts.ValidHeaderFieldName(canonicalKey) || isBlockedChannelMonitorCustomHeader(canonicalKey) {
				return nil, fmt.Errorf("请求头 %s 不允许配置", item.Key)
			}
			item.Key = canonicalKey
		}
		key := strings.ToLower(item.Key)
		if _, exists := seen[key]; exists {
			return nil, fmt.Errorf("%s %s 重复", label, item.Key)
		}
		seen[key] = struct{}{}
		item.Secret = item.Secret || isChannelMonitorCustomSensitiveKey(item.Key)
		if item.Secret && item.Value == "" && item.HasValue {
			for _, saved := range existing {
				if strings.EqualFold(strings.TrimSpace(saved.Key), item.Key) && saved.Value != "" {
					item.Value = saved.Value
					break
				}
			}
		}
		invalidValue := len(item.Value) > maxChannelMonitorCustomValueLength || strings.ContainsAny(item.Value, "\r\n")
		if header {
			invalidValue = invalidValue || !httpguts.ValidHeaderFieldValue(item.Value)
		}
		if invalidValue {
			return nil, fmt.Errorf("%s %s 的值无效或过长", label, item.Key)
		}
		if item.Secret && item.Value == "" {
			return nil, fmt.Errorf("敏感%s %s 的值不能为空", label, item.Key)
		}
		item.HasValue = item.Value != ""
		normalized = append(normalized, item)
	}
	return normalized, nil
}

func normalizeChannelMonitorCustomResult(result ChannelMonitorCustomResultConfig) (ChannelMonitorCustomResultConfig, error) {
	result.ResponseType = strings.TrimSpace(result.ResponseType)
	if result.ResponseType == "" {
		result.ResponseType = ChannelMonitorCustomResponseJSON
	}
	result.ValuePath = strings.TrimSpace(result.ValuePath)
	if result.ResponseType == ChannelMonitorCustomResponseJSON {
		if result.ValuePath == "" || len(result.ValuePath) > maxChannelMonitorCustomResultPath {
			return ChannelMonitorCustomResultConfig{}, errors.New("JSON 取值路径不能为空且不能超过 512 个字符")
		}
	} else if result.ResponseType == ChannelMonitorCustomResponseText {
		result.ValuePath = ""
	} else {
		return ChannelMonitorCustomResultConfig{}, errors.New("响应格式必须是 JSON 或纯文本")
	}
	if result.Multiplier == 0 {
		result.Multiplier = 1
	}
	if math.IsNaN(result.Multiplier) || math.IsInf(result.Multiplier, 0) || result.Multiplier <= 0 || result.Multiplier > maxUpstreamGroupRatio {
		return ChannelMonitorCustomResultConfig{}, errors.New("结果乘数必须大于 0 且不能超过 1000000")
	}
	return result, nil
}

func sanitizeChannelMonitorCustomValues(values []ChannelMonitorCustomKeyValue) []ChannelMonitorCustomKeyValue {
	if len(values) == 0 {
		return nil
	}
	sanitized := make([]ChannelMonitorCustomKeyValue, len(values))
	copy(sanitized, values)
	for index := range sanitized {
		if sanitized[index].Secret {
			sanitized[index].HasValue = sanitized[index].HasValue || sanitized[index].Value != ""
			sanitized[index].Value = ""
		}
	}
	return sanitized
}

func isBlockedChannelMonitorCustomHeader(key string) bool {
	switch strings.ToLower(key) {
	case "host", "content-length", "connection", "proxy-connection", "transfer-encoding", "upgrade", "te", "trailer":
		return true
	default:
		return false
	}
}

func isChannelMonitorCustomSensitiveKey(key string) bool {
	key = strings.ToLower(strings.TrimSpace(key))
	return strings.Contains(key, "authorization") ||
		strings.Contains(key, "token") ||
		strings.Contains(key, "secret") ||
		strings.Contains(key, "api-key") ||
		strings.Contains(key, "api_key") ||
		strings.Contains(key, "apikey") ||
		strings.Contains(key, "password") ||
		strings.Contains(key, "passwd") ||
		strings.Contains(key, "cookie") ||
		strings.Contains(key, "credential") ||
		strings.Contains(key, "session")
}

func fetchChannelMonitorCustomUpstreamRatio(ctx context.Context, client *http.Client, baseURL string, config ChannelMonitorCustomUpstreamConfig, skipBalance bool, includeDebug bool) (NewAPIGroupRatioResult, error) {
	normalized, err := NormalizeChannelMonitorCustomUpstreamConfig(config)
	if err != nil {
		return NewAPIGroupRatioResult{}, err
	}
	result := NewAPIGroupRatioResult{}
	var ratioResponse channelMonitorCustomHTTPResponse
	var balanceErr error
	if normalized.Ratio.Source == ChannelMonitorCustomSourceFixed {
		result.Ratio = *normalized.Ratio.FixedValue
		result.Endpoint = "固定输入"
	} else {
		ratioResponse, err = requestChannelMonitorCustomUpstream(ctx, client, baseURL, *normalized.Ratio.Request, includeDebug)
		if err == nil {
			result.Ratio, err = extractChannelMonitorCustomValue(ratioResponse.body, *normalized.Ratio.Result)
			result.Endpoint = normalized.Ratio.Request.Path
			result.Debug = ratioResponse.debug
		}
	}

	if !skipBalance {
		var balanceResult ChannelMonitorUpstreamBalanceResult
		balanceResult, balanceErr = fetchChannelMonitorCustomBalanceWithResponse(ctx, client, baseURL, normalized, ratioResponse, includeDebug)
		if balanceErr != nil {
			result.Balance.Error = balanceErr.Error()
		} else {
			result.Balance = balanceResult
		}
	}
	if err != nil {
		return result, fmt.Errorf("自定义倍率更新失败: %w", err)
	}
	if result.Ratio < 0 || result.Ratio > maxUpstreamGroupRatio || math.IsNaN(result.Ratio) || math.IsInf(result.Ratio, 0) {
		return result, errors.New("自定义倍率必须在 0 到 1000000 之间")
	}
	if balanceErr != nil {
		return result, balanceErr
	}
	return result, nil
}

func fetchChannelMonitorCustomUpstreamBalance(ctx context.Context, client *http.Client, baseURL string, config ChannelMonitorCustomUpstreamConfig, includeDebug bool) (ChannelMonitorUpstreamBalanceResult, error) {
	normalized, err := NormalizeChannelMonitorCustomUpstreamConfig(config)
	if err != nil {
		return ChannelMonitorUpstreamBalanceResult{}, err
	}
	return fetchChannelMonitorCustomBalanceWithResponse(ctx, client, baseURL, normalized, channelMonitorCustomHTTPResponse{}, includeDebug)
}

func fetchChannelMonitorCustomBalanceWithResponse(ctx context.Context, client *http.Client, baseURL string, config ChannelMonitorCustomUpstreamConfig, ratioResponse channelMonitorCustomHTTPResponse, includeDebug bool) (ChannelMonitorUpstreamBalanceResult, error) {
	if config.Balance.Source == ChannelMonitorCustomSourceFixed {
		value := *config.Balance.FixedValue
		return ChannelMonitorUpstreamBalanceResult{Amount: &value, Endpoint: "固定输入"}, nil
	}

	requestConfig := config.Balance.Request
	response := channelMonitorCustomHTTPResponse{}
	if config.BalanceReuseRatioRequest {
		requestConfig = config.Ratio.Request
		response = ratioResponse
	}
	if requestConfig == nil {
		return ChannelMonitorUpstreamBalanceResult{}, errors.New("自定义余额接口配置为空")
	}
	var err error
	if len(response.body) == 0 {
		response, err = requestChannelMonitorCustomUpstream(ctx, client, baseURL, *requestConfig, includeDebug)
		if err != nil {
			return ChannelMonitorUpstreamBalanceResult{}, fmt.Errorf("自定义余额更新失败: %w", err)
		}
	}
	value, err := extractChannelMonitorCustomValue(response.body, *config.Balance.Result)
	if err != nil {
		return ChannelMonitorUpstreamBalanceResult{}, fmt.Errorf("自定义余额更新失败: %w", err)
	}
	if math.IsNaN(value) || math.IsInf(value, 0) || math.Abs(value) > maxChannelMonitorCustomBalance {
		return ChannelMonitorUpstreamBalanceResult{}, errors.New("自定义余额不是有效数字或绝对值过大")
	}
	return ChannelMonitorUpstreamBalanceResult{
		Amount:   &value,
		Endpoint: requestConfig.Path,
		Debug:    response.debug,
	}, nil
}

func requestChannelMonitorCustomUpstream(ctx context.Context, client *http.Client, baseURL string, config ChannelMonitorCustomRequestConfig, includeDebug bool) (channelMonitorCustomHTTPResponse, error) {
	requestURL := strings.TrimRight(baseURL, "/") + config.Path
	parsedURL, err := url.Parse(requestURL)
	if err != nil {
		return channelMonitorCustomHTTPResponse{}, errors.New("自定义接口地址无效")
	}
	query := parsedURL.Query()
	for _, item := range config.Query {
		query.Add(item.Key, item.Value)
	}
	parsedURL.RawQuery = query.Encode()
	requestURL = parsedURL.String()
	validationURL := *parsedURL
	validationURL.RawQuery = ""
	if err := ValidateSSRFProtectedFetchURL(validationURL.String()); err != nil {
		return channelMonitorCustomHTTPResponse{}, err
	}

	var body io.Reader
	contentType := ""
	switch config.BodyType {
	case ChannelMonitorCustomBodyJSON:
		body = bytes.NewBufferString(config.Body)
		contentType = "application/json"
	case ChannelMonitorCustomBodyForm:
		form := make(url.Values, len(config.Form))
		for _, item := range config.Form {
			form.Add(item.Key, item.Value)
		}
		body = strings.NewReader(form.Encode())
		contentType = "application/x-www-form-urlencoded"
	}

	requestContext, cancel := context.WithTimeout(ctx, upstreamGroupRatioTimeout)
	defer cancel()
	request, err := http.NewRequestWithContext(requestContext, config.Method, requestURL, body)
	if err != nil {
		return channelMonitorCustomHTTPResponse{}, errors.New(redactChannelMonitorCustomText(err.Error(), config))
	}
	for _, item := range config.Headers {
		request.Header.Set(item.Key, item.Value)
	}
	if contentType != "" && request.Header.Get("Content-Type") == "" {
		request.Header.Set("Content-Type", contentType)
	}
	if request.Header.Get("Accept") == "" {
		request.Header.Set("Accept", "application/json, text/plain;q=0.9")
	}

	startedAt := time.Now()
	response, err := client.Do(request)
	if err != nil {
		return channelMonitorCustomHTTPResponse{}, errors.New(redactChannelMonitorCustomText(err.Error(), config))
	}
	defer response.Body.Close()
	responseBody, err := io.ReadAll(io.LimitReader(response.Body, maxUpstreamGroupRatioResponseBytes+1))
	if err != nil {
		return channelMonitorCustomHTTPResponse{}, err
	}
	if len(responseBody) > maxUpstreamGroupRatioResponseBytes {
		return channelMonitorCustomHTTPResponse{}, errors.New("自定义接口响应超过 1 MB")
	}
	preview := redactChannelMonitorCustomResponsePreview(responseBody, config)
	debug := &ChannelMonitorCustomRequestDebug{
		StatusCode:      response.StatusCode,
		DurationMs:      time.Since(startedAt).Milliseconds(),
		ResponsePreview: preview,
	}
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		message := fmt.Sprintf("接口返回 %s", response.Status)
		if preview != "" {
			message += "：" + preview
		}
		return channelMonitorCustomHTTPResponse{body: responseBody, debug: debug}, errors.New(message)
	}
	if !includeDebug {
		debug = nil
	}
	return channelMonitorCustomHTTPResponse{body: responseBody, debug: debug}, nil
}

func extractChannelMonitorCustomValue(body []byte, config ChannelMonitorCustomResultConfig) (float64, error) {
	var rawValue string
	if config.ResponseType == ChannelMonitorCustomResponseJSON {
		var decoded any
		if err := common.Unmarshal(body, &decoded); err != nil {
			return 0, errors.New("接口响应不是有效 JSON")
		}
		value := gjson.GetBytes(body, config.ValuePath)
		if !value.Exists() || value.Type == gjson.Null {
			return 0, fmt.Errorf("结果路径 %q 不存在", config.ValuePath)
		}
		switch value.Type {
		case gjson.Number:
			rawValue = value.Raw
		case gjson.String:
			rawValue = value.String()
		default:
			return 0, fmt.Errorf("结果路径 %q 的值不是数字", config.ValuePath)
		}
	} else {
		rawValue = strings.TrimSpace(string(body))
	}
	value, err := strconv.ParseFloat(strings.TrimSpace(rawValue), 64)
	if err != nil || math.IsNaN(value) || math.IsInf(value, 0) {
		return 0, errors.New("接口提取结果不是有效数字")
	}
	value *= config.Multiplier
	if math.IsNaN(value) || math.IsInf(value, 0) {
		return 0, errors.New("接口结果乘以结果乘数后不是有效数字")
	}
	return value, nil
}

func redactChannelMonitorCustomResponsePreview(body []byte, config ChannelMonitorCustomRequestConfig) string {
	preview := strings.TrimSpace(string(body))
	if config.BodySecret {
		if preview == "" {
			return ""
		}
		return "[响应预览已隐藏]"
	}
	preview = redactChannelMonitorCustomText(preview, config)
	previewRunes := []rune(preview)
	if len(previewRunes) > maxChannelMonitorCustomPreviewRunes {
		preview = string(previewRunes[:maxChannelMonitorCustomPreviewRunes]) + "..."
	}
	return preview
}

func redactChannelMonitorCustomText(value string, config ChannelMonitorCustomRequestConfig) string {
	for _, values := range [][]ChannelMonitorCustomKeyValue{config.Query, config.Headers, config.Form} {
		for _, item := range values {
			if !item.Secret || item.Value == "" {
				continue
			}
			value = strings.ReplaceAll(value, item.Value, "[REDACTED]")
			value = strings.ReplaceAll(value, url.QueryEscape(item.Value), "[REDACTED]")
			if strings.EqualFold(item.Key, "Authorization") {
				parts := strings.Fields(item.Value)
				if len(parts) == 2 {
					value = strings.ReplaceAll(value, parts[1], "[REDACTED]")
					value = strings.ReplaceAll(value, url.QueryEscape(parts[1]), "[REDACTED]")
				}
			}
		}
	}
	if config.BodySecret && config.Body != "" {
		value = strings.ReplaceAll(value, config.Body, "[REDACTED]")
	}
	return value
}
