package model

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/samber/hot"
	"gorm.io/gorm"
)

const (
	PartnerTenantStatusEnabled  = 1
	PartnerTenantStatusDisabled = 2
)

var ErrPartnerTenantNotFound = errors.New("partner tenant not found")
var ErrPartnerTenantAccountDisabled = errors.New("partner tenant account disabled")
var ErrPartnerTenantCredentialUnavailable = errors.New("partner tenant credential unavailable")
var ErrPartnerTenantPlanNotFound = errors.New("partner tenant plan not found")
var ErrPartnerTenantIdempotencyConflict = errors.New("partner tenant idempotency key conflict")

// Account membership is immutable through the partner API. Cache both members
// and non-members, but always read plan rates and validity from the database.
var partnerTenantMembershipCache = hot.NewHotCache[int, bool](hot.LRU, 10000).
	WithTTL(time.Minute).
	Build()

type PartnerTenant struct {
	Id         int64  `json:"id" gorm:"primaryKey"`
	Name       string `json:"name" gorm:"type:varchar(64);not null"`
	Group      string `json:"group" gorm:"type:varchar(64);not null;uniqueIndex"`
	SecretHash string `json:"-" gorm:"type:char(64);not null;uniqueIndex"`
	Status     int    `json:"status" gorm:"not null;default:1"`
	CreatedAt  int64  `json:"created_at" gorm:"type:bigint"`
	UpdatedAt  int64  `json:"updated_at" gorm:"type:bigint"`
}

func (PartnerTenant) TableName() string { return "partner_tenants" }

type PartnerTenantAccount struct {
	Id             int64  `json:"id" gorm:"primaryKey"`
	TenantId       int64  `json:"tenant_id" gorm:"not null;uniqueIndex:idx_partner_tenant_external_user,priority:1"`
	ExternalUserId string `json:"external_user_id" gorm:"type:varchar(128);not null;uniqueIndex:idx_partner_tenant_external_user,priority:2"`
	UserId         int    `json:"user_id" gorm:"not null;uniqueIndex"`
	TokenId        int    `json:"token_id" gorm:"not null;uniqueIndex"`
	Status         int    `json:"status" gorm:"not null;default:1"`
	CreatedAt      int64  `json:"created_at" gorm:"type:bigint"`
	UpdatedAt      int64  `json:"updated_at" gorm:"type:bigint"`
}

func (PartnerTenantAccount) TableName() string { return "partner_tenant_accounts" }

type PartnerTenantSubscriptionGrant struct {
	Id                 int64  `json:"id" gorm:"primaryKey"`
	TenantId           int64  `json:"tenant_id" gorm:"not null;uniqueIndex:idx_partner_tenant_idempotency,priority:1"`
	IdempotencyHash    string `json:"-" gorm:"type:char(64);not null;uniqueIndex:idx_partner_tenant_idempotency,priority:2"`
	RequestHash        string `json:"-" gorm:"type:char(64);not null"`
	ExternalUserId     string `json:"external_user_id" gorm:"type:varchar(128);not null"`
	PlanId             int    `json:"plan_id" gorm:"not null"`
	UserSubscriptionId int    `json:"user_subscription_id" gorm:"not null;index"`
	CreatedAt          int64  `json:"created_at" gorm:"type:bigint"`
}

func (PartnerTenantSubscriptionGrant) TableName() string { return "partner_tenant_subscription_grants" }

func isPartnerTenantUser(userID int) (bool, error) {
	if member, found, err := partnerTenantMembershipCache.Get(userID); err == nil && found {
		return member, nil
	}
	var account PartnerTenantAccount
	result := DB.Select("user_id").Where("user_id = ?", userID).Limit(1).Find(&account)
	if result.Error != nil {
		return false, result.Error
	}
	member := result.RowsAffected > 0
	partnerTenantMembershipCache.Set(userID, member)
	return member, nil
}

// GetPartnerUserPlanRateLimit returns the highest configured limit for an active plan.
func GetPartnerUserPlanRateLimit(userID int, group string) (int, error) {
	if DB == nil {
		return 0, errors.New("database is not initialized")
	}
	member, err := isPartnerTenantUser(userID)
	if err != nil || !member {
		return 0, err
	}
	var limit int
	now := GetDBTimestamp()
	err = DB.Table("user_subscriptions AS s").
		Select("COALESCE(MAX(p.requests_per_minute), 0)").
		Joins("JOIN subscription_plans AS p ON p.id = s.plan_id").
		Where("s.user_id = ? AND s.status = ? AND s.start_time <= ? AND s.end_time > ?", userID, "active", now, now).
		Where("p.partner_tenant_id > 0 AND p.applicable_group = ?", group).
		Scan(&limit).Error
	return limit, err
}

