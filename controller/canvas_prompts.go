package controller

import (
	_ "embed"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

// 画布提示词库(移植自 infinite-canvas 的 /api/prompts Next.js 路由)。
// 生产环境不访问 GitHub raw:数据来自 canvas_prompts 表,表为空时从内置 seed 快照导入;
// 之后仅读 DB + 进程内缓存(TTL 6h)。seed 由离线脚本 cmd/canvas-prompts-sync 生成。

//go:embed canvas_prompts_seed.json
var canvasPromptsSeed []byte

type canvasPromptDTO struct {
	Id            string   `json:"id"`
	Title         string   `json:"title"`
	CoverUrl      string   `json:"coverUrl"`
	CoverAssetUrl string   `json:"coverAssetUrl,omitempty"`
	Prompt        string   `json:"prompt"`
	Tags          []string `json:"tags"`
	Category      string   `json:"category"`
	GithubUrl     string   `json:"githubUrl"`
	Preview       string   `json:"preview"`
	CreatedAt     string   `json:"createdAt"`
	UpdatedAt     string   `json:"updatedAt"`
}

type canvasPromptSeedItem struct {
	Source        string   `json:"source"`
	SourceId      string   `json:"source_id"`
	Title         string   `json:"title"`
	Prompt        string   `json:"prompt"`
	Category      string   `json:"category"`
	Tags          []string `json:"tags"`
	GithubUrl     string   `json:"github_url"`
	CoverUrl      string   `json:"cover_url"`
	CoverAssetUrl string   `json:"cover_asset_url"`
	Preview       string   `json:"preview"`
	CreatedAt     string   `json:"created_at"`
	UpdatedAt     string   `json:"updated_at"`
}

const canvasPromptsCacheTTL = 6 * time.Hour

var (
	canvasPromptsCacheMu   sync.Mutex
	canvasPromptsCache     []canvasPromptDTO
	canvasPromptsCacheTime time.Time
	canvasPromptsSeeded    bool
)

// GetCanvasPrompts GET /api/prompts —— 响应结构与上游 route.ts 完全一致:
// { items, tags, categories, total }
func GetCanvasPrompts(c *gin.Context) {
	keyword := strings.ToLower(strings.TrimSpace(c.Query("keyword")))
	tags := make([]string, 0)
	for _, tag := range c.QueryArray("tag") {
		if tag != "" {
			tags = append(tags, tag)
		}
	}
	category := c.Query("category")
	page := parsePositiveInt(c.Query("page"), 1, 1<<30)
	pageSize := parsePositiveInt(c.Query("pageSize"), 20, 100)

	items, err := loadCanvasPrompts()
	if err != nil {
		common.SysLog("加载画布提示词失败: " + err.Error())
		items = []canvasPromptDTO{}
	}

	withoutTagFilter := filterCanvasPrompts(items, keyword, category, nil)
	filtered := filterCanvasPrompts(items, keyword, category, tags)

	start := (page - 1) * pageSize
	end := start + pageSize
	if start > len(filtered) {
		start = len(filtered)
	}
	if end > len(filtered) {
		end = len(filtered)
	}

	c.JSON(http.StatusOK, gin.H{
		"items":      filtered[start:end],
		"tags":       collectCanvasPromptTags(withoutTagFilter),
		"categories": collectCanvasPromptCategories(items),
		"total":      len(filtered),
	})
}

func parsePositiveInt(value string, fallback int, max int) int {
	parsed, err := strconv.Atoi(value)
	if err != nil || parsed < 1 {
		return fallback
	}
	if parsed > max {
		return max
	}
	return parsed
}

func loadCanvasPrompts() ([]canvasPromptDTO, error) {
	canvasPromptsCacheMu.Lock()
	defer canvasPromptsCacheMu.Unlock()
	if canvasPromptsCache != nil && time.Since(canvasPromptsCacheTime) < canvasPromptsCacheTTL {
		return canvasPromptsCache, nil
	}
	if !canvasPromptsSeeded {
		if err := seedCanvasPromptsIfEmpty(); err != nil {
			common.SysLog("导入画布提示词 seed 失败: " + err.Error())
		}
		canvasPromptsSeeded = true
	}
	prompts, err := model.GetEnabledCanvasPrompts()
	if err != nil {
		if canvasPromptsCache != nil {
			return canvasPromptsCache, nil
		}
		return nil, err
	}
	items := make([]canvasPromptDTO, 0, len(prompts))
	for _, prompt := range prompts {
		items = append(items, canvasPromptToDTO(prompt))
	}
	canvasPromptsCache = items
	canvasPromptsCacheTime = time.Now()
	return items, nil
}

func canvasPromptToDTO(prompt *model.CanvasPrompt) canvasPromptDTO {
	tags := make([]string, 0)
	if prompt.Tags != "" {
		if err := common.UnmarshalJsonStr(prompt.Tags, &tags); err != nil {
			tags = []string{}
		}
	}
	coverUrl := prompt.CoverAssetUrl
	if coverUrl == "" {
		coverUrl = prompt.CoverUrl
	}
	return canvasPromptDTO{
		Id:            prompt.Source + "-" + prompt.SourceId,
		Title:         prompt.Title,
		CoverUrl:      coverUrl,
		CoverAssetUrl: prompt.CoverAssetUrl,
		Prompt:        prompt.Prompt,
		Tags:          tags,
		Category:      prompt.Category,
		GithubUrl:     prompt.GithubUrl,
		Preview:       prompt.Preview,
		CreatedAt:     formatCanvasPromptTime(prompt.CreatedAt),
		UpdatedAt:     formatCanvasPromptTime(prompt.UpdatedAt),
	}
}

func formatCanvasPromptTime(timestamp int64) string {
	if timestamp <= 0 {
		return ""
	}
	return time.Unix(timestamp, 0).UTC().Format(time.RFC3339)
}

// seedCanvasPromptsIfEmpty 首次启动 canvas_prompts 为空时从内置 seed 快照导入。
func seedCanvasPromptsIfEmpty() error {
	count, err := model.CountCanvasPrompts()
	if err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	var seedItems []canvasPromptSeedItem
	if err := common.Unmarshal(canvasPromptsSeed, &seedItems); err != nil {
		return err
	}
	if len(seedItems) == 0 {
		return nil
	}
	now := time.Now().Unix()
	prompts := make([]*model.CanvasPrompt, 0, len(seedItems))
	for _, item := range seedItems {
		if item.Source == "" || item.SourceId == "" || item.Title == "" || item.Prompt == "" {
			continue
		}
		tagsJson, err := common.Marshal(item.Tags)
		if err != nil {
			tagsJson = []byte("[]")
		}
		prompts = append(prompts, &model.CanvasPrompt{
			Source:        item.Source,
			SourceId:      item.SourceId,
			Title:         item.Title,
			Prompt:        item.Prompt,
			Category:      item.Category,
			Tags:          string(tagsJson),
			GithubUrl:     item.GithubUrl,
			CoverUrl:      item.CoverUrl,
			CoverAssetUrl: item.CoverAssetUrl,
			Preview:       item.Preview,
			Enabled:       true,
			CreatedAt:     parseCanvasPromptTime(item.CreatedAt, now),
			UpdatedAt:     parseCanvasPromptTime(item.UpdatedAt, now),
		})
	}
	return model.InsertCanvasPrompts(prompts)
}

func parseCanvasPromptTime(value string, fallback int64) int64 {
	if value == "" {
		return fallback
	}
	if parsed, err := time.Parse(time.RFC3339, value); err == nil {
		return parsed.Unix()
	}
	if parsed, err := time.Parse("2006-01-02", value); err == nil {
		return parsed.Unix()
	}
	return fallback
}

func filterCanvasPrompts(items []canvasPromptDTO, keyword, category string, tags []string) []canvasPromptDTO {
	filtered := make([]canvasPromptDTO, 0, len(items))
	for _, item := range items {
		if isActiveCanvasPromptOption(category) && item.Category != category {
			continue
		}
		if len(tags) > 0 && !hasAnyCanvasPromptTag(item.Tags, tags) {
			continue
		}
		if keyword != "" {
			haystack := strings.ToLower(strings.Join(append([]string{item.Title, item.Prompt, item.Category}, item.Tags...), " "))
			if !strings.Contains(haystack, keyword) {
				continue
			}
		}
		filtered = append(filtered, item)
	}
	return filtered
}

func hasAnyCanvasPromptTag(itemTags []string, wanted []string) bool {
	for _, tag := range wanted {
		for _, itemTag := range itemTags {
			if itemTag == tag {
				return true
			}
		}
	}
	return false
}

func collectCanvasPromptTags(items []canvasPromptDTO) []string {
	seen := make(map[string]bool)
	tags := make([]string, 0)
	for _, item := range items {
		for _, tag := range item.Tags {
			if tag != "" && !seen[tag] {
				seen[tag] = true
				tags = append(tags, tag)
			}
		}
	}
	return tags
}

func collectCanvasPromptCategories(items []canvasPromptDTO) []string {
	seen := make(map[string]bool)
	categories := make([]string, 0)
	for _, item := range items {
		if item.Category != "" && !seen[item.Category] {
			seen[item.Category] = true
			categories = append(categories, item.Category)
		}
	}
	return categories
}

func isActiveCanvasPromptOption(value string) bool {
	return value != "" && value != "全部" && value != "all"
}
