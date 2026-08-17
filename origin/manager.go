package origin

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
)

var ErrCatalogRefreshFailed = errors.New("Origin catalog refresh failed")

type ControlPlane interface {
	CreateAdmission(context.Context, string, AdmissionRequest) (AdmissionResult, error)
	FetchCatalog(context.Context, string, string) (CatalogFetchResult, error)
}

type ModelDiscoveryControlPlane interface {
	ListOriginModels(context.Context, string, string, string) (OriginModelList, error)
}

type AdmissionInput struct {
	RequestID          string
	PlatformModel      string
	Operation          string
	InputTokenEstimate int
	MaxOutputTokens    int
	Capabilities       RequestedCapabilities
}

type AdmissionGrant struct {
	Admission AdmissionResult
	Route     CatalogExecutionRoute
}

type Manager struct {
	control   ControlPlane
	catalog   *CatalogView
	now       func() time.Time
	refreshMu sync.Mutex
}

func NewManager(control ControlPlane, catalog *CatalogView, now func() time.Time) *Manager {
	if now == nil {
		now = time.Now
	}
	return &Manager{control: control, catalog: catalog, now: now}
}

func (manager *Manager) ListModels(ctx context.Context, originKey, requestID, operation string) (OriginModelList, error) {
	control, ok := manager.control.(ModelDiscoveryControlPlane)
	if !ok || control == nil {
		return OriginModelList{}, ErrPlatformUnavailable
	}
	return control.ListOriginModels(ctx, originKey, requestID, operation)
}

func (manager *Manager) Admit(ctx context.Context, originKey string, input AdmissionInput) (AdmissionGrant, error) {
	if manager.control == nil || manager.catalog == nil {
		return AdmissionGrant{}, ErrPlatformUnavailable
	}
	if manager.catalog.Version() == 0 {
		if err := manager.refresh(ctx, input.RequestID, false); err != nil {
			return AdmissionGrant{}, err
		}
	}
	request, err := manager.admissionRequest(input)
	if err != nil {
		return AdmissionGrant{}, err
	}
	result, err := manager.control.CreateAdmission(ctx, originKey, request)
	if err != nil {
		var controlError *ControlError
		if !errors.As(err, &controlError) || controlError.Code != "catalog_stale" {
			return AdmissionGrant{}, err
		}
		oldVersion := manager.catalog.Version()
		if refreshErr := manager.refresh(ctx, input.RequestID, true); refreshErr != nil || manager.catalog.Version() <= oldVersion {
			return AdmissionGrant{}, fmt.Errorf("%w: %v", ErrCatalogRefreshFailed, refreshErr)
		}
		request, err = manager.admissionRequest(input)
		if err != nil {
			return AdmissionGrant{}, err
		}
		result, err = manager.control.CreateAdmission(ctx, originKey, request)
		if err != nil {
			return AdmissionGrant{}, err
		}
	}
	return manager.validateGrant(input, request, result)
}

func (manager *Manager) admissionRequest(input AdmissionInput) (AdmissionRequest, error) {
	if _, err := uuid.Parse(input.RequestID); err != nil || input.InputTokenEstimate < 0 || input.MaxOutputTokens < 0 {
		return AdmissionRequest{}, errors.New("invalid Origin admission input")
	}
	if input.Operation != "responses" && input.Operation != "messages" {
		return AdmissionRequest{}, errors.New("invalid Origin operation")
	}
	route, err := manager.catalog.ApprovedRoute(input.PlatformModel, input.Operation, input.Capabilities, input.InputTokenEstimate, input.MaxOutputTokens)
	if err != nil {
		return AdmissionRequest{}, err
	}
	maxOutputTokens := input.MaxOutputTokens
	if maxOutputTokens == 0 {
		maxOutputTokens = route.Capabilities.MaxOutputTokens
	}
	capabilities := make([]string, 0, 3)
	if input.Capabilities.Streaming {
		capabilities = append(capabilities, "streaming")
	}
	if input.Capabilities.FunctionTools {
		capabilities = append(capabilities, "function_tools")
	}
	if input.Capabilities.Reasoning {
		capabilities = append(capabilities, "reasoning")
	}
	return AdmissionRequest{
		RequestID:             input.RequestID,
		PlatformModel:         input.PlatformModel,
		Operation:             input.Operation,
		CatalogVersion:        manager.catalog.Version(),
		InputTokenEstimate:    int64(input.InputTokenEstimate),
		MaxOutputTokens:       maxOutputTokens,
		Stream:                input.Capabilities.Streaming,
		RequestedCapabilities: capabilities,
	}, nil
}

func (manager *Manager) validateGrant(input AdmissionInput, request AdmissionRequest, result AdmissionResult) (AdmissionGrant, error) {
	if result.RequestID != input.RequestID || result.ApprovedCatalogVersion != request.CatalogVersion || result.ApprovedCatalogVersion != manager.catalog.Version() {
		return AdmissionGrant{}, ErrUntrustedPlatformResponse
	}
	expiresAt, err := time.Parse(time.RFC3339, result.ExpiresAt)
	if err != nil || !manager.now().Before(expiresAt) {
		return AdmissionGrant{}, ErrUntrustedPlatformResponse
	}
	route, err := manager.catalog.RouteByID(result.RouteID)
	if err != nil || route.PlatformModel != input.PlatformModel || route.Operation != input.Operation ||
		input.Operation == "responses" && route.UpstreamProtocol != "openai_responses" ||
		input.Operation == "messages" && route.UpstreamProtocol != "anthropic_messages" {
		return AdmissionGrant{}, ErrUntrustedPlatformResponse
	}
	if input.Capabilities.Streaming && !route.Capabilities.Streaming ||
		input.Capabilities.FunctionTools && !route.Capabilities.FunctionTools ||
		input.Capabilities.Reasoning && !route.Capabilities.Reasoning ||
		input.InputTokenEstimate > route.Capabilities.MaxInputTokens ||
		input.MaxOutputTokens > route.Capabilities.MaxOutputTokens {
		return AdmissionGrant{}, ErrUntrustedPlatformResponse
	}
	return AdmissionGrant{Admission: result, Route: route}, nil
}

func (manager *Manager) refresh(ctx context.Context, requestID string, requireChange bool) error {
	manager.refreshMu.Lock()
	defer manager.refreshMu.Unlock()
	previousVersion := manager.catalog.Version()
	result, err := manager.control.FetchCatalog(ctx, requestID, manager.catalog.ETag())
	if err != nil {
		return fmt.Errorf("%w: %v", ErrCatalogRefreshFailed, err)
	}
	if result.NotModified {
		if requireChange {
			return ErrCatalogRefreshFailed
		}
		return nil
	}
	if result.Version < 1 || len(result.Body) == 0 {
		return ErrCatalogRefreshFailed
	}
	if err := manager.catalog.Install(result.Body, result.ETag); err != nil {
		return fmt.Errorf("%w: %v", ErrCatalogRefreshFailed, err)
	}
	if result.Version != manager.catalog.Version() || requireChange && manager.catalog.Version() <= previousVersion {
		return ErrCatalogRefreshFailed
	}
	return nil
}
