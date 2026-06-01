package model

import "errors"

// Common errors
var (
	ErrDatabase = errors.New("database error")
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
var (
	ErrRedeemFailed = errors.New("redeem.failed")
	ErrInvalidCode  = errors.New("redeem.invalid_code")
	ErrCodeUsed     = errors.New("redeem.code_used")
	ErrCodeExpired  = errors.New("redeem.code_expired")
)

// 2FA errors
var ErrTwoFANotEnabled = errors.New("2fa not enabled")
