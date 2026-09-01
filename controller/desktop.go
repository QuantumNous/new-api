package controller

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type desktopBootstrapCapabilities struct {
	DeviceAuthorization bool `json:"device_authorization"`
	AccountRead         bool `json:"account_read"`
	UsageRead           bool `json:"usage_read"`
	ModelsRead          bool `json:"models_read"`
	PricingRead         bool `json:"pricing_read"`
	ToolKeysManage      bool `json:"tool_keys_manage"`
}

type desktopBootstrapData struct {
	SchemaVersion        int                          `json:"schema_version"`
	Service              string                       `json:"service"`
	ContractID           string                       `json:"contract_id"`
	MinimumClientVersion string                       `json:"minimum_client_version"`
	Capabilities         desktopBootstrapCapabilities `json:"capabilities"`
}

type desktopBootstrapResponse struct {
	Success bool                 `json:"success"`
	Data    desktopBootstrapData `json:"data"`
}

// GetDesktopBootstrap exposes format compatibility only. Capability activation
// requires a separately versioned and governed desktop contract.
func GetDesktopBootstrap(c *gin.Context) {
	c.JSON(http.StatusOK, desktopBootstrapResponse{
		Success: true,
		Data: desktopBootstrapData{
			SchemaVersion:        1,
			Service:              "yeschoy-desktop",
			ContractID:           "desktop-bootstrap-v1",
			MinimumClientVersion: "0.1.0",
			Capabilities:         desktopBootstrapCapabilities{},
		},
	})
}
