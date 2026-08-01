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
	"os"
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
	bucket       string
	provider     string
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
	if strings.TrimSpace(s.bucket) != "" {
		return s.bucket
	}
	return "real-person-bucket"
}

func (s *recordingRealPersonAssetStore) TempObjectStorageProvider() string {
	if strings.TrimSpace(s.provider) != "" {
		return s.provider
	}
	return bytePlusTempObjectProviderTOS
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

func TestCreateRealPersonAssetFromURLAllowsURLOnlyCredentialWithoutTOS(t *testing.T) {
	f := newRealPersonAssetFixture(t)
	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", f.profile.ChannelId).Update("key", urlOnlyRealPersonKey()).Error)

	resp, apiErr := f.createURL("idem-url-only", "https://example.com/person.png", "Image", "front")

	require.Nil(t, apiErr)
	require.Equal(t, model.BytePlusAssetStatusProcessing, resp.Status)
	require.Equal(t, "https://example.com/person.png", f.fake.lastCreate.URL)
	require.Equal(t, 1, f.fake.createAssetCalls)
}

func TestCreateRealPersonAssetFromMultipartURLOnlyCredentialFailsBeforeUploadWhenGCSDisabled(t *testing.T) {
	f := newRealPersonAssetFixture(t)
	t.Setenv("TEMP_MEDIA_BUCKET", " ")
	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", f.profile.ChannelId).Update("key", urlOnlyRealPersonKey()).Error)

	_, apiErr := f.createMultipart("idem-url-only-upload", pngHeader(), "Image", "front")

	assertAssetError(t, apiErr, types.ErrorCodeAssetChannelUnavailable, http.StatusServiceUnavailable)
	require.Len(t, f.store.puts, 0)
	require.Equal(t, 0, f.fake.createAssetCalls)
}

func TestCreateRealPersonAssetFromMultipartFallsBackToGCSWhenTOSIncomplete(t *testing.T) {
	f := newRealPersonAssetFixture(t)
	f.store.bucket = "gcs-real-person-bucket"
	f.store.provider = bytePlusTempObjectProviderGCS
	t.Setenv("TEMP_MEDIA_BUCKET", "gcs-real-person-bucket")
	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", f.profile.ChannelId).Update("key", urlOnlyRealPersonKey()).Error)

	resp, apiErr := f.createMultipart("gcs-fallback-upload", pngHeader(), "Image", "front")

	require.Nil(t, apiErr)
	require.Equal(t, model.BytePlusAssetStatusProcessing, resp.Status)
	require.Equal(t, 1, f.fake.createAssetCalls)
	require.Len(t, f.store.puts, 1)
	var temp model.BytePlusAssetTempObject
	require.NoError(t, model.DB.First(&temp, "object_key = ?", f.store.puts[0].key).Error)
	require.Equal(t, "gcs:gcs-real-person-bucket", temp.Bucket)
	require.Equal(t, []string{temp.ObjectKey}, f.store.presignKeys)
}

func TestCreateRealPersonAssetFromMultipartRejectsMalformedTOSConfigEvenWhenGCSConfigured(t *testing.T) {
	f := newRealPersonAssetFixture(t)
	t.Setenv("TEMP_MEDIA_BUCKET", "gcs-real-person-bucket")
	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", f.profile.ChannelId).Update("key", `{"api_key":"ark-structured","access_key_id":"ak-test","secret_access_key":"sk-test","project_name":"project3","real_person_assets":{"enabled":true,"tos_bucket":"real-person-bucket","tos_region":"us-east-1","tos_internal_endpoint":"https://tos-ap-southeast-1.ibytepluses.com"}}`).Error)
	req := httptest.NewRequest(http.MethodPost, "/v1/real-person/assets", &failingReadCloser{t: t})
	req.Header.Set("Content-Type", "multipart/form-data; boundary=unread")

	_, apiErr := CreateBytePlusRealPersonAssetFromMultipart(context.Background(), f.profile.UserId, f.profile.PublicId, "malformed-tos", req)

	assertAssetError(t, apiErr, types.ErrorCodeAssetChannelUnavailable, http.StatusServiceUnavailable)
	require.Equal(t, 0, f.fake.createAssetCalls)
	require.Empty(t, f.store.puts)
}

func TestCreateRealPersonAssetFromMultipartRejectsPartialTOSConfigBeforeBodyRead(t *testing.T) {
	cases := []struct {
		name string
		key  string
	}{
		{
			name: "bucket only",
			key:  `{"api_key":"ark-structured","access_key_id":"ak-test","secret_access_key":"sk-test","project_name":"project3","real_person_assets":{"enabled":true,"tos_bucket":"real-person-bucket"}}`,
		},
		{
			name: "region only",
			key:  `{"api_key":"ark-structured","access_key_id":"ak-test","secret_access_key":"sk-test","project_name":"project3","real_person_assets":{"enabled":true,"tos_region":"ap-southeast-1"}}`,
		},
		{
			name: "endpoint only",
			key:  `{"api_key":"ark-structured","access_key_id":"ak-test","secret_access_key":"sk-test","project_name":"project3","real_person_assets":{"enabled":true,"tos_internal_endpoint":"https://tos-ap-southeast-1.ibytepluses.com"}}`,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			f := newRealPersonAssetFixture(t)
			t.Setenv("TEMP_MEDIA_BUCKET", "gcs-real-person-bucket")
			require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", f.profile.ChannelId).Update("key", tc.key).Error)
			req := httptest.NewRequest(http.MethodPost, "/v1/real-person/assets", &failingReadCloser{t: t})
			req.Header.Set("Content-Type", "multipart/form-data; boundary=unread")

			_, apiErr := CreateBytePlusRealPersonAssetFromMultipart(context.Background(), f.profile.UserId, f.profile.PublicId, "partial-tos-"+tc.name, req)

			assertAssetError(t, apiErr, types.ErrorCodeAssetChannelUnavailable, http.StatusServiceUnavailable)
			require.Equal(t, 0, f.fake.createAssetCalls)
			require.Empty(t, f.store.puts)
			var records int64
			require.NoError(t, model.DB.Model(&model.APIIdempotencyRecord{}).Count(&records).Error)
			require.Zero(t, records)
		})
	}
}

