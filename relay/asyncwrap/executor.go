package asyncwrap

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
)

type synchronousImageRequest struct {
	endpoint string
	payload  []byte
	parse    func([]byte) service.AsyncExecutionOutcome
}

type synchronousImageRequestPreparer func(dto.ImageRequest, []byte) (synchronousImageRequest, error)

func newSynchronousImageHTTPClient(timeout time.Duration) *http.Client {
	if timeout <= 0 {
		timeout = 30 * time.Minute
	}
	transport := &http.Transport{
		Proxy:                 http.ProxyFromEnvironment,
		ForceAttemptHTTP2:     true,
		DialContext:           (&net.Dialer{Timeout: 10 * time.Second, KeepAlive: 30 * time.Second}).DialContext,
		TLSHandshakeTimeout:   10 * time.Second,
		ResponseHeaderTimeout: minDuration(60*time.Second, timeout),
		ExpectContinueTimeout: 2 * time.Second,
		IdleConnTimeout:       90 * time.Second,
		MaxIdleConns:          100,
		MaxIdleConnsPerHost:   50,
	}
	return &http.Client{
		Transport: transport,
		Timeout:   timeout,
		CheckRedirect: func(*http.Request, []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
}

func executeSynchronousImage(
	ctx context.Context,
	provider string,
	client *http.Client,
	apiKey string,
	payload []byte,
	markRequestSent func() error,
	prepare synchronousImageRequestPreparer,
) service.AsyncExecutionOutcome {
	if client == nil || prepare == nil {
		return executorFailure("executor", "executor_unavailable", provider+" executor is unavailable", true)
	}
	var imageRequest dto.ImageRequest
	if err := common.Unmarshal(payload, &imageRequest); err != nil || imageRequest.Model == "" {
		return executorFailure("request_validate", "invalid_stored_request", "stored async image request is invalid", true)
	}
	prepared, err := prepare(imageRequest, payload)
	if err != nil {
		return executorFailure("request_validate", "invalid_stored_request", err.Error(), true)
	}
	if prepared.endpoint == "" || prepared.parse == nil {
		return executorFailure("executor", "executor_unavailable", provider+" executor did not prepare a valid synchronous request", true)
	}

	var markOnce sync.Once
	var markErr error
	mark := func() error {
		markOnce.Do(func() {
			if markRequestSent != nil {
				markErr = markRequestSent()
			}
		})
		return markErr
	}

	const maxAttempts = 3
	for attempt := 1; attempt <= maxAttempts; attempt++ {
		tracker := &sentTrackingReader{reader: bytes.NewReader(prepared.payload), mark: mark}
		request, err := http.NewRequestWithContext(ctx, http.MethodPost, prepared.endpoint, tracker)
		if err != nil {
			return executorFailure("request_build", "request_build_failed", "failed to construct "+provider+" request", true)
		}
		request.ContentLength = int64(len(prepared.payload))
		request.Header.Set("Authorization", "Bearer "+apiKey)
		request.Header.Set("Content-Type", "application/json")
		request.Header.Set("Accept", "application/json")
		request.Header.Set("User-Agent", "new-api-async-image-worker/1")

		response, requestErr := client.Do(request)
		if requestErr != nil {
			if tracker.sent {
				return service.AsyncExecutionOutcome{
					Status:       model.AsyncStatusUncertain,
					ErrorPhase:   "upstream_read",
					ErrorCode:    "upstream_result_uncertain",
					ErrorMessage: "the " + provider + " request may have executed but its result could not be confirmed",
				}
			}
			if attempt < maxAttempts && ctx.Err() == nil {
				if !waitRetry(ctx, time.Duration(attempt)*200*time.Millisecond) {
					return executorFailure("upstream_connect", "upstream_connect_cancelled", provider+" connection attempt was cancelled before sending", true)
				}
				continue
			}
			return executorFailure("upstream_connect", "upstream_connect_failed", "failed to connect to "+provider+" before sending the request body", true)
		}

		if response.StatusCode == http.StatusTooManyRequests {
			_, _ = io.Copy(io.Discard, io.LimitReader(response.Body, 64*1024))
			_ = response.Body.Close()
			if attempt < maxAttempts {
				delay := service.ParseRetryAfter(response.Header.Get("Retry-After"), 30*time.Second)
				if delay == 0 {
					delay = time.Duration(attempt) * time.Second
				}
				if waitRetry(ctx, delay) {
					continue
				}
			}
			return executorFailure("upstream_response", "upstream_rate_limited", provider+" rate limit retry budget was exhausted", true)
		}
		if response.StatusCode < 200 || response.StatusCode >= 300 {
			_, _ = io.Copy(io.Discard, io.LimitReader(response.Body, 64*1024))
			_ = response.Body.Close()
			return executorFailure(
				"upstream_response",
				"upstream_http_"+strconv.Itoa(response.StatusCode),
				fmt.Sprintf("%s returned HTTP %d", provider, response.StatusCode),
				synchronousImageRefundEligibleStatus(response.StatusCode),
			)
		}

		maxResponseBytes := int64(common.GetEnvOrDefault("ASYNC_UPSTREAM_MAX_RESPONSE_MB", 64)) * 1024 * 1024
		if maxResponseBytes <= 0 {
			maxResponseBytes = 64 * 1024 * 1024
		}
		body, readErr := io.ReadAll(io.LimitReader(response.Body, maxResponseBytes+1))
		_ = response.Body.Close()
		if readErr != nil {
			return service.AsyncExecutionOutcome{Status: model.AsyncStatusUncertain, ErrorPhase: "upstream_read", ErrorCode: "upstream_result_uncertain", ErrorMessage: provider + " returned an incomplete response after accepting the request"}
		}
		if int64(len(body)) > maxResponseBytes {
			return executorFailure("upstream_parse", "upstream_response_too_large", provider+" response exceeded the configured safety limit", false)
		}
		outcome := prepared.parse(body)
		outcome.Payload = json.RawMessage(body)
		if outcome.Status == "" {
			return executorFailure("upstream_parse", "invalid_upstream_response", provider+" returned an invalid response state", false)
		}
		return outcome
	}
	return executorFailure("upstream_connect", "upstream_connect_failed", "failed to connect to "+provider, true)
}

func synchronousImageRefundEligibleStatus(status int) bool {
	switch status {
	case http.StatusBadRequest,
		http.StatusUnauthorized,
		http.StatusPaymentRequired,
		http.StatusForbidden,
		http.StatusNotFound,
		http.StatusMethodNotAllowed,
		http.StatusRequestEntityTooLarge,
		http.StatusUnsupportedMediaType,
		http.StatusUnprocessableEntity:
		return true
	default:
		return false
	}
}

type sentTrackingReader struct {
	reader io.Reader
	mark   func() error
	sent   bool
}

func (r *sentTrackingReader) Read(buffer []byte) (int, error) {
	if !r.sent {
		if r.mark != nil {
			if err := r.mark(); err != nil {
				return 0, err
			}
		}
		r.sent = true
	}
	return r.reader.Read(buffer)
}

func executorFailure(phase, code, message string, refundable bool) service.AsyncExecutionOutcome {
	return service.AsyncExecutionOutcome{
		Status:         model.AsyncStatusFailure,
		ErrorPhase:     phase,
		ErrorCode:      code,
		ErrorMessage:   message,
		RefundEligible: refundable,
	}
}

func waitRetry(ctx context.Context, delay time.Duration) bool {
	timer := time.NewTimer(delay)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return false
	case <-timer.C:
		return true
	}
}

func minDuration(first, second time.Duration) time.Duration {
	if first < second {
		return first
	}
	return second
}
