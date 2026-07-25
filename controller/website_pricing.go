package controller

import (
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

var buildWebsitePricingV2Payload = func(group string, generatedAt time.Time) (service.WebsitePricingV2, error) {
	return service.BuildWebsitePricingV2(model.GetPricing(), group, generatedAt)
}

func GetWebsitePricingV2(c *gin.Context) {
	group := strings.TrimSpace(c.Query("group"))
	if group != websitePublicGroup {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "unsupported website pricing group"})
		return
	}

	payload, err := buildWebsitePricingV2Payload(group, time.Now())
	if err != nil {
		common.SysError("failed to build public website pricing: " + err.Error())
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"success": false,
			"message": "pricing temporarily unavailable",
		})
		return
	}

	c.Header("Cache-Control", "public, max-age=30, must-revalidate")
	c.JSON(http.StatusOK, payload)
}
