package middleware

import (
	"bytes"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestOpenAIVideoMultipartRequestSurvivesDistributorParsing(t *testing.T) {
	gin.SetMode(gin.TestMode)

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	require.NoError(t, writer.WriteField("model", "seedance"))
	require.NoError(t, writer.WriteField("prompt", "A sunset over the sea"))
	require.NoError(t, writer.WriteField("seconds", "8"))
	require.NoError(t, writer.WriteField("size", "16:9"))
	require.NoError(t, writer.WriteField("resolution", "720P"))
	require.NoError(t, writer.Close())

	req := httptest.NewRequest(http.MethodPost, "/v1/videos", &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = req

	modelReq, selectChannel, err := getModelRequest(ctx)
	require.NoError(t, err)
	require.True(t, selectChannel)
	require.Equal(t, "seedance", modelReq.Model)

	info := &relaycommon.RelayInfo{TaskRelayInfo: &relaycommon.TaskRelayInfo{}}
	taskErr := relaycommon.ValidateBasicTaskRequest(ctx, info, constant.TaskActionTextGenerate)
	require.Nil(t, taskErr)

	taskReq, err := relaycommon.GetTaskRequest(ctx)
	require.NoError(t, err)
	require.Equal(t, "seedance", taskReq.Model)
	require.Equal(t, "A sunset over the sea", taskReq.Prompt)
	require.Equal(t, "8", taskReq.Seconds)
	require.Equal(t, "16:9", taskReq.Size)
	require.Equal(t, "720P", taskReq.Metadata["resolution"])
}
