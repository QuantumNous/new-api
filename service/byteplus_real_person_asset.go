package service

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"path"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/types"
)

const (
	bytePlusRealPersonAssetCreateRoute    = "real_person_asset_create"
	bytePlusRealPersonAssetNameMaxRunes   = 128
	bytePlusRealPersonAssetFailureUnknown = "idempotency_outcome_unknown"
)

type realPersonAssetSource struct {
	URL         string
	Uploaded    *BytePlusUploadedAsset
	RequestHash string
}

func CreateBytePlusRealPersonAssetFromURL(ctx context.Context, userID int, personID, idempotencyKey string, request dto.BytePlusRealPersonAssetCreateRequest) (*dto.BytePlusAssetResponse, *types.NewAPIError) {
	name, apiErr := normalizeBytePlusRealPersonAssetName(request.Name)
	if apiErr != nil {
		return nil, apiErr
	}
	request.URL = strings.TrimSpace(request.URL)
	request.AssetType = strings.TrimSpace(request.AssetType)
	if err := validateBytePlusAssetSourceURL(request.URL); err != nil {
		return nil, assetError(err, types.ErrorCodeInvalidAssetRequest, http.StatusBadRequest)
	}
	if apiErr := validateBytePlusRealPersonAssetType(request.AssetType); apiErr != nil {
		return nil, apiErr
	}
	requestHash, err := hashURLRealPersonAssetRequest(personID, request.URL, request.AssetType, name)
	if err != nil {
		return nil, assetError(err, types.ErrorCodeAssetStorageError, http.StatusInternalServerError)
	}
	source := realPersonAssetSource{URL: request.URL, RequestHash: requestHash}
	return createBytePlusRealPersonAsset(ctx, userID, strings.TrimSpace(personID), idempotencyKey, request.AssetType, name, source, nil)
}

func CreateBytePlusRealPersonAssetFromMultipart(ctx context.Context, userID int, personID, idempotencyKey string, request *http.Request) (*dto.BytePlusAssetResponse, *types.NewAPIError) {
	profile, channel, creds, apiErr := loadBytePlusRealPersonAssetProfileAndStorage(userID, strings.TrimSpace(personID))
	if apiErr != nil {
		return nil, apiErr
	}
	store, err := bytePlusTempObjectStoreFactory(creds)
	if err != nil {
		return nil, assetError(err, types.ErrorCodeAssetChannelUnavailable, http.StatusServiceUnavailable)
	}
	uploaded, apiErr := readBytePlusMultipartAsset(ctx, request, profile, channel, store)
	if apiErr != nil {
		return nil, apiErr
	}
	name, apiErr := normalizeBytePlusRealPersonAssetName(uploaded.Name)
	if apiErr != nil {
		_ = deleteOrQueueBytePlusTempObject(ctx, uploaded.TempObject, store)
		return nil, apiErr
	}
	if apiErr := validateBytePlusRealPersonAssetType(uploaded.AssetType); apiErr != nil {
		_ = deleteOrQueueBytePlusTempObject(ctx, uploaded.TempObject, store)
		return nil, apiErr
	}
	requestHash, err := hashMultipartAssetRequest(profile.PublicId, uploaded.AssetType, name, uploaded.ContentSHA256, uploaded.SizeBytes)
	if err != nil {
		_ = deleteOrQueueBytePlusTempObject(ctx, uploaded.TempObject, store)
		return nil, assetError(err, types.ErrorCodeAssetStorageError, http.StatusInternalServerError)
	}
	source := realPersonAssetSource{Uploaded: uploaded, RequestHash: requestHash}
	return createBytePlusRealPersonAsset(ctx, userID, profile.PublicId, idempotencyKey, uploaded.AssetType, name, source, store)
}

