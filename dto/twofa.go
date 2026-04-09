package dto

// Setup2FARequest is the request body for enabling 2FA.
type Setup2FARequest struct {
	Code string `json:"code" binding:"required"`
}

// Verify2FARequest is the request body for verifying 2FA.
type Verify2FARequest struct {
	Code string `json:"code" binding:"required"`
}

// Setup2FAResponse is the response data for 2FA setup.
type Setup2FAResponse struct {
	Secret      string   `json:"secret"`
	QRCodeData  string   `json:"qr_code_data"`
	BackupCodes []string `json:"backup_codes"`
}

// TwoFAStatusData is the data field for GET /api/user/2fa/status.
type TwoFAStatusData struct {
	Enabled              bool `json:"enabled"`
	Locked               bool `json:"locked"`
	BackupCodesRemaining int  `json:"backup_codes_remaining,omitempty"`
}

// BackupCodesData is the data field for POST /api/user/2fa/backup_codes.
type BackupCodesData struct {
	BackupCodes []string `json:"backup_codes"`
}

// UniversalVerifyRequest is the request body for POST /api/verify.
type UniversalVerifyRequest struct {
	Method string `json:"method"` // "2fa" or "passkey"
	Code   string `json:"code,omitempty"`
}

// VerificationStatusResponse is the response data for verification endpoints.
type VerificationStatusResponse struct {
	Verified  bool  `json:"verified"`
	ExpiresAt int64 `json:"expires_at,omitempty"`
}
