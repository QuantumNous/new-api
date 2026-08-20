package intelligent_routing

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestResolveRolloutUsesStableSubjectBucket(t *testing.T) {
	snapshot := RuntimePolicySnapshot{DeploymentSalt: "salt", Rollout: RuntimeRollout{
		Exists: true, Revision: 3, PolicyVersion: 2, Enabled: true, Mode: "live", TrafficPercent: 100,
		UserGroups: []string{"default"}, TokenGroups: []string{"auto"},
	}}
	subject := RolloutSubject{AccountID: 42, TokenID: 9, UserGroup: "default", TokenGroup: "auto"}

	first := ResolveRollout(snapshot, subject)
	second := ResolveRollout(snapshot, subject)

	assert.True(t, first.Selected)
	assert.Equal(t, first.Bucket, second.Bucket)
	assert.Equal(t, "live", first.Mode)
}

func TestResolveRolloutRejectsDisabledExcludedAndZeroPercent(t *testing.T) {
	base := RuntimePolicySnapshot{DeploymentSalt: "salt", Rollout: RuntimeRollout{
		Exists: true, PolicyVersion: 1, Enabled: true, Mode: "shadow", TrafficPercent: 100,
		UserGroups: []string{"allowed"}, TokenGroups: []string{"auto"},
	}}
	subject := RolloutSubject{AccountID: 1, TokenID: 2, UserGroup: "other", TokenGroup: "auto"}
	assert.False(t, ResolveRollout(base, subject).Selected)

	base.Rollout.UserGroups = nil
	base.Rollout.Enabled = false
	assert.False(t, ResolveRollout(base, subject).Selected)

	base.Rollout.Enabled = true
	base.Rollout.TrafficPercent = 0
	assert.False(t, ResolveRollout(base, subject).Selected)
}
