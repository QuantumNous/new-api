package dto

type CreateRedemptionRequest struct {
	Name        string `json:"name"`
	Quota       int    `json:"quota"`
	ExpiredTime int64  `json:"expired_time"`

	// Backward-compatible count.
	Count int `json:"count"`

	// Optional explicit switch for random generation (for compatibility with some clients).
	RandomEnabledFlag *bool `json:"random_enabled"`

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
	heuristic := r.RandomMin != nil || r.RandomMax != nil || r.RandomPrefix != "" || r.RandomCount != nil
	if r.RandomEnabledFlag == nil {
		return heuristic
	}
	// If explicitly enabled, force random branch (and controller will validate min/max).
	// If explicitly disabled, still allow heuristic trigger for compatibility.
	if *r.RandomEnabledFlag {
		return true
	}
	return heuristic
}