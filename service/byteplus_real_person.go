package service

import (
	"context"
	"errors"
	"net/http"
	"net/url"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/types"
)

const (
	bytePlusRealPersonObjectType           = "real_person"
	bytePlusRealPersonListObjectType       = "list"
	bytePlusRealPersonProfilePublicPrefix  = "rph_"
	bytePlusRealPersonSessionPublicPrefix  = "rvs_"
	bytePlusRealPersonPublicIDRandomLen    = 32
	bytePlusRealPersonSessionTTLSeconds    = int64(30 * 60)
	bytePlusRealPersonCallbackBaseURLEnv   = "BYTEPLUS_REAL_PERSON_CALLBACK_BASE_URL"
	bytePlusRealPersonCreateRoute          = "real_person_create"
	bytePlusRealPersonReverifyRoute        = "real_person_reverify"
	bytePlusRealPersonCallbackPathPrefix   = "/v1/real-person-verifications/callback/"
	bytePlusRealPersonVerificationResource = model.APIIdempotencyResourceTypeVerificationSession
)

type bytePlusRealPersonAPI interface {
	CreateVisualValidateSession(ctx context.Context, creds BytePlusCredentials, callbackURL string) (BytePlusVisualValidationSession, error)
	GetVisualValidateResult(ctx context.Context, creds BytePlusCredentials, bytedToken string) (BytePlusVisualValidationResult, error)
	CreateAsset(ctx context.Context, creds BytePlusCredentials, request BytePlusCreateAssetRequest) (string, string, error)
	GetAsset(ctx context.Context, creds BytePlusCredentials, upstreamAssetID string) (BytePlusAssetStatus, error)
	ListAssets(ctx context.Context, creds BytePlusCredentials, request BytePlusListAssetsRequest) (BytePlusListAssetsResult, error)
	DeleteAsset(ctx context.Context, creds BytePlusCredentials, upstreamAssetID string) (string, error)
}

var (
	bytePlusRealPersonProfilePublicID = func() (string, error) {
		random, err := common.GenerateRandomCharsKey(bytePlusRealPersonPublicIDRandomLen)
		if err != nil {
			return "", err
		}
		return bytePlusRealPersonProfilePublicPrefix + random, nil
	}
	bytePlusVisualValidationSessionPublicID = func() (string, error) {
		random, err := common.GenerateRandomCharsKey(bytePlusRealPersonPublicIDRandomLen)
		if err != nil {
			return "", err
		}
		return bytePlusRealPersonSessionPublicPrefix + random, nil
	}
	bytePlusRealPersonCallbackToken = func() (string, error) {
		return common.GenerateRandomCharsKey(48)
	}
	bytePlusRealPersonCipherFactory          = loadBytePlusSensitiveCipherFromEnv
	bytePlusRealPersonCompleteAPIIdempotency = model.CompleteAPIIdempotency
)

var (
	errBytePlusRealPersonCallbackTokenInvalid = errors.New("callback token is invalid")
	errBytePlusRealPersonCallbackBaseInvalid  = errors.New("callback base url is invalid")
)

