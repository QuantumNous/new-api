package handler

import (
	"archive/zip"
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"mime"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	skillapi "github.com/QuantumNous/new-api/internal/skill/api"
	"github.com/QuantumNous/new-api/internal/skill/enums"
	"github.com/QuantumNous/new-api/internal/skill/errcodes"
	skillmodel "github.com/QuantumNous/new-api/internal/skill/model"
	"github.com/QuantumNous/new-api/internal/skill/packageassets"
	"github.com/QuantumNous/new-api/internal/skill/pricing"
	appmodel "github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

var (
	errNoActiveSkillVersion       = errors.New("no active skill version for package build")
	errMissingInstructionTemplate = errors.New("active skill version missing instruction_template")
	errMissingPackageArtifact     = errors.New("skill version package artifact missing")
	errSkillPackageGuardFailed    = errors.New("skill package build guard failed")
)

const (
	kidsAnalyticsDailySaltEnv   = "SKILL_KIDS_ANALYTICS_DAILY_SALT"
	kidsAnalyticsSaltVersionEnv = "SKILL_KIDS_ANALYTICS_SALT_VERSION"
)

// DownloadSkillPackage handles GET /api/v1/marketplace/skills/:id/download.
// :id = skill UUID or slug (matched by the same OR query as GetMarketplaceSkill).
// Requires SkillUserAuth middleware (common user role, login mandatory).
// Entitlement: published skill + user plan >= skill required_plan.
// Side effect: upserts user_enabled_skills (download == enable in V1).
// Response: application/zip attachment named "<slug>.zip".
func DownloadSkillPackage(c *gin.Context) {
	db, ok := skillDB(c)
	if !ok {
		return
	}

	var s skillmodel.Skill
	err := db.Where("status = ?", enums.SkillStatusPublished).
		Where("id = ? OR slug = ?", c.Param("id"), c.Param("id")).
		First(&s).Error
	if err != nil {
		writeSkillLookupError(c, err)
		return
	}

	if code := downloadEntitlementCode(db, s, int64(c.GetInt("id")), c.GetString("group")); code != "" {
		skillapi.Error(c, code, downloadEntitlementMessage(s, code), nil)
		return
	}

	version, zipBytes, err := packageBytesForCurrentSkillVersion(db, s)
	if err != nil {
		logSkillPackageBuildFailure(s, err)
		skillapi.Error(c, errcodes.ErrSkillInternalError, "Failed to build skill package.", nil)
		return
	}

	sendSkillPackageDownload(c, db, s, version, zipBytes)
}

// DownloadSkillVersionPackage handles GET /api/v1/marketplace/skill-versions/:skill_version_id/download.
// It serves the immutable publish-time artifact pinned to that skill_version_id.
func DownloadSkillVersionPackage(c *gin.Context) {
	db, ok := skillDB(c)
	if !ok {
		return
	}

	versionID := strings.TrimSpace(c.Param("skill_version_id"))
	var version skillmodel.SkillVersion
	if err := db.First(&version, "id = ?", versionID).Error; err != nil {
		writeSkillLookupError(c, err)
		return
	}

	var s skillmodel.Skill
	if err := db.Where("status = ?", enums.SkillStatusPublished).First(&s, "id = ?", version.SkillID).Error; err != nil {
		writeSkillLookupError(c, err)
		return
	}

	if code := downloadEntitlementCode(db, s, int64(c.GetInt("id")), c.GetString("group")); code != "" {
		skillapi.Error(c, code, downloadEntitlementMessage(s, code), nil)
		return
	}

	zipBytes, err := storedPackageBytes(version)
	if err != nil {
		logSkillPackageBuildFailure(s, err)
		skillapi.Error(c, errcodes.ErrSkillInternalError, "Skill version package artifact is unavailable.", nil)
		return
	}

	sendSkillPackageDownload(c, db, s, version, zipBytes)
}

func sendSkillPackageDownload(c *gin.Context, db *gorm.DB, s skillmodel.Skill, version skillmodel.SkillVersion, zipBytes []byte) {
	userID := int64(c.GetInt("id"))
	// DR-55 contract: download creates a download/enablement state record, NOT a
	// standalone execution grant. This row may be used by Relay as one runtime
	// eligibility input, but is never sufficient to authorize execution by itself
	// - runner key + current subscription/entitlement + quota + Kids + lifecycle
	// are all still checked at use time (owned by DR-64/DR-68/M05). No runtime
	// grant / runner token / entitlement override / credential is issued here.
	if err := skillmodel.EnableSkillForUser(db, userID, userID, s.ID, "skill_package"); err != nil {
		skillapi.Error(c, errcodes.ErrSkillInternalError, "Failed to record download.", nil)
		return
	}

	entryPoint := downloadEntryPoint(c)
	userPlan := groupToPlan(c.GetString("group"))
	if err := emitSkillEnabledForDownload(db, userID, s, userPlan, entryPoint); err != nil {
		common.SysLog("EmitSkillEnabled failed for skill " + s.ID + " version " + version.ID + ": " + err.Error())
	}

	c.Header("Content-Disposition", mime.FormatMediaType("attachment", map[string]string{
		"filename": s.Slug + ".zip",
	}))
	c.Data(http.StatusOK, "application/zip", zipBytes)
}

func downloadEntitlementCode(db *gorm.DB, s skillmodel.Skill, userID int64, userGroup string) errcodes.ErrorCode {
	hasOneTimeEntitlement := false
	if userID > 0 {
		ok, err := skillmodel.HasOneTimeEntitlement(db, userID, s.ID)
		if err != nil {
			return errcodes.ErrSkillInternalError
		}
		hasOneTimeEntitlement = ok
	}
	plan, subActive := downloadRuntimePlan(db, userID, userGroup)
	decision := pricing.ResolveEntitlement(pricing.EntitlementInput{
		RequiredPlan:          s.RequiredPlan,
		MonetizationType:      s.MonetizationType,
		UserPlan:              plan,
		SubscriptionActive:    subActive,
		HasOneTimeEntitlement: hasOneTimeEntitlement,
	})
	if decision.Allowed {
		return ""
	}
	return decision.Code
}

func downloadEntitlementMessage(s skillmodel.Skill, code errcodes.ErrorCode) string {
	if code == errcodes.ErrSkillSubscriptionInactive {
		return "This skill requires an active PLUS subscription."
	}
	if s.MonetizationType == enums.MonetizationTypeOneTime {
		return "This skill requires a USD 2 one-time purchase or active PLUS."
	}
	return fmt.Sprintf("This skill requires the %s plan.", s.RequiredPlan)
}

func downloadRuntimePlan(db *gorm.DB, userID int64, group string) (enums.RequiredPlan, bool) {
	groupPlan := groupToPlan(group)
	if userID <= 0 || db == nil || !db.Migrator().HasTable("user_subscriptions") || !db.Migrator().HasTable("subscription_plans") {
		return groupPlan, true
	}

	var rows []struct {
		UpgradeGroup string
		Active       bool
	}
	if err := db.Table("user_subscriptions AS us").
		Select("sp.upgrade_group, us.status = ? AND us.end_time > ? AS active", "active", common.GetTimestamp()).
		Joins("JOIN subscription_plans AS sp ON sp.id = us.plan_id").
		Where("us.user_id = ?", userID).
		Scan(&rows).Error; err != nil || len(rows) == 0 {
		return groupPlan, true
	}

	bestPlan := groupPlan
	for _, row := range rows {
		if !row.Active {
			continue
		}
		plan := groupToPlan(row.UpgradeGroup)
		if planLevel(plan) > planLevel(bestPlan) {
			bestPlan = plan
		}
	}
	return bestPlan, bestPlan == enums.RequiredPlanFree || hasActivePaidSubscription(rows)
}

func hasActivePaidSubscription(rows []struct {
	UpgradeGroup string
	Active       bool
}) bool {
	for _, row := range rows {
		if row.Active && groupToPlan(row.UpgradeGroup) != enums.RequiredPlanFree {
			return true
		}
	}
	return false
}

func downloadEntryPoint(c *gin.Context) enums.EntryPoint {
	if common.GetContextKeyString(c, constant.ContextKeySkillAuthEntryPoint) == string(enums.EntryPointAPIToken) {
		return enums.EntryPointAPIToken
	}
	raw := c.Query("entry_point")
	switch enums.EntryPoint(strings.TrimSpace(raw)) {
	case enums.EntryPointNew:
		return enums.EntryPointNew
	case enums.EntryPointNewWeek:
		return enums.EntryPointNewWeek
	case enums.EntryPointTrending:
		return enums.EntryPointTrending
	case enums.EntryPointRecommended:
		return enums.EntryPointRecommended
	case enums.EntryPointRecoPersonal:
		return enums.EntryPointRecoPersonal
	case enums.EntryPointRecoCodownload:
		return enums.EntryPointRecoCodownload
	case enums.EntryPointLeaderboardWeekly:
		return enums.EntryPointLeaderboardWeekly
	case enums.EntryPointLeaderboardMonthly:
		return enums.EntryPointLeaderboardMonthly
	default:
		return enums.EntryPointSkillPackage
	}
}

func groupToPlan(group string) enums.RequiredPlan {
	switch group {
	case "pro":
		return enums.RequiredPlanPro
	case "enterprise":
		return enums.RequiredPlanEnterprise
	default:
		return enums.RequiredPlanFree
	}
}

func planLevel(p enums.RequiredPlan) int {
	switch p {
	case enums.RequiredPlanFree:
		return 0
	case enums.RequiredPlanPro:
		return 1
	case enums.RequiredPlanEnterprise:
		return 2
	default:
		return -1
	}
}

func emitSkillEnabledForDownload(db *gorm.DB, userID int64, s skillmodel.Skill, userPlan enums.RequiredPlan, entryPoint enums.EntryPoint) error {
	isKidsSession, err := serverResolvedKidsSession(db, userID)
	if err != nil {
		return err
	}
	if !isKidsSession {
		return skillmodel.EmitSkillEnabled(db, userID, s.ID, s.ActiveVersionID,
			string(entryPoint), string(userPlan), s.MonetizationType)
	}

	plan := userPlan
	successVal := true
	skillID := s.ID
	event := skillmodel.SkillUsageEvent{
		EventType:            enums.SkillUsageEventTypeEnabled,
		SkillID:              &skillID,
		SkillVersionID:       s.ActiveVersionID,
		EntryPoint:           entryPoint,
		Plan:                 &plan,
		IsKidsSafeSkill:      &s.IsKidsSafe,
		IsKidsExclusiveSkill: &s.IsKidsExclusive,
		Success:              &successVal,
		Metadata:             skillmodel.SkillTierEventMetadata(s.MonetizationType, userPlan, nil),
	}
	if err := event.ApplyKidsSessionAnalyticsIdentity(userID, userID, kidsAnalyticsSaltVersion(), kidsAnalyticsDailySalt()); err != nil {
		return err
	}
	return skillmodel.EmitSkillUsageEvent(db, event)
}

func serverResolvedKidsSession(db *gorm.DB, userID int64) (bool, error) {
	if !db.Migrator().HasTable(&appmodel.User{}) {
		return false, nil
	}
	var user appmodel.User
	err := db.Select("kids_mode").Where("id = ?", userID).First(&user).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return false, fmt.Errorf("resolve kids_mode for user %d: %w", userID, err)
		}
		return false, err
	}
	return user.KidsMode, nil
}

