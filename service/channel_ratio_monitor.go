package service

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
)

const (
	NewAPIUpstreamType       = "new_api"
	NewAPIUpstreamAuthPublic = "public"
	NewAPIUpstreamAuthUser   = "user"
	Sub2APIUpstreamType      = "sub2api"
	// Sub2APIAuthAPIKey is for versions exposing /v1/sub2api/billing (v0.1.157+).
	Sub2APIAuthAPIKey = "api_key"
	// Sub2APIAuthAccount logs in through /api/v1/auth/login and caches the returned JWT.
	Sub2APIAuthAccount = "account"
	// Sub2APIAuthToken is for legacy versions where the panel JWT can call /api/v1/* directly.
	Sub2APIAuthToken = "token"

	maxUpstreamGroupRatioResponseBytes = 1 << 20
	maxUpstreamGroupRatio              = 1_000_000
	upstreamGroupRatioTimeout          = 15 * time.Second
	upstreamGroupApplyTimeout          = 30 * time.Second
)

var ErrChannelMonitorUpstreamAuthentication = errors.New("channel monitor upstream authentication failed")

type channelMonitorUpstreamAuthenticationError struct {
	cause error
}

func (err *channelMonitorUpstreamAuthenticationError) Error() string {
	return err.cause.Error()
}

func (err *channelMonitorUpstreamAuthenticationError) Unwrap() error {
	return err.cause
}

func (err *channelMonitorUpstreamAuthenticationError) Is(target error) bool {
	return target == ErrChannelMonitorUpstreamAuthentication
}

// ChannelMonitorUpstreamConfig contains the credentials needed to read a
// group multiplier from a configured upstream panel.
type ChannelMonitorUpstreamConfig struct {
	Type           string
	BaseURL        string
	Group          string
	AuthType       string
	UserID         int
	AccessToken    string
	Account        string
	Password       string
	ChannelKeys    []string
	Proxy          string
	SkipBalance    bool
	CostConversion ChannelMonitorCostConversion
	CustomConfig   ChannelMonitorCustomUpstreamConfig
	CustomDebug    bool
}

type NewAPIGroupRatioConfig struct {
	BaseURL     string
	Group       string
	AuthType    string
	UserID      int
	AccessToken string
}

type NewAPIGroupRatioResult struct {
	Ratio            float64                             `json:"ratio"`
	CostRatio        float64                             `json:"cost_ratio"`
	ConversionFactor float64                             `json:"conversion_factor"`
	Endpoint         string                              `json:"endpoint"`
	Balance          ChannelMonitorUpstreamBalanceResult `json:"balance"`
	Debug            *ChannelMonitorCustomRequestDebug   `json:"debug,omitempty"`
}

type ChannelMonitorUpstreamBalanceResult struct {
	Amount   *float64                          `json:"amount"`
	Endpoint string                            `json:"endpoint,omitempty"`
	Error    string                            `json:"error,omitempty"`
	Debug    *ChannelMonitorCustomRequestDebug `json:"debug,omitempty"`
}

type ChannelMonitorUpstreamGroup struct {
	ID       string  `json:"id,omitempty"`
	Name     string  `json:"name"`
	Ratio    float64 `json:"ratio"`
	Endpoint string  `json:"-"`
}

type ChannelMonitorUpstreamGroupsResult struct {
	Groups            []ChannelMonitorUpstreamGroup       `json:"groups"`
	Balance           ChannelMonitorUpstreamBalanceResult `json:"balance"`
	AppliedGroup      string                              `json:"applied_group,omitempty"`
	AppliedGroupError string                              `json:"applied_group_error,omitempty"`
}

func sortChannelMonitorUpstreamGroups(groups []ChannelMonitorUpstreamGroup) {
	sort.Slice(groups, func(i, j int) bool {
		if groups[i].Ratio != groups[j].Ratio {
			return groups[i].Ratio < groups[j].Ratio
		}
		if groups[i].Name != groups[j].Name {
			return groups[i].Name < groups[j].Name
		}
		return groups[i].ID < groups[j].ID
	})
}

type ChannelMonitorUpstreamGroupApplyResult struct {
	Result      NewAPIGroupRatioResult `json:"result"`
	KeysUpdated int                    `json:"keys_updated"`
}

type Sub2APIGroupRatioConfig struct {
	BaseURL     string
	Group       string
	AuthType    string
	AccessToken string
	Account     string
	Password    string
	Proxy       string
	ChannelKeys []string
	SkipBalance bool
}

type newAPIGroupRatioEntry struct {
	Ratio json.RawMessage `json:"ratio"`
}

type newAPIUserGroupsResponse struct {
	Success bool                             `json:"success"`
	Message string                           `json:"message"`
	Data    map[string]newAPIGroupRatioEntry `json:"data"`
}

type newAPIPricingResponse struct {
	Success    bool                       `json:"success"`
	Message    string                     `json:"message"`
	GroupRatio map[string]json.RawMessage `json:"group_ratio"`
}

type newAPIUserSelfResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Data    struct {
		Quota json.RawMessage `json:"quota"`
	} `json:"data"`
}

type newAPIStatusResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Data    struct {
		QuotaPerUnit json.RawMessage `json:"quota_per_unit"`
	} `json:"data"`
}

type newAPIUpstreamToken struct {
	ID                 int     `json:"id"`
	Name               string  `json:"name"`
	ExpiredTime        int64   `json:"expired_time"`
	RemainQuota        int     `json:"remain_quota"`
	UnlimitedQuota     bool    `json:"unlimited_quota"`
	ModelLimitsEnabled bool    `json:"model_limits_enabled"`
	ModelLimits        string  `json:"model_limits"`
	AllowIPs           *string `json:"allow_ips"`
	Group              string  `json:"group"`
	CrossGroupRetry    bool    `json:"cross_group_retry"`
}

type newAPIUpstreamTokenPage struct {
	Items []newAPIUpstreamToken `json:"items"`
}

type newAPIUpstreamTokenListResponse struct {
	Success bool                    `json:"success"`
	Message string                  `json:"message"`
	Data    newAPIUpstreamTokenPage `json:"data"`
}

type newAPIUpstreamTokenUpdateResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

func NormalizeNewAPIBaseURL(value string) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return "", errors.New("请输入上游面板地址")
	}
	if len(value) > 2048 {
		return "", errors.New("上游面板地址过长")
	}

	parsed, err := url.Parse(value)
	if err != nil {
		return "", fmt.Errorf("上游面板地址无效: %w", err)
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return "", errors.New("上游面板地址必须使用 HTTP 或 HTTPS")
	}
	if parsed.Host == "" {
		return "", errors.New("上游面板地址缺少主机名")
	}
	if parsed.User != nil {
		return "", errors.New("上游面板地址不能包含账号密码")
	}
	if parsed.RawQuery != "" || parsed.Fragment != "" {
		return "", errors.New("上游面板地址不能包含查询参数或片段")
	}

	parsed.Path = strings.TrimRight(parsed.Path, "/")
	if strings.HasSuffix(parsed.Path, "/v1") {
		parsed.Path = strings.TrimSuffix(parsed.Path, "/v1")
	}
	parsed.RawPath = ""
	return strings.TrimRight(parsed.String(), "/"), nil
}

func FetchChannelMonitorUpstreamGroupRatio(ctx context.Context, config ChannelMonitorUpstreamConfig) (NewAPIGroupRatioResult, error) {
	client, err := NewSSRFProtectedHTTPClientWithProxy(config.Proxy)
	if err != nil {
		return NewAPIGroupRatioResult{}, err
	}
	var result NewAPIGroupRatioResult
	switch config.Type {
	case NewAPIUpstreamType:
		newAPIConfig := NewAPIGroupRatioConfig{
			BaseURL:     config.BaseURL,
			Group:       config.Group,
			AuthType:    config.AuthType,
			UserID:      config.UserID,
			AccessToken: config.AccessToken,
		}
		result, err = fetchNewAPIGroupRatio(ctx, client, newAPIConfig, ValidateSSRFProtectedFetchURL)
		if err != nil {
			return result, err
		}
		if !config.SkipBalance {
			balance, balanceErr := fetchNewAPIUpstreamBalance(ctx, client, newAPIConfig, ValidateSSRFProtectedFetchURL)
			if balanceErr != nil {
				result.Balance.Error = balanceErr.Error()
			} else {
				result.Balance = balance
			}
		}
	case Sub2APIUpstreamType:
		result, err = fetchSub2APIGroupRatio(ctx, client, Sub2APIGroupRatioConfig{
			BaseURL:     config.BaseURL,
			Group:       config.Group,
			AuthType:    config.AuthType,
			AccessToken: config.AccessToken,
			Account:     config.Account,
			Password:    config.Password,
			Proxy:       config.Proxy,
			ChannelKeys: config.ChannelKeys,
			SkipBalance: config.SkipBalance,
		}, ValidateSSRFProtectedFetchURL)
		if err != nil {
			return result, err
		}
	case CustomUpstreamType:
		result, err = fetchChannelMonitorCustomUpstreamRatio(
			ctx,
			client,
			config.BaseURL,
			config.CustomConfig,
			config.SkipBalance,
			config.CustomDebug,
		)
		if err != nil {
			return result, err
		}
	default:
		return NewAPIGroupRatioResult{}, errors.New("不支持的上游类型")
	}
	return applyChannelMonitorCostConversion(result, config.CostConversion)
}

