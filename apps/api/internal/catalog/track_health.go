package channel

import (
	"context"
	"errors"
	"fmt"
	"math"
	"sort"
	"strconv"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/internal/settings"
	"github.com/QuantumNous/new-api/relaykit/types"
)

// HealthStore holds the channel health scoring state and implements the
// business logic for EWMA scoring, cooldowns, and routing weight calculation.
// It is the logical owner of channel health state; ChannelHealthManager
// is a thin forwarding facade that calls into this store via a registered bridge.
type HealthStore struct {
	mu     sync.Mutex
	states map[int]*ChannelHealthState
}

var (
	healthStoreOnce sync.Once
	healthStore     *HealthStore
)

// GetHealthStore returns the singleton health store.
func GetHealthStore() *HealthStore {
	healthStoreOnce.Do(func() {
		healthStore = &HealthStore{
			states: make(map[int]*ChannelHealthState),
		}
	})
	return healthStore
}

// ResetHealthStoreForTest swaps in a fresh store for capability-package tests.
func ResetHealthStoreForTest() {
	healthStoreOnce = sync.Once{}
}

// ClassifyChannelOutcome categorizes an API error into a ChannelOutcome.
// It is concurrency-safe and does NOT respect the kill switch; classification
// drives request-level exclusion which should always operate.
func (h *HealthStore) ClassifyChannelOutcome(err *types.NewAPIError, channelID int) ChannelOutcome {
	h.mu.Lock()
	defer h.mu.Unlock()

	state, tracked := h.states[channelID]
	if !tracked {
		state = &ChannelHealthState{EwmaScore: DefaultScore}
	}

	outcome := classifyChannelOutcomeUnlocked(state, err)

	// A live 401 run is the only classification state worth carrying between
	// requests; everything else is derived fresh from the error each time.
	if !tracked && state.UnauthorizedRun > 0 {
		h.states[channelID] = state
	}

	return outcome
}

// classifyChannelOutcomeUnlocked classifies the error assuming the store mutex
// is already held by the caller.
func classifyChannelOutcomeUnlocked(state *ChannelHealthState, err *types.NewAPIError) ChannelOutcome {
	if err == nil {
		state.UnauthorizedRun = 0
		return OutcomeSuccess
	}

	// A client-canceled request says nothing about the channel: the transport
	// failure rides a 500 wrapper, so it must not derate the ledger. Unlike
	// the other neutral branches this does NOT reset the 401 run — a cancel
	// is not evidence of recovery, and resetting would let a canceling client
	// mask a dead credential. Mirrors ClassifyUnitOutcome's cancel rule.
	if errors.Is(err, context.Canceled) {
		return OutcomeNeutral
	}

	// Channel errors or bad response body are always fatal.
	if types.IsChannelError(err) || err.GetErrorCode() == types.ErrorCodeBadResponseBody {
		state.UnauthorizedRun = 0
		return OutcomeFatal
	}

	// 429 => throttled, reset unauthorized run.
	if err.StatusCode == 429 {
		state.UnauthorizedRun = 0
		return OutcomeThrottled
	}

	// 5xx => fatal.
	if err.StatusCode >= 500 {
		state.UnauthorizedRun = 0
		return OutcomeFatal
	}

	// 401 => count the run and escalate once it is sustained.
	if err.StatusCode == 401 {
		if state.UnauthorizedRun < UnauthorizedEscalationThreshold {
			state.UnauthorizedRun++
		}
		if state.UnauthorizedRun >= UnauthorizedEscalationThreshold {
			return OutcomeFatal
		}
		return OutcomeNeutral
	}

	// All other status codes => neutral, reset unauthorized run.
	state.UnauthorizedRun = 0
	return OutcomeNeutral
}

// RecordChannelOutcome updates the EWMA score for a channel based on a
// ChannelOutcome. The kill switch gates health scoring only.
func (h *HealthStore) RecordChannelOutcome(channelID int, outcome ChannelOutcome) {
	h.recordChannelOutcome(channelID, "", outcome)
}

