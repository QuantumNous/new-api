package controller

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

func ensureRechargeAllowed(c *gin.Context) bool {
	userId := c.GetInt("id")
	user, err := model.GetUserById(userId, false)
	if err != nil {
		common.ApiError(c, err)
		return false
	}
	if !user.AllowRecharge {
		common.ApiErrorMsg(c, "当前账户不支持充值")
		return false
	}
	return true
}
