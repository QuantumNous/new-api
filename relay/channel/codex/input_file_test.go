package codex

import (
	"encoding/json"
	"errors"
	"testing"
)

func TestRewriteRemoteInputFiles(t *testing.T) {
	input := json.RawMessage(`[{"role":"user","content":[{"type":"input_text","text":"summarize"},{"type":"input_file","file_url":"https://files.example.com/attachments/47/file.pdf?verify=secret"}]}]`)

	rewritten, err := rewriteRemoteInputFiles(input, func(fileURL string) (string, error) {
		if fileURL != "https://files.example.com/attachments/47/file.pdf?verify=secret" {
			t.Fatalf("loader URL = %q", fileURL)
		}
		return "data:application/pdf;base64,JVBERi0=", nil
	})
	if err != nil {
		t.Fatalf("rewriteRemoteInputFiles() error = %v", err)
	}

	var decoded []map[string]any
	if err := json.Unmarshal(rewritten, &decoded); err != nil {
		t.Fatalf("unmarshal rewritten input: %v", err)
	}
	content := decoded[0]["content"].([]any)
	file := content[1].(map[string]any)
	if _, exists := file["file_url"]; exists {
		t.Fatalf("rewritten input still contains file_url: %#v", file)
	}
	if file["file_data"] != "data:application/pdf;base64,JVBERi0=" {
		t.Fatalf("file_data = %#v", file["file_data"])
	}
	if file["filename"] != "file.pdf" {
		t.Fatalf("filename = %#v, want URL basename", file["filename"])
	}
}

func TestRewriteRemoteInputFilesPreservesInlineAndPropagatesLoadErrors(t *testing.T) {
	inline := json.RawMessage(`[{"role":"user","content":[{"type":"input_file","filename":"report.pdf","file_data":"data:application/pdf;base64,JVBERi0="}]}]`)
	rewritten, err := rewriteRemoteInputFiles(inline, func(string) (string, error) {
		t.Fatal("inline file must not invoke loader")
		return "", nil
	})
	if err != nil {
		t.Fatalf("inline rewrite error = %v", err)
	}
	if string(rewritten) != string(inline) {
		t.Fatalf("inline input changed: %s", rewritten)
	}

	wantErr := errors.New("download failed")
	_, err = rewriteRemoteInputFiles(json.RawMessage(`[{"type":"input_file","file_url":"https://files.example.com/report.pdf"}]`), func(string) (string, error) {
		return "", wantErr
	})
	if !errors.Is(err, wantErr) {
		t.Fatalf("rewrite error = %v, want %v", err, wantErr)
	}
}
