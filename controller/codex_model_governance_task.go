package controller

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/bytedance/gopkg/util/gopool"
)

const (
	codexGovernanceProbePrompt                          = "ping"
	codexGovernanceProbeUnsupportedConsecutiveThreshold = 2
	codexGovernanceDisabledPollInterval                 = time.Minute
	codexGovernanceMinimumProbeIdle                     = time.Minute
	codexGovernanceSingleProbeTimeout                   = time.Minute
)

var codexModelGovernanceTaskOnce sync.Once
var codexGovernanceProbeFailureMu sync.Mutex
var codexGovernanceProbeFailures = make(map[codexGovernanceProbeFailureKey]int)

type codexGovernanceProbeFailureKey struct {
	ModelName string
	ChannelID int
}

func codexGovernanceProbeInterval(setting *operation_setting.CodexModelGovernanceSetting) time.Duration {
	if setting == nil || setting.ProbeIntervalMinutes < 60 {
		return time.Hour
	}
	return time.Duration(setting.ProbeIntervalMinutes) * time.Minute
}

func codexGovernanceTaskSleepDuration(setting *operation_setting.CodexModelGovernanceSetting) time.Duration {
	if setting == nil || !setting.Enabled {
		return codexGovernanceDisabledPollInterval
	}
	return codexGovernanceProbeInterval(setting)
}

func codexGovernanceTaskWaitDuration(now time.Time, nextRun time.Time, ranWork bool) time.Duration {
	wait := nextRun.Sub(now)
	if wait > 0 {
		return wait
	}
	if ranWork {
		return codexGovernanceMinimumProbeIdle
	}
	return codexGovernanceDisabledPollInterval
}

func codexGovernanceContextDone(ctx context.Context) bool {
	if ctx == nil {
		return false
	}
	select {
	case <-ctx.Done():
		return true
	default:
		return false
	}
}

func codexGovernanceProbeSettingEnabled(ctx context.Context, setting *operation_setting.CodexModelGovernanceSetting) bool {
	if codexGovernanceContextDone(ctx) {
		return false
	}
	return setting != nil && setting.Enabled && setting.ProbeEnabled
}

func codexGovernanceProbeShouldContinue(ctx context.Context) bool {
	return codexGovernanceProbeSettingEnabled(ctx, operation_setting.GetCodexModelGovernanceSetting())
}

func codexGovernanceProbeRequestContext(ctx context.Context) (context.Context, context.CancelFunc) {
	if ctx == nil {
		ctx = context.Background()
	}
	return context.WithTimeout(ctx, codexGovernanceSingleProbeTimeout)
}

func classifyCodexGovernanceProbeError(message string, patterns []string) service.CodexUnsupportedMatch {
	return service.ClassifyCodexUnsupportedMessage(message, patterns)
}

func recordCodexGovernanceProbeUnsupportedMatch(modelName string, channelID int) (int, bool) {
	modelName = strings.TrimSpace(modelName)
	if modelName == "" || channelID <= 0 {
		return 0, false
	}
	if model.DB != nil {
		count, escalate, err := model.RecordCodexModelGovernanceProbeUnsupportedFailure(
			modelName,
			channelID,
			codexGovernanceProbeUnsupportedConsecutiveThreshold,
		)
		if err == nil {
			return count, escalate
		}
		common.SysError(fmt.Sprintf("Codex governance probe failed to persist failure state for %s on channel #%d: %v", modelName, channelID, err))
		return 0, false
	}
	return recordCodexGovernanceProbeUnsupportedMatchInMemory(modelName, channelID)
}

func recordCodexGovernanceProbeUnsupportedMatchInMemory(modelName string, channelID int) (int, bool) {
	key := codexGovernanceProbeFailureKey{ModelName: modelName, ChannelID: channelID}
	codexGovernanceProbeFailureMu.Lock()
	defer codexGovernanceProbeFailureMu.Unlock()

	count := codexGovernanceProbeFailures[key] + 1
	if count > codexGovernanceProbeUnsupportedConsecutiveThreshold {
		count = codexGovernanceProbeUnsupportedConsecutiveThreshold
	}
	codexGovernanceProbeFailures[key] = count
	return count, count >= codexGovernanceProbeUnsupportedConsecutiveThreshold
}

