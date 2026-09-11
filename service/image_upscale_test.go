package service

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"testing"
)

func TestPrepareUpscaleUsesOneKAndPreservesAspectRatio(t *testing.T) {
	for _, test := range []struct{ size, want string }{{"", "1024x1024"}, {"4096x2304", "1024x576"}, {"1536x2048", "768x1024"}, {"auto", "1024x1024"}} {
		req := &dto.ImageRequest{Size: test.size, Prompt: "unchanged", Quality: "high", N: common.GetPointer(uint(1))}
		require.NoError(t, PrepareImageUpscaleRequest(req))
		assert.Equal(t, test.want, req.Size)
		assert.Equal(t, "unchanged", req.Prompt)
		assert.Equal(t, "high", req.Quality)
	}
	for _, req := range []*dto.ImageRequest{{Size: "0x1024"}, {Size: "999999999999x1"}, {Size: "8192x1"}, {Stream: common.GetPointer(true)}, {N: common.GetPointer(uint(2))}, {OutputFormat: []byte(`"jpeg"`)}, {Background: []byte(`"transparent"`)}} {
		assert.Error(t, PrepareImageUpscaleRequest(req))
	}
	assert.Equal(t, 0, ImageUpscaleTarget("gpt-image-2.5"))
	assert.Equal(t, 2048, ImageUpscaleTarget("gpt-image-2.5-2k"))
	assert.Equal(t, 4096, ImageUpscaleTarget("gpt-image-2.5-4k"))
}
