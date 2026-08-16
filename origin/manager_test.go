package origin

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type fakeControlPlane struct {
	admissionRequests []AdmissionRequest
	admissionResults  []AdmissionResult
	admissionErrors   []error
	snapshots         []CatalogFetchResult
}

func (fake *fakeControlPlane) CreateAdmission(_ context.Context, _ string, request AdmissionRequest) (AdmissionResult, error) {
	fake.admissionRequests = append(fake.admissionRequests, request)
	index := len(fake.admissionRequests) - 1
	if index < len(fake.admissionErrors) && fake.admissionErrors[index] != nil {
		return AdmissionResult{}, fake.admissionErrors[index]
	}
	return fake.admissionResults[index], nil
}

func (fake *fakeControlPlane) FetchCatalog(_ context.Context, _ string, _ string) (CatalogFetchResult, error) {
	result := fake.snapshots[0]
	fake.snapshots = fake.snapshots[1:]
	return result, nil
}

func TestManagerRefreshesCatalogOnceAndRetriesAdmissionWithSameRequestID(t *testing.T) {
	now := time.Date(2026, 8, 14, 5, 5, 0, 0, time.UTC)
	view := NewCatalogView(func() time.Time { return now })
	raw42, err := os.ReadFile("../contracts/origin/examples/catalog.execution-snapshot-published.v1.valid.json")
	require.NoError(t, err)
	require.NoError(t, view.Install(raw42, `"catalog-42"`))

	var event43 CatalogExecutionSnapshotPublishedV1
	require.NoError(t, common.Unmarshal(raw42, &event43))
	event43.Payload.SnapshotVersion = 43
	event43.Payload.PreviousSnapshotVersion = common.GetPointer(int64(42))
	event43.Payload.ContentSHA256, err = CanonicalSnapshotHash(event43.Payload)
	require.NoError(t, err)
	raw43, err := common.Marshal(event43)
	require.NoError(t, err)

	requestID := "01980000-0000-7000-8000-000000000002"
	result := AdmissionResult{
		RequestID:              requestID,
		TenantID:               "01980000-0000-7000-8000-000000000003",
		ProjectID:              "01980000-0000-7000-8000-000000000004",
		APIKeyID:               "01980000-0000-7000-8000-000000000005",
		ReservationID:          "01980000-0000-7000-8000-000000000006",
		ApprovedCatalogVersion: 43,
		RouteID:                "route_codex_responses_primary",
		ExpiresAt:              "2026-08-14T05:10:00Z",
	}
	fake := &fakeControlPlane{
		admissionErrors:  []error{&ControlError{Status: 409, Code: "catalog_stale"}, nil},
		admissionResults: []AdmissionResult{{}, result},
		snapshots:        []CatalogFetchResult{{Body: raw43, ETag: `"catalog-43"`, Version: 43}},
	}
	manager := NewManager(fake, view, func() time.Time { return now })

	grant, err := manager.Admit(context.Background(), "sk-oa-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcd", AdmissionInput{
		RequestID:          requestID,
		PlatformModel:      "origin-codex",
		InputTokenEstimate: 1200,
		MaxOutputTokens:    4096,
		Capabilities: RequestedCapabilities{
			Streaming:     true,
			FunctionTools: true,
			Reasoning:     true,
		},
	})

	require.NoError(t, err)
	assert.Equal(t, int64(43), grant.Admission.ApprovedCatalogVersion)
	assert.Equal(t, "beenex-codex-1", grant.Route.UpstreamModelID)
	require.Len(t, fake.admissionRequests, 2)
	assert.Equal(t, requestID, fake.admissionRequests[0].RequestID)
	assert.Equal(t, requestID, fake.admissionRequests[1].RequestID)
	assert.Equal(t, int64(42), fake.admissionRequests[0].CatalogVersion)
	assert.Equal(t, int64(43), fake.admissionRequests[1].CatalogVersion)
}

func TestManagerRejectsRefreshFailureWithoutSecondAdmission(t *testing.T) {
	now := time.Date(2026, 8, 14, 5, 5, 0, 0, time.UTC)
	view := NewCatalogView(func() time.Time { return now })
	raw, err := os.ReadFile("../contracts/origin/examples/catalog.execution-snapshot-published.v1.valid.json")
	require.NoError(t, err)
	require.NoError(t, view.Install(raw, `"catalog-42"`))
	fake := &fakeControlPlane{
		admissionErrors:  []error{&ControlError{Status: 409, Code: "catalog_stale"}},
		admissionResults: []AdmissionResult{{}},
		snapshots:        []CatalogFetchResult{{NotModified: true}},
	}
	manager := NewManager(fake, view, func() time.Time { return now })

	_, err = manager.Admit(context.Background(), "sk-oa-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcd", AdmissionInput{
		RequestID:          "01980000-0000-7000-8000-000000000002",
		PlatformModel:      "origin-codex",
		InputTokenEstimate: 1,
		MaxOutputTokens:    1,
	})

	require.Error(t, err)
	assert.ErrorIs(t, err, ErrCatalogRefreshFailed)
	assert.Len(t, fake.admissionRequests, 1)
}

func TestManagerRejectsAdmissionRouteThatIsNotInApprovedSnapshot(t *testing.T) {
	now := time.Date(2026, 8, 14, 5, 5, 0, 0, time.UTC)
	view := NewCatalogView(func() time.Time { return now })
	raw, err := os.ReadFile("../contracts/origin/examples/catalog.execution-snapshot-published.v1.valid.json")
	require.NoError(t, err)
	require.NoError(t, view.Install(raw, `"catalog-42"`))
	requestID := "01980000-0000-7000-8000-000000000002"
	fake := &fakeControlPlane{
		admissionResults: []AdmissionResult{{
			RequestID:              requestID,
			TenantID:               "01980000-0000-7000-8000-000000000003",
			ProjectID:              "01980000-0000-7000-8000-000000000004",
			APIKeyID:               "01980000-0000-7000-8000-000000000005",
			ReservationID:          "01980000-0000-7000-8000-000000000006",
			ApprovedCatalogVersion: 42,
			RouteID:                "unknown_route",
			ExpiresAt:              "2026-08-14T05:10:00Z",
		}},
	}
	manager := NewManager(fake, view, func() time.Time { return now })

	_, err = manager.Admit(context.Background(), "sk-oa-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcd", AdmissionInput{
		RequestID:          requestID,
		PlatformModel:      "origin-codex",
		InputTokenEstimate: 1,
		MaxOutputTokens:    1,
	})

	require.Error(t, err)
	assert.ErrorIs(t, err, ErrUntrustedPlatformResponse)
}
