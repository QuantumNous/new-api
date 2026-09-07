package model

import (
	"errors"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

const AgentImageModel = "gpt-image-2"
const AgentMinimumPriceCents = 2
const AgentMaximumPriceCents = 6

var ErrAgentForbidden = errors.New("Agent access is not enabled")
var ErrAgentPriceRange = errors.New("Image price must be between 0.02 and 0.06 CNY")
var ErrAgentConflict = errors.New("Agent settings changed; reload before saving")

// Agent permission is independent of User.Role: enabling it grants no admin access.
type AgentProfile struct {
	UserID               int   `json:"user_id" gorm:"primaryKey;autoIncrement:false"`
	Enabled              bool  `json:"enabled"`
	PriceCents           int   `json:"price_cents"`
	Version              int64 `json:"version"`
	UpdatedAt            int64 `json:"updated_at"`
	CustomerPricesLocked bool  `json:"-"`
}

type AgentPriceChange struct {
	ID            int64 `json:"id" gorm:"primaryKey"`
	AgentID       int   `json:"agent_id" gorm:"index"`
	OperatorID    int   `json:"operator_id"`
	OldEnabled    bool  `json:"old_enabled"`
	NewEnabled    bool  `json:"new_enabled"`
	OldPriceCents int   `json:"old_price_cents"`
	NewPriceCents int   `json:"new_price_cents"`
	Version       int64 `json:"version"`
	CreatedAt     int64 `json:"created_at"`
}

func GetAgentProfile(userID int) (*AgentProfile, error) {
	profile := &AgentProfile{UserID: userID, PriceCents: AgentMaximumPriceCents}
	err := DB.Where("user_id = ?", userID).Limit(1).Find(profile).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return profile, nil
	}
	return profile, err
}

func UpdateAgentProfile(agentID, operatorID, priceCents int, enabled bool, version int64, requireEnabled bool) (*AgentProfile, error) {
	if priceCents < AgentMinimumPriceCents || priceCents > AgentMaximumPriceCents {
		return nil, ErrAgentPriceRange
	}
	var result *AgentProfile
	err := DB.Transaction(func(tx *gorm.DB) error {
		var user User
		if err := tx.Select("id", "status", "aff_code").First(&user, agentID).Error; err != nil {
			return err
		}
		if enabled && user.Status != common.UserStatusEnabled {
			return ErrAgentForbidden
		}
		if enabled && user.AffCode == "" {
			if err := tx.Model(&User{}).Where("id = ?", agentID).Update("aff_code", common.GetRandomString(8)).Error; err != nil {
				return err
			}
		}
		profile := AgentProfile{UserID: agentID, PriceCents: AgentMaximumPriceCents}
		err := lockForUpdate(tx).Where("user_id = ?", agentID).First(&profile).Error
		exists := err == nil
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		if requireEnabled && (!profile.Enabled || operatorID != agentID) {
			return ErrAgentForbidden
		}
		if profile.Version != version {
			return ErrAgentConflict
		}
		change := AgentPriceChange{AgentID: agentID, OperatorID: operatorID, OldEnabled: profile.Enabled, NewEnabled: enabled, OldPriceCents: profile.PriceCents, NewPriceCents: priceCents, Version: version + 1, CreatedAt: time.Now().Unix()}
		profile.Enabled, profile.PriceCents, profile.Version, profile.UpdatedAt = enabled, priceCents, version+1, change.CreatedAt
		if !exists {
			if err := tx.Create(&profile).Error; err != nil {
				return err
			}
		} else {
			update := tx.Model(&AgentProfile{}).Where("user_id = ? AND version = ?", agentID, version).Updates(map[string]any{"enabled": enabled, "price_cents": priceCents, "version": profile.Version, "updated_at": profile.UpdatedAt})
			if update.Error != nil {
				return update.Error
			}
			if update.RowsAffected != 1 {
				return ErrAgentConflict
			}
		}
		if err := tx.Create(&change).Error; err != nil {
			return err
		}
		if enabled && (!change.OldEnabled || !profile.CustomerPricesLocked) {
			if err := lockHistoricalAgentPrices(tx, &profile); err != nil {
				return err
			}
			profile.CustomerPricesLocked = true
		}
		result = &profile
		return nil
	})
	return result, err
}

