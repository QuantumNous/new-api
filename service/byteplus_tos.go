package service

import (
	"context"
	"errors"
	"io"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/volcengine/ve-tos-golang-sdk/v2/tos"
	"github.com/volcengine/ve-tos-golang-sdk/v2/tos/enum"
)

type BytePlusTempObjectStore interface {
	PutObject(context.Context, string, io.Reader, string, int64) error
	PresignGet(context.Context, string, time.Duration) (string, error)
	DeleteObject(context.Context, string) error
}

type bytePlusTOSAPI interface {
	PutObjectV2(context.Context, *tos.PutObjectV2Input) (*tos.PutObjectV2Output, error)
	PreSignedURL(*tos.PreSignedURLInput) (*tos.PreSignedURLOutput, error)
	DeleteObjectV2(context.Context, *tos.DeleteObjectV2Input) (*tos.DeleteObjectV2Output, error)
}

type bytePlusTOSStore struct {
	bucket         string
	client         bytePlusTOSAPI
	publicEndpoint string
}

var bytePlusTempObjectStoreFactory = newPreferredBytePlusTempObjectStore
var bytePlusTOSObjectStoreFactory = newBytePlusTOSStore

func newPreferredBytePlusTempObjectStore(creds BytePlusCredentials) (BytePlusTempObjectStore, error) {
	if err := creds.ValidateRealPersonAssets(); err != nil {
		return nil, err
	}
	backend, err := bytePlusTempStorageBackend()
	if err != nil {
		return nil, err
	}
	switch backend {
	case bytePlusTempObjectProviderGCS:
		return newBytePlusGCSTempObjectStore()
	case bytePlusTempObjectProviderTOS:
		return bytePlusTOSObjectStoreFactory(creds)
	default:
		return nil, errors.New("byteplus temp storage backend is invalid")
	}
}

func bytePlusTempStorageBackend() (string, error) {
	backend := strings.ToLower(strings.TrimSpace(os.Getenv("BYTEPLUS_TEMP_STORAGE_BACKEND")))
	switch backend {
	case "", bytePlusTempObjectProviderGCS:
		return bytePlusTempObjectProviderGCS, nil
	case bytePlusTempObjectProviderTOS:
		return bytePlusTempObjectProviderTOS, nil
	default:
		return "", errors.New("byteplus temp storage backend is invalid")
	}
}

func newBytePlusTOSStore(creds BytePlusCredentials) (BytePlusTempObjectStore, error) {
	if err := creds.ValidateRealPersonAssetStorage(); err != nil {
		return nil, err
	}
	internalEndpoint := strings.TrimSpace(creds.RealPersonAssets.TOSInternalEndpoint)
	client, err := tos.NewClientV2(
		internalEndpoint,
		tos.WithCredentials(tos.NewStaticCredentials(creds.AccessKeyID, creds.SecretAccessKey)),
		tos.WithRegion(strings.TrimSpace(creds.RealPersonAssets.TOSRegion)),
		tos.WithDisableTrailerHeader(false),
		tos.WithMaxRetryCount(0),
	)
	if err != nil {
		return nil, errors.New("byteplus real-person tos client is unavailable")
	}
	return &bytePlusTOSStore{
		bucket:         strings.TrimSpace(creds.RealPersonAssets.TOSBucket),
		client:         client,
		publicEndpoint: bytePlusTOSPublicPresignEndpoint(internalEndpoint),
	}, nil
}

func (s *bytePlusTOSStore) PutObject(ctx context.Context, key string, body io.Reader, contentType string, size int64) error {
	input := &tos.PutObjectV2Input{
		PutObjectBasicInput: tos.PutObjectBasicInput{
			Bucket:       s.bucket,
			Key:          strings.TrimSpace(key),
			ContentType:  strings.TrimSpace(contentType),
			CacheControl: "private, no-store",
		},
		Content: body,
	}
	if size > 0 {
		input.ContentLength = size
	}
	_, err := s.client.PutObjectV2(ctx, input)
	return err
}

func (s *bytePlusTOSStore) TempObjectBucket() string {
	return s.bucket
}

func (s *bytePlusTOSStore) TempObjectStorageProvider() string {
	return bytePlusTempObjectProviderTOS
}

func (s *bytePlusTOSStore) PresignGet(ctx context.Context, key string, ttl time.Duration) (string, error) {
	output, err := s.client.PreSignedURL(&tos.PreSignedURLInput{
		HTTPMethod:          enum.HttpMethodGet,
		Bucket:              s.bucket,
		Key:                 strings.TrimSpace(key),
		Expires:             int64(ttl.Seconds()),
		AlternativeEndpoint: strings.TrimSpace(s.publicEndpoint),
	})
	if err != nil {
		return "", err
	}
	if output == nil {
		return "", errors.New("byteplus tos presign failed")
	}
	return output.SignedUrl, nil
}

func (s *bytePlusTOSStore) DeleteObject(ctx context.Context, key string) error {
	_, err := s.client.DeleteObjectV2(ctx, &tos.DeleteObjectV2Input{Bucket: s.bucket, Key: strings.TrimSpace(key)})
	return err
}

func bytePlusTOSPublicPresignEndpoint(endpoint string) string {
	parsed, err := url.Parse(strings.TrimSpace(endpoint))
	if err != nil {
		return strings.TrimSpace(endpoint)
	}
	hostname := strings.ToLower(parsed.Hostname())
	if strings.HasSuffix(hostname, ".ibytepluses.com") {
		hostname = strings.TrimSuffix(hostname, ".ibytepluses.com") + ".bytepluses.com"
	}
	parsed.Host = hostname
	return parsed.String()
}
