package model

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// ChannelProfitSummary 利润聚合汇总。
// Revenue/Cost/Count 为调用侧（含充值日志的收入为 0、成本为让利额度）；
// TopupConcession/TopupCount 单独汇总充值让利（充值本身不产生利润，折扣让利计入成本）。
type ChannelProfitSummary struct {
	Revenue         int64   `json:"revenue" gorm:"column:revenue"`
	Cost            float64 `json:"cost" gorm:"column:cost"`
	Count           int64   `json:"count" gorm:"column:count"`
	TopupConcession float64 `json:"topup_concession" gorm:"column:topup_concession"`
	TopupCount      int64   `json:"topup_count" gorm:"column:topup_count"`
}

// ChannelProfitRow 按渠道 / 按模型的利润聚合行。
type ChannelProfitRow struct {
	ChannelID int     `json:"channel_id" gorm:"column:channel_id"`
	ModelName string  `json:"model_name" gorm:"column:model_name"`
	Revenue   int64   `json:"revenue" gorm:"column:revenue"`
	Cost      float64 `json:"cost" gorm:"column:cost"`
	Count     int64   `json:"count" gorm:"column:count"`
}

// ChannelProfitTrend 按时间桶的利润趋势点。
type ChannelProfitTrend struct {
	Bucket  int64   `json:"bucket" gorm:"column:bucket"`
	Revenue int64   `json:"revenue" gorm:"column:revenue"`
	Cost    float64 `json:"cost" gorm:"column:cost"`
	Count   int64   `json:"count" gorm:"column:count"`
}

// getCostEnabledChannelIDs 返回启用成本核算的渠道 ID 集合。
// 未启用成本的渠道不产生成本记录，其收入不应计入利润统计，聚合时直接丢弃。
func getCostEnabledChannelIDs() ([]int, error) {
	var channels []*Channel
	if err := DB.Find(&channels).Error; err != nil {
		return nil, err
	}
	ids := make([]int, 0, len(channels))
	for _, ch := range channels {
		if ch.GetCostSettings().Enabled {
			ids = append(ids, ch.Id)
		}
	}
	return ids, nil
}

