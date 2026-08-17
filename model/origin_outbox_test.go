package model

import (
	"fmt"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func setupOriginOutboxTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared&_pragma=busy_timeout(5000)", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&OriginRequestAttempt{}, &OriginUsageOutbox{}))
	return db
}

func originAttemptFixture() OriginRequestAttempt {
	return OriginRequestAttempt{
		ID:              "01980000-0000-7000-8000-000000000101",
		RequestID:       "01980000-0000-7000-8000-000000000002",
		ReservationID:   "01980000-0000-7000-8000-000000000006",
		TenantID:        "01980000-0000-7000-8000-000000000003",
		ProjectID:       "01980000-0000-7000-8000-000000000004",
		APIKeyID:        "01980000-0000-7000-8000-000000000005",
		CatalogVersion:  42,
		RouteID:         "route_codex_responses_primary",
		PlatformModel:   "origin-codex",
		Operation:       "responses",
		UpstreamModelID: "beenex-codex-1",
		ChannelID:       7,
		AttemptNumber:   1,
		Status:          OriginAttemptInProgress,
		ContactState:    OriginContactNotContacted,
		StartedAt:       time.Date(2026, 8, 14, 5, 5, 0, 0, time.UTC),
	}
}

func originOutboxFixture(id, attemptID string) OriginUsageOutbox {
	return OriginUsageOutbox{
		ID:            id,
		AttemptID:     attemptID,
		RequestID:     "01980000-0000-7000-8000-000000000002",
		ReservationID: "01980000-0000-7000-8000-000000000006",
		Topic:         "metering.usage-recorded.v2",
		PartitionKey:  "reservation:01980000-0000-7000-8000-000000000006",
		Payload:       `{"event_type":"metering.usage_recorded.v2"}`,
		Status:        OriginOutboxPending,
	}
}

func TestFinalizeOriginAttemptAndOutboxAreOneTransaction(t *testing.T) {
	db := setupOriginOutboxTestDB(t)
	attempt := originAttemptFixture()
	require.NoError(t, CreateOriginRequestAttempt(db, &attempt))

	completedAt := time.Date(2026, 8, 14, 5, 5, 2, 0, time.UTC)
	outbox := originOutboxFixture("01980000-0000-7000-8000-000000000201", attempt.ID)
	require.NoError(t, FinalizeOriginRequestAttempt(db, attempt.ID, OriginAttemptSucceeded, OriginContactCompleted, completedAt, &outbox))

	var storedAttempt OriginRequestAttempt
	require.NoError(t, db.First(&storedAttempt, "id = ?", attempt.ID).Error)
	assert.Equal(t, OriginAttemptSucceeded, storedAttempt.Status)
	assert.Equal(t, OriginContactCompleted, storedAttempt.ContactState)
	require.NotNil(t, storedAttempt.CompletedAt)

	var storedOutbox OriginUsageOutbox
	require.NoError(t, db.First(&storedOutbox, "id = ?", outbox.ID).Error)
	assert.Equal(t, OriginOutboxPending, storedOutbox.Status)
}

func TestOriginAttemptMigrationBackfillsLegacyRowsAsResponses(t *testing.T) {
	db := setupOriginOutboxTestDB(t)
	attempt := originAttemptFixture()
	require.NoError(t, CreateOriginRequestAttempt(db, &attempt))
	require.NoError(t, db.Migrator().DropColumn(&OriginRequestAttempt{}, "Operation"))
	require.False(t, db.Migrator().HasColumn(&OriginRequestAttempt{}, "Operation"))

	require.NoError(t, db.AutoMigrate(&OriginRequestAttempt{}))

	var stored OriginRequestAttempt
	require.NoError(t, db.First(&stored, "id = ?", attempt.ID).Error)
	assert.Equal(t, "responses", stored.Operation)
}

func TestFinalizeOriginAttemptRollsBackWhenOutboxInsertFails(t *testing.T) {
	db := setupOriginOutboxTestDB(t)
	attempt := originAttemptFixture()
	require.NoError(t, CreateOriginRequestAttempt(db, &attempt))
	outbox := originOutboxFixture("01980000-0000-7000-8000-000000000201", "different-attempt")
	require.NoError(t, db.Create(&outbox).Error)

	duplicate := originOutboxFixture(outbox.ID, attempt.ID)
	err := FinalizeOriginRequestAttempt(db, attempt.ID, OriginAttemptSucceeded, OriginContactCompleted, time.Now(), &duplicate)
	require.Error(t, err)

	var stored OriginRequestAttempt
	require.NoError(t, db.First(&stored, "id = ?", attempt.ID).Error)
	assert.Equal(t, OriginAttemptInProgress, stored.Status)
	assert.Nil(t, stored.CompletedAt)
}

