package service

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

// Generated images and videos are copied onto the deployment's own disk as soon
// as a relay reports them. The upstream link is a signed URL that expires within
// a day, so a history row that stored it would turn into a broken thumbnail by
// the next morning. Each deployment keeps its own files: /data is the volume the
// container already mounts, which survives a rebuild of the container image.

const (
	generationMediaDirEnv           = "GENERATION_MEDIA_DIR"
	generationMediaQuotaEnv         = "GENERATION_MEDIA_MAX_MB"
	defaultGenerationMediaQuotaMB   = 4096
	generationMediaMaxBytes         = 200 << 20
	generationMediaMaxRefs          = 8
	generationMediaAccessParameter  = "access"
	generationMediaQuotaCheckWindow = 10 * time.Minute
	generationMediaDownloadTimeout  = 2 * time.Minute
	generationMediaAccessMessageVar = "generation-media"
)

// ErrGenerationMediaInvalid is returned when a stored reference cannot be
// resolved to a file inside the media root, or when its signature does not
// match. Both are caller errors, never server faults.
var ErrGenerationMediaInvalid = errors.New("generation media is invalid")

// GenerationMediaRef points at one image or video in a relay response: either
// an absolute URL the upstream hands out, or an inline base64 payload.
type GenerationMediaRef struct {
	Kind     string // "url" | "base64"
	Value    string
	MimeType string
}

var (
	generationMediaQuotaMu    sync.Mutex
	generationMediaQuotaCheck time.Time
	generationMediaClient     = &http.Client{Timeout: generationMediaDownloadTimeout}
)

// GenerationMediaRoot is the directory that holds every stored generation file.
func GenerationMediaRoot() string {
	if dir := strings.TrimSpace(os.Getenv(generationMediaDirEnv)); dir != "" {
		return dir
	}
	return "/data/generations"
}

func generationMediaQuotaBytes() int64 {
	raw := strings.TrimSpace(os.Getenv(generationMediaQuotaEnv))
	if raw != "" {
		if mb, err := strconv.Atoi(raw); err == nil && mb > 0 {
			return int64(mb) << 20
		}
	}
	return int64(defaultGenerationMediaQuotaMB) << 20
}

// SaveGenerationMedia streams one payload into the media root and returns its
// path relative to that root, which is what a history row stores.
func SaveGenerationMedia(userId int, reader io.Reader, contentType string) (string, int64, error) {
	if reader == nil {
		return "", 0, ErrGenerationMediaInvalid
	}
	dir := filepath.Join(GenerationMediaRoot(), fmt.Sprintf("u%d", userId), time.Now().Format("200601"))
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", 0, err
	}

	name, err := generationMediaRandomName()
	if err != nil {
		return "", 0, err
	}
	partial := filepath.Join(dir, name+".part")
	file, err := os.Create(partial)
	if err != nil {
		return "", 0, err
	}
	written, copyErr := io.Copy(file, io.LimitReader(reader, generationMediaMaxBytes+1))
	closeErr := file.Close()
	if copyErr != nil {
		_ = os.Remove(partial)
		return "", 0, copyErr
	}
	if closeErr != nil {
		_ = os.Remove(partial)
		return "", 0, closeErr
	}
	if written > generationMediaMaxBytes {
		_ = os.Remove(partial)
		return "", 0, fmt.Errorf("generation media exceeds %d bytes", generationMediaMaxBytes)
	}
	if written == 0 {
		_ = os.Remove(partial)
		return "", 0, ErrGenerationMediaInvalid
	}

	ext := generationMediaExtension(contentType)
	if ext == "" {
		ext = generationMediaSniffExtension(partial)
	}
	final := filepath.Join(dir, name+ext)
	if err := os.Rename(partial, final); err != nil {
		_ = os.Remove(partial)
		return "", 0, err
	}

	rel, err := filepath.Rel(GenerationMediaRoot(), final)
	if err != nil {
		return "", 0, err
	}
	enforceGenerationMediaQuota()
	return filepath.ToSlash(rel), written, nil
}

// PersistGenerationMedia copies every reference a relay response carried into
// the media root. References that fail to download are dropped, because a
// partially reachable result must not fail the response the caller already has.
func PersistGenerationMedia(userId int, refs []GenerationMediaRef) []string {
	stored := make([]string, 0, len(refs))
	for _, ref := range refs {
		if len(stored) >= generationMediaMaxRefs {
			break
		}
		rel, err := persistOneGenerationMedia(userId, ref)
		if err != nil {
			common.SysError(common.LogText("failed to store generation media %s: %s",
				common.LocalLogPreview(ref.Kind), err.Error()))
			continue
		}
		if rel != "" {
			stored = append(stored, rel)
		}
	}
	return stored
}

