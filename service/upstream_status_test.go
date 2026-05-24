package service

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupUpstreamStatusTestDB(t *testing.T) {
	t.Helper()

	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	model.DB = db
	require.NoError(t, db.AutoMigrate(
		&model.SupplierStatusSync{},
		&model.Channel{},
		&model.Ability{},
	))

	originalRedisEnabled := common.RedisEnabled
	common.RedisEnabled = false
	t.Cleanup(func() {
		common.RedisEnabled = originalRedisEnabled
	})
}

func TestSyncFoxcodeHeartbeatStoresMonitorHistory(t *testing.T) {
	setupUpstreamStatusTestDB(t)

	mux := http.NewServeMux()
	mux.HandleFunc("/api/status-page/foxcode", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"publicGroupList": [{
				"name": "Codex 分组",
				"monitorList": [{"id": 8, "name": "Codex 官方线路"}]
			}]
		}`))
	})
	mux.HandleFunc("/api/status-page/heartbeat/foxcode", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"heartbeatList": {
				"8": [
					{"status": 1, "time": "2026-05-23 12:00:00.000", "msg": "", "ping": 1200},
					{"status": 0, "time": "2026-05-23 12:05:00.000", "msg": "timeout", "ping": null}
				]
			},
			"uptimeList": {"8_24": 0.99}
		}`))
	})
	server := httptest.NewServer(mux)
	defer server.Close()

	provider := UpstreamStatusProvider{
		Name:         "foxcode",
		DisplayName:  "Foxcode",
		Kind:         UpstreamStatusProviderKindUptimeKuma,
		HeartbeatURL: server.URL + "/api/status-page/heartbeat/foxcode",
	}

	result := SyncUpstreamStatusProvider(context.Background(), server.Client(), provider)

	require.NoError(t, result.Error)
	require.Equal(t, 2, result.Upserted)
	var records []model.SupplierStatusSync
	require.NoError(t, model.DB.Order("checked_at asc").Find(&records).Error)
	require.Len(t, records, 2)
	require.Equal(t, "foxcode", records[0].Provider)
	require.Equal(t, "Codex 分组", records[0].GroupName)
	require.Equal(t, "Codex 官方线路", records[0].ModelName)
	require.Equal(t, 1, records[0].Status)
	require.Equal(t, 1200, records[0].Latency)
	require.Equal(t, 0, records[1].Status)
}

func TestParseFoxcodeTimeUsesUTC(t *testing.T) {
	got := parseFoxcodeTime("2026-05-24 07:31:02.834")
	want := time.Date(2026, 5, 24, 7, 31, 2, 0, time.UTC).Unix()

	require.Equal(t, want, got)
}

