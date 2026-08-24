package service

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"net/url"
	"os"
	"strings"
	"time"

	"cloud.google.com/go/compute/metadata"
	"cloud.google.com/go/storage"
	"google.golang.org/api/iamcredentials/v1"
)

const (
	defaultAssetStorageBucket        = "vocai-gemini-prod-flatkey-assets"
	defaultStagingAssetStorageBucket = "vocai-gemini-prod-flatkey-assets-staging"
	defaultAssetKeyPrefix            = "assets"
	defaultAssetStorageBackend       = "gcs"
	defaultAssetCacheControl         = "private, max-age=0"
	defaultAssetSignedURLTTL         = time.Hour
	defaultAssetSourceRetention      = 30 * 24 * time.Hour
	defaultAssetFetchTimeout         = 10 * time.Minute
	maxAssetFetchTimeout             = 30 * time.Minute
	defaultAssetMultipartMaxBytes    = int64(30 << 20)
	defaultAssetImageMaxBytes        = int64(20 << 20)
	defaultAssetVideoMaxBytes        = int64(500 << 20)
	defaultAssetAudioMaxBytes        = int64(100 << 20)
	assetUploadGenerationMatchHeader = "x-goog-if-generation-match"
)

type AssetObjectStore interface {
	Put(ctx context.Context, bucket, objectKey string, body io.Reader, options AssetObjectPutOptions) error
	Open(ctx context.Context, bucket, objectKey string, generation int64) (io.ReadCloser, error)
	Attrs(ctx context.Context, bucket, objectKey string) (AssetObjectAttrs, error)
	Delete(ctx context.Context, bucket, objectKey string, expectedGeneration int64) error
	SignURL(ctx context.Context, bucket, objectKey string, request AssetSignedURLRequest) (string, error)
}

// AssetObjectPutOptions carries per-caller object metadata. Asset sources are
// private and never cached; temp media stays valid for its whole signed URL
// lifetime, so each caller sets its own Cache-Control.
type AssetObjectPutOptions struct {
	ContentType  string
	CacheControl string
}

type AssetObjectAttrs struct {
	ContentType string
	Size        int64
	Generation  int64
}

type AssetSignedURLRequest struct {
	Method              string
	TTL                 time.Duration
	ContentType         string
	ServiceAccountEmail string
	Headers             []string
	QueryParameters     url.Values
}

type AssetStorageConfig struct {
	Bucket              string
	ServiceAccountEmail string
	KeyPrefix           string
	SignedURLTTL        time.Duration
	SourceRetention     time.Duration
	FetchTimeout        time.Duration
	MultipartMaxBytes   int64
	TypeLimits          map[string]int64
}

var (
	assetObjectStore         AssetObjectStore = gcsAssetObjectStore{}
	assetServiceAccountEmail                  = defaultAssetServiceAccountEmail
	errAssetObjectNotFound                    = errors.New("asset object not found")
)

