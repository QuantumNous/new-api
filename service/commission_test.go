package service

import "testing"

func TestShouldAutoVIPUpgrade(t *testing.T) {
	tests := []struct {
		name        string
		group       string
		recentMoney float64
		want        bool
	}{
		{
			name:        "default group at threshold upgrades",
			group:       "default",
			recentMoney: 20,
			want:        true,
		},
		{
			name:        "default group above threshold upgrades",
			group:       "default",
			recentMoney: 20.01,
			want:        true,
		},
		{
			name:        "default group below threshold does not upgrade",
			group:       "default",
			recentMoney: 19.99,
			want:        false,
		},
		{
			name:        "vip group is not touched",
			group:       "vip",
			recentMoney: 100,
			want:        false,
		},
		{
			name:        "svip group is not downgraded",
			group:       "svip",
			recentMoney: 100,
			want:        false,
		},
		{
			name:        "ssvip group is not downgraded",
			group:       "ssvip",
			recentMoney: 100,
			want:        false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := shouldAutoVIPUpgrade(tt.group, tt.recentMoney); got != tt.want {
				t.Fatalf("shouldAutoVIPUpgrade(%q, %.2f) = %v, want %v", tt.group, tt.recentMoney, got, tt.want)
			}
		})
	}
}
