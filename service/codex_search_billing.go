package service

import (
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	perfmetrics "github.com/QuantumNous/new-api/pkg/perf_metrics"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/bytedance/gopkg/util/gopool"
	"github.com/gin-gonic/gin"
)

func LogCodexSearchConsumption(c *gin.Context, info *relaycommon.RelayInfo) {
	pricePer1K := info.PriceData.ModelPrice * 1000
	other := map[string]interface{}{
		"request_path":          c.Request.URL.Path,
		"web_search":            true,
		"web_search_call_count": 1,
	}
	billingFallback := common.GetContextKeyBool(c, constant.ContextKeyCodexSearchBillingFallback)
	if billingFallback {
		other["billing_settlement_fallback"] = true
	} else {
		other["web_search_price"] = pricePer1K
		other["group_ratio"] = info.PriceData.GroupRatioInfo.GroupRatio
		if info.PriceData.GroupRatioInfo.HasSpecialRatio {
			other["user_group_ratio"] = info.PriceData.GroupRatioInfo.GroupSpecialRatio
		}
	}
	if info.IsModelMapped {
		other["is_model_mapped"] = true
		other["upstream_model_name"] = info.UpstreamModelName
	}
	attachQuotaSaturation(c, info, other)

	useTimeSeconds := 0
	if !info.StartTime.IsZero() {
		useTimeSeconds = int(time.Since(info.StartTime).Seconds())
	}
	logContent := fmt.Sprintf("Standalone Web Search 调用 1 次，按次计费 %s", logger.FormatQuota(info.PriceData.Quota))
	if billingFallback {
		logContent = fmt.Sprintf("Standalone Web Search 调用 1 次，结算调整失败，按实际预留额度计费 %s", logger.FormatQuota(info.PriceData.Quota))
	}
	model.RecordConsumeLog(c, info.UserId, model.RecordConsumeLogParams{
		ChannelId:      info.ChannelId,
		ModelName:      info.OriginModelName,
		TokenName:      c.GetString("token_name"),
		Quota:          info.PriceData.Quota,
		Content:        logContent,
		TokenId:        info.TokenId,
		UseTimeSeconds: useTimeSeconds,
		Group:          info.UsingGroup,
		Other:          other,
	})
	model.UpdateUserUsedQuotaAndRequestCount(info.UserId, info.PriceData.Quota)
	model.UpdateChannelUsedQuota(info.ChannelId, info.PriceData.Quota)
	gopool.Go(func() {
		perfmetrics.RecordRelaySample(info, true, 0)
	})
}
