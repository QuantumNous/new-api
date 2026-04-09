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

// CreateTokenRequest is the request body for POST /api/token/.
type CreateTokenRequest struct {
	Name               string  `json:"name"`
	ExpiredTime        int64   `json:"expired_time"`
	RemainQuota        int     `json:"remain_quota"`
	UnlimitedQuota     bool    `json:"unlimited_quota"`
	ModelLimitsEnabled bool    `json:"model_limits_enabled"`
	ModelLimits        string  `json:"model_limits"`
	AllowIps           *string `json:"allow_ips"`
	Group              string  `json:"group"`
	CrossGroupRetry    bool    `json:"cross_group_retry"`
}

// UpdateTokenRequest is the request body for PUT /api/token/.
type UpdateTokenRequest struct {
	Id                 int     `json:"id"`
	Status             int     `json:"status"`
	Name               string  `json:"name"`
	ExpiredTime        int64   `json:"expired_time"`
	RemainQuota        int     `json:"remain_quota"`
	UnlimitedQuota     bool    `json:"unlimited_quota"`
	ModelLimitsEnabled bool    `json:"model_limits_enabled"`
	ModelLimits        string  `json:"model_limits"`
	AllowIps           *string `json:"allow_ips"`
	Group              string  `json:"group"`
	CrossGroupRetry    bool    `json:"cross_group_retry"`
}

// TokenBatch is the request body for batch token operations.
type TokenBatch struct {
	Ids []int `json:"ids"`
}
