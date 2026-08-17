package controller

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
)

const copilotDeviceFlowSessionPrefix = "copilot_device_flow_"

func StartCopilotDeviceFlow(c *gin.Context) {
	channelID, channel, ok := copilotDeviceChannel(c)
	if !ok {
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()
	flow, err := service.StartCopilotDeviceFlow(ctx, c.GetInt("id"), channelID, channel.GetSetting().Proxy)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	session := sessions.Default(c)
	session.Set(copilotDeviceFlowSessionPrefix+strconv.Itoa(channelID), flow.FlowID)
	if err := session.Save(); err != nil {
		common.ApiError(c, errors.New("failed to save copilot authorization session"))
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": gin.H{
		"verification_uri": flow.VerificationURI,
		"user_code":        flow.UserCode,
		"expires_in":       flow.ExpiresIn,
		"interval":         flow.Interval,
	}})
}

func PollCopilotDeviceFlow(c *gin.Context) {
	channelID, channel, ok := copilotDeviceChannel(c)
	if !ok {
		return
	}
	session := sessions.Default(c)
	flowID, _ := session.Get(copilotDeviceFlowSessionPrefix + strconv.Itoa(channelID)).(string)
	if flowID == "" {
		c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": gin.H{
			"status": "expired", "message": "authorization session expired",
		}})
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()
	result, err := service.PollCopilotDeviceFlow(ctx, flowID, c.GetInt("id"), channelID, channel.GetSetting().Proxy)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if result.Status != "pending" {
		session.Delete(copilotDeviceFlowSessionPrefix + strconv.Itoa(channelID))
		_ = session.Save()
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": result})
}

func copilotDeviceChannel(c *gin.Context) (int, *model.Channel, bool) {
	channelID, err := strconv.Atoi(c.Param("id"))
	if err != nil || channelID <= 0 {
		common.ApiError(c, fmt.Errorf("invalid channel id"))
		return 0, nil, false
	}
	channel, err := model.GetChannelById(channelID, false)
	if err != nil {
		common.ApiError(c, err)
		return 0, nil, false
	}
	if channel.Type != constant.ChannelTypeCopilot {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "channel type is not Copilot"})
		return 0, nil, false
	}
	return channelID, channel, true
}
