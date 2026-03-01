package dto

// TokenUsageData is the response data for GET /api/token/usage.
type TokenUsageData struct {
	Object             string          `json:"object"`
	Name               string          `json:"name"`
	TotalGranted       int             `json:"total_granted"`
	TotalUsed          int             `json:"total_used"`
	TotalAvailable     int             `json:"total_available"`
	UnlimitedQuota     bool            `json:"unlimited_quota"`
	ModelLimits        map[string]bool `json:"model_limits"`
	ModelLimitsEnabled bool            `json:"model_limits_enabled"`
	ExpiresAt          int64           `json:"expires_at"`
}

// TokenBatch is the request body for batch token operations.
type TokenBatch struct {
	Ids []int `json:"ids"`
}
