package omni

import (
	"bytes"
	"encoding/base64"
	"encoding/binary"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/textproto"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func testMP4(durationMilliseconds uint32) []byte {
	writeBox := func(boxType string, payload []byte) []byte {
		box := make([]byte, 8+len(payload))
		binary.BigEndian.PutUint32(box[:4], uint32(len(box)))
		copy(box[4:8], boxType)
		copy(box[8:], payload)
		return box
	}

	ftyp := make([]byte, 16)
	copy(ftyp[:4], "isom")
	copy(ftyp[8:12], "isom")
	copy(ftyp[12:16], "mp42")
	mvhd := make([]byte, 100)
	binary.BigEndian.PutUint32(mvhd[12:16], 1000)
	binary.BigEndian.PutUint32(mvhd[16:20], durationMilliseconds)
	binary.BigEndian.PutUint32(mvhd[20:24], 0x00010000)
	binary.BigEndian.PutUint16(mvhd[24:26], 0x0100)
	binary.BigEndian.PutUint32(mvhd[36:40], 0x00010000)
	binary.BigEndian.PutUint32(mvhd[52:56], 0x00010000)
	binary.BigEndian.PutUint32(mvhd[68:72], 0x40000000)
	binary.BigEndian.PutUint32(mvhd[96:100], 1)

	return bytes.Join([][]byte{
		writeBox("ftyp", ftyp),
		writeBox("moov", writeBox("mvhd", mvhd)),
	}, nil)
}

func newTaskContext(t *testing.T, req relaycommon.TaskSubmitReq) *gin.Context {
	t.Helper()
	gin.SetMode(gin.TestMode)
	context, _ := gin.CreateTestContext(httptest.NewRecorder())
	context.Request = httptest.NewRequest("POST", "/v1/videos", nil)
	context.Set("task_request", req)
	return context
}

func TestBuildRequestBodyIncludesPromptReferenceImagesAndAsyncState(t *testing.T) {
	imageOne := base64.StdEncoding.EncodeToString([]byte("image-one"))
	imageTwo := base64.StdEncoding.EncodeToString([]byte("image-two"))
	req := relaycommon.TaskSubmitReq{
		Prompt:   "A product rotates on a pedestal.",
		Images:   []string{"data:image/png;base64," + imageOne, "data:image/jpeg;base64," + imageTwo},
		Duration: 5,
		Size:     "720x1280",
		Metadata: map[string]any{"previous_interaction_id": "interaction_previous"},
	}
	context := newTaskContext(t, req)
	info := &relaycommon.RelayInfo{
		ChannelMeta:   &relaycommon.ChannelMeta{UpstreamModelName: ModelGeminiOmniFlashPreview},
		TaskRelayInfo: &relaycommon.TaskRelayInfo{},
	}

	body, err := BuildRequestBody(context, info)
	require.NoError(t, err)
	raw, err := io.ReadAll(body)
	require.NoError(t, err)
	var request interactionRequest
	require.NoError(t, common.Unmarshal(raw, &request))

	assert.Equal(t, ModelGeminiOmniFlashPreview, request.Model)
	assert.True(t, request.Background)
	assert.True(t, request.Store)
	require.NotNil(t, request.PreviousInteractionID)
	assert.Equal(t, "interaction_previous", *request.PreviousInteractionID)
	require.NotNil(t, request.ResponseFormat.AspectRatio)
	assert.Equal(t, "9:16", *request.ResponseFormat.AspectRatio)
	require.NotNil(t, request.ResponseFormat.Duration)
	assert.Equal(t, "5s", *request.ResponseFormat.Duration)
	require.Len(t, request.Input, 3)
	assert.Contains(t, request.Input[0].Text, "Generate exactly a 5-second video.")
	assert.Equal(t, inputPart{Type: "image", MimeType: "image/png", Data: imageOne}, request.Input[1])
	assert.Equal(t, inputPart{Type: "image", MimeType: "image/jpeg", Data: imageTwo}, request.Input[2])
	assert.Equal(t, constant.TaskActionGenerate, info.Action)
}

