package relay

import (
	"slices"
	"strconv"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/relay/channel/task/dreambrand"
)

func TestGetDreamBrandTaskAdaptor(t *testing.T) {
	platform := constant.TaskPlatform(strconv.Itoa(constant.ChannelTypeDreamBrand))
	adaptor := GetTaskAdaptor(platform)
	if adaptor == nil {
		t.Fatal("GetTaskAdaptor() returned nil")
	}
	if adaptor.GetChannelName() != dreambrand.ChannelName {
		t.Fatalf("channel name = %q, want %q", adaptor.GetChannelName(), dreambrand.ChannelName)
	}
	if !slices.Contains(adaptor.GetModelList(), "seedance-2.0-standard") {
		t.Fatalf("model list = %v", adaptor.GetModelList())
	}
	if !slices.Contains(adaptor.GetModelList(), "seedream-5.0-lite") || !slices.Contains(adaptor.GetModelList(), "seedream-4.5") {
		t.Fatalf("image models missing from model list = %v", adaptor.GetModelList())
	}
	if !slices.Contains(adaptor.GetModelList(), "doubao-seedream-5.0-lite") || !slices.Contains(adaptor.GetModelList(), "doubao-seedream-4.5") {
		t.Fatalf("image model aliases missing from model list = %v", adaptor.GetModelList())
	}
}