// recordChannelOutcome is the model-aware form. An empty modelName records
// health exactly as before but cannot escalate to a per-model disable.
func (h *HealthStore) recordChannelOutcome(channelID int, modelName string, outcome ChannelOutcome) {
	cfg := GetChannelHealthSetting()
	if cfg == nil || !cfg.Enabled {
		return
	}

	h.mu.Lock()
	defer h.mu.Unlock()

	state, ok := h.states[channelID]
	if !ok {
		state = &ChannelHealthState{
			EwmaScore:       DefaultScore,
			RequestCount:    0,
			UnauthorizedRun: 0,
		}
		h.states[channelID] = state
	}

	now := ChannelHealthNow()

	// Finish any expired cooldown before applying the new outcome so a
	// post-expiry result re-enters the slow-start curve cleanly.
	if !state.CooldownUntil.IsZero() && !state.CooldownUntil.After(now) {
		finishCooldownLocked(state)
	}

	switch outcome {
	case OutcomeSuccess:
		state.FailureStreak = 0
		// A clean success once a cooldown has expired decays the streak so the
		// next failure run starts from a shorter duration.
		if state.CooldownStreak > 0 && state.CooldownUntil.IsZero() {
			state.CooldownStreak--
		}
		// A success is also evidence this model works, so it pays the
		// escalation count back down. Without this the count is a lifetime
		// total and cooldowns spread over months retire a model that has
		// served thousands of requests since.
		decayModelCooldown(state, modelName)
		clearModelFailures(state, modelName)
	case OutcomeNeutral:
		// Neutral stays score/request-count inert but clears an accumulated
		// failure streak: it is not evidence against the channel.
		state.FailureStreak = 0
		clearModelFailures(state, modelName)
		return
	case OutcomeFatal, OutcomeThrottled:
		state.FailureStreak++
		if outcome == OutcomeFatal {
			countModelFailure(state, modelName)
		}
	}

	// Apply the appropriate observation via the shared EWMA update.
	var observation float64
	switch outcome {
	case OutcomeSuccess:
		observation = 1.0
	case OutcomeFatal:
		observation = 0.0
	case OutcomeThrottled:
		observation = ThrottledObservation
	default:
		observation = 0.0
	}

	// Increment request count and update EWMA.
	state.RequestCount++
	state.RampPending = false

	// A fatal outcome ends the warm-up ramp immediately.
	if outcome == OutcomeFatal {
		state.RampExited = true
	}

	if state.RequestCount > cfg.MinRequests {
		state.EwmaScore = cfg.Alpha*observation + (1-cfg.Alpha)*state.EwmaScore
		if state.EwmaScore < cfg.MinScore {
			state.EwmaScore = cfg.MinScore
		}
	}

	// The cooldown trigger is deliberately outside the MinRequests guard and
	// stays channel-scoped: an overloaded upstream fails whichever model it is
	// asked for, and ejecting the channel is the right response to that.
	// Only a genuine failure (OutcomeFatal) escalates toward a permanent
	// per-model disable. OutcomeThrottled (429) means the upstream is busy,
	// not that the model is gone: rate-limiting must not retire a model.
	// Escalating a 429 made repeated throttling silently remove working
	// models from the route table, with no path back short of an admin
	// editing the channel. Throttling still applies the cooldown below, so
	// the route backs off temporarily and recovers on its own.
	if state.FailureStreak >= cfg.CooldownThreshold && (outcome == OutcomeFatal || outcome == OutcomeThrottled) {
		startCooldownLocked(state, cfg, now)
	}
	// The escalation reads the model's OWN failure run, never the channel-level
	// streak above. A healthy sibling's successes reset that streak, so a dead
	// model sharing the channel would never accumulate enough failures to be
	// retired; and whichever model happened to be in flight when the channel
	// tripped took the blame.
	if modelName != "" && outcome == OutcomeFatal && state.ModelFailures[modelName] >= cfg.CooldownThreshold {
		// Count the episode once: without the reset every further failure would
		// add another cooldown to the escalation count.
		state.ModelFailures[modelName] = 0
		h.escalateModelLocked(state, cfg, channelID, modelName)
	}
}

// escalateModelLocked counts this cooldown against modelName and disables that
// model on the channel once the count reaches CooldownDisableStreak. Caller
// must hold h.mu.
func (h *HealthStore) escalateModelLocked(state *ChannelHealthState, cfg *ChannelHealthSetting, channelID int, modelName string) {
	// Auto-disabling models on repeated cooldowns is disabled: health
	// exclusion is the live cooldown window only, so a model recovers
	// automatically when its cooldown expires (ferrite semantics).
	// CooldownDisableStreak is retained for config compatibility but no
	// longer drives a disable.
	return
}

