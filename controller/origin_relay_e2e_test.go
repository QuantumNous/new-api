package controller

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/origin"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type originE2EControl struct {
	mu       sync.Mutex
	rejected error
	requests []origin.AdmissionRequest
}

func (control *originE2EControl) CreateAdmission(_ context.Context, _ string, request origin.AdmissionRequest) (origin.AdmissionResult, error) {
	control.mu.Lock()
	defer control.mu.Unlock()
	control.requests = append(control.requests, request)
	if control.rejected != nil {
		return origin.AdmissionResult{}, control.rejected
	}
	return origin.AdmissionResult{
		RequestID: request.RequestID, TenantID: "01980000-0000-7000-8000-000000000003",
		ProjectID: "01980000-0000-7000-8000-000000000004", APIKeyID: "01980000-0000-7000-8000-000000000005",
		ReservationID: "01980000-0000-7000-8000-000000000006", ApprovedCatalogVersion: request.CatalogVersion,
		RouteID: "route_codex_responses_primary", ExpiresAt: "2026-08-14T05:10:00Z",
	}, nil
}

func (control *originE2EControl) FetchCatalog(context.Context, string, string) (origin.CatalogFetchResult, error) {
	return origin.CatalogFetchResult{}, errors.New("unexpected catalog fetch")
}

func (control *originE2EControl) admissionRequests() []origin.AdmissionRequest {
	control.mu.Lock()
	defer control.mu.Unlock()
	return append([]origin.AdmissionRequest(nil), control.requests...)
}

type originRoundTripFunc func(*http.Request) (*http.Response, error)

func (function originRoundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return function(request)
}

type closeFuncReadCloser struct {
	io.Reader
	close func() error
}

func (body *closeFuncReadCloser) Close() error { return body.close() }

type blockingSSEBody struct {
	reader    *strings.Reader
	closed    chan struct{}
	closeOnce sync.Once
}

func newBlockingSSEBody(payload string) *blockingSSEBody {
	return &blockingSSEBody{
		reader: strings.NewReader(payload),
		closed: make(chan struct{}),
	}
}

func (body *blockingSSEBody) Read(buffer []byte) (int, error) {
	if body.reader.Len() > 0 {
		return body.reader.Read(buffer)
	}
	<-body.closed
	return 0, io.ErrClosedPipe
}

func (body *blockingSSEBody) Close() error {
	body.closeOnce.Do(func() { close(body.closed) })
	return nil
}

type firstWriteRecorder struct {
	*httptest.ResponseRecorder
	writtenOnce sync.Once
	firstWrite  chan struct{}
}

func newFirstWriteRecorder() *firstWriteRecorder {
	return &firstWriteRecorder{
		ResponseRecorder: httptest.NewRecorder(),
		firstWrite:       make(chan struct{}),
	}
}

func (recorder *firstWriteRecorder) Write(data []byte) (int, error) {
	written, err := recorder.ResponseRecorder.Write(data)
	if written > 0 {
		recorder.writtenOnce.Do(func() { close(recorder.firstWrite) })
	}
	return written, err
}

