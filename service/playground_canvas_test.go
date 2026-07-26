package service

import (
	"errors"
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupPlaygroundCanvasTest(t *testing.T) (*model.InspirationTemplate, *model.InspirationTemplateVersion) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.InspirationCategory{}, &model.InspirationTemplate{}, &model.InspirationTemplateVersion{}, &model.PlaygroundCanvasProject{}))
	oldDB := model.DB
	model.DB = db
	t.Cleanup(func() { model.DB = oldDB })

	category := &model.InspirationCategory{Slug: "canvas-test", Name: "Canvas test", Status: "active"}
	require.NoError(t, db.Create(category).Error)
	template := &model.InspirationTemplate{CategoryId: category.Id, Slug: "canvas-test", Title: "Editable recipe", Prompt: "legacy", Modality: "image", Status: "published"}
	require.NoError(t, db.Create(template).Error)
	version := &model.InspirationTemplateVersion{TemplateId: template.Id, Version: 1, State: "released", PromptTemplate: "Draw {{subject}}", TagsJSON: "[]", VariablesJSON: `[{"key":"subject","label":"Subject","type":"text","required":true,"default_value":"a lighthouse"}]`, ModelPolicyJSON: `{"recommended":["gpt-image-1"],"compatible":[]}`, ParametersJSON: `{"steps":0}`, CoversJSON: "{}", ExamplesJSON: "[]"}
	require.NoError(t, db.Create(version).Error)
	template.PublishedVersionId = &version.Id
	require.NoError(t, db.Model(template).Update("published_version_id", version.Id).Error)
	return template, version
}

func TestPlaygroundCanvasCreateProvenanceAndOwnerScope(t *testing.T) {
	template, version := setupPlaygroundCanvasTest(t)
	project, err := CreatePlaygroundCanvasProject(41, template.Id, "", "Draw a lighthouse", map[string]any{"subject": "a lighthouse"})
	require.NoError(t, err)
	assert.Equal(t, template.Title, project.Title)
	assert.Equal(t, version.Id, project.InspirationVersionId)
	assert.Equal(t, 1, project.Revision)

	snapshot, ok := project.Snapshot.(map[string]any)
	require.True(t, ok)
	assert.Equal(t, float64(1), snapshot["schema_version"])
	provenance, ok := snapshot["provenance"].(map[string]any)
	require.True(t, ok)
	assert.Equal(t, float64(template.Id), provenance["inspiration_template_id"])
	nodes, ok := snapshot["nodes"].([]any)
	require.True(t, ok)
	require.NotEmpty(t, nodes)
	node := nodes[0].(map[string]any)
	assert.Equal(t, "textPrompt", node["type"])
	assert.Equal(t, "Draw a lighthouse", node["data"].(map[string]any)["text"])
	source := snapshot["source"].(map[string]any)
	assert.Equal(t, "a lighthouse", source["values"].(map[string]any)["subject"])
	assert.Equal(t, "gpt-image-1", source["model_policy"].(map[string]any)["recommended"].([]any)[0])

	_, err = GetPlaygroundCanvasProject(42, project.Id)
	assert.ErrorIs(t, err, gorm.ErrRecordNotFound)
	otherProjects, err := ListPlaygroundCanvasProjects(42)
	require.NoError(t, err)
	assert.Empty(t, otherProjects)
}

func TestPlaygroundCanvasSnapshotRoundTripCASAndConflict(t *testing.T) {
	template, _ := setupPlaygroundCanvasTest(t)
	project, err := CreatePlaygroundCanvasProject(7, template.Id, "Canvas", "", map[string]any{})
	require.NoError(t, err)
	snapshot := map[string]any{
		"schema_version": 1,
		"nodes":          []any{map[string]any{"id": "n", "position": map[string]any{"x": 0, "y": -0.0}, "data": map[string]any{"strength": 0, "enabled": false}}},
		"edges":          []any{map[string]any{"id": "e", "source": "n", "target": "n"}},
		"viewport":       map[string]any{"x": 0, "y": 0, "zoom": 0},
	}
	updated, err := UpdatePlaygroundCanvasProject(7, project.Id, 1, 1, "Changed", snapshot)
	require.NoError(t, err)
	assert.Equal(t, 2, updated.Revision)
	assert.Equal(t, "Changed", updated.Title)
	actual := updated.Snapshot.(map[string]any)
	assert.Equal(t, float64(0), actual["viewport"].(map[string]any)["zoom"])
	data := actual["nodes"].([]any)[0].(map[string]any)["data"].(map[string]any)
	assert.Equal(t, float64(0), data["strength"])
	assert.Equal(t, false, data["enabled"])

	_, err = UpdatePlaygroundCanvasProject(7, project.Id, 1, 1, "Stale", snapshot)
	var conflict *PlaygroundCanvasConflict
	require.True(t, errors.As(err, &conflict))
	assert.Equal(t, 2, conflict.CurrentRevision)

	_, err = UpdatePlaygroundCanvasProject(8, project.Id, 1, 1, "Other owner", snapshot)
	assert.ErrorIs(t, err, gorm.ErrRecordNotFound)

	_, err = UpdatePlaygroundCanvasProject(7, project.Id, 2, 2, "Unsupported", snapshot)
	assert.ErrorIs(t, err, ErrPlaygroundCanvasUnsupportedSnapshot)
}
