package origin

import (
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupRecoveryTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared&_pragma=busy_timeout(5000)", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.OriginRequestAttempt{}, &model.OriginUsageOutbox{}))
	return db
}

func TestRecoverStaleAttemptsCreatesReconciliationOutboxAtomically(t *testing.T) {
	db := setupRecoveryTestDB(t)
	now := time.Date(2026, 8, 14, 5, 10, 0, 0, time.UTC)
	attempt := model.OriginRequestAttempt{
		ID:              "01980000-0000-7000-8000-000000000101",
		RequestID:       "01980000-0000-7000-8000-000000000002",
		ReservationID:   "01980000-0000-7000-8000-000000000006",
		TenantID:        "01980000-0000-7000-8000-000000000003",
		ProjectID:       "01980000-0000-7000-8000-000000000004",
		APIKeyID:        "01980000-0000-7000-8000-000000000005",
		CatalogVersion:  42,
		RouteID:         "route_codex_responses_primary",
		PlatformModel:   "origin-codex",
		UpstreamModelID: "beenex-codex-1",
		ChannelID:       7,
		AttemptNumber:   1,
		Status:          model.OriginAttemptInProgress,
		ContactState:    model.OriginContactNotContacted,
		StartedAt:       now.Add(-10 * time.Minute),
		LeaseOwner:      "dead-instance",
		LeaseUntil:      common.GetPointer(now.Add(-time.Minute)),
	}
	require.NoError(t, db.Create(&attempt).Error)

	recovered, err := RecoverStaleAttempts(db, now, now, 10)

	require.NoError(t, err)
	assert.Equal(t, 1, recovered)
	var storedAttempt model.OriginRequestAttempt
	require.NoError(t, db.First(&storedAttempt, "id = ?", attempt.ID).Error)
	assert.Equal(t, model.OriginAttemptReconciliation, storedAttempt.Status)
	assert.Equal(t, model.OriginContactUnknown, storedAttempt.ContactState)

	var outbox model.OriginUsageOutbox
	require.NoError(t, db.First(&outbox, "attempt_id = ?", attempt.ID).Error)
	assert.Equal(t, model.OriginOutboxPending, outbox.Status)
	var event MeteringUsageRecordedV2
	require.NoError(t, common.Unmarshal([]byte(outbox.Payload), &event))
	assert.Equal(t, "RECONCILE", event.ReservationAction)
	assert.Equal(t, "MISSING", event.UsageStatus)
	assert.Equal(t, "UPSTREAM_OUTCOME_UNKNOWN", *event.Reconciliation.Reason)
	assert.Equal(t, "process_interrupted", *event.ErrorCategory)

	recovered, err = RecoverStaleAttempts(db, now.Add(time.Second), now.Add(time.Second), 10)
	require.NoError(t, err)
	assert.Zero(t, recovered)
	var count int64
	require.NoError(t, db.Model(&model.OriginUsageOutbox{}).Where("attempt_id = ?", attempt.ID).Count(&count).Error)
	assert.Equal(t, int64(1), count)
}

func TestRecoverStaleAttemptsLeavesActiveAttemptAlone(t *testing.T) {
	db := setupRecoveryTestDB(t)
	now := time.Date(2026, 8, 14, 5, 10, 0, 0, time.UTC)
	attempt := model.OriginRequestAttempt{
		ID: "01980000-0000-7000-8000-000000000101", RequestID: "01980000-0000-7000-8000-000000000002",
		ReservationID: "01980000-0000-7000-8000-000000000006", TenantID: "01980000-0000-7000-8000-000000000003",
		ProjectID: "01980000-0000-7000-8000-000000000004", APIKeyID: "01980000-0000-7000-8000-000000000005",
		CatalogVersion: 42, RouteID: "route_codex_responses_primary", PlatformModel: "origin-codex",
		UpstreamModelID: "beenex-codex-1", ChannelID: 7, AttemptNumber: 1,
		Status: model.OriginAttemptInProgress, ContactState: model.OriginContactNotContacted, StartedAt: now,
		LeaseOwner: "live-instance", LeaseUntil: common.GetPointer(now.Add(time.Minute)),
	}
	require.NoError(t, db.Create(&attempt).Error)

	recovered, err := RecoverStaleAttempts(db, now, now, 10)

	require.NoError(t, err)
	assert.Zero(t, recovered)
}

func TestRecoverStaleStreamingAttemptRetainsResponsesStreamOperation(t *testing.T) {
	db := setupRecoveryTestDB(t)
	now := time.Date(2026, 8, 14, 5, 10, 0, 0, time.UTC)
	attempt := usageAttemptFixture()
	attempt.Status = model.OriginAttemptInProgress
	attempt.ContactState = model.OriginContactContacted
	attempt.AttemptNumber = 1
	attempt.Stream = true
	attempt.LeaseOwner = "crashed-worker"
	attempt.LeaseUntil = common.GetPointer(now.Add(-time.Minute))
	require.NoError(t, db.Create(&attempt).Error)

	recovered, err := RecoverStaleAttempts(db, now, now, 10)

	require.NoError(t, err)
	assert.Equal(t, 1, recovered)
	var outbox model.OriginUsageOutbox
	require.NoError(t, db.Where("attempt_id = ?", attempt.ID).First(&outbox).Error)
	var event MeteringUsageRecordedV2
	require.NoError(t, common.Unmarshal([]byte(outbox.Payload), &event))
	assert.Equal(t, "responses_stream", event.Operation)
}
