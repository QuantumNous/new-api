package service

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

const tokenQuotaPolicyResetBatchSize = 200

type tokenQuotaPolicyResetHandler struct{}

type tokenQuotaPolicyResetResult struct {
	ResetCount int `json:"reset_count"`
}

type tokenQuotaPolicyUserMessageError struct {
	message string
	cause   error
}

func (e *tokenQuotaPolicyUserMessageError) Error() string {
	return e.message
}

func (e *tokenQuotaPolicyUserMessageError) Unwrap() error {
	return e.cause
}

func init() {
	RegisterSystemTaskHandler(tokenQuotaPolicyResetHandler{})
}

func (tokenQuotaPolicyResetHandler) Type() string {
	return model.SystemTaskTypeTokenQuotaReset
}

func (tokenQuotaPolicyResetHandler) Enabled() bool {
	return true
}

func (tokenQuotaPolicyResetHandler) Interval() time.Duration {
	return time.Minute
}

func (tokenQuotaPolicyResetHandler) NewPayload() any {
	return nil
}

func (tokenQuotaPolicyResetHandler) Run(ctx context.Context, task *model.SystemTask, runnerID string) {
	now := common.GetTimestamp()
	policies, err := model.FindDueTokenQuotaPolicies(now, tokenQuotaPolicyResetBatchSize)
	if err != nil {
		failSystemTask(task, runnerID, err)
		return
	}
	resetCount := 0
	for _, policy := range policies {
		select {
		case <-ctx.Done():
			logSystemTaskLockError(ctx, task, ctx.Err())
			return
		default:
		}
		reset, err := model.ResetTokenQuotaPolicyAndRestoreTokenIfDue(policy.TokenId, now)
		if err != nil {
			failSystemTask(task, runnerID, err)
			return
		}
		if reset {
			resetCount++
		}
	}
	result := tokenQuotaPolicyResetResult{ResetCount: resetCount}
	if err := model.FinishSystemTask(task.TaskID, runnerID, model.SystemTaskStatusSucceeded, result, ""); err != nil {
		logger.LogWarn(context.Background(), fmt.Sprintf("system task %s failed to save token quota reset result: %v", task.TaskID, err))
	}
}

func preConsumeTokenQuotaPolicy(relayInfo *relaycommon.RelayInfo, quota int) error {
	if relayInfo == nil || relayInfo.IsPlayground || quota <= 0 {
		return nil
	}
	if !relayInfo.TokenQuotaPolicyEnabled {
		return nil
	}
	policy, err := getRelayTokenQuotaPolicy(relayInfo)
	if err != nil {
		if errors.Is(err, model.ErrTokenQuotaPolicyNotFound) {
			return nil
		}
		return err
	}
	if !policy.Enabled {
		return nil
	}
	reset, err := model.ResetTokenQuotaPolicyIfDue(relayInfo.TokenId, common.GetTimestamp())
	if err != nil {
		return err
	}
	if reset {
		clearRelayTokenQuotaPolicy(relayInfo)
		policy, err = getRelayTokenQuotaPolicy(relayInfo)
		if err != nil {
			if errors.Is(err, model.ErrTokenQuotaPolicyNotFound) {
				return nil
			}
			return err
		}
		if !policy.Enabled {
			return nil
		}
	}
	now := common.GetTimestamp()
	if policy.BoundaryMode != string(model.TokenQuotaBoundaryStrict) {
		if tokenQuotaPolicySnapshotExhausted(policy, now) {
			if policy.ExhaustedAction == string(model.TokenQuotaExhaustDisableToken) {
				if pauseErr := model.MarkTokenQuotaPolicyExhausted(relayInfo.TokenId, common.TokenStatusDisabled); pauseErr != nil {
					return pauseErr
				}
			}
			return model.ErrTokenQuotaPolicyExhausted
		}
		return nil
	}
	if tokenQuotaPolicySnapshotExhausted(policy, now) {
		if policy.ExhaustedAction == string(model.TokenQuotaExhaustDisableToken) {
			if pauseErr := model.MarkTokenQuotaPolicyExhausted(relayInfo.TokenId, common.TokenStatusDisabled); pauseErr != nil {
				return pauseErr
			}
		}
		return model.ErrTokenQuotaPolicyExhausted
	}
	err = model.ConsumeTokenQuotaPolicy(relayInfo.TokenId, quota)
	if err == nil {
		relayInfo.TokenQuotaPolicyPreConsumed += quota
		clearRelayTokenQuotaPolicy(relayInfo)
		return nil
	}
	return err
}

