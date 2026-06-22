package service

import (
	"context"
	"errors"
	"fmt"
	"io"
	"strconv"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/go-redis/redis/v8"
)

var ErrRedisFlowBackendUnavailable = errors.New("channel flow redis backend unavailable")

const (
	redisFlowNamespace       = "new-api:channel-flow:v1"
	redisFlowPollMin         = 10 * time.Millisecond
	redisFlowPollMax         = 50 * time.Millisecond
	redisFlowCleanupBatch    = 128
	redisFlowRequestTTLExtra = time.Hour
)

type redisFlowBackend struct {
	pollMin       time.Duration
	pollMax       time.Duration
	watchAttempts atomic.Int64
	txConflicts   atomic.Int64
}

type redisFlowKeys struct {
	Running  string
	Waiting  string
	Deadline string
	Seq      string
	Base     string
}

type redisFlowGuard struct {
	backend     *redisFlowBackend
	pool        model.ChannelFlowPool
	poolKey     string
	requestID   string
	userID      int
	released    atomic.Bool
	releaseFunc atomic.Value
}

type redisAcquireAttempt struct {
	decision redisAcquireDecision
	done     bool
}

type redisAcquireDecision struct {
	admitted   bool
	queued     bool
	rejectCode string
	queuePos   int
	waitedMs   int64
	score      float64
	runningNow int
	queuedNow  int
}

func NewRedisFlowBackend() FlowBackend {
	return &redisFlowBackend{
		pollMin: redisFlowPollMin,
		pollMax: redisFlowPollMax,
	}
}

func IsRedisFlowBackendAvailable(ctx context.Context) bool {
	return common.RedisEnabled && common.RDB != nil
}

func (b *redisFlowBackend) Acquire(ctx context.Context, req AcquireRequest) (FlowGuard, *AcquireDecision, error) {
	if ctx == nil {
		ctx = context.Background()
	}
	req.Pool.Normalize()
	if req.QueueTimeoutMs <= 0 {
		req.QueueTimeoutMs = req.Pool.QueueTimeoutMs
	}
	if req.RequestID == "" {
		req.RequestID = common.GetUUID()
	}
	decision := newFlowDecision(req.Pool, false, false)
	if req.Pool.MaxContextTokens > 0 && req.ContextTokens > req.Pool.MaxContextTokens {
		decision.RejectCode = FlowDecisionRejectContextExceeded
		return nil, decision, fmt.Errorf("request context tokens %d exceeds flow pool max_context_tokens %d", req.ContextTokens, req.Pool.MaxContextTokens)
	}
	if req.Pool.MaxContextChars > 0 && req.ContextChars > req.Pool.MaxContextChars {
		decision.RejectCode = FlowDecisionRejectContextExceeded
		return nil, decision, fmt.Errorf("request context chars %d exceeds flow pool max_context_chars %d", req.ContextChars, req.Pool.MaxContextChars)
	}

	rdb, err := b.client()
	if err != nil {
		decision.RejectCode = FlowDecisionRejectBackendDisabled
		return nil, decision, err
	}

	timeout := time.Duration(req.QueueTimeoutMs) * time.Millisecond
	acquireCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	keys := redisKeysForPool(req.Pool)
	enqueued := false
	queuedAt := time.Time{}
	sequenceScore := float64(0)

	for {
		if err := acquireCtx.Err(); err != nil {
			if enqueued {
				_ = b.removeWaiting(context.Background(), rdb, keys, req.RequestID, req.UserID)
			}
			decision.RejectCode = redisAcquireContextRejectCode(ctx, acquireCtx)
			if !queuedAt.IsZero() {
				decision.WaitedMs = time.Since(queuedAt).Milliseconds()
			}
			status, statusErr := b.Status(context.Background(), req.Pool)
			if statusErr == nil {
				decision.RunningNow = status.Running
				decision.QueuedNow = status.Queued
			}
			return nil, decision, redisAcquireContextError(decision.RejectCode, err)
		}

		_ = b.cleanupExpired(acquireCtx, rdb, keys, req.Pool)
		attempt, err := b.tryAcquireOnce(acquireCtx, rdb, keys, req, enqueued, sequenceScore, queuedAt)
		if err != nil {
			if errors.Is(err, redis.TxFailedErr) {
				continue
			}
			if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
				continue
			}
			if isRedisFlowUnavailableErr(err) {
				decision.RejectCode = FlowDecisionRejectBackendDisabled
				return nil, decision, fmt.Errorf("%w: %v", ErrRedisFlowBackendUnavailable, err)
			}
			return nil, decision, err
		}
		decision.RunningNow = attempt.decision.runningNow
		decision.QueuedNow = attempt.decision.queuedNow
		decision.QueuePos = attempt.decision.queuePos

		if attempt.done {
			if attempt.decision.rejectCode != "" {
				decision.RejectCode = attempt.decision.rejectCode
				return nil, decision, redisRejectError(attempt.decision.rejectCode)
			}
			if attempt.decision.admitted {
				decision.Admitted = true
				decision.Queued = attempt.decision.queued
				decision.WaitedMs = attempt.decision.waitedMs
				return &redisFlowGuard{
					backend:   b,
					pool:      req.Pool,
					poolKey:   req.Pool.PoolKey,
					requestID: req.RequestID,
					userID:    req.UserID,
				}, decision, nil
			}
		}

		if !enqueued && attempt.decision.queued {
			enqueued = true
			queuedAt = time.Now()
			sequenceScore = attempt.decision.score
		}

		if err := sleepRedisFlowPoll(acquireCtx, b.pollDelay()); err != nil {
			continue
		}
	}
}

