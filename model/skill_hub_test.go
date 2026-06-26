package model

import "testing"

func TestValidateSkillHubSkillAcceptsZipSource(t *testing.T) {
	skill := &SkillHubSkill{
		SkillID:    "openai-compatible-image",
		Name:       "OpenAI Compatible Image",
		Version:    "1.0.0",
		SourceType: "zip",
		SourceURL:  "https://cdn.example.com/skill.zip",
	}
	if err := ValidateSkillHubSkill(skill); err != nil {
		t.Fatalf("ValidateSkillHubSkill() error = %v", err)
	}
}

func TestValidateSkillHubSkillRejectsUnsupportedSource(t *testing.T) {
	skill := &SkillHubSkill{
		SkillID:    "dangerous-skill",
		Name:       "Dangerous Skill",
		Version:    "1.0.0",
		SourceType: "git",
		SourceURL:  "https://github.com/example/skill.git",
	}
	if err := ValidateSkillHubSkill(skill); err == nil || err.Error() != "skill source type must be zip" {
		t.Fatalf("ValidateSkillHubSkill() error = %v, want zip-only error", err)
	}
}

func TestValidateSkillHubSkillRequiresHTTPSZipURL(t *testing.T) {
	skill := &SkillHubSkill{
		SkillID:    "local-skill",
		Name:       "Local Skill",
		Version:    "1.0.0",
		SourceType: "zip",
		SourceURL:  "http://example.com/skill.zip",
	}
	if err := ValidateSkillHubSkill(skill); err == nil || err.Error() != "skill zip url must use https, except localhost during development" {
		t.Fatalf("ValidateSkillHubSkill() error = %v, want https error", err)
	}
}

func TestValidateSkillHubSkillAcceptsLocalhostHTTPZipURL(t *testing.T) {
	t.Setenv("SKILL_HUB_ALLOW_LOCAL_HTTP", "true")
	skill := &SkillHubSkill{
		SkillID:    "local-skill",
		Name:       "Local Skill",
		Version:    "1.0.0",
		SourceType: "zip",
		SourceURL:  "http://127.0.0.1:3000/api/skill-hub/skills/local-skill/download",
	}
	if err := ValidateSkillHubSkill(skill); err != nil {
		t.Fatalf("ValidateSkillHubSkill() error = %v", err)
	}
}

func TestValidateSkillHubSkillAcceptsConfiguredOSSIconURL(t *testing.T) {
	t.Setenv("SKILL_HUB_OSS_ICON_PUBLIC_BASE_URL", "https://z-up-api-public.oss-cn-hangzhou.aliyuncs.com")
	t.Setenv("SKILL_HUB_OSS_ICON_PREFIX", "skill-hub/icons")
	skill := &SkillHubSkill{
		SkillID:    "icon-skill",
		Name:       "Icon Skill",
		Version:    "1.0.0",
		Icon:       "https://z-up-api-public.oss-cn-hangzhou.aliyuncs.com/skill-hub/icons/icon-skill/icon.png",
		SourceType: "zip",
		SourceURL:  "https://cdn.example.com/skill.zip",
	}
	if err := ValidateSkillHubSkill(skill); err != nil {
		t.Fatalf("ValidateSkillHubSkill() error = %v", err)
	}
}

func TestValidateSkillHubSkillRejectsExternalIconURL(t *testing.T) {
	t.Setenv("SKILL_HUB_OSS_ICON_PUBLIC_BASE_URL", "https://z-up-api-public.oss-cn-hangzhou.aliyuncs.com")
	t.Setenv("SKILL_HUB_OSS_ICON_PREFIX", "skill-hub/icons")
	skill := &SkillHubSkill{
		SkillID:    "icon-skill",
		Name:       "Icon Skill",
		Version:    "1.0.0",
		Icon:       "https://example.com/icon.png",
		SourceType: "zip",
		SourceURL:  "https://cdn.example.com/skill.zip",
	}
	if err := ValidateSkillHubSkill(skill); err == nil || err.Error() != "skill icon must be uploaded to the configured OSS icon bucket" {
		t.Fatalf("ValidateSkillHubSkill() error = %v, want icon bucket error", err)
	}
}

