package service

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"

	"github.com/gin-gonic/gin"
)

const channelContributionRewardBpsOptionKey = "channel_contribution_setting.reward_bps"

func currentChannelContributionRewardBps() int {
	common.OptionMapRWMutex.RLock()
	raw := strings.TrimSpace(common.OptionMap[channelContributionRewardBpsOptionKey])
	common.OptionMapRWMutex.RUnlock()
	bps, err := strconv.Atoi(raw)
	if err != nil || bps <= 0 {
		return 0
	}
	if bps > 10_000 {
		return 10_000
	}
	return bps
}

// SnapshotChannelContributionReward captures the configured reward rate before
// channel selection and retries. Settlement resolves the final channel owner.
func SnapshotChannelContributionReward(_ *gin.Context, info *relaycommon.RelayInfo) {
	if info == nil {
		return
	}
	if info.ContributionRewardSnapshotted {
		return
	}
	info.ContributionRewardBps = currentChannelContributionRewardBps()
	info.ContributionRewardSnapshotted = true
}

// SettleChannelContributionReward credits the contributor once for the final
// charged quota. The model layer enforces channel+request idempotency.
func SettleChannelContributionReward(ctx *gin.Context, info *relaycommon.RelayInfo, chargedQuota int) {
	if info == nil || chargedQuota <= 0 || info.IsChannelTest || info.ContributionRewardBps <= 0 ||
		info.UserId <= 0 || info.ChannelMeta == nil || info.ChannelId <= 0 || info.RequestId == "" {
		return
	}
	target, err := model.GetActiveChannelContributionRewardTarget(info.ChannelId)
	if err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("failed to resolve final channel contribution reward target: channel_id=%d err=%v", info.ChannelId, err))
		return
	}
	if target == nil || target.UserId == info.UserId {
		return
	}
	reward, clamp := common.QuotaFromFloatChecked(float64(chargedQuota) * float64(info.ContributionRewardBps) / 10_000)
	if clamp != nil {
		if info.QuotaClamp == nil {
			info.QuotaClamp = clamp
		}
		logger.LogWarn(ctx, fmt.Sprintf(
			"channel contribution reward saturated: request_id=%s channel_id=%d source_quota=%d reward_bps=%d clamp=%v",
			info.RequestId,
			info.ChannelId,
			chargedQuota,
			info.ContributionRewardBps,
			clamp,
		))
	}
	if reward <= 0 {
		return
	}
	_, err = model.CreditChannelContributionReward(
		target.UserId,
		target.ContributionId,
		info.ChannelId,
		info.RequestId,
		chargedQuota,
		info.ContributionRewardBps,
		reward,
		clamp,
	)
	if err != nil {
		logger.LogWarn(ctx, fmt.Sprintf(
			"failed to settle channel contribution reward: request_id=%s channel_id=%d contributor_id=%d err=%v",
			info.RequestId,
			info.ChannelId,
			target.UserId,
			err,
		))
	}
}
