package model

import (
	"errors"
	"reflect"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupModelDirectoryMetadataTestDB(t *testing.T) {
	t.Helper()
	originalDB := DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&ModelDirectoryMetadata{}))
	DB = db
	t.Cleanup(func() { DB = originalDB })
}

func mustModelDirectoryArrayJSON(t *testing.T, values []string) string {
	t.Helper()
	raw, err := common.Marshal(values)
	require.NoError(t, err)
	return string(raw)
}

func validModelDirectoryMetadata(t *testing.T, modelName string) ModelDirectoryMetadata {
	t.Helper()
	contextTokens := int64(128000)
	popularityRank := 7
	topTenRank := 3
	return ModelDirectoryMetadata{
		ModelName:      modelName,
		Author:         "OpenAI",
		ProvidersJSON:  mustModelDirectoryArrayJSON(t, []string{"Flatkey", "OpenAI"}),
		ModalitiesJSON: mustModelDirectoryArrayJSON(t, []string{"text", "image"}),
		ContextTokens:  &contextTokens,
		Series:         "GPT",
		CategoriesJSON: mustModelDirectoryArrayJSON(t, []string{"reasoning", "coding"}),
		ReleasedAt:     "2026-08-01",
		Distillable:    true,
		PopularityRank: &popularityRank,
		TopTenRank:     &topTenRank,
		Status:         1,
	}
}

func TestModelDirectoryMetadataRegisteredForMigration(t *testing.T) {
	names := map[string]bool{}
	for _, m := range orderedMigrationModels() {
		names[m.name] = true
	}
	require.True(t, names["ModelDirectoryMetadata"])
}

func TestModelDirectoryMetadataSchemaEnforcesExactUniqueModelName(t *testing.T) {
	setupModelDirectoryMetadataTestDB(t)

	first := validModelDirectoryMetadata(t, "gpt-5")
	require.NoError(t, DB.Create(&first).Error)

	duplicate := validModelDirectoryMetadata(t, "gpt-5")
	err := DB.Create(&duplicate).Error
	require.Error(t, err)

}

func TestModelDirectoryMetadataCreatePreservesExplicitDisabledStatus(t *testing.T) {
	setupModelDirectoryMetadataTestDB(t)

	metadata := validModelDirectoryMetadata(t, "disabled-model")
	metadata.Status = 0
	require.NoError(t, DB.Create(&metadata).Error)

	var stored ModelDirectoryMetadata
	require.NoError(t, DB.Where("model_name = ?", metadata.ModelName).First(&stored).Error)
	require.Equal(t, 0, stored.Status)
}

func TestModelDirectoryMetadataNormalizeAndValidate(t *testing.T) {
	contextTokens := int64(128000)
	popularityRank := 12
	topTenRank := 4
	metadata := ModelDirectoryMetadata{
		ModelName:      "  gpt-5  ",
		Author:         "  OpenAI  ",
		ProvidersJSON:  mustModelDirectoryArrayJSON(t, []string{" OpenAI ", "", "OpenAI", " Azure "}),
		ModalitiesJSON: mustModelDirectoryArrayJSON(t, []string{" text ", "image", "text", ""}),
		ContextTokens:  &contextTokens,
		Series:         " GPT ",
		CategoriesJSON: mustModelDirectoryArrayJSON(t, []string{" coding ", "reasoning", "coding", ""}),
		ReleasedAt:     "2026-08-21",
		Distillable:    true,
		PopularityRank: &popularityRank,
		TopTenRank:     &topTenRank,
	}

	require.NoError(t, metadata.NormalizeAndValidate())
	require.Equal(t, "gpt-5", metadata.ModelName)
	require.Equal(t, "OpenAI", metadata.Author)
	require.Equal(t, "GPT", metadata.Series)

	view, err := metadata.ToView()
	require.NoError(t, err)
	require.Equal(t, []string{"OpenAI", "Azure"}, view.Providers)
	require.Equal(t, []string{"text", "image"}, view.Modalities)
	require.Equal(t, []string{"coding", "reasoning"}, view.Categories)
	require.Equal(t, &contextTokens, view.ContextTokens)
	require.Equal(t, &popularityRank, view.PopularityRank)
	require.Equal(t, &topTenRank, view.TopTenRank)
}

