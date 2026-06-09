package dto

import "time"

// EnterpriseSubmitRequest is used for both POST and PUT /api/user/enterprise.
// The three images are required at the handler level (validated there, not via
// binding tags, so the same error path as KYC can return i18n keys).
type EnterpriseSubmitRequest struct {
	CompanyName  string `json:"company_name"   binding:"required,min=2,max=128"`
	Uscc         string `json:"uscc"           binding:"required,len=18"`
	LegalRepName string `json:"legal_rep_name" binding:"required,min=2,max=32"`
	LegalRepId   string `json:"legal_rep_id"   binding:"required,min=6,max=30"`
	ContactName  string `json:"contact_name"`
	ContactPhone string `json:"contact_phone"`
	License      string `json:"license"`     // 营业执照 base64
	LegalFront   string `json:"legal_front"` // 法人身份证正面 base64
	LegalBack    string `json:"legal_back"`  // 法人身份证背面 base64
}

// EnterpriseRejectRequest carries the rejection reason.
type EnterpriseRejectRequest struct {
	Reason string `json:"reason" binding:"required,max=255"`
}

// EnterpriseStatusResponse is returned to the requesting user (masked).
type EnterpriseStatusResponse struct {
	Status       int        `json:"status"`
	CompanyName  string     `json:"company_name"`
	UsccMasked   string     `json:"uscc_masked"`
	LegalRepName string     `json:"legal_rep_name"`
	ContactName  string     `json:"contact_name,omitempty"`
	ContactPhone string     `json:"contact_phone,omitempty"`
	RejectReason string     `json:"reject_reason,omitempty"`
	SubmitCount  int        `json:"submit_count"`
	SubmittedAt  *time.Time `json:"submitted_at,omitempty"`
	VerifiedAt   *time.Time `json:"verified_at,omitempty"`
}

// EnterpriseAdminItem is used in admin list responses (masked).
type EnterpriseAdminItem struct {
	Id           int        `json:"id"`
	UserId       int        `json:"user_id"`
	Username     string     `json:"username"`
	CompanyName  string     `json:"company_name"`
	UsccMasked   string     `json:"uscc_masked"`
	LegalRepName string     `json:"legal_rep_name"`
	ContactName  string     `json:"contact_name,omitempty"`
	ContactPhone string     `json:"contact_phone,omitempty"`
	SubmitCount  int        `json:"submit_count"`
	Status       int        `json:"status"`
	RejectReason string     `json:"reject_reason,omitempty"`
	ReviewedBy   int        `json:"reviewed_by,omitempty"`
	ReviewerName string     `json:"reviewer_name,omitempty"`
	HasImages    bool       `json:"has_images"`
	SubmittedAt  *time.Time `json:"submitted_at,omitempty"`
	VerifiedAt   *time.Time `json:"verified_at,omitempty"`
}

// EnterpriseRevealResponse is returned under status-aware permission (plaintext).
type EnterpriseRevealResponse struct {
	CompanyName  string `json:"company_name"`
	Uscc         string `json:"uscc"`
	LegalRepName string `json:"legal_rep_name"`
	LegalRepId   string `json:"legal_rep_id"`
}

// EnterpriseImagesResponse carries decrypted data-URI images (status-aware).
type EnterpriseImagesResponse struct {
	LicenseImage    string `json:"license_image"` // data:image/jpeg;base64,...
	LegalFrontImage string `json:"legal_front_image"`
	LegalBackImage  string `json:"legal_back_image"`
}
