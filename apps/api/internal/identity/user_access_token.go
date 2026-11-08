package identity

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/internal/common"
	"github.com/QuantumNous/new-api/internal/common/dbx"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// Personal access tokens (PAT): scoped dashboard credentials listed under
// Profile → Security & Access. Migrated from the upstream security domain;
// the legacy users.access_token column keeps working as an unscoped token.

const (
	AccessTokenPrefix                = "nap_"
	AccessTokenMaxPerUser            = 20
	AccessTokenDefaultExpiryDays     = 30
	accessTokenMinLifetimeSecs       = 60 * 60
	userAccessTokenCleanupBatchSize  = 500
	userAccessTokenTouchIntervalSecs = 60
)

var (
	ErrAccessTokenNotFound = errors.New("access token not found")
	ErrAccessTokenLimit    = errors.New("access token limit reached")
	ErrAccessTokenExpired  = errors.New("access token has expired")
	ErrAccessTokenScope    = errors.New("access token scope is not sufficient")
)

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

// AccessTokenFingerprint is the stored SHA-256 of a plaintext token.
func AccessTokenFingerprint(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

// GetScopes returns the stored scope list; a malformed value grants nothing.
func (token *UserAccessToken) GetScopes() []string {
	if token == nil || token.Scopes == "" {
		return nil
	}
	var scopes []string
	if err := common.UnmarshalJsonStr(token.Scopes, &scopes); err != nil {
		common.SysError("invalid access token scopes: " + err.Error())
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

// AllowsScope reports whether the token grant covers the requested scope.
// A token with an empty/malformed grant authenticates nothing.
func (token *UserAccessToken) AllowsScope(scope string) bool {
	for _, s := range token.GetScopes() {
		if s == scope {
			return true
		}
	}
	return false
}

func FindUserAccessTokenByHash(hash string) (*UserAccessToken, error) {
	if hash == "" {
		return nil, nil
	}
	var token UserAccessToken
	err := dbx.DB.Where("token_hash = ?", hash).First(&token).Error
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
	err := dbx.DB.Where("id = ? AND user_id = ?", id, userID).First(&token).Error
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
	err := dbx.DB.Where("user_id = ?", userID).Order("created_at DESC").Order("id DESC").Find(&tokens).Error
	return tokens, err
}

// CreateUserAccessToken inserts a token while holding the owner's users row, so
// concurrent creates cannot exceed the limit. Expired rows awaiting cleanup
// count toward the limit.
func CreateUserAccessToken(userID int, token *UserAccessToken, limit int) error {
	if userID <= 0 || token == nil || token.TokenHash == "" {
		return ErrAccessTokenNotFound
	}
	return dbx.DB.Transaction(func(tx *gorm.DB) error {
		var user User
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Select("id").First(&user, userID).Error; err != nil {
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
func UpdateUserAccessTokenRecord(userID, id int, name string, scopes []string) (*UserAccessToken, error) {
	updates := map[string]any{"name": name}
	if scopes != nil {
		var grant UserAccessToken
		if err := grant.SetScopes(scopes); err != nil {
			return nil, err
		}
		updates["scopes"] = grant.Scopes
	}
	result := dbx.DB.Model(&UserAccessToken{}).Where("id = ? AND user_id = ?", id, userID).Updates(updates)
	if result.Error != nil {
		return nil, result.Error
	}
	token, err := GetUserAccessToken(userID, id)
	if err != nil {
		return nil, err
	}
	return token, nil
}

// DeleteUserAccessToken hard-deletes one token owned by userID.
func DeleteUserAccessToken(userID, id int) (*UserAccessToken, error) {
	var token UserAccessToken
	err := dbx.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ? AND user_id = ?", id, userID).First(&token).Error; err != nil {
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

// TouchUserAccessToken records the last use at most once per interval per token.
func TouchUserAccessToken(id int, ip string, now int64) error {
	if len(ip) > 64 {
		ip = ip[:64]
	}
	return dbx.DB.Model(&UserAccessToken{}).
		Where("id = ? AND last_used_at < ?", id, now-userAccessTokenTouchIntervalSecs).
		Updates(map[string]any{"last_used_at": now, "last_used_ip": ip}).Error
}

// DeleteExpiredUserAccessTokens removes tokens that expired before the cutoff.
func DeleteExpiredUserAccessTokens(before int64) error {
	for {
		var ids []int
		if err := dbx.DB.Model(&UserAccessToken{}).
			Where("expires_at > 0 AND expires_at < ?", before).
			Order("id").Limit(userAccessTokenCleanupBatchSize).Pluck("id", &ids).Error; err != nil {
			return err
		}
		if len(ids) == 0 {
			return nil
		}
		if err := dbx.DB.Where("id IN ?", ids).Delete(&UserAccessToken{}).Error; err != nil {
			return err
		}
		if len(ids) < userAccessTokenCleanupBatchSize {
			return nil
		}
	}
}

// AccessTokenHint is the last four characters of a token, shown so users can
// tell their tokens apart.
func AccessTokenHint(token string) string {
	token = strings.TrimRight(token, " ")
	if len(token) <= 4 {
		return ""
	}
	return token[len(token)-4:]
}

// AuthenticateAccessToken resolves a plaintext credential to its owning user
// and the token row. It returns (nil, nil, nil) when the credential does not
// match any PAT.
func AuthenticateAccessToken(token string) (*User, *UserAccessToken, error) {
	if token == "" {
		return nil, nil, nil
	}
	record, err := FindUserAccessTokenByHash(AccessTokenFingerprint(token))
	if err != nil && accessTokenTableMissing(err) {
		// A deployment whose schema predates the PAT table must not lose the
		// legacy credential: treat the lookup as "no PAT record" and keep
		// going. Any other failure is a real database error and propagates.
		common.SysError("user_access_tokens table unavailable, using legacy access token: " + err.Error())
		record = nil
	}
	if err != nil {
		return nil, nil, err
	}
	if record == nil {
		// Legacy fallback: the unscoped users.access_token column keeps
		// authenticating alongside scoped PATs.
		legacyUser, legacyErr := ValidateAccessToken(token)
		if legacyErr != nil || legacyUser == nil {
			return nil, nil, nil
		}
		return legacyUser, nil, nil
	}
	now := time.Now().Unix()
	if record.Expired(now) {
		return nil, record, ErrAccessTokenExpired
	}
	user := &User{}
	if err := dbx.DB.First(user, record.UserId).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, record, nil
		}
		return nil, nil, err
	}
	if user.Status != common.UserStatusEnabled {
		return nil, record, nil
	}
	_ = TouchUserAccessToken(record.Id, clientIPTouchPlaceholder(), now)
	return user, record, nil
}

// clientIPTouchPlaceholder keeps TouchUserAccessToken's signature without
// dragging request context into the identity layer; the middleware path can
// call TouchUserAccessToken directly when it has the real IP.
func clientIPTouchPlaceholder() string {
	return ""
}

// AccessTokenSessionID is the token-bound session identifier stored in
// AuthIdentity.SessionID for scoped PATs. Browser session IDs are UUIDs and
// can never carry this prefix.
func AccessTokenSessionID(id int) string {
	return "pat:" + strconv.Itoa(id)
}

// ParseAccessTokenSessionID extracts the token id from a "pat:<id>" session
// identifier.
func ParseAccessTokenSessionID(sid string) (int, bool) {
	raw, ok := strings.CutPrefix(sid, "pat:")
	if !ok {
		return 0, false
	}
	id, err := strconv.Atoi(raw)
	if err != nil || id <= 0 || strconv.Itoa(id) != raw {
		return 0, false
	}
	return id, true
}

// accessTokenTableMissing reports whether the error means the
// user_access_tokens table has not been migrated yet.
func accessTokenTableMissing(err error) bool {
	if err == nil {
		return false
	}
	message := err.Error()
	return strings.Contains(message, "no such table") ||
		strings.Contains(message, "does not exist")
}
