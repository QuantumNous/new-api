package handler

import (
	"net/http"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/internal/skill/enums"
	skillmodel "github.com/QuantumNous/new-api/internal/skill/model"
	platformmodel "github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestRecordRunnerSkillUsage_OptedInWritesDownloadedRunnerUsage(t *testing.T) {
	db := testTelemetryDB(t, true)
	SetDB(db)
	payload := `{
		"skill_id":"11111111-1111-1111-1111-111111111111",
		"version":"22222222-2222-2222-2222-222222222222",
		"occurred_at":"2026-06-28T12:00:00Z",
		"success":true,
		"model":"gpt-4o-mini",
		"input_tokens":12,
		"output_tokens":34,
		"total_tokens":46,
		"latency_ms":789
	}`
	c, w := testContextWithMethod(http.MethodPost, "/api/v1/telemetry/skill-usage", payload)
	c.Set("id", 42)
	c.Set("token_id", 7)

	RecordRunnerSkillUsage(c)

	require.Equal(t, http.StatusOK, w.Code)
	var event skillmodel.SkillUsageEvent
	require.NoError(t, db.First(&event).Error)
	require.NotNil(t, event.UserID)
	assert.Equal(t, int64(42), *event.UserID)
	assert.Equal(t, enums.SkillUsageEventTypeUsed, event.EventType)
	assert.Equal(t, enums.EntryPointDownloadedRunner, event.EntryPoint)
	assert.Equal(t, "11111111-1111-1111-1111-111111111111", *event.SkillID)
	assert.Equal(t, "22222222-2222-2222-2222-222222222222", *event.SkillVersionID)
	assert.Equal(t, "gpt-4o-mini", *event.Model)
	assert.Equal(t, 12, *event.InputTokens)
	assert.Equal(t, 34, *event.OutputTokens)
	assert.Equal(t, 46, *event.TotalTokens)
	assert.Equal(t, 789, *event.LatencyMS)
	assert.True(t, *event.Success)
	assert.NotEqual(t, time.Date(2026, 6, 28, 12, 0, 0, 0, time.UTC), event.OccurredAt)
	assert.Contains(t, string(event.Metadata), `"producer":"downloaded_runner"`)
	assert.Contains(t, string(event.Metadata), `"client_occurred_at":"2026-06-28T12:00:00Z"`)

	var quarantineCount int64
	require.NoError(t, db.Model(&skillmodel.SkillTelemetryQuarantine{}).Count(&quarantineCount).Error)
	assert.Equal(t, int64(0), quarantineCount)
}

func TestRecordRunnerSkillUsage_OptOutWritesNothing(t *testing.T) {
	db := testTelemetryDB(t, false)
	SetDB(db)
	c, w := testContextWithMethod(http.MethodPost, "/api/v1/telemetry/skill-usage", `{"skill_id":"s","success":true}`)
	c.Set("id", 42)

	RecordRunnerSkillUsage(c)

	require.Equal(t, http.StatusForbidden, w.Code)
	assertTelemetryCounts(t, db, 0, 0)
}

func TestRecordRunnerSkillUsage_RestrictedRawRejectedWithoutQuarantine(t *testing.T) {
	db := testTelemetryDB(t, true)
	SetDB(db)
	c, w := testContextWithMethod(http.MethodPost, "/api/v1/telemetry/skill-usage", `{
		"skill_id":"11111111-1111-1111-1111-111111111111",
		"success":true,
		"prompt":"do not persist this"
	}`)
	c.Set("id", 42)

	RecordRunnerSkillUsage(c)

	require.Equal(t, http.StatusBadRequest, w.Code)
	assertTelemetryCounts(t, db, 0, 0)
}

func TestRecordRunnerSkillUsage_BadSchemaQuarantined(t *testing.T) {
	db := testTelemetryDB(t, true)
	SetDB(db)
	c, w := testContextWithMethod(http.MethodPost, "/api/v1/telemetry/skill-usage", `{
		"skill_id":"11111111-1111-1111-1111-111111111111",
		"success":"yes",
		"latency_ms":25
	}`)
	c.Set("id", 42)
	c.Set("token_id", 7)

	RecordRunnerSkillUsage(c)

	require.Equal(t, http.StatusAccepted, w.Code)
	assertTelemetryCounts(t, db, 0, 1)
	var q skillmodel.SkillTelemetryQuarantine
	require.NoError(t, db.First(&q).Error)
	assert.Equal(t, int64(42), q.UserID)
	require.NotNil(t, q.TokenID)
	assert.Equal(t, 7, *q.TokenID)
	assert.Equal(t, "invalid_schema", q.Reason)
	assert.Contains(t, string(q.Fields), `"fields"`)
	assert.NotContains(t, string(q.Fields), "yes")
}

func TestRecordRunnerSkillUsage_RevokedConsentBlocksLaterUploads(t *testing.T) {
	db := testTelemetryDB(t, true)
	SetDB(db)
	payload := `{"skill_id":"11111111-1111-1111-1111-111111111111","success":true}`
	first, firstW := testContextWithMethod(http.MethodPost, "/api/v1/telemetry/skill-usage", payload)
	first.Set("id", 42)

	RecordRunnerSkillUsage(first)
	require.Equal(t, http.StatusOK, firstW.Code)

	require.NoError(t, db.Model(&platformmodel.User{}).Where("id = ?", 42).Update("tier2_telemetry_consent", false).Error)
	second, secondW := testContextWithMethod(http.MethodPost, "/api/v1/telemetry/skill-usage", payload)
	second.Set("id", 42)

	RecordRunnerSkillUsage(second)

	require.Equal(t, http.StatusForbidden, secondW.Code)
	assertTelemetryCounts(t, db, 1, 0)
}

func testTelemetryDB(t *testing.T, consent bool) *gorm.DB {
	t.Helper()
	db := testSkillDB(t)
	require.NoError(t, db.AutoMigrate(&platformmodel.User{}))
	now := time.Now().UTC()
	require.NoError(t, db.Create(&platformmodel.User{
		Id:                        42,
		Username:                  "runner-user",
		Password:                  "password123",
		Role:                      common.RoleCommonUser,
		Status:                    common.UserStatusEnabled,
		Group:                     "default",
		Tier2TelemetryConsent:     consent,
		Tier2TelemetryConsentedAt: &now,
	}).Error)
	return db
}

func assertTelemetryCounts(t *testing.T, db *gorm.DB, events, quarantines int64) {
	t.Helper()
	var eventCount int64
	require.NoError(t, db.Model(&skillmodel.SkillUsageEvent{}).Count(&eventCount).Error)
	assert.Equal(t, events, eventCount)
	var quarantineCount int64
	require.NoError(t, db.Model(&skillmodel.SkillTelemetryQuarantine{}).Count(&quarantineCount).Error)
	assert.Equal(t, quarantines, quarantineCount)
}
