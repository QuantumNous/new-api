package controller

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

func GetChannelBalanceConfig(c *gin.Context) {
	c.Header("Cache-Control", "no-store")
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid channel ID"})
		return
	}
	channel, err := model.GetChannelById(id, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	config, err := channel.GetBalanceConfig()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{
		"enabled": config.Enabled, "base_url": config.BaseURL, "user_id": config.UserID,
		"has_access_token": config.AccessToken != "",
	}})
}

func SetChannelBalanceConfig(c *gin.Context) {
	c.Header("Cache-Control", "no-store")
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid channel ID"})
		return
	}
	var config model.ChannelBalanceConfig
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 16<<10)
	if c.ShouldBindJSON(&config) != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid account balance configuration"})
		return
	}
	if err := service.ValidateAccountBalanceConfig(&config); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.SaveChannelBalanceConfig(id, config); err != nil {
		common.ApiError(c, err)
		return
	}
	model.InitChannelCache()
	c.JSON(http.StatusOK, gin.H{"success": true})
}
