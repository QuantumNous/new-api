package catalog

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"smart-router/api"
	"smart-router/routing"
	"smart-router/signing"
	"smart-router/store"
)

func TestRuntimeProducesSignedRoutesSnapshotsAndPersistsDecisions(t *testing.T) {
	ctx := context.Background()
	database := testDatabase(t, ctx)
	now := time.Unix(1700000000, 0).UTC()
	key := []byte(strings.Repeat("k", 32))
	runtime := NewRuntime(RuntimeConfig{
		Store: database, SigningKey: key, Now: func() time.Time { return now },
		SnapshotTTL: 5 * time.Minute, HysteresisMicrounits: 2,
		ConfigSHA256:         strings.Repeat("a", 64),
		PluginManifestSHA256: strings.Repeat("b", 64),
	})

	request := api.RouteRequest{
		Kind: "route_request", SchemaVersion: 1, RequestID: "req-1",
		Group: "default", Model: "model-a", Protocol: api.ProtocolChat,
		AttemptLimit: 2,
	}
	response, err := runtime.Route(ctx, request)
	if err != nil {
		t.Fatalf("Route() error = %v", err)
	}
	if response.RequestID != request.RequestID || len(response.Bindings) != 1 {
		t.Fatalf("Route() = %#v", response)
	}
	if err := response.Validate(); err != nil {
		t.Fatalf("Route() returned invalid contract: %v", err)
	}
	if err := signing.Verify(response, key, response.Signature); err != nil {
		t.Fatalf("route signature verification: %v", err)
	}
	incumbent, err := database.LastDecisionBinding(
		ctx, request.Group, request.Model, request.Protocol,
	)
	if err != nil || incumbent != "bnd_AAAAAAAAAAAAAAAAAAAAAAAA" {
		t.Fatalf("LastDecisionBinding() = %q, %v", incumbent, err)
	}

	snapshot, err := runtime.Snapshot(ctx)
	if err != nil {
		t.Fatalf("Snapshot() error = %v", err)
	}
	if snapshot.Revision != response.SnapshotRevision || len(snapshot.Routes) != 1 {
		t.Fatalf("Snapshot() = %#v, route revision = %q", snapshot, response.SnapshotRevision)
	}
	if err := snapshot.Validate(); err != nil {
		t.Fatalf("Snapshot() returned invalid contract: %v", err)
	}
	if err := signing.Verify(snapshot, key, snapshot.Signature); err != nil {
		t.Fatalf("snapshot signature verification: %v", err)
	}

	request.SnapshotRevision = "stale-revision"
	_, err = runtime.Route(ctx, request)
	var contractError api.ContractError
	if !errors.As(err, &contractError) || contractError.Code != api.ErrorContractMismatch {
		t.Fatalf("stale Route() error = %v, want contract_mismatch", err)
	}
}

func TestRuntimeOutcomeAppliesCooldownAndMapsConflicts(t *testing.T) {
	ctx := context.Background()
	database := testDatabase(t, ctx)
	now := time.Unix(1700000000, 0).UTC()
	runtime := NewRuntime(RuntimeConfig{
		Store: database, SigningKey: []byte(strings.Repeat("k", 32)),
		Now: func() time.Time { return now }, SnapshotTTL: time.Minute,
		ConfigSHA256:         strings.Repeat("a", 64),
		PluginManifestSHA256: strings.Repeat("b", 64),
	})
	outcome := api.AttemptOutcome{
		Kind: "attempt_outcome", SchemaVersion: 1, EventID: "evt-1",
		RequestID: "req-1", BindingID: "bnd_AAAAAAAAAAAAAAAAAAAAAAAA",
		Protocol: api.ProtocolChat,
		Outcome:  api.OutcomeAuth401,
	}
	if err := runtime.RecordOutcome(ctx, outcome); err != nil {
		t.Fatalf("RecordOutcome() error = %v", err)
	}

	request := api.RouteRequest{
		Kind: "route_request", SchemaVersion: 1, RequestID: "req-2",
		Group: "default", Model: "model-a", Protocol: api.ProtocolChat,
		AttemptLimit: 1,
	}
	_, err := runtime.Route(ctx, request)
	var unavailable api.ContractError
	if !errors.As(err, &unavailable) || unavailable.Code != api.ErrorBindingUnavailable {
		t.Fatalf("Route() during cooldown error = %v, want binding_unavailable", err)
	}

	outcome.Outcome = api.OutcomeSuccess
	err = runtime.RecordOutcome(ctx, outcome)
	var conflict api.ContractError
	if !errors.As(err, &conflict) || conflict.Code != api.ErrorOutcomeConflict {
		t.Fatalf("conflicting RecordOutcome() error = %v, want outcome_conflict", err)
	}
}

func testDatabase(t *testing.T, ctx context.Context) *store.DB {
	t.Helper()
	database, err := store.OpenSQLite(ctx, ":memory:")
	if err != nil {
		t.Fatalf("OpenSQLite() error = %v", err)
	}
	t.Cleanup(func() { _ = database.Close() })
	if err := database.UpsertSource(ctx, store.Source{
		ID: "src-fixture", Connector: "ebond", Enabled: true,
	}); err != nil {
		t.Fatalf("UpsertSource() error = %v", err)
	}
	if err := database.UpsertBinding(ctx, store.BindingRecord{
		ID: "bnd_AAAAAAAAAAAAAAAAAAAAAAAA", SourceID: "src-fixture",
		Group: "default", Model: "model-a", Protocol: api.ProtocolChat,
		ProtocolPlugin: "chat-v1", Enabled: true, CostMicrounits: 10,
	}); err != nil {
		t.Fatalf("UpsertBinding() error = %v", err)
	}
	if err := database.SetObservation(ctx, "bnd_AAAAAAAAAAAAAAAAAAAAAAAA", store.Observation{
		Health: routing.HealthHealthy, Fingerprint: strings.Repeat("f", 64),
		ObservedAt: time.Unix(1, 0),
	}); err != nil {
		t.Fatalf("SetObservation() error = %v", err)
	}
	return database
}
