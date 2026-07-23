package service

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"mime"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/storage"
)

type AsyncMediaSource struct {
	URL         string
	Base64      string
	ContentType string
}

var blockedArtifactNetworks = mustParseArtifactNetworks(
	"0.0.0.0/8",
	"100.64.0.0/10",
	"192.0.0.0/24",
	"198.18.0.0/15",
	"240.0.0.0/4",
	"::/128",
)

func mustParseArtifactNetworks(values ...string) []*net.IPNet {
	networks := make([]*net.IPNet, 0, len(values))
	for _, value := range values {
		_, network, err := net.ParseCIDR(value)
		if err != nil {
			panic(err)
		}
		networks = append(networks, network)
	}
	return networks
}

func IsPublicArtifactIP(ip net.IP) bool {
	if ip == nil || ip.IsUnspecified() || ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() || ip.IsMulticast() {
		return false
	}
	for _, network := range blockedArtifactNetworks {
		if network.Contains(ip) {
			return false
		}
	}
	return true
}

func validateArtifactURL(raw string) (*url.URL, error) {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || parsed.Hostname() == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return nil, errors.New("artifact URL must be an absolute http or https URL")
	}
	if parsed.User != nil {
		return nil, errors.New("artifact URL credentials are forbidden")
	}
	return parsed, nil
}

func safeArtifactHTTPClient() *http.Client {
	dialer := &net.Dialer{Timeout: 10 * time.Second, KeepAlive: 30 * time.Second}
	transport := &http.Transport{
		Proxy:                 nil,
		ForceAttemptHTTP2:     true,
		TLSHandshakeTimeout:   10 * time.Second,
		ResponseHeaderTimeout: 30 * time.Second,
		IdleConnTimeout:       30 * time.Second,
		MaxIdleConns:          20,
		DialContext: func(ctx context.Context, network, address string) (net.Conn, error) {
			host, port, err := net.SplitHostPort(address)
			if err != nil {
				return nil, err
			}
			addresses, err := net.DefaultResolver.LookupIPAddr(ctx, host)
			if err != nil {
				return nil, err
			}
			for _, address := range addresses {
				if !IsPublicArtifactIP(address.IP) {
					continue
				}
				return dialer.DialContext(ctx, network, net.JoinHostPort(address.IP.String(), port))
			}
			return nil, errors.New("artifact host resolved only to blocked addresses")
		},
	}
	return &http.Client{
		Transport: transport,
		Timeout:   time.Duration(common.GetEnvOrDefault("ASYNC_ARTIFACT_DOWNLOAD_TIMEOUT_SECONDS", 120)) * time.Second,
		CheckRedirect: func(request *http.Request, via []*http.Request) error {
			if len(via) >= 5 {
				return errors.New("too many artifact redirects")
			}
			_, err := validateArtifactURL(request.URL.String())
			return err
		},
	}
}

type materializedArtifact struct {
	file          *os.File
	path          string
	contentType   string
	size          int64
	sha256        string
	sourceURLHash string
}

func (m *materializedArtifact) Close() {
	if m == nil {
		return
	}
	if m.file != nil {
		_ = m.file.Close()
	}
	if m.path != "" {
		_ = os.Remove(m.path)
	}
}

