package image_stream

// R2 upload via Cloudflare's S3-compatible API.
//
// Object reads and writes are not supported by Cloudflare's management REST
// API. Requests are signed with AWS SigV4 and sent to the account's R2 endpoint.
// Configuration comes from five env vars set on the gateway:
//
//   CLOUDFLARE_R2_ACCESS_KEY_ID       R2 S3 access key ID
//   CLOUDFLARE_R2_SECRET_ACCESS_KEY   R2 S3 secret access key
//   CLOUDFLARE_R2_ACCOUNT_ID          CF account ID
//   CLOUDFLARE_R2_BUCKET             bucket name (e.g. "image-cache")
//   CLOUDFLARE_R2_PUBLIC_BASE        public base URL (e.g. "https://cdn.opwan.ai")
//
// If any of these are missing, asynchronous image submission is disabled.

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"net/url"
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
	PublicBase      string
	Endpoint        string
}

type r2PutError struct {
	StatusCode int
	Message    string
}

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
	return R2Config{
		AccessKeyID:     common.GetEnvOrDefaultString("CLOUDFLARE_R2_ACCESS_KEY_ID", ""),
		SecretAccessKey: common.GetEnvOrDefaultString("CLOUDFLARE_R2_SECRET_ACCESS_KEY", ""),
		AccountID:       common.GetEnvOrDefaultString("CLOUDFLARE_R2_ACCOUNT_ID", ""),
		Bucket:          common.GetEnvOrDefaultString("CLOUDFLARE_R2_BUCKET", ""),
		PublicBase:      strings.TrimRight(common.GetEnvOrDefaultString("CLOUDFLARE_R2_PUBLIC_BASE", ""), "/"),
	}
}

func (c R2Config) Enabled() bool {
	return c.AccessKeyID != "" && c.SecretAccessKey != "" && c.AccountID != "" && c.Bucket != "" && c.PublicBase != ""
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
	endpoint := strings.TrimRight(c.Endpoint, "/")
	if endpoint == "" {
		endpoint = fmt.Sprintf("https://%s.r2.cloudflarestorage.com", c.AccountID)
	}
	objectURL, err := url.JoinPath(endpoint, c.Bucket, key)
	if err != nil {
		return "", fmt.Errorf("build R2 object URL: %w", err)
	}
	reqCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(reqCtx, http.MethodPut, objectURL, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", contentType)
	payloadDigest := sha256.Sum256(body)
	payloadHash := hex.EncodeToString(payloadDigest[:])
	req.Header.Set("X-Amz-Content-Sha256", payloadHash)
	credentials := aws.Credentials{
		AccessKeyID:     c.AccessKeyID,
		SecretAccessKey: c.SecretAccessKey,
		Source:          "R2Config",
	}
	if err := awsv4.NewSigner().SignHTTP(reqCtx, credentials, req, payloadHash, "s3", "auto", time.Now(), func(options *awsv4.SignerOptions) {
		options.DisableURIPathEscaping = true
	}); err != nil {
		return "", fmt.Errorf("sign R2 PUT request: %w", err)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("R2 PUT failed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		errBody, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return "", &r2PutError{StatusCode: resp.StatusCode, Message: strings.TrimSpace(string(errBody))}
	}
	return c.PublicBase + "/" + key, nil
}

// PutImageDeduped sha256-keys the bytes, uploads under images/<hash>.<ext>,
// and returns the public URL. Using the content hash as the key means
// re-running an identical generation reuses the same R2 object instead of
// burning storage on duplicates.
func (c R2Config) PutImageDeduped(ctx context.Context, raw []byte, claimedFormat string) (string, string, error) {
	ext := InferImageExt(claimedFormat, raw)
	key := "images/" + sha256HexBytes(raw) + "." + ext
	url, err := c.PutObject(ctx, key, MimeForExt(ext), raw)
	return url, ext, err
}

// sha256HexBytes returns the hex-encoded sha256 digest of `raw`. Exported
// (lowercase but reused across files in the same package) so the envelope
// builder can compute keys without re-importing crypto/sha256.
func sha256HexBytes(raw []byte) string {
	h := sha256.Sum256(raw)
	return hex.EncodeToString(h[:])
}
