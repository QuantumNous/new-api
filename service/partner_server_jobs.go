package service

import (
	"context"
	"fmt"
	"sync"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/bytedance/gopkg/util/gopool"
)

const (
	PartnerServerJobSuspension    = "suspension"
	PartnerServerJobKeyRevocation = "key_revocation"

	partnerServerJobBatchSize = 500
)

// PartnerServerJobProgress is the state of a background job over one
// partner's sub-accounts.
type PartnerServerJobProgress struct {
	Running   bool   `json:"running"`
	Processed int    `json:"processed"`
	Error     string `json:"error,omitempty"`
}

type partnerServerJob struct {
	progress PartnerServerJobProgress
	rerun    bool
}

// Jobs and their progress live in this process. That holds for the current
// single-instance deployment; several instances would need a database lock.
var (
	partnerServerJobsMu sync.Mutex
	partnerServerJobs   = map[string]*partnerServerJob{}
)

// PartnerServerJobRunner starts a background job. Tests replace it to run
// jobs inline.
var PartnerServerJobRunner = func(task func()) { gopool.Go(task) }

func partnerServerJobKey(kind, clientID string) string {
	return kind + ":" + clientID
}

// GetPartnerServerJobProgress returns the latest progress of a partner's job.
func GetPartnerServerJobProgress(kind, clientID string) PartnerServerJobProgress {
	partnerServerJobsMu.Lock()
	defer partnerServerJobsMu.Unlock()
	if job, ok := partnerServerJobs[partnerServerJobKey(kind, clientID)]; ok {
		return job.progress
	}
	return PartnerServerJobProgress{}
}

// StartPartnerServerJob runs the job in the background. If the same job is
// already running it is run again from the beginning once it finishes, even
// when that run failed, so a suspend quickly followed by a resume always ends
// in the latest state.
func StartPartnerServerJob(kind, clientID string) {
	key := partnerServerJobKey(kind, clientID)
	partnerServerJobsMu.Lock()
	job, ok := partnerServerJobs[key]
	if ok && job.progress.Running {
		job.rerun = true
		partnerServerJobsMu.Unlock()
		return
	}
	job = &partnerServerJob{progress: PartnerServerJobProgress{Running: true}}
	partnerServerJobs[key] = job
	partnerServerJobsMu.Unlock()

	PartnerServerJobRunner(func() {
		var err error
		defer func() {
			if recovered := recover(); recovered != nil {
				err = fmt.Errorf("panic: %v", recovered)
			}
			finishPartnerServerJob(key, job, err)
		}()
		for {
			err = runPartnerServerJob(kind, clientID, job)
			partnerServerJobsMu.Lock()
			again := job.rerun
			job.rerun = false
			if again {
				job.progress.Processed = 0
				job.progress.Error = ""
			}
			partnerServerJobsMu.Unlock()
			if !again {
				return
			}
		}
	})
}

func finishPartnerServerJob(key string, job *partnerServerJob, err error) {
	partnerServerJobsMu.Lock()
	job.progress.Running = false
	if err != nil {
		job.progress.Error = "the job stopped early; run it again"
	}
	partnerServerJobsMu.Unlock()
	if err != nil {
		logger.LogError(context.Background(), common.LogText("partner server job %s failed: %s", key, err.Error()))
	}
}

func runPartnerServerJob(kind, clientID string, job *partnerServerJob) error {
	// A key revocation is persisted, so a restart resumes it; only a complete
	// pass clears the marker it was started for.
	var revocationRequestedAt int64
	if kind == PartnerServerJobKeyRevocation {
		var err error
		if revocationRequestedAt, err = model.PartnerKeyRevocationRequestedAt(clientID); err != nil {
			return err
		}
	}
	var after int64
	for {
		var batch *model.PartnerAccountBatch
		var err error
		switch kind {
		case PartnerServerJobSuspension:
			batch, err = model.ReconcilePartnerAccountSuspensionBatch(clientID, after, partnerServerJobBatchSize)
		case PartnerServerJobKeyRevocation:
			batch, err = model.RevokePartnerAccountKeysBatch(clientID, after, partnerServerJobBatchSize)
		default:
			return fmt.Errorf("unknown partner server job %q", kind)
		}
		if batch != nil {
			// Publish what committed even when the batch stopped part-way.
			model.FinalizePartnerAccountUserStatusChanges(batch.ChangedUserIds)
			partnerServerJobsMu.Lock()
			job.progress.Processed += batch.Processed
			partnerServerJobsMu.Unlock()
			after = batch.LastId
		}
		if err != nil {
			return err
		}
		if batch.Done {
			if kind == PartnerServerJobKeyRevocation && revocationRequestedAt != 0 {
				return model.FinishPartnerKeyRevocation(clientID, revocationRequestedAt)
			}
			return nil
		}
	}
}

// StartPartnerKeyRevocation persists a revoke-all request for the partner's
// sub-account keys and starts it.
func StartPartnerKeyRevocation(clientID string) error {
	if _, err := model.RequestPartnerKeyRevocation(clientID); err != nil {
		return err
	}
	StartPartnerServerJob(PartnerServerJobKeyRevocation, clientID)
	return nil
}

var partnerServerRecoveryOnce sync.Once

// StartPartnerServerJobRecovery finishes suspension, resume and key
// revocation jobs a restart interrupted. It runs once, on the master node.
func StartPartnerServerJobRecovery() {
	partnerServerRecoveryOnce.Do(func() {
		if !common.IsMasterNode {
			return
		}
		suspension, keyRevocation, err := model.PartnerServerJobsToResume()
		if err != nil {
			common.SysError(common.LogText("failed to list partner server jobs to resume: %s", err.Error()))
			return
		}
		for _, clientID := range suspension {
			StartPartnerServerJob(PartnerServerJobSuspension, clientID)
		}
		for _, clientID := range keyRevocation {
			StartPartnerServerJob(PartnerServerJobKeyRevocation, clientID)
		}
	})
}
