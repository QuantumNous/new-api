package service

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"strings"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	perfmetrics "github.com/QuantumNous/new-api/pkg/perf_metrics"
)

const recallTranslationLeaseDuration = 5 * time.Minute
const recallTranslationHeartbeatInterval = time.Minute

type RecallTranslationWorker struct {
	translator        RecallEmailTranslator
	owner             string
	now               func() time.Time
	leaseDuration     time.Duration
	heartbeatInterval time.Duration
}

type recallTranslationSourceSnapshot struct {
	CampaignType string             `json:"campaign_type"`
	Name         string             `json:"name"`
	Current      []RecallEmailStage `json:"current_email_sequence"`
	English      []RecallEmailStage `json:"english_email_sequence"`
}

type recallTranslationResultSnapshot struct {
	Emails []RecallEmailStage `json:"email_sequence"`
}

type recallTranslationTaskObservation struct {
	Event          string
	Status         string
	ErrorClass     string
	LeaseRecovered bool
	DurationMs     int64
}

var recallTranslationTaskObserve = func(observation recallTranslationTaskObservation) {}

func observeRecallTranslationTask(observation recallTranslationTaskObservation) {
	observation.Event = strings.TrimSpace(observation.Event)
	observation.Status = strings.TrimSpace(observation.Status)
	observation.ErrorClass = strings.TrimSpace(observation.ErrorClass)
	if observation.DurationMs < 0 {
		observation.DurationMs = 0
	}
	perfmetrics.RecordRecallTranslationObservation(
		observation.Event,
		observation.Status,
		observation.ErrorClass,
		observation.LeaseRecovered,
		observation.DurationMs,
	)
	recallTranslationTaskObserve(observation)
}

func NewRecallTranslationWorker(translator RecallEmailTranslator, owner string) *RecallTranslationWorker {
	return &RecallTranslationWorker{
		translator:        translator,
		owner:             strings.TrimSpace(owner),
		now:               time.Now,
		leaseDuration:     recallTranslationLeaseDuration,
		heartbeatInterval: recallTranslationHeartbeatInterval,
	}
}

func (w *RecallTranslationWorker) ClaimOne(ctx context.Context) (*model.RecallTranslationTask, error) {
	if w == nil || w.translator == nil || w.owner == "" {
		return nil, nil
	}
	now := w.now().Unix()
	due, err := model.ListDueRecallTranslationTasks(ctx, now, 1)
	if err != nil {
		return nil, err
	}
	if len(due) == 0 {
		return nil, nil
	}
	leaseDuration := w.effectiveLeaseDuration()
	task, won, err := model.ClaimDueRecallTranslationTask(ctx, due[0].Id, w.owner, now, now+int64(leaseDuration/time.Second))
	if err != nil || !won {
		return nil, err
	}
	leaseRecovered := due[0].Status == model.RecallTranslationTaskRunning
	if due[0].Status == model.RecallTranslationTaskRunning {
		logger.LogInfo(ctx, fmt.Sprintf("recall translation task lease recovered: task_id=%d campaign_id=%d status=%s", task.Id, task.CampaignId, task.Status))
	}
	logger.LogInfo(ctx, fmt.Sprintf("recall translation task claimed: task_id=%d campaign_id=%d status=%s lease_epoch=%d", task.Id, task.CampaignId, task.Status, task.LeaseEpoch))
	observeRecallTranslationTask(recallTranslationTaskObservation{
		Event:          "claimed",
		Status:         task.Status,
		LeaseRecovered: leaseRecovered,
	})
	return task, nil
}

func (w *RecallTranslationWorker) RunBatch(ctx context.Context, limit int) (int, error) {
	if limit <= 0 || w == nil || w.translator == nil || w.owner == "" {
		return 0, nil
	}
	processed := 0
	for processed < limit {
		if err := ctx.Err(); err != nil {
			return processed, err
		}
		task, err := w.ClaimOne(ctx)
		if err != nil {
			return processed, err
		}
		if task == nil {
			break
		}
		started := w.now()
		if err := w.process(ctx, task); err != nil {
			errorClass := sanitizeRecallTranslationErrorCode(err)
			status := model.RecallTranslationTaskFailed
			if errors.Is(err, errRecallTranslationLeaseLost) {
				status = model.RecallTranslationTaskRunning
			}
			logger.LogWarn(ctx, fmt.Sprintf("recall translation task failed: task_id=%d campaign_id=%d status=%s error_class=%s duration_ms=%d", task.Id, task.CampaignId, status, errorClass, w.now().Sub(started).Milliseconds()))
		}
		processed++
	}
	return processed, nil
}

