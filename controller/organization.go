package controller

import (
	"bytes"
	"encoding/csv"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

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
	member, err := model.AddOrganizationMember(current.Organization.Id, req.UserId, req.Role, false)
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
	member, err := model.UpdateOrganizationMemberRole(current.Organization.Id, userId, req.Role, false)
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
	if userId == c.GetInt("id") {
		common.ApiErrorMsg(c, "current user cannot be removed from organization")
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
	member, err := model.AddOrganizationMember(organizationId, req.UserId, req.Role, true)
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
	member, err := model.UpdateOrganizationMemberRole(organizationId, userId, req.Role, true)
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
	if userId == c.GetInt("id") {
		common.ApiErrorMsg(c, "current user cannot be removed from organization")
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
	writer.Flush()
	if err := writer.Error(); err != nil {
		common.ApiError(c, err)
		return
	}
	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"organization-%d-billing-logs.csv\"", organizationId))
	c.Data(200, "text/csv; charset=utf-8", buf.Bytes())
}
