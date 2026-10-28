package aws

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"maps"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	relaytypes "github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/aws/protocol/eventstream"
	"github.com/aws/aws-sdk-go-v2/aws/protocol/eventstream/eventstreamapi"
	"github.com/aws/aws-sdk-go-v2/aws/signer/v4"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/bedrockruntime"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const awsTestModel = "anthropic.claude-3-5-sonnet-20240620-v1:0"

type awsHTTPClientFunc func(*http.Request) (*http.Response, error)

func (f awsHTTPClientFunc) Do(request *http.Request) (*http.Response, error) {
	return f(request)
}

type awsNotifyingResponseWriter struct {
	*httptest.ResponseRecorder
	notifyOn []byte
	notified chan int
	once     sync.Once
}

func newAwsNotifyingResponseWriter(notifyOn string) *awsNotifyingResponseWriter {
	return &awsNotifyingResponseWriter{
		ResponseRecorder: httptest.NewRecorder(),
		notifyOn:         []byte(notifyOn),
		notified:         make(chan int, 1),
	}
}

func (w *awsNotifyingResponseWriter) Write(data []byte) (int, error) {
	return w.ResponseRecorder.Write(data)
}

func (w *awsNotifyingResponseWriter) Flush() {
	w.ResponseRecorder.Flush()
	if bytes.Contains(w.Body.Bytes(), w.notifyOn) {
		w.once.Do(func() {
			w.notified <- w.Body.Len()
		})
	}
}

func newAwsTestClient(httpClient bedrockruntime.HTTPClient) *bedrockruntime.Client {
	return bedrockruntime.New(bedrockruntime.Options{
		Region:       "us-east-1",
		BaseEndpoint: aws.String("https://bedrock.test"),
		Credentials: aws.NewCredentialsCache(credentials.NewStaticCredentialsProvider(
			"access-key", "secret-key", "",
		)),
		HTTPClient: httpClient,
		Retryer:    aws.NopRetryer{},
	})
}

func newAwsTestContext(writer http.ResponseWriter, requestContext context.Context) *gin.Context {
	c, _ := gin.CreateTestContext(writer)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil).WithContext(requestContext)
	return c
}

func newAwsTestRelayInfo() *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		StartTime:          time.Now(),
		IsStream:           true,
		OriginModelName:    awsTestModel,
		RelayFormat:        relaytypes.RelayFormatOpenAI,
		ShouldIncludeUsage: true,
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: awsTestModel,
		},
	}
}

func newAwsInvokeModelInput() *bedrockruntime.InvokeModelInput {
	return &bedrockruntime.InvokeModelInput{
		ModelId:     aws.String(awsTestModel),
		Body:        []byte(`{}`),
		Accept:      aws.String("application/json"),
		ContentType: aws.String("application/json"),
	}
}

func newAwsStreamInput() *bedrockruntime.InvokeModelWithResponseStreamInput {
	return &bedrockruntime.InvokeModelWithResponseStreamInput{
		ModelId:     aws.String(awsTestModel),
		Body:        []byte(`{}`),
		Accept:      aws.String("application/json"),
		ContentType: aws.String("application/json"),
	}
}

func writeAwsStreamEvent(writer io.Writer, data string) error {
	payload, err := common.Marshal(struct {
		Bytes []byte `json:"bytes"`
	}{Bytes: []byte(data)})
	if err != nil {
		return err
	}

	return eventstream.NewEncoder().Encode(writer, eventstream.Message{
		Headers: eventstream.Headers{
			{Name: eventstreamapi.MessageTypeHeader, Value: eventstream.StringValue(eventstreamapi.EventMessageType)},
			{Name: eventstreamapi.EventTypeHeader, Value: eventstream.StringValue("chunk")},
			{Name: eventstreamapi.ContentTypeHeader, Value: eventstream.StringValue("application/json")},
		},
		Payload: payload,
	})
}

func newAwsStreamResponse(request *http.Request, body io.ReadCloser) *http.Response {
	return &http.Response{
		StatusCode: http.StatusOK,
		Status:     "200 OK",
		Header: http.Header{
			"Content-Type":                []string{"application/vnd.amazon.eventstream"},
			"X-Amzn-Bedrock-Content-Type": []string{"application/json"},
		},
		Body:    body,
		Request: request,
	}
}

func TestDoAwsClientRequest_AppliesRuntimeHeaderOverrideToAnthropicBeta(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/messages", nil)

	info := &relaycommon.RelayInfo{
		OriginModelName:           "claude-3-5-sonnet-20240620",
		IsStream:                  false,
		UseRuntimeHeadersOverride: true,
		RuntimeHeadersOverride: map[string]any{
			"anthropic-beta": "computer-use-2025-01-24",
		},
		ChannelMeta: &relaycommon.ChannelMeta{
			ApiKey:            "access-key|secret-key|us-east-1",
			UpstreamModelName: "claude-3-5-sonnet-20240620",
		},
	}

	requestBody := bytes.NewBufferString(`{"messages":[{"role":"user","content":"hello"}],"max_tokens":128}`)
	adaptor := &Adaptor{}

	_, err := doAwsClientRequest(ctx, info, adaptor, requestBody)
	require.NoError(t, err)

	awsReq, ok := adaptor.AwsReq.(*bedrockruntime.InvokeModelInput)
	require.True(t, ok)

	var payload map[string]any
	require.NoError(t, common.Unmarshal(awsReq.Body, &payload))

	anthropicBeta, exists := payload["anthropic_beta"]
	require.True(t, exists)

	values, ok := anthropicBeta.([]any)
	require.True(t, ok)
	require.Equal(t, []any{"computer-use-2025-01-24"}, values)
}

