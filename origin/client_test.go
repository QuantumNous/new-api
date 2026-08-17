package origin

import (
	"context"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (fn roundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return fn(request)
}

func TestControlClientSendsCompleteOriginKeyOnlyInAuthorization(t *testing.T) {
	const originKey = "sk-oa-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcd"
	transport := roundTripFunc(func(request *http.Request) (*http.Response, error) {
		body, err := io.ReadAll(request.Body)
		require.NoError(t, err)
		assert.Equal(t, "Bearer "+originKey, request.Header.Get("Authorization"))
		assert.Equal(t, "01980000-0000-7000-8000-000000000002", request.Header.Get("Idempotency-Key"))
		assert.NotContains(t, string(body), originKey)
		assert.NotContains(t, string(body), "prompt")
		assert.NotContains(t, string(body), "tool_arguments")
		return &http.Response{
			StatusCode: http.StatusOK,
			Header: http.Header{
				"Content-Type": []string{"application/json"},
				"X-Request-Id": []string{"01980000-0000-7000-8000-000000000002"},
			},
			Body: io.NopCloser(strings.NewReader(`{
				"request_id":"01980000-0000-7000-8000-000000000002",
				"tenant_id":"01980000-0000-7000-8000-000000000003",
				"project_id":"01980000-0000-7000-8000-000000000004",
				"api_key_id":"01980000-0000-7000-8000-000000000005",
				"reservation_id":"01980000-0000-7000-8000-000000000006",
				"approved_catalog_version":42,
				"route_id":"route_codex_responses_primary",
				"expires_at":"2026-08-14T05:10:00Z"
			}`)),
		}, nil
	})
	client := NewControlClient("https://platform.internal", &http.Client{Transport: transport}, time.Second)
	request := AdmissionRequest{
		RequestID:             "01980000-0000-7000-8000-000000000002",
		PlatformModel:         "origin-codex",
		Operation:             "responses",
		CatalogVersion:        42,
		InputTokenEstimate:    1200,
		MaxOutputTokens:       4096,
		Stream:                true,
		RequestedCapabilities: []string{"streaming", "function_tools", "reasoning"},
	}

	result, err := client.CreateAdmission(context.Background(), originKey, request)

	require.NoError(t, err)
	assert.Equal(t, "01980000-0000-7000-8000-000000000006", result.ReservationID)
}

func TestControlClientListsOriginModelsWithoutRequestBody(t *testing.T) {
	const originKey = "sk-oa-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcd"
	const requestID = "01980000-0000-7000-8000-000000000030"
	transport := roundTripFunc(func(request *http.Request) (*http.Response, error) {
		assert.Equal(t, http.MethodGet, request.Method)
		assert.Equal(t, "/internal/v1/models", request.URL.Path)
		assert.Equal(t, "Bearer "+originKey, request.Header.Get("Authorization"))
		assert.Equal(t, requestID, request.Header.Get("X-Request-Id"))
		assert.Empty(t, request.Header.Get("Idempotency-Key"))
		assert.Nil(t, request.Body)
		return &http.Response{
			StatusCode: http.StatusOK,
			Header: http.Header{
				"Content-Type":      []string{"application/json"},
				"X-Request-Id":      []string{requestID},
				"X-Catalog-Version": []string{"42"},
			},
			Body: io.NopCloser(strings.NewReader(`{
				"request_id":"01980000-0000-7000-8000-000000000030",
				"tenant_id":"01980000-0000-7000-8000-000000000003",
				"project_id":"01980000-0000-7000-8000-000000000004",
				"api_key_id":"01980000-0000-7000-8000-000000000005",
				"catalog_version":42,
				"models":["origin-agent"]
			}`)),
		}, nil
	})
	client := NewControlClient("https://platform.internal", &http.Client{Transport: transport}, time.Second)

	result, err := client.ListOriginModels(context.Background(), originKey, requestID)

	require.NoError(t, err)
	assert.Equal(t, []string{"origin-agent"}, result.Models)
}

func TestControlClientRejectsUntrustedOriginModelLists(t *testing.T) {
	const requestID = "01980000-0000-7000-8000-000000000030"
	tests := []struct {
		name string
		body string
	}{
		{name: "duplicate model", body: `{"request_id":"01980000-0000-7000-8000-000000000030","tenant_id":"01980000-0000-7000-8000-000000000003","project_id":"01980000-0000-7000-8000-000000000004","api_key_id":"01980000-0000-7000-8000-000000000005","catalog_version":42,"models":["origin-agent","origin-agent"]}`},
		{name: "upstream model", body: `{"request_id":"01980000-0000-7000-8000-000000000030","tenant_id":"01980000-0000-7000-8000-000000000003","project_id":"01980000-0000-7000-8000-000000000004","api_key_id":"01980000-0000-7000-8000-000000000005","catalog_version":42,"models":["beenex/deepseek-v4-flash"]}`},
		{name: "unknown field", body: `{"request_id":"01980000-0000-7000-8000-000000000030","tenant_id":"01980000-0000-7000-8000-000000000003","project_id":"01980000-0000-7000-8000-000000000004","api_key_id":"01980000-0000-7000-8000-000000000005","catalog_version":42,"models":["origin-agent"],"provider":"beenex"}`},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			transport := roundTripFunc(func(request *http.Request) (*http.Response, error) {
				return &http.Response{
					StatusCode: http.StatusOK,
					Header: http.Header{
						"Content-Type":      []string{"application/json"},
						"X-Request-Id":      []string{requestID},
						"X-Catalog-Version": []string{"42"},
					},
					Body: io.NopCloser(strings.NewReader(test.body)),
				}, nil
			})
			client := NewControlClient("https://platform.internal", &http.Client{Transport: transport}, time.Second)

			_, err := client.ListOriginModels(context.Background(), "sk-oa-redacted", requestID)

			require.Error(t, err)
			assert.ErrorIs(t, err, ErrUntrustedPlatformResponse)
			assert.NotContains(t, err.Error(), "beenex")
		})
	}
}