func (b *redisFlowBackend) Status(ctx context.Context, pool model.ChannelFlowPool) (PoolStatus, error) {
	if ctx == nil {
		ctx = context.Background()
	}
	pool.Normalize()
	rdb, err := b.client()
	if err != nil {
		return PoolStatus{}, err
	}
	keys := redisKeysForPool(pool)
	_ = b.cleanupExpired(ctx, rdb, keys, pool)

	running, err := rdb.ZCard(ctx, keys.Running).Result()
	if err != nil {
		return PoolStatus{}, redisFlowUnavailable(err)
	}
	queued, err := rdb.ZCard(ctx, keys.Waiting).Result()
	if err != nil {
		return PoolStatus{}, redisFlowUnavailable(err)
	}
	oldestWaitMs := int64(0)
	oldest, err := rdb.ZRange(ctx, keys.Waiting, 0, 0).Result()
	if err != nil && !errors.Is(err, redis.Nil) {
		return PoolStatus{}, redisFlowUnavailable(err)
	}
	if len(oldest) > 0 {
		enqueuedAt, _ := b.requestInt64(ctx, rdb, keys, oldest[0], "enqueued_at_ms")
		if enqueuedAt > 0 {
			oldestWaitMs = time.Now().UnixMilli() - enqueuedAt
		}
	}
	return PoolStatus{
		PoolKey:        pool.PoolKey,
		Name:           pool.Name,
		Backend:        pool.Backend,
		Health:         flowHealth(int(running), pool.MaxInflight, int(queued), pool.MaxQueueSize),
		ScheduleActive: pool.Enabled && pool.IsScheduleActiveAt(time.Now()),
		Running:        int(running),
		MaxInflight:    pool.MaxInflight,
		Queued:         int(queued),
		MaxQueueSize:   pool.MaxQueueSize,
		OldestWaitMs:   oldestWaitMs,
		ConfigVersion:  pool.ConfigVersion,
		WatchAttempts:  b.watchAttempts.Load(),
		TxConflicts:    b.txConflicts.Load(),
	}, nil
}

func (b *redisFlowBackend) Close(_ context.Context) error {
	return nil
}

