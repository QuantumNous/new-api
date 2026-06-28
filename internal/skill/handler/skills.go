package handler

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	skillapi "github.com/QuantumNous/new-api/internal/skill/api"
	"github.com/QuantumNous/new-api/internal/skill/availability"
	"github.com/QuantumNous/new-api/internal/skill/enums"
	"github.com/QuantumNous/new-api/internal/skill/errcodes"
	skillmodel "github.com/QuantumNous/new-api/internal/skill/model"
	platformmodel "github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var (
	dbMu sync.RWMutex
	db   *gorm.DB
)

func SetDB(database *gorm.DB) {
	dbMu.Lock()
	defer dbMu.Unlock()
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

const (
	createSkillSlugMaxLength             = 128
	createSkillNameMaxLength             = 160
	createSkillShortDescriptionMaxLength = 280
	createSkillCategoryMaxLength         = 64
)

var createSkillSlugPattern = regexp.MustCompile(`^[a-z0-9](?:[a-z0-9-]{0,126}[a-z0-9])?$`)

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

type MarketplaceSkill struct {
	ID               string             `json:"id"`
	Slug             string             `json:"slug"`
	Name             string             `json:"name"`
	Category         string             `json:"category"`
	ShortDescription string             `json:"short_description"`
	RequiredPlan     enums.RequiredPlan `json:"required_plan"`
	Availability     SkillAvailability  `json:"availability"`
	Badges           []string           `json:"badges"`
	Featured         bool               `json:"featured"`
	Saved            *bool              `json:"saved,omitempty"`
	IsKidsSafe       bool               `json:"is_kids_safe"`
	IsKidsExclusive  bool               `json:"is_kids_exclusive"`
}

type SkillAvailability struct {
	Enabled  *bool               `json:"enabled"`
	Locked   bool                `json:"locked"`
	LockCode *errcodes.ErrorCode `json:"lock_code"`
	CTA      availability.CTA    `json:"cta"`
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

type SkillVersionInstructions struct {
	DownloadInstructions string          `json:"download_instructions"`
	UsageInstructions    string          `json:"usage_instructions"`
	Prerequisites        json.RawMessage `json:"prerequisites"`
	Quickstart           json.RawMessage `json:"quickstart"`
	ExampleIO            json.RawMessage `json:"example_io"`
}

// PublicSkillDetail extends PublicSkill with detail-page-only fields:
// the DeepRouter runtime-dependency flag and the download entry point (DR-53).
// Only returned by GetMarketplaceSkill, not by the list endpoint.
type PublicSkillDetail struct {
	PublicSkill
	RequiresDeepRouterKey bool                     `json:"requires_deeprouter_key"`
	DownloadCTA           DownloadCTA              `json:"download_cta"`
	Instructions          SkillVersionInstructions `json:"instructions"`
	Saved                 bool                     `json:"saved"`
}

type OpsSkillSummary struct {
	Total             int64            `json:"total"`
	ByStatus          map[string]int64 `json:"by_status"`
	ByCategory        map[string]int64 `json:"by_category"`
	Published         int64            `json:"published"`
	FeaturedPublished int64            `json:"featured_published"`
	KidsSafePublished int64            `json:"kids_safe_published"`
}

type MySkill struct {
	SkillID      string              `json:"skill_id"`
	Slug         string              `json:"slug"`
	Name         string              `json:"name"`
	SkillStatus  enums.SkillStatus   `json:"skill_status"`
	RequiredPlan enums.RequiredPlan  `json:"required_plan"`
	Enabled      bool                `json:"enabled"`
	EnabledAt    time.Time           `json:"enabled_at"`
	LastUsedAt   *time.Time          `json:"last_used_at"`
	Availability MySkillAvailability `json:"availability"`
}

type SavedSkill struct {
	SkillID          string             `json:"skill_id"`
	Slug             string             `json:"slug"`
	Name             string             `json:"name"`
	Category         string             `json:"category"`
	ShortDescription string             `json:"short_description"`
	SkillStatus      enums.SkillStatus  `json:"skill_status"`
	RequiredPlan     enums.RequiredPlan `json:"required_plan"`
	SavedAt          time.Time          `json:"saved_at"`
	LastUsedAt       *time.Time         `json:"last_used_at"`
	Enabled          bool               `json:"enabled"`
}

type MySkillAvailability struct {
	Executable bool                `json:"executable"`
	Locked     bool                `json:"locked"`
	LockCode   *errcodes.ErrorCode `json:"lock_code"`
	CTA        availability.CTA    `json:"cta"`
}

type MarketplaceSkillEventRequest struct {
	EventType  enums.SkillUsageEventType `json:"event_type"`
	EntryPoint enums.EntryPoint          `json:"entry_point"`
}

var marketplaceEventTypeValues = map[enums.SkillUsageEventType]struct{}{
	enums.SkillUsageEventTypeImpression: {},
	enums.SkillUsageEventTypeDetailView: {},
}

var marketplaceEventEntryPointValues = map[enums.EntryPoint]struct{}{
	enums.EntryPointMarketplaceCard: {},
	enums.EntryPointSkillDetail:     {},
	enums.EntryPointSearchResults:   {},
	enums.EntryPointNew:             {},
	enums.EntryPointRecommended:     {},
	enums.EntryPointRecoPersonal:    {},
	enums.EntryPointRecoCodownload:  {},
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
	kidsSafe, validationErr := optionalBoolFilter(c.Query("kids_safe"), "kids_safe")
	if validationErr != nil {
		skillapi.AbortQueryError(c, validationErr)
		return
	}

	db, ok := skillDB(c)
	if !ok {
		return
	}
	query := listMarketplaceSkillsPublicQuery(db).Where("status = ?", enums.SkillStatusPublished)
	query = applyPublicSkillFilters(query, c)
	if featured != nil {
		query = query.Where("featured_flag = ?", *featured)
	}
	if kidsSafe != nil {
		query = query.Where("is_kids_safe = ?", *kidsSafe)
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

	userInfo, err := marketplaceUserInfo(c, db)
	if err != nil {
		writeDBError(c, err)
		return
	}
	enabledBySkillID, err := marketplaceEnablementBySkillID(db, userInfo, skills)
	if err != nil {
		writeDBError(c, err)
		return
	}
	savedBySkillID, err := marketplaceSavedBySkillID(db, userInfo, skills)
	if err != nil {
		writeDBError(c, err)
		return
	}

	out := make([]MarketplaceSkill, 0, len(skills))
	for _, s := range skills {
		out = append(out, marketplaceSkillFromModel(s, userInfo, enabledBySkillID[s.ID], savedBySkillID[s.ID]))
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
	instructions := SkillVersionInstructions{
		Prerequisites: json.RawMessage("[]"),
		Quickstart:    json.RawMessage("[]"),
		ExampleIO:     json.RawMessage("[]"),
	}
	if s.ActiveVersionID != nil && strings.TrimSpace(*s.ActiveVersionID) != "" {
		var version skillmodel.SkillVersion
		if err := db.First(&version, "id = ? AND skill_id = ?", *s.ActiveVersionID, s.ID).Error; err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			writeDBError(c, err)
			return
		} else if err == nil {
			instructions = skillVersionInstructionsFromModel(version)
		}
	}
	userInfo, err := marketplaceUserInfo(c, db)
	if err != nil {
		writeDBError(c, err)
		return
	}
	savedBySkillID, err := marketplaceSavedBySkillID(db, userInfo, []skillmodel.Skill{s})
	if err != nil {
		writeDBError(c, err)
		return
	}
	skillapi.Success(c, publicSkillDetailFromModel(s, instructions, savedBySkillID[s.ID]))
}

func SaveMarketplaceSkill(c *gin.Context) {
	saveMarketplaceSkillState(c, true)
}

func UnsaveMarketplaceSkill(c *gin.Context) {
	saveMarketplaceSkillState(c, false)
}

func saveMarketplaceSkillState(c *gin.Context, saved bool) {
	db, ok := skillDB(c)
	if !ok {
		return
	}
	userID := int64(c.GetInt("id"))
	if userID <= 0 {
		skillapi.Error(c, errcodes.ErrAuthRequired, "Authentication required.", nil)
		return
	}
	entryPoint, valid := parseSaveEntryPoint(c.DefaultQuery("entry_point", string(enums.EntryPointSkillDetail)))
	if !valid {
		skillapi.Error(c, errcodes.ErrInvalidRequest, "Unsupported entry point.", gin.H{"reason": "INVALID_ENTRY_POINT"})
		return
	}

	var s skillmodel.Skill
	err := db.Select([]string{"id", "status", "active_version_id"}).
		Where("status = ?", enums.SkillStatusPublished).
		Where("id = ? OR slug = ?", c.Param("id"), c.Param("id")).
		First(&s).Error
	if err != nil {
		writeSkillLookupError(c, err)
		return
	}

	if saved {
		err = skillmodel.SaveSkillForUser(db, userID, userID, s.ID, string(entryPoint))
	} else {
		err = skillmodel.UnsaveSkillForUser(db, userID, userID, s.ID)
	}
	if err != nil {
		writeDBError(c, err)
		return
	}
	plan := marketplaceGroupToPlan(c.GetString("group"))
	if err := emitSkillSavedStateEvent(db, userID, s.ID, s.ActiveVersionID, entryPoint, plan, saved); err != nil {
		writeDBError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
	c.Writer.WriteHeaderNow()
}

func emitSkillSavedStateEvent(db *gorm.DB, userID int64, skillID string, skillVersionID *string, entryPoint enums.EntryPoint, plan enums.RequiredPlan, saved bool) error {
	successVal := true
	eventType := enums.SkillUsageEventTypeSaved
	if !saved {
		eventType = enums.SkillUsageEventTypeUnsaved
	}
	event := skillmodel.SkillUsageEvent{
		EventType:      eventType,
		SkillID:        &skillID,
		SkillVersionID: skillVersionID,
		EntryPoint:     entryPoint,
		Plan:           &plan,
		Success:        &successVal,
		Metadata:       skillmodel.SkillJSONB(`{}`),
	}
	if isKidsSession, err := serverResolvedKidsSession(db, userID); err != nil {
		return err
	} else if isKidsSession {
		if err := event.ApplyKidsSessionAnalyticsIdentity(userID, userID, kidsAnalyticsSaltVersion(), kidsAnalyticsDailySalt()); err != nil {
			return err
		}
	} else {
		uid := userID
		event.UserID = &uid
		event.TenantID = &uid
	}
	return skillmodel.EmitSkillUsageEvent(db, event)
}

func parseSaveEntryPoint(raw string) (enums.EntryPoint, bool) {
	entry := enums.EntryPoint(strings.TrimSpace(raw))
	switch entry {
	case enums.EntryPointMarketplaceCard,
		enums.EntryPointSkillDetail,
		enums.EntryPointMySkills,
		enums.EntryPointSavedList,
		enums.EntryPointFeatured,
		enums.EntryPointPopular,
		enums.EntryPointNew,
		enums.EntryPointRecommended,
		enums.EntryPointSearchResults:
		return entry, true
	default:
		return "", false
	}
}

func ListPersonalRecommendations(c *gin.Context) {
	page, validationErr := skillapi.ParsePageParams(c)
	if validationErr != nil {
		skillapi.AbortQueryError(c, validationErr)
		return
	}
	db, ok := skillDB(c)
	if !ok {
		return
	}
	userInfo, err := marketplaceUserInfo(c, db)
	if err != nil {
		writeDBError(c, err)
		return
	}
	if userInfo.IsAnonymous || userInfo.UserID == 0 {
		skillapi.Error(c, errcodes.ErrAuthRequired, "Authentication required.", nil)
		return
	}

	skills, total, err := personalRecommendationSkills(db, userInfo, page.Limit)
	if err != nil {
		writeDBError(c, err)
		return
	}
	writeMarketplaceRecommendationList(c, db, userInfo, skills, page, total)
}

func ListCoDownloadRecommendations(c *gin.Context) {
	page, validationErr := skillapi.ParsePageParams(c)
	if validationErr != nil {
		skillapi.AbortQueryError(c, validationErr)
		return
	}
	db, ok := skillDB(c)
	if !ok {
		return
	}
	var target skillmodel.Skill
	if err := db.Select([]string{"id"}).
		Where("status = ?", enums.SkillStatusPublished).
		Where("id = ? OR slug = ?", c.Param("id"), c.Param("id")).
		First(&target).Error; err != nil {
		writeSkillLookupError(c, err)
		return
	}
	userInfo, err := marketplaceUserInfo(c, db)
	if err != nil {
		writeDBError(c, err)
		return
	}

	skills, total, err := coDownloadRecommendationSkills(db, userInfo, target.ID, page.Limit)
	if err != nil {
		writeDBError(c, err)
		return
	}
	writeMarketplaceRecommendationList(c, db, userInfo, skills, page, total)
}

// RecordMarketplaceSkillEvent ingests privacy-safe client-side discovery events
// for growth surfaces. It intentionally accepts only a tiny event/entry-point
// whitelist and stores empty metadata so prompts, templates, and raw messages
// cannot enter analytics through this endpoint.
func RecordMarketplaceSkillEvent(c *gin.Context) {
	db, ok := skillDB(c)
	if !ok {
		return
	}

	var req MarketplaceSkillEventRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		skillapi.Error(c, errcodes.ErrInvalidRequest, "Invalid event payload.", nil)
		return
	}
	if _, ok := marketplaceEventTypeValues[req.EventType]; !ok {
		skillapi.Error(c, errcodes.ErrInvalidRequest, "Unsupported event type.", nil)
		return
	}
	if _, ok := marketplaceEventEntryPointValues[req.EntryPoint]; !ok {
		skillapi.Error(c, errcodes.ErrInvalidRequest, "Unsupported entry point.", nil)
		return
	}

	var s skillmodel.Skill
	err := db.Select([]string{
		"id", "status", "active_version_id", "is_kids_safe", "is_kids_exclusive",
	}).Where("status = ?", enums.SkillStatusPublished).
		Where("id = ? OR slug = ?", c.Param("id"), c.Param("id")).
		First(&s).Error
	if err != nil {
		writeSkillLookupError(c, err)
		return
	}

	userID := int64(c.GetInt("id"))
	plan := groupToPlan(c.GetString("group"))
	successVal := true
	skillID := s.ID
	event := skillmodel.SkillUsageEvent{
		EventType:            req.EventType,
		SkillID:              &skillID,
		SkillVersionID:       s.ActiveVersionID,
		EntryPoint:           req.EntryPoint,
		Plan:                 &plan,
		IsKidsSafeSkill:      &s.IsKidsSafe,
		IsKidsExclusiveSkill: &s.IsKidsExclusive,
		Success:              &successVal,
		Metadata:             skillmodel.SkillJSONB(`{}`),
	}
	if userID > 0 {
		if isKidsSession, err := serverResolvedKidsSession(db, userID); err != nil {
			writeDBError(c, err)
			return
		} else if isKidsSession {
			if err := event.ApplyKidsSessionAnalyticsIdentity(userID, userID, kidsAnalyticsSaltVersion(), kidsAnalyticsDailySalt()); err != nil {
				writeDBError(c, err)
				return
			}
		} else {
			event.UserID = &userID
			event.TenantID = &userID
		}
	}
	if err := skillmodel.EmitSkillUsageEvent(db, event); err != nil {
		writeDBError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
	c.Writer.WriteHeaderNow()
}

// ListMySkills serves GET /api/v1/marketplace/my-skills.
// It returns the caller's visible enabled skills, including deprecated/archived rows,
// with execution availability resolved through the DR-72 entitlement resolver.
func ListMySkills(c *gin.Context) {
	db, ok := skillDB(c)
	if !ok {
		return
	}

	userID := int64(c.GetInt("id"))
	if userID <= 0 {
		skillapi.Error(c, errcodes.ErrAuthRequired, "Authentication required.", nil)
		return
	}

	type mySkillRow struct {
		SkillID           string
		Slug              string
		Name              string
		Status            enums.SkillStatus
		RequiredPlan      enums.RequiredPlan
		IsKidsSafe        bool
		IsKidsExclusive   bool
		FreeQuotaPerMonth *int
		Enabled           bool
		EnabledAt         time.Time
		LastUsedAt        *time.Time
	}

	var rows []mySkillRow
	if err := db.Table("user_enabled_skills AS ues").
		Select(`skills.id AS skill_id, skills.slug, skills.name, skills.status,
			skills.required_plan, skills.is_kids_safe, skills.is_kids_exclusive,
			skills.free_quota_per_month, ues.enabled, ues.enabled_at, ues.last_used_at`).
		Joins("JOIN skills ON skills.id = ues.skill_id").
		Where("ues.user_id = ? AND ues.tenant_id = ? AND ues.enabled = ? AND ues.removed_at IS NULL", userID, userID, true).
		Order("ues.enabled_at DESC, skills.name ASC").
		Scan(&rows).Error; err != nil {
		writeDBError(c, err)
		return
	}

	userInfo := availability.UserInfo{
		Plan:       groupToPlan(c.GetString("group")),
		SubActive:  true,
		IsEnabled:  true,
		WasEnabled: true,
	}
	kidsMode, err := currentUserKidsMode(db, userID)
	if err != nil {
		writeDBError(c, err)
		return
	}
	userInfo.IsKidsSession = kidsMode

	out := make([]MySkill, 0, len(rows))
	for _, row := range rows {
		result := availability.Resolve(availability.SkillInfo{
			Status:            row.Status,
			RequiredPlan:      row.RequiredPlan,
			IsKidsSafe:        row.IsKidsSafe,
			IsKidsExclusive:   row.IsKidsExclusive,
			FreeQuotaPerMonth: row.FreeQuotaPerMonth,
		}, userInfo)
		out = append(out, MySkill{
			SkillID:      row.SkillID,
			Slug:         row.Slug,
			Name:         row.Name,
			SkillStatus:  row.Status,
			RequiredPlan: row.RequiredPlan,
			Enabled:      row.Enabled,
			EnabledAt:    row.EnabledAt,
			LastUsedAt:   row.LastUsedAt,
			Availability: mySkillAvailabilityFromResult(result),
		})
	}

	skillapi.Success(c, out)
}

func ListSavedSkills(c *gin.Context) {
	db, ok := skillDB(c)
	if !ok {
		return
	}
	userID := int64(c.GetInt("id"))
	if userID <= 0 {
		skillapi.Error(c, errcodes.ErrAuthRequired, "Authentication required.", nil)
		return
	}

	type savedSkillRow struct {
		SkillID          string
		Slug             string
		Name             string
		Category         string
		ShortDescription string
		Status           enums.SkillStatus
		RequiredPlan     enums.RequiredPlan
		SavedAt          time.Time
		LastUsedAt       *time.Time
		Enabled          bool
	}
	var rows []savedSkillRow
	if err := db.Table("user_saved_skills AS uss").
		Select(`skills.id AS skill_id, skills.slug, skills.name, skills.category,
			skills.short_description, skills.status, skills.required_plan,
			uss.saved_at, ues.last_used_at, COALESCE(ues.enabled, ?) AS enabled`, false).
		Joins("JOIN skills ON skills.id = uss.skill_id").
		Joins("LEFT JOIN user_enabled_skills AS ues ON ues.user_id = uss.user_id AND ues.tenant_id = uss.tenant_id AND ues.skill_id = uss.skill_id").
		Where("uss.user_id = ? AND uss.tenant_id = ? AND uss.saved = ?", userID, userID, true).
		Order("uss.saved_at DESC, skills.name ASC").
		Scan(&rows).Error; err != nil {
		writeDBError(c, err)
		return
	}
	out := make([]SavedSkill, 0, len(rows))
	for _, row := range rows {
		out = append(out, SavedSkill{
			SkillID:          row.SkillID,
			Slug:             row.Slug,
			Name:             row.Name,
			Category:         row.Category,
			ShortDescription: row.ShortDescription,
			SkillStatus:      row.Status,
			RequiredPlan:     row.RequiredPlan,
			SavedAt:          row.SavedAt,
			LastUsedAt:       row.LastUsedAt,
			Enabled:          row.Enabled,
		})
	}
	skillapi.Success(c, out)
}

// RemoveMySkill serves DELETE /api/v1/marketplace/my-skills/:id.
// It removes the Skill from the user's library only. The row remains
// enabled=true so downloaded packages continue through runtime authorization.
func RemoveMySkill(c *gin.Context) {
	db, ok := skillDB(c)
	if !ok {
		return
	}

	userID := int64(c.GetInt("id"))
	if userID <= 0 {
		skillapi.Error(c, errcodes.ErrAuthRequired, "Authentication required.", nil)
		return
	}

	var s skillmodel.Skill
	err := db.Select("id").
		Where("id = ? OR slug = ?", c.Param("id"), c.Param("id")).
		First(&s).Error
	if err != nil {
		writeSkillLookupError(c, err)
		return
	}

	if err := skillmodel.RemoveSkillFromMySkills(db, userID, userID, s.ID); err != nil {
		writeDBError(c, err)
		return
	}

	c.Status(http.StatusNoContent)
	c.Writer.WriteHeaderNow()
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

	// Query 1: status breakdown — also gives total and published count.
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
		summary.Total += row.Count
	}
	summary.Published = summary.ByStatus[string(enums.SkillStatusPublished)]

	// Query 2: category breakdown.
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

	// Query 3: featured and kids-safe published counts via conditional aggregation.
	var pubCounts struct {
		FeaturedPublished int64
		KidsSafePublished int64
	}
	if err := db.Model(&skillmodel.Skill{}).Select(
		"SUM(CASE WHEN status = ? AND featured_flag = ? THEN 1 ELSE 0 END) as featured_published,"+
			" SUM(CASE WHEN status = ? AND is_kids_safe = ? THEN 1 ELSE 0 END) as kids_safe_published",
		enums.SkillStatusPublished, true, enums.SkillStatusPublished, true,
	).Scan(&pubCounts).Error; err != nil {
		writeDBError(c, err)
		return
	}
	summary.FeaturedPublished = pubCounts.FeaturedPublished
	summary.KidsSafePublished = pubCounts.KidsSafePublished

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
		clause, args := publicSearchClause(query.Dialector.Name(), q)
		query = query.Where(clause, args...)
	}
	return query
}

func listMarketplaceSkillsPublicQuery(db *gorm.DB) *gorm.DB {
	return db.Model(&skillmodel.Skill{}).Select([]string{
		"id",
		"slug",
		"name",
		"category",
		"short_description",
		"status",
		"required_plan",
		"free_quota_per_month",
		"featured_flag",
		"featured_rank",
		"is_kids_safe",
		"is_kids_exclusive",
	})
}

func publicSearchClause(dialect, q string) (string, []any) {
	if dialect == "postgres" {
		return `to_tsvector('simple',
				coalesce(name, '') || ' ' ||
				coalesce(short_description, '') || ' ' ||
				coalesce(description, '')
			) @@ plainto_tsquery('simple', ?)`, []any{q}
	}
	escaped := strings.NewReplacer("!", "!!", "%", "!%", "_", "!_").Replace(q)
	like := "%" + escaped + "%"
	return "name LIKE ? ESCAPE '!' OR short_description LIKE ? ESCAPE '!' OR description LIKE ? ESCAPE '!'", []any{like, like, like}
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
			return "(featured_rank IS NULL) ASC, featured_rank ASC, published_at DESC, created_at DESC"
		}
		return "updated_at DESC"
	}
	direction := "ASC"
	if desc {
		direction = "DESC"
	}
	if key == "featured_rank" {
		return "(featured_rank IS NULL) ASC, " + column + " " + direction + ", published_at DESC, created_at DESC"
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

type marketplaceUserContext struct {
	IsAnonymous bool
	UserID      int64
	Plan        enums.RequiredPlan
	IsKidsMode  bool
	SubActive   bool
}

func marketplaceSkillFromModel(s skillmodel.Skill, user marketplaceUserContext, enabled bool, saved bool) MarketplaceSkill {
	result := availability.Resolve(availability.SkillInfo{
		Status:            s.Status,
		RequiredPlan:      s.RequiredPlan,
		IsKidsSafe:        s.IsKidsSafe,
		IsKidsExclusive:   s.IsKidsExclusive,
		FreeQuotaPerMonth: s.FreeQuotaPerMonth,
	}, availability.UserInfo{
		IsAnonymous:   user.IsAnonymous,
		IsKidsSession: user.IsKidsMode,
		Plan:          user.Plan,
		SubActive:     user.SubActive,
		IsEnabled:     enabled,
		WasEnabled:    enabled,
	})
	out := MarketplaceSkill{
		ID:               s.ID,
		Slug:             s.Slug,
		Name:             s.Name,
		Category:         s.Category,
		ShortDescription: s.ShortDescription,
		RequiredPlan:     s.RequiredPlan,
		Availability:     skillAvailabilityFromResult(result),
		Badges:           marketplaceBadges(s),
		Featured:         s.FeaturedFlag,
		IsKidsSafe:       s.IsKidsSafe,
		IsKidsExclusive:  s.IsKidsExclusive,
	}
	if !user.IsAnonymous && user.UserID != 0 {
		out.Saved = &saved
	}
	return out
}

type categoryAffinityRow struct {
	Category  string
	Downloads int64
}

type coDownloadRow struct {
	SkillID string
	Count   int64
}

func personalRecommendationSkills(db *gorm.DB, user marketplaceUserContext, limit int) ([]skillmodel.Skill, int64, error) {
	var categoryRows []categoryAffinityRow
	if err := db.Table("user_enabled_skills AS ues").
		Select("skills.category AS category, COUNT(*) AS downloads").
		Joins("JOIN skills ON skills.id = ues.skill_id").
		Where("ues.user_id = ? AND ues.tenant_id = ? AND ues.enabled = ? AND ues.removed_at IS NULL", user.UserID, user.UserID, true).
		Group("skills.category").
		Order("downloads DESC, MAX(COALESCE(ues.last_used_at, ues.enabled_at)) DESC, category ASC").
		Scan(&categoryRows).Error; err != nil {
		return nil, 0, err
	}
	if len(categoryRows) == 0 {
		return fallbackRecommendationSkills(db, user, "", limit)
	}

	categories := make([]string, 0, len(categoryRows))
	categoryRank := make(map[string]int, len(categoryRows))
	for i, row := range categoryRows {
		categories = append(categories, row.Category)
		categoryRank[row.Category] = i
	}

	enabledIDs, err := userEnabledSkillIDs(db, user.UserID)
	if err != nil {
		return nil, 0, err
	}
	query := listMarketplaceSkillsPublicQuery(db).Where("status = ?", enums.SkillStatusPublished).
		Where("category IN ?", categories)
	if len(enabledIDs) > 0 {
		query = query.Where("id NOT IN ?", enabledIDs)
	}
	query = applyRecommendationVisibility(query, user)

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if total == 0 {
		return fallbackRecommendationSkills(db, user, "", limit)
	}

	var skills []skillmodel.Skill
	if err := query.Order("(featured_rank IS NULL) ASC, featured_rank ASC, published_at DESC, created_at DESC").
		Limit(skillapi.MaxLimit).
		Find(&skills).Error; err != nil {
		return nil, 0, err
	}
	sort.SliceStable(skills, func(i, j int) bool {
		leftRank := categoryRank[skills[i].Category]
		rightRank := categoryRank[skills[j].Category]
		if leftRank != rightRank {
			return leftRank < rightRank
		}
		return recommendationSkillLess(skills[i], skills[j])
	})
	if len(skills) > limit {
		skills = skills[:limit]
	}
	return skills, total, nil
}

func coDownloadRecommendationSkills(db *gorm.DB, user marketplaceUserContext, targetSkillID string, limit int) ([]skillmodel.Skill, int64, error) {
	var peerRows []struct {
		UserID   int64
		TenantID int64
	}
	if err := db.Table("user_enabled_skills").
		Select("user_id, tenant_id").
		Where("skill_id = ? AND enabled = ? AND removed_at IS NULL", targetSkillID, true).
		Scan(&peerRows).Error; err != nil {
		return nil, 0, err
	}
	if len(peerRows) == 0 {
		return fallbackRecommendationSkills(db, user, targetSkillID, limit)
	}
	peerUsers := make([]int64, 0, len(peerRows))
	for _, row := range peerRows {
		if row.UserID == row.TenantID {
			peerUsers = append(peerUsers, row.UserID)
		}
	}
	if len(peerUsers) == 0 {
		return fallbackRecommendationSkills(db, user, targetSkillID, limit)
	}

	var coRows []coDownloadRow
	if err := db.Table("user_enabled_skills").
		Select("skill_id, COUNT(*) AS count").
		Where("user_id IN ? AND tenant_id = user_id AND enabled = ? AND removed_at IS NULL AND skill_id <> ?", peerUsers, true, targetSkillID).
		Group("skill_id").
		Order("count DESC, skill_id ASC").
		Scan(&coRows).Error; err != nil {
		return nil, 0, err
	}
	if len(coRows) == 0 {
		return fallbackRecommendationSkills(db, user, targetSkillID, limit)
	}
	coRank := make(map[string]int, len(coRows))
	ids := make([]string, 0, len(coRows))
	for i, row := range coRows {
		ids = append(ids, row.SkillID)
		coRank[row.SkillID] = i
	}

	query := listMarketplaceSkillsPublicQuery(db).Where("status = ?", enums.SkillStatusPublished).
		Where("id IN ?", ids)
	query = applyRecommendationVisibility(query, user)
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if total == 0 {
		return fallbackRecommendationSkills(db, user, targetSkillID, limit)
	}

	var skills []skillmodel.Skill
	if err := query.Limit(skillapi.MaxLimit).Find(&skills).Error; err != nil {
		return nil, 0, err
	}
	sort.SliceStable(skills, func(i, j int) bool {
		leftRank := coRank[skills[i].ID]
		rightRank := coRank[skills[j].ID]
		if leftRank != rightRank {
			return leftRank < rightRank
		}
		return recommendationSkillLess(skills[i], skills[j])
	})
	if len(skills) > limit {
		skills = skills[:limit]
	}
	return skills, total, nil
}

func fallbackRecommendationSkills(db *gorm.DB, user marketplaceUserContext, excludeSkillID string, limit int) ([]skillmodel.Skill, int64, error) {
	query := listMarketplaceSkillsPublicQuery(db).Where("status = ?", enums.SkillStatusPublished)
	if excludeSkillID != "" {
		query = query.Where("id <> ?", excludeSkillID)
	}
	query = applyRecommendationVisibility(query, user)
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var skills []skillmodel.Skill
	if err := query.Order("(featured_rank IS NULL) ASC, featured_rank ASC, published_at DESC, created_at DESC").
		Limit(limit).
		Find(&skills).Error; err != nil {
		return nil, 0, err
	}
	return skills, total, nil
}

func applyRecommendationVisibility(query *gorm.DB, user marketplaceUserContext) *gorm.DB {
	if user.IsKidsMode {
		return query.Where("is_kids_safe = ?", true)
	}
	return query
}

func userEnabledSkillIDs(db *gorm.DB, userID int64) ([]string, error) {
	var rows []skillmodel.UserEnabledSkill
	if err := db.Select("skill_id").
		Where("user_id = ? AND tenant_id = ? AND enabled = ? AND removed_at IS NULL", userID, userID, true).
		Find(&rows).Error; err != nil {
		return nil, err
	}
	ids := make([]string, 0, len(rows))
	for _, row := range rows {
		ids = append(ids, row.SkillID)
	}
	return ids, nil
}

func recommendationSkillLess(left, right skillmodel.Skill) bool {
	if left.FeaturedRank == nil && right.FeaturedRank != nil {
		return false
	}
	if left.FeaturedRank != nil && right.FeaturedRank == nil {
		return true
	}
	if left.FeaturedRank != nil && right.FeaturedRank != nil && *left.FeaturedRank != *right.FeaturedRank {
		return *left.FeaturedRank < *right.FeaturedRank
	}
	if left.PublishedAt != nil && right.PublishedAt != nil && !left.PublishedAt.Equal(*right.PublishedAt) {
		return left.PublishedAt.After(*right.PublishedAt)
	}
	if left.PublishedAt != nil && right.PublishedAt == nil {
		return true
	}
	if left.PublishedAt == nil && right.PublishedAt != nil {
		return false
	}
	return left.CreatedAt.After(right.CreatedAt)
}

func writeMarketplaceRecommendationList(c *gin.Context, db *gorm.DB, userInfo marketplaceUserContext, skills []skillmodel.Skill, page skillapi.PageParams, total int64) {
	enabledBySkillID, err := marketplaceEnablementBySkillID(db, userInfo, skills)
	if err != nil {
		writeDBError(c, err)
		return
	}
	savedBySkillID, err := marketplaceSavedBySkillID(db, userInfo, skills)
	if err != nil {
		writeDBError(c, err)
		return
	}
	out := make([]MarketplaceSkill, 0, len(skills))
	for _, s := range skills {
		out = append(out, marketplaceSkillFromModel(s, userInfo, enabledBySkillID[s.ID], savedBySkillID[s.ID]))
	}
	skillapi.List(c, out, skillapi.NewPagination(page.Page, page.Limit, total))
}

func skillAvailabilityFromResult(result availability.Result) SkillAvailability {
	var lockCode *errcodes.ErrorCode
	if result.LockCode != "" {
		code := result.LockCode
		lockCode = &code
	}
	return SkillAvailability{
		Enabled:  result.Enabled,
		Locked:   result.Locked,
		LockCode: lockCode,
		CTA:      result.CTA,
	}
}

func marketplaceBadges(s skillmodel.Skill) []string {
	badges := make([]string, 0, 4)
	if s.RequiredPlan != enums.RequiredPlanFree {
		badges = append(badges, string(s.RequiredPlan))
	}
	if s.FeaturedFlag {
		badges = append(badges, "featured")
	}
	if s.IsKidsExclusive {
		badges = append(badges, "kids_exclusive")
	} else if s.IsKidsSafe {
		badges = append(badges, "kids_safe")
	}
	return badges
}

func marketplaceUserInfo(c *gin.Context, db *gorm.DB) (marketplaceUserContext, error) {
	id := c.GetInt("id")
	if id == 0 {
		return marketplaceUserContext{
			IsAnonymous: true,
			Plan:        enums.RequiredPlanFree,
			SubActive:   true,
		}, nil
	}

	user := platformmodel.User{}
	if err := db.Select([]string{"id", "group", "kids_mode", "status"}).
		Where("id = ?", id).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return marketplaceUserContext{
				IsAnonymous: true,
				Plan:        enums.RequiredPlanFree,
				SubActive:   true,
			}, nil
		}
		return marketplaceUserContext{}, err
	}
	if user.Status == common.UserStatusDisabled {
		return marketplaceUserContext{
			IsAnonymous: true,
			Plan:        enums.RequiredPlanFree,
			SubActive:   true,
		}, nil
	}
	return marketplaceUserContext{
		UserID:     int64(user.Id),
		Plan:       marketplaceGroupToPlan(user.Group),
		IsKidsMode: user.KidsMode,
		SubActive:  true,
	}, nil
}

