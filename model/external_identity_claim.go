package model

import (
	"crypto/sha256"
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	ExternalIdentityProviderOIDC     = "oidc"
	ExternalIdentityProviderTelegram = "telegram"

	externalIdentityProviderMaxBytes = 32
	externalIdentitySubjectMaxBytes  = 255
)

var (
	ErrExternalIdentityAlreadyClaimed = errors.New("external identity is already claimed")
	ErrExternalIdentityOwnerDeleted   = errors.New("external identity owner has been deleted")
)

// ExternalIdentityClaim is the durable ownership record for an identity issued
// by an external provider. The two unique indexes make both the provider
// subject and the user's provider slot single-owner without relying on a
// check-then-update sequence.
type ExternalIdentityClaim struct {
	Id            int64     `json:"id" gorm:"primaryKey"`
	Provider      string    `json:"provider" gorm:"type:varchar(32);not null;uniqueIndex:idx_external_identity_subject_digest,priority:1;uniqueIndex:idx_external_identity_user,priority:1"`
	Subject       string    `json:"subject" gorm:"type:varchar(255);not null"`
	SubjectDigest *string   `json:"-" gorm:"column:subject_digest;type:char(64);uniqueIndex:idx_external_identity_subject_digest,priority:2"`
	UserId        int       `json:"user_id" gorm:"not null;index;uniqueIndex:idx_external_identity_user,priority:2"`
	CreatedAt     time.Time `json:"created_at"`
}

func (ExternalIdentityClaim) TableName() string {
	return "external_identity_claims"
}

// MigrateExternalIdentityClaimSchema moves the legacy provider+subject index
// to a digest-backed exact-subject invariant. The digest makes the uniqueness
// comparison independent of a database's default text collation: OIDC
// subjects are opaque and case-sensitive, so they must never be merged by a
// case-insensitive MySQL index.
//
// The migration deliberately fails if old rows cannot be represented as exact
// identities. It never picks an owner, rewrites a subject, or consults email.
func MigrateExternalIdentityClaimSchema() error {
	if DB == nil {
		return errors.New("external identity claim database is unavailable")
	}
	migrator := DB.Migrator()
	if migrator.HasTable(&ExternalIdentityClaim{}) {
		// Older releases used a unique (provider, subject) index. Drop it before
		// widening Subject so an old MySQL installation cannot reject the column
		// change because of its indexed byte length. The new digest index remains
		// fixed-size and portable across SQLite, MySQL, and PostgreSQL.
		if migrator.HasIndex(&ExternalIdentityClaim{}, "idx_external_identity_subject") {
			if err := migrator.DropIndex(&ExternalIdentityClaim{}, "idx_external_identity_subject"); err != nil {
				return fmt.Errorf("drop legacy external identity subject index: %w", err)
			}
		}
	}
	if err := DB.AutoMigrate(&ExternalIdentityClaim{}); err != nil {
		return fmt.Errorf("migrate external identity claim schema: %w", err)
	}

	return DB.Transaction(func(tx *gorm.DB) error {
		var claims []ExternalIdentityClaim
		if err := tx.Find(&claims).Error; err != nil {
			return err
		}
		for _, claim := range claims {
			provider, subject, err := normalizeExternalIdentity(claim.Provider, claim.Subject)
			if err != nil {
				return fmt.Errorf("legacy external identity claim %d: %w", claim.Id, err)
			}
			if provider != claim.Provider || subject != claim.Subject || claim.UserId == 0 {
				return fmt.Errorf("legacy external identity claim %d is invalid", claim.Id)
			}
			digest := externalIdentitySubjectDigest(subject)
			if claim.SubjectDigest != nil && *claim.SubjectDigest != digest {
				return fmt.Errorf("legacy external identity claim %d has an inconsistent subject digest", claim.Id)
			}
			if claim.SubjectDigest == nil {
				if err := tx.Model(&ExternalIdentityClaim{}).Where("id = ?", claim.Id).
					Update("subject_digest", digest).Error; err != nil {
					return fmt.Errorf("backfill external identity claim %d: %w", claim.Id, err)
				}
			}
		}
		var missing int64
		if err := tx.Model(&ExternalIdentityClaim{}).
			Where("subject_digest IS NULL OR subject_digest = ?", "").Count(&missing).Error; err != nil {
			return err
		}
		if missing != 0 {
			return errors.New("external identity claim digest backfill is incomplete")
		}
		return nil
	})
}

