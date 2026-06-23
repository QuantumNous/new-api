package common

import "testing"

func TestNormalizeUserIdentityGroup(t *testing.T) {
	tests := []struct {
		name  string
		group string
		want  string
	}{
		{name: "empty", group: "", want: PLGGroup},
		{name: "spaces", group: "  ", want: PLGGroup},
		{name: "legacy default", group: LegacyDefaultGroup, want: PLGGroup},
		{name: "plg", group: PLGGroup, want: PLGGroup},
		{name: "enterprise custom", group: "vip", want: "vip"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := NormalizeUserIdentityGroup(tt.group); got != tt.want {
				t.Fatalf("NormalizeUserIdentityGroup(%q) = %q, want %q", tt.group, got, tt.want)
			}
		})
	}
}

func TestIsEnterpriseIdentity(t *testing.T) {
	tests := []struct {
		name  string
		group string
		role  int
		want  bool
	}{
		{name: "common plg", group: PLGGroup, role: RoleCommonUser, want: false},
		{name: "common legacy default", group: LegacyDefaultGroup, role: RoleCommonUser, want: false},
		{name: "common enterprise group", group: "vip", role: RoleCommonUser, want: true},
		{name: "admin in plg", group: PLGGroup, role: RoleAdminUser, want: true},
		{name: "root in default", group: LegacyDefaultGroup, role: RoleRootUser, want: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := IsEnterpriseIdentity(tt.group, tt.role); got != tt.want {
				t.Fatalf("IsEnterpriseIdentity(%q, %d) = %v, want %v", tt.group, tt.role, got, tt.want)
			}
		})
	}
}
