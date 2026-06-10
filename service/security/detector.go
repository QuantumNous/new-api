package security

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"golang.org/x/sync/errgroup"
)

// DetectionResult 检测结果
type DetectionResult struct {
	Detected         bool
	Action           int
	RiskScore        int
	RiskLevel        int
	ProcessedContent string
	Matches          []*dto.SecurityMatchResult
	EngineResults    map[string]*EngineResult
}

// EngineResult 单个引擎检测结果
type EngineResult struct {
	EngineName string
	Detected   bool
	Matches    []*dto.SecurityMatchResult
	RiskScore  int
	Error      error
}

// ContentDetector 内容检测器接口
type ContentDetector interface {
	Name() string
	Detect(content string, rules []*model.SecurityRule) (*EngineResult, error)
}

// DetectionEngine 检测引擎
type DetectionEngine struct {
	detectors []ContentDetector
}

var (
	detectionEngine     *DetectionEngine
	detectionEngineOnce sync.Once
)

// GetDetectionEngine 获取检测引擎单例
func GetDetectionEngine() *DetectionEngine {
	detectionEngineOnce.Do(func() {
		detectionEngine = &DetectionEngine{
			detectors: []ContentDetector{
				&KeywordDetector{},
				&RegexDetector{},
				&NERDetector{},
				&AIDetector{},
			},
		}
	})
	return detectionEngine
}

// Detect 执行内容检测
func (de *DetectionEngine) Detect(ctx context.Context, userID int, content string, contentType int, modelName string) (*DetectionResult, error) {
	result := &DetectionResult{
		Detected:      false,
		Action:        constant.SecurityActionPass,
		RiskScore:     0,
		EngineResults: make(map[string]*EngineResult),
		Matches:       make([]*dto.SecurityMatchResult, 0),
	}

	if !IsSecurityEnabled() {
		return result, nil
	}

	// 获取用户策略
	policies, err := GetUserPolicies(userID)
	if err != nil {
		common.SysLog("获取用户安全策略失败: " + err.Error())
		return result, nil
	}

	if len(policies) == 0 {
		return result, nil
	}

	// 过滤生效范围并去重
	var effectiveGroupIds []int64
	seen := make(map[int64]bool)
	for _, policy := range policies {
		if contentType == constant.SecurityContentTypeRequest && policy.Scope == constant.SecurityScopeResponseOnly {
			continue
		}
		if contentType == constant.SecurityContentTypeResponse && policy.Scope == constant.SecurityScopeRequestOnly {
			continue
		}
		if !seen[policy.GroupID] {
			seen[policy.GroupID] = true
			effectiveGroupIds = append(effectiveGroupIds, policy.GroupID)
		}
	}

	if len(effectiveGroupIds) == 0 {
		return result, nil
	}

	// 获取规则（优先从缓存）
	rules, err := GetCachedRulesByGroupIds(effectiveGroupIds)
	if err != nil {
		common.SysLog("获取安全规则失败: " + err.Error())
		return result, nil
	}

	if len(rules) == 0 {
		return result, nil
	}

	// 并行执行本地检测引擎
	var mu sync.Mutex
	var detected bool
	var maxRiskScore int
	var allMatches []*dto.SecurityMatchResult

	g, ctx := errgroup.WithContext(ctx)

	// Keyword 和 Regex 并行执行
	for _, detector := range de.detectors[:2] {
		d := detector
		g.Go(func() error {
			engineResult, err := d.Detect(content, rules)
			if err != nil {
				common.SysLog(fmt.Sprintf("检测引擎 %s 错误: %v", d.Name(), err))
				return nil
			}
			mu.Lock()
			defer mu.Unlock()
			result.EngineResults[d.Name()] = engineResult
			if engineResult.Detected {
				detected = true
				if engineResult.RiskScore > maxRiskScore {
					maxRiskScore = engineResult.RiskScore
				}
				allMatches = append(allMatches, engineResult.Matches...)
			}
			return nil
		})
	}

	_ = g.Wait()

	// NER 检测
	if nerDetector, ok := de.detectors[2].(*NERDetector); ok {
		engineResult, err := nerDetector.Detect(content, rules)
		if err == nil && engineResult.Detected {
			result.EngineResults[nerDetector.Name()] = engineResult
			detected = true
			if engineResult.RiskScore > maxRiskScore {
				maxRiskScore = engineResult.RiskScore
			}
			allMatches = append(allMatches, engineResult.Matches...)
		}
	}

	// AI 检测（异步，带超时）
	aiCtx, cancel := context.WithTimeout(ctx, time.Duration(constant.SecurityAITimeoutSeconds)*time.Second)
	defer cancel()

	if aiDetector, ok := de.detectors[3].(*AIDetector); ok {
		aiResult, err := aiDetector.DetectWithContext(aiCtx, content, rules)
		if err == nil && aiResult.Detected {
			result.EngineResults[aiDetector.Name()] = aiResult
			detected = true
			if aiResult.RiskScore > maxRiskScore {
				maxRiskScore = aiResult.RiskScore
			}
			allMatches = append(allMatches, aiResult.Matches...)
		} else if err != nil {
			common.SysLog("AI 检测超时或失败，降级到本地规则: " + err.Error())
		}
	}

	result.Detected = detected
	result.RiskScore = maxRiskScore
	result.RiskLevel = constant.GetSecurityRiskLevelByScore(maxRiskScore)
	result.Matches = allMatches

	if detected {
		// 计算最终动作（取最高优先级）
		result.Action = resolveAction(allMatches, rules)
		// 执行脱敏
		if result.Action == constant.SecurityActionMask {
			result.ProcessedContent = applyMasking(content, allMatches, rules)
		}
	}

	// 异步记录日志
	go recordHitLog(userID, content, result, contentType, modelName)

	return result, nil
}

