package service

import (
	"bytes"
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/require"
)

type realPersonAssetFixture struct {
	t       *testing.T
	profile model.BytePlusRealPersonProfile
	fake    *fakeRealPersonAssetClient
	store   *recordingRealPersonAssetStore
}

type fakeRealPersonAssetClient struct {
	mu               sync.Mutex
	createAssetCalls int
	createErr        error
	onCreateAsset    func()
	lastCreate       BytePlusCreateAssetRequest
}

func (f *fakeRealPersonAssetClient) CreateAssetGroup(context.Context, BytePlusCredentials, string) (string, string, error) {
	return "", "", errors.New("unused")
}

func (f *fakeRealPersonAssetClient) CreateAsset(_ context.Context, _ BytePlusCredentials, request BytePlusCreateAssetRequest) (string, string, error) {
	f.mu.Lock()
	f.createAssetCalls++
	call := f.createAssetCalls
	f.lastCreate = request
	onCreate := f.onCreateAsset
	err := f.createErr
	f.mu.Unlock()
	if onCreate != nil {
		onCreate()
	}
	if err != nil {
		return "", fmt.Sprintf("req-asset-%d", call), err
	}
	return fmt.Sprintf("upstream-asset-%d", call), fmt.Sprintf("req-asset-%d", call), nil
}

func (f *fakeRealPersonAssetClient) GetAsset(context.Context, BytePlusCredentials, string) (BytePlusAssetStatus, error) {
	return BytePlusAssetStatus{}, errors.New("unused")
}

func (f *fakeRealPersonAssetClient) CreateVisualValidateSession(context.Context, BytePlusCredentials, string) (BytePlusVisualValidationSession, error) {
	return BytePlusVisualValidationSession{}, errors.New("unused")
}

func (f *fakeRealPersonAssetClient) GetVisualValidateResult(context.Context, BytePlusCredentials, string) (BytePlusVisualValidationResult, error) {
	return BytePlusVisualValidationResult{}, errors.New("unused")
}

func (f *fakeRealPersonAssetClient) ListAssets(context.Context, BytePlusCredentials, BytePlusListAssetsRequest) (BytePlusListAssetsResult, error) {
	return BytePlusListAssetsResult{}, errors.New("unused")
}

func (f *fakeRealPersonAssetClient) DeleteAsset(context.Context, BytePlusCredentials, string) (string, error) {
	return "", errors.New("unused")
}

type recordingRealPersonAssetStore struct {
	mu           sync.Mutex
	puts         []fakeTempPut
	deletes      []string
	presignKeys  []string
	presignTTLs  []time.Duration
	presignByKey map[string]string
	presignErr   error
	blankPresign bool
}

func (s *recordingRealPersonAssetStore) PutObject(_ context.Context, key string, body io.Reader, contentType string, size int64) error {
	payload, err := io.ReadAll(body)
	if err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.puts = append(s.puts, fakeTempPut{key: key, contentType: contentType, size: size, body: payload})
	return nil
}

func (s *recordingRealPersonAssetStore) PresignGet(_ context.Context, key string, ttl time.Duration) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.presignKeys = append(s.presignKeys, key)
	s.presignTTLs = append(s.presignTTLs, ttl)
	if s.presignErr != nil {
		return "", s.presignErr
	}
	if s.blankPresign {
		return "   ", nil
	}
	if s.presignByKey != nil && s.presignByKey[key] != "" {
		return s.presignByKey[key], nil
	}
	return "https://signed.example/" + key, nil
}

func (s *recordingRealPersonAssetStore) DeleteObject(_ context.Context, key string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.deletes = append(s.deletes, key)
	return nil
}

func (s *recordingRealPersonAssetStore) TempObjectBucket() string {
	return "real-person-bucket"
}

