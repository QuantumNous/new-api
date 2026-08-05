package service

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestCreateAssetFromURLStoresOpaqueAvailableSourceWithSHAAndRevalidatesRedirects(t *testing.T) {
	newAssetServiceTestDB(t)
	store := installAssetServiceTestDeps(t)
	png := tinyPNG()
	redirects := 0
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/start.png" {
			redirects++
			http.Redirect(w, r, "/final.png", http.StatusFound)
			return
		}
		w.Header().Set("Content-Type", "image/png")
		_, _ = w.Write(png)
	}))
	t.Cleanup(server.Close)
	assetHTTPClient = server.Client()

	result, err := CreateAssetFromURL(context.Background(), AssetFromURLRequest{
		UserID:    42,
		AssetType: "Image",
		URL:       server.URL + "/start.png",
	})

	require.NoError(t, err)
	require.Equal(t, "ast_fixed", result.PublicID)
	require.Equal(t, model.AssetStatusActive, result.Status)
	require.Equal(t, 1, redirects)
	require.Len(t, store.puts, 1)
	require.Regexp(t, `^assets/42/20260725/ast_fixed/rand_fixed\.png$`, store.puts[0].key)
	require.NotContains(t, store.puts[0].key, "start")
	require.NotContains(t, store.puts[0].key, "final")
	require.Equal(t, "image/png", store.puts[0].contentType)

	var asset model.Asset
	require.NoError(t, model.DB.First(&asset, "public_id = ?", "ast_fixed").Error)
	require.Equal(t, model.AssetSourceStatusAvailable, asset.SourceStatus)
	require.Equal(t, defaultAssetStorageBackend, asset.StorageBackend)
	require.Equal(t, "asset-test-bucket", asset.StorageBucket)
	require.Equal(t, int64(len(png)), asset.SizeBytes)
	require.Equal(t, shaHex(png), asset.SHA256)
	require.EqualValues(t, 1, asset.ObjectGeneration)
	require.Equal(t, assetNow().Add(30*24*time.Hour).Unix(), asset.SourceExpiresAt)
	require.Empty(t, result.SignedURL, "source ingestion must not return or persist signed GET URLs")
}

func TestCreateAssetFromURLRejectsPrivateAddressAndCredentialRedirect(t *testing.T) {
	newAssetServiceTestDB(t)
	installAssetServiceTestDeps(t)
	_, err := CreateAssetFromURL(context.Background(), AssetFromURLRequest{UserID: 1, AssetType: "Image", URL: "https://user:pass@example.com/a.png"})
	require.ErrorIs(t, err, ErrAssetInvalidSourceURL)

	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "https://user:pass@example.com/a.png", http.StatusFound)
	}))
	t.Cleanup(server.Close)
	assetHTTPClient = server.Client()
	_, err = CreateAssetFromURL(context.Background(), AssetFromURLRequest{UserID: 1, AssetType: "Image", URL: server.URL})
	require.ErrorIs(t, err, ErrAssetInvalidSourceURL)
}

func TestAssetFetchRejectsDialTimeDNSRebindAndDoesNotDialPrivateIP(t *testing.T) {
	newAssetServiceTestDB(t)
	installAssetServiceTestDeps(t)
	dialed := false
	client := newAssetFetchHTTPClient(assetFetchHTTPClientConfig{
		Timeout: 2 * time.Second,
		Resolver: assetFetchResolverFunc(func(ctx context.Context, host string) ([]net.IP, error) {
			require.Equal(t, "asset.example", host)
			return []net.IP{net.ParseIP("127.0.0.1")}, nil
		}),
		DialContext: func(ctx context.Context, network, address string) (net.Conn, error) {
			dialed = true
			return nil, errors.New("dial should not be reached")
		},
	})
	oldHTTP := assetHTTPClient
	assetHTTPClient = client
	t.Cleanup(func() { assetHTTPClient = oldHTTP })

	_, err := fetchAssetSource(context.Background(), "https://asset.example/image.png")

	require.ErrorIs(t, err, ErrAssetInvalidSourceURL)
	require.False(t, dialed)
}

func TestAssetFetchIgnoresProxyEnvironment(t *testing.T) {
	newAssetServiceTestDB(t)
	installAssetServiceTestDeps(t)
	t.Setenv("HTTPS_PROXY", "http://127.0.0.1:9")
	client := newAssetFetchHTTPClient(assetFetchHTTPClientConfig{
		Timeout: 2 * time.Second,
		Resolver: assetFetchResolverFunc(func(ctx context.Context, host string) ([]net.IP, error) {
			return []net.IP{net.ParseIP("93.184.216.34")}, nil
		}),
		DialContext: func(ctx context.Context, network, address string) (net.Conn, error) {
			return nil, errors.New("stop after hardened direct dial")
		},
	})
	transport, ok := client.Transport.(*http.Transport)
	require.True(t, ok)

	req, err := http.NewRequest(http.MethodGet, "https://asset.example/image.png", nil)
	require.NoError(t, err)
	proxyURL, err := transport.Proxy(req)

	require.NoError(t, err)
	require.Nil(t, proxyURL)
}

func TestUploadAssetEnforcesMultipartCapTypeLimitsAndMediaMIME(t *testing.T) {
	newAssetServiceTestDB(t)
	store := installAssetServiceTestDeps(t)
	t.Setenv("ASSET_MULTIPART_MAX_BYTES", "8")
	t.Setenv("ASSET_IMAGE_MAX_BYTES", "7")
	_, err := UploadAsset(context.Background(), AssetUploadRequest{UserID: 1, AssetType: "Image", Filename: "ignored.png", Body: bytes.NewReader(append(tinyPNG(), 'x'))})
	require.ErrorIs(t, err, ErrAssetTooLarge)

	t.Setenv("ASSET_MULTIPART_MAX_BYTES", "99")
	t.Setenv("ASSET_IMAGE_MAX_BYTES", "99")
	_, err = UploadAsset(context.Background(), AssetUploadRequest{UserID: 1, AssetType: "Image", Filename: "ignored.txt", Body: strings.NewReader("not an image")})
	require.ErrorIs(t, err, ErrAssetUnsupportedMediaType)

	result, err := UploadAsset(context.Background(), AssetUploadRequest{UserID: 1, AssetType: "Audio", Filename: "voice.any", Body: bytes.NewReader(tinyMP3())})
	require.NoError(t, err)
	require.Equal(t, "ast_fixed", result.PublicID)
	require.Equal(t, "audio/mpeg", store.puts[len(store.puts)-1].contentType)
	require.True(t, strings.HasSuffix(store.puts[len(store.puts)-1].key, ".mp3"))
}

