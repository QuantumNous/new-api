package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"math"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"smart-router/api"
	"smart-router/migrations"
	"smart-router/modeltrace"
	"smart-router/routing"
)

func probeEvidence(id string) modeltrace.Evidence {
	numbers := make([]int, 80)
	for i := range numbers {
		numbers[i] = 1 + i%355
	}
	return modeltrace.Evidence{
		SchemaVersion: 1, ProbeID: id, BindingID: "bnd_abcdefghijklmnopqrstuvwx",
		ClaimedModel: "model-a", Protocol: api.ProtocolChat, BankRevision: strings.Repeat("a", 64),
		Samples: []modeltrace.Sample{{ChallengeID: "challenge-1", ExpectedCount: 80, Numbers: numbers}},
	}
}

func probeResult(e modeltrace.Evidence) modeltrace.Result {
	return modeltrace.Result{
		Prediction: e.ClaimedModel, Probability: 1, UsedOutputs: 1, ClosedSet: true,
		Assessment: "inconclusive", BankRevision: e.BankRevision, EngineRevision: strings.Repeat("b", 64),
		Models:   []modeltrace.ModelScore{{Model: e.ClaimedModel, Family: "family-a", Probability: 1}},
		Families: []modeltrace.FamilyScore{{Family: "family-a", Probability: 1}},
	}
}

func seedProbeBinding(t *testing.T, database *DB, e modeltrace.Evidence) {
	t.Helper()
	ctx := context.Background()
	require.NoError(t, database.UpsertSource(ctx, Source{ID: "probe-source", Connector: "fixture", Enabled: true}))
	require.NoError(t, database.UpsertBinding(ctx, BindingRecord{
		ID: e.BindingID, SourceID: "probe-source", Group: "default", Model: e.ClaimedModel,
		Protocol: e.Protocol, ProtocolPlugin: "chat-v1", Enabled: true, CostMicrounits: 17,
	}))
}

func TestProbeSurvivesSQLiteReopen(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "probes.db")
	database, err := OpenSQLite(ctx, path)
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, database.Close()) })
	evidence := probeEvidence("reopen-probe")
	seedProbeBinding(t, database, evidence)
	digest, err := evidence.Digest()
	require.NoError(t, err)
	at := time.Unix(1700000000, 123456789).UTC()
	running, created, err := database.BeginProbe(ctx, evidence, digest, at)
	require.NoError(t, err)
	require.True(t, created)
	assert.Equal(t, modeltrace.StateRunning, running.State)
	result := probeResult(evidence)
	require.NoError(t, database.CompleteProbe(ctx, evidence.ProbeID, result, at.Add(time.Second)))
	before, err := database.GetProbe(ctx, evidence.ProbeID)
	require.NoError(t, err)
	require.NoError(t, database.Close())
	database, err = OpenSQLite(ctx, path)
	require.NoError(t, err)
	after, err := database.GetProbe(ctx, evidence.ProbeID)
	require.NoError(t, err)
	assert.Equal(t, before, after)
	assert.Equal(t, modeltrace.Record{
		ProbeID: evidence.ProbeID, BindingID: evidence.BindingID, ClaimedModel: evidence.ClaimedModel,
		Protocol: evidence.Protocol, EvidenceSHA256: digest, State: modeltrace.StateSucceeded,
		ObservedAt: at, Result: &result,
	}, after)
}

func openProbeDB(t *testing.T) *DB {
	t.Helper()
	database, err := OpenSQLite(context.Background(), filepath.Join(t.TempDir(), "probes.db"))
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, database.Close()) })
	return database
}

func beginProbe(t *testing.T, database *DB, e modeltrace.Evidence, at time.Time) modeltrace.Record {
	t.Helper()
	digest, err := e.Digest()
	require.NoError(t, err)
	record, created, err := database.BeginProbe(context.Background(), e, digest, at)
	require.NoError(t, err)
	require.True(t, created)
	return record
}

