package replicate

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestMain(m *testing.M) {
	gin.SetMode(gin.TestMode)
	service.InitHttpClient()
	os.Exit(m.Run())
}

func TestConvertImageRequestRejectsInvalidNumOutputsOverrides(t *testing.T) {
	t.Parallel()

	wantError := fmt.Sprintf("input.num_outputs must be an integer between 1 and %d", dto.MaxImageN)
	tests := []struct {
		name        string
		extraFields json.RawMessage
		extra       map[string]json.RawMessage
	}{
		{
			name:        "extra_fields zero",
			extraFields: json.RawMessage(`{"num_outputs":0}`),
		},
		{
			name: "direct extra negative",
			extra: map[string]json.RawMessage{
				"num_outputs": json.RawMessage(`-1`),
			},
		},
		{
			name: "nested input above maximum",
			extra: map[string]json.RawMessage{
				"input": json.RawMessage(fmt.Sprintf(`{"num_outputs":%d}`, dto.MaxImageN+1)),
			},
		},
		{
			name: "nested input fractional",
			extra: map[string]json.RawMessage{
				"input": json.RawMessage(`{"num_outputs":1.5}`),
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			n := uint(1)
			request := dto.ImageRequest{
				Model:       ModelFlux11Pro,
				Prompt:      "a lighthouse",
				N:           &n,
				ExtraFields: tt.extraFields,
				Extra:       tt.extra,
			}
			info := &relaycommon.RelayInfo{
				RelayMode: relayconstant.RelayModeImagesGenerations,
				ChannelMeta: &relaycommon.ChannelMeta{
					UpstreamModelName: ModelFlux11Pro,
				},
			}

			_, err := (&Adaptor{}).ConvertImageRequest(
				gin.CreateTestContextOnly(httptest.NewRecorder(), gin.New()),
				info,
				request,
			)

			require.Error(t, err)
			require.Contains(t, err.Error(), wantError)
		})
	}
}

func TestConvertImageRequestAcceptsMaximumNestedNumOutputs(t *testing.T) {
	t.Parallel()

	request := dto.ImageRequest{
		Model:  ModelFlux11Pro,
		Prompt: "a lighthouse",
		Extra: map[string]json.RawMessage{
			"input": json.RawMessage(fmt.Sprintf(`{"num_outputs":%d}`, dto.MaxImageN)),
		},
	}
	info := &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeImagesGenerations,
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: ModelFlux11Pro,
		},
	}

	converted, err := (&Adaptor{}).ConvertImageRequest(
		gin.CreateTestContextOnly(httptest.NewRecorder(), gin.New()),
		info,
		request,
	)
	require.NoError(t, err)

	payload, ok := converted.(map[string]any)
	require.True(t, ok)
	input, ok := payload["input"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, float64(dto.MaxImageN), input["num_outputs"])
}

func TestDoResponsePollsStartingPrediction(t *testing.T) {
	t.Parallel()

	var pollCalls atomic.Int32
	var pollAuthorization atomic.Value
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		pollCalls.Add(1)
		pollAuthorization.Store(r.Header.Get("Authorization"))
		require.Equal(t, "/v1/predictions/pred-1", r.URL.Path)
		w.Header().Set("Content-Type", "application/json")
		_, err := io.WriteString(w, `{"id":"pred-1","status":"succeeded","output":"https://cdn.example.com/result.png"}`)
		require.NoError(t, err)
	}))
	t.Cleanup(server.Close)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)
	info := replicateTestRelayInfo(server.URL)
	initial := fmt.Sprintf(`{"id":"pred-1","status":"starting","urls":{"get":%q}}`, server.URL+"/v1/predictions/pred-1")

	usage, apiErr := (&Adaptor{}).DoResponse(c, replicateHTTPResponse(http.StatusCreated, initial), info)

	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	require.Equal(t, int32(1), pollCalls.Load())
	require.Equal(t, "Bearer test-key", pollAuthorization.Load())
	require.Contains(t, recorder.Body.String(), `"url":"https://cdn.example.com/result.png"`)
}

func TestDoResponsePollsPredictionByIDWhenGetURLIsMissing(t *testing.T) {
	t.Parallel()

	var pollCalls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		pollCalls.Add(1)
		require.Equal(t, "/v1/predictions/pred-by-id", r.URL.Path)
		_, err := io.WriteString(w, `{"id":"pred-by-id","status":"succeeded","output":["https://cdn.example.com/one.png"]}`)
		require.NoError(t, err)
	}))
	t.Cleanup(server.Close)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)

	_, apiErr := (&Adaptor{}).DoResponse(
		c,
		replicateHTTPResponse(http.StatusCreated, `{"id":"pred-by-id","status":"processing"}`),
		replicateTestRelayInfo(server.URL),
	)

	require.Nil(t, apiErr)
	require.Equal(t, int32(1), pollCalls.Load())
	require.Contains(t, recorder.Body.String(), `"url":"https://cdn.example.com/one.png"`)
}