func TestCreateAssetUploadSessionSignsBoundedPutAndCompleteValidatesOwnershipAttrsAndHash(t *testing.T) {
	newAssetServiceTestDB(t)
	store := installAssetServiceTestDeps(t)
	t.Setenv("ASSET_SIGNED_URL_TTL_SECONDS", "3600")
	t.Setenv("ASSET_SERVICE_ACCOUNT_EMAIL", "asset-signer@example.iam.gserviceaccount.com")
	png := tinyPNG()

	session, err := CreateAssetUploadSession(context.Background(), AssetUploadSessionRequest{
		UserID:      7,
		Owner:       "user-7",
		AssetType:   "Image",
		ContentType: "image/png",
		SizeBytes:   int64(len(png)),
	})
	require.NoError(t, err)
	require.Equal(t, "upload_fixed", session.UploadID)
	require.Equal(t, "ast_fixed", session.PublicID)
	require.Equal(t, "https://signed.example/"+session.ObjectKey, session.SignedURL)
	require.Equal(t, assetNow().Add(time.Hour).Unix(), session.ExpiresAt)
	require.Len(t, store.signed, 1)
	require.Equal(t, http.MethodPut, store.signed[0].Method)
	require.Equal(t, time.Hour, store.signed[0].TTL)
	require.Equal(t, "image/png", store.signed[0].ContentType)
	require.Equal(t, "asset-signer@example.iam.gserviceaccount.com", store.signed[0].ServiceAccountEmail)
	require.Equal(t, []string{"x-goog-if-generation-match:0"}, store.signed[0].Headers)
	require.Equal(t, map[string]string{"x-goog-if-generation-match": "0"}, session.UploadHeaders)

	store.objects["asset-test-bucket/"+session.ObjectKey] = png
	store.attrs["asset-test-bucket/"+session.ObjectKey] = AssetObjectAttrs{ContentType: "image/png", Size: int64(len(png)), Generation: 9}
	_, err = CompleteAssetUpload(context.Background(), AssetCompleteUploadRequest{UploadID: session.UploadID, Owner: "user-8"})
	require.ErrorIs(t, err, ErrAssetUploadNotFound)

	result, err := CompleteAssetUpload(context.Background(), AssetCompleteUploadRequest{UploadID: session.UploadID, Owner: "user-7"})
	require.NoError(t, err)
	require.Equal(t, model.AssetStatusActive, result.Status)
	require.Equal(t, []fakeAssetOpen{{key: "asset-test-bucket/" + session.ObjectKey, generation: 9}}, store.opens)
	var asset model.Asset
	require.NoError(t, model.DB.First(&asset, "public_id = ?", session.PublicID).Error)
	require.Equal(t, shaHex(png), asset.SHA256)
	require.EqualValues(t, 9, asset.ObjectGeneration)
	require.Equal(t, model.AssetSourceStatusAvailable, asset.SourceStatus)
	var upload model.AssetUpload
	require.NoError(t, model.DB.First(&upload, "upload_id = ?", session.UploadID).Error)
	require.Equal(t, model.AssetUploadStatusComplete, upload.Status)
	require.EqualValues(t, 9, upload.ObjectGeneration)
}

func TestCreateAssetUploadSessionUsesTypeLimitInsteadOfMultipartCap(t *testing.T) {
	newAssetServiceTestDB(t)
	installAssetServiceTestDeps(t)
	t.Setenv("ASSET_MULTIPART_MAX_BYTES", "8")
	t.Setenv("ASSET_VIDEO_MAX_BYTES", "10")

	session, err := CreateAssetUploadSession(context.Background(), AssetUploadSessionRequest{
		UserID:      7,
		Owner:       "user-7",
		AssetType:   "Video",
		ContentType: "video/mp4",
		SizeBytes:   9,
	})
	require.NoError(t, err)
	require.NotNil(t, session)

	_, err = CreateAssetUploadSession(context.Background(), AssetUploadSessionRequest{
		UserID:      7,
		Owner:       "user-7",
		AssetType:   "Video",
		ContentType: "video/mp4",
		SizeBytes:   11,
	})
	require.ErrorIs(t, err, ErrAssetTooLarge)
}

func TestCreateAssetUploadSessionRejectsDeclaredTypeContentTypeMismatch(t *testing.T) {
	newAssetServiceTestDB(t)
	installAssetServiceTestDeps(t)

	_, err := CreateAssetUploadSession(context.Background(), AssetUploadSessionRequest{
		UserID:      7,
		Owner:       "user-7",
		AssetType:   "Image",
		ContentType: "video/mp4",
		SizeBytes:   9,
	})

	require.ErrorIs(t, err, ErrAssetTypeMismatch)
}

func TestCreateAssetFromURLRejectsDetectedCategoryMismatch(t *testing.T) {
	newAssetServiceTestDB(t)
	installAssetServiceTestDeps(t)
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "audio/mpeg")
		_, _ = w.Write(tinyMP3())
	}))
	t.Cleanup(server.Close)
	assetHTTPClient = server.Client()

	_, err := CreateAssetFromURL(context.Background(), AssetFromURLRequest{
		UserID:    7,
		AssetType: "Image",
		URL:       server.URL + "/voice.mp3",
	})

	require.ErrorIs(t, err, ErrAssetTypeMismatch)
}

func TestUploadAssetRejectsDetectedCategoryMismatch(t *testing.T) {
	newAssetServiceTestDB(t)
	installAssetServiceTestDeps(t)
	t.Setenv("ASSET_IMAGE_MAX_BYTES", "99")

	_, err := UploadAsset(context.Background(), AssetUploadRequest{
		UserID:    7,
		AssetType: "Image",
		Filename:  "voice.mp3",
		Body:      bytes.NewReader(tinyMP3()),
	})

	require.ErrorIs(t, err, ErrAssetTypeMismatch)
}

func TestCompleteAssetUploadFailsWhenExactGenerationDisappearsBeforeRead(t *testing.T) {
	newAssetServiceTestDB(t)
	store := installAssetServiceTestDeps(t)
	png := tinyPNG()
	session, err := CreateAssetUploadSession(context.Background(), AssetUploadSessionRequest{
		UserID:      7,
		Owner:       "user-7",
		AssetType:   "Image",
		ContentType: "image/png",
		SizeBytes:   int64(len(png)),
	})
	require.NoError(t, err)
	store.objects["asset-test-bucket/"+session.ObjectKey] = png
	store.attrs["asset-test-bucket/"+session.ObjectKey] = AssetObjectAttrs{ContentType: "image/png", Size: int64(len(png)), Generation: 9}
	store.openErr = errAssetObjectNotFound

	_, err = CompleteAssetUpload(context.Background(), AssetCompleteUploadRequest{UploadID: session.UploadID, Owner: "user-7"})

	require.ErrorIs(t, err, ErrAssetUploadValidation)
	require.Equal(t, []fakeAssetOpen{{key: "asset-test-bucket/" + session.ObjectKey, generation: 9}}, store.opens)
	require.Equal(t, []fakeAssetDelete{{key: "asset-test-bucket/" + session.ObjectKey, expectedGeneration: 9}}, store.deletes)
	var upload model.AssetUpload
	require.NoError(t, model.DB.First(&upload, "upload_id = ?", session.UploadID).Error)
	require.Equal(t, model.AssetUploadStatusFailed, upload.Status)
	var asset model.Asset
	require.NoError(t, model.DB.First(&asset, "public_id = ?", session.PublicID).Error)
	require.Equal(t, model.AssetStatusFailed, asset.Status)
}

