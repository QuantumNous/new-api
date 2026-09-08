package service

import (
	"errors"
	"fmt"
	"net/url"
	"sort"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"gorm.io/gorm"
)

const agentCustomerLogIDChunkSize = 200

var ErrAgentCustomerQuery = errors.New("invalid agent customer query")

type AgentPromotion struct {
	AffCode                 string `json:"aff_code"`
	RegisterLink            string `json:"register_link"`
	BoundCustomerCount      int64  `json:"bound_customer_count"`
	MonthBoundCustomerCount int64  `json:"month_bound_customer_count"`
}

type AgentCustomer struct {
	ID                    int    `json:"id"`
	Username              string `json:"username"`
	DisplayName           string `json:"display_name"`
	Status                int    `json:"status"`
	CreatedAt             int64  `json:"created_at"`
	LastLoginAt           int64  `json:"last_login_at"`
	Quota                 int    `json:"quota"`
	UsedQuota             int    `json:"used_quota"`
	RemainingQuota        int    `json:"remaining_quota"`
	BoundAt               int64  `json:"bound_at"`
	SubscriptionPlanTitle string `json:"subscription_plan_title,omitempty"`
	SubscriptionEndTime   int64  `json:"subscription_end_time,omitempty"`
}

type AgentCustomerQuery struct {
	Keyword   string
	SortBy    string
	SortOrder string
	Offset    int
	Limit     int
}

type AgentCustomerLogQuery struct {
	UserID         int
	Username       string
	Type           int
	ModelName      string
	TokenName      string
	Group          string
	StartTimestamp int64
	EndTimestamp   int64
	Offset         int
	Limit          int
}

type agentCustomerRow struct {
	ID          int
	Username    string
	DisplayName string
	Status      int
	CreatedAt   int64
	LastLoginAt int64
	Quota       int
	UsedQuota   int
	BoundAt     int64
}

func validateAgentCustomerRead(agentUserID int) error {
	if !operation_setting.GetAgentSetting().Enabled {
		return ErrAgentFeatureDisabled
	}
	if _, err := getAgentQueryAccount(agentUserID); err != nil {
		return err
	}
	return nil
}

func GetAgentPromotion(agentUserID int) (AgentPromotion, error) {
	if err := validateAgentCustomerRead(agentUserID); err != nil {
		return AgentPromotion{}, err
	}
	var user model.User
	if err := model.DB.Select("aff_code").First(&user, agentUserID).Error; err != nil {
		return AgentPromotion{}, err
	}
	var total int64
	if err := model.DB.Model(&model.User{}).Where("bound_agent_id = ?", agentUserID).Count(&total).Error; err != nil {
		return AgentPromotion{}, err
	}
	now := time.Now()
	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location()).Unix()
	var monthTotal int64
	if err := model.DB.Model(&model.User{}).
		Where("bound_agent_id = ? AND bound_at >= ?", agentUserID, monthStart).
		Count(&monthTotal).Error; err != nil {
		return AgentPromotion{}, err
	}
	base := strings.TrimRight(system_setting.ServerAddress, "/")
	return AgentPromotion{
		AffCode:                 user.AffCode,
		RegisterLink:            fmt.Sprintf("%s/sign-up?aff=%s", base, url.QueryEscape(user.AffCode)),
		BoundCustomerCount:      total,
		MonthBoundCustomerCount: monthTotal,
	}, nil
}

