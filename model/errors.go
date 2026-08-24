package model

import "errors"

// Common errors
var (
	ErrDatabase                        = errors.New("database error")
	ErrPaymentAnalyticsOutboxLeaseLost = errors.New("payment analytics outbox lease lost")
)

// User auth errors
var (
	ErrInvalidCredentials              = errors.New("invalid credentials")
	ErrUserEmptyCredentials            = errors.New("empty credentials")
	ErrRegistrationDomainBlocked       = errors.New("registration domain blocked")
	ErrRegistrationDomainBlockNotFound = errors.New("registration domain block not found")
)

// Token auth errors
var (
	ErrTokenNotProvided = errors.New("token not provided")
	ErrTokenInvalid     = errors.New("token invalid")
	ErrTokenExpired     = errors.New("token expired")
	ErrTokenExhausted   = errors.New("token exhausted")
	ErrTokenUnavailable = errors.New("token unavailable")
)

// Redemption errors
var (
	ErrRedeemFailed              = errors.New("redeem.failed")
	ErrRedemptionPurposeRequired = errors.New("redemption purpose is required")
	ErrRedemptionCodesExhausted  = errors.New("redemption codes exhausted")
	ErrRedemptionAlreadyClaimed  = errors.New("redemption already claimed")
)

// 2FA errors
var ErrTwoFANotEnabled = errors.New("2fa not enabled")
