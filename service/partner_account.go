package service

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net/http"
	"regexp"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

const (
	PartnerAccountRevokeAfterGrace  = "after_grace"
	PartnerAccountRevokeImmediately = "immediately"
)

var partnerExternalUserIDPattern = regexp.MustCompile(`^[A-Za-z0-9._-]{32,64}$`)

// ValidPartnerExternalUserID enforces the agreed format: 32–64 URL-safe
// characters, compared case-sensitively.
func ValidPartnerExternalUserID(externalUserID string) bool {
	return partnerExternalUserIDPattern.MatchString(externalUserID)
}

// PartnerAccountError maps a model error to the API error the partner sees,
// or returns nil when it is not a known partner account condition.
func PartnerAccountError(err error) *PartnerOAuthError {
	switch {
	case errors.Is(err, model.ErrPartnerAccountNotFound):
		return partnerOAuthErr(http.StatusNotFound, "account_not_found", "the account does not exist")
	case errors.Is(err, model.ErrPartnerAccountLimit):
		return partnerOAuthErr(http.StatusTooManyRequests, "account_limit_reached", "the partner has reached its account limit")
	case errors.Is(err, model.ErrPartnerAccountRateLimited):
		return partnerOAuthErr(http.StatusTooManyRequests, "rate_limited", "too many accounts created, please retry later")
	case errors.Is(err, model.ErrPartnerServerUnavailable):
		return partnerOAuthErr(http.StatusForbidden, "partner_unavailable", "server access is unavailable")
	case errors.Is(err, model.ErrPartnerAccountInactive):
		return partnerOAuthErr(http.StatusForbidden, "account_disabled", "the account is disabled")
	case errors.Is(err, model.ErrPartnerAccountAdminDisabled):
		return partnerOAuthErr(http.StatusForbidden, "account_disabled_by_admin", "the account was disabled by the platform")
	case errors.Is(err, model.ErrPartnerAccountCredentialDisabled):
		return partnerOAuthErr(http.StatusForbidden, "credential_disabled", "the API key is disabled; rotate it to obtain a new one")
	case errors.Is(err, model.ErrPartnerAccountIdempotencyConflict):
		return partnerOAuthErr(http.StatusConflict, "idempotency_conflict", "the Idempotency-Key was already used with a different request")
	}
	return nil
}

type PartnerAccountView struct {
	AccountID      string `json:"account_id"`
	ExternalUserID string `json:"external_user_id"`
	Status         string `json:"status"`
	Quota          int    `json:"quota"`
	UsedQuota      int    `json:"used_quota"`
	Amount         string `json:"amount"`
	Currency       string `json:"currency"`
	CurrencySymbol string `json:"currency_symbol"`
	QuotaPerUnit   string `json:"quota_per_unit"`
	CreatedAt      string `json:"created_at"`
}

// BuildPartnerAccountView reads the account's wallet from the database; the
// quota cache is only for request billing.
func BuildPartnerAccountView(account *model.PartnerAccount) (*PartnerAccountView, error) {
	user, err := model.GetUserById(account.UserId, true)
	if err != nil {
		return nil, err
	}
	wallet, err := ConvertPartnerWalletQuota(user.Quota)
	if err != nil {
		return nil, err
	}
	return &PartnerAccountView{
		AccountID:      model.PartnerOAuthAccountID(account.UserId),
		ExternalUserID: account.ExternalUserId,
		Status:         account.ReportedStatus(),
		Quota:          user.Quota,
		UsedQuota:      user.UsedQuota,
		Amount:         wallet.Amount,
		Currency:       wallet.Currency,
		CurrencySymbol: wallet.CurrencySymbol,
		QuotaPerUnit:   wallet.QuotaPerUnit,
		CreatedAt:      rfc3339UTC(account.CreatedAt),
	}, nil
}

