package controller

import (
	"net/http"

	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
)

func GetRatioConfig(c *gin.Context) {
	if !ratio_setting.IsExposeRatioEnabled() {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"message": i18n.T(c, "ratio_config.not_enabled"),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    ratio_setting.GetExposedData(),
	})
}
