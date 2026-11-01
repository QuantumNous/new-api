package model

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

const (
	PartnerOAuthClientStatusEnabled  = 1
	PartnerOAuthClientStatusDisabled = 2

	PartnerOAuthTokenAuthMethodBasic = "client_secret_basic"
	PartnerOAuthTokenAuthMethodNone  = "none"

	PartnerOAuthBindingStatusActive  = "active"
	PartnerOAuthBindingStatusRevoked = "revoked"

	PartnerOAuthTokenKindAccess  = "access"
	PartnerOAuthTokenKindRefresh = "refresh"

	PartnerOAuthTokenStatusActive  = "active"
	PartnerOAuthTokenStatusRotated = "rotated"
	PartnerOAuthTokenStatusRevoked = "revoked"

	PartnerOAuthMaxActiveBindings = 10
)

var (
	ErrPartnerOAuthClientNotFound   = errors.New("partner oauth client not found")
	ErrPartnerOAuthBindingNotFound  = errors.New("partner oauth binding not found")
	ErrPartnerOAuthTokenNotFound    = errors.New("partner oauth token not found")
	ErrPartnerOAuthRefreshReused    = errors.New("partner oauth refresh token reused")
	ErrPartnerOAuthBindingLimit     = errors.New("partner oauth binding limit reached")
	ErrPartnerOAuthSecretRotateNone = errors.New("public partner oauth clients have no secret")
)

type PartnerOAuthClient struct {
	Id              int64  `json:"id" gorm:"primaryKey"`
	ClientId        string `json:"client_id" gorm:"type:varchar(64);not null;uniqueIndex"`
	Name            string `json:"name" gorm:"type:varchar(64);not null"`
	TokenAuthMethod string `json:"token_auth_method" gorm:"type:varchar(32);not null"`
	SecretHash      string `json:"-" gorm:"type:char(64)"`
	RedirectURIs    string `json:"redirect_uris" gorm:"type:text;not null"`
	Scopes          string `json:"scopes" gorm:"type:varchar(255);not null"`
	Status          int    `json:"status" gorm:"not null"`
	CreatedAt       int64  `json:"created_at" gorm:"type:bigint"`
	UpdatedAt       int64  `json:"updated_at" gorm:"type:bigint"`
}

func (PartnerOAuthClient) TableName() string {
	return "partner_oauth_clients"
}

type PartnerOAuthBinding struct {
	Id                  int64  `json:"id" gorm:"primaryKey"`
	BindingId           string `json:"binding_id" gorm:"type:varchar(64);not null;uniqueIndex"`
	ClientId            string `json:"client_id" gorm:"type:varchar(64);not null;index"`
	UserId              int    `json:"user_id" gorm:"not null;index"`
	UserAuthVersion     int64  `json:"user_auth_version" gorm:"type:bigint"`
	Scope               string `json:"scope" gorm:"type:varchar(255)"`
	Status              string `json:"status" gorm:"type:varchar(16);not null"`
	TokenId             int    `json:"token_id" gorm:"default:0"`
	AuthorizationFlowId int64  `json:"authorization_flow_id" gorm:"index"`
	ExpiresAt           int64  `json:"expires_at" gorm:"type:bigint"`
	CreatedAt           int64  `json:"created_at" gorm:"type:bigint"`
	RevokedAt           int64  `json:"revoked_at" gorm:"type:bigint;default:0"`
	RevokedReason       string `json:"revoked_reason" gorm:"type:varchar(64)"`
}

func (PartnerOAuthBinding) TableName() string {
	return "partner_oauth_bindings"
}

type PartnerOAuthToken struct {
	Id        int64  `json:"id" gorm:"primaryKey"`
	TokenHash string `json:"-" gorm:"type:char(64);not null;uniqueIndex"`
	Kind      string `json:"kind" gorm:"type:varchar(16);not null"`
	BindingId string `json:"binding_id" gorm:"type:varchar(64);not null;index"`
	Status    string `json:"status" gorm:"type:varchar(16);not null"`
	ExpiresAt int64  `json:"expires_at" gorm:"type:bigint;index"`
	CreatedAt int64  `json:"created_at" gorm:"type:bigint"`
}

func (PartnerOAuthToken) TableName() string {
	return "partner_oauth_tokens"
}

func HashPartnerOAuthSecret(secret string) string {
	sum := sha256.Sum256([]byte(secret))
	return hex.EncodeToString(sum[:])
}

