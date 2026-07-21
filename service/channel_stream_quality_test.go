package service

import (
	"fmt"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestObserveStreamChannelQualityImmediatelyIsolatesAccountConcurrencyFailure(t *testing.T) {
	model.ClearChannelCooldownsForTest()
	clearStreamChannelQualityForTest()
	t.Cleanup(func() {
		model.ClearChannelCooldownsForTest()
		clearStreamChannelQualityForTest()
	})

	cacheKeySuffix := fmt.Sprintf("codex cli trace:default:capacity-%d", time.Now().UnixNano())
	cacheKeyFull := channelAffinityCacheNamespace + ":" + cacheKeySuffix
	cache := getChannelAffinityCache()
	// A concurrent successful request may have already moved this affinity to a
	// healthy channel while the old request on #17 is finishing. The stale
	// failure must neither delete nor overwrite that newer binding.
	require.NoError(t, cache.SetWithTTL(cacheKeySuffix, 29, time.Minute))
	t.Cleanup(func() {
		_, _ = cache.DeleteMany([]string{cacheKeySuffix})
	})
	ctx := buildChannelAffinityTemplateContextForTest(channelAffinityMeta{
		CacheKey:   cacheKeyFull,
		TTLSeconds: 60,
		RuleName:   "codex cli trace",
	})
	info := newStreamQualityRelayInfoWithEndError(
		17,
		"gpt-5.6-sol",
		relaycommon.StreamEndReasonUpstreamFailed,
		1,
		"upstream responses stream failed: Concurrency limit exceeded for account",
		nil,
	)

	ObserveStreamChannelQualityForRequest(ctx, info)

	reason, expires, cooling := model.GetChannelCooldown(17)
	require.True(t, cooling)
	assert.Contains(t, reason, "stream_capacity")
	remaining := time.Until(time.Unix(expires, 0))
	assert.Greater(t, remaining, 14*time.Minute)
	assert.Less(t, remaining, 16*time.Minute)

	boundChannel, found, err := cache.Get(cacheKeySuffix)
	require.NoError(t, err)
	require.True(t, found)
	assert.Equal(t, 29, boundChannel, "stale failure must preserve a newer affinity binding")

	RecordChannelAffinity(ctx, 17)
	boundChannel, found, err = cache.Get(cacheKeySuffix)
	require.NoError(t, err)
	require.True(t, found)
	assert.Equal(t, 29, boundChannel, "failed stream must not overwrite the healthy affinity")
}

func TestObserveStreamChannelQualityKeepsGenericFailureThreshold(t *testing.T) {
	model.ClearChannelCooldownsForTest()
	clearStreamChannelQualityForTest()
	t.Cleanup(func() {
		model.ClearChannelCooldownsForTest()
		clearStreamChannelQualityForTest()
	})

	info := newStreamQualityRelayInfoWithEndError(
		18,
		"gpt-5.6-sol",
		relaycommon.StreamEndReasonUpstreamFailed,
		1,
		"upstream responses stream failed: temporary provider error",
		nil,
	)
	ObserveStreamChannelQualityForRequest(nil, info)

	assert.False(t, model.IsChannelCoolingDown(18), "generic failures still require repeated evidence")
}

func TestObserveStreamChannelQualityDoesNotCooldownChannelTests(t *testing.T) {
	model.ClearChannelCooldownsForTest()
	clearStreamChannelQualityForTest()
	t.Cleanup(func() {
		model.ClearChannelCooldownsForTest()
		clearStreamChannelQualityForTest()
	})

	info := newStreamQualityRelayInfoWithEndError(
		17,
		"gpt-5.6-sol",
		relaycommon.StreamEndReasonUpstreamFailed,
		1,
		"upstream responses stream failed: Concurrency limit exceeded for account",
		nil,
	)
	info.IsChannelTest = true

	ObserveStreamChannelQualityForRequest(nil, info)

	assert.False(t, model.IsChannelCoolingDown(17), "channel tests must not change production cooldown state")
}

func TestObserveStreamChannelQualityDoesNotImmediatelyCooldownMultiKeyChannel(t *testing.T) {
	model.ClearChannelCooldownsForTest()
	clearStreamChannelQualityForTest()
	t.Cleanup(func() {
		model.ClearChannelCooldownsForTest()
		clearStreamChannelQualityForTest()
	})

	info := newStreamQualityRelayInfoWithEndError(
		17,
		"gpt-5.6-sol",
		relaycommon.StreamEndReasonUpstreamFailed,
		1,
		"upstream responses stream failed: Concurrency limit exceeded for account",
		nil,
	)
	info.ChannelIsMultiKey = true

	ObserveStreamChannelQualityForRequest(nil, info)

	assert.False(t, model.IsChannelCoolingDown(17), "one busy account must not sideline the other keys")
}

func TestObserveStreamChannelQualityDoesNotPinGenericUpstreamFailure(t *testing.T) {
	cacheKeySuffix := fmt.Sprintf("codex cli trace:default:upstream-failure-%d", time.Now().UnixNano())
	cacheKeyFull := channelAffinityCacheNamespace + ":" + cacheKeySuffix
	cache := getChannelAffinityCache()
	require.NoError(t, cache.SetWithTTL(cacheKeySuffix, 29, time.Minute))
	t.Cleanup(func() {
		_, _ = cache.DeleteMany([]string{cacheKeySuffix})
	})
	ctx := buildChannelAffinityTemplateContextForTest(channelAffinityMeta{
		CacheKey:   cacheKeyFull,
		TTLSeconds: 60,
		RuleName:   "codex cli trace",
	})
	info := newStreamQualityRelayInfoWithEndError(
		17,
		"gpt-5.6-sol",
		relaycommon.StreamEndReasonUpstreamFailed,
		1,
		"upstream responses stream failed: temporary provider error",
		nil,
	)

	ObserveStreamChannelQualityForRequest(ctx, info)
	RecordChannelAffinity(ctx, 17)

	boundChannel, found, err := cache.Get(cacheKeySuffix)
	require.NoError(t, err)
	require.True(t, found)
	assert.Equal(t, 29, boundChannel, "a failed stream must not become the affinity success")
}

func TestObserveStreamChannelQualityCoolsAfterRepeatedTimeouts(t *testing.T) {
	model.ClearChannelCooldownsForTest()
	clearStreamChannelQualityForTest()
	t.Cleanup(func() {
		model.ClearChannelCooldownsForTest()
		clearStreamChannelQualityForTest()
	})

	for i := 0; i < streamQualityFailureThreshold-1; i++ {
		ObserveStreamChannelQuality(newStreamQualityRelayInfo(12, "gpt-5.5", relaycommon.StreamEndReasonTimeout, 0, nil))
		if model.IsChannelCoolingDown(12) {
			t.Fatalf("channel cooled before threshold at failure %d", i+1)
		}
	}

	ObserveStreamChannelQuality(newStreamQualityRelayInfo(12, "gpt-5.5", relaycommon.StreamEndReasonTimeout, 0, nil))

	if !model.IsChannelCoolingDown(12) {
		t.Fatalf("expected channel to cool down after repeated stream timeouts")
	}
}

func TestObserveStreamChannelQualityIgnoresNormalClientGoneAfterData(t *testing.T) {
	model.ClearChannelCooldownsForTest()
	clearStreamChannelQualityForTest()
	t.Cleanup(func() {
		model.ClearChannelCooldownsForTest()
		clearStreamChannelQualityForTest()
	})

	for i := 0; i < streamQualityFailureThreshold+1; i++ {
		ObserveStreamChannelQuality(newStreamQualityRelayInfo(12, "gpt-5.5", relaycommon.StreamEndReasonClientGone, 10, nil))
	}

	if model.IsChannelCoolingDown(12) {
		t.Fatalf("expected normal client_gone after data to avoid channel cooldown")
	}
}

func TestObserveStreamChannelQualityIgnoresClientGoneBeforeData(t *testing.T) {
	model.ClearChannelCooldownsForTest()
	clearStreamChannelQualityForTest()
	t.Cleanup(func() {
		model.ClearChannelCooldownsForTest()
		clearStreamChannelQualityForTest()
	})

	for i := 0; i < streamQualityFailureThreshold+1; i++ {
		ObserveStreamChannelQuality(newStreamQualityRelayInfo(17, "gpt-5.5", relaycommon.StreamEndReasonClientGone, 0, nil))
	}

	if model.IsChannelCoolingDown(17) {
		t.Fatalf("expected client_gone before data without transport error to avoid channel cooldown")
	}
}

func TestObserveStreamChannelQualityIgnoresClientTerminalErrors(t *testing.T) {
	model.ClearChannelCooldownsForTest()
	clearStreamChannelQualityForTest()
	t.Cleanup(func() {
		model.ClearChannelCooldownsForTest()
		clearStreamChannelQualityForTest()
	})

	for i := 0; i < streamQualityFailureThreshold+1; i++ {
		ObserveStreamChannelQuality(newStreamQualityRelayInfoWithEndError(
			18,
			"gpt-5.5",
			relaycommon.StreamEndReasonTerminalClientError,
			10,
			"invalid prompt",
			[]string{"stream error: invalid prompt"},
		))
	}

	if model.IsChannelCoolingDown(18) {
		t.Fatal("expected client-semantic terminal errors to avoid channel cooldown")
	}
}

func TestObserveStreamChannelQualityCoolsTransportErrors(t *testing.T) {
	model.ClearChannelCooldownsForTest()
	clearStreamChannelQualityForTest()
	t.Cleanup(func() {
		model.ClearChannelCooldownsForTest()
		clearStreamChannelQualityForTest()
	})

	for i := 0; i < streamQualityFailureThreshold; i++ {
		ObserveStreamChannelQuality(newStreamQualityRelayInfo(19, "gpt-5.5", relaycommon.StreamEndReasonClientGone, 20, []string{"http2: response body closed"}))
	}

	if !model.IsChannelCoolingDown(19) {
		t.Fatalf("expected repeated stream transport errors to cool channel")
	}
}

func TestObserveStreamChannelQualityCoolsClientGoneTerminalTransportError(t *testing.T) {
	model.ClearChannelCooldownsForTest()
	clearStreamChannelQualityForTest()
	t.Cleanup(func() {
		model.ClearChannelCooldownsForTest()
		clearStreamChannelQualityForTest()
	})

	for i := 0; i < streamQualityFailureThreshold; i++ {
		ObserveStreamChannelQuality(newStreamQualityRelayInfoWithEndError(21, "gpt-5.5", relaycommon.StreamEndReasonClientGone, 20, "connection reset by peer", nil))
	}

	if !model.IsChannelCoolingDown(21) {
		t.Fatalf("expected repeated terminal transport errors to cool channel")
	}
}

func TestObserveStreamChannelQualityCoolsSoftMalformedErrors(t *testing.T) {
	model.ClearChannelCooldownsForTest()
	clearStreamChannelQualityForTest()
	t.Cleanup(func() {
		model.ClearChannelCooldownsForTest()
		clearStreamChannelQualityForTest()
	})

	for i := 0; i < streamQualityFailureThreshold; i++ {
		ObserveStreamChannelQuality(newStreamQualityRelayInfo(22, "gpt-5.5", relaycommon.StreamEndReasonEOF, 20, []string{"invalid character '<' looking for beginning of value"}))
	}

	if !model.IsChannelCoolingDown(22) {
		t.Fatalf("expected repeated malformed stream chunks to cool channel")
	}
}

func TestObserveStreamChannelQualityTracksModelSeparately(t *testing.T) {
	model.ClearChannelCooldownsForTest()
	clearStreamChannelQualityForTest()
	t.Cleanup(func() {
		model.ClearChannelCooldownsForTest()
		clearStreamChannelQualityForTest()
	})

	for i := 0; i < streamQualityFailureThreshold-1; i++ {
		ObserveStreamChannelQuality(newStreamQualityRelayInfo(12, "gpt-5.5", relaycommon.StreamEndReasonTimeout, 0, nil))
		ObserveStreamChannelQuality(newStreamQualityRelayInfo(12, "gpt-5.4", relaycommon.StreamEndReasonTimeout, 0, nil))
	}

	if model.IsChannelCoolingDown(12) {
		t.Fatalf("expected per-model failures to stay below threshold")
	}
}

func newStreamQualityRelayInfo(channelId int, modelName string, reason relaycommon.StreamEndReason, received int, messages []string) *relaycommon.RelayInfo {
	return newStreamQualityRelayInfoWithEndError(channelId, modelName, reason, received, fmt.Sprintf("stream ended: %s", reason), messages)
}

func newStreamQualityRelayInfoWithEndError(channelId int, modelName string, reason relaycommon.StreamEndReason, received int, endError string, messages []string) *relaycommon.RelayInfo {
	status := relaycommon.NewStreamStatus()
	status.SetEndReason(reason, fmt.Errorf("%s", endError))
	if received > 0 {
		status.RecordDataReceived()
	}
	for _, message := range messages {
		status.RecordError(message)
	}
	return &relaycommon.RelayInfo{
		IsStream:              true,
		OriginModelName:       modelName,
		ReceivedResponseCount: received,
		StreamStatus:          status,
		ChannelMeta:           &relaycommon.ChannelMeta{ChannelId: channelId},
	}
}
