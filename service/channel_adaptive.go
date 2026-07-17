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
	ctxKeyAdaptiveUsedChannels  adaptiveContextKey = "adaptive_used_channels"
	ctxKeyAdaptiveGroup         adaptiveContextKey = "adaptive_group"
	ctxKeyAdaptiveModel         adaptiveContextKey = "adaptive_model"
	ctxKeyAdaptiveSelected      adaptiveContextKey = "adaptive_selected"
	ctxKeyAdaptiveScores        adaptiveContextKey = "adaptive_scores"
	ctxKeyAdaptiveCircuitPermit adaptiveContextKey = "adaptive_circuit_permit"
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

	usedIDs := getAdaptiveUsedChannels(ctx)
	filtered, permits := filterAdaptiveCandidates(
		candidates, group, modelName, preferredID, usedIDs, constant.AdaptiveBalanceShadowMode,
	)

	if len(filtered) == 0 {
		if shouldFallbackToLegacy(len(candidates), len(filtered), constant.AdaptiveBalanceShadowMode) {
			return cacheGetRandomSatisfiedChannelLegacy(param)
		}
		return nil, group, fmt.Errorf("adaptive: no available channels after circuit and retry filtering")
	}

	// topK 加权随机选择
	selected := SelectTopKWeighted(filtered, 3)
	if selected == nil {
		releaseUnselectedCircuitPermits(permits, 0)
		return nil, group, fmt.Errorf("adaptive: failed to select an eligible channel")
	}

	// Shadow Mode：选择仍走旧逻辑，仅记录对比
	if constant.AdaptiveBalanceShadowMode {
		oldCh, oldGroup, oldErr := cacheGetRandomSatisfiedChannelLegacy(param)

		// 采样日志
		if adaptiveLogEnabled || randFloat64() < adaptiveLogSample {
			logAdaptiveCompare(ctx, modelName, group, selected, oldCh)
		}

		// shadow mode never changes routing or acquires half-open permits.
		if oldCh != nil {
			addAdaptiveUsedChannel(ctx, oldCh.Id)
			storeAdaptiveSelection(ctx, selected.Channel, group, candidates)
		}
		return oldCh, oldGroup, oldErr
	}

	// 正常模式：使用动态选择的渠道
	selectGroup := group
	ch := selected.Channel
	permit := permits[ch.Id]
	releaseUnselectedCircuitPermits(permits, ch.Id)

	addAdaptiveUsedChannel(ctx, ch.Id)
	storeAdaptiveSelection(ctx, ch, group, candidates)
	ctx.Set(string(ctxKeyAdaptiveCircuitPermit), permit)

	logger.LogDebug(ctx, "adaptive selected channel #%d (score=%.3f) for group=%s model=%s",
		ch.Id, selected.Score, group, modelName)

	return ch, selectGroup, nil
}

func filterAdaptiveCandidates(
	candidates []CandidateScore,
	group string,
	modelName string,
	preferredID int,
	usedIDs []int,
	shadowMode bool,
) ([]CandidateScore, map[int]CircuitPermit) {
	filtered := make([]CandidateScore, 0, len(candidates))
	permits := make(map[int]CircuitPermit, len(candidates))
	for _, candidate := range candidates {
		channelID := candidate.Channel.Id
		if containsInt(usedIDs, channelID) {
			continue
		}
		if shadowMode {
			if IsCircuitOpen(channelID) || candidate.Score <= 0 {
				continue
			}
			filtered = append(filtered, candidate)
			continue
		}

		permit, ok := AcquireCircuitPermit(channelID)
		if !ok {
			continue
		}
		if permit.HalfOpen {
			candidate = scoreCandidate(candidate.Channel, group, modelName, preferredID, 0.5)
		}
		if candidate.Score <= 0 {
			ReleaseCircuitPermit(permit)
			continue
		}
		permits[channelID] = permit
		filtered = append(filtered, candidate)
	}
	return filtered, permits
}

func ReleaseAdaptiveCircuitPermit(c *gin.Context, channelID int) {
	if c == nil || channelID <= 0 {
		return
	}
	permitAny, ok := c.Get(string(ctxKeyAdaptiveCircuitPermit))
	permit, permitOK := permitAny.(CircuitPermit)
	if !ok || !permitOK || permit.ChannelID != channelID {
		return
	}
	ReleaseCircuitPermit(permit)
	c.Set(string(ctxKeyAdaptiveCircuitPermit), CircuitPermit{})
}

func shouldFallbackToLegacy(candidateCount, filteredCount int, shadowMode bool) bool {
	return candidateCount == 0 || (shadowMode && filteredCount == 0)
}

func releaseUnselectedCircuitPermits(permits map[int]CircuitPermit, selectedChannelID int) {
	for channelID, permit := range permits {
		if channelID != selectedChannelID {
			ReleaseCircuitPermit(permit)
		}
	}
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

func MarkChannelUsed(c *gin.Context, channelID int) {
	if c == nil || channelID <= 0 || containsInt(getAdaptiveUsedChannels(c), channelID) {
		return
	}
	addAdaptiveUsedChannel(c, channelID)
}

func adaptiveUsedChannelSet(c *gin.Context) map[int]struct{} {
	used := getAdaptiveUsedChannels(c)
	if len(used) == 0 {
		return nil
	}
	excluded := make(map[int]struct{}, len(used))
	for _, channelID := range used {
		excluded[channelID] = struct{}{}
	}
	return excluded
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

	succeeded := err == nil && statusCode < 400
	if succeeded {
		ObserveSuccess(channelID, group, modelName, latency)
	} else {
		ObserveFailure(channelID, group, modelName, statusCode, latency)
	}

	if constant.AdaptiveBalanceShadowMode {
		return
	}
	permitAny, ok := c.Get(string(ctxKeyAdaptiveCircuitPermit))
	permit, permitOK := permitAny.(CircuitPermit)
	if !ok || !permitOK || permit.ChannelID != channelID {
		return
	}
	if succeeded {
		RecordCircuitSuccessWithPermit(permit)
	} else if statusCode >= 500 || statusCode == 429 {
		RecordCircuitFailureWithPermit(permit, fmt.Sprintf("HTTP %d", statusCode))
	} else {
		// A client/input error still proves the upstream is reachable. Do not
		// leave a half-open permit stuck or preserve an old failure streak.
		RecordCircuitSuccessWithPermit(permit)
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
