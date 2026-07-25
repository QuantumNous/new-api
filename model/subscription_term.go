package model

const (
	SubscriptionTermStatusActive     = "active"
	SubscriptionTermStatusNotStarted = "not_started"
	SubscriptionTermStatusReplaced   = "replaced"
	SubscriptionTermStatusRefunded   = "refunded"

	WalletLedgerEntryTypePrepaidDebit  = "prepaid_debit"
	WalletLedgerEntryTypePrepaidRefund = "prepaid_refund"
)

type SubscriptionTermSegment struct {
	Id int64 `json:"id"`

	ContractId   int64 `json:"contract_id" gorm:"type:bigint;not null;index"`
	OrderId      int   `json:"order_id" gorm:"not null;uniqueIndex:idx_subscription_term_order_segment,priority:1"`
	PlanId       int   `json:"plan_id" gorm:"not null;index"`
	SegmentIndex int   `json:"segment_index" gorm:"not null;uniqueIndex:idx_subscription_term_order_segment,priority:2"`
	StartTime    int64 `json:"start_time" gorm:"type:bigint;not null;default:0;index"`
	EndTime      int64 `json:"end_time" gorm:"type:bigint;not null;default:0;index"`

	AllocatedMoney float64 `json:"allocated_money" gorm:"type:decimal(10,6);not null;default:0"`
	Status         string  `json:"status" gorm:"type:varchar(32);not null;default:'';index"`
	RefundKey      *string `json:"refund_key" gorm:"type:varchar(255);uniqueIndex"`
}

type WalletLedgerEntry struct {
	Id int64 `json:"id"`

	UserId        int     `json:"user_id" gorm:"not null;index"`
	EntryKey      string  `json:"entry_key" gorm:"type:varchar(255);not null;uniqueIndex"`
	QuotaDelta    int64   `json:"quota_delta" gorm:"type:bigint;not null;default:0"`
	MoneyAmount   float64 `json:"money_amount" gorm:"type:decimal(10,6);not null;default:0"`
	EntryType     string  `json:"entry_type" gorm:"type:varchar(32);not null;default:'';index"`
	OrderId       int     `json:"order_id" gorm:"not null;default:0;index"`
	TermSegmentId int64   `json:"term_segment_id" gorm:"type:bigint;not null;default:0;index"`
}
