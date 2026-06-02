package controller

import (
	"errors"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func GetAffiliateStatus(c *gin.Context) {
	userId := c.GetInt("id")
	role := c.GetInt("role")

	input := service.AffiliateScopeInput{
		UserId: userId,
		Role:   role,
	}

	if common.AffiliateEnabled && role < common.RoleAdminUser {
		profile, err := getActiveAffiliateProfile(userId)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		if profile != nil {
			input.ProfileStatus = profile.Status
			input.ProfileLevel = profile.Level
		}
	}

	scope := service.ResolveAffiliateAccessScope(input)
	common.ApiSuccess(c, gin.H{
		"enabled": common.AffiliateEnabled,
		"scope":   scope,
	})
}

func getActiveAffiliateProfile(userId int) (*model.AffiliateProfile, error) {
	if model.DB == nil {
		return nil, nil
	}

	var profile model.AffiliateProfile
	err := model.DB.
		Where("user_id = ? AND status = ?", userId, model.AffiliateProfileStatusActive).
		First(&profile).Error
	if err == nil {
		return &profile, nil
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return nil, err
}

type affiliateProfileSetRequest struct {
	UserId       int    `json:"user_id"`
	Level        int    `json:"level"`
	ParentUserId int    `json:"parent_user_id"`
	InviteCode   string `json:"invite_code"`
	Reason       string `json:"reason"`
}

func AdminSetAffiliateProfile(c *gin.Context) {
	var req affiliateProfileSetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	profile, err := service.SetAffiliateProfile(model.DB, service.AffiliateProfileSetInput{
		UserId:       req.UserId,
		Level:        req.Level,
		ParentUserId: req.ParentUserId,
		InviteCode:   req.InviteCode,
		ActorUserId:  c.GetInt("id"),
		Reason:       req.Reason,
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, profile)
}

type affiliateProfileStatusRequest struct {
	Status string `json:"status"`
	Reason string `json:"reason"`
}

func AdminUpdateAffiliateProfileStatus(c *gin.Context) {
	userId, err := strconv.Atoi(c.Param("user_id"))
	if err != nil || userId <= 0 {
		common.ApiErrorMsg(c, "无效的用户ID")
		return
	}

	var req affiliateProfileStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}

	input := service.AffiliateProfileStatusInput{
		UserId:      userId,
		ActorUserId: c.GetInt("id"),
		Reason:      req.Reason,
	}
	switch strings.ToLower(strings.TrimSpace(req.Status)) {
	case model.AffiliateProfileStatusActive:
		profile, err := service.EnableAffiliateProfile(model.DB, input)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		common.ApiSuccess(c, profile)
	case model.AffiliateProfileStatusDisabled:
		if err := service.DisableAffiliateProfile(model.DB, input); err != nil {
			common.ApiError(c, err)
			return
		}
		common.ApiSuccess(c, nil)
	default:
		common.ApiErrorMsg(c, "无效的分销状态")
	}
}
