package service

import (
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
)

const (
	StreamChannelCooldownDuration  = time.Hour
	StreamCapacityCooldownDuration = 15 * time.Minute
	streamQualityWindow            = 5 * time.Minute
	streamQualityFailureThreshold  = 5
)

type streamChannelQualityKey struct {
	channelId int
	modelName string
}

type streamChannelQualityState struct {
	failures []time.Time
}

var streamChannelQuality = struct {
	sync.Mutex
	items map[streamChannelQualityKey]streamChannelQualityState
}{items: make(map[streamChannelQualityKey]streamChannelQualityState)}

func ObserveStreamChannelQuality(relayInfo *relaycommon.RelayInfo) {
	if relayInfo == nil || relayInfo.IsChannelTest || relayInfo.StreamStatus == nil || relayInfo.ChannelId == 0 {
		return
	}
	reason := streamInstabilityReason(relayInfo)
	if reason == "" {
		return
	}
	modelName := relayInfo.OriginModelName
	if modelName == "" {
		modelName = relayInfo.UpstreamModelName
	}
	if modelName == "" {
		return
	}
	failureCount := recordStreamChannelFailure(relayInfo.ChannelId, modelName)
	if failureCount < streamQualityFailureThreshold {
		return
	}

	cooldownReason := fmt.Sprintf("stream_unstable model=%s failures=%d/%s reason=%s", modelName, failureCount, streamQualityWindow, reason)
	common.SysLog(fmt.Sprintf("通道冷却：#%d，持续 %s，原因：%s", relayInfo.ChannelId, StreamChannelCooldownDuration, cooldownReason))
	model.CooldownChannel(relayInfo.ChannelId, cooldownReason, StreamChannelCooldownDuration)
	clearStreamChannelFailures(relayInfo.ChannelId, modelName)
}

// ObserveStreamChannelQualityForRequest applies request-local consequences in
// addition to the rolling quality signal. A committed SSE failure cannot be
// retried safely, but an explicit account-concurrency failure should stop this
// request from pinning the failed channel again.
func ObserveStreamChannelQualityForRequest(c *gin.Context, relayInfo *relaycommon.RelayInfo) {
	if relayInfo == nil || relayInfo.IsChannelTest || relayInfo.StreamStatus == nil || relayInfo.ChannelId == 0 {
		ObserveStreamChannelQuality(relayInfo)
		return
	}
	snapshot := relayInfo.StreamStatus.Snapshot()
	if streamInstabilityReason(relayInfo) != "" {
		suppressChannelAffinityRecord(c)
	}
	if snapshot.EndReason == relaycommon.StreamEndReasonUpstreamFailed &&
		isStreamAccountConcurrencyFailure(snapshot) &&
		!relayInfo.ChannelIsMultiKey {
		modelName := relayInfo.OriginModelName
		if modelName == "" {
			modelName = relayInfo.UpstreamModelName
		}
		reason := fmt.Sprintf("stream_capacity model=%s error=%s", modelName, snapshot.EndError)
		common.SysLog(fmt.Sprintf("通道冷却：#%d，持续 %s，原因：%s", relayInfo.ChannelId, StreamCapacityCooldownDuration, reason))
		model.CooldownChannelWithoutFallback(relayInfo.ChannelId, reason, StreamCapacityCooldownDuration)
		clearStreamChannelFailures(relayInfo.ChannelId, modelName)
		return
	}
	ObserveStreamChannelQuality(relayInfo)
}

func isStreamAccountConcurrencyFailure(snapshot relaycommon.StreamSnapshot) bool {
	messages := make([]string, 0, len(snapshot.Errors)+1)
	if snapshot.EndError != nil {
		messages = append(messages, snapshot.EndError.Error())
	}
	for _, entry := range snapshot.Errors {
		messages = append(messages, entry.Message)
	}
	for _, message := range messages {
		if strings.Contains(strings.ToLower(message), "concurrency limit exceeded for account") {
			return true
		}
	}
	return false
}

func streamInstabilityReason(relayInfo *relaycommon.RelayInfo) string {
	snapshot := relayInfo.StreamStatus.Snapshot()
	switch snapshot.EndReason {
	case relaycommon.StreamEndReasonScannerErr, relaycommon.StreamEndReasonPingFail, relaycommon.StreamEndReasonTimeout, relaycommon.StreamEndReasonUpstreamFailed:
		return string(snapshot.EndReason)
	case relaycommon.StreamEndReasonTerminalClientError:
		return ""
	case relaycommon.StreamEndReasonClientGone:
		if isStreamTransportError(snapshot.EndError) || hasStreamTransportError(snapshot.Errors) {
			return "client_gone_transport_error"
		}
	}
	if snapshot.ErrorCount > 0 && hasStreamTransportError(snapshot.Errors) {
		return "stream_soft_transport_error"
	}
	return ""
}

func hasStreamTransportError(errors []relaycommon.StreamErrorEntry) bool {
	for _, entry := range errors {
		if isStreamTransportErrorText(entry.Message) {
			return true
		}
	}
	return false
}

func isStreamTransportError(err error) bool {
	return err != nil && isStreamTransportErrorText(err.Error())
}

func isStreamTransportErrorText(message string) bool {
	message = strings.ToLower(message)
	return strings.Contains(message, "http2: response body closed") ||
		strings.Contains(message, "unexpected eof") ||
		strings.Contains(message, "malformed") ||
		strings.Contains(message, "empty response") ||
		strings.Contains(message, "invalid character") ||
		strings.Contains(message, "cannot unmarshal") ||
		strings.Contains(message, "unexpected end of json") ||
		strings.Contains(message, "connection reset") ||
		strings.Contains(message, "broken pipe") ||
		strings.Contains(message, "stream error") ||
		strings.Contains(message, "read/write")
}

func recordStreamChannelFailure(channelId int, modelName string) int {
	now := time.Now()
	cutoff := now.Add(-streamQualityWindow)
	key := streamChannelQualityKey{channelId: channelId, modelName: modelName}

	streamChannelQuality.Lock()
	defer streamChannelQuality.Unlock()

	pruneExpiredStreamChannelFailures(cutoff)
	state := streamChannelQuality.items[key]
	failures := state.failures[:0]
	for _, failureAt := range state.failures {
		if failureAt.After(cutoff) {
			failures = append(failures, failureAt)
		}
	}
	failures = append(failures, now)
	state.failures = failures
	streamChannelQuality.items[key] = state
	return len(failures)
}

func pruneExpiredStreamChannelFailures(cutoff time.Time) {
	for key, state := range streamChannelQuality.items {
		failures := state.failures[:0]
		for _, failureAt := range state.failures {
			if failureAt.After(cutoff) {
				failures = append(failures, failureAt)
			}
		}
		if len(failures) == 0 {
			delete(streamChannelQuality.items, key)
			continue
		}
		state.failures = failures
		streamChannelQuality.items[key] = state
	}
}

func clearStreamChannelFailures(channelId int, modelName string) {
	streamChannelQuality.Lock()
	defer streamChannelQuality.Unlock()
	delete(streamChannelQuality.items, streamChannelQualityKey{channelId: channelId, modelName: modelName})
}

func clearStreamChannelQualityForTest() {
	streamChannelQuality.Lock()
	defer streamChannelQuality.Unlock()
	streamChannelQuality.items = make(map[streamChannelQualityKey]streamChannelQualityState)
}
