package service

import (
	"archive/zip"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/model"
)

func TestReadSkillHubMarkdownFromZipPath(t *testing.T) {
	for _, test := range []struct {
		name    string
		entries map[string]string
		want    string
		wantErr bool
	}{
		{name: "root", entries: map[string]string{"SKILL.md": "# Root\n"}, want: "# Root\n"},
		{name: "one top-level directory", entries: map[string]string{"demo/SKILL.md": "# Demo"}, want: "# Demo"},
		{name: "rejects traversal in any entry", entries: map[string]string{"SKILL.md": "# Demo", "../escape.txt": "bad"}, wantErr: true},
		{name: "rejects multiple candidates", entries: map[string]string{"SKILL.md": "# Root", "demo/SKILL.md": "# Demo"}, wantErr: true},
		{name: "rejects deeply nested skill file", entries: map[string]string{"demo/nested/SKILL.md": "# Demo"}, wantErr: true},
	} {
		t.Run(test.name, func(t *testing.T) {
			zipPath := writeSkillHubTestZip(t, test.entries)
			got, err := readSkillHubMarkdownFromZipPath(zipPath)
			if test.wantErr {
				if err == nil {
					t.Fatalf("readSkillHubMarkdownFromZipPath() = %q, want error", got)
				}
				return
			}
			if err != nil {
				t.Fatalf("readSkillHubMarkdownFromZipPath() error = %v", err)
			}
			if got != test.want {
				t.Fatalf("readSkillHubMarkdownFromZipPath() = %q, want %q", got, test.want)
			}
		})
	}
}

func TestReadSkillHubMarkdownFromZipPathEnforcesUncompressedLimit(t *testing.T) {
	zipPath := writeSkillHubTestZip(t, map[string]string{
		"SKILL.md": strings.Repeat("x", model.SkillHubMarkdownMaxBytes+1),
	})
	if _, err := readSkillHubMarkdownFromZipPath(zipPath); err == nil {
		t.Fatal("readSkillHubMarkdownFromZipPath() returned nil error for oversized SKILL.md")
	}
}

func writeSkillHubTestZip(t *testing.T, entries map[string]string) string {
	t.Helper()
	zipPath := filepath.Join(t.TempDir(), "skill.zip")
	file, err := os.Create(zipPath)
	if err != nil {
		t.Fatalf("create zip: %v", err)
	}
	archive := zip.NewWriter(file)
	for name, content := range entries {
		writer, createErr := archive.Create(name)
		if createErr != nil {
			t.Fatalf("create zip entry %q: %v", name, createErr)
		}
		if _, writeErr := writer.Write([]byte(content)); writeErr != nil {
			t.Fatalf("write zip entry %q: %v", name, writeErr)
		}
	}
	if err := archive.Close(); err != nil {
		t.Fatalf("close zip: %v", err)
	}
	if err := file.Close(); err != nil {
		t.Fatalf("close zip file: %v", err)
	}
	return zipPath
}

func TestSkillHubOSSConfigObjectKey(t *testing.T) {
	cfg := skillHubOSSConfig{Prefix: "uploads/skills"}
	key := cfg.objectKey("demo.skill", "1.0.0", "demo skill.zip")
	if !strings.HasPrefix(key, "uploads/skills/demo.skill/demo-skill-1.0.0-") || !strings.HasSuffix(key, ".zip") {
		t.Fatalf("object key = %q", key)
	}
}

func TestSkillHubIconOSSConfigObjectKey(t *testing.T) {
	cfg := skillHubIconOSSConfig{
		skillHubOSSConfig: skillHubOSSConfig{Prefix: "uploads/icons"},
	}
	key := cfg.iconObjectKey("demo.skill", "demo icon.PNG", ".png")
	if !strings.HasPrefix(key, "uploads/icons/demo.skill/demo-icon-") || !strings.HasSuffix(key, ".png") {
		t.Fatalf("icon object key = %q", key)
	}
}

