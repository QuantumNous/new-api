package channel

import (
	"sync"
	"time"

	"github.com/QuantumNous/new-api/relaykit/types"
)

// HealthBridge carries the capability-side health store entry points.
// Registered once by internal/catalog in its init().
type HealthBridge struct {
	ClassifyOutcome        func(err *types.NewAPIError, channelID int) ChannelOutcome
	RecordChannelOutcome   func(channelID int, outcome ChannelOutcome)
	RecordRequestAttempts  func(attempts []ChannelAttempt, winnerID int, winnerModel string, succeeded bool)
	RecordOutcome          func(channelID int, success bool)
	EffectiveWeight        func(channelID int, baseWeight uint) float64
	RoutingWeight          func(channelID int, baseWeight uint, bypassCooldown bool) float64
	BridgeCooldownDuration func(cfg *ChannelHealthSetting, priorActivations int) time.Duration
	Reset                  func()
	GetScore               func(channelID int) float64
	FilterCoolingChannels  func(channelIDs []int, maxEjectionPercent int) map[int]bool
	SnapshotCooldownState  func(channelID int) (CooldownStateSnapshot, bool)
	ResetForTest           func()
}

var healthBridge *HealthBridge

// RegisterHealthBridge installs the capability health store implementation
// behind the package-level wrappers below.
func RegisterHealthBridge(b HealthBridge) {
	healthBridge = &b
}

// ChannelHealthManager tracks per-channel EWMA success-rate scores in memory.
// It is a thin forwarding facade; the business logic lives in
// internal/catalog.HealthStore and is accessed via HealthBridge.
// When the bridge is not registered (e.g., model-only tests), a local fallback
// implementation provides the same behavior.
type ChannelHealthManager struct {
	fallback *localHealthManager
}

// localHealthManager provides the fallback health scoring implementation
// for when the capability bridge is not registered.
type localHealthManager struct {
	mu     sync.Mutex
	states map[int]*ChannelHealthState
}

var channelHealthOnce sync.Once
var channelHealth *ChannelHealthManager

// Exported so capabilities/channel can access fields directly.
type ChannelHealthState struct {
	EwmaScore       float64        // range [MinScore, 1.0]
	RequestCount    int            // guard: don't trust EWMA until min_requests reached
	UnauthorizedRun int            // consecutive 401s for escalation classification
	RampExited      bool           // slow-start warm-up abandoned after a real failure
	RampPending     bool           // post-cooldown first selection starts at the ramp floor
	FailureStreak   int            // consecutive fatal/throttled outcomes (channel scope)
	ModelFailures   map[string]int // consecutive fatal outcomes attributed to each model
	CooldownStreak  int            // number of successive cooldown activations
	CooldownUntil   time.Time      // lazy expiry deadline; zero means "not cooling"
	ModelCooldowns  map[string]int // cooldown activations attributed to each model
}

// CooldownStateSnapshot is a serializable snapshot of a channel's cooldown
// state for testing and inspection.
type CooldownStateSnapshot struct {
	RequestCount   int
	RampPending    bool
	RampExited     bool
	CooldownStreak int
}

// ChannelHealthNow is the package clock, injected for deterministic tests.
// Production code reads it unchanged; tests replace it and restore it via
// t.Cleanup so no test leaks a frozen clock into another.
var ChannelHealthNow = time.Now

// DefaultScore is the score a channel holds when it has no history or fewer
// than min_requests observations. It means "trust the channel until we have
// enough data to judge."
const DefaultScore = 1.0

// ThrottledObservation is the EWMA observation fed for OutcomeThrottled.
// With the default Alpha of 0.3 a permanently throttled channel converges to
// this value, i.e. roughly a 30% derate, and climbs back to full health within
// about ten successful requests.
const ThrottledObservation = 0.7

// UnauthorizedEscalationThreshold is how many consecutive upstream 401s on one
// channel escalate from OutcomeNeutral to OutcomeFatal. A single 401 is usually
// a caller-side problem, but a sustained run means the channel credential is
// dead and will not self-heal. Three follows Envoy, whose
// consecutive_gateway_failure defaults to 3 while consecutive_5xx defaults to 5.
const UnauthorizedEscalationThreshold = 3

// Backward-compatible aliases for tests that reference the old unexported names.
const (
	defaultScore         = DefaultScore
	throttledObservation = ThrottledObservation
)

type channelHealthState = ChannelHealthState

// countModelFailure records one fatal outcome against modelName. The run is
// tracked per model rather than on the channel-level FailureStreak because a
// healthy sibling's successes reset that streak: a dead model sharing a channel
// would otherwise never accumulate enough failures to be retired, and whichever
// model happened to be in flight when the channel tripped took the blame.
// Throttled outcomes are deliberately not counted here — a 429 is a busy
// upstream, not evidence that this model is gone.
func countModelFailure(state *ChannelHealthState, modelName string) {
	if modelName == "" {
		return
	}
	if state.ModelFailures == nil {
		state.ModelFailures = make(map[string]int, 1)
	}
	state.ModelFailures[modelName]++
}

