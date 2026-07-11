package modelroute

import (
	"sync"
	"time"

	"github.com/QuantumNous/new-api/model"
)

// now is overridable for deterministic tests.
var now = time.Now

// RuntimeRoleStore holds process-local RouteRole per MetricsKey (PRD §8.2 — not persisted).
type RuntimeRoleStore struct {
	mu    sync.RWMutex
	roles map[string]model.RouteRole
}

// GlobalRoles is the process-local role map.
var GlobalRoles = &RuntimeRoleStore{roles: make(map[string]model.RouteRole)}

func (s *RuntimeRoleStore) Get(mk model.MetricsKey) model.RouteRole {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if r, ok := s.roles[mk.String()]; ok {
		return r
	}
	return model.RoleNone
}

func (s *RuntimeRoleStore) Set(mk model.MetricsKey, role model.RouteRole) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if role == model.RoleNone {
		delete(s.roles, mk.String())
		return
	}
	s.roles[mk.String()] = role
}

func (s *RuntimeRoleStore) Clear() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.roles = make(map[string]model.RouteRole)
}

// RuntimeMetricsCache holds hot metrics copies for state transitions without always hitting DB.
type RuntimeMetricsCache struct {
	mu   sync.RWMutex
	data map[string]*model.ChannelModelMetrics
	// recent temporary failures window per key (timestamps unix nano)
	failWindow map[string][]int64
}

// GlobalMetricsRuntime is the process-local metrics overlay.
var GlobalMetricsRuntime = &RuntimeMetricsCache{
	data:       make(map[string]*model.ChannelModelMetrics),
	failWindow: make(map[string][]int64),
}

func (c *RuntimeMetricsCache) Get(mk model.MetricsKey) *model.ChannelModelMetrics {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.data[mk.String()]
}

func (c *RuntimeMetricsCache) Put(m *model.ChannelModelMetrics) {
	if m == nil {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	// shallow copy pointer store; callers own mutation under external discipline
	c.data[m.MetricsKey().String()] = m
}

func (c *RuntimeMetricsCache) Clear() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.data = make(map[string]*model.ChannelModelMetrics)
	c.failWindow = make(map[string][]int64)
}

func (c *RuntimeMetricsCache) recordTempFailure(mk model.MetricsKey) {
	c.mu.Lock()
	defer c.mu.Unlock()
	k := mk.String()
	ts := now().UnixNano()
	w := append(c.failWindow[k], ts)
	// keep last window_size
	if len(w) > model.DefaultTemporaryFailureWindowSize {
		w = w[len(w)-model.DefaultTemporaryFailureWindowSize:]
	}
	c.failWindow[k] = w
}

func (c *RuntimeMetricsCache) clearFailWindow(mk model.MetricsKey) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.failWindow, mk.String())
}

func (c *RuntimeMetricsCache) tempFailuresInWindow(mk model.MetricsKey) int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return len(c.failWindow[mk.String()])
}

// LoadOrEnsureMetrics loads DB row into runtime cache.
func LoadOrEnsureMetrics(channelID int64, effectiveModel string) (*model.ChannelModelMetrics, error) {
	mk := MakeMetricsKey(channelID, effectiveModel)
	if m := GlobalMetricsRuntime.Get(mk); m != nil {
		return m, nil
	}
	m, err := model.EnsureChannelModelMetrics(channelID, effectiveModel)
	if err != nil {
		return nil, err
	}
	GlobalMetricsRuntime.Put(m)
	return m, nil
}

// TransitionEvent drives the RouteState machine (PRD §8.1 / §24 / §25 / §26).
type TransitionEvent string

const (
	EventProductionSuccess TransitionEvent = "production_success"
	EventRateLimited       TransitionEvent = "rate_limited"
	EventDeterministicFail TransitionEvent = "deterministic_fail"
	EventTemporaryFail     TransitionEvent = "temporary_fail"
	EventProbeSuccess      TransitionEvent = "probe_success"
	EventProbeFail         TransitionEvent = "probe_fail"
	EventCooldownElapsed    TransitionEvent = "cooldown_elapsed"
	EventManualDisable     TransitionEvent = "manual_disable"
	EventRestoreAuto       TransitionEvent = "restore_auto"
	EventForceProbe        TransitionEvent = "force_probe"
	EventTripOpen          TransitionEvent = "trip_open"
)

