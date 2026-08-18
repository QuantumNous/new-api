package main

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"os"
	"path/filepath"
	"testing"
)

func TestAddProviderAliasNormalizesProviderModelPath(t *testing.T) {
	aliases := map[string]string{}
	err := addProviderAlias(
		"openrouter/models/openai%2Fgpt-5.toml",
		[]byte("base_model = \"openai/gpt-5\"\n"),
		aliases,
	)

	if err != nil {
		t.Fatalf("addProviderAlias() error = %v", err)
	}
	if got := aliases["openrouter/openai/gpt-5"]; got != "openai/gpt-5" {
		t.Fatalf("normalized alias = %q, want %q", got, "openai/gpt-5")
	}
}

func TestAddProviderAliasSkipsMissingBaseModel(t *testing.T) {
	aliases := map[string]string{}
	if err := addProviderAlias("provider/models/model.toml", []byte("name = \"model\"\n"), aliases); err != nil {
		t.Fatalf("addProviderAlias() error = %v", err)
	}
	if len(aliases) != 0 {
		t.Fatalf("aliases = %#v, want empty", aliases)
	}
}

func TestCollectProviderAliasesFromArchive(t *testing.T) {
	archiveData := makeProviderArchive(t, map[string]string{
		"providers/vercel/models/openai%2Fgpt-5.toml": "base_model = \"openai/gpt-5\"\n",
		"providers/vercel/models/without-base.toml":   "name = \"without-base\"\n",
	})
	aliases := map[string]string{}
	if err := collectProviderAliasesFromArchive(archiveData, aliases); err != nil {
		t.Fatalf("collectProviderAliasesFromArchive() error = %v", err)
	}
	if got := aliases["vercel/openai/gpt-5"]; got != "openai/gpt-5" {
		t.Fatalf("archive alias = %q, want %q", got, "openai/gpt-5")
	}
	if _, ok := aliases["vercel/without-base"]; ok {
		t.Fatal("archive entry without base_model should be skipped")
	}
}

func TestCollectProviderAliasesFromArchiveRejectsMalformedTOML(t *testing.T) {
	archiveData := makeProviderArchive(t, map[string]string{
		"providers/provider/models/broken.toml": "base_model = [\n",
	})
	if err := collectProviderAliasesFromArchive(archiveData, map[string]string{}); err == nil {
		t.Fatal("collectProviderAliasesFromArchive() error = nil, want malformed TOML error")
	}
}

func TestCollectProviderAliasesFromArchiveRejectsMalformedArchive(t *testing.T) {
	if err := collectProviderAliasesFromArchive([]byte("not a gzip archive"), map[string]string{}); err == nil {
		t.Fatal("collectProviderAliasesFromArchive() error = nil, want archive error")
	}
}

func TestFailedProviderSyncLeavesExistingCatalogUntouched(t *testing.T) {
	path := filepath.Join(t.TempDir(), "catalog.json")
	original := []byte(`{"version":"previous"}`)
	if err := os.WriteFile(path, original, 0o600); err != nil {
		t.Fatal(err)
	}

	aliases := map[string]string{}
	if err := collectProviderAliasesFromArchive([]byte("broken"), aliases); err == nil {
		t.Fatal("expected provider sync failure")
	}
	got, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(got, original) {
		t.Fatalf("existing catalog changed after failed sync: got %q, want %q", got, original)
	}
}

func makeProviderArchive(t *testing.T, files map[string]string) []byte {
	t.Helper()
	var compressed bytes.Buffer
	gzipWriter := gzip.NewWriter(&compressed)
	tarWriter := tar.NewWriter(gzipWriter)
	for name, contents := range files {
		data := []byte(contents)
		header := &tar.Header{Name: name, Mode: 0o644, Size: int64(len(data))}
		if err := tarWriter.WriteHeader(header); err != nil {
			t.Fatal(err)
		}
		if _, err := tarWriter.Write(data); err != nil {
			t.Fatal(err)
		}
	}
	if err := tarWriter.Close(); err != nil {
		t.Fatal(err)
	}
	if err := gzipWriter.Close(); err != nil {
		t.Fatal(err)
	}
	return compressed.Bytes()
}
