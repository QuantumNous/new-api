package service

import (
	"context"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/types"
	"gorm.io/gorm"
)

const (
	assetBindingDefaultLeaseTTL   = 5 * time.Minute
	assetBindingDefaultPollLimit  = 3
	assetBindingDefaultPollDelay  = 50 * time.Millisecond
	assetBindingProviderErrorCode = "asset upstream error"
)

var (
	ErrAssetBindingInitializing = errors.New("asset binding is initializing")
	ErrAssetBindingUnavailable  = errors.New("asset binding unavailable")

	assetBindingNow       = time.Now
	assetBindingPollSleep = func(ctx context.Context, delay time.Duration) error {
		if delay <= 0 {
			return nil
		}
		timer := time.NewTimer(delay)
		defer timer.Stop()
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-timer.C:
			return nil
		}
	}

	assetMaterializersMu sync.RWMutex
	assetMaterializers   = map[int]AssetMaterializer{}
)

const (
	assetMaterializationProviderSeedanceProxy      = "seedance_proxy"
	seedanceProxyBindingScopePrefix                = "seedance-proxy:v1:"
	assetMaterializationProviderTokenSpaceMaterial = "tokenspace_material"
	tokenSpaceMaterialBindingScopePrefix           = "tokenspace-material:v1:"
)

type assetMaterializationChannelConfig struct {
	Provider       string
	GatewayBaseURL string
	GatewayOrigin  string
	GroupID        string
}

type assetMaterializationProviderDescriptor struct {
	MaterializerFactory func(assetMaterializationChannelConfig) AssetMaterializer
	BindingScope        func(assetMaterializationChannelConfig, AssetMaterializeOptions) (string, error)
	ValidateConfig      func(assetMaterializationChannelConfig) (assetMaterializationChannelConfig, error)
	CredentialScoped    bool
}

var assetMaterializationProviderDescriptors = map[string]assetMaterializationProviderDescriptor{
	assetMaterializationProviderSeedanceProxy: {
		MaterializerFactory: func(config assetMaterializationChannelConfig) AssetMaterializer {
			return seedanceProxyAssetBindingMaterializer{config: config}
		},
		BindingScope: func(config assetMaterializationChannelConfig, options AssetMaterializeOptions) (string, error) {
			scope := seedanceProxyBindingScope(config.GatewayOrigin, config.GroupID, options.APIKey)
			if scope == "" {
				return "", ErrAssetBindingUnavailable
			}
			return scope, nil
		},
		ValidateConfig:   validateSeedanceProxyAssetMaterializationConfig,
		CredentialScoped: true,
	},
	assetMaterializationProviderTokenSpaceMaterial: {
		MaterializerFactory: func(config assetMaterializationChannelConfig) AssetMaterializer {
			return tokenSpaceMaterialAssetBindingMaterializer{config: config}
		},
		BindingScope: func(config assetMaterializationChannelConfig, options AssetMaterializeOptions) (string, error) {
			scope := tokenSpaceMaterialBindingScope(config.GatewayOrigin, config.GroupID, options.APIKey)
			if scope == "" {
				return "", ErrAssetBindingUnavailable
			}
			return scope, nil
		},
		ValidateConfig:   validateTokenSpaceMaterialAssetMaterializationConfig,
		CredentialScoped: true,
	},
}

type AssetMaterializer interface {
	CreateAsset(ctx context.Context, input AssetMaterializeInput) (AssetMaterializeResult, error)
	GetAsset(ctx context.Context, input AssetMaterializeInput, upstreamAssetID string) (AssetMaterializeResult, error)
}

type AssetMaterializeInput struct {
	UserID         int
	Asset          model.Asset
	Channel        *model.Channel
	SourceURL      string
	Model          string
	APIKey         string
	IdempotencyKey string
	SignSource     func(context.Context, model.Asset) (string, error)
}

type AssetMaterializeOptions struct {
	Model  string
	APIKey string
}

type AssetMaterializeResult struct {
	UpstreamGroupID string
	UpstreamAssetID string
	Status          string
}

type AssetBindingRequest struct {
	UserID       int
	PublicID     string
	Channel      *model.Channel
	LeaseOwner   string
	PollLimit    int
	PollDelay    time.Duration
	LeaseTTL     time.Duration
	ExpectedType string
	Model        string
	APIKey       string
}

type AssetBindingResult struct {
	PublicURI  string
	RewriteURI string
	Binding    model.AssetBinding
}

func init() {
	RegisterAssetMaterializer(constant.ChannelTypeBytePlus, bytePlusAssetBindingMaterializer{})
	RegisterAssetMaterializer(constant.ChannelTypeTechMobiVideo, techMobiAssetBindingMaterializer{})
}

func RegisterAssetMaterializer(channelType int, materializer AssetMaterializer) func() {
	assetMaterializersMu.Lock()
	old, hadOld := assetMaterializers[channelType]
	if materializer == nil {
		delete(assetMaterializers, channelType)
	} else {
		assetMaterializers[channelType] = materializer
	}
	assetMaterializersMu.Unlock()

	return func() {
		assetMaterializersMu.Lock()
		defer assetMaterializersMu.Unlock()
		if hadOld {
			assetMaterializers[channelType] = old
		} else {
			delete(assetMaterializers, channelType)
		}
	}
}

func registerAssetMaterializerForTest(t interface{ Cleanup(func()) }, channelType int, materializer AssetMaterializer) func() {
	assetMaterializersMu.Lock()
	old, hadOld := assetMaterializers[channelType]
	if materializer == nil {
		delete(assetMaterializers, channelType)
	} else {
		assetMaterializers[channelType] = materializer
	}
	assetMaterializersMu.Unlock()
	restore := func() {
		assetMaterializersMu.Lock()
		defer assetMaterializersMu.Unlock()
		if hadOld {
			assetMaterializers[channelType] = old
		} else {
			delete(assetMaterializers, channelType)
		}
	}
	if t != nil {
		t.Cleanup(restore)
	}
	return restore
}

