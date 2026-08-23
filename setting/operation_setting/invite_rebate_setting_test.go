package operation_setting

import "testing"

func TestInviteRebateSettingNormalizedAndEnabled(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		setting     InviteRebateSetting
		wantTimes   int
		wantPercent float64
		wantEnabled bool
	}{
		{
			name:        "disabled by default",
			setting:     InviteRebateSetting{},
			wantTimes:   0,
			wantPercent: 0,
			wantEnabled: false,
		},
		{
			name:        "valid rebate",
			setting:     InviteRebateSetting{Times: 3, Percent: 15},
			wantTimes:   3,
			wantPercent: 15,
			wantEnabled: true,
		},
		{
			name:        "zero percent disables",
			setting:     InviteRebateSetting{Times: 3, Percent: 0},
			wantTimes:   3,
			wantPercent: 0,
			wantEnabled: false,
		},
		{
			name:        "negative values clamp",
			setting:     InviteRebateSetting{Times: -2, Percent: -8},
			wantTimes:   0,
			wantPercent: 0,
			wantEnabled: false,
		},
		{
			name:        "upper bounds clamp",
			setting:     InviteRebateSetting{Times: 500, Percent: 150},
			wantTimes:   MaxInviteRebateTimes,
			wantPercent: 100,
			wantEnabled: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			times, percent := tt.setting.Normalized()
			if times != tt.wantTimes || percent != tt.wantPercent {
				t.Fatalf("Normalized() = (%d, %v), want (%d, %v)", times, percent, tt.wantTimes, tt.wantPercent)
			}
			if got := tt.setting.Enabled(); got != tt.wantEnabled {
				t.Fatalf("Enabled() = %v, want %v", got, tt.wantEnabled)
			}
		})
	}
}

func TestValidateInviteRebateOptions(t *testing.T) {
	t.Parallel()

	if err := ValidateInviteRebateTimes("3"); err != nil {
		t.Fatalf("valid times rejected: %v", err)
	}
	if err := ValidateInviteRebateTimes("101"); err == nil {
		t.Fatal("expected times above max to fail")
	}
	if err := ValidateInviteRebatePercent("15.5"); err != nil {
		t.Fatalf("valid percent rejected: %v", err)
	}
	if err := ValidateInviteRebatePercent("100.1"); err == nil {
		t.Fatal("expected percent above 100 to fail")
	}
}