func TestCreateRealPersonAssetFromMultipartNoBackendFailsBeforeBodyReadOrUpstream(t *testing.T) {
	f := newRealPersonAssetFixture(t)
	t.Setenv("TEMP_MEDIA_BUCKET", " ")
	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", f.profile.ChannelId).Update("key", urlOnlyRealPersonKey()).Error)
	req := httptest.NewRequest(http.MethodPost, "/v1/real-person/assets", &failingReadCloser{t: t})
	req.Header.Set("Content-Type", "multipart/form-data; boundary=unread")

	_, apiErr := CreateBytePlusRealPersonAssetFromMultipart(context.Background(), f.profile.UserId, f.profile.PublicId, "no-storage-backend", req)

	assertAssetError(t, apiErr, types.ErrorCodeAssetChannelUnavailable, http.StatusServiceUnavailable)
	require.Equal(t, 0, f.fake.createAssetCalls)
	require.Empty(t, f.store.puts)
	var records int64
	require.NoError(t, model.DB.Model(&model.APIIdempotencyRecord{}).Count(&records).Error)
	require.Zero(t, records)
}

func TestCreateRealPersonAssetFromMultipartPrefersTOSWhenBothBackendsConfigured(t *testing.T) {
	f := newRealPersonAssetFixture(t)
	t.Setenv("TEMP_MEDIA_BUCKET", "gcs-real-person-bucket")
	oldTOSFactory := bytePlusTOSObjectStoreFactory
	oldPut := putTempMediaObject
	bytePlusTempObjectStoreFactory = newPreferredBytePlusTempObjectStore
	bytePlusTOSObjectStoreFactory = func(BytePlusCredentials) (BytePlusTempObjectStore, error) {
		return f.store, nil
	}
	putTempMediaObject = func(context.Context, TempMediaConfig, string, io.Reader, string) error {
		t.Fatal("gcs put should not run when tos storage is complete")
		return nil
	}
	t.Cleanup(func() {
		bytePlusTOSObjectStoreFactory = oldTOSFactory
		putTempMediaObject = oldPut
	})

	resp, apiErr := f.createMultipart("tos-preferred-upload", pngHeader(), "Image", "front")

	require.Nil(t, apiErr)
	require.Equal(t, model.BytePlusAssetStatusProcessing, resp.Status)
	require.Len(t, f.store.puts, 1)
	var temp model.BytePlusAssetTempObject
	require.NoError(t, model.DB.First(&temp, "object_key = ?", f.store.puts[0].key).Error)
	require.Equal(t, "tos:real-person-bucket", temp.Bucket)
	require.NotEqual(t, "gcs-real-person-bucket", temp.Bucket)
}

