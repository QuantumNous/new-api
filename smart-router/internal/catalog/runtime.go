package catalog

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"time"

	"smart-router/api"
	"smart-router/signing"
	"smart-router/store"
)

type RuntimeConfig struct {
	Store                *store.DB
	SigningKey           []byte
	Now                  func() time.Time
	SnapshotTTL          time.Duration
	HysteresisMicrounits int64
	ConfigSHA256         string
	PluginManifestSHA256 string
}

type Runtime struct {
	store                *store.DB
	catalog              *Catalog
	signingKey           []byte
	now                  func() time.Time
	snapshotTTL          time.Duration
	configSHA256         string
	pluginManifestSHA256 string
}

func NewRuntime(configuration RuntimeConfig) *Runtime {
	return &Runtime{
		store: configuration.Store,
		catalog: New(
			configuration.Store,
			configuration.Now,
			configuration.HysteresisMicrounits,
		),
		signingKey:           append([]byte(nil), configuration.SigningKey...),
		now:                  configuration.Now,
		snapshotTTL:          configuration.SnapshotTTL,
		configSHA256:         configuration.ConfigSHA256,
		pluginManifestSHA256: configuration.PluginManifestSHA256,
	}
}

func (runtime *Runtime) Route(
	ctx context.Context,
	request api.RouteRequest,
) (api.RouteResponse, error) {
	snapshot, err := runtime.buildSnapshot(ctx)
	if err != nil {
		return api.RouteResponse{}, err
	}
	if request.SnapshotRevision != "" && request.SnapshotRevision != snapshot.Revision {
		return api.RouteResponse{}, api.ContractError{
			Kind: "error", SchemaVersion: 1, Code: api.ErrorContractMismatch,
			Retryable: true, RequestID: request.RequestID,
			Message: "snapshot revision does not match current routing state",
		}
	}
	bindings, err := runtime.catalog.Select(ctx, request)
	if errors.Is(err, ErrBindingUnavailable) {
		return api.RouteResponse{}, bindingUnavailable(request.RequestID)
	}
	if err != nil {
		return api.RouteResponse{}, err
	}

	response := api.RouteResponse{
		Kind: "route_response", SchemaVersion: 1, RequestID: request.RequestID,
		SnapshotRevision: snapshot.Revision, ExpiresAt: snapshot.ExpiresAt,
		Bindings: bindings,
	}
	response.Signature, err = signing.Sign(response, runtime.signingKey)
	if err != nil {
		return api.RouteResponse{}, err
	}
	bindingIDs := make([]string, len(bindings))
	for index, binding := range bindings {
		bindingIDs[index] = binding.BindingID
	}
	if err := runtime.store.RecordDecision(ctx, store.Decision{
		RequestID: request.RequestID, Group: request.Group, Model: request.Model,
		Protocol: request.Protocol, SnapshotRevision: snapshot.Revision,
		BindingIDs: bindingIDs, CreatedAt: runtime.now(),
	}); err != nil {
		return api.RouteResponse{}, err
	}
	return response, nil
}

func (runtime *Runtime) RecordOutcome(
	ctx context.Context,
	outcome api.AttemptOutcome,
) error {
	_, err := runtime.store.RecordOutcomeAndApply(ctx, outcome, runtime.now())
	switch {
	case errors.Is(err, store.ErrOutcomeConflict):
		return api.ContractError{
			Kind: "error", SchemaVersion: 1, Code: api.ErrorOutcomeConflict,
			RequestID: outcome.RequestID, Message: "event ID has conflicting content",
		}
	case errors.Is(err, store.ErrBindingNotFound):
		return bindingUnavailable(outcome.RequestID)
	default:
		return err
	}
}

func (runtime *Runtime) Snapshot(ctx context.Context) (api.SignedSnapshot, error) {
	return runtime.buildSnapshot(ctx)
}

func (runtime *Runtime) buildSnapshot(ctx context.Context) (api.SignedSnapshot, error) {
	now := runtime.now().UTC()
	keys, err := runtime.store.ListRouteKeys(ctx)
	if err != nil {
		return api.SignedSnapshot{}, err
	}
	routes := make([]api.SnapshotRoute, 0, len(keys))
	for _, key := range keys {
		request := api.RouteRequest{
			Kind: "route_request", SchemaVersion: 1, RequestID: "snapshot",
			Group: key.Group, Model: key.Model, Protocol: key.Protocol,
			AttemptLimit: 5,
		}
		bindings, err := runtime.catalog.Select(ctx, request)
		if errors.Is(err, ErrBindingUnavailable) {
			continue
		}
		if err != nil {
			return api.SignedSnapshot{}, err
		}
		routes = append(routes, api.SnapshotRoute{
			Group: key.Group, Model: key.Model, Protocol: key.Protocol,
			Bindings: bindings,
		})
	}
	revision, err := snapshotRevision(
		runtime.configSHA256,
		runtime.pluginManifestSHA256,
		routes,
	)
	if err != nil {
		return api.SignedSnapshot{}, err
	}
	snapshot := api.SignedSnapshot{
		Kind: "signed_snapshot", SchemaVersion: 1, Revision: revision,
		IssuedAt: now.UnixMilli(), ExpiresAt: now.Add(runtime.snapshotTTL).UnixMilli(),
		ConfigSHA256:         runtime.configSHA256,
		PluginManifestSHA256: runtime.pluginManifestSHA256,
		Routes:               routes,
	}
	snapshot.Signature, err = signing.Sign(snapshot, runtime.signingKey)
	if err != nil {
		return api.SignedSnapshot{}, err
	}
	if err := runtime.store.SaveSnapshot(ctx, snapshot); err != nil {
		return api.SignedSnapshot{}, err
	}
	return snapshot, nil
}

func snapshotRevision(
	configSHA256 string,
	pluginManifestSHA256 string,
	routes []api.SnapshotRoute,
) (string, error) {
	payload, err := json.Marshal(struct {
		ConfigSHA256         string              `json:"config_sha256"`
		PluginManifestSHA256 string              `json:"plugin_manifest_sha256"`
		Routes               []api.SnapshotRoute `json:"routes"`
	}{
		ConfigSHA256:         configSHA256,
		PluginManifestSHA256: pluginManifestSHA256,
		Routes:               routes,
	})
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256(payload)
	return "rev_" + hex.EncodeToString(sum[:16]), nil
}

func bindingUnavailable(requestID string) api.ContractError {
	return api.ContractError{
		Kind: "error", SchemaVersion: 1, Code: api.ErrorBindingUnavailable,
		Retryable: true, RequestID: requestID, Message: "no eligible binding",
	}
}
