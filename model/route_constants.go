package model

// RouteState is the persisted health state of a channel×effective_model route (PRD §8.1 / §31).
type RouteState string

const (
	RouteUnknown          RouteState = "UNKNOWN"
	RouteHealthy          RouteState = "HEALTHY"
	RouteRateLimited      RouteState = "RATE_LIMITED"
	RouteOpen             RouteState = "OPEN"
	RouteProbing          RouteState = "PROBING"
	RouteRecovering       RouteState = "RECOVERING"
	RouteManuallyDisabled RouteState = "MANUALLY_DISABLED"
)

// RouteRole is a process-local runtime role; not persisted (PRD §8.2 / §31).
type RouteRole string

const (
	RoleNone      RouteRole = "NONE"
	RoleBootstrap RouteRole = "BOOTSTRAP"
	RolePrimary   RouteRole = "PRIMARY"
	RoleOverflow  RouteRole = "OVERFLOW"
)

// ErrorClass classifies production failures for breaker logic (PRD §25 / §31).
type ErrorClass string

const (
	ErrorTemporary     ErrorClass = "TEMPORARY"
	ErrorDeterministic ErrorClass = "DETERMINISTIC"
)

// Policy source markers (PRD §5.3).
const (
	PolicySourceConfigured  = "configured"
	PolicySourceMapped      = "mapped"
	PolicySourceObserved    = "observed"
	PolicySourceLazyCreated = "lazy_created"
)

// Routing mode option keys / values (PRD §33).
const (
	RoutingPriorityModeKey      = "routing_priority_mode"
	RoutingPriorityModeChannel  = "channel_priority"
	RoutingPriorityModeModel    = "model_priority"
	RoutingBehaviorModeKey      = "routing_behavior_mode"
	RoutingBehaviorExperienceFirst = "experience_first"
	RoutingBehaviorPriorityFirst   = "priority_first"
)

// Default routing / probe / lease / emergency parameters (PRD §33).
const (
	DefaultSuccessEMAAlpha              = 0.10
	DefaultTTFTEMAAlpha                 = 0.20
	DefaultTemporaryErrorEMAAlpha       = 0.25
	DefaultRateLimitEMAAlpha            = 0.30
	DefaultStreamInterruptionEMAAlpha   = 0.30
	DefaultTemporaryFailureConsecutive  = 2
	DefaultTemporaryFailureWindowSize   = 10
	DefaultTemporaryFailureWindowThresh = 3
	DefaultRecoverSuccessThreshold      = 3
	DefaultFirstStandbyShadowSampleRate = 0.05
	DefaultOtherStandbyShadowSampleRate = 0.01
	DefaultShadowProbeMaxTokens         = 16
	DefaultShadowProbeMaxConcurrency    = 1
	DefaultOverflowSwitchImprovement    = 0.20
	DefaultStableOverflowRatioThreshold = 0.50
)

// Duration defaults as nanoseconds for time.Duration construction without importing time in all call sites.
const (
	DefaultRateLimitCooldownSec           = 60
	DefaultOpenInitialCooldownSec         = 30
	DefaultOpenMaxCooldownSec             = 30 * 60
	DefaultFirstStandbyMaxProbeIntervalSec = 2 * 60
	DefaultOtherStandbyMaxProbeIntervalSec = 10 * 60
	DefaultStaleMinimumAfterSec           = 30 * 60
	DefaultShadowProbeTimeoutSec          = 15
	DefaultOverflowLeaseDurationSec       = 60
	DefaultOverflowLeaseMinHoldSec        = 30
	DefaultStableOverflowConfirmSec       = 30
	DefaultEmergencyTotalDeadlineSec      = 20
	DefaultEmergencyWaiterDeadlineSec     = 8
	DefaultEmergencyPerAttemptTimeoutSec  = 6
	DefaultCalibrationSnapshotIntervalSec = 60
	DefaultCalibrationFullConfidenceDays  = 7
	DefaultCalibrationExpireDays          = 30
)

// Rate-limit backoff ladder seconds (PRD §24): 60 → 120 → 300 → 600.
var DefaultRateLimitBackoffSeconds = []int{60, 120, 300, 600}

// Open-circuit backoff ladder seconds (PRD §25): 30 → 60 → 120 → 300 → 900 → 1800.
var DefaultOpenBackoffSeconds = []int{30, 60, 120, 300, 900, 1800}

// Calibration prompt-token bucket labels (PRD §16).
const (
	CalibrationBucket0To1k   = "0-1k"
	CalibrationBucket1kTo4k  = "1k-4k"
	CalibrationBucket4kTo16k = "4k-16k"
	CalibrationBucket16kPlus = "16k+"
)
