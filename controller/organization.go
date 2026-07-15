package controller

import (
	"bytes"
	"encoding/csv"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type organizationMutationRequest struct {
	Name   string `json:"name"`
	Status *int   `json:"status"`
}

type organizationCreateRequest struct {
	Name string `json:"name"`
}

type organizationMemberRequest struct {
	UserId int    `json:"user_id"`
	Role   string `json:"role"`
}

func organizationBillingFiltersFromQuery(c *gin.Context) model.OrganizationBillingFilters {
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	logType, _ := strconv.Atoi(c.Query("type"))
	channelId, _ := strconv.Atoi(c.Query("channel"))
	userId, _ := strconv.Atoi(c.Query("user_id"))

	types := []int{model.LogTypeConsume}
	if logType != model.LogTypeUnknown {
		types = []int{logType}
	} else if strings.EqualFold(c.Query("view"), "reconciliation") {
		types = []int{model.LogTypeConsume, model.LogTypeRefund, model.LogTypeSystem}
	} else {
		if c.Query("include_refund") == "true" {
			types = append(types, model.LogTypeRefund)
		}
		if c.Query("include_adjustment") == "true" {
			types = append(types, model.LogTypeSystem)
		}
	}

	return model.OrganizationBillingFilters{
		StartTimestamp: startTimestamp,
		EndTimestamp:   endTimestamp,
		Types:          types,
		UserId:         userId,
		ModelName:      c.Query("model_name"),
		ChannelId:      channelId,
	}
}

func requireCurrentOrganization(c *gin.Context) (*model.OrganizationWithMember, bool) {
	current, err := model.GetCurrentOrganizationForUser(c.GetInt("id"))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.ApiErrorMsg(c, "user does not belong to an organization")
			return nil, false
		}
		common.ApiError(c, err)
		return nil, false
	}
	return current, true
}

func requireOrganizationManager(c *gin.Context, organizationId int) bool {
	ok, err := model.UserCanManageOrganization(c.GetInt("id"), organizationId)
	if err != nil {
		common.ApiError(c, err)
		return false
	}
	if !ok {
		common.ApiErrorMsg(c, "no organization management permission")
		return false
	}
	return true
}

func scopedCurrentOrganizationBillingFilters(c *gin.Context) (int, model.OrganizationBillingFilters, bool) {
	current, ok := requireCurrentOrganization(c)
	if !ok {
		return 0, model.OrganizationBillingFilters{}, false
	}
	filters := organizationBillingFiltersFromQuery(c)
	canViewAll, err := model.UserCanViewOrganizationBilling(c.GetInt("id"), current.Organization.Id)
	if err != nil {
		common.ApiError(c, err)
		return 0, model.OrganizationBillingFilters{}, false
	}
	if !canViewAll {
		filters.UserId = c.GetInt("id")
	}
	return current.Organization.Id, filters, true
}

func GetOrganizationSelf(c *gin.Context) {
	current, err := model.GetCurrentOrganizationForUser(c.GetInt("id"))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.ApiSuccess(c, nil)
			return
		}
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, current)
}

func GetCurrentOrganization(c *gin.Context) {
	GetOrganizationSelf(c)
}

func UpdateCurrentOrganization(c *gin.Context) {
	current, ok := requireCurrentOrganization(c)
	if !ok {
		return
	}
	if !requireOrganizationManager(c, current.Organization.Id) {
		return
	}
	var req organizationMutationRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiError(c, err)
		return
	}
	org, err := model.UpdateOrganization(current.Organization.Id, req.Name, req.Status)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, org)
}

func GetCurrentOrganizationMembers(c *gin.Context) {
	current, ok := requireCurrentOrganization(c)
	if !ok {
		return
	}
	canViewAll, err := model.UserCanViewOrganizationBilling(c.GetInt("id"), current.Organization.Id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if !canViewAll {
		common.ApiSuccess(c, []model.OrganizationMember{current.Member})
		return
	}
	includeHistory := c.Query("include_history") == "true"
	members, err := model.ListOrganizationMembers(current.Organization.Id, includeHistory)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, members)
}

