package store

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"testing"
	"time"

	"smart-router/api"
	"smart-router/routing"
)

func TestSQLiteOwnsRoutingState(t *testing.T) {
	ctx := context.Background()
	database, err := OpenSQLite(ctx, t.TempDir()+"/router.db")
	if err != nil {
		t.Fatalf("OpenSQLite() error = %v", err)
	}
	t.Cleanup(func() { _ = database.Close() })

	wantTables := []string{
		"sources", "route_groups", "models", "bindings", "prices",
		"health_state", "cooldowns", "fingerprints", "decisions",
		"outcomes", "snapshots",
	}
	for _, table := range wantTables {
		if !database.HasTable(ctx, table) {
			t.Errorf("migration table %q is missing", table)
		}
	}

	if err := database.UpsertSource(ctx, Source{
		ID: "src-1", Connector: "ebond", Enabled: true,
	}); err != nil {
		t.Fatalf("UpsertSource() error = %v", err)
	}
	bindingID, err := NewBindingID()
	if err != nil {
		t.Fatalf("NewBindingID() error = %v", err)
	}
	if !strings.HasPrefix(bindingID, "bnd_") || strings.Contains(bindingID, "src-1") {
		t.Fatalf("binding ID %q is not opaque", bindingID)
	}

	now := time.Unix(1700000000, 0).UTC()
	record := BindingRecord{
		ID: bindingID, SourceID: "src-1", Group: "default", Model: "model-a",
		Protocol: api.ProtocolChat, ProtocolPlugin: "chat-v1",
		Enabled: true, CostMicrounits: 17,
	}
	if err := database.UpsertBinding(ctx, record); err != nil {
		t.Fatalf("UpsertBinding() error = %v", err)
	}
	observation := Observation{
		Health: routing.HealthDegraded, ConsecutiveFailures: 2,
		CooldownUntil: now.Add(time.Minute), Fingerprint: strings.Repeat("a", 64),
		ObservedAt: now,
	}
	if err := database.SetObservation(ctx, bindingID, observation); err != nil {
		t.Fatalf("SetObservation() error = %v", err)
	}

	candidates, err := database.ListCandidates(ctx, "default", "model-a", api.ProtocolChat)
	if err != nil {
		t.Fatalf("ListCandidates() error = %v", err)
	}
	if len(candidates) != 1 {
		t.Fatalf("ListCandidates() count = %d, want 1", len(candidates))
	}
	got := candidates[0]
	if got.BindingID != bindingID || got.CostMicrounits != 17 ||
		got.Health != routing.HealthDegraded || !got.CooldownUntil.Equal(observation.CooldownUntil) {
		t.Fatalf("candidate = %#v, want persisted price/health/cooldown", got)
	}
	fingerprint, err := database.Fingerprint(ctx, bindingID)
	if err != nil || fingerprint != observation.Fingerprint {
		t.Fatalf("Fingerprint() = %q, %v", fingerprint, err)
	}

	decision := Decision{
		RequestID: "req-1", Group: "default", Model: "model-a",
		Protocol: api.ProtocolChat, SnapshotRevision: "rev-1",
		BindingIDs: []string{bindingID}, CreatedAt: now,
	}
	if err := database.RecordDecision(ctx, decision); err != nil {
		t.Fatalf("RecordDecision() error = %v", err)
	}
	incumbent, err := database.LastDecisionBinding(ctx, "default", "model-a", api.ProtocolChat)
	if err != nil || incumbent != bindingID {
		t.Fatalf("LastDecisionBinding() = %q, %v", incumbent, err)
	}
}

