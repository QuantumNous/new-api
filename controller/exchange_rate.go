package controller

import (
	"net/http"

	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

func GetExchangeRate(c *gin.Context) {
	rate := service.GetCachedUSDToCNYRate()
	c.JSON(http.StatusOK, gin.H{"success": true, "rate": rate})
}
