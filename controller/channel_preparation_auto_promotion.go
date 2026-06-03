package controller

import (
	"fmt"
	"io"
	"math"
	"math/rand"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
)

const channelPreparationAutoPromotionTriggerManual = "manual"
const channelPreparationAutoPromotionTriggerScheduler = "scheduler"

const (
	channelPreparationAutoPromotionShortageCount    = "count"
	channelPreparationAutoPromotionShortageCapacity = "capacity"
)

type channelPreparationAutoPromotionRunRequest struct {
	RuleId string `json:"rule_id"`
}

type channelPreparationAutoPromotionCapacitySummary struct {
	EligibleChannelCount                  int64   `json:"eligible_channel_count"`
	UsableChannelCount                    int64   `json:"usable_channel_count"`
	IgnoredNonPositiveBalanceChannelCount int64   `json:"ignored_non_positive_balance_channel_count"`
	BalanceSumUSD                         float64 `json:"balance_sum_usd"`
	UsedQuotaUSD                          float64 `json:"used_quota_usd"`
	EffectiveCapacityUSD                  float64 `json:"effective_capacity_usd"`
	RawEffectiveCapacityUSD               float64 `json:"raw_effective_capacity_usd"`
}

type channelPreparationAutoPromotionStep struct {
	PreparationId            int     `json:"preparation_id"`
	ChannelId                int     `json:"channel_id"`
	CandidateBalanceUSD      float64 `json:"candidate_balance_usd"`
	CapacityBeforeUSD        float64 `json:"capacity_before_usd"`
	CapacityAfterUSD         float64 `json:"capacity_after_usd"`
	ShortageType             string  `json:"shortage_type"`
	Strategy                 string  `json:"strategy"`
	UsableCountBefore        int64   `json:"usable_count_before"`
	UsableCountAfter         int64   `json:"usable_count_after"`
	CountDeficitBefore       int64   `json:"count_deficit_before"`
	CountDeficitAfter        int64   `json:"count_deficit_after"`
	CapacityDeficitBeforeUSD float64 `json:"capacity_deficit_before_usd"`
	CapacityDeficitAfterUSD  float64 `json:"capacity_deficit_after_usd"`
}

type channelPreparationAutoPromotionRuleSummary struct {
	Trigger                   string                                         `json:"trigger"`
	RuleId                    string                                         `json:"rule_id"`
	Group                     string                                         `json:"group"`
	Type                      int                                            `json:"type"`
	Strategy                  string                                         `json:"strategy"`
	ThresholdUSD              float64                                        `json:"threshold_usd"`
	MinimumUsableChannelCount int                                            `json:"minimum_usable_channel_count"`
	GuaranteePriority         string                                         `json:"guarantee_priority"`
	CountShortageStrategy     string                                         `json:"count_shortage_strategy"`
	CapacityShortageStrategy  string                                         `json:"capacity_shortage_strategy"`
	InitialCapacity           channelPreparationAutoPromotionCapacitySummary `json:"initial_capacity"`
	FinalCapacity             channelPreparationAutoPromotionCapacitySummary `json:"final_capacity"`
	Promotions                []channelPreparationAutoPromotionStep          `json:"promotions"`
	Failures                  []string                                       `json:"failures"`
	SkippedReason             string                                         `json:"skipped_reason,omitempty"`
	RemainingDeficitUSD       float64                                        `json:"remaining_deficit_usd"`
	CountDeficit              int64                                          `json:"count_deficit"`
	CapacityDeficitUSD        float64                                        `json:"capacity_deficit_usd"`
	LimitReached              bool                                           `json:"limit_reached"`
}

type channelPreparationAutoPromotionRunSummary struct {
	Trigger       string                                       `json:"trigger"`
	RuleId        string                                       `json:"rule_id,omitempty"`
	StartedAt     int64                                        `json:"started_at"`
	FinishedAt    int64                                        `json:"finished_at"`
	MaxPromotions int                                          `json:"max_promotions"`
	TotalPromoted int                                          `json:"total_promoted"`
	LimitReached  bool                                         `json:"limit_reached"`
	Rules         []channelPreparationAutoPromotionRuleSummary `json:"rules"`
	SkippedReason string                                       `json:"skipped_reason,omitempty"`
}

