package controller

import (
	"errors"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

func ensureSubscriptionPayEligible(c *gin.Context, userId int, plan *model.SubscriptionPlan) bool {
	if err := model.CheckSubscriptionPayEligibilityTx(nil, userId, plan); err != nil {
		if errors.Is(err, model.ErrSubscriptionAlreadyActive) {
			common.ApiErrorI18n(c, i18n.MsgSubscriptionAlreadyActive)
			return false
		}
		common.ApiError(c, err)
		return false
	}
	return true
}
