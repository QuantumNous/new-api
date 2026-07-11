package modelroute

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/model"
)

// Emergency errors (PRD §28 / §29).
var (
	ErrEmergencyTimeout   = errors.New("emergency: waiter or leader deadline exceeded")
	ErrEmergencyExhausted = errors.New("emergency: all candidates failed")
	ErrAllChannelsBusy    = errors.New("all channels busy")
)

// EmergencyRank scores recovery likelihood (PRD §28.1). Lower is better.
func EmergencyRank(m *model.ChannelModelMetrics, at time.Time) int {
	if m == nil {
		return 999
	}
	st := m.State()
	switch st {
	case model.RouteRateLimited:
		until := m.CooldownUntilTime()
		if until.IsZero() || !until.After(at) {
			return 1
		}
		if until.Sub(at) <= 2*time.Second {
			return 3
		}
		return 50
	case model.RouteUnknown:
		return 2
	case model.RouteOpen:
		if m.GetLastErrorClass() == model.ErrorDeterministic {
			return 100
		}
		if m.GetLastErrorClass() == model.ErrorTemporary {
			return 4
		}
		return 20
	case model.RouteProbing, model.RouteRecovering, model.RouteHealthy:
		return 5
	case model.RouteManuallyDisabled:
		return 1000
	default:
		return 999
	}
}

// EmergencyCandidate is a ranked emergency try target.
type EmergencyCandidate struct {
	Candidate model.ResolvedRouteCandidate
	Rank      int
}

// BuildEmergencyCandidates ranks routes for emergency (PRD §28.1).
func BuildEmergencyCandidates(all []model.ResolvedRouteCandidate, allowDeterministic bool) []EmergencyCandidate {
	at := now()
	var out []EmergencyCandidate
	for _, c := range all {
		rank := EmergencyRank(c.Metrics, at)
		if rank >= 100 && !allowDeterministic {
			continue
		}
		if rank >= 1000 {
			continue
		}
		out = append(out, EmergencyCandidate{Candidate: c, Rank: rank})
	}
	for i := 0; i < len(out); i++ {
		for j := i + 1; j < len(out); j++ {
			if out[j].Rank < out[i].Rank ||
				(out[j].Rank == out[i].Rank && out[j].Candidate.ManualPriority > out[i].Candidate.ManualPriority) {
				out[i], out[j] = out[j], out[i]
			}
		}
	}
	return out
}

// BufferedAttemptResult is an upstream try not yet committed to the user (PRD §28.2).
type BufferedAttemptResult struct {
	Success            bool
	IsRetryableFailure bool
	StatusCode         int
	FirstChunk         []byte
	Headers            map[string]string
	Close              func()
}

// EmergencyTryFunc attempts one emergency candidate with buffering until first valid chunk.
type EmergencyTryFunc func(ctx context.Context, c model.ResolvedRouteCandidate) BufferedAttemptResult

// EmergencyOutcome is the leader/waiter result.
type EmergencyOutcome struct {
	RecoveredCandidate *model.ResolvedRouteCandidate
	LeaderResult       *BufferedAttemptResult
	WaiterOnly         bool
	Err                error
}

type emergencyFlight struct {
	done   chan struct{}
	result EmergencyOutcome
}

// EmergencyCoordinator implements Leader/Waiter (PRD §28.3 / §28.4 / §29).
type EmergencyCoordinator struct {
	mu        sync.Mutex
	flights   map[string]*emergencyFlight
	recovered map[string]model.ResolvedRouteCandidate
}

// GlobalEmergency is the process singleton.
var GlobalEmergency = &EmergencyCoordinator{
	flights:   make(map[string]*emergencyFlight),
	recovered: make(map[string]model.ResolvedRouteCandidate),
}

// Clear resets state (tests).
func (e *EmergencyCoordinator) Clear() {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.flights = make(map[string]*emergencyFlight)
	e.recovered = make(map[string]model.ResolvedRouteCandidate)
}

// GetRecovered returns last recovered candidate for model if any.
func (e *EmergencyCoordinator) GetRecovered(requestedModel string) (model.ResolvedRouteCandidate, bool) {
	e.mu.Lock()
	defer e.mu.Unlock()
	c, ok := e.recovered[requestedModel]
	return c, ok
}

func (e *EmergencyCoordinator) setRecovered(requestedModel string, c model.ResolvedRouteCandidate) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.recovered[requestedModel] = c
}

