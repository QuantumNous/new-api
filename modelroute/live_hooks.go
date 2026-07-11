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
	// Shadow is optional capture of the production request for billed shadow probes.
	Shadow *ProductionShadowCapture
}

// ProductionShadowCapture carries enough of the production request to replay a full probe (not a simplified ping).
// Executor is expected to hit upstream via the normal relay adaptor path so the provider bills.
type ProductionShadowCapture struct {
	View          ProductionRequestView
	UserID        int
	TokenID       int
	TokenName     string
	Group         string
	RequestID     string
	RequestPath   string
	RelayFormat   string // types.RelayFormat string form when available
	OriginModel   string
	// MaxTokens from production when known; 0 means leave to executor/model defaults.
	MaxTokens int
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
		_ = RefreshExperienceScore(m)
		GlobalCalibrationPersister.MarkDirty(MakeMetricsKey(out.ChannelID, eff))
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
		mk := MakeMetricsKey(out.ChannelID, eff)
		role := GlobalRoles.Get(mk)
		if role == model.RoleBootstrap || role == model.RoleNone {
			GlobalRoles.Set(mk, model.RolePrimary)
		}
		_ = RefreshExperienceScore(m)
		GlobalCalibrationPersister.MarkDirty(MakeMetricsKey(out.ChannelID, eff))
		InvalidateRoutePlan(out.RequestedModel)
		return
	}

	// failure path
	RecordProductionFailureSample(m)
	class, ev := ClassifyHTTPStatus(out.StatusCode)
	if out.StatusCode == 0 {
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
	if st := m.State(); st == model.RouteProbing || st == model.RouteOpen || st == model.RouteRateLimited {
		EnqueueFromMetrics(m, 0)
	}
	_ = RefreshExperienceScore(m)
	GlobalCalibrationPersister.MarkDirty(MakeMetricsKey(out.ChannelID, eff))
	// hard failures already SnapshotCritical via ApplyTransition; ensure dirty for soft fails
	InvalidateRoutePlan(out.RequestedModel)
}

// ScheduleShadowProbeAfterProduction non-blocking schedules at most one due probe (PRD §12).
// Requires a real production capture; does not invent simplified ping bodies.
func ScheduleShadowProbeAfterProduction(capture *ProductionShadowCapture, primaryChannelID int64, primaryEffective string) {
	if !IsModelPriorityMode() {
		return
	}
	if capture == nil {
		return
	}
	// Ensure external wiring (relay-billed executor) has been installed when available.
	if WireShadowExecutor != nil {
		WireShadowExecutor()
	}
	if GlobalShadowDispatcher == nil || GlobalShadowDispatcher.Executor == nil {
		return
	}
	// Reject empty / unprobeable content — no synthetic ping fallback.
	if len(capture.View.Messages) == 0 {
		return
	}
	hasUser := false
	for _, m := range capture.View.Messages {
		if m.Role == "user" && m.Text != "" {
			hasUser = true
			break
		}
	}
	if !hasUser {
		return
	}
	prod := &capture.View
	if prod.RequestedModel == "" {
		prod.RequestedModel = capture.OriginModel
	}
	// stash capture for executor via process-local last-capture map keyed by request id / model
	RememberShadowCapture(capture)
	exclude := model.MetricsKey{}
	if primaryChannelID > 0 && primaryEffective != "" {
		exclude = MakeMetricsKey(primaryChannelID, primaryEffective)
	}
	GlobalShadowDispatcher.MaybeDispatchShadowProbeAsync(prod, capture.OriginModel, capture.RequestID, exclude)
}

// WireShadowExecutor is set by the service layer to install a relay-billed executor.
// modelroute never imports service (avoids cycles).
var WireShadowExecutor func()

// ApplyProductionOutcomeAsync runs ApplyProductionOutcome off the request path.
func ApplyProductionOutcomeAsync(out ProductionOutcome) {
	if !IsModelPriorityMode() {
		return
	}
	gopool.Go(func() {
		ApplyProductionOutcome(out)
		if out.Success {
			eff, _ := ResolveEffectiveForChannel(out.ChannelID, out.RequestedModel, out.MappingJSON)
			ScheduleShadowProbeAfterProduction(out.Shadow, out.ChannelID, eff)
		}
	})
}


// AcquireProductionSlotForRequest takes a production concurrency slot for channel×model (PRD §19).
// Returns nil slot when model_priority is off (caller should not track) or unlimited capacity always ok.
// ok=false means limited and full — caller should try next candidate.
func AcquireProductionSlotForRequest(channelID int64, requestedModel, mappingJSON string) (slot *ProductionSlot, metricsKey model.MetricsKey, ok bool) {
	if !IsModelPriorityMode() || channelID <= 0 {
		return nil, model.MetricsKey{}, true
	}
	eff, err := ResolveEffectiveForChannel(channelID, requestedModel, mappingJSON)
	if err != nil || eff == "" {
		eff = requestedModel
	}
	if eff == "" {
		return nil, model.MetricsKey{}, true
	}
	mk := MakeMetricsKey(channelID, eff)
	// ensure metrics exist so limits can be applied later
	_ = EnsureRuntimeMetrics(channelID, eff)
	s, acquired := GlobalConcurrency.TryAcquireProductionSlot(mk)
	if !acquired {
		return nil, mk, false
	}
	return s, mk, true
}

// NoteOverflowRoute records whether this attempt used overflow path for sticky stats (PRD §23).
func NoteOverflowRoute(requestedModel string, channelID int64) {
	if !IsModelPriorityMode() || requestedModel == "" {
		return
	}
	usedOverflow := false
	if lease := GlobalLeases.GetValidOverflowLease(requestedModel); lease != nil {
		if lease.Candidate.ChannelID == channelID {
			usedOverflow = true
		}
	}
	GlobalConcurrency.RecordRouteOutcome(requestedModel, usedOverflow)
}
