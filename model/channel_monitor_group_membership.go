package model

import (
	"errors"
	"fmt"
	"sort"
	"strings"
	"unicode/utf8"

	"gorm.io/gorm"
)

var (
	ErrChannelMonitorGroupInvalid               = errors.New("分组名称无效")
	ErrChannelMonitorGroupChannelInvalid        = errors.New("渠道 ID 必须为正整数")
	ErrChannelMonitorGroupChannelNotFound       = errors.New("渠道不存在")
	ErrChannelMonitorGroupMembershipRequired    = errors.New("渠道必须至少属于一个分组")
	ErrChannelMonitorGroupMembershipListTooLong = errors.New("关联分组名称合计不能超过 64 个字符")
)

type ChannelMonitorGroupMembershipUpdate struct {
	Group             string `json:"group"`
	ChannelIds        []int  `json:"channel_ids"`
	AddedChannelIds   []int  `json:"added_channel_ids"`
	RemovedChannelIds []int  `json:"removed_channel_ids"`
}

type ChannelMonitorGroupMembershipRemoval struct {
	ChannelId int    `json:"channel_id"`
	Group     string `json:"group"`
}

func ReplaceChannelMonitorGroupMembers(group string, channelIds []int) (ChannelMonitorGroupMembershipUpdate, error) {
	group = strings.TrimSpace(group)
	result := ChannelMonitorGroupMembershipUpdate{Group: group}
	if group == "" || utf8.RuneCountInString(group) > 64 || strings.ContainsAny(group, ",\r\n") {
		return result, ErrChannelMonitorGroupInvalid
	}

	selectedChannelIds := make(map[int]struct{}, len(channelIds))
	for _, channelId := range channelIds {
		if channelId <= 0 {
			return result, ErrChannelMonitorGroupChannelInvalid
		}
		selectedChannelIds[channelId] = struct{}{}
	}
	result.ChannelIds = make([]int, 0, len(selectedChannelIds))
	for channelId := range selectedChannelIds {
		result.ChannelIds = append(result.ChannelIds, channelId)
	}
	sort.Ints(result.ChannelIds)

	err := DB.Transaction(func(tx *gorm.DB) error {
		var channels []Channel
		if err := lockForUpdate(tx).Order("id ASC").Find(&channels).Error; err != nil {
			return err
		}

		knownChannelIds := make(map[int]struct{}, len(channels))
		for i := range channels {
			knownChannelIds[channels[i].Id] = struct{}{}
		}
		for _, channelId := range result.ChannelIds {
			if _, exists := knownChannelIds[channelId]; !exists {
				return fmt.Errorf("%w（ID %d）", ErrChannelMonitorGroupChannelNotFound, channelId)
			}
		}

		for i := range channels {
			channel := &channels[i]
			groups := make([]string, 0)
			seenGroups := make(map[string]struct{})
			hasTargetGroup := false
			for _, existingGroup := range strings.Split(channel.Group, ",") {
				existingGroup = strings.TrimSpace(existingGroup)
				if existingGroup == "" {
					continue
				}
				if _, exists := seenGroups[existingGroup]; exists {
					continue
				}
				seenGroups[existingGroup] = struct{}{}
				groups = append(groups, existingGroup)
				if existingGroup == group {
					hasTargetGroup = true
				}
			}

			_, shouldHaveTargetGroup := selectedChannelIds[channel.Id]
			if hasTargetGroup == shouldHaveTargetGroup {
				continue
			}

			if shouldHaveTargetGroup {
				groups = append(groups, group)
			} else {
				remainingGroups := groups[:0]
				for _, existingGroup := range groups {
					if existingGroup != group {
						remainingGroups = append(remainingGroups, existingGroup)
					}
				}
				groups = remainingGroups
				if len(groups) == 0 {
					return fmt.Errorf(
						"无法从分组 %s 移除渠道 %s（ID %d），%w",
						group,
						channel.Name,
						channel.Id,
						ErrChannelMonitorGroupMembershipRequired,
					)
				}
			}

			serializedGroups := strings.Join(groups, ",")
			if utf8.RuneCountInString(serializedGroups) > 64 {
				return fmt.Errorf(
					"渠道 %s（ID %d）的%w",
					channel.Name,
					channel.Id,
					ErrChannelMonitorGroupMembershipListTooLong,
				)
			}
			if err := tx.Model(&Channel{}).Where("id = ?", channel.Id).Update("group", serializedGroups).Error; err != nil {
				return err
			}
			channel.Group = serializedGroups
			if err := channel.UpdateAbilities(tx); err != nil {
				return err
			}

			if shouldHaveTargetGroup {
				result.AddedChannelIds = append(result.AddedChannelIds, channel.Id)
			} else {
				result.RemovedChannelIds = append(result.RemovedChannelIds, channel.Id)
			}
		}
		return nil
	})
	if err != nil {
		result.AddedChannelIds = nil
		result.RemovedChannelIds = nil
		return result, err
	}
	return result, nil
}