func newRealPersonAssetFixture(t *testing.T) *realPersonAssetFixture {
	t.Helper()
	newBytePlusRealPersonServiceTestDB(t)
	fake := &fakeRealPersonAssetClient{}
	store := &recordingRealPersonAssetStore{}
	oldNow := bytePlusAssetNow
	oldUploadNow := bytePlusAssetUploadNow
	oldID := bytePlusAssetPublicID
	oldFactory := bytePlusAssetClientFactory
	oldStoreFactory := bytePlusTempObjectStoreFactory
	oldUploadRandom := bytePlusAssetUploadRandomKey
	bytePlusAssetNow = func() int64 { return 2000 }
	bytePlusAssetUploadNow = func() int64 { return 2000 }
	assetSeq := 0
	bytePlusAssetPublicID = func() (string, error) {
		assetSeq++
		return fmt.Sprintf("ast_real_%d", assetSeq), nil
	}
	objectSeq := 0
	bytePlusAssetUploadRandomKey = func(int) (string, error) {
		objectSeq++
		return fmt.Sprintf("object_%d", objectSeq), nil
	}
	bytePlusAssetClientFactory = func(*model.Channel) (bytePlusAssetAPI, error) { return fake, nil }
	bytePlusTempObjectStoreFactory = func(BytePlusCredentials) (BytePlusTempObjectStore, error) { return store, nil }
	t.Cleanup(func() {
		bytePlusAssetNow = oldNow
		bytePlusAssetUploadNow = oldUploadNow
		bytePlusAssetPublicID = oldID
		bytePlusAssetClientFactory = oldFactory
		bytePlusTempObjectStoreFactory = oldStoreFactory
		bytePlusAssetUploadRandomKey = oldUploadRandom
	})
	insertBytePlusRealPersonChannel(t, 101, "default", common.ChannelStatusEnabled, structuredRealPersonKey())
	profile := seedActiveRealPersonProfile(t, 7, 101, "rph_active")
	return &realPersonAssetFixture{t: t, profile: profile, fake: fake, store: store}
}

func seedActiveRealPersonProfile(t *testing.T, userID, channelID int, publicID string) model.BytePlusRealPersonProfile {
	t.Helper()
	groupID := "upstream-profile-group-" + publicID
	profile := model.BytePlusRealPersonProfile{
		PublicId: publicID, UserId: userID, Name: "Alice", ChannelId: channelID,
		Status: model.BytePlusRealPersonProfileStatusActive, UpstreamGroupId: &groupID,
		CreatedTime: 1000, UpdatedTime: 1000,
	}
	require.NoError(t, model.DB.Create(&profile).Error)
	return profile
}

func (f *realPersonAssetFixture) createURL(key, rawURL, assetType, name string) (*dto.BytePlusAssetResponse, *types.NewAPIError) {
	return CreateBytePlusRealPersonAssetFromURL(context.Background(), f.profile.UserId, f.profile.PublicId, key, dto.BytePlusRealPersonAssetCreateRequest{
		URL: rawURL, AssetType: assetType, Name: name,
	})
}

func (f *realPersonAssetFixture) createMultipart(key string, payload []byte, assetType, name string) (*dto.BytePlusAssetResponse, *types.NewAPIError) {
	parts := []multipartTestPart{fieldPart("asset_type", assetType)}
	if name != "__missing__" {
		parts = append(parts, fieldPart("name", name))
	}
	parts = append(parts, filePart("file", "person.png", payload))
	return CreateBytePlusRealPersonAssetFromMultipart(context.Background(), f.profile.UserId, f.profile.PublicId, key, newBytePlusMultipartRequest(f.t, parts))
}

func TestCreateRealPersonAssetFromURLUsesBoundProfileGroupAndDefaultModeration(t *testing.T) {
	f := newRealPersonAssetFixture(t)

	resp, apiErr := f.createURL("idem-url", "https://example.com/person.png", "Image", "front")

	require.Nil(t, apiErr)
	require.Equal(t, model.BytePlusAssetStatusProcessing, resp.Status)
	require.Nil(t, resp.Moderation)
	require.Equal(t, "asset://"+resp.ID, resp.AssetURI)
	require.Equal(t, *f.profile.UpstreamGroupId, f.fake.lastCreate.GroupID)
	require.Equal(t, "Default", f.fake.lastCreate.ModerationStrategy)
	var asset model.BytePlusAsset
	require.NoError(t, model.DB.First(&asset, "public_id = ?", resp.ID).Error)
	require.NotNil(t, asset.RealPersonProfileId)
	require.Equal(t, f.profile.Id, *asset.RealPersonProfileId)
	require.Equal(t, f.profile.UserId, asset.UserId)
	require.Equal(t, f.profile.ChannelId, asset.ChannelId)
	require.Equal(t, int64(0), asset.AssetGroupId)
}

func TestCreateRealPersonAssetFromURLDoesNotPersistCompleteSourceURL(t *testing.T) {
	f := newRealPersonAssetFixture(t)
	signedURL := "https://example.com/person.png?X-Tos-Signature=secret&X-Tos-Credential=private"

	resp, apiErr := f.createURL("idem-signed", signedURL, "Image", "front")

	require.Nil(t, apiErr)
	var asset model.BytePlusAsset
	require.NoError(t, model.DB.First(&asset, "public_id = ?", resp.ID).Error)
	require.Empty(t, asset.SourceURL)
	raw, err := common.Marshal(asset)
	require.NoError(t, err)
	require.NotContains(t, string(raw), "example.com")
	require.NotContains(t, string(raw), "X-Tos-Signature")
}