// ClaimExternalIdentityWithTx atomically claims a provider subject for one
// user. Repeating the exact mapping is idempotent; every competing subject or
// user is rejected. Ownership is read back instead of trusting RowsAffected,
// whose duplicate-key semantics differ between supported databases.
func ClaimExternalIdentityWithTx(tx *gorm.DB, provider, subject string, userId int) error {
	if tx == nil || userId == 0 {
		return errors.New("external identity claim is invalid")
	}
	var err error
	provider, subject, err = normalizeExternalIdentity(provider, subject)
	if err != nil {
		return err
	}
	digest := externalIdentitySubjectDigest(subject)

	claim := ExternalIdentityClaim{Provider: provider, Subject: subject, SubjectDigest: &digest, UserId: userId}
	result := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&claim)
	if result.Error != nil {
		return result.Error
	}
	var subjectOwner ExternalIdentityClaim
	if err := tx.Where("provider = ? AND subject_digest = ?", provider, digest).First(&subjectOwner).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrExternalIdentityAlreadyClaimed
		}
		return err
	}
	if !claimHasExactSubject(subjectOwner, subject, digest) || subjectOwner.UserId != userId {
		return ErrExternalIdentityAlreadyClaimed
	}

	var userClaim ExternalIdentityClaim
	if err := tx.Where("provider = ? AND user_id = ?", provider, userId).First(&userClaim).Error; err != nil {
		return err
	}
	if !claimHasExactSubject(userClaim, subject, digest) {
		return ErrExternalIdentityAlreadyClaimed
	}
	return nil
}

// GetUserByExternalIdentity resolves an identity only through its durable,
// digest-backed claim. It intentionally has no fallback to an email address or
// a legacy nullable projection on users.
func GetUserByExternalIdentity(provider, subject string) (*User, error) {
	provider, subject, err := normalizeExternalIdentity(provider, subject)
	if err != nil {
		return nil, err
	}
	digest := externalIdentitySubjectDigest(subject)
	var claim ExternalIdentityClaim
	if err := DB.Where("provider = ? AND subject_digest = ?", provider, digest).First(&claim).Error; err != nil {
		return nil, err
	}
	if !claimHasExactSubject(claim, subject, digest) {
		return nil, ErrExternalIdentityAlreadyClaimed
	}
	user, err := GetUserById(claim.UserId, true)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrExternalIdentityOwnerDeleted
	}
	return user, err
}

func ReleaseExternalIdentityWithTx(tx *gorm.DB, provider string, userId int) error {
	provider = strings.TrimSpace(provider)
	if tx == nil || provider == "" || userId == 0 {
		return errors.New("external identity release is invalid")
	}
	return tx.Where("provider = ? AND user_id = ?", provider, userId).
		Delete(&ExternalIdentityClaim{}).Error
}

func releaseAllExternalIdentitiesWithTx(tx *gorm.DB, userId int) error {
	if tx == nil || userId == 0 {
		return errors.New("external identity release is invalid")
	}
	return tx.Where("user_id = ?", userId).Delete(&ExternalIdentityClaim{}).Error
}

// InitializeExternalIdentityClaims imports legacy Telegram and OIDC bindings
// after the claim table is migrated. Existing duplicate ownership fails
// migration rather than preserving an ambiguous login identity.
func InitializeExternalIdentityClaims() error {
	if err := MigrateExternalIdentityClaimSchema(); err != nil {
		return err
	}
	var users []User
	if err := DB.Unscoped().Select("id", "telegram_id", "oidc_id").
		Where("telegram_id <> ? OR oidc_id <> ?", "", "").Find(&users).Error; err != nil {
		return err
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		for _, user := range users {
			if user.TelegramId != "" {
				if err := ClaimExternalIdentityWithTx(tx, ExternalIdentityProviderTelegram, user.TelegramId, user.Id); err != nil {
					return fmt.Errorf("backfill Telegram identity for user %d: %w", user.Id, err)
				}
			}
			if user.OidcId != "" {
				if err := ClaimExternalIdentityWithTx(tx, ExternalIdentityProviderOIDC, user.OidcId, user.Id); err != nil {
					return fmt.Errorf("backfill OIDC identity for user %d: %w", user.Id, err)
				}
			}
		}
		return nil
	})
}

func normalizeExternalIdentity(provider, subject string) (string, string, error) {
	provider = strings.TrimSpace(provider)
	if provider == "" || len([]byte(provider)) > externalIdentityProviderMaxBytes || !utf8.ValidString(provider) || strings.IndexFunc(provider, unicode.IsControl) >= 0 {
		return "", "", errors.New("external identity provider is invalid")
	}
	// A subject is opaque. In particular, do not trim, lowercase, normalize, or
	// otherwise transform it before hashing or storing it.
	if subject == "" || len([]byte(subject)) > externalIdentitySubjectMaxBytes || !utf8.ValidString(subject) || strings.IndexFunc(subject, unicode.IsControl) >= 0 {
		return "", "", errors.New("external identity subject is invalid")
	}
	return provider, subject, nil
}

func externalIdentitySubjectDigest(subject string) string {
	digest := sha256.Sum256([]byte(subject))
	return fmt.Sprintf("%x", digest[:])
}

func claimHasExactSubject(claim ExternalIdentityClaim, subject, digest string) bool {
	return claim.SubjectDigest != nil && *claim.SubjectDigest == digest && claim.Subject == subject
}