// SumChannelProfit 从日志聚合利润数据。
// 纳入调用日志（LogTypeConsume）与充值日志（LogTypeTopup）：
//   - 调用日志：quota 为用户实扣（营收），cost_quota 为渠道成本（支出）；
//     仅统计启用成本核算渠道的调用日志，未启用成本渠道的历史收入直接丢弃；
//   - 充值日志：quota 恒为 0（充值本身不产生营收），cost_quota 为折扣让利额度（支出），
//     该让利在用户后续调用时由渠道成本差价赚回，因此计入总成本即可得到真实净利润。
//
// startTimestamp/endTimestamp 为 0 表示不限；channelID 为 0 表示不限；modelName 为空表示不限；
// granularity 为时间桶步长（秒），>0 时返回按桶聚合的利润趋势。
func SumChannelProfit(startTimestamp int64, endTimestamp int64, channelID int, modelName string, granularity int64) (ChannelProfitSummary, []ChannelProfitRow, []ChannelProfitRow, []ChannelProfitTrend, error) {
	costEnabledIDs, err := getCostEnabledChannelIDs()
	if err != nil {
		return ChannelProfitSummary{}, nil, nil, nil, err
	}

	build := func() *gorm.DB {
		tx := LOG_DB.Table("logs")
		if startTimestamp != 0 {
			tx = tx.Where("created_at >= ?", startTimestamp)
		}
		if endTimestamp != 0 {
			tx = tx.Where("created_at <= ?", endTimestamp)
		}
		if channelID != 0 {
			tx = tx.Where("channel_id = ?", channelID)
		}
		if modelName != "" {
			tx = tx.Where("model_name = ?", modelName)
		}
		return tx
	}

	// profitLogs 限定利润统计范围：充值日志全部纳入，调用日志仅启用成本渠道。
	profitLogs := func() *gorm.DB {
		tx := build()
		if len(costEnabledIDs) == 0 {
			return tx.Where("type = ?", LogTypeTopup)
		}
		return tx.Where("type = ? OR (type = ? AND channel_id IN ?)", LogTypeTopup, LogTypeConsume, costEnabledIDs)
	}
	// consumeLogs 仅统计启用成本渠道的调用日志。
	consumeLogs := func() *gorm.DB {
		tx := build().Where("type = ?", LogTypeConsume)
		if len(costEnabledIDs) == 0 {
			return tx.Where("1 = 0")
		}
		return tx.Where("channel_id IN ?", costEnabledIDs)
	}

	var summary ChannelProfitSummary
	if err := profitLogs().Select("COALESCE(SUM(quota), 0) AS revenue, COALESCE(SUM(cost_quota), 0) AS cost, COUNT(*) AS count").Scan(&summary).Error; err != nil {
		return summary, nil, nil, nil, err
	}

	var byChannel []ChannelProfitRow
	if err := profitLogs().Select("channel_id, COALESCE(SUM(quota), 0) AS revenue, COALESCE(SUM(cost_quota), 0) AS cost, COUNT(*) AS count").
		Where("channel_id != 0").Group("channel_id").Scan(&byChannel).Error; err != nil {
		return summary, nil, nil, nil, err
	}

	// 按模型聚合仅统计调用日志（充值日志无模型概念，避免空模型行）。
	var byModel []ChannelProfitRow
	if err := consumeLogs().Select("model_name, COALESCE(SUM(quota), 0) AS revenue, COALESCE(SUM(cost_quota), 0) AS cost, COUNT(*) AS count").
		Group("model_name").Scan(&byModel).Error; err != nil {
		return summary, nil, nil, nil, err
	}

	// 充值让利单独汇总（供"充值让利"卡片与图表"充值"行展示）。
	var topup ChannelProfitSummary
	if err := build().Where("type = ?", LogTypeTopup).Select("COALESCE(SUM(cost_quota), 0) AS topup_concession, COUNT(*) AS topup_count").Scan(&topup).Error; err != nil {
		return summary, nil, nil, nil, err
	}
	summary.TopupConcession = topup.TopupConcession
	summary.TopupCount = topup.TopupCount

	// 调用侧利润趋势（仅启用成本渠道的调用日志，按时间桶聚合）。
	var trend []ChannelProfitTrend
	if granularity > 0 {
		if err := consumeLogs().
			Select("(created_at / ?) * ? AS bucket, COALESCE(SUM(quota), 0) AS revenue, COALESCE(SUM(cost_quota), 0) AS cost, COUNT(*) AS count", granularity, granularity).
			Group("bucket").Order("bucket").Scan(&trend).Error; err != nil {
			return summary, nil, nil, nil, err
		}
	}

	return summary, byChannel, byModel, trend, nil
}

// CalculateTopupConcession 计算一笔充值的折扣让利额度（平台因折扣多送出的额度）。
// 充值本身不产生利润：用户实付金额按标准售价 Price 折算出的额度即为应给额度，
// 系统实际给出额度超过应给额度的部分即让利（亏损）；让利 ≤ 0（加价/克扣）时返回 0，
// 充值环节不记录正利润。
// 全程用 decimal 精确计算，避免浮点误差。
func CalculateTopupConcession(money float64, price float64, quotaPerUnit float64, creditedQuota int) float64 {
	if money <= 0 || price <= 0 || quotaPerUnit <= 0 || creditedQuota <= 0 {
		return 0
	}
	paidQuota := decimal.NewFromFloat(money).
		Div(decimal.NewFromFloat(price)).
		Mul(decimal.NewFromFloat(quotaPerUnit))
	concession := decimal.NewFromInt(int64(creditedQuota)).Sub(paidQuota)
	if concession.IsNegative() {
		return 0
	}
	result, _ := concession.Float64()
	return result
}

