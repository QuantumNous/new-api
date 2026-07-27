package service

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"mime"
	"net/http"
	"path"
	"path/filepath"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/service/storage"
	"github.com/google/uuid"
)

const (
	PlaygroundAssetMaxImageBytes    = 10 * 1024 * 1024 // 10MB
	PlaygroundAssetMaxVideoBytes    = 50 * 1024 * 1024 // 50MB
	PlaygroundAssetMaxAudioBytes    = 20 * 1024 * 1024 // 20MB
	PlaygroundAssetMaxDocumentBytes = 20 * 1024 * 1024 // 20MB
)

var playgroundImageMimes = map[string]bool{
	"image/jpeg": true,
	"image/jpg":  true,
	"image/png":  true,
	"image/webp": true,
	"image/gif":  true,
}

var playgroundVideoMimes = map[string]bool{
	"video/mp4":       true,
	"video/webm":      true,
	"video/quicktime": true,
}

var playgroundAudioMimes = map[string]bool{
	"audio/aac":    true,
	"audio/flac":   true,
	"audio/x-flac": true,
	"audio/mpeg":   true,
	"audio/mp3":    true,
	"audio/wav":    true,
	"audio/x-wav":  true,
	"audio/webm":   true,
	"audio/ogg":    true,
	"audio/mp4":    true,
	"audio/m4a":    true,
}

// playgroundDocumentMimes covers chat attachments that go through the
// server-side document parse pipeline. Content is only ever delivered back
// with attachment disposition, never rendered inline on our origin.
var playgroundDocumentMimes = map[string]bool{
	"application/pdf": true,
	MimeDocx:          true,
	MimeXlsx:          true,
	MimePptx:          true,
}

const (
	MimeDocx = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
	MimeXlsx = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
	MimePptx = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
)

// PlaygroundAssetsRoot returns the absolute directory for the local storage
// backend. Kept for the local content path and backfill tooling.
func PlaygroundAssetsRoot() string {
	return storage.LocalRoot()
}

// NormalizePlaygroundMime maps common sniff/browser variants onto the allowlist key.
func NormalizePlaygroundMime(mimeType string) string {
	mimeType = strings.ToLower(strings.TrimSpace(mimeType))
	if i := strings.Index(mimeType, ";"); i >= 0 {
		mimeType = strings.TrimSpace(mimeType[:i])
	}
	switch mimeType {
	case "image/jpg":
		return "image/jpeg"
	case "audio/mp3":
		return "audio/mpeg"
	case "audio/x-wav":
		return "audio/wav"
	case "audio/wave":
		return "audio/wav"
	case "audio/x-flac":
		return "audio/flac"
	case "application/x-pdf":
		return "application/pdf"
	default:
		return mimeType
	}
}

// DetectPlaygroundAssetKind maps mime to kind (image|video|audio|document).
func DetectPlaygroundAssetKind(mimeType string) (string, error) {
	mimeType = NormalizePlaygroundMime(mimeType)
	if playgroundImageMimes[mimeType] {
		return "image", nil
	}
	if playgroundVideoMimes[mimeType] {
		return "video", nil
	}
	if playgroundAudioMimes[mimeType] {
		return "audio", nil
	}
	if playgroundDocumentMimes[mimeType] {
		return "document", nil
	}
	return "", fmt.Errorf("unsupported mime type: %s", mimeType)
}

// IsPlaygroundMimeAllowed reports whether mime is on the allowlist.
func IsPlaygroundMimeAllowed(mimeType string) bool {
	_, err := DetectPlaygroundAssetKind(mimeType)
	return err == nil
}

// SniffPlaygroundMime reads up to 512 bytes (does not consume beyond peek via Tee/multi),
// detects content type, and maps to an allowlisted MIME when possible.
// declared may be used as a secondary hint only when sniff is generic (octet-stream).
func SniffPlaygroundMime(header []byte, declared string) (mimeType string, kind string, err error) {
	sniffed := http.DetectContentType(header)
	sniffed = NormalizePlaygroundMime(sniffed)
	declared = NormalizePlaygroundMime(declared)

	if detectedMime, detectedKind, ok := sniffPlaygroundContainer(header, declared); ok {
		return detectedMime, detectedKind, nil
	}

	// Prefer sniffed when it is allowlisted
	if k, e := DetectPlaygroundAssetKind(sniffed); e == nil {
		return sniffed, k, nil
	}

	// If declared is allowlisted and sniff is a compatible family (e.g. image/*)
	if k, e := DetectPlaygroundAssetKind(declared); e == nil {
		if strings.HasPrefix(sniffed, "image/") && k == "image" {
			return declared, k, nil
		}
		if strings.HasPrefix(sniffed, "video/") && k == "video" {
			return declared, k, nil
		}
		if strings.HasPrefix(sniffed, "audio/") && k == "audio" {
			return declared, k, nil
		}
		// sniff failed family match — reject declared alone without sniff support
	}

	return "", "", fmt.Errorf("unsupported or unrecognizable file type (sniffed %s, declared %s)", sniffed, declared)
}