func ListBytePlusRealPersonAssets(ctx context.Context, userID int, personID string, limit int, after string) (*dto.BytePlusRealPersonAssetListResponse, *types.NewAPIError) {
	profile, err := model.GetBytePlusRealPersonProfileForUser(userID, strings.TrimSpace(personID))
	if err != nil {
		if model.IsBytePlusRealPersonNotFound(err) {
			return nil, assetError(errors.New("real person not found"), types.ErrorCodeRealPersonNotFound, http.StatusNotFound)
		}
		return nil, assetError(err, types.ErrorCodeAssetStorageError, http.StatusInternalServerError)
	}
	assets, hasMore, err := model.ListBytePlusAssetsForRealPerson(userID, profile.Id, limit, strings.TrimSpace(after))
	if err != nil {
		if errors.Is(err, model.ErrBytePlusAssetCursorNotFound) {
			return nil, assetError(errors.New("asset cursor not found"), types.ErrorCodeInvalidAssetRequest, http.StatusBadRequest)
		}
		return nil, assetError(err, types.ErrorCodeAssetStorageError, http.StatusInternalServerError)
	}
	data := make([]dto.BytePlusAssetResponse, 0, len(assets))
	for i := range assets {
		data = append(data, *responseFromBytePlusAsset(&assets[i]))
	}
	nextAfter := ""
	if hasMore && len(data) > 0 {
		nextAfter = data[len(data)-1].ID
	}
	return &dto.BytePlusRealPersonAssetListResponse{Object: bytePlusRealPersonListObjectType, Data: data, HasMore: hasMore, NextAfter: nextAfter}, nil
}

func createBytePlusRealPersonAsset(ctx context.Context, userID int, personID, idempotencyKey, assetType, name string, source realPersonAssetSource, store BytePlusTempObjectStore) (*dto.BytePlusAssetResponse, *types.NewAPIError) {
	keyHash, err := hashAPIIdempotencyKey(idempotencyKey)
	if err != nil {
		cleanupRealPersonAssetUpload(ctx, source, store)
		return nil, assetError(err, types.ErrorCodeInvalidAssetRequest, http.StatusBadRequest)
	}
	now := bytePlusAssetNow()
	claim, err := model.ClaimAPIIdempotency(userID, bytePlusRealPersonAssetCreateRoute, keyHash, source.RequestHash, model.APIIdempotencyResourceAsset, now, now-int64(apiIdempotencyLease.Seconds()), now+int64(apiIdempotencyRetention.Seconds()))
	if err != nil {
		cleanupRealPersonAssetUpload(ctx, source, store)
		return nil, assetError(err, types.ErrorCodeAssetStorageError, http.StatusInternalServerError)
	}
	switch claim.Decision {
	case model.DecisionConflict:
		cleanupRealPersonAssetUpload(ctx, source, store)
		return nil, assetError(errors.New("idempotency conflict"), types.ErrorCodeIdempotencyConflict, http.StatusConflict)
	case model.DecisionInProgress:
		cleanupRealPersonAssetUpload(ctx, source, store)
		return nil, assetError(errors.New("asset creation is in progress"), types.ErrorCodeVerificationInProgress, http.StatusConflict)
	case model.DecisionOutcomeUnknown:
		cleanupRealPersonAssetUpload(ctx, source, store)
		return nil, assetError(errors.New("idempotency outcome unknown"), types.ErrorCodeIdempotencyOutcomeUnknown, http.StatusBadGateway)
	case model.DecisionReplay:
		cleanupRealPersonAssetUpload(ctx, source, store)
		return replayBytePlusRealPersonAssetClaim(claim.Record)
	case model.DecisionResume:
		profile, channel, creds, apiErr := loadBytePlusRealPersonAssetProfileAndChannel(userID, personID)
		if apiErr != nil {
			cleanupRealPersonAssetUpload(ctx, source, store)
			return failExistingRealPersonAssetClaim(recordOrNil(claim.Record), userID, apiErr)
		}
		return resumeBytePlusRealPersonAsset(ctx, profile, channel, creds, store, claim.Record, source)
	case model.DecisionOwner:
		profile, channel, creds, apiErr := loadBytePlusRealPersonAssetProfileAndChannel(userID, personID)
		if apiErr != nil {
			cleanupRealPersonAssetUpload(ctx, source, store)
			return failUnboundRealPersonAssetClaim(claim.Record, apiErr)
		}
		return ownBytePlusRealPersonAsset(ctx, profile, channel, creds, store, claim.Record, assetType, name, source)
	default:
		cleanupRealPersonAssetUpload(ctx, source, store)
		return nil, assetError(errors.New("unknown idempotency decision"), types.ErrorCodeAssetStorageError, http.StatusInternalServerError)
	}
}

