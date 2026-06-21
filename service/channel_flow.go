package service

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	channelflowmetrics "github.com/QuantumNous/new-api/pkg/channel_flow_metrics"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const (
	FlowDecisionRejectQueueFull           = "queue_full"
	FlowDecisionRejectQueueTimeout        = "queue_timeout"
	FlowDecisionRejectContextExceeded     = "context_exceeded"
	FlowDecisionRejectPerUserQueueFull    = "per_user_queue_full"
	FlowDecisionRejectPerUserInflightFull = "per_user_inflight_full"
	FlowDecisionRejectBackendDisabled     = "backend_disabled"
)

type AcquireRequest struct {
	RequestID      string
	Pool           model.ChannelFlowPool
	ChannelID      int
	UpstreamModel  string
	UserID         int
	TokenID        int
	ContextTokens  int
	ContextChars   int
	CreatedAtMs    int64
	QueueTimeoutMs int64
}

type AcquireDecision struct {
	Admitted      bool   `json:"admitted"`
	Queued        bool   `json:"queued"`
	QueuePos      int    `json:"queue_pos"`
	WaitedMs      int64  `json:"waited_ms"`
	Temporary     bool   `json:"temporary"`
	RejectCode    string `json:"reject_code"`
	RunningNow    int    `json:"running_now"`
	QueuedNow     int    `json:"queued_now"`
	RetryAfterS   int    `json:"retry_after_seconds"`
	Backend       string `json:"backend"`
	PoolKey       string `json:"pool_key"`
	ConfigVersion int64  `json:"config_version"`
}

type PoolStatus struct {
	PoolKey            string `json:"pool_key"`
	Name               string `json:"name"`
	Backend            string `json:"backend"`
	Health             string `json:"health"`
	ScheduleActive     bool   `json:"schedule_active"`
	Running            int    `json:"running"`
	MaxInflight        int    `json:"max_inflight"`
	Queued             int    `json:"queued"`
	MaxQueueSize       int    `json:"max_queue_size"`
	OldestWaitMs       int64  `json:"oldest_wait_ms"`
	ConfigVersion      int64  `json:"config_version"`
	LeaseRenewFailures int    `json:"lease_renew_failures"`
}

type FlowBackend interface {
	Acquire(ctx context.Context, req AcquireRequest) (FlowGuard, *AcquireDecision, error)
	Status(ctx context.Context, pool model.ChannelFlowPool) (PoolStatus, error)
	Close(ctx context.Context) error
}

type FlowGuard interface {
	Release(ctx context.Context) error
	RenewLease(ctx context.Context) error
	PoolKey() string
	RequestID() string
	IsReleased() bool
	BindRelease(release func())
	WrapReadCloser(rc io.ReadCloser) io.ReadCloser
}

type FlowController struct {
	memoryBackend FlowBackend
	redisBackend  FlowBackend
}

var defaultChannelFlowController = NewFlowController(NewMemoryFlowBackend(), NewRedisFlowBackend())

func NewFlowController(backends ...FlowBackend) *FlowController {
	controller := &FlowController{}
	if len(backends) > 0 {
		controller.memoryBackend = backends[0]
	}
	if len(backends) > 1 {
		controller.redisBackend = backends[1]
	}
	if controller.memoryBackend == nil {
		controller.memoryBackend = NewMemoryFlowBackend()
	}
	if controller.redisBackend == nil {
		controller.redisBackend = NewRedisFlowBackend()
	}
	return controller
}

func GetChannelFlowController() *FlowController {
	return defaultChannelFlowController
}

func (fc *FlowController) Acquire(ctx context.Context, req AcquireRequest) (FlowGuard, *AcquireDecision, error) {
	backend := fc.backendForPool(req.Pool)
	if backend == nil {
		return nil, nil, fmt.Errorf("channel flow backend is not initialized")
	}
	return backend.Acquire(ctx, req)
}

func (fc *FlowController) Status(ctx context.Context, pool model.ChannelFlowPool) (PoolStatus, error) {
	backend := fc.backendForPool(pool)
	if backend == nil {
		return PoolStatus{}, fmt.Errorf("channel flow backend is not initialized")
	}
	return backend.Status(ctx, pool)
}