func CreatePartnerTenant(name, group string) (*PartnerTenant, string, error) {
	secretPart, err := common.GenerateRandomCharsKey(48)
	if err != nil {
		return nil, "", err
	}
	secret := "pt_" + secretPart
	now := common.GetTimestamp()
	tenant := &PartnerTenant{
		Name:       name,
		Group:      group,
		SecretHash: HashPartnerOAuthSecret(secret),
		Status:     PartnerTenantStatusEnabled,
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	if err := DB.Create(tenant).Error; err != nil {
		return nil, "", err
	}
	return tenant, secret, nil
}

func FindPartnerTenantBySecret(secret string) (*PartnerTenant, error) {
	hash := HashPartnerOAuthSecret(secret)
	var tenant PartnerTenant
	if err := DB.Where("secret_hash = ?", hash).First(&tenant).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrPartnerTenantNotFound
		}
		return nil, err
	}
	if !hmac.Equal([]byte(tenant.SecretHash), []byte(hash)) {
		return nil, ErrPartnerTenantNotFound
	}
	return &tenant, nil
}

func GetPartnerTenantById(id int64) (*PartnerTenant, error) {
	var tenant PartnerTenant
	if err := DB.First(&tenant, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrPartnerTenantNotFound
		}
		return nil, err
	}
	return &tenant, nil
}

func ListPartnerTenants() ([]PartnerTenant, error) {
	tenants := make([]PartnerTenant, 0)
	err := DB.Order("id desc").Find(&tenants).Error
	return tenants, err
}

func RotatePartnerTenantSecret(id int64) (string, error) {
	secretPart, err := common.GenerateRandomCharsKey(48)
	if err != nil {
		return "", err
	}
	secret := "pt_" + secretPart
	result := DB.Model(&PartnerTenant{}).Where("id = ?", id).Updates(map[string]any{
		"secret_hash": HashPartnerOAuthSecret(secret),
		"updated_at":  common.GetTimestamp(),
	})
	if result.Error != nil {
		return "", result.Error
	}
	if result.RowsAffected == 0 {
		return "", ErrPartnerTenantNotFound
	}
	return secret, nil
}

func UpdatePartnerTenantStatus(id int64, status int) error {
	result := DB.Model(&PartnerTenant{}).Where("id = ?", id).Updates(map[string]any{
		"status":     status,
		"updated_at": common.GetTimestamp(),
	})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrPartnerTenantNotFound
	}
	return nil
}

func GetPartnerTenantAccount(tenantId int64, externalUserId string) (*PartnerTenantAccount, error) {
	var account PartnerTenantAccount
	result := DB.Where("tenant_id = ? AND external_user_id = ? AND status = ?", tenantId, externalUserId, PartnerTenantStatusEnabled).Limit(1).Find(&account)
	if result.Error != nil {
		return nil, result.Error
	}
	if result.RowsAffected == 0 {
		return nil, gorm.ErrRecordNotFound
	}
	return &account, nil
}

type PartnerTenantProvisionedAccount struct {
	ExternalUserId string
	APIKey         string
	Created        bool
}

func IsValidPartnerTenantExternalUserID(externalUserID string) bool {
	return externalUserID != "" && utf8.ValidString(externalUserID) &&
		utf8.RuneCountInString(externalUserID) <= 128 &&
		!strings.ContainsFunc(externalUserID, unicode.IsControl)
}

