package controller

import (
	"encoding/csv"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

type subscriptionPlanUsageItem struct {
	UserId             int    `json:"user_id"`
	Username           string `json:"username"`
	DisplayName        string `json:"display_name"`
	UserGroup          string `json:"user_group"`
	OrgName            string `json:"org_name"`
	UserSubscriptionId *int   `json:"user_subscription_id,omitempty"`
	PlanId             *int   `json:"plan_id,omitempty"`
	PlanTitle          string `json:"plan_title"`
	AmountTotal        int64  `json:"amount_total"`
	MonthUsed          int64  `json:"month_used"`
	StartTime          int64  `json:"start_time"`
	EndTime            int64  `json:"end_time"`
	Status             string `json:"status"`
}

type subscriptionPlanUsageFilters struct {
	Groups []subscriptionUsageFilterOption `json:"groups"`
	Plans  []subscriptionUsageFilterOption `json:"plans"`
}

type subscriptionUsageFilterOption struct {
	Value string `json:"value"`
	Label string `json:"label"`
}

func parseMonthRange(month string) (int64, int64) {
	m := strings.TrimSpace(month)
	if m == "" {
		now := time.Now()
		start := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.Local)
		return start.Unix(), start.AddDate(0, 1, 0).Unix()
	}
	t, err := time.ParseInLocation("2006-01", m, time.Local)
	if err != nil {
		now := time.Now()
		start := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.Local)
		return start.Unix(), start.AddDate(0, 1, 0).Unix()
	}
	start := time.Date(t.Year(), t.Month(), 1, 0, 0, 0, 0, time.Local)
	return start.Unix(), start.AddDate(0, 1, 0).Unix()
}