func ownBytePlusRealPersonAsset(ctx context.Context, profile *model.BytePlusRealPersonProfile, channel *model.Channel, creds BytePlusCredentials, store BytePlusTempObjectStore, record *model.APIIdempotencyRecord, assetType, name string, source realPersonAssetSource) (*dto.BytePlusAssetResponse, *types.NewAPIError) {
	publicID, err := bytePlusAssetPublicID()
	if err != nil {
		cleanupRealPersonAssetUpload(ctx, source, store)
		return nil, assetError(errors.New("failed to generate asset id"), types.ErrorCodeAssetStorageError, http.StatusInternalServerError)
	}
	now := bytePlusAssetNow()
	profileID := profile.Id
	var tempObjectID *int64
	var signedURLExpiresAt int64
	if source.Uploaded != nil && source.Uploaded.TempObject != nil {
		tempObjectID = &source.Uploaded.TempObject.Id
		signedURLExpiresAt = now + int64(bytePlusSignedURLTTL.Seconds())
	}
	asset, err := model.CreateRealPersonBytePlusAssetForIdempotency(record.Id, record.LeaseUpdatedTime, model.BytePlusAsset{
		PublicId:            publicID,
		UserId:              profile.UserId,
		AssetGroupId:        0,
		RealPersonProfileId: &profileID,
		ChannelId:           profile.ChannelId,
		AssetType:           assetType,
		Name:                name,
		ModerationStrategy:  "Default",
		Status:              model.BytePlusAssetStatusCreating,
		CreatedTime:         now,
		UpdatedTime:         now,
	}, tempObjectID, signedURLExpiresAt, now)
	if err != nil {
		cleanupRealPersonAssetUpload(ctx, source, store)
		return nil, assetError(err, types.ErrorCodeAssetStorageError, http.StatusInternalServerError)
	}
	upstreamURL := strings.TrimSpace(source.URL)
	if source.Uploaded != nil {
		var apiErr *types.NewAPIError
		upstreamURL, apiErr = presignRealPersonAssetObject(ctx, creds, store, source.Uploaded.TempObject)
		if apiErr != nil {
			return failRealPersonAssetWithStoredError(record, asset, "asset_storage_error", types.ErrorCodeAssetStorageError, http.StatusInternalServerError)
		}
	}
	return callBytePlusRealPersonAssetUpstream(ctx, channel, creds, record, asset, upstreamURL)
}

func resumeBytePlusRealPersonAsset(ctx context.Context, profile *model.BytePlusRealPersonProfile, channel *model.Channel, creds BytePlusCredentials, store BytePlusTempObjectStore, record *model.APIIdempotencyRecord, source realPersonAssetSource) (*dto.BytePlusAssetResponse, *types.NewAPIError) {
	asset, err := model.GetBytePlusAssetByPublicIDForUser(profile.UserId, record.ResourcePublicId)
	if err != nil {
		cleanupRealPersonAssetUpload(ctx, source, store)
		return nil, assetError(err, types.ErrorCodeAssetStorageError, http.StatusInternalServerError)
	}
	upstreamURL := strings.TrimSpace(source.URL)
	if source.Uploaded != nil {
		cleanupRealPersonAssetUpload(ctx, source, store)
		original, err := model.GetBytePlusAssetTempObjectByAssetID(asset.Id)
		if err != nil || original.CleanupStatus != model.BytePlusTempObjectCleanupPending || strings.TrimSpace(original.ObjectKey) == "" {
			return failRealPersonAssetWithStoredError(record, asset, "asset_storage_error", types.ErrorCodeAssetStorageError, http.StatusInternalServerError)
		}
		now := bytePlusAssetNow()
		extended, err := model.ExtendBytePlusAssetTempObjectSignedURL(original.Id, asset.Id, now+int64(bytePlusSignedURLTTL.Seconds()), now)
		if err != nil {
			return failRealPersonAssetWithStoredError(record, asset, "asset_storage_error", types.ErrorCodeAssetStorageError, http.StatusInternalServerError)
		}
		original = extended
		var apiErr *types.NewAPIError
		upstreamURL, apiErr = presignRealPersonAssetObject(ctx, creds, store, original)
		if apiErr != nil {
			return failRealPersonAssetWithStoredError(record, asset, "asset_storage_error", types.ErrorCodeAssetStorageError, http.StatusInternalServerError)
		}
	}
	return callBytePlusRealPersonAssetUpstream(ctx, channel, creds, record, asset, upstreamURL)
}

