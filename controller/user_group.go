package controller

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"one-api/common"
	"one-api/model"
	"one-api/setting"
	"one-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
)

// GetAllUserGroups 获取用户分组列表
func GetAllUserGroups(c *gin.Context) {
	groups, err := model.GetAllUserGroups()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, groups)
}

// isReservedGroup reports whether the name is one of the system reserved groups.
func isReservedGroup(name string) bool {
	switch strings.ToLower(name) {
	case "default", "vip", "svip":
		return true
	default:
		return false
	}
}

// CreateUserGroup 创建新的用户分组
func CreateUserGroup(c *gin.Context) {
	var g model.UserGroup
	if err := c.ShouldBindJSON(&g); err != nil {
		common.ApiError(c, err)
		return
	}
	g.Name = strings.TrimSpace(g.Name)
	if g.Name == "" {
 		common.ApiErrorMsg(c, "分组名称不能为空")
 		return
 	}
 	// 禁止使用系统保留分组名
 	if isReservedGroup(strings.ToLower(g.Name)) {
 		common.ApiErrorMsg(c, "不能使用系统保留分组名：default、vip、svip")
 		return
 	}
 	if g.Ratio < 0 {
 		common.ApiErrorMsg(c, "分组倍率不能小于0")
 		return
 	}
 	if g.Ratio == 0 {
 		g.Ratio = 1.0 // 默认倍率为1.0
 	}

	// 创建前检查名称
	if dup, err := model.IsUserGroupNameDuplicated(0, g.Name); err != nil {
		common.ApiError(c, err)
		return
	} else if dup {
		common.ApiErrorMsg(c, "分组名称已存在")
		return
	}

	if err := g.Insert(); err != nil {
		common.ApiError(c, err)
		return
	}

	// 同步到分组倍率设置
	if err := syncGroupToRatioSetting(g.Name, g.Ratio, true); err != nil {
		common.SysLog("同步分组到倍率设置失败: " + err.Error())
	}

	// 同步到用户可选分组
	if err := syncGroupToUserUsableGroups(g.Name, g.Description, true); err != nil {
		common.SysLog("同步分组到用户可选分组失败: " + err.Error())
	}

	// 同步到充值分组倍率
	if err := syncGroupToTopupRatio(g.Name, g.Ratio, true); err != nil {
		common.SysLog("同步分组到充值倍率设置失败: " + err.Error())
	}

	common.ApiSuccess(c, &g)
}

// UpdateUserGroup 更新用户分组
func UpdateUserGroup(c *gin.Context) {
	var g model.UserGroup
	if err := c.ShouldBindJSON(&g); err != nil {
		common.ApiError(c, err)
		return
	}
	if g.Id == 0 {
		common.ApiErrorMsg(c, "缺少分组 ID")
		return
	}
	g.Name = strings.TrimSpace(g.Name)
	if g.Name == "" {
		common.ApiErrorMsg(c, "分组名称不能为空")
		return
	}
	if g.Ratio < 0 {
		common.ApiErrorMsg(c, "分组倍率不能小于0")
		return
	}
	if g.Ratio == 0 {
		g.Ratio = 1.0
	}
	// 获取原分组信息
	oldGroup, err := model.GetUserGroupById(g.Id)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	// 名称冲突检查
	if dup, err := model.IsUserGroupNameDuplicated(g.Id, g.Name); err != nil {
		common.ApiError(c, err)
		return
	} else if dup {
		common.ApiErrorMsg(c, "分组名称已存在")
		return
	}

	// 使用事务确保分组更新和用户更新的数据一致性
	tx := model.DB.Begin()
	if tx.Error != nil {
		common.ApiError(c, tx.Error)
		return
	}

	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// 在事务中更新分组
	if err := g.UpdateTx(tx); err != nil {
		tx.Rollback()
		common.ApiError(c, err)
		return
	}

	// 如果名称发生变化，需要在同一事务中更新用户数据
	if oldGroup.Name != g.Name {
		if isReservedGroup(strings.ToLower(g.Name)) {
			tx.Rollback()
			common.ApiErrorMsg(c, "不能将分组名称修改为系统保留分组名")
			return
		}
		common.SysLog(fmt.Sprintf("检测到分组名称变化: '%s' -> '%s'", oldGroup.Name, g.Name))

		// 禁止修改系统保留分组名
		if isReservedGroup(strings.ToLower(oldGroup.Name)) {
			tx.Rollback()
			common.ApiErrorMsg(c, "不能修改系统保留分组名称")
			return
		}

		// 在同一事务中更新所有使用旧分组名的用户
		result := tx.Model(&model.User{}).Where("group = ?", oldGroup.Name).Update("group", g.Name)
		if result.Error != nil {
			tx.Rollback()
			common.SysLog("更新用户分组名称失败: " + result.Error.Error())
			common.ApiErrorMsg(c, "更新用户分组名称失败: "+result.Error.Error())
			return
		}
		common.SysLog(fmt.Sprintf("在事务中成功更新 %d 个用户的分组名称", result.RowsAffected))
	}

	// 提交事务
	if err := tx.Commit().Error; err != nil {
		common.SysLog("提交分组更新事务失败: " + err.Error())
		common.ApiError(c, err)
		return
	}

	// 事务提交成功后，同步设置（这些操作失败不影响核心数据一致性）
	if oldGroup.Name != g.Name {
		// 从旧设置中移除
		if err := syncGroupToRatioSetting(oldGroup.Name, 0, false); err != nil {
			common.SysLog("从倍率设置中移除旧分组失败: " + err.Error())
		}
		if err := syncGroupToUserUsableGroups(oldGroup.Name, "", false); err != nil {
			common.SysLog("从用户可选分组中移除旧分组失败: " + err.Error())
		}
		if err := syncGroupToTopupRatio(oldGroup.Name, 0, false); err != nil {
			common.SysLog("从充值倍率设置中移除旧分组失败: " + err.Error())
		}
	}

	// 同步到分组倍率设置
	if err := syncGroupToRatioSetting(g.Name, g.Ratio, true); err != nil {
		common.SysLog("同步分组到倍率设置失败: " + err.Error())
	}

	// 同步到用户可选分组
	if err := syncGroupToUserUsableGroups(g.Name, g.Description, true); err != nil {
		common.SysLog("同步分组到用户可选分组失败: " + err.Error())
	}

	// 同步到充值分组倍率
	if err := syncGroupToTopupRatio(g.Name, g.Ratio, true); err != nil {
		common.SysLog("同步分组到充值倍率设置失败: " + err.Error())
	}

	common.ApiSuccess(c, &g)
}

