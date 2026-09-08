package model

const (
	AgentPurchaseOrderStatusCompleted         = "completed"
	AgentPurchaseOrderStatusPartiallyRefunded = "partially_refunded"
	AgentPurchaseOrderStatusRefunded          = "refunded"
)

type AgentPurchaseOrder struct {
	Id                  int    `json:"id"`
	OrderNo             string `json:"order_no" gorm:"type:varchar(64);uniqueIndex;not null"`
	AgentUserId         int    `json:"agent_user_id" gorm:"index;uniqueIndex:idx_agent_purchase_order_idempotency;not null"`
	PlanId              int    `json:"plan_id" gorm:"index;not null"`
	PlanTitle           string `json:"plan_title" gorm:"type:varchar(128);not null"`
	Quantity            int    `json:"quantity" gorm:"type:int;not null"`
	UnitPrice           int64  `json:"-" gorm:"type:bigint;not null"`
	TotalPrice          int64  `json:"-" gorm:"type:bigint;not null"`
	CodeValidDays       int    `json:"code_valid_days" gorm:"type:int;not null"`
	RefundFeeBps        int    `json:"refund_fee_bps" gorm:"type:int;not null"`
	EntitlementSnapshot string `json:"entitlement_snapshot" gorm:"type:text;not null"`
	IdempotencyKey      string `json:"idempotency_key" gorm:"type:varchar(128);uniqueIndex:idx_agent_purchase_order_idempotency;not null"`
	RefundedCount       int    `json:"refunded_count" gorm:"type:int;not null"`
	RefundedAmount      int64  `json:"-" gorm:"type:bigint;not null"`
	Status              string `json:"status" gorm:"type:varchar(32);not null"`
	CreatedAt           int64  `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt           int64  `json:"updated_at" gorm:"autoUpdateTime"`
}
