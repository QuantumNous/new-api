package claude_platform_on_aws

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"
	"time"
)

// AwsCredentials holds the credential triplet required for SigV4 signing.
// SessionToken is only present when temporary credentials (STS / SSO / IRSA)
// are used.
type AwsCredentials struct {
	AccessKeyID     string
	SecretAccessKey string
	SessionToken    string
}

// parseSigV4ApiKey parses the credentials stored in the channel's ApiKey field.
//
// Accepted formats:
//   - "<AK>|<SK>"                         long-term IAM user credentials
//   - "<AK>|<SK>|<SessionToken>"          temporary (STS / SSO / IRSA) credentials
//
// This mirrors the AWS Bedrock channel's ApiKey parsing convention
// (which uses "<key>|<region>").
func parseSigV4ApiKey(apiKey string) (AwsCredentials, error) {
	parts := strings.Split(apiKey, "|")
	switch len(parts) {
	case 2:
		ak := strings.TrimSpace(parts[0])
		sk := strings.TrimSpace(parts[1])
		if ak == "" || sk == "" {
			return AwsCredentials{}, errors.New("invalid sigv4 api key: access key id and secret access key are required")
		}
		return AwsCredentials{AccessKeyID: ak, SecretAccessKey: sk}, nil
	case 3:
		ak := strings.TrimSpace(parts[0])
		sk := strings.TrimSpace(parts[1])
		token := strings.TrimSpace(parts[2])
		if ak == "" || sk == "" || token == "" {
			return AwsCredentials{}, errors.New("invalid sigv4 api key: access key id, secret access key and session token are required")
		}
		return AwsCredentials{AccessKeyID: ak, SecretAccessKey: sk, SessionToken: token}, nil
	default:
		return AwsCredentials{}, errors.New("invalid sigv4 api key, expected '<AK>|<SK>' or '<AK>|<SK>|<SessionToken>'")
	}
}

// signRequestSigV4 signs an *http.Request with AWS Signature Version 4 and
// mutates req.Header in place.
//
// Implementation follows the AWS official spec at
// https://docs.aws.amazon.com/general/latest/gr/sigv4_signing.html
//
// Note: the body must be available for the entire signing pass. Callers
// must arrange this (typically via readAllAndReset which both returns the
// payload bytes and re-installs req.Body / req.GetBody).
func signRequestSigV4(req *http.Request, body []byte, creds AwsCredentials, region, service string, signTime time.Time) error {
	if req == nil {
		return errors.New("nil request")
	}
	if creds.AccessKeyID == "" || creds.SecretAccessKey == "" {
		return errors.New("missing aws credentials")
	}
	if region == "" {
		return errors.New("missing aws region")
	}
	if service == "" {
		return errors.New("missing aws service")
	}

	signTime = signTime.UTC()
	amzDate := signTime.Format("20060102T150405Z")
	dateStamp := signTime.Format("20060102")

	// Canonical host
	host := req.Host
	if host == "" {
		host = req.URL.Host
	}

	// Required headers for SigV4 — set before computing the canonical request.
	req.Header.Set("Host", host)
	req.Header.Set("X-Amz-Date", amzDate)
	if creds.SessionToken != "" {
		req.Header.Set("X-Amz-Security-Token", creds.SessionToken)
	}

	// Hashed payload — the SigV4 spec uses lower-case hex sha256 of the body.
	// Note: we do NOT set X-Amz-Content-Sha256 as a header. That header is
	// only signed for S3-style requests; for normal services like
	// aws-external-anthropic the AWS reference signer leaves it out. The
	// hash still feeds into the canonical request via the trailing field.
	payloadHash := hashSHA256Hex(body)

	canonicalURIv := canonicalURI(req.URL.Path)
	canonicalQueryv := canonicalQuery(req.URL.RawQuery)
	canonicalHeadersv, signedHeaders := canonicalHeaders(req.Header, host)

	canonicalRequest := strings.Join([]string{
		req.Method,
		canonicalURIv,
		canonicalQueryv,
		canonicalHeadersv,
		signedHeaders,
		payloadHash,
	}, "\n")

	credentialScope := fmt.Sprintf("%s/%s/%s/aws4_request", dateStamp, region, service)
	stringToSign := strings.Join([]string{
		"AWS4-HMAC-SHA256",
		amzDate,
		credentialScope,
		hashSHA256Hex([]byte(canonicalRequest)),
	}, "\n")

	signingKey := deriveSigningKey(creds.SecretAccessKey, dateStamp, region, service)
	signature := hex.EncodeToString(hmacSHA256(signingKey, []byte(stringToSign)))

	authorization := fmt.Sprintf(
		"AWS4-HMAC-SHA256 Credential=%s/%s, SignedHeaders=%s, Signature=%s",
		creds.AccessKeyID, credentialScope, signedHeaders, signature,
	)
	req.Header.Set("Authorization", authorization)
	return nil
}