func TestCompleteAssetUploadCannotActivateAfterCleanupClaimedAndDeletedObject(t *testing.T) {
	newAssetServiceTestDB(t)
	baseStore := installAssetServiceTestDeps(t)
	store := &raceAssetObjectStore{fakeAssetObjectStore: baseStore}
	assetObjectStore = store
	png := tinyPNG()
	session, err := CreateAssetUploadSession(context.Background(), AssetUploadSessionRequest{
		UserID:      7,
		Owner:       "user-7",
		AssetType:   "Image",
		ContentType: "image/png",
		SizeBytes:   int64(len(png)),
	})
	require.NoError(t, err)
	store.objects["asset-test-bucket/"+session.ObjectKey] = png
	store.attrs["asset-test-bucket/"+session.ObjectKey] = AssetObjectAttrs{ContentType: "image/png", Size: int64(len(png)), Generation: 23}

	start := assetNow()
	afterExpiry := time.Unix(session.ExpiresAt+1, 0).UTC()
	current := start
	assetNow = func() time.Time { return current }
	store.afterRead = func() {
		current = afterExpiry
		claimed, err := model.ClaimExpiredPendingAssetUploads("cleanup-a", current.Unix(), current.Add(assetCleanupLeaseTTL).Unix(), 10)
		require.NoError(t, err)
		require.Len(t, claimed, 1)
		require.Equal(t, model.AssetUploadStatusCleaning, claimed[0].Upload.Status)
		err = store.fakeAssetObjectStore.Delete(context.Background(), claimed[0].Upload.StorageBucket, claimed[0].Upload.ObjectKey, 23)
		require.NoError(t, err)
	}

	_, err = CompleteAssetUpload(context.Background(), AssetCompleteUploadRequest{UploadID: session.UploadID, Owner: "user-7"})

	require.ErrorIs(t, err, ErrAssetUploadNotFound)
	require.Equal(t, []fakeAssetOpen{{key: "asset-test-bucket/" + session.ObjectKey, generation: 23}}, store.opens)
	require.Equal(t, []fakeAssetDelete{{key: "asset-test-bucket/" + session.ObjectKey, expectedGeneration: 23}}, store.deletes)
	var upload model.AssetUpload
	require.NoError(t, model.DB.First(&upload, "upload_id = ?", session.UploadID).Error)
	require.Equal(t, model.AssetUploadStatusCleaning, upload.Status)
	require.Equal(t, "cleanup-a", upload.CleanupLeaseOwner)
	require.NotEqual(t, model.AssetUploadStatusComplete, upload.Status)
	var asset model.Asset
	require.NoError(t, model.DB.First(&asset, "public_id = ?", session.PublicID).Error)
	require.Equal(t, model.AssetStatusCreating, asset.Status)
	require.Equal(t, model.AssetSourceStatusUnavailable, asset.SourceStatus)

	ok, err := model.MarkExpiredPendingAssetUploadIfCleanupLease(session.UploadID, "cleanup-a", upload.CleanupGeneration, 23, current.Unix())
	require.NoError(t, err)
	require.True(t, ok)
	require.NoError(t, model.DB.First(&upload, "upload_id = ?", session.UploadID).Error)
	require.Equal(t, model.AssetUploadStatusExpired, upload.Status)
	require.NoError(t, model.DB.First(&asset, "public_id = ?", session.PublicID).Error)
	require.Equal(t, model.AssetStatusExpired, asset.Status)
	require.Equal(t, model.AssetSourceStatusExpired, asset.SourceStatus)
	require.Empty(t, asset.ObjectKey)
}

func TestCompleteAssetUploadLateExpiryDeletesExactGenerationAndExpiresAsset(t *testing.T) {
	newAssetServiceTestDB(t)
	baseStore := installAssetServiceTestDeps(t)
	store := &raceAssetObjectStore{fakeAssetObjectStore: baseStore}
	assetObjectStore = store
	png := tinyPNG()
	session, err := CreateAssetUploadSession(context.Background(), AssetUploadSessionRequest{
		UserID:      7,
		Owner:       "user-7",
		AssetType:   "Image",
		ContentType: "image/png",
		SizeBytes:   int64(len(png)),
	})
	require.NoError(t, err)
	store.objects["asset-test-bucket/"+session.ObjectKey] = png
	store.attrs["asset-test-bucket/"+session.ObjectKey] = AssetObjectAttrs{ContentType: "image/png", Size: int64(len(png)), Generation: 29}

	current := assetNow()
	afterExpiry := time.Unix(session.ExpiresAt+1, 0).UTC()
	assetNow = func() time.Time { return current }
	store.afterRead = func() {
		current = afterExpiry
	}

	_, err = CompleteAssetUpload(context.Background(), AssetCompleteUploadRequest{UploadID: session.UploadID, Owner: "user-7"})

	require.ErrorIs(t, err, ErrAssetExpired)
	require.Equal(t, []fakeAssetOpen{{key: "asset-test-bucket/" + session.ObjectKey, generation: 29}}, store.opens)
	require.Equal(t, []fakeAssetDelete{{key: "asset-test-bucket/" + session.ObjectKey, expectedGeneration: 29}}, store.deletes)
	var upload model.AssetUpload
	require.NoError(t, model.DB.First(&upload, "upload_id = ?", session.UploadID).Error)
	require.Equal(t, model.AssetUploadStatusExpired, upload.Status)
	require.Zero(t, upload.ObjectGeneration)
	require.Empty(t, upload.StorageBucket)
	require.Empty(t, upload.ObjectKey)
	var asset model.Asset
	require.NoError(t, model.DB.First(&asset, "public_id = ?", session.PublicID).Error)
	require.Equal(t, model.AssetStatusExpired, asset.Status)
	require.Equal(t, model.AssetSourceStatusExpired, asset.SourceStatus)
	require.Empty(t, asset.StorageBucket)
	require.Empty(t, asset.ObjectKey)
	require.Zero(t, asset.ObjectGeneration)

	result, err := CleanupExpiredAssetSources(context.Background(), CleanupExpiredAssetSourcesRequest{Owner: "node-a", Limit: 10})
	require.NoError(t, err)
	require.Zero(t, result.Claimed)
}

