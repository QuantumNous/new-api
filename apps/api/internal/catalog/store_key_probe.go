package channel

import (
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/internal/common"
	"github.com/QuantumNous/new-api/internal/logger"
)

// ProbeChannelKeyFunc verifies one channel key without spending tokens and
// reports whether the answer is conclusive. It is wired by the controller layer
// (which owns the upstream model-list request construction) because this package
// must not import it. valid is meaningful only when decisive is true: a 429, a
// 5xx, or a timeout leaves the key's fate to the regular state machine.
var ProbeChannelKeyFunc func(channelID, keyIndex int) (valid bool, decisive bool)

// verifyKeyAndCascade runs after a unit accumulates UnitProbeFailCap
// consecutive failed recovery probes. One unit failing repeatedly can mean a
// dead model or a dead key, and only an upstream check tells them apart. When
// the key is confirmed invalid, the key itself (or the whole single-key
// channel) is auto-disabled so the remaining keys of a multi-key channel keep
// serving. An inconclusive probe changes nothing.
//
// The cascade deliberately does not hard-disable the model units: the key /
// channel status is the explicit, recoverable exclusion that health owns, and
// stacking a persisted unit hard-disable on top would leave the channel
// "enabled" but unroutable after the automatic status recovery. Model-level
// isolation remains the separate DisableChannelModel mechanism.
func verifyKeyAndCascade(channelID, keyIndex int, now time.Time) {
	if ProbeChannelKeyFunc == nil {
		return
	}
	valid, decisive := ProbeChannelKeyFunc(channelID, keyIndex)
	if !decisive || valid {
		return
	}

	channel, err := GetChannelById(channelID, true)
	if err != nil || channel == nil {
		common.SysError("key verification cascade: channel " + strconv.Itoa(channelID) + " not found")
		return
	}

	// UpdateChannelStatus resolves the key string to its index and writes
	// MultiKeyStatusList for a multi-key channel; an empty key disables the
	// whole channel, which is the single-key shape and matches auto_ban.
	usingKey := ""
	if channel.ChannelInfo.IsMultiKey {
		keys := channel.GetKeys()
		if keyIndex < 0 || keyIndex >= len(keys) {
			return
		}
		usingKey = keys[keyIndex]
	}
	UpdateChannelStatus(channelID, usingKey, common.ChannelStatusAutoDisabled, "key verification failed")
	logger.LogWarn(nil, "key verification failed: channel="+strconv.Itoa(channelID)+" key="+strconv.Itoa(keyIndex)+" models="+strconv.Itoa(len(channel.GetModels())))
}

// The unit health state machine fires this hook when the consecutive
// failed-recovery-probe ledger reaches UnitProbeFailCap. ReportOutcome already
// runs the hook on a pooled goroutine, so a slow upstream probe cannot stall
// the reporting hot path without a second hop here.
func init() {
	UnitProbeFailHook = func(key RouteKey) {
		verifyKeyAndCascade(key.ChannelId, key.KeyIndex, ChannelHealthNow())
	}
}
