package relay

import (
	"testing"

	"github.com/QuantumNous/new-api/dto"
)

func TestNormalizeImageUsageForBillingOnlyFallbacksPerCall(t *testing.T) {
	t.Run("token-priced usage keeps zero prompt tokens", func(t *testing.T) {
		usage := &dto.Usage{CompletionTokens: 196}
		normalizeImageUsageForBilling(usage, false)
		if usage.PromptTokens != 0 || usage.TotalTokens != 0 {
			t.Fatalf("token usage was synthesized: %+v", usage)
		}
	})

	t.Run("per-call empty usage still gets a billable marker", func(t *testing.T) {
		usage := &dto.Usage{}
		normalizeImageUsageForBilling(usage, true)
		if usage.PromptTokens != 1 || usage.TotalTokens != 1 {
			t.Fatalf("per-call fallback missing: %+v", usage)
		}
	})
}
