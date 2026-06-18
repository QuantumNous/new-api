package service

import "testing"

func TestSkillHubOSSConfigObjectKey(t *testing.T) {
	cfg := skillHubOSSConfig{Prefix: "uploads/skills"}
	key := cfg.objectKey("demo.skill", "1.0.0", "demo skill.zip")
	if key != "uploads/skills/demo.skill/demo-skill-1.0.0.zip" {
		t.Fatalf("object key = %q", key)
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
