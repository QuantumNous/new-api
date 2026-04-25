package types

// ContextTierRatio defines a pricing tier based on prompt token count.
// Tiers are evaluated in order; the first matching tier is used.
// Set MaxTokens to -1 on the last tier to act as the catch-all.
type ContextTierRatio struct {
	MaxTokens       int     `json:"max_tokens"`       // inclusive upper bound; -1 = unlimited
	InputRatio      float64 `json:"input_ratio"`      // replaces ModelRatio for this tier
	CompletionRatio float64 `json:"completion_ratio"` // replaces CompletionRatio for this tier
}

// SelectContextTier returns the tier that matches the given prompt token count.
// Returns nil if the slice is empty.
func SelectContextTier(tiers []ContextTierRatio, promptTokens int) *ContextTierRatio {
	for i := range tiers {
		if tiers[i].MaxTokens == -1 || promptTokens <= tiers[i].MaxTokens {
			return &tiers[i]
		}
	}
	if len(tiers) > 0 {
		return &tiers[len(tiers)-1]
	}
	return nil
}
