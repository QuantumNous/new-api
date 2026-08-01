package service

import (
	"context"
	_ "embed"
	"errors"
	"fmt"
	"strconv"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
)

const (
	channelAdmissionNamespace       = "new-api:channel_admission:v1"
	channelAdmissionRPMWindow       = time.Minute
	channelAdmissionLeaseTTL        = 2 * time.Minute
	channelAdmissionBackendTimeout  = 3 * time.Second
	channelAdmissionFallbackLogRate = time.Minute
	channelAdmissionLeaseContextKey = "channel_admission_lease"
)

//go:embed lua/channel_admission_acquire.lua
var channelAdmissionAcquireLua string

//go:embed lua/channel_admission_renew.lua
var channelAdmissionRenewLua string

//go:embed lua/channel_admission_release.lua
var channelAdmissionReleaseLua string

//go:embed lua/channel_admission_snapshot.lua
var channelAdmissionSnapshotLua string

var (
	channelAdmissionAcquireScript  = redis.NewScript(channelAdmissionAcquireLua)
	channelAdmissionRenewScript    = redis.NewScript(channelAdmissionRenewLua)
	channelAdmissionReleaseScript  = redis.NewScript(channelAdmissionReleaseLua)
	channelAdmissionSnapshotScript = redis.NewScript(channelAdmissionSnapshotLua)
)

type ChannelAdmissionMode string

const (
	ChannelAdmissionModeDisabled       ChannelAdmissionMode = "disabled"
	ChannelAdmissionModeRedis          ChannelAdmissionMode = "redis"
	ChannelAdmissionModeMemory         ChannelAdmissionMode = "memory"
	ChannelAdmissionModeMemoryFallback ChannelAdmissionMode = "memory_fallback"
)

type ChannelAdmissionReason string

const (
	ChannelAdmissionReasonConcurrency ChannelAdmissionReason = "concurrency"
	ChannelAdmissionReasonRPM         ChannelAdmissionReason = "rpm"
)

type ChannelAdmissionDecision struct {
	Allowed            bool
	Reason             ChannelAdmissionReason
	RetryAfter         time.Duration
	Mode               ChannelAdmissionMode
	CurrentConcurrency int
	CurrentRPM         int
}

type ChannelAdmissionSnapshot struct {
	Mode               ChannelAdmissionMode `json:"mode"`
	CurrentConcurrency int                  `json:"current_concurrency"`
	MaxConcurrency     int                  `json:"max_concurrency"`
	CurrentRPM         int                  `json:"current_rpm"`
	RPMLimit           int                  `json:"rpm_limit"`
}

type memoryRPMAdmission struct {
	leaseID   string
	startedAt time.Time
}

type memoryChannelAdmissionState struct {
	mu             sync.Mutex
	concurrencyIDs map[string]struct{}
	rpmAdmissions  []memoryRPMAdmission
}

// pruneRPM removes expired rolling-window admissions. The caller must hold s.mu.
func (s *memoryChannelAdmissionState) pruneRPM(cutoff time.Time) {
	firstActive := 0
	for firstActive < len(s.rpmAdmissions) && !s.rpmAdmissions[firstActive].startedAt.After(cutoff) {
		firstActive++
	}
	if firstActive > 0 {
		s.rpmAdmissions = append([]memoryRPMAdmission(nil), s.rpmAdmissions[firstActive:]...)
	}
}

type channelAdmissionManager struct {
	redisClient    func() *redis.Client
	redisEnabled   func() bool
	now            func() time.Time
	leaseTTL       time.Duration
	rpmWindow      time.Duration
	renewLeases    bool
	memoryStates   sync.Map
	lastFallbackAt atomic.Int64
}

var defaultChannelAdmissionManager = &channelAdmissionManager{
	redisClient:  func() *redis.Client { return common.RDB },
	redisEnabled: func() bool { return common.RedisEnabled && common.RDB != nil },
	now:          time.Now,
	leaseTTL:     channelAdmissionLeaseTTL,
	rpmWindow:    channelAdmissionRPMWindow,
	renewLeases:  true,
}