func TestSkillHubIconPublicURL(t *testing.T) {
	got := objectPublicURL("https://z-up-api-public.oss-cn-hangzhou.aliyuncs.com/", "skill-hub/icons/demo skill/icon.png")
	want := "https://z-up-api-public.oss-cn-hangzhou.aliyuncs.com/skill-hub/icons/demo%20skill/icon.png"
	if got != want {
		t.Fatalf("public url = %q, want %q", got, want)
	}
}

func TestDetectSkillHubIconPNG(t *testing.T) {
	contentType, ext, err := detectSkillHubIconHeader([]byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n', 0, 0})
	if err != nil {
		t.Fatalf("detectSkillHubIconHeader() error = %v", err)
	}
	if contentType != "image/png" || ext != ".png" {
		t.Fatalf("contentType = %q, ext = %q", contentType, ext)
	}
}

func TestSkillHubSignedURLExpiresDefault(t *testing.T) {
	t.Setenv("SKILL_HUB_OSS_SIGNED_URL_EXPIRES_SECONDS", "")
	if got := skillHubSignedURLExpires(); got != 600 {
		t.Fatalf("signed url expires = %d, want 600", got)
	}
}

func TestSkillHubSignedURLExpiresCapsAtOneDay(t *testing.T) {
	t.Setenv("SKILL_HUB_OSS_SIGNED_URL_EXPIRES_SECONDS", "999999")
	if got := skillHubSignedURLExpires(); got != 86400 {
		t.Fatalf("signed url expires = %d, want 86400", got)
	}
}

func TestSkillHubSignedURLExpiresUsesConfiguredValue(t *testing.T) {
	t.Setenv("SKILL_HUB_OSS_SIGNED_URL_EXPIRES_SECONDS", "1200")
	if got := skillHubSignedURLExpires(); got != 1200 {
		t.Fatalf("signed url expires = %d, want 1200", got)
	}
}

func TestSkillHubUploadURLExpiresDefault(t *testing.T) {
	t.Setenv("SKILL_HUB_OSS_UPLOAD_URL_EXPIRES_SECONDS", "")
	if got := skillHubUploadURLExpires(); got != defaultSkillHubUploadURLExpiresSeconds {
		t.Fatalf("upload url expires = %d, want %d", got, defaultSkillHubUploadURLExpiresSeconds)
	}
}

func TestSkillHubDirectUploadUsesHTTPSForBareEndpoint(t *testing.T) {
	t.Setenv("SKILL_HUB_OSS_ENDPOINT", "oss-cn-hangzhou.aliyuncs.com")
	t.Setenv("SKILL_HUB_OSS_BUCKET", "private")
	t.Setenv("SKILL_HUB_OSS_ACCESS_KEY_ID", "ak")
	t.Setenv("SKILL_HUB_OSS_ACCESS_KEY_SECRET", "secret")
	t.Setenv("SKILL_HUB_OSS_PREFIX", "skill-hub/skills")

	result, err := InitSkillHubDirectUpload(SkillHubDirectUploadInput{
		Kind:     SkillHubUploadKindZip,
		SkillID:  "demo.skill",
		Version:  "1.0.0",
		FileName: "demo.zip",
		Size:     1,
	})
	if err != nil {
		t.Fatalf("InitSkillHubDirectUpload() error = %v", err)
	}
	if !strings.HasPrefix(result.UploadURL, "https://") {
		t.Fatalf("UploadURL = %q, want https URL", result.UploadURL)
	}
}

func TestSkillHubUploadTicketRoundTrip(t *testing.T) {
	t.Setenv("SKILL_HUB_OSS_ENDPOINT", "https://oss.example.com")
	t.Setenv("SKILL_HUB_OSS_BUCKET", "private")
	t.Setenv("SKILL_HUB_OSS_ACCESS_KEY_ID", "ak")
	t.Setenv("SKILL_HUB_OSS_ACCESS_KEY_SECRET", "secret")
	t.Setenv("SKILL_HUB_OSS_PREFIX", "uploads/skills")

	cfg := loadSkillHubOSSConfig()
	ticket := skillHubUploadTicket{
		Kind:        SkillHubUploadKindZip,
		SkillID:     "demo.skill",
		FileName:    "demo.zip",
		Object:      "uploads/skills/demo.skill/demo-1.0.0-20260101000000.000000000.zip",
		Size:        123,
		ContentType: "application/zip",
		ExpiresAt:   4102444800,
	}
	value, err := signSkillHubUploadTicket(ticket, cfg)
	if err != nil {
		t.Fatalf("signSkillHubUploadTicket() error = %v", err)
	}
	got, _, err := parseSkillHubUploadTicket(value)
	if err != nil {
		t.Fatalf("parseSkillHubUploadTicket() error = %v", err)
	}
	if got.Kind != ticket.Kind || got.SkillID != ticket.SkillID || got.Object != ticket.Object || got.Size != ticket.Size || got.ContentType != ticket.ContentType || got.ExpiresAt != ticket.ExpiresAt {
		t.Fatalf("parsed ticket = %+v, want %+v", got, ticket)
	}
	if _, _, err := parseSkillHubUploadTicket(value + "x"); err == nil {
		t.Fatal("parseSkillHubUploadTicket() returned nil error for tampered ticket")
	}
}

func TestSkillHubTempObjectKey(t *testing.T) {
	cfg := skillHubOSSConfig{Prefix: "skill-hub/skills"}
	key, err := cfg.tempObjectKey("packages", "demo.skill", "demo.zip")
	if err != nil {
		t.Fatalf("tempObjectKey() error = %v", err)
	}
	if !strings.HasPrefix(key, "skill-hub/skills/_tmp/packages/demo.skill/") || !strings.HasSuffix(key, "/demo.zip") {
		t.Fatalf("temp zip object key = %q", key)
	}
	if !cfg.isTempObjectKey(key) {
		t.Fatalf("isTempObjectKey(%q) = false, want true", key)
	}
	final := cfg.objectKey("demo.skill", "1.0.0", "demo.zip")
	if cfg.isTempObjectKey(final) {
		t.Fatalf("final zip object key %q must not be temporary", final)
	}
}

func TestSkillHubIconTempObjectKey(t *testing.T) {
	cfg := skillHubIconOSSConfig{
		skillHubOSSConfig: skillHubOSSConfig{Prefix: "skill-hub/icons"},
	}
	key, err := cfg.tempObjectKey("icons", "demo.skill", "icon.png")
	if err != nil {
		t.Fatalf("tempObjectKey() error = %v", err)
	}
	if !strings.HasPrefix(key, "skill-hub/icons/_tmp/icons/demo.skill/") || !strings.HasSuffix(key, "/icon.png") {
		t.Fatalf("temp icon object key = %q", key)
	}
	if !cfg.isTempObjectKey(key) {
		t.Fatalf("isTempObjectKey(%q) = false, want true", key)
	}
	final := cfg.iconObjectKey("demo.skill", "icon.png", ".png")
	if cfg.isTempObjectKey(final) {
		t.Fatalf("final icon object key %q must not be temporary", final)
	}
}

func TestPromoteSkillHubObjectsSkipsFinalManagedObjectsWithoutOSSConfig(t *testing.T) {
	skill := &model.SkillHubSkill{
		SkillID:   "demo.skill",
		Version:   "1.0.0",
		SourceRef: "/skill-hub/skills/demo.skill/demo.zip",
	}
	result, err := PromoteSkillHubObjects(skill)
	if err != nil {
		t.Fatalf("PromoteSkillHubObjects() error = %v", err)
	}
	if result.ZipPromoted || result.IconPromoted {
		t.Fatal("PromoteSkillHubObjects() promoted final objects")
	}
	if skill.SourceRef != "skill-hub/skills/demo.skill/demo.zip" {
		t.Fatalf("skill.SourceRef = %q", skill.SourceRef)
	}
}

func TestPromoteSkillHubObjectsRejectsUnmanagedSourceRef(t *testing.T) {
	skill := &model.SkillHubSkill{SourceRef: "other-prefix/demo.zip"}
	if _, err := PromoteSkillHubObjects(skill); err == nil {
		t.Fatal("PromoteSkillHubObjects() returned nil error for unmanaged source ref")
	}
}
