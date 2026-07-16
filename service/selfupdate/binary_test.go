package selfupdate

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// SelectBinaryAsset tests
// ---------------------------------------------------------------------------

func TestSelectBinaryAsset_LinuxAmd64(t *testing.T) {
	assets := []Asset{
		{Name: "new-api-arm64-v1.0.0-rc.21", DownloadURL: "https://github.com/x/a"},
		{Name: "new-api-v1.0.0-rc.21", DownloadURL: "https://github.com/x/b"},
		{Name: "checksums-linux.txt", DownloadURL: "https://github.com/x/c"},
	}
	bin, sum, err := SelectBinaryAsset(assets, "linux", "amd64")
	require.NoError(t, err)
	assert.Equal(t, "new-api-v1.0.0-rc.21", bin.Name)
	assert.Equal(t, "checksums-linux.txt", sum.Name)
}

func TestSelectBinaryAsset_LinuxArm64(t *testing.T) {
	assets := []Asset{
		{Name: "new-api-arm64-v1.0.0-rc.21", DownloadURL: "https://github.com/x/a"},
		{Name: "new-api-v1.0.0-rc.21", DownloadURL: "https://github.com/x/b"},
		{Name: "checksums-linux.txt", DownloadURL: "https://github.com/x/c"},
	}
	bin, sum, err := SelectBinaryAsset(assets, "linux", "arm64")
	require.NoError(t, err)
	assert.Equal(t, "new-api-arm64-v1.0.0-rc.21", bin.Name)
	assert.Equal(t, "checksums-linux.txt", sum.Name)
}

func TestSelectBinaryAsset_Windows(t *testing.T) {
	assets := []Asset{
		{Name: "new-api-windows-amd64.exe", DownloadURL: "https://github.com/x/a"},
		{Name: "new-api-v1.0.0-rc.21", DownloadURL: "https://github.com/x/b"},
		{Name: "checksums-windows.txt", DownloadURL: "https://github.com/x/c"},
		{Name: "checksums-linux.txt", DownloadURL: "https://github.com/x/d"},
	}
	bin, sum, err := SelectBinaryAsset(assets, "windows", "amd64")
	require.NoError(t, err)
	assert.Equal(t, "new-api-windows-amd64.exe", bin.Name)
	assert.Equal(t, "checksums-windows.txt", sum.Name)
}

func TestSelectBinaryAsset_Darwin(t *testing.T) {
	assets := []Asset{
		{Name: "new-api-macos-amd64", DownloadURL: "https://github.com/x/a"},
		{Name: "new-api-v1.0.0-rc.21", DownloadURL: "https://github.com/x/b"},
		{Name: "checksums-macos.txt", DownloadURL: "https://github.com/x/c"},
	}
	bin, sum, err := SelectBinaryAsset(assets, "darwin", "amd64")
	require.NoError(t, err)
	assert.Equal(t, "new-api-macos-amd64", bin.Name)
	assert.Equal(t, "checksums-macos.txt", sum.Name)
}

func TestSelectBinaryAsset_NoMatch(t *testing.T) {
	assets := []Asset{
		{Name: "some-other-tool", DownloadURL: "https://github.com/x/a"},
	}
	_, _, err := SelectBinaryAsset(assets, "linux", "amd64")
	require.Error(t, err)
}

func TestSelectBinaryAsset_FallbackToGenericChecksum(t *testing.T) {
	assets := []Asset{
		{Name: "new-api-v1.0.0", DownloadURL: "https://github.com/x/b"},
		{Name: "checksums.txt", DownloadURL: "https://github.com/x/c"},
	}
	bin, sum, err := SelectBinaryAsset(assets, "linux", "amd64")
	require.NoError(t, err)
	assert.Equal(t, "new-api-v1.0.0", bin.Name)
	assert.Equal(t, "checksums.txt", sum.Name)
}

func TestSelectBinaryAsset_NoChecksum(t *testing.T) {
	assets := []Asset{
		{Name: "new-api-v1.0.0", DownloadURL: "https://github.com/x/b"},
	}
	bin, sum, err := SelectBinaryAsset(assets, "linux", "amd64")
	require.NoError(t, err)
	assert.Equal(t, "new-api-v1.0.0", bin.Name)
	assert.Nil(t, sum)
}

// ---------------------------------------------------------------------------
// ParseChecksumFile tests
// ---------------------------------------------------------------------------

