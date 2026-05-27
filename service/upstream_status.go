package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
)

func DefaultUpstreamStatusProviders() []UpstreamStatusProvider {
	return []UpstreamStatusProvider{
		{
			Name:        "ikun",
			DisplayName: "Ikun",
			Kind:        UpstreamStatusProviderKindIkun,
			StatusURL:   "https://status.ikuncode.cc/api/status?period=90m&board=hot",
		},
		{
			Name:         "foxcode",
			DisplayName:  "Foxcode",
			Kind:         UpstreamStatusProviderKindUptimeKuma,
			HeartbeatURL: "https://status.rjj.cc/api/status-page/heartbeat/foxcode",
		},
	}
}

var upstreamStatusProviderSource = DefaultUpstreamStatusProviders

func SyncUpstreamStatusProvider(ctx context.Context, client *http.Client, provider UpstreamStatusProvider) UpstreamStatusSyncResult {
	records, err := fetchUpstreamStatusRecords(ctx, client, provider)
	if err != nil {
		return UpstreamStatusSyncResult{Provider: provider.Name, Error: err}
	}
	if err = model.BatchUpsertSupplierStatusSync(records); err != nil {
		return UpstreamStatusSyncResult{Provider: provider.Name, Error: err}
	}
	invalidatePublicUpstreamStatusCache()
	return UpstreamStatusSyncResult{Provider: provider.Name, Upserted: len(records)}
}

func fetchUpstreamStatusRecords(ctx context.Context, client *http.Client, provider UpstreamStatusProvider) ([]model.SupplierStatusSync, error) {
	switch provider.Kind {
	case UpstreamStatusProviderKindIkun:
		return fetchIkunStatusRecords(ctx, client, provider)
	case UpstreamStatusProviderKindUptimeKuma:
		return fetchUptimeKumaStatusRecords(ctx, client, provider)
	default:
		return nil, fmt.Errorf("unsupported upstream status provider kind: %s", provider.Kind)
	}
}

func BuildPublicUpstreamStatus(ctx context.Context) (PublicUpstreamStatusPayload, error) {
	if cached, ok := getCachedPublicUpstreamStatus(ctx); ok {
		return cached, nil
	}
	since := time.Now().Add(-upstreamStatusHistoryWindow).Unix()
	records, err := model.GetRecentSupplierStatusSync(since)
	if err != nil {
		return PublicUpstreamStatusPayload{}, err
	}
	probes, err := model.GetRecentChannelProbeResults(since)
	if err != nil {
		return PublicUpstreamStatusPayload{}, err
	}
	if len(records) == 0 && len(probes) == 0 {
		liveRecords := loadLiveUpstreamStatusRecords(ctx)
		if len(liveRecords) > 0 {
			payload := buildPublicUpstreamStatus(liveRecords, nil)
			cachePublicUpstreamStatus(ctx, payload)
			return payload, nil
		}
	}
	payload := buildPublicUpstreamStatus(records, probes)
	cachePublicUpstreamStatus(ctx, payload)
	return payload, nil
}

func StartUpstreamStatusSyncTask() {
	if os.Getenv("UPSTREAM_STATUS_SYNC_ENABLED") == "false" {
		common.SysLog("upstream status sync task disabled")
		return
	}
	if err := model.EnsureSupplierStatusSyncTable(); err != nil {
		logger.LogError(context.Background(), fmt.Sprintf("ensure upstream status sync table failed: %v", err))
		return
	}
	interval := common.GetEnvOrDefault("UPSTREAM_STATUS_SYNC_INTERVAL_SECONDS", 180)
	if interval < 60 {
		interval = 60
	}
	go upstreamStatusSyncLoop(time.Duration(interval) * time.Second)
}

func upstreamStatusSyncLoop(interval time.Duration) {
	client := &http.Client{Timeout: 10 * time.Second}
	syncAllUpstreamStatus(context.Background(), client)
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for range ticker.C {
		syncAllUpstreamStatus(context.Background(), client)
	}
}