type channelPreparationAutoPromotionSchedulerStatus struct {
	SchedulerEnabled bool    `json:"scheduler_enabled"`
	IntervalMinutes  float64 `json:"interval_minutes"`
	NextCheckAt      int64   `json:"next_check_at"`
	LastCheckAt      int64   `json:"last_check_at"`
	LastFinishedAt   int64   `json:"last_finished_at"`
	LastPromoted     int     `json:"last_promoted"`
	Running          bool    `json:"running"`
	IsMasterNode     bool    `json:"is_master_node"`
	ServerTimestamp  int64   `json:"server_timestamp"`
}

type channelPreparationAutoPromotionCapacityAggregate struct {
	EligibleChannelCount int64   `gorm:"column:eligible_channel_count"`
	BalanceSumUSD        float64 `gorm:"column:balance_sum_usd"`
	UsedQuotaSum         int64   `gorm:"column:used_quota_sum"`
}

var (
	channelPreparationAutoPromotionRunMutex       sync.Mutex
	channelPreparationAutoPromotionTaskOnce       sync.Once
	channelPreparationAutoPromotionStatusMutex    sync.RWMutex
	channelPreparationAutoPromotionStatusSnapshot channelPreparationAutoPromotionSchedulerStatus
)

func updateChannelPreparationAutoPromotionSchedulerStatus(update func(*channelPreparationAutoPromotionSchedulerStatus)) {
	channelPreparationAutoPromotionStatusMutex.Lock()
	defer channelPreparationAutoPromotionStatusMutex.Unlock()
	update(&channelPreparationAutoPromotionStatusSnapshot)
}

func getChannelPreparationAutoPromotionSchedulerStatus() channelPreparationAutoPromotionSchedulerStatus {
	channelPreparationAutoPromotionStatusMutex.RLock()
	status := channelPreparationAutoPromotionStatusSnapshot
	channelPreparationAutoPromotionStatusMutex.RUnlock()

	setting := operation_setting.GetChannelPreparationAutoPromotionSetting()
	status.SchedulerEnabled = setting.SchedulerEnabled
	status.IntervalMinutes = setting.IntervalMinutes
	status.IsMasterNode = common.IsMasterNode
	status.ServerTimestamp = common.GetTimestamp()
	if !setting.SchedulerEnabled && !status.Running {
		status.NextCheckAt = 0
	}
	if setting.SchedulerEnabled && common.IsMasterNode && !status.Running && status.NextCheckAt == 0 {
		intervalMinutes := int(math.Round(setting.IntervalMinutes))
		if intervalMinutes <= 0 {
			intervalMinutes = 10
		}
		status.NextCheckAt = time.Now().Add(time.Duration(intervalMinutes) * time.Minute).Unix()
	}
	return status
}

func GetChannelPreparationAutoPromotionSchedulerStatus(c *gin.Context) {
	common.ApiSuccess(c, getChannelPreparationAutoPromotionSchedulerStatus())
}

func normalizeAutoPromotionDeficit(threshold float64, capacity float64) float64 {
	deficit := threshold - capacity
	if deficit < 0 {
		return 0
	}
	return deficit
}

func channelPreparationAutoPromotionCountDeficit(minimum int, usable int64) int64 {
	if minimum <= 0 {
		return 0
	}
	deficit := int64(minimum) - usable
	if deficit < 0 {
		return 0
	}
	return deficit
}

func chooseChannelPreparationAutoPromotionActiveShortage(rule operation_setting.ChannelPreparationAutoPromotionRule, countShort bool, capacityShort bool) string {
	if countShort && capacityShort {
		if rule.GuaranteePriority == operation_setting.ChannelPreparationAutoPromotionGuaranteePriorityCountFirst {
			return channelPreparationAutoPromotionShortageCount
		}
		return channelPreparationAutoPromotionShortageCapacity
	}
	if countShort {
		return channelPreparationAutoPromotionShortageCount
	}
	if capacityShort {
		return channelPreparationAutoPromotionShortageCapacity
	}
	return ""
}