func resetCodexGovernanceProbeFailure(modelName string, channelID int) {
	modelName = strings.TrimSpace(modelName)
	if modelName == "" || channelID <= 0 {
		return
	}
	if model.DB != nil {
		if err := model.ResetCodexModelGovernanceProbeFailure(modelName, channelID); err != nil {
			common.SysError(fmt.Sprintf("Codex governance probe failed to reset persisted failure state for %s on channel #%d: %v", modelName, channelID, err))
		}
	}
	key := codexGovernanceProbeFailureKey{ModelName: modelName, ChannelID: channelID}
	codexGovernanceProbeFailureMu.Lock()
	delete(codexGovernanceProbeFailures, key)
	codexGovernanceProbeFailureMu.Unlock()
}

func resetCodexGovernanceProbeFailuresAfterPending(probedModelName string, matchedModelName string, channelID int) {
	probedModelName = strings.TrimSpace(probedModelName)
	matchedModelName = strings.TrimSpace(matchedModelName)
	resetCodexGovernanceProbeFailure(probedModelName, channelID)
	if matchedModelName != "" && matchedModelName != probedModelName {
		resetCodexGovernanceProbeFailure(matchedModelName, channelID)
	}
}

func codexGovernanceProbeUnsupportedFinding(modelName string, channelID int, match service.CodexUnsupportedMatch, message string) service.CodexModelUnsupportedFinding {
	return service.CodexModelUnsupportedFinding{
		ModelName:          strings.TrimSpace(modelName),
		Source:             model.CodexModelGovernanceSourceProbe,
		MatchedRule:        strings.TrimSpace(match.Pattern),
		LastError:          strings.TrimSpace(message),
		AffectedChannelIDs: []int{channelID},
	}
}

func collectConfiguredCodexModelNames() ([]string, error) {
	channels, err := model.GetAllChannelsByType(constant.ChannelTypeCodex, true)
	if err != nil {
		return nil, err
	}
	seen := make(map[string]struct{})
	modelNames := make([]string, 0)
	for _, channel := range channels {
		for _, modelName := range channel.GetModels() {
			modelName = strings.TrimSpace(modelName)
			if modelName == "" {
				continue
			}
			if _, ok := seen[modelName]; ok {
				continue
			}
			seen[modelName] = struct{}{}
			modelNames = append(modelNames, modelName)
		}
	}
	return modelNames, nil
}

func runCodexModelGovernanceProbeOnce() {
	runCodexModelGovernanceProbeOnceWithContext(context.Background())
}

func runCodexModelGovernanceProbeOnceWithContext(ctx context.Context) {
	setting := operation_setting.GetCodexModelGovernanceSetting()
	if !codexGovernanceProbeSettingEnabled(ctx, setting) {
		return
	}
	testUserID, err := resolveChannelTestUserID(nil)
	if err != nil {
		common.SysError("Codex governance probe cannot resolve test user: " + err.Error())
		return
	}
	channels, err := model.GetAllChannelsByType(constant.ChannelTypeCodex, true)
	if err != nil {
		common.SysError("Codex governance probe cannot load Codex channels: " + err.Error())
		return
	}
	for _, channel := range channels {
		if !codexGovernanceProbeShouldContinue(ctx) {
			return
		}
		if channel.Status != common.ChannelStatusEnabled {
			continue
		}
		for _, modelName := range channel.GetModels() {
			setting = operation_setting.GetCodexModelGovernanceSetting()
			if !codexGovernanceProbeSettingEnabled(ctx, setting) {
				return
			}
			modelName = strings.TrimSpace(modelName)
			if modelName == "" {
				continue
			}
			probeCtx, cancelProbe := codexGovernanceProbeRequestContext(ctx)
			result := testChannelWithOptions(channel, testUserID, modelName, string(constant.EndpointTypeOpenAIResponse), true, channelTestOptions{
				Prompt:     codexGovernanceProbePrompt,
				ExpectPong: true,
				TokenName:  "Codex model governance probe",
				LogContent: "Codex model governance probe",
				MaxTokens:  8,
				SkipLog:    true,
				Context:    probeCtx,
			})
			cancelProbe()
			if !codexGovernanceProbeShouldContinue(ctx) {
				return
			}
			if result.localErr == nil && result.newAPIError == nil {
				resetCodexGovernanceProbeFailure(modelName, channel.Id)
				if err := model.RestoreCodexModelGovernanceAfterProbeSuccess(modelName, channel.Id); err != nil {
					common.SysError(fmt.Sprintf("Codex governance probe failed to restore healthy model %s on channel #%d: %v", modelName, channel.Id, err))
				}
				continue
			}
			message := codexGovernanceProbeErrorMessage(result)
			match := classifyCodexGovernanceProbeError(message, setting.UnsupportedMessagePatterns)
			if !match.Matched {
				resetCodexGovernanceProbeFailure(modelName, channel.Id)
				continue
			}
			matchedModel := strings.TrimSpace(match.ModelName)
			if matchedModel == "" {
				matchedModel = modelName
			}
			count, shouldDisable := recordCodexGovernanceProbeUnsupportedMatch(modelName, channel.Id)
			if !shouldDisable {
				common.SysLog(fmt.Sprintf(
					"Codex governance probe matched unsupported model %s on channel #%d (%d/%d); waiting for consecutive confirmation before disabling",
					matchedModel,
					channel.Id,
					count,
					codexGovernanceProbeUnsupportedConsecutiveThreshold,
				))
				continue
			}
			finding := codexGovernanceProbeUnsupportedFinding(modelName, channel.Id, match, message)
			if _, err := service.MoveCodexModelToPendingReview(finding); err != nil {
				common.SysError(fmt.Sprintf("Codex governance probe failed to mark configured model %s pending after matching %s: %v", finding.ModelName, matchedModel, err))
			} else {
				resetCodexGovernanceProbeFailuresAfterPending(modelName, matchedModel, channel.Id)
			}
		}
	}
}

