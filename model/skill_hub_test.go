package model

import (
	"errors"
	"strings"
	"sync"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func TestSkillHubEvaluationAndTestcasesRoundTrip(t *testing.T) {
	score := func(value float64) *float64 { return &value }
	evaluation := &SkillHubEvaluation{
		OverallRating: "优秀",
		OverallReview: "综合表现稳定",
		Dimensions: SkillHubEvaluationDimensions{
			Trust:         SkillHubEvaluationDimension{Score: score(4.2), Review: "可信"},
			Reliability:   SkillHubEvaluationDimension{Score: score(4.1)},
			Adaptability:  SkillHubEvaluationDimension{Score: score(3.9)},
			Convention:    SkillHubEvaluationDimension{Score: score(4.0)},
			Effectiveness: SkillHubEvaluationDimension{Score: score(4.3)},
		},
	}
	evaluationJSON, err := SkillHubEvaluationToJSON(evaluation)
	if err != nil {
		t.Fatalf("SkillHubEvaluationToJSON() error = %v", err)
	}
	roundTripEvaluation, err := SkillHubEvaluationFromJSON(evaluationJSON)
	if err != nil || roundTripEvaluation == nil {
		t.Fatalf("SkillHubEvaluationFromJSON() = %#v, %v", roundTripEvaluation, err)
	}
	if roundTripEvaluation.OverallScore != nil || *roundTripEvaluation.Dimensions.Trust.Score != 4.2 {
		t.Fatalf("evaluation round trip = %#v", roundTripEvaluation)
	}

	testcases := &SkillHubTestcases{
		Slug:      "does-not-need-to-match-skill-id",
		Testcases: []SkillHubTestcase{{ID: 8, Question: "问题", Answer: "# 回答", SortOrder: 0}},
	}
	testcasesJSON, err := SkillHubTestcasesToJSON(testcases)
	if err != nil {
		t.Fatalf("SkillHubTestcasesToJSON() error = %v", err)
	}
	roundTripTestcases, err := SkillHubTestcasesFromJSON(testcasesJSON)
	if err != nil || roundTripTestcases == nil || roundTripTestcases.Slug != testcases.Slug {
		t.Fatalf("SkillHubTestcasesFromJSON() = %#v, %v", roundTripTestcases, err)
	}
}

func TestValidateSkillHubEvaluationRequiresAllFixedDimensions(t *testing.T) {
	score := 4.0
	evaluation := &SkillHubEvaluation{
		Dimensions: SkillHubEvaluationDimensions{
			Trust: SkillHubEvaluationDimension{Score: &score},
		},
	}
	if err := ValidateSkillHubEvaluation(evaluation); err == nil {
		t.Fatal("ValidateSkillHubEvaluation() returned nil for incomplete dimensions")
	}
}

func TestSkillHubReportIdempotencyAndNotificationClaim(t *testing.T) {
	setupSkillHubTestDB(t)
	skill := &SkillHubSkill{
		SkillID: "reported-skill", Name: "Reported Skill", Version: "1.0.0",
		SourceType: "zip", SourceURL: "https://example.com/reported.zip",
	}
	if err := skill.Insert(); err != nil {
		t.Fatalf("insert skill: %v", err)
	}
	if err := DB.Create(&User{Id: 42, Username: "reporter", Email: "reporter@example.com"}).Error; err != nil {
		t.Fatalf("insert reporter: %v", err)
	}

	const workers = 8
	reports := make([]*SkillHubReport, workers)
	created := make([]bool, workers)
	errorsByWorker := make([]error, workers)
	var wait sync.WaitGroup
	wait.Add(workers)
	for index := 0; index < workers; index++ {
		go func(index int) {
			defer wait.Done()
			reports[index], created[index], errorsByWorker[index] = CreateOrGetSkillHubReport(
				42,
				"report-request-0001",
				skill,
				"发现不安全的提示内容",
			)
		}(index)
	}
	wait.Wait()

	createdCount := 0
	var reportID int
	for index := range reports {
		if errorsByWorker[index] != nil {
			t.Fatalf("worker %d error = %v", index, errorsByWorker[index])
		}
		if reports[index] == nil {
			t.Fatalf("worker %d returned nil report", index)
		}
		if reportID == 0 {
			reportID = reports[index].Id
		} else if reports[index].Id != reportID {
			t.Fatalf("worker %d report id = %d, want %d", index, reports[index].Id, reportID)
		}
		if created[index] {
			createdCount++
		}
	}
	if createdCount != 1 {
		t.Fatalf("created count = %d, want 1", createdCount)
	}

	wins := make([]bool, workers)
	wait.Add(workers)
	for index := 0; index < workers; index++ {
		go func(index int) {
			defer wait.Done()
			wins[index], errorsByWorker[index] = ClaimSkillHubReportNotification(reportID)
		}(index)
	}
	wait.Wait()
	winCount := 0
	for index, won := range wins {
		if errorsByWorker[index] != nil {
			t.Fatalf("claim worker %d error = %v", index, errorsByWorker[index])
		}
		if won {
			winCount++
		}
	}
	if winCount != 1 {
		t.Fatalf("notification claim wins = %d, want 1", winCount)
	}
	if err := FinishSkillHubReportNotification(reportID, SkillHubReportNotificationFailed, "temporary SMTP failure"); err != nil {
		t.Fatalf("finish failed notification: %v", err)
	}
	if won, err := ClaimSkillHubReportNotification(reportID); err != nil || !won {
		t.Fatalf("retry failed notification claim = %v, %v; want true", won, err)
	}

	resolutionErrors := make([]error, 2)
	resolutionResults := make([]*SkillHubAdminReport, 2)
	wait.Add(2)
	for index, status := range []string{SkillHubReportStatusResolved, SkillHubReportStatusDismissed} {
		go func(index int, status string) {
			defer wait.Done()
			resolutionResults[index], resolutionErrors[index] = UpdateSkillHubReportResolution(
				reportID,
				1,
				status,
				"reviewed by administrator",
				100+index,
			)
		}(index, status)
	}
	wait.Wait()
	resolutionWins := 0
	resolutionConflicts := 0
	for index := range resolutionErrors {
		switch {
		case resolutionErrors[index] == nil:
			resolutionWins++
			if resolutionResults[index] == nil || resolutionResults[index].Revision != 2 {
				t.Fatalf("resolution worker %d result = %#v, want revision 2", index, resolutionResults[index])
			}
		case errors.Is(resolutionErrors[index], ErrSkillHubReportConflict):
			resolutionConflicts++
		default:
			t.Fatalf("resolution worker %d error = %v", index, resolutionErrors[index])
		}
	}
	if resolutionWins != 1 || resolutionConflicts != 1 {
		t.Fatalf("resolution wins/conflicts = %d/%d, want 1/1", resolutionWins, resolutionConflicts)
	}
	latest, err := GetSkillHubAdminReport(reportID)
	if err != nil {
		t.Fatalf("get admin report: %v", err)
	}
	if latest.ReporterUsername != "reporter" || latest.ReporterEmail != "reporter@example.com" {
		t.Fatalf("reporter = %q/%q, want reporter/reporter@example.com", latest.ReporterUsername, latest.ReporterEmail)
	}
	items, total, err := SearchSkillHubReports("reported", latest.Status, 0, 20)
	if err != nil {
		t.Fatalf("search reports: %v", err)
	}
	if total != 1 || len(items) != 1 || items[0].Id != reportID {
		t.Fatalf("search result = total %d items %#v, want report %d", total, items, reportID)
	}
	if _, _, err := SearchSkillHubReports("", "", 0, -1); err == nil {
		t.Fatal("search reports accepted an invalid negative page size")
	}
}

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
			SkillID:    "zero-sort-skill",
			Name:       "Zero Sort Skill",
			Version:    "1.0.0",
			Tags:       StringListToJSON([]string{"ordered"}),
			Sort:       0,
			Status:     SkillHubStatusPublished,
			SourceType: "zip",
			SourceURL:  "https://cdn.example.com/zero-sort.zip",
		},
		{
			SkillID:    "newer-first-skill",
			Name:       "Newer First Skill",
			Origin:     "Clawhub",
			OriginURL:  "https://clawhub.ai/skills/newer-first-skill",
			Version:    "1.0.0",
			Tags:       StringListToJSON([]string{"ordered"}),
			Sort:       1,
			Status:     SkillHubStatusPublished,
			SourceType: "zip",
			SourceURL:  "https://cdn.example.com/newer-first.zip",
		},
		{
			SkillID:    "older-first-skill",
			Name:       "Older First Skill",
			Version:    "1.0.0",
			Tags:       StringListToJSON([]string{"ordered"}),
			Sort:       1,
			Status:     SkillHubStatusPublished,
			SourceType: "zip",
			SourceURL:  "https://cdn.example.com/older-first.zip",
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
	}
	for _, skill := range fixtures {
		if err := skill.Insert(); err != nil {
			t.Fatalf("insert %s: %v", skill.SkillID, err)
		}
	}
	if err := DB.Model(&SkillHubSkill{}).
		Where("skill_id = ?", "newer-first-skill").
		UpdateColumn("updated_time", 200).Error; err != nil {
		t.Fatalf("set newer skill timestamp: %v", err)
	}
	if err := DB.Model(&SkillHubSkill{}).
		Where("skill_id = ?", "older-first-skill").
		UpdateColumn("updated_time", 100).Error; err != nil {
		t.Fatalf("set older skill timestamp: %v", err)
	}

	skills, total, err := SearchSkillHubSkills("", true, 0, 10)
	if err != nil {
		t.Fatalf("SearchSkillHubSkills() error = %v", err)
	}
	if total != 4 {
		t.Fatalf("total = %d, want 4", total)
	}
	assertSkillHubSkillIDs(t, skills, []string{"zero-sort-skill", "newer-first-skill", "older-first-skill", "second-skill"})

	tag := mustGetSkillHubTagByName(t, "ordered")
	taggedSkills, taggedTotal, err := SearchSkillHubSkillsByTagIDs([]int{tag.Id}, "", true, 0, 10)
	if err != nil {
		t.Fatalf("SearchSkillHubSkillsByTagIDs() error = %v", err)
	}
	if taggedTotal != 4 {
		t.Fatalf("taggedTotal = %d, want 4", taggedTotal)
	}
	assertSkillHubSkillIDs(t, taggedSkills, []string{"zero-sort-skill", "newer-first-skill", "older-first-skill", "second-skill"})

	originSkills, originTotal, err := SearchSkillHubSkills("Clawhub", true, 0, 10)
	if err != nil || originTotal != 1 {
		t.Fatalf("SearchSkillHubSkills(origin) skills = %#v, total = %d, error = %v", originSkills, originTotal, err)
	}
	assertSkillHubSkillIDs(t, originSkills, []string{"newer-first-skill"})

	taggedOriginSkills, taggedOriginTotal, err := SearchSkillHubSkillsByTagIDs([]int{tag.Id}, "clawhub.ai", true, 0, 10)
	if err != nil || taggedOriginTotal != 1 {
		t.Fatalf("SearchSkillHubSkillsByTagIDs(origin) skills = %#v, total = %d, error = %v", taggedOriginSkills, taggedOriginTotal, err)
	}
	assertSkillHubSkillIDs(t, taggedOriginSkills, []string{"newer-first-skill"})
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
	if err := FavoriteSkillHubSkill(42, skill.Id); err != nil {
		t.Fatalf("favorite skill: %v", err)
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
	var favoriteCount int64
	if err := DB.Model(&SkillHubFavorite{}).Where("skill_id = ?", skill.Id).Count(&favoriteCount).Error; err != nil {
		t.Fatalf("count favorites: %v", err)
	}
	if favoriteCount != 0 {
		t.Fatalf("favorite count = %d; want 0", favoriteCount)
	}
}