func (w *RecallTranslationWorker) process(ctx context.Context, task *model.RecallTranslationTask) error {
	_, _, err := w.processDetailed(ctx, task)
	return err
}

func (w *RecallTranslationWorker) processDetailed(ctx context.Context, task *model.RecallTranslationTask) ([]RecallEmailStage, model.RecallTranslationTaskCompletionResult, error) {
	started := w.now()
	durationMs := func() int64 {
		elapsed := w.now().Sub(started).Milliseconds()
		if elapsed < 0 {
			return 0
		}
		return elapsed
	}
	observeRecallTranslationTask(recallTranslationTaskObservation{
		Event:  "running",
		Status: model.RecallTranslationTaskRunning,
	})
	var snapshot recallTranslationSourceSnapshot
	if err := common.Unmarshal([]byte(task.SourceSnapshot), &snapshot); err != nil {
		_, _ = model.FailRecallTranslationTask(ctx, model.RecallTranslationTaskFailure{
			TaskID: task.Id, Owner: w.owner, LeaseEpoch: task.LeaseEpoch, ErrorCode: "invalid_source_snapshot", FinishedAt: w.now().Unix(),
		})
		observeRecallTranslationTask(recallTranslationTaskObservation{
			Event:      "failed",
			Status:     model.RecallTranslationTaskFailed,
			ErrorClass: "invalid_source_snapshot",
			DurationMs: durationMs(),
		})
		return nil, model.RecallTranslationTaskCompletionLeaseLost, fmt.Errorf("invalid source snapshot")
	}
	translateCtx, cancel := context.WithCancel(ctx)
	heartbeat := w.startHeartbeat(translateCtx, cancel, task)
	translated, err := translateRecallEmailStagesWithTranslator(translateCtx, w.translator, snapshot.CampaignType, snapshot.English)
	heartbeatErr := heartbeat()
	cancel()
	if heartbeatErr != nil {
		errorClass := sanitizeRecallTranslationErrorCode(heartbeatErr)
		observeRecallTranslationTask(recallTranslationTaskObservation{
			Event:      "failed",
			Status:     model.RecallTranslationTaskRunning,
			ErrorClass: errorClass,
			DurationMs: durationMs(),
		})
		logger.LogWarn(ctx, fmt.Sprintf("recall translation task lease lost: task_id=%d campaign_id=%d status=%s error_class=%s duration_ms=%d", task.Id, task.CampaignId, model.RecallTranslationTaskRunning, errorClass, durationMs()))
		return nil, model.RecallTranslationTaskCompletionLeaseLost, heartbeatErr
	}
	if err != nil {
		_, _ = model.FailRecallTranslationTask(ctx, model.RecallTranslationTaskFailure{
			TaskID: task.Id, Owner: w.owner, LeaseEpoch: task.LeaseEpoch, ErrorCode: "translation_failed", FinishedAt: w.now().Unix(),
		})
		observeRecallTranslationTask(recallTranslationTaskObservation{
			Event:      "failed",
			Status:     model.RecallTranslationTaskFailed,
			ErrorClass: "translation_failed",
			DurationMs: durationMs(),
		})
		return nil, model.RecallTranslationTaskCompletionLeaseLost, err
	}
	generated, err := applyRecallEmailGenerationResult(snapshot.CampaignType, snapshot.English, translated)
	if err == nil {
		generated, err = incrementRecallEmailTemplateVersions(snapshot.Current, generated)
	}
	if err != nil {
		_, _ = model.FailRecallTranslationTask(ctx, model.RecallTranslationTaskFailure{
			TaskID: task.Id, Owner: w.owner, LeaseEpoch: task.LeaseEpoch, ErrorCode: "invalid_translation_output", FinishedAt: w.now().Unix(),
		})
		observeRecallTranslationTask(recallTranslationTaskObservation{
			Event:      "failed",
			Status:     model.RecallTranslationTaskFailed,
			ErrorClass: "invalid_translation_output",
			DurationMs: durationMs(),
		})
		return nil, model.RecallTranslationTaskCompletionLeaseLost, err
	}
	emailJSON, err := common.Marshal(generated)
	if err != nil {
		return nil, model.RecallTranslationTaskCompletionLeaseLost, err
	}
	resultJSON, err := common.Marshal(recallTranslationResultSnapshot{Emails: generated})
	if err != nil {
		return nil, model.RecallTranslationTaskCompletionLeaseLost, err
	}
	result, err := model.CompleteRecallTranslationTaskSuccess(ctx, model.RecallTranslationTaskCompletion{
		TaskID:         task.Id,
		Owner:          w.owner,
		LeaseEpoch:     task.LeaseEpoch,
		ResultSnapshot: string(resultJSON),
		EmailSequence:  string(emailJSON),
		FinishedAt:     w.now().Unix(),
	})
	if err != nil {
		return nil, result, err
	}
	if result != model.RecallTranslationTaskCompletionSucceeded {
		status := model.RecallTranslationTaskRunning
		event := string(result)
		if result == model.RecallTranslationTaskCompletionSuperseded {
			status = model.RecallTranslationTaskSuperseded
			event = "superseded"
		}
		observeRecallTranslationTask(recallTranslationTaskObservation{
			Event:      event,
			Status:     status,
			DurationMs: durationMs(),
		})
		logger.LogInfo(ctx, fmt.Sprintf("recall translation task finished without writeback: task_id=%d campaign_id=%d status=%s result=%s duration_ms=%d", task.Id, task.CampaignId, status, result, durationMs()))
	} else {
		observeRecallTranslationTask(recallTranslationTaskObservation{
			Event:      "succeeded",
			Status:     model.RecallTranslationTaskSucceeded,
			DurationMs: durationMs(),
		})
		logger.LogInfo(ctx, fmt.Sprintf("recall translation task succeeded: task_id=%d campaign_id=%d status=%s duration_ms=%d", task.Id, task.CampaignId, model.RecallTranslationTaskSucceeded, durationMs()))
	}
	return generated, result, nil
}

