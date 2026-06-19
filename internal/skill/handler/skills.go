package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	skillapi "github.com/QuantumNous/new-api/internal/skill/api"
	"github.com/QuantumNous/new-api/internal/skill/enums"
	"github.com/QuantumNous/new-api/internal/skill/errcodes"
	skillmodel "github.com/QuantumNous/new-api/internal/skill/model"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

var db *gorm.DB

func SetDB(database *gorm.DB) {
	db = database
}

var publicSortKeys = map[string]struct{}{
	"name":          {},
	"created_at":    {},
	"featured_rank": {},
}

var adminSortKeys = map[string]struct{}{
	"name":          {},
	"created_at":    {},
	"updated_at":    {},
	"published_at":  {},
	"featured_rank": {},
}

var planFilterValues = map[string]struct{}{
	string(enums.RequiredPlanFree):       {},
	string(enums.RequiredPlanPro):        {},
	string(enums.RequiredPlanEnterprise): {},
}

var statusFilterValues = map[string]struct{}{
	string(enums.SkillStatusDraft):      {},
	string(enums.SkillStatusPublished):  {},
	string(enums.SkillStatusDeprecated): {},
	string(enums.SkillStatusArchived):   {},
}

var kidsApprovalFilterValues = map[string]struct{}{
	string(enums.KidsApprovalStatusNotRequired):       {},
	string(enums.KidsApprovalStatusPending):           {},
	string(enums.KidsApprovalStatusApproved):          {},
	string(enums.KidsApprovalStatusEmergencyApproved): {},
	string(enums.KidsApprovalStatusRejected):          {},
	string(enums.KidsApprovalStatusRevoked):           {},
}

type PublicSkill struct {
	ID                   string             `json:"id"`
	Slug                 string             `json:"slug"`
	Name                 string             `json:"name"`
	Category             string             `json:"category"`
	ShortDescription     string             `json:"short_description"`
	Description          string             `json:"description,omitempty"`
	Tags                 json.RawMessage    `json:"tags,omitempty"`
	IconURL              *string            `json:"icon_url,omitempty"`
	RequiredPlan         enums.RequiredPlan `json:"required_plan"`
	IsKidsSafe           bool               `json:"is_kids_safe"`
	IsKidsExclusive      bool               `json:"is_kids_exclusive"`
	AIDisclosureRequired bool               `json:"ai_disclosure_required"`
	FeaturedFlag         bool               `json:"featured_flag"`
	FeaturedRank         *int               `json:"featured_rank,omitempty"`
	PublishedAt          *time.Time         `json:"published_at,omitempty"`
}

type AdminSkill struct {
	PublicSkill
	Status             enums.SkillStatus        `json:"status"`
	MonetizationType   enums.MonetizationType   `json:"monetization_type"`
	PriceMarkup        float64                  `json:"price_markup"`
	FreeQuotaPerMonth  *int                     `json:"free_quota_per_month,omitempty"`
	MaxInputTokens     *int                     `json:"max_input_tokens,omitempty"`
	TimeoutSeconds     int                      `json:"timeout_seconds"`
	TimeoutRisk        bool                     `json:"timeout_risk"`
	KidsApprovalStatus enums.KidsApprovalStatus `json:"kids_approval_status"`
	ActiveVersionID    *string                  `json:"active_version_id,omitempty"`
	CreatedBy          int64                    `json:"created_by"`
	UpdatedBy          *int64                   `json:"updated_by,omitempty"`
	CreatedAt          time.Time                `json:"created_at"`
	UpdatedAt          time.Time                `json:"updated_at"`
	DeprecatedAt       *time.Time               `json:"deprecated_at,omitempty"`
	ArchivedAt         *time.Time               `json:"archived_at,omitempty"`
	InputHints         json.RawMessage          `json:"input_hints,omitempty"`
	ExampleInputs      json.RawMessage          `json:"example_inputs,omitempty"`
	ExampleOutputs     json.RawMessage          `json:"example_outputs,omitempty"`
	ModelWhitelist     json.RawMessage          `json:"model_whitelist,omitempty"`
}

// DownloadCTA is the download entry-point advertised on the Skill detail
// response. Points to the DR-81 package download endpoint.
type DownloadCTA struct {
	URL    string `json:"url"`
	Method string `json:"method"`
}

// PublicSkillDetail extends PublicSkill with detail-page-only fields:
// the DeepRouter runtime-dependency flag and the download entry point (DR-53).
// Only returned by GetMarketplaceSkill, not by the list endpoint.
type PublicSkillDetail struct {
	PublicSkill
	RequiresDeepRouterKey bool        `json:"requires_deeprouter_key"`
	DownloadCTA           DownloadCTA `json:"download_cta"`
}