func assetMaterializerForChannelType(channelType int) (AssetMaterializer, bool) {
	assetMaterializersMu.RLock()
	defer assetMaterializersMu.RUnlock()
	materializer, ok := assetMaterializers[channelType]
	return materializer, ok
}

func assetMaterializerForChannel(channel *model.Channel) (AssetMaterializer, error) {
	if channel == nil {
		return nil, nil
	}
	config, explicit, err := assetMaterializationConfigForChannel(channel)
	if err != nil {
		return nil, err
	}
	if explicit {
		descriptor, ok := assetMaterializationProviderDescriptors[config.Provider]
		if !ok || descriptor.MaterializerFactory == nil {
			return nil, ErrAssetBindingUnavailable
		}
		return descriptor.MaterializerFactory(config), nil
	}
	materializer, ok := assetMaterializerForChannelType(channel.Type)
	if !ok {
		return nil, nil
	}
	return materializer, nil
}

func assetMaterializationConfigForChannel(channel *model.Channel) (assetMaterializationChannelConfig, bool, error) {
	if channel == nil {
		return assetMaterializationChannelConfig{}, false, nil
	}
	settings := channel.GetOtherSettings().AssetMaterialization
	if settings == nil {
		return assetMaterializationChannelConfig{}, false, nil
	}
	provider := strings.TrimSpace(settings.Provider)
	if provider == "" {
		return assetMaterializationChannelConfig{}, false, nil
	}
	config := assetMaterializationChannelConfig{
		Provider:       provider,
		GatewayBaseURL: strings.TrimSpace(settings.GatewayBaseURL),
		GroupID:        strings.TrimSpace(settings.GroupID),
	}
	descriptor, ok := assetMaterializationProviderDescriptors[provider]
	if !ok {
		return assetMaterializationChannelConfig{}, true, ErrAssetBindingUnavailable
	}
	if descriptor.ValidateConfig == nil {
		return config, true, nil
	}
	config, err := descriptor.ValidateConfig(config)
	if err != nil {
		return assetMaterializationChannelConfig{}, true, ErrAssetBindingUnavailable
	}
	return config, true, nil
}

func validateSeedanceProxyAssetMaterializationConfig(config assetMaterializationChannelConfig) (assetMaterializationChannelConfig, error) {
	scopeBase, err := normalizedGatewayScopeBase(config.GatewayBaseURL)
	if err != nil {
		return assetMaterializationChannelConfig{}, err
	}
	if config.GroupID == "" {
		return assetMaterializationChannelConfig{}, ErrAssetBindingUnavailable
	}
	config.GatewayOrigin = scopeBase
	return config, nil
}

func validateTokenSpaceMaterialAssetMaterializationConfig(config assetMaterializationChannelConfig) (assetMaterializationChannelConfig, error) {
	origin, err := normalizedGatewayOrigin(config.GatewayBaseURL)
	if err != nil {
		return assetMaterializationChannelConfig{}, err
	}
	if config.GroupID == "" {
		return assetMaterializationChannelConfig{}, ErrAssetBindingUnavailable
	}
	config.GatewayOrigin = origin
	return config, nil
}

func normalizedGatewayOrigin(rawURL string) (string, error) {
	if err := seedanceProxyValidateGatewayBaseURL(rawURL); err != nil {
		return "", err
	}
	parsed, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil {
		return "", err
	}
	return strings.ToLower(parsed.Scheme) + "://" + strings.ToLower(parsed.Host), nil
}

func normalizedGatewayScopeBase(rawURL string) (string, error) {
	origin, err := normalizedGatewayOrigin(rawURL)
	if err != nil {
		return "", err
	}
	parsed, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil {
		return "", err
	}
	path := strings.TrimRight(parsed.EscapedPath(), "/")
	if path == "" {
		return origin, nil
	}
	return origin + path, nil
}

func seedanceProxyBindingScope(origin string, groupID string, apiKey string) string {
	origin = strings.TrimSpace(origin)
	groupID = strings.TrimSpace(groupID)
	apiKey = strings.TrimSpace(apiKey)
	if origin == "" || groupID == "" || apiKey == "" {
		return ""
	}
	digest := sha256.Sum256([]byte(origin + "\x00" + groupID + "\x00" + apiKey))
	return seedanceProxyBindingScopePrefix + hex.EncodeToString(digest[:])
}

