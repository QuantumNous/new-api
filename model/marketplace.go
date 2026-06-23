package model

import (
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

const (
	MarketplaceModelStatusDraft         = "draft"
	MarketplaceModelStatusPendingReview = "pending_review"
	MarketplaceModelStatusApproved      = "approved"
	MarketplaceModelStatusRejected      = "rejected"
	MarketplaceModelStatusListed        = "listed"
	MarketplaceModelStatusUnlisted      = "unlisted"
	MarketplaceModelStatusDisabled      = "disabled"
)

type ProviderProfile struct {
	Id          int            `json:"id"`
	UserId      int            `json:"user_id" gorm:"not null;uniqueIndex"`
	Name        string         `json:"name" gorm:"size:128;not null;index"`
	Description string         `json:"description,omitempty" gorm:"type:text"`
	Contact     string         `json:"contact,omitempty" gorm:"size:255"`
	Status      string         `json:"status" gorm:"size:32;default:'active';index"`
	CreatedAt   int64          `json:"created_at" gorm:"bigint"`
	UpdatedAt   int64          `json:"updated_at" gorm:"bigint"`
	DeletedAt   gorm.DeletedAt `json:"-" gorm:"index"`
}

type ProviderWallet struct {
	Id                int     `json:"id"`
	ProviderId        int     `json:"provider_id" gorm:"not null;uniqueIndex"`
	Currency          string  `json:"currency" gorm:"size:16;default:'USDT'"`
	Balance           float64 `json:"balance" gorm:"default:0"`
	AvailableBalance  float64 `json:"available_balance" gorm:"default:0"`
	FrozenBalance     float64 `json:"frozen_balance" gorm:"default:0"`
	WalletAddress     string  `json:"wallet_address,omitempty" gorm:"size:255"`
	WalletAddressMask string  `json:"wallet_address_mask,omitempty" gorm:"size:255"`
	CreatedAt         int64   `json:"created_at" gorm:"bigint"`
	UpdatedAt         int64   `json:"updated_at" gorm:"bigint"`
}

type ProviderSettlementConfig struct {
	Id                 int     `json:"id"`
	ProviderId         int     `json:"provider_id" gorm:"not null;uniqueIndex"`
	Currency           string  `json:"currency" gorm:"size:16;default:'USDT'"`
	UsdtRate           float64 `json:"usdt_rate" gorm:"default:1"`
	CommissionRatio    float64 `json:"commission_ratio" gorm:"default:0"`
	MinWithdrawal      float64 `json:"min_withdrawal" gorm:"default:0"`
	WithdrawalFee      float64 `json:"withdrawal_fee" gorm:"default:0"`
	DailyWithdrawalMax float64 `json:"daily_withdrawal_max" gorm:"default:0"`
	CreatedAt          int64   `json:"created_at" gorm:"bigint"`
	UpdatedAt          int64   `json:"updated_at" gorm:"bigint"`
}

type MarketplaceModel struct {
	Id            int              `json:"id"`
	ProviderId    int              `json:"provider_id" gorm:"not null;index"`
	Name          string           `json:"name" gorm:"size:128;not null;index"`
	Description   string           `json:"description,omitempty" gorm:"type:text"`
	ModelType     string           `json:"model_type,omitempty" gorm:"size:64;index"`
	Tags          string           `json:"tags,omitempty" gorm:"type:text"`
	ContextLength int              `json:"context_length" gorm:"default:0"`
	BillingType   string           `json:"billing_type,omitempty" gorm:"size:32"`
	Status        string           `json:"status" gorm:"size:32;default:'draft';index"`
	Recommended   bool             `json:"recommended" gorm:"index"`
	SortOrder     int              `json:"sort_order" gorm:"default:0;index"`
	CreatedAt     int64            `json:"created_at" gorm:"bigint"`
	UpdatedAt     int64            `json:"updated_at" gorm:"bigint"`
	DeletedAt     gorm.DeletedAt   `json:"-" gorm:"index"`
	Provider      *ProviderProfile `json:"provider,omitempty" gorm:"-"`
}

type ModelApiConfig struct {
	Id             int    `json:"id"`
	ModelId        int    `json:"model_id" gorm:"not null;index"`
	BaseUrl        string `json:"base_url" gorm:"type:text"`
	Protocol       string `json:"protocol" gorm:"size:64;default:'openai'"`
	AuthType       string `json:"auth_type" gorm:"size:64;default:'bearer'"`
	ModelMapping   string `json:"model_mapping,omitempty" gorm:"type:text"`
	RequestFormat  string `json:"request_format,omitempty" gorm:"type:text"`
	ResponseFormat string `json:"response_format,omitempty" gorm:"type:text"`
	Status         string `json:"status" gorm:"size:32;default:'active';index"`
	CreatedAt      int64  `json:"created_at" gorm:"bigint"`
	UpdatedAt      int64  `json:"updated_at" gorm:"bigint"`
}

type ModelKey struct {
	Id            int    `json:"id"`
	ModelId       int    `json:"model_id" gorm:"not null;index"`
	Name          string `json:"name" gorm:"size:128;not null"`
	KeyCipher     string `json:"-" gorm:"type:text;column:key_cipher;not null"`
	KeyMask       string `json:"key_mask" gorm:"size:64"`
	Status        string `json:"status" gorm:"size:32;default:'active';index"`
	LastCheckedAt int64  `json:"last_checked_at" gorm:"bigint;default:0"`
	CreatedAt     int64  `json:"created_at" gorm:"bigint"`
	UpdatedAt     int64  `json:"updated_at" gorm:"bigint"`
}

type ModelPricing struct {
	Id          int     `json:"id"`
	ModelId     int     `json:"model_id" gorm:"not null;index"`
	InputPrice  float64 `json:"input_price" gorm:"default:0"`
	OutputPrice float64 `json:"output_price" gorm:"default:0"`
	CallPrice   float64 `json:"call_price" gorm:"default:0"`
	Currency    string  `json:"currency" gorm:"size:16;default:'USD'"`
	PricingType string  `json:"pricing_type" gorm:"size:32;default:'token'"`
	Status      string  `json:"status" gorm:"size:32;default:'draft';index"`
	EffectiveAt int64   `json:"effective_at" gorm:"bigint;default:0"`
	CreatedAt   int64   `json:"created_at" gorm:"bigint"`
	UpdatedAt   int64   `json:"updated_at" gorm:"bigint"`
}

type ModelReviewRecord struct {
	Id         int    `json:"id"`
	ModelId    int    `json:"model_id" gorm:"not null;index"`
	ReviewerId int    `json:"reviewer_id" gorm:"index"`
	Action     string `json:"action" gorm:"size:64;not null"`
	Comment    string `json:"comment,omitempty" gorm:"type:text"`
	CreatedAt  int64  `json:"created_at" gorm:"bigint"`
}

type MarketplaceModelDetail struct {
	MarketplaceModel
	ApiConfigs []ModelApiConfig          `json:"api_configs"`
	Keys       []ModelKey                `json:"keys"`
	Pricing    []ModelPricing            `json:"pricing"`
	Reviews    []ModelReviewRecord       `json:"reviews"`
	Wallet     *ProviderWallet           `json:"wallet,omitempty"`
	Settlement *ProviderSettlementConfig `json:"settlement,omitempty"`
}

func (profile *ProviderProfile) BeforeCreate(_ *gorm.DB) error {
	now := common.GetTimestamp()
	profile.CreatedAt = now
	profile.UpdatedAt = now
	return nil
}

func (profile *ProviderProfile) BeforeUpdate(_ *gorm.DB) error {
	profile.UpdatedAt = common.GetTimestamp()
	return nil
}

func (wallet *ProviderWallet) BeforeCreate(_ *gorm.DB) error {
	now := common.GetTimestamp()
	wallet.CreatedAt = now
	wallet.UpdatedAt = now
	if wallet.Currency == "" {
		wallet.Currency = "USDT"
	}
	wallet.WalletAddressMask = common.MaskSecret(wallet.WalletAddress)
	return nil
}

func (wallet *ProviderWallet) BeforeUpdate(_ *gorm.DB) error {
	wallet.UpdatedAt = common.GetTimestamp()
	wallet.WalletAddressMask = common.MaskSecret(wallet.WalletAddress)
	return nil
}

func (config *ProviderSettlementConfig) BeforeCreate(_ *gorm.DB) error {
	now := common.GetTimestamp()
	config.CreatedAt = now
	config.UpdatedAt = now
	if config.Currency == "" {
		config.Currency = "USDT"
	}
	if config.UsdtRate == 0 {
		config.UsdtRate = 1
	}
	return nil
}

func (config *ProviderSettlementConfig) BeforeUpdate(_ *gorm.DB) error {
	config.UpdatedAt = common.GetTimestamp()
	return nil
}

func (m *MarketplaceModel) BeforeCreate(_ *gorm.DB) error {
	now := common.GetTimestamp()
	m.CreatedAt = now
	m.UpdatedAt = now
	if m.Status == "" {
		m.Status = MarketplaceModelStatusDraft
	}
	return nil
}

func (m *MarketplaceModel) BeforeUpdate(_ *gorm.DB) error {
	m.UpdatedAt = common.GetTimestamp()
	return nil
}

func (config *ModelApiConfig) BeforeCreate(_ *gorm.DB) error {
	now := common.GetTimestamp()
	config.CreatedAt = now
	config.UpdatedAt = now
	if config.Protocol == "" {
		config.Protocol = "openai"
	}
	if config.AuthType == "" {
		config.AuthType = "bearer"
	}
	if config.Status == "" {
		config.Status = "active"
	}
	return nil
}

func (config *ModelApiConfig) BeforeUpdate(_ *gorm.DB) error {
	config.UpdatedAt = common.GetTimestamp()
	return nil
}

func (key *ModelKey) BeforeCreate(_ *gorm.DB) error {
	now := common.GetTimestamp()
	key.CreatedAt = now
	key.UpdatedAt = now
	if key.Status == "" {
		key.Status = "active"
	}
	return nil
}

func (key *ModelKey) BeforeUpdate(_ *gorm.DB) error {
	key.UpdatedAt = common.GetTimestamp()
	return nil
}

func (pricing *ModelPricing) BeforeCreate(_ *gorm.DB) error {
	now := common.GetTimestamp()
	pricing.CreatedAt = now
	pricing.UpdatedAt = now
	if pricing.Currency == "" {
		pricing.Currency = "USD"
	}
	if pricing.PricingType == "" {
		pricing.PricingType = "token"
	}
	if pricing.Status == "" {
		pricing.Status = "draft"
	}
	return nil
}

func (pricing *ModelPricing) BeforeUpdate(_ *gorm.DB) error {
	pricing.UpdatedAt = common.GetTimestamp()
	return nil
}

func (record *ModelReviewRecord) BeforeCreate(_ *gorm.DB) error {
	record.CreatedAt = common.GetTimestamp()
	return nil
}

func SetModelKeyPlaintext(key *ModelKey, plaintext string) error {
	plaintext = strings.TrimSpace(plaintext)
	if plaintext == "" {
		return errors.New("model key is required")
	}
	ciphertext, err := common.EncryptModelKey(plaintext)
	if err != nil {
		return err
	}
	key.KeyCipher = ciphertext
	key.KeyMask = common.MaskSecret(plaintext)
	return nil
}

func GetProviderProfileByUserId(userId int) (*ProviderProfile, error) {
	var profile ProviderProfile
	if err := DB.Where("user_id = ?", userId).First(&profile).Error; err != nil {
		return nil, err
	}
	return &profile, nil
}

func EnsureProviderFinancialRows(providerId int) error {
	now := common.GetTimestamp()
	wallet := ProviderWallet{ProviderId: providerId, Currency: "USDT", CreatedAt: now, UpdatedAt: now}
	if err := DB.Where("provider_id = ?", providerId).FirstOrCreate(&wallet).Error; err != nil {
		return err
	}
	settlement := ProviderSettlementConfig{ProviderId: providerId, Currency: "USDT", UsdtRate: 1, CreatedAt: now, UpdatedAt: now}
	return DB.Where("provider_id = ?", providerId).FirstOrCreate(&settlement).Error
}

func ProviderOwnsModel(providerId int, modelId int) (bool, error) {
	var count int64
	err := DB.Model(&MarketplaceModel{}).Where("id = ? AND provider_id = ?", modelId, providerId).Count(&count).Error
	return count > 0, err
}

func ListProviderProfiles(keyword string, offset int, limit int) ([]ProviderProfile, int64, error) {
	query := DB.Model(&ProviderProfile{})
	if keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where("name LIKE ? OR contact LIKE ? OR description LIKE ?", like, like, like)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var profiles []ProviderProfile
	err := query.Order("id desc").Offset(offset).Limit(limit).Find(&profiles).Error
	return profiles, total, err
}

func ListMarketplaceModels(keyword string, providerId int, listedOnly bool, offset int, limit int) ([]MarketplaceModel, int64, error) {
	query := DB.Model(&MarketplaceModel{})
	if keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where("name LIKE ? OR description LIKE ? OR tags LIKE ?", like, like, like)
	}
	if providerId > 0 {
		query = query.Where("provider_id = ?", providerId)
	}
	if listedOnly {
		query = query.Where("status = ?", MarketplaceModelStatusListed)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var models []MarketplaceModel
	if err := query.Order("sort_order desc, id desc").Offset(offset).Limit(limit).Find(&models).Error; err != nil {
		return nil, 0, err
	}
	if len(models) == 0 {
		return models, total, nil
	}
	providerIds := make([]int, 0, len(models))
	for _, item := range models {
		providerIds = append(providerIds, item.ProviderId)
	}
	var providers []ProviderProfile
	if err := DB.Where("id IN ?", providerIds).Find(&providers).Error; err != nil {
		return nil, 0, err
	}
	providerMap := map[int]*ProviderProfile{}
	for i := range providers {
		provider := providers[i]
		providerMap[provider.Id] = &provider
	}
	for i := range models {
		models[i].Provider = providerMap[models[i].ProviderId]
	}
	return models, total, nil
}

func GetMarketplaceModelDetail(id int) (*MarketplaceModelDetail, error) {
	var item MarketplaceModel
	if err := DB.First(&item, id).Error; err != nil {
		return nil, err
	}
	detail := MarketplaceModelDetail{MarketplaceModel: item}
	var provider ProviderProfile
	if err := DB.First(&provider, item.ProviderId).Error; err == nil {
		detail.Provider = &provider
	}
	DB.Where("model_id = ?", id).Order("id desc").Find(&detail.ApiConfigs)
	DB.Where("model_id = ?", id).Order("id desc").Find(&detail.Keys)
	DB.Where("model_id = ?", id).Order("id desc").Find(&detail.Pricing)
	DB.Where("model_id = ?", id).Order("id desc").Find(&detail.Reviews)
	var wallet ProviderWallet
	if err := DB.Where("provider_id = ?", item.ProviderId).First(&wallet).Error; err == nil {
		detail.Wallet = &wallet
	}
	var settlement ProviderSettlementConfig
	if err := DB.Where("provider_id = ?", item.ProviderId).First(&settlement).Error; err == nil {
		detail.Settlement = &settlement
	}
	return &detail, nil
}
