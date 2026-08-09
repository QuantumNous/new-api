package service

import (
	"errors"
	"net/http"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

// image2SmartRoutingFlag sets the flag for one test and restores it after.
func image2SmartRoutingFlag(t *testing.T, enabled bool) {
	t.Helper()
	old := common.Image2SmartRoutingEnabled
	common.Image2SmartRoutingEnabled = enabled
	t.Cleanup(func() { common.Image2SmartRoutingEnabled = old })
}

// With the flag off every Image2 request must leave the established selector
// untouched, for both relay modes the router would otherwise claim.
//
// The existing disabled-path test cannot distinguish "the flag stopped it"
// from "nothing was routable anyway", because a nil router is also what an
// unroutable request produces. The discriminator here is the same call with
// the flag on: it gets past the flag and fails at group resolution instead,
// which proves the flag is what short-circuits and that it does so before any
// candidate lookup.
func TestImage2SmartRoutingDisabledShortCircuitsBeforeGroupResolution(t *testing.T) {
	modes := []struct {
		name string
		mode int
	}{
		{name: "generations", mode: relayconstant.RelayModeImagesGenerations},
		{name: "edits", mode: relayconstant.RelayModeImagesEdits},
	}

	for _, mode := range modes {
		t.Run(mode.name, func(t *testing.T) {
			info := &relaycommon.RelayInfo{OriginModelName: "gpt-image-2", RelayMode: mode.mode}
			request := &dto.ImageRequest{Size: "1024x1024"}

			image2SmartRoutingFlag(t, false)
			offContext, _ := gin.CreateTestContext(nil)
			router, err := NewImage2SmartRouter(offContext, info, request)
			require.NoError(t, err, "a disabled feature must not turn a valid request into an error")
			require.Nil(t, router)
			require.False(t, offContext.GetBool("image2_smart_router_active"))

			// Same context shape, same request, flag on: the run now reaches
			// group resolution and reports that it cannot resolve a group. A
			// nil-and-nil result here would mean the disabled assertion above
			// was vacuous.
			image2SmartRoutingFlag(t, true)
			onContext, _ := gin.CreateTestContext(nil)
			router, err = NewImage2SmartRouter(onContext, info, request)
			require.Error(t, err, "with the flag on the same call must get past the flag check")
			require.Nil(t, router)
		})
	}
}

// A model that is not gpt-image-2, and a relay mode that is not an image
// generation or edit, must never enter the router regardless of the flag.
func TestImage2SmartRoutingIgnoresForeignModelsAndModesWithFlagOn(t *testing.T) {
	image2SmartRoutingFlag(t, true)
	foreign := []struct {
		name string
		info *relaycommon.RelayInfo
	}{
		{"other image model", &relaycommon.RelayInfo{OriginModelName: "gpt-image-1", RelayMode: relayconstant.RelayModeImagesGenerations}},
		{"empty model", &relaycommon.RelayInfo{OriginModelName: "", RelayMode: relayconstant.RelayModeImagesGenerations}},
		{"chat mode", &relaycommon.RelayInfo{OriginModelName: "gpt-image-2", RelayMode: relayconstant.RelayModeChatCompletions}},
	}
	for _, test := range foreign {
		t.Run(test.name, func(t *testing.T) {
			c, _ := gin.CreateTestContext(nil)
			router, err := NewImage2SmartRouter(c, test.info, &dto.ImageRequest{Size: "1024x1024"})
			require.NoError(t, err)
			require.Nil(t, router)
		})
	}
}

// The failover policy is gated by the same switch, one layer down.
// controller/relay.go evaluates the shared policy and only substitutes the
// Image2 policy when the context carries image2_smart_router_active, which is
// set exactly when NewImage2SmartRouter returned a router.
//
// That gate is only meaningful if the two policies actually disagree
// somewhere, so the disagreement is proved first, on the input where it is
// real. An upstream 403 is a channel auth or model-mapping problem to the
// shared policy, which moves to the next channel; the Image2 policy treats it
// as a deterministic rejection and refuses to replay. A 400 would not prove
// anything here, because the shared policy already declines it and the Image2
// evaluator returns that decision unchanged.
//
// With the flag off the context key is absent, so the shared policy is what
// runs and a 403 still fails over as it always did.
func TestImage2FlagsOffKeepsSharedFailoverPolicy(t *testing.T) {
	input := SafeFailoverInput{
		RelayMode:      relayconstant.RelayModeImagesGenerations,
		ModelName:      "gpt-image-2",
		AttemptElapsed: time.Second,
		ImageGuard:     60 * time.Second,
		Error: types.NewErrorWithStatusCode(
			errors.New("forbidden"),
			types.ErrorCodeBadResponseStatusCode,
			http.StatusForbidden,
		),
	}

	shared := EvaluateSafeFailover(input)
	image2 := EvaluateImage2SafeFailover(input)
	require.True(t, shared.Retry, "the shared policy fails a 403 over to the next channel")
	require.Equal(t, "channel_auth_or_mapping", shared.Reason)
	require.False(t, image2.Retry, "the Image2 policy must refuse to replay a deterministic 4xx")
	require.Equal(t, "image2_deterministic_4xx", image2.Reason)

	image2SmartRoutingFlag(t, false)
	c, _ := gin.CreateTestContext(nil)
	router, err := NewImage2SmartRouter(
		c,
		&relaycommon.RelayInfo{OriginModelName: "gpt-image-2", RelayMode: relayconstant.RelayModeImagesGenerations},
		&dto.ImageRequest{Size: "1024x1024"},
	)
	require.NoError(t, err)
	require.Nil(t, router)
	require.False(t, c.GetBool("image2_smart_router_active"),
		"with no router the controller gate stays false and the shared policy decides")
}