// CalculateChannelCost 计算一次调用的成本额度（固定模式 / 反推兜底）。
// 固定模式：成本 = FixedPrice × QuotaPerUnit（与用量无关）。
// 反推（折扣模式）：成本 = 模型标价配额 × 折扣系数，其中标价配额 = 用户实付 quota ÷ 分组倍率，
// 全程用 decimal 精确计算并保留小数，避免浮点除法与取整造成精度损失。
func CalculateChannelCost(settings *dto.ChannelCostSettings, quota int, groupRatio float64) float64 {
	if settings == nil || !settings.Enabled {
		return 0
	}
	switch settings.Mode {
	case dto.ChannelCostModeFixed:
		if settings.FixedPrice <= 0 {
			return 0
		}
		return settings.FixedPrice * common.QuotaPerUnit
	case dto.ChannelCostModeDiscount:
		if settings.Discount <= 0 || groupRatio <= 0 {
			return 0
		}
		cost := decimal.NewFromInt(int64(quota)).
			Div(decimal.NewFromFloat(groupRatio)).
			Mul(decimal.NewFromFloat(settings.Discount))
		result, _ := cost.Float64()
		return result
	default:
		return 0
	}
}

// CalculateModelCost 渠道价格表全倍率精确计算（复刻全局计费算法，用渠道自己的 ratio）。
//   - 该模型为 model_price（按次/按图）类型 → model_price × discount（每次调用）
//   - 否则按 ratio 复刻：base(prompt − cache/cc/image/audio 分量) + 各分量×各自倍率 + completion×completion_ratio，
//     再 × model_ratio × discount；Claude 语义下缓存读/写分量不减 base。
//
// other 需携带各计费路径写入的倍率明细（cache_tokens/cache_ratio、cache_creation_tokens[_5m/_1h]、
// image_output/image_ratio、audio_input/audio_output/audio_ratio/audio_completion_ratio、usage_semantic 等）。
func CalculateModelCost(mc dto.ChannelModelCost, discount float64, promptTokens int, completionTokens int, other map[string]interface{}) float64 {
	// 按次/按图计费：成本 = 模型价格 × 折扣系数（每次调用）
	if mc.ModelPrice > 0 {
		return mc.ModelPrice * discount * common.QuotaPerUnit
	}

	isClaude := readOtherString(other, "usage_semantic") == "anthropic" || readOtherBool(other, "claude")

	dPrompt := decimal.NewFromInt(int64(promptTokens))
	dCompletion := decimal.NewFromInt(int64(completionTokens))
	dModelRatio := decimal.NewFromFloat(mc.ModelRatio)
	dCompletionRatio := decimal.NewFromFloat(mc.CompletionRatio)
	dCacheRatio := decimal.NewFromFloat(mc.CacheRatio)
	dCcRatio := decimal.NewFromFloat(mc.CreateCacheRatio)
	dImageRatio := decimal.NewFromFloat(mc.ImageRatio)
	dAudioRatio := decimal.NewFromFloat(mc.AudioRatio)
	dAudioCompletionRatio := decimal.NewFromFloat(mc.AudioCompletionRatio)
	dDiscount := decimal.NewFromFloat(discount)

	base := dPrompt
	extra := decimal.Zero
	audioSpecialCost := decimal.Zero

	// 缓存读取
	if cacheTokens := readOtherInt(other, "cache_tokens"); cacheTokens > 0 {
		if !isClaude {
			base = base.Sub(decimal.NewFromInt(int64(cacheTokens)))
		}
		extra = extra.Add(decimal.NewFromInt(int64(cacheTokens)).Mul(dCacheRatio))
	}

	// 缓存写入（Claude 5m/1h 拆分）
	cc5m := readOtherInt(other, "cache_creation_tokens_5m")
	cc1h := readOtherInt(other, "cache_creation_tokens_1h")
	ccTokens := readOtherInt(other, "cache_creation_tokens")
	if isClaude {
		if cc5m > 0 {
			extra = extra.Add(decimal.NewFromInt(int64(cc5m)).Mul(decimal.NewFromFloat(readOtherFloat(other, "cache_creation_ratio_5m"))))
		}
		if cc1h > 0 {
			extra = extra.Add(decimal.NewFromInt(int64(cc1h)).Mul(decimal.NewFromFloat(readOtherFloat(other, "cache_creation_ratio_1h"))))
		}
		if ccTokens > 0 {
			remaining := ccTokens - cc5m - cc1h
			if remaining < 0 {
				remaining = 0
			}
			extra = extra.Add(decimal.NewFromInt(int64(remaining)).Mul(dCcRatio))
		}
	} else if ccTokens > 0 {
		base = base.Sub(decimal.NewFromInt(int64(ccTokens)))
		extra = extra.Add(decimal.NewFromInt(int64(ccTokens)).Mul(dCcRatio))
	}

	// 图像
	if imgTokens := readOtherInt(other, "image_output"); imgTokens > 0 {
		base = base.Sub(decimal.NewFromInt(int64(imgTokens)))
		extra = extra.Add(decimal.NewFromInt(int64(imgTokens)).Mul(dImageRatio))
	}

	// 音频（WSS / 音频路径）
	audioInput := readOtherInt(other, "audio_input")
	audioOutput := readOtherInt(other, "audio_output")
	if audioInput > 0 || audioOutput > 0 {
		base = base.Sub(decimal.NewFromInt(int64(audioInput))).Sub(decimal.NewFromInt(int64(audioOutput)))
		extra = extra.Add(decimal.NewFromInt(int64(audioInput)).Mul(dAudioRatio))
		extra = extra.Add(decimal.NewFromInt(int64(audioOutput)).Mul(dAudioRatio).Mul(dAudioCompletionRatio))
	}

	// Gemini 音频特殊独立计价（文本路径）
	if readOtherBool(other, "audio_input_seperate_price") {
		audioInputTokens := readOtherInt(other, "audio_input_token_count")
		audioInputPrice := readOtherFloat(other, "audio_input_price")
		if audioInputTokens > 0 && audioInputPrice > 0 {
			base = base.Sub(decimal.NewFromInt(int64(audioInputTokens)))
			audioSpecialCost = audioSpecialCost.Add(decimal.NewFromFloat(audioInputPrice).
				Div(decimal.NewFromInt(1000000)).
				Mul(decimal.NewFromInt(int64(audioInputTokens))).
				Mul(dDiscount).
				Mul(decimal.NewFromFloat(common.QuotaPerUnit)))
		}
	}

	// OpenAI cache-write usage reports unadjusted prefix counts，叠加可能超出 prompt，钳制为 0。
	if base.IsNegative() {
		base = decimal.Zero
	}

	promptQuota := base.Add(extra)
	completionQuota := dCompletion.Mul(dCompletionRatio)
	total := promptQuota.Add(completionQuota).Mul(dModelRatio).Mul(dDiscount).Add(audioSpecialCost)
	if total.IsNegative() {
		total = decimal.Zero
	}
	result, _ := total.Float64()
	return result
}

