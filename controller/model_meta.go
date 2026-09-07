package controller

import (
	"errors"
	"net/http"
	"sort"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ListModelsMetaResponse — response body of GET /api/models/. Combines
// paged model list with vendor counts so the admin UI populates the filter
// sidebar in a single round-trip. Named schema replaces anonymous gin.H.
type ListModelsMetaResponse struct {
	Items        []*model.Model  `json:"items"`
	Total        int64           `json:"total"`
	Page         int             `json:"page"`
	PageSize     int             `json:"page_size"`
	VendorCounts map[int64]int64 `json:"vendor_counts"`
}

// GetAllModelsMeta 获取模型列表（分页）
func GetAllModelsMeta(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	status := c.Query("status")
	syncOfficial := c.Query("sync_official")
	modelsMeta, total, err := model.SearchModels("", "", status, syncOfficial, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiErrorStatusCode(c, http.StatusInternalServerError, "internal_error", err)
		return
	}
	enrichModels(modelsMeta)

	// 统计供应商计数（全部数据，不受分页影响）
	vendorCounts, _ := model.GetVendorModelCounts()

	common.ApiSuccess(c, ListModelsMetaResponse{
		Items:        modelsMeta,
		Total:        total,
		Page:         pageInfo.GetPage(),
		PageSize:     pageInfo.GetPageSize(),
		VendorCounts: vendorCounts,
	})
}

// SearchModelsMeta 搜索模型列表
func SearchModelsMeta(c *gin.Context) {
	keyword := c.Query("keyword")
	vendor := c.Query("vendor")
	status := c.Query("status")
	syncOfficial := c.Query("sync_official")
	pageInfo := common.GetPageQuery(c)

	modelsMeta, total, err := model.SearchModels(keyword, vendor, status, syncOfficial, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiErrorStatusCode(c, http.StatusInternalServerError, "internal_error", err)
		return
	}
	enrichModels(modelsMeta)
	vendorCounts, _ := model.GetVendorModelCounts()
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(modelsMeta)
	common.ApiSuccess(c, gin.H{
		"items":         modelsMeta,
		"total":         total,
		"page":          pageInfo.GetPage(),
		"page_size":     pageInfo.GetPageSize(),
		"vendor_counts": vendorCounts,
	})
}

// GetModelMeta 根据 ID 获取单条模型信息
func GetModelMeta(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsgStatusCode(c, http.StatusBadRequest, "invalid_params", "invalid id")
		return
	}
	var m model.Model
	if err := model.DB.First(&m, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.ApiErrorMsgStatusCode(c, http.StatusNotFound, "model_not_found", "model not found")
			return
		}
		common.ApiErrorStatusCode(c, http.StatusInternalServerError, "internal_error", err)
		return
	}
	enrichModels([]*model.Model{&m})
	common.ApiSuccess(c, &m)
}

// CreateModelMeta 新建模型
func CreateModelMeta(c *gin.Context) {
	var m model.Model
	if err := c.ShouldBindJSON(&m); err != nil {
		common.ApiErrorMsgStatusCode(c, http.StatusBadRequest, "invalid_params", err.Error())
		return
	}
	if m.ModelName == "" {
		common.ApiErrorMsgStatusCode(c, http.StatusBadRequest, "model_name_empty", "模型名称不能为空")
		return
	}
	if err := model.ValidateMetadataValues(model.MetadataValues{Endpoints: m.Endpoints, Status: m.Status, NameRule: m.NameRule}); err != nil {
		common.ApiError(c, err)
		return
	}
	// 名称冲突检查
	if dup, err := model.IsModelNameDuplicated(0, m.ModelName); err != nil {
		common.ApiErrorStatusCode(c, http.StatusInternalServerError, "internal_error", err)
		return
	} else if dup {
		common.ApiErrorMsgStatusCode(c, http.StatusConflict, "model_name_exists", "模型名称已存在")
		return
	}

	if err := m.Insert(); err != nil {
		common.ApiErrorStatusCode(c, http.StatusInternalServerError, "internal_error", err)
		return
	}
	model.RefreshPricing()
	common.ApiSuccessStatus(c, http.StatusCreated, &m)
}

// UpdateModelMeta 更新模型
func UpdateModelMeta(c *gin.Context) {
	statusOnly := c.Query("status_only") == "true"

	var m model.Model
	if err := c.ShouldBindJSON(&m); err != nil {
		common.ApiErrorMsgStatusCode(c, http.StatusBadRequest, "invalid_params", err.Error())
		return
	}
	if m.Id == 0 {
		common.ApiErrorMsgStatusCode(c, http.StatusBadRequest, "model_id_missing", "缺少模型 ID")
		return
	}

	if statusOnly {
		if m.Status != 0 && m.Status != 1 {
			common.ApiErrorMsg(c, "invalid catalog visibility")
			return
		}
		// 只更新状态，防止误清空其他字段
		if err := model.DB.Model(&model.Model{}).Where("id = ?", m.Id).Update("status", m.Status).Error; err != nil {
			common.ApiErrorStatusCode(c, http.StatusInternalServerError, "internal_error", err)
			return
		}
	} else {
		if strings.TrimSpace(m.ModelName) == "" {
			common.ApiErrorMsg(c, "模型名称不能为空")
			return
		}
		if err := model.ValidateMetadataValues(model.MetadataValues{Endpoints: m.Endpoints, Status: m.Status, NameRule: m.NameRule}); err != nil {
			common.ApiError(c, err)
			return
		}
		// 名称冲突检查
		if dup, err := model.IsModelNameDuplicated(m.Id, m.ModelName); err != nil {
			common.ApiErrorStatusCode(c, http.StatusInternalServerError, "internal_error", err)
			return
		} else if dup {
			common.ApiErrorMsgStatusCode(c, http.StatusConflict, "model_name_exists", "模型名称已存在")
			return
		}

		if err := m.Update(); err != nil {
			common.ApiErrorStatusCode(c, http.StatusInternalServerError, "internal_error", err)
			return
		}
	}
	model.RefreshPricing()
	common.ApiSuccess(c, &m)
}