type OpsSkillSummary struct {
	Total             int64            `json:"total"`
	ByStatus          map[string]int64 `json:"by_status"`
	ByCategory        map[string]int64 `json:"by_category"`
	Published         int64            `json:"published"`
	FeaturedPublished int64            `json:"featured_published"`
	KidsSafePublished int64            `json:"kids_safe_published"`
}

func ListMarketplaceSkills(c *gin.Context) {
	page, validationErr := skillapi.ParsePageParams(c)
	if validationErr != nil {
		skillapi.AbortQueryError(c, validationErr)
		return
	}
	if validationErr := skillapi.ValidateSort(c.Query("sort"), publicSortKeys); validationErr != nil {
		skillapi.AbortQueryError(c, validationErr)
		return
	}
	if validationErr := skillapi.ValidateFilter("plan", c.Query("plan"), planFilterValues); validationErr != nil {
		skillapi.AbortQueryError(c, validationErr)
		return
	}
	featured, validationErr := optionalBoolFilter(c.Query("featured"), "featured")
	if validationErr != nil {
		skillapi.AbortQueryError(c, validationErr)
		return
	}

	db, ok := skillDB(c)
	if !ok {
		return
	}
	query := db.Model(&skillmodel.Skill{}).Where("status = ?", enums.SkillStatusPublished)
	query = applyPublicSkillFilters(query, c)
	if featured != nil {
		query = query.Where("featured_flag = ?", *featured)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		writeDBError(c, err)
		return
	}

	var skills []skillmodel.Skill
	if err := query.Order(orderForSort(c.DefaultQuery("sort", "featured_rank"), true)).
		Offset(page.Offset).
		Limit(page.Limit).
		Find(&skills).Error; err != nil {
		writeDBError(c, err)
		return
	}

	out := make([]PublicSkill, 0, len(skills))
	for _, s := range skills {
		out = append(out, publicSkillFromModel(s, false))
	}
	skillapi.List(c, out, skillapi.NewPagination(page.Page, page.Limit, total))
}

func GetMarketplaceSkill(c *gin.Context) {
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
	skillapi.Success(c, publicSkillDetailFromModel(s))
}

// listAdminSkillsSafeQuery returns a GORM query base scoped to the admin-safe
// field allowlist for the skills table.
//
// TEMPORARY: This is a substitute for the DR-82 admin-safe DAO, used under an
// approved dependency waiver (Exception Path, DR-45). It must be replaced with
// the DR-82 DAO once that dependency is merged. See follow-up task in PR/Jira:
// "Once DR-82 is merged, replace this helper with the DR-82 admin-safe DAO
// before final ticket closure."
//
// The explicit Select prevents instruction_template and any future prompt fields
// from leaking into the admin list response — the guarantee is structural, not
// incidental to the current table schema.
func listAdminSkillsSafeQuery(db *gorm.DB) *gorm.DB {
	return db.Model(&skillmodel.Skill{}).Select([]string{
		// Identity & display
		"id", "slug", "name", "category", "tags", "icon_url", "default_locale",
		"short_description", "description",
		// Lifecycle & status
		"status", "published_at", "deprecated_at", "archived_at",
		"featured_flag", "featured_rank",
		// Monetization & limits
		"required_plan", "monetization_type", "price_markup",
		"free_quota_per_month", "max_input_tokens", "timeout_seconds", "timeout_risk",
		// Kids safety
		"is_kids_safe", "is_kids_exclusive", "kids_approval_status",
		"ai_disclosure_required",
		// Versioning & authorship
		"active_version_id", "created_by", "updated_by", "created_at", "updated_at",
		// Hints & examples
		"input_hints", "example_inputs", "example_outputs", "model_whitelist",
	})
}

