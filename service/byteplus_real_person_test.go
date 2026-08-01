package service

import (
	"context"
	"errors"
	"io"
	"net/http"
	"os"
	"reflect"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/require"
)

var _ func(context.Context, int, *model.BytePlusRealPersonProfile) *types.NewAPIError = SyncBytePlusRealPersonVerification

type fakeBytePlusRealPersonClient struct {
	mu           sync.Mutex
	createCalls  int
	resultCalls  int
	createErr    error
	resultErr    error
	result       BytePlusVisualValidationResult
	onCreate     func()
	lastCallback string
}

func (f *fakeBytePlusRealPersonClient) CreateVisualValidateSession(ctx context.Context, creds BytePlusCredentials, callbackURL string) (BytePlusVisualValidationSession, error) {
	f.mu.Lock()
	f.createCalls++
	f.lastCallback = callbackURL
	onCreate := f.onCreate
	err := f.createErr
	f.mu.Unlock()
	if onCreate != nil {
		onCreate()
	}
	if err != nil {
		return BytePlusVisualValidationSession{}, err
	}
	return BytePlusVisualValidationSession{BytedToken: "byted-secret", H5Link: "https://verify.example/session", RequestID: "req-create"}, nil
}

func (f *fakeBytePlusRealPersonClient) GetVisualValidateResult(ctx context.Context, creds BytePlusCredentials, bytedToken string) (BytePlusVisualValidationResult, error) {
	f.mu.Lock()
	f.resultCalls++
	result := f.result
	err := f.resultErr
	f.mu.Unlock()
	if err != nil {
		return BytePlusVisualValidationResult{}, err
	}
	return result, nil
}

func (f *fakeBytePlusRealPersonClient) CreateAsset(ctx context.Context, creds BytePlusCredentials, request BytePlusCreateAssetRequest) (string, string, error) {
	return "", "", errors.New("unused")
}

func (f *fakeBytePlusRealPersonClient) CreateAssetGroup(ctx context.Context, creds BytePlusCredentials, name string) (string, string, error) {
	return "", "", errors.New("unused")
}

func (f *fakeBytePlusRealPersonClient) GetAsset(ctx context.Context, creds BytePlusCredentials, upstreamAssetID string) (BytePlusAssetStatus, error) {
	return BytePlusAssetStatus{}, errors.New("unused")
}

func (f *fakeBytePlusRealPersonClient) ListAssets(ctx context.Context, creds BytePlusCredentials, request BytePlusListAssetsRequest) (BytePlusListAssetsResult, error) {
	return BytePlusListAssetsResult{}, errors.New("unused")
}

func (f *fakeBytePlusRealPersonClient) DeleteAsset(ctx context.Context, creds BytePlusCredentials, upstreamAssetID string) (string, error) {
	return "", errors.New("unused")
}

type plainBytePlusRealPersonCipher struct{}

func (plainBytePlusRealPersonCipher) Encrypt(sessionID, field, plaintext string) (string, error) {
	if !strings.HasPrefix(sessionID, "rvs_") || len(sessionID) > 64 {
		return "", errors.New("bad aad")
	}
	return "cipher:" + field + ":" + plaintext, nil
}

func (plainBytePlusRealPersonCipher) Decrypt(sessionID, field, envelope string) (string, error) {
	prefix := "cipher:" + field + ":"
	if !strings.HasPrefix(sessionID, "rvs_") || !strings.HasPrefix(envelope, prefix) {
		return "", errors.New("bad envelope")
	}
	return strings.TrimPrefix(envelope, prefix), nil
}

func TestBytePlusRealPersonVerificationPublicSurfaceIsExact(t *testing.T) {
	apiType := reflect.TypeOf((*bytePlusRealPersonAPI)(nil)).Elem()
	require.Equal(t, 6, apiType.NumMethod())
	_, hasGroup := apiType.MethodByName("CreateAssetGroup")
	require.False(t, hasGroup)

	source, err := os.ReadFile("byteplus_real_person.go")
	require.NoError(t, err)
	for _, alias := range []string{"func Reverify(", "func Sync(", "func Get(", "func List("} {
		require.NotContains(t, string(source), alias)
	}
}

func TestBytePlusRealPersonCreateValidatesBeforeSideEffectsAndReturnsOneTimeVerification(t *testing.T) {
	newBytePlusRealPersonServiceTestDB(t)
	fake := &fakeBytePlusRealPersonClient{}
	fake.onCreate = func() {
		var record model.APIIdempotencyRecord
		require.NoError(t, model.DB.First(&record, "resource_public_id = ?", "rvs_test_1").Error)
		require.Equal(t, model.APIIdempotencyStatusCallingUpstream, record.Status)
		var profile model.BytePlusRealPersonProfile
		require.NoError(t, model.DB.First(&profile, "public_id = ?", "rph_test_1").Error)
		var session model.BytePlusVisualValidationSession
		require.NoError(t, model.DB.First(&session, "public_id = ?", "rvs_test_1").Error)
		require.Equal(t, profile.Id, session.ProfileId)
		require.NotEmpty(t, session.CallbackTokenHash)
		require.NotEmpty(t, session.CallbackTokenCiphertext)
		require.Empty(t, session.BytedTokenCiphertext)
	}
	installBytePlusRealPersonServiceTestDeps(t, fake)
	insertBytePlusRealPersonChannel(t, 101, "default", common.ChannelStatusEnabled, structuredRealPersonKey())

	for _, name := range []string{"   ", strings.Repeat("你", 65)} {
		_, err := CreateBytePlusRealPerson(context.Background(), 7, "default", "default", 0, "idem-invalid-"+name, dto.BytePlusRealPersonCreateRequest{Name: name})
		assertRealPersonError(t, err, types.ErrorCodeInvalidRealPersonRequest, http.StatusBadRequest)
	}
	require.Equal(t, 0, fake.createCalls)
	var profileCount int64
	require.NoError(t, model.DB.Model(&model.BytePlusRealPersonProfile{}).Count(&profileCount).Error)
	require.Equal(t, int64(0), profileCount)

	resp, err := CreateBytePlusRealPerson(context.Background(), 7, "default", "default", 0, "idem-create", dto.BytePlusRealPersonCreateRequest{Name: "  Alice  "})
	require.Nil(t, err)
	require.Equal(t, "rph_test_1", resp.ID)
	require.Equal(t, "Alice", resp.Name)
	require.Equal(t, "pending_verification", resp.Status)
	require.Equal(t, "https://verify.example/session", resp.VerificationURL)
	require.Equal(t, int64(3800), resp.VerificationExpiresAt)
	require.Equal(t, "https://api.flatkey.example/v1/real-person-verifications/callback/callback-token-1", fake.lastCallback)

	var profile model.BytePlusRealPersonProfile
	require.NoError(t, model.DB.First(&profile, "public_id = ?", "rph_test_1").Error)
	require.Equal(t, 7, profile.UserId)
	require.Equal(t, 101, profile.ChannelId)
	var session model.BytePlusVisualValidationSession
	require.NoError(t, model.DB.First(&session, "public_id = ?", "rvs_test_1").Error)
	require.Equal(t, profile.Id, session.ProfileId)
	require.NotEmpty(t, session.BytedTokenCiphertext)
	require.NotEmpty(t, session.H5LinkCiphertext)
	require.Empty(t, session.CallbackTokenCiphertext)
}

func TestBytePlusRealPersonCreateAllowsURLOnlyCredentialWithoutTOS(t *testing.T) {
	newBytePlusRealPersonServiceTestDB(t)
	fake := &fakeBytePlusRealPersonClient{}
	installBytePlusRealPersonServiceTestDeps(t, fake)
	insertBytePlusRealPersonChannel(t, 101, "default", common.ChannelStatusEnabled, urlOnlyRealPersonKey())

	resp, apiErr := CreateBytePlusRealPerson(context.Background(), 7, "default", "default", 101, "url-only-create", dto.BytePlusRealPersonCreateRequest{Name: "Alice"})

	require.Nil(t, apiErr)
	require.Equal(t, "rph_test_1", resp.ID)
	require.Equal(t, "https://verify.example/session", resp.VerificationURL)
	require.Equal(t, 1, fake.createCalls)
}