type ChannelAdmissionLease struct {
	manager           *channelAdmissionManager
	channelID         int
	leaseID           string
	mode              ChannelAdmissionMode
	redisClient       *redis.Client
	tracksConcurrency bool
	tracksRPM         bool
	renewalDone       chan struct{}
	mu                sync.Mutex
	renewalStopped    bool
	committed         bool
	released          bool
}

func (l *ChannelAdmissionLease) ChannelID() int {
	if l == nil {
		return 0
	}
	return l.channelID
}

func (l *ChannelAdmissionLease) Mode() ChannelAdmissionMode {
	if l == nil {
		return ChannelAdmissionModeDisabled
	}
	return l.mode
}

// Commit marks the admission as an upstream attempt. Once committed, releasing
// the lease never refunds its rolling-window RPM entry.
func (l *ChannelAdmissionLease) Commit() {
	if l == nil {
		return
	}
	l.mu.Lock()
	l.committed = true
	l.mu.Unlock()
}

func (l *ChannelAdmissionLease) Release() error {
	if l == nil {
		return nil
	}

	l.mu.Lock()
	defer l.mu.Unlock()
	if l.released {
		return nil
	}
	if !l.renewalStopped {
		close(l.renewalDone)
		l.renewalStopped = true
	}
	rollbackRPM := l.tracksRPM && !l.committed
	if !l.tracksConcurrency && !rollbackRPM {
		l.released = true
		return nil
	}

	switch l.mode {
	case ChannelAdmissionModeRedis:
		ctx, cancel := context.WithTimeout(context.Background(), channelAdmissionBackendTimeout)
		defer cancel()
		rollbackValue := 0
		if rollbackRPM {
			rollbackValue = 1
		}
		if err := channelAdmissionReleaseScript.Run(
			ctx,
			l.redisClient,
			[]string{channelAdmissionConcurrencyKey(l.channelID), channelAdmissionRPMKey(l.channelID)},
			l.leaseID,
			rollbackValue,
		).Err(); err != nil {
			return fmt.Errorf("release channel admission lease: %w", err)
		}
	case ChannelAdmissionModeMemory, ChannelAdmissionModeMemoryFallback:
		state := l.manager.memoryState(l.channelID)
		state.mu.Lock()
		if l.tracksConcurrency {
			delete(state.concurrencyIDs, l.leaseID)
		}
		if rollbackRPM {
			for index, admission := range state.rpmAdmissions {
				if admission.leaseID == l.leaseID {
					state.rpmAdmissions = append(state.rpmAdmissions[:index], state.rpmAdmissions[index+1:]...)
					break
				}
			}
		}
		state.mu.Unlock()
	}
	l.released = true
	return nil
}

func AcquireChannelAdmission(ctx context.Context, channel *model.Channel) (*ChannelAdmissionLease, ChannelAdmissionDecision, error) {
	if channel == nil || channel.Id <= 0 {
		return nil, ChannelAdmissionDecision{}, errors.New("channel admission requires a persisted channel")
	}
	settings := channel.GetSetting()
	if err := settings.ValidateAdmissionLimits(); err != nil {
		return nil, ChannelAdmissionDecision{}, err
	}
	return defaultChannelAdmissionManager.acquire(ctx, channel.Id, settings.MaxConcurrency, settings.RPMLimit)
}

func GetChannelAdmissionSnapshot(ctx context.Context, channel *model.Channel) (ChannelAdmissionSnapshot, error) {
	if channel == nil || channel.Id <= 0 {
		return ChannelAdmissionSnapshot{}, errors.New("channel admission snapshot requires a persisted channel")
	}
	settings := channel.GetSetting()
	if err := settings.ValidateAdmissionLimits(); err != nil {
		return ChannelAdmissionSnapshot{}, err
	}
	return defaultChannelAdmissionManager.snapshot(ctx, channel.Id, settings.MaxConcurrency, settings.RPMLimit)
}