func channelPreparationAutoPromotionStrategyForShortage(rule operation_setting.ChannelPreparationAutoPromotionRule, shortageType string) string {
	if shortageType == channelPreparationAutoPromotionShortageCount {
		return rule.CountShortageStrategy
	}
	return rule.CapacityShortageStrategy
}

func safeQuotaToUSD(usedQuota int64) float64 {
	if common.QuotaPerUnit <= 0 {
		return 0
	}
	return float64(usedQuota) / common.QuotaPerUnit
}

func computeChannelPreparationAutoPromotionCapacity(group string, channelType int) (channelPreparationAutoPromotionCapacitySummary, error) {
	query := model.DB.Model(&model.Channel{})
	query = model.ApplyChannelGroupFilter(query, group)
	query = query.Where("status = ?", common.ChannelStatusEnabled).
		Where("type = ?", channelType).
		Where("balance > ?", 0)

	var aggregate channelPreparationAutoPromotionCapacityAggregate
	if err := query.Select("COUNT(*) AS eligible_channel_count, COALESCE(SUM(balance), 0) AS balance_sum_usd, COALESCE(SUM(used_quota), 0) AS used_quota_sum").Scan(&aggregate).Error; err != nil {
		return channelPreparationAutoPromotionCapacitySummary{}, err
	}

	ignoredQuery := model.DB.Model(&model.Channel{})
	ignoredQuery = model.ApplyChannelGroupFilter(ignoredQuery, group)
	ignoredQuery = ignoredQuery.Where("status = ?", common.ChannelStatusEnabled).
		Where("type = ?", channelType).
		Where("balance <= ?", 0)
	var ignoredCount int64
	if err := ignoredQuery.Count(&ignoredCount).Error; err != nil {
		return channelPreparationAutoPromotionCapacitySummary{}, err
	}

	usedQuotaUSD := safeQuotaToUSD(aggregate.UsedQuotaSum)
	rawCapacity := aggregate.BalanceSumUSD - usedQuotaUSD
	capacity := rawCapacity
	if capacity < 0 {
		capacity = 0
	}
	return channelPreparationAutoPromotionCapacitySummary{
		EligibleChannelCount:                  aggregate.EligibleChannelCount,
		UsableChannelCount:                    aggregate.EligibleChannelCount,
		IgnoredNonPositiveBalanceChannelCount: ignoredCount,
		BalanceSumUSD:                         aggregate.BalanceSumUSD,
		UsedQuotaUSD:                          usedQuotaUSD,
		EffectiveCapacityUSD:                  capacity,
		RawEffectiveCapacityUSD:               rawCapacity,
	}, nil
}

func loadChannelPreparationAutoPromotionCandidates(group string, channelType int, excludedIds map[int]bool) ([]model.ChannelPreparation, error) {
	query := model.DB.Model(&model.ChannelPreparation{})
	query = model.ApplyChannelGroupFilter(query, group)
	query = query.Where("status = ?", model.ChannelPreparationStatusPending).
		Where("type = ?", channelType).
		Where("balance > ?", 0)
	if len(excludedIds) > 0 {
		ids := make([]int, 0, len(excludedIds))
		for id := range excludedIds {
			ids = append(ids, id)
		}
		query = query.Where("id NOT IN ?", ids)
	}

	var preparations []model.ChannelPreparation
	if err := query.Order("priority DESC, id ASC").Find(&preparations).Error; err != nil {
		return nil, err
	}
	return preparations, nil
}

func preparationPriority(preparation model.ChannelPreparation) int64 {
	if preparation.Priority == nil {
		return 0
	}
	return *preparation.Priority
}

func preparationWeight(preparation model.ChannelPreparation) int64 {
	weight := int64(0)
	if preparation.Weight != nil {
		weight = int64(*preparation.Weight)
	}
	return weight + 10
}

