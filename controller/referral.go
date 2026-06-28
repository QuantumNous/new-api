package controller

import (
	"net/http"

	referralservice "github.com/QuantumNous/new-api/internal/referral/service"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
)

func GetReferralSummary(c *gin.Context) {
	userID := c.GetInt("id")
	summary, err := referralservice.GetSummary(model.DB, int64(userID), system_setting.ServerAddress)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    summary,
	})
}