func AddCurrentOrganizationMember(c *gin.Context) {
	current, ok := requireCurrentOrganization(c)
	if !ok {
		return
	}
	if !requireOrganizationManager(c, current.Organization.Id) {
		return
	}
	var req organizationMemberRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiError(c, err)
		return
	}
	member, err := model.AddOrganizationMember(current.Organization.Id, req.UserId, req.Role)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, member)
}

func UpdateCurrentOrganizationMember(c *gin.Context) {
	current, ok := requireCurrentOrganization(c)
	if !ok {
		return
	}
	if !requireOrganizationManager(c, current.Organization.Id) {
		return
	}
	userId, err := strconv.Atoi(c.Param("user_id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var req organizationMemberRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiError(c, err)
		return
	}
	member, err := model.UpdateOrganizationMemberRole(current.Organization.Id, userId, req.Role)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, member)
}

func DeleteCurrentOrganizationMember(c *gin.Context) {
	current, ok := requireCurrentOrganization(c)
	if !ok {
		return
	}
	if !requireOrganizationManager(c, current.Organization.Id) {
		return
	}
	userId, err := strconv.Atoi(c.Param("user_id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.RemoveOrganizationMember(current.Organization.Id, userId); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func GetCurrentOrganizationBillingSummary(c *gin.Context) {
	organizationId, filters, ok := scopedCurrentOrganizationBillingFilters(c)
	if !ok {
		return
	}
	summary, err := model.GetOrganizationBillingSummary(organizationId, filters)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, summary)
}

func GetCurrentOrganizationBillingMembers(c *gin.Context) {
	organizationId, filters, ok := scopedCurrentOrganizationBillingFilters(c)
	if !ok {
		return
	}
	items, err := model.GetOrganizationBillingMembers(organizationId, filters)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, items)
}

func GetCurrentOrganizationBillingModels(c *gin.Context) {
	organizationId, filters, ok := scopedCurrentOrganizationBillingFilters(c)
	if !ok {
		return
	}
	items, err := model.GetOrganizationBillingModels(organizationId, filters)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, items)
}

func GetCurrentOrganizationBillingChannels(c *gin.Context) {
	organizationId, filters, ok := scopedCurrentOrganizationBillingFilters(c)
	if !ok {
		return
	}
	items, err := model.GetOrganizationBillingChannels(organizationId, filters)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, items)
}

func GetCurrentOrganizationBillingTrend(c *gin.Context) {
	organizationId, filters, ok := scopedCurrentOrganizationBillingFilters(c)
	if !ok {
		return
	}
	items, err := model.GetOrganizationBillingTrend(organizationId, filters)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, items)
}

func GetCurrentOrganizationBillingLogs(c *gin.Context) {
	organizationId, filters, ok := scopedCurrentOrganizationBillingFilters(c)
	if !ok {
		return
	}
	pageInfo := common.GetPageQuery(c)
	logs, total, err := model.GetOrganizationBillingLogs(organizationId, filters, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(logs)
	common.ApiSuccess(c, pageInfo)
}

func ExportCurrentOrganizationBillingLogs(c *gin.Context) {
	organizationId, filters, ok := scopedCurrentOrganizationBillingFilters(c)
	if !ok {
		return
	}
	exportOrganizationBillingLogs(c, organizationId, filters)
}

func ExportCurrentOrganizationBilling(c *gin.Context) {
	organizationId, filters, ok := scopedCurrentOrganizationBillingFilters(c)
	if !ok {
		return
	}
	exportOrganizationBilling(c, organizationId, filters)
}

func AdminListOrganizations(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	var status *int
	if statusStr := strings.TrimSpace(c.Query("status")); statusStr != "" {
		parsed, err := strconv.Atoi(statusStr)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		status = &parsed
	}
	orgs, total, err := model.ListOrganizations(c.Query("keyword"), status, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(orgs)
	common.ApiSuccess(c, pageInfo)
}

func AdminGetOrganization(c *gin.Context) {
	organizationId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	org, err := model.GetOrganizationById(organizationId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, org)
}

func AdminCreateOrganization(c *gin.Context) {
	var req organizationCreateRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiError(c, err)
		return
	}
	org, err := model.CreateOrganization(req.Name)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, org)
}

