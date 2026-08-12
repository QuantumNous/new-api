package service

import (
	"errors"
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

// GetUserSelectableTokenGroups evaluates the one group authorization contract
// used by token selection, model/pricing lists, auto and request-time checks.
// A targeted policy is an additive grant to its immutable user IDs; it does
// not require the group to be in the global UserUsableGroups setting.
func GetUserSelectableTokenGroups(userId int) (map[string]string, error) {
	user, err := model.GetUserById(userId, false)
	if err != nil {
		return nil, err
	}
	legacyGroups := GetUserUsableGroups(user.Group)
	if !model.TokenGroupVisibilityEnabled() {
		return legacyGroups, nil
	}
	policies, err := model.GetTokenGroupVisibilityPolicies()
	if err != nil {
		return nil, err
	}
	mode := model.TokenGroupVisibilityMode()
	if mode == model.TokenGroupVisibilityModeInvalid {
		return nil, errors.New("令牌分组可见性运行模式无效，已拒绝授权")
	}
	v2Groups := applyTokenGroupVisibilityPolicies(legacyGroups, user.Id, policies, common.GetTimestamp())
	if mode == model.TokenGroupVisibilityModeShadow {
		for _, policy := range policies {
			_, legacyAllowed := legacyGroups[policy.Group]
			_, v2Allowed := v2Groups[policy.Group]
			if legacyAllowed != v2Allowed {
				common.SysLog(fmt.Sprintf("token_group_visibility_shadow user_id=%d group=%q legacy_allowed=%t v2_allowed=%t policy=%s", user.Id, policy.Group, legacyAllowed, v2Allowed, policy.Visibility))
			}
		}
		return legacyGroups, nil
	}
	if mode == model.TokenGroupVisibilityModeLegacy {
		return legacyGroups, nil
	}
	return v2Groups, nil
}

func applyTokenGroupVisibilityPolicies(groups map[string]string, userId int, policies []model.TokenGroupVisibilityPolicy, now int64) map[string]string {
	result := make(map[string]string, len(groups))
	for group, description := range groups {
		result[group] = description
	}
	for _, policy := range policies {
		inWindow := (policy.StartTime == 0 || now >= policy.StartTime) &&
			(policy.EndTime == 0 || now < policy.EndTime)
		switch policy.Visibility {
		case model.TokenGroupVisibilityHidden:
			// Hidden is fail-closed for the whole policy lifetime. An expired
			// hidden policy must not silently re-open a group.
			delete(result, policy.Group)
		case model.TokenGroupVisibilityTargeted:
			if !inWindow {
				delete(result, policy.Group)
				continue
			}
			allowed := false
			for _, targetUserId := range policy.UserIds {
				if targetUserId == userId {
					allowed = true
					break
				}
			}
			if !allowed {
				delete(result, policy.Group)
			} else if _, usable := result[policy.Group]; !usable {
				// Direct grant: the global "user selectable" switch is not an
				// authorization prerequisite for an explicitly targeted user.
				result[policy.Group] = GetUserSelectableTokenGroupsLegacyDescription(policy.Group)
			}
		case model.TokenGroupVisibilityPublic:
			// Public policies preserve the established base permission.
		default:
			// A malformed row must not widen an authorization boundary.
			delete(result, policy.Group)
		}
	}
	return result
}

// GetUserSelectableTokenGroupsLegacyDescription keeps descriptions stable for
// targeted groups that are intentionally not globally user-selectable.
func GetUserSelectableTokenGroupsLegacyDescription(group string) string {
	if desc := setting.GetUsableGroupDescription(group); desc != "" {
		return desc
	}
	if ratio_setting.ContainsGroupRatio(group) {
		return group
	}
	return ""
}

func ValidateUserSelectableTokenGroup(userId int, group string) error {
	return ValidateUserRuntimeGroup(userId, group)
}

// ValidateUserRuntimeGroup is the request-time authorization boundary for a
// resolved UsingGroup. It deliberately shares the live policy read used by
// token selection, so historical tokens and entitlement rewrites cannot skip
// targeted/hidden enforcement.
func ValidateUserRuntimeGroup(userId int, group string) error {
	if !model.TokenGroupVisibilityEnabled() || group == "" {
		return nil
	}
	groups, err := GetUserSelectableTokenGroups(userId)
	if err != nil {
		return err
	}
	if group == "auto" {
		// "auto" is a virtual token group. It is not itself a selectable
		// concrete group; authorize it only when at least one current auto
		// candidate remains visible to the user.
		if len(getAutoGroupsFromUsableGroups(groups)) == 0 {
			return errors.New("所选令牌自动分组当前不可用")
		}
		return nil
	}
	if _, ok := groups[group]; !ok {
		return errors.New("所选令牌分组当前不可用")
	}
	return nil
}