func kidsAnalyticsDailySalt() []byte {
	return []byte(os.Getenv(kidsAnalyticsDailySaltEnv))
}

func kidsAnalyticsSaltVersion() string {
	return os.Getenv(kidsAnalyticsSaltVersionEnv)
}

// Zip builder.

type skillManifest struct {
	SchemaVersion         string `json:"schema_version"`
	SkillID               string `json:"skill_id"`
	SkillVersionID        string `json:"skill_version_id"`
	Slug                  string `json:"slug"`
	Name                  string `json:"name"`
	RequiredPlan          string `json:"required_plan"`
	Category              string `json:"category"`
	RequiresDeepRouterKey bool   `json:"requires_deeprouter_key"`
}

type skillPackageKind string

const (
	skillPackageKindLegacy     skillPackageKind = "legacy"
	skillPackageKindCapability skillPackageKind = "capability"
)

type skillPackageFile struct {
	Name    string
	Content []byte
}

func buildSkillPackage(db *gorm.DB, s skillmodel.Skill) ([]byte, error) {
	version, err := activeSkillVersionForPackage(db, s)
	if err != nil {
		return nil, err
	}
	return buildSkillPackageForVersion(s, version)
}

func buildSkillPackageForVersion(s skillmodel.Skill, version skillmodel.SkillVersion) ([]byte, error) {
	manifest := skillManifest{
		SchemaVersion:         "1.0",
		SkillID:               s.ID,
		SkillVersionID:        version.ID,
		Slug:                  s.Slug,
		Name:                  s.Name,
		RequiredPlan:          string(s.RequiredPlan),
		Category:              s.Category,
		RequiresDeepRouterKey: true,
	}
	manifestJSON, err := common.Marshal(manifest)
	if err != nil {
		return nil, err
	}

	files := []skillPackageFile{
		{Name: "manifest.json", Content: manifestJSON},
		{Name: "README.md", Content: []byte(buildSkillPackageREADME(s, version))},
		{Name: "SKILL.md", Content: []byte(buildSkillMD(s))},
		{Name: "instruction_template.md", Content: []byte(version.InstructionTemplate)},
		{Name: "runtime/deeprouter_skill_runner.py", Content: packageassets.RuntimeClient()},
		{Name: "runtime/README.md", Content: packageassets.RuntimeREADME()},
	}
	return buildSkillPackageZip(skillPackageKindFor(s), files)
}

