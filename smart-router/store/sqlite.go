package store

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	_ "modernc.org/sqlite"

	"smart-router/api"
	"smart-router/migrations"
	"smart-router/routing"
)

type DB struct {
	sql *sql.DB
}

func OpenSQLite(ctx context.Context, path string) (*DB, error) {
	database, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}
	database.SetMaxOpenConns(1)
	if err := database.PingContext(ctx); err != nil {
		_ = database.Close()
		return nil, fmt.Errorf("ping sqlite: %w", err)
	}
	store := &DB{sql: database}
	if err := store.migrate(ctx); err != nil {
		_ = database.Close()
		return nil, err
	}
	return store, nil
}

func (database *DB) Close() error {
	return database.sql.Close()
}

func (database *DB) migrate(ctx context.Context) error {
	if _, err := database.sql.ExecContext(ctx, `PRAGMA foreign_keys = ON`); err != nil {
		return fmt.Errorf("enable sqlite foreign keys: %w", err)
	}
	if _, err := database.sql.ExecContext(
		ctx,
		`CREATE TABLE IF NOT EXISTS schema_migrations (
			name TEXT PRIMARY KEY
		)`,
	); err != nil {
		return fmt.Errorf("create migration tracker: %w", err)
	}
	migrationFiles, err := migrations.NamedForDialect("sqlite")
	if err != nil {
		return err
	}
	for _, migration := range migrationFiles {
		var applied int
		if err := database.sql.QueryRowContext(
			ctx,
			`SELECT COUNT(*) FROM schema_migrations WHERE name = ?`,
			migration.Name,
		).Scan(&applied); err != nil {
			return fmt.Errorf("check sqlite migration %s: %w", migration.Name, err)
		}
		if applied == 1 {
			continue
		}
		transaction, err := database.sql.BeginTx(ctx, nil)
		if err != nil {
			return fmt.Errorf("begin sqlite migration %s: %w", migration.Name, err)
		}
		if _, err := transaction.ExecContext(ctx, migration.SQL); err != nil {
			_ = transaction.Rollback()
			return fmt.Errorf("apply sqlite migration %s: %w", migration.Name, err)
		}
		if _, err := transaction.ExecContext(
			ctx,
			`INSERT INTO schema_migrations(name) VALUES (?)`,
			migration.Name,
		); err != nil {
			_ = transaction.Rollback()
			return fmt.Errorf("record sqlite migration %s: %w", migration.Name, err)
		}
		if err := transaction.Commit(); err != nil {
			return fmt.Errorf("commit sqlite migration %s: %w", migration.Name, err)
		}
	}
	return nil
}

func (database *DB) HasTable(ctx context.Context, name string) bool {
	var count int
	err := database.sql.QueryRowContext(
		ctx,
		`SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?`,
		name,
	).Scan(&count)
	return err == nil && count == 1
}

func (database *DB) UpsertSource(ctx context.Context, source Source) error {
	_, err := database.sql.ExecContext(
		ctx,
		`INSERT INTO sources(id, connector, enabled) VALUES (?, ?, ?)
		 ON CONFLICT(id) DO UPDATE SET connector = excluded.connector, enabled = excluded.enabled`,
		source.ID, source.Connector, source.Enabled,
	)
	return err
}

func (database *DB) UpsertBinding(ctx context.Context, binding BindingRecord) error {
	if err := api.ValidateBindingID(binding.ID); err != nil {
		return err
	}
	transaction, err := database.sql.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = transaction.Rollback() }()
	if _, err := transaction.ExecContext(
		ctx,
		`INSERT INTO route_groups(name, enabled) VALUES (?, 1)
		 ON CONFLICT(name) DO NOTHING`,
		binding.Group,
	); err != nil {
		return err
	}
	if _, err := transaction.ExecContext(
		ctx,
		`INSERT INTO models(name, enabled) VALUES (?, 1)
		 ON CONFLICT(name) DO NOTHING`,
		binding.Model,
	); err != nil {
		return err
	}
	if _, err := transaction.ExecContext(
		ctx,
		`INSERT INTO bindings(
			id, source_id, group_name, model_name, protocol, protocol_plugin, enabled
		) VALUES (?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			source_id = excluded.source_id,
			group_name = excluded.group_name,
			model_name = excluded.model_name,
			protocol = excluded.protocol,
			protocol_plugin = excluded.protocol_plugin,
			enabled = excluded.enabled`,
		binding.ID, binding.SourceID, binding.Group, binding.Model,
		binding.Protocol, binding.ProtocolPlugin, binding.Enabled,
	); err != nil {
		return err
	}
	if _, err := transaction.ExecContext(
		ctx,
		`INSERT INTO prices(binding_id, cost_microunits) VALUES (?, ?)
		 ON CONFLICT(binding_id) DO UPDATE SET cost_microunits = excluded.cost_microunits`,
		binding.ID, binding.CostMicrounits,
	); err != nil {
		return err
	}
	return transaction.Commit()
}

