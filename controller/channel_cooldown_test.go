package controller

import (
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

// withBusinessCooldown temporarily sets BusinessErrorCooldownSeconds so
// the test can pin the policy without depending on operator-tunable
// defaults. Returns a cleanup func that restores the original value.
func withBusinessCooldown(t *testing.T, seconds int) {
	t.Helper()
	orig := operation_setting.BusinessErrorCooldownSeconds
	operation_setting.BusinessErrorCooldownSeconds = seconds
	t.Cleanup(func() { operation_setting.BusinessErrorCooldownSeconds = orig })
}

// withTempCooldown temporarily sets TempErrorCooldownSeconds; same
// pattern as withBusinessCooldown.
func withTempCooldown(t *testing.T, seconds int) {
	t.Helper()
	orig := operation_setting.TempErrorCooldownSeconds
	operation_setting.TempErrorCooldownSeconds = seconds
	t.Cleanup(func() { operation_setting.TempErrorCooldownSeconds = orig })
}

// TestHandleChannelErrorCooldown_BusinessMarksCooldown exercises the
// happy path: a 400 upstream error containing a known business
// keyword marks the channel in cooldown. This is the contract the
// production logs rely on — without this firing, the selector will
// re-pick the sick channel.
func TestHandleChannelErrorCooldown_BusinessMarksCooldown(t *testing.T) {
	withBusinessCooldown(t, 3600)

	channelId := 99001
	t.Cleanup(func() { model.ClearCooldown(channelId) })

	channelError := types.ChannelError{
		ChannelId: channelId,
		AutoBan:   true,
	}
	err := &types.NewAPIError{
		StatusCode: 400,
		Err:        errString("Access denied: account overdue-payment detected"),
	}

	handleChannelErrorCooldown(channelError, err)

	// After the call, the channel must be in cooldown for the
	// requested duration. The probe time is the deadline we expect
	// to be safely inside; anything after `now + cooldown` would be
	// outside.
	require.True(t, model.IsInCooldown(channelId, time.Now()),
		"channel must be in cooldown immediately after a business error")
	require.True(t, model.IsInCooldown(channelId, time.Now().Add(30*time.Minute)),
		"channel must still be in cooldown 30 minutes in")
}

// TestHandleChannelErrorCooldown_RespectsAutoBan verifies the
// AutoBan opt-out: a channel with AutoBan=false must not be marked
// in cooldown, mirroring the legacy gating. Without this test, a
// future refactor that drops the AutoBan check would silently start
// mutating channels the operator explicitly opted out of.
func TestHandleChannelErrorCooldown_RespectsAutoBan(t *testing.T) {
	withBusinessCooldown(t, 3600)

	channelId := 99002
	t.Cleanup(func() { model.ClearCooldown(channelId) })

	channelError := types.ChannelError{
		ChannelId: channelId,
		AutoBan:   false,
	}
	err := &types.NewAPIError{
		StatusCode: 400,
		Err:        errString("Access denied: account overdue-payment detected"),
	}

	handleChannelErrorCooldown(channelError, err)
	require.False(t, model.IsInCooldown(channelId, time.Now()),
		"AutoBan=false must skip the cooldown mark")
}

// TestHandleChannelErrorCooldown_TempErrorMarksCooldown verifies the
// temp-error path. 5xx is the most common transient signal and the
// default short cooldown (30s) should fire.
func TestHandleChannelErrorCooldown_TempErrorMarksCooldown(t *testing.T) {
	withTempCooldown(t, 30)

	channelId := 99003
	t.Cleanup(func() { model.ClearCooldown(channelId) })

	channelError := types.ChannelError{
		ChannelId: channelId,
		AutoBan:   true,
	}
	err := &types.NewAPIError{
		StatusCode: 503,
		Err:        errString("upstream temporarily unavailable"),
	}

	handleChannelErrorCooldown(channelError, err)
	require.True(t, model.IsInCooldown(channelId, time.Now()))
}

// TestHandleChannelErrorCooldown_KeyIndexScopesToKey verifies the
// per-key path: a multi-key channel with a known key index marks
// only that key, leaving the channel itself and other keys
// eligible. This is the fix for the "one bad credential takes down
// the whole channel" complaint.
func TestHandleChannelErrorCooldown_KeyIndexScopesToKey(t *testing.T) {
	withBusinessCooldown(t, 3600)

	channelId := 99004
	keyIndex := 1
	t.Cleanup(func() { model.ClearKeyCooldown(channelId, keyIndex) })

	channelError := types.ChannelError{
		ChannelId:  channelId,
		IsMultiKey: true,
		AutoBan:    true,
		KeyIndex:   &keyIndex,
	}
	err := &types.NewAPIError{
		StatusCode: 400,
		Err:        errString("Access denied: account overdue-payment detected"),
	}

	handleChannelErrorCooldown(channelError, err)

	require.True(t, model.IsKeyInCooldown(channelId, keyIndex, time.Now()),
		"the offending key must be in cooldown")
	require.False(t, model.IsKeyInCooldown(channelId, 0, time.Now()),
		"sibling key 0 must not be marked")
	require.False(t, model.IsInCooldown(channelId, time.Now()),
		"the channel itself must not be marked (per-key mode)")
}

// errString is a tiny helper so we don't need to import errors.New
// in a test where the actual Error() string is what matters.
type errString string

func (e errString) Error() string { return string(e) }

// TestProcessChannelError_WiresCooldownHandler is the regression test
// for the bug where processChannelError still called the legacy
// ShouldDisableChannel path and never reached handleChannelErrorCooldown.
// A future refactor that drops the call must be caught here.
func TestProcessChannelError_WiresCooldownHandler(t *testing.T) {
	withBusinessCooldown(t, 3600)

	channelId := 99005
	t.Cleanup(func() { model.ClearCooldown(channelId) })

	// A minimal gin.Context. We only need a context that survives
	// the LogError call inside processChannelError.
	c, _ := gin.CreateTestContext(httptest.NewRecorder())

	channelError := types.ChannelError{
		ChannelId: channelId,
		AutoBan:   true,
	}
	err := &types.NewAPIError{
		StatusCode: 400,
		Err:        errString("Access denied: account overdue-payment detected"),
	}

	processChannelError(c, channelError, err)

	require.True(t, model.IsInCooldown(channelId, time.Now()),
		"processChannelError must route through handleChannelErrorCooldown so the cooldown overlay sees the error")
}

// TestHandleChannelErrorCooldown_SingleKeyUsesKeyNotChannel pins the
// behaviour the user reported as missing: even on a channel the
// operator configured as single-key, the cooldown must scope to the
// key (which is index 0 by default) rather than the whole channel.
// Without this, a 400 on a single-key channel would block every
// concurrent request to that channel for the cooldown duration.
func TestHandleChannelErrorCooldown_SingleKeyUsesKeyNotChannel(t *testing.T) {
	withBusinessCooldown(t, 3600)

	channelId := 99006
	t.Cleanup(func() { model.ClearKeyCooldown(channelId, 0) })
	// KeyIndex is set to 0 by buildChannelErrorFromContext for
// single-key channels (see the helper's body for why). The
// cooldown handler must honour that and route to the per-key
// map rather than the whole-channel map.
	keyIndex := 0
	channelError := types.ChannelError{
		ChannelId: channelId,
		AutoBan:   true,
		KeyIndex:  &keyIndex,
	}
	err := &types.NewAPIError{
		StatusCode: 400,
		Err:        errString("Access denied: account overdue-payment detected"),
	}

	handleChannelErrorCooldown(channelError, err)

	require.True(t, model.IsKeyInCooldown(channelId, 0, time.Now()),
		"single-key channel with KeyIndex=0 must mark key index 0, not the whole channel")
	require.False(t, model.IsInCooldown(channelId, time.Now()),
		"the channel itself must not be marked when per-key path is taken")
}

// TestProcessChannelError_PerKeyCooldown is the end-to-end
// regression test: processChannelError called via the real
// buildChannelErrorFromContext helper must end up with the
// offending key in cooldown, not the whole channel. This locks
// in the user-visible behaviour that "other keys on the same
// channel can still serve requests".
func TestProcessChannelError_PerKeyCooldown(t *testing.T) {
	withBusinessCooldown(t, 3600)

	channelId := 99007
	t.Cleanup(func() { model.ClearKeyCooldown(channelId, 0) })

	// Minimal channel with the bits the helper reads. We need
	// IsMultiKey=false to exercise the single-key default branch
	// in buildChannelErrorFromContext.
	channel := &model.Channel{
		Id:          channelId,
		ChannelInfo: model.ChannelInfo{IsMultiKey: false},
		AutoBan:     intPtr(1),
	}
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	// The distributor would normally have written the key into
	// ContextKeyChannelKey; we mimic that here so the
	// error-path log line has something to report.
	common.SetContextKey(c, constant.ContextKeyChannelKey, "sk-xxxx")

	channelError := buildChannelErrorFromContext(c, channel)
	err := &types.NewAPIError{
		StatusCode: 400,
		Err:        errString("Access denied: account overdue-payment detected"),
	}

	processChannelError(c, channelError, err)

	require.True(t, model.IsKeyInCooldown(channelId, 0, time.Now()),
		"buildChannelErrorFromContext must default KeyIndex to 0 for single-key channels, so the cooldown overlays the right map")
}
func intPtr(v int) *int { return &v }


// TestBuildChannelErrorFromContext_NoHardCodedKeyIndex is the
// regression test for the 2026-06-20 'key #0 forever' bug. The
// distributor writes the key index the user request was served
// from into the context; the controller must read that index
// verbatim, not fall back to 0. A previous version of the
// helper hard-coded keyIdx=0 for non-multi-key channels, which
// caused a multi-key channel with 10 keys (e.g. channel #38
// 'alibaba-cn-pool-10keys') to repeatedly mark key 0 as the
// broken slot regardless of which key actually failed. The
// symptom: 4 successive 400s on the same channel, all
// 'key #0 of channel #38 hit a business error', with the
// cooldown never reaching the key that was actually bad.
func TestBuildChannelErrorFromContext_NoHardCodedKeyIndex(t *testing.T) {
	channelId := 99200
	channel := &model.Channel{
		Id:          channelId,
		ChannelInfo: model.ChannelInfo{IsMultiKey: true},
		AutoBan:     intPtr(1),
	}

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	// Distributor writes the key index into the context. We
	// simulate key 5 being the slot that returned the 400.
	common.SetContextKey(c, constant.ContextKeyChannelKey, "sk-broken-5")
	common.SetContextKey(c, constant.ContextKeyChannelMultiKeyIndex, 5)

	channelError := buildChannelErrorFromContext(c, channel)

	require.NotNil(t, channelError.KeyIndex,
		"distributor set the key index, the helper must propagate it")
	require.Equal(t, 5, *channelError.KeyIndex,
		"hard-coding 0 here would mark the wrong key on cooldown for multi-key channels")
}

// TestBuildChannelErrorFromContext_MultiKeyContextIsRespected is
// the round-trip: distributor writes 7, helper reads 7. The
// '7' is the picked slot, not the channel default.
func TestBuildChannelErrorFromContext_MultiKeyContextIsRespected(t *testing.T) {
	channelId := 99201
	channel := &model.Channel{
		Id:          channelId,
		ChannelInfo: model.ChannelInfo{IsMultiKey: true},
		AutoBan:     intPtr(1),
	}

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	common.SetContextKey(c, constant.ContextKeyChannelKey, "sk-broken-7")
	common.SetContextKey(c, constant.ContextKeyChannelMultiKeyIndex, 7)

	channelError := buildChannelErrorFromContext(c, channel)

	require.NotNil(t, channelError.KeyIndex)
	require.Equal(t, 7, *channelError.KeyIndex)
}