func TestBytePlusRealPersonCreateProfileIDFailureStopsBeforeStorageOrUpstream(t *testing.T) {
	newBytePlusRealPersonServiceTestDB(t)
	fake := &fakeBytePlusRealPersonClient{}
	installBytePlusRealPersonServiceTestDeps(t, fake)
	insertBytePlusRealPersonChannel(t, 101, "default", common.ChannelStatusEnabled, structuredRealPersonKey())
	oldProfileID := bytePlusRealPersonProfilePublicID
	bytePlusRealPersonProfilePublicID = func() (string, error) {
		return "", errors.New("profile id unavailable")
	}
	t.Cleanup(func() { bytePlusRealPersonProfilePublicID = oldProfileID })

	_, apiErr := CreateBytePlusRealPerson(context.Background(), 7, "default", "default", 101, "profile-id-fails", dto.BytePlusRealPersonCreateRequest{Name: "Alice"})
	assertRealPersonError(t, apiErr, types.ErrorCodeRealPersonStorageError, http.StatusInternalServerError)
	require.Equal(t, 0, fake.createCalls)
	var profileCount int64
	require.NoError(t, model.DB.Model(&model.BytePlusRealPersonProfile{}).Count(&profileCount).Error)
	require.Equal(t, int64(0), profileCount)
	var sessionCount int64
	require.NoError(t, model.DB.Model(&model.BytePlusVisualValidationSession{}).Count(&sessionCount).Error)
	require.Equal(t, int64(0), sessionCount)
	var record model.APIIdempotencyRecord
	require.NoError(t, model.DB.First(&record, "route = ?", bytePlusRealPersonCreateRoute).Error)
	require.Equal(t, model.APIIdempotencyStatusProcessing, record.Status)
	require.Empty(t, record.ResourcePublicId)
}

func TestBytePlusRealPersonCreateInvalidCallbackBaseIsChannelUnavailable(t *testing.T) {
	newBytePlusRealPersonServiceTestDB(t)
	fake := &fakeBytePlusRealPersonClient{}
	installBytePlusRealPersonServiceTestDeps(t, fake)
	t.Setenv("BYTEPLUS_REAL_PERSON_CALLBACK_BASE_URL", "http://secret.invalid/callback?token=leak")
	insertBytePlusRealPersonChannel(t, 101, "default", common.ChannelStatusEnabled, structuredRealPersonKey())

	_, apiErr := CreateBytePlusRealPerson(context.Background(), 7, "default", "default", 101, "bad-callback-base", dto.BytePlusRealPersonCreateRequest{Name: "Alice"})
	assertRealPersonError(t, apiErr, types.ErrorCodeRealPersonChannelUnavailable, http.StatusServiceUnavailable)
	require.Equal(t, 0, fake.createCalls)
	var profileCount int64
	require.NoError(t, model.DB.Model(&model.BytePlusRealPersonProfile{}).Count(&profileCount).Error)
	require.Equal(t, int64(0), profileCount)
	var sessionCount int64
	require.NoError(t, model.DB.Model(&model.BytePlusVisualValidationSession{}).Count(&sessionCount).Error)
	require.Equal(t, int64(0), sessionCount)
	var idempotencyCount int64
	require.NoError(t, model.DB.Model(&model.APIIdempotencyRecord{}).Count(&idempotencyCount).Error)
	require.Equal(t, int64(0), idempotencyCount)
}

func TestBytePlusRealPersonCreateInvalidCallbackTokenIsBadRequest(t *testing.T) {
	newBytePlusRealPersonServiceTestDB(t)
	fake := &fakeBytePlusRealPersonClient{}
	installBytePlusRealPersonServiceTestDeps(t, fake)
	oldCallback := bytePlusRealPersonCallbackToken
	bytePlusRealPersonCallbackToken = func() (string, error) { return "", nil }
	t.Cleanup(func() { bytePlusRealPersonCallbackToken = oldCallback })
	insertBytePlusRealPersonChannel(t, 101, "default", common.ChannelStatusEnabled, structuredRealPersonKey())

	_, apiErr := CreateBytePlusRealPerson(context.Background(), 7, "default", "default", 101, "bad-callback-token", dto.BytePlusRealPersonCreateRequest{Name: "Alice"})
	assertRealPersonError(t, apiErr, types.ErrorCodeInvalidRealPersonRequest, http.StatusBadRequest)
	require.Equal(t, 0, fake.createCalls)
}

func TestBytePlusRealPersonCallbackURLPreservesEscapedBasePath(t *testing.T) {
	newBytePlusRealPersonServiceTestDB(t)
	fake := &fakeBytePlusRealPersonClient{}
	installBytePlusRealPersonServiceTestDeps(t, fake)
	t.Setenv("BYTEPLUS_REAL_PERSON_CALLBACK_BASE_URL", "https://api.flatkey.example/callback%2Fbase")

	callbackURL, err := bytePlusRealPersonCallbackURL("callback-token-1")

	require.NoError(t, err)
	require.Equal(t, "https://api.flatkey.example/callback%2Fbase/v1/real-person-verifications/callback/callback-token-1", callbackURL)
}

func TestBytePlusRealPersonCreateIdempotencyReplayConflictAndSecretClearing(t *testing.T) {
	newBytePlusRealPersonServiceTestDB(t)
	fake := &fakeBytePlusRealPersonClient{}
	installBytePlusRealPersonServiceTestDeps(t, fake)
	insertBytePlusRealPersonChannel(t, 101, "default", common.ChannelStatusEnabled, structuredRealPersonKey())

	first, apiErr := CreateBytePlusRealPerson(context.Background(), 7, "default", "default", 101, "same-key", dto.BytePlusRealPersonCreateRequest{Name: "Alice"})
	require.Nil(t, apiErr)
	replay, apiErr := CreateBytePlusRealPerson(context.Background(), 7, "default", "default", 101, "same-key", dto.BytePlusRealPersonCreateRequest{Name: " Alice "})
	require.Nil(t, apiErr)
	require.Equal(t, first.ID, replay.ID)
	require.Equal(t, first.VerificationURL, replay.VerificationURL)
	require.Equal(t, 1, fake.createCalls)

	_, apiErr = CreateBytePlusRealPerson(context.Background(), 7, "default", "default", 101, "same-key", dto.BytePlusRealPersonCreateRequest{Name: "Bob"})
	assertRealPersonError(t, apiErr, types.ErrorCodeIdempotencyConflict, http.StatusConflict)
	require.Equal(t, 1, fake.createCalls)

	session, err := model.GetBytePlusVisualValidationSessionByPublicID("rvs_test_1")
	require.NoError(t, err)
	require.NoError(t, model.ClearBytePlusVisualValidationSecrets(session.Id, 3000))
	cleared, apiErr := CreateBytePlusRealPerson(context.Background(), 7, "default", "default", 101, "same-key", dto.BytePlusRealPersonCreateRequest{Name: "Alice"})
	require.Nil(t, apiErr)
	require.Empty(t, cleared.VerificationURL)
	require.Zero(t, cleared.VerificationExpiresAt)
	require.Equal(t, 1, fake.createCalls)
}

func TestBytePlusRealPersonCreateVerificationOutcomeUnknownIsSticky(t *testing.T) {
	newBytePlusRealPersonServiceTestDB(t)
	fake := &fakeBytePlusRealPersonClient{createErr: io.EOF}
	installBytePlusRealPersonServiceTestDeps(t, fake)
	insertBytePlusRealPersonChannel(t, 101, "default", common.ChannelStatusEnabled, structuredRealPersonKey())

	_, apiErr := CreateBytePlusRealPerson(context.Background(), 7, "default", "default", 0, "unknown-key", dto.BytePlusRealPersonCreateRequest{Name: "Alice"})
	assertRealPersonError(t, apiErr, types.ErrorCodeIdempotencyOutcomeUnknown, http.StatusBadGateway)
	_, apiErr = CreateBytePlusRealPerson(context.Background(), 7, "default", "default", 0, "unknown-key", dto.BytePlusRealPersonCreateRequest{Name: "Alice"})
	assertRealPersonError(t, apiErr, types.ErrorCodeIdempotencyOutcomeUnknown, http.StatusBadGateway)
	require.Equal(t, 1, fake.createCalls)
	var record model.APIIdempotencyRecord
	require.NoError(t, model.DB.First(&record, "route = ? AND key_hash <> ?", bytePlusRealPersonCreateRoute, "").Error)
	require.Equal(t, model.APIIdempotencyStatusOutcomeUnknown, record.Status)
	require.Equal(t, 0, record.ResponseStatus)
	require.Empty(t, record.ResponsePayload)
	var profile model.BytePlusRealPersonProfile
	require.NoError(t, model.DB.First(&profile, "public_id = ?", "rph_test_1").Error)
	require.Equal(t, model.BytePlusRealPersonProfileStatusFailed, profile.Status)
}

