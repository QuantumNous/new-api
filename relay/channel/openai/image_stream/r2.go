package image_stream

// R2 upload via Cloudflare's S3-compatible API.
//
// Object reads and writes are not supported by Cloudflare's management REST
// API. Requests are signed with AWS SigV4 and sent to the account's R2 endpoint.
// Configuration comes from six env vars set on the gateway:
//
//   CLOUDFLARE_R2_ACCESS_KEY_ID       R2 S3 access key ID
//   CLOUDFLARE_R2_SECRET_ACCESS_KEY   R2 S3 secret access key
//   CLOUDFLARE_R2_ACCOUNT_ID          CF account ID
//   CLOUDFLARE_R2_BUCKET             public result bucket (e.g. "image-cache")
//   CLOUDFLARE_R2_INPUT_BUCKET       separate private reference-image bucket
//   CLOUDFLARE_R2_PUBLIC_BASE        public base URL (e.g. "https://cdn.opwan.ai")
//
// Output-only generation requires the public result settings. Requests with
// reference images additionally require the distinct private input bucket.

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsv4 "github.com/aws/aws-sdk-go-v2/aws/signer/v4"
)

type R2Config struct {
	AccessKeyID     string
	SecretAccessKey string
	AccountID       string
	Bucket          string
	InputBucket     string
	PublicBase      string
	Endpoint        string
}

// A 128-bit content ID is 22 URL-safe characters after unpadded base64 and
// keeps accidental collisions negligible while avoiding full 64-character
// SHA-256 filenames in public URLs.
const resultImageContentIDBytes = 16

type r2PutError struct {
	StatusCode int
	Message    string
}

type invalidInputImageError struct {
	err error
}

func (e *invalidInputImageError) Error() string { return e.err.Error() }
func (e *invalidInputImageError) Unwrap() error { return e.err }

type imageSpool struct {
	file *os.File
	path string
	size int64
	hash string
	head []byte
}

func newImageSpool(source io.Reader, expectedSize int64) (*imageSpool, error) {
	spool, err := newBoundedImageSpool(source, expectedSize)
	if err != nil {
		return nil, err
	}
	if spool.size != expectedSize {
		_ = spool.Close()
		return nil, &invalidInputImageError{err: fmt.Errorf("image upload size mismatch: expected %d bytes, got %d", expectedSize, spool.size)}
	}
	return spool, nil
}

func newBoundedImageSpool(source io.Reader, maxBytes int64) (*imageSpool, error) {
	if source == nil {
		return nil, errors.New("image upload reader is required")
	}
	if maxBytes <= 0 {
		return nil, errors.New("image upload byte limit must be positive")
	}
	path, file, err := common.CreateDiskCacheFile(common.DiskCacheTypeFile)
	if err != nil {
		return nil, fmt.Errorf("create image upload spool: %w", err)
	}
	cleanup := func() {
		_ = file.Close()
		_ = os.Remove(path)
	}

	hasher := sha256.New()
	written, err := io.Copy(io.MultiWriter(file, hasher), io.LimitReader(source, maxBytes+1))
	if err != nil {
		cleanup()
		var corrupt base64.CorruptInputError
		if errors.As(err, &corrupt) {
			return nil, &invalidInputImageError{err: fmt.Errorf("decode image base64: %w", err)}
		}
		return nil, fmt.Errorf("spool image upload: %w", err)
	}
	if written == 0 {
		cleanup()
		return nil, &invalidInputImageError{err: errors.New("image upload is empty")}
	}
	if written > maxBytes {
		cleanup()
		return nil, &invalidInputImageError{err: fmt.Errorf("image upload exceeds %d bytes", maxBytes)}
	}
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		cleanup()
		return nil, fmt.Errorf("rewind image upload spool: %w", err)
	}
	head := make([]byte, 512)
	headBytes, err := io.ReadFull(file, head)
	if err != nil && !errors.Is(err, io.ErrUnexpectedEOF) {
		cleanup()
		return nil, fmt.Errorf("read image upload header: %w", err)
	}
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		cleanup()
		return nil, fmt.Errorf("rewind image upload spool: %w", err)
	}
	common.IncrementDiskFiles(written)
	return &imageSpool{
		file: file,
		path: path,
		size: written,
		hash: hex.EncodeToString(hasher.Sum(nil)),
		head: head[:headBytes],
	}, nil
}

func (spool *imageSpool) Read(p []byte) (int, error) { return spool.file.Read(p) }

func (spool *imageSpool) Head() []byte { return spool.head }

func (spool *imageSpool) Hash() string { return spool.hash }

