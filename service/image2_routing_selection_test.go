package service

import (
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/require"
)

// Resolution is the field that decides which channels are eligible at all, so
// the tier a size maps to is a routing decision and not a formatting detail.
// The existing coverage is two points (4096x4096 and "auto"); the tier
// boundaries and the non-square cases are where a request silently lands on
// the wrong capability class.
func TestImage2ResolutionTierBoundaries(t *testing.T) {
	info := &relaycommon.RelayInfo{
		OriginModelName: "gpt-image-2",
		RelayMode:       relayconstant.RelayModeImagesGenerations,
	}

	accepted := []struct {
		size string
		want string
	}{
		{size: "", want: "1024"},
		{size: "1024", want: "1024"},
		{size: "1024x1024", want: "1024"},
		{size: " 1024X1024 ", want: "1024"},
		{size: "512x512", want: "1024"},
		{size: "1x1", want: "1024"},
		// One pixel over the tier must move up, in either axis.
		{size: "1025x1024", want: "2048"},
		{size: "1024x1025", want: "2048"},
		{size: "2048", want: "2048"},
		{size: "2048x2048", want: "2048"},
		{size: "1024x2048", want: "2048"},
		{size: "2049x2048", want: "uhd"},
		{size: "2048x2049", want: "uhd"},
		{size: "4096", want: "uhd"},
		{size: "4096x4096", want: "uhd"},
		{size: "uhd", want: "uhd"},
	}
	for _, test := range accepted {
		t.Run("accepts "+test.size, func(t *testing.T) {
			capability, err := ParseImage2RequestCapability(info, &dto.ImageRequest{Size: test.size})
			require.NoError(t, err)
			require.Equal(t, test.want, capability.Resolution)
		})
	}

	// A size that cannot be understood must be an error, never a silent
	// downgrade to the smallest tier: that would route an oversized request to
	// a channel that cannot serve it.
	rejected := []string{
		"abc", "1024x", "x1024", "1024x1024x1024", "0x0", "-1x-1", "1024*1024",
		"4097x4096", "4096x4097", "8192x8192",
	}
	for _, size := range rejected {
		t.Run("rejects "+size, func(t *testing.T) {
			_, err := ParseImage2RequestCapability(info, &dto.ImageRequest{Size: size})
			require.Error(t, err)
		})
	}
}

// The attempt chain must depend only on the request and the capability
// metadata, never on the order the candidates arrived in. Channels come from a
// database query whose row order is not guaranteed, so two identical requests
// that produced different chains would make a failover sequence
// unreproducible and an incident unreadable.
func TestImage2CandidateOrderIsIndependentOfInputOrder(t *testing.T) {
	build := func() []*model.Channel {
		return []*model.Channel{
			image2TestChannel(7, 10, []string{"generations"}, []string{"1024"}, false),
			image2TestChannel(3, 10, []string{"generations"}, []string{"1024"}, false),
			image2TestChannel(5, 5, []string{"generations"}, []string{"1024"}, false),
			image2TestChannel(9, 10, []string{"generations"}, []string{"1024"}, false),
		}
	}
	request := Image2RequestCapability{Operation: "generations", Resolution: "1024", N: 1}

	chain := func(channels []*model.Channel) []int {
		router := newImage2SmartRouter(request, channels)
		ids := make([]int, 0, len(channels))
		for {
			selected, err := router.Next()
			if err != nil {
				require.True(t, types.IsSkipRetryError(err))
				break
			}
			ids = append(ids, selected.Id)
		}
		return ids
	}

	forward := build()
	reversed := build()
	for i, j := 0, len(reversed)-1; i < j; i, j = i+1, j-1 {
		reversed[i], reversed[j] = reversed[j], reversed[i]
	}

	// Priority 5 first, then priority 10 ordered by channel id.
	want := []int{5, 3, 7, 9}
	require.Equal(t, want, chain(forward))
	require.Equal(t, want, chain(reversed), "candidate order must not depend on the input slice order")
}

// MaxN is an opt-in ceiling. A channel that does not declare one accepts any
// count, so dropping the "declared" guard would exclude every channel that
// never configured MaxN -- a silent outage rather than a visible error.
func TestImage2UndeclaredMaxNAcceptsAnyCount(t *testing.T) {
	unlimited := image2TestChannel(1, 10, []string{"generations"}, []string{"1024"}, false)
	require.EqualValues(t, 0, unlimited.GetSetting().Image2Capability.MaxN)

	router := newImage2SmartRouter(
		Image2RequestCapability{Operation: "generations", Resolution: "1024", N: 99},
		[]*model.Channel{unlimited},
	)
	selected, err := router.Next()
	require.Nil(t, err)
	require.Equal(t, unlimited.Id, selected.Id)
}
