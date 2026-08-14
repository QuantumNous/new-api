package autopricing

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestFrozenSnapshotIsVerifiedAndRestorable(t *testing.T) {
	snapshot, err := loadFrozenSnapshotAt(time.Date(2026, time.August, 14, 0, 0, 0, 0, time.UTC))
	require.NoError(t, err)
	assert.Equal(t, "offline-reviewed-2026-08-14", snapshot.Version)
	catalog, err := RestoreCatalog(snapshot)
	require.NoError(t, err)
	entry, ok := catalog.Lookup("gpt-5.6-sol")
	require.True(t, ok)
	assert.Equal(t, 2.5, entry.ModelRatio)
	assert.Equal(t, 6.0, entry.CompletionRatio)
	assert.Equal(t, 0.1, entry.CacheRatio)
	assert.True(t, entry.HasBillingExpr)
}

func TestFrozenSnapshotFailsClosedAfterAllReviewedPricesExpire(t *testing.T) {
	_, err := loadFrozenSnapshotAt(time.Date(2027, time.August, 14, 0, 0, 0, 0, time.UTC))
	assert.ErrorContains(t, err, "no usable entries")
}
