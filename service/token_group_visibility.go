package service

import (
	"errors"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

// GetUserSelectableTokenGroups intersects the established usable-group
// permission with optional visibility policies. With the flag off it returns
// the exact legacy result.
func GetUserSelectableTokenGroups(userId int) (map[string]string, error) {
	user, err := model.GetUserById(userId, false)
	if err != nil {
		return nil, err
	}
	groups := GetUserUsableGroups(user.Group)
	if !model.TokenGroupVisibilityEnabled() {
		return groups, nil
	}
	policies, err := model.GetTokenGroupVisibilityPolicies()
	if err != nil {
		return nil, err
	}
	now := common.GetTimestamp()
	for _, policy := range policies {
		if _, usable := groups[policy.Group]; !usable {
			continue
		}
		inWindow := (policy.StartTime == 0 || now >= policy.StartTime) &&
			(policy.EndTime == 0 || now < policy.EndTime)
		switch policy.Visibility {
		case model.TokenGroupVisibilityHidden:
			if inWindow {
				delete(groups, policy.Group)
			}
		case model.TokenGroupVisibilityTargeted:
			if !inWindow {
				delete(groups, policy.Group)
				continue
			}
			allowed := false
			for _, targetUserId := range policy.UserIds {
				if targetUserId == user.Id {
					allowed = true
					break
				}
			}
			if !allowed {
				delete(groups, policy.Group)
			}
		case model.TokenGroupVisibilityPublic:
			// Public policies preserve the established base permission.
		default:
			// A malformed row must not widen an authorization boundary.
			delete(groups, policy.Group)
		}
	}
	return groups, nil
}

func ValidateUserSelectableTokenGroup(userId int, group string) error {
	if !model.TokenGroupVisibilityEnabled() || group == "" {
		return nil
	}
	groups, err := GetUserSelectableTokenGroups(userId)
	if err != nil {
		return err
	}
	if _, ok := groups[group]; !ok {
		return errors.New("所选令牌分组当前不可用")
	}
	return nil
}