func TestSkillHubFavoritesAreIdempotentAndScopedByUser(t *testing.T) {
	setupSkillHubTestDB(t)

	skill := &SkillHubSkill{
		SkillID:    "favorite-skill",
		Name:       "Favorite Skill",
		Version:    "1.0.0",
		Status:     SkillHubStatusPublished,
		SourceType: "zip",
		SourceURL:  "https://example.com/favorite.zip",
	}
	if err := skill.Insert(); err != nil {
		t.Fatalf("create skill: %v", err)
	}
	for attempt := 0; attempt < 2; attempt++ {
		if err := FavoriteSkillHubSkill(10, skill.Id); err != nil {
			t.Fatalf("favorite attempt %d: %v", attempt+1, err)
		}
	}
	if err := FavoriteSkillHubSkill(20, skill.Id); err != nil {
		t.Fatalf("favorite for second user: %v", err)
	}

	var count int64
	if err := DB.Model(&SkillHubFavorite{}).Count(&count).Error; err != nil {
		t.Fatalf("count favorites: %v", err)
	}
	if count != 2 {
		t.Fatalf("favorite count = %d, want one row per user", count)
	}

	for attempt := 0; attempt < 2; attempt++ {
		if err := UnfavoriteSkillHubSkill(10, skill.Id); err != nil {
			t.Fatalf("unfavorite attempt %d: %v", attempt+1, err)
		}
	}
	if err := DB.Model(&SkillHubFavorite{}).Count(&count).Error; err != nil {
		t.Fatalf("count favorites after unfavorite: %v", err)
	}
	if count != 1 {
		t.Fatalf("favorite count after unfavorite = %d, want second user's row preserved", count)
	}
}