func applyChannelMonitorCostConversion(result NewAPIGroupRatioResult, config ChannelMonitorCostConversion) (NewAPIGroupRatioResult, error) {
	costRatio, factor, err := CalculateChannelMonitorCostRatio(result.Ratio, config)
	if err != nil {
		return result, err
	}
	result.CostRatio = costRatio
	result.ConversionFactor = factor
	return result, nil
}

func FetchChannelMonitorUpstreamBalance(ctx context.Context, config ChannelMonitorUpstreamConfig) (ChannelMonitorUpstreamBalanceResult, error) {
	client, err := NewSSRFProtectedHTTPClientWithProxy(config.Proxy)
	if err != nil {
		return ChannelMonitorUpstreamBalanceResult{}, err
	}
	switch config.Type {
	case NewAPIUpstreamType:
		return fetchNewAPIUpstreamBalance(ctx, client, NewAPIGroupRatioConfig{
			BaseURL:     config.BaseURL,
			AuthType:    config.AuthType,
			UserID:      config.UserID,
			AccessToken: config.AccessToken,
		}, ValidateSSRFProtectedFetchURL)
	case Sub2APIUpstreamType:
		return fetchSub2APIUpstreamBalance(ctx, client, Sub2APIGroupRatioConfig{
			BaseURL:     config.BaseURL,
			AuthType:    config.AuthType,
			AccessToken: config.AccessToken,
			Account:     config.Account,
			Password:    config.Password,
			Proxy:       config.Proxy,
			ChannelKeys: config.ChannelKeys,
		}, ValidateSSRFProtectedFetchURL)
	case CustomUpstreamType:
		return fetchChannelMonitorCustomUpstreamBalance(
			ctx,
			client,
			config.BaseURL,
			config.CustomConfig,
			config.CustomDebug,
		)
	default:
		return ChannelMonitorUpstreamBalanceResult{}, errors.New("不支持的上游类型")
	}
}

func fetchNewAPIUpstreamBalance(ctx context.Context, client *http.Client, config NewAPIGroupRatioConfig, validateURL func(string) error) (ChannelMonitorUpstreamBalanceResult, error) {
	config, _, err := normalizeNewAPIGroupRatioConfig(config)
	if err != nil {
		return ChannelMonitorUpstreamBalanceResult{}, err
	}
	if config.AuthType != NewAPIUpstreamAuthUser {
		return ChannelMonitorUpstreamBalanceResult{}, errors.New("New API 公开认证无法获取上游余额")
	}

	requestContext, cancel := context.WithTimeout(ctx, upstreamGroupRatioTimeout)
	defer cancel()
	userBody, err := requestNewAPIUser(
		requestContext,
		client,
		http.MethodGet,
		config.BaseURL+"/api/user/self",
		nil,
		config,
		"读取用户余额",
		validateURL,
	)
	if err != nil {
		return ChannelMonitorUpstreamBalanceResult{}, err
	}
	var userResponse newAPIUserSelfResponse
	if err := common.Unmarshal(userBody, &userResponse); err != nil || len(userResponse.Data.Quota) == 0 {
		return ChannelMonitorUpstreamBalanceResult{}, errors.New("New API 用户余额响应格式无效")
	}
	if !userResponse.Success {
		return ChannelMonitorUpstreamBalanceResult{}, upstreamGroupRatioMessage(userResponse.Message)
	}
	var quota float64
	if err := common.Unmarshal(userResponse.Data.Quota, &quota); err != nil || math.IsNaN(quota) || math.IsInf(quota, 0) {
		return ChannelMonitorUpstreamBalanceResult{}, errors.New("New API 用户余额不是有效数字")
	}

	statusURL := config.BaseURL + "/api/status"
	if validateURL != nil {
		if err := validateURL(statusURL); err != nil {
			return ChannelMonitorUpstreamBalanceResult{}, err
		}
	}
	statusRequest, err := http.NewRequestWithContext(requestContext, http.MethodGet, statusURL, nil)
	if err != nil {
		return ChannelMonitorUpstreamBalanceResult{}, err
	}
	statusRequest.Header.Set("Accept", "application/json")
	statusHTTPResponse, err := client.Do(statusRequest)
	if err != nil {
		return ChannelMonitorUpstreamBalanceResult{}, fmt.Errorf("New API 读取额度换算配置失败: %w", err)
	}
	defer statusHTTPResponse.Body.Close()
	statusBody, err := io.ReadAll(io.LimitReader(statusHTTPResponse.Body, maxUpstreamGroupRatioResponseBytes+1))
	if err != nil {
		return ChannelMonitorUpstreamBalanceResult{}, fmt.Errorf("New API 读取额度换算配置失败: %w", err)
	}
	if len(statusBody) > maxUpstreamGroupRatioResponseBytes {
		return ChannelMonitorUpstreamBalanceResult{}, errors.New("New API 上游响应过大")
	}
	if statusHTTPResponse.StatusCode != http.StatusOK {
		return ChannelMonitorUpstreamBalanceResult{}, fmt.Errorf("New API 读取额度换算配置失败: 上游返回 %s", statusHTTPResponse.Status)
	}
	var statusResponse newAPIStatusResponse
	if err := common.Unmarshal(statusBody, &statusResponse); err != nil || len(statusResponse.Data.QuotaPerUnit) == 0 {
		return ChannelMonitorUpstreamBalanceResult{}, errors.New("New API 额度换算配置响应格式无效")
	}
	if !statusResponse.Success {
		return ChannelMonitorUpstreamBalanceResult{}, upstreamGroupRatioMessage(statusResponse.Message)
	}
	var quotaPerUnit float64
	if err := common.Unmarshal(statusResponse.Data.QuotaPerUnit, &quotaPerUnit); err != nil || math.IsNaN(quotaPerUnit) || math.IsInf(quotaPerUnit, 0) || quotaPerUnit <= 0 {
		return ChannelMonitorUpstreamBalanceResult{}, errors.New("New API quota_per_unit 不是有效数字")
	}

	amount := quota / quotaPerUnit
	if math.IsNaN(amount) || math.IsInf(amount, 0) {
		return ChannelMonitorUpstreamBalanceResult{}, errors.New("New API 上游余额换算失败")
	}
	return ChannelMonitorUpstreamBalanceResult{
		Amount:   &amount,
		Endpoint: "/api/user/self",
	}, nil
}

func FetchChannelMonitorUpstreamGroups(ctx context.Context, config ChannelMonitorUpstreamConfig, channelKeys []string) (ChannelMonitorUpstreamGroupsResult, error) {
	client, err := NewSSRFProtectedHTTPClientWithProxy(config.Proxy)
	if err != nil {
		return ChannelMonitorUpstreamGroupsResult{}, err
	}
	switch config.Type {
	case NewAPIUpstreamType:
		newAPIConfig := NewAPIGroupRatioConfig{
			BaseURL:     config.BaseURL,
			AuthType:    config.AuthType,
			UserID:      config.UserID,
			AccessToken: config.AccessToken,
		}
		result, err := fetchNewAPIUpstreamGroups(ctx, client, newAPIConfig, ValidateSSRFProtectedFetchURL)
		if err != nil || config.AuthType != NewAPIUpstreamAuthUser || len(channelKeys) == 0 {
			return result, err
		}
		appliedGroup, appliedGroupErr := fetchNewAPIUpstreamKeyGroup(ctx, client, newAPIConfig, channelKeys, ValidateSSRFProtectedFetchURL)
		if appliedGroupErr != nil {
			secrets := []string{config.AccessToken}
			for _, channelKey := range channelKeys {
				secrets = append(secrets, channelKey, url.QueryEscape(channelKey))
			}
			result.AppliedGroupError = redactUpstreamGroupRatioSecrets(appliedGroupErr, secrets...).Error()
		} else {
			result.AppliedGroup = appliedGroup
		}
		return result, nil
	case Sub2APIUpstreamType:
		return fetchSub2APIUpstreamGroups(ctx, client, Sub2APIGroupRatioConfig{
			BaseURL:     config.BaseURL,
			AuthType:    config.AuthType,
			AccessToken: config.AccessToken,
			Account:     config.Account,
			Password:    config.Password,
			Proxy:       config.Proxy,
			SkipBalance: config.SkipBalance,
		}, channelKeys, ValidateSSRFProtectedFetchURL)
	default:
		return ChannelMonitorUpstreamGroupsResult{}, errors.New("不支持的上游类型")
	}
}

