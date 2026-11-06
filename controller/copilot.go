package controller

import (
	"context"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	copilot "github.com/QuantumNous/new-api/service/githubcopilot"

	"github.com/gin-gonic/gin"
)

func StartCopilotLogin(c *gin.Context) {
	state, err := copilot.StartLogin()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(200, gin.H{"success": true, "message": "", "data": state})
}

func GetCopilotLoginStatus(c *gin.Context) {
	state, err := copilot.GetLoginState(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(200, gin.H{"success": true, "message": "", "data": state})
}

func CancelCopilotLogin(c *gin.Context) {
	state, err := copilot.CancelLogin(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(200, gin.H{"success": true, "message": "", "data": state})
}

func GetCopilotChannelStatus(c *gin.Context) {
	channelID, err := strconv.Atoi(c.Param("id"))
	if err != nil || channelID <= 0 {
		common.ApiErrorT(c, "Invalid channel ID")
		return
	}
	channel, err := model.GetChannelById(channelID, true)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if channel.Type != constant.ChannelTypeGitHubCopilot {
		common.ApiErrorT(c, "Channel type is not GitHub Copilot")
		return
	}
	key, err := copilot.ParseChannelKey(channel.Key)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 20*time.Second)
	defer cancel()
	status, err := copilot.AuthStatusForProfile(ctx, key.ProfileID)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(200, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"profile_id":    key.ProfileID,
			"login":         status.Login,
			"authenticated": status.IsAuthenticated,
		},
	})
}
