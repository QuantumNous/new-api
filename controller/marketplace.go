package controller

import (
	"errors"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type modelKeyRequest struct {
	Name   string `json:"name"`
	Key    string `json:"key"`
	Status string `json:"status"`
}

type reviewRecordRequest struct {
	Action  string `json:"action"`
	Comment string `json:"comment"`
}

func ListProviders(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	if canManageAllProviders(c) {
		profiles, total, err := model.ListProviderProfiles(c.Query("keyword"), pageInfo.GetStartIdx(), pageInfo.GetPageSize())
		if err != nil {
			common.ApiError(c, err)
			return
		}
		pageInfo.SetTotal(int(total))
		pageInfo.SetItems(profiles)
		common.ApiSuccess(c, pageInfo)
		return
	}
	profile, err := currentProviderProfile(c)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			pageInfo.SetTotal(0)
			pageInfo.SetItems([]model.ProviderProfile{})
			common.ApiSuccess(c, pageInfo)
			return
		}
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(1)
	pageInfo.SetItems([]model.ProviderProfile{*profile})
	common.ApiSuccess(c, pageInfo)
}

func GetProvider(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if !canManageAllProviders(c) {
		profile, err := currentProviderProfile(c)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		if profile.Id != id {
			common.ApiErrorMsg(c, "permission denied")
			return
		}
	}
	var profile model.ProviderProfile
	if err := model.DB.First(&profile, id).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, profile)
}

func UpsertProvider(c *gin.Context) {
	var profile model.ProviderProfile
	if err := c.ShouldBindJSON(&profile); err != nil {
		common.ApiError(c, err)
		return
	}
	if canManageAllProviders(c) && c.Param("id") != "" {
		id, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			common.ApiError(c, err)
			return
		}
		profile.Id = id
	}
	if profile.Name == "" {
		common.ApiErrorMsg(c, "provider name is required")
		return
	}
	if !canManageAllProviders(c) {
		existing, err := currentProviderProfile(c)
		switch {
		case err == nil:
			profile.Id = existing.Id
			profile.UserId = existing.UserId
		case errors.Is(err, gorm.ErrRecordNotFound):
			profile.UserId = c.GetInt("id")
		default:
			common.ApiError(c, err)
			return
		}
	}
	if profile.UserId == 0 {
		common.ApiErrorMsg(c, "provider user_id is required")
		return
	}
	if err := model.DB.Save(&profile).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.EnsureProviderFinancialRows(profile.Id); err != nil {
		common.ApiError(c, err)
		return
	}
	auditMarketplace(c, "provider.upsert", map[string]interface{}{"provider_id": profile.Id})
	common.ApiSuccess(c, profile)
}

func GetProviderWallet(c *gin.Context) {
	providerId, ok := resolveProviderId(c)
	if !ok {
		return
	}
	var wallet model.ProviderWallet
	if err := model.DB.Where("provider_id = ?", providerId).First(&wallet).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, wallet)
}

func UpdateProviderWallet(c *gin.Context) {
	providerId, ok := resolveProviderId(c)
	if !ok {
		return
	}
	var wallet model.ProviderWallet
	if err := c.ShouldBindJSON(&wallet); err != nil {
		common.ApiError(c, err)
		return
	}
	wallet.ProviderId = providerId
	if err := model.DB.Where("provider_id = ?", providerId).Assign(wallet).FirstOrCreate(&wallet).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	auditMarketplace(c, "provider.wallet.update", map[string]interface{}{"provider_id": providerId})
	common.ApiSuccess(c, wallet)
}

func GetProviderSettlement(c *gin.Context) {
	providerId, ok := resolveProviderId(c)
	if !ok {
		return
	}
	var settlement model.ProviderSettlementConfig
	if err := model.DB.Where("provider_id = ?", providerId).First(&settlement).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, settlement)
}

func UpdateProviderSettlement(c *gin.Context) {
	providerId, ok := resolveProviderId(c)
	if !ok {
		return
	}
	var settlement model.ProviderSettlementConfig
	if err := c.ShouldBindJSON(&settlement); err != nil {
		common.ApiError(c, err)
		return
	}
	settlement.ProviderId = providerId
	if err := model.DB.Where("provider_id = ?", providerId).Assign(settlement).FirstOrCreate(&settlement).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	auditMarketplace(c, "provider.settlement.update", map[string]interface{}{"provider_id": providerId})
	common.ApiSuccess(c, settlement)
}