func setupOriginE2ERouter(t *testing.T, control *originE2EControl, transport http.RoundTripper, retries int) (*gin.Engine, *model.Channel) {
	t.Helper()
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.OriginRequestAttempt{}, &model.OriginUsageOutbox{}))
	baseURL := "https://beenex.invalid"
	disableAutoBan := 0
	channel := &model.Channel{
		Id: 7, Type: constant.ChannelTypeNewAPI, Key: "server-side-beenex-key", Status: common.ChannelStatusEnabled,
		Name: "BeeNex", BaseURL: &baseURL, AutoBan: &disableAutoBan,
	}
	require.NoError(t, db.Create(channel).Error)

	raw, err := os.ReadFile("../contracts/origin/examples/catalog.execution-snapshot-published.v1.valid.json")
	require.NoError(t, err)
	var event origin.CatalogExecutionSnapshotPublishedV1
	require.NoError(t, common.Unmarshal(raw, &event))
	event.Payload.Routes[0].ApprovedChannelID = "7"
	event.Payload.ContentSHA256, err = origin.CanonicalSnapshotHash(event.Payload)
	require.NoError(t, err)
	raw, err = common.Marshal(event)
	require.NoError(t, err)
	now := time.Date(2026, 8, 14, 5, 5, 0, 0, time.UTC)
	view := origin.NewCatalogView(func() time.Time { return now })
	require.NoError(t, view.Install(raw, `"catalog-42"`))
	restoreRuntime := origin.ConfigureForTest(true, origin.NewManager(control, view, func() time.Time { return now }))
	t.Cleanup(restoreRuntime)

	service.InitHttpClient()
	client := service.GetHttpClient()
	previousTransport := client.Transport
	client.Transport = transport
	t.Cleanup(func() { client.Transport = previousTransport })

	previousRetries := common.RetryTimes
	previousCountToken := constant.CountToken
	previousStreamingTimeout := constant.StreamingTimeout
	previousSensitive := setting.CheckSensitiveEnabled
	common.RetryTimes = retries
	constant.CountToken = false
	constant.StreamingTimeout = 60
	setting.CheckSensitiveEnabled = false
	t.Cleanup(func() {
		common.RetryTimes = previousRetries
		constant.CountToken = previousCountToken
		constant.StreamingTimeout = previousStreamingTimeout
		setting.CheckSensitiveEnabled = previousSensitive
	})

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.POST("/v1/responses", middleware.TokenAuth(), middleware.Distribute(), func(c *gin.Context) {
		Relay(c, types.RelayFormatOpenAIResponses)
	})
	return router, channel
}

func originResponsesRequest(t *testing.T, body string) *http.Request {
	t.Helper()
	request := httptest.NewRequest(http.MethodPost, "/v1/responses", strings.NewReader(body))
	request.Header.Set("Authorization", "Bearer sk-oa-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcd")
	request.Header.Set("Content-Type", "application/json")
	return request
}

func TestOriginResponsesE2EPreservesUnknownFieldsToolsUsageAndMapsModelOnce(t *testing.T) {
	control := &originE2EControl{}
	var upstreamBody string
	var upstreamAuthorization string
	var upstreamCalls int
	transport := originRoundTripFunc(func(request *http.Request) (*http.Response, error) {
		upstreamCalls++
		body, err := io.ReadAll(request.Body)
		require.NoError(t, err)
		upstreamBody = string(body)
		upstreamAuthorization = request.Header.Get("Authorization")
		response := `{"id":"resp_beenex_1","object":"response","status":"completed","output":[{"type":"function_call","name":"lookup","arguments":"{\"city\":\"杭州\"}","x-output-unknown":true}],"usage":{"input_tokens":12,"output_tokens":7,"total_tokens":19,"input_tokens_details":{"cached_tokens":3},"output_tokens_details":{"reasoning_tokens":2}},"x-upstream-unknown":{"kept":true}}`
		return &http.Response{StatusCode: http.StatusOK, Header: http.Header{"Content-Type": []string{"application/json"}, "X-Request-Id": []string{"resp_beenex_1"}}, Body: io.NopCloser(strings.NewReader(response)), Request: request}, nil
	})
	router, _ := setupOriginE2ERouter(t, control, transport, 1)
	requestBody := `{"model":"origin-codex","input":[{"role":"user","content":[{"type":"input_text","text":"hello"}]}],"tools":[{"type":"function","name":"lookup","parameters":{"type":"object","x-tool-unknown":true}}],"reasoning":{"effort":"high"},"max_output_tokens":100,"x-request-unknown":{"keep":true}}`
	recorder := httptest.NewRecorder()

	router.ServeHTTP(recorder, originResponsesRequest(t, requestBody))

	assert.Equal(t, http.StatusOK, recorder.Code)
	assert.Equal(t, 1, upstreamCalls)
	assert.Equal(t, "Bearer server-side-beenex-key", upstreamAuthorization)
	assert.NotContains(t, upstreamAuthorization, "sk-oa-")
	assert.Contains(t, upstreamBody, `"model":"beenex-codex-1"`)
	assert.NotContains(t, upstreamBody, `"model":"origin-codex"`)
	assert.Contains(t, upstreamBody, `"x-tool-unknown":true`)
	assert.Contains(t, upstreamBody, `"x-request-unknown":{"keep":true}`)
	assert.Contains(t, recorder.Body.String(), `"x-upstream-unknown":{"kept":true}`)
	assert.Contains(t, recorder.Body.String(), `"arguments":"{\"city\":\"杭州\"}"`)
	admissions := control.admissionRequests()
	require.Len(t, admissions, 1)
	assert.Positive(t, admissions[0].InputTokenEstimate)

	var attempt model.OriginRequestAttempt
	require.NoError(t, model.DB.First(&attempt).Error)
	assert.Equal(t, model.OriginAttemptSucceeded, attempt.Status)
	assert.Equal(t, "beenex-codex-1", attempt.UpstreamModelID)
	var outbox model.OriginUsageOutbox
	require.NoError(t, model.DB.First(&outbox).Error)
	var usageEvent origin.MeteringUsageRecordedV2
	require.NoError(t, common.Unmarshal([]byte(outbox.Payload), &usageEvent))
	assert.Equal(t, "SETTLE", usageEvent.ReservationAction)
	assert.Equal(t, "REPORTED", usageEvent.UsageStatus)
	assert.Len(t, usageEvent.Items, 4)
}