func TestControlClientRejectsAdmissionRedirectWithoutForwardingOriginKey(t *testing.T) {
	requests := 0
	transport := roundTripFunc(func(request *http.Request) (*http.Response, error) {
		requests++
		if requests > 1 {
			t.Fatal("Origin control client followed an untrusted redirect")
		}
		assert.Equal(t, "Bearer sk-oa-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcd", request.Header.Get("Authorization"))
		return &http.Response{
			StatusCode: http.StatusTemporaryRedirect,
			Header:     http.Header{"Location": []string{"https://redirect.platform.internal/internal/v1/admissions"}},
			Body:       io.NopCloser(strings.NewReader("")),
		}, nil
	})
	client := NewControlClient("https://platform.internal", &http.Client{Transport: transport}, time.Second)

	_, err := client.CreateAdmission(context.Background(), "sk-oa-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcd", AdmissionRequest{
		RequestID: "01980000-0000-7000-8000-000000000002", PlatformModel: "origin-codex", Operation: "responses",
		CatalogVersion: 42, InputTokenEstimate: 1, MaxOutputTokens: 1, RequestedCapabilities: []string{},
	})

	require.Error(t, err)
	assert.Equal(t, 1, requests)
	assert.ErrorIs(t, err, ErrUntrustedPlatformResponse)
}

func TestControlClientRejectsUntrustedAdmissionResponse(t *testing.T) {
	transport := roundTripFunc(func(request *http.Request) (*http.Response, error) {
		return &http.Response{
			StatusCode: http.StatusOK,
			Header: http.Header{
				"Content-Type": []string{"application/json"},
				"X-Request-Id": []string{"different-request-id"},
			},
			Body: io.NopCloser(strings.NewReader(`{"request_id":"different-request-id","unexpected":true}`)),
		}, nil
	})
	client := NewControlClient("https://platform.internal", &http.Client{Transport: transport}, time.Second)

	_, err := client.CreateAdmission(context.Background(), "sk-oa-redacted", AdmissionRequest{
		RequestID:             "01980000-0000-7000-8000-000000000002",
		PlatformModel:         "origin-codex",
		Operation:             "responses",
		CatalogVersion:        42,
		InputTokenEstimate:    1,
		MaxOutputTokens:       1,
		RequestedCapabilities: []string{},
	})

	require.Error(t, err)
	assert.ErrorIs(t, err, ErrUntrustedPlatformResponse)
	assert.NotContains(t, err.Error(), "sk-oa-redacted")
}

