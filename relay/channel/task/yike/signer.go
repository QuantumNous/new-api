package yike

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"
)

const signatureAlgorithm = "ACS3-HMAC-SHA256"

type v3Signer struct {
	now   func() time.Time
	nonce func() (string, error)
}

func defaultV3Signer() *v3Signer {
	return &v3Signer{
		now:   time.Now,
		nonce: randomNonce,
	}
}

func randomNonce() (string, error) {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}

func (s *v3Signer) sign(req *http.Request, action, version, accessKeyID, accessKeySecret string) error {
	if req == nil || req.URL == nil {
		return fmt.Errorf("request URL is required")
	}
	if strings.TrimSpace(accessKeyID) == "" || strings.TrimSpace(accessKeySecret) == "" {
		return fmt.Errorf("AccessKeyId and AccessKeySecret are required")
	}
	if s == nil {
		s = defaultV3Signer()
	}

	nonce, err := s.nonce()
	if err != nil {
		return fmt.Errorf("generate signature nonce: %w", err)
	}
	// Yike's RPC methods carry all business parameters in the query.
	payloadHash := sha256.Sum256(nil)
	payloadHashHex := hex.EncodeToString(payloadHash[:])

	req.Host = req.URL.Host
	req.Header.Set("x-acs-action", action)
	req.Header.Set("x-acs-version", version)
	req.Header.Set("x-acs-date", s.now().UTC().Format("2006-01-02T15:04:05Z"))
	req.Header.Set("x-acs-signature-nonce", nonce)
	req.Header.Set("x-acs-content-sha256", payloadHashHex)

	signedHeaderNames := []string{
		"host",
		"x-acs-action",
		"x-acs-content-sha256",
		"x-acs-date",
		"x-acs-signature-nonce",
		"x-acs-version",
	}
	var canonicalHeaders strings.Builder
	for _, name := range signedHeaderNames {
		value := req.Header.Get(name)
		if name == "host" {
			value = req.URL.Host
		}
		canonicalHeaders.WriteString(name)
		canonicalHeaders.WriteByte(':')
		canonicalHeaders.WriteString(strings.TrimSpace(value))
		canonicalHeaders.WriteByte('\n')
	}
	signedHeaders := strings.Join(signedHeaderNames, ";")
	canonicalURI := req.URL.EscapedPath()
	if canonicalURI == "" {
		canonicalURI = "/"
	}
	// Alibaba Cloud V3 signs the canonical RPC query together with the payload
	// hash; Yike's payload hash is the SHA-256 of its empty POST body.
	canonicalRequest := strings.Join([]string{
		req.Method,
		canonicalURI,
		canonicalQuery(req.URL.Query()),
		canonicalHeaders.String(),
		signedHeaders,
		payloadHashHex,
	}, "\n")
	canonicalHash := sha256.Sum256([]byte(canonicalRequest))
	stringToSign := signatureAlgorithm + "\n" + hex.EncodeToString(canonicalHash[:])
	signature := hmacSHA256Hex([]byte(accessKeySecret), []byte(stringToSign))

	req.Header.Set("Authorization", fmt.Sprintf(
		"%s Credential=%s,SignedHeaders=%s,Signature=%s",
		signatureAlgorithm,
		accessKeyID,
		signedHeaders,
		signature,
	))
	return nil
}

func canonicalQuery(values url.Values) string {
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	parts := make([]string, 0, len(keys))
	for _, key := range keys {
		items := append([]string(nil), values[key]...)
		sort.Strings(items)
		if len(items) == 0 {
			parts = append(parts, percentEncode(key)+"=")
			continue
		}
		for _, value := range items {
			parts = append(parts, percentEncode(key)+"="+percentEncode(value))
		}
	}
	return strings.Join(parts, "&")
}

func percentEncode(value string) string {
	encoded := url.QueryEscape(value)
	encoded = strings.ReplaceAll(encoded, "+", "%20")
	encoded = strings.ReplaceAll(encoded, "%7E", "~")
	return encoded
}

func hmacSHA256Hex(key, data []byte) string {
	h := hmac.New(sha256.New, key)
	_, _ = h.Write(data)
	return hex.EncodeToString(h.Sum(nil))
}