func TestOriginResponsesFailedOutcomeSettlesReportedUsageAsFailure(t *testing.T) {
	control := &originE2EControl{}
	transport := originRoundTripFunc(func(request *http.Request) (*http.Response, error) {
		response := `{"id":"resp_failed_1","object":"response","status":"failed","error":{"code":"upstream_error","message":"request failed"},"output":[],"usage":{"input_tokens":12,"output_tokens":3,"total_tokens":15}}`
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     http.Header{"Content-Type": []string{"application/json"}, "X-Request-Id": []string{"resp_failed_1"}},
			Body:       io.NopCloser(strings.NewReader(response)),
			Request:    request,
		}, nil
	})
	router, _ := setupOriginE2ERouter(t, control, transport, 0)
	recorder := httptest.NewRecorder()

	router.ServeHTTP(recorder, originResponsesRequest(t, `{"model":"origin-codex","input":"hello"}`))

	assert.Equal(t, http.StatusOK, recorder.Code)
	var attempt model.OriginRequestAttempt
	require.NoError(t, model.DB.First(&attempt).Error)
	assert.Equal(t, model.OriginAttemptFailed, attempt.Status)
	var outbox model.OriginUsageOutbox
	require.NoError(t, model.DB.First(&outbox).Error)
	var event origin.MeteringUsageRecordedV2
	require.NoError(t, common.Unmarshal([]byte(outbox.Payload), &event))
	assert.Equal(t, "UPSTREAM_ERROR", event.TerminalStatus)
	assert.Equal(t, "SETTLE", event.ReservationAction)
	assert.Equal(t, "REPORTED", event.UsageStatus)
}