// RecordRequestAttempts applies health accounting once for a whole client
// request, rather than once per failed try. winnerModel is the model the
// request was for; the success path needs it to pay down that model's
// escalation count, and the failure path takes each model from its attempt.
func (h *HealthStore) RecordRequestAttempts(attempts []ChannelAttempt, winnerID int, winnerModel string, succeeded bool) {
	if succeeded {
		// ClassifyChannelOutcome(nil, ...) also clears any in-flight 401 run,
		// which a bare OutcomeSuccess would leave standing.
		h.recordChannelOutcome(winnerID, winnerModel, h.ClassifyChannelOutcome(nil, winnerID))
		return
	}
	for _, attempt := range attempts {
		if attempt.Outcome.AffectsHealth() {
			h.recordChannelOutcome(attempt.ChannelID, attempt.ModelName, attempt.Outcome)
		}
	}
}

// RecordOutcome updates the EWMA score for a channel after a request (legacy API).
// success=true means the request succeeded; false means it failed.
// The kill switch is checked: if disabled, the method returns immediately.
func (h *HealthStore) RecordOutcome(channelID int, success bool) {
	cfg := GetChannelHealthSetting()
	if cfg == nil || !cfg.Enabled {
		return
	}

	h.mu.Lock()
	defer h.mu.Unlock()

	state, ok := h.states[channelID]
	if !ok {
		state = &ChannelHealthState{
			EwmaScore:       DefaultScore,
			RequestCount:    0,
			UnauthorizedRun: 0,
		}
		h.states[channelID] = state
	}

	state.RequestCount++

	// A real failure ends the warm-up ramp immediately.
	if !success {
		state.RampExited = true
	}

	// Don't update EWMA until we have enough data; trust the channel.
	if state.RequestCount <= cfg.MinRequests {
		return
	}

	outcome := 0.0
	if success {
		outcome = 1.0
	}

	state.EwmaScore = cfg.Alpha*outcome + (1-cfg.Alpha)*state.EwmaScore
	if state.EwmaScore < cfg.MinScore {
		state.EwmaScore = cfg.MinScore
	}
}

// slowStartFactor scales a channel's routing weight during its warm-up window.
// Caller must hold h.mu.
func slowStartFactor(state *ChannelHealthState, minRequests int) float64 {
	if minRequests <= 0 || state.RampExited {
		return 1.0
	}
	if state.RampPending {
		return 1.0 / float64(minRequests)
	}
	if state.RequestCount == 0 || state.RequestCount >= minRequests {
		return 1.0
	}
	return float64(state.RequestCount) / float64(minRequests)
}

// EffectiveWeight returns the routing weight for a channel, scaled by its EWMA
// health score and slow-start factor. A channel in live cooldown weighs zero.
func (h *HealthStore) EffectiveWeight(channelID int, baseWeight uint) float64 {
	return h.RoutingWeight(channelID, baseWeight, false)
}

// RoutingWeight is the shared health/cooldown weight path. EffectiveWeight calls
// it with bypassCooldown=false. Selectors call it with true for cooling
// candidates deliberately retained by the max-ejection cap.
func (h *HealthStore) RoutingWeight(channelID int, baseWeight uint, bypassCooldown bool) float64 {
	cfg := GetChannelHealthSetting()
	if cfg == nil || !cfg.Enabled {
		return float64(baseWeight)
	}

	h.mu.Lock()
	defer h.mu.Unlock()

	state, ok := h.states[channelID]
	if !ok {
		return float64(baseWeight) // no history = full health, no ramp to apply
	}

	now := ChannelHealthNow()
	if !state.CooldownUntil.IsZero() {
		if state.CooldownUntil.After(now) {
			if !bypassCooldown {
				return 0
			}
		} else {
			// Expired: finish it lazily so the recovered channel re-enters the
			// slow-start curve on this very selection.
			finishCooldownLocked(state)
		}
	}

	return float64(baseWeight) * state.EwmaScore * slowStartFactor(state, cfg.MinRequests)
}

// CooldownDuration computes the sliding cooldown duration.
func CooldownDuration(cfg *ChannelHealthSetting, priorActivations int) time.Duration {
	base, max := cfg.CooldownBaseSeconds, cfg.CooldownMaxSeconds
	if base <= 0 || max <= 0 {
		return 0
	}
	if max < base {
		max = base
	}
	// alpha^0 == 1, so the first activation is exactly base.
	factor := 1.0 - math.Pow(cfg.CooldownAlpha, float64(priorActivations))
	d := float64(base) + float64(max-base)*factor
	if d < float64(base) {
		d = float64(base)
	}
	if d > float64(max) {
		d = float64(max)
	}
	return time.Duration(d * float64(time.Second))
}

