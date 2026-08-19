package controller

import (
	"errors"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

const promptLibraryImportMaxItems = 100

type promptLibraryImportRequest struct {
	Items []promptLibraryImportItem `json:"items"`
}

type promptLibraryImportItem struct {
	Artifact map[string]any    `json:"artifact"`
	Category string            `json:"category"`
	Model    string            `json:"model"`
	Output   map[string]any    `json:"output"`
	Prompt   string            `json:"prompt"`
	Slug     string            `json:"slug"`
	Source   promptSourceInput `json:"source"`
	Summary  map[string]string `json:"summary"`
	Tags     []string          `json:"tags"`
	Title    map[string]string `json:"title"`
}

type promptSourceInput struct {
	Label      string `json:"label"`
	Platform   string `json:"platform"`
	URL        string `json:"url"`
	CapturedAt string `json:"captured_at"`
}

type promptLibraryImportResult struct {
	Slug   string `json:"slug"`
	Status string `json:"status"`
	Reason string `json:"reason,omitempty"`
}

type promptLibraryPublicItem struct {
	Artifact       any      `json:"artifact"`
	Category       string   `json:"category"`
	Model          string   `json:"model"`
	Output         any      `json:"output"`
	Prompt         string   `json:"prompt"`
	Slug           string   `json:"slug"`
	Source         any      `json:"source"`
	SourcePlatform string   `json:"source_platform"`
	SourceURL      string   `json:"source_url"`
	Summary        any      `json:"summary"`
	Tags           []string `json:"tags"`
	Title          any      `json:"title"`
	// staging contract keeps key "updatedAt" (lone camelCase) carrying the source capture date; may be empty
	UpdatedAt string `json:"updatedAt"`
}

func ImportPromptLibrary(c *gin.Context) {
	var request promptLibraryImportRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid JSON body"})
		return
	}
	if len(request.Items) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "items is required"})
		return
	}
	if len(request.Items) > promptLibraryImportMaxItems {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "too many items"})
		return
	}

	items := make([]model.PromptLibraryItem, 0, len(request.Items))
	results := make([]promptLibraryImportResult, 0, len(request.Items))
	for _, input := range request.Items {
		item, err := normalizePromptLibraryImportItem(input)
		if err != nil {
			results = append(results, promptLibraryImportResult{Slug: strings.TrimSpace(input.Slug), Status: "rejected", Reason: err.Error()})
			continue
		}
		allowed, err := model.IsPromptLibraryModelAllowed(item.Model)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		if !allowed {
			results = append(results, promptLibraryImportResult{Slug: item.Slug, Status: "rejected", Reason: "model is not available in Flatkey"})
			continue
		}
		items = append(items, item)
		results = append(results, promptLibraryImportResult{Slug: item.Slug, Status: "imported"})
	}

	if err := model.UpsertPromptLibraryItems(items); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"imported": len(items),
		"rejected": len(request.Items) - len(items),
		"items":    results,
	})
}

func normalizePromptLibraryImportItem(input promptLibraryImportItem) (model.PromptLibraryItem, error) {
	slug := strings.TrimSpace(input.Slug)
	category := strings.TrimSpace(input.Category)
	modelName := strings.TrimSpace(input.Model)
	prompt := strings.TrimSpace(input.Prompt)
	if slug == "" {
		return model.PromptLibraryItem{}, errors.New("slug is required")
	}
	if !model.IsPromptLibraryCategoryAllowed(category) {
		return model.PromptLibraryItem{}, errors.New("category is invalid")
	}
	if modelName == "" {
		return model.PromptLibraryItem{}, errors.New("model is required")
	}
	if prompt == "" {
		return model.PromptLibraryItem{}, errors.New("prompt is required")
	}
	if err := validatePromptArtifact(input.Artifact); err != nil {
		return model.PromptLibraryItem{}, err
	}
	sourcePlatform := strings.TrimSpace(input.Source.Platform)
	sourceURL := strings.TrimSpace(input.Source.URL)
	if sourcePlatform == "" {
		return model.PromptLibraryItem{}, errors.New("source.platform is required")
	}
	if sourceURL == "" {
		return model.PromptLibraryItem{}, errors.New("source.url is required")
	}
	titleJSON, err := marshalPromptLibraryField(input.Title)
	if err != nil {
		return model.PromptLibraryItem{}, err
	}
	artifactJSON, err := marshalPromptLibraryField(input.Artifact)
	if err != nil {
		return model.PromptLibraryItem{}, err
	}
	sourceJSON, err := marshalPromptLibraryField(input.Source)
	if err != nil {
		return model.PromptLibraryItem{}, err
	}
	summaryJSON, err := marshalPromptLibraryField(input.Summary)
	if err != nil {
		return model.PromptLibraryItem{}, err
	}
	tagsJSON, err := marshalPromptLibraryField(input.Tags)
	if err != nil {
		return model.PromptLibraryItem{}, err
	}
	outputJSON, err := marshalPromptLibraryField(input.Output)
	if err != nil {
		return model.PromptLibraryItem{}, err
	}

	return model.PromptLibraryItem{
		Slug:           slug,
		Category:       category,
		Model:          modelName,
		Prompt:         prompt,
		TitleJSON:      titleJSON,
		SummaryJSON:    summaryJSON,
		TagsJSON:       tagsJSON,
		OutputJSON:     outputJSON,
		ArtifactJSON:   artifactJSON,
		SourceJSON:     sourceJSON,
		SourcePlatform: sourcePlatform,
		SourceURL:      sourceURL,
		CapturedAt:     strings.TrimSpace(input.Source.CapturedAt),
	}, nil
}

