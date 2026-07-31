package systemupdate

import (
	"runtime"
	"testing"
)

func TestNormalizeAndCompareVersions(t *testing.T) {
	if got := normalizeVersion("v1.0.0"); got != "1.0.0" {
		t.Fatalf("normalizeVersion: got %q", got)
	}
	if compareVersions("1.0.0", "1.0.1") != -1 {
		t.Fatal("expected 1.0.0 < 1.0.1")
	}
	if compareVersions("1.2.0", "1.1.9") != 1 {
		t.Fatal("expected 1.2.0 > 1.1.9")
	}
	if compareVersions("v1.0.0", "1.0.0") != 0 {
		t.Fatal("expected v1.0.0 == 1.0.0")
	}
	// release without prerelease is greater
	if compareVersions("1.0.0", "1.0.0-rc.22") != 1 {
		t.Fatal("expected 1.0.0 > 1.0.0-rc.22")
	}
	if compareVersions("1.0.0-rc.21", "1.0.0-rc.22") != -1 {
		t.Fatal("expected rc.21 < rc.22")
	}
}

func TestCandidateAssetNames(t *testing.T) {
	names := candidateAssetNames("1.0.0-rc.22")
	if len(names) == 0 {
		t.Fatal("expected non-empty candidate names")
	}
	if names[0] == "" || !contains(names[0], "new-api") {
		t.Fatalf("unexpected name %q", names[0])
	}
	// Platform-specific expectations
	switch runtime.GOOS {
	case "windows":
		if !hasSuffix(names[0], ".exe") {
			t.Fatalf("windows asset should end with .exe, got %q", names[0])
		}
	case "darwin":
		if !contains(names[0], "macos") {
			t.Fatalf("darwin asset should contain macos, got %q", names[0])
		}
	case "linux":
		if runtime.GOARCH == "arm64" {
			if !contains(names[0], "arm64") {
				t.Fatalf("linux arm64 asset should contain arm64, got %q", names[0])
			}
		} else if contains(names[0], "arm64") || contains(names[0], "macos") {
			t.Fatalf("linux amd64 asset should not contain arm64/macos, got %q", names[0])
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
	}
	url, sum, err := selectReleaseAsset(assets, "v1.0.0-rc.22")
	if err != nil {
		t.Fatalf("selectReleaseAsset: %v", err)
	}
	if url == "" {
		t.Fatal("empty download url")
	}
	// Ensure selected asset matches current platform expectations
	switch runtime.GOOS {
	case "windows":
		if !hasSuffix(url, ".exe") {
			t.Fatalf("expected exe asset, got %s", url)
		}
		if sum != "https://github.com/x/checksums-windows.txt" {
			t.Fatalf("expected windows checksum, got %s", sum)
		}
	case "darwin":
		if !contains(url, "macos") {
			t.Fatalf("expected macos asset, got %s", url)
		}
	case "linux":
		if runtime.GOARCH == "arm64" {
			if !contains(url, "arm64") {
				t.Fatalf("expected arm64 asset, got %s", url)
			}
		} else if contains(url, "arm64") || contains(url, "macos") || hasSuffix(url, ".exe") {
			t.Fatalf("unexpected linux amd64 selection: %s", url)
		}
	}
}

func TestValidateGitHubDownloadURL(t *testing.T) {
	if err := validateGitHubDownloadURL("https://github.com/Calcium-Ion/new-api/releases/download/v1/x"); err != nil {
		t.Fatal(err)
	}
	if err := validateGitHubDownloadURL("https://objects.githubusercontent.com/foo"); err != nil {
		t.Fatal(err)
	}
	if err := validateGitHubDownloadURL("http://github.com/x"); err == nil {
		t.Fatal("expected error for http")
	}
	if err := validateGitHubDownloadURL("https://evil.example/x"); err == nil {
		t.Fatal("expected error for untrusted host")
	}
}

func TestDetectDeployMode(t *testing.T) {
	mode := DetectDeployMode()
	if mode != "binary" && mode != "docker" && mode != "unknown" {
		t.Fatalf("unexpected mode %q", mode)
	}
}

func contains(s, sub string) bool {
	return len(s) >= len(sub) && (s == sub || len(sub) == 0 ||
		(func() bool {
			for i := 0; i+len(sub) <= len(s); i++ {
				if s[i:i+len(sub)] == sub {
					return true
				}
			}
			return false
		})())
}

func hasSuffix(s, suffix string) bool {
	return len(s) >= len(suffix) && s[len(s)-len(suffix):] == suffix
}