// channelModelCostValid 判断一个渠道模型成本配置是否已配置有效定价。
// 留空（所有定价字段为 0）视为未配置，调用时回退全局模型定价。
func channelModelCostValid(mc dto.ChannelModelCost) bool {
	return mc.ModelPrice > 0 || mc.ModelRatio > 0 || mc.CompletionRatio > 0 ||
		mc.CacheRatio > 0 || mc.CreateCacheRatio > 0 || mc.ImageRatio > 0 ||
		mc.AudioRatio > 0 || mc.AudioCompletionRatio > 0
}

// readOtherFloat 从日志 Other map 中读取 float64 字段。
func readOtherFloat(other map[string]interface{}, key string) float64 {
	if v, ok := other[key]; ok {
		if f, ok := v.(float64); ok {
			return f
		}
	}
	return 0
}

// readOtherInt 从日志 Other map 中读取 int 字段。
func readOtherInt(other map[string]interface{}, key string) int {
	if v, ok := other[key]; ok {
		switch n := v.(type) {
		case float64:
			return int(n)
		case int:
			return n
		case int64:
			return int(n)
		}
	}
	return 0
}

// readOtherBool 从日志 Other map 中读取 bool 字段。
func readOtherBool(other map[string]interface{}, key string) bool {
	if v, ok := other[key]; ok {
		if b, ok := v.(bool); ok {
			return b
		}
	}
	return false
}

