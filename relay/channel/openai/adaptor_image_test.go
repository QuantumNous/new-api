package openai

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"

	"github.com/gin-gonic/gin"
)

func TestConvertImageRequest_StripsResponseFormatForOpenAIGPTImage2(t *testing.T) {
	adaptor := &Adaptor{}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType: constant.ChannelTypeOpenAI,
		},
	}
	request := dto.ImageRequest{
		Model:          "gpt-image-2",
		ResponseFormat: "b64_json",
	}

	gotAny, err := adaptor.ConvertImageRequest(gin.CreateTestContextOnly(nil, gin.New()), info, request)
	if err != nil {
		t.Fatalf("ConvertImageRequest returned error: %v", err)
	}

	got, ok := gotAny.(dto.ImageRequest)
	if !ok {
		t.Fatalf("ConvertImageRequest returned %T, want dto.ImageRequest", gotAny)
	}
	if got.ResponseFormat != "" {
		t.Fatalf("response_format = %q, want empty", got.ResponseFormat)
	}
}

func TestConvertImageRequest_KeepsResponseFormatForOtherImageModels(t *testing.T) {
	adaptor := &Adaptor{}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType: constant.ChannelTypeOpenAI,
		},
	}
	request := dto.ImageRequest{
		Model:          "dall-e-3",
		ResponseFormat: "b64_json",
	}

	gotAny, err := adaptor.ConvertImageRequest(gin.CreateTestContextOnly(nil, gin.New()), info, request)
	if err != nil {
		t.Fatalf("ConvertImageRequest returned error: %v", err)
	}

	got, ok := gotAny.(dto.ImageRequest)
	if !ok {
		t.Fatalf("ConvertImageRequest returned %T, want dto.ImageRequest", gotAny)
	}
	if got.ResponseFormat != "b64_json" {
		t.Fatalf("response_format = %q, want %q", got.ResponseFormat, "b64_json")
	}
}
