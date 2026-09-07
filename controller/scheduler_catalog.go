package controller

import (
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

// GetSchedulerCatalog exports only new-api Channel/Key scheduling metadata.
// Provider keys, BaseURL and channel settings containing credentials never
// cross this endpoint.
func GetSchedulerCatalog(c *gin.Context) {
	modelName := strings.TrimSpace(c.Query("model"))
	catalog, err := service.BuildSchedulerCatalog(modelName)
	if err != nil {
		status := http.StatusBadRequest
		if strings.Contains(err.Error(), "no channel endpoint") {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"success": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, catalog)
}
