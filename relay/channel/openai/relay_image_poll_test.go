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