type PartnerAccountCredentialView struct {
	AccountID       string  `json:"account_id"`
	ExternalUserID  string  `json:"external_user_id"`
	KeyID           string  `json:"key_id"`
	APIKey          string  `json:"api_key"`
	BaseURL         string  `json:"base_url"`
	CreatedAt       string  `json:"created_at"`
	OldKeyExpiresAt *string `json:"old_key_expires_at,omitempty"`
}

func partnerAccountKeySpec(partner *PartnerServerSnapshot) (model.PartnerAccountKey, error) {
	key, err := common.GenerateKey()
	if err != nil {
		return model.PartnerAccountKey{}, err
	}
	return model.PartnerAccountKey{Key: key, Name: truncateRunes("partner:"+partner.Name, 50)}, nil
}

func partnerAccountCredentialView(account *model.PartnerAccount, token *model.Token) (*PartnerAccountCredentialView, error) {
	baseURL, err := PartnerOAuthModelBaseURL()
	if err != nil {
		return nil, err
	}
	return &PartnerAccountCredentialView{
		AccountID:      model.PartnerOAuthAccountID(account.UserId),
		ExternalUserID: account.ExternalUserId,
		KeyID:          model.PartnerOAuthKeyID(token.Id),
		APIKey:         "sk-" + token.Key,
		BaseURL:        baseURL,
		CreatedAt:      rfc3339UTC(token.CreatedTime),
	}, nil
}

func partnerAccountOwner(partner *PartnerServerSnapshot, externalUserID string) model.PartnerAccountOwner {
	return model.PartnerAccountOwner{ClientId: partner.ClientId, ExternalUserId: externalUserID, DisplayName: partner.Name}
}

// IssuePartnerAccountCredential returns the account's current key, creating
// the account and key on first use; the result says what was created.
func IssuePartnerAccountCredential(partner *PartnerServerSnapshot, externalUserID string) (*PartnerAccountCredentialView, *model.PartnerAccountCredentialResult, error) {
	spec, err := partnerAccountKeySpec(partner)
	if err != nil {
		return nil, nil, err
	}
	result, err := model.IssuePartnerAccountCredential(partnerAccountOwner(partner, externalUserID), spec)
	if err != nil {
		return nil, nil, err
	}
	view, err := partnerAccountCredentialView(result.Account, result.Token)
	if err != nil {
		return nil, nil, err
	}
	return view, result, nil
}

// RotatePartnerAccountCredential issues a new key and retires the old one
// immediately or after the grace period.
func RotatePartnerAccountCredential(partner *PartnerServerSnapshot, externalUserID, keyHash, mode string) (*PartnerAccountCredentialView, *model.PartnerAccountRotationResult, error) {
	spec, err := partnerAccountKeySpec(partner)
	if err != nil {
		return nil, nil, err
	}
	sum := sha256.Sum256([]byte(externalUserID + "\n" + mode))
	result, err := model.RotatePartnerAccountCredential(partner.ClientId, externalUserID, model.PartnerAccountRotation{
		KeyHash:     keyHash,
		RequestHash: hex.EncodeToString(sum[:]),
		Immediately: mode == PartnerAccountRevokeImmediately,
		Key:         spec,
	})
	if err != nil {
		return nil, nil, err
	}
	view, err := partnerAccountCredentialView(result.Account, result.Token)
	if err != nil {
		return nil, nil, err
	}
	if result.OldKeyExpiresAt > 0 {
		expires := rfc3339UTC(result.OldKeyExpiresAt)
		view.OldKeyExpiresAt = &expires
	}
	return view, result, nil
}

// SetPartnerAccountEnabled disables or re-enables a sub-account on the
// partner's request and publishes the user status change.
func SetPartnerAccountEnabled(partner *PartnerServerSnapshot, externalUserID string, enabled bool) (*model.PartnerAccount, error) {
	account, changed, err := model.SetPartnerAccountEnabledByPartner(partner.ClientId, externalUserID, enabled)
	if err != nil {
		return nil, err
	}
	model.FinalizePartnerAccountUserStatusChanges(changed)
	return account, nil
}
