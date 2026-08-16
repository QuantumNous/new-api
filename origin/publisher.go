package origin

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
)

type EventPublisher interface {
	Publish(context.Context, string, string, []byte) error
}

type OutboxStore interface {
	Claim(worker string, now time.Time, lease time.Duration, limit int) ([]model.OriginUsageOutbox, error)
	MarkPublished(id, worker string, now time.Time) error
	MarkFailed(id, worker, errorCode string, now time.Time, maxAttempts int, retryDelay time.Duration) (bool, error)
}

type GORMOutboxStore struct {
	db *gorm.DB
}

func NewGORMOutboxStore(db *gorm.DB) *GORMOutboxStore {
	return &GORMOutboxStore{db: db}
}

func (store *GORMOutboxStore) Claim(worker string, now time.Time, lease time.Duration, limit int) ([]model.OriginUsageOutbox, error) {
	return model.ClaimOriginUsageOutbox(store.db, worker, now, lease, limit)
}

func (store *GORMOutboxStore) MarkPublished(id, worker string, now time.Time) error {
	return model.MarkOriginUsageOutboxPublished(store.db, id, worker, now)
}

func (store *GORMOutboxStore) MarkFailed(id, worker, errorCode string, now time.Time, maxAttempts int, retryDelay time.Duration) (bool, error) {
	if err := model.MarkOriginUsageOutboxFailure(store.db, id, worker, errorCode, now, maxAttempts, retryDelay); err != nil {
		return false, err
	}
	var row model.OriginUsageOutbox
	if err := store.db.Select("status").Where("id = ?", id).First(&row).Error; err != nil {
		return false, err
	}
	return row.Status == model.OriginOutboxDead, nil
}

type OutboxWorkerConfig struct {
	WorkerID    string
	BatchSize   int
	Lease       time.Duration
	MaxAttempts int
	RetryDelays []time.Duration
}

type OutboxWorker struct {
	store     OutboxStore
	publisher EventPublisher
	config    OutboxWorkerConfig
	now       func() time.Time
	alertDead func(string)
}

func NewOutboxWorker(store OutboxStore, publisher EventPublisher, config OutboxWorkerConfig, now func() time.Time, alertDead func(string)) *OutboxWorker {
	if now == nil {
		now = time.Now
	}
	if config.BatchSize <= 0 {
		config.BatchSize = 100
	}
	if config.Lease <= 0 {
		config.Lease = 30 * time.Second
	}
	if config.MaxAttempts <= 0 {
		config.MaxAttempts = 10
	}
	if len(config.RetryDelays) == 0 {
		config.RetryDelays = []time.Duration{time.Second, 5 * time.Second, 30 * time.Second, 2 * time.Minute, 10 * time.Minute, time.Hour}
	}
	return &OutboxWorker{store: store, publisher: publisher, config: config, now: now, alertDead: alertDead}
}

func (worker *OutboxWorker) DispatchBatch(ctx context.Context) (int, error) {
	if worker.store == nil || worker.publisher == nil || worker.config.WorkerID == "" {
		return 0, errors.New("Origin outbox worker is not configured")
	}
	now := worker.now()
	rows, err := worker.store.Claim(worker.config.WorkerID, now, worker.config.Lease, worker.config.BatchSize)
	if err != nil {
		return 0, fmt.Errorf("claim Origin usage outbox: %w", err)
	}
	published := 0
	var publishErrors []error
	for _, row := range rows {
		if err := worker.publisher.Publish(ctx, row.Topic, row.PartitionKey, []byte(row.Payload)); err != nil {
			delay := worker.retryDelay(row.Attempts)
			dead, markErr := worker.store.MarkFailed(row.ID, worker.config.WorkerID, "publish_failed", worker.now(), worker.config.MaxAttempts, delay)
			if markErr != nil {
				publishErrors = append(publishErrors, fmt.Errorf("persist Origin publish failure: %w", markErr))
			} else {
				publishErrors = append(publishErrors, fmt.Errorf("publish Origin usage event: %w", err))
			}
			if dead && worker.alertDead != nil {
				worker.alertDead(row.ID)
			}
			continue
		}
		if err := worker.store.MarkPublished(row.ID, worker.config.WorkerID, worker.now()); err != nil {
			publishErrors = append(publishErrors, fmt.Errorf("mark Origin usage published: %w", err))
			continue
		}
		published++
	}
	return published, errors.Join(publishErrors...)
}

func (worker *OutboxWorker) retryDelay(attempts int) time.Duration {
	index := attempts - 1
	if index < 0 {
		index = 0
	}
	if index >= len(worker.config.RetryDelays) {
		index = len(worker.config.RetryDelays) - 1
	}
	return worker.config.RetryDelays[index]
}