func normalizeChannelMonitorKeys(channelKeys []string) ([]string, error) {
	keys := make([]string, 0, len(channelKeys))
	seen := make(map[string]struct{}, len(channelKeys))
	for _, channelKey := range channelKeys {
		channelKey = strings.TrimSpace(channelKey)
		if channelKey == "" {
			continue
		}
		if len([]rune(channelKey)) > 4096 {
			return nil, errors.New("渠道上游令牌过长")
		}
		if _, exists := seen[channelKey]; exists {
			continue
		}
		seen[channelKey] = struct{}{}
		keys = append(keys, channelKey)
	}
	return keys, nil
}

func ApplyChannelMonitorUpstreamGroup(ctx context.Context, config ChannelMonitorUpstreamConfig, channelKeys []string) (ChannelMonitorUpstreamGroupApplyResult, error) {
	client, err := NewSSRFProtectedHTTPClientWithProxy(config.Proxy)
	if err != nil {
		return ChannelMonitorUpstreamGroupApplyResult{}, err
	}
	result, err := applyChannelMonitorUpstreamGroup(ctx, client, config, channelKeys, ValidateSSRFProtectedFetchURL)
	if err != nil {
		return result, err
	}
	result.Result, err = applyChannelMonitorCostConversion(result.Result, config.CostConversion)
	return result, err
}

func applyChannelMonitorUpstreamGroup(ctx context.Context, client *http.Client, config ChannelMonitorUpstreamConfig, channelKeys []string, validateURL func(string) error) (ChannelMonitorUpstreamGroupApplyResult, error) {
	keys, err := normalizeChannelMonitorKeys(channelKeys)
	if err != nil {
		return ChannelMonitorUpstreamGroupApplyResult{}, err
	}
	if len(keys) == 0 {
		return ChannelMonitorUpstreamGroupApplyResult{}, errors.New("当前渠道没有可应用分组的上游令牌")
	}

	requestContext, cancel := context.WithTimeout(ctx, upstreamGroupApplyTimeout)
	defer cancel()

	var result ChannelMonitorUpstreamGroupApplyResult
	var applyErr error
	switch config.Type {
	case NewAPIUpstreamType:
		result, applyErr = applyNewAPIUpstreamGroup(requestContext, client, config, keys, validateURL)
	case Sub2APIUpstreamType:
		result, applyErr = applySub2APIUpstreamGroup(requestContext, client, config, keys, validateURL)
	case CustomUpstreamType:
		return ChannelMonitorUpstreamGroupApplyResult{}, errors.New("自定义上游不支持自动切换分组，请手动修改上游配置")
	default:
		applyErr = errors.New("不支持的上游类型")
	}
	if applyErr == nil {
		return result, nil
	}
	accessToken := strings.TrimSpace(config.AccessToken)
	secrets := []string{
		accessToken,
		strings.TrimPrefix(accessToken, "Bearer "),
	}
	for _, key := range keys {
		secrets = append(secrets, key, url.QueryEscape(key))
	}
	return result, redactUpstreamGroupRatioSecrets(applyErr, secrets...)
}

func FetchNewAPIGroupRatio(ctx context.Context, config NewAPIGroupRatioConfig) (NewAPIGroupRatioResult, error) {
	client := GetSSRFProtectedHTTPClient()
	if client == nil {
		return NewAPIGroupRatioResult{}, errors.New("上游请求客户端未初始化")
	}
	return fetchNewAPIGroupRatio(ctx, client, config, ValidateSSRFProtectedFetchURL)
}

func fetchNewAPIGroupRatio(ctx context.Context, client *http.Client, config NewAPIGroupRatioConfig, validateURL func(string) error) (NewAPIGroupRatioResult, error) {
	config, endpoints, err := normalizeNewAPIGroupRatioConfig(config)
	if err != nil {
		return NewAPIGroupRatioResult{}, err
	}
	config.Group = strings.TrimSpace(config.Group)
	if config.Group == "" {
		return NewAPIGroupRatioResult{}, errors.New("请输入上游分组")
	}
	if config.Group == "auto" {
		return NewAPIGroupRatioResult{}, errors.New("上游自动分组没有固定倍率，无法用于倍率监控")
	}

	requestContext, cancel := context.WithTimeout(ctx, upstreamGroupRatioTimeout)
	defer cancel()

	errorsByEndpoint := make([]string, 0, len(endpoints))
	for _, endpoint := range endpoints {
		ratios, fetchErr := fetchNewAPIGroupRatiosEndpoint(requestContext, client, config, endpoint, validateURL)
		if fetchErr == nil {
			if ratio, exists := ratios[config.Group]; exists {
				return NewAPIGroupRatioResult{Ratio: ratio, Endpoint: endpoint}, nil
			}
			fetchErr = fmt.Errorf("上游未返回分组 %q", config.Group)
		}
		errorsByEndpoint = append(errorsByEndpoint, endpoint+": "+fetchErr.Error())
	}
	return NewAPIGroupRatioResult{}, errors.New(strings.Join(errorsByEndpoint, "; "))
}

func normalizeNewAPIGroupRatioConfig(config NewAPIGroupRatioConfig) (NewAPIGroupRatioConfig, []string, error) {
	baseURL, err := NormalizeNewAPIBaseURL(config.BaseURL)
	if err != nil {
		return NewAPIGroupRatioConfig{}, nil, err
	}
	config.BaseURL = baseURL
	config.AuthType = strings.TrimSpace(config.AuthType)
	switch config.AuthType {
	case NewAPIUpstreamAuthPublic:
		return config, []string{"/api/pricing", "/api/user/groups"}, nil
	case NewAPIUpstreamAuthUser:
		if config.UserID <= 0 || strings.TrimSpace(config.AccessToken) == "" {
			return NewAPIGroupRatioConfig{}, nil, errors.New("请输入上游用户 ID 和访问令牌")
		}
		return config, []string{"/api/user/self/groups"}, nil
	default:
		return NewAPIGroupRatioConfig{}, nil, errors.New("不支持的上游认证方式")
	}
}

func fetchNewAPIUpstreamGroups(ctx context.Context, client *http.Client, config NewAPIGroupRatioConfig, validateURL func(string) error) (ChannelMonitorUpstreamGroupsResult, error) {
	config, endpoints, err := normalizeNewAPIGroupRatioConfig(config)
	if err != nil {
		return ChannelMonitorUpstreamGroupsResult{}, err
	}
	requestContext, cancel := context.WithTimeout(ctx, upstreamGroupRatioTimeout)
	defer cancel()

	errorsByEndpoint := make([]string, 0, len(endpoints))
	for _, endpoint := range endpoints {
		ratios, fetchErr := fetchNewAPIGroupRatiosEndpoint(requestContext, client, config, endpoint, validateURL)
		if fetchErr != nil {
			errorsByEndpoint = append(errorsByEndpoint, endpoint+": "+fetchErr.Error())
			continue
		}
		groups := make([]ChannelMonitorUpstreamGroup, 0, len(ratios))
		for name, ratio := range ratios {
			groups = append(groups, ChannelMonitorUpstreamGroup{Name: name, Ratio: ratio, Endpoint: endpoint})
		}
		sortChannelMonitorUpstreamGroups(groups)
		return ChannelMonitorUpstreamGroupsResult{Groups: groups}, nil
	}
	return ChannelMonitorUpstreamGroupsResult{}, errors.New(strings.Join(errorsByEndpoint, "; "))
}