func (database *DB) SetObservation(ctx context.Context, bindingID string, observation Observation) error {
	if err := api.ValidateBindingID(bindingID); err != nil {
		return err
	}
	transaction, err := database.sql.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = transaction.Rollback() }()
	observedAt := observation.ObservedAt.UTC().UnixMilli()
	if _, err := transaction.ExecContext(
		ctx,
		`INSERT INTO health_state(binding_id, status, consecutive_failures, observed_at_ms)
		 VALUES (?, ?, ?, ?)
		 ON CONFLICT(binding_id) DO UPDATE SET
			observed_at_ms = excluded.observed_at_ms`,
		bindingID, observation.Health, observation.ConsecutiveFailures, observedAt,
	); err != nil {
		return err
	}
	cooldownMS := int64(0)
	if !observation.CooldownUntil.IsZero() {
		cooldownMS = observation.CooldownUntil.UTC().UnixMilli()
	}
	if _, err := transaction.ExecContext(
		ctx,
		`INSERT INTO cooldowns(binding_id, until_ms) VALUES (?, ?)
		 ON CONFLICT(binding_id) DO NOTHING`,
		bindingID, cooldownMS,
	); err != nil {
		return err
	}
	if _, err := transaction.ExecContext(
		ctx,
		`INSERT INTO fingerprints(binding_id, value, observed_at_ms) VALUES (?, ?, ?)
		 ON CONFLICT(binding_id) DO UPDATE SET
			value = excluded.value, observed_at_ms = excluded.observed_at_ms`,
		bindingID, observation.Fingerprint, observedAt,
	); err != nil {
		return err
	}
	return transaction.Commit()
}

