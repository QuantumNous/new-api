package model

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func resetIntelligentRoutingPolicyTables(t *testing.T) {
	t.Helper()
	require.NoError(t, DB.AutoMigrate(&IntelligentRoutingPolicy{}, &IntelligentRoutingRollout{}))
	require.NoError(t, DB.Exec("DELETE FROM intelligent_routing_rollouts").Error)
	require.NoError(t, DB.Exec("DELETE FROM intelligent_routing_policies").Error)
	t.Cleanup(func() {
		require.NoError(t, DB.Exec("DELETE FROM intelligent_routing_rollouts").Error)
		require.NoError(t, DB.Exec("DELETE FROM intelligent_routing_policies").Error)
	})
}

func TestIntelligentRoutingPolicyDraftLifecycle(t *testing.T) {
	resetIntelligentRoutingPolicyTables(t)

	draft, err := CreateIntelligentRoutingDraft(IntelligentRoutingPolicy{
		Status: IntelligentRoutingPolicyDraft, Config: `{"enabled":false}`, Checksum: "sum", CreatedBy: 11,
	})
	require.NoError(t, err)
	assert.Equal(t, IntelligentRoutingPolicyDraft, draft.Status)

	stored, err := GetIntelligentRoutingPolicy(draft.Id)
	require.NoError(t, err)
	assert.Equal(t, draft.Id, stored.Id)

	stored.Status = IntelligentRoutingPolicyActive
	require.NoError(t, DB.Save(&stored).Error)
	_, err = UpdateIntelligentRoutingDraft(stored.Id, stored.UpdatedAt, `{"enabled":true}`, "next")
	assert.ErrorIs(t, err, ErrIntelligentRoutingPolicyImmutable)
}

func TestIntelligentRoutingPolicyPublishArchivesPriorVersion(t *testing.T) {
	resetIntelligentRoutingPolicyTables(t)

	first, err := CreateIntelligentRoutingDraft(IntelligentRoutingPolicy{Config: `{"enabled":false}`, Checksum: "one", CreatedBy: 1})
	require.NoError(t, err)
	first, err = PublishIntelligentRoutingPolicy(first.Id, 1, "first")
	require.NoError(t, err)
	assert.Equal(t, 1, first.Version)
	assert.Equal(t, IntelligentRoutingPolicyActive, first.Status)

	second, err := CreateIntelligentRoutingDraft(IntelligentRoutingPolicy{Config: `{"enabled":true}`, Checksum: "two", CreatedBy: 2})
	require.NoError(t, err)
	second, err = PublishIntelligentRoutingPolicy(second.Id, 2, "second")
	require.NoError(t, err)
	assert.Equal(t, 2, second.Version)

	first, err = GetIntelligentRoutingPolicy(first.Id)
	require.NoError(t, err)
	assert.Equal(t, IntelligentRoutingPolicyArchived, first.Status)
}

func TestIntelligentRoutingPolicyRollbackCreatesNewVersion(t *testing.T) {
	resetIntelligentRoutingPolicyTables(t)

	first, err := CreateIntelligentRoutingDraft(IntelligentRoutingPolicy{Config: `{"enabled":false}`, Checksum: "one", CreatedBy: 1})
	require.NoError(t, err)
	_, err = PublishIntelligentRoutingPolicy(first.Id, 1, "first")
	require.NoError(t, err)
	second, err := CreateIntelligentRoutingDraft(IntelligentRoutingPolicy{Config: `{"enabled":true}`, Checksum: "two", CreatedBy: 2})
	require.NoError(t, err)
	_, err = PublishIntelligentRoutingPolicy(second.Id, 2, "second")
	require.NoError(t, err)

	rolledBack, err := RollbackIntelligentRoutingPolicy(1, 3, "restore first")
	require.NoError(t, err)
	assert.Equal(t, 3, rolledBack.Version)
	assert.Equal(t, 1, rolledBack.SourceVersion)
	assert.Equal(t, `{"enabled":false}`, rolledBack.Config)
}

func TestIntelligentRoutingRolloutRejectsStaleRevision(t *testing.T) {
	resetIntelligentRoutingPolicyTables(t)

	rollout, err := UpdateIntelligentRoutingRollout(0, IntelligentRoutingRollout{PolicyVersion: 1, Enabled: true, Mode: IntelligentRoutingModeShadow, TrafficPercent: 25})
	require.NoError(t, err)
	assert.Equal(t, int64(1), rollout.Revision)

	_, err = UpdateIntelligentRoutingRollout(0, IntelligentRoutingRollout{PolicyVersion: 1, Enabled: false, Mode: IntelligentRoutingModeShadow})
	assert.True(t, errors.Is(err, ErrIntelligentRoutingRevisionConflict))

	stored, err := GetIntelligentRoutingRollout()
	require.NoError(t, err)
	assert.True(t, stored.Enabled)
}
