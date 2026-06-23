package service

import (
	"os"
	"path/filepath"
	"testing"
)

func TestFindCachedImageURLNear(t *testing.T) {
	dir := t.TempDir()
	name := "1782207813343527956.png"
	if err := os.WriteFile(filepath.Join(dir, name), []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}

	got := findCachedImageURLInDir(dir, 1782207813, 46)
	want := imageCachePublicBase + name
	if got != want {
		t.Fatalf("got %q want %q", got, want)
	}
}

func TestResolveLogMediaURLFromTaskID(t *testing.T) {
	// Covered indirectly via EnrichLogMediaURL integration; task lookup needs DB.
	t.Skip("integration")
}
