package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strconv"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/storage"
)

type AsyncExecutionOutcome struct {
	Status         model.AsyncExecutionStatus
	Payload        json.RawMessage
	Media          []AsyncMediaSource
	ErrorPhase     string
	ErrorCode      string
	ErrorMessage   string
	RefundEligible bool
}

type AsyncImageExecutor interface {
	Execute(ctx context.Context, payload []byte, markRequestSent func() error) AsyncExecutionOutcome
}

type AsyncImageExecutorFactory func(channel *model.Channel, apiKey string, timeout time.Duration) (AsyncImageExecutor, error)

var NewAsyncImageExecutor AsyncImageExecutorFactory

type AsyncWorker struct {
	ID            string
	Concurrency   int
	LeaseDuration time.Duration
	PollInterval  time.Duration
	JobTimeout    time.Duration
	Store         storage.ArtifactStore
	Factory       AsyncImageExecutorFactory

	semaphores *asyncSemaphoreRegistry
	wg         sync.WaitGroup
}

func NewAsyncWorkerFromEnv(ctx context.Context) (*AsyncWorker, error) {
	store, err := storage.NewS3ArtifactStore(ctx)
	if err != nil {
		return nil, err
	}
	workerID := os.Getenv("ASYNC_WORKER_ID")
	if workerID == "" {
		workerID = fmt.Sprintf("%s-%d", common.NodeName, os.Getpid())
	}
	concurrency := common.GetEnvOrDefault("ASYNC_WORKER_CONCURRENCY", 50)
	if concurrency <= 0 {
		return nil, errors.New("ASYNC_WORKER_CONCURRENCY must be positive")
	}
	leaseSeconds := common.GetEnvOrDefault("ASYNC_WORKER_LEASE_SECONDS", 90)
	if leaseSeconds < 15 {
		return nil, errors.New("ASYNC_WORKER_LEASE_SECONDS must be at least 15")
	}
	jobTimeout := common.GetEnvOrDefault("ASYNC_JOB_TIMEOUT_SECONDS", 1800)
	if jobTimeout <= 0 {
		return nil, errors.New("ASYNC_JOB_TIMEOUT_SECONDS must be positive")
	}
	if NewAsyncImageExecutor == nil {
		return nil, errors.New("async image executor factory is not configured")
	}
	return &AsyncWorker{
		ID:            workerID,
		Concurrency:   concurrency,
		LeaseDuration: time.Duration(leaseSeconds) * time.Second,
		PollInterval:  time.Duration(common.GetEnvOrDefault("ASYNC_WORKER_POLL_MILLISECONDS", 500)) * time.Millisecond,
		JobTimeout:    time.Duration(jobTimeout) * time.Second,
		Store:         store,
		Factory:       NewAsyncImageExecutor,
		semaphores:    newAsyncSemaphoreRegistry(),
	}, nil
}

func (w *AsyncWorker) Run(ctx context.Context) error {
	if w == nil || w.Store == nil || w.Factory == nil {
		return errors.New("async worker is not fully configured")
	}
	if w.PollInterval <= 0 {
		w.PollInterval = 500 * time.Millisecond
	}
	global := make(chan struct{}, w.Concurrency)
	recoveryTicker := time.NewTicker(15 * time.Second)
	cleanupIntervalSeconds := common.GetEnvOrDefault("ASYNC_ARTIFACT_CLEANUP_INTERVAL_SECONDS", 60)
	if cleanupIntervalSeconds < 10 {
		cleanupIntervalSeconds = 10
	}
	cleanupTicker := time.NewTicker(time.Duration(cleanupIntervalSeconds) * time.Second)
	defer recoveryTicker.Stop()
	defer cleanupTicker.Stop()

	if _, err := model.RecoverExpiredAsyncJobs(ctx, time.Now().Unix(), w.Concurrency*4); err != nil {
		common.SysError("initial async lease recovery failed: " + err.Error())
	}
	if _, err := model.ReconcileAsyncBilling(ctx, w.Concurrency*4); err != nil {
		common.SysError("initial async billing reconciliation failed: " + err.Error())
	}
	if _, err := CleanupExpiredAsyncArtifacts(ctx, w.Store, 100); err != nil {
		common.SysError("initial async artifact cleanup failed: " + err.Error())
	}

	for {
		select {
		case <-ctx.Done():
			w.wg.Wait()
			return nil
		case <-recoveryTicker.C:
			if _, err := model.RecoverExpiredAsyncJobs(ctx, time.Now().Unix(), w.Concurrency*4); err != nil && !errors.Is(err, context.Canceled) {
				common.SysError("async lease recovery failed: " + err.Error())
			}
			if _, err := model.ReconcileAsyncBilling(ctx, w.Concurrency*4); err != nil && !errors.Is(err, context.Canceled) {
				common.SysError("async billing reconciliation failed: " + err.Error())
			}
		case <-cleanupTicker.C:
			if _, err := CleanupExpiredAsyncArtifacts(ctx, w.Store, 100); err != nil && !errors.Is(err, context.Canceled) {
				common.SysError("async artifact cleanup failed: " + err.Error())
			}
		default:
		}

		available := w.Concurrency - len(global)
		if available <= 0 {
			if !waitAsyncPoll(ctx, w.PollInterval) {
				w.wg.Wait()
				return nil
			}
			continue
		}
		candidates, err := model.ListQueuedAsyncJobs(ctx, available*4)
		if err != nil {
			if errors.Is(err, context.Canceled) {
				w.wg.Wait()
				return nil
			}
			common.SysError("list async jobs failed: " + err.Error())
			waitAsyncPoll(ctx, w.PollInterval)
			continue
		}
		claimedCount := 0
		for _, candidate := range candidates {
			if len(global) >= cap(global) {
				break
			}
			channel, channelErr := model.GetChannelById(candidate.ChannelID, true)
			limit := 1
			if channelErr == nil && channel != nil {
				limit = channel.GetSetting().AsyncMaxConcurrency
				if limit <= 0 {
					limit = common.GetEnvOrDefault("ASYNC_CHANNEL_DEFAULT_CONCURRENCY", 10)
				}
			}
			modelName := candidate.Task.Properties.OriginModelName
			release, acquired := w.semaphores.TryAcquire(candidate.ChannelID, modelName, limit)
			if !acquired {
				continue
			}
			global <- struct{}{}
			claimed, won, claimErr := model.ClaimAsyncJob(ctx, candidate.ID, w.ID, time.Now().Add(w.LeaseDuration).Unix())
			if claimErr != nil || !won {
				<-global
				release()
				if claimErr != nil {
					common.SysError("claim async job failed: " + claimErr.Error())
				}
				continue
			}
			claimedCount++
			w.wg.Add(1)
			go func(job *model.AsyncJob, releaseLimits func()) {
				defer w.wg.Done()
				defer func() { <-global }()
				defer releaseLimits()
				// Shutdown stops new claims but deliberately does not cancel an
				// already-sent upstream request. Each job drains under its own
				// configured timeout before Run returns.
				w.process(context.Background(), job)
			}(claimed, release)
		}
		if claimedCount == 0 && !waitAsyncPoll(ctx, w.PollInterval) {
			w.wg.Wait()
			return nil
		}
	}
}