func (fc *FlowController) Close(ctx context.Context) error {
	if fc == nil {
		return nil
	}
	if fc.memoryBackend != nil {
		if err := fc.memoryBackend.Close(ctx); err != nil {
			return err
		}
	}
	if fc.redisBackend != nil && fc.redisBackend != fc.memoryBackend {
		return fc.redisBackend.Close(ctx)
	}
	return nil
}

func (fc *FlowController) backendForPool(pool model.ChannelFlowPool) FlowBackend {
	if fc == nil {
		return nil
	}
	if pool.Backend == model.ChannelFlowBackendRedis {
		return fc.redisBackend
	}
	return fc.memoryBackend
}

func ResolveChannelFlowPool(channelID int) (*model.ChannelFlowPoolBinding, *model.ChannelFlowPool, bool, error) {
	binding, pool, err := model.GetChannelFlowPoolBindingForChannel(channelID)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil, false, nil
	}
	if err != nil {
		return nil, nil, false, err
	}
	if pool == nil || !pool.Enabled || !pool.IsScheduleActiveAt(time.Now()) {
		return binding, pool, false, nil
	}
	return binding, pool, true, nil
}

func AcquireChannelFlowGuard(c *gin.Context, channelID int, info *relaycommon.RelayInfo) (FlowGuard, *AcquireDecision, *types.NewAPIError) {
	if c == nil || info == nil {
		return nil, nil, nil
	}
	_, pool, ok, err := ResolveChannelFlowPool(channelID)
	if err != nil {
		return nil, nil, types.NewError(err, types.ErrorCodeChannelFlowConfigInvalid, types.ErrOptionWithSkipRetry())
	}
	if !ok || pool == nil {
		return nil, nil, nil
	}
	if passThrough, fallbackPool, apiErr := resolveRedisFlowUnavailable(c.Request.Context(), pool); apiErr != nil || passThrough {
		return nil, nil, apiErr
	} else if fallbackPool != nil {
		pool = fallbackPool
	}
	upstreamModel := info.OriginModelName
	if info.ChannelMeta != nil && info.UpstreamModelName != "" {
		upstreamModel = info.UpstreamModelName
	}
	req := AcquireRequest{
		RequestID:      c.GetString(common.RequestIdKey),
		Pool:           *pool,
		ChannelID:      channelID,
		UpstreamModel:  upstreamModel,
		UserID:         info.UserId,
		TokenID:        info.TokenId,
		ContextTokens:  info.GetEstimatePromptTokens(),
		CreatedAtMs:    time.Now().UnixMilli(),
		QueueTimeoutMs: pool.QueueTimeoutMs,
	}
	if req.RequestID == "" {
		req.RequestID = common.GetUUID()
	}
	guard, decision, acquireErr := GetChannelFlowController().Acquire(c.Request.Context(), req)
	if acquireErr != nil {
		if passThrough, fallbackPool, apiErr := handleRedisFlowAcquireError(c.Request.Context(), *pool, decision, acquireErr); apiErr != nil || passThrough {
			if apiErr != nil {
				recordChannelFlowMetric(req, channelFlowEventTypeFromDecision(decision), decision, true, decisionWaitMs(decision), 0)
			}
			return nil, decision, apiErr
		} else if fallbackPool != nil {
			req.Pool = *fallbackPool
			guard, decision, acquireErr = GetChannelFlowController().Acquire(c.Request.Context(), req)
			if acquireErr == nil {
				bindChannelFlowGuardCallbacks(guard, req, decision)
				return guard, decision, nil
			}
		}
		recordChannelFlowMetric(req, channelFlowEventTypeFromDecision(decision), decision, true, decisionWaitMs(decision), 0)
		return nil, decision, flowDecisionToAPIError(decision, acquireErr)
	}
	bindChannelFlowGuardCallbacks(guard, req, decision)
	return guard, decision, nil
}

func bindChannelFlowGuardCallbacks(guard FlowGuard, req AcquireRequest, decision *AcquireDecision) {
	if guard == nil || decision == nil {
		return
	}
	if decision.Queued {
		recordChannelFlowMetric(req, model.ChannelFlowEventQueued, decision, false, 0, 0)
	}
	recordChannelFlowMetric(req, model.ChannelFlowEventAcquired, decision, true, decision.WaitedMs, 0)

	acquiredAt := time.Now()
	stopRenew := startChannelFlowLeaseRenewer(guard, req)
	guard.BindRelease(func() {
		stopRenew()
		recordChannelFlowMetric(req, model.ChannelFlowEventReleased, nil, false, 0, time.Since(acquiredAt).Milliseconds())
	})
}

