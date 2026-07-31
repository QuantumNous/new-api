package dto

type BytePlusRealPersonCreateRequest struct {
	Name string `json:"name"`
}

type BytePlusRealPersonResponse struct {
	ID                    string `json:"id"`
	Object                string `json:"object"`
	Name                  string `json:"name"`
	Status                string `json:"status"`
	VerificationURL       string `json:"verification_url,omitempty"`
	VerificationExpiresAt int64  `json:"verification_expires_at,omitempty"`
	CreatedAt             int64  `json:"created_at"`
}

type BytePlusRealPersonListResponse struct {
	Object    string                       `json:"object"`
	Data      []BytePlusRealPersonResponse `json:"data"`
	HasMore   bool                         `json:"has_more"`
	NextAfter string                       `json:"next_after,omitempty"`
}

func BytePlusRealPersonAPIStatus(status string) string {
	switch status {
	case "PendingVerification":
		return "pending_verification"
	case "Verifying":
		return "verifying"
	case "Active":
		return "active"
	case "Failed":
		return "failed"
	case "Expired":
		return "expired"
	default:
		return "failed"
	}
}
