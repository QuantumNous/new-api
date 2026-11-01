package model

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"slices"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relaykit/dto"

	"gorm.io/gorm"
)

const (
	PartnerAccountStatusActive   = "active"
	PartnerAccountStatusDisabled = "disabled"
	// PartnerAccountStatusAdminDisabled is how an administrator's disable is
	// reported; it is stored separately as AdminDisabled.
	PartnerAccountStatusAdminDisabled = "admin_disabled"

	// PartnerAccountKeyGraceSeconds keeps the replaced key usable after a
	// planned rotation, so long-running partner jobs can switch over.
	PartnerAccountKeyGraceSeconds = 24 * 60 * 60

	partnerAccountUsernamePrefix = "pa_"
)

var (
	ErrPartnerAccountNotFound            = errors.New("partner account not found")
	ErrPartnerAccountLimit               = errors.New("partner account limit reached")
	ErrPartnerAccountRateLimited         = errors.New("partner account creation rate limited")
	ErrPartnerAccountInactive            = errors.New("partner account is disabled")
	ErrPartnerAccountAdminDisabled       = errors.New("partner account was disabled by an administrator")
	ErrPartnerAccountCredentialDisabled  = errors.New("partner account credential is disabled")
	ErrPartnerAccountIdempotencyConflict = errors.New("partner account idempotency key reused with a different request")
	ErrPartnerOAuthClientHasAccounts     = errors.New("partner oauth client still owns partner accounts")
	ErrPartnerSubAccountUndeletable      = errors.New("partner sub-accounts cannot be deleted")

	ErrPartnerAccountPaymentOrderNotFound   = errors.New("partner account payment order not found")
	ErrPartnerAccountPaymentIdempotencyRace = errors.New("partner account payment idempotency key already used")
	ErrPartnerAccountPaymentRateLimited     = errors.New("partner account payment order limit reached")
)

// PartnerAccount maps one end user of a partner to the YesChoy sub-account
// that holds the user's wallet. The mapping never changes once created. The
// unique key uses a hash of the external ID so that case-sensitive matching is
// identical on SQLite, MySQL and PostgreSQL.
//
// Three independent switches decide whether the sub-account's user is
// enabled: the partner's own Status, an administrator's AdminDisabled, and the
// partner's suspension. applyPartnerAccountUserStatusTx derives users.status
// from all three, so no switch can undo another.
type PartnerAccount struct {
	Id                 int64  `json:"id" gorm:"primaryKey"`
	ClientId           string `json:"client_id" gorm:"type:varchar(64);not null;uniqueIndex:ux_partner_account_external,priority:1;index:idx_partner_account_client_created,priority:1"`
	ExternalUserId     string `json:"external_user_id" gorm:"type:varchar(64);not null"`
	ExternalUserIdHash string `json:"-" gorm:"type:char(64);not null;uniqueIndex:ux_partner_account_external,priority:2"`
	UserId             int    `json:"user_id" gorm:"not null;uniqueIndex"`
	// Status is the partner's choice: active or disabled.
	Status        string `json:"status" gorm:"type:varchar(16);not null"`
	AdminDisabled bool   `json:"admin_disabled"`
	// SuspendedByPartner records that the user's status currently reflects the
	// partner's suspension; it lets a restart finish an interrupted resume.
	SuspendedByPartner bool `json:"suspended_by_partner"`
	TokenId            int  `json:"token_id" gorm:"default:0"`
	// PreviousTokenId is the key replaced by the last rotation while it may
	// still be inside its grace period.
	PreviousTokenId   int    `json:"previous_token_id" gorm:"default:0"`
	RotateKeyHash     string `json:"-" gorm:"type:char(64)"`
	RotateRequestHash string `json:"-" gorm:"type:char(64)"`
	CreatedAt         int64  `json:"created_at" gorm:"type:bigint;not null;index:idx_partner_account_client_created,priority:2"`
	UpdatedAt         int64  `json:"updated_at" gorm:"type:bigint"`
}

func (PartnerAccount) TableName() string {
	return "partner_accounts"
}

// Usable reports whether neither the partner nor an administrator disabled
// the account. Suspension is checked separately, per partner.
func (account *PartnerAccount) Usable() bool {
	return account.Status == PartnerAccountStatusActive && !account.AdminDisabled
}

// ReportedStatus is the status partners and administrators see.
func (account *PartnerAccount) ReportedStatus() string {
	if account.AdminDisabled {
		return PartnerAccountStatusAdminDisabled
	}
	return account.Status
}

