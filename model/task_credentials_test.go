package model

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/stretchr/testify/assert"
)

func TestInitTaskPersistsCredentialReferenceWithoutPlaintextKey(t *testing.T) {
	task := InitTask(constant.TaskPlatform("test"), &relaycommon.RelayInfo{
		UserId: 1,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelId:            9,
			ChannelType:          constant.ChannelTypeGemini,
			ChannelIsMultiKey:    true,
			ChannelMultiKeyIndex: 1,
			ApiKey:               "plaintext-secret",
		},
	})

	assert.Empty(t, task.PrivateData.Key)
	assert.Equal(t, 1, task.PrivateData.ChannelKeyIndex)
}

func TestResolveTaskChannelKeyUsesReferenceAndLegacyFallback(t *testing.T) {
	channel := &Channel{
		Key: "first\nsecond",
		ChannelInfo: ChannelInfo{
			IsMultiKey: true,
		},
	}

	assert.Equal(t, "second", ResolveTaskChannelKey(channel, &Task{
		PrivateData: TaskPrivateData{ChannelKeyIndex: 1},
	}))
	assert.Equal(t, "legacy", ResolveTaskChannelKey(channel, &Task{
		PrivateData: TaskPrivateData{Key: " legacy ", ChannelKeyIndex: 1},
	}))
	assert.Empty(t, ResolveTaskChannelKey(channel, &Task{
		PrivateData: TaskPrivateData{ChannelKeyIndex: 5},
	}))
}
