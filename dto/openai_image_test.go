package dto

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestImageRequestPreservesProviderResolutionFields(t *testing.T) {
	raw := []byte(`{"model":"grok-imagine-image","prompt":"test","resolution":"2k","aspect_ratio":"16:9"}`)
	var request ImageRequest
	require.NoError(t, common.Unmarshal(raw, &request))
	require.Equal(t, "2k", request.Resolution)
	require.Equal(t, "16:9", request.AspectRatio)

	encoded, err := common.Marshal(request)
	require.NoError(t, err)
	require.JSONEq(t, string(raw), string(encoded))
}

func TestImageRequestBillingResolution(t *testing.T) {
	tests := []struct {
		name       string
		resolution string
		size       string
		want       string
	}{
		{name: "explicit", resolution: "4k", size: "1024x1024", want: "4K"},
		{name: "one kilopixel", size: "1024x768", want: "1K"},
		{name: "two kilopixel", size: "2048x1152", want: "2K"},
		{name: "four kilopixel", size: "3840x2160", want: "4K"},
		{name: "overflowing dimension", size: "999999999999999999999999x1024", want: "4K"},
		{name: "automatic", size: "auto", want: "2K"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			request := ImageRequest{Resolution: test.resolution, Size: test.size}
			require.Equal(t, test.want, request.BillingResolution())
		})
	}
}