func TestProbeAdmissionValidation(t *testing.T) {
	for _, test := range []struct {
		name string
		edit func(*modeltrace.Evidence, *string)
		want error
	}{
		{"digest", func(_ *modeltrace.Evidence, d *string) { *d = strings.Repeat("c", 64) }, modeltrace.ErrInvalidEvidence},
		{"invalid", func(e *modeltrace.Evidence, _ *string) { e.Samples[0].Numbers[0] = 0 }, modeltrace.ErrInvalidEvidence},
		{"missing", func(e *modeltrace.Evidence, _ *string) { e.BindingID = "bnd_zyxwvutsrqponmlkjihgfedc" }, modeltrace.ErrBindingMissing},
		{"model", func(e *modeltrace.Evidence, _ *string) { e.ClaimedModel = "Model-A" }, modeltrace.ErrBindingMismatch},
		{"protocol", func(e *modeltrace.Evidence, _ *string) { e.Protocol = api.ProtocolMessages }, modeltrace.ErrBindingMismatch},
	} {
		t.Run(test.name, func(t *testing.T) {
			database := openProbeDB(t)
			e := probeEvidence("invalid-" + test.name)
			seedProbeBinding(t, database, e)
			digest, err := e.Digest()
			require.NoError(t, err)
			test.edit(&e, &digest)
			if test.name != "digest" && test.name != "invalid" {
				digest, err = e.Digest()
				require.NoError(t, err)
			}
			_, created, err := database.BeginProbe(context.Background(), e, digest, time.Now())
			assert.ErrorIs(t, err, test.want)
			assert.False(t, created)
			_, err = database.GetProbe(context.Background(), e.ProbeID)
			assert.ErrorIs(t, err, modeltrace.ErrProbeNotFound)
		})
	}
}

func TestProbeHistoricalReplayAndConflict(t *testing.T) {
	ctx := context.Background()
	database := openProbeDB(t)
	e := probeEvidence("historical")
	seedProbeBinding(t, database, e)
	at := time.Unix(1700000000, 1).UTC()
	running := beginProbe(t, database, e, at)
	digest, err := e.Digest()
	require.NoError(t, err)
	replay, created, err := database.BeginProbe(ctx, e, digest, at.Add(time.Second))
	require.NoError(t, err)
	assert.False(t, created)
	assert.Equal(t, running, replay)
	require.NoError(t, database.CompleteProbe(ctx, e.ProbeID, probeResult(e), at.Add(time.Second)))
	succeeded, err := database.GetProbe(ctx, e.ProbeID)
	require.NoError(t, err)
	changedBinding := e
	changedBinding.ClaimedModel = "replacement-model"
	changedBinding.Protocol = api.ProtocolMessages
	seedProbeBinding(t, database, changedBinding)
	replay, created, err = database.BeginProbe(ctx, e, digest, at.Add(2*time.Second))
	require.NoError(t, err)
	assert.False(t, created)
	assert.Equal(t, succeeded, replay)
	e.Samples[0].Numbers[0] = 2
	changedDigest, err := e.Digest()
	require.NoError(t, err)
	_, created, err = database.BeginProbe(ctx, e, changedDigest, at.Add(3*time.Second))
	assert.ErrorIs(t, err, modeltrace.ErrProbeConflict)
	assert.False(t, created)
	unchanged, err := database.GetProbe(ctx, e.ProbeID)
	require.NoError(t, err)
	assert.Equal(t, succeeded, unchanged)
}

func TestProbeOwnershipAcrossSQLiteHandles(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	path := filepath.Join(t.TempDir(), "shared.db")
	first, err := OpenSQLite(ctx, path)
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, first.Close()) })
	e := probeEvidence("shared-owner")
	seedProbeBinding(t, first, e)
	second, err := OpenSQLite(ctx, path)
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, second.Close()) })
	digest, err := e.Digest()
	require.NoError(t, err)
	type admission struct {
		record  modeltrace.Record
		created bool
		err     error
	}
	start := make(chan struct{})
	done := make(chan admission, 2)
	at := time.Unix(1700000000, 2).UTC()
	for _, database := range []*DB{first, second} {
		go func(database *DB) {
			<-start
			r, c, err := database.BeginProbe(ctx, e, digest, at)
			done <- admission{r, c, err}
		}(database)
	}
	close(start)
	owners := 0
	for range 2 {
		got := <-done
		if got.created {
			owners++
			assert.NoError(t, got.err)
			assert.Equal(t, modeltrace.StateRunning, got.record.State)
		} else if got.err != nil {
			assert.ErrorIs(t, got.err, modeltrace.ErrProbeStorage)
		}
	}
	assert.Equal(t, 1, owners)
	for _, database := range []*DB{first, second} {
		record, created, err := database.BeginProbe(ctx, e, digest, at)
		require.NoError(t, err)
		assert.False(t, created)
		assert.Equal(t, e.ProbeID, record.ProbeID)
	}
}

func oversizedProbeResult(e modeltrace.Evidence) modeltrace.Result {
	result := probeResult(e)
	result.Models = nil
	result.Probability = 1.0 / 256
	for i := range 256 {
		result.Models = append(result.Models, modeltrace.ModelScore{
			Model:  fmt.Sprintf("%03d", i) + strings.Repeat("\U0001f600", 253),
			Family: "family-a", Probability: 1.0 / 256,
		})
	}
	result.Prediction = result.Models[0].Model
	return result
}

