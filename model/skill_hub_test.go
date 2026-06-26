package model

import (
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

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

func TestValidateSkillHubTag(t *testing.T) {
	if err := ValidateSkillHubTag(&SkillHubTag{Name: "办公协同"}); err != nil {
		t.Fatalf("ValidateSkillHubTag() error = %v", err)
	}
	if err := ValidateSkillHubTag(&SkillHubTag{Name: ""}); err == nil || err.Error() != "tag name is required" {
		t.Fatalf("ValidateSkillHubTag() error = %v, want name required", err)
	}
	if err := ValidateSkillHubTag(&SkillHubTag{Name: "bad/tag"}); err == nil || err.Error() != "tag name cannot contain slashes" {
		t.Fatalf("ValidateSkillHubTag() error = %v, want slash error", err)
	}
}

func TestSkillHubContainsLikePatternEscapesWildcards(t *testing.T) {
	pattern, err := skillHubContainsLikePattern(" 100%_ready! ")
	if err != nil {
		t.Fatalf("skillHubContainsLikePattern() error = %v", err)
	}
	if pattern != "%100!%!_ready!!%" {
		t.Fatalf("pattern = %q, want wildcard characters escaped", pattern)
	}
}

func TestSkillHubContainsLikePatternRejectsLongKeyword(t *testing.T) {
	keyword := ""
	for i := 0; i < skillHubKeywordMaxRunes+1; i++ {
		keyword += "a"
	}
	if _, err := skillHubContainsLikePattern(keyword); err == nil || err.Error() != "keyword is too long" {
		t.Fatalf("skillHubContainsLikePattern() error = %v, want length error", err)
	}
}

func TestSearchSkillHubTagsAndSkillsByTagIDsRespectPublishedVisibility(t *testing.T) {
	setupSkillHubTestDB(t)

	publishedSkill := &SkillHubSkill{
		SkillID:    "published-skill",
		Name:       "Published Skill",
		Version:    "1.0.0",
		Tags:       StringListToJSON([]string{"code", "office"}),
		Status:     SkillHubStatusPublished,
		SourceType: "zip",
		SourceURL:  "https://cdn.example.com/published.zip",
	}
	if err := publishedSkill.Insert(); err != nil {
		t.Fatalf("insert published skill: %v", err)
	}
	draftSkill := &SkillHubSkill{
		SkillID:    "draft-skill",
		Name:       "Draft Skill",
		Version:    "1.0.0",
		Tags:       StringListToJSON([]string{"code", "draft-only"}),
		Status:     SkillHubStatusDraft,
		SourceType: "zip",
		SourceURL:  "https://cdn.example.com/draft.zip",
	}
	if err := draftSkill.Insert(); err != nil {
		t.Fatalf("insert draft skill: %v", err)
	}

	publicTags, total, err := SearchSkillHubTags("", true, 0, 10)
	if err != nil {
		t.Fatalf("SearchSkillHubTags(public) error = %v", err)
	}
	if total != 2 || hasSkillHubTag(publicTags, "draft-only") {
		t.Fatalf("public tags = %#v, total = %d; draft-only tag should be hidden", publicTags, total)
	}

	codeTag := mustGetSkillHubTagByName(t, "code")
	draftTag := mustGetSkillHubTagByName(t, "draft-only")

	publicSkills, total, err := SearchSkillHubSkillsByTagIDs([]int{codeTag.Id, draftTag.Id}, "", false, 0, 10)
	if err != nil {
		t.Fatalf("SearchSkillHubSkillsByTagIDs(public) error = %v", err)
	}
	if total != 1 || len(publicSkills) != 1 || publicSkills[0].SkillID != "published-skill" {
		t.Fatalf("public skills = %#v, total = %d; draft skill should be hidden", publicSkills, total)
	}

	adminSkills, total, err := SearchSkillHubSkillsByTagIDs([]int{codeTag.Id, draftTag.Id}, "", true, 0, 10)
	if err != nil {
		t.Fatalf("SearchSkillHubSkillsByTagIDs(admin) error = %v", err)
	}
	if total != 2 || len(adminSkills) != 2 {
		t.Fatalf("admin skills = %#v, total = %d; want both skills", adminSkills, total)
	}
}

func setupSkillHubTestDB(t *testing.T) {
	t.Helper()
	originalDB := DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite memory db: %v", err)
	}
	if err := db.AutoMigrate(&SkillHubSkill{}, &SkillHubTag{}); err != nil {
		t.Fatalf("migrate skill hub tables: %v", err)
	}
	DB = db
	t.Cleanup(func() {
		DB = originalDB
	})
}

func hasSkillHubTag(tags []*SkillHubTag, name string) bool {
	for _, tag := range tags {
		if tag.Name == name {
			return true
		}
	}
	return false
}

func mustGetSkillHubTagByName(t *testing.T, name string) *SkillHubTag {
	t.Helper()
	var tag SkillHubTag
	if err := DB.Where("name = ?", name).First(&tag).Error; err != nil {
		t.Fatalf("get tag %q: %v", name, err)
	}
	return &tag
}