func TestDoAwsClientRequest_ForwardsThinkingBlockBindingAndBetaList(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/messages", nil)
	ctx.Request.Header.Set("anthropic-beta", "fast-mode-2026-02-01, thinking-binding-controls-2026-08-01")

	info := &relaycommon.RelayInfo{
		OriginModelName: "claude-opus-5-5",
		ChannelMeta: &relaycommon.ChannelMeta{
			ApiKey:            "access-key|secret-key|us-east-1",
			UpstreamModelName: "claude-opus-5-5",
		},
	}
	requestBody := bytes.NewBufferString(`{"max_tokens":128,"messages":[{"role":"user","content":"hello"}],` +
		`"thinking":{"type":"adaptive","display":"summarized","block_binding":{"prefix_mismatch_behavior":"drop_block"}}}`)
	adaptor := &Adaptor{}

	_, err := doAwsClientRequest(ctx, info, adaptor, requestBody)
	require.NoError(t, err)
	awsReq, ok := adaptor.AwsReq.(*bedrockruntime.InvokeModelInput)
	require.True(t, ok)

	var payload struct {
		AnthropicBeta []string        `json:"anthropic_beta"`
		Thinking      json.RawMessage `json:"thinking"`
	}
	require.NoError(t, common.Unmarshal(awsReq.Body, &payload))
	assert.Equal(t, []string{"fast-mode-2026-02-01", "thinking-binding-controls-2026-08-01"}, payload.AnthropicBeta)
	assert.JSONEq(t, `{"type":"adaptive","display":"summarized","block_binding":{"prefix_mismatch_behavior":"drop_block"}}`, string(payload.Thinking))
}

func TestDoAwsClientRequest_PreservesSafeguards(t *testing.T) {
	gin.SetMode(gin.TestMode)
	settings := model_setting.GetGlobalSettings()
	originalPassthrough := settings.PassThroughRequestEnabled
	settings.PassThroughRequestEnabled = false
	t.Cleanup(func() { settings.PassThroughRequestEnabled = originalPassthrough })

	const legacyBody = `{"anthropic_version":"bedrock-2023-05-31","anthropic_beta":["dangerous-tool-use-2026-09-03"],"messages":[{"role":"user","content":"hello"}],"max_tokens":512}`
	tests := []struct {
		name       string
		safeguards string
	}{
		{name: "omitted"},
		{name: "empty_array", safeguards: `[]`},
		{name: "dangerous_tool_use", safeguards: `[{"type":"dangerous_tool_use","classifier_context":{"v":1,"permission_mode":"auto"}}]`},
		// Preserve invalid values so AWS can reject them instead of silently disabling the feature.
		{name: "invalid_object", safeguards: `{"enabled":true,"policy":"strict","blocked_actions":["rm -rf","sudo"]}`},
	}
	for _, tt := range tests {
		for _, stream := range []bool{false, true} {
			name := tt.name + "/nonstream"
			if stream {
				name = tt.name + "/stream"
			}
			t.Run(name, func(t *testing.T) {
				input := map[string]any{
					"model": "claude-sonnet-5", "max_tokens": 512, "stream": stream,
					"messages": []map[string]any{{"role": "user", "content": "hello"}},
				}
				if tt.safeguards != "" {
					input["safeguards"] = json.RawMessage(tt.safeguards)
				}
				raw, err := common.Marshal(input)
				require.NoError(t, err)
				var request dto.ClaudeRequest
				require.NoError(t, common.Unmarshal(raw, &request))

				ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
				ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/messages", bytes.NewReader(raw))
				ctx.Request.Header.Set("anthropic-beta", "dangerous-tool-use-2026-09-03")
				info := &relaycommon.RelayInfo{
					OriginModelName: "claude-sonnet-5",
					IsStream:        stream,
					RelayFormat:     relaytypes.RelayFormatClaude,
					ChannelMeta: &relaycommon.ChannelMeta{
						ApiKey:            "access-key|secret-key|us-east-1",
						UpstreamModelName: "global.anthropic.claude-sonnet-5",
					},
				}
				adaptor := &Adaptor{}
				converted, err := adaptor.ConvertClaudeRequest(ctx, info, &request)
				require.NoError(t, err)
				raw, err = common.Marshal(converted)
				require.NoError(t, err)
				_, err = doAwsClientRequest(ctx, info, adaptor, bytes.NewReader(raw))
				require.NoError(t, err)

				var outbound []byte
				if stream {
					sdkRequest, ok := adaptor.AwsReq.(*bedrockruntime.InvokeModelWithResponseStreamInput)
					require.True(t, ok)
					outbound = sdkRequest.Body
				} else {
					sdkRequest, ok := adaptor.AwsReq.(*bedrockruntime.InvokeModelInput)
					require.True(t, ok)
					outbound = sdkRequest.Body
				}
				if tt.safeguards == "" {
					assert.Equal(t, legacyBody, string(outbound), "legacy requests must remain byte-for-byte unchanged")
					return
				}
				var expected map[string]json.RawMessage
				require.NoError(t, common.UnmarshalJsonStr(legacyBody, &expected))
				expected["safeguards"] = json.RawMessage(tt.safeguards)
				want, err := common.Marshal(expected)
				require.NoError(t, err)
				assert.JSONEq(t, string(want), string(outbound))
			})
		}
	}
}

