package controller

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// GetPaymentSecurityStatus is registered under the root-only settings routes.
// Never return key paths, ciphertext, credentials, or raw filesystem/SQL errors.
func GetPaymentSecurityStatus(c *gin.Context) {
	c.Header("Cache-Control", "no-store")
	common.ApiSuccess(c, model.InspectPaymentSecrets(model.DB.WithContext(c.Request.Context())))
}
