package types

import (
	"errors"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestIsContextOverflowError(t *testing.T) {
	tests := []struct {
		name string
		err  *NewAPIError
		want bool
	}{
		{
			name: "context_too_large code",
			err:  NewOpenAIError(errors.New("too big"), ErrorCodeContextTooLarge, http.StatusServiceUnavailable),
			want: true,
		},
		{
			name: "context_length_exceeded code",
			err:  NewOpenAIError(errors.New("too big"), ErrorCodeContextLengthExceeded, http.StatusBadRequest),
			want: true,
		},
		{
			name: "message context window",
			err:  NewOpenAIError(errors.New("Your input exceeds the context window of this model"), ErrorCodeBadResponseStatusCode, http.StatusServiceUnavailable),
			want: true,
		},
		{
			name: "nested context_length_exceeded",
			err:  NewOpenAIError(errors.New(`{"error": {"code": "context_length_exceeded"}}`), ErrorCodeBadResponseStatusCode, http.StatusBadRequest),
			want: true,
		},
		{
			name: "unrelated 500",
			err:  NewOpenAIError(errors.New("responses stream error: failed"), ErrorCodeBadResponse, http.StatusInternalServerError),
			want: false,
		},
		{
			name: "nil",
			err:  nil,
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.want, IsContextOverflowError(tt.err))
		})
	}
}
