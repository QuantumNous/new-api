package modeltrace_test

import (
	"context"
	"errors"
	"fmt"
	"math"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"smart-router/api"
	trace "smart-router/modeltrace"
	"smart-router/store"
)

type serviceEngine func(context.Context, trace.Evidence) (trace.Result, error)

func (engine serviceEngine) Analyze(ctx context.Context, e trace.Evidence) (trace.Result, error) {
	return engine(ctx, e)
}

type serviceRepository struct {
	trace.Repository
	begin    func(context.Context, trace.Evidence, string, time.Time) (trace.Record, bool, error)
	complete func(context.Context, string, trace.Result, time.Time) error
	fail     func(context.Context, string, string, time.Time) error
	get      func(context.Context, string) (trace.Record, error)
}

func (repo serviceRepository) BeginProbe(ctx context.Context, e trace.Evidence, digest string, at time.Time) (trace.Record, bool, error) {
	if repo.begin != nil {
		return repo.begin(ctx, e, digest, at)
	}
	return repo.Repository.BeginProbe(ctx, e, digest, at)
}

func (repo serviceRepository) CompleteProbe(ctx context.Context, id string, r trace.Result, at time.Time) error {
	if repo.complete != nil {
		return repo.complete(ctx, id, r, at)
	}
	return repo.Repository.CompleteProbe(ctx, id, r, at)
}

func (repo serviceRepository) FailProbe(ctx context.Context, id, code string, at time.Time) error {
	if repo.fail != nil {
		return repo.fail(ctx, id, code, at)
	}
	return repo.Repository.FailProbe(ctx, id, code, at)
}

func (repo serviceRepository) GetProbe(ctx context.Context, id string) (trace.Record, error) {
	if repo.get != nil {
		return repo.get(ctx, id)
	}
	return repo.Repository.GetProbe(ctx, id)
}

func serviceEvidence(id string) trace.Evidence {
	numbers := make([]int, 80)
	for i := range numbers {
		numbers[i] = 1 + i
	}
	return trace.Evidence{
		SchemaVersion: 1, ProbeID: id, BindingID: "bnd_abcdefghijklmnopqrstuvwx",
		ClaimedModel: "model-a", Protocol: api.ProtocolChat, BankRevision: strings.Repeat("a", 64),
		Samples: []trace.Sample{{ChallengeID: "challenge-1", ExpectedCount: 80, Numbers: numbers}},
	}
}

func serviceResult(e trace.Evidence) trace.Result {
	used := 0
	for _, sample := range e.Samples {
		if len(sample.Numbers) >= max(80, (sample.ExpectedCount*55+99)/100) {
			used++
		}
	}
	r := trace.Result{
		Prediction: e.ClaimedModel, Probability: 1, UsedOutputs: used, Complete: used == 3,
		ClosedSet: true, Assessment: "inconclusive", BankRevision: e.BankRevision,
		EngineRevision: strings.Repeat("b", 64),
		Models:         []trace.ModelScore{{Model: e.ClaimedModel, Family: "family-a", Probability: 1}},
		Families:       []trace.FamilyScore{{Family: "family-a", Probability: 1}},
	}
	r.Assessment = trace.Assess(e.ClaimedModel, r, 0)
	return r
}

func serviceDB(t *testing.T, e trace.Evidence) *store.DB {
	t.Helper()
	db, err := store.OpenSQLite(context.Background(), filepath.Join(t.TempDir(), "service.db"))
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, db.Close()) })
	seedServiceBinding(t, db, e)
	return db
}

func seedServiceBinding(t *testing.T, db *store.DB, e trace.Evidence) {
	t.Helper()
	require.NoError(t, db.UpsertSource(context.Background(), store.Source{ID: "service-source", Connector: "fixture", Enabled: true}))
	require.NoError(t, db.UpsertBinding(context.Background(), store.BindingRecord{
		ID: e.BindingID, SourceID: "service-source", Group: "default", Model: e.ClaimedModel,
		Protocol: e.Protocol, ProtocolPlugin: "chat-v1", Enabled: true,
	}))
}