func CreateBytePlusRealPerson(ctx context.Context, userID int, userGroup, usingGroup string, specificChannelID int, idempotencyKey string, request dto.BytePlusRealPersonCreateRequest) (*dto.BytePlusRealPersonResponse, *types.NewAPIError) {
	name, err := normalizeBytePlusRealPersonName(request.Name)
	if err != nil {
		return nil, realPersonError(types.ErrorCodeInvalidRealPersonRequest, http.StatusBadRequest)
	}
	requestHash, err := hashRealPersonCreateRequest(name, specificChannelID)
	if err != nil {
		return nil, realPersonError(types.ErrorCodeRealPersonStorageError, http.StatusInternalServerError)
	}
	keyHash, err := hashAPIIdempotencyKey(idempotencyKey)
	if err != nil {
		return nil, realPersonError(types.ErrorCodeInvalidRealPersonRequest, http.StatusBadRequest)
	}
	now := bytePlusAssetNow()
	claim, err := model.ClaimAPIIdempotency(userID, bytePlusRealPersonCreateRoute, keyHash, requestHash, bytePlusRealPersonVerificationResource, now, now-int64(apiIdempotencyLease.Seconds()), now+int64(apiIdempotencyRetention.Seconds()))
	if err != nil {
		return nil, realPersonError(types.ErrorCodeRealPersonStorageError, http.StatusInternalServerError)
	}
	switch claim.Decision {
	case model.DecisionConflict:
		return nil, realPersonError(types.ErrorCodeIdempotencyConflict, http.StatusConflict)
	case model.DecisionInProgress:
		return nil, realPersonError(types.ErrorCodeVerificationInProgress, http.StatusConflict)
	case model.DecisionOutcomeUnknown:
		return nil, realPersonError(types.ErrorCodeIdempotencyOutcomeUnknown, http.StatusConflict)
	case model.DecisionReplay:
		return replayBytePlusRealPersonClaim(userID, claim.Record)
	case model.DecisionResume:
		session, profile, apiErr := profileAndSessionFromRecord(userID, claim.Record)
		if apiErr != nil {
			return nil, apiErr
		}
		channel, creds, err := loadUsableBytePlusRealPersonChannel(profile.ChannelId, userID, "")
		if err != nil {
			return nil, realPersonError(types.ErrorCodeRealPersonChannelUnavailable, http.StatusServiceUnavailable)
		}
		cipher, err := bytePlusRealPersonCipherFactory()
		if err != nil {
			return nil, realPersonError(types.ErrorCodeRealPersonStorageError, http.StatusInternalServerError)
		}
		callbackToken, err := cipher.Decrypt(session.PublicId, bytePlusSensitiveFieldCallbackToken, session.CallbackTokenCiphertext)
		if err != nil {
			return nil, realPersonError(types.ErrorCodeRealPersonStorageError, http.StatusInternalServerError)
		}
		return createBytePlusVisualValidation(ctx, channel, creds, claim.Record, profile, session, callbackToken)
	case model.DecisionOwner:
		channel, creds, err := selectBytePlusRealPersonChannel(userGroup, usingGroup, specificChannelID)
		if err != nil {
			payload, _ := marshalAPIIdempotencyResponsePayload(storedRealPersonErrorPayload{ErrorCode: string(types.ErrorCodeRealPersonChannelUnavailable)})
			_ = model.FailAPIIdempotency(claim.Record.Id, claim.Record.LeaseUpdatedTime, "", http.StatusServiceUnavailable, payload, bytePlusAssetNow())
			return nil, realPersonError(types.ErrorCodeRealPersonChannelUnavailable, http.StatusServiceUnavailable)
		}
		return ownBytePlusRealPersonCreate(ctx, userID, channel, creds, claim.Record, &model.BytePlusRealPersonProfile{Name: name, ChannelId: channel.Id}, false)
	default:
		return nil, realPersonError(types.ErrorCodeRealPersonStorageError, http.StatusInternalServerError)
	}
}

func ReverifyBytePlusRealPerson(ctx context.Context, userID int, personID string, idempotencyKey string) (*dto.BytePlusRealPersonResponse, *types.NewAPIError) {
	profile, err := model.GetBytePlusRealPersonProfileForUser(userID, strings.TrimSpace(personID))
	if err != nil {
		if model.IsBytePlusRealPersonNotFound(err) {
			return nil, realPersonError(types.ErrorCodeRealPersonNotFound, http.StatusNotFound)
		}
		return nil, realPersonError(types.ErrorCodeRealPersonStorageError, http.StatusInternalServerError)
	}
	if profile.Status != model.BytePlusRealPersonProfileStatusFailed && profile.Status != model.BytePlusRealPersonProfileStatusExpired {
		return nil, realPersonError(types.ErrorCodeInvalidRealPersonRequest, http.StatusBadRequest)
	}
	channel, creds, err := loadUsableBytePlusRealPersonChannel(profile.ChannelId, userID, "")
	if err != nil {
		return nil, realPersonError(types.ErrorCodeRealPersonChannelUnavailable, http.StatusServiceUnavailable)
	}
	requestHash, err := hashCanonicalRequest(struct {
		ProfileID int64  `json:"profile_id"`
		Name      string `json:"name"`
		ChannelID int    `json:"channel_id"`
	}{ProfileID: profile.Id, Name: profile.Name, ChannelID: channel.Id})
	if err != nil {
		return nil, realPersonError(types.ErrorCodeRealPersonStorageError, http.StatusInternalServerError)
	}
	keyHash, err := hashAPIIdempotencyKey(idempotencyKey)
	if err != nil {
		return nil, realPersonError(types.ErrorCodeInvalidRealPersonRequest, http.StatusBadRequest)
	}
	now := bytePlusAssetNow()
	claim, err := model.ClaimAPIIdempotency(userID, bytePlusRealPersonReverifyRoute+":"+profile.PublicId, keyHash, requestHash, bytePlusRealPersonVerificationResource, now, now-int64(apiIdempotencyLease.Seconds()), now+int64(apiIdempotencyRetention.Seconds()))
	if err != nil {
		return nil, realPersonError(types.ErrorCodeRealPersonStorageError, http.StatusInternalServerError)
	}
	return handleBytePlusRealPersonClaim(ctx, userID, channel, creds, claim, profile, true)
}

