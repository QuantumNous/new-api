package main

import "time"

const migrationBundleVersion = 1

type SourceUser struct {
	Id               int        `json:"id"`
	Username         string     `json:"username"`
	Password         string     `json:"password"`
	DisplayName      string     `json:"display_name"`
	Role             int        `json:"role"`
	Status           int        `json:"status"`
	Email            string     `json:"email"`
	GitHubId         string     `json:"github_id"`
	DiscordId        string     `json:"discord_id"`
	OidcId           string     `json:"oidc_id"`
	WeChatId         string     `json:"wechat_id"`
	TelegramId       string     `json:"telegram_id"`
	AccessToken      *string    `json:"access_token"`
	Quota            int        `json:"quota"`
	UsedQuota        int        `json:"used_quota"`
	RequestCount     int        `json:"request_count"`
	Group            string     `json:"group"`
	AffCode          string     `json:"aff_code"`
	AffCount         int        `json:"aff_count"`
	AffQuota         int        `json:"aff_quota"`
	AffHistoryQuota  int        `json:"aff_history_quota" gorm:"column:aff_history"`
	InviterId        int        `json:"inviter_id"`
	BoundAgentId     int        `json:"bound_agent_id"`
	BoundAt          *time.Time `json:"bound_at"`
	LinuxDOId        string     `json:"linux_do_id"`
	Setting          string     `json:"setting"`
	Remark           string     `json:"remark"`
	StripeCustomer   string     `json:"stripe_customer"`
	CreatedAt        *time.Time `json:"created_at"`
	LastLoginAt      *time.Time `json:"last_login_at"`
	ExpireAt         *time.Time `json:"expire_at"`
	ActivationPolicy string     `json:"activation_policy"`
	ActivatedAt      *time.Time `json:"activated_at"`
	PendingExpireAt  *time.Time `json:"pending_expire_at"`
	IsAgent          bool       `json:"is_agent"`
	RegisterSource   string     `json:"register_source"`
}

func (SourceUser) TableName() string { return "users" }

type SourceAgentCredit struct {
	Id            int   `json:"id"`
	UserId        int   `json:"user_id"`
	Balance       int64 `json:"balance"`
	Status        int   `json:"status"`
	DailyGenLimit int   `json:"daily_gen_limit"`
	CreatedAt     int64 `json:"created_at"`
	UpdatedAt     int64 `json:"updated_at"`
}

func (SourceAgentCredit) TableName() string { return "agent_credits" }

type SourceAgentCreditLog struct {
	Id            int    `json:"id"`
	UserId        int    `json:"user_id"`
	Delta         int64  `json:"delta"`
	Before        int64  `json:"before"`
	After         int64  `json:"after"`
	ChangeType    string `json:"change_type"`
	SourceId      int    `json:"source_id"`
	OperatorId    int    `json:"operator_id"`
	Remark        string `json:"remark"`
	CreatedAt     int64  `json:"created_at"`
	RelatedUserId int    `json:"related_user_id"`
	PackageId     int    `json:"package_id"`
	OfferId       int    `json:"offer_id"`
	SourceType    string `json:"source_type"`
	BaseAmount    int64  `json:"base_amount"`
	Status        int    `json:"status"`
}

func (SourceAgentCreditLog) TableName() string { return "agent_credit_logs" }

type SourcePackage struct {
	Id               int     `json:"id"`
	Name             string  `json:"name"`
	ProductType      string  `json:"product_type"`
	Duration         int     `json:"duration"`
	DurationUnit     string  `json:"duration_unit"`
	QuotaUSD         float64 `json:"quota_usd"`
	CustomMessage    string  `json:"custom_message"`
	Status           int     `json:"status"`
	Group            string  `json:"group"`
	ExpireGroup      string  `json:"expire_group"`
	ActivationPolicy string  `json:"activation_policy"`
	MaxPendingDays   int     `json:"max_pending_days"`
	PendingActions   int     `json:"pending_actions"`
	AgentPrice       int64   `json:"agent_price"`
	RetailPrice      int64   `json:"retail_price"`
	OriginalPrice    int64   `json:"original_price"`
}

func (SourcePackage) TableName() string { return "packages" }

type SourceOffer struct {
	Id             int        `json:"id"`
	PackageId      int        `json:"package_id"`
	Name           string     `json:"name"`
	OfferType      string     `json:"offer_type"`
	Currency       string     `json:"currency"`
	Amount         int64      `json:"amount"`
	Duration       int        `json:"duration"`
	DurationUnit   string     `json:"duration_unit"`
	RefundFeeType  string     `json:"refund_fee_type"`
	RefundFeeValue int64      `json:"refund_fee_value"`
	ValidFrom      *time.Time `json:"valid_from"`
	ValidTo        *time.Time `json:"valid_to"`
	Status         int        `json:"status"`
	SortOrder      int        `json:"sort_order"`
}

func (SourceOffer) TableName() string { return "offers" }