func TestCompleteAssetUploadLateExpiryLosesTerminalCASAfterCleanupClaim(t *testing.T) {
	newAssetServiceTestDB(t)
	baseStore := installAssetServiceTestDeps(t)
	store := &raceAssetObjectStore{fakeAssetObjectStore: baseStore}
	assetObjectStore = store
	png := tinyPNG()
	session, err := CreateAssetUploadSession(context.Background(), AssetUploadSessionRequest{
		UserID:      7,
		Owner:       "user-7",
		AssetType:   "Image",
		ContentType: "image/png",
		SizeBytes:   int64(len(png)),
	})
	require.NoError(t, err)
	store.objects["asset-test-bucket/"+session.ObjectKey] = png
	store.attrs["asset-test-bucket/"+session.ObjectKey] = AssetObjectAttrs{ContentType: "image/png", Size: int64(len(png)), Generation: 31}

	current := assetNow()
	afterExpiry := time.Unix(session.ExpiresAt+1, 0).UTC()
	assetNow = func() time.Time { return current }
	store.afterRead = func() {
		current = afterExpiry
	}
	cleanupClaimed := false
	store.beforeDelete = func(bucket, objectKey string, expectedGeneration int64) {
		if cleanupClaimed {
			return
		}
		cleanupClaimed = true
		claimed, err := model.ClaimExpiredPendingAssetUploads("cleanup-a", current.Unix(), current.Add(assetCleanupLeaseTTL).Unix(), 10)
		require.NoError(t, err)
		require.Len(t, claimed, 1)
		require.Equal(t, model.AssetUploadStatusCleaning, claimed[0].Upload.Status)
		require.Equal(t, "cleanup-a", claimed[0].Upload.CleanupLeaseOwner)
		require.EqualValues(t, 31, expectedGeneration)
	}

	_, err = CompleteAssetUpload(context.Background(), AssetCompleteUploadRequest{UploadID: session.UploadID, Owner: "user-7"})

	require.ErrorIs(t, err, ErrAssetExpired)
	require.True(t, cleanupClaimed)
	var upload model.AssetUpload
	require.NoError(t, model.DB.First(&upload, "upload_id = ?", session.UploadID).Error)
	require.Equal(t, model.AssetUploadStatusCleaning, upload.Status)
	require.Equal(t, "cleanup-a", upload.CleanupLeaseOwner)
	var asset model.Asset
	require.NoError(t, model.DB.First(&asset, "public_id = ?", session.PublicID).Error)
	require.Equal(t, model.AssetStatusCreating, asset.Status)
	require.Equal(t, model.AssetSourceStatusUnavailable, asset.SourceStatus)

	ok, err := model.MarkExpiredPendingAssetUploadIfCleanupLease(session.UploadID, "cleanup-a", upload.CleanupGeneration, 31, current.Unix())
	require.NoError(t, err)
	require.True(t, ok)
	require.NoError(t, model.DB.First(&asset, "public_id = ?", session.PublicID).Error)
	require.Equal(t, model.AssetStatusExpired, asset.Status)
	require.Equal(t, model.AssetSourceStatusExpired, asset.SourceStatus)
}

func TestSignAssetSourceURLBindsStoredGeneration(t *testing.T) {
	store := installAssetServiceTestDeps(t)
	asset := model.Asset{
		StorageBucket:    "asset-test-bucket",
		ObjectKey:        "assets/7/20260725/ast_fixed/rand_fixed.png",
		ObjectGeneration: 27,
		ContentType:      "image/png",
		StorageBackend:   defaultAssetStorageBackend,
		SourceStatus:     model.AssetSourceStatusAvailable,
		Status:           model.AssetStatusActive,
		SourceExpiresAt:  assetNow().Add(time.Hour).Unix(),
	}
	cfg := CurrentAssetStorageConfig()

	signedURL, err := SignAssetSourceURL(context.Background(), asset, cfg)

	require.NoError(t, err)
	require.Equal(t, "https://signed.example/"+asset.ObjectKey, signedURL)
	require.Len(t, store.signed, 1)
	require.Equal(t, http.MethodGet, store.signed[0].Method)
	require.Equal(t, "27", store.signed[0].QueryParameters.Get("generation"))
}

func TestGetAssetReturnsOwnerScopedGeneralizedPublicProjectionWithoutSignedURL(t *testing.T) {
	newAssetServiceTestDB(t)
	installAssetServiceTestDeps(t)
	require.NoError(t, model.DB.Create(&model.Asset{
		PublicId:        "ast_owned",
		UserId:          7,
		AssetType:       "Image",
		Status:          model.AssetStatusProcessing,
		ContentType:     "image/png",
		SizeBytes:       17,
		SHA256:          strings.Repeat("a", 64),
		SourceExpiresAt: 1788270901,
		CreatedAt:       1785678901,
		UpdatedAt:       1785678901,
	}).Error)

	_, err := GetAsset(context.Background(), 8, "ast_owned")
	require.ErrorIs(t, err, ErrAssetUploadNotFound)

	result, err := GetAsset(context.Background(), 7, "ast_owned")
	require.NoError(t, err)
	require.Equal(t, "ast_owned", result.PublicID)
	require.Equal(t, "Image", result.AssetType)
	require.Equal(t, model.AssetStatusProcessing, result.Status)
	require.EqualValues(t, 1785678901, result.CreatedAt)
	require.EqualValues(t, 1788270901, result.SourceExpiresAt)
	require.Empty(t, result.SignedURL)
	require.Empty(t, result.SHA256, "public read projection must not expose content hashes")
}

func TestGetAssetReportsExpiredWhenSourceLapsedWithoutActiveBinding(t *testing.T) {
	newAssetServiceTestDB(t)
	installAssetServiceTestDeps(t)
	lapsed := assetNow().Add(-time.Hour).Unix()
	require.NoError(t, model.DB.Create(&model.Asset{
		PublicId:        "ast_lapsed",
		UserId:          7,
		AssetType:       "Image",
		Status:          model.AssetStatusActive,
		SourceStatus:    model.AssetSourceStatusAvailable,
		StorageBackend:  defaultAssetStorageBackend,
		StorageBucket:   "asset-test-bucket",
		ObjectKey:       "assets/7/20260725/ast_lapsed/rand.png",
		SourceExpiresAt: lapsed,
		CreatedAt:       1785678901,
		UpdatedAt:       1785678901,
	}).Error)

	result, err := GetAsset(context.Background(), 7, "ast_lapsed")

	// The submit path already rejects this asset with asset_expired. The read
	// path must not keep advertising it as Active or clients see a contract
	// that contradicts itself.
	require.NoError(t, err)
	require.Equal(t, model.AssetStatusExpired, result.Status)
}