func TestProbeCompletionValidation(t *testing.T) {
	for _, test := range []struct {
		name string
		edit func(*modeltrace.Result)
	}{
		{"typed", func(r *modeltrace.Result) { r.Probability = math.NaN() }},
		{"revision", func(r *modeltrace.Result) { r.BankRevision = strings.Repeat("c", 64) }},
		{"count", func(r *modeltrace.Result) { r.UsedOutputs = 2 }},
		{"assessment", func(r *modeltrace.Result) {
			r.UsedOutputs, r.Complete, r.Assessment = 3, true, "mismatched"
		}},
		{"size", func(r *modeltrace.Result) { *r = oversizedProbeResult(probeEvidence("unused")) }},
	} {
		t.Run(test.name, func(t *testing.T) {
			database := openProbeDB(t)
			e := probeEvidence("complete-" + test.name)
			if test.name == "assessment" {
				e.Samples = append(e.Samples,
					modeltrace.Sample{ChallengeID: "challenge-2", ExpectedCount: 80, Numbers: e.Samples[0].Numbers},
					modeltrace.Sample{ChallengeID: "challenge-3", ExpectedCount: 80, Numbers: e.Samples[0].Numbers})
			}
			seedProbeBinding(t, database, e)
			at := time.Unix(1700000000, 3).UTC()
			before := beginProbe(t, database, e, at)
			result := probeResult(e)
			test.edit(&result)
			if test.name == "size" {
				require.NoError(t, result.Validate())
				data, err := json.Marshal(result)
				require.NoError(t, err)
				require.Greater(t, len(data), 256<<10)
			}
			assert.ErrorIs(t, database.CompleteProbe(context.Background(), e.ProbeID, result, at), modeltrace.ErrInvalidResult)
			after, err := database.GetProbe(context.Background(), e.ProbeID)
			require.NoError(t, err)
			assert.Equal(t, before, after)
		})
	}
}

func TestProbeCompletionAtomicFailures(t *testing.T) {
	for _, test := range []struct {
		name string
		sql  string
	}{
		{"insert", `CREATE TRIGGER reject_result BEFORE INSERT ON modeltrace_results
			BEGIN SELECT RAISE(ABORT, 'fixture insert failure'); END;`},
		{"update", `CREATE TRIGGER reject_success BEFORE UPDATE ON modeltrace_probes
			WHEN NEW.state = 'succeeded' BEGIN SELECT RAISE(ABORT, 'fixture update failure'); END;`},
		{"commit", `CREATE TABLE deferred_fixture (
			probe_id TEXT REFERENCES modeltrace_probes(probe_id) DEFERRABLE INITIALLY DEFERRED);
			CREATE TRIGGER reject_commit AFTER INSERT ON modeltrace_results
			BEGIN INSERT INTO deferred_fixture VALUES ('missing-parent'); END;`},
	} {
		t.Run(test.name, func(t *testing.T) {
			ctx := context.Background()
			path := filepath.Join(t.TempDir(), "atomic.db")
			database, err := OpenSQLite(ctx, path)
			require.NoError(t, err)
			t.Cleanup(func() { require.NoError(t, database.Close()) })
			e := probeEvidence("atomic-" + test.name)
			seedProbeBinding(t, database, e)
			at := time.Unix(1700000000, 4).UTC()
			before := beginProbe(t, database, e, at)
			other, err := OpenSQLite(ctx, path)
			require.NoError(t, err)
			t.Cleanup(func() { require.NoError(t, other.Close()) })
			_, err = database.sql.ExecContext(ctx, test.sql)
			require.NoError(t, err)
			assert.ErrorIs(t, database.CompleteProbe(ctx, e.ProbeID, probeResult(e), at), modeltrace.ErrProbeStorage)
			for _, handle := range []*DB{database, other} {
				after, err := handle.GetProbe(ctx, e.ProbeID)
				require.NoError(t, err)
				assert.Equal(t, before, after)
				var count int
				require.NoError(t, handle.sql.QueryRowContext(ctx, `SELECT COUNT(*) FROM modeltrace_results`).Scan(&count))
				assert.Zero(t, count)
			}
			if test.name == "commit" {
				var count int
				require.NoError(t, database.sql.QueryRowContext(ctx, `SELECT COUNT(*) FROM deferred_fixture`).Scan(&count))
				assert.Zero(t, count)
			}
		})
	}
}

