package origin

import (
	"os"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCatalogInstallsVerifiedFullSnapshotAtomically(t *testing.T) {
	raw, err := os.ReadFile("../contracts/origin/examples/catalog.execution-snapshot-published.v1.valid.json")
	require.NoError(t, err)
	clock := func() time.Time { return time.Date(2026, 8, 14, 5, 5, 0, 0, time.UTC) }
	view := NewCatalogView(clock)

	require.NoError(t, view.Install(raw, `"catalog-42"`))
	route, err := view.ApprovedRoute("origin-codex", RequestedCapabilities{
		Streaming:     true,
		FunctionTools: true,
		Reasoning:     true,
	}, 1200, 4096)

	require.NoError(t, err)
	assert.Equal(t, int64(42), view.Version())
	assert.Equal(t, "route_codex_responses_primary", route.RouteID)
	assert.Equal(t, "beenex-codex-1", route.UpstreamModelID)
	assert.Equal(t, `"catalog-42"`, view.ETag())
}

func TestCatalogRejectsUnknownFieldsAndExpiredSnapshot(t *testing.T) {
	raw, err := os.ReadFile("../contracts/origin/examples/catalog.execution-snapshot-published.v1.valid.json")
	require.NoError(t, err)

	var document map[string]any
	require.NoError(t, common.Unmarshal(raw, &document))
	document["unexpected"] = true
	withUnknown, err := common.Marshal(document)
	require.NoError(t, err)

	view := NewCatalogView(func() time.Time {
		return time.Date(2026, 8, 14, 5, 16, 0, 0, time.UTC)
	})
	assert.Error(t, view.Install(withUnknown, `"catalog-42"`))
	assert.Error(t, view.Install(raw, `"catalog-42"`))
	assert.Equal(t, int64(0), view.Version())
}

func TestCatalogRejectsRollbackAndSameVersionDifferentContent(t *testing.T) {
	raw, err := os.ReadFile("../contracts/origin/examples/catalog.execution-snapshot-published.v1.valid.json")
	require.NoError(t, err)
	view := NewCatalogView(func() time.Time {
		return time.Date(2026, 8, 14, 5, 5, 0, 0, time.UTC)
	})
	require.NoError(t, view.Install(raw, `"catalog-42"`))

	var event CatalogExecutionSnapshotPublishedV1
	require.NoError(t, common.Unmarshal(raw, &event))
	event.Payload.SnapshotVersion = 41
	event.Payload.ContentSHA256, err = CanonicalSnapshotHash(event.Payload)
	require.NoError(t, err)
	rollback, err := common.Marshal(event)
	require.NoError(t, err)
	assert.ErrorIs(t, view.Install(rollback, `"catalog-41"`), ErrCatalogRollback)

	event.Payload.SnapshotVersion = 42
	event.Payload.Routes[0].UpstreamModelID = "beenex-codex-2"
	event.Payload.ContentSHA256, err = CanonicalSnapshotHash(event.Payload)
	require.NoError(t, err)
	conflict, err := common.Marshal(event)
	require.NoError(t, err)
	assert.ErrorIs(t, view.Install(conflict, `"catalog-42b"`), ErrCatalogVersionConflict)
}

func TestCatalogFailsClosedForUnknownModelDisabledRouteAndCapabilityOverflow(t *testing.T) {
	raw, err := os.ReadFile("../contracts/origin/examples/catalog.execution-snapshot-published.v1.valid.json")
	require.NoError(t, err)
	view := NewCatalogView(func() time.Time {
		return time.Date(2026, 8, 14, 5, 5, 0, 0, time.UTC)
	})
	require.NoError(t, view.Install(raw, `"catalog-42"`))

	_, err = view.ApprovedRoute("unknown-model", RequestedCapabilities{}, 1, 1)
	assert.ErrorIs(t, err, ErrCatalogModelUnknown)
	_, err = view.ApprovedRoute("origin-codex", RequestedCapabilities{}, 200001, 1)
	assert.ErrorIs(t, err, ErrCatalogCapabilityDenied)
	_, err = view.ApprovedRoute("origin-codex", RequestedCapabilities{}, 1, 100001)
	assert.ErrorIs(t, err, ErrCatalogCapabilityDenied)
}

func TestCatalogRejectsContractLengthBounds(t *testing.T) {
	raw, err := os.ReadFile("../contracts/origin/examples/catalog.execution-snapshot-published.v1.valid.json")
	require.NoError(t, err)
	var event CatalogExecutionSnapshotPublishedV1
	require.NoError(t, common.Unmarshal(raw, &event))
	event.Payload.Routes[0].RouteID = strings.Repeat("r", 161)
	event.Payload.ContentSHA256, err = CanonicalSnapshotHash(event.Payload)
	require.NoError(t, err)
	invalid, err := common.Marshal(event)
	require.NoError(t, err)
	view := NewCatalogView(func() time.Time {
		return time.Date(2026, 8, 14, 5, 5, 0, 0, time.UTC)
	})

	assert.Error(t, view.Install(invalid, `"catalog-42"`))
}
