package common

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
)

func TestGetEndpointTypesByChannelType_DoubaoVideoUsesOpenAIVideo(t *testing.T) {
	endpoints := GetEndpointTypesByChannelType(constant.ChannelTypeDoubaoVideo, "doubao-seedance-1-0-pro-250528")
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
}
