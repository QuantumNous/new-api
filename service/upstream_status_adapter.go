package service

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/model"
)

func fetchIkunStatusRecords(ctx context.Context, client *http.Client, provider UpstreamStatusProvider) ([]model.SupplierStatusSync, error) {
	var payload ikunStatusPage
	if err := getAndDecodeUpstreamStatus(ctx, client, provider.StatusURL, &payload); err != nil {
		return nil, err
	}
	now := time.Now().Unix()
	records := make([]model.SupplierStatusSync, 0)
	for _, group := range payload.Groups {
		for _, layer := range group.Layers {
			modelName := firstNonEmpty(layer.RequestModel, layer.Model)
			monitorID := group.ProviderSlug + ":" + modelName
			for _, point := range layer.Timeline {
				records = append(records, model.SupplierStatusSync{
					Provider:     provider.Name,
					DisplayName:  normalizeProviderDisplayName(provider),
					GroupName:    firstNonEmpty(group.Provider, group.ProviderSlug),
					MonitorID:    monitorID,
					MonitorName:  layer.Model,
					ModelName:    modelName,
					Status:       point.Status,
					Availability: point.Availability,
					Latency:      point.Latency,
					Raw:          rawJSONString(point),
					CheckedAt:    point.Timestamp,
					CreatedAt:    now,
				})
			}
			if len(layer.Timeline) == 0 && layer.CurrentStatus.Timestamp > 0 {
				records = append(records, model.SupplierStatusSync{
					Provider:     provider.Name,
					DisplayName:  normalizeProviderDisplayName(provider),
					GroupName:    firstNonEmpty(group.Provider, group.ProviderSlug),
					MonitorID:    monitorID,
					MonitorName:  layer.Model,
					ModelName:    modelName,
					Status:       layer.CurrentStatus.Status,
					Availability: availabilityFromStatus(layer.CurrentStatus.Status),
					Latency:      layer.CurrentStatus.Latency,
					Raw:          rawJSONString(layer.CurrentStatus),
					CheckedAt:    layer.CurrentStatus.Timestamp,
					CreatedAt:    now,
				})
			}
		}
	}
	return records, nil
}

func fetchUptimeKumaStatusRecords(ctx context.Context, client *http.Client, provider UpstreamStatusProvider) ([]model.SupplierStatusSync, error) {
	statusURL, heartbeatURL := resolveProviderStatusPageURLs(provider)
	var statusPage foxcodeStatusPage
	if err := getAndDecodeUpstreamStatus(ctx, client, statusURL, &statusPage); err != nil {
		return nil, err
	}
	var heartbeatPage foxcodeHeartbeatPage
	if err := getAndDecodeUpstreamStatus(ctx, client, heartbeatURL, &heartbeatPage); err != nil {
		return nil, err
	}
	return buildUptimeKumaRecords(provider, statusPage, heartbeatPage), nil
}

func buildUptimeKumaRecords(provider UpstreamStatusProvider, statusPage foxcodeStatusPage, heartbeatPage foxcodeHeartbeatPage) []model.SupplierStatusSync {
	now := time.Now().Unix()
	records := make([]model.SupplierStatusSync, 0)
	for _, group := range statusPage.PublicGroupList {
		for _, monitor := range group.MonitorList {
			monitorID := intToString(monitor.ID)
			for _, heartbeat := range heartbeatPage.HeartbeatList[monitorID] {
				checkedAt := parseFoxcodeTime(heartbeat.Time)
				if checkedAt == 0 {
					continue
				}
				latency := 0
				if heartbeat.Ping != nil {
					latency = *heartbeat.Ping
				}
				records = append(records, model.SupplierStatusSync{
					Provider:     provider.Name,
					DisplayName:  normalizeProviderDisplayName(provider),
					GroupName:    group.Name,
					MonitorID:    monitorID,
					MonitorName:  monitor.Name,
					ModelName:    monitor.Name,
					Status:       heartbeat.Status,
					Availability: heartbeatPage.UptimeList[uptimeKey(monitorID)] * 100,
					Latency:      latency,
					Message:      heartbeat.Msg,
					Raw:          rawJSONString(heartbeat),
					CheckedAt:    checkedAt,
					CreatedAt:    now,
				})
			}
		}
	}
	return records
}

func resolveProviderStatusPageURLs(provider UpstreamStatusProvider) (string, string) {
	heartbeatURL := strings.TrimRight(provider.HeartbeatURL, "/")
	statusURL := strings.TrimRight(provider.StatusURL, "/")
	if statusURL != "" && heartbeatURL != "" {
		return statusURL, heartbeatURL
	}
	if statusURL == "" && heartbeatURL != "" {
		statusURL, heartbeatURL = resolveStatusPageURLs(heartbeatURL, "")
	}
	return statusURL, heartbeatURL
}

func resolveStatusPageURLs(rawURL string, slug string) (string, string) {
	rawURL = strings.TrimRight(strings.TrimSpace(rawURL), "/")
	slug = strings.Trim(strings.TrimSpace(slug), "/")
	if rawURL == "" {
		return "", ""
	}
	const heartbeatPath = "/api/status-page/heartbeat/"
	const statusPath = "/api/status-page/"
	if idx := strings.LastIndex(rawURL, heartbeatPath); idx >= 0 {
		baseURL := strings.TrimRight(rawURL[:idx], "/")
		if slug == "" {
			slug = strings.Trim(strings.TrimPrefix(rawURL[idx+len(heartbeatPath):], "/"), "/")
		}
		if baseURL == "" || slug == "" {
			return "", ""
		}
		return baseURL + statusPath + slug, baseURL + heartbeatPath + slug
	}
	if slug == "" {
		return "", ""
	}
	baseURL := strings.TrimSuffix(rawURL, "/")
	return baseURL + statusPath + slug, baseURL + heartbeatPath + slug
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}
