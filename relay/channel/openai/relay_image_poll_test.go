package openai

import (
	"encoding/json"
	"testing"

	"github.com/QuantumNous/new-api/dto"
)

func TestImagePollDeadlineSeconds(t *testing.T) {
	twoKExtra := map[string]json.RawMessage{"resolution": json.RawMessage(`"2k"`)}
	fourKExtra := map[string]json.RawMessage{"resolution": json.RawMessage(`"4k"`)}

	cases := []struct {
		name string
		req  dto.ImageRequest
		want int
	}{
		{name: "default", req: dto.ImageRequest{}, want: 180},
		{name: "2k", req: dto.ImageRequest{Extra: twoKExtra}, want: 300},
		{name: "4k", req: dto.ImageRequest{Extra: fourKExtra}, want: 600},
		{name: "high", req: dto.ImageRequest{Quality: "high"}, want: 600},
		{name: "medium", req: dto.ImageRequest{Quality: "medium"}, want: 300},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := imagePollDeadlineSeconds(tc.req); got != tc.want {
				t.Fatalf("imagePollDeadlineSeconds() = %d, want %d", got, tc.want)
			}
		})
	}
}
