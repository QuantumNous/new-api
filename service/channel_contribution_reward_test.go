package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func prepareChannelContributionRewardServiceTest(t *testing.T) {
	t.Helper()
	require.NoError(t, model.DB.AutoMigrate(
		&model.Channel{},
		&model.Ability{},
		&model.ChannelContribution{},
		&model.ChannelContributionRevision{},
		&model.ChannelContributionModelHealth{},
		&model.ChannelContributionRewardAccount{},
		&model.ChannelContributionRewardLedger{},
	))
	clear := func() {
		model.DB.Exec("DELETE FROM channel_contribution_reward_ledgers")
		model.DB.Exec("DELETE FROM channel_contribution_reward_accounts")
		model.DB.Exec("DELETE FROM channel_contribution_revisions")
		model.DB.Exec("DELETE FROM channel_contributions")
		model.DB.Exec("DELETE FROM abilities")
		model.DB.Exec("DELETE FROM channels")
	}
	clear()
	t.Cleanup(clear)

	common.OptionMapRWMutex.Lock()
	wasNil := common.OptionMap == nil
	if wasNil {
		common.OptionMap = make(map[string]string)
	}
	previous, existed := common.OptionMap[channelContributionRewardBpsOptionKey]
	common.OptionMap[channelContributionRewardBpsOptionKey] = "500"
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		if wasNil {
			common.OptionMap = nil
		} else if existed {
			common.OptionMap[channelContributionRewardBpsOptionKey] = previous
		} else {
			delete(common.OptionMap, channelContributionRewardBpsOptionKey)
		}
		common.OptionMapRWMutex.Unlock()
	})
}

func seedRewardTargetChannel(t *testing.T, contributorID int) (*model.Channel, *model.Channel) {
	t.Helper()
	ordinary := &model.Channel{Name: "ordinary", Type: 1, Key: "ordinary-key", Status: common.ChannelStatusEnabled, Models: "test-model", Group: "default"}
	require.NoError(t, ordinary.Insert())
	contributed := &model.Channel{Name: "contributed", Type: 1, Key: "contributed-key", Status: common.ChannelStatusEnabled, Models: "test-model", Group: "default"}
	require.NoError(t, contributed.Insert())
	channelID := contributed.Id
	contribution := &model.ChannelContribution{
		UserId:    contributorID,
		Username:  "contributor",
		Status:    model.ChannelContributionStatusApproved,
		ChannelId: &channelID,
	}
	require.NoError(t, model.DB.Create(contribution).Error)
	return ordinary, contributed
}

func TestSnapshotChannelContributionRewardDoesNotRequireSelectedChannel(t *testing.T) {
	prepareChannelContributionRewardServiceTest(t)
	info := &relaycommon.RelayInfo{}
	require.NotPanics(t, func() {
		SnapshotChannelContributionReward(nil, info)
	})
	assert.Equal(t, 500, info.ContributionRewardBps)
	assert.True(t, info.ContributionRewardSnapshotted)

	common.OptionMapRWMutex.Lock()
	common.OptionMap[channelContributionRewardBpsOptionKey] = "900"
	common.OptionMapRWMutex.Unlock()
	SnapshotChannelContributionReward(nil, info)
	assert.Equal(t, 500, info.ContributionRewardBps)
}