func TestOriginResponsesIncompleteOutcomeUsesLockedTerminalStatus(t *testing.T) {
	tests := []struct {
		name              string
		incompleteReason  string
		wantTerminal      string
		wantAttemptStatus string
	}{
		{
			name:              "content filter",
			incompleteReason:  "content_filter",
			wantTerminal:      "CONTENT_FILTERED_OUTPUT",
			wantAttemptStatus: model.OriginAttemptFailed,
		},
		{
			name:              "max output tokens",
			incompleteReason:  "max_output_tokens",
			wantTerminal:      "SUCCESS",
			wantAttemptStatus: model.OriginAttemptSucceeded,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			control := &originE2EControl{}
			transport := originRoundTripFunc(func(request *http.Request) (*http.Response, error) {
				response := `{"id":"resp_incomplete_1","object":"response","status":"incomplete","incomplete_details":{"reason":"` + test.incompleteReason + `"},"output":[],"usage":{"input_tokens":12,"output_tokens":3,"total_tokens":15}}`
				return &http.Response{
					StatusCode: http.StatusOK,
					Header:     http.Header{"Content-Type": []string{"application/json"}},
					Body:       io.NopCloser(strings.NewReader(response)),
					Request:    request,
				}, nil
			})
			router, _ := setupOriginE2ERouter(t, control, transport, 0)
			recorder := httptest.NewRecorder()

			router.ServeHTTP(recorder, originResponsesRequest(t, `{"model":"origin-codex","input":"hello"}`))

			assert.Equal(t, http.StatusOK, recorder.Code)
			var attempt model.OriginRequestAttempt
			require.NoError(t, model.DB.First(&attempt).Error)
			assert.Equal(t, test.wantAttemptStatus, attempt.Status)
			var outbox model.OriginUsageOutbox
			require.NoError(t, model.DB.First(&outbox).Error)
			var event origin.MeteringUsageRecordedV2
			require.NoError(t, common.Unmarshal([]byte(outbox.Payload), &event))
			assert.Equal(t, test.wantTerminal, event.TerminalStatus)
			assert.Equal(t, "SETTLE", event.ReservationAction)
			assert.Equal(t, "REPORTED", event.UsageStatus)
		})
	}
}

func TestOriginAdmissionRejectionNeverContactsBeeNex(t *testing.T) {
	tests := []struct {
		name       string
		rejection  error
		wantStatus int
	}{
		{name: "origin_key_disabled", rejection: &origin.ControlError{Status: http.StatusForbidden, Code: "origin_key_disabled"}, wantStatus: http.StatusForbidden},
		{name: "origin_key_expired", rejection: &origin.ControlError{Status: http.StatusForbidden, Code: "origin_key_expired"}, wantStatus: http.StatusForbidden},
		{name: "origin_key_project_mismatch", rejection: &origin.ControlError{Status: http.StatusForbidden, Code: "origin_key_project_mismatch"}, wantStatus: http.StatusForbidden},
		{name: "platform_timeout", rejection: origin.ErrPlatformUnavailable, wantStatus: http.StatusServiceUnavailable},
		{name: "untrusted_platform_response", rejection: origin.ErrUntrustedPlatformResponse, wantStatus: http.StatusServiceUnavailable},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			control := &originE2EControl{rejected: test.rejection}
			upstreamCalls := 0
			transport := originRoundTripFunc(func(request *http.Request) (*http.Response, error) {
				upstreamCalls++
				return nil, errors.New("must not be called")
			})
			router, _ := setupOriginE2ERouter(t, control, transport, 1)
			recorder := httptest.NewRecorder()

			router.ServeHTTP(recorder, originResponsesRequest(t, `{"model":"origin-codex","input":"hello"}`))

			assert.Equal(t, test.wantStatus, recorder.Code)
			assert.Zero(t, upstreamCalls)
			require.Len(t, control.admissionRequests(), 1)
			var attempts int64
			require.NoError(t, model.DB.Model(&model.OriginRequestAttempt{}).Count(&attempts).Error)
			assert.Zero(t, attempts)
		})
	}
}

