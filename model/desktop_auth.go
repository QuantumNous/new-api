package model

// DesktopAuthorization is a short-lived browser authorization transaction.
// Secrets are represented only by SHA-256 hashes.
type DesktopAuthorization struct {
	ID            string  `gorm:"type:varchar(64);primaryKey"`
	ClientID      string  `gorm:"type:varchar(64);not null"`
	RedirectURI   string  `gorm:"type:varchar(255);not null"`
	CodeChallenge string  `gorm:"type:varchar(64);not null"`
	State         string  `gorm:"type:varchar(128);not null"`
	ClientName    string  `gorm:"type:varchar(100)"`
	Status        string  `gorm:"type:varchar(16);index;not null"`
	UserID        int     `gorm:"index"`
	CodeHash      *string `gorm:"type:varchar(64);uniqueIndex"`
	CreatedAt     int64
	ExpiresAt     int64 `gorm:"index"`
}

type DesktopSession struct {
	ID              string `gorm:"type:varchar(64);primaryKey" json:"id"`
	UserID          int    `gorm:"index" json:"-"`
	RelayTokenID    int    `gorm:"index" json:"relay_token_id"`
	ClientName      string `gorm:"type:varchar(100)" json:"client_name"`
	RefreshHash     string `gorm:"type:varchar(64);uniqueIndex" json:"-"`
	PreviousHash    string `gorm:"type:varchar(64);index" json:"-"`
	CreatedAt       int64  `json:"created_at"`
	LastRefreshedAt int64  `json:"last_refreshed_at"`
	ExpiresAt       int64  `gorm:"index" json:"expires_at"`
	RevokedAt       int64  `json:"revoked_at"`
}
