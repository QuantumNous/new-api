package controller

import (
	"io"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

func ExportRemoteSecurityLogs(c *gin.Context) {
	var req service.RemoteLogExportRequest
	if c.Request.Body != nil {
		err := common.DecodeJson(c.Request.Body, &req)
		if err != nil && err != io.EOF {
			common.ApiErrorMsg(c, "参数错误: "+err.Error())
			return
		}
	}

	resp, err := service.ExportSecurityLogs(c.Request.Context(), req, c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, resp)
}