func TestOriginInsecureApprovedChannelNeverContactsBeeNex(t *testing.T) {
	control := &originE2EControl{}
	upstreamCalls := 0
	transport := originRoundTripFunc(func(request *http.Request) (*http.Response, error) {
		upstreamCalls++
		return nil, errors.New("must not be called")
	})
	router, channel := setupOriginE2ERouter(t, control, transport, 1)
	require.NoError(t, model.DB.Model(channel).Update("base_url", "http://beenex.invalid").Error)
	recorder := httptest.NewRecorder()

	router.ServeHTTP(recorder, originResponsesRequest(t, `{"model":"origin-codex","input":"hello"}`))

	assert.Equal(t, http.StatusServiceUnavailable, recorder.Code)
	assert.Zero(t, upstreamCalls)
	require.Len(t, control.admissionRequests(), 1)
	var attempts int64
	require.NoError(t, model.DB.Model(&model.OriginRequestAttempt{}).Count(&attempts).Error)
	assert.Zero(t, attempts)
}

func TestOriginRetryUsesOneAdmissionAndSameReservation(t *testing.T) {
	control := &originE2EControl{}
	upstreamCalls := 0
	transport := originRoundTripFunc(func(request *http.Request) (*http.Response, error) {
		upstreamCalls++
		if upstreamCalls == 1 {
			return nil, errors.New("connection reset before response")
		}
		response := `{"id":"resp_retry","object":"response","status":"completed","output":[],"usage":{"input_tokens":1,"output_tokens":1,"total_tokens":2}}`
		return &http.Response{StatusCode: http.StatusOK, Header: http.Header{"Content-Type": []string{"application/json"}}, Body: io.NopCloser(strings.NewReader(response)), Request: request}, nil
	})
	router, _ := setupOriginE2ERouter(t, control, transport, 1)
	recorder := httptest.NewRecorder()

	router.ServeHTTP(recorder, originResponsesRequest(t, `{"model":"origin-codex","input":"hello"}`))

	assert.Equal(t, http.StatusOK, recorder.Code)
	assert.Equal(t, 2, upstreamCalls)
	requests := control.admissionRequests()
	require.Len(t, requests, 1)
	var attempts []model.OriginRequestAttempt
	require.NoError(t, model.DB.Order("attempt_number ASC").Find(&attempts).Error)
	require.Len(t, attempts, 2)
	assert.Equal(t, attempts[0].RequestID, attempts[1].RequestID)
	assert.Equal(t, attempts[0].ReservationID, attempts[1].ReservationID)
	assert.Equal(t, "01980000-0000-7000-8000-000000000006", attempts[1].ReservationID)
}

func TestOriginDoesNotCorruptDeliveredResponseWhenOutcomePersistenceFails(t *testing.T) {
	control := &originE2EControl{}
	responseBody := `{"id":"resp_delivered","object":"response","status":"completed","output":[],"usage":{"input_tokens":1,"output_tokens":1,"total_tokens":2}}`
	transport := originRoundTripFunc(func(request *http.Request) (*http.Response, error) {
		sqlDB, err := model.DB.DB()
		require.NoError(t, err)
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     http.Header{"Content-Type": []string{"application/json"}},
			Body: &closeFuncReadCloser{Reader: strings.NewReader(responseBody), close: func() error {
				return sqlDB.Close()
			}},
			Request: request,
		}, nil
	})
	router, _ := setupOriginE2ERouter(t, control, transport, 0)
	recorder := httptest.NewRecorder()

	router.ServeHTTP(recorder, originResponsesRequest(t, `{"model":"origin-codex","input":"hello"}`))

	assert.Equal(t, http.StatusOK, recorder.Code)
	assert.JSONEq(t, responseBody, recorder.Body.String())
	assert.NotContains(t, recorder.Body.String(), `"error"`)
}