func AdminUpdateOrganization(c *gin.Context) {
	organizationId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var req organizationMutationRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiError(c, err)
		return
	}
	org, err := model.UpdateOrganization(organizationId, req.Name, req.Status)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, org)
}

func AdminListOrganizationMembers(c *gin.Context) {
	organizationId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	includeHistory := c.Query("include_history") == "true"
	members, err := model.ListOrganizationMembers(organizationId, includeHistory)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, members)
}

func AdminAddOrganizationMember(c *gin.Context) {
	organizationId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var req organizationMemberRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiError(c, err)
		return
	}
	member, err := model.AddOrganizationMember(organizationId, req.UserId, req.Role)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, member)
}

func AdminUpdateOrganizationMember(c *gin.Context) {
	organizationId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	userId, err := strconv.Atoi(c.Param("user_id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var req organizationMemberRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiError(c, err)
		return
	}
	member, err := model.UpdateOrganizationMemberRole(organizationId, userId, req.Role)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, member)
}

func AdminDeleteOrganizationMember(c *gin.Context) {
	organizationId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	userId, err := strconv.Atoi(c.Param("user_id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.RemoveOrganizationMember(organizationId, userId); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func adminOrganizationBillingScope(c *gin.Context) (int, model.OrganizationBillingFilters, bool) {
	organizationId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return 0, model.OrganizationBillingFilters{}, false
	}
	return organizationId, organizationBillingFiltersFromQuery(c), true
}

func AdminGetOrganizationBillingSummary(c *gin.Context) {
	organizationId, filters, ok := adminOrganizationBillingScope(c)
	if !ok {
		return
	}
	summary, err := model.GetOrganizationBillingSummary(organizationId, filters)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, summary)
}

func AdminGetOrganizationBillingMembers(c *gin.Context) {
	organizationId, filters, ok := adminOrganizationBillingScope(c)
	if !ok {
		return
	}
	items, err := model.GetOrganizationBillingMembers(organizationId, filters)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, items)
}

func AdminGetOrganizationBillingModels(c *gin.Context) {
	organizationId, filters, ok := adminOrganizationBillingScope(c)
	if !ok {
		return
	}
	items, err := model.GetOrganizationBillingModels(organizationId, filters)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, items)
}

func AdminGetOrganizationBillingChannels(c *gin.Context) {
	organizationId, filters, ok := adminOrganizationBillingScope(c)
	if !ok {
		return
	}
	items, err := model.GetOrganizationBillingChannels(organizationId, filters)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, items)
}

func AdminGetOrganizationBillingTrend(c *gin.Context) {
	organizationId, filters, ok := adminOrganizationBillingScope(c)
	if !ok {
		return
	}
	items, err := model.GetOrganizationBillingTrend(organizationId, filters)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, items)
}