func buildSkillPackageREADME(s skillmodel.Skill, version skillmodel.SkillVersion) string {
	var sb strings.Builder
	sb.WriteString("# " + s.Name + "\n\n")
	if strings.TrimSpace(s.ShortDescription) != "" {
		sb.WriteString(s.ShortDescription + "\n\n")
	}
	sb.WriteString("Skill slug: `" + s.Slug + "`\n\n")
	sb.WriteString("Skill version: `" + version.ID + "`\n\n")

	writeMarkdownSection(&sb, "Download Instructions", version.DownloadInstructions)
	writeMarkdownSection(&sb, "Usage Instructions", version.UsageInstructions)
	writeMarkdownListSection(&sb, "Prerequisites", version.Prerequisites)
	writeMarkdownListSection(&sb, "Quickstart", version.Quickstart)
	writeMarkdownExampleIOSection(&sb, version.ExampleIO)

	sb.WriteString("## Runtime Environment\n\n")
	sb.WriteString("- `DEEPROUTER_API_KEY`\n")
	sb.WriteString("- `DEEPROUTER_EXECUTION_API_URL`\n\n")
	sb.WriteString("Run this package through `runtime/deeprouter_skill_runner.py`; do not call provider APIs directly from the package.\n")
	return sb.String()
}

func writeMarkdownSection(sb *strings.Builder, title, body string) {
	sb.WriteString("## " + title + "\n\n")
	trimmed := strings.TrimSpace(body)
	if trimmed == "" {
		sb.WriteString("Not provided.\n\n")
		return
	}
	sb.WriteString(trimmed + "\n\n")
}

