package model

import "errors"

// Common errors
var (
	ErrDatabase = errors.New("database error")
)

// Quota errors
var (
	ErrInsufficientUserQuota  = errors.New("insufficient user quota")
	ErrInsufficientTokenQuota = errors.New("insufficient token quota")
)

// User auth errors
var (
	ErrInvalidCredentials   = errors.New("invalid credentials")
	ErrUserEmptyCredentials = errors.New("empty credentials")
)

// Token auth errors
var (
	ErrTokenNotProvided = errors.New("token not provided")
	ErrTokenInvalid     = errors.New("token invalid")
)

// Redemption errors
var ErrRedeemFailed = errors.New("redeem.failed")

// 2FA errors
var ErrTwoFANotEnabled = errors.New("2fa not enabled")