func TestOutcomeIsIdempotentAndConflictsOnChangedPayload(t *testing.T) {
	ctx := context.Background()
	database, err := OpenSQLite(ctx, ":memory:")
	if err != nil {
		t.Fatalf("OpenSQLite() error = %v", err)
	}
	t.Cleanup(func() { _ = database.Close() })

	outcome := api.AttemptOutcome{
		Kind: "attempt_outcome", SchemaVersion: 1, EventID: "evt-1",
		RequestID: "req-1", BindingID: "bnd_AAAAAAAAAAAAAAAAAAAAAAAA",
		Protocol: api.ProtocolChat,
		Outcome:  api.OutcomeSuccess,
	}
	inserted, err := database.RecordOutcome(ctx, outcome, time.Unix(1, 0))
	if err != nil || !inserted {
		t.Fatalf("first RecordOutcome() = %v, %v, want inserted", inserted, err)
	}
	inserted, err = database.RecordOutcome(ctx, outcome, time.Unix(2, 0))
	if err != nil || inserted {
		t.Fatalf("duplicate RecordOutcome() = %v, %v, want idempotent", inserted, err)
	}
	outcome.Outcome = api.OutcomeUpstream5xx
	if _, err := database.RecordOutcome(ctx, outcome, time.Unix(3, 0)); !errors.Is(err, ErrOutcomeConflict) {
		t.Fatalf("conflicting RecordOutcome() error = %v, want ErrOutcomeConflict", err)
	}
}

func TestSnapshotRoundTrip(t *testing.T) {
	ctx := context.Background()
	database, err := OpenSQLite(ctx, ":memory:")
	if err != nil {
		t.Fatalf("OpenSQLite() error = %v", err)
	}
	t.Cleanup(func() { _ = database.Close() })

	snapshot := api.SignedSnapshot{
		Kind: "signed_snapshot", SchemaVersion: 1, Revision: "rev-1",
		IssuedAt: 1, ExpiresAt: 2, ConfigSHA256: strings.Repeat("a", 64),
		PluginManifestSHA256: strings.Repeat("b", 64), Routes: []api.SnapshotRoute{},
		Signature: strings.Repeat("c", 43),
	}
	if err := database.SaveSnapshot(ctx, snapshot); err != nil {
		t.Fatalf("SaveSnapshot() error = %v", err)
	}
	got, err := database.LatestSnapshot(ctx)
	if err != nil {
		t.Fatalf("LatestSnapshot() error = %v", err)
	}
	if got.Revision != snapshot.Revision || got.Signature != snapshot.Signature {
		t.Fatalf("LatestSnapshot() = %#v, want %#v", got, snapshot)
	}
}

