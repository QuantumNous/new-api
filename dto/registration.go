package dto

// RegisterRequest contains only the fields accepted by public password registration.
type RegisterRequest struct {
	Username         string `json:"username" validate:"max=20"`
	Password         string `json:"password" validate:"min=8,max=20"`
	Email            string `json:"email" validate:"max=50"`
	VerificationCode string `json:"verification_code"`
	AffCode          string `json:"aff_code"`
	InvitationCode   string `json:"invitation_code" validate:"max=128"`
}

// WeChatAuthRequest is used when a WeChat authorization may create a user.
type WeChatAuthRequest struct {
	Code           string `json:"code"`
	InvitationCode string `json:"invitation_code" validate:"max=128"`
}
