package service

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path"
	"strconv"
	"strings"
	"time"

	"cloud.google.com/go/compute/metadata"
	"cloud.google.com/go/storage"
	"github.com/QuantumNous/new-api/common"
	"google.golang.org/api/iamcredentials/v1"
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
	client, err := storage.NewClient(ctx)
	if err != nil {
		return err
	}
	defer client.Close()
	writer := client.Bucket(cfg.Bucket).Object(objectKey).NewWriter(ctx)
	writer.ContentType = contentType
	writer.CacheControl = fmt.Sprintf("private, max-age=%d", int64(cfg.SignedURLTTL.Seconds()))
	if _, err := io.Copy(writer, body); err != nil {
		_ = writer.Close()
		return err
	}
	return writer.Close()
}

func deleteTempMediaObjectFromGCS(ctx context.Context, cfg TempMediaConfig, objectKey string) error {
	client, err := storage.NewClient(ctx)
	if err != nil {
		return err
	}
	defer client.Close()
	if err := client.Bucket(cfg.Bucket).Object(objectKey).Delete(ctx); err != nil && !errors.Is(err, storage.ErrObjectNotExist) {
		return err
	}
	return nil
}

func signTempMediaObjectWithIAM(ctx context.Context, cfg TempMediaConfig, objectKey string, method string) (string, error) {
	serviceAccountEmail := cfg.ServiceAccountEmail
	if serviceAccountEmail == "" {
		var err error
		serviceAccountEmail, err = tempMediaServiceAccountEmail(ctx)
		if err != nil {
			return "", fmt.Errorf("%w: %v", ErrTempMediaServiceAccount, err)
		}
	}
	signer, err := iamcredentials.NewService(ctx)
	if err != nil {
		return "", err
	}
	return storage.SignedURL(cfg.Bucket, objectKey, &storage.SignedURLOptions{
		GoogleAccessID: serviceAccountEmail,
		Method:         method,
		Expires:        tempMediaNow().Add(cfg.SignedURLTTL),
		Scheme:         storage.SigningSchemeV4,
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
	})
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
	return metadata.EmailWithContext(ctx, "default")
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