// clearModelFailures ends one model's failure run. Only that model's run ends:
// a sibling's request says nothing about this model.
func clearModelFailures(state *ChannelHealthState, modelName string) {
	if modelName == "" || state.ModelFailures == nil {
		return
	}
	delete(state.ModelFailures, modelName)
}

// decayModelCooldown pays down one model's accumulated cooldown count after a
// successful request through that pair. The escalation count exists to detect
// sustained trouble, so it has to fall as well as rise: when only the disable
// itself ever clears the entry, the count is a lifetime total and cooldowns
// spread over months retire a model that has served fine ever since.
func decayModelCooldown(state *ChannelHealthState, modelName string) {
	if modelName == "" || state.ModelCooldowns == nil {
		return
	}
	count, ok := state.ModelCooldowns[modelName]
	if !ok {
		return
	}
	if count <= 1 {
		delete(state.ModelCooldowns, modelName)
		return
	}
	state.ModelCooldowns[modelName] = count - 1
}

// ChannelModelDisabler disables one model on one channel once its cooldowns
// saturate. It is a package var so tests can capture the call instead of
// touching the database, and so the model layer keeps owning the DB write.
var ChannelModelDisabler = DisableChannelModel

// Backward-compatible aliases for tests that reference the old unexported names.
var channelModelDisabler = ChannelModelDisabler

