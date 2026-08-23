package operation_setting

import "testing"

func TestCheckinSettingQuotaRangeNormalizesValues(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		setting CheckinSetting
		wantMin int
		wantMax int
	}{
		{
			name:    "ordered range is unchanged",
			setting: CheckinSetting{MinQuota: 1000, MaxQuota: 10000},
			wantMin: 1000,
			wantMax: 10000,
		},
		{
			name:    "inverted range is swapped",
			setting: CheckinSetting{MinQuota: 8000, MaxQuota: 2000},
			wantMin: 2000,
			wantMax: 8000,
		},
		{
			name:    "negative values are clamped",
			setting: CheckinSetting{MinQuota: -5, MaxQuota: -1},
			wantMin: 0,
			wantMax: 0,
		},
		{
			name:    "equal values stay equal",
			setting: CheckinSetting{MinQuota: 500, MaxQuota: 500},
			wantMin: 500,
			wantMax: 500,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			minQuota, maxQuota := tt.setting.QuotaRange()
			if minQuota != tt.wantMin || maxQuota != tt.wantMax {
				t.Fatalf("QuotaRange() = (%d, %d), want (%d, %d)", minQuota, maxQuota, tt.wantMin, tt.wantMax)
			}
		})
	}
}
