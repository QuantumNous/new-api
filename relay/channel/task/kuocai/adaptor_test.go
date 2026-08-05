package kuocai

import (
	"testing"

	commonapi "github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/stretchr/testify/require"
)

func TestKuocaiChannelUsesOpenAIAPIType(t *testing.T) {
	apiType, ok := commonapi.ChannelType2APIType(constant.ChannelTypeKuocai)
	require.True(t, ok)
	require.Equal(t, constant.APITypeOpenAI, apiType)
}

func TestConvertRequestUsesUpstreamModelName(t *testing.T) {
	body, err := convertRequest(relaycommon.TaskSubmitReq{
		Prompt:   "A sunset over the sea",
		Size:     "16:9",
		Duration: 8,
		Metadata: map[string]interface{}{"resolution": "720P", "count": 2},
	}, "seedance_fast")
	require.NoError(t, err)
	require.Equal(t, 51, body.ModelID)
	require.Equal(t, 8, body.Seconds)
	require.Equal(t, 2, body.Count)
	require.Equal(t, "720P", body.Resolution)
}

func TestConvertRequestUsesOpenAIVideoSeconds(t *testing.T) {
	body, err := convertRequest(relaycommon.TaskSubmitReq{
		Prompt:  "A sunset over the sea",
		Seconds: "10",
	}, "seedance")
	require.NoError(t, err)
	require.Equal(t, 10, body.Seconds)
}

func TestConvertRequestUsesKuocaiDocumentCountAndReferences(t *testing.T) {
	var request relaycommon.TaskSubmitReq
	err := commonapi.Unmarshal([]byte(`{
		"model":"seedance",
		"prompt":"A sunset over the sea",
		"seconds":8,
		"count":2,
		"resolution":"720P",
		"reference_images":["https://cdn.example/one.jpg","https://cdn.example/two.jpg"]
	}`), &request)
	require.NoError(t, err)

	body, err := convertRequest(request, "seedance")
	require.NoError(t, err)
	require.Equal(t, 2, body.Count)
	require.Equal(t, "720P", body.Resolution)
	require.Equal(t, []string{"https://cdn.example/one.jpg", "https://cdn.example/two.jpg"}, body.ReferenceImages)
}

func TestConvertRequestSupportsNumericModelIDForExistingChannels(t *testing.T) {
	body, err := convertRequest(relaycommon.TaskSubmitReq{Prompt: "test"}, "51")
	require.NoError(t, err)
	require.Equal(t, 51, body.ModelID)
}

func TestConvertRequestRejectsUnknownUpstreamModelName(t *testing.T) {
	_, err := convertRequest(relaycommon.TaskSubmitReq{Prompt: "test"}, "unknown_model")
	require.ErrorContains(t, err, "unsupported Kuocai model")
}

func TestParseTaskResultSupportsKuocaiClientResponseShape(t *testing.T) {
	adaptor := &TaskAdaptor{}
	result, err := adaptor.ParseTaskResult([]byte(`{"data":{"status_name":"已完成","result":{"video_url":"https://cdn.example/video.mp4"},"progress":100}}`))
	require.NoError(t, err)
	require.Equal(t, "SUCCESS", result.Status)
	require.Equal(t, "https://cdn.example/video.mp4", result.Url)
	require.Equal(t, "100%", result.Progress)
}