func AdminGetOrganizationBillingLogs(c *gin.Context) {
	organizationId, filters, ok := adminOrganizationBillingScope(c)
	if !ok {
		return
	}
	pageInfo := common.GetPageQuery(c)
	logs, total, err := model.GetOrganizationBillingLogs(organizationId, filters, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(logs)
	common.ApiSuccess(c, pageInfo)
}

func AdminExportOrganizationBillingLogs(c *gin.Context) {
	organizationId, filters, ok := adminOrganizationBillingScope(c)
	if !ok {
		return
	}
	exportOrganizationBillingLogs(c, organizationId, filters)
}

func AdminExportOrganizationBilling(c *gin.Context) {
	organizationId, filters, ok := adminOrganizationBillingScope(c)
	if !ok {
		return
	}
	exportOrganizationBilling(c, organizationId, filters)
}

type organizationBillingExportData struct {
	Summary  *model.OrganizationBillingSummary
	Members  []model.OrganizationBillingDimension
	Models   []model.OrganizationBillingDimension
	Channels []model.OrganizationBillingDimension
	Trend    []model.OrganizationBillingTrendPoint
	Logs     []*model.Log
}

type organizationBillingExportAmountFormatter struct {
	currency string
	rate     float64
}

func newOrganizationBillingExportAmountFormatter() organizationBillingExportAmountFormatter {
	formatter := organizationBillingExportAmountFormatter{currency: "USD", rate: 1}
	switch operation_setting.GetQuotaDisplayType() {
	case operation_setting.QuotaDisplayTypeCNY:
		formatter.currency = "CNY"
		formatter.rate = operation_setting.USDExchangeRate
	case operation_setting.QuotaDisplayTypeCustom:
		symbol := strings.TrimSpace(operation_setting.GetGeneralSetting().CustomCurrencySymbol)
		if symbol == "" {
			symbol = "¤"
		}
		formatter.currency = fmt.Sprintf("CUSTOM(%s)", symbol)
		formatter.rate = operation_setting.GetGeneralSetting().CustomCurrencyExchangeRate
	case operation_setting.QuotaDisplayTypeTokens:
		// Billing reports always expose a monetary amount. Token-only display still
		// exports the USD equivalent alongside the raw quota value.
		formatter.currency = "USD"
	}
	if formatter.rate <= 0 {
		formatter.rate = 1
	}
	return formatter
}

func (f organizationBillingExportAmountFormatter) amount(quota int) string {
	amount := float64(quota) / common.QuotaPerUnit * f.rate
	return strconv.FormatFloat(amount, 'f', 6, 64)
}

func organizationModelPricingLabel(pricing *model.PricingSnapshot) string {
	if pricing == nil {
		return ""
	}
	if pricing.BillingMode == "tiered_expr" && strings.TrimSpace(pricing.BillingExpr) != "" {
		return "阶梯计费"
	}
	if pricing.QuotaType == 1 {
		return fmt.Sprintf("固定价格 USD %s", strconv.FormatFloat(pricing.ModelPrice, 'f', -1, 64))
	}
	return fmt.Sprintf("模型倍率 %s", strconv.FormatFloat(pricing.ModelRatio, 'f', -1, 64))
}

// fetchOrganizationBillingExport 汇总组织账单的全部六张表，供 CSV 多段导出复用。
func fetchOrganizationBillingExport(organizationId int, filters model.OrganizationBillingFilters) (organizationBillingExportData, error) {
	const maxExportRows = 10000
	summary, err := model.GetOrganizationBillingSummary(organizationId, filters)
	if err != nil {
		return organizationBillingExportData{}, err
	}
	members, err := model.GetOrganizationBillingMembers(organizationId, filters)
	if err != nil {
		return organizationBillingExportData{}, err
	}
	models, err := model.GetOrganizationBillingModels(organizationId, filters)
	if err != nil {
		return organizationBillingExportData{}, err
	}
	channels, err := model.GetOrganizationBillingChannels(organizationId, filters)
	if err != nil {
		return organizationBillingExportData{}, err
	}
	trend, err := model.GetOrganizationBillingTrend(organizationId, filters)
	if err != nil {
		return organizationBillingExportData{}, err
	}
	logs, _, err := model.GetOrganizationBillingLogs(organizationId, filters, 0, maxExportRows)
	if err != nil {
		return organizationBillingExportData{}, err
	}
	return organizationBillingExportData{
		Summary:  summary,
		Members:  members,
		Models:   models,
		Channels: channels,
		Trend:    trend,
		Logs:     logs,
	}, nil
}

// writeOrganizationBillingCsv 把六张账单表以「# 段名」为标题分段写入同一个 CSV：
// 表头用中文；实体标识用名称替代数字 ID；金额保持可计算的数值与独立币种列；
// 日志类型用中文名，时间为可读格式，明细仍沿用管理员级排障字段。
func writeOrganizationBillingCsv(writer *csv.Writer, data organizationBillingExportData) {
	amountFormatter := newOrganizationBillingExportAmountFormatter()
	_ = writer.Write([]string{"# 账单汇总"})
	_ = writer.Write([]string{"指标", "数值"})
	if data.Summary != nil {
		_ = writer.Write([]string{"消费金额", amountFormatter.amount(data.Summary.TotalQuota)})
		_ = writer.Write([]string{"币种", amountFormatter.currency})
		_ = writer.Write([]string{"消费额度(quota)", strconv.Itoa(data.Summary.TotalQuota)})
		_ = writer.Write([]string{"请求数", strconv.Itoa(data.Summary.RequestCount)})
		_ = writer.Write([]string{"输入Token", strconv.Itoa(data.Summary.PromptTokens)})
		_ = writer.Write([]string{"输出Token", strconv.Itoa(data.Summary.CompletionTokens)})
		_ = writer.Write([]string{"历史成员数", strconv.Itoa(data.Summary.MemberCount)})
		_ = writer.Write([]string{"活跃成员数", strconv.Itoa(data.Summary.ActiveMemberCount)})
	}
	_ = writer.Write([]string{""})

	_ = writer.Write([]string{"# 成员用量"})
	_ = writer.Write([]string{"用户名", "显示名", "消费金额", "币种", "消费额度(quota)", "请求数", "输入Token", "输出Token"})
	for _, item := range data.Members {
		_ = writer.Write([]string{
			item.Username,
			item.DisplayName,
			amountFormatter.amount(item.TotalQuota),
			amountFormatter.currency,
			strconv.Itoa(item.TotalQuota),
			strconv.Itoa(item.RequestCount),
			strconv.Itoa(item.PromptTokens),
			strconv.Itoa(item.CompletionTokens),
		})
	}
	_ = writer.Write([]string{""})

	_ = writer.Write([]string{"# 模型用量"})
	_ = writer.Write([]string{"模型", "消费金额", "币种", "当前计价规则", "消费额度(quota)", "请求数", "输入Token", "输出Token", "模型倍率", "固定价格(USD)", "计费模式", "计费表达式"})
	for _, item := range data.Models {
		modelRatio, modelPrice, billingMode, billingExpr := "", "", "", ""
		if item.Pricing != nil {
			modelRatio = strconv.FormatFloat(item.Pricing.ModelRatio, 'f', -1, 64)
			modelPrice = strconv.FormatFloat(item.Pricing.ModelPrice, 'f', -1, 64)
			billingMode = item.Pricing.BillingMode
			billingExpr = item.Pricing.BillingExpr
		}
		_ = writer.Write([]string{
			item.ModelName,
			amountFormatter.amount(item.TotalQuota),
			amountFormatter.currency,
			organizationModelPricingLabel(item.Pricing),
			strconv.Itoa(item.TotalQuota),
			strconv.Itoa(item.RequestCount),
			strconv.Itoa(item.PromptTokens),
			strconv.Itoa(item.CompletionTokens),
			modelRatio,
			modelPrice,
			billingMode,
			billingExpr,
		})
	}
	_ = writer.Write([]string{""})

	_ = writer.Write([]string{"# 渠道用量"})
	_ = writer.Write([]string{"渠道", "消费金额", "币种", "消费额度(quota)", "请求数", "输入Token", "输出Token"})
	for _, item := range data.Channels {
		_ = writer.Write([]string{
			item.ChannelName,
			amountFormatter.amount(item.TotalQuota),
			amountFormatter.currency,
			strconv.Itoa(item.TotalQuota),
			strconv.Itoa(item.RequestCount),
			strconv.Itoa(item.PromptTokens),
			strconv.Itoa(item.CompletionTokens),
		})
	}
	_ = writer.Write([]string{""})

	_ = writer.Write([]string{"# 用量趋势"})
	_ = writer.Write([]string{"日期", "消费金额", "币种", "消费额度(quota)", "请求数", "输入Token", "输出Token"})
	for _, point := range data.Trend {
		_ = writer.Write([]string{
			point.Period,
			amountFormatter.amount(point.TotalQuota),
			amountFormatter.currency,
			strconv.Itoa(point.TotalQuota),
			strconv.Itoa(point.RequestCount),
			strconv.Itoa(point.PromptTokens),
			strconv.Itoa(point.CompletionTokens),
		})
	}
	_ = writer.Write([]string{""})

	_ = writer.Write([]string{"# 消费明细"})
	_ = writer.Write([]string{"时间", "类型", "用户", "令牌", "模型", "渠道", "消费金额", "币种", "消费额度(quota)", "输入Token", "输出Token", "请求ID", "上游请求ID", "内容"})
	for _, item := range data.Logs {
		_ = writer.Write([]string{
			time.Unix(item.CreatedAt, 0).Format("2006-01-02 15:04:05"),
			billingLogTypeLabel(item.Type),
			item.Username,
			item.TokenName,
			item.ModelName,
			item.ChannelName,
			amountFormatter.amount(item.Quota),
			amountFormatter.currency,
			strconv.Itoa(item.Quota),
			strconv.Itoa(item.PromptTokens),
			strconv.Itoa(item.CompletionTokens),
			item.RequestId,
			item.UpstreamRequestId,
			item.Content,
		})
	}
}

// billingLogTypeLabel 把日志类型数字映射为中文名，便于导出阅读。
func billingLogTypeLabel(logType int) string {
	switch logType {
	case model.LogTypeTopup:
		return "充值"
	case model.LogTypeConsume:
		return "消费"
	case model.LogTypeManage:
		return "管理"
	case model.LogTypeSystem:
		return "系统"
	case model.LogTypeError:
		return "错误"
	case model.LogTypeRefund:
		return "退款"
	case model.LogTypeLogin:
		return "登录"
	default:
		return strconv.Itoa(logType)
	}
}

func writeOrganizationBillingLogsCsv(writer *csv.Writer, logs []*model.Log) {
	_ = writer.Write([]string{
		"id",
		"created_at",
		"type",
		"user_id",
		"username",
		"token_name",
		"model_name",
		"quota",
		"prompt_tokens",
		"completion_tokens",
		"channel_id",
		"channel_name",
		"request_id",
		"upstream_request_id",
		"content",
	})
	for _, item := range logs {
		_ = writer.Write([]string{
			strconv.Itoa(item.Id),
			strconv.FormatInt(item.CreatedAt, 10),
			strconv.Itoa(item.Type),
			strconv.Itoa(item.UserId),
			item.Username,
			item.TokenName,
			item.ModelName,
			strconv.Itoa(item.Quota),
			strconv.Itoa(item.PromptTokens),
			strconv.Itoa(item.CompletionTokens),
			strconv.Itoa(item.ChannelId),
			item.ChannelName,
			item.RequestId,
			item.UpstreamRequestId,
			item.Content,
		})
	}
}

// exportOrganizationBillingLogs 保留既有 logs/export 的单表 CSV 合同，避免破坏上游消费者。
func exportOrganizationBillingLogs(c *gin.Context, organizationId int, filters model.OrganizationBillingFilters) {
	const maxExportRows = 10000
	logs, _, err := model.GetOrganizationBillingLogs(organizationId, filters, 0, maxExportRows)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var buf bytes.Buffer
	buf.WriteString("\xEF\xBB\xBF")
	writer := csv.NewWriter(&buf)
	writeOrganizationBillingLogsCsv(writer, logs)
	writer.Flush()
	if err := writer.Error(); err != nil {
		common.ApiError(c, err)
		return
	}
	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"organization-%d-billing-logs.csv\"", organizationId))
	c.Data(200, "text/csv; charset=utf-8", buf.Bytes())
}

// exportOrganizationBilling 导出包含全部账单表的多段 CSV，复用账单筛选与角色范围。
func exportOrganizationBilling(c *gin.Context, organizationId int, filters model.OrganizationBillingFilters) {
	data, err := fetchOrganizationBillingExport(organizationId, filters)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var buf bytes.Buffer
	buf.WriteString("\xEF\xBB\xBF")
	writer := csv.NewWriter(&buf)
	writeOrganizationBillingCsv(writer, data)
	writer.Flush()
	if err := writer.Error(); err != nil {
		common.ApiError(c, err)
		return
	}
	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"organization-%d-billing.csv\"", organizationId))
	c.Data(200, "text/csv; charset=utf-8", buf.Bytes())
}