func TestNewAwsInvokeContextInheritsParent(t *testing.T) {
	originalRelayTimeout := common.RelayTimeout
	t.Cleanup(func() {
		common.RelayTimeout = originalRelayTimeout
	})

	tests := []struct {
		name         string
		relayTimeout int
		wantDeadline bool
	}{
		{name: "without relay timeout", relayTimeout: 0, wantDeadline: false},
		{name: "with relay timeout", relayTimeout: 30, wantDeadline: true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			common.RelayTimeout = test.relayTimeout
			parent, cancelParent := context.WithCancel(context.Background())
			invokeContext, cancelInvoke := newAwsInvokeContext(parent)
			defer cancelInvoke()

			_, hasDeadline := invokeContext.Deadline()
			assert.Equal(t, test.wantDeadline, hasDeadline)

			cancelParent()
			require.ErrorIs(t, invokeContext.Err(), context.Canceled)
		})
	}
}

func TestNewAwsInvokeErrorSkipsRetryOnlyForClientCancellation(t *testing.T) {
	canceledContext, cancel := context.WithCancel(context.Background())
	cancel()

	tests := []struct {
		name           string
		requestContext context.Context
		err            error
		wantSkipRetry  bool
	}{
		{
			name:           "client context canceled",
			requestContext: canceledContext,
			err:            context.Canceled,
			wantSkipRetry:  true,
		},
		{
			name:           "relay timeout with live client context",
			requestContext: context.Background(),
			err:            context.DeadlineExceeded,
			wantSkipRetry:  false,
		},
		{
			name:           "upstream error with live client context",
			requestContext: context.Background(),
			err:            errors.New("upstream failed"),
			wantSkipRetry:  false,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := newAwsInvokeError(test.requestContext, test.err, "InvokeModel")
			assert.Equal(t, test.wantSkipRetry, relaytypes.IsSkipRetryError(err))
		})
	}
}

func TestAwsHandlersCancelSdkRequestAndSkipRetry(t *testing.T) {
	originalRelayTimeout := common.RelayTimeout
	common.RelayTimeout = 0
	t.Cleanup(func() {
		common.RelayTimeout = originalRelayTimeout
	})

	tests := []struct {
		name    string
		request any
		handle  func(*gin.Context, *relaycommon.RelayInfo, *Adaptor) (*relaytypes.NewAPIError, *dto.Usage)
	}{
		{name: "non-stream", request: newAwsInvokeModelInput(), handle: awsHandler},
		{name: "stream", request: newAwsStreamInput(), handle: awsStreamHandler},
		{name: "nova", request: newAwsInvokeModelInput(), handle: handleNovaRequest},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			requestContext, cancelRequest := context.WithCancel(context.Background())
			t.Cleanup(cancelRequest)

			upstreamContexts := make(chan context.Context, 1)
			client := newAwsTestClient(awsHTTPClientFunc(func(request *http.Request) (*http.Response, error) {
				upstreamContexts <- request.Context()
				<-request.Context().Done()
				return nil, request.Context().Err()
			}))
			adaptor := &Adaptor{AwsClient: client, AwsReq: test.request}
			c := newAwsTestContext(httptest.NewRecorder(), requestContext)
			info := newAwsTestRelayInfo()

			type handlerResult struct {
				err   *relaytypes.NewAPIError
				usage *dto.Usage
			}
			results := make(chan handlerResult, 1)
			go func() {
				err, usage := test.handle(c, info, adaptor)
				results <- handlerResult{err: err, usage: usage}
			}()

			var upstreamContext context.Context
			select {
			case upstreamContext = <-upstreamContexts:
			case result := <-results:
				t.Fatalf("handler returned before issuing AWS request: %v", result.err)
			case <-time.After(5 * time.Second):
				t.Fatal("AWS request did not start")
			}

			cancelRequest()

			var result handlerResult
			select {
			case result = <-results:
			case <-time.After(5 * time.Second):
				t.Fatal("handler did not stop after client cancellation")
			}

			require.ErrorIs(t, upstreamContext.Err(), context.Canceled)
			require.NotNil(t, result.err)
			assert.True(t, relaytypes.IsSkipRetryError(result.err))
			assert.Nil(t, result.usage)
		})
	}
}

