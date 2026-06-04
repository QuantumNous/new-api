package controller

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

type QueryKeyReportRequest struct {
	Keys []string `json:"keys"`
}

func QueryChannelKeyReport(c *gin.Context) {
	request := QueryKeyReportRequest{}
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		common.ApiError(c, err)
		return
	}

	report, err := model.BuildChannelQueryKeyReport(request.Keys)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	common.ApiSuccess(c, report)
}
