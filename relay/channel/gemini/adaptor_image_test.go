package gemini

import (
	"encoding/json"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
)

func TestConvertImageRequestForGeneratedGeminiImageKeepsCount(t *testing.T) {
	count := uint(3)
	adaptor := &Adaptor{}
	converted, err := adaptor.ConvertImageRequest(nil, &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeImagesGenerations,
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "gemini-image",
		},
	}, dto.ImageRequest{
		Prompt:  "draw a control panel",
		N:       &count,
		Size:    "16:9",
		Quality: "high",
	})
	if err != nil {
		t.Fatalf("ConvertImageRequest returned error: %v", err)
	}
	req, ok := converted.(dto.GeminiChatRequest)
	if !ok {
		t.Fatalf("converted request type = %T, want dto.GeminiChatRequest", converted)
	}
	if req.GenerationConfig.CandidateCount == nil || *req.GenerationConfig.CandidateCount != 3 {
		t.Fatalf("candidateCount = %v, want 3", req.GenerationConfig.CandidateCount)
	}
	var imageConfig map[string]any
	if err := common.Unmarshal(req.GenerationConfig.ImageConfig, &imageConfig); err != nil {
		t.Fatalf("unmarshal imageConfig: %v", err)
	}
	if imageConfig["aspectRatio"] != "16:9" || imageConfig["imageSize"] != "2K" {
		t.Fatalf("imageConfig = %#v, want aspectRatio=16:9 imageSize=2K", imageConfig)
	}
}

func TestConvertImageRequestPreservesCountWhenExtraGenerationConfigMerges(t *testing.T) {
	count := uint(3)
	temperature := 0.4
	extraFields, err := common.Marshal(map[string]json.RawMessage{
		"generationConfig": json.RawMessage(`{"temperature":0.4}`),
	})
	if err != nil {
		t.Fatalf("marshal extra fields: %v", err)
	}
	adaptor := &Adaptor{}
	converted, err := adaptor.ConvertImageRequest(nil, &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeImagesGenerations,
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "gemini-image",
		},
	}, dto.ImageRequest{
		Prompt:      "draw a control panel",
		N:           &count,
		ExtraFields: extraFields,
	})
	if err != nil {
		t.Fatalf("ConvertImageRequest returned error: %v", err)
	}
	req, ok := converted.(dto.GeminiChatRequest)
	if !ok {
		t.Fatalf("converted request type = %T, want dto.GeminiChatRequest", converted)
	}
	if req.GenerationConfig.CandidateCount == nil || *req.GenerationConfig.CandidateCount != 3 {
		t.Fatalf("candidateCount = %v, want 3", req.GenerationConfig.CandidateCount)
	}
	if req.GenerationConfig.Temperature == nil || *req.GenerationConfig.Temperature != temperature {
		t.Fatalf("temperature = %v, want %v", req.GenerationConfig.Temperature, temperature)
	}
}