func RecordChannelFlowOutcome(guard FlowGuard, channelID int, info *relaycommon.RelayInfo, success bool) {
	if guard == nil || info == nil || guard.PoolKey() == "" {
		return
	}
	upstreamModel := info.OriginModelName
	if info.ChannelMeta != nil && info.UpstreamModelName != "" {
		upstreamModel = info.UpstreamModelName
	}
	eventType := model.ChannelFlowEventFailed
	if success {
		eventType = model.ChannelFlowEventSucceeded
	}
	channelflowmetrics.Record(channelflowmetrics.Sample{
		PoolKey:   guard.PoolKey(),
		ChannelID: channelID,
		Model:     upstreamModel,
		EventType: eventType,
		Running:   -1,
		Queued:    -1,
	})
}

func startChannelFlowLeaseRenewer(guard FlowGuard, req AcquireRequest) func() {
	if guard == nil || req.Pool.Backend != model.ChannelFlowBackendRedis {
		return func() {}
	}
	interval := channelFlowRenewInterval(req.Pool)
	ctx, cancel := context.WithCancel(context.Background())
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				if guard.IsReleased() {
					return
				}
				if err := guard.RenewLease(context.Background()); err != nil {
					recordChannelFlowMetric(req, model.ChannelFlowEventLeaseRenewFailed, nil, false, 0, 0)
				}
			}
		}
	}()
	return cancel
}

func channelFlowRenewInterval(pool model.ChannelFlowPool) time.Duration {
	pool.Normalize()
	interval := time.Duration(pool.RenewIntervalMs) * time.Millisecond
	lease := time.Duration(pool.LeaseMs) * time.Millisecond
	if lease > 0 && interval >= lease {
		interval = lease / 2
	}
	if interval < time.Second {
		interval = time.Second
	}
	return interval
}

func channelFlowEventTypeFromDecision(decision *AcquireDecision) string {
	if decision == nil {
		return model.ChannelFlowEventRejected
	}
	if decision.RejectCode == FlowDecisionRejectQueueTimeout {
		return model.ChannelFlowEventTimeout
	}
	return model.ChannelFlowEventRejected
}

func decisionWaitMs(decision *AcquireDecision) int64 {
	if decision == nil {
		return 0
	}
	return decision.WaitedMs
}

func recordChannelFlowMetric(req AcquireRequest, eventType string, decision *AcquireDecision, includeCapacity bool, waitMs int64, processMs int64) {
	if eventType == "" || req.Pool.PoolKey == "" {
		return
	}
	running := -1
	queued := -1
	if includeCapacity && decision != nil {
		running = decision.RunningNow
		queued = decision.QueuedNow
	}
	channelflowmetrics.Record(channelflowmetrics.Sample{
		PoolKey:   req.Pool.PoolKey,
		ChannelID: req.ChannelID,
		Model:     req.UpstreamModel,
		EventType: eventType,
		Running:   running,
		Queued:    queued,
		WaitMs:    waitMs,
		ProcessMs: processMs,
	})
}

func GetChannelFlowPoolStatus(ctx context.Context, pool model.ChannelFlowPool) (PoolStatus, error) {
	if passThrough, fallbackPool, _ := resolveRedisFlowUnavailable(ctx, &pool); passThrough {
		return withPoolStatusMetadata(degradedRedisFlowStatus(pool), pool), nil
	} else if fallbackPool != nil {
		status, err := GetChannelFlowController().Status(ctx, *fallbackPool)
		return withPoolStatusMetadata(status, pool), err
	}
	status, err := GetChannelFlowController().Status(ctx, pool)
	if err == nil {
		return withPoolStatusMetadata(status, pool), nil
	}
	if errors.Is(err, ErrRedisFlowBackendUnavailable) {
		switch pool.RedisFailurePolicy {
		case model.ChannelFlowRedisFailureLocalMemory:
			status, err := GetChannelFlowController().Status(ctx, localMemoryFallbackFlowPool(pool))
			return withPoolStatusMetadata(status, pool), err
		default:
			return withPoolStatusMetadata(degradedRedisFlowStatus(pool), pool), nil
		}
	}
	return withPoolStatusMetadata(status, pool), err
}

