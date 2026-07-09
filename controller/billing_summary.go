package controller

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

// GetBillingSummary serves the 平台账单 (Platform Billing) admin page —
// root-only (see router registration), daily cost/revenue rows filterable
// by date range, model, token name, username, email, and channel id.
func GetBillingSummary(c *gin.Context) {
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	modelName := c.Query("model_name")
	channel, _ := strconv.Atoi(c.Query("channel"))
	tokenName := c.Query("token_name")
	username := c.Query("username")
	email := c.Query("email")

	rows, err := service.GetBillingDaily(startTimestamp, endTimestamp, modelName, channel, tokenName, username, email)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": rows})
}