// canonicalURI percent-encodes the URL path per the SigV4 spec, but does
// NOT encode '/'. Our target endpoint path is just "/v1/messages", which
// makes a simple segment-by-segment encoding sufficient.
func canonicalURI(path string) string {
	if path == "" {
		return "/"
	}
	segments := strings.Split(path, "/")
	for i, seg := range segments {
		segments[i] = awsURIEscape(seg, false)
	}
	return strings.Join(segments, "/")
}

// canonicalQuery sorts the query string parameters and percent-encodes
// each key and value separately, then joins them with '&'.
func canonicalQuery(rawQuery string) string {
	if rawQuery == "" {
		return ""
	}
	pairs := strings.Split(rawQuery, "&")
	type kv struct{ k, v string }
	parsed := make([]kv, 0, len(pairs))
	for _, p := range pairs {
		if p == "" {
			continue
		}
		eq := strings.IndexByte(p, '=')
		if eq < 0 {
			parsed = append(parsed, kv{k: awsURIEscape(p, true), v: ""})
		} else {
			parsed = append(parsed, kv{
				k: awsURIEscape(p[:eq], true),
				v: awsURIEscape(p[eq+1:], true),
			})
		}
	}
	sort.Slice(parsed, func(i, j int) bool {
		if parsed[i].k == parsed[j].k {
			return parsed[i].v < parsed[j].v
		}
		return parsed[i].k < parsed[j].k
	})
	out := make([]string, len(parsed))
	for i, p := range parsed {
		out[i] = p.k + "=" + p.v
	}
	return strings.Join(out, "&")
}

// canonicalHeaders returns (canonicalHeaders, signedHeaders) per the SigV4
// rules: lower-case header names, sorted by name, internal whitespace
// collapsed, formatted as "header:value\n" lines and joined.
func canonicalHeaders(h http.Header, host string) (string, string) {
	type kv struct {
		key   string
		value string
	}
	pairs := make([]kv, 0, len(h)+1)

	// host is handled explicitly so that it is always signed.
	pairs = append(pairs, kv{key: "host", value: trimAllWS(host)})

	for name, values := range h {
		lower := strings.ToLower(name)
		if lower == "host" {
			continue // already added
		}
		// SigV4 minimally requires host + x-amz-* + content-type. We adopt a
		// safe default: sign every header except the ones below.
		if lower == "authorization" {
			continue
		}
		// Combine multiple values with ", ", then collapse internal whitespace.
		val := strings.Join(values, ",")
		pairs = append(pairs, kv{key: lower, value: trimAllWS(val)})
	}

	// Sort by key, merge values for duplicate keys.
	sort.Slice(pairs, func(i, j int) bool { return pairs[i].key < pairs[j].key })
	merged := pairs[:0]
	for _, p := range pairs {
		if len(merged) > 0 && merged[len(merged)-1].key == p.key {
			merged[len(merged)-1].value += "," + p.value
			continue
		}
		merged = append(merged, p)
	}

	var canon bytes.Buffer
	signedKeys := make([]string, len(merged))
	for i, p := range merged {
		canon.WriteString(p.key)
		canon.WriteByte(':')
		canon.WriteString(p.value)
		canon.WriteByte('\n')
		signedKeys[i] = p.key
	}
	return canon.String(), strings.Join(signedKeys, ";")
}