func TestBytePlusRealPersonCreateVerificationDefinitiveErrorIsSafeFailedReplay(t *testing.T) {
	newBytePlusRealPersonServiceTestDB(t)
	fake := &fakeBytePlusRealPersonClient{createErr: &BytePlusAPIError{StatusCode: 400, RequestID: "req-secret", Code: "bad_token", Definitive: true}}
	installBytePlusRealPersonServiceTestDeps(t, fake)
	insertBytePlusRealPersonChannel(t, 101, "default", common.ChannelStatusEnabled, structuredRealPersonKey())

	_, apiErr := CreateBytePlusRealPerson(context.Background(), 7, "default", "default", 0, "def-key", dto.BytePlusRealPersonCreateRequest{Name: "Alice"})
	assertRealPersonError(t, apiErr, types.ErrorCodeVerificationUpstreamError, http.StatusBadGateway)
	_, apiErr = CreateBytePlusRealPerson(context.Background(), 7, "default", "default", 0, "def-key", dto.BytePlusRealPersonCreateRequest{Name: "Alice"})
	assertRealPersonError(t, apiErr, types.ErrorCodeVerificationUpstreamError, http.StatusBadGateway)
	require.Equal(t, 1, fake.createCalls)
	var profile model.BytePlusRealPersonProfile
	require.NoError(t, model.DB.First(&profile, "public_id = ?", "rph_test_1").Error)
	require.Equal(t, model.BytePlusRealPersonProfileStatusFailed, profile.Status)
	var record model.APIIdempotencyRecord
	require.NoError(t, model.DB.First(&record, "route = ?", bytePlusRealPersonCreateRoute).Error)
	require.Equal(t, model.APIIdempotencyStatusFailed, record.Status)
}

func TestBytePlusRealPersonCreateVerificationCompleteCASLossLeavesCallingUpstreamForRecovery(t *testing.T) {
	newBytePlusRealPersonServiceTestDB(t)
	fake := &fakeBytePlusRealPersonClient{}
	fake.onCreate = func() {
		session, err := model.GetBytePlusVisualValidationSessionByPublicID("rvs_test_1")
		require.NoError(t, err)
		require.NoError(t, model.DB.Model(&model.BytePlusVisualValidationSession{}).Where("id = ?", session.Id).Updates(map[string]any{
			"status":       model.BytePlusVisualValidationSessionStatusFailed,
			"updated_time": int64(1999),
		}).Error)
	}
	installBytePlusRealPersonServiceTestDeps(t, fake)
	insertBytePlusRealPersonChannel(t, 101, "default", common.ChannelStatusEnabled, structuredRealPersonKey())

	_, apiErr := CreateBytePlusRealPerson(context.Background(), 7, "default", "default", 0, "complete-cas-loss", dto.BytePlusRealPersonCreateRequest{Name: "Alice"})
	assertRealPersonError(t, apiErr, types.ErrorCodeIdempotencyOutcomeUnknown, http.StatusBadGateway)
	require.Equal(t, 1, fake.createCalls)
	var record model.APIIdempotencyRecord
	require.NoError(t, model.DB.First(&record, "route = ?", bytePlusRealPersonCreateRoute).Error)
	require.Equal(t, model.APIIdempotencyStatusCallingUpstream, record.Status)
	require.NotEqual(t, model.APIIdempotencyStatusCompleted, record.Status)
	var session model.BytePlusVisualValidationSession
	require.NoError(t, model.DB.First(&session, "public_id = ?", "rvs_test_1").Error)
	require.Equal(t, model.BytePlusVisualValidationSessionStatusFailed, session.Status)
	require.Empty(t, session.BytedTokenCiphertext)
}

func TestBytePlusRealPersonCreateVerificationLedgerCompleteCASLossMarksOutcomeUnknown(t *testing.T) {
	newBytePlusRealPersonServiceTestDB(t)
	fake := &fakeBytePlusRealPersonClient{}
	installBytePlusRealPersonServiceTestDeps(t, fake)
	insertBytePlusRealPersonChannel(t, 101, "default", common.ChannelStatusEnabled, structuredRealPersonKey())
	oldComplete := bytePlusRealPersonCompleteAPIIdempotency
	bytePlusRealPersonCompleteAPIIdempotency = func(recordID int64, leaseUpdatedTime int64, publicID string, responseStatus int, responsePayload string, now int64) error {
		return model.ErrAPIIdempotencyCASLost
	}
	t.Cleanup(func() { bytePlusRealPersonCompleteAPIIdempotency = oldComplete })

	_, apiErr := CreateBytePlusRealPerson(context.Background(), 7, "default", "default", 0, "ledger-complete-cas-loss", dto.BytePlusRealPersonCreateRequest{Name: "Alice"})
	assertRealPersonError(t, apiErr, types.ErrorCodeIdempotencyOutcomeUnknown, http.StatusBadGateway)
	var record model.APIIdempotencyRecord
	require.NoError(t, model.DB.First(&record, "route = ?", bytePlusRealPersonCreateRoute).Error)
	require.Equal(t, model.APIIdempotencyStatusOutcomeUnknown, record.Status)
	var session model.BytePlusVisualValidationSession
	require.NoError(t, model.DB.First(&session, "public_id = ?", "rvs_test_1").Error)
	require.Equal(t, model.BytePlusVisualValidationSessionStatusFailed, session.Status)
	require.Empty(t, session.BytedTokenCiphertext)
	require.Empty(t, session.H5LinkCiphertext)
}

func TestBytePlusRealPersonCreateVerificationStaleProcessingResumeReusesBoundResource(t *testing.T) {
	newBytePlusRealPersonServiceTestDB(t)
	fake := &fakeBytePlusRealPersonClient{}
	installBytePlusRealPersonServiceTestDeps(t, fake)
	insertBytePlusRealPersonChannel(t, 101, "default", common.ChannelStatusEnabled, structuredRealPersonKey())

	cipher := plainBytePlusRealPersonCipher{}
	callbackCipher, err := cipher.Encrypt("rvs_original", bytePlusSensitiveFieldCallbackToken, "callback-original")
	require.NoError(t, err)
	profile := model.BytePlusRealPersonProfile{PublicId: "rph_original", UserId: 7, Name: "Alice", ChannelId: 101, Status: model.BytePlusRealPersonProfileStatusPendingVerification, CreatedTime: 100, UpdatedTime: 100}
	require.NoError(t, model.DB.Create(&profile).Error)
	session := model.BytePlusVisualValidationSession{PublicId: "rvs_original", ProfileId: profile.Id, CallbackTokenHash: sha256Hex([]byte("callback-original")), CallbackTokenCiphertext: callbackCipher, Status: model.BytePlusVisualValidationSessionStatusCreating, CreatedTime: 100, UpdatedTime: 100}
	require.NoError(t, model.DB.Create(&session).Error)
	require.NoError(t, model.DB.Model(&profile).Update("current_validation_session_id", session.Id).Error)
	keyHash, err := hashAPIIdempotencyKey("resume-key")
	require.NoError(t, err)
	requestHash, err := hashRealPersonCreateRequest("Alice", 0)
	require.NoError(t, err)
	require.NoError(t, model.DB.Create(&model.APIIdempotencyRecord{UserId: 7, Route: bytePlusRealPersonCreateRoute, KeyHash: keyHash, RequestHash: requestHash, Status: model.APIIdempotencyStatusProcessing, ResourceType: bytePlusRealPersonVerificationResource, ResourcePublicId: "rvs_original", LeaseUpdatedTime: 100, CreatedTime: 100, UpdatedTime: 100}).Error)

	resp, apiErr := CreateBytePlusRealPerson(context.Background(), 7, "default", "default", 0, "resume-key", dto.BytePlusRealPersonCreateRequest{Name: "Alice"})
	require.Nil(t, apiErr)
	require.Equal(t, "rph_original", resp.ID)
	require.Equal(t, "https://api.flatkey.example/v1/real-person-verifications/callback/callback-original", fake.lastCallback)
	require.Equal(t, 1, fake.createCalls)
	var profileCount int64
	require.NoError(t, model.DB.Model(&model.BytePlusRealPersonProfile{}).Count(&profileCount).Error)
	require.Equal(t, int64(1), profileCount)
}

