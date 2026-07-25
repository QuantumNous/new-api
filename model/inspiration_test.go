package model

import (
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupInspirationTestDB(t *testing.T) {
	t.Helper()
	old := DB
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&InspirationCategory{}, &InspirationTemplate{}, &InspirationTemplateVersion{}, &InspirationCollection{}, &InspirationSave{}, &InspirationEvent{}))
	DB = db
	t.Cleanup(func() { DB = old })
}

func TestSyncInspirationCatalogIsIdempotent(t *testing.T) {
	setupInspirationTestDB(t)
	require.NoError(t, SyncInspirationCatalog())
	require.NoError(t, SyncInspirationCatalog())
	var templates, versions, categories int64
	require.NoError(t, DB.Model(&InspirationTemplate{}).Count(&templates).Error)
	require.NoError(t, DB.Model(&InspirationTemplateVersion{}).Count(&versions).Error)
	require.NoError(t, DB.Model(&InspirationCategory{}).Count(&categories).Error)
	assert.EqualValues(t, 24, templates)
	assert.EqualValues(t, 24, versions)
	assert.EqualValues(t, 8, categories)
	recipe, err := GetInspirationRecipe("studio-product")
	require.NoError(t, err)
	assert.Len(t, recipe.Variables, 3)
	assert.Equal(t, "/inspiration-covers/studio-product-480.webp", recipe.Covers.Small)
	items, total, err := ListInspirationRecipes("product", "image", 0, 10, false)
	require.NoError(t, err)
	assert.EqualValues(t, 3, total)
	require.Len(t, items, 3)
	assert.NotZero(t, items[0].VersionId)
	adminItems, adminTotal, err := ListAdminInspirationTemplates("product", "image", 0, 10)
	require.NoError(t, err)
	assert.EqualValues(t, 3, adminTotal)
	require.Len(t, adminItems, 3)
	assert.Equal(t, "product", adminItems[0].CategorySlug)
	assert.NotZero(t, adminItems[0].CategoryId)
	assert.NotNil(t, adminItems[0].PublishedVersionId)
}

func TestSyncInspirationCatalogUpgradesLegacySeed(t *testing.T) {
	setupInspirationTestDB(t)
	now := int64(1)
	categoryIDs := map[string]int{}
	for _, slug := range []string{"product", "portrait", "landscape", "creative", "video", "writing"} {
		category := InspirationCategory{Slug: slug, Name: slug, CreatedAt: now}
		require.NoError(t, DB.Create(&category).Error)
		categoryIDs[slug] = category.Id
	}
	legacy := []InspirationTemplate{
		{CategoryId: categoryIDs["product"], Slug: "studio-product", Title: "old", Prompt: "old", Modality: "image", CreatedAt: now},
		{CategoryId: categoryIDs["portrait"], Slug: "cinematic-portrait", Title: "old", Prompt: "old", Modality: "image", CreatedAt: now},
		{CategoryId: categoryIDs["landscape"], Slug: "golden-hour", Title: "old", Prompt: "old", Modality: "image", CreatedAt: now},
		{CategoryId: categoryIDs["creative"], Slug: "surreal-scene", Title: "old", Prompt: "old", Modality: "image", CreatedAt: now},
		{CategoryId: categoryIDs["video"], Slug: "product-orbit", Title: "old", Prompt: "old", Modality: "video", CreatedAt: now},
		{CategoryId: categoryIDs["writing"], Slug: "product-copy", Title: "old", Prompt: "old", Modality: "chat", CreatedAt: now},
	}
	require.NoError(t, DB.Create(&legacy).Error)
	require.NoError(t, SyncInspirationCatalog())
	require.NoError(t, SyncInspirationCatalog())

	items, total, err := ListInspirationRecipes("", "", 0, 50, false)
	require.NoError(t, err)
	assert.EqualValues(t, 24, total)
	require.Len(t, items, 24)
	for _, item := range items {
		// Empty means "any model of this modality"; the browser matches these
		// against model names and iterates them without a null guard, so they must
		// serialise as [] rather than null.
		assert.NotNil(t, item.ModelPolicy.Compatible)
		assert.NotNil(t, item.ModelPolicy.Recommended)
		assert.Empty(t, item.ModelPolicy.Compatible, "a modality is not a model name and would never resolve")
		assert.NotEmpty(t, item.Covers.Small)
	}
	categories, err := ListInspirationCategories()
	require.NoError(t, err)
	assert.Len(t, categories, 8)
	_, err = GetInspirationRecipe("golden-hour")
	require.ErrorIs(t, err, gorm.ErrRecordNotFound)
}

func TestDuplicateApplyEventDoesNotDoubleCount(t *testing.T) {
	setupInspirationTestDB(t)
	require.NoError(t, SyncInspirationCatalog())
	var template InspirationTemplate
	require.NoError(t, DB.Where("slug = ?", "studio-product").First(&template).Error)
	event := InspirationEvent{EventId: uuid.NewString(), TemplateId: template.Id, VersionId: *template.PublishedVersionId, Type: "apply"}
	inserted, err := RecordInspirationEvents([]InspirationEvent{event, event})
	require.NoError(t, err)
	assert.Equal(t, 1, inserted)
	require.NoError(t, DB.First(&template, template.Id).Error)
	assert.Equal(t, 1, template.UseCount)
}

func TestInspirationSavesAreOwnerScoped(t *testing.T) {
	setupInspirationTestDB(t)
	require.NoError(t, SyncInspirationCatalog())
	var template InspirationTemplate
	require.NoError(t, DB.Where("slug = ?", "studio-product").First(&template).Error)
	collection := InspirationCollection{UserId: 7, Name: "Campaign", CreatedAt: 1, UpdatedAt: 1}
	require.NoError(t, DB.Create(&collection).Error)
	require.ErrorIs(t, PutInspirationSave(8, collection.Id, template.Id), gorm.ErrRecordNotFound)
	require.NoError(t, PutInspirationSave(7, collection.Id, template.Id))
	require.ErrorIs(t, DeleteInspirationSave(8, collection.Id, template.Id), gorm.ErrRecordNotFound)
	require.NoError(t, DeleteInspirationSave(7, collection.Id, template.Id))
}
