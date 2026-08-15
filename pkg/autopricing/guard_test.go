package autopricing

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func catalogForGuard(t *testing.T, version string, input, output float64, source SourceID) *Catalog {
	t.Helper()
	sourceCatalog := newSourceCatalog(source, version)
	sourceCatalog.Records["guard-model"] = PriceRecord{
		Model:         "guard-model",
		PrimarySource: source,
		Standard: CostSet{
			Input:  pricePtr(input),
			Output: pricePtr(output),
		},
	}
	catalog, err := MergeSources(sourceCatalog)
	require.NoError(t, err)
	return catalog
}

func TestGuardCatalogAutoAcceptsSmallNumericChanges(t *testing.T) {
	active := catalogForGuard(t, "v1", 2, 8, SourceLiteLLM)
	candidate := catalogForGuard(t, "v2", 2.4, 9.6, SourceLiteLLM)

	next, pending, err := GuardCatalog(active, candidate, 0.25, nil)
	require.NoError(t, err)
	assert.Empty(t, pending)

	entry, ok := next.Lookup("guard-model")
	require.True(t, ok)
	assert.Equal(t, 1.2, entry.ModelRatio)
	assert.Equal(t, 4.0, entry.CompletionRatio)
}

func TestGuardCatalogKeepsActivePriceWhenChangeExceedsThreshold(t *testing.T) {
	active := catalogForGuard(t, "v1", 2, 8, SourceLiteLLM)
	candidate := catalogForGuard(t, "v2", 4, 16, SourceLiteLLM)

	next, pending, err := GuardCatalog(active, candidate, 0.25, nil)
	require.NoError(t, err)
	require.Len(t, pending, 1)
	assert.Equal(t, "guard-model", pending[0].Model)
	assert.NotEmpty(t, pending[0].Fingerprint)
	assert.Contains(t, pending[0].Reason, "threshold")

	entry, ok := next.Lookup("guard-model")
	require.True(t, ok)
	assert.Equal(t, 1.0, entry.ModelRatio, "active price must remain unchanged before approval")
}

func TestGuardCatalogTreatsBillingStructureChangeAsPending(t *testing.T) {
	active := catalogForGuard(t, "v1", 2, 8, SourceLiteLLM)
	candidateSource := newSourceCatalog(SourceLiteLLM, "v2")
	candidateSource.Records["guard-model"] = PriceRecord{
		Model:         "guard-model",
		PrimarySource: SourceLiteLLM,
		Standard:      CostSet{Input: pricePtr(2), Output: pricePtr(8)},
		Tiers: []PriceTier{
			{Name: "short", MaxInputTokens: 200000, Costs: CostSet{Input: pricePtr(2), Output: pricePtr(8)}},
			{Name: "long", Costs: CostSet{Input: pricePtr(4), Output: pricePtr(12)}},
		},
	}
	candidate, err := MergeSources(candidateSource)
	require.NoError(t, err)

	next, pending, err := GuardCatalog(active, candidate, 0.25, nil)
	require.NoError(t, err)
	require.Len(t, pending, 1)
	assert.Contains(t, pending[0].Reason, "structure")
	entry, ok := next.Lookup("guard-model")
	require.True(t, ok)
	assert.False(t, entry.HasBillingExpr)
}

func TestGuardCatalogReviewedOverrideBypassesReview(t *testing.T) {
	active := catalogForGuard(t, "v1", 2, 8, SourceLiteLLM)
	candidate := catalogForGuard(t, "override-v1", 20, 80, SourceOverride)

	next, pending, err := GuardCatalog(active, candidate, 0.25, nil)
	require.NoError(t, err)
	assert.Empty(t, pending)

	entry, ok := next.Lookup("guard-model")
	require.True(t, ok)
	assert.Equal(t, SourceOverride, entry.Source)
	assert.Equal(t, 10.0, entry.ModelRatio)
}

func TestRejectedFingerprintSuppressesSameCandidateUntilVersionChanges(t *testing.T) {
	active := catalogForGuard(t, "v1", 2, 8, SourceLiteLLM)
	candidate := catalogForGuard(t, "v2", 4, 16, SourceLiteLLM)

	_, pending, err := GuardCatalog(active, candidate, 0.25, nil)
	require.NoError(t, err)
	require.Len(t, pending, 1)

	rejected := map[string]bool{pending[0].Fingerprint: true}
	next, repeated, err := GuardCatalog(active, candidate, 0.25, rejected)
	require.NoError(t, err)
	assert.Empty(t, repeated)
	entry, ok := next.Lookup("guard-model")
	require.True(t, ok)
	assert.Equal(t, 1.0, entry.ModelRatio)

	newVersion := catalogForGuard(t, "v3", 4, 16, SourceLiteLLM)
	_, changedVersion, err := GuardCatalog(active, newVersion, 0.25, rejected)
	require.NoError(t, err)
	require.Len(t, changedVersion, 1)
	assert.NotEqual(t, pending[0].Fingerprint, changedVersion[0].Fingerprint)
}

func TestApplyReviewApprovesSelectedModelsAndRejectsFingerprints(t *testing.T) {
	active := catalogForGuard(t, "v1", 2, 8, SourceLiteLLM)
	candidate := catalogForGuard(t, "v2", 4, 16, SourceLiteLLM)
	guarded, pending, err := GuardCatalog(active, candidate, 0.25, nil)
	require.NoError(t, err)
	require.Len(t, pending, 1)

	approved, remaining, rejected, err := ApplyReview(guarded, pending, []string{"guard-model"}, true)
	require.NoError(t, err)
	assert.Empty(t, remaining)
	assert.Empty(t, rejected)
	entry, ok := approved.Lookup("guard-model")
	require.True(t, ok)
	assert.Equal(t, 2.0, entry.ModelRatio)

	guarded, pending, err = GuardCatalog(active, candidate, 0.25, nil)
	require.NoError(t, err)
	kept, remaining, rejected, err := ApplyReview(guarded, pending, nil, false)
	require.NoError(t, err)
	assert.Empty(t, remaining)
	require.Equal(t, []string{pending[0].Fingerprint}, rejected)
	entry, ok = kept.Lookup("guard-model")
	require.True(t, ok)
	assert.Equal(t, 1.0, entry.ModelRatio)
}