func postConsumeTokenQuotaPolicy(relayInfo *relaycommon.RelayInfo, quota int) error {
	if relayInfo == nil || relayInfo.IsPlayground || quota == 0 {
		return nil
	}
	if !relayInfo.TokenQuotaPolicyEnabled {
		return nil
	}
	policy, err := getRelayTokenQuotaPolicy(relayInfo)
	if err != nil {
		if errors.Is(err, model.ErrTokenQuotaPolicyNotFound) {
			return nil
		}
		return err
	}
	if !policy.Enabled {
		return nil
	}
	if quota > 0 {
		reset, err := model.ResetTokenQuotaPolicyIfDue(relayInfo.TokenId, common.GetTimestamp())
		if err != nil {
			return err
		}
		if reset {
			clearRelayTokenQuotaPolicy(relayInfo)
			policy, err = getRelayTokenQuotaPolicy(relayInfo)
			if err != nil {
				if errors.Is(err, model.ErrTokenQuotaPolicyNotFound) {
					return nil
				}
				return err
			}
			if !policy.Enabled {
				return nil
			}
		}
		exhausted, err := model.SettleTokenQuotaPolicyUsage(relayInfo.TokenId, quota)
		if err != nil {
			return err
		}
		clearRelayTokenQuotaPolicy(relayInfo)
		if exhausted && policy.ExhaustedAction == string(model.TokenQuotaExhaustDisableToken) {
			if pauseErr := model.MarkTokenQuotaPolicyExhausted(relayInfo.TokenId, common.TokenStatusDisabled); pauseErr != nil {
				return pauseErr
			}
		}
		relayInfo.TokenQuotaPolicyPreConsumed += quota
		return nil
	}
	refundQuota := -quota
	if relayInfo.TokenQuotaPolicyPreConsumed <= 0 {
		return nil
	}
	if refundQuota > relayInfo.TokenQuotaPolicyPreConsumed {
		refundQuota = relayInfo.TokenQuotaPolicyPreConsumed
	}
	if err := model.RefundTokenQuotaPolicy(relayInfo.TokenId, refundQuota); err != nil {
		return err
	}
	relayInfo.TokenQuotaPolicyPreConsumed -= refundQuota
	clearRelayTokenQuotaPolicy(relayInfo)
	return nil
}

func settleTokenQuotaPolicy(relayInfo *relaycommon.RelayInfo, actualQuota int) error {
	if relayInfo == nil || relayInfo.IsPlayground || !relayInfo.TokenQuotaPolicyEnabled {
		return nil
	}
	delta := actualQuota - relayInfo.TokenQuotaPolicyPreConsumed
	if delta == 0 {
		if relayInfo.TokenQuotaPolicyPreConsumed == 0 && actualQuota > 0 {
			return postConsumeTokenQuotaPolicy(relayInfo, actualQuota)
		}
		return nil
	}
	return postConsumeTokenQuotaPolicy(relayInfo, delta)
}

