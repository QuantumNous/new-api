package controller

import (
	"errors"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

type channelMonitorGroupMembershipUpdateRequest struct {
	Group      string `json:"group"`
	ChannelIds []int  `json:"channel_ids"`
}

func UpdateChannelMonitorGroupChannels(c *gin.Context) {
	var request channelMonitorGroupMembershipUpdateRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "无效的参数"})
		return
	}
	request.Group = strings.TrimSpace(request.Group)
	if request.Group == "" || utf8.RuneCountInString(request.Group) > 64 || strings.ContainsAny(request.Group, ",\r\n") {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "分组名称无效"})
		return
	}
	for _, channelId := range request.ChannelIds {
		if channelId <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "渠道 ID 必须为正整数"})
			return
		}
	}

	result, err := model.ReplaceChannelMonitorGroupMembers(request.Group, request.ChannelIds)
	if err != nil {
		if errors.Is(err, model.ErrChannelMonitorGroupInvalid) ||
			errors.Is(err, model.ErrChannelMonitorGroupChannelInvalid) ||
			errors.Is(err, model.ErrChannelMonitorGroupChannelNotFound) ||
			errors.Is(err, model.ErrChannelMonitorGroupMembershipRequired) ||
			errors.Is(err, model.ErrChannelMonitorGroupMembershipListTooLong) {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
			return
		}
		common.ApiError(c, err)
		return
	}

	if len(result.AddedChannelIds) > 0 || len(result.RemovedChannelIds) > 0 {
		model.InitChannelCache()
	}
	recordManageAudit(c, "channel.monitor_group_channels_update", map[string]interface{}{
		"group":               result.Group,
		"channel_count":       len(result.ChannelIds),
		"channel_ids":         result.ChannelIds,
		"added_count":         len(result.AddedChannelIds),
		"added_channel_ids":   result.AddedChannelIds,
		"removed_count":       len(result.RemovedChannelIds),
		"removed_channel_ids": result.RemovedChannelIds,
	})
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    result,
	})
}
