package origin

import (
	"context"
	"errors"
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

type recordingEventPublisher struct {
	fail     bool
	payloads [][]byte
}

func (publisher *recordingEventPublisher) Publish(_ context.Context, _ string, _ string, payload []byte) error {
	publisher.payloads = append(publisher.payloads, append([]byte(nil), payload...))
	if publisher.fail {
		return errors.New("Kafka unavailable at broker.example:9092")
	}
	return nil
}

type failMarkPublishedOnceStore struct {
	*GORMOutboxStore
	failed bool
}

func (store *failMarkPublishedOnceStore) MarkPublished(id, worker string, now time.Time) error {
	if !store.failed {
		store.failed = true
		return errors.New("simulated process crash before SENT persistence")
	}
	return store.GORMOutboxStore.MarkPublished(id, worker, now)
}

func setupPublisherTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared&_pragma=busy_timeout(5000)", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.OriginUsageOutbox{}))
	return db
}

func insertPublisherOutbox(t *testing.T, db *gorm.DB) model.OriginUsageOutbox {
	t.Helper()
	row := model.OriginUsageOutbox{
		ID:            "01980000-0000-7000-8000-000000000401",
		AttemptID:     "01980000-0000-7000-8000-000000000101",
		RequestID:     "01980000-0000-7000-8000-000000000002",
		ReservationID: "01980000-0000-7000-8000-000000000006",
		Topic:         "metering.usage-recorded.v2",
		PartitionKey:  "reservation:01980000-0000-7000-8000-000000000006",
		Payload:       `{"event_id":"01980000-0000-7000-8000-000000000401"}`,
		Status:        model.OriginOutboxPending,
	}
	require.NoError(t, db.Create(&row).Error)
	return row
}

func TestOutboxWorkerKeepsUsageWhenKafkaIsUnavailableThenPublishesAfterRecovery(t *testing.T) {
	db := setupPublisherTestDB(t)
	row := insertPublisherOutbox(t, db)
	now := time.Date(2026, 8, 14, 5, 5, 0, 0, time.UTC)
	clock := func() time.Time { return now }
	publisher := &recordingEventPublisher{fail: true}
	worker := NewOutboxWorker(NewGORMOutboxStore(db), publisher, OutboxWorkerConfig{
		WorkerID:    "worker-a",
		BatchSize:   10,
		Lease:       30 * time.Second,
		MaxAttempts: 5,
	}, clock, nil)

	_, err := worker.DispatchBatch(context.Background())
	require.Error(t, err)
	var failed model.OriginUsageOutbox
	require.NoError(t, db.First(&failed, "id = ?", row.ID).Error)
	assert.Equal(t, model.OriginOutboxFailed, failed.Status)
	assert.Equal(t, "publish_failed", failed.LastErrorCode)
	assert.NotContains(t, failed.LastErrorCode, "broker.example")

	publisher.fail = false
	now = now.Add(time.Minute)
	published, err := worker.DispatchBatch(context.Background())
	require.NoError(t, err)
	assert.Equal(t, 1, published)
	var sent model.OriginUsageOutbox
	require.NoError(t, db.First(&sent, "id = ?", row.ID).Error)
	assert.Equal(t, model.OriginOutboxSent, sent.Status)
	require.Len(t, publisher.payloads, 2)
	assert.Equal(t, publisher.payloads[0], publisher.payloads[1])
}

func TestOutboxWorkerMovesExhaustedUsageToDeadAndAlerts(t *testing.T) {
	db := setupPublisherTestDB(t)
	insertPublisherOutbox(t, db)
	now := time.Date(2026, 8, 14, 5, 5, 0, 0, time.UTC)
	alerts := make([]string, 0, 1)
	worker := NewOutboxWorker(NewGORMOutboxStore(db), &recordingEventPublisher{fail: true}, OutboxWorkerConfig{
		WorkerID:    "worker-a",
		BatchSize:   10,
		Lease:       30 * time.Second,
		MaxAttempts: 1,
	}, func() time.Time { return now }, func(eventID string) {
		alerts = append(alerts, eventID)
	})

	_, err := worker.DispatchBatch(context.Background())
	require.Error(t, err)
	var dead model.OriginUsageOutbox
	require.NoError(t, db.First(&dead).Error)
	assert.Equal(t, model.OriginOutboxDead, dead.Status)
	assert.Equal(t, []string{dead.ID}, alerts)
}

func TestOutboxWorkerCrashAfterPublishReplaysStableEventAfterLeaseExpiry(t *testing.T) {
	db := setupPublisherTestDB(t)
	row := insertPublisherOutbox(t, db)
	now := time.Date(2026, 8, 14, 5, 5, 0, 0, time.UTC)
	publisher := &recordingEventPublisher{}
	store := &failMarkPublishedOnceStore{GORMOutboxStore: NewGORMOutboxStore(db)}
	firstWorker := NewOutboxWorker(store, publisher, OutboxWorkerConfig{
		WorkerID:  "worker-before-crash",
		BatchSize: 1,
		Lease:     30 * time.Second,
	}, func() time.Time { return now }, nil)

	published, err := firstWorker.DispatchBatch(context.Background())
	require.Error(t, err)
	assert.Zero(t, published)
	require.Len(t, publisher.payloads, 1)
	var leased model.OriginUsageOutbox
	require.NoError(t, db.First(&leased, "id = ?", row.ID).Error)
	assert.Equal(t, model.OriginOutboxSending, leased.Status)

	now = now.Add(31 * time.Second)
	secondWorker := NewOutboxWorker(NewGORMOutboxStore(db), publisher, OutboxWorkerConfig{
		WorkerID:  "worker-after-restart",
		BatchSize: 1,
		Lease:     30 * time.Second,
	}, func() time.Time { return now }, nil)
	published, err = secondWorker.DispatchBatch(context.Background())

	require.NoError(t, err)
	assert.Equal(t, 1, published)
	require.Len(t, publisher.payloads, 2)
	assert.Equal(t, publisher.payloads[0], publisher.payloads[1])
	assert.Contains(t, string(publisher.payloads[1]), row.ID)
	var sent model.OriginUsageOutbox
	require.NoError(t, db.First(&sent, "id = ?", row.ID).Error)
	assert.Equal(t, model.OriginOutboxSent, sent.Status)
}
