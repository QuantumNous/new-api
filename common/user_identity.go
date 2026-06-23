package common

import "strings"

const (
	PLGGroup           = "plg"
	LegacyDefaultGroup = "default"
)

func NormalizeUserIdentityGroup(group string) string {
	group = strings.TrimSpace(group)
	if group == "" || group == LegacyDefaultGroup {
		return PLGGroup
	}
	return group
}

func IsPLGIdentityGroup(group string) bool {
	return NormalizeUserIdentityGroup(group) == PLGGroup
}

func IsEnterpriseIdentity(group string, role int) bool {
	if role >= RoleAdminUser {
		return true
	}
	return !IsPLGIdentityGroup(group)
}