func callBytePlusRealPersonAssetUpstream(ctx context.Context, channel *model.Channel, creds BytePlusCredentials, record *model.APIIdempotencyRecord, asset *model.BytePlusAsset, upstreamURL string) (*dto.BytePlusAssetResponse, *types.NewAPIError) {
	upstreamURL = strings.TrimSpace(upstreamURL)
	if upstreamURL == "" {
		return failRealPersonAssetWithStoredError(record, asset, "asset_storage_error", types.ErrorCodeAssetStorageError, http.StatusInternalServerError)
	}
	now := bytePlusAssetNow()
	if err := model.MarkAPIIdempotencyCallingUpstream(record.Id, record.LeaseUpdatedTime, now); err != nil {
		markBytePlusRealPersonAssetOutcomeUnknown(ctx, channel.Id, record, asset, "asset_lease_lost")
		return nil, assetError(errors.New("idempotency outcome unknown"), types.ErrorCodeIdempotencyOutcomeUnknown, http.StatusBadGateway)
	}
	client, err := realPersonClientForChannel(channel)
	if err != nil {
		markBytePlusRealPersonAssetOutcomeUnknown(ctx, channel.Id, record, asset, "asset_client_unavailable")
		return nil, assetError(errors.New("idempotency outcome unknown"), types.ErrorCodeIdempotencyOutcomeUnknown, http.StatusBadGateway)
	}
	groupID := ""
	if asset.RealPersonProfileId != nil {
		groupID = realPersonProfileGroupIDForAsset(record.UserId, *asset.RealPersonProfileId)
	}
	if groupID == "" {
		markBytePlusRealPersonAssetOutcomeUnknown(ctx, channel.Id, record, asset, "asset_profile_group_missing")
		return nil, assetError(errors.New("idempotency outcome unknown"), types.ErrorCodeIdempotencyOutcomeUnknown, http.StatusBadGateway)
	}
	upstreamID, requestID, err := client.CreateAsset(ctx, creds, BytePlusCreateAssetRequest{
		GroupID:            groupID,
		URL:                upstreamURL,
		AssetType:          asset.AssetType,
		Name:               asset.Name,
		ModerationStrategy: "Default",
	})
	if err != nil {
		if isBytePlusDefinitiveResponse(err) {
			return failRealPersonAssetWithStoredError(record, asset, "asset_upstream_error", types.ErrorCodeAssetUpstreamError, http.StatusBadGateway)
		}
		markBytePlusRealPersonAssetOutcomeUnknown(ctx, channel.Id, record, asset, "asset_upstream_unknown")
		return nil, assetError(errors.New("idempotency outcome unknown"), types.ErrorCodeIdempotencyOutcomeUnknown, http.StatusBadGateway)
	}
	if err := bytePlusAssetUpdateAssetUpstreamCreated(asset.Id, upstreamID, requestID, model.BytePlusAssetStatusProcessing, bytePlusAssetNow()); err != nil {
		markBytePlusRealPersonAssetOutcomeUnknown(ctx, channel.Id, record, asset, "asset_persistence_failed")
		logBytePlusAssetPersistenceFailure(ctx, channel.Id, requestID)
		return nil, assetError(errors.New("idempotency outcome unknown"), types.ErrorCodeIdempotencyOutcomeUnknown, http.StatusBadGateway)
	}
	asset.UpstreamAssetId = upstreamID
	asset.UpstreamRequestId = requestID
	asset.Status = model.BytePlusAssetStatusProcessing
	asset.UpdatedTime = bytePlusAssetNow()
	safe := responseFromBytePlusAsset(asset)
	payload, err := marshalAPIIdempotencyResponsePayload(safe)
	if err != nil {
		markBytePlusRealPersonAssetOutcomeUnknown(ctx, channel.Id, record, asset, "asset_response_failed")
		return nil, assetError(errors.New("idempotency outcome unknown"), types.ErrorCodeIdempotencyOutcomeUnknown, http.StatusBadGateway)
	}
	if err := model.CompleteAPIIdempotency(record.Id, record.LeaseUpdatedTime, asset.PublicId, http.StatusOK, payload, bytePlusAssetNow()); err != nil {
		markBytePlusRealPersonAssetOutcomeUnknown(ctx, channel.Id, record, asset, "asset_ledger_complete_failed")
		return nil, assetError(errors.New("idempotency outcome unknown"), types.ErrorCodeIdempotencyOutcomeUnknown, http.StatusBadGateway)
	}
	return safe, nil
}