func marketplaceEnablementBySkillID(db *gorm.DB, user marketplaceUserContext, skills []skillmodel.Skill) (map[string]bool, error) {
	enabled := map[string]bool{}
	if user.IsAnonymous || user.UserID == 0 || len(skills) == 0 {
		return enabled, nil
	}
	ids := make([]string, 0, len(skills))
	for _, s := range skills {
		ids = append(ids, s.ID)
	}
	var rows []skillmodel.UserEnabledSkill
	if err := db.Select([]string{"skill_id", "enabled", "removed_at"}).
		Where("user_id = ? AND tenant_id = ? AND skill_id IN ?", user.UserID, user.UserID, ids).
		Find(&rows).Error; err != nil {
		return nil, err
	}
	for _, row := range rows {
		enabled[row.SkillID] = row.Enabled && row.RemovedAt == nil
	}
	return enabled, nil
}

func marketplaceSavedBySkillID(db *gorm.DB, user marketplaceUserContext, skills []skillmodel.Skill) (map[string]bool, error) {
	saved := map[string]bool{}
	if user.IsAnonymous || user.UserID == 0 || len(skills) == 0 {
		return saved, nil
	}
	ids := make([]string, 0, len(skills))
	for _, s := range skills {
		ids = append(ids, s.ID)
	}
	var rows []skillmodel.UserSavedSkill
	if err := db.Select([]string{"skill_id", "saved"}).
		Where("user_id = ? AND tenant_id = ? AND skill_id IN ?", user.UserID, user.UserID, ids).
		Find(&rows).Error; err != nil {
		return nil, err
	}
	for _, row := range rows {
		saved[row.SkillID] = row.Saved
	}
	return saved, nil
}