func TestRouteKeysAndOutcomeCooldownArePersistedAtomically(t *testing.T) {
	ctx := context.Background()
	database, err := OpenSQLite(ctx, ":memory:")
	if err != nil {
		t.Fatalf("OpenSQLite() error = %v", err)
	}
	t.Cleanup(func() { _ = database.Close() })

	if err := database.UpsertSource(ctx, Source{
		ID: "src-1", Connector: "ebond", Enabled: true,
	}); err != nil {
		t.Fatalf("UpsertSource() error = %v", err)
	}
	binding := BindingRecord{
		ID:       "bnd_AAAAAAAAAAAAAAAAAAAAAAAA",
		SourceID: "src-1", Group: "default", Model: "model-a",
		Protocol: api.ProtocolChat, ProtocolPlugin: "chat-v1",
		Enabled: true, CostMicrounits: 10,
	}
	if err := database.UpsertBinding(ctx, binding); err != nil {
		t.Fatalf("UpsertBinding() error = %v", err)
	}
	now := time.Unix(1700000000, 0).UTC()
	fingerprint := strings.Repeat("f", 64)
	if err := database.SetObservation(ctx, binding.ID, Observation{
		Health: routing.HealthHealthy, Fingerprint: fingerprint, ObservedAt: now,
	}); err != nil {
		t.Fatalf("SetObservation() error = %v", err)
	}

	keys, err := database.ListRouteKeys(ctx)
	if err != nil {
		t.Fatalf("ListRouteKeys() error = %v", err)
	}
	if len(keys) != 1 || keys[0] != (RouteKey{
		Group: "default", Model: "model-a", Protocol: api.ProtocolChat,
	}) {
		t.Fatalf("ListRouteKeys() = %#v", keys)
	}

	outcome := api.AttemptOutcome{
		Kind: "attempt_outcome", SchemaVersion: 1, EventID: "evt-429",
		RequestID: "req-1", BindingID: binding.ID, Protocol: api.ProtocolChat,
		Outcome: api.OutcomeRateLimited429, RetryAfterMS: 7000,
	}
	inserted, err := database.RecordOutcomeAndApply(ctx, outcome, now)
	if err != nil || !inserted {
		t.Fatalf("RecordOutcomeAndApply() = %v, %v, want inserted", inserted, err)
	}
	candidates, err := database.ListCandidates(
		ctx, binding.Group, binding.Model, binding.Protocol,
	)
	if err != nil {
		t.Fatalf("ListCandidates() error = %v", err)
	}
	if candidates[0].Health != routing.HealthDegraded ||
		!candidates[0].CooldownUntil.Equal(now.Add(7*time.Second)) {
		t.Fatalf("candidate after 429 = %#v", candidates[0])
	}
	gotFingerprint, err := database.Fingerprint(ctx, binding.ID)
	if err != nil || gotFingerprint != fingerprint {
		t.Fatalf("Fingerprint() after outcome = %q, %v", gotFingerprint, err)
	}

	inserted, err = database.RecordOutcomeAndApply(ctx, outcome, now.Add(time.Hour))
	if err != nil || inserted {
		t.Fatalf("duplicate RecordOutcomeAndApply() = %v, %v", inserted, err)
	}
	candidates, _ = database.ListCandidates(ctx, binding.Group, binding.Model, binding.Protocol)
	if !candidates[0].CooldownUntil.Equal(now.Add(7 * time.Second)) {
		t.Fatal("idempotent outcome changed cooldown")
	}

	outcome.Outcome = api.OutcomeSuccess
	if _, err := database.RecordOutcomeAndApply(ctx, outcome, now); !errors.Is(err, ErrOutcomeConflict) {
		t.Fatalf("conflicting RecordOutcomeAndApply() error = %v", err)
	}
}

