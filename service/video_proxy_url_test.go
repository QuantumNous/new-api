package service

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestIsDirectVideoMediaURL(t *testing.T) {
	t.Parallel()
	require.True(t, IsDirectVideoMediaURL("https://getapib.org/sora_official_video_abc.mp4"))
	require.True(t, IsDirectVideoMediaURL("https://cdn.example.com/out.webm"))
	require.False(t, IsDirectVideoMediaURL("https://api.apimart.ai/v1/videos/task_xxx/content"))
	require.False(t, IsDirectVideoMediaURL(""))
}