// startCooldownLocked activates a cooldown sized from the current cooldownStreak,
// then increments the streak. Caller must hold h.mu.
func startCooldownLocked(state *ChannelHealthState, cfg *ChannelHealthSetting, now time.Time) {
	d := CooldownDuration(cfg, state.CooldownStreak)
	if d <= 0 {
		return
	}
	state.CooldownStreak++
	state.FailureStreak = 0
	state.RequestCount = 0
	state.RampExited = false
	state.CooldownUntil = now.Add(d)
}

// finishCooldownLocked clears an expired cooldown and arms the slow-start ramp.
// Caller must hold h.mu.
func finishCooldownLocked(state *ChannelHealthState) {
	state.CooldownUntil = time.Time{}
	state.RequestCount = 0
	state.RampExited = false
	state.RampPending = true
}

// Reset clears all health state. Called when the kill switch is toggled off.
func (h *HealthStore) Reset() {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.states = make(map[int]*ChannelHealthState)
}

// GetScore returns the current EWMA score for diagnostics.
func (h *HealthStore) GetScore(channelID int) float64 {
	cfg := GetChannelHealthSetting()
	if cfg == nil || !cfg.Enabled {
		return DefaultScore
	}

	h.mu.Lock()
	defer h.mu.Unlock()

	state, ok := h.states[channelID]
	if !ok {
		return DefaultScore
	}
	return state.EwmaScore
}

// FilterCoolingChannels reports which of channelIDs must be removed from a
// priority tier because they are in a live cooldown.
func (h *HealthStore) FilterCoolingChannels(channelIDs []int, maxEjectionPercent int) map[int]bool {
	ejected := make(map[int]bool)
	cfg := GetChannelHealthSetting()
	if cfg == nil || !cfg.Enabled || maxEjectionPercent <= 0 {
		return ejected
	}

	h.mu.Lock()
	defer h.mu.Unlock()

	now := ChannelHealthNow()

	var cooling []int
	for _, id := range channelIDs {
		state, ok := h.states[id]
		if !ok || state.CooldownUntil.IsZero() {
			continue
		}
		if !state.CooldownUntil.After(now) {
			finishCooldownLocked(state)
			continue
		}
		cooling = append(cooling, id)
	}
	if len(cooling) == 0 {
		return ejected
	}

	// Fully cooling tier, or an operator asking for total ejection: drop all.
	if len(cooling) == len(channelIDs) || maxEjectionPercent >= 100 {
		for _, id := range cooling {
			ejected[id] = true
		}
		return ejected
	}

	sort.Ints(cooling)

	ejectLimit := len(channelIDs) * maxEjectionPercent / 100 // floor
	if ejectLimit < 1 {
		ejectLimit = 1
	}
	if ejectLimit > len(cooling) {
		ejectLimit = len(cooling)
	}
	for _, id := range cooling[:ejectLimit] {
		ejected[id] = true
	}
	return ejected
}

// SnapshotCooldownStateForTest returns the tracked state of one channel for testing.
func (h *HealthStore) SnapshotCooldownStateForTest(channelID int) (CooldownStateSnapshot, bool) {
	h.mu.Lock()
	defer h.mu.Unlock()

	state, ok := h.states[channelID]
	if !ok {
		return CooldownStateSnapshot{}, false
	}
	return CooldownStateSnapshot{
		RequestCount:   state.RequestCount,
		RampPending:    state.RampPending,
		RampExited:     state.RampExited,
		CooldownStreak: state.CooldownStreak,
	}, true
}

// init registers the health store implementation with the model package bridge
// so model-internal consumers keep working without this package importing model
// in the reverse direction.
func init() {
	RegisterHealthBridge(HealthBridge{
		ClassifyOutcome:        hClassifyOutcome,
		RecordChannelOutcome:   hRecordChannelOutcome,
		RecordRequestAttempts:  hRecordRequestAttempts,
		RecordOutcome:          hRecordOutcome,
		EffectiveWeight:        hEffectiveWeight,
		RoutingWeight:          hRoutingWeight,
		BridgeCooldownDuration: CooldownDuration,
		Reset:                  hReset,
		GetScore:               hGetScore,
		FilterCoolingChannels:  hFilterCoolingChannels,
		SnapshotCooldownState:  hSnapshotCooldownState,
		ResetForTest:           ResetHealthStoreForTest,
	})
	// Initialize the atomic default (recovered from original track_health init).
	channelHealthSetting.Store(DefaultChannelHealthSetting())

	// C1 hook registration: catalog owns health/model setting validation per replan; settings calls via nil-safe On* vars to avoid import cycle.
	// Model-health hooks are now registered exclusively in manage_models.go to prevent init() overwrite (defect #2).
	settings.OnIsChannelHealthOptionKey = IsChannelHealthOptionKey
	settings.OnValidateChannelHealthOption = ValidateChannelHealthSettingValue
	settings.OnApplyChannelHealthOption = UpdateChannelHealthSettingValue
	// Chain the seed hook to combine with other catalog domains without overwriting (recovered from flattening).
	previousSeed := settings.OnSeedCatalogOptions
	settings.OnSeedCatalogOptions = func() map[string]string {
		m := map[string]string{}
		if previousSeed != nil {
			m = previousSeed()
		}
		for k, v := range seedChannelHealthOptions() {
			m[k] = v
		}
		return m
	}
}

