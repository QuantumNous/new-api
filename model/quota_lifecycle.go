package model

const (
	QuotaLifecycleScopeUser   = "user"
	QuotaLifecycleScopeToken  = "token"
	QuotaLifecycleScopeWallet = "wallet"
)

type QuotaLifecycleState struct {
	Id           int64  `json:"id" gorm:"primaryKey"`
	UserId       int    `json:"user_id" gorm:"not null;uniqueIndex:idx_quota_lifecycle_scope,priority:1;index"`
	ScopeType    string `json:"scope_type" gorm:"type:varchar(32);not null;uniqueIndex:idx_quota_lifecycle_scope,priority:2"`
	ScopeId      string `json:"scope_id" gorm:"type:varchar(128);not null;uniqueIndex:idx_quota_lifecycle_scope,priority:3"`
	Cycle        string `json:"cycle" gorm:"type:varchar(64);not null;index"`
	Balance      int64  `json:"balance" gorm:"not null;default:0"`
	Threshold    int64  `json:"threshold" gorm:"not null;default:0"`
	Source       string `json:"source" gorm:"type:varchar(64);not null"`
	SourceData   string `json:"source_data" gorm:"type:text;not null"`
	StateVersion int64  `json:"state_version" gorm:"not null;default:1"`
	CreatedAt    int64  `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt    int64  `json:"updated_at" gorm:"autoUpdateTime"`
}
