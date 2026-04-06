package types

type ModelTierPricingTier struct {
	MinTokens       int      `json:"min_tokens"`
	MaxTokens       *int     `json:"max_tokens,omitempty"`
	InputPrice      float64  `json:"input_price"`
	CompletionPrice float64  `json:"completion_price"`
	CacheReadPrice  *float64 `json:"cache_read_price,omitempty"`
}

type ModelTierPricingConfig struct {
	Enabled bool                   `json:"enabled"`
	Basis   string                 `json:"basis"`
	Tiers   []ModelTierPricingTier `json:"tiers"`
}

type TierPricingMeta struct {
	Enabled        bool     `json:"enabled"`
	Basis          string   `json:"basis"`
	TierIndex      int      `json:"tier_index"`
	MinTokens      int      `json:"tier_min_tokens"`
	MaxTokens      *int     `json:"tier_max_tokens,omitempty"`
	BasisValue     int      `json:"tier_basis_value"`
	BaseCacheRatio *float64 `json:"-"`
}
