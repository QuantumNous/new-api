package controller

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/glebarez/sqlite"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestMain(m *testing.M) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		panic("failed to open test db: " + err.Error())
	}
	sqlDB, err := db.DB()
	if err != nil {
		panic("failed to get sql.DB: " + err.Error())
	}
	sqlDB.SetMaxOpenConns(1)

	model.DB = db
	model.LOG_DB = db

	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	common.RedisEnabled = false
	common.BatchUpdateEnabled = false
	common.LogConsumeEnabled = true

	if err := db.AutoMigrate(
		&model.Log{},
		&model.Channel{},
		&model.PerfMetric{},
	); err != nil {
		panic("failed to migrate: " + err.Error())
	}

	os.Exit(m.Run())
}

// TestGetChannelPerfMetrics_HappyPath validates channel aggregate with nested model details.
func TestGetChannelPerfMetrics_HappyPath(t *testing.T) {
	db := setupTestDB(t)
	fixture := seedChannelFixture(t, db)
	defer fixture.cleanup()

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/api/perf-metrics/channels", GetChannelPerfMetrics)

	// Query last 24 hours (fixture logs are timestamped at test time)
	req := httptest.NewRequest(http.MethodGet, "/api/perf-metrics/channels?hours=24", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)

	var resp map[string]interface{}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	require.True(t, resp["success"].(bool))

	data := resp["data"].(map[string]interface{})
	channels := data["channels"].([]interface{})
	require.Len(t, channels, 2)

	// Channel 5: 14 requests, 13 successes = 92.857%
	ch5 := channels[0].(map[string]interface{})
	assert.Equal(t, float64(5), ch5["channel_id"])
	assert.Equal(t, float64(14), ch5["request_count"])
	assert.Equal(t, float64(13), ch5["success_count"])
	require.NotNil(t, ch5["success_rate"])
	assert.InDelta(t, 92.857, ch5["success_rate"].(float64), 0.01)

	// Nested models for channel 5
	ch5Models := ch5["models"].([]interface{})
	require.Len(t, ch5Models, 2)

	// claude-3-5-sonnet: 4 requests, 4 successes = 100%
	claude := findModelByName(t, ch5Models, "claude-3-5-sonnet")
	assert.Equal(t, float64(4), claude["request_count"])
	assert.Equal(t, float64(4), claude["success_count"])
	assert.InDelta(t, 100.0, claude["success_rate"].(float64), 0.01)

	// gpt-4: 10 requests, 9 successes = 90%
	gpt4Ch5 := findModelByName(t, ch5Models, "gpt-4")
	assert.Equal(t, float64(10), gpt4Ch5["request_count"])
	assert.Equal(t, float64(9), gpt4Ch5["success_count"])
	assert.InDelta(t, 90.0, gpt4Ch5["success_rate"].(float64), 0.01)

	// Channel 6: 2 requests, 1 success = 50%
	ch6 := channels[1].(map[string]interface{})
	assert.Equal(t, float64(6), ch6["channel_id"])
	assert.Equal(t, float64(2), ch6["request_count"])
	assert.Equal(t, float64(1), ch6["success_count"])
	assert.InDelta(t, 50.0, ch6["success_rate"].(float64), 0.01)

	ch6Models := ch6["models"].([]interface{})
	require.Len(t, ch6Models, 1)
	gpt4Ch6 := ch6Models[0].(map[string]interface{})
	assert.Equal(t, "gpt-4", gpt4Ch6["model_name"])
	assert.Equal(t, float64(2), gpt4Ch6["request_count"])
	assert.Equal(t, float64(1), gpt4Ch6["success_count"])
	assert.InDelta(t, 50.0, gpt4Ch6["success_rate"].(float64), 0.01)
}