func (spool *imageSpool) Close() error {
	if spool == nil || spool.file == nil {
		return nil
	}
	closeErr := spool.file.Close()
	removeErr := os.Remove(spool.path)
	common.DecrementDiskFiles(spool.size)
	spool.file = nil
	if closeErr != nil {
		return closeErr
	}
	if removeErr != nil && !errors.Is(removeErr, os.ErrNotExist) {
		return removeErr
	}
	return nil
}

// Workers receive a freshly signed URL immediately before the upstream call.
// Six minutes covers the five-minute upstream deadline without leaving private
// reference images readable for the rest of the day.
const asyncImageInputURLTTL = 6 * time.Minute

func (e *r2PutError) Error() string {
	return fmt.Sprintf("R2 PUT %d: %s", e.StatusCode, e.Message)
}

func (e *r2PutError) Permanent() bool {
	return e.StatusCode >= 400 && e.StatusCode < 500 &&
		e.StatusCode != http.StatusRequestTimeout &&
		e.StatusCode != http.StatusConflict &&
		e.StatusCode != http.StatusTooEarly &&
		e.StatusCode != http.StatusTooManyRequests
}

func LoadR2Config() R2Config {
	config := R2Config{
		AccessKeyID:     common.GetEnvOrDefaultString("CLOUDFLARE_R2_ACCESS_KEY_ID", ""),
		SecretAccessKey: common.GetEnvOrDefaultString("CLOUDFLARE_R2_SECRET_ACCESS_KEY", ""),
		AccountID:       common.GetEnvOrDefaultString("CLOUDFLARE_R2_ACCOUNT_ID", ""),
		Bucket:          common.GetEnvOrDefaultString("CLOUDFLARE_R2_BUCKET", ""),
		InputBucket:     common.GetEnvOrDefaultString("CLOUDFLARE_R2_INPUT_BUCKET", ""),
		PublicBase:      strings.TrimRight(common.GetEnvOrDefaultString("CLOUDFLARE_R2_PUBLIC_BASE", ""), "/"),
	}
	accountEndpoint := strings.TrimRight(fmt.Sprintf("https://%s.r2.cloudflarestorage.com", config.AccountID), "/")
	if strings.EqualFold(config.PublicBase, accountEndpoint) {
		config.PublicBase = ""
	}
	return config
}

func (c R2Config) Enabled() bool {
	accountEndpoint := strings.TrimRight(fmt.Sprintf("https://%s.r2.cloudflarestorage.com", c.AccountID), "/")
	return c.AccessKeyID != "" && c.SecretAccessKey != "" && c.AccountID != "" && c.Bucket != "" &&
		c.PublicBase != "" && !strings.EqualFold(strings.TrimRight(c.PublicBase, "/"), accountEndpoint)
}

func (c R2Config) InputEnabled() bool {
	return c.AccessKeyID != "" && c.SecretAccessKey != "" && c.AccountID != "" &&
		c.InputBucket != "" && c.InputBucket != c.Bucket
}

func (c R2Config) objectURL(bucket, key string) (string, error) {
	endpoint := strings.TrimRight(c.Endpoint, "/")
	if endpoint == "" {
		endpoint = fmt.Sprintf("https://%s.r2.cloudflarestorage.com", c.AccountID)
	}
	objectURL, err := url.JoinPath(endpoint, bucket, key)
	if err != nil {
		return "", fmt.Errorf("build R2 object URL: %w", err)
	}
	return objectURL, nil
}

func (c R2Config) credentials() aws.Credentials {
	return aws.Credentials{
		AccessKeyID:     c.AccessKeyID,
		SecretAccessKey: c.SecretAccessKey,
		Source:          "R2Config",
	}
}

// MimeForExt returns the Content-Type that should be set on the R2 object so
// browsers and image tags pick the right decoder.
func MimeForExt(ext string) string {
	switch ext {
	case "jpg", "jpeg":
		return "image/jpeg"
	case "webp":
		return "image/webp"
	case "gif":
		return "image/gif"
	default:
		return "image/png"
	}
}

// InferImageExt sniffs the magic bytes first, falling back to the upstream's
// claimed format. Upstream sometimes echoes back output_format=webp while
// silently returning PNG bytes, so trusting `claimed` blindly produces .webp
// URLs whose body is actually PNG.
func InferImageExt(claimed string, head []byte) string {
	if len(head) >= 8 {
		if head[0] == 0x89 && head[1] == 'P' && head[2] == 'N' && head[3] == 'G' {
			return "png"
		}
		if head[0] == 0xFF && head[1] == 0xD8 && head[2] == 0xFF {
			return "jpg"
		}
		if string(head[:4]) == "RIFF" && len(head) >= 12 && string(head[8:12]) == "WEBP" {
			return "webp"
		}
		if string(head[:6]) == "GIF87a" || string(head[:6]) == "GIF89a" {
			return "gif"
		}
	}
	switch strings.ToLower(claimed) {
	case "jpeg", "jpg":
		return "jpg"
	case "webp":
		return "webp"
	case "gif":
		return "gif"
	default:
		return "png"
	}
}