func channelPreparationAutoPromotionHighestPriorityTier(preparations []model.ChannelPreparation) []model.ChannelPreparation {
	if len(preparations) == 0 {
		return nil
	}
	sortedPreparations := append([]model.ChannelPreparation(nil), preparations...)
	sort.SliceStable(sortedPreparations, func(i, j int) bool {
		pi := preparationPriority(sortedPreparations[i])
		pj := preparationPriority(sortedPreparations[j])
		if pi == pj {
			return sortedPreparations[i].Id < sortedPreparations[j].Id
		}
		return pi > pj
	})
	topPriority := preparationPriority(sortedPreparations[0])
	tier := make([]model.ChannelPreparation, 0)
	for _, preparation := range sortedPreparations {
		if preparationPriority(preparation) != topPriority {
			break
		}
		tier = append(tier, preparation)
	}
	return tier
}

func chooseChannelPreparationAutoPromotionWeightedCandidate(tier []model.ChannelPreparation, rng *rand.Rand) (model.ChannelPreparation, bool) {
	if len(tier) == 0 {
		return model.ChannelPreparation{}, false
	}
	if len(tier) == 1 {
		return tier[0], true
	}
	totalWeight := int64(0)
	for _, preparation := range tier {
		weight := preparationWeight(preparation)
		if weight > 0 {
			totalWeight += weight
		}
	}
	if totalWeight <= 0 {
		return tier[0], true
	}
	if rng == nil {
		rng = rand.New(rand.NewSource(time.Now().UnixNano()))
	}
	pick := rng.Int63n(totalWeight)
	for _, preparation := range tier {
		weight := preparationWeight(preparation)
		if weight <= 0 {
			continue
		}
		if pick < weight {
			return preparation, true
		}
		pick -= weight
	}
	return tier[len(tier)-1], true
}

func chooseChannelPreparationAutoPromotionCandidate(preparations []model.ChannelPreparation, strategy string, rng *rand.Rand) (model.ChannelPreparation, bool) {
	tier := channelPreparationAutoPromotionHighestPriorityTier(preparations)
	if len(tier) == 0 {
		return model.ChannelPreparation{}, false
	}

	switch strategy {
	case operation_setting.ChannelPreparationAutoPromotionStrategySmallBalanceFirst:
		sort.SliceStable(tier, func(i, j int) bool {
			if tier[i].Balance == tier[j].Balance {
				return tier[i].Id < tier[j].Id
			}
			return tier[i].Balance < tier[j].Balance
		})
		return tier[0], true
	case operation_setting.ChannelPreparationAutoPromotionStrategyLargeBalanceFirst:
		sort.SliceStable(tier, func(i, j int) bool {
			if tier[i].Balance == tier[j].Balance {
				return tier[i].Id < tier[j].Id
			}
			return tier[i].Balance > tier[j].Balance
		})
		return tier[0], true
	case operation_setting.ChannelPreparationAutoPromotionStrategyPriorityWeighted:
		fallthrough
	default:
		return chooseChannelPreparationAutoPromotionWeightedCandidate(tier, rng)
	}
}

func normalizeChannelPreparationAutoPromotionRules(rules []operation_setting.ChannelPreparationAutoPromotionRule) []operation_setting.ChannelPreparationAutoPromotionRule {
	normalized := make([]operation_setting.ChannelPreparationAutoPromotionRule, 0, len(rules))
	for _, rule := range rules {
		operation_setting.NormalizeChannelPreparationAutoPromotionRule(&rule)
		normalized = append(normalized, rule)
	}
	return normalized
}

func recordChannelPreparationAutoPromotionManageLog(adminUserId *int, content string, channelId int, group string, adminInfo map[string]interface{}) {
	logUserId := 0
	actor := "system"
	if adminUserId != nil && *adminUserId > 0 {
		logUserId = *adminUserId
		actor = "admin"
	}

	enrichedInfo := make(map[string]interface{}, len(adminInfo)+5)
	for key, value := range adminInfo {
		enrichedInfo[key] = value
	}
	enrichedInfo["event"] = "channel_preparation_auto_promotion"
	enrichedInfo["actor"] = actor
	enrichedInfo["node_name"] = common.NodeName
	enrichedInfo["server_ip"] = common.GetIp()
	enrichedInfo["version"] = common.Version

	model.RecordLogWithAdminInfoAndMetadata(logUserId, model.LogTypeManage, content, channelId, group, enrichedInfo)
}

