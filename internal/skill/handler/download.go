package handler

import (
	"archive/zip"
	"bytes"
	"fmt"
	"mime"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	skillapi "github.com/QuantumNous/new-api/internal/skill/api"
	"github.com/QuantumNous/new-api/internal/skill/enums"
	"github.com/QuantumNous/new-api/internal/skill/errcodes"
	skillmodel "github.com/QuantumNous/new-api/internal/skill/model"
	"github.com/gin-gonic/gin"
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

	if !downloadEntitled(s.RequiredPlan, c.GetString("group")) {
		skillapi.Error(c, errcodes.ErrSkillPlanRequired,
			fmt.Sprintf("This skill requires the %s plan.", s.RequiredPlan), nil)
		return
	}

	zipBytes, err := buildSkillPackage(s)
	if err != nil {
		skillapi.Error(c, errcodes.ErrSkillInternalError, "Failed to build skill package.", nil)
		return
	}

	userID := int64(c.GetInt("id"))
	// DR-55 contract: download creates a download/enablement state record, NOT a
	// standalone execution grant. This row may be used by Relay as one runtime
	// eligibility input, but is never sufficient to authorize execution by itself
	// — runner key + current subscription/entitlement + quota + Kids + lifecycle
	// are all still checked at use time (owned by DR-64/DR-68/M05). No runtime
	// grant / runner token / entitlement override / credential is issued here.
	if err := skillmodel.EnableSkillForUser(db, userID, userID, s.ID, "skill_package"); err != nil {
		skillapi.Error(c, errcodes.ErrSkillInternalError, "Failed to record download.", nil)
		return
	}

	// Emit analytics event with the user's resolved plan (not the skill's required_plan).
	// Log on failure but do not block the download response.
	userPlan := groupToPlan(c.GetString("group"))
	if err := skillmodel.EmitSkillEnabled(db, userID, s.ID, s.ActiveVersionID,
		string(enums.EntryPointSkillPackage), string(userPlan)); err != nil {
		common.SysLog("EmitSkillEnabled failed for skill " + s.ID + ": " + err.Error())
	}

	c.Header("Content-Disposition", mime.FormatMediaType("attachment", map[string]string{
		"filename": s.Slug + ".zip",
	}))
	c.Data(http.StatusOK, "application/zip", zipBytes)
}

// downloadEntitled reports whether the user's group level meets or exceeds the
// skill's required plan. Maps platform group strings to the three-tier hierarchy
// used by the availability resolver (free < pro < enterprise).
func downloadEntitled(required enums.RequiredPlan, userGroup string) bool {
	return downloadPlanLevel(groupToPlan(userGroup)) >= downloadPlanLevel(required)
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

func downloadPlanLevel(p enums.RequiredPlan) int {
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

// ─── Zip builder ─────────────────────────────────────────────────────────────

type skillManifest struct {
	SchemaVersion string `json:"schema_version"`
	SkillID       string `json:"skill_id"`
	// SkillVersionID is nil until DR-41 (skill_versions table) is implemented.
	// When non-nil it pins the zip to the published version at download time.
	SkillVersionID        *string `json:"skill_version_id,omitempty"`
	Slug                  string  `json:"slug"`
	Name                  string  `json:"name"`
	RequiredPlan          string  `json:"required_plan"`
	Category              string  `json:"category"`
	RequiresDeepRouterKey bool    `json:"requires_deeprouter_key"`
}

func buildSkillPackage(s skillmodel.Skill) ([]byte, error) {
	buf := new(bytes.Buffer)
	w := zip.NewWriter(buf)

	manifest := skillManifest{
		SchemaVersion:         "1.0",
		SkillID:               s.ID,
		SkillVersionID:        s.ActiveVersionID,
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
	if err := addZipEntry(w, "manifest.json", manifestJSON); err != nil {
		return nil, err
	}
	if err := addZipEntry(w, "SKILL.md", []byte(buildSkillMD(s))); err != nil {
		return nil, err
	}

	if err := w.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func addZipEntry(w *zip.Writer, name string, content []byte) error {
	f, err := w.Create(name)
	if err != nil {
		return err
	}
	_, err = f.Write(content)
	return err
}

// buildSkillMD assembles a SKILL.md from the skills table fields available before
// DR-41 (skill_versions / instruction_template) is implemented. The result is a
// valid Claude Code SKILL.md that users can load immediately.
func buildSkillMD(s skillmodel.Skill) string {
	var sb strings.Builder

	sb.WriteString("---\n")
	sb.WriteString("name: " + s.Slug + "\n")
	escapedDesc := strings.NewReplacer(`"`, `\"`, "\n", `\n`, "\r", "").Replace(s.ShortDescription)
	sb.WriteString(`description: "` + escapedDesc + `"` + "\n")
	sb.WriteString("---\n\n")

	sb.WriteString("## " + s.Name + "\n\n")
	sb.WriteString(s.Description + "\n")

	var hints []string
	if common.Unmarshal(s.InputHints, &hints) == nil && len(hints) > 0 {
		sb.WriteString("\n### When to Use\n\n")
		for _, h := range hints {
			sb.WriteString("- " + h + "\n")
		}
	}

	return sb.String()
}