func (b *redisFlowBackend) tryAcquireOnce(
	ctx context.Context,
	rdb *redis.Client,
	keys redisFlowKeys,
	req AcquireRequest,
	enqueued bool,
	sequenceScore float64,
	queuedAt time.Time,
) (redisAcquireAttempt, error) {
	attempt := redisAcquireAttempt{}
	watchKeys := []string{keys.Running, keys.Waiting}
	if req.UserID > 0 {
		watchKeys = append(watchKeys, keys.userWaiting(req.UserID))
		if req.Pool.MaxInflightPerUser > 0 {
			watchKeys = append(watchKeys, keys.userRunning(req.UserID))
		}
	}
	err := rdb.Watch(ctx, func(tx *redis.Tx) error {
		running, err := tx.ZCard(ctx, keys.Running).Result()
		if err != nil {
			return err
		}
		waiting, err := tx.ZCard(ctx, keys.Waiting).Result()
		if err != nil {
			return err
		}
		attempt.decision.runningNow = int(running)
		attempt.decision.queuedNow = int(waiting)

		if !enqueued {
			userInflightFull := false
			if req.Pool.MaxInflightPerUser > 0 && req.UserID > 0 {
				userRunning, err := tx.ZCard(ctx, keys.userRunning(req.UserID)).Result()
				if err != nil {
					return err
				}
				userInflightFull = userRunning >= int64(req.Pool.MaxInflightPerUser)
			}
			if redisFlowHasCapacity(running, req.Pool.MaxInflight) && waiting == 0 && !userInflightFull {
				dispatchedAt := time.Now()
				expiresAtMs := dispatchedAt.Add(redisLeaseDuration(req.Pool)).UnixMilli()
				_, err = tx.TxPipelined(ctx, func(pipe redis.Pipeliner) error {
					pipe.ZAdd(ctx, keys.Running, &redis.Z{
						Score:  float64(expiresAtMs),
						Member: req.RequestID,
					})
					if req.Pool.MaxInflightPerUser > 0 && req.UserID > 0 {
						pipe.ZAdd(ctx, keys.userRunning(req.UserID), &redis.Z{
							Score:  float64(expiresAtMs),
							Member: req.RequestID,
						})
					}
					b.writeRequestMeta(ctx, pipe, keys, req, "running", 0, dispatchedAt.UnixMilli(), expiresAtMs)
					return nil
				})
				if err == nil {
					attempt.done = true
					attempt.decision.admitted = true
					attempt.decision.runningNow = int(running) + 1
					attempt.decision.queuedNow = int(waiting)
				}
				return err
			}
			if req.Pool.OnLimit != model.ChannelFlowOnLimitQueue {
				attempt.done = true
				if userInflightFull {
					attempt.decision.rejectCode = FlowDecisionRejectPerUserInflightFull
				} else {
					attempt.decision.rejectCode = FlowDecisionRejectQueueFull
				}
				return nil
			}
			if req.Pool.MaxQueueSize > 0 && waiting >= int64(req.Pool.MaxQueueSize) {
				attempt.done = true
				attempt.decision.rejectCode = FlowDecisionRejectQueueFull
				return nil
			}
			if req.Pool.MaxQueuePerUser > 0 && req.UserID > 0 {
				userWaiting, err := tx.ZCard(ctx, keys.userWaiting(req.UserID)).Result()
				if err != nil {
					return err
				}
				if userWaiting >= int64(req.Pool.MaxQueuePerUser) {
					attempt.done = true
					attempt.decision.rejectCode = FlowDecisionRejectPerUserQueueFull
					return nil
				}
			}
			score, err := b.nextSequence(ctx, rdb, keys, sequenceScore)
			if err != nil {
				return err
			}
			enqueuedAtMs := time.Now().UnixMilli()
			deadlineMs := enqueuedAtMs + req.QueueTimeoutMs
			_, err = tx.TxPipelined(ctx, func(pipe redis.Pipeliner) error {
				pipe.ZAdd(ctx, keys.Waiting, &redis.Z{
					Score:  score,
					Member: req.RequestID,
				})
				pipe.ZAdd(ctx, keys.Deadline, &redis.Z{
					Score:  float64(deadlineMs),
					Member: req.RequestID,
				})
				if req.UserID > 0 {
					pipe.ZAdd(ctx, keys.userWaiting(req.UserID), &redis.Z{
						Score:  score,
						Member: req.RequestID,
					})
				}
				b.writeRequestMeta(ctx, pipe, keys, req, "waiting", enqueuedAtMs, 0, 0)
				return nil
			})
			if err == nil {
				attempt.decision.queued = true
				attempt.decision.score = score
				attempt.decision.queuePos = int(waiting) + 1
				attempt.decision.runningNow = int(running)
				attempt.decision.queuedNow = int(waiting) + 1
			}
			return err
		}

		rank, err := tx.ZRank(ctx, keys.Waiting, req.RequestID).Result()
		if errors.Is(err, redis.Nil) {
			attempt.done = true
			attempt.decision.rejectCode = FlowDecisionRejectQueueTimeout
			return nil
		}
		if err != nil {
			return err
		}
		attempt.decision.queuePos = int(rank) + 1
		if !redisFlowHasCapacity(running, req.Pool.MaxInflight) {
			return nil
		}
		eligible, err := b.isEligibleWaitingRequest(ctx, tx, keys, req)
		if err != nil {
			return err
		}
		if !eligible {
			return nil
		}
		if req.Pool.MaxInflightPerUser > 0 && req.UserID > 0 {
			userRunning, err := tx.ZCard(ctx, keys.userRunning(req.UserID)).Result()
			if err != nil {
				return err
			}
			if userRunning >= int64(req.Pool.MaxInflightPerUser) {
				return nil
			}
		}
		dispatchedAt := time.Now()
		expiresAtMs := dispatchedAt.Add(redisLeaseDuration(req.Pool)).UnixMilli()
		_, err = tx.TxPipelined(ctx, func(pipe redis.Pipeliner) error {
			pipe.ZRem(ctx, keys.Waiting, req.RequestID)
			pipe.ZRem(ctx, keys.Deadline, req.RequestID)
			if req.UserID > 0 {
				pipe.ZRem(ctx, keys.userWaiting(req.UserID), req.RequestID)
			}
			pipe.ZAdd(ctx, keys.Running, &redis.Z{
				Score:  float64(expiresAtMs),
				Member: req.RequestID,
			})
			if req.Pool.MaxInflightPerUser > 0 && req.UserID > 0 {
				pipe.ZAdd(ctx, keys.userRunning(req.UserID), &redis.Z{
					Score:  float64(expiresAtMs),
					Member: req.RequestID,
				})
			}
			b.writeRequestMeta(ctx, pipe, keys, req, "running", 0, dispatchedAt.UnixMilli(), expiresAtMs)
			return nil
		})
		if err == nil {
			attempt.done = true
			attempt.decision.admitted = true
			attempt.decision.queued = true
			attempt.decision.waitedMs = time.Since(queuedAt).Milliseconds()
			attempt.decision.queuePos = 0
			attempt.decision.runningNow = int(running) + 1
			attempt.decision.queuedNow = maxInt(0, int(waiting)-1)
		}
		return err
	}, watchKeys...)
	b.watchAttempts.Add(1)
	if errors.Is(err, redis.TxFailedErr) {
		b.txConflicts.Add(1)
	}
	return attempt, err
}