func HashPartnerOAuthToken(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

func newPartnerHexID(prefix string) (string, error) {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return prefix + hex.EncodeToString(buf), nil
}

func CreatePartnerOAuthClient(client *PartnerOAuthClient) error {
	now := common.GetTimestamp()
	if client.ClientId == "" {
		id, err := newPartnerHexID("pc_")
		if err != nil {
			return err
		}
		client.ClientId = id
	}
	if client.Status == 0 {
		client.Status = PartnerOAuthClientStatusEnabled
	}
	if client.CreatedAt == 0 {
		client.CreatedAt = now
	}
	client.UpdatedAt = now
	return DB.Create(client).Error
}

func GetPartnerOAuthClientByClientID(clientID string) (*PartnerOAuthClient, error) {
	var client PartnerOAuthClient
	err := DB.Where("client_id = ?", clientID).First(&client).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrPartnerOAuthClientNotFound
	}
	return &client, err
}

func GetPartnerOAuthClientByID(id int64) (*PartnerOAuthClient, error) {
	if id <= 0 {
		return nil, ErrPartnerOAuthClientNotFound
	}
	var client PartnerOAuthClient
	err := DB.First(&client, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrPartnerOAuthClientNotFound
	}
	return &client, err
}

func ListPartnerOAuthClients() ([]PartnerOAuthClient, error) {
	clients := make([]PartnerOAuthClient, 0)
	err := DB.Order("id desc").Find(&clients).Error
	return clients, err
}

func UpdatePartnerOAuthClient(client *PartnerOAuthClient) error {
	client.UpdatedAt = common.GetTimestamp()
	return DB.Model(client).Select("name", "redirect_uris", "scopes", "status", "secret_hash", "updated_at").Updates(client).Error
}

func RotatePartnerOAuthClientSecret(clientID, secretHash string) error {
	client, err := GetPartnerOAuthClientByClientID(clientID)
	if err != nil {
		return err
	}
	if client.TokenAuthMethod != PartnerOAuthTokenAuthMethodBasic {
		return ErrPartnerOAuthSecretRotateNone
	}
	client.SecretHash = secretHash
	return UpdatePartnerOAuthClient(client)
}

func DeletePartnerOAuthClient(clientID string) ([]PartnerOAuthBinding, error) {
	var revoked []PartnerOAuthBinding
	err := DB.Transaction(func(tx *gorm.DB) error {
		var client PartnerOAuthClient
		if err := tx.Where("client_id = ?", clientID).First(&client).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrPartnerOAuthClientNotFound
			}
			return err
		}
		// A partner's sub-accounts hold user wallets and live keys; deleting
		// the client would orphan them, so it can only be disabled.
		var accounts int64
		if err := tx.Model(&PartnerAccount{}).Where("client_id = ?", clientID).Count(&accounts).Error; err != nil {
			return err
		}
		if accounts > 0 {
			return ErrPartnerOAuthClientHasAccounts
		}
		var bindings []PartnerOAuthBinding
		if err := tx.Where("client_id = ? AND status = ?", clientID, PartnerOAuthBindingStatusActive).Find(&bindings).Error; err != nil {
			return err
		}
		for i := range bindings {
			var current PartnerOAuthBinding
			if err := lockForUpdate(tx).Where("binding_id = ?", bindings[i].BindingId).First(&current).Error; err != nil {
				return err
			}
			if current.Status != PartnerOAuthBindingStatusActive {
				continue
			}
			if err := RevokePartnerOAuthBindingWithTx(tx, current.BindingId, "client_deleted"); err != nil {
				return err
			}
			revoked = append(revoked, current)
		}
		if err := tx.Delete(&client).Error; err != nil {
			return err
		}
		return nil
	})
	return revoked, err
}

type PartnerOAuthBindingCreate struct {
	ClientId            string
	UserId              int
	UserAuthVersion     int64
	Scope               string
	AuthorizationFlowId int64
	ExpiresAt           int64
	AccessTokenHash     string
	AccessExpiresAt     int64
	RefreshTokenHash    string
}

