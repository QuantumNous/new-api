package controller

import (
	"errors"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

type channelMonitorUpstreamVersionRequest struct {
	BaseURL string `json:"base_url"`
}

// FetchChannelMonitorSub2APIUpstreamVersion returns the public Sub2API build
// version without requiring either supported credential mode.
func FetchChannelMonitorSub2APIUpstreamVersion(c *gin.Context) {
	var request channelMonitorUpstreamVersionRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "无效的参数"})
		return
	}
	if strings.TrimSpace(request.BaseURL) == "" {
		common.ApiError(c, errors.New("请输入上游面板地址"))
		return
	}

	result, err := service.FetchSub2APIUpstreamVersion(c.Request.Context(), request.BaseURL)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, result)
}