func TestBuildRequestBodyUsesNestedUserInputForReferenceVideo(t *testing.T) {
	videoData := base64.StdEncoding.EncodeToString(testMP4(3000))
	imageData := base64.StdEncoding.EncodeToString([]byte("image"))
	req := relaycommon.TaskSubmitReq{
		Prompt:   "Change the sphere to green. Keep everything else the same.",
		Video:    "data:video/mp4;base64," + videoData,
		Images:   []string{"data:image/png;base64," + imageData},
		Duration: 3,
	}
	context := newTaskContext(t, req)
	info := &relaycommon.RelayInfo{
		ChannelMeta:   &relaycommon.ChannelMeta{UpstreamModelName: ModelGeminiOmniFlashPreview},
		TaskRelayInfo: &relaycommon.TaskRelayInfo{},
	}

	require.NoError(t, ValidateRequest(context, info))
	body, err := BuildRequestBody(context, info)
	require.NoError(t, err)
	raw, err := io.ReadAll(body)
	require.NoError(t, err)
	var request interactionRequest
	require.NoError(t, common.Unmarshal(raw, &request))

	require.Len(t, request.Input, 1)
	assert.Equal(t, "user_input", request.Input[0].Type)
	require.Len(t, request.Input[0].Content, 3)
	assert.Equal(t, inputPart{Type: "video", MimeType: "video/mp4", Data: videoData}, request.Input[0].Content[0])
	assert.Equal(t, "image", request.Input[0].Content[1].Type)
	assert.Contains(t, request.Input[0].Content[2].Text, "Change the sphere to green")
	assert.Equal(t, constant.TaskActionGenerate, info.Action)
}

func TestValidateReferenceVideoDurationBeforeSubmission(t *testing.T) {
	tests := []struct {
		name    string
		videos  []string
		wantErr string
	}{
		{
			name:   "exactly ten seconds is accepted",
			videos: []string{"data:video/mp4;base64," + base64.StdEncoding.EncodeToString(testMP4(10000))},
		},
		{
			name:    "thirty seconds is rejected",
			videos:  []string{"data:video/mp4;base64," + base64.StdEncoding.EncodeToString(testMP4(30000))},
			wantErr: "reference video duration 30.000 seconds exceeds the 10-second maximum",
		},
		{
			name: "multiple videos are rejected",
			videos: []string{
				"data:video/mp4;base64," + base64.StdEncoding.EncodeToString(testMP4(3000)),
				"data:video/mp4;base64," + base64.StdEncoding.EncodeToString(testMP4(3000)),
			},
			wantErr: "videos must contain at most 1 item",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			context := newTaskContext(t, relaycommon.TaskSubmitReq{Prompt: "edit", Videos: tt.videos, Duration: 3})
			err := ValidateRequest(context, &relaycommon.RelayInfo{TaskRelayInfo: &relaycommon.TaskRelayInfo{}})
			if tt.wantErr == "" {
				require.NoError(t, err)
				return
			}
			require.Error(t, err)
			assert.Contains(t, err.Error(), tt.wantErr)
		})
	}
}

func TestValidateMultipartReferenceVideoDurationBeforeSubmission(t *testing.T) {
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	header := make(textproto.MIMEHeader)
	header.Set("Content-Disposition", `form-data; name="video"; filename="reference.mp4"`)
	header.Set("Content-Type", "video/mp4")
	part, err := writer.CreatePart(header)
	require.NoError(t, err)
	_, err = part.Write(testMP4(30000))
	require.NoError(t, err)
	require.NoError(t, writer.Close())

	request := httptest.NewRequest(http.MethodPost, "/v1/videos", &body)
	request.Header.Set("Content-Type", writer.FormDataContentType())
	context, _ := gin.CreateTestContext(httptest.NewRecorder())
	context.Request = request
	context.Set("task_request", relaycommon.TaskSubmitReq{Prompt: "edit", Duration: 3})

	err = ValidateRequest(context, &relaycommon.RelayInfo{TaskRelayInfo: &relaycommon.TaskRelayInfo{}})

	require.Error(t, err)
	assert.Contains(t, err.Error(), "reference video duration 30.000 seconds exceeds the 10-second maximum")
}

