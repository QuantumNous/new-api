package controller

import (
	"errors"

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
