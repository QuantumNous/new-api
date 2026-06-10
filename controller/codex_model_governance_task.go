package controller

import (
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

const codexGovernanceProbePrompt = "ping"

var codexModelGovernanceTaskOnce sync.Once

func codexGovernanceProbeInterval(setting *operation_setting.CodexModelGovernanceSetting) time.Duration {
	if setting == nil || setting.ProbeIntervalMinutes < 60 {
		return time.Hour
	}
	return time.Duration(setting.ProbeIntervalMinutes) * time.Minute
}

func classifyCodexGovernanceProbeError(message string, patterns []string) service.CodexUnsupportedMatch {
	return service.ClassifyCodexUnsupportedMessage(message, patterns)
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
	setting := operation_setting.GetCodexModelGovernanceSetting()
	if setting == nil || !setting.Enabled || !setting.ProbeEnabled {
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
		if channel.Status != common.ChannelStatusEnabled {
			continue
		}
		for _, modelName := range channel.GetModels() {
			modelName = strings.TrimSpace(modelName)
			if modelName == "" {
				continue
			}
			result := testChannelWithOptions(channel, testUserID, modelName, string(constant.EndpointTypeOpenAIResponse), true, channelTestOptions{
				Prompt:     codexGovernanceProbePrompt,
				ExpectPong: true,
				TokenName:  "Codex model governance probe",
				LogContent: "Codex model governance probe",
				MaxTokens:  8,
				SkipLog:    true,
			})
			if result.localErr == nil && result.newAPIError == nil {
				continue
			}
			message := codexGovernanceProbeErrorMessage(result)
			match := classifyCodexGovernanceProbeError(message, setting.UnsupportedMessagePatterns)
			if !match.Matched {
				continue
			}
			matchedModel := strings.TrimSpace(match.ModelName)
			if matchedModel == "" {
				matchedModel = modelName
			}
			if _, err := service.MoveCodexModelToPendingReview(service.CodexModelUnsupportedFinding{
				ModelName:          matchedModel,
				Source:             model.CodexModelGovernanceSourceProbe,
				MatchedRule:        match.Pattern,
				LastError:          message,
				AffectedChannelIDs: []int{channel.Id},
			}); err != nil {
				common.SysError(fmt.Sprintf("Codex governance probe failed to mark %s pending: %v", matchedModel, err))
			}
		}
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
		findings := service.ExtractCodexOfficialNoticeFindings(body, modelNames, setting.OfficialLifecycleTerms)
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
		gopool.Go(func() {
			for {
				setting := operation_setting.GetCodexModelGovernanceSetting()
				interval := codexGovernanceProbeInterval(setting)
				if setting != nil && setting.Enabled {
					runCodexModelGovernanceProbeOnce()
					runCodexOfficialNoticeMonitorOnce()
				}
				time.Sleep(interval)
			}
		})
	})
}