func fetchNewAPIUpstreamKeyGroup(ctx context.Context, client *http.Client, config NewAPIGroupRatioConfig, channelKeys []string, validateURL func(string) error) (string, error) {
	config, _, err := normalizeNewAPIGroupRatioConfig(config)
	if err != nil {
		return "", err
	}
	if config.AuthType != NewAPIUpstreamAuthUser {
		return "", errors.New("New API 公开认证无法读取 API Key 当前分组")
	}
	keys, err := normalizeChannelMonitorKeys(channelKeys)
	if err != nil {
		return "", err
	}
	if len(keys) == 0 {
		return "", errors.New("当前渠道没有可匹配的 API Key")
	}

	requestContext, cancel := context.WithTimeout(ctx, upstreamGroupApplyTimeout)
	defer cancel()
	appliedGroup := ""
	for index, channelKey := range keys {
		token, findErr := findNewAPIUpstreamToken(requestContext, client, config, channelKey, validateURL)
		if findErr != nil {
			return "", fmt.Errorf("读取第 %d 个上游 API Key 当前分组失败: %w", index+1, findErr)
		}
		group := strings.TrimSpace(token.Group)
		if group == "" {
			return "", fmt.Errorf("第 %d 个上游 API Key 没有设置分组", index+1)
		}
		if appliedGroup == "" {
			appliedGroup = group
			continue
		}
		if appliedGroup != group {
			return "", errors.New("当前渠道的多个上游 API Key 使用了不同分组，未自动选择")
		}
	}
	return appliedGroup, nil
}

func fetchNewAPIGroupRatiosEndpoint(ctx context.Context, client *http.Client, config NewAPIGroupRatioConfig, endpoint string, validateURL func(string) error) (map[string]float64, error) {
	requestURL := config.BaseURL + endpoint
	if validateURL != nil {
		if err := validateURL(requestURL); err != nil {
			return nil, err
		}
	}
	httpRequest, err := http.NewRequestWithContext(ctx, http.MethodGet, requestURL, nil)
	if err != nil {
		return nil, err
	}
	httpRequest.Header.Set("Accept", "application/json")
	if config.AuthType == NewAPIUpstreamAuthUser {
		accessToken := strings.TrimSpace(config.AccessToken)
		accessToken = strings.TrimPrefix(accessToken, "Bearer ")
		httpRequest.Header.Set("Authorization", "Bearer "+accessToken)
		httpRequest.Header.Set("New-Api-User", strconv.Itoa(config.UserID))
	}

	response, err := client.Do(httpRequest)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("上游返回 %s", response.Status)
	}

	body, err := io.ReadAll(io.LimitReader(response.Body, maxUpstreamGroupRatioResponseBytes+1))
	if err != nil {
		return nil, err
	}
	if len(body) > maxUpstreamGroupRatioResponseBytes {
		return nil, errors.New("上游响应过大")
	}

	rawRatios := make(map[string]json.RawMessage)
	if endpoint == "/api/pricing" {
		var payload newAPIPricingResponse
		if err := common.Unmarshal(body, &payload); err != nil {
			return nil, errors.New("上游价格响应格式无效")
		}
		if !payload.Success {
			return nil, upstreamGroupRatioMessage(payload.Message)
		}
		rawRatios = payload.GroupRatio
	} else {
		var payload newAPIUserGroupsResponse
		if err := common.Unmarshal(body, &payload); err != nil {
			return nil, errors.New("上游分组响应格式无效")
		}
		if !payload.Success {
			return nil, upstreamGroupRatioMessage(payload.Message)
		}
		for name, entry := range payload.Data {
			rawRatios[name] = entry.Ratio
		}
	}
	if len(rawRatios) == 0 {
		return nil, errors.New("上游未返回可用分组")
	}

	ratios := make(map[string]float64, len(rawRatios))
	for name, rawRatio := range rawRatios {
		name = strings.TrimSpace(name)
		if name == "" {
			continue
		}
		ratio, parseErr := parseUpstreamGroupRatio(rawRatio)
		if parseErr != nil {
			// New API intentionally reports the automatic group as "自动" because
			// it has no fixed multiplier. Skip it without hiding malformed ratios
			// returned for ordinary groups.
			if name == "auto" {
				continue
			}
			return nil, fmt.Errorf("上游分组 %q: %w", name, parseErr)
		}
		ratios[name] = ratio
	}
	if len(ratios) == 0 {
		return nil, errors.New("上游未返回可用分组")
	}
	return ratios, nil
}

func applyNewAPIUpstreamGroup(ctx context.Context, client *http.Client, config ChannelMonitorUpstreamConfig, channelKeys []string, validateURL func(string) error) (ChannelMonitorUpstreamGroupApplyResult, error) {
	if config.AuthType != NewAPIUpstreamAuthUser {
		return ChannelMonitorUpstreamGroupApplyResult{}, errors.New("New API 应用上游分组需要使用用户认证")
	}
	groupConfig, _, err := normalizeNewAPIGroupRatioConfig(NewAPIGroupRatioConfig{
		BaseURL:     config.BaseURL,
		Group:       strings.TrimSpace(config.Group),
		AuthType:    config.AuthType,
		UserID:      config.UserID,
		AccessToken: config.AccessToken,
	})
	if err != nil {
		return ChannelMonitorUpstreamGroupApplyResult{}, err
	}
	if groupConfig.Group == "" {
		return ChannelMonitorUpstreamGroupApplyResult{}, errors.New("请输入上游分组")
	}

	ratioResult, err := fetchNewAPIGroupRatio(ctx, client, groupConfig, validateURL)
	if err != nil {
		return ChannelMonitorUpstreamGroupApplyResult{}, err
	}
	result := ChannelMonitorUpstreamGroupApplyResult{Result: ratioResult}
	for index, channelKey := range channelKeys {
		token, findErr := findNewAPIUpstreamToken(ctx, client, groupConfig, channelKey, validateURL)
		if findErr != nil {
			return result, fmt.Errorf("查找第 %d 个上游令牌失败: %w", index+1, findErr)
		}
		token.Group = groupConfig.Group
		if updateErr := updateNewAPIUpstreamToken(ctx, client, groupConfig, token, validateURL); updateErr != nil {
			return result, fmt.Errorf("更新第 %d 个上游令牌失败: %w", index+1, updateErr)
		}
		result.KeysUpdated++
	}
	return result, nil
}

func findNewAPIUpstreamToken(ctx context.Context, client *http.Client, config NewAPIGroupRatioConfig, channelKey string, validateURL func(string) error) (newAPIUpstreamToken, error) {
	query := url.Values{}
	query.Set("p", "1")
	query.Set("page_size", "2")
	query.Set("token", channelKey)
	responseBody, err := requestNewAPIUser(
		ctx,
		client,
		http.MethodGet,
		config.BaseURL+"/api/token/search?"+query.Encode(),
		nil,
		config,
		"查找上游令牌",
		validateURL,
	)
	if err != nil {
		return newAPIUpstreamToken{}, err
	}
	var response newAPIUpstreamTokenListResponse
	if err := common.Unmarshal(responseBody, &response); err != nil {
		return newAPIUpstreamToken{}, errors.New("New API 上游令牌响应格式无效")
	}
	if !response.Success {
		return newAPIUpstreamToken{}, upstreamGroupRatioMessage(response.Message)
	}
	if len(response.Data.Items) == 0 {
		return newAPIUpstreamToken{}, errors.New("New API 未找到与当前渠道 Key 对应的上游令牌")
	}
	if len(response.Data.Items) > 1 {
		return newAPIUpstreamToken{}, errors.New("New API 返回了多个匹配的上游令牌")
	}
	return response.Data.Items[0], nil
}

func updateNewAPIUpstreamToken(ctx context.Context, client *http.Client, config NewAPIGroupRatioConfig, token newAPIUpstreamToken, validateURL func(string) error) error {
	requestBody, err := common.Marshal(token)
	if err != nil {
		return err
	}
	responseBody, err := requestNewAPIUser(
		ctx,
		client,
		http.MethodPut,
		config.BaseURL+"/api/token/",
		requestBody,
		config,
		"更新上游令牌分组",
		validateURL,
	)
	if err != nil {
		return err
	}
	var response newAPIUpstreamTokenUpdateResponse
	if err := common.Unmarshal(responseBody, &response); err != nil {
		return errors.New("New API 更新令牌响应格式无效")
	}
	if !response.Success {
		return upstreamGroupRatioMessage(response.Message)
	}
	return nil
}