// Reuse the server-controlled direct inviter relationship. Enabling an agent
// automatically includes both historical and future direct invitees, never descendants.
func AgentForCustomer(customerID int) (*AgentProfile, error) {
	var profile AgentProfile
	// An enabled agent uses their own configured price, even without an inviter.
	// Customer invitation prices remain independently locked in the branch below.
	self := DB.Table("agent_profiles AS ap").Select("ap.user_id, ap.enabled, ap.version, ap.price_cents").Joins("JOIN users AS owner ON owner.id = ap.user_id").Where("ap.user_id = ? AND owner.deleted_at IS NULL AND owner.status = ? AND ap.enabled = ?", customerID, common.UserStatusEnabled, true).Limit(1).Find(&profile)
	if self.Error != nil {
		return nil, self.Error
	}
	if self.RowsAffected != 0 {
		return &profile, nil
	}
	result := DB.Table("agent_profiles AS ap").Select("ap.user_id, ap.enabled, ap.version, cp.price_cents").Joins("JOIN agent_customer_prices AS cp ON cp.agent_id = ap.user_id").Joins("JOIN users AS owner ON owner.id = ap.user_id").Joins("JOIN users AS customer ON customer.inviter_id = ap.user_id AND customer.id = cp.customer_id").Where("customer.id = ? AND customer.deleted_at IS NULL AND owner.deleted_at IS NULL AND owner.status = ? AND ap.enabled = ?", customerID, common.UserStatusEnabled, true).Limit(1).Find(&profile)
	if result.Error != nil {
		return nil, result.Error
	}
	if result.RowsAffected == 0 {
		return nil, nil
	}
	return &profile, nil
}

type AgentCustomer struct {
	ID          int    `json:"id"`
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
	CreatedAt   int64  `json:"created_at"`
	PriceCents  *int   `json:"price_cents"`
}
type AgentTopUpTotal struct {
	UserID          int     `json:"user_id,omitempty"`
	PaymentProvider string  `json:"payment_provider"`
	PaymentMethod   string  `json:"payment_method"`
	Money           float64 `json:"money"`
}

func AgentCustomers(agentID, offset, limit int) ([]AgentCustomer, int64, []AgentTopUpTotal, error) {
	customers := []AgentCustomer{}
	totals := []AgentTopUpTotal{}
	var count int64
	query := DB.Model(&User{}).Where("inviter_id = ?", agentID)
	if err := query.Count(&count).Error; err != nil {
		return nil, 0, nil, err
	}
	if err := query.Select("users.id, users.username, users.display_name, users.created_at, cp.price_cents").Joins("LEFT JOIN agent_customer_prices AS cp ON cp.customer_id = users.id AND cp.agent_id = users.inviter_id").Order("users.id DESC").Offset(offset).Limit(limit).Find(&customers).Error; err != nil {
		return nil, 0, nil, err
	}
	ids := []int{}
	for _, customer := range customers {
		ids = append(ids, customer.ID)
	}
	if len(ids) > 0 {
		if err := DB.Model(&TopUp{}).Select("user_id,payment_provider,payment_method,SUM(money) AS money").Where("user_id IN ? AND status = ? AND payment_method <> ?", ids, common.TopUpStatusSuccess, PaymentMethodBalance).Group("user_id,payment_provider,payment_method").Scan(&totals).Error; err != nil {
			return nil, 0, nil, err
		}
	}
	return customers, count, totals, nil
}

func AgentTopUpSummary(agentID int) ([]AgentTopUpTotal, int64, error) {
	totals := []AgentTopUpTotal{}
	var paying int64
	users := DB.Model(&User{}).Select("id").Where("inviter_id = ?", agentID)
	query := DB.Model(&TopUp{}).Where("user_id IN (?) AND status = ? AND payment_method <> ?", users, common.TopUpStatusSuccess, PaymentMethodBalance)
	if err := query.Distinct("user_id").Count(&paying).Error; err != nil {
		return nil, 0, err
	}
	err := query.Select("payment_provider,payment_method,SUM(money) AS money").Group("payment_provider,payment_method").Scan(&totals).Error
	return totals, paying, err
}

func AgentCustomerTopUps(agentID, customerID, offset, limit int) ([]TopUp, int64, error) {
	var count int64
	items := []TopUp{}
	if err := DB.Model(&User{}).Where("id = ? AND inviter_id = ?", customerID, agentID).Count(&count).Error; err != nil {
		return nil, 0, err
	}
	if count != 1 {
		return nil, 0, gorm.ErrRecordNotFound
	}
	query := DB.Model(&TopUp{}).Where("user_id = ? AND status = ? AND payment_method <> ?", customerID, common.TopUpStatusSuccess, PaymentMethodBalance)
	if err := query.Count(&count).Error; err != nil {
		return nil, 0, err
	}
	err := query.Select("id", "user_id", "money", "payment_method", "payment_provider", "complete_time", "status").Order("id DESC").Offset(offset).Limit(limit).Find(&items).Error
	return items, count, err
}
