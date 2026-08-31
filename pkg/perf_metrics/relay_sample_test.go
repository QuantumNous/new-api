package perfmetrics

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/stretchr/testify/assert"
)

func TestRecordRelaySampleMapsValidChannel(t *testing.T) {
	if model.DB == nil {
		t.Skip("database not initialized for test")
	}

	resetHotBuckets()
	// Note: Cannot restore setting in tests as it's read-only via config
	channelID := 5

	RecordRelaySample(&relaycommon.RelayInfo{
		StartTime:       time.Now().Add(-time.Second),
		OriginModelName: "gpt-test",
		UsingGroup:      "default",
		ChannelMeta:     &relaycommon.ChannelMeta{ChannelId: 5},
	}, true, 7)

	result, err := Query(QueryParams{Model: "gpt-test", ChannelID: &channelID, Hours: 1})
	assert.NoError(t, err)
	if assert.Len(t, result.Groups, 1) {
		assert.Equal(t, 5, result.Groups[0].ChannelID)
		assert.Equal(t, float64(100), result.Groups[0].SuccessRate)
	}
}

func TestRecordRelaySampleSkipsInvalidChannelPersistence(t *testing.T) {
	if model.DB == nil {
		t.Skip("database not initialized for test")
	}

	resetHotBuckets()
	// Note: Cannot restore setting in tests as it's read-only via config
	channelID := 0

	RecordRelaySample(&relaycommon.RelayInfo{
		StartTime:       time.Now().Add(-time.Second),
		OriginModelName: "gpt-test",
		UsingGroup:      "default",
		ChannelMeta:     &relaycommon.ChannelMeta{ChannelId: 0},
	}, true, 7)

	result, err := Query(QueryParams{Model: "gpt-test", ChannelID: &channelID, Hours: 1})
	assert.NoError(t, err)
	assert.Empty(t, result.Groups)

	channelRows := 0
	hotBuckets.Range(func(key, value any) bool {
		k := key.(bucketKey)
		if k.model == "gpt-test" && k.channel > 0 {
			channelRows++
		}
		return true
	})
	assert.Zero(t, channelRows)
}

func resetHotBuckets() {
	hotBuckets.Range(func(key, value any) bool {
		hotBuckets.Delete(key)
		return true
	})
}
