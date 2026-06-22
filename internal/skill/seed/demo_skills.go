// Package seed creates the R2 demo Skills (DR-51) directly via GORM, exercising
// the draft → version → publish lifecycle (DR-46 / DR-47 / DR-48) so each Skill
// ends up published with an active, packaged, downloadable version.
//
// Idempotent on slug: re-running upserts metadata and only creates a new active
// version when the instruction template or tier whitelist actually changed.
package seed

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/internal/skill/enums"
	skillmodel "github.com/QuantumNous/new-api/internal/skill/model"
	"github.com/QuantumNous/new-api/internal/skill/tiers"
	"gorm.io/gorm"
)

// workStepSection is appended to each seeded Skill's Description so the SKILL.md
// rendered by the download packager (internal/skill/handler buildSkillMD, which
// reads only Description) contains a "## Work step" with a DeepRouter routing
// call. This satisfies main's D-09 runtime-dependency guard
// (validateSkillPackageRuntimeDependency) so capability Skills are downloadable,
// and it is literally true: the work step routes through DeepRouter.
//
// The endpoint MUST be the public routing API (/v1/routing/chat/completions), not
// the ordinary /v1/chat/completions: only the routing path is wired to the DR-82
// abuse gate (markSkillPublicRoutingAPI + PublicRoutingAbuseControl in
// router/relay-router.go). Pointing runners at the ordinary chat endpoint would
// bypass that gate, so seeded packages must reference the routing endpoint.
const workStepSection = "\n\n## Work step\n\n" +
	"DeepRouter performs the work step: the downloaded client calls the DeepRouter " +
	"public routing API (POST /v1/routing/chat/completions) using the runner's own key. " +
	"DeepRouter selects the best model for the declared tier from the input and " +
	"returns the result, billed to the runner. Delete this call and the Skill loses " +
	"its routing power.\n"

// Outcome reports what SeedDemoSkills did for one Skill.
type Outcome struct {
	Slug          string
	Action        string // "created" | "updated" | "up-to-date"
	SkillID       string
	VersionID     string
	VersionNumber int
}

// Result aggregates per-Skill outcomes.
type Result struct {
	Outcomes []Outcome
}

// SeedDemoSkills creates/updates the four R2 demo Skills as published, packaged,
// downloadable Skills. createdBy is the platform user id recorded as the author
// (typically the root user, id 1). It validates every tier whitelist against the
// platform alias registry (DR-110) before writing.
func SeedDemoSkills(db *gorm.DB, createdBy int64) (*Result, error) {
	res := &Result{}
	for _, d := range DemoSkills() {
		if bad, ok := tiers.ValidateWhitelist(d.ModelWhitelist); !ok {
			return nil, fmt.Errorf("seed %s: model_whitelist entry %q is not a registered tier alias (DR-110); valid tiers: %v", d.Slug, bad, tiers.List())
		}
		outcome, err := seedOne(db, d, createdBy)
		if err != nil {
			return nil, fmt.Errorf("seed %s: %w", d.Slug, err)
		}
		res.Outcomes = append(res.Outcomes, outcome)
	}
	return res, nil
}