func ListAgentCustomers(agentUserID int, query AgentCustomerQuery) ([]AgentCustomer, int64, error) {
	if err := validateAgentCustomerRead(agentUserID); err != nil {
		return nil, 0, err
	}
	limit, err := validateAgentQueryPage(query.Offset, query.Limit)
	if err != nil || query.Offset < 0 || (query.SortOrder != "" && query.SortOrder != "asc" && query.SortOrder != "desc") {
		return nil, 0, ErrAgentCustomerQuery
	}
	if query.SortBy == "" {
		query.SortBy = "bound_at"
	}
	if !validAgentCustomerSort(query.SortBy) {
		return nil, 0, ErrAgentCustomerQuery
	}
	if query.SortOrder == "" {
		query.SortOrder = "desc"
	}

	baseQuery := model.DB.Model(&model.User{}).Where("bound_agent_id = ?", agentUserID)
	if query.Keyword != "" {
		pattern := "%" + query.Keyword + "%"
		baseQuery = baseQuery.Where("username LIKE ? OR display_name LIKE ?", pattern, pattern)
	}
	var total int64
	if err := baseQuery.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	rowsQuery := baseQuery.Select("id, username, display_name, status, created_at, last_login_at, quota, used_quota, bound_at")
	var rows []agentCustomerRow
	if query.SortBy == "subscription_end_time" {
		if err := rowsQuery.Order("id DESC").Find(&rows).Error; err != nil {
			return nil, total, err
		}
	} else {
		orderColumn := agentCustomerSortColumns[query.SortBy]
		if query.SortOrder == "asc" {
			orderColumn += " ASC"
		} else {
			orderColumn += " DESC"
		}
		if err := rowsQuery.Order(orderColumn).Order("id DESC").Offset(query.Offset).Limit(limit).Find(&rows).Error; err != nil {
			return nil, total, err
		}
	}

	customers := make([]AgentCustomer, 0, len(rows))
	for _, row := range rows {
		remaining := row.Quota - row.UsedQuota
		if remaining < 0 {
			remaining = 0
		}
		customers = append(customers, AgentCustomer{
			ID: row.ID, Username: row.Username, DisplayName: row.DisplayName,
			Status: row.Status, CreatedAt: row.CreatedAt, LastLoginAt: row.LastLoginAt,
			Quota: row.Quota, UsedQuota: row.UsedQuota, RemainingQuota: remaining, BoundAt: row.BoundAt,
		})
	}
	if err := fillAgentCustomerSubscriptions(customers); err != nil {
		return nil, total, err
	}
	if query.SortBy == "subscription_end_time" {
		sort.SliceStable(customers, func(i, j int) bool {
			left, right := customers[i], customers[j]
			if left.SubscriptionEndTime == right.SubscriptionEndTime {
				return left.ID > right.ID
			}
			if query.SortOrder == "asc" {
				return left.SubscriptionEndTime < right.SubscriptionEndTime
			}
			return left.SubscriptionEndTime > right.SubscriptionEndTime
		})
		if query.Offset >= len(customers) {
			return []AgentCustomer{}, total, nil
		}
		end := query.Offset + limit
		if end > len(customers) {
			end = len(customers)
		}
		customers = customers[query.Offset:end]
	}
	return customers, total, nil
}

var agentCustomerSortColumns = map[string]string{
	"status":          "status",
	"remaining_quota": "quota - used_quota",
	"bound_at":        "bound_at",
}

func validAgentCustomerSort(value string) bool {
	return value == "subscription_end_time" || agentCustomerSortColumns[value] != ""
}

