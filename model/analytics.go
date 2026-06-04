package model

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
)

type AnalyticsUserRow struct {
	Id           int    `json:"id"`
	Username     string `json:"username"`
	DisplayName  string `json:"display_name"`
	Role         int    `json:"role"`
	Status       int    `json:"status"`
	Email        string `json:"-" gorm:"column:email"`
	EmailDomain  string `json:"email_domain,omitempty" gorm:"-"`
	Quota        int    `json:"quota"`
	UsedQuota    int    `json:"used_quota"`
	RequestCount int    `json:"request_count"`
	Group        string `json:"group" gorm:"column:group_name"`
	AffCount     int    `json:"aff_count"`
	AffQuota     int    `json:"aff_quota"`
	InviterId    int    `json:"inviter_id"`
	CreatedAt    int64  `json:"created_at"`
	LastLoginAt  int64  `json:"last_login_at"`
}

type AnalyticsLogRow struct {
	Id               int            `json:"id"`
	UserId           int            `json:"user_id"`
	CreatedAt        int64          `json:"created_at"`
	Type             int            `json:"type"`
	Username         string         `json:"username"`
	TokenName        string         `json:"token_name"`
	ModelName        string         `json:"model_name"`
	Quota            int            `json:"quota"`
	PromptTokens     int            `json:"prompt_tokens"`
	CompletionTokens int            `json:"completion_tokens"`
	UseTime          int            `json:"use_time"`
	IsStream         bool           `json:"is_stream"`
	ChannelId        int            `json:"channel_id" gorm:"column:channel_id"`
	TokenId          int            `json:"token_id"`
	Group            string         `json:"group" gorm:"column:group_name"`
	Ip               string         `json:"ip"`
	RequestId        string         `json:"request_id,omitempty"`
	Other            map[string]any `json:"other,omitempty" gorm:"-"`
	OtherRaw         string         `json:"-" gorm:"column:other"`
}

type AnalyticsQuotaDataRow struct {
	Id        int    `json:"id"`
	UserID    int    `json:"user_id"`
	Username  string `json:"username"`
	ModelName string `json:"model_name"`
	CreatedAt int64  `json:"created_at"`
	TokenUsed int    `json:"token_used"`
	Count     int    `json:"count"`
	Quota     int    `json:"quota"`
}

type AnalyticsSubscriptionRow struct {
	Id            int    `json:"id"`
	UserId        int    `json:"user_id"`
	PlanId        int    `json:"plan_id"`
	AmountTotal   int64  `json:"amount_total"`
	AmountUsed    int64  `json:"amount_used"`
	StartTime     int64  `json:"start_time"`
	EndTime       int64  `json:"end_time"`
	Status        string `json:"status"`
	Source        string `json:"source"`
	LastResetTime int64  `json:"last_reset_time"`
	NextResetTime int64  `json:"next_reset_time"`
	UpgradeGroup  string `json:"upgrade_group"`
	PrevUserGroup string `json:"prev_user_group"`
	CreatedAt     int64  `json:"created_at"`
	UpdatedAt     int64  `json:"updated_at"`
}

type AnalyticsSubscriptionPlanRow struct {
	Id                          int     `json:"id"`
	Title                       string  `json:"title"`
	Subtitle                    string  `json:"subtitle"`
	PriceAmount                 float64 `json:"price_amount"`
	Currency                    string  `json:"currency"`
	DurationUnit                string  `json:"duration_unit"`
	DurationValue               int     `json:"duration_value"`
	CustomSeconds               int64   `json:"custom_seconds"`
	Enabled                     bool    `json:"enabled"`
	SortOrder                   int     `json:"sort_order"`
	MaxPurchasePerUser          int     `json:"max_purchase_per_user"`
	PeriodPurchaseLimit         int     `json:"period_purchase_limit"`
	PeriodPurchaseUnit          string  `json:"period_purchase_unit"`
	PeriodPurchaseValue         int     `json:"period_purchase_value"`
	PeriodPurchaseCustomSeconds int64   `json:"period_purchase_custom_seconds"`
	UpgradeGroup                string  `json:"upgrade_group"`
	TotalAmount                 int64   `json:"total_amount"`
	QuotaResetPeriod            string  `json:"quota_reset_period"`
	QuotaResetCustomSeconds     int64   `json:"quota_reset_custom_seconds"`
	CreatedAt                   int64   `json:"created_at"`
	UpdatedAt                   int64   `json:"updated_at"`
}

