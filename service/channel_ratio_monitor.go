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
	Sub2APIAuthRefreshToken  = "refresh_token"

	maxUpstreamGroupRatioResponseBytes = 1 << 20
	maxUpstreamGroupRatio              = 1_000_000
	upstreamGroupRatioTimeout          = 15 * time.Second
	upstreamGroupApplyTimeout          = 30 * time.Second
)

// ChannelMonitorUpstreamConfig contains the credentials needed to read a
// group multiplier from a configured upstream panel.
type ChannelMonitorUpstreamConfig struct {
	Type         string
	BaseURL      string
	Group        string
	AuthType     string
	UserID       int
	AccessToken  string
	RefreshToken string
}

type NewAPIGroupRatioConfig struct {
	BaseURL     string
	Group       string
	AuthType    string
	UserID      int
	AccessToken string
}

type NewAPIGroupRatioResult struct {
	Ratio            float64 `json:"ratio"`
	Endpoint         string  `json:"endpoint"`
	NextRefreshToken string  `json:"-"`
}

type ChannelMonitorUpstreamGroup struct {
	ID       string  `json:"id,omitempty"`
	Name     string  `json:"name"`
	Ratio    float64 `json:"ratio"`
	Endpoint string  `json:"-"`
}

type ChannelMonitorUpstreamGroupsResult struct {
	Groups           []ChannelMonitorUpstreamGroup `json:"groups"`
	NextRefreshToken string                        `json:"-"`
}

type ChannelMonitorUpstreamGroupApplyResult struct {
	Result      NewAPIGroupRatioResult `json:"result"`
	KeysUpdated int                    `json:"keys_updated"`
}

type Sub2APIGroupRatioConfig struct {
	BaseURL      string
	Group        string
	RefreshToken string
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
	switch config.Type {
	case NewAPIUpstreamType:
		return FetchNewAPIGroupRatio(ctx, NewAPIGroupRatioConfig{
			BaseURL:     config.BaseURL,
			Group:       config.Group,
			AuthType:    config.AuthType,
			UserID:      config.UserID,
			AccessToken: config.AccessToken,
		})
	case Sub2APIUpstreamType:
		return FetchSub2APIGroupRatio(ctx, Sub2APIGroupRatioConfig{
			BaseURL:      config.BaseURL,
			Group:        config.Group,
			RefreshToken: config.RefreshToken,
		})
	default:
		return NewAPIGroupRatioResult{}, errors.New("不支持的上游类型")
	}
}

func FetchChannelMonitorUpstreamGroups(ctx context.Context, config ChannelMonitorUpstreamConfig) (ChannelMonitorUpstreamGroupsResult, error) {
	client := GetSSRFProtectedHTTPClient()
	if client == nil {
		return ChannelMonitorUpstreamGroupsResult{}, errors.New("上游请求客户端未初始化")
	}
	switch config.Type {
	case NewAPIUpstreamType:
		return fetchNewAPIUpstreamGroups(ctx, client, NewAPIGroupRatioConfig{
			BaseURL:     config.BaseURL,
			AuthType:    config.AuthType,
			UserID:      config.UserID,
			AccessToken: config.AccessToken,
		}, ValidateSSRFProtectedFetchURL)
	case Sub2APIUpstreamType:
		return fetchSub2APIUpstreamGroups(ctx, client, Sub2APIGroupRatioConfig{
			BaseURL:      config.BaseURL,
			RefreshToken: config.RefreshToken,
		}, ValidateSSRFProtectedFetchURL)
	default:
		return ChannelMonitorUpstreamGroupsResult{}, errors.New("不支持的上游类型")
	}
}

func ApplyChannelMonitorUpstreamGroup(ctx context.Context, config ChannelMonitorUpstreamConfig, channelKeys []string) (ChannelMonitorUpstreamGroupApplyResult, error) {
	client := GetSSRFProtectedHTTPClient()
	if client == nil {
		return ChannelMonitorUpstreamGroupApplyResult{}, errors.New("上游请求客户端未初始化")
	}
	return applyChannelMonitorUpstreamGroup(ctx, client, config, channelKeys, ValidateSSRFProtectedFetchURL)
}