func SetChannelAdmissionLease(c *gin.Context, lease *ChannelAdmissionLease) {
	if c == nil || lease == nil {
		return
	}
	c.Set(channelAdmissionLeaseContextKey, lease)
}

func GetChannelAdmissionLease(c *gin.Context) *ChannelAdmissionLease {
	if c == nil {
		return nil
	}
	value, exists := c.Get(channelAdmissionLeaseContextKey)
	if !exists {
		return nil
	}
	lease, _ := value.(*ChannelAdmissionLease)
	return lease
}

func (m *channelAdmissionManager) acquire(ctx context.Context, channelID int, maxConcurrency int, rpmLimit int) (*ChannelAdmissionLease, ChannelAdmissionDecision, error) {
	if maxConcurrency <= 0 && rpmLimit <= 0 {
		return nil, ChannelAdmissionDecision{Allowed: true, Mode: ChannelAdmissionModeDisabled}, nil
	}
	if ctx == nil {
		ctx = context.Background()
	}

	if m.redisEnabled != nil && m.redisEnabled() {
		client := m.redisClient()
		lease, decision, err := m.acquireRedis(ctx, client, channelID, maxConcurrency, rpmLimit)
		if err == nil {
			return lease, decision, nil
		}
		if ctx.Err() != nil {
			return nil, ChannelAdmissionDecision{}, ctx.Err()
		}
		m.logMemoryFallback(ctx, err)
		return m.acquireMemory(channelID, maxConcurrency, rpmLimit, ChannelAdmissionModeMemoryFallback)
	}
	return m.acquireMemory(channelID, maxConcurrency, rpmLimit, ChannelAdmissionModeMemory)
}

func (m *channelAdmissionManager) acquireRedis(ctx context.Context, client *redis.Client, channelID int, maxConcurrency int, rpmLimit int) (*ChannelAdmissionLease, ChannelAdmissionDecision, error) {
	if client == nil {
		return nil, ChannelAdmissionDecision{}, errors.New("Redis client is not initialized")
	}
	leaseID := common.GetUUID()
	values, err := channelAdmissionAcquireScript.Run(
		ctx,
		client,
		[]string{channelAdmissionConcurrencyKey(channelID), channelAdmissionRPMKey(channelID)},
		maxConcurrency,
		rpmLimit,
		leaseID,
		m.leaseTTL.Milliseconds(),
		m.rpmWindow.Milliseconds(),
	).Slice()
	if err != nil {
		return nil, ChannelAdmissionDecision{}, err
	}
	if len(values) != 5 {
		return nil, ChannelAdmissionDecision{}, fmt.Errorf("unexpected channel admission reply length %d", len(values))
	}

	allowed, err := redisAdmissionInteger(values[0])
	if err != nil {
		return nil, ChannelAdmissionDecision{}, err
	}
	reasonValue, err := redisAdmissionInteger(values[1])
	if err != nil {
		return nil, ChannelAdmissionDecision{}, err
	}
	concurrencyUsed, err := redisAdmissionInteger(values[2])
	if err != nil {
		return nil, ChannelAdmissionDecision{}, err
	}
	rpmUsed, err := redisAdmissionInteger(values[3])
	if err != nil {
		return nil, ChannelAdmissionDecision{}, err
	}
	retryAfterSeconds, err := redisAdmissionInteger(values[4])
	if err != nil {
		return nil, ChannelAdmissionDecision{}, err
	}

	decision := ChannelAdmissionDecision{
		Allowed:            allowed == 1,
		Mode:               ChannelAdmissionModeRedis,
		CurrentConcurrency: int(concurrencyUsed),
		CurrentRPM:         int(rpmUsed),
		RetryAfter:         time.Duration(retryAfterSeconds) * time.Second,
	}
	if !decision.Allowed {
		if reasonValue == 1 {
			decision.Reason = ChannelAdmissionReasonConcurrency
		} else {
			decision.Reason = ChannelAdmissionReasonRPM
		}
		return nil, decision, nil
	}

	lease := &ChannelAdmissionLease{
		manager:           m,
		channelID:         channelID,
		leaseID:           leaseID,
		mode:              ChannelAdmissionModeRedis,
		redisClient:       client,
		tracksConcurrency: maxConcurrency > 0,
		tracksRPM:         rpmLimit > 0,
		renewalDone:       make(chan struct{}),
	}
	if lease.tracksConcurrency && m.renewLeases {
		go lease.renewRedisLoop()
	}
	return lease, decision, nil
}