func marketplaceGroupToPlan(group string) enums.RequiredPlan {
	switch group {
	case string(enums.RequiredPlanPro):
		return enums.RequiredPlanPro
	case string(enums.RequiredPlanEnterprise):
		return enums.RequiredPlanEnterprise
	default:
		return enums.RequiredPlanFree
	}
}

// publicSkillDetailFromModel builds the detail-page response.
// download_cta.url uses slug (not ID) because slugs are human-readable and
// stable. DR-81 must accept slug as the {id} path parameter — verify before
// closing DR-81 or this CTA will produce broken URLs.
func skillVersionInstructionsFromModel(version skillmodel.SkillVersion) SkillVersionInstructions {
	return SkillVersionInstructions{
		DownloadInstructions: version.DownloadInstructions,
		UsageInstructions:    version.UsageInstructions,
		Prerequisites:        rawJSONWithDefault(version.Prerequisites, "[]"),
		Quickstart:           rawJSONWithDefault(version.Quickstart, "[]"),
		ExampleIO:            rawJSONWithDefault(version.ExampleIO, "[]"),
	}
}

func publicSkillDetailFromModel(s skillmodel.Skill, instructions SkillVersionInstructions, saved bool) PublicSkillDetail {
	public := publicSkillFromModel(s, true)
	return PublicSkillDetail{
		PublicSkill:           public,
		RequiresDeepRouterKey: true,
		DownloadCTA: DownloadCTA{
			URL:    "/api/v1/marketplace/skills/" + url.PathEscape(s.Slug) + "/download",
			Method: "GET",
		},
		Instructions: instructions,
		Saved:        saved,
	}
}