func TestBytePlusRealPersonReverifyPinnedChannelRequiresEnabledAbilityWithoutFallback(t *testing.T) {
	newBytePlusRealPersonServiceTestDB(t)
	fake := &fakeBytePlusRealPersonClient{}
	installBytePlusRealPersonServiceTestDeps(t, fake)
	insertBytePlusRealPersonChannel(t, 101, "default", common.ChannelStatusEnabled, structuredRealPersonKey())
	insertBytePlusRealPersonChannel(t, 102, "default", common.ChannelStatusEnabled, structuredRealPersonKey())
	require.NoError(t, model.DB.Model(&model.Ability{}).Where("channel_id = ?", 101).Update("enabled", false).Error)
	require.NoError(t, model.DB.Create(&model.BytePlusRealPersonProfile{PublicId: "rph_failed", UserId: 7, Name: "Alice", ChannelId: 101, Status: model.BytePlusRealPersonProfileStatusFailed, CreatedTime: 100, UpdatedTime: 100}).Error)

	_, apiErr := ReverifyBytePlusRealPerson(context.Background(), 7, "rph_failed", "rev-disabled-ability")
	assertRealPersonError(t, apiErr, types.ErrorCodeRealPersonChannelUnavailable, http.StatusServiceUnavailable)
	require.Equal(t, 0, fake.createCalls)
}

func TestBytePlusRealPersonReverifyInvalidCallbackBaseStopsBeforeSessionOrIdempotency(t *testing.T) {
	newBytePlusRealPersonServiceTestDB(t)
	fake := &fakeBytePlusRealPersonClient{}
	installBytePlusRealPersonServiceTestDeps(t, fake)
	t.Setenv("BYTEPLUS_REAL_PERSON_CALLBACK_BASE_URL", "http://secret.invalid/callback?token=leak")
	insertBytePlusRealPersonChannel(t, 101, "default", common.ChannelStatusEnabled, structuredRealPersonKey())
	require.NoError(t, model.DB.Create(&model.BytePlusRealPersonProfile{PublicId: "rph_failed", UserId: 7, Name: "Alice", ChannelId: 101, Status: model.BytePlusRealPersonProfileStatusFailed, CreatedTime: 100, UpdatedTime: 100}).Error)

	_, apiErr := ReverifyBytePlusRealPerson(context.Background(), 7, "rph_failed", "rev-bad-callback-base")
	assertRealPersonError(t, apiErr, types.ErrorCodeRealPersonChannelUnavailable, http.StatusServiceUnavailable)
	require.Equal(t, 0, fake.createCalls)
	var profileCount int64
	require.NoError(t, model.DB.Model(&model.BytePlusRealPersonProfile{}).Count(&profileCount).Error)
	require.Equal(t, int64(1), profileCount)
	var sessionCount int64
	require.NoError(t, model.DB.Model(&model.BytePlusVisualValidationSession{}).Count(&sessionCount).Error)
	require.Equal(t, int64(0), sessionCount)
	var idempotencyCount int64
	require.NoError(t, model.DB.Model(&model.APIIdempotencyRecord{}).Count(&idempotencyCount).Error)
	require.Equal(t, int64(0), idempotencyCount)
}

func TestBytePlusRealPersonReverifyExpiresCurrentSessionBeforeRejectingStatus(t *testing.T) {
	newBytePlusRealPersonServiceTestDB(t)
	fake := &fakeBytePlusRealPersonClient{}
	installBytePlusRealPersonServiceTestDeps(t, fake)
	insertBytePlusRealPersonChannel(t, 101, "default", common.ChannelStatusEnabled, structuredRealPersonKey())
	profile := model.BytePlusRealPersonProfile{PublicId: "rph_pending", UserId: 7, Name: "Alice", ChannelId: 101, Status: model.BytePlusRealPersonProfileStatusPendingVerification, CreatedTime: 100, UpdatedTime: 100}
	require.NoError(t, model.DB.Create(&profile).Error)
	session := model.BytePlusVisualValidationSession{PublicId: "rvs_expired", ProfileId: profile.Id, CallbackTokenHash: strings.Repeat("a", 64), Status: model.BytePlusVisualValidationSessionStatusPending, ExpiresAt: 1999, CreatedTime: 100, UpdatedTime: 100}
	require.NoError(t, model.DB.Create(&session).Error)
	require.NoError(t, model.DB.Model(&model.BytePlusRealPersonProfile{}).Where("id = ?", profile.Id).Update("current_validation_session_id", session.Id).Error)

	rev, apiErr := ReverifyBytePlusRealPerson(context.Background(), 7, "rph_pending", "rev-expired-current")

	require.Nil(t, apiErr)
	require.Equal(t, "rph_pending", rev.ID)
	require.Equal(t, "pending_verification", rev.Status)
	require.Equal(t, 1, fake.createCalls)
	require.NoError(t, model.DB.First(&session, session.Id).Error)
	require.Equal(t, model.BytePlusVisualValidationSessionStatusExpired, session.Status)
}

func TestBytePlusRealPersonReverifyReplayDoesNotRequireCurrentChannelUsable(t *testing.T) {
	newBytePlusRealPersonServiceTestDB(t)
	fake := &fakeBytePlusRealPersonClient{}
	installBytePlusRealPersonServiceTestDeps(t, fake)
	insertBytePlusRealPersonChannel(t, 101, "default", common.ChannelStatusEnabled, structuredRealPersonKey())
	profile := model.BytePlusRealPersonProfile{PublicId: "rph_failed", UserId: 7, Name: "Alice", ChannelId: 101, Status: model.BytePlusRealPersonProfileStatusFailed, CreatedTime: 100, UpdatedTime: 100}
	require.NoError(t, model.DB.Create(&profile).Error)
	session := model.BytePlusVisualValidationSession{PublicId: "rvs_replay", ProfileId: profile.Id, CallbackTokenHash: strings.Repeat("b", 64), Status: model.BytePlusVisualValidationSessionStatusPending, CreatedTime: 100, UpdatedTime: 100}
	require.NoError(t, model.DB.Create(&session).Error)
	require.NoError(t, model.DB.Model(&model.BytePlusRealPersonProfile{}).Where("id = ?", profile.Id).Update("current_validation_session_id", session.Id).Error)
	requestHash, err := hashCanonicalRequest(struct {
		ProfileID int64  `json:"profile_id"`
		Name      string `json:"name"`
		ChannelID int    `json:"channel_id"`
	}{ProfileID: profile.Id, Name: profile.Name, ChannelID: profile.ChannelId})
	require.NoError(t, err)
	keyHash, err := hashAPIIdempotencyKey("rev-replay")
	require.NoError(t, err)
	require.NoError(t, model.DB.Create(&model.APIIdempotencyRecord{UserId: 7, Route: bytePlusRealPersonReverifyRoute + ":" + profile.PublicId, KeyHash: keyHash, RequestHash: requestHash, Status: model.APIIdempotencyStatusCompleted, ResourceType: bytePlusRealPersonVerificationResource, ResourcePublicId: session.PublicId, ResponseStatus: http.StatusOK, LeaseUpdatedTime: 100, CreatedTime: 100, UpdatedTime: 100}).Error)
	require.NoError(t, model.DB.Model(&model.Ability{}).Where("channel_id = ?", 101).Update("enabled", false).Error)

	replay, apiErr := ReverifyBytePlusRealPerson(context.Background(), 7, "rph_failed", "rev-replay")

	require.Nil(t, apiErr)
	require.Equal(t, "rph_failed", replay.ID)
	require.Equal(t, 0, fake.createCalls)
}