func ArchiveAsyncMedia(ctx context.Context, task *model.Task, sources []AsyncMediaSource, store storage.ArtifactStore, retentionMinutes int) ([]model.Artifact, error) {
	if task == nil || task.ID == 0 || task.TaskID == "" {
		return nil, errors.New("persisted task is required for artifact archiving")
	}
	if store == nil {
		return nil, errors.New("artifact store is required")
	}
	existing, err := model.ListArtifactsByTaskID(ctx, task.ID)
	if err != nil {
		return nil, err
	}
	if len(existing) > 0 {
		return existing, nil
	}
	maxFiles := common.GetEnvOrDefault("ASYNC_ARTIFACT_MAX_FILES", 8)
	if len(sources) == 0 || len(sources) > maxFiles {
		return nil, fmt.Errorf("artifact count must be between 1 and %d", maxFiles)
	}
	if retentionMinutes <= 0 {
		retentionMinutes = dto.AsyncRetentionDefaultMinutes
	}
	retentionMinutes = dto.NormalizeAsyncRetentionMinutes(retentionMinutes)
	maxSingle := int64(common.GetEnvOrDefault("ASYNC_ARTIFACT_MAX_FILE_MB", 25)) * 1024 * 1024
	maxTotal := int64(common.GetEnvOrDefault("ASYNC_ARTIFACT_MAX_TOTAL_MB", 100)) * 1024 * 1024
	if maxSingle <= 0 || maxTotal <= 0 {
		return nil, errors.New("artifact size limits must be positive")
	}

	uploaded := make([]string, 0, len(sources))
	artifacts := make([]model.Artifact, 0, len(sources))
	cleanupUploads := func() {
		for _, key := range uploaded {
			_ = store.Delete(context.Background(), key)
		}
	}
	total := int64(0)
	for index, source := range sources {
		materialized, err := materializeAsyncArtifact(ctx, source, maxSingle, index)
		if err != nil {
			cleanupUploads()
			return nil, err
		}
		total += materialized.size
		if total > maxTotal {
			materialized.Close()
			cleanupUploads()
			return nil, fmt.Errorf("artifact total exceeds %d bytes", maxTotal)
		}
		extension := extensionForArtifactMIME(materialized.contentType)
		objectKey := fmt.Sprintf("async/%s/%02d-%s%s", task.TaskID, index, materialized.sha256[:16], extension)
		if _, err := materialized.file.Seek(0, io.SeekStart); err != nil {
			materialized.Close()
			cleanupUploads()
			return nil, err
		}
		if err := store.Put(ctx, objectKey, materialized.file, materialized.contentType); err != nil {
			materialized.Close()
			cleanupUploads()
			return nil, err
		}
		uploaded = append(uploaded, objectKey)
		artifacts = append(artifacts, model.Artifact{
			TaskID:        task.ID,
			ObjectKey:     objectKey,
			ContentType:   materialized.contentType,
			SizeBytes:     materialized.size,
			SHA256:        materialized.sha256,
			SourceURLHash: materialized.sourceURLHash,
			ExpiresAt:     time.Now().Add(time.Duration(retentionMinutes) * time.Minute).Unix(),
		})
		materialized.Close()
	}
	if err := model.CreateArtifacts(ctx, artifacts); err != nil {
		cleanupUploads()
		return nil, err
	}
	return artifacts, nil
}

