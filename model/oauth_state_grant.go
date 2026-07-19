package model

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"strings"
	"time"
)

var ErrOAuthStateGrantInvalid = errors.New("OAuth state grant is invalid, expired, or already consumed")

// OAuthStateGrant stores only a digest of the browser-visible OAuth state.
// Claiming a grant is a single conditional DELETE, which makes state
// consumption atomic across requests and application instances.
type OAuthStateGrant struct {
	Id        int64     `json:"id" gorm:"primaryKey"`
	StateHash string    `json:"-" gorm:"type:char(64);not null;uniqueIndex"`
	Provider  string    `json:"provider" gorm:"type:varchar(64);not null"`
	ExpiresAt time.Time `json:"expires_at" gorm:"not null;index"`
	CreatedAt time.Time `json:"created_at"`
}

func (OAuthStateGrant) TableName() string {
	return "oauth_state_grants"
}

func hashOAuthState(state string) string {
	digest := sha256.Sum256([]byte(state))
	return hex.EncodeToString(digest[:])
}

func normalizeOAuthStateProvider(provider string) string {
	return strings.ToLower(strings.TrimSpace(provider))
}

func CreateOAuthStateGrant(state string, provider string, expiresAt time.Time) error {
	state = strings.TrimSpace(state)
	provider = normalizeOAuthStateProvider(provider)
	if state == "" || provider == "" || expiresAt.IsZero() {
		return ErrOAuthStateGrantInvalid
	}

	grant := &OAuthStateGrant{
		StateHash: hashOAuthState(state),
		Provider:  provider,
		ExpiresAt: expiresAt.UTC(),
	}
	if err := DB.Create(grant).Error; err != nil {
		return err
	}

	// Successful grants are deleted when claimed. This bounded cleanup removes
	// abandoned or expired authorization attempts without retaining plaintext
	// state or invitation codes in the database.
	_ = DB.Where("expires_at < ?", time.Now().UTC()).Delete(&OAuthStateGrant{}).Error
	return nil
}

func ClaimOAuthStateGrant(state string, provider string, now time.Time) error {
	state = strings.TrimSpace(state)
	provider = normalizeOAuthStateProvider(provider)
	if state == "" || provider == "" || now.IsZero() {
		return ErrOAuthStateGrantInvalid
	}

	result := DB.Where(
		"state_hash = ? AND provider = ? AND expires_at >= ?",
		hashOAuthState(state),
		provider,
		now.UTC(),
	).Delete(&OAuthStateGrant{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != 1 {
		return ErrOAuthStateGrantInvalid
	}
	return nil
}
