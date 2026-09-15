package controller

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

func GetUserLogSummary(c *gin.Context) {
	start, startErr := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	end, endErr := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	offset, offsetErr := strconv.Atoi(c.DefaultQuery("timezone_offset", "0"))
	if startErr != nil || endErr != nil || offsetErr != nil || start <= 0 || end < start ||
		end-start >= 10*24*60*60 || offset < -14*60 || offset > 14*60 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Invalid report window (maximum 10 days)"})
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()
	summary, err := model.GetUserLogSummary(ctx, c.GetInt("id"), start, end, offset)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, summary)
}