func MaterializeAssetBindingsForChannel(ctx context.Context, userID int, set AssetReferenceSet, channel *model.Channel, options ...AssetMaterializeOptions) (map[string]string, error) {
	if !set.HasReferences() || channel == nil {
		return nil, nil
	}
	var materializeOptions AssetMaterializeOptions
	if len(options) > 0 {
		materializeOptions = options[0]
	}
	bindingScope, err := assetBindingScopeForChannel(channel, materializeOptions)
	if err != nil {
		return nil, err
	}
	if set.strictCoverage {
		if set.target == nil {
			return nil, ErrAssetBindingInitializing
		}
		if channel.Id != set.target.ChannelId {
			return nil, ErrAssetBindingUnavailable
		}
		if bindingScope != set.target.BindingScope {
			return nil, ErrAssetBindingUnavailable
		}
		readiness, eligible := set.targetReadinessForChannel(channel, set.target.ModelName)
		if !eligible || readiness != AssetReadinessVerifiedTarget {
			return nil, ErrAssetBindingInitializing
		}
		bindingScope = set.target.BindingScope
	}
	rewriteMap := make(map[string]string, len(set.references))
	for _, reference := range set.references {
		asset := set.assets[reference.PublicID]
		if binding, ok := activeAssetReferenceBindingForScope(asset.Bindings, channel.Id, bindingScope); ok {
			rewriteMap["asset://"+reference.PublicID] = assetBindingRewriteURI(binding.UpstreamAssetID)
			continue
		}
		result, err := MaterializeAssetBinding(ctx, AssetBindingRequest{
			UserID:       userID,
			PublicID:     reference.PublicID,
			Channel:      channel,
			LeaseOwner:   assetBindingLeaseOwner(),
			PollLimit:    assetBindingDefaultPollLimit,
			PollDelay:    assetBindingDefaultPollDelay,
			LeaseTTL:     assetBindingDefaultLeaseTTL,
			ExpectedType: reference.ExpectedAssetType,
			Model:        materializeOptions.Model,
			APIKey:       materializeOptions.APIKey,
		})
		if err != nil {
			return nil, err
		}
		if strings.TrimSpace(result.RewriteURI) == "" {
			return nil, ErrAssetBindingUnavailable
		}
		rewriteMap[result.PublicURI] = result.RewriteURI
	}
	if len(rewriteMap) != len(set.references) {
		return nil, ErrAssetBindingUnavailable
	}
	return rewriteMap, nil
}

func MaterializeAssetBinding(ctx context.Context, request AssetBindingRequest) (AssetBindingResult, error) {
	if ctx == nil {
		ctx = context.Background()
	}
	if request.Channel == nil || request.Channel.Id <= 0 {
		return AssetBindingResult{}, ErrAssetBindingUnavailable
	}
	asset, err := model.GetAssetByPublicIDForUser(request.UserID, strings.TrimSpace(request.PublicID))
	if err != nil {
		return AssetBindingResult{}, sanitizeAssetBindingError(err)
	}
	if request.ExpectedType != "" && asset.AssetType != request.ExpectedType {
		return AssetBindingResult{}, ErrAssetBindingUnavailable
	}
	if asset.Status != model.AssetStatusActive {
		return AssetBindingResult{}, ErrAssetBindingUnavailable
	}
	options := AssetMaterializeOptions{Model: request.Model, APIKey: request.APIKey}
	legacyScope, legacyMaterializer, legacyRecovery := legacyTechMobiProcessingRecoveryBinding(request.Channel, options, asset.Id)
	if !channelCanConsumeAssetType(request.Channel, asset.AssetType) && !legacyRecovery {
		return AssetBindingResult{}, ErrAssetBindingUnavailable
	}
	bindingScope, err := assetBindingScopeForChannel(request.Channel, options)
	var existing *model.AssetBinding
	var existingErr error
	var recoveryMaterializer AssetMaterializer
	if err != nil {
		if !legacyRecovery {
			return AssetBindingResult{}, err
		}
		bindingScope = legacyScope
		recoveryMaterializer = legacyMaterializer
		existing, existingErr = model.GetAssetBindingForScope(asset.Id, request.Channel.Id, bindingScope)
	} else {
		existing, existingErr = model.GetAssetBindingForScope(asset.Id, request.Channel.Id, bindingScope)
	}
	owner := strings.TrimSpace(request.LeaseOwner)
	if owner == "" {
		owner = assetBindingLeaseOwner()
	}
	pollLimit := request.PollLimit
	if pollLimit <= 0 {
		pollLimit = assetBindingDefaultPollLimit
	}
	pollDelay := request.PollDelay
	if pollDelay < 0 {
		pollDelay = 0
	}
	leaseTTL := request.LeaseTTL
	if leaseTTL <= 0 {
		leaseTTL = assetBindingDefaultLeaseTTL
	}
	if existingErr != nil && !errors.Is(existingErr, gorm.ErrRecordNotFound) {
		return AssetBindingResult{}, sanitizeAssetBindingError(existingErr)
	}
	if activeAssetBinding(existing) {
		return assetBindingResult(asset.PublicId, *existing), nil
	}
	if processingAssetBinding(existing) {
		result, handled, err := handleProcessingAssetBinding(ctx, asset, request.Channel, bindingScope, request.Model, request.APIKey, existing.UpstreamAssetId, pollLimit, pollDelay)
		if err != nil {
			return AssetBindingResult{}, err
		}
		if handled {
			return result, nil
		}
	}
	if !assetReferenceSourceRecoverable(assetReferenceAsset{
		SourceStatus:    asset.SourceStatus,
		StorageBackend:  asset.StorageBackend,
		StorageBucket:   asset.StorageBucket,
		ObjectKey:       asset.ObjectKey,
		SourceExpiresAt: asset.SourceExpiresAt,
	}) {
		return AssetBindingResult{}, ErrAssetBindingUnavailable
	}

	now := assetBindingNow().Unix()
	binding, _, err := model.CreateAssetBindingForScopeIfAbsent(asset.Id, request.Channel.Id, bindingScope, now)
	if err != nil {
		return AssetBindingResult{}, sanitizeAssetBindingError(err)
	}
	if activeAssetBinding(binding) {
		if binding.BindingScope != bindingScope {
			return AssetBindingResult{}, ErrAssetBindingUnavailable
		}
		return assetBindingResult(asset.PublicId, *binding), nil
	}
	if processingAssetBinding(binding) {
		result, handled, err := handleProcessingAssetBinding(ctx, asset, request.Channel, bindingScope, request.Model, request.APIKey, binding.UpstreamAssetId, pollLimit, pollDelay)
		if err != nil {
			return AssetBindingResult{}, err
		}
		if handled {
			return result, nil
		}
	}
	rematerializationRetryAvailable := true
	for attempt := 0; attempt < pollLimit; {
		now = assetBindingNow().Unix()
		leaseExpiresAt := now + int64(leaseTTL.Seconds())
		claimed, err := model.ClaimAssetBindingForScopeLease(asset.Id, request.Channel.Id, bindingScope, owner, now, leaseExpiresAt)
		if err != nil {
			return AssetBindingResult{}, sanitizeAssetBindingError(err)
		}
		if claimed {
			return createLeasedAssetBinding(ctx, asset, request.Channel, owner, leaseExpiresAt, pollLimit, pollDelay, request.Model, request.APIKey, bindingScope, recoveryMaterializer)
		}
		loaded, err := model.GetAssetBindingForScope(asset.Id, request.Channel.Id, bindingScope)
		if err != nil {
			return AssetBindingResult{}, sanitizeAssetBindingError(err)
		}
		if activeAssetBinding(loaded) {
			if loaded.BindingScope != bindingScope {
				return AssetBindingResult{}, ErrAssetBindingUnavailable
			}
			return assetBindingResult(asset.PublicId, *loaded), nil
		}
		if processingAssetBinding(loaded) {
			result, handled, err := handleProcessingAssetBinding(ctx, asset, request.Channel, bindingScope, request.Model, request.APIKey, loaded.UpstreamAssetId, pollLimit, pollDelay)
			if err != nil {
				return AssetBindingResult{}, err
			}
			if handled {
				return result, nil
			}
			if rematerializationRetryAvailable {
				rematerializationRetryAvailable = false
				continue
			}
			return AssetBindingResult{}, ErrAssetBindingInitializing
		}
		attempt++
		if attempt < pollLimit {
			if err := assetBindingPollSleep(ctx, pollDelay); err != nil {
				return AssetBindingResult{}, sanitizeAssetBindingError(err)
			}
		}
	}
	return AssetBindingResult{}, ErrAssetBindingInitializing
}

