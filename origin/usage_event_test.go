package origin

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func usageAttemptFixture() model.OriginRequestAttempt {
	return model.OriginRequestAttempt{
		ID:              "01980000-0000-7000-8000-000000000007",
		RequestID:       "01980000-0000-7000-8000-000000000002",
		ReservationID:   "01980000-0000-7000-8000-000000000006",
		TenantID:        "01980000-0000-7000-8000-000000000003",
		ProjectID:       "01980000-0000-7000-8000-000000000004",
		APIKeyID:        "01980000-0000-7000-8000-000000000005",
		CatalogVersion:  42,
		RouteID:         "route_codex_responses_primary",
		PlatformModel:   "origin-codex",
		Operation:       "responses",
		UpstreamModelID: "beenex-codex-1",
		StartedAt:       time.Date(2026, 8, 14, 5, 0, 0, 0, time.UTC),
	}
}

func TestBuildUsageEventUsesPersistedMessagesOperation(t *testing.T) {
	attempt := usageAttemptFixture()
	attempt.Operation = "messages"
	now := time.Date(2026, 8, 14, 5, 0, 3, 0, time.UTC)

	event, err := BuildUsageEvent(
		"01980000-0000-7000-8000-000000000405", 1, attempt,
		AttemptOutcome{TerminalStatus: "SUCCESS", ContactState: "COMPLETED", Usage: &UsageObservation{InputTokens: 14, OutputTokens: 5, CachedTokens: 3}},
		now, now, true,
	)

	require.NoError(t, err)
	assert.Equal(t, "messages_stream", event.Operation)
	assert.Equal(t, "14", event.Items[0].Quantity)
	assert.Equal(t, "3", event.Items[2].Quantity)
}

func TestBuildUsageEventSettlesReportedNonStreamingUsage(t *testing.T) {
	attempt := usageAttemptFixture()
	completedAt := time.Date(2026, 8, 14, 5, 0, 2, 0, time.UTC)
	event, err := BuildUsageEvent(
		"01980000-0000-7000-8000-000000000401",
		1,
		attempt,
		AttemptOutcome{
			TerminalStatus: "SUCCESS",
			ContactState:   "COMPLETED",
			Usage: &UsageObservation{
				InputTokens:       1200,
				OutputTokens:      320,
				CachedTokens:      200,
				ReasoningTokens:   40,
				ProviderRequestID: "resp_example_nonstream_001",
			},
		},
		completedAt,
		completedAt.Add(time.Second),
		false,
	)

	require.NoError(t, err)
	assert.Equal(t, "metering.usage_recorded.v2", event.EventType)
	assert.Equal(t, "responses", event.Operation)
	assert.Equal(t, "SETTLE", event.ReservationAction)
	assert.Equal(t, "REPORTED", event.UsageStatus)
	require.NotNil(t, event.UsageSource)
	assert.Equal(t, "PROVIDER", *event.UsageSource)
	assert.Equal(t, "NOT_REQUIRED", event.Reconciliation.Status)
	assert.Len(t, event.Items, 4)
	assert.Equal(t, "1200", event.Items[0].Quantity)
	assert.Equal(t, "320", event.Items[1].Quantity)
}

func TestBuildUsageEventDisconnectWithUsageSettlesWithoutReplay(t *testing.T) {
	attempt := usageAttemptFixture()
	now := time.Date(2026, 8, 14, 5, 0, 3, 0, time.UTC)
	event, err := BuildUsageEvent(
		"01980000-0000-7000-8000-000000000402",
		1,
		attempt,
		AttemptOutcome{
			TerminalStatus: "CLIENT_DISCONNECTED",
			ContactState:   "COMPLETED",
			Usage:          &UsageObservation{InputTokens: 1200, OutputTokens: 221},
		},
		now,
		now,
		true,
	)

	require.NoError(t, err)
	assert.Equal(t, "responses_stream", event.Operation)
	assert.Equal(t, "SETTLE", event.ReservationAction)
	assert.Equal(t, "REPORTED", event.UsageStatus)
}

func TestBuildUsageEventDisconnectWithoutUsageRequiresReconciliation(t *testing.T) {
	attempt := usageAttemptFixture()
	now := time.Date(2026, 8, 14, 5, 0, 3, 0, time.UTC)
	event, err := BuildUsageEvent(
		"01980000-0000-7000-8000-000000000403",
		1,
		attempt,
		AttemptOutcome{
			TerminalStatus: "CLIENT_DISCONNECTED",
			ContactState:   "OUTCOME_UNKNOWN",
			ErrorCategory:  "client_disconnected_before_usage",
		},
		now,
		now,
		true,
	)

	require.NoError(t, err)
	assert.Equal(t, "RECONCILE", event.ReservationAction)
	assert.Equal(t, "MISSING", event.UsageStatus)
	assert.Nil(t, event.UsageSource)
	assert.Empty(t, event.Items)
	assert.Equal(t, "REQUIRED", event.Reconciliation.Status)
	require.NotNil(t, event.Reconciliation.Reason)
	assert.Equal(t, "CLIENT_DISCONNECTED", *event.Reconciliation.Reason)
}

func TestBuildUsageEventBeforeUpstreamFailureReleasesReservation(t *testing.T) {
	attempt := usageAttemptFixture()
	now := time.Date(2026, 8, 14, 5, 0, 1, 0, time.UTC)
	event, err := BuildUsageEvent(
		"01980000-0000-7000-8000-000000000404",
		1,
		attempt,
		AttemptOutcome{
			TerminalStatus: "GATEWAY_REJECTED",
			ContactState:   "NOT_CONTACTED",
			ErrorCategory:  "before_upstream_failure",
		},
		now,
		now,
		false,
	)

	require.NoError(t, err)
	assert.Equal(t, "RELEASE", event.ReservationAction)
	assert.Equal(t, "NOT_APPLICABLE", event.UsageStatus)
	assert.Equal(t, "NOT_REQUIRED", event.Reconciliation.Status)
	assert.Nil(t, event.Reconciliation.Reason)
}
