package replicate

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDoResponsePollsPendingPrediction(t *testing.T) {
	gin.SetMode(gin.TestMode)

	var pollCount atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		pollCount.Add(1)
		assert.Equal(t, "/v1/predictions/prediction-1", r.URL.Path)
		assert.Equal(t, "Bearer replicate-token", r.Header.Get("Authorization"))
		w.Header().Set("Content-Type", "application/json")
		_, err := io.WriteString(w, `{"id":"prediction-1","status":"succeeded","output":["https://example.com/one.png","https://example.com/two.png"],"error":null}`)
		assert.NoError(t, err)
	}))
	defer server.Close()

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequestWithContext(context.Background(), http.MethodPost, "/v1/images/generations", nil)
	info := &relaycommon.RelayInfo{
		Request: &dto.ImageRequest{ResponseFormat: "url"},
		ChannelMeta: &relaycommon.ChannelMeta{
			ApiKey:         "replicate-token",
			ChannelBaseUrl: server.URL,
			ChannelType:    constant.ChannelTypeReplicate,
		},
	}
	resp := &http.Response{
		StatusCode: http.StatusAccepted,
		Body: io.NopCloser(bytes.NewBufferString(
			`{"id":"prediction-1","status":"processing","output":["https://example.com/partial.png"],"error":null}`,
		)),
	}

	usage, newAPIError := (&Adaptor{}).DoResponse(c, resp, info)
	require.Nil(t, newAPIError)
	require.NotNil(t, usage)
	assert.Equal(t, int32(1), pollCount.Load())

	var imageResponse dto.ImageResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &imageResponse))
	require.Len(t, imageResponse.Data, 2)
	assert.Equal(t, "https://example.com/one.png", imageResponse.Data[0].Url)
	assert.Equal(t, "https://example.com/two.png", imageResponse.Data[1].Url)
}

func TestWaitForPredictionDoesNotReuseOmittedPollingFields(t *testing.T) {
	gin.SetMode(gin.TestMode)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, err := io.WriteString(w, `{"id":"prediction-1","status":"succeeded","error":null}`)
		assert.NoError(t, err)
	}))
	defer server.Close()

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequestWithContext(context.Background(), http.MethodPost, "/v1/images/generations", nil)
	prediction, err := waitForPrediction(c, replicatePollingInfo(server.URL), PredictionResponse{
		ID:     "prediction-1",
		Status: "processing",
		Output: []any{"https://example.com/partial.png"},
	})

	require.NoError(t, err)
	assert.Empty(t, predictionOutputURLs(prediction.Output))
}

func TestWaitForPredictionRetriesTransientStatus(t *testing.T) {
	gin.SetMode(gin.TestMode)

	var pollCount atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if pollCount.Add(1) == 1 {
			w.WriteHeader(http.StatusServiceUnavailable)
			_, err := io.WriteString(w, `{"detail":"temporarily unavailable"}`)
			assert.NoError(t, err)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, err := io.WriteString(w, `{"id":"prediction-1","status":"succeeded","output":"https://example.com/final.png","error":null}`)
		assert.NoError(t, err)
	}))
	defer server.Close()

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequestWithContext(context.Background(), http.MethodPost, "/v1/images/generations", nil)
	prediction, err := waitForPrediction(c, replicatePollingInfo(server.URL), PredictionResponse{
		ID:     "prediction-1",
		Status: "processing",
	})

	require.NoError(t, err)
	assert.Equal(t, int32(2), pollCount.Load())
	assert.Equal(t, []string{"https://example.com/final.png"}, predictionOutputURLs(prediction.Output))
}

func TestWaitForPredictionReturnsPollingFailures(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name       string
		statusCode int
		body       string
		wantErr    string
	}{
		{
			name:       "non-retryable status",
			statusCode: http.StatusBadRequest,
			body:       `{"detail":"invalid prediction"}`,
			wantErr:    "polling failed with status 400",
		},
		{
			name:       "failed prediction",
			statusCode: http.StatusOK,
			body:       `{"id":"prediction-1","status":"failed","error":{"message":"model execution failed"}}`,
			wantErr:    "model execution failed",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(tt.statusCode)
				_, err := io.WriteString(w, tt.body)
				assert.NoError(t, err)
			}))
			defer server.Close()

			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequestWithContext(context.Background(), http.MethodPost, "/v1/images/generations", nil)
			_, err := waitForPrediction(c, replicatePollingInfo(server.URL), PredictionResponse{
				ID:     "prediction-1",
				Status: "processing",
			})

			require.ErrorContains(t, err, tt.wantErr)
		})
	}
}

func TestEvaluatePredictionReturnsProviderErrors(t *testing.T) {
	tests := []struct {
		name     string
		errorRaw string
		wantErr  string
	}{
		{name: "string error", errorRaw: `"model execution failed"`, wantErr: "model execution failed"},
		{name: "object error", errorRaw: `{"detail":"content rejected"}`, wantErr: "content rejected"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			done, err := evaluatePrediction(PredictionResponse{
				Status: "failed",
				Error:  []byte(tt.errorRaw),
			})

			assert.False(t, done)
			require.EqualError(t, err, tt.wantErr)
		})
	}
}

func TestWaitForPredictionRejectsPendingResponseWithoutID(t *testing.T) {
	_, err := waitForPrediction(nil, &relaycommon.RelayInfo{}, PredictionResponse{Status: "processing"})
	require.EqualError(t, err, "replicate adaptor: pending prediction is missing id")
}

func replicatePollingInfo(baseURL string) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ApiKey:         "replicate-token",
			ChannelBaseUrl: baseURL,
			ChannelType:    constant.ChannelTypeReplicate,
		},
	}
}