func SyncBytePlusRealPersonVerification(ctx context.Context, userID int, profile *model.BytePlusRealPersonProfile) *types.NewAPIError {
	if profile == nil {
		return realPersonError(types.ErrorCodeRealPersonNotFound, http.StatusNotFound)
	}
	if profile.UserId != userID {
		return realPersonError(types.ErrorCodeRealPersonNotFound, http.StatusNotFound)
	}
	if profile.CurrentValidationSessionId == nil {
		return nil
	}
	if profile.Status == model.BytePlusRealPersonProfileStatusActive || profile.Status == model.BytePlusRealPersonProfileStatusFailed || profile.Status == model.BytePlusRealPersonProfileStatusExpired {
		return nil
	}
	session, err := model.GetBytePlusVisualValidationSessionByID(*profile.CurrentValidationSessionId)
	if err != nil {
		return realPersonError(types.ErrorCodeRealPersonStorageError, http.StatusInternalServerError)
	}
	now := bytePlusAssetNow()
	if session.ExpiresAt > 0 && session.ExpiresAt <= now {
		_, err = model.ExpireBytePlusRealPersonSession(profile.Id, session.Id, now)
		if err != nil {
			return realPersonError(types.ErrorCodeRealPersonStorageError, http.StatusInternalServerError)
		}
		reloaded, err := model.GetBytePlusRealPersonProfileByIDForUser(userID, profile.Id)
		if err != nil {
			return realPersonError(types.ErrorCodeRealPersonStorageError, http.StatusInternalServerError)
		}
		*profile = *reloaded
		return nil
	}
	claimed, owner, err := model.ClaimBytePlusVisualValidationSession(session.Id, now, now-int64(apiIdempotencyLease.Seconds()))
	if err != nil {
		return realPersonError(types.ErrorCodeRealPersonStorageError, http.StatusInternalServerError)
	}
	if !owner {
		return nil
	}
	if strings.TrimSpace(claimed.BytedTokenCiphertext) == "" {
		return nil
	}
	cipher, err := bytePlusRealPersonCipherFactory()
	if err != nil {
		return realPersonError(types.ErrorCodeRealPersonStorageError, http.StatusInternalServerError)
	}
	bytedToken, err := cipher.Decrypt(claimed.PublicId, bytePlusSensitiveFieldBytedToken, claimed.BytedTokenCiphertext)
	if err != nil {
		_, _ = model.FailBytePlusRealPersonSession(profile.Id, claimed.Id, "verification_secret_unreadable", bytePlusAssetNow())
		return realPersonError(types.ErrorCodeRealPersonStorageError, http.StatusInternalServerError)
	}
	channel, creds, err := loadUsableBytePlusRealPersonChannel(profile.ChannelId, userID, "")
	if err != nil {
		return realPersonError(types.ErrorCodeRealPersonChannelUnavailable, http.StatusServiceUnavailable)
	}
	client, err := realPersonClientForChannel(channel)
	if err != nil {
		return realPersonError(types.ErrorCodeRealPersonChannelUnavailable, http.StatusServiceUnavailable)
	}
	result, err := client.GetVisualValidateResult(ctx, creds, bytedToken)
	if err != nil {
		if isBytePlusDefinitiveResponse(err) {
			_, _ = model.FailBytePlusRealPersonSession(profile.Id, claimed.Id, "verification_upstream_error", bytePlusAssetNow())
			return realPersonError(types.ErrorCodeVerificationUpstreamError, http.StatusBadGateway)
		}
		return nil
	}
	if strings.TrimSpace(result.GroupID) != "" {
		_, err = model.ActivateBytePlusRealPersonProfile(profile.Id, claimed.Id, result.GroupID, bytePlusAssetNow())
		if err != nil {
			return realPersonError(types.ErrorCodeRealPersonStorageError, http.StatusInternalServerError)
		}
	}
	reloaded, err := model.GetBytePlusRealPersonProfileByIDForUser(userID, profile.Id)
	if err != nil {
		return realPersonError(types.ErrorCodeRealPersonStorageError, http.StatusInternalServerError)
	}
	*profile = *reloaded
	return nil
}

func GetBytePlusRealPerson(ctx context.Context, userID int, personID string) (*dto.BytePlusRealPersonResponse, *types.NewAPIError) {
	profile, err := model.GetBytePlusRealPersonProfileForUser(userID, strings.TrimSpace(personID))
	if err != nil {
		if model.IsBytePlusRealPersonNotFound(err) {
			return nil, realPersonError(types.ErrorCodeRealPersonNotFound, http.StatusNotFound)
		}
		return nil, realPersonError(types.ErrorCodeRealPersonStorageError, http.StatusInternalServerError)
	}
	if apiErr := SyncBytePlusRealPersonVerification(ctx, userID, profile); apiErr != nil {
		return nil, apiErr
	}
	return responseFromBytePlusRealPerson(profile, "", 0), nil
}