func CurrentAssetStorageConfig() AssetStorageConfig {
	ttl := time.Duration(getEnvInt("ASSET_SIGNED_URL_TTL_SECONDS", int(defaultAssetSignedURLTTL.Seconds()))) * time.Second
	if ttl <= 0 {
		ttl = defaultAssetSignedURLTTL
	} else if ttl > defaultAssetSignedURLTTL {
		ttl = defaultAssetSignedURLTTL
	}
	fetchTimeout := time.Duration(getEnvInt("ASSET_FETCH_TIMEOUT_SECONDS", int(defaultAssetFetchTimeout.Seconds()))) * time.Second
	if fetchTimeout <= 0 || fetchTimeout > maxAssetFetchTimeout {
		fetchTimeout = defaultAssetFetchTimeout
	}
	retentionDays := getEnvInt("ASSET_SOURCE_RETENTION_DAYS", int(defaultAssetSourceRetention.Hours()/24))
	if retentionDays <= 0 {
		retentionDays = int(defaultAssetSourceRetention.Hours() / 24)
	}
	multipartMax := getEnvInt64("ASSET_MULTIPART_MAX_BYTES", defaultAssetMultipartMaxBytes)
	if multipartMax <= 0 || multipartMax > defaultAssetMultipartMaxBytes {
		multipartMax = defaultAssetMultipartMaxBytes
	}
	return AssetStorageConfig{
		Bucket:              defaultAssetBucketForEnv(),
		ServiceAccountEmail: strings.TrimSpace(os.Getenv("ASSET_SERVICE_ACCOUNT_EMAIL")),
		KeyPrefix:           firstNonEmptyTempMediaValue(strings.TrimSpace(os.Getenv("ASSET_KEY_PREFIX")), defaultAssetKeyPrefix),
		SignedURLTTL:        ttl,
		SourceRetention:     time.Duration(retentionDays) * 24 * time.Hour,
		FetchTimeout:        fetchTimeout,
		MultipartMaxBytes:   int64(multipartMax),
		TypeLimits: map[string]int64{
			"Image": getPositiveEnvInt64("ASSET_IMAGE_MAX_BYTES", defaultAssetImageMaxBytes),
			"Video": getPositiveEnvInt64("ASSET_VIDEO_MAX_BYTES", defaultAssetVideoMaxBytes),
			"Audio": getPositiveEnvInt64("ASSET_AUDIO_MAX_BYTES", defaultAssetAudioMaxBytes),
		},
	}
}

type gcsAssetObjectStore struct{}

func (gcsAssetObjectStore) Put(ctx context.Context, bucket, objectKey string, body io.Reader, options AssetObjectPutOptions) error {
	client, err := storage.NewClient(ctx)
	if err != nil {
		return err
	}
	defer client.Close()
	writer := client.Bucket(bucket).Object(objectKey).NewWriter(ctx)
	writer.ContentType = options.ContentType
	writer.CacheControl = options.CacheControl
	if writer.CacheControl == "" {
		writer.CacheControl = defaultAssetCacheControl
	}
	if _, err := io.Copy(writer, body); err != nil {
		type closeWithError interface {
			CloseWithError(error) error
		}
		if closer, ok := any(writer).(closeWithError); ok {
			_ = closer.CloseWithError(err)
		} else {
			_ = writer.Close()
		}
		return err
	}
	return writer.Close()
}

func (gcsAssetObjectStore) Open(ctx context.Context, bucket, objectKey string, generation int64) (io.ReadCloser, error) {
	client, err := storage.NewClient(ctx)
	if err != nil {
		return nil, err
	}
	object := client.Bucket(bucket).Object(objectKey)
	if generation > 0 {
		object = object.Generation(generation)
	}
	reader, err := object.NewReader(ctx)
	if err != nil {
		_ = client.Close()
		if errors.Is(err, storage.ErrObjectNotExist) {
			return nil, errAssetObjectNotFound
		}
		return nil, err
	}
	return assetGCSReadCloser{ReadCloser: reader, closeClient: client.Close}, nil
}

func (gcsAssetObjectStore) Attrs(ctx context.Context, bucket, objectKey string) (AssetObjectAttrs, error) {
	client, err := storage.NewClient(ctx)
	if err != nil {
		return AssetObjectAttrs{}, err
	}
	defer client.Close()
	attrs, err := client.Bucket(bucket).Object(objectKey).Attrs(ctx)
	if err != nil {
		if errors.Is(err, storage.ErrObjectNotExist) {
			return AssetObjectAttrs{}, errAssetObjectNotFound
		}
		return AssetObjectAttrs{}, err
	}
	return AssetObjectAttrs{ContentType: attrs.ContentType, Size: attrs.Size, Generation: attrs.Generation}, nil
}

