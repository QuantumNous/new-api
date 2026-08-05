package service

import (
	"context"
	"errors"
	"io"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestUploadTempMediaImageStoresAndSignsObject(t *testing.T) {
	fixedNow := time.Date(2026, 7, 25, 10, 11, 12, 0, time.UTC)
	originalPut := putTempMediaObject
	originalSign := signTempMediaObject
	originalNow := tempMediaNow
	t.Cleanup(func() {
		putTempMediaObject = originalPut
		signTempMediaObject = originalSign
		tempMediaNow = originalNow
	})

	t.Setenv("TEMP_MEDIA_BUCKET", "flatkey-test-bucket")
	t.Setenv("TEMP_MEDIA_KEY_PREFIX", "test-prefix")
	t.Setenv("TEMP_MEDIA_SIGNED_URL_TTL_SECONDS", "3600")
	tempMediaNow = func() time.Time { return fixedNow }

	var uploaded struct {
		bucket      string
		objectKey   string
		body        string
		contentType string
		ttl         time.Duration
	}
	putTempMediaObject = func(_ context.Context, cfg TempMediaConfig, objectKey string, body io.Reader, contentType string) error {
		payload, err := io.ReadAll(body)
		require.NoError(t, err)
		uploaded.bucket = cfg.Bucket
		uploaded.objectKey = objectKey
		uploaded.body = string(payload)
		uploaded.contentType = contentType
		uploaded.ttl = cfg.SignedURLTTL
		return nil
	}
	signTempMediaObject = func(_ context.Context, cfg TempMediaConfig, objectKey string, method string) (string, error) {
		require.Equal(t, "GET", method)
		require.Equal(t, "flatkey-test-bucket", cfg.Bucket)
		require.Equal(t, uploaded.objectKey, objectKey)
		return "https://storage.example/signed", nil
	}

	result, err := UploadTempMediaImage(context.Background(), TempMediaUploadRequest{
		UserID:      42,
		ContentType: "image/png; charset=binary",
		Size:        7,
		Body:        strings.NewReader("payload"),
	})

	require.NoError(t, err)
	require.Equal(t, "flatkey-test-bucket", uploaded.bucket)
	require.Equal(t, "payload", uploaded.body)
	require.Equal(t, "image/png", uploaded.contentType)
	require.Equal(t, time.Hour, uploaded.ttl)
	require.True(t, strings.HasPrefix(result.ObjectKey, "test-prefix/42/20260725/"), result.ObjectKey)
	require.True(t, strings.HasSuffix(result.ObjectKey, ".png"), result.ObjectKey)
	require.Equal(t, "https://storage.example/signed", result.SignedURL)
	require.Equal(t, fixedNow.Add(time.Hour).Unix(), result.ExpiresAt)
	require.Equal(t, int64(3600), result.ExpiresIn)
	require.Equal(t, int64(7), result.Size)
	require.Equal(t, "image/png", result.ContentType)
}

func TestSignTempMediaObjectPassesConfiguredServiceAccountToSharedStore(t *testing.T) {
	store := &fakeAssetObjectStore{}
	originalStore := assetObjectStore
	t.Cleanup(func() {
		assetObjectStore = originalStore
	})
	assetObjectStore = store

	t.Setenv("TEMP_MEDIA_SERVICE_ACCOUNT_EMAIL", " temp-media-signer@example.iam.gserviceaccount.com ")
	cfg := CurrentTempMediaConfig()

	_, err := signTempMediaObjectWithIAM(context.Background(), cfg, "temp-media/1/file.png", "GET")

	require.NoError(t, err)
	require.Len(t, store.signed, 1)
	require.Equal(t, "temp-media-signer@example.iam.gserviceaccount.com", store.signed[0].ServiceAccountEmail)
}

func TestSignTempMediaObjectDoesNotInheritAssetServiceAccountEmail(t *testing.T) {
	store := &fakeAssetObjectStore{}
	originalStore := assetObjectStore
	originalMetadata := assetServiceAccountEmail
	t.Cleanup(func() {
		assetObjectStore = originalStore
		assetServiceAccountEmail = originalMetadata
	})
	assetObjectStore = store
	assetServiceAccountEmail = func(context.Context) (string, error) {
		return "metadata-signer@example.iam.gserviceaccount.com", nil
	}
	t.Setenv("ASSET_SERVICE_ACCOUNT_EMAIL", "asset-signer@example.iam.gserviceaccount.com")
	t.Setenv("TEMP_MEDIA_SERVICE_ACCOUNT_EMAIL", "")
	cfg := CurrentTempMediaConfig()

	_, err := signTempMediaObjectWithIAM(context.Background(), cfg, "temp-media/1/file.png", "GET")

	require.NoError(t, err)
	require.Len(t, store.signed, 1)
	require.Empty(t, store.signed[0].ServiceAccountEmail)
}

func TestPutTempMediaObjectToGCSKeepsSignedURLAlignedCacheControl(t *testing.T) {
	store := &fakeAssetObjectStore{objects: map[string][]byte{}, attrs: map[string]AssetObjectAttrs{}}
	oldStore := assetObjectStore
	assetObjectStore = store
	t.Cleanup(func() { assetObjectStore = oldStore })

	cfg := TempMediaConfig{Bucket: "temp-media-bucket", SignedURLTTL: 12 * time.Hour}
	err := putTempMediaObjectToGCS(context.Background(), cfg, "temp/object.png", strings.NewReader("payload"), "image/png")

	// Temp media objects stay valid for the whole signed URL lifetime, so they
	// must not be stored with the asset store's no-cache default.
	require.NoError(t, err)
	require.Len(t, store.puts, 1)
	require.Equal(t, "image/png", store.puts[0].contentType)
	require.Equal(t, "private, max-age=43200", store.puts[0].cacheControl)
}

func TestUploadTempMediaImageRejectsOversizedImage(t *testing.T) {
	t.Setenv("TEMP_MEDIA_MAX_IMAGE_BYTES", "3")

	_, err := UploadTempMediaImage(context.Background(), TempMediaUploadRequest{
		UserID:      1,
		ContentType: "image/png",
		Size:        4,
		Body:        strings.NewReader("data"),
	})

	require.ErrorIs(t, err, ErrTempMediaImageTooLarge)
}

func TestUploadTempMediaImageRejectsUnsupportedImageType(t *testing.T) {
	_, err := UploadTempMediaImage(context.Background(), TempMediaUploadRequest{
		UserID:      1,
		ContentType: "image/gif",
		Size:        4,
		Body:        strings.NewReader("data"),
	})

	require.ErrorIs(t, err, ErrTempMediaUnsupportedImage)
}

func TestCurrentTempMediaConfigDefaultsStagingBucketAndClampsTTL(t *testing.T) {
	t.Setenv("APP_CONSOLE_ORIGIN", "https://staging-console.flatkey.ai")
	t.Setenv("TEMP_MEDIA_SIGNED_URL_TTL_SECONDS", "259200")

	cfg := CurrentTempMediaConfig()

	require.Equal(t, defaultStagingTempMediaBucket, cfg.Bucket)
	require.Equal(t, defaultTempMediaSignedURLTTL, cfg.SignedURLTTL)
}

func TestUploadTempMediaImageWrapsStorageErrors(t *testing.T) {
	originalPut := putTempMediaObject
	originalSign := signTempMediaObject
	t.Cleanup(func() {
		putTempMediaObject = originalPut
		signTempMediaObject = originalSign
	})

	putErr := errors.New("storage down")
	putTempMediaObject = func(context.Context, TempMediaConfig, string, io.Reader, string) error {
		return putErr
	}
	signTempMediaObject = func(context.Context, TempMediaConfig, string, string) (string, error) {
		t.Fatal("sign should not run after upload error")
		return "", nil
	}

	_, err := UploadTempMediaImage(context.Background(), TempMediaUploadRequest{
		UserID:      1,
		ContentType: "image/webp",
		Size:        4,
		Body:        strings.NewReader("data"),
	})

	require.ErrorIs(t, err, putErr)
	require.ErrorContains(t, err, "upload temp media object")
}
