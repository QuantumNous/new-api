package common

import (
	"os"
	"testing"
)

func TestMaskPublicMediaURLsPure(t *testing.T) {
	up := []byte("https://upstream.example.com/v1/media/")
	pub := []byte("https://public.example.com/v1/media/")
	in := `![image](https://upstream.example.com/v1/media/images/img_abc) {"url":"https://upstream.example.com/v1/media/audio/x.mp3"}`
	want := `![image](https://public.example.com/v1/media/images/img_abc) {"url":"https://public.example.com/v1/media/audio/x.mp3"}`
	if got := string(maskPublicMediaURLs([]byte(in), up, pub)); got != want {
		t.Fatalf("mask mismatch\n got: %s\nwant: %s", got, want)
	}
	// Unrelated text stays untouched.
	if got := string(maskPublicMediaURLs([]byte("no media here"), up, pub)); got != "no media here" {
		t.Fatalf("unexpected rewrite: %s", got)
	}
	// Other upstream paths are not rewritten.
	if got := string(maskPublicMediaURLs([]byte("https://upstream.example.com/v1/responses"), up, pub)); got != "https://upstream.example.com/v1/responses" {
		t.Fatalf("unexpected rewrite: %s", got)
	}
}

func TestMaskPublicMediaURLsDisabledByDefault(t *testing.T) {
	os.Unsetenv("MEDIA_UPSTREAM_ORIGIN")
	os.Unsetenv("MEDIA_PUBLIC_ORIGIN")
	in := "https://upstream.example.com/v1/media/x"
	if got := string(MaskPublicMediaURLs([]byte(in))); got != in {
		t.Fatalf("mask should be a no-op when unset, got %s", got)
	}
}

func TestMaskPublicMediaURLsEnabled(t *testing.T) {
	t.Setenv("MEDIA_UPSTREAM_ORIGIN", "https://upstream.example.com")
	t.Setenv("MEDIA_PUBLIC_ORIGIN", "https://public.example.com")
	in := "see https://upstream.example.com/v1/media/images/img_1"
	want := "see https://public.example.com/v1/media/images/img_1"
	if got := string(MaskPublicMediaURLs([]byte(in))); got != want {
		t.Fatalf("got %s, want %s", got, want)
	}
}