type AnalyticsSubscriptionOrderRow struct {
	Id              int     `json:"id"`
	UserId          int     `json:"user_id"`
	PlanId          int     `json:"plan_id"`
	Money           float64 `json:"money"`
	PaymentMethod   string  `json:"payment_method"`
	PaymentProvider string  `json:"payment_provider"`
	Status          string  `json:"status"`
	CreateTime      int64   `json:"create_time"`
	CompleteTime    int64   `json:"complete_time"`
}

type AnalyticsTopUpRow struct {
	Id              int     `json:"id"`
	UserId          int     `json:"user_id"`
	Amount          int64   `json:"amount"`
	Money           float64 `json:"money"`
	PaymentMethod   string  `json:"payment_method"`
	PaymentProvider string  `json:"payment_provider"`
	CreateTime      int64   `json:"create_time"`
	CompleteTime    int64   `json:"complete_time"`
	Status          string  `json:"status"`
}

type AnalyticsChannelRow struct {
	Id                 int     `json:"id"`
	Type               int     `json:"type"`
	Status             int     `json:"status"`
	Name               string  `json:"name"`
	Weight             *uint   `json:"weight"`
	CreatedTime        int64   `json:"created_time"`
	TestTime           int64   `json:"test_time"`
	ResponseTime       int     `json:"response_time"`
	Balance            float64 `json:"balance"`
	BalanceUpdatedTime int64   `json:"balance_updated_time"`
	Models             string  `json:"models"`
	Group              string  `json:"group" gorm:"column:group_name"`
	UsedQuota          int64   `json:"used_quota"`
	Priority           *int64  `json:"priority"`
	AutoBan            *int    `json:"auto_ban"`
	Tag                *string `json:"tag"`
	Remark             *string `json:"remark,omitempty"`
}

type AnalyticsAbilityRow struct {
	Group     string  `json:"group" gorm:"column:group_name"`
	Model     string  `json:"model"`
	ChannelId int     `json:"channel_id"`
	Enabled   bool    `json:"enabled"`
	Priority  *int64  `json:"priority"`
	Weight    uint    `json:"weight"`
	Tag       *string `json:"tag"`
}

func emailDomain(email string) string {
	at := strings.LastIndex(email, "@")
	if at < 0 || at == len(email)-1 {
		return ""
	}
	return strings.ToLower(email[at+1:])
}

func AnalyticsListUsers(cursorId int, limit int) ([]AnalyticsUserRow, error) {
	var rows []AnalyticsUserRow
	err := DB.Model(&User{}).
		Select("id, username, display_name, role, status, email, quota, used_quota, request_count, "+commonGroupCol+" AS group_name, aff_count, aff_quota, inviter_id, created_at, last_login_at").
		Where("id > ?", cursorId).
		Order("id ASC").
		Limit(limit).
		Scan(&rows).Error
	for i := range rows {
		rows[i].EmailDomain = emailDomain(rows[i].Email)
	}
	return rows, err
}

