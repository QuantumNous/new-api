package service

import (
	"context"
	"errors"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

type bytePlusGCSTempObjectStore struct {
	cfg TempMediaConfig
}

func newBytePlusGCSTempObjectStore() (BytePlusTempObjectStore, error) {
	if !bytePlusGCSTempObjectStoreConfigured() {
		return nil, errors.New("byteplus real-person gcs storage is unavailable")
	}
	cfg := CurrentTempMediaConfig()
	cfg.Bucket = strings.TrimSpace(cfg.Bucket)
	if cfg.Bucket == "" {
		return nil, errors.New("byteplus real-person gcs bucket is unavailable")
	}
	return &bytePlusGCSTempObjectStore{cfg: cfg}, nil
}

func bytePlusGCSTempObjectStoreConfigured() bool {
	if bucket, ok := os.LookupEnv("TEMP_MEDIA_BUCKET"); ok {
		return strings.TrimSpace(bucket) != ""
	}
	// CurrentTempMediaConfig carries the product default prod/staging private buckets.
	return strings.TrimSpace(CurrentTempMediaConfig().Bucket) != ""
}

func bytePlusGCSTempObjectBucket() string {
	if !bytePlusGCSTempObjectStoreConfigured() {
		return ""
	}
	return strings.TrimSpace(CurrentTempMediaConfig().Bucket)
}

func (s *bytePlusGCSTempObjectStore) PutObject(ctx context.Context, key string, body io.Reader, contentType string, _ int64) error {
	return putTempMediaObject(ctx, s.cfg, strings.TrimSpace(key), body, strings.TrimSpace(contentType))
}

func (s *bytePlusGCSTempObjectStore) PresignGet(ctx context.Context, key string, ttl time.Duration) (string, error) {
	cfg := s.cfg
	if ttl > 0 {
		cfg.SignedURLTTL = ttl
	}
	return signTempMediaObject(ctx, cfg, strings.TrimSpace(key), http.MethodGet)
}

func (s *bytePlusGCSTempObjectStore) DeleteObject(ctx context.Context, key string) error {
	return deleteTempMediaObject(ctx, s.cfg, strings.TrimSpace(key))
}

func (s *bytePlusGCSTempObjectStore) TempObjectBucket() string {
	return s.cfg.Bucket
}

func (s *bytePlusGCSTempObjectStore) TempObjectStorageProvider() string {
	return bytePlusTempObjectProviderGCS
}