func TestProbeRejectsCorruptJoinedReads(t *testing.T) {
	for _, test := range []struct {
		name string
		sql  string
		arg  any
	}{
		{"syntax", `UPDATE modeltrace_results SET result_json = ?`, "{"},
		{"oversized", `UPDATE modeltrace_results SET result_json = ?`, strings.Repeat(" ", (256<<10)+1)},
		{"missing-result", `DELETE FROM modeltrace_results`, nil},
		{"running-result", `UPDATE modeltrace_probes SET state = 'running'`, nil},
		{"failed-result", `UPDATE modeltrace_probes SET state = 'failed', error_code = 'execution_failed'`, nil},
		{"revision", `UPDATE modeltrace_results SET result_json = replace(result_json, ?, '` + strings.Repeat("c", 64) + `')`, strings.Repeat("a", 64)},
		{"probability", `UPDATE modeltrace_results SET result_json = replace(result_json, '"probability":1', '"probability":0.5')`, nil},
		{"digest", `UPDATE modeltrace_probes SET evidence_sha256 = 'bad'`, nil},
		{"protocol", `UPDATE modeltrace_probes SET protocol = 'openai'`, nil},
	} {
		t.Run(test.name, func(t *testing.T) {
			ctx := context.Background()
			database := openProbeDB(t)
			e := probeEvidence("corrupt-" + test.name)
			seedProbeBinding(t, database, e)
			at := time.Unix(1700000000, 5).UTC()
			beginProbe(t, database, e, at)
			require.NoError(t, database.CompleteProbe(ctx, e.ProbeID, probeResult(e), at))
			_, err := database.sql.ExecContext(ctx, `PRAGMA ignore_check_constraints = ON`)
			require.NoError(t, err)
			if test.arg == nil {
				_, err = database.sql.ExecContext(ctx, test.sql)
			} else {
				_, err = database.sql.ExecContext(ctx, test.sql, test.arg)
			}
			require.NoError(t, err)
			_, err = database.GetProbe(ctx, e.ProbeID)
			assert.ErrorIs(t, err, modeltrace.ErrProbeStorage)
		})
	}
}

func TestProbeCompletionTerminalAndResultOwnership(t *testing.T) {
	ctx := context.Background()
	database := openProbeDB(t)
	e := probeEvidence("immutable-success")
	seedProbeBinding(t, database, e)
	at := time.Unix(1700000000, 6).UTC()
	beginProbe(t, database, e, at)
	result := probeResult(e)
	require.NoError(t, database.CompleteProbe(ctx, e.ProbeID, result, at))
	before, err := database.GetProbe(ctx, e.ProbeID)
	require.NoError(t, err)
	assert.ErrorIs(t, database.CompleteProbe(ctx, e.ProbeID, result, at), modeltrace.ErrProbeTransition)
	assert.ErrorIs(t, database.CompleteProbe(ctx, "absent", result, at), modeltrace.ErrProbeNotFound)
	mutable, err := database.GetProbe(ctx, e.ProbeID)
	require.NoError(t, err)
	mutable.Result.Models[0].Model = "mutated"
	mutable.Result.Families[0].Family = "mutated"
	result.Models[0].Model = "caller-mutated"
	after, err := database.GetProbe(ctx, e.ProbeID)
	require.NoError(t, err)
	assert.Equal(t, before, after)
}

func TestProbeFailureLifecycle(t *testing.T) {
	for _, code := range []string{"cancelled", "deadline_exceeded", "execution_failed",
		"configuration_invalid", "integrity_failed", "process_limit", "invalid_result", "interrupted"} {
		t.Run(code, func(t *testing.T) {
			ctx := context.Background()
			database := openProbeDB(t)
			e := probeEvidence("failure-" + code)
			seedProbeBinding(t, database, e)
			at := time.Unix(1700000000, 7).UTC()
			beginProbe(t, database, e, at)
			require.NoError(t, database.FailProbe(ctx, e.ProbeID, code, at.Add(time.Second)))
			record, err := database.GetProbe(ctx, e.ProbeID)
			require.NoError(t, err)
			want := modeltrace.StateFailed
			if code == "cancelled" {
				want = modeltrace.StateCancelled
			}
			assert.Equal(t, want, record.State)
			assert.Equal(t, code, record.ErrorCode)
			assert.Equal(t, at, record.ObservedAt)
			assert.Nil(t, record.Result)
			digest, err := e.Digest()
			require.NoError(t, err)
			replay, created, err := database.BeginProbe(ctx, e, digest, at.Add(2*time.Second))
			require.NoError(t, err)
			assert.False(t, created)
			assert.Equal(t, record, replay)
			assert.ErrorIs(t, database.CompleteProbe(ctx, e.ProbeID, probeResult(e), at), modeltrace.ErrProbeTransition)
			assert.ErrorIs(t, database.FailProbe(ctx, e.ProbeID, code, at), modeltrace.ErrProbeTransition)
			assert.ErrorIs(t, database.FailProbe(ctx, e.ProbeID, "interrupted", at), modeltrace.ErrProbeTransition)
			after, err := database.GetProbe(ctx, e.ProbeID)
			require.NoError(t, err)
			assert.Equal(t, record, after)
		})
	}
	t.Run("unsafe-code", func(t *testing.T) {
		ctx := context.Background()
		database := openProbeDB(t)
		e := probeEvidence("unsafe-code")
		seedProbeBinding(t, database, e)
		at := time.Unix(1700000000, 8).UTC()
		before := beginProbe(t, database, e, at)
		for _, code := range []string{"", "provider fixture response", "CANCELLED"} {
			assert.Error(t, database.FailProbe(ctx, e.ProbeID, code, at))
		}
		after, err := database.GetProbe(ctx, e.ProbeID)
		require.NoError(t, err)
		assert.Equal(t, before, after)
		assert.ErrorIs(t, database.FailProbe(ctx, "absent", "execution_failed", at), modeltrace.ErrProbeNotFound)
		require.NoError(t, database.CompleteProbe(ctx, e.ProbeID, probeResult(e), at))
		assert.ErrorIs(t, database.FailProbe(ctx, e.ProbeID, "execution_failed", at), modeltrace.ErrProbeTransition)
	})
}

