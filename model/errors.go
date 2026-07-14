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
	ErrEmailAlreadyTaken    = errors.New("email already taken")
	ErrEmailNotFound        = errors.New("email not found")
	ErrEmailAmbiguous       = errors.New("email matches multiple users")
)

// Token auth errors
var (
	ErrTokenNotProvided = errors.New("token not provided")
	ErrTokenInvalid     = errors.New("token invalid")
)

// Redemption errors
var ErrRedeemFailed = errors.New("redeem.failed")

// 2FA errors
var (
	ErrTwoFANotEnabled    = errors.New("2fa not enabled")
	ErrTwoFAUserIdEmpty   = errors.New("2fa user id empty")
	ErrTwoFAAlreadyExists = errors.New("2fa already exists")
	ErrTwoFARecordIdEmpty = errors.New("2fa record id empty")
	ErrTwoFACodeInvalid   = errors.New("2fa code invalid")
	ErrTwoFAUserNotExists = errors.New("2fa user not exists")
)