func TestOriginOutboxConcurrentClaimAndCrashRecovery(t *testing.T) {
	db := setupOriginOutboxTestDB(t)
	now := time.Date(2026, 8, 14, 5, 5, 0, 0, time.UTC)
	for index := 0; index < 8; index++ {
		row := originOutboxFixture(fmt.Sprintf("01980000-0000-7000-8000-%012d", 300+index), fmt.Sprintf("01980000-0000-7000-8000-%012d", 100+index))
		require.NoError(t, db.Create(&row).Error)
	}

	claimedIDs := make(chan string, 8)
	errorsSeen := make(chan error, 2)
	var wait sync.WaitGroup
	for _, worker := range []string{"worker-a", "worker-b"} {
		wait.Add(1)
		go func(worker string) {
			defer wait.Done()
			rows, err := ClaimOriginUsageOutbox(db, worker, now, 30*time.Second, 4)
			if err != nil {
				errorsSeen <- err
				return
			}
			for _, row := range rows {
				claimedIDs <- row.ID
			}
		}(worker)
	}
	wait.Wait()
	close(errorsSeen)
	close(claimedIDs)
	for err := range errorsSeen {
		require.NoError(t, err)
	}
	unique := map[string]bool{}
	for id := range claimedIDs {
		assert.False(t, unique[id], "outbox row claimed twice")
		unique[id] = true
	}
	assert.Len(t, unique, 8)

	recovered, err := ClaimOriginUsageOutbox(db, "worker-c", now.Add(31*time.Second), 30*time.Second, 8)
	require.NoError(t, err)
	assert.Len(t, recovered, 8)
}

func TestOriginOutboxFailureDeadAndRecovery(t *testing.T) {
	db := setupOriginOutboxTestDB(t)
	now := time.Date(2026, 8, 14, 5, 5, 0, 0, time.UTC)
	row := originOutboxFixture("01980000-0000-7000-8000-000000000301", "01980000-0000-7000-8000-000000000101")
	require.NoError(t, db.Create(&row).Error)

	for attempt := 1; attempt <= 3; attempt++ {
		claimed, err := ClaimOriginUsageOutbox(db, "worker-a", now.Add(time.Duration(attempt)*time.Minute), 30*time.Second, 1)
		require.NoError(t, err)
		require.Len(t, claimed, 1)
		require.NoError(t, MarkOriginUsageOutboxFailure(db, claimed[0].ID, "worker-a", "kafka_unavailable", now.Add(time.Duration(attempt)*time.Minute), 3, 0))
	}

	var dead OriginUsageOutbox
	require.NoError(t, db.First(&dead, "id = ?", row.ID).Error)
	assert.Equal(t, OriginOutboxDead, dead.Status)
	assert.Equal(t, "kafka_unavailable", dead.LastErrorCode)

	require.NoError(t, RecoverDeadOriginUsageOutbox(db, row.ID, now.Add(10*time.Minute)))
	claimed, err := ClaimOriginUsageOutbox(db, "worker-b", now.Add(10*time.Minute), 30*time.Second, 1)
	require.NoError(t, err)
	require.Len(t, claimed, 1)
	assert.Equal(t, row.ID, claimed[0].ID)
}

func TestMarkOriginUsageOutboxPublishedIsIdempotent(t *testing.T) {
	db := setupOriginOutboxTestDB(t)
	now := time.Date(2026, 8, 14, 5, 5, 0, 0, time.UTC)
	row := originOutboxFixture("01980000-0000-7000-8000-000000000301", "01980000-0000-7000-8000-000000000101")
	require.NoError(t, db.Create(&row).Error)
	claimed, err := ClaimOriginUsageOutbox(db, "worker-a", now, 30*time.Second, 1)
	require.NoError(t, err)
	require.Len(t, claimed, 1)

	require.NoError(t, MarkOriginUsageOutboxPublished(db, row.ID, "worker-a", now.Add(time.Second)))
	require.NoError(t, MarkOriginUsageOutboxPublished(db, row.ID, "worker-a", now.Add(2*time.Second)))

	var stored OriginUsageOutbox
	require.NoError(t, db.First(&stored, "id = ?", row.ID).Error)
	assert.Equal(t, OriginOutboxSent, stored.Status)
	require.NotNil(t, stored.SentAt)
}