func TestOriginSSEPreservesReasoningFunctionToolsUnknownFieldsAndUsage(t *testing.T) {
	control := &originE2EControl{}
	transport := originRoundTripFunc(func(request *http.Request) (*http.Response, error) {
		stream := "data: {\"type\":\"response.reasoning_summary_text.delta\",\"delta\":\"think\",\"x-event-unknown\":true}\n\n" +
			"data: {\"type\":\"response.output_item.done\",\"item\":{\"type\":\"function_call\",\"name\":\"lookup\",\"arguments\":\"{\\\"city\\\":\\\"杭州\\\"}\"}}\n\n" +
			"data: {\"type\":\"response.completed\",\"response\":{\"id\":\"resp_stream\",\"status\":\"completed\",\"output\":[],\"usage\":{\"input_tokens\":9,\"output_tokens\":5,\"total_tokens\":14,\"output_tokens_details\":{\"reasoning_tokens\":4}}}}\n\n" +
			"data: [DONE]\n\n"
		return &http.Response{StatusCode: http.StatusOK, Header: http.Header{"Content-Type": []string{"text/event-stream"}}, Body: io.NopCloser(strings.NewReader(stream)), Request: request}, nil
	})
	router, _ := setupOriginE2ERouter(t, control, transport, 1)
	recorder := httptest.NewRecorder()

	router.ServeHTTP(recorder, originResponsesRequest(t, `{"model":"origin-codex","input":"hello","stream":true,"tools":[{"type":"function","name":"lookup"}],"reasoning":{"effort":"high"}}`))

	assert.Equal(t, http.StatusOK, recorder.Code)
	assert.Contains(t, recorder.Body.String(), `"type":"response.reasoning_summary_text.delta"`)
	assert.Contains(t, recorder.Body.String(), `"x-event-unknown":true`)
	assert.Contains(t, recorder.Body.String(), `"arguments":"{\"city\":\"杭州\"}"`)
	var outbox model.OriginUsageOutbox
	require.NoError(t, model.DB.First(&outbox).Error)
	var event origin.MeteringUsageRecordedV2
	require.NoError(t, common.Unmarshal([]byte(outbox.Payload), &event))
	assert.Equal(t, "SETTLE", event.ReservationAction)
	assert.Equal(t, "responses_stream", event.Operation)
}

func TestOriginSSEFailedOutcomeSettlesReportedUsageAsFailure(t *testing.T) {
	control := &originE2EControl{}
	transport := originRoundTripFunc(func(request *http.Request) (*http.Response, error) {
		stream := "data: {\"type\":\"response.failed\",\"response\":{\"id\":\"resp_stream_failed\",\"status\":\"failed\",\"output\":[],\"usage\":{\"input_tokens\":9,\"output_tokens\":2,\"total_tokens\":11}}}\n\n" +
			"data: [DONE]\n\n"
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
			Body:       io.NopCloser(strings.NewReader(stream)),
			Request:    request,
		}, nil
	})
	router, _ := setupOriginE2ERouter(t, control, transport, 0)
	recorder := httptest.NewRecorder()

	router.ServeHTTP(recorder, originResponsesRequest(t, `{"model":"origin-codex","input":"hello","stream":true}`))

	assert.Equal(t, http.StatusOK, recorder.Code)
	assert.Contains(t, recorder.Body.String(), `"type":"response.failed"`)
	var attempt model.OriginRequestAttempt
	require.NoError(t, model.DB.First(&attempt).Error)
	assert.Equal(t, model.OriginAttemptFailed, attempt.Status)
	var outbox model.OriginUsageOutbox
	require.NoError(t, model.DB.First(&outbox).Error)
	var event origin.MeteringUsageRecordedV2
	require.NoError(t, common.Unmarshal([]byte(outbox.Payload), &event))
	assert.Equal(t, "UPSTREAM_ERROR", event.TerminalStatus)
	assert.Equal(t, "SETTLE", event.ReservationAction)
	assert.Equal(t, "responses_stream", event.Operation)
}