func runChannelPreparationAutoPromotionLocked(trigger string, optionalRuleId string, adminUserId *int) (channelPreparationAutoPromotionRunSummary, error) {
	settingSnapshot := *operation_setting.GetChannelPreparationAutoPromotionSetting()
	settingSnapshot.Rules = normalizeChannelPreparationAutoPromotionRules(settingSnapshot.Rules)
	maxPromotions := settingSnapshot.MaxPromotionsPerRun
	if maxPromotions <= 0 {
		maxPromotions = 10
	}

	summary := channelPreparationAutoPromotionRunSummary{
		Trigger:       trigger,
		RuleId:        strings.TrimSpace(optionalRuleId),
		StartedAt:     common.GetTimestamp(),
		MaxPromotions: maxPromotions,
		Rules:         []channelPreparationAutoPromotionRuleSummary{},
	}

	if len(settingSnapshot.Rules) == 0 {
		summary.SkippedReason = "没有配置自动晋升规则"
		summary.FinishedAt = common.GetTimestamp()
		return summary, nil
	}

	rng := rand.New(rand.NewSource(time.Now().UnixNano()))
	promotedAny := false

	for _, rule := range settingSnapshot.Rules {
		if summary.TotalPromoted >= maxPromotions {
			summary.LimitReached = true
			break
		}
		if summary.RuleId != "" && rule.Id != summary.RuleId {
			continue
		}

		ruleSummary := channelPreparationAutoPromotionRuleSummary{
			Trigger:                   trigger,
			RuleId:                    rule.Id,
			Group:                     rule.Group,
			Type:                      rule.Type,
			Strategy:                  rule.Strategy,
			ThresholdUSD:              rule.ThresholdUSD,
			MinimumUsableChannelCount: rule.MinimumUsableChannelCount,
			GuaranteePriority:         rule.GuaranteePriority,
			CountShortageStrategy:     rule.CountShortageStrategy,
			CapacityShortageStrategy:  rule.CapacityShortageStrategy,
			Promotions:                []channelPreparationAutoPromotionStep{},
			Failures:                  []string{},
		}

		if !rule.Enabled {
			ruleSummary.SkippedReason = "规则未启用"
			summary.Rules = append(summary.Rules, ruleSummary)
			continue
		}
		if strings.TrimSpace(rule.Group) == "" {
			ruleSummary.SkippedReason = "规则分组为空"
			summary.Rules = append(summary.Rules, ruleSummary)
			continue
		}
		if rule.Type <= 0 {
			ruleSummary.SkippedReason = "渠道类型无效"
			summary.Rules = append(summary.Rules, ruleSummary)
			continue
		}
		if rule.ThresholdUSD <= 0 {
			ruleSummary.SkippedReason = "阈值必须大于 0"
			summary.Rules = append(summary.Rules, ruleSummary)
			continue
		}
		if rule.MinimumUsableChannelCount < 0 {
			ruleSummary.SkippedReason = "最低可用渠道数不能小于 0"
			summary.Rules = append(summary.Rules, ruleSummary)
			continue
		}
		if !operation_setting.IsSupportedChannelPreparationAutoPromotionGuaranteePriority(rule.GuaranteePriority) ||
			!operation_setting.IsSupportedChannelPreparationAutoPromotionStrategy(rule.CountShortageStrategy) ||
			!operation_setting.IsSupportedChannelPreparationAutoPromotionStrategy(rule.CapacityShortageStrategy) {
			ruleSummary.SkippedReason = "自动晋升规则配置不支持"
			summary.Rules = append(summary.Rules, ruleSummary)
			continue
		}

		capacity, err := computeChannelPreparationAutoPromotionCapacity(rule.Group, rule.Type)
		if err != nil {
			ruleSummary.Failures = append(ruleSummary.Failures, err.Error())
			summary.Rules = append(summary.Rules, ruleSummary)
			continue
		}
		ruleSummary.InitialCapacity = capacity
		ruleSummary.FinalCapacity = capacity
		ruleSummary.CountDeficit = channelPreparationAutoPromotionCountDeficit(rule.MinimumUsableChannelCount, capacity.UsableChannelCount)
		ruleSummary.CapacityDeficitUSD = normalizeAutoPromotionDeficit(rule.ThresholdUSD, capacity.EffectiveCapacityUSD)
		if ruleSummary.CountDeficit == 0 && ruleSummary.CapacityDeficitUSD == 0 {
			ruleSummary.SkippedReason = "容量和可用渠道数均已达标"
			ruleSummary.RemainingDeficitUSD = 0
			summary.Rules = append(summary.Rules, ruleSummary)
			continue
		}

		failedCandidateIds := make(map[int]bool)
		for summary.TotalPromoted < maxPromotions {
			latestCapacity, err := computeChannelPreparationAutoPromotionCapacity(rule.Group, rule.Type)
			if err != nil {
				ruleSummary.Failures = append(ruleSummary.Failures, err.Error())
				break
			}
			ruleSummary.FinalCapacity = latestCapacity
			countDeficitBefore := channelPreparationAutoPromotionCountDeficit(rule.MinimumUsableChannelCount, latestCapacity.UsableChannelCount)
			capacityDeficitBefore := normalizeAutoPromotionDeficit(rule.ThresholdUSD, latestCapacity.EffectiveCapacityUSD)
			shortageType := chooseChannelPreparationAutoPromotionActiveShortage(rule, countDeficitBefore > 0, capacityDeficitBefore > 0)
			if shortageType == "" {
				break
			}
			strategy := channelPreparationAutoPromotionStrategyForShortage(rule, shortageType)
			if !operation_setting.IsSupportedChannelPreparationAutoPromotionStrategy(strategy) {
				strategy = operation_setting.ChannelPreparationAutoPromotionStrategyPriorityWeighted
			}

			candidates, err := loadChannelPreparationAutoPromotionCandidates(rule.Group, rule.Type, failedCandidateIds)
			if err != nil {
				ruleSummary.Failures = append(ruleSummary.Failures, err.Error())
				break
			}
			candidate, ok := chooseChannelPreparationAutoPromotionCandidate(candidates, strategy, rng)
			if !ok {
				ruleSummary.SkippedReason = "没有余额大于 0 的待晋升候选渠道"
				break
			}

			channelId, err := promoteChannelPreparation(candidate.Id)
			if err != nil {
				failedCandidateIds[candidate.Id] = true
				ruleSummary.Failures = append(ruleSummary.Failures, fmt.Sprintf("候选渠道 %d 晋升失败：%s", candidate.Id, err.Error()))
				continue
			}
			promotedAny = true
			summary.TotalPromoted++
			afterCapacity, capacityErr := computeChannelPreparationAutoPromotionCapacity(rule.Group, rule.Type)
			if capacityErr != nil {
				ruleSummary.Failures = append(ruleSummary.Failures, fmt.Sprintf("候选渠道 %d 晋升后重新计算容量失败：%s", candidate.Id, capacityErr.Error()))
				afterCapacity = latestCapacity
				afterCapacity.EligibleChannelCount++
				afterCapacity.UsableChannelCount++
				afterCapacity.BalanceSumUSD += math.Max(candidate.Balance, 0)
				afterCapacity.RawEffectiveCapacityUSD += math.Max(candidate.Balance, 0)
				afterCapacity.EffectiveCapacityUSD = math.Max(afterCapacity.RawEffectiveCapacityUSD, 0)
			}
			ruleSummary.FinalCapacity = afterCapacity
			countDeficitAfter := channelPreparationAutoPromotionCountDeficit(rule.MinimumUsableChannelCount, afterCapacity.UsableChannelCount)
			capacityDeficitAfter := normalizeAutoPromotionDeficit(rule.ThresholdUSD, afterCapacity.EffectiveCapacityUSD)
			ruleSummary.Promotions = append(ruleSummary.Promotions, channelPreparationAutoPromotionStep{
				PreparationId:            candidate.Id,
				ChannelId:                channelId,
				CandidateBalanceUSD:      candidate.Balance,
				CapacityBeforeUSD:        latestCapacity.EffectiveCapacityUSD,
				CapacityAfterUSD:         afterCapacity.EffectiveCapacityUSD,
				ShortageType:             shortageType,
				Strategy:                 strategy,
				UsableCountBefore:        latestCapacity.UsableChannelCount,
				UsableCountAfter:         afterCapacity.UsableChannelCount,
				CountDeficitBefore:       countDeficitBefore,
				CountDeficitAfter:        countDeficitAfter,
				CapacityDeficitBeforeUSD: capacityDeficitBefore,
				CapacityDeficitAfterUSD:  capacityDeficitAfter,
			})
			logContent := fmt.Sprintf("自动晋升候选渠道：规则=%s 分组=%s 类型=%d 不足=%s 策略=%s 候选ID=%d 渠道ID=%d 余额=%.4f 可用数 %d -> %d 容量 %.4f -> %.4f 缺口(count=%d->%d, capacity=%.4f->%.4f) 触发=%s", rule.Id, rule.Group, rule.Type, shortageType, strategy, candidate.Id, channelId, candidate.Balance, latestCapacity.UsableChannelCount, afterCapacity.UsableChannelCount, latestCapacity.EffectiveCapacityUSD, afterCapacity.EffectiveCapacityUSD, countDeficitBefore, countDeficitAfter, capacityDeficitBefore, capacityDeficitAfter, trigger)
			common.SysLog(logContent)
			recordChannelPreparationAutoPromotionManageLog(adminUserId, logContent, channelId, rule.Group, map[string]interface{}{
				"rule_id":                     rule.Id,
				"group":                       rule.Group,
				"type":                        rule.Type,
				"preparation_id":              candidate.Id,
				"channel_id":                  channelId,
				"candidate_balance":           candidate.Balance,
				"shortage_type":               shortageType,
				"strategy":                    strategy,
				"usable_count_before":         latestCapacity.UsableChannelCount,
				"usable_count_after":          afterCapacity.UsableChannelCount,
				"capacity_before":             latestCapacity.EffectiveCapacityUSD,
				"capacity_after":              afterCapacity.EffectiveCapacityUSD,
				"count_deficit_before":        countDeficitBefore,
				"count_deficit_after":         countDeficitAfter,
				"capacity_deficit_before_usd": capacityDeficitBefore,
				"capacity_deficit_after_usd":  capacityDeficitAfter,
				"trigger":                     trigger,
			})
		}

		ruleSummary.CountDeficit = channelPreparationAutoPromotionCountDeficit(rule.MinimumUsableChannelCount, ruleSummary.FinalCapacity.UsableChannelCount)
		ruleSummary.CapacityDeficitUSD = normalizeAutoPromotionDeficit(rule.ThresholdUSD, ruleSummary.FinalCapacity.EffectiveCapacityUSD)
		if summary.TotalPromoted >= maxPromotions && (ruleSummary.CountDeficit > 0 || ruleSummary.CapacityDeficitUSD > 0) {
			ruleSummary.LimitReached = true
			summary.LimitReached = true
		}
		ruleSummary.RemainingDeficitUSD = ruleSummary.CapacityDeficitUSD
		summary.Rules = append(summary.Rules, ruleSummary)
	}

	if summary.RuleId != "" && len(summary.Rules) == 0 {
		summary.SkippedReason = "未找到指定规则"
	}
	if promotedAny {
		model.InitChannelCache()
		service.ResetProxyClientCache()
	}
	summary.FinishedAt = common.GetTimestamp()
	return summary, nil
}