func TestCreateRealPersonAssetFromURLRejectsNameAbove128CodePointsBeforeLedgerOrUpstream(t *testing.T) {
	f := newRealPersonAssetFixture(t)

	_, apiErr := f.createURL("idem-long-name", "https://example.com/person.png", "Image", strings.Repeat("界", 129))

	assertAssetError(t, apiErr, types.ErrorCodeInvalidAssetRequest, http.StatusBadRequest)
	require.Equal(t, 0, f.fake.createAssetCalls)
	var records, assets int64
	require.NoError(t, model.DB.Model(&model.APIIdempotencyRecord{}).Count(&records).Error)
	require.NoError(t, model.DB.Model(&model.BytePlusAsset{}).Count(&assets).Error)
	require.Zero(t, records)
	require.Zero(t, assets)
}

func TestCreateRealPersonAssetFromMultipartRejectsNameAbove128CodePointsAndCleansUpload(t *testing.T) {
	f := newRealPersonAssetFixture(t)

	_, apiErr := f.createMultipart("idem-long-upload-name", pngHeader(), "Image", strings.Repeat("界", 129))

	assertAssetError(t, apiErr, types.ErrorCodeInvalidAssetRequest, http.StatusBadRequest)
	require.Len(t, f.store.puts, 1)
	require.Len(t, f.store.deletes, 1)
	require.Equal(t, 0, f.fake.createAssetCalls)
	var records int64
	require.NoError(t, model.DB.Model(&model.APIIdempotencyRecord{}).Count(&records).Error)
	require.Zero(t, records)
}

func TestNormalizeBytePlusRealPersonAssetNameCountsUnicodeCodePoints(t *testing.T) {
	name, apiErr := normalizeBytePlusRealPersonAssetName("  " + strings.Repeat("界", 128) + "  ")
	require.Nil(t, apiErr)
	require.Equal(t, strings.Repeat("界", 128), name)
	name, apiErr = normalizeBytePlusRealPersonAssetName("   ")
	require.Nil(t, apiErr)
	require.Empty(t, name)
	_, apiErr = normalizeBytePlusRealPersonAssetName(strings.Repeat("界", 129))
	assertAssetError(t, apiErr, types.ErrorCodeInvalidAssetRequest, http.StatusBadRequest)
}

func TestCreateRealPersonAssetFromMultipartBindsUploadedObjectAfterHashClaim(t *testing.T) {
	f := newRealPersonAssetFixture(t)
	f.fake.onCreateAsset = func() {
		var record model.APIIdempotencyRecord
		require.NoError(t, model.DB.First(&record, "route = ?", bytePlusRealPersonAssetCreateRoute).Error)
		require.Equal(t, model.APIIdempotencyStatusCallingUpstream, record.Status)
		var asset model.BytePlusAsset
		require.NoError(t, model.DB.First(&asset, "public_id = ?", record.ResourcePublicId).Error)
		var temp model.BytePlusAssetTempObject
		require.NoError(t, model.DB.First(&temp, "asset_id = ?", asset.Id).Error)
	}

	resp, apiErr := f.createMultipart("idem-upload", pngHeader(), "Image", "front")

	require.Nil(t, apiErr)
	require.Equal(t, model.BytePlusAssetStatusProcessing, resp.Status)
	require.Len(t, f.store.puts, 1)
	require.Equal(t, 1, f.fake.createAssetCalls)
	var temp model.BytePlusAssetTempObject
	require.NoError(t, model.DB.First(&temp).Error)
	require.NotNil(t, temp.AssetId)
	require.Equal(t, f.profile.UserId, temp.UserId)
	require.Equal(t, f.profile.ChannelId, temp.ChannelId)
}

