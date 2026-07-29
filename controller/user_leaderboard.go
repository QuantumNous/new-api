package controller

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

// GetUsageLeaderboard returns the user usage leaderboard.
// Query params: period (today|week|month, default week), limit (1-100, default 20).
func GetUsageLeaderboard(c *gin.Context) {
	period := c.DefaultQuery("period", "week")
	limit := parseLeaderboardLimit(c.Query("limit"))
	currentUserId := c.GetInt("id")

	result, err := service.GetUsageLeaderboard(period, limit, currentUserId)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    result,
	})
}

// GetCheckinLeaderboard returns the daily check-in leaderboard.
// Query params: date (YYYY-MM-DD, default today), limit (1-100, default 20).
func GetCheckinLeaderboard(c *gin.Context) {
	date := c.Query("date")
	limit := parseLeaderboardLimit(c.Query("limit"))
	currentUserId := c.GetInt("id")

	result, err := service.GetCheckinLeaderboard(date, limit, currentUserId)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    result,
	})
}

func parseLeaderboardLimit(raw string) int {
	if raw == "" {
		return 0
	}
	n, err := strconv.Atoi(raw)
	if err != nil {
		return 0
	}
	return n
}
