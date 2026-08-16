package origin

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/google/uuid"
)

var (
	ErrPlatformUnavailable       = errors.New("Origin Platform unavailable")
	ErrUntrustedPlatformResponse = errors.New("untrusted Origin Platform response")
)

const maxPlatformResponseBytes = 4 << 20

type ControlError struct {
	Status                int
	Code                  string
	Message               string
	Retryable             bool
	RequestID             string
	RetryAfterMS          *int
	CurrentCatalogVersion *int64
}

func (err *ControlError) Error() string {
	return fmt.Sprintf("Origin Platform rejected request: code=%s status=%d", err.Code, err.Status)
}

type ControlClient struct {
	baseURL string
	client  *http.Client
	timeout time.Duration
}

type CatalogFetchResult struct {
	Body        []byte
	ETag        string
	Version     int64
	NotModified bool
}

func NewControlClient(baseURL string, client *http.Client, timeout time.Duration) *ControlClient {
	if client == nil {
		client = http.DefaultClient
	}
	controlHTTPClient := &http.Client{
		Transport: client.Transport,
		Jar:       client.Jar,
		Timeout:   client.Timeout,
		CheckRedirect: func(_ *http.Request, _ []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
	return &ControlClient{baseURL: strings.TrimRight(baseURL, "/"), client: controlHTTPClient, timeout: timeout}
}

func (client *ControlClient) CreateAdmission(ctx context.Context, originKey string, input AdmissionRequest) (AdmissionResult, error) {
	if err := validateAdmissionRequest(input); err != nil {
		return AdmissionResult{}, err
	}
	body, err := common.Marshal(input)
	if err != nil {
		return AdmissionResult{}, fmt.Errorf("encode admission request: %w", err)
	}
	requestCtx, cancel := context.WithTimeout(ctx, client.timeout)
	defer cancel()
	request, err := http.NewRequestWithContext(requestCtx, http.MethodPost, client.baseURL+"/internal/v1/admissions", bytes.NewReader(body))
	if err != nil {
		return AdmissionResult{}, fmt.Errorf("create admission request: %w", err)
	}
	request.Header.Set("Accept", "application/json")
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer "+originKey)
	request.Header.Set("Idempotency-Key", input.RequestID)
	request.Header.Set("X-Request-Id", input.RequestID)

	response, err := client.client.Do(request)
	if err != nil {
		return AdmissionResult{}, fmt.Errorf("%w: %w", ErrPlatformUnavailable, err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return AdmissionResult{}, decodeControlError(response, input.RequestID)
	}
	if !isJSONContentType(response.Header.Get("Content-Type")) || response.Header.Get("X-Request-Id") != input.RequestID {
		return AdmissionResult{}, ErrUntrustedPlatformResponse
	}
	responseBody, err := readPlatformResponseBody(response.Body)
	if err != nil {
		return AdmissionResult{}, ErrUntrustedPlatformResponse
	}
	var result AdmissionResult
	if err := common.DecodeJsonStrict(bytes.NewReader(responseBody), &result); err != nil {
		return AdmissionResult{}, fmt.Errorf("%w: invalid admission body", ErrUntrustedPlatformResponse)
	}
	if err := validateAdmissionResult(result, input); err != nil {
		return AdmissionResult{}, fmt.Errorf("%w: %v", ErrUntrustedPlatformResponse, err)
	}
	return result, nil
}

func (client *ControlClient) FetchCatalog(ctx context.Context, requestID, etag string) (CatalogFetchResult, error) {
	if _, err := uuid.Parse(requestID); err != nil {
		return CatalogFetchResult{}, errors.New("invalid Origin catalog request id")
	}
	requestCtx, cancel := context.WithTimeout(ctx, client.timeout)
	defer cancel()
	request, err := http.NewRequestWithContext(requestCtx, http.MethodGet, client.baseURL+"/internal/v1/catalog/execution-snapshot", nil)
	if err != nil {
		return CatalogFetchResult{}, fmt.Errorf("create catalog request: %w", err)
	}
	request.Header.Set("Accept", "application/json")
	request.Header.Set("X-Request-Id", requestID)
	if etag != "" {
		request.Header.Set("If-None-Match", etag)
	}
	response, err := client.client.Do(request)
	if err != nil {
		return CatalogFetchResult{}, fmt.Errorf("%w: %w", ErrPlatformUnavailable, err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK && response.StatusCode != http.StatusNotModified {
		return CatalogFetchResult{}, decodeControlError(response, requestID)
	}
	responseETag := response.Header.Get("ETag")
	version, parseErr := strconv.ParseInt(response.Header.Get("X-Catalog-Version"), 10, 64)
	if response.Header.Get("X-Request-Id") != requestID || len(responseETag) < 3 || len(responseETag) > 96 || parseErr != nil || version < 1 {
		return CatalogFetchResult{}, ErrUntrustedPlatformResponse
	}
	if response.StatusCode == http.StatusNotModified {
		if etag == "" || responseETag != etag {
			return CatalogFetchResult{}, ErrUntrustedPlatformResponse
		}
		return CatalogFetchResult{ETag: responseETag, Version: version, NotModified: true}, nil
	}
	if !isJSONContentType(response.Header.Get("Content-Type")) {
		return CatalogFetchResult{}, ErrUntrustedPlatformResponse
	}
	body, err := readPlatformResponseBody(response.Body)
	if err != nil {
		return CatalogFetchResult{}, ErrUntrustedPlatformResponse
	}
	return CatalogFetchResult{Body: body, ETag: responseETag, Version: version}, nil
}

func validateAdmissionRequest(input AdmissionRequest) error {
	if _, err := uuid.Parse(input.RequestID); err != nil || input.Operation != "responses" ||
		len(input.PlatformModel) > 120 || !catalogIdentifierPattern.MatchString(input.PlatformModel) || input.CatalogVersion < 1 ||
		input.InputTokenEstimate < 0 || input.InputTokenEstimate > 100000000 ||
		input.MaxOutputTokens < 1 || input.MaxOutputTokens > 1000000 || len(input.RequestedCapabilities) > 3 {
		return errors.New("invalid Origin admission request")
	}
	seen := map[string]bool{}
	for _, capability := range input.RequestedCapabilities {
		if seen[capability] || (capability != "streaming" && capability != "function_tools" && capability != "reasoning") {
			return errors.New("invalid Origin requested capability")
		}
		seen[capability] = true
	}
	return nil
}

func validateAdmissionResult(result AdmissionResult, input AdmissionRequest) error {
	for _, value := range []string{result.RequestID, result.TenantID, result.ProjectID, result.APIKeyID, result.ReservationID} {
		if _, err := uuid.Parse(value); err != nil {
			return errors.New("invalid admission identity")
		}
	}
	if result.RequestID != input.RequestID || result.ApprovedCatalogVersion != input.CatalogVersion ||
		len(result.RouteID) > 160 || !catalogIdentifierPattern.MatchString(result.RouteID) {
		return errors.New("admission correlation mismatch")
	}
	if _, err := time.Parse(time.RFC3339, result.ExpiresAt); err != nil {
		return errors.New("invalid admission expiry")
	}
	return nil
}

func decodeControlError(response *http.Response, requestID string) error {
	if !isJSONContentType(response.Header.Get("Content-Type")) || response.Header.Get("X-Request-Id") != requestID {
		return ErrUntrustedPlatformResponse
	}
	body, err := readPlatformResponseBody(response.Body)
	if err != nil {
		return ErrUntrustedPlatformResponse
	}
	var envelope AdmissionErrorEnvelope
	if err := common.DecodeJsonStrict(bytes.NewReader(body), &envelope); err != nil {
		return ErrUntrustedPlatformResponse
	}
	if envelope.RequestID != requestID || !admissionErrorMatchesStatus(envelope.Error.Code, response.StatusCode) ||
		envelope.Error.Message == "" || len(envelope.Error.Message) > 500 ||
		envelope.Error.RetryAfterMS != nil && *envelope.Error.RetryAfterMS < 1 ||
		envelope.Error.CurrentCatalogVersion != nil && *envelope.Error.CurrentCatalogVersion < 1 {
		return ErrUntrustedPlatformResponse
	}
	return &ControlError{
		Status:                response.StatusCode,
		Code:                  envelope.Error.Code,
		Message:               envelope.Error.Message,
		Retryable:             envelope.Error.Retryable,
		RequestID:             envelope.RequestID,
		RetryAfterMS:          envelope.Error.RetryAfterMS,
		CurrentCatalogVersion: envelope.Error.CurrentCatalogVersion,
	}
}

func readPlatformResponseBody(reader io.Reader) ([]byte, error) {
	body, err := io.ReadAll(io.LimitReader(reader, maxPlatformResponseBytes+1))
	if err != nil || len(body) > maxPlatformResponseBytes {
		return nil, ErrUntrustedPlatformResponse
	}
	return body, nil
}

func admissionErrorMatchesStatus(code string, status int) bool {
	allowed := map[int]map[string]bool{
		http.StatusBadRequest:         {"invalid_admission_request": true},
		http.StatusUnauthorized:       {"origin_key_invalid": true},
		http.StatusPaymentRequired:    {"insufficient_balance": true},
		http.StatusForbidden:          {"origin_key_disabled": true, "origin_key_expired": true, "origin_key_project_mismatch": true, "model_access_denied": true},
		http.StatusNotFound:           {"model_not_available": true},
		http.StatusConflict:           {"catalog_stale": true, "idempotency_key_payload_conflict": true, "idempotency_request_in_progress": true},
		http.StatusTooManyRequests:    {"quota_exceeded": true},
		http.StatusServiceUnavailable: {"platform_unavailable": true},
	}
	return allowed[status][code]
}

func isJSONContentType(value string) bool {
	mediaType, _, err := mime.ParseMediaType(value)
	return err == nil && mediaType == "application/json"
}