func (m *channelAdmissionManager) acquireMemory(channelID int, maxConcurrency int, rpmLimit int, mode ChannelAdmissionMode) (*ChannelAdmissionLease, ChannelAdmissionDecision, error) {
	state := m.memoryState(channelID)
	now := m.now()
	state.mu.Lock()
	defer state.mu.Unlock()

	state.pruneRPM(now.Add(-m.rpmWindow))

	decision := ChannelAdmissionDecision{
		Allowed:            false,
		Mode:               mode,
		CurrentConcurrency: len(state.concurrencyIDs),
		CurrentRPM:         len(state.rpmAdmissions),
	}
	if maxConcurrency > 0 && len(state.concurrencyIDs) >= maxConcurrency {
		decision.Reason = ChannelAdmissionReasonConcurrency
		decision.RetryAfter = time.Second
		return nil, decision, nil
	}
	if rpmLimit > 0 && len(state.rpmAdmissions) >= rpmLimit {
		decision.Reason = ChannelAdmissionReasonRPM
		decision.RetryAfter = state.rpmAdmissions[0].startedAt.Add(m.rpmWindow).Sub(now)
		if decision.RetryAfter < time.Second {
			decision.RetryAfter = time.Second
		}
		return nil, decision, nil
	}

	leaseID := common.GetUUID()
	if maxConcurrency > 0 {
		state.concurrencyIDs[leaseID] = struct{}{}
		decision.CurrentConcurrency++
	}
	if rpmLimit > 0 {
		state.rpmAdmissions = append(state.rpmAdmissions, memoryRPMAdmission{leaseID: leaseID, startedAt: now})
		decision.CurrentRPM++
	}
	decision.Allowed = true
	lease := &ChannelAdmissionLease{
		manager:           m,
		channelID:         channelID,
		leaseID:           leaseID,
		mode:              mode,
		tracksConcurrency: maxConcurrency > 0,
		tracksRPM:         rpmLimit > 0,
		renewalDone:       make(chan struct{}),
	}
	return lease, decision, nil
}

func (m *channelAdmissionManager) snapshot(ctx context.Context, channelID int, maxConcurrency int, rpmLimit int) (ChannelAdmissionSnapshot, error) {
	snapshot := ChannelAdmissionSnapshot{MaxConcurrency: maxConcurrency, RPMLimit: rpmLimit}
	if maxConcurrency <= 0 && rpmLimit <= 0 {
		snapshot.Mode = ChannelAdmissionModeDisabled
		return snapshot, nil
	}
	if ctx == nil {
		ctx = context.Background()
	}
	if m.redisEnabled != nil && m.redisEnabled() {
		client := m.redisClient()
		var values []interface{}
		var err error
		if client == nil {
			err = errors.New("Redis client is not initialized")
		} else {
			values, err = channelAdmissionSnapshotScript.Run(
				ctx,
				client,
				[]string{channelAdmissionConcurrencyKey(channelID), channelAdmissionRPMKey(channelID)},
				maxConcurrency,
				rpmLimit,
				m.rpmWindow.Milliseconds(),
			).Slice()
		}
		if err == nil && len(values) != 2 {
			err = fmt.Errorf("unexpected channel admission snapshot reply length %d", len(values))
		}
		if err == nil {
			concurrencyUsed, concurrencyErr := redisAdmissionInteger(values[0])
			rpmUsed, rpmErr := redisAdmissionInteger(values[1])
			if concurrencyErr == nil && rpmErr == nil {
				snapshot.Mode = ChannelAdmissionModeRedis
				snapshot.CurrentConcurrency = int(concurrencyUsed)
				snapshot.CurrentRPM = int(rpmUsed)
				return snapshot, nil
			}
			err = errors.Join(concurrencyErr, rpmErr)
		}
		if ctx.Err() != nil {
			return ChannelAdmissionSnapshot{}, ctx.Err()
		}
		m.logMemoryFallback(ctx, err)
		snapshot.Mode = ChannelAdmissionModeMemoryFallback
	} else {
		snapshot.Mode = ChannelAdmissionModeMemory
	}

	state := m.memoryState(channelID)
	now := m.now()
	state.mu.Lock()
	defer state.mu.Unlock()
	state.pruneRPM(now.Add(-m.rpmWindow))
	snapshot.CurrentConcurrency = len(state.concurrencyIDs)
	snapshot.CurrentRPM = len(state.rpmAdmissions)
	return snapshot, nil
}