func validatePromptArtifact(artifact map[string]any) error {
	kindValue, ok := artifact["kind"].(string)
	if !ok || strings.TrimSpace(kindValue) == "" {
		return errors.New("artifact.kind is required")
	}
	switch strings.TrimSpace(kindValue) {
	case "image":
		if strings.TrimSpace(stringField(artifact, "url")) == "" {
			return errors.New("artifact.url is required")
		}
	case "video":
		if strings.TrimSpace(stringField(artifact, "url")) == "" {
			return errors.New("artifact.url is required")
		}
	case "text":
		if strings.TrimSpace(stringField(artifact, "body")) == "" {
			return errors.New("artifact.body is required")
		}
	case "code":
		if strings.TrimSpace(stringField(artifact, "code")) == "" {
			return errors.New("artifact.code is required")
		}
	case "storyboard":
		frames, ok := artifact["frames"].([]any)
		if !ok || len(frames) == 0 {
			return errors.New("artifact.frames is required")
		}
	default:
		return errors.New("artifact.kind is invalid")
	}
	return nil
}

func stringField(values map[string]any, key string) string {
	value, _ := values[key].(string)
	return value
}

func marshalPromptLibraryField(value any) (string, error) {
	data, err := common.Marshal(value)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func ListPromptLibrary(c *gin.Context) {
	category := strings.TrimSpace(c.Query("category"))
	if category != "" && !model.IsPromptLibraryCategoryAllowed(category) {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "category is invalid"})
		return
	}
	keyword := strings.TrimSpace(c.Query("keyword"))
	pageInfo := common.GetPageQuery(c)
	items, total, err := model.ListPromptLibraryItems(category, keyword, true, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	responseItems := make([]promptLibraryPublicItem, 0, len(items))
	for _, item := range items {
		responseItems = append(responseItems, normalizePromptLibraryPublicItem(item))
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(responseItems)
	common.ApiSuccess(c, pageInfo)
}

func GetPromptLibraryItem(c *gin.Context) {
	item, err := model.GetPromptLibraryItemBySlug(c.Param("slug"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if item == nil || !item.Enabled {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "prompt library item not found"})
		return
	}
	common.ApiSuccess(c, gin.H{"item": normalizePromptLibraryPublicItem(*item)})
}

func normalizePromptLibraryPublicItem(item model.PromptLibraryItem) promptLibraryPublicItem {
	title := unmarshalPromptLibraryField(item.TitleJSON, map[string]string{})
	summary := unmarshalPromptLibraryField(item.SummaryJSON, map[string]string{})
	artifact := unmarshalPromptLibraryField(item.ArtifactJSON, map[string]any{})
	source := unmarshalPromptLibraryField(item.SourceJSON, map[string]any{})
	output := unmarshalPromptLibraryField(item.OutputJSON, map[string]any{})
	tags := make([]string, 0)
	if trimmedTags := strings.TrimSpace(item.TagsJSON); trimmedTags != "" && trimmedTags != "null" {
		if err := common.UnmarshalJsonStr(item.TagsJSON, &tags); err != nil {
			// one corrupt row must not take the whole listing down; keep the empty slice
			common.SysError("prompt library field JSON parse failed: " + err.Error())
			tags = make([]string, 0)
		}
	}
	return promptLibraryPublicItem{
		Artifact:       artifact,
		Category:       item.Category,
		Model:          item.Model,
		Output:         output,
		Prompt:         item.Prompt,
		Slug:           item.Slug,
		Source:         source,
		SourcePlatform: item.SourcePlatform,
		SourceURL:      item.SourceURL,
		Summary:        summary,
		Tags:           tags,
		Title:          title,
		UpdatedAt:      item.CapturedAt,
	}
}

func unmarshalPromptLibraryField(value string, fallback any) any {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	var decoded any
	if err := common.UnmarshalJsonStr(value, &decoded); err != nil {
		// corrupt stored JSON degrades to the fallback instead of failing the request
		common.SysError("prompt library field JSON parse failed: " + err.Error())
		return fallback
	}
	if decoded == nil {
		// import path stores literal "null" for absent optional fields
		return fallback
	}
	return decoded
}
