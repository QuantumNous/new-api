package controller

import (
	"archive/zip"
	"bytes"
	"io"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

func TestAddSkillHubExportTestcases(t *testing.T) {
	var content bytes.Buffer
	archive := zip.NewWriter(&content)
	testcases := &model.SkillHubTestcases{
		Slug: "demo-cases",
		Testcases: []model.SkillHubTestcase{
			{ID: 8, Question: "Question", Answer: "# Answer", SortOrder: 1},
		},
	}

	manifestPath, err := addSkillHubExportTestcases(archive, "Demo.Skill_1", testcases)
	if err != nil {
		t.Fatalf("addSkillHubExportTestcases() error = %v", err)
	}
	if manifestPath != "./testcases/Demo.Skill_1.json" {
		t.Fatalf("manifest path = %q", manifestPath)
	}
	if err := archive.Close(); err != nil {
		t.Fatalf("archive.Close() error = %v", err)
	}

	reader, err := zip.NewReader(bytes.NewReader(content.Bytes()), int64(content.Len()))
	if err != nil {
		t.Fatalf("zip.NewReader() error = %v", err)
	}
	if len(reader.File) != 1 || reader.File[0].Name != "testcases/Demo.Skill_1.json" {
		t.Fatalf("archive files = %#v", reader.File)
	}
	file, err := reader.File[0].Open()
	if err != nil {
		t.Fatalf("testcases file Open() error = %v", err)
	}
	data, err := io.ReadAll(file)
	_ = file.Close()
	if err != nil {
		t.Fatalf("testcases file read error = %v", err)
	}
	var roundTrip model.SkillHubTestcases
	if err := common.Unmarshal(data, &roundTrip); err != nil {
		t.Fatalf("testcases JSON error = %v", err)
	}
	if roundTrip.Slug != testcases.Slug || len(roundTrip.Testcases) != 1 {
		t.Fatalf("testcases round trip = %#v", roundTrip)
	}
}

func TestAddSkillHubExportTestcasesSkipsEmptyValue(t *testing.T) {
	var content bytes.Buffer
	archive := zip.NewWriter(&content)

	manifestPath, err := addSkillHubExportTestcases(archive, "demo", nil)
	if err != nil {
		t.Fatalf("addSkillHubExportTestcases() error = %v", err)
	}
	if manifestPath != "" {
		t.Fatalf("manifest path = %q, want empty", manifestPath)
	}
	if err := archive.Close(); err != nil {
		t.Fatalf("archive.Close() error = %v", err)
	}

	reader, err := zip.NewReader(bytes.NewReader(content.Bytes()), int64(content.Len()))
	if err != nil {
		t.Fatalf("zip.NewReader() error = %v", err)
	}
	if len(reader.File) != 0 {
		t.Fatalf("archive contains %d files, want 0", len(reader.File))
	}
}