func mySkillAvailabilityFromResult(result availability.Result) MySkillAvailability {
	var lockCode *errcodes.ErrorCode
	if result.LockCode != "" {
		code := result.LockCode
		lockCode = &code
	}
	return MySkillAvailability{
		Executable: result.Executable,
		Locked:     result.Locked,
		LockCode:   lockCode,
		CTA:        result.CTA,
	}
}

func currentUserKidsMode(db *gorm.DB, userID int64) (bool, error) {
	var user platformmodel.User
	err := db.Select("kids_mode").Where("id = ?", userID).First(&user).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return user.KidsMode, nil
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
	if len(value) == 0 {
		return json.RawMessage("[]")
	}
	var decoded any
	if err := common.Unmarshal(value, &decoded); err != nil {
		return json.RawMessage("[]")
	}
	return json.RawMessage(value)
}

func skillDB(c *gin.Context) (*gorm.DB, bool) {
	dbMu.RLock()
	d := db
	dbMu.RUnlock()
	if d == nil {
		skillapi.Error(c, errcodes.ErrSkillInternalError, "Skill database is unavailable.", nil)
		return nil, false
	}
	return d, true
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

type createSkillRequest struct {
	Slug              string                 `json:"slug"`
	Name              string                 `json:"name"`
	ShortDescription  string                 `json:"short_description"`
	Description       string                 `json:"description"`
	Category          string                 `json:"category"`
	RequiredPlan      enums.RequiredPlan     `json:"required_plan"`
	MonetizationType  enums.MonetizationType `json:"monetization_type"`
	PriceMarkup       *float64               `json:"price_markup"`
	FreeQuotaPerMonth *int                   `json:"free_quota_per_month"`
	MaxInputTokens    *int                   `json:"max_input_tokens"`
}

type patchSkillRequest struct {
	Name                 *string                   `json:"name,omitempty"`
	ShortDescription     *string                   `json:"short_description,omitempty"`
	Description          *string                   `json:"description,omitempty"`
	Category             *string                   `json:"category,omitempty"`
	Tags                 json.RawMessage           `json:"tags,omitempty"`
	IconURL              json.RawMessage           `json:"icon_url,omitempty"`
	InputHints           json.RawMessage           `json:"input_hints,omitempty"`
	ExampleInputs        json.RawMessage           `json:"example_inputs,omitempty"`
	ExampleOutputs       json.RawMessage           `json:"example_outputs,omitempty"`
	RequiredPlan         *enums.RequiredPlan       `json:"required_plan,omitempty"`
	MonetizationType     *enums.MonetizationType   `json:"monetization_type,omitempty"`
	PriceMarkup          *float64                  `json:"price_markup,omitempty"`
	FreeQuotaPerMonth    json.RawMessage           `json:"free_quota_per_month,omitempty"`
	MaxInputTokens       json.RawMessage           `json:"max_input_tokens,omitempty"`
	ModelWhitelist       json.RawMessage           `json:"model_whitelist,omitempty"`
	TimeoutSeconds       *int                      `json:"timeout_seconds,omitempty"`
	IsKidsSafe           *bool                     `json:"is_kids_safe,omitempty"`
	IsKidsExclusive      *bool                     `json:"is_kids_exclusive,omitempty"`
	KidsApprovalStatus   *enums.KidsApprovalStatus `json:"kids_approval_status,omitempty"`
	AIDisclosureRequired *bool                     `json:"ai_disclosure_required,omitempty"`
	FeaturedFlag         *bool                     `json:"featured_flag,omitempty"`
	FeaturedRank         json.RawMessage           `json:"featured_rank,omitempty"`
}

type AdminSkillAuditEntry struct {
	ID             string          `json:"id"`
	SkillID        *string         `json:"skill_id,omitempty"`
	SkillVersionID *string         `json:"skill_version_id,omitempty"`
	ActorID        int64           `json:"actor_id"`
	ActorRole      string          `json:"actor_role"`
	Action         string          `json:"action"`
	ActionReason   *string         `json:"action_reason,omitempty"`
	ChangedFields  json.RawMessage `json:"changed_fields"`
	RequestID      *string         `json:"request_id,omitempty"`
	CreatedAt      time.Time       `json:"created_at"`
}

// CreateAdminSkill serves POST /api/v1/admin/skills (Super Admin only).
// Creates a draft Skill shell; instruction templates are managed via version APIs.
func CreateAdminSkill(c *gin.Context) {
	var req createSkillRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		writeCreateSkillValidationError(c, "INVALID_JSON", "Invalid JSON request body.")
		return
	}
	normalizeCreateSkillRequest(&req)
	if reason := validateCreateSkillRequest(req); reason != "" {
		writeCreateSkillValidationError(c, reason, "Invalid skill create request.")
		return
	}

	db, ok := skillDB(c)
	if !ok {
		return
	}

	var existing int64
	if err := db.Model(&skillmodel.Skill{}).Where("slug = ?", req.Slug).Count(&existing).Error; err != nil {
		writeDBError(c, err)
		return
	}
	if existing > 0 {
		writeSkillConflict(c, "Skill slug already exists.")
		return
	}

	creatorID := int64(c.GetInt("id"))
	s := skillmodel.Skill{
		Slug:                 req.Slug,
		Status:               enums.SkillStatusDraft,
		Category:             req.Category,
		Tags:                 skillmodel.SkillJSONB(`[]`),
		DefaultLocale:        "en",
		Name:                 req.Name,
		ShortDescription:     req.ShortDescription,
		Description:          req.Description,
		InputHints:           skillmodel.SkillJSONB(`[]`),
		ExampleInputs:        skillmodel.SkillJSONB(`[]`),
		ExampleOutputs:       skillmodel.SkillJSONB(`[]`),
		RequiredPlan:         req.RequiredPlan,
		MonetizationType:     req.MonetizationType,
		PriceMarkup:          createSkillPriceMarkup(req),
		FreeQuotaPerMonth:    req.FreeQuotaPerMonth,
		MaxInputTokens:       req.MaxInputTokens,
		ModelWhitelist:       skillmodel.SkillJSONB(`[]`),
		TimeoutSeconds:       45,
		KidsApprovalStatus:   enums.KidsApprovalStatusNotRequired,
		AIDisclosureRequired: true,
		CreatedBy:            creatorID,
	}
	role := strconv.Itoa(c.GetInt("role"))
	if err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&s).Error; err != nil {
			return err
		}
		return writeSkillCreateAuditLog(tx, c, s.ID, creatorID, role, skillCreateChangedFields(req), skillCreationAuditAfter(s))
	}); err != nil {
		if isUniqueConstraintError(err) {
			writeSkillConflict(c, "Skill slug already exists.")
			return
		}
		writeDBError(c, err)
		return
	}
	c.JSON(http.StatusCreated, skillapi.SuccessEnvelope{
		Data: adminSkillFromModel(s),
		Meta: skillapi.Meta{RequestID: skillapi.RequestID(c)},
	})
}

