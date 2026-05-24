package service

import "testing"

func int64PtrForDynamicTest(v int64) *int64 {
	return &v
}

func TestPlanDynamicAdjustment_DegradedLowersWeightOnly(t *testing.T) {
	plan := PlanChannelDynamicAdjustment(DynamicAdjustmentInput{
		Ability: DynamicAbilitySnapshot{
			ChannelID: 1,
			Group:     "default",
			Model:     "gpt-4o",
			Enabled:   true,
			Priority:  int64PtrForDynamicTest(10),
			Weight:    100,
		},
		Health: DynamicHealthSnapshot{
			State:        DynamicHealthDegraded,
			Status:       2,
			Availability: 86,
			Latency:      900,
			Source:       DynamicSourceIkun,
		},
		Settings: DefaultDynamicAdjustmentPolicy(),
	})

	if plan.Action != DynamicActionAdjustWeight {
		t.Fatalf("Action = %q, want %q", plan.Action, DynamicActionAdjustWeight)
	}
	if plan.AppliedWeight != 50 {
		t.Fatalf("AppliedWeight = %d, want 50", plan.AppliedWeight)
	}
	if plan.AppliedPriority == nil || *plan.AppliedPriority != 10 {
		t.Fatalf("AppliedPriority = %v, want 10", plan.AppliedPriority)
	}
	if plan.AppliedEnabled != true {
		t.Fatalf("AppliedEnabled = %v, want true", plan.AppliedEnabled)
	}
}

func TestPlanDynamicAdjustment_UnhealthyDisablesAbility(t *testing.T) {
	plan := PlanChannelDynamicAdjustment(DynamicAdjustmentInput{
		Ability: DynamicAbilitySnapshot{
			ChannelID: 2,
			Group:     "default",
			Model:     "claude-sonnet-4",
			Enabled:   true,
			Priority:  int64PtrForDynamicTest(8),
			Weight:    80,
		},
		Health: DynamicHealthSnapshot{
			State:        DynamicHealthUnhealthy,
			Status:       0,
			Availability: 20,
			Source:       DynamicSourcePlatformProbe,
		},
		Settings: DefaultDynamicAdjustmentPolicy(),
	})

	if plan.Action != DynamicActionDisableAbility {
		t.Fatalf("Action = %q, want %q", plan.Action, DynamicActionDisableAbility)
	}
	if plan.AppliedEnabled {
		t.Fatalf("AppliedEnabled = true, want false")
	}
}

func TestPlanDynamicAdjustment_LastAvailableProtectsFromDisable(t *testing.T) {
	plan := PlanChannelDynamicAdjustment(DynamicAdjustmentInput{
		Ability: DynamicAbilitySnapshot{
			ChannelID: 3,
			Group:     "vip",
			Model:     "gptproto",
			Enabled:   true,
			Priority:  int64PtrForDynamicTest(6),
			Weight:    70,
		},
		Health: DynamicHealthSnapshot{
			State:        DynamicHealthUnhealthy,
			Status:       0,
			Availability: 0,
			Source:       DynamicSourcePlatformProbe,
		},
		Settings:      DefaultDynamicAdjustmentPolicy(),
		LastAvailable: true,
	})

	if plan.Action != DynamicActionProtectLastAvailable {
		t.Fatalf("Action = %q, want %q", plan.Action, DynamicActionProtectLastAvailable)
	}
	if !plan.Protected {
		t.Fatalf("Protected = false, want true")
	}
	if !plan.AppliedEnabled {
		t.Fatalf("AppliedEnabled = false, want true")
	}
	if plan.AppliedWeight >= 70 {
		t.Fatalf("AppliedWeight = %d, want reduced weight", plan.AppliedWeight)
	}
}

func TestPlanDynamicAdjustment_UnknownDoesNothing(t *testing.T) {
	plan := PlanChannelDynamicAdjustment(DynamicAdjustmentInput{
		Ability: DynamicAbilitySnapshot{
			ChannelID: 4,
			Group:     "default",
			Model:     "unmapped-model",
			Enabled:   true,
			Priority:  int64PtrForDynamicTest(1),
			Weight:    30,
		},
		Health: DynamicHealthSnapshot{
			State:  DynamicHealthUnknown,
			Source: DynamicSourceUnknown,
		},
		Settings: DefaultDynamicAdjustmentPolicy(),
	})

	if plan.Action != DynamicActionNone {
		t.Fatalf("Action = %q, want %q", plan.Action, DynamicActionNone)
	}
	if plan.AppliedWeight != 30 {
		t.Fatalf("AppliedWeight = %d, want 30", plan.AppliedWeight)
	}
}

func TestPlanDynamicAdjustment_HealthyRestoresOnlyDynamicOverride(t *testing.T) {
	plan := PlanChannelDynamicAdjustment(DynamicAdjustmentInput{
		Ability: DynamicAbilitySnapshot{
			ChannelID: 5,
			Group:     "default",
			Model:     "gpt-4o-mini",
			Enabled:   false,
			Priority:  int64PtrForDynamicTest(8),
			Weight:    20,
		},
		Health: DynamicHealthSnapshot{
			State:        DynamicHealthHealthy,
			Status:       1,
			Availability: 100,
			Source:       DynamicSourceIkun,
		},
		ExistingOverride: &DynamicOverrideSnapshot{
			Active:       true,
			BaseEnabled:  true,
			BasePriority: int64PtrForDynamicTest(10),
			BaseWeight:   100,
		},
		Settings: DefaultDynamicAdjustmentPolicy(),
	})

	if plan.Action != DynamicActionRestoreBaseline {
		t.Fatalf("Action = %q, want %q", plan.Action, DynamicActionRestoreBaseline)
	}
	if !plan.AppliedEnabled {
		t.Fatalf("AppliedEnabled = false, want true")
	}
	if plan.AppliedPriority == nil || *plan.AppliedPriority != 10 {
		t.Fatalf("AppliedPriority = %v, want 10", plan.AppliedPriority)
	}
	if plan.AppliedWeight != 100 {
		t.Fatalf("AppliedWeight = %d, want 100", plan.AppliedWeight)
	}
}
