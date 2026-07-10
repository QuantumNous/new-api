package service

import (
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"

	"github.com/gin-gonic/gin"
)

// FinalizeHedgeWinnerBilling 在 clientgone fallback 竞速终局对赢家做一次性结算：
// 取出被 TryDefer 暂存的 usage，重入 PostTextConsumeQuota（settled 标记保证不再被拦截），
// 走正常的结算 + 消费日志路径。若赢家从未走到计费点（如 mid-stream 失败），什么都不做，
// 由外层的 RefundPreConsumeIfSafe 兜底退款。
func FinalizeHedgeWinnerBilling(ctx *gin.Context, info *relaycommon.RelayInfo) *dto.Usage {
	if ctx == nil || info == nil || info.HedgeState == nil {
		return nil
	}
	usageAny, extraContent, ok := info.HedgeState.TakeDeferred()
	if !ok {
		return nil
	}
	usage, _ := usageAny.(*dto.Usage)
	PostTextConsumeQuota(ctx, info, usage, extraContent)
	return usage
}

// RecordHedgeLoserConsumption 给竞速败者写一条 quota=0 的消费日志：
// 不动用户余额、不结算 Billing、不进渠道健康统计，仅在 other["hedge"] 里留存
// 败者实际消耗的 token 与竞速信息，供对账和效果分析。
func RecordHedgeLoserConsumption(ctx *gin.Context, info *relaycommon.RelayInfo, loserChannelId int, loserChannelName string, winnerChannelId int) {
	if ctx == nil || info == nil || info.HedgeState == nil {
		return
	}
	usageAny, _, _ := info.HedgeState.TakeDeferred()
	usage, _ := usageAny.(*dto.Usage)
	promptTokens := 0
	completionTokens := 0
	if usage != nil {
		promptTokens = usage.PromptTokens
		completionTokens = usage.CompletionTokens
	}
	frtMs := int64(-1)
	if info.HasSendResponse() {
		frtMs = info.FirstResponseTime.Sub(info.StartTime).Milliseconds()
	}
	// 系统侧记录：user_id/token_id 置 0，普通用户在使用日志里看不到这条；
	// 真实归属信息进 admin_info.hedge，仅管理端可见
	other := map[string]interface{}{
		"admin_info": map[string]interface{}{
			"hedge": map[string]interface{}{
				"role":              info.HedgeState.Role,
				"result":            "loser",
				"loser_channel_id":  loserChannelId,
				"winner_channel_id": winnerChannelId,
				"frt":               frtMs,
				"has_first_byte":    info.HasSendResponse(),
				"received_chunks":   info.ReceivedResponseCount,
				"user_id":           info.UserId,
				"user_email":        info.UserEmail,
				"token_id":          info.TokenId,
			},
		},
	}
	content := fmt.Sprintf("clientgone fallback 竞速败者（%s，渠道 #%d），不计费", info.HedgeState.Role, loserChannelId)
	model.RecordConsumeLog(ctx, 0, model.RecordConsumeLogParams{
		ChannelId:        loserChannelId,
		PromptTokens:     promptTokens,
		CompletionTokens: completionTokens,
		ModelName:        info.OriginModelName,
		TokenName:        common.GetContextKeyString(ctx, "token_name"),
		Quota:            0,
		Content:          content,
		TokenId:          0,
		UseTimeSeconds:   int(time.Since(info.StartTime).Seconds()),
		IsStream:         info.IsStream,
		Group:            info.UsingGroup,
		Other:            other,
	})
	logger.LogInfo(ctx, fmt.Sprintf("clientgone fallback loser recorded: channel #%d (%s), prompt=%d completion=%d",
		loserChannelId, loserChannelName, promptTokens, completionTokens))
}
