package model

import (
	"testing"
)

func TestSubscriptionPlan_GetAllowedGroupsList(t *testing.T) {
	tests := []struct {
		name          string
		allowedGroups string
		want          []string
	}{
		{
			name:          "empty string",
			allowedGroups: "",
			want:          nil,
		},
		{
			name:          "single group",
			allowedGroups: "vip",
			want:          []string{"vip"},
		},
		{
			name:          "multiple groups",
			allowedGroups: "vip,premium,enterprise",
			want:          []string{"vip", "premium", "enterprise"},
		},
		{
			name:          "groups with spaces",
			allowedGroups: " vip , premium , enterprise ",
			want:          []string{"vip", "premium", "enterprise"},
		},
		{
			name:          "groups with empty entries",
			allowedGroups: "vip,,premium,",
			want:          []string{"vip", "premium"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p := &SubscriptionPlan{
				AllowedGroups: tt.allowedGroups,
			}
			got := p.GetAllowedGroupsList()
			if len(got) != len(tt.want) {
				t.Errorf("GetAllowedGroupsList() length = %v, want %v", len(got), len(tt.want))
				return
			}
			for i := range got {
				if got[i] != tt.want[i] {
					t.Errorf("GetAllowedGroupsList()[%d] = %v, want %v", i, got[i], tt.want[i])
				}
			}
		})
	}
}

func TestSubscriptionPlan_IsGroupAllowed(t *testing.T) {
	tests := []struct {
		name          string
		allowedGroups string
		testGroup     string
		want          bool
	}{
		{
			name:          "empty allowed groups - all allowed",
			allowedGroups: "",
			testGroup:     "any_group",
			want:          true,
		},
		{
			name:          "group is allowed",
			allowedGroups: "vip,premium",
			testGroup:     "vip",
			want:          true,
		},
		{
			name:          "group is not allowed",
			allowedGroups: "vip,premium",
			testGroup:     "default",
			want:          false,
		},
		{
			name:          "group with spaces",
			allowedGroups: " vip , premium ",
			testGroup:     "vip",
			want:          true,
		},
		{
			name:          "test group with spaces",
			allowedGroups: "vip,premium",
			testGroup:     " vip ",
			want:          true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p := &SubscriptionPlan{
				AllowedGroups: tt.allowedGroups,
			}
			if got := p.IsGroupAllowed(tt.testGroup); got != tt.want {
				t.Errorf("IsGroupAllowed() = %v, want %v", got, tt.want)
			}
		})
	}
}
