package controller

import (
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
)

func GetRatioConfig(c *gin.Context) {
	if !ratio_setting.IsExposeRatioEnabled() {
		common.ApiErrorMsgStatusCode(c, http.StatusForbidden, "ratio_config_disabled", "倍率配置接口未启用")
		return
	}
	common.ApiSuccess(c, billing_setting.GetPricingSyncData(map[string]any(ratio_setting.GetExposedData())))
}
