package oauth

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

func resolveMappedGroupCandidates(candidates []string, config *model.CustomOAuthProvider) string {
	if len(candidates) == 0 {
		return ""
	}
	mapping := parseStringMapping(config.GroupMapping)
	for _, candidate := range candidates {
		if mapped, ok := mapping[candidate]; ok {
			if isExistingGroup(mapped) {
				return mapped
			}
			continue
		}
		if isMappingFirstMode(config.GroupMappingMode) && isExistingGroup(candidate) {
			return candidate
		}
	}
	return ""
}

func resolveMappedRoleCandidates(candidates []string, config *model.CustomOAuthProvider) int {
	if len(candidates) == 0 {
		return 0
	}
	mapping := parseStringMapping(config.RoleMapping)
	for _, candidate := range candidates {
		if mapped, ok := mapping[candidate]; ok {
			if role := parseRoleValue(mapped); role != 0 {
				return role
			}
			continue
		}
		if isMappingFirstMode(config.RoleMappingMode) {
			if role := parseRoleValue(candidate); role != 0 {
				return role
			}
		}
	}
	return 0
}

func isMappingFirstMode(mode string) bool {
	return strings.EqualFold(strings.TrimSpace(mode), model.CustomOAuthMappingModeMappingFirst)
}

func parseRoleValue(raw string) int {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "common", "user", "member", "1":
		return common.RoleCommonUser
	case "admin", "administrator", "10":
		return common.RoleAdminUser
	default:
		return 0
	}
}
