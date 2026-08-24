package controller

import (
	"net/http"

	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
)

var getRankingsSnapshot = service.GetRankingsSnapshot

func GetRankings(c *gin.Context) {
	result, err := getRankingsSnapshot(c.DefaultQuery("period", "week"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	if c.Query("view") == "public" && len(operation_setting.GetPricingHiddenModelPatterns()) > 0 {
		result = service.FilterRankingsResponse(result, func(modelName string) bool {
			return !operation_setting.IsPricingHiddenModel(modelName)
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    result,
	})
}
