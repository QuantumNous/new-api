package model

import (
	"errors"
	"strconv"
	"strings"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	AccessTokenPrefix                = "nap_"
	AccessTokenSessionPrefix         = "pat:"
	AccessTokenSessionVersion        = 1
	legacyAccessTokenRetireAtKey     = "LegacyAccessTokenRetireAt"
	legacyAccessTokenTransitionDays  = 30
	userAccessTokenCleanupBatchSize  = 500
	userAccessTokenTouchIntervalSecs = 60
)

var (
	ErrAccessTokenNotFound      = errors.New("access token not found")
	ErrAccessTokenLimit         = errors.New("access token limit reached")
	ErrAccessTokenExpired       = errors.New("access token has expired")
	ErrLegacyAccessTokenRetired = errors.New("legacy access token has been retired")
	errLegacyRetireAtReadOnly   = errors.New("LegacyAccessTokenRetireAt is managed by the server")
)

// legacyAccessTokenRetireAt caches the deployment-wide deadline loaded at
// startup. Zero means it was never loaded, which is treated as retired.
var legacyAccessTokenRetireAt atomic.Int64

// UserAccessToken is a scoped dashboard personal access token. Only the
// SHA-256 fingerprint of the plaintext is stored; it doubles as the audit
// token_ref.
type UserAccessToken struct {
	Id         int    `json:"id"`
	UserId     int    `json:"-" gorm:"index"`
	Name       string `json:"name" gorm:"type:varchar(64)"`
	TokenHash  string `json:"token_ref" gorm:"type:varchar(64);uniqueIndex"`
	TokenHint  string `json:"token_hint" gorm:"type:varchar(8)"`
	Scopes     string `json:"-" gorm:"type:varchar(2048)"`
	ExpiresAt  int64  `json:"expires_at" gorm:"type:bigint;index"`
	LastUsedAt int64  `json:"last_used_at" gorm:"type:bigint"`
	LastUsedIp string `json:"last_used_ip" gorm:"type:varchar(64)"`
	CreatedAt  int64  `json:"created_at" gorm:"type:bigint"`
}

func (UserAccessToken) TableName() string {
	return "user_access_tokens"
}

// GetScopes returns the stored scope list; a malformed value grants nothing.
func (token *UserAccessToken) GetScopes() []string {
	if token == nil || token.Scopes == "" {
		return nil
	}
	var scopes []string
	if err := common.UnmarshalJsonStr(token.Scopes, &scopes); err != nil {
		common.SysError(common.LogText("invalid access token scopes: %s", err.Error()))
		return nil
	}
	return scopes
}

func (token *UserAccessToken) SetScopes(scopes []string) error {
	data, err := common.Marshal(scopes)
	if err != nil {
		return err
	}
	token.Scopes = string(data)
	return nil
}

// Expired reports whether the token has an absolute expiry at or before now.
func (token *UserAccessToken) Expired(now int64) bool {
	return token.ExpiresAt > 0 && token.ExpiresAt <= now
}

func FindUserAccessTokenByHash(hash string) (*UserAccessToken, error) {
	if hash == "" {
		return nil, nil
	}
	var token UserAccessToken
	err := DB.Where("token_hash = ?", hash).First(&token).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &token, nil
}

func GetUserAccessToken(userID, id int) (*UserAccessToken, error) {
	var token UserAccessToken
	err := DB.Where("id = ? AND user_id = ?", id, userID).First(&token).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrAccessTokenNotFound
	}
	if err != nil {
		return nil, err
	}
	return &token, nil
}

func ListUserAccessTokens(userID int) ([]UserAccessToken, error) {
	tokens := make([]UserAccessToken, 0)
	err := DB.Where("user_id = ?", userID).Order("created_at DESC").Order("id DESC").Find(&tokens).Error
	return tokens, err
}

// CreateUserAccessToken inserts a token while holding the owner's users row, so
// concurrent creates cannot exceed limit. Expired rows awaiting cleanup count.
func CreateUserAccessToken(userID int, token *UserAccessToken, limit int) error {
	if userID <= 0 || token == nil || token.TokenHash == "" {
		return ErrAccessTokenNotFound
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		var user User
		if err := lockForUpdate(tx).Select("id").First(&user, userID).Error; err != nil {
			return err
		}
		var count int64
		if err := tx.Model(&UserAccessToken{}).Where("user_id = ?", userID).Count(&count).Error; err != nil {
			return err
		}
		if count >= int64(limit) {
			return ErrAccessTokenLimit
		}
		token.Id = 0
		token.UserId = userID
		if token.CreatedAt == 0 {
			token.CreatedAt = common.GetTimestamp()
		}
		return tx.Create(token).Error
	})
}

// UpdateUserAccessToken renames one token owned by userID and, when scopes is
// not nil, replaces its grant.
func UpdateUserAccessToken(userID, id int, name string, scopes []string) (*UserAccessToken, error) {
	updates := map[string]any{"name": name}
	if scopes != nil {
		var grant UserAccessToken
		if err := grant.SetScopes(scopes); err != nil {
			return nil, err
		}
		updates["scopes"] = grant.Scopes
	}
	result := DB.Model(&UserAccessToken{}).Where("id = ? AND user_id = ?", id, userID).Updates(updates)
	if result.Error != nil {
		return nil, result.Error
	}
	token, err := GetUserAccessToken(userID, id)
	if err != nil {
		return nil, err
	}
	return token, nil
}

// DeleteUserAccessToken hard-deletes one token owned by userID and returns the
// deleted row for auditing.
func DeleteUserAccessToken(userID, id int) (*UserAccessToken, error) {
	var token UserAccessToken
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := lockForUpdate(tx).Where("id = ? AND user_id = ?", id, userID).First(&token).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrAccessTokenNotFound
			}
			return err
		}
		return tx.Where("id = ? AND user_id = ?", id, userID).Delete(&UserAccessToken{}).Error
	})
	if err != nil {
		return nil, err
	}
	return &token, nil
}

