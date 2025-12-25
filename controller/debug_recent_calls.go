package controller

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

func GetRecentCalls(c *gin.Context) {
	limit := service.DefaultRecentCallsCapacity
	if v := c.Query("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			limit = n
		}
	}

	var beforeID uint64
	if v := c.Query("before_id"); v != "" {
		if n, err := strconv.ParseUint(v, 10, 64); err == nil {
			beforeID = n
		}
	}

	items := service.RecentCallsCache().List(limit, beforeID)
	c.JSON(http.StatusOK, gin.H{
		"data":  items,
		"limit": limit,
	})
}

func GetRecentCallByID(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || id == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid id",
		})
		return
	}

	rec, ok := service.RecentCallsCache().Get(id)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "not found",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": rec,
	})
}