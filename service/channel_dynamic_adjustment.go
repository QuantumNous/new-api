package service

import "fmt"

const (
	DynamicHealthHealthy   = "healthy"
	DynamicHealthDegraded  = "degraded"
	DynamicHealthUnhealthy = "unhealthy"
	DynamicHealthUnknown   = "unknown"

	DynamicSourceUnknown       = "unknown"
	DynamicSourceIkun          = "ikun"
	DynamicSourceFoxcode       = "foxcode"
	DynamicSourcePlatformProbe = "platform_probe"

	DynamicActionNone                 = "none"
	DynamicActionAdjustWeight         = "adjust_weight"
	DynamicActionDisableAbility       = "disable_ability"
	DynamicActionProtectLastAvailable = "protect_last_available"
	DynamicActionRestoreBaseline      = "restore_baseline"
)

type DynamicAdjustmentPolicy struct {
	DegradedWeightMultiplier       float64
	ProtectedUnhealthyMultiplier   float64
	PriorityDowngradeLatencyMS     int
	MinimumWeight                  uint
	LastAvailableProtectionEnabled bool
}

type DynamicAbilitySnapshot struct {
	ChannelID int
	Group     string
	Model     string
	Enabled   bool
	Priority  *int64
	Weight    uint
}

type DynamicHealthSnapshot struct {
	State        string
	Status       int
	Availability float64
	Latency      int
	Source       string
	Reason       string
}

type DynamicOverrideSnapshot struct {
	Active       bool
	BaseEnabled  bool
	BasePriority *int64
	BaseWeight   uint
}

type DynamicAdjustmentInput struct {
	Ability          DynamicAbilitySnapshot
	Health           DynamicHealthSnapshot
	ExistingOverride *DynamicOverrideSnapshot
	Settings         DynamicAdjustmentPolicy
	LastAvailable    bool
}

type DynamicAdjustmentPlan struct {
	Action          string
	State           string
	Source          string
	AppliedEnabled  bool
	AppliedPriority *int64
	AppliedWeight   uint
	Protected       bool
	Reason          string
}

func DefaultDynamicAdjustmentPolicy() DynamicAdjustmentPolicy {
	return DynamicAdjustmentPolicy{
		DegradedWeightMultiplier:       0.5,
		ProtectedUnhealthyMultiplier:   0.3,
		PriorityDowngradeLatencyMS:     1500,
		MinimumWeight:                  1,
		LastAvailableProtectionEnabled: true,
	}
}

func PlanChannelDynamicAdjustment(input DynamicAdjustmentInput) DynamicAdjustmentPlan {
	policy := normalizeDynamicAdjustmentPolicy(input.Settings)
	plan := DynamicAdjustmentPlan{
		Action:          DynamicActionNone,
		State:           input.Health.State,
		Source:          firstNonEmpty(input.Health.Source, DynamicSourceUnknown),
		AppliedEnabled:  input.Ability.Enabled,
		AppliedPriority: cloneInt64Ptr(input.Ability.Priority),
		AppliedWeight:   input.Ability.Weight,
		Reason:          input.Health.Reason,
	}

	switch input.Health.State {
	case DynamicHealthHealthy:
		if input.ExistingOverride != nil && input.ExistingOverride.Active {
			plan.Action = DynamicActionRestoreBaseline
			plan.AppliedEnabled = input.ExistingOverride.BaseEnabled
			plan.AppliedPriority = cloneInt64Ptr(input.ExistingOverride.BasePriority)
			plan.AppliedWeight = input.ExistingOverride.BaseWeight
			plan.Reason = firstNonEmpty(plan.Reason, "health recovered; restore dynamic baseline")
		}
	case DynamicHealthDegraded:
		plan.Action = DynamicActionAdjustWeight
		plan.AppliedEnabled = true
		plan.AppliedWeight = scaledWeight(input.Ability.Weight, policy.DegradedWeightMultiplier, policy.MinimumWeight)
		if input.Health.Latency >= policy.PriorityDowngradeLatencyMS && input.Ability.Priority != nil {
			downgraded := *input.Ability.Priority - 1
			plan.AppliedPriority = &downgraded
		}
		plan.Reason = firstNonEmpty(plan.Reason, fmt.Sprintf("degraded availability=%.2f status=%d latency=%d", input.Health.Availability, input.Health.Status, input.Health.Latency))
	case DynamicHealthUnhealthy:
		if input.LastAvailable && policy.LastAvailableProtectionEnabled {
			plan.Action = DynamicActionProtectLastAvailable
			plan.AppliedEnabled = true
			plan.AppliedWeight = scaledWeight(input.Ability.Weight, policy.ProtectedUnhealthyMultiplier, policy.MinimumWeight)
			plan.Protected = true
			plan.Reason = firstNonEmpty(plan.Reason, "last available channel protected from disable")
			return plan
		}
		plan.Action = DynamicActionDisableAbility
		plan.AppliedEnabled = false
		plan.Reason = firstNonEmpty(plan.Reason, fmt.Sprintf("unhealthy availability=%.2f status=%d", input.Health.Availability, input.Health.Status))
	case DynamicHealthUnknown:
		plan.Reason = firstNonEmpty(plan.Reason, "status unknown; no dynamic action")
	default:
		plan.State = DynamicHealthUnknown
		plan.Reason = firstNonEmpty(plan.Reason, "unsupported health state; no dynamic action")
	}

	return plan
}

func normalizeDynamicAdjustmentPolicy(policy DynamicAdjustmentPolicy) DynamicAdjustmentPolicy {
	defaultPolicy := DefaultDynamicAdjustmentPolicy()
	if policy.DegradedWeightMultiplier <= 0 || policy.DegradedWeightMultiplier >= 1 {
		policy.DegradedWeightMultiplier = defaultPolicy.DegradedWeightMultiplier
	}
	if policy.ProtectedUnhealthyMultiplier <= 0 || policy.ProtectedUnhealthyMultiplier >= 1 {
		policy.ProtectedUnhealthyMultiplier = defaultPolicy.ProtectedUnhealthyMultiplier
	}
	if policy.PriorityDowngradeLatencyMS <= 0 {
		policy.PriorityDowngradeLatencyMS = defaultPolicy.PriorityDowngradeLatencyMS
	}
	if policy.MinimumWeight == 0 {
		policy.MinimumWeight = defaultPolicy.MinimumWeight
	}
	return policy
}

func scaledWeight(base uint, multiplier float64, minimum uint) uint {
	if base == 0 {
		return 0
	}
	scaled := uint(float64(base) * multiplier)
	if scaled < minimum {
		return minimum
	}
	if scaled >= base {
		return base
	}
	return scaled
}

func cloneInt64Ptr(value *int64) *int64 {
	if value == nil {
		return nil
	}
	cloned := *value
	return &cloned
}