func materializeAsyncArtifact(ctx context.Context, source AsyncMediaSource, maxBytes int64, index int) (*materializedArtifact, error) {
	file, err := os.CreateTemp("", "new-api-async-artifact-*")
	if err != nil {
		return nil, err
	}
	result := &materializedArtifact{file: file, path: file.Name()}
	failed := true
	defer func() {
		if failed {
			result.Close()
		}
	}()

	var reader io.ReadCloser
	declaredType := strings.TrimSpace(source.ContentType)
	sourceIdentity := fmt.Sprintf("inline:%d", index)
	if source.URL != "" {
		parsed, err := validateArtifactURL(source.URL)
		if err != nil {
			return nil, err
		}
		request, err := http.NewRequestWithContext(ctx, http.MethodGet, parsed.String(), nil)
		if err != nil {
			return nil, err
		}
		request.Header.Set("Accept", "image/avif,image/webp,image/png,image/jpeg,image/gif")
		response, err := safeArtifactHTTPClient().Do(request)
		if err != nil {
			return nil, err
		}
		if response.StatusCode != http.StatusOK {
			_ = response.Body.Close()
			return nil, fmt.Errorf("artifact download returned HTTP %d", response.StatusCode)
		}
		if response.ContentLength > maxBytes {
			_ = response.Body.Close()
			return nil, fmt.Errorf("artifact exceeds %d bytes", maxBytes)
		}
		reader = response.Body
		declaredType = response.Header.Get("Content-Type")
		sourceIdentity = parsed.String()
	} else if source.Base64 != "" {
		encoded := strings.TrimSpace(source.Base64)
		decoder := base64.NewDecoder(base64.StdEncoding, strings.NewReader(encoded))
		reader = io.NopCloser(decoder)
	} else {
		return nil, errors.New("artifact source has neither URL nor base64 data")
	}
	defer reader.Close()

	hasher := sha256.New()
	written, err := io.Copy(io.MultiWriter(file, hasher), io.LimitReader(reader, maxBytes+1))
	if err != nil {
		return nil, err
	}
	if written > maxBytes {
		return nil, fmt.Errorf("artifact exceeds %d bytes", maxBytes)
	}
	if written == 0 {
		return nil, errors.New("artifact is empty")
	}
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return nil, err
	}
	probe := make([]byte, 512)
	n, readErr := file.Read(probe)
	if readErr != nil && !errors.Is(readErr, io.EOF) {
		return nil, readErr
	}
	detected := detectArtifactMIME(probe[:n])
	contentType, _, _ := mime.ParseMediaType(declaredType)
	if !allowedArtifactMIME(detected) {
		return nil, fmt.Errorf("artifact content is not an allowed raster image (%s)", detected)
	}
	if contentType != "" && contentType != "application/octet-stream" && contentType != detected {
		return nil, fmt.Errorf("artifact MIME type %s does not match detected content %s", contentType, detected)
	}
	contentType = detected

	sourceHash := sha256.Sum256([]byte(sourceIdentity))
	result.contentType = contentType
	result.size = written
	result.sha256 = hex.EncodeToString(hasher.Sum(nil))
	result.sourceURLHash = hex.EncodeToString(sourceHash[:])
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return nil, err
	}
	failed = false
	return result, nil
}

func detectArtifactMIME(probe []byte) string {
	detected := http.DetectContentType(probe)
	if detected == "application/octet-stream" && len(probe) >= 12 && bytes.Equal(probe[4:8], []byte("ftyp")) {
		brand := string(probe[8:12])
		if brand == "avif" || brand == "avis" {
			return "image/avif"
		}
	}
	return detected
}

func allowedArtifactMIME(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "image/jpeg", "image/png", "image/webp", "image/gif", "image/avif":
		return true
	default:
		return false
	}
}

func extensionForArtifactMIME(value string) string {
	switch value {
	case "image/jpeg":
		return ".jpg"
	case "image/png":
		return ".png"
	case "image/webp":
		return ".webp"
	case "image/gif":
		return ".gif"
	case "image/avif":
		return ".avif"
	default:
		return filepath.Ext("artifact")
	}
}

func ParseDataURLSource(raw string) (AsyncMediaSource, bool) {
	if !strings.HasPrefix(raw, "data:") {
		return AsyncMediaSource{}, false
	}
	comma := strings.IndexByte(raw, ',')
	if comma < 0 {
		return AsyncMediaSource{}, false
	}
	metadata := strings.TrimPrefix(raw[:comma], "data:")
	parts := strings.Split(metadata, ";")
	if len(parts) < 2 || parts[len(parts)-1] != "base64" || !allowedArtifactMIME(parts[0]) {
		return AsyncMediaSource{}, false
	}
	return AsyncMediaSource{Base64: raw[comma+1:], ContentType: parts[0]}, true
}

func ParseRetryAfter(value string, maximum time.Duration) time.Duration {
	value = strings.TrimSpace(value)
	if value == "" {
		return 0
	}
	if seconds, err := strconv.Atoi(value); err == nil && seconds >= 0 {
		delay := time.Duration(seconds) * time.Second
		if delay > maximum {
			return maximum
		}
		return delay
	}
	if parsed, err := http.ParseTime(value); err == nil {
		delay := time.Until(parsed)
		if delay < 0 {
			return 0
		}
		if delay > maximum {
			return maximum
		}
		return delay
	}
	return 0
}