func TestBytePlusRealPersonReverifyReplayAllowsPendingProfileFromFirstAttempt(t *testing.T) {
	newBytePlusRealPersonServiceTestDB(t)
	fake := &fakeBytePlusRealPersonClient{}
	installBytePlusRealPersonServiceTestDeps(t, fake)
	insertBytePlusRealPersonChannel(t, 101, "default", common.ChannelStatusEnabled, structuredRealPersonKey())
	profile := model.BytePlusRealPersonProfile{PublicId: "rph_reverify_pending", UserId: 7, Name: "Alice", ChannelId: 101, Status: model.BytePlusRealPersonProfileStatusPendingVerification, CreatedTime: 100, UpdatedTime: 2000}
	require.NoError(t, model.DB.Create(&profile).Error)
	session := model.BytePlusVisualValidationSession{PublicId: "rvs_reverify_replay", ProfileId: profile.Id, CallbackTokenHash: strings.Repeat("c", 64), Status: model.BytePlusVisualValidationSessionStatusPending, CreatedTime: 2000, UpdatedTime: 2000}
	require.NoError(t, model.DB.Create(&session).Error)
	require.NoError(t, model.DB.Model(&model.BytePlusRealPersonProfile{}).Where("id = ?", profile.Id).Update("current_validation_session_id", session.Id).Error)
	requestHash, err := hashCanonicalRequest(struct {
		ProfileID int64  `json:"profile_id"`
		Name      string `json:"name"`
		ChannelID int    `json:"channel_id"`
	}{ProfileID: profile.Id, Name: profile.Name, ChannelID: profile.ChannelId})
	require.NoError(t, err)
	keyHash, err := hashAPIIdempotencyKey("rev-pending-replay")
	require.NoError(t, err)
	require.NoError(t, model.DB.Create(&model.APIIdempotencyRecord{UserId: 7, Route: bytePlusRealPersonReverifyRoute + ":" + profile.PublicId, KeyHash: keyHash, RequestHash: requestHash, Status: model.APIIdempotencyStatusCompleted, ResourceType: bytePlusRealPersonVerificationResource, ResourcePublicId: session.PublicId, ResponseStatus: http.StatusOK, LeaseUpdatedTime: 2000, CreatedTime: 2000, UpdatedTime: 2000}).Error)

	replay, apiErr := ReverifyBytePlusRealPerson(context.Background(), 7, "rph_reverify_pending", "rev-pending-replay")

	require.Nil(t, apiErr)
	require.Equal(t, "rph_reverify_pending", replay.ID)
	require.Equal(t, "pending_verification", replay.Status)
	require.Equal(t, 0, fake.createCalls)
}

func TestBytePlusRealPersonReverifyRetryProcessingReturnsInProgressForPendingProfile(t *testing.T) {
	newBytePlusRealPersonServiceTestDB(t)
	fake := &fakeBytePlusRealPersonClient{}
	installBytePlusRealPersonServiceTestDeps(t, fake)
	insertBytePlusRealPersonChannel(t, 101, "default", common.ChannelStatusEnabled, structuredRealPersonKey())
	profile := model.BytePlusRealPersonProfile{PublicId: "rph_reverify_processing", UserId: 7, Name: "Alice", ChannelId: 101, Status: model.BytePlusRealPersonProfileStatusPendingVerification, CreatedTime: 100, UpdatedTime: 2000}
	require.NoError(t, model.DB.Create(&profile).Error)
	session := model.BytePlusVisualValidationSession{PublicId: "rvs_reverify_processing", ProfileId: profile.Id, CallbackTokenHash: strings.Repeat("d", 64), Status: model.BytePlusVisualValidationSessionStatusCreating, CreatedTime: 2000, UpdatedTime: 2000}
	require.NoError(t, model.DB.Create(&session).Error)
	require.NoError(t, model.DB.Model(&model.BytePlusRealPersonProfile{}).Where("id = ?", profile.Id).Update("current_validation_session_id", session.Id).Error)
	requestHash, err := hashCanonicalRequest(struct {
		ProfileID int64  `json:"profile_id"`
		Name      string `json:"name"`
		ChannelID int    `json:"channel_id"`
	}{ProfileID: profile.Id, Name: profile.Name, ChannelID: profile.ChannelId})
	require.NoError(t, err)
	keyHash, err := hashAPIIdempotencyKey("rev-processing-retry")
	require.NoError(t, err)
	require.NoError(t, model.DB.Create(&model.APIIdempotencyRecord{UserId: 7, Route: bytePlusRealPersonReverifyRoute + ":" + profile.PublicId, KeyHash: keyHash, RequestHash: requestHash, Status: model.APIIdempotencyStatusProcessing, ResourceType: bytePlusRealPersonVerificationResource, ResourcePublicId: session.PublicId, LeaseUpdatedTime: 2000, CreatedTime: 2000, UpdatedTime: 2000}).Error)

	_, apiErr := ReverifyBytePlusRealPerson(context.Background(), 7, "rph_reverify_processing", "rev-processing-retry")

	assertRealPersonError(t, apiErr, types.ErrorCodeVerificationInProgress, http.StatusConflict)
	require.Equal(t, 0, fake.createCalls)
	var sessionCount int64
	require.NoError(t, model.DB.Model(&model.BytePlusVisualValidationSession{}).Count(&sessionCount).Error)
	require.Equal(t, int64(1), sessionCount)
}

func TestBytePlusRealPersonReverifyRetryCallingUpstreamReturnsOutcomeUnknownForPendingProfile(t *testing.T) {
	newBytePlusRealPersonServiceTestDB(t)
	fake := &fakeBytePlusRealPersonClient{}
	installBytePlusRealPersonServiceTestDeps(t, fake)
	insertBytePlusRealPersonChannel(t, 101, "default", common.ChannelStatusEnabled, structuredRealPersonKey())
	profile := model.BytePlusRealPersonProfile{PublicId: "rph_reverify_calling", UserId: 7, Name: "Alice", ChannelId: 101, Status: model.BytePlusRealPersonProfileStatusPendingVerification, CreatedTime: 100, UpdatedTime: 2000}
	require.NoError(t, model.DB.Create(&profile).Error)
	session := model.BytePlusVisualValidationSession{PublicId: "rvs_reverify_calling", ProfileId: profile.Id, CallbackTokenHash: strings.Repeat("e", 64), Status: model.BytePlusVisualValidationSessionStatusCreating, CreatedTime: 2000, UpdatedTime: 2000}
	require.NoError(t, model.DB.Create(&session).Error)
	require.NoError(t, model.DB.Model(&model.BytePlusRealPersonProfile{}).Where("id = ?", profile.Id).Update("current_validation_session_id", session.Id).Error)
	requestHash, err := hashCanonicalRequest(struct {
		ProfileID int64  `json:"profile_id"`
		Name      string `json:"name"`
		ChannelID int    `json:"channel_id"`
	}{ProfileID: profile.Id, Name: profile.Name, ChannelID: profile.ChannelId})
	require.NoError(t, err)
	keyHash, err := hashAPIIdempotencyKey("rev-calling-retry")
	require.NoError(t, err)
	require.NoError(t, model.DB.Create(&model.APIIdempotencyRecord{UserId: 7, Route: bytePlusRealPersonReverifyRoute + ":" + profile.PublicId, KeyHash: keyHash, RequestHash: requestHash, Status: model.APIIdempotencyStatusCallingUpstream, ResourceType: bytePlusRealPersonVerificationResource, ResourcePublicId: session.PublicId, LeaseUpdatedTime: 2000, CreatedTime: 2000, UpdatedTime: 2000}).Error)

	_, apiErr := ReverifyBytePlusRealPerson(context.Background(), 7, "rph_reverify_calling", "rev-calling-retry")

	assertRealPersonError(t, apiErr, types.ErrorCodeIdempotencyOutcomeUnknown, http.StatusBadGateway)
	require.Equal(t, 0, fake.createCalls)
	var sessionCount int64
	require.NoError(t, model.DB.Model(&model.BytePlusVisualValidationSession{}).Count(&sessionCount).Error)
	require.Equal(t, int64(1), sessionCount)
}

