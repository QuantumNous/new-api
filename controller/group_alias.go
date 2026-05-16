package controller

import (
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

func GetAllGroupAliases(c *gin.Context) {
	aliases, err := model.GetAllGroupAliases()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, aliases)
}

func CreateGroupAlias(c *gin.Context) {
	var alias model.GroupAlias
	if err := c.ShouldBindJSON(&alias); err != nil {
		common.ApiError(c, err)
		return
	}
	if errMsg := validateGroupName(alias.Alias); errMsg != "" {
		common.ApiErrorMsg(c, "别名"+errMsg)
		return
	}
	if alias.TargetGroup == "" {
		common.ApiErrorMsg(c, "目标分组不能为空")
		return
	}
	if alias.Alias == alias.TargetGroup {
		common.ApiErrorMsg(c, "别名不能与目标分组相同")
		return
	}
	if existing, _ := model.GetGroupAliasByAlias(alias.Alias); existing != nil {
		common.ApiErrorMsg(c, "别名已存在")
		return
	}
	if model.CacheContainsGroup(alias.Alias) {
		common.ApiErrorMsg(c, "别名不能与现有分组名称相同")
		return
	}
	if !model.CacheContainsGroup(alias.TargetGroup) {
		common.ApiErrorMsg(c, "目标分组不存在")
		return
	}
	if _, isAlias := model.CacheResolveAlias(alias.TargetGroup); isAlias {
		common.ApiErrorMsg(c, "目标分组不能是另一个别名")
		return
	}
	if err := model.CreateGroupAlias(&alias); err != nil {
		common.ApiError(c, err)
		return
	}
	model.InvalidateAliasCache(alias.Alias)
	common.ApiSuccess(c, alias)
}

func UpdateGroupAlias(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "无效的 id 参数")
		return
	}
	var input model.GroupAlias
	if err := c.ShouldBindJSON(&input); err != nil {
		common.ApiError(c, err)
		return
	}
	existing, err := model.GetGroupAliasByID(uint(id))
	if err != nil {
		common.ApiErrorMsg(c, "别名不存在")
		return
	}
	oldAlias := existing.Alias
	if input.Alias != "" && input.Alias != existing.Alias {
		if errMsg := validateGroupName(input.Alias); errMsg != "" {
			common.ApiErrorMsg(c, "别名"+errMsg)
			return
		}
		if dup, _ := model.GetGroupAliasByAlias(input.Alias); dup != nil {
			common.ApiErrorMsg(c, "别名已存在")
			return
		}
		if model.CacheContainsGroup(input.Alias) {
			common.ApiErrorMsg(c, "别名不能与现有分组名称相同")
			return
		}
		existing.Alias = input.Alias
	}
	if input.TargetGroup != "" {
		newAliasName := existing.Alias
		if input.Alias != "" {
			newAliasName = input.Alias
		}
		if input.TargetGroup == newAliasName {
			common.ApiErrorMsg(c, "别名不能与目标分组相同")
			return
		}
		if !model.CacheContainsGroup(input.TargetGroup) {
			common.ApiErrorMsg(c, "目标分组不存在")
			return
		}
		if _, isAlias := model.CacheResolveAlias(input.TargetGroup); isAlias {
			common.ApiErrorMsg(c, "目标分组不能是另一个别名")
			return
		}
		existing.TargetGroup = input.TargetGroup
	}
	existing.RatioOverride = input.RatioOverride

	if err := model.UpdateGroupAlias(existing); err != nil {
		common.ApiError(c, err)
		return
	}
	model.InvalidateAliasCache(oldAlias)
	if existing.Alias != oldAlias {
		model.InvalidateAliasCache(existing.Alias)
	}
	common.ApiSuccess(c, existing)
}

func DeleteGroupAlias(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "无效的 id 参数")
		return
	}
	existing, err := model.GetGroupAliasByID(uint(id))
	if err != nil {
		common.ApiErrorMsg(c, "别名不存在")
		return
	}
	if err := model.DeleteGroupAlias(existing.Id); err != nil {
		common.ApiError(c, err)
		return
	}
	model.InvalidateAliasCache(existing.Alias)
	common.ApiSuccess(c, nil)
}