func normalizeBytePlusRealPersonAssetName(name string) (string, *types.NewAPIError) {
	name = strings.TrimSpace(name)
	if utf8.RuneCountInString(name) > bytePlusRealPersonAssetNameMaxRunes {
		return "", assetError(errors.New("asset name is too long"), types.ErrorCodeInvalidAssetRequest, http.StatusBadRequest)
	}
	return name, nil
}

func defaultBytePlusRealPersonAssetName(filename string) string {
	name := path.Base(strings.ReplaceAll(filename, "\\", "/"))
	name = strings.TrimSpace(name)
	name = strings.ReplaceAll(name, "/", "")
	name = strings.ReplaceAll(name, "\\", "")
	if utf8.RuneCountInString(name) <= bytePlusRealPersonAssetNameMaxRunes {
		return name
	}
	var builder strings.Builder
	count := 0
	for _, r := range name {
		if count >= bytePlusRealPersonAssetNameMaxRunes {
			break
		}
		builder.WriteRune(r)
		count++
	}
	return builder.String()
}

func loadBytePlusRealPersonAssetProfileAndChannel(userID int, personID string) (*model.BytePlusRealPersonProfile, *model.Channel, BytePlusCredentials, *types.NewAPIError) {
	profile, err := model.GetBytePlusRealPersonProfileForUser(userID, strings.TrimSpace(personID))
	if err != nil {
		if model.IsBytePlusRealPersonNotFound(err) {
			return nil, nil, BytePlusCredentials{}, assetError(errors.New("real person not found"), types.ErrorCodeRealPersonNotFound, http.StatusNotFound)
		}
		return nil, nil, BytePlusCredentials{}, assetError(err, types.ErrorCodeAssetStorageError, http.StatusInternalServerError)
	}
	if profile.Status != model.BytePlusRealPersonProfileStatusActive || profile.UpstreamGroupId == nil || strings.TrimSpace(*profile.UpstreamGroupId) == "" {
		return nil, nil, BytePlusCredentials{}, assetError(errors.New("real person is not active"), types.ErrorCodeRealPersonNotActive, http.StatusConflict)
	}
	channel, creds, err := loadUsableBytePlusRealPersonChannel(profile.ChannelId, userID, "")
	if err != nil {
		return nil, nil, BytePlusCredentials{}, assetError(err, types.ErrorCodeAssetChannelUnavailable, http.StatusServiceUnavailable)
	}
	return profile, channel, creds, nil
}

