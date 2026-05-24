package controller

import (
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

type modelStatusEndpoint struct {
	Type   constant.EndpointType `json:"type"`
	Path   string                `json:"path"`
	Method string                `json:"method"`
}

type ModelStatusResponse struct {
	Model              string                  `json:"model"`
	Available          bool                    `json:"available"`
	SupportedEndpoints []constant.EndpointType `json:"supported_endpoint_types"`
	Endpoints          []modelStatusEndpoint   `json:"endpoints"`
}

func BuildModelStatusResponse(modelName string) ModelStatusResponse {
	model.GetPricing()
	endpointTypes := model.GetModelSupportEndpointTypes(modelName)
	endpoints := make([]modelStatusEndpoint, 0, len(endpointTypes))
	for _, endpointType := range endpointTypes {
		if info, ok := common.GetDefaultEndpointInfo(endpointType); ok {
			endpoints = append(endpoints, modelStatusEndpoint{
				Type:   endpointType,
				Path:   info.Path,
				Method: info.Method,
			})
		}
	}

	return ModelStatusResponse{
		Model:              modelName,
		Available:          len(endpointTypes) > 0,
		SupportedEndpoints: endpointTypes,
		Endpoints:          endpoints,
	}
}

func GetModelStatus(c *gin.Context) {
	modelName := c.Param("model")
	if modelName == "" {
		modelName = c.Query("model")
	}
	c.JSON(http.StatusOK, BuildModelStatusResponse(modelName))
}