func persistOneGenerationMedia(userId int, ref GenerationMediaRef) (string, error) {
	switch ref.Kind {
	case "base64":
		data, err := decodeGenerationBase64(ref.Value)
		if err != nil {
			return "", err
		}
		rel, _, err := SaveGenerationMedia(userId, strings.NewReader(string(data)), ref.MimeType)
		return rel, err
	case "url":
		request, err := http.NewRequest(http.MethodGet, ref.Value, nil)
		if err != nil {
			return "", err
		}
		response, err := generationMediaClient.Do(request)
		if err != nil {
			return "", err
		}
		defer response.Body.Close()
		if response.StatusCode != http.StatusOK && response.StatusCode != http.StatusPartialContent {
			return "", fmt.Errorf("media download returned %d", response.StatusCode)
		}
		rel, _, err := SaveGenerationMedia(userId, response.Body, response.Header.Get("Content-Type"))
		return rel, err
	default:
		return "", ErrGenerationMediaInvalid
	}
}

func decodeGenerationBase64(value string) ([]byte, error) {
	if strings.HasPrefix(value, "data:") {
		if comma := strings.IndexByte(value, ','); comma >= 0 {
			value = value[comma+1:]
		}
	}
	return base64.StdEncoding.DecodeString(value)
}

// BuildGenerationMediaURL returns the capability URL the browser uses as an
// <img> or <video> source. It carries no session, so it has to travel in the
// query string; the signature binds it to exactly one stored file.
func BuildGenerationMediaURL(relPath string) string {
	relPath = strings.TrimPrefix(filepath.ToSlash(strings.TrimSpace(relPath)), "/")
	if relPath == "" || strings.Contains(relPath, "..") {
		return ""
	}
	segments := strings.Split(relPath, "/")
	for i, segment := range segments {
		segments[i] = urlPathEscape(segment)
	}
	return fmt.Sprintf("/api/generation/media/%s?%s=%s", strings.Join(segments, "/"),
		generationMediaAccessParameter, signGenerationMedia(relPath))
}

// ServeGenerationMedia writes a stored file, honouring Range requests so video
// seeking works. It reports whether the request was answered.
func ServeGenerationMedia(c *gin.Context, relPath string, access string) bool {
	relPath = strings.TrimPrefix(filepath.ToSlash(strings.TrimSpace(relPath)), "/")
	if !VerifyGenerationMediaAccess(access, relPath) {
		c.Status(http.StatusForbidden)
		return true
	}
	fullPath, err := generationMediaAbsolutePath(relPath)
	if err != nil {
		c.Status(http.StatusNotFound)
		return true
	}
	info, err := os.Stat(fullPath)
	if err != nil || info.IsDir() {
		c.Status(http.StatusNotFound)
		return true
	}
	c.Header("Cache-Control", "private, max-age=604800, immutable")
	c.Header("Content-Disposition", "inline")
	http.ServeFile(c.Writer, c.Request, fullPath)
	return true
}

// DeleteGenerationMedia removes the files a history row pointed at. Missing
// files are not an error: the row is going away either way.
func DeleteGenerationMedia(relPaths []string) {
	for _, rel := range relPaths {
		fullPath, err := generationMediaAbsolutePath(rel)
		if err != nil {
			continue
		}
		if err := os.Remove(fullPath); err != nil && !os.IsNotExist(err) {
			common.SysError(common.LogText("failed to delete generation media %s: %s",
				common.LocalLogPreview(rel), err.Error()))
		}
	}
}

func generationMediaAbsolutePath(relPath string) (string, error) {
	relPath = strings.TrimSpace(strings.TrimPrefix(filepath.ToSlash(relPath), "/"))
	if relPath == "" || strings.Contains(relPath, "..") {
		return "", ErrGenerationMediaInvalid
	}
	root, err := filepath.Abs(GenerationMediaRoot())
	if err != nil {
		return "", err
	}
	fullPath, err := filepath.Abs(filepath.Join(root, filepath.FromSlash(relPath)))
	if err != nil {
		return "", err
	}
	if fullPath != root && !strings.HasPrefix(fullPath, root+string(os.PathSeparator)) {
		return "", ErrGenerationMediaInvalid
	}
	return fullPath, nil
}