// DeleteModelMeta 删除模型
func DeleteModelMeta(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsgStatusCode(c, http.StatusBadRequest, "invalid_params", "invalid id")
		return
	}
	removeFromChannels, err := strconv.ParseBool(c.DefaultQuery("remove_from_channels", "false"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	removePricing, err := strconv.ParseBool(c.DefaultQuery("remove_pricing", "false"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if removePricing && c.GetInt("role") != common.RoleRootUser {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "Model pricing is managed by a super administrator."})
		return
	}
	var existing model.Model
	if err := model.DB.Select("id").First(&existing, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.ApiErrorMsgStatusCode(c, http.StatusNotFound, "model_not_found", "model not found")
		} else {
			common.ApiErrorStatusCode(c, http.StatusInternalServerError, "internal_error", err)
		}
		return
	}
	result, err := model.DeleteModelMetadata([]int{id}, removeFromChannels, removePricing)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		common.ApiErrorMsgStatusCode(c, http.StatusNotFound, "model_not_found", "model not found")
		return
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "model.delete", map[string]interface{}{"model_ids": []int{id}, "remove_from_channels": removeFromChannels, "remove_pricing": removePricing, "updated_channels": result.UpdatedChannels})
	common.ApiSuccess(c, result)
}

func BatchDeleteModelMeta(c *gin.Context) {
	var request struct {
		ModelIDs           []int `json:"model_ids"`
		RemoveFromChannels bool  `json:"remove_from_channels"`
		RemovePricing      bool  `json:"remove_pricing"`
	}
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		common.ApiError(c, err)
		return
	}
	if request.RemovePricing && c.GetInt("role") != common.RoleRootUser {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "Model pricing is managed by a super administrator."})
		return
	}
	result, err := model.DeleteModelMetadata(request.ModelIDs, request.RemoveFromChannels, request.RemovePricing)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "model.delete_batch", map[string]interface{}{"model_ids": request.ModelIDs, "remove_from_channels": request.RemoveFromChannels, "remove_pricing": request.RemovePricing, "updated_channels": result.UpdatedChannels})
	common.ApiSuccess(c, result)
}

// enrichModels keeps configured endpoints intact and derives connections from
// enabled routes, including hidden or unpriced models absent from the catalog.
func enrichModels(models []*model.Model) {
	if len(models) == 0 {
		return
	}
	connections, err := model.GetModelConnections()
	if err != nil {
		common.SysError("load model connections: " + err.Error())
		return
	}
	for _, metadata := range models {
		if metadata == nil {
			continue
		}
		channels := make(map[int]model.BoundChannel)
		groups := make(map[string]bool)
		names := make(map[string]bool)
		endpoints := make(map[string]bool)
		quotas := make(map[int]bool)
		for _, connection := range connections {
			name := connection.Model
			matched := name == metadata.ModelName
			switch metadata.NameRule {
			case model.NameRulePrefix:
				matched = strings.HasPrefix(name, metadata.ModelName)
			case model.NameRuleSuffix:
				matched = strings.HasSuffix(name, metadata.ModelName)
			case model.NameRuleContains:
				matched = strings.Contains(name, metadata.ModelName)
			}
			if !matched {
				continue
			}
			names[name] = true
			groups[connection.Group] = true
			channels[connection.ChannelId] = model.BoundChannel{Name: connection.ChannelName, Type: connection.ChannelType}
			for _, endpoint := range model.GetModelSupportEndpointTypes(name) {
				endpoints[string(endpoint)] = true
			}
			for _, quota := range model.GetModelQuotaTypes(name) {
				quotas[quota] = true
			}
		}
		metadata.BoundChannels = nil
		metadata.EnableGroups = nil
		metadata.SupportedEndpoints = nil
		metadata.QuotaTypes = nil
		metadata.MatchedModels = nil
		for _, channel := range channels {
			metadata.BoundChannels = append(metadata.BoundChannels, channel)
		}
		sort.Slice(metadata.BoundChannels, func(i, j int) bool {
			a, b := metadata.BoundChannels[i], metadata.BoundChannels[j]
			if a.Name == b.Name {
				return a.Type < b.Type
			}
			return a.Name < b.Name
		})
		for group := range groups {
			metadata.EnableGroups = append(metadata.EnableGroups, group)
		}
		for endpoint := range endpoints {
			metadata.SupportedEndpoints = append(metadata.SupportedEndpoints, endpoint)
		}
		for quota := range quotas {
			metadata.QuotaTypes = append(metadata.QuotaTypes, quota)
		}
		sort.Strings(metadata.EnableGroups)
		sort.Strings(metadata.SupportedEndpoints)
		sort.Ints(metadata.QuotaTypes)
		if metadata.NameRule != model.NameRuleExact {
			for name := range names {
				metadata.MatchedModels = append(metadata.MatchedModels, name)
			}
			sort.Strings(metadata.MatchedModels)
			metadata.MatchedCount = len(names)
		}
	}
}