func TestProbeExplicitRecovery(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "recovery.db")
	database, err := OpenSQLite(ctx, path)
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, database.Close()) })
	at := time.Unix(1700000000, 9).UTC()
	records := map[string]modeltrace.Record{}
	for _, state := range []string{"running", "succeeded", "failed", "cancelled"} {
		e := probeEvidence("recovery-" + state)
		seedProbeBinding(t, database, e)
		beginProbe(t, database, e, at)
		switch state {
		case "succeeded":
			require.NoError(t, database.CompleteProbe(ctx, e.ProbeID, probeResult(e), at))
		case "failed":
			require.NoError(t, database.FailProbe(ctx, e.ProbeID, "execution_failed", at))
		case "cancelled":
			require.NoError(t, database.FailProbe(ctx, e.ProbeID, "cancelled", at))
		}
		records[state], err = database.GetProbe(ctx, e.ProbeID)
		require.NoError(t, err)
	}
	require.NoError(t, database.Close())
	database, err = OpenSQLite(ctx, path)
	require.NoError(t, err)
	running, err := database.GetProbe(ctx, "recovery-running")
	require.NoError(t, err)
	assert.Equal(t, records["running"], running, "opening must not recover")
	require.NoError(t, database.RecoverInterrupted(ctx, at.Add(time.Second)))
	var terminalNS int64
	require.NoError(t, database.sql.QueryRowContext(ctx,
		`SELECT terminal_ns FROM modeltrace_probes WHERE probe_id = 'recovery-running'`).Scan(&terminalNS))
	for state, before := range records {
		after, err := database.GetProbe(ctx, before.ProbeID)
		require.NoError(t, err)
		if state == "running" {
			before.State, before.ErrorCode = modeltrace.StateFailed, "interrupted"
		}
		assert.Equal(t, before, after)
	}
	require.NoError(t, database.RecoverInterrupted(ctx, at.Add(2*time.Second)))
	var again int64
	require.NoError(t, database.sql.QueryRowContext(ctx,
		`SELECT terminal_ns FROM modeltrace_probes WHERE probe_id = 'recovery-running'`).Scan(&again))
	assert.Equal(t, at.Add(time.Second).UnixNano(), terminalNS)
	assert.Equal(t, terminalNS, again)
}

func TestProbeTimeContract(t *testing.T) {
	for _, at := range []time.Time{{}, time.Date(1600, 1, 1, 0, 0, 0, 0, time.UTC),
		time.Date(2300, 1, 1, 0, 0, 0, 0, time.UTC)} {
		database := openProbeDB(t)
		e := probeEvidence("invalid-time")
		seedProbeBinding(t, database, e)
		digest, err := e.Digest()
		require.NoError(t, err)
		_, created, err := database.BeginProbe(context.Background(), e, digest, at)
		assert.ErrorIs(t, err, modeltrace.ErrProbeTime)
		assert.False(t, created)
	}
	ctx := context.Background()
	database := openProbeDB(t)
	e := probeEvidence("time-contract")
	seedProbeBinding(t, database, e)
	at := time.Unix(1700000000, 123).In(time.FixedZone("fixture", 3600))
	before := beginProbe(t, database, e, at)
	assert.Equal(t, at.UTC(), before.ObservedAt)
	for _, bad := range []time.Time{{}, at.Add(-time.Nanosecond), time.Date(2300, 1, 1, 0, 0, 0, 0, time.UTC)} {
		assert.ErrorIs(t, database.CompleteProbe(ctx, e.ProbeID, probeResult(e), bad), modeltrace.ErrProbeTime)
		assert.ErrorIs(t, database.FailProbe(ctx, e.ProbeID, "cancelled", bad), modeltrace.ErrProbeTime)
		assert.ErrorIs(t, database.RecoverInterrupted(ctx, bad), modeltrace.ErrProbeTime)
	}
	after, err := database.GetProbe(ctx, e.ProbeID)
	require.NoError(t, err)
	assert.Equal(t, before, after)
	for _, ns := range []int64{math.MinInt64, 0, math.MaxInt64} {
		e.ProbeID = fmt.Sprintf("edge-%d", ns)
		record := beginProbe(t, database, e, time.Unix(0, ns))
		assert.Equal(t, ns, record.ObservedAt.UnixNano())
		require.NoError(t, database.CompleteProbe(ctx, e.ProbeID, probeResult(e), time.Unix(0, ns)))
	}
}