func PatchAdminSkill(c *gin.Context) {
	var req patchSkillRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		writeCreateSkillValidationError(c, "INVALID_JSON", "Invalid JSON request body.")
		return
	}

	database, ok := skillDB(c)
	if !ok {
		return
	}

	actorID := int64(c.GetInt("id"))
	role := strconv.Itoa(c.GetInt("role"))
	skillID := c.Param("skill_id")
	var updated skillmodel.Skill
	if err := database.Transaction(func(tx *gorm.DB) error {
		var current skillmodel.Skill
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&current, "id = ?", skillID).Error; err != nil {
			return err
		}
		before := skillPatchAuditBefore(current)
		updates, changed, reason, err := buildSkillPatchUpdates(current, req, actorID)
		if err != nil {
			return err
		}
		if reason != "" {
			return skillPatchValidationError{reason: reason}
		}
		if len(updates) == 0 {
			updated = current
			return nil
		}
		selectedColumns := append(append([]string{}, changed...), "updated_by")
		if err := tx.Model(&skillmodel.Skill{}).Where("id = ?", skillID).Select(selectedColumns).Updates(updates).Error; err != nil {
			return err
		}
		if err := tx.First(&updated, "id = ?", skillID).Error; err != nil {
			return err
		}
		changedFields, err := common.Marshal(changed)
		if err != nil {
			return err
		}
		if err := writeSkillPatchAuditLog(tx, c, skillID, actorID, role, skillmodel.SkillJSONB(changedFields), before, skillPatchAuditAfter(updated)); err != nil {
			return err
		}
		return nil
	}); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			writeSkillLookupError(c, err)
			return
		}
		var validation skillPatchValidationError
		if errors.As(err, &validation) {
			writeCreateSkillValidationError(c, validation.reason, "Invalid skill patch request.")
			return
		}
		writeDBError(c, err)
		return
	}
	skillapi.Success(c, adminSkillFromModel(updated))
}

