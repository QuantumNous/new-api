package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestStreamCacheQueueLengthOptionRemainsIndependentOfSensitiveWords(t *testing.T) {
	previousLength := setting.StreamCacheQueueLength
	common.OptionMapRWMutex.Lock()
	previousOptions := common.OptionMap
	common.OptionMap = map[string]string{}
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		setting.StreamCacheQueueLength = previousLength
		common.OptionMapRWMutex.Lock()
		common.OptionMap = previousOptions
		common.OptionMapRWMutex.Unlock()
	})

	require.NoError(t, updateOptionMap("StreamCacheQueueLength", "17"))
	assert.Equal(t, 17, setting.StreamCacheQueueLength)
	common.OptionMapRWMutex.RLock()
	assert.Equal(t, "17", common.OptionMap["StreamCacheQueueLength"])
	common.OptionMapRWMutex.RUnlock()
}