func TestConcurrentMultipartSameKeyUploadsTwiceButCallsCreateAssetOnceAndDeletesLoser(t *testing.T) {
	f := newRealPersonAssetFixture(t)
	block := make(chan struct{})
	entered := make(chan struct{})
	f.fake.onCreateAsset = func() {
		close(entered)
		<-block
	}
	payload := append([]byte{}, pngHeader()...)
	payload = append(payload, []byte("same")...)

	type createResult struct {
		resp *dto.BytePlusAssetResponse
		err  *types.NewAPIError
	}
	firstDone := make(chan createResult, 1)
	secondDone := make(chan createResult, 1)
	go func() {
		resp, err := f.createMultipart("same-key", payload, "Image", "front")
		firstDone <- createResult{resp: resp, err: err}
	}()
	<-entered
	go func() {
		resp, err := f.createMultipart("same-key", append([]byte{}, payload...), "Image", "front")
		secondDone <- createResult{resp: resp, err: err}
	}()
	var second createResult
	select {
	case second = <-secondDone:
	case <-time.After(time.Second):
		t.Fatal("second same-key upload did not return while first upstream call was blocked")
	}
	assertAssetError(t, second.err, types.ErrorCodeVerificationInProgress, http.StatusConflict)
	close(block)
	var first createResult
	select {
	case first = <-firstDone:
	case <-time.After(time.Second):
		t.Fatal("first same-key upload did not finish after upstream was unblocked")
	}
	require.Nil(t, first.err)
	require.NotNil(t, first.resp)
	require.Nil(t, second.resp)
	require.Equal(t, 1, f.fake.createAssetCalls)
	require.Len(t, f.store.puts, 2)
	require.Len(t, f.store.deletes, 1)
	var assets int64
	require.NoError(t, model.DB.Model(&model.BytePlusAsset{}).Where("real_person_profile_id = ?", f.profile.Id).Count(&assets).Error)
	require.Equal(t, int64(1), assets)
}

func TestMultipartSameKeyDifferentFileHashConflictsAndCleansNewObject(t *testing.T) {
	f := newRealPersonAssetFixture(t)
	_, apiErr := f.createMultipart("same-key", pngHeader(), "Image", "front")
	require.Nil(t, apiErr)
	payload := append([]byte{}, pngHeader()...)
	payload = append(payload, []byte("different")...)

	_, apiErr = f.createMultipart("same-key", payload, "Image", "front")

	assertAssetError(t, apiErr, types.ErrorCodeIdempotencyConflict, http.StatusConflict)
	require.Len(t, f.store.puts, 2)
	require.Len(t, f.store.deletes, 1)
	require.Equal(t, 1, f.fake.createAssetCalls)
}

func TestCreateRealPersonAssetOutcomeUnknownNeverRetriesCreateAsset(t *testing.T) {
	f := newRealPersonAssetFixture(t)
	f.fake.createErr = context.DeadlineExceeded

	_, apiErr := f.createURL("unknown-key", "https://example.com/person.png", "Image", "front")
	assertAssetError(t, apiErr, types.ErrorCodeIdempotencyOutcomeUnknown, http.StatusBadGateway)
	f.fake.createErr = nil
	_, apiErr = f.createURL("unknown-key", "https://example.com/person.png", "Image", "front")

	assertAssetError(t, apiErr, types.ErrorCodeIdempotencyOutcomeUnknown, http.StatusBadGateway)
	require.Equal(t, 1, f.fake.createAssetCalls)
}

func TestRealPersonAssetURLReplaySurvivesProfileAndChannelDrift(t *testing.T) {
	f := newRealPersonAssetFixture(t)
	first, apiErr := f.createURL("replay-drift-url", "https://example.com/person.png", "Image", "front")
	require.Nil(t, apiErr)
	require.NoError(t, model.DB.Model(&model.BytePlusRealPersonProfile{}).Where("id = ?", f.profile.Id).Update("status", model.BytePlusRealPersonProfileStatusFailed).Error)
	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", f.profile.ChannelId).Update("status", common.ChannelStatusManuallyDisabled).Error)

	replay, apiErr := f.createURL("replay-drift-url", "https://example.com/person.png", "Image", "front")

	require.Nil(t, apiErr)
	require.Equal(t, first.ID, replay.ID)
	require.Equal(t, model.BytePlusAssetStatusProcessing, replay.Status)
	require.Equal(t, 1, f.fake.createAssetCalls)
}

func TestRealPersonAssetURLFailedReplaySurvivesProfileAndChannelDrift(t *testing.T) {
	f := newRealPersonAssetFixture(t)
	f.fake.createErr = &BytePlusAPIError{StatusCode: http.StatusBadRequest, RequestID: "req-explicit", Code: "InvalidParameter", Definitive: true}
	_, apiErr := f.createURL("failed-replay-drift-url", "https://example.com/person.png", "Image", "front")
	assertAssetError(t, apiErr, types.ErrorCodeAssetUpstreamError, http.StatusBadGateway)
	require.NoError(t, model.DB.Model(&model.BytePlusRealPersonProfile{}).Where("id = ?", f.profile.Id).Update("status", model.BytePlusRealPersonProfileStatusFailed).Error)
	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", f.profile.ChannelId).Update("status", common.ChannelStatusManuallyDisabled).Error)
	f.fake.createErr = nil

	_, apiErr = f.createURL("failed-replay-drift-url", "https://example.com/person.png", "Image", "front")

	assertAssetError(t, apiErr, types.ErrorCodeAssetUpstreamError, http.StatusBadGateway)
	require.Equal(t, 1, f.fake.createAssetCalls)
}