func ListAdminSkillAuditLog(c *gin.Context) {
	page, validationErr := skillapi.ParsePageParams(c)
	if validationErr != nil {
		skillapi.AbortQueryError(c, validationErr)
		return
	}
	database, ok := skillDB(c)
	if !ok {
		return
	}
	skillID := c.Param("skill_id")
	if err := ensureSkillExists(database, skillID); err != nil {
		writeSkillLookupError(c, err)
		return
	}
	query := database.Model(&skillmodel.SkillAuditLog{}).Where("skill_id = ?", skillID)
	var total int64
	if err := query.Count(&total).Error; err != nil {
		writeDBError(c, err)
		return
	}
	var rows []skillmodel.SkillAuditLog
	if err := query.Order("created_at DESC").Offset(page.Offset).Limit(page.Limit).Find(&rows).Error; err != nil {
		writeDBError(c, err)
		return
	}
	out := make([]AdminSkillAuditEntry, 0, len(rows))
	for _, row := range rows {
		out = append(out, adminSkillAuditEntryFromModel(row))
	}
	skillapi.List(c, out, skillapi.NewPagination(page.Page, page.Limit, total))
}

func normalizeCreateSkillRequest(req *createSkillRequest) {
	req.Slug = strings.TrimSpace(req.Slug)
	req.Name = strings.TrimSpace(req.Name)
	req.ShortDescription = strings.TrimSpace(req.ShortDescription)
	req.Description = strings.TrimSpace(req.Description)
	req.Category = strings.TrimSpace(req.Category)
	req.RequiredPlan = enums.RequiredPlan(strings.TrimSpace(string(req.RequiredPlan)))
	req.MonetizationType = enums.MonetizationType(strings.TrimSpace(string(req.MonetizationType)))
}

func validateCreateSkillRequest(req createSkillRequest) string {
	switch {
	case req.Slug == "":
		return "MISSING_SLUG"
	case len(req.Slug) > createSkillSlugMaxLength:
		return "SLUG_TOO_LONG"
	case !createSkillSlugPattern.MatchString(req.Slug):
		return "INVALID_SLUG_FORMAT"
	case req.Name == "":
		return "MISSING_NAME"
	case utf8.RuneCountInString(req.Name) > createSkillNameMaxLength:
		return "NAME_TOO_LONG"
	case req.ShortDescription == "":
		return "MISSING_SHORT_DESCRIPTION"
	case utf8.RuneCountInString(req.ShortDescription) > createSkillShortDescriptionMaxLength:
		return "SHORT_DESCRIPTION_TOO_LONG"
	case req.Description == "":
		return "MISSING_DESCRIPTION"
	case req.Category == "":
		return "MISSING_CATEGORY"
	case utf8.RuneCountInString(req.Category) > createSkillCategoryMaxLength:
		return "CATEGORY_TOO_LONG"
	case !req.RequiredPlan.Valid():
		return "INVALID_REQUIRED_PLAN"
	case !req.MonetizationType.Valid():
		return "INVALID_MONETIZATION_TYPE"
	case req.MonetizationType == enums.MonetizationTypeTokenMarkup && (req.PriceMarkup == nil || *req.PriceMarkup <= 0):
		return "PRICE_MARKUP_REQUIRED"
	case req.MonetizationType != enums.MonetizationTypeTokenMarkup && req.PriceMarkup != nil && *req.PriceMarkup != 0:
		return "PRICE_MARKUP_NOT_ALLOWED"
	case req.FreeQuotaPerMonth != nil && *req.FreeQuotaPerMonth < 0:
		return "INVALID_FREE_QUOTA_PER_MONTH"
	case req.MaxInputTokens != nil && *req.MaxInputTokens <= 0:
		return "INVALID_MAX_INPUT_TOKENS"
	case createSkillRequiresMaxInputTokens(req) && req.MaxInputTokens == nil:
		return "MAX_INPUT_TOKENS_REQUIRED"
	default:
		return ""
	}
}