func RemoveChannelMonitorGroupMemberships(removals []ChannelMonitorGroupMembershipRemoval) ([]ChannelMonitorGroupMembershipRemoval, error) {
	requestedByChannel := make(map[int]map[string]struct{})
	channelIds := make([]int, 0)
	for _, removal := range removals {
		removal.Group = strings.TrimSpace(removal.Group)
		if removal.ChannelId <= 0 {
			return nil, ErrChannelMonitorGroupChannelInvalid
		}
		if removal.Group == "" || utf8.RuneCountInString(removal.Group) > 64 || strings.ContainsAny(removal.Group, ",\r\n") {
			return nil, ErrChannelMonitorGroupInvalid
		}
		groups, exists := requestedByChannel[removal.ChannelId]
		if !exists {
			groups = make(map[string]struct{})
			requestedByChannel[removal.ChannelId] = groups
			channelIds = append(channelIds, removal.ChannelId)
		}
		groups[removal.Group] = struct{}{}
	}
	if len(channelIds) == 0 {
		return nil, nil
	}
	sort.Ints(channelIds)

	applied := make([]ChannelMonitorGroupMembershipRemoval, 0, len(removals))
	err := DB.Transaction(func(tx *gorm.DB) error {
		var channels []Channel
		if err := lockForUpdate(tx).Where("id IN ?", channelIds).Order("id ASC").Find(&channels).Error; err != nil {
			return err
		}
		if len(channels) != len(channelIds) {
			knownChannelIds := make(map[int]struct{}, len(channels))
			for i := range channels {
				knownChannelIds[channels[i].Id] = struct{}{}
			}
			for _, channelId := range channelIds {
				if _, exists := knownChannelIds[channelId]; !exists {
					return fmt.Errorf("%w（ID %d）", ErrChannelMonitorGroupChannelNotFound, channelId)
				}
			}
		}

		for i := range channels {
			channel := &channels[i]
			requestedGroups := requestedByChannel[channel.Id]
			groups := make([]string, 0)
			seenGroups := make(map[string]struct{})
			removedGroups := make([]string, 0, len(requestedGroups))
			for _, existingGroup := range strings.Split(channel.Group, ",") {
				existingGroup = strings.TrimSpace(existingGroup)
				if existingGroup == "" {
					continue
				}
				if _, exists := seenGroups[existingGroup]; exists {
					continue
				}
				seenGroups[existingGroup] = struct{}{}
				if _, shouldRemove := requestedGroups[existingGroup]; shouldRemove {
					removedGroups = append(removedGroups, existingGroup)
					continue
				}
				groups = append(groups, existingGroup)
			}
			if len(removedGroups) == 0 {
				continue
			}
			if len(groups) == 0 {
				return fmt.Errorf(
					"无法移除渠道 %s（ID %d）的分组关联，%w",
					channel.Name,
					channel.Id,
					ErrChannelMonitorGroupMembershipRequired,
				)
			}

			channel.Group = strings.Join(groups, ",")
			if err := tx.Model(&Channel{}).Where("id = ?", channel.Id).Update("group", channel.Group).Error; err != nil {
				return err
			}
			if err := channel.UpdateAbilities(tx); err != nil {
				return err
			}
			for _, group := range removedGroups {
				applied = append(applied, ChannelMonitorGroupMembershipRemoval{ChannelId: channel.Id, Group: group})
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	sort.Slice(applied, func(i, j int) bool {
		if applied[i].ChannelId != applied[j].ChannelId {
			return applied[i].ChannelId < applied[j].ChannelId
		}
		return applied[i].Group < applied[j].Group
	})
	return applied, nil
}