func TestAwsStreamHandlerUsesFinalUpstreamUsage(t *testing.T) {
	originalRelayTimeout := common.RelayTimeout
	common.RelayTimeout = 0
	t.Cleanup(func() {
		common.RelayTimeout = originalRelayTimeout
	})

	events := []string{
		`{"type":"message_start","message":{"id":"msg_test","type":"message","role":"assistant","model":"claude-test","content":[],"usage":{"input_tokens":100,"output_tokens":1}}}`,
		`{"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}`,
		`{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"partial"}}`,
		`{"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":423}}`,
		`{"type":"message_stop"}`,
	}
	client := newAwsTestClient(awsHTTPClientFunc(func(request *http.Request) (*http.Response, error) {
		var body bytes.Buffer
		for _, event := range events {
			if err := writeAwsStreamEvent(&body, event); err != nil {
				return nil, err
			}
		}
		return newAwsStreamResponse(request, io.NopCloser(bytes.NewReader(body.Bytes()))), nil
	}))
	adaptor := &Adaptor{AwsClient: client, AwsReq: newAwsStreamInput()}
	recorder := httptest.NewRecorder()
	c := newAwsTestContext(recorder, context.Background())

	handlerErr, usage := awsStreamHandler(c, newAwsTestRelayInfo(), adaptor)

	require.Nil(t, handlerErr)
	require.NotNil(t, usage)
	require.NotNil(t, usage.BillingUsage)
	require.NotNil(t, usage.BillingUsage.ClaudeUsage)
	assert.Equal(t, 100, usage.BillingUsage.ClaudeUsage.InputTokens)
	assert.Equal(t, 423, usage.BillingUsage.ClaudeUsage.OutputTokens)
	assert.Contains(t, recorder.Body.String(), "[DONE]")
}

func TestAwsStreamHandlerStopsAtClientCancellation(t *testing.T) {
	originalRelayTimeout := common.RelayTimeout
	common.RelayTimeout = 0
	t.Cleanup(func() {
		common.RelayTimeout = originalRelayTimeout
	})

	requestContext, cancelRequest := context.WithCancel(context.Background())
	t.Cleanup(cancelRequest)
	releaseFinal := make(chan struct{})
	var releaseFinalOnce sync.Once
	release := func() {
		releaseFinalOnce.Do(func() {
			close(releaseFinal)
		})
	}
	t.Cleanup(release)

	producerResults := make(chan error, 1)
	upstreamContexts := make(chan context.Context, 1)
	client := newAwsTestClient(awsHTTPClientFunc(func(request *http.Request) (*http.Response, error) {
		upstreamContexts <- request.Context()
		reader, writer := io.Pipe()
		go func() {
			defer writer.Close()
			initialEvents := []string{
				`{"type":"message_start","message":{"id":"msg_test","type":"message","role":"assistant","model":"claude-test","content":[],"usage":{"input_tokens":100,"output_tokens":1}}}`,
				`{"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}`,
				`{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"partial"}}`,
			}
			for _, event := range initialEvents {
				if err := writeAwsStreamEvent(writer, event); err != nil {
					producerResults <- err
					return
				}
			}

			<-releaseFinal
			producerResults <- writeAwsStreamEvent(writer, `{"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":423}}`)
		}()
		return newAwsStreamResponse(request, reader), nil
	}))

	responseWriter := newAwsNotifyingResponseWriter("partial")
	c := newAwsTestContext(responseWriter, requestContext)
	adaptor := &Adaptor{AwsClient: client, AwsReq: newAwsStreamInput()}

	type handlerResult struct {
		err   *relaytypes.NewAPIError
		usage *dto.Usage
	}
	results := make(chan handlerResult, 1)
	go func() {
		err, usage := awsStreamHandler(c, newAwsTestRelayInfo(), adaptor)
		results <- handlerResult{err: err, usage: usage}
	}()

	var upstreamContext context.Context
	select {
	case upstreamContext = <-upstreamContexts:
	case <-time.After(5 * time.Second):
		t.Fatal("AWS stream request did not start")
	}

	var bodyLengthBeforeCancel int
	select {
	case bodyLengthBeforeCancel = <-responseWriter.notified:
	case <-time.After(5 * time.Second):
		t.Fatal("partial response was not written")
	}
	cancelRequest()

	var result handlerResult
	select {
	case result = <-results:
	case <-time.After(5 * time.Second):
		t.Fatal("stream handler did not stop after client cancellation")
	}

	require.ErrorIs(t, upstreamContext.Err(), context.Canceled)
	require.Nil(t, result.err)
	require.NotNil(t, result.usage)
	assert.Equal(t, bodyLengthBeforeCancel, responseWriter.Body.Len())
	assert.NotContains(t, responseWriter.Body.String(), "[DONE]")

	release()
	select {
	case producerErr := <-producerResults:
		require.Error(t, producerErr)
	case <-time.After(5 * time.Second):
		t.Fatal("upstream producer did not observe the closed stream")
	}
}

func newMantleTestInfo() *relaycommon.RelayInfo {
	info := newAwsTestRelayInfo()
	info.IsStream = false
	info.RelayFormat = relaytypes.RelayFormatClaude
	info.UpstreamModelName = "claude-opus-4-7"
	info.ApiKey = "test-api-key|us-east-1"
	info.ChannelOtherSettings.AwsApiType = dto.AwsApiTypeMantle
	return info
}

