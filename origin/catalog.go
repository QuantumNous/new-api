package origin

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"regexp"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/google/uuid"
)

var (
	ErrCatalogUnavailable      = errors.New("Origin catalog unavailable")
	ErrCatalogExpired          = errors.New("Origin catalog expired")
	ErrCatalogRollback         = errors.New("Origin catalog version rollback")
	ErrCatalogVersionConflict  = errors.New("Origin catalog version content conflict")
	ErrCatalogModelUnknown     = errors.New("Origin catalog model unknown")
	ErrCatalogCapabilityDenied = errors.New("Origin catalog capability denied")
	ErrCatalogRouteUnknown     = errors.New("Origin catalog route unknown")
	ErrCatalogRouteDisabled    = errors.New("Origin catalog route disabled")
)

var catalogIdentifierPattern = regexp.MustCompile(`^[A-Za-z0-9._:-]+$`)
var upstreamModelPattern = regexp.MustCompile(`^[A-Za-z0-9._:/-]+$`)

type RequestedCapabilities struct {
	Streaming     bool
	FunctionTools bool
	Reasoning     bool
}

type catalogState struct {
	event       CatalogExecutionSnapshotPublishedV1
	etag        string
	installedAt time.Time
}

type CatalogView struct {
	now   func() time.Time
	state atomic.Pointer[catalogState]
}

func NewCatalogView(now func() time.Time) *CatalogView {
	if now == nil {
		now = time.Now
	}
	return &CatalogView{now: now}
}

func (view *CatalogView) Install(raw []byte, etag string) error {
	var event CatalogExecutionSnapshotPublishedV1
	if err := common.DecodeJsonStrict(bytes.NewReader(raw), &event); err != nil {
		return fmt.Errorf("decode Origin catalog snapshot: %w", err)
	}
	if err := validateCatalogEvent(event, view.now()); err != nil {
		return err
	}
	current := view.state.Load()
	if current != nil {
		currentVersion := current.event.Payload.SnapshotVersion
		incomingVersion := event.Payload.SnapshotVersion
		if incomingVersion < currentVersion {
			return ErrCatalogRollback
		}
		if incomingVersion == currentVersion {
			if event.Payload.ContentSHA256 != current.event.Payload.ContentSHA256 {
				return ErrCatalogVersionConflict
			}
			return nil
		}
	}
	view.state.Store(&catalogState{event: event, etag: etag, installedAt: view.now()})
	return nil
}

func (view *CatalogView) Version() int64 {
	state := view.state.Load()
	if state == nil {
		return 0
	}
	return state.event.Payload.SnapshotVersion
}

func (view *CatalogView) ETag() string {
	state := view.state.Load()
	if state == nil {
		return ""
	}
	return state.etag
}

func (view *CatalogView) ApprovedRoute(model string, requested RequestedCapabilities, inputTokens, outputTokens int) (CatalogExecutionRoute, error) {
	state := view.state.Load()
	if state == nil {
		return CatalogExecutionRoute{}, ErrCatalogUnavailable
	}
	expiresAt, err := time.Parse(time.RFC3339, state.event.Payload.ExpiresAt)
	if err != nil || !view.now().Before(expiresAt) {
		return CatalogExecutionRoute{}, ErrCatalogExpired
	}
	modelFound := false
	for _, route := range state.event.Payload.Routes {
		if route.PlatformModel != model || route.Operation != "responses" {
			continue
		}
		modelFound = true
		if route.Status != "ACTIVE" {
			continue
		}
		if requested.Streaming && !route.Capabilities.Streaming ||
			requested.FunctionTools && !route.Capabilities.FunctionTools ||
			requested.Reasoning && !route.Capabilities.Reasoning ||
			inputTokens > route.Capabilities.MaxInputTokens ||
			outputTokens > route.Capabilities.MaxOutputTokens {
			continue
		}
		return route, nil
	}
	if !modelFound {
		return CatalogExecutionRoute{}, ErrCatalogModelUnknown
	}
	return CatalogExecutionRoute{}, ErrCatalogCapabilityDenied
}

func (view *CatalogView) RouteByID(routeID string) (CatalogExecutionRoute, error) {
	state := view.state.Load()
	if state == nil {
		return CatalogExecutionRoute{}, ErrCatalogUnavailable
	}
	expiresAt, err := time.Parse(time.RFC3339, state.event.Payload.ExpiresAt)
	if err != nil || !view.now().Before(expiresAt) {
		return CatalogExecutionRoute{}, ErrCatalogExpired
	}
	for _, route := range state.event.Payload.Routes {
		if route.RouteID != routeID {
			continue
		}
		if route.Status != "ACTIVE" {
			return CatalogExecutionRoute{}, ErrCatalogRouteDisabled
		}
		return route, nil
	}
	return CatalogExecutionRoute{}, ErrCatalogRouteUnknown
}

