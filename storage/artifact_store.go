package storage

import (
	"context"
	"errors"
	"io"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type ArtifactStore interface {
	Put(ctx context.Context, key string, body io.Reader, contentType string) error
	SignedURL(ctx context.Context, key string, ttl time.Duration) (string, error)
	Delete(ctx context.Context, key string) error
}

type S3ArtifactStore struct {
	bucket    string
	client    *s3.Client
	presigner *s3.PresignClient
}

func NewS3ArtifactStore(ctx context.Context) (*S3ArtifactStore, error) {
	endpoint := strings.TrimSpace(os.Getenv("S3_ENDPOINT"))
	publicEndpoint := strings.TrimSpace(os.Getenv("S3_PUBLIC_ENDPOINT"))
	region := strings.TrimSpace(os.Getenv("S3_REGION"))
	bucket := strings.TrimSpace(os.Getenv("S3_BUCKET"))
	accessKey := os.Getenv("S3_ACCESS_KEY_ID")
	secretKey := os.Getenv("S3_SECRET_ACCESS_KEY")
	if region == "" {
		region = "us-east-1"
	}
	if bucket == "" || accessKey == "" || secretKey == "" {
		return nil, errors.New("S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY are required")
	}
	if endpoint != "" {
		if err := validateEndpoint(endpoint); err != nil {
			return nil, err
		}
	}
	if publicEndpoint != "" {
		if err := validateEndpoint(publicEndpoint); err != nil {
			return nil, err
		}
	} else {
		publicEndpoint = endpoint
	}

	awsConfig, err := config.LoadDefaultConfig(ctx,
		config.WithRegion(region),
		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(accessKey, secretKey, "")),
	)
	if err != nil {
		return nil, err
	}
	pathStyle, _ := strconv.ParseBool(os.Getenv("S3_USE_PATH_STYLE"))
	client := s3.NewFromConfig(awsConfig, func(options *s3.Options) {
		options.UsePathStyle = pathStyle
		if endpoint != "" {
			options.BaseEndpoint = aws.String(strings.TrimRight(endpoint, "/"))
		}
	})
	presignClient := client
	if publicEndpoint != "" && publicEndpoint != endpoint {
		presignClient = s3.NewFromConfig(awsConfig, func(options *s3.Options) {
			options.UsePathStyle = pathStyle
			options.BaseEndpoint = aws.String(strings.TrimRight(publicEndpoint, "/"))
		})
	}
	return &S3ArtifactStore{
		bucket:    bucket,
		client:    client,
		presigner: s3.NewPresignClient(presignClient),
	}, nil
}

func validateEndpoint(raw string) error {
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Hostname() == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return errors.New("S3 endpoint must be an absolute http or https URL")
	}
	if parsed.User != nil || parsed.RawQuery != "" || parsed.Fragment != "" {
		return errors.New("S3 endpoint must not contain credentials, query parameters or fragments")
	}
	return nil
}

func (s *S3ArtifactStore) Put(ctx context.Context, key string, body io.Reader, contentType string) error {
	if s == nil || s.client == nil {
		return errors.New("artifact store is not initialized")
	}
	_, err := s.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(s.bucket),
		Key:         aws.String(key),
		Body:        body,
		ContentType: aws.String(contentType),
	})
	return err
}

func (s *S3ArtifactStore) SignedURL(ctx context.Context, key string, ttl time.Duration) (string, error) {
	if s == nil || s.presigner == nil {
		return "", errors.New("artifact store is not initialized")
	}
	if ttl <= 0 {
		ttl = 15 * time.Minute
	}
	result, err := s.presigner.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	}, func(options *s3.PresignOptions) {
		options.Expires = ttl
	})
	if err != nil {
		return "", err
	}
	return result.URL, nil
}

func (s *S3ArtifactStore) Delete(ctx context.Context, key string) error {
	if s == nil || s.client == nil {
		return errors.New("artifact store is not initialized")
	}
	_, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	return err
}
