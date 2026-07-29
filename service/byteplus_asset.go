package service

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/QuantumNous/new-api/types"
)

const (
	bytePlusAssetModelName             = "seedance-2.0"
	bytePlusAssetObjectType            = "asset"
	bytePlusAssetPublicIDPrefix        = "ast_"
	bytePlusAssetPublicIDRandomLen     = 32
	bytePlusAssetGroupLeaseStaleSecs   = int64(300)
	bytePlusAssetGroupNameRandomLength = 16
)

type bytePlusAssetAPI interface {
	CreateAssetGroup(ctx context.Context, creds BytePlusCredentials, name string) (string, string, error)
	CreateAsset(ctx context.Context, creds BytePlusCredentials, request BytePlusCreateAssetRequest) (string, string, error)
	GetAsset(ctx context.Context, creds BytePlusCredentials, upstreamAssetID string) (BytePlusAssetStatus, error)
}

var (
	bytePlusAssetNow      = common.GetTimestamp
	bytePlusAssetPublicID = func() (string, error) {
		random, err := common.GenerateRandomCharsKey(bytePlusAssetPublicIDRandomLen)
		if err != nil {
			return "", err
		}
		return bytePlusAssetPublicIDPrefix + random, nil
	}
	bytePlusAssetClientFactory = func(channel *model.Channel) (bytePlusAssetAPI, error) {
		return NewBytePlusAssetClient(nil, ""), nil
	}
	bytePlusAssetGroupRetryDelay            = func(attempt int) {}
	bytePlusAssetUpdateAssetUpstreamCreated = model.UpdateBytePlusAssetUpstreamCreated
	bytePlusAssetRestrictedLog              = common.SysLog
)

func CreateBytePlusAsset(ctx context.Context, userID int, userGroup string, usingGroup string, specificChannelID int, request dto.BytePlusAssetCreateRequest) (*dto.BytePlusAssetResponse, *types.NewAPIError) {
	request.URL = strings.TrimSpace(request.URL)
	request.AssetType = strings.TrimSpace(request.AssetType)
	if err := validateBytePlusAssetCreateRequest(request); err != nil {
		return nil, assetError(err, types.ErrorCodeInvalidAssetRequest, http.StatusBadRequest)
	}
	moderation := normalizeBytePlusAssetModeration(request.Moderation)

	channel, creds, err := selectBytePlusAssetChannel(userGroup, usingGroup, specificChannelID)
	if err != nil {
		return nil, assetError(err, types.ErrorCodeAssetChannelUnavailable, http.StatusServiceUnavailable)
	}
	client, err := bytePlusAssetClientFactory(channel)
	if err != nil {
		return nil, assetError(err, types.ErrorCodeAssetChannelUnavailable, http.StatusServiceUnavailable)
	}

	group, apiErr := ensureBytePlusAssetGroup(ctx, userID, channel, creds, client)
	if apiErr != nil {
		return nil, apiErr
	}

	now := bytePlusAssetNow()
	publicID, err := bytePlusAssetPublicID()
	if err != nil {
		return nil, assetError(errors.New("failed to generate asset id"), types.ErrorCodeAssetStorageError, http.StatusInternalServerError)
	}
	asset, err := model.CreateBytePlusAsset(model.BytePlusAsset{
		PublicId:           publicID,
		UserId:             userID,
		AssetGroupId:       group.Id,
		ChannelId:          channel.Id,
		AssetType:          request.AssetType,
		SourceURL:          request.URL,
		ModerationStrategy: moderation,
		Status:             model.BytePlusAssetStatusCreating,
		CreatedTime:        now,
		UpdatedTime:        now,
	})
	if err != nil {
		return nil, assetError(err, types.ErrorCodeAssetStorageError, http.StatusInternalServerError)
	}

	upstreamID, requestID, err := client.CreateAsset(ctx, creds, BytePlusCreateAssetRequest{
		GroupID:            group.UpstreamGroupId,
		URL:                request.URL,
		AssetType:          request.AssetType,
		Name:               opaqueBytePlusAssetName(),
		ModerationStrategy: moderation,
	})
	if err != nil {
		_ = model.UpdateBytePlusAssetStatus(asset.Id, model.BytePlusAssetStatusFailed, "upstream asset creation failed", bytePlusAssetNow())
		return nil, assetError(err, types.ErrorCodeAssetUpstreamError, http.StatusBadGateway)
	}
	if err := bytePlusAssetUpdateAssetUpstreamCreated(asset.Id, upstreamID, requestID, model.BytePlusAssetStatusProcessing, bytePlusAssetNow()); err != nil {
		logBytePlusAssetPersistenceFailure(ctx, channel.Id, requestID)
		return nil, assetError(err, types.ErrorCodeAssetStorageError, http.StatusInternalServerError)
	}
	asset.UpstreamAssetId = upstreamID
	asset.UpstreamRequestId = requestID
	asset.Status = model.BytePlusAssetStatusProcessing
	asset.UpdatedTime = bytePlusAssetNow()
	return responseFromBytePlusAsset(asset), nil
}

