/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
package service

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
)

var r2AccountID string
var r2AccessKeyID string
var r2SecretAccessKey string
var r2BucketName string
var r2PublicURL string
var r2Endpoint string
var r2Initialized bool

// InitR2Storage initializes the Cloudflare R2 client
func InitR2Storage() error {
	r2AccountID = os.Getenv("R2_ACCOUNT_ID")
	r2AccessKeyID = os.Getenv("R2_ACCESS_KEY_ID")
	r2SecretAccessKey = os.Getenv("R2_SECRET_ACCESS_KEY")
	r2BucketName = os.Getenv("R2_BUCKET_NAME")
	r2PublicURL = os.Getenv("R2_PUBLIC_URL")

	if r2AccountID == "" || r2AccessKeyID == "" || r2SecretAccessKey == "" || r2BucketName == "" {
		return fmt.Errorf("R2 storage not configured: missing environment variables (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME)")
	}

	r2Endpoint = fmt.Sprintf("https://%s.r2.cloudflarestorage.com", r2AccountID)
	r2Initialized = true

	return nil
}

// IsR2Configured returns true if R2 storage is properly configured
func IsR2Configured() bool {
	return r2Initialized
}

// UploadToR2 uploads a file to Cloudflare R2 and returns the public URL
func UploadToR2(reader io.ReadSeeker, filename string, contentType string) (string, error) {
	if !r2Initialized {
		return "", fmt.Errorf("R2 storage is not configured")
	}

	// Generate unique key
	now := time.Now()
	ext := filepath.Ext(filename)
	key := fmt.Sprintf("uploads/%d/%02d/%s%s", now.Year(), now.Month(), uuid.New().String(), ext)

	// Read body
	body, err := io.ReadAll(reader)
	if err != nil {
		return "", fmt.Errorf("failed to read file: %w", err)
	}

	// Create S3 PUT request with AWS Signature V4
	url := fmt.Sprintf("%s/%s/%s", r2Endpoint, r2BucketName, key)
	req, err := http.NewRequest("PUT", url, strings.NewReader(string(body)))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", contentType)

	// Sign the request with AWS Signature V4
	signR2Request(req, body, key)

	// Execute
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to upload to R2: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		respBody, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("R2 upload failed with status %d: %s", resp.StatusCode, string(respBody))
	}

	// Build public URL
	publicURL := buildR2PublicURL(key)
	return publicURL, nil
}

// DeleteFromR2 deletes a file from R2
func DeleteFromR2(key string) error {
	if !r2Initialized {
		return fmt.Errorf("R2 storage is not configured")
	}

	url := fmt.Sprintf("%s/%s/%s", r2Endpoint, r2BucketName, key)
	req, err := http.NewRequest("DELETE", url, nil)
	if err != nil {
		return err
	}

	signR2Request(req, nil, key)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	return nil
}

// signR2Request signs an HTTP request with AWS Signature V4 for R2
func signR2Request(req *http.Request, payload []byte, key string) {
	now := time.Now().UTC()
	dateStamp := now.Format("20060102")
	amzDate := now.Format("20060102T150405Z")
	region := "auto"
	service := "s3"

	// Payload hash
	payloadHash := sha256Hex(payload)

	req.Header.Set("x-amz-date", amzDate)
	req.Header.Set("x-amz-content-sha256", payloadHash)
	req.Header.Set("host", req.URL.Host)

	// Canonical request
	canonicalURI := "/" + r2BucketName + "/" + key
	canonicalQueryString := ""
	canonicalHeaders := fmt.Sprintf("host:%s\nx-amz-content-sha256:%s\nx-amz-date:%s\n",
		req.URL.Host, payloadHash, amzDate)
	if req.Header.Get("Content-Type") != "" {
		canonicalHeaders = fmt.Sprintf("content-type:%s\nhost:%s\nx-amz-content-sha256:%s\nx-amz-date:%s\n",
			req.Header.Get("Content-Type"), req.URL.Host, payloadHash, amzDate)
	}

	signedHeaders := "host;x-amz-content-sha256;x-amz-date"
	if req.Header.Get("Content-Type") != "" {
		signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date"
	}

	canonicalRequest := fmt.Sprintf("%s\n%s\n%s\n%s\n%s\n%s",
		req.Method, canonicalURI, canonicalQueryString, canonicalHeaders, signedHeaders, payloadHash)

	// String to sign
	credentialScope := fmt.Sprintf("%s/%s/%s/aws4_request", dateStamp, region, service)
	stringToSign := fmt.Sprintf("AWS4-HMAC-SHA256\n%s\n%s\n%s",
		amzDate, credentialScope, sha256Hex([]byte(canonicalRequest)))

	// Signing key
	signingKey := getSignatureKey(r2SecretAccessKey, dateStamp, region, service)
	signature := hmacSHA256Hex(signingKey, []byte(stringToSign))

	// Authorization header
	authHeader := fmt.Sprintf("AWS4-HMAC-SHA256 Credential=%s/%s, SignedHeaders=%s, Signature=%s",
		r2AccessKeyID, credentialScope, signedHeaders, signature)

	req.Header.Set("Authorization", authHeader)
}

func sha256Hex(data []byte) string {
	hash := sha256.Sum256(data)
	return hex.EncodeToString(hash[:])
}

func hmacSHA256(key, data []byte) []byte {
	h := hmac.New(sha256.New, key)
	h.Write(data)
	return h.Sum(nil)
}

func hmacSHA256Hex(key, data []byte) string {
	return hex.EncodeToString(hmacSHA256(key, data))
}

func getSignatureKey(secretKey, dateStamp, region, svc string) []byte {
	kDate := hmacSHA256([]byte("AWS4"+secretKey), []byte(dateStamp))
	kRegion := hmacSHA256(kDate, []byte(region))
	kService := hmacSHA256(kRegion, []byte(svc))
	kSigning := hmacSHA256(kService, []byte("aws4_request"))
	return kSigning
}

// buildR2PublicURL constructs the public URL for a given key
func buildR2PublicURL(key string) string {
	if r2PublicURL != "" {
		url := strings.TrimRight(r2PublicURL, "/")
		return fmt.Sprintf("%s/%s", url, key)
	}
	// Fallback: use r2.dev subdomain
	return fmt.Sprintf("https://%s.r2.dev/%s", r2BucketName, key)
}

// ExtractR2Key extracts the R2 object key from a public URL
func ExtractR2Key(publicURL string) string {
	if r2PublicURL != "" {
		prefix := strings.TrimRight(r2PublicURL, "/") + "/"
		if strings.HasPrefix(publicURL, prefix) {
			return strings.TrimPrefix(publicURL, prefix)
		}
	}
	r2DevPrefix := fmt.Sprintf("https://%s.r2.dev/", r2BucketName)
	if strings.HasPrefix(publicURL, r2DevPrefix) {
		return strings.TrimPrefix(publicURL, r2DevPrefix)
	}
	return ""
}
