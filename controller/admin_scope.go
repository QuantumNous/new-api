package controller

import (
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service/authz"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func canViewAllChannels(c *gin.Context) bool {
	return authz.Can(c.GetInt("id"), c.GetInt("role"), authz.ChannelReadAll)
}

func canReadUsers(c *gin.Context) bool {
	return authz.Can(c.GetInt("id"), c.GetInt("role"), authz.UserRead)
}

func applyChannelScope(c *gin.Context, query *gorm.DB) *gorm.DB {
	if canViewAllChannels(c) {
		return query
	}
	return query.Where("creator_id = ?", c.GetInt("id"))
}

func visibleChannelIDs(c *gin.Context) (ids []int, unrestricted bool, err error) {
	if canViewAllChannels(c) {
		return nil, true, nil
	}
	err = model.DB.Model(&model.Channel{}).
		Where("creator_id = ?", c.GetInt("id")).
		Pluck("id", &ids).Error
	return ids, false, err
}

func ensureChannelVisible(c *gin.Context, channelID int) bool {
	if canViewAllChannels(c) {
		return true
	}
	var count int64
	err := model.DB.Model(&model.Channel{}).
		Where("id = ? AND creator_id = ?", channelID, c.GetInt("id")).
		Count(&count).Error
	if err == nil && count > 0 {
		return true
	}
	c.JSON(http.StatusForbidden, gin.H{
		"success": false,
		"message": common.TranslateMessage(c, i18n.MsgAuthInsufficientPrivilege),
	})
	return false
}

func ensureChannelsVisible(c *gin.Context, channelIDs []int) bool {
	if len(channelIDs) == 0 || canViewAllChannels(c) {
		return true
	}
	var count int64
	err := model.DB.Model(&model.Channel{}).
		Where("id IN ? AND creator_id = ?", channelIDs, c.GetInt("id")).
		Count(&count).Error
	if err == nil && count == int64(len(channelIDs)) {
		return true
	}
	c.JSON(http.StatusForbidden, gin.H{
		"success": false,
		"message": common.TranslateMessage(c, i18n.MsgAuthInsufficientPrivilege),
	})
	return false
}

func requireAllChannelScope(c *gin.Context) bool {
	if canViewAllChannels(c) {
		return true
	}
	c.JSON(http.StatusForbidden, gin.H{
		"success": false,
		"message": common.TranslateMessage(c, i18n.MsgAuthInsufficientPrivilege),
	})
	return false
}