func TestBytePlusGCSTempObjectStoreUsesDefaultTempMediaBucketConvention(t *testing.T) {
	oldBucket, hadBucket := os.LookupEnv("TEMP_MEDIA_BUCKET")
	oldOrigin, hadOrigin := os.LookupEnv("APP_CONSOLE_ORIGIN")
	oldFrontend, hadFrontend := os.LookupEnv("FRONTEND_BASE_URL")
	require.NoError(t, os.Unsetenv("TEMP_MEDIA_BUCKET"))
	require.NoError(t, os.Unsetenv("APP_CONSOLE_ORIGIN"))
	require.NoError(t, os.Unsetenv("FRONTEND_BASE_URL"))
	t.Cleanup(func() {
		if hadBucket {
			require.NoError(t, os.Setenv("TEMP_MEDIA_BUCKET", oldBucket))
		} else {
			require.NoError(t, os.Unsetenv("TEMP_MEDIA_BUCKET"))
		}
		if hadOrigin {
			require.NoError(t, os.Setenv("APP_CONSOLE_ORIGIN", oldOrigin))
		} else {
			require.NoError(t, os.Unsetenv("APP_CONSOLE_ORIGIN"))
		}
		if hadFrontend {
			require.NoError(t, os.Setenv("FRONTEND_BASE_URL", oldFrontend))
		} else {
			require.NoError(t, os.Unsetenv("FRONTEND_BASE_URL"))
		}
	})

	require.True(t, bytePlusGCSTempObjectStoreConfigured())
	require.Equal(t, defaultTempMediaBucket, bytePlusGCSTempObjectBucket())
}

