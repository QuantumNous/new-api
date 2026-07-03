package service

import "testing"

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
