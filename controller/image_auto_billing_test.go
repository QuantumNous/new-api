package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPriceDataCloneDeepCopiesOtherRatios(t *testing.T) {
	original := types.PriceData{
		ModelPrice:        2,
		QuotaToPreConsume: 2000000,
		GroupRatioInfo:    types.GroupRatioInfo{GroupRatio: 1},
	}
	original.AddOtherRatio("n", 2)

	clone := original.Clone()

	original.ModelPrice = 99
	original.AddOtherRatio("n", 4)
	original.AddOtherRatio("quality", 3)
	clone.AddOtherRatio("size", 2)

	assert.Equal(t, 2.0, clone.ModelPrice)
	assert.Equal(t, map[string]float64{"n": 2, "size": 2}, clone.OtherRatios())
	assert.Equal(t, map[string]float64{"n": 4, "quality": 3}, original.OtherRatios())
}

func TestNormalizeAndValidateImageAutoRequest(t *testing.T) {
	tests := []struct {
		name        string
		request     dto.ImageRequest
		wantQuality string
		wantN       uint
		wantSize    string
		wantErr     string
	}{
		{
			name:        "defaults quality and image count",
			request:     dto.ImageRequest{Model: "image-auto"},
			wantQuality: "auto",
			wantN:       1,
			wantSize:    "1024x1024",
		},
		{
			name:        "normalizes legacy standard quality",
			request:     dto.ImageRequest{Model: "image-auto", Quality: "standard", N: imageAutoUint(3)},
			wantQuality: "medium",
			wantN:       3,
			wantSize:    "1024x1024",
		},
		{
			name:        "accepts automatic quality",
			request:     dto.ImageRequest{Model: "image-auto", Quality: "auto", N: imageAutoUint(1)},
			wantQuality: "auto",
			wantN:       1,
			wantSize:    "1024x1024",
		},
		{
			name:    "rejects explicit zero images",
			request: dto.ImageRequest{Model: "image-auto", N: imageAutoUint(0)},
			wantErr: "n must be an integer between 1 and 4",
		},
		{
			name:    "rejects too many images",
			request: dto.ImageRequest{Model: "image-auto", N: imageAutoUint(5)},
			wantErr: "n must be an integer between 1 and 4",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			request := tt.request
			err := NormalizeAndValidateImageAutoRequest(&request)
			if tt.wantErr != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.wantErr)
				return
			}

			require.NoError(t, err)
			assert.Equal(t, tt.wantQuality, request.Quality)
			require.NotNil(t, request.N)
			assert.Equal(t, tt.wantN, *request.N)
			assert.Equal(t, tt.wantSize, request.Size)
		})
	}
}

func TestNormalizeAndValidateImageAutoRequestKeepsSizeIndependentFromQuality(t *testing.T) {
	tests := []struct {
		name    string
		quality string
		size    string
		want    string
	}{
		{name: "low preserves landscape size", quality: "low", size: "1024x576", want: "1024x576"},
		{name: "medium preserves landscape size", quality: "medium", size: "1792x1024", want: "1792x1024"},
		{name: "high preserves landscape size", quality: "high", size: "1024x576", want: "1024x576"},
		{name: "auto preserves portrait size", quality: "auto", size: "576x1024", want: "576x1024"},
		{name: "auto size uses verified default", quality: "high", size: "auto", want: "1024x1024"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			request := dto.ImageRequest{Model: "image-auto", Quality: test.quality, Size: test.size}

			require.NoError(t, NormalizeAndValidateImageAutoRequest(&request))
			assert.Equal(t, test.want, request.Size)
		})
	}
}

func TestNormalizeAndValidateImageAutoRequestSizeIsIdempotent(t *testing.T) {
	request := dto.ImageRequest{Model: "image-auto", Quality: "high", Size: "1024x576"}
	require.NoError(t, NormalizeAndValidateImageAutoRequest(&request))
	first := request.Size

	require.NoError(t, NormalizeAndValidateImageAutoRequest(&request))

	assert.Equal(t, "1024x576", first)
	assert.Equal(t, first, request.Size)
}

func TestNormalizeAndValidateImageAutoRequestRejectsInvalidSize(t *testing.T) {
	for _, size := range []string{
		"1024",
		"1024x",
		"0x1024",
		"31x31",
		"4097x1024",
		"4096x1024",
		"999999999999999999999999x1",
	} {
		t.Run(size, func(t *testing.T) {
			request := dto.ImageRequest{Model: "image-auto", Quality: "low", Size: size}

			err := NormalizeAndValidateImageAutoRequest(&request)

			require.Error(t, err)
			assert.Contains(t, err.Error(), "size")
		})
	}
}

func TestNewImageAutoBillingPlanFreezesRoutePrices(t *testing.T) {
	routes := []ImageAutoRouteSnapshot{{
		ChannelID:     36,
		Priority:      31,
		UpstreamModel: "gpt-image-2-alt",
		PriceData: types.PriceData{
			ModelPrice:        2,
			QuotaToPreConsume: 2000000,
		},
	}}
	routes[0].PriceData.AddOtherRatio("n", 2)

	plan := NewImageAutoBillingPlan(7, routes)

	routes[0].ChannelID = 99
	routes[0].Priority = 1
	routes[0].PriceData.ModelPrice = 88
	routes[0].PriceData.AddOtherRatio("n", 4)
	plan.Routes[0].PriceData.AddOtherRatio("quality", 3)

	require.Equal(t, int64(7), plan.Revision)
	require.Len(t, plan.Routes, 1)
	assert.Equal(t, 36, plan.Routes[0].ChannelID)
	assert.Equal(t, 31, plan.Routes[0].Priority)
	assert.Equal(t, "gpt-image-2-alt", plan.Routes[0].UpstreamModel)
	assert.Equal(t, 2.0, plan.Routes[0].PriceData.ModelPrice)
	assert.Equal(t, map[string]float64{"n": 2, "quality": 3}, plan.Routes[0].PriceData.OtherRatios())
	assert.Equal(t, map[string]float64{"n": 4}, routes[0].PriceData.OtherRatios())
}

func imageAutoUint(value uint) *uint {
	return &value
}
