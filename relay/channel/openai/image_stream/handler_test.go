package image_stream

import (
	"bytes"
	"context"
	"encoding/base64"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBuildImagesResponseRejectsUnsupportedImageMagic(t *testing.T) {
	t.Setenv("CLOUDFLARE_R2_ACCESS_KEY_ID", "")
	t.Setenv("CLOUDFLARE_R2_SECRET_ACCESS_KEY", "")

	invalidImage := base64.StdEncoding.EncodeToString(bytes.Repeat([]byte("not-image"), 16))
	_, err := buildImagesResponseWithStorage(context.Background(), &UpstreamResponse{
		Output: []UpstreamItem{{
			Type:   "image_generation_call",
			Result: invalidImage,
		}},
	}, &dto.ImageRequest{Prompt: "test"}, false)

	require.Error(t, err)
	assert.Contains(t, err.Error(), "unsupported magic bytes")
}

func TestBuildImagesResponseAcceptsSmallValidImage(t *testing.T) {
	t.Setenv("CLOUDFLARE_R2_ACCESS_KEY_ID", "")
	t.Setenv("CLOUDFLARE_R2_SECRET_ACCESS_KEY", "")

	image := []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n', 1}
	envelope, err := buildImagesResponseWithStorage(context.Background(), &UpstreamResponse{
		Output: []UpstreamItem{{
			Type:   "image_generation_call",
			Result: base64.StdEncoding.EncodeToString(image),
		}},
	}, &dto.ImageRequest{Prompt: "test", ResponseFormat: "b64_json"}, false)

	require.NoError(t, err)
	require.Len(t, envelope.Data, 1)
	assert.Equal(t, base64.StdEncoding.EncodeToString(image), envelope.Data[0].B64Json)
}
