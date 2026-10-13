package mocks

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"sync/atomic"
	"time"

	"smart-router/api"
	"smart-router/routing"
	"smart-router/signing"
)

type Provider struct {
	server           *httptest.Server
	status           int
	retryAfterHeader string
	calls            atomic.Int64
}

func NewProvider(status int, retryAfterMS int64) *Provider {
	retryAfterHeader := ""
	if retryAfterMS > 0 {
		retryAfterHeader = strconv.FormatInt(retryAfterMS, 10)
	}
	return NewProviderWithRetryAfterHeader(status, retryAfterHeader)
}

func NewProviderWithRetryAfterHeader(status int, retryAfterHeader string) *Provider {
	provider := &Provider{status: status, retryAfterHeader: retryAfterHeader}
	provider.server = httptest.NewServer(http.HandlerFunc(
		func(writer http.ResponseWriter, request *http.Request) {
			if request.Method != http.MethodPost {
				writer.WriteHeader(http.StatusMethodNotAllowed)
				return
			}
			provider.calls.Add(1)
			if provider.retryAfterHeader != "" {
				writer.Header().Set("Retry-After-Ms", provider.retryAfterHeader)
			}
			writer.WriteHeader(provider.status)
		},
	))
	return provider
}

func (provider *Provider) Close() {
	provider.server.Close()
}

func (provider *Provider) Calls() int64 {
	return provider.calls.Load()
}

func (provider *Provider) invoke(ctx context.Context) (int, int64, error) {
	request, err := http.NewRequestWithContext(
		ctx, http.MethodPost, provider.server.URL+"/invoke", nil,
	)
	if err != nil {
		return 0, 0, err
	}
	response, err := provider.server.Client().Do(request)
	if err != nil {
		return 0, 0, err
	}
	_ = response.Body.Close()
	retryAfterHeader := response.Header.Get("Retry-After-Ms")
	if retryAfterHeader == "" {
		return response.StatusCode, 0, nil
	}
	retryAfterMS, err := strconv.ParseInt(retryAfterHeader, 10, 64)
	if err != nil {
		return 0, 0, fmt.Errorf("parse Retry-After-Ms: %w", err)
	}
	return response.StatusCode, retryAfterMS, nil
}

type Host struct {
	RouterURL  string
	SigningKey []byte
	Providers  map[string]*Provider
	Client     *http.Client
	Clock      Clock
}

type Execution struct {
	Attempts    []string
	AttemptedAt []time.Time
	DelaysMS    []int64
}

type Clock interface {
	Now() time.Time
	Sleep(context.Context, time.Duration) error
}

type realClock struct{}

func (realClock) Now() time.Time {
	return time.Now()
}

func (realClock) Sleep(ctx context.Context, delay time.Duration) error {
	timer := time.NewTimer(delay)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}

func (host Host) Execute(ctx context.Context, request api.RouteRequest) (Execution, error) {
	response, err := host.route(ctx, request)
	if err != nil {
		return Execution{}, err
	}
	if err := signing.Verify(response, host.SigningKey, response.Signature); err != nil {
		return Execution{}, fmt.Errorf("verify route response: %w", err)
	}

	clock := host.Clock
	if clock == nil {
		clock = realClock{}
	}
	execution := Execution{}
	for index, binding := range response.Bindings {
		if response.ExpiresAt <= clock.Now().UnixMilli() {
			return execution, errors.New("route response is expired")
		}
		provider := host.Providers[binding.BindingID]
		if provider == nil {
			return execution, fmt.Errorf("no mock provider for opaque binding %q", binding.BindingID)
		}
		execution.AttemptedAt = append(execution.AttemptedAt, clock.Now())
		status, retryAfterMS, err := provider.invoke(ctx)
		if err != nil {
			return execution, err
		}
		execution.Attempts = append(execution.Attempts, binding.BindingID)
		outcome := statusOutcome(status)
		attemptOutcome := api.AttemptOutcome{
			Kind: "attempt_outcome", SchemaVersion: 1,
			EventID:   request.RequestID + "-" + strconv.Itoa(index+1),
			RequestID: request.RequestID, BindingID: binding.BindingID,
			Protocol: request.Protocol, Outcome: outcome, RetryAfterMS: retryAfterMS,
		}
		if err := attemptOutcome.Validate(); err != nil {
			return execution, fmt.Errorf("validate provider outcome: %w", err)
		}
		if err := host.report(ctx, attemptOutcome); err != nil {
			return execution, err
		}
		if outcome == api.OutcomeSuccess {
			return execution, nil
		}
		action := routing.NextAction(outcome, len(response.Bindings)-index-1, retryAfterMS)
		if action.Kind == routing.ActionRetryAfter {
			execution.DelaysMS = append(execution.DelaysMS, action.Delay.Milliseconds())
			if err := clock.Sleep(ctx, action.Delay); err != nil {
				return execution, err
			}
		}
		if !action.Retry {
			return execution, errors.New("provider attempt stopped by routing policy")
		}
	}
	return execution, errors.New("all mock provider attempts failed")
}

func (host Host) route(ctx context.Context, request api.RouteRequest) (api.RouteResponse, error) {
	var response api.RouteResponse
	status, err := host.postJSON(ctx, "/v1/route", request, &response)
	if err != nil {
		return response, err
	}
	if status != http.StatusOK {
		return response, fmt.Errorf("route status %d", status)
	}
	if err := response.Validate(); err != nil {
		return response, err
	}
	return response, nil
}

func (host Host) report(ctx context.Context, outcome api.AttemptOutcome) error {
	status, err := host.postJSON(ctx, "/v1/outcomes", outcome, nil)
	if err != nil {
		return err
	}
	if status != http.StatusNoContent {
		return fmt.Errorf("outcome status %d", status)
	}
	return nil
}

func (host Host) postJSON(ctx context.Context, path string, value any, destination any) (int, error) {
	payload, err := json.Marshal(value)
	if err != nil {
		return 0, err
	}
	request, err := http.NewRequestWithContext(
		ctx, http.MethodPost, host.RouterURL+path, bytes.NewReader(payload),
	)
	if err != nil {
		return 0, err
	}
	request.Header.Set("Content-Type", "application/json")
	client := host.Client
	if client == nil {
		client = http.DefaultClient
	}
	response, err := client.Do(request)
	if err != nil {
		return 0, err
	}
	defer response.Body.Close()
	if destination != nil && response.StatusCode >= 200 && response.StatusCode < 300 {
		if err := json.NewDecoder(response.Body).Decode(destination); err != nil {
			return response.StatusCode, err
		}
	} else {
		_, _ = io.Copy(io.Discard, io.LimitReader(response.Body, 4096))
	}
	return response.StatusCode, nil
}

func statusOutcome(status int) api.Outcome {
	switch {
	case status >= 200 && status < 300:
		return api.OutcomeSuccess
	case status == http.StatusUnauthorized:
		return api.OutcomeAuth401
	case status == http.StatusTooManyRequests:
		return api.OutcomeRateLimited429
	case status >= 500:
		return api.OutcomeUpstream5xx
	default:
		return api.OutcomeClient4xx
	}
}