func ListBytePlusRealPersons(ctx context.Context, userID int, limit int, after string) (*dto.BytePlusRealPersonListResponse, *types.NewAPIError) {
	profiles, hasMore, err := model.ListBytePlusRealPersonProfilesForUser(userID, limit, strings.TrimSpace(after))
	if err != nil {
		if model.IsBytePlusRealPersonNotFound(err) {
			return nil, realPersonError(types.ErrorCodeRealPersonNotFound, http.StatusNotFound)
		}
		return nil, realPersonError(types.ErrorCodeRealPersonStorageError, http.StatusInternalServerError)
	}
	data := make([]dto.BytePlusRealPersonResponse, 0, len(profiles))
	for i := range profiles {
		data = append(data, *responseFromBytePlusRealPerson(&profiles[i], "", 0))
	}
	nextAfter := ""
	if hasMore && len(data) > 0 {
		nextAfter = data[len(data)-1].ID
	}
	return &dto.BytePlusRealPersonListResponse{Object: bytePlusRealPersonListObjectType, Data: data, HasMore: hasMore, NextAfter: nextAfter}, nil
}

func handleBytePlusRealPersonClaim(ctx context.Context, userID int, channel *model.Channel, creds BytePlusCredentials, claim *model.APIIdempotencyClaim, baseProfile *model.BytePlusRealPersonProfile, reverify bool) (*dto.BytePlusRealPersonResponse, *types.NewAPIError) {
	switch claim.Decision {
	case model.DecisionConflict:
		return nil, realPersonError(types.ErrorCodeIdempotencyConflict, http.StatusConflict)
	case model.DecisionInProgress:
		return nil, realPersonError(types.ErrorCodeVerificationInProgress, http.StatusConflict)
	case model.DecisionOutcomeUnknown:
		return nil, realPersonError(types.ErrorCodeIdempotencyOutcomeUnknown, http.StatusConflict)
	case model.DecisionReplay:
		return replayBytePlusRealPersonClaim(userID, claim.Record)
	case model.DecisionResume:
		return resumeBytePlusRealPersonCreate(ctx, userID, channel, creds, claim.Record)
	case model.DecisionOwner:
		return ownBytePlusRealPersonCreate(ctx, userID, channel, creds, claim.Record, baseProfile, reverify)
	default:
		return nil, realPersonError(types.ErrorCodeRealPersonStorageError, http.StatusInternalServerError)
	}
}

func ownBytePlusRealPersonCreate(ctx context.Context, userID int, channel *model.Channel, creds BytePlusCredentials, record *model.APIIdempotencyRecord, baseProfile *model.BytePlusRealPersonProfile, reverify bool) (*dto.BytePlusRealPersonResponse, *types.NewAPIError) {
	var profilePublicID string
	var err error
	if !reverify {
		profilePublicID, err = bytePlusRealPersonProfilePublicID()
		if err != nil {
			return nil, realPersonError(types.ErrorCodeRealPersonStorageError, http.StatusInternalServerError)
		}
	}
	session, callbackToken, apiErr := buildLocalBytePlusVisualValidationSession(record.LeaseUpdatedTime)
	if apiErr != nil {
		return nil, apiErr
	}
	now := bytePlusAssetNow()
	var profile *model.BytePlusRealPersonProfile
	var storedSession *model.BytePlusVisualValidationSession
	if reverify {
		profile, storedSession, err = model.ReplaceBytePlusRealPersonCurrentSessionForIdempotency(record.Id, record.LeaseUpdatedTime, userID, baseProfile.Id, []string{model.BytePlusRealPersonProfileStatusFailed, model.BytePlusRealPersonProfileStatusExpired}, *session, now)
	} else {
		profile, storedSession, err = model.CreateBytePlusRealPersonProfileAndSessionForIdempotency(record.Id, record.LeaseUpdatedTime, model.BytePlusRealPersonProfile{
			PublicId:    profilePublicID,
			UserId:      userID,
			Name:        baseProfile.Name,
			ChannelId:   channel.Id,
			Status:      model.BytePlusRealPersonProfileStatusPendingVerification,
			CreatedTime: now,
			UpdatedTime: now,
		}, *session, now)
	}
	if err != nil {
		return nil, realPersonError(types.ErrorCodeRealPersonStorageError, http.StatusInternalServerError)
	}
	return createBytePlusVisualValidation(ctx, channel, creds, record, profile, storedSession, callbackToken)
}

