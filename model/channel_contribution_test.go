package model

import (
	"errors"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func newChannelContributionDraft(t *testing.T, userId int, name string, models string) (*ChannelContribution, *ChannelContributionRevision) {
	t.Helper()
	revision := &ChannelContributionRevision{
		Name:         name,
		Type:         constant.ChannelTypeOpenAI,
		BaseURL:      "https://example.com",
		Key:          "sk-test",
		Group:        "default",
		Models:       models,
		ModelMapping: `{"gpt-test":"upstream-gpt-test"}`,
	}
	configHash, err := ComputeChannelContributionConfigHash(revision)
	require.NoError(t, err)
	revision.ConfigHash = configHash
	contribution := &ChannelContribution{
		UserId:   userId,
		Username: "contributor",
		Status:   ChannelContributionStatusDraft,
	}
	require.NoError(t, CreateChannelContributionWithRevision(contribution, revision))
	return contribution, revision
}

func newPendingChannelContribution(t *testing.T) (*ChannelContribution, *ChannelContributionRevision) {
	t.Helper()
	contribution, revision := newChannelContributionDraft(t, 42, "shared upstream", "gpt-test,gpt-test-mini")
	require.NoError(t, SubmitChannelContribution(
		contribution.Id,
		contribution.UserId,
		revision.Id,
		revision.ConfigHash,
		"v1",
		"agreement",
		"agreement-hash",
		100,
	))
	contribution, err := GetChannelContributionById(contribution.Id)
	require.NoError(t, err)
	revision, err = GetChannelContributionRevision(contribution.Id, revision.Id)
	require.NoError(t, err)
	return contribution, revision
}

func approveChannelContributionFixture(t *testing.T) (*ChannelContribution, *ChannelContributionRevision, *Channel) {
	t.Helper()
	contribution, revision := newPendingChannelContribution(t)
	approved, channel, err := ApproveChannelContribution(contribution.Id, revision.Id, ChannelContributionApproval{
		ReviewerId:       7,
		ReviewerUsername: "reviewer",
		Tag:              "donate",
		Priority:         100,
		Weight:           0,
	})
	require.NoError(t, err)
	return approved, revision, channel
}

func TestChannelContributionRevisionKeepsLateTestResultsIsolated(t *testing.T) {
	truncateTables(t)
	contribution, firstRevision := newChannelContributionDraft(t, 42, "first", "gpt-test")
	run := &ChannelContributionTestRun{
		ContributionId: contribution.Id,
		RevisionId:     firstRevision.Id,
		ConfigHash:     firstRevision.ConfigHash,
		ActorId:        contribution.UserId,
		ActorType:      ChannelContributionTestActorUser,
	}
	require.NoError(t, CreateChannelContributionTestRun(run))
	claimed, err := ClaimNextQueuedChannelContributionTestRun()
	require.NoError(t, err)
	assert.Equal(t, run.Id, claimed.Id)

	secondRevision := &ChannelContributionRevision{
		Name:         "second",
		Type:         constant.ChannelTypeOpenAI,
		BaseURL:      "https://second.example.com",
		Key:          "sk-second",
		Group:        "default",
		Models:       "gpt-test",
		ModelMapping: "{}",
	}
	secondRevision.ConfigHash, err = ComputeChannelContributionConfigHash(secondRevision)
	require.NoError(t, err)
	require.NoError(t, CreateChannelContributionRevision(contribution.Id, contribution.UserId, secondRevision))
	require.NoError(t, FinishChannelContributionTestRun(run.Id, ChannelContributionTestRunStatusSucceeded, true, []ChannelContributionTestResult{{
		Model:        "gpt-test",
		EndpointType: string(constant.EndpointTypeOpenAI),
		Success:      true,
	}}, ""))

	firstRun, err := GetLatestSuccessfulChannelContributionTestRun(firstRevision.Id, firstRevision.ConfigHash)
	require.NoError(t, err)
	assert.Equal(t, run.Id, firstRun.Id)
	_, err = GetLatestSuccessfulChannelContributionTestRun(secondRevision.Id, secondRevision.ConfigHash)
	assert.True(t, errors.Is(err, gorm.ErrRecordNotFound))
	reloaded, err := GetChannelContributionById(contribution.Id)
	require.NoError(t, err)
	require.NotNil(t, reloaded.CurrentRevisionId)
	assert.Equal(t, secondRevision.Id, *reloaded.CurrentRevisionId)
}

func TestChannelContributionTestRunAllowsOnlyOneActiveRunPerUser(t *testing.T) {
	truncateTables(t)
	contribution, revision := newChannelContributionDraft(t, 42, "first", "gpt-test")
	first := &ChannelContributionTestRun{
		ContributionId: contribution.Id,
		RevisionId:     revision.Id,
		ConfigHash:     revision.ConfigHash,
		ActorId:        contribution.UserId,
		ActorType:      ChannelContributionTestActorUser,
	}
	require.NoError(t, CreateChannelContributionTestRun(first))
	second := &ChannelContributionTestRun{
		ContributionId: contribution.Id,
		RevisionId:     revision.Id,
		ConfigHash:     revision.ConfigHash,
		ActorId:        contribution.UserId,
		ActorType:      ChannelContributionTestActorUser,
	}
	require.Error(t, CreateChannelContributionTestRun(second))
}

func TestChannelContributionAdminTestRunUniquenessUsesAdminActor(t *testing.T) {
	truncateTables(t)
	firstContribution, firstRevision := newChannelContributionDraft(t, 42, "first", "gpt-test")
	secondContribution, secondRevision := newChannelContributionDraft(t, 43, "second", "gpt-test")
	firstAdminRun := &ChannelContributionTestRun{
		ContributionId: firstContribution.Id,
		RevisionId:     firstRevision.Id,
		ConfigHash:     firstRevision.ConfigHash,
		ActorId:        99,
		ActorType:      ChannelContributionTestActorAdmin,
	}
	require.NoError(t, CreateChannelContributionTestRun(firstAdminRun))
	sameAdminOtherContribution := &ChannelContributionTestRun{
		ContributionId: secondContribution.Id,
		RevisionId:     secondRevision.Id,
		ConfigHash:     secondRevision.ConfigHash,
		ActorId:        99,
		ActorType:      ChannelContributionTestActorAdmin,
	}
	require.Error(t, CreateChannelContributionTestRun(sameAdminOtherContribution))
	otherAdminSameContribution := &ChannelContributionTestRun{
		ContributionId: firstContribution.Id,
		RevisionId:     firstRevision.Id,
		ConfigHash:     firstRevision.ConfigHash,
		ActorId:        100,
		ActorType:      ChannelContributionTestActorAdmin,
	}
	require.NoError(t, CreateChannelContributionTestRun(otherAdminSameContribution))
}

func TestRequeueRunningChannelContributionTestRunsRecoversInterruptedRun(t *testing.T) {
	truncateTables(t)
	contribution, revision := newChannelContributionDraft(t, 42, "first", "gpt-test")
	run := &ChannelContributionTestRun{
		ContributionId: contribution.Id,
		RevisionId:     revision.Id,
		ConfigHash:     revision.ConfigHash,
		ActorId:        contribution.UserId,
		ActorType:      ChannelContributionTestActorUser,
	}
	require.NoError(t, CreateChannelContributionTestRun(run))
	assert.True(t, HasUnfinishedChannelContributionTestRuns())
	_, err := ClaimNextQueuedChannelContributionTestRun()
	require.NoError(t, err)
	assert.True(t, HasUnfinishedChannelContributionTestRuns())
	requeued, err := RequeueRunningChannelContributionTestRuns()
	require.NoError(t, err)
	assert.Equal(t, int64(1), requeued)
	reloaded, err := GetChannelContributionTestRun(run.Id)
	require.NoError(t, err)
	assert.Equal(t, ChannelContributionTestRunStatusQueued, reloaded.Status)
	assert.Zero(t, reloaded.StartedAt)
}

func TestApproveChannelContributionCreatesChannelAndAbilities(t *testing.T) {
	truncateTables(t)
	approved, _, channel := approveChannelContributionFixture(t)

	assert.Equal(t, ChannelContributionStatusApproved, approved.Status)
	assert.Equal(t, common.ChannelStatusEnabled, channel.Status)
	assert.Equal(t, "sk-test", channel.Key)
	assert.Equal(t, "default", channel.Group)
	assert.Equal(t, int64(100), channel.GetPriority())
	assert.Equal(t, 0, channel.GetWeight())
	require.NotNil(t, channel.Tag)
	assert.Equal(t, "donate", *channel.Tag)
	require.NotNil(t, channel.Remark)
	assert.Equal(t, "贡献者：42 contributor", *channel.Remark)

	var abilities []Ability
	require.NoError(t, DB.Where("channel_id = ?", channel.Id).Order("model asc").Find(&abilities).Error)
	require.Len(t, abilities, 2)
	assert.Equal(t, "gpt-test", abilities[0].Model)
	assert.Equal(t, "gpt-test-mini", abilities[1].Model)
}

func TestModificationReviewPreservesActiveChannelAndAdminRouting(t *testing.T) {
	truncateTables(t)
	approved, _, channel := approveChannelContributionFixture(t)
	adminTag := "admin-managed"
	adminPriority := int64(7)
	adminWeight := uint(9)
	require.NoError(t, DB.Model(&Channel{}).Where("id = ?", channel.Id).Updates(map[string]any{
		"status":   common.ChannelStatusManuallyDisabled,
		"tag":      adminTag,
		"priority": adminPriority,
		"weight":   adminWeight,
	}).Error)

	nextRevision := &ChannelContributionRevision{
		Name:         "updated upstream",
		Type:         constant.ChannelTypeOpenAI,
		BaseURL:      "https://updated.example.com",
		Key:          "sk-updated",
		Group:        "default",
		Models:       "gpt-test",
		ModelMapping: "{}",
	}
	var err error
	nextRevision.ConfigHash, err = ComputeChannelContributionConfigHash(nextRevision)
	require.NoError(t, err)
	require.NoError(t, CreateChannelContributionRevision(approved.Id, approved.UserId, nextRevision))
	require.NoError(t, SubmitChannelContribution(
		approved.Id,
		approved.UserId,
		nextRevision.Id,
		nextRevision.ConfigHash,
		"v2",
		"updated agreement",
		"updated-agreement-hash",
		200,
	))

	pending, err := GetChannelContributionById(approved.Id)
	require.NoError(t, err)
	assert.Equal(t, ChannelContributionStatusApproved, pending.Status)
	require.NotNil(t, pending.PendingRevisionId)
	activeChannel, err := GetChannelById(channel.Id, true)
	require.NoError(t, err)
	assert.Equal(t, "shared upstream", activeChannel.Name)
	assert.Equal(t, "sk-test", activeChannel.Key)

	_, updatedChannel, err := ApproveChannelContribution(approved.Id, nextRevision.Id, ChannelContributionApproval{
		ReviewerId:       8,
		ReviewerUsername: "second-reviewer",
		Tag:              "new-default",
		Priority:         999,
		Weight:           1,
	})
	require.NoError(t, err)
	assert.Equal(t, "updated upstream", updatedChannel.Name)
	assert.Equal(t, "sk-updated", updatedChannel.Key)
	assert.Equal(t, common.ChannelStatusManuallyDisabled, updatedChannel.Status)
	require.NotNil(t, updatedChannel.Tag)
	assert.Equal(t, adminTag, *updatedChannel.Tag)
	assert.Equal(t, adminPriority, updatedChannel.GetPriority())
	assert.Equal(t, int(adminWeight), updatedChannel.GetWeight())
}

func TestWithdrawChannelContributionClearsKeysAndDeletesChannel(t *testing.T) {
	truncateTables(t)
	approved, _, channel := approveChannelContributionFixture(t)
	require.NoError(t, WithdrawChannelContribution(approved.Id, approved.UserId))

	withdrawn, err := GetChannelContributionById(approved.Id)
	require.NoError(t, err)
	assert.Equal(t, ChannelContributionStatusDeleted, withdrawn.Status)
	revisions, err := ListChannelContributionRevisions(approved.Id)
	require.NoError(t, err)
	require.NotEmpty(t, revisions)
	for _, revision := range revisions {
		assert.Empty(t, revision.Key)
	}
	var channelCount int64
	require.NoError(t, DB.Model(&Channel{}).Where("id = ?", channel.Id).Count(&channelCount).Error)
	assert.Zero(t, channelCount)
	var abilityCount int64
	require.NoError(t, DB.Model(&Ability{}).Where("channel_id = ?", channel.Id).Count(&abilityCount).Error)
	assert.Zero(t, abilityCount)
}
