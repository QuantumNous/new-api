package controller

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

// GetModelCatalogReadiness returns a key-free admin diagnostic for models that
// are configured on channels but absent from Available Models.
func GetModelCatalogReadiness(c *gin.Context) {
	group := strings.TrimSpace(c.Query("group"))
	report, err := service.AuditModelCatalogReadiness(group)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, report)
}
