package service

import (
	"context"
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

const tokenSpaceRealPersonSessionTTLSeconds = int64(5 * 60)

type realPersonProvider interface {
	RequiresCallback() bool
	VerificationTTLSeconds() int64
	CreateVisualValidateSession(context.Context, string) (BytePlusVisualValidationSession, error)
	GetVisualValidateResult(context.Context, string) (BytePlusVisualValidationResult, error)
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