func seedOne(db *gorm.DB, d DemoSkillDef, createdBy int64) (Outcome, error) {
	outcome := Outcome{Slug: d.Slug}
	sha := computeTemplateSHA256(d.InstructionTemplate)

	err := db.Transaction(func(tx *gorm.DB) error {
		// Limit(1).Find (not First) so an absent slug is not logged as an
		// ErrRecordNotFound "error" — non-existence is normal control flow here.
		var found []skillmodel.Skill
		if err := tx.Where("slug = ?", d.Slug).Limit(1).Find(&found).Error; err != nil {
			return err
		}

		if len(found) == 0 {
			skill, err := buildSkill(d, createdBy)
			if err != nil {
				return err
			}
			if err := tx.Create(&skill).Error; err != nil {
				return err
			}
			version, err := buildVersion(skill, d, sha, createdBy, 1)
			if err != nil {
				return err
			}
			if err := tx.Create(&version).Error; err != nil {
				return err
			}
			if err := activateAndPublish(tx, &skill, &version); err != nil {
				return err
			}
			outcome.Action = "created"
			outcome.SkillID = skill.ID
			outcome.VersionID = version.ID
			outcome.VersionNumber = version.VersionNumber
			return nil
		}
		// Skill exists: refresh mutable metadata.
		existing := found[0]
		if err := applyMetadata(&existing, d, createdBy); err != nil {
			return err
		}

		// Up-to-date when the active version already matches template + whitelist.
		if existing.Status == enums.SkillStatusPublished && existing.ActiveVersionID != nil {
			var active skillmodel.SkillVersion
			if err := tx.Where("id = ?", *existing.ActiveVersionID).First(&active).Error; err == nil {
				if active.InstructionTemplateSHA256 == sha && sameStringList(active.ModelWhitelistSnapshot, d.ModelWhitelist) {
					if err := tx.Save(&existing).Error; err != nil {
						return err
					}
					outcome.Action = "up-to-date"
					outcome.SkillID = existing.ID
					outcome.VersionID = active.ID
					outcome.VersionNumber = active.VersionNumber
					return nil
				}
			}
		}

		if err := tx.Save(&existing).Error; err != nil {
			return err
		}
		next, err := nextVersionNumber(tx, existing.ID)
		if err != nil {
			return err
		}
		version, err := buildVersion(existing, d, sha, createdBy, next)
		if err != nil {
			return err
		}
		if err := tx.Create(&version).Error; err != nil {
			return err
		}
		if err := activateAndPublish(tx, &existing, &version); err != nil {
			return err
		}
		outcome.Action = "updated"
		outcome.SkillID = existing.ID
		outcome.VersionID = version.ID
		outcome.VersionNumber = version.VersionNumber
		return nil
	})

	return outcome, err
}

// activateAndPublish makes version the sole active version of skill and marks the
// Skill published. It deactivates any other active version FIRST so the one-active
// invariant (idx_skill_versions_one_active) is never transiently violated.
func activateAndPublish(tx *gorm.DB, skill *skillmodel.Skill, version *skillmodel.SkillVersion) error {
	now := time.Now().UTC()
	if err := tx.Model(&skillmodel.SkillVersion{}).
		Where("skill_id = ? AND status = ? AND id <> ?", skill.ID, enums.SkillVersionStatusActive, version.ID).
		Update("status", enums.SkillVersionStatusInactive).Error; err != nil {
		return err
	}
	version.Status = enums.SkillVersionStatusActive
	version.ActivatedAt = &now
	if err := tx.Save(version).Error; err != nil {
		return err
	}
	skill.Status = enums.SkillStatusPublished
	skill.ActiveVersionID = &version.ID
	if skill.PublishedAt == nil {
		skill.PublishedAt = &now
	}
	return tx.Save(skill).Error
}

func nextVersionNumber(tx *gorm.DB, skillID string) (int, error) {
	var max *int
	if err := tx.Model(&skillmodel.SkillVersion{}).
		Where("skill_id = ?", skillID).
		Select("MAX(version_number)").
		Scan(&max).Error; err != nil {
		return 0, err
	}
	if max == nil {
		return 1, nil
	}
	return *max + 1, nil
}

func buildSkill(d DemoSkillDef, createdBy int64) (skillmodel.Skill, error) {
	skill := skillmodel.Skill{
		Slug:                 d.Slug,
		Status:               enums.SkillStatusDraft,
		Category:             d.Category,
		DefaultLocale:        "en",
		Name:                 d.Name,
		ShortDescription:     d.ShortDescription,
		Description:          d.Description,
		RequiredPlan:         enums.RequiredPlanFree,
		MonetizationType:     enums.MonetizationTypeFree,
		PriceMarkup:          0,
		TimeoutSeconds:       45,
		IsKidsSafe:           false,
		KidsApprovalStatus:   enums.KidsApprovalStatusNotRequired,
		AIDisclosureRequired: true,
		FeaturedFlag:         true,
		CreatedBy:            createdBy,
	}
	if err := applyMetadata(&skill, d, createdBy); err != nil {
		return skillmodel.Skill{}, err
	}
	// createdBy authored this; applyMetadata sets UpdatedBy, clear it for create.
	skill.UpdatedBy = nil
	return skill, nil
}