func TestProbeLatestExactAttribution(t *testing.T) {
	ctx := context.Background()
	database := openProbeDB(t)
	e := probeEvidence("latest-Z")
	seedProbeBinding(t, database, e)
	at := time.Unix(1700000000, 10).UTC()
	beginProbe(t, database, e, at)
	require.NoError(t, database.CompleteProbe(ctx, e.ProbeID, probeResult(e), at.Add(time.Second)))
	e.ProbeID = "latest-a"
	beginProbe(t, database, e, at)
	require.NoError(t, database.CompleteProbe(ctx, e.ProbeID, probeResult(e), at))
	latest, err := database.LatestAttribution(ctx, e.BindingID, e.ClaimedModel, e.Protocol)
	require.NoError(t, err)
	assert.Equal(t, "latest-a", latest.ProbeID)
	assert.Equal(t, "inconclusive", latest.Result.Assessment)
	e.ProbeID = "latest-new"
	beginProbe(t, database, e, at.Add(time.Nanosecond))
	require.NoError(t, database.CompleteProbe(ctx, e.ProbeID, probeResult(e), at.Add(time.Nanosecond)))
	e.ProbeID = "latest-failed"
	beginProbe(t, database, e, at.Add(2*time.Nanosecond))
	require.NoError(t, database.FailProbe(ctx, e.ProbeID, "execution_failed", at.Add(2*time.Nanosecond)))
	e.ProbeID = "latest-running"
	beginProbe(t, database, e, at.Add(3*time.Nanosecond))
	latest, err = database.LatestAttribution(ctx, e.BindingID, e.ClaimedModel, e.Protocol)
	require.NoError(t, err)
	assert.Equal(t, "latest-new", latest.ProbeID)
	for _, other := range []modeltrace.Evidence{
		{BindingID: "bnd_zyxwvutsrqponmlkjihgfedc", ClaimedModel: e.ClaimedModel, Protocol: e.Protocol},
		{BindingID: e.BindingID, ClaimedModel: "Model-A", Protocol: e.Protocol},
		{BindingID: e.BindingID, ClaimedModel: e.ClaimedModel, Protocol: api.ProtocolMessages},
	} {
		_, err := database.LatestAttribution(ctx, other.BindingID, other.ClaimedModel, other.Protocol)
		assert.ErrorIs(t, err, modeltrace.ErrProbeNotFound)
	}
}

type probeRoutingState struct {
	Schema map[string]string
	Data   map[string][][]any
}

func snapshotProbeRoutingState(t *testing.T, database *DB) probeRoutingState {
	t.Helper()
	ctx := context.Background()
	state := probeRoutingState{Schema: map[string]string{}, Data: map[string][][]any{}}
	rows, err := database.sql.QueryContext(ctx, `SELECT name, sql FROM sqlite_master
		WHERE tbl_name NOT LIKE 'modeltrace_%' AND name NOT LIKE 'sqlite_%' ORDER BY name`)
	require.NoError(t, err)
	for rows.Next() {
		var name, schema string
		require.NoError(t, rows.Scan(&name, &schema))
		state.Schema[name] = schema
	}
	require.NoError(t, rows.Err())
	require.NoError(t, rows.Close())
	for _, table := range []string{"schema_migrations", "sources", "route_groups", "models",
		"bindings", "prices", "health_state", "cooldowns", "fingerprints", "decisions", "outcomes", "snapshots"} {
		query := `SELECT * FROM "` + table + `"`
		if table == "schema_migrations" {
			query += ` WHERE name != '003_modeltrace.sql'`
		}
		rows, err := database.sql.QueryContext(ctx, query+` ORDER BY 1`)
		require.NoError(t, err)
		columns, err := rows.Columns()
		require.NoError(t, err)
		state.Data[table] = nil
		for rows.Next() {
			values := make([]any, len(columns))
			destinations := make([]any, len(columns))
			for i := range values {
				destinations[i] = &values[i]
			}
			require.NoError(t, rows.Scan(destinations...))
			for i, value := range values {
				if data, ok := value.([]byte); ok {
					values[i] = append([]byte(nil), data...)
				}
			}
			state.Data[table] = append(state.Data[table], values)
		}
		require.NoError(t, rows.Err())
		require.NoError(t, rows.Close())
	}
	return state
}

