package controller

import (
	"net/http"
	"regexp"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
)

func GetGroups(c *gin.Context) {
	groupNames := make([]string, 0)
	for groupName := range ratio_setting.GetGroupRatioCopy() {
		groupNames = append(groupNames, groupName)
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    groupNames,
	})
}

func GetUserGroups(c *gin.Context) {
	usableGroups := make(map[string]map[string]interface{})
	userGroup := ""
	userId := c.GetInt("id")
	userGroup, _ = model.GetUserGroup(userId, false)
	userUsableGroups := service.GetUserUsableGroups(userGroup)

	allGroups, _ := model.CacheGetAllGroups()
	categoryMap := make(map[string]string)
	sortOrderMap := make(map[string]int)
	for _, g := range allGroups {
		categoryMap[g.Name] = g.Category
		sortOrderMap[g.Name] = g.SortOrder
	}

	for groupName := range ratio_setting.GetGroupRatioCopy() {
		if desc, ok := userUsableGroups[groupName]; ok {
			usableGroups[groupName] = map[string]interface{}{
				"ratio":      service.GetUserGroupRatio(userId, userGroup, groupName),
				"desc":       desc,
				"category":   categoryMap[groupName],
				"sort_order": sortOrderMap[groupName],
			}
		}
	}
	if _, ok := userUsableGroups["auto"]; ok {
		usableGroups["auto"] = map[string]interface{}{
			"ratio":      "自动",
			"desc":       setting.GetUsableGroupDescription("auto"),
			"category":   "",
			"sort_order": -1,
		}
	}

	// Include aliases whose target group is in user's usable groups
	aliases, _ := model.CacheGetAllGroupAliases()
	for _, a := range aliases {
		if _, exists := usableGroups[a.Alias]; exists {
			continue
		}
		if _, targetUsable := usableGroups[a.TargetGroup]; !targetUsable {
			continue
		}
		// effectiveRatio mirrors the target's ratio type (float64 or "自动" string)
		var effectiveRatio interface{}
		if a.RatioOverride != nil {
			effectiveRatio = *a.RatioOverride
		} else if targetInfo, ok := usableGroups[a.TargetGroup]; ok {
			effectiveRatio = targetInfo["ratio"]
		} else {
			effectiveRatio = float64(0)
		}
		usableGroups[a.Alias] = map[string]interface{}{
			"ratio":      effectiveRatio,
			"desc":       "→ " + a.TargetGroup,
			"category":   categoryMap[a.TargetGroup],
			"sort_order": 99999,
			"is_alias":   true,
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    usableGroups,
	})
}

var validGroupNameRegex = regexp.MustCompile(`^[\p{L}\p{N}_\-\.]+$`)

func validateGroupName(name string) string {
	if name == "" {
		return "名称不能为空"
	}
	if len(name) > 64 {
		return "名称长度不能超过64个字符"
	}
	if !validGroupNameRegex.MatchString(name) {
		return "名称只能包含字母、数字、下划线、连字符和点"
	}
	return ""
}

func GetAllGroupsAdmin(c *gin.Context) {
	groups, err := model.GetAllGroups()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, groups)
}

func CreateGroup(c *gin.Context) {
	var group model.Group
	if err := c.ShouldBindJSON(&group); err != nil {
		common.ApiError(c, err)
		return
	}
	if errMsg := validateGroupName(group.Name); errMsg != "" {
		common.ApiErrorMsg(c, errMsg)
		return
	}
	if existing, _ := model.GetGroupByName(group.Name); existing != nil {
		common.ApiErrorMsg(c, "分组名称已存在")
		return
	}
	if err := model.CreateGroup(&group); err != nil {
		common.ApiError(c, err)
		return
	}
	model.InvalidateAllGroupCache()
	common.ApiSuccess(c, group)
}

func UpdateGroup(c *gin.Context) {
	var group model.Group
	if err := c.ShouldBindJSON(&group); err != nil {
		common.ApiError(c, err)
		return
	}
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "无效的 id 参数")
		return
	}
	existing, err := model.GetGroupById(uint(id))
	if err != nil {
		common.ApiErrorMsg(c, "分组不存在")
		return
	}
	oldName := existing.Name
	if group.Name != "" && group.Name != existing.Name {
		if errMsg := validateGroupName(group.Name); errMsg != "" {
			common.ApiErrorMsg(c, errMsg)
			return
		}
		if dup, _ := model.GetGroupByName(group.Name); dup != nil {
			common.ApiErrorMsg(c, "分组名称已存在")
			return
		}
	}
	if group.Name != "" {
		existing.Name = group.Name
	}
	existing.Ratio = group.Ratio
	existing.SortOrder = group.SortOrder
	existing.Category = group.Category
	existing.UserSelectable = group.UserSelectable
	existing.Description = group.Description
	existing.AllowedPaths = group.AllowedPaths

	if oldName != existing.Name {
		// Rename: save group + alias bookkeeping atomically
		if err := model.RenameGroupTx(existing, oldName); err != nil {
			common.ApiError(c, err)
			return
		}
		model.InvalidateAllAliasCache()
	} else {
		if err := model.UpdateGroup(existing); err != nil {
			common.ApiError(c, err)
			return
		}
	}
	model.InvalidateAllGroupCache()
	common.ApiSuccess(c, existing)
}

func DeleteGroup(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "无效的 id 参数")
		return
	}
	if err := model.DeleteGroupTx(uint(id)); err != nil {
		common.ApiError(c, err)
		return
	}
	model.InvalidateAllGroupCache()
	model.InvalidateAllAliasCache()
	common.ApiSuccess(c, nil)
}

func UpdateGroupSort(c *gin.Context) {
	var orders []model.GroupSortOrder
	if err := c.ShouldBindJSON(&orders); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.UpdateGroupSortOrders(orders); err != nil {
		common.ApiError(c, err)
		return
	}
	model.InvalidateAllGroupCache()
	common.ApiSuccess(c, nil)
}

func GetGroupCategories(c *gin.Context) {
	categories, err := model.GetGroupCategories()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, categories)
}
