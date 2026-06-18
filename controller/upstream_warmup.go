package controller

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

// GetUpstreamWarmupStatus returns per-host upstream warmup status for admins.
func GetUpstreamWarmupStatus(c *gin.Context) {
	common.ApiSuccess(c, service.GetWarmupStatus())
}