// ListAdminSkills serves GET /api/v1/admin/skills (Super Admin only).
// Query base: listAdminSkillsSafeQuery — TEMPORARY substitute for the DR-82
// admin-safe DAO, used under an approved dependency waiver (Exception Path,
// DR-45). instruction_template and all prompt fields are excluded by the
// explicit SELECT allowlist above. Replace with the DR-82 DAO once DR-82
// merges (see follow-up task in PR/Jira).
func ListAdminSkills(c *gin.Context) {
	page, validationErr := skillapi.ParsePageParams(c)
	if validationErr != nil {
		skillapi.AbortQueryError(c, validationErr)
		return
	}
	if validationErr := skillapi.ValidateSort(c.Query("sort"), adminSortKeys); validationErr != nil {
		skillapi.AbortQueryError(c, validationErr)
		return
	}
	if validationErr := skillapi.ValidateFilter("status", c.Query("status"), statusFilterValues); validationErr != nil {
		skillapi.AbortQueryError(c, validationErr)
		return
	}
	if validationErr := skillapi.ValidateFilter("required_plan", c.Query("required_plan"), planFilterValues); validationErr != nil {
		skillapi.AbortQueryError(c, validationErr)
		return
	}
	if validationErr := skillapi.ValidateFilter("kids_approval_status", c.Query("kids_approval_status"), kidsApprovalFilterValues); validationErr != nil {
		skillapi.AbortQueryError(c, validationErr)
		return
	}

	db, ok := skillDB(c)
	if !ok {
		return
	}
	query := listAdminSkillsSafeQuery(db)
	query = applyAdminSkillFilters(query, c)

	var total int64
	if err := query.Count(&total).Error; err != nil {
		writeDBError(c, err)
		return
	}

	var skills []skillmodel.Skill
	if err := query.Order(orderForSort(c.DefaultQuery("sort", "-updated_at"), false)).
		Offset(page.Offset).
		Limit(page.Limit).
		Find(&skills).Error; err != nil {
		writeDBError(c, err)
		return
	}

	out := make([]AdminSkill, 0, len(skills))
	for _, s := range skills {
		out = append(out, adminSkillFromModel(s))
	}
	skillapi.List(c, out, skillapi.NewPagination(page.Page, page.Limit, total))
}

func GetOpsSkillSummary(c *gin.Context) {
	db, ok := skillDB(c)
	if !ok {
		return
	}
	var summary OpsSkillSummary
	summary.ByStatus = map[string]int64{}
	summary.ByCategory = map[string]int64{}

	if err := db.Model(&skillmodel.Skill{}).Count(&summary.Total).Error; err != nil {
		writeDBError(c, err)
		return
	}
	var statusRows []struct {
		Status string
		Count  int64
	}
	if err := db.Model(&skillmodel.Skill{}).Select("status, count(*) as count").Group("status").Scan(&statusRows).Error; err != nil {
		writeDBError(c, err)
		return
	}
	for _, row := range statusRows {
		summary.ByStatus[row.Status] = row.Count
	}
	var categoryRows []struct {
		Category string
		Count    int64
	}
	if err := db.Model(&skillmodel.Skill{}).Select("category, count(*) as count").Group("category").Scan(&categoryRows).Error; err != nil {
		writeDBError(c, err)
		return
	}
	for _, row := range categoryRows {
		summary.ByCategory[row.Category] = row.Count
	}
	if err := db.Model(&skillmodel.Skill{}).Where("status = ?", enums.SkillStatusPublished).Count(&summary.Published).Error; err != nil {
		writeDBError(c, err)
		return
	}
	if err := db.Model(&skillmodel.Skill{}).Where("status = ? AND featured_flag = ?", enums.SkillStatusPublished, true).Count(&summary.FeaturedPublished).Error; err != nil {
		writeDBError(c, err)
		return
	}
	if err := db.Model(&skillmodel.Skill{}).Where("status = ? AND is_kids_safe = ?", enums.SkillStatusPublished, true).Count(&summary.KidsSafePublished).Error; err != nil {
		writeDBError(c, err)
		return
	}
	skillapi.Success(c, summary)
}

func applyPublicSkillFilters(query *gorm.DB, c *gin.Context) *gorm.DB {
	if category := strings.TrimSpace(c.Query("category")); category != "" {
		query = query.Where("category = ?", category)
	}
	if plan := strings.TrimSpace(c.Query("plan")); plan != "" {
		query = query.Where("required_plan = ?", plan)
	}
	if q := strings.TrimSpace(c.Query("query")); q != "" {
		like := "%" + q + "%"
		query = query.Where("name LIKE ? OR short_description LIKE ? OR description LIKE ?", like, like, like)
	}
	return query
}

func applyAdminSkillFilters(query *gorm.DB, c *gin.Context) *gorm.DB {
	if status := strings.TrimSpace(c.Query("status")); status != "" {
		query = query.Where("status = ?", status)
	}
	if category := strings.TrimSpace(c.Query("category")); category != "" {
		query = query.Where("category = ?", category)
	}
	if plan := strings.TrimSpace(c.Query("required_plan")); plan != "" {
		query = query.Where("required_plan = ?", plan)
	}
	if kidsApproval := strings.TrimSpace(c.Query("kids_approval_status")); kidsApproval != "" {
		query = query.Where("kids_approval_status = ?", kidsApproval)
	}
	return query
}