func ProvisionPartnerTenantAccount(tenantId int64, externalUserId, displayName string) (*PartnerTenantProvisionedAccount, error) {
	externalUserId = strings.TrimSpace(externalUserId)
	if tenantId <= 0 || !IsValidPartnerTenantExternalUserID(externalUserId) {
		return nil, errors.New("invalid partner tenant account")
	}
	result := &PartnerTenantProvisionedAccount{ExternalUserId: externalUserId}
	var accountUserID int
	err := DB.Transaction(func(tx *gorm.DB) error {
		var tenant PartnerTenant
		if err := lockForUpdate(tx).Where("id = ? AND status = ?", tenantId, PartnerTenantStatusEnabled).First(&tenant).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrPartnerTenantNotFound
			}
			return err
		}
		var account PartnerTenantAccount
		accountQuery := tx.Where("tenant_id = ? AND external_user_id = ?", tenantId, externalUserId).Limit(1).Find(&account)
		if accountQuery.Error != nil {
			return accountQuery.Error
		}
		if accountQuery.RowsAffected > 0 {
			if account.Status != PartnerTenantStatusEnabled {
				return ErrPartnerTenantAccountDisabled
			}
			var token Token
			if err := tx.Where("id = ? AND user_id = ?", account.TokenId, account.UserId).First(&token).Error; err != nil || token.Status != common.TokenStatusEnabled {
				return ErrPartnerTenantCredentialUnavailable
			}
			result.APIKey = "sk-" + token.Key
			accountUserID = account.UserId
			return nil
		}

		usernameSuffix, err := common.GenerateRandomCharsKey(12)
		if err != nil {
			return err
		}
		rawPassword, err := common.GenerateRandomCharsKey(48)
		if err != nil {
			return err
		}
		password, err := common.HashAccountPassword(rawPassword)
		if err != nil {
			return err
		}
		affCode, err := common.GenerateRandomCharsKey(12)
		if err != nil {
			return err
		}
		if displayName == "" {
			displayName = externalUserId
		}
		if runes := []rune(displayName); len(runes) > 20 {
			displayName = string(runes[:20])
		}
		user := &User{
			Username:    "p_" + usernameSuffix,
			Password:    password,
			DisplayName: displayName,
			Role:        common.RoleCommonUser,
			Status:      common.UserStatusEnabled,
			Group:       tenant.Group,
			Quota:       0,
			UsedQuota:   0,
			AffCode:     affCode,
			AuthVersion: 1,
		}
		if err := tx.Create(user).Error; err != nil {
			return err
		}
		apiKey, err := common.GenerateKey()
		if err != nil {
			return err
		}
		now := common.GetTimestamp()
		token := &Token{
			UserId:         user.Id,
			Key:            apiKey,
			Status:         common.TokenStatusEnabled,
			Name:           tenant.Name + " subscription account",
			CreatedTime:    now,
			AccessedTime:   now,
			ExpiredTime:    -1,
			UnlimitedQuota: true,
			Group:          tenant.Group,
		}
		if err := tx.Create(token).Error; err != nil {
			return err
		}
		account = PartnerTenantAccount{
			TenantId:       tenant.Id,
			ExternalUserId: externalUserId,
			UserId:         user.Id,
			TokenId:        token.Id,
			Status:         PartnerTenantStatusEnabled,
		}
		if err := CreatePartnerTenantAccountWithTx(tx, &account); err != nil {
			return err
		}
		result.APIKey = "sk-" + apiKey
		result.Created = true
		accountUserID = user.Id
		return nil
	})
	if err != nil {
		return nil, err
	}
	// Publish membership only after the user and account transaction commits.
	partnerTenantMembershipCache.Set(accountUserID, true)
	return result, nil
}

func CreatePartnerTenantAccountWithTx(tx *gorm.DB, account *PartnerTenantAccount) error {
	if tx == nil || account == nil || account.TenantId <= 0 || account.UserId <= 0 || account.TokenId <= 0 || account.ExternalUserId == "" {
		return errors.New("invalid partner tenant account")
	}
	now := common.GetTimestamp()
	account.CreatedAt = now
	account.UpdatedAt = now
	return tx.Create(account).Error
}

func PartnerTenantSubscriptionRequestHash(externalUserId string, planId int) string {
	sum := sha256.Sum256([]byte(fmt.Sprintf("%s\x00%d", externalUserId, planId)))
	return hex.EncodeToString(sum[:])
}

