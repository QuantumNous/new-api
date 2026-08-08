package sign

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"
)

const (
	Algorithm = "HMAC-SHA256"
)

// Credentials holds Volcengine Access Key pair.
type Credentials struct {
	AccessKeyID     string
	SecretAccessKey string
	Region          string
	Service         string
}

// SignRequest signs an HTTP request with Volcengine Signature V4.
// body must be the exact bytes that will be sent (may be nil/empty).
func SignRequest(req *http.Request, cred Credentials, body []byte, now time.Time) error {
	if req == nil {
		return fmt.Errorf("nil request")
	}
	if strings.TrimSpace(cred.AccessKeyID) == "" || strings.TrimSpace(cred.SecretAccessKey) == "" {
		return fmt.Errorf("empty credentials")
	}
	if cred.Region == "" {
		cred.Region = "cn-beijing"
	}
	if cred.Service == "" {
		cred.Service = "ark"
	}
	if now.IsZero() {
		now = time.Now().UTC()
	} else {
		now = now.UTC()
	}

	if body == nil {
		body = []byte{}
	}
	payloadHash := sha256Hex(body)
	xDate := now.Format("20060102T150405Z")
	shortDate := now.Format("20060102")

	host := req.Host
	if host == "" && req.URL != nil {
		host = req.URL.Host
	}
	req.Header.Set("Host", host)
	req.Header.Set("X-Date", xDate)
	req.Header.Set("X-Content-Sha256", payloadHash)
	if req.Header.Get("Content-Type") == "" && len(body) > 0 {
		req.Header.Set("Content-Type", "application/json")
	}

	signedHeaders := []string{"host", "x-content-sha256", "x-date"}
	if ct := strings.TrimSpace(req.Header.Get("Content-Type")); ct != "" {
		signedHeaders = append(signedHeaders, "content-type")
	}
	sort.Strings(signedHeaders)

	canonicalHeaders := strings.Builder{}
	for _, h := range signedHeaders {
		var val string
		switch h {
		case "host":
			val = host
		default:
			val = req.Header.Get(h)
		}
		canonicalHeaders.WriteString(h)
		canonicalHeaders.WriteString(":")
		canonicalHeaders.WriteString(strings.TrimSpace(val))
		canonicalHeaders.WriteString("\n")
	}

	canonicalQuery := canonicalQueryString(req.URL.Query())
	path := req.URL.EscapedPath()
	if path == "" {
		path = "/"
	}

	canonicalRequest := strings.Join([]string{
		req.Method,
		path,
		canonicalQuery,
		canonicalHeaders.String(),
		strings.Join(signedHeaders, ";"),
		payloadHash,
	}, "\n")

	credentialScope := fmt.Sprintf("%s/%s/%s/request", shortDate, cred.Region, cred.Service)
	stringToSign := strings.Join([]string{
		Algorithm,
		xDate,
		credentialScope,
		sha256Hex([]byte(canonicalRequest)),
	}, "\n")

	signingKey := deriveSigningKey(cred.SecretAccessKey, shortDate, cred.Region, cred.Service)
	signature := hex.EncodeToString(hmacSHA256(signingKey, []byte(stringToSign)))

	auth := fmt.Sprintf("%s Credential=%s/%s, SignedHeaders=%s, Signature=%s",
		Algorithm,
		cred.AccessKeyID,
		credentialScope,
		strings.Join(signedHeaders, ";"),
		signature,
	)
	req.Header.Set("Authorization", auth)
	return nil
}

func canonicalQueryString(values url.Values) string {
	if len(values) == 0 {
		return ""
	}
	keys := make([]string, 0, len(values))
	for k := range values {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	parts := make([]string, 0, len(keys))
	for _, k := range keys {
		vs := values[k]
		sort.Strings(vs)
		for _, v := range vs {
			parts = append(parts, url.QueryEscape(k)+"="+url.QueryEscape(v))
		}
	}
	// Volc uses %20 for space in query encoding; Go QueryEscape uses +.
	return strings.ReplaceAll(strings.Join(parts, "&"), "+", "%20")
}

func deriveSigningKey(secret, shortDate, region, service string) []byte {
	kDate := hmacSHA256([]byte(secret), []byte(shortDate))
	kRegion := hmacSHA256(kDate, []byte(region))
	kService := hmacSHA256(kRegion, []byte(service))
	return hmacSHA256(kService, []byte("request"))
}

func hmacSHA256(key, data []byte) []byte {
	m := hmac.New(sha256.New, key)
	_, _ = m.Write(data)
	return m.Sum(nil)
}

func sha256Hex(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}