func TestSearchFavoriteSkillHubSkillsHidesUnavailableSkillsAndSupportsFilters(t *testing.T) {
	setupSkillHubTestDB(t)

	published := &SkillHubSkill{
		SkillID:    "published-favorite",
		Name:       "Published Favorite",
		Version:    "1.0.0",
		Tags:       StringListToJSON([]string{"office"}),
		Status:     SkillHubStatusPublished,
		SourceType: "zip",
		SourceURL:  "https://example.com/published.zip",
	}
	draft := &SkillHubSkill{
		SkillID:    "draft-favorite",
		Name:       "Draft Favorite",
		Version:    "1.0.0",
		Tags:       StringListToJSON([]string{"office"}),
		Status:     SkillHubStatusPublished,
		SourceType: "zip",
		SourceURL:  "https://example.com/draft.zip",
	}
	for _, skill := range []*SkillHubSkill{published, draft} {
		if err := skill.Insert(); err != nil {
			t.Fatalf("create %s: %v", skill.SkillID, err)
		}
		if err := FavoriteSkillHubSkill(10, skill.Id); err != nil {
			t.Fatalf("favorite %s: %v", skill.SkillID, err)
		}
	}
	if err := DB.Model(draft).Update("status", SkillHubStatusDraft).Error; err != nil {
		t.Fatalf("unpublish draft favorite: %v", err)
	}
	if err := FavoriteSkillHubSkill(20, published.Id); err != nil {
		t.Fatalf("favorite for second user: %v", err)
	}

	officeTag := mustGetSkillHubTagByName(t, "office")
	skills, total, err := SearchFavoriteSkillHubSkills(10, []int{officeTag.Id}, "Published", 0, 10)
	if err != nil {
		t.Fatalf("SearchFavoriteSkillHubSkills() error = %v", err)
	}
	if total != 1 {
		t.Fatalf("favorite total = %d, want only the published matching skill", total)
	}
	assertSkillHubSkillIDs(t, skills, []string{"published-favorite"})

	responses, err := SkillHubSkillsToResponsesForUser(skills, false, 10)
	if err != nil {
		t.Fatalf("SkillHubSkillsToResponsesForUser() error = %v", err)
	}
	if len(responses) != 1 || !responses[0].Favorited {
		t.Fatalf("favorite responses = %#v", responses)
	}

	otherUserSkills, otherTotal, err := SearchFavoriteSkillHubSkills(30, nil, "", 0, 10)
	if err != nil {
		t.Fatalf("other user search error = %v", err)
	}
	if otherTotal != 0 || len(otherUserSkills) != 0 {
		t.Fatalf("other user favorites = %#v, total = %d; want empty", otherUserSkills, otherTotal)
	}
}

func setupSkillHubTestDB(t *testing.T) {
	t.Helper()
	originalDB := DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite memory db: %v", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("open sqlite connection: %v", err)
	}
	sqlDB.SetMaxOpenConns(1)
	if err := db.AutoMigrate(&User{}, &SkillHubSkill{}, &SkillHubTag{}, &SkillHubSkillTag{}, &SkillHubFavorite{}, &SkillHubReport{}); err != nil {
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