func withPoolStatusMetadata(status PoolStatus, pool model.ChannelFlowPool) PoolStatus {
	pool.Normalize()
	status.Name = pool.Name
	status.ConfigVersion = pool.ConfigVersion
	status.ScheduleActive = pool.Enabled && pool.IsScheduleActiveAt(time.Now())
	return status
}

func localMemoryFallbackFlowPool(pool model.ChannelFlowPool) model.ChannelFlowPool {
	pool.Backend = model.ChannelFlowBackendMemory
	return pool
}

func resolveRedisFlowUnavailable(ctx context.Context, pool *model.ChannelFlowPool) (passThrough bool, fallbackPool *model.ChannelFlowPool, apiErr *types.NewAPIError) {
	if pool == nil || pool.Backend != model.ChannelFlowBackendRedis || IsRedisFlowBackendAvailable(ctx) {
		return false, nil, nil
	}
	switch pool.RedisFailurePolicy {
	case model.ChannelFlowRedisFailureFailClosed:
		decision := newFlowDecision(*pool, false, false)
		decision.RejectCode = FlowDecisionRejectBackendDisabled
		decision.Temporary = true
		return false, nil, flowDecisionToAPIError(decision, fmt.Errorf("channel flow redis backend is unavailable"))
	case model.ChannelFlowRedisFailureLocalMemory:
		fallback := localMemoryFallbackFlowPool(*pool)
		return false, &fallback, nil
	default:
		return true, nil, nil
	}
}

func handleRedisFlowAcquireError(ctx context.Context, pool model.ChannelFlowPool, decision *AcquireDecision, acquireErr error) (passThrough bool, fallbackPool *model.ChannelFlowPool, apiErr *types.NewAPIError) {
	if pool.Backend != model.ChannelFlowBackendRedis || !errors.Is(acquireErr, ErrRedisFlowBackendUnavailable) {
		return false, nil, nil
	}
	switch pool.RedisFailurePolicy {
	case model.ChannelFlowRedisFailureFailClosed:
		if decision == nil {
			decision = newFlowDecision(pool, false, false)
		}
		decision.RejectCode = FlowDecisionRejectBackendDisabled
		return false, nil, flowDecisionToAPIError(decision, acquireErr)
	case model.ChannelFlowRedisFailureLocalMemory:
		fallback := localMemoryFallbackFlowPool(pool)
		return false, &fallback, nil
	default:
		return true, nil, nil
	}
}

func degradedRedisFlowStatus(pool model.ChannelFlowPool) PoolStatus {
	pool.Normalize()
	return PoolStatus{
		PoolKey:        pool.PoolKey,
		Name:           pool.Name,
		Backend:        pool.Backend,
		Health:         "degraded",
		ScheduleActive: pool.Enabled && pool.IsScheduleActiveAt(time.Now()),
		MaxInflight:    pool.MaxInflight,
		MaxQueueSize:   pool.MaxQueueSize,
		ConfigVersion:  pool.ConfigVersion,
	}
}

func newFlowDecision(pool model.ChannelFlowPool, admitted bool, queued bool) *AcquireDecision {
	return &AcquireDecision{
		Admitted:      admitted,
		Queued:        queued,
		Temporary:     true,
		RetryAfterS:   retryAfterSeconds(pool.QueueTimeoutMs),
		Backend:       pool.Backend,
		PoolKey:       pool.PoolKey,
		ConfigVersion: pool.ConfigVersion,
	}
}

func retryAfterSeconds(timeoutMs int64) int {
	if timeoutMs <= 0 {
		return 30
	}
	seconds := int((timeoutMs + 999) / 1000)
	if seconds < 1 {
		return 1
	}
	if seconds > 30 {
		return 30
	}
	return seconds
}

