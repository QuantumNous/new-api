package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"
)

func TestBuildTestRequestAutoVolcSeedreamUsesImageRequest(t *testing.T) {
	ch := &model.Channel{Type: constant.ChannelTypeVolcEngine}
	req := buildTestRequest("doubao-seedream-4-5-251128", "", ch, false)
	img, ok := req.(*dto.ImageRequest)
	if !ok {
		t.Fatalf("buildTestRequest returned %T, want *dto.ImageRequest", req)
	}
	if img.Size != "2K" {
		t.Fatalf("seedream image test size = %q, want 2K", img.Size)
	}
}

func TestBuildImageTestRequestUsesOpenAICompatibleDefaultSize(t *testing.T) {
	ch := &model.Channel{Type: constant.ChannelTypeOpenAI}
	req := buildImageTestRequest("gpt-image-1", ch)
	if req.Size != "1024x1024" {
		t.Fatalf("openai image test size = %q, want 1024x1024", req.Size)
	}
}

func TestShouldUseTaskChannelTestForVolcEngineVideoModel(t *testing.T) {
	ch := &model.Channel{Type: constant.ChannelTypeVolcEngine, Models: "doubao-seedance-2.0"}
	if !shouldUseTaskChannelTest(ch, "doubao-seedance-2.0") {
		t.Fatal("VolcEngine seedance model should use task channel test")
	}
}

func TestBuildAgentPlanVideoTestRequestUsesDocumentedFields(t *testing.T) {
	payload := buildAgentPlanVideoTestRequest("doubao-seedance-2.0")

	if payload["model"] != "doubao-seedance-2.0" {
		t.Fatalf("model = %v", payload["model"])
	}
	if _, ok := payload["draft"]; ok {
		t.Fatal("payload should not include draft")
	}
	if payload["generate_audio"] != false {
		t.Fatalf("generate_audio = %v, want false", payload["generate_audio"])
	}
	if payload["ratio"] != "adaptive" {
		t.Fatalf("ratio = %v, want adaptive", payload["ratio"])
	}
	if payload["duration"] != 5 {
		t.Fatalf("duration = %v, want 5", payload["duration"])
	}
	if payload["watermark"] != false {
		t.Fatalf("watermark = %v, want false", payload["watermark"])
	}

	content, ok := payload["content"].([]map[string]interface{})
	if !ok || len(content) != 1 {
		t.Fatalf("content = %#v, want one text item", payload["content"])
	}
	if content[0]["type"] != "text" || content[0]["text"] == "" {
		t.Fatalf("content[0] = %#v, want text prompt", content[0])
	}
}

func TestEndpointTypeFromModelType(t *testing.T) {
	cases := map[string]constant.EndpointType{
		model.ModelTypeText:      constant.EndpointTypeOpenAI,
		model.ModelTypeEmbedding: constant.EndpointTypeEmbeddings,
		model.ModelTypeImage:     constant.EndpointTypeImageGeneration,
		model.ModelTypeFile:      constant.EndpointTypeOpenAIResponse,
		model.ModelTypeAudio:     constant.EndpointTypeAudioTranscription,
		model.ModelTypeVideo:     constant.EndpointTypeOpenAI,
	}
	for modelType, want := range cases {
		got := endpointTypeFromModelType(modelType)
		if got != want {
			t.Fatalf("endpointTypeFromModelType(%q) = %q, want %q", modelType, got, want)
		}
	}
}

// ASR models must be routed to /v1/audio/transcriptions instead of the chat
// endpoint, so buildTestRequest has to return an AudioRequest for them. The
// match is token-based: a bare "contains asr" check would also capture
// unrelated model names.
func TestIsAudioTranscriptionModel(t *testing.T) {
	for _, tc := range []struct {
		model string
		want  bool
	}{
		{"volc.seedasr.sauc.duration", true},
		{"doubao-seed-asr-2.0", true},
		{"volc.bigasr.sauc.duration", true},
		{"ASR", true},
		{"whisper-1", false},
		{"seed-tts-2.0", false},
		{"gpt-4o", false},
		{"", false},
		// must not match names that merely contain the letters "asr"
		{"asratchet-v1", false},
		{"disaster-model", false},
	} {
		if got := isAudioTranscriptionModel(tc.model); got != tc.want {
			t.Errorf("isAudioTranscriptionModel(%q) = %v, want %v", tc.model, got, tc.want)
		}
	}
}

func TestBuildTestRequestASRModelUsesAudioRequest(t *testing.T) {
	ch := &model.Channel{Type: constant.ChannelTypeVolcEngine}
	req := buildTestRequest("volc.seedasr.sauc.duration", "", ch, false)
	audio, ok := req.(*dto.AudioRequest)
	if !ok {
		t.Fatalf("buildTestRequest returned %T, want *dto.AudioRequest", req)
	}
	if audio.Model != "volc.seedasr.sauc.duration" {
		t.Fatalf("audio test model = %q, want volc.seedasr.sauc.duration", audio.Model)
	}
}
