package model

// QuotaDebit records one external, idempotent debit of a user's quota — e.g.
// taluna converting a user's new-api quota into its own credits. external_id
// is the caller-supplied dedupe key; a retry with the same external_id never
// debits twice.
type QuotaDebit struct {
	Id         int    `json:"id"`
	UserId     int    `json:"user_id" gorm:"index"`
	Amount     int    `json:"amount"`
	ExternalId string `json:"external_id" gorm:"uniqueIndex;size:191"`
	CreatedAt  int64  `json:"created_at" gorm:"bigint"`
}
