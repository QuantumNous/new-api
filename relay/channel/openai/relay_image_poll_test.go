package openai

import (
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/gin-gonic/gin"
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
		{name: "4k", req: dto.ImageRequest{Extra: fourKExtra}, want: 900},
		{name: "high", req: dto.ImageRequest{Quality: "high"}, want: 900},
		{name: "hd", req: dto.ImageRequest{Quality: "hd"}, want: 900},
		{name: "medium", req: dto.ImageRequest{Quality: "medium"}, want: 300},
		{name: "size 1024", req: dto.ImageRequest{Size: "1024x1024"}, want: 180},
		{name: "size 1792 wide", req: dto.ImageRequest{Size: "1792x1024"}, want: 300},
		{name: "size 1792 hd", req: dto.ImageRequest{Size: "1792x1024", Quality: "hd"}, want: 900},
		{name: "size 4k pixels", req: dto.ImageRequest{Size: "3840x2160"}, want: 900},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := imagePollDeadlineSeconds(tc.req); got != tc.want {
				t.Fatalf("imagePollDeadlineSeconds() = %d, want %d", got, tc.want)
			}
		})
	}
}

func TestImagePollTierFromSize(t *testing.T) {
	cases := []struct {
		size string
		want int
	}{
		{size: "", want: 0},
		{size: "16:9", want: 0},
		{size: "1024x1024", want: 0},
		{size: "1792x1024", want: 1},
		{size: "2048x2048", want: 1},
		{size: "3840x2160", want: 2},
	}
	for _, tc := range cases {
		t.Run(tc.size, func(t *testing.T) {
			if got := imagePollTierFromSize(tc.size); got != tc.want {
				t.Fatalf("imagePollTierFromSize(%q) = %d, want %d", tc.size, got, tc.want)
			}
		})
	}
}

func TestIsClientAsyncImageGenerationsPath(t *testing.T) {
	gin.SetMode(gin.TestMode)

	cases := []struct {
		path string
		want bool
	}{
		{path: "/v1/images/generations/async", want: true},
		{path: "/v1/images/generations", want: false},
		{path: "/pg/images/generations/async", want: true},
	}
	for _, tc := range cases {
		t.Run(tc.path, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = httptest.NewRequest("POST", tc.path, strings.NewReader("{}"))
			if got := isClientAsyncImageGenerationsPath(c); got != tc.want {
				t.Fatalf("isClientAsyncImageGenerationsPath(%q) = %v, want %v", tc.path, got, tc.want)
			}
		})
	}
}
