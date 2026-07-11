package modelroute

import (
	"github.com/QuantumNous/new-api/model"
)

// AttemptOutcome is the classified result of one upstream try (PRD §11.1 / §30).
type AttemptOutcome struct {
	Success            bool
	HasEmittedUserBytes bool
	StatusCode         int
	RetryAfterSec      int
	StreamInterrupted  bool
	ErrorClass         model.ErrorClass
	Event              TransitionEvent
}

// ClassifyAttempt maps raw attempt signals into state-machine event (PRD §11.1 / §24 / §25).
func ClassifyAttempt(success bool, statusCode int, hasEmittedUserBytes bool, streamInterrupted bool) AttemptOutcome {
	out := AttemptOutcome{
		Success:             success,
		HasEmittedUserBytes: hasEmittedUserBytes,
		StatusCode:          statusCode,
		StreamInterrupted:   streamInterrupted,
	}
	if success {
		out.Event = EventProductionSuccess
		return out
	}
	if streamInterrupted && hasEmittedUserBytes {
		// cannot transparent-retry; record STREAM_INTERRUPTED (PRD §11.1)
		out.Event = EventTemporaryFail
		out.ErrorClass = model.ErrorTemporary
		return out
	}
	class, ev := ClassifyHTTPStatus(statusCode)
	out.ErrorClass = class
	out.Event = ev
	return out
}

// ApplyAttemptOutcome updates metrics/role after one try.
// Returns canTransparentRetry: true only when failure is pre-first-byte (PRD §11.1).
func ApplyAttemptOutcome(c *model.ResolvedRouteCandidate, out AttemptOutcome) (canTransparentRetry bool) {
	if c == nil || c.Metrics == nil {
		return false
	}
	if out.Success {
		ApplyTransition(c.Metrics, EventProductionSuccess, 0)
		// successful production validation → PRIMARY (BOOTSTRAP or first healthy)
		mk := MakeMetricsKey(c.ChannelID, c.EffectiveModel)
		role := GlobalRoles.Get(mk)
		if role == model.RoleBootstrap || role == model.RoleNone {
			GlobalRoles.Set(mk, model.RolePrimary)
		}
		return false
	}

	if out.StreamInterrupted && out.HasEmittedUserBytes {
		RecordStreamInterrupted(c.Metrics)
		// no state open required solely by interrupt; temporary error ema rises
		return false
	}

	if out.HasEmittedUserBytes {
		// post first-byte non-interrupt failure: still cannot transparent replay
		if out.Event != "" {
			ApplyTransition(c.Metrics, out.Event, out.RetryAfterSec)
		}
		return false
	}

	// pre-first-byte failure → update state then transparent retry next
	if out.Event != "" {
		ApplyTransition(c.Metrics, out.Event, out.RetryAfterSec)
	}
	return true
}

// RecordStreamInterrupted bumps stream interruption counter/EMA placeholder (PRD §11.1 / §20).
// Full EMA update lands in P6; here we only sample-count + set temporary class marker.
func RecordStreamInterrupted(m *model.ChannelModelMetrics) {
	if m == nil {
		return
	}
	m.ProductionSampleCount++
	// soft mark: increase stream interruption ema toward 1 with default alpha when nil→0
	prev := 0.0
	if m.StreamInterruptionEMA != nil {
		prev = *m.StreamInterruptionEMA
	}
	alpha := model.DefaultStreamInterruptionEMAAlpha
	v := alpha*1.0 + (1-alpha)*prev
	m.StreamInterruptionEMA = &v
	ts := now().Unix()
	m.LastFailureAt = &ts
	GlobalMetricsRuntime.Put(m)
}

// TransparentRetryPlan walks candidates with pre-first-byte failure retry (PRD §11.1).
// tryFn returns AttemptOutcome for one candidate; stops on success or post-byte failure.
type TransparentRetryPlan struct {
	Candidates []model.ResolvedRouteCandidate
	ColdStart  bool
}

// RunTransparentRetry executes tryFn across candidates with transparent retry rules.
// Returns the successful candidate index, outcome, and whether all failed pre-byte.
func RunTransparentRetry(
	plan TransparentRetryPlan,
	tryFn func(c model.ResolvedRouteCandidate, index int) AttemptOutcome,
) (successIdx int, last AttemptOutcome, exhausted bool) {
	successIdx = -1
	for i, c := range plan.Candidates {
		out := tryFn(c, i)
		retry := ApplyAttemptOutcome(&plan.Candidates[i], out)
		last = out
		if out.Success {
			return i, out, false
		}
		if !retry {
			// post-byte failure: stop chain for this request
			return -1, out, false
		}
		// pre-byte: continue
	}
	return -1, last, true
}
