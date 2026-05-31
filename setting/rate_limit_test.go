package setting

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestUpdateModelRequestRateLimitGroupByJSONStringPreservesExistingOnInvalidJSON(t *testing.T) {
	ModelRequestRateLimitMutex.Lock()
	original := ModelRequestRateLimitGroup
	ModelRequestRateLimitGroup = map[string][2]int{
		"default": {10, 8},
	}
	ModelRequestRateLimitMutex.Unlock()
	t.Cleanup(func() {
		ModelRequestRateLimitMutex.Lock()
		ModelRequestRateLimitGroup = original
		ModelRequestRateLimitMutex.Unlock()
	})

	err := UpdateModelRequestRateLimitGroupByJSONString(`{"default":`)
	require.Error(t, err)

	total, success, found := GetGroupRateLimit("default")
	require.True(t, found)
	require.Equal(t, 10, total)
	require.Equal(t, 8, success)
}

func TestUpdateModelRequestRateLimitGroupByJSONStringReplacesExistingOnValidJSON(t *testing.T) {
	ModelRequestRateLimitMutex.Lock()
	original := ModelRequestRateLimitGroup
	ModelRequestRateLimitGroup = map[string][2]int{
		"default": {10, 8},
	}
	ModelRequestRateLimitMutex.Unlock()
	t.Cleanup(func() {
		ModelRequestRateLimitMutex.Lock()
		ModelRequestRateLimitGroup = original
		ModelRequestRateLimitMutex.Unlock()
	})

	err := UpdateModelRequestRateLimitGroupByJSONString(`{"vip":[20,15]}`)
	require.NoError(t, err)

	_, _, found := GetGroupRateLimit("default")
	require.False(t, found)

	total, success, found := GetGroupRateLimit("vip")
	require.True(t, found)
	require.Equal(t, 20, total)
	require.Equal(t, 15, success)
}