func resumeBytePlusRealPersonCreate(ctx context.Context, userID int, channel *model.Channel, creds BytePlusCredentials, record *model.APIIdempotencyRecord) (*dto.BytePlusRealPersonResponse, *types.NewAPIError) {
	session, profile, apiErr := profileAndSessionFromRecord(userID, record)
	if apiErr != nil {
		return nil, apiErr
	}
	cipher, err := bytePlusRealPersonCipherFactory()
	if err != nil {
		return nil, realPersonError(types.ErrorCodeRealPersonStorageError, http.StatusInternalServerError)
	}
	callbackToken, err := cipher.Decrypt(session.PublicId, bytePlusSensitiveFieldCallbackToken, session.CallbackTokenCiphertext)
	if err != nil {
		return nil, realPersonError(types.ErrorCodeRealPersonStorageError, http.StatusInternalServerError)
	}
	return createBytePlusVisualValidation(ctx, channel, creds, record, profile, session, callbackToken)
}

func createBytePlusVisualValidation(ctx context.Context, channel *model.Channel, creds BytePlusCredentials, record *model.APIIdempotencyRecord, profile *model.BytePlusRealPersonProfile, session *model.BytePlusVisualValidationSession, callbackToken string) (*dto.BytePlusRealPersonResponse, *types.NewAPIError) {
	callbackURL, err := bytePlusRealPersonCallbackURL(callbackToken)
	if err != nil {
		if errors.Is(err, errBytePlusRealPersonCallbackBaseInvalid) {
			return nil, realPersonError(types.ErrorCodeRealPersonChannelUnavailable, http.StatusServiceUnavailable)
		}
		return nil, realPersonError(types.ErrorCodeInvalidRealPersonRequest, http.StatusBadRequest)
	}
	now := bytePlusAssetNow()
	if err := model.MarkAPIIdempotencyCallingUpstream(record.Id, record.LeaseUpdatedTime, now); err != nil {
		_ = model.MarkBytePlusRealPersonVerificationOutcomeUnknownForIdempotency(record.Id, record.LeaseUpdatedTime, profile.Id, session.Id, "verification_lease_lost", bytePlusAssetNow())
		return nil, realPersonError(types.ErrorCodeIdempotencyOutcomeUnknown, http.StatusConflict)
	}
	client, err := realPersonClientForChannel(channel)
	if err != nil {
		_ = model.MarkBytePlusRealPersonVerificationOutcomeUnknownForIdempotency(record.Id, record.LeaseUpdatedTime, profile.Id, session.Id, "verification_client_unavailable", bytePlusAssetNow())
		return nil, realPersonError(types.ErrorCodeIdempotencyOutcomeUnknown, http.StatusConflict)
	}
	upstream, err := client.CreateVisualValidateSession(ctx, creds, callbackURL)
	if err != nil {
		return finishUnknownOrDefinitiveVerificationFailure(record, profile, session, err)
	}
	cipher, err := bytePlusRealPersonCipherFactory()
	if err != nil {
		_ = model.MarkBytePlusRealPersonVerificationOutcomeUnknownForIdempotency(record.Id, record.LeaseUpdatedTime, profile.Id, session.Id, "verification_cipher_unavailable", bytePlusAssetNow())
		return nil, realPersonError(types.ErrorCodeIdempotencyOutcomeUnknown, http.StatusConflict)
	}
	bytedCiphertext, err := cipher.Encrypt(session.PublicId, bytePlusSensitiveFieldBytedToken, upstream.BytedToken)
	if err != nil {
		_ = model.MarkBytePlusRealPersonVerificationOutcomeUnknownForIdempotency(record.Id, record.LeaseUpdatedTime, profile.Id, session.Id, "verification_cipher_failed", bytePlusAssetNow())
		return nil, realPersonError(types.ErrorCodeIdempotencyOutcomeUnknown, http.StatusConflict)
	}
	h5Ciphertext, err := cipher.Encrypt(session.PublicId, bytePlusSensitiveFieldH5Link, upstream.H5Link)
	if err != nil {
		_ = model.MarkBytePlusRealPersonVerificationOutcomeUnknownForIdempotency(record.Id, record.LeaseUpdatedTime, profile.Id, session.Id, "verification_cipher_failed", bytePlusAssetNow())
		return nil, realPersonError(types.ErrorCodeIdempotencyOutcomeUnknown, http.StatusConflict)
	}
	expiresAt := bytePlusAssetNow() + bytePlusRealPersonSessionTTLSeconds
	if err := model.CompleteBytePlusVisualValidationSession(session.Id, bytedCiphertext, h5Ciphertext, upstream.RequestID, expiresAt, bytePlusAssetNow()); err != nil {
		_ = model.MarkBytePlusRealPersonVerificationOutcomeUnknownForIdempotency(record.Id, record.LeaseUpdatedTime, profile.Id, session.Id, "verification_persistence_failed", bytePlusAssetNow())
		return nil, realPersonError(types.ErrorCodeIdempotencyOutcomeUnknown, http.StatusConflict)
	}
	safe := responseFromBytePlusRealPerson(profile, "", 0)
	payload, err := marshalAPIIdempotencyResponsePayload(safe)
	if err != nil {
		_ = model.MarkBytePlusRealPersonVerificationOutcomeUnknownForIdempotency(record.Id, record.LeaseUpdatedTime, profile.Id, session.Id, "verification_response_failed", bytePlusAssetNow())
		return nil, realPersonError(types.ErrorCodeIdempotencyOutcomeUnknown, http.StatusConflict)
	}
	if err := bytePlusRealPersonCompleteAPIIdempotency(record.Id, record.LeaseUpdatedTime, session.PublicId, http.StatusOK, payload, bytePlusAssetNow()); err != nil {
		_ = model.MarkBytePlusRealPersonVerificationOutcomeUnknownForIdempotency(record.Id, record.LeaseUpdatedTime, profile.Id, session.Id, "verification_ledger_complete_failed", bytePlusAssetNow())
		return nil, realPersonError(types.ErrorCodeIdempotencyOutcomeUnknown, http.StatusConflict)
	}
	return responseFromBytePlusRealPerson(profile, upstream.H5Link, expiresAt), nil
}

