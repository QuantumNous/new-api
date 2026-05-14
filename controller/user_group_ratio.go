package controller

import (
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
)

func GetAllUserGroupRatios(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	keyword := c.Query("keyword")
	userId, _ := strconv.Atoi(c.Query("user_id"))

	var ratios []model.UserGroupRatio
	var total int64
	var err error

	if userId > 0 {
		ratios, total, err = model.GetAllUserGroupRatios(pageInfo.GetStartIdx(), pageInfo.GetPageSize(), userId, "")
	} else {
		ratios, total, err = model.GetUserGroupRatiosGroupedByUser(pageInfo.GetStartIdx(), pageInfo.GetPageSize(), keyword)
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(ratios)
	common.ApiSuccess(c, pageInfo)
}

func GetUserGroupRatioCountByGroup(c *gin.Context) {
	counts, err := model.CountUserGroupRatiosByGroup()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, counts)
}

type createUserGroupRatioRequest struct {
	UserId     int     `json:"user_id" binding:"required"`
	UsingGroup string  `json:"using_group" binding:"required"`
	Ratio      float64 `json:"ratio"`
}

func CreateUserGroupRatio(c *gin.Context) {
	var req createUserGroupRatioRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}

	record := &model.UserGroupRatio{
		UserId:     req.UserId,
		UsingGroup: req.UsingGroup,
		Ratio:      req.Ratio,
	}
	if err := model.CreateOrUpdateUserGroupRatio(record); err != nil {
		common.ApiError(c, err)
		return
	}
	ratio_setting.SetUserGroupRatioCache(req.UserId, req.UsingGroup, req.Ratio)
	common.ApiSuccess(c, record)
}

type updateUserGroupRatioRequest struct {
	Id    int     `json:"id" binding:"required"`
	Ratio float64 `json:"ratio"`
}

func UpdateUserGroupRatio(c *gin.Context) {
	var req updateUserGroupRatioRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}

	if err := model.UpdateUserGroupRatio(req.Id, req.Ratio); err != nil {
		common.ApiError(c, err)
		return
	}

	var record model.UserGroupRatio
	if err := model.DB.First(&record, req.Id).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	ratio_setting.SetUserGroupRatioCache(record.UserId, record.UsingGroup, req.Ratio)
	common.ApiSuccess(c, nil)
}

func DeleteUserGroupRatio(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}

	// get record before delete for cache invalidation
	var record model.UserGroupRatio
	if err := model.DB.First(&record, id).Error; err != nil {
		common.ApiError(c, err)
		return
	}

	if err := model.DeleteUserGroupRatio(id); err != nil {
		common.ApiError(c, err)
		return
	}
	ratio_setting.DeleteUserGroupRatioCache(record.UserId, record.UsingGroup)
	common.ApiSuccess(c, nil)
}

type batchDeleteRequest struct {
	Ids []int `json:"ids" binding:"required"`
}

func BatchDeleteUserGroupRatios(c *gin.Context) {
	var req batchDeleteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}

	// get records before delete for cache invalidation
	var records []model.UserGroupRatio
	model.DB.Where("id IN ?", req.Ids).Find(&records)

	if err := model.BatchDeleteUserGroupRatios(req.Ids); err != nil {
		common.ApiError(c, err)
		return
	}

	for _, r := range records {
		ratio_setting.DeleteUserGroupRatioCache(r.UserId, r.UsingGroup)
	}
	common.ApiSuccess(c, nil)
}
