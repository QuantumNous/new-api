package service

import (
	"fmt"
	"math"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
)

const ToolNameCodexAlphaSearch = "codex_alpha_search"

// ToolCallUsage captures all tool call counts from a single request.
type ToolCallUsage struct {
	ModelName              string
	WebSearchCalls         int
	WebSearchToolName      string // "web_search_preview", "web_search", etc.
	FileSearchCalls        int
	ImageGenerationCall    bool
	ImageGenerationQuality string
	ImageGenerationSize    string
}

// ToolCallItem represents a single billed tool usage line.
type ToolCallItem struct {
	Name       string  `json:"name"`
	CallCount  int     `json:"call_count"`
	PricePer1K float64 `json:"price_per_1k"`
	TotalPrice float64 `json:"total_price"`
	Quota      int     `json:"quota"`
}

// ToolCallResult holds the aggregated tool call billing for a request.
type ToolCallResult struct {
	TotalQuota int                `json:"total_quota"`
	Items      []ToolCallItem     `json:"items,omitempty"`
	Clamp      *common.QuotaClamp `json:"-"`
	Err        error              `json:"-"`
}

// ComputeToolCallQuota calculates the total quota for all tool calls in a
// request. Tool prices are resolved via GetToolPriceForModel which supports
// model-prefix overrides. groupRatio is applied.
func ComputeToolCallQuota(usage ToolCallUsage, groupRatio float64) ToolCallResult {
	var items []ToolCallItem
	totalQuota := 0
	var quotaClamp *common.QuotaClamp
	var err error

	noteClamp := func(clamp *common.QuotaClamp) {
		if clamp != nil && quotaClamp == nil {
			quotaClamp = clamp
		}
	}
	addQuota := func(quota int) {
		nextTotal, clamp := common.QuotaFromFloatChecked(float64(totalQuota) + float64(quota))
		noteClamp(clamp)
		totalQuota = nextTotal
	}

	if groupRatio <= 0 || math.IsNaN(groupRatio) || math.IsInf(groupRatio, 0) {
		err = fmt.Errorf("invalid group ratio for tool call billing: %g", groupRatio)
		return ToolCallResult{Err: err}
	}

	addItem := func(toolName string, count int) {
		if count <= 0 {
			return
		}
		pricePer1K := operation_setting.GetToolPriceForModel(toolName, usage.ModelName)
		if pricePer1K <= 0 || math.IsNaN(pricePer1K) || math.IsInf(pricePer1K, 0) {
			return
		}
		totalPrice := pricePer1K * float64(count) / 1000
		quota, clamp := common.QuotaRoundChecked(totalPrice * common.QuotaPerUnit * groupRatio)
		noteClamp(clamp)
		items = append(items, ToolCallItem{
			Name:       toolName,
			CallCount:  count,
			PricePer1K: pricePer1K,
			TotalPrice: totalPrice,
			Quota:      quota,
		})
		addQuota(quota)
	}

	if usage.WebSearchCalls > 0 && usage.WebSearchToolName != "" {
		addItem(usage.WebSearchToolName, usage.WebSearchCalls)
	}

	if usage.FileSearchCalls > 0 {
		addItem("file_search", usage.FileSearchCalls)
	}

	if usage.ImageGenerationCall {
		price := operation_setting.GetGPTImage1PriceOnceCall(usage.ImageGenerationQuality, usage.ImageGenerationSize)
		if price <= 0 || math.IsNaN(price) || math.IsInf(price, 0) {
			return ToolCallResult{
				TotalQuota: totalQuota,
				Items:      items,
				Clamp:      quotaClamp,
				Err:        err,
			}
		}
		quota, clamp := common.QuotaRoundChecked(price * common.QuotaPerUnit * groupRatio)
		noteClamp(clamp)
		items = append(items, ToolCallItem{
			Name:       "image_generation",
			CallCount:  1,
			PricePer1K: price,
			TotalPrice: price,
			Quota:      quota,
		})
		addQuota(quota)
	}

	return ToolCallResult{
		TotalQuota: totalQuota,
		Items:      items,
		Clamp:      quotaClamp,
		Err:        err,
	}
}

func PostCodexAlphaSearchConsumeQuota(ctx *gin.Context, relayInfo *relaycommon.RelayInfo) {
	if relayInfo == nil {
		return
	}
	result := ComputeToolCallQuota(ToolCallUsage{
		ModelName:         relayInfo.OriginModelName,
		WebSearchCalls:    1,
		WebSearchToolName: ToolNameCodexAlphaSearch,
	}, relayInfo.PriceData.GroupRatioInfo.GroupRatio)
	if result.Err != nil {
		logger.LogError(ctx, "error computing codex alpha search billing: "+result.Err.Error())
		return
	}
	if result.Clamp != nil && relayInfo.QuotaClamp == nil {
		relayInfo.QuotaClamp = result.Clamp
	}

	quota := result.TotalQuota
	model.UpdateUserUsedQuotaAndRequestCount(relayInfo.UserId, quota)
	if quota > 0 {
		model.UpdateChannelUsedQuota(relayInfo.ChannelId, quota)
	}

	if err := SettleBilling(ctx, relayInfo, quota); err != nil {
		logger.LogError(ctx, "error settling codex alpha search billing: "+err.Error())
	}

	pricePer1K := operation_setting.GetToolPriceForModel(ToolNameCodexAlphaSearch, relayInfo.OriginModelName)
	content := fmt.Sprintf("Codex Alpha Search called 1 time, quota cost %d", quota)
	if pricePer1K > 0 {
		content = fmt.Sprintf("Codex Alpha Search called 1 time, tool price %.4f USD/1K calls, quota cost %d", pricePer1K, quota)
	}

	other := GenerateTextOtherInfo(ctx, relayInfo,
		relayInfo.PriceData.ModelRatio,
		relayInfo.PriceData.GroupRatioInfo.GroupRatio,
		relayInfo.PriceData.CompletionRatio,
		0,
		relayInfo.PriceData.CacheRatio,
		relayInfo.PriceData.ModelPrice,
		relayInfo.PriceData.GroupRatioInfo.GroupSpecialRatio,
	)
	other["web_search"] = true
	other["web_search_call_count"] = 1
	other["web_search_price"] = pricePer1K
	other["codex_alpha_search"] = true
	if len(result.Items) > 0 {
		other["tool_call_items"] = result.Items
	}
	attachQuotaSaturation(ctx, relayInfo, other)

	model.RecordConsumeLog(ctx, relayInfo.UserId, model.RecordConsumeLogParams{
		ChannelId:        relayInfo.ChannelId,
		PromptTokens:     0,
		CompletionTokens: 0,
		ModelName:        relayInfo.OriginModelName,
		TokenName:        ctx.GetString("token_name"),
		Quota:            quota,
		Content:          content,
		TokenId:          relayInfo.TokenId,
		UseTimeSeconds:   int(time.Since(relayInfo.StartTime).Seconds()),
		IsStream:         relayInfo.IsStream,
		Group:            relayInfo.UsingGroup,
		Other:            other,
	})
}