// bridgeSlowStartFactor scales a channel's routing weight during its warm-up window.
// Kept for model package tests; implementation mirrors track_health.go.
func bridgeSlowStartFactor(state *channelHealthState, minRequests int) float64 {
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

// Wire the kill-switch cleanup here rather than in operation_setting, which must
// not import this package. Toggling the switch off discards accumulated scores
// and resets the route-unit machine, so re-enabling starts from a clean slate
// instead of resurrecting a cooldown armed before the toggle.
func init() {
	RegisterHealthStateResetHook(func() {
		GetChannelHealthManager().Reset()
		resetUnitHealthStateForKillSwitch()
	})
}

// ChannelOutcome categorizes the result of a channel request for routing and
// health-score purposes. Outcomes are used by ClassifyChannelOutcome and
// RecordChannelOutcome; they do not affect the existing RecordOutcome API.
type ChannelOutcome int

const (
	// OutcomeSuccess means the request completed successfully (2xx response).
	// This is the healthiest outcome; the channel is fully trusted.
	OutcomeSuccess ChannelOutcome = iota

	// OutcomeFatal means the channel has a serious error (5xx, bad response body,
	// or local channel:* errors). The channel should be excluded from routing.
	OutcomeFatal

	// OutcomeThrottled means the channel received a 429 response. The channel is
	// healthy but currently rate-limited. A mild derate is applied; the channel
	// can recover with successful requests.
	OutcomeThrottled

	// OutcomeNeutral means the request resulted in a non-fatal, non-throttling
	// error (400, 403, 404, 422, or isolated 401). The channel is neither
	// rewarded nor penalized; its score is unchanged.
	OutcomeNeutral
)

// AffectsHealth returns true if this outcome affects the channel's health score.
// Success, Fatal, and Throttled all update the EWMA; Neutral does not.
func (o ChannelOutcome) AffectsHealth() bool {
	return o == OutcomeSuccess || o == OutcomeFatal || o == OutcomeThrottled
}

// ExcludesChannel returns true if this outcome excludes the channel from
// routing consideration. Fatal and Throttled exclude the channel; Success and
// Neutral do not.
func (o ChannelOutcome) ExcludesChannel() bool {
	return o == OutcomeFatal || o == OutcomeThrottled
}

// ResetChannelHealthManagerForTest swaps in a fresh manager singleton so
// capability-package tests start from a clean state machine.
func ResetChannelHealthManagerForTest() *ChannelHealthManager {
	channelHealthOnce = sync.Once{}
	if healthBridge != nil && healthBridge.ResetForTest != nil {
		healthBridge.ResetForTest()
	}
	return GetChannelHealthManager()
}

// SnapshotCooldownStateForTest returns the tracked state of one channel;
// ok is false when the manager has no state for it.
func (m *ChannelHealthManager) SnapshotCooldownStateForTest(channelID int) (snap CooldownStateSnapshot, ok bool) {
	if healthBridge != nil && healthBridge.SnapshotCooldownState != nil {
		return healthBridge.SnapshotCooldownState(channelID)
	}
	if m.fallback != nil {
		return m.fallback.snapshotCooldownState(channelID)
	}
	return CooldownStateSnapshot{}, false
}

// GetChannelHealthManager returns the singleton manager.
func GetChannelHealthManager() *ChannelHealthManager {
	channelHealthOnce.Do(func() {
		channelHealth = &ChannelHealthManager{
			fallback: &localHealthManager{states: make(map[int]*ChannelHealthState)},
		}
	})
	return channelHealth
}

// ClassifyChannelOutcome categorizes an API error into a ChannelOutcome.
// The function is concurrency-safe and does NOT respect the kill switch;
// classification drives request-level exclusion, which should always operate.
func ClassifyChannelOutcome(err *types.NewAPIError, channelID int) ChannelOutcome {
	if healthBridge != nil && healthBridge.ClassifyOutcome != nil {
		return healthBridge.ClassifyOutcome(err, channelID)
	}
	return GetChannelHealthManager().fallback.classifyChannelOutcome(err, channelID)
}

// RecordChannelOutcome updates the EWMA score for a channel based on a
// ChannelOutcome. The kill switch gates health scoring only.
func (m *ChannelHealthManager) RecordChannelOutcome(channelID int, outcome ChannelOutcome) {
	if healthBridge != nil && healthBridge.RecordChannelOutcome != nil {
		healthBridge.RecordChannelOutcome(channelID, outcome)
	} else if m.fallback != nil {
		m.fallback.recordChannelOutcome(channelID, "", outcome)
	}
}

// RecordRequestAttempts applies health accounting once for a whole client
// request, rather than once per failed try.
func (m *ChannelHealthManager) RecordRequestAttempts(attempts []ChannelAttempt, winnerID int, winnerModel string, succeeded bool) {
	if healthBridge != nil && healthBridge.RecordRequestAttempts != nil {
		healthBridge.RecordRequestAttempts(attempts, winnerID, winnerModel, succeeded)
	} else if m.fallback != nil {
		m.fallback.recordRequestAttempts(attempts, winnerID, winnerModel, succeeded)
	}
}

// RecordOutcome updates the EWMA score for a channel after a request (legacy API).
// success=true means the request succeeded; false means it failed.
// The kill switch is checked: if disabled, the method returns immediately.
func (m *ChannelHealthManager) RecordOutcome(channelID int, success bool) {
	if healthBridge != nil && healthBridge.RecordOutcome != nil {
		healthBridge.RecordOutcome(channelID, success)
	} else if m.fallback != nil {
		m.fallback.recordOutcome(channelID, success)
	}
}

// EffectiveWeight returns the routing weight for a channel, scaled by its EWMA
// health score and slow-start factor. A channel in live cooldown weighs zero.
func (m *ChannelHealthManager) EffectiveWeight(channelID int, baseWeight uint) float64 {
	if healthBridge != nil && healthBridge.EffectiveWeight != nil {
		return healthBridge.EffectiveWeight(channelID, baseWeight)
	}
	if m.fallback != nil {
		return m.fallback.routingWeight(channelID, baseWeight, false)
	}
	return float64(baseWeight)
}

// RoutingWeight is the shared health/cooldown weight path. EffectiveWeight calls
// it with bypassCooldown=false. Selectors call it with true for cooling
// candidates deliberately retained by the max-ejection cap.
func (m *ChannelHealthManager) RoutingWeight(channelID int, baseWeight uint, bypassCooldown bool) float64 {
	if healthBridge != nil && healthBridge.RoutingWeight != nil {
		return healthBridge.RoutingWeight(channelID, baseWeight, bypassCooldown)
	}
	if m.fallback != nil {
		return m.fallback.routingWeight(channelID, baseWeight, bypassCooldown)
	}
	return float64(baseWeight)
}

// BridgeCooldownDuration computes the sliding cooldown duration.
func BridgeCooldownDuration(cfg *ChannelHealthSetting, priorActivations int) time.Duration {
	if healthBridge != nil && healthBridge.BridgeCooldownDuration != nil {
		return healthBridge.BridgeCooldownDuration(cfg, priorActivations)
	}
	return cooldownDurationCalc(cfg, priorActivations)
}

// Reset clears all health state. Called when the kill switch is toggled off.
func (m *ChannelHealthManager) Reset() {
	if healthBridge != nil && healthBridge.Reset != nil {
		healthBridge.Reset()
	} else if m.fallback != nil {
		m.fallback.reset()
	}
}

// GetScore returns the current EWMA score for diagnostics (e.g., admin API).
func (m *ChannelHealthManager) GetScore(channelID int) float64 {
	if healthBridge != nil && healthBridge.GetScore != nil {
		return healthBridge.GetScore(channelID)
	}
	if m.fallback != nil {
		return m.fallback.getScore(channelID)
	}
	return DefaultScore
}

// FilterCoolingChannels reports which of channelIDs must be removed from a
// priority tier because they are in a live cooldown.
func (m *ChannelHealthManager) FilterCoolingChannels(channelIDs []int, maxEjectionPercent int) map[int]bool {
	if healthBridge != nil && healthBridge.FilterCoolingChannels != nil {
		return healthBridge.FilterCoolingChannels(channelIDs, maxEjectionPercent)
	}
	if m.fallback != nil {
		return m.fallback.filterCoolingChannels(channelIDs, maxEjectionPercent)
	}
	return nil
}

// ChannelAttempt is one channel try inside a single client request. The relay
// loop collects these so health accounting can wait until the request's final
// outcome is known. ModelName is what the attempt asked the channel for, which
// is what a repeated-cooldown disable is attributed to.
type ChannelAttempt struct {
	ChannelID int
	ModelName string
	Outcome   ChannelOutcome
}
