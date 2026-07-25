package controller

import (
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

var inspirationSlugPattern = regexp.MustCompile(`^[a-z0-9]+(?:-[a-z0-9]+)*$`)
var inspirationPlaceholderPattern = regexp.MustCompile(`\{\{([a-z][a-z0-9_]*)\}\}`)
var inspirationEventTypes = map[string]bool{"impression": true, "open": true, "copy": true, "apply": true, "generate": true, "success": true, "save": true, "favorite": true}
var inspirationModalities = map[string]bool{"chat": true, "image": true, "video": true, "audio": true}

func ListInspirationCategories(c *gin.Context) {
	v, e := model.ListInspirationCategories()
	if e != nil {
		common.ApiError(c, e)
		return
	}
	common.ApiSuccess(c, v)
}
func ListInspirationTemplates(c *gin.Context) {
	p := common.GetPageQuery(c)
	v, n, e := model.ListInspirationRecipes(strings.TrimSpace(c.Query("category")), strings.TrimSpace(c.Query("modality")), p.GetStartIdx(), p.GetPageSize(), false)
	if e != nil {
		common.ApiError(c, e)
		return
	}
	p.SetTotal(int(n))
	p.SetItems(v)
	common.ApiSuccess(c, p)
}
func GetInspirationTemplate(c *gin.Context) {
	v, e := model.GetInspirationRecipe(c.Param("slug"))
	if e != nil {
		common.ApiError(c, e)
		return
	}
	common.ApiSuccess(c, v)
}
func RecordInspirationEvents(c *gin.Context) {
	var body struct {
		Events []model.InspirationEvent `json:"events"`
	}
	if e := c.ShouldBindJSON(&body); e != nil {
		common.ApiError(c, e)
		return
	}
	if len(body.Events) == 0 || len(body.Events) > 20 {
		common.ApiErrorMsg(c, "events must contain 1 to 20 items")
		return
	}
	for i := range body.Events {
		if _, e := uuid.Parse(body.Events[i].EventId); e != nil || !inspirationEventTypes[body.Events[i].Type] || body.Events[i].TemplateId <= 0 || body.Events[i].VersionId <= 0 {
			common.ApiErrorMsg(c, "invalid inspiration event")
			return
		}
		body.Events[i].UserId = c.GetInt("id")
		if body.Events[i].Type == "apply" && body.Events[i].UserId == 0 {
			common.ApiErrorMsg(c, "authentication is required for apply events")
			return
		}
	}
	n, e := model.RecordInspirationEvents(body.Events)
	if e != nil {
		common.ApiError(c, e)
		return
	}
	common.ApiSuccess(c, gin.H{"accepted": n})
}
func UseInspirationTemplate(c *gin.Context) {
	id, e := strconv.Atoi(c.Param("id"))
	if e != nil || id <= 0 {
		common.ApiErrorMsg(c, "invalid id")
		return
	}
	var t model.InspirationTemplate
	if e = model.DB.Where("id=? AND status=? AND published_version_id IS NOT NULL", id, "published").First(&t).Error; e != nil {
		common.ApiError(c, e)
		return
	}
	event := model.InspirationEvent{EventId: uuid.NewString(), TemplateId: id, VersionId: *t.PublishedVersionId, UserId: c.GetInt("id"), Type: "apply"}
	_, e = model.RecordInspirationEvents([]model.InspirationEvent{event})
	if e != nil {
		common.ApiError(c, e)
		return
	}
	common.ApiSuccess(c, nil)
}

func GetInspirationLibrary(c *gin.Context) {
	u := c.GetInt("id")
	var collections []model.InspirationCollection
	var saves []model.InspirationSave
	if e := model.DB.Where("user_id=?", u).Order("id").Find(&collections).Error; e != nil {
		common.ApiError(c, e)
		return
	}
	if e := model.DB.Where("user_id=?", u).Order("id DESC").Find(&saves).Error; e != nil {
		common.ApiError(c, e)
		return
	}
	common.ApiSuccess(c, gin.H{"collections": collections, "saves": saves})
}
func PutInspirationFavorite(c *gin.Context)    { inspirationSave(c, 0, true) }
func DeleteInspirationFavorite(c *gin.Context) { inspirationSave(c, 0, false) }
func inspirationSave(c *gin.Context, collection int, put bool) {
	id, e := strconv.Atoi(c.Param("templateId"))
	if id == 0 {
		id, e = strconv.Atoi(c.Param("id"))
	}
	if e != nil || id <= 0 {
		common.ApiErrorMsg(c, "invalid template id")
		return
	}
	if put {
		e = model.PutInspirationSave(c.GetInt("id"), collection, id)
	} else {
		e = model.DeleteInspirationSave(c.GetInt("id"), collection, id)
	}
	if e != nil {
		common.ApiError(c, e)
		return
	}
	common.ApiSuccess(c, nil)
}
func CreateInspirationCollection(c *gin.Context) {
	var b struct {
		Name string `json:"name"`
	}
	if e := c.ShouldBindJSON(&b); e != nil {
		common.ApiError(c, e)
		return
	}
	b.Name = strings.TrimSpace(b.Name)
	if b.Name == "" || len(b.Name) > 128 {
		common.ApiErrorMsg(c, "invalid collection name")
		return
	}
	now := time.Now().Unix()
	v := model.InspirationCollection{UserId: c.GetInt("id"), Name: b.Name, CreatedAt: now, UpdatedAt: now}
	if e := model.DB.Create(&v).Error; e != nil {
		common.ApiError(c, e)
		return
	}
	common.ApiSuccess(c, v)
}
func UpdateInspirationCollection(c *gin.Context) {
	id, e := strconv.Atoi(c.Param("id"))
	var b struct {
		Name string `json:"name"`
	}
	if e != nil || c.ShouldBindJSON(&b) != nil || strings.TrimSpace(b.Name) == "" || len(b.Name) > 128 {
		common.ApiErrorMsg(c, "invalid collection")
		return
	}
	r := model.DB.Model(&model.InspirationCollection{}).Where("id=? AND user_id=?", id, c.GetInt("id")).Updates(map[string]any{"name": strings.TrimSpace(b.Name), "updated_at": time.Now().Unix()})
	if r.Error != nil {
		common.ApiError(c, r.Error)
		return
	}
	if r.RowsAffected == 0 {
		common.ApiError(c, gorm.ErrRecordNotFound)
		return
	}
	common.ApiSuccess(c, nil)
}
func DeleteInspirationCollection(c *gin.Context) {
	id, e := strconv.Atoi(c.Param("id"))
	if e != nil {
		common.ApiErrorMsg(c, "invalid id")
		return
	}
	e = model.DB.Transaction(func(tx *gorm.DB) error {
		var col model.InspirationCollection
		if e := tx.Where("id=? AND user_id=?", id, c.GetInt("id")).First(&col).Error; e != nil {
			return e
		}
		if e := tx.Where("user_id=? AND collection_id=?", c.GetInt("id"), id).Delete(&model.InspirationSave{}).Error; e != nil {
			return e
		}
		return tx.Delete(&col).Error
	})
	if e != nil {
		common.ApiError(c, e)
		return
	}
	common.ApiSuccess(c, nil)
}
func PutInspirationCollectionTemplate(c *gin.Context) {
	id, e := strconv.Atoi(c.Param("id"))
	if e != nil {
		common.ApiErrorMsg(c, "invalid collection")
		return
	}
	inspirationSave(c, id, true)
}
func DeleteInspirationCollectionTemplate(c *gin.Context) {
	id, e := strconv.Atoi(c.Param("id"))
	if e != nil {
		common.ApiErrorMsg(c, "invalid collection")
		return
	}
	inspirationSave(c, id, false)
}

type inspirationVersionInput struct {
	PromptTemplate string                       `json:"prompt_template"`
	NegativePrompt string                       `json:"negative_prompt"`
	Explanation    string                       `json:"explanation"`
	Tags           []string                     `json:"tags"`
	Variables      []model.InspirationVariable  `json:"variables"`
	ModelPolicy    model.InspirationModelPolicy `json:"model_policy"`
	Parameters     map[string]any               `json:"parameters"`
	Covers         model.InspirationCovers      `json:"covers"`
	Examples       []model.InspirationExample   `json:"examples"`
}

func encodeVersion(v inspirationVersionInput) (map[string]string, error) {
	out := map[string]string{}
	for k, x := range map[string]any{"tags_json": v.Tags, "variables_json": v.Variables, "model_policy_json": v.ModelPolicy, "parameters_json": v.Parameters, "covers_json": v.Covers, "examples_json": v.Examples} {
		b, e := common.Marshal(x)
		if e != nil {
			return nil, e
		}
		out[k] = string(b)
	}
	return out, nil
}
func validateVersion(v inspirationVersionInput, modality string) error {
	if strings.TrimSpace(v.PromptTemplate) == "" || len(v.PromptTemplate) > 20000 {
		return errors.New("invalid prompt_template")
	}
	if v.Tags == nil || v.Variables == nil || v.ModelPolicy.Recommended == nil || v.ModelPolicy.Compatible == nil || v.Parameters == nil || v.Examples == nil {
		return errors.New("recipe arrays and objects cannot be null")
	}
	if v.Covers.Small == "" || v.Covers.Medium == "" || v.Covers.Large == "" {
		return errors.New("all responsive covers are required")
	}
	keys := map[string]bool{}
	for _, x := range v.Variables {
		if !regexp.MustCompile(`^[a-z][a-z0-9_]*$`).MatchString(x.Key) || keys[x.Key] || x.Label == "" {
			return errors.New("invalid variables")
		}
		if x.Type != "text" && x.Type != "textarea" && x.Type != "select" && x.Type != "number" {
			return fmt.Errorf("invalid variable type for %s", x.Key)
		}
		if x.Type == "select" && len(x.Options) == 0 {
			return fmt.Errorf("select variable %s needs options", x.Key)
		}
		if x.Min != nil && x.Max != nil && *x.Min > *x.Max {
			return fmt.Errorf("invalid bounds for %s", x.Key)
		}
		if x.MaxLength != nil && *x.MaxLength <= 0 {
			return fmt.Errorf("invalid max_length for %s", x.Key)
		}
		keys[x.Key] = true
	}
	for _, m := range inspirationPlaceholderPattern.FindAllStringSubmatch(v.PromptTemplate, -1) {
		if !keys[m[1]] {
			return fmt.Errorf("unknown placeholder %s", m[1])
		}
	}
	for k, x := range keys {
		if x && !strings.Contains(v.PromptTemplate, "{{"+k+"}}") {
			return fmt.Errorf("unused variable %s", k)
		}
	}
	if len(v.ModelPolicy.Compatible) == 0 {
		return errors.New("model_policy.compatible is required")
	}
	allowedParameters := map[string]map[string]bool{
		"chat":  {"temperature": true, "top_p": true, "max_tokens": true, "frequency_penalty": true, "presence_penalty": true, "seed": true},
		"image": {"n": true, "size": true, "quality": true},
		"video": {"size": true, "duration": true},
		"audio": {"voice": true, "speed": true, "format": true},
	}
	for key, value := range v.Parameters {
		if !allowedParameters[modality][key] {
			return fmt.Errorf("parameter %s is not valid for %s", key, modality)
		}
		if _, ok := value.(string); !ok {
			if _, ok = value.(float64); !ok {
				return fmt.Errorf("parameter %s must be a string or number", key)
			}
		}
	}
	rendered := v.PromptTemplate
	for _, x := range v.Variables {
		if x.Required && (x.DefaultValue == nil || fmt.Sprint(x.DefaultValue) == "") {
			return fmt.Errorf("required variable %s needs default_value", x.Key)
		}
		rendered = strings.ReplaceAll(rendered, "{{"+x.Key+"}}", fmt.Sprint(x.DefaultValue))
	}
	if inspirationPlaceholderPattern.MatchString(rendered) || strings.TrimSpace(rendered) == "" {
		return errors.New("default prompt is incomplete")
	}
	return nil
}

func AdminListInspirationTemplates(c *gin.Context) {
	p := common.GetPageQuery(c)
	v, n, e := model.ListAdminInspirationTemplates(c.Query("category"), c.Query("modality"), p.GetStartIdx(), p.GetPageSize())
	if e != nil {
		common.ApiError(c, e)
		return
	}
	p.SetItems(v)
	p.SetTotal(int(n))
	common.ApiSuccess(c, p)
}
func AdminListInspirationCategories(c *gin.Context) {
	v, e := model.ListAllInspirationCategories()
	if e != nil {
		common.ApiError(c, e)
		return
	}
	common.ApiSuccess(c, v)
}
func AdminGetInspirationTemplate(c *gin.Context) {
	id, e := strconv.Atoi(c.Param("id"))
	if e != nil {
		common.ApiErrorMsg(c, "invalid id")
		return
	}
	var t model.InspirationTemplate
	var versions []model.InspirationTemplateVersion
	if e = model.DB.First(&t, id).Error; e != nil {
		common.ApiError(c, e)
		return
	}
	if e = model.DB.Where("template_id=?", id).Order("version DESC").Find(&versions).Error; e != nil {
		common.ApiError(c, e)
		return
	}
	common.ApiSuccess(c, gin.H{"template": t, "versions": versions})
}
func AdminCreateInspirationCategory(c *gin.Context) {
	var v model.InspirationCategory
	if e := c.ShouldBindJSON(&v); e != nil || !inspirationSlugPattern.MatchString(v.Slug) || strings.TrimSpace(v.Name) == "" {
		common.ApiErrorMsg(c, "invalid category")
		return
	}
	v.Id = 0
	v.Status = "active"
	v.CreatedAt = time.Now().Unix()
	if e := model.DB.Create(&v).Error; e != nil {
		common.ApiError(c, e)
		return
	}
	common.ApiSuccess(c, v)
}
func AdminUpdateInspirationCategory(c *gin.Context) {
	id, e := strconv.Atoi(c.Param("id"))
	var v model.InspirationCategory
	if e != nil || c.ShouldBindJSON(&v) != nil {
		common.ApiErrorMsg(c, "invalid category")
		return
	}
	updates := map[string]any{"name": strings.TrimSpace(v.Name), "description": v.Description, "sort_order": v.SortOrder}
	if v.Status == "archived" || v.Status == "active" {
		updates["status"] = v.Status
	}
	r := model.DB.Model(&model.InspirationCategory{}).Where("id=?", id).Updates(updates)
	if r.Error != nil {
		common.ApiError(c, r.Error)
		return
	}
	common.ApiSuccess(c, nil)
}
func AdminArchiveInspirationCategory(c *gin.Context) {
	c.Set("category_status", "archived")
	id, _ := strconv.Atoi(c.Param("id"))
	r := model.DB.Model(&model.InspirationCategory{}).Where("id=?", id).Update("status", "archived")
	if r.Error != nil {
		common.ApiError(c, r.Error)
		return
	}
	common.ApiSuccess(c, nil)
}
func AdminCreateInspirationTemplate(c *gin.Context) {
	var b struct {
		CategoryId  int    `json:"category_id"`
		Slug        string `json:"slug"`
		Title       string `json:"title"`
		Description string `json:"description"`
		Modality    string `json:"modality"`
		Featured    bool   `json:"featured"`
	}
	if e := c.ShouldBindJSON(&b); e != nil || !inspirationSlugPattern.MatchString(b.Slug) || b.CategoryId <= 0 || b.Title == "" || !inspirationModalities[b.Modality] {
		common.ApiErrorMsg(c, "invalid template")
		return
	}
	var categoryCount int64
	if e := model.DB.Model(&model.InspirationCategory{}).Where("id=? AND status<>?", b.CategoryId, "archived").Count(&categoryCount).Error; e != nil || categoryCount != 1 {
		common.ApiErrorMsg(c, "category not found")
		return
	}
	t := model.InspirationTemplate{CategoryId: b.CategoryId, Slug: b.Slug, Title: b.Title, Description: b.Description, Modality: b.Modality, Prompt: " ", Status: "draft", Source: "operator", Featured: b.Featured, CreatedAt: time.Now().Unix()}
	if e := model.DB.Create(&t).Error; e != nil {
		common.ApiError(c, e)
		return
	}
	common.ApiSuccess(c, t)
}
func AdminUpdateInspirationTemplate(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	var body struct {
		CategoryId  int    `json:"category_id"`
		Title       string `json:"title"`
		Description string `json:"description"`
		Modality    string `json:"modality"`
		Featured    bool   `json:"featured"`
		SortOrder   int    `json:"sort_order"`
	}
	if err != nil || c.ShouldBindJSON(&body) != nil || body.CategoryId <= 0 || strings.TrimSpace(body.Title) == "" || !inspirationModalities[body.Modality] {
		common.ApiErrorMsg(c, "invalid template")
		return
	}
	var categoryCount int64
	if e := model.DB.Model(&model.InspirationCategory{}).Where("id=? AND status<>?", body.CategoryId, "archived").Count(&categoryCount).Error; e != nil || categoryCount != 1 {
		common.ApiErrorMsg(c, "category not found")
		return
	}
	result := model.DB.Model(&model.InspirationTemplate{}).Where("id = ?", id).Updates(map[string]any{"category_id": body.CategoryId, "title": strings.TrimSpace(body.Title), "description": body.Description, "modality": body.Modality, "featured": body.Featured, "sort_order": body.SortOrder, "updated_at": time.Now().Unix()})
	if result.Error != nil {
		common.ApiError(c, result.Error)
		return
	}
	if result.RowsAffected == 0 {
		common.ApiError(c, gorm.ErrRecordNotFound)
		return
	}
	common.ApiSuccess(c, nil)
}
func AdminCreateInspirationDraft(c *gin.Context) {
	id, e := strconv.Atoi(c.Param("id"))
	if e != nil {
		common.ApiErrorMsg(c, "invalid id")
		return
	}
	var b inspirationVersionInput
	if e = c.ShouldBindJSON(&b); e != nil {
		common.ApiError(c, e)
		return
	}
	data, e := encodeVersion(b)
	if e != nil {
		common.ApiError(c, e)
		return
	}
	e = model.DB.Transaction(func(tx *gorm.DB) error {
		var t model.InspirationTemplate
		if e := model.GetInspirationTemplateForUpdate(tx, id, &t); e != nil {
			return e
		}
		if t.DraftVersionId != nil {
			return errors.New("template already has a draft")
		}
		var max int
		tx.Model(&model.InspirationTemplateVersion{}).Where("template_id=?", id).Select("COALESCE(MAX(version),0)").Scan(&max)
		v := model.InspirationTemplateVersion{TemplateId: id, Version: max + 1, State: "draft", PromptTemplate: b.PromptTemplate, NegativePrompt: b.NegativePrompt, Explanation: b.Explanation, TagsJSON: data["tags_json"], VariablesJSON: data["variables_json"], ModelPolicyJSON: data["model_policy_json"], ParametersJSON: data["parameters_json"], CoversJSON: data["covers_json"], ExamplesJSON: data["examples_json"], CreatedAt: time.Now().Unix()}
		if e := tx.Create(&v).Error; e != nil {
			return e
		}
		updates := map[string]any{"draft_version_id": v.Id}
		if t.PublishedVersionId == nil && t.Status != "archived" {
			updates["status"] = "draft"
		}
		return tx.Model(&t).Updates(updates).Error
	})
	if e != nil {
		common.ApiError(c, e)
		return
	}
	common.ApiSuccess(c, nil)
}
func AdminUpdateInspirationDraft(c *gin.Context) {
	vid, e := strconv.Atoi(c.Param("versionId"))
	var b inspirationVersionInput
	if e != nil || c.ShouldBindJSON(&b) != nil {
		common.ApiErrorMsg(c, "invalid draft")
		return
	}
	data, e := encodeVersion(b)
	if e != nil {
		common.ApiError(c, e)
		return
	}
	updates := map[string]any{"prompt_template": b.PromptTemplate, "negative_prompt": b.NegativePrompt, "explanation": b.Explanation}
	for k, v := range data {
		updates[k] = v
	}
	r := model.DB.Model(&model.InspirationTemplateVersion{}).Where("id=? AND template_id=? AND state=?", vid, c.Param("id"), "draft").Updates(updates)
	if r.Error != nil {
		common.ApiError(c, r.Error)
		return
	}
	if r.RowsAffected == 0 {
		common.ApiErrorMsg(c, "released versions are immutable")
		return
	}
	common.ApiSuccess(c, nil)
}
func AdminPublishInspirationDraft(c *gin.Context) {
	id, e := strconv.Atoi(c.Param("id"))
	if e != nil {
		common.ApiErrorMsg(c, "invalid id")
		return
	}
	e = model.DB.Transaction(func(tx *gorm.DB) error {
		var t model.InspirationTemplate
		if e := model.GetInspirationTemplateForUpdate(tx, id, &t); e != nil {
			return e
		}
		if t.DraftVersionId == nil {
			return errors.New("draft not found")
		}
		var v model.InspirationTemplateVersion
		if e := model.GetInspirationVersionForUpdate(tx, *t.DraftVersionId, &v); e != nil {
			return e
		}
		if v.TemplateId != t.Id || v.State != "draft" {
			return errors.New("draft version mismatch")
		}
		var in inspirationVersionInput
		in.PromptTemplate = v.PromptTemplate
		in.NegativePrompt = v.NegativePrompt
		in.Explanation = v.Explanation
		// Keyed by destination, never by the JSON text: a draft whose tags and
		// examples serialise identically would collapse into one map entry and
		// get published after validating a field that was never decoded.
		for _, field := range []struct {
			src string
			dst any
		}{
			{v.TagsJSON, &in.Tags},
			{v.VariablesJSON, &in.Variables},
			{v.ModelPolicyJSON, &in.ModelPolicy},
			{v.ParametersJSON, &in.Parameters},
			{v.CoversJSON, &in.Covers},
			{v.ExamplesJSON, &in.Examples},
		} {
			if e := common.UnmarshalJsonStr(field.src, field.dst); e != nil {
				return e
			}
		}
		if e := validateVersion(in, t.Modality); e != nil {
			return e
		}
		now := time.Now().Unix()
		if e := tx.Model(&v).Updates(map[string]any{"state": "released", "released_at": now}).Error; e != nil {
			return e
		}
		updates := map[string]any{"published_version_id": v.Id, "draft_version_id": nil, "prompt": v.PromptTemplate, "updated_at": now}
		if t.Status != "archived" {
			updates["status"] = "published"
		}
		return tx.Model(&t).Updates(updates).Error
	})
	if e != nil {
		common.ApiError(c, e)
		return
	}
	common.ApiSuccess(c, nil)
}
func AdminActivateInspirationVersion(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	vid, _ := strconv.Atoi(c.Param("versionId"))
	e := model.DB.Transaction(func(tx *gorm.DB) error {
		var template model.InspirationTemplate
		if e := model.GetInspirationTemplateForUpdate(tx, id, &template); e != nil {
			return e
		}
		var version model.InspirationTemplateVersion
		if e := model.GetInspirationVersionForUpdate(tx, vid, &version); e != nil || version.TemplateId != id || version.State != "released" {
			return errors.New("released version not found")
		}
		updates := map[string]any{"published_version_id": vid, "prompt": version.PromptTemplate, "updated_at": time.Now().Unix()}
		if template.Status != "archived" {
			updates["status"] = "published"
		}
		return tx.Model(&template).Updates(updates).Error
	})
	if e != nil {
		common.ApiError(c, e)
		return
	}
	common.ApiSuccess(c, nil)
}
func AdminSetInspirationTemplateArchived(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	status := "archived"
	if c.Query("restore") == "true" {
		var template model.InspirationTemplate
		if e := model.DB.Select("published_version_id").First(&template, id).Error; e != nil {
			common.ApiError(c, e)
			return
		}
		status = "draft"
		if template.PublishedVersionId != nil {
			status = "published"
		}
	}
	r := model.DB.Model(&model.InspirationTemplate{}).Where("id=?", id).Update("status", status)
	if r.Error != nil {
		common.ApiError(c, r.Error)
		return
	}
	common.ApiSuccess(c, nil)
}
