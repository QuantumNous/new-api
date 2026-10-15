package store

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"errors"
	"regexp"
	"time"

	"smart-router/api"
	"smart-router/modeltrace"
)

var _ modeltrace.Repository = (*DB)(nil)

var probeIDPattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$`)
var probeDigestPattern = regexp.MustCompile(`^[0-9a-f]{64}$`)

func (database *DB) BeginProbe(ctx context.Context, evidence modeltrace.Evidence, digest string, at time.Time) (modeltrace.Record, bool, error) {
	evidence.Samples = append([]modeltrace.Sample(nil), evidence.Samples...)
	for i := range evidence.Samples {
		evidence.Samples[i].Numbers = append([]int(nil), evidence.Samples[i].Numbers...)
	}
	actualDigest, err := evidence.Digest()
	if err != nil || digest != actualDigest {
		return modeltrace.Record{}, false, modeltrace.ErrInvalidEvidence
	}
	if !validProbeTime(at) {
		return modeltrace.Record{}, false, modeltrace.ErrProbeTime
	}
	var record modeltrace.Record
	var created bool
	err = database.probeTransaction(ctx, func(conn *sql.Conn) error {
		prior, err := readProbe(conn.QueryRowContext(ctx, probeSelect+` WHERE p.probe_id = ?`, evidence.ProbeID))
		if err == nil {
			if prior.record.EvidenceSHA256 != digest || prior.record.BindingID != evidence.BindingID ||
				prior.record.ClaimedModel != evidence.ClaimedModel || prior.record.Protocol != evidence.Protocol ||
				prior.bank != evidence.BankRevision || prior.accepted != acceptedProbeOutputs(evidence) {
				return modeltrace.ErrProbeConflict
			}
			record = prior.record
			return nil
		}
		if !errors.Is(err, modeltrace.ErrProbeNotFound) {
			return err
		}
		var model, protocol string
		err = conn.QueryRowContext(ctx, `SELECT model_name, protocol FROM bindings WHERE id = ?`,
			evidence.BindingID).Scan(&model, &protocol)
		if errors.Is(err, sql.ErrNoRows) {
			return modeltrace.ErrBindingMissing
		}
		if err != nil {
			return modeltrace.ErrProbeStorage
		}
		if model != evidence.ClaimedModel || protocol != string(evidence.Protocol) {
			return modeltrace.ErrBindingMismatch
		}
		_, err = conn.ExecContext(ctx, `INSERT INTO modeltrace_probes
			(probe_id, binding_id, claimed_model, protocol, evidence_sha256, bank_revision,
			accepted_outputs, state, observed_ns)
			VALUES (?, ?, ?, ?, ?, ?, ?, 'running', ?)`,
			evidence.ProbeID, evidence.BindingID, evidence.ClaimedModel, evidence.Protocol, digest,
			evidence.BankRevision, acceptedProbeOutputs(evidence), at.UnixNano())
		if err != nil {
			return modeltrace.ErrProbeStorage
		}
		record = modeltrace.Record{
			ProbeID: evidence.ProbeID, BindingID: evidence.BindingID, ClaimedModel: evidence.ClaimedModel,
			Protocol: evidence.Protocol, EvidenceSHA256: digest, State: modeltrace.StateRunning,
			ObservedAt: time.Unix(0, at.UnixNano()).UTC(),
		}
		created = true
		return nil
	})
	if err != nil {
		return modeltrace.Record{}, false, err
	}
	return record, created, nil
}

func (database *DB) CompleteProbe(ctx context.Context, id string, result modeltrace.Result, at time.Time) error {
	result.Models = append([]modeltrace.ModelScore(nil), result.Models...)
	result.Families = append([]modeltrace.FamilyScore(nil), result.Families...)
	if !probeIDPattern.MatchString(id) {
		return modeltrace.ErrInvalidEvidence
	}
	if !validProbeTime(at) {
		return modeltrace.ErrProbeTime
	}
	if err := result.Validate(); err != nil {
		return modeltrace.ErrInvalidResult
	}
	data, err := json.Marshal(result)
	if err != nil || len(data) > 256<<10 {
		return modeltrace.ErrInvalidResult
	}
	return database.probeTransaction(ctx, func(conn *sql.Conn) error {
		prior, err := readProbe(conn.QueryRowContext(ctx, probeSelect+` WHERE p.probe_id = ?`, id))
		if err != nil {
			return err
		}
		if prior.record.State != modeltrace.StateRunning {
			return modeltrace.ErrProbeTransition
		}
		if at.Before(prior.record.ObservedAt) {
			return modeltrace.ErrProbeTime
		}
		if result.BankRevision != prior.bank || result.UsedOutputs != prior.accepted ||
			result.Assessment != modeltrace.Assess(prior.record.ClaimedModel, result, 0) {
			return modeltrace.ErrInvalidResult
		}
		if _, err := conn.ExecContext(ctx,
			`INSERT INTO modeltrace_results(probe_id, result_json, completed_ns) VALUES (?, ?, ?)`,
			id, string(data), at.UnixNano()); err != nil {
			return modeltrace.ErrProbeStorage
		}
		write, err := conn.ExecContext(ctx, `UPDATE modeltrace_probes SET state = 'succeeded', terminal_ns = ?
			WHERE probe_id = ? AND state = 'running'`, at.UnixNano(), id)
		if err != nil {
			return modeltrace.ErrProbeStorage
		}
		count, err := write.RowsAffected()
		if err != nil || count != 1 {
			return modeltrace.ErrProbeStorage
		}
		return nil
	})
}

func (database *DB) FailProbe(ctx context.Context, id string, code string, at time.Time) error {
	if !probeIDPattern.MatchString(id) {
		return modeltrace.ErrInvalidEvidence
	}
	state, err := probeFailureState(code)
	if err != nil {
		return err
	}
	if !validProbeTime(at) {
		return modeltrace.ErrProbeTime
	}
	return database.probeTransaction(ctx, func(conn *sql.Conn) error {
		prior, err := readProbe(conn.QueryRowContext(ctx, probeSelect+` WHERE p.probe_id = ?`, id))
		if err != nil {
			return err
		}
		if prior.record.State != modeltrace.StateRunning {
			return modeltrace.ErrProbeTransition
		}
		if at.Before(prior.record.ObservedAt) {
			return modeltrace.ErrProbeTime
		}
		write, err := conn.ExecContext(ctx, `UPDATE modeltrace_probes
			SET state = ?, error_code = ?, terminal_ns = ? WHERE probe_id = ? AND state = 'running'`,
			state, code, at.UnixNano(), id)
		if err != nil {
			return modeltrace.ErrProbeStorage
		}
		count, err := write.RowsAffected()
		if err != nil || count != 1 {
			return modeltrace.ErrProbeStorage
		}
		return nil
	})
}

func (database *DB) GetProbe(ctx context.Context, id string) (modeltrace.Record, error) {
	if !probeIDPattern.MatchString(id) {
		return modeltrace.Record{}, modeltrace.ErrInvalidEvidence
	}
	probe, err := readProbe(database.sql.QueryRowContext(ctx, probeSelect+` WHERE p.probe_id = ?`, id))
	return probe.record, err
}

const probeSelect = `SELECT p.probe_id, p.binding_id, p.claimed_model, p.protocol,
	p.evidence_sha256, p.state, p.observed_ns, p.error_code, r.result_json,
	p.bank_revision, p.accepted_outputs, p.terminal_ns, r.completed_ns
	FROM modeltrace_probes p LEFT JOIN modeltrace_results r ON r.probe_id = p.probe_id`

type durableProbe struct {
	record   modeltrace.Record
	bank     string
	accepted int
	terminal sql.NullInt64
}

func readProbe(row *sql.Row) (durableProbe, error) {
	var probe durableProbe
	var record modeltrace.Record
	var observed int64
	var data sql.NullString
	var completed sql.NullInt64
	err := row.Scan(&record.ProbeID, &record.BindingID, &record.ClaimedModel,
		&record.Protocol, &record.EvidenceSHA256, &record.State, &observed, &record.ErrorCode, &data,
		&probe.bank, &probe.accepted, &probe.terminal, &completed)
	if errors.Is(err, sql.ErrNoRows) {
		return durableProbe{}, modeltrace.ErrProbeNotFound
	}
	if err != nil {
		return durableProbe{}, modeltrace.ErrProbeStorage
	}
	// Reuse the frozen identity rules without storing or reconstructing raw evidence.
	numbers := make([]int, 80)
	for i := range numbers {
		numbers[i] = 1
	}
	identity := modeltrace.Evidence{
		SchemaVersion: 1, ProbeID: record.ProbeID, BindingID: record.BindingID,
		ClaimedModel: record.ClaimedModel, Protocol: record.Protocol, BankRevision: probe.bank,
		Samples: []modeltrace.Sample{{ChallengeID: "identity", ExpectedCount: 80, Numbers: numbers}},
	}
	if identity.Validate() != nil || !probeDigestPattern.MatchString(record.EvidenceSHA256) ||
		probe.accepted < 1 || probe.accepted > 3 {
		return durableProbe{}, modeltrace.ErrProbeStorage
	}
	record.ObservedAt = time.Unix(0, observed).UTC()
	if probe.terminal.Valid && probe.terminal.Int64 < observed {
		return durableProbe{}, modeltrace.ErrProbeStorage
	}
	switch record.State {
	case modeltrace.StateRunning:
		if data.Valid || completed.Valid || probe.terminal.Valid || record.ErrorCode != "" {
			return durableProbe{}, modeltrace.ErrProbeStorage
		}
	case modeltrace.StateSucceeded:
		if !data.Valid || !completed.Valid || !probe.terminal.Valid ||
			completed.Int64 != probe.terminal.Int64 || record.ErrorCode != "" {
			return durableProbe{}, modeltrace.ErrProbeStorage
		}
		var result modeltrace.Result
		if json.Unmarshal([]byte(data.String), &result) != nil || result.Validate() != nil ||
			result.BankRevision != probe.bank || result.UsedOutputs != probe.accepted ||
			result.Assessment != modeltrace.Assess(record.ClaimedModel, result, 0) {
			return durableProbe{}, modeltrace.ErrProbeStorage
		}
		record.Result = &result
	case modeltrace.StateFailed, modeltrace.StateCancelled:
		state, err := probeFailureState(record.ErrorCode)
		if err != nil || state != record.State || !probe.terminal.Valid || data.Valid || completed.Valid {
			return durableProbe{}, modeltrace.ErrProbeStorage
		}
	default:
		return durableProbe{}, modeltrace.ErrProbeStorage
	}
	probe.record = record
	return probe, nil
}

func acceptedProbeOutputs(e modeltrace.Evidence) int {
	count := 0
	for _, sample := range e.Samples {
		if len(sample.Numbers) >= max(80, (sample.ExpectedCount*55+99)/100) {
			count++
		}
	}
	return count
}

func (database *DB) probeTransaction(ctx context.Context, apply func(*sql.Conn) error) (err error) {
	conn, err := database.sql.Conn(ctx)
	if err != nil {
		return modeltrace.ErrProbeStorage
	}
	defer func() { _ = conn.Close() }()
	if _, err := conn.ExecContext(ctx, `BEGIN IMMEDIATE`); err != nil {
		return modeltrace.ErrProbeStorage
	}
	committed := false
	defer func() {
		if committed {
			return
		}
		// database/sql marks a failed Tx.Commit done even if SQLite kept its transaction.
		cleanup, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if _, rollbackErr := conn.ExecContext(cleanup, `ROLLBACK`); rollbackErr != nil {
			_ = conn.Raw(func(any) error { return driver.ErrBadConn })
			err = modeltrace.ErrProbeStorage
		}
	}()
	if err := apply(conn); err != nil {
		return err
	}
	if _, err := conn.ExecContext(ctx, `COMMIT`); err != nil {
		return modeltrace.ErrProbeStorage
	}
	committed = true
	return nil
}

func (database *DB) LatestAttribution(ctx context.Context, binding string, model string, protocol api.Protocol) (modeltrace.Record, error) {
	if api.ValidateBindingID(binding) != nil {
		return modeltrace.Record{}, modeltrace.ErrInvalidEvidence
	}
	probe, err := readProbe(database.sql.QueryRowContext(ctx, probeSelect+`
		WHERE p.binding_id = ? AND p.claimed_model = ? AND p.protocol = ? AND p.state = 'succeeded'
		ORDER BY p.observed_ns DESC, p.probe_id DESC LIMIT 1`, binding, model, protocol))
	return probe.record, err
}

// RecoverInterrupted requires coordinated startup with no active probe executors.
func (database *DB) RecoverInterrupted(ctx context.Context, at time.Time) error {
	if !validProbeTime(at) {
		return modeltrace.ErrProbeTime
	}
	return database.probeTransaction(ctx, func(conn *sql.Conn) error {
		var future int
		if err := conn.QueryRowContext(ctx,
			`SELECT COUNT(*) FROM modeltrace_probes WHERE state = 'running' AND observed_ns > ?`,
			at.UnixNano()).Scan(&future); err != nil {
			return modeltrace.ErrProbeStorage
		}
		if future != 0 {
			return modeltrace.ErrProbeTime
		}
		if _, err := conn.ExecContext(ctx, `UPDATE modeltrace_probes
			SET state = 'failed', error_code = 'interrupted', terminal_ns = ? WHERE state = 'running'`,
			at.UnixNano()); err != nil {
			return modeltrace.ErrProbeStorage
		}
		return nil
	})
}

func probeFailureState(code string) (modeltrace.State, error) {
	switch code {
	case "cancelled":
		return modeltrace.StateCancelled, nil
	case "deadline_exceeded", "execution_failed", "configuration_invalid", "integrity_failed",
		"process_limit", "invalid_result", "interrupted":
		return modeltrace.StateFailed, nil
	default:
		return "", modeltrace.ErrProbeExecution
	}
}

func validProbeTime(at time.Time) bool {
	return !at.IsZero() && time.Unix(0, at.UnixNano()).Equal(at)
}