func flowDecisionToAPIError(decision *AcquireDecision, err error) *types.NewAPIError {
	if err == nil {
		err = fmt.Errorf("channel flow control rejected request")
	}
	errorCode := types.ErrorCodeChannelFlowQueueFull
	statusCode := http.StatusTooManyRequests
	if decision != nil {
		switch decision.RejectCode {
		case FlowDecisionRejectQueueTimeout:
			errorCode = types.ErrorCodeChannelFlowQueueTimeout
		case FlowDecisionRejectContextExceeded:
			errorCode = types.ErrorCodeChannelFlowContextExceeded
			statusCode = http.StatusBadRequest
		case FlowDecisionRejectPerUserQueueFull:
			errorCode = types.ErrorCodeChannelFlowPerUserQueueFull
		case FlowDecisionRejectPerUserInflightFull:
			errorCode = types.ErrorCodeChannelFlowPerUserInflightFull
		case FlowDecisionRejectBackendDisabled:
			errorCode = types.ErrorCodeChannelFlowBackendUnavailable
			statusCode = http.StatusServiceUnavailable
		}
	}
	openAIError := types.OpenAIError{
		Message: err.Error(),
		Type:    "rate_limit_error",
		Code:    errorCode,
	}
	if decision != nil {
		metadata, marshalErr := common.Marshal(map[string]any{
			"pool_running":          decision.RunningNow,
			"pool_queued":           decision.QueuedNow,
			"queue_pos":             decision.QueuePos,
			"waited_ms":             decision.WaitedMs,
			"reject_code":           decision.RejectCode,
			"retry_after_seconds":   decision.RetryAfterS,
			"channel_flow_backend":  decision.Backend,
			"channel_flow_pool_key": decision.PoolKey,
		})
		if marshalErr == nil {
			openAIError.Metadata = metadata
		}
	}
	return types.WithOpenAIError(openAIError, statusCode, types.ErrOptionWithSkipRetry(), types.ErrOptionWithNoRecordErrorLog())
}

type memoryFlowBackend struct {
	mu    sync.RWMutex
	slots map[string]*memoryFlowSlot
}

type memoryFlowSlot struct {
	mu          sync.Mutex
	config      model.ChannelFlowPool
	queue       []*memoryFlowRequest
	nextSeq     int64
	eventCounts map[string]int
}

type memoryFlowRequestState string

const (
	memoryFlowStateWaiting  memoryFlowRequestState = "waiting"
	memoryFlowStateRunning  memoryFlowRequestState = "running"
	memoryFlowStateReleased memoryFlowRequestState = "released"
)

type memoryFlowRequest struct {
	id            string
	seq           int64
	userID        int
	channelID     int
	upstreamModel string
	state         memoryFlowRequestState
	enqueuedAt    time.Time
	dispatchedAt  time.Time
	notify        chan struct{}
	cancelled     bool
}

type memoryFlowGuard struct {
	backend     *memoryFlowBackend
	slot        *memoryFlowSlot
	poolKey     string
	requestID   string
	released    atomic.Bool
	releaseFunc atomic.Value
}

type flowReadCloser struct {
	io.ReadCloser
	guard FlowGuard
}

func NewMemoryFlowBackend() FlowBackend {
	return &memoryFlowBackend{
		slots: make(map[string]*memoryFlowSlot),
	}
}