// resolveAction 根据匹配结果解析最终动作（取最高优先级）
func resolveAction(matches []*dto.SecurityMatchResult, rules []*model.SecurityRule) int {
	if len(matches) == 0 {
		return constant.SecurityActionPass
	}

	// 构建规则 ID -> 动作的映射
	ruleActionMap := make(map[int64]int)
	for _, rule := range rules {
		ruleActionMap[rule.ID] = rule.Action
	}

	maxPriority := constant.SecurityActionPriorityPass
	finalAction := constant.SecurityActionPass

	for _, match := range matches {
		if action, ok := ruleActionMap[match.RuleID]; ok {
			priority := constant.GetSecurityActionPriority(action)
			if priority > maxPriority {
				maxPriority = priority
				finalAction = action
			}
		}
	}

	return finalAction
}

// applyMasking 应用脱敏处理
func applyMasking(content string, matches []*dto.SecurityMatchResult, rules []*model.SecurityRule) string {
	// 按位置排序（从后往前替换，避免位置偏移）
	sortedMatches := make([]*dto.SecurityMatchResult, len(matches))
	copy(sortedMatches, matches)
	for i, j := 0, len(sortedMatches)-1; i < j; i, j = i+1, j-1 {
		sortedMatches[i], sortedMatches[j] = sortedMatches[j], sortedMatches[i]
	}

	result := content
	for _, match := range sortedMatches {
		if match.Position[1] <= match.Position[0] {
			continue
		}
		if match.Position[0] < 0 || match.Position[1] > len(result) {
			continue
		}
		masked := maskText(result[match.Position[0]:match.Position[1]])
		result = result[:match.Position[0]] + masked + result[match.Position[1]:]
	}

	return result
}

// maskText 对文本进行脱敏处理（默认：保留首尾，中间替换为 *）
func maskText(text string) string {
	if len(text) <= 2 {
		return strings.Repeat("*", len(text))
	}
	return text[:1] + strings.Repeat("*", len(text)-2) + text[len(text)-1:]
}

// recordHitLog 记录命中日志
func recordHitLog(userID int, originalContent string, result *DetectionResult, contentType int, modelName string) {
	defer func() {
		if r := recover(); r != nil {
			common.SysLog(fmt.Sprintf("记录安全日志 panic: %v", r))
		}
	}()

	hash := sha256.Sum256([]byte(originalContent))
	hashStr := hex.EncodeToString(hash[:])

	var processedContent string
	if result.Action == constant.SecurityActionMask {
		processedContent = result.ProcessedContent
	}

	var ruleID, groupID int64
	if len(result.Matches) > 0 {
		ruleID = result.Matches[0].RuleID
		groupID = result.Matches[0].GroupID
	}

	log := &model.SecurityHitLog{
		RequestID:           generateRequestID(),
		UserID:              userID,
		ChannelID:           0,
		ModelName:           modelName,
		TokenID:             0,
		RuleID:              ruleID,
		GroupID:             groupID,
		ContentType:         contentType,
		Action:              result.Action,
		RiskLevel:           result.RiskLevel,
		RiskScore:           result.RiskScore,
		OriginalContentHash: hashStr,
		ProcessedContent:    processedContent,
		CreatedAt:           time.Now().Unix(),
	}

	err := model.DB.Create(log).Error
	if err != nil {
		common.SysLog("记录安全日志失败: " + err.Error())
	}
}

func generateRequestID() string {
	return fmt.Sprintf("sec-%d-%d", time.Now().UnixNano(), common.GetRandomInt(10000))
}
