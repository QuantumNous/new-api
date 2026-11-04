package channel

import (
	"github.com/QuantumNous/new-api/internal/common/dbx"
	"strconv"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/internal/common"
	"github.com/QuantumNous/new-api/internal/constant"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// withKeyProbe installs a probe verdict and restores the previous wiring, so one
// case cannot leak its verdict into the next.
func withKeyProbe(t *testing.T, valid, decisive bool) *int {
	t.Helper()
	previous := ProbeChannelKeyFunc
	calls := 0
	ProbeChannelKeyFunc = func(int, int) (bool, bool) {
		calls++
		return valid, decisive
	}
	t.Cleanup(func() { ProbeChannelKeyFunc = previous })
	return &calls
}

// seedMultiKeyChannel creates a two-key channel serving two models, which is the
// shape the cascade has to distinguish: one key dying must not take the other
// key's units with it.
func seedMultiKeyChannel(t *testing.T, id int) *Channel {
	t.Helper()
	require.NoError(t, dbx.DB.AutoMigrate(&Channel{}, &Ability{}, &GatewayConfigRevision{}, &GatewayConfigOutbox{}))
	require.NoError(t, InitializeGatewayConfigRevision())
	seeded := Channel{
		Id:     id,
		Type:   constant.ChannelTypeOpenAI,
		Key:    "key-a\nkey-b",
		Status: common.ChannelStatusEnabled,
		Name:   "cascade-channel-" + strconv.Itoa(id),
		Models: "model-x,model-y",
		Group:  "default",
		ChannelInfo: ChannelInfo{
			IsMultiKey:   true,
			MultiKeySize: 2,
			MultiKeyMode: constant.MultiKeyModeRandom,
		},
	}
	require.NoError(t, dbx.DB.Create(&seeded).Error)
	return &seeded
}

// TestVerifyKeyAndCascadeDisablesTheKey covers the cascade contract: a
// conclusive 401/403 verdict means the key itself is dead, so the key's status
// is recorded as auto-disabled while the model units behind it keep their
// health state — exclusion flows from the key status (which the scheduler
// honors and RecoverUnit restores together with health), not from a persisted
// unit hard-disable. The sibling key index must stay usable: that is the whole
// reason the scheduling unit carries a key index.
func TestVerifyKeyAndCascadeDisablesTheKey(t *testing.T) {
	withUnitHealthDB(t)
	calls := withKeyProbe(t, false, true)
	channel := seedMultiKeyChannel(t, 9210)
	now := time.Now()

	verifyKeyAndCascade(channel.Id, 0, now)

	assert.Equal(t, 1, *calls, "the cascade must probe exactly once")
	for _, name := range []string{"model-x", "model-y"} {
		state := UnitState(RouteKey{ChannelId: channel.Id, KeyIndex: 0, Model: name})
		assert.False(t, state.HardDisabled,
			"model %s behind the dead key is excluded by key status, not unit hard-disable", name)
		sibling := RouteKey{ChannelId: channel.Id, KeyIndex: 1, Model: name}
		assert.True(t, IsUnitSelectable(sibling, now), "model %s on the surviving key must stay selectable", name)
	}

	var stored Channel
	require.NoError(t, dbx.DB.First(&stored, "id = ?", channel.Id).Error)
	assert.Equal(t, common.ChannelStatusAutoDisabled, stored.ChannelInfo.MultiKeyStatusList[0],
		"the channel's key status must record the dead key")
}

// TestVerifyKeyAndCascadeIgnoresInconclusiveProbe covers the 429/5xx/timeout
// path: without a conclusive verdict the cascade must change nothing, otherwise
// one upstream hiccup would disable a whole key's worth of model units.
func TestVerifyKeyAndCascadeIgnoresInconclusiveProbe(t *testing.T) {
	withUnitHealthDB(t)
	withKeyProbe(t, false, false)
	channel := seedMultiKeyChannel(t, 9211)
	now := time.Now()

	verifyKeyAndCascade(channel.Id, 0, now)

	for _, name := range []string{"model-x", "model-y"} {
		assert.True(t, IsUnitSelectable(RouteKey{ChannelId: channel.Id, KeyIndex: 0, Model: name}, now),
			"an inconclusive probe must not disable model %s", name)
	}
	var stored Channel
	require.NoError(t, dbx.DB.First(&stored, "id = ?", channel.Id).Error)
	assert.Equal(t, common.ChannelStatusEnabled, stored.Status, "channel status must be untouched")
}

// TestVerifyKeyAndCascadeNoopWhenProbeUnwired covers the guard: with no probe
// function wired the cascade must not contact the upstream or disable anything.
// The cascade only ever runs once a controller has installed a probe, so the
// guard is what keeps an unset package from probing a dead key.
func TestVerifyKeyAndCascadeNoopWhenProbeUnwired(t *testing.T) {
	withUnitHealthDB(t)
	previousProbe := ProbeChannelKeyFunc
	ProbeChannelKeyFunc = nil
	t.Cleanup(func() { ProbeChannelKeyFunc = previousProbe })
	channel := seedMultiKeyChannel(t, 9212)
	now := time.Now()

	verifyKeyAndCascade(channel.Id, 0, now)

	for _, name := range []string{"model-x", "model-y"} {
		assert.True(t, IsUnitSelectable(RouteKey{ChannelId: channel.Id, KeyIndex: 0, Model: name}, now),
			"an unwired probe must disable nothing")
	}
}