func (b *memoryFlowBackend) Acquire(ctx context.Context, req AcquireRequest) (FlowGuard, *AcquireDecision, error) {
	if ctx == nil {
		ctx = context.Background()
	}
	req.Pool.Normalize()
	if req.QueueTimeoutMs <= 0 {
		req.QueueTimeoutMs = req.Pool.QueueTimeoutMs
	}
	decision := newFlowDecision(req.Pool, false, false)
	slot := b.getSlot(req.Pool)
	now := time.Now()

	slot.mu.Lock()
	slot.config = req.Pool
	slot.cleanupLocked(now)
	running, queued, _ := slot.statsLocked(now)
	decision.RunningNow = running
	decision.QueuedNow = queued
	if req.Pool.MaxContextTokens > 0 && req.ContextTokens > req.Pool.MaxContextTokens {
		decision.RejectCode = FlowDecisionRejectContextExceeded
		slot.mu.Unlock()
		return nil, decision, fmt.Errorf("request context tokens %d exceeds flow pool max_context_tokens %d", req.ContextTokens, req.Pool.MaxContextTokens)
	}
	userInflightFull := req.Pool.MaxInflightPerUser > 0 && req.UserID > 0 &&
		slot.userRunningLocked(req.UserID) >= req.Pool.MaxInflightPerUser
	if slot.hasCapacityLocked() && queued == 0 && !userInflightFull {
		request := slot.newRequestLocked(req, memoryFlowStateRunning, now)
		request.dispatchedAt = now
		slot.queue = append(slot.queue, request)
		running, queued, _ = slot.statsLocked(now)
		decision.Admitted = true
		decision.RunningNow = running
		decision.QueuedNow = queued
		decision.WaitedMs = 0
		guard := &memoryFlowGuard{backend: b, slot: slot, poolKey: req.Pool.PoolKey, requestID: request.id}
		slot.mu.Unlock()
		return guard, decision, nil
	}
	if req.Pool.OnLimit != model.ChannelFlowOnLimitQueue {
		if userInflightFull {
			decision.RejectCode = FlowDecisionRejectPerUserInflightFull
		} else {
			decision.RejectCode = FlowDecisionRejectQueueFull
		}
		slot.mu.Unlock()
		return nil, decision, fmt.Errorf("channel flow pool is busy")
	}
	if req.Pool.MaxQueueSize > 0 && queued >= req.Pool.MaxQueueSize {
		decision.RejectCode = FlowDecisionRejectQueueFull
		slot.mu.Unlock()
		return nil, decision, fmt.Errorf("channel flow queue is full")
	}
	if req.Pool.MaxQueuePerUser > 0 && slot.userWaitingLocked(req.UserID) >= req.Pool.MaxQueuePerUser {
		decision.RejectCode = FlowDecisionRejectPerUserQueueFull
		slot.mu.Unlock()
		return nil, decision, fmt.Errorf("channel flow per-user queue is full")
	}

	request := slot.newRequestLocked(req, memoryFlowStateWaiting, now)
	slot.queue = append(slot.queue, request)
	slot.dispatchLocked(now)
	running, queued, _ = slot.statsLocked(now)
	admittedAfterDispatch := request.state == memoryFlowStateRunning
	decision.Queued = request.state == memoryFlowStateWaiting
	decision.Admitted = admittedAfterDispatch
	decision.QueuePos = slot.positionLocked(request.id)
	decision.RunningNow = running
	decision.QueuedNow = queued
	slot.mu.Unlock()

	if admittedAfterDispatch {
		decision.WaitedMs = 0
		return &memoryFlowGuard{backend: b, slot: slot, poolKey: req.Pool.PoolKey, requestID: request.id}, decision, nil
	}

	timer := time.NewTimer(time.Duration(req.QueueTimeoutMs) * time.Millisecond)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		waitedMs, runningNow, queuedNow, _ := slot.cancelWaiting(request.id)
		decision.WaitedMs = waitedMs
		decision.RunningNow = runningNow
		decision.QueuedNow = queuedNow
		decision.RejectCode = FlowDecisionRejectQueueTimeout
		return nil, decision, ctx.Err()
	case <-timer.C:
		waitedMs, runningNow, queuedNow, _ := slot.cancelWaiting(request.id)
		decision.WaitedMs = waitedMs
		decision.RunningNow = runningNow
		decision.QueuedNow = queuedNow
		decision.RejectCode = FlowDecisionRejectQueueTimeout
		return nil, decision, fmt.Errorf("channel flow queue timeout")
	case <-request.notify:
		dispatchedAt := request.dispatchedAt
		if dispatchedAt.IsZero() {
			dispatchedAt = time.Now()
		}
		decision.Admitted = true
		decision.Queued = true
		decision.WaitedMs = dispatchedAt.Sub(request.enqueuedAt).Milliseconds()
		slot.mu.Lock()
		running, queued, _ = slot.statsLocked(time.Now())
		decision.RunningNow = running
		decision.QueuedNow = queued
		decision.QueuePos = 0
		slot.mu.Unlock()
		return &memoryFlowGuard{backend: b, slot: slot, poolKey: req.Pool.PoolKey, requestID: request.id}, decision, nil
	}
}

