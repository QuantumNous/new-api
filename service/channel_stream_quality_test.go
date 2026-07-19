package service

import (
	"fmt"
	"testing"

	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

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
