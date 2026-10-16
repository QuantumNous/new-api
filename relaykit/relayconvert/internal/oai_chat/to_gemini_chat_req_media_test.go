package oaichat

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/convmeta"
	relaymedia "github.com/QuantumNous/new-api/relaykit/relayconvert/internal/media"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestOpenAIChatRequestToGeminiFileMedia(t *testing.T) {
	relaymedia.SetMediaResolver(relaymedia.MediaResolver{
		GetBase64Data: func(c context.Context, source types.FileSource, reason ...string) (string, string, error) {
			t.Fatalf("unexpected download for %s", source.GetIdentifier())
			return "", "", nil
		},
		DecodeBase64FileData: func(base64String string) (string, string, error) {
			return "image/png", "aaa", nil
		},
	})

	videoMeta, err := json.Marshal(map[string]any{
		"start_offset": "66.5s",
		"end_offset":   "76.5s",
		"fps":          1,
	})
	require.NoError(t, err)

	info := &convmeta.Values{
		Options: &convmeta.Options{
			Gemini: convmeta.GeminiOptions{AllowRemoteFileURI: true},
		},
	}
	req := dto.GeneralOpenAIRequest{
		Model: "gemini-3-flash-preview",
		Messages: []dto.Message{
			{
				Role: "user",
				Content: []any{
					map[string]any{"type": "text", "text": "你会收到一段视频"},
					map[string]any{
						"type": "file",
						"file": map[string]any{
							"file_id":        "https://aitoken-public.qnaigc.com/example/generate-video/kling-video-o1-first-end-frame.mp4",
							"format":         "video/mp4",
							"detail":         "high",
							"video_metadata": json.RawMessage(videoMeta),
						},
					},
				},
			},
		},
	}

	got, err := OpenAIChatRequestToGeminiGenerateContent(context.Background(), req, info)
	require.NoError(t, err)
	require.Len(t, got.Contents, 1)
	require.Len(t, got.Contents[0].Parts, 2)
	assert.Equal(t, "你会收到一段视频", got.Contents[0].Parts[0].Text)

	filePart := got.Contents[0].Parts[1]
	require.NotNil(t, filePart.FileData)
	assert.Equal(t, "video/mp4", filePart.FileData.MimeType)
	assert.Equal(t, "https://aitoken-public.qnaigc.com/example/generate-video/kling-video-o1-first-end-frame.mp4", filePart.FileData.FileUri)
	assert.Nil(t, filePart.InlineData)

	var mediaResolution map[string]string
	require.NoError(t, json.Unmarshal(filePart.MediaResolution, &mediaResolution))
	assert.Equal(t, "MEDIA_RESOLUTION_HIGH", mediaResolution["level"])

	var metadata map[string]any
	require.NoError(t, json.Unmarshal(filePart.VideoMetadata, &metadata))
	assert.Equal(t, "66.5s", metadata["startOffset"])
	assert.Equal(t, "76.5s", metadata["endOffset"])
	assert.EqualValues(t, 1, metadata["fps"])
	_, hasSnake := metadata["start_offset"]
	assert.False(t, hasSnake)
}

func TestOpenAIChatRequestToGeminiFileMediaInfersMimeFromExtension(t *testing.T) {
	relaymedia.SetMediaResolver(relaymedia.MediaResolver{
		GetBase64Data: func(c context.Context, source types.FileSource, reason ...string) (string, string, error) {
			t.Fatalf("unexpected download for %s", source.GetIdentifier())
			return "", "", nil
		},
	})
	info := &convmeta.Values{
		Options: &convmeta.Options{
			Gemini: convmeta.GeminiOptions{AllowRemoteFileURI: true},
		},
	}
	req := dto.GeneralOpenAIRequest{
		Messages: []dto.Message{{
			Role: "user",
			Content: []any{
				map[string]any{
					"type": "file",
					"file": map[string]any{
						"file_id": "https://cdn.example.com/clip.mp4",
					},
				},
			},
		}},
	}
	got, err := OpenAIChatRequestToGeminiGenerateContent(context.Background(), req, info)
	require.NoError(t, err)
	require.NotNil(t, got.Contents[0].Parts[0].FileData)
	assert.Equal(t, "video/mp4", got.Contents[0].Parts[0].FileData.MimeType)
}