func (database *DB) ListRouteKeys(ctx context.Context) ([]RouteKey, error) {
	rows, err := database.sql.QueryContext(
		ctx,
		`SELECT DISTINCT b.group_name, b.model_name, b.protocol
		 FROM bindings b
		 JOIN sources s ON s.id = b.source_id
		 JOIN route_groups g ON g.name = b.group_name
		 JOIN models m ON m.name = b.model_name
		 JOIN prices p ON p.binding_id = b.id
		 WHERE b.enabled = 1 AND s.enabled = 1 AND g.enabled = 1 AND m.enabled = 1
		 ORDER BY b.group_name, b.model_name, b.protocol`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var keys []RouteKey
	for rows.Next() {
		var key RouteKey
		var protocol string
		if err := rows.Scan(&key.Group, &key.Model, &protocol); err != nil {
			return nil, err
		}
		key.Protocol = api.Protocol(protocol)
		keys = append(keys, key)
	}
	return keys, rows.Err()
}

func (database *DB) ListCandidates(
	ctx context.Context,
	group string,
	model string,
	protocol api.Protocol,
) ([]routing.Candidate, error) {
	rows, err := database.sql.QueryContext(
		ctx,
		`SELECT
			b.id, b.group_name, b.model_name, b.protocol, b.protocol_plugin,
			(b.enabled AND s.enabled AND g.enabled AND m.enabled),
			p.cost_microunits, COALESCE(h.status, 'healthy'), COALESCE(c.until_ms, 0)
		 FROM bindings b
		 JOIN sources s ON s.id = b.source_id
		 JOIN route_groups g ON g.name = b.group_name
		 JOIN models m ON m.name = b.model_name
		 JOIN prices p ON p.binding_id = b.id
		 LEFT JOIN health_state h ON h.binding_id = b.id
		 LEFT JOIN cooldowns c ON c.binding_id = b.id
		 WHERE b.group_name = ? AND b.model_name = ? AND b.protocol = ?`,
		group, model, protocol,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var candidates []routing.Candidate
	for rows.Next() {
		var candidate routing.Candidate
		var protocolValue string
		var healthValue string
		var cooldownMS int64
		if err := rows.Scan(
			&candidate.BindingID, &candidate.Group, &candidate.Model,
			&protocolValue, &candidate.ProtocolPlugin, &candidate.Enabled,
			&candidate.CostMicrounits, &healthValue, &cooldownMS,
		); err != nil {
			return nil, err
		}
		if err := api.ValidateBindingID(candidate.BindingID); err != nil {
			return nil, err
		}
		candidate.Protocol = api.Protocol(protocolValue)
		candidate.Health = routing.Health(healthValue)
		if cooldownMS > 0 {
			candidate.CooldownUntil = time.UnixMilli(cooldownMS).UTC()
		}
		candidates = append(candidates, candidate)
	}
	return candidates, rows.Err()
}

func (database *DB) Fingerprint(ctx context.Context, bindingID string) (string, error) {
	if err := api.ValidateBindingID(bindingID); err != nil {
		return "", err
	}
	var fingerprint string
	err := database.sql.QueryRowContext(
		ctx, `SELECT value FROM fingerprints WHERE binding_id = ?`, bindingID,
	).Scan(&fingerprint)
	return fingerprint, err
}

func (database *DB) RecordDecision(ctx context.Context, decision Decision) error {
	if err := validateBindingIDs(decision.BindingIDs); err != nil {
		return err
	}
	bindingIDs, err := json.Marshal(decision.BindingIDs)
	if err != nil {
		return err
	}
	_, err = database.sql.ExecContext(
		ctx,
		`INSERT INTO decisions(
			request_id, group_name, model_name, protocol, snapshot_revision,
			binding_ids_json, created_at_ms, decided_at_ns
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		decision.RequestID, decision.Group, decision.Model, decision.Protocol,
		decision.SnapshotRevision, bindingIDs, decision.CreatedAt.UTC().UnixMilli(),
		decision.CreatedAt.UTC().UnixNano(),
	)
	return err
}

func (database *DB) LastDecisionBinding(
	ctx context.Context,
	group string,
	model string,
	protocol api.Protocol,
) (string, error) {
	var raw []byte
	err := database.sql.QueryRowContext(
		ctx,
		`SELECT binding_ids_json FROM decisions
		 WHERE group_name = ? AND model_name = ? AND protocol = ?
		 ORDER BY decided_at_ns DESC, request_id DESC LIMIT 1`,
		group, model, protocol,
	).Scan(&raw)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	var bindingIDs []string
	if err := json.Unmarshal(raw, &bindingIDs); err != nil {
		return "", err
	}
	if len(bindingIDs) == 0 {
		return "", nil
	}
	if err := api.ValidateBindingID(bindingIDs[0]); err != nil {
		return "", err
	}
	return bindingIDs[0], nil
}

func (database *DB) RecordOutcome(
	ctx context.Context,
	outcome api.AttemptOutcome,
	createdAt time.Time,
) (bool, error) {
	if err := api.ValidateBindingID(outcome.BindingID); err != nil {
		return false, err
	}
	payload, err := json.Marshal(outcome)
	if err != nil {
		return false, err
	}
	sum := sha256.Sum256(payload)
	hash := hex.EncodeToString(sum[:])
	result, err := database.sql.ExecContext(
		ctx,
		`INSERT INTO outcomes(event_id, payload_sha256, payload_json, created_at_ms)
		 VALUES (?, ?, ?, ?) ON CONFLICT(event_id) DO NOTHING`,
		outcome.EventID, hash, payload, createdAt.UTC().UnixMilli(),
	)
	if err != nil {
		return false, err
	}
	inserted, err := result.RowsAffected()
	if err != nil {
		return false, err
	}
	if inserted == 1 {
		return true, nil
	}
	var existingHash string
	if err := database.sql.QueryRowContext(
		ctx, `SELECT payload_sha256 FROM outcomes WHERE event_id = ?`, outcome.EventID,
	).Scan(&existingHash); err != nil {
		return false, err
	}
	if existingHash != hash {
		return false, ErrOutcomeConflict
	}
	return false, nil
}

func (database *DB) RecordOutcomeAndApply(
	ctx context.Context,
	outcome api.AttemptOutcome,
	createdAt time.Time,
) (bool, error) {
	if err := api.ValidateBindingID(outcome.BindingID); err != nil {
		return false, err
	}
	transaction, err := database.sql.BeginTx(ctx, nil)
	if err != nil {
		return false, err
	}
	defer func() { _ = transaction.Rollback() }()

	var consecutiveFailures int
	var currentHealth string
	err = transaction.QueryRowContext(
		ctx,
		`SELECT COALESCE(h.consecutive_failures, 0), COALESCE(h.status, 'healthy')
		 FROM bindings b
		 LEFT JOIN health_state h ON h.binding_id = b.id
		 WHERE b.id = ? AND b.protocol = ?`,
		outcome.BindingID, outcome.Protocol,
	).Scan(&consecutiveFailures, &currentHealth)
	if errors.Is(err, sql.ErrNoRows) {
		return false, ErrBindingNotFound
	}
	if err != nil {
		return false, err
	}

	payload, err := json.Marshal(outcome)
	if err != nil {
		return false, err
	}
	sum := sha256.Sum256(payload)
	hash := hex.EncodeToString(sum[:])
	result, err := transaction.ExecContext(
		ctx,
		`INSERT INTO outcomes(event_id, payload_sha256, payload_json, created_at_ms)
		 VALUES (?, ?, ?, ?) ON CONFLICT(event_id) DO NOTHING`,
		outcome.EventID, hash, payload, createdAt.UTC().UnixMilli(),
	)
	if err != nil {
		return false, err
	}
	inserted, err := result.RowsAffected()
	if err != nil {
		return false, err
	}
	if inserted == 0 {
		var existingHash string
		if err := transaction.QueryRowContext(
			ctx, `SELECT payload_sha256 FROM outcomes WHERE event_id = ?`, outcome.EventID,
		).Scan(&existingHash); err != nil {
			return false, err
		}
		if existingHash != hash {
			return false, ErrOutcomeConflict
		}
		return false, nil
	}

	health := routing.Health(currentHealth)
	cooldownUntil := time.Time{}
	updateHealth := false
	switch outcome.Outcome {
	case api.OutcomeSuccess:
		health = routing.HealthHealthy
		consecutiveFailures = 0
		updateHealth = true
	case api.OutcomeAuth401:
		health = routing.HealthUnhealthy
		consecutiveFailures++
		cooldownUntil = routing.CooldownUntil(
			outcome.Outcome, createdAt, outcome.RetryAfterMS, consecutiveFailures,
		)
		updateHealth = true
	case api.OutcomeRateLimited429, api.OutcomeUpstream5xx:
		health = routing.HealthDegraded
		consecutiveFailures++
		cooldownUntil = routing.CooldownUntil(
			outcome.Outcome, createdAt, outcome.RetryAfterMS, consecutiveFailures,
		)
		updateHealth = true
	}
	if updateHealth {
		if _, err := transaction.ExecContext(
			ctx,
			`INSERT INTO health_state(binding_id, status, consecutive_failures, observed_at_ms)
			 VALUES (?, ?, ?, ?)
			 ON CONFLICT(binding_id) DO UPDATE SET
				status = excluded.status,
				consecutive_failures = excluded.consecutive_failures,
				observed_at_ms = excluded.observed_at_ms`,
			outcome.BindingID, health, consecutiveFailures, createdAt.UTC().UnixMilli(),
		); err != nil {
			return false, err
		}
		cooldownMS := int64(0)
		if !cooldownUntil.IsZero() {
			cooldownMS = cooldownUntil.UTC().UnixMilli()
		}
		if _, err := transaction.ExecContext(
			ctx,
			`INSERT INTO cooldowns(binding_id, until_ms) VALUES (?, ?)
			 ON CONFLICT(binding_id) DO UPDATE SET until_ms =
			 CASE
				WHEN ? THEN excluded.until_ms
				WHEN excluded.until_ms > cooldowns.until_ms THEN excluded.until_ms
				ELSE cooldowns.until_ms
			 END`,
			outcome.BindingID, cooldownMS, outcome.Outcome == api.OutcomeSuccess,
		); err != nil {
			return false, err
		}
	}
	if err := transaction.Commit(); err != nil {
		return false, err
	}
	return true, nil
}

func (database *DB) SaveSnapshot(ctx context.Context, snapshot api.SignedSnapshot) error {
	if err := validateSnapshotBindingIDs(snapshot); err != nil {
		return err
	}
	payload, err := json.Marshal(snapshot)
	if err != nil {
		return err
	}
	_, err = database.sql.ExecContext(
		ctx,
		`INSERT INTO snapshots(revision, payload_json, created_at_ms) VALUES (?, ?, ?)
		 ON CONFLICT(revision) DO UPDATE SET payload_json = excluded.payload_json`,
		snapshot.Revision, payload, time.Now().UTC().UnixMilli(),
	)
	return err
}

func (database *DB) LatestSnapshot(ctx context.Context) (api.SignedSnapshot, error) {
	var payload []byte
	err := database.sql.QueryRowContext(
		ctx, `SELECT payload_json FROM snapshots ORDER BY created_at_ms DESC LIMIT 1`,
	).Scan(&payload)
	if err != nil {
		return api.SignedSnapshot{}, err
	}
	var snapshot api.SignedSnapshot
	if err := json.Unmarshal(payload, &snapshot); err != nil {
		return api.SignedSnapshot{}, err
	}
	if err := validateSnapshotBindingIDs(snapshot); err != nil {
		return api.SignedSnapshot{}, err
	}
	return snapshot, nil
}

func validateBindingIDs(bindingIDs []string) error {
	for _, bindingID := range bindingIDs {
		if err := api.ValidateBindingID(bindingID); err != nil {
			return err
		}
	}
	return nil
}

func validateSnapshotBindingIDs(snapshot api.SignedSnapshot) error {
	for _, route := range snapshot.Routes {
		for _, binding := range route.Bindings {
			if err := api.ValidateBindingID(binding.BindingID); err != nil {
				return err
			}
		}
	}
	return nil
}
