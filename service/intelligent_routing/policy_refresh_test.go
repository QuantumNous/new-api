package intelligent_routing

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestPolicyRefreshStopsAfterCancellation(t *testing.T) {
	repo := &policyRepositoryFixture{}
	control := NewPolicyControl(repo, "salt")
	triggers := make(chan time.Time, 2)
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		runPolicyRefresh(ctx, control, triggers)
		close(done)
	}()

	triggers <- time.Now()
	cancel()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("refresh loop did not stop after cancellation")
	}
	assert.False(t, control.Snapshot().Rollout.Enabled)
}
