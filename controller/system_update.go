package controller

import (
	"errors"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/service/selfupdate"
	"github.com/gin-gonic/gin"
)

func CheckSystemUpdate(c *gin.Context) {
	force := c.Query("force") == "true"
	info, err := selfupdate.Default().Check(c.Request.Context(), force)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, info)
}

func PerformSystemUpdate(c *gin.Context) {
	svc := selfupdate.Default()
	result, err := svc.Perform(c.Request.Context())
	if err != nil {
		if errors.Is(err, selfupdate.ErrUpdateInProgress) {
			common.ApiErrorMsg(c, "update already in progress")
			return
		}
		if errors.Is(err, selfupdate.ErrUpdateDisabled) {
			common.ApiErrorMsg(c, "self-update is disabled")
			return
		}
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, result)
}

func GetSystemUpdateStatus(c *gin.Context) {
	status := selfupdate.Default().Status()
	common.ApiSuccess(c, status)
}

func RestartSystem(c *gin.Context) {
	if err := selfupdate.Default().Restart(c.Request.Context()); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"message": "restart scheduled"})
}