func TestServiceOwnsEvidenceAndResult(t *testing.T) {
	e := serviceEvidence("owned-service")
	db := serviceDB(t, e)
	digest, err := e.Digest()
	require.NoError(t, err)
	at := time.Unix(1700000000, 20).UTC()
	engineCalls := 0
	var engineOutput trace.Result
	repo := serviceRepository{Repository: db}
	repo.begin = func(ctx context.Context, input trace.Evidence, gotDigest string, at time.Time) (trace.Record, bool, error) {
		assert.Equal(t, digest, gotDigest)
		actual, err := input.Digest()
		require.NoError(t, err)
		assert.Equal(t, digest, actual)
		record, created, err := db.BeginProbe(ctx, input, gotDigest, at)
		input.Samples[0].Numbers[0] = 0
		input.Samples[0].ExpectedCount = 4096
		return record, created, err
	}
	repo.complete = func(ctx context.Context, id string, result trace.Result, at time.Time) error {
		err := db.CompleteProbe(ctx, id, result, at)
		result.Models[0].Model = "repository-mutated"
		result.Families[0].Family = "repository-mutated"
		return err
	}
	service := trace.Service{
		Repository: repo,
		Now: func() time.Time {
			e.Samples[0].Numbers[0] = 0
			e.Samples[0].ExpectedCount = 4096
			return at
		},
		Engine: serviceEngine(func(_ context.Context, input trace.Evidence) (trace.Result, error) {
			engineCalls++
			assert.Equal(t, 1, input.Samples[0].Numbers[0])
			assert.Equal(t, 80, input.Samples[0].ExpectedCount)
			engineOutput = serviceResult(input)
			input.Samples[0].Numbers[0] = 0
			return engineOutput, nil
		}),
	}
	record, err := service.Submit(context.Background(), e)
	require.NoError(t, err)
	assert.Equal(t, 1, engineCalls)
	assert.Equal(t, trace.StateSucceeded, record.State)
	assert.Equal(t, digest, record.EvidenceSHA256)
	assert.Equal(t, at, record.ObservedAt)
	assert.Equal(t, "model-a", engineOutput.Models[0].Model)
	record.Result.Models[0].Model = "caller-mutated"
	record.Result.Families[0].Family = "caller-mutated"
	engineOutput.Models[0].Model = "engine-mutated"
	original := serviceEvidence(e.ProbeID)
	replay, err := service.Submit(context.Background(), original)
	require.NoError(t, err)
	assert.Equal(t, 1, engineCalls)
	assert.Equal(t, serviceResult(original), *replay.Result)
}

func TestServiceReplayNeverExecutes(t *testing.T) {
	for _, state := range []string{"running", "succeeded", "failed", "cancelled"} {
		t.Run(state, func(t *testing.T) {
			ctx := context.Background()
			e := serviceEvidence("replay-" + state)
			db := serviceDB(t, e)
			digest, err := e.Digest()
			require.NoError(t, err)
			at := time.Unix(1700000000, 21).UTC()
			_, created, err := db.BeginProbe(ctx, e, digest, at)
			require.NoError(t, err)
			require.True(t, created)
			switch state {
			case "succeeded":
				require.NoError(t, db.CompleteProbe(ctx, e.ProbeID, serviceResult(e), at))
			case "failed":
				require.NoError(t, db.FailProbe(ctx, e.ProbeID, "execution_failed", at))
			case "cancelled":
				require.NoError(t, db.FailProbe(ctx, e.ProbeID, "cancelled", at))
			}
			before, err := db.GetProbe(ctx, e.ProbeID)
			require.NoError(t, err)
			changed := e
			changed.ClaimedModel, changed.Protocol = "new-model", api.ProtocolMessages
			seedServiceBinding(t, db, changed)
			calls := 0
			service := trace.Service{Repository: db, Now: func() time.Time { return at.Add(time.Second) },
				Engine: serviceEngine(func(context.Context, trace.Evidence) (trace.Result, error) {
					calls++
					return trace.Result{}, errors.New("fixture engine must not execute")
				})}
			got, err := service.Submit(ctx, e)
			require.NoError(t, err)
			assert.Equal(t, before, got)
			e.Samples[0].Numbers[0]++
			_, err = service.Submit(ctx, e)
			assert.ErrorIs(t, err, trace.ErrProbeConflict)
			assert.Zero(t, calls)
		})
	}
}