func TestZeroCooldownProbePreservesActiveCooldownUntilAcceptedSuccess(t *testing.T) {
	ctx := context.Background()
	database, err := OpenSQLite(ctx, ":memory:")
	if err != nil {
		t.Fatalf("OpenSQLite() error = %v", err)
	}
	t.Cleanup(func() { _ = database.Close() })

	const bindingID = "bnd_AAAAAAAAAAAAAAAAAAAAAAAA"
	if err := database.UpsertSource(ctx, Source{
		ID: "src-1", Connector: "ebond", Enabled: true,
	}); err != nil {
		t.Fatalf("UpsertSource() error = %v", err)
	}
	if err := database.UpsertBinding(ctx, BindingRecord{
		ID: bindingID, SourceID: "src-1", Group: "default", Model: "model-a",
		Protocol: api.ProtocolChat, ProtocolPlugin: "chat-v1",
		Enabled: true, CostMicrounits: 10,
	}); err != nil {
		t.Fatalf("UpsertBinding() error = %v", err)
	}
	now := time.Unix(1700000000, 0).UTC()
	if err := database.SetObservation(ctx, bindingID, Observation{
		Health: routing.HealthHealthy, Fingerprint: strings.Repeat("a", 64),
		ObservedAt: now,
	}); err != nil {
		t.Fatalf("initial SetObservation() error = %v", err)
	}

	failure := api.AttemptOutcome{
		Kind: "attempt_outcome", SchemaVersion: 1, EventID: "evt-failure",
		RequestID: "req-1", BindingID: bindingID, Protocol: api.ProtocolChat,
		Outcome: api.OutcomeRateLimited429, RetryAfterMS: 2 * 60 * 60 * 1000,
	}
	if inserted, err := database.RecordOutcomeAndApply(ctx, failure, now); err != nil || !inserted {
		t.Fatalf("failure RecordOutcomeAndApply() = %v, %v", inserted, err)
	}
	wantCooldown := now.Add(2 * time.Hour)

	if err := database.SetObservation(ctx, bindingID, Observation{
		Health: routing.HealthHealthy, CooldownUntil: time.Time{},
		Fingerprint: strings.Repeat("b", 64), ObservedAt: now.Add(time.Minute),
	}); err != nil {
		t.Fatalf("zero-cooldown SetObservation() error = %v", err)
	}
	candidates, err := database.ListCandidates(
		ctx, "default", "model-a", api.ProtocolChat,
	)
	if err != nil {
		t.Fatalf("ListCandidates() after probe error = %v", err)
	}
	if !candidates[0].CooldownUntil.Equal(wantCooldown) {
		t.Fatalf(
			"cooldown after zero probe = %v, want preserved %v",
			candidates[0].CooldownUntil,
			wantCooldown,
		)
	}

	if err := database.SetObservation(ctx, bindingID, Observation{
		Health: routing.HealthHealthy, CooldownUntil: now.Add(time.Minute),
		Fingerprint: strings.Repeat("c", 64), ObservedAt: now.Add(90 * time.Second),
	}); err != nil {
		t.Fatalf("shorter-cooldown SetObservation() error = %v", err)
	}
	shortFailure := failure
	shortFailure.EventID = "evt-short-failure"
	shortFailure.RequestID = "req-short-failure"
	shortFailure.Outcome = api.OutcomeUpstream5xx
	shortFailure.RetryAfterMS = 0
	if inserted, err := database.RecordOutcomeAndApply(
		ctx, shortFailure, now.Add(2*time.Minute),
	); err != nil || !inserted {
		t.Fatalf("short failure RecordOutcomeAndApply() = %v, %v", inserted, err)
	}
	candidates, err = database.ListCandidates(
		ctx, "default", "model-a", api.ProtocolChat,
	)
	if err != nil {
		t.Fatalf("ListCandidates() after shorter updates error = %v", err)
	}
	if !candidates[0].CooldownUntil.Equal(wantCooldown) {
		t.Fatalf(
			"cooldown after shorter non-success updates = %v, want preserved %v",
			candidates[0].CooldownUntil,
			wantCooldown,
		)
	}

	success := failure
	success.EventID = "evt-success"
	success.RequestID = "req-2"
	success.Outcome = api.OutcomeSuccess
	success.RetryAfterMS = 0
	if inserted, err := database.RecordOutcomeAndApply(
		ctx, success, now.Add(2*time.Minute),
	); err != nil || !inserted {
		t.Fatalf("success RecordOutcomeAndApply() = %v, %v", inserted, err)
	}
	candidates, err = database.ListCandidates(
		ctx, "default", "model-a", api.ProtocolChat,
	)
	if err != nil {
		t.Fatalf("ListCandidates() after success error = %v", err)
	}
	if !candidates[0].CooldownUntil.IsZero() {
		t.Fatalf("cooldown after accepted success = %v, want zero", candidates[0].CooldownUntil)
	}
}