func TestValidateRequestEnforcesOmniBounds(t *testing.T) {
	tests := []struct {
		name    string
		req     relaycommon.TaskSubmitReq
		wantErr string
	}{
		{
			name:    "duration below minimum",
			req:     relaycommon.TaskSubmitReq{Prompt: "test", Duration: 2},
			wantErr: "duration must be between 3 and 10 seconds",
		},
		{
			name:    "duration above maximum",
			req:     relaycommon.TaskSubmitReq{Prompt: "test", Duration: 11},
			wantErr: "duration must be between 3 and 10 seconds",
		},
		{
			name:    "unsupported aspect ratio",
			req:     relaycommon.TaskSubmitReq{Prompt: "test", Duration: 3, Metadata: map[string]any{"aspect_ratio": "1:1"}},
			wantErr: "aspect_ratio must be 16:9 or 9:16",
		},
		{
			name:    "too many images",
			req:     relaycommon.TaskSubmitReq{Prompt: "test", Duration: 3, Images: make([]string, MaxImages+1)},
			wantErr: "images must contain at most 10 items",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			context := newTaskContext(t, tt.req)
			err := ValidateRequest(context, &relaycommon.RelayInfo{TaskRelayInfo: &relaycommon.TaskRelayInfo{}})
			require.Error(t, err)
			assert.Contains(t, err.Error(), tt.wantErr)
		})
	}
}

func TestParseInteractionLifecycle(t *testing.T) {
	upstreamName, err := ParseSubmitResponse([]byte(`{"id":"interaction_123","status":"in_progress","model":"gemini-omni-flash-preview"}`))
	require.NoError(t, err)
	assert.Equal(t, "interactions/interaction_123", upstreamName)

	inProgress, err := ParseTaskResult([]byte(`{"id":"interaction_123","status":"in_progress"}`))
	require.NoError(t, err)
	assert.Equal(t, string(model.TaskStatusInProgress), inProgress.Status)

	completed, err := ParseTaskResult([]byte(`{
		"id":"interaction_123",
		"status":"completed",
		"steps":[{"type":"model_output","content":[{"type":"video","mime_type":"video/mp4","data":"dmlkZW8="}]}],
		"usage":{"total_tokens":17682,"total_output_tokens":17376}
	}`))
	require.NoError(t, err)
	assert.Equal(t, string(model.TaskStatusSuccess), completed.Status)
	assert.Equal(t, "data:video/mp4;base64,dmlkZW8=", completed.Url)
	assert.Equal(t, 17682, completed.TotalTokens)
	assert.Equal(t, 17376, completed.CompletionTokens)
}

func TestParseCompletedInteractionWithoutVideoFails(t *testing.T) {
	result, err := ParseTaskResult([]byte(`{"id":"interaction_123","status":"completed","steps":[]}`))
	require.NoError(t, err)
	assert.Equal(t, string(model.TaskStatusFailure), result.Status)
	assert.Contains(t, result.Reason, "did not contain video")
}

func TestParseInteractionChecksOutputsWhenStepsArePresent(t *testing.T) {
	result, err := ParseTaskResult([]byte(`{
		"id":"interaction_123",
		"status":"completed",
		"steps":[{"type":"thought","content":[]}],
		"outputs":[{"type":"model_output","content":[{"type":"video","mime_type":"video/mp4","data":"dmlkZW8="}]}]
	}`))

	require.NoError(t, err)
	assert.Equal(t, string(model.TaskStatusSuccess), result.Status)
	assert.Equal(t, "data:video/mp4;base64,dmlkZW8=", result.Url)
}
