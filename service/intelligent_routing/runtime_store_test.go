package intelligent_routing

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestSharedRuntimeRequiresConfiguredHealthyState(t *testing.T) {
	runtime := &SharedRuntime{}
	assert.False(t, runtime.Ready())

	runtime.Configure(true)
	assert.False(t, runtime.Ready())

	runtime.SetHealthy(true)
	assert.True(t, runtime.Ready())

	runtime.SetHealthy(false)
	assert.False(t, runtime.Ready())
}

func TestSharedRuntimeDisabledNeverBecomesReady(t *testing.T) {
	runtime := &SharedRuntime{}
	runtime.Configure(false)
	runtime.SetHealthy(true)
	assert.False(t, runtime.Ready())
}