// PutObject uploads `body` to R2 under `key` and returns the public URL.
func (c R2Config) PutObject(ctx context.Context, key string, contentType string, body []byte) (string, error) {
	if !c.Enabled() {
		return "", fmt.Errorf("R2 not configured (set CLOUDFLARE_R2_ACCESS_KEY_ID/SECRET_ACCESS_KEY/ACCOUNT_ID/BUCKET/PUBLIC_BASE)")
	}
	if err := c.putObjectToBucket(ctx, c.Bucket, key, contentType, body); err != nil {
		return "", err
	}
	return c.PublicBase + "/" + key, nil
}

func (c R2Config) putObjectToBucket(ctx context.Context, bucket, key, contentType string, body []byte) error {
	payloadDigest := sha256.Sum256(body)
	return c.putReaderToBucket(ctx, bucket, key, contentType, bytes.NewReader(body), int64(len(body)), hex.EncodeToString(payloadDigest[:]))
}

func (c R2Config) putReaderToBucket(ctx context.Context, bucket, key, contentType string, body io.Reader, size int64, payloadHash string) error {
	if body == nil {
		return errors.New("R2 PUT body is required")
	}
	if size <= 0 {
		return errors.New("R2 PUT body size must be positive")
	}
	if len(payloadHash) != sha256.Size*2 {
		return errors.New("R2 PUT payload hash is invalid")
	}
	objectURL, err := c.objectURL(bucket, key)
	if err != nil {
		return err
	}
	reqCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(reqCtx, http.MethodPut, objectURL, body)
	if err != nil {
		return err
	}
	req.ContentLength = size
	req.Header.Set("Content-Type", contentType)
	req.Header.Set("X-Amz-Content-Sha256", payloadHash)
	if err := awsv4.NewSigner().SignHTTP(reqCtx, c.credentials(), req, payloadHash, "s3", "auto", time.Now(), func(options *awsv4.SignerOptions) {
		options.DisableURIPathEscaping = true
	}); err != nil {
		return fmt.Errorf("sign R2 PUT request: %w", err)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("R2 PUT failed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		errBody, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return &r2PutError{StatusCode: resp.StatusCode, Message: strings.TrimSpace(string(errBody))}
	}
	return nil
}

func (c R2Config) presignObjectGET(ctx context.Context, bucket, key string, ttl time.Duration) (string, error) {
	if c.AccessKeyID == "" || c.SecretAccessKey == "" || c.AccountID == "" || bucket == "" {
		return "", errors.New("R2 signing credentials and bucket are required")
	}
	if ttl <= 0 || ttl > 7*24*time.Hour {
		return "", fmt.Errorf("R2 GET URL ttl must be between 1 second and 7 days")
	}
	objectURL, err := c.objectURL(bucket, key)
	if err != nil {
		return "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, objectURL, nil)
	if err != nil {
		return "", err
	}
	query := req.URL.Query()
	query.Set("X-Amz-Expires", strconv.FormatInt(int64(ttl/time.Second), 10))
	req.URL.RawQuery = query.Encode()
	signedURL, _, err := awsv4.NewSigner().PresignHTTP(
		ctx,
		c.credentials(),
		req,
		"UNSIGNED-PAYLOAD",
		"s3",
		"auto",
		time.Now(),
		func(options *awsv4.SignerOptions) {
			options.DisableURIPathEscaping = true
		},
	)
	if err != nil {
		return "", fmt.Errorf("sign R2 GET request: %w", err)
	}
	return signedURL, nil
}

// PutImageDeduped uploads under a short, deterministic content ID and returns
// the public URL. Identical generations still reuse the same R2 object.
func (c R2Config) PutImageDeduped(ctx context.Context, raw []byte, claimedFormat string) (string, string, error) {
	ext := InferImageExt(claimedFormat, raw)
	url, err := c.PutObject(ctx, resultImageObjectKey(raw, ext), MimeForExt(ext), raw)
	return url, ext, err
}

// PutInputImageDeduped stores each staged reference image under a unique
// per-upload namespace. Output images remain content-addressed, but temporary
// inputs cannot share keys because cleanup must never delete a fresh upload of
// bytes identical to an expired object.
func (c R2Config) PutInputImageDeduped(ctx context.Context, raw []byte, claimedFormat string) (string, string, string, error) {
	return c.PutInputImageReader(ctx, bytes.NewReader(raw), int64(len(raw)), claimedFormat)
}

// PutInputImageReader uploads a validated image without materializing another
// copy in memory. The caller's reader must contain exactly size bytes.
func (c R2Config) PutInputImageReader(ctx context.Context, source io.Reader, size int64, claimedFormat string) (string, string, string, error) {
	if !c.InputEnabled() {
		return "", "", "", errors.New("R2 input storage requires a separate private CLOUDFLARE_R2_INPUT_BUCKET")
	}
	if source == nil {
		return "", "", "", errors.New("R2 input image reader is required")
	}
	if size <= 0 || size > maxImageBytes {
		return "", "", "", fmt.Errorf("R2 input image size must be between 1 and %d bytes", maxImageBytes)
	}

	spool, err := newImageSpool(source, size)
	if err != nil {
		return "", "", "", err
	}
	defer spool.Close()
	return c.putInputImageSpool(ctx, spool, claimedFormat)
}

// PutInputImageStream accepts an image whose decoded length is not known in
// advance, bounds it while spooling to disk, then uploads the spool to R2.
func (c R2Config) PutInputImageStream(ctx context.Context, source io.Reader, maxBytes int64, claimedFormat string) (string, string, string, int64, error) {
	if !c.InputEnabled() {
		return "", "", "", 0, errors.New("R2 input storage requires a separate private CLOUDFLARE_R2_INPUT_BUCKET")
	}
	if maxBytes <= 0 || maxBytes > maxImageBytes {
		return "", "", "", 0, fmt.Errorf("R2 input image limit must be between 1 and %d bytes", maxImageBytes)
	}
	spool, err := newBoundedImageSpool(source, maxBytes)
	if err != nil {
		return "", "", "", 0, err
	}
	defer spool.Close()
	signedURL, key, ext, err := c.putInputImageSpool(ctx, spool, claimedFormat)
	return signedURL, key, ext, spool.size, err
}

func (c R2Config) putInputImageSpool(ctx context.Context, spool *imageSpool, claimedFormat string) (string, string, string, error) {
	if spool == nil {
		return "", "", "", errors.New("R2 input image spool is required")
	}
	ext, ok := strictGenericImageFormat(spool.Head())
	if !ok || ext == "gif" {
		return "", "", "", &invalidInputImageError{err: fmt.Errorf("unsupported image type %q (need png/jpeg/webp)", claimedFormat)}
	}
	uploadID := make([]byte, 16)
	if _, err := rand.Read(uploadID); err != nil {
		return "", "", ext, fmt.Errorf("generate R2 input object namespace: %w", err)
	}
	key := "inputs/" + hex.EncodeToString(uploadID) + "/" + spool.Hash() + "." + ext
	// Register cleanup ownership before the PUT. A crash after the object is
	// created can then be recovered by the durable cleanup outbox.
	if err := registerAsyncImageInputObject(ctx, key); err != nil {
		return "", key, ext, fmt.Errorf("register R2 input cleanup: %w", err)
	}
	signedURL, err := c.presignObjectGET(ctx, c.InputBucket, key, asyncImageInputURLTTL)
	if err != nil {
		return "", key, ext, err
	}
	if err := c.putReaderToBucket(ctx, c.InputBucket, key, MimeForExt(ext), spool, spool.size, spool.Hash()); err != nil {
		return "", key, ext, err
	}
	return signedURL, key, ext, nil
}

func (c R2Config) PresignInputObject(ctx context.Context, key string) (string, error) {
	if !c.InputEnabled() {
		return "", errors.New("R2 input storage requires a separate private CLOUDFLARE_R2_INPUT_BUCKET")
	}
	key = strings.TrimSpace(key)
	if !strings.HasPrefix(key, "inputs/") || strings.Contains(key, "..") || strings.ContainsAny(key, "?#\\") {
		return "", errors.New("invalid R2 input object key")
	}
	return c.presignObjectGET(ctx, c.InputBucket, key, asyncImageInputURLTTL)
}

func resultImageObjectKey(raw []byte, ext string) string {
	digest := sha256.Sum256(raw)
	contentID := base64.RawURLEncoding.EncodeToString(digest[:resultImageContentIDBytes])
	return "images/" + contentID + "." + ext
}

// sha256HexBytes returns the full digest used for signed payloads and private
// input object keys.
func sha256HexBytes(raw []byte) string {
	h := sha256.Sum256(raw)
	return hex.EncodeToString(h[:])
}