func handleProcessingAssetBinding(ctx context.Context, asset *model.Asset, channel *model.Channel, bindingScope string, modelName string, apiKey string, upstreamAssetID string, pollLimit int, pollDelay time.Duration) (AssetBindingResult, bool, error) {
	if !assetBindingRequiresRematerializationFromProcessing(channel) {
		result, err := refreshProcessingAssetBinding(ctx, asset, channel, bindingScope, modelName, apiKey, upstreamAssetID, pollLimit, pollDelay)
		return result, true, err
	}
	rematerialized, err := markProcessingAssetBindingForRematerialization(asset.Id, channel.Id, bindingScope, upstreamAssetID)
	if err != nil {
		return AssetBindingResult{}, false, sanitizeAssetBindingError(err)
	}
	if !rematerialized {
		return AssetBindingResult{}, false, ErrAssetBindingInitializing
	}
	return AssetBindingResult{}, false, nil
}

func assetBindingRequiresRematerializationFromProcessing(channel *model.Channel) bool {
	if channel == nil || channel.Type != constant.ChannelTypeTechMobiVideo {
		return false
	}
	_, explicit, err := assetMaterializationConfigForChannel(channel)
	if err != nil {
		return explicit && hasKnownExplicitAssetMaterializationProvider(channel)
	}
	return !explicit
}

func hasKnownExplicitAssetMaterializationProvider(channel *model.Channel) bool {
	if channel == nil {
		return false
	}
	settings := channel.GetOtherSettings().AssetMaterialization
	if settings == nil {
		return false
	}
	provider := strings.TrimSpace(settings.Provider)
	if provider == "" {
		return false
	}
	_, ok := assetMaterializationProviderDescriptors[provider]
	return ok
}

func legacyTechMobiProcessingRecoveryBinding(channel *model.Channel, options AssetMaterializeOptions, assetID int64) (string, AssetMaterializer, bool) {
	if channel == nil || channel.Type != constant.ChannelTypeTechMobiVideo {
		return "", nil, false
	}
	_, explicit, err := assetMaterializationConfigForChannel(channel)
	if err == nil || !explicit || !hasKnownExplicitAssetMaterializationProvider(channel) {
		return "", nil, false
	}
	scope, err := assetBindingScope(channel.Type, options)
	if err != nil {
		return "", nil, false
	}
	binding, err := model.GetAssetBindingForScope(assetID, channel.Id, scope)
	if err != nil || !processingAssetBinding(binding) {
		return "", nil, false
	}
	materializer, ok := assetMaterializerForChannelType(channel.Type)
	if !ok || materializer == nil {
		return "", nil, false
	}
	return scope, materializer, true
}

func markProcessingAssetBindingForRematerialization(assetID int64, channelID int, bindingScope string, upstreamAssetID string) (bool, error) {
	return model.RefreshProcessingAssetBindingCAS(model.AssetBindingProcessingRefresh{
		AssetID:         assetID,
		ChannelID:       channelID,
		BindingScope:    bindingScope,
		UpstreamAssetID: upstreamAssetID,
		Status:          model.AssetStatusFailed,
		ErrorCode:       AssetMaterializeErrorProcessing,
		Now:             assetBindingNow().Unix(),
	})
}