func replayBytePlusRealPersonClaim(userID int, record *model.APIIdempotencyRecord) (*dto.BytePlusRealPersonResponse, *types.NewAPIError) {
	if record.Status == model.APIIdempotencyStatusFailed {
		return nil, apiErrorFromStoredRealPersonPayload(record.ResponsePayload, record.ResponseStatus)
	}
	session, profile, apiErr := profileAndSessionFromRecord(userID, record)
	if apiErr != nil {
		return nil, apiErr
	}
	h5, expiresAt := replayableBytePlusRealPersonH5(profile, session)
	return responseFromBytePlusRealPerson(profile, h5, expiresAt), nil
}

func profileAndSessionFromRecord(userID int, record *model.APIIdempotencyRecord) (*model.BytePlusVisualValidationSession, *model.BytePlusRealPersonProfile, *types.NewAPIError) {
	session, err := model.GetBytePlusVisualValidationSessionByPublicID(record.ResourcePublicId)
	if err != nil {
		return nil, nil, realPersonError(types.ErrorCodeRealPersonStorageError, http.StatusInternalServerError)
	}
	profile, err := model.GetBytePlusRealPersonProfileByIDForUser(userID, session.ProfileId)
	if err != nil {
		if model.IsBytePlusRealPersonNotFound(err) {
			return nil, nil, realPersonError(types.ErrorCodeRealPersonNotFound, http.StatusNotFound)
		}
		return nil, nil, realPersonError(types.ErrorCodeRealPersonStorageError, http.StatusInternalServerError)
	}
	return session, profile, nil
}

func replayableBytePlusRealPersonH5(profile *model.BytePlusRealPersonProfile, session *model.BytePlusVisualValidationSession) (string, int64) {
	if profile == nil || session == nil || profile.CurrentValidationSessionId == nil || *profile.CurrentValidationSessionId != session.Id {
		return "", 0
	}
	if session.Status == model.BytePlusVisualValidationSessionStatusSucceeded || session.Status == model.BytePlusVisualValidationSessionStatusFailed || session.Status == model.BytePlusVisualValidationSessionStatusExpired {
		return "", 0
	}
	if session.ExpiresAt <= bytePlusAssetNow() || strings.TrimSpace(session.H5LinkCiphertext) == "" {
		return "", 0
	}
	cipher, err := bytePlusRealPersonCipherFactory()
	if err != nil {
		return "", 0
	}
	h5, err := cipher.Decrypt(session.PublicId, bytePlusSensitiveFieldH5Link, session.H5LinkCiphertext)
	if err != nil {
		return "", 0
	}
	return h5, session.ExpiresAt
}

func buildLocalBytePlusVisualValidationSession(now int64) (*model.BytePlusVisualValidationSession, string, *types.NewAPIError) {
	publicID, err := bytePlusVisualValidationSessionPublicID()
	if err != nil {
		return nil, "", realPersonError(types.ErrorCodeRealPersonStorageError, http.StatusInternalServerError)
	}
	callbackToken, err := bytePlusRealPersonCallbackToken()
	if err != nil {
		return nil, "", realPersonError(types.ErrorCodeRealPersonStorageError, http.StatusInternalServerError)
	}
	cipher, err := bytePlusRealPersonCipherFactory()
	if err != nil {
		return nil, "", realPersonError(types.ErrorCodeRealPersonStorageError, http.StatusInternalServerError)
	}
	callbackCiphertext, err := cipher.Encrypt(publicID, bytePlusSensitiveFieldCallbackToken, callbackToken)
	if err != nil {
		return nil, "", realPersonError(types.ErrorCodeRealPersonStorageError, http.StatusInternalServerError)
	}
	return &model.BytePlusVisualValidationSession{
		PublicId:                publicID,
		CallbackTokenHash:       sha256Hex([]byte(callbackToken)),
		CallbackTokenCiphertext: callbackCiphertext,
		Status:                  model.BytePlusVisualValidationSessionStatusCreating,
		CreatedTime:             now,
		UpdatedTime:             now,
	}, callbackToken, nil
}

