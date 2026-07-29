package controller

import (
	"errors"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

type modelPricingPutRequest struct {
	Revision int64                    `json:"revision"`
	Model    model.ModelPricingUpdate `json:"model"`
}

type modelPricingBulkRequest struct {
	Revision int64                      `json:"revision"`
	Models   []model.ModelPricingUpdate `json:"models"`
}

func GetAdminModelPricing(c *gin.Context) {
	revision, rows, err := model.GetModelPricingRows()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	configured := 0
	for _, row := range rows {
		if row.Configured {
			configured++
		}
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": gin.H{
		"revision": revision,
		"summary":  gin.H{"total": len(rows), "configured": configured, "unconfigured": len(rows) - configured},
		"models":   rows,
	}})
}

func PutAdminModelPricing(c *gin.Context) {
	var request modelPricingPutRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid request body"})
		return
	}
	writeAdminModelPricing(c, request.Revision, []model.ModelPricingUpdate{request.Model})
}

func BulkAdminModelPricing(c *gin.Context) {
	var request modelPricingBulkRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid request body"})
		return
	}
	if len(request.Models) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "models must not be empty"})
		return
	}
	writeAdminModelPricing(c, request.Revision, request.Models)
}

func writeAdminModelPricing(c *gin.Context, revision int64, updates []model.ModelPricingUpdate) {
	next, err := model.ReplaceModelPricing(revision, updates)
	if err != nil {
		var conflict *model.PricingRevisionConflict
		if errors.As(err, &conflict) {
			c.JSON(http.StatusConflict, gin.H{"success": false, "message": err.Error(), "data": gin.H{"revision": conflict.CurrentRevision}})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	auditData := map[string]interface{}{"revision": next, "count": len(updates)}
	if len(updates) == 1 {
		auditData["model_name"] = updates[0].ModelName
	}
	recordManageAudit(c, "pricing.update", auditData)
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": gin.H{"revision": next}})
}