func TestServiceAdmissionErrorsNeverExecute(t *testing.T) {
	for _, admissionErr := range []error{trace.ErrProbeStorage, trace.ErrBindingMissing, trace.ErrBindingMismatch} {
		t.Run(admissionErr.Error(), func(t *testing.T) {
			calls, begins := 0, 0
			service := trace.Service{
				Repository: serviceRepository{begin: func(context.Context, trace.Evidence, string, time.Time) (trace.Record, bool, error) {
					begins++
					return trace.Record{State: trace.StateRunning}, true, admissionErr
				}},
				Engine: serviceEngine(func(context.Context, trace.Evidence) (trace.Result, error) {
					calls++
					return trace.Result{}, nil
				}),
			}
			_, err := service.Submit(context.Background(), serviceEvidence("rejected"))
			assert.ErrorIs(t, err, admissionErr)
			assert.Equal(t, 1, begins)
			assert.Zero(t, calls)
		})
	}
}

func TestServiceRejectsCustomEngineResult(t *testing.T) {
	for _, name := range []string{"revision", "accepted-count", "assessment", "typed", "oversized", "mutated-evidence"} {
		t.Run(name, func(t *testing.T) {
			e := serviceEvidence("custom-" + name)
			if name == "accepted-count" {
				e.Samples = append(e.Samples, trace.Sample{ChallengeID: "short", ExpectedCount: 4096, Numbers: []int{1}})
			}
			if name == "assessment" {
				e.Samples = append(e.Samples,
					trace.Sample{ChallengeID: "second", Numbers: e.Samples[0].Numbers},
					trace.Sample{ChallengeID: "third", Numbers: e.Samples[0].Numbers})
			}
			db := serviceDB(t, e)
			calls := 0
			service := trace.Service{Repository: db, Engine: serviceEngine(func(_ context.Context, input trace.Evidence) (trace.Result, error) {
				calls++
				result := serviceResult(input)
				switch name {
				case "revision":
					result.BankRevision = strings.Repeat("c", 64)
				case "accepted-count":
					result.UsedOutputs = 2
				case "assessment":
					result.Assessment = "mismatched"
				case "typed":
					result.Probability = math.NaN()
				case "oversized":
					result.Models = nil
					result.Probability = 1.0 / 256
					for i := range 256 {
						result.Models = append(result.Models, trace.ModelScore{
							Model:  fmt.Sprintf("%03d", i) + strings.Repeat("\U0001f600", 253),
							Family: "family-a", Probability: 1.0 / 256,
						})
					}
					result.Prediction = result.Models[0].Model
					require.NoError(t, result.Validate())
				case "mutated-evidence":
					input.Samples[0].ExpectedCount = 4096
					input.Samples[0].Numbers = input.Samples[0].Numbers[:1]
					result.UsedOutputs = 2
				}
				return result, nil
			})}
			record, err := service.Submit(context.Background(), e)
			assert.ErrorIs(t, err, trace.ErrProbeExecution)
			assert.Equal(t, trace.StateFailed, record.State)
			assert.Equal(t, "invalid_result", record.ErrorCode)
			assert.Nil(t, record.Result)
			assert.Equal(t, 1, calls)
			replay, err := service.Submit(context.Background(), e)
			require.NoError(t, err)
			assert.Equal(t, record, replay)
			assert.Equal(t, 1, calls)
		})
	}
}

