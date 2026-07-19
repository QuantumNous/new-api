package controller

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

type channelMonitorUpstreamVersionRequest struct {
	BaseURL string `json:"base_url"`
}

// FetchChannelMonitorSub2APIUpstreamVersion returns the public Sub2API build
// version without requiring either supported credential mode.
func FetchChannelMonitorSub2APIUpstreamVersion(c *gin.Context) {
	channelId, err := strconv.Atoi(c.Param("id"))
	if err != nil || channelId <= 0 {
		common.ApiErrorMsg(c, "无效的渠道 ID")
		return
	}
	channel, err := model.GetChannelById(channelId, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	var request channelMonitorUpstreamVersionRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "无效的参数"})
		return
	}
	if strings.TrimSpace(request.BaseURL) == "" {
		common.ApiError(c, errors.New("请输入上游面板地址"))
		return
	}

	result, err := service.FetchSub2APIUpstreamVersion(
		c.Request.Context(),
		request.BaseURL,
		channel.GetSetting().Proxy,
	)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, result)
}