func TestModelDirectoryMetadataValidateRejectsInvalidBoundaries(t *testing.T) {
	tests := []struct {
		name   string
		mutate func(*ModelDirectoryMetadata)
	}{
		{name: "empty model name", mutate: func(m *ModelDirectoryMetadata) { m.ModelName = "  " }},
		{name: "empty author", mutate: func(m *ModelDirectoryMetadata) { m.Author = "  " }},
		{name: "empty series", mutate: func(m *ModelDirectoryMetadata) { m.Series = "  " }},
		{name: "empty providers", mutate: func(m *ModelDirectoryMetadata) { m.ProvidersJSON = `[" "]` }},
		{name: "empty modalities", mutate: func(m *ModelDirectoryMetadata) { m.ModalitiesJSON = `[]` }},
		{name: "empty categories", mutate: func(m *ModelDirectoryMetadata) { m.CategoriesJSON = `[]` }},
		{name: "invalid modality", mutate: func(m *ModelDirectoryMetadata) { m.ModalitiesJSON = `["text","3d"]` }},
		{name: "invalid released date shape", mutate: func(m *ModelDirectoryMetadata) { m.ReleasedAt = "2026-8-21" }},
		{name: "invalid released date calendar", mutate: func(m *ModelDirectoryMetadata) { m.ReleasedAt = "2026-02-30" }},
		{name: "non-positive context tokens", mutate: func(m *ModelDirectoryMetadata) { value := int64(0); m.ContextTokens = &value }},
		{name: "non-positive popularity rank", mutate: func(m *ModelDirectoryMetadata) { value := 0; m.PopularityRank = &value }},
		{name: "top ten rank below range", mutate: func(m *ModelDirectoryMetadata) { value := 0; m.TopTenRank = &value }},
		{name: "top ten rank above range", mutate: func(m *ModelDirectoryMetadata) { value := 11; m.TopTenRank = &value }},
		{name: "invalid status", mutate: func(m *ModelDirectoryMetadata) { m.Status = 2 }},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			metadata := validModelDirectoryMetadata(t, "gpt-5")
			tc.mutate(&metadata)
			require.Error(t, metadata.NormalizeAndValidate())
		})
	}
}

func TestModelDirectoryMetadataToViewRejectsInvalidStoredJSON(t *testing.T) {
	metadata := validModelDirectoryMetadata(t, "gpt-5")
	metadata.ProvidersJSON = `not-json`

	_, err := metadata.ToView()
	require.Error(t, err)
}

func TestModelDirectoryMetadataToViewRejectsInvalidStoredFields(t *testing.T) {
	metadata := validModelDirectoryMetadata(t, "gpt-5")
	metadata.ReleasedAt = "not-a-date"

	_, err := metadata.ToView()
	require.Error(t, err)
}

func TestGetEnabledModelDirectoryMetadataMapFiltersAndNormalizesRequests(t *testing.T) {
	setupModelDirectoryMetadataTestDB(t)
	enabled := validModelDirectoryMetadata(t, "gpt-5")
	require.NoError(t, DB.Create(&enabled).Error)
	disabled := validModelDirectoryMetadata(t, "claude-4")
	require.NoError(t, DB.Create(&disabled).Error)
	require.NoError(t, DB.Model(&disabled).Update("status", 0).Error)
	unrequested := validModelDirectoryMetadata(t, "gemini-3")
	require.NoError(t, DB.Create(&unrequested).Error)

	result, err := GetEnabledModelDirectoryMetadataMap([]string{" gpt-5 ", "gpt-5", "", "claude-4"})
	require.NoError(t, err)

	require.Len(t, result, 1)
	view, ok := result["gpt-5"]
	require.True(t, ok)
	require.Equal(t, "OpenAI", view.Author)
	require.NotContains(t, result, "claude-4")
	require.NotContains(t, result, "gemini-3")
}

func TestGetEnabledModelDirectoryMetadataMapEmptyInputDoesNotQuery(t *testing.T) {
	originalDB := DB
	DB = nil
	t.Cleanup(func() { DB = originalDB })

	result, err := GetEnabledModelDirectoryMetadataMap([]string{" ", ""})
	require.NoError(t, err)
	require.Empty(t, result)
}

func TestModelDirectoryMetadataViewJSONFields(t *testing.T) {
	typ := reflect.TypeOf(ModelDirectoryMetadataView{})
	fields := map[string]string{}
	for i := 0; i < typ.NumField(); i++ {
		field := typ.Field(i)
		fields[field.Name] = field.Tag.Get("json")
	}

	require.Equal(t, "author", fields["Author"])
	require.Equal(t, "providers", fields["Providers"])
	require.Equal(t, "modalities", fields["Modalities"])
	require.Equal(t, "context_tokens", fields["ContextTokens"])
	require.Equal(t, "series", fields["Series"])
	require.Equal(t, "categories", fields["Categories"])
	require.Equal(t, "released_at", fields["ReleasedAt"])
	require.Equal(t, "distillable", fields["Distillable"])
	require.Equal(t, "popularity_rank,omitempty", fields["PopularityRank"])
	require.Equal(t, "top_ten_rank,omitempty", fields["TopTenRank"])
}