func TestProbeObservationPreservesBreakerFailureHistory(t *testing.T) {
	ctx := context.Background()
	database, err := OpenSQLite(ctx, ":memory:")
	if err != nil {
		t.Fatalf("OpenSQLite() error = %v", err)
	}
	t.Cleanup(func() { _ = database.Close() })

	const bindingID = "bnd_AAAAAAAAAAAAAAAAAAAAAAAA"
	if err := database.UpsertSource(ctx, Source{
		ID: "src-1", Connector: "ebond", Enabled: true,
	}); err != nil {
		t.Fatalf("UpsertSource() error = %v", err)
	}
	if err := database.UpsertBinding(ctx, BindingRecord{
		ID: bindingID, SourceID: "src-1", Group: "default", Model: "model-a",
		Protocol: api.ProtocolChat, ProtocolPlugin: "chat-v1",
		Enabled: true, CostMicrounits: 10,
	}); err != nil {
		t.Fatalf("UpsertBinding() error = %v", err)
	}
	now := time.Unix(1700000000, 0).UTC()
	if err := database.SetObservation(ctx, bindingID, Observation{
		Health: routing.HealthHealthy, Fingerprint: strings.Repeat("a", 64),
		ObservedAt: now,
	}); err != nil {
		t.Fatalf("initial SetObservation() error = %v", err)
	}

	firstFailure := api.AttemptOutcome{
		Kind: "attempt_outcome", SchemaVersion: 1, EventID: "evt-5xx-1",
		RequestID: "req-1", BindingID: bindingID, Protocol: api.ProtocolChat,
		Outcome: api.OutcomeUpstream5xx,
	}
	if inserted, err := database.RecordOutcomeAndApply(
		ctx, firstFailure, now,
	); err != nil || !inserted {
		t.Fatalf("first RecordOutcomeAndApply() = %v, %v", inserted, err)
	}
	wantFirstCooldown := now.Add(30 * time.Second)

	if err := database.SetObservation(ctx, bindingID, Observation{
		Health: routing.HealthHealthy, ConsecutiveFailures: 0,
		CooldownUntil: now.Add(2 * time.Hour),
		Fingerprint:   strings.Repeat("b", 64),
		ObservedAt:    now.Add(10 * time.Second),
	}); err != nil {
		t.Fatalf("probe SetObservation() error = %v", err)
	}

	var health string
	var failures int
	if err := database.sql.QueryRowContext(
		ctx,
		`SELECT status, consecutive_failures FROM health_state WHERE binding_id = ?`,
		bindingID,
	).Scan(&health, &failures); err != nil {
		t.Fatalf("read breaker state after probe: %v", err)
	}
	if health != string(routing.HealthDegraded) || failures != 1 {
		t.Fatalf(
			"breaker state after probe = %s/%d, want %s/1",
			health,
			failures,
			routing.HealthDegraded,
		)
	}
	candidates, err := database.ListCandidates(
		ctx, "default", "model-a", api.ProtocolChat,
	)
	if err != nil {
		t.Fatalf("ListCandidates() after probe error = %v", err)
	}
	if !candidates[0].CooldownUntil.Equal(wantFirstCooldown) {
		t.Fatalf(
			"cooldown after probe = %v, want preserved %v",
			candidates[0].CooldownUntil,
			wantFirstCooldown,
		)
	}

	secondFailure := firstFailure
	secondFailure.EventID = "evt-5xx-2"
	secondFailure.RequestID = "req-2"
	secondFailureAt := now.Add(time.Minute)
	if inserted, err := database.RecordOutcomeAndApply(
		ctx, secondFailure, secondFailureAt,
	); err != nil || !inserted {
		t.Fatalf("second RecordOutcomeAndApply() = %v, %v", inserted, err)
	}
	if err := database.sql.QueryRowContext(
		ctx,
		`SELECT consecutive_failures FROM health_state WHERE binding_id = ?`,
		bindingID,
	).Scan(&failures); err != nil {
		t.Fatalf("read failures after second 5xx: %v", err)
	}
	if failures != 2 {
		t.Fatalf("consecutive failures after second 5xx = %d, want 2", failures)
	}
	candidates, err = database.ListCandidates(
		ctx, "default", "model-a", api.ProtocolChat,
	)
	if err != nil {
		t.Fatalf("ListCandidates() after second 5xx error = %v", err)
	}
	wantSecondCooldown := secondFailureAt.Add(time.Minute)
	if !candidates[0].CooldownUntil.Equal(wantSecondCooldown) {
		t.Fatalf(
			"cooldown after second 5xx = %v, want %v (60s backoff)",
			candidates[0].CooldownUntil,
			wantSecondCooldown,
		)
	}
}