func validateCatalogEvent(event CatalogExecutionSnapshotPublishedV1, now time.Time) error {
	if _, err := uuid.Parse(event.EventID); err != nil || event.EventType != "catalog.execution_snapshot_published.v1" ||
		event.EventVersion != CatalogExecutionSnapshotEventVersion || event.Producer != "platform-service" ||
		event.PartitionKey != "catalog:execution" {
		return errors.New("invalid Origin catalog event envelope")
	}
	if _, err := time.Parse(time.RFC3339, event.OccurredAt); err != nil {
		return errors.New("invalid Origin catalog occurred_at")
	}
	if _, err := time.Parse(time.RFC3339, event.ProducedAt); err != nil {
		return errors.New("invalid Origin catalog produced_at")
	}
	payload := event.Payload
	if payload.SnapshotVersion < 1 || !payload.FullSnapshot {
		return errors.New("invalid Origin catalog version or snapshot kind")
	}
	if payload.PreviousSnapshotVersion != nil && *payload.PreviousSnapshotVersion < 1 {
		return errors.New("invalid Origin previous catalog version")
	}
	if _, err := time.Parse(time.RFC3339, payload.PublishedAt); err != nil {
		return errors.New("invalid Origin catalog published_at")
	}
	if len(event.Metadata.Environment) > 40 || len(event.Metadata.Region) > 80 {
		return errors.New("invalid Origin catalog metadata")
	}
	expiresAt, err := time.Parse(time.RFC3339, payload.ExpiresAt)
	if err != nil || !now.Before(expiresAt) {
		return ErrCatalogExpired
	}
	seenRoutes := make(map[string]struct{}, len(payload.Routes))
	for _, route := range payload.Routes {
		if len(route.RouteID) > 160 || len(route.PlatformModel) > 120 || len(route.ApprovedChannelID) > 160 || len(route.UpstreamModelID) > 160 ||
			!catalogIdentifierPattern.MatchString(route.RouteID) || !catalogIdentifierPattern.MatchString(route.PlatformModel) ||
			!catalogIdentifierPattern.MatchString(route.ApprovedChannelID) || !upstreamModelPattern.MatchString(route.UpstreamModelID) ||
			route.Operation != "responses" || route.UpstreamProtocol != "openai_responses" ||
			(route.Status != "ACTIVE" && route.Status != "DRAINING" && route.Status != "DISABLED") ||
			route.Capabilities.MaxInputTokens < 1 || route.Capabilities.MaxOutputTokens < 1 {
			return errors.New("invalid Origin catalog route")
		}
		if _, exists := seenRoutes[route.RouteID]; exists {
			return errors.New("duplicate Origin catalog route")
		}
		seenRoutes[route.RouteID] = struct{}{}
	}
	hash, err := CanonicalSnapshotHash(payload)
	if err != nil {
		return err
	}
	if hash != payload.ContentSHA256 {
		return errors.New("Origin catalog content hash mismatch")
	}
	return nil
}

func CanonicalSnapshotHash(snapshot CatalogExecutionSnapshot) (string, error) {
	routes := make([]any, 0, len(snapshot.Routes))
	for _, route := range snapshot.Routes {
		routes = append(routes, map[string]any{
			"approved_channel_id": route.ApprovedChannelID,
			"capabilities": map[string]any{
				"function_tools":    route.Capabilities.FunctionTools,
				"max_input_tokens":  route.Capabilities.MaxInputTokens,
				"max_output_tokens": route.Capabilities.MaxOutputTokens,
				"reasoning":         route.Capabilities.Reasoning,
				"streaming":         route.Capabilities.Streaming,
			},
			"operation":         route.Operation,
			"platform_model":    route.PlatformModel,
			"route_id":          route.RouteID,
			"status":            route.Status,
			"upstream_model_id": route.UpstreamModelID,
			"upstream_protocol": route.UpstreamProtocol,
		})
	}
	canonical := map[string]any{
		"expires_at":                snapshot.ExpiresAt,
		"full_snapshot":             snapshot.FullSnapshot,
		"previous_snapshot_version": snapshot.PreviousSnapshotVersion,
		"published_at":              snapshot.PublishedAt,
		"routes":                    routes,
		"snapshot_version":          snapshot.SnapshotVersion,
	}
	data, err := common.Marshal(canonical)
	if err != nil {
		return "", fmt.Errorf("canonicalize Origin catalog: %w", err)
	}
	digest := sha256.Sum256(data)
	return hex.EncodeToString(digest[:]), nil
}