func TestMantleRequestPreservesNativeFieldsAndSignsFinalPayload(t *testing.T) {
	for _, key := range []string{"test-api-key|us-east-1", "access-key|secret-key|eu-west-1"} {
		t.Run(strings.Split(key, "|")[0], func(t *testing.T) {
			info := newMantleTestInfo()
			info.ApiKey = key
			info.UseRuntimeHeadersOverride = true
			info.RuntimeHeadersOverride = map[string]any{"anthropic-beta": "test-beta", "X-Test": "override"}
			info.ChannelSetting.PassThroughBodyEnabled = true
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			c := newAwsTestContext(httptest.NewRecorder(), ctx)
			c.Request.Header.Set("Authorization", "Bearer client-secret")
			c.Request.Header.Set("x-api-key", "client-secret")
			a := &Adaptor{}
			body := `{"model":"client-alias","stream":true,"max_tokens":128,"temperature":0,"cache_control":{"type":"ephemeral","ttl":"1h"},"messages":[{"role":"user","content":[{"type":"text","text":"hello","cache_control":{"type":"ephemeral"}}]}],"future_option":{"enabled":false},"anthropic_version":"bedrock-2023-05-31"}`
			req, err := a.newMantleRequest(c, info, strings.NewReader(body))
			require.NoError(t, err)
			assert.Equal(t, "/anthropic/v1/messages", req.URL.Path)
			assert.Equal(t, http.MethodPost, req.Method)
			assert.Equal(t, "2023-06-01", req.Header.Get("anthropic-version"))
			assert.Equal(t, "test-beta", req.Header.Get("anthropic-beta"))
			assert.Equal(t, "override", req.Header.Get("X-Test"))
			payload, err := io.ReadAll(req.Body)
			require.NoError(t, err)
			var data map[string]json.RawMessage
			require.NoError(t, common.Unmarshal(payload, &data))
			assert.JSONEq(t, `"anthropic.claude-opus-4-7"`, string(data["model"]))
			assert.JSONEq(t, `{"type":"ephemeral","ttl":"1h"}`, string(data["cache_control"]))
			assert.JSONEq(t, `[{"role":"user","content":[{"type":"text","text":"hello","cache_control":{"type":"ephemeral"}}]}]`, string(data["messages"]))
			assert.JSONEq(t, `{"enabled":false}`, string(data["future_option"]))
			assert.Equal(t, "0", string(data["temperature"]))
			assert.Equal(t, "true", string(data["stream"]))
			assert.NotContains(t, data, "anthropic_version")
			replay, err := req.GetBody()
			require.NoError(t, err)
			defer replay.Close()
			replayed, err := io.ReadAll(replay)
			require.NoError(t, err)
			assert.Equal(t, payload, replayed)
			if strings.HasPrefix(key, "access-key|") {
				assert.Empty(t, req.Header.Get("x-api-key"))
				auth := req.Header.Get("Authorization")
				assert.Contains(t, auth, "/eu-west-1/bedrock-mantle/aws4_request")
				assert.NotContains(t, auth, "secret-key")
				signedAt, err := time.Parse("20060102T150405Z", req.Header.Get("X-Amz-Date"))
				require.NoError(t, err)
				verification := req.Clone(ctx)
				verification.Header.Del("Authorization")
				hash := sha256.Sum256(payload)
				err = v4.NewSigner().SignHTTP(ctx, aws.Credentials{AccessKeyID: "access-key", SecretAccessKey: "secret-key"}, verification, hex.EncodeToString(hash[:]), "bedrock-mantle", "eu-west-1", signedAt)
				require.NoError(t, err)
				assert.Equal(t, auth, verification.Header.Get("Authorization"))
			} else {
				assert.Equal(t, "test-api-key", req.Header.Get("x-api-key"))
				assert.Empty(t, req.Header.Get("Authorization"))
			}
			cancel()
			assert.ErrorIs(t, req.Context().Err(), context.Canceled)
		})
	}
}

func TestMantleEndpointAndCredentialValidation(t *testing.T) {
	for _, test := range []struct {
		name, key, base, want string
		invalid               bool
	}{
		{name: "regional default", key: "key|us-west-2", want: "https://bedrock-mantle.us-west-2.api.aws/anthropic/v1/messages"},
		{name: "proxy root", key: "ak|sk|us-east-1", base: "https://proxy.example/gateway/", want: "https://proxy.example/gateway/anthropic/v1/messages"},
		{name: "anthropic root", key: "key|us-east-1", base: "https://proxy.example/anthropic/", want: "https://proxy.example/anthropic/v1/messages"},
		{name: "version root", key: "key|us-east-1", base: "https://proxy.example/anthropic/v1", want: "https://proxy.example/anthropic/v1/messages"},
		{name: "full endpoint", key: "key|us-east-1", base: "https://proxy.example/anthropic/v1/messages", want: "https://proxy.example/anthropic/v1/messages"},
		{name: "missing region", key: "secret", invalid: true},
		{name: "empty key", key: "|us-east-1", invalid: true},
		{name: "empty secret", key: "ak||us-east-1", invalid: true},
		{name: "injected host", key: "key|us-east-1.evil.example/", invalid: true},
		{name: "plaintext URL", key: "key|us-east-1", base: "http://proxy.example", invalid: true},
		{name: "URL credentials", key: "key|us-east-1", base: "https://user:secret@proxy.example", invalid: true},
	} {
		t.Run(test.name, func(t *testing.T) {
			info := newMantleTestInfo()
			info.ApiKey, info.ChannelBaseUrl = test.key, test.base
			endpoint, err := (&Adaptor{}).GetRequestURL(info)
			if test.invalid {
				require.Error(t, err)
				assert.NotContains(t, err.Error(), "secret")
				assert.Empty(t, endpoint)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, test.want, endpoint)
		})
	}
}

