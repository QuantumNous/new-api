package dto

import "time"

// KYCSubmitRequest is used for both POST and PUT /api/user/kyc
type KYCSubmitRequest struct {
	RealName    string `json:"real_name"    binding:"required,min=2,max=32"`
	IdType      string `json:"id_type"      binding:"required,oneof=id_card passport other"`
	IdNumber    string `json:"id_number"    binding:"required,min=6,max=30"`
	IdCardFront string `json:"id_card_front"` // base64; optional at API level, validated by handler
	IdCardBack  string `json:"id_card_back"`  // base64; optional at API level, validated by handler
}

// KYCRejectRequest carries the rejection reason
type KYCRejectRequest struct {
	Reason string `json:"reason" binding:"required,max=255"`
}

// KYCStatusResponse is returned to the requesting user (masked)
type KYCStatusResponse struct {
	Status         int        `json:"status"`
	RealName       string     `json:"real_name"`
	IdType         string     `json:"id_type"`
	IdNumberMasked string     `json:"id_number_masked"`
	RejectReason   string     `json:"reject_reason,omitempty"`
	SubmitCount    int        `json:"submit_count"`
	SubmittedAt    *time.Time `json:"submitted_at,omitempty"`
	VerifiedAt     *time.Time `json:"verified_at,omitempty"`
}

// KYCAdminItem is used in admin list responses (masked)
type KYCAdminItem struct {
	Id             int        `json:"id"`
	UserId         int        `json:"user_id"`
	Username       string     `json:"username"`
	RealName       string     `json:"real_name"`
	IdType         string     `json:"id_type"`
	IdNumberMasked string     `json:"id_number_masked"`
	SubmitCount    int        `json:"submit_count"`
	Status         int        `json:"status"`
	RejectReason   string     `json:"reject_reason,omitempty"`
	ReviewedBy     int        `json:"reviewed_by,omitempty"`
	ReviewerName   string     `json:"reviewer_name,omitempty"`
	HasImages      bool       `json:"has_images"`
	SubmittedAt    *time.Time `json:"submitted_at,omitempty"`
	VerifiedAt     *time.Time `json:"verified_at,omitempty"`
}

// KYCRevealResponse is returned only to Root users (plaintext)
type KYCRevealResponse struct {
	RealName string `json:"real_name"`
	IdType   string `json:"id_type"`
	IdNumber string `json:"id_number"`
}

// KYCImagesResponse carries decrypted data-URI images (status-aware permission required)
type KYCImagesResponse struct {
	FrontImage string `json:"front_image"` // data:image/jpeg;base64,...
	BackImage  string `json:"back_image"`
}
