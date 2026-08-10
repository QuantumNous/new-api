package service

import (
	"errors"
	"fmt"

	"github.com/QuantumNous/new-api/model"
)

func ValidateUserChannelChainGroups(userGroup string, groups []string) error {
	if len(groups) == 0 {
		return errors.New("at least one pricing group is required")
	}
	if len(groups) > model.MaxGroupsPerUserChannelChain {
		return fmt.Errorf("a group chain can contain at most %d groups", model.MaxGroupsPerUserChannelChain)
	}
	seen := make(map[string]struct{}, len(groups))
	for _, group := range groups {
		if group == "" {
			return errors.New("pricing group name cannot be empty")
		}
		if _, ok := seen[group]; ok {
			return fmt.Errorf("group %s is duplicated", group)
		}
		seen[group] = struct{}{}
		if !IsUserSelectableGroup(userGroup, group) {
			return fmt.Errorf("group %s is unavailable or unauthorized", group)
		}
	}
	return nil
}

func ResolveChannelChainGroups(userId int, group string) ([]string, error) {
	chainId, ok := model.ParseUserChannelChain(group)
	if !ok {
		return nil, errors.New("invalid channel chain")
	}
	chain, err := model.GetUserChannelChain(userId, chainId)
	if err != nil {
		return nil, err
	}
	return chain.GetGroupList(), nil
}
