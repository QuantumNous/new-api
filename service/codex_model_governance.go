package service

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

const (
	CodexModelGovernanceReviewActionConfirmRemove = "confirm_remove"
	CodexModelGovernanceReviewActionRestore       = "restore"
	CodexModelGovernanceReviewActionIgnore        = "ignore"
	CodexModelGovernanceReviewActionDisable       = "disable"
)

type CodexModelUnsupportedFinding struct {
	ModelName          string
	Source             string
	MatchedRule        string
	LastError          string
	AffectedChannelIDs []int
}

var notifyDingTalkCodexModelGovernance = NotifyDingTalkCodexModelGovernance

// codexFindingShouldAutoDisable returns true only for probe findings: a probe
// error is first-hand evidence from the upstream API, while official notice
// and AI findings are inferred from fetched text and must wait for a human
// decision before any routing change.
func codexFindingShouldAutoDisable(source string) bool {
	return source == model.CodexModelGovernanceSourceProbe
}

func MoveCodexModelToPendingReview(finding CodexModelUnsupportedFinding) (*model.CodexModelGovernanceRecord, error) {
	modelName := strings.TrimSpace(finding.ModelName)
	if modelName == "" {
		return nil, fmt.Errorf("model name is required")
	}
	shouldNotify, err := shouldNotifyCodexModelGovernancePending(modelName)
	if err != nil {
		return nil, err
	}
	source := strings.TrimSpace(finding.Source)
	record, err := model.UpsertCodexModelGovernancePending(model.CodexModelGovernancePendingInput{
		ModelName:          modelName,
		Source:             source,
		MatchedRule:        strings.TrimSpace(finding.MatchedRule),
		LastError:          strings.TrimSpace(finding.LastError),
		AffectedChannelIDs: finding.AffectedChannelIDs,
		DisableAbilities:   codexFindingShouldAutoDisable(source),
	})
	if err != nil {
		return record, err
	}
	if shouldNotify {
		if notifyErr := notifyDingTalkCodexModelGovernance(record); notifyErr != nil {
			common.SysError(fmt.Sprintf("Codex model governance DingTalk alert failed for %s: %v", modelName, notifyErr))
		}
	}
	return record, nil
}

func shouldNotifyCodexModelGovernancePending(modelName string) (bool, error) {
	records, err := model.ListCodexModelGovernanceRecords("")
	if err != nil {
		return false, err
	}
	for _, record := range records {
		if record.ModelName != modelName {
			continue
		}
		return record.Status != model.CodexModelGovernanceStatusUnsupportedPendingReview, nil
	}
	return true, nil
}

func ReviewCodexModelGovernance(recordID int, action string, reviewerID int, note string) error {
	status, err := codexModelGovernanceStatusForReviewAction(action)
	if err != nil {
		return err
	}
	return model.ReviewCodexModelGovernanceRecord(recordID, status, reviewerID, note)
}

func codexModelGovernanceStatusForReviewAction(action string) (string, error) {
	switch strings.TrimSpace(action) {
	case CodexModelGovernanceReviewActionConfirmRemove:
		return model.CodexModelGovernanceStatusRemoved, nil
	case CodexModelGovernanceReviewActionRestore:
		return model.CodexModelGovernanceStatusActive, nil
	case CodexModelGovernanceReviewActionIgnore:
		return model.CodexModelGovernanceStatusIgnored, nil
	case CodexModelGovernanceReviewActionDisable:
		// Disable keeps the record pending: the model-layer pending-review
		// transition disables abilities and marks abilities_disabled.
		return model.CodexModelGovernanceStatusUnsupportedPendingReview, nil
	default:
		return "", fmt.Errorf("unsupported Codex model governance review action: %s", action)
	}
}
