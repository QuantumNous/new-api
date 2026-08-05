package service

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/types"
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

type AssetMaterializer interface {
	CreateAsset(ctx context.Context, input AssetMaterializeInput) (AssetMaterializeResult, error)
	GetAsset(ctx context.Context, input AssetMaterializeInput, upstreamAssetID string) (AssetMaterializeResult, error)
}

type AssetMaterializeInput struct {
	UserID     int
	Asset      model.Asset
	Channel    *model.Channel
	SourceURL  string
	SignSource func(context.Context, model.Asset) (string, error)
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
}

type AssetBindingResult struct {
	PublicURI  string
	RewriteURI string
	Binding    model.AssetBinding
}

func init() {
	RegisterAssetMaterializer(constant.ChannelTypeBytePlus, bytePlusAssetBindingMaterializer{})
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

func assetMaterializerForChannel(channelType int) (AssetMaterializer, bool) {
	assetMaterializersMu.RLock()
	defer assetMaterializersMu.RUnlock()
	materializer, ok := assetMaterializers[channelType]
	return materializer, ok
}

func MaterializeAssetBindingsForChannel(ctx context.Context, userID int, set AssetReferenceSet, channel *model.Channel) (map[string]string, error) {
	if !set.HasReferences() || channel == nil {
		return nil, nil
	}
	rewriteMap := make(map[string]string, len(set.references))
	for _, reference := range set.references {
		asset := set.assets[reference.PublicID]
		if binding, ok := activeAssetReferenceBindingForChannel(asset.Bindings, channel.Id); ok {
			rewriteMap["asset://"+reference.PublicID] = "asset://" + strings.TrimSpace(binding.UpstreamAssetID)
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
	if asset.Status != model.AssetStatusActive || !assetReferenceSourceRecoverable(assetReferenceAsset{
		SourceStatus:    asset.SourceStatus,
		StorageBackend:  asset.StorageBackend,
		StorageBucket:   asset.StorageBucket,
		ObjectKey:       asset.ObjectKey,
		SourceExpiresAt: asset.SourceExpiresAt,
	}) {
		return AssetBindingResult{}, ErrAssetBindingUnavailable
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

	now := assetBindingNow().Unix()
	binding, _, err := model.CreateAssetBindingIfAbsent(asset.Id, request.Channel.Id, now)
	if err != nil {
		return AssetBindingResult{}, sanitizeAssetBindingError(err)
	}
	if activeAssetBinding(binding) {
		return assetBindingResult(asset.PublicId, *binding), nil
	}
	if processingAssetBinding(binding) {
		return refreshProcessingAssetBinding(ctx, asset, request.Channel, binding.UpstreamAssetId, pollLimit, pollDelay)
	}
	for attempt := 0; attempt < pollLimit; attempt++ {
		now = assetBindingNow().Unix()
		claimed, err := model.ClaimAssetBindingLease(asset.Id, request.Channel.Id, owner, now, now+int64(leaseTTL.Seconds()))
		if err != nil {
			return AssetBindingResult{}, sanitizeAssetBindingError(err)
		}
		if claimed {
			return createLeasedAssetBinding(ctx, asset, request.Channel, owner, pollLimit, pollDelay)
		}
		loaded, err := model.GetAssetBinding(asset.Id, request.Channel.Id)
		if err != nil {
			return AssetBindingResult{}, sanitizeAssetBindingError(err)
		}
		if activeAssetBinding(loaded) {
			return assetBindingResult(asset.PublicId, *loaded), nil
		}
		if processingAssetBinding(loaded) {
			return refreshProcessingAssetBinding(ctx, asset, request.Channel, loaded.UpstreamAssetId, pollLimit, pollDelay)
		}
		if attempt+1 < pollLimit {
			if err := assetBindingPollSleep(ctx, pollDelay); err != nil {
				return AssetBindingResult{}, sanitizeAssetBindingError(err)
			}
		}
	}
	return AssetBindingResult{}, ErrAssetBindingInitializing
}

func createLeasedAssetBinding(ctx context.Context, asset *model.Asset, channel *model.Channel, owner string, pollLimit int, pollDelay time.Duration) (AssetBindingResult, error) {
	materializer, ok := assetMaterializerForChannel(channel.Type)
	if !ok {
		_, _ = model.FailAssetBindingCAS(asset.Id, channel.Id, owner, "asset channel unavailable", assetBindingNow().Unix())
		return AssetBindingResult{}, ErrAssetBindingUnavailable
	}
	result, err := materializer.CreateAsset(ctx, AssetMaterializeInput{
		UserID:     asset.UserId,
		Asset:      *asset,
		Channel:    channel,
		SignSource: signAssetBindingSourceURL,
	})
	if err != nil {
		_, _ = model.FailAssetBindingCAS(asset.Id, channel.Id, owner, assetBindingProviderErrorCode, assetBindingNow().Unix())
		return AssetBindingResult{}, sanitizeAssetBindingError(err)
	}
	if strings.TrimSpace(result.UpstreamAssetID) == "" {
		_, _ = model.FailAssetBindingCAS(asset.Id, channel.Id, owner, assetBindingProviderErrorCode, assetBindingNow().Unix())
		return AssetBindingResult{}, ErrAssetBindingUnavailable
	}
	status := strings.TrimSpace(result.Status)
	if status == "" {
		status = model.AssetStatusActive
	}
	if status == model.AssetStatusFailed {
		_, _ = model.FailAssetBindingCAS(asset.Id, channel.Id, owner, assetBindingProviderErrorCode, assetBindingNow().Unix())
		return AssetBindingResult{}, ErrAssetBindingUnavailable
	}
	activated, err := model.ActivateAssetBindingWithAssetCAS(model.AssetBindingActivation{
		AssetID:         asset.Id,
		ChannelID:       channel.Id,
		LeaseOwner:      owner,
		UpstreamGroupID: result.UpstreamGroupID,
		UpstreamAssetID: result.UpstreamAssetID,
		Status:          status,
		Now:             assetBindingNow().Unix(),
	})
	if err != nil {
		return AssetBindingResult{}, sanitizeAssetBindingError(err)
	}
	if !activated {
		return AssetBindingResult{}, ErrAssetBindingInitializing
	}
	if status == model.AssetStatusProcessing {
		return refreshProcessingAssetBinding(ctx, asset, channel, result.UpstreamAssetID, pollLimit, pollDelay)
	}
	loaded, err := model.GetAssetBinding(asset.Id, channel.Id)
	if err != nil {
		return AssetBindingResult{}, sanitizeAssetBindingError(err)
	}
	if !activeAssetBinding(loaded) {
		if _, getErr := materializer.GetAsset(ctx, AssetMaterializeInput{UserID: asset.UserId, Asset: *asset, Channel: channel}, result.UpstreamAssetID); getErr != nil {
			return AssetBindingResult{}, sanitizeAssetBindingError(getErr)
		}
		return AssetBindingResult{}, ErrAssetBindingInitializing
	}
	return assetBindingResult(asset.PublicId, *loaded), nil
}

func refreshProcessingAssetBinding(ctx context.Context, asset *model.Asset, channel *model.Channel, upstreamAssetID string, pollLimit int, pollDelay time.Duration) (AssetBindingResult, error) {
	if strings.TrimSpace(upstreamAssetID) == "" {
		return AssetBindingResult{}, ErrAssetBindingUnavailable
	}
	materializer, ok := assetMaterializerForChannel(channel.Type)
	if !ok {
		return AssetBindingResult{}, ErrAssetBindingUnavailable
	}
	for attempt := 0; attempt < pollLimit; attempt++ {
		result, err := materializer.GetAsset(ctx, AssetMaterializeInput{
			UserID:  asset.UserId,
			Asset:   *asset,
			Channel: channel,
		}, upstreamAssetID)
		if err != nil {
			_, _ = model.RefreshProcessingAssetBindingCAS(model.AssetBindingProcessingRefresh{
				AssetID:         asset.Id,
				ChannelID:       channel.Id,
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
			loaded, err := model.GetAssetBinding(asset.Id, channel.Id)
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
		RewriteURI: "asset://" + strings.TrimSpace(binding.UpstreamAssetId),
		Binding:    binding,
	}
}

func assetBindingLeaseOwner() string {
	return fmt.Sprintf("pid-%d-%d", time.Now().UnixNano(), common.GetTimestamp())
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
	if errors.Is(err, ErrAssetBindingInitializing) {
		return assetError(err, types.ErrorCodeAssetNotReady, http.StatusConflict)
	}
	return assetError(err, types.ErrorCodeAssetChannelUnavailable, http.StatusServiceUnavailable)
}
