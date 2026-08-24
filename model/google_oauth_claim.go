package model

import (
	"errors"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var ErrGoogleOAuthClaimConflict = errors.New("google oauth identity conflicts with multiple claims")

type GoogleOAuthClaim struct {
	ID              int    `gorm:"primaryKey"`
	NormalizedEmail string `gorm:"type:varchar(50);not null;uniqueIndex"`
	GoogleID        string `gorm:"type:varchar(255);not null;uniqueIndex"`
	UserID          int    `gorm:"not null;uniqueIndex"`
	CreatedAt       int64  `gorm:"autoCreateTime"`
}

func (GoogleOAuthClaim) TableName() string {
	return "google_oauth_claims"
}

// ClaimGoogleOAuthIdentityWithTx reserves a verified Google identity inside
// the caller's transaction. The boolean reports whether the requested user
// owns the final claim, including an idempotent retry of the exact claim.
func ClaimGoogleOAuthIdentityWithTx(tx *gorm.DB, userID int, email string, googleID string) (GoogleOAuthClaim, bool, error) {
	if tx == nil {
		return GoogleOAuthClaim{}, false, errors.New("database transaction is nil")
	}
	normalizedEmail := NormalizeUserEmail(email)
	if userID <= 0 || normalizedEmail == "" || googleID == "" {
		return GoogleOAuthClaim{}, false, errors.New("google oauth claim requires user, email, and google id")
	}

	claim := GoogleOAuthClaim{
		NormalizedEmail: normalizedEmail,
		GoogleID:        googleID,
		UserID:          userID,
	}
	result := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&claim)
	if result.Error != nil {
		return GoogleOAuthClaim{}, false, result.Error
	}

	var conflicts []GoogleOAuthClaim
	// This locking read is also a current read under MySQL's default repeatable
	// read isolation, so a loser can see the row that made its insert a no-op.
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where(
		"normalized_email = ? OR google_id = ? OR user_id = ?",
		normalizedEmail,
		googleID,
		userID,
	).Find(&conflicts).Error; err != nil {
		return GoogleOAuthClaim{}, false, err
	}
	if len(conflicts) == 1 {
		winner := conflicts[0]
		owned := winner.NormalizedEmail == normalizedEmail &&
			winner.GoogleID == googleID &&
			winner.UserID == userID
		return winner, owned, nil
	}
	if len(conflicts) == 0 {
		return GoogleOAuthClaim{}, false, errors.New("google oauth claim insert was ignored without an existing winner")
	}
	return GoogleOAuthClaim{}, false, ErrGoogleOAuthClaimConflict
}