// TestGetChannelModelPerfMetrics_HappyPath validates channel/model detail endpoint.
func TestGetChannelModelPerfMetrics_HappyPath(t *testing.T) {
	db := setupTestDB(t)
	fixture := seedChannelFixture(t, db)
	defer fixture.cleanup()

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/api/perf-metrics/channels/:channel_id/models/:model_name", GetChannelModelPerfMetrics)

	// Channel 6 + gpt-4: 2 requests, 1 success = 50%
	req := httptest.NewRequest(http.MethodGet, "/api/perf-metrics/channels/6/models/gpt-4?hours=24", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)

	var resp map[string]interface{}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	require.True(t, resp["success"].(bool))

	data := resp["data"].(map[string]interface{})
	assert.Equal(t, float64(6), data["channel_id"])
	assert.Equal(t, "gpt-4", data["model_name"])
	assert.Equal(t, float64(2), data["request_count"])
	assert.Equal(t, float64(1), data["success_count"])
	assert.InDelta(t, 50.0, data["success_rate"].(float64), 0.01)
}

// TestGetChannelModelPerfMetrics_NoData validates no-data case returns JSON null rate.
func TestGetChannelModelPerfMetrics_NoData(t *testing.T) {
	db := setupTestDB(t)
	fixture := seedChannelFixture(t, db)
	defer fixture.cleanup()

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/api/perf-metrics/channels/:channel_id/models/:model_name", GetChannelModelPerfMetrics)

	// Unknown channel/model combination
	req := httptest.NewRequest(http.MethodGet, "/api/perf-metrics/channels/999/models/unknown-model?hours=24", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)

	var resp map[string]interface{}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	require.True(t, resp["success"].(bool))

	data := resp["data"].(map[string]interface{})
	assert.Equal(t, float64(999), data["channel_id"])
	assert.Equal(t, "unknown-model", data["model_name"])
	assert.Equal(t, float64(0), data["request_count"])
	assert.Equal(t, float64(0), data["success_count"])
	assert.Nil(t, data["success_rate"])
}

// TestGetChannelModelPerfMetrics_InvalidChannelID validates 400 for malformed channel_id.
func TestGetChannelModelPerfMetrics_InvalidChannelID(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/api/perf-metrics/channels/:channel_id/models/:model_name", GetChannelModelPerfMetrics)

	tests := []struct {
		name      string
		channelID string
	}{
		{"non-numeric", "abc"},
		{"negative", "-5"},
		{"zero", "0"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/perf-metrics/channels/%s/models/gpt-4", tt.channelID), nil)
			rec := httptest.NewRecorder()
			router.ServeHTTP(rec, req)

			require.Equal(t, http.StatusBadRequest, rec.Code)

			var resp map[string]interface{}
			require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
			assert.False(t, resp["success"].(bool))
			assert.Contains(t, resp["message"].(string), "invalid channel_id")
		})
	}
}

// TestGetChannelPerfMetrics_GroupFilter validates group query parameter filtering.
func TestGetChannelPerfMetrics_GroupFilter(t *testing.T) {
	t.Skip("group filter requires model package internal initialization (commonGroupCol)")
}

// TestGetChannelPerfMetrics_HoursFilter validates time window filtering.
func TestGetChannelPerfMetrics_HoursFilter(t *testing.T) {
	db := setupTestDB(t)
	fixture := seedChannelFixture(t, db)
	defer fixture.cleanup()

	// Add old metric outside time window (48 hours ago)
	oldBucketTs := time.Now().Add(-48 * time.Hour).Unix()
	oldBucketTs = oldBucketTs - (oldBucketTs % 300)
	ch5ID := 5
	oldMetric := &model.PerfMetric{
		ModelName:    "gpt-4",
		ChannelId:    &ch5ID,
		Group:        "default",
		BucketTs:     oldBucketTs,
		RequestCount: 1,
		SuccessCount: 1,
	}
	require.NoError(t, db.Create(oldMetric).Error)
	defer db.Delete(oldMetric)

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/api/perf-metrics/channels", GetChannelPerfMetrics)

	// Query last 24 hours (should not include 48-hour-old log)
	req := httptest.NewRequest(http.MethodGet, "/api/perf-metrics/channels?hours=24", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)

	var resp map[string]interface{}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	require.True(t, resp["success"].(bool))

	data := resp["data"].(map[string]interface{})
	channels := data["channels"].([]interface{})
	ch5 := channels[0].(map[string]interface{})

	// Should still be 14 requests (old log excluded)
	assert.Equal(t, float64(14), ch5["request_count"])
}