func TestBytePlusGCSTempObjectStoreUsesTempMediaHooks(t *testing.T) {
	originalPut := putTempMediaObject
	originalSign := signTempMediaObject
	originalDelete := deleteTempMediaObject
	t.Cleanup(func() {
		putTempMediaObject = originalPut
		signTempMediaObject = originalSign
		deleteTempMediaObject = originalDelete
	})
	t.Setenv("TEMP_MEDIA_BUCKET", "gcs-real-person-bucket")

	var putBody string
	var signedMethod string
	var deletedKey string
	putTempMediaObject = func(_ context.Context, cfg TempMediaConfig, objectKey string, body io.Reader, contentType string) error {
		require.Equal(t, "gcs-real-person-bucket", cfg.Bucket)
		require.Equal(t, "rp/object.png", objectKey)
		require.Equal(t, "image/png", contentType)
		payload, err := io.ReadAll(body)
		require.NoError(t, err)
		putBody = string(payload)
		return nil
	}
	signTempMediaObject = func(_ context.Context, cfg TempMediaConfig, objectKey string, method string) (string, error) {
		require.Equal(t, "gcs-real-person-bucket", cfg.Bucket)
		require.Equal(t, "rp/object.png", objectKey)
		signedMethod = method
		return "https://storage.example/rp/object.png?signature=1", nil
	}
	deleteTempMediaObject = func(_ context.Context, cfg TempMediaConfig, objectKey string) error {
		require.Equal(t, "gcs-real-person-bucket", cfg.Bucket)
		deletedKey = objectKey
		return nil
	}
	store, err := newBytePlusGCSTempObjectStore()
	require.NoError(t, err)

	require.NoError(t, store.PutObject(context.Background(), " rp/object.png ", strings.NewReader("payload"), " image/png ", 7))
	signed, err := store.PresignGet(context.Background(), " rp/object.png ", time.Minute)
	require.NoError(t, err)
	require.NoError(t, store.DeleteObject(context.Background(), " rp/object.png "))

	require.Equal(t, "payload", putBody)
	require.Equal(t, http.MethodGet, signedMethod)
	require.Equal(t, "https://storage.example/rp/object.png?signature=1", signed)
	require.Equal(t, "rp/object.png", deletedKey)
	require.Equal(t, "gcs-real-person-bucket", store.(bytePlusTempObjectBucketProvider).TempObjectBucket())
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

	assertAssetError(t, apiErr, types.ErrorCodeRealPersonNotActive, http.StatusConflict)
	var record model.APIIdempotencyRecord
	require.NoError(t, model.DB.First(&record, "route = ?", bytePlusRealPersonAssetCreateRoute).Error)
	require.Equal(t, model.APIIdempotencyStatusFailed, record.Status)
	require.Equal(t, http.StatusConflict, record.ResponseStatus)
	_, apiErr = f.createURL("inactive-owner", "https://example.com/person.png", "Image", "front")
	assertAssetError(t, apiErr, types.ErrorCodeRealPersonNotActive, http.StatusConflict)
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

func TestStaleMultipartResumeRejectsUnknownPersistedTempObjectBucket(t *testing.T) {
	f := newRealPersonAssetFixture(t)
	sum := sha256.Sum256(pngHeader())
	asset := model.BytePlusAsset{
		PublicId: "ast_unknown_bucket", UserId: f.profile.UserId, ChannelId: f.profile.ChannelId, RealPersonProfileId: &f.profile.Id,
		AssetType: "Image", Name: "front", ModerationStrategy: "Default", Status: model.BytePlusAssetStatusCreating,
		CreatedTime: 1000, UpdatedTime: 1000,
	}
	require.NoError(t, model.DB.Create(&asset).Error)
	originalTemp := model.BytePlusAssetTempObject{
		AssetId: &asset.Id, UserId: f.profile.UserId, ChannelId: f.profile.ChannelId, Bucket: "unknown-temp-bucket", ObjectKey: "unknown-original-key",
		ContentSHA256: fmt.Sprintf("%x", sum), SizeBytes: int64(len(pngHeader())), MimeType: "image/png",
		CleanupStatus: model.BytePlusTempObjectCleanupPending, SignedURLExpiresAt: 2200, CreatedTime: 1000, UpdatedTime: 1000,
	}
	require.NoError(t, model.DB.Create(&originalTemp).Error)
	requestHash, err := hashMultipartAssetRequest(f.profile.PublicId, "Image", "front", originalTemp.ContentSHA256, originalTemp.SizeBytes)
	require.NoError(t, err)
	keyHash, err := hashAPIIdempotencyKey("resume-unknown-bucket")
	require.NoError(t, err)
	require.NoError(t, model.DB.Create(&model.APIIdempotencyRecord{
		UserId: f.profile.UserId, Route: bytePlusRealPersonAssetCreateRoute, KeyHash: keyHash, RequestHash: requestHash,
		Status: model.APIIdempotencyStatusProcessing, ResourceType: model.APIIdempotencyResourceAsset, ResourcePublicId: asset.PublicId,
		LeaseUpdatedTime: 1000, CreatedTime: 1000, UpdatedTime: 1000,
	}).Error)

	_, apiErr := f.createMultipart("resume-unknown-bucket", pngHeader(), "Image", "front")

	assertAssetError(t, apiErr, types.ErrorCodeAssetStorageError, http.StatusInternalServerError)
	require.Equal(t, 0, f.fake.createAssetCalls)
	require.NotContains(t, f.store.presignKeys, "unknown-original-key")
	require.Len(t, f.store.puts, 1)
	require.Len(t, f.store.deletes, 1)
}

func TestStaleMultipartResumeUsesPersistedGCSBucket(t *testing.T) {
	f := newRealPersonAssetFixture(t)
	t.Setenv("TEMP_MEDIA_BUCKET", "gcs-real-person-bucket")
	bytePlusTempObjectStoreFactory = newPreferredBytePlusTempObjectStore
	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", f.profile.ChannelId).Update("key", urlOnlyRealPersonKey()).Error)
	originalPut := putTempMediaObject
	originalSign := signTempMediaObject
	originalDelete := deleteTempMediaObject
	t.Cleanup(func() {
		putTempMediaObject = originalPut
		signTempMediaObject = originalSign
		deleteTempMediaObject = originalDelete
	})
	var putKeys, signedKeys, deletedKeys []string
	putTempMediaObject = func(_ context.Context, cfg TempMediaConfig, objectKey string, body io.Reader, _ string) error {
		require.Equal(t, "gcs-real-person-bucket", cfg.Bucket)
		_, err := io.ReadAll(body)
		require.NoError(t, err)
		putKeys = append(putKeys, objectKey)
		return nil
	}
	signTempMediaObject = func(_ context.Context, cfg TempMediaConfig, objectKey string, method string) (string, error) {
		require.Equal(t, "gcs-real-person-bucket", cfg.Bucket)
		require.Equal(t, http.MethodGet, method)
		signedKeys = append(signedKeys, objectKey)
		return "https://storage.example/" + objectKey, nil
	}
	deleteTempMediaObject = func(_ context.Context, cfg TempMediaConfig, objectKey string) error {
		require.Equal(t, "gcs-real-person-bucket", cfg.Bucket)
		deletedKeys = append(deletedKeys, objectKey)
		return nil
	}
	sum := sha256.Sum256(pngHeader())
	asset := model.BytePlusAsset{
		PublicId: "ast_gcs_resume", UserId: f.profile.UserId, ChannelId: f.profile.ChannelId, RealPersonProfileId: &f.profile.Id,
		AssetType: "Image", Name: "front", ModerationStrategy: "Default", Status: model.BytePlusAssetStatusCreating,
		CreatedTime: 1000, UpdatedTime: 1000,
	}
	require.NoError(t, model.DB.Create(&asset).Error)
	originalTemp := model.BytePlusAssetTempObject{
		AssetId: &asset.Id, UserId: f.profile.UserId, ChannelId: f.profile.ChannelId, Bucket: "gcs:gcs-real-person-bucket", ObjectKey: "gcs-original-key",
		ContentSHA256: fmt.Sprintf("%x", sum), SizeBytes: int64(len(pngHeader())), MimeType: "image/png",
		CleanupStatus: model.BytePlusTempObjectCleanupPending, SignedURLExpiresAt: 2200, CreatedTime: 1000, UpdatedTime: 1000,
	}
	require.NoError(t, model.DB.Create(&originalTemp).Error)
	requestHash, err := hashMultipartAssetRequest(f.profile.PublicId, "Image", "front", originalTemp.ContentSHA256, originalTemp.SizeBytes)
	require.NoError(t, err)
	keyHash, err := hashAPIIdempotencyKey("resume-gcs-bucket")
	require.NoError(t, err)
	require.NoError(t, model.DB.Create(&model.APIIdempotencyRecord{
		UserId: f.profile.UserId, Route: bytePlusRealPersonAssetCreateRoute, KeyHash: keyHash, RequestHash: requestHash,
		Status: model.APIIdempotencyStatusProcessing, ResourceType: model.APIIdempotencyResourceAsset, ResourcePublicId: asset.PublicId,
		LeaseUpdatedTime: 1000, CreatedTime: 1000, UpdatedTime: 1000,
	}).Error)

	_, apiErr := f.createMultipart("resume-gcs-bucket", pngHeader(), "Image", "front")

	require.Nil(t, apiErr)
	require.Equal(t, 1, f.fake.createAssetCalls)
	require.Len(t, putKeys, 1)
	require.Equal(t, []string{"gcs-original-key"}, signedKeys)
	require.Equal(t, putKeys, deletedKeys)
}

func TestStaleMultipartResumeKeepsPersistedGCSProviderWhenTOSBucketNameMatches(t *testing.T) {
	f := newRealPersonAssetFixture(t)
	f.store.bucket = "shared-bucket"
	f.store.provider = bytePlusTempObjectProviderTOS
	t.Setenv("TEMP_MEDIA_BUCKET", "shared-bucket")
	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", f.profile.ChannelId).Update("key", `{"api_key":"ark-structured","access_key_id":"ak-test","secret_access_key":"sk-test","project_name":"project3","real_person_assets":{"enabled":true,"tos_bucket":"shared-bucket","tos_region":"ap-southeast-1","tos_internal_endpoint":"https://tos-ap-southeast-1.ibytepluses.com"}}`).Error)
	originalSign := signTempMediaObject
	t.Cleanup(func() { signTempMediaObject = originalSign })
	var gcsSignedKeys []string
	signTempMediaObject = func(_ context.Context, cfg TempMediaConfig, objectKey string, method string) (string, error) {
		require.Equal(t, "shared-bucket", cfg.Bucket)
		require.Equal(t, http.MethodGet, method)
		gcsSignedKeys = append(gcsSignedKeys, objectKey)
		return "https://storage.example/" + objectKey, nil
	}
	sum := sha256.Sum256(pngHeader())
	asset := model.BytePlusAsset{
		PublicId: "ast_gcs_tos_name_collision", UserId: f.profile.UserId, ChannelId: f.profile.ChannelId, RealPersonProfileId: &f.profile.Id,
		AssetType: "Image", Name: "front", ModerationStrategy: "Default", Status: model.BytePlusAssetStatusCreating,
		CreatedTime: 1000, UpdatedTime: 1000,
	}
	require.NoError(t, model.DB.Create(&asset).Error)
	originalTemp := model.BytePlusAssetTempObject{
		AssetId: &asset.Id, UserId: f.profile.UserId, ChannelId: f.profile.ChannelId, Bucket: "gcs:shared-bucket", ObjectKey: "gcs-shared-original",
		ContentSHA256: fmt.Sprintf("%x", sum), SizeBytes: int64(len(pngHeader())), MimeType: "image/png",
		CleanupStatus: model.BytePlusTempObjectCleanupPending, SignedURLExpiresAt: 2200, CreatedTime: 1000, UpdatedTime: 1000,
	}
	require.NoError(t, model.DB.Create(&originalTemp).Error)
	requestHash, err := hashMultipartAssetRequest(f.profile.PublicId, "Image", "front", originalTemp.ContentSHA256, originalTemp.SizeBytes)
	require.NoError(t, err)
	keyHash, err := hashAPIIdempotencyKey("resume-gcs-provider-name-collision")
	require.NoError(t, err)
	require.NoError(t, model.DB.Create(&model.APIIdempotencyRecord{
		UserId: f.profile.UserId, Route: bytePlusRealPersonAssetCreateRoute, KeyHash: keyHash, RequestHash: requestHash,
		Status: model.APIIdempotencyStatusProcessing, ResourceType: model.APIIdempotencyResourceAsset, ResourcePublicId: asset.PublicId,
		LeaseUpdatedTime: 1000, CreatedTime: 1000, UpdatedTime: 1000,
	}).Error)

	_, apiErr := f.createMultipart("resume-gcs-provider-name-collision", pngHeader(), "Image", "front")

	require.Nil(t, apiErr)
	require.Equal(t, []string{"gcs-shared-original"}, gcsSignedKeys)
	require.NotContains(t, f.store.presignKeys, "gcs-shared-original")
	require.Equal(t, 1, f.fake.createAssetCalls)
}

func TestStaleMultipartResumeRejectsInvalidTOSBucketEvenWhenCurrentGCSBucketNameMatches(t *testing.T) {
	f := newRealPersonAssetFixture(t)
	t.Setenv("TEMP_MEDIA_BUCKET", "shared-bucket")
	bytePlusTempObjectStoreFactory = newPreferredBytePlusTempObjectStore
	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", f.profile.ChannelId).Update("key", `{"api_key":"ark-structured","access_key_id":"ak-test","secret_access_key":"sk-test","project_name":"project3","real_person_assets":{"enabled":true,"tos_bucket":"shared-bucket","tos_region":"us-east-1","tos_internal_endpoint":"https://tos-ap-southeast-1.ibytepluses.com"}}`).Error)
	originalPut := putTempMediaObject
	originalSign := signTempMediaObject
	originalDelete := deleteTempMediaObject
	t.Cleanup(func() {
		putTempMediaObject = originalPut
		signTempMediaObject = originalSign
		deleteTempMediaObject = originalDelete
	})
	var signedKeys []string
	putTempMediaObject = func(_ context.Context, _ TempMediaConfig, _ string, body io.Reader, _ string) error {
		_, err := io.ReadAll(body)
		return err
	}
	signTempMediaObject = func(_ context.Context, _ TempMediaConfig, objectKey string, _ string) (string, error) {
		signedKeys = append(signedKeys, objectKey)
		return "https://storage.example/" + objectKey, nil
	}
	deleteTempMediaObject = func(context.Context, TempMediaConfig, string) error { return nil }
	sum := sha256.Sum256(pngHeader())
	asset := model.BytePlusAsset{
		PublicId: "ast_tos_name_collision", UserId: f.profile.UserId, ChannelId: f.profile.ChannelId, RealPersonProfileId: &f.profile.Id,
		AssetType: "Image", Name: "front", ModerationStrategy: "Default", Status: model.BytePlusAssetStatusCreating,
		CreatedTime: 1000, UpdatedTime: 1000,
	}
	require.NoError(t, model.DB.Create(&asset).Error)
	originalTemp := model.BytePlusAssetTempObject{
		AssetId: &asset.Id, UserId: f.profile.UserId, ChannelId: f.profile.ChannelId, Bucket: "shared-bucket", ObjectKey: "old-tos-object",
		ContentSHA256: fmt.Sprintf("%x", sum), SizeBytes: int64(len(pngHeader())), MimeType: "image/png",
		CleanupStatus: model.BytePlusTempObjectCleanupPending, SignedURLExpiresAt: 2200, CreatedTime: 1000, UpdatedTime: 1000,
	}
	require.NoError(t, model.DB.Create(&originalTemp).Error)
	requestHash, err := hashMultipartAssetRequest(f.profile.PublicId, "Image", "front", originalTemp.ContentSHA256, originalTemp.SizeBytes)
	require.NoError(t, err)
	keyHash, err := hashAPIIdempotencyKey("resume-tos-gcs-name-collision")
	require.NoError(t, err)
	require.NoError(t, model.DB.Create(&model.APIIdempotencyRecord{
		UserId: f.profile.UserId, Route: bytePlusRealPersonAssetCreateRoute, KeyHash: keyHash, RequestHash: requestHash,
		Status: model.APIIdempotencyStatusProcessing, ResourceType: model.APIIdempotencyResourceAsset, ResourcePublicId: asset.PublicId,
		LeaseUpdatedTime: 1000, CreatedTime: 1000, UpdatedTime: 1000,
	}).Error)

	_, apiErr := f.createMultipart("resume-tos-gcs-name-collision", pngHeader(), "Image", "front")

	assertAssetError(t, apiErr, types.ErrorCodeAssetChannelUnavailable, http.StatusServiceUnavailable)
	require.NotContains(t, signedKeys, "old-tos-object")
	require.Equal(t, 0, f.fake.createAssetCalls)
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

type failingReadCloser struct {
	t *testing.T
}

func (r *failingReadCloser) Read([]byte) (int, error) {
	r.t.Fatal("request body should not be read before storage backend is selected")
	return 0, io.ErrUnexpectedEOF
}

func (r *failingReadCloser) Close() error {
	return nil
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
