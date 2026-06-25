package gemini

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestConvertGeminiRequestDownloadsFileDataURLToInlineData(t *testing.T) {
	oldLoader := geminiGetBase64Data
	defer func() { geminiGetBase64Data = oldLoader }()

	var loadedURL string
	geminiGetBase64Data = func(_ *gin.Context, source types.FileSource, _ ...string) (string, string, error) {
		loadedURL = source.GetRawData()
		return "aW1hZ2U=", "image/png", nil
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

	converted, err := (&Adaptor{}).ConvertGeminiRequest(nil, &relaycommon.RelayInfo{}, request)
	require.NoError(t, err)

	got, ok := converted.(*dto.GeminiChatRequest)
	require.True(t, ok)
	assert.Equal(t, "https://example.com/input.png", loadedURL)
	require.NotNil(t, got.Contents[0].Parts[0].InlineData)
	assert.Nil(t, got.Contents[0].Parts[0].FileData)
	assert.Equal(t, "image/png", got.Contents[0].Parts[0].InlineData.MimeType)
	assert.Equal(t, "aW1hZ2U=", got.Contents[0].Parts[0].InlineData.Data)
}

func TestConvertGeminiRequestKeepsYoutubeFileData(t *testing.T) {
	oldLoader := geminiGetBase64Data
	defer func() { geminiGetBase64Data = oldLoader }()

	geminiGetBase64Data = func(_ *gin.Context, _ types.FileSource, _ ...string) (string, string, error) {
		t.Fatal("YouTube fileData should not be downloaded")
		return "", "", nil
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

	converted, err := (&Adaptor{}).ConvertGeminiRequest(nil, &relaycommon.RelayInfo{}, request)
	require.NoError(t, err)

	got := converted.(*dto.GeminiChatRequest)
	require.NotNil(t, got.Contents[0].Parts[0].FileData)
	assert.Nil(t, got.Contents[0].Parts[0].InlineData)
	assert.Equal(t, "video/webm", got.Contents[0].Parts[0].FileData.MimeType)
}

func TestGeminiPartAcceptsFileDataSnakeCase(t *testing.T) {
	raw := []byte(`{
		"file_data": {
			"mime_type": "image/jpeg",
			"file_uri": "https://example.com/input.jpg"
		}
	}`)

	var part dto.GeminiPart
	require.NoError(t, common.Unmarshal(raw, &part))
	require.NotNil(t, part.FileData)
	assert.Equal(t, "image/jpeg", part.FileData.MimeType)
	assert.Equal(t, "https://example.com/input.jpg", part.FileData.FileUri)
}

func TestGeminiChatRequestKeepsInlineDataBase64(t *testing.T) {
	raw := []byte(`{
		"contents": [{
			"parts": [{
				"inline_data": {
					"mime_type": "image/png",
					"data": "aW1hZ2U="
				}
			}]
		}]
	}`)

	var req dto.GeminiChatRequest
	require.NoError(t, common.Unmarshal(raw, &req))
	require.Len(t, req.Contents, 1)
	require.Len(t, req.Contents[0].Parts, 1)
	require.NotNil(t, req.Contents[0].Parts[0].InlineData)
	assert.Equal(t, "image/png", req.Contents[0].Parts[0].InlineData.MimeType)
	assert.Equal(t, "aW1hZ2U=", req.Contents[0].Parts[0].InlineData.Data)
}