func (b *redisFlowBackend) isEligibleWaitingRequest(ctx context.Context, tx *redis.Tx, keys redisFlowKeys, req AcquireRequest) (bool, error) {
	for start := int64(0); ; start += redisFlowCleanupBatch {
		waiting, err := tx.ZRange(ctx, keys.Waiting, start, start+redisFlowCleanupBatch-1).Result()
		if err != nil {
			return false, err
		}
		for _, requestID := range waiting {
			userID, err := b.requestIntFromTx(ctx, tx, keys, requestID, "user_id")
			if err != nil {
				return false, err
			}
			if req.Pool.MaxInflightPerUser > 0 && userID > 0 {
				userRunning, err := tx.ZCard(ctx, keys.userRunning(userID)).Result()
				if err != nil {
					return false, err
				}
				if userRunning >= int64(req.Pool.MaxInflightPerUser) {
					continue
				}
			}
			return requestID == req.RequestID, nil
		}
		if len(waiting) < redisFlowCleanupBatch {
			break
		}
	}
	return false, nil
}

func (b *redisFlowBackend) requestIntFromTx(ctx context.Context, tx *redis.Tx, keys redisFlowKeys, requestID string, field string) (int, error) {
	value, err := tx.HGet(ctx, keys.request(requestID), field).Result()
	if errors.Is(err, redis.Nil) {
		return 0, nil
	}
	if err != nil {
		return 0, redisFlowUnavailable(err)
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return 0, nil
	}
	return parsed, nil
}