func createLeasedAssetBinding(ctx context.Context, asset *model.Asset, channel *model.Channel, owner string, expectedLeaseExpiresAt int64, pollLimit int, pollDelay time.Duration, modelName string, apiKey string, bindingScope string, materializerOverride AssetMaterializer) (AssetBindingResult, error) {
	materializer := materializerOverride
	if materializer == nil {
		var err error
		materializer, err = assetMaterializerForChannel(channel)
		if err != nil {
			_, _ = model.FailAssetBindingForScopeLeaseCAS(asset.Id, channel.Id, bindingScope, owner, expectedLeaseExpiresAt, "asset_channel_unavailable", assetBindingNow().Unix())
			return AssetBindingResult{}, ErrAssetBindingUnavailable
		}
		if materializer == nil {
			_, _ = model.FailAssetBindingForScopeLeaseCAS(asset.Id, channel.Id, bindingScope, owner, expectedLeaseExpiresAt, "asset_channel_unavailable", assetBindingNow().Unix())
			return AssetBindingResult{}, ErrAssetBindingUnavailable
		}
	}
	result, err := materializer.CreateAsset(ctx, AssetMaterializeInput{
		UserID:         asset.UserId,
		Asset:          *asset,
		Channel:        channel,
		Model:          modelName,
		APIKey:         apiKey,
		IdempotencyKey: assetBindingIdempotencyKey(asset.SHA256, asset.Id, channel.Id, bindingScope),
		SignSource:     signAssetBindingSourceURL,
	})
	if err != nil {
		errorClass := AssetMaterializeErrorClass(err)
		if IsRetryableAssetMaterializeError(err) {
			_, _ = model.ReleaseAssetBindingForRetryLeaseCAS(asset.Id, channel.Id, bindingScope, owner, expectedLeaseExpiresAt, errorClass, assetBindingNow().Unix())
			return AssetBindingResult{}, ErrAssetBindingInitializing
		}
		errorCode := assetBindingProviderErrorCode
		if errorClass == AssetMaterializeErrorDefinitive {
			errorCode = errorClass
		}
		_, _ = model.FailAssetBindingForScopeLeaseCAS(asset.Id, channel.Id, bindingScope, owner, expectedLeaseExpiresAt, errorCode, assetBindingNow().Unix())
		return AssetBindingResult{}, sanitizeAssetBindingError(err)
	}
	if strings.TrimSpace(result.UpstreamAssetID) == "" {
		_, _ = model.FailAssetBindingForScopeLeaseCAS(asset.Id, channel.Id, bindingScope, owner, expectedLeaseExpiresAt, assetBindingProviderErrorCode, assetBindingNow().Unix())
		return AssetBindingResult{}, ErrAssetBindingUnavailable
	}
	status := strings.TrimSpace(result.Status)
	if status == "" {
		status = model.AssetStatusActive
	}
	if status == model.AssetStatusFailed {
		_, _ = model.FailAssetBindingForScopeLeaseCAS(asset.Id, channel.Id, bindingScope, owner, expectedLeaseExpiresAt, AssetMaterializeErrorDefinitive, assetBindingNow().Unix())
		return AssetBindingResult{}, ErrAssetBindingUnavailable
	}
	activated, err := model.ActivateAssetBindingWithAssetCAS(model.AssetBindingActivation{
		AssetID:                asset.Id,
		ChannelID:              channel.Id,
		BindingScope:           bindingScope,
		LeaseOwner:             owner,
		ExpectedLeaseExpiresAt: expectedLeaseExpiresAt,
		UpstreamGroupID:        result.UpstreamGroupID,
		UpstreamAssetID:        result.UpstreamAssetID,
		Status:                 status,
		Now:                    assetBindingNow().Unix(),
	})
	if err != nil {
		recovered, recoveryErr := recoverAssetBindingAfterProviderResult(ctx, materializer, asset, channel, bindingScope, modelName, apiKey, owner, expectedLeaseExpiresAt, result, status, pollLimit, pollDelay)
		if recoveryErr == nil {
			return recovered, nil
		}
		return AssetBindingResult{}, sanitizeAssetBindingError(err)
	}
	if !activated {
		recovered, recoveryErr := recoverAssetBindingAfterProviderResult(ctx, materializer, asset, channel, bindingScope, modelName, apiKey, owner, expectedLeaseExpiresAt, result, status, pollLimit, pollDelay)
		if recoveryErr == nil {
			return recovered, nil
		}
		return AssetBindingResult{}, ErrAssetBindingInitializing
	}
	if status == model.AssetStatusProcessing {
		return refreshProcessingAssetBinding(ctx, asset, channel, bindingScope, modelName, apiKey, result.UpstreamAssetID, pollLimit, pollDelay)
	}
	loaded, err := model.GetAssetBindingForScope(asset.Id, channel.Id, bindingScope)
	if err != nil {
		return AssetBindingResult{}, sanitizeAssetBindingError(err)
	}
	if !activeAssetBinding(loaded) {
		if _, getErr := materializer.GetAsset(ctx, AssetMaterializeInput{UserID: asset.UserId, Asset: *asset, Channel: channel, Model: modelName, APIKey: apiKey}, result.UpstreamAssetID); getErr != nil {
			return AssetBindingResult{}, sanitizeAssetBindingError(getErr)
		}
		return AssetBindingResult{}, ErrAssetBindingInitializing
	}
	return assetBindingResult(asset.PublicId, *loaded), nil
}

