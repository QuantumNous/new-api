package systemupdate

import (
	"runtime"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestNormalizeAndCompareVersions(t *testing.T) {
	require.Equal(t, "1.0.0", normalizeVersion("v1.0.0"))

	cases := []struct {
		a, b string
		want int
	}{
		{"1.0.0", "1.0.1", -1},
		{"1.2.0", "1.1.9", 1},
		{"v1.0.0", "1.0.0", 0},
		{"1.0.0", "1.0.0-rc.22", 1},
		{"1.0.0-rc.21", "1.0.0-rc.22", -1},
		// numeric prerelease ordering (rc.9 < rc.10)
		{"1.0.0-rc.9", "1.0.0-rc.10", -1},
		{"1.0.0-rc.10", "1.0.0-rc.9", 1},
		// SemVer: only all-digit identifiers are numeric
		{"1.0.0-rc.1alpha", "1.0.0-rc.1beta", -1},
		{"1.0.0-rc.1beta", "1.0.0-rc.1alpha", 1},
		// SemVer: more identifiers after equal prefix → higher
		{"1.0.0-rc.1", "1.0.0-rc.1.0", -1},
		{"1.0.0-rc.1.0", "1.0.0-rc.1", 1},
		// SemVer: numeric identifiers have lower precedence than non-numeric
		{"1.0.0-1", "1.0.0-alpha", -1},
		{"1.0.0-alpha", "1.0.0-1", 1},
	}
	for _, tc := range cases {
		t.Run(tc.a+"_"+tc.b, func(t *testing.T) {
			require.Equal(t, tc.want, compareVersions(tc.a, tc.b))
		})
	}
}

func TestCandidateAssetNames(t *testing.T) {
	names := candidateAssetNames("1.0.0-rc.22")
	require.NotEmpty(t, names)
	require.Contains(t, names[0], "new-api")
	switch runtime.GOOS {
	case "windows":
		require.True(t, stringsHasSuffix(names[0], ".exe"))
	case "darwin":
		require.Contains(t, names[0], "macos")
	case "linux":
		if runtime.GOARCH == "arm64" {
			require.Contains(t, names[0], "arm64")
		} else {
			require.NotContains(t, names[0], "arm64")
			require.NotContains(t, names[0], "macos")
		}
	}
}

func TestSelectReleaseAsset(t *testing.T) {
	assets := []ReleaseAsset{
		{Name: "checksums-linux.txt", DownloadURL: "https://github.com/x/checksums-linux.txt"},
		{Name: "checksums-macos.txt", DownloadURL: "https://github.com/x/checksums-macos.txt"},
		{Name: "checksums-windows.txt", DownloadURL: "https://github.com/x/checksums-windows.txt"},
		{Name: "new-api-v1.0.0-rc.22", DownloadURL: "https://github.com/x/new-api-v1.0.0-rc.22"},
		{Name: "new-api-arm64-v1.0.0-rc.22", DownloadURL: "https://github.com/x/new-api-arm64-v1.0.0-rc.22"},
		{Name: "new-api-macos-v1.0.0-rc.22", DownloadURL: "https://github.com/x/new-api-macos-v1.0.0-rc.22"},
		{Name: "new-api-v1.0.0-rc.22.exe", DownloadURL: "https://github.com/x/new-api-v1.0.0-rc.22.exe"},
		// Wrong version should never be selected by fuzzy match
		{Name: "new-api-v9.9.9", DownloadURL: "https://github.com/x/new-api-v9.9.9"},
	}
	url, sum, err := selectReleaseAsset(assets, "v1.0.0-rc.22")
	require.NoError(t, err)
	require.NotEmpty(t, url)
	require.Contains(t, url, "1.0.0-rc.22")
	require.NotContains(t, url, "9.9.9")

	switch runtime.GOOS {
	case "windows":
		require.True(t, stringsHasSuffix(url, ".exe"))
		require.Equal(t, "https://github.com/x/checksums-windows.txt", sum)
	case "darwin":
		require.Contains(t, url, "macos")
		require.Equal(t, "https://github.com/x/checksums-macos.txt", sum)
	case "linux":
		if runtime.GOARCH == "arm64" {
			require.Contains(t, url, "arm64")
		} else {
			require.NotContains(t, url, "arm64")
			require.NotContains(t, url, "macos")
			require.False(t, stringsHasSuffix(url, ".exe"))
		}
		require.Equal(t, "https://github.com/x/checksums-linux.txt", sum)
	}
}

func TestValidateGitHubDownloadURL(t *testing.T) {
	require.NoError(t, validateGitHubDownloadURL("https://github.com/Calcium-Ion/new-api/releases/download/v1/x"))
	require.NoError(t, validateGitHubDownloadURL("https://objects.githubusercontent.com/foo"))
	require.Error(t, validateGitHubDownloadURL("http://github.com/x"))
	require.Error(t, validateGitHubDownloadURL("https://evil.example/x"))
}

func TestDetectDeployMode(t *testing.T) {
	mode := DetectDeployMode()
	require.Contains(t, []string{"binary", "docker", "unknown"}, mode)
}

func stringsHasSuffix(s, suffix string) bool {
	return len(s) >= len(suffix) && s[len(s)-len(suffix):] == suffix
}
