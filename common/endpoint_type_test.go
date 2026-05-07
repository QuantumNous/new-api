package common

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
)

func TestGetEndpointTypesByChannelType_DoubaoVideoUsesOpenAIVideo(t *testing.T) {
	endpoints := GetEndpointTypesByChannelType(constant.ChannelTypeDoubaoVideo, "doubao-seedance-1-0-pro-250528")
	if len(endpoints) != 2 {
		t.Fatalf("expected 2 endpoint types, got %d: %v", len(endpoints), endpoints)
	}
	if endpoints[0] != constant.EndpointTypeOpenAIVideo {
		t.Fatalf("expected %q, got %q", constant.EndpointTypeOpenAIVideo, endpoints[0])
	}
	if endpoints[1] != constant.EndpointTypeSeedanceVideoNative {
		t.Fatalf("expected %q, got %q", constant.EndpointTypeSeedanceVideoNative, endpoints[1])
	}
}

func TestGetEndpointTypesByChannelType_SoraDoesNotUseSeedanceNative(t *testing.T) {
	endpoints := GetEndpointTypesByChannelType(constant.ChannelTypeSora, "sora-2")
	if len(endpoints) != 1 {
		t.Fatalf("expected 1 endpoint type, got %d: %v", len(endpoints), endpoints)
	}
	if endpoints[0] != constant.EndpointTypeOpenAIVideo {
		t.Fatalf("expected %q, got %q", constant.EndpointTypeOpenAIVideo, endpoints[0])
	}
}

func TestGetDefaultEndpointInfo_OpenAIVideo(t *testing.T) {
	info, ok := GetDefaultEndpointInfo(constant.EndpointTypeOpenAIVideo)
	if !ok {
		t.Fatalf("expected default endpoint info for %q", constant.EndpointTypeOpenAIVideo)
	}
	if info.Path != "/v1/videos" {
		t.Fatalf("expected path %q, got %q", "/v1/videos", info.Path)
	}
	if info.Method != "POST" {
		t.Fatalf("expected method %q, got %q", "POST", info.Method)
	}
	if len(info.Aliases) != 0 {
		t.Fatalf("expected no aliases for generic openai-video, got %d: %v", len(info.Aliases), info.Aliases)
	}
}

func TestGetDefaultEndpointInfo_SeedanceVideoNative(t *testing.T) {
	info, ok := GetDefaultEndpointInfo(constant.EndpointTypeSeedanceVideoNative)
	if !ok {
		t.Fatalf("expected default endpoint info for %q", constant.EndpointTypeSeedanceVideoNative)
	}
	if info.Path != "/api/v3/contents/generations/tasks" {
		t.Fatalf("expected path %q, got %q", "/api/v3/contents/generations/tasks", info.Path)
	}
	if info.Method != "POST" {
		t.Fatalf("expected method %q, got %q", "POST", info.Method)
	}
	if len(info.Aliases) != 1 {
		t.Fatalf("expected 1 alias, got %d: %v", len(info.Aliases), info.Aliases)
	}
	if info.Aliases[0].Path != "/api/v3/contents/generations/tasks/{task_id}" || info.Aliases[0].Method != "GET" {
		t.Fatalf("expected query task alias, got %+v", info.Aliases[0])
	}
}