func DeleteUserAccessTokensWithTx(tx *gorm.DB, userID int) (int64, error) {
	result := tx.Where("user_id = ?", userID).Delete(&UserAccessToken{})
	return result.RowsAffected, result.Error
}

// TouchUserAccessToken records the last use at most once per interval per token.
func TouchUserAccessToken(id int, ip string, now int64) error {
	if len(ip) > 64 {
		ip = ip[:64]
	}
	return DB.Model(&UserAccessToken{}).
		Where("id = ? AND last_used_at < ?", id, now-userAccessTokenTouchIntervalSecs).
		Updates(map[string]any{"last_used_at": now, "last_used_ip": ip}).Error
}

// DeleteExpiredUserAccessTokens removes tokens that expired before the cutoff.
// Tokens that never expire are kept.
func DeleteExpiredUserAccessTokens(before int64) error {
	for {
		var ids []int
		if err := DB.Model(&UserAccessToken{}).
			Where("expires_at > 0 AND expires_at < ?", before).
			Order("id").Limit(userAccessTokenCleanupBatchSize).Pluck("id", &ids).Error; err != nil {
			return err
		}
		if len(ids) == 0 {
			return nil
		}
		if err := DB.Where("id IN ?", ids).Delete(&UserAccessToken{}).Error; err != nil {
			return err
		}
		if len(ids) < userAccessTokenCleanupBatchSize {
			return nil
		}
	}
}

// AccessTokenHint is the last four characters of a token, shown so users can
// tell their tokens apart. PostgreSQL pads legacy CHAR(32) values with spaces.
func AccessTokenHint(token string) string {
	token = strings.TrimRight(token, " ")
	if len(token) <= 4 {
		return ""
	}
	return token[len(token)-4:]
}

// AccessTokenSessionID is the step-up session identifier bound to a token.
// Browser session IDs are UUIDs and can never carry this prefix.
func AccessTokenSessionID(id int) string {
	return AccessTokenSessionPrefix + strconv.Itoa(id)
}

func ParseAccessTokenSessionID(sid string) (int, bool) {
	raw, ok := strings.CutPrefix(sid, AccessTokenSessionPrefix)
	if !ok {
		return 0, false
	}
	id, err := strconv.Atoi(raw)
	if err != nil || id <= 0 || strconv.Itoa(id) != raw {
		return 0, false
	}
	return id, true
}

// ValidateAccessTokenIdentity checks a token-bound step-up identity without
// taking locks, for use before issuing a verification proof.
func ValidateAccessTokenIdentity(identity AuthSessionIdentity) error {
	tokenID, ok := ParseAccessTokenSessionID(identity.SessionID)
	if !ok {
		return ErrUserSessionInactive
	}
	return checkAccessTokenIdentity(DB, tokenID, identity, false)
}

func validateAccessTokenIdentityWithTx(tx *gorm.DB, tokenID int, identity AuthSessionIdentity) error {
	return checkAccessTokenIdentity(tx, tokenID, identity, true)
}

// checkAccessTokenIdentity locks users before user_access_tokens, matching
// CreateUserAccessToken, and reports every mismatch as an inactive session.
func checkAccessTokenIdentity(tx *gorm.DB, tokenID int, identity AuthSessionIdentity, lock bool) error {
	if identity.UserID <= 0 || identity.UserAuthVersion <= 0 || identity.SessionVersion != AccessTokenSessionVersion {
		return ErrUserSessionInactive
	}
	query := tx
	if lock {
		query = lockForUpdate(tx)
	}
	var user User
	if err := query.Select("id", "status", "auth_version").First(&user, identity.UserID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrUserSessionInactive
		}
		return err
	}
	if user.Status != common.UserStatusEnabled || user.AuthVersion != identity.UserAuthVersion {
		return ErrUserSessionInactive
	}
	query = tx
	if lock {
		query = lockForUpdate(tx)
	}
	var token UserAccessToken
	if err := query.Where("id = ? AND user_id = ?", tokenID, identity.UserID).First(&token).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrUserSessionInactive
		}
		return err
	}
	if token.Expired(time.Now().Unix()) {
		return ErrUserSessionInactive
	}
	return nil
}

// EnsureLegacyAccessTokenRetireAt records the legacy token deadline on first
// start (now + 30 days) and loads the stored value. The first node to start
// wins; later starts and other nodes only read it.
func EnsureLegacyAccessTokenRetireAt(now int64) error {
	deadline := strconv.FormatInt(now+legacyAccessTokenTransitionDays*24*60*60, 10)
	if err := DB.Clauses(clause.OnConflict{DoNothing: true}).Create(&Option{Key: legacyAccessTokenRetireAtKey, Value: deadline}).Error; err != nil {
		return err
	}
	var option Option
	if err := DB.Where(&Option{Key: legacyAccessTokenRetireAtKey}).First(&option).Error; err != nil {
		return err
	}
	retireAt, err := strconv.ParseInt(strings.TrimSpace(option.Value), 10, 64)
	if err != nil || retireAt <= 0 {
		return errors.New("invalid LegacyAccessTokenRetireAt option value")
	}
	legacyAccessTokenRetireAt.Store(retireAt)
	return nil
}

func LegacyAccessTokenRetireAt() int64 {
	return legacyAccessTokenRetireAt.Load()
}

func LegacyAccessTokensRetired(now int64) bool {
	retireAt := legacyAccessTokenRetireAt.Load()
	return retireAt <= 0 || now >= retireAt
}