func (b *memoryFlowBackend) Status(_ context.Context, pool model.ChannelFlowPool) (PoolStatus, error) {
	pool.Normalize()
	slot := b.getSlot(pool)
	slot.mu.Lock()
	defer slot.mu.Unlock()
	slot.config = pool
	now := time.Now()
	slot.cleanupLocked(now)
	running, queued, oldestWaitMs := slot.statsLocked(now)
	return PoolStatus{
		PoolKey:        pool.PoolKey,
		Name:           pool.Name,
		Backend:        pool.Backend,
		Health:         flowHealth(running, pool.MaxInflight, queued, pool.MaxQueueSize),
		ScheduleActive: pool.Enabled && pool.IsScheduleActiveAt(time.Now()),
		Running:        running,
		MaxInflight:    pool.MaxInflight,
		Queued:         queued,
		MaxQueueSize:   pool.MaxQueueSize,
		OldestWaitMs:   oldestWaitMs,
		ConfigVersion:  pool.ConfigVersion,
	}, nil
}

func (b *memoryFlowBackend) Close(_ context.Context) error {
	return nil
}

func (b *memoryFlowBackend) getSlot(pool model.ChannelFlowPool) *memoryFlowSlot {
	b.mu.RLock()
	slot := b.slots[pool.PoolKey]
	b.mu.RUnlock()
	if slot != nil {
		return slot
	}
	b.mu.Lock()
	defer b.mu.Unlock()
	if slot = b.slots[pool.PoolKey]; slot != nil {
		return slot
	}
	slot = &memoryFlowSlot{
		config:      pool,
		eventCounts: make(map[string]int),
	}
	b.slots[pool.PoolKey] = slot
	return slot
}

func (s *memoryFlowSlot) newRequestLocked(req AcquireRequest, state memoryFlowRequestState, now time.Time) *memoryFlowRequest {
	s.nextSeq++
	return &memoryFlowRequest{
		id:            req.RequestID,
		seq:           s.nextSeq,
		userID:        req.UserID,
		channelID:     req.ChannelID,
		upstreamModel: req.UpstreamModel,
		state:         state,
		enqueuedAt:    now,
		notify:        make(chan struct{}, 1),
	}
}

func (s *memoryFlowSlot) hasCapacityLocked() bool {
	if s.config.MaxInflight <= 0 {
		return true
	}
	running := 0
	for _, req := range s.queue {
		if req.state == memoryFlowStateRunning && !req.cancelled {
			running++
		}
	}
	return running < s.config.MaxInflight
}

func (s *memoryFlowSlot) userRunningLocked(userID int) int {
	if userID <= 0 || s.config.MaxInflightPerUser <= 0 {
		return 0
	}
	count := 0
	for _, req := range s.queue {
		if req.userID == userID && req.state == memoryFlowStateRunning && !req.cancelled {
			count++
		}
	}
	return count
}

func (s *memoryFlowSlot) dispatchLocked(now time.Time) {
	for s.hasCapacityLocked() {
		dispatched := false
		for _, req := range s.queue {
			if req.state != memoryFlowStateWaiting || req.cancelled {
				continue
			}
			if s.config.MaxInflightPerUser > 0 && req.userID > 0 &&
				s.userRunningLocked(req.userID) >= s.config.MaxInflightPerUser {
				continue
			}
			req.state = memoryFlowStateRunning
			req.dispatchedAt = now
			select {
			case req.notify <- struct{}{}:
			default:
			}
			dispatched = true
			break
		}
		if !dispatched {
			return
		}
	}
}

func (s *memoryFlowSlot) statsLocked(now time.Time) (running int, queued int, oldestWaitMs int64) {
	for _, req := range s.queue {
		if req.cancelled || req.state == memoryFlowStateReleased {
			continue
		}
		switch req.state {
		case memoryFlowStateRunning:
			running++
		case memoryFlowStateWaiting:
			queued++
			waitMs := now.Sub(req.enqueuedAt).Milliseconds()
			if oldestWaitMs == 0 || waitMs > oldestWaitMs {
				oldestWaitMs = waitMs
			}
		}
	}
	return running, queued, oldestWaitMs
}

func (s *memoryFlowSlot) positionLocked(requestID string) int {
	position := 0
	for _, req := range s.queue {
		if req.cancelled || req.state != memoryFlowStateWaiting {
			continue
		}
		position++
		if req.id == requestID {
			return position
		}
	}
	return 0
}

