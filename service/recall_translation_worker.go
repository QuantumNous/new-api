package service

import (
	"context"
	"crypto/sha256"
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
)

const recallTranslationLeaseDuration = 5 * time.Minute

type RecallTranslationWorker struct {
	translator RecallEmailTranslator
	owner      string
	now        func() time.Time
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

func NewRecallTranslationWorker(translator RecallEmailTranslator, owner string) *RecallTranslationWorker {
	return &RecallTranslationWorker{
		translator: translator,
		owner:      strings.TrimSpace(owner),
		now:        time.Now,
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
	task, won, err := model.ClaimDueRecallTranslationTask(ctx, due[0].Id, w.owner, now, now+int64(recallTranslationLeaseDuration/time.Second))
	if err != nil || !won {
		return nil, err
	}
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
		if err := w.process(ctx, task); err != nil {
			logger.LogWarn(ctx, fmt.Sprintf("recall translation task failed: task_id=%d campaign_id=%d error_class=%s", task.Id, task.CampaignId, sanitizeRecallTranslationErrorCode(err)))
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
	var snapshot recallTranslationSourceSnapshot
	if err := common.Unmarshal([]byte(task.SourceSnapshot), &snapshot); err != nil {
		_, _ = model.FailRecallTranslationTask(ctx, model.RecallTranslationTaskFailure{
			TaskID: task.Id, Owner: w.owner, LeaseEpoch: task.LeaseEpoch, ErrorCode: "invalid_source_snapshot", FinishedAt: w.now().Unix(),
		})
		return nil, model.RecallTranslationTaskCompletionLeaseLost, fmt.Errorf("invalid source snapshot")
	}
	translated, err := translateRecallEmailStagesWithTranslator(ctx, w.translator, snapshot.CampaignType, snapshot.English)
	if err != nil {
		_, _ = model.FailRecallTranslationTask(ctx, model.RecallTranslationTaskFailure{
			TaskID: task.Id, Owner: w.owner, LeaseEpoch: task.LeaseEpoch, ErrorCode: "translation_failed", FinishedAt: w.now().Unix(),
		})
		return nil, model.RecallTranslationTaskCompletionLeaseLost, err
	}
	_, _ = model.RenewRecallTranslationTaskLease(ctx, task.Id, w.owner, task.LeaseEpoch, w.now().Add(recallTranslationLeaseDuration).Unix())
	generated, err := applyRecallEmailGenerationResult(snapshot.CampaignType, snapshot.English, translated)
	if err == nil {
		generated, err = incrementRecallEmailTemplateVersions(snapshot.Current, generated)
	}
	if err != nil {
		_, _ = model.FailRecallTranslationTask(ctx, model.RecallTranslationTaskFailure{
			TaskID: task.Id, Owner: w.owner, LeaseEpoch: task.LeaseEpoch, ErrorCode: "invalid_translation_output", FinishedAt: w.now().Unix(),
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
		logger.LogInfo(ctx, fmt.Sprintf("recall translation task finished without writeback: task_id=%d campaign_id=%d result=%s", task.Id, task.CampaignId, result))
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
	case "invalid_source_snapshot", "translation_failed", "invalid_translation_output":
		return code
	default:
		return "translation_failed"
	}
}