// PartnerAccountPaymentOrder links a top-up to the partner sub-account it was
// placed for. The order itself is a normal top_ups row settled by the Epay
// callbacks; this row scopes lookups and idempotency to the partner and keeps
// the checkout the payment gateway returned for replays.
type PartnerAccountPaymentOrder struct {
	Id                 int64  `json:"id" gorm:"primaryKey"`
	ClientId           string `json:"client_id" gorm:"type:varchar(64);not null;uniqueIndex:ux_partner_account_payment_idempotency,priority:1;index:idx_partner_account_payment_client_created,priority:1"`
	IdempotencyKeyHash string `json:"-" gorm:"type:char(64);not null;uniqueIndex:ux_partner_account_payment_idempotency,priority:2"`
	RequestHash        string `json:"-" gorm:"type:char(64);not null"`
	PartnerAccountId   int64  `json:"partner_account_id" gorm:"not null;index:idx_partner_account_payment_account_created,priority:1"`
	UserId             int    `json:"user_id" gorm:"not null;index"`
	TopUpId            int    `json:"top_up_id" gorm:"not null;uniqueIndex"`
	RequestedAmount    int64  `json:"requested_amount" gorm:"type:bigint;not null"`
	QRCode             string `json:"-" gorm:"column:qr_code;type:text"`
	PayURL             string `json:"-" gorm:"column:pay_url;type:text"`
	// CheckoutAttemptedAt is when a caller last claimed the gateway call, so
	// concurrent requests for one order never contact the gateway twice.
	CheckoutAttemptedAt int64 `json:"-" gorm:"type:bigint;default:0"`
	CreatedAt           int64 `json:"created_at" gorm:"type:bigint;not null;index:idx_partner_account_payment_account_created,priority:2;index:idx_partner_account_payment_client_created,priority:2"`
}

func (PartnerAccountPaymentOrder) TableName() string {
	return "partner_account_payment_orders"
}

func HashPartnerExternalUserID(externalUserID string) string {
	sum := sha256.Sum256([]byte(externalUserID))
	return hex.EncodeToString(sum[:])
}

// PartnerAccountOwner identifies the partner end user an operation targets.
// DisplayName is used only when the operation has to create the sub-account.
type PartnerAccountOwner struct {
	ClientId       string
	ExternalUserId string
	DisplayName    string
}

func GetPartnerAccount(clientID, externalUserID string) (*PartnerAccount, error) {
	var account PartnerAccount
	err := DB.Where("client_id = ? AND external_user_id_hash = ?", clientID, HashPartnerExternalUserID(externalUserID)).First(&account).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrPartnerAccountNotFound
	}
	if err != nil {
		return nil, err
	}
	return &account, nil
}

func GetPartnerAccountByUserID(userID int) (*PartnerAccount, error) {
	var account PartnerAccount
	err := DB.Where("user_id = ?", userID).First(&account).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrPartnerAccountNotFound
	}
	if err != nil {
		return nil, err
	}
	return &account, nil
}

func IsPartnerSubAccount(userID int) (bool, error) {
	var count int64
	err := DB.Model(&PartnerAccount{}).Where("user_id = ?", userID).Count(&count).Error
	return count > 0, err
}

func CountPartnerAccounts(clientID string) (int64, error) {
	var count int64
	err := DB.Model(&PartnerAccount{}).Where("client_id = ?", clientID).Count(&count).Error
	return count, err
}

func ListPartnerAccounts(clientID string, offset, limit int) ([]PartnerAccount, int64, error) {
	var accounts []PartnerAccount
	var total int64
	query := DB.Model(&PartnerAccount{}).Where("client_id = ?", clientID)
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := query.Order("id desc").Offset(offset).Limit(limit).Find(&accounts).Error
	return accounts, total, err
}

// ensurePartnerAccountTx returns the owner's sub-account and whether this call
// created it. Creation locks the partner's server config row, so the account
// cap and creation rate are checked one creation at a time and two concurrent
// first requests for the same ID cannot both insert.
func ensurePartnerAccountTx(tx *gorm.DB, owner PartnerAccountOwner) (*PartnerAccount, bool, error) {
	if owner.ClientId == "" || owner.ExternalUserId == "" {
		return nil, false, errors.New("invalid partner account owner")
	}
	hash := HashPartnerExternalUserID(owner.ExternalUserId)
	var account PartnerAccount
	err := tx.Where("client_id = ? AND external_user_id_hash = ?", owner.ClientId, hash).First(&account).Error
	if err == nil {
		return &account, false, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, false, err
	}

	var config PartnerServerConfig
	if err := lockForUpdate(tx).Where("client_id = ?", owner.ClientId).First(&config).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, false, ErrPartnerServerUnavailable
		}
		return nil, false, err
	}
	if !config.Enabled || config.SuspendedAt != 0 {
		return nil, false, ErrPartnerServerUnavailable
	}
	err = tx.Where("client_id = ? AND external_user_id_hash = ?", owner.ClientId, hash).First(&account).Error
	if err == nil {
		return &account, false, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, false, err
	}

	now := common.GetTimestamp()
	var total int64
	if err := tx.Model(&PartnerAccount{}).Where("client_id = ?", owner.ClientId).Count(&total).Error; err != nil {
		return nil, false, err
	}
	if total >= int64(config.MaxAccounts) {
		return nil, false, ErrPartnerAccountLimit
	}
	var recent int64
	if err := tx.Model(&PartnerAccount{}).Where("client_id = ? AND created_at > ?", owner.ClientId, now-60).Count(&recent).Error; err != nil {
		return nil, false, err
	}
	if recent >= int64(config.AccountsPerMinute) {
		return nil, false, ErrPartnerAccountRateLimited
	}

	user, err := createPartnerSubAccountUserTx(tx, owner.DisplayName, config.AccountGroup)
	if err != nil {
		return nil, false, err
	}
	account = PartnerAccount{
		ClientId:           owner.ClientId,
		ExternalUserId:     owner.ExternalUserId,
		ExternalUserIdHash: hash,
		UserId:             user.Id,
		Status:             PartnerAccountStatusActive,
		CreatedAt:          now,
		UpdatedAt:          now,
	}
	if err := tx.Create(&account).Error; err != nil {
		return nil, false, err
	}
	return &account, true, nil
}