func TestSettleChannelContributionRewardUsesFinalChannelAndIsIdempotent(t *testing.T) {
	prepareChannelContributionRewardServiceTest(t)
	ordinary, contributed := seedRewardTargetChannel(t, 42)
	info := &relaycommon.RelayInfo{UserId: 7, RequestId: "request-final-contribution"}
	SnapshotChannelContributionReward(nil, info)

	info.ChannelMeta = &relaycommon.ChannelMeta{ChannelId: ordinary.Id}
	SettleChannelContributionReward(nil, info, 1_000)
	account, err := model.GetChannelContributionRewardAccount(42)
	require.NoError(t, err)
	assert.Zero(t, account.Balance)

	info.ChannelMeta = &relaycommon.ChannelMeta{ChannelId: contributed.Id}
	SettleChannelContributionReward(nil, info, 1_000)
	SettleChannelContributionReward(nil, info, 1_000)
	account, err = model.GetChannelContributionRewardAccount(42)
	require.NoError(t, err)
	assert.Equal(t, int64(50), account.Balance)
	entries, total, err := model.ListChannelContributionRewardLedger(42, 0, 20)
	require.NoError(t, err)
	assert.Equal(t, int64(1), total)
	require.Len(t, entries, 1)
	assert.Equal(t, 500, entries[0].RewardBps)
	assert.Equal(t, 1_000, entries[0].SourceQuota)

	info.RequestId = "request-final-ordinary"
	info.ChannelMeta = &relaycommon.ChannelMeta{ChannelId: contributed.Id}
	SnapshotChannelContributionReward(nil, info)
	info.ChannelMeta = &relaycommon.ChannelMeta{ChannelId: ordinary.Id}
	SettleChannelContributionReward(nil, info, 1_000)
	account, err = model.GetChannelContributionRewardAccount(42)
	require.NoError(t, err)
	assert.Equal(t, int64(50), account.Balance)
	deleted, err := model.BatchDeleteChannels([]int{contributed.Id})
	require.NoError(t, err)
	assert.Equal(t, int64(1), deleted)
	account, err = model.GetChannelContributionRewardAccount(42)
	require.NoError(t, err)
	assert.Equal(t, int64(50), account.Balance)
	_, total, err = model.ListChannelContributionRewardLedger(42, 0, 20)
	require.NoError(t, err)
	assert.Equal(t, int64(1), total)
}

func TestSettleChannelContributionRewardExcludesSelfTestAndFreeRequests(t *testing.T) {
	prepareChannelContributionRewardServiceTest(t)
	_, contributed := seedRewardTargetChannel(t, 42)

	cases := []struct {
		name  string
		info  *relaycommon.RelayInfo
		quota int
	}{
		{
			name: "self use",
			info: &relaycommon.RelayInfo{
				UserId:                42,
				RequestId:             "self-use",
				ContributionRewardBps: 500,
				ChannelMeta:           &relaycommon.ChannelMeta{ChannelId: contributed.Id},
			},
			quota: 1_000,
		},
		{
			name: "channel test",
			info: &relaycommon.RelayInfo{
				UserId:                7,
				RequestId:             "channel-test",
				IsChannelTest:         true,
				ContributionRewardBps: 500,
				ChannelMeta:           &relaycommon.ChannelMeta{ChannelId: contributed.Id},
			},
			quota: 1_000,
		},
		{
			name: "free request",
			info: &relaycommon.RelayInfo{
				UserId:                7,
				RequestId:             "free-request",
				ContributionRewardBps: 500,
				ChannelMeta:           &relaycommon.ChannelMeta{ChannelId: contributed.Id},
			},
			quota: 0,
		},
	}
	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			SettleChannelContributionReward(nil, test.info, test.quota)
		})
	}
	account, err := model.GetChannelContributionRewardAccount(42)
	require.NoError(t, err)
	assert.Zero(t, account.Balance)
	_, total, err := model.ListChannelContributionRewardLedger(42, 0, 20)
	require.NoError(t, err)
	assert.Zero(t, total)
}

func TestSettleBillingCreditsRewardWhenPreConsumedQuotaMatchesFinalQuota(t *testing.T) {
	prepareChannelContributionRewardServiceTest(t)
	_, contributed := seedRewardTargetChannel(t, 42)
	info := &relaycommon.RelayInfo{
		UserId:                        7,
		RequestId:                     "request-settle-billing",
		FinalPreConsumedQuota:         1_000,
		ChannelMeta:                   &relaycommon.ChannelMeta{ChannelId: contributed.Id},
		ContributionRewardBps:         500,
		ContributionRewardSnapshotted: true,
	}

	require.NoError(t, SettleBilling(nil, info, 1_000))
	account, err := model.GetChannelContributionRewardAccount(42)
	require.NoError(t, err)
	assert.Equal(t, int64(50), account.Balance)
}