func writeMarkdownListSection(sb *strings.Builder, title string, raw skillmodel.SkillJSONB) {
	items := markdownStringList(raw)
	if len(items) == 0 {
		return
	}
	sb.WriteString("## " + title + "\n\n")
	for _, item := range items {
		sb.WriteString("- " + item + "\n")
	}
	sb.WriteString("\n")
}

func writeMarkdownExampleIOSection(sb *strings.Builder, raw skillmodel.SkillJSONB) {
	examples := markdownExampleIO(raw)
	if len(examples) == 0 {
		return
	}
	sb.WriteString("## Example I/O\n\n")
	for i, example := range examples {
		sb.WriteString(fmt.Sprintf("### Example %d\n\n", i+1))
		if strings.TrimSpace(example.Input) != "" {
			sb.WriteString("Input:\n\n")
			sb.WriteString("```text\n" + strings.TrimSpace(example.Input) + "\n```\n\n")
		}
		if strings.TrimSpace(example.Output) != "" {
			sb.WriteString("Output:\n\n")
			sb.WriteString("```text\n" + strings.TrimSpace(example.Output) + "\n```\n\n")
		}
	}
}

func markdownStringList(raw skillmodel.SkillJSONB) []string {
	var values []string
	if err := common.Unmarshal(raw, &values); err == nil {
		out := make([]string, 0, len(values))
		for _, value := range values {
			if trimmed := strings.TrimSpace(value); trimmed != "" {
				out = append(out, trimmed)
			}
		}
		return out
	}
	var objects []struct {
		Text string `json:"text"`
	}
	if err := common.Unmarshal(raw, &objects); err != nil {
		return nil
	}
	out := make([]string, 0, len(objects))
	for _, object := range objects {
		if trimmed := strings.TrimSpace(object.Text); trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}

type markdownIOExample struct {
	Input  string `json:"input"`
	Output string `json:"output"`
}

func markdownExampleIO(raw skillmodel.SkillJSONB) []markdownIOExample {
	var examples []markdownIOExample
	if err := common.Unmarshal(raw, &examples); err != nil {
		return nil
	}
	out := make([]markdownIOExample, 0, len(examples))
	for _, example := range examples {
		if strings.TrimSpace(example.Input) != "" || strings.TrimSpace(example.Output) != "" {
			out = append(out, example)
		}
	}
	return out
}

func packageBytesForCurrentSkillVersion(db *gorm.DB, s skillmodel.Skill) (skillmodel.SkillVersion, []byte, error) {
	version, err := activeSkillVersionForPackage(db, s)
	if err != nil {
		return skillmodel.SkillVersion{}, nil, err
	}
	zipBytes, err := storedPackageBytes(version)
	if err == nil {
		return version, zipBytes, nil
	}
	if !errors.Is(err, errMissingPackageArtifact) {
		return skillmodel.SkillVersion{}, nil, err
	}
	// Compatibility for pre-DR-79 published Skills and old tests: new publishes
	// persist package_zip, but existing rows may not have an artifact yet.
	zipBytes, err = buildSkillPackageForVersion(s, version)
	if err != nil {
		return skillmodel.SkillVersion{}, nil, err
	}
	return version, zipBytes, nil
}

func storedPackageBytes(version skillmodel.SkillVersion) ([]byte, error) {
	if len(version.PackageZip) == 0 {
		return nil, errMissingPackageArtifact
	}
	return append([]byte(nil), version.PackageZip...), nil
}

func storeVersionPackageArtifact(tx *gorm.DB, versionID string, zipBytes []byte, builtAt time.Time) error {
	sum := sha256.Sum256(zipBytes)
	sha := hex.EncodeToString(sum[:])
	return tx.Model(&skillmodel.SkillVersion{}).
		Where("id = ?", versionID).
		Updates(map[string]any{
			"package_zip":      append([]byte(nil), zipBytes...),
			"package_sha256":   sha,
			"package_built_at": builtAt,
		}).Error
}

func skillPackageKindFor(s skillmodel.Skill) skillPackageKind {
	if s.ActiveVersionID == nil {
		return skillPackageKindLegacy
	}
	return skillPackageKindCapability
}

func buildSkillPackageZip(kind skillPackageKind, files []skillPackageFile) ([]byte, error) {
	if err := validateSkillPackageRuntimeDependency(kind, files); err != nil {
		common.SysLog("Skill package build rejected: " + err.Error())
		return nil, err
	}
	if err := validateSkillPackageSecurity(files); err != nil {
		common.SysLog("Skill package build rejected: " + err.Error())
		return nil, err
	}

	buf := new(bytes.Buffer)
	w := zip.NewWriter(buf)
	for _, file := range files {
		if err := addZipEntry(w, file.Name, file.Content); err != nil {
			return nil, err
		}
	}

	if err := w.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func validateSkillPackageSecurity(files []skillPackageFile) error {
	for _, file := range files {
		lower := strings.ToLower(string(file.Content))
		for _, marker := range providerCredentialMarkers() {
			if strings.Contains(lower, marker) {
				return fmt.Errorf("%w: provider credential marker %q in %s", errSkillPackageGuardFailed, marker, file.Name)
			}
		}
		for _, marker := range serverRoutingLogicMarkers() {
			if strings.Contains(lower, marker) {
				return fmt.Errorf("%w: server-side routing/model-selection marker %q in %s", errSkillPackageGuardFailed, marker, file.Name)
			}
		}
	}
	return nil
}

func providerCredentialMarkers() []string {
	return []string{
		"openai_api_key",
		"anthropic_api_key",
		"deepseek_api_key",
		"gemini_api_key",
		"google_api_key",
		"azure_openai_api_key",
		"aws_access_key_id",
		"aws_secret_access_key",
		"bedrock_access_key",
		"sk-ant-",
		"sk-proj-",
		"sk-or-",
	}
}

func serverRoutingLogicMarkers() []string {
	return []string{
		"getrandomsatisfiedchannel",
		"model_whitelist_snapshot",
		"smart_router_client",
		"relay/channel",
		"channel.key",
		"channel_id",
		"key_index",
		"selectmodel(",
		"loadandapply",
		"provider key",
		"priority tier",
	}
}

func activeSkillVersionForPackage(db *gorm.DB, s skillmodel.Skill) (skillmodel.SkillVersion, error) {
	if s.ActiveVersionID == nil || strings.TrimSpace(*s.ActiveVersionID) == "" {
		return skillmodel.SkillVersion{}, errNoActiveSkillVersion
	}

	var version skillmodel.SkillVersion
	err := db.Where("id = ? AND skill_id = ? AND status = ?", *s.ActiveVersionID, s.ID, enums.SkillVersionStatusActive).
		First(&version).Error
	if err != nil {
		return skillmodel.SkillVersion{}, errNoActiveSkillVersion
	}
	if strings.TrimSpace(version.InstructionTemplate) == "" {
		return skillmodel.SkillVersion{}, errMissingInstructionTemplate
	}
	return version, nil
}

func logSkillPackageBuildFailure(s skillmodel.Skill, err error) {
	activeVersionID := "<nil>"
	if s.ActiveVersionID != nil && strings.TrimSpace(*s.ActiveVersionID) != "" {
		activeVersionID = strings.TrimSpace(*s.ActiveVersionID)
	}

	reason := "package build failed"
	switch {
	case errors.Is(err, errNoActiveSkillVersion):
		reason = "package build failed: active skill_version missing or not active"
	case errors.Is(err, errMissingInstructionTemplate):
		reason = "package build failed: active skill_version missing instruction_template"
	}

	common.SysLog(fmt.Sprintf(
		"DownloadSkillPackage %s (skill_id=%s slug=%s active_version_id=%s): %v",
		reason,
		s.ID,
		s.Slug,
		activeVersionID,
		err,
	))
}

func addZipEntry(w *zip.Writer, name string, content []byte) error {
	f, err := w.Create(name)
	if err != nil {
		return err
	}
	_, err = f.Write(content)
	return err
}

func validateSkillPackageRuntimeDependency(kind skillPackageKind, files []skillPackageFile) error {
	if kind != skillPackageKindCapability {
		return nil
	}

	var skillMD string
	for _, file := range files {
		if file.Name == "SKILL.md" {
			skillMD = string(file.Content)
			break
		}
	}
	if strings.TrimSpace(skillMD) == "" {
		return fmt.Errorf("D-09 runtime dependency guard rejected capability package: missing SKILL.md work step")
	}

	workStep := extractSkillWorkStep(skillMD)
	if !hasDeepRouterRoutingCall(workStep) {
		return fmt.Errorf("%w: D-09 runtime dependency guard rejected capability package: work step has no DeepRouter public routing API call", errSkillPackageGuardFailed)
	}
	return nil
}

func extractSkillWorkStep(skillMD string) string {
	lines := strings.Split(strings.ReplaceAll(skillMD, "\r\n", "\n"), "\n")
	var out strings.Builder
	inWorkStep := false
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if isSkillWorkStepHeading(trimmed) {
			inWorkStep = true
			continue
		}
		if inWorkStep && strings.HasPrefix(trimmed, "#") {
			break
		}
		if inWorkStep {
			out.WriteString(line)
			out.WriteByte('\n')
		}
	}
	return out.String()
}

func isSkillWorkStepHeading(line string) bool {
	if !strings.HasPrefix(line, "#") {
		return false
	}
	heading := strings.TrimSpace(strings.TrimLeft(line, "#"))
	lower := strings.ToLower(heading)
	return lower == "work step" ||
		strings.HasPrefix(lower, "work step (") ||
		strings.HasPrefix(lower, "work step:")
}

func hasDeepRouterRoutingCall(workStep string) bool {
	lower := strings.ToLower(workStep)
	if !strings.Contains(lower, "deeprouter") {
		return false
	}
	for _, marker := range []string{
		"/v1/routing/chat/completions",
		"/v1/chat/completions",
		"/v1/responses",
		"/v1/messages",
		"/v1/embeddings",
	} {
		if strings.Contains(lower, marker) {
			return true
		}
	}
	return false
}

// buildSkillMD emits a Claude-compatible wrapper that points runners at the
// packaged DeepRouter runtime client instead of describing a local-only skill.
func buildSkillMD(s skillmodel.Skill) string {
	var sb strings.Builder

	sb.WriteString("---\n")
	sb.WriteString("name: " + s.Slug + "\n")
	escapedDesc := strings.NewReplacer(`"`, `\"`, "\n", `\n`, "\r", "").Replace(s.ShortDescription)
	sb.WriteString(`description: "` + escapedDesc + `"` + "\n")
	sb.WriteString("---\n\n")

	sb.WriteString("## " + s.Name + "\n\n")
	if strings.TrimSpace(s.Description) != "" {
		sb.WriteString(s.Description + "\n\n")
	}

	sb.WriteString("This Skill runs through the DeepRouter runtime client.\n\n")
	sb.WriteString("### Required Environment\n\n")
	sb.WriteString("- `DEEPROUTER_API_KEY`\n")
	sb.WriteString("- `DEEPROUTER_EXECUTION_API_URL`\n\n")
	sb.WriteString("### Run\n\n")
	sb.WriteString("```bash\n")
	sb.WriteString("python runtime/deeprouter_skill_runner.py --input \"...\"\n")
	sb.WriteString("```\n\n")
	sb.WriteString("If `python3` is the available Python 3 command in your environment, use:\n\n")
	sb.WriteString("```bash\n")
	sb.WriteString("python3 runtime/deeprouter_skill_runner.py --input \"...\"\n")
	sb.WriteString("```\n\n")
	sb.WriteString("### Work Step\n\n")
	sb.WriteString("Use `runtime/deeprouter_skill_runner.py` to call DeepRouter with the runner's own credential at POST https://api.deeprouter.co/v1/routing/chat/completions (or another approved DeepRouter public routing endpoint configured via `DEEPROUTER_EXECUTION_API_URL`).\n")
	sb.WriteString("The request must use `manifest.json` for `deeprouter.skill_id` and `deeprouter.skill_version_id`, then base the final answer on the routed DeepRouter response instead of a local-only prompt execution.\n\n")
	sb.WriteString("### Runtime Behavior\n\n")
	sb.WriteString("- The runtime client reads `manifest.json` and `instruction_template.md` from this package.\n")
	sb.WriteString("- The work step must call the DeepRouter execution API using the runner's own credential.\n")
	sb.WriteString("- Do not execute this package as a standalone local-only prompt or direct local LLM skill.\n")
	sb.WriteString("- Do not treat the local `instruction_template.md` as authoritative execution truth.\n")

	var hints []string
	if common.Unmarshal(s.InputHints, &hints) == nil && len(hints) > 0 {
		sb.WriteString("\n### When to Use\n\n")
		for _, h := range hints {
			sb.WriteString("- " + h + "\n")
		}
	}

	return sb.String()
}