func TestControlClientTimeoutFailsClosed(t *testing.T) {
	transport := roundTripFunc(func(request *http.Request) (*http.Response, error) {
		<-request.Context().Done()
		return nil, request.Context().Err()
	})
	client := NewControlClient("https://platform.internal", &http.Client{Transport: transport}, time.Millisecond)

	_, err := client.CreateAdmission(context.Background(), "sk-oa-redacted", AdmissionRequest{
		RequestID:             "01980000-0000-7000-8000-000000000002",
		PlatformModel:         "origin-codex",
		Operation:             "responses",
		CatalogVersion:        42,
		InputTokenEstimate:    1,
		MaxOutputTokens:       1,
		RequestedCapabilities: []string{},
	})

	require.Error(t, err)
	assert.True(t, errors.Is(err, context.DeadlineExceeded) || errors.Is(err, ErrPlatformUnavailable))
}

func TestControlClientRejectsOversizedAdmissionResponse(t *testing.T) {
	valid := `{"request_id":"01980000-0000-7000-8000-000000000002","tenant_id":"01980000-0000-7000-8000-000000000003","project_id":"01980000-0000-7000-8000-000000000004","api_key_id":"01980000-0000-7000-8000-000000000005","reservation_id":"01980000-0000-7000-8000-000000000006","approved_catalog_version":42,"route_id":"route_codex_responses_primary","expires_at":"2026-08-14T05:10:00Z"}`
	transport := roundTripFunc(func(request *http.Request) (*http.Response, error) {
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     http.Header{"Content-Type": []string{"application/json"}, "X-Request-Id": []string{"01980000-0000-7000-8000-000000000002"}},
			Body:       io.NopCloser(strings.NewReader(valid + strings.Repeat(" ", maxPlatformResponseBytes))),
		}, nil
	})
	client := NewControlClient("https://platform.internal", &http.Client{Transport: transport}, time.Second)

	_, err := client.CreateAdmission(context.Background(), "sk-oa-redacted", AdmissionRequest{
		RequestID: "01980000-0000-7000-8000-000000000002", PlatformModel: "origin-codex", Operation: "responses",
		CatalogVersion: 42, InputTokenEstimate: 1, MaxOutputTokens: 1, RequestedCapabilities: []string{},
	})

	require.Error(t, err)
	assert.ErrorIs(t, err, ErrUntrustedPlatformResponse)
}

func TestControlClientRejectsContractInvalidAdmissionErrorBounds(t *testing.T) {
	transport := roundTripFunc(func(request *http.Request) (*http.Response, error) {
		return &http.Response{
			StatusCode: http.StatusConflict,
			Header: http.Header{
				"Content-Type": []string{"application/json"},
				"X-Request-Id": []string{"01980000-0000-7000-8000-000000000002"},
			},
			Body: io.NopCloser(strings.NewReader(`{
				"error":{"code":"catalog_stale","message":"Refresh the execution snapshot","retryable":true,"current_catalog_version":0},
				"request_id":"01980000-0000-7000-8000-000000000002"
			}`)),
		}, nil
	})
	client := NewControlClient("https://platform.internal", &http.Client{Transport: transport}, time.Second)

	_, err := client.CreateAdmission(context.Background(), "sk-oa-redacted", AdmissionRequest{
		RequestID: "01980000-0000-7000-8000-000000000002", PlatformModel: "origin-codex", Operation: "responses",
		CatalogVersion: 42, InputTokenEstimate: 1, MaxOutputTokens: 1, RequestedCapabilities: []string{},
	})

	require.Error(t, err)
	assert.ErrorIs(t, err, ErrUntrustedPlatformResponse)
}

func TestControlClientRejectsContractInvalidCatalogETag(t *testing.T) {
	transport := roundTripFunc(func(request *http.Request) (*http.Response, error) {
		return &http.Response{
			StatusCode: http.StatusNotModified,
			Header: http.Header{
				"ETag":              []string{"x"},
				"X-Catalog-Version": []string{"42"},
				"X-Request-Id":      []string{"01980000-0000-7000-8000-000000000002"},
			},
			Body: io.NopCloser(strings.NewReader("")),
		}, nil
	})
	client := NewControlClient("https://platform.internal", &http.Client{Transport: transport}, time.Second)

	_, err := client.FetchCatalog(context.Background(), "01980000-0000-7000-8000-000000000002", "x")

	require.Error(t, err)
	assert.ErrorIs(t, err, ErrUntrustedPlatformResponse)
}