func loadBytePlusRealPersonAssetProfileAndStorage(userID int, personID string) (*model.BytePlusRealPersonProfile, *model.Channel, BytePlusCredentials, *types.NewAPIError) {
	profile, err := model.GetBytePlusRealPersonProfileForUser(userID, strings.TrimSpace(personID))
	if err != nil {
		if model.IsBytePlusRealPersonNotFound(err) {
			return nil, nil, BytePlusCredentials{}, assetError(errors.New("real person not found"), types.ErrorCodeRealPersonNotFound, http.StatusNotFound)
		}
		return nil, nil, BytePlusCredentials{}, assetError(err, types.ErrorCodeAssetStorageError, http.StatusInternalServerError)
	}
	channel, err := model.GetChannelById(profile.ChannelId, true)
	if err != nil {
		return nil, nil, BytePlusCredentials{}, assetError(err, types.ErrorCodeAssetChannelUnavailable, http.StatusServiceUnavailable)
	}
	if channel == nil || channel.Type != constant.ChannelTypeBytePlus {
		return nil, nil, BytePlusCredentials{}, assetError(errors.New("real person channel unavailable"), types.ErrorCodeAssetChannelUnavailable, http.StatusServiceUnavailable)
	}
	creds, err := ParseBytePlusCredentials(channel.Key)
	if err != nil || !bytePlusRealPersonMultipartStorageAvailable(creds) {
		return nil, nil, BytePlusCredentials{}, assetError(errors.New("real person storage credentials unavailable"), types.ErrorCodeAssetChannelUnavailable, http.StatusServiceUnavailable)
	}
	return profile, channel, creds, nil
}

func validateBytePlusRealPersonAssetType(assetType string) *types.NewAPIError {
	switch strings.TrimSpace(assetType) {
	case "Image", "Video", "Audio":
		return nil
	default:
		return assetError(errors.New("invalid asset_type"), types.ErrorCodeInvalidAssetRequest, http.StatusBadRequest)
	}
}

func hashURLRealPersonAssetRequest(personID, rawURL, assetType, name string) (string, error) {
	return hashCanonicalRequest(struct {
		PersonID  string
		URL       string
		AssetType string
		Name      string
	}{
		PersonID:  strings.TrimSpace(personID),
		URL:       strings.TrimSpace(rawURL),
		AssetType: strings.TrimSpace(assetType),
		Name:      strings.TrimSpace(name),
	})
}

func presignRealPersonAssetObject(ctx context.Context, creds BytePlusCredentials, store BytePlusTempObjectStore, object *model.BytePlusAssetTempObject) (string, *types.NewAPIError) {
	if store == nil || object == nil {
		return "", assetError(errors.New("temp object is unavailable"), types.ErrorCodeAssetStorageError, http.StatusInternalServerError)
	}
	resolved, err := bytePlusTempObjectStoreForPersistedBucket(creds, store, object.Bucket)
	if err != nil {
		return "", assetError(err, types.ErrorCodeAssetStorageError, http.StatusInternalServerError)
	}
	store = resolved
	signed, err := store.PresignGet(ctx, object.ObjectKey, bytePlusSignedURLTTL)
	if err != nil || strings.TrimSpace(signed) == "" {
		return "", assetError(errors.New("temp object presign failed"), types.ErrorCodeAssetStorageError, http.StatusInternalServerError)
	}
	return strings.TrimSpace(signed), nil
}

func cleanupRealPersonAssetUpload(ctx context.Context, source realPersonAssetSource, store BytePlusTempObjectStore) {
	if source.Uploaded != nil && source.Uploaded.TempObject != nil {
		_ = deleteOrQueueBytePlusTempObject(ctx, source.Uploaded.TempObject, store)
	}
}

func bytePlusRealPersonMultipartStorageAvailable(creds BytePlusCredentials) bool {
	if creds.ValidateRealPersonAssetStorage() == nil {
		return true
	}
	return creds.ValidateRealPersonAssets() == nil && bytePlusRealPersonTOSFallbackAllowed(creds) && bytePlusGCSTempObjectStoreConfigured()
}

func bytePlusRealPersonTOSFallbackAllowed(creds BytePlusCredentials) bool {
	bucket := strings.TrimSpace(creds.RealPersonAssets.TOSBucket)
	region := strings.TrimSpace(creds.RealPersonAssets.TOSRegion)
	endpoint := strings.TrimSpace(creds.RealPersonAssets.TOSInternalEndpoint)
	missing := bucket == "" || region == "" || endpoint == ""
	if !missing {
		return false
	}
	if bucket != "" && !isValidBytePlusTOSBucket(bucket) {
		return false
	}
	if region != "" && region != bytePlusAssetRegion {
		return false
	}
	if endpoint != "" && !isValidBytePlusRealPersonEndpoint(endpoint) {
		return false
	}
	return true
}