// readOtherString 从日志 Other map 中读取 string 字段。
func readOtherString(other map[string]interface{}, key string) string {
	if v, ok := other[key]; ok {
		if s, ok := v.(string); ok {
			return strings.TrimSpace(s)
		}
	}
	return ""
}

// attachChannelCost 将成本快照写入 other.admin_info.channel_cost（仅管理员可见）。
func attachChannelCost(other map[string]interface{}, settings *dto.ChannelCostSettings, quota int, cost float64) {
	if other == nil {
		return
	}
	adminInfo, ok := other["admin_info"].(map[string]interface{})
	if !ok || adminInfo == nil {
		adminInfo = map[string]interface{}{}
		other["admin_info"] = adminInfo
	}
	adminInfo["channel_cost"] = map[string]interface{}{
		"mode":        string(settings.Mode),
		"discount":    settings.Discount,
		"fixed_price": settings.FixedPrice,
		"cost":        cost,
		"profit":      float64(quota) - cost,
	}
}

// resolveChannelCost 计算一次调用的成本额度，并将快照写入 params.Other。
// 决策顺序（折扣模式）：渠道成本价格表含该模型 → 全倍率精确计算；否则反推兜底。
// 未启用成本配置 / 渠道不存在时返回 0。
func resolveChannelCost(params RecordConsumeLogParams) float64 {
	if params.ChannelId <= 0 {
		return 0
	}
	channel, err := CacheGetChannel(params.ChannelId)
	if err != nil {
		return 0
	}
	settings := channel.GetCostSettings()
	if !settings.Enabled {
		return 0
	}

	groupRatio := readOtherFloat(params.Other, "group_ratio")
	if groupRatio <= 0 {
		groupRatio = ratio_setting.GetGroupRatio(params.Group)
	}

	var cost float64
	switch settings.Mode {
	case dto.ChannelCostModeFixed:
		cost = CalculateChannelCost(&settings, params.Quota, groupRatio)
	default:
		// 渠道成本价格表含该模型且已配置定价 → 用渠道价格表全倍率精确计算；
		// 否则（未同步 / 留空未配置）回退全局模型标价 × 渠道折扣系数。
		mc, ok := settings.ModelPrices[params.ModelName]
		if ok && channelModelCostValid(mc) {
			if readOtherString(params.Other, "billing_mode") == "tiered_expr" {
				// tiered_expr 无法用渠道价格表还原，回退反推（decimal 精确计算）
				cost = CalculateChannelCost(&settings, params.Quota, groupRatio)
			} else {
				cost = CalculateModelCost(mc, settings.Discount, params.PromptTokens, params.CompletionTokens, params.Other)
			}
		} else {
			// 未同步/留空该模型的渠道成本：以日志中的全局模型标价（乘算）回退，避免从用户费用反推的除法误差。
			// 全局标价与渠道标价同构，成本 = 全局标价 × 渠道折扣系数，与系统计费算法一致。
			mc := globalModelCostFromOther(params.Other)
			if mc.ModelRatio > 0 || mc.ModelPrice > 0 {
				cost = CalculateModelCost(mc, settings.Discount, params.PromptTokens, params.CompletionTokens, params.Other)
			}
		}
	}

	if params.Other == nil {
		params.Other = make(map[string]interface{})
	}
	attachChannelCost(params.Other, &settings, params.Quota, cost)
	return cost
}

// globalModelCostFromOther 从日志 Other 读取全局模型标价（系统模型成本定价），用于未同步模型的成本回退。
func globalModelCostFromOther(other map[string]interface{}) dto.ChannelModelCost {
	return dto.ChannelModelCost{
		ModelRatio:           readOtherFloat(other, "model_ratio"),
		ModelPrice:           readOtherFloat(other, "model_price"),
		CompletionRatio:      readOtherFloat(other, "completion_ratio"),
		CacheRatio:           readOtherFloat(other, "cache_ratio"),
		CreateCacheRatio:     readOtherFloat(other, "create_cache_ratio"),
		ImageRatio:           readOtherFloat(other, "image_ratio"),
		AudioRatio:           readOtherFloat(other, "audio_ratio"),
		AudioCompletionRatio: readOtherFloat(other, "audio_completion_ratio"),
	}
}
