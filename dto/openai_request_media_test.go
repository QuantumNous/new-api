package dto

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestMessageParseContentVideoURLObject(t *testing.T) {
	var message Message
	err := common.Unmarshal([]byte(`{
		"role":"user",
		"content":[
			{"type":"text","text":"describe this clip"},
			{"type":"video_url","video_url":{"url":"data:video/mp4;base64,AA=="}}
		]
	}`), &message)
	require.NoError(t, err)

	content := message.ParseContent()
	require.Len(t, content, 2)
	require.Equal(t, ContentTypeText, content[0].Type)
	require.Equal(t, "describe this clip", content[0].Text)
	require.Equal(t, ContentTypeVideoUrl, content[1].Type)

	video := content[1].GetVideoUrl()
	require.NotNil(t, video)
	require.Equal(t, "data:video/mp4;base64,AA==", video.Url)
}

func TestMessageParseContentVideoURLStringCompatibility(t *testing.T) {
	var message Message
	err := common.Unmarshal([]byte(`{
		"role":"user",
		"content":[{"type":"video_url","video_url":"https://cdn.example.com/input.mp4"}]
	}`), &message)
	require.NoError(t, err)

	content := message.ParseContent()
	require.Len(t, content, 1)
	require.Equal(t, ContentTypeVideoUrl, content[0].Type)
	require.Equal(t, "https://cdn.example.com/input.mp4", content[0].GetVideoUrl().Url)
}