func ListMarketplaceModels(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	providerId, _ := strconv.Atoi(c.Query("provider_id"))
	listedOnly := c.Query("listed_only") == "true"
	if !canManageAllMarketplace(c) {
		if canManageOwnMarketplace(c) && !listedOnly {
			profile, err := currentProviderProfile(c)
			if err != nil {
				common.ApiError(c, err)
				return
			}
			providerId = profile.Id
		} else {
			listedOnly = true
			providerId = 0
		}
	}
	items, total, err := model.ListMarketplaceModels(c.Query("keyword"), providerId, listedOnly, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

func GetMarketplaceModel(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	detail, err := model.GetMarketplaceModelDetail(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if canManageAllMarketplace(c) {
		common.ApiSuccess(c, detail)
		return
	}
	if canManageOwnMarketplace(c) {
		profile, err := currentProviderProfile(c)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		if profile.Id == detail.ProviderId {
			common.ApiSuccess(c, detail)
			return
		}
	}
	if detail.Status != model.MarketplaceModelStatusListed {
		common.ApiErrorMsg(c, "permission denied")
		return
	}
	detail.ApiConfigs = []model.ModelApiConfig{}
	detail.Keys = []model.ModelKey{}
	detail.Reviews = []model.ModelReviewRecord{}
	detail.Wallet = nil
	detail.Settlement = nil
	common.ApiSuccess(c, detail)
}

func CreateMarketplaceModel(c *gin.Context) {
	var item model.MarketplaceModel
	if err := c.ShouldBindJSON(&item); err != nil {
		common.ApiError(c, err)
		return
	}
	if item.Name == "" {
		common.ApiErrorMsg(c, "model name is required")
		return
	}
	if !canManageAllMarketplace(c) {
		profile, err := currentProviderProfile(c)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		item.ProviderId = profile.Id
	}
	if item.ProviderId == 0 {
		common.ApiErrorMsg(c, "provider_id is required")
		return
	}
	if err := model.DB.Create(&item).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	auditMarketplace(c, "marketplace.model.create", map[string]interface{}{"model_id": item.Id})
	common.ApiSuccess(c, item)
}

func UpdateMarketplaceModel(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var item model.MarketplaceModel
	if err := model.DB.First(&item, id).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	allAccess := canManageAllMarketplace(c)
	if !requireModelOwnershipOrPermission(c, id, allAccess) {
		return
	}
	var req model.MarketplaceModel
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if !allAccess {
		req.ProviderId = item.ProviderId
	}
	if err := model.DB.Model(&item).Select("provider_id", "name", "description", "model_type", "tags", "context_length", "billing_type", "status", "recommended", "sort_order").Updates(req).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	auditMarketplace(c, "marketplace.model.update", map[string]interface{}{"model_id": id})
	common.ApiSuccess(c, item)
}

func DeleteMarketplaceModel(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if !requireModelOwnershipOrPermission(c, id, canManageAllMarketplace(c)) {
		return
	}
	if err := model.DB.Delete(&model.MarketplaceModel{}, id).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	auditMarketplace(c, "marketplace.model.delete", map[string]interface{}{"model_id": id})
	common.ApiSuccess(c, nil)
}

func UpsertModelApiConfig(c *gin.Context) {
	modelId, ok := resolveModelId(c)
	if !ok {
		return
	}
	var config model.ModelApiConfig
	if err := c.ShouldBindJSON(&config); err != nil {
		common.ApiError(c, err)
		return
	}
	config.ModelId = modelId
	if config.Id > 0 {
		if err := model.DB.Model(&model.ModelApiConfig{}).Where("id = ? AND model_id = ?", config.Id, modelId).Updates(config).Error; err != nil {
			common.ApiError(c, err)
			return
		}
	} else if err := model.DB.Create(&config).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	auditMarketplace(c, "marketplace.api_config.upsert", map[string]interface{}{"model_id": modelId})
	common.ApiSuccess(c, config)
}

func CreateModelKey(c *gin.Context) {
	modelId, ok := resolveModelId(c)
	if !ok {
		return
	}
	if !requireModelOwnershipOrPermission(c, modelId, canManageAllKeys(c)) {
		return
	}
	var req modelKeyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	key := model.ModelKey{ModelId: modelId, Name: req.Name, Status: req.Status}
	if key.Name == "" {
		key.Name = "default"
	}
	if err := model.SetModelKeyPlaintext(&key, req.Key); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.DB.Create(&key).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	auditMarketplace(c, "marketplace.key.create", map[string]interface{}{"model_id": modelId, "key_id": key.Id})
	common.ApiSuccess(c, key)
}

func UpdateModelKey(c *gin.Context) {
	modelId, ok := resolveModelId(c)
	if !ok {
		return
	}
	if !requireModelOwnershipOrPermission(c, modelId, canManageAllKeys(c)) {
		return
	}
	keyId, err := strconv.Atoi(c.Param("key_id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var existing model.ModelKey
	if err := model.DB.Where("id = ? AND model_id = ?", keyId, modelId).First(&existing).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	var req modelKeyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if req.Name != "" {
		existing.Name = req.Name
	}
	if req.Status != "" {
		existing.Status = req.Status
	}
	if req.Key != "" {
		if err := model.SetModelKeyPlaintext(&existing, req.Key); err != nil {
			common.ApiError(c, err)
			return
		}
	}
	if err := model.DB.Save(&existing).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	auditMarketplace(c, "marketplace.key.update", map[string]interface{}{"model_id": modelId, "key_id": keyId})
	common.ApiSuccess(c, existing)
}

func DeleteModelKey(c *gin.Context) {
	modelId, ok := resolveModelId(c)
	if !ok {
		return
	}
	if !requireModelOwnershipOrPermission(c, modelId, canManageAllKeys(c)) {
		return
	}
	keyId, err := strconv.Atoi(c.Param("key_id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.DB.Where("id = ? AND model_id = ?", keyId, modelId).Delete(&model.ModelKey{}).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	auditMarketplace(c, "marketplace.key.delete", map[string]interface{}{"model_id": modelId, "key_id": keyId})
	common.ApiSuccess(c, nil)
}

func UpsertModelPricing(c *gin.Context) {
	modelId, ok := resolveModelId(c)
	if !ok {
		return
	}
	var pricing model.ModelPricing
	if err := c.ShouldBindJSON(&pricing); err != nil {
		common.ApiError(c, err)
		return
	}
	pricing.ModelId = modelId
	if pricing.Id > 0 {
		if err := model.DB.Model(&model.ModelPricing{}).Where("id = ? AND model_id = ?", pricing.Id, modelId).Updates(pricing).Error; err != nil {
			common.ApiError(c, err)
			return
		}
	} else if err := model.DB.Create(&pricing).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	auditMarketplace(c, "marketplace.pricing.upsert", map[string]interface{}{"model_id": modelId, "pricing_id": pricing.Id})
	common.ApiSuccess(c, pricing)
}

func CreateModelReviewRecord(c *gin.Context) {
	modelId, ok := resolveModelId(c)
	if !ok {
		return
	}
	var req reviewRecordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	record := model.ModelReviewRecord{
		ModelId:    modelId,
		ReviewerId: c.GetInt("id"),
		Action:     req.Action,
		Comment:    req.Comment,
	}
	if record.Action == "" {
		common.ApiErrorMsg(c, "review action is required")
		return
	}
	if err := model.DB.Create(&record).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	auditMarketplace(c, "marketplace.review.create", map[string]interface{}{"model_id": modelId, "action": record.Action})
	common.ApiSuccess(c, record)
}

func currentProviderProfile(c *gin.Context) (*model.ProviderProfile, error) {
	return model.GetProviderProfileByUserId(c.GetInt("id"))
}

func canManageAllProviders(c *gin.Context) bool {
	ok, _ := model.UserHasPermission(c.GetInt("id"), c.GetInt("role"), model.PermissionProviderManage)
	return ok
}

func canManageAllMarketplace(c *gin.Context) bool {
	ok, _ := model.UserHasPermission(c.GetInt("id"), c.GetInt("role"), model.PermissionMarketplaceManage)
	return ok
}

func canManageOwnMarketplace(c *gin.Context) bool {
	ok, _ := model.UserHasPermission(c.GetInt("id"), c.GetInt("role"), model.PermissionMarketplaceSelfManage)
	return ok
}

func canManageAllKeys(c *gin.Context) bool {
	ok, _ := model.UserHasPermission(c.GetInt("id"), c.GetInt("role"), model.PermissionMarketplaceKeyManage)
	return ok
}

func resolveProviderId(c *gin.Context) (int, bool) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return 0, false
	}
	if !canManageAllProviders(c) {
		profile, err := currentProviderProfile(c)
		if err != nil {
			common.ApiError(c, err)
			return 0, false
		}
		if profile.Id != id {
			common.ApiErrorMsg(c, "permission denied")
			return 0, false
		}
	}
	return id, true
}

func resolveModelId(c *gin.Context) (int, bool) {
	modelId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return 0, false
	}
	if !requireModelOwnershipOrPermission(c, modelId, canManageAllMarketplace(c)) {
		return 0, false
	}
	return modelId, true
}

func requireModelOwnershipOrPermission(c *gin.Context, modelId int, allPermission bool) bool {
	if allPermission {
		return true
	}
	profile, err := currentProviderProfile(c)
	if err != nil {
		common.ApiError(c, err)
		return false
	}
	owns, err := model.ProviderOwnsModel(profile.Id, modelId)
	if err != nil {
		common.ApiError(c, err)
		return false
	}
	if !owns {
		common.ApiErrorMsg(c, "permission denied")
		return false
	}
	return true
}

func auditMarketplace(c *gin.Context, action string, params map[string]interface{}) {
	model.RecordOperationAuditLog(
		c.GetInt("id"),
		action,
		c.ClientIP(),
		action,
		params,
		map[string]interface{}{
			"admin_id":       c.GetInt("id"),
			"admin_username": c.GetString("username"),
			"admin_role":     c.GetInt("role"),
		},
		map[string]interface{}{"route": c.FullPath(), "method": c.Request.Method, "success": true},
	)
	common.SetContextKey(c, constant.ContextKeyAuditLogged, true)
}