func RunChannelPreparationAutoPromotion(trigger string, optionalRuleId string, adminUserId *int) (channelPreparationAutoPromotionRunSummary, error) {
	if trigger == "" {
		trigger = channelPreparationAutoPromotionTriggerManual
	}
	if !channelPreparationAutoPromotionRunMutex.TryLock() {
		return channelPreparationAutoPromotionRunSummary{}, fmt.Errorf("自动晋升正在执行中")
	}
	defer channelPreparationAutoPromotionRunMutex.Unlock()
	return runChannelPreparationAutoPromotionLocked(trigger, optionalRuleId, adminUserId)
}

func RunChannelPreparationAutoPromotionManually(c *gin.Context) {
	var request channelPreparationAutoPromotionRunRequest
	if err := c.ShouldBindJSON(&request); err != nil && err != io.EOF {
		common.ApiError(c, err)
		return
	}
	adminUserId := c.GetInt("id")
	summary, err := RunChannelPreparationAutoPromotion(channelPreparationAutoPromotionTriggerManual, request.RuleId, &adminUserId)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	recordChannelPreparationAutoPromotionManageLog(&adminUserId, fmt.Sprintf("手动执行渠道备货池自动晋升：晋升 %d 个渠道", summary.TotalPromoted), 0, "", map[string]interface{}{
		"rule_id":        request.RuleId,
		"total_promoted": summary.TotalPromoted,
		"limit_reached":  summary.LimitReached,
		"trigger":        channelPreparationAutoPromotionTriggerManual,
	})
	common.ApiSuccess(c, summary)
}