func buildRecallTranslationSourceSnapshot(campaignType string, name string, current []RecallEmailStage, english []RecallEmailStage) (string, error) {
	payload, err := common.Marshal(recallTranslationSourceSnapshot{
		CampaignType: campaignType,
		Name:         strings.TrimSpace(name),
		Current:      current,
		English:      english,
	})
	if err != nil {
		return "", err
	}
	return string(payload), nil
}

func recallTranslationCanonicalSourceHash(emailSequenceConfig string) string {
	sum := sha256.Sum256([]byte(strings.TrimSpace(emailSequenceConfig)))
	return fmt.Sprintf("%x", sum[:])
}

var errRecallTranslationLeaseLost = errors.New("translation_lease_lost")

func (w *RecallTranslationWorker) startHeartbeat(ctx context.Context, cancel context.CancelFunc, task *model.RecallTranslationTask) func() error {
	interval := w.effectiveHeartbeatInterval()
	leaseDuration := w.effectiveLeaseDuration()
	stop := make(chan struct{})
	done := make(chan error, 1)
	var lost atomic.Bool
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-stop:
				done <- nil
				return
			case <-ctx.Done():
				done <- ctx.Err()
				return
			case <-ticker.C:
				won, err := model.RenewRecallTranslationTaskLease(ctx, task.Id, w.owner, task.LeaseEpoch, w.now().Add(leaseDuration).Unix())
				if err != nil || !won {
					lost.Store(true)
					cancel()
					if err != nil {
						done <- errRecallTranslationLeaseLost
					} else {
						done <- errRecallTranslationLeaseLost
					}
					return
				}
			}
		}
	}()
	return func() error {
		if lost.Load() {
			return <-done
		}
		close(stop)
		err := <-done
		if errors.Is(err, context.Canceled) {
			return nil
		}
		return err
	}
}

func (w *RecallTranslationWorker) effectiveLeaseDuration() time.Duration {
	if w.leaseDuration > 0 {
		return w.leaseDuration
	}
	return recallTranslationLeaseDuration
}

func (w *RecallTranslationWorker) effectiveHeartbeatInterval() time.Duration {
	if w.heartbeatInterval > 0 {
		return w.heartbeatInterval
	}
	return recallTranslationHeartbeatInterval
}

func translateRecallEmailStagesWithTranslator(ctx context.Context, translator RecallEmailTranslator, campaignType string, stages []RecallEmailStage) (map[int]map[string]RecallEmailTemplate, error) {
	campaignType, err := normalizeRecallCampaignType(campaignType)
	if err != nil {
		return nil, err
	}
	if campaignTranslator, ok := translator.(RecallEmailCampaignTranslator); ok {
		return campaignTranslator.TranslateForCampaign(ctx, campaignType, stages)
	}
	if campaignType != model.RecallCampaignTypePromotion {
		return nil, fmt.Errorf("recall email translator does not support campaign type %q", campaignType)
	}
	return translator.Translate(ctx, stages)
}

func sanitizeRecallTranslationErrorCode(err error) string {
	if err == nil {
		return ""
	}
	code := strings.TrimSpace(err.Error())
	switch code {
	case "invalid_source_snapshot", "translation_failed", "invalid_translation_output", "translation_lease_lost":
		return code
	default:
		return "translation_failed"
	}
}