func recoverAssetBindingAfterProviderResult(ctx context.Context, materializer AssetMaterializer, asset *model.Asset, channel *model.Channel, bindingScope string, modelName string, apiKey string, owner string, expectedLeaseExpiresAt int64, result AssetMaterializeResult, status string, pollLimit int, pollDelay time.Duration) (AssetBindingResult, error) {
	loaded, err := model.GetAssetBindingForScope(asset.Id, channel.Id, bindingScope)
	if err != nil {
		return AssetBindingResult{}, err
	}
	if loaded.Status == model.AssetBindingStatusLeased &&
		loaded.LeaseOwner == owner &&
		loaded.LeaseExpiresAt == expectedLeaseExpiresAt {
		activated, err := model.ActivateAssetBindingWithAssetCAS(model.AssetBindingActivation{
			AssetID:                asset.Id,
			ChannelID:              channel.Id,
			BindingScope:           bindingScope,
			LeaseOwner:             owner,
			ExpectedLeaseExpiresAt: expectedLeaseExpiresAt,
			UpstreamGroupID:        result.UpstreamGroupID,
			UpstreamAssetID:        result.UpstreamAssetID,
			Status:                 status,
			Now:                    assetBindingNow().Unix(),
		})
		if err != nil {
			return AssetBindingResult{}, err
		}
		if activated {
			loaded, err = model.GetAssetBindingForScope(asset.Id, channel.Id, bindingScope)
			if err != nil {
				return AssetBindingResult{}, err
			}
		}
	}
	if !sameAssetBindingProviderResult(loaded, result, status) {
		return AssetBindingResult{}, ErrAssetBindingInitializing
	}
	if activeAssetBinding(loaded) {
		return assetBindingResult(asset.PublicId, *loaded), nil
	}
	if processingAssetBinding(loaded) {
		if status == model.AssetStatusProcessing {
			return refreshProcessingAssetBinding(ctx, asset, channel, bindingScope, modelName, apiKey, loaded.UpstreamAssetId, pollLimit, pollDelay)
		}
		if _, getErr := materializer.GetAsset(ctx, AssetMaterializeInput{
			UserID:         asset.UserId,
			Asset:          *asset,
			Channel:        channel,
			Model:          modelName,
			APIKey:         apiKey,
			IdempotencyKey: assetBindingIdempotencyKey(asset.SHA256, asset.Id, channel.Id, bindingScope),
		}, loaded.UpstreamAssetId); getErr != nil {
			return AssetBindingResult{}, getErr
		}
		return AssetBindingResult{}, ErrAssetBindingInitializing
	}
	return AssetBindingResult{}, ErrAssetBindingInitializing
}

func sameAssetBindingProviderResult(binding *model.AssetBinding, result AssetMaterializeResult, status string) bool {
	if binding == nil {
		return false
	}
	if strings.TrimSpace(binding.UpstreamAssetId) != strings.TrimSpace(result.UpstreamAssetID) {
		return false
	}
	if strings.TrimSpace(result.UpstreamGroupID) != "" && strings.TrimSpace(binding.UpstreamGroupId) != strings.TrimSpace(result.UpstreamGroupID) {
		return false
	}
	if status == "" {
		status = model.AssetStatusActive
	}
	return binding.Status == status
}

func ResolveAssetMaterializeOptions(set AssetReferenceSet, channel *model.Channel, options AssetMaterializeOptions) (AssetMaterializeOptions, int, error) {
	if channel == nil || !set.HasReferences() {
		return options, -1, nil
	}
	config, explicit, err := assetMaterializationConfigForChannel(channel)
	if err != nil {
		return AssetMaterializeOptions{}, -1, err
	}
	if set.strictCoverage {
		if set.target == nil {
			return AssetMaterializeOptions{}, -1, ErrAssetBindingInitializing
		}
		if !assetReferenceTargetMatchesScope(set.scope, *set.target, set.target.ModelName) {
			return AssetMaterializeOptions{}, -1, ErrAssetBindingUnavailable
		}
		targetOptions, index, err := ResolveAssetModelTargetOptions(*set.target, channel)
		if err != nil {
			return AssetMaterializeOptions{}, -1, err
		}
		scope, err := assetBindingScopeForChannel(channel, targetOptions)
		if err != nil {
			return AssetMaterializeOptions{}, -1, err
		}
		if scope != set.target.BindingScope {
			return AssetMaterializeOptions{}, -1, ErrAssetBindingUnavailable
		}
		return targetOptions, index, nil
	}
	if explicit {
		switch config.Provider {
		case assetMaterializationProviderSeedanceProxy, assetMaterializationProviderTokenSpaceMaterial:
		default:
			return AssetMaterializeOptions{}, -1, ErrAssetBindingUnavailable
		}
		keys := enabledAssetMaterializeKeys(channel)
		if len(keys) == 0 {
			return AssetMaterializeOptions{}, -1, ErrAssetBindingUnavailable
		}
		selectedKey := strings.TrimSpace(options.APIKey)
		bestScore := -1
		bestIndex := -1
		bestKey := ""
		for _, candidate := range keys {
			candidateOptions := AssetMaterializeOptions{Model: options.Model, APIKey: candidate.key}
			scope, err := assetBindingScopeForChannel(channel, candidateOptions)
			if err != nil {
				continue
			}
			score := 0
			feasible := true
			for _, reference := range set.references {
				asset := set.assets[reference.PublicID]
				if _, ok := activeAssetReferenceBindingForScope(asset.Bindings, channel.Id, scope); ok {
					score++
					continue
				}
				if !assetReferenceSourceRecoverable(asset) {
					feasible = false
					break
				}
			}
			if !feasible {
				continue
			}
			if score > bestScore || (score == bestScore && strings.TrimSpace(candidate.key) == selectedKey) {
				bestScore = score
				bestIndex = candidate.index
				bestKey = candidate.key
			}
		}
		if bestScore < 0 {
			return AssetMaterializeOptions{}, -1, ErrAssetBindingUnavailable
		}
		options.APIKey = bestKey
		return options, bestIndex, nil
	}
	if channel.Type != constant.ChannelTypeTechMobiVideo {
		return options, -1, nil
	}
	keys := enabledAssetMaterializeKeys(channel)
	if len(keys) == 0 {
		return AssetMaterializeOptions{}, -1, ErrAssetBindingUnavailable
	}
	selectedKey := strings.TrimSpace(options.APIKey)
	bestScore := -1
	bestIndex := -1
	bestKey := ""
	for _, candidate := range keys {
		candidateOptions := AssetMaterializeOptions{Model: options.Model, APIKey: candidate.key}
		scope, err := assetBindingScopeForChannel(channel, candidateOptions)
		if err != nil {
			continue
		}
		score := 0
		feasible := true
		for _, reference := range set.references {
			asset := set.assets[reference.PublicID]
			if _, ok := activeAssetReferenceBindingForScope(asset.Bindings, channel.Id, scope); ok {
				score++
				continue
			}
			if !assetReferenceSourceRecoverable(asset) {
				feasible = false
				break
			}
		}
		if !feasible {
			continue
		}
		if score > bestScore || (score == bestScore && strings.TrimSpace(candidate.key) == selectedKey) {
			bestScore = score
			bestIndex = candidate.index
			bestKey = candidate.key
		}
	}
	if bestScore < 0 {
		return AssetMaterializeOptions{}, -1, ErrAssetBindingUnavailable
	}
	options.APIKey = bestKey
	return options, bestIndex, nil
}

