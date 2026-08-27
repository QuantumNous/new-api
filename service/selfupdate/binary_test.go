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

func TestSelectBinaryAsset_LinuxAmd64RejectsExplicitForeignArchitecture(t *testing.T) {
	assets := []Asset{
		{Name: "new-api-linux-armv7-v1.0.0", DownloadURL: "https://github.com/x/armv7"},
		{Name: "new-api-linux-riscv64-v1.0.0", DownloadURL: "https://github.com/x/riscv64"},
		{Name: "new-api-linux-loong64-v1.0.0", DownloadURL: "https://github.com/x/loong64"},
		{Name: "checksums-linux.txt", DownloadURL: "https://github.com/x/checksums"},
	}

	_, _, err := SelectBinaryAsset(assets, "linux", "amd64")
	require.Error(t, err)
}

func TestSelectBinaryAsset_LinuxAmd64AcceptsExplicitAmd64(t *testing.T) {
	assets := []Asset{
		{Name: "new-api-linux-amd64-v1.0.0", DownloadURL: "https://github.com/x/amd64"},
		{Name: "checksums-linux.txt", DownloadURL: "https://github.com/x/checksums"},
	}

	bin, _, err := SelectBinaryAsset(assets, "linux", "amd64")
	require.NoError(t, err)
	assert.Equal(t, "new-api-linux-amd64-v1.0.0", bin.Name)
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

func TestSelectReleaseBinaryAsset(t *testing.T) {
	const tag = "v2.0.0"

	for _, tc := range []struct {
		name     string
		goos     string
		goarch   string
		assets   []Asset
		wantName string
		wantErr  string
	}{
		{
			name:   "linux amd64 chooses exact current release asset",
			goos:   "linux",
			goarch: "amd64",
			assets: []Asset{
				{Name: "new-api-v2.0.0-arm64"},
				{Name: "new-api-v1.9.0"},
				{Name: "new-api-linux-amd64-arm64-v2.0.0"},
				{Name: "new-api-v2.0.0"},
				{Name: "checksums-linux.txt"},
			},
			wantName: "new-api-v2.0.0",
		},
		{
			name:   "linux arm64 chooses exact current release asset",
			goos:   "linux",
			goarch: "arm64",
			assets: []Asset{
				{Name: "new-api-arm64-v1.9.0"},
				{Name: "new-api-v2.0.0"},
				{Name: "new-api-linux-arm64-v2.0.0"},
				{Name: "checksums-linux.txt"},
			},
			wantName: "new-api-linux-arm64-v2.0.0",
		},
		{
			name:   "linux arm64 prefers workflow asset over alternate alias",
			goos:   "linux",
			goarch: "arm64",
			assets: []Asset{
				{Name: "new-api-linux-arm64-v2.0.0"},
				{Name: "new-api-arm64-v2.0.0"},
				{Name: "checksums-linux.txt"},
			},
			wantName: "new-api-arm64-v2.0.0",
		},
		{
			name:   "linux arm64 reversed aliases remain deterministic",
			goos:   "linux",
			goarch: "arm64",
			assets: []Asset{
				{Name: "new-api-arm64-v2.0.0"},
				{Name: "new-api-linux-arm64-v2.0.0"},
				{Name: "checksums-linux.txt"},
			},
			wantName: "new-api-arm64-v2.0.0",
		},
		{
			name:   "linux 386 does not accept x86 64",
			goos:   "linux",
			goarch: "386",
			assets: []Asset{
				{Name: "new-api-linux-x86_64-v2.0.0"},
				{Name: "checksums-linux.txt"},
			},
			wantErr: "no binary asset",
		},
		{
			name:   "windows requires exact release asset",
			goos:   "windows",
			goarch: "amd64",
			assets: []Asset{
				{Name: "new-api-v1.9.0.exe"},
				{Name: "new-api-windows-arm64-v2.0.0.exe"},
				{Name: "unrelated-tool.exe"},
				{Name: "new-api-v2.0.0.exe"},
				{Name: "checksums-windows.txt"},
			},
			wantName: "new-api-v2.0.0.exe",
		},
		{
			name:   "darwin requires exact release asset",
			goos:   "darwin",
			goarch: "amd64",
			assets: []Asset{
				{Name: "new-api-macos-v1.9.0"},
				{Name: "new-api-macos-arm64-v2.0.0"},
				{Name: "new-api-macos-v2.0.0"},
				{Name: "checksums-macos.txt"},
			},
			wantName: "new-api-macos-v2.0.0",
		},
		{
			name:   "unsupported platform architecture is rejected",
			goos:   "windows",
			goarch: "arm64",
			assets: []Asset{
				{Name: "new-api-windows-arm64-v2.0.0.exe"},
			},
			wantErr: "no supported release asset naming",
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			rel := &ReleaseInfo{TagName: tag, Assets: tc.assets}
			bin, _, err := SelectReleaseBinaryAsset(rel, tc.goos, tc.goarch)
			if tc.wantErr != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tc.wantErr)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tc.wantName, bin.Name)
		})
	}
}