func TestProbeSQLiteFreshAndUpgradePreserveRoutingState(t *testing.T) {
	for _, mode := range []string{"fresh", "upgrade"} {
		t.Run(mode, func(t *testing.T) {
			ctx := context.Background()
			path := filepath.Join(t.TempDir(), "migration.db")
			var database *DB
			var err error
			files, err := migrations.NamedForDialect("sqlite")
			require.NoError(t, err)
			if mode == "upgrade" {
				raw, err := sql.Open("sqlite", path)
				require.NoError(t, err)
				raw.SetMaxOpenConns(1)
				database = &DB{sql: raw}
				for _, migration := range files {
					if migration.Name == "003_modeltrace.sql" {
						continue
					}
					_, err = raw.ExecContext(ctx, migration.SQL)
					require.NoError(t, err)
					_, err = raw.ExecContext(ctx, `INSERT INTO schema_migrations(name) VALUES (?)`, migration.Name)
					require.NoError(t, err)
				}
			} else {
				database, err = OpenSQLite(ctx, path)
				require.NoError(t, err)
			}
			t.Cleanup(func() { require.NoError(t, database.Close()) })
			e := probeEvidence("migration-" + mode)
			seedProbeBinding(t, database, e)
			at := time.Unix(1700000000, 30).UTC()
			require.NoError(t, database.SetObservation(ctx, e.BindingID, Observation{
				Health: routing.HealthDegraded, ConsecutiveFailures: 3, ObservedAt: at,
				CooldownUntil: at.Add(time.Hour), Fingerprint: strings.Repeat("f", 64),
			}))
			require.NoError(t, database.RecordDecision(ctx, Decision{
				RequestID: "fixture-decision", Group: "default", Model: e.ClaimedModel,
				Protocol: e.Protocol, SnapshotRevision: "fixture-revision",
				BindingIDs: []string{e.BindingID}, CreatedAt: at,
			}))
			_, err = database.RecordOutcome(ctx, api.AttemptOutcome{
				EventID: "fixture-outcome", BindingID: e.BindingID, Protocol: e.Protocol, Outcome: api.OutcomeSuccess,
			}, at)
			require.NoError(t, err)
			_, err = database.sql.ExecContext(ctx, `INSERT INTO snapshots VALUES ('fixture-revision', '{"fixture":true}', 1700000000000)`)
			require.NoError(t, err)
			before := snapshotProbeRoutingState(t, database)
			require.NoError(t, database.Close())
			database, err = OpenSQLite(ctx, path)
			require.NoError(t, err)
			assert.Equal(t, before, snapshotProbeRoutingState(t, database))
			require.NoError(t, database.migrate(ctx), "second tracked load must skip every applied migration")
			var names []string
			rows, err := database.sql.QueryContext(ctx, `SELECT name FROM schema_migrations ORDER BY name`)
			require.NoError(t, err)
			for rows.Next() {
				var name string
				require.NoError(t, rows.Scan(&name))
				names = append(names, name)
			}
			require.NoError(t, rows.Err())
			require.NoError(t, rows.Close())
			assert.Equal(t, []string{"001_init.sql", "002_decision_nanoseconds.sql", "003_modeltrace.sql"}, names)
			var count int
			require.NoError(t, database.sql.QueryRowContext(ctx,
				`SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`).Scan(&count))
			assert.Equal(t, 14, count)
			var version string
			require.NoError(t, database.sql.QueryRowContext(ctx, `SELECT sqlite_version()`).Scan(&version))
			t.Logf("actual SQLite version=%s mode=%s tables=%d tracker=%v", version, mode, count, names)
			beginProbe(t, database, e, at)
			require.NoError(t, database.CompleteProbe(ctx, e.ProbeID, probeResult(e), at))
			_, err = database.LatestAttribution(ctx, e.BindingID, e.ClaimedModel, e.Protocol)
			require.NoError(t, err)
			e.ProbeID = "migration-interrupted"
			beginProbe(t, database, e, at)
			require.NoError(t, database.RecoverInterrupted(ctx, at))
			assert.Equal(t, before, snapshotProbeRoutingState(t, database))
			require.NoError(t, database.Close())
			database, err = OpenSQLite(ctx, path)
			require.NoError(t, err)
			assert.Equal(t, before, snapshotProbeRoutingState(t, database))
		})
	}
}