func applyChannelMonitorUpstreamGroup(ctx context.Context, client *http.Client, config ChannelMonitorUpstreamConfig, channelKeys []string, validateURL func(string) error) (ChannelMonitorUpstreamGroupApplyResult, error) {
	keys := make([]string, 0, len(channelKeys))
	seen := make(map[string]struct{}, len(channelKeys))
	for _, channelKey := range channelKeys {
		channelKey = strings.TrimSpace(channelKey)
		if channelKey == "" {
			continue
		}
		if len([]rune(channelKey)) > 4096 {
			return ChannelMonitorUpstreamGroupApplyResult{}, errors.New("渠道上游令牌过长")
		}
		if _, exists := seen[channelKey]; exists {
			continue
		}
		seen[channelKey] = struct{}{}
		keys = append(keys, channelKey)
	}
	if len(keys) == 0 {
		return ChannelMonitorUpstreamGroupApplyResult{}, errors.New("当前渠道没有可应用分组的上游令牌")
	}

	requestContext, cancel := context.WithTimeout(ctx, upstreamGroupApplyTimeout)
	defer cancel()

	var result ChannelMonitorUpstreamGroupApplyResult
	var err error
	switch config.Type {
	case NewAPIUpstreamType:
		result, err = applyNewAPIUpstreamGroup(requestContext, client, config, keys, validateURL)
	case Sub2APIUpstreamType:
		result, err = applySub2APIUpstreamGroup(requestContext, client, config, keys, validateURL)
	default:
		err = errors.New("不支持的上游类型")
	}
	if err == nil {
		return result, nil
	}
	accessToken := strings.TrimSpace(config.AccessToken)
	secrets := []string{
		accessToken,
		strings.TrimPrefix(accessToken, "Bearer "),
		config.RefreshToken,
	}
	for _, key := range keys {
		secrets = append(secrets, key, url.QueryEscape(key))
	}
	return result, redactUpstreamGroupRatioSecrets(err, secrets...)
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
		sort.Slice(groups, func(i, j int) bool { return groups[i].Name < groups[j].Name })
		return ChannelMonitorUpstreamGroupsResult{Groups: groups}, nil
	}
	return ChannelMonitorUpstreamGroupsResult{}, errors.New(strings.Join(errorsByEndpoint, "; "))
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

type sub2APIRefreshTokenRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type sub2APIRefreshTokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
}

type sub2APISession struct {
	AccessToken  string
	RefreshToken string
}

type sub2APIKeyEntry struct {
	ID          int64    `json:"id"`
	Key         string   `json:"key"`
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
	groupsResult, err := fetchSub2APIUpstreamGroups(ctx, client, config, validateURL)
	result := NewAPIGroupRatioResult{NextRefreshToken: groupsResult.NextRefreshToken}
	if err != nil {
		return result, err
	}
	for _, entry := range groupsResult.Groups {
		if entry.Name == group || entry.ID == group {
			result.Ratio = entry.Ratio
			result.Endpoint = entry.Endpoint
			return result, nil
		}
	}
	return result, fmt.Errorf("Sub2API 当前账号不可见分组 %q", group)
}

func fetchSub2APIUpstreamGroups(ctx context.Context, client *http.Client, config Sub2APIGroupRatioConfig, validateURL func(string) error) (ChannelMonitorUpstreamGroupsResult, error) {
	baseURL, refreshToken, err := normalizeSub2APIConfig(config)
	if err != nil {
		return ChannelMonitorUpstreamGroupsResult{}, err
	}
	requestContext, cancel := context.WithTimeout(ctx, upstreamGroupRatioTimeout)
	defer cancel()
	session, err := refreshSub2APISession(requestContext, client, baseURL, refreshToken, validateURL)
	result := ChannelMonitorUpstreamGroupsResult{NextRefreshToken: session.RefreshToken}
	if err != nil {
		return result, redactUpstreamGroupRatioSecrets(err, refreshToken, session.RefreshToken, session.AccessToken)
	}
	result, err = fetchSub2APIUpstreamGroupsWithSession(requestContext, client, baseURL, session.AccessToken, validateURL)
	result.NextRefreshToken = session.RefreshToken
	if err != nil {
		return result, redactUpstreamGroupRatioSecrets(err, refreshToken, session.RefreshToken, session.AccessToken)
	}
	return result, nil
}

func normalizeSub2APIConfig(config Sub2APIGroupRatioConfig) (string, string, error) {
	baseURL, err := NormalizeNewAPIBaseURL(config.BaseURL)
	if err != nil {
		return "", "", err
	}
	refreshToken := strings.TrimSpace(config.RefreshToken)
	if refreshToken == "" {
		return "", "", errors.New("请输入 Sub2API Refresh Token")
	}
	if len([]rune(refreshToken)) > 4096 {
		return "", "", errors.New("Sub2API Refresh Token 过长")
	}
	return baseURL, refreshToken, nil
}