func newTokenQuotaPolicyExhaustedError(c *gin.Context, relayInfo *relaycommon.RelayInfo, err error) *types.NewAPIError {
	messageKey := i18n.MsgTokenQuotaPolicyExhaustedPending
	resetTime := ""
	if policy, policyErr := getRelayTokenQuotaPolicy(relayInfo); policyErr == nil {
		if !policy.AutoResume {
			messageKey = i18n.MsgTokenQuotaPolicyManualReset
		} else if policy.NextResetAt > common.GetTimestamp() {
			messageKey = i18n.MsgTokenQuotaPolicyExhausted
			resetTime = time.Unix(policy.NextResetAt, 0).Format("2006-01-02 15:04")
		}
	}
	messageArgs := map[string]any{
		"ResetTime": resetTime,
	}
	message := ""
	if c != nil && c.Request != nil {
		message = common.TranslateMessage(c, messageKey, messageArgs)
	}
	if c == nil || c.Request == nil || c.GetHeader("Accept-Language") == "" {
		if messageKey == i18n.MsgTokenQuotaPolicyExhausted {
			message = fmt.Sprintf("API key periodic quota is exhausted and is expected to automatically recover around %s", resetTime)
		} else if messageKey == i18n.MsgTokenQuotaPolicyManualReset {
			message = "API key periodic quota is exhausted. Manual reset is required before it can be used again"
		} else {
			message = "API key periodic quota is exhausted. The recovery time has arrived and it is waiting for recovery or manual reset"
		}
	}
	if message == "" || message == messageKey {
		message = err.Error()
	}
	return types.NewErrorWithStatusCode(&tokenQuotaPolicyUserMessageError{
		message: message,
		cause:   err,
	}, types.ErrorCodeTokenQuotaPolicyExhausted, http.StatusTooManyRequests, types.ErrOptionWithSkipRetry(), types.ErrOptionWithNoRecordErrorLog())
}

func getRelayTokenQuotaPolicy(relayInfo *relaycommon.RelayInfo) (*relaycommon.TokenQuotaPolicyInfo, error) {
	if relayInfo == nil || !relayInfo.TokenQuotaPolicyEnabled {
		return nil, model.ErrTokenQuotaPolicyNotFound
	}
	if relayInfo.TokenQuotaPolicyLoaded {
		if relayInfo.TokenQuotaPolicy != nil {
			return relayInfo.TokenQuotaPolicy, nil
		}
		return nil, model.ErrTokenQuotaPolicyNotFound
	}
	policy, err := model.GetTokenQuotaPolicyByTokenId(relayInfo.TokenId)
	if err != nil {
		if errors.Is(err, model.ErrTokenQuotaPolicyNotFound) {
			relayInfo.TokenQuotaPolicyLoaded = true
			relayInfo.TokenQuotaPolicy = nil
		}
		return nil, err
	}
	relayInfo.TokenQuotaPolicyLoaded = true
	relayInfo.TokenQuotaPolicy = &relaycommon.TokenQuotaPolicyInfo{
		Enabled:         policy.Enabled,
		BoundaryMode:    string(policy.BoundaryMode),
		ExhaustedAction: string(policy.ExhaustedAction),
		UsedQuota:       policy.UsedQuota,
		Quota:           policy.Quota,
		NextResetAt:     policy.NextResetAt,
		ExhaustedAt:     policy.ExhaustedAt,
		AutoResume:      policy.AutoResume,
	}
	return relayInfo.TokenQuotaPolicy, nil
}

func clearRelayTokenQuotaPolicy(relayInfo *relaycommon.RelayInfo) {
	if relayInfo == nil {
		return
	}
	relayInfo.TokenQuotaPolicyLoaded = false
	relayInfo.TokenQuotaPolicy = nil
}

func tokenQuotaPolicySnapshotExhausted(policy *relaycommon.TokenQuotaPolicyInfo, now int64) bool {
	if policy == nil || !policy.Enabled {
		return false
	}
	if policy.NextResetAt > 0 && now >= policy.NextResetAt {
		return false
	}
	return policy.ExhaustedAt != 0 || policy.UsedQuota >= policy.Quota
}