func fillAgentCustomerSubscriptions(customers []AgentCustomer) error {
	if len(customers) == 0 {
		return nil
	}
	userIDs := make([]int, 0, len(customers))
	for _, customer := range customers {
		userIDs = append(userIDs, customer.ID)
	}
	var subscriptions []model.UserSubscription
	if err := model.DB.Where("user_id IN ? AND status = ? AND end_time > ?", userIDs, "active", common.GetTimestamp()).
		Order("end_time DESC").Order("id DESC").Find(&subscriptions).Error; err != nil {
		return err
	}
	planIDs := make([]int, 0, len(subscriptions))
	seenPlans := make(map[int]struct{}, len(subscriptions))
	for _, subscription := range subscriptions {
		if _, ok := seenPlans[subscription.PlanId]; !ok {
			seenPlans[subscription.PlanId] = struct{}{}
			planIDs = append(planIDs, subscription.PlanId)
		}
	}
	plans := make(map[int]string, len(planIDs))
	if len(planIDs) > 0 {
		var rows []model.SubscriptionPlan
		if err := model.DB.Select("id, title").Where("id IN ?", planIDs).Find(&rows).Error; err != nil {
			return err
		}
		for _, plan := range rows {
			plans[plan.Id] = plan.Title
		}
	}
	byUser := make(map[int]model.UserSubscription, len(subscriptions))
	remainingByUser := make(map[int]int64, len(subscriptions))
	for _, subscription := range subscriptions {
		remaining := subscription.AmountTotal - subscription.AmountUsed
		if remaining > 0 {
			remainingByUser[subscription.UserId] += remaining
		}
		if _, exists := byUser[subscription.UserId]; !exists {
			byUser[subscription.UserId] = subscription
		}
	}
	for index := range customers {
		subscription, ok := byUser[customers[index].ID]
		if !ok {
			continue
		}
		customers[index].SubscriptionEndTime = subscription.EndTime
		customers[index].SubscriptionPlanTitle = plans[subscription.PlanId]
		customers[index].RemainingQuota = common.QuotaFromFloat(
			float64(customers[index].RemainingQuota) + float64(remainingByUser[customers[index].ID]),
		)
	}
	return nil
}

func ListAgentCustomerLogs(agentUserID int, query AgentCustomerLogQuery) ([]*model.Log, int64, error) {
	if err := validateAgentCustomerLogQuery(query); err != nil {
		return nil, 0, err
	}
	if err := validateAgentCustomerRead(agentUserID); err != nil {
		return nil, 0, err
	}
	userIDs, err := getAgentCustomerIDs(agentUserID, query.UserID, query.Username)
	if err != nil {
		return nil, 0, err
	}
	if len(userIDs) == 0 {
		return []*model.Log{}, 0, nil
	}
	logs, total, err := queryAgentCustomerLogs(userIDs, query)
	if err != nil {
		return nil, 0, err
	}
	model.FormatUserLogsForRequester(logs, query.Offset)
	for _, log := range logs {
		if log != nil {
			log.Ip = ""
		}
	}
	return logs, total, nil
}

func GetAgentCustomerLogStats(agentUserID int, query AgentCustomerLogQuery) (model.Stat, error) {
	if err := validateAgentCustomerLogQuery(query); err != nil {
		return model.Stat{}, err
	}
	if err := validateAgentCustomerRead(agentUserID); err != nil {
		return model.Stat{}, err
	}
	userIDs, err := getAgentCustomerIDs(agentUserID, query.UserID, query.Username)
	if err != nil {
		return model.Stat{}, err
	}
	if len(userIDs) == 0 {
		return model.Stat{}, nil
	}
	var stat model.Stat
	query.Type = model.LogTypeUnknown
	for start := 0; start < len(userIDs); start += agentCustomerLogIDChunkSize {
		end := start + agentCustomerLogIDChunkSize
		if end > len(userIDs) {
			end = len(userIDs)
		}
		chunk := userIDs[start:end]
		var row model.Stat
		if err := buildAgentCustomerLogQuery(chunk, query).
			Where("type = ?", model.LogTypeConsume).
			Select("COALESCE(sum(quota), 0) AS quota").Scan(&row).Error; err != nil {
			return model.Stat{}, err
		}
		stat.Quota += row.Quota

		var rpmTpm struct {
			Rpm int `gorm:"column:rpm"`
			Tpm int `gorm:"column:tpm"`
		}
		if err := buildAgentCustomerLogQuery(chunk, query).
			Where("type = ? AND created_at >= ?", model.LogTypeConsume, time.Now().Add(-60*time.Second).Unix()).
			Select("count(*) AS rpm, COALESCE(sum(prompt_tokens), 0) + COALESCE(sum(completion_tokens), 0) AS tpm").Scan(&rpmTpm).Error; err != nil {
			return model.Stat{}, err
		}
		stat.Rpm += rpmTpm.Rpm
		stat.Tpm += rpmTpm.Tpm
	}
	return stat, nil
}