type skillPatchValidationError struct {
	reason string
}

func (e skillPatchValidationError) Error() string { return e.reason }

func buildSkillPatchUpdates(current skillmodel.Skill, req patchSkillRequest, actorID int64) (map[string]any, []string, string, error) {
	updates := map[string]any{}
	changed := make([]string, 0, 16)
	add := func(column string, value any) {
		updates[column] = value
		changed = append(changed, column)
	}

	if req.Name != nil {
		name := strings.TrimSpace(*req.Name)
		if name == "" {
			return nil, nil, "MISSING_NAME", nil
		}
		if utf8.RuneCountInString(name) > createSkillNameMaxLength {
			return nil, nil, "NAME_TOO_LONG", nil
		}
		current.Name = name
		add("name", name)
	}
	if req.ShortDescription != nil {
		short := strings.TrimSpace(*req.ShortDescription)
		if short == "" {
			return nil, nil, "MISSING_SHORT_DESCRIPTION", nil
		}
		if utf8.RuneCountInString(short) > createSkillShortDescriptionMaxLength {
			return nil, nil, "SHORT_DESCRIPTION_TOO_LONG", nil
		}
		current.ShortDescription = short
		add("short_description", short)
	}
	if req.Description != nil {
		description := strings.TrimSpace(*req.Description)
		if description == "" {
			return nil, nil, "MISSING_DESCRIPTION", nil
		}
		current.Description = description
		add("description", description)
	}
	if req.Category != nil {
		category := strings.TrimSpace(*req.Category)
		if category == "" {
			return nil, nil, "MISSING_CATEGORY", nil
		}
		if utf8.RuneCountInString(category) > createSkillCategoryMaxLength {
			return nil, nil, "CATEGORY_TOO_LONG", nil
		}
		current.Category = category
		add("category", category)
	}
	if len(req.Tags) > 0 {
		tags, err := normalizeJSONPatchValue(req.Tags, "[]")
		if err != nil {
			return nil, nil, "INVALID_TAGS", nil
		}
		current.Tags = tags
		add("tags", tags)
	}
	if len(req.IconURL) > 0 {
		iconURL, reason, err := nullableStringPatchValue(req.IconURL, "icon_url")
		if err != nil || reason != "" {
			return nil, nil, reason, err
		}
		current.IconURL = iconURL
		add("icon_url", iconURL)
	}
	if len(req.InputHints) > 0 {
		inputHints, err := normalizeJSONPatchValue(req.InputHints, "[]")
		if err != nil {
			return nil, nil, "INVALID_INPUT_HINTS", nil
		}
		current.InputHints = inputHints
		add("input_hints", inputHints)
	}
	if len(req.ExampleInputs) > 0 {
		exampleInputs, err := normalizeJSONPatchValue(req.ExampleInputs, "[]")
		if err != nil {
			return nil, nil, "INVALID_EXAMPLE_INPUTS", nil
		}
		current.ExampleInputs = exampleInputs
		add("example_inputs", exampleInputs)
	}
	if len(req.ExampleOutputs) > 0 {
		exampleOutputs, err := normalizeJSONPatchValue(req.ExampleOutputs, "[]")
		if err != nil {
			return nil, nil, "INVALID_EXAMPLE_OUTPUTS", nil
		}
		current.ExampleOutputs = exampleOutputs
		add("example_outputs", exampleOutputs)
	}
	if req.RequiredPlan != nil {
		plan := enums.RequiredPlan(strings.TrimSpace(string(*req.RequiredPlan)))
		if !plan.Valid() {
			return nil, nil, "INVALID_REQUIRED_PLAN", nil
		}
		current.RequiredPlan = plan
		add("required_plan", plan)
	}
	if req.MonetizationType != nil {
		monetization := enums.MonetizationType(strings.TrimSpace(string(*req.MonetizationType)))
		if !monetization.Valid() {
			return nil, nil, "INVALID_MONETIZATION_TYPE", nil
		}
		current.MonetizationType = monetization
		add("monetization_type", monetization)
	}
	if req.PriceMarkup != nil {
		current.PriceMarkup = *req.PriceMarkup
		add("price_markup", *req.PriceMarkup)
	}
	if len(req.FreeQuotaPerMonth) > 0 {
		freeQuota, reason, err := nullableIntPatchValue(req.FreeQuotaPerMonth, "free_quota_per_month")
		if err != nil || reason != "" {
			return nil, nil, reason, err
		}
		if freeQuota != nil && *freeQuota < 0 {
			return nil, nil, "INVALID_FREE_QUOTA_PER_MONTH", nil
		}
		current.FreeQuotaPerMonth = freeQuota
		add("free_quota_per_month", freeQuota)
	}
	if len(req.MaxInputTokens) > 0 {
		maxInputTokens, reason, err := nullableIntPatchValue(req.MaxInputTokens, "max_input_tokens")
		if err != nil || reason != "" {
			return nil, nil, reason, err
		}
		if maxInputTokens != nil && *maxInputTokens <= 0 {
			return nil, nil, "INVALID_MAX_INPUT_TOKENS", nil
		}
		current.MaxInputTokens = maxInputTokens
		add("max_input_tokens", maxInputTokens)
	}
	if len(req.ModelWhitelist) > 0 {
		modelWhitelist, err := normalizeJSONPatchValue(req.ModelWhitelist, "[]")
		if err != nil {
			return nil, nil, "INVALID_MODEL_WHITELIST", nil
		}
		current.ModelWhitelist = modelWhitelist
		add("model_whitelist", modelWhitelist)
	}
	if req.TimeoutSeconds != nil {
		if *req.TimeoutSeconds < 1 || *req.TimeoutSeconds > 120 {
			return nil, nil, "INVALID_TIMEOUT_SECONDS", nil
		}
		current.TimeoutSeconds = *req.TimeoutSeconds
		add("timeout_seconds", *req.TimeoutSeconds)
	}
	if req.IsKidsSafe != nil {
		current.IsKidsSafe = *req.IsKidsSafe
		add("is_kids_safe", *req.IsKidsSafe)
	}
	if req.IsKidsExclusive != nil {
		current.IsKidsExclusive = *req.IsKidsExclusive
		add("is_kids_exclusive", *req.IsKidsExclusive)
	}
	if current.IsKidsExclusive && !current.IsKidsSafe {
		return nil, nil, "KIDS_EXCLUSIVE_REQUIRES_SAFE", nil
	}
	if req.KidsApprovalStatus != nil {
		kidsApproval := enums.KidsApprovalStatus(strings.TrimSpace(string(*req.KidsApprovalStatus)))
		if !kidsApproval.Valid() {
			return nil, nil, "INVALID_KIDS_APPROVAL_STATUS", nil
		}
		current.KidsApprovalStatus = kidsApproval
		add("kids_approval_status", kidsApproval)
	}
	if req.AIDisclosureRequired != nil {
		current.AIDisclosureRequired = *req.AIDisclosureRequired
		add("ai_disclosure_required", *req.AIDisclosureRequired)
	}
	if req.FeaturedFlag != nil {
		current.FeaturedFlag = *req.FeaturedFlag
		add("featured_flag", *req.FeaturedFlag)
	}
	if len(req.FeaturedRank) > 0 {
		featuredRank, reason, err := nullableIntPatchValue(req.FeaturedRank, "featured_rank")
		if err != nil || reason != "" {
			return nil, nil, reason, err
		}
		if featuredRank != nil && *featuredRank < 0 {
			return nil, nil, "INVALID_FEATURED_RANK", nil
		}
		current.FeaturedRank = featuredRank
		add("featured_rank", featuredRank)
	}

	switch {
	case current.MonetizationType == enums.MonetizationTypeTokenMarkup && current.PriceMarkup <= 0:
		return nil, nil, "PRICE_MARKUP_REQUIRED", nil
	case current.MonetizationType != enums.MonetizationTypeTokenMarkup && current.PriceMarkup != 0:
		return nil, nil, "PRICE_MARKUP_NOT_ALLOWED", nil
	case patchSkillRequiresMaxInputTokens(current) && current.MaxInputTokens == nil:
		return nil, nil, "MAX_INPUT_TOKENS_REQUIRED", nil
	}
	if len(updates) > 0 {
		updates["updated_by"] = actorID
	}
	return updates, changed, "", nil
}

