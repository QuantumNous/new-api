package dto

type CreateRedemptionRequest struct {
	Name        string `json:"name"`
	Quota       int    `json:"quota"`
	ExpiredTime int64  `json:"expired_time"`

	// Backward-compatible count.
	Count int `json:"count"`

	// New random generation fields.
	RandomMin    *int64  `json:"random_min"`
	RandomMax    *int64  `json:"random_max"`
	RandomPrefix string  `json:"random_prefix"`
	RandomCount  *int    `json:"random_count"`
}

func (r CreateRedemptionRequest) EffectiveCount() int {
	if r.RandomCount != nil && *r.RandomCount > 0 {
		return *r.RandomCount
	}
	return r.Count
}

func (r CreateRedemptionRequest) RandomEnabled() bool {
	return r.RandomMin != nil || r.RandomMax != nil || r.RandomPrefix != "" || r.RandomCount != nil
}