func TestGetAssetStaysActiveWhenSourceLapsedButBindingRemains(t *testing.T) {
	newAssetServiceTestDB(t)
	installAssetServiceTestDeps(t)
	lapsed := assetNow().Add(-time.Hour).Unix()
	asset := model.Asset{
		PublicId:        "ast_bound",
		UserId:          7,
		AssetType:       "Image",
		Status:          model.AssetStatusActive,
		SourceStatus:    model.AssetSourceStatusAvailable,
		StorageBackend:  defaultAssetStorageBackend,
		StorageBucket:   "asset-test-bucket",
		ObjectKey:       "assets/7/20260725/ast_bound/rand.png",
		SourceExpiresAt: lapsed,
		CreatedAt:       1785678901,
		UpdatedAt:       1785678901,
	}
	require.NoError(t, model.DB.Create(&asset).Error)
	require.NoError(t, model.DB.Create(&model.AssetBinding{
		AssetId:         asset.Id,
		ChannelId:       131,
		UpstreamAssetId: "upstream-asset",
		Status:          model.AssetStatusActive,
		CreatedAt:       1785678901,
		UpdatedAt:       1785678901,
	}).Error)

	result, err := GetAsset(context.Background(), 7, "ast_bound")

	// An asset stays publicly usable while any provider binding survives, even
	// once the recoverable GCS source has lapsed.
	require.NoError(t, err)
	require.Equal(t, model.AssetStatusActive, result.Status)
}

func TestGetAssetFallsBackToOwnerScopedLegacyBytePlusRowWithoutProviderFields(t *testing.T) {
	newAssetServiceTestDB(t)
	installAssetServiceTestDeps(t)
	group := model.BytePlusAssetGroup{
		UserId:          7,
		ChannelId:       131,
		Status:          model.BytePlusAssetGroupStatusActive,
		UpstreamGroupId: "upstream-group",
		CreatedTime:     1785678800,
		UpdatedTime:     1785678800,
	}
	require.NoError(t, model.DB.Create(&group).Error)
	require.NoError(t, model.DB.Create(&model.BytePlusAsset{
		PublicId:           "ast_legacy",
		UserId:             7,
		AssetGroupId:       group.Id,
		ChannelId:          131,
		AssetType:          "Video",
		ModerationStrategy: "Default",
		Status:             model.BytePlusAssetStatusProcessing,
		UpstreamAssetId:    "upstream-asset",
		CreatedTime:        1785678901,
		UpdatedTime:        1785678901,
	}).Error)

	_, err := GetAsset(context.Background(), 8, "ast_legacy")
	require.ErrorIs(t, err, ErrAssetUploadNotFound)

	result, err := GetAsset(context.Background(), 7, "ast_legacy")
	require.NoError(t, err)
	require.Equal(t, "ast_legacy", result.PublicID)
	require.Equal(t, "Video", result.AssetType)
	require.Equal(t, model.BytePlusAssetStatusProcessing, result.Status)
	require.EqualValues(t, 1785678901, result.CreatedAt)
	require.Empty(t, result.SignedURL)
	require.Empty(t, result.SHA256)
}

func TestCreateAssetUploadSessionSignFailureLeavesNoRows(t *testing.T) {
	newAssetServiceTestDB(t)
	store := installAssetServiceTestDeps(t)
	store.signErr = errFakeAssetStore
	png := tinyPNG()

	_, err := CreateAssetUploadSession(context.Background(), AssetUploadSessionRequest{
		UserID:      7,
		Owner:       "user-7",
		AssetType:   "Image",
		ContentType: "image/png",
		SizeBytes:   int64(len(png)),
	})

	require.ErrorIs(t, err, errFakeAssetStore)
	var assetCount int64
	require.NoError(t, model.DB.Model(&model.Asset{}).Count(&assetCount).Error)
	require.Zero(t, assetCount)
	var uploadCount int64
	require.NoError(t, model.DB.Model(&model.AssetUpload{}).Count(&uploadCount).Error)
	require.Zero(t, uploadCount)
}

func TestCompleteAssetUploadValidationFailureDeletesAndMarksTerminal(t *testing.T) {
	newAssetServiceTestDB(t)
	store := installAssetServiceTestDeps(t)
	png := tinyPNG()
	session, err := CreateAssetUploadSession(context.Background(), AssetUploadSessionRequest{
		UserID:      7,
		Owner:       "user-7",
		AssetType:   "Image",
		ContentType: "image/png",
		SizeBytes:   int64(len(png)),
	})
	require.NoError(t, err)
	store.objects["asset-test-bucket/"+session.ObjectKey] = append(png, 'x')
	store.attrs["asset-test-bucket/"+session.ObjectKey] = AssetObjectAttrs{ContentType: "image/png", Size: int64(len(png) + 1), Generation: 17}

	_, err = CompleteAssetUpload(context.Background(), AssetCompleteUploadRequest{UploadID: session.UploadID, Owner: "user-7"})

	require.ErrorIs(t, err, ErrAssetUploadValidation)
	require.Equal(t, []fakeAssetDelete{{key: "asset-test-bucket/" + session.ObjectKey, expectedGeneration: 17}}, store.deletes)
	var upload model.AssetUpload
	require.NoError(t, model.DB.First(&upload, "upload_id = ?", session.UploadID).Error)
	require.Equal(t, model.AssetUploadStatusFailed, upload.Status)
	var asset model.Asset
	require.NoError(t, model.DB.First(&asset, "public_id = ?", session.PublicID).Error)
	require.Equal(t, model.AssetStatusFailed, asset.Status)
	require.Equal(t, model.AssetSourceStatusUnavailable, asset.SourceStatus)
	require.Empty(t, asset.ObjectKey)
	require.Zero(t, asset.ObjectGeneration)
}

func TestCompleteAssetUploadRejectsDetectedOrMetadataTypeMismatch(t *testing.T) {
	newAssetServiceTestDB(t)
	store := installAssetServiceTestDeps(t)
	png := tinyPNG()
	session, err := CreateAssetUploadSession(context.Background(), AssetUploadSessionRequest{
		UserID:      7,
		Owner:       "user-7",
		AssetType:   "Image",
		ContentType: "image/png",
		SizeBytes:   int64(len(png)),
	})
	require.NoError(t, err)
	store.objects["asset-test-bucket/"+session.ObjectKey] = png
	store.attrs["asset-test-bucket/"+session.ObjectKey] = AssetObjectAttrs{ContentType: "video/mp4", Size: int64(len(png)), Generation: 17}

	_, err = CompleteAssetUpload(context.Background(), AssetCompleteUploadRequest{UploadID: session.UploadID, Owner: "user-7"})

	require.ErrorIs(t, err, ErrAssetTypeMismatch)
	require.Equal(t, []fakeAssetDelete{{key: "asset-test-bucket/" + session.ObjectKey, expectedGeneration: 17}}, store.deletes)
	var upload model.AssetUpload
	require.NoError(t, model.DB.First(&upload, "upload_id = ?", session.UploadID).Error)
	require.Equal(t, model.AssetUploadStatusFailed, upload.Status)
}