func TestMantleHTTPResponsesPreserveCacheUsage(t *testing.T) {
	originalTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = originalTimeout })
	const usageJSON = `{"input_tokens":100,"output_tokens":23,"cache_read_input_tokens":1000,"cache_creation_input_tokens":50,"cache_creation":{"ephemeral_5m_input_tokens":20,"ephemeral_1h_input_tokens":30}}`
	for _, stream := range []bool{false, true} {
		for _, format := range []relaytypes.RelayFormat{relaytypes.RelayFormatClaude, relaytypes.RelayFormatOpenAI} {
			t.Run(fmt.Sprintf("stream=%t/format=%s", stream, format), func(t *testing.T) {
				server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					if stream {
						w.Header().Set("Content-Type", "text/event-stream")
						fmt.Fprintf(w, "event: message_start\ndata: {\"type\":\"message_start\",\"message\":{\"id\":\"msg_mantle\",\"type\":\"message\",\"role\":\"assistant\",\"model\":\"anthropic.claude-opus-4-7\",\"content\":[],\"usage\":%s}}\n\n", usageJSON)
						fmt.Fprint(w, "event: content_block_delta\ndata: {\"type\":\"content_block_delta\",\"index\":0,\"delta\":{\"type\":\"text_delta\",\"text\":\"hello\"}}\n\n")
						fmt.Fprint(w, "event: message_delta\ndata: {\"type\":\"message_delta\",\"delta\":{\"stop_reason\":\"end_turn\"},\"usage\":{\"output_tokens\":23}}\n\n")
						fmt.Fprint(w, "event: message_stop\ndata: {\"type\":\"message_stop\"}\n\n")
						return
					}
					w.Header().Set("Content-Type", "application/json")
					fmt.Fprintf(w, `{"id":"msg_mantle","type":"message","role":"assistant","model":"anthropic.claude-opus-4-7","content":[{"type":"text","text":"hello"}],"stop_reason":"end_turn","usage":%s}`, usageJSON)
				}))
				defer server.Close()
				original := http.DefaultClient
				http.DefaultClient = server.Client()
				defer func() { http.DefaultClient = original }()
				info := newMantleTestInfo()
				info.ChannelBaseUrl, info.IsStream, info.RelayFormat = server.URL, stream, format
				recorder := httptest.NewRecorder()
				c := newAwsTestContext(recorder, context.Background())
				a := &Adaptor{}
				a.Init(info)
				var request dto.ClaudeRequest
				require.NoError(t, common.UnmarshalJsonStr(`{"model":"claude-opus-4-7","max_tokens":128,"messages":[{"role":"user","content":"hello"}],"cache_control":{"type":"ephemeral"}}`, &request))
				request.Stream = &stream
				converted, err := a.ConvertClaudeRequest(c, info, &request)
				require.NoError(t, err)
				body, err := common.Marshal(converted)
				require.NoError(t, err)
				response, err := a.DoRequest(c, info, bytes.NewReader(body))
				require.NoError(t, err)
				httpResponse, ok := response.(*http.Response)
				require.True(t, ok)
				result, apiErr := a.DoResponse(c, httpResponse, info)
				require.Nil(t, apiErr)
				usage, ok := result.(*dto.Usage)
				require.True(t, ok)
				require.NotNil(t, usage.BillingUsage)
				require.NotNil(t, usage.BillingUsage.ClaudeUsage)
				claudeUsage := usage.BillingUsage.ClaudeUsage
				assert.Equal(t, 100, claudeUsage.InputTokens)
				assert.Equal(t, 23, claudeUsage.OutputTokens)
				assert.Equal(t, 1000, claudeUsage.CacheReadInputTokens)
				assert.Equal(t, 50, claudeUsage.CacheCreationInputTokens)
				assert.Equal(t, 20, claudeUsage.GetCacheCreation5mTokens())
				assert.Equal(t, 30, claudeUsage.GetCacheCreation1hTokens())
				assert.Contains(t, recorder.Body.String(), "hello")
				if stream && format == relaytypes.RelayFormatOpenAI {
					assert.Contains(t, recorder.Body.String(), "[DONE]")
				}
			})
		}
	}
}

func TestMantleDoesNotFollowRedirectsOrFallbackOnAuthFailure(t *testing.T) {
	for _, status := range []int{http.StatusTemporaryRedirect, http.StatusUnauthorized, http.StatusTooManyRequests} {
		t.Run(fmt.Sprint(status), func(t *testing.T) {
			calls := 0
			server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				calls++
				w.Header().Set("Location", "/credential-leak")
				w.WriteHeader(status)
			}))
			defer server.Close()
			original := http.DefaultClient
			http.DefaultClient = server.Client()
			defer func() { http.DefaultClient = original }()
			info := newMantleTestInfo()
			info.ChannelBaseUrl = server.URL
			c := newAwsTestContext(httptest.NewRecorder(), context.Background())
			response, err := (&Adaptor{}).DoRequest(c, info, strings.NewReader(`{"messages":[]}`))
			require.NoError(t, err)
			httpResponse := response.(*http.Response)
			defer httpResponse.Body.Close()
			assert.Equal(t, status, httpResponse.StatusCode)
			assert.Equal(t, 1, calls)
		})
	}
}

