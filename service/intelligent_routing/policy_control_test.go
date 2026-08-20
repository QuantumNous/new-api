package intelligent_routing

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type policyRepositoryFixture struct {
	policies    map[int64]model.IntelligentRoutingPolicy
	rollout     model.IntelligentRoutingRollout
	createCalls int
	err         error
	nextID      int64
}

func (repo *policyRepositoryFixture) CreateDraft(policy model.IntelligentRoutingPolicy) (model.IntelligentRoutingPolicy, error) {
	repo.createCalls++
	repo.nextID++
	policy.Id = repo.nextID
	policy.Status = model.IntelligentRoutingPolicyDraft
	policy.UpdatedAt = time.Now()
	if repo.policies == nil {
		repo.policies = make(map[int64]model.IntelligentRoutingPolicy)
	}
	repo.policies[policy.Id] = policy
	return policy, repo.err
}

func (repo *policyRepositoryFixture) UpdateDraft(id int64, updatedAt time.Time, config, checksum string) (model.IntelligentRoutingPolicy, error) {
	policy := repo.policies[id]
	policy.Config, policy.Checksum = config, checksum
	repo.policies[id] = policy
	return policy, repo.err
}

func (repo *policyRepositoryFixture) GetPolicy(id int64) (model.IntelligentRoutingPolicy, error) {
	policy, ok := repo.policies[id]
	if !ok {
		return policy, model.ErrIntelligentRoutingPolicyNotFound
	}
	return policy, repo.err
}

func (repo *policyRepositoryFixture) GetPolicyByVersion(version int) (model.IntelligentRoutingPolicy, error) {
	for _, policy := range repo.policies {
		if policy.Version == version {
			return policy, repo.err
		}
	}
	return model.IntelligentRoutingPolicy{}, model.ErrIntelligentRoutingPolicyNotFound
}

func (repo *policyRepositoryFixture) Publish(id int64, administratorID int, note string) (model.IntelligentRoutingPolicy, error) {
	policy := repo.policies[id]
	policy.Version, policy.Status, policy.ChangeNote = 1, model.IntelligentRoutingPolicyActive, note
	repo.policies[id] = policy
	return policy, repo.err
}

func (repo *policyRepositoryFixture) Rollback(version int, administratorID int, note string) (model.IntelligentRoutingPolicy, error) {
	policy, err := repo.GetPolicyByVersion(version)
	if err != nil {
		return policy, err
	}
	policy.Version, policy.SourceVersion, policy.ChangeNote = version+1, version, note
	repo.nextID++
	policy.Id = repo.nextID
	repo.policies[policy.Id] = policy
	return policy, repo.err
}

func (repo *policyRepositoryFixture) GetRollout() (model.IntelligentRoutingRollout, error) {
	if repo.err != nil {
		return model.IntelligentRoutingRollout{}, repo.err
	}
	if repo.rollout.Id == 0 {
		return model.IntelligentRoutingRollout{}, model.ErrIntelligentRoutingRolloutNotFound
	}
	return repo.rollout, nil
}

func (repo *policyRepositoryFixture) UpdateRollout(revision int64, rollout model.IntelligentRoutingRollout) (model.IntelligentRoutingRollout, error) {
	if repo.err != nil {
		return model.IntelligentRoutingRollout{}, repo.err
	}
	rollout.Id, rollout.Revision = 1, revision+1
	repo.rollout = rollout
	return rollout, nil
}

func TestPolicyControlRejectsInvalidDraftBeforeRepositoryWrite(t *testing.T) {
	repo := &policyRepositoryFixture{}
	control := NewPolicyControl(repo, "deployment-salt")

	_, issues, err := control.CreateDraft(context.Background(), `{"max_attempts":99}`, 7)
	require.NoError(t, err)
	require.NotEmpty(t, issues)
	assert.Zero(t, repo.createCalls)
}

func TestPolicyControlRefreshRetainsLastValidSnapshot(t *testing.T) {
	repo := &policyRepositoryFixture{}
	control := NewPolicyControl(repo, "deployment-salt")
	draft, issues, err := control.CreateDraft(context.Background(), `{"models":[{"model":"cheap","tier":1,"context_limit":4096}]}`, 7)
	require.NoError(t, err)
	require.Empty(t, issues)
	policy := repo.policies[draft.Id]
	policy.Version, policy.Status = 1, model.IntelligentRoutingPolicyActive
	repo.policies[draft.Id] = policy
	repo.rollout = model.IntelligentRoutingRollout{Id: 1, Revision: 2, PolicyVersion: 1, Enabled: true, Mode: model.IntelligentRoutingModeShadow, TrafficPercent: 100, UserGroups: `[]`, TokenGroups: `[]`}

	require.NoError(t, control.RefreshSnapshot(context.Background()))
	before := control.Snapshot()
	assert.True(t, before.Rollout.Enabled)

	repo.err = errors.New("database unavailable")
	assert.Error(t, control.RefreshSnapshot(context.Background()))
	after := control.Snapshot()
	assert.Equal(t, before.Rollout.Revision, after.Rollout.Revision)
}