type assetMaterializeKey struct {
	key   string
	index int
}

func enabledAssetMaterializeKeys(channel *model.Channel) []assetMaterializeKey {
	if channel == nil {
		return nil
	}
	if !channel.ChannelInfo.IsMultiKey {
		key := strings.TrimSpace(channel.Key)
		if key == "" {
			return nil
		}
		return []assetMaterializeKey{{key: key, index: 0}}
	}
	keys := channel.GetKeys()
	enabled := make([]assetMaterializeKey, 0, len(keys))
	for index, key := range keys {
		status, exists := channel.ChannelInfo.MultiKeyStatusList[index]
		if exists && status != common.ChannelStatusEnabled {
			continue
		}
		key = strings.TrimSpace(key)
		if key != "" {
			enabled = append(enabled, assetMaterializeKey{key: key, index: index})
		}
	}
	return enabled
}

func assetBindingScope(channelType int, options AssetMaterializeOptions) (string, error) {
	if channelType != constant.ChannelTypeTechMobiVideo {
		return "", nil
	}
	modelName := strings.TrimSpace(options.Model)
	apiKey := strings.TrimSpace(options.APIKey)
	if modelName == "" || apiKey == "" {
		return "", ErrAssetBindingUnavailable
	}
	digest := sha256.Sum256([]byte(modelName + "\x00" + apiKey))
	return "techmobi:v1:" + hex.EncodeToString(digest[:]), nil
}

func assetBindingScopeForChannel(channel *model.Channel, options AssetMaterializeOptions) (string, error) {
	if channel == nil {
		return "", nil
	}
	config, explicit, err := assetMaterializationConfigForChannel(channel)
	if err != nil {
		return "", err
	}
	if explicit {
		descriptor, ok := assetMaterializationProviderDescriptors[config.Provider]
		if !ok || descriptor.BindingScope == nil {
			return "", ErrAssetBindingUnavailable
		}
		return descriptor.BindingScope(config, options)
	}
	return assetBindingScope(channel.Type, options)
}

func activeAssetReferenceBindingForScope(bindings []assetReferenceBinding, channelID int, bindingScope string) (assetReferenceBinding, bool) {
	for _, binding := range bindings {
		if binding.ChannelID == channelID && binding.BindingScope == bindingScope && isActiveAssetReferenceBinding(binding) {
			return binding, true
		}
	}
	return assetReferenceBinding{}, false
}

