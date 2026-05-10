package image_stream

// R2 upload via the Cloudflare REST API.
//
// We avoid the S3 protocol (and aws-sdk-go-v2) entirely: a single authenticated
// HTTP PUT to /accounts/{id}/r2/buckets/{bucket}/objects/{key} is all that's
// needed. Configuration comes from four env vars set on the gateway:
//
//   CLOUDFLARE_R2_API_TOKEN     CF API token with R2 object write permission
//   CLOUDFLARE_R2_ACCOUNT_ID    CF account ID
//   CLOUDFLARE_R2_BUCKET        bucket name (e.g. "image-cache")
//   CLOUDFLARE_R2_PUBLIC_BASE   public base URL for built URLs (e.g. "https://cdn.opwan.ai")
//
// If any of these are missing, R2 upload is disabled and the caller should
// fall back to inline base64 / data:URI delivery.

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
)

type R2Config struct {
	APIToken   string
	AccountID  string
	Bucket     string
	PublicBase string
}

func LoadR2Config() R2Config {
	return R2Config{
		APIToken:   common.GetEnvOrDefaultString("CLOUDFLARE_R2_API_TOKEN", ""),
		AccountID:  common.GetEnvOrDefaultString("CLOUDFLARE_R2_ACCOUNT_ID", ""),
		Bucket:     common.GetEnvOrDefaultString("CLOUDFLARE_R2_BUCKET", ""),
		PublicBase: strings.TrimRight(common.GetEnvOrDefaultString("CLOUDFLARE_R2_PUBLIC_BASE", ""), "/"),
	}
}

func (c R2Config) Enabled() bool {
	return c.APIToken != "" && c.AccountID != "" && c.Bucket != ""
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
		return "", fmt.Errorf("R2 not configured (set CLOUDFLARE_R2_API_TOKEN/ACCOUNT_ID/BUCKET)")
	}
	url := fmt.Sprintf(
		"https://api.cloudflare.com/client/v4/accounts/%s/r2/buckets/%s/objects/%s",
		c.AccountID, c.Bucket, key,
	)
	reqCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(reqCtx, "PUT", url, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+c.APIToken)
	req.Header.Set("Content-Type", contentType)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("R2 PUT failed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		errBody, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return "", fmt.Errorf("R2 PUT %d: %s", resp.StatusCode, string(errBody))
	}
	if c.PublicBase == "" {
		return "", fmt.Errorf("R2 public base URL not set")
	}
	return c.PublicBase + "/" + key, nil
}

// PutImageDeduped sha256-keys the bytes, uploads under images/<hash>.<ext>,
// and returns the public URL. Using the content hash as the key means
// re-running an identical generation reuses the same R2 object instead of
// burning storage on duplicates.
func (c R2Config) PutImageDeduped(ctx context.Context, raw []byte, claimedFormat string) (string, string, error) {
	ext := InferImageExt(claimedFormat, raw)
	hash := sha256.Sum256(raw)
	key := "images/" + hex.EncodeToString(hash[:]) + "." + ext
	url, err := c.PutObject(ctx, key, MimeForExt(ext), raw)
	return url, ext, err
}
