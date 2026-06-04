package controller

import (
	"encoding/csv"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const affiliateLogsExportLimit = 10000
const affiliateLogsExportPageSize = 100

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
	input := buildAffiliateScopedLogsInput(c, scope, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	logs, total, err := service.ListAffiliateScopedLogs(model.DB, model.LOG_DB, input)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(logs)
	common.ApiSuccess(c, pageInfo)
}

func GetAffiliateTeamTree(c *gin.Context) {
	scope, ok := getAffiliateScopeFromContext(c)
	if !ok {
		common.ApiErrorMsg(c, "分销 scope 未初始化")
		return
	}

	tree, err := service.BuildAffiliateTeamTree(model.DB, scope)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, tree)
}

func ExportAffiliateScopedLogs(c *gin.Context) {
	scope, ok := getAffiliateScopeFromContext(c)
	if !ok {
		common.ApiErrorMsg(c, "分销 scope 未初始化")
		return
	}

	var allLogs []*model.Log
	for startIdx := 0; startIdx < affiliateLogsExportLimit; startIdx += affiliateLogsExportPageSize {
		logs, _, err := service.ListAffiliateScopedLogs(
			model.DB,
			model.LOG_DB,
			buildAffiliateScopedLogsInput(c, scope, startIdx, affiliateLogsExportPageSize),
		)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		allLogs = append(allLogs, logs...)
		if len(logs) < affiliateLogsExportPageSize {
			break
		}
	}

	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", `attachment; filename="affiliate-logs.csv"`)
	c.String(200, buildAffiliateScopedLogsCsv(allLogs, common.QuotaPerUnit, operation_setting.USDExchangeRate))
}

func buildAffiliateScopedLogsInput(c *gin.Context, scope service.AffiliateScope, startIdx int, pageSize int) service.AffiliateScopedLogsInput {
	logType, _ := strconv.Atoi(c.Query("type"))
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	userId, _ := strconv.Atoi(c.Query("user_id"))
	secondLevelUserId, _ := strconv.Atoi(c.Query("second_level_user_id"))

	return service.AffiliateScopedLogsInput{
		Scope:                  scope,
		LogType:                logType,
		RequestStatus:          c.Query("request_status"),
		StartTimestamp:         startTimestamp,
		EndTimestamp:           endTimestamp,
		ModelName:              c.Query("model_name"),
		Group:                  c.Query("group"),
		TokenName:              c.Query("token_name"),
		UserId:                 userId,
		SecondLevelAffiliateId: secondLevelUserId,
		StartIdx:               startIdx,
		PageSize:               pageSize,
	}
}

func buildAffiliateScopedLogsCsv(logs []*model.Log, quotaPerUnit float64, usdExchangeRate float64) string {
	var builder strings.Builder
	writer := csv.NewWriter(&builder)
	_ = writer.Write([]string{"time", "user_id", "username", "type", "model", "group", "consumption_rmb", "raw_quota"})
	for _, log := range logs {
		_ = writer.Write([]string{
			formatAffiliateCsvTimestamp(log.CreatedAt),
			strconv.Itoa(log.UserId),
			log.Username,
			strconv.Itoa(log.Type),
			log.ModelName,
			log.Group,
			formatAffiliateCsvRMB(log.Quota, quotaPerUnit, usdExchangeRate),
			strconv.Itoa(log.Quota),
		})
	}
	writer.Flush()
	return builder.String()
}

func formatAffiliateCsvTimestamp(timestamp int64) string {
	if timestamp <= 0 {
		return ""
	}
	return time.Unix(timestamp, 0).UTC().Format("2006-01-02 15:04:05")
}