func TestBytePlusRealPersonConcurrentReverifySameKeyHasSingleUpstreamOwner(t *testing.T) {
	newBytePlusRealPersonServiceTestDB(t)
	fake := &fakeBytePlusRealPersonClient{}
	started := make(chan struct{})
	release := make(chan struct{})
	var startOnce sync.Once
	fake.onCreate = func() {
		startOnce.Do(func() { close(started) })
		<-release
	}
	installBytePlusRealPersonServiceTestDeps(t, fake)
	insertBytePlusRealPersonChannel(t, 101, "default", common.ChannelStatusEnabled, structuredRealPersonKey())
	require.NoError(t, model.DB.Create(&model.BytePlusRealPersonProfile{PublicId: "rph_failed_same_key", UserId: 7, Name: "Alice", ChannelId: 101, Status: model.BytePlusRealPersonProfileStatusFailed, CreatedTime: 100, UpdatedTime: 100}).Error)

	type reverifyResult struct {
		resp   *dto.BytePlusRealPersonResponse
		apiErr *types.NewAPIError
	}
	ownerDone := make(chan reverifyResult, 1)
	go func() {
		resp, apiErr := ReverifyBytePlusRealPerson(context.Background(), 7, "rph_failed_same_key", "rev-race-same")
		ownerDone <- reverifyResult{resp: resp, apiErr: apiErr}
	}()
	select {
	case <-started:
	case <-time.After(time.Second):
		t.Fatal("first reverify did not reach upstream")
	}

	_, loserErr := ReverifyBytePlusRealPerson(context.Background(), 7, "rph_failed_same_key", "rev-race-same")
	assertRealPersonError(t, loserErr, types.ErrorCodeIdempotencyOutcomeUnknown, http.StatusBadGateway)
	close(release)
	owner := <-ownerDone
	require.Nil(t, owner.apiErr)
	require.Equal(t, "rph_failed_same_key", owner.resp.ID)
	require.Equal(t, 1, fake.createCalls)
	var sessionCount int64
	require.NoError(t, model.DB.Model(&model.BytePlusVisualValidationSession{}).Count(&sessionCount).Error)
	require.Equal(t, int64(1), sessionCount)
	var profile model.BytePlusRealPersonProfile
	require.NoError(t, model.DB.First(&profile, "public_id = ?", "rph_failed_same_key").Error)
	require.NotNil(t, profile.CurrentValidationSessionId)
	var currentSessions int64
	require.NoError(t, model.DB.Model(&model.BytePlusVisualValidationSession{}).Where("id = ?", *profile.CurrentValidationSessionId).Count(&currentSessions).Error)
	require.Equal(t, int64(1), currentSessions)
}

func TestBytePlusRealPersonConcurrentReverifyDifferentKeyHasSingleCurrentSession(t *testing.T) {
	newBytePlusRealPersonServiceTestDB(t)
	fake := &fakeBytePlusRealPersonClient{}
	started := make(chan struct{})
	release := make(chan struct{})
	var startOnce sync.Once
	fake.onCreate = func() {
		startOnce.Do(func() { close(started) })
		<-release
	}
	installBytePlusRealPersonServiceTestDeps(t, fake)
	insertBytePlusRealPersonChannel(t, 101, "default", common.ChannelStatusEnabled, structuredRealPersonKey())
	require.NoError(t, model.DB.Create(&model.BytePlusRealPersonProfile{PublicId: "rph_failed_different_key", UserId: 7, Name: "Alice", ChannelId: 101, Status: model.BytePlusRealPersonProfileStatusFailed, CreatedTime: 100, UpdatedTime: 100}).Error)

	type reverifyResult struct {
		resp   *dto.BytePlusRealPersonResponse
		apiErr *types.NewAPIError
	}
	ownerDone := make(chan reverifyResult, 1)
	go func() {
		resp, apiErr := ReverifyBytePlusRealPerson(context.Background(), 7, "rph_failed_different_key", "rev-race-owner")
		ownerDone <- reverifyResult{resp: resp, apiErr: apiErr}
	}()
	select {
	case <-started:
	case <-time.After(time.Second):
		t.Fatal("first reverify did not reach upstream")
	}

	_, loserErr := ReverifyBytePlusRealPerson(context.Background(), 7, "rph_failed_different_key", "rev-race-loser")
	assertRealPersonError(t, loserErr, types.ErrorCodeInvalidRealPersonRequest, http.StatusBadRequest)
	close(release)
	owner := <-ownerDone
	require.Nil(t, owner.apiErr)
	require.Equal(t, "rph_failed_different_key", owner.resp.ID)
	require.Equal(t, 1, fake.createCalls)
	var sessionCount int64
	require.NoError(t, model.DB.Model(&model.BytePlusVisualValidationSession{}).Count(&sessionCount).Error)
	require.Equal(t, int64(1), sessionCount)
	var profile model.BytePlusRealPersonProfile
	require.NoError(t, model.DB.First(&profile, "public_id = ?", "rph_failed_different_key").Error)
	require.NotNil(t, profile.CurrentValidationSessionId)
	var currentSession model.BytePlusVisualValidationSession
	require.NoError(t, model.DB.First(&currentSession, *profile.CurrentValidationSessionId).Error)
	require.Equal(t, "rvs_test_1", currentSession.PublicId)
}

func TestBytePlusRealPersonReverifySameIdempotencyKeyAfterOtherUserNotFoundDoesNotPoisonOwner(t *testing.T) {
	newBytePlusRealPersonServiceTestDB(t)
	fake := &fakeBytePlusRealPersonClient{}
	installBytePlusRealPersonServiceTestDeps(t, fake)
	insertBytePlusRealPersonChannel(t, 101, "default", common.ChannelStatusEnabled, structuredRealPersonKey())
	require.NoError(t, model.DB.Create(&model.BytePlusRealPersonProfile{PublicId: "rph_owner_only", UserId: 7, Name: "Alice", ChannelId: 101, Status: model.BytePlusRealPersonProfileStatusFailed, CreatedTime: 100, UpdatedTime: 100}).Error)

	_, apiErr := ReverifyBytePlusRealPerson(context.Background(), 8, "rph_owner_only", "shared-reverify-key")
	assertRealPersonError(t, apiErr, types.ErrorCodeRealPersonNotFound, http.StatusNotFound)
	var records int64
	require.NoError(t, model.DB.Model(&model.APIIdempotencyRecord{}).Count(&records).Error)
	require.Zero(t, records)

	resp, apiErr := ReverifyBytePlusRealPerson(context.Background(), 7, "rph_owner_only", "shared-reverify-key")
	require.Nil(t, apiErr)
	require.Equal(t, "rph_owner_only", resp.ID)
	require.Equal(t, "pending_verification", resp.Status)
	require.Equal(t, 1, fake.createCalls)
}

func TestBytePlusRealPersonPinnedChannelSplitsCommaGroupsForAbility(t *testing.T) {
	newBytePlusRealPersonServiceTestDB(t)
	fake := &fakeBytePlusRealPersonClient{}
	installBytePlusRealPersonServiceTestDeps(t, fake)
	insertBytePlusRealPersonChannel(t, 101, "default,vip", common.ChannelStatusEnabled, structuredRealPersonKey())
	require.NoError(t, model.DB.Where("channel_id = ?", 101).Delete(&model.Ability{}).Error)
	priority := int64(101)
	weight := uint(1)
	require.NoError(t, model.DB.Create(&model.Ability{Group: "vip", Model: bytePlusAssetModelName, ChannelId: 101, Enabled: true, Priority: &priority, Weight: weight}).Error)

	_, _, err := loadUsableBytePlusRealPersonChannel(101, 7, "")
	require.NoError(t, err)
	_, _, err = loadUsableBytePlusRealPersonChannel(101, 7, "vip")
	require.NoError(t, err)
	_, _, err = loadUsableBytePlusRealPersonChannel(101, 7, "default")
	require.Error(t, err)
}

