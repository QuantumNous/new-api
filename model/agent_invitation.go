package model

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const AgentInvitationTTL = int64(2 * 60 * 60)
const AgentInvitationLimit = 20

var ErrAgentInvitationExpired = errors.New("Registration link is invalid or expired. Ask your agent for a new link.")
var ErrAgentInvitationLimit = errors.New("Too many active registration links. Reuse an existing link or wait for it to expire.")

// An invitation is an immutable offer; its expiry only limits new registrations.
type AgentInvitation struct {
	Token      string `json:"token" gorm:"type:varchar(64);primaryKey"`
	AgentID    int    `json:"-" gorm:"index"`
	PriceCents int    `json:"price_cents"`
	CreatedAt  int64  `json:"created_at"`
	ExpiresAt  int64  `json:"expires_at" gorm:"index"`
}

// Customer prices outlive the registration link and are never repriced when
// an agent creates another link or changes their historical default price.
type AgentCustomerPrice struct {
	CustomerID  int    `json:"customer_id" gorm:"primaryKey;autoIncrement:false"`
	AgentID     int    `json:"agent_id" gorm:"index"`
	PriceCents  int    `json:"price_cents"`
	InviteToken string `json:"-" gorm:"type:varchar(64)"`
	CreatedAt   int64  `json:"created_at"`
}

func CreateAgentInvitation(agentID, cents int) (*AgentInvitation, error) {
	if cents < AgentMinimumPriceCents || cents > AgentMaximumPriceCents {
		return nil, ErrAgentPriceRange
	}
	var entropy [32]byte
	if _, err := rand.Read(entropy[:]); err != nil {
		return nil, err
	}
	link := &AgentInvitation{Token: hex.EncodeToString(entropy[:]), AgentID: agentID, PriceCents: cents}
	err := DB.Transaction(func(tx *gorm.DB) error {
		var profile AgentProfile
		if err := lockForUpdate(tx).Where("user_id = ? AND enabled = ?", agentID, true).First(&profile).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrAgentForbidden
			}
			return err
		}
		var owner User
		if err := tx.Select("id", "status").First(&owner, agentID).Error; err != nil {
			return err
		}
		if owner.Status != common.UserStatusEnabled {
			return ErrAgentForbidden
		}
		now := time.Now().Unix()
		var active int64
		if err := tx.Model(&AgentInvitation{}).Where("agent_id = ? AND expires_at > ?", agentID, now).Count(&active).Error; err != nil {
			return err
		}
		if active >= AgentInvitationLimit {
			return ErrAgentInvitationLimit
		}
		link.CreatedAt, link.ExpiresAt = now, now+AgentInvitationTTL
		return tx.Create(link).Error
	})
	return link, err
}

func ListAgentInvitations(agentID int) ([]AgentInvitation, error) {
	links := []AgentInvitation{}
	err := DB.Where("agent_id = ? AND expires_at > ?", agentID, time.Now().Unix()).Order("created_at DESC, token ASC").Limit(AgentInvitationLimit).Find(&links).Error
	return links, err
}

func GetAgentInvitation(token string) (*AgentInvitation, error) {
	if len(token) != 64 {
		return nil, ErrAgentInvitationExpired
	}
	if _, err := hex.DecodeString(token); err != nil {
		return nil, ErrAgentInvitationExpired
	}
	var link AgentInvitation
	result := DB.Table("agent_invitations AS ai").Select("ai.*").Joins("JOIN agent_profiles AS ap ON ap.user_id = ai.agent_id").Joins("JOIN users AS owner ON owner.id = ai.agent_id").Where("ai.token = ? AND ai.expires_at > ? AND ap.enabled = ? AND owner.status = ? AND owner.deleted_at IS NULL", token, time.Now().Unix(), true, common.UserStatusEnabled).Limit(1).Find(&link)
	if result.Error != nil {
		return nil, result.Error
	}
	if result.RowsAffected == 0 {
		return nil, ErrAgentInvitationExpired
	}
	return &link, nil
}

// User creation, invitation validation and price binding commit together.
// A stale link cannot leave behind a registered account charged at another price.
func (user *User) InsertWithAgentInvitation(token string) error {
	link, err := GetAgentInvitation(token)
	if err != nil {
		return err
	}
	err = DB.Transaction(func(tx *gorm.DB) error {
		var profile AgentProfile
		if err := lockForUpdate(tx).Where("user_id = ? AND enabled = ?", link.AgentID, true).First(&profile).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrAgentInvitationExpired
			}
			return err
		}
		var owner User
		if err := lockForUpdate(tx).Select("id", "status").First(&owner, link.AgentID).Error; err != nil {
			return err
		}
		if owner.Status != common.UserStatusEnabled {
			return ErrAgentInvitationExpired
		}
		user.InviterId = link.AgentID
		if err := user.InsertWithTx(tx, link.AgentID); err != nil {
			return err
		}
		// Password hashing and contention can cross the expiry boundary.
		if time.Now().Unix() >= link.ExpiresAt {
			return ErrAgentInvitationExpired
		}
		if link.PriceCents < AgentMinimumPriceCents || link.PriceCents > AgentMaximumPriceCents {
			return ErrAgentPriceRange
		}
		price := AgentCustomerPrice{CustomerID: user.Id, AgentID: link.AgentID, PriceCents: link.PriceCents, InviteToken: link.Token, CreatedAt: time.Now().Unix()}
		return tx.Create(&price).Error
	})
	if err == nil {
		user.finishInsert(link.AgentID)
	}
	return err
}

// Freeze historical direct customers once during upgrade or first enable.
// Plain affiliate URLs still track referrals but cannot issue a special price.
func lockHistoricalAgentPrices(tx *gorm.DB, profile *AgentProfile) error {
	var users []User
	err := tx.Select("id").Where("inviter_id = ?", profile.UserID).FindInBatches(&users, 200, func(_ *gorm.DB, _ int) error {
		prices := make([]AgentCustomerPrice, 0, len(users))
		for _, user := range users {
			prices = append(prices, AgentCustomerPrice{CustomerID: user.Id, AgentID: profile.UserID, PriceCents: profile.PriceCents, CreatedAt: time.Now().Unix()})
		}
		return tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&prices).Error
	}).Error
	if err != nil {
		return err
	}
	return tx.Model(&AgentProfile{}).Where("user_id = ?", profile.UserID).Update("customer_prices_locked", true).Error
}

func InitializeAgentCustomerPrices() error {
	var profiles []AgentProfile
	if err := DB.Where("enabled = ? AND (customer_prices_locked = ? OR customer_prices_locked IS NULL)", true, false).Find(&profiles).Error; err != nil {
		return err
	}
	for _, row := range profiles {
		if err := DB.Transaction(func(tx *gorm.DB) error {
			var profile AgentProfile
			if err := lockForUpdate(tx).Where("user_id = ?", row.UserID).First(&profile).Error; err != nil {
				return err
			}
			if profile.CustomerPricesLocked {
				return nil
			}
			return lockHistoricalAgentPrices(tx, &profile)
		}); err != nil {
			return err
		}
	}
	return nil
}
