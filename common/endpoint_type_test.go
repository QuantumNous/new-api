package common

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
)

func TestGetEndpointTypesByChannelType(t *testing.T) {
	type testCase struct {
		name        string
		channelType int
		modelName   string
		// wantFirst is the expected first element of the returned slice.
		wantFirst constant.EndpointType
		// wantContains lists types that must appear anywhere in the result.
		wantContains []constant.EndpointType
		// wantAbsent lists types that must NOT appear in the result.
		wantAbsent []constant.EndpointType
		// exactSlice, if non-nil, asserts the entire slice matches exactly.
		exactSlice []constant.EndpointType
	}

	cases := []testCase{
		// --- VolcAdapter (ch 58): falls through to the default case (EndpointTypeOpenAI),
		//     matching upstream's treatment of task-style channels (Kling/Jimeng/Suno).
		// Use string literals for the volc-image/volc-video absence assertions below.
		{
			name:        "VolcAdapter + seedream model → falls through to default (image-generation prepend applies)",
			channelType: constant.ChannelTypeVolcAdapter,
			modelName:   "doubao-seedream-5-0-260128",
			// Seedream is an image model, so EndpointTypeImageGeneration is prepended by the default path.
			wantFirst:  constant.EndpointTypeImageGeneration,
			wantAbsent: []constant.EndpointType{"volc-image", "volc-video"},
		},
		{
			name:        "VolcAdapter + seedance model → falls through to default (openai)",
			channelType: constant.ChannelTypeVolcAdapter,
			modelName:   "doubao-seedance-2-0-260128",
			wantFirst:   constant.EndpointTypeOpenAI,
			wantAbsent:  []constant.EndpointType{"volc-image", "volc-video"},
		},
		{
			name:        "VolcAdapter + arbitrary model → falls through to default (openai)",
			channelType: constant.ChannelTypeVolcAdapter,
			modelName:   "gpt-4o",
			wantFirst:   constant.EndpointTypeOpenAI,
			wantAbsent:  []constant.EndpointType{"volc-image", "volc-video"},
		},
		// --- Regression: VolcEngine (45) with seedream must NOT include volc-image ---
		{
			name:        "VolcEngine (45) + seedream → no volc-image (reverted to default)",
			channelType: constant.ChannelTypeVolcEngine,
			modelName:   "doubao-seedream-5-0-260128",
			// After revert, VolcEngine falls to default; seedream triggers image-generation prepend.
			wantContains: []constant.EndpointType{constant.EndpointTypeImageGeneration},
			wantAbsent:   []constant.EndpointType{"volc-image"},
		},
		// --- Regression: VolcEngine (45) + LLM → default openai ---
		{
			name:        "VolcEngine (45) + LLM model → default openai",
			channelType: constant.ChannelTypeVolcEngine,
			modelName:   "Doubao-pro-32k",
			wantFirst:   constant.EndpointTypeOpenAI,
			wantAbsent:  []constant.EndpointType{"volc-image", "volc-video"},
		},
		// --- Regression: DoubaoVideo (54) + seedance must NOT include volc-video ---
		{
			name:        "DoubaoVideo (54) + seedance → no volc-video (reverted to default)",
			channelType: constant.ChannelTypeDoubaoVideo,
			modelName:   "doubao-seedance-2-0-260128",
			// After revert, DoubaoVideo falls to default; seedance is not an image model so no special casing.
			wantAbsent: []constant.EndpointType{"volc-video"},
		},
		// --- DoubaoVideo (54) + arbitrary → default openai ---
		{
			name:        "DoubaoVideo (54) + arbitrary model → default openai",
			channelType: constant.ChannelTypeDoubaoVideo,
			modelName:   "some-video-model",
			wantFirst:   constant.EndpointTypeOpenAI,
			wantAbsent:  []constant.EndpointType{"volc-video", "volc-image"},
		},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			got := GetEndpointTypesByChannelType(tc.channelType, tc.modelName)

			if tc.exactSlice != nil {
				if len(got) != len(tc.exactSlice) {
					t.Fatalf("expected slice %v, got %v", tc.exactSlice, got)
				}
				for i, want := range tc.exactSlice {
					if got[i] != want {
						t.Errorf("index %d: want %q, got %q", i, want, got[i])
					}
				}
				return
			}

			if tc.wantFirst != "" {
				if len(got) == 0 || got[0] != tc.wantFirst {
					t.Errorf("expected first element %q, got %v", tc.wantFirst, got)
				}
			}

			contains := func(slice []constant.EndpointType, target constant.EndpointType) bool {
				for _, v := range slice {
					if v == target {
						return true
					}
				}
				return false
			}

			for _, want := range tc.wantContains {
				if !contains(got, want) {
					t.Errorf("expected %q to be present in %v", want, got)
				}
			}

			for _, absent := range tc.wantAbsent {
				if contains(got, absent) {
					t.Errorf("expected %q to be absent from %v", absent, got)
				}
			}
		})
	}
}