func (gcsAssetObjectStore) Delete(ctx context.Context, bucket, objectKey string, expectedGeneration int64) error {
	client, err := storage.NewClient(ctx)
	if err != nil {
		return err
	}
	defer client.Close()
	object := client.Bucket(bucket).Object(objectKey)
	if expectedGeneration > 0 {
		object = object.If(storage.Conditions{GenerationMatch: expectedGeneration})
	}
	err = object.Delete(ctx)
	if errors.Is(err, storage.ErrObjectNotExist) {
		return errAssetObjectNotFound
	}
	return err
}

func (gcsAssetObjectStore) SignURL(ctx context.Context, bucket, objectKey string, request AssetSignedURLRequest) (string, error) {
	serviceAccountEmail, err := resolveAssetSignerServiceAccount(ctx, request.ServiceAccountEmail)
	if err != nil {
		return "", err
	}
	signer, err := iamcredentials.NewService(ctx)
	if err != nil {
		return "", err
	}
	options := &storage.SignedURLOptions{
		GoogleAccessID:  serviceAccountEmail,
		Method:          request.Method,
		Expires:         assetNow().Add(request.TTL),
		Scheme:          storage.SigningSchemeV4,
		Headers:         append([]string(nil), request.Headers...),
		QueryParameters: cloneURLValues(request.QueryParameters),
		SignBytes: func(payload []byte) ([]byte, error) {
			response, err := signer.Projects.ServiceAccounts.SignBlob(
				"projects/-/serviceAccounts/"+serviceAccountEmail,
				&iamcredentials.SignBlobRequest{Payload: base64.StdEncoding.EncodeToString(payload)},
			).Context(ctx).Do()
			if err != nil {
				return nil, err
			}
			return base64.StdEncoding.DecodeString(response.SignedBlob)
		},
	}
	if request.ContentType != "" {
		options.ContentType = request.ContentType
	}
	return storage.SignedURL(bucket, objectKey, options)
}

func resolveAssetSignerServiceAccount(ctx context.Context, requestedEmail string) (string, error) {
	serviceAccountEmail := strings.TrimSpace(requestedEmail)
	if serviceAccountEmail != "" {
		return serviceAccountEmail, nil
	}
	serviceAccountEmail, err := assetServiceAccountEmail(ctx)
	if err != nil {
		return "", fmt.Errorf("%w: %v", ErrTempMediaServiceAccount, err)
	}
	return strings.TrimSpace(serviceAccountEmail), nil
}

func cloneURLValues(values url.Values) url.Values {
	if len(values) == 0 {
		return nil
	}
	clone := make(url.Values, len(values))
	for key, items := range values {
		clone[key] = append([]string(nil), items...)
	}
	return clone
}

type assetGCSReadCloser struct {
	io.ReadCloser
	closeClient func() error
}

func (r assetGCSReadCloser) Close() error {
	readerErr := r.ReadCloser.Close()
	clientErr := r.closeClient()
	if readerErr != nil {
		return readerErr
	}
	return clientErr
}

func defaultAssetBucketForEnv() string {
	if bucket := strings.TrimSpace(os.Getenv("ASSET_STORAGE_BUCKET")); bucket != "" {
		return bucket
	}
	origin := strings.ToLower(os.Getenv("APP_CONSOLE_ORIGIN") + " " + os.Getenv("FRONTEND_BASE_URL"))
	if strings.Contains(origin, "staging") {
		return defaultStagingAssetStorageBucket
	}
	return defaultAssetStorageBucket
}

func defaultAssetServiceAccountEmail(ctx context.Context) (string, error) {
	return metadata.EmailWithContext(ctx, "default")
}

func getEnvInt64(key string, fallback int64) int64 {
	return int64(getEnvInt(key, int(fallback)))
}

func getPositiveEnvInt64(key string, fallback int64) int64 {
	value := getEnvInt64(key, fallback)
	if value <= 0 {
		return fallback
	}
	return value
}

func isAssetObjectNotFound(err error) bool {
	return errors.Is(err, errAssetObjectNotFound) || errors.Is(err, storage.ErrObjectNotExist)
}
