package ratio_setting

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestRealtimeModalityCacheRatios(t *testing.T) {
	const model = "gpt-realtime-2.1"
	InitRatioSettings()

	modelRatio, ok, _ := GetModelRatio(model)
	require.True(t, ok)
	require.Equal(t, 2.0, modelRatio)
	require.Equal(t, 6.0, GetCompletionRatio(model))
	require.Equal(t, 8.0, GetAudioRatio(model))
	require.Equal(t, 2.0, GetAudioCompletionRatio(model))

	textCacheRatio, ok := GetCacheRatio(model)
	require.True(t, ok)
	audioCacheRatio, ok := GetAudioCacheRatio(model)
	require.True(t, ok)
	imageCacheRatio, ok := GetImageCacheRatio(model)
	require.True(t, ok)
	require.Equal(t, 0.1, textCacheRatio)
	require.Equal(t, 0.1, audioCacheRatio)
	require.Equal(t, 0.125, imageCacheRatio)
}
