package identity

import (
	"github.com/QuantumNous/new-api/internal/common/dbx"
	"github.com/QuantumNous/new-api/internal/identity/policy"
)

// Identity-domain records register separately so this file moves wholesale into
// internal/identity along with the records themselves. Keeping them out of
// migrations.go means that move does not have to edit a shared list.
func init() {
	dbx.RegisterMigrations(
		dbx.Migration{Model: &Token{}, Name: "Token"},
		dbx.Migration{Model: &User{}, Name: "User"},
		dbx.Migration{Model: &UserSession{}, Name: "UserSession"},
		dbx.Migration{Model: &AuthFlow{}, Name: "AuthFlow"},
		dbx.Migration{Model: &ExternalIdentityClaim{}, Name: "ExternalIdentityClaim"},
		dbx.Migration{Model: &PasskeyCredential{}, Name: "PasskeyCredential"},
		dbx.Migration{Model: &TwoFA{}, Name: "TwoFA"},
		dbx.Migration{Model: &TwoFABackupCode{}, Name: "TwoFABackupCode"},
		dbx.Migration{Model: &CustomOAuthProvider{}, Name: "CustomOAuthProvider"},
		dbx.Migration{Model: &UserOAuthBinding{}, Name: "UserOAuthBinding"},
		dbx.Migration{Model: &UserAccessToken{}, Name: "UserAccessToken"},
		dbx.Migration{Model: &policy.CasbinRule{}, Name: "CasbinRule"},
		dbx.Migration{Model: &policy.AuthzRole{}, Name: "AuthzRole"},
		dbx.Migration{Model: &QQBinding{}, Name: "QQBinding"},
		dbx.Migration{Model: &QQBindCode{}, Name: "QQBindCode"},
		dbx.Migration{Model: &QQUnbindRecord{}, Name: "QQUnbindRecord"},
	)
	// Backfills that a schema change alone cannot express: both seed a new column
	// from existing rows and must run after AutoMigrate.
	dbx.RegisterPostMigration(
		InitializeUserAuthVersions,
		InitializeExternalIdentityClaims,
	)
}