func TestProbeSchemaRejectsInvalidPersistence(t *testing.T) {
	for _, test := range []struct {
		name   string
		column string
		value  any
	}{
		{"empty-id", "probe_id", ""}, {"long-id", "probe_id", strings.Repeat("x", 129)},
		{"unsafe-id", "probe_id", "bad/id"}, {"binding", "binding_id", "bnd_missing"},
		{"empty-model", "claimed_model", ""}, {"long-model", "claimed_model", strings.Repeat("m", 257)},
		{"protocol", "protocol", "openai"}, {"digest", "evidence_sha256", "bad"},
		{"revision", "bank_revision", strings.Repeat("A", 64)}, {"count", "accepted_outputs", 4},
		{"fractional-count", "accepted_outputs", 1.5}, {"state", "state", "pending"},
		{"time-type", "observed_ns", "not-time"}, {"unsafe-error", "error_code", "provider text"},
		{"running-terminal", "terminal_ns", int64(1700000000000000000)},
	} {
		t.Run(test.name, func(t *testing.T) {
			database := openProbeDB(t)
			e := probeEvidence("constraint")
			seedProbeBinding(t, database, e)
			before := beginProbe(t, database, e, time.Unix(1700000000, 31))
			_, err := database.sql.ExecContext(context.Background(),
				`UPDATE modeltrace_probes SET "`+test.column+`" = ? WHERE probe_id = ?`, test.value, e.ProbeID)
			assert.Error(t, err)
			after, err := database.GetProbe(context.Background(), e.ProbeID)
			require.NoError(t, err)
			assert.Equal(t, before, after)
		})
	}
	for _, column := range []string{"probe_id", "binding_id", "claimed_model", "protocol",
		"evidence_sha256", "bank_revision", "accepted_outputs", "state", "observed_ns", "error_code"} {
		t.Run("null-"+column, func(t *testing.T) {
			database := openProbeDB(t)
			e := probeEvidence("nonnull")
			seedProbeBinding(t, database, e)
			beginProbe(t, database, e, time.Unix(1700000000, 32))
			_, err := database.sql.ExecContext(context.Background(), `UPDATE modeltrace_probes SET "`+column+`" = NULL`)
			assert.Error(t, err)
		})
	}
	for _, test := range []struct {
		name string
		id   any
		data any
		at   any
	}{
		{"oversized-result", "result-bound", strings.Repeat(" ", (256<<10)+1), int64(1700000000000000033)},
		{"empty-result", "result-bound", "", int64(1700000000000000033)},
		{"null-result", "result-bound", nil, int64(1700000000000000033)},
		{"null-result-id", nil, "{}", int64(1700000000000000033)},
		{"null-result-time", "result-bound", "{}", nil},
		{"result-time-type", "result-bound", "{}", "not-time"},
		{"missing-result-parent", "missing-parent", "{}", int64(1700000000000000033)},
	} {
		t.Run(test.name, func(t *testing.T) {
			database := openProbeDB(t)
			e := probeEvidence("result-bound")
			seedProbeBinding(t, database, e)
			beginProbe(t, database, e, time.Unix(1700000000, 33))
			_, err := database.sql.ExecContext(context.Background(),
				`INSERT INTO modeltrace_results VALUES (?, ?, ?)`, test.id, test.data, test.at)
			assert.Error(t, err)
		})
	}
}

func TestProbeUTF8ModelAndCaseSensitiveIdentity(t *testing.T) {
	ctx := context.Background()
	database := openProbeDB(t)
	e := probeEvidence("case-A")
	e.ClaimedModel = strings.Repeat("\U0001f600", 256)
	require.NoError(t, e.Validate())
	seedProbeBinding(t, database, e)
	at := time.Unix(1700000000, 34)
	beginProbe(t, database, e, at)
	require.NoError(t, database.CompleteProbe(ctx, e.ProbeID, probeResult(e), at))
	e.ProbeID = "case-a"
	beginProbe(t, database, e, at)
	require.NoError(t, database.CompleteProbe(ctx, e.ProbeID, probeResult(e), at))
	latest, err := database.LatestAttribution(ctx, e.BindingID, e.ClaimedModel, e.Protocol)
	require.NoError(t, err)
	assert.Equal(t, "case-a", latest.ProbeID)
	assert.Equal(t, e.ClaimedModel, latest.ClaimedModel)
	first, err := database.GetProbe(ctx, "case-A")
	require.NoError(t, err)
	assert.Equal(t, "case-A", first.ProbeID)
}

func TestProbeDialectMigrationDiscovery(t *testing.T) {
	for _, dialect := range []string{"sqlite", "mysql", "postgres"} {
		t.Run(dialect, func(t *testing.T) {
			files, err := migrations.NamedForDialect(dialect)
			require.NoError(t, err)
			var names []string
			for _, file := range files {
				names = append(names, file.Name)
			}
			assert.Equal(t, []string{"001_init.sql", "002_decision_nanoseconds.sql", "003_modeltrace.sql"}, names)
		})
	}
}
