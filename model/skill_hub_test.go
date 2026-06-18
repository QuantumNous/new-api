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

func TestSkillHubSkillToResponseUsesConnectorSchema(t *testing.T) {
	skill := &SkillHubSkill{
		SkillID:             "demo-skill",
		Name:                "Demo Skill",
		Version:             "1.2.3",
		Tags:                StringListToJSON([]string{"code", "demo"}),
		Permissions:         StringListToJSON([]string{"network"}),
		ConnectorMinVersion: "0.1.0",
		Platforms:           StringListToJSON([]string{"windows", "linux"}),
		ManifestEntry:       "SKILL.md",
		ManifestPermissions: StringListToJSON([]string{"network"}),
		SourceType:          "zip",
		SourceURL:           "https://cdn.example.com/demo.zip",
		SourceRef:           "skill-hub/skills/demo/1.2.3.zip",
		SourceChecksum:      "sha256:abc",
		Status:              SkillHubStatusPublished,
	}

	response := skill.ToResponse(false)
	if response.ID != "demo-skill" {
		t.Fatalf("response.ID = %q", response.ID)
	}
	if response.Compatibility.ConnectorMinVersion != "0.1.0" {
		t.Fatalf("connector min version = %q", response.Compatibility.ConnectorMinVersion)
	}
	if response.Source.Type != "zip" || response.Source.Checksum != "sha256:abc" {
		t.Fatalf("source = %#v", response.Source)
	}
	if len(response.Permissions) != 1 || response.Permissions[0] != "network" {
		t.Fatalf("permissions = %#v", response.Permissions)
	}
	if response.Status != 0 || response.Published {
		t.Fatalf("public response leaked admin fields: %#v", response)
	}
	if response.Source.Ref != "" {
		t.Fatalf("public response leaked source ref: %#v", response.Source)
	}
}
