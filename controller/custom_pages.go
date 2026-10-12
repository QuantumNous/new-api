package controller

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

func GetCustomPages(c *gin.Context) {
	// Responses contain role-specific URLs and must not enter shared caches.
	c.Header("Cache-Control", "no-store")
	pages, err := model.GetCustomPagesForRole(c.GetInt("role"))
	if err != nil {
		common.ApiErrorT(c, "Failed to load custom pages")
		return
	}
	common.ApiSuccess(c, pages)
}