func hClassifyOutcome(err *types.NewAPIError, channelID int) ChannelOutcome {
	return GetHealthStore().ClassifyChannelOutcome(err, channelID)
}

func hRecordChannelOutcome(channelID int, outcome ChannelOutcome) {
	GetHealthStore().RecordChannelOutcome(channelID, outcome)
}

func hRecordRequestAttempts(attempts []ChannelAttempt, winnerID int, winnerModel string, succeeded bool) {
	GetHealthStore().RecordRequestAttempts(attempts, winnerID, winnerModel, succeeded)
}

func hRecordOutcome(channelID int, success bool) {
	GetHealthStore().RecordOutcome(channelID, success)
}

func hEffectiveWeight(channelID int, baseWeight uint) float64 {
	return GetHealthStore().EffectiveWeight(channelID, baseWeight)
}

func hRoutingWeight(channelID int, baseWeight uint, bypassCooldown bool) float64 {
	return GetHealthStore().RoutingWeight(channelID, baseWeight, bypassCooldown)
}

func hReset() {
	GetHealthStore().Reset()
}

func hGetScore(channelID int) float64 {
	return GetHealthStore().GetScore(channelID)
}

func hFilterCoolingChannels(channelIDs []int, maxEjectionPercent int) map[int]bool {
	return GetHealthStore().FilterCoolingChannels(channelIDs, maxEjectionPercent)
}

func hSnapshotCooldownState(channelID int) (CooldownStateSnapshot, bool) {
	return GetHealthStore().SnapshotCooldownStateForTest(channelID)
}

// ChannelHealthSetting configures the EWMA-based channel health scoring.
//
// When Enabled is false, the system falls back to baseline behavior (pure
// weighted random without health adjustment). This serves as a kill switch:
// toggling it off instantly restores baseline, with no restart required.
type ChannelHealthSetting struct {
	Enabled     bool    `json:"enabled"`
	Alpha       float64 `json:"alpha"`        // EWMA smoothing factor (0-1), default 0.3
	MinScore    float64 `json:"min_score"`    // Floor: minimum health score, default 0.05
	MinRequests int     `json:"min_requests"` // Min requests before EWMA is trusted, default 5

	// Cooldown ejection: after CooldownThreshold consecutive fatal/throttled
	// outcomes a channel is ejected for a sliding duration that starts at
	// CooldownBaseSeconds and approaches CooldownMaxSeconds with repeated
	// activations. CooldownMaxEjectionPercent caps how many simultaneously
	// cooling channels in a tier may be truly zeroed; the rest stay selectable
	// as a degraded availability fallback. CooldownAlpha is an independent
	// sliding-duration factor (0-1), not the EWMA Alpha above.
	CooldownThreshold          int     `json:"cooldown_threshold"`
	CooldownBaseSeconds        int     `json:"cooldown_base_seconds"`
	CooldownMaxSeconds         int     `json:"cooldown_max_seconds"`
	CooldownMaxEjectionPercent int     `json:"cooldown_max_ejection_percent"`
	CooldownAlpha              float64 `json:"cooldown_alpha"`

	// CooldownDisableStreak is how many sustained failure episodes one
	// channel+model pair may accumulate before that model is disabled on that
	// channel. An episode is CooldownThreshold consecutive fatal outcomes
	// attributed to that one model. Cooldown alone never terminates: a
	// permanently dead upstream just cycles "cool, probe once, fail, cool
	// longer" forever, so it keeps consuming a probe every minute and never
	// leaves the candidate set for good. Once the sliding duration has
	// saturated and the pair still cannot serve a request, the model is what is
	// broken, so only that model is disabled; the channel keeps serving its
	// other models. Zero disables the escalation.
	//
	// The count is deliberately NOT a lifetime total: every successful request
	// through the pair pays it down by one (see decayModelCooldown), so it
	// tracks sustained recent trouble. Without that decay, episodes spread
	// over months would retire a model that had served thousands of requests
	// since — the shape of the incident where a throttling-only upstream
	// permanently removed working models.
	CooldownDisableStreak int `json:"cooldown_disable_streak"`
}