func TestAWSLegacyInterfaceRemainsDefault(t *testing.T) {
	for _, mode := range []dto.AwsApiType{"", dto.AwsApiTypeInvokeModel} {
		for _, stream := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s/stream=%t", mode, stream), func(t *testing.T) {
				info := newMantleTestInfo()
				info.ChannelOtherSettings.AwsApiType = mode
				info.IsStream = stream
				info.UpstreamModelName = "claude-3-5-sonnet-20240620"
				c := newAwsTestContext(httptest.NewRecorder(), context.Background())
				a := &Adaptor{}
				a.Init(info)
				response, err := a.DoRequest(c, info, strings.NewReader(`{"max_tokens":128,"messages":[{"role":"user","content":[{"type":"text","text":"hi","cache_control":{"type":"ephemeral"}}]}],"cache_control":{"type":"ephemeral"}}`))
				require.NoError(t, err)
				assert.Nil(t, response)
				var body []byte
				if stream {
					input, ok := a.AwsReq.(*bedrockruntime.InvokeModelWithResponseStreamInput)
					require.True(t, ok)
					body = input.Body
					assert.Equal(t, "us."+awsTestModel, *input.ModelId)
				} else {
					input, ok := a.AwsReq.(*bedrockruntime.InvokeModelInput)
					require.True(t, ok)
					body = input.Body
					assert.Equal(t, "us."+awsTestModel, *input.ModelId)
				}
				var payload map[string]json.RawMessage
				require.NoError(t, common.Unmarshal(body, &payload))
				assert.Equal(t, `"bedrock-2023-05-31"`, string(payload["anthropic_version"]))
				assert.NotContains(t, payload, "cache_control")
				assert.Contains(t, string(payload["messages"]), "cache_control")
			})
		}
	}
}

func TestMantleRejectsInvalidRequestsAndPreservesExplicitModelIDs(t *testing.T) {
	for _, test := range []struct {
		name, model, body, wantModel string
		invalid                      bool
	}{
		{name: "legacy Haiku alias", model: "claude-haiku-4-5-20251001", body: `{"messages":[]}`, wantModel: "anthropic.claude-haiku-4-5"},
		{name: "short Haiku alias", model: "claude-haiku-4-5", body: `{"messages":[]}`, wantModel: "anthropic.claude-haiku-4-5"},
		{name: "explicit Haiku model", model: "anthropic.claude-haiku-4-5", body: `{"messages":[]}`},
		{name: "explicit Haiku inference profile", model: "us.anthropic.claude-haiku-4-5", body: `{"messages":[]}`},
		{name: "explicit regional model", model: "us.anthropic.claude-opus-4-7", body: `{"messages":[]}`},
		{name: "explicit model", model: "anthropic.claude-opus-4-7", body: `{"messages":[]}`},
		{name: "Nova requires legacy", model: "nova-pro-v1:0", body: `{"messages":[]}`, invalid: true},
		{name: "null body", model: "claude-opus-4-7", body: `null`, invalid: true},
		{name: "malformed JSON", model: "claude-opus-4-7", body: `{`, invalid: true},
	} {
		t.Run(test.name, func(t *testing.T) {
			info := newMantleTestInfo()
			info.UpstreamModelName = test.model
			c := newAwsTestContext(httptest.NewRecorder(), context.Background())
			req, err := (&Adaptor{}).newMantleRequest(c, info, strings.NewReader(test.body))
			if test.invalid {
				require.Error(t, err)
				assert.Nil(t, req)
				return
			}
			require.NoError(t, err)
			defer req.Body.Close()
			var payload map[string]any
			require.NoError(t, common.DecodeJson(req.Body, &payload))
			wantModel := test.wantModel
			if wantModel == "" {
				wantModel = test.model
			}
			assert.Equal(t, wantModel, payload["model"])
			assert.NotContains(t, payload, "cache_control")
		})
	}
}