func TestRealPersonAssetMultipartReplaySurvivesProfileAndChannelDriftAndCleansNewUpload(t *testing.T) {
	f := newRealPersonAssetFixture(t)
	first, apiErr := f.createMultipart("replay-drift-upload", pngHeader(), "Image", "front")
	require.Nil(t, apiErr)
	require.NoError(t, model.DB.Model(&model.BytePlusRealPersonProfile{}).Where("id = ?", f.profile.Id).Update("status", model.BytePlusRealPersonProfileStatusFailed).Error)
	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", f.profile.ChannelId).Update("status", common.ChannelStatusManuallyDisabled).Error)

	replay, apiErr := f.createMultipart("replay-drift-upload", pngHeader(), "Image", "front")

	require.Nil(t, apiErr)
	require.Equal(t, first.ID, replay.ID)
	require.Equal(t, 1, f.fake.createAssetCalls)
	require.Len(t, f.store.puts, 2)
	require.Len(t, f.store.deletes, 1)
}

func TestRealPersonAssetOwnerValidationFailureStoresFailedLedger(t *testing.T) {
	f := newRealPersonAssetFixture(t)
	require.NoError(t, model.DB.Model(&model.BytePlusRealPersonProfile{}).Where("id = ?", f.profile.Id).Update("status", model.BytePlusRealPersonProfileStatusFailed).Error)

	_, apiErr := f.createURL("inactive-owner", "https://example.com/person.png", "Image", "front")

	assertAssetError(t, apiErr, types.ErrorCodeInvalidAssetRequest, http.StatusBadRequest)
	var record model.APIIdempotencyRecord
	require.NoError(t, model.DB.First(&record, "route = ?", bytePlusRealPersonAssetCreateRoute).Error)
	require.Equal(t, model.APIIdempotencyStatusFailed, record.Status)
	require.Equal(t, http.StatusBadRequest, record.ResponseStatus)
	_, apiErr = f.createURL("inactive-owner", "https://example.com/person.png", "Image", "front")
	assertAssetError(t, apiErr, types.ErrorCodeInvalidAssetRequest, http.StatusBadRequest)
	require.Equal(t, 0, f.fake.createAssetCalls)
}

func TestStaleMultipartProcessingUsesOriginalTempObjectAndCleansNewUpload(t *testing.T) {
	f := newRealPersonAssetFixture(t)
	sum := sha256.Sum256(pngHeader())
	asset := model.BytePlusAsset{
		PublicId: "ast_original", UserId: f.profile.UserId, ChannelId: f.profile.ChannelId, RealPersonProfileId: &f.profile.Id,
		AssetType: "Image", Name: "front", ModerationStrategy: "Default", Status: model.BytePlusAssetStatusCreating,
		CreatedTime: 1000, UpdatedTime: 1000,
	}
	require.NoError(t, model.DB.Create(&asset).Error)
	originalTemp := model.BytePlusAssetTempObject{
		AssetId: &asset.Id, UserId: f.profile.UserId, ChannelId: f.profile.ChannelId, Bucket: "real-person-bucket", ObjectKey: "original-key",
		ContentSHA256: fmt.Sprintf("%x", sum), SizeBytes: int64(len(pngHeader())), MimeType: "image/png",
		CleanupStatus: model.BytePlusTempObjectCleanupPending, SignedURLExpiresAt: 2200, CreatedTime: 1000, UpdatedTime: 1000,
	}
	require.NoError(t, model.DB.Create(&originalTemp).Error)
	requestHash, err := hashMultipartAssetRequest(f.profile.PublicId, "Image", "front", originalTemp.ContentSHA256, originalTemp.SizeBytes)
	require.NoError(t, err)
	keyHash, err := hashAPIIdempotencyKey("resume-upload")
	require.NoError(t, err)
	require.NoError(t, model.DB.Create(&model.APIIdempotencyRecord{
		UserId: f.profile.UserId, Route: bytePlusRealPersonAssetCreateRoute, KeyHash: keyHash, RequestHash: requestHash,
		Status: model.APIIdempotencyStatusProcessing, ResourceType: model.APIIdempotencyResourceAsset, ResourcePublicId: asset.PublicId,
		LeaseUpdatedTime: 1000, CreatedTime: 1000, UpdatedTime: 1000,
	}).Error)
	f.store.presignByKey = map[string]string{"original-key": "https://signed.example/original-key"}

	resp, apiErr := f.createMultipart("resume-upload", pngHeader(), "Image", "front")

	require.Nil(t, apiErr)
	require.Equal(t, "ast_original", resp.ID)
	require.Equal(t, "https://signed.example/original-key", f.fake.lastCreate.URL)
	require.Equal(t, 1, f.fake.createAssetCalls)
	require.Len(t, f.store.puts, 1)
	require.Len(t, f.store.deletes, 1)
	require.Equal(t, "original-key", f.store.presignKeys[0])
	require.NotContains(t, f.store.deletes, "original-key")
	var assets int64
	require.NoError(t, model.DB.Model(&model.BytePlusAsset{}).Where("real_person_profile_id = ?", f.profile.Id).Count(&assets).Error)
	require.Equal(t, int64(1), assets)
}

