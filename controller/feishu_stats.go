package controller

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

func ManualPushFeishuDailyStats(c *gin.Context) {
	common.ApiSuccess(c, service.ManualPushFeishuStats("daily"))
}

func ManualPushFeishuWeeklyStats(c *gin.Context) {
	common.ApiSuccess(c, service.ManualPushFeishuStats("weekly"))
}

func ManualPushFeishuMonthlyStats(c *gin.Context) {
	common.ApiSuccess(c, service.ManualPushFeishuStats("monthly"))
}
