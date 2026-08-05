package service

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestAssetStorageConfigDefaultsAndOverrides(t *testing.T) {
	t.Setenv("APP_CONSOLE_ORIGIN", "https://staging-console.flatkey.ai")
	cfg := CurrentAssetStorageConfig()
	require.Equal(t, defaultStagingAssetStorageBucket, cfg.Bucket)
	require.Equal(t, time.Hour, cfg.SignedURLTTL)
	require.Equal(t, 30*24*time.Hour, cfg.SourceRetention)
	require.Equal(t, int64(30<<20), cfg.MultipartMaxBytes)
	require.Equal(t, int64(20<<20), cfg.TypeLimits["Image"])
	require.Equal(t, int64(500<<20), cfg.TypeLimits["Video"])
	require.Equal(t, int64(100<<20), cfg.TypeLimits["Audio"])

	t.Setenv("ASSET_STORAGE_BUCKET", "custom-assets")
	t.Setenv("ASSET_SIGNED_URL_TTL_SECONDS", "120")
	t.Setenv("ASSET_SOURCE_RETENTION_DAYS", "7")
	t.Setenv("ASSET_IMAGE_MAX_BYTES", "17")
	t.Setenv("ASSET_VIDEO_MAX_BYTES", "18")
	t.Setenv("ASSET_AUDIO_MAX_BYTES", "19")
	t.Setenv("ASSET_MULTIPART_MAX_BYTES", "20")
	t.Setenv("ASSET_KEY_PREFIX", "custom-prefix")
	cfg = CurrentAssetStorageConfig()
	require.Equal(t, "custom-assets", cfg.Bucket)
	require.Equal(t, 2*time.Minute, cfg.SignedURLTTL)
	require.Equal(t, 7*24*time.Hour, cfg.SourceRetention)
	require.Equal(t, int64(17), cfg.TypeLimits["Image"])
	require.Equal(t, int64(18), cfg.TypeLimits["Video"])
	require.Equal(t, int64(19), cfg.TypeLimits["Audio"])
	require.Equal(t, int64(20), cfg.MultipartMaxBytes)
	require.Equal(t, "custom-prefix", cfg.KeyPrefix)

	t.Setenv("ASSET_SIGNED_URL_TTL_SECONDS", "7200")
	cfg = CurrentAssetStorageConfig()
	require.Equal(t, time.Hour, cfg.SignedURLTTL, "asset signed URL TTL must be clamped to the one hour GCS V4 upload window")
}

func TestAssetStorageConfigClampsFetchTimeout(t *testing.T) {
	t.Setenv("ASSET_FETCH_TIMEOUT_SECONDS", "0")
	cfg := CurrentAssetStorageConfig()
	require.Equal(t, defaultAssetFetchTimeout, cfg.FetchTimeout)

	t.Setenv("ASSET_FETCH_TIMEOUT_SECONDS", "9999")
	cfg = CurrentAssetStorageConfig()
	require.Equal(t, defaultAssetFetchTimeout, cfg.FetchTimeout)

	t.Setenv("ASSET_FETCH_TIMEOUT_SECONDS", "120")
	cfg = CurrentAssetStorageConfig()
	require.Equal(t, 2*time.Minute, cfg.FetchTimeout)
}

func TestAssetStorageSignerUsesV4MethodTTLAndContentType(t *testing.T) {
	store := &fakeAssetObjectStore{}
	cfg := AssetStorageConfig{Bucket: "bucket", SignedURLTTL: time.Hour}

	url, err := store.SignURL(context.Background(), "bucket", "assets/1/o.png", AssetSignedURLRequest{
		Method:      http.MethodPut,
		TTL:         cfg.SignedURLTTL,
		ContentType: "image/png",
	})

	require.NoError(t, err)
	require.Equal(t, "https://signed.example/assets/1/o.png", url)
	require.Len(t, store.signed, 1)
	require.Equal(t, http.MethodPut, store.signed[0].Method)
	require.Equal(t, time.Hour, store.signed[0].TTL)
	require.Equal(t, "image/png", store.signed[0].ContentType)
}

