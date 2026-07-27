package service

import (
	"bytes"
	"context"
	"io"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/service/storage"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDetectPlaygroundAssetKind(t *testing.T) {
	kind, err := DetectPlaygroundAssetKind("image/png")
	require.NoError(t, err)
	assert.Equal(t, "image", kind)

	kind, err = DetectPlaygroundAssetKind("application/pdf")
	require.NoError(t, err)
	assert.Equal(t, "document", kind)

	// Office and plain-text formats are extracted client-side and must never be
	// hosted back from our own origin.
	for _, mimeType := range []string{
		"text/html",
		"text/plain",
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	} {
		_, err = DetectPlaygroundAssetKind(mimeType)
		assert.Error(t, err, mimeType)
	}
}

func TestSniffPlaygroundMime_PDF(t *testing.T) {
	pdf := []byte("%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\n")
	mimeType, kind, err := SniffPlaygroundMime(pdf, "application/octet-stream")
	require.NoError(t, err)
	assert.Equal(t, "application/pdf", mimeType)
	assert.Equal(t, "document", kind)
}

func TestSniffPlaygroundMime_RejectsDeclaredPDFWithoutMagic(t *testing.T) {
	_, _, err := SniffPlaygroundMime([]byte("plain text body"), "application/pdf")
	assert.Error(t, err)
}

func TestSniffPlaygroundMime_RejectsCoercedExecutable(t *testing.T) {
	// PE/ELF-ish content should not become image/png via declared MIME alone
	// unless sniff is octet-stream AND declared is allowlisted — for binary
	// that DetectContentType marks as application/octet-stream, declared
	// image/png is accepted as fallback. Use content DetectContentType maps
	// to text/plain or application/zip-like without allowlist.
	html := []byte("<!DOCTYPE html><html><script>alert(1)</script></html>")
	_, _, err := SniffPlaygroundMime(html, "image/png")
	// DetectContentType returns text/html — not allowlisted and not octet-stream
	assert.Error(t, err)
}

func TestSniffPlaygroundMime_PNG(t *testing.T) {
	// Minimal PNG header
	png := []byte{
		0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
		0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
	}
	mimeType, kind, err := SniffPlaygroundMime(png, "application/octet-stream")
	require.NoError(t, err)
	assert.Equal(t, "image", kind)
	assert.Equal(t, "image/png", mimeType)
}

func TestSaveAndResolvePlaygroundAssetFile(t *testing.T) {
	root := t.TempDir()
	t.Setenv("STORAGE_BACKEND", "local")
	t.Setenv("PLAYGROUND_ASSETS_DIR", root)
	storage.Reset()
	t.Cleanup(storage.Reset)

	// Real PNG magic so sniff succeeds
	data := []byte{
		0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
		0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
		0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
	}
	key, backend, mimeType, kind, err := SavePlaygroundAssetFile(42, "shot.png", "image/png", bytes.NewReader(data), int64(len(data)))
	require.NoError(t, err)
	assert.Equal(t, "image", kind)
	assert.Equal(t, "image/png", mimeType)
	assert.Equal(t, "local", backend)
	assert.Contains(t, key, "uploads/42/")

	abs, err := ResolvePlaygroundAssetPath(key)
	require.NoError(t, err)
	assert.FileExists(t, abs)

	// Persisted backend selection must survive a process default change.
	t.Setenv("STORAGE_BACKEND", "r2")
	storage.Reset()

	// Content is served through the store; local backend streams (no presign).
	redirect, body, err := OpenPlaygroundAssetContent(context.Background(), "local", key, 0)
	require.NoError(t, err)
	assert.Empty(t, redirect)
	require.NotNil(t, body)
	got, err := io.ReadAll(body)
	require.NoError(t, body.Close())
	require.NoError(t, err)
	assert.Equal(t, data, got)

	_, err = ResolvePlaygroundAssetPath("../etc/passwd")
	assert.Error(t, err)
	_, err = ResolvePlaygroundAssetPath(filepath.Join("..", "x"))
	assert.Error(t, err)

	DeletePlaygroundAssetFile("local", key)
	_, err = os.Stat(abs)
	assert.True(t, os.IsNotExist(err))
}

func TestPublishPlaygroundAssetObjectLocal(t *testing.T) {
	root := t.TempDir()
	t.Setenv("STORAGE_BACKEND", "local")
	t.Setenv("PLAYGROUND_ASSETS_DIR", root)
	storage.Reset()
	t.Cleanup(storage.Reset)

	data := []byte{
		0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
		0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
		0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
	}
	key, _, mimeType, _, err := SavePlaygroundAssetFile(7, "shot.png", "image/png", bytes.NewReader(data), int64(len(data)))
	require.NoError(t, err)

	publicKey, publicURL, err := PublishPlaygroundAssetObject(context.Background(), 7, "local", key, mimeType, int64(len(data)))
	require.NoError(t, err)
	assert.True(t, storage.IsPublicKey(publicKey), "public key must use a public prefix: %s", publicKey)
	// local backend has no CDN, so the URL is empty (callers fall back)
	assert.Empty(t, publicURL)

	// the copied object is retrievable at the public key
	_, body, err := OpenPlaygroundAssetContent(context.Background(), "local", publicKey, 0)
	require.NoError(t, err)
	got, err := io.ReadAll(body)
	require.NoError(t, body.Close())
	require.NoError(t, err)
	assert.Equal(t, data, got)

	UnpublishPlaygroundAssetObject(context.Background(), "local", publicKey)
	_, _, err = OpenPlaygroundAssetContent(context.Background(), "local", publicKey, 0)
	assert.Error(t, err)
}

func TestSavePlaygroundAssetFile_SizeLimit(t *testing.T) {
	root := t.TempDir()
	t.Setenv("STORAGE_BACKEND", "local")
	t.Setenv("PLAYGROUND_ASSETS_DIR", root)
	storage.Reset()
	t.Cleanup(storage.Reset)
	big := bytes.Repeat([]byte("a"), int(PlaygroundAssetMaxImageBytes)+10)
	_, _, _, _, err := SavePlaygroundAssetFile(1, "big.png", "image/png", bytes.NewReader(big), int64(len(big)))
	assert.Error(t, err)
}

func TestOpenPlaygroundAssetContentNeverPresignRedirects(t *testing.T) {
	root := t.TempDir()
	t.Setenv("STORAGE_BACKEND", "local")
	t.Setenv("PLAYGROUND_ASSETS_DIR", root)
	storage.Reset()
	t.Cleanup(storage.Reset)

	data := []byte{
		0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
		0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
	}
	key, backend, _, _, err := SavePlaygroundAssetFile(3, "a.png", "image/png", bytes.NewReader(data), int64(len(data)))
	require.NoError(t, err)
	require.Equal(t, "local", backend)

	// Even if the process default becomes r2, opening a local-backed key must
	// stream (empty redirect) — browsers never follow a cross-origin hop.
	t.Setenv("STORAGE_BACKEND", "r2")
	storage.Reset()

	redirect, body, err := OpenPlaygroundAssetContent(context.Background(), "local", key, time.Minute)
	require.NoError(t, err)
	assert.Empty(t, redirect, "private playground assets must not presign-redirect")
	require.NotNil(t, body)
	got, err := io.ReadAll(body)
	require.NoError(t, body.Close())
	require.NoError(t, err)
	assert.Equal(t, data, got)
}