func (b *redisFlowBackend) removeWaiting(ctx context.Context, rdb *redis.Client, keys redisFlowKeys, requestID string, userID int) error {
	pipe := rdb.TxPipeline()
	pipe.ZRem(ctx, keys.Waiting, requestID)
	pipe.ZRem(ctx, keys.Deadline, requestID)
	if userID > 0 {
		pipe.ZRem(ctx, keys.userWaiting(userID), requestID)
	}
	pipe.Del(ctx, keys.request(requestID))
	_, err := pipe.Exec(ctx)
	return redisFlowUnavailable(err)
}

func (b *redisFlowBackend) release(ctx context.Context, pool model.ChannelFlowPool, requestID string, userID int) error {
	rdb, err := b.client()
	if err != nil {
		return err
	}
	keys := redisKeysForPool(pool)
	pipe := rdb.TxPipeline()
	pipe.ZRem(ctx, keys.Running, requestID)
	if pool.MaxInflightPerUser > 0 && userID > 0 {
		pipe.ZRem(ctx, keys.userRunning(userID), requestID)
	}
	pipe.Del(ctx, keys.request(requestID))
	_, err = pipe.Exec(ctx)
	return redisFlowUnavailable(err)
}

func (b *redisFlowBackend) renew(ctx context.Context, pool model.ChannelFlowPool, requestID string, userID int) error {
	rdb, err := b.client()
	if err != nil {
		return err
	}
	keys := redisKeysForPool(pool)
	exists, err := rdb.ZScore(ctx, keys.Running, requestID).Result()
	if errors.Is(err, redis.Nil) {
		return nil
	}
	if err != nil {
		return redisFlowUnavailable(err)
	}
	if exists <= 0 {
		return nil
	}
	expiresAtMs := time.Now().Add(redisLeaseDuration(pool)).UnixMilli()
	pipe := rdb.TxPipeline()
	pipe.ZAdd(ctx, keys.Running, &redis.Z{
		Score:  float64(expiresAtMs),
		Member: requestID,
	})
	if pool.MaxInflightPerUser > 0 && userID > 0 {
		pipe.ZAdd(ctx, keys.userRunning(userID), &redis.Z{
			Score:  float64(expiresAtMs),
			Member: requestID,
		})
	}
	pipe.HSet(ctx, keys.request(requestID), "expires_at_ms", strconv.FormatInt(expiresAtMs, 10))
	pipe.Expire(ctx, keys.request(requestID), redisRequestTTL(pool))
	_, err = pipe.Exec(ctx)
	return redisFlowUnavailable(err)
}

func (b *redisFlowBackend) cleanupExpired(ctx context.Context, rdb *redis.Client, keys redisFlowKeys, pool model.ChannelFlowPool) error {
	nowMs := time.Now().UnixMilli()
	for {
		expiredRunning, err := b.expiredRunningRequestIDs(ctx, rdb, keys, pool, nowMs)
		if err != nil {
			return err
		}
		if len(expiredRunning) == 0 {
			break
		}
		if err := b.removeRunningRequests(ctx, rdb, keys, pool, expiredRunning); err != nil {
			return err
		}
	}
	for {
		dirtyWaiting, err := b.dirtyWaitingRequestIDs(ctx, rdb, keys)
		if err != nil {
			return err
		}
		if len(dirtyWaiting) == 0 {
			break
		}
		if err := b.removeWaitingRequests(ctx, rdb, keys, dirtyWaiting); err != nil {
			return err
		}
	}
	for {
		expired, err := rdb.ZRangeByScore(ctx, keys.Deadline, &redis.ZRangeBy{
			Min:    "-inf",
			Max:    strconv.FormatInt(nowMs, 10),
			Offset: 0,
			Count:  redisFlowCleanupBatch,
		}).Result()
		if err != nil {
			return redisFlowUnavailable(err)
		}
		if len(expired) == 0 {
			return nil
		}
		if err := b.removeWaitingRequests(ctx, rdb, keys, expired); err != nil {
			return err
		}
	}
}