func analyticsLogOther(raw string) map[string]any {
	if raw == "" {
		return nil
	}
	var source map[string]any
	if err := common.UnmarshalJsonStr(raw, &source); err != nil {
		return nil
	}
	allowed := map[string]bool{
		"status_code":        true,
		"request_path":       true,
		"billing_mode":       true,
		"billing_source":     true,
		"matched_tier":       true,
		"cache_tokens":       true,
		"reasoning_effort":   true,
		"user_agent":         true,
		"session_source":     true,
		"request_conversion": true,
		"frt":                true,
		"group_ratio":        true,
		"user_group_ratio":   true,
		"model_ratio":        true,
		"completion_ratio":   true,
		"cache_ratio":        true,
	}
	out := make(map[string]any)
	for key, value := range source {
		if allowed[key] {
			out[key] = value
		}
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

func AnalyticsListLogs(startTimestamp int64, endTimestamp int64, cursorCreatedAt int64, cursorId int, limit int) ([]AnalyticsLogRow, error) {
	var rows []AnalyticsLogRow
	tx := LOG_DB.Model(&Log{}).
		Select("logs.id, logs.user_id, logs.created_at, logs.type, logs.username, logs.token_name, logs.model_name, logs.quota, logs.prompt_tokens, logs.completion_tokens, logs.use_time, logs.is_stream, logs.channel_id, logs.token_id, logs." + logGroupCol + " AS group_name, logs.ip, logs.request_id, logs.other")
	if startTimestamp > 0 {
		tx = tx.Where("logs.created_at >= ?", startTimestamp)
	}
	if endTimestamp > 0 {
		tx = tx.Where("logs.created_at <= ?", endTimestamp)
	}
	if cursorCreatedAt > 0 && cursorId > 0 {
		tx = tx.Where("(logs.created_at < ? OR (logs.created_at = ? AND logs.id < ?))", cursorCreatedAt, cursorCreatedAt, cursorId)
	}
	err := tx.Order("logs.created_at DESC, logs.id DESC").Limit(limit).Scan(&rows).Error
	for i := range rows {
		rows[i].Other = analyticsLogOther(rows[i].OtherRaw)
	}
	return rows, err
}

func AnalyticsListQuotaData(startTimestamp int64, endTimestamp int64, cursorId int, limit int) ([]AnalyticsQuotaDataRow, error) {
	var rows []AnalyticsQuotaDataRow
	tx := DB.Model(&QuotaData{}).Where("id > ?", cursorId)
	if startTimestamp > 0 {
		tx = tx.Where("created_at >= ?", startTimestamp)
	}
	if endTimestamp > 0 {
		tx = tx.Where("created_at <= ?", endTimestamp)
	}
	err := tx.Order("id ASC").Limit(limit).Scan(&rows).Error
	return rows, err
}

func AnalyticsListSubscriptions(cursorId int, limit int) ([]AnalyticsSubscriptionRow, error) {
	var rows []AnalyticsSubscriptionRow
	err := DB.Model(&UserSubscription{}).Where("id > ?", cursorId).Order("id ASC").Limit(limit).Scan(&rows).Error
	return rows, err
}

func AnalyticsListSubscriptionPlans(cursorId int, limit int) ([]AnalyticsSubscriptionPlanRow, error) {
	var rows []AnalyticsSubscriptionPlanRow
	err := DB.Model(&SubscriptionPlan{}).Where("id > ?", cursorId).Order("id ASC").Limit(limit).Scan(&rows).Error
	return rows, err
}

func AnalyticsListSubscriptionOrders(cursorId int, limit int) ([]AnalyticsSubscriptionOrderRow, error) {
	var rows []AnalyticsSubscriptionOrderRow
	err := DB.Model(&SubscriptionOrder{}).
		Select("id, user_id, plan_id, money, payment_method, payment_provider, status, create_time, complete_time").
		Where("id > ?", cursorId).
		Order("id ASC").
		Limit(limit).
		Scan(&rows).Error
	return rows, err
}

func AnalyticsListTopUps(cursorId int, limit int) ([]AnalyticsTopUpRow, error) {
	var rows []AnalyticsTopUpRow
	err := DB.Model(&TopUp{}).
		Select("id, user_id, amount, money, payment_method, payment_provider, create_time, complete_time, status").
		Where("id > ?", cursorId).
		Order("id ASC").
		Limit(limit).
		Scan(&rows).Error
	return rows, err
}

func AnalyticsListChannels(cursorId int, limit int) ([]AnalyticsChannelRow, error) {
	var rows []AnalyticsChannelRow
	err := DB.Model(&Channel{}).
		Select("id, type, status, name, weight, created_time, test_time, response_time, balance, balance_updated_time, models, "+commonGroupCol+" AS group_name, used_quota, priority, auto_ban, tag, remark").
		Where("id > ?", cursorId).
		Order("id ASC").
		Limit(limit).
		Scan(&rows).Error
	return rows, err
}

func AnalyticsListAbilities(cursorChannelId int, cursorGroup string, cursorModel string, limit int) ([]AnalyticsAbilityRow, error) {
	var rows []AnalyticsAbilityRow
	tx := DB.Model(&Ability{}).
		Select(commonGroupCol + " AS group_name, model, channel_id, enabled, priority, weight, tag").
		Order("channel_id ASC, " + commonGroupCol + " ASC, model ASC").
		Limit(limit)
	if cursorChannelId > 0 {
		tx = tx.Where("channel_id > ? OR (channel_id = ? AND ("+commonGroupCol+" > ? OR ("+commonGroupCol+" = ? AND model > ?)))",
			cursorChannelId, cursorChannelId, cursorGroup, cursorGroup, cursorModel)
	}
	err := tx.Scan(&rows).Error
	return rows, err
}