func bytePlusTempObjectStoreForPersistedBucket(creds BytePlusCredentials, current BytePlusTempObjectStore, persistedBucket string) (BytePlusTempObjectStore, error) {
	provider, bucket := bytePlusTempObjectLocatorParts(persistedBucket)
	if bucket == "" {
		return nil, errors.New("temp object bucket is unavailable")
	}
	if provider != "" && bytePlusTempObjectStoreMatchesBucket(current, provider, bucket) {
		return current, nil
	}
	if provider == bytePlusTempObjectProviderTOS || provider == "" {
		if provider == "" && creds.ValidateRealPersonAssetStorage() == nil && bytePlusTempObjectStoreMatchesBucket(current, bytePlusTempObjectProviderTOS, bucket) {
			return current, nil
		}
		if strings.TrimSpace(creds.RealPersonAssets.TOSBucket) == bucket {
			if creds.ValidateRealPersonAssetStorage() != nil {
				return nil, errors.New("persisted tos temp object storage is unavailable")
			}
			return bytePlusTempObjectStoreFactory(creds)
		}
		if provider == "" {
			return nil, errors.New("legacy temp object bucket is unknown")
		}
	}
	if provider == bytePlusTempObjectProviderGCS && bytePlusGCSTempObjectBucket() == bucket {
		return newBytePlusGCSTempObjectStore()
	}
	return nil, errors.New("temp object bucket is unknown")
}

func bytePlusTempObjectLocatorParts(locator string) (string, string) {
	locator = strings.TrimSpace(locator)
	provider, bucket, found := strings.Cut(locator, ":")
	if !found {
		return "", locator
	}
	provider = strings.TrimSpace(provider)
	bucket = strings.TrimSpace(bucket)
	switch provider {
	case bytePlusTempObjectProviderTOS, bytePlusTempObjectProviderGCS:
		return provider, bucket
	default:
		return "", locator
	}
}

func bytePlusTempObjectStoreMatchesBucket(store BytePlusTempObjectStore, provider, bucket string) bool {
	if store == nil {
		return false
	}
	bucketProvider, ok := store.(bytePlusTempObjectBucketProvider)
	if !ok || strings.TrimSpace(bucketProvider.TempObjectBucket()) != strings.TrimSpace(bucket) {
		return false
	}
	storageProvider, ok := store.(bytePlusTempObjectStorageProvider)
	return ok && strings.TrimSpace(storageProvider.TempObjectStorageProvider()) == strings.TrimSpace(provider)
}

func replayBytePlusRealPersonAssetClaim(record *model.APIIdempotencyRecord) (*dto.BytePlusAssetResponse, *types.NewAPIError) {
	if record.Status == model.APIIdempotencyStatusFailed {
		return nil, apiErrorFromStoredAssetPayload(record.ResponsePayload, record.ResponseStatus)
	}
	var response dto.BytePlusAssetResponse
	if err := common.Unmarshal([]byte(record.ResponsePayload), &response); err != nil || response.ID == "" {
		return nil, assetError(errors.New("stored asset response is unavailable"), types.ErrorCodeAssetStorageError, http.StatusInternalServerError)
	}
	return &response, nil
}

func failRealPersonAssetWithStoredError(record *model.APIIdempotencyRecord, asset *model.BytePlusAsset, failureCode string, code types.ErrorCode, status int) (*dto.BytePlusAssetResponse, *types.NewAPIError) {
	payload, err := marshalAPIIdempotencyResponsePayload(storedAssetErrorPayload{ErrorCode: string(code)})
	if err != nil {
		payload = `{"error_code":"asset_storage_error"}`
	}
	_ = model.MarkBytePlusRealPersonAssetFailedForIdempotency(record.Id, record.LeaseUpdatedTime, asset.Id, asset.PublicId, failureCode, status, payload, bytePlusAssetNow())
	return nil, assetError(errors.New(publicBytePlusAssetErrorMessage(code)), code, status)
}

