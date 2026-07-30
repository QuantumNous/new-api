package controller

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service/linked_service"
	"github.com/gin-gonic/gin"
)

// ─── Request / Response types ────────────────────────────────────────────────

type LinkedServiceCreateReq struct {
	Name     string `json:"name"      binding:"required"`
	Adapter  string `json:"adapter"   binding:"required"`
	AdminURL string `json:"admin_url"`
}

type LinkedServiceUpdateReq struct {
	AdminURL string `json:"admin_url"`
}

type LinkedServiceSyncReq struct {
	// AdminPassword is accepted from the request body and immediately consumed
	// by the adapter; it is NEVER persisted to the database.
	AdminPassword string `json:"admin_password" binding:"required"`
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

func ListLinkedServices(c *gin.Context) {
	services, err := model.ListLinkedServices()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": services})
}

func GetLinkedService(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid id"})
		return
	}
	svc, err := model.GetLinkedServiceByID(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if svc == nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": svc})
}

func CreateLinkedService(c *gin.Context) {
	var req LinkedServiceCreateReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	if !linked_service.IsKnownAdapter(req.Adapter) {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "unknown adapter: " + req.Adapter})
		return
	}
	svc := &model.LinkedService{
		Name:       req.Name,
		Adapter:    req.Adapter,
		AdminURL:   req.AdminURL,
		SyncStatus: model.LinkedServiceStatusPending,
	}
	if err := model.CreateLinkedService(svc); err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": svc})
}

func UpdateLinkedService(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid id"})
		return
	}
	svc, err := model.GetLinkedServiceByID(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if svc == nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "not found"})
		return
	}
	var req LinkedServiceUpdateReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	if req.AdminURL != "" {
		svc.AdminURL = req.AdminURL
	}
	if err := model.UpdateLinkedService(svc); err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": svc})
}

func DeleteLinkedService(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid id"})
		return
	}
	if err := model.DeleteLinkedService(id); err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// SyncLinkedServicePassword receives the new password from the request body,
// passes it to the adapter, and records the outcome. The password is NEVER
// stored in the database; it travels in memory only during the HTTP handler
// lifetime.
func SyncLinkedServicePassword(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid id"})
		return
	}

	var req LinkedServiceSyncReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}

	svc, err := model.GetLinkedServiceByID(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if svc == nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "not found"})
		return
	}

	newRevision := svc.Revision + 1
	syncErr := linked_service.SyncPassword(svc, req.AdminPassword)

	if syncErr != nil {
		_ = model.MarkLinkedServiceFailed(id, syncErr.Error())
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "sync failed: " + syncErr.Error(),
		})
		return
	}

	_ = model.MarkLinkedServiceSynced(id, newRevision)

	// Audit: record that a password sync was triggered (no password in log)
	auditDetail, _ := json.Marshal(map[string]any{
		"service_id": id,
		"service":    svc.Name,
		"adapter":    svc.Adapter,
		"revision":   newRevision,
	})
	common.SysLog("linked_service.sync: " + string(auditDetail))

	c.JSON(http.StatusOK, gin.H{
		"success":  true,
		"revision": newRevision,
	})
}
