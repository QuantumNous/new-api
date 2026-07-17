package ali

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestOAIImage2AliImageRequestRejectsInvalidParametersN(t *testing.T) {
	t.Parallel()

	wantError := fmt.Sprintf("parameters.n must be an integer between 1 and %d", dto.MaxImageN)
	tests := []struct {
		name string
		n    string
	}{
		{name: "zero", n: "0"},
		{name: "negative", n: "-1"},
		{name: "above maximum", n: fmt.Sprintf("%d", dto.MaxImageN+1)},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			request := dto.ImageRequest{
				Model:  "wan2.6-t2i",
				Prompt: "a lighthouse",
				Extra: map[string]json.RawMessage{
					"parameters": json.RawMessage(fmt.Sprintf(`{"n":%s}`, tt.n)),
				},
			}

			_, err := oaiImage2AliImageRequest(&relaycommon.RelayInfo{}, request, false)

			require.Error(t, err)
			require.Contains(t, err.Error(), wantError)
		})
	}
}

func TestOAIImage2AliImageRequestAllowsParametersWithoutN(t *testing.T) {
	t.Parallel()

	request := dto.ImageRequest{
		Model:  "wan2.6-t2i",
		Prompt: "a lighthouse",
		Extra: map[string]json.RawMessage{
			"parameters": json.RawMessage(`{"size":"1024*1024"}`),
		},
	}

	converted, err := oaiImage2AliImageRequest(&relaycommon.RelayInfo{}, request, false)
	require.NoError(t, err)
	require.Equal(t, "1024*1024", converted.Parameters.Size)
}

func TestAdaptorInitRestoresPreparedSyncImageMode(t *testing.T) {
	adaptor := &Adaptor{}
	adaptor.Init(&relaycommon.RelayInfo{
		RelayMode:       relayconstant.RelayModeImagesGenerations,
		OriginModelName: "z-image-turbo",
	})
	assert.True(t, adaptor.IsSyncImageModel)
}

func TestAsyncTaskWaitStopsWhenWorkerContextIsCanceled(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil).WithContext(ctx)

	_, _, err := asyncTaskWait(c, &relaycommon.RelayInfo{}, "task-id")
	require.ErrorIs(t, err, context.Canceled)
}