func markBytePlusRealPersonAssetOutcomeUnknown(ctx context.Context, channelID int, record *model.APIIdempotencyRecord, asset *model.BytePlusAsset, reason string) {
	if record == nil || asset == nil {
		return
	}
	if err := model.MarkBytePlusRealPersonAssetOutcomeUnknownForIdempotency(record.Id, record.LeaseUpdatedTime, asset.Id, bytePlusRealPersonAssetFailureUnknown, bytePlusAssetNow()); err != nil {
		requestID := ""
		if ctx != nil {
			if value, ok := ctx.Value(common.RequestIdKey).(string); ok {
				requestID = value
			}
		}
		bytePlusAssetRestrictedLog(fmt.Sprintf("byteplus real-person asset outcome-unknown local transition failed request_id=%s channel_id=%d asset_id=%d reason=%s err=%v", requestID, channelID, asset.Id, reason, err))
	}
}

func failExistingRealPersonAssetClaim(record *model.APIIdempotencyRecord, userID int, apiErr *types.NewAPIError) (*dto.BytePlusAssetResponse, *types.NewAPIError) {
	if record == nil || strings.TrimSpace(record.ResourcePublicId) == "" {
		return nil, apiErr
	}
	asset, err := model.GetBytePlusAssetByPublicIDForUser(userID, record.ResourcePublicId)
	if err != nil {
		return nil, apiErr
	}
	status := apiErr.StatusCode
	if status <= 0 {
		status = http.StatusInternalServerError
	}
	code := apiErr.GetErrorCode()
	return failRealPersonAssetWithStoredError(record, asset, errorCodeToRealPersonAssetFailure(code), code, status)
}

func failUnboundRealPersonAssetClaim(record *model.APIIdempotencyRecord, apiErr *types.NewAPIError) (*dto.BytePlusAssetResponse, *types.NewAPIError) {
	if record == nil {
		return nil, apiErr
	}
	status := apiErr.StatusCode
	if status <= 0 {
		status = http.StatusInternalServerError
	}
	code := apiErr.GetErrorCode()
	payload, err := marshalAPIIdempotencyResponsePayload(storedAssetErrorPayload{ErrorCode: string(code)})
	if err != nil {
		payload = `{"error_code":"asset_storage_error"}`
	}
	_ = model.FailAPIIdempotency(record.Id, record.LeaseUpdatedTime, "", status, payload, bytePlusAssetNow())
	return nil, apiErr
}

func recordOrNil(record *model.APIIdempotencyRecord) *model.APIIdempotencyRecord {
	return record
}

func errorCodeToRealPersonAssetFailure(code types.ErrorCode) string {
	switch code {
	case types.ErrorCodeAssetChannelUnavailable:
		return "asset_channel_unavailable"
	case types.ErrorCodeInvalidAssetRequest:
		return "invalid_asset_request"
	default:
		return fmt.Sprintf("%s", code)
	}
}

func apiErrorFromStoredAssetPayload(payload string, status int) *types.NewAPIError {
	var stored storedAssetErrorPayload
	if err := common.Unmarshal([]byte(payload), &stored); err != nil || strings.TrimSpace(stored.ErrorCode) == "" {
		return assetError(errors.New("asset upstream error"), types.ErrorCodeAssetUpstreamError, http.StatusBadGateway)
	}
	if status <= 0 {
		status = http.StatusBadGateway
	}
	return assetError(errors.New(publicBytePlusAssetErrorMessage(types.ErrorCode(stored.ErrorCode))), types.ErrorCode(stored.ErrorCode), status)
}

func realPersonProfileGroupIDForAsset(userID int, profileID int64) string {
	profile, err := model.GetBytePlusRealPersonProfileByIDForUser(userID, profileID)
	if err != nil || profile.UpstreamGroupId == nil {
		return ""
	}
	return strings.TrimSpace(*profile.UpstreamGroupId)
}

type storedAssetErrorPayload struct {
	ErrorCode string `json:"error_code"`
}
