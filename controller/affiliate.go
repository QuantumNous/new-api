package controller

import (
	"errors"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func GetAffiliateStatus(c *gin.Context) {
	userId := c.GetInt("id")
	role := c.GetInt("role")

	dbReady := model.DB != nil
	input := service.AffiliateScopeInput{
		UserId: userId,
		Role:   role,
	}

	if common.AffiliateEnabled && role < common.RoleAdminUser {
		profile, err := getActiveAffiliateProfile(userId)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		if profile != nil {
			input.ProfileStatus = profile.Status
			input.ProfileLevel = profile.Level
		}
	}

	scope := service.ResolveAffiliateAccessScope(input)
	common.ApiSuccess(c, buildAffiliateStatusResponse(common.AffiliateEnabled, dbReady, role, scope))
}

func GetAffiliateScopedLogs(c *gin.Context) {
	scope, ok := getAffiliateScopeFromContext(c)
	if !ok {
		common.ApiErrorMsg(c, "分销 scope 未初始化")
		return
	}

	pageInfo := common.GetPageQuery(c)
	logType, _ := strconv.Atoi(c.Query("type"))
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	userId, _ := strconv.Atoi(c.Query("user_id"))
	secondLevelUserId, _ := strconv.Atoi(c.Query("second_level_user_id"))

	logs, total, err := service.ListAffiliateScopedLogs(model.DB, model.LOG_DB, service.AffiliateScopedLogsInput{
		Scope:                  scope,
		LogType:                logType,
		RequestStatus:          c.Query("request_status"),
		StartTimestamp:         startTimestamp,
		EndTimestamp:           endTimestamp,
		ModelName:              c.Query("model_name"),
		Group:                  c.Query("group"),
		UserId:                 userId,
		SecondLevelAffiliateId: secondLevelUserId,
		StartIdx:               pageInfo.GetStartIdx(),
		PageSize:               pageInfo.GetPageSize(),
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}

	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(logs)
	common.ApiSuccess(c, pageInfo)
}

func GetAffiliateSummary(c *gin.Context) {
	scope, ok := getAffiliateScopeFromContext(c)
	if !ok {
		common.ApiErrorMsg(c, "分销 scope 未初始化")
		return
	}

	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	summary, err := service.BuildAffiliateDashboardSummary(model.DB, model.LOG_DB, service.AffiliateDashboardSummaryInput{
		Scope:           scope,
		StartTimestamp:  startTimestamp,
		EndTimestamp:    endTimestamp,
		QuotaPerUnit:    common.QuotaPerUnit,
		USDExchangeRate: operation_setting.USDExchangeRate,
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, summary)
}

func getAffiliateScopeFromContext(c *gin.Context) (service.AffiliateScope, bool) {
	value, ok := c.Get("affiliate_scope")
	if !ok {
		return service.AffiliateScope{}, false
	}
	scope, ok := value.(service.AffiliateScope)
	return scope, ok
}

func getActiveAffiliateProfile(userId int) (*model.AffiliateProfile, error) {
	if model.DB == nil {
		return nil, nil
	}

	var profile model.AffiliateProfile
	err := model.DB.
		Where("user_id = ? AND status = ?", userId, model.AffiliateProfileStatusActive).
		First(&profile).Error
	if err == nil {
		return &profile, nil
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return nil, err
}

func buildAffiliateStatusResponse(enabled bool, dbReady bool, role int, scope service.AffiliateScope) gin.H {
	available := scope.Kind == service.AffiliateScopeGlobal || scope.Kind == service.AffiliateScopeAffiliate
	reason := ""
	message := ""

	if !available && role < common.RoleAdminUser {
		switch {
		case !enabled:
			reason = "module_disabled"
			message = "分销模块未启用"
		case !dbReady:
			reason = "data_uninitialized"
			message = "分销数据未初始化"
		default:
			reason = "not_opened"
			message = "分销功能未开通，请联系管理员开通。"
		}
	}

	return gin.H{
		"enabled":            enabled,
		"available":          available,
		"unavailable_reason": reason,
		"message":            message,
		"scope":              scope,
	}
}

type affiliateProfileSetRequest struct {
	UserId       int    `json:"user_id"`
	Level        int    `json:"level"`
	ParentUserId int    `json:"parent_user_id"`
	InviteCode   string `json:"invite_code"`
	Reason       string `json:"reason"`
}

func AdminListAffiliateProfiles(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	userId, _ := strconv.Atoi(c.Query("user_id"))
	level, _ := strconv.Atoi(c.Query("level"))

	profiles, total, err := service.ListAffiliateProfiles(model.DB, service.AffiliateProfileListInput{
		UserId:   userId,
		Level:    level,
		Status:   c.Query("status"),
		StartIdx: pageInfo.GetStartIdx(),
		PageSize: pageInfo.GetPageSize(),
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}

	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(profiles)
	common.ApiSuccess(c, pageInfo)
}

func AdminSetAffiliateProfile(c *gin.Context) {
	var req affiliateProfileSetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	profile, err := service.SetAffiliateProfile(model.DB, service.AffiliateProfileSetInput{
		UserId:       req.UserId,
		Level:        req.Level,
		ParentUserId: req.ParentUserId,
		InviteCode:   req.InviteCode,
		ActorUserId:  c.GetInt("id"),
		Reason:       req.Reason,
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, profile)
}

type affiliateProfileStatusRequest struct {
	Status string `json:"status"`
	Reason string `json:"reason"`
}

func AdminUpdateAffiliateProfileStatus(c *gin.Context) {
	userId, err := strconv.Atoi(c.Param("user_id"))
	if err != nil || userId <= 0 {
		common.ApiErrorMsg(c, "无效的用户ID")
		return
	}

	var req affiliateProfileStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}

	input := service.AffiliateProfileStatusInput{
		UserId:      userId,
		ActorUserId: c.GetInt("id"),
		Reason:      req.Reason,
	}
	switch strings.ToLower(strings.TrimSpace(req.Status)) {
	case model.AffiliateProfileStatusActive:
		profile, err := service.EnableAffiliateProfile(model.DB, input)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		common.ApiSuccess(c, profile)
	case model.AffiliateProfileStatusDisabled:
		if err := service.DisableAffiliateProfile(model.DB, input); err != nil {
			common.ApiError(c, err)
			return
		}
		common.ApiSuccess(c, nil)
	default:
		common.ApiErrorMsg(c, "无效的分销状态")
	}
}
