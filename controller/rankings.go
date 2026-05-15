package controller

import (
	"net/http"

	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

func GetRankings(c *gin.Context) {
	resp, err := buildRankingsResponse(c.DefaultQuery("period", "week"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, service.TranslateAPIResponse(c, "rankings", resp, rankingsTranslationPaths))
}

func buildRankingsResponse(period string) (gin.H, error) {
	result, err := service.GetRankingsSnapshot(period)
	if err != nil {
		return nil, err
	}
	return gin.H{
		"success": true,
		"data":    result,
	}, nil
}
