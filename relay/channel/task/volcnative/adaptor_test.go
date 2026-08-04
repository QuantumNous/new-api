package volcnative

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestTaskAdaptorDoResponsePreservesNativeFieldsAndHidesUpstreamID(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)

	raw := []byte(`{"id":"upstream-task-id","status":"queued","model":"doubao-seedance-2-0-260128","stream":false,"sequential_image_generation":true,"watermark":false}`)
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"application/json"}},
		Body:       io.NopCloser(bytes.NewReader(raw)),
	}
	info := &relaycommon.RelayInfo{TaskRelayInfo: &relaycommon.TaskRelayInfo{PublicTaskID: "task_public_id"}}

	upstreamID, storedBody, taskErr := (&TaskAdaptor{}).DoResponse(ctx, resp, info)

	require.Nil(t, taskErr)
	require.Equal(t, "upstream-task-id", upstreamID)
	require.Equal(t, raw, storedBody)
	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Body.String(), `"id":"task_public_id"`)
	require.NotContains(t, recorder.Body.String(), "upstream-task-id")
	require.Contains(t, recorder.Body.String(), `"stream":false`)
	require.Contains(t, recorder.Body.String(), `"sequential_image_generation":true`)
	require.Contains(t, recorder.Body.String(), `"watermark":false`)
}
