package model

import "gorm.io/gorm"

const (
	UserPhoneBindingStatusActive   = "active"
	UserPhoneBindingStatusReplaced = "replaced"
	UserPhoneBindingStatusUnbound  = "unbound"
)

type smsTableNamer interface {
	TableName() string
}

func SMSSidecarModels() []interface{} {
	return []interface{}{
		&UserPhoneBinding{},
		&SMSSendLog{},
		&SMSRateLimitCounter{},
	}
}

func SMSSidecarTableNames() []string {
	models := SMSSidecarModels()
	names := make([]string, 0, len(models))
	for _, model := range models {
		if namer, ok := model.(smsTableNamer); ok {
			names = append(names, namer.TableName())
		}
	}
	return names
}

type SMSSendLog struct {
	Id              int    `json:"id"`
	PhoneMasked     string `json:"phone_masked" gorm:"type:varchar(32);not null;default:'';index"`
	Scene           string `json:"scene" gorm:"type:varchar(32);not null;default:'';index"`
	Provider        string `json:"provider" gorm:"type:varchar(32);not null;default:'';index"`
	TemplateVersion string `json:"template_version" gorm:"type:varchar(64);not null;default:'';index"`
	ProviderCode    string `json:"provider_code" gorm:"type:varchar(64);not null;default:'';index"`
	DurationMs      int64  `json:"duration_ms" gorm:"bigint;not null;default:0"`
	CreatedAt       int64  `json:"created_at" gorm:"autoCreateTime;column:created_at;index"`
}

func (SMSSendLog) TableName() string {
	return "sms_send_logs"
}

type UserPhoneBinding struct {
	Id          int            `json:"id"`
	UserId      int            `json:"user_id" gorm:"type:int;not null;index"`
	PhoneHash   string         `json:"phone_hash" gorm:"type:varchar(128);not null;default:'';index"`
	PhoneMasked string         `json:"phone_masked" gorm:"type:varchar(32);not null;default:''"`
	Status      string         `json:"status" gorm:"type:varchar(32);not null;default:'active';index"`
	Provider    string         `json:"provider" gorm:"type:varchar(32);not null;default:'';index"`
	VerifiedAt  int64          `json:"verified_at" gorm:"bigint;not null;default:0;index"`
	BoundAt     int64          `json:"bound_at" gorm:"bigint;not null;default:0;index"`
	UnboundAt   int64          `json:"unbound_at" gorm:"bigint;not null;default:0;index"`
	CreatedAt   int64          `json:"created_at" gorm:"autoCreateTime;column:created_at;index"`
	UpdatedAt   int64          `json:"updated_at" gorm:"autoUpdateTime;column:updated_at"`
	DeletedAt   gorm.DeletedAt `json:"-" gorm:"index"`
}

func (UserPhoneBinding) TableName() string {
	return "user_phone_bindings"
}

type SMSRateLimitCounter struct {
	Id            int    `json:"id"`
	Dimension     string `json:"dimension" gorm:"type:varchar(32);not null;default:'';index"`
	Scene         string `json:"scene" gorm:"type:varchar(32);not null;default:'';index"`
	RateKeyHash   string `json:"rate_key_hash" gorm:"type:varchar(128);not null;default:'';uniqueIndex:idx_sms_rate_limit_counter_window,priority:1"`
	WindowStart   int64  `json:"window_start" gorm:"bigint;not null;default:0;uniqueIndex:idx_sms_rate_limit_counter_window,priority:2;index"`
	WindowSeconds int    `json:"window_seconds" gorm:"type:int;not null;default:0"`
	Count         int    `json:"count" gorm:"type:int;not null;default:0"`
	ExpiresAt     int64  `json:"expires_at" gorm:"bigint;not null;default:0;index"`
	CreatedAt     int64  `json:"created_at" gorm:"autoCreateTime;column:created_at;index"`
	UpdatedAt     int64  `json:"updated_at" gorm:"autoUpdateTime;column:updated_at"`
}

func (SMSRateLimitCounter) TableName() string {
	return "sms_rate_limit_counters"
}