func sniffPlaygroundContainer(header []byte, declared string) (string, string, bool) {
	if len(header) >= 12 && bytes.Equal(header[0:4], []byte("RIFF")) {
		switch string(header[8:12]) {
		case "WEBP":
			return "image/webp", "image", true
		case "WAVE":
			return "audio/wav", "audio", true
		}
	}
	if len(header) >= 5 && bytes.Equal(header[0:5], []byte("%PDF-")) {
		return "application/pdf", "document", true
	}
	// OOXML documents are ZIP containers; the magic bytes cannot distinguish
	// docx/xlsx/pptx, so the declared type picks among the office allowlist.
	if len(header) >= 4 && bytes.Equal(header[0:4], []byte{'P', 'K', 0x03, 0x04}) {
		if playgroundDocumentMimes[declared] && declared != "application/pdf" {
			return declared, "document", true
		}
	}
	if len(header) >= 4 && bytes.Equal(header[0:4], []byte("OggS")) {
		return "audio/ogg", "audio", true
	}
	if len(header) >= 4 && bytes.Equal(header[0:4], []byte("fLaC")) {
		return "audio/flac", "audio", true
	}
	if len(header) >= 2 && header[0] == 0xff && header[1]&0xf6 == 0xf0 {
		return "audio/aac", "audio", true
	}
	if len(header) >= 3 && bytes.Equal(header[0:3], []byte("ID3")) ||
		len(header) >= 2 && header[0] == 0xff && header[1]&0xe0 == 0xe0 {
		return "audio/mpeg", "audio", true
	}
	if len(header) >= 4 && bytes.Equal(header[0:4], []byte{0x1a, 0x45, 0xdf, 0xa3}) {
		if declared == "audio/webm" {
			return "audio/webm", "audio", true
		}
		return "video/webm", "video", true
	}
	if len(header) >= 12 && bytes.Equal(header[4:8], []byte("ftyp")) {
		brand := string(header[8:12])
		if declared == "audio/mp4" || declared == "audio/m4a" || strings.HasPrefix(brand, "M4A") {
			return declaredAudioMP4Mime(declared), "audio", true
		}
		if declared == "video/quicktime" || brand == "qt  " {
			return "video/quicktime", "video", true
		}
		return "video/mp4", "video", true
	}
	return "", "", false
}

func declaredAudioMP4Mime(declared string) string {
	if declared == "audio/m4a" {
		return declared
	}
	return "audio/mp4"
}

// MaxBytesForPlaygroundKind returns the upload size cap for a kind.
func MaxBytesForPlaygroundKind(kind string) int64 {
	switch kind {
	case "video":
		return PlaygroundAssetMaxVideoBytes
	case "audio":
		return PlaygroundAssetMaxAudioBytes
	case "document":
		return PlaygroundAssetMaxDocumentBytes
	default:
		return PlaygroundAssetMaxImageBytes
	}
}

// SavePlaygroundAssetFile stores uploaded content through the configured asset
// store under a user-scoped "uploads/" key. It sniffs the first bytes to
// enforce the MIME allowlist (declared is only a hint) and caps size by kind.
// contentHash (sha256 hex) is only computed for document kinds, where it keys
// the shared parse cache.
func SavePlaygroundAssetFile(userId int, originalName, declaredMime string, r io.Reader, size int64) (storageKey string, backend string, mimeType string, kind string, contentHash string, err error) {
	// Browsers report an empty or generic type for office files picked from
	// some file managers; the extension is then the only usable hint.
	declaredMime = normalizeDeclaredDocumentMime(originalName, declaredMime)

	// Peek for sniff
	header := make([]byte, 512)
	n, readErr := io.ReadFull(r, header)
	if readErr != nil && readErr != io.EOF && readErr != io.ErrUnexpectedEOF {
		return "", "", "", "", "", readErr
	}
	header = header[:n]
	mimeType, kind, err = SniffPlaygroundMime(header, declaredMime)
	if err != nil {
		return "", "", "", "", "", err
	}

	max := MaxBytesForPlaygroundKind(kind)
	if size > 0 && size > max {
		return "", "", "", "", "", fmt.Errorf("file exceeds size limit (%d bytes)", max)
	}

	// Read the remaining bytes with a hard cap (media sizes are bounded).
	limitedRest := io.LimitReader(r, max+1-int64(len(header)))
	rest, err := io.ReadAll(limitedRest)
	if err != nil {
		return "", "", "", "", "", err
	}
	content := make([]byte, 0, len(header)+len(rest))
	content = append(content, header...)
	content = append(content, rest...)
	if int64(len(content)) > max {
		return "", "", "", "", "", fmt.Errorf("file exceeds size limit (%d bytes)", max)
	}

	if kind == "document" {
		sum := sha256.Sum256(content)
		contentHash = hex.EncodeToString(sum[:])
	}

	ext := safeExtFromName(originalName, mimeType)
	storageKey = path.Join("uploads", fmt.Sprintf("%d", userId), uuid.New().String()+ext)

	store := storage.Default()
	if err := store.Put(context.Background(), storageKey, bytes.NewReader(content), int64(len(content)), mimeType); err != nil {
		return "", "", "", "", "", err
	}
	return storageKey, store.Backend(), mimeType, kind, contentHash, nil
}

