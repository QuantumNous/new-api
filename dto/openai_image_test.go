package dto

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestImageRequestPreservesProviderResolutionFields(t *testing.T) {
	raw := []byte(`{"model":"grok-imagine-image","prompt":"test","resolution":"2k","aspect_ratio":"16:9"}`)
	var request ImageRequest
	require.NoError(t, common.Unmarshal(raw, &request))
	require.Equal(t, "2k", request.Resolution)
	require.Equal(t, "16:9", request.AspectRatio)

	encoded, err := common.Marshal(request)
	require.NoError(t, err)
	require.JSONEq(t, string(raw), string(encoded))
}