func TestCompleteAssetUploadDeleteFailureMarksCleanupPendingForRetry(t *testing.T) {
	newAssetServiceTestDB(t)
	store := installAssetServiceTestDeps(t)
	store.deleteErr = errFakeAssetStore
	png := tinyPNG()
	session, err := CreateAssetUploadSession(context.Background(), AssetUploadSessionRequest{
		UserID:      7,
		Owner:       "user-7",
		AssetType:   "Image",
		ContentType: "image/png",
		SizeBytes:   int64(len(png)),
	})
	require.NoError(t, err)
	store.objects["asset-test-bucket/"+session.ObjectKey] = append(png, 'x')
	store.attrs["asset-test-bucket/"+session.ObjectKey] = AssetObjectAttrs{ContentType: "image/png", Size: int64(len(png) + 1), Generation: 18}

	_, err = CompleteAssetUpload(context.Background(), AssetCompleteUploadRequest{UploadID: session.UploadID, Owner: "user-7"})

	require.ErrorIs(t, err, ErrAssetUploadValidation)
	require.Equal(t, []fakeAssetDelete{{key: "asset-test-bucket/" + session.ObjectKey, expectedGeneration: 18}}, store.deletes)
	var upload model.AssetUpload
	require.NoError(t, model.DB.First(&upload, "upload_id = ?", session.UploadID).Error)
	require.Equal(t, model.AssetUploadStatusFailed, upload.Status)
	require.EqualValues(t, 18, upload.ObjectGeneration)
	var asset model.Asset
	require.NoError(t, model.DB.First(&asset, "public_id = ?", session.PublicID).Error)
	require.Equal(t, model.AssetStatusFailed, asset.Status)
	require.Equal(t, model.AssetSourceStatusCleanupPending, asset.SourceStatus)
	require.EqualValues(t, 18, asset.ObjectGeneration)

	store.deleteErr = nil
	result, err := CleanupExpiredAssetSources(context.Background(), CleanupExpiredAssetSourcesRequest{Owner: "node-a", Limit: 10})
	require.NoError(t, err)
	require.Equal(t, 1, result.Claimed)
	require.Equal(t, 1, result.Deleted)
	require.Len(t, store.deletes, 2)
	require.Equal(t, fakeAssetDelete{key: "asset-test-bucket/" + session.ObjectKey, expectedGeneration: 18}, store.deletes[1])
	require.NoError(t, model.DB.First(&asset, "public_id = ?", session.PublicID).Error)
	require.Equal(t, model.AssetSourceStatusExpired, asset.SourceStatus)
}

func TestCleanupExpiredAssetSourcesExpiresNeverCompletedUploadSession(t *testing.T) {
	newAssetServiceTestDB(t)
	store := installAssetServiceTestDeps(t)
	png := tinyPNG()
	session, err := CreateAssetUploadSession(context.Background(), AssetUploadSessionRequest{
		UserID:      7,
		Owner:       "user-7",
		AssetType:   "Image",
		ContentType: "image/png",
		SizeBytes:   int64(len(png)),
	})
	require.NoError(t, err)
	require.NoError(t, model.DB.Model(&model.AssetUpload{}).Where("upload_id = ?", session.UploadID).Update("expires_at", int64(1000)).Error)
	store.objects["asset-test-bucket/"+session.ObjectKey] = png
	store.attrs["asset-test-bucket/"+session.ObjectKey] = AssetObjectAttrs{ContentType: "image/png", Size: int64(len(png)), Generation: 19}

	result, err := CleanupExpiredAssetSources(context.Background(), CleanupExpiredAssetSourcesRequest{Owner: "node-a", Limit: 10})

	require.NoError(t, err)
	require.Equal(t, 1, result.Claimed)
	require.Equal(t, 1, result.Deleted)
	require.Equal(t, []fakeAssetDelete{{key: "asset-test-bucket/" + session.ObjectKey, expectedGeneration: 19}}, store.deletes)
	var upload model.AssetUpload
	require.NoError(t, model.DB.First(&upload, "upload_id = ?", session.UploadID).Error)
	require.Equal(t, model.AssetUploadStatusExpired, upload.Status)
	require.EqualValues(t, 19, upload.ObjectGeneration)
	var asset model.Asset
	require.NoError(t, model.DB.First(&asset, "public_id = ?", session.PublicID).Error)
	require.Equal(t, model.AssetStatusExpired, asset.Status)
	require.Equal(t, model.AssetSourceStatusExpired, asset.SourceStatus)
}

func TestCleanupExpiredAssetSourcesIsIdempotentAndUsesLeaseFencing(t *testing.T) {
	newAssetServiceTestDB(t)
	store := installAssetServiceTestDeps(t)
	asset := model.Asset{
		PublicId:          "ast_cleanup",
		UserId:            7,
		AssetType:         "Image",
		Status:            model.AssetStatusActive,
		SourceStatus:      model.AssetSourceStatusAvailable,
		StorageBackend:    defaultAssetStorageBackend,
		StorageBucket:     "asset-test-bucket",
		ObjectKey:         "assets/7/20260725/ast_cleanup/r.png",
		ObjectGeneration:  44,
		SourceExpiresAt:   1000,
		CleanupLeaseOwner: "other",
		CleanupLeaseUntil: 1001,
		CleanupGeneration: 3,
		CreatedAt:         900,
		UpdatedAt:         900,
	}
	require.NoError(t, model.DB.Create(&asset).Error)
	require.NoError(t, model.DB.Create(&model.AssetBinding{AssetId: asset.Id, ChannelId: 1, Status: model.AssetStatusActive}).Error)
	store.objects["asset-test-bucket/"+asset.ObjectKey] = tinyPNG()

	result, err := CleanupExpiredAssetSources(context.Background(), CleanupExpiredAssetSourcesRequest{Owner: "node-a", Limit: 10})
	require.NoError(t, err)
	require.Equal(t, 1, result.Claimed)
	require.Equal(t, 1, result.Deleted)
	require.Equal(t, []fakeAssetDelete{{key: "asset-test-bucket/" + asset.ObjectKey, expectedGeneration: 44}}, store.deletes)
	var stored model.Asset
	require.NoError(t, model.DB.First(&stored, asset.Id).Error)
	require.Equal(t, model.AssetSourceStatusExpired, stored.SourceStatus)
	require.Equal(t, model.AssetStatusActive, stored.Status, "active BytePlus binding keeps public asset active")

	result, err = CleanupExpiredAssetSources(context.Background(), CleanupExpiredAssetSourcesRequest{Owner: "node-a", Limit: 10})
	require.NoError(t, err)
	require.Zero(t, result.Claimed)
}

func TestCleanupExpiredAssetSourcesDoesNotExpireOnGenerationMismatch(t *testing.T) {
	newAssetServiceTestDB(t)
	store := installAssetServiceTestDeps(t)
	store.deleteErr = errors.New("generation mismatch")
	asset := model.Asset{
		PublicId:         "ast_cleanup_mismatch",
		UserId:           7,
		AssetType:        "Image",
		Status:           model.AssetStatusActive,
		SourceStatus:     model.AssetSourceStatusAvailable,
		StorageBackend:   defaultAssetStorageBackend,
		StorageBucket:    "asset-test-bucket",
		ObjectKey:        "assets/7/20260725/ast_cleanup_mismatch/r.png",
		ObjectGeneration: 45,
		SourceExpiresAt:  1000,
		CreatedAt:        900,
		UpdatedAt:        900,
	}
	require.NoError(t, model.DB.Create(&asset).Error)
	store.objects["asset-test-bucket/"+asset.ObjectKey] = tinyPNG()

	result, err := CleanupExpiredAssetSources(context.Background(), CleanupExpiredAssetSourcesRequest{Owner: "node-a", Limit: 10})

	require.NoError(t, err)
	require.Equal(t, 1, result.Claimed)
	require.Zero(t, result.Deleted)
	require.Equal(t, []fakeAssetDelete{{key: "asset-test-bucket/" + asset.ObjectKey, expectedGeneration: 45}}, store.deletes)
	var stored model.Asset
	require.NoError(t, model.DB.First(&stored, asset.Id).Error)
	require.Equal(t, model.AssetSourceStatusAvailable, stored.SourceStatus)
	require.Equal(t, model.AssetStatusActive, stored.Status)
}

