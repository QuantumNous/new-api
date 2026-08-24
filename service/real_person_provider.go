package service

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
)

const tokenSpaceRealPersonSessionTTLSeconds = int64(5 * 60)

type realPersonProvider interface {
	RequiresCallback() bool
	VerificationTTLSeconds() int64
	CreateVisualValidateSession(context.Context, string) (BytePlusVisualValidationSession, error)
	GetVisualValidateResult(context.Context, string) (BytePlusVisualValidationResult, error)
	CreateAsset(context.Context, BytePlusCreateAssetRequest) (string, string, error)
	GetAsset(context.Context, string) (BytePlusAssetStatus, error)
	ListAssets(context.Context, BytePlusListAssetsRequest) (BytePlusListAssetsResult, error)
	DeleteAsset(context.Context, string) (string, error)
}

type realPersonProviderBinding struct {
	Channel            *model.Channel
	Provider           realPersonProvider
	StorageCredentials *BytePlusCredentials
}

type nativeBytePlusRealPersonProvider struct {
	client      bytePlusRealPersonAPI
	credentials BytePlusCredentials
}

func (nativeBytePlusRealPersonProvider) RequiresCallback() bool {
	return true
}

func (nativeBytePlusRealPersonProvider) VerificationTTLSeconds() int64 {
	return bytePlusRealPersonSessionTTLSeconds
}

func (p nativeBytePlusRealPersonProvider) CreateVisualValidateSession(ctx context.Context, callbackURL string) (BytePlusVisualValidationSession, error) {
	return p.client.CreateVisualValidateSession(ctx, p.credentials, callbackURL)
}

func (p nativeBytePlusRealPersonProvider) GetVisualValidateResult(ctx context.Context, bytedToken string) (BytePlusVisualValidationResult, error) {
	return p.client.GetVisualValidateResult(ctx, p.credentials, bytedToken)
}

func (p nativeBytePlusRealPersonProvider) CreateAsset(ctx context.Context, request BytePlusCreateAssetRequest) (string, string, error) {
	return p.client.CreateAsset(ctx, p.credentials, request)
}

func (p nativeBytePlusRealPersonProvider) GetAsset(ctx context.Context, upstreamAssetID string) (BytePlusAssetStatus, error) {
	return p.client.GetAsset(ctx, p.credentials, upstreamAssetID)
}

func (p nativeBytePlusRealPersonProvider) ListAssets(ctx context.Context, request BytePlusListAssetsRequest) (BytePlusListAssetsResult, error) {
	return p.client.ListAssets(ctx, p.credentials, request)
}

func (p nativeBytePlusRealPersonProvider) DeleteAsset(ctx context.Context, upstreamAssetID string) (string, error) {
	return p.client.DeleteAsset(ctx, p.credentials, upstreamAssetID)
}

type tokenSpaceRealPersonProvider struct {
	channel       *model.Channel
	apiKey        string
	gatewayOrigin string
}

func (tokenSpaceRealPersonProvider) RequiresCallback() bool {
	return false
}

func (tokenSpaceRealPersonProvider) VerificationTTLSeconds() int64 {
	return tokenSpaceRealPersonSessionTTLSeconds
}

func realPersonProviderForChannel(channel *model.Channel) (*realPersonProviderBinding, error) {
	if channel == nil || channel.Status != common.ChannelStatusEnabled {
		return nil, errors.New("real person channel unavailable")
	}
	config, explicit, err := assetMaterializationConfigForChannel(channel)
	if err != nil {
		return nil, err
	}
	if explicit {
		if config.Provider != assetMaterializationProviderTokenSpaceMaterial {
			return nil, errors.New("real person provider unavailable")
		}
		keys := enabledAssetMaterializeKeys(channel)
		if len(keys) != 1 || strings.TrimSpace(keys[0].key) == "" {
			return nil, errors.New("tokenspace real person provider requires exactly one enabled key")
		}
		return &realPersonProviderBinding{
			Channel: channel,
			Provider: tokenSpaceRealPersonProvider{
				channel:       channel,
				apiKey:        strings.TrimSpace(keys[0].key),
				gatewayOrigin: config.GatewayOrigin,
			},
		}, nil
	}
	if !bytePlusAssetChannelIsUsable(channel) {
		return nil, errors.New("real person channel unavailable")
	}
	creds, err := ParseBytePlusCredentials(channel.Key)
	if err != nil {
		return nil, err
	}
	if err := creds.ValidateRealPersonAssets(); err != nil {
		return nil, err
	}
	client, err := realPersonClientForChannel(channel)
	if err != nil {
		return nil, err
	}
	return &realPersonProviderBinding{
		Channel: channel,
		Provider: nativeBytePlusRealPersonProvider{
			client:      client,
			credentials: creds,
		},
		StorageCredentials: &creds,
	}, nil
}

// TokenSpaceRealPersonChannelIsUsable reports whether a Doubao video channel
// is explicitly configured to own TokenSpace real-person profiles and assets.
func TokenSpaceRealPersonChannelIsUsable(channel *model.Channel) bool {
	if channel == nil || channel.Type != constant.ChannelTypeDoubaoVideo {
		return false
	}
	_, err := realPersonProviderForChannel(channel)
	return err == nil
}

func loadUsableRealPersonProviderBinding(channelID int, requestedGroup string) (*realPersonProviderBinding, error) {
	channel, err := model.GetChannelById(channelID, true)
	if err != nil {
		return nil, err
	}
	binding, err := realPersonProviderForChannel(channel)
	if err != nil {
		return nil, err
	}
	groups := bytePlusRealPersonChannelAbilityGroups(channel.Group, requestedGroup)
	for _, group := range groups {
		enabled, err := model.BytePlusRealPersonChannelHasEnabledAbility(channel.Id, group, bytePlusAssetModelName)
		if err != nil {
			return nil, err
		}
		if enabled {
			return binding, nil
		}
	}
	return nil, errors.New("channel real person ability unavailable")
}

func realPersonChannelIsAutomaticCandidate(channel *model.Channel) bool {
	if channel == nil || !bytePlusAssetChannelIsUsable(channel) {
		return false
	}
	_, explicit, err := assetMaterializationConfigForChannel(channel)
	if err != nil || explicit {
		return false
	}
	creds, err := ParseBytePlusCredentials(channel.Key)
	return err == nil && creds.ValidateRealPersonAssets() == nil
}

func isRealPersonDefinitiveResponse(err error) bool {
	return isBytePlusDefinitiveResponse(err) || AssetMaterializeErrorClass(err) == AssetMaterializeErrorDefinitive
}

func isRealPersonNotFound(err error) bool {
	if isBytePlusNotFound(err) {
		return true
	}
	var failure *AssetMaterializeFailure
	return errors.As(err, &failure) && failure.Class == AssetMaterializeErrorDefinitive && failure.HTTPStatus == http.StatusNotFound
}
