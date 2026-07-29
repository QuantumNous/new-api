package relay

import (
	"slices"
	"strconv"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	dreambrandchannel "github.com/QuantumNous/new-api/relay/channel/dreambrand"
	taskdreambrand "github.com/QuantumNous/new-api/relay/channel/task/dreambrand"
)

func TestGetDreamBrandAdaptor(t *testing.T) {
	apiType, ok := common.ChannelType2APIType(constant.ChannelTypeDreamBrand)
	if !ok || apiType != constant.APITypeDreamBrand {
		t.Fatalf("DreamBrand API type = %d/%v", apiType, ok)
	}
	adaptor := GetAdaptor(constant.APITypeDreamBrand)
	if adaptor == nil {
		t.Fatal("GetAdaptor() returned nil")
	}
	if adaptor.GetChannelName() != dreambrandchannel.ChannelName {
		t.Fatalf("channel name = %q, want %q", adaptor.GetChannelName(), dreambrandchannel.ChannelName)
	}
	for _, modelName := range []string{"doubao-seedream-5.0-lite", "doubao-seedream-4.5", "doubao-seedance-2.0", "doubao-seedance-2.0-fast"} {
		if !slices.Contains(adaptor.GetModelList(), modelName) {
			t.Fatalf("model %q missing from normal adaptor list: %v", modelName, adaptor.GetModelList())
		}
	}
}

func TestGetDreamBrandTaskAdaptor(t *testing.T) {
	platform := constant.TaskPlatform(strconv.Itoa(constant.ChannelTypeDreamBrand))
	adaptor := GetTaskAdaptor(platform)
	if adaptor == nil {
		t.Fatal("GetTaskAdaptor() returned nil")
	}
	if adaptor.GetChannelName() != taskdreambrand.ChannelName {
		t.Fatalf("channel name = %q, want %q", adaptor.GetChannelName(), taskdreambrand.ChannelName)
	}
	if !slices.Contains(adaptor.GetModelList(), "seedance-2.0-standard") {
		t.Fatalf("model list = %v", adaptor.GetModelList())
	}
	if slices.Contains(adaptor.GetModelList(), "seedream-5.0-lite") || slices.Contains(adaptor.GetModelList(), "doubao-seedream-4.5") {
		t.Fatalf("image models must not be handled by the task adaptor: %v", adaptor.GetModelList())
	}
}