func TestOpenAIChatRequestToGeminiFileMediaGSURI(t *testing.T) {
	relaymedia.SetMediaResolver(relaymedia.MediaResolver{
		GetBase64Data: func(c context.Context, source types.FileSource, reason ...string) (string, string, error) {
			t.Fatalf("unexpected download for %s", source.GetIdentifier())
			return "", "", nil
		},
	})
	info := &convmeta.Values{
		Options: &convmeta.Options{
			Gemini: convmeta.GeminiOptions{AllowRemoteFileURI: false},
		},
	}
	req := dto.GeneralOpenAIRequest{
		Messages: []dto.Message{{
			Role: "user",
			Content: []any{
				map[string]any{
					"type": "file",
					"file": map[string]any{
						"file_id": "gs://bucket/video.mp4",
						"format":  "video/mp4",
					},
				},
			},
		}},
	}
	got, err := OpenAIChatRequestToGeminiGenerateContent(context.Background(), req, info)
	require.NoError(t, err)
	require.NotNil(t, got.Contents[0].Parts[0].FileData)
	assert.Equal(t, "gs://bucket/video.mp4", got.Contents[0].Parts[0].FileData.FileUri)
}

func TestOpenAIChatRequestToGeminiFileMediaInlineWhenRemoteURIDisabled(t *testing.T) {
	var downloaded string
	relaymedia.SetMediaResolver(relaymedia.MediaResolver{
		GetBase64Data: func(c context.Context, source types.FileSource, reason ...string) (string, string, error) {
			downloaded = source.GetIdentifier()
			return "YmFzZTY0", "video/mp4", nil
		},
	})
	info := &convmeta.Values{
		Options: &convmeta.Options{
			Gemini: convmeta.GeminiOptions{AllowRemoteFileURI: false},
		},
	}
	req := dto.GeneralOpenAIRequest{
		Messages: []dto.Message{{
			Role: "user",
			Content: []any{
				map[string]any{
					"type": "file",
					"file": map[string]any{
						"file_id": "https://cdn.example.com/clip.mp4",
						"format":  "video/mp4",
					},
				},
			},
		}},
	}
	got, err := OpenAIChatRequestToGeminiGenerateContent(context.Background(), req, info)
	require.NoError(t, err)
	assert.Equal(t, "https://cdn.example.com/clip.mp4", downloaded)
	require.NotNil(t, got.Contents[0].Parts[0].InlineData)
	assert.Equal(t, "video/mp4", got.Contents[0].Parts[0].InlineData.MimeType)
	assert.Equal(t, "YmFzZTY0", got.Contents[0].Parts[0].InlineData.Data)
	assert.Nil(t, got.Contents[0].Parts[0].FileData)
}

func TestOpenAIChatRequestToGeminiFileMediaRejectsOpenAIFilesID(t *testing.T) {
	info := &convmeta.Values{
		Options: &convmeta.Options{
			Gemini: convmeta.GeminiOptions{AllowRemoteFileURI: true},
		},
	}
	req := dto.GeneralOpenAIRequest{
		Messages: []dto.Message{{
			Role: "user",
			Content: []any{
				map[string]any{
					"type": "file",
					"file": map[string]any{"file_id": "file-6F2ksmvXxt4VdoqmHRw6kL"},
				},
			},
		}},
	}
	_, err := OpenAIChatRequestToGeminiGenerateContent(context.Background(), req, info)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "file_id")
	assert.Contains(t, err.Error(), "OpenAI Files API")
}