func TestUploadAssetStreamsWithoutOversizedReadAndCleansUpOverLimit(t *testing.T) {
	newAssetServiceTestDB(t)
	store := installAssetServiceTestDeps(t)
	t.Setenv("ASSET_MULTIPART_MAX_BYTES", "16")
	t.Setenv("ASSET_IMAGE_MAX_BYTES", "16")

	_, err := UploadAsset(context.Background(), AssetUploadRequest{
		UserID:    1,
		AssetType: "Image",
		Filename:  "oversize.png",
		Body:      &chunkGuardReader{chunks: [][]byte{tinyPNG(), []byte("x")}, maxRead: 64 * 1024},
	})

	require.ErrorIs(t, err, ErrAssetTooLarge)
	require.Len(t, store.puts, 1, "bounded stream should reach the object store instead of buffering first")
	require.Equal(t, []fakeAssetDelete{{key: "asset-test-bucket/" + store.puts[0].key}}, store.deletes)
}

func TestAssetStreamingValidatorDoesNotShrinkLargeCallerBuffers(t *testing.T) {
	payload := bytes.Repeat([]byte("a"), 256*1024)
	recorder := &readSizeRecorder{data: append([]byte(nil), payload...)}
	validator := newAssetStreamingValidator(recorder, int64(len(payload))*2)

	_, err := io.Copy(io.Discard, validator)

	require.NoError(t, err)
	require.Equal(t, int64(len(payload)), validator.size)
	require.Equal(t, shaHex(payload), validator.shaHex())
	// io.Copy offers 32KiB buffers. Shrinking them to a handful of bytes turns a
	// 500MiB upload into tens of millions of reads and hash writes.
	require.GreaterOrEqual(t, recorder.maxSeen, 4096,
		"validator must not shrink caller buffers while budget remains")
}

func TestCompleteAssetUploadRejectsExpiredUploadAndDoesNotReadObject(t *testing.T) {
	newAssetServiceTestDB(t)
	store := installAssetServiceTestDeps(t)
	png := tinyPNG()
	session, err := CreateAssetUploadSession(context.Background(), AssetUploadSessionRequest{
		UserID:      7,
		Owner:       "user-7",
		AssetType:   "Image",
		ContentType: "image/png",
		SizeBytes:   int64(len(png)),
	})
	require.NoError(t, err)
	require.NoError(t, model.DB.Model(&model.AssetUpload{}).Where("upload_id = ?", session.UploadID).Update("expires_at", assetNow().Unix()).Error)
	store.objects["asset-test-bucket/"+session.ObjectKey] = png
	store.attrs["asset-test-bucket/"+session.ObjectKey] = AssetObjectAttrs{ContentType: "image/png", Size: int64(len(png)), Generation: 9}

	_, err = CompleteAssetUpload(context.Background(), AssetCompleteUploadRequest{UploadID: session.UploadID, Owner: "user-7"})

	require.ErrorIs(t, err, ErrAssetExpired)
	require.Empty(t, store.opens)
	require.Equal(t, []fakeAssetDelete{{key: "asset-test-bucket/" + session.ObjectKey, expectedGeneration: 9}}, store.deletes)
	var upload model.AssetUpload
	require.NoError(t, model.DB.First(&upload, "upload_id = ?", session.UploadID).Error)
	require.Equal(t, model.AssetUploadStatusExpired, upload.Status)
	require.Empty(t, upload.StorageBackend)
	require.Empty(t, upload.StorageBucket)
	require.Empty(t, upload.ObjectKey)
	require.Zero(t, upload.ObjectGeneration)
	var asset model.Asset
	require.NoError(t, model.DB.First(&asset, "public_id = ?", session.PublicID).Error)
	require.Equal(t, model.AssetStatusExpired, asset.Status)
	require.Equal(t, model.AssetSourceStatusExpired, asset.SourceStatus)
	require.Empty(t, asset.StorageBackend)
	require.Empty(t, asset.StorageBucket)
	require.Empty(t, asset.ObjectKey)
	require.Zero(t, asset.ObjectGeneration)
}

func TestCompleteAssetUploadAlreadyExpiredRowReturnsExpiredButOtherTerminalStatesStayValidation(t *testing.T) {
	newAssetServiceTestDB(t)
	store := installAssetServiceTestDeps(t)
	png := tinyPNG()
	session, err := CreateAssetUploadSession(context.Background(), AssetUploadSessionRequest{
		UserID:      7,
		Owner:       "user-7",
		AssetType:   "Image",
		ContentType: "image/png",
		SizeBytes:   int64(len(png)),
	})
	require.NoError(t, err)
	require.NoError(t, model.DB.Model(&model.AssetUpload{}).Where("upload_id = ?", session.UploadID).Update("status", model.AssetUploadStatusExpired).Error)

	_, err = CompleteAssetUpload(context.Background(), AssetCompleteUploadRequest{UploadID: session.UploadID, Owner: "user-7"})

	require.ErrorIs(t, err, ErrAssetExpired)
	require.Empty(t, store.opens)
	require.Empty(t, store.deletes)

	for _, status := range []string{model.AssetUploadStatusComplete, model.AssetUploadStatusFailed, model.AssetUploadStatusCleaning} {
		require.NoError(t, model.DB.Model(&model.AssetUpload{}).Where("upload_id = ?", session.UploadID).Update("status", status).Error)

		_, err = CompleteAssetUpload(context.Background(), AssetCompleteUploadRequest{UploadID: session.UploadID, Owner: "user-7"})

		require.ErrorIs(t, err, ErrAssetUploadValidation)
	}
}

