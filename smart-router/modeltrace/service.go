package modeltrace

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"smart-router/api"
)

var (
	ErrProbeConflict   = errors.New("probe evidence conflicts")
	ErrProbeNotFound   = errors.New("probe not found")
	ErrBindingMissing  = errors.New("probe binding missing")
	ErrBindingMismatch = errors.New("probe binding mismatch")
	ErrProbeTransition = errors.New("invalid probe transition")
	ErrProbeStorage    = errors.New("probe storage failed")
	ErrProbeTime       = errors.New("invalid probe time")
	ErrProbeExecution  = errors.New("probe execution failed")
	ErrInterrupted     = errors.New("probe interrupted")
)

type Record struct {
	ProbeID        string
	BindingID      string
	ClaimedModel   string
	Protocol       api.Protocol
	EvidenceSHA256 string
	State          State
	ObservedAt     time.Time
	Result         *Result
	ErrorCode      string
}

type Repository interface {
	BeginProbe(context.Context, Evidence, string, time.Time) (Record, bool, error)
	CompleteProbe(context.Context, string, Result, time.Time) error
	FailProbe(context.Context, string, string, time.Time) error
	GetProbe(context.Context, string) (Record, error)
	LatestAttribution(context.Context, string, string, api.Protocol) (Record, error)
	RecoverInterrupted(context.Context, time.Time) error
}

type Service struct {
	Repository Repository
	Engine     Engine
	Now        func() time.Time
}

func (service Service) Submit(ctx context.Context, evidence Evidence) (Record, error) {
	if service.Repository == nil || service.Engine == nil {
		return Record{}, ErrProcessConfiguration
	}
	evidence = snapshotProbeEvidence(evidence)
	digest, err := evidence.Digest()
	if err != nil {
		return Record{}, err
	}
	now := service.Now
	if now == nil {
		now = time.Now
	}
	record, created, err := service.Repository.BeginProbe(ctx, snapshotProbeEvidence(evidence), digest, now())
	if err != nil {
		return Record{}, err
	}
	if !created {
		return record, nil
	}

	var result Result
	executionErr := ctx.Err()
	if executionErr == nil {
		result, executionErr = service.Engine.Analyze(ctx, snapshotProbeEvidence(evidence))
	}
	if ctx.Err() != nil {
		executionErr = ctx.Err()
	}
	if executionErr == nil {
		result.Models = append([]ModelScore(nil), result.Models...)
		result.Families = append([]FamilyScore(nil), result.Families...)
		used := 0
		for _, sample := range evidence.Samples {
			if len(sample.Numbers) >= max(80, (sample.ExpectedCount*55+99)/100) {
				used++
			}
		}
		if result.Validate() != nil || result.BankRevision != evidence.BankRevision || result.UsedOutputs != used ||
			result.Assessment != Assess(evidence.ClaimedModel, result, 0) {
			executionErr = ErrInvalidResult
		} else {
			data, marshalErr := json.Marshal(result)
			if marshalErr != nil || len(data) > 256<<10 {
				executionErr = ErrInvalidResult
			}
		}
	}
	terminalAt := now()
	if ctx.Err() != nil {
		executionErr = ctx.Err()
	}
	if executionErr != nil {
		code := "execution_failed"
		switch {
		case errors.Is(executionErr, context.Canceled):
			code = "cancelled"
		case errors.Is(executionErr, context.DeadlineExceeded):
			code = "deadline_exceeded"
		case errors.Is(executionErr, ErrProcessConfiguration):
			code = "configuration_invalid"
		case errors.Is(executionErr, ErrProcessIntegrity):
			code = "integrity_failed"
		case errors.Is(executionErr, ErrProcessLimit):
			code = "process_limit"
		case errors.Is(executionErr, ErrInvalidResult):
			code = "invalid_result"
		}
		cleanup, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
		defer cancel()
		if err := service.Repository.FailProbe(cleanup, evidence.ProbeID, code, terminalAt); err != nil {
			return Record{}, errors.Join(ErrProbeExecution, err)
		}
		failed, err := service.Repository.GetProbe(cleanup, evidence.ProbeID)
		if err != nil {
			return Record{}, errors.Join(ErrProbeExecution, err)
		}
		return failed, ErrProbeExecution
	}
	if err := service.Repository.CompleteProbe(ctx, evidence.ProbeID, result, terminalAt); err != nil {
		return Record{}, err
	}
	return service.Repository.GetProbe(ctx, evidence.ProbeID)
}

func snapshotProbeEvidence(e Evidence) Evidence {
	e.Samples = append([]Sample(nil), e.Samples...)
	for i := range e.Samples {
		e.Samples[i].Numbers = append([]int(nil), e.Samples[i].Numbers...)
	}
	return e
}