// DeleteUserGroup 删除用户分组
func DeleteUserGroup(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "无效的分组 ID")
		return
	}

	group, err := model.GetUserGroupById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	// 检查是否有用户正在使用此分组
	if inUse, err := model.IsUserGroupInUse(group.Name); err != nil {
		common.ApiError(c, err)
		return
	} else if inUse {
		common.ApiErrorMsg(c, "该分组正在被用户使用，无法删除")
		return
	}

	// 不允许删除默认分组
	if group.Name == "default" || group.Name == "vip" || group.Name == "svip" {
		common.ApiErrorMsg(c, "不能删除系统默认分组")
		return
	}

	if err := group.Delete(); err != nil {
		common.ApiError(c, err)
		return
	}

	// 从分组倍率设置中移除
	if err := syncGroupToRatioSetting(group.Name, 0, false); err != nil {
		common.SysLog("从倍率设置中移除分组失败: " + err.Error())
	}

	// 从用户可选分组中移除
	if err := syncGroupToUserUsableGroups(group.Name, "", false); err != nil {
		common.SysLog("从用户可选分组中移除分组失败: " + err.Error())
	}

	// 从充值分组倍率中移除
	if err := syncGroupToTopupRatio(group.Name, 0, false); err != nil {
		common.SysLog("从充值倍率设置中移除分组失败: " + err.Error())
	}

	common.ApiSuccess(c, nil)
}

// syncGroupToRatioSetting 同步分组到倍率设置
func syncGroupToRatioSetting(groupName string, ratio float64, add bool) error {
	groupRatio := ratio_setting.GetGroupRatioCopy()
	
	if add {
		groupRatio[groupName] = ratio
	} else {
		delete(groupRatio, groupName)
	}

	jsonBytes, err := json.Marshal(groupRatio)
	if err != nil {
		return err
	}

	// 更新到数据库
	if err := model.UpdateOption("GroupRatio", string(jsonBytes)); err != nil {
		return err
	}

	// 更新内存中的设置
	return ratio_setting.UpdateGroupRatioByJSONString(string(jsonBytes))
}

// syncGroupToUserUsableGroups 同步分组到用户可选分组
func syncGroupToUserUsableGroups(groupName, description string, add bool) error {
	userUsableGroups := setting.GetUserUsableGroupsCopy()

	if add {
		if description == "" {
			description = groupName + "分组"
		}
		userUsableGroups[groupName] = description
	} else {
		delete(userUsableGroups, groupName)
	}

	jsonBytes, err := json.Marshal(userUsableGroups)
	if err != nil {
		return err
	}

	// 更新到数据库
	if err := model.UpdateOption("UserUsableGroups", string(jsonBytes)); err != nil {
		return err
	}

	// 更新内存中的设置
	return setting.UpdateUserUsableGroupsByJSONString(string(jsonBytes))
}

// syncGroupToTopupRatio 同步分组到充值倍率设置
func syncGroupToTopupRatio(groupName string, ratio float64, add bool) error {
	// 获取当前充值分组倍率的副本（线程安全）
	topupGroupRatio := common.GetTopupGroupRatioCopy()
	if add {
		topupGroupRatio[groupName] = ratio
	} else {
		delete(topupGroupRatio, groupName)
	}

	jsonBytes, err := json.Marshal(topupGroupRatio)
	if err != nil {
		return err
	}

	// 更新到数据库
	if err := model.UpdateOption("TopupGroupRatio", string(jsonBytes)); err != nil {
		return err
	}

	// 更新内存中的设置
	return common.UpdateTopupGroupRatioByJSONString(string(jsonBytes))
}