// setupTestDB creates an in-memory SQLite database for testing.
func setupTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db := model.DB
	if db == nil {
		t.Fatal("model.DB not initialized; ensure test package has TestMain")
	}

	t.Cleanup(func() {
		db.Exec("DELETE FROM channels WHERE id IN (5, 6, 7)")
		db.Exec("DELETE FROM perf_metrics WHERE channel_id IN (5, 6, 7)")
	})

	return db
}

// channelFixture wraps seeded test data with cleanup.
type channelFixture struct {
	db      *gorm.DB
	cleanup func()
}

// seedChannelFixture creates deterministic channel and perf_metrics data.
func seedChannelFixture(t *testing.T, db *gorm.DB) *channelFixture {
	t.Helper()

	now := time.Now().Unix()
	bucketTs := now - (now % 300) // Round to 5-minute bucket

	// Channel 5: 14 total (10 gpt-4 + 4 claude-3), 13 successes
	ch5 := &model.Channel{
		Id:          5,
		Name:        "gpt-4-channel",
		Type:        1,
		Status:      common.ChannelStatusEnabled,
		Key:         "test-key-5",
		Models:      "gpt-4,claude-3-5-sonnet",
		Group:       "default",
		CreatedTime: now,
		TestTime:    now,
	}
	require.NoError(t, db.Create(ch5).Error)

	// Channel 6: 2 total (gpt-4), 1 success
	ch6 := &model.Channel{
		Id:          6,
		Name:        "gpt-4-channel-fallback",
		Type:        1,
		Status:      common.ChannelStatusEnabled,
		Key:         "test-key-6",
		Models:      "gpt-4",
		Group:       "default",
		CreatedTime: now,
		TestTime:    now,
	}
	require.NoError(t, db.Create(ch6).Error)

	// Seed perf_metrics for channel 5, gpt-4: 10 requests, 9 successes
	ch5ID := 5
	metric1 := &model.PerfMetric{
		ModelName:    "gpt-4",
		ChannelId:    &ch5ID,
		Group:        "default",
		BucketTs:     bucketTs,
		RequestCount: 10,
		SuccessCount: 9,
	}
	require.NoError(t, db.Create(metric1).Error)

	// Seed perf_metrics for channel 5, claude-3-5-sonnet: 4 requests, 4 successes
	metric2 := &model.PerfMetric{
		ModelName:    "claude-3-5-sonnet",
		ChannelId:    &ch5ID,
		Group:        "default",
		BucketTs:     bucketTs,
		RequestCount: 4,
		SuccessCount: 4,
	}
	require.NoError(t, db.Create(metric2).Error)

	// Seed perf_metrics for channel 6, gpt-4: 2 requests, 1 success
	ch6ID := 6
	metric3 := &model.PerfMetric{
		ModelName:    "gpt-4",
		ChannelId:    &ch6ID,
		Group:        "default",
		BucketTs:     bucketTs,
		RequestCount: 2,
		SuccessCount: 1,
	}
	require.NoError(t, db.Create(metric3).Error)

	return &channelFixture{
		db: db,
		cleanup: func() {
			db.Exec("DELETE FROM channels WHERE id IN (5, 6)")
			db.Exec("DELETE FROM perf_metrics WHERE channel_id IN (5, 6)")
		},
	}
}

// findModelByName searches for a model by name in the models slice.
func findModelByName(t *testing.T, models []interface{}, name string) map[string]interface{} {
	t.Helper()
	for _, m := range models {
		model := m.(map[string]interface{})
		if model["model_name"] == name {
			return model
		}
	}
	t.Fatalf("model %s not found", name)
	return nil
}