func refreshSub2APISession(ctx context.Context, client *http.Client, baseURL string, refreshToken string, validateURL func(string) error) (sub2APISession, error) {
	refreshBody, err := common.Marshal(sub2APIRefreshTokenRequest{RefreshToken: refreshToken})
	if err != nil {
		return sub2APISession{}, err
	}
	refreshData, err := requestSub2API(
		ctx,
		client,
		http.MethodPost,
		baseURL+"/api/v1/auth/refresh",
		refreshBody,
		"",
		"刷新登录凭据",
		validateURL,
	)
	if err != nil {
		return sub2APISession{}, err
	}
	var refreshed sub2APIRefreshTokenResponse
	if err := common.Unmarshal(refreshData, &refreshed); err != nil {
		return sub2APISession{}, errors.New("Sub2API 刷新凭据响应格式无效")
	}
	session := sub2APISession{
		AccessToken:  strings.TrimSpace(refreshed.AccessToken),
		RefreshToken: strings.TrimSpace(refreshed.RefreshToken),
	}
	if session.RefreshToken == "" {
		return sub2APISession{}, errors.New("Sub2API 刷新响应中没有新的 Refresh Token")
	}
	if session.RefreshToken == refreshToken {
		return sub2APISession{}, errors.New("Sub2API 没有轮换 Refresh Token")
	}
	if session.AccessToken == "" {
		return session, errors.New("Sub2API 刷新响应中没有访问令牌")
	}
	return session, nil
}

func fetchSub2APIUpstreamGroupsWithSession(ctx context.Context, client *http.Client, baseURL string, accessToken string, validateURL func(string) error) (ChannelMonitorUpstreamGroupsResult, error) {
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
	sort.Slice(result.Groups, func(i, j int) bool {
		if result.Groups[i].Name == result.Groups[j].Name {
			return result.Groups[i].ID < result.Groups[j].ID
		}
		return result.Groups[i].Name < result.Groups[j].Name
	})
	return result, nil
}

func applySub2APIUpstreamGroup(ctx context.Context, client *http.Client, config ChannelMonitorUpstreamConfig, channelKeys []string, validateURL func(string) error) (result ChannelMonitorUpstreamGroupApplyResult, err error) {
	baseURL, refreshToken, err := normalizeSub2APIConfig(Sub2APIGroupRatioConfig{
		BaseURL:      config.BaseURL,
		Group:        config.Group,
		RefreshToken: config.RefreshToken,
	})
	if err != nil {
		return result, err
	}
	group := strings.TrimSpace(config.Group)
	if group == "" {
		return result, errors.New("请输入上游分组")
	}

	var session sub2APISession
	defer func() {
		if err == nil {
			return
		}
		secrets := []string{refreshToken, session.RefreshToken, session.AccessToken}
		for _, channelKey := range channelKeys {
			secrets = append(secrets, channelKey, url.QueryEscape(channelKey))
		}
		err = redactUpstreamGroupRatioSecrets(err, secrets...)
	}()

	session, err = refreshSub2APISession(ctx, client, baseURL, refreshToken, validateURL)
	result.Result.NextRefreshToken = session.RefreshToken
	if err != nil {
		return result, err
	}
	groupsResult, err := fetchSub2APIUpstreamGroupsWithSession(ctx, client, baseURL, session.AccessToken, validateURL)
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
		apiKey, findErr := findSub2APIKey(ctx, client, baseURL, session.AccessToken, channelKey, validateURL)
		if findErr != nil {
			return result, fmt.Errorf("查找第 %d 个 Sub2API API Key 失败: %w", index+1, findErr)
		}
		if updateErr := updateSub2APIKeyGroup(ctx, client, baseURL, session.AccessToken, apiKey, targetGroupID, validateURL); updateErr != nil {
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
			return nil, fmt.Errorf("Sub2API %s失败: 上游返回 %s", operation, response.Status)
		}
		return nil, fmt.Errorf("Sub2API %s响应格式无效", operation)
	}
	if response.StatusCode != http.StatusOK || payload.Code != 0 {
		message := strings.TrimSpace(payload.Message)
		if message == "" {
			message = response.Status
		}
		return nil, fmt.Errorf("Sub2API %s失败: %w", operation, upstreamGroupRatioMessage(message))
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
	message := err.Error()
	for _, secret := range secrets {
		secret = strings.TrimSpace(secret)
		if secret != "" {
			message = strings.ReplaceAll(message, secret, "[REDACTED]")
		}
	}
	return errors.New(message)
}
