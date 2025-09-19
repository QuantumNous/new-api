package service

import (
	"encoding/json"
	"fmt"
	"one-api/common"
	"one-api/model"
	"one-api/setting"
	"one-api/setting/ratio_setting"
)

// MigrateUserGroupsFromOptions 从 options 表迁移用户分组数据到 UserGroup 表
func MigrateUserGroupsFromOptions() error {
	common.SysLog("开始迁移用户分组数据...")

	// 获取当前 options 中的分组数据
	groupRatioStr := common.OptionMap["GroupRatio"]
	userUsableGroupsStr := common.OptionMap["UserUsableGroups"]
	topupGroupRatioStr := common.OptionMap["TopupGroupRatio"]

	// 解析分组倍率
	var groupRatio map[string]float64
	if groupRatioStr != "" {
		if err := json.Unmarshal([]byte(groupRatioStr), &groupRatio); err != nil {
			common.SysLog("解析 GroupRatio 失败: " + err.Error())
			groupRatio = make(map[string]float64)
		}
	} else {
		groupRatio = make(map[string]float64)
	}

	// 解析用户可选分组
	var userUsableGroups map[string]string
	if userUsableGroupsStr != "" {
		if err := json.Unmarshal([]byte(userUsableGroupsStr), &userUsableGroups); err != nil {
			common.SysLog("解析 UserUsableGroups 失败: " + err.Error())
			userUsableGroups = make(map[string]string)
		}
	} else {
		userUsableGroups = make(map[string]string)
	}

	// 解析充值分组倍率
	var topupGroupRatio map[string]float64
	if topupGroupRatioStr != "" {
		if err := json.Unmarshal([]byte(topupGroupRatioStr), &topupGroupRatio); err != nil {
			common.SysLog("解析 TopupGroupRatio 失败: " + err.Error())
			topupGroupRatio = make(map[string]float64)
		}
	} else {
		topupGroupRatio = make(map[string]float64)
	}

	// 合并所有分组名称
	allGroups := make(map[string]bool)
	for name := range groupRatio {
		allGroups[name] = true
	}
	for name := range userUsableGroups {
		allGroups[name] = true
	}
	for name := range topupGroupRatio {
		allGroups[name] = true
	}

	// 添加默认分组
	defaultGroups := []string{"default", "vip", "svip"}
	for _, name := range defaultGroups {
		allGroups[name] = true
	}

	// 检查并创建/更新分组
	migratedCount := 0
	for groupName := range allGroups {
		// 检查分组是否已存在
		existingGroup, err := model.GetUserGroupByName(groupName)
		if err != nil && err.Error() != "record not found" {
			common.SysLog("检查分组 " + groupName + " 时出错: " + err.Error())
			continue
		}

		ratio := groupRatio[groupName]
		if ratio == 0 {
			ratio = 1.0 // 默认倍率
		}

		description := userUsableGroups[groupName]
		if description == "" {
			// 为默认分组设置描述
			switch groupName {
			case "default":
				description = "默认分组"
			case "vip":
				description = "VIP分组"
			case "svip":
				description = "SVIP分组"
			default:
				description = groupName + "分组"
			}
		}

		if existingGroup == nil {
			// 创建新分组
			newGroup := &model.UserGroup{
				Name:        groupName,
				Description: description,
				Ratio:       ratio,
			}
			if err := newGroup.Insert(); err != nil {
				common.SysLog("创建分组 " + groupName + " 失败: " + err.Error())
				continue
			}
			migratedCount++
			common.SysLog("创建分组: " + groupName + " (倍率: " + fmt.Sprintf("%.4f", ratio) + ")")
		} else {
			// 更新现有分组（如果数据不同）
			needUpdate := false
			if existingGroup.Ratio != ratio {
				existingGroup.Ratio = ratio
				needUpdate = true
			}
			if existingGroup.Description != description {
				existingGroup.Description = description
				needUpdate = true
			}

			if needUpdate {
				if err := existingGroup.Update(); err != nil {
					common.SysLog("更新分组 " + groupName + " 失败: " + err.Error())
					continue
				}
				migratedCount++
				common.SysLog("更新分组: " + groupName + " (倍率: " + fmt.Sprintf("%.4f", ratio) + ")")
			}
		}
	}

	common.SysLog("用户分组数据迁移完成，处理了 " + fmt.Sprintf("%d", migratedCount) + " 个分组")

	// 设置迁移完成标记
	if err := model.UpdateOption("UserGroupMigrationCompleted", "true"); err != nil {
		common.SysLog("设置迁移完成标记失败: " + err.Error())
	}

	return nil
}

// SyncUserGroupsToMemory 将 UserGroup 表数据同步到内存中的设置
func SyncUserGroupsToMemory() error {
	groups, err := model.GetAllUserGroups()
	if err != nil {
		return err
	}

	// 构建分组倍率映射
	groupRatio := make(map[string]float64)
	userUsableGroups := make(map[string]string)
	topupGroupRatio := make(map[string]float64)

	for _, group := range groups {
		groupRatio[group.Name] = group.Ratio
		userUsableGroups[group.Name] = group.Description
		topupGroupRatio[group.Name] = group.Ratio // 充值倍率使用相同的倍率
	}

	// 更新内存中的设置
	if groupRatioJson, err := json.Marshal(groupRatio); err == nil {
		ratio_setting.UpdateGroupRatioByJSONString(string(groupRatioJson))
	}

	if userUsableGroupsJson, err := json.Marshal(userUsableGroups); err == nil {
		setting.UpdateUserUsableGroupsByJSONString(string(userUsableGroupsJson))
	}

	if topupGroupRatioJson, err := json.Marshal(topupGroupRatio); err == nil {
		common.UpdateTopupGroupRatioByJSONString(string(topupGroupRatioJson))
	}

	return nil
}

// GetUserGroupsAsOptions 获取用户分组数据并转换为 options 格式
func GetUserGroupsAsOptions() (map[string]string, error) {
	groups, err := model.GetAllUserGroups()
	if err != nil {
		return nil, err
	}

	options := make(map[string]string)

	// 构建分组倍率
	groupRatio := make(map[string]float64)
	userUsableGroups := make(map[string]string)
	topupGroupRatio := make(map[string]float64)

	for _, group := range groups {
		groupRatio[group.Name] = group.Ratio
		userUsableGroups[group.Name] = group.Description
		topupGroupRatio[group.Name] = group.Ratio
	}

	// 转换为 JSON 字符串
	if groupRatioJson, err := json.Marshal(groupRatio); err == nil {
		options["GroupRatio"] = string(groupRatioJson)
	}

	if userUsableGroupsJson, err := json.Marshal(userUsableGroups); err == nil {
		options["UserUsableGroups"] = string(userUsableGroupsJson)
	}

	if topupGroupRatioJson, err := json.Marshal(topupGroupRatio); err == nil {
		options["TopupGroupRatio"] = string(topupGroupRatioJson)
	}

	return options, nil
}
