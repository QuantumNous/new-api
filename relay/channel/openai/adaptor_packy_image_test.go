package openai

import (
	"encoding/json"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

func TestShouldNormalizeGptImage2SizeUsesCapabilities(t *testing.T) {
	tests := []struct {
		name       string
		baseURL    string
		sizeFormat dto.GptImage2SizeFormat
		want       bool
	}{
		{
			name:       "configured pixel dimensions",
			baseURL:    "https://example.com",
			sizeFormat: dto.GptImage2SizeFormatPixelDimensions,
			want:       true,
		},
		{
			name:       "configured aspect ratio overrides legacy base",
			baseURL:    "https://api.packyapi.com",
			sizeFormat: dto.GptImage2SizeFormatAspectRatioWithResolution,
			want:       false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			info := &relaycommon.RelayInfo{
				ChannelMeta: &relaycommon.ChannelMeta{
					ChannelBaseUrl: tt.baseURL,
					ChannelOtherSettings: dto.ChannelOtherSettings{
						GptImage2Capabilities: &dto.GptImage2Capabilities{
							Version:    1,
							Enabled:    true,
							SizeFormat: tt.sizeFormat,
						},
					},
				},
			}
			if got := shouldNormalizeGptImage2Size(info); got != tt.want {
				t.Fatalf("shouldNormalizeGptImage2Size() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestNormalizeSyncGptImage2ImageRequestMapsResolutionToSize(t *testing.T) {
	req := dto.ImageRequest{
		Model:      "gpt-image-2",
		Prompt:     "x",
		Size:       "1:1",
		Resolution: "2k",
	}

	normalizeSyncGptImage2ImageRequest(&req)

	if req.Size != "2048x2048" {
		t.Fatalf("size = %q, want 2048x2048", req.Size)
	}
	if req.Resolution != "" {
		t.Fatalf("resolution = %q, want empty", req.Resolution)
	}
	encoded, err := json.Marshal(req)
	if err != nil {
		t.Fatal(err)
	}
	if string(encoded) == "" || json.Valid(encoded) != true {
		t.Fatalf("invalid json: %s", encoded)
	}
	var fields map[string]any
	if err := json.Unmarshal(encoded, &fields); err != nil {
		t.Fatal(err)
	}
	if _, ok := fields["resolution"]; ok {
		t.Fatalf("resolution should be omitted: %s", encoded)
	}
}

func TestNormalizeSyncGptImage2ImageRequestMapsRatioWithoutResolution(t *testing.T) {
	req := dto.ImageRequest{
		Model: "gpt-image-2",
		Size:  "1:1",
	}

	normalizeSyncGptImage2ImageRequest(&req)

	if req.Size != "1024x1024" {
		t.Fatalf("size = %q, want %q", req.Size, "1024x1024")
	}
}

func TestGptImage2SizeForResolution(t *testing.T) {
	cases := []struct {
		size       string
		resolution string
		want       string
	}{
		{"16:9", "1k", "1536x864"},
		{"16:9", "2k", "2048x1152"},
		{"16:9", "4k", "3840x2160"},
		{"9:16", "4k", "2160x3840"},
		{"1:1", "4k", "2880x2880"},
		{"1024x1024", "2k", "1024x1024"},
	}
	for _, c := range cases {
		if got := gptImage2SizeForResolution(c.size, c.resolution); got != c.want {
			t.Fatalf("gptImage2SizeForResolution(%q, %q) = %q, want %q", c.size, c.resolution, got, c.want)
		}
	}
}