func refreshProcessingAssetBinding(ctx context.Context, asset *model.Asset, channel *model.Channel, bindingScope string, modelName string, apiKey string, upstreamAssetID string, pollLimit int, pollDelay time.Duration) (AssetBindingResult, error) {
	if strings.TrimSpace(upstreamAssetID) == "" {
		return AssetBindingResult{}, ErrAssetBindingUnavailable
	}
	materializer, err := assetMaterializerForChannel(channel)
	if err != nil {
		return AssetBindingResult{}, ErrAssetBindingUnavailable
	}
	if materializer == nil {
		return AssetBindingResult{}, ErrAssetBindingUnavailable
	}
	for attempt := 0; attempt < pollLimit; attempt++ {
		result, err := materializer.GetAsset(ctx, AssetMaterializeInput{
			UserID:         asset.UserId,
			Asset:          *asset,
			Channel:        channel,
			Model:          modelName,
			APIKey:         apiKey,
			IdempotencyKey: assetBindingIdempotencyKey(asset.SHA256, asset.Id, channel.Id, bindingScope),
		}, upstreamAssetID)
		if err != nil {
			if IsRetryableAssetMaterializeError(err) {
				return AssetBindingResult{}, err
			}
			_, _ = model.RefreshProcessingAssetBindingCAS(model.AssetBindingProcessingRefresh{
				AssetID:         asset.Id,
				ChannelID:       channel.Id,
				BindingScope:    bindingScope,
				UpstreamAssetID: upstreamAssetID,
				Status:          model.AssetStatusFailed,
				ErrorCode:       assetBindingProviderErrorCode,
				Now:             assetBindingNow().Unix(),
			})
			return AssetBindingResult{}, sanitizeAssetBindingError(err)
		}
		status := strings.TrimSpace(result.Status)
		if status == "" {
			status = model.AssetStatusProcessing
		}
		observedUpstreamID := strings.TrimSpace(result.UpstreamAssetID)
		if observedUpstreamID != "" && observedUpstreamID != upstreamAssetID {
			_, _ = model.RefreshProcessingAssetBindingCAS(model.AssetBindingProcessingRefresh{
				AssetID:         asset.Id,
				ChannelID:       channel.Id,
				BindingScope:    bindingScope,
				UpstreamAssetID: upstreamAssetID,
				Status:          model.AssetStatusFailed,
				ErrorCode:       assetBindingProviderErrorCode,
				Now:             assetBindingNow().Unix(),
			})
			return AssetBindingResult{}, ErrAssetBindingUnavailable
		}
		switch status {
		case model.AssetStatusActive:
			updated, err := model.RefreshProcessingAssetBindingCAS(model.AssetBindingProcessingRefresh{
				AssetID:         asset.Id,
				ChannelID:       channel.Id,
				BindingScope:    bindingScope,
				UpstreamAssetID: upstreamAssetID,
				Status:          model.AssetStatusActive,
				Now:             assetBindingNow().Unix(),
			})
			if err != nil {
				return AssetBindingResult{}, sanitizeAssetBindingError(err)
			}
			if !updated {
				return AssetBindingResult{}, ErrAssetBindingInitializing
			}
			loaded, err := model.GetAssetBindingForScope(asset.Id, channel.Id, bindingScope)
			if err != nil {
				return AssetBindingResult{}, sanitizeAssetBindingError(err)
			}
			if !activeAssetBinding(loaded) {
				return AssetBindingResult{}, ErrAssetBindingInitializing
			}
			return assetBindingResult(asset.PublicId, *loaded), nil
		case model.AssetStatusFailed:
			_, _ = model.RefreshProcessingAssetBindingCAS(model.AssetBindingProcessingRefresh{
				AssetID:         asset.Id,
				ChannelID:       channel.Id,
				BindingScope:    bindingScope,
				UpstreamAssetID: upstreamAssetID,
				Status:          model.AssetStatusFailed,
				ErrorCode:       assetBindingProviderErrorCode,
				Now:             assetBindingNow().Unix(),
			})
			return AssetBindingResult{}, ErrAssetBindingUnavailable
		case model.AssetStatusProcessing:
			if attempt+1 < pollLimit {
				if err := assetBindingPollSleep(ctx, pollDelay); err != nil {
					return AssetBindingResult{}, sanitizeAssetBindingError(err)
				}
			}
		default:
			_, _ = model.RefreshProcessingAssetBindingCAS(model.AssetBindingProcessingRefresh{
				AssetID:         asset.Id,
				ChannelID:       channel.Id,
				BindingScope:    bindingScope,
				UpstreamAssetID: upstreamAssetID,
				Status:          model.AssetStatusFailed,
				ErrorCode:       assetBindingProviderErrorCode,
				Now:             assetBindingNow().Unix(),
			})
			return AssetBindingResult{}, ErrAssetBindingUnavailable
		}
	}
	return AssetBindingResult{}, ErrAssetBindingInitializing
}

func signAssetBindingSourceURL(ctx context.Context, asset model.Asset) (string, error) {
	return SignAssetSourceURL(ctx, asset, CurrentAssetStorageConfig())
}

func activeAssetBinding(binding *model.AssetBinding) bool {
	return binding != nil && binding.Status == model.AssetStatusActive && strings.TrimSpace(binding.UpstreamAssetId) != ""
}

func processingAssetBinding(binding *model.AssetBinding) bool {
	return binding != nil && binding.Status == model.AssetStatusProcessing && strings.TrimSpace(binding.UpstreamAssetId) != ""
}

func assetBindingResult(publicID string, binding model.AssetBinding) AssetBindingResult {
	return AssetBindingResult{
		PublicURI:  "asset://" + publicID,
		RewriteURI: assetBindingRewriteURI(binding.UpstreamAssetId),
		Binding:    binding,
	}
}

func assetBindingRewriteURI(upstreamAssetID string) string {
	trimmed := strings.TrimSpace(upstreamAssetID)
	if trimmed == "" {
		return ""
	}
	if strings.HasPrefix(trimmed, "asset://") {
		return trimmed
	}
	return "asset://" + trimmed
}

func assetBindingLeaseOwner() string {
	return fmt.Sprintf("pid-%d-%d", time.Now().UnixNano(), common.GetTimestamp())
}

func assetBindingIdempotencyKey(sourceSHA256 string, assetID int64, channelID int, bindingScope string) string {
	hash := sha256.New()
	writeAssetBindingKeyField(hash, strings.TrimSpace(sourceSHA256))
	var intBuf [8]byte
	binary.BigEndian.PutUint64(intBuf[:], uint64(assetID))
	_, _ = hash.Write(intBuf[:])
	binary.BigEndian.PutUint64(intBuf[:], uint64(channelID))
	_, _ = hash.Write(intBuf[:])
	writeAssetBindingKeyField(hash, strings.TrimSpace(bindingScope))
	return hex.EncodeToString(hash.Sum(nil))
}

func writeAssetBindingKeyField(hash interface{ Write([]byte) (int, error) }, value string) {
	var lenBuf [8]byte
	binary.BigEndian.PutUint64(lenBuf[:], uint64(len(value)))
	_, _ = hash.Write(lenBuf[:])
	_, _ = hash.Write([]byte(value))
}

func sanitizeAssetBindingError(err error) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, ErrAssetBindingInitializing) || errors.Is(err, ErrAssetBindingUnavailable) {
		return err
	}
	return ErrAssetBindingUnavailable
}

func AssetBindingAPIError(err error) *types.NewAPIError {
	if errors.Is(err, ErrAssetBindingInitializing) || IsRetryableAssetMaterializeError(err) {
		return assetError(err, types.ErrorCodeAssetNotReady, http.StatusConflict)
	}
	return assetError(err, types.ErrorCodeAssetChannelUnavailable, http.StatusServiceUnavailable)
}
