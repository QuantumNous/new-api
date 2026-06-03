package model

const (
	QuotaSourcePaid          = "paid"
	QuotaSourceGift          = "gift"
	QuotaSourceTrial         = "trial"
	QuotaSourceLegacyUnknown = "legacy_unknown"

	QuotaSourceEventCredit = "credit"
	QuotaSourceEventDebit  = "debit"
	QuotaSourceEventRefund = "refund"
)

type UserQuotaSourceBalance struct {
	Id        int    `json:"id" gorm:"primaryKey"`
	UserId    int    `json:"user_id" gorm:"type:int;not null;index;uniqueIndex:idx_user_quota_source_balance,priority:1"`
	Source    string `json:"source" gorm:"type:varchar(32);not null;index;uniqueIndex:idx_user_quota_source_balance,priority:2"`
	Balance   int64  `json:"balance" gorm:"bigint;not null;default:0"`
	CreatedAt int64  `json:"created_at" gorm:"autoCreateTime;column:created_at;index"`
	UpdatedAt int64  `json:"updated_at" gorm:"autoUpdateTime;column:updated_at;index"`
}

func (UserQuotaSourceBalance) TableName() string {
	return "user_quota_source_balances"
}

type UserQuotaSourceEvent struct {
	Id           int    `json:"id" gorm:"primaryKey"`
	UserId       int    `json:"user_id" gorm:"type:int;not null;index"`
	Source       string `json:"source" gorm:"type:varchar(32);not null;index"`
	EventType    string `json:"event_type" gorm:"type:varchar(32);not null;index"`
	Amount       int64  `json:"amount" gorm:"bigint;not null"`
	BalanceAfter int64  `json:"balance_after" gorm:"bigint;not null;default:0"`
	SourceLogId  int    `json:"source_log_id" gorm:"type:int;not null;default:0;index"`
	RelatedType  string `json:"related_type" gorm:"type:varchar(64);not null;default:'';index:idx_quota_source_related,priority:1"`
	RelatedId    string `json:"related_id" gorm:"type:varchar(128);not null;default:'';index:idx_quota_source_related,priority:2"`
	RequestId    string `json:"request_id" gorm:"type:varchar(128);not null;default:'';index"`
	Remark       string `json:"remark" gorm:"type:varchar(255);not null;default:''"`
	CreatedAt    int64  `json:"created_at" gorm:"autoCreateTime;column:created_at;index"`
}

func (UserQuotaSourceEvent) TableName() string {
	return "user_quota_source_events"
}

type UserQuotaSourceSegment struct {
	Source string `json:"source"`
	Amount int64  `json:"amount"`
}

type UserQuotaSourceBreakdown struct {
	Paid          int64 `json:"paid"`
	Gift          int64 `json:"gift"`
	Trial         int64 `json:"trial"`
	LegacyUnknown int64 `json:"legacy_unknown"`
	Total         int64 `json:"total"`
}

func QuotaSourceSidecarModels() []interface{} {
	return []interface{}{
		&UserQuotaSourceBalance{},
		&UserQuotaSourceEvent{},
	}
}

func QuotaSourceSidecarTableNames() []string {
	models := QuotaSourceSidecarModels()
	names := make([]string, 0, len(models))
	for _, model := range models {
		if namer, ok := model.(affiliateTableNamer); ok {
			names = append(names, namer.TableName())
		}
	}
	return names
}

func SumQuotaSourceSegments(segments []UserQuotaSourceSegment) UserQuotaSourceBreakdown {
	breakdown := UserQuotaSourceBreakdown{}
	for _, segment := range segments {
		if segment.Amount <= 0 {
			continue
		}
		breakdown.Total += segment.Amount
		switch segment.Source {
		case QuotaSourcePaid:
			breakdown.Paid += segment.Amount
		case QuotaSourceGift:
			breakdown.Gift += segment.Amount
		case QuotaSourceTrial:
			breakdown.Trial += segment.Amount
		default:
			breakdown.LegacyUnknown += segment.Amount
		}
	}
	return breakdown
}