func formatAffiliateCsvRMB(quota int, quotaPerUnit float64, usdExchangeRate float64) string {
	if quotaPerUnit <= 0 {
		quotaPerUnit = 1
	}
	if usdExchangeRate <= 0 {
		usdExchangeRate = 1
	}
	value := float64(quota) / quotaPerUnit * usdExchangeRate
	sign := ""
	if value < 0 {
		sign = "-"
		value = -value
	}
	if quota != 0 && value > 0 && value < 0.000001 {
		value = 0.000001
	}
	text := strconv.FormatFloat(value, 'f', 6, 64)
	text = strings.TrimRight(strings.TrimRight(text, "0"), ".")
	if text == "" {
		text = "0"
	}
	return fmt.Sprintf("%s¥%s", sign, text)
}

func GetAffiliateCommissions(c *gin.Context) {
	scope, ok := getAffiliateScopeFromContext(c)
	if !ok {
		common.ApiErrorMsg(c, "分销 scope 未初始化")
		return
	}

	pageInfo := common.GetPageQuery(c)
	affiliateUserId, _ := strconv.Atoi(c.Query("affiliate_user_id"))
	ruleSetId, _ := strconv.Atoi(c.Query("rule_set_id"))
	downstreamUserId, _ := strconv.Atoi(c.Query("downstream_user_id"))
	settlementId, _ := strconv.Atoi(c.Query("settlement_id"))
	periodStart, _ := strconv.ParseInt(c.Query("period_start"), 10, 64)
	periodEnd, _ := strconv.ParseInt(c.Query("period_end"), 10, 64)

	events, total, err := service.ListAffiliateCommissionEvents(model.DB, service.AffiliateCommissionEventListInput{
		Scope:            scope,
		AffiliateUserId:  affiliateUserId,
		RuleSetId:        ruleSetId,
		DownstreamUserId: downstreamUserId,
		SettlementId:     settlementId,
		Status:           c.Query("status"),
		Kind:             c.Query("kind"),
		PeriodStart:      periodStart,
		PeriodEnd:        periodEnd,
		StartIdx:         pageInfo.GetStartIdx(),
		PageSize:         pageInfo.GetPageSize(),
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}

	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(events)
	common.ApiSuccess(c, pageInfo)
}

func GetAffiliateSettlements(c *gin.Context) {
	scope, ok := getAffiliateScopeFromContext(c)
	if !ok {
		common.ApiErrorMsg(c, "分销 scope 未初始化")
		return
	}

	pageInfo := common.GetPageQuery(c)
	affiliateUserId, _ := strconv.Atoi(c.Query("affiliate_user_id"))
	ruleSetId, _ := strconv.Atoi(c.Query("rule_set_id"))
	periodStart, _ := strconv.ParseInt(c.Query("period_start"), 10, 64)
	periodEnd, _ := strconv.ParseInt(c.Query("period_end"), 10, 64)

	settlements, total, err := service.ListAffiliateSettlements(model.DB, service.AffiliateSettlementListInput{
		Scope:           scope,
		AffiliateUserId: affiliateUserId,
		RuleSetId:       ruleSetId,
		Status:          c.Query("status"),
		PeriodStart:     periodStart,
		PeriodEnd:       periodEnd,
		StartIdx:        pageInfo.GetStartIdx(),
		PageSize:        pageInfo.GetPageSize(),
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}

	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(settlements)
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
	trendStartTimestamp, _ := strconv.ParseInt(c.Query("trend_start_timestamp"), 10, 64)
	trendEndTimestamp, _ := strconv.ParseInt(c.Query("trend_end_timestamp"), 10, 64)
	summary, err := service.BuildAffiliateDashboardSummary(model.DB, model.LOG_DB, service.AffiliateDashboardSummaryInput{
		Scope:               scope,
		StartTimestamp:      startTimestamp,
		EndTimestamp:        endTimestamp,
		TrendStartTimestamp: trendStartTimestamp,
		TrendEndTimestamp:   trendEndTimestamp,
		QuotaPerUnit:        common.QuotaPerUnit,
		USDExchangeRate:     operation_setting.USDExchangeRate,
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