func (b *redisFlowBackend) expiredRunningRequestIDs(ctx context.Context, rdb *redis.Client, keys redisFlowKeys, pool model.ChannelFlowPool, nowMs int64) ([]string, error) {
	seen := make(map[string]struct{}, redisFlowCleanupBatch)
	expired, err := rdb.ZRangeByScore(ctx, keys.Running, &redis.ZRangeBy{
		Min:    "-inf",
		Max:    strconv.FormatInt(nowMs, 10),
		Offset: 0,
		Count:  redisFlowCleanupBatch,
	}).Result()
	if err != nil {
		return nil, redisFlowUnavailable(err)
	}
	result := make([]string, 0, redisFlowCleanupBatch)
	for _, requestID := range expired {
		if _, ok := seen[requestID]; ok {
			continue
		}
		seen[requestID] = struct{}{}
		result = append(result, requestID)
	}
	if pool.MaxProcessingMs <= 0 || len(result) >= redisFlowCleanupBatch {
		return result, nil
	}
	running, err := rdb.ZRange(ctx, keys.Running, 0, -1).Result()
	if err != nil {
		return nil, redisFlowUnavailable(err)
	}
	maxProcessingMs := pool.MaxProcessingMs
	for _, requestID := range running {
		if len(result) >= redisFlowCleanupBatch {
			break
		}
		if _, ok := seen[requestID]; ok {
			continue
		}
		dispatchedAtMs, err := b.requestInt64(ctx, rdb, keys, requestID, "dispatched_at_ms")
		if err != nil {
			return nil, err
		}
		if dispatchedAtMs > 0 && nowMs-dispatchedAtMs > maxProcessingMs {
			seen[requestID] = struct{}{}
			result = append(result, requestID)
		}
	}
	return result, nil
}

func (b *redisFlowBackend) dirtyWaitingRequestIDs(ctx context.Context, rdb *redis.Client, keys redisFlowKeys) ([]string, error) {
	waiting, err := rdb.ZRange(ctx, keys.Waiting, 0, redisFlowCleanupBatch-1).Result()
	if err != nil {
		return nil, redisFlowUnavailable(err)
	}
	dirty := make([]string, 0, len(waiting))
	for _, requestID := range waiting {
		exists, err := rdb.Exists(ctx, keys.request(requestID)).Result()
		if err != nil {
			return nil, redisFlowUnavailable(err)
		}
		if exists == 0 {
			dirty = append(dirty, requestID)
			continue
		}
		if _, err := rdb.ZScore(ctx, keys.Deadline, requestID).Result(); errors.Is(err, redis.Nil) {
			dirty = append(dirty, requestID)
		} else if err != nil {
			return nil, redisFlowUnavailable(err)
		}
	}
	return dirty, nil
}

func (b *redisFlowBackend) removeRunningRequests(ctx context.Context, rdb *redis.Client, keys redisFlowKeys, pool model.ChannelFlowPool, requestIDs []string) error {
	pipe := rdb.TxPipeline()
	for _, requestID := range requestIDs {
		pipe.ZRem(ctx, keys.Running, requestID)
		userID, _ := b.requestInt(ctx, rdb, keys, requestID, "user_id")
		if pool.MaxInflightPerUser > 0 && userID > 0 {
			pipe.ZRem(ctx, keys.userRunning(userID), requestID)
		}
		pipe.Del(ctx, keys.request(requestID))
	}
	_, err := pipe.Exec(ctx)
	return redisFlowUnavailable(err)
}