func TestBytePlusRealPersonVerificationTwoProfilesSameChannelKeepIndependentGroupIDs(t *testing.T) {
	newBytePlusRealPersonServiceTestDB(t)
	fake := &fakeBytePlusRealPersonClient{}
	installBytePlusRealPersonServiceTestDeps(t, fake)
	insertBytePlusRealPersonChannel(t, 101, "default", common.ChannelStatusEnabled, structuredRealPersonKey())

	first, apiErr := CreateBytePlusRealPerson(context.Background(), 7, "default", "default", 101, "key-one", dto.BytePlusRealPersonCreateRequest{Name: "Alice"})
	require.Nil(t, apiErr)
	second, apiErr := CreateBytePlusRealPerson(context.Background(), 7, "default", "default", 101, "key-two", dto.BytePlusRealPersonCreateRequest{Name: "Bob"})
	require.Nil(t, apiErr)

	fake.result = BytePlusVisualValidationResult{GroupID: "group-one", RequestID: "req-one"}
	_, apiErr = GetBytePlusRealPerson(context.Background(), 7, first.ID)
	require.Nil(t, apiErr)
	fake.result = BytePlusVisualValidationResult{GroupID: "group-two", RequestID: "req-two"}
	_, apiErr = GetBytePlusRealPerson(context.Background(), 7, second.ID)
	require.Nil(t, apiErr)

	firstProfile, err := model.GetBytePlusRealPersonProfileForUser(7, first.ID)
	require.NoError(t, err)
	secondProfile, err := model.GetBytePlusRealPersonProfileForUser(7, second.ID)
	require.NoError(t, err)
	require.Equal(t, 101, firstProfile.ChannelId)
	require.Equal(t, 101, secondProfile.ChannelId)
	require.NotNil(t, firstProfile.UpstreamGroupId)
	require.NotNil(t, secondProfile.UpstreamGroupId)
	require.Equal(t, "group-one", *firstProfile.UpstreamGroupId)
	require.Equal(t, "group-two", *secondProfile.UpstreamGroupId)
	require.NotEqual(t, firstProfile.Id, secondProfile.Id)
}

func TestBytePlusRealPersonReverifyGetListAndVerificationCAS(t *testing.T) {
	newBytePlusRealPersonServiceTestDB(t)
	fake := &fakeBytePlusRealPersonClient{result: BytePlusVisualValidationResult{GroupID: "group-new", RequestID: "req-result"}}
	installBytePlusRealPersonServiceTestDeps(t, fake)
	insertBytePlusRealPersonChannel(t, 101, "default", common.ChannelStatusEnabled, structuredRealPersonKey())

	created, apiErr := CreateBytePlusRealPerson(context.Background(), 7, "default", "default", 101, "create", dto.BytePlusRealPersonCreateRequest{Name: "Alice"})
	require.Nil(t, apiErr)
	_, apiErr = ReverifyBytePlusRealPerson(context.Background(), 7, created.ID, "rev-active")
	assertRealPersonError(t, apiErr, types.ErrorCodeInvalidRealPersonRequest, http.StatusBadRequest)

	session, err := model.GetBytePlusVisualValidationSessionByPublicID("rvs_test_1")
	require.NoError(t, err)
	ok, err := model.FailBytePlusRealPersonSession(session.ProfileId, session.Id, "upstream_failed", 2100)
	require.NoError(t, err)
	require.True(t, ok)
	rev, apiErr := ReverifyBytePlusRealPerson(context.Background(), 7, created.ID, "rev-key")
	require.Nil(t, apiErr)
	require.Equal(t, created.ID, rev.ID)
	require.Equal(t, "pending_verification", rev.Status)
	require.Equal(t, 2, fake.createCalls)

	_, apiErr = GetBytePlusRealPerson(context.Background(), 8, created.ID)
	assertRealPersonError(t, apiErr, types.ErrorCodeRealPersonNotFound, http.StatusNotFound)
	got, apiErr := GetBytePlusRealPerson(context.Background(), 7, created.ID)
	require.Nil(t, apiErr)
	require.Equal(t, "active", got.Status)
	require.Empty(t, got.VerificationURL)
	require.Equal(t, 1, fake.resultCalls)

	list, apiErr := ListBytePlusRealPersons(context.Background(), 7, 10, "")
	require.Nil(t, apiErr)
	require.Len(t, list.Data, 1)
	raw, err := common.Marshal(list)
	require.NoError(t, err)
	for _, forbidden := range []string{"byted", "callback", "group-new", "channel", "test-project", "provider-secret-test"} {
		require.NotContains(t, strings.ToLower(string(raw)), strings.ToLower(forbidden))
	}
}

func TestBytePlusRealPersonCallbackUsesOnlyServerSideResultAuthority(t *testing.T) {
	newBytePlusRealPersonServiceTestDB(t)
	fake := &fakeBytePlusRealPersonClient{resultErr: errors.New("server-side result unavailable")}
	installBytePlusRealPersonServiceTestDeps(t, fake)
	now := int64(2000)
	bytePlusAssetNow = func() int64 { return now }
	insertBytePlusRealPersonChannel(t, 101, "default", common.ChannelStatusEnabled, structuredRealPersonKey())

	created, apiErr := CreateBytePlusRealPerson(context.Background(), 7, "default", "default", 101, "callback-create", dto.BytePlusRealPersonCreateRequest{Name: "Alice"})
	require.Nil(t, apiErr)
	require.Equal(t, "rph_test_1", created.ID)

	NotifyBytePlusRealPersonVerificationCallback(context.Background(), "callback-token-1")
	profile, err := model.GetBytePlusRealPersonProfileForUser(7, created.ID)
	require.NoError(t, err)
	require.Equal(t, 1, fake.resultCalls)
	require.NotEqual(t, model.BytePlusRealPersonProfileStatusActive, profile.Status)
	require.Nil(t, profile.UpstreamGroupId)
	session, err := model.GetBytePlusVisualValidationSessionByPublicID("rvs_test_1")
	require.NoError(t, err)
	require.Equal(t, model.BytePlusVisualValidationSessionStatusPending, session.Status)
	require.Equal(t, int64(2060), session.UpdatedTime)

	fake.resultErr = nil
	fake.result = BytePlusVisualValidationResult{GroupID: "group-server-confirmed", RequestID: "req-result"}
	NotifyBytePlusRealPersonVerificationCallback(context.Background(), "callback-token-1")
	profile, err = model.GetBytePlusRealPersonProfileForUser(7, created.ID)
	require.NoError(t, err)
	require.Equal(t, 1, fake.resultCalls)
	require.NotEqual(t, model.BytePlusRealPersonProfileStatusActive, profile.Status)
	require.Nil(t, profile.UpstreamGroupId)

	now = 2060
	NotifyBytePlusRealPersonVerificationCallback(context.Background(), "callback-token-1")
	profile, err = model.GetBytePlusRealPersonProfileForUser(7, created.ID)
	require.NoError(t, err)
	require.Equal(t, 2, fake.resultCalls)
	require.Equal(t, model.BytePlusRealPersonProfileStatusActive, profile.Status)
	require.NotNil(t, profile.UpstreamGroupId)
	require.Equal(t, "group-server-confirmed", *profile.UpstreamGroupId)
}