func TestParseChecksumFile(t *testing.T) {
	data := []byte("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa  new-api-v1.0.0-rc.21\n")
	got, err := ParseChecksumFile(data, "new-api-v1.0.0-rc.21")
	require.NoError(t, err)
	assert.Equal(t, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", got)
}

func TestParseChecksumFile_MultiLine(t *testing.T) {
	data := []byte(
		"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb  other-file\n" +
			"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc  new-api-v1.0.0-rc.21\n",
	)
	got, err := ParseChecksumFile(data, "new-api-v1.0.0-rc.21")
	require.NoError(t, err)
	assert.Equal(t, "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc", got)
}

func TestParseChecksumFile_NotFound(t *testing.T) {
	data := []byte("aaaa  some-other-file\n")
	_, err := ParseChecksumFile(data, "missing-file")
	require.Error(t, err)
}

// ---------------------------------------------------------------------------
// fakeGH — fake GitHubClient for ApplyBinaryUpdate tests
// ---------------------------------------------------------------------------

type fakeGH struct {
	files map[string][]byte
}

func (f *fakeGH) FetchLatestRelease(context.Context, string) (*ReleaseInfo, error) {
	return nil, fmt.Errorf("unused")
}

func (f *fakeGH) Download(_ context.Context, url, dest string, _ int64) error {
	b, ok := f.files[url]
	if !ok {
		return fmt.Errorf("missing %s", url)
	}
	return os.WriteFile(dest, b, 0o644)
}

func (f *fakeGH) FetchBytes(_ context.Context, url string, _ int64) ([]byte, error) {
	b, ok := f.files[url]
	if !ok {
		return nil, fmt.Errorf("missing %s", url)
	}
	return b, nil
}

// ---------------------------------------------------------------------------
// ApplyBinaryUpdate integration-style test
// ---------------------------------------------------------------------------

func TestApplyBinaryUpdate_Success(t *testing.T) {
	// Build a fake "current binary" in a temp dir.
	dir := t.TempDir()
	currentExe := filepath.Join(dir, "new-api")
	require.NoError(t, os.WriteFile(currentExe, []byte("old binary content"), 0o755))

	// Build new binary content and compute its SHA-256.
	newContent := []byte("new binary content v2")
	sum := sha256.Sum256(newContent)
	gotHex := hex.EncodeToString(sum[:])

	const binURL = "https://github.com/x/new-api-v2"
	const sumURL = "https://github.com/x/checksums-linux.txt"

	checksumLine := fmt.Sprintf("%s  new-api-v2\n", gotHex)

	client := &fakeGH{
		files: map[string][]byte{
			binURL: newContent,
			sumURL: []byte(checksumLine),
		},
	}

	rel := &ReleaseInfo{
		TagName: "v2.0.0",
		Assets: []Asset{
			{Name: "new-api-v2", DownloadURL: binURL, Size: int64(len(newContent))},
			{Name: "checksums-linux.txt", DownloadURL: sumURL},
		},
	}

	// Override lookupExecutable to point at our temp file.
	orig := lookupExecutable
	lookupExecutable = func() (string, error) { return currentExe, nil }
	defer func() { lookupExecutable = orig }()

	err := ApplyBinaryUpdate(context.Background(), client, rel, "linux", "amd64")
	require.NoError(t, err)

	// Verify new content is in place.
	got, err := os.ReadFile(currentExe)
	require.NoError(t, err)
	assert.Equal(t, newContent, got)

	// Backup should have been removed.
	_, statErr := os.Stat(currentExe + ".backup")
	assert.True(t, os.IsNotExist(statErr), "backup should be removed after success")
}

func TestApplyBinaryUpdate_BadChecksum(t *testing.T) {
	dir := t.TempDir()
	currentExe := filepath.Join(dir, "new-api")
	require.NoError(t, os.WriteFile(currentExe, []byte("old"), 0o755))

	const binURL = "https://github.com/x/new-api-v2"
	const sumURL = "https://github.com/x/checksums-linux.txt"

	client := &fakeGH{
		files: map[string][]byte{
			binURL: []byte("new content"),
			sumURL: []byte("0000000000000000000000000000000000000000000000000000000000000000  new-api-v2\n"),
		},
	}

	rel := &ReleaseInfo{
		Assets: []Asset{
			{Name: "new-api-v2", DownloadURL: binURL},
			{Name: "checksums-linux.txt", DownloadURL: sumURL},
		},
	}

	orig := lookupExecutable
	lookupExecutable = func() (string, error) { return currentExe, nil }
	defer func() { lookupExecutable = orig }()

	err := ApplyBinaryUpdate(context.Background(), client, rel, "linux", "amd64")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "checksum mismatch")

	// Original binary should still be in place.
	got, readErr := os.ReadFile(currentExe)
	require.NoError(t, readErr)
	assert.Equal(t, []byte("old"), got)
}

func TestApplyBinaryUpdate_NoChecksumAsset(t *testing.T) {
	rel := &ReleaseInfo{
		Assets: []Asset{
			{Name: "new-api-v2", DownloadURL: "https://github.com/x/new-api-v2"},
		},
	}

	err := ApplyBinaryUpdate(context.Background(), &fakeGH{files: map[string][]byte{}}, rel, "linux", "amd64")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "no checksum asset")
}
