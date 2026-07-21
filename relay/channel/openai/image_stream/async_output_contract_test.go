package image_stream

import (
	"bytes"
	"context"
	"encoding/base64"
	"fmt"
	"image"
	"image/png"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAsyncImageWorkersEnforcePersistedOutputContract(t *testing.T) {
	tests := []struct {
		name          string
		executor      string
		expectedCount uint
		outputSizes   [][2]int
		wantSuccess   bool
		wantFailure   string
	}{
		{
			name:          "adaptor size mismatch",
			executor:      AsyncImageExecutorAdaptor,
			expectedCount: 1,
			outputSizes:   [][2]int{{1, 1}},
			wantFailure:   "image dimension mismatch",
		},
		{
			name:          "adaptor count mismatch",
			executor:      AsyncImageExecutorAdaptor,
			expectedCount: 2,
			outputSizes:   [][2]int{{2, 1}},
			wantFailure:   "image count mismatch",
		},
		{
			name:          "adaptor matching output",
			executor:      AsyncImageExecutorAdaptor,
			expectedCount: 2,
			outputSizes:   [][2]int{{2, 1}, {2, 1}},
			wantSuccess:   true,
		},
		{
			name:          "Responses size mismatch",
			executor:      AsyncImageExecutorResponses,
			expectedCount: 1,
			outputSizes:   [][2]int{{1, 1}},
			wantFailure:   "image dimension mismatch",
		},
		{
			name:          "Responses matching output",
			executor:      AsyncImageExecutorResponses,
			expectedCount: 1,
			outputSizes:   [][2]int{{2, 1}},
			wantSuccess:   true,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			setupAsyncImageSubmitTestDB(t)
			require.NoError(t, model.DB.AutoMigrate(&model.Channel{}, &model.ImageTaskArtifactChunk{}, &model.Log{}))

			previousMemoryCacheEnabled := common.MemoryCacheEnabled
			common.MemoryCacheEnabled = false
			t.Cleanup(func() { common.MemoryCacheEnabled = previousMemoryCacheEnabled })
			previousLogDB := model.LOG_DB
			model.LOG_DB = model.DB
			t.Cleanup(func() { model.LOG_DB = previousLogDB })

			var r2Uploads atomic.Int32
			previousDefaultClient := http.DefaultClient
			http.DefaultClient = &http.Client{Transport: asyncImageRoundTripFunc(func(request *http.Request) (*http.Response, error) {
				assert.Equal(t, http.MethodPut, request.Method)
				assert.Equal(t, "test-account.r2.cloudflarestorage.com", request.URL.Host)
				r2Uploads.Add(1)
				return &http.Response{
					StatusCode: http.StatusOK,
					Status:     "200 OK",
					Header:     make(http.Header),
					Body:       io.NopCloser(strings.NewReader("")),
					Request:    request,
				}, nil
			})}
			t.Cleanup(func() { http.DefaultClient = previousDefaultClient })

			encodedImages := make([]string, 0, len(test.outputSizes))
			responseImages := make([]dto.ImageData, 0, len(test.outputSizes))
			for _, dimensions := range test.outputSizes {
				encoded := base64.StdEncoding.EncodeToString(asyncOutputContractPNG(t, dimensions[0], dimensions[1]))
				encodedImages = append(encodedImages, encoded)
				responseImages = append(responseImages, dto.ImageData{B64Json: encoded})
			}

			var providerCalls atomic.Int32
			baseURL := "https://upstream.example.com"
			if test.executor == AsyncImageExecutorResponses {
				provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, request *http.Request) {
					providerCalls.Add(1)
					_, _ = io.Copy(io.Discard, request.Body)
					w.Header().Set("Content-Type", "text/event-stream")
					for _, encoded := range encodedImages {
						_, _ = fmt.Fprintf(w, "data: {\"type\":\"response.output_item.done\",\"item\":{\"type\":\"image_generation_call\",\"result\":%q,\"output_format\":\"png\"}}\n\n", encoded)
					}
					_, _ = io.WriteString(w, "data: {\"type\":\"response.completed\",\"response\":{\"model\":\"gpt-image-1\",\"usage\":{\"input_tokens\":1,\"output_tokens\":1}}}\n\n")
				}))
				t.Cleanup(provider.Close)
				baseURL = provider.URL
			} else {
				genericImageExecutorRegistry.Lock()
				previousExecutor := genericImageExecutorRegistry.executor
				genericImageExecutorRegistry.executor = func(_ context.Context, request *GenericImageExecutionRequest) (*GenericImageExecutionResult, *types.NewAPIError) {
					if err := request.BeforeProviderCall(); err != nil {
						return nil, types.NewError(err, types.ErrorCodeDoRequestFailed, types.ErrOptionWithSkipRetry())
					}
					providerCalls.Add(1)
					response := &dto.ImageResponse{Created: 123, Data: responseImages}
					body, err := common.Marshal(response)
					if err != nil {
						return nil, types.NewError(err, types.ErrorCodeBadResponseBody, types.ErrOptionWithSkipRetry())
					}
					if err := request.Checkpoint(&GenericImageUpstreamResponse{StatusCode: http.StatusOK, Body: body}); err != nil {
						return nil, types.NewError(fmt.Errorf("%w: %w", ErrGenericImageCheckpoint, err), types.ErrorCodeUpdateDataError, types.ErrOptionWithSkipRetry())
					}
					return &GenericImageExecutionResult{Response: response, Usage: &dto.Usage{PromptTokens: 1, TotalTokens: 1}}, nil
				}
				genericImageExecutorRegistry.Unlock()
				t.Cleanup(func() {
					genericImageExecutorRegistry.Lock()
					genericImageExecutorRegistry.executor = previousExecutor
					genericImageExecutorRegistry.Unlock()
				})
			}

			channel := &model.Channel{
				Type:        constant.ChannelTypeOpenAI,
				Key:         "output-contract-key",
				Status:      common.ChannelStatusEnabled,
				Name:        "async output contract " + test.name,
				CreatedTime: 1700001000,
				BaseURL:     &baseURL,
				Models:      "gpt-image-1",
				Group:       "default",
			}
			require.NoError(t, model.DB.Create(channel).Error)
			t.Cleanup(func() { model.CooldownChannel(channel.Id, "test cleanup", -time.Second) })
			user := &model.User{
				Username: "async-output-contract-" + strings.ReplaceAll(test.name, " ", "-"),
				Quota:    1000,
				Status:   common.UserStatusEnabled,
				Group:    "default",
			}
			require.NoError(t, model.DB.Create(user).Error)

			protocol := dto.ImageRoutingProtocolImagesGenerations
			upstreamPath := "/v1/images/generations"
			var prepared *PreparedAsyncImageRequest
			if test.executor == AsyncImageExecutorResponses {
				protocol = dto.ImageRoutingProtocolResponsesSSE
				upstreamPath = "/v1/responses"
			} else {
				prepared = &PreparedAsyncImageRequest{
					Body:                     []byte(`{"model":"gpt-image-1","prompt":"draw"}`),
					RelayMode:                relayconstant.RelayModeImagesGenerations,
					ContentType:              "application/json",
					RequestURLPath:           upstreamPath,
					ImageRoutingProtocol:     protocol,
					ImageRoutingUpstreamPath: upstreamPath,
					APIType:                  constant.APITypeOpenAI,
					ChannelType:              channel.Type,
					ChannelCreateTime:        channel.CreatedTime,
				}
			}

			payload := asyncImageTaskPayload{
				Version:                  asyncImagePayloadVersion,
				Executor:                 test.executor,
				RelayMode:                relayconstant.RelayModeImagesGenerations,
				ImageRoutingProtocol:     protocol,
				ImageRoutingUpstreamPath: upstreamPath,
				ImageRequirement: &dto.ImageSelectionRequirement{
					Operation:    dto.ImageOperationGeneration,
					Size:         "2x1",
					OutputFormat: "png",
					N:            test.expectedCount,
				},
				Request:           &dto.ImageRequest{Model: "gpt-image-1", Prompt: "draw", ResponseFormat: "url"},
				PreparedRequest:   prepared,
				ChannelType:       channel.Type,
				ChannelCreateTime: channel.CreatedTime,
			}
			task := &model.Task{
				TaskID:    "task_" + strings.ReplaceAll(test.name, " ", "_"),
				Platform:  constant.TaskPlatformOpenAIImage,
				UserId:    user.Id,
				ChannelId: channel.Id,
				Status:    model.TaskStatusInProgress,
				Attempt:   1,
				Progress:  "10%",
				Properties: model.Properties{
					OriginModelName:   "gpt-image-1",
					UpstreamModelName: "gpt-image-1",
				},
				PrivateData: model.TaskPrivateData{
					ChannelKeyHash: common.GenerateHMAC(channel.Key),
					BillingSource:  "wallet",
					BillingContext: &model.TaskBillingContext{PerCallBilling: true, OriginModelName: "gpt-image-1"},
				},
			}
			task.SetCheckpointData(payload)
			require.NoError(t, model.DB.Create(task).Error)

			completed, executeErr := executeAsyncImageTask(context.Background(), task)
			require.NoError(t, executeErr)
			assert.Equal(t, int32(1), providerCalls.Load())

			var stored model.Task
			require.NoError(t, model.DB.First(&stored, task.ID).Error)
			response := BuildImageTaskResponse(&stored)
			require.NotNil(t, response)
			if !test.wantSuccess {
				assert.False(t, completed)
				assert.Equal(t, model.TaskStatus(model.TaskStatusFailure), stored.Status)
				assert.Empty(t, stored.Data)
				assert.Empty(t, stored.PrivateData.ResultURL)
				assert.Contains(t, stored.FailReason, "validate provider image output contract")
				assert.Contains(t, stored.FailReason, test.wantFailure)
				assert.Equal(t, "failed", response.Status)
				assert.Nil(t, response.Result)
				require.NotNil(t, response.Error)
				assert.Zero(t, r2Uploads.Load())
				return
			}

			assert.True(t, completed)
			assert.Equal(t, model.TaskStatus(model.TaskStatusSuccess), stored.Status)
			assert.Empty(t, stored.FailReason)
			assert.Equal(t, "completed", response.Status)
			require.NotNil(t, response.Result)
			assert.Nil(t, response.Error)
			assert.Equal(t, int32(len(test.outputSizes)), r2Uploads.Load())

			var result struct {
				Data []dto.ImageData `json:"data"`
			}
			require.NoError(t, common.Unmarshal(stored.Data, &result))
			require.Len(t, result.Data, len(test.outputSizes))
			for _, item := range result.Data {
				assert.True(t, strings.HasPrefix(item.Url, "https://cdn.example.com/images/"), item.Url)
				assert.Empty(t, item.B64Json)
			}
			assert.Equal(t, result.Data[0].Url, stored.PrivateData.ResultURL)
		})
	}
}

func asyncOutputContractPNG(t *testing.T, width, height int) []byte {
	t.Helper()
	var buffer bytes.Buffer
	require.NoError(t, png.Encode(&buffer, image.NewRGBA(image.Rect(0, 0, width, height))))
	return buffer.Bytes()
}