func syncAllUpstreamStatus(ctx context.Context, client *http.Client) []UpstreamStatusSyncResult {
	providers := upstreamStatusProviderSource()
	results := make([]UpstreamStatusSyncResult, 0, len(providers))
	for _, provider := range providers {
		result := SyncUpstreamStatusProvider(ctx, client, provider)
		if result.Error != nil {
			logger.LogError(ctx, fmt.Sprintf("sync upstream status failed: provider=%s error=%v", provider.Name, result.Error))
		}
		results = append(results, result)
	}
	return results
}

func loadLiveUpstreamStatusRecords(ctx context.Context) []model.SupplierStatusSync {
	client := &http.Client{Timeout: 10 * time.Second}
	records := make([]model.SupplierStatusSync, 0)
	for _, provider := range upstreamStatusProviderSource() {
		providerRecords, err := fetchUpstreamStatusRecords(ctx, client, provider)
		if err != nil {
			logger.LogError(ctx, fmt.Sprintf("load live upstream status failed: provider=%s error=%v", provider.Name, err))
			continue
		}
		records = append(records, providerRecords...)
	}
	return records
}

func getAndDecodeUpstreamStatus(ctx context.Context, client *http.Client, url string, dest any) error {
	if url == "" {
		return errors.New("empty upstream status url")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/json")
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("upstream status returned HTTP %d", resp.StatusCode)
	}
	return json.NewDecoder(resp.Body).Decode(dest)
}

func cachePublicUpstreamStatus(ctx context.Context, payload PublicUpstreamStatusPayload) {
	if !common.RedisEnabled || common.RDB == nil {
		return
	}
	if bytes, err := json.Marshal(payload); err == nil {
		_ = common.RDB.Set(ctx, upstreamStatusPublicCacheKey, string(bytes), upstreamStatusCacheTTL).Err()
	}
}

func getCachedPublicUpstreamStatus(ctx context.Context) (PublicUpstreamStatusPayload, bool) {
	if !common.RedisEnabled || common.RDB == nil {
		return PublicUpstreamStatusPayload{}, false
	}
	value, err := common.RDB.Get(ctx, upstreamStatusPublicCacheKey).Result()
	if err != nil || value == "" {
		return PublicUpstreamStatusPayload{}, false
	}
	var payload PublicUpstreamStatusPayload
	return payload, json.Unmarshal([]byte(value), &payload) == nil
}

func invalidatePublicUpstreamStatusCache() {
	if common.RedisEnabled && common.RDB != nil {
		_ = common.RedisDel(upstreamStatusPublicCacheKey)
	}
}

func parseFoxcodeTime(value string) int64 {
	for _, layout := range []string{"2006-01-02 15:04:05.000", "2006-01-02 15:04:05"} {
		if parsed, err := time.ParseInLocation(layout, value, time.UTC); err == nil {
			return parsed.Unix()
		}
	}
	return 0
}

func rawJSONString(value any) string {
	bytes, err := json.Marshal(value)
	if err != nil {
		return ""
	}
	return string(bytes)
}

func availabilityFromStatus(status int) float64 {
	if status == 1 {
		return 100
	}
	return 0
}

func normalizeProviderDisplayName(provider UpstreamStatusProvider) string {
	if provider.DisplayName != "" {
		return provider.DisplayName
	}
	return provider.Name
}

func sortPublicPayload(payload *PublicUpstreamStatusPayload) {
	sort.SliceStable(payload.Data, func(i, j int) bool {
		return payload.Data[i].CategoryName < payload.Data[j].CategoryName
	})
	for i := range payload.Data {
		sort.SliceStable(payload.Data[i].Monitors, func(a, b int) bool {
			left := payload.Data[i].Monitors[a]
			right := payload.Data[i].Monitors[b]
			if left.Group == right.Group {
				return left.Model < right.Model
			}
			return left.Group < right.Group
		})
	}
}

func monitorKey(provider string, group string, modelName string) string {
	return strings.Join([]string{provider, group, modelName}, "\x00")
}

func uptimeKey(monitorID string) string {
	return monitorID + "_24"
}

func intToString(value int) string {
	return strconv.Itoa(value)
}
