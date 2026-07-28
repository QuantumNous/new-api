package model

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	AuthIdentityProviderGitHub   = "github"
	AuthIdentityProviderDiscord  = "discord"
	AuthIdentityProviderOIDC     = "oidc"
	AuthIdentityProviderLinuxDO  = "linuxdo"
	AuthIdentityProviderWeChat   = "wechat"
	AuthIdentityProviderTelegram = "telegram"
	AuthIdentityProviderCustom   = "custom_oauth"

	authIdentityBackfillBatchSize = 500
	authIdentityCustomKeyPrefix   = AuthIdentityProviderCustom + ":"
)

var (
	ErrAuthIdentityAlreadyBound         = errors.New("OAuth identity is already bound to another user")
	ErrAuthIdentityProviderAlreadyBound = errors.New("user already has a different identity for this OAuth provider")
)

// AuthIdentity is the database authority for external account ownership.
// Legacy provider ID columns on users remain populated for API compatibility,
// while these composite unique indexes enforce ownership atomically under
// concurrent registration and binding requests.
type AuthIdentity struct {
	Id                  int64     `json:"id" gorm:"primaryKey"`
	UserId              int       `json:"user_id" gorm:"not null;uniqueIndex:ux_auth_identity_user_provider,priority:1"`
	ProviderKey         string    `json:"provider_key" gorm:"type:varchar(64);not null;uniqueIndex:ux_auth_identity_user_provider,priority:2;uniqueIndex:ux_auth_identity_provider_subject,priority:1"`
	ProviderSubjectHash string    `json:"-" gorm:"column:provider_subject;type:char(64);not null;uniqueIndex:ux_auth_identity_provider_subject,priority:2"`
	ProviderSubject     string    `json:"-" gorm:"column:provider_subject_value;type:varchar(256)"`
	CreatedAt           time.Time `json:"created_at"`
	UpdatedAt           time.Time `json:"updated_at"`
}

func (AuthIdentity) TableName() string {
	return "auth_identities"
}

func normalizeAuthIdentity(providerKey string, providerSubject string) (string, string, error) {
	providerKey = strings.ToLower(strings.TrimSpace(providerKey))
	if providerKey == "" || strings.TrimSpace(providerSubject) == "" || len(providerKey) > 64 || len(providerSubject) > 256 {
		return "", "", errors.New("OAuth identity provider and subject are required")
	}
	return providerKey, providerSubject, nil
}

func AuthIdentityProviderKeyForCustomOAuth(providerId int) (string, error) {
	if providerId <= 0 {
		return "", errors.New("custom OAuth provider ID is required")
	}
	return authIdentityCustomKeyPrefix + strconv.Itoa(providerId), nil
}

func customOAuthProviderIdFromAuthIdentityKey(providerKey string) (int, bool) {
	providerKey = strings.ToLower(strings.TrimSpace(providerKey))
	if !strings.HasPrefix(providerKey, authIdentityCustomKeyPrefix) {
		return 0, false
	}
	providerId, err := strconv.Atoi(strings.TrimPrefix(providerKey, authIdentityCustomKeyPrefix))
	return providerId, err == nil && providerId > 0
}

func hashAuthIdentitySubject(providerSubject string) string {
	digest := sha256.Sum256([]byte(providerSubject))
	return hex.EncodeToString(digest[:])
}