func requestNewAPIUser(ctx context.Context, client *http.Client, method string, requestURL string, body []byte, config NewAPIGroupRatioConfig, operation string, validateURL func(string) error) ([]byte, error) {
	if validateURL != nil {
		if err := validateURL(requestURL); err != nil {
			return nil, err
		}
	}

	var requestBody io.Reader
	if len(body) > 0 {
		requestBody = bytes.NewReader(body)
	}
	httpRequest, err := http.NewRequestWithContext(ctx, method, requestURL, requestBody)
	if err != nil {
		return nil, err
	}
	httpRequest.Header.Set("Accept", "application/json")
	if len(body) > 0 {
		httpRequest.Header.Set("Content-Type", "application/json")
	}
	accessToken := strings.TrimPrefix(strings.TrimSpace(config.AccessToken), "Bearer ")
	httpRequest.Header.Set("Authorization", "Bearer "+accessToken)
	httpRequest.Header.Set("New-Api-User", strconv.Itoa(config.UserID))

	response, err := client.Do(httpRequest)
	if err != nil {
		return nil, fmt.Errorf("New API %s失败: %w", operation, err)
	}
	defer response.Body.Close()
	responseBody, err := io.ReadAll(io.LimitReader(response.Body, maxUpstreamGroupRatioResponseBytes+1))
	if err != nil {
		return nil, fmt.Errorf("New API %s失败: %w", operation, err)
	}
	if len(responseBody) > maxUpstreamGroupRatioResponseBytes {
		return nil, errors.New("New API 上游响应过大")
	}
	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("New API %s失败: 上游返回 %s", operation, response.Status)
	}
	return responseBody, nil
}

type sub2APIGroupRatioEntry struct {
	ID             int64           `json:"id"`
	Name           string          `json:"name"`
	RateMultiplier json.RawMessage `json:"rate_multiplier"`
}

type sub2APIResponse struct {
	Code    int             `json:"code"`
	Message string          `json:"message"`
	Reason  string          `json:"reason"`
	Data    json.RawMessage `json:"data"`
}

type sub2APIKeyEntry struct {
	ID          int64    `json:"id"`
	Key         string   `json:"key"`
	GroupID     *int64   `json:"group_id"`
	IPWhitelist []string `json:"ip_whitelist"`
	IPBlacklist []string `json:"ip_blacklist"`
}

type sub2APIKeyPage struct {
	Items []sub2APIKeyEntry `json:"items"`
}

type sub2APIKeyUpdateRequest struct {
	GroupID     int64    `json:"group_id"`
	IPWhitelist []string `json:"ip_whitelist"`
	IPBlacklist []string `json:"ip_blacklist"`
}

type sub2APIUserProfile struct {
	Balance float64 `json:"balance"`
}

type sub2APIKeyBillingResponse struct {
	Object                  string          `json:"object"`
	SchemaVersion           int             `json:"schema_version"`
	BillingScope            string          `json:"billing_scope"`
	EffectiveRateMultiplier json.RawMessage `json:"effective_rate_multiplier"`
}

type sub2APIUsageResponse struct {
	Mode    string   `json:"mode"`
	Balance *float64 `json:"balance"`
}

func FetchSub2APIGroupRatio(ctx context.Context, config Sub2APIGroupRatioConfig) (NewAPIGroupRatioResult, error) {
	client := GetSSRFProtectedHTTPClient()
	if client == nil {
		return NewAPIGroupRatioResult{}, errors.New("上游请求客户端未初始化")
	}
	return fetchSub2APIGroupRatio(ctx, client, config, ValidateSSRFProtectedFetchURL)
}

func fetchSub2APIGroupRatio(ctx context.Context, client *http.Client, config Sub2APIGroupRatioConfig, validateURL func(string) error) (NewAPIGroupRatioResult, error) {
	group := strings.TrimSpace(config.Group)
	if group == "" {
		return NewAPIGroupRatioResult{}, errors.New("请输入上游分组")
	}
	config.Group = group
	switch strings.TrimSpace(config.AuthType) {
	case Sub2APIAuthAccount:
		tokenConfig, err := resolveSub2APIAccountTokenConfig(ctx, client, config, validateURL)
		if err != nil {
			return NewAPIGroupRatioResult{}, err
		}
		result, fetchErr := fetchSub2APIGroupRatio(ctx, client, tokenConfig, validateURL)
		if !errors.Is(fetchErr, ErrChannelMonitorUpstreamAuthentication) {
			return result, fetchErr
		}
		invalidateSub2APIAccountToken(config)
		tokenConfig, err = resolveSub2APIAccountTokenConfig(ctx, client, config, validateURL)
		if err != nil {
			return NewAPIGroupRatioResult{}, err
		}
		return fetchSub2APIGroupRatio(ctx, client, tokenConfig, validateURL)
	case Sub2APIAuthAPIKey:
		baseURL, err := normalizeSub2APIBaseURL(config.BaseURL)
		if err != nil {
			return NewAPIGroupRatioResult{}, err
		}
		config.BaseURL = baseURL
		keys, err := normalizeChannelMonitorKeys(config.ChannelKeys)
		if err != nil {
			return NewAPIGroupRatioResult{}, err
		}
		if len(keys) == 0 {
			return NewAPIGroupRatioResult{}, errors.New("Sub2API API Key 认证需要当前渠道配置上游 API Key")
		}
		config.ChannelKeys = keys
		result, err := fetchSub2APIKeyGroupRatio(ctx, client, config, validateURL)
		if err != nil {
			return result, redactUpstreamGroupRatioSecrets(err, keys...)
		}
		if !config.SkipBalance {
			balance, balanceErr := fetchSub2APIKeyBalance(ctx, client, config, validateURL)
			if balanceErr != nil {
				result.Balance.Error = redactUpstreamGroupRatioSecrets(balanceErr, keys...).Error()
			} else {
				result.Balance = balance
			}
		}
		return result, nil
	case Sub2APIAuthToken:
		baseURL, accessToken, err := normalizeSub2APITokenConfig(config)
		if err != nil {
			return NewAPIGroupRatioResult{}, err
		}
		config.BaseURL = baseURL
		config.AccessToken = accessToken
		groupsResult, fetchErr := fetchSub2APIUpstreamGroups(ctx, client, config, nil, validateURL)
		result := NewAPIGroupRatioResult{Balance: groupsResult.Balance}
		if fetchErr != nil {
			return result, fetchErr
		}
		for _, entry := range groupsResult.Groups {
			if entry.Name == group || entry.ID == group {
				result.Ratio = entry.Ratio
				result.Endpoint = entry.Endpoint
				return result, nil
			}
		}
		return result, fmt.Errorf("Sub2API 当前账号不可见分组 %q", group)
	default:
		return NewAPIGroupRatioResult{}, errors.New("Sub2API 认证方式无效")
	}
}

func fetchSub2APIKeyGroupRatio(ctx context.Context, client *http.Client, config Sub2APIGroupRatioConfig, validateURL func(string) error) (NewAPIGroupRatioResult, error) {
	requestContext, cancel := context.WithTimeout(ctx, upstreamGroupRatioTimeout)
	defer cancel()
	result := NewAPIGroupRatioResult{Endpoint: "/v1/sub2api/billing"}
	var resolvedRatio *float64
	for _, channelKey := range config.ChannelKeys {
		body, err := requestSub2APIKeyEndpoint(
			requestContext,
			client,
			config.BaseURL+"/v1/sub2api/billing",
			channelKey,
			"读取渠道 API Key 倍率",
			validateURL,
		)
		if err != nil {
			return result, err
		}

		var payload sub2APIKeyBillingResponse
		if err := common.Unmarshal(body, &payload); err != nil || len(payload.EffectiveRateMultiplier) == 0 {
			return result, errors.New("Sub2API API Key 倍率响应格式无效")
		}
		if payload.Object != "" && payload.Object != "sub2api.key_billing" {
			return result, errors.New("Sub2API API Key 倍率响应对象无效")
		}
		ratio, parseErr := parseUpstreamGroupRatio(payload.EffectiveRateMultiplier)
		if parseErr != nil {
			return result, fmt.Errorf("Sub2API API Key 倍率: %w", parseErr)
		}
		if resolvedRatio == nil {
			value := ratio
			resolvedRatio = &value
			continue
		}
		if math.Abs(*resolvedRatio-ratio) > 1e-9 {
			return result, fmt.Errorf("Sub2API 当前渠道的多个 API Key 返回了不同倍率（%.6g 和 %.6g）", *resolvedRatio, ratio)
		}
	}
	if resolvedRatio == nil {
		return result, errors.New("Sub2API API Key 认证没有可用的渠道 API Key")
	}
	result.Ratio = *resolvedRatio
	return result, nil
}