func TestValidateSkillHubSkillRejectsIconURLWithQuery(t *testing.T) {
	t.Setenv("SKILL_HUB_OSS_ICON_PUBLIC_BASE_URL", "https://z-up-api-public.oss-cn-hangzhou.aliyuncs.com")
	t.Setenv("SKILL_HUB_OSS_ICON_PREFIX", "skill-hub/icons")
	skill := &SkillHubSkill{
		SkillID:    "icon-skill",
		Name:       "Icon Skill",
		Version:    "1.0.0",
		Icon:       "https://z-up-api-public.oss-cn-hangzhou.aliyuncs.com/skill-hub/icons/icon-skill/icon.png?x=1",
		SourceType: "zip",
		SourceURL:  "https://cdn.example.com/skill.zip",
	}
	if err := ValidateSkillHubSkill(skill); err == nil || err.Error() != "skill icon must be uploaded to the configured OSS icon bucket" {
		t.Fatalf("ValidateSkillHubSkill() error = %v, want icon bucket error", err)
	}
}

func TestValidateSkillHubSkillRejectsIconURLWithoutImageExtension(t *testing.T) {
	t.Setenv("SKILL_HUB_OSS_ICON_PUBLIC_BASE_URL", "https://z-up-api-public.oss-cn-hangzhou.aliyuncs.com")
	t.Setenv("SKILL_HUB_OSS_ICON_PREFIX", "skill-hub/icons")
	skill := &SkillHubSkill{
		SkillID:    "icon-skill",
		Name:       "Icon Skill",
		Version:    "1.0.0",
		Icon:       "https://z-up-api-public.oss-cn-hangzhou.aliyuncs.com/skill-hub/icons/icon-skill/file.txt",
		SourceType: "zip",
		SourceURL:  "https://cdn.example.com/skill.zip",
	}
	if err := ValidateSkillHubSkill(skill); err == nil || err.Error() != "skill icon must be uploaded to the configured OSS icon bucket" {
		t.Fatalf("ValidateSkillHubSkill() error = %v, want icon bucket error", err)
	}
}

func TestSkillHubSkillToResponseUsesCurrentCatalogSchema(t *testing.T) {
	skill := &SkillHubSkill{
		SkillID:        "demo-skill",
		Name:           "Demo Skill",
		Description:    "Demo description",
		Version:        "1.2.3",
		Icon:           "https://cdn.example.com/icon.png",
		Tags:           StringListToJSON([]string{"code", "demo"}),
		Verified:       true,
		Sort:           9,
		SourceType:     "zip",
		SourceURL:      "https://cdn.example.com/demo.zip",
		SourceRef:      "skill-hub/skills/demo/1.2.3.zip",
		SourceChecksum: "sha256:abc",
		Status:         SkillHubStatusPublished,
	}

	response := skill.ToResponse(false)
	if response.ID != "demo-skill" {
		t.Fatalf("response.ID = %q", response.ID)
	}
	if response.Name != "Demo Skill" || response.Description != "Demo description" || !response.Verified {
		t.Fatalf("response = %#v", response)
	}
	if len(response.Tags) != 2 || response.Tags[0] != "code" || response.Tags[1] != "demo" {
		t.Fatalf("tags = %#v", response.Tags)
	}
	if response.Source.Type != "zip" || response.Source.URL != "https://cdn.example.com/demo.zip" || response.Source.Checksum != "sha256:abc" {
		t.Fatalf("source = %#v", response.Source)
	}
	if response.Status != 0 || response.Published {
		t.Fatalf("public response leaked admin fields: %#v", response)
	}
	if response.Sort != 0 {
		t.Fatalf("public response leaked sort: %#v", response)
	}
	if response.Source.Ref != "" {
		t.Fatalf("public response leaked source ref: %#v", response.Source)
	}
}