func TestServiceStableFailureAndCancellationCleanup(t *testing.T) {
	for _, test := range []struct {
		name string
		err  error
		code string
	}{
		{"provider", errors.New("private fixture provider text"), "execution_failed"},
		{"configuration", trace.ErrProcessConfiguration, "configuration_invalid"},
		{"integrity", trace.ErrProcessIntegrity, "integrity_failed"},
		{"limit", trace.ErrProcessLimit, "process_limit"},
		{"invalid-result", trace.ErrInvalidResult, "invalid_result"},
		{"cancelled", context.Canceled, "cancelled"},
		{"deadline", context.DeadlineExceeded, "deadline_exceeded"},
		{"cancelled-success", nil, "cancelled"},
	} {
		t.Run(test.name, func(t *testing.T) {
			e := serviceEvidence("failure-" + test.name)
			db := serviceDB(t, e)
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			calls, finalizations := 0, 0
			repo := serviceRepository{Repository: db}
			repo.fail = func(cleanup context.Context, id, code string, at time.Time) error {
				finalizations++
				assert.NoError(t, cleanup.Err())
				deadline, bounded := cleanup.Deadline()
				assert.True(t, bounded)
				assert.True(t, deadline.After(time.Now()))
				assert.LessOrEqual(t, time.Until(deadline), 5*time.Second)
				return db.FailProbe(cleanup, id, code, at)
			}
			service := trace.Service{Repository: repo, Engine: serviceEngine(func(_ context.Context, input trace.Evidence) (trace.Result, error) {
				calls++
				if strings.HasPrefix(test.name, "cancelled") {
					cancel()
				}
				return serviceResult(input), test.err
			})}
			record, err := service.Submit(ctx, e)
			assert.ErrorIs(t, err, trace.ErrProbeExecution)
			assert.NotContains(t, err.Error(), "private fixture provider text")
			assert.Equal(t, test.code, record.ErrorCode)
			state := trace.StateFailed
			if test.code == "cancelled" {
				state = trace.StateCancelled
			}
			assert.Equal(t, state, record.State)
			assert.Equal(t, 1, calls)
			assert.Equal(t, 1, finalizations)
			replay, err := service.Submit(context.Background(), e)
			require.NoError(t, err)
			assert.Equal(t, record, replay)
			assert.Equal(t, 1, calls)
		})
	}
}

func TestServicePersistenceUncertaintyNeverRetries(t *testing.T) {
	for _, stage := range []string{"failure", "completion", "read"} {
		t.Run(stage, func(t *testing.T) {
			e := serviceEvidence("uncertain-" + stage)
			db := serviceDB(t, e)
			calls, writes, reads := 0, 0, 0
			repo := serviceRepository{Repository: db}
			repo.fail = func(context.Context, string, string, time.Time) error {
				writes++
				return trace.ErrProbeStorage
			}
			repo.complete = func(ctx context.Context, id string, result trace.Result, at time.Time) error {
				writes++
				if stage == "completion" {
					return trace.ErrProbeStorage
				}
				return db.CompleteProbe(ctx, id, result, at)
			}
			repo.get = func(context.Context, string) (trace.Record, error) {
				reads++
				return trace.Record{}, trace.ErrProbeStorage
			}
			service := trace.Service{Repository: repo, Engine: serviceEngine(func(_ context.Context, input trace.Evidence) (trace.Result, error) {
				calls++
				if stage == "failure" {
					return trace.Result{}, context.Canceled
				}
				return serviceResult(input), nil
			})}
			_, err := service.Submit(context.Background(), e)
			assert.ErrorIs(t, err, trace.ErrProbeStorage)
			assert.Equal(t, 1, calls)
			assert.Equal(t, 1, writes)
			if stage == "read" {
				assert.Equal(t, 1, reads)
			} else {
				assert.Zero(t, reads)
			}
			got, err := service.Submit(context.Background(), e)
			require.NoError(t, err)
			if stage == "read" {
				assert.Equal(t, trace.StateSucceeded, got.State)
			} else {
				assert.Equal(t, trace.StateRunning, got.State)
			}
			assert.Equal(t, 1, calls)
			assert.Equal(t, 1, writes)
		})
	}
}

