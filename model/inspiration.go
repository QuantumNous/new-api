package model

import (
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type InspirationTemplateVersion struct {
	Id              int    `json:"id" gorm:"primaryKey;autoIncrement"`
	TemplateId      int    `json:"template_id" gorm:"uniqueIndex:idx_inspiration_template_version;not null"`
	Version         int    `json:"version" gorm:"uniqueIndex:idx_inspiration_template_version;not null"`
	State           string `json:"state" gorm:"type:varchar(16);not null;index"`
	PromptTemplate  string `json:"prompt_template" gorm:"type:text;not null"`
	NegativePrompt  string `json:"negative_prompt" gorm:"type:text"`
	Explanation     string `json:"explanation" gorm:"type:text"`
	TagsJSON        string `json:"tags_json" gorm:"type:text;not null"`
	VariablesJSON   string `json:"variables_json" gorm:"type:text;not null"`
	ModelPolicyJSON string `json:"model_policy_json" gorm:"type:text;not null"`
	ParametersJSON  string `json:"parameters_json" gorm:"type:text;not null"`
	CoversJSON      string `json:"covers_json" gorm:"type:text;not null"`
	ExamplesJSON    string `json:"examples_json" gorm:"type:text;not null"`
	CreatedAt       int64  `json:"created_at" gorm:"bigint"`
	ReleasedAt      *int64 `json:"released_at" gorm:"bigint"`
}

func (InspirationTemplateVersion) TableName() string { return "inspiration_template_versions" }

type InspirationCollection struct {
	Id        int    `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId    int    `json:"user_id" gorm:"not null;index"`
	Name      string `json:"name" gorm:"type:varchar(128);not null"`
	CreatedAt int64  `json:"created_at" gorm:"bigint"`
	UpdatedAt int64  `json:"updated_at" gorm:"bigint"`
}

func (InspirationCollection) TableName() string { return "inspiration_collections" }

type InspirationSave struct {
	Id           int   `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId       int   `json:"user_id" gorm:"uniqueIndex:idx_inspiration_save;not null"`
	CollectionId int   `json:"collection_id" gorm:"uniqueIndex:idx_inspiration_save;not null"`
	TemplateId   int   `json:"template_id" gorm:"uniqueIndex:idx_inspiration_save;not null"`
	CreatedAt    int64 `json:"created_at" gorm:"bigint"`
}

func (InspirationSave) TableName() string { return "inspiration_saves" }

type InspirationEvent struct {
	Id         int    `json:"id" gorm:"primaryKey;autoIncrement"`
	EventId    string `json:"event_id" gorm:"type:varchar(64);uniqueIndex;not null"`
	TemplateId int    `json:"template_id" gorm:"index;not null"`
	VersionId  int    `json:"version_id" gorm:"index;not null"`
	UserId     int    `json:"user_id" gorm:"index"`
	Type       string `json:"type" gorm:"type:varchar(16);not null;index"`
	CreatedAt  int64  `json:"created_at" gorm:"bigint;index"`
}

func (InspirationEvent) TableName() string { return "inspiration_events" }

type InspirationVariable struct {
	Key          string   `json:"key"`
	Label        string   `json:"label"`
	Type         string   `json:"type"`
	Required     bool     `json:"required"`
	DefaultValue any      `json:"default_value"`
	Placeholder  string   `json:"placeholder"`
	Options      []string `json:"options"`
	Min          *float64 `json:"min"`
	Max          *float64 `json:"max"`
	MaxLength    *int     `json:"max_length"`
}
type InspirationModelPolicy struct {
	Recommended []string `json:"recommended"`
	Compatible  []string `json:"compatible"`
}
type InspirationCovers struct {
	Small  string `json:"small"`
	Medium string `json:"medium"`
	Large  string `json:"large"`
}
type InspirationExample struct {
	URL     string `json:"url"`
	Caption string `json:"caption"`
}
type InspirationRecipeDTO struct {
	Id             int                    `json:"id"`
	Slug           string                 `json:"slug"`
	CategorySlug   string                 `json:"category_slug"`
	Title          string                 `json:"title"`
	Description    string                 `json:"description"`
	Modality       string                 `json:"modality"`
	PromptTemplate string                 `json:"prompt_template"`
	NegativePrompt string                 `json:"negative_prompt"`
	Explanation    string                 `json:"explanation"`
	Tags           []string               `json:"tags"`
	Variables      []InspirationVariable  `json:"variables"`
	ModelPolicy    InspirationModelPolicy `json:"model_policy"`
	Parameters     map[string]any         `json:"parameters"`
	Covers         InspirationCovers      `json:"covers"`
	Examples       []InspirationExample   `json:"examples"`
	UseCount       int                    `json:"use_count"`
	VersionId      int                    `json:"version_id"`
	Featured       bool                   `json:"featured"`
}

func ListInspirationCategories() ([]InspirationCategory, error) {
	var v []InspirationCategory
	return v, DB.Where("status <> ?", "archived").Order("sort_order,id").Find(&v).Error
}

func ListAllInspirationCategories() ([]InspirationCategory, error) {
	var v []InspirationCategory
	return v, DB.Order("sort_order,id").Find(&v).Error
}

type AdminInspirationTemplateDTO struct {
	InspirationTemplate
	CategorySlug string `json:"category_slug"`
}

func ListAdminInspirationTemplates(category, modality string, offset, limit int) ([]AdminInspirationTemplateDTO, int64, error) {
	q := DB.Table("inspiration_templates t").Joins("JOIN inspiration_categories c ON c.id=t.category_id")
	if category != "" && category != "all" {
		q = q.Where("c.slug = ?", category)
	}
	if modality != "" && modality != "all" {
		q = q.Where("t.modality = ?", modality)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var templates []AdminInspirationTemplateDTO
	err := q.Select("t.*, c.slug category_slug").Order("t.sort_order,t.id").Offset(offset).Limit(limit).Scan(&templates).Error
	return templates, total, err
}

func ListInspirationRecipes(category, modality string, offset, limit int, admin bool) ([]InspirationRecipeDTO, int64, error) {
	q := DB.Table("inspiration_templates t").Joins("JOIN inspiration_categories c ON c.id=t.category_id")
	if !admin {
		q = q.Where("t.status = ? AND c.status <> ? AND t.published_version_id IS NOT NULL", "published", "archived")
	}
	if category != "" && category != "all" {
		q = q.Where("c.slug = ?", category)
	}
	if modality != "" && modality != "all" {
		q = q.Where("t.modality = ?", modality)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	// The version columns are named explicitly rather than embedded: both models
	// carry id and created_at, so embedding them side by side leaves the scan
	// destination for those columns ambiguous.
	type row struct {
		InspirationTemplate
		CategorySlug    string
		VersionId       int
		Version         int
		State           string
		PromptTemplate  string
		NegativePrompt  string
		Explanation     string
		TagsJSON        string
		VariablesJSON   string
		ModelPolicyJSON string
		ParametersJSON  string
		CoversJSON      string
		ExamplesJSON    string
	}
	var rows []row
	err := q.Select("t.*, c.slug category_slug, v.id version_id, v.version, v.state, v.prompt_template, v.negative_prompt, v.explanation, v.tags_json, v.variables_json, v.model_policy_json, v.parameters_json, v.covers_json, v.examples_json").Joins("LEFT JOIN inspiration_template_versions v ON v.id=t.published_version_id").Order("t.sort_order,t.id").Offset(offset).Limit(limit).Scan(&rows).Error
	if err != nil {
		return nil, 0, err
	}
	out := make([]InspirationRecipeDTO, 0, len(rows))
	for i := range rows {
		version := InspirationTemplateVersion{
			Id:              rows[i].VersionId,
			TemplateId:      rows[i].Id,
			Version:         rows[i].Version,
			State:           rows[i].State,
			PromptTemplate:  rows[i].PromptTemplate,
			NegativePrompt:  rows[i].NegativePrompt,
			Explanation:     rows[i].Explanation,
			TagsJSON:        rows[i].TagsJSON,
			VariablesJSON:   rows[i].VariablesJSON,
			ModelPolicyJSON: rows[i].ModelPolicyJSON,
			ParametersJSON:  rows[i].ParametersJSON,
			CoversJSON:      rows[i].CoversJSON,
			ExamplesJSON:    rows[i].ExamplesJSON,
		}
		d, err := recipeDTO(&rows[i].InspirationTemplate, rows[i].CategorySlug, &version)
		if err != nil {
			return nil, 0, err
		}
		out = append(out, d)
	}
	return out, total, nil
}
func GetInspirationRecipe(slug string) (*InspirationRecipeDTO, error) {
	type templateWithCategory struct {
		InspirationTemplate
		CategorySlug string
	}
	var row templateWithCategory
	if err := DB.Table("inspiration_templates t").Select("t.*, c.slug category_slug").Joins("JOIN inspiration_categories c ON c.id=t.category_id").Where("t.slug=? AND t.status=? AND t.published_version_id IS NOT NULL AND c.status<>?", slug, "published", "archived").Scan(&row).Error; err != nil {
		return nil, err
	}
	if row.Id == 0 {
		return nil, gorm.ErrRecordNotFound
	}
	var v InspirationTemplateVersion
	if err := DB.First(&v, *row.PublishedVersionId).Error; err != nil {
		return nil, err
	}
	d, err := recipeDTO(&row.InspirationTemplate, row.CategorySlug, &v)
	return &d, err
}
func recipeDTO(t *InspirationTemplate, category string, v *InspirationTemplateVersion) (InspirationRecipeDTO, error) {
	d := InspirationRecipeDTO{Id: t.Id, Slug: t.Slug, CategorySlug: category, Title: t.Title, Description: t.Description, Modality: t.Modality, PromptTemplate: v.PromptTemplate, NegativePrompt: v.NegativePrompt, Explanation: v.Explanation, UseCount: t.UseCount, VersionId: v.Id, Featured: t.Featured, Tags: []string{}, Variables: []InspirationVariable{}, Parameters: map[string]any{}, Examples: []InspirationExample{}}
	// Keyed by destination, never by the JSON text: equal payloads (legacy rows
	// store "[]" for tags, variables and examples alike) would collapse into one
	// map entry and silently leave the other fields at their zero value.
	for _, field := range []struct {
		src string
		dst any
	}{
		{v.TagsJSON, &d.Tags},
		{v.VariablesJSON, &d.Variables},
		{v.ModelPolicyJSON, &d.ModelPolicy},
		{v.ParametersJSON, &d.Parameters},
		{v.CoversJSON, &d.Covers},
		{v.ExamplesJSON, &d.Examples},
	} {
		if field.src != "" {
			if err := common.UnmarshalJsonStr(field.src, field.dst); err != nil {
				return d, err
			}
		}
	}
	if d.Tags == nil {
		d.Tags = []string{}
	}
	if d.Variables == nil {
		d.Variables = []InspirationVariable{}
	}
	if d.ModelPolicy.Recommended == nil {
		d.ModelPolicy.Recommended = []string{}
	}
	if d.ModelPolicy.Compatible == nil {
		d.ModelPolicy.Compatible = []string{}
	}
	if d.Parameters == nil {
		d.Parameters = map[string]any{}
	}
	if d.Examples == nil {
		d.Examples = []InspirationExample{}
	}
	return d, nil
}

func GetInspirationTemplateForUpdate(tx *gorm.DB, id int, template *InspirationTemplate) error {
	return lockForUpdate(tx).First(template, id).Error
}

func GetInspirationVersionForUpdate(tx *gorm.DB, id int, version *InspirationTemplateVersion) error {
	return lockForUpdate(tx).First(version, id).Error
}

func RecordInspirationEvents(events []InspirationEvent) (int, error) {
	inserted := 0
	err := DB.Transaction(func(tx *gorm.DB) error {
		for i := range events {
			var n int64
			if err := tx.Table("inspiration_template_versions v").Joins("JOIN inspiration_templates t ON t.id=v.template_id").Joins("JOIN inspiration_categories c ON c.id=t.category_id").Where("v.id=? AND v.template_id=? AND v.state=? AND t.status=? AND c.status<>?", events[i].VersionId, events[i].TemplateId, "released", "published", "archived").Count(&n).Error; err != nil {
				return err
			}
			if n != 1 {
				return fmt.Errorf("version does not belong to template")
			}
			events[i].CreatedAt = time.Now().Unix()
			r := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&events[i])
			if r.Error != nil {
				return r.Error
			}
			if r.RowsAffected == 1 {
				inserted++
				if events[i].Type == "apply" {
					if err := tx.Model(&InspirationTemplate{}).Where("id=?", events[i].TemplateId).UpdateColumn("use_count", gorm.Expr("use_count + 1")).Error; err != nil {
						return err
					}
				}
			}
		}
		return nil
	})
	return inserted, err
}
func PutInspirationSave(user, collection, template int) error {
	if collection > 0 {
		var n int64
		if err := DB.Model(&InspirationCollection{}).Where("id=? AND user_id=?", collection, user).Count(&n).Error; err != nil {
			return err
		}
		if n == 0 {
			return gorm.ErrRecordNotFound
		}
	}
	var n int64
	if err := DB.Model(&InspirationTemplate{}).Where("id=? AND status=?", template, "published").Count(&n).Error; err != nil {
		return err
	}
	if n == 0 {
		return gorm.ErrRecordNotFound
	}
	return DB.Clauses(clause.OnConflict{DoNothing: true}).Create(&InspirationSave{UserId: user, CollectionId: collection, TemplateId: template, CreatedAt: time.Now().Unix()}).Error
}
func DeleteInspirationSave(user, collection, template int) error {
	r := DB.Where("user_id=? AND collection_id=? AND template_id=?", user, collection, template).Delete(&InspirationSave{})
	if r.Error != nil {
		return r.Error
	}
	if r.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

type catalogRecipe struct {
	Category, Slug, Title, Description, Modality, Prompt string
	Tags                                                 []string
	Variables                                            []InspirationVariable
	Parameters                                           map[string]any
	Featured                                             bool
}

func officialCatalog() []catalogRecipe {
	defs := []struct{ cat, slug, title, modality, subject, style string }{
		{"product", "studio-product", "Studio product shot", "image", "{{product}} on a seamless {{background}} backdrop", "commercial studio lighting"}, {"product", "luxury-flatlay", "Luxury flat lay", "image", "an editorial flat lay of {{product}} with {{prop}}", "luxury magazine styling"}, {"product", "catalog-cutout", "Clean catalog cutout", "image", "{{product}} centered on {{background}}", "clean ecommerce lighting"},
		{"portrait", "cinematic-portrait", "Cinematic portrait", "image", "a portrait of {{subject}} in {{setting}}", "cinematic natural light"}, {"portrait", "professional-headshot", "Professional headshot", "image", "a professional headshot of {{subject}} wearing {{wardrobe}}", "soft corporate studio light"}, {"portrait", "editorial-fashion", "Editorial fashion portrait", "image", "{{subject}} in {{wardrobe}}", "bold editorial lighting"},
		{"marketing", "social-launch", "Social launch creative", "image", "a launch visual for {{product}} with headline {{headline}}", "high-conversion campaign design"}, {"marketing", "event-poster", "Event poster", "image", "a poster for {{event}} on {{date}}", "strong typographic hierarchy"}, {"marketing", "email-campaign", "Email campaign copy", "chat", "an email campaign for {{product}} aimed at {{audience}}", "persuasive concise copy"},
		{"ui", "saas-dashboard", "SaaS dashboard concept", "image", "a dashboard for {{product}} showing {{metric}}", "accessible modern interface"}, {"ui", "mobile-onboarding", "Mobile onboarding flow", "image", "onboarding for {{app}} focused on {{benefit}}", "clear friendly mobile UI"}, {"ui", "landing-page", "Landing page concept", "image", "a landing page for {{product}} targeting {{audience}}", "conversion-focused web design"},
		{"illustration", "storybook-scene", "Storybook scene", "image", "{{character}} exploring {{place}}", "warm textured storybook illustration"}, {"illustration", "isometric-world", "Isometric world", "image", "an isometric {{place}} featuring {{feature}}", "precise playful 3D illustration"}, {"illustration", "editorial-metaphor", "Editorial metaphor", "image", "a visual metaphor for {{topic}} using {{symbol}}", "minimal editorial illustration"},
		{"architecture", "modern-villa", "Modern villa visualization", "image", "a modern villa in {{location}} using {{material}}", "photoreal architectural visualization"}, {"architecture", "interior-mood", "Interior mood concept", "image", "a {{room}} interior in {{style}} style", "realistic material and daylight"}, {"architecture", "urban-masterplan", "Urban masterplan", "image", "a masterplan for {{district}} prioritizing {{priority}}", "detailed aerial architecture rendering"},
		{"video", "product-orbit", "Product orbit video", "video", "a slow orbit around {{product}} on {{surface}}", "cinematic controlled motion"}, {"video", "cinematic-establishing", "Cinematic establishing shot", "video", "an establishing shot of {{location}} at {{time}}", "smooth cinematic camera motion"}, {"video", "social-motion", "Social motion graphic", "video", "a motion graphic for {{brand}} announcing {{message}}", "energetic readable animation"},
		{"writing", "product-copy", "Product copywriter", "chat", "product copy for {{product}} aimed at {{audience}}", "specific benefit-led writing"}, {"writing", "blog-outline", "Expert blog outline", "chat", "an expert outline about {{topic}} for {{audience}}", "logical SEO-aware structure"}, {"writing", "brand-story", "Brand story", "chat", "a brand story for {{brand}} built around {{value}}", "authentic memorable narrative"}}
	placeholderPattern := regexp.MustCompile(`\{\{([a-z][a-z0-9_]*)\}\}`)
	out := make([]catalogRecipe, 0, 24)
	for _, d := range defs {
		variables := placeholderPattern.FindAllStringSubmatch(d.subject, -1)
		vars := make([]InspirationVariable, 0, len(variables)+1)
		seen := make(map[string]bool, len(variables)+1)
		for _, match := range variables {
			if seen[match[1]] {
				continue
			}
			seen[match[1]] = true
			vars = append(vars, InspirationVariable{Key: match[1], Label: strings.Title(strings.ReplaceAll(match[1], "_", " ")), Type: "text", Required: true, DefaultValue: "your " + strings.ReplaceAll(match[1], "_", " "), Placeholder: "Describe " + strings.ReplaceAll(match[1], "_", " ")})
		}
		if !seen["style"] {
			vars = append(vars, InspirationVariable{Key: "style", Label: "Creative direction", Type: "text", Required: true, DefaultValue: d.style, Placeholder: "Describe the direction"})
		}
		parameters := map[string]any{}
		if d.modality == "image" {
			parameters["quality"] = "high"
		}
		out = append(out, catalogRecipe{Category: d.cat, Slug: d.slug, Title: d.title, Description: "A production-ready recipe for " + strings.ToLower(d.title) + ".", Modality: d.modality, Prompt: "Create " + d.subject + " with " + d.style + ". Creative direction: {{style}}. Deliver a polished, coherent result.", Tags: []string{d.cat, d.modality, "official"}, Variables: vars, Parameters: parameters, Featured: strings.HasSuffix(d.slug, "product") || d.slug == "cinematic-portrait"})
	}
	return out
}

func SyncInspirationCatalog() error {
	now := time.Now().Unix()
	cats := []string{"product", "portrait", "marketing", "ui", "illustration", "architecture", "video", "writing"}
	return DB.Transaction(func(tx *gorm.DB) error {
		ids := map[string]int{}
		for i, s := range cats {
			var c InspirationCategory
			err := tx.Where("slug=?", s).First(&c).Error
			if errors.Is(err, gorm.ErrRecordNotFound) {
				c = InspirationCategory{Slug: s, Name: strings.Title(s), Description: "Official " + s + " recipes", Status: "active", SortOrder: i + 1, CreatedAt: now}
				if err = tx.Create(&c).Error; err != nil {
					return err
				}
			} else if err != nil {
				return err
			}
			if err := tx.Model(&c).Updates(map[string]any{"description": "Official " + s + " recipes", "status": "active", "sort_order": i + 1}).Error; err != nil {
				return err
			}
			ids[s] = c.Id
		}
		for i, r := range officialCatalog() {
			tag, _ := common.Marshal(r.Tags)
			vr, _ := common.Marshal(r.Variables)
			// Empty means "any model of this modality". The browser matches these
			// patterns against model names, so naming the modality here would never
			// resolve and every Apply would fail.
			mp, _ := common.Marshal(InspirationModelPolicy{Recommended: []string{}, Compatible: []string{}})
			pa, _ := common.Marshal(r.Parameters)
			cv, _ := common.Marshal(InspirationCovers{Small: "/inspiration-covers/" + r.Slug + "-480.webp", Medium: "/inspiration-covers/" + r.Slug + "-960.webp", Large: "/inspiration-covers/" + r.Slug + "-1536.webp"})
			ex, _ := common.Marshal([]InspirationExample{})
			var t InspirationTemplate
			err := tx.Where("slug=?", r.Slug).First(&t).Error
			if errors.Is(err, gorm.ErrRecordNotFound) {
				t = InspirationTemplate{CategoryId: ids[r.Category], Slug: r.Slug, Title: r.Title, Prompt: r.Prompt, Modality: r.Modality, CoverURL: "/inspiration-covers/" + r.Slug + "-960.webp", Description: r.Description, Status: "published", Source: "official", Featured: r.Featured, SortOrder: i + 1, CreatedAt: now}
				if err = tx.Create(&t).Error; err != nil {
					return err
				}
			} else if err != nil {
				return err
			}
			needsCanonicalVersion := t.PublishedVersionId == nil || t.Source != "official"
			updates := map[string]any{"category_id": ids[r.Category], "title": r.Title, "modality": r.Modality, "cover_url": "/inspiration-covers/" + r.Slug + "-960.webp", "description": r.Description, "source": "official", "featured": r.Featured, "sort_order": i + 1, "tags_json": string(tag)}
			if needsCanonicalVersion {
				var maxVersion int
				if err := tx.Model(&InspirationTemplateVersion{}).Where("template_id=?", t.Id).Select("COALESCE(MAX(version),0)").Scan(&maxVersion).Error; err != nil {
					return err
				}
				released := now
				v := InspirationTemplateVersion{TemplateId: t.Id, Version: maxVersion + 1, State: "released", PromptTemplate: r.Prompt, Explanation: "Replace the variables, then refine the creative direction while preserving the requested output structure.", TagsJSON: string(tag), VariablesJSON: string(vr), ModelPolicyJSON: string(mp), ParametersJSON: string(pa), CoversJSON: string(cv), ExamplesJSON: string(ex), CreatedAt: now, ReleasedAt: &released}
				if err := tx.Create(&v).Error; err != nil {
					return err
				}
				updates["published_version_id"] = v.Id
				updates["prompt"] = r.Prompt
				updates["status"] = "published"
			}
			if err := tx.Model(&t).Updates(updates).Error; err != nil {
				return err
			}
		}
		if err := tx.Model(&InspirationTemplate{}).Where("slug IN ?", []string{"golden-hour", "surreal-scene"}).Update("status", "archived").Error; err != nil {
			return err
		}
		if err := tx.Model(&InspirationCategory{}).Where("slug IN ?", []string{"landscape", "creative"}).Update("status", "archived").Error; err != nil {
			return err
		}

		// Preserve operator-created legacy rows while giving them a safe released version.
		var legacy []InspirationTemplate
		if err := tx.Where("published_version_id IS NULL AND slug NOT IN ?", []string{"golden-hour", "surreal-scene"}).Find(&legacy).Error; err != nil {
			return err
		}
		for i := range legacy {
			tags, _ := common.Marshal([]string{})
			vars, _ := common.Marshal([]InspirationVariable{})
			policy, _ := common.Marshal(InspirationModelPolicy{Recommended: []string{}, Compatible: []string{}})
			parameters, _ := common.Marshal(map[string]any{})
			covers, _ := common.Marshal(InspirationCovers{Small: legacy[i].CoverURL, Medium: legacy[i].CoverURL, Large: legacy[i].CoverURL})
			examples, _ := common.Marshal([]InspirationExample{})
			released := now
			v := InspirationTemplateVersion{TemplateId: legacy[i].Id, Version: 1, State: "released", PromptTemplate: legacy[i].Prompt, TagsJSON: string(tags), VariablesJSON: string(vars), ModelPolicyJSON: string(policy), ParametersJSON: string(parameters), CoversJSON: string(covers), ExamplesJSON: string(examples), CreatedAt: now, ReleasedAt: &released}
			if err := tx.Create(&v).Error; err != nil {
				return err
			}
			if err := tx.Model(&legacy[i]).Updates(map[string]any{"published_version_id": v.Id, "status": "published"}).Error; err != nil {
				return err
			}
		}

		// Versions seeded before the fix above put the modality in compatible, so
		// they resolve to no model at all and cannot be applied. Sync already skips
		// rewriting an official row that has a released version, so repair in place.
		anyModel, _ := common.Marshal(InspirationModelPolicy{Recommended: []string{}, Compatible: []string{}})
		for _, modality := range []string{"image", "video", "chat", "audio"} {
			stale, _ := common.Marshal(InspirationModelPolicy{Recommended: []string{}, Compatible: []string{modality}})
			if err := tx.Model(&InspirationTemplateVersion{}).Where("model_policy_json = ?", string(stale)).Update("model_policy_json", string(anyModel)).Error; err != nil {
				return err
			}
		}
		return nil
	})
}
