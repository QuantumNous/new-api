package service

import (
	"errors"
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/types"
)

func apiErr(msg string) *types.NewAPIError {
	return types.NewOpenAIError(errors.New(msg), types.ErrorCodeBadResponse, http.StatusInternalServerError)
}

func TestClassifyModelValidation(t *testing.T) {
	cases := []struct {
		name     string
		localErr error
		apiErr   *types.NewAPIError
		want     ModelLiveness
		wantCode int
	}{
		{
			name: "success",
			want: ModelAlive, wantCode: 200,
		},
		{
			name:   "404 model does not exist => dead",
			apiErr: apiErr("bad response status code 404, message: The model `gpt-x` does not exist, body: {}"),
			want:   ModelDead, wantCode: 404,
		},
		{
			name:   "400 not a valid model id => dead",
			apiErr: apiErr("bad response status code 400, message: qwen/qwen3-foo is not a valid model ID, body: {}"),
			want:   ModelDead, wantCode: 400,
		},
		{
			name:   "no longer available => dead",
			apiErr: apiErr("bad response status code 404, message: This model models/gemini-2.0-flash is no longer available to new users, body: {}"),
			want:   ModelDead, wantCode: 404,
		},
		{
			name:   "400 unknown parameter => uncertain",
			apiErr: apiErr("bad response status code 400, message: Unknown parameter: 'max_completion_tokens', body: {}"),
			want:   ModelUncertain, wantCode: 400,
		},
		{
			name:   "responses-only model => uncertain",
			apiErr: apiErr("bad response status code 404, message: This model is only supported in v1/responses and not in v1/chat/completions, body: {}"),
			want:   ModelUncertain, wantCode: 404,
		},
		{
			name:   "not a chat model => uncertain",
			apiErr: apiErr("bad response status code 404, message: This is not a chat model and thus not supported in the v1/chat/completions endpoint, body: {}"),
			want:   ModelUncertain, wantCode: 404,
		},
		{
			name:   "429 rate limit => uncertain",
			apiErr: apiErr("bad response status code 429, message: Rate limit reached, body: {}"),
			want:   ModelUncertain, wantCode: 429,
		},
		{
			name:   "403 billing => uncertain",
			apiErr: apiErr("bad response status code 403, message: API key suspended due to insufficient credit, body: {}"),
			want:   ModelUncertain, wantCode: 403,
		},
		{
			name:   "500 not implemented => uncertain",
			apiErr: apiErr("bad response status code 500, message: not implemented, body: {}"),
			want:   ModelUncertain, wantCode: 500,
		},
		{
			name:     "local timeout => uncertain, 0",
			localErr: errors.New("model validation timed out"),
			want:     ModelUncertain, wantCode: 0,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, code := ClassifyModelValidation(tc.localErr, tc.apiErr)
			if got != tc.want {
				t.Errorf("liveness = %q, want %q", got, tc.want)
			}
			if code != tc.wantCode {
				t.Errorf("code = %d, want %d", code, tc.wantCode)
			}
		})
	}
}

func TestParseUpstreamStatusCode(t *testing.T) {
	cases := []struct {
		in   string
		want int
	}{
		{"bad response status code 404, message: x", 404},
		{"bad response status code 500, body: x", 500},
		{"some random transport error", 0},
		{"status code without prefix 404", 0},
	}
	for _, tc := range cases {
		if got := parseUpstreamStatusCode(tc.in); got != tc.want {
			t.Errorf("parseUpstreamStatusCode(%q) = %d, want %d", tc.in, got, tc.want)
		}
	}
}
