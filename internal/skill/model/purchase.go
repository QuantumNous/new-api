package skillmodel

import (
	"errors"
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/internal/skill/enums"
	"github.com/QuantumNous/new-api/internal/skill/pricing"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

const (
	SkillPurchaseStatusPending   = "pending"
	SkillPurchaseStatusSucceeded = "succeeded"
	SkillPurchaseStatusFailed    = "failed"
	SkillPurchaseStatusAbandoned = "abandoned"

	SkillEntitlementSourceOneTimePurchase = "one_time_purchase"
)

type SkillPurchaseOrder struct {
	ID             string                 `gorm:"column:id;type:char(36);primaryKey;not null"`
	UserID         int64                  `gorm:"column:user_id;type:bigint;not null;uniqueIndex:idx_spo_user_idempotency,priority:1;index"`
	TenantID       int64                  `gorm:"column:tenant_id;type:bigint;not null"`
	SkillID        string                 `gorm:"column:skill_id;type:char(36);not null;index"`
	SkillVersionID *string                `gorm:"column:skill_version_id;type:char(36)"`
	IdempotencyKey string                 `gorm:"column:idempotency_key;type:varchar(128);not null;uniqueIndex:idx_spo_user_idempotency,priority:2"`
	AmountUSD      float64                `gorm:"column:amount_usd;type:decimal;not null"`
	Currency       string                 `gorm:"column:currency;type:varchar(8);not null;default:USD"`
	QuotaCharged   int                    `gorm:"column:quota_charged;type:integer;not null;default:0"`
	Monetization   enums.MonetizationType `gorm:"column:monetization_type;type:varchar(32);not null"`
	Status         string                 `gorm:"column:status;type:varchar(32);not null;default:pending;index"`
	CreatedAt      time.Time              `gorm:"column:created_at;not null;autoCreateTime"`
	CompletedAt    *time.Time             `gorm:"column:completed_at"`
	UpdatedAt      time.Time              `gorm:"column:updated_at;not null;autoUpdateTime"`
}

func (SkillPurchaseOrder) TableName() string { return "skill_purchase_orders" }

func (o *SkillPurchaseOrder) BeforeCreate(tx *gorm.DB) error {
	if o.ID == "" {
		o.ID = uuid.New().String()
	}
	if o.Currency == "" {
		o.Currency = "USD"
	}
	if o.Status == "" {
		o.Status = SkillPurchaseStatusPending
	}
	return nil
}

type SkillEntitlement struct {
	UserID          int64     `gorm:"column:user_id;type:bigint;not null;primaryKey"`
	TenantID        int64     `gorm:"column:tenant_id;type:bigint;not null"`
	SkillID         string    `gorm:"column:skill_id;type:char(36);not null;primaryKey"`
	Source          string    `gorm:"column:source;type:varchar(64);not null"`
	PurchaseOrderID string    `gorm:"column:purchase_order_id;type:char(36);not null"`
	GrantedAt       time.Time `gorm:"column:granted_at;not null"`
	CreatedAt       time.Time `gorm:"column:created_at;not null;autoCreateTime"`
	UpdatedAt       time.Time `gorm:"column:updated_at;not null;autoUpdateTime"`
}

func (SkillEntitlement) TableName() string { return "skill_entitlements" }

func (e *SkillEntitlement) BeforeCreate(tx *gorm.DB) error {
	if e.GrantedAt.IsZero() {
		e.GrantedAt = time.Now().UTC()
	}
	return nil
}

func MigrateSkillPurchases(db *gorm.DB) error {
	if err := db.AutoMigrate(&SkillPurchaseOrder{}, &SkillEntitlement{}); err != nil {
		return fmt.Errorf("AutoMigrate skill purchases: %w", err)
	}
	return nil
}

func HasOneTimeEntitlement(db *gorm.DB, userID int64, skillID string) (bool, error) {
	if db == nil {
		return false, errors.New("db is nil")
	}
	var count int64
	if err := db.Model(&SkillEntitlement{}).
		Where("user_id = ? AND skill_id = ? AND source = ?", userID, skillID, SkillEntitlementSourceOneTimePurchase).
		Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

type OneTimeEntitlementCounter struct{}

func (OneTimeEntitlementCounter) CountOneTimeEntitlements(db *gorm.DB, userID int64) (int64, error) {
	if db == nil {
		return 0, errors.New("db is nil")
	}
	var count int64
	if err := db.Model(&SkillEntitlement{}).
		Where("user_id = ? AND source = ?", userID, SkillEntitlementSourceOneTimePurchase).
		Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}

func PlusUpgradeCreditUSD(db *gorm.DB, userID int64, enabled bool) (float64, error) {
	return pricing.PlusUpgradeCreditUSD(db, OneTimeEntitlementCounter{}, userID, enabled)
}

func GrantOneTimeEntitlement(db *gorm.DB, userID, tenantID int64, skillID, orderID string) error {
	now := time.Now().UTC()
	if db.Dialector.Name() == "mysql" {
		return db.Exec(`
			INSERT INTO skill_entitlements
			  (user_id, tenant_id, skill_id, source, purchase_order_id, granted_at, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			ON DUPLICATE KEY UPDATE updated_at = updated_at`,
			userID, tenantID, skillID, SkillEntitlementSourceOneTimePurchase, orderID, now, now, now,
		).Error
	}
	return db.Exec(`
		INSERT INTO skill_entitlements
		  (user_id, tenant_id, skill_id, source, purchase_order_id, granted_at, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT (user_id, skill_id) DO NOTHING`,
		userID, tenantID, skillID, SkillEntitlementSourceOneTimePurchase, orderID, now, now, now,
	).Error
}

func EmitSkillPurchased(db *gorm.DB, userID int64, skillID string, skillVersionID *string, plan enums.RequiredPlan, amountUSD float64) error {
	success := true
	meta, err := common.Marshal(map[string]any{
		"amount":            amountUSD,
		"currency":          "USD",
		"monetization_type": string(enums.MonetizationTypeOneTime),
		"skill_tier":        string(enums.MonetizationTypeOneTime),
		"user_plan":         string(plan),
		"plus_monthly_usd":  pricing.PlusMonthlyPriceUSD,
	})
	if err != nil {
		return err
	}
	return EmitSkillUsageEvent(db, SkillUsageEvent{
		EventType:      enums.SkillUsageEventTypePurchased,
		UserID:         &userID,
		TenantID:       &userID,
		SkillID:        &skillID,
		SkillVersionID: skillVersionID,
		EntryPoint:     enums.EntryPointSkillDetail,
		Plan:           &plan,
		Success:        &success,
		Metadata:       SkillJSONB(meta),
	})
}
