package dto

type CreateRedemptionRequest struct {
	Name        string `json:"name"`
	Quota       int    `json:"quota"`
	ExpiredTime int64  `json:"expired_time"`

	// Backward-compatible count.
	Count int `json:"count"`

	// Key prefix for generated redemption codes (e.g., "VIP-").
	KeyPrefix string `json:"key_prefix"`

	// Random quota mode: generate redemption codes with random quota in [QuotaMin, QuotaMax].
	RandomQuotaEnabled *bool `json:"random_quota_enabled"`
	QuotaMin           *int  `json:"quota_min"`
	QuotaMax           *int  `json:"quota_max"`
}

func (r CreateRedemptionRequest) EffectiveCount() int {
	if r.Count <= 0 {
		return 1
	}
	return r.Count
}

func (r CreateRedemptionRequest) RandomQuotaMode() bool {
	if r.RandomQuotaEnabled != nil && *r.RandomQuotaEnabled {
		return true
	}
	return r.QuotaMin != nil && r.QuotaMax != nil
}