func TestServiceRejectsInvalidConfigurationAndEvidence(t *testing.T) {
	for _, name := range []string{"repository", "engine", "evidence", "time"} {
		t.Run(name, func(t *testing.T) {
			e := serviceEvidence("invalid-service-" + name)
			db := serviceDB(t, e)
			calls := 0
			service := trace.Service{Repository: db, Engine: serviceEngine(func(context.Context, trace.Evidence) (trace.Result, error) {
				calls++
				return trace.Result{}, nil
			})}
			want := trace.ErrProcessConfiguration
			switch name {
			case "repository":
				service.Repository = nil
			case "engine":
				service.Engine = nil
			case "evidence":
				e.Samples[0].Numbers[0] = 0
				want = trace.ErrInvalidEvidence
			case "time":
				service.Now = func() time.Time { return time.Time{} }
				want = trace.ErrProbeTime
			}
			_, err := service.Submit(context.Background(), e)
			assert.ErrorIs(t, err, want)
			assert.Zero(t, calls)
			_, err = db.GetProbe(context.Background(), e.ProbeID)
			assert.ErrorIs(t, err, trace.ErrProbeNotFound)
		})
	}
}

func TestServiceCancellationAtExecutionBoundary(t *testing.T) {
	for _, stage := range []string{"admitted", "completion-clock"} {
		t.Run(stage, func(t *testing.T) {
			e := serviceEvidence("boundary-" + stage)
			db := serviceDB(t, e)
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			repo := serviceRepository{Repository: db}
			repo.begin = func(ctx context.Context, input trace.Evidence, digest string, at time.Time) (trace.Record, bool, error) {
				record, created, err := db.BeginProbe(ctx, input, digest, at)
				if stage == "admitted" {
					cancel()
				}
				return record, created, err
			}
			clocks, calls := 0, 0
			service := trace.Service{Repository: repo,
				Now: func() time.Time {
					clocks++
					if stage == "completion-clock" && clocks == 2 {
						cancel()
					}
					return time.Unix(1700000000, int64(clocks)).UTC()
				},
				Engine: serviceEngine(func(_ context.Context, input trace.Evidence) (trace.Result, error) {
					calls++
					return serviceResult(input), nil
				})}
			record, err := service.Submit(ctx, e)
			assert.ErrorIs(t, err, trace.ErrProbeExecution)
			assert.Equal(t, trace.StateCancelled, record.State)
			assert.Equal(t, "cancelled", record.ErrorCode)
			if stage == "admitted" {
				assert.Zero(t, calls)
			} else {
				assert.Equal(t, 1, calls)
			}
			replay, err := service.Submit(context.Background(), e)
			require.NoError(t, err)
			assert.Equal(t, record, replay)
		})
	}
}

func TestServiceOneEngineAcrossRealSQLiteHandles(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	e := serviceEvidence("two-service-handles")
	path := filepath.Join(t.TempDir(), "shared.db")
	first, err := store.OpenSQLite(ctx, path)
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, first.Close()) })
	seedServiceBinding(t, first, e)
	second, err := store.OpenSQLite(ctx, path)
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, second.Close()) })
	var calls atomic.Int32
	engine := serviceEngine(func(_ context.Context, input trace.Evidence) (trace.Result, error) {
		calls.Add(1)
		return serviceResult(input), nil
	})
	start := make(chan struct{})
	done := make(chan error, 2)
	for _, db := range []*store.DB{first, second} {
		go func(db *store.DB) {
			<-start
			_, err := (trace.Service{Repository: db, Engine: engine}).Submit(ctx, e)
			done <- err
		}(db)
	}
	close(start)
	for range 2 {
		err := <-done
		if err != nil {
			assert.ErrorIs(t, err, trace.ErrProbeStorage)
		}
	}
	assert.Equal(t, int32(1), calls.Load())
	for _, db := range []*store.DB{first, second} {
		_, err := (trace.Service{Repository: db, Engine: engine}).Submit(ctx, e)
		require.NoError(t, err)
	}
	assert.Equal(t, int32(1), calls.Load())
}
