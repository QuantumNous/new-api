package service

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestImageReferencesDelegateValidationToUpstream(t *testing.T) {
	for _, raw := range []string{`["provider-specific:reference"]`, `[""]`, `[{}]`, `{"provider_reference":"123"}`, `[42]`, `[null]`} {
		t.Run(raw, func(t *testing.T) {
			require.True(t, HasJSONImageReferences(json.RawMessage(raw)))
			out, err := AdaptJSONImageReferences(json.RawMessage(raw), "https://api.goeasyapi.xyz")
			require.NoError(t, err)
			require.JSONEq(t, raw, string(out))
		})
	}
	for _, raw := range []string{"", "null", "[ ]"} {
		require.False(t, HasJSONImageReferences(json.RawMessage(raw)))
	}
}