func TestSelectReleaseBinaryAssetRejectsUnsafeReleaseTag(t *testing.T) {
	for _, tag := range []string{"", " v2.0.0", "v2.0.0 ", "v2/../evil", "v2.0.0\nother"} {
		t.Run(fmt.Sprintf("reject %q", tag), func(t *testing.T) {
			_, _, err := SelectReleaseBinaryAsset(&ReleaseInfo{
				TagName: tag,
				Assets:  []Asset{{Name: "new-api-v2.0.0"}},
			}, "linux", "amd64")
			require.Error(t, err)
			assert.Contains(t, err.Error(), "release tag is invalid")
		})
	}
}

func TestIsSafeAssetBasename(t *testing.T) {
	for _, name := range []string{
		"",
		".",
		"..",
		"../new-api-v2.0.0",
		"dir/new-api-v2.0.0",
		"new-api-v2.0.0\\other",
		"new-api-v2.0.0\nother",
	} {
		t.Run(fmt.Sprintf("reject %q", name), func(t *testing.T) {
			assert.False(t, isSafeAssetBasename(name))
		})
	}
	assert.True(t, isSafeAssetBasename("new-api-v2.0.0"))
	assert.True(t, isSafeAssetBasename("new-api-v1.0.0-rc.21-th.1"))
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

	const binURL = "https://github.com/x/new-api-v2.0.0"
	const sumURL = "https://github.com/x/checksums-linux.txt"

	checksumLine := fmt.Sprintf("%s  new-api-v2.0.0\n", gotHex)

	client := &fakeGH{
		files: map[string][]byte{
			binURL: newContent,
			sumURL: []byte(checksumLine),
		},
	}

	rel := &ReleaseInfo{
		TagName: "v2.0.0",
		Assets: []Asset{
			{Name: "new-api-v2.0.0", DownloadURL: binURL, Size: int64(len(newContent))},
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

	const binURL = "https://github.com/x/new-api-v2.0.0"
	const sumURL = "https://github.com/x/checksums-linux.txt"

	client := &fakeGH{
		files: map[string][]byte{
			binURL: []byte("new content"),
			sumURL: []byte("0000000000000000000000000000000000000000000000000000000000000000  new-api-v2.0.0\n"),
		},
	}

	rel := &ReleaseInfo{
		TagName: "v2.0.0",
		Assets: []Asset{
			{Name: "new-api-v2.0.0", DownloadURL: binURL},
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
		TagName: "v2.0.0",
		Assets: []Asset{
			{Name: "new-api-v2.0.0", DownloadURL: "https://github.com/x/new-api-v2.0.0"},
		},
	}

	err := ApplyBinaryUpdate(context.Background(), &fakeGH{files: map[string][]byte{}}, rel, "linux", "amd64")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "no checksum asset")
}
