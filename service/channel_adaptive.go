package service

import (
	"fmt"
	"math/rand/v2"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

var (
	adaptiveLogEnabled bool
	adaptiveLogSample  = 0.01 // 采样率
)

// 请求上下文 key
type adaptiveContextKey string

const (
	ctxKeyAdaptiveUsedChannels adaptiveContextKey = "adaptive_used_channels"
	ctxKeyAdaptiveGroup        adaptiveContextKey = "adaptive_group"
	ctxKeyAdaptiveModel        adaptiveContextKey = "adaptive_model"
	ctxKeyAdaptiveSelected     adaptiveContextKey = "adaptive_selected"
	ctxKeyAdaptiveScores       adaptiveContextKey = "adaptive_scores"
)

// AdaptiveSelectChannel 动态评分调度器主入口。
// 所有回退必须调用 cacheGetRandomSatisfiedChannelLegacy，禁止再进 CacheGetRandomSatisfiedChannel。
func AdaptiveSelectChannel(param *RetryParam) (*model.Channel, string, error) {
	ctx := param.Ctx

	// 未开启完整自适应：仅 legacy（含「只开 shadow」旧行为，避免递归）
	if !constant.AdaptiveBalanceEnabled {
		return cacheGetRandomSatisfiedChannelLegacy(param)
	}

	// 提取 group 和 model
	group := common.GetContextKeyString(ctx, constant.ContextKeyUsingGroup)
	if group == "" {
		group = param.TokenGroup
	}
	modelName := param.ModelName

	// 获取该 group+model 下的可用渠道
	channels, err := getCandidateChannels(group, modelName, param)
	if err != nil {
		return nil, group, err
	}
	if len(channels) == 0 {
		return cacheGetRandomSatisfiedChannelLegacy(param)
	}

	// 获取亲和偏好 channel
	preferredID := getPreferredChannelID(ctx, modelName, group)

	// 评分
	candidates := ScoreCandidates(channels, group, modelName, preferredID)

	// 排除已用过的渠道（重试时）+ 熔断
	usedIDs := getAdaptiveUsedChannels(ctx)
	var filtered []CandidateScore
	for _, c := range candidates {
		if containsInt(usedIDs, c.Channel.Id) {
			continue
		}
		if IsCircuitOpen(c.Channel.Id) {
			// 冷却后尝试 half-open 探测位
			if ProbeHalfOpen(c.Channel.Id) {
				// allow one probe candidate through
			} else {
				continue
			}
		}
		if c.Score <= 0 {
			continue
		}
		filtered = append(filtered, c)
	}

	if len(filtered) == 0 {
		if constant.AdaptiveBalanceShadowMode {
			logger.LogDebug(ctx, "adaptive: no available channels after filtering, fallback to original")
		}
		return cacheGetRandomSatisfiedChannelLegacy(param)
	}

	// topK 加权随机选择
	selected := SelectTopKWeighted(filtered, 3)
	if selected == nil {
		return cacheGetRandomSatisfiedChannelLegacy(param)
	}

	// Shadow Mode：选择仍走旧逻辑，仅记录对比
	if constant.AdaptiveBalanceShadowMode {
		oldCh, oldGroup, oldErr := cacheGetRandomSatisfiedChannelLegacy(param)

		// 采样日志
		if adaptiveLogEnabled || randFloat64() < adaptiveLogSample {
			logAdaptiveCompare(ctx, modelName, group, selected, oldCh)
		}

		// shadow mode 下仍然使用旧渠道
		if oldCh != nil {
			addAdaptiveUsedChannel(ctx, oldCh.Id)
			storeAdaptiveSelection(ctx, selected.Channel, group, candidates)
			return oldCh, oldGroup, oldErr
		}
	}

	// 正常模式：使用动态选择的渠道
	selectGroup := group
	ch := selected.Channel

	addAdaptiveUsedChannel(ctx, ch.Id)
	storeAdaptiveSelection(ctx, ch, group, candidates)

	logger.LogDebug(ctx, "adaptive selected channel #%d (score=%.3f) for group=%s model=%s",
		ch.Id, selected.Score, group, modelName)

	return ch, selectGroup, nil
}

// getCandidateChannels 获取 group+model 全部候选（非单渠道路由）
func getCandidateChannels(group, modelName string, param *RetryParam) ([]*model.Channel, error) {
	// auto 分组：优先用上下文已解析的 auto group，否则 legacy 解析一次
	if group == "auto" || param.TokenGroup == "auto" {
		if g := common.GetContextKeyString(param.Ctx, constant.ContextKeyAutoGroup); g != "" {
			group = g
		} else {
			// 用 legacy 解析 auto → 具体 group，再拉全量候选
			ch, selectGroup, err := cacheGetRandomSatisfiedChannelLegacy(param)
			if err != nil {
				return nil, err
			}
			if ch == nil {
				return nil, nil
			}
			if selectGroup != "" {
				group = selectGroup
			}
			// 继续用解析后的 group 拉全量；若失败至少返回当前渠道
			list, listErr := model.GetSatisfiedChannels(group, modelName, param.RequestPath)
			if listErr != nil {
				return []*model.Channel{ch}, nil
			}
			if len(list) == 0 {
				return []*model.Channel{ch}, nil
			}
			return list, nil
		}
	}

	return model.GetSatisfiedChannels(group, modelName, param.RequestPath)
}

// getPreferredChannelID 读取亲和偏好（如果有）
func getPreferredChannelID(ctx *gin.Context, modelName, group string) int {
	if !common.MemoryCacheEnabled {
		return 0
	}
	id, found := GetPreferredChannelByAffinity(ctx, modelName, group)
	if found {
		return id
	}
	return 0
}

// getAdaptiveUsedChannels 获取本次请求已用过的渠道 ID 列表
func getAdaptiveUsedChannels(c *gin.Context) []int {
	v, ok := c.Get(string(ctxKeyAdaptiveUsedChannels))
	if !ok {
		return nil
	}
	ids, _ := v.([]int)
	return ids
}

// addAdaptiveUsedChannel 记录本次请求使用过的渠道
func addAdaptiveUsedChannel(c *gin.Context, channelID int) {
	existing := getAdaptiveUsedChannels(c)
	existing = append(existing, channelID)
	c.Set(string(ctxKeyAdaptiveUsedChannels), existing)
}

// storeAdaptiveSelection 保存本次选择结果到上下文（供失败回写用）
func storeAdaptiveSelection(c *gin.Context, ch *model.Channel, group string, candidates []CandidateScore) {
	c.Set(string(ctxKeyAdaptiveSelected), ch.Id)
	c.Set(string(ctxKeyAdaptiveGroup), group)
	if len(candidates) > 0 {
		c.Set(string(ctxKeyAdaptiveScores), candidates)
	}
}

// logAdaptiveCompare shadow mode 日志
func logAdaptiveCompare(c *gin.Context, modelName, group string, selected *CandidateScore, oldCh *model.Channel) {
	oldID := 0
	if oldCh != nil {
		oldID = oldCh.Id
	}
	logger.LogDebug(c, "[shadow] model=%s group=%s adaptive=#%d(%.3f) orig=#%d",
		modelName, group, selected.Channel.Id, selected.Score, oldID)
}

// RecordAdaptiveResult 请求完成后回调：更新指标 + 熔断状态
func RecordAdaptiveResult(c *gin.Context, channelID int, group, modelName string, statusCode int, latency time.Duration, err error) {
	if !constant.AdaptiveBalanceEnabled {
		return
	}
	if channelID <= 0 {
		return
	}

	if err == nil && statusCode < 400 {
		ObserveSuccess(channelID, group, modelName, latency)
		RecordCircuitSuccess(channelID)
		return
	}

	// 失败处理
	ObserveFailure(channelID, group, modelName, statusCode, latency)

	if statusCode == 429 {
		// 429 cooldown 由指标层自动处理
		logger.LogDebug(c, "adaptive: channel #%d got 429, score will be downgraded", channelID)
	}

	if statusCode >= 500 || statusCode == 429 {
		RecordCircuitFailure(channelID, fmt.Sprintf("HTTP %d", statusCode))
	}
}

// containsInt 检查 int 切片是否包含某值
func containsInt(slice []int, val int) bool {
	for _, v := range slice {
		if v == val {
			return true
		}
	}
	return false
}

// randFloat64 生成 [0,1) 随机数
var randFloat64 = func() float64 {
	return rand.Float64()
}