// ApplyTransition mutates metrics state according to PRD rules. Returns true if state changed.
func ApplyTransition(m *model.ChannelModelMetrics, event TransitionEvent, retryAfterSec int) bool {
	if m == nil {
		return false
	}
	before := m.State()
	mk := m.MetricsKey()
	ts := now().Unix()

	switch event {
	case EventManualDisable:
		m.SetState(model.RouteManuallyDisabled)
		m.SetCooldownUntil(time.Time{})
		GlobalRoles.Set(mk, model.RoleNone)

	case EventRestoreAuto:
		if before == model.RouteManuallyDisabled {
			m.SetState(model.RouteProbing)
			m.BackoffLevel = 0
			m.SetCooldownUntil(time.Time{})
		}

	case EventForceProbe:
		if before != model.RouteManuallyDisabled {
			m.SetState(model.RouteProbing)
			m.SetCooldownUntil(time.Time{})
		}

	case EventCooldownElapsed:
		if before == model.RouteRateLimited || before == model.RouteOpen {
			m.SetState(model.RouteProbing)
			m.SetCooldownUntil(time.Time{})
		}

	case EventRateLimited:
		m.SetLastErrorClass(model.ErrorTemporary)
		m.SetState(model.RouteRateLimited)
		m.LastFailureAt = &ts
		level := m.BackoffLevel
		if level < 0 {
			level = 0
		}
		if level >= len(model.DefaultRateLimitBackoffSeconds) {
			level = len(model.DefaultRateLimitBackoffSeconds) - 1
		}
		cd := model.DefaultRateLimitBackoffSeconds[level]
		if retryAfterSec > 0 {
			cd = retryAfterSec
		}
		m.SetCooldownUntil(now().Add(time.Duration(cd) * time.Second))
		if m.BackoffLevel < len(model.DefaultRateLimitBackoffSeconds)-1 {
			m.BackoffLevel++
		}
		GlobalRoles.Set(mk, model.RoleNone)
		// bump rate limit ema later in metrics package; mark sample
		m.ConsecutiveFailures++

	case EventDeterministicFail:
		m.SetLastErrorClass(model.ErrorDeterministic)
		openCircuit(m, 0)
		GlobalRoles.Set(mk, model.RoleNone)

	case EventTemporaryFail:
		m.SetLastErrorClass(model.ErrorTemporary)
		m.ConsecutiveFailures++
		m.LastFailureAt = &ts
		GlobalMetricsRuntime.recordTempFailure(mk)
		if shouldOpenOnTemporary(m) {
			openCircuit(m, 0)
			GlobalRoles.Set(mk, model.RoleNone)
		}

	case EventTripOpen:
		openCircuit(m, 0)
		GlobalRoles.Set(mk, model.RoleNone)

	case EventProbeSuccess:
		m.LastProbeAt = &ts
		m.LastSuccessAt = &ts
		switch before {
		case model.RouteProbing, model.RouteOpen, model.RouteRateLimited, model.RouteUnknown:
			m.SetState(model.RouteRecovering)
			m.RecoverSuccessCount = 1
			m.ConsecutiveFailures = 0
			m.SetCooldownUntil(time.Time{})
		case model.RouteRecovering:
			m.RecoverSuccessCount++
			if m.RecoverSuccessCount >= model.DefaultRecoverSuccessThreshold {
				m.SetState(model.RouteHealthy)
				m.BackoffLevel = 0
				m.RecoverSuccessCount = 0
				GlobalMetricsRuntime.clearFailWindow(mk)
			}
		}

	case EventProbeFail:
		m.LastProbeAt = &ts
		m.LastFailureAt = &ts
		// stay PROBING or re-open with higher backoff depending on error class set by caller
		if m.GetLastErrorClass() == model.ErrorDeterministic {
			openCircuit(m, 0)
		} else if before == model.RouteProbing || before == model.RouteRecovering {
			// temporary probe fail: return to OPEN with next backoff
			openCircuit(m, m.BackoffLevel)
		}

	case EventProductionSuccess:
		m.LastSuccessAt = &ts
		m.LastRequestAt = &ts
		m.ConsecutiveFailures = 0
		GlobalMetricsRuntime.clearFailWindow(mk)
		switch before {
		case model.RouteUnknown, model.RouteProbing:
			m.SetState(model.RouteHealthy)
			m.BackoffLevel = 0
			m.RecoverSuccessCount = 0
		case model.RouteRecovering:
			m.RecoverSuccessCount++
			if m.RecoverSuccessCount >= model.DefaultRecoverSuccessThreshold {
				m.SetState(model.RouteHealthy)
				m.BackoffLevel = 0
				m.RecoverSuccessCount = 0
			}
		case model.RouteHealthy:
			// stay
		}
	}

	after := m.State()
	if after != before {
		m.UpdatedAt = now().Unix()
		GlobalMetricsRuntime.Put(m)
		return true
	}
	GlobalMetricsRuntime.Put(m)
	return false
}