func sleepCodexGovernanceTask(ctx context.Context, duration time.Duration) bool {
	if duration <= 0 {
		return true
	}
	if ctx == nil {
		time.Sleep(duration)
		return true
	}
	timer := time.NewTimer(duration)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return false
	case <-timer.C:
		return true
	}
}

func codexGovernanceProbeErrorMessage(result testResult) string {
	if result.localErr != nil {
		return result.localErr.Error()
	}
	if result.newAPIError != nil {
		return result.newAPIError.Error()
	}
	return ""
}

func runCodexOfficialNoticeMonitorOnce() {
	setting := operation_setting.GetCodexModelGovernanceSetting()
	if setting == nil || !setting.Enabled || len(setting.OfficialSourceURLs) == 0 {
		return
	}
	modelNames, err := collectConfiguredCodexModelNames()
	if err != nil {
		common.SysError("Codex official notice monitor cannot load Codex channel models: " + err.Error())
		return
	}
	if len(modelNames) == 0 {
		return
	}
	for _, sourceURL := range setting.OfficialSourceURLs {
		body, err := service.FetchCodexOfficialSource(sourceURL)
		if err != nil {
			common.SysError("Codex official notice monitor cannot fetch source: " + err.Error())
			continue
		}
		findings, usedAI, err := service.ExtractCodexOfficialNoticeFindingsWithOptionalAIWithOptions(
			body,
			modelNames,
			setting.OfficialLifecycleTerms,
			sourceURL,
			service.CodexOfficialNoticeAIOptions{
				APIKey:  operation_setting.GetMonitorAIAnalysisAPIKey(),
				BaseURL: operation_setting.GetMonitorAIAnalysisBaseURL(),
				Model:   operation_setting.GetMonitorAIAnalysisModel(),
			},
		)
		if usedAI && err != nil {
			common.SysError(fmt.Sprintf("Codex official notice AI analysis failed, downgraded to keyword rules and applied %d finding(s): %v", len(findings), err))
		}
		for _, finding := range findings {
			if _, err := service.MoveCodexModelToPendingReview(finding); err != nil {
				common.SysError(fmt.Sprintf("Codex official notice monitor failed to mark %s pending: %v", finding.ModelName, err))
			}
		}
	}
}

func StartCodexModelGovernanceTask() {
	if !common.IsMasterNode {
		return
	}
	codexModelGovernanceTaskOnce.Do(func() {
		ctx := context.Background()
		gopool.Go(func() {
			for {
				if codexGovernanceContextDone(ctx) {
					return
				}
				setting := operation_setting.GetCodexModelGovernanceSetting()
				if setting != nil && setting.Enabled {
					startedAt := time.Now()
					nextRun := startedAt.Add(codexGovernanceProbeInterval(setting))
					runCodexModelGovernanceProbeOnceWithContext(ctx)
					runCodexOfficialNoticeMonitorOnce()
					if !sleepCodexGovernanceTask(ctx, codexGovernanceTaskWaitDuration(time.Now(), nextRun, true)) {
						return
					}
					continue
				}
				if !sleepCodexGovernanceTask(ctx, codexGovernanceTaskSleepDuration(setting)) {
					return
				}
			}
		})
	})
}
