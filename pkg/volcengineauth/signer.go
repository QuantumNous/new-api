package volcengineauth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"
)

const (
	algorithm     = "HMAC-SHA256"
	signedHeaders = "content-type;host;x-content-sha256;x-date"
)

// Signer signs Volcengine OpenAPI requests. Now may be supplied by tests that
// need a deterministic signature.
type Signer struct {
	AccessKeyID     string
	SecretAccessKey string
	Region          string
	Service         string
	Now             func() time.Time
}

// Sign adds Volcengine HMAC-SHA256 authentication headers. payload must be the
// exact bytes that will be sent as the request body.
func (s Signer) Sign(req *http.Request, payload []byte) error {
	if req == nil || req.URL == nil {
		return errors.New("cannot sign an invalid request")
	}
	if s.AccessKeyID == "" || s.SecretAccessKey == "" || s.Region == "" || s.Service == "" {
		return errors.New("cannot sign request: incomplete credentials or scope")
	}

	host := req.URL.Host
	if host == "" {
		return errors.New("cannot sign request: missing host")
	}
	now := time.Now().UTC()
	if s.Now != nil {
		now = s.Now().UTC()
	}
	xDate := now.Format("20060102T150405Z")
	shortDate := now.Format("20060102")
	payloadHash := sha256Hex(payload)
	contentType := normalizeHeaderValue(req.Header.Get("Content-Type"))
	if contentType == "" {
		contentType = "application/json"
	}

	req.Host = host
	req.Header.Set("Content-Type", contentType)
	req.Header.Set("X-Date", xDate)
	req.Header.Set("X-Content-Sha256", payloadHash)

	canonicalHeaders := strings.Join([]string{
		"content-type:" + contentType,
		"host:" + host,
		"x-content-sha256:" + payloadHash,
		"x-date:" + xDate,
		"",
	}, "\n")
	canonicalPath := req.URL.EscapedPath()
	if canonicalPath == "" {
		canonicalPath = "/"
	}
	canonicalRequest := strings.Join([]string{
		req.Method,
		canonicalPath,
		canonicalQuery(req.URL),
		canonicalHeaders,
		signedHeaders,
		payloadHash,
	}, "\n")
	credentialScope := fmt.Sprintf("%s/%s/%s/request", shortDate, s.Region, s.Service)
	stringToSign := strings.Join([]string{
		algorithm,
		xDate,
		credentialScope,
		sha256Hex([]byte(canonicalRequest)),
	}, "\n")

	kDate := hmacSHA256([]byte(s.SecretAccessKey), shortDate)
	kRegion := hmacSHA256(kDate, s.Region)
	kService := hmacSHA256(kRegion, s.Service)
	kSigning := hmacSHA256(kService, "request")
	signature := hex.EncodeToString(hmacSHA256(kSigning, stringToSign))
	req.Header.Set("Authorization", fmt.Sprintf(
		"%s Credential=%s/%s, SignedHeaders=%s, Signature=%s",
		algorithm,
		s.AccessKeyID,
		credentialScope,
		signedHeaders,
		signature,
	))
	return nil
}

func canonicalQuery(u *url.URL) string {
	query := u.Query()
	keys := make([]string, 0, len(query))
	for key := range query {
		keys = append(keys, key)
	}
	sort.Slice(keys, func(i, j int) bool {
		return percentEncode(keys[i]) < percentEncode(keys[j])
	})

	parts := make([]string, 0, len(query))
	for _, key := range keys {
		encodedKey := percentEncode(key)
		values := append([]string(nil), query[key]...)
		if len(values) == 0 {
			values = []string{""}
		}
		sort.Slice(values, func(i, j int) bool {
			return percentEncode(values[i]) < percentEncode(values[j])
		})
		for _, value := range values {
			parts = append(parts, encodedKey+"="+percentEncode(value))
		}
	}
	return strings.Join(parts, "&")
}

func percentEncode(value string) string {
	return strings.ReplaceAll(url.QueryEscape(value), "+", "%20")
}

func normalizeHeaderValue(value string) string {
	return strings.Join(strings.Fields(value), " ")
}

func sha256Hex(value []byte) string {
	sum := sha256.Sum256(value)
	return hex.EncodeToString(sum[:])
}

func hmacSHA256(key []byte, value string) []byte {
	hash := hmac.New(sha256.New, key)
	_, _ = hash.Write([]byte(value))
	return hash.Sum(nil)
}