func TestOriginSSEIncompleteContentFilterUsesLockedTerminalStatus(t *testing.T) {
	control := &originE2EControl{}
	transport := originRoundTripFunc(func(request *http.Request) (*http.Response, error) {
		stream := "data: {\"type\":\"response.incomplete\",\"response\":{\"id\":\"resp_stream_filtered\",\"status\":\"incomplete\",\"incomplete_details\":{\"reason\":\"content_filter\"},\"output\":[],\"usage\":{\"input_tokens\":9,\"output_tokens\":2,\"total_tokens\":11}}}\n\n" +
			"data: [DONE]\n\n"
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
			Body:       io.NopCloser(strings.NewReader(stream)),
			Request:    request,
		}, nil
	})
	router, _ := setupOriginE2ERouter(t, control, transport, 0)
	recorder := httptest.NewRecorder()

	router.ServeHTTP(recorder, originResponsesRequest(t, `{"model":"origin-codex","input":"hello","stream":true}`))

	assert.Equal(t, http.StatusOK, recorder.Code)
	assert.Contains(t, recorder.Body.String(), `"type":"response.incomplete"`)
	var attempt model.OriginRequestAttempt
	require.NoError(t, model.DB.First(&attempt).Error)
	assert.Equal(t, model.OriginAttemptFailed, attempt.Status)
	var outbox model.OriginUsageOutbox
	require.NoError(t, model.DB.First(&outbox).Error)
	var event origin.MeteringUsageRecordedV2
	require.NoError(t, common.Unmarshal([]byte(outbox.Payload), &event))
	assert.Equal(t, "CONTENT_FILTERED_OUTPUT", event.TerminalStatus)
	assert.Equal(t, "SETTLE", event.ReservationAction)
	assert.Equal(t, "REPORTED", event.UsageStatus)
	assert.Equal(t, "responses_stream", event.Operation)
}

func TestOriginSSEOnlyRetriesBeforeFirstClientVisibleEvent(t *testing.T) {
	t.Run("empty first stream retries", func(t *testing.T) {
		control := &originE2EControl{}
		upstreamCalls := 0
		transport := originRoundTripFunc(func(request *http.Request) (*http.Response, error) {
			upstreamCalls++
			stream := ""
			if upstreamCalls == 2 {
				stream = "data: {\"type\":\"response.completed\",\"response\":{\"id\":\"resp_second\",\"status\":\"completed\",\"output\":[],\"usage\":{\"input_tokens\":1,\"output_tokens\":1,\"total_tokens\":2}}}\n\ndata: [DONE]\n\n"
			}
			return &http.Response{StatusCode: http.StatusOK, Header: http.Header{"Content-Type": []string{"text/event-stream"}}, Body: io.NopCloser(strings.NewReader(stream)), Request: request}, nil
		})
		router, _ := setupOriginE2ERouter(t, control, transport, 1)
		recorder := httptest.NewRecorder()

		router.ServeHTTP(recorder, originResponsesRequest(t, `{"model":"origin-codex","input":"hello","stream":true}`))

		assert.Equal(t, http.StatusOK, recorder.Code)
		assert.Equal(t, 2, upstreamCalls)
		require.Len(t, control.admissionRequests(), 1)
	})

	t.Run("visible event forbids replay", func(t *testing.T) {
		control := &originE2EControl{}
		upstreamCalls := 0
		transport := originRoundTripFunc(func(request *http.Request) (*http.Response, error) {
			upstreamCalls++
			stream := "data: {\"type\":\"response.output_text.delta\",\"delta\":\"partial\"}\n\n"
			return &http.Response{StatusCode: http.StatusOK, Header: http.Header{"Content-Type": []string{"text/event-stream"}}, Body: io.NopCloser(strings.NewReader(stream)), Request: request}, nil
		})
		router, _ := setupOriginE2ERouter(t, control, transport, 1)
		recorder := httptest.NewRecorder()

		router.ServeHTTP(recorder, originResponsesRequest(t, `{"model":"origin-codex","input":"hello","stream":true}`))

		assert.Equal(t, http.StatusOK, recorder.Code)
		assert.Equal(t, 1, upstreamCalls)
		assert.Contains(t, recorder.Body.String(), "partial")
		var attempt model.OriginRequestAttempt
		require.NoError(t, model.DB.First(&attempt).Error)
		assert.Equal(t, model.OriginAttemptReconciliation, attempt.Status)
	})
}