func patchSkillRequiresMaxInputTokens(s skillmodel.Skill) bool {
	return s.RequiredPlan == enums.RequiredPlanFree ||
		s.MonetizationType == enums.MonetizationTypeFree ||
		s.FreeQuotaPerMonth != nil
}

func normalizeJSONPatchValue(raw json.RawMessage, fallback string) (skillmodel.SkillJSONB, error) {
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) == 0 || bytes.Equal(trimmed, []byte("null")) {
		return skillmodel.SkillJSONB(fallback), nil
	}
	var decoded any
	if err := common.Unmarshal(trimmed, &decoded); err != nil {
		return nil, err
	}
	return skillmodel.SkillJSONB(append([]byte(nil), trimmed...)), nil
}

func nullableIntPatchValue(raw json.RawMessage, field string) (*int, string, error) {
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) == 0 || bytes.Equal(trimmed, []byte("null")) {
		return nil, "", nil
	}
	var value int
	if err := common.Unmarshal(trimmed, &value); err != nil {
		return nil, "INVALID_" + strings.ToUpper(field), nil
	}
	return &value, "", nil
}

func nullableStringPatchValue(raw json.RawMessage, field string) (*string, string, error) {
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) == 0 || bytes.Equal(trimmed, []byte("null")) {
		return nil, "", nil
	}
	var value string
	if err := common.Unmarshal(trimmed, &value); err != nil {
		return nil, "INVALID_" + strings.ToUpper(field), nil
	}
	value = strings.TrimSpace(value)
	if value == "" {
		return nil, "", nil
	}
	return &value, "", nil
}

func createSkillRequiresMaxInputTokens(req createSkillRequest) bool {
	return req.RequiredPlan == enums.RequiredPlanFree ||
		req.MonetizationType == enums.MonetizationTypeFree ||
		req.FreeQuotaPerMonth != nil
}

func createSkillPriceMarkup(req createSkillRequest) float64 {
	if req.PriceMarkup != nil {
		return *req.PriceMarkup
	}
	return 0
}

func writeCreateSkillValidationError(c *gin.Context, reason string, message string) {
	skillapi.Error(c, errcodes.ErrInvalidRequest, message, gin.H{"reason": reason})
}

func writeSkillConflict(c *gin.Context, message string) {
	c.JSON(http.StatusConflict, skillapi.ErrorEnvelope{
		Error: skillapi.ErrorBody{
			Code:      errcodes.ErrSkillConflict,
			Message:   message,
			Detail:    gin.H{"reason": "DUPLICATE_SLUG"},
			RequestID: skillapi.RequestID(c),
		},
	})
}

func writeSkillCreateAuditLog(tx *gorm.DB, c *gin.Context, skillID string, actorID int64, actorRole string, changedFields skillmodel.SkillJSONB, afterValue *skillmodel.SkillJSONB) error {
	requestID := skillapi.RequestID(c)
	ipAddress := c.ClientIP()
	userAgent := c.Request.UserAgent()
	return tx.Create(&skillmodel.SkillAuditLog{
		SkillID:       &skillID,
		ActorID:       actorID,
		ActorRole:     actorRole,
		Action:        "skill_created",
		ChangedFields: changedFields,
		AfterValue:    afterValue,
		RequestID:     &requestID,
		IPAddress:     &ipAddress,
		UserAgent:     &userAgent,
	}).Error
}

func writeSkillPatchAuditLog(tx *gorm.DB, c *gin.Context, skillID string, actorID int64, actorRole string, changedFields skillmodel.SkillJSONB, beforeValue, afterValue *skillmodel.SkillJSONB) error {
	requestID := skillapi.RequestID(c)
	ipAddress := c.ClientIP()
	userAgent := c.Request.UserAgent()
	return tx.Create(&skillmodel.SkillAuditLog{
		SkillID:       &skillID,
		ActorID:       actorID,
		ActorRole:     actorRole,
		Action:        "skill_updated",
		ChangedFields: changedFields,
		BeforeValue:   beforeValue,
		AfterValue:    afterValue,
		RequestID:     &requestID,
		IPAddress:     &ipAddress,
		UserAgent:     &userAgent,
	}).Error
}

func skillPatchAuditBefore(s skillmodel.Skill) *skillmodel.SkillJSONB {
	return skillPatchAuditSnapshot(s)
}

func skillPatchAuditAfter(s skillmodel.Skill) *skillmodel.SkillJSONB {
	return skillPatchAuditSnapshot(s)
}

func skillPatchAuditSnapshot(s skillmodel.Skill) *skillmodel.SkillJSONB {
	return auditJSON(map[string]any{
		"skill_id":               s.ID,
		"status":                 s.Status,
		"category":               s.Category,
		"name":                   s.Name,
		"short_description":      s.ShortDescription,
		"description_sha256":     sha256Hex([]byte(s.Description)),
		"tags_sha256":            sha256Hex(s.Tags),
		"icon_url":               s.IconURL,
		"input_hints_sha256":     sha256Hex(s.InputHints),
		"example_inputs_sha256":  sha256Hex(s.ExampleInputs),
		"example_outputs_sha256": sha256Hex(s.ExampleOutputs),
		"required_plan":          s.RequiredPlan,
		"monetization_type":      s.MonetizationType,
		"price_markup":           s.PriceMarkup,
		"free_quota_per_month":   s.FreeQuotaPerMonth,
		"max_input_tokens":       s.MaxInputTokens,
		"model_whitelist_sha256": sha256Hex(s.ModelWhitelist),
		"timeout_seconds":        s.TimeoutSeconds,
		"is_kids_safe":           s.IsKidsSafe,
		"is_kids_exclusive":      s.IsKidsExclusive,
		"kids_approval_status":   s.KidsApprovalStatus,
		"featured_flag":          s.FeaturedFlag,
		"featured_rank":          s.FeaturedRank,
	})
}

func skillCreateChangedFields(req createSkillRequest) skillmodel.SkillJSONB {
	fields := []string{
		"slug",
		"status",
		"category",
		"name",
		"short_description",
		"description",
		"required_plan",
		"monetization_type",
	}
	if req.MonetizationType == enums.MonetizationTypeTokenMarkup {
		fields = append(fields, "price_markup")
	}
	if req.FreeQuotaPerMonth != nil {
		fields = append(fields, "free_quota_per_month")
	}
	if req.MaxInputTokens != nil {
		fields = append(fields, "max_input_tokens")
	}
	raw, err := common.Marshal(fields)
	if err != nil {
		return skillmodel.SkillJSONB(`[]`)
	}
	return skillmodel.SkillJSONB(raw)
}

func skillCreationAuditAfter(s skillmodel.Skill) *skillmodel.SkillJSONB {
	return auditJSON(map[string]any{
		"skill_id":             s.ID,
		"slug":                 s.Slug,
		"status":               s.Status,
		"category":             s.Category,
		"name":                 s.Name,
		"short_description":    s.ShortDescription,
		"description_sha256":   sha256Hex([]byte(s.Description)),
		"required_plan":        s.RequiredPlan,
		"monetization_type":    s.MonetizationType,
		"price_markup":         s.PriceMarkup,
		"free_quota_per_month": s.FreeQuotaPerMonth,
		"max_input_tokens":     s.MaxInputTokens,
	})
}

func adminSkillAuditEntryFromModel(row skillmodel.SkillAuditLog) AdminSkillAuditEntry {
	return AdminSkillAuditEntry{
		ID:             row.ID,
		SkillID:        row.SkillID,
		SkillVersionID: row.SkillVersionID,
		ActorID:        row.ActorID,
		ActorRole:      row.ActorRole,
		Action:         row.Action,
		ActionReason:   row.ActionReason,
		ChangedFields:  rawJSONWithDefault(row.ChangedFields, "[]"),
		RequestID:      row.RequestID,
		CreatedAt:      row.CreatedAt,
	}
}

func isUniqueConstraintError(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "unique") || strings.Contains(msg, "duplicate")
}