func selectBytePlusRealPersonChannel(userGroup, usingGroup string, specificChannelID int) (*model.Channel, BytePlusCredentials, error) {
	groups := bytePlusAssetCandidateGroups(userGroup, usingGroup)
	if len(groups) == 0 {
		return nil, BytePlusCredentials{}, errors.New("no real person channel group available")
	}
	if specificChannelID > 0 {
		channel, creds, err := loadUsableBytePlusRealPersonChannel(specificChannelID, 0, groups[0])
		if err != nil {
			return nil, BytePlusCredentials{}, err
		}
		for _, group := range groups {
			ok, err := model.BytePlusRealPersonChannelHasEnabledAbility(channel.Id, group, bytePlusAssetModelName)
			if err != nil {
				return nil, BytePlusCredentials{}, err
			}
			if ok {
				return channel, creds, nil
			}
		}
		return nil, BytePlusCredentials{}, errors.New("specific channel does not support requested group")
	}
	for _, group := range groups {
		candidates, err := model.GetSatisfiedChannelCandidatesWithFilter(group, bytePlusAssetModelName, 0, func(channel *model.Channel) bool {
			if !bytePlusAssetChannelIsUsable(channel) {
				return false
			}
			creds, err := ParseBytePlusCredentials(channel.Key)
			return err == nil && creds.ValidateRealPersonAssets() == nil
		})
		if err != nil {
			return nil, BytePlusCredentials{}, err
		}
		channel, err := model.SelectWeightedRandomChannel(candidates)
		if err != nil {
			return nil, BytePlusCredentials{}, err
		}
		if channel == nil {
			continue
		}
		creds, err := ParseBytePlusCredentials(channel.Key)
		if err == nil && creds.ValidateRealPersonAssets() == nil {
			return channel, creds, nil
		}
	}
	return nil, BytePlusCredentials{}, errors.New("no real-person BytePlus channel")
}

func loadUsableBytePlusRealPersonChannel(channelID int, _ int, requestedGroup string) (*model.Channel, BytePlusCredentials, error) {
	channel, err := model.GetChannelById(channelID, true)
	if err != nil {
		return nil, BytePlusCredentials{}, err
	}
	if !bytePlusAssetChannelIsUsable(channel) {
		return nil, BytePlusCredentials{}, errors.New("channel unavailable")
	}
	creds, err := ParseBytePlusCredentials(channel.Key)
	if err != nil {
		return nil, BytePlusCredentials{}, err
	}
	if err := creds.ValidateRealPersonAssets(); err != nil {
		return nil, BytePlusCredentials{}, err
	}
	groups := bytePlusRealPersonChannelAbilityGroups(channel.Group, requestedGroup)
	for _, group := range groups {
		ok, err := model.BytePlusRealPersonChannelHasEnabledAbility(channel.Id, group, bytePlusAssetModelName)
		if err != nil {
			return nil, BytePlusCredentials{}, err
		}
		if ok {
			return channel, creds, nil
		}
	}
	return nil, BytePlusCredentials{}, errors.New("channel real person ability unavailable")
}

func bytePlusRealPersonChannelAbilityGroups(channelGroup, requestedGroup string) []string {
	requestedGroup = strings.TrimSpace(requestedGroup)
	if requestedGroup != "" {
		return []string{requestedGroup}
	}
	parts := strings.Split(channelGroup, ",")
	groups := make([]string, 0, len(parts))
	seen := make(map[string]bool, len(parts))
	for _, part := range parts {
		group := strings.TrimSpace(part)
		if group == "" || seen[group] {
			continue
		}
		seen[group] = true
		groups = append(groups, group)
	}
	if len(groups) == 0 {
		return []string{"default"}
	}
	return groups
}

func realPersonClientForChannel(channel *model.Channel) (bytePlusRealPersonAPI, error) {
	client, err := bytePlusAssetClientFactory(channel)
	if err != nil {
		return nil, err
	}
	realPersonClient, ok := client.(bytePlusRealPersonAPI)
	if !ok {
		return nil, errors.New("byteplus client does not support real person verification")
	}
	return realPersonClient, nil
}

func hashRealPersonCreateRequest(name string, specificChannelID int) (string, error) {
	return hashCanonicalRequest(struct {
		Name      string `json:"name"`
		ChannelID int    `json:"channel_id"`
	}{Name: strings.TrimSpace(name), ChannelID: specificChannelID})
}

