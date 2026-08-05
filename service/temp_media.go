package service

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
)

const (
	defaultTempMediaBucket        = "vocai-gemini-prod-flatkey-temp-media"
	defaultStagingTempMediaBucket = "vocai-gemini-prod-flatkey-temp-media-staging"
	defaultTempMediaKeyPrefix     = "temp-media"
	defaultTempMediaMaxImageBytes = 20 << 20
	defaultTempMediaSignedURLTTL  = 12 * time.Hour
)

var (
	ErrTempMediaFileRequired     = errors.New("temp media file is required")
	ErrTempMediaImageTooLarge    = errors.New("temp media image is too large")
	ErrTempMediaUnsupportedImage = errors.New("unsupported temp media image type")
	ErrTempMediaStorageDisabled  = errors.New("temp media storage is disabled")
	ErrTempMediaServiceAccount   = errors.New("temp media service account is unavailable")
	putTempMediaObject           = putTempMediaObjectToGCS
	signTempMediaObject          = signTempMediaObjectWithIAM
	deleteTempMediaObject        = deleteTempMediaObjectFromGCS
	tempMediaNow                 = time.Now
	tempMediaServiceAccountEmail = defaultTempMediaServiceAccountEmail
)

type TempMediaConfig struct {
	Bucket              string
	ServiceAccountEmail string
	KeyPrefix           string
	SignedURLTTL        time.Duration
	MaxImageBytes       int64
}

type TempMediaUploadRequest struct {
	UserID      int
	Filename    string
	ContentType string
	Size        int64
	Body        io.Reader
}

type TempMediaUploadResult struct {
	ObjectKey   string `json:"object_key"`
	SignedURL   string `json:"signed_url"`
	ExpiresAt   int64  `json:"expires_at"`
	ExpiresIn   int64  `json:"expires_in"`
	ContentType string `json:"content_type"`
	Size        int64  `json:"size"`
}

func CurrentTempMediaConfig() TempMediaConfig {
	ttl := time.Duration(getEnvInt("TEMP_MEDIA_SIGNED_URL_TTL_SECONDS", int(defaultTempMediaSignedURLTTL.Seconds()))) * time.Second
	if ttl <= 0 || ttl > defaultTempMediaSignedURLTTL {
		ttl = defaultTempMediaSignedURLTTL
	}
	maxBytes := int64(getEnvInt("TEMP_MEDIA_MAX_IMAGE_BYTES", defaultTempMediaMaxImageBytes))
	if maxBytes <= 0 {
		maxBytes = defaultTempMediaMaxImageBytes
	}
	return TempMediaConfig{
		Bucket:              defaultTempMediaBucketForEnv(),
		ServiceAccountEmail: strings.TrimSpace(os.Getenv("TEMP_MEDIA_SERVICE_ACCOUNT_EMAIL")),
		KeyPrefix:           firstNonEmptyTempMediaValue(strings.TrimSpace(os.Getenv("TEMP_MEDIA_KEY_PREFIX")), defaultTempMediaKeyPrefix),
		SignedURLTTL:        ttl,
		MaxImageBytes:       maxBytes,
	}
}

func UploadTempMediaImage(ctx context.Context, request TempMediaUploadRequest) (*TempMediaUploadResult, error) {
	cfg := CurrentTempMediaConfig()
	if strings.TrimSpace(cfg.Bucket) == "" {
		return nil, ErrTempMediaStorageDisabled
	}
	if request.Body == nil {
		return nil, ErrTempMediaFileRequired
	}
	if request.Size <= 0 {
		return nil, ErrTempMediaFileRequired
	}
	if request.Size > cfg.MaxImageBytes {
		return nil, ErrTempMediaImageTooLarge
	}
	contentType, ext := normalizeTempMediaImageType(request.ContentType)
	if contentType == "" {
		return nil, ErrTempMediaUnsupportedImage
	}
	key, err := buildTempMediaObjectKey(cfg.KeyPrefix, request.UserID, ext)
	if err != nil {
		return nil, err
	}
	if err := putTempMediaObject(ctx, cfg, key, request.Body, contentType); err != nil {
		return nil, fmt.Errorf("upload temp media object: %w", err)
	}
	signedURL, err := signTempMediaObject(ctx, cfg, key, http.MethodGet)
	if err != nil {
		return nil, fmt.Errorf("sign temp media object: %w", err)
	}
	now := tempMediaNow()
	return &TempMediaUploadResult{
		ObjectKey:   key,
		SignedURL:   signedURL,
		ExpiresAt:   now.Add(cfg.SignedURLTTL).Unix(),
		ExpiresIn:   int64(cfg.SignedURLTTL.Seconds()),
		ContentType: contentType,
		Size:        request.Size,
	}, nil
}

func putTempMediaObjectToGCS(ctx context.Context, cfg TempMediaConfig, objectKey string, body io.Reader, contentType string) error {
	return assetObjectStore.Put(ctx, cfg.Bucket, objectKey, body, AssetObjectPutOptions{
		ContentType: contentType,
		// Temp media stays readable for the whole signed URL lifetime.
		CacheControl: fmt.Sprintf("private, max-age=%d", int64(cfg.SignedURLTTL.Seconds())),
	})
}

func deleteTempMediaObjectFromGCS(ctx context.Context, cfg TempMediaConfig, objectKey string) error {
	if err := assetObjectStore.Delete(ctx, cfg.Bucket, objectKey, 0); err != nil && !isAssetObjectNotFound(err) {
		return err
	}
	return nil
}

func signTempMediaObjectWithIAM(ctx context.Context, cfg TempMediaConfig, objectKey string, method string) (string, error) {
	return assetObjectStore.SignURL(ctx, cfg.Bucket, objectKey, AssetSignedURLRequest{Method: method, TTL: cfg.SignedURLTTL, ServiceAccountEmail: cfg.ServiceAccountEmail})
}

func normalizeTempMediaImageType(contentType string) (string, string) {
	switch strings.ToLower(strings.TrimSpace(strings.Split(contentType, ";")[0])) {
	case "image/jpeg", "image/jpg":
		return "image/jpeg", ".jpg"
	case "image/png":
		return "image/png", ".png"
	case "image/webp":
		return "image/webp", ".webp"
	default:
		return "", ""
	}
}

func buildTempMediaObjectKey(prefix string, userID int, ext string) (string, error) {
	random, err := common.GenerateRandomCharsKey(24)
	if err != nil {
		return "", err
	}
	cleanPrefix := strings.Trim(path.Clean("/"+strings.TrimSpace(prefix)), "/")
	if cleanPrefix == "." || cleanPrefix == "" {
		cleanPrefix = defaultTempMediaKeyPrefix
	}
	return path.Join(cleanPrefix, strconv.Itoa(userID), tempMediaNow().UTC().Format("20060102"), random+ext), nil
}

func defaultTempMediaBucketForEnv() string {
	if bucket := strings.TrimSpace(os.Getenv("TEMP_MEDIA_BUCKET")); bucket != "" {
		return bucket
	}
	origin := strings.ToLower(os.Getenv("APP_CONSOLE_ORIGIN") + " " + os.Getenv("FRONTEND_BASE_URL"))
	if strings.Contains(origin, "staging") {
		return defaultStagingTempMediaBucket
	}
	return defaultTempMediaBucket
}

func defaultTempMediaServiceAccountEmail(ctx context.Context) (string, error) {
	return defaultAssetServiceAccountEmail(ctx)
}

func getEnvInt(key string, fallback int) int {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func firstNonEmptyTempMediaValue(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}