func TestBytePlusRealPersonOldSessionCallbackAfterReverifyCannotActivateOrWriteGroup(t *testing.T) {
	newBytePlusRealPersonServiceTestDB(t)
	fake := &fakeBytePlusRealPersonClient{}
	installBytePlusRealPersonServiceTestDeps(t, fake)
	insertBytePlusRealPersonChannel(t, 101, "default", common.ChannelStatusEnabled, structuredRealPersonKey())

	created, apiErr := CreateBytePlusRealPerson(context.Background(), 7, "default", "default", 101, "callback-stale-create", dto.BytePlusRealPersonCreateRequest{Name: "Alice"})
	require.Nil(t, apiErr)
	oldSession, err := model.GetBytePlusVisualValidationSessionByPublicID("rvs_test_1")
	require.NoError(t, err)
	ok, err := model.FailBytePlusRealPersonSession(oldSession.ProfileId, oldSession.Id, "manual_reverify", 2100)
	require.NoError(t, err)
	require.True(t, ok)

	reverified, apiErr := ReverifyBytePlusRealPerson(context.Background(), 7, created.ID, "callback-stale-reverify")
	require.Nil(t, apiErr)
	require.Equal(t, created.ID, reverified.ID)
	require.Equal(t, "pending_verification", reverified.Status)
	fake.result = BytePlusVisualValidationResult{GroupID: "stale-callback-group", RequestID: "req-stale"}

	NotifyBytePlusRealPersonVerificationCallback(context.Background(), "callback-token-1")

	require.Equal(t, 0, fake.resultCalls)
	profile, err := model.GetBytePlusRealPersonProfileForUser(7, created.ID)
	require.NoError(t, err)
	require.Equal(t, model.BytePlusRealPersonProfileStatusPendingVerification, profile.Status)
	require.Nil(t, profile.UpstreamGroupId)
	require.NotNil(t, profile.CurrentValidationSessionId)
	require.NotEqual(t, oldSession.Id, *profile.CurrentValidationSessionId)
	require.NoError(t, model.DB.First(&oldSession, oldSession.Id).Error)
	require.Equal(t, model.BytePlusVisualValidationSessionStatusFailed, oldSession.Status)
	var newSession model.BytePlusVisualValidationSession
	require.NoError(t, model.DB.First(&newSession, *profile.CurrentValidationSessionId).Error)
	require.Equal(t, "rvs_test_2", newSession.PublicId)
	require.Equal(t, model.BytePlusVisualValidationSessionStatusPending, newSession.Status)
}

func TestSyncBytePlusRealPersonVerificationDefinitiveResultErrorRetriesWhileSessionUnexpired(t *testing.T) {
	newBytePlusRealPersonServiceTestDB(t)
	fake := &fakeBytePlusRealPersonClient{resultErr: &BytePlusAPIError{StatusCode: 400, RequestID: "req-secret", Code: "not_finished", Definitive: true}}
	installBytePlusRealPersonServiceTestDeps(t, fake)
	insertBytePlusRealPersonChannel(t, 101, "default", common.ChannelStatusEnabled, structuredRealPersonKey())

	created, apiErr := CreateBytePlusRealPerson(context.Background(), 7, "default", "default", 101, "definitive-result-create", dto.BytePlusRealPersonCreateRequest{Name: "Alice"})
	require.Nil(t, apiErr)
	profile, err := model.GetBytePlusRealPersonProfileForUser(7, created.ID)
	require.NoError(t, err)
	session, err := model.GetBytePlusVisualValidationSessionByPublicID("rvs_test_1")
	require.NoError(t, err)
	bytedCiphertext := session.BytedTokenCiphertext
	h5Ciphertext := session.H5LinkCiphertext

	apiErr = SyncBytePlusRealPersonVerification(context.Background(), 7, profile)

	require.Nil(t, apiErr)
	require.Equal(t, 1, fake.resultCalls)
	require.NoError(t, model.DB.First(&profile, profile.Id).Error)
	require.Equal(t, model.BytePlusRealPersonProfileStatusPendingVerification, profile.Status)
	require.Empty(t, profile.ErrorCode)
	require.Nil(t, profile.UpstreamGroupId)
	require.NoError(t, model.DB.First(&session, session.Id).Error)
	require.Equal(t, model.BytePlusVisualValidationSessionStatusPending, session.Status)
	require.Equal(t, int64(0), session.LeaseUpdatedTime)
	require.Equal(t, int64(2060), session.UpdatedTime)
	require.Equal(t, bytedCiphertext, session.BytedTokenCiphertext)
	require.Equal(t, h5Ciphertext, session.H5LinkCiphertext)
}

func newBytePlusRealPersonServiceTestDB(t *testing.T) {
	t.Helper()
	db := newBytePlusAssetServiceTestDB(t)
	requireNoError := func(err error) {
		if err != nil {
			t.Fatalf("automigrate real person: %v", err)
		}
	}
	requireNoError(db.AutoMigrate(&model.APIIdempotencyRecord{}, &model.BytePlusRealPersonProfile{}, &model.BytePlusVisualValidationSession{}, &model.BytePlusAssetTempObject{}))
}

func installBytePlusRealPersonServiceTestDeps(t *testing.T, fake *fakeBytePlusRealPersonClient) {
	t.Helper()
	oldNow := bytePlusAssetNow
	oldRPH := bytePlusRealPersonProfilePublicID
	oldRVS := bytePlusVisualValidationSessionPublicID
	oldCallback := bytePlusRealPersonCallbackToken
	oldFactory := bytePlusAssetClientFactory
	oldCipher := bytePlusRealPersonCipherFactory
	bytePlusAssetNow = func() int64 { return 2000 }
	var profileSeq int
	var sessionSeq int
	var callbackSeq int
	bytePlusRealPersonProfilePublicID = func() (string, error) {
		profileSeq++
		return "rph_test_" + string(rune('0'+profileSeq)), nil
	}
	bytePlusVisualValidationSessionPublicID = func() (string, error) {
		sessionSeq++
		return "rvs_test_" + string(rune('0'+sessionSeq)), nil
	}
	bytePlusRealPersonCallbackToken = func() (string, error) {
		callbackSeq++
		return "callback-token-" + string(rune('0'+callbackSeq)), nil
	}
	bytePlusAssetClientFactory = func(channel *model.Channel) (bytePlusAssetAPI, error) { return fake, nil }
	bytePlusRealPersonCipherFactory = func() (BytePlusSensitiveCipher, error) { return plainBytePlusRealPersonCipher{}, nil }
	t.Setenv("BYTEPLUS_REAL_PERSON_CALLBACK_BASE_URL", "https://api.flatkey.example")
	t.Cleanup(func() {
		bytePlusAssetNow = oldNow
		bytePlusRealPersonProfilePublicID = oldRPH
		bytePlusVisualValidationSessionPublicID = oldRVS
		bytePlusRealPersonCallbackToken = oldCallback
		bytePlusAssetClientFactory = oldFactory
		bytePlusRealPersonCipherFactory = oldCipher
	})
}

func insertBytePlusRealPersonChannel(t *testing.T, id int, group string, status int, key string) {
	t.Helper()
	insertBytePlusAssetChannel(t, id, group, status, key)
}

func structuredRealPersonKey() string {
	return `{"api_key":"video-api-test","access_key_id":"provider-access-test","secret_access_key":"provider-secret-test","project_name":"test-project","real_person_assets":{"enabled":true,"tos_bucket":"bucket","tos_region":"ap-southeast-1","tos_internal_endpoint":"https://tos-ap-southeast-1.ibytepluses.com"}}`
}

func urlOnlyRealPersonKey() string {
	return `{"api_key":"video-api-test","access_key_id":"provider-access-test","secret_access_key":"provider-secret-test","project_name":"test-project","real_person_assets":{"enabled":true}}`
}

func assertRealPersonError(t *testing.T, err error, code types.ErrorCode, status int) {
	t.Helper()
	if err == nil {
		t.Fatalf("error = nil, want %s/%d", code, status)
	}
	var apiErr *types.NewAPIError
	if !errors.As(err, &apiErr) || apiErr.GetErrorCode() != code || apiErr.StatusCode != status {
		t.Fatalf("error = %T %v, want %s/%d", err, err, code, status)
	}
	raw, marshalErr := common.Marshal(apiErr.ToOpenAIError())
	if marshalErr != nil {
		t.Fatalf("marshal error: %v", marshalErr)
	}
	for _, forbidden := range []string{"byted-secret", "verify.example", "callback-token", "bad_token", "req-secret"} {
		if strings.Contains(string(raw), forbidden) {
			t.Fatalf("public error leaked %q in %s", forbidden, raw)
		}
	}
}