func GetBytePlusAsset(ctx context.Context, userID int, publicID string) (*dto.BytePlusAssetResponse, *types.NewAPIError) {
	publicID = strings.TrimSpace(publicID)
	if publicID == "" {
		return nil, assetError(errors.New("asset id is required"), types.ErrorCodeInvalidAssetRequest, http.StatusBadRequest)
	}
	asset, err := model.GetBytePlusAssetByPublicIDForUser(userID, publicID)
	if err != nil {
		if model.IsBytePlusAssetNotFound(err) {
			return nil, assetError(errors.New("asset not found"), types.ErrorCodeAssetNotFound, http.StatusNotFound)
		}
		return nil, assetError(err, types.ErrorCodeAssetStorageError, http.StatusInternalServerError)
	}
	if asset.Status == model.BytePlusAssetStatusCreating || strings.TrimSpace(asset.UpstreamAssetId) == "" {
		return nil, assetError(errors.New("asset is not ready"), types.ErrorCodeAssetNotReady, http.StatusConflict)
	}

	channel, err := model.GetChannelById(asset.ChannelId, true)
	if err != nil || !bytePlusAssetChannelIsUsable(channel) {
		return nil, assetError(errors.New("asset channel unavailable"), types.ErrorCodeAssetChannelUnavailable, http.StatusServiceUnavailable)
	}
	creds, err := ParseBytePlusCredentials(channel.Key)
	if err != nil || creds.ValidateAssets() != nil {
		return nil, assetError(errors.New("asset channel credentials unavailable"), types.ErrorCodeAssetChannelUnavailable, http.StatusServiceUnavailable)
	}
	client, err := bytePlusAssetClientFactory(channel)
	if err != nil {
		return nil, assetError(err, types.ErrorCodeAssetChannelUnavailable, http.StatusServiceUnavailable)
	}
	status, err := client.GetAsset(ctx, creds, asset.UpstreamAssetId)
	if err != nil {
		return nil, assetError(err, types.ErrorCodeAssetUpstreamError, http.StatusBadGateway)
	}
	if status.UpstreamAssetID != "" && status.UpstreamAssetID != asset.UpstreamAssetId {
		return nil, assetError(errors.New("upstream asset id mismatch"), types.ErrorCodeAssetUpstreamError, http.StatusBadGateway)
	}
	if err := model.UpdateBytePlusAssetStatus(asset.Id, status.Status, status.ErrorMessage, bytePlusAssetNow()); err != nil {
		return nil, assetError(err, types.ErrorCodeAssetStorageError, http.StatusInternalServerError)
	}
	asset.Status = status.Status
	asset.ErrorMessage = status.ErrorMessage
	asset.UpdatedTime = bytePlusAssetNow()
	return responseFromBytePlusAsset(asset), nil
}

func ensureBytePlusAssetGroup(ctx context.Context, userID int, channel *model.Channel, creds BytePlusCredentials, client bytePlusAssetAPI) (*model.BytePlusAssetGroup, *types.NewAPIError) {
	now := bytePlusAssetNow()
	group, owner, err := model.ClaimBytePlusAssetGroup(userID, channel.Id, now, now-bytePlusAssetGroupLeaseStaleSecs)
	if err != nil {
		return nil, assetError(err, types.ErrorCodeAssetStorageError, http.StatusInternalServerError)
	}
	if group.Status == model.BytePlusAssetGroupStatusActive && strings.TrimSpace(group.UpstreamGroupId) != "" {
		return group, nil
	}
	if !owner {
		reloaded, err := waitForActiveBytePlusAssetGroup(userID, channel.Id)
		if err != nil {
			return nil, assetError(err, types.ErrorCodeAssetStorageError, http.StatusInternalServerError)
		}
		if reloaded != nil {
			return reloaded, nil
		}
		return nil, assetError(errors.New("asset group is initializing"), types.ErrorCodeAssetGroupInitializing, http.StatusServiceUnavailable)
	}

	upstreamGroupID, requestID, err := client.CreateAssetGroup(ctx, creds, opaqueBytePlusAssetGroupName())
	if err != nil {
		_, _ = model.FailBytePlusAssetGroup(group.Id, group.LeaseUpdatedTime, requestID, "upstream asset group creation failed", bytePlusAssetNow())
		return nil, assetError(err, types.ErrorCodeAssetUpstreamError, http.StatusBadGateway)
	}
	updated, err := model.ActivateBytePlusAssetGroup(group.Id, group.LeaseUpdatedTime, upstreamGroupID, requestID, bytePlusAssetNow())
	if err != nil {
		return nil, assetError(err, types.ErrorCodeAssetStorageError, http.StatusInternalServerError)
	}
	if !updated {
		return nil, assetError(errors.New("asset group lease was superseded"), types.ErrorCodeAssetGroupInitializing, http.StatusServiceUnavailable)
	}
	group.UpstreamGroupId = upstreamGroupID
	group.UpstreamRequestId = requestID
	group.Status = model.BytePlusAssetGroupStatusActive
	group.UpdatedTime = bytePlusAssetNow()
	return group, nil
}

