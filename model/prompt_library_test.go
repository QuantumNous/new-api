package model

import (
	"strings"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupPromptLibraryModelTest(t *testing.T) {
	t.Helper()
	originalDB := DB
	dbName := strings.NewReplacer("/", "_", " ", "_").Replace(t.Name())
	db, err := gorm.Open(sqlite.Open("file:"+dbName+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, db.AutoMigrate(&PromptLibraryItem{}))
	DB = db
	t.Cleanup(func() {
		DB = originalDB
		require.NoError(t, sqlDB.Close())
	})
}

func seedPromptLibraryItem(t *testing.T, slug, category, prompt string, enabled bool) {
	t.Helper()
	item := &PromptLibraryItem{
		Slug:           slug,
		Category:       category,
		Model:          "gpt-image-2",
		Prompt:         prompt,
		TitleJSON:      `{"en":"` + slug + `"}`,
		ArtifactJSON:   `{"kind":"image","url":"https://example.com/` + slug + `.png"}`,
		SourceJSON:     `{"label":"@a","platform":"X","url":"https://x.com/a/status/1"}`,
		SourcePlatform: "X",
		SourceURL:      "https://x.com/a/status/1",
		Enabled:        enabled,
	}
	require.NoError(t, DB.Create(item).Error)
	if !enabled {
		// gorm 的 default:true 会在 Create 时把零值 false 替换为默认值，
		// 禁用态需走显式 Update 落盘（与后台下架同路径）。
		require.NoError(t, DB.Model(item).Update("enabled", false).Error)
	}
}

func TestListPromptLibraryItemsFiltersAndPaginates(t *testing.T) {
	setupPromptLibraryModelTest(t)
	seedPromptLibraryItem(t, "a-cat", "image", "a cat on the moon", true)
	seedPromptLibraryItem(t, "b-dog", "image", "a dog in space", true)
	seedPromptLibraryItem(t, "c-off", "image", "disabled item", false)
	seedPromptLibraryItem(t, "d-vid", "video", "a video prompt", true)

	// enabledOnly filters out disabled
	items, total, err := ListPromptLibraryItems("image", "", true, 0, 10)
	require.NoError(t, err)
	require.EqualValues(t, 2, total)
	require.Len(t, items, 2)

	// enabledOnly=false includes disabled
	_, total, err = ListPromptLibraryItems("image", "", false, 0, 10)
	require.NoError(t, err)
	require.EqualValues(t, 3, total)

	// keyword matches prompt
	items, total, err = ListPromptLibraryItems("", "moon", true, 0, 10)
	require.NoError(t, err)
	require.EqualValues(t, 1, total)
	require.Equal(t, "a-cat", items[0].Slug)

	// pagination: second page at page_size=1
	items, total, err = ListPromptLibraryItems("image", "", true, 1, 1)
	require.NoError(t, err)
	require.EqualValues(t, 2, total)
	require.Len(t, items, 1)
	// 相同 updated_time 下按 id DESC，第二页（size=1）应为先插入的 a-cat
	require.Equal(t, "a-cat", items[0].Slug)
}

func TestUpsertDoesNotReviveDisabledItem(t *testing.T) {
	setupPromptLibraryModelTest(t)
	seedPromptLibraryItem(t, "keep-off", "image", "old prompt", false)

	err := UpsertPromptLibraryItems([]PromptLibraryItem{{
		Slug:           "keep-off",
		Category:       "image",
		Model:          "gpt-image-2",
		Prompt:         "new prompt",
		TitleJSON:      `{"en":"keep-off"}`,
		ArtifactJSON:   `{"kind":"image","url":"https://example.com/new.png"}`,
		SourceJSON:     `{"label":"@a","platform":"X","url":"https://x.com/a/status/2"}`,
		SourcePlatform: "X",
		SourceURL:      "https://x.com/a/status/2",
	}})
	require.NoError(t, err)

	var item PromptLibraryItem
	require.NoError(t, DB.First(&item, "slug = ?", "keep-off").Error)
	require.Equal(t, "new prompt", item.Prompt) // content updated
	require.False(t, item.Enabled)              // enabled not revived
}

func TestPromptLibraryItemCRUDById(t *testing.T) {
	setupPromptLibraryModelTest(t)
	item := &PromptLibraryItem{
		Slug: "crud-item", Category: "image", Model: "gpt-image-2", Prompt: "p",
		TitleJSON: `{"en":"t"}`, ArtifactJSON: `{"kind":"image","url":"https://e.com/i.png"}`,
		SourceJSON: `{"url":"https://x.com/s/1"}`, SourcePlatform: "X", SourceURL: "https://x.com/s/1",
		Enabled: true,
	}
	require.NoError(t, CreatePromptLibraryItem(item))
	require.NotZero(t, item.Id)

	got, err := GetPromptLibraryItemById(item.Id)
	require.NoError(t, err)
	require.NotNil(t, got)
	require.Equal(t, "crud-item", got.Slug)

	got.Prompt = "p2"
	require.NoError(t, got.Update())
	again, err := GetPromptLibraryItemById(item.Id)
	require.NoError(t, err)
	require.Equal(t, "p2", again.Prompt)

	require.NoError(t, DeletePromptLibraryItemById(item.Id))
	gone, err := GetPromptLibraryItemById(item.Id)
	require.NoError(t, err)
	require.Nil(t, gone)
}

func TestUpdatePersistsEnabledFalse(t *testing.T) {
	setupPromptLibraryModelTest(t)
	item := &PromptLibraryItem{
		Slug: "toggle-off", Category: "image", Model: "gpt-image-2", Prompt: "p",
		TitleJSON: `{"en":"t"}`, ArtifactJSON: `{"kind":"image","url":"https://e.com/i.png"}`,
		SourceJSON: `{"url":"https://x.com/s/1"}`, SourcePlatform: "X", SourceURL: "https://x.com/s/1",
		Enabled: true,
	}
	require.NoError(t, CreatePromptLibraryItem(item))

	// Update 走 Select("*")：零值 enabled=false 不能被 GORM 跳过
	item.Enabled = false
	require.NoError(t, item.Update())
	got, err := GetPromptLibraryItemById(item.Id)
	require.NoError(t, err)
	require.NotNil(t, got)
	require.False(t, got.Enabled)

	// create-as-disabled：Enabled=false 创建也必须落库 false（default:true 不得覆盖）
	disabled := &PromptLibraryItem{
		Slug: "born-off", Category: "image", Model: "gpt-image-2", Prompt: "p",
		TitleJSON: `{"en":"t"}`, ArtifactJSON: `{"kind":"image","url":"https://e.com/i.png"}`,
		SourceJSON: `{"url":"https://x.com/s/2"}`, SourcePlatform: "X", SourceURL: "https://x.com/s/2",
	}
	require.NoError(t, CreatePromptLibraryItem(disabled))
	fetched, err := GetPromptLibraryItemById(disabled.Id)
	require.NoError(t, err)
	require.NotNil(t, fetched)
	require.False(t, fetched.Enabled)
	require.False(t, disabled.Enabled) // 内存与 DB 一致
}
