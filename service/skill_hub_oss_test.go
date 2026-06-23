package service

import (
	"bytes"
	"strings"
	"testing"
)

type testMultipartFile struct {
	*bytes.Reader
}

func (f testMultipartFile) Close() error {
	return nil
}

func TestSkillHubOSSConfigObjectKey(t *testing.T) {
	cfg := skillHubOSSConfig{Prefix: "uploads/skills"}
	key := cfg.objectKey("demo.skill", "1.0.0", "demo skill.zip")
	if key != "uploads/skills/demo.skill/demo-skill-1.0.0.zip" {
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
	file := testMultipartFile{bytes.NewReader([]byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n', 0, 0})}
	contentType, ext, err := detectSkillHubIcon(file)
	if err != nil {
		t.Fatalf("detectSkillHubIcon() error = %v", err)
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