func selectBytePlusAssetChannel(userGroup string, usingGroup string, specificChannelID int) (*model.Channel, BytePlusCredentials, error) {
	groups := bytePlusAssetCandidateGroups(userGroup, usingGroup)
	if len(groups) == 0 {
		return nil, BytePlusCredentials{}, errors.New("no asset channel group available")
	}
	if specificChannelID > 0 {
		channel, err := model.GetChannelById(specificChannelID, true)
		if err != nil {
			return nil, BytePlusCredentials{}, err
		}
		if !bytePlusAssetChannelIsUsable(channel) {
			return nil, BytePlusCredentials{}, errors.New("specific channel is not asset capable")
		}
		creds, err := ParseBytePlusCredentials(channel.Key)
		if err != nil {
			return nil, BytePlusCredentials{}, err
		}
		if err := creds.ValidateAssets(); err != nil {
			return nil, BytePlusCredentials{}, err
		}
		for _, group := range groups {
			ok, err := channelHasEnabledBytePlusAssetAbility(channel.Id, group)
			if err != nil {
				return nil, BytePlusCredentials{}, err
			}
			if ok {
				return channel, creds, nil
			}
		}
		return nil, BytePlusCredentials{}, errors.New("specific channel does not support the requested group")
	}

	for _, group := range groups {
		candidates, err := model.GetSatisfiedChannelCandidatesWithFilter(group, bytePlusAssetModelName, 0, func(channel *model.Channel) bool {
			if !bytePlusAssetChannelIsUsable(channel) {
				return false
			}
			creds, err := ParseBytePlusCredentials(channel.Key)
			return err == nil && creds.ValidateAssets() == nil
		})
		if err != nil {
			return nil, BytePlusCredentials{}, err
		}
		if len(candidates) == 0 {
			continue
		}
		channel, err := model.SelectWeightedRandomChannel(candidates)
		if err != nil {
			return nil, BytePlusCredentials{}, err
		}
		if channel == nil {
			continue
		}
		creds, err := ParseBytePlusCredentials(channel.Key)
		if err != nil {
			return nil, BytePlusCredentials{}, err
		}
		if err := creds.ValidateAssets(); err != nil {
			return nil, BytePlusCredentials{}, err
		}
		return channel, creds, nil
	}
	return nil, BytePlusCredentials{}, errors.New("no asset-capable BytePlus channel")
}

func bytePlusAssetCandidateGroups(userGroup string, usingGroup string) []string {
	usingGroup = strings.TrimSpace(usingGroup)
	if usingGroup == "" {
		usingGroup = strings.TrimSpace(userGroup)
	}
	if usingGroup == "" {
		usingGroup = "default"
	}
	if usingGroup != "auto" {
		return []string{usingGroup}
	}
	return GetUserAutoGroup(userGroup)
}

func channelHasEnabledBytePlusAssetAbility(channelID int, group string) (bool, error) {
	var count int64
	err := model.DB.Model(&model.Ability{}).
		Where(&model.Ability{Group: group, Model: bytePlusAssetModelName, ChannelId: channelID, Enabled: true}).
		Count(&count).Error
	return count > 0, err
}

func bytePlusAssetChannelIsUsable(channel *model.Channel) bool {
	return channel != nil && channel.Type == constant.ChannelTypeBytePlus && channel.Status == common.ChannelStatusEnabled
}

func validateBytePlusAssetCreateRequest(request dto.BytePlusAssetCreateRequest) error {
	if err := validateBytePlusAssetSourceURL(request.URL); err != nil {
		return err
	}
	switch request.AssetType {
	case "Image", "Video", "Audio":
	default:
		return errors.New("invalid asset_type")
	}
	_ = normalizeBytePlusAssetModeration(request.Moderation)
	if request.Moderation != nil {
		switch strings.TrimSpace(request.Moderation.Strategy) {
		case "", "Default", "Skip":
		default:
			return errors.New("invalid moderation strategy")
		}
	}
	return nil
}

