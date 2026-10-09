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
		msg := common.NewMessage("The ratio config API is not enabled")
		body := msg.Fields()
		body["success"] = false
		body["message"] = msg.Error()
		c.JSON(http.StatusForbidden, body)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    billing_setting.GetPricingSyncData(map[string]any(ratio_setting.GetExposedData())),
	})
}