func TestOriginSSEClientDisconnectPersistsUsageOutcome(t *testing.T) {
	tests := []struct {
		name                  string
		stream                string
		wantAttemptStatus     string
		wantReservationAction string
		wantUsageStatus       string
		wantContactState      string
		wantReconcileReason   string
	}{
		{
			name:                  "reported usage settles reservation",
			stream:                "data: {\"type\":\"response.completed\",\"response\":{\"id\":\"resp_disconnected_with_usage\",\"status\":\"completed\",\"output\":[],\"usage\":{\"input_tokens\":9,\"output_tokens\":5,\"total_tokens\":14}}}\n\n",
			wantAttemptStatus:     model.OriginAttemptDisconnected,
			wantReservationAction: "SETTLE",
			wantUsageStatus:       "REPORTED",
			wantContactState:      model.OriginContactCompleted,
		},
		{
			name:                  "missing usage enters reconciliation",
			stream:                "data: {\"type\":\"response.output_text.delta\",\"delta\":\"partial\"}\n\n",
			wantAttemptStatus:     model.OriginAttemptReconciliation,
			wantReservationAction: "RECONCILE",
			wantUsageStatus:       "MISSING",
			wantContactState:      model.OriginContactContacted,
			wantReconcileReason:   "CLIENT_DISCONNECTED",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			control := &originE2EControl{}
			var upstreamBody *blockingSSEBody
			transport := originRoundTripFunc(func(request *http.Request) (*http.Response, error) {
				upstreamBody = newBlockingSSEBody(test.stream)
				return &http.Response{
					StatusCode: http.StatusOK,
					Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
					Body:       upstreamBody,
					Request:    request,
				}, nil
			})
			router, _ := setupOriginE2ERouter(t, control, transport, 1)
			recorder := newFirstWriteRecorder()
			requestContext, cancelRequest := context.WithCancel(context.Background())
			request := originResponsesRequest(t, `{"model":"origin-codex","input":"hello","stream":true}`).WithContext(requestContext)
			requestDone := make(chan struct{})
			go func() {
				defer close(requestDone)
				router.ServeHTTP(recorder, request)
			}()

			select {
			case <-recorder.firstWrite:
				cancelRequest()
			case <-time.After(5 * time.Second):
				cancelRequest()
				require.FailNow(t, "timed out waiting for the first client-visible SSE event")
			}
			select {
			case <-requestDone:
			case <-time.After(5 * time.Second):
				require.FailNow(t, "Origin relay did not stop after client disconnect")
			}

			require.NotNil(t, upstreamBody)
			select {
			case <-upstreamBody.closed:
			default:
				require.FailNow(t, "upstream response body was not closed after client disconnect")
			}
			var attempt model.OriginRequestAttempt
			require.NoError(t, model.DB.First(&attempt).Error)
			assert.Equal(t, test.wantAttemptStatus, attempt.Status)
			var outbox model.OriginUsageOutbox
			require.NoError(t, model.DB.First(&outbox).Error)
			var event origin.MeteringUsageRecordedV2
			require.NoError(t, common.Unmarshal([]byte(outbox.Payload), &event))
			assert.Equal(t, "CLIENT_DISCONNECTED", event.TerminalStatus)
			assert.Equal(t, test.wantReservationAction, event.ReservationAction)
			assert.Equal(t, test.wantUsageStatus, event.UsageStatus)
			assert.Equal(t, test.wantContactState, event.Upstream.ContactState)
			if test.wantReconcileReason == "" {
				assert.Equal(t, "NOT_REQUIRED", event.Reconciliation.Status)
				assert.Nil(t, event.Reconciliation.Reason)
			} else {
				assert.Equal(t, "REQUIRED", event.Reconciliation.Status)
				require.NotNil(t, event.Reconciliation.Reason)
				assert.Equal(t, test.wantReconcileReason, *event.Reconciliation.Reason)
			}
		})
	}
}
