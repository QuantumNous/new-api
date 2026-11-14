package dto

import (
	"testing"

	kitutil "github.com/QuantumNous/new-api/relaykit/relayconvert/kitutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

// Image generation providers such as xAI's grok-imagine take geometry hints
// (aspect_ratio/resolution) that no other provider shares. They only reach the
// upstream provider when declared on ImageRequest, because MarshalJSON
// deliberately does not re-marshal Extra.
func TestImageRequestKeepsGeometryFields(t *testing.T) {
	for _, tc := range []struct {
		name string
		body string
	}{
		{
			name: "geometry alongside a field only Extra knows",
			body: `{"model":"grok-imagine-image-2.0","prompt":"a lake","n":1,"aspect_ratio":"16:9","resolution":"2K","unknown_param":"x"}`,
		},
		{
			name: "geometry alone",
			body: `{"model":"grok-imagine-image-2.0","prompt":"a lake","aspect_ratio":"9:16","resolution":"1K"}`,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var request ImageRequest
			require.NoError(t, kitutil.Unmarshal([]byte(tc.body), &request))

			encoded, err := kitutil.Marshal(request)
			require.NoError(t, err)

			require.NotNil(t, request.AspectRatio)
			require.NotNil(t, request.Resolution)
			assert.Equal(t, *request.AspectRatio, gjson.GetBytes(encoded, "aspect_ratio").String())
			assert.Equal(t, *request.Resolution, gjson.GetBytes(encoded, "resolution").String())
			assert.False(t, gjson.GetBytes(encoded, "unknown_param").Exists(),
				"undeclared fields stay in Extra and are not re-marshaled")
		})
	}
}

// An absent hint must stay absent: an empty string would be sent upstream and
// rejected by providers that treat the parameter as a closed enum.
func TestImageRequestOmitsAbsentGeometryFields(t *testing.T) {
	var request ImageRequest
	require.NoError(t, kitutil.Unmarshal([]byte(`{"model":"gpt-image-1","prompt":"a lake"}`), &request))

	encoded, err := kitutil.Marshal(request)
	require.NoError(t, err)

	assert.Nil(t, request.AspectRatio)
	assert.Nil(t, request.Resolution)
	assert.False(t, gjson.GetBytes(encoded, "aspect_ratio").Exists())
	assert.False(t, gjson.GetBytes(encoded, "resolution").Exists())
}