func (b *redisFlowBackend) removeWaitingRequests(ctx context.Context, rdb *redis.Client, keys redisFlowKeys, requestIDs []string) error {
	pipe := rdb.TxPipeline()
	for _, requestID := range requestIDs {
		userID, _ := b.requestInt(ctx, rdb, keys, requestID, "user_id")
		pipe.ZRem(ctx, keys.Waiting, requestID)
		pipe.ZRem(ctx, keys.Deadline, requestID)
		if userID > 0 {
			pipe.ZRem(ctx, keys.userWaiting(userID), requestID)
		}
		pipe.Del(ctx, keys.request(requestID))
	}
	_, err := pipe.Exec(ctx)
	return redisFlowUnavailable(err)
}

func (b *redisFlowBackend) nextSequence(ctx context.Context, rdb *redis.Client, keys redisFlowKeys, existing float64) (float64, error) {
	if existing > 0 {
		return existing, nil
	}
	seq, err := rdb.Incr(ctx, keys.Seq).Result()
	if err != nil {
		return 0, redisFlowUnavailable(err)
	}
	return float64(seq), nil
}

func (b *redisFlowBackend) writeRequestMeta(ctx context.Context, pipe redis.Pipeliner, keys redisFlowKeys, req AcquireRequest, state string, enqueuedAtMs int64, dispatchedAtMs int64, expiresAtMs int64) {
	data := map[string]interface{}{
		"state":          state,
		"user_id":        strconv.Itoa(req.UserID),
		"channel_id":     strconv.Itoa(req.ChannelID),
		"upstream_model": req.UpstreamModel,
	}
	if enqueuedAtMs > 0 {
		data["enqueued_at_ms"] = strconv.FormatInt(enqueuedAtMs, 10)
	}
	if dispatchedAtMs > 0 {
		data["dispatched_at_ms"] = strconv.FormatInt(dispatchedAtMs, 10)
	}
	if expiresAtMs > 0 {
		data["expires_at_ms"] = strconv.FormatInt(expiresAtMs, 10)
	}
	pipe.HSet(ctx, keys.request(req.RequestID), data)
	pipe.Expire(ctx, keys.request(req.RequestID), redisRequestTTL(req.Pool))
}

func (b *redisFlowBackend) requestInt(ctx context.Context, rdb *redis.Client, keys redisFlowKeys, requestID string, field string) (int, error) {
	value, err := b.requestInt64(ctx, rdb, keys, requestID, field)
	return int(value), err
}

func (b *redisFlowBackend) requestInt64(ctx context.Context, rdb *redis.Client, keys redisFlowKeys, requestID string, field string) (int64, error) {
	value, err := rdb.HGet(ctx, keys.request(requestID), field).Result()
	if errors.Is(err, redis.Nil) {
		return 0, nil
	}
	if err != nil {
		return 0, redisFlowUnavailable(err)
	}
	parsed, err := strconv.ParseInt(value, 10, 64)
	if err != nil {
		return 0, nil
	}
	return parsed, nil
}

func (b *redisFlowBackend) client() (*redis.Client, error) {
	if !common.RedisEnabled || common.RDB == nil {
		return nil, ErrRedisFlowBackendUnavailable
	}
	return common.RDB, nil
}

func (b *redisFlowBackend) pollDelay() time.Duration {
	window := b.pollMax - b.pollMin
	if window <= 0 {
		return b.pollMin
	}
	return b.pollMin + time.Duration(time.Now().UnixNano()%int64(window))
}

func (g *redisFlowGuard) Release(ctx context.Context) error {
	if g == nil || g.released.Swap(true) {
		return nil
	}
	if release, ok := g.releaseFunc.Load().(func()); ok && release != nil {
		release()
	}
	if ctx == nil {
		ctx = context.Background()
	}
	return g.backend.release(ctx, g.pool, g.requestID, g.userID)
}

func (g *redisFlowGuard) RenewLease(ctx context.Context) error {
	if g == nil || g.released.Load() {
		return nil
	}
	if ctx == nil {
		ctx = context.Background()
	}
	return g.backend.renew(ctx, g.pool, g.requestID, g.userID)
}

func (g *redisFlowGuard) PoolKey() string {
	if g == nil {
		return ""
	}
	return g.poolKey
}

