package origin

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
)

type BackgroundWorkers struct {
	cancel    context.CancelFunc
	done      chan struct{}
	publisher *KafkaPublisher
	closeOnce sync.Once
}

func StartBackgroundWorkers(parent context.Context, db *gorm.DB) (*BackgroundWorkers, error) {
	runtime := activeRuntime.Load()
	if runtime == nil || !runtime.Enabled {
		return &BackgroundWorkers{}, nil
	}
	if db == nil || runtime.WorkerID == "" || runtime.OutboxPoll <= 0 || runtime.AttemptLease <= 0 {
		return nil, errors.New("Origin background workers are not configured")
	}
	publisher, err := NewKafkaPublisher(runtime.KafkaBrokers)
	if err != nil {
		return nil, err
	}
	now := timeNow().UTC()
	if _, err := RecoverStaleAttempts(db, now, now, runtime.Outbox.BatchSize); err != nil {
		_ = publisher.Close()
		return nil, fmt.Errorf("recover interrupted Origin attempts: %w", err)
	}
	ctx, cancel := context.WithCancel(parent)
	workers := &BackgroundWorkers{cancel: cancel, done: make(chan struct{}), publisher: publisher}
	outbox := NewOutboxWorker(NewGORMOutboxStore(db), publisher, runtime.Outbox, timeNow, func(eventID string) {
		common.SysError("Origin usage outbox entered DEAD state: event_id=" + eventID)
	})
	go func() {
		defer close(workers.done)
		ticker := time.NewTicker(runtime.OutboxPoll)
		defer ticker.Stop()
		for {
			now := timeNow().UTC()
			if _, err := RecoverStaleAttempts(db, now, now, runtime.Outbox.BatchSize); err != nil {
				common.SysError("failed to recover interrupted Origin attempts: " + err.Error())
			}
			if _, err := outbox.DispatchBatch(ctx); err != nil && ctx.Err() == nil {
				common.SysError("Origin usage outbox dispatch failed")
			}
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
			}
		}
	}()
	return workers, nil
}

func (workers *BackgroundWorkers) Close() error {
	if workers == nil {
		return nil
	}
	var closeErr error
	workers.closeOnce.Do(func() {
		if workers.cancel != nil {
			workers.cancel()
		}
		if workers.done != nil {
			<-workers.done
		}
		if workers.publisher != nil {
			closeErr = workers.publisher.Close()
		}
	})
	return closeErr
}

func RequestAttemptLease(now time.Time) (string, *time.Time) {
	runtime := activeRuntime.Load()
	if runtime == nil || !runtime.Enabled || runtime.WorkerID == "" || runtime.AttemptLease <= 0 {
		return "", nil
	}
	leaseUntil := now.UTC().Add(runtime.AttemptLease)
	return runtime.WorkerID, &leaseUntil
}

func MaintainRequestAttemptLease(ctx context.Context, db *gorm.DB, attemptID string, cancelUpstream context.CancelFunc) func() error {
	runtime := activeRuntime.Load()
	if runtime == nil || !runtime.Enabled || runtime.WorkerID == "" || runtime.AttemptHeartbeat <= 0 || runtime.AttemptLease <= 0 {
		return func() error { return nil }
	}
	guardCtx, stop := context.WithCancel(ctx)
	done := make(chan struct{})
	var heartbeatErr error
	var mutex sync.Mutex
	go func() {
		defer close(done)
		ticker := time.NewTicker(runtime.AttemptHeartbeat)
		defer ticker.Stop()
		for {
			select {
			case <-guardCtx.Done():
				return
			case now := <-ticker.C:
				if err := model.ExtendOriginRequestAttemptLease(db, attemptID, runtime.WorkerID, now.UTC().Add(runtime.AttemptLease)); err != nil {
					mutex.Lock()
					heartbeatErr = err
					mutex.Unlock()
					if cancelUpstream != nil {
						cancelUpstream()
					}
					return
				}
			}
		}
	}()
	return func() error {
		stop()
		<-done
		mutex.Lock()
		defer mutex.Unlock()
		return heartbeatErr
	}
}
