package controller

import (
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

func GetBillingStatistics(c *gin.Context) {
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	pageInfo := common.GetPageQuery(c)

	result, err := model.GetBillingStatistics(model.BillingStatisticsQuery{
		StartTimestamp: startTimestamp,
		EndTimestamp:   endTimestamp,
		Granularity:    c.Query("granularity"),
		Username:       c.Query("username"),
		Page:           pageInfo.GetPage(),
		PageSize:       pageInfo.GetPageSize(),
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, result)
}