func TestLegacyDecisionMigrationBackfillsNanosecondsAndIsIdempotent(t *testing.T) {
	ctx := context.Background()
	path := t.TempDir() + "/legacy.db"
	legacy, err := sql.Open("sqlite", path)
	if err != nil {
		t.Fatalf("open legacy SQLite: %v", err)
	}
	if _, err := legacy.ExecContext(ctx, `
		CREATE TABLE decisions (
			request_id TEXT PRIMARY KEY,
			group_name TEXT NOT NULL,
			model_name TEXT NOT NULL,
			protocol TEXT NOT NULL,
			snapshot_revision TEXT NOT NULL,
			binding_ids_json TEXT NOT NULL,
			created_at_ms INTEGER NOT NULL
		);
		INSERT INTO decisions(
			request_id, group_name, model_name, protocol, snapshot_revision,
			binding_ids_json, created_at_ms
		) VALUES (
			'req-legacy', 'default', 'model-a', 'chat', 'rev-1',
			'["bnd_AAAAAAAAAAAAAAAAAAAAAAAA"]', 1700000000123
		);
	`); err != nil {
		_ = legacy.Close()
		t.Fatalf("seed legacy decisions: %v", err)
	}
	if err := legacy.Close(); err != nil {
		t.Fatalf("close legacy SQLite: %v", err)
	}

	for open := 1; open <= 2; open++ {
		database, err := OpenSQLite(ctx, path)
		if err != nil {
			t.Fatalf("OpenSQLite() migration pass %d error = %v", open, err)
		}
		var decidedAtNS int64
		err = database.sql.QueryRowContext(
			ctx,
			`SELECT decided_at_ns FROM decisions WHERE request_id = 'req-legacy'`,
		).Scan(&decidedAtNS)
		if err != nil {
			_ = database.Close()
			t.Fatalf("read decided_at_ns after pass %d: %v", open, err)
		}
		const want = int64(1700000000123) * int64(time.Millisecond)
		if decidedAtNS != want {
			_ = database.Close()
			t.Fatalf("decided_at_ns = %d, want %d", decidedAtNS, want)
		}
		if err := database.Close(); err != nil {
			t.Fatalf("Close() pass %d error = %v", open, err)
		}
	}
}

func TestLastDecisionBindingOrdersByNanosecondsThenRequestID(t *testing.T) {
	ctx := context.Background()
	database, err := OpenSQLite(ctx, ":memory:")
	if err != nil {
		t.Fatalf("OpenSQLite() error = %v", err)
	}
	t.Cleanup(func() { _ = database.Close() })

	base := time.Unix(1700000000, 0).UTC()
	decisions := []Decision{
		{
			RequestID: "req-z-low-ns", Group: "default", Model: "model-a",
			Protocol: api.ProtocolChat, SnapshotRevision: "rev-1",
			BindingIDs: []string{"bnd_AAAAAAAAAAAAAAAAAAAAAAAA"},
			CreatedAt:  base.Add(100 * time.Nanosecond),
		},
		{
			RequestID: "req-a-high-ns", Group: "default", Model: "model-a",
			Protocol: api.ProtocolChat, SnapshotRevision: "rev-1",
			BindingIDs: []string{"bnd_BBBBBBBBBBBBBBBBBBBBBBBB"},
			CreatedAt:  base.Add(900 * time.Nanosecond),
		},
		{
			RequestID: "req-z-high-ns", Group: "default", Model: "model-a",
			Protocol: api.ProtocolChat, SnapshotRevision: "rev-1",
			BindingIDs: []string{"bnd_CCCCCCCCCCCCCCCCCCCCCCCC"},
			CreatedAt:  base.Add(900 * time.Nanosecond),
		},
	}
	for _, decision := range decisions {
		if err := database.RecordDecision(ctx, decision); err != nil {
			t.Fatalf("RecordDecision(%q) error = %v", decision.RequestID, err)
		}
	}

	got, err := database.LastDecisionBinding(
		ctx, "default", "model-a", api.ProtocolChat,
	)
	if err != nil {
		t.Fatalf("LastDecisionBinding() error = %v", err)
	}
	const want = "bnd_CCCCCCCCCCCCCCCCCCCCCCCC"
	if got != want {
		t.Fatalf("LastDecisionBinding() = %q, want %q", got, want)
	}
}