// DefaultChannelHealthSetting returns the recommended defaults.
func DefaultChannelHealthSetting() *ChannelHealthSetting {
	return &ChannelHealthSetting{
		Enabled:                    true,
		Alpha:                      0.3,
		MinScore:                   0.05,
		MinRequests:                5,
		CooldownThreshold:          5,
		CooldownBaseSeconds:        10,
		CooldownMaxSeconds:         60,
		CooldownMaxEjectionPercent: 50,
		CooldownAlpha:              0.3,
		CooldownDisableStreak:      0,
	}
}

// channelHealthSetting holds the runtime config. It is read on every request from
// handler goroutines while an admin may replace it at any time, so it is stored in
// an atomic.Pointer: the struct is swapped wholesale rather than mutated in place.
var channelHealthSetting atomic.Pointer[ChannelHealthSetting]

// seedChannelHealthOptions returns the map for OnSeedCatalogOptions chaining
// to match the pattern used by manage_channels.go and resolve_group.go (recovered
// from flattening of health_store and track_health per C1 defect #4).
func seedChannelHealthOptions() map[string]string {
	cfg := DefaultChannelHealthSetting()
	return map[string]string{
		OptChannelHealthEnabled:                strconv.FormatBool(cfg.Enabled),
		OptChannelHealthCooldownThreshold:      strconv.Itoa(cfg.CooldownThreshold),
		OptChannelHealthCooldownBaseSeconds:    strconv.Itoa(cfg.CooldownBaseSeconds),
		OptChannelHealthCooldownMaxSeconds:     strconv.Itoa(cfg.CooldownMaxSeconds),
		OptChannelHealthCooldownMaxEjectionPct: strconv.Itoa(cfg.CooldownMaxEjectionPercent),
		OptChannelHealthCooldownAlpha:          fmt.Sprintf("%.2f", cfg.CooldownAlpha),
		OptChannelHealthCooldownDisableStreak:  strconv.Itoa(cfg.CooldownDisableStreak),
	}
}

// GetChannelHealthSetting returns the current channel health setting.
func GetChannelHealthSetting() *ChannelHealthSetting {
	return channelHealthSetting.Load()
}

// healthStateResetHook is invoked when the kill switch transitions from enabled
// to disabled, so accumulated per-channel health state is discarded instead of
// being resurrected on re-enable. It is registered by the model package because
// operation_setting must not import model: model already imports
// operation_setting, and the reverse edge would create an import cycle.
//
// Stored atomically because SetChannelHealthSetting reads it from whichever
// goroutine performs the toggle, while registration happens during package init.
var healthStateResetHook atomic.Pointer[func()]

// RegisterHealthStateResetHook wires the reset callback. Passing nil clears it.
func RegisterHealthStateResetHook(hook func()) {
	if hook == nil {
		healthStateResetHook.Store(nil)
		return
	}
	healthStateResetHook.Store(&hook)
}

// SetChannelHealthSetting updates the channel health setting. The caller's
// struct is copied before publication so the caller cannot mutate the live
// config after this call returns.
func SetChannelHealthSetting(cfg *ChannelHealthSetting) {
	if cfg == nil {
		return
	}
	normalized := *cfg // copy-on-write; never mutate the caller's struct
	normalizeChannelHealthSetting(&normalized)

	// Swap installs the new config and hands back the previous one, so the
	// enabled -> disabled edge is derived from the exact pointer this call
	// replaced. Reading the old value separately would let two concurrent
	// toggles observe a predecessor they did not actually replace, firing or
	// skipping the reset hook incorrectly.
	previous := channelHealthSetting.Swap(&normalized)
	wasEnabled := previous != nil && previous.Enabled
	if wasEnabled && !normalized.Enabled {
		if hook := healthStateResetHook.Load(); hook != nil {
			(*hook)()
		}
	}
}