func (s *memoryFlowSlot) userWaitingLocked(userID int) int {
	if userID <= 0 {
		return 0
	}
	count := 0
	for _, req := range s.queue {
		if req.userID == userID && req.state == memoryFlowStateWaiting && !req.cancelled {
			count++
		}
	}
	return count
}

func (s *memoryFlowSlot) cancelWaiting(requestID string) (waitedMs int64, runningNow int, queuedNow int, wasRunning bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	now := time.Now()
	for _, req := range s.queue {
		if req.id == requestID && !req.cancelled {
			switch req.state {
			case memoryFlowStateWaiting:
				req.cancelled = true
				req.state = memoryFlowStateReleased
				waitedMs = now.Sub(req.enqueuedAt).Milliseconds()
			case memoryFlowStateRunning:
				req.state = memoryFlowStateReleased
				req.cancelled = true
				wasRunning = true
			}
			break
		}
	}
	s.compactIfNeededLocked()
	s.dispatchLocked(now)
	runningNow, queuedNow, _ = s.statsLocked(now)
	return waitedMs, runningNow, queuedNow, wasRunning
}

func (s *memoryFlowSlot) release(requestID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	now := time.Now()
	for _, req := range s.queue {
		if req.id == requestID && req.state == memoryFlowStateRunning {
			req.state = memoryFlowStateReleased
			req.cancelled = true
			break
		}
	}
	s.compactIfNeededLocked()
	s.dispatchLocked(now)
	return nil
}

func (s *memoryFlowSlot) cleanupLocked(now time.Time) {
	if s.config.MaxProcessingMs > 0 {
		for _, req := range s.queue {
			if req.state == memoryFlowStateRunning && !req.dispatchedAt.IsZero() && now.Sub(req.dispatchedAt).Milliseconds() > s.config.MaxProcessingMs {
				req.state = memoryFlowStateReleased
				req.cancelled = true
			}
		}
	}
	s.compactIfNeededLocked()
}

func (s *memoryFlowSlot) compactIfNeededLocked() {
	if len(s.queue) == 0 {
		return
	}
	stale := 0
	for _, req := range s.queue {
		if req.cancelled || req.state == memoryFlowStateReleased {
			stale++
		}
	}
	if stale < 64 && stale*100 < len(s.queue)*30 {
		return
	}
	compact := s.queue[:0]
	for _, req := range s.queue {
		if req.cancelled || req.state == memoryFlowStateReleased {
			continue
		}
		compact = append(compact, req)
	}
	s.queue = compact
}

func (g *memoryFlowGuard) Release(ctx context.Context) error {
	if g == nil || g.released.Swap(true) {
		return nil
	}
	if release, ok := g.releaseFunc.Load().(func()); ok && release != nil {
		release()
	}
	if g.slot == nil {
		return nil
	}
	return g.slot.release(g.requestID)
}

func (g *memoryFlowGuard) RenewLease(_ context.Context) error {
	return nil
}

func (g *memoryFlowGuard) PoolKey() string {
	if g == nil {
		return ""
	}
	return g.poolKey
}

func (g *memoryFlowGuard) RequestID() string {
	if g == nil {
		return ""
	}
	return g.requestID
}

func (g *memoryFlowGuard) IsReleased() bool {
	return g == nil || g.released.Load()
}

func (g *memoryFlowGuard) BindRelease(release func()) {
	if g == nil || release == nil {
		return
	}
	g.releaseFunc.Store(release)
}

func (g *memoryFlowGuard) WrapReadCloser(rc io.ReadCloser) io.ReadCloser {
	if rc == nil {
		return nil
	}
	return &flowReadCloser{ReadCloser: rc, guard: g}
}

func (rc *flowReadCloser) Close() error {
	err := rc.ReadCloser.Close()
	_ = rc.guard.Release(context.Background())
	return err
}

func flowHealth(running int, maxInflight int, queued int, maxQueueSize int) string {
	if queued > 0 {
		if maxQueueSize > 0 && queued*100/maxQueueSize >= 80 {
			return "critical"
		}
		return "congested"
	}
	if maxInflight > 0 && running*100/maxInflight >= 70 {
		return "busy"
	}
	return "healthy"
}
