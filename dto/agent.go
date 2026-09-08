package dto

type AgentDailyLimitRequest struct {
	DailyCodeLimit int `json:"daily_code_limit"`
}

type AgentCreditAdjustmentRequest struct {
	Amount         string `json:"amount"`
	Direction      string `json:"direction"`
	Reason         string `json:"reason"`
	IdempotencyKey string `json:"idempotency_key"`
}

type AgentAccountResponse struct {
	Id             int    `json:"id"`
	UserId         int    `json:"user_id"`
	Username       string `json:"username,omitempty"`
	DisplayName    string `json:"display_name,omitempty"`
	Status         string `json:"status"`
	Balance        string `json:"balance"`
	DailyCodeLimit int    `json:"daily_code_limit"`
	DailyCountDate string `json:"daily_count_date"`
	DailyCodeCount int    `json:"daily_code_count"`
	Version        int64  `json:"version"`
	CreatedAt      int64  `json:"created_at"`
	UpdatedAt      int64  `json:"updated_at"`
}

type AgentCreditLogResponse struct {
	Id             int    `json:"id"`
	AgentUserId    int    `json:"agent_user_id"`
	Delta          string `json:"delta"`
	BalanceBefore  string `json:"balance_before"`
	BalanceAfter   string `json:"balance_after"`
	EventType      string `json:"event_type"`
	BusinessKey    string `json:"business_key"`
	OrderId        int    `json:"order_id"`
	RedemptionId   int    `json:"redemption_id"`
	OperatorUserId int    `json:"operator_user_id"`
	Remark         string `json:"remark"`
	CreatedAt      int64  `json:"created_at"`
}

type AgentCreditAdjustmentResponse struct {
	Account AgentCreditBalanceResponse `json:"account"`
	Log     AgentCreditLogResponse     `json:"log"`
}

type AgentCreditBalanceResponse struct {
	Balance string `json:"balance"`
}

type AgentPlanOfferUpsertRequest struct {
	Enabled       *bool  `json:"enabled"`
	UnitPrice     string `json:"unit_price"`
	CodeValidDays *int   `json:"code_valid_days"`
	RefundFeeBps  int    `json:"refund_fee_bps"`
}

type AgentPlanOfferResponse struct {
	Id            int                           `json:"id"`
	PlanId        int                           `json:"plan_id"`
	Enabled       bool                          `json:"enabled"`
	UnitPrice     string                        `json:"unit_price"`
	CodeValidDays int                           `json:"code_valid_days"`
	RefundFeeBps  int                           `json:"refund_fee_bps"`
	Plan          AgentSubscriptionPlanResponse `json:"plan"`
	CreatedAt     int64                         `json:"created_at"`
	UpdatedAt     int64                         `json:"updated_at"`
}

type AgentPurchaseRequest struct {
	PlanId         int    `json:"plan_id"`
	Quantity       int    `json:"quantity"`
	IdempotencyKey string `json:"idempotency_key"`
}

type AgentOverviewResponse struct {
	Status             string `json:"status"`
	Balance            string `json:"balance"`
	DailyCodeLimit     int    `json:"daily_code_limit"`
	DailyCodeCount     int    `json:"daily_code_count"`
	DailyRemaining     int    `json:"daily_remaining"`
	NextDailyResetAt   int64  `json:"next_daily_reset_at"`
	AccountLastUpdated int64  `json:"account_last_updated"`
}

type AgentPurchaseOrderResponse struct {
	Id            int    `json:"id"`
	OrderNo       string `json:"order_no"`
	PlanId        int    `json:"plan_id"`
	PlanTitle     string `json:"plan_title"`
	Quantity      int    `json:"quantity"`
	UnitPrice     string `json:"unit_price"`
	TotalPrice    string `json:"total_price"`
	CodeValidDays int    `json:"code_valid_days"`
	RefundFeeBps  int    `json:"refund_fee_bps"`
	Status        string `json:"status"`
	CreatedAt     int64  `json:"created_at"`
}

type AgentPackageCodeResponse struct {
	Id                 int    `json:"id"`
	Key                string `json:"key"`
	Name               string `json:"name"`
	Status             int    `json:"status"`
	SubscriptionPlanId int    `json:"subscription_plan_id"`
	CreatedTime        int64  `json:"created_time"`
	ExpiredTime        int64  `json:"expired_time"`
}

type AgentPurchaseResponse struct {
	Order        AgentPurchaseOrderResponse `json:"order"`
	Codes        []AgentPackageCodeResponse `json:"codes"`
	BalanceAfter string                     `json:"balance_after"`
}

type AgentRefundRequest struct {
	RedemptionIds  []int  `json:"redemption_ids"`
	IdempotencyKey string `json:"idempotency_key"`
}

type AgentAdminRefundRequest struct {
	AgentUserId    int    `json:"agent_user_id"`
	RedemptionIds  []int  `json:"redemption_ids"`
	IdempotencyKey string `json:"idempotency_key"`
}

type AgentRefundResponse struct {
	RequestId     int    `json:"request_id"`
	RedemptionIds []int  `json:"redemption_ids"`
	Fee           string `json:"fee"`
	Refunded      string `json:"refunded"`
	BalanceAfter  string `json:"balance_after"`
}

type AgentReconciliationResponse struct {
	AgentUserId      int    `json:"agent_user_id"`
	Balance          string `json:"balance"`
	LedgerSum        string `json:"ledger_sum"`
	Difference       string `json:"difference"`
	LedgerCount      int64  `json:"ledger_count"`
	LedgerContinuous bool   `json:"ledger_continuous"`
	Matches          bool   `json:"matches"`
}

// AgentSubscriptionPlanResponse is the current plan catalog entry paired with
// an agent offer. Purchase-time entitlements are snapshotted separately.
type AgentSubscriptionPlanResponse struct {
	Id                      int     `json:"id"`
	Title                   string  `json:"title"`
	Subtitle                string  `json:"subtitle"`
	PriceAmount             float64 `json:"price_amount"`
	Currency                string  `json:"currency"`
	DurationUnit            string  `json:"duration_unit"`
	DurationValue           int     `json:"duration_value"`
	CustomSeconds           int64   `json:"custom_seconds"`
	Enabled                 bool    `json:"enabled"`
	SortOrder               int     `json:"sort_order"`
	AllowBalancePay         *bool   `json:"allow_balance_pay"`
	AllowWalletOverflow     *bool   `json:"allow_wallet_overflow"`
	StripePriceId           string  `json:"stripe_price_id"`
	CreemProductId          string  `json:"creem_product_id"`
	WaffoPancakeProductId   string  `json:"waffo_pancake_product_id"`
	MaxPurchasePerUser      int     `json:"max_purchase_per_user"`
	UpgradeGroup            string  `json:"upgrade_group"`
	DowngradeGroup          string  `json:"downgrade_group"`
	TotalAmount             int64   `json:"total_amount"`
	QuotaResetPeriod        string  `json:"quota_reset_period"`
	QuotaResetCustomSeconds int64   `json:"quota_reset_custom_seconds"`
	CreatedAt               int64   `json:"created_at"`
	UpdatedAt               int64   `json:"updated_at"`
}