func TestStaleMultipartResumeExtendsOriginalTempObjectExpiryBeforeUpstream(t *testing.T) {
	f := newRealPersonAssetFixture(t)
	bytePlusAssetNow = func() int64 { return 50000 }
	sum := sha256.Sum256(pngHeader())
	asset := model.BytePlusAsset{
		PublicId: "ast_expiring", UserId: f.profile.UserId, ChannelId: f.profile.ChannelId, RealPersonProfileId: &f.profile.Id,
		AssetType: "Image", Name: "front", ModerationStrategy: "Default", Status: model.BytePlusAssetStatusCreating,
		CreatedTime: 1000, UpdatedTime: 1000,
	}
	require.NoError(t, model.DB.Create(&asset).Error)
	originalTemp := model.BytePlusAssetTempObject{
		AssetId: &asset.Id, UserId: f.profile.UserId, ChannelId: f.profile.ChannelId, Bucket: "real-person-bucket", ObjectKey: "original-expiring-key",
		ContentSHA256: fmt.Sprintf("%x", sum), SizeBytes: int64(len(pngHeader())), MimeType: "image/png",
		CleanupStatus: model.BytePlusTempObjectCleanupPending, SignedURLExpiresAt: 2200, NextCleanupAt: 2200, CreatedTime: 1000, UpdatedTime: 1000,
	}
	require.NoError(t, model.DB.Create(&originalTemp).Error)
	requestHash, err := hashMultipartAssetRequest(f.profile.PublicId, "Image", "front", originalTemp.ContentSHA256, originalTemp.SizeBytes)
	require.NoError(t, err)
	keyHash, err := hashAPIIdempotencyKey("resume-expiring-upload")
	require.NoError(t, err)
	require.NoError(t, model.DB.Create(&model.APIIdempotencyRecord{
		UserId: f.profile.UserId, Route: bytePlusRealPersonAssetCreateRoute, KeyHash: keyHash, RequestHash: requestHash,
		Status: model.APIIdempotencyStatusProcessing, ResourceType: model.APIIdempotencyResourceAsset, ResourcePublicId: asset.PublicId,
		LeaseUpdatedTime: 1000, CreatedTime: 1000, UpdatedTime: 1000,
	}).Error)
	wantExpiry := int64(50000 + bytePlusSignedURLTTL.Seconds())
	f.fake.onCreateAsset = func() {
		var temp model.BytePlusAssetTempObject
		require.NoError(t, model.DB.First(&temp, originalTemp.Id).Error)
		require.Equal(t, wantExpiry, temp.SignedURLExpiresAt)
		require.Equal(t, wantExpiry, temp.NextCleanupAt)
		require.Equal(t, model.BytePlusTempObjectCleanupPending, temp.CleanupStatus)
	}

	resp, apiErr := f.createMultipart("resume-expiring-upload", pngHeader(), "Image", "front")

	require.Nil(t, apiErr)
	require.Equal(t, "ast_expiring", resp.ID)
	var temp model.BytePlusAssetTempObject
	require.NoError(t, model.DB.First(&temp, originalTemp.Id).Error)
	require.Equal(t, wantExpiry, temp.SignedURLExpiresAt)
	require.Equal(t, wantExpiry, temp.NextCleanupAt)
	require.Equal(t, 1, f.fake.createAssetCalls)
}

func TestBytePlusAssetResponseKeepsVirtualModerationAndAddsRealPersonURI(t *testing.T) {
	virtual := responseFromBytePlusAsset(&model.BytePlusAsset{
		PublicId: "ast_virtual", AssetType: "Image", Status: model.BytePlusAssetStatusProcessing,
		ModerationStrategy: "Skip", CreatedTime: 123,
	})
	require.NotNil(t, virtual.Moderation)
	require.Equal(t, "Skip", virtual.Moderation.Strategy)
	profileID := int64(9)
	real := responseFromBytePlusAsset(&model.BytePlusAsset{
		PublicId: "ast_real", RealPersonProfileId: &profileID, AssetType: "Image", Name: "front",
		Status: model.BytePlusAssetStatusProcessing, FailureCode: "upstream_failed", CreatedTime: 123,
	})
	require.Nil(t, real.Moderation)
	require.Equal(t, "asset://ast_real", real.AssetURI)
	require.Equal(t, "front", real.Name)
	require.Equal(t, "upstream_failed", real.FailureCode)
}