func GrantPartnerTenantSubscription(tenantId int64, externalUserId string, planId int, idempotencyHash, requestHash string) (*UserSubscription, bool, error) {
	var subscription *UserSubscription
	var created bool
	err := DB.Transaction(func(tx *gorm.DB) error {
		var tenant PartnerTenant
		tenantQuery := lockForUpdate(tx).Where("id = ? AND status = ?", tenantId, PartnerTenantStatusEnabled).Limit(1).Find(&tenant)
		if tenantQuery.Error != nil {
			return tenantQuery.Error
		}
		if tenantQuery.RowsAffected == 0 {
			return ErrPartnerTenantNotFound
		}

		var prior PartnerTenantSubscriptionGrant
		priorQuery := tx.Where("tenant_id = ? AND idempotency_hash = ?", tenantId, idempotencyHash).Limit(1).Find(&prior)
		if priorQuery.Error != nil {
			return priorQuery.Error
		}
		if priorQuery.RowsAffected > 0 {
			if prior.RequestHash != requestHash {
				return ErrPartnerTenantIdempotencyConflict
			}
			var existing UserSubscription
			if err := tx.Where("id = ?", prior.UserSubscriptionId).First(&existing).Error; err != nil {
				return err
			}
			subscription = &existing
			return nil
		}

		var account PartnerTenantAccount
		accountQuery := lockForUpdate(tx).Where("tenant_id = ? AND external_user_id = ? AND status = ?", tenantId, externalUserId, PartnerTenantStatusEnabled).Limit(1).Find(&account)
		if accountQuery.Error != nil {
			return accountQuery.Error
		}
		if accountQuery.RowsAffected == 0 {
			return gorm.ErrRecordNotFound
		}
		var user User
		if err := tx.Select("id", "group").Where("id = ?", account.UserId).First(&user).Error; err != nil {
			return err
		}
		if user.Group != tenant.Group {
			return ErrPartnerTenantNotFound
		}

		var plan SubscriptionPlan
		planQuery := tx.Where("id = ? AND partner_tenant_id = ? AND enabled = ?", planId, tenantId, true).Limit(1).Find(&plan)
		if planQuery.Error != nil {
			return planQuery.Error
		}
		if planQuery.RowsAffected == 0 || plan.DurationUnit != SubscriptionDurationMonth || plan.DurationValue != 1 ||
			plan.QuotaResetPeriod != SubscriptionResetMonthly || plan.TotalAmount < 0 || plan.ApplicableGroup != tenant.Group ||
			plan.AllowWalletOverflow == nil || *plan.AllowWalletOverflow {
			return ErrPartnerTenantPlanNotFound
		}

		now := getDBTimestampOn(tx)
		var activeSubscription UserSubscription
		activeQuery := lockForUpdate(tx).
			Where("user_id = ? AND plan_id = ? AND status = ? AND end_time > ?", account.UserId, plan.Id, "active", now).
			Order("end_time desc, id desc").Limit(1).Find(&activeSubscription)
		if activeQuery.Error != nil {
			return activeQuery.Error
		}
		createdSubscription := &activeSubscription
		if activeQuery.RowsAffected > 0 {
			if err := maybeResetUserSubscriptionWithPlanTx(tx, createdSubscription, &plan, now); err != nil {
				return err
			}
			newEndTime, err := calcPlanEndTime(time.Unix(createdSubscription.EndTime, 0), &plan)
			if err != nil {
				return err
			}
			createdSubscription.EndTime = newEndTime
			if createdSubscription.NextResetTime == 0 {
				base := time.Unix(now, 0)
				createdSubscription.LastResetTime = now
				createdSubscription.NextResetTime = calcNextResetTime(base, &plan, newEndTime)
			}
			createdSubscription.UpdatedAt = common.GetTimestamp()
			if err := tx.Save(createdSubscription).Error; err != nil {
				return err
			}
		} else {
			newSubscription, createErr := CreateUserSubscriptionFromPlanTx(tx, account.UserId, &plan, SubscriptionSourcePartner)
			if createErr != nil {
				return createErr
			}
			createdSubscription = newSubscription
		}
		grant := &PartnerTenantSubscriptionGrant{
			TenantId:           tenantId,
			IdempotencyHash:    idempotencyHash,
			RequestHash:        requestHash,
			ExternalUserId:     externalUserId,
			PlanId:             planId,
			UserSubscriptionId: createdSubscription.Id,
			CreatedAt:          common.GetTimestamp(),
		}
		if err := tx.Create(grant).Error; err != nil {
			return err
		}
		subscription = createdSubscription
		created = activeQuery.RowsAffected == 0
		return nil
	})
	if err != nil {
		return nil, false, err
	}
	return subscription, created, nil
}