func TestAssetStorageSignerRequestCarriesRequiredHeadersAndGenerationQuery(t *testing.T) {
	store := &fakeAssetObjectStore{}
	query := url.Values{}
	query.Set("generation", "17")

	_, err := store.SignURL(context.Background(), "bucket", "assets/1/o.png", AssetSignedURLRequest{
		Method:          http.MethodGet,
		TTL:             time.Hour,
		Headers:         []string{"x-goog-if-generation-match:0"},
		QueryParameters: query,
	})

	require.NoError(t, err)
	require.Len(t, store.signed, 1)
	require.Equal(t, []string{"x-goog-if-generation-match:0"}, store.signed[0].Headers)
	require.Equal(t, "17", store.signed[0].QueryParameters.Get("generation"))
}

func TestAssetStorageSignerServiceAccountResolutionIgnoresAssetEnvFallback(t *testing.T) {
	originalMetadata := assetServiceAccountEmail
	t.Cleanup(func() { assetServiceAccountEmail = originalMetadata })
	t.Setenv("ASSET_SERVICE_ACCOUNT_EMAIL", "asset-signer@example.iam.gserviceaccount.com")
	assetServiceAccountEmail = func(context.Context) (string, error) {
		return "metadata-signer@example.iam.gserviceaccount.com", nil
	}

	email, err := resolveAssetSignerServiceAccount(context.Background(), "")
	require.NoError(t, err)
	require.Equal(t, "metadata-signer@example.iam.gserviceaccount.com", email)

	email, err = resolveAssetSignerServiceAccount(context.Background(), "request-signer@example.iam.gserviceaccount.com")
	require.NoError(t, err)
	require.Equal(t, "request-signer@example.iam.gserviceaccount.com", email)
}

type fakeAssetObjectStore struct {
	puts      []fakeAssetPut
	signed    []AssetSignedURLRequest
	deletes   []fakeAssetDelete
	opens     []fakeAssetOpen
	signErr   error
	openErr   error
	attrsErr  error
	deleteErr error
	objects   map[string][]byte
	attrs     map[string]AssetObjectAttrs
}

type fakeAssetPut struct {
	key          string
	body         string
	contentType  string
	cacheControl string
}

type fakeAssetDelete struct {
	key                string
	expectedGeneration int64
}

type fakeAssetOpen struct {
	key        string
	generation int64
}

func (f *fakeAssetObjectStore) Put(_ context.Context, bucket, objectKey string, body io.Reader, options AssetObjectPutOptions) error {
	f.puts = append(f.puts, fakeAssetPut{key: objectKey, contentType: options.ContentType, cacheControl: options.CacheControl})
	payload, err := io.ReadAll(body)
	if err != nil {
		return err
	}
	if f.objects == nil {
		f.objects = map[string][]byte{}
	}
	f.objects[bucket+"/"+objectKey] = append([]byte(nil), payload...)
	f.puts[len(f.puts)-1].body = string(payload)
	return nil
}

func (f *fakeAssetObjectStore) Open(_ context.Context, bucket, objectKey string, generation int64) (io.ReadCloser, error) {
	f.opens = append(f.opens, fakeAssetOpen{key: bucket + "/" + objectKey, generation: generation})
	if f.openErr != nil {
		return nil, f.openErr
	}
	return io.NopCloser(strings.NewReader(string(f.objects[bucket+"/"+objectKey]))), nil
}

func (f *fakeAssetObjectStore) Attrs(_ context.Context, bucket, objectKey string) (AssetObjectAttrs, error) {
	if f.attrsErr != nil {
		return AssetObjectAttrs{}, f.attrsErr
	}
	if f.attrs != nil {
		if attrs, ok := f.attrs[bucket+"/"+objectKey]; ok {
			return attrs, nil
		}
	}
	body := f.objects[bucket+"/"+objectKey]
	return AssetObjectAttrs{ContentType: http.DetectContentType(body), Size: int64(len(body)), Generation: 1}, nil
}

func (f *fakeAssetObjectStore) Delete(_ context.Context, bucket, objectKey string, expectedGeneration int64) error {
	f.deletes = append(f.deletes, fakeAssetDelete{key: bucket + "/" + objectKey, expectedGeneration: expectedGeneration})
	if f.deleteErr != nil {
		return f.deleteErr
	}
	delete(f.objects, bucket+"/"+objectKey)
	return nil
}

func (f *fakeAssetObjectStore) SignURL(_ context.Context, _ string, objectKey string, request AssetSignedURLRequest) (string, error) {
	f.signed = append(f.signed, request)
	if f.signErr != nil {
		return "", f.signErr
	}
	return "https://signed.example/" + objectKey, nil
}

var errFakeAssetStore = errors.New("fake asset store error")
