package relay

import (
	"strconv"
	"testing"

	"github.com/QuantumNous/new-api/constant"
)

func TestGetTaskAdaptor_JimengProxy(t *testing.T) {
	adaptor := GetTaskAdaptor(constant.TaskPlatform(strconv.Itoa(constant.ChannelTypeJimengProxy)))
	if adaptor == nil {
		t.Fatal("expected JimengProxy task adaptor")
	}
	if adaptor.GetChannelName() != "JimengProxy" {
		t.Fatalf("channel name = %q, want JimengProxy", adaptor.GetChannelName())
	}
}

func TestGetTaskAdaptor_JimengZhizinan(t *testing.T) {
	adaptor := GetTaskAdaptor(constant.TaskPlatform(strconv.Itoa(constant.ChannelTypeJimengZhizinan)))
	if adaptor == nil {
		t.Fatal("expected JimengZhizinan task adaptor")
	}
	if adaptor.GetChannelName() != "JimengZhizinan" {
		t.Fatalf("channel name = %q, want JimengZhizinan", adaptor.GetChannelName())
	}
}

func TestGetTaskAdaptor_TechMobiVideo(t *testing.T) {
	adaptor := GetTaskAdaptor(constant.TaskPlatform(strconv.Itoa(constant.ChannelTypeTechMobiVideo)))
	if adaptor == nil {
		t.Fatal("expected TechMobiVideo task adaptor")
	}
	if adaptor.GetChannelName() != "techmobi-video" {
		t.Fatalf("channel name = %q, want techmobi-video", adaptor.GetChannelName())
	}
}
