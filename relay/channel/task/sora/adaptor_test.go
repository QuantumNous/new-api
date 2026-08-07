package sora

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSoraBuildRequestBodyReturnsReplayablePassThroughBody(t *testing.T) {
	payload := []byte("opaque-sora-request-body")
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/videos", bytes.NewReader(payload))
	c.Request.Header.Set("Content-Type", "application/octet-stream")
	defer common.CleanupBodyStorage(c)

	info := &relaycommon.RelayInfo{}
	body, err := (&TaskAdaptor{}).BuildRequestBody(c, info)
	require.NoError(t, err)
	replayable, ok := body.(common.ReplayableBody)
	require.True(t, ok)

	sent, err := io.ReadAll(body)
	require.NoError(t, err)
	assert.Equal(t, payload, sent)
	assert.EqualValues(t, len(payload), replayable.Size())

	replayBody, err := replayable.NewReader()
	require.NoError(t, err)
	replay, err := io.ReadAll(replayBody)
	require.NoError(t, err)
	require.NoError(t, replayBody.Close())
	assert.Equal(t, payload, replay)
}

func TestBuildTaskFetchURLUsesAgnesStatusEndpointOnlyForAgnes(t *testing.T) {
	tests := []struct {
		name    string
		baseURL string
		want    string
	}{
		{
			name:    "Agnes",
			baseURL: "https://apihub.agnes-ai.com/v1",
			want:    "https://apihub.agnes-ai.com/agnesapi?video_id=task-123",
		},
		{
			name:    "other OpenAI-compatible provider",
			baseURL: "https://video.example.com",
			want:    "https://video.example.com/v1/videos/task-123",
		},
		{
			name:    "Agnes lookalike",
			baseURL: "https://apihub.agnes-ai.com.evil.example",
			want:    "https://apihub.agnes-ai.com.evil.example/v1/videos/task-123",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := buildTaskFetchURL(tt.baseURL, "task-123")
			require.NoError(t, err)
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestParseTaskResultUsesMetadataURLOnlyForAgnes(t *testing.T) {
	body := []byte(`{"id":"task-123","status":"completed","metadata":{"url":"https://cdn.agnes-ai.com/video.mp4"}}`)

	agnesResult, err := (&TaskAdaptor{baseURL: "https://apihub.agnes-ai.com"}).ParseTaskResult(body)
	require.NoError(t, err)
	assert.Equal(t, "https://cdn.agnes-ai.com/video.mp4", agnesResult.Url)

	otherResult, err := (&TaskAdaptor{baseURL: "https://video.example.com"}).ParseTaskResult(body)
	require.NoError(t, err)
	assert.Empty(t, otherResult.Url)
}