func StartChannelPreparationAutoPromotionTask() {
	channelPreparationAutoPromotionTaskOnce.Do(func() {
		if !common.IsMasterNode {
			return
		}
		go func() {
			common.SysLog("channel preparation auto promotion task started")
			for {
				setting := operation_setting.GetChannelPreparationAutoPromotionSetting()
				if !setting.SchedulerEnabled {
					updateChannelPreparationAutoPromotionSchedulerStatus(func(status *channelPreparationAutoPromotionSchedulerStatus) {
						status.SchedulerEnabled = false
						status.IntervalMinutes = setting.IntervalMinutes
						status.NextCheckAt = 0
						status.Running = false
					})
					time.Sleep(1 * time.Minute)
					continue
				}
				intervalMinutes := int(math.Round(setting.IntervalMinutes))
				if intervalMinutes <= 0 {
					intervalMinutes = 10
				}
				intervalDuration := time.Duration(intervalMinutes) * time.Minute
				nextCheckAt := time.Now().Add(intervalDuration).Unix()
				updateChannelPreparationAutoPromotionSchedulerStatus(func(status *channelPreparationAutoPromotionSchedulerStatus) {
					status.SchedulerEnabled = true
					status.IntervalMinutes = float64(intervalMinutes)
					status.NextCheckAt = nextCheckAt
					status.Running = false
				})
				time.Sleep(intervalDuration)
				if !operation_setting.GetChannelPreparationAutoPromotionSetting().SchedulerEnabled {
					updateChannelPreparationAutoPromotionSchedulerStatus(func(status *channelPreparationAutoPromotionSchedulerStatus) {
						status.SchedulerEnabled = false
						status.NextCheckAt = 0
						status.Running = false
					})
					continue
				}
				common.SysLog(fmt.Sprintf("running channel preparation auto promotion with interval %d minutes", intervalMinutes))
				updateChannelPreparationAutoPromotionSchedulerStatus(func(status *channelPreparationAutoPromotionSchedulerStatus) {
					status.Running = true
					status.NextCheckAt = 0
					status.LastCheckAt = common.GetTimestamp()
				})
				summary, err := RunChannelPreparationAutoPromotion(channelPreparationAutoPromotionTriggerScheduler, "", nil)
				if err != nil {
					updateChannelPreparationAutoPromotionSchedulerStatus(func(status *channelPreparationAutoPromotionSchedulerStatus) {
						status.Running = false
						status.LastFinishedAt = common.GetTimestamp()
					})
					common.SysError("channel preparation auto promotion failed: " + err.Error())
					continue
				}
				updateChannelPreparationAutoPromotionSchedulerStatus(func(status *channelPreparationAutoPromotionSchedulerStatus) {
					status.Running = false
					status.LastFinishedAt = common.GetTimestamp()
					status.LastPromoted = summary.TotalPromoted
				})
				common.SysLog(fmt.Sprintf("channel preparation auto promotion finished: promoted=%d, limit_reached=%v", summary.TotalPromoted, summary.LimitReached))
				if summary.TotalPromoted > 0 || summary.LimitReached {
					recordChannelPreparationAutoPromotionManageLog(nil, fmt.Sprintf("定时执行渠道备货池自动晋升：晋升 %d 个渠道", summary.TotalPromoted), 0, "", map[string]interface{}{
						"total_promoted": summary.TotalPromoted,
						"limit_reached":  summary.LimitReached,
						"trigger":        channelPreparationAutoPromotionTriggerScheduler,
					})
				}
			}
		}()
	})
}