func normalizeBytePlusRealPersonName(name string) (string, error) {
	name = strings.TrimSpace(name)
	count := utf8.RuneCountInString(name)
	if count < 1 || count > 64 {
		return "", errors.New("invalid real person name")
	}
	return name, nil
}

func bytePlusRealPersonCallbackURL(token string) (string, error) {
	token = strings.TrimSpace(token)
	if token == "" {
		return "", errBytePlusRealPersonCallbackTokenInvalid
	}
	rawBase := strings.TrimSpace(common.GetEnvOrDefaultString(bytePlusRealPersonCallbackBaseURLEnv, ""))
	parsed, err := url.Parse(rawBase)
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" || parsed.User != nil || parsed.RawQuery != "" || parsed.Fragment != "" {
		return "", errBytePlusRealPersonCallbackBaseInvalid
	}
	parsed.Path = strings.TrimRight(parsed.EscapedPath(), "/") + bytePlusRealPersonCallbackPathPrefix + url.PathEscape(token)
	return parsed.String(), nil
}

func responseFromBytePlusRealPerson(profile *model.BytePlusRealPersonProfile, verificationURL string, verificationExpiresAt int64) *dto.BytePlusRealPersonResponse {
	if profile == nil {
		return nil
	}
	response := &dto.BytePlusRealPersonResponse{
		ID:        profile.PublicId,
		Object:    bytePlusRealPersonObjectType,
		Name:      profile.Name,
		Status:    dto.BytePlusRealPersonAPIStatus(profile.Status),
		CreatedAt: profile.CreatedTime,
	}
	if verificationURL != "" {
		response.VerificationURL = verificationURL
		response.VerificationExpiresAt = verificationExpiresAt
	}
	return response
}

func finishUnknownOrDefinitiveVerificationFailure(record *model.APIIdempotencyRecord, profile *model.BytePlusRealPersonProfile, session *model.BytePlusVisualValidationSession, err error) (*dto.BytePlusRealPersonResponse, *types.NewAPIError) {
	if isBytePlusDefinitiveResponse(err) {
		_, _ = model.FailBytePlusRealPersonSession(profile.Id, session.Id, "verification_upstream_error", bytePlusAssetNow())
		payload, marshalErr := marshalAPIIdempotencyResponsePayload(storedRealPersonErrorPayload{ErrorCode: string(types.ErrorCodeVerificationUpstreamError)})
		if marshalErr != nil {
			payload = `{"error_code":"verification_upstream_error"}`
		}
		_ = model.FailAPIIdempotency(record.Id, record.LeaseUpdatedTime, session.PublicId, http.StatusBadGateway, payload, bytePlusAssetNow())
		return nil, realPersonError(types.ErrorCodeVerificationUpstreamError, http.StatusBadGateway)
	}
	_ = model.MarkBytePlusRealPersonVerificationOutcomeUnknownForIdempotency(record.Id, record.LeaseUpdatedTime, profile.Id, session.Id, "verification_outcome_unknown", bytePlusAssetNow())
	return nil, realPersonError(types.ErrorCodeIdempotencyOutcomeUnknown, http.StatusConflict)
}

func apiErrorFromStoredRealPersonPayload(payload string, status int) *types.NewAPIError {
	var stored storedRealPersonErrorPayload
	if err := common.Unmarshal([]byte(payload), &stored); err != nil || stored.ErrorCode == "" {
		return realPersonError(types.ErrorCodeVerificationUpstreamError, http.StatusBadGateway)
	}
	if status <= 0 {
		status = http.StatusBadGateway
	}
	return realPersonError(types.ErrorCode(stored.ErrorCode), status)
}

type storedRealPersonErrorPayload struct {
	ErrorCode string `json:"error_code"`
}

func realPersonError(code types.ErrorCode, status int) *types.NewAPIError {
	return types.NewOpenAIError(errors.New(publicBytePlusRealPersonErrorMessage(code)), code, status, types.ErrOptionWithSkipRetry(), types.ErrOptionWithNoRecordErrorLog())
}

func publicBytePlusRealPersonErrorMessage(code types.ErrorCode) string {
	switch code {
	case types.ErrorCodeInvalidRealPersonRequest:
		return "invalid real person request"
	case types.ErrorCodeRealPersonNotFound:
		return "real person not found"
	case types.ErrorCodeVerificationInProgress:
		return "verification in progress"
	case types.ErrorCodeIdempotencyConflict:
		return "idempotency conflict"
	case types.ErrorCodeIdempotencyOutcomeUnknown:
		return "idempotency outcome unknown"
	case types.ErrorCodeVerificationUpstreamError:
		return "verification upstream error"
	case types.ErrorCodeRealPersonChannelUnavailable:
		return "real person channel unavailable"
	case types.ErrorCodeRealPersonStorageError:
		return "real person storage error"
	default:
		return string(code)
	}
}
