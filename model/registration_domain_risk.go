package model

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type RegistrationDomainState struct {
	Domain        string `json:"domain" gorm:"type:varchar(253);primaryKey"`
	ActiveBlockID int    `json:"active_block_id" gorm:"default:0;index"`
	CountingSince int64  `json:"counting_since" gorm:"default:0"`
	CreatedAt     int64  `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt     int64  `json:"updated_at" gorm:"autoUpdateTime"`
}

type RegistrationDomainBlock struct {
	Id                int    `json:"id"`
	Domain            string `json:"domain" gorm:"type:varchar(253);index"`
	WindowHours       int    `json:"window_hours"`
	Threshold         int    `json:"threshold"`
	ObservedCount     int    `json:"observed_count"`
	WindowStartedAt   int64  `json:"window_started_at"`
	BlockedAt         int64  `json:"blocked_at" gorm:"index"`
	ReleasedAt        int64  `json:"released_at" gorm:"default:0;index"`
	ReleasedBy        int    `json:"released_by" gorm:"default:0"`
	RestoreUsers      bool   `json:"restore_users" gorm:"default:false"`
	AffectedUserCount int64  `json:"affected_user_count" gorm:"-"`
}

type RegistrationDomainBlockUser struct {
	Id          int   `json:"id"`
	BlockID     int   `json:"block_id" gorm:"uniqueIndex:idx_registration_block_user"`
	UserID      int   `json:"user_id" gorm:"uniqueIndex:idx_registration_block_user;index"`
	PriorStatus int   `json:"prior_status"`
	DisabledAt  int64 `json:"disabled_at"`
	RestoredAt  int64 `json:"restored_at" gorm:"default:0"`
	RestoredBy  int   `json:"restored_by" gorm:"default:0"`
}

type RegistrationDomainRiskPolicy struct {
	Enabled   bool
	Window    time.Duration
	Threshold int
	Now       int64
}

type RegistrationDomainRiskResult struct {
	Triggered bool
	BlockID   int
}

type RegistrationDomainReleaseResult struct {
	Block         RegistrationDomainBlock `json:"block"`
	RestoredUsers int64                   `json:"restored_users"`
}

const (
	registrationEmailDomainBackfillBatchSize = 500
	registrationDomainBlockDetailMaxPageSize = 100
)

type RegistrationDomainAffectedUser struct {
	RegistrationDomainBlockUser
	Username      string `json:"username"`
	Email         string `json:"email"`
	CurrentStatus int    `json:"current_status"`
}

type RegistrationDomainBlockDetail struct {
	Block        RegistrationDomainBlock          `json:"block"`
	Users        []RegistrationDomainAffectedUser `json:"users"`
	UserTotal    int64                            `json:"user_total"`
	UserPage     int                              `json:"user_page"`
	UserPageSize int                              `json:"user_page_size"`
}

func RegisterUserWithDomainRisk(user *User, inviterID int, registrationIP string, policy RegistrationDomainRiskPolicy, afterCreate func(*gorm.DB) error) (RegistrationDomainRiskResult, error) {
	if user.EmailDomain == "" && user.Email != "" {
		domain, err := common.NormalizeEmailDomain(user.Email)
		if err != nil {
			return RegistrationDomainRiskResult{}, err
		}
		user.EmailDomain = domain
	}
	if user.EmailDomain == "" {
		err := insertRegisteredUser(user, inviterID, registrationIP, afterCreate)
		if err != nil {
			ReleaseRegistrationIPNewUserBonusRedisClaim(user)
		}
		return RegistrationDomainRiskResult{}, err
	}
	domain := strings.ToLower(strings.TrimSpace(user.EmailDomain))
	if domain == "" {
		user.EmailDomain = ""
		err := insertRegisteredUser(user, inviterID, registrationIP, afterCreate)
		if err != nil {
			ReleaseRegistrationIPNewUserBonusRedisClaim(user)
		}
		return RegistrationDomainRiskResult{}, err
	}
	user.EmailDomain = domain
	if policy.Now == 0 {
		policy.Now = time.Now().Unix()
	}
	if policy.Enabled && user.CreatedAt == 0 {
		user.CreatedAt = policy.Now
	}
	if policy.Enabled && (policy.Window <= 0 || policy.Threshold < 2) {
		return RegistrationDomainRiskResult{}, errors.New("invalid registration domain risk policy")
	}
	stateSeed := RegistrationDomainState{Domain: domain}
	if err := DB.Clauses(clause.OnConflict{DoNothing: true}).Create(&stateSeed).Error; err != nil {
		return RegistrationDomainRiskResult{}, err
	}
	result := RegistrationDomainRiskResult{}
	var disabledIDs []int
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&RegistrationDomainState{}).Where("domain = ?", domain).
			UpdateColumn("updated_at", gorm.Expr("updated_at")).Error; err != nil {
			return err
		}
		var state RegistrationDomainState
		if err := tx.Where("domain = ?", domain).First(&state).Error; err != nil {
			return err
		}
		// An active velocity block only applies when the risk policy is enabled.
		// Trusted domains (and a globally-disabled policy) bypass it, so an
		// enterprise customer can still register after its domain was hammered.
		if policy.Enabled && state.ActiveBlockID != 0 {
			result.BlockID = state.ActiveBlockID
			return nil
		}
		if !policy.Enabled {
			return insertRegisteredUserWithTx(tx, user, inviterID, registrationIP, afterCreate)
		}
		if err := backfillLegacyRegistrationEmailDomains(tx, domain); err != nil {
			return err
		}
		cutoff := policy.Now - int64(policy.Window/time.Second)
		if state.CountingSince > cutoff {
			cutoff = state.CountingSince
		}
		var count int64
		if err := usersForEmailDomain(tx.Model(&User{}), domain).
			Where("created_at >= ? AND created_at <= ?", cutoff, policy.Now).Count(&count).Error; err != nil {
			return err
		}
		if count+1 < int64(policy.Threshold) {
			return insertRegisteredUserWithTx(tx, user, inviterID, registrationIP, afterCreate)
		}
		block := RegistrationDomainBlock{
			Domain: domain, WindowHours: int(policy.Window / time.Hour), Threshold: policy.Threshold,
			ObservedCount: int(count + 1), WindowStartedAt: cutoff, BlockedAt: policy.Now,
		}
		if err := tx.Create(&block).Error; err != nil {
			return err
		}
		newDisabledIDs, disableErr := disableRegistrationDomainUsers(tx, block.Id, domain, policy.Now)
		if disableErr != nil {
			return disableErr
		}
		disabledIDs = newDisabledIDs
		if err := tx.Model(&RegistrationDomainState{}).Where("domain = ?", domain).
			Update("active_block_id", block.Id).Error; err != nil {
			return err
		}
		result.Triggered = true
		result.BlockID = block.Id
		return nil
	})
	if err != nil {
		ReleaseRegistrationIPNewUserBonusRedisClaim(user)
		return RegistrationDomainRiskResult{}, err
	}
	for _, id := range disabledIDs {
		if err := InvalidateUserCache(id); err != nil {
			common.SysError("failed to invalidate registration-blocked user cache: " + err.Error())
		}
	}
	if result.BlockID != 0 {
		return result, ErrRegistrationDomainBlocked
	}
	return result, nil
}

func disableRegistrationDomainUsers(tx *gorm.DB, blockID int, domain string, disabledAt int64) ([]int, error) {
	var users []User
	query := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("status = ?", common.UserStatusEnabled)
	if err := usersForEmailDomain(query, domain).Find(&users).Error; err != nil {
		return nil, err
	}
	if len(users) == 0 {
		return nil, nil
	}

	ids := make([]int, 0, len(users))
	for _, user := range users {
		ids = append(ids, user.Id)
	}
	update := tx.Model(&User{}).Where("id IN ? AND status = ?", ids, common.UserStatusEnabled).
		Update("status", common.UserStatusDisabled)
	if update.Error != nil {
		return nil, update.Error
	}
	if update.RowsAffected != int64(len(ids)) {
		return nil, errors.New("registration domain user status changed concurrently")
	}

	affected := make([]RegistrationDomainBlockUser, 0, len(users))
	for _, user := range users {
		affected = append(affected, RegistrationDomainBlockUser{
			BlockID: blockID, UserID: user.Id, PriorStatus: user.Status, DisabledAt: disabledAt,
		})
	}
	if err := tx.Create(&affected).Error; err != nil {
		return nil, err
	}
	return ids, nil
}

func insertRegisteredUser(user *User, inviterID int, registrationIP string, afterCreate func(*gorm.DB) error) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		return insertRegisteredUserWithTx(tx, user, inviterID, registrationIP, afterCreate)
	})
}

func insertRegisteredUserWithTx(tx *gorm.DB, user *User, inviterID int, registrationIP string, afterCreate func(*gorm.DB) error) error {
	if err := user.InsertWithTxAndRegistrationIP(tx, inviterID, registrationIP); err != nil {
		return err
	}
	if err := CreateRegistrationLifecycleEventsTx(tx, user); err != nil {
		return err
	}
	if afterCreate != nil {
		return afterCreate(tx)
	}
	return nil
}

func usersForEmailDomain(db *gorm.DB, domain string) *gorm.DB {
	return db.Where("email_domain = ? OR (COALESCE(email_domain, '') = '' AND LOWER(email) LIKE ?)", domain, "%@"+domain)
}

func backfillLegacyRegistrationEmailDomains(tx *gorm.DB, domain string) error {
	var userIDs []int
	if err := tx.Model(&User{}).
		Where("COALESCE(email_domain, '') = '' AND LOWER(email) LIKE ?", "%@"+domain).
		Limit(registrationEmailDomainBackfillBatchSize).
		Pluck("id", &userIDs).Error; err != nil {
		return err
	}
	if len(userIDs) == 0 {
		return nil
	}
	return tx.Model(&User{}).
		Where("id IN ? AND COALESCE(email_domain, '') = ''", userIDs).
		Update("email_domain", domain).Error
}

func IsRegistrationDomainBlocked(domain string) (bool, error) {
	var state RegistrationDomainState
	err := DB.Where("domain = ?", strings.ToLower(strings.TrimSpace(domain))).First(&state).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return false, nil
	}
	return state.ActiveBlockID != 0, err
}

func GetRegistrationDomainBlocks(offset int, limit int) ([]RegistrationDomainBlock, int64, error) {
	var total int64
	if err := DB.Model(&RegistrationDomainBlock{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	blocks := make([]RegistrationDomainBlock, 0)
	if err := DB.Order("blocked_at DESC, id DESC").Offset(offset).Limit(limit).Find(&blocks).Error; err != nil {
		return nil, 0, err
	}
	for i := range blocks {
		if err := DB.Model(&RegistrationDomainBlockUser{}).Where("block_id = ?", blocks[i].Id).Count(&blocks[i].AffectedUserCount).Error; err != nil {
			return nil, 0, err
		}
	}
	return blocks, total, nil
}

func GetRegistrationDomainBlock(blockID int) (RegistrationDomainBlock, error) {
	block := RegistrationDomainBlock{}
	if err := DB.First(&block, blockID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return RegistrationDomainBlock{}, ErrRegistrationDomainBlockNotFound
		}
		return RegistrationDomainBlock{}, err
	}
	return block, nil
}

func GetRegistrationDomainBlockDetail(blockID int, offset int, limit int) (RegistrationDomainBlockDetail, error) {
	block, err := GetRegistrationDomainBlock(blockID)
	if err != nil {
		return RegistrationDomainBlockDetail{}, err
	}
	if limit < 1 {
		limit = common.ItemsPerPage
	}
	if limit > registrationDomainBlockDetailMaxPageSize {
		limit = registrationDomainBlockDetailMaxPageSize
	}
	if offset < 0 {
		offset = 0
	}
	detail := RegistrationDomainBlockDetail{
		Block:        block,
		Users:        make([]RegistrationDomainAffectedUser, 0, limit),
		UserPage:     offset/limit + 1,
		UserPageSize: limit,
	}
	if err := DB.Model(&RegistrationDomainBlockUser{}).Where("block_id = ?", blockID).Count(&detail.UserTotal).Error; err != nil {
		return RegistrationDomainBlockDetail{}, err
	}
	detail.Block.AffectedUserCount = detail.UserTotal
	var affected []RegistrationDomainBlockUser
	if err := DB.Where("block_id = ?", blockID).Order("id ASC").Offset(offset).Limit(limit).Find(&affected).Error; err != nil {
		return RegistrationDomainBlockDetail{}, err
	}
	userIDs := make([]int, 0, len(affected))
	for _, item := range affected {
		userIDs = append(userIDs, item.UserID)
	}
	usersByID := make(map[int]User, len(userIDs))
	if len(userIDs) > 0 {
		var users []User
		if err := DB.Unscoped().Select("id", "username", "email", "status").Where("id IN ?", userIDs).Find(&users).Error; err != nil {
			return RegistrationDomainBlockDetail{}, err
		}
		for _, user := range users {
			usersByID[user.Id] = user
		}
	}
	for _, item := range affected {
		user := usersByID[item.UserID]
		detail.Users = append(detail.Users, RegistrationDomainAffectedUser{
			RegistrationDomainBlockUser: item,
			Username:                    user.Username,
			Email:                       user.Email,
			CurrentStatus:               user.Status,
		})
	}
	return detail, nil
}

func ReleaseRegistrationDomainBlock(blockID int, adminID int, restoreUsers bool, releasedAt int64) (RegistrationDomainReleaseResult, error) {
	return releaseRegistrationDomainBlock(blockID, adminID, restoreUsers, releasedAt, "")
}

func ReleaseRegistrationDomainBlockWithTrustedDomain(blockID int, adminID int, restoreUsers bool, releasedAt int64, trustedDomain string) (RegistrationDomainReleaseResult, error) {
	return releaseRegistrationDomainBlock(blockID, adminID, restoreUsers, releasedAt, strings.ToLower(strings.TrimSpace(trustedDomain)))
}

func releaseRegistrationDomainBlock(blockID int, adminID int, restoreUsers bool, releasedAt int64, trustedDomain string) (RegistrationDomainReleaseResult, error) {
	result := RegistrationDomainReleaseResult{}
	var restoredIDs []int
	trustedDomainsValue := ""
	err := DB.Transaction(func(tx *gorm.DB) error {
		var block RegistrationDomainBlock
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&block, blockID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrRegistrationDomainBlockNotFound
			}
			return err
		}
		result.Block = block
		if block.ReleasedAt != 0 {
			return nil
		}
		if trustedDomain != "" {
			option := Option{Key: "registration_security.trusted_email_domains"}
			if err := tx.FirstOrCreate(&option, Option{Key: option.Key}).Error; err != nil {
				return err
			}
			if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&option, commonKeyCol+" = ?", option.Key).Error; err != nil {
				return err
			}
			trustedDomains := system_setting.GetRegistrationSecuritySettings().TrustedEmailDomains
			if strings.TrimSpace(option.Value) != "" {
				if err := common.UnmarshalJsonStr(option.Value, &trustedDomains); err != nil {
					return err
				}
			}
			cfg := system_setting.RegistrationSecuritySettings{
				DomainRiskWindowHours: 24,
				DomainRiskThreshold:   10,
				TrustedEmailDomains:   append(trustedDomains, trustedDomain),
			}
			if err := cfg.NormalizeAndValidate(); err != nil {
				return err
			}
			value, err := common.Marshal(cfg.TrustedEmailDomains)
			if err != nil {
				return err
			}
			trustedDomainsValue = string(value)
			option.Value = trustedDomainsValue
			if err := tx.Save(&option).Error; err != nil {
				return err
			}
		}
		if restoreUsers {
			var affected []RegistrationDomainBlockUser
			if err := tx.Where("block_id = ? AND restored_at = 0", blockID).Find(&affected).Error; err != nil {
				return err
			}
			for _, item := range affected {
				update := tx.Model(&User{}).Where("id = ? AND status = ?", item.UserID, common.UserStatusDisabled).
					Update("status", item.PriorStatus)
				if update.Error != nil {
					return update.Error
				}
				if update.RowsAffected == 1 {
					result.RestoredUsers++
					restoredIDs = append(restoredIDs, item.UserID)
				}
				if err := tx.Model(&RegistrationDomainBlockUser{}).Where("id = ?", item.Id).
					Updates(map[string]any{"restored_at": releasedAt, "restored_by": adminID}).Error; err != nil {
					return err
				}
			}
		}
		if err := tx.Model(&RegistrationDomainBlock{}).Where("id = ? AND released_at = 0", blockID).
			Updates(map[string]any{"released_at": releasedAt, "released_by": adminID, "restore_users": restoreUsers}).Error; err != nil {
			return err
		}
		if err := tx.Model(&RegistrationDomainState{}).Where("domain = ? AND active_block_id = ?", block.Domain, blockID).
			Updates(map[string]any{"active_block_id": 0, "counting_since": releasedAt}).Error; err != nil {
			return err
		}
		result.Block.ReleasedAt = releasedAt
		result.Block.ReleasedBy = adminID
		result.Block.RestoreUsers = restoreUsers
		return nil
	})
	if err != nil {
		return RegistrationDomainReleaseResult{}, err
	}
	for _, id := range restoredIDs {
		if err := InvalidateUserCache(id); err != nil {
			common.SysError("failed to invalidate registration-restored user cache: " + err.Error())
		}
	}
	if trustedDomainsValue != "" {
		if err := applyOptionMapValue("registration_security.trusted_email_domains", trustedDomainsValue); err != nil {
			return RegistrationDomainReleaseResult{}, err
		}
		if pubErr := common.PublishConfigChanged(context.Background(), common.ConfigScopeOptions); pubErr != nil {
			common.SysError("pubsub: failed to publish options change: " + pubErr.Error())
		}
	}
	return result, nil
}