func fetchSub2APIKeyBalance(ctx context.Context, client *http.Client, config Sub2APIGroupRatioConfig, validateURL func(string) error) (ChannelMonitorUpstreamBalanceResult, error) {
	if len(config.ChannelKeys) == 0 {
		return ChannelMonitorUpstreamBalanceResult{}, errors.New("Sub2API API Key 认证没有可用的渠道 API Key")
	}
	requestContext, cancel := context.WithTimeout(ctx, upstreamGroupRatioTimeout)
	defer cancel()
	body, err := requestSub2APIKeyEndpoint(
		requestContext,
		client,
		config.BaseURL+"/v1/usage",
		config.ChannelKeys[0],
		"读取渠道 API Key 余额",
		validateURL,
	)
	if err != nil {
		return ChannelMonitorUpstreamBalanceResult{}, err
	}
	var payload sub2APIUsageResponse
	if err := common.Unmarshal(body, &payload); err != nil || payload.Mode == "quota_limited" ||
		payload.Balance == nil ||
		math.IsNaN(*payload.Balance) || math.IsInf(*payload.Balance, 0) {
		return ChannelMonitorUpstreamBalanceResult{}, errors.New("Sub2API API Key 余额响应中没有钱包余额")
	}
	return ChannelMonitorUpstreamBalanceResult{
		Amount:   payload.Balance,
		Endpoint: "/v1/usage",
	}, nil
}

func requestSub2APIKeyEndpoint(ctx context.Context, client *http.Client, requestURL string, channelKey string, operation string, validateURL func(string) error) ([]byte, error) {
	if validateURL != nil {
		if err := validateURL(requestURL); err != nil {
			return nil, err
		}
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, requestURL, nil)
	if err != nil {
		return nil, err
	}
	request.Header.Set("Accept", "application/json")
	key := strings.TrimSpace(channelKey)
	if len(key) >= len("Bearer ") && strings.EqualFold(key[:len("Bearer ")], "Bearer ") {
		key = strings.TrimSpace(key[len("Bearer "):])
	}
	if key == "" {
		return nil, errors.New("Sub2API API Key 不能为空")
	}
	request.Header.Set("Authorization", "Bearer "+key)

	response, err := client.Do(request)
	if err != nil {
		return nil, fmt.Errorf("Sub2API %s失败: %w", operation, err)
	}
	defer response.Body.Close()
	body, err := io.ReadAll(io.LimitReader(response.Body, maxUpstreamGroupRatioResponseBytes+1))
	if err != nil {
		return nil, fmt.Errorf("Sub2API %s失败: %w", operation, err)
	}
	if len(body) > maxUpstreamGroupRatioResponseBytes {
		return nil, errors.New("Sub2API 上游响应过大")
	}
	if response.StatusCode == http.StatusUnauthorized || response.StatusCode == http.StatusForbidden {
		return nil, &channelMonitorUpstreamAuthenticationError{cause: fmt.Errorf("Sub2API %s认证失败: 上游返回 %s", operation, response.Status)}
	}
	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Sub2API %s失败: 上游返回 %s", operation, response.Status)
	}
	return body, nil
}

func fetchSub2APIUpstreamGroups(ctx context.Context, client *http.Client, config Sub2APIGroupRatioConfig, channelKeys []string, validateURL func(string) error) (ChannelMonitorUpstreamGroupsResult, error) {
	authType := strings.TrimSpace(config.AuthType)
	if authType == Sub2APIAuthAccount {
		tokenConfig, err := resolveSub2APIAccountTokenConfig(ctx, client, config, validateURL)
		if err != nil {
			return ChannelMonitorUpstreamGroupsResult{}, err
		}
		result, fetchErr := fetchSub2APIUpstreamGroups(ctx, client, tokenConfig, channelKeys, validateURL)
		if !errors.Is(fetchErr, ErrChannelMonitorUpstreamAuthentication) {
			return result, fetchErr
		}
		invalidateSub2APIAccountToken(config)
		tokenConfig, err = resolveSub2APIAccountTokenConfig(ctx, client, config, validateURL)
		if err != nil {
			return ChannelMonitorUpstreamGroupsResult{}, err
		}
		return fetchSub2APIUpstreamGroups(ctx, client, tokenConfig, channelKeys, validateURL)
	}
	if authType == Sub2APIAuthAPIKey {
		return ChannelMonitorUpstreamGroupsResult{}, errors.New("Sub2API API Key 认证不支持获取上游分组，请切换为 Token（旧版）认证")
	}
	if authType != Sub2APIAuthToken {
		return ChannelMonitorUpstreamGroupsResult{}, errors.New("Sub2API 认证方式无效")
	}
	baseURL, accessToken, err := normalizeSub2APITokenConfig(config)
	if err != nil {
		return ChannelMonitorUpstreamGroupsResult{}, err
	}
	config.BaseURL = baseURL
	config.AccessToken = accessToken
	timeout := upstreamGroupRatioTimeout
	if len(channelKeys) > 0 {
		timeout = upstreamGroupApplyTimeout
	}
	requestContext, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	result, err := fetchSub2APIUpstreamGroupsWithToken(requestContext, client, baseURL, accessToken, validateURL)
	if err != nil {
		return result, redactUpstreamGroupRatioSecrets(err, accessToken)
	}
	if !config.SkipBalance {
		balance, balanceErr := fetchSub2APIUpstreamBalanceWithToken(requestContext, client, baseURL, accessToken, validateURL)
		if balanceErr != nil {
			result.Balance.Error = redactUpstreamGroupRatioSecrets(balanceErr, accessToken).Error()
		} else {
			result.Balance = balance
		}
	}
	if len(channelKeys) > 0 {
		appliedGroupID, appliedGroupErr := fetchSub2APIUpstreamKeyGroupWithToken(
			requestContext,
			client,
			baseURL,
			accessToken,
			channelKeys,
			validateURL,
		)
		if appliedGroupErr != nil {
			secrets := []string{accessToken}
			for _, channelKey := range channelKeys {
				secrets = append(secrets, channelKey, url.QueryEscape(channelKey))
			}
			result.AppliedGroupError = redactUpstreamGroupRatioSecrets(appliedGroupErr, secrets...).Error()
		} else {
			result.AppliedGroup = appliedGroupID
			for _, group := range result.Groups {
				if group.ID == appliedGroupID {
					result.AppliedGroup = group.Name
					break
				}
			}
		}
	}
	return result, nil
}

func fetchSub2APIUpstreamKeyGroupWithToken(ctx context.Context, client *http.Client, baseURL string, accessToken string, channelKeys []string, validateURL func(string) error) (string, error) {
	keys, err := normalizeChannelMonitorKeys(channelKeys)
	if err != nil {
		return "", err
	}
	if len(keys) == 0 {
		return "", errors.New("当前渠道没有可匹配的 API Key")
	}

	var appliedGroupID int64
	for index, channelKey := range keys {
		apiKey, findErr := findSub2APIKey(ctx, client, baseURL, accessToken, channelKey, validateURL)
		if findErr != nil {
			return "", fmt.Errorf("读取第 %d 个上游 API Key 当前分组失败: %w", index+1, findErr)
		}
		if apiKey.GroupID == nil || *apiKey.GroupID <= 0 {
			return "", fmt.Errorf("第 %d 个上游 API Key 没有设置分组", index+1)
		}
		if appliedGroupID == 0 {
			appliedGroupID = *apiKey.GroupID
			continue
		}
		if appliedGroupID != *apiKey.GroupID {
			return "", errors.New("当前渠道的多个上游 API Key 使用了不同分组，未自动选择")
		}
	}
	return strconv.FormatInt(appliedGroupID, 10), nil
}