// awsURIEscape implements RFC 3986 percent-encoding per the AWS SigV4
// spec. Unencoded characters are A-Z a-z 0-9 - _ . ~ . If isQuery is false,
// '/' is also left unencoded (used for path segments).
func awsURIEscape(s string, isQuery bool) string {
	var b strings.Builder
	b.Grow(len(s))
	for i := 0; i < len(s); i++ {
		c := s[i]
		switch {
		case c >= 'A' && c <= 'Z',
			c >= 'a' && c <= 'z',
			c >= '0' && c <= '9',
			c == '-', c == '_', c == '.', c == '~':
			b.WriteByte(c)
		case c == '/' && !isQuery:
			b.WriteByte(c)
		default:
			b.WriteString(fmt.Sprintf("%%%02X", c))
		}
	}
	return b.String()
}

// trimAllWS collapses runs of whitespace to a single space and trims the
// ends. SigV4 requires that header values have internal whitespace
// collapsed (outside of quoted regions) so that signing is deterministic.
func trimAllWS(s string) string {
	s = strings.TrimSpace(s)
	if !strings.ContainsAny(s, " \t") {
		return s
	}
	var b strings.Builder
	prevSpace := false
	for _, r := range s {
		if r == ' ' || r == '\t' {
			if !prevSpace {
				b.WriteByte(' ')
				prevSpace = true
			}
			continue
		}
		prevSpace = false
		b.WriteRune(r)
	}
	return b.String()
}

// hashSHA256Hex returns the lower-case hex SHA-256 digest of data.
// SigV4 uses this for both the canonical request hash and the payload
// hash.
func hashSHA256Hex(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

// hmacSHA256 returns HMAC-SHA256(key, data). Used as the building block
// for the SigV4 signing key derivation chain.
func hmacSHA256(key, data []byte) []byte {
	h := hmac.New(sha256.New, key)
	h.Write(data)
	return h.Sum(nil)
}

// deriveSigningKey computes the SigV4 signing key by chaining HMAC-SHA256
// over date, region, service and the literal "aws4_request", as defined
// by the AWS Signature Version 4 specification:
//
//	kDate    = HMAC("AWS4" + secret, dateStamp)
//	kRegion  = HMAC(kDate,    region)
//	kService = HMAC(kRegion,  service)
//	kSigning = HMAC(kService, "aws4_request")
func deriveSigningKey(secretKey, dateStamp, region, service string) []byte {
	kDate := hmacSHA256([]byte("AWS4"+secretKey), []byte(dateStamp))
	kRegion := hmacSHA256(kDate, []byte(region))
	kService := hmacSHA256(kRegion, []byte(service))
	return hmacSHA256(kService, []byte("aws4_request"))
}

// readAllAndReset reads the request body once (for SigV4 payload hashing)
// and re-installs it on the request so that subsequent client.Do can read
// it again. Returns nil bytes for bodyless requests (e.g. GET).
func readAllAndReset(req *http.Request) ([]byte, error) {
	if req.Body == nil {
		return nil, nil
	}
	data, err := io.ReadAll(req.Body)
	if err != nil {
		return nil, err
	}
	_ = req.Body.Close()
	req.Body = io.NopCloser(bytes.NewReader(data))
	req.GetBody = func() (io.ReadCloser, error) {
		return io.NopCloser(bytes.NewReader(data)), nil
	}
	req.ContentLength = int64(len(data))
	return data, nil
}
