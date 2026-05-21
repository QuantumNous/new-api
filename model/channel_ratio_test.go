package model

import "testing"

func TestChannel_GetChannelRatio(t *testing.T) {
	neg, zero, half, big := -3.0, 0.0, 0.5, 2.5
	cases := []struct {
		name  string
		input *float64
		want  float64
	}{
		{"nil 按 1.0 处理", nil, 1},
		{"负数按 1.0 处理", &neg, 1},
		{"允许 0", &zero, 0},
		{"小于 1 的正常值", &half, 0.5},
		{"大于 1 的正常值", &big, 2.5},
	}
	for _, c := range cases {
		ch := &Channel{ChannelRatio: c.input}
		if got := ch.GetChannelRatio(); got != c.want {
			t.Errorf("%s: GetChannelRatio() = %v, want %v", c.name, got, c.want)
		}
	}

	var nilChannel *Channel
	if got := nilChannel.GetChannelRatio(); got != 1 {
		t.Errorf("nil channel: GetChannelRatio() = %v, want 1", got)
	}
}