func validateBytePlusAssetSourceURL(rawURL string) error {
	parsed, err := url.Parse(rawURL)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" || parsed.User != nil {
		return errors.New("invalid asset source url")
	}
	switch strings.ToLower(parsed.Scheme) {
	case "https":
	default:
		return errors.New("invalid asset source url")
	}
	host := parsed.Hostname()
	if host == "" {
		return errors.New("invalid asset source url")
	}
	normalizedHost := strings.TrimSuffix(strings.ToLower(host), ".")
	if normalizedHost == "localhost" {
		return errors.New("asset source url must be public")
	}
	fetchSetting := system_setting.GetFetchSetting()
	if err := common.ValidateURLWithFetchSetting(
		rawURL,
		true,
		false,
		fetchSetting.DomainFilterMode,
		fetchSetting.IpFilterMode,
		fetchSetting.DomainList,
		fetchSetting.IpList,
		fetchSetting.AllowedPorts,
		true,
	); err != nil {
		return errors.New("asset source url must be public")
	}
	return nil
}

func normalizeBytePlusAssetModeration(moderation *dto.BytePlusAssetModeration) string {
	if moderation == nil || strings.TrimSpace(moderation.Strategy) == "" {
		return "Default"
	}
	return strings.TrimSpace(moderation.Strategy)
}

func responseFromBytePlusAsset(asset *model.BytePlusAsset) *dto.BytePlusAssetResponse {
	return &dto.BytePlusAssetResponse{
		ID:        asset.PublicId,
		Object:    bytePlusAssetObjectType,
		AssetType: asset.AssetType,
		Status:    asset.Status,
		Moderation: dto.BytePlusAssetModeration{
			Strategy: asset.ModerationStrategy,
		},
		CreatedAt: asset.CreatedTime,
	}
}

func opaqueBytePlusAssetGroupName() string {
	random, err := common.GenerateRandomCharsKey(bytePlusAssetGroupNameRandomLength)
	if err != nil {
		return "flatkey-assets"
	}
	return "flatkey-assets-" + random
}

func opaqueBytePlusAssetName() string {
	random, err := common.GenerateRandomCharsKey(bytePlusAssetGroupNameRandomLength)
	if err != nil {
		return "flatkey-asset"
	}
	return "flatkey-asset-" + random
}

func assetError(err error, code types.ErrorCode, status int) *types.NewAPIError {
	return types.NewOpenAIError(errors.New(publicBytePlusAssetErrorMessage(code)), code, status, types.ErrOptionWithSkipRetry(), types.ErrOptionWithNoRecordErrorLog())
}

func waitForActiveBytePlusAssetGroup(userID int, channelID int) (*model.BytePlusAssetGroup, error) {
	for attempt := 1; attempt <= 3; attempt++ {
		bytePlusAssetGroupRetryDelay(attempt)
		var group model.BytePlusAssetGroup
		if err := model.DB.Where("user_id = ? AND channel_id = ?", userID, channelID).First(&group).Error; err != nil {
			return nil, err
		}
		if group.Status == model.BytePlusAssetGroupStatusActive && strings.TrimSpace(group.UpstreamGroupId) != "" {
			return &group, nil
		}
	}
	return nil, nil
}

func logBytePlusAssetPersistenceFailure(ctx context.Context, channelID int, upstreamRequestID string) {
	requestID := ""
	if ctx != nil {
		if value, ok := ctx.Value(common.RequestIdKey).(string); ok {
			requestID = value
		}
	}
	bytePlusAssetRestrictedLog(fmt.Sprintf("byteplus asset persistence failed request_id=%s channel_id=%d upstream_request_id=%s", requestID, channelID, upstreamRequestID))
}

func publicBytePlusAssetErrorMessage(code types.ErrorCode) string {
	switch code {
	case types.ErrorCodeInvalidAssetRequest:
		return "invalid asset request"
	case types.ErrorCodeAssetNotFound:
		return "asset not found"
	case types.ErrorCodeAssetNotReady:
		return "asset is not ready"
	case types.ErrorCodeAssetFailed:
		return "asset failed"
	case types.ErrorCodeAssetChannelConflict:
		return "asset channel conflict"
	case types.ErrorCodeAssetChannelUnavailable:
		return "asset channel unavailable"
	case types.ErrorCodeAssetGroupInitializing:
		return "asset group is initializing"
	case types.ErrorCodeAssetUpstreamError:
		return "asset upstream error"
	case types.ErrorCodeAssetStorageError:
		return "asset storage error"
	default:
		return string(code)
	}
}