func TestDoResponseRejectsCrossOriginPredictionPollURL(t *testing.T) {
	t.Parallel()

	var foreignCalls atomic.Int32
	foreignServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		foreignCalls.Add(1)
		w.WriteHeader(http.StatusInternalServerError)
	}))
	t.Cleanup(foreignServer.Close)

	channelServer := httptest.NewServer(http.NotFoundHandler())
	t.Cleanup(channelServer.Close)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)
	initial := fmt.Sprintf(`{"id":"pred-1","status":"starting","urls":{"get":%q}}`, foreignServer.URL+"/v1/predictions/pred-1")

	_, apiErr := (&Adaptor{}).DoResponse(
		c,
		replicateHTTPResponse(http.StatusCreated, initial),
		replicateTestRelayInfo(channelServer.URL),
	)

	require.NotNil(t, apiErr)
	require.Contains(t, apiErr.Error(), "same origin")
	require.Zero(t, foreignCalls.Load())
}

func TestDoResponseRejectsCrossOriginPredictionPollRedirect(t *testing.T) {
	t.Parallel()

	var foreignCalls atomic.Int32
	foreignServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		foreignCalls.Add(1)
		w.WriteHeader(http.StatusInternalServerError)
	}))
	t.Cleanup(foreignServer.Close)

	channelServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, foreignServer.URL+"/stolen", http.StatusFound)
	}))
	t.Cleanup(channelServer.Close)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)
	initial := fmt.Sprintf(`{"id":"pred-1","status":"starting","urls":{"get":%q}}`, channelServer.URL+"/v1/predictions/pred-1")

	_, apiErr := (&Adaptor{}).DoResponse(
		c,
		replicateHTTPResponse(http.StatusCreated, initial),
		replicateTestRelayInfo(channelServer.URL),
	)

	require.NotNil(t, apiErr)
	require.Contains(t, apiErr.Error(), "same origin")
	require.Zero(t, foreignCalls.Load())
}

func TestDoResponseReturnsPredictionTerminalFailure(t *testing.T) {
	t.Parallel()

	for _, status := range []string{"failed", "canceled"} {
		t.Run(status, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				_, err := fmt.Fprintf(w, `{"id":"pred-1","status":%q,"error":{"message":"generation %s"}}`, status, status)
				require.NoError(t, err)
			}))
			t.Cleanup(server.Close)

			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)
			initial := fmt.Sprintf(`{"id":"pred-1","status":"starting","urls":{"get":%q}}`, server.URL+"/v1/predictions/pred-1")

			_, apiErr := (&Adaptor{}).DoResponse(
				c,
				replicateHTTPResponse(http.StatusCreated, initial),
				replicateTestRelayInfo(server.URL),
			)

			require.NotNil(t, apiErr)
			require.Contains(t, apiErr.Error(), "generation "+status)
		})
	}
}

func TestDoResponseStopsPredictionPollingWhenContextIsCanceled(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, err := io.WriteString(w, `{"id":"pred-1","status":"processing"}`)
		require.NoError(t, err)
	}))
	t.Cleanup(server.Close)

	ctx, cancel := context.WithCancel(context.Background())
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil).WithContext(ctx)
	initial := fmt.Sprintf(`{"id":"pred-1","status":"starting","urls":{"get":%q}}`, server.URL+"/v1/predictions/pred-1")
	cancel()

	started := time.Now()
	_, apiErr := (&Adaptor{}).DoResponse(
		c,
		replicateHTTPResponse(http.StatusCreated, initial),
		replicateTestRelayInfo(server.URL),
	)

	require.NotNil(t, apiErr)
	require.ErrorIs(t, apiErr, context.Canceled)
	require.ErrorIs(t, apiErr, types.ErrProviderTaskPollingRetryable)
	require.Less(t, time.Since(started), time.Second)
}

func TestDoResponseMarksTransientPredictionPollStatusRetryable(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
		_, err := io.WriteString(w, `temporarily unavailable`)
		require.NoError(t, err)
	}))
	t.Cleanup(server.Close)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)
	initial := fmt.Sprintf(`{"id":"pred-1","status":"starting","urls":{"get":%q}}`, server.URL+"/v1/predictions/pred-1")

	_, apiErr := (&Adaptor{}).DoResponse(
		c,
		replicateHTTPResponse(http.StatusCreated, initial),
		replicateTestRelayInfo(server.URL),
	)

	require.NotNil(t, apiErr)
	require.ErrorIs(t, apiErr, types.ErrProviderTaskPollingRetryable)
}

func replicateTestRelayInfo(baseURL string) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeImagesGenerations,
		StartTime: time.Unix(1700000000, 0),
		Request:   &dto.ImageRequest{ResponseFormat: "url"},
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl:    baseURL,
			ApiKey:            "test-key",
			UpstreamModelName: ModelFlux11Pro,
		},
	}
}

func replicateHTTPResponse(status int, body string) *http.Response {
	return &http.Response{
		StatusCode: status,
		Header:     make(http.Header),
		Body:       io.NopCloser(strings.NewReader(body)),
	}
}
