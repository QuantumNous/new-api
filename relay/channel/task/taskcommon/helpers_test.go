package taskcommon

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
)

func TestShouldWhitelabelPlatform(t *testing.T) {
	tests := []struct {
		name     string
		platform constant.TaskPlatform
		want     bool
	}{
		{"kuaizi (channel 58)", constant.TaskPlatform("58"), true},
		{"blockrun-video (channel 101)", constant.TaskPlatform("101"), true},
		{"jimeng zhizinan (channel 104)", constant.TaskPlatform("104"), true},
		{"openai channel type number", constant.TaskPlatform("1"), false},
		{"non-numeric platform suno", constant.TaskPlatformSuno, false},
		{"empty platform", constant.TaskPlatform(""), false},
		{"garbage platform", constant.TaskPlatform("not-a-number"), false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := ShouldWhitelabelPlatform(tt.platform); got != tt.want {
				t.Errorf("ShouldWhitelabelPlatform(%q) = %v, want %v", tt.platform, got, tt.want)
			}
		})
	}
}

func TestShouldWhitelabelChannelType(t *testing.T) {
	if !ShouldWhitelabelChannelType(constant.ChannelTypeKuaiziLizhen) {
		t.Errorf("expected kuaizi channel type %d to be whitelabeled", constant.ChannelTypeKuaiziLizhen)
	}
	if !ShouldWhitelabelChannelType(constant.ChannelTypeBlockRunVideo) {
		t.Errorf("expected blockrun-video channel type %d to be whitelabeled", constant.ChannelTypeBlockRunVideo)
	}
	if !ShouldWhitelabelChannelType(constant.ChannelTypeJimengZhizinan) {
		t.Errorf("expected jimeng zhizinan channel type %d to be whitelabeled", constant.ChannelTypeJimengZhizinan)
	}
	if ShouldWhitelabelChannelType(0) {
		t.Error("zero channel type should not be whitelabeled")
	}
	if ShouldWhitelabelChannelType(constant.ChannelTypeKuaiziLizhen + 9999) {
		t.Error("unknown channel type should not be whitelabeled")
	}
}

func TestScrubBrandedText(t *testing.T) {
	const generic = "task failed at upstream provider"
	tests := []struct {
		name  string
		input string
		want  string
	}{
		{"empty stays empty", "", ""},
		{"plain message unchanged", "prompt rejected by safety filter", "prompt rejected by safety filter"},
		{"contains kuaizi", "kuaizi upstream code=500", generic},
		{"contains lizhen mixed case", "LIZHEN service unavailable", generic},
		{"contains volces host", "fetch https://x.tos-cn-beijing.volces.com/abc failed", generic},
		{"contains bytedance", "bytedance returned 4xx", generic},
		{"contains kz-cgt id", "task id kz-cgt-178100 not found", generic},
		{"contains blockrun host", "fetch https://blockrun.ai/api/media/x.mp4 failed", generic},
		{"contains flatkey", "api2.flatkey.ai gateway error", generic},
		{"contains jimeng host", "jimeng.jianying.com returned 500", generic},
		{"contains dreamina model", "dreamina seedance failed", generic},
		{"unrelated word with substring", "kuai noodles", "kuai noodles"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := ScrubBrandedText(tt.input); got != tt.want {
				t.Errorf("ScrubBrandedText(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}