// RunEmergency executes Leader/Waiter emergency for requested_model (PRD §28–§29).
// First caller becomes Leader and runs tryFn serially; others Waiter-wait for recovery signal only.
func (e *EmergencyCoordinator) RunEmergency(
	parent context.Context,
	requestedModel string,
	candidates []model.ResolvedRouteCandidate,
	tryFn EmergencyTryFunc,
	_ bool,
) EmergencyOutcome {
	if e == nil {
		return EmergencyOutcome{Err: ErrEmergencyExhausted}
	}

	waiterTO := time.Duration(model.DefaultEmergencyWaiterDeadlineSec) * time.Second
	waiterCtx, cancelWaiter := context.WithTimeout(parent, waiterTO)
	defer cancelWaiter()

	e.mu.Lock()
	if f, ok := e.flights[requestedModel]; ok {
		// Waiter
		e.mu.Unlock()
		select {
		case <-f.done:
			out := f.result
			out.WaiterOnly = true
			out.LeaderResult = nil // never share body
			return out
		case <-waiterCtx.Done():
			return EmergencyOutcome{Err: ErrEmergencyTimeout, WaiterOnly: true}
		}
	}
	// Leader
	flight := &emergencyFlight{done: make(chan struct{})}
	e.flights[requestedModel] = flight
	e.mu.Unlock()

	out := e.leaderRun(requestedModel, candidates, tryFn)
	flight.result = out

	e.mu.Lock()
	delete(e.flights, requestedModel)
	e.mu.Unlock()
	close(flight.done)

	out.WaiterOnly = false
	return out
}

func (e *EmergencyCoordinator) leaderRun(
	requestedModel string,
	candidates []model.ResolvedRouteCandidate,
	tryFn EmergencyTryFunc,
) EmergencyOutcome {
	total := time.Duration(model.DefaultEmergencyTotalDeadlineSec) * time.Second
	perTry := time.Duration(model.DefaultEmergencyPerAttemptTimeoutSec) * time.Second
	deadline := time.Now().Add(total)
	leaderCtx, cancel := context.WithDeadline(context.Background(), deadline)
	defer cancel()

	ranked := BuildEmergencyCandidates(candidates, false)
	if len(ranked) == 0 {
		return EmergencyOutcome{Err: ErrEmergencyExhausted}
	}

	for _, rc := range ranked {
		remaining := time.Until(deadline)
		if remaining <= 0 {
			break
		}
		timeout := perTry
		if remaining < timeout {
			timeout = remaining
		}
		tryCtx, cancelTry := context.WithTimeout(leaderCtx, timeout)
		result := tryFn(tryCtx, rc.Candidate)
		cancelTry()

		if result.Close != nil && !result.Success {
			result.Close()
		}

		if result.IsRetryableFailure || (!result.Success && result.StatusCode >= 400) {
			if rc.Candidate.Metrics != nil {
				class, ev := ClassifyHTTPStatus(result.StatusCode)
				if ev != EventProductionSuccess {
					rc.Candidate.Metrics.SetLastErrorClass(class)
					ApplyTransition(rc.Candidate.Metrics, ev, 0)
				}
			}
			continue
		}
		if result.Success {
			cp := rc.Candidate
			if cp.Metrics != nil {
				ApplyTransition(cp.Metrics, EventProductionSuccess, 0)
			}
			if cp.RequestedModel == "" {
				cp.RequestedModel = requestedModel
			}
			PromoteToPrimary(&cp)
			e.setRecovered(requestedModel, cp)
			InvalidateRoutePlan(requestedModel)
			res := result
			return EmergencyOutcome{
				RecoveredCandidate: &cp,
				LeaderResult:       &res,
			}
		}
	}
	return EmergencyOutcome{Err: ErrEmergencyExhausted}
}

// ShouldEnterEmergency reports when normal production chain cannot serve (PRD §28).
func ShouldEnterEmergency(chain []model.ResolvedRouteCandidate) bool {
	if len(chain) == 0 {
		return true
	}
	for _, c := range chain {
		st := candidateState(c)
		if !IsProductiveState(st) {
			continue
		}
		if IsInCooldown(c.Metrics) {
			continue
		}
		mk := MakeMetricsKey(c.ChannelID, c.EffectiveModel)
		if !GlobalConcurrency.HasCapacity(mk) {
			continue
		}
		return false
	}
	return true
}