func waitAsyncPoll(ctx context.Context, duration time.Duration) bool {
	timer := time.NewTimer(duration)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return false
	case <-timer.C:
		return true
	}
}

func (w *AsyncWorker) process(parent context.Context, job *model.AsyncJob) {
	jobCtx, cancel := context.WithCancel(parent)
	defer cancel()
	leaseDone := make(chan struct{})
	go w.renewLease(jobCtx, cancel, job.ID, leaseDone)
	defer close(leaseDone)

	fail := func(phase, code, message string, refundable bool) {
		changed, err := model.CompleteAsyncJob(context.Background(), job.ID, w.ID, model.AsyncStatusFailure, nil, phase, code, message, refundable)
		if err != nil {
			common.SysError(fmt.Sprintf("complete async job %d as failure: %v", job.ID, err))
			return
		}
		if !changed {
			return
		}
		if refundable {
			_, err = model.RefundAsyncJobBilling(context.Background(), job.ID)
		} else {
			_, err = model.SettleAsyncJobBilling(context.Background(), job.ID)
		}
		if err != nil {
			common.SysError(fmt.Sprintf("finalize async billing for job %d: %v", job.ID, err))
		}
	}

	payload, err := DecryptAsyncPayload(job.RequestPayload)
	if err != nil {
		fail("request_decrypt", "request_decrypt_failed", "encrypted task payload could not be decrypted", true)
		return
	}
	channel, err := model.GetChannelById(job.ChannelID, true)
	if err != nil || channel == nil || channel.Status != common.ChannelStatusEnabled {
		fail("channel_load", "channel_unavailable", "the selected async channel is unavailable", true)
		return
	}
	setting := channel.GetSetting()
	modelName := job.Task.Properties.OriginModelName
	if !setting.AllowsAsyncImageModel(modelName) || !setting.AsyncArchiveEnabled() || !IsAllowedAsyncImageBaseURL(channel.GetBaseURL()) {
		fail("channel_validate", "channel_async_disabled", "the selected channel no longer permits this async image model", true)
		return
	}
	apiKey, _, apiErr := channel.GetNextEnabledKey()
	if apiErr != nil {
		fail("channel_key", "channel_key_unavailable", "the selected channel has no available credential", true)
		return
	}
	timeout := w.JobTimeout
	if setting.AsyncJobTimeoutSeconds > 0 {
		timeout = time.Duration(setting.AsyncJobTimeoutSeconds) * time.Second
	}
	if timeout <= 0 {
		timeout = 30 * time.Minute
	}
	executor, err := w.Factory(channel, apiKey, timeout)
	if err != nil {
		fail("executor_init", "executor_init_failed", "failed to initialize the synchronous image executor", true)
		return
	}
	executionCtx, timeoutCancel := context.WithTimeout(jobCtx, timeout)
	defer timeoutCancel()
	outcome := executor.Execute(executionCtx, payload, func() error {
		marked, markErr := model.MarkAsyncRequestSent(context.Background(), job.ID, w.ID, time.Now().Unix())
		if markErr != nil {
			return markErr
		}
		if !marked {
			return errors.New("async job lease was lost before request send")
		}
		return nil
	})

	switch outcome.Status {
	case model.AsyncStatusSuccess:
		retention := setting.EffectiveAsyncRetentionMinutes(
			common.GetEnvOrDefault("ASYNC_RESULT_RETENTION_MINUTES", dto.AsyncRetentionDefaultMinutes),
		)
		archiveTimeout := time.Duration(common.GetEnvOrDefault("ASYNC_ARTIFACT_ARCHIVE_TIMEOUT_SECONDS", 300)) * time.Second
		if archiveTimeout <= 0 {
			archiveTimeout = 5 * time.Minute
		}
		archiveCtx, archiveCancel := context.WithTimeout(jobCtx, archiveTimeout)
		_, archiveErr := ArchiveAsyncMedia(archiveCtx, &job.Task, outcome.Media, w.Store, retention)
		archiveCancel()
		if archiveErr != nil {
			fail("artifact_archive", "artifact_archive_failed", "upstream succeeded but one or more artifacts could not be archived", false)
			return
		}
		changed, err := model.CompleteAsyncJob(context.Background(), job.ID, w.ID, model.AsyncStatusSuccess, outcome.Payload, "", "", "", false)
		if err != nil {
			common.SysError(fmt.Sprintf("complete async job %d as success: %v", job.ID, err))
			return
		}
		if changed {
			if _, err := model.SettleAsyncJobBilling(context.Background(), job.ID); err != nil {
				common.SysError(fmt.Sprintf("settle async job %d: %v", job.ID, err))
			}
		}
	case model.AsyncStatusUncertain:
		changed, err := model.CompleteAsyncJob(context.Background(), job.ID, w.ID, model.AsyncStatusUncertain, outcome.Payload, outcome.ErrorPhase, outcome.ErrorCode, outcome.ErrorMessage, false)
		if err != nil {
			common.SysError(fmt.Sprintf("complete async job %d as uncertain: %v", job.ID, err))
			return
		}
		if changed {
			if _, err := model.SettleAsyncJobBilling(context.Background(), job.ID); err != nil {
				common.SysError(fmt.Sprintf("settle uncertain async job %d: %v", job.ID, err))
			}
		}
	case model.AsyncStatusFailure:
		fail(outcome.ErrorPhase, outcome.ErrorCode, outcome.ErrorMessage, outcome.RefundEligible)
	default:
		fail("executor", "invalid_executor_outcome", "synchronous image executor returned an invalid state", false)
	}
}