// normalizeChannelHealthSetting clamps all fields into their valid ranges in
// place. It uses math-free integer arithmetic only.
func normalizeChannelHealthSetting(cfg *ChannelHealthSetting) {
	if cfg.Alpha < 0 {
		cfg.Alpha = 0
	}
	if cfg.Alpha > 1 {
		cfg.Alpha = 1
	}
	if cfg.MinScore < 0 {
		cfg.MinScore = 0
	}
	if cfg.MinScore > 1 {
		cfg.MinScore = 1
	}
	if cfg.MinRequests < 0 {
		cfg.MinRequests = 0
	}
	if cfg.CooldownThreshold < 1 {
		cfg.CooldownThreshold = 1
	}
	if cfg.CooldownBaseSeconds < 0 {
		cfg.CooldownBaseSeconds = 0
	}
	if cfg.CooldownMaxSeconds < 0 {
		cfg.CooldownMaxSeconds = 0
	}
	if cfg.CooldownMaxSeconds < cfg.CooldownBaseSeconds {
		cfg.CooldownMaxSeconds = cfg.CooldownBaseSeconds
	}
	if cfg.CooldownMaxEjectionPercent < 0 {
		cfg.CooldownMaxEjectionPercent = 0
	}
	if cfg.CooldownMaxEjectionPercent > 100 {
		cfg.CooldownMaxEjectionPercent = 100
	}
	if cfg.CooldownAlpha < 0 {
		cfg.CooldownAlpha = 0
	}
	if cfg.CooldownAlpha > 1 {
		cfg.CooldownAlpha = 1
	}
	if cfg.CooldownDisableStreak < 0 {
		cfg.CooldownDisableStreak = 0
	}
}

// healthOptionKey is the flat option key for each field.
const (
	OptChannelHealthEnabled                = "ChannelHealthEnabled"
	OptChannelHealthCooldownThreshold      = "ChannelHealthCooldownThreshold"
	OptChannelHealthCooldownBaseSeconds    = "ChannelHealthCooldownBaseSeconds"
	OptChannelHealthCooldownMaxSeconds     = "ChannelHealthCooldownMaxSeconds"
	OptChannelHealthCooldownMaxEjectionPct = "ChannelHealthCooldownMaxEjectionPercent"
	OptChannelHealthCooldownAlpha          = "ChannelHealthCooldownAlpha"
	OptChannelHealthCooldownDisableStreak  = "ChannelHealthCooldownDisableStreak"
)

// healthOptionKeys lists the recognized health flat option keys.
var healthOptionKeys = map[string]bool{
	OptChannelHealthEnabled:                true,
	OptChannelHealthCooldownThreshold:      true,
	OptChannelHealthCooldownBaseSeconds:    true,
	OptChannelHealthCooldownMaxSeconds:     true,
	OptChannelHealthCooldownMaxEjectionPct: true,
	OptChannelHealthCooldownAlpha:          true,
	OptChannelHealthCooldownDisableStreak:  true,
}

// IsChannelHealthOptionKey reports whether key is one of the recognized
// health flat option keys.
func IsChannelHealthOptionKey(key string) bool {
	return healthOptionKeys[key]
}

// ValidateChannelHealthSettingValue checks one health option without publishing
// it, so callers reject a bad value before it is persisted. Range checking lives
// here rather than relying on normalization: a clamped value would be stored in
// OptionMap verbatim while the runtime config held the clamped number, so the
// admin UI would keep showing a setting that is not the one in effect.
func ValidateChannelHealthSettingValue(key, value string) error {
	if !healthOptionKeys[key] {
		return fmt.Errorf("unknown channel health option key: %s", key)
	}
	current := channelHealthSetting.Load()
	if current == nil {
		return errors.New("channel health setting not initialized")
	}
	updated := *current
	if err := applyHealthOptionValue(&updated, key, value); err != nil {
		return err
	}
	return validateHealthRange(&updated, key)
}

