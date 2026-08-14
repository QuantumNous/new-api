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

func TestGuardCatalogAcceptsExactlyThresholdAndReviewsPriceShapeChanges(t *testing.T) {
	active := catalogForGuard(t, "v1", 2, 8, SourceLiteLLM)
	exact := catalogForGuard(t, "v2", 2.5, 10, SourceLiteLLM)
	_, pending, err := GuardCatalog(active, exact, 0.25, nil)
	require.NoError(t, err)
	assert.Empty(t, pending, "a change of exactly 25 percent must be accepted")

	cases := []struct {
		name   string
		mutate func(*PriceRecord)
		reason string
	}{
		{name: "field added", mutate: func(record *PriceRecord) { record.Standard.CacheRead = pricePtr(.2) }, reason: "pricing fields added or removed"},
		{name: "zero changed", mutate: func(record *PriceRecord) { record.Standard.Input = pricePtr(0) }, reason: "zero price changed"},
		{name: "audio structure added", mutate: func(record *PriceRecord) { record.Standard.AudioInput = pricePtr(3) }, reason: "pricing fields added or removed"},
	}
	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			source := newSourceCatalog(SourceLiteLLM, "v3")
			record := active.records["guard-model"]
			test.mutate(&record)
			source.Records["guard-model"] = record
			candidate, mergeErr := MergeSources(source)
			require.NoError(t, mergeErr)
			_, reviews, guardErr := GuardCatalog(active, candidate, 0.25, nil)
			require.NoError(t, guardErr)
			require.Len(t, reviews, 1)
			assert.Equal(t, test.reason, reviews[0].Reason)
		})
	}
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

func TestGuardCatalogRequiresReviewBeforeRemovingModel(t *testing.T) {
	activeSource := newSourceCatalog(SourceLiteLLM, "v1")
	activeSource.Records["guard-model"] = PriceRecord{Model: "guard-model", PrimarySource: SourceLiteLLM, Standard: CostSet{Input: pricePtr(2), Output: pricePtr(8)}}
	activeSource.Records["survivor"] = PriceRecord{Model: "survivor", PrimarySource: SourceLiteLLM, Standard: CostSet{Input: pricePtr(1), Output: pricePtr(2)}}
	active, err := MergeSources(activeSource)
	require.NoError(t, err)

	candidateSource := newSourceCatalog(SourceLiteLLM, "v2")
	candidateSource.Records["survivor"] = activeSource.Records["survivor"]
	candidate, err := MergeSources(candidateSource)
	require.NoError(t, err)

	guarded, pending, err := GuardCatalog(active, candidate, 0.25, nil)
	require.NoError(t, err)
	require.Len(t, pending, 1)
	assert.Equal(t, "model removed from catalog", pending[0].Reason)
	assert.Nil(t, pending[0].Candidate)
	_, ok := guarded.Lookup("guard-model")
	assert.True(t, ok, "the active price must remain until deletion is approved")

	approved, remaining, _, err := ApplyReview(guarded, pending, []string{pending[0].Fingerprint}, true)
	require.NoError(t, err)
	assert.Empty(t, remaining)
	_, ok = approved.Lookup("guard-model")
	assert.False(t, ok)
}

func TestGuardCatalogRequiresReviewBeforeAddingRemoteModel(t *testing.T) {
	active := catalogForGuard(t, "v1", 2, 8, SourceLiteLLM)
	candidateSource := newSourceCatalog(SourceLiteLLM, "v2")
	candidateSource.Records["guard-model"] = active.records["guard-model"]
	candidateSource.Records["new-model"] = PriceRecord{
		Model: "new-model", PrimarySource: SourceLiteLLM,
		Standard: CostSet{Input: pricePtr(1), Output: pricePtr(4)},
	}
	candidate, err := MergeSources(candidateSource)
	require.NoError(t, err)

	guarded, pending, err := GuardCatalog(active, candidate, 0.25, nil)
	require.NoError(t, err)
	require.Len(t, pending, 1)
	assert.Equal(t, "new-model", pending[0].Model)
	assert.Equal(t, "model added to catalog", pending[0].Reason)
	assert.Equal(t, candidate.Version, pending[0].CandidateVersion)
	_, ok := guarded.Lookup("new-model")
	assert.False(t, ok)
}

func TestGuardCatalogAcceptsReviewedOverrideAddition(t *testing.T) {
	active := catalogForGuard(t, "v1", 2, 8, SourceLiteLLM)
	candidateSource := newSourceCatalog(SourceOverride, "reviewed-v2")
	candidateSource.Records["guard-model"] = active.records["guard-model"]
	candidateSource.Records["reviewed-model"] = PriceRecord{
		Model: "reviewed-model", PrimarySource: SourceOverride,
		Standard: CostSet{Input: pricePtr(5), Output: pricePtr(30)},
	}
	candidate, err := MergeSources(candidateSource)
	require.NoError(t, err)

	guarded, pending, err := GuardCatalog(active, candidate, 0.25, nil)
	require.NoError(t, err)
	assert.Empty(t, pending)
	_, ok := guarded.Lookup("reviewed-model")
	assert.True(t, ok)
}

func TestGuardCatalogTreatsAliasChangeAsStructureChange(t *testing.T) {
	activeSource := newSourceCatalog(SourceLiteLLM, "v1")
	activeSource.Records["guard-model"] = PriceRecord{Model: "guard-model", PrimarySource: SourceLiteLLM, Standard: CostSet{Input: pricePtr(2), Output: pricePtr(8)}, Aliases: []string{"old-alias"}}
	active, err := MergeSources(activeSource)
	require.NoError(t, err)

	candidateSource := newSourceCatalog(SourceLiteLLM, "v2")
	candidateSource.Records["guard-model"] = PriceRecord{Model: "guard-model", PrimarySource: SourceLiteLLM, Standard: CostSet{Input: pricePtr(2), Output: pricePtr(8)}, Aliases: []string{"new-alias"}}
	candidate, err := MergeSources(candidateSource)
	require.NoError(t, err)

	_, pending, err := GuardCatalog(active, candidate, 0.25, nil)
	require.NoError(t, err)
	require.Len(t, pending, 1)
	assert.Equal(t, "billing structure changed", pending[0].Reason)
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

	approved, remaining, rejected, err := ApplyReview(guarded, pending, []string{pending[0].Fingerprint}, true)
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

func TestApplyReviewRejectsStaleFingerprintForSameModel(t *testing.T) {
	active := catalogForGuard(t, "v1", 2, 8, SourceLiteLLM)
	firstCandidate := catalogForGuard(t, "v2", 4, 16, SourceLiteLLM)
	_, firstPending, err := GuardCatalog(active, firstCandidate, 0.25, nil)
	require.NoError(t, err)
	require.Len(t, firstPending, 1)

	secondCandidate := catalogForGuard(t, "v3", 6, 24, SourceLiteLLM)
	guarded, secondPending, err := GuardCatalog(active, secondCandidate, 0.25, nil)
	require.NoError(t, err)
	require.Len(t, secondPending, 1)

	_, _, _, err = ApplyReview(guarded, secondPending, []string{firstPending[0].Fingerprint}, true)
	assert.ErrorContains(t, err, "not pending or is stale")
}
