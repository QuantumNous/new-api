package controller

import (
	"errors"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

func GetModelPricingConfig(c *gin.Context) {
	snapshot, err := model.GetModelPricingSnapshot(c.QueryArray("model"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, snapshot)
}

func UpdateModelPricingConfig(c *gin.Context) {
	var request struct {
		Changes []model.ModelPricingChange `json:"changes"`
	}
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	if err := model.UpdateModelPricing(request.Changes); err != nil {
		status := http.StatusBadRequest
		if errors.Is(err, model.ErrModelPricingConflict) {
			status = http.StatusConflict
		}
		c.JSON(status, gin.H{"success": false, "message": err.Error()})
		return
	}
	names := make([]string, 0, len(request.Changes))
	for _, change := range request.Changes {
		names = append(names, change.ModelName)
	}
	recordManageAudit(c, "model.pricing.update", map[string]interface{}{"models": names})
	common.ApiSuccess(c, gin.H{"updated_models": names})
}