func TestGetEnabledModelDirectoryMetadataMapPropagatesMissingRecordAsEmpty(t *testing.T) {
	setupModelDirectoryMetadataTestDB(t)

	result, err := GetEnabledModelDirectoryMetadataMap([]string{"missing-model"})
	require.NoError(t, err)
	require.Empty(t, result)

	var stored ModelDirectoryMetadata
	err = DB.Where("model_name = ?", "missing-model").First(&stored).Error
	require.True(t, errors.Is(err, gorm.ErrRecordNotFound))
}

func TestModelDirectoryMetadataImportRejectsDuplicateNamesBeforeQuery(t *testing.T) {
	first := validModelDirectoryMetadata(t, " gpt-5 ")
	second := validModelDirectoryMetadata(t, "gpt-5")

	_, err := PlanModelDirectoryMetadataImport(nil, []ModelDirectoryMetadata{first, second})
	require.ErrorContains(t, err, "duplicate model name")
}

func TestModelDirectoryMetadataImportDryRunPlansWithoutWrites(t *testing.T) {
	setupModelDirectoryMetadataTestDB(t)
	existing := validModelDirectoryMetadata(t, "existing")
	require.NoError(t, DB.Create(&existing).Error)
	updated := existing
	updated.Author = "Updated Author"
	inserted := validModelDirectoryMetadata(t, "inserted")

	result, err := PlanModelDirectoryMetadataImport(DB, []ModelDirectoryMetadata{existing, updated, inserted})
	require.Error(t, err, "duplicate exact names must fail even when their values differ")

	result, err = PlanModelDirectoryMetadataImport(DB, []ModelDirectoryMetadata{updated, inserted})
	require.NoError(t, err)
	require.Equal(t, []string{"inserted"}, result.Inserts)
	require.Equal(t, []string{"existing"}, result.Updates)
	require.Empty(t, result.Unchanged)

	var count int64
	require.NoError(t, DB.Model(&ModelDirectoryMetadata{}).Count(&count).Error)
	require.EqualValues(t, 1, count)
}

func TestModelDirectoryMetadataImportApplyIsTransactionalAndIdempotent(t *testing.T) {
	setupModelDirectoryMetadataTestDB(t)
	rows := []ModelDirectoryMetadata{
		validModelDirectoryMetadata(t, "gpt-5"),
		validModelDirectoryMetadata(t, "claude-5"),
	}

	first, err := ApplyModelDirectoryMetadataImport(DB, rows)
	require.NoError(t, err)
	require.Equal(t, []string{"claude-5", "gpt-5"}, first.Inserts)
	require.Empty(t, first.Updates)

	second, err := ApplyModelDirectoryMetadataImport(DB, rows)
	require.NoError(t, err)
	require.Empty(t, second.Inserts)
	require.Empty(t, second.Updates)
	require.Equal(t, []string{"claude-5", "gpt-5"}, second.Unchanged)
}

func TestModelDirectoryMetadataImportNotifiesAfterChangedRowsCommit(t *testing.T) {
	setupModelDirectoryMetadataTestDB(t)
	var notifications int
	SetModelDirectoryMetadataChangedHook(func() { notifications++ })
	t.Cleanup(func() { SetModelDirectoryMetadataChangedHook(nil) })

	rows := []ModelDirectoryMetadata{validModelDirectoryMetadata(t, "gpt-5")}
	_, err := ApplyModelDirectoryMetadataImport(DB, rows)
	require.NoError(t, err)
	require.Equal(t, 1, notifications)

	_, err = ApplyModelDirectoryMetadataImport(DB, rows)
	require.NoError(t, err)
	require.Equal(t, 1, notifications)
}

func TestModelDirectoryMetadataImportRollsBackOnWriteFailure(t *testing.T) {
	setupModelDirectoryMetadataTestDB(t)
	require.NoError(t, DB.Exec(`CREATE TRIGGER reject_bad_metadata BEFORE INSERT ON model_directory_metadata WHEN NEW.model_name = 'bad-model' BEGIN SELECT RAISE(FAIL, 'rejected'); END`).Error)

	_, err := ApplyModelDirectoryMetadataImport(DB, []ModelDirectoryMetadata{
		validModelDirectoryMetadata(t, "good-model"),
		validModelDirectoryMetadata(t, "bad-model"),
	})
	require.Error(t, err)

	var count int64
	require.NoError(t, DB.Model(&ModelDirectoryMetadata{}).Count(&count).Error)
	require.Zero(t, count)
}