func normalizeDeclaredDocumentMime(originalName, declared string) string {
	if playgroundDocumentMimes[NormalizePlaygroundMime(declared)] {
		return declared
	}
	switch strings.ToLower(path.Ext(originalName)) {
	case ".pdf":
		return "application/pdf"
	case ".docx":
		return MimeDocx
	case ".xlsx":
		return MimeXlsx
	case ".pptx":
		return MimePptx
	default:
		return declared
	}
}

// OpenPlaygroundAssetContent resolves an asset for same-origin delivery.
// Private playground media is always streamed through the app (never redirected
// to a cross-origin presigned R2 URL) so browser <img>/<video>/fetch downloads
// do not depend on R2 CORS. redirectURL is reserved for future opt-in CDNs and
// is empty for the supported backends today. ttl is ignored.
func OpenPlaygroundAssetContent(ctx context.Context, backend, storageKey string, ttl time.Duration) (redirectURL string, body io.ReadCloser, err error) {
	_ = ttl
	store, err := storage.ForBackend(backend)
	if err != nil {
		return "", nil, err
	}
	rc, oerr := store.Open(ctx, storageKey)
	if oerr != nil {
		return "", nil, oerr
	}
	return "", rc, nil
}

func OpenPlaygroundAssetContentDirect(ctx context.Context, backend, storageKey string) (io.ReadCloser, error) {
	store, err := storage.ForBackend(backend)
	if err != nil {
		return nil, err
	}
	return store.Open(ctx, storageKey)
}

// PublishPlaygroundAssetObject copies a stored object to a public ("public/")
// key so it can be delivered via the public CDN. Returns the public key and,
// when the backend exposes a CDN, the public URL. For the local backend the
// URL is empty (no public CDN); callers fall back to the app content route.
func PublishPlaygroundAssetObject(ctx context.Context, userId int, backend, storageKey, mimeType string, size int64) (publicKey string, publicURL string, err error) {
	store, err := storage.ForBackend(backend)
	if err != nil {
		return "", "", err
	}
	publicKey = path.Join("public", fmt.Sprintf("%d", userId), path.Base(storageKey))
	rc, err := store.Open(ctx, storageKey)
	if err != nil {
		return "", "", err
	}
	defer rc.Close()
	if err := store.Put(ctx, publicKey, rc, size, mimeType); err != nil {
		return "", "", err
	}
	if url, ok := store.PublicURL(publicKey); ok {
		publicURL = url
	}
	return publicKey, publicURL, nil
}

// UnpublishPlaygroundAssetObject removes a previously published public object.
func UnpublishPlaygroundAssetObject(ctx context.Context, backend, publicKey string) {
	if publicKey == "" {
		return
	}
	store, err := storage.ForBackend(backend)
	if err == nil {
		_ = store.Delete(ctx, publicKey)
	}
}

// ResolvePlaygroundAssetPath maps a storage key to a local absolute path. Only
// valid for the local backend (used by the local content path and backfill).
func ResolvePlaygroundAssetPath(storageKey string) (string, error) {
	if storageKey == "" || strings.Contains(storageKey, "..") {
		return "", fmt.Errorf("invalid storage key")
	}
	clean := filepath.Clean(filepath.FromSlash(storageKey))
	if strings.HasPrefix(clean, "..") || filepath.IsAbs(clean) {
		return "", fmt.Errorf("invalid storage key")
	}
	root := PlaygroundAssetsRoot()
	full := filepath.Join(root, clean)
	rel, err := filepath.Rel(root, full)
	if err != nil || strings.HasPrefix(rel, "..") {
		return "", fmt.Errorf("invalid storage key")
	}
	return full, nil
}

// DeletePlaygroundAssetFile removes the stored object if it exists.
func DeletePlaygroundAssetFile(backend, storageKey string) {
	store, err := storage.ForBackend(backend)
	if err == nil {
		_ = store.Delete(context.Background(), storageKey)
	}
}

func safeExtFromName(name, mimeType string) string {
	ext := strings.ToLower(filepath.Ext(name))
	if ext == "" || len(ext) > 8 || strings.ContainsAny(ext, "/\\") {
		if exts, _ := mime.ExtensionsByType(mimeType); len(exts) > 0 {
			ext = exts[0]
		} else {
			ext = ".bin"
		}
	}
	switch ext {
	case ".jpg", ".jpeg", ".png", ".webp", ".gif",
		".mp4", ".webm", ".mov",
		".mp3", ".wav", ".ogg", ".m4a", ".mpeg", ".aac", ".flac",
		".pdf", ".docx", ".xlsx", ".pptx":
		return ext
	default:
		return ".bin"
	}
}
