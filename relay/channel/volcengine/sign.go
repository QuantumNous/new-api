package volcengine

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type PlanCredential struct {
	APIKey    string
	AccessKey string
	SecretKey string
}

func (credential PlanCredential) HasManagementCredential() bool {
	return credential.AccessKey != "" && credential.SecretKey != ""
}

func ParsePlanCredential(rawCredential string) (PlanCredential, error) {
	parts := strings.Split(rawCredential, "|")
	if len(parts) != 1 && len(parts) != 3 {
		return PlanCredential{}, errors.New("invalid VolcEngine Plan credential format: expected PlanAPIKey or PlanAPIKey|AccessKey|SecretKey")
	}

	credential := PlanCredential{APIKey: strings.TrimSpace(parts[0])}
	if credential.APIKey == "" {
		return PlanCredential{}, errors.New("VolcEngine Plan API key is required")
	}
	if len(parts) == 1 {
		return credential, nil
	}

	credential.AccessKey = strings.TrimSpace(parts[1])
	credential.SecretKey = strings.TrimSpace(parts[2])
	if !credential.HasManagementCredential() {
		return PlanCredential{}, errors.New("VolcEngine AccessKey and SecretKey are required")
	}
	return credential, nil
}

func SignRequest(request *http.Request, accessKey string, secretKey string, region string, serviceName string) error {
	return signRequestAt(request, accessKey, secretKey, region, serviceName, time.Now().UTC())
}

func signRequestAt(request *http.Request, accessKey string, secretKey string, region string, serviceName string, now time.Time) error {
	if request == nil || request.URL == nil {
		return errors.New("VolcEngine request is required")
	}
	accessKey = strings.TrimSpace(accessKey)
	secretKey = strings.TrimSpace(secretKey)
	region = strings.TrimSpace(region)
	serviceName = strings.TrimSpace(serviceName)
	if accessKey == "" || secretKey == "" || region == "" || serviceName == "" {
		return errors.New("VolcEngine signing credentials, region, and service are required")
	}

	body := []byte{}
	if request.Body != nil {
		var err error
		body, err = io.ReadAll(request.Body)
		if err != nil {
			return fmt.Errorf("read VolcEngine request body: %w", err)
		}
		_ = request.Body.Close()
	}
	request.Body = io.NopCloser(bytes.NewReader(body))

	payloadHash := sha256.Sum256(body)
	hexPayloadHash := hex.EncodeToString(payloadHash[:])
	xDate := now.UTC().Format("20060102T150405Z")
	shortDate := now.UTC().Format("20060102")
	host := strings.TrimSpace(request.Host)
	if host == "" {
		host = request.URL.Host
	}
	request.Host = host
	request.Header.Set("Host", host)
	request.Header.Set("X-Date", xDate)
	request.Header.Set("X-Content-Sha256", hexPayloadHash)

	canonicalPath := request.URL.EscapedPath()
	if canonicalPath == "" {
		canonicalPath = "/"
	}
	signedHeaders := "host;x-content-sha256;x-date"
	canonicalHeaders := fmt.Sprintf(
		"host:%s\nx-content-sha256:%s\nx-date:%s\n",
		host,
		hexPayloadHash,
		xDate,
	)
	canonicalRequest := fmt.Sprintf(
		"%s\n%s\n%s\n%s\n%s\n%s",
		request.Method,
		canonicalPath,
		request.URL.Query().Encode(),
		canonicalHeaders,
		signedHeaders,
		hexPayloadHash,
	)
	hashedCanonicalRequest := sha256.Sum256([]byte(canonicalRequest))
	credentialScope := fmt.Sprintf("%s/%s/%s/request", shortDate, region, serviceName)
	stringToSign := fmt.Sprintf(
		"HMAC-SHA256\n%s\n%s\n%s",
		xDate,
		credentialScope,
		hex.EncodeToString(hashedCanonicalRequest[:]),
	)

	kDate := hmacSHA256([]byte(secretKey), []byte(shortDate))
	kRegion := hmacSHA256(kDate, []byte(region))
	kService := hmacSHA256(kRegion, []byte(serviceName))
	kSigning := hmacSHA256(kService, []byte("request"))
	signature := hex.EncodeToString(hmacSHA256(kSigning, []byte(stringToSign)))
	request.Header.Set("Authorization", fmt.Sprintf(
		"HMAC-SHA256 Credential=%s/%s, SignedHeaders=%s, Signature=%s",
		accessKey,
		credentialScope,
		signedHeaders,
		signature,
	))
	return nil
}

func hmacSHA256(key []byte, data []byte) []byte {
	h := hmac.New(sha256.New, key)
	_, _ = h.Write(data)
	return h.Sum(nil)
}