func CreatePartnerOAuthBindingWithTx(tx *gorm.DB, input PartnerOAuthBindingCreate) (*PartnerOAuthBinding, error) {
	bindingID, err := newPartnerHexID("bnd_")
	if err != nil {
		return nil, err
	}
	now := common.GetTimestamp()
	binding := &PartnerOAuthBinding{
		BindingId:           bindingID,
		ClientId:            input.ClientId,
		UserId:              input.UserId,
		UserAuthVersion:     input.UserAuthVersion,
		Scope:               input.Scope,
		Status:              PartnerOAuthBindingStatusActive,
		AuthorizationFlowId: input.AuthorizationFlowId,
		ExpiresAt:           input.ExpiresAt,
		CreatedAt:           now,
	}
	if err := tx.Create(binding).Error; err != nil {
		return nil, err
	}
	access := PartnerOAuthToken{
		TokenHash: input.AccessTokenHash,
		Kind:      PartnerOAuthTokenKindAccess,
		BindingId: bindingID,
		Status:    PartnerOAuthTokenStatusActive,
		ExpiresAt: input.AccessExpiresAt,
		CreatedAt: now,
	}
	if err := tx.Create(&access).Error; err != nil {
		return nil, err
	}
	if input.RefreshTokenHash != "" {
		refresh := PartnerOAuthToken{
			TokenHash: input.RefreshTokenHash,
			Kind:      PartnerOAuthTokenKindRefresh,
			BindingId: bindingID,
			Status:    PartnerOAuthTokenStatusActive,
			ExpiresAt: input.ExpiresAt,
			CreatedAt: now,
		}
		if err := tx.Create(&refresh).Error; err != nil {
			return nil, err
		}
	}
	return binding, nil
}

func GetPartnerOAuthBindingByBindingID(bindingID string) (*PartnerOAuthBinding, error) {
	var binding PartnerOAuthBinding
	err := DB.Where("binding_id = ?", bindingID).First(&binding).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrPartnerOAuthBindingNotFound
	}
	return &binding, err
}

func CountActivePartnerOAuthBindings(tx *gorm.DB, userID int, clientID string) (int64, error) {
	now := common.GetTimestamp()
	var count int64
	err := tx.Model(&PartnerOAuthBinding{}).
		Where("user_id = ? AND client_id = ? AND status = ? AND expires_at > ?", userID, clientID, PartnerOAuthBindingStatusActive, now).
		Count(&count).Error
	return count, err
}

func ListActivePartnerOAuthBindingsByUser(userID int, limit int) ([]PartnerOAuthBinding, error) {
	if limit <= 0 || limit > 100 {
		limit = 100
	}
	now := common.GetTimestamp()
	bindings := make([]PartnerOAuthBinding, 0)
	err := DB.Where("user_id = ? AND status = ? AND expires_at > ?", userID, PartnerOAuthBindingStatusActive, now).
		Order("id desc").
		Limit(limit).
		Find(&bindings).Error
	return bindings, err
}

func FindPartnerOAuthToken(hash string) (*PartnerOAuthToken, error) {
	var token PartnerOAuthToken
	err := DB.Where("token_hash = ?", hash).First(&token).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrPartnerOAuthTokenNotFound
	}
	return &token, err
}

func FindPartnerOAuthTokenWithTx(tx *gorm.DB, hash string) (*PartnerOAuthToken, error) {
	var token PartnerOAuthToken
	err := tx.Where("token_hash = ?", hash).First(&token).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrPartnerOAuthTokenNotFound
	}
	return &token, err
}

func RotatePartnerOAuthRefreshToken(tx *gorm.DB, current *PartnerOAuthToken, accessHash, refreshHash string, accessExpiresAt int64) error {
	result := tx.Model(&PartnerOAuthToken{}).
		Where("id = ? AND status = ?", current.Id, PartnerOAuthTokenStatusActive).
		Update("status", PartnerOAuthTokenStatusRotated)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != 1 {
		return ErrPartnerOAuthRefreshReused
	}
	now := common.GetTimestamp()
	access := PartnerOAuthToken{
		TokenHash: accessHash,
		Kind:      PartnerOAuthTokenKindAccess,
		BindingId: current.BindingId,
		Status:    PartnerOAuthTokenStatusActive,
		ExpiresAt: accessExpiresAt,
		CreatedAt: now,
	}
	if err := tx.Create(&access).Error; err != nil {
		return err
	}
	refresh := PartnerOAuthToken{
		TokenHash: refreshHash,
		Kind:      PartnerOAuthTokenKindRefresh,
		BindingId: current.BindingId,
		Status:    PartnerOAuthTokenStatusActive,
		ExpiresAt: current.ExpiresAt,
		CreatedAt: now,
	}
	return tx.Create(&refresh).Error
}