func (w *AsyncWorker) renewLease(ctx context.Context, cancel context.CancelFunc, jobID int64, done <-chan struct{}) {
	interval := w.LeaseDuration / 3
	if interval < 5*time.Second {
		interval = 5 * time.Second
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-done:
			return
		case <-ticker.C:
			renewed, err := model.RenewAsyncJobLease(context.Background(), jobID, w.ID, time.Now().Add(w.LeaseDuration).Unix())
			if err != nil || !renewed {
				cancel()
				return
			}
		}
	}
}

func CleanupExpiredAsyncArtifacts(ctx context.Context, store storage.ArtifactStore, limit int) (int, error) {
	artifacts, err := model.ListExpiredArtifacts(ctx, time.Now().Unix(), limit)
	if err != nil {
		return 0, err
	}
	deleted := 0
	for _, artifact := range artifacts {
		if err := store.Delete(ctx, artifact.ObjectKey); err != nil {
			return deleted, err
		}
		if _, err := model.DeleteArtifactAndClearResultIfLast(ctx, artifact.ID, artifact.TaskID); err != nil {
			return deleted, err
		}
		deleted++
	}
	return deleted, nil
}

type asyncSemaphoreRegistry struct {
	mu    sync.Mutex
	items map[string]chan struct{}
}

func newAsyncSemaphoreRegistry() *asyncSemaphoreRegistry {
	return &asyncSemaphoreRegistry{items: make(map[string]chan struct{})}
}

func (r *asyncSemaphoreRegistry) TryAcquire(channelID int, modelName string, limit int) (func(), bool) {
	if limit <= 0 {
		limit = 1
	}
	channelKey := "channel:" + strconv.Itoa(channelID)
	modelKey := channelKey + ":model:" + modelName
	channelSemaphore := r.get(channelKey, limit)
	modelSemaphore := r.get(modelKey, limit)
	select {
	case channelSemaphore <- struct{}{}:
	default:
		return func() {}, false
	}
	select {
	case modelSemaphore <- struct{}{}:
		return func() {
			<-modelSemaphore
			<-channelSemaphore
		}, true
	default:
		<-channelSemaphore
		return func() {}, false
	}
}

func (r *asyncSemaphoreRegistry) get(key string, limit int) chan struct{} {
	r.mu.Lock()
	defer r.mu.Unlock()
	if existing, ok := r.items[key]; ok {
		return existing
	}
	created := make(chan struct{}, limit)
	r.items[key] = created
	return created
}
