package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
)

func TestDetectProbeModelKind(t *testing.T) {
	cases := []struct {
		model string
		want  string
	}{
		{"gpt-image-2", string(constant.EndpointTypeImageGeneration)},
		{"dall-e-3", string(constant.EndpointTypeImageGeneration)},
		{"seedream-3.0", string(constant.EndpointTypeImageGeneration)},
		{"text-embedding-3-small", string(constant.EndpointTypeEmbeddings)},
		{"bge-m3", string(constant.EndpointTypeEmbeddings)},
		{"jina-rerank-v2", string(constant.EndpointTypeJinaRerank)},
		{"gpt-5-codex", string(constant.EndpointTypeOpenAIResponse)},
		{"gpt-4o-mini", ""},
		{"claude-sonnet-4", ""},
	}
	for _, tc := range cases {
		if got := detectProbeModelKind(tc.model); got != tc.want {
			t.Fatalf("detectProbeModelKind(%q)=%q want %q", tc.model, got, tc.want)
		}
	}
}

func TestIsChatCapableProbeModel(t *testing.T) {
	if !isChatCapableProbeModel("gpt-4o-mini") {
		t.Fatal("gpt-4o-mini should be chat capable")
	}
	for _, name := range []string{"gpt-image-2", "whisper-1", "text-embedding-3-large", "sora-2"} {
		if isChatCapableProbeModel(name) {
			t.Fatalf("%s should not be chat capable", name)
		}
	}
}

func TestPickAutoTestModel(t *testing.T) {
	imageOnly := "gpt-image-2"
	chat := "gpt-4o-mini"
	ch := &model.Channel{Models: "gpt-image-2,gpt-4o-mini"}
	if got := pickAutoTestModel(ch); got != chat {
		t.Fatalf("pickAutoTestModel=%q want %q", got, chat)
	}
	ch.TestModel = &imageOnly
	if got := pickAutoTestModel(ch); got != chat {
		t.Fatalf("with image TestModel pick=%q want %q", got, chat)
	}
	ch.TestModel = &chat
	if got := pickAutoTestModel(ch); got != chat {
		t.Fatalf("with chat TestModel pick=%q want %q", got, chat)
	}
	ch.Models = "gpt-image-2,dall-e-3"
	ch.TestModel = &imageOnly
	if got := pickAutoTestModel(ch); got != "" {
		t.Fatalf("image-only channel pick=%q want empty", got)
	}
}

func TestShouldSkipAutoChannelTest(t *testing.T) {
	ch := &model.Channel{Status: common.ChannelStatusEnabled}
	if shouldSkipAutoChannelTest(ch) {
		t.Fatal("enabled channel should not skip")
	}
	ch.Status = common.ChannelStatusManuallyDisabled
	if !shouldSkipAutoChannelTest(ch) {
		t.Fatal("manually disabled should skip")
	}
	ch.Status = common.ChannelStatusEnabled
	ch.SetSetting(dto.ChannelSettings{SkipAutoTest: true})
	if !shouldSkipAutoChannelTest(ch) {
		t.Fatal("SkipAutoTest setting should skip")
	}
}

func TestNormalizeChannelTestEndpointInfersImage(t *testing.T) {
	if got := normalizeChannelTestEndpoint(nil, "gpt-image-2", ""); got != string(constant.EndpointTypeImageGeneration) {
		t.Fatalf("image endpoint=%q", got)
	}
	if got := normalizeChannelTestEndpoint(nil, "gpt-4o-mini", ""); got != "" {
		t.Fatalf("chat endpoint should be empty, got %q", got)
	}
	if got := normalizeChannelTestEndpoint(nil, "gpt-4o-mini", "openai"); got != "openai" {
		t.Fatalf("explicit endpoint not preserved: %q", got)
	}
}
