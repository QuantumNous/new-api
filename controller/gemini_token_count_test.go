package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNormalizeGeminiTokenCountMetaResolvesFileDataMimeType(t *testing.T) {
	oldLoader := geminiLoadFileSource
	defer func() { geminiLoadFileSource = oldLoader }()

	called := false
	geminiLoadFileSource = func(_ *gin.Context, _ types.FileSource, _ ...string) (*types.CachedFileData, error) {
		called = true
		return types.NewMemoryCachedData("aW1hZ2U=", "image/png", 0), nil
	}

	request := &dto.GeminiChatRequest{
		Contents: []dto.GeminiChatContent{
			{
				Parts: []dto.GeminiPart{
					{
						FileData: &dto.GeminiFileData{
							FileUri: "https://example.com/input.png",
						},
					},
				},
			},
		},
	}

	meta := request.GetTokenCountMeta()
	require.Len(t, meta.Files, 1)
	assert.Equal(t, types.FileTypeFile, meta.Files[0].FileType)

	require.NoError(t, normalizeGeminiTokenCountMeta(nil, request, meta))
	require.True(t, called)
	assert.Equal(t, types.FileTypeImage, meta.Files[0].FileType)
}

func TestNormalizeGeminiTokenCountMetaKeepsYoutubeFileData(t *testing.T) {
	oldLoader := geminiLoadFileSource
	defer func() { geminiLoadFileSource = oldLoader }()

	geminiLoadFileSource = func(_ *gin.Context, _ types.FileSource, _ ...string) (*types.CachedFileData, error) {
		t.Fatal("YouTube fileData should not be downloaded")
		return nil, nil
	}

	request := &dto.GeminiChatRequest{
		Contents: []dto.GeminiChatContent{
			{
				Parts: []dto.GeminiPart{
					{
						FileData: &dto.GeminiFileData{
							FileUri: "https://www.youtube.com/watch?v=video",
						},
					},
				},
			},
		},
	}

	meta := request.GetTokenCountMeta()
	require.Len(t, meta.Files, 1)

	require.NoError(t, normalizeGeminiTokenCountMeta(nil, request, meta))
	assert.Equal(t, types.FileTypeVideo, meta.Files[0].FileType)
}