func TestListRealPersonAssetsScopesUserAndProfileAndHidesDeleted(t *testing.T) {
	f := newRealPersonAssetFixture(t)
	other := seedActiveRealPersonProfile(t, 7, 101, "rph_other")
	seedRealPersonAssetRow(t, "ast_visible", 7, f.profile.Id, model.BytePlusAssetStatusActive, 2100, "")
	seedRealPersonAssetRow(t, "ast_deleted", 7, f.profile.Id, model.BytePlusAssetStatusDeleted, 2200, "")
	seedRealPersonAssetRow(t, "ast_other_profile", 7, other.Id, model.BytePlusAssetStatusActive, 2300, "")
	seedRealPersonAssetRow(t, "ast_other_user", 8, f.profile.Id, model.BytePlusAssetStatusActive, 2400, "")

	list, apiErr := ListBytePlusRealPersonAssets(context.Background(), 7, f.profile.PublicId, 10, "")

	require.Nil(t, apiErr)
	require.Equal(t, bytePlusRealPersonListObjectType, list.Object)
	require.Len(t, list.Data, 1)
	require.Equal(t, "ast_visible", list.Data[0].ID)
	require.Equal(t, "asset://ast_visible", list.Data[0].AssetURI)
	raw, err := common.Marshal(list)
	require.NoError(t, err)
	for _, forbidden := range []string{"upstream", "group", "channel", "project3", "sk-test"} {
		require.NotContains(t, strings.ToLower(string(raw)), forbidden)
	}
}

func TestListRealPersonAssetsReturnsFailedWithStableFailureCode(t *testing.T) {
	f := newRealPersonAssetFixture(t)
	seedRealPersonAssetRow(t, "ast_failed", 7, f.profile.Id, model.BytePlusAssetStatusFailed, 2100, "asset_upstream_error")

	list, apiErr := ListBytePlusRealPersonAssets(context.Background(), 7, f.profile.PublicId, 10, "")

	require.Nil(t, apiErr)
	require.Len(t, list.Data, 1)
	require.Equal(t, model.BytePlusAssetStatusFailed, list.Data[0].Status)
	require.Equal(t, "asset_upstream_error", list.Data[0].FailureCode)
}

func TestListRealPersonAssetsRejectsUnknownCursor(t *testing.T) {
	f := newRealPersonAssetFixture(t)
	seedRealPersonAssetRow(t, "ast_visible", 7, f.profile.Id, model.BytePlusAssetStatusActive, 2100, "")

	_, apiErr := ListBytePlusRealPersonAssets(context.Background(), 7, f.profile.PublicId, 10, "ast_missing")

	assertAssetError(t, apiErr, types.ErrorCodeInvalidAssetRequest, http.StatusBadRequest)
}

func TestListRealPersonAssetsUsesStableTieBreakerAndRejectsOutOfScopeCursors(t *testing.T) {
	f := newRealPersonAssetFixture(t)
	other := seedActiveRealPersonProfile(t, 7, 101, "rph_other_tie")
	seedRealPersonAssetRow(t, "ast_newer", 7, f.profile.Id, model.BytePlusAssetStatusActive, 2200, "")
	seedRealPersonAssetRow(t, "ast_tie_low", 7, f.profile.Id, model.BytePlusAssetStatusProcessing, 2100, "")
	seedRealPersonAssetRow(t, "ast_tie_high", 7, f.profile.Id, model.BytePlusAssetStatusActive, 2100, "")
	seedRealPersonAssetRow(t, "ast_other_profile", 7, other.Id, model.BytePlusAssetStatusActive, 2300, "")
	seedRealPersonAssetRow(t, "ast_other_user", 8, f.profile.Id, model.BytePlusAssetStatusActive, 2300, "")
	seedRealPersonAssetRow(t, "ast_deleted_cursor", 7, f.profile.Id, model.BytePlusAssetStatusDeleted, 2000, "")

	first, apiErr := ListBytePlusRealPersonAssets(context.Background(), 7, f.profile.PublicId, 2, "")
	require.Nil(t, apiErr)
	require.True(t, first.HasMore)
	require.Equal(t, "ast_tie_high", first.NextAfter)
	require.Equal(t, []string{"ast_newer", "ast_tie_high"}, realPersonAssetListIDs(first.Data))
	second, apiErr := ListBytePlusRealPersonAssets(context.Background(), 7, f.profile.PublicId, 2, first.NextAfter)
	require.Nil(t, apiErr)
	require.False(t, second.HasMore)
	require.Equal(t, []string{"ast_tie_low"}, realPersonAssetListIDs(second.Data))

	for _, cursor := range []string{"ast_other_profile", "ast_other_user", "ast_deleted_cursor"} {
		_, apiErr = ListBytePlusRealPersonAssets(context.Background(), 7, f.profile.PublicId, 2, cursor)
		assertAssetError(t, apiErr, types.ErrorCodeInvalidAssetRequest, http.StatusBadRequest)
	}
}