// validateHealthRange rejects a parsed value that normalization would silently
// clamp. Only the field named by key is checked, so a pre-existing out-of-range
// value elsewhere in the config cannot block an unrelated update. The base/max
// pair is the one cross-field rule: normalization raises an inverted max up to
// base, which would leave the stored option disagreeing with the effective one,
// so an inversion is reported instead.
func validateHealthRange(cfg *ChannelHealthSetting, key string) error {
	switch key {
	case OptChannelHealthCooldownThreshold:
		if cfg.CooldownThreshold < 1 {
			return fmt.Errorf("%s must be at least 1", key)
		}
	case OptChannelHealthCooldownBaseSeconds:
		if cfg.CooldownBaseSeconds < 0 {
			return fmt.Errorf("%s must not be negative", key)
		}
		if cfg.CooldownBaseSeconds > cfg.CooldownMaxSeconds {
			return fmt.Errorf("%s must not exceed %s (%d)",
				key, OptChannelHealthCooldownMaxSeconds, cfg.CooldownMaxSeconds)
		}
	case OptChannelHealthCooldownMaxSeconds:
		if cfg.CooldownMaxSeconds < 0 {
			return fmt.Errorf("%s must not be negative", key)
		}
		if cfg.CooldownMaxSeconds < cfg.CooldownBaseSeconds {
			return fmt.Errorf("%s must not be below %s (%d)",
				key, OptChannelHealthCooldownBaseSeconds, cfg.CooldownBaseSeconds)
		}
	case OptChannelHealthCooldownDisableStreak:
		if cfg.CooldownDisableStreak < 0 {
			return fmt.Errorf("%s must not be negative", key)
		}
	case OptChannelHealthCooldownMaxEjectionPct:
		if cfg.CooldownMaxEjectionPercent < 0 || cfg.CooldownMaxEjectionPercent > 100 {
			return fmt.Errorf("%s must be between 0 and 100", key)
		}
	case OptChannelHealthCooldownAlpha:
		if cfg.CooldownAlpha < 0 || cfg.CooldownAlpha > 1 {
			return fmt.Errorf("%s must be between 0 and 1", key)
		}
	}
	return nil
}

// UpdateChannelHealthSettingValue parses one recognized flat option key and
// CAS-updates only that field on a copy of the current atomic config. The value
// is range-checked before publication, so what an operator submits is exactly
// what takes effect; normalization then only has to guard legacy configs loaded
// from the database. Unknown keys, malformed values, and out-of-range values all
// return an error without changing the config.
func UpdateChannelHealthSettingValue(key, value string) error {
	if !healthOptionKeys[key] {
		return fmt.Errorf("unknown channel health option key: %s", key)
	}
	for {
		current := channelHealthSetting.Load()
		if current == nil {
			return errors.New("channel health setting not initialized")
		}
		updated := *current
		if err := applyHealthOptionValue(&updated, key, value); err != nil {
			return err
		}
		if err := validateHealthRange(&updated, key); err != nil {
			return err
		}
		normalizeChannelHealthSetting(&updated)
		if channelHealthSetting.CompareAndSwap(current, &updated) {
			// Fire the enabled->disabled reset hook only when this update
			// actually crossed the edge.
			if current.Enabled && !updated.Enabled {
				if hook := healthStateResetHook.Load(); hook != nil {
					(*hook)()
				}
			}
			return nil
		}
		// CAS failed: a concurrent update replaced the config; retry from
		// the newest pointer.
	}
}

// applyHealthOptionValue mutates cfg in place with the parsed value for key.
// It does not normalize; normalization happens once before publication.
func applyHealthOptionValue(cfg *ChannelHealthSetting, key, value string) error {
	switch key {
	case OptChannelHealthEnabled:
		b, err := strconv.ParseBool(value)
		if err != nil {
			return fmt.Errorf("invalid boolean for %s: %w", key, err)
		}
		cfg.Enabled = b
	case OptChannelHealthCooldownThreshold:
		n, err := strconv.Atoi(value)
		if err != nil {
			return fmt.Errorf("invalid integer for %s: %w", key, err)
		}
		cfg.CooldownThreshold = n
	case OptChannelHealthCooldownBaseSeconds:
		n, err := strconv.Atoi(value)
		if err != nil {
			return fmt.Errorf("invalid integer for %s: %w", key, err)
		}
		cfg.CooldownBaseSeconds = n
	case OptChannelHealthCooldownMaxSeconds:
		n, err := strconv.Atoi(value)
		if err != nil {
			return fmt.Errorf("invalid integer for %s: %w", key, err)
		}
		cfg.CooldownMaxSeconds = n
	case OptChannelHealthCooldownDisableStreak:
		n, err := strconv.Atoi(value)
		if err != nil {
			return fmt.Errorf("invalid integer for %s: %w", key, err)
		}
		cfg.CooldownDisableStreak = n
	case OptChannelHealthCooldownMaxEjectionPct:
		n, err := strconv.Atoi(value)
		if err != nil {
			return fmt.Errorf("invalid integer for %s: %w", key, err)
		}
		cfg.CooldownMaxEjectionPercent = n
	case OptChannelHealthCooldownAlpha:
		f, err := strconv.ParseFloat(value, 64)
		if err != nil {
			return fmt.Errorf("invalid float for %s: %w", key, err)
		}
		if math.IsNaN(f) || math.IsInf(f, 0) {
			return fmt.Errorf("invalid finite float for %s", key)
		}
		cfg.CooldownAlpha = f
	}
	return nil
}
