package controller

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

type ApplyInviteGroupUpgradeRequest struct {
	UserId int `json:"user_id"`
}

func ApplyInviteGroupUpgradeRules(c *gin.Context) {
	var req ApplyInviteGroupUpgradeRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}

	if req.UserId > 0 {
		result, err := model.ApplyInviteGroupUpgradeByUserID(req.UserId, false)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		common.ApiSuccess(c, gin.H{
			"mode":   "single",
			"result": result,
		})
		return
	}

	summary, err := model.ApplyInviteGroupUpgradeForAllUsers(false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"mode":    "all",
		"summary": summary,
	})
}