func (g *redisFlowGuard) RequestID() string {
	if g == nil {
		return ""
	}
	return g.requestID
}

func (g *redisFlowGuard) IsReleased() bool {
	return g == nil || g.released.Load()
}

func (g *redisFlowGuard) BindRelease(release func()) {
	if g == nil || release == nil {
		return
	}
	g.releaseFunc.Store(release)
}

func (g *redisFlowGuard) WrapReadCloser(rc io.ReadCloser) io.ReadCloser {
	if rc == nil {
		return nil
	}
	return &flowReadCloser{ReadCloser: rc, guard: g}
}

func redisKeysForPool(pool model.ChannelFlowPool) redisFlowKeys {
	base := fmt.Sprintf("%s:%s", redisFlowNamespace, pool.PoolKey)
	return redisFlowKeys{
		Base:     base,
		Running:  base + ":running",
		Waiting:  base + ":waiting",
		Deadline: base + ":deadline",
		Seq:      base + ":seq",
	}
}

func (k redisFlowKeys) request(requestID string) string {
	return k.Base + ":request:" + requestID
}

func (k redisFlowKeys) userWaiting(userID int) string {
	return fmt.Sprintf("%s:user:%d:waiting", k.Base, userID)
}

func (k redisFlowKeys) userRunning(userID int) string {
	return fmt.Sprintf("%s:user:%d:running", k.Base, userID)
}

func redisFlowHasCapacity(running int64, maxInflight int) bool {
	return maxInflight <= 0 || running < int64(maxInflight)
}

func redisLeaseDuration(pool model.ChannelFlowPool) time.Duration {
	pool.Normalize()
	return time.Duration(pool.LeaseMs) * time.Millisecond
}

func redisRequestTTL(pool model.ChannelFlowPool) time.Duration {
	pool.Normalize()
	ttl := time.Duration(pool.QueueTimeoutMs)*time.Millisecond + redisLeaseDuration(pool) + redisFlowRequestTTLExtra
	if pool.MaxProcessingMs > 0 {
		ttl += time.Duration(pool.MaxProcessingMs) * time.Millisecond
	}
	if ttl < 5*time.Minute {
		return 5 * time.Minute
	}
	return ttl
}

func sleepRedisFlowPoll(ctx context.Context, delay time.Duration) error {
	timer := time.NewTimer(delay)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}

func redisAcquireContextRejectCode(parent context.Context, acquireCtx context.Context) string {
	if parent != nil && parent.Err() != nil {
		return FlowDecisionRejectClientCancelled
	}
	if acquireCtx != nil && errors.Is(acquireCtx.Err(), context.Canceled) {
		return FlowDecisionRejectClientCancelled
	}
	return FlowDecisionRejectQueueTimeout
}

func redisAcquireContextError(rejectCode string, err error) error {
	if rejectCode == FlowDecisionRejectClientCancelled {
		return err
	}
	return fmt.Errorf("channel flow queue timeout")
}

func redisRejectError(code string) error {
	switch code {
	case FlowDecisionRejectClientCancelled:
		return context.Canceled
	case FlowDecisionRejectPerUserInflightFull:
		return fmt.Errorf("channel flow per-user inflight limit reached")
	case FlowDecisionRejectPerUserQueueFull:
		return fmt.Errorf("channel flow per-user queue is full")
	case FlowDecisionRejectQueueTimeout:
		return fmt.Errorf("channel flow queue timeout")
	default:
		return fmt.Errorf("channel flow queue is full")
	}
}

func redisFlowUnavailable(err error) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, redis.Nil) {
		return nil
	}
	if errors.Is(err, ErrRedisFlowBackendUnavailable) {
		return err
	}
	return fmt.Errorf("%w: %v", ErrRedisFlowBackendUnavailable, err)
}

func isRedisFlowUnavailableErr(err error) bool {
	return errors.Is(redisFlowUnavailable(err), ErrRedisFlowBackendUnavailable)
}

func maxInt(left int, right int) int {
	if left > right {
		return left
	}
	return right
}