func generationMediaSecret() string {
	if common.CryptoSecret != "" {
		return common.CryptoSecret
	}
	return common.SessionSecret
}

func signGenerationMedia(relPath string) string {
	mac := hmac.New(sha256.New, []byte(generationMediaSecret()))
	_, _ = mac.Write([]byte(generationMediaAccessMessageVar + "\x00" + relPath))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

// VerifyGenerationMediaAccess compares the capability signature in constant
// time. An empty signature is always rejected.
func VerifyGenerationMediaAccess(access, relPath string) bool {
	access = strings.TrimSpace(access)
	if access == "" || relPath == "" {
		return false
	}
	expected, err := base64.RawURLEncoding.DecodeString(signGenerationMedia(relPath))
	if err != nil || len(expected) != sha256.Size {
		return false
	}
	actual, err := base64.RawURLEncoding.DecodeString(access)
	if err != nil {
		return false
	}
	return hmac.Equal(actual, expected)
}

// enforceGenerationMediaQuota keeps the media root from filling the disk of a
// deployment that nobody prunes. Oldest files go first; the newest 10% headroom
// stops a single upload from triggering another sweep immediately.
func enforceGenerationMediaQuota() {
	generationMediaQuotaMu.Lock()
	defer generationMediaQuotaMu.Unlock()
	if time.Since(generationMediaQuotaCheck) < generationMediaQuotaCheckWindow {
		return
	}
	generationMediaQuotaCheck = time.Now()

	type fileEntry struct {
		path string
		size int64
		mod  time.Time
	}
	entries := make([]fileEntry, 0, 256)
	var total int64
	_ = filepath.WalkDir(GenerationMediaRoot(), func(path string, entry os.DirEntry, walkErr error) error {
		if walkErr != nil || entry.IsDir() {
			return nil
		}
		info, err := entry.Info()
		if err != nil {
			return nil
		}
		entries = append(entries, fileEntry{path: path, size: info.Size(), mod: info.ModTime()})
		total += info.Size()
		return nil
	})

	limit := generationMediaQuotaBytes()
	if total <= limit {
		return
	}
	sort.Slice(entries, func(i, j int) bool { return entries[i].mod.Before(entries[j].mod) })
	target := limit - limit/10
	for _, entry := range entries {
		if total <= target {
			break
		}
		if err := os.Remove(entry.path); err != nil {
			continue
		}
		total -= entry.size
	}
}

func generationMediaRandomName() (string, error) {
	buffer := make([]byte, 16)
	if _, err := rand.Read(buffer); err != nil {
		return "", err
	}
	return hex.EncodeToString(buffer), nil
}

func generationMediaExtension(contentType string) string {
	contentType = strings.ToLower(strings.TrimSpace(strings.Split(contentType, ";")[0]))
	switch {
	case strings.Contains(contentType, "mp4"):
		return ".mp4"
	case strings.Contains(contentType, "webm"):
		return ".webm"
	case strings.Contains(contentType, "quicktime"):
		return ".mov"
	case strings.Contains(contentType, "png"):
		return ".png"
	case strings.Contains(contentType, "jpeg"), strings.Contains(contentType, "jpg"):
		return ".jpg"
	case strings.Contains(contentType, "webp"):
		return ".webp"
	case strings.Contains(contentType, "gif"):
		return ".gif"
	case strings.Contains(contentType, "svg"):
		return ".svg"
	}
	return ""
}

func generationMediaSniffExtension(path string) string {
	file, err := os.Open(path)
	if err != nil {
		return ""
	}
	defer file.Close()
	header := make([]byte, 512)
	read, err := file.Read(header)
	if err != nil && read == 0 {
		return ""
	}
	return generationMediaExtension(http.DetectContentType(header[:read]))
}

func urlPathEscape(segment string) string {
	escaped := make([]byte, 0, len(segment))
	for i := 0; i < len(segment); i++ {
		char := segment[i]
		if (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') ||
			(char >= '0' && char <= '9') || char == '-' || char == '_' || char == '.' || char == '~' {
			escaped = append(escaped, char)
			continue
		}
		escaped = append(escaped, '%', "0123456789ABCDEF"[char>>4], "0123456789ABCDEF"[char&0x0f])
	}
	return string(escaped)
}
