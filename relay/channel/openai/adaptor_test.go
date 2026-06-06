package openai

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
)

func TestConvertImageRequestAppendsXGAPIAspectRatioFromSize(t *testing.T) {
	adaptor := &Adaptor{}
	info := &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeImagesGenerations,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl: "https://xgapi.top",
		},
	}

	converted, err := adaptor.ConvertImageRequest(nil, info, dto.ImageRequest{
		Model:  "gpt-image-2",
		Prompt: "A clean studio product photo.",
		Size:   "1792x1024",
	})
	if err != nil {
		t.Fatalf("ConvertImageRequest returned error: %v", err)
	}

	request, ok := converted.(dto.ImageRequest)
	if !ok {
		t.Fatalf("converted request type = %T, want dto.ImageRequest", converted)
	}
	if !strings.Contains(request.Prompt, "Required image aspect ratio: 16:9.") {
		t.Fatalf("prompt did not contain xgapi aspect-ratio instruction: %q", request.Prompt)
	}
}

func TestConvertImageRequestSkipsAspectRatioAppendForNonXGAPI(t *testing.T) {
	adaptor := &Adaptor{}
	info := &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeImagesGenerations,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl: "https://api.openai.com",
		},
	}

	converted, err := adaptor.ConvertImageRequest(nil, info, dto.ImageRequest{
		Model:  "gpt-image-2",
		Prompt: "A clean studio product photo.",
		Size:   "1792x1024",
	})
	if err != nil {
		t.Fatalf("ConvertImageRequest returned error: %v", err)
	}

	request, ok := converted.(dto.ImageRequest)
	if !ok {
		t.Fatalf("converted request type = %T, want dto.ImageRequest", converted)
	}
	if strings.Contains(request.Prompt, "Required image aspect ratio") {
		t.Fatalf("non-xgapi prompt should not be modified: %q", request.Prompt)
	}
}

func TestAppendXGAPIImageAspectRatioToPromptDoesNotDuplicateExplicitRatio(t *testing.T) {
	request := dto.ImageRequest{
		Prompt: "Create a poster in 16:9.",
		Size:   "1792x1024",
	}

	got := appendXGAPIImageAspectRatioToPrompt(request.Prompt, request)

	if got != request.Prompt {
		t.Fatalf("prompt with explicit ratio should be unchanged, got %q", got)
	}
}

func TestXGAPIImageAspectRatioFromExtraBody(t *testing.T) {
	request := dto.ImageRequest{
		Prompt:    "Create a poster.",
		ExtraBody: []byte(`{"imageConfig":{"aspectRatio":"9:16"}}`),
	}

	got := appendXGAPIImageAspectRatioToPrompt(request.Prompt, request)

	if !strings.Contains(got, "Required image aspect ratio: 9:16.") {
		t.Fatalf("prompt did not contain aspect ratio from extra_body: %q", got)
	}
}
