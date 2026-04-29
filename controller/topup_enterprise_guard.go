package controller

import (
	"errors"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func blockEnterpriseTopupForNonOwner(c *gin.Context) bool {
	userID := c.GetInt("id")
	var ownerOrg struct {
		ID uint
	}
	err := model.DB.Table("lc_organizations").
		Select("id").
		Where("owner_id = ? AND status = 1", userID).
		First(&ownerOrg).Error
	if err == nil {
		return false
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		common.ApiError(c, err)
		return true
	}

	var count int64
	err = model.DB.Table("lc_org_members").
		Joins("JOIN lc_organizations ON lc_organizations.id = lc_org_members.org_id AND lc_organizations.status = 1").
		Where("lc_org_members.user_id = ? AND lc_org_members.status = 1", userID).
		Count(&count).Error
	if err != nil {
		common.ApiError(c, err)
		return true
	}
	if count > 0 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "企业充值仅限企业拥有者操作",
			"data":    "企业充值仅限企业拥有者操作",
		})
		return true
	}
	return false
}