type SourceRedemption struct {
	Id                  int    `json:"id"`
	UserId              int    `json:"user_id"`
	Key                 string `json:"key"`
	Status              int    `json:"status"`
	Name                string `json:"name"`
	Quota               int    `json:"quota"`
	CreatedTime         int64  `json:"created_time"`
	RedeemedTime        int64  `json:"redeemed_time"`
	UsedUserId          int    `json:"used_user_id"`
	ExpiredTime         int64  `json:"expired_time"`
	Type                int    `json:"type"`
	PackageId           int    `json:"package_id"`
	AgentId             int    `json:"agent_id"`
	OfferId             int    `json:"offer_id"`
	OfferAmount         int64  `json:"offer_amount"`
	OfferRefundFeeType  string `json:"offer_refund_fee_type"`
	OfferRefundFeeValue int64  `json:"offer_refund_fee_value"`
	OfferDuration       int    `json:"offer_duration"`
	OfferDurationUnit   string `json:"offer_duration_unit"`
	OfferCurrency       string `json:"offer_currency"`
	OfferRetailAmount   int64  `json:"offer_retail_amount"`
}

func (SourceRedemption) TableName() string { return "redemptions" }

type SourceUserPackage struct {
	Id                     int        `json:"id"`
	UserId                 int        `json:"user_id"`
	PackageId              int        `json:"package_id"`
	QuotaAllocated         int        `json:"quota_allocated"`
	AppliedAt              time.Time  `json:"applied_at"`
	ExpireAt               *time.Time `json:"expire_at"`
	ClearedAt              *time.Time `json:"cleared_at"`
	ActivationPolicy       string     `json:"activation_policy"`
	PendingExpireAt        *time.Time `json:"pending_expire_at"`
	ActivatedAt            *time.Time `json:"activated_at"`
	DurationSnapshot       int        `json:"duration_snapshot"`
	DurationUnitSnapshot   string     `json:"duration_unit_snapshot"`
	ExpireGroupSnapshot    string     `json:"expire_group_snapshot"`
	PendingActionsSnapshot *int       `json:"pending_actions_snapshot"`
	OfferId                int        `json:"offer_id"`
	OfferAmount            int64      `json:"offer_amount"`
	OfferCurrency          string     `json:"offer_currency"`
}

func (SourceUserPackage) TableName() string { return "user_packages" }

type SourceQuotaGrant struct {
	Id         int        `json:"id"`
	UserId     int        `json:"user_id"`
	Total      int        `json:"total"`
	Remaining  int        `json:"remaining"`
	Status     int        `json:"status"`
	GrantType  string     `json:"grant_type"`
	SourceType string     `json:"source_type"`
	SourceId   int        `json:"source_id"`
	OperatorId int        `json:"operator_id"`
	ExpireAt   *time.Time `json:"expire_at"`
	Remark     string     `json:"remark"`
	CreatedAt  time.Time  `json:"created_at"`
}

func (SourceQuotaGrant) TableName() string { return "quota_grants" }

type SourceLog struct {
	Id               int    `json:"id"`
	UserId           int    `json:"user_id"`
	CreatedAt        int64  `json:"created_at"`
	Type             int    `json:"type"`
	Content          string `json:"content"`
	Username         string `json:"username"`
	TokenName        string `json:"token_name"`
	ModelName        string `json:"model_name"`
	Quota            int    `json:"quota"`
	PromptTokens     int    `json:"prompt_tokens"`
	CompletionTokens int    `json:"completion_tokens"`
	UseTime          int    `json:"use_time"`
	IsStream         bool   `json:"is_stream"`
	ChannelId        int    `json:"channel_id" gorm:"column:channel"`
	TokenId          int    `json:"token_id"`
	Group            string `json:"group"`
	Ip               string `json:"ip"`
	RequestId        string `json:"request_id"`
	Other            string `json:"other"`
}

func (SourceLog) TableName() string { return "logs" }

type SourceToken struct {
	Id                 int     `json:"id"`
	UserId             int     `json:"user_id"`
	Key                string  `json:"key"`
	Status             int     `json:"status"`
	Name               string  `json:"name"`
	CreatedTime        int64   `json:"created_time"`
	AccessedTime       int64   `json:"accessed_time"`
	ExpiredTime        int64   `json:"expired_time"`
	RemainQuota        int     `json:"remain_quota"`
	UnlimitedQuota     bool    `json:"unlimited_quota"`
	ModelLimitsEnabled bool    `json:"model_limits_enabled"`
	ModelLimits        string  `json:"model_limits"`
	AllowIps           *string `json:"allow_ips"`
	UsedQuota          int     `json:"used_quota"`
	Group              string  `json:"group"`
	CrossGroupRetry    bool    `json:"cross_group_retry"`
}

func (SourceToken) TableName() string { return "tokens" }

type Manifest struct {
	Version    int              `json:"version"`
	ExportedAt time.Time        `json:"exported_at"`
	AgentID    int              `json:"agent_id"`
	Counts     map[string]int64 `json:"counts"`
	SHA256     string           `json:"sha256"`
}

type MigrationBundle struct {
	Version      int                    `json:"version"`
	AgentID      int                    `json:"agent_id"`
	Agent        SourceUser             `json:"agent"`
	Customers    []SourceUser           `json:"customers"`
	Credits      []SourceAgentCredit    `json:"credits"`
	CreditLogs   []SourceAgentCreditLog `json:"credit_logs"`
	Packages     []SourcePackage        `json:"packages"`
	Offers       []SourceOffer          `json:"offers"`
	Redemptions  []SourceRedemption     `json:"redemptions"`
	UserPackages []SourceUserPackage    `json:"user_packages"`
	QuotaGrants  []SourceQuotaGrant     `json:"quota_grants"`
	Logs         []SourceLog            `json:"logs"`
	Tokens       []SourceToken          `json:"tokens"`
	Manifest     Manifest               `json:"manifest"`
}