func TestSyncIkunStatusStoresModelTimeline(t *testing.T) {
	setupUpstreamStatusTestDB(t)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"data": [],
			"groups": [{
				"provider": "Codex Pro",
				"provider_slug": "codex-pro",
				"current_status": 2,
				"layers": [{
					"model": "GPT 5.4",
					"request_model": "gpt-5.4",
					"current_status": {"status": 1, "latency": 1300, "timestamp": 1779441000},
					"timeline": [
						{"timestamp": 1779440700, "status": 2, "latency": 5200, "availability": 70},
						{"timestamp": 1779441000, "status": 1, "latency": 1300, "availability": 100}
					]
				}]
			}]
		}`))
	}))
	defer server.Close()

	provider := UpstreamStatusProvider{
		Name:        "ikun",
		DisplayName: "Ikun",
		Kind:        UpstreamStatusProviderKindIkun,
		StatusURL:   server.URL,
	}

	result := SyncUpstreamStatusProvider(context.Background(), server.Client(), provider)

	require.NoError(t, result.Error)
	require.Equal(t, 2, result.Upserted)
	var records []model.SupplierStatusSync
	require.NoError(t, model.DB.Order("checked_at asc").Find(&records).Error)
	require.Len(t, records, 2)
	require.Equal(t, "codex-pro:gpt-5.4", records[0].MonitorID)
	require.Equal(t, "Codex Pro", records[0].GroupName)
	require.Equal(t, "gpt-5.4", records[0].ModelName)
	require.Equal(t, 2, records[0].Status)
	require.Equal(t, 70.0, records[0].Availability)
	require.Equal(t, 1, records[1].Status)
}

func TestBuildPublicUpstreamStatusGroupsRecentHistoryByPlatformGroup(t *testing.T) {
	setupUpstreamStatusTestDB(t)
	now := time.Now().Unix()
	records := []model.SupplierStatusSync{
		{
			Provider:     "ikun",
			DisplayName:  "Ikun",
			GroupName:    "Codex Pro",
			MonitorID:    "codex-pro:gpt-5.4",
			ModelName:    "gpt-5.4",
			Status:       1,
			Availability: 100,
			Latency:      1400,
			CheckedAt:    now - 60,
			CreatedAt:    now - 60,
		},
		{
			Provider:     "ikun",
			DisplayName:  "Ikun",
			GroupName:    "Codex Pro",
			MonitorID:    "codex-pro:gpt-5.4",
			ModelName:    "gpt-5.4",
			Status:       2,
			Availability: 70,
			Latency:      5300,
			CheckedAt:    now - 360,
			CreatedAt:    now - 360,
		},
		{
			Provider:     "foxcode",
			DisplayName:  "Foxcode",
			GroupName:    "Codex Pro",
			MonitorID:    "8",
			MonitorName:  "Codex official line",
			ModelName:    "gpt-5.5",
			Status:       1,
			Availability: 99,
			Latency:      1200,
			CheckedAt:    now - 120,
			CreatedAt:    now - 120,
		},
	}
	require.NoError(t, model.DB.Create(&records).Error)

	payload, err := BuildPublicUpstreamStatus(context.Background())

	require.NoError(t, err)
	require.Len(t, payload.Data, 2)
	require.Equal(t, "GPT 中转渠道", payload.Data[0].CategoryName)
	require.Equal(t, "GPT 官方渠道", payload.Data[1].CategoryName)
	require.Len(t, payload.Data[0].Monitors, 1)
	require.Len(t, payload.Data[1].Monitors, 1)
	monitor := payload.Data[0].Monitors[0]
	require.Equal(t, "gpt-5.4", monitor.Model)
	require.Equal(t, "GPT 中转渠道", monitor.Group)
	require.Equal(t, 1, monitor.Status)
	require.Equal(t, 100.0, monitor.Availability)
	require.Len(t, monitor.History, 2)
	require.NotEqual(t, "Ikun", payload.Data[0].CategoryName)
	require.NotEqual(t, "Foxcode", payload.Data[0].CategoryName)
}

func TestBuildPublicUpstreamStatusPrefersConfiguredChannelPlatformGroup(t *testing.T) {
	setupUpstreamStatusTestDB(t)
	now := time.Now().Unix()
	tag := "ikun-gpt"
	priority := int64(100)
	weight := uint(10)
	require.NoError(t, model.DB.Create(&model.Channel{
		Id:          10,
		Status:      common.ChannelStatusEnabled,
		Name:        "iKun Codex 中转",
		Models:      "gpt-5.4",
		Group:       "GPT 中转渠道",
		Tag:         &tag,
		Priority:    &priority,
		Weight:      &weight,
		CreatedTime: now,
	}).Error)
	require.NoError(t, model.DB.Create(&model.Ability{
		Group:     "GPT 中转渠道",
		Model:     "gpt-5.4",
		ChannelId: 10,
		Enabled:   true,
		Priority:  &priority,
		Weight:    weight,
		Tag:       &tag,
	}).Error)
	records := []model.SupplierStatusSync{
		{
			Provider:     "ikun",
			DisplayName:  "Ikun",
			GroupName:    "Codex Pro",
			MonitorID:    "codex-pro:gpt-5.4",
			ModelName:    "gpt-5.4",
			Status:       1,
			Availability: 100,
			Latency:      900,
			CheckedAt:    now,
			CreatedAt:    now,
		},
	}
	require.NoError(t, model.DB.Create(&records).Error)

	payload, err := BuildPublicUpstreamStatus(context.Background())

	require.NoError(t, err)
	require.Len(t, payload.Data, 1)
	require.Equal(t, "GPT 中转渠道", payload.Data[0].CategoryName)
	require.Equal(t, "GPT 中转渠道", payload.Data[0].Monitors[0].Group)
	require.NotEqual(t, "Codex Pro", payload.Data[0].CategoryName)
}

func TestBuildPublicUpstreamStatusEnsuresMissingTable(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	model.DB = db

	payload, err := BuildPublicUpstreamStatus(context.Background())

	require.NoError(t, err)
	require.True(t, payload.Success)
	require.Empty(t, payload.Data)
	require.True(t, model.DB.Migrator().HasTable(&model.SupplierStatusSync{}))
}