// createPartnerSubAccountUserTx creates the wallet user behind a partner
// account. It deliberately bypasses User.Insert: a sub-account gets no sign-up
// bonus, no inviter and no registration log. It has no password or email, so
// no sign-in path can reach it. The wallet ledger still gets the same
// non-refundable zero opening a bonus-free registration writes.
func createPartnerSubAccountUserTx(tx *gorm.DB, displayName, group string) (*User, error) {
	username, err := common.GenerateRandomCharsKey(16)
	if err != nil {
		return nil, err
	}
	// Registration's 4-character codes would collide across 100k accounts.
	affCode, err := common.GenerateRandomCharsKey(16)
	if err != nil {
		return nil, err
	}
	user := &User{
		Username:    partnerAccountUsernamePrefix + username,
		DisplayName: truncatePartnerAccountRunes(displayName, 20),
		Role:        common.RoleCommonUser,
		Status:      common.UserStatusEnabled,
		Group:       group,
		AffCode:     affCode,
		AuthVersion: 1,
	}
	user.SetSetting(dto.UserSetting{})
	if err := user.prepareForInsert(tx); err != nil {
		return nil, err
	}
	if err := tx.Create(user).Error; err != nil {
		return nil, err
	}
	if err := recordWalletRefundCreditTx(tx, *user, walletRefundOpening, "registration", 0, 0, ""); err != nil {
		return nil, err
	}
	return user, nil
}

func truncatePartnerAccountRunes(value string, limit int) string {
	runes := []rune(value)
	if len(runes) <= limit {
		return value
	}
	return string(runes[:limit])
}

func lockPartnerAccountTx(tx *gorm.DB, id int64) (*PartnerAccount, error) {
	var account PartnerAccount
	if err := lockForUpdate(tx).Where("id = ?", id).First(&account).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrPartnerAccountNotFound
		}
		return nil, err
	}
	return &account, nil
}

func partnerAccountUserTx(tx *gorm.DB, userID int) (*User, error) {
	var user User
	if err := tx.Unscoped().Where("id = ?", userID).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

// partnerSuspendedTx reports whether the partner is currently suspended.
func partnerSuspendedTx(tx *gorm.DB, clientID string) (bool, error) {
	var config PartnerServerConfig
	err := tx.Select("suspended_at").Where("client_id = ?", clientID).First(&config).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return false, nil
	}
	return config.SuspendedAt != 0, err
}

// PartnerAccountKey describes the model API key to create for a sub-account.
// The key string is generated by the caller and used only if a key is created.
type PartnerAccountKey struct {
	Key  string
	Name string
}

// newPartnerAccountToken builds a sub-account key that tries the user's own
// group first and then default.
func newPartnerAccountToken(user *User, spec PartnerAccountKey, now int64) (*Token, error) {
	token := &Token{
		UserId:         user.Id,
		Name:           spec.Name,
		Key:            spec.Key,
		CreatedTime:    now,
		AccessedTime:   now,
		ExpiredTime:    -1,
		UnlimitedQuota: true,
		Status:         common.TokenStatusEnabled,
		Group:          "auto",
	}
	groups := []string{"default"}
	if user.Group != "" && user.Group != "default" {
		groups = []string{user.Group, "default"}
	}
	if err := token.SetAutoGroups(groups); err != nil {
		return nil, err
	}
	return token, nil
}

// partnerAccountTokenUsable reports whether a key can still serve requests:
// enabled and not past its expiry.
func partnerAccountTokenUsable(token *Token, now int64) bool {
	return token.Status == common.TokenStatusEnabled && (token.ExpiredTime == -1 || token.ExpiredTime > now) && !token.DeletedAt.Valid
}

// PartnerAccountCredentialResult is the sub-account's current key and what
// the call created.
type PartnerAccountCredentialResult struct {
	Account        *PartnerAccount
	Token          *Token
	AccountCreated bool
	KeyCreated     bool
}

