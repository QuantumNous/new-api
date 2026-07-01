package middleware

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestHasImageInLastUserMessage(t *testing.T) {
	tests := []struct {
		name string
		body string
		want bool
	}{
		{
			name: "plain string content, no image",
			body: `{"model":"auto-coder","messages":[{"role":"user","content":"hello"}]}`,
			want: false,
		},
		{
			name: "last user message has image_url",
			body: `{"model":"auto-coder","messages":[{"role":"user","content":[{"type":"text","text":"what is this"},{"type":"image_url","image_url":{"url":"data:image/png;base64,xxx"}}]}]}`,
			want: true,
		},
		{
			name: "history has image but last user message is text-only",
			body: `{"model":"auto-coder","messages":[{"role":"user","content":[{"type":"image_url","image_url":{"url":"x"}}]},{"role":"assistant","content":"a cat"},{"role":"user","content":"now write the code"}]}`,
			want: false,
		},
		{
			name: "last user text-only array content",
			body: `{"model":"auto-coder","messages":[{"role":"user","content":[{"type":"text","text":"hi"}]}]}`,
			want: false,
		},
		{
			name: "no user message",
			body: `{"model":"auto-coder","messages":[{"role":"system","content":"sys"},{"role":"assistant","content":"hi"}]}`,
			want: false,
		},
		{
			name: "empty messages",
			body: `{"model":"auto-coder","messages":[]}`,
			want: false,
		},
		{
			name: "messages missing",
			body: `{"model":"auto-coder"}`,
			want: false,
		},
		{
			name: "invalid json",
			body: `{not json`,
			want: false,
		},
		{
			name: "image present in a non-last user turn but final user is text",
			body: `{"messages":[{"role":"user","content":[{"type":"image_url","image_url":{"url":"a"}}]},{"role":"user","content":"follow up text"}]}`,
			want: false,
		},
		{
			name: "image in the very last user message after several turns",
			body: `{"messages":[{"role":"user","content":"hi"},{"role":"assistant","content":"hello"},{"role":"user","content":"another"},{"role":"assistant","content":"reply"},{"role":"user","content":[{"type":"text","text":"look"},{"type":"image_url","image_url":{"url":"b"}}]}]}`,
			want: true,
		},
		{
			name: "Claude format: last user message has type=image",
			body: `{"messages":[{"role":"user","content":[{"type":"text","text":"analyze"},{"type":"image","source":{"type":"base64","media_type":"image/png","data":"iVBORw0KGgo..."}}]}]}`,
			want: true,
		},
		{
			name: "Claude format: text-only no image",
			body: `{"messages":[{"role":"user","content":[{"type":"text","text":"hello"}]}]}`,
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := hasImageInLastUserMessage([]byte(tt.body))
			assert.Equal(t, tt.want, got)
		})
	}
}