func openCircuit(m *model.ChannelModelMetrics, levelHint int) {
	m.SetState(model.RouteOpen)
	level := levelHint
	if level <= 0 {
		level = m.BackoffLevel
	}
	if level < 0 {
		level = 0
	}
	if level >= len(model.DefaultOpenBackoffSeconds) {
		level = len(model.DefaultOpenBackoffSeconds) - 1
	}
	cd := model.DefaultOpenBackoffSeconds[level]
	m.SetCooldownUntil(now().Add(time.Duration(cd) * time.Second))
	if m.BackoffLevel < len(model.DefaultOpenBackoffSeconds)-1 {
		m.BackoffLevel = level + 1
	} else {
		m.BackoffLevel = level
	}
	ts := now().Unix()
	m.LastFailureAt = &ts
}

func shouldOpenOnTemporary(m *model.ChannelModelMetrics) bool {
	if m.ConsecutiveFailures >= model.DefaultTemporaryFailureConsecutive {
		return true
	}
	return GlobalMetricsRuntime.tempFailuresInWindow(m.MetricsKey()) >= model.DefaultTemporaryFailureWindowThresh
}

// MaybeAdvanceCooldown moves RATE_LIMITED/OPEN → PROBING when cooldown elapsed (PRD §26).
func MaybeAdvanceCooldown(m *model.ChannelModelMetrics) bool {
	if m == nil {
		return false
	}
	st := m.State()
	if st != model.RouteRateLimited && st != model.RouteOpen {
		return false
	}
	until := m.CooldownUntilTime()
	if until.IsZero() || !now().Before(until) {
		return ApplyTransition(m, EventCooldownElapsed, 0)
	}
	return false
}

// ClassifyHTTPStatus maps status to ErrorClass / events (PRD §24 / §25).
func ClassifyHTTPStatus(status int) (model.ErrorClass, TransitionEvent) {
	switch {
	case status == 429:
		return model.ErrorTemporary, EventRateLimited
	case status == 401 || status == 403 || status == 404:
		return model.ErrorDeterministic, EventDeterministicFail
	case status >= 500:
		return model.ErrorTemporary, EventTemporaryFail
	case status >= 400:
		// other 4xx: treat deterministic (model/protocol issues)
		return model.ErrorDeterministic, EventDeterministicFail
	default:
		return "", EventProductionSuccess
	}
}

// IsProductiveState reports whether state may serve production traffic.
func IsProductiveState(s model.RouteState) bool {
	switch s {
	case model.RouteHealthy, model.RouteRecovering, model.RouteUnknown:
		return true
	default:
		return false
	}
}

// IsInCooldown reports cooldown still active.
func IsInCooldown(m *model.ChannelModelMetrics) bool {
	if m == nil {
		return false
	}
	until := m.CooldownUntilTime()
	return !until.IsZero() && now().Before(until)
}