func AdminGetSubscriptionPlanUsage(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	planID, _ := strconv.Atoi(c.Query("plan_id"))
	groupName := strings.TrimSpace(c.Query("group"))
	username := strings.TrimSpace(c.Query("username"))
	orgName := strings.TrimSpace(c.Query("org_name"))
	noPlanOnly := strings.TrimSpace(c.Query("no_plan_only")) == "true"
	includeNoPlan := strings.TrimSpace(c.Query("include_no_plan")) == "true"

	monthStart, monthEnd := parseMonthRange(c.Query("month"))
	monthUsageSubQuery := model.DB.Table("subscription_pre_consume_records spr").
		Select("spr.user_subscription_id as sub_id, COALESCE(SUM(spr.pre_consumed),0) as month_used").
		Where("spr.status = ? AND spr.updated_at >= ? AND spr.updated_at < ?", "consumed", monthStart, monthEnd).
		Group("spr.user_subscription_id")

	selectGroup := fmt.Sprintf("%s as user_group", model.CommonGroupColumnName())
	base := model.DB.Table("users").
		Select("users.id as user_id, users.username, users.display_name, users.org_name, "+selectGroup+", us.id as user_subscription_id, us.plan_id, sp.title as plan_title, COALESCE(us.amount_total, 0) as amount_total, COALESCE(mu.month_used, 0) as month_used, COALESCE(us.start_time, 0) as start_time, COALESCE(us.end_time, 0) as end_time, COALESCE(us.status, '') as status").
		Joins("LEFT JOIN user_subscriptions us ON us.user_id = users.id AND us.source = ? AND us.status = ?", "bind_group", "active").
		Joins("LEFT JOIN subscription_plans sp ON sp.id = us.plan_id").
		Joins("LEFT JOIN (?) mu ON mu.sub_id = us.id", monthUsageSubQuery)

	if planID > 0 {
		base = base.Where("us.plan_id = ?", planID)
	}
	if groupName != "" {
		base = base.Where(fmt.Sprintf("%s = ?", model.CommonGroupColumnName()), groupName)
	}
	if username != "" {
		base = base.Where("users.username = ?", username)
	}
	if orgName != "" {
		base = base.Where("users.org_name = ?", orgName)
	}
	if noPlanOnly {
		base = base.Where("us.id IS NULL")
	} else if !includeNoPlan {
		base = base.Where("us.id IS NOT NULL")
	}

	var total int64
	if err := model.DB.Table("(?) as t", base).Count(&total).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	var items []subscriptionPlanUsageItem
	if err := base.Order("users.id asc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Scan(&items).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

type orgUsageItem struct {
	OrgName     string `json:"org_name"`
	TotalUsers  int64  `json:"total_users"`
	ActiveUsers int64  `json:"active_users"`
	TokenUsed   int64  `json:"token_used"`
	Quota       int64  `json:"quota"`
}

func AdminGetOrgUsage(c *gin.Context) {
	days, _ := strconv.Atoi(c.DefaultQuery("days", "30"))
	if days <= 0 {
		days = 30
	}
	start := common.GetTimestamp() - int64(days*24*3600)
	var items []orgUsageItem
	tx := model.DB.Table("users").
		Select("COALESCE(users.org_name, '') as org_name, COUNT(DISTINCT users.id) as total_users, COUNT(DISTINCT CASE WHEN q.user_id IS NOT NULL THEN users.id END) as active_users, COALESCE(SUM(q.token_used),0) as token_used, COALESCE(SUM(q.quota),0) as quota").
		Joins("LEFT JOIN quota_data q ON q.user_id = users.id AND q.created_at >= ?", start).
		Group("users.org_name").
		Order("quota desc, token_used desc")
	if err := tx.Scan(&items).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, items)
}

type inactiveUserItem struct {
	UserId      int    `json:"user_id"`
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
	UserGroup   string `json:"user_group"`
	OrgName     string `json:"org_name"`
	LastLoginAt int64  `json:"last_login_at"`
}

func AdminGetInactiveUsers(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	days, _ := strconv.Atoi(c.DefaultQuery("days", "15"))
	if days <= 0 {
		days = 15
	}
	start := common.GetTimestamp() - int64(days*24*3600)
	selectGroup := fmt.Sprintf("%s as user_group", model.CommonGroupColumnName())
	base := model.DB.Table("users").
		Select("users.id as user_id, users.username, users.display_name, "+selectGroup+", users.org_name, COALESCE(MAX(q_all.created_at),0) as last_login_at").
		Joins("LEFT JOIN quota_data q_recent ON q_recent.user_id = users.id AND q_recent.created_at >= ?", start).
		Joins("LEFT JOIN quota_data q_all ON q_all.user_id = users.id").
		Group("users.id, users.username, users.display_name, users.org_name, " + model.CommonGroupColumnName()).
		Having("COUNT(q_recent.id) = 0")

	var total int64
	if err := model.DB.Table("(?) as t", base).Count(&total).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	var items []inactiveUserItem
	if err := base.Order("users.id asc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Scan(&items).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

func sanitizeCSVField(value string) string {
	if value == "" {
		return value
	}
	first := value[0]
	if first == '=' || first == '+' || first == '-' || first == '@' {
		return "'" + value
	}
	return value
}

func AdminExportInactiveUsers(c *gin.Context) {
	days, _ := strconv.Atoi(c.DefaultQuery("days", "15"))
	if days <= 0 {
		days = 15
	}
	start := common.GetTimestamp() - int64(days*24*3600)
	selectGroup := fmt.Sprintf("%s as user_group", model.CommonGroupColumnName())
	base := model.DB.Table("users").
		Select("users.id as user_id, users.username, users.display_name, "+selectGroup+", users.org_name, COALESCE(MAX(q_all.created_at),0) as last_login_at").
		Joins("LEFT JOIN quota_data q_recent ON q_recent.user_id = users.id AND q_recent.created_at >= ?", start).
		Joins("LEFT JOIN quota_data q_all ON q_all.user_id = users.id").
		Group("users.id, users.username, users.display_name, users.org_name, " + model.CommonGroupColumnName()).
		Having("COUNT(q_recent.id) = 0")

	var items []inactiveUserItem
	if err := base.Order("users.id asc").Scan(&items).Error; err != nil {
		common.ApiError(c, err)
		return
	}

	filename := fmt.Sprintf("inactive-users-%ddays-%s.csv", days, time.Now().Format("2006-01-02"))
	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
	writer := csv.NewWriter(c.Writer)
	defer writer.Flush()

	writer.Write([]string{"用户ID", "用户名", "显示名", "用户分组", "组织", "最近Token使用"})
	for _, it := range items {
		last := ""
		if it.LastLoginAt > 0 {
			last = time.Unix(it.LastLoginAt, 0).Format("2006-01-02 15:04:05")
		}
		writer.Write([]string{strconv.Itoa(it.UserId), sanitizeCSVField(it.Username), sanitizeCSVField(it.DisplayName), sanitizeCSVField(it.UserGroup), sanitizeCSVField(it.OrgName), last})
	}
}
