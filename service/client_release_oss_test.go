package service

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/model"
)

func TestClientReleaseGeneratedFileName(t *testing.T) {
	input := ClientReleaseUploadInput{
		Version:  "1.2.3",
		Platform: "windows",
		Arch:     "x64",
		Channel:  "stable",
	}
	got := clientReleaseGeneratedFileName(input, `C:\Users\demo\random setup.exe`)
	want := "Z-UP-Setup-1.2.3-windows-x64-stable.exe"
	if got != want {
		t.Fatalf("clientReleaseGeneratedFileName() = %q, want %q", got, want)
	}
}

func TestClientReleaseGeneratedFileNameKeepsAppImageExtension(t *testing.T) {
	input := ClientReleaseUploadInput{
		Version:  "1.2.4",
		Platform: "linux",
		Arch:     "arm64",
		Channel:  "beta",
	}
	got := clientReleaseGeneratedFileName(input, "z-up.AppImage")
	want := "Z-UP-Setup-1.2.4-linux-arm64-beta.AppImage"
	if got != want {
		t.Fatalf("clientReleaseGeneratedFileName() = %q, want %q", got, want)
	}
}

func TestNormalizeClientReleaseUploadInputRejectsInvalidTarget(t *testing.T) {
	input := ClientReleaseUploadInput{
		Version:  "1.2.3",
		Platform: "android",
		Arch:     "x64",
		Channel:  "stable",
	}
	if err := normalizeClientReleaseUploadInput(&input); err == nil {
		t.Fatal("normalizeClientReleaseUploadInput() returned nil error for invalid platform")
	}

	input = ClientReleaseUploadInput{
		Version:  "1.2.3",
		Platform: "windows",
		Arch:     "mips",
		Channel:  "stable",
	}
	if err := normalizeClientReleaseUploadInput(&input); err == nil {
		t.Fatal("normalizeClientReleaseUploadInput() returned nil error for invalid arch")
	}
}

func TestClientReleaseUploadURLExpiresDefault(t *testing.T) {
	t.Setenv("CLIENT_RELEASE_OSS_UPLOAD_URL_EXPIRES_SECONDS", "")
	if got := clientReleaseUploadURLExpires(); got != defaultClientReleaseUploadURLExpiresSeconds {
		t.Fatalf("clientReleaseUploadURLExpires() = %d, want %d", got, defaultClientReleaseUploadURLExpiresSeconds)
	}
}

func TestClientReleaseUploadURLExpiresCapsAtOneDay(t *testing.T) {
	t.Setenv("CLIENT_RELEASE_OSS_UPLOAD_URL_EXPIRES_SECONDS", "999999")
	if got := clientReleaseUploadURLExpires(); got != 86400 {
		t.Fatalf("clientReleaseUploadURLExpires() = %d, want 86400", got)
	}
}

func TestClientReleaseUploadTicketRoundTrip(t *testing.T) {
	cfg := clientReleaseOSSConfig{AccessKeySecret: "secret"}
	ticket := clientReleaseUploadTicket{
		FileName:    "Z-UP-Setup-1.2.3-windows-x64-stable.exe",
		Object:      "client-releases/stable/windows/x64/1.2.3/file.exe",
		Size:        123,
		ContentType: "application/vnd.microsoft.portable-executable",
		ExpiresAt:   4102444800,
	}
	value, err := signClientReleaseUploadTicket(ticket, cfg)
	if err != nil {
		t.Fatalf("signClientReleaseUploadTicket() error = %v", err)
	}
	got, err := parseClientReleaseUploadTicket(value, cfg)
	if err != nil {
		t.Fatalf("parseClientReleaseUploadTicket() error = %v", err)
	}
	if got.FileName != ticket.FileName || got.Object != ticket.Object || got.Size != ticket.Size || got.ContentType != ticket.ContentType || got.ExpiresAt != ticket.ExpiresAt {
		t.Fatalf("parsed ticket = %+v, want %+v", got, ticket)
	}
	if _, err := parseClientReleaseUploadTicket(value+"x", cfg); err == nil {
		t.Fatal("parseClientReleaseUploadTicket() returned nil error for tampered ticket")
	}
}

func TestClientReleaseTempObjectKey(t *testing.T) {
	cfg := clientReleaseOSSConfig{Prefix: "client-releases"}
	key, err := cfg.tempObjectKey("setup.exe")
	if err != nil {
		t.Fatalf("tempObjectKey() error = %v", err)
	}
	if !strings.HasPrefix(key, "client-releases/_tmp/") || !strings.HasSuffix(key, "/setup.exe") {
		t.Fatalf("temp object key = %q", key)
	}
	if !cfg.isTempObjectKey(key) {
		t.Fatalf("isTempObjectKey(%q) = false, want true", key)
	}
	final := cfg.objectKey(ClientReleaseUploadInput{
		Version:  "1.2.3",
		Platform: "windows",
		Arch:     "x64",
		Channel:  "stable",
	}, "setup.exe")
	if cfg.isTempObjectKey(final) {
		t.Fatalf("final object key %q must not be temporary", final)
	}
}

func TestPromoteClientReleaseObjectSkipsFinalManagedObjectWithoutOSSConfig(t *testing.T) {
	release := &model.ClientRelease{
		Version:   "1.2.3",
		Platform:  "windows",
		Arch:      "x64",
		Channel:   "stable",
		FileName:  "setup.exe",
		ObjectKey: "/client-releases/stable/windows/x64/1.2.3/setup.exe",
	}
	result, err := PromoteClientReleaseObject(release)
	if err != nil {
		t.Fatalf("PromoteClientReleaseObject() error = %v", err)
	}
	if result.Promoted {
		t.Fatal("PromoteClientReleaseObject() promoted a final object")
	}
	if release.ObjectKey != "client-releases/stable/windows/x64/1.2.3/setup.exe" {
		t.Fatalf("release.ObjectKey = %q", release.ObjectKey)
	}
}

func TestPromoteClientReleaseObjectRejectsUnmanagedObject(t *testing.T) {
	release := &model.ClientRelease{ObjectKey: "other-prefix/setup.exe"}
	if _, err := PromoteClientReleaseObject(release); err == nil {
		t.Fatal("PromoteClientReleaseObject() returned nil error for unmanaged object")
	}
}