func CreateAuthIdentityWithTx(tx *gorm.DB, userId int, providerKey string, providerSubject string) error {
	if tx == nil || userId <= 0 {
		return errors.New("database transaction and user ID are required")
	}
	providerKey, providerSubject, err := normalizeAuthIdentity(providerKey, providerSubject)
	if err != nil {
		return err
	}

	identity := &AuthIdentity{
		UserId:              userId,
		ProviderKey:         providerKey,
		ProviderSubjectHash: hashAuthIdentitySubject(providerSubject),
		ProviderSubject:     providerSubject,
	}
	if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(identity).Error; err != nil {
		return err
	}

	boundIdentity := &AuthIdentity{}
	err = tx.Where("provider_key = ? AND provider_subject = ?", providerKey, identity.ProviderSubjectHash).Take(boundIdentity).Error
	if err == nil {
		if boundIdentity.ProviderSubject != "" && boundIdentity.ProviderSubject != providerSubject {
			return errors.New("OAuth identity subject hash collision")
		}
		if boundIdentity.UserId != userId {
			return ErrAuthIdentityAlreadyBound
		}
		if boundIdentity.ProviderSubject == providerSubject {
			return nil
		}
		return tx.Model(&AuthIdentity{}).
			Where(
				"id = ? AND (provider_subject_value = ? OR provider_subject_value IS NULL)",
				boundIdentity.Id,
				"",
			).
			Update("provider_subject_value", providerSubject).Error
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}

	userIdentity := &AuthIdentity{}
	err = tx.Where("user_id = ? AND provider_key = ?", userId, providerKey).Take(userIdentity).Error
	if err == nil {
		return ErrAuthIdentityProviderAlreadyBound
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	return errors.New("failed to persist OAuth identity")
}

func SetAuthIdentityWithTx(tx *gorm.DB, userId int, providerKey string, providerSubject string) error {
	if tx == nil || userId <= 0 {
		return errors.New("database transaction and user ID are required")
	}
	providerKey, providerSubject, err := normalizeAuthIdentity(providerKey, providerSubject)
	if err != nil {
		return err
	}
	if err := tx.Where("user_id = ? AND provider_key = ?", userId, providerKey).Delete(&AuthIdentity{}).Error; err != nil {
		return err
	}
	return CreateAuthIdentityWithTx(tx, userId, providerKey, providerSubject)
}

func DeleteAuthIdentityWithTx(tx *gorm.DB, userId int, providerKey string) error {
	if tx == nil || userId <= 0 {
		return errors.New("database transaction and user ID are required")
	}
	providerKey = strings.ToLower(strings.TrimSpace(providerKey))
	if providerKey == "" {
		return errors.New("OAuth identity provider is required")
	}
	return tx.Where("user_id = ? AND provider_key = ?", userId, providerKey).Delete(&AuthIdentity{}).Error
}

func GetUserByAuthIdentity(providerKey string, providerSubject string) (*User, error) {
	providerKey, providerSubject, err := normalizeAuthIdentity(providerKey, providerSubject)
	if err != nil {
		return nil, err
	}
	identity := &AuthIdentity{}
	if err := DB.Where("provider_key = ? AND provider_subject = ?", providerKey, hashAuthIdentitySubject(providerSubject)).Take(identity).Error; err != nil {
		return nil, err
	}
	user := &User{}
	if err := DB.Unscoped().First(user, identity.UserId).Error; err != nil {
		return nil, err
	}
	return user, nil
}

func EnsureAuthIdentity(userId int, providerKey string, providerSubject string) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		return CreateAuthIdentityWithTx(tx, userId, providerKey, providerSubject)
	})
}

func builtInAuthIdentityColumn(providerKey string) (string, bool) {
	switch strings.ToLower(strings.TrimSpace(providerKey)) {
	case AuthIdentityProviderGitHub:
		return "github_id", true
	case AuthIdentityProviderDiscord:
		return "discord_id", true
	case AuthIdentityProviderOIDC:
		return "oidc_id", true
	case AuthIdentityProviderLinuxDO:
		return "linux_do_id", true
	case AuthIdentityProviderWeChat:
		return "wechat_id", true
	case AuthIdentityProviderTelegram:
		return "telegram_id", true
	default:
		return "", false
	}
}

func setBuiltInAuthIdentityField(user *User, providerKey string, providerSubject string) error {
	switch strings.ToLower(strings.TrimSpace(providerKey)) {
	case AuthIdentityProviderGitHub:
		user.GitHubId = providerSubject
	case AuthIdentityProviderDiscord:
		user.DiscordId = providerSubject
	case AuthIdentityProviderOIDC:
		user.OidcId = providerSubject
	case AuthIdentityProviderLinuxDO:
		user.LinuxDOId = providerSubject
	case AuthIdentityProviderWeChat:
		user.WeChatId = providerSubject
	case AuthIdentityProviderTelegram:
		user.TelegramId = providerSubject
	default:
		return errors.New("unsupported built-in OAuth provider")
	}
	return nil
}