func (m *channelAdmissionManager) memoryState(channelID int) *memoryChannelAdmissionState {
	state := &memoryChannelAdmissionState{concurrencyIDs: make(map[string]struct{})}
	actual, _ := m.memoryStates.LoadOrStore(channelID, state)
	return actual.(*memoryChannelAdmissionState)
}

func (m *channelAdmissionManager) logMemoryFallback(ctx context.Context, err error) {
	now := m.now().Unix()
	last := m.lastFallbackAt.Load()
	if last != 0 && now-last < int64(channelAdmissionFallbackLogRate/time.Second) {
		return
	}
	if m.lastFallbackAt.CompareAndSwap(last, now) {
		logger.LogWarn(ctx, fmt.Sprintf("channel admission Redis unavailable; using per-process fallback: %v", err))
	}
}

func (l *ChannelAdmissionLease) renewRedisLoop() {
	interval := l.manager.leaseTTL / 3
	if interval <= 0 {
		interval = time.Second
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-l.renewalDone:
			return
		case <-ticker.C:
			renewed, err := l.renewRedis()
			if err != nil {
				logger.LogWarn(context.Background(), fmt.Sprintf("renew channel admission lease failed: channel_id=%d error=%v", l.channelID, err))
				continue
			}
			if !renewed {
				logger.LogWarn(context.Background(), fmt.Sprintf("channel admission lease expired before renewal: channel_id=%d", l.channelID))
				return
			}
		}
	}
}

func (l *ChannelAdmissionLease) renewRedis() (bool, error) {
	if l == nil || !l.tracksConcurrency || l.mode != ChannelAdmissionModeRedis {
		return false, nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), channelAdmissionBackendTimeout)
	defer cancel()
	result, err := channelAdmissionRenewScript.Run(
		ctx,
		l.redisClient,
		[]string{channelAdmissionConcurrencyKey(l.channelID)},
		l.leaseID,
		l.manager.leaseTTL.Milliseconds(),
	).Int64()
	if err != nil {
		return false, err
	}
	return result == 1, nil
}

func channelAdmissionConcurrencyKey(channelID int) string {
	return fmt.Sprintf("%s:{channel:%d}:concurrency", channelAdmissionNamespace, channelID)
}

func channelAdmissionRPMKey(channelID int) string {
	return fmt.Sprintf("%s:{channel:%d}:rpm", channelAdmissionNamespace, channelID)
}

func redisAdmissionInteger(value interface{}) (int64, error) {
	switch typed := value.(type) {
	case int64:
		return typed, nil
	case string:
		return strconv.ParseInt(typed, 10, 64)
	case []byte:
		return strconv.ParseInt(string(typed), 10, 64)
	default:
		return 0, fmt.Errorf("unexpected Redis integer reply type %T", value)
	}
}
