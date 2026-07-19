package controller

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

type InvitePromoEventRequest struct {
	Event string `json:"event"`
}

func RecordInvitePromoEvent(c *gin.Context) {
	userId := c.GetInt("id")
	var req InvitePromoEventRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	event := strings.TrimSpace(req.Event)
	if !model.IsValidInvitePromoEvent(event) {
		common.ApiErrorMsg(c, "无效事件")
		return
	}
	if err := model.RecordInvitePromoEvent(userId, event); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}