func CreateBuiltInAuthIdentityWithTx(tx *gorm.DB, user *User, providerKey string, providerSubject string) error {
	if user == nil || user.Id == 0 {
		return errors.New("user is required")
	}
	column, ok := builtInAuthIdentityColumn(providerKey)
	if !ok {
		return errors.New("unsupported built-in OAuth provider")
	}
	if err := CreateAuthIdentityWithTx(tx, user.Id, providerKey, providerSubject); err != nil {
		return err
	}
	if err := setBuiltInAuthIdentityField(user, providerKey, providerSubject); err != nil {
		return err
	}
	return tx.Model(&User{}).Where("id = ?", user.Id).Update(column, providerSubject).Error
}

func SetBuiltInAuthIdentity(user *User, providerKey string, providerSubject string) error {
	if user == nil || user.Id == 0 {
		return errors.New("user is required")
	}
	column, ok := builtInAuthIdentityColumn(providerKey)
	if !ok {
		return errors.New("unsupported built-in OAuth provider")
	}
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := SetAuthIdentityWithTx(tx, user.Id, providerKey, providerSubject); err != nil {
			return err
		}
		if err := tx.Model(&User{}).Where("id = ?", user.Id).Update(column, providerSubject).Error; err != nil {
			return err
		}
		return tx.First(user, user.Id).Error
	})
	if err != nil {
		return err
	}
	if err := setBuiltInAuthIdentityField(user, providerKey, providerSubject); err != nil {
		return err
	}
	return updateUserCache(*user)
}

func backfillBuiltInAuthIdentities() error {
	type legacyIdentityUser struct {
		Id         int
		GitHubId   string `gorm:"column:github_id"`
		DiscordId  string `gorm:"column:discord_id"`
		OidcId     string `gorm:"column:oidc_id"`
		LinuxDOId  string `gorm:"column:linux_do_id"`
		WeChatId   string `gorm:"column:wechat_id"`
		TelegramId string `gorm:"column:telegram_id"`
	}

	lastID := 0
	batchNumber := 0
	for {
		users := make([]legacyIdentityUser, 0, authIdentityBackfillBatchSize)
		if err := DB.Unscoped().Model(&User{}).
			Select("id", "github_id", "discord_id", "oidc_id", "linux_do_id", "wechat_id", "telegram_id").
			Where("id > ?", lastID).
			Order("id ASC").
			Limit(authIdentityBackfillBatchSize).
			Find(&users).Error; err != nil {
			return fmt.Errorf("cannot load legacy OAuth identity batch after user %d: %w", lastID, err)
		}
		if len(users) == 0 {
			return nil
		}

		batchNumber++
		batchFirstID := users[0].Id
		batchLastID := users[len(users)-1].Id
		conflictCount := 0
		if err := DB.Transaction(func(tx *gorm.DB) error {
			for _, user := range users {
				identities := []struct {
					provider string
					subject  string
				}{
					{AuthIdentityProviderGitHub, user.GitHubId},
					{AuthIdentityProviderDiscord, user.DiscordId},
					{AuthIdentityProviderOIDC, user.OidcId},
					{AuthIdentityProviderLinuxDO, user.LinuxDOId},
					{AuthIdentityProviderWeChat, user.WeChatId},
					{AuthIdentityProviderTelegram, user.TelegramId},
				}
				for _, identity := range identities {
					if strings.TrimSpace(identity.subject) == "" {
						continue
					}
					err := CreateAuthIdentityWithTx(tx, user.Id, identity.provider, identity.subject)
					if err == nil {
						continue
					}
					if errors.Is(err, ErrAuthIdentityAlreadyBound) || errors.Is(err, ErrAuthIdentityProviderAlreadyBound) {
						// CreateAuthIdentityWithTx uses ON CONFLICT DO NOTHING, so these
						// sentinel conflicts do not leave PostgreSQL transactions aborted.
						conflictCount++
						continue
					}
					return fmt.Errorf("cannot backfill %s identity for user %d in batch %d: %w", identity.provider, user.Id, batchNumber, err)
				}
			}
			return nil
		}); err != nil {
			return err
		}

		if conflictCount > 0 {
			common.SysLog(fmt.Sprintf(
				"auth identity backfill batch %d for user IDs %d-%d skipped %d known conflicts",
				batchNumber,
				batchFirstID,
				batchLastID,
				conflictCount,
			))
		}

		lastID = batchLastID
		if len(users) < authIdentityBackfillBatchSize {
			return nil
		}
	}
}
