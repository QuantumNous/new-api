package service

import (
	"context"
	"errors"
	"net/http"
	"path"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
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
	return createBytePlusRealPersonAsset(ctx, userID, strings.TrimSpace(personID), idempotencyKey, request.AssetType, name, source)
}

func CreateBytePlusRealPersonAssetFromMultipart(ctx context.Context, userID int, personID, idempotencyKey string, request *http.Request) (*dto.BytePlusAssetResponse, *types.NewAPIError) {
	profile, channel, creds, apiErr := loadBytePlusRealPersonAssetProfileAndChannel(userID, strings.TrimSpace(personID))
	if apiErr != nil {
		return nil, apiErr
	}
	store, err := bytePlusTempObjectStoreFactory(creds)
	if err != nil {
		return nil, assetError(err, types.ErrorCodeAssetStorageError, http.StatusInternalServerError)
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
	return createBytePlusRealPersonAssetWithLoaded(ctx, userID, profile, channel, creds, store, idempotencyKey, uploaded.AssetType, name, source)
}

func createBytePlusRealPersonAsset(ctx context.Context, userID int, personID, idempotencyKey, assetType, name string, source realPersonAssetSource) (*dto.BytePlusAssetResponse, *types.NewAPIError) {
	profile, channel, creds, apiErr := loadBytePlusRealPersonAssetProfileAndChannel(userID, personID)
	if apiErr != nil {
		return nil, apiErr
	}
	return createBytePlusRealPersonAssetWithLoaded(ctx, userID, profile, channel, creds, nil, idempotencyKey, assetType, name, source)
}

func createBytePlusRealPersonAssetWithLoaded(ctx context.Context, userID int, profile *model.BytePlusRealPersonProfile, channel *model.Channel, creds BytePlusCredentials, store BytePlusTempObjectStore, idempotencyKey, assetType, name string, source realPersonAssetSource) (*dto.BytePlusAssetResponse, *types.NewAPIError) {
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
		return nil, assetError(errors.New("idempotency outcome unknown"), types.ErrorCodeIdempotencyOutcomeUnknown, http.StatusConflict)
	case model.DecisionReplay:
		cleanupRealPersonAssetUpload(ctx, source, store)
		return replayBytePlusRealPersonAssetClaim(claim.Record)
	case model.DecisionResume:
		return resumeBytePlusRealPersonAsset(ctx, profile, channel, creds, store, claim.Record, source)
	case model.DecisionOwner:
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
		upstreamURL, apiErr = presignRealPersonAssetObject(ctx, store, source.Uploaded.TempObject)
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
		var apiErr *types.NewAPIError
		upstreamURL, apiErr = presignRealPersonAssetObject(ctx, store, original)
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
		_ = model.MarkBytePlusRealPersonAssetOutcomeUnknownForIdempotency(record.Id, record.LeaseUpdatedTime, asset.Id, bytePlusRealPersonAssetFailureUnknown, bytePlusAssetNow())
		return nil, assetError(errors.New("idempotency outcome unknown"), types.ErrorCodeIdempotencyOutcomeUnknown, http.StatusConflict)
	}
	client, err := realPersonClientForChannel(channel)
	if err != nil {
		_ = model.MarkBytePlusRealPersonAssetOutcomeUnknownForIdempotency(record.Id, record.LeaseUpdatedTime, asset.Id, bytePlusRealPersonAssetFailureUnknown, bytePlusAssetNow())
		return nil, assetError(errors.New("idempotency outcome unknown"), types.ErrorCodeIdempotencyOutcomeUnknown, http.StatusConflict)
	}
	groupID := ""
	if asset.RealPersonProfileId != nil {
		groupID = realPersonProfileGroupIDForAsset(record.UserId, *asset.RealPersonProfileId)
	}
	if groupID == "" {
		_ = model.MarkBytePlusRealPersonAssetOutcomeUnknownForIdempotency(record.Id, record.LeaseUpdatedTime, asset.Id, bytePlusRealPersonAssetFailureUnknown, bytePlusAssetNow())
		return nil, assetError(errors.New("idempotency outcome unknown"), types.ErrorCodeIdempotencyOutcomeUnknown, http.StatusConflict)
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
		_ = model.MarkBytePlusRealPersonAssetOutcomeUnknownForIdempotency(record.Id, record.LeaseUpdatedTime, asset.Id, bytePlusRealPersonAssetFailureUnknown, bytePlusAssetNow())
		return nil, assetError(errors.New("idempotency outcome unknown"), types.ErrorCodeIdempotencyOutcomeUnknown, http.StatusConflict)
	}
	if err := bytePlusAssetUpdateAssetUpstreamCreated(asset.Id, upstreamID, requestID, model.BytePlusAssetStatusProcessing, bytePlusAssetNow()); err != nil {
		_ = model.MarkBytePlusRealPersonAssetOutcomeUnknownForIdempotency(record.Id, record.LeaseUpdatedTime, asset.Id, bytePlusRealPersonAssetFailureUnknown, bytePlusAssetNow())
		logBytePlusAssetPersistenceFailure(ctx, channel.Id, requestID)
		return nil, assetError(errors.New("idempotency outcome unknown"), types.ErrorCodeIdempotencyOutcomeUnknown, http.StatusConflict)
	}
	asset.UpstreamAssetId = upstreamID
	asset.UpstreamRequestId = requestID
	asset.Status = model.BytePlusAssetStatusProcessing
	asset.UpdatedTime = bytePlusAssetNow()
	safe := responseFromBytePlusAsset(asset)
	payload, err := marshalAPIIdempotencyResponsePayload(safe)
	if err != nil {
		_ = model.MarkBytePlusRealPersonAssetOutcomeUnknownForIdempotency(record.Id, record.LeaseUpdatedTime, asset.Id, bytePlusRealPersonAssetFailureUnknown, bytePlusAssetNow())
		return nil, assetError(errors.New("idempotency outcome unknown"), types.ErrorCodeIdempotencyOutcomeUnknown, http.StatusConflict)
	}
	if err := model.CompleteAPIIdempotency(record.Id, record.LeaseUpdatedTime, asset.PublicId, http.StatusOK, payload, bytePlusAssetNow()); err != nil {
		_ = model.MarkBytePlusRealPersonAssetOutcomeUnknownForIdempotency(record.Id, record.LeaseUpdatedTime, asset.Id, bytePlusRealPersonAssetFailureUnknown, bytePlusAssetNow())
		return nil, assetError(errors.New("idempotency outcome unknown"), types.ErrorCodeIdempotencyOutcomeUnknown, http.StatusConflict)
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
		return nil, nil, BytePlusCredentials{}, assetError(errors.New("real person is not active"), types.ErrorCodeInvalidAssetRequest, http.StatusBadRequest)
	}
	channel, creds, err := loadUsableBytePlusRealPersonChannel(profile.ChannelId, userID, "")
	if err != nil {
		return nil, nil, BytePlusCredentials{}, assetError(err, types.ErrorCodeAssetChannelUnavailable, http.StatusServiceUnavailable)
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

func presignRealPersonAssetObject(ctx context.Context, store BytePlusTempObjectStore, object *model.BytePlusAssetTempObject) (string, *types.NewAPIError) {
	if store == nil || object == nil {
		return "", assetError(errors.New("temp object is unavailable"), types.ErrorCodeAssetStorageError, http.StatusInternalServerError)
	}
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