func TestMantleSignatureMatchesWireHeaders(t *testing.T) {
	for _, test := range []struct {
		name          string
		http2         bool
		allHopHeaders bool
	}{
		{name: "HTTP2 keep-alive", http2: true},
		{name: "HTTP1 hop-by-hop headers", allHopHeaders: true},
		{name: "HTTP2 hop-by-hop headers", http2: true, allHopHeaders: true},
	} {
		t.Run(test.name, func(t *testing.T) {
			type receivedRequest struct {
				request *http.Request
				body    []byte
				err     error
			}
			received := make(chan receivedRequest, 1)
			server := httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				body, err := io.ReadAll(r.Body)
				received <- receivedRequest{request: r.Clone(context.Background()), body: body, err: err}
				w.WriteHeader(http.StatusOK)
			}))
			server.EnableHTTP2 = test.http2
			server.StartTLS()
			defer server.Close()
			originalClient := http.DefaultClient
			http.DefaultClient = server.Client()
			defer func() { http.DefaultClient = originalClient }()

			info := newMantleTestInfo()
			info.ChannelBaseUrl = server.URL
			info.ApiKey = "access-key|secret-key|us-east-1"
			info.UseRuntimeHeadersOverride = true
			info.RuntimeHeadersOverride = map[string]any{
				"Connection":     "keep-alive",
				"anthropic-beta": "test-beta",
				"X-Test":         "end-to-end",
			}
			if test.allHopHeaders {
				maps.Copy(info.RuntimeHeadersOverride, map[string]any{
					"Connection":          "keep-alive, x-hop-token",
					"X-Hop-Token":         "hop-only",
					"Keep-Alive":          "timeout=5",
					"Proxy-Connection":    "keep-alive",
					"Proxy-Authenticate":  "Basic",
					"Proxy-Authorization": "Basic test-proxy-token",
					"Te":                  "trailers",
					"Trailer":             "X-Checksum",
					"Transfer-Encoding":   "chunked",
					"Upgrade":             "websocket",
				})
			}
			c := newAwsTestContext(httptest.NewRecorder(), context.Background())
			response, err := (&Adaptor{}).DoRequest(c, info, strings.NewReader(`{"messages":[],"max_tokens":128,"cache_control":{"type":"ephemeral","ttl":"1h"}}`))
			require.NoError(t, err)
			httpResponse, ok := response.(*http.Response)
			require.True(t, ok)
			defer httpResponse.Body.Close()
			wire := <-received
			require.NoError(t, wire.err)
			wantProtocol := 1
			if test.http2 {
				wantProtocol = 2
			}
			require.Equal(t, wantProtocol, wire.request.ProtoMajor)
			for _, name := range []string{"Connection", "X-Hop-Token", "Keep-Alive", "Proxy-Connection", "Proxy-Authenticate", "Proxy-Authorization", "Te", "Trailer", "Transfer-Encoding", "Upgrade"} {
				assert.Empty(t, wire.request.Header.Values(name), "%s must not reach the upstream", name)
			}
			assert.Equal(t, "test-beta", wire.request.Header.Get("anthropic-beta"))
			assert.Equal(t, "end-to-end", wire.request.Header.Get("X-Test"))

			// Recompute the signature from only the bytes and signed headers that
			// reached the server, not from the pre-transport request object.
			authorization := wire.request.Header.Get("Authorization")
			_, signedHeaders, found := strings.Cut(authorization, "SignedHeaders=")
			require.True(t, found)
			signedHeaders, _, found = strings.Cut(signedHeaders, ",")
			require.True(t, found)
			verification := wire.request.Clone(context.Background())
			verification.URL.Scheme = "https"
			verification.URL.Host = wire.request.Host
			verification.Header = make(http.Header)
			for name := range strings.SplitSeq(signedHeaders, ";") {
				if values, ok := wire.request.Header[http.CanonicalHeaderKey(name)]; ok {
					verification.Header[http.CanonicalHeaderKey(name)] = values
				}
			}
			signedAt, err := time.Parse("20060102T150405Z", wire.request.Header.Get("X-Amz-Date"))
			require.NoError(t, err)
			hash := sha256.Sum256(wire.body)
			err = v4.NewSigner().SignHTTP(context.Background(), aws.Credentials{AccessKeyID: "access-key", SecretAccessKey: "secret-key"}, verification, hex.EncodeToString(hash[:]), "bedrock-mantle", "us-east-1", signedAt)
			require.NoError(t, err)
			assert.Equal(t, authorization, verification.Header.Get("Authorization"))
		})
	}
}

func TestAWSLegacyHaikuMappingPreservesVersionAndRegion(t *testing.T) {
	for _, test := range []struct {
		name   string
		mode   dto.AwsApiType
		stream bool
		key    string
	}{
		{name: "default API key", key: "test-api-key|us-east-1"},
		{name: "default API key stream", stream: true, key: "test-api-key|us-east-1"},
		{name: "default AK/SK", key: "access-key|secret-key|us-east-1"},
		{name: "default AK/SK stream", stream: true, key: "access-key|secret-key|us-east-1"},
		{name: "explicit API key", mode: dto.AwsApiTypeInvokeModel, key: "test-api-key|us-east-1"},
		{name: "explicit API key stream", mode: dto.AwsApiTypeInvokeModel, stream: true, key: "test-api-key|us-east-1"},
		{name: "explicit AK/SK", mode: dto.AwsApiTypeInvokeModel, key: "access-key|secret-key|us-east-1"},
		{name: "explicit AK/SK stream", mode: dto.AwsApiTypeInvokeModel, stream: true, key: "access-key|secret-key|us-east-1"},
	} {
		t.Run(test.name, func(t *testing.T) {
			info := newMantleTestInfo()
			info.ChannelOtherSettings.AwsApiType = test.mode
			info.ApiKey, info.IsStream = test.key, test.stream
			info.UpstreamModelName = "claude-haiku-4-5-20251001"
			c := newAwsTestContext(httptest.NewRecorder(), context.Background())
			a := &Adaptor{}
			a.Init(info)
			response, err := a.DoRequest(c, info, strings.NewReader(`{"messages":[{"role":"user","content":"hello"}],"max_tokens":128}`))
			require.NoError(t, err)
			assert.Nil(t, response)
			const wantModel = "us.anthropic.claude-haiku-4-5-20251001-v1:0"
			if test.stream {
				request, ok := a.AwsReq.(*bedrockruntime.InvokeModelWithResponseStreamInput)
				require.True(t, ok)
				assert.Equal(t, wantModel, *request.ModelId)
			} else {
				request, ok := a.AwsReq.(*bedrockruntime.InvokeModelInput)
				require.True(t, ok)
				assert.Equal(t, wantModel, *request.ModelId)
			}
		})
	}
}

func TestMantleCanceledRequestSkipsRetry(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	c := newAwsTestContext(httptest.NewRecorder(), ctx)
	response, err := (&Adaptor{}).DoRequest(c, newMantleTestInfo(), strings.NewReader(`{"messages":[]}`))
	require.Error(t, err)
	assert.Nil(t, response)
	var apiError *relaytypes.NewAPIError
	require.ErrorAs(t, err, &apiError)
	assert.True(t, relaytypes.IsSkipRetryError(apiError))
}