func fetchSub2APIUpstreamBalance(ctx context.Context, client *http.Client, config Sub2APIGroupRatioConfig, validateURL func(string) error) (ChannelMonitorUpstreamBalanceResult, error) {
	switch strings.TrimSpace(config.AuthType) {
	case Sub2APIAuthAccount:
		tokenConfig, err := resolveSub2APIAccountTokenConfig(ctx, client, config, validateURL)
		if err != nil {
			return ChannelMonitorUpstreamBalanceResult{}, err
		}
		result, fetchErr := fetchSub2APIUpstreamBalance(ctx, client, tokenConfig, validateURL)
		if !errors.Is(fetchErr, ErrChannelMonitorUpstreamAuthentication) {
			return result, fetchErr
		}
		invalidateSub2APIAccountToken(config)
		tokenConfig, err = resolveSub2APIAccountTokenConfig(ctx, client, config, validateURL)
		if err != nil {
			return ChannelMonitorUpstreamBalanceResult{}, err
		}
		return fetchSub2APIUpstreamBalance(ctx, client, tokenConfig, validateURL)
	case Sub2APIAuthAPIKey:
		baseURL, err := normalizeSub2APIBaseURL(config.BaseURL)
		if err != nil {
			return ChannelMonitorUpstreamBalanceResult{}, err
		}
		config.BaseURL = baseURL
		keys, err := normalizeChannelMonitorKeys(config.ChannelKeys)
		if err != nil {
			return ChannelMonitorUpstreamBalanceResult{}, err
		}
		if len(keys) == 0 {
			return ChannelMonitorUpstreamBalanceResult{}, errors.New("Sub2API API Key 认证需要当前渠道配置上游 API Key")
		}
		config.ChannelKeys = keys
		balance, err := fetchSub2APIKeyBalance(ctx, client, config, validateURL)
		return balance, redactUpstreamGroupRatioSecrets(err, keys...)
	case Sub2APIAuthToken:
		baseURL, accessToken, err := normalizeSub2APITokenConfig(config)
		if err != nil {
			return ChannelMonitorUpstreamBalanceResult{}, err
		}
		return fetchSub2APIUpstreamBalanceWithToken(ctx, client, baseURL, accessToken, validateURL)
	default:
		return ChannelMonitorUpstreamBalanceResult{}, errors.New("Sub2API 认证方式无效")
	}
}

func fetchSub2APIUpstreamBalanceWithToken(ctx context.Context, client *http.Client, baseURL string, accessToken string, validateURL func(string) error) (ChannelMonitorUpstreamBalanceResult, error) {
	requestContext, cancel := context.WithTimeout(ctx, upstreamGroupRatioTimeout)
	defer cancel()
	result, err := fetchSub2APIProfileBalance(requestContext, client, baseURL, accessToken, validateURL)
	if err != nil {
		return result, redactUpstreamGroupRatioSecrets(err, accessToken)
	}
	return result, nil
}

func fetchSub2APIProfileBalance(ctx context.Context, client *http.Client, baseURL string, accessToken string, validateURL func(string) error) (ChannelMonitorUpstreamBalanceResult, error) {
	profileData, err := requestSub2API(
		ctx,
		client,
		http.MethodGet,
		baseURL+"/api/v1/user/profile",
		nil,
		accessToken,
		"读取上游余额",
		validateURL,
	)
	if err != nil {
		return ChannelMonitorUpstreamBalanceResult{}, err
	}
	var profile sub2APIUserProfile
	if err := common.Unmarshal(profileData, &profile); err != nil || math.IsNaN(profile.Balance) || math.IsInf(profile.Balance, 0) {
		return ChannelMonitorUpstreamBalanceResult{}, errors.New("Sub2API 用户余额响应格式无效")
	}
	amount := profile.Balance
	return ChannelMonitorUpstreamBalanceResult{
		Amount:   &amount,
		Endpoint: "/api/v1/user/profile",
	}, nil
}

func normalizeSub2APIBaseURL(value string) (string, error) {
	return NormalizeNewAPIBaseURL(value)
}

func normalizeSub2APITokenConfig(config Sub2APIGroupRatioConfig) (string, string, error) {
	baseURL, err := NormalizeNewAPIBaseURL(config.BaseURL)
	if err != nil {
		return "", "", err
	}
	accessToken := strings.TrimSpace(config.AccessToken)
	if len(accessToken) >= len("Bearer ") && strings.EqualFold(accessToken[:len("Bearer ")], "Bearer ") {
		accessToken = strings.TrimSpace(accessToken[len("Bearer "):])
	}
	if accessToken == "" {
		return "", "", errors.New("请输入 Sub2API Token（旧版）")
	}
	if len([]rune(accessToken)) > 4096 {
		return "", "", errors.New("Sub2API Token 过长")
	}
	return baseURL, accessToken, nil
}

func fetchSub2APIUpstreamGroupsWithToken(ctx context.Context, client *http.Client, baseURL string, accessToken string, validateURL func(string) error) (ChannelMonitorUpstreamGroupsResult, error) {
	result := ChannelMonitorUpstreamGroupsResult{}
	groupsData, err := requestSub2API(
		ctx,
		client,
		http.MethodGet,
		baseURL+"/api/v1/groups/available",
		nil,
		accessToken,
		"读取可用分组",
		validateURL,
	)
	if err != nil {
		return result, err
	}
	var groups []sub2APIGroupRatioEntry
	if err := common.Unmarshal(groupsData, &groups); err != nil {
		return result, errors.New("Sub2API 可用分组响应格式无效")
	}

	ratesData, err := requestSub2API(
		ctx,
		client,
		http.MethodGet,
		baseURL+"/api/v1/groups/rates",
		nil,
		accessToken,
		"读取用户专属倍率",
		validateURL,
	)
	if err != nil {
		return result, err
	}
	rates := make(map[string]json.RawMessage)
	if len(ratesData) > 0 && string(ratesData) != "null" {
		if err := common.Unmarshal(ratesData, &rates); err != nil {
			return result, errors.New("Sub2API 用户专属倍率响应格式无效")
		}
	}
	result.Groups = make([]ChannelMonitorUpstreamGroup, 0, len(groups))
	for _, entry := range groups {
		groupID := strconv.FormatInt(entry.ID, 10)
		name := strings.TrimSpace(entry.Name)
		if name == "" {
			name = groupID
		}
		rawRatio := entry.RateMultiplier
		endpoint := "/api/v1/groups/available"
		if userRatio, exists := rates[groupID]; exists {
			rawRatio = userRatio
			endpoint = "/api/v1/groups/rates"
		}
		if len(rawRatio) == 0 {
			return result, fmt.Errorf("Sub2API 未返回分组 %q 的倍率", name)
		}
		ratio, parseErr := parseUpstreamGroupRatio(rawRatio)
		if parseErr != nil {
			return result, fmt.Errorf("Sub2API 分组 %q: %w", name, parseErr)
		}
		result.Groups = append(result.Groups, ChannelMonitorUpstreamGroup{
			ID:       groupID,
			Name:     name,
			Ratio:    ratio,
			Endpoint: endpoint,
		})
	}
	if len(result.Groups) == 0 {
		return result, errors.New("Sub2API 当前账号没有可用分组")
	}
	sortChannelMonitorUpstreamGroups(result.Groups)
	return result, nil
}

