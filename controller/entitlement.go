package controller

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
)

type entitlementPackageRequest struct {
	model.EntitlementPackage
}

type entitlementUserGrantRequest struct {
	UserIds   []int `json:"user_ids"`
	Status    int   `json:"status"`
	StartTime int64 `json:"start_time"`
	EndTime   int64 `json:"end_time"`
}

type adminEntitlementTokenRequest struct {
	UserId             int    `json:"user_id"`
	Name               string `json:"name"`
	PackageIds         []int  `json:"package_ids"`
	ExpiredTime        int64  `json:"expired_time"`
	RemainQuota        int    `json:"remain_quota"`
	UnlimitedQuota     bool   `json:"unlimited_quota"`
	ModelLimitsEnabled bool   `json:"model_limits_enabled"`
	ModelLimits        string `json:"model_limits"`
	Group              string `json:"group"`
	CrossGroupRetry    bool   `json:"cross_group_retry"`
}

type tokenEntitlementPackagesRequest struct {
	PackageIds []int `json:"package_ids"`
}

func auditEntitlementChange(c *gin.Context, action string) {
	adminId := c.GetInt("id")
	model.RecordLog(adminId, model.LogTypeSystem, fmt.Sprintf("管理员权益操作：%s", action))
}

func GetEntitlementPackages(c *gin.Context) {
	items, err := model.GetAllEntitlementPackages()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, items)
}

func SaveEntitlementPackage(c *gin.Context) {
	var req entitlementPackageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if req.Status == model.EntitlementStatusEnabled {
		if req.Group == "auto" || !ratio_setting.ContainsGroupRatio(req.Group) {
			common.ApiError(c, errors.New("启用权益包前必须绑定一个有效的固定分组"))
			return
		}
		groupModels := model.GetGroupEnabledModels(req.Group)
		for _, modelName := range strings.Split(req.Models, ",") {
			modelName = strings.TrimSpace(modelName)
			if modelName != "" && !common.StringsContains(groupModels, modelName) {
				common.ApiError(c, fmt.Errorf("模型 %s 当前未在分组 %s 中启用", modelName, req.Group))
				return
			}
		}
	}
	if err := model.SaveEntitlementPackage(&req.EntitlementPackage); err != nil {
		common.ApiError(c, err)
		return
	}
	auditEntitlementChange(c, fmt.Sprintf("保存权益包 id=%d name=%s status=%d", req.Id, req.Name, req.Status))
	common.ApiSuccess(c, req.EntitlementPackage)
}

func GetEntitlementPackageDetails(c *gin.Context) {
	packageId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	item, err := model.GetEntitlementPackage(packageId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	users, err := model.GetPackageUserEntitlements(packageId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	tokens, err := model.GetPackageTokenEntitlements(packageId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"package": item,
		"users":   users,
		"tokens":  tokens,
	})
}

func GrantEntitlementToUsers(c *gin.Context) {
	packageId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var req entitlementUserGrantRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if len(req.UserIds) == 0 || len(req.UserIds) > 500 {
		common.ApiError(c, errors.New("用户列表不能为空且单次最多 500 人"))
		return
	}
	for _, userId := range req.UserIds {
		item := model.UserEntitlement{
			PackageId: packageId,
			UserId:    userId,
			Status:    req.Status,
			StartTime: req.StartTime,
			EndTime:   req.EndTime,
		}
		if err := model.UpsertUserEntitlement(&item); err != nil {
			common.ApiError(c, fmt.Errorf("用户 %d 授权失败: %w", userId, err))
			return
		}
	}
	auditEntitlementChange(c, fmt.Sprintf("权益包 id=%d 批量用户授权 status=%d count=%d", packageId, req.Status, len(req.UserIds)))
	common.ApiSuccess(c, gin.H{"count": len(req.UserIds)})
}

func SaveTokenEntitlement(c *gin.Context) {
	var item model.TokenEntitlement
	if err := c.ShouldBindJSON(&item); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.UpsertTokenEntitlement(&item); err != nil {
		common.ApiError(c, err)
		return
	}
	auditEntitlementChange(c, fmt.Sprintf("保存令牌权益 package=%d token=%d status=%d", item.PackageId, item.TokenId, item.Status))
	common.ApiSuccess(c, item)
}

func CreateAdminEntitlementToken(c *gin.Context) {
	var req adminEntitlementTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if req.UserId <= 0 || req.Name == "" {
		common.ApiError(c, errors.New("目标用户和令牌名称不能为空"))
		return
	}
	if len(req.Name) > 50 {
		common.ApiError(c, errors.New("令牌名称最长 50 个字符"))
		return
	}
	if req.ExpiredTime == 0 {
		req.ExpiredTime = -1
	}
	if !req.UnlimitedQuota && req.RemainQuota < 0 {
		common.ApiError(c, errors.New("令牌额度不能为负数"))
		return
	}
	count, err := model.CountUserTokens(req.UserId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if int(count) >= operation_setting.GetMaxUserTokens() {
		common.ApiError(c, errors.New("目标用户已达到最大令牌数量限制"))
		return
	}
	if _, err := model.GetUserById(req.UserId, false); err != nil {
		common.ApiError(c, err)
		return
	}
	key, err := common.GenerateKey()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	now := common.GetTimestamp()
	token := model.Token{
		UserId:             req.UserId,
		Name:               req.Name,
		Key:                key,
		Status:             common.TokenStatusEnabled,
		CreatedTime:        now,
		AccessedTime:       now,
		ExpiredTime:        req.ExpiredTime,
		RemainQuota:        req.RemainQuota,
		UnlimitedQuota:     req.UnlimitedQuota,
		ModelLimitsEnabled: req.ModelLimitsEnabled,
		ModelLimits:        req.ModelLimits,
		Group:              req.Group,
		CrossGroupRetry:    req.CrossGroupRetry,
	}
	if err := model.CreateTokenWithEntitlements(&token, req.PackageIds, true); err != nil {
		common.ApiError(c, err)
		return
	}
	auditEntitlementChange(c, fmt.Sprintf("为用户 id=%d 创建定向令牌 id=%d，权益包数量=%d", req.UserId, token.Id, len(req.PackageIds)))
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"id":   token.Id,
			"name": token.Name,
			"key":  token.GetFullKey(),
		},
	})
}

func GetSelfEntitlementPackages(c *gin.Context) {
	items, err := model.GetUserEntitlementPackages(c.GetInt("id"), true)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, items)
}

func GetTokenEntitlementAssignments(c *gin.Context) {
	tokenId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	token, err := model.GetTokenByIds(tokenId, c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	items, err := model.GetTokenEntitlements(token.Id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, items)
}

func SetSelfTokenEntitlementAssignments(c *gin.Context) {
	tokenId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var req tokenEntitlementPackagesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	userId := c.GetInt("id")
	if err := model.SetTokenEntitlementPackages(tokenId, userId, req.PackageIds, false); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"package_ids": req.PackageIds})
}

func GetAdminTokenEntitlementAssignments(c *gin.Context) {
	tokenId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	items, err := model.GetTokenEntitlements(tokenId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, items)
}