func TestPersistenceRejectsProviderDerivedBindingIDs(t *testing.T) {
	invalidIDs := []string{
		"ebond",
		"https://api.provider.example/v1",
	}
	for _, bindingID := range invalidIDs {
		t.Run(bindingID, func(t *testing.T) {
			ctx := context.Background()
			database, err := OpenSQLite(ctx, ":memory:")
			if err != nil {
				t.Fatalf("OpenSQLite() error = %v", err)
			}
			t.Cleanup(func() { _ = database.Close() })
			if err := database.UpsertSource(ctx, Source{
				ID: "src-1", Connector: "ebond", Enabled: true,
			}); err != nil {
				t.Fatalf("UpsertSource() error = %v", err)
			}

			boundaries := []struct {
				name  string
				table string
				write func() error
			}{
				{
					name:  "binding",
					table: "bindings",
					write: func() error {
						return database.UpsertBinding(ctx, BindingRecord{
							ID: bindingID, SourceID: "src-1", Group: "default",
							Model: "model-a", Protocol: api.ProtocolChat,
							ProtocolPlugin: "chat-v1", Enabled: true,
						})
					},
				},
				{
					name:  "decision",
					table: "decisions",
					write: func() error {
						return database.RecordDecision(ctx, Decision{
							RequestID: "req-1", Group: "default", Model: "model-a",
							Protocol: api.ProtocolChat, SnapshotRevision: "rev-1",
							BindingIDs: []string{bindingID}, CreatedAt: time.Unix(1, 0),
						})
					},
				},
				{
					name:  "outcome",
					table: "outcomes",
					write: func() error {
						_, err := database.RecordOutcome(ctx, api.AttemptOutcome{
							Kind: "attempt_outcome", SchemaVersion: 1, EventID: "evt-1",
							RequestID: "req-1", BindingID: bindingID,
							Protocol: api.ProtocolChat, Outcome: api.OutcomeSuccess,
						}, time.Unix(1, 0))
						return err
					},
				},
				{
					name:  "snapshot",
					table: "snapshots",
					write: func() error {
						return database.SaveSnapshot(ctx, api.SignedSnapshot{
							Kind: "signed_snapshot", SchemaVersion: 1, Revision: "rev-1",
							IssuedAt: 1, ExpiresAt: 2,
							ConfigSHA256:         strings.Repeat("a", 64),
							PluginManifestSHA256: strings.Repeat("b", 64),
							Routes: []api.SnapshotRoute{{
								Group: "default", Model: "model-a", Protocol: api.ProtocolChat,
								Bindings: []api.Binding{{
									BindingID: bindingID, ProtocolPlugin: "chat-v1", Rank: 1,
								}},
							}},
							Signature: strings.Repeat("c", 43),
						})
					},
				},
			}

			for _, boundary := range boundaries {
				t.Run(boundary.name, func(t *testing.T) {
					if err := boundary.write(); err == nil {
						t.Fatal("write error = nil, want noncanonical binding ID rejection")
					}
					var count int
					if err := database.sql.QueryRowContext(
						ctx, "SELECT COUNT(*) FROM "+boundary.table,
					).Scan(&count); err != nil {
						t.Fatalf("count persisted rows: %v", err)
					}
					if count != 0 {
						t.Fatalf("%s persisted %d rows with noncanonical binding ID", boundary.table, count)
					}
				})
			}
		})
	}
}
