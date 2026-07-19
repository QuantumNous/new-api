package service

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
)

const (
	channelMonitorSub2APIPublicSettingsEndpoint = "/api/v1/settings/public"
	channelMonitorUpstreamVersionTimeout        = 10 * time.Second
	channelMonitorUpstreamVersionBodyBytes      = 1 << 20
)

type ChannelMonitorUpstreamVersionResult struct {
	Version  string `json:"version"`
	Endpoint string `json:"endpoint"`
}

type channelMonitorSub2APIPublicSettingsResponse struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    struct {
		Version string `json:"version"`
	} `json:"data"`
}

// FetchSub2APIUpstreamVersion reads the public build version without requiring
// either a Sub2API API Key or a legacy JWT token.
func FetchSub2APIUpstreamVersion(ctx context.Context, baseURL string, proxyURL string) (ChannelMonitorUpstreamVersionResult, error) {
	normalizedBaseURL, err := NormalizeNewAPIBaseURL(baseURL)
	if err != nil {
		return ChannelMonitorUpstreamVersionResult{}, err
	}
	client, err := NewSSRFProtectedHTTPClientWithProxy(proxyURL)
	if err != nil {
		return ChannelMonitorUpstreamVersionResult{}, err
	}

	requestURL := normalizedBaseURL + channelMonitorSub2APIPublicSettingsEndpoint
	if err := ValidateSSRFProtectedFetchURL(requestURL); err != nil {
		return ChannelMonitorUpstreamVersionResult{}, err
	}
	requestContext, cancel := context.WithTimeout(ctx, channelMonitorUpstreamVersionTimeout)
	defer cancel()
	request, err := http.NewRequestWithContext(requestContext, http.MethodGet, requestURL, nil)
	if err != nil {
		return ChannelMonitorUpstreamVersionResult{}, fmt.Errorf("读取 Sub2API 版本失败: %w", err)
	}
	request.Header.Set("Accept", "application/json")
	response, err := client.Do(request)
	if err != nil {
		return ChannelMonitorUpstreamVersionResult{}, fmt.Errorf("读取 Sub2API 版本失败: %w", err)
	}
	defer response.Body.Close()
	body, err := io.ReadAll(io.LimitReader(response.Body, channelMonitorUpstreamVersionBodyBytes+1))
	if err != nil {
		return ChannelMonitorUpstreamVersionResult{}, fmt.Errorf("读取 Sub2API 版本失败: %w", err)
	}
	if len(body) > channelMonitorUpstreamVersionBodyBytes {
		return ChannelMonitorUpstreamVersionResult{}, errors.New("Sub2API 版本响应过大")
	}
	if response.StatusCode != http.StatusOK {
		return ChannelMonitorUpstreamVersionResult{}, fmt.Errorf("读取 Sub2API 版本失败: 上游返回 %s", response.Status)
	}

	var payload channelMonitorSub2APIPublicSettingsResponse
	if err := common.Unmarshal(body, &payload); err != nil {
		return ChannelMonitorUpstreamVersionResult{}, errors.New("Sub2API 版本响应格式无效")
	}
	if payload.Code != 0 {
		message := strings.TrimSpace(payload.Message)
		if message == "" {
			message = "上游返回错误"
		}
		return ChannelMonitorUpstreamVersionResult{}, fmt.Errorf("读取 Sub2API 版本失败: %s", message)
	}
	version := strings.TrimSpace(payload.Data.Version)
	if version == "" {
		return ChannelMonitorUpstreamVersionResult{}, errors.New("Sub2API 未返回版本号")
	}
	if utf8.RuneCountInString(version) > 64 {
		return ChannelMonitorUpstreamVersionResult{}, errors.New("Sub2API 版本号过长")
	}
	return ChannelMonitorUpstreamVersionResult{
		Version:  version,
		Endpoint: channelMonitorSub2APIPublicSettingsEndpoint,
	}, nil
}