func optionalBoolFilter(raw string, name string) (*bool, *skillapi.QueryValidationError) {
	if raw == "" {
		return nil, nil
	}
	v, err := strconv.ParseBool(raw)
	if err != nil {
		return nil, &skillapi.QueryValidationError{
			Code:    errcodes.ErrInvalidRequest,
			Message: fmt.Sprintf("unsupported %s filter value %q", name, raw),
			Detail:  gin.H{"reason": "INVALID_FILTER"},
		}
	}
	return &v, nil
}

func orderForSort(sort string, public bool) string {
	desc := strings.HasPrefix(sort, "-")
	key := strings.TrimPrefix(sort, "-")
	columns := map[string]string{
		"name":          "name",
		"created_at":    "created_at",
		"updated_at":    "updated_at",
		"published_at":  "published_at",
		"featured_rank": "featured_rank",
	}
	column := columns[key]
	if column == "" {
		if public {
			return "featured_rank ASC, published_at DESC, created_at DESC"
		}
		return "updated_at DESC"
	}
	direction := "ASC"
	if desc {
		direction = "DESC"
	}
	if key == "featured_rank" {
		return column + " " + direction + ", published_at DESC, created_at DESC"
	}
	return column + " " + direction
}

func publicSkillFromModel(s skillmodel.Skill, includeDetail bool) PublicSkill {
	out := PublicSkill{
		ID:                   s.ID,
		Slug:                 s.Slug,
		Name:                 s.Name,
		Category:             s.Category,
		ShortDescription:     s.ShortDescription,
		IconURL:              s.IconURL,
		RequiredPlan:         s.RequiredPlan,
		IsKidsSafe:           s.IsKidsSafe,
		IsKidsExclusive:      s.IsKidsExclusive,
		AIDisclosureRequired: s.AIDisclosureRequired,
		FeaturedFlag:         s.FeaturedFlag,
		FeaturedRank:         s.FeaturedRank,
		PublishedAt:          s.PublishedAt,
	}
	if includeDetail {
		out.Description = s.Description
		out.Tags = rawJSON(s.Tags)
	}
	return out
}

// publicSkillDetailFromModel builds the detail-page response.
// download_cta.url uses slug (not ID) because slugs are human-readable and
// stable. DR-81 must accept slug as the {id} path parameter — verify before
// closing DR-81 or this CTA will produce broken URLs.
func publicSkillDetailFromModel(s skillmodel.Skill) PublicSkillDetail {
	return PublicSkillDetail{
		PublicSkill:           publicSkillFromModel(s, true),
		RequiresDeepRouterKey: true,
		DownloadCTA: DownloadCTA{
			URL:    "/api/v1/marketplace/skills/" + url.PathEscape(s.Slug) + "/download",
			Method: "GET",
		},
	}
}

func adminSkillFromModel(s skillmodel.Skill) AdminSkill {
	return AdminSkill{
		PublicSkill:        publicSkillFromModel(s, true),
		Status:             s.Status,
		MonetizationType:   s.MonetizationType,
		PriceMarkup:        s.PriceMarkup,
		FreeQuotaPerMonth:  s.FreeQuotaPerMonth,
		MaxInputTokens:     s.MaxInputTokens,
		TimeoutSeconds:     s.TimeoutSeconds,
		TimeoutRisk:        s.TimeoutRisk,
		KidsApprovalStatus: s.KidsApprovalStatus,
		ActiveVersionID:    s.ActiveVersionID,
		CreatedBy:          s.CreatedBy,
		UpdatedBy:          s.UpdatedBy,
		CreatedAt:          s.CreatedAt,
		UpdatedAt:          s.UpdatedAt,
		DeprecatedAt:       s.DeprecatedAt,
		ArchivedAt:         s.ArchivedAt,
		InputHints:         rawJSON(s.InputHints),
		ExampleInputs:      rawJSON(s.ExampleInputs),
		ExampleOutputs:     rawJSON(s.ExampleOutputs),
		ModelWhitelist:     rawJSON(s.ModelWhitelist),
	}
}

func rawJSON(value skillmodel.SkillJSONB) json.RawMessage {
	if len(value) == 0 || !json.Valid(value) {
		return json.RawMessage("[]")
	}
	return json.RawMessage(value)
}

func skillDB(c *gin.Context) (*gorm.DB, bool) {
	if db == nil {
		skillapi.Error(c, errcodes.ErrSkillInternalError, "Skill database is unavailable.", nil)
		return nil, false
	}
	return db, true
}

func writeSkillLookupError(c *gin.Context, err error) {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		skillapi.Error(c, errcodes.ErrSkillNotFound, "Skill not found.", nil)
		return
	}
	writeDBError(c, err)
}

func writeDBError(c *gin.Context, err error) {
	if err == nil {
		return
	}
	skillapi.Error(c, errcodes.ErrSkillInternalError, http.StatusText(http.StatusInternalServerError), nil)
}