func applySub2APIUpstreamGroup(ctx context.Context, client *http.Client, config ChannelMonitorUpstreamConfig, channelKeys []string, validateURL func(string) error) (result ChannelMonitorUpstreamGroupApplyResult, err error) {
	authType := strings.TrimSpace(config.AuthType)
	if authType == Sub2APIAuthAccount {
		accountConfig := Sub2APIGroupRatioConfig{
			BaseURL:  config.BaseURL,
			Group:    config.Group,
			AuthType: config.AuthType,
			Account:  config.Account,
			Password: config.Password,
			Proxy:    config.Proxy,
		}
		tokenConfig, resolveErr := resolveSub2APIAccountTokenConfig(ctx, client, accountConfig, validateURL)
		if resolveErr != nil {
			return result, resolveErr
		}
		config.AuthType = Sub2APIAuthToken
		config.AccessToken = tokenConfig.AccessToken
		result, applyErr := applySub2APIUpstreamGroup(ctx, client, config, channelKeys, validateURL)
		if !errors.Is(applyErr, ErrChannelMonitorUpstreamAuthentication) {
			return result, applyErr
		}
		invalidateSub2APIAccountToken(accountConfig)
		tokenConfig, resolveErr = resolveSub2APIAccountTokenConfig(ctx, client, accountConfig, validateURL)
		if resolveErr != nil {
			return result, resolveErr
		}
		config.AccessToken = tokenConfig.AccessToken
		return applySub2APIUpstreamGroup(ctx, client, config, channelKeys, validateURL)
	}
	if authType == Sub2APIAuthAPIKey {
		return result, errors.New("Sub2API API Key 认证不支持应用上游分组，请切换为 Token（旧版）认证")
	}
	if authType != Sub2APIAuthToken {
		return result, errors.New("Sub2API 认证方式无效")
	}
	baseURL, accessToken, err := normalizeSub2APITokenConfig(Sub2APIGroupRatioConfig{
		BaseURL:     config.BaseURL,
		Group:       config.Group,
		AuthType:    config.AuthType,
		AccessToken: config.AccessToken,
	})
	if err != nil {
		return result, err
	}
	group := strings.TrimSpace(config.Group)
	if group == "" {
		return result, errors.New("请输入上游分组")
	}

	defer func() {
		if err == nil {
			return
		}
		secrets := []string{accessToken}
		for _, channelKey := range channelKeys {
			secrets = append(secrets, channelKey, url.QueryEscape(channelKey))
		}
		err = redactUpstreamGroupRatioSecrets(err, secrets...)
	}()

	groupsResult, err := fetchSub2APIUpstreamGroupsWithToken(ctx, client, baseURL, accessToken, validateURL)
	if err != nil {
		return result, err
	}

	var targetGroup ChannelMonitorUpstreamGroup
	for _, entry := range groupsResult.Groups {
		if entry.Name == group || entry.ID == group {
			targetGroup = entry
			break
		}
	}
	if targetGroup.ID == "" {
		return result, fmt.Errorf("Sub2API 当前账号不可见分组 %q", group)
	}
	targetGroupID, err := strconv.ParseInt(targetGroup.ID, 10, 64)
	if err != nil || targetGroupID <= 0 {
		return result, errors.New("Sub2API 上游分组 ID 无效")
	}
	result.Result.Ratio = targetGroup.Ratio
	result.Result.Endpoint = targetGroup.Endpoint

	for index, channelKey := range channelKeys {
		apiKey, findErr := findSub2APIKey(ctx, client, baseURL, accessToken, channelKey, validateURL)
		if findErr != nil {
			return result, fmt.Errorf("查找第 %d 个 Sub2API API Key 失败: %w", index+1, findErr)
		}
		if updateErr := updateSub2APIKeyGroup(ctx, client, baseURL, accessToken, apiKey, targetGroupID, validateURL); updateErr != nil {
			return result, fmt.Errorf("更新第 %d 个 Sub2API API Key 失败: %w", index+1, updateErr)
		}
		result.KeysUpdated++
	}
	return result, nil
}

func findSub2APIKey(ctx context.Context, client *http.Client, baseURL string, accessToken string, channelKey string, validateURL func(string) error) (sub2APIKeyEntry, error) {
	query := url.Values{}
	query.Set("page", "1")
	query.Set("page_size", "1000")
	query.Set("search", channelKey)
	keysData, err := requestSub2API(
		ctx,
		client,
		http.MethodGet,
		baseURL+"/api/v1/keys?"+query.Encode(),
		nil,
		accessToken,
		"查找 API Key",
		validateURL,
	)
	if err != nil {
		return sub2APIKeyEntry{}, err
	}
	var page sub2APIKeyPage
	if err := common.Unmarshal(keysData, &page); err != nil {
		return sub2APIKeyEntry{}, errors.New("Sub2API API Key 列表响应格式无效")
	}
	for _, apiKey := range page.Items {
		if strings.TrimSpace(apiKey.Key) == channelKey {
			return apiKey, nil
		}
	}
	return sub2APIKeyEntry{}, errors.New("Sub2API 未找到与当前渠道 Key 对应的 API Key")
}

func updateSub2APIKeyGroup(ctx context.Context, client *http.Client, baseURL string, accessToken string, apiKey sub2APIKeyEntry, groupID int64, validateURL func(string) error) error {
	requestBody, err := common.Marshal(sub2APIKeyUpdateRequest{
		GroupID:     groupID,
		IPWhitelist: apiKey.IPWhitelist,
		IPBlacklist: apiKey.IPBlacklist,
	})
	if err != nil {
		return err
	}
	_, err = requestSub2API(
		ctx,
		client,
		http.MethodPut,
		baseURL+"/api/v1/keys/"+strconv.FormatInt(apiKey.ID, 10),
		requestBody,
		accessToken,
		"更新 API Key 分组",
		validateURL,
	)
	return err
}

func requestSub2API(ctx context.Context, client *http.Client, method string, requestURL string, body []byte, accessToken string, operation string, validateURL func(string) error) (json.RawMessage, error) {
	if validateURL != nil {
		if err := validateURL(requestURL); err != nil {
			return nil, err
		}
	}

	var requestBody io.Reader
	if len(body) > 0 {
		requestBody = bytes.NewReader(body)
	}
	httpRequest, err := http.NewRequestWithContext(ctx, method, requestURL, requestBody)
	if err != nil {
		return nil, err
	}
	httpRequest.Header.Set("Accept", "application/json")
	if len(body) > 0 {
		httpRequest.Header.Set("Content-Type", "application/json")
	}
	if accessToken != "" {
		accessToken = strings.TrimSpace(accessToken)
		if len(accessToken) >= len("Bearer ") && strings.EqualFold(accessToken[:len("Bearer ")], "Bearer ") {
			accessToken = strings.TrimSpace(accessToken[len("Bearer "):])
		}
		httpRequest.Header.Set("Authorization", "Bearer "+accessToken)
	}

	response, err := client.Do(httpRequest)
	if err != nil {
		return nil, fmt.Errorf("Sub2API %s失败: %w", operation, err)
	}
	defer response.Body.Close()
	responseBody, err := io.ReadAll(io.LimitReader(response.Body, maxUpstreamGroupRatioResponseBytes+1))
	if err != nil {
		return nil, fmt.Errorf("Sub2API %s失败: %w", operation, err)
	}
	if len(responseBody) > maxUpstreamGroupRatioResponseBytes {
		return nil, errors.New("Sub2API 上游响应过大")
	}

	var payload sub2APIResponse
	if err := common.Unmarshal(responseBody, &payload); err != nil {
		if response.StatusCode != http.StatusOK {
			upstreamErr := fmt.Errorf("Sub2API %s失败: 上游返回 %s", operation, response.Status)
			if response.StatusCode == http.StatusUnauthorized || response.StatusCode == http.StatusForbidden {
				return nil, &channelMonitorUpstreamAuthenticationError{cause: upstreamErr}
			}
			return nil, upstreamErr
		}
		return nil, fmt.Errorf("Sub2API %s响应格式无效", operation)
	}
	if response.StatusCode != http.StatusOK || payload.Code != 0 {
		message := strings.TrimSpace(payload.Message)
		if message == "" {
			message = response.Status
		}
		upstreamErr := fmt.Errorf("Sub2API %s失败: %w", operation, upstreamGroupRatioMessage(message))
		if response.StatusCode == http.StatusUnauthorized || response.StatusCode == http.StatusForbidden ||
			payload.Code == http.StatusUnauthorized || payload.Code == http.StatusForbidden {
			return nil, &channelMonitorUpstreamAuthenticationError{cause: upstreamErr}
		}
		return nil, upstreamErr
	}
	return payload.Data, nil
}

func parseUpstreamGroupRatio(raw json.RawMessage) (float64, error) {
	var ratio float64
	if err := common.Unmarshal(raw, &ratio); err != nil {
		var value string
		if stringErr := common.Unmarshal(raw, &value); stringErr != nil {
			return 0, errors.New("上游分组倍率不是数字")
		}
		parsed, parseErr := strconv.ParseFloat(strings.TrimSpace(value), 64)
		if parseErr != nil {
			return 0, errors.New("上游分组倍率不是数字")
		}
		ratio = parsed
	}
	if math.IsNaN(ratio) || math.IsInf(ratio, 0) || ratio < 0 || ratio > maxUpstreamGroupRatio {
		return 0, errors.New("上游分组倍率超出范围")
	}
	return ratio, nil
}

func upstreamGroupRatioMessage(message string) error {
	message = strings.TrimSpace(message)
	if message == "" {
		return errors.New("上游请求失败")
	}
	if len(message) > 256 {
		runes := []rune(message)
		if len(runes) > 256 {
			message = string(runes[:256])
		}
	}
	return errors.New(message)
}

func redactUpstreamGroupRatioSecrets(err error, secrets ...string) error {
	if err == nil {
		return nil
	}
	authenticationFailure := errors.Is(err, ErrChannelMonitorUpstreamAuthentication)
	message := err.Error()
	for _, secret := range secrets {
		secret = strings.TrimSpace(secret)
		if secret != "" {
			message = strings.ReplaceAll(message, secret, "[REDACTED]")
		}
	}
	redactedErr := errors.New(message)
	if authenticationFailure {
		return &channelMonitorUpstreamAuthenticationError{cause: redactedErr}
	}
	return redactedErr
}