func RevokePartnerOAuthBindingWithTx(tx *gorm.DB, bindingID, reason string) error {
	var binding PartnerOAuthBinding
	if err := lockForUpdate(tx).Where("binding_id = ?", bindingID).First(&binding).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		return err
	}
	if binding.Status != PartnerOAuthBindingStatusActive {
		return nil
	}
	now := common.GetTimestamp()
	if err := tx.Model(&binding).Updates(map[string]any{
		"status":         PartnerOAuthBindingStatusRevoked,
		"revoked_at":     now,
		"revoked_reason": reason,
	}).Error; err != nil {
		return err
	}
	if err := tx.Model(&PartnerOAuthToken{}).
		Where("binding_id = ? AND status <> ?", bindingID, PartnerOAuthTokenStatusRevoked).
		Update("status", PartnerOAuthTokenStatusRevoked).Error; err != nil {
		return err
	}
	if binding.TokenId <= 0 {
		return nil
	}
	var token Token
	if err := tx.Unscoped().Where("id = ?", binding.TokenId).First(&token).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		return err
	}
	if cacheErr := invalidateTokenCacheForMutation(token.Key); cacheErr != nil {
		common.SysLog("failed to invalidate partner oauth token cache: " + cacheErr.Error())
	}
	return tx.Model(&token).Update("status", common.TokenStatusDisabled).Error
}

func RevokePartnerOAuthBindingByAuthorizationFlow(flowID int64, reason string) (*PartnerOAuthBinding, error) {
	if flowID <= 0 {
		return nil, nil
	}
	var revoked *PartnerOAuthBinding
	err := DB.Transaction(func(tx *gorm.DB) error {
		var binding PartnerOAuthBinding
		err := lockForUpdate(tx).Where("authorization_flow_id = ?", flowID).First(&binding).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		if err != nil || binding.Status != PartnerOAuthBindingStatusActive {
			return err
		}
		if err := RevokePartnerOAuthBindingWithTx(tx, binding.BindingId, reason); err != nil {
			return err
		}
		revoked = &binding
		return nil
	})
	return revoked, err
}

type PartnerOAuthCredentialIssue struct {
	UserId      int
	Name        string
	Group       string
	ExpiredTime int64
	Key         string
}

func IssuePartnerOAuthCredential(bindingID string, issue PartnerOAuthCredentialIssue) (*Token, bool, error) {
	var issued *Token
	var created bool
	err := DB.Transaction(func(tx *gorm.DB) error {
		var binding PartnerOAuthBinding
		if err := lockForUpdate(tx).Where("binding_id = ?", bindingID).First(&binding).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrPartnerOAuthBindingNotFound
			}
			return err
		}
		// A revoke that committed after the caller authenticated left no key to
		// disable, so issuing here would create a live key for a dead binding.
		if binding.Status != PartnerOAuthBindingStatusActive || binding.ExpiresAt <= common.GetTimestamp() {
			return ErrPartnerOAuthBindingNotFound
		}
		if binding.TokenId > 0 {
			var existing Token
			if err := tx.Unscoped().Where("id = ? AND user_id = ?", binding.TokenId, issue.UserId).First(&existing).Error; err != nil {
				return err
			}
			issued = &existing
			return nil
		}
		token := Token{
			UserId:             issue.UserId,
			Name:               issue.Name,
			Key:                issue.Key,
			CreatedTime:        common.GetTimestamp(),
			AccessedTime:       common.GetTimestamp(),
			ExpiredTime:        issue.ExpiredTime,
			UnlimitedQuota:     true,
			ModelLimitsEnabled: false,
			Status:             common.TokenStatusEnabled,
			Group:              issue.Group,
		}
		if err := tx.Create(&token).Error; err != nil {
			return err
		}
		if err := tx.Model(&binding).Update("token_id", token.Id).Error; err != nil {
			return err
		}
		issued = &token
		created = true
		return nil
	})
	if err != nil {
		return nil, false, err
	}
	return issued, created, nil
}

func DeleteExpiredPartnerOAuthTokens(now int64) error {
	cutoff := now - int64((24 * time.Hour).Seconds())
	return DB.Where("expires_at < ?", cutoff).Delete(&PartnerOAuthToken{}).Error
}

func LockPartnerOAuthUserWithTx(tx *gorm.DB, userID int) (*User, error) {
	var user User
	if err := lockForUpdate(tx).First(&user, userID).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func LockPartnerOAuthBindingWithTx(tx *gorm.DB, bindingID string) (*PartnerOAuthBinding, error) {
	var binding PartnerOAuthBinding
	if err := lockForUpdate(tx).Where("binding_id = ?", bindingID).First(&binding).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrPartnerOAuthBindingNotFound
		}
		return nil, err
	}
	return &binding, nil
}

func PartnerOAuthAccountID(userID int) string {
	return fmt.Sprintf("acct_%d", userID)
}

func PartnerOAuthKeyID(tokenID int) string {
	return fmt.Sprintf("key_%d", tokenID)
}