// applyMetadata copies the mutable public/config fields from the definition onto
// an existing or fresh Skill (everything except identity, lifecycle timestamps,
// and the active version pointer, which the publish step owns).
func applyMetadata(skill *skillmodel.Skill, d DemoSkillDef, actor int64) error {
	tagsJSON, err := toJSONB(d.Tags)
	if err != nil {
		return err
	}
	inputJSON, err := toJSONB(d.InputSchema)
	if err != nil {
		return err
	}
	exInJSON, err := toJSONB(d.ExampleInputs)
	if err != nil {
		return err
	}
	exOutJSON, err := toJSONB(d.ExampleOutputs)
	if err != nil {
		return err
	}
	wlJSON, err := toJSONB(d.ModelWhitelist)
	if err != nil {
		return err
	}

	maxTok := d.MaxInputTokens
	rank := d.FeaturedRank
	actorCopy := actor

	skill.Category = d.Category
	skill.Name = d.Name
	skill.ShortDescription = d.ShortDescription
	skill.Description = d.Description + workStepSection
	skill.Tags = tagsJSON
	skill.InputHints = inputJSON
	skill.ExampleInputs = exInJSON
	skill.ExampleOutputs = exOutJSON
	skill.ModelWhitelist = wlJSON
	skill.MaxInputTokens = &maxTok
	skill.FeaturedFlag = true
	skill.FeaturedRank = &rank
	skill.UpdatedBy = &actorCopy
	return nil
}

func buildVersion(skill skillmodel.Skill, d DemoSkillDef, sha string, createdBy int64, versionNumber int) (skillmodel.SkillVersion, error) {
	outputJSON, err := toJSONB(d.OutputSchema)
	if err != nil {
		return skillmodel.SkillVersion{}, err
	}
	wlJSON, err := toJSONB(d.ModelWhitelist)
	if err != nil {
		return skillmodel.SkillVersion{}, err
	}
	monJSON, err := monetizationSnapshot(skill)
	if err != nil {
		return skillmodel.SkillVersion{}, err
	}
	maxTok := d.MaxInputTokens
	return skillmodel.SkillVersion{
		SkillID:                   skill.ID,
		VersionNumber:             versionNumber,
		Status:                    enums.SkillVersionStatusDraft,
		InstructionTemplate:       d.InstructionTemplate,
		InstructionTemplateSHA256: sha,
		// main's SkillVersion.OutputSchema is *SkillJSONB (nil = no schema); our
		// demo skills all declare one, so take the address of the encoded object.
		OutputSchema:           &outputJSON,
		ModelWhitelistSnapshot: wlJSON,
		RequiredPlanSnapshot:   skill.RequiredPlan,
		MonetizationSnapshot:   monJSON,
		MaxInputTokensSnapshot: &maxTok,
		RolloutPercentage:      100,
		CreatedBy:              createdBy,
	}, nil
}

// monetizationSnapshot builds the version's monetization snapshot object
// (main's SkillVersion has no MonetizationSnapshotJSON helper; build it here).
// free_quota_per_month is included only when set.
func monetizationSnapshot(skill skillmodel.Skill) (skillmodel.SkillJSONB, error) {
	payload := map[string]any{
		"monetization_type": string(skill.MonetizationType),
		"price_markup":      skill.PriceMarkup,
	}
	if skill.FreeQuotaPerMonth != nil {
		payload["free_quota_per_month"] = *skill.FreeQuotaPerMonth
	}
	return toJSONB(payload)
}

// computeTemplateSHA256 returns the lowercase hex SHA-256 of the instruction
// template. main's SkillVersion.BeforeCreate does NOT compute this, so the seeder
// sets it explicitly (integrity check, R2/D-09).
func computeTemplateSHA256(template string) string {
	sum := sha256.Sum256([]byte(template))
	return hex.EncodeToString(sum[:])
}

func toJSONB(v any) (skillmodel.SkillJSONB, error) {
	b, err := common.Marshal(v)
	if err != nil {
		return nil, err
	}
	return skillmodel.SkillJSONB(b), nil
}

func sameStringList(j skillmodel.SkillJSONB, want []string) bool {
	var got []string
	if err := common.Unmarshal(j, &got); err != nil {
		return false
	}
	if len(got) != len(want) {
		return false
	}
	for i := range got {
		if got[i] != want[i] {
			return false
		}
	}
	return true
}
