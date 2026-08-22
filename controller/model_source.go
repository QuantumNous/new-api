package controller

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

// ============================================================
// Model Source CRUD (六平台凭据管理)
// ============================================================

// CreateModelSource 创建平台凭据
// POST /api/admin/model-sources
func CreateModelSource(c *gin.Context) {
	var req dto.ModelSourceCreateRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	ms, err := service.CreateModelSource(&req)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, modelToSourceResp(ms))
}

// GetModelSources 列出所有平台凭据
// GET /api/admin/model-sources
func GetModelSources(c *gin.Context) {
	resp, err := service.GetAllModelSources()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, resp)
}

// GetModelSourceDetail 获取单个凭据详情
// GET /api/admin/model-sources/:id
func GetModelSourceDetail(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	resp, err := service.GetModelSourceDetail(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, resp)
}

// UpdateModelSource 更新平台凭据
// PUT /api/admin/model-sources/:id
func UpdateModelSource(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	var req dto.ModelSourceCreateRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	if err := service.UpdateModelSource(id, &req); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"message": "ok"})
}

// DeleteModelSource 软删除平台凭据
// DELETE /api/admin/model-sources/:id
func DeleteModelSource(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	if err := service.DeleteModelSource(id); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"message": "deleted"})
}

// ============================================================
// HuggingFace Model Management
// ============================================================

// SearchHFHubModels 搜索 HF Hub 公开模型
// GET /api/admin/hf-hub/search
func SearchHFHubModels(c *gin.Context) {
	sourceIdStr := c.Query("source_id")
	sourceId, err := strconv.Atoi(sourceIdStr)
	if err != nil || sourceId <= 0 {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	req := &dto.HFModelSearchRequest{
		SourceId: sourceId,
		Query:    c.Query("query"),
		Author:   c.Query("author"),
		Task:     c.Query("task"),
	}
	if limitStr := c.Query("limit"); limitStr != "" {
		if v, err := strconv.Atoi(limitStr); err == nil && v > 0 {
			req.Limit = v
		}
	}
	if offsetStr := c.Query("offset"); offsetStr != "" {
		if v, err := strconv.Atoi(offsetStr); err == nil && v >= 0 {
			req.Offset = v
		}
	}

	resp, err := service.SearchHFHubModels(sourceId, req)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, resp)
}

// DeployHFModel 注册/部署一个 HF 模型
// POST /api/admin/hf-models/deploy
func DeployHFModel(c *gin.Context) {
	var req dto.HFModelDeployRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	m, err := service.DeployHFModel(req.SourceId, &req)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, dto.HFModelDeployResponse{
		ModelId: m.Id,
		RepoId:  m.RepoId,
		Status:  m.DeploymentStatus,
		Message: "model registered successfully",
	})
}

// GetHFModels 列出所有 HF 模型
// GET /api/admin/hf-models
func GetHFModels(c *gin.Context) {
	resp, err := service.GetAllHFModels()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, resp)
}

// GetHFModelDetail 获取单个模型详情
// GET /api/admin/hf-models/:id
func GetHFModelDetail(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	resp, err := service.GetHFModelDetail(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, resp)
}

// ToggleHFModel 启用/关闭模型
// PUT /api/admin/hf-models/:id/toggle
func ToggleHFModel(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	var req dto.HFModelToggleRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	m, err := service.ToggleHFModel(id, *req.Enabled)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"id":      m.Id,
		"enabled": m.Enabled,
		"status":  m.DeploymentStatus,
	})
}

// DeleteHFModel 删除模型记录
// DELETE /api/admin/hf-models/:id
func DeleteHFModel(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	if err := service.DeleteHFModel(id); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"message": "deleted"})
}

// ============================================================
// Helpers
// ============================================================

func modelToSourceResp(ms *model.ModelSource) dto.ModelSourceResponse {
	return dto.ModelSourceResponse{
		Id:            ms.Id,
		SourceType:    ms.SourceType,
		Label:         ms.Label,
		Enabled:       ms.Enabled,
		Remark:        ms.Remark,
		HasCredential: strings.TrimSpace(ms.Config) != "",
		CreatedAt:     ms.CreatedAt,
		UpdatedAt:     ms.UpdatedAt,
	}
}

// SourceTypeDisplayName 返回平台类型的显示名称
func SourceTypeDisplayName(st string) string {
	switch st {
	case model.SourceTypeHuggingFace:
		return "Hugging Face"
	case model.SourceTypeModelScope:
		return "魔搭社区"
	case model.SourceTypePaddleHub:
		return "飞桨 PaddleHub"
	case model.SourceTypeModelers:
		return "魔乐 Modelers"
	case model.SourceTypeOpenI:
		return "OpenI 启智"
	case model.SourceTypeMoArk:
		return "模力方舟"
	default:
		return st
	}
}

// ValidateSourceType 校验平台类型
func ValidateSourceType(st string) bool {
	switch st {
	case model.SourceTypeHuggingFace,
		model.SourceTypeModelScope,
		model.SourceTypePaddleHub,
		model.SourceTypeModelers,
		model.SourceTypeOpenI,
		model.SourceTypeMoArk:
		return true
	}
	return false
}

// GetAllSourceTypes 返回所有支持的平台类型
func GetAllSourceTypes() []string {
	return model.AllSourceTypes()
}