func validateAgentCustomerLogQuery(query AgentCustomerLogQuery) error {
	if query.UserID < 0 || query.Offset < 0 || query.StartTimestamp < 0 || query.EndTimestamp < 0 ||
		query.Type < model.LogTypeUnknown || query.Type > model.LogTypeLogin ||
		(query.EndTimestamp != 0 && query.EndTimestamp < query.StartTimestamp) {
		return ErrAgentCustomerQuery
	}
	if query.Limit < 0 {
		return ErrAgentCustomerQuery
	}
	return nil
}

func getAgentCustomerIDs(agentUserID int, userID int, username string) ([]int, error) {
	query := model.DB.Model(&model.User{}).Where("bound_agent_id = ?", agentUserID)
	if userID > 0 {
		query = query.Where("id = ?", userID)
	}
	if username != "" {
		query = query.Where("username = ?", username)
	}
	var userIDs []int
	if err := query.Pluck("id", &userIDs).Error; err != nil {
		return nil, err
	}
	return userIDs, nil
}

func queryAgentCustomerLogs(userIDs []int, query AgentCustomerLogQuery) ([]*model.Log, int64, error) {
	pageLimit, err := validateAgentQueryPage(query.Offset, query.Limit)
	if err != nil {
		return nil, 0, err
	}
	fetchLimit := query.Offset + pageLimit
	allLogs := make([]*model.Log, 0)
	var total int64
	for start := 0; start < len(userIDs); start += agentCustomerLogIDChunkSize {
		end := start + agentCustomerLogIDChunkSize
		if end > len(userIDs) {
			end = len(userIDs)
		}
		chunk := userIDs[start:end]
		base := buildAgentCustomerLogQuery(chunk, query)
		var count int64
		if err := base.Count(&count).Error; err != nil {
			return nil, 0, err
		}
		total += count
		var logs []*model.Log
		if err := base.Order("created_at DESC").Order("id DESC").Limit(fetchLimit).Find(&logs).Error; err != nil {
			return nil, 0, err
		}
		allLogs = append(allLogs, logs...)
	}
	sort.SliceStable(allLogs, func(i, j int) bool {
		if allLogs[i].CreatedAt == allLogs[j].CreatedAt {
			return allLogs[i].Id > allLogs[j].Id
		}
		return allLogs[i].CreatedAt > allLogs[j].CreatedAt
	})
	if query.Offset >= len(allLogs) {
		return []*model.Log{}, total, nil
	}
	end := query.Offset + pageLimit
	if end > len(allLogs) {
		end = len(allLogs)
	}
	return allLogs[query.Offset:end], total, nil
}

func buildAgentCustomerLogQuery(userIDs []int, query AgentCustomerLogQuery) *gorm.DB {
	tx := model.LOG_DB.Model(&model.Log{}).Where("user_id IN ?", userIDs)
	return applyAgentCustomerLogFilters(tx, query)
}

func applyAgentCustomerLogFilters(tx *gorm.DB, query AgentCustomerLogQuery) *gorm.DB {
	if query.Type != model.LogTypeUnknown {
		tx = tx.Where("type = ?", query.Type)
	}
	if query.ModelName != "" {
		tx = tx.Where("model_name LIKE ?", "%"+query.ModelName+"%")
	}
	if query.TokenName != "" {
		tx = tx.Where("token_name = ?", query.TokenName)
	}
	if query.Group != "" {
		tx = tx.Where(model.LogGroupColumn()+" = ?", query.Group)
	}
	if query.StartTimestamp != 0 {
		tx = tx.Where("created_at >= ?", query.StartTimestamp)
	}
	if query.EndTimestamp != 0 {
		tx = tx.Where("created_at <= ?", query.EndTimestamp)
	}
	return tx
}
