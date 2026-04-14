package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
)

func TestResolveChannelTestStream(t *testing.T) {
	settingsBytes, err := common.Marshal(dto.ChannelOtherSettings{
		TestStreamEnabled: true,
	})
	if err != nil {
		t.Fatalf("marshal settings failed: %v", err)
	}

	channel := &model.Channel{OtherSettings: string(settingsBytes)}
	if !resolveChannelTestStream(channel, nil) {
		t.Fatal("expected channel default stream test setting to be used when override is nil")
	}

	overrideFalse := false
	if resolveChannelTestStream(channel, &overrideFalse) {
		t.Fatal("expected explicit false override to disable stream test")
	}

	overrideTrue := true
	if !resolveChannelTestStream(channel, &overrideTrue) {
		t.Fatal("expected explicit true override to enable stream test")
	}

	codexChannel := &model.Channel{Type: constant.ChannelTypeCodex}
	if !resolveChannelTestStream(codexChannel, nil) {
		t.Fatal("expected codex channels without stored setting to default to stream test")
	}

	codexChannelWithExplicitFalse := &model.Channel{
		Type:          constant.ChannelTypeCodex,
		OtherSettings: `{"test_stream_enabled":false}`,
	}
	if resolveChannelTestStream(codexChannelWithExplicitFalse, nil) {
		t.Fatal("expected explicit false stream setting to override codex default")
	}

	nonCodexChannel := &model.Channel{Type: 1}
	if resolveChannelTestStream(nonCodexChannel, nil) {
		t.Fatal("expected non-codex channels without stored setting to default to non-stream test")
	}
}

func TestShouldSkipChannelAutoTest(t *testing.T) {
	tests := []struct {
		name                string
		channel             *model.Channel
		includeAutoDisabled bool
		want                bool
	}{
		{
			name:                "nil channel",
			channel:             nil,
			includeAutoDisabled: true,
			want:                true,
		},
		{
			name: "manual disabled always skipped",
			channel: &model.Channel{
				Status: common.ChannelStatusManuallyDisabled,
			},
			includeAutoDisabled: true,
			want:                true,
		},
		{
			name: "auto disabled skipped when disabled in monitor setting",
			channel: &model.Channel{
				Status: common.ChannelStatusAutoDisabled,
			},
			includeAutoDisabled: false,
			want:                true,
		},
		{
			name: "auto disabled included when enabled in monitor setting",
			channel: &model.Channel{
				Status: common.ChannelStatusAutoDisabled,
			},
			includeAutoDisabled: true,
			want:                false,
		},
		{
			name: "enabled channel is included",
			channel: &model.Channel{
				Status: common.ChannelStatusEnabled,
			},
			includeAutoDisabled: false,
			want:                false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := shouldSkipChannelAutoTest(tt.channel, tt.includeAutoDisabled)
			if got != tt.want {
				t.Fatalf("shouldSkipChannelAutoTest() = %v, want %v", got, tt.want)
			}
		})
	}
}