// IssuePartnerAccountCredential returns the sub-account's current key,
// creating the account and the key on first use. A key that was disabled or
// has expired is reported, never silently replaced; rotation issues a new one.
func IssuePartnerAccountCredential(owner PartnerAccountOwner, spec PartnerAccountKey) (*PartnerAccountCredentialResult, error) {
	result := &PartnerAccountCredentialResult{}
	err := DB.Transaction(func(tx *gorm.DB) error {
		ensured, created, err := ensurePartnerAccountTx(tx, owner)
		if err != nil {
			return err
		}
		result.AccountCreated = created
		account, err := lockPartnerAccountTx(tx, ensured.Id)
		if err != nil {
			return err
		}
		result.Account = account
		if !account.Usable() {
			return ErrPartnerAccountInactive
		}
		now := common.GetTimestamp()
		if account.TokenId > 0 {
			var existing Token
			if err := tx.Unscoped().Where("id = ? AND user_id = ?", account.TokenId, account.UserId).First(&existing).Error; err != nil {
				return err
			}
			if !partnerAccountTokenUsable(&existing, now) {
				return ErrPartnerAccountCredentialDisabled
			}
			result.Token = &existing
			return nil
		}
		user, err := partnerAccountUserTx(tx, account.UserId)
		if err != nil {
			return err
		}
		token, err := newPartnerAccountToken(user, spec, now)
		if err != nil {
			return err
		}
		if err := tx.Create(token).Error; err != nil {
			return err
		}
		if err := tx.Model(account).Updates(map[string]any{"token_id": token.Id, "updated_at": now}).Error; err != nil {
			return err
		}
		account.TokenId = token.Id
		result.Token = token
		result.KeyCreated = true
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

// PartnerAccountRotation is one key rotation request. KeyHash and RequestHash
// make a retried rotation return the key it already issued.
type PartnerAccountRotation struct {
	KeyHash     string
	RequestHash string
	Immediately bool
	Key         PartnerAccountKey
}

// PartnerAccountRotationResult is the key a rotation issued and when the key
// it replaced stops working (0 when that key was revoked at once or there was
// no usable key to replace).
type PartnerAccountRotationResult struct {
	Account         *PartnerAccount
	Token           *Token
	OldKeyExpiresAt int64
	Replayed        bool
}

// RotatePartnerAccountCredential issues a new key for an existing
// sub-account. The replaced key is disabled at once or expires after the
// grace period; a key still in grace from an earlier rotation is disabled, so
// at most two keys work at any time. It also works when the current key was
// disabled by an administrator's revoke-all, which is how the partner gets a
// working key again.
func RotatePartnerAccountCredential(clientID, externalUserID string, rotation PartnerAccountRotation) (*PartnerAccountRotationResult, error) {
	if len(rotation.KeyHash) != 64 || len(rotation.RequestHash) != 64 {
		return nil, errors.New("invalid partner account rotation")
	}
	current, err := GetPartnerAccount(clientID, externalUserID)
	if err != nil {
		return nil, err
	}
	result := &PartnerAccountRotationResult{}
	err = DB.Transaction(func(tx *gorm.DB) error {
		account, err := lockPartnerAccountTx(tx, current.Id)
		if err != nil {
			return err
		}
		result.Account = account
		if account.RotateKeyHash == rotation.KeyHash {
			if account.RotateRequestHash != rotation.RequestHash {
				return ErrPartnerAccountIdempotencyConflict
			}
			var token Token
			if err := tx.Unscoped().Where("id = ? AND user_id = ?", account.TokenId, account.UserId).First(&token).Error; err != nil {
				return err
			}
			result.Token = &token
			result.Replayed = true
			if account.PreviousTokenId > 0 {
				var previous Token
				if err := tx.Unscoped().Where("id = ? AND user_id = ?", account.PreviousTokenId, account.UserId).First(&previous).Error; err == nil && previous.Status == common.TokenStatusEnabled {
					result.OldKeyExpiresAt = previous.ExpiredTime
				}
			}
			return nil
		}
		if !account.Usable() {
			return ErrPartnerAccountInactive
		}
		now := common.GetTimestamp()
		if account.PreviousTokenId > 0 {
			if err := disablePartnerAccountTokenTx(tx, account.UserId, account.PreviousTokenId); err != nil {
				return err
			}
		}
		previousID := 0
		if account.TokenId > 0 {
			var old Token
			if err := tx.Unscoped().Where("id = ? AND user_id = ?", account.TokenId, account.UserId).First(&old).Error; err != nil {
				return err
			}
			switch {
			case !partnerAccountTokenUsable(&old, now):
				// Nothing usable to keep alive.
			case rotation.Immediately:
				if err := disablePartnerAccountTokenTx(tx, account.UserId, old.Id); err != nil {
					return err
				}
			default:
				expiresAt := now + PartnerAccountKeyGraceSeconds
				if old.ExpiredTime != -1 && old.ExpiredTime < expiresAt {
					expiresAt = old.ExpiredTime
				}
				if err := invalidateTokenCacheForMutation(old.Key); err != nil {
					return err
				}
				if err := tx.Model(&old).Update("expired_time", expiresAt).Error; err != nil {
					return err
				}
				previousID = old.Id
				result.OldKeyExpiresAt = expiresAt
			}
		}
		user, err := partnerAccountUserTx(tx, account.UserId)
		if err != nil {
			return err
		}
		token, err := newPartnerAccountToken(user, rotation.Key, now)
		if err != nil {
			return err
		}
		if err := tx.Create(token).Error; err != nil {
			return err
		}
		updates := map[string]any{
			"token_id":            token.Id,
			"previous_token_id":   previousID,
			"rotate_key_hash":     rotation.KeyHash,
			"rotate_request_hash": rotation.RequestHash,
			"updated_at":          now,
		}
		if err := tx.Model(account).Updates(updates).Error; err != nil {
			return err
		}
		account.TokenId = token.Id
		account.PreviousTokenId = previousID
		result.Token = token
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

// disablePartnerAccountTokenTx disables one of a sub-account's keys, raising
// the key cache fence before the write as every token mutation must.
func disablePartnerAccountTokenTx(tx *gorm.DB, userID, tokenID int) error {
	var token Token
	err := tx.Unscoped().Where("id = ? AND user_id = ?", tokenID, userID).First(&token).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil
	}
	if err != nil {
		return err
	}
	if token.Status == common.TokenStatusDisabled {
		return nil
	}
	if err := invalidateTokenCacheForMutation(token.Key); err != nil {
		return err
	}
	return tx.Unscoped().Model(&token).Update("status", common.TokenStatusDisabled).Error
}

// setPartnerSubAccountUserStatusTx changes a sub-account user's status and
// bumps its auth version, as an administrator status change does. The caller
// must run FinalizePartnerAccountUserStatusChanges after commit.
func setPartnerSubAccountUserStatusTx(tx *gorm.DB, userID int, status int) (bool, error) {
	var user User
	if err := lockForUpdate(tx.Unscoped()).Select("id", "status").Where("id = ?", userID).First(&user).Error; err != nil {
		return false, err
	}
	if user.Status == status {
		return false, nil
	}
	if _, err := IncrementUserAuthVersionWithTx(tx, userID); err != nil {
		return false, err
	}
	if err := tx.Unscoped().Model(&User{}).Where("id = ?", userID).Update("status", status).Error; err != nil {
		return false, err
	}
	return true, nil
}

// applyPartnerAccountUserStatusTx sets the sub-account user's status from the
// account's switches and the partner's suspension: enabled only when the
// partner and administrators both allow it and the partner is not suspended.
func applyPartnerAccountUserStatusTx(tx *gorm.DB, account *PartnerAccount, suspended bool) (bool, error) {
	status := common.UserStatusDisabled
	if account.Usable() && !suspended {
		status = common.UserStatusEnabled
	}
	return setPartnerSubAccountUserStatusTx(tx, account.UserId, status)
}

// FinalizePartnerAccountUserStatusChanges publishes committed status changes:
// it refreshes each user's auth cache, revokes browser sessions and drops the
// cached keys so the next model request reloads the user's status.
func FinalizePartnerAccountUserStatusChanges(userIDs []int) {
	for _, userID := range userIDs {
		if err := finalizeCommittedUserAuthMutation(userID, "partner_account_status"); err != nil {
			common.SysError(common.LogText("failed to finalize partner account status for user %d: %s", userID, err.Error()))
		}
		if err := InvalidateUserTokensCache(userID); err != nil {
			common.SysError(common.LogText("failed to invalidate tokens cache for user %d: %s", userID, err.Error()))
		}
	}
}

// SetPartnerAccountEnabledByPartner records the partner's disable or re-enable
// of a sub-account. A partner cannot re-enable an account an administrator
// disabled. It returns the user IDs whose status changed.
func SetPartnerAccountEnabledByPartner(clientID, externalUserID string, enabled bool) (*PartnerAccount, []int, error) {
	current, err := GetPartnerAccount(clientID, externalUserID)
	if err != nil {
		return nil, nil, err
	}
	var account *PartnerAccount
	var changed []int
	err = DB.Transaction(func(tx *gorm.DB) error {
		account, err = lockPartnerAccountTx(tx, current.Id)
		if err != nil {
			return err
		}
		if enabled && account.AdminDisabled {
			return ErrPartnerAccountAdminDisabled
		}
		target := PartnerAccountStatusDisabled
		if enabled {
			target = PartnerAccountStatusActive
		}
		if account.Status != target {
			if err := tx.Model(account).Updates(map[string]any{"status": target, "updated_at": common.GetTimestamp()}).Error; err != nil {
				return err
			}
			account.Status = target
		}
		suspended, err := partnerSuspendedTx(tx, clientID)
		if err != nil {
			return err
		}
		userChanged, err := applyPartnerAccountUserStatusTx(tx, account, suspended)
		if err != nil {
			return err
		}
		if userChanged {
			changed = append(changed, account.UserId)
		}
		return nil
	})
	if err != nil {
		return nil, nil, err
	}
	return account, changed, nil
}

// SetPartnerAccountAdminDisabled records an administrator's disable or
// re-enable of a sub-account user and applies the resulting status in one
// transaction. Re-enabling clears only the administrator's switch: a partner
// disable or a partner suspension still keeps the user disabled. It reports
// whether the user is a sub-account at all; for other users nothing changes.
func SetPartnerAccountAdminDisabled(userID int, disabled bool) (bool, []int, error) {
	isSubAccount := false
	var changed []int
	err := DB.Transaction(func(tx *gorm.DB) error {
		var account PartnerAccount
		err := lockForUpdate(tx).Where("user_id = ?", userID).First(&account).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		if err != nil {
			return err
		}
		isSubAccount = true
		if account.AdminDisabled != disabled {
			if err := tx.Model(&account).Updates(map[string]any{"admin_disabled": disabled, "updated_at": common.GetTimestamp()}).Error; err != nil {
				return err
			}
			account.AdminDisabled = disabled
		}
		suspended, err := partnerSuspendedTx(tx, account.ClientId)
		if err != nil {
			return err
		}
		userChanged, err := applyPartnerAccountUserStatusTx(tx, &account, suspended)
		if err != nil {
			return err
		}
		if userChanged {
			changed = append(changed, account.UserId)
		}
		return nil
	})
	return isSubAccount, changed, err
}

// PartnerAccountBatch is one page of a per-partner batch job over its
// sub-accounts, ordered by ID.
type PartnerAccountBatch struct {
	LastId         int64
	Done           bool
	Processed      int
	ChangedUserIds []int
}

func partnerAccountIDsAfter(clientID string, afterID int64, limit int) ([]int64, error) {
	var ids []int64
	err := DB.Model(&PartnerAccount{}).Where("client_id = ? AND id > ?", clientID, afterID).Order("id").Limit(limit).Pluck("id", &ids).Error
	return ids, err
}

// ReconcilePartnerAccountSuspensionBatch brings one page of the partner's
// sub-accounts in line with the partner's current suspension state. Each
// account commits on its own, so a crash leaves a consistent prefix and the
// job can simply run again.
func ReconcilePartnerAccountSuspensionBatch(clientID string, afterID int64, limit int) (*PartnerAccountBatch, error) {
	ids, err := partnerAccountIDsAfter(clientID, afterID, limit)
	if err != nil {
		return nil, err
	}
	batch := &PartnerAccountBatch{LastId: afterID, Done: len(ids) < limit}
	for _, id := range ids {
		err := DB.Transaction(func(tx *gorm.DB) error {
			account, err := lockPartnerAccountTx(tx, id)
			if err != nil {
				return err
			}
			// Read under the account lock so a suspend and resume racing with
			// this batch always end in the latest state.
			suspended, err := partnerSuspendedTx(tx, clientID)
			if err != nil {
				return err
			}
			userChanged, err := applyPartnerAccountUserStatusTx(tx, account, suspended)
			if err != nil {
				return err
			}
			if userChanged {
				batch.ChangedUserIds = append(batch.ChangedUserIds, account.UserId)
			}
			if account.SuspendedByPartner == suspended {
				return nil
			}
			return tx.Model(account).Updates(map[string]any{"suspended_by_partner": suspended, "updated_at": common.GetTimestamp()}).Error
		})
		if err != nil {
			return batch, err
		}
		batch.LastId = id
		batch.Processed++
	}
	return batch, nil
}

// RevokePartnerAccountKeysBatch disables the current key and any key still in
// grace for one page of the partner's sub-accounts. The account row is locked
// before its key IDs are read, so a rotation racing with the revocation
// cannot leave a fresh key behind. Accounts and balances are untouched; the
// partner obtains new keys through rotation.
func RevokePartnerAccountKeysBatch(clientID string, afterID int64, limit int) (*PartnerAccountBatch, error) {
	ids, err := partnerAccountIDsAfter(clientID, afterID, limit)
	if err != nil {
		return nil, err
	}
	batch := &PartnerAccountBatch{LastId: afterID, Done: len(ids) < limit}
	for _, id := range ids {
		err := DB.Transaction(func(tx *gorm.DB) error {
			account, err := lockPartnerAccountTx(tx, id)
			if err != nil {
				return err
			}
			for _, tokenID := range []int{account.TokenId, account.PreviousTokenId} {
				if tokenID <= 0 {
					continue
				}
				if err := disablePartnerAccountTokenTx(tx, account.UserId, tokenID); err != nil {
					return err
				}
			}
			return nil
		})
		if err != nil {
			return batch, err
		}
		batch.LastId = id
		batch.Processed++
	}
	return batch, nil
}

// PartnerAccountPaymentOrderInput is a top-up a partner places for its user.
// The amount is validated by the caller; Price prices it for the sub-account
// user's group inside the order transaction. The sub-account is created on
// first use inside the same transaction.
type PartnerAccountPaymentOrderInput struct {
	Owner              PartnerAccountOwner
	IdempotencyKeyHash string
	RequestHash        string
	RequestedAmount    int64
	StoredAmount       int64
	Price              func(group string) (float64, error)
	PaymentMethod      string
	PaymentProvider    string
	CreditedQuota      int
	BaseQuota          int
	Metadata           CashbackRequestMetadata
}

// PartnerAccountPaymentLimits caps orders per sub-account (recent and still
// pending) and per partner. The per-partner count is not serialized across
// sub-accounts, so concurrent orders may exceed it slightly.
type PartnerAccountPaymentLimits struct {
	AccountRecentSince  int64
	AccountMaxRecent    int64
	AccountPendingSince int64
	AccountMaxPending   int64
	ClientRecentSince   int64
	ClientMaxRecent     int64
}

// PartnerAccountPaymentOrderResult is the created order and whether the call
// also created the sub-account.
type PartnerAccountPaymentOrderResult struct {
	Order          *PartnerAccountPaymentOrder
	TopUp          *TopUp
	AccountCreated bool
}

// CreatePartnerAccountPaymentOrder commits the sub-account (on first use), the
// top-up, its cashback context and the partner link together. The account row
// is locked so its limits are checked one order at a time. The order starts
// with its gateway call claimed by this caller.
func CreatePartnerAccountPaymentOrder(input PartnerAccountPaymentOrderInput, limits PartnerAccountPaymentLimits) (*PartnerAccountPaymentOrderResult, error) {
	if input.IdempotencyKeyHash == "" || input.RequestHash == "" || input.Price == nil {
		return nil, errors.New("invalid partner account payment order")
	}
	metadata := input.Metadata
	metadata.IneligibleReason = CashbackIneligiblePartnerOAuth
	result := &PartnerAccountPaymentOrderResult{}
	err := DB.Transaction(func(tx *gorm.DB) error {
		ensured, created, err := ensurePartnerAccountTx(tx, input.Owner)
		if err != nil {
			return err
		}
		result.AccountCreated = created
		account, err := lockPartnerAccountTx(tx, ensured.Id)
		if err != nil {
			return err
		}
		if !account.Usable() {
			return ErrPartnerAccountInactive
		}
		var used int64
		if err := tx.Model(&PartnerAccountPaymentOrder{}).
			Where("client_id = ? AND idempotency_key_hash = ?", input.Owner.ClientId, input.IdempotencyKeyHash).
			Count(&used).Error; err != nil {
			return err
		}
		if used > 0 {
			return ErrPartnerAccountPaymentIdempotencyRace
		}
		recent, err := countPartnerTopUpLinksTx(tx, &PartnerAccountPaymentOrder{}, "partner_account_id = ?", account.Id, limits.AccountRecentSince, false)
		if err != nil {
			return err
		}
		pending, err := countPartnerTopUpLinksTx(tx, &PartnerAccountPaymentOrder{}, "partner_account_id = ?", account.Id, limits.AccountPendingSince, true)
		if err != nil {
			return err
		}
		clientRecent, err := countPartnerTopUpLinksTx(tx, &PartnerAccountPaymentOrder{}, "client_id = ?", input.Owner.ClientId, limits.ClientRecentSince, false)
		if err != nil {
			return err
		}
		if recent >= limits.AccountMaxRecent || pending >= limits.AccountMaxPending || clientRecent >= limits.ClientMaxRecent {
			return ErrPartnerAccountPaymentRateLimited
		}
		user, err := partnerAccountUserTx(tx, account.UserId)
		if err != nil {
			return err
		}
		maxCurrentQuota, err := topUpQuotaMaxCurrent(input.CreditedQuota)
		if err != nil {
			return err
		}
		if user.Quota > maxCurrentQuota {
			return ErrTopUpQuotaLimitExceeded
		}
		money, err := input.Price(user.Group)
		if err != nil {
			return err
		}
		now := common.GetTimestamp()
		topUp := &TopUp{
			UserId:          account.UserId,
			Amount:          input.StoredAmount,
			Money:           money,
			TradeNo:         fmt.Sprintf("USR%dNO%s%d", account.UserId, common.GetRandomString(6), now),
			PaymentMethod:   input.PaymentMethod,
			PaymentProvider: input.PaymentProvider,
			CreateTime:      now,
			Status:          common.TopUpStatusPending,
		}
		if err := InsertOnlineTopUpTx(tx, topUp, input.BaseQuota, metadata); err != nil {
			return err
		}
		order := &PartnerAccountPaymentOrder{
			ClientId:            input.Owner.ClientId,
			IdempotencyKeyHash:  input.IdempotencyKeyHash,
			RequestHash:         input.RequestHash,
			PartnerAccountId:    account.Id,
			UserId:              account.UserId,
			TopUpId:             topUp.Id,
			RequestedAmount:     input.RequestedAmount,
			CheckoutAttemptedAt: now,
			CreatedAt:           now,
		}
		if err := tx.Create(order).Error; err != nil {
			return err
		}
		result.Order, result.TopUp = order, topUp
		return nil
	})
	if isDatabaseDuplicatedKey(DB, err) {
		// Only a stored order with this key is an idempotency race; any other
		// duplicate (for example a trade number collision) stays an error the
		// partner can retry with the same key.
		var used int64
		if countErr := DB.Model(&PartnerAccountPaymentOrder{}).
			Where("client_id = ? AND idempotency_key_hash = ?", input.Owner.ClientId, input.IdempotencyKeyHash).
			Count(&used).Error; countErr == nil && used > 0 {
			return nil, ErrPartnerAccountPaymentIdempotencyRace
		}
	}
	if err != nil {
		return nil, err
	}
	return result, nil
}

// countPartnerTopUpLinksTx counts rows of a partner top-up link table (OAuth
// or sub-account orders) matching scope and created at or after since;
// pendingOnly restricts the count to orders still awaiting payment.
func countPartnerTopUpLinksTx(tx *gorm.DB, link any, scope string, value any, since int64, pendingOnly bool) (int64, error) {
	query := tx.Model(link).Where(scope, value).Where("created_at >= ?", since)
	if pendingOnly {
		// A subquery keeps both table names under GORM's naming strategy.
		pending := tx.Model(&TopUp{}).Select("id").Where("status = ?", common.TopUpStatusPending)
		query = query.Where("top_up_id IN (?)", pending)
	}
	var count int64
	err := query.Count(&count).Error
	return count, err
}

// ClaimPartnerAccountPaymentCheckout lets one caller contact the gateway for
// an order that still has no checkout, unless another caller claimed it after
// staleBefore and may still be waiting for the gateway.
func ClaimPartnerAccountPaymentCheckout(orderID int64, now, staleBefore int64) (bool, error) {
	result := DB.Model(&PartnerAccountPaymentOrder{}).
		Where("id = ? AND qr_code = ? AND pay_url = ? AND checkout_attempted_at < ?", orderID, "", "", staleBefore).
		Update("checkout_attempted_at", now)
	return result.RowsAffected == 1, result.Error
}

// ReleasePartnerAccountPaymentCheckout gives up a claim after a failed gateway
// call, so the partner's retry can try again at once.
func ReleasePartnerAccountPaymentCheckout(orderID int64) error {
	return DB.Model(&PartnerAccountPaymentOrder{}).
		Where("id = ? AND qr_code = ? AND pay_url = ?", orderID, "", "").
		Update("checkout_attempted_at", 0).Error
}

// SetPartnerAccountPaymentCheckout stores the checkout the gateway returned so
// idempotent replays return it without placing the order again.
func SetPartnerAccountPaymentCheckout(orderID int64, qrCode, payURL string) error {
	return DB.Model(&PartnerAccountPaymentOrder{}).Where("id = ?", orderID).
		Updates(map[string]any{"qr_code": qrCode, "pay_url": payURL}).Error
}

func FindPartnerAccountPaymentOrderByIdempotency(clientID, keyHash string) (*PartnerAccountPaymentOrder, *TopUp, error) {
	var order PartnerAccountPaymentOrder
	err := DB.Where("client_id = ? AND idempotency_key_hash = ?", clientID, keyHash).First(&order).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil, ErrPartnerAccountPaymentOrderNotFound
	}
	if err != nil {
		return nil, nil, err
	}
	var topUp TopUp
	if err := DB.Where("id = ?", order.TopUpId).First(&topUp).Error; err != nil {
		return nil, nil, err
	}
	return &order, &topUp, nil
}

// GetPartnerAccountPaymentOrder returns the order only when this partner
// placed it; any other order is reported as missing.
func GetPartnerAccountPaymentOrder(clientID, tradeNo string) (*PartnerAccountPaymentOrder, *TopUp, error) {
	var topUp TopUp
	err := DB.Where("trade_no = ?", tradeNo).First(&topUp).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil, ErrPartnerAccountPaymentOrderNotFound
	}
	if err != nil {
		return nil, nil, err
	}
	var order PartnerAccountPaymentOrder
	err = DB.Where("top_up_id = ? AND client_id = ?", topUp.Id, clientID).First(&order).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil, ErrPartnerAccountPaymentOrderNotFound
	}
	if err != nil {
		return nil, nil, err
	}
	return &order, &topUp, nil
}

// PartnerServerJobsToResume lists partners whose background jobs a restart
// may have interrupted: suspended partners and partners with accounts still
// marked as suspended (suspension reconciliation), and partners with a
// pending key revocation.
func PartnerServerJobsToResume() (suspension []string, keyRevocation []string, err error) {
	if err = DB.Model(&PartnerServerConfig{}).Where("suspended_at <> ?", 0).Pluck("client_id", &suspension).Error; err != nil {
		return nil, nil, err
	}
	var marked []string
	if err = DB.Model(&PartnerAccount{}).Where("suspended_by_partner = ?", true).Distinct("client_id").Pluck("client_id", &marked).Error; err != nil {
		return nil, nil, err
	}
	for _, clientID := range marked {
		if !slices.Contains(suspension, clientID) {
			suspension = append(suspension, clientID)
		}
	}
	if err = DB.Model(&PartnerServerConfig{}).Where("key_revocation_requested_at <> ?", 0).Pluck("client_id", &keyRevocation).Error; err != nil {
		return nil, nil, err
	}
	return suspension, keyRevocation, nil
}

// PartnerAccountUsage is one consume-log entry as a partner may see it. It
// carries no request content, IP, channel or internal billing detail.
type PartnerAccountUsage struct {
	CreatedAt        int64  `json:"created_at"`
	ModelName        string `json:"model_name"`
	PromptTokens     int    `json:"prompt_tokens"`
	CompletionTokens int    `json:"completion_tokens"`
	Quota            int    `json:"quota"`
	UseTime          int    `json:"use_time"`
	IsStream         bool   `json:"is_stream"`
	RequestId        string `json:"request_id"`
}

// ListPartnerAccountUsage pages a sub-account's consume logs in
// [startTime, endTime], newest first. It fetches one extra row to report
// whether more follow instead of counting the whole range.
func ListPartnerAccountUsage(userID int, startTime, endTime int64, offset, limit int) ([]PartnerAccountUsage, bool, error) {
	var rows []PartnerAccountUsage
	err := LOG_DB.Model(&Log{}).
		Select("created_at", "model_name", "prompt_tokens", "completion_tokens", "quota", "use_time", "is_stream", "request_id").
		Where("user_id = ? AND type = ? AND created_at >= ? AND created_at <= ?", userID, LogTypeConsume, startTime, endTime).
		Order("id desc").Offset(offset).Limit(limit + 1).
		Scan(&rows).Error
	if err != nil {
		return nil, false, err
	}
	if len(rows) > limit {
		return rows[:limit], true, nil
	}
	return rows, false, nil
}

// PartnerAccountOwners maps sub-account user IDs to their partner's client ID
// and name; users that are not sub-accounts are absent.
func PartnerAccountOwners(userIDs []int) (map[int]PartnerOAuthClient, error) {
	owners := map[int]PartnerOAuthClient{}
	if len(userIDs) == 0 {
		return owners, nil
	}
	var accounts []PartnerAccount
	if err := DB.Select("user_id", "client_id").Where("user_id IN ?", userIDs).Find(&accounts).Error; err != nil {
		return nil, err
	}
	if len(accounts) == 0 {
		return owners, nil
	}
	clientIDs := make([]string, 0, len(accounts))
	for _, account := range accounts {
		if !slices.Contains(clientIDs, account.ClientId) {
			clientIDs = append(clientIDs, account.ClientId)
		}
	}
	var clients []PartnerOAuthClient
	if err := DB.Select("client_id", "name").Where("client_id IN ?", clientIDs).Find(&clients).Error; err != nil {
		return nil, err
	}
	names := make(map[string]string, len(clients))
	for _, client := range clients {
		names[client.ClientId] = client.Name
	}
	for _, account := range accounts {
		owners[account.UserId] = PartnerOAuthClient{ClientId: account.ClientId, Name: names[account.ClientId]}
	}
	return owners, nil
}