func TestOriginAttemptLeaseHeartbeatOnlyExtendsOwnedInProgressAttempt(t *testing.T) {
	db := setupOriginOutboxTestDB(t)
	now := time.Date(2026, 8, 14, 5, 5, 0, 0, time.UTC)
	attempt := originAttemptFixture()
	attempt.LeaseOwner = "instance-a"
	attempt.LeaseUntil = common.GetPointer(now.Add(time.Minute))
	require.NoError(t, db.Create(&attempt).Error)

	require.NoError(t, ExtendOriginRequestAttemptLease(db, attempt.ID, "instance-a", now.Add(2*time.Minute)))
	err := ExtendOriginRequestAttemptLease(db, attempt.ID, "instance-b", now.Add(3*time.Minute))
	require.Error(t, err)

	var stored OriginRequestAttempt
	require.NoError(t, db.First(&stored, "id = ?", attempt.ID).Error)
	require.NotNil(t, stored.LeaseUntil)
	assert.Equal(t, now.Add(2*time.Minute), stored.LeaseUntil.UTC())
}

func TestOriginPersistenceConfiguredDatabases(t *testing.T) {
	tests := []struct {
		name         string
		env          string
		databaseType common.DatabaseType
		dialector    func(string) gorm.Dialector
	}{
		{name: "mysql", env: "TEST_MYSQL_DSN", databaseType: common.DatabaseTypeMySQL, dialector: func(dsn string) gorm.Dialector { return mysql.Open(dsn) }},
		{name: "postgres", env: "TEST_POSTGRES_DSN", databaseType: common.DatabaseTypePostgreSQL, dialector: func(dsn string) gorm.Dialector {
			return postgres.New(postgres.Config{DSN: dsn, PreferSimpleProtocol: true})
		}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			dsn := strings.TrimSpace(os.Getenv(test.env))
			if dsn == "" {
				t.Skip(test.env + " is not configured")
			}
			common.SetDatabaseTypes(test.databaseType, test.databaseType)
			t.Cleanup(func() { common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite) })
			db, err := gorm.Open(test.dialector(dsn), &gorm.Config{})
			require.NoError(t, err)
			sqlDB, err := db.DB()
			require.NoError(t, err)
			t.Cleanup(func() { _ = sqlDB.Close() })
			require.NoError(t, db.AutoMigrate(&OriginRequestAttempt{}, &OriginUsageOutbox{}))

			attempt := originAttemptFixture()
			attempt.ID = uuid.NewString()
			attempt.RequestID = uuid.NewString()
			attempt.ReservationID = uuid.NewString()
			attempt.TenantID = uuid.NewString()
			attempt.ProjectID = uuid.NewString()
			attempt.APIKeyID = uuid.NewString()
			attempt.LeaseOwner = "dialect-test"
			attempt.LeaseUntil = common.GetPointer(time.Now().UTC().Add(time.Minute))
			t.Cleanup(func() {
				_ = db.Where("request_id = ?", attempt.RequestID).Delete(&OriginUsageOutbox{}).Error
				_ = db.Where("request_id = ?", attempt.RequestID).Delete(&OriginRequestAttempt{}).Error
			})
			require.NoError(t, CreateOriginRequestAttempt(db, &attempt))

			outbox := originOutboxFixture(uuid.NewString(), attempt.ID)
			outbox.RequestID = attempt.RequestID
			outbox.ReservationID = attempt.ReservationID
			outbox.PartitionKey = "reservation:" + attempt.ReservationID
			now := time.Now().UTC()
			require.NoError(t, FinalizeOriginRequestAttempt(db, attempt.ID, OriginAttemptSucceeded, OriginContactCompleted, now, &outbox))
			claimed, err := ClaimOriginUsageOutbox(db, "dialect-worker", now.Add(time.Second), time.Minute, 1)
			require.NoError(t, err)
			require.Len(t, claimed, 1)
			require.NoError(t, MarkOriginUsageOutboxPublished(db, outbox.ID, "dialect-worker", now.Add(2*time.Second)))
		})
	}
}
