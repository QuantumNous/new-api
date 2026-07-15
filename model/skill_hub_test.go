package model

import (
	"strings"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/driver/postgres"
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

func TestValidateSkillHubSkillOriginMetadata(t *testing.T) {
	base := SkillHubSkill{
		SkillID: "origin-skill", Name: "Origin Skill", Version: "1.0.0",
		SourceType: "zip", SourceURL: "https://cdn.example.com/skill.zip",
	}
	valid := base
	valid.Origin = strings.Repeat("源", 64)
	valid.OriginURL = "https://clawhub.ai/skills/origin-skill"
	if err := ValidateSkillHubSkill(&valid); err != nil {
		t.Fatalf("ValidateSkillHubSkill() valid origin error = %v", err)
	}

	tooLongOrigin := base
	tooLongOrigin.Origin = strings.Repeat("源", 65)
	if err := ValidateSkillHubSkill(&tooLongOrigin); err == nil || err.Error() != "skill origin must be 64 characters or fewer" {
		t.Fatalf("ValidateSkillHubSkill() error = %v, want origin length error", err)
	}

	for _, invalidURL := range []string{"clawhub.ai/skills/demo", "javascript:alert(1)", "https://user:pass@example.com/project"} {
		invalid := base
		invalid.OriginURL = invalidURL
		if err := ValidateSkillHubSkill(&invalid); err == nil || err.Error() != "skill origin url must be an absolute http or https url" {
			t.Fatalf("ValidateSkillHubSkill(%q) error = %v, want origin url error", invalidURL, err)
		}
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
	if err := ValidateSkillHubSkill(skill); err == nil || err.Error() != "skill zip url must use https, except localhost or private network hosts during development" {
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

func TestValidateSkillHubSkillAcceptsPrivateNetworkHTTPZipURL(t *testing.T) {
	t.Setenv("SKILL_HUB_ALLOW_LOCAL_HTTP", "true")
	skill := &SkillHubSkill{
		SkillID:    "lan-skill",
		Name:       "LAN Skill",
		Version:    "1.0.0",
		SourceType: "zip",
		SourceURL:  "http://192.168.1.8:3000/api/skill-hub/skills/lan-skill/download",
	}
	if err := ValidateSkillHubSkill(skill); err != nil {
		t.Fatalf("ValidateSkillHubSkill() error = %v", err)
	}
}

func TestValidateSkillHubSkillRejectsPublicHTTPZipURLWhenLocalHTTPAllowed(t *testing.T) {
	t.Setenv("SKILL_HUB_ALLOW_LOCAL_HTTP", "true")
	skill := &SkillHubSkill{
		SkillID:    "public-http-skill",
		Name:       "Public HTTP Skill",
		Version:    "1.0.0",
		SourceType: "zip",
		SourceURL:  "http://example.com/skill.zip",
	}
	if err := ValidateSkillHubSkill(skill); err == nil || err.Error() != "skill zip url must use https, except localhost or private network hosts during development" {
		t.Fatalf("ValidateSkillHubSkill() error = %v, want public http error", err)
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
		Origin:         "Clawhub",
		OriginURL:      "https://clawhub.ai/skills/demo-skill",
		Icon:           "https://cdn.example.com/icon.png",
		Tags:           StringListToJSON([]string{"code", "demo"}),
		Verified:       true,
		Recommended:    true,
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
	if !response.Recommended {
		t.Fatalf("response.Recommended = false, want true")
	}
	if response.Origin != "Clawhub" || response.OriginURL != "https://clawhub.ai/skills/demo-skill" {
		t.Fatalf("origin metadata = %q, %q", response.Origin, response.OriginURL)
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

func TestSearchRecommendedSkillHubSkillsOnlyReturnsPublishedRecommendedSkills(t *testing.T) {
	setupSkillHubTestDB(t)

	fixtures := []*SkillHubSkill{
		{
			SkillID:     "recommended-one",
			Name:        "Recommended One",
			Version:     "1.0.0",
			Recommended: true,
			Status:      SkillHubStatusPublished,
			SourceType:  "zip",
			SourceURL:   "https://cdn.example.com/recommended-one.zip",
		},
		{
			SkillID:     "recommended-two",
			Name:        "Recommended Two",
			Version:     "1.0.0",
			Recommended: true,
			Status:      SkillHubStatusPublished,
			SourceType:  "zip",
			SourceURL:   "https://cdn.example.com/recommended-two.zip",
		},
		{
			SkillID:     "recommended-draft",
			Name:        "Recommended Draft",
			Version:     "1.0.0",
			Recommended: true,
			Status:      SkillHubStatusDraft,
			SourceType:  "zip",
			SourceURL:   "https://cdn.example.com/recommended-draft.zip",
		},
		{
			SkillID:     "published-regular",
			Name:        "Published Regular",
			Version:     "1.0.0",
			Recommended: false,
			Status:      SkillHubStatusPublished,
			SourceType:  "zip",
			SourceURL:   "https://cdn.example.com/published-regular.zip",
		},
	}
	for _, skill := range fixtures {
		if err := skill.Insert(); err != nil {
			t.Fatalf("insert %s: %v", skill.SkillID, err)
		}
	}

	skills, total, err := SearchRecommendedSkillHubSkills(10)
	if err != nil {
		t.Fatalf("SearchRecommendedSkillHubSkills() error = %v", err)
	}
	if total != 2 || len(skills) != 2 {
		t.Fatalf("skills = %#v, total = %d; want two published recommended skills", skills, total)
	}
	for _, skill := range skills {
		if !skill.Recommended || skill.Status != SkillHubStatusPublished {
			t.Fatalf("unexpected recommended skill: %#v", skill)
		}
	}
}

func TestSearchSkillHubSkillsUsesConfiguredSortOrder(t *testing.T) {
	setupSkillHubTestDB(t)

	fixtures := []*SkillHubSkill{
		{
			SkillID:    "unsorted-skill",
			Name:       "Unsorted Skill",
			Version:    "1.0.0",
			Tags:       StringListToJSON([]string{"ordered"}),
			Sort:       0,
			Status:     SkillHubStatusPublished,
			SourceType: "zip",
			SourceURL:  "https://cdn.example.com/unsorted.zip",
		},
		{
			SkillID:    "second-skill",
			Name:       "Second Skill",
			Version:    "1.0.0",
			Tags:       StringListToJSON([]string{"ordered"}),
			Sort:       2,
			Status:     SkillHubStatusPublished,
			SourceType: "zip",
			SourceURL:  "https://cdn.example.com/second.zip",
		},
		{
			SkillID:    "first-skill",
			Name:       "First Skill",
			Origin:     "Clawhub",
			OriginURL:  "https://clawhub.ai/skills/first-skill",
			Version:    "1.0.0",
			Tags:       StringListToJSON([]string{"ordered"}),
			Sort:       1,
			Status:     SkillHubStatusPublished,
			SourceType: "zip",
			SourceURL:  "https://cdn.example.com/first.zip",
		},
	}
	for _, skill := range fixtures {
		if err := skill.Insert(); err != nil {
			t.Fatalf("insert %s: %v", skill.SkillID, err)
		}
	}

	skills, total, err := SearchSkillHubSkills("", true, 0, 10)
	if err != nil {
		t.Fatalf("SearchSkillHubSkills() error = %v", err)
	}
	if total != 3 {
		t.Fatalf("total = %d, want 3", total)
	}
	assertSkillHubSkillIDs(t, skills, []string{"first-skill", "second-skill", "unsorted-skill"})

	tag := mustGetSkillHubTagByName(t, "ordered")
	taggedSkills, taggedTotal, err := SearchSkillHubSkillsByTagIDs([]int{tag.Id}, "", true, 0, 10)
	if err != nil {
		t.Fatalf("SearchSkillHubSkillsByTagIDs() error = %v", err)
	}
	if taggedTotal != 3 {
		t.Fatalf("taggedTotal = %d, want 3", taggedTotal)
	}
	assertSkillHubSkillIDs(t, taggedSkills, []string{"first-skill", "second-skill", "unsorted-skill"})

	originSkills, originTotal, err := SearchSkillHubSkills("Clawhub", true, 0, 10)
	if err != nil || originTotal != 1 {
		t.Fatalf("SearchSkillHubSkills(origin) skills = %#v, total = %d, error = %v", originSkills, originTotal, err)
	}
	assertSkillHubSkillIDs(t, originSkills, []string{"first-skill"})

	taggedOriginSkills, taggedOriginTotal, err := SearchSkillHubSkillsByTagIDs([]int{tag.Id}, "clawhub.ai", true, 0, 10)
	if err != nil || taggedOriginTotal != 1 {
		t.Fatalf("SearchSkillHubSkillsByTagIDs(origin) skills = %#v, total = %d, error = %v", taggedOriginSkills, taggedOriginTotal, err)
	}
	assertSkillHubSkillIDs(t, taggedOriginSkills, []string{"first-skill"})
}

func TestValidateSkillHubTag(t *testing.T) {
	if err := ValidateSkillHubTag(&SkillHubTag{Name: "办公协同"}); err != nil {
		t.Fatalf("ValidateSkillHubTag() error = %v", err)
	}
	if err := ValidateSkillHubTag(&SkillHubTag{Name: strings.Repeat("标", 40)}); err != nil {
		t.Fatalf("ValidateSkillHubTag() error = %v, want 40 characters allowed", err)
	}
	if err := ValidateSkillHubTag(&SkillHubTag{Name: strings.Repeat("标", 41)}); err == nil || err.Error() != "tag name must be 40 characters or fewer" {
		t.Fatalf("ValidateSkillHubTag() error = %v, want 40 character limit", err)
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

func TestSkillHubSkillsByTagIDsQueryAvoidsPostgresDistinctOrderConflict(t *testing.T) {
	db, err := gorm.Open(postgres.New(postgres.Config{
		DSN:                  "host=localhost user=test dbname=test sslmode=disable",
		PreferSimpleProtocol: true,
	}), &gorm.Config{DryRun: true, DisableAutomaticPing: true})
	if err != nil {
		t.Fatalf("open PostgreSQL dry-run database: %v", err)
	}

	sql := db.ToSQL(func(tx *gorm.DB) *gorm.DB {
		var skills []*SkillHubSkill
		return skillHubSkillsByTagIDsQuery(tx, []int{1, 2}).
			Order(skillHubQualifiedSkillOrder).
			Find(&skills)
	})
	upperSQL := strings.ToUpper(sql)
	if strings.Contains(upperSQL, "DISTINCT") {
		t.Fatalf("PostgreSQL tag query must not use DISTINCT with expression ordering: %s", sql)
	}
	if !strings.Contains(upperSQL, " IN (SELECT ") || !strings.Contains(sql, "skill_hub_skill_tags") {
		t.Fatalf("PostgreSQL tag query must filter through a skill ID subquery: %s", sql)
	}
}

func TestPublicSearchSkillHubTagsDoesNotSyncFromSkills(t *testing.T) {
	setupSkillHubTestDB(t)

	skill := &SkillHubSkill{
		SkillID:    "unsynced-skill",
		Name:       "Unsynced Skill",
		Version:    "1.0.0",
		Tags:       StringListToJSON([]string{"unsynced"}),
		Status:     SkillHubStatusPublished,
		SourceType: "zip",
		SourceURL:  "https://example.com/unsynced.zip",
	}
	if err := DB.Create(skill).Error; err != nil {
		t.Fatalf("create skill directly: %v", err)
	}

	tags, total, err := SearchSkillHubTags("", true, 0, 10)
	if err != nil {
		t.Fatalf("SearchSkillHubTags(public) error = %v", err)
	}
	if total != 0 || len(tags) != 0 {
		t.Fatalf("public tags = %#v, total = %d; want empty without implicit sync", tags, total)
	}
	var tagCount int64
	if err := DB.Model(&SkillHubTag{}).Count(&tagCount).Error; err != nil {
		t.Fatalf("count tags: %v", err)
	}
	if tagCount != 0 {
		t.Fatalf("tag count = %d; want no public read-side writes", tagCount)
	}
}

func TestDeleteSkillHubSkillRemovesTagRelations(t *testing.T) {
	setupSkillHubTestDB(t)

	skill := &SkillHubSkill{
		SkillID:    "delete-skill",
		Name:       "Delete Skill",
		Version:    "1.0.0",
		Tags:       StringListToJSON([]string{"cleanup"}),
		Status:     SkillHubStatusPublished,
		SourceType: "zip",
		SourceURL:  "https://example.com/delete.zip",
	}
	if err := skill.Insert(); err != nil {
		t.Fatalf("create skill: %v", err)
	}
	if err := DeleteSkillHubSkill(skill); err != nil {
		t.Fatalf("delete skill: %v", err)
	}
	counts, err := SkillHubTagUsageCounts([]string{"cleanup"})
	if err != nil {
		t.Fatalf("SkillHubTagUsageCounts() error = %v", err)
	}
	if counts["cleanup"] != 0 {
		t.Fatalf("cleanup usage count = %d; want 0", counts["cleanup"])
	}
}

func setupSkillHubTestDB(t *testing.T) {
	t.Helper()
	originalDB := DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite memory db: %v", err)
	}
	if err := db.AutoMigrate(&SkillHubSkill{}, &SkillHubTag{}, &SkillHubSkillTag{}); err != nil {
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

func assertSkillHubSkillIDs(t *testing.T, skills []*SkillHubSkill, want []string) {
	t.Helper()
	if len(skills) != len(want) {
		t.Fatalf("skills length = %d, want %d; skills = %#v", len(skills), len(want), skills)
	}
	for i, skill := range skills {
		if skill.SkillID != want[i] {
			t.Fatalf("skills[%d].SkillID = %q, want %q; skills = %#v", i, skill.SkillID, want[i], skills)
		}
	}
}

func mustGetSkillHubTagByName(t *testing.T, name string) *SkillHubTag {
	t.Helper()
	var tag SkillHubTag
	if err := DB.Where("name = ?", name).First(&tag).Error; err != nil {
		t.Fatalf("get tag %q: %v", name, err)
	}
	return &tag
}