func TestCreateRealPersonAssetFromMultipartBlankPresignReturnsStorageErrorBeforeUpstream(t *testing.T) {
	f := newRealPersonAssetFixture(t)
	f.store.blankPresign = true

	_, apiErr := f.createMultipart("blank-presign", pngHeader(), "Image", "front")

	assertAssetError(t, apiErr, types.ErrorCodeAssetStorageError, http.StatusInternalServerError)
	require.Len(t, f.store.puts, 1)
	require.Equal(t, 0, f.fake.createAssetCalls)
}

func seedRealPersonAssetRow(t *testing.T, publicID string, userID int, profileID int64, status string, created int64, failureCode string) {
	t.Helper()
	if err := model.DB.Create(&model.BytePlusAsset{
		PublicId: publicID, UserId: userID, RealPersonProfileId: &profileID, ChannelId: 101,
		UpstreamAssetId: "upstream-" + publicID, AssetType: "Image", Name: publicID,
		ModerationStrategy: "Default", Status: status, FailureCode: failureCode,
		CreatedTime: created, UpdatedTime: created,
	}).Error; err != nil {
		t.Fatalf("seed real-person asset: %v", err)
	}
}

func realPersonAssetListIDs(data []dto.BytePlusAssetResponse) []string {
	ids := make([]string, 0, len(data))
	for _, item := range data {
		ids = append(ids, item.ID)
	}
	return ids
}

func newIndependentRealPersonAssetMultipartRequest(t *testing.T, payload []byte, assetType, name string) *http.Request {
	t.Helper()
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	require.NoError(t, writer.WriteField("asset_type", assetType))
	require.NoError(t, writer.WriteField("name", name))
	w, err := writer.CreateFormFile("file", "person.png")
	require.NoError(t, err)
	_, err = w.Write(payload)
	require.NoError(t, err)
	require.NoError(t, writer.Close())
	req := httptest.NewRequest(http.MethodPost, "/v1/real-person/assets", io.NopCloser(&readOnlyReader{r: bytes.NewReader(body.Bytes())}))
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.ContentLength = -1
	return req
}

func TestMultipartMissingNameUsesSanitizedFilenameTruncatedTo128CodePoints(t *testing.T) {
	f := newRealPersonAssetFixture(t)
	long := strings.Repeat("界", 140)
	req := newIndependentRealPersonAssetMultipartRequest(t, pngHeader(), "Image", "__missing__")
	req = newBytePlusMultipartRequest(t, []multipartTestPart{
		fieldPart("asset_type", "Image"),
		filePart("file", "../"+long+".png", pngHeader()),
	})

	resp, apiErr := CreateBytePlusRealPersonAssetFromMultipart(context.Background(), f.profile.UserId, f.profile.PublicId, "missing-name", req)

	require.Nil(t, apiErr)
	require.NotEmpty(t, resp.Name)
	require.Equal(t, 128, utf8.RuneCountInString(resp.Name))
	require.NotContains(t, resp.Name, "/")
	require.NotContains(t, resp.Name, "\\")
}

func TestDefaultRealPersonAssetNameSanitizesSlashStylesAndTruncates(t *testing.T) {
	for _, raw := range []string{"../folder/name.png", `..\folder\name.png`} {
		name := defaultBytePlusRealPersonAssetName(raw)
		require.Equal(t, "name.png", name)
		require.NotContains(t, name, "/")
		require.NotContains(t, name, "\\")
	}

	long := strings.Repeat("x", 140) + ".png"
	name := defaultBytePlusRealPersonAssetName(`..\folder\` + long)
	require.LessOrEqual(t, utf8.RuneCountInString(name), bytePlusRealPersonAssetNameMaxRunes)
	require.NotContains(t, name, "/")
	require.NotContains(t, name, "\\")
}
