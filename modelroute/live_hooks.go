package modelroute

import (
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/bytedance/gopkg/util/gopool"
)

// ProductionOutcome is a minimal production attempt summary for metrics/state updates (PRD §8/§20).
type ProductionOutcome struct {
	ChannelID      int64
	RequestedModel string
	MappingJSON    string
	Success        bool
	StatusCode     int
	// StreamInterrupted is true when first byte was already sent then failed (PRD §11.1).
	StreamInterrupted bool
	TTFT              time.Duration
	// FirstByteCommitted means response headers/body already exposed to client — cannot transparent-retry.
	FirstByteCommitted bool
}

// ResolveEffectiveForChannel maps requested_model through channel mapping for MetricsKey.
func ResolveEffectiveForChannel(channelID int64, requestedModel, mappingJSON string) (string, error) {
	if mappingJSON == "" && MappingProvider != nil {
		if m, err := MappingProvider(channelID); err == nil {
			mappingJSON = m
		}
	}
	eff, _, err := ResolveEffectiveModel(requestedModel, mappingJSON)
	if err != nil {
		return requestedModel, err
	}
	if eff == "" {
		return requestedModel, nil
	}
	return eff, nil
}

// EnsureRuntimeMetrics loads or creates metrics and mirrors into GlobalMetricsRuntime.
func EnsureRuntimeMetrics(channelID int64, effectiveModel string) *model.ChannelModelMetrics {
	if channelID <= 0 || effectiveModel == "" {
		return nil
	}
	mk := MakeMetricsKey(channelID, effectiveModel)
	if m := GlobalMetricsRuntime.Get(mk); m != nil {
		MaybeAdvanceCooldown(m)
		return m
	}
	m, err := model.EnsureChannelModelMetrics(channelID, effectiveModel)
	if err != nil || m == nil {
		return nil
	}
	GlobalMetricsRuntime.Put(m)
	MaybeAdvanceCooldown(m)
	return m
}

// ApplyProductionOutcome updates EMA + RouteState for one production attempt (PRD §8/§20/§24/§25).
// Safe no-op when model_priority is off or metrics missing.
func ApplyProductionOutcome(out ProductionOutcome) {
	if !IsModelPriorityMode() {
		return
	}
	if out.ChannelID <= 0 || out.RequestedModel == "" {
		return
	}
	eff, err := ResolveEffectiveForChannel(out.ChannelID, out.RequestedModel, out.MappingJSON)
	if err != nil {
		eff = out.RequestedModel
	}
	m := EnsureRuntimeMetrics(out.ChannelID, eff)
	if m == nil {
		return
	}

	// Stream interrupted after first byte: record and do not treat as clean success.
	if out.StreamInterrupted {
		RecordStreamInterruptionSample(m, true)
		RecordProductionFailureSample(m)
		// stay productive state-wise; soft signal only
		_ = RefreshExperienceScore(m)
		return
	}

	if out.Success {
		RecordProductionSuccessSample(m)
		RecordTemporaryErrorSample(m, false)
		RecordRateLimitSample(m, false)
		if out.TTFT > 0 {
			RecordProductionTTFT(m, out.TTFT)
		}
		ApplyTransition(m, EventProductionSuccess, 0)
		// promote bootstrap / none → primary after success
		mk := MakeMetricsKey(out.ChannelID, eff)
		role := GlobalRoles.Get(mk)
		if role == model.RoleBootstrap || role == model.RoleNone {
			GlobalRoles.Set(mk, model.RolePrimary)
		}
		_ = RefreshExperienceScore(m)
		// critical success may snapshot later; invalidate plan soft
		InvalidateRoutePlan(out.RequestedModel)
		return
	}

	// failure path
	RecordProductionFailureSample(m)
	class, ev := ClassifyHTTPStatus(out.StatusCode)
	if out.StatusCode == 0 {
		// transport / unknown
		class, ev = model.ErrorTemporary, EventTemporaryFail
	}
	switch class {
	case model.ErrorTemporary:
		if ev == EventRateLimited {
			RecordRateLimitSample(m, true)
		} else {
			RecordTemporaryErrorSample(m, true)
		}
	case model.ErrorDeterministic:
		RecordTemporaryErrorSample(m, false)
	}
	ApplyTransition(m, ev, 0)
	// if entered PROBING via cooldown advance or OPEN, ensure probe queue has item
	if st := m.State(); st == model.RouteProbing || st == model.RouteOpen || st == model.RouteRateLimited {
		EnqueueFromMetrics(m, 0)
	}
	_ = RefreshExperienceScore(m)
	InvalidateRoutePlan(out.RequestedModel)
}

// ScheduleShadowProbeAfterProduction non-blocking schedules at most one due probe (PRD §12).
func ScheduleShadowProbeAfterProduction(requestedModel, productionRequestID string, primaryChannelID int64, primaryEffective string) {
	if !IsModelPriorityMode() {
		return
	}
	EnsureDefaultShadowWiring()
	if GlobalShadowDispatcher == nil || GlobalShadowDispatcher.Executor == nil {
		return
	}
	// default pure-text view when production body is not available on this hook
	prod := &ProductionRequestView{
		RequestedModel:          requestedModel,
		Messages:                []ShadowMessage{{Role: "user", Text: "ping"}},
		TextIndependentComplete: true,
	}
	exclude := model.MetricsKey{}
	if primaryChannelID > 0 && primaryEffective != "" {
		exclude = MakeMetricsKey(primaryChannelID, primaryEffective)
	}
	GlobalShadowDispatcher.MaybeDispatchShadowProbeAsync(prod, requestedModel, productionRequestID, exclude)
}

// ApplyProductionOutcomeAsync runs ApplyProductionOutcome off the request path.
func ApplyProductionOutcomeAsync(out ProductionOutcome) {
	if !IsModelPriorityMode() {
		return
	}
	gopool.Go(func() {
		ApplyProductionOutcome(out)
		if out.Success {
			eff, _ := ResolveEffectiveForChannel(out.ChannelID, out.RequestedModel, out.MappingJSON)
			ScheduleShadowProbeAfterProduction(out.RequestedModel, "", out.ChannelID, eff)
		}
	})
}