func TestOpenAIChatRequestToGeminiPrefersFileDataOverOpenAIFilesID(t *testing.T) {
	var downloaded string
	relaymedia.SetMediaResolver(relaymedia.MediaResolver{
		GetBase64Data: func(c context.Context, source types.FileSource, reason ...string) (string, string, error) {
			downloaded = source.GetIdentifier()
			return "cGRm", "application/pdf", nil
		},
	})
	info := &convmeta.Values{
		Options: &convmeta.Options{
			Gemini: convmeta.GeminiOptions{AllowRemoteFileURI: true},
		},
	}
	req := dto.GeneralOpenAIRequest{
		Messages: []dto.Message{{
			Role: "user",
			Content: []any{
				map[string]any{
					"type": "file",
					"file": map[string]any{
						"file_id":   "file-6F2ksmvXxt4VdoqmHRw6kL",
						"file_data": "data:application/pdf;base64,cGRm",
						"format":    "application/pdf",
					},
				},
			},
		}},
	}
	got, err := OpenAIChatRequestToGeminiGenerateContent(context.Background(), req, info)
	require.NoError(t, err)
	assert.NotContains(t, downloaded, "file-6F2ksmvXxt4VdoqmHRw6kL")
	assert.Contains(t, downloaded, "data:application/pdf;base64,cGRm")
	require.NotNil(t, got.Contents[0].Parts[0].InlineData)
	assert.Equal(t, "application/pdf", got.Contents[0].Parts[0].InlineData.MimeType)
	assert.Nil(t, got.Contents[0].Parts[0].FileData)
}

func TestOpenAIChatRequestToGeminiFileMediaRejectsEmptyFile(t *testing.T) {
	info := &convmeta.Values{Options: &convmeta.Options{}}
	req := dto.GeneralOpenAIRequest{
		Messages: []dto.Message{{
			Role: "user",
			Content: []any{
				map[string]any{
					"type": "file",
					"file": map[string]any{"filename": "a.mp4"},
				},
			},
		}},
	}
	got, err := OpenAIChatRequestToGeminiGenerateContent(context.Background(), req, info)
	require.NoError(t, err)
	// Empty file object is dropped at ParseContent; message with no parts is omitted.
	assert.Empty(t, got.Contents)
}

func TestOpenAIChatRequestToGeminiFileDataStillInlines(t *testing.T) {
	relaymedia.SetMediaResolver(relaymedia.MediaResolver{
		GetBase64Data: func(c context.Context, source types.FileSource, reason ...string) (string, string, error) {
			return "cGRm", "application/pdf", nil
		},
	})
	info := &convmeta.Values{Options: &convmeta.Options{}}
	req := dto.GeneralOpenAIRequest{
		Messages: []dto.Message{{
			Role: "user",
			Content: []any{
				map[string]any{
					"type": "file",
					"file": map[string]any{
						"filename":  "doc.pdf",
						"file_data": "data:application/pdf;base64,cGRm",
						"format":    "application/pdf",
					},
				},
			},
		}},
	}
	got, err := OpenAIChatRequestToGeminiGenerateContent(context.Background(), req, info)
	require.NoError(t, err)
	require.NotNil(t, got.Contents[0].Parts[0].InlineData)
	assert.Equal(t, "application/pdf", got.Contents[0].Parts[0].InlineData.MimeType)
}

func TestParseMessageFileMapKeepsVideoMetadata(t *testing.T) {
	raw := json.RawMessage(`{"start_offset":"1s","fps":2}`)
	mf := dto.ParseMessageFileMap(map[string]any{
		"file_id":        "https://example.com/a.mp4",
		"format":         "video/mp4",
		"detail":         "high",
		"mime_type":      "ignored-when-format-set",
		"video_metadata": raw,
	})
	require.NotNil(t, mf)
	assert.Equal(t, "https://example.com/a.mp4", mf.FileId)
	assert.Equal(t, "video/mp4", mf.Format)
	assert.Equal(t, "high", mf.Detail)
	assert.JSONEq(t, `{"start_offset":"1s","fps":2}`, string(mf.VideoMetadata))
}
