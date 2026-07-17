package controller

import (
	"errors"
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/types"
)

// TestModelNotFoundDoesNotCoolTheWholeChannel is the fix: an upstream that
// reports it cannot serve one model (model_not_found) must not sideline the
// whole channel. In prod, #25 404'd on gpt-5.4-mini and got cooled for 5
// minutes, which also pulled its perfectly healthy claude-sonnet-5 out of
// rotation. The (channel, model) gap is left to the health circuit, which
// records it at that granularity, not to the channel-wide cooldown.
func TestModelNotFoundDoesNotCoolTheWholeChannel(t *testing.T) {
	model.ClearChannelCooldownsForTest()
	t.Cleanup(model.ClearChannelCooldownsForTest)

	const channelID = 25
	c := newTestContext()
	err := types.NewErrorWithStatusCode(
		errors.New(`Model "gpt-5.4-mini" is not supported by any configured account in this group`),
		types.ErrorCodeModelNotFound, http.StatusNotFound)

	processChannelError(c, *types.NewChannelError(channelID, 1, "ch25", false, "k", false), err)

	if model.IsChannelCoolingDown(channelID) {
		t.Fatal("a per-model capability 404 must not cool the whole channel; other models on it stay usable")
	}
}

// TestUpstream5xxStillCoolsTheChannel is the contrast: a genuine channel-wide
// fault (upstream 5xx) must still cool the channel, or the fix would have
// disabled failover cooldown entirely.
func TestUpstream5xxStillCoolsTheChannel(t *testing.T) {
	model.ClearChannelCooldownsForTest()
	t.Cleanup(model.ClearChannelCooldownsForTest)

	const channelID = 61
	c := newTestContext()
	err := types.NewErrorWithStatusCode(
		errors.New("bad gateway"), types.ErrorCodeBadResponseStatusCode, http.StatusBadGateway)

	processChannelError(c, *types.NewChannelError(channelID, 1, "ch61", false, "k", false), err)

	if !model.IsChannelCoolingDown(channelID) {
		t.Fatal("an upstream 5xx is a channel-wide fault and must still cool the channel")
	}
}

// TestIsModelCapabilityError pins the classifier.
func TestIsModelCapabilityError(t *testing.T) {
	if !isModelCapabilityError(types.NewErrorWithStatusCode(errors.New("not supported"), types.ErrorCodeModelNotFound, http.StatusNotFound)) {
		t.Fatal("model_not_found must be recognized as a capability error")
	}
	if isModelCapabilityError(types.NewErrorWithStatusCode(errors.New("bad gateway"), types.ErrorCodeBadResponseStatusCode, http.StatusBadGateway)) {
		t.Fatal("an upstream 5xx is not a capability error")
	}
	if isModelCapabilityError(nil) {
		t.Fatal("nil is not a capability error")
	}
}
