package controller

import (
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

type cdkToolRedeemRequest struct {
	Code          string `json:"code"`
	RecoveryToken string `json:"recovery_token"`
}

func RedeemCdkToolCode(c *gin.Context) {
	req := cdkToolRedeemRequest{}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	result, err := model.RedeemCdkToolCode(strings.TrimSpace(req.Code), strings.TrimSpace(req.RecoveryToken))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	common.ApiSuccess(c, result)
}
