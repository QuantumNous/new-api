package relay

import (
	"strconv"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/relay/channel/copilot"
	"github.com/QuantumNous/new-api/relay/channel/task/byteplus"
	taskgroksubscription "github.com/QuantumNous/new-api/relay/channel/task/groksubscription"
	"github.com/QuantumNous/new-api/relay/channel/task/hailuo"
	hailuov2 "github.com/QuantumNous/new-api/relay/channel/task/hailuo_v2"
	"github.com/QuantumNous/new-api/relay/channel/task/modelapiseedance"
	"github.com/QuantumNous/new-api/relay/channel/task/sonilo"
)

func TestGetAdaptorCopilot(t *testing.T) {
	adaptor := GetAdaptor(constant.APITypeCopilot)
	if _, ok := adaptor.(*copilot.Adaptor); !ok {
		t.Fatalf("adaptor type = %T, want *copilot.Adaptor", adaptor)
	}
}

func TestGetAdaptorGrokSubscription(t *testing.T) {
	adaptor := GetAdaptor(constant.APITypeGrokSubscription)
	if adaptor == nil {
		t.Fatalf("GetAdaptor(APITypeGrokSubscription) = nil")
	}
	if got := adaptor.GetChannelName(); got != "grok_subscription" {
		t.Fatalf("channel name = %q, want grok_subscription", got)
	}
}

func TestGetTaskAdaptor_GrokSubscription(t *testing.T) {
	adaptor := GetTaskAdaptor(constant.TaskPlatform(strconv.Itoa(constant.ChannelTypeGrokSubscription)))
	if _, ok := adaptor.(*taskgroksubscription.TaskAdaptor); !ok {
		t.Fatalf("adaptor type = %T, want *groksubscription.TaskAdaptor", adaptor)
	}
	if got := adaptor.GetChannelName(); got != "grok_subscription_video" {
		t.Fatalf("channel name = %q, want grok_subscription_video", got)
	}
}

func TestGetTaskAdaptor_JimengProxy(t *testing.T) {
	adaptor := GetTaskAdaptor(constant.TaskPlatform(strconv.Itoa(constant.ChannelTypeJimengProxy)))
	if adaptor == nil {
		t.Fatal("expected JimengProxy task adaptor")
	}
	if adaptor.GetChannelName() != "JimengProxy" {
		t.Fatalf("channel name = %q, want JimengProxy", adaptor.GetChannelName())
	}
}

func TestGetTaskAdaptor_Sonilo(t *testing.T) {
	adaptor := GetTaskAdaptor(constant.TaskPlatform(strconv.Itoa(constant.ChannelTypeSonilo)))
	if _, ok := adaptor.(*sonilo.TaskAdaptor); !ok {
		t.Fatalf("adaptor type = %T, want *sonilo.TaskAdaptor", adaptor)
	}
}

func TestGetTaskAdaptor_BytePlus(t *testing.T) {
	adaptor := GetTaskAdaptor(constant.TaskPlatform(strconv.Itoa(constant.ChannelTypeBytePlus)))
	if adaptor == nil {
		t.Fatal("expected BytePlus task adaptor")
	}
	if _, ok := adaptor.(*byteplus.TaskAdaptor); !ok {
		t.Fatalf("adaptor type = %T, want *byteplus.TaskAdaptor", adaptor)
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

func TestGetTaskAdaptor_MiniMaxVersions(t *testing.T) {
	tests := []struct {
		name        string
		channelType int
		assertType  func(t *testing.T, adaptor any)
	}{
		{
			name:        "MiniMaxV1",
			channelType: constant.ChannelTypeMiniMax,
			assertType: func(t *testing.T, adaptor any) {
				if _, ok := adaptor.(*hailuo.TaskAdaptor); !ok {
					t.Fatalf("adaptor type = %T, want *hailuo.TaskAdaptor", adaptor)
				}
			},
		},
		{
			name:        "MiniMaxH3V2",
			channelType: constant.ChannelTypeMiniMaxH3,
			assertType: func(t *testing.T, adaptor any) {
				if _, ok := adaptor.(*hailuov2.TaskAdaptor); !ok {
					t.Fatalf("adaptor type = %T, want *hailuo_v2.TaskAdaptor", adaptor)
				}
			},
		},
		{
			name:        "UnrelatedBytePlus",
			channelType: constant.ChannelTypeBytePlus,
			assertType: func(t *testing.T, adaptor any) {
				if _, ok := adaptor.(*byteplus.TaskAdaptor); !ok {
					t.Fatalf("adaptor type = %T, want *byteplus.TaskAdaptor", adaptor)
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			adaptor := GetTaskAdaptor(constant.TaskPlatform(strconv.Itoa(tt.channelType)))
			if adaptor == nil {
				t.Fatal("expected task adaptor")
			}
			tt.assertType(t, adaptor)
		})
	}
}

func TestGetTaskAdaptor_ModelAPISeedance(t *testing.T) {
	adaptor := GetTaskAdaptor(constant.TaskPlatform(strconv.Itoa(constant.ChannelTypeModelAPISeedance)))
	if adaptor == nil {
		t.Fatal("expected ModelAPISeedance task adaptor")
	}
	if _, ok := adaptor.(*modelapiseedance.TaskAdaptor); !ok {
		t.Fatalf("adaptor type = %T, want *modelapiseedance.TaskAdaptor", adaptor)
	}
	if got := adaptor.GetChannelName(); got != "modelapi-seedance" {
		t.Fatalf("channel name = %q, want modelapi-seedance", got)
	}
}