func TestCompleteAssetUploadExpiredDeleteFailureMarksCleanupPendingForRetry(t *testing.T) {
	newAssetServiceTestDB(t)
	store := installAssetServiceTestDeps(t)
	store.deleteErr = errFakeAssetStore
	png := tinyPNG()
	session, err := CreateAssetUploadSession(context.Background(), AssetUploadSessionRequest{
		UserID:      7,
		Owner:       "user-7",
		AssetType:   "Image",
		ContentType: "image/png",
		SizeBytes:   int64(len(png)),
	})
	require.NoError(t, err)
	require.NoError(t, model.DB.Model(&model.AssetUpload{}).Where("upload_id = ?", session.UploadID).Update("expires_at", assetNow().Unix()).Error)
	store.objects["asset-test-bucket/"+session.ObjectKey] = png
	store.attrs["asset-test-bucket/"+session.ObjectKey] = AssetObjectAttrs{ContentType: "image/png", Size: int64(len(png)), Generation: 11}

	_, err = CompleteAssetUpload(context.Background(), AssetCompleteUploadRequest{UploadID: session.UploadID, Owner: "user-7"})

	require.ErrorIs(t, err, ErrAssetExpired)
	require.Empty(t, store.opens)
	require.Equal(t, []fakeAssetDelete{{key: "asset-test-bucket/" + session.ObjectKey, expectedGeneration: 11}}, store.deletes)
	var upload model.AssetUpload
	require.NoError(t, model.DB.First(&upload, "upload_id = ?", session.UploadID).Error)
	require.Equal(t, model.AssetUploadStatusExpired, upload.Status)
	require.EqualValues(t, 11, upload.ObjectGeneration)
	var asset model.Asset
	require.NoError(t, model.DB.First(&asset, "public_id = ?", session.PublicID).Error)
	require.Equal(t, model.AssetStatusExpired, asset.Status)
	require.Equal(t, model.AssetSourceStatusCleanupPending, asset.SourceStatus)
	require.EqualValues(t, 11, asset.ObjectGeneration)
	require.Equal(t, session.ObjectKey, asset.ObjectKey)

	store.deleteErr = nil
	result, err := CleanupExpiredAssetSources(context.Background(), CleanupExpiredAssetSourcesRequest{Owner: "node-a", Limit: 10})
	require.NoError(t, err)
	require.Equal(t, 1, result.Claimed)
	require.Equal(t, 1, result.Deleted)
	require.Len(t, store.deletes, 2)
	require.Equal(t, fakeAssetDelete{key: "asset-test-bucket/" + session.ObjectKey, expectedGeneration: 11}, store.deletes[1])
	require.NoError(t, model.DB.First(&asset, "public_id = ?", session.PublicID).Error)
	require.Equal(t, model.AssetStatusExpired, asset.Status)
	require.Equal(t, model.AssetSourceStatusExpired, asset.SourceStatus)
	require.Empty(t, asset.ObjectKey)
	require.Zero(t, asset.ObjectGeneration)
}

func newAssetServiceTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Asset{}, &model.AssetBinding{}, &model.AssetUpload{}, &model.BytePlusAssetGroup{}, &model.BytePlusAsset{}))
	sqlDB, err := db.DB()
	require.NoError(t, err)
	oldDB := model.DB
	model.DB = db
	t.Cleanup(func() {
		model.DB = oldDB
		_ = sqlDB.Close()
	})
	return db
}

func installAssetServiceTestDeps(t *testing.T) *fakeAssetObjectStore {
	t.Helper()
	store := &fakeAssetObjectStore{objects: map[string][]byte{}, attrs: map[string]AssetObjectAttrs{}}
	oldStore := assetObjectStore
	oldNow := assetNow
	oldPublicID := assetPublicID
	oldUploadID := assetUploadID
	oldRandom := assetRandomSuffix
	oldHTTP := assetHTTPClient
	oldValidate := assetValidateURL
	assetObjectStore = store
	assetNow = func() time.Time { return time.Date(2026, 7, 25, 10, 11, 12, 0, time.UTC) }
	assetPublicID = func() (string, error) { return "ast_fixed", nil }
	assetUploadID = func() (string, error) { return "upload_fixed", nil }
	assetRandomSuffix = func() (string, error) { return "rand_fixed", nil }
	assetHTTPClient = http.DefaultClient
	assetValidateURL = func(rawURL string) error { return nil }
	t.Setenv("ASSET_STORAGE_BUCKET", "asset-test-bucket")
	t.Setenv("ASSET_KEY_PREFIX", "assets")
	t.Cleanup(func() {
		assetObjectStore = oldStore
		assetNow = oldNow
		assetPublicID = oldPublicID
		assetUploadID = oldUploadID
		assetRandomSuffix = oldRandom
		assetHTTPClient = oldHTTP
		assetValidateURL = oldValidate
	})
	return store
}

func tinyPNG() []byte {
	return []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n', 0, 0, 0, 0, 'I', 'H', 'D', 'R'}
}

func tinyMP3() []byte {
	return []byte("ID3\x04\x00\x00\x00\x00\x00\x00payload")
}

func shaHex(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

type errReader struct{ err error }

func (r errReader) Read([]byte) (int, error) { return 0, r.err }

var _ io.Reader = errReader{err: errors.New("x")}

type chunkGuardReader struct {
	chunks  [][]byte
	maxRead int
}

func (r *chunkGuardReader) Read(p []byte) (int, error) {
	if len(p) > r.maxRead {
		return 0, errors.New("oversized read")
	}
	if len(r.chunks) == 0 {
		return 0, io.EOF
	}
	n := copy(p, r.chunks[0])
	r.chunks[0] = r.chunks[0][n:]
	if len(r.chunks[0]) == 0 {
		r.chunks = r.chunks[1:]
	}
	return n, nil
}

type readSizeRecorder struct {
	data    []byte
	maxSeen int
}

func (r *readSizeRecorder) Read(p []byte) (int, error) {
	if len(p) > r.maxSeen {
		r.maxSeen = len(p)
	}
	if len(r.data) == 0 {
		return 0, io.EOF
	}
	n := copy(p, r.data)
	r.data = r.data[n:]
	return n, nil
}

type raceAssetObjectStore struct {
	*fakeAssetObjectStore
	afterRead    func()
	beforeDelete func(bucket, objectKey string, expectedGeneration int64)
}

func (f *raceAssetObjectStore) Open(ctx context.Context, bucket, objectKey string, generation int64) (io.ReadCloser, error) {
	reader, err := f.fakeAssetObjectStore.Open(ctx, bucket, objectKey, generation)
	if err != nil {
		return nil, err
	}
	return &afterEOFReadCloser{ReadCloser: reader, afterEOF: f.afterRead}, nil
}

func (f *raceAssetObjectStore) Delete(ctx context.Context, bucket, objectKey string, expectedGeneration int64) error {
	if f.beforeDelete != nil {
		f.beforeDelete(bucket, objectKey, expectedGeneration)
	}
	return f.fakeAssetObjectStore.Delete(ctx, bucket, objectKey, expectedGeneration)
}

type afterEOFReadCloser struct {
	io.ReadCloser
	afterEOF func()
	called   bool
}

func (r *afterEOFReadCloser) Read(p []byte) (int, error) {
	n, err := r.ReadCloser.Read(p)
	if errors.Is(err, io.EOF) && !r.called {
		r.called = true
		if r.afterEOF != nil {
			r.afterEOF()
		}
	}
	return n, err
}
